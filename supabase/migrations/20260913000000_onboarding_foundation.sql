-- WAVE 1 — Foundation for the Intelligent Tenant Onboarding initiative.
--
-- Reuses (does NOT touch) the existing commercial spine: plans / plan_versions /
-- contract_templates / contract_versions / commercial_terms_snapshots /
-- contract_acceptances / platform_subscriptions / blueprint_instances /
-- tenant_activity_log's existing columns. This migration only adds the
-- persistent domain the rest of the initiative builds on:
--
--   business_profiles         — how the tenant's operation works (versioned,
--                               permanent — not a throwaway onboarding artifact)
--   commercial_configurations — the EDITABLE draft of exactly what is being
--                               contracted; on acceptance it produces the
--                               immutable commercial_terms_snapshots row that
--                               already exists (not a separate "Pedido Comercial")
--   retention_policies        — versioned, platform-wide (control plane)
--
-- plus correlation/actor metadata on tenant_activity_log so one onboarding →
-- contract → provisioning flow can be reconstructed from a single id.

-- ── 1. Audit trail: correlation + actor typing (additive) ───────────────────
alter table tenant_activity_log
  add column if not exists actor_type text
    check (actor_type in ('tenant_user', 'shina_operator', 'system')),
  add column if not exists correlation_id uuid,
  add column if not exists session_id text;
create index if not exists tenant_activity_log_correlation_idx
  on tenant_activity_log (correlation_id) where correlation_id is not null;

-- ── 2. business_profiles ───────────────────────────────────────────────────
create table if not exists business_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  version integer not null,
  primary_vertical text not null,
  additional_verticals text[] not null default '{}',
  asset_types text[] not null default '{}',
  asset_quantity integer,
  projected_asset_quantity integer,
  users integer,
  branches integer,
  operational_capabilities text[] not null default '{}',
  integration_needs text[] not null default '{}',
  answers jsonb not null default '[]'::jsonb,
  source text not null check (source in ('self_service', 'assisted', 'demo')),
  created_by uuid not null,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'superseded')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (tenant_id, version)
);
create index if not exists business_profiles_tenant_idx on business_profiles (tenant_id);
-- At most one confirmed profile per tenant at any time — a new confirmed
-- version supersedes the previous one (enforced in code + this index).
create unique index if not exists business_profiles_one_confirmed
  on business_profiles (tenant_id) where status = 'confirmed';

alter table business_profiles enable row level security;
alter table business_profiles force row level security;
-- Same posture as every other tenant table: select-only for tenant staff by
-- JWT tenant_id; all writes go through the service-role admin client.
create policy "business_profiles_select" on business_profiles for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── 3. commercial_configurations ───────────────────────────────────────────
-- The editable pre-acceptance draft. quotas / prices / discounts are jsonb to
-- stay shape-aligned with plan_versions' own (currently dormant)
-- usage_limits / overage_rules / discount_rules columns.
create table if not exists commercial_configurations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  version integer not null,
  business_profile_id uuid references business_profiles (id),
  plan_id uuid references plans (id),
  plan_version_id uuid references plan_versions (id),
  extensions jsonb not null default '[]'::jsonb,
  quotas jsonb not null default '{}'::jsonb,
  integrations jsonb not null default '[]'::jsonb,
  billing_cycle text check (billing_cycle in ('monthly', 'yearly')),
  prices jsonb not null default '{}'::jsonb,
  discounts jsonb not null default '{}'::jsonb,
  commitment_period_months integer,
  pricing_version integer,
  effective_at timestamptz,
  source text not null check (source in ('self_service', 'assisted')),
  created_by uuid not null,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'accepted', 'superseded')),
  commercial_terms_snapshot_id uuid references commercial_terms_snapshots (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, version)
);
create index if not exists commercial_configurations_tenant_idx
  on commercial_configurations (tenant_id);

alter table commercial_configurations enable row level security;
alter table commercial_configurations force row level security;
create policy "commercial_configurations_select" on commercial_configurations for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── 4. retention_policies (control plane, platform-wide, versioned) ─────────
create table if not exists retention_policies (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  name text not null,
  rules jsonb not null default '[]'::jsonb,
  summary text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'superseded')),
  effective_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
alter table retention_policies enable row level security;
alter table retention_policies force row level security;
-- Readable by any authenticated user (shown in onboarding + on the contract);
-- writes are control-plane / service-role only.
create policy "retention_policies_select_published" on retention_policies for select to authenticated
  using (status = 'published');

insert into retention_policies (version, name, rules, summary, status, effective_at, published_at)
values (
  1,
  'Política de Retenção de Dados Shinã v1',
  '[
    {"dataCategory":"operational_data","retention":"vigência do contrato + 30 dias","action":"export_then_delete","basis":"execução de contrato"},
    {"dataCategory":"contracts","retention":"vigência + 5 anos","action":"retain","basis":"obrigação legal"},
    {"dataCategory":"audit_logs","retention":"5 anos","action":"retain","basis":"obrigação legal / segurança"},
    {"dataCategory":"traffic_documents","retention":"conforme prazo legal da infração","action":"retain","basis":"obrigação legal"},
    {"dataCategory":"telemetry","retention":"12 meses","action":"anonymize","basis":"legítimo interesse"},
    {"dataCategory":"backups","retention":"90 dias","action":"delete","basis":"continuidade operacional"},
    {"dataCategory":"billing_records","retention":"5 anos","action":"retain","basis":"obrigação fiscal"}
  ]'::jsonb,
  'Seus dados seguem a Política de Retenção da Shinã e as obrigações legais aplicáveis.',
  'published', now(), now()
)
on conflict (version) do nothing;
