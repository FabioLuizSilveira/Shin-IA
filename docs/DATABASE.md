# DATABASE.md — Shinã Platform

Database architecture planning for Milestone 3. **All 10 design decisions locked (2026-06-20). No SQL has been written yet.**

---

## Technology

| Concern       | Choice                                  | Reason                                                                                                                     |
| ------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Database      | PostgreSQL 15+ (via Supabase)           | Native JSONB, RLS, extensions, real-time                                                                                   |
| ID type       | `UUID` — no DB default on PK columns    | Domain generates IDs via `crypto.randomUUID()`; DB accepts them at insert. No `DEFAULT gen_random_uuid()` on primary keys. |
| Timestamps    | `TIMESTAMPTZ`                           | All timestamps timezone-aware                                                                                              |
| Money         | `NUMERIC(19,4)` + `TEXT` (currency)     | Avoids float precision errors; currency from tenant config                                                                 |
| Enums         | PostgreSQL native `ENUM` types          | Type safety at DB level                                                                                                    |
| JSONB columns | For attributes, metadata, event payload | Domain objects without FK overhead                                                                                         |
| Event schema  | Separate PostgreSQL schema `events`     | `events.domain_events` isolated from business tables                                                                       |

---

## Multi-tenancy Pattern

Every table (except `tenants` itself) carries a `tenant_id UUID NOT NULL` column.

```
tenant_id → tenants(id)
```

RLS policies enforce that authenticated users can only read/write rows belonging to their own tenant. The service role (used by background jobs and admin APIs) bypasses RLS.

---

## Proposed Tables (18 core + 4 child + 1 cross-cutting)

### Tier 0 — Platform Root

| Table     | Domain Aggregate |
| --------- | ---------------- |
| `tenants` | Tenant           |

### Tier 1 — Tenant Structure

| Table           | Domain Aggregate |
| --------------- | ---------------- |
| `branches`      | Branch           |
| `persons`       | Person           |
| `organizations` | Organization     |

### Tier 2 — Fleet & Resource

| Table          | Domain Aggregate |
| -------------- | ---------------- |
| `asset_types`  | AssetType        |
| `assets`       | Asset            |
| `resources`    | Resource         |
| `capabilities` | Capability       |

### Tier 3 — Operations & Logistics

| Table         | Domain Aggregate |
| ------------- | ---------------- |
| `operations`  | Operation        |
| `allocations` | Allocation       |

### Tier 4 — Commercial

| Table                | Domain Aggregate       |
| -------------------- | ---------------------- |
| `contracts`          | Contract               |
| `billing_accounts`   | BillingAccount         |
| `invoices`           | Invoice                |
| `invoice_line_items` | Invoice (child entity) |

### Tier 5 — Platform Services

| Table                  | Domain Aggregate                  |
| ---------------------- | --------------------------------- |
| `notifications`        | Notification                      |
| `workflow_definitions` | WorkflowDefinition                |
| `workflow_steps`       | WorkflowDefinition (child entity) |
| `rule_sets`            | RuleSet                           |
| `rule_set_rules`       | RuleSet (child entity)            |

### Cross-cutting (schema `events`)

| Table                  | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `events.domain_events` | Outbox pattern — persisted domain events |

---

## Column Mapping per Aggregate

### `tenants`

| Column             | Type                                 | Notes                                           |
| ------------------ | ------------------------------------ | ----------------------------------------------- |
| `id`               | `UUID PK`                            | Domain-generated; no DB default                 |
| `name`             | `TEXT NOT NULL`                      |                                                 |
| `slug`             | `TEXT NOT NULL UNIQUE`               | Lowercase alphanumeric + hyphens                |
| `plan`             | `tenant_plan ENUM`                   | starter / professional / enterprise             |
| `status`           | `tenant_status ENUM`                 | trialing / active / suspended / cancelled       |
| `default_currency` | `TEXT NOT NULL DEFAULT 'BRL'`        | ISO 4217; used as default for all Money columns |
| `created_at`       | `TIMESTAMPTZ NOT NULL DEFAULT now()` |                                                 |
| `updated_at`       | `TIMESTAMPTZ NOT NULL DEFAULT now()` |                                                 |

