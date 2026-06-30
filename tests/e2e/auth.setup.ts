import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

/**
 * Auth setup — logs in once and saves session to .auth/user.json
 * All other test projects depend on this and reuse the saved session.
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  // Skip when credentials are not configured (no real Supabase in CI)
  if (!email || !password) {
    setup.skip(true, "E2E_USER_EMAIL / E2E_USER_PASSWORD not configured — skipping auth setup");
    return;
  }

  await page.goto("/login");

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/senha|password/i).fill(password);
  await page.getByRole("button", { name: /entrar|sign in|login/i }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Save authenticated session
  await page.context().storageState({ path: authFile });
});
