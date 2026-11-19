import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  database: vi.fn(),
  query: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("../lib/database", () => ({ database: mocks.database }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveDish, favorite } from "../lib/actions";
import { seedRows } from "../lib/dishes";
import source from "../data/dishes.json";
const dish = seedRows(source)[0];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.database.mockResolvedValue({ query: mocks.query });
});
describe("No-login Neon server actions", () => {
  it("saves with parameterized SQL and no Auth lookup", async () => {
    mocks.query.mockResolvedValue([
      {
        dish: {
          ...dish,
          created_at: "2026-11-19T00:00:00Z",
          updated_at: "2026-11-19T00:00:00Z",
          updated_by: null,
        },
      },
    ]);
    expect((await saveDish(dish, null)).ok).toBe(true);
    expect(mocks.query.mock.calls[0][1]).toEqual([JSON.stringify(dish), null]);
  });
  it("rejects malformed input before accessing the database", async () => {
    expect((await saveDish({ ...dish, name: "" }, null)).ok).toBe(false);
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("returns failed saves without revalidation or success", async () => {
    mocks.query.mockRejectedValue(new Error("Connection failed"));
    expect(await saveDish(dish, null)).toEqual({
      ok: false,
      error: "Connection failed",
    });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("saves shared favorites without a user ID", async () => {
    mocks.query.mockResolvedValue([]);
    expect((await favorite(dish.id, true)).ok).toBe(true);
    expect(mocks.query).toHaveBeenCalledWith(
      "insert into kitchen_prep.favorites(dish_id) values($1) on conflict do nothing",
      [dish.id],
    );
  });
});
