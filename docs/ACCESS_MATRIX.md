# Access Matrix — Shinã Platform

> Last updated: 2026-06-20 (M4.0 — IAM Design)

Complete Role × Permission matrix for all Platform IAM and Tenant IAM roles.

**Legend:**
| Symbol | Meaning |
|--------|---------|
| ✅ | Allowed by default for this role |
| 🔒 | Allowed but requires MFA step-up in the current session |
| ⚙️ | Configurable — off by default; tenant or platform admin can enable |
| ❌ | Denied |

See [`AUTHORIZATION_MODEL.md`](AUTHORIZATION_MODEL.md) for the policy engine specification.  
See [`PLATFORM_IAM.md`](PLATFORM_IAM.md) for platform role descriptions.  
See [`TENANT_IAM.md`](TENANT_IAM.md) for tenant role descriptions.

---

## Platform IAM Matrix

Abbreviations: **P.Owner** = Platform Owner, **P.Admin** = Platform Admin, **Comm** = Platform Commercial, **Fin** = Platform Finance, **Bill** = Platform Billing, **N1/N2/N3** = Support tiers, **Aud** = Platform Auditor, **Dev** = Platform Developer, **AI** = Platform AI Manager.

### Tenant Management

| Permission                    | P.Owner | P.Admin | Comm | Fin | Bill | N1  | N2  | N3  | Aud | Dev | AI  |
| ----------------------------- | ------- | ------- | ---- | --- | ---- | --- | --- | --- | --- | --- | --- |
| `platform.tenants:read`       | ✅      | ✅      | ✅   | ✅  | ✅   | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  |
| `platform.tenants:create`     | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.tenants:update`     | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | 🔒  | ❌  | ❌  | ❌  |
| `platform.tenants:suspend`    | ✅      | 🔒      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.tenants:reactivate` | ✅      | 🔒      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.tenants:delete`     | 🔒      | ❌      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |

### Platform Operator Management

| Permission                       | P.Owner | P.Admin | Comm | Fin | Bill | N1  | N2  | N3  | Aud | Dev | AI  |
| -------------------------------- | ------- | ------- | ---- | --- | ---- | --- | --- | --- | --- | --- | --- |
| `platform.operators:read`        | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ✅  | ❌  | ❌  |
| `platform.operators:invite`      | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.operators:assign_role` | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.operators:deactivate`  | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.owners:manage`         | ✅      | ❌      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |

### Commercial & Billing

| Permission                             | P.Owner | P.Admin | Comm | Fin | Bill | N1  | N2  | N3  | Aud | Dev | AI  |
| -------------------------------------- | ------- | ------- | ---- | --- | ---- | --- | --- | --- | --- | --- | --- |
| `platform.commercial:read`             | ✅      | ✅      | ✅   | ✅  | ✅   | ❌  | ❌  | ❌  | ✅  | ❌  | ❌  |
| `platform.commercial.plans:manage`     | ✅      | ✅      | ✅   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.commercial.discounts:manage` | ✅      | ✅      | ✅   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.billing:read`                | ✅      | ✅      | ✅   | ✅  | ✅   | ❌  | ❌  | ❌  | ✅  | ❌  | ❌  |
| `platform.billing.invoices:manage`     | ✅      | ✅      | ❌   | ✅  | ✅   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.billing.credits:create`      | ✅      | ✅      | ❌   | 🔒  | ⚙️   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.billing.refunds:approve`     | ✅      | ✅      | ❌   | 🔒  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.finance.reports:read`        | ✅      | ✅      | ✅   | ✅  | ❌   | ❌  | ❌  | ❌  | ✅  | ❌  | ❌  |

### Support & Impersonation

| Permission                        | P.Owner | P.Admin | Comm | Fin | Bill | N1  | N2  | N3  | Aud | Dev | AI  |
| --------------------------------- | ------- | ------- | ---- | --- | ---- | --- | --- | --- | --- | --- | --- |
| `platform.support.tickets:read`   | ✅      | ✅      | ❌   | ❌  | ❌   | ✅  | ✅  | ✅  | ❌  | ✅  | ❌  |
| `platform.support.tickets:manage` | ✅      | ✅      | ❌   | ❌  | ❌   | ✅  | ✅  | ✅  | ❌  | ✅  | ❌  |
| `platform.impersonation:start`    | ✅      | 🔒      | ❌   | ❌  | ❌   | ❌  | 🔒  | 🔒  | ❌  | ❌  | ❌  |
| `platform.impersonation:read`     | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | ✅  | ✅  | ❌  | ❌  |

### Logs, Audit & Developer

| Permission                     | P.Owner | P.Admin | Comm | Fin | Bill | N1  | N2  | N3  | Aud | Dev | AI  |
| ------------------------------ | ------- | ------- | ---- | --- | ---- | --- | --- | --- | --- | --- | --- |
| `platform.audit:read`          | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | ✅  | ✅  | ❌  | ❌  |
| `platform.audit:delete`        | 🔒      | ❌      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | ❌  |
| `platform.logs:read`           | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ✅  | ✅  | ✅  | ✅  | ❌  |
| `platform.config:read`         | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ✅  | ✅  |
| `platform.config:manage`       | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | 🔒  | ❌  |
| `platform.integrations:manage` | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ✅  | ❌  |
| `platform.ai:read`             | ✅      | ✅      | ❌   | ✅  | ❌   | ❌  | ❌  | ❌  | ✅  | ✅  | ✅  |
| `platform.ai:manage`           | ✅      | ✅      | ❌   | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌  | 🔒  |

---

## Tenant IAM Matrix

Abbreviations: **T.Owner** = Tenant Owner, **T.Admin** = Tenant Admin, **Fleet** = Fleet Manager, **Ops** = Operations Manager, **Comm** = Commercial Manager, **Fin** = Financial Manager, **Sup** = Supervisor, **Op** = Operator, **Drv** = Driver, **Cust** = Customer.

### Identity & Access Management

| Permission               | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| ------------------------ | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `iam.users:read`         | ✅      | ✅      | ⚙️    | ⚙️  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `iam.users:create`       | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `iam.users:update`       | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `iam.users:suspend`      | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `iam.roles:read`         | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `iam.roles:manage`       | ✅      | 🔒      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `iam.roles:assign`       | ✅      | ✅      | ⚙️    | ⚙️  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `iam.permissions:read`   | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `iam.policies:manage`    | ✅      | 🔒      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `iam.delegations:read`   | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ✅  | ❌  | ❌  | ❌   |
| `iam.delegations:create` | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ⚙️  | ❌  | ❌  | ❌   |
| `iam.delegations:revoke` | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ⚙️  | ❌  | ❌  | ❌   |
| `iam.audit:read`         | ✅      | ✅      | ⚙️    | ⚙️  | ⚙️   | ⚙️  | ❌  | ❌  | ❌  | ❌   |

### Assets & Fleet

| Permission             | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| ---------------------- | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `assets:read`          | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ✅  | ✅  | ⚙️  | ❌   |
| `assets:create`        | ✅      | ✅      | ✅    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `assets:update`        | ✅      | ✅      | ✅    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `assets:delete`        | ✅      | ✅      | 🔒    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `assets:assign_device` | ✅      | ✅      | ✅    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |

### Tracking & Telematics

| Permission                | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| ------------------------- | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `tracking:read`           | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ✅  | ✅  | ⚙️  | ⚙️   |
| `tracking.history:read`   | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ✅  | ❌  | ✅  | ❌   |
| `tracking.telemetry:read` | ✅      | ✅      | ✅    | ⚙️  | ❌   | ❌  | ⚙️  | ❌  | ❌  | ❌   |
| `geofences:read`          | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ✅  | ✅  | ❌  | ❌   |
| `geofences:manage`        | ✅      | ✅      | ✅    | ⚙️  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |

### Operations

| Permission           | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| -------------------- | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `operations:read`    | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ✅  | ✅  | ✅  | ⚙️   |
| `operations:create`  | ✅      | ✅      | ❌    | ✅  | ❌   | ❌  | ✅  | ✅  | ❌  | ❌   |
| `operations:update`  | ✅      | ✅      | ❌    | ✅  | ❌   | ❌  | ✅  | ✅  | ❌  | ❌   |
| `operations:close`   | ✅      | ✅      | ❌    | ✅  | ❌   | ❌  | ✅  | ❌  | ❌  | ❌   |
| `allocations:read`   | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ✅  | ✅  | ✅  | ❌   |
| `allocations:manage` | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ✅  | ❌  | ❌  | ❌   |
| `occurrences:create` | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ✅  | ✅  | ✅  | ❌   |
| `occurrences:read`   | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ✅  | ✅  | ✅  | ❌   |

### Resources & Capabilities

| Permission            | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| --------------------- | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `resources:read`      | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ✅  | ✅  | ❌  | ❌   |
| `resources:manage`    | ✅      | ✅      | ✅    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `capabilities:read`   | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `capabilities:manage` | ✅      | 🔒      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |

### Commercial & Commission

| Permission                        | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| --------------------------------- | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `commission.plans:read`           | ✅      | ✅      | ❌    | ❌  | ✅   | ✅  | ❌  | ❌  | ❌  | ❌   |
| `commission.plans:manage`         | ✅      | ✅      | ❌    | ❌  | ✅   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `commission.campaigns:read`       | ✅      | ✅      | ❌    | ❌  | ✅   | ✅  | ❌  | ❌  | ❌  | ❌   |
| `commission.campaigns:manage`     | ✅      | ✅      | ❌    | ❌  | ✅   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `commission.transactions:read`    | ✅      | ✅      | ❌    | ❌  | ✅   | ✅  | ❌  | ❌  | ✅  | ❌   |
| `commission.transactions:approve` | ✅      | ✅      | ❌    | ❌  | ✅   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `commission.settlements:read`     | ✅      | ✅      | ❌    | ❌  | ✅   | ✅  | ❌  | ❌  | ✅  | ❌   |
| `commission.settlements:create`   | ✅      | ✅      | ❌    | ❌  | ✅   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `commission.settlements:approve`  | ✅      | ✅      | ❌    | ❌  | 🔒   | 🔒  | ❌  | ❌  | ❌  | ❌   |

### Contracts & Customers

| Permission         | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| ------------------ | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `contracts:read`   | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ✅  | ✅  | ❌  | ✅   |
| `contracts:create` | ✅      | ✅      | ❌    | ✅  | ✅   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `contracts:update` | ✅      | ✅      | ❌    | ✅  | ✅   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `customers:read`   | ✅      | ✅      | ❌    | ✅  | ✅   | ✅  | ❌  | ✅  | ❌  | ❌   |
| `customers:manage` | ✅      | ✅      | ❌    | ❌  | ✅   | ❌  | ❌  | ❌  | ❌  | ❌   |

### Billing & Finance

| Permission                | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| ------------------------- | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `billing:read`            | ✅      | ✅      | ❌    | ❌  | ✅   | ✅  | ❌  | ❌  | ❌  | ✅   |
| `invoices:read`           | ✅      | ✅      | ❌    | ❌  | ✅   | ✅  | ❌  | ❌  | ❌  | ✅   |
| `invoices:create`         | ✅      | ✅      | ❌    | ❌  | ❌   | ✅  | ❌  | ❌  | ❌  | ❌   |
| `invoices:approve`        | ✅      | ✅      | ❌    | ❌  | ❌   | 🔒  | ❌  | ❌  | ❌  | ❌   |
| `billing_accounts:read`   | ✅      | ✅      | ❌    | ❌  | ✅   | ✅  | ❌  | ❌  | ❌  | ❌   |
| `billing_accounts:manage` | ✅      | ✅      | ❌    | ❌  | ❌   | ✅  | ❌  | ❌  | ❌  | ❌   |

### Branches & Organizations

| Permission             | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| ---------------------- | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `branches:read`        | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ✅  | ✅  | ❌  | ❌   |
| `branches:create`      | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `branches:update`      | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `organizations:read`   | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ✅  | ❌  | ❌  | ❌   |
| `organizations:manage` | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |

### Workflows & Rules

| Permission         | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| ------------------ | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `workflows:read`   | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ❌  | ❌  | ❌  | ❌   |
| `workflows:manage` | ✅      | ✅      | ❌    | ⚙️  | ⚙️   | ⚙️  | ❌  | ❌  | ❌  | ❌   |
| `rule_sets:read`   | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ❌  | ❌  | ❌  | ❌   |
| `rule_sets:manage` | ✅      | ✅      | ⚙️    | ⚙️  | ⚙️   | ⚙️  | ❌  | ❌  | ❌  | ❌   |

### Notifications

| Permission                      | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| ------------------------------- | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `notifications:read`            | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ✅  | ✅  | ✅  | ✅   |
| `notifications.channels:manage` | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |

### Reports

| Permission                | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| ------------------------- | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `reports.fleet:read`      | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ✅  | ❌  | ❌  | ❌   |
| `reports.operations:read` | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ✅  | ❌  | ❌  | ❌   |
| `reports.commercial:read` | ✅      | ✅      | ❌    | ❌  | ✅   | ✅  | ❌  | ❌  | ❌  | ❌   |
| `reports.financial:read`  | ✅      | ✅      | ❌    | ❌  | ✅   | ✅  | ❌  | ❌  | ❌  | ❌   |
| `reports.ai:read`         | ✅      | ✅      | ✅    | ✅  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |

### Studio Applications

| Permission                              | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| --------------------------------------- | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `studio.access_control:access`          | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `studio.access_control:manage_roles`    | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `studio.access_control:manage_policies` | ✅      | 🔒      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `studio.access_control:manage_branches` | ✅      | ✅      | ❌    | ❌  | ❌   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `studio.commercial:access`              | ✅      | ✅      | ❌    | ❌  | ✅   | ✅  | ❌  | ❌  | ❌  | ❌   |
| `studio.commercial:manage_plans`        | ✅      | ✅      | ❌    | ❌  | ✅   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `studio.commercial:manage_campaigns`    | ✅      | ✅      | ❌    | ❌  | ✅   | ❌  | ❌  | ❌  | ❌  | ❌   |
| `studio.commercial:approve_settlements` | ✅      | 🔒      | ❌    | ❌  | 🔒   | 🔒  | ❌  | ❌  | ❌  | ❌   |

### Profile & Self-Service

| Permission           | T.Owner | T.Admin | Fleet | Ops | Comm | Fin | Sup | Op  | Drv | Cust |
| -------------------- | ------- | ------- | ----- | --- | ---- | --- | --- | --- | --- | ---- |
| `profile:read`       | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ✅  | ✅  | ✅  | ✅   |
| `profile:write`      | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ✅  | ✅  | ✅  | ✅   |
| `profile.mfa:manage` | ✅      | ✅      | ✅    | ✅  | ✅   | ✅  | ✅  | ✅  | ✅  | ✅   |

---

## Permission Counts

| Scope        | Total Permissions Defined |
| ------------ | ------------------------- |
| Platform IAM | 32                        |
| Tenant IAM   | 68                        |
| **Total**    | **100**                   |

---

## ABAC Conditions Quick Reference

| Condition                                      | Roles Affected                                                                                                    | When Active                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `user.branchScope contains resource.branchId`  | Fleet Manager, Ops Manager, Comm Manager, Supervisor                                                              | Branch scope configured                       |
| `resource.assignedUserId eq user.id`           | Driver                                                                                                            | Always                                        |
| `resource.customerId eq user.customerId`       | Customer                                                                                                          | Always                                        |
| `session.mfaVerified eq true`                  | Tenant Owner (writes), Tenant Admin (IAM writes), Financial Manager (approvals), Commercial Manager (settlements) | When MFA step-up policy is active             |
| `resource.tenantId eq user.tenantId`           | All tenant roles                                                                                                  | Always (platform enforced)                    |
| `resource.amount lte tenant.approvalThreshold` | All                                                                                                               | When amount-based approval workflow is active |
