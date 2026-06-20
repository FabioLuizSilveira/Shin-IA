# Master Bootstrap — Shinã Platform

This document is the single source of truth for bootstrapping the Shinã Platform monorepo from zero.

---

## 1. Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 20.0.0 | Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) |
| pnpm | >= 9.0.0 | `npm install -g pnpm` |
| Git | >= 2.40 | With SSH key configured |

---

## 2. First-Time Setup

```bash
# 1. Clone the repository
git clone <repo-url> shina-platform
cd shina-platform

# 2. Install dependencies (installs all workspaces)
pnpm install

# 3. Verify tooling
pnpm lint        # must exit 0
pnpm typecheck   # must exit 0
pnpm build       # must exit 0
```

---

## 3. Environment Variables

Copy the relevant `.env.example` files in each app before running locally:

```bash
# When apps exist (Milestone 2+)
cp apps/web/.env.example apps/web/.env.local
```

Required secrets (set in GitHub Actions → Settings → Secrets):

| Secret | Purpose |
|--------|---------|
| `TURBO_TOKEN` | Turborepo remote cache token |
| `SUPABASE_URL` | Supabase project URL (added in Milestone 3) |
| `SUPABASE_ANON_KEY` | Supabase anon key (added in Milestone 3) |

---

## 4. Milestone Checklist

| Milestone | Status | Description |
|-----------|--------|-------------|
| M1 — Foundation | ✅ | Monorepo, tooling, CI/CD |
| M2 — Apps | ⬜ | Next.js web app scaffold |
| M3 — Database | ⬜ | Supabase schema and migrations |
| M4 — Auth | ⬜ | Authentication flows |
| M5 — Core Features | ⬜ | Domain logic and APIs |
| M6 — Polish | ⬜ | Performance, accessibility, tests |

---

## 5. Adding a New App

```bash
# Create the app directory
mkdir apps/my-app
cd apps/my-app

# Initialize package.json
pnpm init

# Add shared configs
# See existing apps for examples
```

---

## 6. Adding a New Package

```bash
mkdir packages/my-package
cd packages/my-package
pnpm init
```

---

## 7. Creating a Release

```bash
# Stage changes for release
pnpm changeset

# Apply version bumps
pnpm version-packages

# Build and publish
pnpm release
```

---

## 8. CI/CD Pipeline

All pushes to `main` and `develop` trigger:

1. **Install** — `pnpm install --frozen-lockfile`
2. **Lint** — `pnpm lint`
3. **Typecheck** — `pnpm typecheck`
4. **Build** — `pnpm build` (only if lint + typecheck pass)

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for details.
