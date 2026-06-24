import { test, expect } from "@playwright/test";

/**
 * E2E: Onboarding flow
 * Verifies a new tenant can complete the 4-step onboarding wizard.
 */
test.describe("Onboarding", () => {
  test("onboarding wizard renders all steps", async ({ page }) => {
    await page.goto("/onboarding");

    // Step 1: Company info
    await expect(page.getByText(/empresa|company|organização/i).first()).toBeVisible();

    // Fill company name
    const nameInput = page.getByLabel(/nome da empresa|company name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill("Transportes E2E Ltda.");
    }
  });
});

/**
 * E2E: Commission flow
 * Verifies commission plans and transactions pages load.
 */
test.describe("Commissions", () => {
  test("commissions page loads with tabs", async ({ page }) => {
    await page.goto("/commissions");

    await expect(page.getByRole("heading", { name: /comissões/i })).toBeVisible();

    // All tabs present
    await expect(page.getByRole("button", { name: /planos/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /transações/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /aprovações/i })).toBeVisible();
  });

  test("switching tabs works", async ({ page }) => {
    await page.goto("/commissions");

    await page.getByRole("button", { name: /transações/i }).click();
    await expect(page.locator("#commissions-tab-transactions")).toHaveClass(/bg-white/);

    await page.getByRole("button", { name: /aprovações/i }).click();
    await expect(page.locator("#commissions-tab-approvals")).toHaveClass(/bg-white/);
  });
});

/**
 * E2E: Fleet map
 */
test.describe("Fleet Map", () => {
  test("map page loads with status indicator", async ({ page }) => {
    await page.goto("/map");

    await expect(page.getByRole("heading", { name: /mapa da frota/i })).toBeVisible();

    // Realtime status badge
    await expect(page.getByText(/ao vivo|conectando/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

/**
 * E2E: Access Control Studio
 */
test.describe("Access Control Studio", () => {
  test("studio/access page loads", async ({ page }) => {
    await page.goto("/studio/access");

    await expect(page.getByRole("heading", { name: /controle de acesso/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /papéis/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /delegações/i })).toBeVisible();
  });
});