### `branches`

| Column       | Type                            | Notes                        |
| ------------ | ------------------------------- | ---------------------------- |
| `id`         | `UUID PK`                       |                              |
| `tenant_id`  | `UUID NOT NULL → tenants`       |                              |
| `parent_id`  | `UUID → branches`               | NULL = root branch           |
| `name`       | `TEXT NOT NULL`                 |                              |
| `code`       | `TEXT NOT NULL`                 | Uppercase; UNIQUE per tenant |
| `active`     | `BOOLEAN NOT NULL DEFAULT true` |                              |
| `scope_mode` | `branch_scope_mode ENUM`        |                              |
| `created_at` | `TIMESTAMPTZ NOT NULL`          |                              |
| `updated_at` | `TIMESTAMPTZ NOT NULL`          |                              |

### `persons`

| Column               | Type                      | Notes                                            |
| -------------------- | ------------------------- | ------------------------------------------------ |
| `id`                 | `UUID PK`                 | Domain-generated; no DB default                  |
| `tenant_id`          | `UUID NOT NULL → tenants` |                                                  |
| `auth_user_id`       | `UUID UNIQUE`             | FK → `auth.users(id)`; NULL if not a system user |
| `first_name`         | `TEXT NOT NULL`           |                                                  |
| `last_name`          | `TEXT NOT NULL`           |                                                  |
| `email`              | `TEXT NOT NULL`           | CHECK email regex; UNIQUE per tenant             |
| `phone`              | `TEXT`                    |                                                  |
| `phone_country_code` | `TEXT`                    |                                                  |
| `document`           | `TEXT`                    | CPF/RG; UNIQUE per tenant if not null            |
| `status`             | `person_status ENUM`      | active / inactive / blocked                      |
| `created_at`         | `TIMESTAMPTZ NOT NULL`    |                                                  |
| `updated_at`         | `TIMESTAMPTZ NOT NULL`    |                                                  |

### `organizations`

| Column                 | Type                            | Notes                                            |
| ---------------------- | ------------------------------- | ------------------------------------------------ |
| `id`                   | `UUID PK`                       |                                                  |
| `tenant_id`            | `UUID NOT NULL → tenants`       |                                                  |
| `name`                 | `TEXT NOT NULL`                 |                                                  |
| `trade_name`           | `TEXT`                          |                                                  |
| `document`             | `TEXT NOT NULL`                 | CNPJ/CPF; UNIQUE per tenant                      |
| `type`                 | `organization_type ENUM`        |                                                  |
| `email`                | `TEXT`                          |                                                  |
| `phone`                | `TEXT`                          |                                                  |
| `address_street`       | `TEXT`                          | Flattened VO                                     |
| `address_number`       | `TEXT`                          |                                                  |
| `address_neighborhood` | `TEXT`                          |                                                  |
| `address_city`         | `TEXT NOT NULL`                 |                                                  |
| `address_state`        | `TEXT NOT NULL`                 |                                                  |
| `address_country`      | `TEXT NOT NULL`                 | ISO 3166-1 alpha-2                               |
| `address_postal_code`  | `TEXT`                          |                                                  |
| `metadata`             | `JSONB NOT NULL DEFAULT '{}'`   | Extensible key-value for org-specific attributes |
| `active`               | `BOOLEAN NOT NULL DEFAULT true` |                                                  |
| `created_at`           | `TIMESTAMPTZ NOT NULL`          |                                                  |
| `updated_at`           | `TIMESTAMPTZ NOT NULL`          |                                                  |

### `asset_types`

