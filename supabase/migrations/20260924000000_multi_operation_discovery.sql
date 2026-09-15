-- WAVE 2 — Multi-Operation Business Architecture v2: Discovery + Resolution.
--
-- EXTENDS the existing onboarding discovery catalog (does not replace it):
--   - adds the `passenger-transport` vertical (towing already exists as
--     `guincho`, added in 20260914000000, just without its own follow-up
--     question or dedicated capabilities beyond the generic ones)
--   - adds towing- and passenger-transport-specific follow-up questions,
--     scoped via applies_to_verticals
--   - adds "Fretamento / transporte de passageiros" as a selectable option
--     on both primary_activity and other_activities (multi-operation pick)
--   - publishes blueprint_resolver_rules v2 and plan_resolver_rules v2
--     (supersedes v1 the same way business_profiles/plan_versions do — old
--     row flipped inactive, new row active, nothing mutated in place)

-- ── 1. New vertical ─────────────────────────────────────────────────────
insert into verticals
  (key, name, category, blueprint_id, contract_template_key,
   required_capabilities, optional_capabilities, recommended_plan_key, sort_order)
values
  ('passenger-transport', 'Fretamento / transporte de passageiros', 'mobility', 'mobility',
   'vehicle_rental', '{"transport_request","trip","route","schedule","driver_allocation","commercial"}',
   '{"tracking","maintenance"}', 'professional', 35)
on conflict (key) do nothing;

-- ── 2. New options on the existing multi-select questions ───────────────
update vertical_discovery_questions
set options = options || '[{"value":"passenger-transport","label":"Faço fretamento / transporto passageiros"}]'::jsonb
where key = 'primary_activity'
  and not (options @> '[{"value":"passenger-transport"}]'::jsonb);

update vertical_discovery_questions
set options = options || '[{"value":"passenger-transport","label":"Fretamento / transporte de passageiros"}]'::jsonb
where key = 'other_activities'
  and not (options @> '[{"value":"passenger-transport"}]'::jsonb);

-- ── 3. New follow-up questions (towing + passenger transport) ───────────
insert into vertical_discovery_questions
  (key, prompt, help_text, question_type, options, applies_to_verticals, maps_to, required, sort_order)
values
  ('towing_service_model',
   'Como os guinchos são utilizados?',
   'Isso muda como organizamos os chamados e a cobrança.',
   'single_select',
   '[
     {"value":"internal_fleet_support","label":"Apenas para minha própria frota"},
     {"value":"on_demand_customer_service","label":"Atendimentos pontuais para meus clientes"},
     {"value":"commercial_towing_service","label":"Prestação comercial de serviço de guincho"},
     {"value":"mixed","label":"Um pouco de tudo"}
   ]'::jsonb,
   '{guincho}', 'towingServiceModel', false, 45),
  ('transport_purposes',
   'Como funciona sua operação de fretamento?',
   'Marque todas que se aplicam.',
   'multi_select',
   '[
     {"value":"corporate","label":"Transporte corporativo"},
     {"value":"charter","label":"Fretamento eventual"},
     {"value":"tourism","label":"Turismo / excursões"},
     {"value":"event","label":"Eventos"},
     {"value":"other","label":"Outros"}
   ]'::jsonb,
   '{passenger-transport}', 'transportPurposes', false, 46),
  ('transport_service_model',
   'Como as viagens normalmente acontecem?',
   null,
   'single_select',
   '[
     {"value":"on_demand","label":"Sob demanda"},
     {"value":"scheduled","label":"Programadas"},
     {"value":"recurring","label":"Recorrentes"},
     {"value":"mixed","label":"Misto"}
   ]'::jsonb,
   '{passenger-transport}', 'transportServiceModel', false, 47),
  ('transport_vehicle_quantity',
   'Quantos veículos fazem parte dessa operação?',
   null,
   'number', '[]'::jsonb,
   '{passenger-transport}', 'transportVehicleQuantity', false, 48),
  ('transport_fleet_types',
   'Quais tipos de veículo?',
   'Marque todos que se aplicam.',
   'multi_select',
   '[
     {"value":"bus","label":"Ônibus"},
     {"value":"minibus","label":"Micro-ônibus"},
     {"value":"van","label":"Vans"},
     {"value":"other","label":"Outros"}
   ]'::jsonb,
   '{passenger-transport}', 'transportFleetTypes', false, 49)
on conflict (key) do nothing;

-- ── 4. blueprint_resolver_rules v2 ───────────────────────────────────────
-- Adds the passenger-transport vertical rule and gives guincho its own
-- dispatch/service_request capabilities (previously it only had the
-- generic tracking/towing/commercial set from v1) — same "supersede,
-- never mutate a published rule set" discipline as plan_versions.
update blueprint_resolver_rules set active = false where rule_version = 1;
insert into blueprint_resolver_rules (rule_version, active, rules, notes)
values (
  2, true,
  '{
    "defaultBlueprintId": "generic-assets",
    "verticals": {
      "rental-cars":        {"baseBlueprintId":"rental-cars",        "requiredCapabilities":["tracking","commercial"],           "optionalCapabilities":["maintenance","inspection"]},
      "rental-motorcycles": {"baseBlueprintId":"rental-motorcycles", "requiredCapabilities":["commercial"],                      "optionalCapabilities":["tracking","maintenance","inspection"]},
      "guincho":            {"baseBlueprintId":"mobility",           "requiredCapabilities":["tracking","towing","dispatch","service_request","commercial"], "optionalCapabilities":["maintenance","workflow"]},
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
  'v2 — adds passenger-transport vertical; gives guincho its own dispatch/service_request capabilities instead of relying only on the generic mobility set.'
)
on conflict (rule_version) do nothing;

-- ── 5. plan_resolver_rules v2 ────────────────────────────────────────────
-- passenger-transport floors at professional (same tier as guincho — both
-- need dispatch/route/schedule capabilities the starter tier doesn't cover).
update plan_resolver_rules set active = false where rule_version = 1;
insert into plan_resolver_rules (rule_version, active, rules, notes)
values (
  2, true,
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
      "passenger-transport": "professional"
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
      "passenger-transport": ["tracking_pro"]
    }
  }'::jsonb,
  'v2 — adds passenger-transport floor (professional) and its tracking_pro add-on hint.'
)
on conflict (rule_version) do nothing;
