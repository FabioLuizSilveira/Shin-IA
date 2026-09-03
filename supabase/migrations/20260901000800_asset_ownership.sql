-- Asset ownership (sócio/parceiro no ativo, ou administração pra terceiro) —
-- reuses `organizations` (already models external parties for CRM/contracts,
-- and already has a 'partner' type) instead of a free-text owner name, so
-- the owner comes with document/contact/address for free and shows up in
-- the CRM like any other organization.
--
-- Scope decided with the user: one owner per asset (no N-way split table
-- for now — tenant_share_pct covers the two-party case, which is the
-- common one; a future asset_owners join table can replace this without
-- breaking anything if N-way splits are ever needed), and this DOES feed a
-- real financial calculation (asset_owner_settlements below), not just a
-- cosmetic field.
create type asset_ownership_type as enum ('own', 'shared', 'third_party_managed');

alter table assets
  add column ownership_type    asset_ownership_type not null default 'own',
  add column owner_org_id      uuid references organizations (id),
  add column tenant_share_pct  numeric(5, 2) not null default 100.00;

alter table assets add constraint assets_ownership_consistency check (
  (ownership_type = 'own' and owner_org_id is null and tenant_share_pct = 100.00)
  or (
    ownership_type in ('shared', 'third_party_managed')
    and owner_org_id is not null
    and tenant_share_pct >= 0 and tenant_share_pct <= 100
  )
);

create index assets_owner_org_id_idx on assets (owner_org_id) where owner_org_id is not null;

-- One row per (invoice, asset) — created when a contract-linked invoice
-- that references this asset (via contract_assets) is marked paid. Records
-- the split at the moment of payment (gross/tenant_share_pct/tenant_amount/
-- owner_amount) rather than just pointing back to the asset's current
-- ownership_type/tenant_share_pct, which could change later without
-- retroactively rewriting historical settlements.
create table if not exists asset_owner_settlements (
  id                uuid          primary key default gen_random_uuid(),
  tenant_id         uuid          not null,
  asset_id          uuid          not null,
  owner_org_id      uuid          not null,
  contract_id       uuid,
  invoice_id        uuid          not null,
  gross_amount      numeric(14, 2) not null,
  tenant_share_pct  numeric(5, 2) not null,
  tenant_amount     numeric(14, 2) not null,
  owner_amount      numeric(14, 2) not null,
  currency          text          not null default 'BRL',
  created_at        timestamptz   not null default now(),

  constraint asset_owner_settlements_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint asset_owner_settlements_asset_fk
    foreign key (asset_id) references assets (id) on delete cascade,
  constraint asset_owner_settlements_owner_org_fk
    foreign key (owner_org_id) references organizations (id) on delete restrict,
  constraint asset_owner_settlements_contract_fk
    foreign key (contract_id) references contracts (id) on delete set null,
  constraint asset_owner_settlements_invoice_fk
    foreign key (invoice_id) references invoices (id) on delete cascade
);

-- One settlement per (invoice, asset) — reprocessing the same paid invoice
-- (e.g. a webhook retry) must not double-count the owner's share.
create unique index asset_owner_settlements_invoice_asset_unique
  on asset_owner_settlements (invoice_id, asset_id);
create index asset_owner_settlements_tenant_id_idx on asset_owner_settlements (tenant_id);
create index asset_owner_settlements_asset_id_idx on asset_owner_settlements (asset_id);
create index asset_owner_settlements_owner_org_id_idx on asset_owner_settlements (owner_org_id);

-- RLS: defense-in-depth, matching every other tenant-scoped table this
-- session's routes go through requireTenantScope() (admin client + explicit
-- tenant_id filter) for — same pattern as commission_* tables.
alter table asset_owner_settlements enable row level security;
alter table asset_owner_settlements force row level security;
create policy "asset_owner_settlements_select_own_tenant" on asset_owner_settlements
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
