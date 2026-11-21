/* Offline copies are read-only. POSTs and database responses are never queued. */
const PREFIX = "kitchen-prep-offline-v1-";
const META = PREFIX + "meta";
const POINTER = "/__kitchen_offline_current__";
let preparing;
async function currentCache() {
  const meta = await caches.open(META);
  const pointer = await meta.match(POINTER);
  return pointer ? caches.open(await pointer.text()) : null;
}
async function prepare() {
  if (preparing) return preparing;
  preparing = (async () => {
    const response = await fetch("/offline", { cache: "no-store" });
    if (!response.ok) throw new Error("Offline page unavailable");
    const html = await response.clone().text();
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html)),
      ),
      (v) => v.toString(16).padStart(2, "0"),
    )
      .join("")
      .slice(0, 20);
    const name = PREFIX + hash;
    const cache = await caches.open(name);
    if (await cache.match("/offline")) {
      const meta = await caches.open(META);
      await meta.put(POINTER, new Response(name));
      for (const client of await self.clients.matchAll({
        includeUncontrolled: true,
      }))
        client.postMessage({ type: "KITCHEN_OFFLINE_READY" });
      return;
    }
    const urls = new Set([
      "/sounds/sounds_1.mp3",
      "/manifest.webmanifest",
      "/icons/kitchen-192.png",
      "/icons/kitchen-512.png",
    ]);
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const url = new URL(
        match[1].replaceAll("&amp;", "&"),
        self.location.origin,
      );
      if (
        url.origin === self.location.origin &&
        url.pathname.startsWith("/_next/static/")
      )
        urls.add(url.href);
    }
    if (![...urls].some((url) => url.includes("/_next/static/")))
      throw new Error("Offline assets missing");
    await Promise.all(
      [...urls].map(async (url) => {
        const asset = await fetch(url, { cache: "reload" });
        if (!asset.ok) throw new Error("Offline asset unavailable");
        if (asset.headers.get("content-type")?.includes("text/css")) {
          const css = await asset.clone().text();
          await Promise.all(
            [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(
              async (match) => {
                const font = new URL(match[1], asset.url);
                if (
                  font.origin !== self.location.origin ||
                  font.protocol === "data:"
                )
                  return;
                const res = await fetch(font);
                if (!res.ok) throw new Error("Font unavailable");
                await cache.put(font, res);
              },
            ),
          );
        }
        await cache.put(url, asset);
      }),
    );
    await cache.put("/offline", response);
    const meta = await caches.open(META);
    await meta.put(POINTER, new Response(name));
    // Keep one previous complete copy for pages still open during an update.
    const keys = (await caches.keys()).filter(
      (key) => key.startsWith(PREFIX) && key !== META && key !== name,
    );
    const complete = [];
    for (const key of keys) {
      const old = await caches.open(key);
      if (await old.match("/offline")) complete.push(key);
      else await caches.delete(key);
    }
    await Promise.all(complete.slice(0, -1).map((key) => caches.delete(key)));
    for (const client of await self.clients.matchAll({
      includeUncontrolled: true,
    }))
      client.postMessage({ type: "KITCHEN_OFFLINE_READY" });
  })().finally(() => {
    preparing = null;
  });
  return preparing;
}
self.addEventListener("install", (event) =>
  event.waitUntil(prepare().then(() => self.skipWaiting())),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "PREPARE_KITCHEN_OFFLINE")
    event.waitUntil(
      prepare().catch(async () => {
        if (await currentCache())
          event.source?.postMessage({ type: "KITCHEN_OFFLINE_READY" });
      }),
    );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
          const response = await fetch(request, { signal: controller.signal });
          if (response.ok) return response;
          throw new Error("Unavailable");
        } catch {
          const cache = await currentCache();
          const fallback = await cache?.match("/offline");
          return (
            fallback ||
            new Response(
              "Open Kitchen Prep online once to save it for offline use.",
              { status: 503, headers: { "Content-Type": "text/plain" } },
            )
          );
        } finally {
          clearTimeout(timeout);
        }
      })(),
    );
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/sounds/") ||
    url.pathname.startsWith("/icons/")
  )
    event.respondWith(
      (async () => {
        const cache = await currentCache();
        const cached = await cache?.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok && cache) await cache.put(request, response.clone());
          return response;
        } catch {
          const old = await caches.match(request);
          return old || Response.error();
        }
      })(),
    );
});
