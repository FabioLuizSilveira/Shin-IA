/**
 * Host-based routing E2E tests.
 *
 * These tests verify that the middleware correctly routes requests based on
 * the Host header. They run against a local Next.js dev/preview server and
 * simulate different domains via the Host header using Playwright's
 * `extraHTTPHeaders` option.
 *
 * Prerequisites:
 *   PLAYWRIGHT_BASE_URL must be set to the running server, e.g. http://localhost:3000
 *   (set in playwright.config.ts or via env)
 *
 * Domains under test:
 *   root  → shinaia.com.br / www.shinaia.com.br
 *   app   → app.shinaia.com.br
 *   local → localhost (default Playwright base URL, no Host override needed)
 */

import { test, expect } from "@playwright/test";

const ROOT_HOST = "shinaia.com.br";
const WWW_HOST = "www.shinaia.com.br";
const APP_HOST = "app.shinaia.com.br";

// Helper: make a raw request with a custom Host header and return the response.
async function fetchWithHost(
  page: import("@playwright/test").Page,
  path: string,
  host: string,
): Promise<{ status: number; location: string | null }> {
  const response = await page.request.get(path, {
    headers: { host },
    maxRedirects: 0,
  });
  return {
    status: response.status(),
    location: response.headers()["location"] ?? null,
  };
}

// ── Root domain ────────────────────────────────────────────────────────────────

test.describe("root domain (shinaia.com.br)", () => {
  test("/ returns 200 (landing page)", async ({ page }) => {
    const { status } = await fetchWithHost(page, "/", ROOT_HOST);
    expect(status).toBe(200);
  });

  test("/pricing returns 200", async ({ page }) => {
    const { status } = await fetchWithHost(page, "/pricing", ROOT_HOST);
    expect(status).toBe(200);
  });

  test("/contact returns 200", async ({ page }) => {
    const { status } = await fetchWithHost(page, "/contact", ROOT_HOST);
    expect(status).toBe(200);
  });

  test("/tenant/dashboard redirects to app subdomain", async ({ page }) => {
    const { status, location } = await fetchWithHost(page, "/tenant/dashboard", ROOT_HOST);
    expect(status).toBe(308);
    expect(location).toContain("/tenant/dashboard");
    expect(location).toMatch(/app\./);
  });

  test("/platform/settings redirects to app subdomain", async ({ page }) => {
    const { status, location } = await fetchWithHost(page, "/platform/settings", ROOT_HOST);
    expect(status).toBe(308);
    expect(location).toContain("app.");
  });

  test("/login redirects to app subdomain", async ({ page }) => {
    const { status, location } = await fetchWithHost(page, "/login", ROOT_HOST);
    expect(status).toBe(308);
    expect(location).toContain("app.");
  });
});

// ── www domain ────────────────────────────────────────────────────────────────

test.describe("www domain (www.shinaia.com.br)", () => {
  test("/ returns 200 (landing page)", async ({ page }) => {
    const { status } = await fetchWithHost(page, "/", WWW_HOST);
    expect(status).toBe(200);
  });

  test("/tenant/dashboard redirects to app subdomain", async ({ page }) => {
    const { status, location } = await fetchWithHost(page, "/tenant/dashboard", WWW_HOST);
    expect(status).toBe(308);
    expect(location).toContain("app.");
  });
});

// ── App subdomain ─────────────────────────────────────────────────────────────

test.describe("app subdomain (app.shinaia.com.br)", () => {
  test("/ redirects to /login when unauthenticated", async ({ page }) => {
    const { status, location } = await fetchWithHost(page, "/", APP_HOST);
    // Middleware redirects "/" → "/login" (unauthenticated)
    expect([302, 307]).toContain(status);
    expect(location).toContain("/login");
  });

  test("/login returns 200", async ({ page }) => {
    const { status } = await fetchWithHost(page, "/login", APP_HOST);
    expect(status).toBe(200);
  });

  test("/tenant/dashboard redirects to /login when unauthenticated", async ({ page }) => {
    const { status, location } = await fetchWithHost(page, "/tenant/dashboard", APP_HOST);
    expect([302, 307]).toContain(status);
    expect(location).toContain("/login");
  });
});

// ── Path preservation on redirect ─────────────────────────────────────────────

test("root domain preserves path + query on redirect to app", async ({ page }) => {
  const { location } = await fetchWithHost(page, "/tenant/operations?status=active", ROOT_HOST);
  expect(location).toContain("/tenant/operations");
  expect(location).toContain("status=active");
});
