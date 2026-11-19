"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database } from "./database";
import { dishSchema, backupSchema, inputOf, storedDishSchema } from "./dishes";
async function result<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (e) {
    return {
      ok: false as const,
      error:
        e instanceof Error
          ? e.message
          : "Could not connect to the shared prep book. Please try again.",
    };
  }
}
export async function loadData() {
  return result(async () => {
    const sql = await database();
    const [rows, favorites, hidden] = await Promise.all([
      sql.query(
        "select to_jsonb(d) as dish from kitchen_prep.dishes d order by name",
      ),
      sql.query("select dish_id from kitchen_prep.favorites order by dish_id"),
      sql.query(
        "select dish_id from kitchen_prep.hidden_dishes order by dish_id",
      ),
    ]);
    return {
      dishes: rows.map((r) => storedDishSchema.parse(r.dish)),
      favorites: favorites.map((r) => r.dish_id as string),
      hidden: hidden.map((r) => r.dish_id as string),
    };
  });
}
export async function saveDish(value: unknown, expected: string | null) {
  return result(async () => {
    const dish = dishSchema.parse(value);
    z.iso.datetime({ offset: true }).nullable().parse(expected);
    const sql = await database();
    const rows = await sql.query(
      "select to_jsonb(kitchen_prep.save_dish($1::jsonb,$2::timestamptz)) as dish",
      [JSON.stringify(dish), expected],
    );
    const saved = storedDishSchema.parse(rows[0]?.dish);
    revalidatePath("/");
    revalidatePath("/dishes/" + dish.id);
    return saved;
  });
}
export async function deleteDish(id: string, expected: string) {
  return result(async () => {
    dishSchema.shape.id.parse(id);
    z.iso.datetime({ offset: true }).parse(expected);
    const sql = await database();
    await sql.query("select kitchen_prep.delete_dish($1,$2::timestamptz)", [
      id,
      expected,
    ]);
    revalidatePath("/");
  });
}
export async function favorite(id: string, on: boolean) {
  return result(async () => {
    dishSchema.shape.id.parse(id);
    z.boolean().parse(on);
    const sql = await database();
    if (on)
      await sql.query(
        "insert into kitchen_prep.favorites(dish_id) values($1) on conflict do nothing",
        [id],
      );
    else
      await sql.query("delete from kitchen_prep.favorites where dish_id=$1", [
        id,
      ]);
  });
}
export async function exportBackup() {
  return result(async () => {
    const sql = await database();
    const rows = await sql.query(
      "select to_jsonb(d) as dish from kitchen_prep.dishes d order by name",
    );
    return backupSchema.parse({
      version: 1,
      exported_at: new Date().toISOString(),
      dishes: rows.map((r) => r.dish),
    });
  });
}
export async function importBackup(
  value: unknown,
  expected: Record<string, string | null>,
  overwrite: boolean,
) {
  return result(async () => {
    const backup = backupSchema.parse(value);
    z.record(z.string(), z.iso.datetime({ offset: true }).nullable()).parse(
      expected,
    );
    z.boolean().parse(overwrite);
    const rows = backup.dishes.map((d) => ({
      dish: inputOf(d),
      expected: expected[d.id] ?? null,
    }));
    const sql = await database();
    const result = await sql.query(
      "select kitchen_prep.import_dishes($1::jsonb,$2::boolean) as count",
      [JSON.stringify(rows), overwrite],
    );
    revalidatePath("/");
    return result[0].count as number;
  });
}

export async function setDishHidden(id: string, hidden: boolean) {
  return result(async () => {
    dishSchema.shape.id.parse(id);
    z.boolean().parse(hidden);
    const sql = await database();
    if (hidden)
      await sql.query(
        "insert into kitchen_prep.hidden_dishes(dish_id) values($1) on conflict do nothing",
        [id],
      );
    else
      await sql.query(
        "delete from kitchen_prep.hidden_dishes where dish_id=$1",
        [id],
      );
    revalidatePath("/");
  });
}
