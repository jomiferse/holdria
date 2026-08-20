import { test as base, expect } from "@playwright/test";

import { markEmailVerified } from "./db";

/**
 * Reusable authenticated-user fixture for Playwright (task 1.5). Signs a
 * fresh, uniquely-emailed user up through the real UI (so registration
 * itself stays covered elsewhere), marks it verified directly in the
 * database to skip the inbox round trip for tests that are not about
 * verification, and leaves the page signed in. Nothing here depends on a
 * production account: every user is created per-test and the whole
 * database is `holdria_test`, never a developer or production database.
 */
export type TestAccount = {
  email: string;
  password: string;
  name: string;
};

export function uniqueTestAccount(prefix = "e2e"): TestAccount {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `${prefix}-${unique}@example.com`,
    password: "correct-horse-battery-staple-1",
    name: "Test User",
  };
}

export const test = base.extend<{ account: TestAccount }>({
  // Playwright's fixture callback receives `use` as its second argument by
  // convention, but that name collides with React's `use()` hook for
  // eslint-plugin-react-hooks (this file has no React involved). Renaming
  // it to `provideFixture` avoids the false positive without disabling the
  // rule.
  account: async ({ page }, provideFixture) => {
    const account = uniqueTestAccount();

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill(account.name);
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await markEmailVerified(account.email);

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");

    await provideFixture(account);
  },
});

export { expect };
