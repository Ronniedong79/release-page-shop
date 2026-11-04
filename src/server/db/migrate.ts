import fs from "node:fs";
import path from "node:path";
import type { Db } from "./connection";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "server", "db", "migrations");

/**
 * Apply every *.sql file in migrations/ that hasn't run yet, in filename order.
 * Each migration runs in its own transaction, so a broken migration leaves no partial schema.
 */
export function migrate(db: Db): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT`);

  const applied = new Set(
    db.prepare("SELECT name FROM schema_migrations").pluck().all() as string[],
  );
  const pending = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !applied.has(f))
    .sort();

  const record = db.prepare("INSERT INTO schema_migrations (name) VALUES (?)");
  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      record.run(file);
    })();
  }
  return pending;
}
