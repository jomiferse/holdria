import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function createFundInstrument(page: Page, name = "World Fund") {
  await page.goto("/portfolios");
  await page.getByLabel("Portfolio name").fill("Main");
  await page.getByRole("button", { name: "Create portfolio" }).click();
  await page.getByRole("heading", { level: 2, name: "Main" }).click();
  await page.getByRole("link", { name: "Instruments" }).click();
  await page.getByRole("button", { name: "Add your first instrument" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel(/ISIN/).fill("IE00B4L5Y983");
  await dialog.getByRole("button", { name: "Add instrument" }).click();
  await expect(page.getByText("IE00B4L5Y983")).toBeVisible();
}

test.describe("manual prices", () => {
  test("records a manual price and shows its date and manual source, never as real-time", async ({
    authenticatedPage: page,
  }) => {
    await createFundInstrument(page);

    await page.goto("/prices");
    await expect(page.getByRole("heading", { name: "World Fund" })).toBeVisible();
    await page.getByRole("button", { name: "Add price" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Price (EUR)").fill("101.5000");
    await dialog.getByLabel("Effective date").fill("2026-01-15");
    await dialog.getByRole("button", { name: "Record price" }).click();

    await expect(page.getByText("101.5000 EUR")).toBeVisible();
    await expect(page.getByText("Manual · as of 2026-01-15")).toBeVisible();
  });

  test("prevents a second price for the same instrument and date", async ({ authenticatedPage: page }) => {
    await createFundInstrument(page);
    await page.goto("/prices");

    await page.getByRole("button", { name: "Add price" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Price (EUR)").fill("100");
    await dialog.getByLabel("Effective date").fill("2026-01-15");
    await dialog.getByRole("button", { name: "Record price" }).click();
    await expect(page.getByText("100.0000 EUR")).toBeVisible();

    await page.getByRole("button", { name: "Add price" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Price (EUR)").fill("105");
    await dialog.getByLabel("Effective date").fill("2026-01-15");
    await dialog.getByRole("button", { name: "Record price" }).click();

    await expect(page.getByText(/already have a price|edit the existing/i)).toBeVisible();
  });

  test("corrects an existing price", async ({ authenticatedPage: page }) => {
    await createFundInstrument(page);
    await page.goto("/prices");

    await page.getByRole("button", { name: "Add price" }).click();
    const addDialog = page.getByRole("dialog");
    await addDialog.getByLabel("Price (EUR)").fill("100");
    await addDialog.getByLabel("Effective date").fill("2026-01-15");
    await addDialog.getByRole("button", { name: "Record price" }).click();
    await expect(page.getByText("100.0000 EUR")).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByLabel("Price (EUR)").fill("110");
    await editDialog.getByRole("button", { name: "Save correction" }).click();

    await expect(page.getByText("110.0000 EUR")).toBeVisible();
    await expect(page.getByText("100.0000 EUR")).toHaveCount(0);
  });

  test("deletes a price", async ({ authenticatedPage: page }) => {
    await createFundInstrument(page);
    await page.goto("/prices");

    await page.getByRole("button", { name: "Add price" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Price (EUR)").fill("100");
    await dialog.getByLabel("Effective date").fill("2026-01-15");
    await dialog.getByRole("button", { name: "Record price" }).click();
    await expect(page.getByText("100.0000 EUR")).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    const confirmDialog = page.getByRole("dialog");
    await confirmDialog.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByText("No manual prices recorded yet.")).toBeVisible();
  });
});
