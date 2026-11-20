"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  timerConfigSchema,
  type TimerConfig,
} from "@/lib/timers/config";
import { StartTimerDialog } from "./start-dialog";
type StartDish = { id: string; name: string };
const ConfigContext = createContext<{
  config: TimerConfig;
  error: string;
  refresh: () => Promise<void>;
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
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/timer-config", { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          "Shared timer settings are unavailable. Custom timers still work.",
        );
      const value = timerConfigSchema.parse(await response.json());
      setConfig(value);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load timer settings.",
      );
    }
  }, []);
  useEffect(() => {
    timerStore.initialize();
    const tick = () => {
      timerStore.tick();
      void alarmTick();
    };
    const interval = setInterval(tick, 500);
    const onStorage = (e: StorageEvent) => {
      if (e.key === TIMER_STORAGE_KEY) timerStore.receive(e.newValue);
    };
    const onVisible = () => {
      tick();
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("kitchen-timer-config-changed", onVisible);
    const initialRefresh = setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      clearTimeout(initialRefresh);
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("kitchen-timer-config-changed", onVisible);
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
  const path = usePathname();
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
        <Link href="/" aria-current={timerPage ? undefined : "page"}>
          <Search size={20} />
          <span>Prep book</span>
        </Link>
        <Link href="/timers" aria-current={timerPage ? "page" : undefined}>
          <Timer size={20} />
          <span>Timers{active.length ? " (" + active.length + ")" : ""}</span>
        </Link>
      </nav>
    </div>
  );
}
