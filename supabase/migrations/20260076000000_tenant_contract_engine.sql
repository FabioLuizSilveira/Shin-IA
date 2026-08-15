-- Tenant × Customer / Tenant × Operator Contract Engine — dynamic contract
-- resolution driven by Tenant/Blueprint/Asset Type/Operation, never a
-- universal contract. Distinct from commercial_flow.sql's contract_templates/
-- contract_versions/contract_acceptances (those are 1:1 by subscription
-- product — Tenant↔Shinã billing agreements). This is N templates per
-- Tenant, keyed by Blueprint, for the operational agreement between a
-- Tenant and its own customers/operators (vehicle rental, equipment rental,
-- equipment+operator, service provision).
--
-- Extends the existing `contracts` table (20260013000000, M27 — a plain CRUD
-- record with status transitions and no clauses/versioning/acceptance) in
-- place instead of creating a parallel "contract" concept.

-- ── Enums ────────────────────────────────────────────────────────────────────
create type contract_clause_category as enum (
  'general', 'payment', 'cancellation', 'delivery', 'return', 'damage',
  'insurance', 'tracking', 'telemetry', 'fuel', 'mileage', 'hour_meter',
  'fines', 'operator', 'certification', 'safety', 'maintenance',
  'security_deposit', 'transport', 'mobilization', 'demobilization',
  'overtime', 'liability', 'privacy', 'data_processing', 'consumer_rights'
);

create type contract_party_type as enum ('customer', 'operator');

-- Legal configuration, never inferred automatically (see plan doc item 17) —
-- always a value the Tenant configures per template/operation, defaulting to
-- 'undetermined' which keeps consumer-protection clauses mandatory.
create type consumer_relationship_type as enum ('consumer', 'business', 'undetermined');

create type data_processing_legal_basis as enum (
  'consent', 'contract_performance', 'legitimate_interest', 'legal_obligation', 'not_applicable'
);

-- 'operator_acknowledgement' is deliberately distinct from 'clickwrap' — it
-- is staff recording an acceptance on behalf of an operator with no login of
-- their own, never a real electronic signature by the operator.
create type contract_acceptance_method as enum (
  'clickwrap', 'otp', 'electronic_signature_provider', 'digital_signature', 'operator_acknowledgement'
);

create type contract_document_status as enum ('pending', 'approved', 'rejected');

create type operator_status as enum ('active', 'inactive');

create type operator_assignment_status as enum ('assigned', 'confirmed', 'declined', 'completed');

-- ── Clause library (versioned) ──────────────────────────────────────────────
-- tenant_id null = global clause available to every tenant (the seeded
-- library, Fase C); tenant_id filled = a tenant's own clause (item 6, "adicionar
-- cláusulas próprias").
create table tenant_contract_clauses (
  id          uuid                      primary key default gen_random_uuid(),
  tenant_id   uuid                      references tenants (id) on delete cascade,
  category    contract_clause_category not null,
  key         text                      not null,
  title       text                      not null,
  content     text                      not null,
  version     integer                   not null default 1,
  status      text                      not null default 'draft'
                check (status in ('draft', 'published', 'superseded')),
  created_at  timestamptz               not null default now()
);

