-- Agent Runtime Architecture v2, Wave 5 -- fixes a real, previously
-- undetected bug found while live-verifying this wave's domain
-- annotations: list_assets/get_asset/get_asset_availability
-- (apps/web/src/lib/ai/tools/assets.ts) all declare
-- requiredPermission: "tenant.assets.view", but that key was NEVER
-- seeded into tenant_permissions -- confirmed by querying the real
-- catalog. Since getEffectiveTenantPermissions() grants a tenant_owner/
-- tenant_admin every key that EXISTS in the catalog (not "everything",
-- literally the catalog's own rows), a missing key means even a full
-- admin never has it. This made list_assets structurally unreachable
-- for every user since it was created -- the true root cause of the
-- "quantos ativos eu tenho?" failures live-tested across Waves 2 and 4,
-- unrelated to tool selection, routing, or model choice: the tool was
-- never callable in the first place. get_asset_history
-- (tenant.maintenance.view) and create_asset (tenant.assets.create)
-- were unaffected -- both their keys already existed.
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.assets.view', 'assets', 'view', 'Ver ativos')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key = 'tenant.assets.view'
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );
