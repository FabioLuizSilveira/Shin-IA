-- M007: asset_types — classification templates for assets within a tenant

create table asset_types (
  id         uuid           primary key,
  tenant_id  uuid           not null,
  name       text           not null,
  category   asset_category not null,
  attributes jsonb          not null default '{}',
  active     boolean        not null default true,
  version    integer        not null default 1,
  metadata   jsonb          not null default '{}',
  created_at timestamptz    not null default now(),
  updated_at timestamptz    not null default now(),
  deleted_at timestamptz,

  constraint asset_types_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict
);

create index asset_types_tenant_id_idx on asset_types (tenant_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table asset_types enable row level security;
alter table asset_types force row level security;

create policy "asset_types_select"
  on asset_types for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "asset_types_insert"
  on asset_types for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "asset_types_update"
  on asset_types for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
