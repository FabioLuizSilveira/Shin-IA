-- Security fix (CRÍT-01): platform_roles, platform_permissions,
-- platform_role_permissions and platform_user_roles were created with no
-- RLS at all, relying on the comment "only accessible via service role" as
-- the sole protection. But 20260046000000_db_grants.sql grants ALL
-- privileges on every public-schema table to anon/authenticated, so
-- without RLS these tables were fully readable AND writable by anyone
-- holding the public anon key — including INSERT into platform_user_roles,
-- which is a direct self-grant of any platform role (e.g. platform_owner).
--
-- Every route that touches these tables already goes through
-- createAdminClient() (service_role, which always bypasses RLS) after
-- checking requirePlatformRole()/requireTenantScope() in application code
-- (see apps/web/src/lib/platform-guard.ts) — so enabling RLS with no
-- policies for anon/authenticated (deny-by-default) does not change any
-- legitimate app behavior; it only closes the direct-PostgREST path.

alter table platform_roles enable row level security;
alter table platform_roles force row level security;

alter table platform_permissions enable row level security;
alter table platform_permissions force row level security;

alter table platform_role_permissions enable row level security;
alter table platform_role_permissions force row level security;

alter table platform_user_roles enable row level security;
alter table platform_user_roles force row level security;
