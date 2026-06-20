# MIGRATION_GUIDE.md — Database Migration Strategy

Planning guide for Milestone 3 migrations. No SQL has been written yet.

---

## Tool

**Supabase CLI** manages migrations via `supabase/migrations/`. Each migration is a `.sql` file prefixed with a UTC timestamp: `YYYYMMDDHHMMSS_description.sql`.

Migrations run in lexicographic order. They are applied once and never modified after merge. All changes go forward — no rollback scripts (rollback = new migration).

---

## Proposed Migration Files (Ordered)

```
supabase/migrations/
  20260001000000_extensions.sql          — pgcrypto, uuid-ossp
  20260002000000_enum_types.sql          — all 23 PostgreSQL ENUM types
  20260003000000_tenants.sql             — tenants table + RLS
  20260004000000_branches.sql            — branches table + RLS + self-ref FK
  20260005000000_persons.sql             — persons table + RLS
  20260006000000_organizations.sql       — organizations table + RLS
  20260007000000_asset_types.sql         — asset_types table + RLS
  20260008000000_assets.sql              — assets table + RLS
  20260009000000_resources.sql           — resources table + RLS
  20260010000000_capabilities.sql        — capabilities table + RLS
  20260011000000_operations.sql          — operations table + RLS
  20260012000000_allocations.sql         — allocations table + RLS
  20260013000000_contracts.sql           — contracts table + RLS
  20260014000000_billing_accounts.sql    — billing_accounts table + RLS
  20260015000000_invoices.sql            — invoices + invoice_line_items + RLS
  20260016000000_notifications.sql       — notifications table + RLS
  20260017000000_workflow_definitions.sql — workflow_definitions + workflow_steps + RLS
  20260018000000_rule_sets.sql           — rule_sets + rule_set_rules + RLS
  20260019000000_domain_events.sql       — domain_events outbox + RLS
  20260020000000_indexes.sql             — all non-unique indexes (cross-table)
  20260021000000_triggers.sql            — updated_at auto-update trigger + invariant triggers
```

Total: **21 migration files**

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

| FK                                                             | Behavior | Reason                              |
| -------------------------------------------------------------- | -------- | ----------------------------------- |
| `branches.tenant_id → tenants`                                 | RESTRICT | Cannot delete tenant with branches  |
| `branches.parent_id → branches`                                | SET NULL | Orphan to root if parent removed    |
| `persons.tenant_id → tenants`                                  | RESTRICT |                                     |
| `organizations.tenant_id → tenants`                            | RESTRICT |                                     |
| `asset_types.tenant_id → tenants`                              | RESTRICT |                                     |
| `assets.branch_id → branches`                                  | RESTRICT | Cannot delete branch with assets    |
| `assets.asset_type_id → asset_types`                           | RESTRICT |                                     |
| `resources.branch_id → branches`                               | RESTRICT |                                     |
| `resources.person_id → persons`                                | SET NULL | Person can be removed from resource |
| `operations.resource_id → resources`                           | RESTRICT |                                     |
| `allocations.resource_id → resources`                          | RESTRICT |                                     |
| `allocations.asset_id → assets`                                | RESTRICT |                                     |
| `contracts.organization_id → organizations`                    | RESTRICT |                                     |
| `billing_accounts.organization_id → organizations`             | RESTRICT |                                     |
| `invoices.billing_account_id → billing_accounts`               | RESTRICT |                                     |
| `invoice_line_items.invoice_id → invoices`                     | CASCADE  | Line items are part of invoice      |
| `workflow_steps.workflow_definition_id → workflow_definitions` | CASCADE  | Steps owned by definition           |
| `workflow_steps.next_step_id → workflow_steps`                 | SET NULL | Allow removing step reference       |
| `rule_set_rules.rule_set_id → rule_sets`                       | CASCADE  | Rules owned by rule set             |

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

## Decisions Required Before Writing SQL

These questions must be answered before any `.sql` file is created:

| #   | Question                                                                                                                                                                                   | Impact                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| 1   | **ID generation**: Domain generates UUIDs via `crypto.randomUUID()`. DB should accept them, not generate them. Confirm `id UUID PK` columns have no `DEFAULT gen_random_uuid()`.           | Column definition            |
| 2   | **JWT claim for `tenant_id`**: Use `auth.jwt() ->> 'tenant_id'` or a `user_profiles` lookup?                                                                                               | All RLS policies             |
| 3   | **`Notification.recipient_id` type**: Currently an untyped string in domain. Should it be a FK to `persons.id` or remain generic (to support webhooks, external emails)?                   | `notifications` table schema |
| 4   | **`organization.address`**: Flat columns (as proposed in `DATABASE.md`) or JSONB? Flat columns are queryable but add 7 columns per org. JSONB is flexible but no column-level constraints. | `organizations` table        |
| 5   | **`invoice_line_items`**: Separate table (as proposed) vs JSONB array on `invoices`. Separate table enables indexed queries on line item descriptions; JSONB is simpler.                   | `invoices` schema            |
| 6   | **`workflow_steps` / `rule_set_rules`**: Separate tables (as proposed, enables next_step self-ref FK) vs JSONB. Steps need the self-ref for chaining; JSONB would lose that.               | Schema choice                |
| 7   | **Person ↔ Supabase Auth user**: Are all `persons` also Auth users? Or only some? This determines whether to add `auth_user_id UUID → auth.users` on `persons`.                            | `persons` table + RLS        |
| 8   | **`branches` tree depth**: Unlimited adjacency list (as proposed) or use `ltree` extension for materialized paths? `ltree` enables fast subtree queries but adds schema complexity.        | `branches` table + indexes   |
| 9   | **Currency**: Is `BRL` always the default or should the default come from the tenant's configuration?                                                                                      | All Money columns            |
| 10  | **Domain Events outbox**: Should `domain_events` be in the same Supabase database, or a separate PostgreSQL schema (e.g., `events.domain_events`)?                                         | `domain_events` migration    |

---

## Local Dev Workflow (Planned)

```bash
supabase start                         # start local Supabase stack
supabase migration new <name>          # create new migration file
supabase db reset                      # drop + replay all migrations + seed
supabase db push                       # apply pending migrations to remote
supabase gen types typescript          # generate TypeScript types from schema
```

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
