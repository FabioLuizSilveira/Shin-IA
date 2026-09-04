-- AI Gateway extraction (Shinã Agent Platform Wave 1)
--
-- The AI Gateway (credit ledger, versioned model-cost policy, per-workspace
-- policy) built for apps/mkt in 20260094000000_mkt_ai_gateway.sql is now a
-- shared package (@shina/ai-gateway) consumed by BOTH apps/mkt and the new
-- Shinã Agent Platform in apps/web. This migration:
--   1. generalizes the workspace concept so a non-mkt caller (apps/web,
--      which has no "workspace" of its own — only a tenant) can still use
--      the same ledger/policy tables without touching their PK/RPC shape;
--   2. renames the gateway tables/RPC off the `mkt_` prefix, including
--      mkt_ai_usage (predates the gateway migration, created in
--      20260040000000_mkt_foundation.sql, but is exactly the same
--      "AI usage meter" concept Wave 1 needs — apps/mkt's /api/metrics
--      reporting query and the /api/generate|clone|strategy entity_id
--      link-back are updated to the new name in the same change);
--   3. adds the minimal feature-flag table Wave 1 needs.
--
-- No commercial numbers change here. No data is deleted. mkt's existing
-- workspaces/policies/balances/ledger rows and behavior are unchanged —
-- only names move and a generalization layer is added underneath them.

-- ── ai_gateway_workspaces — generalizes "workspace" so the ledger/policy
--    tables' FK isn't hardcoded to mkt_workspaces (which has mkt-specific
--    columns like slug/plan/mode that make no sense for a non-mkt caller).
--    Every existing mkt_workspaces row gets a mirror row here (same id, so
--    no data migration needed on the ledger tables' existing FK values).
--    A trigger keeps future mkt_workspaces inserts mirrored automatically —
--    zero mkt application-code change required.
create table ai_gateway_workspaces (
  id         uuid        primary key,
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  owner_app  text        not null check (owner_app in ('mkt', 'web')),
  created_at timestamptz not null default now()
);

insert into ai_gateway_workspaces (id, tenant_id, owner_app)
select id, tenant_id, 'mkt' from mkt_workspaces;

create or replace function mkt_workspaces_mirror_ai_gateway_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into ai_gateway_workspaces (id, tenant_id, owner_app)
  values (new.id, new.tenant_id, 'mkt')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger mkt_workspaces_after_insert_mirror
  after insert on mkt_workspaces
  for each row execute function mkt_workspaces_mirror_ai_gateway_workspace();

alter table ai_gateway_workspaces enable row level security;
create policy "ai_gateway_workspaces_select" on ai_gateway_workspaces for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());

-- ── Rename the gateway-specific tables/RPC, re-point their FK at
--    ai_gateway_workspaces. Existing rows, indexes and RLS policies survive
--    a rename (Postgres tracks them by OID, not name). ─────────────────────
alter table mkt_ai_policy rename to ai_gateway_policy;
alter table ai_gateway_policy
  drop constraint mkt_ai_policy_pkey,
  add primary key (workspace_id);
alter table ai_gateway_policy
  drop constraint if exists mkt_ai_policy_workspace_id_fkey,
  add constraint ai_gateway_policy_workspace_id_fkey
    foreign key (workspace_id) references ai_gateway_workspaces (id) on delete cascade;

alter table mkt_ai_credit_balances rename to ai_gateway_credit_balances;
alter table ai_gateway_credit_balances
  drop constraint if exists mkt_ai_credit_balances_workspace_id_fkey,
  add constraint ai_gateway_credit_balances_workspace_id_fkey
    foreign key (workspace_id) references ai_gateway_workspaces (id) on delete cascade;

alter table mkt_ai_credits rename to ai_gateway_credit_ledger;
alter table ai_gateway_credit_ledger
  drop constraint if exists mkt_ai_credits_workspace_id_fkey,
  add constraint ai_gateway_credit_ledger_workspace_id_fkey
    foreign key (workspace_id) references ai_gateway_workspaces (id) on delete cascade;
alter index if exists mkt_ai_credits_workspace_idx rename to ai_gateway_credit_ledger_workspace_idx;

alter table mkt_model_cost_policy rename to ai_gateway_model_cost_policy;
alter index if exists mkt_model_cost_policy_lookup_idx rename to ai_gateway_model_cost_policy_lookup_idx;

-- mkt_ai_usage predates the gateway (20260040000000_mkt_foundation.sql) but
-- is exactly the shared "AI usage meter" concept -- renamed too so both
-- apps/mkt and apps/web write into one physically-named table. Its
-- workspace_id FK already points at mkt_workspaces; re-pointed at
-- ai_gateway_workspaces like the others so apps/web's synthetic workspace
-- ids are valid there too.
alter table mkt_ai_usage rename to ai_gateway_usage;
alter table ai_gateway_usage
  drop constraint if exists mkt_ai_usage_workspace_fk,
  add constraint ai_gateway_usage_workspace_id_fkey
    foreign key (workspace_id) references ai_gateway_workspaces (id) on delete cascade;

-- Rename the policies themselves too (cosmetic, avoids "mkt_ai_policy_select
-- on ai_gateway_policy" confusion in future `\d` output) — safe no-op if a
-- name doesn't match (defensive, since Postgres errors on a missing policy
-- name otherwise).
do $$
begin
  if exists (select 1 from pg_policies where tablename = 'ai_gateway_policy' and policyname = 'mkt_ai_policy_select') then
    alter policy "mkt_ai_policy_select" on ai_gateway_policy rename to "ai_gateway_policy_select";
    alter policy "mkt_ai_policy_upsert" on ai_gateway_policy rename to "ai_gateway_policy_upsert";
    alter policy "mkt_ai_policy_update" on ai_gateway_policy rename to "ai_gateway_policy_update";
  end if;
  if exists (select 1 from pg_policies where tablename = 'ai_gateway_credit_balances' and policyname = 'mkt_ai_credit_balances_select') then
    alter policy "mkt_ai_credit_balances_select" on ai_gateway_credit_balances rename to "ai_gateway_credit_balances_select";
  end if;
  if exists (select 1 from pg_policies where tablename = 'ai_gateway_credit_ledger' and policyname = 'mkt_ai_credits_select') then
    alter policy "mkt_ai_credits_select" on ai_gateway_credit_ledger rename to "ai_gateway_credit_ledger_select";
  end if;
  if exists (select 1 from pg_policies where tablename = 'ai_gateway_usage' and policyname = 'mkt_ai_usage_select') then
    alter policy "mkt_ai_usage_select" on ai_gateway_usage rename to "ai_gateway_usage_select";
    alter policy "mkt_ai_usage_insert" on ai_gateway_usage rename to "ai_gateway_usage_insert";
  end if;
end $$;

-- ── apply_ai_credit_event — same body as mkt_apply_ai_credit_event, just
--    validated against ai_gateway_workspaces instead of mkt_workspaces (so
--    it works for both mkt and web workspace ids). Old function dropped —
--    every caller has moved to the new name (@shina/ai-gateway package).
create or replace function apply_ai_credit_event(
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
  select tenant_id into v_owner_tenant from ai_gateway_workspaces where id = p_workspace_id;
  if v_owner_tenant is null or v_owner_tenant <> p_tenant_id then
    raise exception 'workspace_tenant_mismatch' using errcode = 'P0001';
  end if;

  insert into ai_gateway_credit_balances (workspace_id, tenant_id, balance)
  values (p_workspace_id, p_tenant_id, 0)
  on conflict (workspace_id) do nothing;

  update ai_gateway_credit_balances
  set balance = balance + p_delta, updated_at = now()
  where workspace_id = p_workspace_id
  returning balance into v_balance;

  if v_balance < 0 then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  insert into ai_gateway_credit_ledger (
    workspace_id, tenant_id, event_type, credits_delta, balance_after, usage_id, metadata
  ) values (
    p_workspace_id, p_tenant_id, p_event_type, p_delta, v_balance, p_usage_id, coalesce(p_metadata, '{}')
  );

  return v_balance;
end;
$$;

drop function if exists mkt_apply_ai_credit_event(uuid, uuid, text, numeric, uuid, jsonb);

-- ── Minimal feature-flag table (Wave 1) — smallest viable mechanism, not a
--    generic flag platform. Default OFF (opt-in only). ─────────────────────
create table tenant_feature_flags (
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  flag_key   text        not null,
  enabled    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, flag_key)
);

alter table tenant_feature_flags enable row level security;
create policy "tenant_feature_flags_select" on tenant_feature_flags for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
