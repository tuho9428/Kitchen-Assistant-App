import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { schemaStatements } from "../lib/neon-schema";
import { timerSchemaStatements } from "../lib/timers/schema";
import { sharedTimerSchemaStatements } from "../lib/timers/shared-schema";
import { dishDefaultSchemaStatements } from "../lib/timers/default-schema";
import { seedRows } from "../lib/dishes";
import source from "../data/dishes.json";
let db: PGlite;
const id = "30000000-0000-4000-8000-000000000021";
beforeAll(async () => {
  db = new PGlite();
  for (const s of [
    ...schemaStatements,
    ...timerSchemaStatements,
    ...sharedTimerSchemaStatements,
  ])
    await db.query(s);
  await db.query("select kitchen_prep.seed_original_dishes($1)", [
    JSON.stringify(seedRows(source)),
  ]);
  await db.query(
    "insert into kitchen_prep.timer_presets(id,label,duration_seconds) values($1,'Shared preset',120)",
    [id],
  );
  await db.query(
    "select kitchen_prep.save_shared_dish_timer($1,true,$2,null)",
    ["mongolian-beef", id],
  );
});
afterAll(async () => db.close());
it("adds optional dish defaults without changing existing preset assignments", async () => {
  const migration = await readFile(
    "db/migrations/005_dish_timer_defaults.sql",
    "utf8",
  );
  expect(
    migration
      .trim()
      .split(/\n\n-- statement-breakpoint\n\n/)
      .map((s) => s.trim()),
  ).toEqual(dishDefaultSchemaStatements.map((s) => s.trim()));
  for (const s of dishDefaultSchemaStatements) await db.query(s);
  const settings = await db.query<{
    preset_id: string;
    default_duration_seconds: number | null;
  }>(
    "select preset_id,default_duration_seconds from kitchen_prep.dish_timer_settings where dish_id=$1",
    ["mongolian-beef"],
  );
  expect(settings.rows[0]).toEqual({
    preset_id: id,
    default_duration_seconds: null,
  });
});
it("saves a dish-specific duration atomically without changing the reusable preset", async () => {
  const old = (
    await db.query<{ s: { updated_at: string } }>(
      "select to_jsonb(s) as s from kitchen_prep.dish_timer_settings s where dish_id=$1",
      ["mongolian-beef"],
    )
  ).rows[0].s;
  const saved = await db.query<{
    s: { preset_id: string | null; default_duration_seconds: number };
  }>(
    "select to_jsonb(kitchen_prep.save_dish_timer_options($1,true,null,195,$2)) as s",
    ["mongolian-beef", old.updated_at],
  );
  expect(saved.rows[0].s.preset_id).toBeNull();
  expect(saved.rows[0].s.default_duration_seconds).toBe(195);
  expect(
    (
      await db.query<{ duration_seconds: number }>(
        "select duration_seconds from kitchen_prep.timer_presets where id=$1",
        [id],
      )
    ).rows[0].duration_seconds,
  ).toBe(120);
  await expect(
    db.query(
      "select kitchen_prep.save_dish_timer_options($1,true,$2,null,$3)",
      ["mongolian-beef", id, old.updated_at],
    ),
  ).rejects.toThrow(/changed/);
});
it("rejects invalid or simultaneous defaults and supports removing the default", async () => {
  await expect(
    db.query(
      "select kitchen_prep.save_dish_timer_options($1,true,null,0,null)",
      ["wonton-soup"],
    ),
  ).rejects.toThrow(/check constraint/);
  await expect(
    db.query(
      "select kitchen_prep.save_dish_timer_options($1,true,$2,120,null)",
      ["wonton-soup", id],
    ),
  ).rejects.toThrow(/Choose/);
  expect(
    (
      await db.query(
        "select * from kitchen_prep.dish_timer_settings where dish_id=$1",
        ["wonton-soup"],
      )
    ).rows,
  ).toHaveLength(0);
  const old = (
    await db.query<{ s: { updated_at: string } }>(
      "select to_jsonb(s) as s from kitchen_prep.dish_timer_settings s where dish_id=$1",
      ["mongolian-beef"],
    )
  ).rows[0].s;
  const saved = await db.query<{
    s: { preset_id: string | null; default_duration_seconds: number | null };
  }>(
    "select to_jsonb(kitchen_prep.save_dish_timer_options($1,true,null,null,$2)) as s",
    ["mongolian-beef", old.updated_at],
  );
  expect(saved.rows[0].s.preset_id).toBeNull();
  expect(saved.rows[0].s.default_duration_seconds).toBeNull();
});
