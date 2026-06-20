-- M012: allocations — time-bound assignment of an asset to a resource
-- DateRange VO maps to period_starts_at / period_ends_at

create table allocations (
  id                uuid              primary key,
  tenant_id         uuid              not null,
  resource_id       uuid              not null,
  asset_id          uuid              not null,
  period_starts_at  timestamptz       not null,
  period_ends_at    timestamptz       not null,
  status            allocation_status not null default 'reserved',
  version           integer           not null default 1,
  metadata          jsonb             not null default '{}',
  created_at        timestamptz       not null default now(),
  updated_at        timestamptz       not null default now(),
  deleted_at        timestamptz,

  constraint allocations_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,
  constraint allocations_resource_fk
    foreign key (resource_id) references resources (id) on delete restrict,
  constraint allocations_asset_fk
    foreign key (asset_id) references assets (id) on delete restrict,

  constraint allocations_period_range
    check (period_starts_at < period_ends_at)
);

create index allocations_tenant_id_idx on allocations (tenant_id);
create index allocations_resource_period_idx
  on allocations (resource_id, period_starts_at, period_ends_at);
create index allocations_asset_period_idx
  on allocations (asset_id, period_starts_at, period_ends_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table allocations enable row level security;
alter table allocations force row level security;

create policy "allocations_select"
  on allocations for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "allocations_insert"
  on allocations for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "allocations_update"
  on allocations for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
