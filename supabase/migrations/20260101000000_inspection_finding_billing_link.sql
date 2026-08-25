-- Fase F (docs/architecture/INSPECTION_ENGINE.md) — links a confirmed
-- Finding to the invoice line item it generates, mirroring the pattern
-- already used for invoices.contract_id (20260076000000). Nullable/
-- non-retroactive; nothing existing changes shape. This is what makes
-- ensureFindingCharge() idempotent (one line item per finding, checked by
-- this column instead of guessing from free-text description).

alter table invoice_line_items
  add column inspection_finding_id uuid references inspection_findings (id) on delete set null;

create index invoice_line_items_inspection_finding_id_idx
  on invoice_line_items (inspection_finding_id)
  where inspection_finding_id is not null;