| Column       | Type                            | Notes                    |
| ------------ | ------------------------------- | ------------------------ |
| `id`         | `UUID PK`                       |                          |
| `tenant_id`  | `UUID NOT NULL → tenants`       |                          |
| `name`       | `TEXT NOT NULL`                 |                          |
| `category`   | `asset_category ENUM`           |                          |
| `attributes` | `JSONB NOT NULL DEFAULT '{}'`   | `Record<string, string>` |
| `active`     | `BOOLEAN NOT NULL DEFAULT true` |                          |
| `created_at` | `TIMESTAMPTZ NOT NULL`          |                          |
| `updated_at` | `TIMESTAMPTZ NOT NULL`          |                          |

### `assets`

| Column          | Type                           | Notes                         |
| --------------- | ------------------------------ | ----------------------------- |
| `id`            | `UUID PK`                      |                               |
| `tenant_id`     | `UUID NOT NULL → tenants`      |                               |
| `branch_id`     | `UUID NOT NULL → branches`     |                               |
| `asset_type_id` | `UUID NOT NULL → asset_types`  |                               |
| `name`          | `TEXT NOT NULL`                |                               |
| `serial_number` | `TEXT`                         | UNIQUE per tenant if not null |
| `category`      | `asset_category ENUM NOT NULL` |                               |
| `status`        | `asset_status ENUM NOT NULL`   |                               |
| `created_at`    | `TIMESTAMPTZ NOT NULL`         |                               |
| `updated_at`    | `TIMESTAMPTZ NOT NULL`         |                               |

### `resources`

| Column       | Type                            | Notes                   |
| ------------ | ------------------------------- | ----------------------- |
| `id`         | `UUID PK`                       |                         |
| `tenant_id`  | `UUID NOT NULL → tenants`       |                         |
| `branch_id`  | `UUID NOT NULL → branches`      |                         |
| `person_id`  | `UUID → persons`                | Optional link to Person |
| `name`       | `TEXT NOT NULL`                 |                         |
| `type`       | `resource_type ENUM NOT NULL`   |                         |
| `status`     | `resource_status ENUM NOT NULL` |                         |
| `created_at` | `TIMESTAMPTZ NOT NULL`          |                         |
| `updated_at` | `TIMESTAMPTZ NOT NULL`          |                         |

### `capabilities`

| Column       | Type                             | Notes                        |
| ------------ | -------------------------------- | ---------------------------- |
| `id`         | `UUID PK`                        |                              |
| `tenant_id`  | `UUID NOT NULL → tenants`        |                              |
| `name`       | `TEXT NOT NULL`                  |                              |
| `key`        | `TEXT NOT NULL`                  | UNIQUE per tenant; lowercase |
| `scope`      | `capability_scope ENUM NOT NULL` |                              |
| `metadata`   | `JSONB NOT NULL DEFAULT '{}'`    |                              |
| `active`     | `BOOLEAN NOT NULL DEFAULT true`  |                              |
| `created_at` | `TIMESTAMPTZ NOT NULL`           |                              |
| `updated_at` | `TIMESTAMPTZ NOT NULL`           |                              |

### `operations`

| Column                | Type                             | Notes           |
| --------------------- | -------------------------------- | --------------- |
| `id`                  | `UUID PK`                        |                 |
| `tenant_id`           | `UUID NOT NULL → tenants`        |                 |
| `branch_id`           | `UUID NOT NULL → branches`       |                 |
| `resource_id`         | `UUID NOT NULL → resources`      |                 |
| `type`                | `operation_type ENUM NOT NULL`   |                 |
| `status`              | `operation_status ENUM NOT NULL` |                 |
| `scheduled_starts_at` | `TIMESTAMPTZ NOT NULL`           | DateRange.start |
| `scheduled_ends_at`   | `TIMESTAMPTZ NOT NULL`           | DateRange.end   |
| `started_at`          | `TIMESTAMPTZ`                    |                 |
| `completed_at`        | `TIMESTAMPTZ`                    |                 |
| `created_at`          | `TIMESTAMPTZ NOT NULL`           |                 |
| `updated_at`          | `TIMESTAMPTZ NOT NULL`           |                 |

