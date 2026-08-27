-- Shinã Infractions Engine — schema (Fase B)
-- Ver docs/architecture/INFRACTIONS_ENGINE.md para as decisões arquiteturais.

-- ── assets ganha campos de identificação de veículo ─────────────────────────
-- Hoje só existiam dentro de metadata jsonb (sem índice, sem match confiável).
-- Nullable/aditivo — não é breaking change. Backfill dos valores já presentes
-- em metadata->>'plate' roda logo abaixo.
alter table assets add column plate text;
alter table assets add column renavam text;
create index assets_plate_idx on assets (tenant_id, upper(plate)) where plate is not null;
create index assets_renavam_idx on assets (tenant_id, renavam) where renavam is not null;

update assets
set plate = upper(regexp_replace(metadata->>'plate', '[^A-Za-z0-9]', '', 'g'))
where metadata ? 'plate' and plate is null;

-- ── enums ────────────────────────────────────────────────────────────────
create type infraction_source as enum
  ('manual', 'csv_import', 'senatran', 'renainf', 'serpro', 'detran', 'authority', 'partner');

create type infraction_match_confidence as enum
  ('exact_renavam', 'exact_plate', 'ambiguous', 'not_found');

create type infraction_case_status as enum (
  'received', 'matching', 'matched', 'unmatched',
  'responsibility_pending', 'responsibility_suggested', 'responsibility_confirmed',
  'notified', 'action_pending', 'disputed',
  'driver_identification_pending', 'driver_identified',
  'defense_pending', 'appealed',
  'payment_pending', 'paid', 'overdue', 'waived', 'cancelled', 'closed'
);

create type infraction_responsible_party_type as enum
  ('operator', 'customer', 'tenant', 'unknown');

create type infraction_evidence_type as enum
  ('contract', 'allocation', 'operation', 'operator_assignment', 'tracking',
   'document', 'customer_statement', 'authority_document', 'other');

create type infraction_deadline_type as enum
  ('driver_identification', 'defense', 'appeal', 'discount', 'due', 'internal');

create type infraction_deadline_status as enum
  ('open', 'due_soon', 'overdue', 'completed', 'cancelled');

create type infraction_dispute_status as enum
  ('open', 'under_review', 'accepted', 'rejected', 'resolved');

create type infraction_driver_identification_status as enum
  ('not_required', 'pending', 'ready', 'submitted', 'accepted', 'rejected', 'expired');

create type infraction_defense_kind as enum ('defense', 'appeal');
create type infraction_defense_status as enum
  ('draft', 'submitted', 'under_analysis', 'accepted', 'rejected', 'expired');

create type infraction_payment_kind as enum ('to_authority', 'reimbursement_from_responsible');

create type infraction_document_kind as enum
  ('notification', 'auto', 'invoice_slip', 'receipt', 'defense', 'appeal', 'decision',
   'driver_identification', 'other');

create type infraction_sync_status as enum ('running', 'completed', 'failed', 'partial');

-- ── infractions ──────────────────────────────────────────────────────────
-- Fato externo imutável (item 4 do spec). tenant_id fica nulo até o asset
-- matching resolver identificar o tenant — nunca inferido de outra forma.
create table infractions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade,
  source infraction_source not null,
  external_id text,
  auto_number text,
  authority_code text,
  authority_name text,
  infraction_code text,
  description text,
  plate text not null,
  renavam text,
  occurred_at timestamptz not null,
  location text,
  municipality text,
  state text,
  amount_cents integer,
  amount_currency text not null default 'BRL',
  due_date date,
  driver_identification_deadline date,
  defense_deadline date,
  payment_deadline date,
  discount_deadline date,
  external_status text,
  raw_payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid
);

-- Deduplicação (item 8 do spec): quando a fonte fornece external_id, a chave
-- é (source, external_id). Quando não fornece, cai no fallback documentado
-- (auto_number + plate + occurred_at + authority_code). Dois índices únicos
-- parciais em vez de um único composto — nenhum dos dois teria os mesmos
-- campos not-null simultaneamente.
create unique index infractions_source_external_id_idx
  on infractions (source, external_id) where external_id is not null;
create unique index infractions_fallback_dedup_idx
  on infractions (auto_number, plate, occurred_at, authority_code) where external_id is null;

create index infractions_tenant_id_idx on infractions (tenant_id);
create index infractions_plate_idx on infractions (upper(plate));
create index infractions_renavam_idx on infractions (renavam) where renavam is not null;
create index infractions_occurred_at_idx on infractions (occurred_at);

