# RLS_POLICIES.md — Row-Level Security Strategy

Planned RLS policies for Milestone 3. No SQL has been written yet.

---

## Overview

Shinã uses Supabase's built-in RLS (Row-Level Security) to enforce multi-tenancy at the database level. Every table that carries a `tenant_id` column must have RLS enabled. This is a defense-in-depth measure: the application layer also enforces tenant scoping, but RLS ensures a compromised application key cannot cross tenant boundaries.

---

## Authentication Model

Supabase Auth provides JWTs with the following custom claims (to be configured via a Supabase Edge Function or Auth hook):

```json
{
  "sub": "<auth.user.id>",
  "tenant_id": "<uuid>",
  "role": "authenticated",
  "platform_role": "admin | operator | viewer | service"
}
```

Two paths to `tenant_id`:

1. **JWT claim** (preferred): `(auth.jwt() ->> 'tenant_id')::UUID`
2. **User profile lookup** (fallback): join against a `user_profiles` table that maps `auth.uid()` → `tenant_id`

Decision required: which approach to use. JWT claims are faster (no extra query) but require Auth hook setup.

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

### `domain_events` (outbox)

| Operation | Policy                              | Condition                                                             |
| --------- | ----------------------------------- | --------------------------------------------------------------------- |
| SELECT    | Tenant-scoped                       | `tenant_id = (auth.jwt() ->> 'tenant_id')::UUID OR tenant_id IS NULL` |
| INSERT    | Application only (via service role) | Deny for `authenticated`                                              |
| UPDATE    | Never                               | Block all                                                             |
| DELETE    | Never                               | Block all                                                             |

Events are immutable. Only the service layer writes them.

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

## Open Decisions

1. **JWT claim population**: How is `tenant_id` injected into the Supabase JWT? Options:
   - Supabase Auth Hook (`auth.users` metadata)
   - Edge Function middleware
   - Custom claim in `app_metadata`

2. **Person ↔ auth.users link**: If a `Person` is also a Supabase Auth user, we need a `user_profiles` table or `auth.users.raw_user_meta_data`. This affects how `recipient_id` in `notifications` resolves.

3. **RLS on `invoice_line_items` INSERT**: Should the application be allowed to insert line items directly, or only through the invoice aggregate (service role)? Leaning toward service role to preserve aggregate invariants.
