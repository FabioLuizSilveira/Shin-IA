-- 20260098000000_inspection_engine.sql only granted the new
-- tenant.inspections.* permissions to tenant_owner/tenant_admin. Found
-- live: fleet_manager (which already holds operations:write — the
-- colon-scheme permission operations/[id]/route.ts checks) got a real
-- "Forbidden" trying to create an inspection through the Tenant Web UI,
-- since inspections are exactly the kind of day-to-day fleet action that
-- role already does for operations. operations_manager is the same
-- shape of gap. manage_templates stays owner/admin-only (mirrors
-- tenant.contract_templates.* being owner/admin-only) — day-to-day roles
-- fill out and review inspections, they don't redesign the checklist.

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('fleet_manager', 'operations_manager')
  and tp.key in (
    'tenant.inspections.view',
    'tenant.inspections.create',
    'tenant.inspections.update',
    'tenant.inspections.complete',
    'tenant.inspections.approve',
    'tenant.inspections.review_damage'
  )
on conflict do nothing;
