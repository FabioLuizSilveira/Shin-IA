-- Unified Commercial Flow — Shinã Platform + Shinã MKT.
--
-- Extends the EXISTING platform_customers/platform_subscriptions billing
-- context (20260052000000_platform_billing.sql) instead of duplicating it —
-- adds plan versioning, immutable commercial-terms snapshots, and a real
-- contract-acceptance model so BOTH products go through the same
-- accept -> checkout -> webhook -> activate pipeline. Today only Shinã MKT
-- does this for real; Shinã Platform activates a tenant's subscription by
-- direct trust-based provisioning (see tenant-provisioning.ts) with no
-- checkout, no webhook, no acceptance at all — that gap is what this closes.

-- ── Plans & versions ────────────────────────────────────────────────────────
-- A plan is a stable identity (e.g. "growth"); a plan_version is the
-- immutable, point-in-time commercial terms. Never mutate a published
-- version's terms — publish a new version instead. This is what lets us
-- answer "what did this tenant actually agree to on 2026-03-01" without
-- looking at today's config.
create table if not exists plans (
  id          uuid                  primary key default gen_random_uuid(),
  product     subscription_product  not null,
  key         text                  not null,
  name        text                  not null,
  is_active   boolean               not null default true,
  created_at  timestamptz           not null default now()
);

create unique index plans_product_key_unique on plans (product, key);

create table if not exists plan_versions (
  id                       uuid          primary key default gen_random_uuid(),
  plan_id                  uuid          not null references plans (id) on delete cascade,
  version                  integer       not null,
  name                     text          not null,
  price_cents              integer       not null,
  currency                 text          not null default 'BRL',
  billing_cycle            text          not null check (billing_cycle in ('monthly', 'yearly')),
  trial_days               integer       not null default 0,
  commitment_period_months integer,
  included_features        jsonb         not null default '[]',
  usage_limits             jsonb         not null default '{}',
  overage_rules            jsonb         not null default '{}',
  discount_rules           jsonb         not null default '{}',
  revenue_share            jsonb         not null default '{}',
  metadata                 jsonb         not null default '{}',
  stripe_price_id          text,
  active_from              timestamptz   not null default now(),
  active_until             timestamptz,
  published_at             timestamptz,
  status                   text          not null default 'draft'
                              check (status in ('draft', 'published', 'superseded')),
  created_at               timestamptz   not null default now()
);

create unique index plan_versions_plan_version_unique on plan_versions (plan_id, version);
create index plan_versions_status_idx on plan_versions (status);

-- ── Contracts ────────────────────────────────────────────────────────────────
-- Exactly one template per product (item 6/7 of the spec: no per-extension
-- addenda — Tracking/AI/Marketplace are plan features, not separately
-- contracted products).
create table if not exists contract_templates (
  id          uuid                  primary key default gen_random_uuid(),
  key         text                  not null unique,
  product     subscription_product  not null unique,
  name        text                  not null,
  created_at  timestamptz           not null default now()
);

create table if not exists contract_versions (
  id                    uuid          primary key default gen_random_uuid(),
  contract_template_id  uuid          not null references contract_templates (id) on delete cascade,
  version               integer       not null,
  title                 text          not null,
  content                text         not null,
  content_hash          text         not null,
  material_change       boolean      not null default false,
  effective_at          timestamptz  not null default now(),
  published_at          timestamptz,
  status                text         not null default 'draft'
                           check (status in ('draft', 'published', 'superseded')),
  created_at             timestamptz  not null default now()
);

create unique index contract_versions_template_version_unique
  on contract_versions (contract_template_id, version);
create index contract_versions_status_idx on contract_versions (contract_template_id, status);

-- ── Commercial terms snapshot ───────────────────────────────────────────────
-- Immutable copy of everything that was actually presented/agreed at
-- acceptance time — never re-derived from current plan/contract config.
create table if not exists commercial_terms_snapshots (
  id                        uuid          primary key default gen_random_uuid(),
  tenant_id                 uuid          not null references tenants (id) on delete cascade,
  user_id                   uuid          not null,
  product                   subscription_product not null,
  plan_id                   uuid          not null references plans (id),
  plan_version_id           uuid          not null references plan_versions (id),
  contract_version_id       uuid          not null references contract_versions (id),
  price_cents               integer       not null,
  currency                  text          not null,
  billing_cycle             text          not null,
  trial_days                integer       not null default 0,
  commitment_period_months  integer,
  included_features         jsonb         not null default '[]',
  usage_limits               jsonb         not null default '{}',
  overage_rules              jsonb         not null default '{}',
  discount_rules             jsonb         not null default '{}',
  revenue_share               jsonb        not null default '{}',
  accepted_at                timestamptz  not null default now(),
  created_at                 timestamptz  not null default now()
);

