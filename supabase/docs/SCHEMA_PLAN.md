# SCHEMA_PLAN.md — Supabase Schema Plan

Detailed schema plan for Milestone 3. Companion to `docs/DATABASE.md`.
No SQL has been written. This document is the source of truth for migration authorship.

---

## Schema Layout

All business tables live in the `public` schema (Supabase default).  
Event outbox lives in `public.domain_events`.  
Auth tables remain in the `auth` schema (managed by Supabase, never touched).

```
public/
  tenants
  branches
  persons
  organizations
  asset_types
  assets
  resources
  capabilities
  operations
  allocations
  contracts
  billing_accounts
  invoices
  invoice_line_items
  notifications
  workflow_definitions
  workflow_steps
  rule_sets
  rule_set_rules
  domain_events
```

---

## Extensions Required

| Extension   | Purpose                              |
| ----------- | ------------------------------------ |
| `pgcrypto`  | `gen_random_uuid()` for seeded UUIDs |
| `uuid-ossp` | `uuid_generate_v4()` (fallback)      |

Optional (decision pending):

| Extension | Purpose                               | Decision                                 |
| --------- | ------------------------------------- | ---------------------------------------- |
| `ltree`   | Materialized path for `branches` tree | Required if tree depth > 3 levels common |
| `postgis` | Coordinates for tracking/geofence     | M4+ only                                 |

---

## Value Object Mapping Rules

These rules must be applied consistently across all migrations:

### Money → two columns

```
{field}_amount   NUMERIC(19,4) NOT NULL
{field}_currency TEXT NOT NULL DEFAULT 'BRL'
```

Example: `value_amount`, `value_currency` on `contracts`.

### DateRange → two columns

```
{field}_starts_at TIMESTAMPTZ NOT NULL
{field}_ends_at   TIMESTAMPTZ NOT NULL
```

Example: `period_starts_at`, `period_ends_at` on `allocations`.
CHECK: `{field}_starts_at < {field}_ends_at`

### Email → single TEXT column

```
{field} TEXT NOT NULL
```

CHECK constraint: `{field} ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'`

### Phone → two columns

```
{field}              TEXT
{field}_country_code TEXT
```

### Address → flat columns

```
address_street        TEXT
address_number        TEXT
address_neighborhood  TEXT
address_city          TEXT NOT NULL  (when address is required)
address_state         TEXT NOT NULL
address_country       TEXT NOT NULL DEFAULT 'BR'
address_postal_code   TEXT
```

### JSONB columns (attributes, metadata, steps, rules)

- `attributes` on `asset_types`: `JSONB NOT NULL DEFAULT '{}'`
- `metadata` on `capabilities`: `JSONB NOT NULL DEFAULT '{}'`
- `payload` on `domain_events`: `JSONB NOT NULL`
- `workflow_steps` and `rule_set_rules` use separate tables (not JSONB) to enable FK and ordering.

---

## Aggregate → Table Mapping (Complete)

| Aggregate          | Table                  | Child Tables         |
| ------------------ | ---------------------- | -------------------- |
| Tenant             | `tenants`              | —                    |
| Branch             | `branches`             | —                    |
| Person             | `persons`              | —                    |
| Organization       | `organizations`        | —                    |
| AssetType          | `asset_types`          | —                    |
| Asset              | `assets`               | —                    |
| Resource           | `resources`            | —                    |
| Capability         | `capabilities`         | —                    |
| Operation          | `operations`           | —                    |
| Allocation         | `allocations`          | —                    |
| Contract           | `contracts`            | —                    |
| BillingAccount     | `billing_accounts`     | —                    |
| Invoice            | `invoices`             | `invoice_line_items` |
| Notification       | `notifications`        | —                    |
| WorkflowDefinition | `workflow_definitions` | `workflow_steps`     |
| RuleSet            | `rule_sets`            | `rule_set_rules`     |

Cross-cutting: `domain_events` (not an aggregate — event outbox)

---

## Unique Constraints Summary

| Table           | Constraint     | Columns                                                        |
| --------------- | -------------- | -------------------------------------------------------------- |
| `tenants`       | UNIQUE         | `slug`                                                         |
| `branches`      | UNIQUE         | `(tenant_id, code)`                                            |
| `persons`       | UNIQUE         | `(tenant_id, email)`                                           |
| `persons`       | UNIQUE PARTIAL | `(tenant_id, document)` WHERE `document IS NOT NULL`           |
| `organizations` | UNIQUE         | `(tenant_id, document)`                                        |
| `assets`        | UNIQUE PARTIAL | `(tenant_id, serial_number)` WHERE `serial_number IS NOT NULL` |
| `capabilities`  | UNIQUE         | `(tenant_id, key)`                                             |
| `domain_events` | UNIQUE         | `id` (eventId from domain)                                     |

