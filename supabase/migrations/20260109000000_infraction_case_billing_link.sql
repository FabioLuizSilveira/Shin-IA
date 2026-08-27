-- Fase G (docs/architecture/INFRACTIONS_ENGINE.md) — links a confirmed
-- infraction case to the invoice line item it generates, mirroring
-- 20260101000000_inspection_finding_billing_link.sql exactly (same
-- reasoning: nullable, non-retroactive, and this is what makes
-- ensureInfractionCharge() idempotent -- one line item per case, checked
-- by this column instead of guessing from free-text description).

alter table invoice_line_items
  add column infraction_case_id uuid references infraction_cases (id) on delete set null;

create index invoice_line_items_infraction_case_id_idx
  on invoice_line_items (infraction_case_id)
  where infraction_case_id is not null;
