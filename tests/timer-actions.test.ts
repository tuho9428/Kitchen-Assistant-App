import { it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ database: vi.fn(), revalidate: vi.fn() }));
vi.mock("../lib/timers/database", () => ({ timerDatabase: mocks.database }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import {
  saveTimerPreset,
  deleteTimerPreset,
  saveDishTimerSetting,
} from "../lib/timers/actions";
it("rejects invalid shared timer settings before accessing Neon", async () => {
  for (const result of [
    await saveTimerPreset({}, null),
    await deleteTimerPreset("invalid", "invalid"),
    await saveDishTimerSetting({}, null),
  ])
    expect(result.ok).toBe(false);
  expect(mocks.database).not.toHaveBeenCalled();
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
