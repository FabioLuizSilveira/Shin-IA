-- M011: operations — scheduled work units assigned to resources
-- DateRange VO maps to scheduled_starts_at / scheduled_ends_at columns

create table operations (
  id                   uuid             primary key,
  tenant_id            uuid             not null,
  branch_id            uuid             not null,
  resource_id          uuid             not null,
  type                 operation_type   not null,
  status               operation_status not null default 'pending',
  scheduled_starts_at  timestamptz      not null,
  scheduled_ends_at    timestamptz      not null,
  started_at           timestamptz,
  completed_at         timestamptz,
  version              integer          not null default 1,
  metadata             jsonb            not null default '{}',
  created_at           timestamptz      not null default now(),
  updated_at           timestamptz      not null default now(),
  deleted_at           timestamptz,

  constraint operations_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,
  constraint operations_branch_fk
    foreign key (branch_id) references branches (id) on delete restrict,
  constraint operations_resource_fk
    foreign key (resource_id) references resources (id) on delete restrict,

  constraint operations_schedule_range
    check (scheduled_starts_at < scheduled_ends_at)
);

create index operations_tenant_id_idx on operations (tenant_id);
create index operations_tenant_status_idx on operations (tenant_id, status);
create index operations_resource_schedule_idx
  on operations (resource_id, scheduled_starts_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table operations enable row level security;
alter table operations force row level security;

create policy "operations_select"
  on operations for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "operations_insert"
  on operations for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "operations_update"
  on operations for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
