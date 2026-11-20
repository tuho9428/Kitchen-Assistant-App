import { TimerSettings } from "@/components/timers/settings";
import { timerDatabase } from "@/lib/timers/database";
import { timerPresetSchema, dishTimerSettingSchema } from "@/lib/timers/config";
export const dynamic = "force-dynamic";
export default async function Page() {
  const sql = await timerDatabase();
  const [presets, settings, dishes] = await Promise.all([
    sql.query(
      "select to_jsonb(p) as preset from kitchen_prep.timer_presets p order by label",
    ),
    sql.query(
      "select to_jsonb(s) as setting from kitchen_prep.dish_timer_settings s",
    ),
    sql.query("select id,name,category from kitchen_prep.dishes order by name"),
  ]);
  return (
    <TimerSettings
      initialPresets={presets.map((r) => timerPresetSchema.parse(r.preset))}
      initialSettings={settings.map((r) => ({
        ...dishTimerSettingSchema.parse(r.setting),
        updated_at: r.setting.updated_at as string,
      }))}
      dishes={dishes.map((d) => ({
        id: d.id as string,
        name: d.name as string,
        category: d.category as string,
      }))}
    />
  );
}
