# Approval Workflows — Shinã Platform

> Last updated: 2026-06-20 (M4.0 — IAM Design)

Defines all approval workflows in the Shinã Platform — operations that require human authorization before being executed. The Approval Workflow engine is an overlay on top of the RBAC + ABAC model: a user may hold the correct permission and pass ABAC conditions, yet the operation is still paused for review based on configurable thresholds or mandatory approval rules.

See [`AUTHORIZATION_MODEL.md`](AUTHORIZATION_MODEL.md) for how approval gates fit into the overall authorization pipeline.  
See [`ACCESS_MATRIX.md`](ACCESS_MATRIX.md) for which roles can submit and approve each workflow type.

---

## Workflow Engine Model

### Workflow States

```
DRAFT → PENDING → APPROVED → EXECUTED
                → REJECTED
                → EXPIRED
                → CANCELLED
```

| State       | Description                                                      |
| ----------- | ---------------------------------------------------------------- |
| `DRAFT`     | Created but not yet submitted for approval                       |
| `PENDING`   | Submitted; waiting for at least one approver to act              |
| `APPROVED`  | All required approvers have approved; ready for execution        |
| `REJECTED`  | At least one approver rejected; operation cancelled              |
| `EXPIRED`   | Reached the expiry deadline with insufficient approvals          |
| `EXECUTED`  | The underlying operation was performed after approval            |
| `CANCELLED` | The submitter cancelled the request before it was fully approved |

### Data Model

```
WorkflowInstance
  id              uuid PK
  tenant_id       uuid
  workflow_type   text          -- e.g. "commission.settlement.approve"
  status          workflow_status
  subject_type    text          -- e.g. "CommissionSettlement"
  subject_id      uuid          -- the resource being approved
  submitted_by    uuid FK → persons
  submitted_at    timestamptz
  expires_at      timestamptz
  metadata        jsonb         -- workflow-type-specific payload snapshot
  version         integer

WorkflowStep
  id              uuid PK
  tenant_id       uuid
  workflow_id     uuid FK → workflow_instances
  step_number     integer
  step_type       enum  "approval" | "notification" | "action"
  required_role   text NULL     -- role key that can approve this step
  required_user   uuid NULL     -- specific user required to approve
  status          enum  "pending" | "approved" | "rejected" | "skipped"
  acted_by        uuid NULL FK → persons
  acted_at        timestamptz NULL
  comment         text NULL

WorkflowAudit
  id              uuid PK
  tenant_id       uuid
  workflow_id     uuid FK → workflow_instances
  actor_id        uuid FK → persons
  action          text          -- "submitted" | "approved" | "rejected" | "cancelled" | "expired"
  comment         text NULL
  occurred_at     timestamptz
```

### Notification on Workflow Events

All workflow state transitions trigger notifications to the relevant parties via the Notification Engine. Channels follow the tenant's configured notification preferences per role.

---

## Workflow 1: Commission Settlement Approval

### Purpose

Ensures that commission settlements — which trigger financial payouts to drivers, partners, or employees — are reviewed and authorized before disbursement.

### Trigger Conditions

A settlement approval workflow is triggered when:

- A `CommissionSettlement` record is submitted with status `PENDING_APPROVAL`
- OR the settlement total exceeds the tenant-configured `commission.settlement_auto_approval_limit` (default: BRL 0 — all settlements require approval)

### Steps

| Step | Type     | Required Role                               | Required Approvers | Notes                                                                                  |
| ---- | -------- | ------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| 1    | Approval | `commercial_manager` OR `financial_manager` | 1                  | First-tier review                                                                      |
| 2    | Approval | `tenant_owner` OR `tenant_admin`            | 1                  | Required when total > `commission.settlement_owner_review_limit` (default: BRL 10,000) |

Step 2 is skipped automatically if the settlement total is below `commission.settlement_owner_review_limit`.

### Expiry

- Step 1: 48 hours
- Step 2: 24 hours

### On Rejection

Settlement returns to `DRAFT` status. Submitter receives a notification with the rejection reason. A new settlement may be submitted after correction.

### On Approval

Settlement transitions to `APPROVED`; the payment disbursement process may begin. The settlement record is locked — no further modifications.

### Configurable Thresholds

