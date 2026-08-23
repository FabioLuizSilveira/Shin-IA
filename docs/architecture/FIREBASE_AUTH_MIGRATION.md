# Firebase Auth Migration

**ACTIVE IDENTITY PROVIDER: SUPABASE**
**LEGACY IDENTITY PROVIDER: N/A — cutover has not happened**
**DATABASE: SUPABASE POSTGRESQL (unchanged)**
**STORAGE: SUPABASE (unchanged)**
**AUTHORIZATION: SHINÃ IAM / RBAC / ABAC (unchanged)**
**CANONICAL USER ID: SHINÃ (`shina_user_id`)**

Status: **Phase 1 complete. Phase 2 in progress — apps/web's real login (Google + both demo accounts) built and verified end-to-end in local dev; the mobile-API backend gap (`requireMobileContext()` bypassing the identity provider) found and fixed; apps/mobile's client-side code written and gated behind `EXPO_PUBLIC_IDENTITY_PROVIDER`, but NOT device-tested (see "apps/mobile — built, not device-verified" below). Shinã-native TOTP, Firebase Email Link, and the Customer Portal RLS→API migration all built and live-verified against the hosted DB. `IDENTITY_PROVIDER`/`NEXT_PUBLIC_IDENTITY_PROVIDER=firebase` are now set in Vercel **Preview only** (never Production) and a real Preview deployment of apps/web has been built and smoke-tested — see "Web Preview real" below. A formal Security Gate pass (forgery/negative tests) has also run clean — see "Security Gate" below. Nothing of this is active in Vercel Production or any EAS build profile — every Firebase-provider env var stays out of Production until mobile is actually confirmed working on a real device. Phase 3 not started.**

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

## Backend gap found and fixed: `requireMobileContext()` bypassed the identity provider

Scoping the mobile migration surfaced a second, separate backend bug: unlike
`requireTenantScope()` (already provider-aware since Phase 1),
`apps/web/src/lib/mobile-context.ts`'s `requireMobileContext()` — used by
~20 `/api/mobile/*` routes the mobile app calls — called
`db.auth.getUser(bearerToken)` directly. Migrating mobile's client alone
would have hit a wall here regardless. Fixed the same way
`requireTenantScope()` already was: token verification now goes through
`identityProvider`, `resolveMobileContext()`'s pure tenant/customer/
operator/unprovisioned resolution logic is untouched. Verified live —
`/api/mobile/bootstrap` resolves correctly through a real Firebase ID
token.

## apps/mobile — built, not device-verified

Client-side code written, gated behind `EXPO_PUBLIC_IDENTITY_PROVIDER`
(mirrors `NEXT_PUBLIC_IDENTITY_PROVIDER`) — every consumer of
`useAuth().session` across the app only ever checks truthiness (confirmed
by reading every call site), never a Supabase-specific field, so swapping
the underlying object for a Firebase `User` was a safe, drop-in change:

- `apps/mobile/src/lib/firebase.ts` — client init via `initializeAuth` +
  `getReactNativePersistence(AsyncStorage)` (AsyncStorage was already a
  dependency). Hit a known upstream TypeScript gap
  (firebase-js-sdk#9316/#7615): `getReactNativePersistence` exists at
  runtime under `"firebase/auth"` — Metro's bundler-time module resolution
  picks the react-native-specific build that has it — but `tsc`'s plain
  Node resolution lands on the generic build's `.d.ts`, which doesn't
  declare it. Fixed with a `@ts-expect-error` and a comment citing the
  upstream issue, not by disabling the check more broadly.
- `apps/mobile/src/lib/auth-context.tsx` — two full provider
  implementations (`useFirebaseAuthProvider`/`useSupabaseAuthProvider`),
  selected once by the env var, not branched inline throughout the file.
- `apps/mobile/src/lib/shinaia-api.ts` — `authHeader()` sends a Firebase ID
  token instead of the Supabase access token when the flag is set; a new
  `firebaseDemoLogin()` calls the same `/api/auth/firebase/demo-login`
  route apps/web's login screen uses (server-minted custom token, demo
  password never touches the client).
- `apps/mobile/src/screens/LoginScreen.tsx` — demo buttons fully rewired
  (custom-token sign-in, same pattern as web); Google via
  `expo-auth-session`'s `useIdTokenAuthRequest` +
  `signInWithCredential(GoogleAuthProvider.credential(idToken))`; Apple via
  the existing native `expo-apple-authentication` credential +
  `signInWithCredential(OAuthProvider('apple.com').credential(...))`; Magic
  Link hidden when the flag is set (same reasoning as apps/web — it would
  only produce a session the Firebase-cut-over backend doesn't recognize).

**Cannot verify without a real device/simulator, which this environment
doesn't have** — explicitly out of scope for this session, not skipped by
oversight:

- Google sign-in needs its own OAuth 2.0 Client IDs per platform
  (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`/`_ANDROID_CLIENT_ID`/`_WEB_CLIENT_ID`,
  separate from the Firebase project's default web client) —
  `MANUAL CONFIGURATION REQUIRED`, unset placeholders in `.env.example`.
  Until set, the button shows an explanatory alert instead of crashing.
- Apple sign-in via Firebase needs the same Apple Developer Services ID/
  Key/Team ID configuration the pre-existing Supabase path already
  required, plus Apple enabled as a provider in Firebase Console
  specifically (separate from Supabase's own Apple provider config).
- AsyncStorage-backed session persistence across app restarts, and the
  full demo-login round trip through the actual Expo app — the equivalent
  flow was verified via curl against the real backend (see above), but
  never through the RN app's own network/storage stack.

## Real-device verification (Expo Go, Android) — update

EAS Build (both "preview" and "development" profiles) is blocked this
month by the connected Expo account's free-tier Android build quota
(resets 2026-09-01) — tested via Expo Go instead: Metro dev server on the
LAN, phone on the same Wi-Fi, `EXPO_PUBLIC_SHINAIA_API_URL` pointed at the
dev machine's LAN IP so `/api/mobile/*` calls hit the real local backend
running `IDENTITY_PROVIDER=firebase`.

**Three more real bugs found and fixed, all confirmed live on a real
Android device:**

1. **`expo-notifications` crashed the entire app in Expo Go.** Unrelated to
   this migration — Expo Go dropped remote push support in SDK 53, and the
   package throws at module-evaluation time when imported there, not just
   when a push function is called. `push-registration.ts`'s top-level
   `import * as Notifications from "expo-notifications"` crashed the app
   before login was even reachable. Fixed: the import is now a dynamic
   `await import("expo-notifications")` inside the function, guarded by an
   `executionEnvironment === StoreClient` (Expo Go) check that short-
   circuits first — a real build still gets full push functionality.
2. **`Google.useIdTokenAuthRequest` threw during render, not just returned
   a null request, when the platform's client ID was unset.** The original
   code (and its own comment) assumed the hook degraded gracefully; it
   doesn't — confirmed live, it crashes the whole `LoginScreen`. Fixed:
   placeholder non-empty strings are passed to keep the hook from
   throwing, and a separate `isGoogleConfigured` check (not the hook's
   return value) gates the button/handler.
3. **`/api/auth/firebase/demo-login` broke the mobile app's response
   parsing.** The route returned a bare `{ customToken }`, but
   `shinaia-api.ts`'s `request()` helper unconditionally unwraps every
   response's `.data` field (matching `/api/mobile/demo-login`'s existing
   envelope) — confirmed live (`Cannot read property 'customToken' of
undefined`). Fixed by wrapping the route's response in `{ data: {
customToken } }`, and updating apps/web's `AuthOptions.tsx` (which reads
   the raw body directly, not through that helper) to match the same
   shape.

**A fourth backend gap found the same way**: `bootstrap.ts` — a separate
file from `shinaia-api.ts`, with its own direct
`supabase.auth.getSession()` call to get the bearer token for
`/api/mobile/bootstrap` — bypassed the `EXPO_PUBLIC_IDENTITY_PROVIDER`
branch entirely, throwing `"No active session"` immediately after a
successful Firebase sign-in. Fixed the same way as `shinaia-api.ts`'s
`authHeader()`.

**Confirmed working, real device, real backend**: Tenant Demo
("Ver como Equipe") — full sign-in → session → bootstrap → real tenant
data displayed. Google — correctly shows "indisponível" (not configured,
not crashed) per the guard above. Customer Demo ("Ver como Cliente") —
sign-in and bootstrap succeed, but the rentals screen shows no data —
**this is the pre-existing, already-documented "critical audit finding"
above, not a new bug**: `apps/mobile/src/lib/rentals.ts` queries
`rental_service_requests`/etc. directly via `supabase.from(...)`, relying
on RLS + a live Supabase session's `auth.uid()`, which a Firebase-only
session doesn't have. Confirmed live, matching the finding exactly.

## Google Sign-In in Expo Go: structurally dead-ended, not a config gap

Tried to close the "MANUAL CONFIGURATION REQUIRED" Google gap above using
the Firebase project's auto-created Web OAuth client
(`539673049609-0l7f5glfhc93qss1213m1ebcu670nluh.apps.googleusercontent.com`,
found via Google Cloud Console → Credentials → "Web client (auto created
by Google Service)"). Result, confirmed live on the real device: Google's
own generic `400. This is an error` page.

Root cause, confirmed by logging the actual request: `expo-auth-session`'s
Google provider redirects to `exp://192.168.1.194:8081` inside Expo Go —
Expo's old `auth.expo.io` proxy service, which used to bridge that to a
registrable `https://` redirect URI, is discontinued. Google's OAuth
policy rejects any non-`http(s)` redirect URI for a "Web application"
type client outright, unconditionally — no amount of correct
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` configuration changes that. This isn't
fixable from this codebase or from Google Cloud Console settings; it's
current Expo Go behavior colliding with current Google OAuth policy.

`isGoogleConfigured` (`LoginScreen.tsx`) now explicitly treats Expo Go as
never-configured, even when a web client ID is present, so the button
shows the "indisponível" alert instead of a 400 dead end. Real Google
Sign-In testing needs an actual dev-client/standalone build — an
Android/iOS-type OAuth client, verified by package name + SHA-1
fingerprint / bundle ID, no redirect URI involved at all — which is
exactly what's still blocked on EAS build quota.

## Mobile client is now real-device-verified for the tenant-staff path; production cutover is still blocked on the customer RLS gap and manual Google/Apple config

`IDENTITY_PROVIDER=firebase`/`NEXT_PUBLIC_IDENTITY_PROVIDER=firebase`/
`EXPO_PUBLIC_IDENTITY_PROVIDER=firebase` all remain local-only — none are
set in Vercel or any EAS build profile. Setting the web ones in Vercel
before the mobile app above is confirmed working on a real device would
401 every `/api/mobile/*` call from whatever mobile builds are already
installed, even though the backend-side bug is now fixed — the risk left
is purely "does the untested client code actually work," not "is the
backend ready."

## Shinã-native TOTP (decision: not Supabase's or Firebase's built-in MFA)

Decision (2026-08-22, user-directed): **login/signup never requires MFA
going forward.** MFA becomes a step-up mechanism for specific sensitive
actions, not a login gate. Two real reasons this ruled out both built-in
options:

- **Supabase's own MFA** (`supabase.auth.mfa.*`) only exists for a
  Supabase session — meaningless once login is Firebase.
- **Firebase's own MFA** (`TotpMultiFactorGenerator`) resolves _during_
  sign-in via an in-memory `resolver` object thrown as part of a failed
  sign-in attempt — there's no session yet to redirect away from and back
  to the way Supabase's `/auth/mfa-challenge` page does. Every sign-in
  entry point (Google, demo, future email-link) would need its own inline
  challenge UI, and the resolver can't survive a page navigation. Ruled
  out before writing any code, once this became clear.

Built instead: a small provider-independent TOTP engine (RFC 6238), owned
entirely by Shinã, keyed by the canonical `shina_user_id` — no
Supabase/Firebase MFA API involved at all.

- `apps/web/src/lib/auth/totp.ts` — pure Web Crypto (no new dependency,
  same convention as `lib/auth/mfa-cookie.ts`'s HMAC). Secret generation,
  `otpauth://` URI for QR codes, and code verification with a ±1 time-step
  tolerance window. **Verified against the official RFC 6238 Appendix B
  test vector** (T=59s, the shared test secret, SHA-1) — not just
  internally consistent, actually produces the same code any real
  authenticator app (Google Authenticator, Authy, etc.) would.
- `apps/web/src/lib/auth/mfa-crypto.ts` — AES-256-GCM at rest for the
  secret, same pattern as `apps/mkt/src/lib/crypto.ts`'s BYOK key
  encryption, separate key (`SHINA_MFA_ENCRYPTION_KEY`) so the two rotate
  independently.
- `shina_totp_credentials` (new table,
  `supabase/migrations/20260097000000_shina_native_totp.sql`) — one row
  per `shina_user_id`, `pending` until a real code is confirmed, then
  `active`. Distinct from the older `mfa_enrollments` table (Supabase
  Auth's own factor bookkeeping), which stays untouched as historical
  record for existing Supabase-enrolled users.
- Three routes: `POST /api/auth/mfa/native/enroll/start` (generate +
  store pending), `POST /api/auth/mfa/native/enroll/confirm` (verify a
  real code, flip to active), `POST /api/auth/mfa/native/challenge`
  (verify a code against an active credential, issue a signed, short-lived
  — 5 minute — step-up cookie via `lib/auth/stepup-cookie.ts`, same HMAC
  scheme as the existing `mfa_verified` cookie, separate name/secret).
- `apps/web/src/lib/auth/require-step-up.ts` — `hasValidStepUp(shinaUserId)`,
  the helper a future sensitive route calls to check for that cookie.

**Verified live against the hosted database, real cryptography, no
mocks**: full round trip (enroll → real computed code → confirm → active)
using the Tenant Demo Firebase session; re-confirming an already-active
credential correctly rejected (409, not silently accepted); step-up
challenge with a real code issued the cookie; a wrong code on both confirm
and challenge correctly rejected (401); no session at all correctly
rejected (401) on every route.

**Explicitly not done this round — foundation only, per direct user
decision**: no sensitive action is gated behind `hasValidStepUp()` yet
(candidates like impersonation start were discussed and deliberately
deferred, not forgotten), and no enrollment/challenge UI page exists yet
(the three API routes are ready for one, but building UI ahead of a
concrete "which action needs this" decision risked building the wrong
shape). `MFA_REQUIRED_ROLES` in `middleware.ts` still gates every page for
Supabase-authenticated `tenant_owner`/`tenant_admin` sessions, unchanged —
that's the login-blocking Supabase MFA gate, a separate thing from this
step-up mechanism, and out of scope for removal until Magic Link/Email
Link (this roadmap's next step) is settled.

## Firebase Email Link ("Magic Link") — built and verified live

Firebase's passwordless email-link sign-in (`sendSignInLinkToEmail`/
`signInWithEmailLink`), replacing Supabase's `signInWithOtp` for the
Firebase-cut-over path. Same anti-enumeration posture as before: Firebase
has no `shouldCreateUser: false` equivalent, so a new server route checks
first.

- `apps/web/src/app/api/auth/firebase/magic-link/precheck/route.ts` —
  `{allowed: boolean}` via `getUserByEmail`. The client only actually calls
  `sendSignInLinkToEmail` when `allowed`; the UI shows "link enviado"
  either way, so a failed precheck doesn't leak which emails have
  accounts.
- `apps/web/src/app/(public)/auth/magic-link-callback/page.tsx` — new,
  dedicated page (not a branch inside the existing `/auth/callback`, which
  is Supabase's own PKCE exchange — kept fully separate so neither flow's
  query-string/fragment parsing can interfere with the other's). Handles
  the case where the link is opened on a different device than the one
  that requested it (email not in this browser's `localStorage` — prompts
  to re-confirm it, Firebase's documented pattern).
- `apps/web/src/lib/firebase-session.ts` — `establishFirebaseSession()`
  extracted out of `AuthOptions.tsx` into a shared function, now used by
  every Firebase entry point (Google, demo, magic link) instead of being
  duplicated.
- Magic Link is now shown (not hidden) in `AuthOptions.tsx` when
  `USE_FIREBASE` — it has a real Firebase-backed implementation now.
  Facebook stays hidden (still Supabase-only, no migration planned yet).

**Verified live, real cryptographic round trip, no mocks**: precheck
correctly returns `allowed: true` for the Owner's real email and `false`
for a nonexistent one; generated a real sign-in link via Firebase Admin,
completed sign-in through the same `accounts:signInWithEmailLink` REST
call the client SDK uses, established a real session cookie, and resolved
real tenant data through `/api/mobile/bootstrap` — the full chain, not
just the link-generation step.

## Customer Portal → real API (the "critical audit finding" above, closed)

The gap flagged at the very top of this document — `rentals-portal.ts`
(web) and `rentals.ts` (mobile) querying Supabase directly via RLS, which
a Firebase session can't satisfy — is now fixed for both apps, sharing
one set of backend routes.

- New routes under `apps/web/src/app/api/mobile/customer/`: `contracts`
  (GET), `contracts/[id]/service-requests` (GET/POST),
  `contracts/[id]/snapshot` (GET, combines the old separate snapshot +
  data-processing-legal-basis queries), `invoices` (GET),
  `upgrade-options` (GET), `me` (GET — trivial now, `requireMobileContext()`
  already resolved `customerId`), and a new `GET` added to the existing
  `reservations` route (the `POST` there already existed). All go through
  `requireMobileContext()` — already Firebase-aware from the earlier
  backend-gap fix — so both the web cookie session and the mobile bearer
  token work identically; verified live against both transports, not
  assumed.
- Every scoping join mirrors the RLS policy it replaces exactly (read from
  the actual migrations, not guessed): `contracts.organization_id`,
  `invoices` via `billing_accounts.organization_id`,
  `rental_service_requests.rental_customer_id`, all checked against
  `context.organizations`/`context.customerId` from the verified session —
  never from anything the client sends. A forged `tenantId` on
  `upgrade-options` and a forged `contractId` on `service-requests` both
  confirmed blocked live (empty result / 404), not silently trusted.
- `apps/web/src/lib/rentals-portal.ts` and `apps/mobile/src/lib/rentals.ts`
  keep every exported function's original signature — call these new
  routes internally instead of Supabase directly. Only one real caller
  change was needed: `[id]/contract/page.tsx` was passing
  `rental.snapshot_id` to `fetchContractSnapshot()`, which the new route
  needs to be a `contractId` instead (ownership can only be verified
  through the contract's `organization_id`) — fixed to pass `rental.id`.
- **Found and fixed a real, pre-existing bug in the old code**, incidental
  to this migration: `tenant_contract_requirements` never had an RLS
  policy granting customers `select` access at all — the old
  `fetchDataProcessingLegalBasis()` would have always silently returned
  `null` for customers even under Supabase. The new route uses the
  service-role client (already identity-verified by that point), so this
  now actually returns real data.

**Verified live against the hosted database, real Firebase session, no
mocks**: full read set (contracts, invoices, reservations, service
requests, upgrade options) returning real data for the Customer Demo
account — the exact scenario that showed an empty portal earlier this
session, now fixed; a real service request created and persisted; two
forgery attempts (cross-tenant `upgrade-options`, cross-contract
`service-requests` POST) both correctly rejected; unauthenticated access
correctly 401'd; the same read confirmed again over a raw bearer token
(no cookie at all) to prove the mobile transport path specifically, not
just the web cookie path.

## What Phase 2 needs from the user before it can start

- Apple sign-in shows as enabled in Firebase Console already, but per spec
  items 19/20, actually exercising it also needs an Apple Developer Service
  ID/Key/Team ID and a registered redirect — not yet confirmed configured.
  Facebook is not yet enabled at all.

## Web Preview real

Following the roadmap's "Web Preview real" step: `IDENTITY_PROVIDER`/
`NEXT_PUBLIC_IDENTITY_PROVIDER=firebase` were added to Vercel **Preview**
only (confirmed via `vercel env ls production | grep IDENTITY_PROVIDER` →
empty), and `apps/web` was deployed to a real Preview URL from the repo
root (`vercel --yes`).

- **Vercel CLI monorepo double-nesting bug**: running `vercel` from inside
  `apps/web` fails with `The provided path "...\apps\web\apps\web" does not
exist" regardless of `.vercel/repo.json`registration. Root cause: the
project's`rootDirectory`setting is already`apps/web`, so running from
inside that directory doubles the path. Fixed by deploying from the repo
root instead (where `.vercel/project.json`is linked to`shin-ia-le1a`) —
  not by any repo.json change.
- **Vercel Deployment Protection** (`ssoProtection.deploymentType:
"all_except_custom_domains"`) gated every `*.vercel.app` URL behind a
  Vercel login, blocking automated browser testing. Disabled via `vercel
project protection disable shin-ia-le1a --sso` — safe because it only
  affects `*.vercel.app` URLs; the production custom domain
  (`app.shinaia.com.br`) was never covered by it either way.
- **Found and fixed a real bug**: `middleware.ts`'s `getHostType()`
  classified any hostname other than exactly `app.${ROOT_DOMAIN}` as the
  root marketing domain — including a Preview deployment's own random
  `*.vercel.app` hostname. Any non-marketing path (e.g. `/login`)
  308-redirected straight to production's real `app.shinaia.com.br`,
  making it structurally impossible to test a Preview deployment's own
  build (including its own `IDENTITY_PROVIDER`). Fixed by classifying a
  `*.vercel.app` hostname as `"app"` when `process.env.VERCEL_ENV ===
"preview"` — never true in Production, so production routing is
  unaffected.
- **Live-verified on the real Preview URL** after the fix: `/login` no
  longer redirects off the preview domain; the Google button correctly
  triggers Firebase's `signInWithPopup` flow with no CSP/COOP errors
  (confirming the earlier Phase-1 CSP/COOP fixes hold on real
  infrastructure, not just local dev) — full completion wasn't possible
  because the automated browser's own popup blocker intervenes
  (`auth/popup-blocked`), a tooling limitation, not an app bug. Demo login
  surfaced a real gap (`DEMO_TENANT_EMAIL`/`DEMO_CUSTOMER_EMAIL` were never
  added to Vercel Preview) — left unfixed by explicit user choice (declined
  adding those env vars) rather than tested further. Magic Link was not
  exercised on Preview by explicit user choice (it sends a real email).

## Security Gate

A focused forgery/negative-test pass, run against the local dev server
(all the same code Preview/Production run) plus a direct hosted-DB check,
covering gaps not yet exercised live in earlier phases. All checks passed:

- `POST /api/auth/mfa/native/challenge` and `.../enroll/start` with no
  session → `401`, never `200`/`500`.
- `POST /api/auth/firebase/session` with a forged `idToken` → rejected,
  no session cookie set.
- `GET /api/mobile/customer/{me,contracts,invoices,reservations}` with no
  auth at all → `401` (no default/fallback path leaks another tenant's
  data).
- `POST /api/auth/firebase/magic-link/precheck` with a malformed email →
  a clean `4xx`, never a `500` that could leak internal state.
- A well-formed-looking but forged `__shina_firebase_session` cookie
  (valid JWT _shape_, invalid signature) → treated as fully
  unauthenticated by `verifyFirebaseSessionCookie`, not just by a later
  authorization check.
- Re-confirmed directly against the hosted Supabase REST API using the
  **anon key** (no session at all): `resolve_shina_authorization_context`
  still returns `42501 permission denied` — the `PUBLIC` grant bug fixed
  earlier in this migration stayed fixed.
- Re-confirmed `IDENTITY_PROVIDER` is still absent from Vercel Production.

## What was explicitly NOT done (Phase 1 scope)

Per spec: no Firestore/Realtime Database/Firebase Storage installed, no
login UI touched, no demo users created, `custom_access_token_hook`
untouched, RLS untouched, IAM untouched, no data/user migration, no
provider cutover (`IDENTITY_PROVIDER` is `supabase` everywhere), nothing
deployed to production beyond the two additive Supabase migrations (which
only add a new table and a new service-role-only function).
