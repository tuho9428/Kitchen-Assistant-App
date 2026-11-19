import { describe, it, expect } from "vitest";
import { suggestDishes } from "../lib/search-suggestions";
import { seedRows, type Dish } from "../lib/dishes";
import source from "../data/dishes.json";
const dishes: Dish[] = seedRows(source).map((d) => ({
  ...d,
  created_at: "2026-11-19T00:00:00Z",
  updated_at: "2026-11-19T00:00:00Z",
  updated_by: null,
}));
describe("Dish autocomplete", () => {
  it("matches partial names and multi-term queries case-insensitively", () => {
    expect(suggestDishes(dishes, "MONGO")[0].id).toBe("mongolian-beef");
    expect(suggestDishes(dishes, "  beef MONGO  ").map((d) => d.id)).toEqual([
      "mongolian-beef",
    ]);
  });
  it("recommends actual dishes from ingredient searches", () => {
    expect(suggestDishes(dishes, "lianzi").map((d) => d.name)).toContain(
      "Forbidden Fried Rice",
    );
  });
  it("ranks names ahead of ingredient-only matches without changing the source array", () => {
    const original = [...dishes];
    const results = suggestDishes(dishes, "beef");
    expect(results[0].name.toLowerCase().startsWith("beef")).toBe(true);
    expect(dishes).toEqual(original);
    expect(results.length).toBeLessThanOrEqual(5);
  });
  it("does not add unavailable candidates or suggest anything for blank/unknown searches", () => {
    expect(suggestDishes(dishes, " ")).toEqual([]);
    expect(suggestDishes(dishes, "no-such-dish")).toEqual([]);
    expect(
      suggestDishes(
        dishes.filter((d) => d.id !== "mongolian-beef"),
        "mongolian beef",
      ),
    ).toEqual([]);
  });
});
