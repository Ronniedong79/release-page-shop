// Creates a fresh database: deletes any existing file, runs migrations, inserts seed data.
// Usage: npm run setup
import fs from "node:fs";
import { DEFAULT_DB_PATH, openDb } from "../src/server/db/connection";
import { migrate } from "../src/server/db/migrate";
import { seed, SEED_USERS } from "../src/server/db/seed";

const dbPath = process.env.DATABASE_PATH ?? DEFAULT_DB_PATH;

for (const suffix of ["", "-wal", "-shm"]) {
  fs.rmSync(dbPath + suffix, { force: true });
}

const db = openDb(dbPath);
const applied = migrate(db);
seed(db);
db.close();

console.log(`Database ready at ${dbPath}`);
console.log(`Migrations applied: ${applied.join(", ")}`);
console.log("Seed logins:");
for (const u of SEED_USERS) console.log(`  ${u.role.padEnd(8)} ${u.email} / ${u.password}`);
