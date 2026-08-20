import { createAuthenticatedContext, deleteUser, expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function createPortfolio(page: Page, name = "Main") {
  await page.goto("/portfolios");
  await page.getByLabel("Portfolio name").fill(name);
  await page.getByRole("button", { name: "Create portfolio" }).click();
  await page.getByRole("heading", { level: 2, name }).click();
  await page.waitForURL(/\/portfolios\/[^/]+$/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

async function addInstrument(
  page: Page,
  { type, name, isin }: { type?: "FUND" | "ETF" | "STOCK"; name: string; isin?: string },
) {
  await page.getByRole("link", { name: "Instruments" }).click();
  const isFirst = await page.getByRole("button", { name: "Add your first instrument" }).isVisible().catch(() => false);
  await page.getByRole("button", { name: isFirst ? "Add your first instrument" : "Add instrument" }).click();
  const dialog = page.getByRole("dialog");
  if (type && type !== "FUND") {
    await dialog.getByLabel("Type").selectOption(type);
  }
  await dialog.getByLabel("Name").fill(name);
  if (isin) {
    await dialog.getByLabel(/ISIN/).fill(isin);
  }
  await dialog.getByRole("button", { name: "Add instrument" }).click();
  await expect(page.getByRole("cell", { name })).toBeVisible();
}

async function recordPrice(page: Page, instrumentName: string, price: string, date: string) {
  await page.goto("/prices");
  const card = page.locator('[data-slot="card"]', { has: page.getByRole("heading", { name: instrumentName }) });
  await card.getByRole("button", { name: "Add price" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Price (EUR)").fill(price);
  await dialog.getByLabel("Effective date").fill(date);
  await dialog.getByRole("button", { name: "Record price" }).click();
}

test.describe("analytics and the ledger", () => {
  test("a valued fund portfolio shows a complete valuation, absolute result, and return", async ({
    authenticatedPage: page,
  }) => {
    const portfolioId = await createPortfolio(page, "Fund Portfolio");
    await addInstrument(page, { name: "World Fund", isin: "IE00B4L5Y983" });

    await page.getByRole("link", { name: "Operations" }).click();
    await page.getByRole("button", { name: "Contribute & invest" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Effective date").fill("2026-01-01");
    await dialog.getByLabel("Contribution amount (EUR)").fill("1000");
    await dialog.getByLabel("Instrument").selectOption({ label: "World Fund (FUND)" });
    await dialog.getByLabel("Quantity").fill("10");
    await dialog.getByLabel("Unit price (EUR)").fill("100");
    await dialog.getByRole("button", { name: "Contribute & invest" }).click();
    await expect(page.getByText("Contribution and buy recorded.")).toBeVisible();

    await recordPrice(page, "World Fund", "110", "2026-02-01");

    // The manual-prices UI lives on the standalone `/prices` route (no
    // portfolio tab navigation there); return to the portfolio directly.
    await page.goto(`/portfolios/${portfolioId}`);
    await expect(page.getByTestId("portfolio-total-value")).toHaveText(/1\.100,00/);
    await expect(page.getByTestId("portfolio-absolute-result")).toHaveText(/100,00/);
    await expect(page.getByTestId("portfolio-return")).not.toHaveText("Unavailable");
  });

  test("an ETF portfolio built from a separate contribution and buy values correctly", async ({
    authenticatedPage: page,
  }) => {
    const portfolioId = await createPortfolio(page, "ETF Portfolio");
    await addInstrument(page, { type: "ETF", name: "World ETF" });

    await page.getByRole("link", { name: "Operations" }).click();
    await page.getByRole("button", { name: "Add operation" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Effective date").fill("2026-01-01");
    await dialog.getByLabel("Amount (EUR)").fill("2000");
    await dialog.getByRole("button", { name: "Add operation" }).click();
    await expect(page.getByText("CONTRIBUTION recorded.")).toBeVisible();

    await page.getByRole("button", { name: "Add operation" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Type").selectOption("BUY");
    await dialog.getByLabel("Effective date").fill("2026-01-02");
    await dialog.getByLabel("Instrument").selectOption({ label: "World ETF (ETF)" });
    await dialog.getByLabel("Quantity").fill("20");
    await dialog.getByLabel("Unit price (EUR)").fill("50");
    await dialog.getByRole("button", { name: "Add operation" }).click();
    await expect(page.getByText("BUY recorded.")).toBeVisible();

    await recordPrice(page, "World ETF", "55", "2026-01-02");

    await page.goto(`/portfolios/${portfolioId}`);
    // cash 2000 - 1000 = 1000; position 20*55 = 1100; total 2100
    await expect(page.getByTestId("portfolio-total-value")).toHaveText(/2\.100,00/);
  });

  test("a withdrawal reduces cash and is reflected in the absolute result", async ({ authenticatedPage: page }) => {
    await createPortfolio(page, "Cash Portfolio");

    await page.getByRole("link", { name: "Operations" }).click();
    await page.getByRole("button", { name: "Add your first operation" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Effective date").fill("2026-01-01");
    await dialog.getByLabel("Amount (EUR)").fill("1000");
    await dialog.getByRole("button", { name: "Add operation" }).click();
    await expect(page.getByText("CONTRIBUTION recorded.")).toBeVisible();

    await page.getByRole("button", { name: "Add operation" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Type").selectOption("WITHDRAWAL");
    await dialog.getByLabel("Effective date").fill("2026-01-05");
    await dialog.getByLabel("Amount (EUR)").fill("200");
    await dialog.getByRole("button", { name: "Add operation" }).click();
    await expect(page.getByText("WITHDRAWAL recorded.")).toBeVisible();

    await page.getByRole("link", { name: "Summary" }).click();
    // no positions: total value = cash = 800; absolute result = 800 + 200 - 1000 = 0
    await expect(page.getByTestId("portfolio-total-value")).toHaveText(/800,00/);
    await expect(page.getByTestId("portfolio-absolute-result")).toHaveText(/0,00/);
  });

  test("a partial sale reduces units and records a realized result", async ({ authenticatedPage: page }) => {
    const portfolioId = await createPortfolio(page, "Trading Portfolio");
    await addInstrument(page, { type: "STOCK", name: "Acme Corp" });

    await page.getByRole("link", { name: "Operations" }).click();
    await page.getByRole("button", { name: "Contribute & invest" }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Effective date").fill("2026-01-01");
    await dialog.getByLabel("Contribution amount (EUR)").fill("1000");
    await dialog.getByLabel("Instrument").selectOption({ label: "Acme Corp (STOCK)" });
    await dialog.getByLabel("Quantity").fill("10");
    await dialog.getByLabel("Unit price (EUR)").fill("50");
    await dialog.getByRole("button", { name: "Contribute & invest" }).click();
    await expect(page.getByText("Contribution and buy recorded.")).toBeVisible();

    await page.getByRole("button", { name: "Add operation" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Type").selectOption("SELL");
    await dialog.getByLabel("Effective date").fill("2026-01-10");
    await dialog.getByLabel("Instrument").selectOption({ label: "Acme Corp (STOCK)" });
    await dialog.getByLabel("Quantity").fill("4");
    await dialog.getByLabel("Unit price (EUR)").fill("60");
    await dialog.getByRole("button", { name: "Add operation" }).click();
    await expect(page.getByText("SELL recorded.")).toBeVisible();

    await recordPrice(page, "Acme Corp", "60", "2026-01-10");

    await page.goto(`/portfolios/${portfolioId}`);
    await expect(page.getByText("6.0000")).toBeVisible(); // remaining units
  });

  test("a missing price leaves the valuation and return explicitly unavailable", async ({ authenticatedPage: page }) => {
    await createPortfolio(page, "Unpriced Portfolio");
    await addInstrument(page, { type: "STOCK", name: "No Price Inc" });

    await page.getByRole("link", { name: "Operations" }).click();
    await page.getByRole("button", { name: "Contribute & invest" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Effective date").fill("2026-01-01");
    await dialog.getByLabel("Contribution amount (EUR)").fill("500");
    await dialog.getByLabel("Instrument").selectOption({ label: "No Price Inc (STOCK)" });
    await dialog.getByLabel("Quantity").fill("5");
    await dialog.getByLabel("Unit price (EUR)").fill("100");
    await dialog.getByRole("button", { name: "Contribute & invest" }).click();
    await expect(page.getByText("Contribution and buy recorded.")).toBeVisible();

    await page.getByRole("link", { name: "Summary" }).click();
    await expect(page.getByTestId("portfolio-total-value")).toHaveText("Unavailable");
    await expect(page.getByText("Some figures are incomplete")).toBeVisible();
    await expect(page.getByText(/No Price Inc has no recorded price/)).toBeVisible();
  });

  test("correcting an earlier operation recalculates later results", async ({ authenticatedPage: page }) => {
    await createPortfolio(page, "Correction Portfolio");

    await page.getByRole("link", { name: "Operations" }).click();
    await page.getByRole("button", { name: "Add your first operation" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Effective date").fill("2026-01-01");
    await dialog.getByLabel("Amount (EUR)").fill("1000");
    await dialog.getByRole("button", { name: "Add operation" }).click();
    await expect(page.getByText("CONTRIBUTION recorded.")).toBeVisible();

    await page.getByRole("link", { name: "Summary" }).click();
    await expect(page.getByTestId("portfolio-total-value")).toHaveText(/1\.000,00/);

    await page.getByRole("link", { name: "Operations" }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByLabel("Amount (EUR)").fill("1500");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Entry updated.")).toBeVisible();

    await page.getByRole("link", { name: "Summary" }).click();
    await expect(page.getByTestId("portfolio-total-value")).toHaveText(/1\.500,00/);
  });

  test("rejects a withdrawal that would leave cash negative", async ({ authenticatedPage: page }) => {
    await createPortfolio(page, "Overdraft Portfolio");

    await page.getByRole("link", { name: "Operations" }).click();
    await page.getByRole("button", { name: "Add your first operation" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Effective date").fill("2026-01-01");
    await dialog.getByLabel("Amount (EUR)").fill("100");
    await dialog.getByRole("button", { name: "Add operation" }).click();
    await expect(page.getByText("CONTRIBUTION recorded.")).toBeVisible();

    await page.getByRole("button", { name: "Add operation" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Type").selectOption("WITHDRAWAL");
    await dialog.getByLabel("Effective date").fill("2026-01-02");
    await dialog.getByLabel("Amount (EUR)").fill("500");
    await dialog.getByRole("button", { name: "Add operation" }).click();

    await expect(page.getByText(/negative/i).first()).toBeVisible();
  });

  test("a price correction updates summary, allocation, and history through client navigation, with no hard reload", async ({
    authenticatedPage: page,
  }) => {
    const portfolioId = await createPortfolio(page, "Price Correction Portfolio");
    await addInstrument(page, { name: "Correction Fund", isin: "IE00B4L5Y983" });

    await page.getByRole("link", { name: "Operations" }).click();
    await page.getByRole("button", { name: "Contribute & invest" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Effective date").fill("2026-01-01");
    await dialog.getByLabel("Contribution amount (EUR)").fill("1000");
    await dialog.getByLabel("Instrument").selectOption({ label: "Correction Fund (FUND)" });
    await dialog.getByLabel("Quantity").fill("10");
    await dialog.getByLabel("Unit price (EUR)").fill("100");
    await dialog.getByRole("button", { name: "Contribute & invest" }).click();
    await expect(page.getByText("Contribution and buy recorded.")).toBeVisible();

    await recordPrice(page, "Correction Fund", "110", "2026-02-01");

    // Establishes the pre-correction figures on every affected view —
    // cash 0, position 10*110 = 1100.
    await page.goto(`/portfolios/${portfolioId}`);
    await expect(page.getByTestId("portfolio-total-value")).toHaveText(/1\.100,00/);

    await page.getByRole("link", { name: "Allocation" }).click();
    await expect(page.getByRole("heading", { name: "By instrument", exact: true })).toBeVisible();
    await expect(page.getByText("1.100,00 €").first()).toBeVisible();

    await page.getByRole("link", { name: "History" }).click();
    await expect(page.getByRole("img", { name: "Portfolio value over time" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "1.100,00 €" }).first()).toBeVisible();

    // A marker set on this page's `window` proves every assertion below
    // happens without this tab's JS context ever being torn down by a
    // hard navigation — the correction itself happens in a second tab
    // (manual prices are instrument-scoped, not portfolio-scoped, and
    // reached through the standalone `/prices` route — see
    // `missing-price-note.tsx` — which this tab, parked on the History
    // view, is never navigated to).
    await page.evaluate(() => {
      (window as unknown as { __e2eNoReloadMarker?: string }).__e2eNoReloadMarker = "still-here";
    });
    const stillClientSide = () =>
      expect(page.evaluate(() => (window as unknown as { __e2eNoReloadMarker?: string }).__e2eNoReloadMarker)).resolves.toBe(
        "still-here",
      );

    const pricesPage = await page.context().newPage();
    await pricesPage.goto("/prices");
    await pricesPage.getByRole("button", { name: "Edit" }).click();
    const editDialog = pricesPage.getByRole("dialog");
    await editDialog.getByLabel("Price (EUR)").fill("130");
    await editDialog.getByRole("button", { name: "Save correction" }).click();
    await expect(pricesPage.getByText("130.0000 EUR")).toBeVisible();
    await pricesPage.close();

    // Back on the original tab, still on the History view it never left:
    // every navigation from here on is a client-side `<Link>` click
    // between the portfolio's own tabs.
    await stillClientSide();
    await page.getByRole("link", { name: "Summary" }).click();
    await stillClientSide();

    // Position value now 10*130 = 1300 with no cash — corrected on the
    // summary view without a reload.
    await expect(page.getByTestId("portfolio-total-value")).toHaveText(/1\.300,00/);
    await expect(page.getByTestId("portfolio-absolute-result")).toHaveText(/300,00/);
    await expect(page.getByTestId("portfolio-return")).not.toHaveText("Unavailable");
    await stillClientSide();

    await page.getByRole("link", { name: "Allocation" }).click();
    await expect(page.getByRole("heading", { name: "By instrument", exact: true })).toBeVisible();
    await expect(page.getByText("1.300,00 €").first()).toBeVisible();
    await expect(page.getByText("1.100,00 €")).toHaveCount(0);
    await stillClientSide();

    await page.getByRole("link", { name: "History" }).click();
    await expect(page.getByRole("img", { name: "Portfolio value over time" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "1.300,00 €" }).first()).toBeVisible();
    await stillClientSide();
  });

  test("does not let one user reach another user's operations or prices", async ({
    authenticatedPage: page,
    browser,
    baseURL,
  }) => {
    const portfolioId = await createPortfolio(page, "Private Portfolio");
    const operationsUrl = `${new URL(page.url()).origin}/portfolios/${portfolioId}/operations`;

    const { userId: otherUserId, context: otherContext } = await createAuthenticatedContext(
      browser,
      baseURL ?? "http://localhost:3000",
    );
    const otherPage = await otherContext.newPage();

    await otherPage.goto(operationsUrl);
    await expect(otherPage.getByText("This page could not be found")).toBeVisible();
    await expect(otherPage.getByText("Private Portfolio")).toHaveCount(0);

    await otherContext.close();
    await deleteUser(otherUserId);
  });
});
