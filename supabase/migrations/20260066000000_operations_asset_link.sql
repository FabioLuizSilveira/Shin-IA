-- Operations were only linkable to a generic `resources` row (human/vehicle/
-- equipment/virtual, used for GPS-tracked fleet scheduling). For a car
-- rental tenant, the thing an operation actually happens to is usually a
-- specific car in `assets` (the owned inventory), not a scheduling resource
-- — those are two separate, unrelated tables in this schema. This adds a
-- direct, optional link to `assets` alongside the existing one to
-- `resources`, and requires at least one of the two to be set.

alter table operations add column if not exists asset_id uuid;

alter table operations
  add constraint operations_asset_fk
  foreign key (asset_id) references assets (id) on delete restrict;

alter table operations alter column resource_id drop not null;

alter table operations
  add constraint operations_resource_or_asset
  check (resource_id is not null or asset_id is not null);

create index if not exists operations_asset_id_idx on operations (asset_id);

-- Same double-booking guard as resource_id (see 20260063000000), mirrored
-- for asset_id — a nullable column in a GiST exclusion constraint never
-- self-conflicts on NULL vs NULL, so this only ever blocks two overlapping
-- operations against the *same* asset, exactly like the resource one does.
create extension if not exists "btree_gist" with schema extensions;

alter table operations
  add constraint operations_no_asset_overlap
  exclude using gist (
    asset_id with =,
    tstzrange(scheduled_starts_at, scheduled_ends_at) with &&
  )
  where (status in ('pending', 'in_progress') and deleted_at is null);
