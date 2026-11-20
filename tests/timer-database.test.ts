import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { schemaStatements } from "../lib/neon-schema";
import { timerSchemaStatements } from "../lib/timers/schema";
import { seedRows } from "../lib/dishes";
import source from "../data/dishes.json";
let db: PGlite;
const actor = "20000000-0000-4000-8000-000000000001",
  other = "20000000-0000-4000-8000-000000000002",
  presetId = "30000000-0000-4000-8000-000000000001";
const preset = {
  id: presetId,
  label: "Manually entered test preset",
  duration_seconds: 90,
  enabled: true,
};
let savedAt: string;
beforeAll(async () => {
  db = new PGlite();
  await db.transaction(async (tx) => {
    for (const sql of [...schemaStatements, ...timerSchemaStatements])
      await tx.query(sql);
    await tx.query("select kitchen_prep.seed_original_dishes($1)", [
      JSON.stringify(seedRows(source)),
    ]);
    await tx.query(
      "insert into kitchen_prep.timer_admins(id,username,password_hash) values($1,$2,$3)",
      [actor, "owner", "test-only-hash"],
    );
  });
});
afterAll(async () => db?.close());
describe("Neon timer administration permissions", () => {
  it("stores the exact migration and never derives timers from recipe notes", async () => {
    const sql = await readFile("db/migrations/003_timers.sql", "utf8");
    expect(
      sql
        .trim()
        .split(/\n\n-- statement-breakpoint\n\n/)
        .map((s) => s.trim()),
    ).toEqual(timerSchemaStatements.map((s) => s.trim()));
    expect(
      (await db.query("select * from kitchen_prep.timer_presets")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from kitchen_prep.dish_timer_settings")).rows,
    ).toHaveLength(0);
  });
  it("rejects unauthorised and forged administrator identities in database functions", async () => {
    await expect(
      db.query("select kitchen_prep.save_timer_preset($1,1,$2,null)", [
        other,
        JSON.stringify(preset),
      ]),
    ).rejects.toThrow(/Administrator/);
    await expect(
      db.query("select kitchen_prep.save_dish_timer($1,1,$2,true,null,null)", [
        other,
        "mongolian-beef",
      ]),
    ).rejects.toThrow(/Administrator/);
  });
  it("lets an approved administrator save a manual preset and enable one dish", async () => {
    const saved = await db.query<{
      p: { updated_at: string; duration_seconds: number };
    }>("select to_jsonb(kitchen_prep.save_timer_preset($1,1,$2,null)) as p", [
      actor,
      JSON.stringify(preset),
    ]);
    savedAt = saved.rows[0].p.updated_at;
    expect(saved.rows[0].p.duration_seconds).toBe(90);
    await db.query(
      "select kitchen_prep.save_dish_timer($1,1,$2,true,$3,null)",
      [actor, "mongolian-beef", presetId],
    );
    expect(
      (
        await db.query<{ timer_enabled: boolean }>(
          "select timer_enabled from kitchen_prep.dish_timer_settings where dish_id=$1",
          ["mongolian-beef"],
        )
      ).rows[0].timer_enabled,
    ).toBe(true);
    expect(
      (
        await db.query(
          "select * from kitchen_prep.dish_timer_settings where dish_id=$1",
          ["wonton-soup"],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("rejects stale preset edits and invalid database durations", async () => {
    const updated = { ...preset, label: "Updated manual preset" };
    await db.query("select kitchen_prep.save_timer_preset($1,1,$2,$3)", [
      actor,
      JSON.stringify(updated),
      savedAt,
    ]);
    await expect(
      db.query("select kitchen_prep.save_timer_preset($1,1,$2,$3)", [
        actor,
        JSON.stringify(preset),
        savedAt,
      ]),
    ).rejects.toThrow(/changed/);
    await expect(
      db.query("select kitchen_prep.save_timer_preset($1,1,$2,null)", [
        actor,
        JSON.stringify({ ...preset, id: other, duration_seconds: 0 }),
      ]),
    ).rejects.toThrow(/check constraint/);
  });
  it("revokes existing sessions when administrator approval or password version changes", async () => {
    await db.query(
      "update kitchen_prep.timer_admins set enabled=false where id=$1",
      [actor],
    );
    await expect(
      db.query("select kitchen_prep.save_dish_timer($1,1,$2,false,null,null)", [
        actor,
        "wonton-soup",
      ]),
    ).rejects.toThrow(/Administrator/);
    await db.query(
      "update kitchen_prep.timer_admins set enabled=true,session_version=2 where id=$1",
      [actor],
    );
    await expect(
      db.query("select kitchen_prep.assert_timer_admin($1,1)", [actor]),
    ).rejects.toThrow(/Administrator/);
  });
  it("disables a dish without altering its recipe or creating countdown rows", async () => {
    const before = (
      await db.query(
        "select to_jsonb(d) as d from kitchen_prep.dishes d where id=$1",
        ["mongolian-beef"],
      )
    ).rows;
    const current = (
      await db.query<{ stamp: string }>(
        "select updated_at::text as stamp from kitchen_prep.dish_timer_settings where dish_id=$1",
        ["mongolian-beef"],
      )
    ).rows[0];
    await db.query("select kitchen_prep.save_dish_timer($1,2,$2,false,$3,$4)", [
      actor,
      "mongolian-beef",
      presetId,
      current.stamp,
    ]);
    expect(
      (
        await db.query(
          "select to_jsonb(d) as d from kitchen_prep.dishes d where id=$1",
          ["mongolian-beef"],
        )
      ).rows,
    ).toEqual(before);
    expect(
      (
        await db.query(
          "select table_name from information_schema.tables where table_schema='kitchen_prep' and table_name in ('running_timers','countdowns')",
        )
      ).rows,
    ).toHaveLength(0);
  });
});
