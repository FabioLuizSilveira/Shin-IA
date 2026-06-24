# Tenant IAM — Shinã Platform

> Last updated: 2026-06-20 (M4.0 — IAM Design)

Defines all roles that operate **within a tenant boundary**. Tenant users manage fleet, operations, commercial programs, and financial records scoped exclusively to their own tenant. The tenant boundary is enforced at the database layer (RLS) and at the API layer (JWT `tenant_id` claim verification).

See [`IAM.md`](IAM.md) for the combined IAM model overview.  
See [`AUTHORIZATION_MODEL.md`](AUTHORIZATION_MODEL.md) for the underlying RBAC + ABAC specification.  
See [`ACCESS_MATRIX.md`](ACCESS_MATRIX.md) for the full permission matrix.  
See [`PLATFORM_IAM.md`](PLATFORM_IAM.md) for platform-level roles.

---

## Role Hierarchy

```
Tenant Owner
└── Tenant Admin
    ├── Fleet Manager
    ├── Operations Manager
    ├── Commercial Manager
    └── Financial Manager
        └── (approver delegation)
Supervisor        ← reports to Fleet/Operations Manager
Operator          ← reports to Supervisor
Driver            ← assigned to Operations Manager / Supervisor
Customer          ← self-service, limited read access
```

The hierarchy represents accountability chains, not permission inheritance. Each role has an independent permission set. Managers may delegate a subset of their permissions to Supervisors using the Delegated Access mechanism.

---

## Roles

### Tenant Owner

**Identity:** The legal and administrative owner of the tenant account. Typically a company director, founding partner, or authorized representative.

**Responsibilities:**

- Ultimate accountability for all activities within the tenant
- Accepts Shinã Platform terms of service and data processing agreements
- Invites and manages Tenant Admin accounts
- Configures branch structure at the root level
- Activates and deactivates platform capabilities for the tenant
- Configures tenant-wide policies (MFA enforcement, session duration, IP allowlists)
- Approves and finalizes commission settlements
- Reviews and approves high-value financial operations
- Accesses all audit logs within the tenant
- Manages tenant API keys and external integrations
- Closes the tenant account (requires cooling-off confirmation)

**Branch scope:** `root` — access to all branches and sub-branches

**MFA:** Required for all write operations. Required at login for all sessions.

**Permission scope:** All tenant permissions (`*`) except those reserved for platform operators.

---

### Tenant Admin

**Identity:** Operational administrator who manages the day-to-day configuration of the tenant account without the legal liability of the owner role.

**Responsibilities:**

- Creates and manages user accounts within the tenant
- Assigns and revokes roles for all non-owner users
- Configures branch structure (create, rename, deactivate branches)
- Manages organizational units (organizations, departments, cost centers)
- Configures ABAC policies (custom conditions on resources and operations)
- Manages capability assignments per user or per branch
- Accesses all audit logs within the tenant
- Configures notifications and alert channels
- Manages external integration credentials (IoT device connectors, ERP webhook endpoints)
- Reviews and approves commission settlements in the absence of Tenant Owner
- Manages tenant API keys

**Branch scope:** `root` — access to all branches

**MFA:** Required for all IAM write operations (role assignment, policy changes).

**Permission scope:** All tenant permissions except `tenant.owner:manage` and `tenant.account:close`.

---

### Fleet Manager

**Identity:** Responsible for managing all fleet assets — vehicles, equipment, and tracking devices — within an assigned scope.

**Responsibilities:**

- Creates, edits, and deactivates asset records (vehicles, equipment, sensors)
- Assigns tracking devices to assets
- Manages geofences relevant to their branch scope
- Monitors asset positions in real time via the live map
- Accesses telemetry data and tracking history for their assets
- Creates and manages asset maintenance schedules
- Generates fleet utilization and performance reports
- Assigns assets to drivers and operations
- Manages resource records tied to fleet assets
- Receives and acts on tracking alerts (speeding, geofence breach, idle)

**Branch scope:** Configurable at assignment time — `root`, `branch_and_children`, `branch`, or `custom`. Default: `branch_and_children`.

**MFA:** Not required by default; tenant can enforce per-role.

**Permission scope:** `assets.*`, `tracking.*`, `resources:read`, `geofences.*`, `reports.fleet:read`

---

### Operations Manager

**Identity:** Responsible for planning and overseeing operational activities — trips, allocations, and workforce coordination.

**Responsibilities:**

- Creates and manages operation records (trips, routes, services)
- Allocates assets and drivers to operations
- Monitors real-time operation status across their branch scope
- Reviews and closes completed operations
- Manages driver assignments and schedules
- Creates and manages contracts linked to operations
- Generates operational performance reports (on-time rate, utilization, route efficiency)
- Receives and acts on operation alerts (delayed trip, unplanned stop)
- Manages supervisor accounts within their branch
- Approves or rejects driver expense claims linked to operations

**Branch scope:** Configurable — default `branch_and_children`.

**MFA:** Not required by default.

**Permission scope:** `operations.*`, `allocations.*`, `contracts:read`, `drivers:read`, `reports.operations:read`

---

### Commercial Manager

**Identity:** Responsible for defining and managing commercial programs — commission plans, campaigns, and partner agreements.

**Responsibilities:**

- Creates and manages commission plans (structure, tiers, rules)
- Creates and manages commission campaigns and their eligibility criteria
- Reviews and approves commission transactions within their authority level
- Initiates commission settlement requests
- Manages customer contracts and commercial agreements
- Configures commercial workflows (multi-step approval flows)
- Generates commercial performance reports (commission earned, pipeline, settlements)
- Manages customer accounts and their associated contracts
- Configures product catalogue and pricing for quotation purposes

**Branch scope:** Configurable — default `branch_and_children`.

**MFA:** Required for commission settlement approval.

**Permission scope:** `commission.*`, `contracts.*`, `customers:read`, `reports.commercial:read`

---

### Financial Manager

**Identity:** Responsible for financial oversight — billing accounts, invoices, and financial reporting.

**Responsibilities:**

- Views and manages billing account records linked to customers and contracts
- Reviews and approves invoices before submission to customers
- Manages payment receipt records
- Approves commission settlements above the configured threshold
- Generates financial reports (outstanding invoices, revenue by branch, settlement totals)
- Manages bank account and payment method records for settlement disbursement
- Configures financial workflows (invoice approval, payment confirmation)
- Reviews and acts on payment failure notifications

**Branch scope:** `root` — financial records span the full tenant.

**MFA:** Required for settlement approval and high-value invoice operations.

**Permission scope:** `billing.*`, `invoices.*`, `commission.settlements:approve`, `reports.financial:read`

---

### Supervisor

**Identity:** First-line leader responsible for a team of Operators and Drivers within a specific branch.

**Responsibilities:**

- Monitors the real-time activity of their assigned team
- Assigns and reassigns drivers to operations on short notice
- Creates and closes operation records for their team
- Reviews and validates driver activity logs (trips completed, hours worked)
- Escalates operational issues to Operations Manager
- Reviews tracking data for their assigned assets
- Generates daily activity reports for their team
- Approves minor operational deviations (late departure, route change)

**Branch scope:** `branch` — their directly assigned branch only. Cannot access sub-branches unless explicitly granted.

**MFA:** Not required by default.

**Permission scope:** `operations:read`, `operations:update` (own branch), `allocations:read`, `drivers:read` (own branch), `tracking:read` (own assets)

---

### Operator

**Identity:** Operational staff member who records and manages day-to-day activities — typically a dispatcher, logistics coordinator, or backoffice clerk.

**Responsibilities:**

