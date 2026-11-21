"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Timer, Search, BellRing, BellOff } from "lucide-react";
import { timerStore, TIMER_STORAGE_KEY } from "@/lib/timers/store";
import { remainingTime, formatTimer } from "@/lib/timers/model";
import { alarmTick, enableTimerSound } from "@/lib/timers/sound";
import {
  EMPTY_TIMER_CONFIG,
  TIMER_CONFIG_CACHE_MS,
  TIMER_CONFIG_CHANGE_KEY,
  timerConfigSchema,
  type TimerConfig,
} from "@/lib/timers/config";
import {
  configRevision,
  isCurrentConfigRecord,
} from "@/lib/timers/config-cache";
import { readRecord, saveRecord } from "@/lib/offline/storage";
import { subscribeToPath } from "@/lib/navigation/tabs";
import { StartTimerDialog } from "./start-dialog";
type StartDish = { id: string; name: string };
const ConfigContext = createContext<{
  config: TimerConfig;
  error: string;
  refresh: (force?: boolean) => Promise<void>;
  openDish: (dish: StartDish) => void;
}>({
  config: EMPTY_TIMER_CONFIG,
  error: "",
  refresh: async () => {},
  openDish: () => {},
});
export function useTimerSettings() {
  return useContext(ConfigContext);
}
export function useTimers() {
  return useSyncExternalStore(
    timerStore.subscribe,
    timerStore.getSnapshot,
    timerStore.getServerSnapshot,
  );
}
export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<TimerConfig>(EMPTY_TIMER_CONFIG);
  const [error, setError] = useState("");
  const [dish, setDish] = useState<StartDish | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const restored = useRef(false);
  const validatedAt = useRef(0);
  const attemptedAt = useRef(0);
  const invalidate = useRef(false);
  const fingerprint = useRef("");
  const refresh = useCallback(async function refreshConfig(
    force = false,
  ): Promise<void> {
    if (force) invalidate.current = true;
    if (inFlight.current) return inFlight.current;
    const request = (async () => {
      const apply = (value: TimerConfig) => {
        const next = JSON.stringify(value);
        if (next !== fingerprint.current) {
          fingerprint.current = next;
          setConfig(value);
        }
      };
      if (!restored.current) {
        try {
          const saved = await readRecord("timer-config", timerConfigSchema);
          if (saved) {
            apply(saved.data);
            if (isCurrentConfigRecord(saved))
              validatedAt.current = saved.savedAt;
            else invalidate.current = true;
          }
        } catch {
        } finally {
          restored.current = true;
        }
      }
      do {
        if (!navigator.onLine) return;
        const forced = invalidate.current;
        invalidate.current = false;
        const now = Date.now();
        const age = now - validatedAt.current;
        if (
          !forced &&
          validatedAt.current &&
          age >= 0 &&
          age < TIMER_CONFIG_CACHE_MS
        )
          return;
        if (!forced && attemptedAt.current && now - attemptedAt.current < 30000)
          return;
        attemptedAt.current = now;
        const revision = configRevision();
        try {
          const response = await fetch("/api/timer-config", {
            cache: forced ? "no-store" : "default",
          });
          if (!response.ok)
            throw new Error(
              "Shared timer settings are unavailable. Custom timers still work.",
            );
          const value = timerConfigSchema.parse(await response.json());
          apply(value);
          validatedAt.current = Date.now();
          if (revision !== configRevision()) invalidate.current = true;
          setError("");
          try {
            const saved = await saveRecord("timer-config", value, revision);
            if (isCurrentConfigRecord(saved))
              window.dispatchEvent(new Event("kitchen-offline-config-saved"));
          } catch {}
        } catch (e) {
          setError(
            fingerprint.current
              ? "Using saved timer presets until the connection returns."
              : e instanceof Error
                ? e.message
                : "Could not load timer settings.",
          );
          break;
        }
      } while (invalidate.current);
    })();
    inFlight.current = request;
    try {
      await request;
    } finally {
      if (inFlight.current === request) {
        inFlight.current = null;
        if (invalidate.current && navigator.onLine) await refreshConfig();
      }
    }
  }, []);
  useEffect(() => {
    timerStore.initialize();
    const tick = () => {
      timerStore.tick();
      void alarmTick();
    };
    const interval = setInterval(tick, 500);
    const configPoll = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === TIMER_STORAGE_KEY) timerStore.receive(e.newValue);
      if (e.key === TIMER_CONFIG_CHANGE_KEY) void refresh(true);
    };
    const onVisible = () => {
      tick();
      if (document.visibilityState === "visible") void refresh();
    };
    const onChanged = () => {
      tick();
      void refresh(true);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onChanged);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("kitchen-timer-config-changed", onChanged);
    const initialRefresh = setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      clearTimeout(initialRefresh);
      clearInterval(interval);
      clearInterval(configPoll);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onChanged);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("kitchen-timer-config-changed", onChanged);
    };
  }, [refresh]);
  const context = useMemo(
    () => ({ config, error, refresh, openDish: setDish }),
    [config, error, refresh],
  );
  return (
    <ConfigContext.Provider value={context}>
      <TimerChrome>{children}</TimerChrome>
      {dish && <StartTimerDialog dish={dish} onClose={() => setDish(null)} />}
    </ConfigContext.Provider>
  );
}
function TimerChrome({ children }: { children: React.ReactNode }) {
  const snapshot = useTimers();
  // Next navigation triggers a render; defer URL-based highlights until hydration.
  usePathname();
  const browserPath = useSyncExternalStore(
    subscribeToPath,
    () => window.location.pathname,
    () => null,
  );
  const path = browserPath;
  const timers = snapshot.timers;
  const timerPage =
    path?.startsWith("/timers") || path?.startsWith("/admin/timers");
  const running = timers
    .filter((t) => t.status === "running")
    .sort((a, b) => (a.endsAt ?? 0) - (b.endsAt ?? 0));
  const pending = timers.filter(
    (t) => t.status === "finished" && !t.acknowledged,
  );
  const active = timers.filter(
    (t) => t.status !== "finished" || !t.acknowledged,
  );
  const next = running[0];
  return (
    <div
      className={"timer-shell " + (active.length ? "has-active-timers" : "")}
    >
      {children}
      {active.length > 0 && (
        <div
          className={"timer-indicator " + (pending.length ? "timer-alarm" : "")}
        >
          <Link
            href="/timers"
            className="flex items-center gap-3 min-w-0 flex-1 min-h-11"
            aria-label="View running timers"
          >
            <Timer size={20} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {pending.length
                ? pending.length +
                  " timer" +
                  (pending.length === 1 ? "" : "s") +
                  " ready"
                : next
                  ? next.label
                  : active.length + " paused"}
              {running.length > 1 && (
                <span className="ml-2 text-sm">+{running.length - 1}</span>
              )}
            </span>
            <strong className="tabular-nums">
              {pending.length
                ? "Ready"
                : next
                  ? formatTimer(remainingTime(next, snapshot.now))
                  : "Paused"}
            </strong>
          </Link>
          {!snapshot.soundReady && (
            <button
              className="iconbutton shrink-0"
              aria-label="Enable alarm sound"
              onClick={() => {
                void enableTimerSound();
              }}
            >
              <BellOff size={20} />
            </button>
          )}
          {snapshot.soundReady && (
            <BellRing
              size={17}
              className="shrink-0"
              aria-label="Sound enabled"
            />
          )}
        </div>
      )}
      <nav className="timer-bottom-nav" aria-label="Main bottom navigation">
        <Link
          prefetch={true}
          href="/"
          aria-current={path && !timerPage ? "page" : undefined}
        >
          <Search size={20} />
          <span>Prep book</span>
        </Link>
        <Link
          prefetch={true}
          href="/timers"
          aria-current={timerPage ? "page" : undefined}
        >
          <Timer size={20} />
          <span>Timers{active.length ? " (" + active.length + ")" : ""}</span>
        </Link>
      </nav>
    </div>
  );
}
