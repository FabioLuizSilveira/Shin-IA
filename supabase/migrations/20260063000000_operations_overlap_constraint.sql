-- Security fix (MÉD-10): findResourceConflicts() in
-- apps/web/src/lib/resource-availability.ts is a plain SELECT the API route
-- checks before a separate INSERT — classic TOCTOU: two concurrent
-- POST /api/operations requests for the same resource_id/time window can
-- both pass the SELECT (neither sees the other's not-yet-committed INSERT)
-- and both succeed, double-booking the resource. This adds a real
-- database-level guard: a GiST exclusion constraint that makes the
-- overlapping INSERT itself fail at the database, independent of any
-- app-level check or race.
--
-- Only pending/in_progress operations block a resource (mirrors
-- BLOCKING_STATUSES in resource-availability.ts) and soft-deleted rows are
-- excluded via a partial constraint.

create extension if not exists "btree_gist" with schema extensions;

alter table operations
  add constraint operations_no_resource_overlap
  exclude using gist (
    resource_id with =,
    tstzrange(scheduled_starts_at, scheduled_ends_at) with &&
  )
  where (status in ('pending', 'in_progress') and deleted_at is null);
