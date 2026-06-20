# Architecture — Shinã Platform

> Last updated: 2026-06-20 (Milestone 1.1 — Documentation Alignment)

---

## Overview

Shinã Platform is a multi-tenant SaaS system for fleet and mobility management. It follows a **Domain-Driven Design** approach organized around Bounded Contexts, exposing capabilities through an **Engine Layer** that encapsulates business logic, and secured via a two-tier **IAM** system.

---

## Architectural Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│          Web App (Next.js)  ·  Mobile  ·  Third-Party API       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                         API Gateway                             │
│           Auth / Rate-limiting / Tenant Resolution              │
└──────┬───────────┬───────────┬───────────┬───────────┬──────────┘
       │           │           │           │           │
┌──────▼───┐ ┌────▼─────┐ ┌───▼────┐ ┌───▼────┐ ┌────▼─────┐
│ Platform │ │  Tenant  │ │Tracking│ │Billing │ │Commission│
│   IAM    │ │   IAM    │ │ Engine │ │ Engine │ │  Engine  │
└──────────┘ └──────────┘ └────────┘ └────────┘ └──────────┘
       │           │           │           │           │
┌──────▼───────────▼───────────▼───────────▼───────────▼──────────┐
│                         Engine Layer                            │
│  Workflow · Rule · Resource · Operation · Notification          │
│  Reporting · AI · Config                                        │
└─────────────────────────────────────────────────────────────────┘
       │
┌──────▼───────────────────────────────────────────────────────────┐
│                     Persistence Layer                           │
│         Supabase (Postgres + Realtime + Storage)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Engine Catalog

Each Engine is a self-contained bounded context with its own schema, event bus, and API surface. Engines communicate asynchronously via domain events.

### Workflow Engine

Orchestrates stateful business processes across other engines. Defines process definitions (states, transitions, guards, actions), manages in-flight process instances, and emits lifecycle events.

**Responsibilities:** Process definition · Instance lifecycle · State transitions · Timeouts · Compensation

---

### Rule Engine

Evaluates declarative business rules against domain entities. Rules are authored in the Admin Studio and evaluated at runtime without deployment.

**Responsibilities:** Rule definition · Condition evaluation · Action dispatch · Rule versioning

---

### Resource Engine

Manages physical and logical assets owned or operated by a tenant: vehicles, equipment, devices, and their metadata.

**Responsibilities:** Asset registry · Asset state · Assignment · Maintenance scheduling

---

### Operation Engine

Models day-to-day operational entities: orders, routes, trips, and their execution lifecycle.

**Responsibilities:** Order management · Route planning · Trip lifecycle · Driver assignment

---

### Billing Engine

Handles the financial relationship between the platform and its tenants: subscriptions, plans, usage metering, invoices, and payment processing.

**Responsibilities:** Subscription plans · Usage metering · Invoice generation · Payment lifecycle

See [`BILLING.md`](BILLING.md) for the separation between Billing Engine and Commission Engine.

---

### Commission Engine

Manages the commercial incentive layer: commission plans, rules, campaigns, transaction calculation, settlement, and approval.

**Responsibilities:** Commission plan management · Rule evaluation · Transaction recording · Settlement batches · Approval workflows

See [`BILLING.md`](BILLING.md) for detailed specification.

---

### Tracking Engine

Ingests, processes, and serves real-time and historical telemetry from physical devices attached to assets (vehicles, equipment, containers).

**Responsibilities:** Device provisioning · Position ingestion · Geofence management · Telemetry processing · Event detection

See [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) for the Tracking & Telematics bounded context.

---

### Notification Engine

Dispatches multi-channel notifications (push, email, SMS, webhook) triggered by domain events from any other engine.

**Responsibilities:** Template management · Channel routing · Delivery tracking · Preference management

---

### Reporting Engine

Provides pre-computed and on-demand reports aggregating data from multiple engines. Feeds dashboards and scheduled exports.

**Responsibilities:** Report definition · Data aggregation · Scheduled jobs · Export formats (PDF, CSV, XLSX)

---

### AI Engine

Provides ML-backed capabilities: anomaly detection, route optimization, predictive maintenance, natural language interfaces.

**Responsibilities:** Model serving · Feature extraction · Prediction endpoints · Feedback loop

---

### Config Engine

Manages tenant-level and platform-level runtime configuration without deployment. Drives feature flags, thresholds, and behavioral parameters consumed by other engines.

**Responsibilities:** Config keys · Tenant overrides · History / audit trail · Environment promotion

---

## IAM — Identity and Access Management

The platform uses a two-tier IAM model. See [`IAM.md`](IAM.md) for the full specification.

### Platform IAM

Governs identity and access at the **platform operator** level. Controls which tenants exist, which platform administrators have access, and cross-tenant operations.

**Scope:** Platform operators · Tenant provisioning · Cross-tenant access · Platform-level audit

**Key entities:** `PlatformUser`, `PlatformRole`, `PlatformPolicy`

---

### Tenant IAM

Governs identity and access **within a single tenant**. Manages users, roles, permissions, branch scopes, and capability scopes.

**Scope:** Tenant users · Role-based access (RBAC) · Attribute-based access (ABAC) · Branch scope · Capability scope · Delegated access · Impersonation

**Key entities:** `User`, `Role`, `Permission`, `Policy`, `BranchScope`, `CapabilityScope`, `Delegation`, `Impersonation`

---

## Tracking & Telematics Context

A first-class bounded context cross-cutting the Resource, Operation, and Reporting engines. Provides real-time asset visibility.

**Sub-domains:**
- **Device Management** — provisioning and lifecycle of tracking hardware
- **Position & Telemetry** — ingestion and storage of GPS positions and sensor readings
- **Geofence Management** — definition and monitoring of geographic boundaries
- **Event Detection** — pattern matching over telemetry streams (speeding, idle, enter/exit geofence)

---

## Studio Applications

Studios are operator-facing configuration interfaces (web modules) that configure platform behavior without code. They are detailed in [`TENANT_STUDIO.md`](TENANT_STUDIO.md).

| Studio | Purpose |
|--------|---------|
| Access Control Studio | Configure roles, permissions, branch scopes, capability scopes |
| Commercial Studio | Configure commission plans, rules, campaigns |

---

## Cross-Cutting Concerns

| Concern | Approach |
|---------|---------|
| Multi-tenancy | Row-level tenant isolation via Supabase RLS |
| Auth | Supabase Auth + custom Tenant IAM layer |
| Observability | Structured logs, distributed traces, metrics |
| Eventing | Domain events on async bus (Supabase Realtime + queue) |
| Audit | Immutable audit log for all state mutations |
| Versioning | All APIs versioned; breaking changes gated |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-20 | Commission Engine separated from Billing Engine | Different bounded contexts: Billing = tenant subscription; Commission = commercial incentives |
| 2026-06-20 | Tracking as first-class context, not sub-feature of Resource Engine | Volume and real-time requirements warrant dedicated infrastructure |
| 2026-06-20 | Two-tier IAM (Platform + Tenant) | Platform operators and tenant users have fundamentally different access models |