-- ── infraction_cases ─────────────────────────────────────────────────────
-- Processo operacional (item 4), 1:1 com infractions, evolui livremente
-- sem nunca reescrever o fato externo.
create table infraction_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  infraction_id uuid not null references infractions (id) on delete cascade,
  status infraction_case_status not null default 'received',

  -- Asset matching (item 9)
  asset_id uuid references assets (id) on delete set null,
  match_confidence infraction_match_confidence,

  -- Temporal matching (item 10) — qual estrutura real cobria occurred_at
  contract_id uuid references contracts (id) on delete set null,
  operation_id uuid references operations (id) on delete set null,
  allocation_id uuid references allocations (id) on delete set null,
  customer_id uuid references rental_customers (id) on delete set null,
  operator_id uuid references operators (id) on delete set null,

  -- Responsibility resolution (item 11/12) — sempre human-in-the-loop
  responsible_party_type infraction_responsible_party_type,
  responsible_party_id uuid,
  responsibility_confidence numeric(4, 3),
  responsibility_reasons jsonb not null default '[]',
  responsibility_confirmed_by uuid,
  responsibility_confirmed_at timestamptz,
  responsibility_rejected_by uuid,
  responsibility_rejected_at timestamptz,

  closed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index infraction_cases_infraction_id_idx on infraction_cases (infraction_id);
create index infraction_cases_tenant_id_idx on infraction_cases (tenant_id);
create index infraction_cases_tenant_status_idx on infraction_cases (tenant_id, status);
create index infraction_cases_asset_id_idx on infraction_cases (asset_id);
create index infraction_cases_contract_id_idx on infraction_cases (contract_id);
create index infraction_cases_customer_id_idx on infraction_cases (customer_id);
create index infraction_cases_operator_id_idx on infraction_cases (operator_id);

-- ── infraction_evidence ──────────────────────────────────────────────────
create table infraction_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  case_id uuid not null references infraction_cases (id) on delete cascade,
  type infraction_evidence_type not null,
  source text,
  reference text,
  metadata jsonb not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index infraction_evidence_case_id_idx on infraction_evidence (case_id);

-- ── infraction_deadlines ─────────────────────────────────────────────────
create table infraction_deadlines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  case_id uuid not null references infraction_cases (id) on delete cascade,
  deadline_type infraction_deadline_type not null,
  starts_at timestamptz,
  due_at timestamptz not null,
  status infraction_deadline_status not null default 'open',
  completed_at timestamptz,
  -- item 17: nunca inferir regra legal sem fonte. Quando due_at vem direto
  -- do provider/documento, source='provider'; quando calculado por regra
  -- interna, source='calculated' e rule_version/base_date ficam
  -- preenchidos para auditoria.
  source text not null default 'provider',
  rule_version text,
  base_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index infraction_deadlines_case_id_idx on infraction_deadlines (case_id);
create index infraction_deadlines_tenant_due_idx on infraction_deadlines (tenant_id, due_at)
  where status in ('open', 'due_soon');

-- ── infraction_disputes ──────────────────────────────────────────────────
-- Contestação interna (item 22) — mesma forma de inspection_disputes,
-- entidade própria em vez de reaproveitar Finding (que é do domínio de
-- vistoria, semanticamente incompatível aqui).
create table infraction_disputes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  case_id uuid not null references infraction_cases (id) on delete cascade,
  party_type infraction_responsible_party_type not null,
  party_id uuid,
  reason text,
  description text not null,
  status infraction_dispute_status not null default 'open',
  reviewed_by uuid,
  decision text,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index infraction_disputes_case_id_idx on infraction_disputes (case_id);

-- ── infraction_driver_identifications ────────────────────────────────────
create table infraction_driver_identifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  case_id uuid not null references infraction_cases (id) on delete cascade,
  -- Minimização de dado pessoal (item 47): quando o condutor é um operador
  -- já cadastrado, referencia operators.id — nada de nome/documento
  -- duplicado. Só usa os campos de texto livre quando não há cadastro.
  operator_id uuid references operators (id) on delete set null,
  driver_name text,
  driver_document text,
  status infraction_driver_identification_status not null default 'pending',
  submitted_by uuid,
  submitted_at timestamptz,
  external_protocol text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index infraction_driver_identifications_case_id_idx
  on infraction_driver_identifications (case_id);

-- ── infraction_defenses ──────────────────────────────────────────────────
create table infraction_defenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  case_id uuid not null references infraction_cases (id) on delete cascade,
  kind infraction_defense_kind not null,
  status infraction_defense_status not null default 'draft',
  external_protocol text,
  submitted_at timestamptz,
  result text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index infraction_defenses_case_id_idx on infraction_defenses (case_id);

-- ── infraction_payments ──────────────────────────────────────────────────
-- item 27: pagamento ao órgão vs. repasse ao responsável são conceitos
-- diferentes — kind distingue os dois, nunca uma única linha ambígua.
create table infraction_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  case_id uuid not null references infraction_cases (id) on delete cascade,
  kind infraction_payment_kind not null,
  amount_original_cents integer,
  amount_discounted_cents integer,
  amount_paid_cents integer,
  currency text not null default 'BRL',
  paid_at timestamptz,
  payment_method text,
  billing_reference uuid references invoices (id) on delete set null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index infraction_payments_case_id_idx on infraction_payments (case_id);

