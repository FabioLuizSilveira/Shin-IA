-- Document AI (Etapa 12, P1). Upload -> extraction -> human-confirmed
-- draft -> record, per the spec. extraction_confidence/extraction_model/
-- extracted_at already exist (reserved by 20260112000000_maintenance.sql);
-- this adds what P0 deliberately left out: mime_type (needed by the
-- extraction edge function to know how to send the file to the model
-- without guessing from a filename extension) and an explicit lifecycle
-- status plus the draft/error/confirmation columns.
--
-- Anti-hallucination by construction (Etapa 12's explicit requirement):
-- extraction_draft is never written to maintenance_orders automatically
-- by any route in this migration or the API layer -- a human must
-- explicitly confirm (confirmed_by/confirmed_at) before the extracted
-- data is treated as anything more than a suggestion attached to the
-- document itself. See docs/modules/MAINTENANCE.md for the full
-- rationale on why confirmation does not auto-populate order fields.
alter table maintenance_documents
  add column mime_type text,
  add column extraction_status text not null default 'none',
  add column extraction_draft jsonb,
  add column extraction_error text,
  add column confirmed_by uuid,
  add column confirmed_at timestamptz;

alter table maintenance_documents
  add constraint maintenance_documents_extraction_status_check
  check (extraction_status in ('none', 'pending', 'extracted', 'failed', 'confirmed'));
