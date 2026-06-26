import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Session replays (on error only — privacy-preserving)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,

  // Only enable in production/staging
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,

  // Filter noise
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    /ChunkLoadError/,
  ],

  beforeSend(event, hint) {
    // Drop events from browser extensions (noise)
    const error = hint.originalException;
    if (error instanceof Error && error.stack?.includes("chrome-extension://")) {
      return null;
    }
    return event;
  },
});
