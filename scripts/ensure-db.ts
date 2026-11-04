// Runs automatically before `npm run dev` (the "predev" script).
// Makes sure the database exists and is up to date, without touching existing data:
//   - creates the file if it's missing
//   - applies any migrations that haven't run yet
//   - inserts seed data only if there are no users at all
// Safe to run any number of times. To wipe and start again, use `npm run setup`.
import { DEFAULT_DB_PATH, openDb } from "../src/server/db/connection";
import { migrate } from "../src/server/db/migrate";
import { seed, SEED_USERS } from "../src/server/db/seed";

const dbPath = process.env.DATABASE_PATH ?? DEFAULT_DB_PATH;
const db = openDb(dbPath);

const applied = migrate(db);
const hasUsers = (db.prepare("SELECT count(*) FROM users").pluck().get() as number) > 0;
if (!hasUsers) seed(db);
db.close();

if (applied.length > 0) console.log(`Migrations applied: ${applied.join(", ")}`);
if (!hasUsers) {
  console.log(`Seeded a fresh database at ${dbPath}. Logins:`);
  for (const u of SEED_USERS) console.log(`  ${u.role.padEnd(8)} ${u.email} / ${u.password}`);
} else {
  console.log("Database ready (existing data kept).");
}
