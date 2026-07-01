import { describe, it, expect } from "vitest";

// Helper functions extracted from middleware for unit-testing
// (mirrors the logic in middleware.ts without importing Next.js server APIs)

const ROOT_DOMAIN = "shinaia.com.br";

type HostType = "root" | "app" | "local";

function getHostType(hostname: string): HostType {
  const bare = hostname.split(":")[0];
  if (bare === "localhost" || bare === "127.0.0.1") return "local";
  if (bare === `app.${ROOT_DOMAIN}` || bare === "app.localhost") return "app";
  return "root";
}

const SITE_PATHS = ["/", "/pricing", "/contact", "/about", "/demo"];

function isSitePath(pathname: string): boolean {
  return SITE_PATHS.some((p) => {
    if (p === "/") return pathname === "/";
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

const APP_PUBLIC_PATHS = ["/login", "/auth", "/onboarding", "/api/onboarding", "/api/auth"];

function isAppPublicPath(pathname: string): boolean {
  return APP_PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

// ── appUrl helper ─────────────────────────────────────────────────────────────

function appUrl(path: string, appUrlEnv = ""): string {
  if (!appUrlEnv) return path;
  return `${appUrlEnv}${path}`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getHostType", () => {
  it("classifies localhost as local", () => {
    expect(getHostType("localhost")).toBe("local");
    expect(getHostType("localhost:3000")).toBe("local");
    expect(getHostType("127.0.0.1")).toBe("local");
    expect(getHostType("127.0.0.1:3000")).toBe("local");
  });

  it("classifies app.shinaia.com.br as app", () => {
    expect(getHostType("app.shinaia.com.br")).toBe("app");
  });

  it("classifies app.localhost as app", () => {
    expect(getHostType("app.localhost")).toBe("app");
  });

  it("classifies root domain as root", () => {
    expect(getHostType("shinaia.com.br")).toBe("root");
    expect(getHostType("www.shinaia.com.br")).toBe("root");
  });
});

describe("isSitePath", () => {
  it("allows landing paths", () => {
    expect(isSitePath("/")).toBe(true);
    expect(isSitePath("/pricing")).toBe(true);
    expect(isSitePath("/contact")).toBe(true);
    expect(isSitePath("/about")).toBe(true);
    expect(isSitePath("/demo")).toBe(true);
    expect(isSitePath("/pricing/")).toBe(true);
  });

  it("blocks app paths", () => {
    expect(isSitePath("/login")).toBe(false);
    expect(isSitePath("/tenant/dashboard")).toBe(false);
    expect(isSitePath("/platform/settings")).toBe(false);
    expect(isSitePath("/studio")).toBe(false);
    expect(isSitePath("/marketplace")).toBe(false);
    expect(isSitePath("/customer/contracts")).toBe(false);
    expect(isSitePath("/operator/tasks")).toBe(false);
    expect(isSitePath("/dashboard")).toBe(false);
  });

  it("does not over-match /pricing prefix in /pricingxyz", () => {
    // '/pricingxyz' is NOT '/pricing' and does NOT start with '/pricing/'
    expect(isSitePath("/pricingxyz")).toBe(false);
  });
});

describe("isAppPublicPath", () => {
  it("marks auth paths as public in app subdomain", () => {
    expect(isAppPublicPath("/login")).toBe(true);
    expect(isAppPublicPath("/auth/callback")).toBe(true);
    expect(isAppPublicPath("/auth/mfa-setup")).toBe(true);
    expect(isAppPublicPath("/onboarding")).toBe(true);
    expect(isAppPublicPath("/api/auth/refresh")).toBe(true);
    expect(isAppPublicPath("/api/onboarding/complete")).toBe(true);
  });

  it("does not mark platform routes as public", () => {
    expect(isAppPublicPath("/tenant/dashboard")).toBe(false);
    expect(isAppPublicPath("/platform/billing")).toBe(false);
    expect(isAppPublicPath("/api/metrics")).toBe(false);
  });
});

describe("appUrl", () => {
  it("returns relative path when APP_URL is not set (local dev)", () => {
    expect(appUrl("/login", "")).toBe("/login");
    expect(appUrl("/tenant/dashboard", "")).toBe("/tenant/dashboard");
  });

  it("returns absolute URL when APP_URL is set", () => {
    const base = "https://app.shinaia.com.br";
    expect(appUrl("/login", base)).toBe("https://app.shinaia.com.br/login");
    expect(appUrl("/tenant/dashboard", base)).toBe("https://app.shinaia.com.br/tenant/dashboard");
  });
});
