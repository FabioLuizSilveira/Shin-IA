-- M013: contracts — commercial agreements between tenant and organizations
-- Money VO: value_amount + value_currency (no DEFAULT 'BRL' — Decision #9)
-- DateRange VO: period_starts_at + period_ends_at

create table contracts (
  id                uuid            primary key,
  tenant_id         uuid            not null,
  organization_id   uuid            not null,
  type              contract_type   not null,
  status            contract_status not null default 'draft',
  value_amount      numeric(19, 4)  not null,
  value_currency    text            not null,
  period_starts_at  timestamptz     not null,
  period_ends_at    timestamptz     not null,
  version           integer         not null default 1,
  metadata          jsonb           not null default '{}',
  created_at        timestamptz     not null default now(),
  updated_at        timestamptz     not null default now(),
  deleted_at        timestamptz,

  constraint contracts_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,
  constraint contracts_organization_fk
    foreign key (organization_id) references organizations (id) on delete restrict,

  constraint contracts_value_positive
    check (value_amount >= 0),
  constraint contracts_period_range
    check (period_starts_at < period_ends_at)
);

create index contracts_tenant_id_idx on contracts (tenant_id);
create index contracts_organization_id_idx on contracts (organization_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table contracts enable row level security;
alter table contracts force row level security;

create policy "contracts_select"
  on contracts for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "contracts_insert"
  on contracts for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "contracts_update"
  on contracts for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
