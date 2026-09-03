// Security fix (MÉD-17): no security headers were configured anywhere in
// this app — closes clickjacking (X-Frame-Options), MIME-sniffing
// (X-Content-Type-Options), and adds a CSP as defense-in-depth against XSS
// (see the audit's ALTO-03 finding on dangerouslySetInnerHTML with AI
// output — CSP doesn't fix that bug but limits what an injected script can
// do). 'unsafe-inline' is required for Next.js's inline hydration script
// and Tailwind's inline styles; tightening further would need per-request
// nonces, out of scope for this fix.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Next.js sets Cross-Origin-Opener-Policy: same-origin by default, which
  // silently breaks Firebase's signInWithPopup(GoogleAuthProvider): the
  // popup completes the OAuth handshake correctly, but same-origin COOP
  // blocks the opener window from detecting that via window.closed, so
  // Firebase's SDK times out and reports "auth/popup-closed-by-user" even
  // though the user never closed anything. same-origin-allow-popups keeps
  // the cross-origin isolation Next.js wants while allowing that one
  // opener/popup relationship.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // apis.google.com — Firebase's signInWithPopup(GoogleAuthProvider)
      // loads Google's gapi/api.js into the popup to run the OAuth
      // handshake; without this the script load is blocked and Firebase
      // surfaces it only as an opaque "auth/internal-error", not a CSP
      // violation, which is why this one took an actual DevTools Network
      // trace to find.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
      // accounts.google.com — Google's OAuth consent/account-chooser UI,
      // embedded by the popup. *.firebaseapp.com — Firebase Auth's own
      // hidden iframe (authDomain), which the JS SDK uses internally to
      // manage sign-in state across the popup handshake; without it the
      // popup flow fails with an opaque "Framing ... violates ... frame-src"
      // CSP error, not an auth-specific one.
      "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
      // fonts.googleapis.com serves the Inter/Manrope stylesheet
      // ((public) layout's <link>), which in turn references woff2 files
      // hosted on fonts.gstatic.com — without both, the CSP silently
      // blocked the stylesheet itself, so the custom fonts never actually
      // loaded and the site fell back to system fonts with no visible error
      // to a normal visitor (only in devtools/Lighthouse console).
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      // identitytoolkit/securetoken.googleapis.com — Firebase Auth's REST
      // endpoints (sign-in, token refresh), called directly by the
      // `firebase` client SDK. Missing this silently blocked every
      // Firebase auth call client-side with a generic "network-request-
      // failed", while a server-side curl to the same endpoint got a real
      // (and separately investigated) response — the two failures looked
      // identical from the app but had different causes.
      "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // pdfkit (a @react-pdf/renderer dependency, used by inspection-pdf.tsx
  // and contract-signature-pdf.tsx) loads its standard-font .afm/.cjs
  // files at runtime via a dynamic path, not a static import — Vercel's
  // file tracer can't see that reference, so the built serverless bundle
  // omits them and every PDF-rendering route 500s in production with
  // "Cannot find module '.../pdfkit/js/standard-fonts/Helvetica.cjs'"
  // (confirmed live on 2026-09-03 testing the Signature Platform's
  // contract PDF route — the same root cause was already latent for the
  // pre-existing inspection-report PDF routes, not something this feature
  // introduced). Explicitly including the whole package's files fixes it
  // for every current and future @react-pdf/renderer route at once.
  // next@14.x still nests this under `experimental` — it only became a
  // stable top-level key in Next.js 15.
  experimental: {
    // Confirmed live 2026-09-03 (500 in production, reproduced + fixed
    // locally by inspecting the built .nft.json trace manifest): the
    // include path must point at pdfkit's REAL physical location, not the
    // `node_modules/pdfkit` symlink apps/web itself sees — pnpm hoists the
    // actual package store to the monorepo ROOT's node_modules/.pnpm, two
    // directories up from apps/web, and the tracer's glob doesn't follow
    // that symlink on its own. `pdfkit@*` (not a pinned version) so a
    // future pdfkit bump doesn't silently break this again.
    outputFileTracingIncludes: {
      "/api/**/*": ["../../node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/**/*"],
    },
  },
};

export default nextConfig;
