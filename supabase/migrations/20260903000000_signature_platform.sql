-- Shinã Signature Platform — P0 schema. Provider-agnostic electronic
-- signature infrastructure; Clicksign (P1, not yet implemented) will be
-- the first real provider. Every table here stores only canonical Shinã
-- concepts — no Clicksign-specific (or any other gateway's) nomenclature
-- anywhere, per the platform's own architectural mandate.
--
-- `provider` is free text (not an enum) on every table that carries it —
-- same pattern as checkout_session_references.provider in the billing
-- migration — so a new provider never needs a schema migration, only a
-- new @shina/signature-platform adapter.

create type signature_status as enum (
  'draft', 'sent', 'in_progress', 'signed', 'cancelled', 'expired', 'failed'
);

create type signer_role as enum (
  'customer', 'operator', 'guarantor', 'witness', 'tenant_representative', 'other'
);

create type signer_status as enum ('pending', 'viewed', 'signed', 'refused');

create type signature_artifact_kind as enum ('original', 'signed', 'evidence', 'certificate');

-- ── signature_requests ───────────────────────────────────────────────────────
-- One row per contract signature flow. contract_version_id/snapshot_id are
-- captured at creation time from the already-frozen
-- tenant_contract_versions/tenant_contract_snapshots rows (re-validated
-- against `contracts` before insert — see createSignatureRequest()) so a
-- completed signature always resolves back to the exact document version
-- that was actually sent, even if the contract's template is edited later.
create table if not exists signature_requests (
  id                    uuid              primary key default gen_random_uuid(),
  tenant_id             uuid              not null,
  contract_id           uuid              not null,
  contract_version_id   uuid              not null,
  snapshot_id           uuid              not null,
  -- Never changes after insert once set by createRequest() (spec section
  -- 29's provider-immutability invariant) — enforced by RLS having no
  -- update policy for `authenticated`, the established pattern in this
  -- codebase (see tenant_contract_acceptances, asset_owner_settlements),
  -- not a bespoke trigger.
  provider              text              not null,
  provider_request_id   text,
  document_name         text              not null,
  status                signature_status  not null default 'draft',
  created_at            timestamptz       not null default now(),
  updated_at            timestamptz       not null default now(),

  constraint signature_requests_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint signature_requests_contract_fk
    foreign key (contract_id) references contracts (id) on delete cascade
);

create index signature_requests_tenant_id_idx on signature_requests (tenant_id);
create index signature_requests_contract_id_idx on signature_requests (contract_id);
create unique index signature_requests_provider_request_unique
  on signature_requests (provider, provider_request_id)
  where provider_request_id is not null;

-- ── signature_signers ────────────────────────────────────────────────────────
-- party_type/user_id/customer_id/operator_id exist specifically so
-- applySignatureEvent() can call @shina/tenant-contract-engine's
-- recordContractAcceptance() at SIGNATURE_COMPLETED time without needing a
-- live HTTP request context — only "customer" and "operator" roles carry
-- a party_type, matching PartyType in tenant-contract-engine; guarantor/
-- witness/tenant_representative/other are real trackable signers with no
-- acceptance-record bridge yet (documented P0/P1 gap).
create table if not exists signature_signers (
  id                    uuid          primary key default gen_random_uuid(),
  signature_request_id  uuid          not null,
  tenant_id             uuid          not null,
  role                  signer_role   not null,
  party_type            text,
  user_id               uuid,
  customer_id           uuid,
  operator_id           uuid,
  name                  text          not null,
  email                 text          not null,
  provider_external_id  text,
  status                signer_status not null default 'pending',
  signed_at             timestamptz,
  created_at            timestamptz   not null default now(),

  constraint signature_signers_request_fk
    foreign key (signature_request_id) references signature_requests (id) on delete cascade,
  constraint signature_signers_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint signature_signers_party_type_check
    check (party_type is null or party_type in ('customer', 'operator')),
  constraint signature_signers_party_identity_check
    check (
      (party_type = 'customer' and customer_id is not null)
      or (party_type = 'operator' and operator_id is not null)
      or party_type is null
    )
);

create index signature_signers_request_id_idx on signature_signers (signature_request_id);
create index signature_signers_tenant_id_idx on signature_signers (tenant_id);
create unique index signature_signers_provider_external_id_unique
  on signature_signers (signature_request_id, provider_external_id)
  where provider_external_id is not null;

-- ── signature_artifacts ──────────────────────────────────────────────────────
-- Shinã-owned copies of every document tied to a signature request
-- (original, final signed, evidence, certificate) — storage_path points
-- into the existing `contract-documents` bucket under a signatures/
-- prefix, never the unrelated contract_documents TABLE (that's KYC
-- uploads keyed to requirement_id). Never depends on the provider as
-- permanent storage.
create table if not exists signature_artifacts (
  id                    uuid                     primary key default gen_random_uuid(),
  signature_request_id  uuid                     not null,
  tenant_id             uuid                     not null,
  kind                  signature_artifact_kind  not null,
  filename              text                     not null,
  content_type          text                     not null,
  storage_path          text                     not null,
  hash                  text                     not null,
  created_at            timestamptz              not null default now(),

  constraint signature_artifacts_request_fk
    foreign key (signature_request_id) references signature_requests (id) on delete cascade,
  constraint signature_artifacts_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create index signature_artifacts_request_id_idx on signature_artifacts (signature_request_id);
create index signature_artifacts_tenant_id_idx on signature_artifacts (tenant_id);

-- ── signature_webhook_events ─────────────────────────────────────────────────
-- Idempotency log — event logged here FIRST, before any side effect, under
-- a composite unique index on (provider, provider_event_id). Composite
-- (not a single column like platform_billing_events) because two
-- different providers could each mint an id "1" — a deliberate divergence
-- from the billing-platform pattern. No event_fingerprint fallback in
-- P0 — cut as YAGNI: only FakeSignatureProvider exists today and it
-- always supplies an id; add a fallback only once a real provider that
-- can't guarantee one is actually being integrated.
create table if not exists signature_webhook_events (
  id                    uuid          primary key default gen_random_uuid(),
  provider              text          not null,
  provider_event_id     text          not null,
  event_type            text          not null,
  payload               jsonb         not null default '{}'::jsonb,
  signature_request_id  uuid,
  processed_at          timestamptz,
  created_at            timestamptz   not null default now(),

  constraint signature_webhook_events_request_fk
    foreign key (signature_request_id) references signature_requests (id) on delete set null
);

create unique index signature_webhook_events_provider_event_unique
  on signature_webhook_events (provider, provider_event_id);
create index signature_webhook_events_request_id_idx on signature_webhook_events (signature_request_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Defense-in-depth, matching every other tenant-scoped table this
-- codebase's routes go through requireTenantScope() (admin client +
-- explicit tenant_id filter) for: select-only for `authenticated`, no
-- insert/update/delete policy — service-role writes exclusively. This is
-- also how provider immutability (spec section 29) is enforced, without a
-- bespoke trigger.
alter table signature_requests enable row level security;
alter table signature_requests force row level security;
create policy "signature_requests_select_own_tenant" on signature_requests
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table signature_signers enable row level security;
alter table signature_signers force row level security;
create policy "signature_signers_select_own_tenant" on signature_signers
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table signature_artifacts enable row level security;
alter table signature_artifacts force row level security;
create policy "signature_artifacts_select_own_tenant" on signature_artifacts
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- signature_webhook_events carries no tenant_id (it's keyed by
-- provider+event, resolved to a tenant only indirectly via
-- signature_request_id) — no `authenticated` select policy at all;
-- service-role only, same posture as platform_billing_events.
alter table signature_webhook_events enable row level security;
alter table signature_webhook_events force row level security;

-- ── IAM ──────────────────────────────────────────────────────────────────────
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (values
  ('tenant.contracts.signature.view', 'contract_signatures', 'view', 'Ver assinaturas de contrato'),
  ('tenant.contracts.signature.create', 'contract_signatures', 'create', 'Criar solicitação de assinatura'),
  ('tenant.contracts.signature.send', 'contract_signatures', 'send', 'Enviar solicitação de assinatura'),
  ('tenant.contracts.signature.cancel', 'contract_signatures', 'cancel', 'Cancelar solicitação de assinatura'),
  ('tenant.contracts.signature.resend', 'contract_signatures', 'resend', 'Reenviar solicitação de assinatura'),
  ('tenant.contracts.signature.download', 'contract_signatures', 'download', 'Baixar documento assinado'),
  ('tenant.contracts.signature.admin', 'contract_signatures', 'admin', 'Administrar configuração de assinatura')
) as v(key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key in (
    'tenant.contracts.signature.view', 'tenant.contracts.signature.create',
    'tenant.contracts.signature.send', 'tenant.contracts.signature.cancel',
    'tenant.contracts.signature.resend', 'tenant.contracts.signature.download',
    'tenant.contracts.signature.admin'
  )
on conflict do nothing;
