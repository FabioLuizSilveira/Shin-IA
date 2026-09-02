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
> published audit for full evidence). A follow-up import-grep spot-check (2026-09-02, `grep -rl
"@shina/<pkg>" apps/*/src` per package) found the 2026-07-31 audit itself had already drifted —
> see the corrected package list and M23/M25 notes below. **Before assuming any milestone below is
> real, verify the actual code** — do not treat this list as ground truth.

All milestones through M19 are complete and merged to `main`. The platform is feature-complete for the core product loop.

**Completed:**

- M1: Foundation (monorepo, tooling, CI/CD) — verified solid.
- M2–M20: Core domain packages and engines — **not what it sounds like, and the 2026-07-31 audit's
  own claims have since drifted too.** As of a 2026-09-02 import-grep re-check, `resource-engine`
  is **not** actually wired into `api/operations` despite the earlier audit's claim — the
  double-booking guard there (`lib/resource-availability.ts`) is a hand-rolled reimplementation that
  never imports the package; treat that claim as false until someone actually wires the package in.
  `reporting-engine`'s `KpiEngine` (real, powers `tenant/reports`' trend cards via
  `lib/kpi-data-provider.ts`) and `motion` (real, drives `design-system`'s `Dialog`/`Drawer`
  transitions) still check out. `tracking-engine` is still split as described — `GeofenceEngine`
  wired into the fleet-tracking webhook (`api/webhooks/fleet-location/[token]`, `api/geofences`,
  `tenant/tracking`'s "Cercas Virtuais"), the 8 vendor GPS adapters unused. `operation-engine`,
  `rule-engine`, `workflow-engine`, `auth`, `domain`, `billing-engine`, `marketplace`,
  `authorization`, `iam-domain`, `iam-repository` all **still exist under `packages/` and are still
  genuinely unwired** (zero imports from any app) — the 2026-07-31 audit's claim that
  `rule-engine`/`workflow-engine`/`auth`/`domain`/`billing-engine`/`marketplace` were "archived
  (removed)" was itself wrong (or reverted without updating this file) as of the 2026-09-02
  re-check: they're still on disk, just unused. Don't trust either audit's claim about a specific
  package without re-running the grep yourself: `grep -rl "@shina/<pkg>" apps/*/src apps/*/app`.
  `ai-platform` and `blueprint-runtime` have real (if limited) usage — 2 and 4 importing files
  respectively as of 2026-09-02 — contradicting the earlier "deliberately deferred, no current
  feature needs them" framing; `studio` (customization/branding, `api/tenant-studio/*`,
  `tenant/customization/branding`) is real and imported in 5 files — don't confuse it with the
  `tenant/studio` _route_ (IAM/roles, M32), which is a same-named but unrelated hand-rolled feature
  that doesn't import the `@shina/studio` package. `mobile-runtime` not re-checked in the 2026-09-02
  pass.
- M21: Design system (Tailwind, 15 components, 10 pages) — real, wired into both apps.
- M22: Business features (real Supabase CRUD — operations, assets, contracts, tenants) — real; was
  rebuilt from scratch in 2026-07 after an audit found the pages were 3-line stubs with no API.
- M23: Notifications (in-app, polling, auto-create on events) — **real as of 2026-09-02** (was
  "partially false" at the 2026-07-31 audit — the gap has since been closed, not by this session).
  Bell/dropdown/polling exist, and `createNotification()`
  (`apps/web/src/lib/notifications/create-notification.ts`) is now called from 14+ routes
  (commissions approval, contracts, findings, infractions, inspections, mobile customer flows,
  operations, platform-support threads) — auto-create on events is real today.
- M24: Analytics & Reports (charts, dashboards, reports page) — real, but flat (no trend/aggregation).
- M25: Settings & Deploy (profile, company settings, Vercel config) — **partially outdated.** The
  2026-07-31 "no `tenant/settings` page exists at all" claim is false as of 2026-09-02:
  `tenant/settings` now exists with real `billing` (Fase E of the Stripe -> Asaas migration —
  manage/cancel subscription, update card) and `legal` (contract templates, acceptance detail)
  sub-pages, plus its own root page. Whether a dedicated user-profile or company-config page exists
  under it wasn't re-verified — check before assuming either way. `tenant/studio` (IAM/roles) is a
  separate, unrelated route.
- M26: Operation Lifecycle (status transitions, detail drawer, asset updates) — real.
- M27: CRM & Contract Lifecycle (org CRUD, contract status transitions, detail drawer) — real.
- M28: Command Menu (global Cmd+K search across all entities) — real.
- M29: Financial & Invoices (billing accounts, invoices, line items, status transitions) — real.
- M30: Resources & Fleet Intelligence (resources page, detail drawer, admin metrics) — real for
  resources CRUD; fleet tracking (`tenant/tracking`) was a schema-less placeholder until rebuilt
  2026-07 as a bring-your-own-webhook GPS integration.
- M31: Audit Log & Activity Feed (real-time activity timeline, admin audit page) — **real as of
  2026-09-02** (was "partially false" at the 2026-07-31 audit — the gap has since been closed, not
  by this session). `tenant_activity_log` (migration `20260056000000`) + `lib/activity-log.ts`'s
  `logActivity()` is called from 65 files across contracts, operations, infractions, inspections,
  maintenance, commissions, blueprints, onboarding, and subscription webhooks; `lib/mobile-audit.ts`
  reuses the same table for sensitive mobile actions. Real read API (`api/tenant-activity`) and a
  real, linked-in-the-sidebar UI page (`tenant/activity`) exist. The one actual (cosmetic, not
  functional) gap found and fixed 2026-09-02: the page's `ENTITY_LABEL`/`ACTION_LABEL` dictionaries
  only covered 4 of the real entity types/actions being logged — expanded to match.
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
RLS-authorized mobile app, no marketplace self-signup yet), Maintenance + Asset Intelligence module
(P0-P2: Inspection→Maintenance and Tracking→Maintenance integration, AI Copilot, Maintenance
Auditor, Shinã Insights dashboard — real and live, not a "planned layer"), Shinã-native TOTP MFA
(RFC 6238 step-up, independent of Supabase/Firebase MFA — real and live, not just "decided"),
**full Stripe -> Asaas payment gateway migration** (completed through Fase F as of 2026-09-02:
platform SaaS subscriptions, Shinã MKT subscriptions, and the customer-facing one-off AR/invoices
module all run on Asaas; every Stripe-specific code path, dependency, and env var removed from the
repo — see git log for `feat(billing)`/`refactor(billing)` commits on `main` if you need the
phase-by-phase detail; the one documented open gap is the MKT product's 14-day refund guarantee,
never reimplemented for Asaas, tracked in `apps/mkt/src/app/api/checkout/route.ts`'s own comment).

**Known gaps, not yet closed:** M33's export/print wiring, and whatever M25's profile/company-config
page turns out to still be missing (not re-verified 2026-09-02). M23's auto-trigger gap, M31's
activity feed, the 2026-07-31 audit's package-integration claims, the Asaas plan-change flow (was
completely broken post-Fase-F, fixed 2026-09-02), and the Asaas 14-day refund guarantee (MKT
product, reimplemented 2026-09-02) were all closed/corrected since — see inline notes above and
git log's `feat(billing)`/`fix(billing)` commits instead of a stale integration-plan pointer.

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
