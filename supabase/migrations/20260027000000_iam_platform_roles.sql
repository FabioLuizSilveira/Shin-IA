-- Platform IAM Roles
-- System roles for platform operators (super_admin, admin, support, etc.)

create table if not exists platform_roles (
  id               uuid          primary key default gen_random_uuid(),
  key              text          not null unique, -- e.g. "platform_owner", "platform_admin"
  name             text          not null,
  description      text,
  is_system        boolean       not null default true, -- cannot be deleted if true
  version          integer       not null default 1,
  metadata         jsonb         not null default '{}',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz
);

-- No RLS on platform_roles - only accessible via service role
-- Platform users authenticated via platform auth (separate from tenant auth)

create index platform_roles_key_idx on platform_roles (key);
create index platform_roles_is_system_idx on platform_roles (is_system);
