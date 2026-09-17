-- Agent Runtime v3, Wave 2.5 ("Rental Domain Foundation") -- fixes the
-- real gap Wave 1's audit found: "criar um contrato de locação" has no
-- real backing feature today. `contracts` (type='rental') has no
-- asset/vehicle column at all; the live "new contract" form only
-- collects organization + a MANUALLY TYPED value + a date range -- no
-- vehicle selection, no availability check, no pricing engine.
--
-- Audited first (REUSE > EXTEND > CREATE, per explicit user decision):
--   Reservation/booking -> REUSE `operations` (NOT `allocations` --
--     confirmed by reading migrations that `allocations.resource_id` is
--     NOT NULL, forcing a fake internal "resource" a customer rental
--     has no real one for, AND that `allocations` has ZERO real INSERT
--     callers anywhere in the app, only ever read by
--     infraction-temporal-resolver.ts). `operations` is the exact,
--     already-proven mechanism Wave 2's own createTrip()/
--     createTowingServiceRequest() already use: asset_id + nullable
--     resource_id, a GiST exclusion constraint blocking real overlapping
--     bookings on the SAME asset (20260066000000_operations_asset_link.sql)
--     regardless of operation type -- an existing maintenance operation
--     on an asset already blocks a rental for free, no new code needed.
--     Just needs a new operation_type value, exactly like passenger_trip/
--     towing_service_request before it.
--   Availability -> REUSE resource-availability.ts's findAssetConflicts
--     as-is (already used by get_asset_availability, createTrip,
--     createTowingServiceRequest). asset.status alone (available/
--     in_use/maintenance/decommissioned) is NEVER treated as sufficient
--     (the master prompt's own "ACTIVE ≠ AVAILABLE" warning) --
--     findAssetConflicts checks real overlapping operations regardless
--     of the asset's own status field, matching how get_asset_availability
--     already works today (confirmed by re-reading it, zero status check).
--   Contract -> REUSE `contracts` (M27) for the real, always-functional
--     path, and @shina/tenant-contract-engine (a REAL, tested,
--     already-wired package -- confirmed by reading POST /api/contracts,
--     which calls TenantContractRequirementResolver.resolve() +
--     ContractTemplateEngine.render() + createContractSnapshot() when a
--     blueprint_id is given) for the OPTIONAL dynamic template/snapshot
--     path, exactly mirroring that route's own optionality -- never a
--     parallel contract engine.
--   Pricing -> CREATE (genuinely doesn't exist anywhere for rentals --
--     confirmed: the only "value_amount" today is a human typing a
--     number into a form).

-- New operation type -- same established pattern as
-- 20260925000000_operation_runtime.sql's 'passenger_trip' and
-- 20260929000000_towing_service_requests.sql's 'towing_service_request'.
alter type operation_type add value if not exists 'vehicle_rental';

-- ── rental_rates ─────────────────────────────────────────────────────────
-- Deliberately simple/deterministic (spec section 11: "não construir
-- motor tarifário gigantesco nesta wave") -- one row per rate plan,
-- matched by specificity (asset_id > asset_type_id > asset_category) at
-- calculation time. All cents-denominated integers (no float currency
-- math), matching contracts.value_amount's own numeric(19,4) precision
-- discipline in spirit.
create table if not exists rental_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  asset_id uuid references assets(id) on delete cascade,
  asset_type_id uuid references asset_types(id) on delete cascade,
  asset_category asset_category,
  daily_rate_cents integer,
  hourly_rate_cents integer,
  weekly_rate_cents integer,
  monthly_rate_cents integer,
  currency text not null default 'BRL',
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- At least one real rate must be set — a rate plan with nothing
  -- priced is a data-entry bug, not a valid row.
  constraint rental_rates_has_a_rate check (
    daily_rate_cents is not null or hourly_rate_cents is not null
    or weekly_rate_cents is not null or monthly_rate_cents is not null
  )
);
create index if not exists rental_rates_tenant_idx on rental_rates (tenant_id, status);
create index if not exists rental_rates_asset_idx on rental_rates (asset_id) where asset_id is not null;
create index if not exists rental_rates_asset_type_idx
  on rental_rates (asset_type_id) where asset_type_id is not null;

alter table rental_rates enable row level security;
alter table rental_rates force row level security;
create policy "rental_rates_select" on rental_rates for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "rental_rates_insert" on rental_rates for insert
  to authenticated with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "rental_rates_update" on rental_rates for update
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── rental_pricing_snapshots ─────────────────────────────────────────────
-- Immutable once written (spec section 13: never recompute a historical
-- rental's price against today's rate table) -- application code only
-- ever INSERTs here, never UPDATEs. manual_override/override_reason/
-- authorized_by (spec section 14) make the existing "type a number by
-- hand" behavior an explicit, audited, permissioned exception instead of
-- silently dropping it.
create table if not exists rental_pricing_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  rate_id uuid references rental_rates(id) on delete set null,
  asset_id uuid not null references assets(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'BRL',
  manual_override boolean not null default false,
  override_reason text,
  authorized_by uuid,
  calculated_at timestamptz not null default now(),

  constraint rental_pricing_snapshots_period check (starts_at < ends_at),
  constraint rental_pricing_snapshots_override_reason check (
    not manual_override or override_reason is not null
  )
);
create index if not exists rental_pricing_snapshots_tenant_idx
  on rental_pricing_snapshots (tenant_id);
create index if not exists rental_pricing_snapshots_asset_idx
  on rental_pricing_snapshots (asset_id);

alter table rental_pricing_snapshots enable row level security;
alter table rental_pricing_snapshots force row level security;
create policy "rental_pricing_snapshots_select" on rental_pricing_snapshots for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "rental_pricing_snapshots_insert" on rental_pricing_snapshots for insert
  to authenticated with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── IAM ──────────────────────────────────────────────────────────────────
-- tenant.rentals.create: proposing/creating a rental (the operations row
-- + pricing snapshot). tenant.rentals.override_price: the manual-
-- override path specifically (spec section 14 — a narrower, separately
-- grantable permission, not bundled into plain create).
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.rentals.create', 'rentals', 'create', 'Criar locações'),
    ('tenant.rentals.override_price', 'rentals', 'override_price', 'Sobrescrever preço de locação manualmente')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key in ('tenant.rentals.create', 'tenant.rentals.override_price')
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );
