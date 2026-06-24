-- Platform IAM User Roles
-- Assigns platform roles to platform users

create table if not exists platform_user_roles (
  id               uuid          primary key default gen_random_uuid(),
  user_id          uuid          not null, -- platform user from Supabase Auth or external system
  role_id          uuid          not null,
  granted_by       uuid,         -- who granted this role (platform_user_id)
  granted_at       timestamptz   not null default now(),
  expires_at       timestamptz,  -- optional: roles can expire
  version          integer       not null default 1,
  metadata         jsonb         not null default '{}',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz,

  constraint platform_user_roles_role_fk
    foreign key (role_id) references platform_roles (id) on delete cascade,

  constraint platform_user_roles_unique_active
    unique (user_id, role_id) where deleted_at is null and expires_at is null
);

-- No RLS on platform_user_roles

create index platform_user_roles_user_id_idx on platform_user_roles (user_id);
create index platform_user_roles_role_id_idx on platform_user_roles (role_id);
create index platform_user_roles_expires_at_idx on platform_user_roles (expires_at);
