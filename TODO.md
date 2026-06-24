# TODO — Shinã Platform

Active task list. Items are ordered by priority within each section.

---

## In Progress

_Nothing in progress._

---

## Milestone 2 — Core Domain ✅ (2026-06-20)

- [x] Create `packages/domain` (`@shina/domain`)
- [x] Implement shared kernel (AggregateRoot, Entity, DomainEvent, DomainError, createEvent)
- [x] Implement Value Objects: Money, DateRange, Email, Phone, Coordinates, Address
- [x] Implement 16 aggregates: Tenant, Branch, Person, Organization, Asset, AssetType, Resource, Capability, Operation, Allocation, Contract, BillingAccount, Invoice, Notification, WorkflowDefinition, RuleSet
- [x] Implement all enums per aggregate context
- [x] Implement domain events per aggregate
- [x] Create per-context barrel exports
- [x] Create root `src/index.ts`
- [x] Validate `pnpm typecheck` — zero errors ✅
- [x] Validate `pnpm build` — clean emit ✅

## Milestone 3 — Database ▶ Next

### Planning ✅ (2026-06-20)

- [x] Write `docs/DATABASE.md` — 22 tables, column mapping, all aggregates
- [x] Write `docs/RLS_POLICIES.md` — JWT strategy, policy matrix, security invariants
- [x] Write `docs/MIGRATION_GUIDE.md` — 21 migration files, FK graph, ON DELETE table, triggers, risk register
- [x] Write `supabase/docs/SCHEMA_PLAN.md` — schema layout, VO mapping rules, aggregate→table mapping, pre-implementation checklist
- [x] Lock all 10 design decisions (2026-06-20)

### Implementation (pending)

- [ ] Create Supabase project (local via CLI or cloud)
- [ ] Run `supabase link` to connect CLI
- [ ] Implement M3 Auth Hook — JWT `tenant_id` claim injection
- [ ] Scaffold `packages/db` (`package.json`, `tsconfig.json`)
- [ ] Write 21 migration files per `MIGRATION_GUIDE.md` order
- [ ] Write `supabase/seed.sql` (dev-only seed data)
- [ ] Run `supabase db reset` — validate migrations apply cleanly
- [ ] Run `supabase gen types typescript` → `packages/db/src/supabase.types.ts`
- [ ] Validate RLS policies in local Supabase stack

---

## Backlog

- [ ] Set up Turbo remote cache (`TURBO_TOKEN` + `TURBO_TEAM` secrets in GitHub Actions)
- [ ] Add Renovate for dependency updates
- [ ] Add `pnpm audit` to CI
- [ ] Document ADR process in `docs/adr/`
- [ ] Add VSCode recommended extensions (`.vscode/extensions.json`)
- [ ] Confirm CI pipeline passes on first push to GitHub

---

## Completed

### Milestone 1 — Foundation ✅ (2026-06-20)

- [x] Create monorepo with Turborepo
- [x] Configure pnpm workspaces
- [x] Configure TypeScript (base, Next.js, react-library variants)
- [x] Configure ESLint v9 flat config
- [x] Configure Prettier
- [x] Configure Husky + lint-staged
- [x] Configure Commitlint
- [x] Configure Changesets
- [x] Create directory structure (`apps/`, `packages/`, `tooling/`, `supabase/`, `docs/`, `scripts/`, `tests/`)
- [x] Configure GitHub Actions CI (install, lint, typecheck, build)
- [x] Write README.md
- [x] Write MASTER_BOOTSTRAP.md
- [x] Write CLAUDE.md
- [x] Write ENGINEERING_PRINCIPLES.md
- [x] Write EXECUTION_PLAN.md
- [x] Write ROADMAP.md
- [x] Write TODO.md
- [x] Initialize git repository
- [x] Create initial commit
- [x] Push `main` to GitHub (github.com/FabioLuizSilveira/Shin-IA)
- [x] Create and push `develop` branch
- [x] Configure branch protection for `main` (Ruleset: deletion, force-push, PR review, status checks)
- [x] Validate `pnpm install` ✅
- [x] Validate `pnpm lint` ✅
- [x] Validate `pnpm typecheck` ✅
- [x] Validate `pnpm build` ✅
- [x] Validate Husky hooks active ✅
- [x] Validate Commitlint working ✅

### Milestone 1.1 — Documentation Alignment ✅ (2026-06-20)

- [x] Write `docs/ARCHITECTURE.md`
- [x] Write `docs/DOMAIN_MODEL.md`
- [x] Write `docs/CANONICAL_DATA_MODEL.md`
- [x] Write `docs/EVENT_CATALOG.md`
- [x] Write `docs/IAM.md`
- [x] Write `docs/PERMISSIONS_MATRIX.md`
- [x] Write `docs/TENANT_STUDIO.md`
- [x] Write `docs/BLUEPRINTS.md`
- [x] Write `docs/BILLING.md`
- [x] Write `MASTER_ROADMAP.md`
