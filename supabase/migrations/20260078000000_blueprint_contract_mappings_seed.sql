-- Blueprint → Contract Template mapping — config, not code (item 2: never
-- `if (assetType === "munk")`). Covers the 10 real built-ins in
-- packages/blueprint-runtime/src/built-ins.ts (BUILT_IN_BLUEPRINTS), not the
-- smaller 5-value BlueprintId used only by the onboarding wizard.
insert into blueprint_contract_mappings (blueprint_id, contract_template_key, is_default) values
  ('mobility', 'vehicle_rental', true),
  ('rental-cars', 'vehicle_rental', true),
  ('rental-motorcycles', 'vehicle_rental', true),
  ('forklift', 'equipment_rental', true),
  ('forklift', 'equipment_with_operator', false),
  ('munk', 'equipment_with_operator', true),
  ('munk', 'service_provision', false),
  ('crane', 'equipment_with_operator', true),
  ('crane', 'service_provision', false),
  ('tower-crane', 'equipment_with_operator', true),
  ('tower-crane', 'service_provision', false),
  ('agriculture', 'equipment_rental', true),
  ('agriculture', 'equipment_with_operator', false),
  ('construction', 'equipment_rental', true),
  ('construction', 'equipment_with_operator', false),
  ('generic-assets', 'equipment_rental', true)
on conflict (blueprint_id, contract_template_key) do nothing;
