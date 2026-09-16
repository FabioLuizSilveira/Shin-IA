-- New real permission key for the Shinã Agent's create_organization
-- mutation tool. The live route underneath (POST /api/organizations)
-- enforces no hasTenantPermission() check today (confirmed by reading the
-- route directly) -- the agent path still requires one anyway, same
-- permission-scoped invariant established since Wave 4 and applied again
-- for create_asset in the Wave 6 migration this mirrors.

insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.customers.create', 'customers', 'create', 'Criar clientes/organizações')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key = 'tenant.customers.create'
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );
