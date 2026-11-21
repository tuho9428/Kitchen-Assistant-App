import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function ready(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.getByText("Offline ready", { exact: false })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Close menu", exact: true }).click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
}
test("offline reload, cached dishes and presets, browser alarms, read-only controls and reconnect sync", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const w = window as unknown as { soundStarts: number };
    w.soundStarts = 0;
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this);
      const start = source.start.bind(source);
      source.start = (...args: Parameters<AudioBufferSourceNode["start"]>) => {
        w.soundStarts++;
        return start(...args);
      };
      return source;
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/timers/settings");
  await page
    .getByRole("textbox", { name: "Preset name", exact: true })
    .fill("Offline preset");
  await page
    .getByRole("spinbutton", { name: "Preset minutes", exact: true })
    .fill("1");
  await page.getByRole("button", { name: "Save preset", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Preset saved.");
  await page.getByLabel("Dish", { exact: true }).selectOption("wonton-soup");
  await page.getByLabel("Enable Start Timer for this dish").check();
  await page.getByLabel("Use a saved preset", { exact: true }).check();
  await page
    .getByLabel("Default preset (optional)", { exact: true })
    .selectOption({ label: "Offline preset · 01:00" });
  await page
    .getByRole("button", { name: "Save dish timer", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Dish timer setting saved.",
  );
  await ready(page);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText(
      "Offline · Lookup and timers available. Changes need internet.",
      { exact: false },
    ),
  ).toBeVisible();
  const search = page.getByRole("textbox", {
    name: "Search dishes or ingredients",
  });
  await search.fill("Wonton Soup");
  await expect(
    page.getByRole("article", { name: "Wonton Soup", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("offline-dishes-mobile.png"),
  });
  await expect(
    page.getByRole("button", { name: "Hide Wonton Soup", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Favorite Wonton Soup", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Start Timer for Wonton Soup", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Minutes", { exact: true }),
  ).toHaveValue("1");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page
    .getByRole("button", { name: "View prep for Wonton Soup", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add dish", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close menu", exact: true }).click();
  await page.goto("/dishes/wonton-soup");
  await expect(
    page.getByRole("heading", { name: "Wonton Soup", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main bottom navigation" })
    .getByRole("link", { name: /^Timers/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Timers", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main bottom navigation" })
      .getByRole("link", { name: /^Timers/ }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("button", { name: "Offline preset 01:00", exact: false }),
  ).toBeVisible();
  await page.getByLabel("Timer name (optional)").fill("Offline alarm");
  await page.getByLabel("Seconds", { exact: true }).fill("1");
  const audio = page.waitForResponse((r) =>
    r.url().endsWith("/sounds/sounds_1.mp3"),
  );
  await page
    .getByRole("button", { name: "Start custom timer", exact: true })
    .click();
  expect((await audio).fromServiceWorker()).toBe(true);
  await expect(
    page.getByRole("button", { name: "Silence Offline alarm", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { soundStarts: number }).soundStarts,
      ),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Silence Offline alarm", exact: true })
    .click();
  await page.getByLabel("Timer name (optional)").fill("Offline rice");
  await page.getByLabel("Minutes", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Start custom timer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pause Offline rice", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume Offline rice", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resume Offline rice", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel Offline rice", exact: true })
    .click();
  await page.getByRole("link", { name: "Timer settings", exact: true }).click();
  await expect(
    page.getByText("Connect to the internet to change shared timer settings.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main bottom navigation" })
    .getByRole("link", { name: "Prep book", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search dishes or ingredients" })
    .fill("Offline reconnect check");
  await expect(
    page.getByRole("heading", { name: "No dishes match yet" }),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("offline-mobile.png") });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "Open menu", exact: true }).click();
  await other.getByRole("button", { name: "Add dish", exact: true }).click();
  await other
    .getByLabel("Dish name", { exact: true })
    .fill("Offline reconnect check");
  await other.getByLabel("Category", { exact: true }).fill("Test");
  await other
    .getByRole("textbox", {
      name: "Ingredient 1 · include quantity",
      exact: true,
    })
    .fill("1 test ingredient");
  await other.getByRole("button", { name: "Save dish", exact: true }).click();
  await expect(
    other.getByRole("dialog").getByRole("heading", {
      name: "Offline reconnect check",
      exact: true,
    }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByRole("article", { name: "Offline reconnect check", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".offline-notice")).toHaveCount(0);
  await other.getByRole("button", { name: "Delete", exact: true }).click();
  await other
    .getByLabel("Type the dish name to confirm")
    .fill("Offline reconnect check");
  await other
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(other.getByRole("dialog")).toHaveCount(0);
  await otherContext.close();
  await page.goto("/timers/settings");
  await page.getByLabel("Dish", { exact: true }).selectOption("wonton-soup");
  await page.getByLabel("Enter a duration each time", { exact: true }).check();
  await page.getByLabel("Enable Start Timer for this dish").uncheck();
  await page
    .getByRole("button", { name: "Save dish timer", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Dish timer setting saved.",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete preset Offline preset", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Preset deleted");
  expect(errors).toEqual([]);
});
test("invalid cached dishes show an honest empty offline state", async ({
  page,
  context,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("kitchen-prep-offline", 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("snapshots", "readwrite");
        tx.objectStore("snapshots").put(
          { version: 1, savedAt: Date.now(), data: { dishes: "invalid" } },
          "book",
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "No saved prep book", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
});
