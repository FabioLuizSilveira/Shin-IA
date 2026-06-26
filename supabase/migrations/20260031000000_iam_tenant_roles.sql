-- Tenant IAM Roles
-- System and custom roles within a tenant

create table if not exists tenant_roles (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        uuid          not null,
  key              text,         -- NULL for custom roles, non-null for system roles
  name             text          not null,
  description      text,
  is_system        boolean       not null default false, -- cannot be deleted if true
  version          integer       not null default 1,
  metadata         jsonb         not null default '{}',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz,

  constraint tenant_roles_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create unique index tenant_roles_unique_key_per_tenant 
  on tenant_roles (tenant_id, key) 
  where key is not null and deleted_at is null;

create unique index tenant_roles_unique_name_per_tenant 
  on tenant_roles (tenant_id, name) 
  where deleted_at is null;

-- RLS: Users can read roles in their tenant, admins can manage
alter table tenant_roles enable row level security;
alter table tenant_roles force row level security;

create policy "tenant_roles_select"
  on tenant_roles for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_roles_insert_admin"
  on tenant_roles for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_roles_update_admin"
  on tenant_roles for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create index tenant_roles_tenant_id_idx on tenant_roles (tenant_id);
create index tenant_roles_is_system_idx on tenant_roles (is_system);
