import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRateLimit, clientIp } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(key, 5, 60_000);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    const key = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true);
    }
    const sixth = checkRateLimit(key, 5, 60_000);
    expect(sixth.allowed).toBe(false);
    expect(sixth.remaining).toBe(0);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps blocking further requests within the same window", () => {
    const key = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    expect(checkRateLimit(key, 5, 60_000).allowed).toBe(false);
    expect(checkRateLimit(key, 5, 60_000).allowed).toBe(false);
  });

  it("resets and allows requests again after the window passes", () => {
    vi.useFakeTimers();
    try {
      const key = `test-${crypto.randomUUID()}`;
      for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 1_000);
      expect(checkRateLimit(key, 5, 1_000).allowed).toBe(false);

      vi.advanceTimersByTime(1_001);

      expect(checkRateLimit(key, 5, 1_000).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${crypto.randomUUID()}`;
    const keyB = `test-b-${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i++) checkRateLimit(keyA, 5, 60_000);
    expect(checkRateLimit(keyA, 5, 60_000).allowed).toBe(false);
    // A different key's budget must be untouched by A's usage.
    expect(checkRateLimit(keyB, 5, 60_000).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the first entry of x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" },
    });
    expect(clientIp(req)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "203.0.113.9" },
    });
    expect(clientIp(req)).toBe("203.0.113.9");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    const req = new Request("https://example.com");
    expect(clientIp(req)).toBe("unknown");
  });
});
