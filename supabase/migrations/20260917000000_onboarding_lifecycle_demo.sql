-- WAVE 5 — LIFECYCLE demo data for the Intelligent Tenant Onboarding
-- initiative. Seeds the EXISTING demo tenant (Veloz Rent a Car,
-- 10000000-0000-0000-0000-000000000001) with a confirmed BusinessProfile and
-- a CommercialConfiguration so the whole DISCOVER → RECOMMEND → CONFIGURE →
-- PRICE → CONTRACT → PROVISION → OPERATE → EVOLVE chain is demonstrable
-- end-to-end against fake, clearly-demo data (STOP condition: Demo-real-data
-- — Veloz is a fictional rental company, no real customer records here).
--
-- Idempotent + guarded: only runs if the demo tenant actually exists.

do $$
declare
  v_tenant uuid := '10000000-0000-0000-0000-000000000001';
  v_actor  uuid := 'e0000000-0000-0000-0000-000000000001';
  v_profile_id uuid;
begin
  if not exists (select 1 from tenants where id = v_tenant) then
    raise notice 'demo tenant % not present — skipping lifecycle demo seed', v_tenant;
    return;
  end if;

  -- BusinessProfile v1 (confirmed) — a car-rental operation with a modest fleet.
  if not exists (select 1 from business_profiles where tenant_id = v_tenant) then
    insert into business_profiles (
      tenant_id, version, primary_vertical, additional_verticals, asset_types,
      asset_quantity, projected_asset_quantity, users, branches,
      operational_capabilities, integration_needs, answers, source, created_by,
      status, confirmed_at
    ) values (
      v_tenant, 1, 'rental-cars', '{}', '{"carro"}',
      45, 70, 6, 2,
      '{"tracking","commercial"}', '{}',
      '[
        {"questionKey":"primary_activity","value":"rental-cars"},
        {"questionKey":"asset_quantity","value":45},
        {"questionKey":"projected_quantity","value":70},
        {"questionKey":"team_size","value":6},
        {"questionKey":"branches","value":2},
        {"questionKey":"needs_tracking","value":true}
      ]'::jsonb,
      'demo', v_actor, 'confirmed', now()
    )
    returning id into v_profile_id;
  else
    select id into v_profile_id from business_profiles
      where tenant_id = v_tenant and status = 'confirmed' limit 1;
  end if;

  -- CommercialConfiguration v1 (draft) — Professional plan, tracking add-on.
  if not exists (select 1 from commercial_configurations where tenant_id = v_tenant) then
    insert into commercial_configurations (
      tenant_id, version, business_profile_id, plan_id, plan_version_id,
      extensions, quotas, integrations, billing_cycle, prices,
      commitment_period_months, pricing_version, source, created_by, status
    ) values (
      v_tenant, 1, v_profile_id,
      'c2000000-0000-0000-0000-000000000002',
      'c3000000-0000-0000-0000-000000000002',
      '["tracking"]'::jsonb,
      '{"assets":70,"users":6,"branches":2,"storageGb":50,"aiCredits":1000}'::jsonb,
      '[]'::jsonb, 'monthly', '{}'::jsonb,
      12, 1, 'assisted', v_actor, 'draft'
    );
  end if;
end $$;
