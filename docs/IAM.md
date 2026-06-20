# IAM — Identity and Access Management

> Last updated: 2026-06-20 (Milestone 1.1 — Documentation Alignment)

This document specifies the complete IAM model for the Shinã Platform. IAM governs who can do what, on which resources, under what conditions.

See also:
- [`PERMISSIONS_MATRIX.md`](PERMISSIONS_MATRIX.md) — per-feature permission matrix
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system-level IAM overview

---

## Two-Tier IAM Model

The platform separates identity and access into two distinct tiers that do not overlap:

```
┌─────────────────────────────────────────────────┐
│                  PLATFORM IAM                   │
│   Platform operators · Tenant provisioning      │
│   Cross-tenant ops · Platform-level audit       │
└─────────────────────────────────────────────────┘
                         │
              (tenant boundary)
                         │
┌─────────────────────────────────────────────────┐
│                   TENANT IAM                    │
│   Users · Roles · Permissions · Policies        │
│   Branch Scope · Capability Scope               │
│   Delegated Access · Impersonation              │
└─────────────────────────────────────────────────┘
```

---

## Platform IAM

### Overview

Platform IAM governs access to the platform itself. It is operated exclusively by Shinã Platform administrators and is invisible to tenant users.

### Platform Roles

| Role | Description |
|------|-------------|
| `platform:super_admin` | Full platform access. Can manage all tenants, operators, and platform config |
| `platform:admin` | Manage tenants, billing, and platform config. Cannot access tenant data |
| `platform:support` | Read-only access to tenant data for support purposes. Can initiate impersonation with justification |
| `platform:billing` | Manage platform billing, subscriptions, and invoices |
| `platform:readonly` | Audit read-only access to platform audit logs and tenant metadata |

### Platform Policies

Platform policies are evaluated before tenant IAM. A platform policy can:
- **Allow** a platform operator to access a tenant's resources
- **Deny** a tenant from accessing a specific engine or capability
- **Override** tenant-level settings for compliance or emergency purposes

---

## Tenant IAM

### Overview

Tenant IAM governs what authenticated users can do within a specific tenant. Every access decision goes through a policy evaluation chain:

```
Request
  │
  ▼
Authentication (Supabase Auth / SSO)
  │
  ▼
Tenant Resolution (tenantId extracted from JWT)
  │
  ▼
Capability Check (is this feature enabled for tenant?)
  │
  ▼
RBAC Evaluation (does user's role allow this action?)
  │
  ▼
ABAC Evaluation (do attribute conditions pass?)
  │
  ▼
Branch Scope Check (does resource belong to user's branch scope?)
  │
  ▼
Decision: ALLOW / DENY
```

---

## Roles

A **Role** is a named collection of permissions. Roles are assigned to users and can be created, cloned, and archived by tenant administrators.

### System Roles (non-deletable)

| Role | Description |
|------|-------------|
| `tenant:owner` | Full access to all tenant resources and configuration |
| `tenant:admin` | Full operational access; cannot modify IAM settings |
| `tenant:manager` | Manage users and operational entities within branch scope |
| `tenant:operator` | Execute operations; read-only IAM |
| `tenant:viewer` | Read-only across all resources within branch scope |
| `tenant:driver` | Mobile app access; own profile and assigned trips only |

### Custom Roles

Tenant administrators can create custom roles with arbitrary permission sets. Custom roles:
- Must have a unique name within the tenant
- Inherit no permissions by default
- Can be cloned from system or other custom roles
- Are archived (not deleted) to preserve historical audit records

---

## Permissions

A **Permission** is the atomic unit of access control. It represents the ability to perform an **action** on a **resource**.

### Permission Structure

```
<resource>:<action>
```

Examples:
- `assets:read`
- `assets:write`
- `commission.plans:create`
- `tracking.geofences:delete`
- `iam.roles:assign`

### Permission Categories

| Category | Resource Prefix | Examples |
|----------|----------------|---------|
| Asset Management | `assets:` | read, write, delete, assign |
| Fleet Operations | `operations:` | read, create, dispatch, close |
| Tracking | `tracking.*:` | read, configure, acknowledge |
| Commission | `commission.*:` | read, create, approve, settle |
| Billing | `billing.*:` | read, manage |
| IAM | `iam.*:` | read, manage, assign |
| Config | `config:` | read, write |
| Reports | `reports:` | read, export, create |
| Studio | `studio.*:` | access, configure |

---

## Policies

A **Policy** is a set of rules that grant or deny access based on **conditions**. Policies augment RBAC with attribute-based conditions (ABAC).

### Policy Structure

```typescript
type Policy = {
  id: string;
  name: string;
  effect: "allow" | "deny";
  resources: string[];          // e.g. ["assets:*", "tracking.*:read"]
  conditions: PolicyCondition[];
  priority: number;             // Higher = evaluated first; Deny overrides Allow at same priority
};

type PolicyCondition = {
  attribute: string;            // e.g. "user.branch", "resource.ownerId", "time.hour"
  operator: "eq" | "neq" | "in" | "not_in" | "gt" | "lt" | "contains";
  value: unknown;
};
```

### Policy Evaluation Order

1. Explicit **Deny** policies (highest priority — always wins)
2. Explicit **Allow** policies
3. Implicit Deny (default — no match = denied)

---

