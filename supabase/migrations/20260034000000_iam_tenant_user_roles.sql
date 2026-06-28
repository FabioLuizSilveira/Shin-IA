-- Tenant IAM User Roles
-- Assigns tenant roles to users within a tenant
-- Also stores branch scope information

create table if not exists tenant_user_roles (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        uuid          not null,
  user_id          uuid          not null, -- references user_profiles.id
  role_id          uuid          not null,

  -- Branch scope configuration
  branch_scope_mode text,        -- "root" | "branch_and_children" | "branch" | "custom"
  branch_id        uuid,         -- primary branch if scope is branch-specific

  -- Role lifecycle
  granted_by       uuid,         -- user_id of person who granted this role
  granted_at       timestamptz   not null default now(),
  expires_at       timestamptz,  -- optional: roles can expire

  version          integer       not null default 1,
  metadata         jsonb         not null default '{}',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz,

  constraint tenant_user_roles_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,

  constraint tenant_user_roles_user_fk
    foreign key (user_id) references user_profiles (id) on delete cascade,

  constraint tenant_user_roles_role_fk
    foreign key (role_id) references tenant_roles (id) on delete cascade
);

create unique index tenant_user_roles_unique_active 
  on tenant_user_roles (tenant_id, user_id, role_id) 
  where deleted_at is null and expires_at is null;

-- RLS: Users can read their own roles, admins can read/manage all
alter table tenant_user_roles enable row level security;
alter table tenant_user_roles force row level security;

create policy "tenant_user_roles_select_own"
  on tenant_user_roles for select
  to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      user_id = (select id from user_profiles where auth_user_id = auth.uid() and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
      or exists (
        select 1 from tenant_user_roles tur2
        where tur2.tenant_id = tenant_user_roles.tenant_id
        and tur2.user_id = (select id from user_profiles where auth_user_id = auth.uid() and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
        and tur2.deleted_at is null
      )
    )
  );

create policy "tenant_user_roles_insert_admin"
  on tenant_user_roles for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_user_roles_update_admin"
  on tenant_user_roles for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create index tenant_user_roles_tenant_id_idx on tenant_user_roles (tenant_id);
create index tenant_user_roles_user_id_idx on tenant_user_roles (user_id);
create index tenant_user_roles_role_id_idx on tenant_user_roles (role_id);
create index tenant_user_roles_expires_at_idx on tenant_user_roles (expires_at);
