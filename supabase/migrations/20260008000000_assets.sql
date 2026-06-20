-- M008: assets — physical and virtual assets assigned to branches

create table assets (
  id              uuid           primary key,
  tenant_id       uuid           not null,
  branch_id       uuid           not null,
  asset_type_id   uuid           not null,
  name            text           not null,
  serial_number   text,
  category        asset_category not null,
  status          asset_status   not null default 'available',
  version         integer        not null default 1,
  metadata        jsonb          not null default '{}',
  created_at      timestamptz    not null default now(),
  updated_at      timestamptz    not null default now(),
  deleted_at      timestamptz,

  constraint assets_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,
  constraint assets_branch_fk
    foreign key (branch_id) references branches (id) on delete restrict,
  constraint assets_asset_type_fk
    foreign key (asset_type_id) references asset_types (id) on delete restrict
);

create unique index assets_tenant_serial_key
  on assets (tenant_id, serial_number) where serial_number is not null;
create index assets_tenant_id_idx on assets (tenant_id);
create index assets_branch_id_idx on assets (branch_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table assets enable row level security;
alter table assets force row level security;

create policy "assets_select"
  on assets for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "assets_insert"
  on assets for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "assets_update"
  on assets for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
