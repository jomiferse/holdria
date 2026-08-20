import { createAuthenticatedUser, deleteUser, expect, test } from "./fixtures";

test.describe("portfolio management", () => {
  test("new user sees onboarding and creates their first portfolio", async ({ authenticatedPage: page }) => {
    await page.goto("/portfolios");

    await expect(page.getByRole("heading", { name: "Welcome to Holdria" })).toBeVisible();

    await page.getByLabel("Portfolio name").fill("Retirement");
    await page.getByRole("button", { name: "Create portfolio" }).click();

    await expect(page.getByRole("heading", { name: "Your portfolios" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Retirement" })).toBeVisible();
  });

  test("rejects an empty portfolio name", async ({ authenticatedPage: page }) => {
    await page.goto("/portfolios");
    await page.getByRole("button", { name: "Create portfolio" }).click();
    // The browser's native `required` validation blocks submission; the
    // onboarding empty state (not a list) stays visible.
    await expect(page.getByRole("heading", { name: "Welcome to Holdria" })).toBeVisible();
  });

  test("supports multiple portfolios and switching between them", async ({ authenticatedPage: page }) => {
    await page.goto("/portfolios");
    await page.getByLabel("Portfolio name").fill("Retirement");
    await page.getByRole("button", { name: "Create portfolio" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Retirement" })).toBeVisible();

    await page.getByLabel("Portfolio name").fill("Brokerage");
    await page.getByRole("button", { name: "Create portfolio" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Brokerage" })).toBeVisible();

    await page.getByRole("heading", { level: 2, name: "Retirement" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Retirement" })).toBeVisible();

    await page.getByLabel("Switch portfolio").selectOption({ label: "Brokerage" });
    await expect(page).toHaveURL(/\/portfolios\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Brokerage" })).toBeVisible();
  });

  test("renames a portfolio", async ({ authenticatedPage: page }) => {
    await page.goto("/portfolios");
    await page.getByLabel("Portfolio name").fill("Old name");
    await page.getByRole("button", { name: "Create portfolio" }).click();
    await page.getByRole("heading", { level: 2, name: "Old name" }).click();

    await page.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("Portfolio name").fill("New name");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "New name" })).toBeVisible();
  });

  test("deletes a portfolio and returns to the list", async ({ authenticatedPage: page }) => {
    await page.goto("/portfolios");
    await page.getByLabel("Portfolio name").fill("Gone soon");
    await page.getByRole("button", { name: "Create portfolio" }).click();
    await page.getByRole("heading", { level: 2, name: "Gone soon" }).click();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete portfolio" }).click();

    await expect(page).toHaveURL(/\/portfolios$/);
    await expect(page.getByRole("heading", { name: "Welcome to Holdria" })).toBeVisible();
  });

  test("does not let one user reach another user's portfolio", async ({ authenticatedPage: page, browser }) => {
    await page.goto("/portfolios");
    await page.getByLabel("Portfolio name").fill("Owner-only");
    await page.getByRole("button", { name: "Create portfolio" }).click();
    await page.getByRole("heading", { level: 2, name: "Owner-only" }).click();
    await page.waitForURL(/\/portfolios\/[^/]+$/);
    const ownerUrl = page.url();

    const other = await createAuthenticatedUser();
    const otherContext = await browser.newContext();
    const host = new URL(ownerUrl);
    await otherContext.addCookies(
      other.cookies.map((cookie) => ({ name: cookie.name, value: cookie.value, domain: host.hostname, path: "/" })),
    );
    const otherPage = await otherContext.newPage();

    // Ownership is enforced at the query layer, so a portfolio id that
    // exists but belongs to someone else resolves the same `notFound()`
    // boundary as one that does not exist — the response never leaks the
    // owner's portfolio name. (The HTTP status this renders with is a
    // `next dev` vs. production build detail, exercised by the DB
    // integration test instead; this asserts the actual security
    // guarantee: no cross-tenant data reaches the page.)
    await otherPage.goto(ownerUrl);
    await expect(otherPage.getByText("This page could not be found")).toBeVisible();
    await expect(otherPage.getByText("Owner-only")).toHaveCount(0);

    await otherContext.close();
    await deleteUser(other.userId);
  });
});
