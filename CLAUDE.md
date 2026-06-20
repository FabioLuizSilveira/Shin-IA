# CLAUDE.md — Shinã Platform

Instructions and context for Claude Code when working on this project.

---

## Project Context

**Shinã Platform** is a monorepo built with Turborepo and pnpm. Read `MASTER_BOOTSTRAP.md` and `ARCHITECTURE.md` before making structural changes.

---

## Milestone Gate

Always confirm which Milestone is active before implementing features.

- **M1 (current):** Foundation only. No apps, no DB, no auth, no UI libraries.
- **M2+:** Unlocked after explicit user confirmation.

Do not implement anything beyond the active milestone without explicit approval.

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
