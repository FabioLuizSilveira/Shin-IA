import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

/**
 * Auth setup — logs in once and saves session to .auth/user.json
 * All other test projects depend on this and reuse the saved session.
 */
setup("authenticate", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel(/email/i).fill(process.env.E2E_USER_EMAIL ?? "test@shina.dev");
  await page.getByLabel(/senha|password/i).fill(process.env.E2E_USER_PASSWORD ?? "test123456");
  await page.getByRole("button", { name: /entrar|sign in|login/i }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Save authenticated session
  await page.context().storageState({ path: authFile });
});
