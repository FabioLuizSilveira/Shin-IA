-- Fleet tracking — tenant-owned inbound integration
-- Shinã has no GPS/telemetry provider of its own. Each tenant already uses
-- their own fleet tracking service (Sascar, Onixsat, Positron, etc) — this
-- gives them a webhook endpoint + token to point that service at, instead
-- of Shinã integrating with any specific vendor's API.

create table if not exists fleet_integrations (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        uuid          not null,
  provider_name    text,
  webhook_token    text          not null,
  is_active        boolean       not null default true,
  last_received_at timestamptz,
  version          integer       not null default 1,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at        timestamptz,

  constraint fleet_integrations_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create unique index fleet_integrations_tenant_unique
  on fleet_integrations (tenant_id)
  where deleted_at is null;

create unique index fleet_integrations_token_unique
  on fleet_integrations (webhook_token)
  where deleted_at is null;

alter table fleet_integrations enable row level security;
alter table fleet_integrations force row level security;

create policy "fleet_integrations_select"
  on fleet_integrations for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Append-only position log. Written exclusively by the inbound webhook
-- (service role, no user session) and the resources map read endpoint.
create table if not exists resource_locations (
  id           uuid          primary key default gen_random_uuid(),
  tenant_id    uuid          not null,
  resource_id  uuid          not null,
  latitude     numeric(9, 6) not null,
  longitude    numeric(9, 6) not null,
  recorded_at  timestamptz   not null default now(),
  source       text          not null default 'webhook',
  raw_payload  jsonb         not null default '{}',
  created_at   timestamptz   not null default now(),

  constraint resource_locations_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint resource_locations_resource_fk
    foreign key (resource_id) references resources (id) on delete cascade
);

create index resource_locations_tenant_id_idx on resource_locations (tenant_id);
create index resource_locations_resource_recorded_idx
  on resource_locations (resource_id, recorded_at desc);

alter table resource_locations enable row level security;
alter table resource_locations force row level security;

create policy "resource_locations_select"
  on resource_locations for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
