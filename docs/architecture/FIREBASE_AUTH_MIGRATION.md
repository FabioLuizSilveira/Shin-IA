# Firebase Auth Migration

**ACTIVE IDENTITY PROVIDER: SUPABASE**
**LEGACY IDENTITY PROVIDER: N/A — cutover has not happened**
**DATABASE: SUPABASE POSTGRESQL (unchanged)**
**STORAGE: SUPABASE (unchanged)**
**AUTHORIZATION: SHINÃ IAM / RBAC / ABAC (unchanged)**
**CANONICAL USER ID: SHINÃ (`shina_user_id`)**

Status: **Phase 1 (Firebase Foundation) complete. Phase 2 (App Integration + Demo Users) in progress — Owner Safety Gate PASS and all 3 relevant demo accounts provisioned; no production login UI touched yet. Phase 3 not started.**

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

## Two real bugs found and fixed, both now resolved

**Bug 1 — CSP blocked every client-side Firebase Auth call.**
`apps/web/next.config.mjs`'s `connect-src` CSP directive didn't allow
`identitytoolkit.googleapis.com`/`securetoken.googleapis.com`, so any
browser running the real `firebase` client SDK had every Auth request
silently blocked before it left the page (`auth/network-request-failed`,
zero network requests actually sent — confirmed via `read_network_requests`
during the Owner Safety Gate test). Fixed by adding both domains to
`connect-src`. This is the same bug class fixed earlier this session for
Google Fonts on `apps/mkt` — a CSP allowlist missing a legitimate
third-party origin the app actually needs.

**Bug 2 — the original `NEXT_PUBLIC_FIREBASE_API_KEY` was genuinely dead.**
After the CSP fix, both a real browser and the server-side script still got
`400 auth/api-key-not-valid` from Google directly — ruling out CSP,
sandbox, and every Console-visible cause (API enablement, key/app/API
restrictions, correct key value, all confirmed across 4 rounds of live
checks). Created a second, brand-new unrestricted API key in the same
project as an isolation test — it worked immediately, confirming the
original key itself was broken (not the project, not an org policy). The
working key (`AIzaSyBiOwgvKL2w_JScnZNHEsuguiRdipXKoh4`) has replaced the
old one in `apps/web/.env.local`, `apps/mkt/.env.local`, and all Vercel
environments for both apps. The old key was left as-is in Google Cloud
Console (dead, unrestricted-but-non-functional) — safe to delete there
whenever convenient, not urgent since it doesn't work anyway.

## Owner Safety Gate (spec item 23): PASS

Full real round trip, real browser, real project — no mocks:

1. Created the Platform Owner's Firebase account (linked via
   `external_identities`: `firebase` provider, uid
   `VWsdoQaGAbeEwIWWwZmpCsSFH5t2` → existing `shina_user_id`
   `dea846ea-f473-4032-9b01-0d60b21058c0`, the owner's pre-existing
   Supabase auth uid).
2. Signed in from a real browser using the real `firebase` client SDK
   (after the CSP fix) — got a real ID token.
3. Verified that token with Firebase Admin — same call
   `FirebaseIdentityProvider` makes in production.
4. Resolved the canonical identity via `external_identities` +
   `resolve_shina_authorization_context` — got back
   `platform_role: platform_owner`, `tenant_role: tenant_admin`,
   `platform_contract_current: true`, matching the owner's real,
   pre-existing authorization state exactly.

The temporary diagnostic page/route/middleware exemption used for this test
(`/dev-firebase-probe`) were all deleted immediately after — never merged,
never deployed.

## Demo users (spec item 22)

Platform Owner, Tenant Demo, and Customer Demo all have real Firebase
accounts now, linked to their existing `shina_user_id` via
`external_identities` (no new tenant/customer created — reused what already
existed, per spec). Real sign-in confirmed for all three against the fixed
API key:

| Account                                       | Firebase uid                   | Resolved via `resolve_shina_authorization_context`                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform Owner (`fabio@shinaia.com.br`)       | `VWsdoQaGAbeEwIWWwZmpCsSFH5t2` | `platform_role: platform_owner`, `tenant_role: tenant_admin`                                                                                                                                                                                                                                                                  |
| Tenant Demo (`demo.equipe@shinaia.com.br`)    | `pJrJQgAoTKbeINtyEVLK6cHpi8q1` | `tenant_role: fleet_manager`                                                                                                                                                                                                                                                                                                  |
| Customer Demo (`demo.cliente@shinaia.com.br`) | `LwrlDkUXLuhJ8BsjDSFMUUSEt602` | all null — **correct, not a bug**: customers were never tenant staff and never carried `tenant_role`/`platform_role` claims; their real authorization is the RLS-direct `auth.uid()` chain (`rental_customers.auth_user_id`) described in the critical audit finding above, which a Firebase token doesn't satisfy on its own |

Operator Demo not created — no demo operator account exists in the
codebase today, and spec item 22 makes it conditional ("somente se
necessário aos testes").

## What Phase 2 needs from the user before it can start

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
