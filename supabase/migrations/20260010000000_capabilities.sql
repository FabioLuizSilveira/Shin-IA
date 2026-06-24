-- M010: capabilities — named skills or permissions assignable to resources/branches

create table capabilities (
  id         uuid             primary key,
  tenant_id  uuid             not null,
  name       text             not null,
  key        text             not null,
  scope      capability_scope not null,
  active     boolean          not null default true,
  version    integer          not null default 1,
  metadata   jsonb            not null default '{}',
  created_at timestamptz      not null default now(),
  updated_at timestamptz      not null default now(),
  deleted_at timestamptz,

  constraint capabilities_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,

  constraint capabilities_key_format
    check (key ~* '^[a-z][a-z0-9._-]*$')
);

create unique index capabilities_tenant_key_key on capabilities (tenant_id, key);
create index capabilities_tenant_id_idx on capabilities (tenant_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table capabilities enable row level security;
alter table capabilities force row level security;

create policy "capabilities_select"
  on capabilities for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "capabilities_insert"
  on capabilities for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "capabilities_update"
  on capabilities for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
