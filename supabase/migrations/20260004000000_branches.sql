-- M004: branches — tenant organisational tree (adjacency list)
-- Decision #8: adjacency list with parent_id self-ref; NULL = root branch
-- parent_id ON DELETE SET NULL orphans subtrees to root on parent removal

create table branches (
  id         uuid               primary key,
  tenant_id  uuid               not null,
  parent_id  uuid,
  name       text               not null,
  code       text               not null,
  active     boolean            not null default true,
  scope_mode branch_scope_mode  not null default 'branch',
  version    integer            not null default 1,
  metadata   jsonb              not null default '{}',
  created_at timestamptz        not null default now(),
  updated_at timestamptz        not null default now(),
  deleted_at timestamptz,

  constraint branches_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,
  constraint branches_parent_fk
    foreign key (parent_id) references branches (id) on delete set null
);

create unique index branches_tenant_code_key on branches (tenant_id, code);
create index branches_tenant_id_idx on branches (tenant_id);
create index branches_parent_id_idx on branches (parent_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table branches enable row level security;
alter table branches force row level security;

create policy "branches_select"
  on branches for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "branches_insert"
  on branches for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "branches_update"
  on branches for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
