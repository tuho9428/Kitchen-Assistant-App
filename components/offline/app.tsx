"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { MainTabs } from "@/components/main-tabs";
import { Prep } from "@/components/prep";
import { subscribeToPath } from "@/lib/navigation/tabs";
import { DishTimerButton } from "@/components/timers/dish-timer-button";
import { useOffline } from "./provider";
export function OfflineApp() {
  const path = useSyncExternalStore(
    subscribeToPath,
    () => location.pathname,
    () => "/offline",
  );
  const { cachedBook, loaded } = useOffline();

  if (path === "/timers/settings" || path === "/admin/timers")
    return (
      <main id="main" className="mx-auto max-w-3xl p-5">
        <h1 className="text-2xl font-semibold">Timer settings</h1>
        <p className="my-4">
          Connect to the internet to change shared timer settings. Saved presets
          and custom timers are available offline.
        </p>
        <Link href="/timers" className="button">
          Back to timers
        </Link>
      </main>
    );
  if (path.startsWith("/dishes/")) {
    const dish = cachedBook?.data.dishes.find(
      (d) => d.id === decodeURIComponent(path.slice("/dishes/".length)),
    );
    return (
      <main id="main" className="mx-auto max-w-3xl p-5">
        <Link href="/" className="button mb-5">
          Back to prep book
        </Link>
        {dish ? (
          <>
            <Prep dish={dish} />
            <DishTimerButton dish={dish} />
          </>
        ) : (
          <p>
            {loaded
              ? "This dish is not in the saved prep book. Reconnect to load it."
              : "Loading saved dish…"}
          </p>
        )}
      </main>
    );
  }
  if (path !== "/timers" && loaded && !cachedBook)
    return (
      <main id="main" className="mx-auto max-w-3xl p-5">
        <h1 className="text-2xl font-semibold">No saved prep book</h1>
        <p className="my-4">
          Connect to the internet and open the prep book once to save dishes on
          this device.
        </p>
        <Link href="/timers" className="button">
          Open timers
        </Link>
      </main>
    );
  return <MainTabs initialPath={path === "/timers" ? "/timers" : "/"} />;
}
