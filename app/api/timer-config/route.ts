import { NextResponse } from "next/server";
import { timerDatabase } from "@/lib/timers/database";
import { timerConfigSchema } from "@/lib/timers/config";
export async function GET() {
  try {
    const sql = await timerDatabase();
    const [presets, settings] = await Promise.all([
      sql.query(
        "select id,label,duration_seconds,enabled,updated_at::text from kitchen_prep.timer_presets where enabled=true order by label",
      ),
      sql.query(
        "select dish_id,timer_enabled,preset_id,default_duration_seconds from kitchen_prep.dish_timer_settings",
      ),
    ]);
    return NextResponse.json(
      timerConfigSchema.parse({ configured: true, presets, settings }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Timer settings are unavailable. Custom timers still work." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
