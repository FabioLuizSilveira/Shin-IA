-- WAVE 4 — PROVISIONING + CONTROL PLANE for the Intelligent Tenant
-- Onboarding initiative.
--
-- Provisioning NEVER runs before the contract is settled (STOP condition:
-- provisioning-before-contract). The gate is enforced in code
-- (checkProvisioningReadiness): the onboarding_contract_snapshot must be
-- `frozen`, its hash must still verify, and — depending on execution_mode —
-- either a contract_acceptance (click_accept) or a completed signature_request
-- (electronic_signature) must exist.
--
-- Reuses (does NOT touch): blueprint_instances / plans / plan_versions /
-- platform_subscriptions / commercial_configurations / tenant_feature_flags /
-- entitlements (derived, never persisted). Adds only an idempotent run log.
--
--   onboarding_provisioning_runs — one row per provisioning attempt; steps[]
--                                  records what actually happened so a
--                                  failed run is resumable / auditable.

create table if not exists onboarding_provisioning_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  onboarding_contract_snapshot_id uuid not null references onboarding_contract_snapshots (id),
  commercial_configuration_id uuid not null references commercial_configurations (id),
  correlation_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  steps jsonb not null default '[]'::jsonb,
  error text,
  created_by uuid not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists onboarding_provisioning_runs_tenant_idx
  on onboarding_provisioning_runs (tenant_id);
create index if not exists onboarding_provisioning_runs_snapshot_idx
  on onboarding_provisioning_runs (onboarding_contract_snapshot_id);
-- At most one non-failed run per frozen contract snapshot — re-running after
-- a failure is allowed; provisioning the same settled contract twice is not.
create unique index if not exists onboarding_provisioning_runs_one_active
  on onboarding_provisioning_runs (onboarding_contract_snapshot_id)
  where status in ('pending', 'running', 'completed');

alter table onboarding_provisioning_runs enable row level security;
alter table onboarding_provisioning_runs force row level security;
create policy "onboarding_provisioning_runs_select" on onboarding_provisioning_runs
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
