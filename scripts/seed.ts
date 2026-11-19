import { neon, neonConfig } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
import { seedRows } from "../lib/dishes";
import { schemaStatements } from "../lib/neon-schema";
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL in .env.local");
if (process.env.KITCHEN_TEST_BUILD === "1" && process.env.NEON_TEST_ENDPOINT) {
  const u = new URL(process.env.NEON_TEST_ENDPOINT);
  if (u.hostname !== "127.0.0.1")
    throw new Error("Test endpoint must be loopback");
  neonConfig.fetchEndpoint = u.href;
}
const sql = neon(process.env.DATABASE_URL);
const rows = seedRows(
  JSON.parse(await readFile(process.argv[2] ?? "data/dishes.json", "utf8")),
);
const transaction = await sql.transaction([
  ...schemaStatements.map((s) => sql.query(s)),
  sql.query("select kitchen_prep.seed_original_dishes($1::jsonb) as inserted", [
    JSON.stringify(rows),
  ]),
]);
const result = transaction.at(-1)!;
console.log(
  "Inserted " +
    result[0].inserted +
    " dishes. Existing edits and deletions remain unchanged.",
);
