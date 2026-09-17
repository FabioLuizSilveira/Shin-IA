-- Agent Runtime v3, Wave 2 ("Workflow Orchestration") -- validated
-- against Towing and Passenger Transport per explicit user decision:
-- these two domains already have real, complete domain services
-- (apps/web/src/lib/transport/towing-service.ts, trip-service.ts —
-- real conflict-checked createTowingServiceRequest()/createTrip(),
-- confirmed via a real audit to have ZERO existing callers anywhere in
-- the app yet, and zero tenant_permissions rows for creating them).
-- Rental is deliberately excluded from this wave (Wave 2.5 territory).

-- New create-permissions for the two mutation tools this wave adds —
-- neither existed in the real catalog (confirmed by querying it
-- directly before writing this, same lesson as Wave 5 v2's
-- tenant.assets.view gap: a tool declaring a permission that was never
-- seeded makes it structurally unreachable for every user, admin
-- included). tenant.trips.share already exists (tracking-shares
-- route) — these are the missing CREATE-side keys.
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.trips.create', 'trips', 'create', 'Criar viagens de transporte de passageiros'),
    ('tenant.towing.create', 'towing', 'create', 'Criar solicitações de guincho')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key in ('tenant.trips.create', 'tenant.towing.create')
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );

-- agent_goals gets a `state` column (Wave 1 created the table with no
-- slot-filling storage yet, since Wave 1's own scope was entity context
-- only). This is the ACCUMULATED known-fields state across turns for a
-- goal (spec sections 12-14: slot filling, "never ask twice" applied to
-- workflow requirements, not just entities) -- e.g.
-- {"passengerCount": 46, "scheduledStartsAt": "2026-09-18T10:00:00Z"}.
-- Never business rules, never a second copy of domain data once the
-- real mutation executes -- purely the in-progress slot values before
-- the real domain service is called.
alter table agent_goals add column if not exists state jsonb not null default '{}'::jsonb;

-- Lets the confirm route mark a goal COMPLETED the moment its mutation
-- actually succeeds (spec section 15: NextBestAction=EXECUTE -> the
-- proposed plan IS the goal's completion step once confirmed). Nullable
-- and additive, same posture as conversation_id in the Wave 1 migration.
alter table agent_action_plans add column if not exists goal_id uuid
  references agent_goals(id) on delete set null;

