-- Delegated Access
-- Allows users to grant a subset of their permissions to others (time-bounded)

create table if not exists delegated_access_requests (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        uuid          not null,
  grantor_id       uuid          not null, -- who is granting
  grantee_id       uuid          not null, -- who receives the permissions
  permissions      text[]        not null, -- array of permission keys
  branch_ids       uuid[]        default '{}', -- optional: restrict to branches
  reason           text,
  status           text          not null default 'active' check (status in ('active', 'revoked', 'expired')),
  granted_at       timestamptz   not null default now(),
  expires_at       timestamptz   not null, -- mandatory: no open-ended delegations
  revoked_at       timestamptz,
  revoked_by       uuid,
  version          integer       not null default 1,
  metadata         jsonb         not null default '{}',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz,

  constraint delegated_access_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,

  constraint delegated_access_grantor_fk
    foreign key (grantor_id) references user_profiles (id) on delete cascade,

  constraint delegated_access_grantee_fk
    foreign key (grantee_id) references user_profiles (id) on delete cascade
);

-- RLS: Users can see their own delegations
alter table delegated_access_requests enable row level security;
alter table delegated_access_requests force row level security;

create policy "delegated_access_select"
  on delegated_access_requests for select
  to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

create index delegated_access_tenant_id_idx on delegated_access_requests (tenant_id);
create index delegated_access_grantor_id_idx on delegated_access_requests (grantor_id);
create index delegated_access_grantee_id_idx on delegated_access_requests (grantee_id);
create index delegated_access_status_idx on delegated_access_requests (status);
create index delegated_access_expires_at_idx on delegated_access_requests (expires_at);
