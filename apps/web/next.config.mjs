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
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // fonts.googleapis.com serves the Inter/Manrope stylesheet
      // ((public) layout's <link>), which in turn references woff2 files
      // hosted on fonts.gstatic.com — without both, the CSP silently
      // blocked the stylesheet itself, so the custom fonts never actually
      // loaded and the site fell back to system fonts with no visible error
      // to a normal visitor (only in devtools/Lighthouse console).
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com",
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
};

export default nextConfig;
