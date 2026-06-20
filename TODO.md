# TODO — Shinã Platform

Active task list. Items are ordered by priority within each section.

---

## In Progress

- [ ] Validate Milestone 1 acceptance criteria locally
  - [ ] `pnpm install`
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm build`

---

## Milestone 1 Remaining

- [ ] Initialize git repository (`git init`)
- [ ] Create initial commit
- [ ] Push to remote repository
- [ ] Set `TURBO_TOKEN` and `TURBO_TEAM` secrets in GitHub Actions
- [ ] Confirm CI pipeline passes on first push

---

## Milestone 2 (Blocked — M1 not signed off)

- [ ] Scaffold `apps/web` with Next.js 15
- [ ] Create `packages/ui` with shadcn/ui
- [ ] Create `packages/utils`
- [ ] Create `packages/types`
- [ ] Configure path aliases
- [ ] Add Storybook (optional)

---

## Milestone 3 (Blocked)

- [ ] Create Supabase project
- [ ] Define core schema
- [ ] Write initial migration
- [ ] Generate TypeScript types from schema
- [ ] Create `packages/db` with Supabase client

---

## Backlog

- [ ] Set up Turbo remote cache
- [ ] Add Renovate for dependency updates
- [ ] Add `pnpm audit` to CI
- [ ] Document ADR process in `docs/adr/`
- [ ] Add VSCode recommended extensions (`.vscode/extensions.json`)

---

## Completed

- [x] Create monorepo with Turborepo
- [x] Configure pnpm workspaces
- [x] Configure TypeScript (base, Next.js, react-library variants)
- [x] Configure ESLint v9 flat config
- [x] Configure Prettier
- [x] Configure Husky + lint-staged
- [x] Configure Commitlint
- [x] Configure Changesets
- [x] Create directory structure
- [x] Configure GitHub Actions CI
- [x] Write README.md
- [x] Write MASTER_BOOTSTRAP.md
- [x] Write CLAUDE.md
- [x] Write ENGINEERING_PRINCIPLES.md
- [x] Write EXECUTION_PLAN.md
- [x] Write ROADMAP.md
- [x] Write TODO.md
