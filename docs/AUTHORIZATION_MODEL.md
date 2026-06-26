# Authorization Model — Shinã Platform

> Last updated: 2026-06-20 (M4.0 — IAM Design)

Specifies the complete authorization model used by the Shinã Platform: RBAC for coarse-grained role-based access, ABAC for fine-grained attribute conditions, Delegated Access for cross-user permission sharing, and the Approval Workflow model for operations requiring human authorization.

See [`IAM.md`](IAM.md) for the combined IAM overview.  
See [`PLATFORM_IAM.md`](PLATFORM_IAM.md) for platform roles.  
See [`TENANT_IAM.md`](TENANT_IAM.md) for tenant roles.  
See [`ACCESS_MATRIX.md`](ACCESS_MATRIX.md) for the full permission matrix.  
See [`APPROVAL_WORKFLOWS.md`](APPROVAL_WORKFLOWS.md) for approval flow specifications.

---

## Authorization Layers

Every request passes through three sequential authorization layers. **All three must grant access.**

```
Request
  │
  ▼
1. RBAC — Does the user's role include the required permission?
  │  YES → continue
  │  NO  → 403 Forbidden
  ▼
2. ABAC — Do the request attributes satisfy all active policies?
  │  YES → continue
  │  NO  → 403 Forbidden
  ▼
3. Approval Gate — Does this operation require a workflow approval?
     YES + approved → proceed
     YES + pending  → 202 Accepted (async)
     YES + denied   → 403 Forbidden
     NO             → proceed immediately
```

---

## 1. RBAC — Role-Based Access Control

### Data Model

```
Role
  id              uuid PK
  tenant_id       uuid (NULL for platform roles)
  name            text UNIQUE within tenant
  description     text
  is_system       boolean   -- true = cannot be deleted
  created_at      timestamptz

Permission
  id              uuid PK
  resource        text      -- e.g. "assets"
  action          text      -- e.g. "create"
  key             text      -- e.g. "assets:create"
  description     text
  scope           text      -- "platform" | "tenant"
  is_system       boolean

RolePermission (junction)
  role_id         uuid FK → roles
  permission_id   uuid FK → permissions
  PRIMARY KEY (role_id, permission_id)

UserRole (junction)
  user_id         uuid FK → persons
  role_id         uuid FK → roles
  tenant_id       uuid
  branch_id       uuid NULL    -- constrains scope to a branch
  granted_by      uuid FK → persons
  granted_at      timestamptz
  expires_at      timestamptz NULL
  PRIMARY KEY (user_id, role_id)
```

### Permission Naming Convention

```
{scope}.{resource}:{action}

Examples:
  assets:read
  assets:create
  assets:update
  assets:delete
  tracking:read
  commission.plans:create
  commission.settlements:approve
  iam.roles:assign
  platform.tenants:read
  platform.impersonation:start
```

Actions follow a closed vocabulary: `read`, `create`, `update`, `delete`, `manage`, `approve`, `start`, `revoke`, `assign`, `suspend`, `archive`.

### Permission Evaluation

1. Collect all roles assigned to the authenticated user (`UserRole` for their tenant).
2. Collect all permissions for those roles (`RolePermission`).
3. Check if the required permission key is in the collected set.
4. If a `branch_id` is set on the `UserRole`, verify the requested resource belongs to that branch (or its children, depending on configured scope mode).

### System Roles

System roles cannot be deleted or have their permission sets reduced below the minimum defined by the platform. Tenants may add permissions to custom copies of system roles on the Enterprise plan.

| System Role Key       | Tier     | Notes             |
| --------------------- | -------- | ----------------- |
| `platform_owner`      | Platform | Single super-role |
| `platform_admin`      | Platform |                   |
| `platform_commercial` | Platform |                   |
| `platform_finance`    | Platform |                   |
| `platform_billing`    | Platform |                   |
| `platform_support_n1` | Platform |                   |
| `platform_support_n2` | Platform |                   |
| `platform_support_n3` | Platform |                   |
| `platform_auditor`    | Platform | Read-only         |
| `platform_developer`  | Platform |                   |
| `platform_ai_manager` | Platform |                   |
| `tenant_owner`        | Tenant   |                   |
| `tenant_admin`        | Tenant   |                   |
| `fleet_manager`       | Tenant   |                   |
| `operations_manager`  | Tenant   |                   |
| `commercial_manager`  | Tenant   |                   |
| `financial_manager`   | Tenant   |                   |
| `supervisor`          | Tenant   |                   |
| `operator`            | Tenant   |                   |
| `driver`              | Tenant   |                   |
| `customer`            | Tenant   | External-facing   |

