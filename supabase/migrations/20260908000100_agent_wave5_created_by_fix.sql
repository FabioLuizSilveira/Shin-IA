-- Bug found via a live production test (2026-09-05): tenant_knowledge_
-- documents.created_by was defined with `references user_profiles(id)`,
-- but every caller passes scope.userId (the auth uid from
-- requireTenantScope(), NOT user_profiles.id) -- the exact mismatch
-- documented in apps/web/src/lib/tenant-context.ts's own hasTenantPermission()
-- comment (tenant_user_roles.user_id references user_profiles.id, while
-- scope.userId is the canonical auth uid; they are different values for
-- the same person). The insert failed its FK constraint on every real
-- request. Every other created_by-style column in this schema (e.g.
-- maintenance_orders.created_by, see 20260112000000_maintenance.sql) is a
-- plain `uuid not null` with NO foreign key for exactly this reason --
-- match that convention instead of inventing a new one.
alter table tenant_knowledge_documents
  drop constraint if exists tenant_knowledge_documents_created_by_fkey;
