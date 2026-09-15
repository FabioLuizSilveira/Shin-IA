-- Multi-Operation Business Architecture v2 — extends the operation
-- taxonomy with concrete-mixer trucks (caminhão betoneira), the fourth
-- dispatch-based operation type reusing towing's exact kernel (user:
-- "segue com a wave 2 pro caminhão betoneira" — same treatment as towing,
-- water-tank-truck and bulk-material-transport before it).
--
-- Pure EXTEND: operation_profiles (new type value only), the discovery/
-- blueprint/plan resolver machinery (new vertical row + a superseding
-- rule version), and Wave 3's Trip = operations row pattern +
-- matchVehiclesByCapacityField (reused via capacityCubicMeters — concrete
-- is always m³, unlike bulk material which can also be tons). No new
-- tables.

-- ── 1. operation_profiles.type CHECK ────────────────────────────────────
alter table operation_profiles drop constraint operation_profiles_type_check;
alter table operation_profiles add constraint operation_profiles_type_check
  check (type in (
    'vehicle_rental', 'motorcycle_rental',
    'towing_service', 'water_tank_service', 'bulk_material_transport',
    'concrete_mixer_service',
    'passenger_transport',
    'equipment_rental', 'forklift_operation', 'aerial_platform_operation',
    'munk_operation', 'crane_operation', 'agricultural_equipment',
    'other'
  ));

-- ── 2. New vertical ──────────────────────────────────────────────────────
insert into verticals
  (key, name, category, blueprint_id, contract_template_key,
   required_capabilities, optional_capabilities, recommended_plan_key, sort_order)
values
  ('concrete-mixer-truck', 'Caminhão betoneira / concreto', 'mobility', 'mobility',
   'vehicle_rental', '{"tracking","dispatch","service_request","commercial"}',
   '{"maintenance","workflow"}', 'professional', 33)
on conflict (key) do nothing;

-- ── 3. New options on the multi-operation-pick questions ────────────────
update vertical_discovery_questions
set options = options || '[{"value":"concrete-mixer-truck","label":"Presto serviço de caminhão betoneira"}]'::jsonb
where key = 'primary_activity'
  and not (options @> '[{"value":"concrete-mixer-truck"}]'::jsonb);

update vertical_discovery_questions
set options = options || '[{"value":"concrete-mixer-truck","label":"Caminhão betoneira"}]'::jsonb
where key = 'other_activities'
  and not (options @> '[{"value":"concrete-mixer-truck"}]'::jsonb);

-- ── 4. New follow-up question (mirrors towing_service_model exactly) ────
insert into vertical_discovery_questions
  (key, prompt, help_text, question_type, options, applies_to_verticals, maps_to, required, sort_order)
values
  ('concrete_mixer_service_model',
   'Como os caminhões betoneira são utilizados?',
   'Isso muda como organizamos os chamados e a cobrança.',
   'single_select',
   '[
     {"value":"internal_fleet_support","label":"Apenas para minhas próprias obras"},
     {"value":"on_demand_customer_service","label":"Atendimentos pontuais para meus clientes"},
     {"value":"commercial_towing_service","label":"Prestação comercial de fornecimento de concreto"},
     {"value":"mixed","label":"Um pouco de tudo"}
   ]'::jsonb,
   '{concrete-mixer-truck}', 'concreteMixerServiceModel', false, 52)
on conflict (key) do nothing;

-- ── 5. blueprint_resolver_rules v4 ───────────────────────────────────────
update blueprint_resolver_rules set active = false where rule_version = 3;
insert into blueprint_resolver_rules (rule_version, active, rules, notes)
values (
  4, true,
  '{
    "defaultBlueprintId": "generic-assets",
    "verticals": {
      "rental-cars":        {"baseBlueprintId":"rental-cars",        "requiredCapabilities":["tracking","commercial"],           "optionalCapabilities":["maintenance","inspection"]},
      "rental-motorcycles": {"baseBlueprintId":"rental-motorcycles", "requiredCapabilities":["commercial"],                      "optionalCapabilities":["tracking","maintenance","inspection"]},
      "guincho":            {"baseBlueprintId":"mobility",           "requiredCapabilities":["tracking","towing","dispatch","service_request","commercial"], "optionalCapabilities":["maintenance","workflow"]},
      "water-tank-truck":   {"baseBlueprintId":"mobility",           "requiredCapabilities":["tracking","dispatch","service_request","commercial"], "optionalCapabilities":["maintenance","workflow"]},
      "sand-gravel-transport": {"baseBlueprintId":"mobility",        "requiredCapabilities":["tracking","dispatch","service_request","commercial"], "optionalCapabilities":["maintenance","workflow"]},
      "concrete-mixer-truck": {"baseBlueprintId":"mobility",         "requiredCapabilities":["tracking","dispatch","service_request","commercial"], "optionalCapabilities":["maintenance","workflow"]},
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
  'v4 — adds concrete-mixer-truck vertical, reusing the same dispatch/service_request kernel as guincho/water-tank-truck/sand-gravel-transport.'
)
on conflict (rule_version) do nothing;

-- ── 6. plan_resolver_rules v4 ─────────────────────────────────────────────
update plan_resolver_rules set active = false where rule_version = 3;
insert into plan_resolver_rules (rule_version, active, rules, notes)
values (
  4, true,
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
      "sand-gravel-transport": "professional",
      "concrete-mixer-truck": "professional"
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
      "sand-gravel-transport": ["tracking_pro"],
      "concrete-mixer-truck": ["tracking_pro"]
    }
  }'::jsonb,
  'v4 — adds concrete-mixer-truck floor (professional) and tracking_pro add-on hint.'
)
on conflict (rule_version) do nothing;
