-- Shinã Inspection Engine — schema completo. Ver docs/architecture/
-- INSPECTION_ENGINE.md (Fase A) para o Architecture Assessment e as
-- decisões que motivam cada escolha abaixo.
--
-- Decisões de escopo desta migration (documentadas, não silenciosas):
-- 1. Sem tabela de "audit events" própria — segue o padrão real do resto
--    do domínio (tenant_activity_log + logActivity(), nunca events.
--    domain_events, que é um outbox sem produtor/worker). Evidência
--    jurídica de aceite/assinatura tem tabela própria (inspection_
--    signatures), espelhando tenant_contract_acceptances.
-- 2. Templates NÃO têm versionamento imutável completo tipo contract-
--    engine (tenant_contract_versions) — status draft/published/archived
--    + version int na própria linha. Trade-off aceito por escopo; um
--    template publicado que muda de novo gira a versão mas não mantém um
--    histórico de versões anteriores navegável. Se isso virar requisito
--    real (ex.: laudo precisa apontar para a versão exata do template
--    usada), promover para o padrão completo depois.
-- 3. Nenhuma policy de RLS dá acesso direto a cliente/operador via
--    auth.uid() — todo acesso customer-facing passa por rota de API com
--    requireMobileContext()/service-role, mesmo padrão desta sessão
--    (Customer Portal RLS→API migration). RLS aqui é só idioma 2
--    (select-only staff) e idioma 5 (catálogo global + overlay de
--    tenant) — nunca idioma 3/4 (auth.uid() chain).

-- ── Enums ────────────────────────────────────────────────────────────────

create type inspection_type as enum (
  'pre_delivery', 'check_in', 'check_out', 'return',
  'periodic', 'maintenance', 'damage', 'custom'
);

create type inspection_status as enum (
  'draft', 'in_progress', 'pending_review', 'completed', 'rejected', 'abandoned'
);

create type inspection_template_status as enum ('draft', 'published', 'archived');

create type inspection_field_type as enum (
  'text', 'textarea', 'number', 'boolean',
  'single_select', 'multi_select', 'condition',
  'odometer', 'hour_meter', 'percentage',
  'signature', 'photo', 'multi_photo', 'video', 'document'
);

-- Papel do template num par check-in/check-out — usado só pelo mapeamento
-- blueprint→template (blueprint_inspection_mappings). Um mesmo template
-- pode servir os dois papéis (checklist idêntico na saída e no retorno é
-- o caso comum, necessário para a comparação item-a-item fazer sentido).
create type inspection_purpose as enum ('check_in', 'check_out');

create type inspection_media_type as enum ('photo', 'video', 'document');

create type inspection_finding_severity as enum ('low', 'medium', 'high', 'critical');

-- Fluxo exato sugerido pelo spec (item 9): DETECTED é o estado inicial,
-- inclusive para constatações geradas por IA — nunca pula direto para
-- CONFIRMED/CHARGEABLE sem revisão humana (ver ai_suggested/ai_confidence
-- em inspection_findings, e o requireHumanApproval em blueprint_
-- inspection_mappings).
create type inspection_finding_status as enum (
  'detected', 'under_review', 'confirmed', 'rejected',
  'chargeable', 'waived', 'resolved'
);

create type inspection_signer_type as enum ('customer', 'operator', 'tenant_staff');

-- ── inspection_templates ────────────────────────────────────────────────
-- tenant_id null = template global da plataforma (mesmo padrão de
-- tenant_contract_templates/tenant_contract_clauses) — o tenant pode usar
-- o global direto ou clonar/publicar o seu próprio com o mesmo key.

create table inspection_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade,
  key text not null,
  name text not null,
  asset_type_id uuid references asset_types (id) on delete set null,
  status inspection_template_status not null default 'draft',
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index inspection_templates_tenant_key_idx
  on inspection_templates (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), key)
  where deleted_at is null;
create index inspection_templates_tenant_id_idx on inspection_templates (tenant_id);

-- ── inspection_template_sections ────────────────────────────────────────

create table inspection_template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references inspection_templates (id) on delete cascade,
  -- Denormalizado do template só para RLS/consulta direta (mesmo motivo
  -- documentado em invoice_line_items.tenant_id) — nunca escrito
  -- independente do valor em inspection_templates.tenant_id.
  tenant_id uuid references tenants (id) on delete cascade,
  key text not null,
  title text not null,
  instructions text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index inspection_template_sections_template_key_idx
  on inspection_template_sections (template_id, key);
create index inspection_template_sections_tenant_id_idx on inspection_template_sections (tenant_id);

-- ── inspection_template_items ───────────────────────────────────────────

