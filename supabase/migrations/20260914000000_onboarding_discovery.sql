-- WAVE 2 — DISCOVERY & RECOMMENDATION for the Intelligent Tenant Onboarding
-- initiative.
--
-- All four tables here are CONTROL-PLANE CATALOG (platform-wide, versioned) —
-- there is no tenant_id. They exist so the discovery questionnaire, the
-- BlueprintResolver and the PlanResolver are DATA-DRIVEN and DETERMINISTIC:
-- the same BusinessProfile + the same rule_version always produce the same
-- recommendation, and every threshold / faixa lives in a row, never hardcoded
-- in a component.
--
--   verticals                    — the operation taxonomy. Reconciles the 10
--                                  real built-in blueprints
--                                  (packages/blueprint-runtime/src/built-ins.ts)
--                                  with onboarding, plus a `guincho` vertical
--                                  that has no dedicated built-in (maps to the
--                                  `mobility` base + a `towing` capability).
--   vertical_discovery_questions — the adaptive, jargon-free questionnaire.
--   blueprint_resolver_rules     — versioned vertical → base blueprint +
--                                  required/optional capabilities mapping.
--   plan_resolver_rules          — versioned thresholds: asset-count faixas,
--                                  per-vertical plan floors, capability →
--                                  minimum-plan upgrades, extension hints.

