-- Maintenance module (P0) — docs/modules/MAINTENANCE.md /
-- docs/architecture/ASSET_INTELLIGENCE.md carry the architecture
-- assessment. This migration is the P0 slice only: order/items/plans/
-- documents. Health score, anomalies, recommendations, document AI,
-- copilot, auditor and predictive risk are P1/P2, not built this round
-- (documented as pending, not silently dropped).
--
-- Reuses, never duplicates:
--   - organizations (type='supplier') as the supplier entity -- no new
--     MaintenanceSupplier table, per the spec's own explicit instruction.
--   - contracts/rental_customers/operators/branches as-is.
--   - assets gains odometer/hour_meter as real nullable columns, same
--     precedent as plate/renavam (20260105000000): generic across every
--     asset category (vehicle, forklift, crane, ...), never vehicle-only.
--   - the private-bucket + tenant-scoped-table RLS idiom already used by
--     inspection-media/contract-documents/infraction-documents.

alter table assets
  add column odometer numeric,
  add column hour_meter numeric;

create type maintenance_order_type as enum (
  'preventive', 'corrective', 'predictive', 'inspection_generated', 'emergency'
);

create type maintenance_order_status as enum (
  'scheduled', 'awaiting_approval', 'approved', 'in_progress', 'completed', 'cancelled'
);

create type maintenance_plan_trigger_type as enum (
  'date', 'odometer', 'hour_meter', 'condition', 'combined'
);

create type maintenance_document_kind as enum (
  'budget', 'invoice', 'work_order', 'report', 'receipt', 'image', 'warranty', 'other'
);

-- ── maintenance_orders ──────────────────────────────────────────────────
create table maintenance_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete restrict,
  contract_id uuid references contracts (id) on delete set null,
  customer_id uuid references rental_customers (id) on delete set null,
  operator_id uuid references operators (id) on delete set null,
  -- Not a hard FK to organizations(type='supplier') -- a check constraint
  -- can't cheaply enforce "the referenced org is actually a supplier"
  -- without a trigger, and the app-layer query that resolves a supplier
  -- picker already filters by type; a plain FK to organizations is
  -- enough to prevent a dangling reference.
  supplier_id uuid references organizations (id) on delete set null,
  branch_id uuid references branches (id) on delete set null,

  type maintenance_order_type not null,
  status maintenance_order_status not null default 'scheduled',

  opened_at timestamptz not null default now(),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,

  odometer numeric,
  hour_meter numeric,

  description text not null,
  diagnosis text,
  cause text,
  resolution text,

  labor_cost_cents integer not null default 0,
  parts_cost_cents integer not null default 0,
  other_cost_cents integer not null default 0,
  total_cost_cents integer generated always as
    (labor_cost_cents + parts_cost_cents + other_cost_cents) stored,

  downtime_start timestamptz,
  downtime_end timestamptz,

  -- Etapa 9 (Vistoria -> Manutenção): a maintenance order created from an
  -- inspection finding keeps a reference, never duplicates the finding
  -- itself. Free-text type instead of an enum/FK -- the only source kind
  -- built this round is "inspection_finding", but the shape stays open
  -- for tracking/rule-based sources later without a schema change.
  source_type text,
  source_id uuid,

  created_by uuid not null,
  approved_by uuid,
  completed_by uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint maintenance_orders_costs_non_negative
    check (labor_cost_cents >= 0 and parts_cost_cents >= 0 and other_cost_cents >= 0),
  constraint maintenance_orders_downtime_range
    check (downtime_end is null or downtime_start is null or downtime_end >= downtime_start)
);

create index maintenance_orders_tenant_id_idx on maintenance_orders (tenant_id) where deleted_at is null;
create index maintenance_orders_asset_id_idx on maintenance_orders (asset_id) where deleted_at is null;
create index maintenance_orders_contract_id_idx on maintenance_orders (contract_id) where deleted_at is null;
create index maintenance_orders_supplier_id_idx on maintenance_orders (supplier_id) where deleted_at is null;
create index maintenance_orders_status_idx on maintenance_orders (tenant_id, status) where deleted_at is null;
create index maintenance_orders_opened_at_idx on maintenance_orders (opened_at desc);

-- ── maintenance_items ────────────────────────────────────────────────────
create table maintenance_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  maintenance_order_id uuid not null references maintenance_orders (id) on delete cascade,

  component text not null,
  service_type text not null,
  description text not null,
  part_number text,
  quantity numeric,
  unit_cost_cents integer,
  labor_cost_cents integer,
  warranty_until timestamptz,
  warranty_km numeric,
  warranty_hours numeric,

  created_at timestamptz not null default now()
);

