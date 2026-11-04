import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Db = Database.Database;

export const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "shop.db");

/** Open a SQLite connection with the pragmas every connection in this app needs. */
export function openDb(filePath: string = process.env.DATABASE_PATH ?? DEFAULT_DB_PATH): Db {
  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL"); // readers don't block the writer
  db.pragma("foreign_keys = ON"); // SQLite has FKs off by default
  db.pragma("busy_timeout = 5000"); // wait for the write lock instead of failing immediately
  return db;
}

// One shared connection per server process. Tests swap it via setDb().
let current: Db | undefined;

export function getDb(): Db {
  current ??= openDb();
  return current;
}

export function setDb(db: Db): void {
  current = db;
}
