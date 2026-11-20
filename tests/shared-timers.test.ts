import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { schemaStatements } from "../lib/neon-schema";
import { timerSchemaStatements } from "../lib/timers/schema";
import { sharedTimerSchemaStatements } from "../lib/timers/shared-schema";
import { seedRows } from "../lib/dishes";
import source from "../data/dishes.json";
let db: PGlite;
const id = "30000000-0000-4000-8000-000000000010";
const preset = {
  id,
  label: "Existing manual preset",
  duration_seconds: 90,
  enabled: true,
};
beforeAll(async () => {
  db = new PGlite();
  for (const s of [...schemaStatements, ...timerSchemaStatements])
    await db.query(s);
  await db.query("select kitchen_prep.seed_original_dishes($1)", [
    JSON.stringify(seedRows(source)),
  ]);
  await db.query(
    "insert into kitchen_prep.timer_presets(id,label,duration_seconds,enabled) values($1,$2,$3,$4)",
    [id, preset.label, 90, true],
  );
  await db.query(
    "insert into kitchen_prep.dish_timer_settings(dish_id,timer_enabled,preset_id) values($1,true,$2)",
    ["mongolian-beef", id],
  );
});
afterAll(async () => db.close());
it("migrates to shared editing without changing saved presets, settings or recipes", async () => {
  const before = await db.query(
    "select to_jsonb(p) as p from kitchen_prep.timer_presets p",
  );
  const beforeDishes = await db.query(
    "select to_jsonb(d) as d from kitchen_prep.dishes d order by id",
  );
  const beforeSettings = await db.query(
    "select to_jsonb(s) as s from kitchen_prep.dish_timer_settings s",
  );
  const migration = await readFile(
    "db/migrations/004_shared_timers.sql",
    "utf8",
  );
  expect(
    migration
      .trim()
      .split(/\n\n-- statement-breakpoint\n\n/)
      .map((s) => s.trim()),
  ).toEqual(sharedTimerSchemaStatements.map((s) => s.trim()));
  for (const statement of sharedTimerSchemaStatements)
    await db.query(statement);
  expect(
    (
      await db.query(
        "select to_jsonb(p) as p from kitchen_prep.timer_presets p",
      )
    ).rows,
  ).toEqual(before.rows);
  expect(
    (
      await db.query(
        "select to_jsonb(s) as s from kitchen_prep.dish_timer_settings s",
      )
    ).rows,
  ).toEqual(beforeSettings.rows);
  expect(
    (
      await db.query(
        "select to_jsonb(d) as d from kitchen_prep.dishes d order by id",
      )
    ).rows,
  ).toEqual(beforeDishes.rows);
});
it("edits presets and dish timers without any administrator account", async () => {
  expect(
    (await db.query("select * from kitchen_prep.timer_admins")).rows,
  ).toHaveLength(0);
  const current = (
    await db.query<{ p: { updated_at: string } }>(
      "select to_jsonb(p) as p from kitchen_prep.timer_presets p where id=$1",
      [id],
    )
  ).rows[0].p;
  await db.query("select kitchen_prep.save_shared_timer_preset($1,$2)", [
    JSON.stringify({ ...preset, label: "Shared edit" }),
    current.updated_at,
  ]);
  await expect(
    db.query("select kitchen_prep.save_shared_timer_preset($1,$2)", [
      JSON.stringify(preset),
      current.updated_at,
    ]),
  ).rejects.toThrow(/changed/);
  await db.query(
    "select kitchen_prep.save_shared_dish_timer($1,true,$2,null)",
    ["wonton-soup", id],
  );
  const setting = (
    await db.query<{ s: { updated_at: string } }>(
      "select to_jsonb(s) as s from kitchen_prep.dish_timer_settings s where dish_id=$1",
      ["wonton-soup"],
    )
  ).rows[0].s;
  await db.query(
    "select kitchen_prep.save_shared_dish_timer($1,false,null,$2)",
    ["wonton-soup", setting.updated_at],
  );
  await expect(
    db.query("select kitchen_prep.save_shared_dish_timer($1,true,null,$2)", [
      "wonton-soup",
      setting.updated_at,
    ]),
  ).rejects.toThrow(/changed/);
});
it("removes a preset without deleting linked dishes", async () => {
  const current = (
    await db.query<{ p: { updated_at: string } }>(
      "select to_jsonb(p) as p from kitchen_prep.timer_presets p where id=$1",
      [id],
    )
  ).rows[0].p;
  await db.query("select kitchen_prep.delete_shared_timer_preset($1,$2)", [
    id,
    current.updated_at,
  ]);
  expect(
    (await db.query("select * from kitchen_prep.timer_presets")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query<{ preset_id: string | null }>(
        "select preset_id from kitchen_prep.dish_timer_settings where dish_id=$1",
        ["mongolian-beef"],
      )
    ).rows[0].preset_id,
  ).toBeNull();
  expect(
    (await db.query("select id from kitchen_prep.dishes")).rows,
  ).toHaveLength(56);
});
