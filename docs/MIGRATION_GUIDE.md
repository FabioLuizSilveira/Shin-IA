# MIGRATION_GUIDE.md — Database Migration Strategy

Planning guide for Milestone 3 migrations. **All 10 design decisions locked (2026-06-20). No SQL has been written yet.**

---

## Tool

**Supabase CLI** manages migrations via `supabase/migrations/`. Each migration is a `.sql` file prefixed with a UTC timestamp: `YYYYMMDDHHMMSS_description.sql`.

Migrations run in lexicographic order. They are applied once and never modified after merge. All changes go forward — no rollback scripts (rollback = new migration).

---

## Proposed Migration Files (Ordered)

```
supabase/migrations/
  20260001000000_extensions.sql           — pgcrypto, uuid-ossp
  20260002000000_enum_types.sql           — all 23 PostgreSQL ENUM types
  20260003000000_tenants.sql              — tenants table (+ default_currency) + RLS
  20260004000000_branches.sql             — branches table + RLS + self-ref FK (adjacency list)
  20260005000000_persons.sql              — persons table (+ auth_user_id) + RLS
  20260006000000_organizations.sql        — organizations table (+ metadata JSONB) + RLS
  20260007000000_asset_types.sql          — asset_types table + RLS
  20260008000000_assets.sql               — assets table + RLS
  20260009000000_resources.sql            — resources table + RLS
  20260010000000_capabilities.sql         — capabilities table + RLS
  20260011000000_operations.sql           — operations table + RLS
  20260012000000_allocations.sql          — allocations table + RLS
  20260013000000_contracts.sql            — contracts table + RLS
  20260014000000_billing_accounts.sql     — billing_accounts table + RLS
  20260015000000_invoices.sql             — invoices + invoice_line_items (separate table) + RLS
  20260016000000_notifications.sql        — notifications (person_id FK + recipient_external_ref) + RLS
  20260017000000_workflow_definitions.sql — workflow_definitions + workflow_steps (separate table) + RLS
  20260018000000_rule_sets.sql            — rule_sets + rule_set_rules (separate table) + RLS
  20260019000000_events_schema.sql        — CREATE SCHEMA events; events.domain_events + RLS
  20260020000000_indexes.sql              — all non-unique indexes (cross-table)
  20260021000000_triggers.sql             — updated_at auto-update trigger + invariant triggers
```

Total: **21 migration files**

> **Decision #10 impact**: M019 creates the `events` schema before the table. The `events.domain_events` table lives in the `events` schema, not `public`. The migration must also grant `USAGE ON SCHEMA events` to the `authenticated` and `service_role` roles.

---

## Dependency Order (FK graph)

```
extensions
  └── enum_types
        └── tenants
              ├── branches (self-ref)
              ├── persons
              ├── organizations
              │     ├── contracts
              │     └── billing_accounts
              │           └── invoices
              │                 └── invoice_line_items
              ├── asset_types
              │     └── assets (also → branches)
              ├── resources (also → branches, persons)
              │     ├── operations (also → branches)
              │     └── allocations (also → assets)
              ├── capabilities
              ├── notifications
              ├── workflow_definitions
              │     └── workflow_steps (self-ref next_step_id)
              └── rule_sets
                    └── rule_set_rules
```

No circular FKs. `branches.parent_id` is a deferred self-reference (nullable, root branches have `NULL`).

`events.domain_events` has no FK to `public.tenants` — it is append-only and must not block tenant deletion.

---

## Migration Content Checklist

Each migration file must contain (in order):

1. **Table `CREATE`** with all columns, types, NOT NULL, defaults, CHECKs
2. **Unique constraints** (inline with table or as `ALTER TABLE ADD CONSTRAINT`)
3. **Foreign key constraints** with explicit `ON DELETE` behavior
4. **`ALTER TABLE ENABLE ROW LEVEL SECURITY`**
5. **`ALTER TABLE FORCE ROW LEVEL SECURITY`** (so table owner is also subject to RLS)
6. **RLS policies** (SELECT, INSERT, UPDATE — DELETE blocked via no policy)
7. **Table-specific indexes** (PK + UNIQUE only; non-unique deferred to `_indexes.sql`)

---

## `ON DELETE` Behavior per FK

| FK                                                             | Behavior | Reason                                |
| -------------------------------------------------------------- | -------- | ------------------------------------- |
| `branches.tenant_id → tenants`                                 | RESTRICT | Cannot delete tenant with branches    |
| `branches.parent_id → branches`                                | SET NULL | Orphan to root if parent removed      |
| `persons.tenant_id → tenants`                                  | RESTRICT |                                       |
| `organizations.tenant_id → tenants`                            | RESTRICT |                                       |
| `asset_types.tenant_id → tenants`                              | RESTRICT |                                       |
| `assets.branch_id → branches`                                  | RESTRICT | Cannot delete branch with assets      |
| `assets.asset_type_id → asset_types`                           | RESTRICT |                                       |
| `resources.branch_id → branches`                               | RESTRICT |                                       |
| `resources.person_id → persons`                                | SET NULL | Person can be removed from resource   |
| `operations.resource_id → resources`                           | RESTRICT |                                       |
| `allocations.resource_id → resources`                          | RESTRICT |                                       |
| `allocations.asset_id → assets`                                | RESTRICT |                                       |
| `contracts.organization_id → organizations`                    | RESTRICT |                                       |
| `billing_accounts.organization_id → organizations`             | RESTRICT |                                       |
| `invoices.billing_account_id → billing_accounts`               | RESTRICT |                                       |
| `invoice_line_items.invoice_id → invoices`                     | CASCADE  | Line items are part of invoice        |
| `workflow_steps.workflow_definition_id → workflow_definitions` | CASCADE  | Steps owned by definition             |
| `workflow_steps.next_step_id → workflow_steps`                 | SET NULL | Allow removing step reference         |
| `rule_set_rules.rule_set_id → rule_sets`                       | CASCADE  | Rules owned by rule set               |
| `persons.auth_user_id → auth.users`                            | SET NULL | Person stays when Auth user deleted   |
| `notifications.person_id → persons`                            | SET NULL | Notification kept when person removed |

