-- Platform IAM Permissions
-- All available permissions for platform operators

create table if not exists platform_permissions (
  id               uuid          primary key default gen_random_uuid(),
  key              text          not null unique, -- e.g. "platform.tenants:read"
  resource         text          not null,
  action           text          not null,
  name             text          not null,
  description      text,
  is_system        boolean       not null default true, -- cannot be deleted if true
  scope            text          not null default 'platform', -- "platform" | "tenant"
  version          integer       not null default 1,
  metadata         jsonb         not null default '{}',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz
);

create unique index platform_permissions_unique_resource_action 
  on platform_permissions (resource, action) 
  where deleted_at is null;

-- No RLS on platform_permissions - only accessible via service role

create index platform_permissions_resource_idx on platform_permissions (resource);
create index platform_permissions_action_idx on platform_permissions (action);
create index platform_permissions_scope_idx on platform_permissions (scope);
