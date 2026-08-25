-- Inspection Engine — Production Completion (V1 Comercial)
-- Ver INSPECTION_PRODUCTION_COMPLETION_PLAN.md §3 para as decisões por trás de cada peça.

-- ── inspection_signatures.report_id vira opcional ──────────────────────────
-- Motivo: no fluxo real (item 15 do spec) o operador assina o checklist
-- ANTES do laudo formal existir (laudo só é gerado de uma inspeção
-- "completed", que exige aprovação de staff). Exigir report_id not null
-- forçaria a assinatura do operador a esperar uma aprovação de staff que
-- ainda não aconteceu. document_hash continua not null (sempre presente,
-- vem do checklist quando não há report ainda, ou do report quando há).
alter table inspection_signatures alter column report_id drop not null;

-- ── Preexisting vs New finding (item 17 do spec) ────────────────────────────
alter table inspection_findings
  add column preexisting_finding_id uuid references inspection_findings (id) on delete set null;
comment on column inspection_findings.preexisting_finding_id is
  'Quando setado, este finding (tipicamente de um check-out) referencia um finding já '
  'registrado num check-in anterior — nunca aparece como avaria nova. Self-FK, nunca '
  'circular por construção (só setado no momento da criação do finding do check-out).';

-- ── Contestação do cliente (item 5 do spec) ─────────────────────────────────
-- Entidade própria, não um Finding forçado — ver decisão 2 do plano.
create type inspection_dispute_status as enum
  ('open', 'under_review', 'accepted', 'rejected', 'resolved');

create table inspection_disputes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  inspection_id uuid not null references inspections (id) on delete cascade,
  item_id uuid references inspection_template_items (id) on delete set null,
  customer_id uuid not null references rental_customers (id) on delete cascade,
  description text not null,
  status inspection_dispute_status not null default 'open',
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inspection_disputes_inspection_id_idx on inspection_disputes (inspection_id);
create index inspection_disputes_tenant_id_idx on inspection_disputes (tenant_id);

alter table inspection_disputes enable row level security;
alter table inspection_disputes force row level security;
create policy "inspection_disputes_select_tenant" on inspection_disputes
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── Laudo: verificação pública (item 8) + compartilhamento seguro (item 9) ──
-- gen_random_bytes() precisaria de pgcrypto no schema public, não
-- habilitado neste projeto (mesma constatação já registrada em
-- 20260062000000) — dois gen_random_uuid() concatenados (nativo, sem
-- extensão) dão entropia equivalente para um token público de verificação.
alter table inspection_reports
  add column verification_token text not null default replace(
    gen_random_uuid()::text || gen_random_uuid()::text,
    '-',
    ''
  );
create unique index inspection_reports_verification_token_idx
  on inspection_reports (verification_token);
comment on column inspection_reports.verification_token is
  'Token público de alta entropia embutido no QR code do PDF. A rota de '
  'verificação retorna só metadados mínimos (numero/data/hash/status) — '
  'nunca mídia ou dados pessoais. Não é mecanismo de acesso, só de prova '
  'de integridade.';

create table inspection_report_shares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  report_id uuid not null references inspection_reports (id) on delete cascade,
  inspection_id uuid not null references inspections (id) on delete cascade,
  token_hash text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer not null default 0
);
create unique index inspection_report_shares_token_hash_idx on inspection_report_shares (token_hash);
create index inspection_report_shares_report_id_idx on inspection_report_shares (report_id);
create index inspection_report_shares_tenant_id_idx on inspection_report_shares (tenant_id);
comment on column inspection_report_shares.token_hash is
  'SHA-256 do token real — o token em claro nunca é persistido (mesmo '
  'princípio de um password hash: um dump do banco não deve virar acesso '
  'aos laudos). Comparação sempre por hash do token recebido.';

alter table inspection_report_shares enable row level security;
alter table inspection_report_shares force row level security;
create policy "inspection_report_shares_select_tenant" on inspection_report_shares
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── IAM ──────────────────────────────────────────────────────────────────
-- Mesmo padrão exato de 20260098000000 (key/resource/action/name/is_system).
-- customer.inspections.view/accept já existem (seedados lá) — o `where not
-- exists` os pula sem erro; só tenant.inspections.share e
-- customer.inspections.dispute são realmente novos aqui.
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.inspections.share', 'inspections', 'share', 'Compartilhar laudo de vistoria'),
    ('customer.inspections.view', 'customer_inspections', 'view', 'Cliente: ver vistoria'),
    ('customer.inspections.accept', 'customer_inspections', 'accept', 'Cliente: assinar/aceitar vistoria'),
    ('customer.inspections.dispute', 'customer_inspections', 'dispute', 'Cliente: contestar vistoria')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key = 'tenant.inspections.share'
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );
