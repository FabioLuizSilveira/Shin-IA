import { test, expect } from "@playwright/test";

/**
 * E2E: Dashboard smoke test
 * Verifies the main dashboard loads with key widgets.
 */
test.describe("Dashboard", () => {
  test("loads dashboard with key metrics", async ({ page }) => {
    await page.goto("/dashboard");

    // Title visible
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    // KPI cards render (at least one stat card)
    await expect(page.locator("[id^='stat-card']").first()).toBeVisible({ timeout: 8000 });
  });

  test("navigation links work", async ({ page }) => {
    await page.goto("/dashboard");

    // Click Operations in sidebar
    await page.getByRole("link", { name: /operações/i }).click();
    await expect(page).toHaveURL(/\/operations/);

    // Click Fleet Map
    await page.getByRole("link", { name: /mapa da frota/i }).click();
    await expect(page).toHaveURL(/\/map/);
  });
});