create table inspection_template_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references inspection_template_sections (id) on delete cascade,
  template_id uuid not null references inspection_templates (id) on delete cascade,
  tenant_id uuid references tenants (id) on delete cascade,
  key text not null,
  label text not null,
  field_type inspection_field_type not null,
  required boolean not null default false,
  instructions text,
  reference_image_url text,
  -- Só relevante para photo/multi_photo — null nos outros field_types.
  min_photos integer,
  max_photos integer,
  -- {value, label, severity?}[] — usado por single_select/multi_select/
  -- condition. severity opcional alimenta inspection_findings quando a
  -- opção escolhida indica dano (ex.: "Danificado" → severity: "high").
  select_options jsonb,
  -- Mesma forma de tenant_contract_template_clauses.condition — {field,
  -- op, value} avaliado por evaluateCondition() (packages/tenant-
  -- contract-engine), reaproveitado aqui em vez de reimplementado.
  condition jsonb,
  -- Reprovar este item bloqueia a conclusão da vistoria (ex.: item de
  -- segurança obrigatório numa grua) — ver inspection-completion.ts.
  approval_gate boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint inspection_template_items_photos_check
    check (min_photos is null or max_photos is null or min_photos <= max_photos)
);

create unique index inspection_template_items_section_key_idx
  on inspection_template_items (section_id, key);
create index inspection_template_items_template_id_idx on inspection_template_items (template_id);
create index inspection_template_items_tenant_id_idx on inspection_template_items (tenant_id);

-- ── blueprint_inspection_mappings ───────────────────────────────────────
-- Mesma forma de blueprint_contract_mappings (20260076000000) — config
-- de banco, nunca "if (blueprintId === 'munk')" em código.

