-- Wave 4 of the Shinã Agent Platform adds read-only tools over customers
-- (organizations), tracking (resource_locations), and reporting
-- (tenant-reports pipeline) -- none of which have a live route enforcing a
-- ".view"-style permission today (confirmed by a real grep audit: GET
-- routes for these three domains only call requireTenantScope(), no
-- hasTenantPermission()). Per the agent platform's own permission-scoped
-- invariant (a tool must check a REAL tenant_permissions catalog key, not
-- an invented string nothing can ever grant to a custom role), this seeds
-- three new keys following the exact pattern of the maintenance/inspection
-- migrations before it: catalog row + auto-grant to tenant_owner/tenant_admin
-- (custom roles get them later via tenant/studio, same as any other
-- permission -- nothing here changes what a live UI route enforces).
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.customers.view', 'customers', 'view', 'Ver clientes'),
    ('tenant.tracking.view', 'tracking', 'view', 'Ver rastreamento de frota'),
    ('tenant.reports.view', 'reports', 'view', 'Ver relatórios')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key in ('tenant.customers.view', 'tenant.tracking.view', 'tenant.reports.view')
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );
