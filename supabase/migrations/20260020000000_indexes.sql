-- M020: Non-unique cross-table indexes (BTREE unless noted)
-- tenant_id indexes are critical for RLS performance — every filtered scan needs them
-- All unique indexes are defined in their respective table migration files

-- ── tenants ───────────────────────────────────────────────────────────────────
-- (No additional non-unique indexes needed — slug UNIQUE is sufficient)

-- ── branches ──────────────────────────────────────────────────────────────────
-- Defined in M004: tenant_id, parent_id indexes already exist

-- ── persons ───────────────────────────────────────────────────────────────────
-- Defined in M005: tenant_id index already exists

-- ── organizations ─────────────────────────────────────────────────────────────
-- Defined in M006: tenant_id index already exists

-- ── asset_types ───────────────────────────────────────────────────────────────
-- Defined in M007: tenant_id index already exists

-- ── assets ────────────────────────────────────────────────────────────────────
-- Defined in M008: tenant_id, branch_id indexes already exist

-- ── resources ─────────────────────────────────────────────────────────────────
-- Defined in M009: tenant_id, branch_id indexes already exist

-- ── capabilities ──────────────────────────────────────────────────────────────
-- Defined in M010: tenant_id index already exists

-- ── operations ────────────────────────────────────────────────────────────────
-- Defined in M011: tenant_id, tenant+status, resource+schedule indexes already exist

-- ── allocations ───────────────────────────────────────────────────────────────
-- Defined in M012: tenant_id, resource+period, asset+period indexes already exist

-- ── contracts ─────────────────────────────────────────────────────────────────
-- Defined in M013: tenant_id, organization_id indexes already exist
create index if not exists contracts_tenant_status_idx on contracts (tenant_id, status);

-- ── billing_accounts ──────────────────────────────────────────────────────────
-- Defined in M014: tenant_id, organization_id indexes already exist
create index if not exists billing_accounts_tenant_status_idx
  on billing_accounts (tenant_id, status);

-- ── invoices ──────────────────────────────────────────────────────────────────
-- Defined in M015: tenant_id, billing_account+status indexes already exist
create index if not exists invoices_tenant_due_date_idx on invoices (tenant_id, due_date);

-- ── invoice_line_items ────────────────────────────────────────────────────────
-- Defined in M015: invoice_id, tenant_id indexes already exist

-- ── notifications ─────────────────────────────────────────────────────────────
-- Defined in M016: tenant_id, tenant+status, person_id indexes already exist

-- ── workflow_definitions ──────────────────────────────────────────────────────
-- Defined in M017: tenant_id index already exists
create index if not exists workflow_definitions_tenant_status_idx
  on workflow_definitions (tenant_id, status);

-- ── workflow_steps ────────────────────────────────────────────────────────────
-- Defined in M017: definition_id, tenant_id indexes already exist

-- ── rule_sets ─────────────────────────────────────────────────────────────────
-- Defined in M018: tenant_id index already exists

-- ── rule_set_rules ────────────────────────────────────────────────────────────
-- Defined in M018: rule_set_id, tenant_id indexes already exist
create index if not exists rule_set_rules_priority_idx
  on rule_set_rules (rule_set_id, priority);

-- ── events.domain_events ──────────────────────────────────────────────────────
create index if not exists domain_events_aggregate_idx
  on events.domain_events (aggregate_id, event_type);

-- Outbox worker polling: only unpublished events
create index if not exists domain_events_unpublished_idx
  on events.domain_events (published_at)
  where published_at is null;

create index if not exists domain_events_tenant_id_idx
  on events.domain_events (tenant_id);

create index if not exists domain_events_occurred_at_idx
  on events.domain_events (occurred_at);
