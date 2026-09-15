-- Multi-Operation Business Architecture v2 — extends the operation
-- taxonomy with two new dispatch-based operations that share towing's
-- exact kernel (spec sections 8-9's "reused kernel" principle, confirmed
-- by the user: "a mesma mecânica que pensamos para caminhão guincho"):
--   water_tank_service      — caminhão-pipa / distribuição de água
--   bulk_material_transport — transporte de areia, pedra, brita
--
-- Pure EXTEND: reuses operation_profiles (new type values only, same
-- table/columns/indexes), the discovery/blueprint/plan resolver machinery
-- (new vertical rows + a superseding rule version, same "never mutate a
-- published rule set" discipline as 20260924000000), and the trip/dispatch
-- runtime (Wave 3's Trip = operations row pattern, resource-matching's new
-- generic matchVehiclesByCapacityField). No new tables.

-- ── 1. operation_profiles.type CHECK ────────────────────────────────────
alter table operation_profiles drop constraint operation_profiles_type_check;
alter table operation_profiles add constraint operation_profiles_type_check
  check (type in (
    'vehicle_rental', 'motorcycle_rental',
    'towing_service', 'water_tank_service', 'bulk_material_transport',
    'passenger_transport',
    'equipment_rental', 'forklift_operation', 'aerial_platform_operation',
    'munk_operation', 'crane_operation', 'agricultural_equipment',
    'other'
  ));

-- ── 2. New verticals ──────────────────────────────────────────────────────
insert into verticals
  (key, name, category, blueprint_id, contract_template_key,
   required_capabilities, optional_capabilities, recommended_plan_key, sort_order)
values
  ('water-tank-truck', 'Caminhão-pipa / distribuição de água', 'mobility', 'mobility',
   'vehicle_rental', '{"tracking","dispatch","service_request","commercial"}',
   '{"maintenance","workflow"}', 'professional', 31),
  ('sand-gravel-transport', 'Transporte de areia e pedra', 'mobility', 'mobility',
   'vehicle_rental', '{"tracking","dispatch","service_request","commercial"}',
   '{"maintenance","workflow"}', 'professional', 32)
on conflict (key) do nothing;

-- ── 3. New options on the existing multi-operation-pick questions ───────
update vertical_discovery_questions
set options = options || '[{"value":"water-tank-truck","label":"Presto serviço de caminhão-pipa"}]'::jsonb
where key = 'primary_activity'
  and not (options @> '[{"value":"water-tank-truck"}]'::jsonb);
update vertical_discovery_questions
set options = options || '[{"value":"sand-gravel-transport","label":"Transporto areia ou pedra"}]'::jsonb
where key = 'primary_activity'
  and not (options @> '[{"value":"sand-gravel-transport"}]'::jsonb);

update vertical_discovery_questions
set options = options || '[{"value":"water-tank-truck","label":"Caminhão-pipa"}]'::jsonb
where key = 'other_activities'
  and not (options @> '[{"value":"water-tank-truck"}]'::jsonb);
update vertical_discovery_questions
set options = options || '[{"value":"sand-gravel-transport","label":"Transporte de areia e pedra"}]'::jsonb
where key = 'other_activities'
  and not (options @> '[{"value":"sand-gravel-transport"}]'::jsonb);

-- ── 4. New follow-up questions (mirror towing_service_model exactly) ────
insert into vertical_discovery_questions
  (key, prompt, help_text, question_type, options, applies_to_verticals, maps_to, required, sort_order)
values
  ('water_tank_service_model',
   'Como os caminhões-pipa são utilizados?',
   'Isso muda como organizamos os chamados e a cobrança.',
   'single_select',
   '[
     {"value":"internal_fleet_support","label":"Apenas para minha própria operação"},
     {"value":"on_demand_customer_service","label":"Atendimentos pontuais para meus clientes"},
     {"value":"commercial_towing_service","label":"Prestação comercial de abastecimento de água"},
     {"value":"mixed","label":"Um pouco de tudo"}
   ]'::jsonb,
   '{water-tank-truck}', 'waterTankServiceModel', false, 50),
  ('bulk_material_service_model',
   'Como o transporte de areia/pedra é utilizado?',
   'Isso muda como organizamos os chamados e a cobrança.',
   'single_select',
   '[
     {"value":"internal_fleet_support","label":"Apenas para minha própria obra/operação"},
     {"value":"on_demand_customer_service","label":"Atendimentos pontuais para meus clientes"},
     {"value":"commercial_towing_service","label":"Prestação comercial de transporte de material"},
     {"value":"mixed","label":"Um pouco de tudo"}
   ]'::jsonb,
   '{sand-gravel-transport}', 'bulkMaterialServiceModel', false, 51)
on conflict (key) do nothing;

