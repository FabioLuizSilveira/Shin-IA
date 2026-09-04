-- Confirmed live 2026-09-04: Clicksign's webhook payload for
-- document_closed/close events carries the DOCUMENT's own id (a
-- different UUID from the envelope's), not the envelope id stored as
-- signature_requests.provider_request_id. applySignatureEvent()'s lookup
-- by provider_request_id alone therefore never matched a real delivery.
-- provider_document_id is a second, optional identifier a provider's
-- create step can persist so the webhook lookup can match on either —
-- kept intentionally generic (not "clicksign_document_id"): a future
-- provider whose webhook identifies a sub-resource rather than the root
-- request can populate the same column.
alter table signature_requests add column if not exists provider_document_id text;

create unique index if not exists signature_requests_provider_document_id_unique
  on signature_requests (provider, provider_document_id)
  where provider_document_id is not null;
