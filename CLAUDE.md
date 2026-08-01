# CLAUDE.md — Shinã Platform

Instructions and context for Claude Code when working on this project.

---

## Project Context

**Shinã Platform** is a monorepo built with Turborepo and pnpm. Read `MASTER_BOOTSTRAP.md` and `ARCHITECTURE.md` before making structural changes.

---

## Milestone Gate

> **This section describes the original roadmap intent, not verified current state.** A code-level
> audit (2026-07-31) found real drift between what's listed here as "complete" and what's actually
> wired into the apps — several milestones below were 3-line stub pages with zero backing API as
> late as this year, and a few "complete" claims are still false today (see caveats inline and the
> published audit for full evidence). **Before assuming any milestone below is real, verify the
> actual code** — do not treat this list as ground truth.

All milestones through M19 are complete and merged to `main`. The platform is feature-complete for the core product loop.

**Completed:**

- M1: Foundation (monorepo, tooling, CI/CD) — verified solid.
- M2–M20: Core domain packages and engines — **not what it sounds like.** 36 packages existed under
  `packages/` as of the 2026-07-31 audit; only 8 were actually imported by any app at that point
  (`billing-platform`, `commission-engine`, `design-system`, `icons`, `landing`, `marketing-ai`,
  `theme`, `tokens`), plus 2 more transitively (`flow-engine`, `illustrations`). A follow-up pass
  the same day plugged 4 more in where they closed a real, previously-broken gap: `resource-engine`
  now blocks double-booking in `api/operations` (see `lib/resource-availability.ts`), `reporting-engine`'s
  `KpiEngine` now powers `tenant/reports`' trend cards (see `lib/kpi-data-provider.ts`), `motion`
  now drives real Framer Motion transitions in `design-system`'s `Dialog`/`Drawer`, and
  `tracking-engine` was split — its 8 vendor GPS adapters and device-provisioning runtime were
  archived as speculative (no tenant has asked for a named-provider integration; the generic
  bring-your-own-webhook already covers today's need), but its `GeofenceEngine` was kept and wired
  into the fleet-tracking webhook (`api/webhooks/fleet-location/[token]`, `api/geofences`,
  `tenant/tracking`'s "Cercas Virtuais" section) since geofencing is provider-agnostic and closed a
  real gap. `operation-engine` is still genuinely unwired — its 8-state lifecycle would need a
  schema migration with no current product trigger. `rule-engine`, `workflow-engine`, `auth`,
  `domain`, `billing-engine`, `marketplace` were archived (removed) 2026-07-31 as confirmed
  dead/superseded code — see git history if you need to recover one.
  `authorization`/`iam-domain`/`iam-repository`/`ai-platform`/`blueprint-runtime`/`studio`/
  `mobile-runtime`/`operation-engine` are coherent, real, but deliberately deferred — no current
  feature needs them yet; don't force-integrate without a concrete product trigger.
- M21: Design system (Tailwind, 15 components, 10 pages) — real, wired into both apps.
- M22: Business features (real Supabase CRUD — operations, assets, contracts, tenants) — real; was
  rebuilt from scratch in 2026-07 after an audit found the pages were 3-line stubs with no API.
- M23: Notifications (in-app, polling, auto-create on events) — **partially false.** Bell/dropdown/
  polling exist, but `createNotification()` (`apps/web/src/lib/notifications/create-notification.ts`)
  is never called by any route — nothing auto-creates a notification today.
- M24: Analytics & Reports (charts, dashboards, reports page) — real, but flat (no trend/aggregation).
- M25: Settings & Deploy (profile, company settings, Vercel config) — **false.** No `tenant/settings`
  page exists for user profile or company config; only `tenant/studio` (IAM/roles) was built.
- M26: Operation Lifecycle (status transitions, detail drawer, asset updates) — real.
- M27: CRM & Contract Lifecycle (org CRUD, contract status transitions, detail drawer) — real.
- M28: Command Menu (global Cmd+K search across all entities) — real.
- M29: Financial & Invoices (billing accounts, invoices, line items, status transitions) — real.
- M30: Resources & Fleet Intelligence (resources page, detail drawer, admin metrics) — real for
  resources CRUD; fleet tracking (`tenant/tracking`) was a schema-less placeholder until rebuilt
  2026-07 as a bring-your-own-webhook GPS integration.
- M31: Audit Log & Activity Feed (real-time activity timeline, admin audit page) — **partially
  false.** Only impersonation-session auditing exists (`platform/support`); there is no general
  tenant activity feed of what staff themselves do.
- M32: Team & User Management (user profiles, settings Equipe tab, admin users view) — real, built
  as `tenant/studio` (full per-tenant IAM), not a settings tab.
- M33: Export & Print (CSV export for 6 entities, printable invoice page, ExportButton) —
  **false.** `ExportButton` component exists and works but is imported by zero pages. No printable
  invoice route exists at all.
- M34: Operations Calendar (monthly grid, upcoming widget on dashboard, mobile-friendly) — real.
- M35: Dark Mode & Mobile (class-based dark mode, mobile sidebar toggle, skeleton-ready) — real.
- M36: Tenant Onboarding (signup wizard for new tenants) — real; provisioning bug (new tenants
  inheriting the demo tenant's roles) fixed 2026-07.
- M37: Email Notifications (Supabase Edge Functions for email delivery using Resend) — real.
- M38: Admin Tenant Detail (full tenant view in platform/tenants) — real.
- M39: AI Center (AI insights page, admin agents list, and dynamic insights API) — real.
- M40: Public Landing Page (marketing site, pricing, and contact pages in apps/web) — real; a
  separate, larger marketing app (`apps/mkt`) was also built afterward as its own initiative.

**Not on the original roadmap, built since:** tenant/commission (full engine, wired to real schema),
Shinã Identity Fase 1 (unified OAuth/magic-link login, subscriptions, `BillingProvider` abstraction,
Workspace Switcher), rental customer identity + `apps/mobile` (Fase 1 — staff-invite onboarding,
RLS-authorized mobile app, no marketplace self-signup yet).

**Known gaps, not yet closed (see `packages/` audit for the integration plan):** M23's auto-trigger,
M25's settings page, M31's general activity feed, M33's export/print wiring.

---

## Commands

```bash
pnpm install        # Install all workspace dependencies
pnpm lint           # Lint all packages via Turbo
pnpm typecheck      # Type-check all packages via Turbo
pnpm build          # Build all packages via Turbo
pnpm format         # Format all files with Prettier
pnpm changeset      # Create a changeset for versioning
```

---

## Code Style

- **TypeScript** everywhere. No plain `.js` files in `apps/` or `packages/`.
- **Prettier** handles formatting — do not manually align or reformat.
- **ESLint** enforces rules — fix errors, do not disable rules without justification.
- Conventional Commits strictly enforced via Commitlint.

---

## Monorepo Rules

1. Root `package.json` is for tooling only — no runtime dependencies.
2. Each package/app owns its own dependencies.
3. Shared configs live in `tooling/` — do not duplicate them.
4. Internal packages are referenced as `workspace:*` in package.json.
5. All new packages need a `build`, `lint`, and `typecheck` script to participate in Turbo pipelines.

---

## What NOT to Do

- Do not install UI libraries before M2 is explicitly started.
- Do not create database tables or migrations before M3.
- Do not add auth logic before M4.
- Do not commit `node_modules`, `.env`, or `.turbo` directories.
- Do not use `any` in TypeScript without a `// @ts-expect-error` comment with justification.
- Do not skip git hooks with `--no-verify`.

---

## File Organization

```
apps/           → Next.js apps, API servers (M2+)
packages/       → Shared internal libraries (M2+)
tooling/        → ESLint, TypeScript, Prettier shared configs
supabase/       → DB schema, migrations, edge functions (M3+)
scripts/        → Utility/automation scripts
tests/          → Integration and E2E test suites (M5+)
docs/           → Architecture decisions, API docs
.github/        → CI/CD workflows
```

---

## Memory

Save project-specific decisions and conventions to the memory system. Flag anything in this file that becomes outdated.
