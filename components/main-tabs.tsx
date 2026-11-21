"use client";
import {
  Activity,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Kitchen } from "@/components/kitchen";
import { TimersPage } from "@/components/timers/timers-page";
import type { OfflineBook } from "@/lib/offline/storage";
import {
  TAB_CACHE_MS,
  TAB_LEAVING_EVENT,
  subscribeToPath,
} from "@/lib/navigation/tabs";
export function MainTabs({
  initial = null,
  initialError = "",
  initialPath = "/",
}: {
  initial?: OfflineBook | null;
  initialError?: string;
  initialPath?: string;
}) {
  const path = useSyncExternalStore(
    subscribeToPath,
    () => location.pathname,
    () => initialPath,
  );
  const timers = path === "/timers";
  const [keys, setKeys] = useState({ prep: 0, timers: 0 });
  const positions = useRef<Record<string, number>>({});
  useEffect(() => {
    const leaving = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; scrollY: number }>)
        .detail;
      positions.current[detail.path] = detail.scrollY;
    };
    window.addEventListener(TAB_LEAVING_EVENT, leaving);
    return () => window.removeEventListener(TAB_LEAVING_EVENT, leaving);
  }, []);
  useEffect(() => {
    const inactive = timers ? "prep" : "timers";
    const expire = setTimeout(() => {
      setKeys((old) => ({ ...old, [inactive]: old[inactive] + 1 }));
      positions.current[timers ? "/" : "/timers"] = 0;
    }, TAB_CACHE_MS);
    const restore = requestAnimationFrame(() =>
      window.scrollTo(0, positions.current[path] ?? 0),
    );
    return () => {
      clearTimeout(expire);
      cancelAnimationFrame(restore);
    };
  }, [path, timers]);
  return (
    <div data-kitchen-tabs="true">
      <Activity mode={timers ? "hidden" : "visible"}>
        <Kitchen
          active={!timers}
          key={keys.prep}
          initial={initial}
          initialError={initialError}
        />
      </Activity>
      <Activity mode={timers ? "visible" : "hidden"}>
        <TimersPage active={timers} key={keys.timers} />
      </Activity>
    </div>
  );
}
