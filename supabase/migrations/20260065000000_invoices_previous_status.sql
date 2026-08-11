-- Tracks the status an invoice was in right before its last manual
-- transition, so a mistaken "Vencida"/"Cancelada"/etc. click can be undone
-- (single level — undoing an undo isn't supported, matching a plain "desfazer"
-- action rather than a full history stack).
alter table invoices add column if not exists previous_status invoice_status;
