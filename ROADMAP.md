# Roadmap — Shinã Platform

High-level product roadmap. Updated as milestones complete and priorities shift.

---

## Current Status

| Milestone                      | Status     | Completed  |
| ------------------------------ | ---------- | ---------- |
| M1 — Foundation                | ✅ Done    | 2026-06-20 |
| M1.1 — Documentation Alignment | ✅ Done    | 2026-06-20 |
| **M2 — Application Shells**    | **▶ Next** | —          |
| M3 — Data Layer                | ⬜ Blocked | —          |
| M4 — Authentication            | ⬜ Blocked | —          |
| M5 — Core Engines              | ⬜ Blocked | —          |
| M6 — Launch                    | ⬜ Blocked | —          |

> **Next step:** Milestone 2 — Application Shells. Requires explicit sign-off before starting.  
> See [`MASTER_ROADMAP.md`](MASTER_ROADMAP.md) for the full domain-level roadmap.

---

## Phase 1: Foundation (Milestones 1–2)

**Goal:** A working monorepo with a running application that can be deployed.

- ✅ Robust developer experience: hot reload, type safety, linting, formatting
- ✅ CI/CD pipeline catching regressions before merge
- ✅ Architecture and domain documentation aligned (M1.1)
- ⬜ Application shell ready for feature development (M2)

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

| Date       | Decision                                        | Rationale                                                                      |
| ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| 2026-06-20 | Turborepo for monorepo                          | Industry standard, excellent DX, remote cache                                  |
| 2026-06-20 | pnpm for package management                     | Fast, strict, disk-efficient                                                   |
| 2026-06-20 | Supabase for backend                            | Postgres + Auth + Realtime in one platform                                     |
| 2026-06-20 | Next.js App Router                              | Server-first, RSC, streaming                                                   |
| 2026-06-20 | Commission Engine separated from Billing Engine | Different bounded contexts and lifecycles                                      |
| 2026-06-20 | Two-tier IAM (Platform + Tenant)                | Platform operators and tenant users have fundamentally different access models |
| 2026-06-20 | Repository public (GitHub Free plan)            | Enables branch protection Rulesets without GitHub Pro                          |
