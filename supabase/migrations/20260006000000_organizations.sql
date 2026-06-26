-- M006: organizations — legal entities (customers, suppliers, partners)
-- Decision #4: address as flat columns + metadata JSONB for extensibility

create table organizations (
  id                   uuid              primary key,
  tenant_id            uuid              not null,
  name                 text              not null,
  trade_name           text,
  document             text              not null,
  type                 organization_type not null,
  email                text,
  phone                text,
  phone_country_code   text,
  address_street       text,
  address_number       text,
  address_neighborhood text,
  address_city         text              not null,
  address_state        text              not null,
  address_country      text              not null default 'BR',
  address_postal_code  text,
  active               boolean           not null default true,
  version              integer           not null default 1,
  metadata             jsonb             not null default '{}',
  created_at           timestamptz       not null default now(),
  updated_at           timestamptz       not null default now(),
  deleted_at           timestamptz,

  constraint organizations_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,

  constraint organizations_email_format
    check (email is null or email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

create unique index organizations_tenant_document_key on organizations (tenant_id, document);
create index organizations_tenant_id_idx on organizations (tenant_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table organizations enable row level security;
alter table organizations force row level security;

create policy "organizations_select"
  on organizations for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "organizations_insert"
  on organizations for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "organizations_update"
  on organizations for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
