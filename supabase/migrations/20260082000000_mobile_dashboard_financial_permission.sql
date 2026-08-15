-- Wave 2 Phase A — gates financial figures on the mobile dashboard behind a
-- real permission, not just "is tenant_owner/tenant_admin" (those two still
-- pass automatically via hasTenantPermission's existing short-circuit — this
-- lets a tenant delegate financial visibility to another role without
-- granting full admin).
insert into tenant_permissions (key, resource, action, name, is_system)
select 'tenant.dashboard.financial', 'dashboard', 'financial', 'Ver dados financeiros no dashboard', true
where not exists (
  select 1 from tenant_permissions where key = 'tenant.dashboard.financial' and deleted_at is null
);
