-- WAVE 1 — Multi-Operation Business Architecture v2: domain layer.
--
-- Audited first (REUSE > EXTEND > CREATE): business_profiles already has
-- primary_vertical/additional_verticals[], versioning and confirm/supersede
-- semantics — this migration EXTENDS it (one additive nullable column) and
-- CREATEs the one genuinely new concept, operation_profiles, since neither
-- towing nor passenger transport has any prior implementation in this repo
-- (confirmed via full-repo grep before writing this migration).
--
-- Naming: deliberately NOT called "operations" — that table already exists
-- and means something unrelated (a scheduled task/booking event: delivery,
-- pickup, maintenance, inspection, transfer, tied to one resource/asset and
-- one time window — see 20260011000000_operations.sql). operation_profiles
-- is a business LINE a tenant runs (vehicle rental, towing, passenger
-- transport, ...), not a task instance. Conflating the two names would be a
-- permanent source of confusion in every future PR touching either table.

create table if not exists operation_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  business_profile_id uuid references business_profiles (id),

  type text not null check (type in (
    'vehicle_rental', 'motorcycle_rental',
    'towing_service',
    'passenger_transport',
    'equipment_rental', 'forklift_operation', 'aerial_platform_operation',
    'munk_operation', 'crane_operation', 'agricultural_equipment',
    'other'
  )),
  role text not null default 'secondary' check (role in ('primary', 'secondary')),

  asset_types text[] not null default '{}',
  asset_quantity integer,
  projected_asset_quantity integer,

  -- Discriminated by a "kind" field mirroring `type` (validated at the
  -- application layer, packages/commercial-platform/src/operation-profile.ts)
  -- rather than a Postgres CHECK, so new operation-type schemas don't
  -- require a migration to add. Versioned via each shape's own `version`
  -- field, matching plan_versions/blueprint_resolver_rules' convention.
  characteristics jsonb not null default '{"kind":"generic","version":1}'::jsonb,

  operational_capabilities text[] not null default '{}',
  branch_ids uuid[],

  status text not null default 'active'
    check (status in ('active', 'suspended', 'deactivated')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operation_profiles_tenant_idx on operation_profiles (tenant_id);
create index if not exists operation_profiles_business_profile_idx
  on operation_profiles (business_profile_id) where business_profile_id is not null;

-- At most one active PRIMARY operation profile per tenant at a time —
-- mirrors business_profiles_one_confirmed's pattern (enforced in code too).
create unique index if not exists operation_profiles_one_primary
  on operation_profiles (tenant_id) where role = 'primary' and status = 'active';

alter table operation_profiles enable row level security;
alter table operation_profiles force row level security;
create policy "operation_profiles_select" on operation_profiles for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- business_profiles v2: additive pointer to the tenant's current primary
-- operation profile. Legacy primary_vertical/additional_verticals[] are
-- left completely untouched — they remain the live source for the existing
-- discovery/blueprint-resolver flow (packages/commercial-platform/src/
-- discovery.ts, blueprint-resolver.ts). No destructive migration, no forced
-- backfill: a profile confirmed before this migration simply has
-- primary_operation_id = null until a caller sets one.
alter table business_profiles
  add column if not exists primary_operation_id uuid references operation_profiles (id);
