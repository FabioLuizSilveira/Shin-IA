-- Platform IAM Role-Permission Junction
-- Maps permissions to roles

create table if not exists platform_role_permissions (
  role_id          uuid          not null,
  permission_id    uuid          not null,
  created_at       timestamptz   not null default now(),

  constraint platform_role_permissions_role_fk
    foreign key (role_id) references platform_roles (id) on delete cascade,

  constraint platform_role_permissions_permission_fk
    foreign key (permission_id) references platform_permissions (id) on delete cascade,

  primary key (role_id, permission_id)
);

-- No RLS on platform_role_permissions

create index platform_role_permissions_permission_id_idx on platform_role_permissions (permission_id);
