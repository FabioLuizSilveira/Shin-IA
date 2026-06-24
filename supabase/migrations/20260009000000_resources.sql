-- M009: resources — operational units (drivers, vehicles, equipment, virtual)
-- person_id is optional; ON DELETE SET NULL allows person removal without breaking resource

create table resources (
  id         uuid            primary key,
  tenant_id  uuid            not null,
  branch_id  uuid            not null,
  person_id  uuid,
  name       text            not null,
  type       resource_type   not null,
  status     resource_status not null default 'available',
  version    integer         not null default 1,
  metadata   jsonb           not null default '{}',
  created_at timestamptz     not null default now(),
  updated_at timestamptz     not null default now(),
  deleted_at timestamptz,

  constraint resources_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,
  constraint resources_branch_fk
    foreign key (branch_id) references branches (id) on delete restrict,
  constraint resources_person_fk
    foreign key (person_id) references persons (id) on delete set null
);

create index resources_tenant_id_idx on resources (tenant_id);
create index resources_branch_id_idx on resources (branch_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table resources enable row level security;
alter table resources force row level security;

create policy "resources_select"
  on resources for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "resources_insert"
  on resources for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "resources_update"
  on resources for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
