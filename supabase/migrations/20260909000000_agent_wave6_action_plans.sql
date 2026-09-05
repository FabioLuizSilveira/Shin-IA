-- Wave 6 of the Shinã Agent Platform: "Guided Actions" -- the agent's
-- first WRITE capability. Per the spec's own mandatory flow (User Intent
-- -> ActionPlan -> Validation -> Human Confirmation -> Authorization ->
-- optional AAL2 -> Execute -> Audit), a mutation tool NEVER writes
-- directly when the model calls it -- it only proposes a plan, persisted
-- here, which a separate confirm endpoint executes after re-checking
-- permission. This has to be a real server-side row, not client-held
-- conversation state: a live audit of shina-drawer.tsx confirmed the chat
-- UI sends NO conversation history today (every query is a fresh,
-- stateless request) -- so nothing on the client could carry a "pending
-- action" across the confirm step even if we wanted it to.
--
-- Shape borrows from two existing precedents rather than inventing a new
-- one (per a real audit, 2026-09-05): `approval_requests`' status enum +
-- expires_at (supabase/migrations/20260037000000_iam_approval_requests.sql)
-- and contract_documents' reviewed_by/reviewed_at column pair
-- (supabase/migrations/20260076000000_tenant_contract_engine.sql).
create table if not exists agent_action_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  tool_name text not null,
  risk_level text not null
    check (risk_level in ('LOW_RISK', 'LOW_RISK_WRITE', 'MEDIUM_RISK', 'HIGH_RISK')),
  requires_aal2 boolean not null default false,
  args jsonb not null default '{}'::jsonb,
  summary text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'executed', 'cancelled', 'rejected', 'expired')),
  result jsonb,
  error text,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  confirmed_by uuid,
  confirmed_at timestamptz,
  executed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_action_plans_tenant_id_idx on agent_action_plans (tenant_id);
create index if not exists agent_action_plans_status_idx on agent_action_plans (tenant_id, status);

alter table agent_action_plans enable row level security;
-- RLS is the backstop, never the primary mechanism -- same posture as
-- every other agent-platform table this session added. No `authenticated`
-- policy defined: only server-side tenant-scoped code paths touch this.

-- New real permission keys for the two Wave 6 actions actually wired this
-- round (mark_notifications_read, create_asset). Neither live route
-- underneath (PATCH /api/notifications, POST /api/assets) enforces a
-- hasTenantPermission() check today (confirmed by a real audit) -- the
-- agent path still requires one anyway, per this platform's own
-- permission-scoped invariant established since Wave 4.
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.notifications.manage', 'notifications', 'manage', 'Gerenciar notificações'),
    ('tenant.assets.create', 'assets', 'create', 'Criar ativos')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key in ('tenant.notifications.manage', 'tenant.assets.create')
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );
