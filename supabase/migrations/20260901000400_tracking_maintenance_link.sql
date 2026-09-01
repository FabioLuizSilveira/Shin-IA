-- Tracking -> Maintenance integration (Etapa 10). Research finding that
-- changes what the spec assumed: `resources` (what GPS tracking is keyed
-- to, resource_locations.resource_id) and `assets` (what the whole
-- Maintenance module is keyed to) are genuinely separate entities with no
-- FK between them today -- `operations` references both independently
-- (asset_id/resource_id, either-or), but resources and assets themselves
-- were never linked. This is the bridge, nullable and opt-in: a tenant
-- only gets odometer auto-sync for a resource once they explicitly link
-- it to the fleet asset it represents.
alter table resources add column asset_id uuid references assets (id) on delete set null;

create index resources_asset_id_idx on resources (asset_id) where asset_id is not null;
