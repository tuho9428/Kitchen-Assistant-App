import { neon } from "@neondatabase/serverless";
import { describe, it, expect } from "vitest";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("Optional live Neon persistence", () => {
  it("shares a temporary edit across separate clients", async () => {
    const a = neon(url!),
      b = neon(url!);
    const id = "integration-" + crypto.randomUUID();
    const dish = {
      id,
      name: "Temporary integration dish",
      category: "Test",
      groups: [{ size: "Kit", ingredients: ["Test only"] }],
      notes: [],
      source_page: null,
    };
    try {
      await a.query("select kitchen_prep.save_dish($1,null)", [
        JSON.stringify(dish),
      ]);
      expect(
        (
          await b.query("select name from kitchen_prep.dishes where id=$1", [
            id,
          ])
        )[0].name,
      ).toBe(dish.name);
    } finally {
      await a.query("delete from kitchen_prep.dishes where id=$1", [id]);
    }
  });
});
