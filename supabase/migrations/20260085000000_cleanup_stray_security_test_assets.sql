-- Two leftover cross-tenant IDOR test fixtures ("Verify W2C Asset Mine/Other",
-- category=equipment, empty metadata, created 2026-08-15 during an earlier
-- security-test pass) were polluting the Veloz Rent a Car demo tenant's
-- asset count instead of being cleaned up after that test ran. Soft-deletes
-- them (the assets table already supports deleted_at) rather than hard
-- deleting, in case they're still referenced by that test's own assertions.
update assets
set deleted_at = now()
where tenant_id = '10000000-0000-0000-0000-000000000001'
  and name in ('Verify W2C Asset Mine', 'Verify W2C Asset Other')
  and deleted_at is null;
