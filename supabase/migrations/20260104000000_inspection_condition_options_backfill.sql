-- Data-only fix, found live while E2E-testing the customer self-service
-- flow: every `condition`-type item in the two global inspection
-- templates (vehicle_standard_v1, equipment_standard_v1) was seeded with
-- select_options = null (20260099000000_inspection_engine_seed.sql never
-- set it for this field type — only single_select got real options).
-- A `condition` item is rendered as an options picker on both the
-- Tenant Web checklist form and this migration's own new Customer
-- Portal fill page (and would be on the mobile capture screen too, same
-- `item.selectOptions ?? []` pattern) — with no options there is
-- nothing to tap/click, so the item can never be answered. Two of the
-- twelve affected items are `required: true` ("Pneus", "Funcionamento
-- geral"), which made it structurally impossible to ever complete a
-- check_in/check_out inspection against either global template, for
-- ANY actor (operator, staff, or the new self-service customer) — not
-- a gap specific to this round's new feature, a pre-existing defect in
-- the original seed.
update inspection_template_items
set select_options = '[
  {"value": "good", "label": "Bom"},
  {"value": "fair", "label": "Regular", "severity": "medium"},
  {"value": "poor", "label": "Ruim", "severity": "high"}
]'::jsonb
where field_type = 'condition'
  and select_options is null;
