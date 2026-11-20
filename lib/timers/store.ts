import {
  makeTimer,
  pauseTimer,
  resumeTimer,
  savedTimersSchema,
  settleTimer,
  type KitchenTimer,
} from "./model";
export const TIMER_STORAGE_KEY = "kitchen-prep:timers:v1";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export type TimerSnapshot = {
  timers: KitchenTimer[];
  now: number;
  ready: boolean;
  soundReady: boolean;
  storageError: string | null;
};
export const EMPTY_TIMERS: TimerSnapshot = {
  timers: [],
  now: 0,
  ready: false,
  soundReady: false,
  storageError: null,
};
export class TimerStore {
  private snapshot: TimerSnapshot = EMPTY_TIMERS;
  private listeners = new Set<() => void>();
  constructor(private storage?: StorageLike | null) {}
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => EMPTY_TIMERS;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: TimerSnapshot, persist = false) {
    if (persist) {
      try {
        if (!this.storage) throw new Error("Storage blocked");
        this.storage.setItem(
          TIMER_STORAGE_KEY,
          JSON.stringify({ version: 1, timers: next.timers }),
        );
        next = { ...next, storageError: null };
      } catch {
        next = {
          ...next,
          storageError:
            "Timers are running, but this browser cannot save them for reload.",
        };
      }
    }
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
  initialize(now = Date.now()) {
    if (this.snapshot.ready) {
      this.tick(now);
      return;
    }
    let raw: string | null = null;
    let error: string | null = null;
    try {
      if (this.storage === undefined) this.storage = window.localStorage;
      raw = this.storage?.getItem(TIMER_STORAGE_KEY) ?? null;
    } catch {
      this.storage = null;
      error = "Browser storage is blocked. Keep this tab open for your timers.";
    }
    try {
      const saved = raw ? savedTimersSchema.parse(JSON.parse(raw)).timers : [];
      this.publish({
        ...this.snapshot,
        timers: saved.map((t) => settleTimer(t, now)),
        now,
        ready: true,
        storageError: error,
      });
    } catch {
      this.publish({
        ...this.snapshot,
        ready: true,
        now,
        storageError:
          "Saved timer data could not be read. Start a new timer below.",
      });
    }
  }
  receive(raw: string | null, now = Date.now()) {
    try {
      const timers = raw ? savedTimersSchema.parse(JSON.parse(raw)).timers : [];
      this.publish({
        ...this.snapshot,
        timers: timers.map((t) => settleTimer(t, now)),
        now,
        ready: true,
      });
    } catch {
      /* Do not discard active timers because another tab wrote invalid data. */
    }
  }
  tick(now = Date.now()) {
    const timers = this.snapshot.timers.map((t) => settleTimer(t, now));
    const changed = timers.some((t, i) => t !== this.snapshot.timers[i]);
    this.publish({ ...this.snapshot, timers, now }, changed);
  }
  start(
    label: string,
    seconds: number,
    dishId: string | null = null,
    now = Date.now(),
  ) {
    if (!this.snapshot.ready) this.initialize(now);
    if (this.snapshot.timers.length >= 50)
      throw new Error("Clear completed timers before adding more.");
    const id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "timer-" +
          Array.from(crypto.getRandomValues(new Uint32Array(4)), (v) =>
            v.toString(36),
          ).join("-");
    const timer = makeTimer(id, label, seconds, now, dishId);
    this.publish(
      { ...this.snapshot, timers: [...this.snapshot.timers, timer], now },
      true,
    );
    return id;
  }
  pause(id: string, now = Date.now()) {
    this.publish(
      {
        ...this.snapshot,
        timers: this.snapshot.timers.map((t) =>
          t.id === id ? pauseTimer(t, now) : t,
        ),
        now,
      },
      true,
    );
  }
  resume(id: string, now = Date.now()) {
    this.publish(
      {
        ...this.snapshot,
        timers: this.snapshot.timers.map((t) =>
          t.id === id ? resumeTimer(t, now) : t,
        ),
        now,
      },
      true,
    );
  }
  cancel(id: string) {
    this.publish(
      {
        ...this.snapshot,
        timers: this.snapshot.timers.filter((t) => t.id !== id),
      },
      true,
    );
  }
  acknowledge(id: string) {
    this.publish(
      {
        ...this.snapshot,
        timers: this.snapshot.timers.map((t) =>
          t.id === id && t.status === "finished"
            ? { ...t, acknowledged: true }
            : t,
        ),
      },
      true,
    );
  }
  clearFinished() {
    this.publish(
      {
        ...this.snapshot,
        timers: this.snapshot.timers.filter((t) => t.status !== "finished"),
      },
      true,
    );
  }
  setSoundReady(value: boolean) {
    if (this.snapshot.soundReady !== value)
      this.publish({ ...this.snapshot, soundReady: value });
  }
}
export const timerStore = new TimerStore();