### `allocations`

| Column             | Type                              | Notes |
| ------------------ | --------------------------------- | ----- |
| `id`               | `UUID PK`                         |       |
| `tenant_id`        | `UUID NOT NULL → tenants`         |       |
| `resource_id`      | `UUID NOT NULL → resources`       |       |
| `asset_id`         | `UUID NOT NULL → assets`          |       |
| `period_starts_at` | `TIMESTAMPTZ NOT NULL`            |       |
| `period_ends_at`   | `TIMESTAMPTZ NOT NULL`            |       |
| `status`           | `allocation_status ENUM NOT NULL` |       |
| `created_at`       | `TIMESTAMPTZ NOT NULL`            |       |
| `updated_at`       | `TIMESTAMPTZ NOT NULL`            |       |

### `contracts`

| Column             | Type                            | Notes                                                            |
| ------------------ | ------------------------------- | ---------------------------------------------------------------- |
| `id`               | `UUID PK`                       |                                                                  |
| `tenant_id`        | `UUID NOT NULL → tenants`       |                                                                  |
| `organization_id`  | `UUID NOT NULL → organizations` |                                                                  |
| `type`             | `contract_type ENUM NOT NULL`   |                                                                  |
| `status`           | `contract_status ENUM NOT NULL` |                                                                  |
| `value_amount`     | `NUMERIC(19,4) NOT NULL`        | Money.amount                                                     |
| `value_currency`   | `TEXT NOT NULL`                 | Money.currency; application sets from `tenants.default_currency` |
| `period_starts_at` | `TIMESTAMPTZ NOT NULL`          |                                                                  |
| `period_ends_at`   | `TIMESTAMPTZ NOT NULL`          |                                                                  |
| `created_at`       | `TIMESTAMPTZ NOT NULL`          |                                                                  |
| `updated_at`       | `TIMESTAMPTZ NOT NULL`          |                                                                  |

### `billing_accounts`

| Column                  | Type                                   | Notes                           |
| ----------------------- | -------------------------------------- | ------------------------------- |
| `id`                    | `UUID PK`                              |                                 |
| `tenant_id`             | `UUID NOT NULL → tenants`              |                                 |
| `organization_id`       | `UUID NOT NULL → organizations`        |                                 |
| `cycle`                 | `billing_cycle ENUM NOT NULL`          |                                 |
| `status`                | `billing_account_status ENUM NOT NULL` |                                 |
| `credit_limit_amount`   | `NUMERIC(19,4) NOT NULL`               |                                 |
| `credit_limit_currency` | `TEXT NOT NULL`                        | From `tenants.default_currency` |
| `balance_amount`        | `NUMERIC(19,4) NOT NULL DEFAULT 0`     |                                 |
| `balance_currency`      | `TEXT NOT NULL`                        | From `tenants.default_currency` |
| `created_at`            | `TIMESTAMPTZ NOT NULL`                 |                                 |
| `updated_at`            | `TIMESTAMPTZ NOT NULL`                 |                                 |

### `invoices`

| Column               | Type                               | Notes                           |
| -------------------- | ---------------------------------- | ------------------------------- |
| `id`                 | `UUID PK`                          |                                 |
| `tenant_id`          | `UUID NOT NULL → tenants`          |                                 |
| `billing_account_id` | `UUID NOT NULL → billing_accounts` |                                 |
| `status`             | `invoice_status ENUM NOT NULL`     |                                 |
| `total_amount`       | `NUMERIC(19,4) NOT NULL`           | Computed from line items        |
| `total_currency`     | `TEXT NOT NULL`                    | From `tenants.default_currency` |
| `due_date`           | `DATE NOT NULL`                    |                                 |
| `paid_at`            | `TIMESTAMPTZ`                      |                                 |
| `created_at`         | `TIMESTAMPTZ NOT NULL`             |                                 |
| `updated_at`         | `TIMESTAMPTZ NOT NULL`             |                                 |

### `invoice_line_items`

| Column                | Type                         | Notes                           |
| --------------------- | ---------------------------- | ------------------------------- |
| `id`                  | `UUID PK`                    |                                 |
| `invoice_id`          | `UUID NOT NULL → invoices`   |                                 |
| `tenant_id`           | `UUID NOT NULL → tenants`    | Denormalized for RLS            |
| `description`         | `TEXT NOT NULL`              |                                 |
| `quantity`            | `INTEGER NOT NULL CHECK > 0` |                                 |
| `unit_price_amount`   | `NUMERIC(19,4) NOT NULL`     |                                 |
| `unit_price_currency` | `TEXT NOT NULL`              | From `tenants.default_currency` |
| `sort_order`          | `INTEGER NOT NULL DEFAULT 0` | Preserve insertion order        |

### `notifications`

`person_id` and `recipient_external_ref` are mutually optional but at least one must be non-null (enforced by CHECK constraint).

| Column                   | Type                                  | Notes                                                                    |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------ |
| `id`                     | `UUID PK`                             | Domain-generated; no DB default                                          |
| `tenant_id`              | `UUID NOT NULL → tenants`             |                                                                          |
| `person_id`              | `UUID → persons`                      | NULL for external recipients (webhooks, emails outside the system)       |
| `recipient_external_ref` | `TEXT`                                | Email address, webhook URL, phone number, etc. for non-person recipients |
| `channel`                | `notification_channel ENUM NOT NULL`  |                                                                          |
| `priority`               | `notification_priority ENUM NOT NULL` |                                                                          |
| `subject`                | `TEXT NOT NULL`                       |                                                                          |
| `body`                   | `TEXT NOT NULL`                       |                                                                          |
| `status`                 | `notification_status ENUM NOT NULL`   |                                                                          |
| `sent_at`                | `TIMESTAMPTZ`                         |                                                                          |
| `read_at`                | `TIMESTAMPTZ`                         |                                                                          |
| `created_at`             | `TIMESTAMPTZ NOT NULL`                |                                                                          |
| `updated_at`             | `TIMESTAMPTZ NOT NULL`                |                                                                          |

### `workflow_definitions`

| Column       | Type                            | Notes             |
| ------------ | ------------------------------- | ----------------- |
| `id`         | `UUID PK`                       |                   |
| `tenant_id`  | `UUID NOT NULL → tenants`       |                   |
| `name`       | `TEXT NOT NULL`                 |                   |
| `trigger`    | `TEXT NOT NULL`                 | Event type string |
| `status`     | `workflow_status ENUM NOT NULL` |                   |
| `version`    | `INTEGER NOT NULL DEFAULT 1`    |                   |
| `created_at` | `TIMESTAMPTZ NOT NULL`          |                   |
| `updated_at` | `TIMESTAMPTZ NOT NULL`          |                   |

### `workflow_steps`

| Column                   | Type                                   | Notes                |
| ------------------------ | -------------------------------------- | -------------------- |
| `id`                     | `UUID PK`                              | Domain's `stepId`    |
| `workflow_definition_id` | `UUID NOT NULL → workflow_definitions` |                      |
| `tenant_id`              | `UUID NOT NULL → tenants`              | Denormalized for RLS |
| `name`                   | `TEXT NOT NULL`                        |                      |
| `action`                 | `TEXT NOT NULL`                        |                      |
| `next_step_id`           | `UUID → workflow_steps`                | Self-referential     |
| `sort_order`             | `INTEGER NOT NULL DEFAULT 0`           |                      |

### `rule_sets`

