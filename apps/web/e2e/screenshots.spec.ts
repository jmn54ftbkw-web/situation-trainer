/**
 * Key-screen captures for PR review (not a pass/fail visual diff yet).
 * Run: SCREENSHOT_DIR=/abs/dir pnpm --filter @st/web test:e2e screenshots
 */
import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";

const dir = process.env.SCREENSHOT_DIR;
test.skip(!dir, "SCREENSHOT_DIR not set");

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(dir as string, `platform-${name}.png`) });

test("capture new app key screens", async ({ page }) => {
  await page.goto("./?seed=3");
  await page.waitForTimeout(400);
  await shot(page, "home");
  await page.getByRole("button", { name: "12U–14U", exact: true }).click();
  await page.locator("#btn-start").click();
  await page.getByRole("button", { name: "Position CF", exact: true }).click();
  await shot(page, "position");
  await page.locator("#btn-begin").click();

  const wrap = page.locator("#diamond-wrap");
  await expect(wrap).toHaveAttribute("data-phase", "setup");
  await page.waitForTimeout(500);
  await shot(page, "drill-setup");
  await expect(wrap).toHaveAttribute("data-phase", "pitch");
  await shot(page, "drill-pitch-cue");
  await expect(wrap).toHaveAttribute("data-phase", "freeze", { timeout: 10_000 });
  await shot(page, "drill-freeze");
  await expect(wrap).toHaveAttribute("data-phase", "read");
  await page.waitForTimeout(300);
  await shot(page, "drill-read");
  await expect(wrap).toHaveAttribute("data-phase", "decide", { timeout: 10_000 });
  await page.waitForTimeout(450);
  await shot(page, "drill-decide");
  await page.locator("#choices .choice").first().click();
  await expect(wrap).toHaveAttribute("data-phase", "outcome");
  await page.waitForTimeout(700);
  await shot(page, "drill-finish");
  await expect(page.locator("#screen-feedback")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(700);
  await shot(page, "feedback");

  // Fast-forward the rest of the session.
  await page.goto("./?seed=3&speed=8");
  await page.getByRole("button", { name: "12U–14U", exact: true }).click();
  await page.locator("#btn-start").click();
  await page.getByRole("button", { name: "Position CF", exact: true }).click();
  await page.locator("#btn-begin").click();
  while (!(await page.locator("#screen-summary").isVisible())) {
    const choice = page.locator("#choices .choice").last();
    await expect(choice).toBeEnabled({ timeout: 15_000 });
    await choice.click();
    await page.locator("#btn-next").click({ timeout: 15_000 });
  }
  await page.waitForTimeout(400);
  await shot(page, "summary");
});

test("capture legacy prototype for side-by-side", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/");
  await page.waitForTimeout(400);
  await shot(page, "legacy-home");
  await page.locator('#age-seg [data-age="12U-14U"]').click();
  await page.locator("#btn-start").click();
  await page.locator('[data-pos="CF"]').click();
  await shot(page, "legacy-position");
  await page.locator("#btn-begin").click();
  await page.waitForTimeout(800);
  await shot(page, "legacy-drill-setup");
  await expect(page.locator("#phase-banner")).toHaveText("Decide", { timeout: 15_000 });
  await page.waitForTimeout(450);
  await shot(page, "legacy-drill-decide");
});