---

## CHECK Constraints Summary

| Table                  | Column                | Check                                     |
| ---------------------- | --------------------- | ----------------------------------------- |
| `tenants`              | `slug`                | `slug ~* '^[a-z0-9-]+$'`                  |
| `persons`              | `email`               | email regex                               |
| `organizations`        | `email`               | email regex (nullable)                    |
| `contracts`            | `period`              | `period_starts_at < period_ends_at`       |
| `contracts`            | `value_amount`        | `value_amount >= 0`                       |
| `operations`           | `schedule`            | `scheduled_starts_at < scheduled_ends_at` |
| `allocations`          | `period`              | `period_starts_at < period_ends_at`       |
| `billing_accounts`     | `credit_limit_amount` | `credit_limit_amount >= 0`                |
| `billing_accounts`     | `balance_amount`      | `balance_amount >= 0`                     |
| `invoices`             | `total_amount`        | `total_amount >= 0`                       |
| `invoice_line_items`   | `quantity`            | `quantity > 0`                            |
| `invoice_line_items`   | `unit_price_amount`   | `unit_price_amount >= 0`                  |
| `capabilities`         | `key`                 | `key ~* '^[a-z][a-z0-9._-]*$'`            |
| `workflow_definitions` | `version`             | `version > 0`                             |
| `rule_set_rules`       | `priority`            | `priority >= 0`                           |

---

## Trigger: `set_updated_at`

A single `BEFORE UPDATE` trigger function used by all tables with `updated_at`:

```
Function name: trigger_set_updated_at()
Language:      plpgsql
Body:          NEW.updated_at = now(); RETURN NEW;
Applied to:    All tables with updated_at column
```

---

## RLS Policy Template

For all standard tenant-scoped tables:

```
Policy: {table}_tenant_isolation_select
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)

Policy: {table}_tenant_isolation_insert
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)

Policy: {table}_tenant_isolation_update
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
              WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)

-- No DELETE policy = DELETE denied for authenticated role
```

---

## Domain Events — Outbox Pattern

The `domain_events` table implements the Transactional Outbox pattern:

1. Application writes domain event + business row in the **same transaction**
2. A background worker polls `domain_events WHERE published_at IS NULL`
3. Worker dispatches to event bus (Supabase Realtime, webhook, queue)
4. Worker sets `published_at = now()` on success

This guarantees events are never lost even if the event bus is temporarily unavailable.

The `payload` column stores the full `DomainEvent<P>` interface serialized as JSONB, matching the TypeScript interface in `packages/domain/src/shared/domain-event.interface.ts`.

---

## Supabase-Specific Considerations

### Realtime

- `domain_events` should be added to Supabase Realtime publication for real-time event streaming (M4+).
- `notifications` can be added to Realtime for in-app notifications.

### Storage

- No binary storage planned for M3. File attachments (e.g., contract PDFs) are M6+.

### Edge Functions

- Auth hook for JWT claim injection is M3 prerequisite (see `MIGRATION_GUIDE.md` Decision #2).

### Generated Types

- After migrations run: `supabase gen types typescript --local > packages/db/src/supabase.types.ts`
- This creates the `packages/db` package foundation.

---

## File Layout for `supabase/` Directory

```
supabase/
  config.toml              — Supabase project config (already exists as placeholder)
  seed.sql                 — Dev-only seed data (NOT a migration)
  docs/
    SCHEMA_PLAN.md         — This file
  migrations/
    (empty — awaiting M3 implementation sign-off)
  functions/
    (empty — Edge Functions M4+)
```

---

## Pre-Implementation Checklist

Before the first migration file is created, confirm:

- [ ] All 10 open decisions in `MIGRATION_GUIDE.md` are resolved
- [ ] Supabase project created (local via CLI or cloud project)
- [ ] `supabase link` run to connect CLI to project
- [ ] Auth hook for `tenant_id` JWT claim designed and tested
- [ ] `packages/db` package scaffolded with `package.json` + `tsconfig.json`
- [ ] `supabase gen types` output location agreed (`packages/db/src/supabase.types.ts`)
- [ ] Migration naming convention confirmed (`YYYYMMDDHHMMSS_` prefix)
