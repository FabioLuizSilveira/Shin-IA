-- Wave 8 of the Shinã Agent Platform: "Limited Proactive Automation".
-- Confirmed via a real audit (2026-09-05) that packages/rule-engine and
-- packages/workflow-engine were both DELETED from git in an earlier
-- cleanup commit, and even their recovered historical source assumed a
-- domain model (typed condition trees, state-machine graphs) that doesn't
-- match the real, flat-column rule_sets/workflow_definitions tables --
-- same "package doesn't match live schema" problem resource-engine had
-- back in Wave 3. Bypassed entirely; automations here are hand-rolled
-- against the real tables directly, same posture as
-- lib/resource-availability.ts and lib/infraction-deadlines.ts.
--
-- Scope, per the spec's own restriction for this wave: LOW_RISK,
-- REVERSIBLE, EXPLICITLY ENABLED only. risk_level is hard-constrained to
-- 'LOW_RISK' at the schema level (not just documented) -- there is no
-- code path in this wave that could even attempt a MEDIUM/HIGH_RISK
-- automation. Every automation only ever sends an in-app notification
-- (createNotification()) -- never proposes or executes a mutation, so
-- Wave 6's ActionPlan flow isn't needed here (a future wave could wire
-- automations to propose plans; explicitly out of scope now).
create table if not exists agent_automations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  owner_user_id uuid not null,
  name text not null,
  automation_type text not null
    check (automation_type in ('daily_summary', 'contract_expiry_alert')),
  risk_level text not null default 'LOW_RISK' check (risk_level = 'LOW_RISK'),
  frequency text not null default 'daily' check (frequency = 'daily'),
  scope jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  allowed_tools text[] not null default '{}',
  budget_credits numeric,
  -- The per-automation kill switch the spec requires (enable/disable/
  -- pause). A platform-level circuit breaker also exists: the cron route
  -- additionally requires the tenant's agent.automation.enabled feature
  -- flag (tenant_feature_flags, same table every prior wave uses) to be
  -- on -- two independent gates, neither sufficient alone.
  enabled boolean not null default false,
  last_run_at timestamptz,
  last_run_status text,
  -- Idempotency/dedup state (e.g. which contract ids were already
  -- notified about) -- same "alerted once per condition" idea as
  -- infraction-deadlines.ts's alerted_thresholds column, generalized into
  -- jsonb since each automation_type tracks a different shape.
  last_run_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_automations_tenant_id_idx on agent_automations (tenant_id);
create index if not exists agent_automations_enabled_idx on agent_automations (tenant_id, enabled);

alter table agent_automations enable row level security;
-- RLS backstop only, same posture as every table this session added --
-- only the cron route (service-role) and tenant-scoped CRUD routes touch
-- this table.

insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values ('tenant.automations.manage', 'automations', 'manage', 'Gerenciar automações da Shinã')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key = 'tenant.automations.manage'
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );
