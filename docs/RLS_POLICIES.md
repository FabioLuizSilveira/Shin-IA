# RLS_POLICIES.md — Row-Level Security Strategy

Planned RLS policies for Milestone 3. **All design decisions locked (2026-06-20). No SQL has been written yet.**

---

## Overview

Shinã uses Supabase's built-in RLS (Row-Level Security) to enforce multi-tenancy at the database level. Every table that carries a `tenant_id` column must have RLS enabled. This is a defense-in-depth measure: the application layer also enforces tenant scoping, but RLS ensures a compromised application key cannot cross tenant boundaries.

---

## Authentication Model — Locked

RLS uses **JWT claim `tenant_id`** (Decision #2, locked 2026-06-20). The lookup-based fallback is not used.

Supabase Auth injects `tenant_id` into the JWT via a **Supabase Auth Hook** configured in `auth.users.raw_app_meta_data`. All RLS policies read the claim as:

```
(auth.jwt() ->> 'tenant_id')::UUID
```

Supabase Auth provides JWTs with the following custom claims:

```json
{
  "sub": "<auth.user.id>",
  "tenant_id": "<uuid>",
  "role": "authenticated",
  "platform_role": "admin | operator | viewer | service"
}
```

The Auth hook sets `tenant_id` at sign-in by reading the `persons.auth_user_id` link (Decision #7) to find which tenant the signing-in user belongs to.

---

## Role Definitions

| Role            | Description                      | Access                          |
| --------------- | -------------------------------- | ------------------------------- |
| `service_role`  | Backend service, CI, cron jobs   | Bypasses all RLS                |
| `authenticated` | End user with valid Supabase JWT | Subject to all RLS policies     |
| `anon`          | Unauthenticated requests         | No access to any business table |

---

## Policy Matrix by Table

### `tenants`

| Operation | Policy                     | Condition                                 |
| --------- | -------------------------- | ----------------------------------------- |
| SELECT    | Users see their own tenant | `id = (auth.jwt() ->> 'tenant_id')::UUID` |
| INSERT    | Service role only          | Deny for `authenticated`                  |
| UPDATE    | Service role only          | Deny for `authenticated`                  |
| DELETE    | Never                      | Block all                                 |

Rationale: Tenants are created by the platform, not by end users. Tenant self-service (name, plan) goes through an API that uses service role.

---

### Standard Tenant-Scoped Tables

Applies to: `branches`, `persons`, `organizations`, `asset_types`, `assets`, `resources`, `capabilities`, `operations`, `allocations`, `contracts`, `billing_accounts`, `invoices`, `notifications`, `workflow_definitions`, `rule_sets`

| Operation | Policy           | Condition                                        |
| --------- | ---------------- | ------------------------------------------------ |
| SELECT    | Tenant isolation | `tenant_id = (auth.jwt() ->> 'tenant_id')::UUID` |
| INSERT    | Tenant isolation | `tenant_id = (auth.jwt() ->> 'tenant_id')::UUID` |
| UPDATE    | Tenant isolation | `tenant_id = (auth.jwt() ->> 'tenant_id')::UUID` |
| DELETE    | Block            | Denied for all authenticated users               |

Deletes are blocked because the domain uses status fields, not hard deletes. Only service role can physically delete rows (for GDPR purge flows).

---

### Child Tables (no direct tenant_id on row — inherit via parent)

Applies to: `invoice_line_items`, `workflow_steps`, `rule_set_rules`

Strategy: **Denormalized `tenant_id`** — these tables include a `tenant_id` column even though it's redundant. This avoids join-based RLS checks which add overhead on every query.

| Operation | Policy           | Condition                                        |
| --------- | ---------------- | ------------------------------------------------ |
| SELECT    | Tenant isolation | `tenant_id = (auth.jwt() ->> 'tenant_id')::UUID` |
| INSERT    | Tenant isolation | `tenant_id = (auth.jwt() ->> 'tenant_id')::UUID` |
| UPDATE    | Tenant isolation | `tenant_id = (auth.jwt() ->> 'tenant_id')::UUID` |
| DELETE    | Block            | Denied for authenticated                         |

---

### `events.domain_events` (outbox — schema `events`)

Lives in the `events` schema. The `authenticated` role needs `USAGE` on the `events` schema and a SELECT-only policy.

| Operation | Policy            | Condition                                                               |
| --------- | ----------------- | ----------------------------------------------------------------------- |
| SELECT    | Tenant-scoped     | `tenant_id = (auth.jwt() ->> 'tenant_id')::UUID OR tenant_id IS NULL`   |
| INSERT    | Service role only | Deny for `authenticated` — events written via application service layer |
| UPDATE    | Never             | Block all — events are immutable                                        |
| DELETE    | Never             | Block all — events are immutable                                        |

---

## Branch-Scoped Access (Future — M5)

The domain's `BranchScopeMode` (Branch, BranchAndChildren, Root, Custom) implies future support for sub-tenant access control where some users can only see data in their assigned branch.

This is **not** implemented in M3 RLS — it requires an `IAM` module (M5). In M3, RLS is purely tenant-level. The placeholder for this is:

```
-- Future: extend SELECT policies to also check branch_id against
-- a user_branch_permissions lookup table (M5).
```

---

## RLS Performance Considerations

1. **Index on `tenant_id`**: Every table must have an index on `tenant_id`. Without it, RLS turns every query into a full table scan.

2. **JWT claim vs. lookup**: JWT claims avoid a subquery per row. If using lookup, the lookup must be a `SECURITY DEFINER` function cached with `search_path = ''`.

3. **ENABLE FORCE ROW LEVEL SECURITY**: Must be set on every table so that even the table owner (postgres role) is subject to RLS when connecting as `authenticated`. Without `FORCE`, the table owner bypasses RLS.

4. **Child table denormalization**: Redundant `tenant_id` on `invoice_line_items`, `workflow_steps`, `rule_set_rules` avoids join-based policies at the cost of one extra column per row.

---

## Security Invariants

These invariants must hold at all times:

1. A row with `tenant_id = X` is never visible to a user whose JWT carries `tenant_id = Y`.
2. The `tenants` table is only writeable by service role.
3. `domain_events` are immutable — no UPDATE or DELETE for any role.
4. `invoice_line_items.tenant_id` must always equal `invoices.tenant_id` — enforced by a trigger (planned for M3).
5. A user can never set `tenant_id` to a value different from their JWT claim — enforced by CHECK on INSERT policies.

---

## Platform Admin Access

Platform admins (Shinã employees managing the SaaS) access data through a separate admin interface that connects using the Supabase `service_role` key. This key bypasses all RLS. It must never be exposed to the client.

Platform-level operations (creating tenants, billing override, impersonation) all use service role exclusively.

---

## Decisions Locked (2026-06-20)

All RLS design decisions are resolved. No open items remain.

| Decision                    | Resolution                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| JWT claim population        | Supabase Auth Hook writing `tenant_id` to `raw_app_meta_data`; read as `auth.jwt() ->> 'tenant_id'`       |
| Person ↔ auth.users link    | `persons.auth_user_id UUID NULL UNIQUE` — Auth hook reads this to find the tenant at sign-in              |
| `invoice_line_items` INSERT | Service role only; `authenticated` users cannot write line items directly — aggregate invariant preserved |
| Notification recipient      | `person_id FK NULL + recipient_external_ref TEXT NULL`; CHECK ensures at least one non-null               |
