import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { schemaStatements } from "../lib/neon-schema";
import { hiddenSchemaStatements } from "../lib/hidden-schema";
import { seedRows } from "../lib/dishes";
import source from "../data/dishes.json";
let db: PGlite;
const dish = seedRows(source).find((d) => d.id === "mongolian-beef")!;
beforeAll(async () => {
  db = new PGlite();
  await db.transaction(async (tx) => {
    for (const sql of [...schemaStatements, ...hiddenSchemaStatements])
      await tx.query(sql);
    await tx.query("select kitchen_prep.seed_original_dishes($1)", [
      JSON.stringify(seedRows(source)),
    ]);
  });
});
afterAll(async () => db?.close());
async function save(d: unknown, expected: string | null) {
  return (
    await db.query<{ v: { updated_at: string; notes: string[] } }>(
      "select to_jsonb(kitchen_prep.save_dish($1,$2)) as v",
      [JSON.stringify(d), expected],
    )
  ).rows[0].v;
}
describe("Shared Neon PostgreSQL database", () => {
  it("bundles the exact SQL migration and seeds all 56 originals", async () => {
    const migration = await readFile(
      "db/migrations/001_shared_prep.sql",
      "utf8",
    );
    expect(
      migration
        .trim()
        .split(/\n\n-- statement-breakpoint\n\n/)
        .map((s) => s.trim()),
    ).toEqual(schemaStatements.map((s) => s.trim()));
    const rows = (
      await db.query(
        "select id,name,category,groups,notes,source_page from kitchen_prep.dishes order by id",
      )
    ).rows;
    expect(rows).toHaveLength(56);
    expect(rows).toEqual(
      seedRows(source).sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
  it("persists shared edits and rejects stale versions", async () => {
    const first = (
      await db.query<{ v: { updated_at: string } }>(
        "select to_jsonb(d) as v from kitchen_prep.dishes d where id=$1",
        [dish.id],
      )
    ).rows[0].v;
    const saved = await save(
      { ...dish, notes: ["Saved in Neon"] },
      first.updated_at,
    );
    expect(saved.notes).toEqual(["Saved in Neon"]);
    await expect(save(dish, first.updated_at)).rejects.toThrow(/changed/);
  });
  it("shares favorites independently of accounts", async () => {
    await db.query("insert into kitchen_prep.favorites values($1)", [dish.id]);
    expect(
      (await db.query("select * from kitchen_prep.favorites")).rows,
    ).toEqual([{ dish_id: dish.id }]);
  });
  it("creates and deletes dishes and cascades favorite removal", async () => {
    const d = { ...dish, id: "temporary-shared" };
    const saved = await save(d, null);
    await db.query("insert into kitchen_prep.favorites values($1)", [d.id]);
    await db.query("select kitchen_prep.delete_dish($1,$2)", [
      d.id,
      saved.updated_at,
    ]);
    expect(
      (
        await db.query(
          "select * from kitchen_prep.favorites where dish_id=$1",
          [d.id],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("rolls back an entire import if a reviewed dish changed", async () => {
    const r = (
      await db.query<{ v: { updated_at: string } }>(
        "select to_jsonb(d) as v from kitchen_prep.dishes d where id=$1",
        [dish.id],
      )
    ).rows[0].v;
    await save({ ...dish, notes: ["Newer update"] }, r.updated_at);
    await expect(
      db.query("select kitchen_prep.import_dishes($1,true)", [
        JSON.stringify([
          { dish: { ...dish, id: "aaa-new" }, expected: null },
          { dish, expected: r.updated_at },
        ]),
      ]),
    ).rejects.toThrow(/changed/);
    expect(
      (await db.query("select * from kitchen_prep.dishes where id='aaa-new'"))
        .rows,
    ).toHaveLength(0);
  });
  it("does not overwrite edits or resurrect deleted originals when seeded again", async () => {
    await db.query("delete from kitchen_prep.dishes where id=$1", [
      "hot-sour-soup",
    ]);
    const seeded = await db.query<{ n: number }>(
      "select kitchen_prep.seed_original_dishes($1) as n",
      [JSON.stringify(seedRows(source))],
    );
    expect(seeded.rows[0].n).toBe(0);
    expect(
      (
        await db.query(
          "select * from kitchen_prep.dishes where id='hot-sour-soup'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ notes: string[] }>(
          "select notes from kitchen_prep.dishes where id=$1",
          [dish.id],
        )
      ).rows[0].notes,
    ).toEqual(["Newer update"]);
  });
  it("hides and restores a dish without changing its recipe or favorites", async () => {
    const before = (
      await db.query(
        "select to_jsonb(d) as dish from kitchen_prep.dishes d where id=$1",
        [dish.id],
      )
    ).rows;
    await db.query(
      "insert into kitchen_prep.hidden_dishes(dish_id) values($1)",
      [dish.id],
    );
    expect(
      (await db.query("select dish_id from kitchen_prep.hidden_dishes")).rows,
    ).toEqual([{ dish_id: dish.id }]);
    expect(
      (
        await db.query(
          "select to_jsonb(d) as dish from kitchen_prep.dishes d where id=$1",
          [dish.id],
        )
      ).rows,
    ).toEqual(before);
    expect(
      (
        await db.query(
          "select * from kitchen_prep.favorites where dish_id=$1",
          [dish.id],
        )
      ).rows,
    ).toHaveLength(1);
    await db.query("delete from kitchen_prep.hidden_dishes where dish_id=$1", [
      dish.id,
    ]);
    expect(
      (await db.query("select * from kitchen_prep.hidden_dishes")).rows,
    ).toHaveLength(0);
  });
});
