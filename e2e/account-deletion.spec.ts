import { expect, test } from "./fixtures/auth";
import { findUserByEmail } from "./fixtures/db";

test.describe("account deletion", () => {
  test("requires the current password and removes the account", async ({ page, account }) => {
    await page.goto("/account");

    // Wrong password is rejected and the account survives.
    await page.getByLabel("Confirm your password").fill("not-the-real-password-1");
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByRole("button", { name: "Permanently delete account" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(findUserByEmail(account.email)).resolves.not.toBeNull();

    // Reload for a clean form instance rather than reusing the one from
    // the failed attempt above.
    await page.reload();

    // Correct password permanently deletes the account and signs the user out.
    await page.getByLabel("Confirm your password").fill(account.password);
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByRole("button", { name: "Permanently delete account" }).click();

    await expect(page).toHaveURL(/\/sign-in/);
    await expect(findUserByEmail(account.email)).resolves.toBeNull();

    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
