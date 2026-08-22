# Firebase Auth Migration

**ACTIVE IDENTITY PROVIDER: SUPABASE**
**LEGACY IDENTITY PROVIDER: N/A — cutover has not happened**
**DATABASE: SUPABASE POSTGRESQL (unchanged)**
**STORAGE: SUPABASE (unchanged)**
**AUTHORIZATION: SHINÃ IAM / RBAC / ABAC (unchanged)**
**CANONICAL USER ID: SHINÃ (`shina_user_id`)**

Status: **Phase 1 (Firebase Foundation) complete. Phase 2 (App Integration + Demo Users) in progress — real Firebase session cookies, middleware, and the real apps/web login page (Google + both demo accounts) all built and working end-to-end in local dev only. Nothing of this is active in Vercel/production — `IDENTITY_PROVIDER`/`NEXT_PUBLIC_IDENTITY_PROVIDER` are only set in `apps/web/.env.local`, never in Vercel, specifically because apps/mobile hasn't been migrated yet (see "Mobile not migrated yet" below) and would break if the server-side switch flipped in production. Phase 3 not started.**

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

## Real login screen, session cookies, and middleware (spec items 15/16/24) — local dev only

Built and verified end-to-end, **not deployed to Vercel**:

- `apps/web/src/app/api/auth/firebase/session/route.ts` — exchanges a
  Firebase ID token for an httpOnly session cookie
  (`__shina_firebase_session`), via Admin SDK `createSessionCookie()`.
  Mirrors Firebase's own documented Next.js session pattern.
- `apps/web/src/lib/identity.ts` — the cookie factory passed to
  `FirebaseIdentityProvider` now actually reads that cookie (was a `() =>
null` stub through Phase 1).
- `apps/web/src/lib/firebase-session-cookie.ts` — **Edge-safe**
  verification for `middleware.ts` (Next's Edge runtime can't run
  `firebase-admin`, which needs Node's `crypto`). Uses `jose` +
  Google's public keys directly, plus a Supabase lookup
  (`external_identities` → `resolve_shina_authorization_context`) to
  produce the same `SessionClaims` shape `decodeSessionClaims()` already
  produces for Supabase — every existing gate (MFA/subscription/contract)
  in `middleware.ts` works unchanged regardless of which provider is
  active, branching only once at the top on
  `resolveActiveIdentityProviderKind(process.env)`.
- `apps/web/src/components/auth/auth-options.tsx` — real login UI changes,
  gated behind `NEXT_PUBLIC_IDENTITY_PROVIDER === "firebase"` (client
  components can't read the server-only `IDENTITY_PROVIDER`, hence the
  separate public mirror — **never set in Vercel**, see the status line
  above): "Continuar com Google" now uses Firebase's
  `signInWithPopup(GoogleAuthProvider)`; the two demo buttons use a new
  `POST /api/auth/firebase/demo-login` (mints a Firebase custom token
  server-side for `DEMO_TENANT_EMAIL`/`DEMO_CUSTOMER_EMAIL` — the client
  never sees the demo password, same posture as the pre-existing Supabase
  demo-login route). Magic Link and Facebook are hidden (not deleted) when
  `USE_FIREBASE` is true — both still only produce a Supabase session,
  which the backend wouldn't recognize once cut over.

### Four real bugs found and fixed while getting this to actually work

All confirmed live, in a real browser, not guessed at:

1. **CSP `connect-src`** missing `identitytoolkit`/`securetoken.googleapis.com`
   (documented above, Phase 1) — blocked every Firebase Auth call.
2. **Session cookie `secure: true` unconditionally** — silently dropped by
   both real browsers and curl on `http://localhost` (no HTTPS). Fixed:
   `secure: process.env.NODE_ENV === "production"`.
3. **Wrong JWKS endpoint for session-cookie verification.** Session cookies
   are signed by a _different_ key set than ID tokens — neither the
   securetoken JWK endpoint nor its x509 sibling had a matching `kid` for a
   real session cookie (`JWKSNoMatchingKey`), even though Firebase Admin's
   own `verifySessionCookie()` verified the exact same cookie successfully.
   The correct endpoint, confirmed live, is
   `https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys`
   — not documented anywhere obvious, found via targeted search after two
   failed guesses.
4. **CSP `script-src`/`frame-src` + Next.js's default COOP header** all
   blocked `signInWithPopup(GoogleAuthProvider)` in three separate, oddly-
   shaped ways: `script-src` blocked `apis.google.com/js/api.js` (Google's
   popup-flow script) and surfaced only as opaque `auth/internal-error`;
   `frame-src` (added to fix the first issue) then blocked Firebase's own
   internal auth iframe (`https://shinaia-8f787.firebaseapp.com`) framing
   itself; and Next.js's default `Cross-Origin-Opener-Policy: same-origin`
   silently broke the popup→opener `window.closed` signal Firebase's SDK
   polls, surfacing as a false `auth/popup-closed-by-user` even though the
   user completed the flow. Fixed: `script-src` allows `apis.google.com`,
   `frame-src` allows `'self'`, `accounts.google.com`, and
   `*.firebaseapp.com`, and `Cross-Origin-Opener-Policy` is explicitly set
   to `same-origin-allow-popups`.

All four are now in `apps/web/next.config.mjs`, each with an inline comment
explaining what it fixes — a future contributor removing an "unused-
looking" CSP entry should read those first.

### Owner Google sign-in — real account linking needed

The Owner's real Google account (`fabioshinaia@gmail.com`) is a different
Google Identity from `fabio@shinaia.com.br` (their Shinã login, normally
used via Supabase magic link) — signing in with Google via Firebase
creates a **new, distinct** Firebase UID
(`rcHF3c3BJbhQSxdeUR3DLcuk7t53`), unrelated to the email/password Firebase
account created for the Owner Safety Gate test
(`VWsdoQaGAbeEwIWWwZmpCsSFH5t2`). Per spec item 7, an unlinked Firebase UID
correctly resolves to "authenticated but unprovisioned" — confirmed live
(the Owner signed in successfully but had zero tenant/platform access
until linked). Linked manually via `external_identities` after the fact
(same `shina_user_id`, `dea846ea-...`); the next request resolved
`platform_owner` correctly with no need to sign in again, since claims are
resolved fresh on every request rather than cached at session-issue time.

**Not solved, deliberately out of scope**: there is currently no UI/flow
for a user to link a second Firebase identity (e.g., Google) to an
account they first created via password/custom-token — this manual,
one-off `external_identities` upsert isn't a repeatable product flow. A
real "link another sign-in method" feature is Phase-2-adjacent work not
covered by the original spec's item list.

### MFA gate — confirmed working, but blocked on a real, separate migration

The Owner's `tenant_admin` role requires MFA (`MFA_REQUIRED_ROLES`,
`middleware.ts`). With a real Firebase session, `middleware.ts` correctly
resolved `mfa_enrolled: true` and redirected to
`/auth/mfa-challenge?next=/tenant/dashboard` exactly as designed — **this
confirms the whole cookie → middleware → claims chain works correctly**,
including gates that were never touched. The redirect target itself then
failed with `Error: Nenhum fator MFA encontrado`, because
`(public)/auth/mfa-challenge/page.tsx` calls Supabase's native
`supabase.auth.mfa.listFactors()` directly — Supabase's TOTP MFA is a
first-party Supabase Auth feature with no Firebase equivalent reachable
the same way (Firebase has its own, separately-shaped multi-factor API,
`TotpMultiFactorGenerator`, requiring its own enrollment flow).

Per spec item 21 ("Não bloquear migração por MFA... Não implementar
política completa nesta migração se ainda não existir"): **not fixed
now, intentionally**. Migrating MFA enrollment/verification to Firebase's
TOTP API is real, separate feature work, not a config tweak — tracked
here as a known gap blocking a _complete_ end-to-end test for any
MFA-enrolled account, not as something broken by this migration. The gate
itself was left completely untouched and still correctly blocks access,
which is the security-correct outcome to leave in place until Firebase
MFA is actually built.

## Mobile not migrated yet — the actual reason Vercel stays untouched

`apps/mobile` still authenticates entirely via Supabase
(`auth-context.tsx`) and sends Supabase-issued bearer tokens to every
`apps/web` API route it calls. If `IDENTITY_PROVIDER=firebase` were ever
set in Vercel before mobile is migrated, `FirebaseIdentityProvider.
getSessionFromBearerToken()` would reject every one of those tokens
(wrong issuer/signature) — the entire mobile app (tenant staff, customer,
and operator personas alike) would 401 on every API call. This is why
every Firebase env var affecting _behavior_ (`IDENTITY_PROVIDER`,
`NEXT_PUBLIC_IDENTITY_PROVIDER`) is local-only right now — the _config_
values (`NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_ADMIN_*`) are in Vercel
(harmless on their own, since nothing reads them unless the provider is
switched), but the switch itself is not. Migrating mobile is the
explicit next step before any production cutover consideration.

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
