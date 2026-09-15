-- WAVE 3 — Multi-Operation Business Architecture v2: Operation Runtime.
--
-- REUSE > EXTEND > CREATE, confirmed by re-reading the real schema before
-- writing this migration:
--
--   Trip            -> REUSE `operations` (already: resource_id [driver] +
--                       asset_id [vehicle] on ONE row, scheduled_starts_at/
--                       ends_at, status lifecycle, GiST exclusion
--                       constraints blocking double-booking on BOTH
--                       resource_id and asset_id independently — see
--                       20260063000000/20260066000000). Just needs a new
--                       operation_type value; no new table, no second
--                       status lifecycle (spec section 18 explicitly warns
--                       against that).
--   Vehicle/Driver
--   Allocation      -> REUSE `allocations` (already live: resource_id +
--                       asset_id + period, used today by
--                       infraction-temporal-resolver.ts). Not touched here
--                       — Trip creation uses `operations` directly, the same
--                       way an existing delivery/pickup operation does.
--   Maintenance
--   conflicts       -> REUSE `resource-availability.ts`'s findAssetConflicts/
--                       findResourceConflicts as-is — a maintenance-type
--                       `operations` row already blocks any overlapping
--                       trip on the same asset/resource, no new code needed.
--   Driver as a
--   resource        -> EXTEND `resource_type` enum (+'driver'); resources.
--                       metadata (already jsonb) carries capability info
--                       (e.g. licenseCategory, canOperateFleetTypes) — no
--                       new capability table (confirmed none exists live).
--   Vehicle capacity -> EXTEND: assets.metadata (already jsonb) carries
--                       e.g. seatCapacity — no schema change needed.
--   Route, Recurring
--   Service Plan    -> CREATE — genuinely don't exist anywhere (confirmed,
--                       Wave 1's audit).

alter type operation_type add value if not exists 'passenger_trip';
alter type resource_type add value if not exists 'driver';

-- ── routes ────────────────────────────────────────────────────────────────
-- A reusable origin/destination(+stops) definition (spec section 17) —
-- deliberately NOT the tracking/GPS history table (tracking-engine's
-- GeofenceEngine owns that; a route is a plan, not a trace).
create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  operation_profile_id uuid references operation_profiles (id),
  name text,
  origin jsonb not null,
  destination jsonb not null,
  stops jsonb not null default '[]'::jsonb,
  estimated_distance_km numeric,
  estimated_duration_minutes integer,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routes_tenant_idx on routes (tenant_id);

alter table routes enable row level security;
alter table routes force row level security;
create policy "routes_select" on routes for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "routes_insert" on routes for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "routes_update" on routes for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── recurring_service_plans ──────────────────────────────────────────────
-- Corporate/recurring fretamento (spec section 16): TransportContract ->
-- RecurringServicePlan -> Route -> Schedule -> Trip Instances. `schedule`
-- is a small jsonb array ({dayOfWeek, departureTime, estimatedArrivalTime?})
-- rather than a new table — it's a handful of rows per plan, not a
-- queried-independently aggregate. Trip instances are GENERATED into
-- `operations` on demand for a bounded horizon (application code), never
-- pre-created for the whole plan lifetime — avoids exploding the
-- operations table with rows nobody asked for yet.
create table if not exists recurring_service_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  operation_profile_id uuid references operation_profiles (id),
  route_id uuid references routes (id),
  customer_organization_id uuid references organizations (id),
  schedule jsonb not null default '[]'::jsonb,
  starts_on date not null,
  ends_on date,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recurring_service_plans_date_range
    check (ends_on is null or ends_on >= starts_on)
);
create index if not exists recurring_service_plans_tenant_idx
  on recurring_service_plans (tenant_id);

alter table recurring_service_plans enable row level security;
alter table recurring_service_plans force row level security;
create policy "recurring_service_plans_select" on recurring_service_plans for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "recurring_service_plans_insert" on recurring_service_plans for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "recurring_service_plans_update" on recurring_service_plans for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