create table blueprint_inspection_mappings (
  id uuid primary key default gen_random_uuid(),
  blueprint_id text not null,
  purpose inspection_purpose not null,
  template_id uuid not null references inspection_templates (id) on delete restrict,
  is_default boolean not null default true,
  required boolean not null default true,
  -- Item 30 do spec (aiDamageDetection.enabled/requireHumanApproval) como
  -- colunas, não YAML — resolvido em runtime pelo mesmo mapeamento.
  ai_damage_detection_enabled boolean not null default false,
  ai_requires_human_approval boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index blueprint_inspection_mappings_unique_idx
  on blueprint_inspection_mappings (blueprint_id, purpose, template_id);
create index blueprint_inspection_mappings_blueprint_id_idx
  on blueprint_inspection_mappings (blueprint_id, purpose);

-- ── inspections ──────────────────────────────────────────────────────────

create table inspections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  asset_id uuid not null references assets (id) on delete cascade,
  -- Denormalizado do asset no momento da vistoria — o asset_type/
  -- blueprint do ativo pode mudar depois, o laudo não deve.
  asset_type_id uuid references asset_types (id) on delete set null,
  contract_id uuid references contracts (id) on delete set null,
  operation_id uuid references operations (id) on delete set null,
  customer_id uuid references rental_customers (id) on delete set null,
  operator_id uuid references operators (id) on delete set null,
  responsible_user_id uuid not null,
  template_id uuid not null references inspection_templates (id) on delete restrict,
  type inspection_type not null,
  status inspection_status not null default 'draft',
  -- Autorreferência para parear check-out.linked_inspection_id = check-in.id
  -- — é isso que ancora a comparação BEFORE×AFTER (inspection_comparisons),
  -- em vez de inferir o par por proximidade de data.
  linked_inspection_id uuid references inspections (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index inspections_tenant_id_idx on inspections (tenant_id);
create index inspections_tenant_status_idx on inspections (tenant_id, status);
create index inspections_asset_id_idx on inspections (asset_id);
create index inspections_contract_id_idx on inspections (contract_id);
create index inspections_linked_inspection_id_idx on inspections (linked_inspection_id);
create index inspections_customer_id_idx on inspections (customer_id);

-- ── inspection_responses ────────────────────────────────────────────────

create table inspection_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  inspection_id uuid not null references inspections (id) on delete cascade,
  item_id uuid not null references inspection_template_items (id) on delete restrict,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  -- Forma completa da resposta pra select/condition (ex.: {"value":
  -- "damaged", "label": "Danificado", "severity": "high"}) — value_text/
  -- number/boolean cobrem os tipos simples, value_json cobre o resto sem
  -- precisar de uma coluna por field_type.
  value_json jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index inspection_responses_inspection_item_idx
  on inspection_responses (inspection_id, item_id);
create index inspection_responses_tenant_id_idx on inspection_responses (tenant_id);

-- ── inspection_media ─────────────────────────────────────────────────────
-- Uma linha por arquivo, nunca upsert de path único (ao contrário de
-- api/assets/[id]/photo) — histórico de evidência tem que ser imutável.

create table inspection_media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  inspection_id uuid not null references inspections (id) on delete cascade,
  item_id uuid references inspection_template_items (id) on delete set null,
  finding_id uuid,
  media_type inspection_media_type not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  -- Nunca confiar só no nome do arquivo (item 6 do spec) — hash real do
  -- conteúdo, calculado no upload, nunca aceito do cliente.
  checksum_sha256 text not null,
  captured_at timestamptz not null default now(),
  captured_by uuid not null,
  latitude double precision,
  longitude double precision,
  capture_source text not null default 'mobile_camera',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint inspection_media_size_check check (size_bytes > 0)
);

create index inspection_media_inspection_id_idx on inspection_media (inspection_id);
create index inspection_media_finding_id_idx on inspection_media (finding_id);
create index inspection_media_tenant_id_idx on inspection_media (tenant_id);

-- ── inspection_findings ──────────────────────────────────────────────────

create table inspection_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  inspection_id uuid not null references inspections (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  item_id uuid references inspection_template_items (id) on delete set null,
  -- Texto livre ("para-choque traseiro", "roda dianteira esquerda") — sem
  -- enum fechado porque o vocabulário de localização varia demais entre
  -- Asset Types (carro × empilhadeira × grua) pra caber num CHECK list.
  location_on_asset text,
  description text not null,
  category text,
  severity inspection_finding_severity not null default 'medium',
  status inspection_finding_status not null default 'detected',
  estimated_cost_amount numeric(19, 4),
  estimated_cost_currency text,
  approved_cost_amount numeric(19, 4),
  approved_cost_currency text,
  responsible_user_id uuid,
  decision_notes text,
  -- true quando a origem foi InspectionMediaComparisonProvider, não um
  -- humano marcando manualmente — status ainda começa em 'detected' de
  -- qualquer forma; isso é só proveniência, nunca um atalho de confiança.
  ai_suggested boolean not null default false,
  ai_confidence numeric,
  -- Coordenadas normalizadas (item 11 do spec) — {x, y, width, height} ou
  -- {points: [[x,y], ...]} para polígono, sempre 0..1 pra não depender da
  -- resolução da imagem original.
  overlay_region jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_findings_cost_check check (
    (estimated_cost_amount is null) = (estimated_cost_currency is null)
    and (approved_cost_amount is null) = (approved_cost_currency is null)
  )
);

alter table inspection_media
  add constraint inspection_media_finding_id_fkey
  foreign key (finding_id) references inspection_findings (id) on delete set null;

create index inspection_findings_inspection_id_idx on inspection_findings (inspection_id);
create index inspection_findings_asset_id_idx on inspection_findings (asset_id);
create index inspection_findings_tenant_status_idx on inspection_findings (tenant_id, status);

-- ── inspection_comparisons ───────────────────────────────────────────────
-- Uma linha por item comparado entre duas inspections pareadas — dá o
-- BEFORE→AFTER→DIFFERENCE item-a-item pedido no item 8 do spec sem
-- recalcular a comparação toda vez que a tela é aberta.

create table inspection_comparisons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  before_inspection_id uuid not null references inspections (id) on delete cascade,
  after_inspection_id uuid not null references inspections (id) on delete cascade,
  item_id uuid not null references inspection_template_items (id) on delete cascade,
  before_value jsonb,
  after_value jsonb,
  differs boolean not null default false,
  -- Forma exata do exemplo do item 10 do spec — {possibleDamage,
  -- confidence, region, category, severity, description}. Null quando
  -- nenhum InspectionMediaComparisonProvider real está configurado
  -- (padrão nesta fase — ver NullComparisonProvider).
  ai_analysis jsonb,
  created_at timestamptz not null default now(),
  constraint inspection_comparisons_different_inspections_check
    check (before_inspection_id <> after_inspection_id)
);

create unique index inspection_comparisons_pair_item_idx
  on inspection_comparisons (before_inspection_id, after_inspection_id, item_id);
create index inspection_comparisons_tenant_id_idx on inspection_comparisons (tenant_id);
create index inspection_comparisons_after_inspection_id_idx
  on inspection_comparisons (after_inspection_id);

-- ── inspection_reports ───────────────────────────────────────────────────
-- Snapshot imutável, mesma forma de tenant_contract_snapshots — nunca
-- sobrescrito; regenerar cria uma nova linha com version+1.

create table inspection_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  inspection_id uuid not null references inspections (id) on delete cascade,
  version integer not null default 1,
  rendered_content jsonb not null,
  content_hash text not null,
  generated_by uuid not null,
  generated_at timestamptz not null default now()
);

create unique index inspection_reports_inspection_version_idx
  on inspection_reports (inspection_id, version);
