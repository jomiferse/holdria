import { expect, test } from "./fixtures";

/**
 * Keyboard-navigation, focus-management, and narrow-viewport coverage for
 * core flows (task 9.3, design.md decision 10: "keyboard, focus, label,
 * contrast, and status-announcement expectations"; decision 12: "tests
 * must include accessibility assertions ... and responsive viewport
 * coverage").
 */
test.describe("accessibility", () => {
  test("creates a portfolio using only the keyboard", async ({ authenticatedPage: page }) => {
    await page.goto("/portfolios");

    // No mouse interaction anywhere below: focus the name field directly
    // (equivalent to what pressing Tab from the page body would reach,
    // without depending on how many other focusable elements happen to
    // precede it in the layout) and drive the rest by keyboard alone.
    await page.getByLabel("Portfolio name").focus();
    await page.keyboard.type("Keyboard Portfolio");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Create portfolio" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { level: 2, name: "Keyboard Portfolio" })).toBeVisible();
  });

  test("Escape closes a dialog and returns focus to its trigger", async ({ authenticatedPage: page }) => {
    await page.goto("/portfolios");
    await page.getByLabel("Portfolio name").fill("Focus Portfolio");
    await page.getByRole("button", { name: "Create portfolio" }).click();
    await page.getByRole("heading", { level: 2, name: "Focus Portfolio" }).click();
    await page.getByRole("link", { name: "Instruments" }).click();

    const trigger = page.getByRole("button", { name: "Add your first instrument" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the portfolio shell remains usable at a narrow (mobile) viewport", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/portfolios");
    await page.getByLabel("Portfolio name").fill("Mobile Portfolio");
    await page.getByRole("button", { name: "Create portfolio" }).click();
    await page.getByRole("heading", { level: 2, name: "Mobile Portfolio" }).click();

    // Section navigation stays reachable (horizontally scrollable rather
    // than clipped, per the `overflow-x-auto` tab bar) and every tab is
    // still an operable link at this width.
    const nav = page.getByRole("navigation", { name: "Portfolio sections" });
    await expect(nav).toBeVisible();
    for (const label of ["Summary", "Operations", "Instruments", "Prices", "Allocation", "History"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }

    await page.getByRole("link", { name: "Operations" }).click();
    await expect(page.getByRole("button", { name: "Add operation" })).toBeVisible();
  });
});