create index commercial_terms_snapshots_tenant_id_idx on commercial_terms_snapshots (tenant_id);

-- ── Contract acceptance ─────────────────────────────────────────────────────
-- user_id is NEVER nullable — the new onboarding flow authenticates first
-- (see Fase B), so there is no anonymous-acceptance case to accommodate,
-- unlike the earlier draft of this feature.
create table if not exists contract_acceptances (
  id                            uuid          primary key default gen_random_uuid(),
  tenant_id                     uuid          not null references tenants (id) on delete cascade,
  user_id                       uuid          not null,
  product                       subscription_product not null,
  plan_id                       uuid          not null references plans (id),
  plan_version_id               uuid          not null references plan_versions (id),
  commercial_terms_snapshot_id  uuid          not null references commercial_terms_snapshots (id),
  contract_version_id           uuid          not null references contract_versions (id),
  accepted_at                   timestamptz   not null default now(),
  ip_address                    inet,
  user_agent                    text,
  session_id                    text,
  document_hash                 text          not null,
  representative_name           text          not null,
  representative_role           text          not null,
  representative_document       text,
  declared_authority            boolean       not null,
  metadata                      jsonb         not null default '{}'
);

create index contract_acceptances_tenant_id_idx on contract_acceptances (tenant_id);
create index contract_acceptances_tenant_product_idx on contract_acceptances (tenant_id, product);

-- ── Plan change acceptance (upgrade/downgrade — commercial, not legal) ──────
create table if not exists plan_change_acceptances (
  id                            uuid          primary key default gen_random_uuid(),
  tenant_id                     uuid          not null references tenants (id) on delete cascade,
  user_id                       uuid          not null,
  product                       subscription_product not null,
  from_plan_version_id          uuid          references plan_versions (id),
  to_plan_version_id            uuid          not null references plan_versions (id),
  commercial_terms_snapshot_id  uuid          not null references commercial_terms_snapshots (id),
  accepted_at                   timestamptz   not null default now(),
  ip_address                    inet,
  user_agent                    text
);

create index plan_change_acceptances_tenant_id_idx on plan_change_acceptances (tenant_id);

-- ── Checkout session references (webhook reconciliation) ───────────────────
create table if not exists checkout_session_references (
  id                            uuid          primary key default gen_random_uuid(),
  tenant_id                     uuid          not null references tenants (id) on delete cascade,
  user_id                       uuid          not null,
  product                       subscription_product not null,
  plan_version_id               uuid          not null references plan_versions (id),
  commercial_terms_snapshot_id  uuid          not null references commercial_terms_snapshots (id),
  contract_acceptance_id        uuid          not null references contract_acceptances (id),
  provider                      text          not null default 'stripe',
  provider_session_id           text,
  status                        text          not null default 'open'
                                   check (status in ('open', 'completed', 'expired')),
  created_at                    timestamptz   not null default now()
);

create unique index checkout_session_references_provider_session_unique
  on checkout_session_references (provider_session_id) where provider_session_id is not null;
create index checkout_session_references_tenant_id_idx on checkout_session_references (tenant_id);

-- ── Extend platform_subscriptions (not duplicated — same table as before) ──
alter table platform_subscriptions
  add column if not exists plan_version_id uuid references plan_versions (id),
  add column if not exists commercial_terms_snapshot_id uuid references commercial_terms_snapshots (id),
  add column if not exists billing_mode text not null default 'card'
    check (billing_mode in ('card', 'invoice', 'manual_contract', 'custom'));

-- ── New statuses ─────────────────────────────────────────────────────────────
-- platform_subscription_status already has 'pending' (20260052000000) — only
-- 'pending_payment' is new. tenant_status has neither yet.
alter type platform_subscription_status add value if not exists 'pending_payment';
alter type tenant_status add value if not exists 'pending_payment';

-- ── RLS — same posture as tenant_activity_log (20260056000000): select-only
-- for tenant staff via JWT tenant_id, all writes via service role. ─────────
alter table plans enable row level security;
alter table plans force row level security;
create policy "plans_select_all" on plans for select to authenticated using (true);

alter table plan_versions enable row level security;
alter table plan_versions force row level security;
create policy "plan_versions_select_published" on plan_versions for select to authenticated
  using (status = 'published');

alter table contract_templates enable row level security;
alter table contract_templates force row level security;
create policy "contract_templates_select_all" on contract_templates for select to authenticated
  using (true);

