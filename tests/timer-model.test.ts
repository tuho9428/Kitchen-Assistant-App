import { describe, it, expect } from "vitest";
import {
  makeTimer,
  remainingTime,
  pauseTimer,
  resumeTimer,
  settleTimer,
  formatTimer,
} from "../lib/timers/model";
import { TimerStore, TIMER_STORAGE_KEY } from "../lib/timers/store";
describe("Absolute deadline timer model", () => {
  it("uses an absolute completion timestamp, including after a long suspended interval", () => {
    const timer = makeTimer("one", "Rice", 120, 1000);
    expect(timer.endsAt).toBe(121000);
    expect(remainingTime(timer, 66000)).toBe(55000);
    expect(settleTimer(timer, 900000).status).toBe("finished");
    expect(remainingTime(timer, 900000)).toBe(0);
  });
  it("pauses at its remaining time and resumes with a fresh absolute deadline", () => {
    const timer = makeTimer("one", "Rice", 120, 1000);
    const paused = pauseTimer(timer, 31000);
    expect(paused.status).toBe("paused");
    expect(remainingTime(paused, 999999)).toBe(90000);
    const resumed = resumeTimer(paused, 200000);
    expect(resumed.endsAt).toBe(290000);
    expect(remainingTime(resumed, 220000)).toBe(70000);
  });
  it("does not pause an already completed timer or produce negative countdowns", () => {
    const timer = makeTimer("one", "Rice", 1, 1000);
    expect(pauseTimer(timer, 3000).status).toBe("finished");
    expect(formatTimer(-30)).toBe("00:00");
    expect(formatTimer(3661000)).toBe("1:01:01");
  });
  it("rejects blank labels, fractional durations and invalid ranges", () => {
    expect(() => makeTimer("one", " ", 10, 0)).toThrow();
    for (const duration of [0, -1, 1.5, 86401, NaN])
      expect(() => makeTimer("one", "Rice", duration, 0)).toThrow();
  });
});
describe("Browser persistence and independent timers", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
  };
  it("pauses and cancels one timer without changing the others", () => {
    const storage = memory();
    const store = new TimerStore(storage);
    store.initialize(1000);
    const a = store.start("Rice", 60, null, 1000),
      b = store.start("Wings", 120, null, 1000);
    store.pause(a, 11000);
    store.tick(61000);
    expect(store.getSnapshot().timers.find((t) => t.id === a)?.status).toBe(
      "paused",
    );
    expect(
      remainingTime(
        store.getSnapshot().timers.find((t) => t.id === b)!,
        61000,
      ),
    ).toBe(60000);
    store.cancel(a);
    expect(store.getSnapshot().timers.map((t) => t.id)).toEqual([b]);
  });
  it("recovers running/paused timers after reload and marks elapsed ones ready", () => {
    const storage = memory();
    const first = new TimerStore(storage);
    first.initialize(1000);
    first.start("Done while closed", 1, null, 1000);
    const paused = first.start("Paused", 60, null, 1000);
    first.pause(paused, 11000);
    const second = new TimerStore(storage);
    second.initialize(300000);
    expect(second.getSnapshot().timers[0].status).toBe("finished");
    expect(second.getSnapshot().timers[1].remainingMs).toBe(50000);
    second.acknowledge(second.getSnapshot().timers[0].id);
    expect(
      JSON.parse(storage.data.get(TIMER_STORAGE_KEY)!).timers[0].acknowledged,
    ).toBe(true);
  });
  it("does not persist countdown ticks or mutate completion timestamps each second", () => {
    let writes = 0;
    const store = new TimerStore({
      getItem: () => null,
      setItem: () => {
        writes++;
      },
    });
    store.initialize(1000);
    store.start("Rice", 60, null, 1000);
    const afterStart = writes;
    store.tick(2000);
    store.tick(3000);
    expect(writes).toBe(afterStart);
    expect(store.getSnapshot().timers[0].endsAt).toBe(61000);
  });
  it("keeps timers usable if browser storage is blocked", () => {
    const store = new TimerStore({
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
    });
    store.initialize(1000);
    store.start("Rice", 10, null, 1000);
    expect(store.getSnapshot().timers).toHaveLength(1);
    expect(store.getSnapshot().storageError).toContain("cannot save");
  });
});
