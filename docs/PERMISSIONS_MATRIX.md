# Permissions Matrix — Shinã Platform

> Last updated: 2026-06-20 (Milestone 1.1 — Documentation Alignment)

This document maps platform features to the permissions required to access them, broken down by IAM model layer.

See [`IAM.md`](IAM.md) for the full specification of roles, policies, ABAC, scopes, delegation, and impersonation.

---

## How to Read This Matrix

| Column | Meaning |
|--------|---------|
| **Permission** | The `resource:action` string evaluated by the policy engine |
| **owner** | Tenant Owner — full access |
| **admin** | Tenant Admin — full operational access |
| **manager** | Branch manager — own-branch scope |
| **operator** | Operational staff |
| **viewer** | Read-only |
| **driver** | Mobile-only, own resources |

✅ = Allowed by default role  
🔒 = Allowed but requires MFA step-up  
⚙️ = Configurable via policy  
❌ = Denied

---

## Platform IAM

| Feature | Permission | super_admin | admin | support | billing | readonly |
|---------|-----------|-------------|-------|---------|---------|---------|
| View tenant list | `platform.tenants:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create tenant | `platform.tenants:create` | ✅ | ✅ | ❌ | ❌ | ❌ |
| Suspend tenant | `platform.tenants:suspend` | ✅ | ✅ | ❌ | ❌ | ❌ |
| View platform audit log | `platform.audit:read` | ✅ | ✅ | ✅ | ❌ | ✅ |
| Manage platform operators | `platform.operators:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Start impersonation | `platform.impersonation:start` | 🔒 | 🔒 | 🔒 | ❌ | ❌ |
| Manage platform billing | `platform.billing:manage` | ✅ | ✅ | ❌ | ✅ | ❌ |

---

## Tenant IAM

| Feature | Permission | owner | admin | manager | operator | viewer | driver |
|---------|-----------|-------|-------|---------|----------|--------|--------|
| View users | `iam.users:read` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create users | `iam.users:create` | ✅ | ✅ | ⚙️ | ❌ | ❌ | ❌ |
| Edit users | `iam.users:write` | ✅ | ✅ | ⚙️ | ❌ | ❌ | ❌ |
| Suspend users | `iam.users:suspend` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View roles | `iam.roles:read` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create/edit roles | `iam.roles:manage` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ |
| Assign roles to users | `iam.roles:assign` | ✅ | ✅ | ⚙️ | ❌ | ❌ | ❌ |
| View permissions | `iam.permissions:read` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage policies | `iam.policies:manage` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ |
| View delegations | `iam.delegations:read` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create delegations | `iam.delegations:create` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Revoke delegations | `iam.delegations:revoke` | ✅ | ✅ | ✅ | ⚙️ | ❌ | ❌ |
| View audit log | `iam.audit:read` | ✅ | ✅ | ⚙️ | ❌ | ❌ | ❌ |

---

## RBAC — Role-Based Access Control

| Feature | Permission | owner | admin | manager | operator | viewer | driver |
|---------|-----------|-------|-------|---------|----------|--------|--------|
| View own profile | `profile:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit own profile | `profile:write` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage MFA | `profile.mfa:manage` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View team | `team:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## ABAC — Attribute-Based Access Control

ABAC conditions are evaluated after RBAC. These policies restrict access based on resource or user attributes.

| Policy | Applied to | Condition |
|--------|-----------|-----------|
| Branch isolation | manager | `user.branchScope contains resource.branchId` |
| Own-resource access | driver | `resource.assignedUserId = user.id` |
| Business hours only | ⚙️ configurable | `time.hour >= 8 AND time.hour <= 20` |
| MFA session required | admin IAM ops | `session.mfaVerified = true` |
| IP allowlist | ⚙️ configurable | `request.ipAddress in tenant.allowedIps` |
| High-value approval | commission approvers | `resource.amount > tenant.config.approvalThreshold` |

---

## Branch Scope

| Feature | Permission | root | branch_and_children | branch | custom |
|---------|-----------|------|---------------------|--------|--------|
| View all branches | `branches:read` | ✅ | ❌ | ❌ | ❌ |
| View own branch subtree | `branches:read` | ✅ | ✅ | ❌ | ❌ |
| View own branch only | `branches:read` | ✅ | ✅ | ✅ | ✅ |
| Create sub-branches | `branches:create` | ✅ | ✅ | ❌ | ⚙️ |
| Cross-branch report | `reports.branch:read` | ✅ | ✅ | ❌ | ⚙️ |

---

## Capability Scope

Capabilities gate access to platform features independently of roles. A user with a permission but without the associated capability is denied.

| Capability Key | Engine | Required for |
|---------------|--------|-------------|
| `tracking.basic` | Tracking Engine | View asset positions |
| `tracking.geofence` | Tracking Engine | Create and monitor geofences |
| `tracking.telemetry` | Tracking Engine | Access detailed sensor readings |
| `tracking.history` | Tracking Engine | View historical positions |
| `commission.basic` | Commission Engine | View commission transactions |
| `commission.plans` | Commission Engine | Create and manage commission plans |
| `commission.campaigns` | Commission Engine | Create and manage campaigns |
| `commission.settlements` | Commission Engine | Create and approve settlements |
| `iam.delegation` | Tenant IAM | Use delegated access |
| `iam.advanced_policies` | Tenant IAM | Create ABAC policies |
| `studio.access_control` | Access Control Studio | Configure IAM from studio UI |
| `studio.commercial` | Commercial Studio | Configure commission from studio UI |

---

## Delegated Access

| Rule | Detail |
|------|--------|
| A user can delegate | Only permissions they currently possess |
| Delegation is time-bounded | `expiresAt` is mandatory |
| Chain delegation | Not allowed — grantee cannot re-delegate |
| Revocation | Grantor, tenant admin, or owner can revoke at any time |
| Audit | All delegated actions appear in audit log with delegation ID |

---

## Impersonation

| Rule | Detail |
|------|--------|
| Who can impersonate | Platform `super_admin`, `admin`, `support` only |
| Authorization | Secondary confirmation required per session |
| Reason | Mandatory before session starts |
| Session duration | Maximum 4 hours |
| MFA | Operator must have active MFA session |
| Audit scope | All actions logged in immutable platform audit log |
| Tenant visibility | Tenant owner and admin can view impersonation sessions for their tenant |

---

## Access Control Studio Permissions

| Feature | Permission | owner | admin | manager |
|---------|-----------|-------|-------|---------|
| Open Access Control Studio | `studio.access_control:access` | ✅ | ✅ | ❌ |
| Manage roles in Studio | `studio.access_control:manage_roles` | ✅ | ✅ | ❌ |
| Manage policies in Studio | `studio.access_control:manage_policies` | ✅ | 🔒 | ❌ |
| Configure branch scopes | `studio.access_control:manage_branches` | ✅ | ✅ | ❌ |
| Configure capabilities | `studio.access_control:manage_capabilities` | ✅ | 🔒 | ❌ |

---

## Commercial Studio Permissions

| Feature | Permission | owner | admin | manager |
|---------|-----------|-------|-------|---------|
| Open Commercial Studio | `studio.commercial:access` | ✅ | ✅ | ⚙️ |
| Manage commission plans | `studio.commercial:manage_plans` | ✅ | ✅ | ❌ |
| Manage campaigns | `studio.commercial:manage_campaigns` | ✅ | ✅ | ⚙️ |
| Approve transactions | `studio.commercial:approve_transactions` | ✅ | ✅ | ⚙️ |
| Approve settlements | `studio.commercial:approve_settlements` | ✅ | 🔒 | ❌ |
