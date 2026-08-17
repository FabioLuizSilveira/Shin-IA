# ADR — Unified Shinã Mobile Application

**Status**: ACCEPTED · **Data**: 2026-08-17 (aprovado pelo usuário no gate M22, sobre os achados de
M21 — [EMERGENT_IMPORT_AUDIT.md](../mobile/EMERGENT_IMPORT_AUDIT.md))

## Decision

Shinã will maintain **one official mobile application** serving `tenant_user`, `customer`,
`operator`, and `unprovisioned` identities — one bundle, one iOS app, one Android app, one App Store
listing, one Google Play listing, one Supabase Auth integration, one Mobile API contract, one
code-base. The experience inside the app is determined dynamically at runtime by the identity,
`userType`, `permissions`, `entitlements`, `features`, and `navigation` returned by
`GET /api/mobile/bootstrap` — never by a separate binary per persona.

## Context

M21 audited `origin/feat/emergent-mobile-integration`, a branch pushed by an external tool
("Emergent") containing a fully separate generated app: a dead Python/MongoDB backend (never called
by the live frontend) and a well-built Expo frontend visually and structurally aimed at a
**tenant-staff/fleet-manager persona** ("Shinã I.A.", dark theme, "Comandante Shinã"). This is a
different persona than the existing `apps/mobile` (real, already in this monorepo), which was built
for a **customer persona** ("Shinã Cliente", light theme, rental-flow-focused).

Two working, non-trivial mobile front-ends now exist for the same product, aimed at different
personas of the same backend. Maintaining them as separate binaries would introduce:

- duplicated authentication (two Supabase client configurations, two OAuth setups to keep in sync);
- duplicated release pipelines (two App Store listings, two Google Play listings, two sets of
  signing credentials, two EAS build profiles);
- duplicated mobile infrastructure (two `mobile_devices` push-registration flows, two deep-link
  schemes to maintain);
- duplicated API clients (two typed adapters against the same `/api/mobile/*` contract, drifting
  independently);
- branding fragmentation (a tenant staff member and a rental customer would not recognize the
  product as the same app);
- higher App Store/Google Play operational cost (two developer account listings, two review
  cycles, two sets of screenshots/metadata to keep current);
- duplicated QA (every backend change needs manual verification against two clients instead of
  one);
- slower feature evolution (a new Wave 2–4 mobile BFF endpoint needs wiring twice, in two
  codebases with different conventions).

## Decision

Use one mobile binary with server-driven persona resolution:

```
App Shinã
↓
Supabase Auth
↓
GET /api/mobile/bootstrap
↓
Identity Resolution (userType)
↓
permissions + entitlements + features + navigation
↓
Persona Experience
```

The Emergent frontend becomes the **primary visual foundation** — its design system, components,
animations, layout, navigation patterns, dark theming, typography, spacing, and approved
interactions are preserved, not rebuilt for technical preference.

The existing `apps/mobile` becomes a **functional-flow source** — its customer-facing screens,
components, integration logic, state handling, error handling, and already-tested journeys are
audited and selectively merged into the unified app wherever they are superior or more complete than
what would otherwise need to be built from scratch. It does not continue as a separate shipped
product merely because it already has working customer flows.

`userType` determines **experience** (which screens/navigation render). It never determines
**authorization** by itself — every operation remains gated server-side by
`userType + permissions + entitlements + resource scope`, exactly as already established across
Waves 0–4 of the Mobile BFF (`requireMobileContext()`, `hasTenantPermission()`, ownership-scoped
queries). The app uses bootstrap data for UX only; the backend remains the sole authorization
authority.

## Consequences

**Positive:**

- one product, one app, one auth integration, one API contract, one release pipeline;
- consistent brand across every persona;
- easier adoption — a tenant that also has a rental-customer relationship (or an operator who is
  also tenant staff) never needs to install a second app;
- every Mobile BFF endpoint built in Waves 2–4 gets a single, consistent consumer instead of two
  drifting ones.

**Trade-offs:**

- navigation becomes persona-aware — a single `PersonaRouter` layer must correctly branch on
  `bootstrap.userType`, and every screen addition must declare which persona(s) it belongs to;
- `GET /api/mobile/bootstrap` becomes a critical-path dependency for the entire app's shell, not
  just a data-population call — its availability/latency directly gates first render;
- more rigorous feature/permission gating is required in the client, since one binary can now
  reach code paths for personas it is not currently authenticated as (mitigated by: the backend
  never trusting client-side gating as real authorization, per the Authorization Principle above);
- integration testing must cover all four personas (`tenant_user`, `customer`, `operator`,
  `unprovisioned`) plus persona-isolation assertions (a customer session must never render
  tenant-staff UI, etc.), not just one flow.
