-- Tenant IAM Permissions
-- All available permissions within a tenant scope

create table if not exists tenant_permissions (
  id               uuid          primary key default gen_random_uuid(),
  key              text          not null, -- e.g. "assets:read"
  resource         text          not null,
  action           text          not null,
  name             text          not null,
  description      text,
  is_system        boolean       not null default true, -- cannot be deleted if true
  version          integer       not null default 1,
  metadata         jsonb         not null default '{}',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz
);

create unique index tenant_permissions_unique_key 
  on tenant_permissions (key) 
  where deleted_at is null;

-- No RLS on tenant_permissions - shared across all tenants
-- Permissions are system-defined and same for all tenants

create index tenant_permissions_resource_idx on tenant_permissions (resource);
create index tenant_permissions_action_idx on tenant_permissions (action);