-- ── infraction_documents ─────────────────────────────────────────────────
create table infraction_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  case_id uuid not null references infraction_cases (id) on delete cascade,
  kind infraction_document_kind not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes integer,
  checksum_sha256 text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
create index infraction_documents_case_id_idx on infraction_documents (case_id);

-- ── infraction_provider_sync_runs ────────────────────────────────────────
-- item 30/31: toda sincronização (inclusive um único CSV importado) vira
-- um run, com contagem por resultado — nunca um item inválido derruba o
-- lote inteiro.
create table infraction_provider_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade,
  provider infraction_source not null,
  status infraction_sync_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  received_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  duplicated_count integer not null default 0,
  failed_count integer not null default 0,
  error_log jsonb not null default '[]',
  triggered_by uuid
);
create index infraction_provider_sync_runs_tenant_id_idx
  on infraction_provider_sync_runs (tenant_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Idioma 2 (select-only pra staff via JWT tenant_id, escrita só via service
-- role/API route) em tudo — mesmo padrão de tenant_activity_log/
-- inspection_*. Acesso de cliente/operador é sempre via API route com
-- requireMobileContext(), nunca RLS direta.

alter table infractions enable row level security;
alter table infractions force row level security;
create policy "infractions_select_tenant" on infractions
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table infraction_cases enable row level security;
alter table infraction_cases force row level security;
create policy "infraction_cases_select_tenant" on infraction_cases
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table infraction_evidence enable row level security;
alter table infraction_evidence force row level security;
create policy "infraction_evidence_select_tenant" on infraction_evidence
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table infraction_deadlines enable row level security;
alter table infraction_deadlines force row level security;
create policy "infraction_deadlines_select_tenant" on infraction_deadlines
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table infraction_disputes enable row level security;
alter table infraction_disputes force row level security;
create policy "infraction_disputes_select_tenant" on infraction_disputes
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table infraction_driver_identifications enable row level security;
alter table infraction_driver_identifications force row level security;
create policy "infraction_driver_identifications_select_tenant" on infraction_driver_identifications
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table infraction_defenses enable row level security;
alter table infraction_defenses force row level security;
create policy "infraction_defenses_select_tenant" on infraction_defenses
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table infraction_payments enable row level security;
alter table infraction_payments force row level security;
create policy "infraction_payments_select_tenant" on infraction_payments
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table infraction_documents enable row level security;
alter table infraction_documents force row level security;
create policy "infraction_documents_select_tenant" on infraction_documents
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table infraction_provider_sync_runs enable row level security;
alter table infraction_provider_sync_runs force row level security;
create policy "infraction_provider_sync_runs_select_tenant" on infraction_provider_sync_runs
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── IAM ──────────────────────────────────────────────────────────────────
-- Mesmo padrão exato de 20260098000000 (key/resource/action/name/is_system).
-- Sem namespace operator.* — decisão registrada na Fase A: autorização de
-- operador é via requireMobileContext()+posse, não permission key.
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.infractions.view', 'infractions', 'view', 'Ver infrações'),
    ('tenant.infractions.create', 'infractions', 'create', 'Registrar infrações'),
    ('tenant.infractions.import', 'infractions', 'import', 'Importar infrações (CSV)'),
    ('tenant.infractions.update', 'infractions', 'update', 'Editar infrações'),
    ('tenant.infractions.review', 'infractions', 'review', 'Revisar casos de infração'),
    ('tenant.infractions.assign_responsibility', 'infractions', 'assign_responsibility', 'Confirmar/rejeitar responsável'),
    ('tenant.infractions.manage_deadlines', 'infractions', 'manage_deadlines', 'Gerenciar prazos de infração'),
    ('tenant.infractions.manage_defense', 'infractions', 'manage_defense', 'Gerenciar defesa/recurso'),
    ('tenant.infractions.manage_payment', 'infractions', 'manage_payment', 'Gerenciar pagamento de infração'),
    ('tenant.infractions.manage_providers', 'infractions', 'manage_providers', 'Gerenciar providers de infração'),
    ('customer.infractions.view', 'customer_infractions', 'view', 'Cliente: ver infração'),
    ('customer.infractions.respond', 'customer_infractions', 'respond', 'Cliente: reconhecer/contestar infração')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key in (
    'tenant.infractions.view', 'tenant.infractions.create', 'tenant.infractions.import',
    'tenant.infractions.update', 'tenant.infractions.review',
    'tenant.infractions.assign_responsibility', 'tenant.infractions.manage_deadlines',
    'tenant.infractions.manage_defense', 'tenant.infractions.manage_payment',
    'tenant.infractions.manage_providers'
  )
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );
