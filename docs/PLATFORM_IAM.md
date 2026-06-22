# Platform IAM — Shinã Platform

> Last updated: 2026-06-20 (M4.0 — IAM Design)

Defines all roles that operate **at the platform level**, outside any tenant boundary. Platform operators manage tenants, subscriptions, billing, support, and infrastructure. They have no direct access to tenant business data unless explicitly granted via impersonation with tenant consent.

See [`IAM.md`](IAM.md) for the combined IAM model overview.  
See [`AUTHORIZATION_MODEL.md`](AUTHORIZATION_MODEL.md) for the underlying RBAC + ABAC specification.  
See [`ACCESS_MATRIX.md`](ACCESS_MATRIX.md) for the full permission matrix.

---

## Role Hierarchy

```
Platform Owner
└── Platform Admin
    ├── Platform Commercial
    ├── Platform Finance
    │   └── Platform Billing
    ├── Platform Support N3
    │   └── Platform Support N2
    │       └── Platform Support N1
    ├── Platform Auditor
    ├── Platform Developer
    └── Platform AI Manager
```

Higher tiers do not automatically inherit lower-tier permissions — the hierarchy indicates reporting structure and escalation paths, not permission inheritance. Each role is independently configured in the RBAC model.

---

## Roles

### Platform Owner

**Identity:** The founding operator or accountable legal entity for the Shinã Platform instance.

**Responsibilities:**

- Ultimate accountability for platform operation and legal compliance
- Grants and revokes Platform Admin roles
- Approves changes to pricing plans and commercial structure
- Signs off on platform-level security policies and compliance requirements
- Emergency access to all platform functions; all actions are audited
- Approves impersonation of any tenant user when escalated by support
- Configures MFA enforcement policy for the entire platform operator team
- Sole role that can permanently delete platform-level audit records (with legal justification)

**Constraints:**

- Must have active TOTP MFA at all times; sessions expire after 4 hours of inactivity
- All actions written to immutable platform audit log
- Cannot delete tenants without a 72-hour cooling-off window

**Permission scope:** `platform.*` (all resources, all actions)

---

### Platform Admin

**Identity:** Day-to-day operational manager of the platform and its tenants.

**Responsibilities:**

- Creates, suspends, reactivates, and configures tenants
- Manages platform operator accounts (invite, deactivate, assign roles)
- Configures global platform settings (feature flags, rate limits, quotas)
- Approves or denies tenant plan upgrades and special pricing requests
- Reviews and acts on escalations from Support N3
- Initiates impersonation sessions for critical diagnostic purposes
- Monitors platform health dashboards and receives operational alerts
- Manages API keys and webhook endpoints at the platform level
- Reviews platform audit logs

**Constraints:**

- Cannot grant Platform Owner role
- Impersonation requires secondary confirmation + reason; logged immutably
- Must have active MFA for all write operations

**Permission scope:** `platform.*` excluding `platform.owners:manage`

---

### Platform Commercial

**Identity:** Commercial strategy and partner relationship owner.

**Responsibilities:**

- Manages commercial plans (pricing tiers, feature bundles, usage quotas)
- Configures promotional offers and discount codes
- Reviews tenant acquisition pipeline and conversion metrics
- Negotiates and records custom pricing agreements for enterprise tenants
- Manages reseller and partner accounts
- Generates commercial performance reports (MRR, churn, LTV)
- Coordinates with Platform Finance on billing reconciliation
- Approves commercial exceptions (free-tier extension, credit grants)

**Constraints:**

- Cannot create or suspend tenants
- Cannot access tenant business data
- Read-only access to tenant subscription status and plan history

**Permission scope:** `platform.commercial.*`, `platform.tenants:read`, `platform.billing:read`

---

### Platform Finance

**Identity:** Financial officer responsible for platform revenue and expenses.

**Responsibilities:**

- Reviews and approves billing invoices issued to tenants
- Monitors revenue dashboards (MRR, ARR, outstanding invoices)
- Manages payment gateway configuration (Stripe, bank transfer settings)
- Oversees tax configuration (tax codes, exemptions, NF-e settings for Brazil)
- Approves refunds and credit notes above the threshold set by Platform Owner
- Generates financial reports for accounting and audit purposes
- Coordinates with Platform Billing on invoice disputes
- Reviews commission payouts owed to reseller partners

**Constraints:**

- Cannot modify tenant subscriptions directly
- Cannot access tenant business data
- Refund approval above BRL 500 requires secondary confirmation

**Permission scope:** `platform.finance.*`, `platform.billing:read`, `platform.tenants:read`

---

### Platform Billing

**Identity:** Operational billing agent who handles day-to-day billing tasks.

**Responsibilities:**

- Issues and resends tenant invoices
- Processes payment confirmations and reconciles failed payments
- Handles dunning workflows (payment reminders, grace period management)
- Creates and applies credit notes for minor billing adjustments
- Updates tenant payment method records
- Responds to billing enquiries escalated from Support N1/N2
- Generates per-tenant billing history reports
- Manages automatic payment retry logic configuration

**Constraints:**

- Credit notes above BRL 500 require Platform Finance approval
- Cannot modify pricing plans
- Cannot access tenant business data

**Permission scope:** `platform.billing.*`, `platform.tenants:read`

---

### Platform Support N1

**Identity:** First-line support agent; handles routine tenant enquiries.

**Responsibilities:**

- Responds to inbound support tickets (chat, email)
- Verifies tenant identity for support requests
- Guides users through standard onboarding steps and feature usage
- Resets tenant admin passwords via platform-initiated reset flows
- Escalates technical issues to Support N2
- Escalates billing issues to Platform Billing
- Accesses tenant profile metadata (plan, status, contact info) — read only
- Records support interactions in the ticketing system

**Constraints:**

- No impersonation capability
- Cannot view tenant business data
- Cannot modify any tenant configuration
- Ticket escalation to N2 required if issue cannot be resolved in the current interaction

**Permission scope:** `platform.tenants:read`, `platform.support.tickets:manage`

---

### Platform Support N2

**Identity:** Technical support specialist; resolves complex configuration and integration issues.

**Responsibilities:**

- Investigates and resolves issues escalated from Support N1
- Diagnoses integration failures (webhook delivery, API auth errors, SDK configuration)
- Reviews platform event logs to trace errors affecting specific tenants
- Assists tenants with complex configuration (IAM policies, branch scopes, capability activation)
- Performs limited impersonation for diagnostic purposes (read-only view)
- Drafts knowledge base articles for recurring issues
- Escalates critical or security-related issues to Support N3
- Coordinates with Platform Developer on bug reports

**Constraints:**

- Impersonation is read-only; no write operations during support sessions
- Impersonation requires reason and is logged
- Cannot change tenant billing or subscription data

**Permission scope:** `platform.tenants:read`, `platform.support.tickets:manage`, `platform.logs:read`, `platform.impersonation:start` (read-only mode)

---

### Platform Support N3

**Identity:** Senior support engineer; handles critical escalations, security incidents, and systemic issues.

**Responsibilities:**

- Manages critical escalations from Support N2 (data loss risk, security incidents, major outages affecting a tenant)
- Performs full impersonation sessions for deep diagnostic purposes
- Coordinates incident response with Platform Developer and Admin
- Approves emergency tenant configuration changes on behalf of the tenant
- Reviews and acts on security-sensitive tickets (suspicious activity, account takeover attempts)
- Writes post-incident reports
- Proposes process improvements and escalation policy updates
- Trains and mentors Support N1 and N2 agents

**Constraints:**

- Full impersonation requires additional confirmation from Platform Admin or Owner
- All impersonation sessions fully logged and reviewed within 24 hours
- Cannot modify platform pricing or billing settings

**Permission scope:** `platform.tenants:read`, `platform.tenants:update` (scoped to support operations), `platform.logs:read`, `platform.support.tickets:manage`, `platform.impersonation:start` (full mode, requires secondary confirmation)

---

### Platform Auditor

**Identity:** Independent compliance and audit function with read-only access to all platform activity.

**Responsibilities:**

- Reviews platform audit logs for compliance verification
- Generates audit reports for internal and external auditors
- Monitors impersonation activity and flags anomalies
- Verifies that MFA enforcement policies are correctly applied
- Reviews access grant and revocation history across the platform
- Assesses whether data processing activities comply with LGPD / GDPR
- Provides compliance evidence for certifications (SOC 2, ISO 27001)
- Raises compliance findings to Platform Owner

