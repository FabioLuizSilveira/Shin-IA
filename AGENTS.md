# AGENTS.md — Shinã Platform

Instructions and context for Codex when working on this project.

---

## Project Context

**Shinã Platform** is a monorepo built with Turborepo and pnpm. Read `MASTER_BOOTSTRAP.md` and `ARCHITECTURE.md` before making structural changes.

---

## Milestone Gate

All milestones through M19 are complete and merged to `main`. The platform is feature-complete for the core product loop.

**Completed:**

- M1: Foundation (monorepo, tooling, CI/CD)
- M2–M20: Core domain packages and engines
- M21: Design system (Tailwind, 15 components, 10 pages)
- M22: Business features (real Supabase CRUD — operations, assets, contracts, tenants)
- M23: Notifications (in-app, polling, auto-create on events)
- M24: Analytics & Reports (charts, dashboards, reports page)
- M25: Settings & Deploy (profile, company settings, Vercel config)
- M26: Operation Lifecycle (status transitions, detail drawer, asset updates)
- M27: CRM & Contract Lifecycle (org CRUD, contract status transitions, detail drawer)
- M28: Command Menu (global Cmd+K search across all entities)
- M29: Financial & Invoices (billing accounts, invoices, line items, status transitions)
- M30: Resources & Fleet Intelligence (resources page, detail drawer, admin metrics)
- M31: Audit Log & Activity Feed (real-time activity timeline, admin audit page)
- M32: Team & User Management (user profiles, settings Equipe tab, admin users view)
- M33: Export & Print (CSV export for 6 entities, printable invoice page, ExportButton)
- M34: Operations Calendar (monthly grid, upcoming widget on dashboard, mobile-friendly)
- M35: Dark Mode & Mobile (class-based dark mode, mobile sidebar toggle, skeleton-ready)
- M36: Tenant Onboarding (signup wizard for new tenants)
- M37: Email Notifications (Supabase Edge Functions for email delivery using Resend)
- M38: Admin Tenant Detail (full tenant view in platform/tenants)
- M39: AI Center (AI insights page, admin agents list, and dynamic insights API)
- M40: Public Landing Page (marketing site, pricing, and contact pages in apps/web)

**All planned roadmap milestones (M1 to M40) are complete.**

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