---

## Triggers Planned (M3)

### `updated_at` auto-update

A single trigger function applied to all tables that have an `updated_at` column. Fires `BEFORE UPDATE`, sets `updated_at = now()`.

### Invariant: `invoice_line_items.tenant_id`

A `BEFORE INSERT` trigger on `invoice_line_items` that asserts `NEW.tenant_id = (SELECT tenant_id FROM invoices WHERE id = NEW.invoice_id)`. Rejects inserts where tenant IDs diverge.

### Invariant: `workflow_steps.tenant_id`

Same pattern — asserts step tenant matches definition tenant.

### Invariant: `rule_set_rules.tenant_id`

Same pattern.

---

## Seed Data (Development Only)

Not part of migrations. A separate `supabase/seed.sql` file will contain:

- One test tenant
- One root branch
- One person (linked to the Supabase Auth test user)
- Minimal capability/asset_type entries

Seed data only runs in local dev (`supabase db reset`), never in production.

---

## Decisions — All Locked (2026-06-20)

All design questions are resolved. Implementation may begin.

| #   | Question                        | Decision                                                                                                               |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | ID generation                   | Domain generates UUIDs; no `DEFAULT gen_random_uuid()` on any PK                                                       |
| 2   | RLS JWT strategy                | JWT claim `tenant_id` via Supabase Auth Hook                                                                           |
| 3   | Notification recipient          | `person_id UUID NULL FK` + `recipient_external_ref TEXT NULL`; CHECK requires at least one non-null                    |
| 4   | Organization address            | Flat columns (7 columns) + `metadata JSONB NOT NULL DEFAULT '{}'`                                                      |
| 5   | Invoice line items              | Separate table `invoice_line_items`                                                                                    |
| 6   | Workflow steps / rule set rules | Separate tables (enables self-ref FK on steps, ordered rules)                                                          |
| 7   | Person ↔ Auth user              | `persons.auth_user_id UUID NULL UNIQUE`; not all persons are Auth users                                                |
| 8   | Branch tree                     | Adjacency list (`parent_id` self-ref, NULL = root); `ltree` deferred to post-MVP                                       |
| 9   | Currency                        | Configurable per tenant via `tenants.default_currency TEXT NOT NULL DEFAULT 'BRL'`; application reads it at write time |
| 10  | Domain events schema            | Separate PostgreSQL schema `events`; table is `events.domain_events`                                                   |

---

## Local Dev Workflow

All four apps (`web`, `mkt`, `tenant-web`, `admin-web`) point `.env.local` at the
hosted Supabase project by default — no Docker, no `supabase start` needed for
day-to-day work. `supabase db push` applies migrations straight to the hosted
project over its connection string.

```bash
supabase migration new <name>          # create new migration file
supabase db push                       # apply pending migrations to the hosted project
supabase gen types typescript          # generate TypeScript types from schema
```

`supabase start` (the local Docker stack) still works if you specifically need
an isolated sandbox to test a destructive migration before pushing it, but
it's opt-in, not the default — don't point `.env.local` back at
`127.0.0.1:54321` unless you're intentionally using it.

Output of `gen types` will go to `packages/db/src/supabase.types.ts` (M3 package creation).

---

## Risk Register

| Risk                                                                      | Severity | Mitigation                                                                                                         |
| ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `branches` unlimited depth causes N+1 queries on tree traversal           | Medium   | Add `ltree` or recursive CTE + explicit depth limit                                                                |
| RLS policy misconfiguration leaks cross-tenant data                       | Critical | Policy unit tests via `supabase test db` (planned M5); manual audit M3                                             |
| `invoice_line_items.tenant_id` drift from `invoices.tenant_id`            | High     | Trigger invariant enforces consistency                                                                             |
| `updated_at` trigger not applied to new tables added in future migrations | Medium   | Standard trigger template in `_triggers.sql`; checklist in PR template                                             |
| `domain_events` table growing unbounded                                   | Medium   | Partition by `occurred_at` month (planned M6); purge policy for `published_at IS NOT NULL` rows older than 90 days |
| Missing index on `tenant_id` causes full-table-scan RLS                   | High     | `_indexes.sql` migration explicitly indexes every `tenant_id`                                                      |
| `serialNumber` collision across tenants if uniqueness is global           | Low      | Unique constraint scoped to `(tenant_id, serial_number)`                                                           |