**Constraints:**

- Read-only; no write operations of any kind
- Cannot impersonate
- Cannot access live tenant business data — only metadata and audit records

**Permission scope:** `platform.audit:read`, `platform.tenants:read`, `platform.logs:read` (audit-scoped)

---

### Platform Developer

**Identity:** Internal engineer responsible for platform infrastructure, integrations, and feature delivery.

**Responsibilities:**

- Manages platform deployment pipelines (CI/CD configuration, release gates)
- Configures and maintains Supabase project settings (Auth, Realtime, Edge Functions)
- Manages third-party service integrations (payment gateways, tracking providers, SMS/email services)
- Reviews and responds to bug reports submitted via support escalation
- Manages feature flags and gradual rollout configuration
- Monitors platform performance metrics and error rates
- Manages platform API keys and service accounts
- Writes and maintains platform internal documentation (runbooks, architecture decisions)

**Constraints:**

- Production database access requires dual approval (Platform Owner + Platform Admin)
- No direct impersonation
- All infrastructure changes logged

**Permission scope:** `platform.developer.*`, `platform.config:manage`, `platform.integrations:manage`

---

### Platform AI Manager

**Identity:** Responsible for AI engine configuration, model governance, and AI safety.

**Responsibilities:**

- Manages AI model configurations available to tenants (route optimization, predictive maintenance, anomaly detection)
- Configures AI capability access per tenant plan
- Monitors AI usage metrics (token consumption, inference costs, model latency)
- Reviews and approves AI feature requests from tenants
- Manages AI safety policies (rate limits, output filtering, sensitive-data handling rules)
- Coordinates with Platform Developer on AI infrastructure changes
- Evaluates new AI model integrations (LLM providers, computer vision APIs)
- Generates AI usage reports for Platform Finance (cost allocation)

**Constraints:**

- Cannot access raw tenant business data used as AI training inputs
- Model governance changes require Platform Admin approval
- AI policy changes affecting all tenants require Platform Owner sign-off

**Permission scope:** `platform.ai.*`, `platform.tenants:read`, `platform.config:read`

---

## Platform Role Summary

| Role                | Count  | MFA Required | Impersonation            | Write Access      |
| ------------------- | ------ | ------------ | ------------------------ | ----------------- |
| Platform Owner      | 1–2    | Always       | Full (any tenant)        | All               |
| Platform Admin      | 2–5    | All writes   | Full + secondary confirm | All except owners |
| Platform Commercial | varies | Write ops    | None                     | Commercial config |
| Platform Finance    | varies | All writes   | None                     | Finance config    |
| Platform Billing    | varies | Write ops    | None                     | Billing ops       |
| Platform Support N1 | varies | Login        | None                     | None              |
| Platform Support N2 | varies | Login        | Read-only                | None              |
| Platform Support N3 | varies | Login        | Full + confirm           | Limited           |
| Platform Auditor    | 1–3    | Login        | None                     | None              |
| Platform Developer  | varies | All writes   | None                     | Infra/config      |
| Platform AI Manager | varies | Write ops    | None                     | AI config         |

---

## Impersonation Policy

Only Platform Owner, Platform Admin, Platform Support N2 (read-only), Platform Support N3, and Platform Admin may initiate impersonation sessions.

| Role                | Impersonation Mode | Secondary Confirmation      | Max Duration |
| ------------------- | ------------------ | --------------------------- | ------------ |
| Platform Owner      | Full               | None (self-sovereign)       | 4 hours      |
| Platform Admin      | Full               | Required (own confirmation) | 4 hours      |
| Platform Support N2 | Read-only          | Required (N3 or Admin)      | 2 hours      |
| Platform Support N3 | Full               | Required (Admin or Owner)   | 4 hours      |

All sessions are logged in the immutable platform audit log with actor, target tenant, target user, reason, start time, end time, and all actions performed.

Tenant Owner and Tenant Admin can view a list of impersonation sessions against their tenant (actor, reason, start/end — no action detail).
