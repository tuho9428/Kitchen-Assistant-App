import { describe, it, expect } from "vitest";
import { addRecent, recentTerms } from "../lib/recent-searches";
describe("Recent search history", () => {
  it("keeps six most recent distinct terms", () => {
    let terms: string[] = [];
    for (let i = 0; i < 9; i++) terms = addRecent(terms, "Dish " + i);
    expect(terms).toEqual([
      "Dish 8",
      "Dish 7",
      "Dish 6",
      "Dish 5",
      "Dish 4",
      "Dish 3",
    ]);
  });
  it("moves repeated searches to the front without duplicates or blank entries", () => {
    expect(addRecent(["Beef", "Soup"], " beef  ")).toEqual(["beef", "Soup"]);
    expect(addRecent(["Beef"], "   ")).toEqual(["Beef"]);
  });
  it("handles malformed or unsupported saved history", () => {
    for (const value of [
      null,
      [],
      { version: 2, terms: ["Beef"] },
      { version: 1, terms: "bad" },
    ])
      expect(recentTerms(value)).toEqual([]);
    expect(
      recentTerms({
        version: 1,
        terms: ["  Beef  ", null, "beef", "Soup", ""],
      }),
    ).toEqual(["Beef", "Soup"]);
  });
});
