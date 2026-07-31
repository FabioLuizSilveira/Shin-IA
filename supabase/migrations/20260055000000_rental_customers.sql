-- Rental customer identity — external customers who rented an asset from a
-- tenant (e.g. rented a car, a forklift), distinct from platform_customers
-- (Shinã's own paying identities, tenant-agnostic by design) and from
-- user_profiles (tenant staff, tenant_id NOT NULL). A rental customer can be
-- linked to organizations across multiple tenants at once, so identity is
-- deliberately NOT embedded in JWT claims — every table here is authorized
-- via RLS keyed on auth.uid(), read directly by the mobile app (no API
-- layer), same posture platform_customers already established.
--
-- Also closes two schema gaps found during audit: no table links a specific
-- asset to the contract/customer that rented it (contract_assets), and
-- customers have no channel to request a problem report or extension
-- (rental_service_requests).

create table if not exists rental_customers (
  id           uuid          primary key default gen_random_uuid(),
  auth_user_id uuid          not null,
  email        text,
  full_name    text,
  phone        text,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);

create unique index rental_customers_auth_user_unique
  on rental_customers (auth_user_id);

-- Links a rental_customer to an organization within a specific tenant.
-- N:N by design — the same person can rent from multiple tenants, or (less
-- commonly) be linked to more than one organization within a tenant.
create table if not exists rental_customer_organizations (
  id                  uuid        primary key default gen_random_uuid(),
  rental_customer_id  uuid        not null,
  tenant_id           uuid        not null,
  organization_id     uuid        not null,
  created_at          timestamptz not null default now(),

  constraint rental_customer_organizations_customer_fk
    foreign key (rental_customer_id) references rental_customers (id) on delete cascade,
  constraint rental_customer_organizations_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint rental_customer_organizations_organization_fk
    foreign key (organization_id) references organizations (id) on delete cascade
);

create unique index rental_customer_organizations_unique
  on rental_customer_organizations (rental_customer_id, organization_id);
create index rental_customer_organizations_tenant_id_idx
  on rental_customer_organizations (tenant_id);
create index rental_customer_organizations_organization_id_idx
  on rental_customer_organizations (organization_id);

-- Which specific assets a contract covers — contracts.organization_id names
-- the customer, but nothing previously named which physical asset(s) they
-- rented (allocations links assets to internal tenant resources, not this).
create table if not exists contract_assets (
  id          uuid          primary key default gen_random_uuid(),
  tenant_id   uuid          not null,
  contract_id uuid          not null,
  asset_id    uuid          not null,
  quantity    integer       not null default 1,
  notes       text,
  created_at  timestamptz   not null default now(),

  constraint contract_assets_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint contract_assets_contract_fk
    foreign key (contract_id) references contracts (id) on delete cascade,
  constraint contract_assets_asset_fk
    foreign key (asset_id) references assets (id) on delete restrict,
  constraint contract_assets_quantity_positive
    check (quantity > 0)
);

create unique index contract_assets_contract_asset_unique
  on contract_assets (contract_id, asset_id);
create index contract_assets_tenant_id_idx on contract_assets (tenant_id);
create index contract_assets_contract_id_idx on contract_assets (contract_id);
create index contract_assets_asset_id_idx on contract_assets (asset_id);

create type rental_service_request_type as enum ('extension', 'issue');
create type rental_service_request_status as enum (
  'pending', 'approved', 'rejected', 'resolved'
);

create table if not exists rental_service_requests (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           uuid        not null,
  contract_id         uuid        not null,
  rental_customer_id  uuid        not null,
  type                rental_service_request_type not null,
  message             text        not null,
  status              rental_service_request_status not null default 'pending',
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  review_notes        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint rental_service_requests_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint rental_service_requests_contract_fk
    foreign key (contract_id) references contracts (id) on delete cascade,
  constraint rental_service_requests_customer_fk
    foreign key (rental_customer_id) references rental_customers (id) on delete cascade
);

create index rental_service_requests_tenant_id_idx on rental_service_requests (tenant_id);
create index rental_service_requests_contract_id_idx on rental_service_requests (contract_id);
create index rental_service_requests_customer_id_idx on rental_service_requests (rental_customer_id);
create index rental_service_requests_status_idx on rental_service_requests (status);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Unlike commission_*/impersonation_sessions (service-role-write, tenant
-- staff read-only via requireTenantScope's admin client), these tables are
-- read AND written directly by end-customer sessions through the mobile
-- app — so policies here are the real authorization boundary, not
-- defense-in-depth.

alter table rental_customers enable row level security;
alter table rental_customers force row level security;

create policy "rental_customers_select_own"
  on rental_customers for select
  to authenticated
  using (auth_user_id = auth.uid());

alter table rental_customer_organizations enable row level security;
alter table rental_customer_organizations force row level security;

create policy "rental_customer_organizations_select_own"
  on rental_customer_organizations for select
  to authenticated
  using (
    rental_customer_id in (select id from rental_customers where auth_user_id = auth.uid())
    or tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Additional read access on contracts/assets for a linked rental customer —
-- appended alongside the existing tenant-staff policies (20260013000000,
-- 20260008000000); Postgres OR's same-command policies together, so tenant
-- staff access is unaffected.

create policy "contracts_select_rental_customer"
  on contracts for select
  to authenticated
  using (
    organization_id in (
      select rco.organization_id
      from rental_customer_organizations rco
      join rental_customers rc on rc.id = rco.rental_customer_id
      where rc.auth_user_id = auth.uid()
    )
  );

alter table contract_assets enable row level security;
alter table contract_assets force row level security;

create policy "contract_assets_select_tenant"
  on contract_assets for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "contract_assets_select_rental_customer"
  on contract_assets for select
  to authenticated
  using (
    contract_id in (
      select c.id
      from contracts c
      join rental_customer_organizations rco on rco.organization_id = c.organization_id
      join rental_customers rc on rc.id = rco.rental_customer_id
      where rc.auth_user_id = auth.uid()
    )
  );

create policy "assets_select_rental_customer"
  on assets for select
  to authenticated
  using (
    id in (
      select ca.asset_id
      from contract_assets ca
      join contracts c on c.id = ca.contract_id
      join rental_customer_organizations rco on rco.organization_id = c.organization_id
      join rental_customers rc on rc.id = rco.rental_customer_id
      where rc.auth_user_id = auth.uid()
    )
  );

alter table rental_service_requests enable row level security;
alter table rental_service_requests force row level security;

create policy "rental_service_requests_select"
  on rental_service_requests for select
  to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    or rental_customer_id in (select id from rental_customers where auth_user_id = auth.uid())
  );

create policy "rental_service_requests_insert_own"
  on rental_service_requests for insert
  to authenticated
  with check (
    rental_customer_id in (select id from rental_customers where auth_user_id = auth.uid())
    and contract_id in (
      select c.id
      from contracts c
      join rental_customer_organizations rco on rco.organization_id = c.organization_id
      join rental_customers rc on rc.id = rco.rental_customer_id
      where rc.auth_user_id = auth.uid()
    )
  );

create policy "rental_service_requests_update_tenant"
  on rental_service_requests for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