---

## 2. ABAC — Attribute-Based Access Control

ABAC policies add conditions on top of RBAC. A user who holds the required permission may still be denied if an ABAC policy evaluates to false.

### Policy Structure

```
Policy
  id              uuid PK
  tenant_id       uuid (NULL for platform policies)
  name            text
  description     text
  effect          enum  "allow" | "deny"
  priority        integer   -- lower number = higher priority
  subject         JSONB     -- who the policy applies to
  resource        JSONB     -- what resource is being accessed
  conditions      JSONB     -- the evaluated conditions
  is_active       boolean
  created_by      uuid FK → persons
  created_at      timestamptz
```

### Condition Operators

| Operator   | Description        | Example                                       |
| ---------- | ------------------ | --------------------------------------------- |
| `eq`       | Equals             | `session.mfaVerified eq true`                 |
| `neq`      | Not equals         | `resource.status neq deleted`                 |
| `in`       | In a set           | `resource.branchId in user.branchScope`       |
| `not_in`   | Not in a set       | `request.ipAddress not_in tenant.blockedIps`  |
| `gt`       | Greater than       | `resource.amount gt 5000`                     |
| `lte`      | Less than or equal | `time.hour lte 20`                            |
| `contains` | Set contains value | `user.branchScope contains resource.branchId` |
| `match`    | Regex match        | `resource.sku match "^BRL-"`                  |

### Built-in Condition Attributes

#### Subject Attributes (`user.*`, `session.*`)

| Attribute                | Type        | Description                                     |
| ------------------------ | ----------- | ----------------------------------------------- |
| `user.id`                | uuid        | Authenticated user ID                           |
| `user.tenantId`          | uuid        | Tenant the user belongs to                      |
| `user.roles`             | string[]    | All role keys currently assigned                |
| `user.branchScope`       | uuid[]      | Branch IDs accessible to this user              |
| `user.capabilities`      | string[]    | Active capability keys                          |
| `session.mfaVerified`    | boolean     | Whether the current session completed MFA       |
| `session.mfaMethod`      | string      | `totp` \| `sms` \| `email`                      |
| `session.isImpersonated` | boolean     | Whether the current session is an impersonation |
| `session.createdAt`      | timestamptz | When the session was started                    |

#### Resource Attributes (`resource.*`)

| Attribute                 | Type    | Description                               |
| ------------------------- | ------- | ----------------------------------------- |
| `resource.tenantId`       | uuid    | Tenant that owns the resource             |
| `resource.branchId`       | uuid    | Branch the resource belongs to            |
| `resource.assignedUserId` | uuid    | User the resource is directly assigned to |
| `resource.customerId`     | uuid    | Customer associated with the resource     |
| `resource.status`         | string  | Current lifecycle status                  |
| `resource.amount`         | numeric | Monetary value (for financial resources)  |

#### Request Attributes (`request.*`, `time.*`)

| Attribute           | Type    | Description               |
| ------------------- | ------- | ------------------------- |
| `request.ipAddress` | string  | Client IP address         |
| `request.userAgent` | string  | Client user agent string  |
| `time.hour`         | integer | Current hour (0–23, UTC)  |
| `time.dayOfWeek`    | integer | 0 = Sunday … 6 = Saturday |

### Platform-Defined ABAC Policies (Non-configurable)

These policies are enforced by the platform and cannot be overridden by tenants.

| Policy                       | Effect     | Condition                                                              |
| ---------------------------- | ---------- | ---------------------------------------------------------------------- |
| Tenant isolation             | DENY       | `resource.tenantId neq user.tenantId`                                  |
| Deleted resource access      | DENY       | `resource.status eq deleted` (except for audit roles)                  |
| Impersonation read-only (N2) | DENY write | `session.isImpersonated eq true AND actor.role eq platform_support_n2` |
| Own-resource driver scope    | DENY       | `user.roles contains driver AND resource.assignedUserId neq user.id`   |

