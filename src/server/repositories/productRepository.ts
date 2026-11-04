import type { Db } from "../db/connection";

export interface ProductRow {
  id: number;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
}

const COLUMNS = "id, sku, name, price_cents AS priceCents, stock";
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export function listInStock(db: Db): ProductRow[] {
  return db
    .prepare(`SELECT ${COLUMNS} FROM products WHERE stock > 0 ORDER BY id`)
    .all() as ProductRow[];
}

export function listAll(db: Db): ProductRow[] {
  return db.prepare(`SELECT ${COLUMNS} FROM products ORDER BY id`).all() as ProductRow[];
}

export function findById(db: Db, id: number): ProductRow | undefined {
  return db.prepare(`SELECT ${COLUMNS} FROM products WHERE id = ?`).get(id) as
    | ProductRow
    | undefined;
}

export function insert(db: Db, p: Omit<ProductRow, "id">): number {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO products (sku, name, price_cents, stock) VALUES (?, ?, ?, ?)")
    .run(p.sku, p.name, p.priceCents, p.stock);
  return Number(lastInsertRowid);
}

export function updatePrice(db: Db, id: number, priceCents: number): void {
  db.prepare(`UPDATE products SET price_cents = ?, updated_at = ${NOW} WHERE id = ?`).run(
    priceCents,
    id,
  );
}

export function updateStock(db: Db, id: number, stock: number): void {
  db.prepare(`UPDATE products SET stock = ?, updated_at = ${NOW} WHERE id = ?`).run(stock, id);
}

export function insertPriceHistory(
  db: Db,
  productId: number,
  oldPriceCents: number | null,
  newPriceCents: number,
  changedBy: number,
): void {
  db.prepare(
    `INSERT INTO price_history (product_id, old_price_cents, new_price_cents, changed_by)
     VALUES (?, ?, ?, ?)`,
  ).run(productId, oldPriceCents, newPriceCents, changedBy);
}
