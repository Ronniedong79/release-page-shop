import type { Db } from "./connection";
import { hashPassword } from "../lib/password";

export const SEED_USERS = [
  { email: "admin@example.com", password: "admin123", role: "admin" },
  { email: "alice@example.com", password: "alice123", role: "customer" },
  { email: "bob@example.com", password: "bob123", role: "customer" },
] as const;

export const SEED_PRODUCTS = [
  { sku: "DRAGON-01", name: "Golden Dragon Figurine", priceCents: 12900, stock: 10 },
  { sku: "COMET-02", name: "Comet Trading Card (Holo)", priceCents: 4500, stock: 5 },
  { sku: "ROBOT-03", name: "Vintage Tin Robot", priceCents: 8900, stock: 3 },
] as const;

/** Insert the seed users and products. Expects an empty, migrated database. */
export function seed(db: Db): void {
  const insertUser = db.prepare(
    "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
  );
  const insertProduct = db.prepare(
    "INSERT INTO products (sku, name, price_cents, stock) VALUES (?, ?, ?, ?)",
  );
  const insertPrice = db.prepare(
    "INSERT INTO price_history (product_id, old_price_cents, new_price_cents, changed_by) VALUES (?, NULL, ?, ?)",
  );

  db.transaction(() => {
    const ids = new Map<string, number>();
    for (const u of SEED_USERS) {
      const { lastInsertRowid } = insertUser.run(u.email, hashPassword(u.password), u.role);
      ids.set(u.email, Number(lastInsertRowid));
    }
    const adminId = ids.get("admin@example.com")!;
    for (const p of SEED_PRODUCTS) {
      const { lastInsertRowid } = insertProduct.run(p.sku, p.name, p.priceCents, p.stock);
      insertPrice.run(lastInsertRowid, p.priceCents, adminId);
    }
  })();
}
