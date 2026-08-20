import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function createPortfolioAndOpenInstruments(page: Page) {
  await page.goto("/portfolios");
  await page.getByLabel("Portfolio name").fill("Main");
  await page.getByRole("button", { name: "Create portfolio" }).click();
  await page.getByRole("heading", { level: 2, name: "Main" }).click();
  await page.getByRole("link", { name: "Instruments" }).click();
}

test.describe("instrument management", () => {
  test("requires an ISIN for a fund and identifies the invalid field", async ({ authenticatedPage: page }) => {
    await createPortfolioAndOpenInstruments(page);

    await page.getByRole("button", { name: "Add your first instrument" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("World Fund");
    await dialog.getByRole("button", { name: "Add instrument" }).click();

    // Native `required` on the ISIN field (shown for FUND) blocks
    // submission — the dialog stays open instead of creating a partial
    // instrument.
    await expect(dialog).toBeVisible();
  });

  test("normalizes a lowercase/spaced ISIN to canonical uppercase form", async ({ authenticatedPage: page }) => {
    await createPortfolioAndOpenInstruments(page);

    await page.getByRole("button", { name: "Add your first instrument" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("World Fund");
    await dialog.getByLabel(/ISIN/).fill("ie 00b 4l5y983");
    await dialog.getByRole("button", { name: "Add instrument" }).click();

    await expect(page.getByText("IE00B4L5Y983")).toBeVisible();
  });

  test("allows an ETF/stock without an ISIN, using ticker and market instead", async ({ authenticatedPage: page }) => {
    await createPortfolioAndOpenInstruments(page);

    await page.getByRole("button", { name: "Add your first instrument" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Type").selectOption("STOCK");
    await dialog.getByLabel("Name").fill("Apple");
    await dialog.getByLabel("Ticker").fill("aapl");
    await dialog.getByLabel("Market").fill("nasdaq");
    await dialog.getByRole("button", { name: "Add instrument" }).click();

    await expect(page.getByRole("cell", { name: "Apple" })).toBeVisible();
    await expect(page.getByText("AAPL · NASDAQ")).toBeVisible();
  });

  test("rejects a duplicate ISIN and points at the existing instrument", async ({ authenticatedPage: page }) => {
    await createPortfolioAndOpenInstruments(page);

    await page.getByRole("button", { name: "Add your first instrument" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("World Fund");
    await dialog.getByLabel(/ISIN/).fill("IE00B4L5Y983");
    await dialog.getByRole("button", { name: "Add instrument" }).click();
    await expect(page.getByText("IE00B4L5Y983")).toBeVisible();

    await page.getByRole("button", { name: "Add instrument" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Duplicate Fund");
    await dialog.getByLabel(/ISIN/).fill("IE00B4L5Y983");
    await dialog.getByRole("button", { name: "Add instrument" }).click();

    await expect(page.getByText("You already have an instrument with this ISIN.")).toBeVisible();
  });

  test("deletes an unused instrument", async ({ authenticatedPage: page }) => {
    await createPortfolioAndOpenInstruments(page);

    await page.getByRole("button", { name: "Add your first instrument" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Type").selectOption("STOCK");
    await dialog.getByLabel("Name").fill("Apple");
    await dialog.getByRole("button", { name: "Add instrument" }).click();
    await expect(page.getByRole("cell", { name: "Apple" })).toBeVisible();

    await page.getByRole("row", { name: "Apple" }).getByRole("button", { name: "Delete" }).click();
    const confirmDialog = page.getByRole("dialog");
    await confirmDialog.getByRole("button", { name: "Delete instrument" }).click();

    await expect(page.getByText("No instruments yet.")).toBeVisible();
  });
});
