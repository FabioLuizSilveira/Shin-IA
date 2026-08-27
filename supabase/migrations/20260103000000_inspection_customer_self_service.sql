-- Customer self-service inspection (Inspection Engine V1 follow-up).
-- Decisions confirmed with the user:
--   1. Single per-tenant switch, default OFF ("por padrão a vistoria interna
--      pelo tenant") — not per-blueprint granularity.
--   2. Customer starts the inspection themselves via the Customer Portal —
--      not staff-created-then-delegated.
--   3. Filling and submitting a self-service inspection IS the customer's
--      acceptance of it — no separate "Concordo" click for what they just
--      filled in themselves (a signature is auto-recorded by the backend
--      at submit time, same document_hash contract as every other
--      acceptance in this codebase — never trusted from the request).

alter table tenants
  add column customer_self_inspection_enabled boolean not null default false;
comment on column tenants.customer_self_inspection_enabled is
  'When true, a rental_customer may create and fill their own inspection '
  'via the Customer Portal (POST /api/mobile/customer/inspections),  '
  'instead of only staff/operator being able to. Default false — '
  'vistoria continua interna ao tenant até habilitado explicitamente.';
