# Identity Provider Abstraction

**ACTIVE IDENTITY PROVIDER: SUPABASE**
**LEGACY IDENTITY PROVIDER: N/A (no cutover has happened — see [FIREBASE_AUTH_MIGRATION.md](FIREBASE_AUTH_MIGRATION.md))**
**DATABASE: SUPABASE POSTGRESQL**
**STORAGE: SUPABASE**
**AUTHORIZATION: SHINÃ IAM / RBAC / ABAC**
**CANONICAL USER ID: SHINÃ (`shina_user_id` — see `external_identities`, equal to the legacy Supabase `auth.users.id` for every account that existed before the Firebase migration foundation)**

## What this is

`packages/identity` defines a canonical identity contract (`IdentityProvider`,
`ShinaIdentity`, `ShinaSession`) and one implementation of it
(`SupabaseIdentityProvider`) that wraps the Supabase Auth calls the platform
already makes. `apps/web` now resolves its highest-traffic auth entry point —
`requireTenantScope()` in `apps/web/src/lib/tenant-context.ts` — through this
contract instead of calling `supabase.auth.*` directly.

This is an architectural fitting, not a migration. Supabase Auth is still the
only identity backend in production, nothing about login, MFA, OAuth,
sessions, cookies, or RLS changed, and no other call site was touched.

## Why

`supabase.auth.*` is called directly from 49 files across `apps/web`,
`apps/mkt`, and `apps/mobile` (grep audit, 2026-08-22). Most of those are
one-shot, UI-facing flows (login pages, MFA enrollment, OAuth callbacks,
signup) that are tightly coupled to Supabase's own client APIs by nature —
abstracting them buys nothing today and would be pure churn.

`requireTenantScope()` is different: it's the single choke point almost every
tenant-scoped API route calls to resolve "who is this and what tenant do they
belong to," and it's the piece most likely to need a from-scratch rewrite if
the platform ever adopted a second identity backend (e.g. Firebase, in a
future multi-tenant white-label scenario). Routing it through a contract now
means that future rewrite touches one file (`apps/web/src/lib/identity.ts`)
instead of finding and re-deriving the two-transport (cookie + bearer) logic
inline in `tenant-context.ts` again.

## What's abstracted vs. what isn't

**Abstracted** (`packages/identity`):

- Resolving the caller's identity from a cookie session (`getSessionFromCookies`)
- Resolving the caller's identity from a bearer token (`getSessionFromBearerToken`) — the transport `apps/mobile` uses to call `/api/operations`, `/api/organizations`, etc. directly
- Signing out (`signOut`)
- The canonical claim shape (`ShinaIdentity`): `tenantId`, `tenantRole`, `platformRole`, `mfaEnrolled`, subscription statuses — a rename of exactly what `custom_access_token_hook` already injects into the JWT (`supabase/migrations/20260047000000_auth_hook.sql`)

**Deliberately left alone**:

- Login/signup pages (`signInWithPassword`, `signInWithOAuth`, `signInWithOtp`) — one-shot UI flows tied to Supabase's client APIs
- MFA enrollment/confirm/recovery routes
- `middleware.ts` — still decodes the JWT directly (edge runtime, no change of behavior wanted here)
- `apps/mkt`, `apps/mobile` — audited (see grep list below), not wired to `packages/identity`; no product trigger to justify the churn yet
- `apps/web/src/lib/jwt-claims.ts`, `with-permission.ts`, `get-tenant-id.ts` (and its `lib/auth/` duplicate), and the other ~40 call sites outside `tenant-context.ts` — still call `supabase.auth.*` directly, unchanged

## The contract

```typescript
interface IdentityProvider {
  getSessionFromCookies(): Promise<ShinaSession | null>;
  getSessionFromBearerToken(bearerToken: string): Promise<ShinaSession | null>;
  signOut(): Promise<void>;
}

interface ShinaSession {
  identity: ShinaIdentity;
  accessToken: string;
}
```

`SupabaseIdentityProvider` is constructed with two injected client factories
(`getSessionClient`, `getAdminClient`) rather than owning cookie/header
access itself — Next.js's `createServerClient` needs `await cookies()`,
which only the app (not a framework-agnostic package) can provide.
`apps/web/src/lib/identity.ts` is the one file that wires the real Supabase
clients in; swapping providers means changing that file only.

`FakeIdentityProvider` exists for tests only and is never imported by
production route code — it proves the contract is genuinely swappable
(`packages/identity/src/supabase-provider.test.ts`'s "substitutability"
test writes a function against `IdentityProvider` alone and runs it against
both implementations).

## Verification performed

- `pnpm --filter @shina/identity test` — 8 tests (claim decoding, all-claims-present, malformed-token fallback, cookie/bearer session resolution, error paths, cross-provider substitutability)
- `pnpm --filter @shina/web typecheck` — clean
- `pnpm --filter @shina/web test` — 103 existing tests, all still passing (no regression from the `tenant-context.ts` rewire)
- Live end-to-end check against the hosted Supabase project: generated a real session for `fabio@shinaia.com.br`, called `GET /api/operations` with it as a bearer token through the rewired `requireTenantScope()` — got a real 200 with tenant data; a garbage bearer token got the expected 401, not a crash

## What a second provider would still need

Not built, not started — listed so the next person doesn't have to re-derive
scope:

- A `FirebaseIdentityProvider` (or equivalent) implementing the same three methods
- A decision on how `custom_access_token_hook`'s claims (tenant_id/tenant_role/etc.) get produced for a non-Supabase-issued session — that hook is Postgres-side and Supabase-specific; a second provider would need its own claim-issuing story, which is out of scope here
- Wiring the other ~48 call sites, if and when there's a concrete product reason to
