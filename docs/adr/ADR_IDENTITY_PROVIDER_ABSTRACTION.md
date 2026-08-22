# ADR: Identity Provider Abstraction

**Status:** Accepted
**Date:** 2026-08-22

## Context

Auth is currently 100% Supabase Auth, called directly (`supabase.auth.*`)
from 49 files across `apps/web`, `apps/mkt`, `apps/mobile`. There is no
current plan to switch providers, but the highest-leverage auth call site —
`requireTenantScope()`, which nearly every tenant-scoped API route in
`apps/web` calls — has no seam between "resolve who's calling" and "call
Supabase to find out." A future need to support a second identity backend
(most plausibly a white-label/enterprise SSO requirement) would mean
re-deriving that seam under pressure, in the highest-blast-radius file in
the codebase.

## Decision

Introduce `packages/identity`: an `IdentityProvider` contract, canonical
`ShinaIdentity`/`ShinaSession` types, one real implementation
(`SupabaseIdentityProvider`), and a test-only `FakeIdentityProvider`. Rewire
`requireTenantScope()` (`apps/web/src/lib/tenant-context.ts`) to depend on
the contract via a single instantiation point
(`apps/web/src/lib/identity.ts`), reproducing its exact prior behavior
(verified: full existing test suite green, plus a live end-to-end check
against the hosted database).

Leave every other Supabase-auth call site as-is. Do not install Firebase or
any second provider. Do not migrate users, touch RLS, touch
`custom_access_token_hook`, or change any JWT/session/cookie behavior.

## Alternatives considered

**Do nothing until a second provider is actually needed.** Rejected — the
whole point of an abstraction layer is that it's cheap to add when nothing
depends on it being right yet, and expensive to retrofit once 49 call sites
have grown their own assumptions about `session.user.id` vs. decoded JWT
claims vs. `app_metadata`. Waiting doesn't reduce the eventual cost; it
defers it to whenever there's the least slack to do it carefully.

**Migrate all 49 call sites now.** Rejected — explicitly out of scope. Most
of those call sites are one-shot UI flows (login, MFA, OAuth callback) that
gain nothing from the abstraction and would just be code churn with real
regression risk across three apps, for no product benefit today.

**Extract `apps/web/src/lib/jwt-claims.ts`'s `decodeSessionClaims` into the
new package and have the app import it back.** Rejected — that file is
depended on by ~15 other files in `apps/web` alone, plus `apps/mkt` and
`apps/mobile` each have their own local copies of the same JWT shape.
Forcing a cross-app import isn't possible (apps don't import from each
other's `src/`), and centralizing just the web copy while mkt/mobile keep
their own would create three sources of truth pretending to be one. The
package duplicates the ~15-line decode function instead — small, and it
keeps the new package importable by any app without inventing a shared
dependency that doesn't exist yet.

## Consequences

- Swapping or adding an identity backend for `apps/web`'s tenant-scoped API
  routes now means writing one new class and changing one file
  (`apps/web/src/lib/identity.ts`), not re-deriving two-transport
  (cookie + bearer) auth logic from scratch.
- The other 48 call sites are unchanged and remain directly coupled to
  Supabase — this is a known, accepted gap, not an oversight. See
  `docs/architecture/IDENTITY_PROVIDER_ABSTRACTION.md` for the full list of
  what's in and out of scope.
- One new workspace package (`@shina/identity`) to maintain, following the
  same `package.json`/`tsconfig.json`/vitest scaffold already used by
  `packages/commercial-platform`.