-- ── 1. verticals ──────────────────────────────────────────────────────────
create table if not exists verticals (
  key text primary key,
  name text not null,
  category text not null
    check (category in ('mobility', 'agriculture', 'construction', 'industrial', 'generic')),
  blueprint_id text not null,
  contract_template_key text not null,
  required_capabilities text[] not null default '{}',
  optional_capabilities text[] not null default '{}',
  recommended_plan_key text,
  active boolean not null default true,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table verticals enable row level security;
alter table verticals force row level security;
create policy "verticals_select_active" on verticals for select to authenticated
  using (active = true);

insert into verticals
  (key, name, category, blueprint_id, contract_template_key,
   required_capabilities, optional_capabilities, recommended_plan_key, sort_order)
values
  ('rental-cars', 'Locação de carros', 'mobility', 'rental-cars', 'vehicle_rental',
   '{"tracking","commercial"}', '{"maintenance","inspection"}', 'professional', 10),
  ('rental-motorcycles', 'Locação de motos', 'mobility', 'rental-motorcycles', 'vehicle_rental',
   '{"commercial"}', '{"tracking","maintenance","inspection"}', 'starter', 20),
  ('guincho', 'Guincho / reboque', 'mobility', 'mobility', 'vehicle_rental',
   '{"tracking","towing","commercial"}', '{"maintenance","workflow"}', 'professional', 30),
  ('fleet-mobility', 'Frota própria / mobilidade urbana', 'mobility', 'mobility', 'vehicle_rental',
   '{"tracking"}', '{"maintenance","commercial","inspection"}', 'professional', 40),
  ('forklift', 'Empilhadeiras', 'industrial', 'forklift', 'equipment_rental',
   '{"maintenance","inspection"}', '{"commercial","tracking"}', 'starter', 50),
  ('munk', 'Caminhão Munck', 'industrial', 'munk', 'equipment_with_operator',
   '{"maintenance","workflow","commercial"}', '{"tracking","inspection"}', 'professional', 60),
  ('crane', 'Guindaste', 'construction', 'crane', 'equipment_with_operator',
   '{"maintenance","workflow","commercial"}', '{"inspection"}', 'professional', 70),
  ('tower-crane', 'Grua', 'construction', 'tower-crane', 'equipment_with_operator',
   '{"maintenance","workflow","commercial"}', '{"inspection"}', 'professional', 80),
  ('agriculture', 'Máquinas agrícolas', 'agriculture', 'agriculture', 'equipment_rental',
   '{"maintenance","integration"}', '{"tracking","commercial","inspection"}', 'professional', 90),
  ('construction', 'Equipamentos de construção', 'construction', 'construction', 'equipment_rental',
   '{"maintenance","inspection"}', '{"commercial","tracking","workflow"}', 'starter', 100),
  ('generic-assets', 'Outros ativos', 'generic', 'generic-assets', 'equipment_rental',
   '{}', '{"maintenance","commercial","tracking","inspection"}', 'starter', 200)
on conflict (key) do nothing;

-- ── 2. vertical_discovery_questions ───────────────────────────────────────
-- No technical jargon in `prompt` — the tenant is asked about their
-- operation, never about "blueprints" / "capabilities" / "quotas".
-- applies_to_verticals empty = asked for every vertical.
create table if not exists vertical_discovery_questions (
  key text primary key,
  prompt text not null,
  help_text text,
  question_type text not null
    check (question_type in ('single_select', 'multi_select', 'number', 'range', 'boolean')),
  options jsonb not null default '[]'::jsonb,
  applies_to_verticals text[] not null default '{}',
  maps_to text not null,
  required boolean not null default true,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table vertical_discovery_questions enable row level security;
alter table vertical_discovery_questions force row level security;
create policy "vertical_discovery_questions_select_active"
  on vertical_discovery_questions for select to authenticated
  using (active = true);

insert into vertical_discovery_questions
  (key, prompt, help_text, question_type, options, applies_to_verticals, maps_to, required, sort_order)
values
  ('primary_activity',
   'Qual é a principal atividade da sua operação?',
   'Escolha a que melhor descreve o dia a dia. Você poderá ajustar depois.',
   'single_select',
   '[
     {"value":"rental-cars","label":"Alugo carros para clientes"},
     {"value":"rental-motorcycles","label":"Alugo motos para clientes"},
     {"value":"guincho","label":"Presto serviço de guincho / reboque"},
     {"value":"fleet-mobility","label":"Opero uma frota própria de veículos"},
     {"value":"forklift","label":"Loco ou opero empilhadeiras"},
     {"value":"munk","label":"Loco caminhão Munck com operador"},
     {"value":"crane","label":"Loco guindastes com operador"},
     {"value":"tower-crane","label":"Loco gruas para obras"},
     {"value":"agriculture","label":"Opero máquinas agrícolas"},
     {"value":"construction","label":"Loco equipamentos de construção"},
     {"value":"generic-assets","label":"Outro tipo de ativo"}
   ]'::jsonb,
   '{}', 'primaryVertical', true, 10),
  ('other_activities',
   'Você tem outras atividades além dessa?',
   'Marque todas que se aplicam. Deixe em branco se só tiver a atividade principal.',
   'multi_select',
   '[
     {"value":"rental-cars","label":"Locação de carros"},
     {"value":"rental-motorcycles","label":"Locação de motos"},
     {"value":"guincho","label":"Guincho / reboque"},
     {"value":"forklift","label":"Empilhadeiras"},
     {"value":"munk","label":"Caminhão Munck"},
     {"value":"crane","label":"Guindastes"},
     {"value":"agriculture","label":"Máquinas agrícolas"},
     {"value":"construction","label":"Equipamentos de construção"}
   ]'::jsonb,
   '{}', 'additionalVerticals', false, 20),
  ('asset_quantity',
   'Quantos ativos você gerencia hoje?',
   'Uma estimativa já ajuda. Conte veículos, máquinas ou equipamentos.',
   'number', '[]'::jsonb, '{}', 'assetQuantity', true, 30),
  ('projected_quantity',
   'Quantos ativos você espera ter em 12 meses?',
   'Se não souber, repita o número atual.',
   'number', '[]'::jsonb, '{}', 'projectedAssetQuantity', false, 40),
  ('team_size',
   'Quantas pessoas vão usar o sistema?',
   'Inclua quem faz vistoria, contrato, manutenção e financeiro.',
   'number', '[]'::jsonb, '{}', 'users', true, 50),
  ('branches',
   'Você opera em quantas unidades ou filiais?',
   'Conte cada endereço físico de onde a operação acontece.',
   'number', '[]'::jsonb, '{}', 'branches', false, 60),
  ('needs_tracking',
   'Você precisa acompanhar a localização dos ativos em tempo real?',
   'Rastreamento por GPS, cercas virtuais e histórico de trajeto.',
   'boolean', '[]'::jsonb,
   '{rental-cars,rental-motorcycles,guincho,fleet-mobility,forklift,agriculture,construction}',
   'operationalCapabilities', false, 70),
  ('needs_integration',
   'Você precisa integrar com sistemas que já usa?',
   'ERP, sistema de telemetria do fabricante, emissor de nota, etc.',
   'boolean', '[]'::jsonb, '{}', 'integrationNeeds', false, 80),
  ('operator_dispatch',
   'Seus equipamentos vão para o cliente com operador da sua equipe?',
   'Isso muda o tipo de contrato e o fluxo de agendamento.',
   'boolean', '[]'::jsonb, '{munk,crane,tower-crane,forklift,agriculture,construction}',
   'operationalCapabilities', false, 90)
