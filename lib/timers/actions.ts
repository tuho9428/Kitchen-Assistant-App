"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { timerDatabase } from "./database";
import { timerPresetSchema, dishTimerSettingSchema } from "./config";
const presetInput = timerPresetSchema.omit({ updated_at: true }).strict();
const expectedSchema = z.iso.datetime({ offset: true }).nullable();
async function result<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (e) {
    return {
      ok: false as const,
      error:
        e instanceof Error
          ? e.message
          : "Could not save timer settings. Please try again.",
    };
  }
}
export async function saveTimerPreset(value: unknown, expected: string | null) {
  return result(async () => {
    const preset = presetInput.parse(value);
    expectedSchema.parse(expected);
    const sql = await timerDatabase();
    const rows = await sql.query(
      "select to_jsonb(kitchen_prep.save_shared_timer_preset($1::jsonb,$2::timestamptz)) as preset",
      [JSON.stringify(preset), expected],
    );
    const saved = timerPresetSchema.parse(rows[0]?.preset);
    revalidatePath("/timers/settings");
    return saved;
  });
}
export async function deleteTimerPreset(id: string, expected: string) {
  return result(async () => {
    z.uuid().parse(id);
    z.iso.datetime({ offset: true }).parse(expected);
    const sql = await timerDatabase();
    await sql.query(
      "select kitchen_prep.delete_shared_timer_preset($1::uuid,$2::timestamptz)",
      [id, expected],
    );
    const settings = await sql.query(
      "select to_jsonb(s) as setting from kitchen_prep.dish_timer_settings s",
    );
    revalidatePath("/timers/settings");
    return settings.map((row) => ({
      ...dishTimerSettingSchema.parse(row.setting),
      updated_at: row.setting.updated_at as string,
    }));
  });
}
export async function saveDishTimerSetting(
  value: unknown,
  expected: string | null,
) {
  return result(async () => {
    const setting = dishTimerSettingSchema.strict().parse(value);
    if (setting.preset_id && setting.default_duration_seconds !== null)
      throw new Error("Choose a saved preset or a default duration.");
    expectedSchema.parse(expected);
    const sql = await timerDatabase();
    const rows = await sql.query(
      "select to_jsonb(kitchen_prep.save_dish_timer_options($1::text,$2::boolean,$3::uuid,$4::integer,$5::timestamptz)) as setting",
      [
        setting.dish_id,
        setting.timer_enabled,
        setting.preset_id,
        setting.default_duration_seconds,
        expected,
      ],
    );
    revalidatePath("/timers/settings");
    return {
      ...dishTimerSettingSchema.parse(rows[0]?.setting),
      updated_at: rows[0].setting.updated_at as string,
    };
  });
}
