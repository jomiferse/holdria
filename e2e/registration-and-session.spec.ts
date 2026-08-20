import { expect, test, uniqueTestAccount } from "./fixtures/auth";
import { markEmailVerified } from "./fixtures/db";

test.describe("registration and session", () => {
  test("register, verify, sign in, and sign out", async ({ page }) => {
    const account = uniqueTestAccount("register");

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill(account.name);
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await expect(page.getByText(account.email)).toBeVisible();

    // An unverified account has no session at all yet, so the guarded
    // area sends it to sign-in rather than the pending screen directly.
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);

    // Signing in before verifying routes back to the pending screen
    // instead of a bare "invalid credentials" message (identity spec:
    // "Unverified account attempts product access").
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/sign-up/pending\\?email=${encodeURIComponent(account.email)}`));

    await markEmailVerified(account.email);

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/account");
    await expect(page.getByText(account.email)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    // A signed-out visitor cannot reach the authenticated area.
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("shows an actionable error for an unknown sign-in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("nobody-here@example.com");
    await page.getByLabel("Password").fill("wrong-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