| Setting                                     | Default    | Configurable by |
| ------------------------------------------- | ---------- | --------------- |
| `commission.settlement_auto_approval_limit` | BRL 0      | Tenant Owner    |
| `commission.settlement_owner_review_limit`  | BRL 10,000 | Tenant Owner    |
| Step 1 expiry (hours)                       | 48         | Tenant Admin    |
| Step 2 expiry (hours)                       | 24         | Tenant Admin    |

---

## Workflow 2: Commission Transaction Approval

### Purpose

High-value or anomalous commission transactions may be flagged for manual review before they are included in a settlement batch.

### Trigger Conditions

- Transaction amount exceeds `commission.transaction_review_threshold` (default: BRL 1,000)
- OR the transaction was generated by a rule marked `requires_approval: true`
- OR the rule engine flagged the transaction as an outlier (>3σ from rolling average for the same commission plan)

### Steps

| Step | Type     | Required Role        | Required Approvers |
| ---- | -------- | -------------------- | ------------------ |
| 1    | Approval | `commercial_manager` | 1                  |

### Expiry

72 hours. If expired without action, the transaction is automatically rejected and logged.

### On Rejection

Transaction transitions to `REJECTED`; it is excluded from future settlement batches. Audit log records the reason.

### On Approval

Transaction transitions to `APPROVED`; it becomes eligible for inclusion in the next settlement batch.

### Configurable Thresholds

| Setting                                   | Default   | Configurable by |
| ----------------------------------------- | --------- | --------------- |
| `commission.transaction_review_threshold` | BRL 1,000 | Tenant Owner    |
| Outlier detection enabled                 | true      | Tenant Admin    |
| Expiry (hours)                            | 72        | Tenant Admin    |

---

## Workflow 3: High-Value Invoice Approval

### Purpose

Invoices above a configured threshold must be reviewed and approved before being sent to the customer, reducing the risk of billing errors.

### Trigger Conditions

- Invoice total exceeds `billing.invoice_approval_threshold` (default: BRL 5,000)
- OR the invoice includes a line item with `requires_approval: true`

### Steps

| Step | Type     | Required Role                    | Required Approvers                                                               |
| ---- | -------- | -------------------------------- | -------------------------------------------------------------------------------- |
| 1    | Approval | `financial_manager`              | 1                                                                                |
| 2    | Approval | `tenant_owner` OR `tenant_admin` | 1 (only if total > `billing.invoice_owner_review_threshold`, default BRL 50,000) |

### Expiry

- Step 1: 24 hours
- Step 2: 12 hours

### On Rejection

Invoice returns to `DRAFT`. The submitter receives the rejection reason. Corrections can be made and the invoice re-submitted.

### On Approval

Invoice transitions to `APPROVED`; it may be sent to the customer.

### Configurable Thresholds

| Setting                                  | Default    | Configurable by |
| ---------------------------------------- | ---------- | --------------- |
| `billing.invoice_approval_threshold`     | BRL 5,000  | Tenant Owner    |
| `billing.invoice_owner_review_threshold` | BRL 50,000 | Tenant Owner    |
| Step 1 expiry (hours)                    | 24         | Tenant Admin    |
| Step 2 expiry (hours)                    | 12         | Tenant Admin    |

---

## Workflow 4: Critical Tenant Configuration Change

### Purpose

Changes to critical tenant configuration — such as MFA enforcement policy, branch structure at root, or capability deactivation — must be reviewed to prevent accidental disruption.

### Trigger Conditions

- Deactivation of a previously active capability (affects all users)
- Changes to the tenant MFA enforcement policy
- Deactivation of a root branch (affects entire branch tree)
- Bulk user deactivation (> 5 users in a single operation)
- Changes to the `tenant.default_currency` setting
- Changes to platform integration credentials (webhook secrets, API keys)

### Steps

| Step | Type     | Required Role  | Required Approvers |
| ---- | -------- | -------------- | ------------------ |
| 1    | Approval | `tenant_owner` | 1                  |

All critical configuration changes require Tenant Owner confirmation regardless of who initiated the change. This includes Tenant Admin — they cannot self-approve these operations.

### Expiry

4 hours. If expired, the change is cancelled and must be re-submitted.

### On Rejection / Expiry

The configuration change is not applied. The system reverts to the prior state. An audit event is written.

### On Approval

The configuration change is applied. A notification is sent to all Tenant Admins. An audit event with the diff is recorded.