on conflict (key) do nothing;

-- ── 3. blueprint_resolver_rules (versioned) ───────────────────────────────
create table if not exists blueprint_resolver_rules (
  rule_version integer primary key,
  active boolean not null default false,
  rules jsonb not null,
  notes text,
  created_at timestamptz not null default now()
);
alter table blueprint_resolver_rules enable row level security;
alter table blueprint_resolver_rules force row level security;
create policy "blueprint_resolver_rules_select_active"
  on blueprint_resolver_rules for select to authenticated
  using (active = true);
-- Only one active version at a time.
create unique index if not exists blueprint_resolver_rules_one_active
  on blueprint_resolver_rules (active) where active = true;

insert into blueprint_resolver_rules (rule_version, active, rules, notes)
values (
  1, true,
  '{
    "defaultBlueprintId": "generic-assets",
    "verticals": {
      "rental-cars":        {"baseBlueprintId":"rental-cars",        "requiredCapabilities":["tracking","commercial"],           "optionalCapabilities":["maintenance","inspection"]},
      "rental-motorcycles": {"baseBlueprintId":"rental-motorcycles", "requiredCapabilities":["commercial"],                      "optionalCapabilities":["tracking","maintenance","inspection"]},
      "guincho":            {"baseBlueprintId":"mobility",           "requiredCapabilities":["tracking","towing","commercial"],  "optionalCapabilities":["maintenance","workflow"]},
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
  'v1 — reconciles the 10 real built-ins + guincho (mobility base + towing).'
)
on conflict (rule_version) do nothing;

-- ── 4. plan_resolver_rules (versioned) ────────────────────────────────────
create table if not exists plan_resolver_rules (
  rule_version integer primary key,
  active boolean not null default false,
  rules jsonb not null,
  notes text,
  created_at timestamptz not null default now()
);
alter table plan_resolver_rules enable row level security;
alter table plan_resolver_rules force row level security;
create policy "plan_resolver_rules_select_active"
  on plan_resolver_rules for select to authenticated
  using (active = true);
create unique index if not exists plan_resolver_rules_one_active
  on plan_resolver_rules (active) where active = true;

insert into plan_resolver_rules (rule_version, active, rules, notes)
values (
  1, true,
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
      "guincho": "professional"
    },
    "extensionsByCapability": {
      "tracking": ["tracking"],
      "integration": ["integrations"],
      "towing": ["tracking"]
    },
    "optionalAddOnsByVertical": {
      "rental-cars": ["ai_credits_pack"],
      "guincho": ["tracking_pro"],
      "agriculture": ["telemetry_connector"]
    }
  }'::jsonb,
  'v1 — thresholds/faixas are data; UI must not hardcode them.'
)
on conflict (rule_version) do nothing;
