import { z } from "zod";
export const timerPresetSchema = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1).max(100),
  duration_seconds: z.number().int().min(1).max(86400),
  enabled: z.boolean(),
  updated_at: z.string(),
});
export type TimerPreset = z.infer<typeof timerPresetSchema>;
export const dishTimerSettingSchema = z.object({
  dish_id: z.string().min(1).max(120),
  timer_enabled: z.boolean(),
  preset_id: z.uuid().nullable(),
  default_duration_seconds: z
    .number()
    .int()
    .min(1)
    .max(86400)
    .nullable()
    .default(null),
});
export type DishTimerSetting = z.infer<typeof dishTimerSettingSchema>;
export const timerConfigSchema = z.object({
  configured: z.boolean(),
  presets: z.array(timerPresetSchema).max(200),
  settings: z.array(dishTimerSettingSchema).max(5000),
});
export type TimerConfig = z.infer<typeof timerConfigSchema>;
export const EMPTY_TIMER_CONFIG: TimerConfig = {
  configured: false,
  presets: [],
  settings: [],
};
