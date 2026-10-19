import { expect, test, type Page } from "@playwright/test";

const LEVELS = ["Bench", "Starter", "Varsity", "All-Star"];

async function startSession(page: Page, band: "8U–10U" | "12U–14U", pos: string, speed = 6) {
  await page.goto(`./?seed=7&speed=${speed}`);
  await expect(page.locator("h1.brand")).toContainText("Situation");
  await page.getByRole("button", { name: band, exact: true }).click();
  await page.locator("#btn-start").click();
  await expect(page.locator("#btn-begin")).toBeDisabled();
  await page.getByRole("button", { name: `Position ${pos}`, exact: true }).click();
  await page.locator("#btn-begin").click();
}

test("full Train session at phone width follows the legacy flow", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await startSession(page, "12U–14U", "SS");
  const progress = page.locator("#drill-progress");
  await expect(progress).toHaveText(/Play 1 \/ \d/);
  const plays = Number((await progress.textContent())!.split("/")[1]);
  expect(plays).toBeGreaterThanOrEqual(3);

  for (let i = 0; i < plays; i++) {
    await expect(progress).toHaveText(`Play ${i + 1} / ${plays}`);
    // Situation-first cue before anything moves.
    await expect(page.locator("#play-cue")).toHaveText(/(ball|balls), .*(out|outs), /);
    await expect(page.locator("#prompt")).toBeHidden();
    await expect(page.locator("#pitch-line")).toHaveText("Here's the pitch…");
    // Read beat: prompt visible, choices veiled.
    await expect(page.locator("#diamond-wrap")).toHaveAttribute("data-phase", "read");
    await expect(page.locator("#prompt")).toBeVisible();
    await expect(page.locator("#ask-controls")).toHaveClass(/is-veiled/);
    // Decide: choices unlock with the clock.
    const choices = page.locator("#choices .choice");
    await expect(choices.first()).toBeEnabled();
    expect(await choices.count()).toBeGreaterThanOrEqual(2);
    for (const box of await choices.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().height),
    )) {
      expect(box).toBeGreaterThanOrEqual(44);
    }
    await choices.first().click();
    await expect(page.locator("#choices .choice.correct")).toHaveCount(1);
    await expect(page.locator("#phase-banner")).toHaveText("Finish");

    await expect(page.locator("#screen-feedback")).toBeVisible();
    await expect(page.locator("#feedback-title")).toHaveText(/Quick!|Solid|Got it|Miss/);
    await expect(page.locator("#explanation")).not.toBeEmpty();
    await page.locator("#btn-next").click();
  }

  await expect(page.locator("#screen-summary")).toBeVisible();
  const score = Number(await page.locator("#sum-score").textContent());
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(1000);
  expect(LEVELS).toContain(await page.locator("#sum-level").textContent());
  await expect(page.locator("#screen-summary")).not.toContainText(/accuracy\s*[×x*]|0\.5|formula/i);
  await expect(page.locator("#sum-correct")).toHaveText(new RegExp(`/ ${plays}$`));

  const doc = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(doc).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("timeout scores zero stars and shows Time!", async ({ page }) => {
  await startSession(page, "12U–14U", "CF", 8);
  await expect(page.locator("#choices .choice").first()).toBeEnabled();
  await expect(page.locator("#feedback-title")).toHaveText("Time!", { timeout: 15_000 });
  await expect(page.locator("#stars .star.on")).toHaveCount(0);
});

test("only serves situations for the chosen position", async ({ page }) => {
  await startSession(page, "8U–10U", "C");
  await expect(page.locator("#drill-pos")).toHaveText("You · C");
  await expect(page.locator(".pos-spot.you")).toHaveCount(1);
});
