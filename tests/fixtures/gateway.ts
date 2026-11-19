// Test-only Neon HTTP protocol endpoint backed by PostgreSQL/PGlite.
import { createServer } from "node:http";
import { PGlite, type Transaction } from "@electric-sql/pglite";
const db = new PGlite();
type Query = { query: string; params?: unknown[] };
async function execute(q: Query, tx: PGlite | Transaction) {
  const r = await tx.query(q.query, q.params);
  return {
    command: "SELECT",
    rowCount: r.rows.length,
    fields: r.fields,
    rows: (r.rows as Record<string, unknown>[]).map((row) =>
      r.fields.map((f) => {
        const value = row[f.name];
        if (value === null || value === undefined) return null;
        if (f.dataTypeID === 114 || f.dataTypeID === 3802)
          return JSON.stringify(value);
        if (value instanceof Date) return value.toISOString();
        if (typeof value === "boolean") return value ? "t" : "f";
        return String(value);
      }),
    ),
  };
}
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      res.end("ok");
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const result = body.queries
      ? await db.transaction(async (tx) => ({
          results: await Promise.all(
            (body.queries as Query[]).map((q) => execute(q, tx)),
          ),
        }))
      : await execute(body, db);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: e instanceof Error ? e.message : "Query failed",
        code: "P0001",
      }),
    );
  }
});
server.listen(54329, "127.0.0.1", () =>
  console.log("Neon-compatible test endpoint ready"),
);
async function stop() {
  server.close();
  await db.close();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
