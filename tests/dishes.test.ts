import { describe, it, expect } from "vitest";
import source from "../data/dishes.json";
import {
  seedRows,
  matches,
  backupSchema,
  previewImport,
  dishSchema,
  type Dish,
} from "../lib/dishes";
const rows = seedRows(source);
const stamp = "2026-11-18T12:00:00.000Z";
const stored = rows.map((d) => ({
  ...d,
  created_at: stamp,
  updated_at: stamp,
  updated_by: null,
}));
describe("Original recipes and search", () => {
  it("preserves every source value through the explicit adapter", () => {
    expect(rows).toHaveLength(56);
    expect(new Set(rows.map((d) => d.category)).size).toBe(8);
    rows.forEach((d, i) => {
      const { sourcePage, ...rest } = source[i];
      expect(d).toEqual({ ...rest, source_page: sourcePage });
    });
  });
  it("finds Mongolian Beef by partial mixed-case name and ingredient terms in any order", () => {
    const mongolian = rows.find((d) => d.id === "mongolian-beef")!;
    expect(matches(mongolian, "  MONGO beef ")).toBe(true);
    expect(matches(mongolian, "green RED oni")).toBe(true);
    expect(matches(mongolian, "beef mushroom")).toBe(false);
    expect(matches(mongolian, "")).toBe(true);
    expect(mongolian.groups).toEqual([
      { size: "M", ingredients: ["Beef"] },
      { size: "L", ingredients: ["Red onion", "Green onion"] },
    ]);
  });
  it("rejects duplicate IDs, missing rows and invalid source structure", () => {
    expect(() => seedRows(source.slice(1))).toThrow();
    expect(() => seedRows([...source.slice(1), source[1]])).toThrow();
    expect(() =>
      seedRows([{ ...source[0], unexpected: true }, ...source.slice(1)]),
    ).toThrow();
  });
});
describe("Backup and editor validation", () => {
  const backup = { version: 1, exported_at: stamp, dishes: stored };
  it("round-trips content without changing quantities, group labels, unicode or notes", () => {
    const d: Dish = {
      ...stored[0],
      groups: [
        {
          label: "Inside",
          size: "Bowl",
          ingredients: ["  2 pieces\nJalapeño  "],
        },
      ],
      notes: ["Add last — a little bit"],
    };
    const b = { ...backup, dishes: [d] };
    expect(backupSchema.parse(JSON.parse(JSON.stringify(b)))).toEqual(b);
  });
  it("rejects malformed and duplicate backups", () => {
    expect(backupSchema.safeParse({ ...backup, version: 2 }).success).toBe(
      false,
    );
    expect(
      backupSchema.safeParse({ ...backup, dishes: [stored[0], stored[0]] })
        .success,
    ).toBe(false);
    expect(
      backupSchema.safeParse({
        ...backup,
        dishes: [{ ...stored[0], groups: "invalid" }],
      }).success,
    ).toBe(false);
  });
  it("shows new, changed and unchanged without treating timestamps as recipe changes", () => {
    const incoming = [
      { ...stored[0], updated_at: "2026-11-18T13:00:00.000Z" },
      { ...stored[1], notes: ["Add last"] },
      { ...stored[2], id: "new-dish" },
    ];
    expect(previewImport(stored, incoming).map((v) => v.status)).toEqual([
      "unchanged",
      "changed",
      "new",
    ]);
    expect(previewImport(stored, incoming)[1].expected).toBe(stamp);
  });
  it("rejects empty ingredients and invalid pages without trimming valid quantities", () => {
    expect(
      dishSchema.safeParse({
        ...rows[0],
        groups: [{ size: "S", ingredients: [" "] }],
      }).success,
    ).toBe(false);
    expect(dishSchema.safeParse({ ...rows[0], source_page: 0 }).success).toBe(
      false,
    );
    expect(
      dishSchema.safeParse({
        ...rows[0],
        groups: [{ size: "S", ingredients: [" 2 beef "] }],
      }).success,
    ).toBe(true);
  });
});
