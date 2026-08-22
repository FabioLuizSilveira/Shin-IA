# Firebase Auth Migration

**ACTIVE IDENTITY PROVIDER: SUPABASE**
**LEGACY IDENTITY PROVIDER: N/A — cutover has not happened**
**DATABASE: SUPABASE POSTGRESQL (unchanged)**
**STORAGE: SUPABASE (unchanged)**
**AUTHORIZATION: SHINÃ IAM / RBAC / ABAC (unchanged)**
**CANONICAL USER ID: SHINÃ (`shina_user_id`)**

Status: **Phase 1 (Firebase Foundation) implemented and tested. Phase 2/3 not started — blocked on a real Firebase project.**

## What's migrating and what isn't

Only AUTHENTICATION. Supabase Postgres, Storage, RLS, IAM, tenant/
memberships, billing, contracts, and the AI platform all stay exactly as
they are. Firebase answers "who is this"; Shinã's existing IAM/RBAC/ABAC
still answers "what can they do" — nothing about that split changed.

## Phase 1 — what was built

- `packages/identity`'s `FirebaseIdentityProvider` — implements the same
  `IdentityProvider` contract as `SupabaseIdentityProvider`. Verifies a
  Firebase ID token (bearer path) or session cookie (cookie path) via
  Firebase Admin, then resolves the caller's canonical `ShinaIdentity`
  through Supabase (see below). Never auto-grants a tenant to an unknown
  Firebase UID.
- Canonical identity: `external_identities` (new table,
  `supabase/migrations/20260095000000_identity_provider_abstraction.sql`)
  maps `(provider, provider_subject)` → `shina_user_id`. Every existing
  Supabase user was backfilled with `shina_user_id = their own auth.users.id`
  — the UUID every FK in the system already points at — so **zero existing
  foreign keys changed**. A Firebase UID gets its own row once a user
  actually authenticates with Firebase (Phase 2).
- `resolve_shina_authorization_context(uuid)` — a new Postgres function
  (same migration) that computes the identical claim set
  `custom_access_token_hook` computes (tenant_id, tenant_role,
  platform_role, branch_ids, mfa_enrolled, both subscription statuses,
  `platform_contract_current`), callable as a plain RPC instead of only via
  GoTrue. `custom_access_token_hook` itself was **not touched** — it keeps
  serving Supabase-issued tokens exactly as before.
- `apps/web/src/lib/identity.ts` now resolves its active provider via
  `resolveActiveIdentityProviderKind(process.env)` (reads `IDENTITY_PROVIDER`,
  defaults to `"supabase"`) instead of hardcoding `SupabaseIdentityProvider`
  — the single controlled boundary the migration spec requires, so no route
  code branches on which provider is active.
- `apps/web/src/lib/firebase-admin.ts` — lazily initializes the Firebase
  Admin SDK only when actually called, so importing it (which
  `identity.ts` does unconditionally) is a no-op with zero Firebase env
  vars set, which is every environment's current state.
- SDKs added (no wiring into any login UI yet): `firebase` (client) to
  `apps/web`, `apps/mkt`, `apps/mobile`; `firebase-admin` (server) to
  `apps/web`, `apps/mkt`, and `packages/identity` itself. No Firestore, no
  Realtime Database, no Firebase Storage.
- Env var placeholders added to all three `.env.example` files (no real
  values anywhere — none exist yet).

## Critical audit finding — read before Phase 3

Several real, live flows authorize purely via Postgres RLS reading
`auth.uid()` from a genuine Supabase session, with **no backend API layer
in between**:

- `apps/web/src/lib/rentals-portal.ts` (rental-customer web portal)
- `apps/mobile/src/lib/rentals.ts` (same pattern, mobile)
- the wider rental-customer / operator direct-PostgREST access model
  described in `supabase/migrations/20260055000000_rental_customers.sql`

These work today because the browser/app holds a real Supabase session and
PostgREST resolves `auth.uid()` from it. **A Firebase ID token is not a
Supabase session** — if these flows were cut over to Firebase without
change, `auth.uid()` would resolve to `NULL` for every request and RLS
would silently return zero rows (not an error — a customer would just see
an empty portal).

This is exactly the case the migration spec's item 10 anticipated ("Se
algum fluxo critical depende obrigatoriamente de Supabase Auth para RLS
direto: documentar e criar estratégia de compatibilidade antes do cutover.
Não desligar Supabase Auth até esse ponto estar resolvido."). **Not solved
in Phase 1** — flagged here so Phase 3 does not cut these flows over
without first routing them through a backend API + `requireTenantScope()`-
style service-role access (the same pattern `apps/web/src/app/api/
customer-contracts/*` already uses), which is the only safe compatibility
strategy identified; minting a bridge Supabase JWT from a Firebase session
was explicitly ruled out by spec item 38 as an unsafe improvisation.