| Column       | Type                            | Notes |
| ------------ | ------------------------------- | ----- |
| `id`         | `UUID PK`                       |       |
| `tenant_id`  | `UUID NOT NULL → tenants`       |       |
| `name`       | `TEXT NOT NULL`                 |       |
| `context`    | `TEXT NOT NULL`                 |       |
| `status`     | `rule_set_status ENUM NOT NULL` |       |
| `created_at` | `TIMESTAMPTZ NOT NULL`          |       |
| `updated_at` | `TIMESTAMPTZ NOT NULL`          |       |

### `rule_set_rules`

| Column        | Type                         | Notes                |
| ------------- | ---------------------------- | -------------------- |
| `id`          | `UUID PK`                    | Domain's `ruleId`    |
| `rule_set_id` | `UUID NOT NULL → rule_sets`  |                      |
| `tenant_id`   | `UUID NOT NULL → tenants`    | Denormalized for RLS |
| `condition`   | `TEXT NOT NULL`              |                      |
| `action`      | `TEXT NOT NULL`              |                      |
| `priority`    | `INTEGER NOT NULL DEFAULT 0` |                      |

### `events.domain_events` (outbox — separate schema)

Lives in the `events` PostgreSQL schema, isolated from `public` business tables. Access requires `USAGE` grant on the `events` schema for the `authenticated` and `service_role` roles.

| Column           | Type                         | Notes                                     |
| ---------------- | ---------------------------- | ----------------------------------------- |
| `id`             | `UUID PK`                    | `eventId` from DomainEvent; no DB default |
| `event_type`     | `TEXT NOT NULL`              | e.g. `tenant.created`                     |
| `aggregate_id`   | `UUID NOT NULL`              |                                           |
| `aggregate_type` | `TEXT NOT NULL`              |                                           |
| `tenant_id`      | `UUID`                       | NULL for platform-level events            |
| `version`        | `INTEGER NOT NULL DEFAULT 1` |                                           |
| `payload`        | `JSONB NOT NULL`             | Full event payload                        |
| `occurred_at`    | `TIMESTAMPTZ NOT NULL`       |                                           |
| `published_at`   | `TIMESTAMPTZ`                | NULL = not yet dispatched                 |

---

## PostgreSQL ENUM Types Needed

```
tenant_plan:           starter, professional, enterprise
tenant_status:         trialing, active, suspended, cancelled
branch_scope_mode:     root, branch, branch_and_children, custom
person_status:         active, inactive, blocked
organization_type:     customer, supplier, partner, internal
asset_category:        vehicle, equipment, tool, property, technology
asset_status:          available, in_use, maintenance, decommissioned
resource_type:         human, vehicle, equipment, virtual
resource_status:       available, busy, offline, suspended
capability_scope:      global, tenant, branch, resource
operation_type:        delivery, pickup, maintenance, inspection, transfer
operation_status:      pending, in_progress, completed, cancelled, failed
allocation_status:     reserved, active, completed, cancelled
contract_type:         service, rental, lease, subscription, one_time
contract_status:       draft, active, expired, terminated, suspended
billing_cycle:         monthly, quarterly, annual, one_time
billing_account_status: active, suspended, closed
invoice_status:        draft, issued, paid, overdue, cancelled, voided
notification_channel:  email, sms, push, in_app, webhook
notification_status:   pending, sent, delivered, failed, read
notification_priority: low, normal, high, critical
workflow_status:       draft, active, inactive, deprecated
rule_set_status:       draft, active, inactive
```

---

## Proposed Indexes

