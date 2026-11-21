import { test, expect, type Page } from "@playwright/test";
const config = (label: string) => ({
  configured: true,
  presets: [
    {
      id: "30000000-0000-4000-8000-000000000088",
      label,
      duration_seconds: 120,
      enabled: true,
      updated_at: "2026-11-20T00:00:00Z",
    },
  ],
  settings: [],
});
const button = (page: Page, label: string) =>
  page.getByRole("button", { name: label + " 02:00", exact: false });
async function persistedLabel(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string | null>((resolve, reject) => {
        const req = indexedDB.open("kitchen-prep-offline", 1);
        req.onsuccess = () => {
          const db = req.result;
          const get = db
            .transaction("snapshots")
            .objectStore("snapshots")
            .get("timer-config");
          get.onsuccess = () => {
            resolve(get.result?.data?.presets?.[0]?.label ?? null);
            db.close();
          };
          get.onerror = () => reject(get.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
}
test("timer settings use an hour cache across focus, tab switches and reload, with forced invalidation", async ({
  page,
  context,
}) => {
  await page.clock.install();
  let reads = 0;
  let label = "Cached preset";
  await context.route("**/api/timer-config", async (route) => {
    reads++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "private, max-age=3600" },
      body: JSON.stringify(config(label)),
    });
  });
  await page.goto("/timers");
  await expect(button(page, "Cached preset")).toBeVisible();
  await expect.poll(() => persistedLabel(page)).toBe("Cached preset");
  expect(reads).toBe(1);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page
      .getByRole("navigation", { name: "Main bottom navigation" })
      .getByRole("link", { name: "Prep book", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Main bottom navigation" })
      .getByRole("link", { name: /^Timers/ })
      .click();
  }
  await page.clock.runFor(50);
  expect(reads).toBe(1);
  await page.reload();
  await expect(button(page, "Cached preset")).toBeVisible();
  await page.clock.runFor(50);
  expect(reads).toBe(1);
  await page
    .getByRole("button", { name: "Refresh presets", exact: true })
    .click();
  await expect.poll(() => reads).toBe(2);
  await expect(
    page.getByRole("button", { name: "Refresh presets", exact: true }),
  ).toBeEnabled();
  label = "Saved change";
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("kitchen-timer-config-changed"));
  });
  await expect(button(page, "Saved change")).toBeVisible();
  expect(reads).toBe(3);
  await expect.poll(() => persistedLabel(page)).toBe("Saved change");
  const other = await context.newPage();
  await other.goto("/timers");
  await expect(button(other, "Saved change")).toBeVisible();
  expect(reads).toBe(3);
  label = "Other tab change";
  await other.evaluate(() =>
    localStorage.setItem(
      "kitchen-prep:timer-config-revision",
      "test-change-" + Date.now(),
    ),
  );
  await expect(button(page, "Other tab change")).toBeVisible();
  expect(reads).toBe(4);
  await other.close();
  const expired = page.waitForResponse((r) =>
    r.url().endsWith("/api/timer-config"),
  );
  await page.clock.fastForward(3600001);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expired;
  expect(reads).toBe(5);
  // Wait for persistence so reconnect is a distinct forced read.
  await expect.poll(() => persistedLabel(page)).toBe("Other tab change");
  const online = page.waitForResponse((r) =>
    r.url().endsWith("/api/timer-config"),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await online;
  expect(reads).toBe(6);
});
test("focus bursts share one pending request and a settings save during it fetches the newer config", async ({
  page,
  context,
}) => {
  let reads = 0;
  let label = "Before save";
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route("**/api/timer-config", async (route) => {
    reads++;
    const body = JSON.stringify(config(label));
    if (reads === 1) await gate;
    await route.fulfill({ status: 200, contentType: "application/json", body });
  });
  const initial = page.waitForRequest((r) =>
    r.url().endsWith("/api/timer-config"),
  );
  await page.goto("/timers");
  await initial;
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    }
  });
  expect(reads).toBe(1);
  label = "After save";
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("kitchen-timer-config-changed"));
  });
  release();
  await expect(button(page, "After save")).toBeVisible();
  expect(reads).toBe(2);
});

test("a saved-change revision invalidates the cached config after an interrupted navigation refresh", async ({
  page,
  context,
}) => {
  let reads = 0;
  let label = "Before navigation";
  await context.route("**/api/timer-config", async (route) => {
    reads++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(config(label)),
    });
  });
  await page.goto("/timers");
  await expect(button(page, "Before navigation")).toBeVisible();
  await expect.poll(() => persistedLabel(page)).toBe("Before navigation");
  label = "Saved before reload";
  await page.evaluate(() =>
    localStorage.setItem(
      "kitchen-prep:timer-config-revision",
      "saved-before-navigation",
    ),
  );
  await page.reload();
  await expect(button(page, "Saved before reload")).toBeVisible();
  expect(reads).toBe(2);
});