## Verification performed (Phase 1)

- `packages/identity`: 17 tests green — Firebase token valid / invalid /
  malformed, unknown Firebase UID (never auto-provisions a tenant), known
  Firebase UID resolving the correct canonical identity + tenant/platform
  role, session-cookie path distinct from bearer path, RPC error
  propagation (not silently swallowed), provider-resolver defaults.
- Live against the hosted Supabase project (not mocked): 24 existing users
  correctly backfilled into `external_identities`; `resolve_shina_
authorization_context` returns correct real data for a real user;
  **found and fixed a real security regression** — Postgres grants
  `EXECUTE` on new functions to `PUBLIC` by default, so the RPC was
  callable by the anonymous key despite an explicit `revoke ... from
authenticated, anon`. Confirmed live before the fix (anon key got real
  data back) and after (anon key gets `permission denied`).
- `apps/web`: typecheck clean, full existing test suite green (103 tests,
  zero regressions from the `tenant-context.ts`/`identity.ts` changes),
  production build (`next build`) green.
- `apps/mkt`: typecheck clean after adding the same dependencies (no code
  changes there yet).
- Secrets scan (manual, this session): no real Firebase credentials exist
  anywhere — none were fabricated, none are committed; every `.env.example`
  entry is blank.

## Live verification against the real Firebase project (update)

A real project (`shinaia-8f787`) now exists, with Email/Password, phone,
Google, and Apple sign-in already enabled in Firebase Console. Web config
and Admin service account are configured in `apps/web/.env.local`,
`apps/mkt/.env.local`, and all three Vercel environments (production/
preview/development) for both apps.

Verified live against the real project (not mocked):

- Firebase Admin SDK initializes with the real service account and
  authenticates (`auth.listUsers()` returned a real, successful response).
- A garbage token is correctly rejected by `verifyIdToken`
  (`auth/argument-error`).
- Full real round trip: created a real temporary Firebase user via Admin
  SDK → confirmed the Admin SDK's own capabilities are fully live.

**One real gap found, unresolved — deferred to Phase 2, not a Phase 1
blocker**: signing in through Firebase's client-facing Identity Toolkit
REST endpoint (`accounts:signInWithPassword`, the same call the `firebase`
client SDK makes under the hood) with `NEXT_PUBLIC_FIREBASE_API_KEY`
consistently returns `400 API key not valid` from a server-side script
(Node `fetch`/`curl`), even after confirming, live, all of: the key value
matches exactly what's configured; "Restrições do aplicativo" = Nenhum;
"Restrições de API" includes both Identity Toolkit API and Token Service
API (25 APIs total, both present); the Identity Toolkit API is enabled at
the project level and shows real logged requests. Every checkable cause on
the Google Cloud Console side was ruled out across 4 rounds of live
verification.

The Admin SDK path — what `FirebaseIdentityProvider` actually uses in
production to verify tokens — is fully confirmed working (real project,
real `listUsers()`, real user create/delete, real garbage-token rejection).
This gap only affects testing the raw REST sign-in call from a script
outside a browser; it's possible a real browser session (proper Origin/
`X-Client-Version` headers the official `firebase` SDK sends, which a bare
`fetch`/`curl` doesn't replicate) behaves differently, or there's an
account/org-level Google Cloud policy invisible from the Console screens
checked so far. Decision (2026-08-22): stop debugging this via synthetic
server-side requests and re-test it for real once Phase 2 builds the
actual login screen with the official SDK running in a browser — that's a
more representative test than a Node script pretending to be a browser
anyway.

## What Phase 2 needs from the user before it can start

- Re-test client-side Email/Password sign-in with the real `firebase` SDK
  in a browser once the login screen exists — if the same error appears
  there, it needs a fresh diagnosis (possibly Google Cloud Support, if it's
  an account/org-level policy).
- Apple sign-in shows as enabled in Firebase Console already, but per spec
  items 19/20, actually exercising it also needs an Apple Developer Service
  ID/Key/Team ID and a registered redirect — not yet confirmed configured.
  Facebook is not yet enabled at all.

## What was explicitly NOT done (Phase 1 scope)

Per spec: no Firestore/Realtime Database/Firebase Storage installed, no
login UI touched, no demo users created, `custom_access_token_hook`
untouched, RLS untouched, IAM untouched, no data/user migration, no
provider cutover (`IDENTITY_PROVIDER` is `supabase` everywhere), nothing
deployed to production beyond the two additive Supabase migrations (which
only add a new table and a new service-role-only function).
