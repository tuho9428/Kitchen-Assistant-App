import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function custom(page: Page, name: string, seconds: string) {
  await page.getByLabel("Timer name (optional)").fill(name);
  await page.getByLabel("Seconds", { exact: true }).fill(seconds);
  await page
    .getByRole("button", { name: "Start custom timer", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: name + " timer", exact: true }),
  ).toBeVisible();
}
async function refreshSharedTimers(page: Page) {
  await page.goto("/timers");
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/timer-config"),
  );
  await page
    .getByRole("button", { name: "Refresh presets", exact: true })
    .click();
  await (await response).finished();
  await expect(
    page.getByRole("button", { name: "Refresh presets", exact: true }),
  ).toBeEnabled();
}
test("custom concurrent timers persist across navigation, pause independently and recover elapsed time", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/timers");
  await custom(page, "Rice", "50");
  await custom(page, "Eggs", "40");
  const rice = page.getByRole("article", { name: "Rice timer", exact: true });
  await rice.getByRole("button", { name: "Pause Rice", exact: true }).click();
  const paused = await rice.getByLabel("Time remaining for Rice").textContent();
  await page.clock.install();
  await page.clock.fastForward(10000);
  await expect(rice.getByLabel("Time remaining for Rice")).toHaveText(paused!);
  await expect(page.getByLabel("Time remaining for Eggs")).not.toHaveText(
    "00:40",
  );
  await page
    .getByRole("navigation", { name: "Main bottom navigation" })
    .getByRole("link", { name: "Prep book" })
    .click();
  await expect(
    page.getByRole("link", { name: "View running timers" }),
  ).toBeVisible();
  await page.goto("/dishes/mongolian-beef");
  await expect(
    page.getByRole("link", { name: "View running timers" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View running timers" }).click();
  await expect(rice.getByText("Paused", { exact: true })).toBeVisible();
  await rice.getByRole("button", { name: "Resume Rice" }).click();
  await page.getByRole("button", { name: "Cancel Eggs", exact: true }).click();
  await expect(page.getByRole("article", { name: "Eggs timer" })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(rice.getByText("Running", { exact: true })).toBeVisible();
  // Simulate a sleeping browser: advance the wall clock past the stored deadline.
  await page.clock.setSystemTime(new Date(Date.now() + 120000));
  await page.clock.fastForward(1000);
  await expect(rice.getByText("Time’s up", { exact: true })).toBeVisible();
  await rice.getByRole("button", { name: "Silence Rice" }).click();
  await expect(
    page.getByRole("link", { name: "View running timers" }),
  ).toHaveCount(0);
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
  await page.screenshot({ path: "outputs/timers-mobile.png" });
});
test("expiry invokes audio and silencing stops repeats", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      audioStarts: number;
      audioDuration: number;
    };
    w.audioStarts = 0;
    w.audioDuration = 0;
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this);
      const start = source.start.bind(source);
      source.start = (...args: Parameters<AudioBufferSourceNode["start"]>) => {
        w.audioStarts++;
        w.audioDuration = source.buffer?.duration ?? 0;
        return start(...args);
      };
      return source;
    };
  });
  const mp3 = page.waitForResponse((r) =>
    r.url().endsWith("/sounds/sounds_1.mp3"),
  );
  await page.goto("/timers");
  await custom(page, "Short alarm", "1");
  expect((await mp3).ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: "Silence Short alarm" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { audioStarts: number }).audioStarts,
      ),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { audioDuration: number }).audioDuration,
    ),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Silence Short alarm" }).click();
  const starts = await page.evaluate(
    () => (window as unknown as { audioStarts: number }).audioStarts,
  );
  await page.clock.install();
  await page.clock.fastForward(6000);
  expect(
    await page.evaluate(
      () => (window as unknown as { audioStarts: number }).audioStarts,
    ),
  ).toBe(starts);
});
test("everyone can manage manual presets and dish switches; disabling keeps existing timers", async ({
  page,
  browser,
}) => {
  await page.goto("/dishes/mongolian-beef");
  await expect(
    page.getByRole("button", { name: "Start Timer for Mongolian Beef" }),
  ).toHaveCount(0);
  await page.goto("/timers/settings");
  await expect(
    page.getByRole("heading", { name: "New preset", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Administrator password", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Preset name", { exact: true })
    .fill("Manual test preset");
  await page.getByLabel("Preset minutes", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Save preset", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Preset saved.");
  await page.getByLabel("Dish", { exact: true }).selectOption("mongolian-beef");
  await page.getByLabel("Enable Start Timer for this dish").check();
  await page.getByLabel("Use a saved preset", { exact: true }).check();
  await page
    .getByLabel("Default preset (optional)")
    .selectOption({ label: "Manual test preset · 02:00" });
  await page
    .getByRole("button", { name: "Save dish timer", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Dish timer setting saved.",
  );
  const ctx = await browser.newContext();
  const user = await ctx.newPage();
  await user.goto("/dishes/mongolian-beef");
  await user
    .getByRole("button", { name: "Start Timer for Mongolian Beef" })
    .click();
  await expect(
    user.getByRole("dialog").getByLabel("Minutes", { exact: true }),
  ).toHaveValue("2");
  await user
    .getByRole("dialog")
    .getByRole("button", { name: "Start Timer", exact: true })
    .click();
  await expect(
    user.getByRole("link", { name: "View running timers" }),
  ).toBeVisible();
  await user.goto("/timers/settings");
  await expect(
    user.getByRole("heading", { name: "New preset", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Set a default duration for this dish", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Save dish timer", exact: true })
    .click();
  await expect(
    page.getByText("Enter a default duration between 1 second and 24 hours.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Default minutes", { exact: true }).fill("3");
  await page.getByLabel("Default seconds", { exact: true }).fill("15");
  await page
    .getByRole("button", { name: "Save dish timer", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Dish timer setting saved.",
  );
  await page.reload();
  await page.getByLabel("Dish", { exact: true }).selectOption("mongolian-beef");
  await expect(
    page.getByLabel("Set a default duration for this dish", { exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("Default minutes", { exact: true })).toHaveValue(
    "3",
  );
  await expect(page.getByLabel("Default seconds", { exact: true })).toHaveValue(
    "15",
  );
  // Another isolated browser represents a different device: refresh its one-hour cache explicitly.
  await refreshSharedTimers(user);
  await user.goto("/dishes/mongolian-beef");
  await user
    .getByRole("button", { name: "Start Timer for Mongolian Beef" })
    .click();
  await expect(
    user.getByRole("dialog").getByLabel("Minutes", { exact: true }),
  ).toHaveValue("3");
  await expect(
    user.getByRole("dialog").getByLabel("Seconds", { exact: true }),
  ).toHaveValue("15");
  await user
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  expect(
    await user.evaluate(
      () =>
        JSON.parse(localStorage.getItem("kitchen-prep:timers:v1")!).timers[0]
          .durationMs,
    ),
  ).toBe(120000);
  await page.getByLabel("Use a saved preset", { exact: true }).check();
  await page
    .getByLabel("Default preset (optional)", { exact: true })
    .selectOption({ label: "Manual test preset · 02:00" });
  await page
    .getByRole("button", { name: "Save dish timer", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Dish timer setting saved.",
  );
  // Another isolated browser represents a different device: refresh its one-hour cache explicitly.
  await refreshSharedTimers(user);
  await user.goto("/dishes/mongolian-beef");
  await user
    .getByRole("button", { name: "Start Timer for Mongolian Beef" })
    .click();
  await expect(
    user.getByRole("dialog").getByLabel("Minutes", { exact: true }),
  ).toHaveValue("2");
  await user
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.getByLabel("Enable Start Timer for this dish").uncheck();
  await page
    .getByRole("button", { name: "Save dish timer", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Dish timer setting saved.",
  );
  // Another isolated browser represents a different device: refresh its one-hour cache explicitly.
  await refreshSharedTimers(user);
  await user.goto("/dishes/mongolian-beef");
  await expect(
    user.getByRole("button", { name: "Start Timer for Mongolian Beef" }),
  ).toHaveCount(0);
  await expect(
    user.getByRole("link", { name: "View running timers" }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete preset Manual test preset" })
    .click();
  await expect(page.getByRole("status")).toContainText("Preset deleted");
  // Deletion returns fresh concurrency tokens, so the assigned dish can save immediately.
  await page
    .getByRole("button", { name: "Save dish timer", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Dish timer setting saved.",
  );
  await ctx.close();
});

test("old settings links open the shared settings without a login", async ({
  page,
}) => {
  await page.goto("/admin/timers");
  await expect(page).toHaveURL(/\/timers\/settings$/);
  await expect(
    page.getByRole("heading", { name: "Timer settings", exact: true }),
  ).toBeVisible();
  await expect(page.locator("input[type=password]")).toHaveCount(0);
});
