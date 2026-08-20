import { test, expect } from "./fixtures/auth";

/**
 * The critical first-run journey (task 9.1, design.md decision 10): a
 * brand-new account, through real registration and verification UI,
 * reaching its first complete portfolio valuation — a portfolio, a
 * contribution, an instrument, a purchase, a manual price, and a
 * non-zero, fully priced result. No step is skipped via a fixture
 * shortcut; `account` itself signs up and in through the real UI.
 */
test.describe("first-run journey", () => {
  test("registration through a first complete valuation", async ({ page, account: _account }) => {
    // Destructuring `account` (even unused) is what makes Playwright run
    // that fixture at all: it already completed sign-up, verification,
    // and sign-in through the real UI and left `page` on "/".
    await page.goto("/portfolios");
    await expect(page.getByRole("heading", { name: "Welcome to Holdria" })).toBeVisible();

    await page.getByLabel("Portfolio name").fill("First Portfolio");
    await page.getByRole("button", { name: "Create portfolio" }).click();
    await page.getByRole("heading", { level: 2, name: "First Portfolio" }).click();
    await page.waitForURL(/\/portfolios\/[^/]+$/);
    const portfolioId = new URL(page.url()).pathname.split("/").pop()!;

    await page.getByRole("link", { name: "Instruments" }).click();
    await page.getByRole("button", { name: "Add your first instrument" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("World Fund");
    await dialog.getByLabel(/ISIN/).fill("IE00B4L5Y983");
    await dialog.getByRole("button", { name: "Add instrument" }).click();
    await expect(page.getByRole("cell", { name: "World Fund" })).toBeVisible();

    await page.getByRole("link", { name: "Operations" }).click();
    await page.getByRole("button", { name: "Contribute & invest" }).first().click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Effective date").fill("2026-01-01");
    await dialog.getByLabel("Contribution amount (EUR)").fill("1000");
    await dialog.getByLabel("Instrument").selectOption({ label: "World Fund (FUND)" });
    await dialog.getByLabel("Quantity").fill("10");
    await dialog.getByLabel("Unit price (EUR)").fill("100");
    await dialog.getByRole("button", { name: "Contribute & invest" }).click();
    await expect(page.getByText("Contribution and buy recorded.")).toBeVisible();

    await page.goto("/prices");
    await page.getByRole("button", { name: "Add price" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Price (EUR)").fill("105");
    await dialog.getByLabel("Effective date").fill("2026-01-15");
    await dialog.getByRole("button", { name: "Record price" }).click();
    await expect(page.getByText("105.0000 EUR")).toBeVisible();

    await page.goto(`/portfolios/${portfolioId}`);
    await expect(page.getByTestId("portfolio-total-value")).toHaveText(/1\.050,00/);
    await expect(page.getByTestId("portfolio-absolute-result")).toHaveText(/50,00/);
    await expect(page.getByText("Some figures are incomplete")).toHaveCount(0);
  });
});
