import "server-only";
import { database } from "@/lib/database";
import { timerSchemaStatements } from "./schema";
import { sharedTimerSchemaStatements } from "./shared-schema";
import { dishDefaultSchemaStatements } from "./default-schema";
let initialized: Promise<void> | undefined;
export async function timerDatabase() {
  const sql = await database();
  initialized ??= (async () => {
    const version = await sql.query(
      "select version from kitchen_prep.schema_migrations where version=3",
    );
    if (version.length === 0)
      await sql.transaction(
        timerSchemaStatements.map((statement) => sql.query(statement)),
      );
    const sharedVersion = await sql.query(
      "select version from kitchen_prep.schema_migrations where version=4",
    );
    if (!sharedVersion.length)
      await sql.transaction(
        sharedTimerSchemaStatements.map((statement) => sql.query(statement)),
      );
    const defaultVersion = await sql.query(
      "select version from kitchen_prep.schema_migrations where version=5",
    );
    if (!defaultVersion.length)
      await sql.transaction(
        dishDefaultSchemaStatements.map((statement) => sql.query(statement)),
      );
  })().catch((e) => {
    initialized = undefined;
    throw e;
  });
  await initialized;
  return sql;
}
