// Lighthouse CI configuration
// Run: npx lhci autorun
// CI: integrated in GitHub Actions workflow

module.exports = {
  ci: {
    collect: {
      // Start the Next.js server before running audits
      startServerCommand: "pnpm --filter @shina/tenant-web start",
      startServerReadyPattern: "Ready on",
      startServerReadyTimeout: 60000,
      url: [
        "http://localhost:3001/login",
        "http://localhost:3001/dashboard",
      ],
      numberOfRuns: 3,
    },
    assert: {
      // Core Web Vitals thresholds (M6 targets)
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 4000 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
