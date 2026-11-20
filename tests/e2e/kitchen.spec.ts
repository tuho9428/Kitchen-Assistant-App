import { test, expect, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import AxeBuilder from "@axe-core/playwright";

async function checkAccessibility(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
}
async function openBook(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Search dishes or ingredients" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toHaveCount(0);
}

test("no-login mobile lookup, filters, favorites and practice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBook(page);
  const search = page.getByRole("textbox", {
    name: "Search dishes or ingredients",
  });
  await search.fill("MONGO beef");
  await expect(
    page.getByRole("heading", { name: "Mongolian Beef", exact: true }),
  ).toBeVisible();
  const card = page.getByRole("article", {
    name: "Mongolian Beef",
    exact: true,
  });
  const firstGroup = card.getByRole("region", {
    name: "Prep group 1 for Mongolian Beef",
    exact: true,
  });
  const secondGroup = card.getByRole("region", {
    name: "Prep group 2 for Mongolian Beef",
    exact: true,
  });
  await expect(firstGroup.getByText("Beef", { exact: true })).toBeVisible();
  await expect(firstGroup.getByText("M", { exact: true })).toBeVisible();
  await expect(secondGroup.getByText("L", { exact: true })).toBeVisible();
  await expect(
    secondGroup.getByText("Red onion", { exact: true }),
  ).toBeVisible();
  await expect(
    secondGroup.getByText("Green onion", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("mobile-card-groups.png"),
  });
  await page
    .getByRole("button", { name: "View prep for Mongolian Beef" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Red onion", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Green onion", { exact: true })).toBeVisible();
  await expect(dialog.getByText("M", { exact: true })).toBeVisible();
  await checkAccessibility(page);
  await page.screenshot({ path: test.info().outputPath("mobile-prep.png") });
  await dialog
    .getByRole("button", { name: "Save favorite", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Menu options" })
    .getByRole("button", { name: "Favorites", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mongolian Beef", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Menu options" })
    .getByRole("button", { name: "Practice", exact: true })
    .click();
  await expect(
    page.getByText("Which ingredients would you hand to the chef?"),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Preparation groups · Labels refer to prep containers, not servings.",
    ),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal ingredients" }).click();
  await expect(
    page.getByText(
      "Preparation groups · Labels refer to prep containers, not servings.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Another dish" }).click();
  await expect(
    page.getByRole("button", { name: "Reveal ingredients" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Menu options" })
    .getByRole("button", { name: "All dishes", exact: true })
    .click();
  await page.getByRole("button", { name: "Beef", exact: true }).click();
  await search.fill("not-a-dish");
  await expect(
    page.getByRole("heading", { name: "No dishes match yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(search).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath("mobile-lookup.png") });
});
test("shared edits persist across sessions; failed save keeps draft; delete requires confirmation", async ({
  page,
  browser,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    }),
  );
  await openBook(page);
  await page
    .getByRole("textbox", { name: "Search dishes or ingredients" })
    .fill("Mongolian Beef");
  await page
    .getByRole("button", { name: "View prep for Mongolian Beef" })
    .click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await checkAccessibility(page);
  const text = page
    .getByRole("textbox", {
      name: "Ingredient 1 · include quantity",
      exact: true,
    })
    .first();
  await text.fill("Beef — test prep quantity");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Discard your unsaved changes?")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(text).toHaveValue("Beef — test prep quantity");
  await page.route("**/*", (route) =>
    route.request().method() === "POST" &&
    route.request().headers()["next-action"]
      ? route.abort()
      : route.continue(),
  );
  await page.getByRole("button", { name: "Save dish", exact: true }).click();
  await expect(
    page.getByText(
      "Connection lost. Your draft is still here. Try saving again.",
    ),
  ).toBeVisible();
  await expect(text).toHaveValue("Beef — test prep quantity");
  await page.unroute("**/*");
  await page.getByRole("button", { name: "Save dish", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Beef — test prep quantity", { exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 2; i++) {
    const seeded = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "scripts/seed.ts"],
      {
        env: {
          ...process.env,
          DATABASE_URL: "postgresql://test:test@localhost/test",
          KITCHEN_TEST_BUILD: "1",
          NEON_TEST_ENDPOINT: "http://127.0.0.1:54329/sql",
        },
      },
    );
    expect(seeded.stdout).toContain("Inserted 0 dishes");
  }
  const context = await browser.newContext();
  const other = await context.newPage();
  await openBook(other);
  await other.goto("/dishes/mongolian-beef");
  await expect(
    other.getByText("Beef — test prep quantity", { exact: true }),
  ).toBeVisible();
  await context.close();
  if (await page.getByRole("dialog").count())
    await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("button", { name: "Add dish", exact: true }).click();
  await page
    .getByLabel("Dish name", { exact: true })
    .fill("Temporary test dish");
  await page.getByLabel("Category", { exact: true }).fill("Test");
  await page
    .getByRole("textbox", {
      name: "Ingredient 1 · include quantity",
      exact: true,
    })
    .fill("1 test ingredient");
  await page.getByRole("button", { name: "Save dish", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Temporary test dish", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete permanently" }),
  ).toBeDisabled();
  await page
    .getByLabel("Type the dish name to confirm")
    .fill("Temporary test dish");
  await expect(
    page.getByLabel("Administrator password", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("validated backup export, preview and safe default import", async ({
  page,
}) => {
  await openBook(page);
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("button", { name: "Backup and restore" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.version).toBe(1);
  expect(backup.dishes.length).toBe(56);
  const original = backup.dishes.find(
    (d: { id: string }) => d.id === "mongolian-beef",
  );
  const imported = {
    ...original,
    id: "browser-import-test",
    name: "Backup import test",
  };
  const changed = {
    ...original,
    notes: ["This changed version should be skipped"],
  };
  await page.getByLabel("Backup file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...backup, dishes: [imported, changed] }),
    ),
  });
  await expect(
    page.getByRole("heading", { name: "Import preview" }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("button", { name: "Import new dishes only" }).click();
  await expect(
    page.getByText("Imported 1 dish.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/dishes/browser-import-test");
  await expect(
    page.getByRole("heading", { name: "Backup import test" }),
  ).toBeVisible();
  await page.goto("/dishes/mongolian-beef");
  await expect(
    page.getByText("This changed version should be skipped"),
  ).toHaveCount(0);
});
test("shared controls, favorites and direct details work without accounts", async ({
  page,
  browser,
}) => {
  await openBook(page);
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add dish", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Backup and restore" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close menu", exact: true }).click();
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  const context = await browser.newContext();
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: "Open menu", exact: true }).click();
  await second
    .getByRole("navigation", { name: "Menu options" })
    .getByRole("button", { name: "Favorites", exact: true })
    .click();
  await expect(
    second.getByRole("heading", { name: "Mongolian Beef", exact: true }),
  ).toBeVisible();
  await context.close();
  await page.goto("/dishes/mongolian-beef");
  await expect(
    page.getByText("Beef — test prep quantity", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
});

test("hiding removes a dish without deleting it and persists across sessions", async ({
  page,
  browser,
}) => {
  await openBook(page);
  await page
    .getByRole("textbox", { name: "Search dishes or ingredients" })
    .fill("Mongolian Beef");
  const card = page.getByRole("article", {
    name: "Mongolian Beef",
    exact: true,
  });
  await card
    .getByRole("button", { name: "Hide Mongolian Beef", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("textbox", { name: "Search dishes or ingredients" })
    .fill("Mongolian Beef");
  await expect(card).toHaveCount(0);
  await page.goto("/dishes/mongolian-beef");
  await expect(
    page.getByRole("heading", { name: "Mongolian Beef", exact: true }),
  ).toBeVisible();
  const context = await browser.newContext();
  const other = await context.newPage();
  await openBook(other);
  await other.getByRole("button", { name: "Open menu", exact: true }).click();
  await other
    .getByRole("button", { name: "Hidden dishes (1)", exact: true })
    .click();
  const hidden = other.getByRole("article", {
    name: "Mongolian Beef",
    exact: true,
  });
  await expect(hidden.getByText("Green onion", { exact: true })).toBeVisible();
  await hidden
    .getByRole("button", { name: "Restore Mongolian Beef", exact: true })
    .click();
  await expect(hidden).toHaveCount(0);
  await expect(
    other.getByRole("heading", { name: "No hidden dishes" }),
  ).toBeVisible();
  await other.getByRole("button", { name: "Open menu", exact: true }).click();
  await other
    .getByRole("button", { name: "Back to dishes", exact: true })
    .click();
  await other
    .getByRole("textbox", { name: "Search dishes or ingredients" })
    .fill("Mongolian Beef");
  await expect(
    other.getByRole("article", { name: "Mongolian Beef", exact: true }),
  ).toBeVisible();
  await context.close();
});

test("compact menu toggles and cards start near the top", async ({ page }) => {
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await openBook(page);
    await expect(
      page.getByRole("navigation", { name: "Menu options" }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Add dish", exact: true }),
    ).toHaveCount(0);
    const card = page.getByRole("article").first();
    expect((await card.boundingBox())!.y).toBeLessThan(230);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Add dish", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("navigation", { name: "Menu options" }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Open menu", exact: true }),
    ).toBeFocused();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath("compact-mobile.png") });
});

test("recent searches can be reused, navigated by keyboard and cleared", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBook(page);
  const search = page.getByRole("textbox", {
    name: "Search dishes or ingredients",
  });
  await search.fill("Mongolian Beef");
  await page
    .getByRole("button", { name: "View prep for Mongolian Beef", exact: true })
    .click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await search.focus();
  const history = page.getByRole("region", {
    name: "Recent searches",
    exact: true,
  });
  await expect(history).toBeVisible();
  const recent = history.getByRole("button", {
    name: "Search again: Mongolian Beef",
    exact: true,
  });
  await expect(recent).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("recent-searches.png"),
  });
  await recent.click();
  await expect(search).toHaveValue("Mongolian Beef");
  await expect(history).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "Mongolian Beef", exact: true }),
  ).toBeVisible();
  await search.fill("");
  await search.press("ArrowDown");
  await expect(recent).toBeFocused();
  await recent.press("Escape");
  await expect(search).toBeFocused();
  await expect(history).toHaveCount(0);
  await search.click();
  await history
    .getByRole("button", { name: "Clear search history", exact: true })
    .click();
  await page.reload();
  await search.focus();
  await expect(history).toHaveCount(0);
});

test("dish recommendations open prep directly by name, ingredient or keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBook(page);
  const search = page.getByRole("textbox", {
    name: "Search dishes or ingredients",
  });
  await search.fill("mongo");
  const suggestions = page.getByRole("region", {
    name: "Suggested dishes",
    exact: true,
  });
  await expect(suggestions).toBeVisible();
  const first = suggestions.getByRole("button", {
    name: "Open prep for Mongolian Beef",
    exact: true,
  });
  await expect(first).toBeVisible();
  await search.press("ArrowDown");
  await expect(first).toBeFocused();
  await first.press("Enter");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Mongolian Beef", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await search.fill("lianzi");
  await suggestions
    .getByRole("button", {
      name: "Open prep for Forbidden Fried Rice",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Forbidden Fried Rice", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await search.fill("beef");
  await expect(
    suggestions.getByRole("button", { name: /Open prep for/ }),
  ).toHaveCount(5);
  await page.screenshot({
    path: test.info().outputPath("search-suggestions.png"),
  });
  await search.press("Escape");
  await expect(suggestions).toHaveCount(0);
  await search.fill("no-such-dish");
  await expect(suggestions).toHaveCount(0);
});