| Table                  | Index                                             | Type                                              | Reason                           |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------- | -------------------------------- |
| `tenants`              | `slug`                                            | UNIQUE                                            | Lookup by slug                   |
| `branches`             | `(tenant_id, code)`                               | UNIQUE                                            | Code unique per tenant           |
| `branches`             | `parent_id`                                       | BTREE                                             | Tree traversal                   |
| `branches`             | `tenant_id`                                       | BTREE                                             | Tenant filter                    |
| `persons`              | `(tenant_id, email)`                              | UNIQUE                                            | Email unique per tenant          |
| `persons`              | `(tenant_id, document)`                           | UNIQUE (partial: WHERE document IS NOT NULL)      | Doc unique per tenant            |
| `organizations`        | `(tenant_id, document)`                           | UNIQUE                                            | CNPJ unique per tenant           |
| `assets`               | `(tenant_id, serial_number)`                      | UNIQUE (partial: WHERE serial_number IS NOT NULL) |                                  |
| `capabilities`         | `(tenant_id, key)`                                | UNIQUE                                            | Capability key unique per tenant |
| `operations`           | `(tenant_id, status)`                             | BTREE                                             | Status filter                    |
| `operations`           | `(resource_id, scheduled_starts_at)`              | BTREE                                             | Schedule queries                 |
| `allocations`          | `(resource_id, period_starts_at, period_ends_at)` | BTREE                                             | Overlap detection                |
| `allocations`          | `(asset_id, period_starts_at, period_ends_at)`    | BTREE                                             | Overlap detection                |
| `invoices`             | `(billing_account_id, status)`                    | BTREE                                             | Account billing queries          |
| `events.domain_events` | `(aggregate_id, event_type)`                      | BTREE                                             | Event replay                     |
| `events.domain_events` | `published_at`                                    | BTREE (partial: WHERE published_at IS NULL)       | Outbox polling                   |
| `events.domain_events` | `tenant_id`                                       | BTREE                                             | Tenant event stream              |
| `notifications`        | `(tenant_id, status)`                             | BTREE                                             | Pending notifications            |

---

## Soft Delete Strategy

No `deleted_at` columns. Domain uses explicit status fields (`active: false`, `status: Decommissioned`, etc.) which map directly to the `status` / `active` columns. Hard deletes are never performed on business data. If audit is needed, `domain_events` provides the full history.

---

## Naming Conventions

- Table names: `snake_case`, plural
- Column names: `snake_case`
- FK columns: `{referenced_table_singular}_id`
- Composite Money VO: `{field}_amount` + `{field}_currency`
- Composite DateRange VO: `{field}_starts_at` + `{field}_ends_at`
- Enum types: `snake_case`

---

## Currency Convention

All Money columns (`*_amount` / `*_currency`) follow this rule:

- The `*_amount` column stores the numeric value.
- The `*_currency` column stores the ISO 4217 currency code (e.g. `BRL`, `USD`, `EUR`).
- The database has **no hardcoded `DEFAULT 'BRL'`** on individual Money columns.
- The application layer reads `tenants.default_currency` and fills the currency column at write time.
- This allows a tenant to switch their base currency without a schema migration.

## Design Decisions — Locked (2026-06-20)

| #   | Decision                        | Outcome                                                                                               |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | ID generation                   | Domain generates UUID; no `DEFAULT gen_random_uuid()` on PKs                                          |
| 2   | RLS strategy                    | JWT claim `tenant_id` via Supabase Auth hook                                                          |
| 3   | Notification recipient          | `person_id UUID NULL FK + recipient_external_ref TEXT NULL`; CHECK ensures at least one is set        |
| 4   | Organization address            | Flat columns + `metadata JSONB` for extensions                                                        |
| 5   | Invoice line items              | Separate table `invoice_line_items`                                                                   |
| 6   | Workflow steps / rule set rules | Separate tables (FK + self-ref enabled)                                                               |
| 7   | Person ↔ Auth user              | `persons.auth_user_id UUID NULL UNIQUE` → `auth.users`                                                |
| 8   | Branch tree                     | Adjacency list (MVP); `ltree` deferred to post-MVP if needed                                          |
| 9   | Currency                        | Configurable per tenant via `tenants.default_currency`; application fills Money columns at write time |
| 10  | Domain events schema            | Separate PostgreSQL schema `events`; table is `events.domain_events`                                  |