create index maintenance_items_order_id_idx on maintenance_items (maintenance_order_id);
-- Etapa 6/9 (recurrence detection needs "same component, same asset,
-- over time" without an N+1 join through maintenance_orders every time).
create index maintenance_items_tenant_component_idx on maintenance_items (tenant_id, component);

-- ── maintenance_plans ────────────────────────────────────────────────────
-- Preventive schedule. Either per-asset or per-asset-type (fleet-wide
-- default) -- exactly one of asset_id/asset_type_id is expected to be
-- set, enforced at the app layer (a DB check across two nullable FKs
-- with an XOR is possible but adds little here; the resolver in
-- packages/maintenance-engine already has to handle "no plan matched"
-- cleanly regardless).
create table maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  asset_id uuid references assets (id) on delete cascade,
  asset_type_id uuid references asset_types (id) on delete cascade,

  name text not null,
  trigger_type maintenance_plan_trigger_type not null,

  interval_days integer,
  interval_odometer numeric,
  interval_hour_meter numeric,
  condition_notes text,

  last_triggered_at timestamptz,
  last_triggered_odometer numeric,
  last_triggered_hour_meter numeric,

  active boolean not null default true,

  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index maintenance_plans_tenant_id_idx on maintenance_plans (tenant_id) where deleted_at is null;
create index maintenance_plans_asset_id_idx on maintenance_plans (asset_id) where deleted_at is null;
create index maintenance_plans_asset_type_id_idx on maintenance_plans (asset_type_id) where deleted_at is null;

-- ── maintenance_documents ────────────────────────────────────────────────
create table maintenance_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  maintenance_order_id uuid not null references maintenance_orders (id) on delete cascade,
  kind maintenance_document_kind not null default 'other',
  storage_path text not null,
  original_filename text,
  -- Etapa 12 (Document AI, P1 -- not built this round): columns exist now
  -- so a future extraction pass doesn't need a schema migration of its
  -- own, but nothing writes them yet.
  extraction_confidence numeric(4, 3),
  extraction_model text,
  extracted_at timestamptz,
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);

create index maintenance_documents_order_id_idx on maintenance_documents (maintenance_order_id);

-- ── Storage bucket ───────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-documents', 'maintenance-documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ── RLS (idiom 2: select-only for tenant staff via JWT tenant_id; writes
-- only via API routes using the admin client + hasTenantPermission()) ───
alter table maintenance_orders enable row level security;
alter table maintenance_orders force row level security;
create policy maintenance_orders_select_tenant on maintenance_orders
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table maintenance_items enable row level security;
alter table maintenance_items force row level security;
create policy maintenance_items_select_tenant on maintenance_items
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table maintenance_plans enable row level security;
alter table maintenance_plans force row level security;
create policy maintenance_plans_select_tenant on maintenance_plans
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table maintenance_documents enable row level security;
alter table maintenance_documents force row level security;
create policy maintenance_documents_select_tenant on maintenance_documents
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── IAM (Etapa 18) ───────────────────────────────────────────────────────
-- Seeded per the spec's full list; only the P0 keys are actually
-- enforced by a route this round (maintenance.view/create/update/
-- approve/complete). analytics/ai/documents keys exist now so the
-- roles/permissions UI can show them and a later phase doesn't need a
-- second IAM migration, but nothing checks them yet -- documented in
-- docs/modules/MAINTENANCE.md, not silently pretended-enforced.
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.maintenance.view', 'maintenance', 'view', 'Ver manutenções'),
    ('tenant.maintenance.create', 'maintenance', 'create', 'Registrar manutenção'),
    ('tenant.maintenance.update', 'maintenance', 'update', 'Editar manutenção'),
    ('tenant.maintenance.approve', 'maintenance', 'approve', 'Aprovar manutenção'),
    ('tenant.maintenance.complete', 'maintenance', 'complete', 'Concluir manutenção'),
    ('tenant.maintenance.analytics_view', 'maintenance', 'analytics_view', 'Ver analytics de manutenção'),
    ('tenant.maintenance.ai_use', 'maintenance', 'ai_use', 'Usar IA de manutenção'),
    ('tenant.maintenance.documents_extract', 'maintenance', 'documents_extract', 'Extrair documentos de manutenção'),
    ('tenant.maintenance.admin', 'maintenance', 'admin', 'Administrar manutenção')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key like 'tenant.maintenance.%'
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );
