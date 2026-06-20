# Master Roadmap — Shinã Platform

> Last updated: 2026-06-20 (Milestone 1.1 — Documentation Alignment)

This is the authoritative product roadmap for the Shinã Platform. It supersedes and extends `ROADMAP.md` with domain-specific objectives per milestone.

---

## Product Vision

Shinã Platform is a multi-tenant fleet and mobility intelligence platform. It provides:

- **Real-time asset tracking and telematics** for any fleet type (urban, industrial, agricultural)
- **Commission management** for commercial and operational incentive programs
- **Enterprise IAM** with RBAC, ABAC, branch scopes, and capability-based access
- **Industry-specific Blueprints** for rapid tenant onboarding
- **Studio applications** for no-code configuration of complex business rules

---

## Milestone Overview

| Milestone | Status | Theme |
|-----------|--------|-------|
| M1 — Foundation | ✅ Complete | Monorepo, tooling, CI/CD |
| M1.1 — Doc Alignment | ✅ Complete | Architecture, IAM, Tracking, Commission documented |
| M2 — Application Shells | ⬜ Next | Next.js web app, shared packages |
| M3 — Data Layer | ⬜ | Supabase schema, migrations, RLS |
| M4 — Authentication | ⬜ | Auth flows, session management |
| M5 — Core Engines | ⬜ | First engine implementations |
| M6 — Launch | ⬜ | Polish, performance, E2E tests |

---

## M2: Application Shells

**Theme:** A running application ready for feature development.

### Objectives

- `apps/web` — Next.js 15 app scaffold with App Router
- `packages/ui` — Shared component library (shadcn/ui)
- `packages/utils` — Shared TypeScript utilities
- `packages/types` — Shared domain types (from Canonical Data Model)
- Environment variable management
- Basic routing structure (stub pages for each major section)

**Not included:** No real data, no real auth, no business logic.

---

## M3: Data Layer

**Theme:** Production-ready database with full schema and security.

### Objectives

- Supabase project configured
- Multi-tenant schema with Row Level Security (RLS) on all tables
- Core schema: tenants, users, assets, branches
- `packages/db` — type-safe Supabase client wrapper

### Tracking & Telematics — Data

- `tracking_devices` table
- `tracking_positions` hypertable (time-series optimized)
- `tracking_events` table
- `geofences` table with PostGIS geometry
- `geofence_events` table
- `telemetry_readings` hypertable

### Commission Management — Data

- `commission_plans` table
- `commission_rules` table
- `commission_campaigns` table
- `commission_transactions` table
- `commission_settlements` table
- `commission_approvals` table

### IAM Enterprise — Data

- `roles` table (system + custom)
- `permissions` table
- `role_permissions` junction
- `user_roles` junction
- `policies` table (ABAC)
- `branches` tree structure (ltree)
- `capabilities` table
- `delegations` table
- `impersonations` audit table

---

## M4: Authentication

**Theme:** Users can securely authenticate and maintain sessions.

### Objectives

- Supabase Auth integration (email/password + magic link)
- Tenant resolution from JWT
- Platform IAM authentication (separate provider)
- Protected route middleware
- Session management and refresh

### IAM Enterprise — Auth

- MFA enrollment (TOTP)
- MFA enforcement policies (role-based, tenant-configured)
- Session MFA step-up for sensitive operations
- SSO preparation (SAML/OIDC spec — implementation M6)

---

## M5: Core Engines

**Theme:** The platform's primary value proposition is functional.

### Tracking & Telematics

- Device provisioning API
- Position ingestion pipeline (MQTT + HTTP adapters)
- Real-time position streaming (Supabase Realtime)
- Geofence management CRUD
- Geofence event detection (PostGIS `ST_Within`)
- TrackingEvent detection (speeding, idle, trip)
- Asset live map view in `apps/web`
- Tracking history playback
- Telemetry reading ingestion and display

### Commission Management

- CommissionPlan CRUD
- CommissionRule evaluation engine
- CommissionCampaign management
- CommissionTransaction calculation (triggered by qualifying events)
- CommissionApproval workflow (single and multi-step)
- CommissionSettlement generation and approval
- Commercial Studio (plan builder + settlement console)

### IAM Enterprise

- Full RBAC enforcement on all API routes
- ABAC policy evaluation engine
- Branch scope enforcement in queries
- Capability scope enforcement at API and UI layer
- Delegation creation and enforcement
- Impersonation (platform admin only)
- Access Control Studio (role manager + policy editor + branch manager)
- Audit log viewer in studio

---

## M6: Launch

**Theme:** Production-ready — monitored, tested, and performant.

### Objectives

- Playwright E2E test suite covering critical paths
- Core Web Vitals audit (all pages: LCP < 2.5s, INP < 200ms, CLS < 0.1)
- Accessibility audit (WCAG 2.1 AA)
- Error monitoring (Sentry)
- Uptime monitoring
- Commission settlement webhook for payroll integration
- NF-e emission integration for billing invoices
- SSO (SAML 2.0 / OIDC) for enterprise tenants
- Deployment pipeline (Vercel + Supabase)
- Runbook documentation
- Data export (GDPR-compliant account deletion)

---

## Domain Capability Targets by Milestone

| Domain | M2 | M3 | M4 | M5 | M6 |
|--------|----|----|----|----|-----|
| **Tracking & Telematics** | — | Schema ✓ | — | Full ✓ | Hardened |
| **Commission Management** | — | Schema ✓ | — | Full ✓ | + Payroll webhook |
| **IAM Enterprise** | — | Schema ✓ | Auth ✓ | Full ✓ | + SSO |
| **Billing Engine** | — | Schema ✓ | — | Basic ✓ | + NF-e |
| **Blueprints** | — | — | — | Mobility + Truck ✓ | All blueprints |
| **Studios** | — | — | — | Access Control + Commercial ✓ | All studios |

---

## Deferred / Backlog

Items identified but not scheduled for M1–M6:

| Item | Notes |
|------|-------|
| Mobile application (React Native / Expo) | After M5 web is stable |
| Satellite tracking fallback | Hardware dependency |
| AI Engine — route optimization | After M5 data is accumulated |
| AI Engine — predictive maintenance | After M5 telemetry data |
| Public REST API (third-party integrations) | Post-launch |
| Multi-currency billing | International expansion |
| White-label / OEM mode | Enterprise tier feature |
| Reporting Engine — custom report builder | Post-launch |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-20 | Initial MASTER_ROADMAP.md created; incorporated Tracking & Telematics, Commission Management, IAM Enterprise as M3–M5 objectives | Documentation Alignment M1.1 |
