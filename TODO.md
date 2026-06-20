# TODO — Shinã Platform

Active task list. Items are ordered by priority within each section.

---

## In Progress

_Nothing in progress — awaiting Milestone 2 sign-off._

---

## Milestone 2 — Next (ready to start)

- [ ] Scaffold `apps/web` with Next.js 15
- [ ] Create `packages/ui` with shadcn/ui
- [ ] Create `packages/utils`
- [ ] Create `packages/types`
- [ ] Configure path aliases
- [ ] Add Storybook (optional)

---

## Milestone 3 (Blocked — M2 must complete first)

- [ ] Create Supabase project
- [ ] Define core schema
- [ ] Write initial migration
- [ ] Generate TypeScript types from schema
- [ ] Create `packages/db` with Supabase client

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
