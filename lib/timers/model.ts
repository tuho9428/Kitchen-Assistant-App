import { z } from "zod";
export const MAX_TIMER_SECONDS = 86400;
export const timerSchema = z
  .object({
    id: z.string().min(1).max(120),
    label: z.string().trim().min(1).max(100),
    dishId: z.string().nullable(),
    durationMs: z
      .number()
      .int()
      .min(1000)
      .max(MAX_TIMER_SECONDS * 1000),
    status: z.enum(["running", "paused", "finished"]),
    endsAt: z.number().int().nonnegative().nullable(),
    remainingMs: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_TIMER_SECONDS * 1000),
    createdAt: z.number().int().nonnegative(),
    acknowledged: z.boolean(),
  })
  .strict()
  .refine(
    (t) => t.status !== "running" || t.endsAt !== null,
    "Running timers need a deadline",
  )
  .refine(
    (t) => t.status !== "paused" || (t.endsAt === null && t.remainingMs > 0),
    "Invalid paused timer",
  );
export type KitchenTimer = z.infer<typeof timerSchema>;
export const savedTimersSchema = z
  .object({ version: z.literal(1), timers: z.array(timerSchema).max(50) })
  .strict()
  .refine(
    (s) => new Set(s.timers.map((t) => t.id)).size === s.timers.length,
    "Duplicate timer IDs",
  );
export function makeTimer(
  id: string,
  label: string,
  seconds: number,
  now: number,
  dishId: string | null = null,
): KitchenTimer {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_TIMER_SECONDS)
    throw new Error("Enter a duration between 1 second and 24 hours.");
  return timerSchema.parse({
    id,
    label,
    dishId,
    durationMs: seconds * 1000,
    status: "running",
    endsAt: now + seconds * 1000,
    remainingMs: seconds * 1000,
    createdAt: now,
    acknowledged: false,
  });
}
export function remainingTime(timer: KitchenTimer, now: number) {
  return timer.status === "running"
    ? Math.max(0, (timer.endsAt ?? now) - now)
    : timer.status === "paused"
      ? timer.remainingMs
      : 0;
}
export function settleTimer(timer: KitchenTimer, now: number): KitchenTimer {
  return timer.status === "running" && remainingTime(timer, now) === 0
    ? { ...timer, status: "finished", remainingMs: 0, acknowledged: false }
    : timer;
}
export function pauseTimer(timer: KitchenTimer, now: number): KitchenTimer {
  const current = settleTimer(timer, now);
  return current.status === "running"
    ? {
        ...current,
        status: "paused",
        endsAt: null,
        remainingMs: remainingTime(current, now),
      }
    : current;
}
export function resumeTimer(timer: KitchenTimer, now: number): KitchenTimer {
  return timer.status === "paused"
    ? { ...timer, status: "running", endsAt: now + timer.remainingMs }
    : timer;
}
export function formatTimer(milliseconds: number) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const seconds = String(total % 60).padStart(2, "0");
  const minutes = String(Math.floor(total / 60) % 60).padStart(2, "0");
  const hours = Math.floor(total / 3600);
  return hours
    ? hours + ":" + minutes + ":" + seconds
    : minutes + ":" + seconds;
}
