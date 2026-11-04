import type { Db } from "../db/connection";

/**
 * Take `quantity` units off the shelf, but only if that many are left.
 * Returns false if there wasn't enough stock (no row updated).
 */
export function decrementStock(db: Db, productId: number, quantity: number): boolean {
  const { changes } = db
    .prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?")
    .run(quantity, productId, quantity);
  return changes === 1;
}

export function insertOrder(db: Db, userId: number, totalCents: number, createdAt: string): number {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO orders (user_id, total_cents, created_at) VALUES (?, ?, ?)")
    .run(userId, totalCents, createdAt);
  return Number(lastInsertRowid);
}

export function insertItem(
  db: Db,
  orderId: number,
  productId: number,
  quantity: number,
  unitPriceCents: number,
): void {
  db.prepare(
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
     VALUES (?, ?, ?, ?)`,
  ).run(orderId, productId, quantity, unitPriceCents);
}