## ABAC — Attribute-Based Access Control

ABAC extends RBAC by evaluating **attributes** of the requesting user, the resource, and the environment at decision time.

### Available Attributes

**User attributes:**
- `user.id`
- `user.roles`
- `user.branchId`
- `user.branchScope` — list of branch IDs user can access
- `user.capabilityScope` — list of capabilities enabled for user
- `user.department`
- `user.tags`

**Resource attributes:**
- `resource.tenantId`
- `resource.branchId`
- `resource.ownerId`
- `resource.status`
- `resource.tags`
- `resource.capabilities`

**Environment attributes:**
- `time.hour` — 0–23 (server UTC)
- `time.dayOfWeek` — 0–6
- `request.ipAddress`
- `request.userAgent`

### ABAC Use Cases

| Use Case | Policy Example |
|----------|---------------|
| Branch managers see only own-branch assets | `user.branchScope contains resource.branchId` |
| Commission approvers can only approve, not calculate | Role: `commission.transactions:approve`; deny `commission.transactions:calculate` |
| Reports available only during business hours | `time.hour >= 8 AND time.hour <= 18` |
| Sensitive data requires MFA session | `session.mfaVerified = true` |

---

## Branch Scope

**Branch Scope** limits a user's data visibility to one or more organizational branches (e.g., regional offices, depots, cost centers).

### Branch Hierarchy

Branches form a tree:

```
Tenant Root
├── Region: Southeast
│   ├── Branch: São Paulo
│   └── Branch: Rio de Janeiro
└── Region: South
    ├── Branch: Curitiba
    └── Branch: Porto Alegre
```

### Scope Modes

| Mode | Access |
|------|--------|
| `root` | Access to all branches (tenant-wide) |
| `branch` | Access to assigned branch only |
| `branch_and_children` | Access to assigned branch and all its descendants |
| `custom` | Explicit list of branch IDs |

### Branch Scope Resolution

A user's effective scope is the **intersection** of:
1. Their assigned branch scope mode
2. Their role permissions
3. Any active ABAC policies

---

## Capability Scope

**Capability Scope** restricts a user to only the features enabled by their assigned capabilities. Even if a role has a permission, the capability must also be active.

Example: A user has the `tracking.geofences:manage` permission in their role, but the tenant's `tracking.geofence` capability is disabled → access denied.

Capabilities are configured in the [Access Control Studio](TENANT_STUDIO.md#access-control-studio).

---

## Delegated Access

**Delegated Access** allows a user (grantor) to temporarily grant a subset of their own permissions to another user (grantee) without modifying the grantee's base role.

### Rules

- A grantor can only delegate permissions they themselves possess.
- Delegations are always time-bounded (must have `expiresAt`).
- Delegations can be revoked at any time by the grantor or a tenant admin.
- A grantee cannot further delegate delegated permissions.
- Delegated access is visible in the user's session and in the audit log.

### Use Cases

- Manager delegates approval authority while on vacation
- Senior operator delegates limited fleet access to a contractor for one week
- Finance lead delegates commission review to an analyst during peak periods

---

## Impersonation

**Impersonation** allows a Platform IAM `platform:support` or `platform:admin` user to act as a specific tenant user for support and debugging purposes.

### Impersonation Rules

1. **Authorization required:** Impersonation must be explicitly authorized per-session, not by role alone. Requires secondary confirmation.
2. **Reason mandatory:** The operator must provide a written reason before starting.
3. **Immutable audit log:** Every action performed during an impersonation session is logged with `impersonationId` in the immutable platform audit log.
4. **Tenant visibility:** Tenant admins can see impersonation sessions affecting their tenant in their audit log.
5. **Time-limited:** Impersonation sessions expire after a maximum of 4 hours.
6. **MFA required:** The impersonating operator must have completed MFA in their platform session.

---

## MFA — Multi-Factor Authentication

MFA is configurable at tenant level:

| Level | Behavior |
|-------|---------|
| `disabled` | MFA not required (not recommended) |
| `optional` | Users can enroll but not required |
| `required_for_admins` | Required for roles with IAM permissions |
| `required_for_all` | Required for all users |

### Supported MFA Methods

- TOTP (Time-based One-Time Password) — Google Authenticator, Authy
- SMS OTP (configurable per tenant; additional cost)
- Email OTP (fallback)
- Hardware key (FIDO2 / WebAuthn) — planned M6

### MFA Step-Up

Certain sensitive operations require a fresh MFA challenge even within an authenticated session:

- Exporting bulk data (commission reports, tracking history)
- Impersonation initiation
- Role assignment to admin roles
- Capability changes
- Settlement approval above configured threshold

---

## Approval Workflows

Approval workflows intercept sensitive operations and require one or more approvers before execution proceeds.

### Configurable Approvals

| Operation | Default | Configurable |
|-----------|---------|-------------|
| Commission settlement (above threshold) | 1 approver | Yes — threshold and approver count |
| Commission transaction rejection | 1 approver | Yes |
| Role assignment to privileged roles | 1 approver | No |
| Delegation creation | None | Yes |
| Bulk data export | None | Yes |
| Impersonation (platform) | 1 platform admin | No |

### Approval Escalation

If an approver does not act within the configured timeout (default: 48h), the request escalates to the next approver level. After all levels are exhausted, the request expires and must be re-submitted.
