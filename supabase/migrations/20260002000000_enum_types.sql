-- M002: All PostgreSQL ENUM types used across the schema
-- 23 types covering all domain aggregates

-- ── Tenant ────────────────────────────────────────────────────────────────────
create type tenant_plan as enum ('starter', 'professional', 'enterprise');

create type tenant_status as enum ('trialing', 'active', 'suspended', 'cancelled');

-- ── Branch ────────────────────────────────────────────────────────────────────
create type branch_scope_mode as enum (
  'root',
  'branch',
  'branch_and_children',
  'custom'
);

-- ── Person ────────────────────────────────────────────────────────────────────
create type person_status as enum ('active', 'inactive', 'blocked');

-- ── Organization ──────────────────────────────────────────────────────────────
create type organization_type as enum ('customer', 'supplier', 'partner', 'internal');

-- ── Asset ─────────────────────────────────────────────────────────────────────
create type asset_category as enum (
  'vehicle',
  'equipment',
  'tool',
  'property',
  'technology'
);

create type asset_status as enum (
  'available',
  'in_use',
  'maintenance',
  'decommissioned'
);

-- ── Resource ──────────────────────────────────────────────────────────────────
create type resource_type as enum ('human', 'vehicle', 'equipment', 'virtual');

create type resource_status as enum ('available', 'busy', 'offline', 'suspended');

-- ── Capability ────────────────────────────────────────────────────────────────
create type capability_scope as enum ('global', 'tenant', 'branch', 'resource');

-- ── Operation ─────────────────────────────────────────────────────────────────
create type operation_type as enum (
  'delivery',
  'pickup',
  'maintenance',
  'inspection',
  'transfer'
);

create type operation_status as enum (
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'failed'
);

-- ── Allocation ────────────────────────────────────────────────────────────────
create type allocation_status as enum ('reserved', 'active', 'completed', 'cancelled');

-- ── Contract ──────────────────────────────────────────────────────────────────
create type contract_type as enum (
  'service',
  'rental',
  'lease',
  'subscription',
  'one_time'
);

create type contract_status as enum (
  'draft',
  'active',
  'expired',
  'terminated',
  'suspended'
);

-- ── Billing ───────────────────────────────────────────────────────────────────
create type billing_cycle as enum ('monthly', 'quarterly', 'annual', 'one_time');

create type billing_account_status as enum ('active', 'suspended', 'closed');

create type invoice_status as enum (
  'draft',
  'issued',
  'paid',
  'overdue',
  'cancelled',
  'voided'
);

-- ── Notification ──────────────────────────────────────────────────────────────
create type notification_channel as enum ('email', 'sms', 'push', 'in_app', 'webhook');

create type notification_status as enum ('pending', 'sent', 'delivered', 'failed', 'read');

create type notification_priority as enum ('low', 'normal', 'high', 'critical');

-- ── Workflow ──────────────────────────────────────────────────────────────────
create type workflow_status as enum ('draft', 'active', 'inactive', 'deprecated');

-- ── RuleSet ───────────────────────────────────────────────────────────────────
create type rule_set_status as enum ('draft', 'active', 'inactive');
