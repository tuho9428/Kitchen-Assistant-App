import { test, expect, type Page } from "@playwright/test";
const nav = (page: Page) =>
  page.getByRole("navigation", { name: "Main bottom navigation" });
async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.getByText("Offline ready", { exact: false })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Close menu", exact: true }).click();
}
test("main tabs preserve searches and timer drafts without document reloads online, offline, or with history navigation", async ({
  page,
  context,
}) => {
  await open(page);
  let documents = 0;
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++;
  });
  await page.evaluate(() => {
    (window as unknown as { tabMarker: string }).tabMarker = "same-document";
  });
  const search = page.getByRole("textbox", {
    name: "Search dishes or ingredients",
  });
  await search.fill("mongolian");
  await page.getByRole("button", { name: "Beef", exact: true }).click();
  await nav(page)
    .getByRole("link", { name: /^Timers/ })
    .click();
  await expect(page).toHaveURL(/\/timers$/);
  await expect(
    page.getByRole("heading", { name: "Timers", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Timer name (optional)").fill("Rice draft");
  await page.getByLabel("Minutes", { exact: true }).fill("8");
  await nav(page).getByRole("link", { name: "Prep book", exact: true }).click();
  await expect(search).toHaveValue("mongolian");
  await expect(
    page.getByRole("button", { name: "Beef", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await nav(page)
    .getByRole("link", { name: /^Timers/ })
    .click();
  await expect(page.getByLabel("Timer name (optional)")).toHaveValue(
    "Rice draft",
  );
  await expect(page.getByLabel("Minutes", { exact: true })).toHaveValue("8");
  await page.goBack();
  await expect(search).toHaveValue("mongolian");
  await page.goForward();
  await expect(page.getByLabel("Timer name (optional)")).toHaveValue(
    "Rice draft",
  );
  await context.setOffline(true);
  await nav(page).getByRole("link", { name: "Prep book", exact: true }).click();
  await expect(search).toHaveValue("mongolian");
  await nav(page)
    .getByRole("link", { name: /^Timers/ })
    .click();
  await expect(page.getByLabel("Timer name (optional)")).toHaveValue(
    "Rice draft",
  );
  await expect(
    nav(page).getByRole("link", { name: /^Timers/ }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    await page.evaluate(
      () => (window as unknown as { tabMarker: string }).tabMarker,
    ),
  ).toBe("same-document");
  expect(documents).toBe(0);
  await expect(page.locator("#main")).toHaveCount(1);
});
test("inactive tab drafts expire after one hour without resetting the active prep view", async ({
  page,
}) => {
  await page.clock.install();
  await open(page);
  const search = page.getByRole("textbox", {
    name: "Search dishes or ingredients",
  });
  await search.fill("mongolian");
  await nav(page)
    .getByRole("link", { name: /^Timers/ })
    .click();
  await page.getByLabel("Timer name (optional)").fill("Expired draft");
  await nav(page).getByRole("link", { name: "Prep book", exact: true }).click();
  await page.clock.fastForward(3600001);
  await expect(search).toHaveValue("mongolian");
  await nav(page)
    .getByRole("link", { name: /^Timers/ })
    .click();
  await expect(page.getByLabel("Timer name (optional)")).toHaveValue("");
});

test("prep reads are coalesced and fresh tab switches make no extra server-action calls", async ({
  page,
}) => {
  await page.clock.install();
  let reads = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const isRead = (request: import("@playwright/test").Request) =>
    request.method() === "POST" &&
    !!request.headers()["next-action"] &&
    request.postData() === "[]";
  await page.route("**/*", async (route) => {
    if (isRead(route.request())) {
      reads++;
      await gate;
    }
    await route.continue();
  });
  await page.goto("/timers");
  await expect(
    page.getByRole("heading", { name: "Timers", exact: true }),
  ).toBeVisible();
  const firstRead = page.waitForRequest(isRead);
  await nav(page).getByRole("link", { name: "Prep book", exact: true }).click();
  await firstRead;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });
  await nav(page)
    .getByRole("link", { name: /^Timers/ })
    .click();
  await nav(page).getByRole("link", { name: "Prep book", exact: true }).click();
  await page.clock.runFor(50);
  expect(reads).toBe(1);
  release();
  await expect(page.getByRole("article").first()).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await nav(page)
      .getByRole("link", { name: /^Timers/ })
      .click();
    await nav(page)
      .getByRole("link", { name: "Prep book", exact: true })
      .click();
  }
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.clock.runFor(50);
  expect(reads).toBe(1);
  const manual = page.waitForResponse((response) => isRead(response.request()));
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await manual;
  expect(reads).toBe(2);
  const stale = page.waitForResponse((response) => isRead(response.request()));
  await page.clock.fastForward(60001);
  await stale;
  expect(reads).toBe(3);
});
