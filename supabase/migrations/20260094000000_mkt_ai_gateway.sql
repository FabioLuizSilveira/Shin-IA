-- Shinã MKT — AI Gateway (SHINA / BYOK / HYBRID)
--
-- Extends the existing mkt_ai_providers (BYOK credential storage, already
-- encrypted/workspace-scoped since M-MKT-11) and mkt_ai_usage (usage
-- tracking, already present since mkt_foundation) rather than replacing
-- them — this migration only adds what those two tables genuinely don't
-- have yet: a per-workspace AI policy, a credit ledger + balance, and a
-- server-only model cost policy for converting real provider cost into
-- Shinã AI credits.
--
-- No commercial numbers (credit prices, plan grants, overage) are decided
-- here — see docs/ai/AI_PROVIDER_STRATEGY.md section "Não definido ainda".

-- ── mkt_ai_providers — add fields needed for the "connected" UI (section 17/18
--    of the spec: createdAt/lastValidatedAt, never the key itself) ──────────
alter table mkt_ai_providers
  add column if not exists last_validated_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- ── mkt_ai_usage — add gateway-specific columns. All nullable so existing
--    rows (written before this migration) remain valid. ────────────────────
alter table mkt_ai_usage
  add column if not exists credential_source text
    check (credential_source in ('SHINA', 'BYOK')),
  add column if not exists billing_source text
    check (billing_source in ('SHINA_CREDITS', 'EXTERNAL_PROVIDER')),
  add column if not exists credits_consumed numeric(14, 4),
  add column if not exists estimated_cost_usd numeric(10, 6),
  add column if not exists idempotency_key text,
  add column if not exists request_id uuid not null default gen_random_uuid();

-- Idempotency: the same logical request (retry after timeout/network
-- recovery) must never be metered/charged twice for the same workspace.
create unique index if not exists mkt_ai_usage_idempotency_uidx
  on mkt_ai_usage (workspace_id, idempotency_key)
  where idempotency_key is not null;

-- ── mkt_ai_policy — per-workspace override of AI mode. Absence of a row
--    means "use the safe default" (BYOK-only, no Shinã fallback) — the
--    resolver in apps/mkt never treats "no row" as permission to spend
--    Shinã credits (item 27: no existing/new workspace starts consuming
--    Shinã AI silently). ────────────────────────────────────────────────
create table mkt_ai_policy (
  workspace_id         uuid        primary key
                          references mkt_workspaces (id) on delete cascade,
  tenant_id            uuid        not null references tenants (id) on delete cascade,
  mode                 text        not null default 'BYOK'
                          check (mode in ('SHINA', 'BYOK', 'HYBRID')),
  -- Only meaningful when mode = 'HYBRID'. preferred_source picks which
  -- credential the gateway tries first; allow_shina_fallback must be
  -- explicitly true for the gateway to ever fall back from BYOK to Shinã
  -- (item 8: never a silent fallback on invalid key/quota/billing failure).
  preferred_source     text        check (preferred_source in ('BYOK', 'SHINA')),
  allow_shina_fallback boolean     not null default false,
  updated_at           timestamptz not null default now(),
  updated_by           uuid
);

alter table mkt_ai_policy enable row level security;

create policy "mkt_ai_policy_select" on mkt_ai_policy for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ai_policy_upsert" on mkt_ai_policy for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ai_policy_update" on mkt_ai_policy for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_ai_credit_balances — current balance, updated atomically together
--    with the ledger row by mkt_apply_ai_credit_event() below. Kept
--    separate from summing the ledger on every read so a credit check
--    before an expensive provider call is a single indexed lookup. ────────
create table mkt_ai_credit_balances (
  workspace_id uuid           primary key
                 references mkt_workspaces (id) on delete cascade,
  tenant_id    uuid           not null references tenants (id) on delete cascade,
  balance      numeric(14, 4) not null default 0,
  updated_at   timestamptz    not null default now()
);

alter table mkt_ai_credit_balances enable row level security;

create policy "mkt_ai_credit_balances_select" on mkt_ai_credit_balances for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_ai_credits — append-only ledger. Every balance change is
--    traceable to an event; nothing overwrites credits_remaining in place.
create table mkt_ai_credits (
  id            uuid           primary key default gen_random_uuid(),
  workspace_id  uuid           not null references mkt_workspaces (id) on delete cascade,
  tenant_id     uuid           not null references tenants (id) on delete cascade,
  event_type    text           not null
                  check (event_type in (
                    'CREDIT_GRANT', 'AI_USAGE', 'CREDIT_PURCHASE',
                    'PLAN_RENEWAL', 'ADJUSTMENT', 'REFUND', 'EXPIRATION'
                  )),
  credits_delta numeric(14, 4) not null,
  balance_after numeric(14, 4) not null,
  usage_id      uuid           references mkt_ai_usage (id) on delete set null,
  metadata      jsonb          not null default '{}',
  created_at    timestamptz    not null default now()
);

