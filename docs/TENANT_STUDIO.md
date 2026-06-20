# Tenant Studio — Shinã Platform

> Last updated: 2026-06-20 (Milestone 1.1 — Documentation Alignment)

The Tenant Studio is the operator-facing configuration interface that allows authorized users to configure platform behavior without writing code or opening a support ticket.

Studios are **web modules** surfaced within the main application. Each studio maps to one or more platform engines and is gated by both a **permission** and a **capability**.

---

## Studio Architecture

```
┌────────────────────────────────────────────────────────┐
│                    Studio Shell                        │
│         (Auth · Navigation · Audit · Help)             │
└────┬──────────────┬────────────────┬──────────────┬────┘
     │              │                │              │
┌────▼────┐   ┌─────▼──────┐  ┌─────▼────┐  ┌─────▼────┐
│ Access  │   │ Commercial │  │  Config  │  │Reporting │
│ Control │   │  Studio    │  │  Studio  │  │  Studio  │
│ Studio  │   │            │  │          │  │          │
└─────────┘   └────────────┘  └──────────┘  └──────────┘
```

---

## Access Control Studio

**Capability required:** `studio.access_control`  
**Permission required:** `studio.access_control:access`  
**Maps to:** Tenant IAM engine

The Access Control Studio provides a visual interface for configuring the entire Tenant IAM layer. Changes are versioned and audited.

---

### Module: Role Manager

Create, clone, edit, and archive roles. Assign and remove permissions with a searchable permission picker.

**Features:**
- Role list with permission counts and user counts
- Visual permission builder (grouped by resource)
- Role cloning — start from an existing role
- Role comparison — diff two roles side by side
- Archive role (users retain role until re-assigned)
- System roles displayed as read-only

**Key permissions:**
- `studio.access_control:manage_roles`

---

### Module: Policy Editor

Create and manage ABAC policies with a structured condition builder. No knowledge of policy DSL required.

**Features:**
- Policy list with effect (Allow/Deny), resource patterns, and active conditions
- Visual condition builder (attribute → operator → value)
- Policy simulation — test a policy against a hypothetical request
- Policy priority management (drag to reorder)
- Policy conflict detection — warns when Deny overrides existing Allow
- Policy activation / deactivation without deletion

**Key permissions:**
- `studio.access_control:manage_policies` (requires MFA step-up)

---

### Module: Branch Manager

Define and manage the organizational branch hierarchy.

**Features:**
- Tree visualization of branch hierarchy
- Create, rename, move, and deactivate branches
- Assign users to branches with scope mode selection
- View users per branch and their effective scope
- Bulk user scope migration when branches are restructured

**Key permissions:**
- `studio.access_control:manage_branches`

---

### Module: Capability Manager

Enable and disable platform capabilities at tenant or user level. Set expiry dates for time-limited capabilities.

**Features:**
- Capability catalog with description and engine mapping
- Toggle capabilities per tenant
- Assign capability scope overrides to individual users
- Set expiry dates for temporary capabilities
- View capability usage (which users have each capability active)

**Key permissions:**
- `studio.access_control:manage_capabilities` (requires MFA step-up)

---

### Module: Delegation Center

View and manage all active access delegations within the tenant.

**Features:**
- Active delegation list with grantor, grantee, permissions, and expiry
- Revoke any delegation (admin/owner)
- Expiring soon alerts (7-day warning)
- Delegation history (expired and revoked)
- Export delegation audit report

---

### Module: Audit Viewer

Read-only view of the tenant IAM audit log.

**Features:**
- Searchable and filterable event log
- Filter by: user, action, resource, date range, event type
- Impersonation session markers
- Export to CSV
- Drill into individual events with full payload

---

## Commercial Studio

**Capability required:** `studio.commercial`  
**Permission required:** `studio.commercial:access`  
**Maps to:** Commission Engine

The Commercial Studio provides a visual interface for managing the full commission lifecycle — from plan creation to settlement approval.

---

### Module: Plan Builder

Create and manage commission plans and their rules.

**Features:**
- Plan list with status (draft / active / archived) and validity period
- Plan creation wizard:
  - Choose plan type: percentage / fixed / tiered / hybrid
  - Add rules with visual condition builder
  - Set commission basis: gross_value / net_value / quantity
  - Set cap amounts per rule
  - Set rule priority order
- Plan preview — simulate plan against sample transactions
- Plan versioning — editing creates a new version; old version archived
- Plan activation / archiving
- Plan comparison — diff two plan versions

**Key permissions:**
- `studio.commercial:manage_plans`

---

### Module: Campaign Manager

Create and manage time-limited commission campaigns.

**Features:**
- Campaign calendar view (Gantt-style)
- Campaign creation:
  - Link to a base commission plan
  - Define override rules and bonus amounts
  - Set start/end dates
  - Select eligible agents (all or a subset)
- Overlap detection — warns if two campaigns conflict for the same agents
- Campaign status tracking: draft / active / ended
- Campaign performance summary (total transactions, total commission paid)

**Key permissions:**
- `studio.commercial:manage_campaigns`

---

### Module: Transaction Review

Review individual commission transactions before they enter settlement.

**Features:**
- Transaction queue filterable by: agent, plan, status, date range, amount
- Transaction detail view with calculation breakdown (which rule applied, why)
- Bulk approve / reject with required comment
- Individual override — manually adjust commission amount with audit justification
- Dispute tracking — flag transactions for investigation
- Export transactions to CSV/XLSX

**Key permissions:**
- `studio.commercial:approve_transactions`

---

### Module: Settlement Console

Manage the settlement process — batch transactions by agent and period, submit for approval, and record payment.

**Features:**
- Settlement generator — select period and agents, preview totals before creating batch
- Settlement list with status and total amounts
- Approval workflow integration — submit settlement for multi-level approval
- Settlement approval queue for approvers
- Payment recording — mark settlements as paid with reference number
- Settlement report — download per-agent commission statements
- Reconciliation view — compare expected vs. actual payouts

**Key permissions:**
- `studio.commercial:approve_settlements` (requires MFA step-up for high-value settlements)

---

## Config Studio

**Capability required:** `config.studio` (platform default: enabled)  
**Maps to:** Config Engine

Manage runtime configuration keys at tenant level without deployment.

**Features:**
- Config key list with current value, type, and last modified date
- Edit config values with type validation
- Config history — full change log with before/after values
- Environment promotion — copy config from staging to production (platform feature)
- Config schema view — see all available keys with documentation

---

## Reporting Studio

**Capability required:** `reports.studio`  
**Maps to:** Reporting Engine

Access and schedule reports.

**Features:**
- Report catalog — pre-built reports by category
- Custom report builder (drag-and-drop, M5+)
- Scheduled report configuration
- Report history and download
- Dashboard embedding

---

## Studio Audit Trail

All configuration changes made in any Studio module are recorded in the tenant audit log with:
- `actor` — who made the change
- `studio` — which studio module
- `action` — what was changed
- `before` — previous state (JSON)
- `after` — new state (JSON)
- `timestamp`
- `impersonationId` — if the change was made during an impersonation session

Studio audit entries cannot be deleted.
