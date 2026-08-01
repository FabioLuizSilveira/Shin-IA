-- Geofences — salvage of packages/tracking-engine's GeofenceEngine (kept;
-- its 8 GPS-provider adapters and device-provisioning runtime were archived
-- as speculative — no tenant has asked for a named provider integration,
-- and the generic bring-your-own-webhook already covers today's need).
-- Geofencing itself is provider-agnostic (pure lat/lng math) and adds real
-- value to the existing webhook with no new architecture required.

create type geofence_shape as enum ('circle', 'polygon');
create type geofence_status as enum ('active', 'inactive');

create table if not exists geofences (
  id                  uuid            primary key default gen_random_uuid(),
  tenant_id           uuid            not null,
  name                text            not null,
  description         text,
  shape               geofence_shape  not null,
  center_lat          numeric(9, 6),
  center_lng          numeric(9, 6),
  radius_meters       numeric(10, 2),
  polygon_coordinates jsonb,
  resource_ids        uuid[]          not null default '{}',
  status              geofence_status not null default 'active',
  created_at          timestamptz     not null default now(),
  updated_at          timestamptz     not null default now(),

  constraint geofences_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,

  constraint geofences_circle_fields
    check (
      (shape = 'circle' and center_lat is not null and center_lng is not null and radius_meters is not null)
      or (shape = 'polygon' and polygon_coordinates is not null)
    )
);

create index geofences_tenant_id_idx on geofences (tenant_id);
create index geofences_resource_ids_idx on geofences using gin (resource_ids);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Same posture as tenant_activity_log/commission_*: select-only for tenant
-- staff, writes go through the service-role admin client (requireTenantScope).
alter table geofences enable row level security;
alter table geofences force row level security;

create policy "geofences_select"
  on geofences for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
