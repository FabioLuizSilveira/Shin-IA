# Roadmap — Shinã Platform

High-level product roadmap. Updated as milestones complete and priorities shift.

---

## Current Status

| Milestone                      | Status                       | Completed  |
| ------------------------------ | ---------------------------- | ---------- |
| M1 — Foundation                | ✅ Done                      | 2026-06-20 |
| M1.1 — Documentation Alignment | ✅ Done                      | 2026-06-20 |
| M2 — Core Domain               | ✅ Done                      | 2026-06-20 |
| **M3 — Data Layer**            | **▶ Next** (planning locked) | —          |
| M4 — Authentication            | ⬜ Blocked                   | —          |
| M5 — Core Engines              | ⬜ Blocked                   | —          |
| M6 — Launch                    | ⬜ Blocked                   | —          |

> **Next step:** Milestone 3 — Data Layer. Planning complete; all design decisions locked (2026-06-20). Awaiting implementation sign-off.  
> See [`MASTER_ROADMAP.md`](MASTER_ROADMAP.md) for the full domain-level roadmap.

---

## Phase 1: Foundation (Milestones 1–2)

**Goal:** A working monorepo with a solid domain model ready for feature development.

- ✅ Robust developer experience: hot reload, type safety, linting, formatting
- ✅ CI/CD pipeline catching regressions before merge
- ✅ Architecture and domain documentation aligned (M1.1)
- ✅ Core domain: 16 DDD aggregates, zero runtime dependencies, compiles clean (M2)

---

## Phase 2: Data & Identity (Milestones 3–4)

**Goal:** Users can create accounts and interact with persistent data.

- Supabase database live with schema (multi-tenant, RLS)
- Authentication flows (email, OAuth) + Platform IAM
- Secure data access with Row Level Security

---

## Phase 3: Core Product (Milestone 5)

**Goal:** The platform's primary value proposition is functional.

- Tracking & Telematics Engine (real-time positions, geofences, events)
- Commission Management Engine (plans, transactions, settlements)
- IAM Enterprise (RBAC, ABAC, Branch Scope, Delegation, Impersonation)
- Access Control Studio + Commercial Studio

---

## Phase 4: Launch (Milestone 6)

**Goal:** Production-ready — performant, accessible, monitored.

- Performance meets Core Web Vitals thresholds
- Accessibility meets WCAG 2.1 AA
- Error monitoring and alerting configured
- Automated E2E test suite (Playwright)
- NF-e billing integration
- SSO (SAML 2.0 / OIDC)

---

## Backlog

Items identified but not yet scheduled:

- Internationalization (i18n)
- Mobile application (React Native / Expo)
- AI Engine — route optimization and predictive maintenance
- Public REST API (third-party integrations)
- Webhook system for payroll/ERP integration
- White-label / OEM mode

---

## Decisions Log

| Date       | Decision                                               | Rationale                                                                                 |
| ---------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 2026-06-20 | Turborepo for monorepo                                 | Industry standard, excellent DX, remote cache                                             |
| 2026-06-20 | pnpm for package management                            | Fast, strict, disk-efficient                                                              |
| 2026-06-20 | Supabase for backend                                   | Postgres + Auth + Realtime in one platform                                                |
| 2026-06-20 | Next.js App Router                                     | Server-first, RSC, streaming                                                              |
| 2026-06-20 | Commission Engine separated from Billing Engine        | Different bounded contexts and lifecycles                                                 |
| 2026-06-20 | Two-tier IAM (Platform + Tenant)                       | Platform operators and tenant users have fundamentally different access models            |
| 2026-06-20 | Repository public (GitHub Free plan)                   | Enables branch protection Rulesets without GitHub Pro                                     |
| 2026-06-20 | Domain-generated UUIDs (no DB default)                 | Aggregate identity owned by domain, not infrastructure                                    |
| 2026-06-20 | RLS via JWT claim `tenant_id` (MVP)                    | Avoids per-row lookup subquery; Auth Hook populates claim at sign-in                      |
| 2026-06-20 | Notifications: `person_id FK + recipient_external_ref` | Supports both internal persons and external recipients without separate tables            |
| 2026-06-20 | Organization address: flat columns + `metadata JSONB`  | Queryable address fields; metadata avoids future column sprawl                            |
| 2026-06-20 | `invoice_line_items` as separate table                 | Enables indexed queries and individual FK constraints vs. JSONB array                     |
| 2026-06-20 | `workflow_steps` + `rule_set_rules` as separate tables | Steps need self-ref FK for chaining; rules need ordered priority column                   |
| 2026-06-20 | `persons.auth_user_id UUID NULL UNIQUE`                | Not all persons are Auth users; bridge nullable, Auth identity preserved on person delete |
| 2026-06-20 | Branches: adjacency list (MVP)                         | Simple to implement; `ltree` deferred until deep tree queries show perf issues            |
| 2026-06-20 | Currency: `tenants.default_currency DEFAULT 'BRL'`     | Per-tenant config instead of hardcoded column defaults; easy to extend                    |
| 2026-06-20 | `domain_events` in separate `events` schema            | Isolates event infrastructure from business tables; prevents accidental joins             |
