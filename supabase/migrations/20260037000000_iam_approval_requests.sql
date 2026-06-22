-- Approval Requests (Workflow Instances)
-- Tracks all approval workflow instances across the system

create table if not exists approval_requests (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        uuid,         -- NULL for platform-level approvals
  workflow_type    text          not null, -- e.g. "commission.settlement.approve"
  subject_type     text          not null, -- e.g. "CommissionSettlement"
  subject_id       uuid          not null, -- the resource being approved
  submitted_by     uuid          not null, -- user_id who submitted
  status           text          not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  reason           text,
  rejection_reason text,
  expires_at       timestamptz   not null,
  version          integer       not null default 1,
  metadata         jsonb         not null default '{}',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz,

  constraint approval_requests_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

-- RLS: Tenant-scoped approvals are isolated by tenant
alter table approval_requests enable row level security;
alter table approval_requests force row level security;

create policy "approval_requests_select"
  on approval_requests for select
  to authenticated
  using (
    tenant_id is null -- platform approvals visible to all authenticated users (will be refined in M4.3)
    or tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

create index approval_requests_tenant_id_idx on approval_requests (tenant_id);
create index approval_requests_workflow_type_idx on approval_requests (workflow_type);
create index approval_requests_subject_id_idx on approval_requests (subject_id);
create index approval_requests_submitted_by_idx on approval_requests (submitted_by);
create index approval_requests_status_idx on approval_requests (status);
create index approval_requests_expires_at_idx on approval_requests (expires_at);
