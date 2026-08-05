// Security fix (ALTO-08) — closes the "zero rate limiting anywhere in the
// stack" gap from the security audit. This is an in-memory, per-instance
// fixed-window limiter: the audit's own recommendation was to start from
// the InMemoryRateLimiter already sitting unused in packages/api-platform
// (a different, incompatible request shape — this is a drop-in equivalent
// for NextRequest/Edge middleware) and note that a real production
// deployment across multiple regions/instances needs a shared store
// (Upstash Redis is the standard pairing for Next.js on Vercel) since this
// Map resets per cold start and isn't shared across instances. Still a real
// improvement over the previous "none at all" — closes brute-force/credential
// stuffing against login/OAuth/MFA and blunt scraping/DoS against the API.

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

// Periodic cleanup so the Map doesn't grow unbounded for the lifetime of a
// warm server instance.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();
function cleanupIfDue(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, window] of windows) {
    if (now > window.resetAt) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  cleanupIfDue(now);

  let window = windows.get(key);
  if (!window || now > window.resetAt) {
    window = { count: 0, resetAt: now + windowMs };
    windows.set(key, window);
  }
  window.count++;

  const allowed = window.count <= maxRequests;
  return {
    allowed,
    remaining: Math.max(0, maxRequests - window.count),
    retryAfterSeconds: Math.ceil((window.resetAt - now) / 1000),
  };
}

/** Best-effort client IP from the headers a proxy (Vercel) sets — never trust
 * this for anything beyond rate-limit bucketing. */
export function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