alter table contract_versions enable row level security;
alter table contract_versions force row level security;
create policy "contract_versions_select_published" on contract_versions for select to authenticated
  using (status = 'published');

alter table commercial_terms_snapshots enable row level security;
alter table commercial_terms_snapshots force row level security;
create policy "commercial_terms_snapshots_select" on commercial_terms_snapshots for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table contract_acceptances enable row level security;
alter table contract_acceptances force row level security;
create policy "contract_acceptances_select" on contract_acceptances for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table plan_change_acceptances enable row level security;
alter table plan_change_acceptances force row level security;
create policy "plan_change_acceptances_select" on plan_change_acceptances for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table checkout_session_references enable row level security;
alter table checkout_session_references force row level security;
create policy "checkout_session_references_select" on checkout_session_references for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── Seed: the two contract templates + one published version each + one
-- plan/version per product so checkout has something real to reference.
-- Legal text is a placeholder — Shinã's legal team reviews before this ever
-- reaches a real customer. ───────────────────────────────────────────────────
insert into contract_templates (id, key, product, name) values
  ('c0000000-0000-0000-0000-000000000001', 'MASTER_SAAS_AGREEMENT', 'platform', 'Contrato-Mestre Shinã Platform'),
  ('c0000000-0000-0000-0000-000000000002', 'MKT_SERVICE_AGREEMENT', 'mkt', 'Contrato de Serviço Shinã MKT')
on conflict (id) do nothing;

insert into contract_versions (id, contract_template_id, version, title, content, content_hash, material_change, effective_at, published_at, status) values
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1,
   'Contrato-Mestre Shinã Platform v1',
   '[PLACEHOLDER — texto revisado pelo jurídico da Shinã antes de produção] Termos e condições de uso da plataforma Shinã.',
   encode(sha256('[PLACEHOLDER — texto revisado pelo jurídico da Shinã antes de produção] Termos e condições de uso da plataforma Shinã.'::bytea), 'hex'),
   false, now(), now(), 'published'),
  ('c1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 1,
   'Contrato de Serviço Shinã MKT v1',
   '[PLACEHOLDER — texto revisado pelo jurídico da Shinã antes de produção] Termos e condições do serviço Shinã MKT.',
   encode(sha256('[PLACEHOLDER — texto revisado pelo jurídico da Shinã antes de produção] Termos e condições do serviço Shinã MKT.'::bytea), 'hex'),
   false, now(), now(), 'published')
on conflict (id) do nothing;

insert into plans (id, product, key, name) values
  ('c2000000-0000-0000-0000-000000000001', 'platform', 'starter', 'Starter'),
  ('c2000000-0000-0000-0000-000000000002', 'platform', 'professional', 'Professional'),
  ('c2000000-0000-0000-0000-000000000003', 'mkt', 'growth', 'Growth')
on conflict (id) do nothing;

insert into plan_versions (id, plan_id, version, name, price_cents, currency, billing_cycle, trial_days, included_features, active_from, published_at, status) values
  ('c3000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 'Starter', 29900, 'BRL', 'monthly', 14,
   '["operations", "assets", "crm"]', now(), now(), 'published'),
  ('c3000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 1, 'Professional', 59900, 'BRL', 'monthly', 14,
   '["operations", "assets", "crm", "tracking", "ai", "reporting"]', now(), now(), 'published'),
  ('c3000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000003', 1, 'Growth', 19900, 'BRL', 'monthly', 0,
   '["campaigns", "content", "automations"]', now(), now(), 'published')
on conflict (id) do nothing;

-- ── legal_contracts:accept permission — first tenant_permissions catalog
-- entry actually enforced at runtime (see requirement resolver in the plan
-- doc: today the catalog only feeds the admin UI, nothing gates on it). ────
insert into tenant_permissions (key, resource, action, name, is_system)
select 'legal_contracts:accept', 'legal_contracts', 'accept', 'Aceitar contratos e planos', true
where not exists (
  select 1 from tenant_permissions where key = 'legal_contracts:accept' and deleted_at is null
);

insert into tenant_permissions (key, resource, action, name, is_system)
select 'billing_plan:change', 'billing_plan', 'change', 'Alterar plano de assinatura', true
where not exists (
  select 1 from tenant_permissions where key = 'billing_plan:change' and deleted_at is null
);

-- Grant both to tenant_owner/tenant_admin on every existing tenant (item 30 —
-- "Tenant Owner deve possuir por padrão"), not just new ones.
insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key in ('legal_contracts:accept', 'billing_plan:change')
on conflict do nothing;
