# Shinã Platform

A monorepo housing the Shinã platform — built with Turborepo, pnpm, and TypeScript.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.0.0
- [pnpm](https://pnpm.io/) >= 9.0.0

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development servers
pnpm dev

# Lint all packages
pnpm lint

# Type-check all packages
pnpm typecheck

# Build all packages
pnpm build

# Format code
pnpm format
```

## Monorepo Structure

```
shina-platform/
├── apps/              # Deployable applications (Next.js, etc.)
├── packages/          # Shared internal libraries
├── tooling/           # Shared tooling configs (ESLint, TypeScript, Prettier)
│   ├── eslint/        # @shina/eslint-config
│   └── typescript/    # @shina/typescript-config
├── supabase/          # Database schema, migrations, and edge functions
├── docs/              # Project documentation
├── scripts/           # Utility scripts
├── tests/             # Integration and E2E tests
└── .github/workflows/ # GitHub Actions CI/CD pipelines
```

## Tooling

| Tool | Purpose |
|------|---------|
| [Turborepo](https://turbo.build/) | Monorepo task orchestration and caching |
| [pnpm](https://pnpm.io/) | Fast, disk-efficient package manager |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [ESLint](https://eslint.org/) | Code linting |
| [Prettier](https://prettier.io/) | Code formatting |
| [Husky](https://typicode.github.io/husky/) | Git hooks |
| [lint-staged](https://github.com/okonet/lint-staged) | Pre-commit linting on staged files |
| [Commitlint](https://commitlint.js.org/) | Conventional commit message enforcement |
| [Changesets](https://github.com/changesets/changesets) | Versioning and changelog management |

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/).

```
feat: add new feature
fix: resolve bug
docs: update documentation
chore: maintenance task
ci: CI/CD changes
test: add or update tests
refactor: code restructuring
perf: performance improvements
```

## License

Private — All rights reserved.