-- ── 5. blueprint_resolver_rules v3 ───────────────────────────────────────
update blueprint_resolver_rules set active = false where rule_version = 2;
insert into blueprint_resolver_rules (rule_version, active, rules, notes)
values (
  3, true,
  '{
    "defaultBlueprintId": "generic-assets",
    "verticals": {
      "rental-cars":        {"baseBlueprintId":"rental-cars",        "requiredCapabilities":["tracking","commercial"],           "optionalCapabilities":["maintenance","inspection"]},
      "rental-motorcycles": {"baseBlueprintId":"rental-motorcycles", "requiredCapabilities":["commercial"],                      "optionalCapabilities":["tracking","maintenance","inspection"]},
      "guincho":            {"baseBlueprintId":"mobility",           "requiredCapabilities":["tracking","towing","dispatch","service_request","commercial"], "optionalCapabilities":["maintenance","workflow"]},
      "water-tank-truck":   {"baseBlueprintId":"mobility",           "requiredCapabilities":["tracking","dispatch","service_request","commercial"], "optionalCapabilities":["maintenance","workflow"]},
      "sand-gravel-transport": {"baseBlueprintId":"mobility",        "requiredCapabilities":["tracking","dispatch","service_request","commercial"], "optionalCapabilities":["maintenance","workflow"]},
      "passenger-transport":{"baseBlueprintId":"mobility",           "requiredCapabilities":["transport_request","trip","route","schedule","driver_allocation","commercial"], "optionalCapabilities":["tracking","maintenance"]},
      "fleet-mobility":     {"baseBlueprintId":"mobility",           "requiredCapabilities":["tracking"],                        "optionalCapabilities":["maintenance","commercial","inspection"]},
      "forklift":           {"baseBlueprintId":"forklift",           "requiredCapabilities":["maintenance","inspection"],        "optionalCapabilities":["commercial","tracking"]},
      "munk":               {"baseBlueprintId":"munk",               "requiredCapabilities":["maintenance","workflow","commercial"], "optionalCapabilities":["tracking","inspection"]},
      "crane":              {"baseBlueprintId":"crane",              "requiredCapabilities":["maintenance","workflow","commercial"], "optionalCapabilities":["inspection"]},
      "tower-crane":        {"baseBlueprintId":"tower-crane",        "requiredCapabilities":["maintenance","workflow","commercial"], "optionalCapabilities":["inspection"]},
      "agriculture":        {"baseBlueprintId":"agriculture",        "requiredCapabilities":["maintenance","integration"],       "optionalCapabilities":["tracking","commercial","inspection"]},
      "construction":       {"baseBlueprintId":"construction",       "requiredCapabilities":["maintenance","inspection"],        "optionalCapabilities":["commercial","tracking","workflow"]},
      "generic-assets":     {"baseBlueprintId":"generic-assets",     "requiredCapabilities":[],                                  "optionalCapabilities":["maintenance","commercial","tracking","inspection"]}
    },
    "answerCapabilities": {
      "needs_tracking":     {"whenTrue":["tracking"]},
      "needs_integration":  {"whenTrue":["integration"]},
      "operator_dispatch":  {"whenTrue":["workflow"]}
    }
  }'::jsonb,
  'v3 — adds water-tank-truck and sand-gravel-transport verticals, reusing guincho''s dispatch/service_request capability set (same kernel).'
)
on conflict (rule_version) do nothing;

-- ── 6. plan_resolver_rules v3 ─────────────────────────────────────────────
update plan_resolver_rules set active = false where rule_version = 2;
insert into plan_resolver_rules (rule_version, active, rules, notes)
values (
  3, true,
  '{
    "planRank": ["starter", "professional"],
    "defaultPlanKey": "starter",
    "assetThresholds": [
      {"maxAssets": 25, "planKey": "starter"},
      {"maxAssets": null, "planKey": "professional"}
    ],
    "capabilityMinPlan": {
      "tracking": "professional",
      "integration": "professional"
    },
    "verticalFloor": {
      "munk": "professional",
      "crane": "professional",
      "tower-crane": "professional",
      "agriculture": "professional",
      "guincho": "professional",
      "passenger-transport": "professional",
      "water-tank-truck": "professional",
      "sand-gravel-transport": "professional"
    },
    "extensionsByCapability": {
      "tracking": ["tracking"],
      "integration": ["integrations"],
      "towing": ["tracking"],
      "route": ["tracking"]
    },
    "optionalAddOnsByVertical": {
      "rental-cars": ["ai_credits_pack"],
      "guincho": ["tracking_pro"],
      "agriculture": ["telemetry_connector"],
      "passenger-transport": ["tracking_pro"],
      "water-tank-truck": ["tracking_pro"],
      "sand-gravel-transport": ["tracking_pro"]
    }
  }'::jsonb,
  'v3 — adds water-tank-truck and sand-gravel-transport floors (professional) and tracking_pro add-on hints.'
)
on conflict (rule_version) do nothing;