create index inspection_reports_tenant_id_idx on inspection_reports (tenant_id);

-- ── inspection_signatures ────────────────────────────────────────────────
-- Mesma forma e mesma regra de tenant_contract_acceptances: accepted_at/
-- ip_address/user_agent SEMPRE carimbados pelo backend a partir do
-- request, nunca aceitos do corpo da requisição.

create table inspection_signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  inspection_id uuid not null references inspections (id) on delete cascade,
  report_id uuid not null references inspection_reports (id) on delete restrict,
  signer_type inspection_signer_type not null,
  customer_id uuid references rental_customers (id) on delete set null,
  operator_id uuid references operators (id) on delete set null,
  user_id uuid not null,
  signed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  session_id text,
  document_hash text not null,
  acceptance_method contract_acceptance_method not null,
  metadata jsonb not null default '{}'
);

create index inspection_signatures_inspection_id_idx on inspection_signatures (inspection_id);
create index inspection_signatures_tenant_id_idx on inspection_signatures (tenant_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Idioma 2 (select-only pra staff, escrita só via service role) em tudo
-- que é operacional/evidência. Idioma 5 (catálogo global + overlay de
-- tenant) só nas tabelas de template. Nenhuma policy de auth.uid() —
-- acesso de cliente/operador é sempre via API route com
-- requireMobileContext(), nunca RLS direta (ver decisão 3 no topo).

alter table inspection_templates enable row level security;
alter table inspection_templates force row level security;
create policy "inspection_templates_select_global" on inspection_templates
  for select to authenticated using (tenant_id is null);
create policy "inspection_templates_select_tenant" on inspection_templates
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table inspection_template_sections enable row level security;
alter table inspection_template_sections force row level security;
create policy "inspection_template_sections_select_global" on inspection_template_sections
  for select to authenticated using (tenant_id is null);
create policy "inspection_template_sections_select_tenant" on inspection_template_sections
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table inspection_template_items enable row level security;
alter table inspection_template_items force row level security;
create policy "inspection_template_items_select_global" on inspection_template_items
  for select to authenticated using (tenant_id is null);
create policy "inspection_template_items_select_tenant" on inspection_template_items
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table blueprint_inspection_mappings enable row level security;
alter table blueprint_inspection_mappings force row level security;
create policy "blueprint_inspection_mappings_select" on blueprint_inspection_mappings
  for select to authenticated using (true);

alter table inspections enable row level security;
alter table inspections force row level security;
create policy "inspections_select" on inspections
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table inspection_responses enable row level security;
alter table inspection_responses force row level security;
create policy "inspection_responses_select" on inspection_responses
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table inspection_media enable row level security;
alter table inspection_media force row level security;
create policy "inspection_media_select" on inspection_media
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table inspection_findings enable row level security;
alter table inspection_findings force row level security;
create policy "inspection_findings_select" on inspection_findings
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table inspection_comparisons enable row level security;
alter table inspection_comparisons force row level security;
create policy "inspection_comparisons_select" on inspection_comparisons
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table inspection_reports enable row level security;
alter table inspection_reports force row level security;
create policy "inspection_reports_select" on inspection_reports
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table inspection_signatures enable row level security;
alter table inspection_signatures force row level security;
create policy "inspection_signatures_select" on inspection_signatures
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── IAM — permissions ────────────────────────────────────────────────────
-- Mesmo padrão de seed de 20260076000000: VALUES + where not exists pro
-- catálogo, cross join + on conflict do nothing pro grant a
-- tenant_owner/tenant_admin.

insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.inspections.view', 'inspections', 'view', 'Ver vistorias'),
    ('tenant.inspections.create', 'inspections', 'create', 'Criar vistorias'),
    ('tenant.inspections.update', 'inspections', 'update', 'Editar vistorias'),
    ('tenant.inspections.complete', 'inspections', 'complete', 'Concluir vistorias'),
    ('tenant.inspections.approve', 'inspections', 'approve', 'Aprovar laudo de vistoria'),
    ('tenant.inspections.review_damage', 'inspections', 'review_damage', 'Revisar avarias/constatações'),
    ('tenant.inspections.manage_templates', 'inspections', 'manage_templates', 'Gerenciar templates de vistoria'),
    ('customer.inspections.view', 'customer_inspections', 'view', 'Cliente: ver vistoria'),
    ('customer.inspections.accept', 'customer_inspections', 'accept', 'Cliente: assinar/aceitar vistoria')
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
    'tenant.inspections.view', 'tenant.inspections.create', 'tenant.inspections.update',
    'tenant.inspections.complete', 'tenant.inspections.approve',
    'tenant.inspections.review_damage', 'tenant.inspections.manage_templates'
  )
on conflict do nothing;
