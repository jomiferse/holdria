import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures";
import { test as accountTest } from "./fixtures/auth";

/**
 * Accessibility smoke checks (task 10.6): an automated axe-core scan of
 * each core, unauthenticated entry point plus one representative
 * authenticated page, run as part of the same suite the release
 * verification procedure exercises (see `docs/deployment.md`, "Clean
 * deployment verification"). This is a smoke check, not the broader
 * manual/automated accessibility audit tracked as its own task (tasks.md
 * 9.3) — it catches automatically detectable violations (missing labels,
 * insufficient contrast, invalid ARIA, etc.) on the pages every user
 * passes through, not a full WCAG conformance review.
 */
const pages = ["/sign-in", "/sign-up", "/forgot-password"];

for (const path of pages) {
  test(`${path} has no automatically detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test("the portfolio onboarding page has no automatically detectable accessibility violations", async ({
  authenticatedPage: page,
}) => {
  await page.goto("/portfolios");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

accountTest(
  "the account page has no automatically detectable accessibility violations",
  async ({ page }) => {
    await page.goto("/account");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  },
);
