-- Tenant IAM Role-Permission Junction
-- Maps permissions to roles within a tenant

create table if not exists tenant_role_permissions (
  role_id          uuid          not null,
  permission_id    uuid          not null,
  created_at       timestamptz   not null default now(),

  constraint tenant_role_permissions_role_fk
    foreign key (role_id) references tenant_roles (id) on delete cascade,

  constraint tenant_role_permissions_permission_fk
    foreign key (permission_id) references tenant_permissions (id) on delete cascade,

  primary key (role_id, permission_id)
);

-- No RLS needed - users access via tenant_roles which has RLS

create index tenant_role_permissions_permission_id_idx on tenant_role_permissions (permission_id);