### Tenant-Configurable ABAC Policies

Tenants with the `iam.advanced_policies` capability can configure custom ABAC policies. Configurable policies supplement but cannot override platform-defined policies.

Common tenant-configurable policies:

| Policy Template             | Description                                                   |
| --------------------------- | ------------------------------------------------------------- |
| Business hours restriction  | Deny access outside configured working hours                  |
| IP allowlist                | Deny access from IPs outside the tenant allowlist             |
| MFA step-up for IAM         | Require MFA verification for role and policy write operations |
| MFA step-up for financial   | Require MFA for approval and settlement operations            |
| High-value approval trigger | Route operations above a threshold to approval workflow       |
| Branch isolation            | Enforce branch scope on managers (blocks cross-branch reads)  |

---

## 3. Branch Scope

Branch scope defines which branches a user can access resources from. It is configured per `UserRole` assignment.

### Scope Modes

| Mode                  | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `root`                | Access to all branches in the tenant (full tree)          |
| `branch_and_children` | Access to the assigned branch and all descendant branches |
| `branch`              | Access to the assigned branch only                        |
| `custom`              | Access to an explicit list of branch IDs                  |

### Resolution

When a user with `branch_and_children` scope makes a request for resources:

1. The API query receives the user's `assigned_branch_id`.
2. The query uses a recursive CTE (or application-level branch tree) to resolve all descendant branch IDs.
3. The resource query includes `WHERE branch_id IN (resolved_branch_ids)`.

This is enforced in the application query layer, not in PostgreSQL RLS (RLS only enforces `tenant_id`).

---

## 4. Capability Scope

Capabilities gate access to platform engines and features independently of RBAC. A user with a permission but without the required capability is denied with a distinct `403 CAPABILITY_REQUIRED` response.

Capabilities are activated at the tenant plan level and optionally restricted to specific roles or users.

### Capability Keys

| Key                         | Engine                | Available From Plan |
| --------------------------- | --------------------- | ------------------- |
| `tracking.basic`            | Tracking Engine       | Starter             |
| `tracking.geofence`         | Tracking Engine       | Professional        |
| `tracking.telemetry`        | Tracking Engine       | Professional        |
| `tracking.history`          | Tracking Engine       | Starter             |
| `commission.basic`          | Commission Engine     | Starter             |
| `commission.plans`          | Commission Engine     | Professional        |
| `commission.campaigns`      | Commission Engine     | Professional        |
| `commission.settlements`    | Commission Engine     | Enterprise          |
| `iam.delegation`            | Tenant IAM            | Professional        |
| `iam.advanced_policies`     | Tenant IAM            | Enterprise          |
| `studio.access_control`     | Access Control Studio | Professional        |
| `studio.commercial`         | Commercial Studio     | Professional        |
| `ai.route_optimization`     | AI Engine             | Enterprise          |
| `ai.predictive_maintenance` | AI Engine             | Enterprise          |

---

## 5. Delegated Access

Allows a user to grant a subset of their own permissions to another user for a bounded time period.

### Rules

| Rule             | Detail                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Scope            | A delegator can only grant permissions they currently hold                                                 |
| Time bound       | `expires_at` is mandatory; no open-ended delegations                                                       |
| Chain delegation | Not permitted — a delegatee cannot re-delegate received permissions                                        |
| Branch scope     | Delegation inherits the narrower of the delegator's scope and the scope specified at grant                 |
| Revocation       | Delegator, Tenant Admin, Tenant Owner, or Platform Admin can revoke at any time                            |
| Audit            | All delegated actions are logged with the delegation ID — distinguishable from the delegatee's own actions |
| Capability       | Tenant must have `iam.delegation` capability enabled                                                       |

### Data Model

```
Delegation
  id              uuid PK
  tenant_id       uuid
  grantor_id      uuid FK → persons
  grantee_id      uuid FK → persons
  permissions     text[]    -- permission keys being delegated
  branch_scope    uuid[]    -- branch IDs in scope
  reason          text
  granted_at      timestamptz
  expires_at      timestamptz NOT NULL
  revoked_at      timestamptz NULL
  revoked_by      uuid NULL FK → persons
```

---

## 6. Impersonation

Allows platform operators to act on behalf of a tenant user for support and diagnostic purposes.

### Rules