- Creates and updates operation records under supervision
- Records asset check-in and check-out for assignments
- Logs maintenance events and occurrences
- Updates contract and customer contact information
- Generates standard operational reports
- Registers tracking events and occurrences
- Responds to system notifications relevant to their assigned scope
- Records goods received and dispatched against operations

**Branch scope:** `branch` — assigned branch only.

**MFA:** Not required by default.

**Permission scope:** `operations:create`, `operations:update`, `assets:read`, `tracking:read`, `notifications:read`

---

### Driver

**Identity:** Field operator who performs trips and is tracked via the mobile application.

**Responsibilities:**

- Views their own assigned operations and itinerary via the mobile app
- Starts and ends trips on assigned operations
- Records occurrences (incidents, stops, delays) against their active operation
- Receives real-time notifications relevant to their operations
- Views their own tracking history (for transparency)
- Views their own commission transactions and campaign participation
- Submits expense claims against their operations (if capability enabled)
- Views their own driver profile and assigned assets

**Branch scope:** Own resources only — all access is filtered by `resource.assignedUserId = user.id`.

**MFA:** Not required.

**Permission scope:** `operations:read` (own), `tracking:read` (own), `occurrences:create`, `notifications:read` (own), `commission.transactions:read` (own), `profile:read`, `profile:write`

---

### Customer

**Identity:** External party (end customer or partner) who has been granted self-service portal access to track their contracts, orders, or deliveries.

**Responsibilities:**

- Views their own contracts and order status
- Tracks deliveries or operations assigned to their account
- Downloads invoices and billing statements
- Submits support requests via the customer portal
- Updates their own contact information
- Views geofence events related to their shipments (if enabled)

**Branch scope:** Customer scope — filtered by `resource.customerId = user.customerId`. No branch access.

**MFA:** Not required by default; tenant can enforce.

**Permission scope:** `contracts:read` (own), `invoices:read` (own), `tracking:read` (own shipments), `notifications:read` (own), `profile:read`, `profile:write`

---

## Tenant Role Summary

| Role               | Branch Scope  | MFA Enforced   | Can Delegate         | Headcount |
| ------------------ | ------------- | -------------- | -------------------- | --------- |
| Tenant Owner       | root          | Always (write) | Yes (any permission) | 1–3       |
| Tenant Admin       | root          | IAM writes     | Yes (any permission) | 1–5       |
| Fleet Manager      | configurable  | Tenant policy  | Yes (scoped)         | varies    |
| Operations Manager | configurable  | Tenant policy  | Yes (scoped)         | varies    |
| Commercial Manager | configurable  | Settlements    | Yes (scoped)         | varies    |
| Financial Manager  | root          | Approval ops   | Yes (scoped)         | 1–3       |
| Supervisor         | branch        | Tenant policy  | Limited              | varies    |
| Operator           | branch        | Tenant policy  | No                   | varies    |
| Driver             | own resources | No             | No                   | varies    |
| Customer           | own records   | Tenant config  | No                   | varies    |

---

## Custom Roles

Tenants on the **Enterprise** plan can define custom roles by composing permissions from the platform-defined permission catalogue. Custom roles:

- Must be a strict subset of the Tenant Admin permission set
- Cannot grant permissions not already held by the user creating the role
- Are scoped to the tenant — not portable between tenants
- Are managed via Access Control Studio
- Require the `iam.advanced_policies` capability to be activated for the tenant

---

## Role Assignment Rules

| Rule                           | Detail                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| A user may hold multiple roles | Permissions are additive across all assigned roles                                           |
| Role assignment requires       | The assigner to hold `iam.roles:assign` and to themselves hold all permissions being granted |
| Tenant Owner assignment        | Only the current Tenant Owner or Platform Admin can assign the Tenant Owner role             |
| Role revocation                | Tenant Owner or Tenant Admin can revoke any role; Managers can revoke roles they assigned    |
| Self-assignment                | Not permitted — a user cannot assign a role to themselves                                    |