---

## Workflow 5: Delegated Access Grant

### Purpose

Delegation grants above a certain scope or duration require approval by the Tenant Admin or Owner to prevent privilege escalation via unchecked delegation.

### Trigger Conditions

- Delegation includes any IAM permission (`iam.*`)
- Delegation includes commission approval or settlement permissions
- Delegation duration exceeds 7 days
- Grantee is a Customer-tier user receiving operational permissions

### Steps

| Step | Type     | Required Role                    | Required Approvers |
| ---- | -------- | -------------------------------- | ------------------ |
| 1    | Approval | `tenant_admin` OR `tenant_owner` | 1                  |

### Expiry

24 hours.

### On Rejection

The delegation is not created. The submitter is notified.

### On Approval

The `Delegation` record is created with `granted_at = approval_time`. The grantee is notified.

---

## Workflow 6: Platform Tenant Suspension

### Purpose

Tenant suspension has significant business impact. It must be confirmed by a senior platform operator before execution.

### Trigger Conditions

- Any call to `platform.tenants:suspend`

### Steps

| Step | Type     | Required Role                        | Required Approvers |
| ---- | -------- | ------------------------------------ | ------------------ |
| 1    | Approval | `platform_admin` OR `platform_owner` | 1                  |

If the initiator is already a Platform Admin, the step requires confirmation from a _second_ Platform Admin or the Platform Owner.

### Expiry

24 hours.

### On Rejection

Suspension is cancelled. Event logged.

### On Approval

Tenant status transitions to `suspended`. All active tenant sessions are immediately invalidated. The Tenant Owner receives a notification with the reason.

### Cooling-off (Reactivation)

After suspension, reactivation is immediate. Deletion (permanent) requires a 72-hour cooling-off period after the reactivation confirmation — enforced by the system regardless of who requests it.

---

## Workflow 7: Impersonation Session Request (N3 + Admin)

### Purpose

Full impersonation sessions initiated by Platform Support N3 require secondary authorization from a Platform Admin or Owner before the session opens.

### Trigger Conditions

- Platform Support N3 initiates an impersonation session with mode `full`

(Platform Admin and Platform Owner initiate their own sessions; N2 read-only sessions do not require a separate approval step — they require only N3 or Admin confirmation at the time of the request.)

### Steps

| Step | Type     | Required Role                        | Required Approvers |
| ---- | -------- | ------------------------------------ | ------------------ |
| 1    | Approval | `platform_admin` OR `platform_owner` | 1                  |

### Expiry

15 minutes. If not confirmed, the impersonation session is not created.

### On Rejection

Session not started. Event logged.

### On Approval

Impersonation session created with the authorized duration. The Tenant Owner and Tenant Admin receive a real-time notification.

---

## Platform-Level Approval Summary

| Workflow                 | Type          | Approvers                            | Expiry    |
| ------------------------ | ------------- | ------------------------------------ | --------- |
| Commission Settlement    | Financial     | Comm/Fin Manager → Owner (if large)  | 48h / 24h |
| Commission Transaction   | Financial     | Commercial Manager                   | 72h       |
| High-Value Invoice       | Financial     | Financial Manager → Owner (if large) | 24h / 12h |
| Critical Config Change   | Configuration | Tenant Owner                         | 4h        |
| Delegated Access Grant   | IAM           | Tenant Admin / Owner                 | 24h       |
| Tenant Suspension        | Platform      | Second Platform Admin / Owner        | 24h       |
| N3 Impersonation Request | Platform      | Platform Admin / Owner               | 15min     |

---

## Approval Notification Rules

| Event                             | Who is Notified             | Channel                    |
| --------------------------------- | --------------------------- | -------------------------- |
| Workflow submitted                | All eligible approvers      | Email + in-app             |
| Approver acts                     | Submitter                   | In-app                     |
| Step approved (more steps remain) | Next step approvers         | Email + in-app             |
| Workflow fully approved           | Submitter                   | In-app                     |
| Workflow rejected                 | Submitter                   | Email + in-app             |
| Workflow expired without action   | Submitter + all approvers   | Email                      |
| Impersonation session started     | Tenant Owner + Tenant Admin | Email + in-app (real-time) |
| Tenant suspended                  | Tenant Owner                | Email + in-app (real-time) |
