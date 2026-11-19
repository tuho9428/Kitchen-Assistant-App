import "server-only";
import {
  neon,
  neonConfig,
  type NeonQueryFunction,
} from "@neondatabase/serverless";
import source from "@/data/dishes.json";
import { seedRows } from "./dishes";
import { schemaStatements } from "./neon-schema";
import { hiddenSchemaStatements } from "./hidden-schema";
let initialization: Promise<void> | undefined;
async function initialize(sql: NeonQueryFunction<false, false>) {
  const existing = await sql.query(
    "select to_regclass('kitchen_prep.schema_migrations') as present",
  );
  if (existing[0]?.present) {
    const versions = await sql.query(
      "select version from kitchen_prep.schema_migrations where version=2",
    );
    if (versions.length === 0)
      await sql.transaction(
        hiddenSchemaStatements.map((statement) => sql.query(statement)),
      );
    return;
  }
  await sql.transaction([
    ...schemaStatements.map((statement) => sql.query(statement)),
    ...hiddenSchemaStatements.map((statement) => sql.query(statement)),
    sql.query("select kitchen_prep.seed_original_dishes($1::jsonb)", [
      JSON.stringify(seedRows(source)),
    ]),
  ]);
}
export async function database() {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error("The Neon DATABASE_URL is missing from .env.local.");
  // Browser tests use a loopback Neon-compatible PostgreSQL endpoint and fake credentials.
  if (
    process.env.KITCHEN_TEST_BUILD === "1" &&
    process.env.NEON_TEST_ENDPOINT
  ) {
    const endpoint = new URL(process.env.NEON_TEST_ENDPOINT);
    if (endpoint.hostname !== "127.0.0.1")
      throw new Error("Test database must use loopback");
    neonConfig.fetchEndpoint = endpoint.href;
  }
  const sql = neon(url);
  initialization ??= initialize(sql).catch((error) => {
    initialization = undefined;
    throw error;
  });
  await initialization;
  return sql;
}
