# Execution Plan — Shinã Platform

Milestone-based delivery plan. Each milestone is a vertical slice that can be reviewed and approved before the next begins.

---

## Milestone 1 — Foundation ✅

**Goal:** Working monorepo with all tooling configured.

**Scope:**
- [x] Turborepo monorepo setup
- [x] pnpm workspace configuration
- [x] TypeScript base configuration
- [x] ESLint (v9 flat config)
- [x] Prettier
- [x] Husky + lint-staged
- [x] Commitlint (Conventional Commits)
- [x] Changesets for versioning
- [x] Directory structure (`apps/`, `packages/`, `supabase/`, `docs/`, `scripts/`, `tooling/`, `tests/`)
- [x] GitHub Actions CI (install, lint, typecheck, build)
- [x] Base documentation (`README.md`, `CLAUDE.md`, `MASTER_BOOTSTRAP.md`, etc.)

**Acceptance Criteria:**
- `pnpm install` exits 0
- `pnpm lint` exits 0
- `pnpm typecheck` exits 0
- `pnpm build` exits 0

---

## Milestone 2 — Applications ⬜

**Goal:** Running application shells for all client surfaces.

**Scope:**
- [ ] `apps/web` — Next.js 15 app (App Router)
- [ ] `packages/ui` — Shared component library (shadcn/ui)
- [ ] `packages/utils` — Shared utility functions
- [ ] `packages/types` — Shared TypeScript types
- [ ] Environment variable management (`.env.example`)
- [ ] Basic routing structure

**Acceptance Criteria:**
- `pnpm dev` starts all apps
- Each app renders a placeholder page

---

## Milestone 3 — Database ⬜

**Goal:** Supabase project connected with schema and migrations.

**Scope:**
- [ ] Supabase project initialized
- [ ] Core schema defined
- [ ] Initial migrations written
- [ ] Row Level Security (RLS) policies
- [ ] Supabase client package (`packages/db`)
- [ ] Type-safe database types (generated)

---

## Milestone 4 — Authentication ⬜

**Goal:** Users can sign up, log in, and manage sessions.

**Scope:**
- [ ] Supabase Auth integration
- [ ] Sign-up / Login flows
- [ ] Protected routes
- [ ] Session management
- [ ] Auth middleware

---

## Milestone 5 — Core Features ⬜

**Goal:** Core domain logic implemented.

**Scope:** TBD — defined after M4 review.

---

## Milestone 6 — Polish & Launch ⬜

**Goal:** Production-ready application.

**Scope:**
- [ ] Performance audit (Core Web Vitals)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] E2E tests (Playwright)
- [ ] Error monitoring (Sentry)
- [ ] Analytics
- [ ] Deployment pipeline (Vercel + Supabase)

---

## Rules

1. **No skipping milestones.** Each milestone must have all acceptance criteria passing before the next begins.
2. **No scope creep.** If a feature isn't in the active milestone, it goes in the backlog.
3. **Document decisions.** Any deviation from this plan requires an ADR.