| Rule                    | Detail                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Who can initiate        | Platform Owner, Platform Admin, Platform Support N2 (read-only), Platform Support N3                                                    |
| Required pre-conditions | Initiator must have active MFA session; reason must be provided                                                                         |
| Tenant notification     | Tenant Owner and Tenant Admin receive a notification when impersonation starts                                                          |
| Tenant visibility       | Tenant Owner and Admin can see impersonation sessions for their tenant (actor, reason, time)                                            |
| Max duration            | 4 hours (2 hours for Support N2 read-only)                                                                                              |
| Action audit            | All actions performed during the session are logged under the impersonated user's audit trail, tagged with the impersonation session ID |
| Termination             | Initiator can end the session; it also auto-terminates on expiry or if the tenant owner revokes consent                                 |

### Data Model

```
ImpersonationSession
  id              uuid PK
  platform_actor  uuid FK → platform_users
  tenant_id       uuid
  target_user     uuid FK → persons
  reason          text NOT NULL
  access_mode     enum  "full" | "read_only"
  started_at      timestamptz
  ended_at        timestamptz NULL
  secondary_auth  uuid NULL FK → platform_users   -- who confirmed the session
```

---

## 7. MFA Policy

### Platform Operator MFA

| Role                | MFA Requirement                     |
| ------------------- | ----------------------------------- |
| Platform Owner      | Always on; all sessions require MFA |
| Platform Admin      | Required for all write operations   |
| Platform Support N3 | Required for impersonation start    |
| Platform Support N2 | Required for impersonation start    |
| All others          | Required at login for all sessions  |

### Tenant User MFA

MFA is configured per tenant via `tenant.mfa_policy`. Defaults:

| Role               | Default Requirement                          |
| ------------------ | -------------------------------------------- |
| Tenant Owner       | Required for write operations                |
| Tenant Admin       | Required for IAM write operations            |
| Financial Manager  | Required for settlement and invoice approval |
| Commercial Manager | Required for settlement approval             |
| All others         | Optional (tenant can enforce per-role)       |

### MFA Methods Supported

| Method    | Description                        | Security Level |
| --------- | ---------------------------------- | -------------- |
| TOTP      | Time-based OTP (Authenticator app) | High           |
| SMS OTP   | One-time code via SMS              | Medium         |
| Email OTP | One-time code via email            | Medium         |
| WebAuthn  | Hardware security key or passkey   | Highest        |

---

## 8. Session Policy

| Parameter                            | Default    | Configurable by |
| ------------------------------------ | ---------- | --------------- |
| Session duration                     | 8 hours    | Tenant Admin    |
| Inactivity timeout                   | 2 hours    | Tenant Admin    |
| Maximum concurrent sessions          | 3          | Tenant Admin    |
| Session revocation on role change    | Immediate  | Platform        |
| MFA step-up validity                 | 30 minutes | Tenant Admin    |
| Platform operator session duration   | 4 hours    | Platform Owner  |
| Platform operator inactivity timeout | 30 minutes | Platform Owner  |

---

## 9. Audit Log

All authorization decisions (allow and deny), role assignments, delegation grants, impersonation sessions, and policy changes are written to the immutable audit log.

### Audit Event Structure

```
AuditEvent
  id              uuid PK
  tenant_id       uuid NULL   -- NULL for platform-level events
  actor_id        uuid        -- user performing the action
  actor_type      enum  "platform_operator" | "tenant_user" | "system"
  impersonation_id uuid NULL  -- set if action occurred in an impersonation session
  delegation_id   uuid NULL   -- set if action was performed via delegation
  event_type      text        -- e.g. "iam.role.assigned", "auth.login.mfa_success"
  resource_type   text        -- e.g. "Role", "Asset"
  resource_id     uuid NULL
  outcome         enum  "allow" | "deny"
  deny_reason     text NULL   -- RBAC | ABAC | APPROVAL_REQUIRED | CAPABILITY_REQUIRED
  metadata        jsonb
  occurred_at     timestamptz NOT NULL
```

### Retention

| Tier                   | Retention                                          |
| ---------------------- | -------------------------------------------------- |
| Platform audit log     | 7 years (immutable)                                |
| Tenant audit log       | 2 years (configurable up to 7 years on Enterprise) |
| Impersonation sessions | 7 years (immutable)                                |