create index mkt_ai_credits_workspace_idx on mkt_ai_credits (workspace_id, created_at desc);

alter table mkt_ai_credits enable row level security;

create policy "mkt_ai_credits_select" on mkt_ai_credits for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
-- No insert/update/delete policy for `authenticated` — the ledger is only
-- ever written by mkt_apply_ai_credit_event() (security definer), never by
-- a direct client insert, so there is nothing to forge from the browser.

-- ── mkt_apply_ai_credit_event — the only writer of the ledger + balance.
--    Atomic (single UPDATE ... RETURNING under the row lock implied by the
--    update) so concurrent usage from the same workspace can't double-spend
--    the same credits. Rejects (raises) when a debit would take the balance
--    negative — callers must pre-check balance before calling the provider,
--    this function is the enforcement backstop, not the primary gate. ─────
create or replace function mkt_apply_ai_credit_event(
  p_workspace_id uuid,
  p_tenant_id uuid,
  p_event_type text,
  p_delta numeric,
  p_usage_id uuid default null,
  p_metadata jsonb default '{}'
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_owner_tenant uuid;
begin
  select tenant_id into v_owner_tenant from mkt_workspaces where id = p_workspace_id;
  if v_owner_tenant is null or v_owner_tenant <> p_tenant_id then
    raise exception 'workspace_tenant_mismatch' using errcode = 'P0001';
  end if;

  insert into mkt_ai_credit_balances (workspace_id, tenant_id, balance)
  values (p_workspace_id, p_tenant_id, 0)
  on conflict (workspace_id) do nothing;

  update mkt_ai_credit_balances
  set balance = balance + p_delta, updated_at = now()
  where workspace_id = p_workspace_id
  returning balance into v_balance;

  if v_balance < 0 then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  insert into mkt_ai_credits (
    workspace_id, tenant_id, event_type, credits_delta, balance_after, usage_id, metadata
  ) values (
    p_workspace_id, p_tenant_id, p_event_type, p_delta, v_balance, p_usage_id, coalesce(p_metadata, '{}')
  );

  return v_balance;
end;
$$;

-- ── mkt_model_cost_policy — server-only. Converts real provider cost into
--    Shinã AI credits, versioned so prices/models can change without a
--    new app release. NEVER exposed to the client — RLS enabled, zero
--    policies for `authenticated`/`anon` (item 12: internal cost is never
--    shown to the customer). Only the service-role key can read it. ───────
create table mkt_model_cost_policy (
  id                uuid           primary key default gen_random_uuid(),
  provider          text           not null,
  model             text           not null,
  capability        text           not null default 'text',
  effective_from    timestamptz    not null default now(),
  -- Real provider $/M-token figures the gateway uses to compute
  -- estimated_cost_usd — NOT a commercial price shown to the customer.
  cost_basis        jsonb          not null default '{}',
  -- credits_charged = (cost_basis-derived $ cost) * credit_multiplier.
  -- Left at a neutral 1:1 placeholder (1 credit ≈ $0.001) pending the
  -- actual commercial decision — see item 26 of the spec, not decided here.
  credit_multiplier numeric(10, 4) not null default 1000,
  status            text           not null default 'draft'
                       check (status in ('draft', 'published', 'superseded')),
  created_at        timestamptz    not null default now()
);

create index mkt_model_cost_policy_lookup_idx
  on mkt_model_cost_policy (provider, model, capability, status);

alter table mkt_model_cost_policy enable row level security;
-- Intentionally no policies — see comment above.

insert into mkt_model_cost_policy (provider, model, capability, cost_basis, credit_multiplier, status)
values (
  'anthropic', 'claude-sonnet-5', 'text',
  '{"inputPerMTokUsd": 3, "outputPerMTokUsd": 15, "note": "real anthropic list price, not a commercial credit price"}',
  1000, 'published'
);

-- ── Migrate existing workspaces — every workspace that already has an
--    active BYOK key keeps mode = BYOK explicitly (item 27: no silent
--    switch to Shinã AI for anyone who was already using their own key).
insert into mkt_ai_policy (workspace_id, tenant_id, mode, allow_shina_fallback)
select distinct p.workspace_id, p.tenant_id, 'BYOK', false
from mkt_ai_providers p
where p.is_active = true and p.api_key_enc is not null
on conflict (workspace_id) do nothing;