create unique index tenant_contract_clauses_key_version_unique
  on tenant_contract_clauses (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'), key, version);
create index tenant_contract_clauses_tenant_id_idx on tenant_contract_clauses (tenant_id);
create index tenant_contract_clauses_category_idx on tenant_contract_clauses (category);

-- ── Templates ────────────────────────────────────────────────────────────────
create table tenant_contract_templates (
  id          uuid                  primary key default gen_random_uuid(),
  tenant_id   uuid                  references tenants (id) on delete cascade,
  key         text                  not null,
  party_type  contract_party_type   not null,
  name        text                  not null,
  status      text                  not null default 'active'
                check (status in ('active', 'inactive')),
  created_at  timestamptz           not null default now()
);

create unique index tenant_contract_templates_key_unique
  on tenant_contract_templates (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'), key);
create index tenant_contract_templates_tenant_id_idx on tenant_contract_templates (tenant_id);

create table tenant_contract_template_clauses (
  id            uuid          primary key default gen_random_uuid(),
  template_id   uuid          not null references tenant_contract_templates (id) on delete cascade,
  clause_id     uuid          not null references tenant_contract_clauses (id) on delete restrict,
  is_mandatory  boolean       not null default true,
  -- Declarative condition, evaluated by ContractTemplateEngine (Fase B):
  -- {"field": "operatorIncluded", "op": "eq", "value": true}. Null when
  -- is_mandatory = true (always included, no condition to evaluate).
  condition     jsonb,
  sort_order    integer       not null default 0
);

create unique index tenant_contract_template_clauses_unique
  on tenant_contract_template_clauses (template_id, clause_id);
create index tenant_contract_template_clauses_template_id_idx
  on tenant_contract_template_clauses (template_id);

-- Published version of a template — immutable once published (never UPDATE
-- resolved_clauses after status = 'published', same discipline as
-- plan_versions/contract_versions in commercial_flow.sql).
create table tenant_contract_versions (
  id                uuid          primary key default gen_random_uuid(),
  template_id       uuid          not null references tenant_contract_templates (id) on delete cascade,
  version           integer       not null,
  resolved_clauses  jsonb         not null default '[]',
  content_hash      text,
  effective_at      timestamptz   not null default now(),
  status            text          not null default 'draft'
                       check (status in ('draft', 'published', 'superseded')),
  created_at        timestamptz   not null default now()
);

create unique index tenant_contract_versions_template_version_unique
  on tenant_contract_versions (template_id, version);
create index tenant_contract_versions_status_idx on tenant_contract_versions (template_id, status);

-- ── Blueprint → Contract Template mapping (config, not code) ───────────────
create table blueprint_contract_mappings (
  id                    uuid          primary key default gen_random_uuid(),
  blueprint_id          text          not null,
  contract_template_key text          not null,
  is_default            boolean       not null default false,
  created_at            timestamptz   not null default now()
);

create unique index blueprint_contract_mappings_unique
  on blueprint_contract_mappings (blueprint_id, contract_template_key);
create index blueprint_contract_mappings_blueprint_id_idx
  on blueprint_contract_mappings (blueprint_id);

-- ── Resolution context (audit of what the resolver decided and why) ────────
create table tenant_contract_requirements (
  id                          uuid                          primary key default gen_random_uuid(),
  tenant_id                   uuid                          not null references tenants (id) on delete cascade,
  operation_id                uuid                          references operations (id) on delete set null,
  contract_id                 uuid                          references contracts (id) on delete set null,
  party_type                  contract_party_type            not null,
  customer_id                 uuid                          references rental_customers (id) on delete set null,
  operator_id                 uuid,
  blueprint_id                text                          not null,
  asset_type_id               uuid                          references asset_types (id) on delete set null,
  operation_type              text,
  operator_required           boolean                       not null default false,
  operator_included           boolean                       not null default false,
  tracking_enabled            boolean                       not null default false,
  insurance_type              text,
  pricing_model                text,
  jurisdiction                text,
  consumer_relationship       consumer_relationship_type     not null default 'undetermined',
  data_processing_legal_basis data_processing_legal_basis,
  resolved_template_id        uuid                          references tenant_contract_templates (id),
  resolved_version_id         uuid                          references tenant_contract_versions (id),
  required_clause_keys        text[]                        not null default '{}',
  resolved_at                 timestamptz                   not null default now()
);

create index tenant_contract_requirements_tenant_id_idx on tenant_contract_requirements (tenant_id);
create index tenant_contract_requirements_contract_id_idx on tenant_contract_requirements (contract_id);

-- ── Snapshot (immutable, rendered content at generation time) ──────────────
create table tenant_contract_snapshots (
  id                  uuid          primary key default gen_random_uuid(),
  tenant_id           uuid          not null references tenants (id) on delete cascade,
  contract_id         uuid          not null references contracts (id) on delete cascade,
  template_version_id uuid          not null references tenant_contract_versions (id),
  rendered_content    text          not null,
  content_hash        text          not null,
  created_at          timestamptz   not null default now()
);

create index tenant_contract_snapshots_tenant_id_idx on tenant_contract_snapshots (tenant_id);
create index tenant_contract_snapshots_contract_id_idx on tenant_contract_snapshots (contract_id);

-- ── Acceptance evidence ──────────────────────────────────────────────────────
-- accepted_at/ip_address/user_agent always stamped by the backend from the
-- request context, never accepted from the request body (same rule already
-- applied twice this session for commercial_flow.sql's acceptances).
create table tenant_contract_acceptances (
  id                          uuid                          primary key default gen_random_uuid(),
  tenant_id                   uuid                          not null references tenants (id) on delete cascade,
  party_type                  contract_party_type            not null,
  customer_id                 uuid                          references rental_customers (id) on delete set null,
  operator_id                 uuid,
  user_id                     uuid                          not null,
  operation_id                uuid                          references operations (id) on delete set null,
  contract_id                 uuid                          not null references contracts (id) on delete cascade,
  contract_version_id         uuid                          not null references tenant_contract_versions (id),
  snapshot_id                 uuid                          not null references tenant_contract_snapshots (id),
  accepted_at                 timestamptz                   not null default now(),
  ip_address                  inet,
  user_agent                  text,
  session_id                  text,
  document_hash               text                          not null,
  acceptance_method            contract_acceptance_method    not null,
  consented_data_processing   boolean                       not null default false,
  metadata                    jsonb                         not null default '{}'
);

create index tenant_contract_acceptances_tenant_id_idx on tenant_contract_acceptances (tenant_id);
create index tenant_contract_acceptances_contract_id_idx on tenant_contract_acceptances (contract_id);
create index tenant_contract_acceptances_customer_id_idx on tenant_contract_acceptances (customer_id);
create index tenant_contract_acceptances_operator_id_idx on tenant_contract_acceptances (operator_id);

-- ── Document requirements ────────────────────────────────────────────────────
create table contract_document_requirements (
  id            uuid          primary key default gen_random_uuid(),
  template_id   uuid          not null references tenant_contract_templates (id) on delete cascade,
  key           text          not null,
  label         text          not null,
  is_mandatory  boolean       not null default true,
  created_at    timestamptz   not null default now()
);

create unique index contract_document_requirements_unique
  on contract_document_requirements (template_id, key);

create table contract_documents (
  id                  uuid                        primary key default gen_random_uuid(),
  tenant_id           uuid                        not null references tenants (id) on delete cascade,
  party_type          contract_party_type          not null,
  customer_id         uuid                        references rental_customers (id) on delete set null,
  operator_id         uuid,
  requirement_id      uuid                        not null references contract_document_requirements (id),
  contract_id         uuid                        references contracts (id) on delete cascade,
  storage_path        text                        not null,
  original_filename   text                        not null,
  status              contract_document_status    not null default 'pending',
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  review_notes        text,
  uploaded_at         timestamptz                 not null default now()
);

create index contract_documents_tenant_id_idx on contract_documents (tenant_id);
create index contract_documents_contract_id_idx on contract_documents (contract_id);
create index contract_documents_customer_id_idx on contract_documents (customer_id);
create index contract_documents_operator_id_idx on contract_documents (operator_id);

-- ── Operator entity (new — no existing "person" entity for operators;
-- `resources` models equipment, not people) ─────────────────────────────────
create table operators (
  id             uuid              primary key default gen_random_uuid(),
  tenant_id      uuid              not null references tenants (id) on delete cascade,
  auth_user_id   uuid,
  full_name      text              not null,
  document       text,
  phone          text,
  email          text,
  certifications jsonb             not null default '[]',
  status         operator_status   not null default 'active',
  created_at     timestamptz       not null default now(),
  updated_at     timestamptz       not null default now()
);

create index operators_tenant_id_idx on operators (tenant_id);
create unique index operators_auth_user_id_unique
  on operators (auth_user_id) where auth_user_id is not null;

alter table tenant_contract_requirements
  add constraint tenant_contract_requirements_operator_fk
    foreign key (operator_id) references operators (id) on delete set null;
alter table tenant_contract_acceptances
  add constraint tenant_contract_acceptances_operator_fk
    foreign key (operator_id) references operators (id) on delete set null;
alter table contract_documents
  add constraint contract_documents_operator_fk
    foreign key (operator_id) references operators (id) on delete set null;

create table operator_assignments (
  id            uuid                          primary key default gen_random_uuid(),
  tenant_id     uuid                          not null references tenants (id) on delete cascade,
  operator_id   uuid                          not null references operators (id) on delete cascade,
  operation_id  uuid                          references operations (id) on delete set null,
  asset_id      uuid                          references assets (id) on delete set null,
  role          text,
  assigned_at   timestamptz                   not null default now(),
  status        operator_assignment_status    not null default 'assigned'
);

create index operator_assignments_tenant_id_idx on operator_assignments (tenant_id);
create index operator_assignments_operator_id_idx on operator_assignments (operator_id);
create index operator_assignments_operation_id_idx on operator_assignments (operation_id);

-- ── Extend `contracts` (M27) — nullable, non-retroactive ────────────────────
alter table contracts
  add column if not exists template_id uuid references tenant_contract_templates (id),
  add column if not exists template_version_id uuid references tenant_contract_versions (id),
  add column if not exists snapshot_id uuid references tenant_contract_snapshots (id),
  add column if not exists billing_requirement jsonb not null default '{}',
  add column if not exists marketplace_transaction_id uuid,
  add column if not exists provider_tenant_id uuid,
  add column if not exists requester_id uuid;

-- ── Extend `invoices` (M29) — links a billing requirement to the real
-- invoice the tenant marks as paid (registro/controle only, no new payment
-- collection this round). ────────────────────────────────────────────────────
alter table invoices
  add column if not exists contract_id uuid references contracts (id);

create index if not exists invoices_contract_id_idx on invoices (contract_id);

-- ── Private document storage bucket (first private bucket in the project —
-- the only existing one, tenant-branding, is public) ────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contract-documents',
  'contract-documents',
  false,
  10485760, -- 10 MiB
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do nothing;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Global catalog (tenant_id is null): readable by any authenticated user
-- (staff, customer, or operator all need to read clause/template text to
-- display/accept), never anonymous — deliberately narrower than
-- plans/contract_templates in commercial_flow.sql, which is a public
-- marketing catalog; this is an internal legal library.
alter table tenant_contract_clauses enable row level security;
alter table tenant_contract_clauses force row level security;
create policy "tenant_contract_clauses_select_global" on tenant_contract_clauses for select
  to authenticated using (tenant_id is null);
create policy "tenant_contract_clauses_select_tenant" on tenant_contract_clauses for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table tenant_contract_templates enable row level security;
alter table tenant_contract_templates force row level security;
create policy "tenant_contract_templates_select_global" on tenant_contract_templates for select
  to authenticated using (tenant_id is null);
create policy "tenant_contract_templates_select_tenant" on tenant_contract_templates for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table tenant_contract_template_clauses enable row level security;
alter table tenant_contract_template_clauses force row level security;
create policy "tenant_contract_template_clauses_select" on tenant_contract_template_clauses for select
  to authenticated using (
    template_id in (
      select id from tenant_contract_templates
      where tenant_id is null or tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

alter table tenant_contract_versions enable row level security;
alter table tenant_contract_versions force row level security;
create policy "tenant_contract_versions_select" on tenant_contract_versions for select
  to authenticated using (
    template_id in (
      select id from tenant_contract_templates
      where tenant_id is null or tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

alter table blueprint_contract_mappings enable row level security;
alter table blueprint_contract_mappings force row level security;
create policy "blueprint_contract_mappings_select" on blueprint_contract_mappings for select
  to authenticated using (true);

alter table tenant_contract_requirements enable row level security;
alter table tenant_contract_requirements force row level security;
create policy "tenant_contract_requirements_select_tenant" on tenant_contract_requirements for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table tenant_contract_snapshots enable row level security;
alter table tenant_contract_snapshots force row level security;
create policy "tenant_contract_snapshots_select_tenant" on tenant_contract_snapshots for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "tenant_contract_snapshots_select_customer" on tenant_contract_snapshots for select
  to authenticated using (
    contract_id in (
      select c.id from contracts c
      join rental_customer_organizations rco on rco.organization_id = c.organization_id
      join rental_customers rc on rc.id = rco.rental_customer_id
      where rc.auth_user_id = auth.uid()
    )
  );

alter table tenant_contract_acceptances enable row level security;
alter table tenant_contract_acceptances force row level security;
create policy "tenant_contract_acceptances_select_tenant" on tenant_contract_acceptances for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "tenant_contract_acceptances_select_customer" on tenant_contract_acceptances for select
  to authenticated using (
    customer_id in (select id from rental_customers where auth_user_id = auth.uid())
  );
create policy "tenant_contract_acceptances_select_operator" on tenant_contract_acceptances for select
  to authenticated using (
    operator_id in (select id from operators where auth_user_id = auth.uid())
  );

alter table contract_document_requirements enable row level security;
alter table contract_document_requirements force row level security;
create policy "contract_document_requirements_select" on contract_document_requirements for select
  to authenticated using (
    template_id in (
      select id from tenant_contract_templates
      where tenant_id is null or tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

alter table contract_documents enable row level security;
alter table contract_documents force row level security;
create policy "contract_documents_select_tenant" on contract_documents for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "contract_documents_select_customer" on contract_documents for select
  to authenticated using (
    customer_id in (select id from rental_customers where auth_user_id = auth.uid())
  );
create policy "contract_documents_select_operator" on contract_documents for select
  to authenticated using (
    operator_id in (select id from operators where auth_user_id = auth.uid())
  );
create policy "contract_documents_insert_customer" on contract_documents for insert
  to authenticated with check (
    customer_id in (select id from rental_customers where auth_user_id = auth.uid())
  );

alter table operators enable row level security;
alter table operators force row level security;
create policy "operators_select_tenant" on operators for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "operators_select_self" on operators for select
  to authenticated using (auth_user_id = auth.uid());

alter table operator_assignments enable row level security;
alter table operator_assignments force row level security;
create policy "operator_assignments_select_tenant" on operator_assignments for select
  to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "operator_assignments_select_self" on operator_assignments for select
  to authenticated using (
    operator_id in (select id from operators where auth_user_id = auth.uid())
  );

-- ── IAM ──────────────────────────────────────────────────────────────────────
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (values
  ('tenant.contract_templates.view', 'contract_templates', 'view', 'Ver templates de contrato'),
  ('tenant.contract_templates.create', 'contract_templates', 'create', 'Criar templates de contrato'),
  ('tenant.contract_templates.edit', 'contract_templates', 'edit', 'Editar templates de contrato'),
  ('tenant.contract_templates.publish', 'contract_templates', 'publish', 'Publicar versão de template'),
  ('tenant.contracts.view', 'contracts', 'view', 'Ver contratos'),
  ('tenant.contracts.cancel', 'contracts', 'cancel', 'Cancelar contratos'),
  ('tenant.contracts.audit', 'contracts', 'audit', 'Auditar contratos'),
  ('customer.contracts.view', 'customer_contracts', 'view', 'Cliente: ver próprios contratos'),
  ('customer.contracts.accept', 'customer_contracts', 'accept', 'Cliente: aceitar contrato')
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
    'tenant.contract_templates.view', 'tenant.contract_templates.create',
    'tenant.contract_templates.edit', 'tenant.contract_templates.publish',
    'tenant.contracts.view', 'tenant.contracts.cancel', 'tenant.contracts.audit'
  )
on conflict do nothing;
