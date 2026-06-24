-- M005: persons — people within a tenant
-- Decision #7: auth_user_id is nullable and unique; not all persons are Auth users
-- The Supabase Auth Hook reads auth_user_id to resolve tenant_id at sign-in
-- ON DELETE SET NULL on auth_user_id preserves the person record when Auth user is removed

create table persons (
  id                   uuid          primary key,
  tenant_id            uuid          not null,
  auth_user_id         uuid,
  first_name           text          not null,
  last_name            text          not null,
  email                text          not null,
  phone                text,
  phone_country_code   text,
  document             text,
  status               person_status not null default 'active',
  version              integer       not null default 1,
  metadata             jsonb         not null default '{}',
  created_at           timestamptz   not null default now(),
  updated_at           timestamptz   not null default now(),
  deleted_at           timestamptz,

  constraint persons_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,
  constraint persons_auth_user_fk
    foreign key (auth_user_id) references auth.users (id) on delete set null,

  constraint persons_email_format
    check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

create unique index persons_tenant_email_key on persons (tenant_id, email);
create unique index persons_tenant_document_key
  on persons (tenant_id, document) where document is not null;
create unique index persons_auth_user_id_key
  on persons (auth_user_id) where auth_user_id is not null;
create index persons_tenant_id_idx on persons (tenant_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table persons enable row level security;
alter table persons force row level security;

create policy "persons_select"
  on persons for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "persons_insert"
  on persons for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "persons_update"
  on persons for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
