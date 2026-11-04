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

/** Units of this product the customer has already bought, across all their orders. */
export function getPurchasedQuantity(db: Db, userId: number, productId: number): number {
  const row = db
    .prepare(
      "SELECT quantity FROM customer_product_purchases WHERE user_id = ? AND product_id = ?",
    )
    .get(userId, productId) as { quantity: number } | undefined;
  return row?.quantity ?? 0;
}

/** Add to the customer's running total. The table's CHECK (quantity <= 2) is the DB backstop. */
export function addPurchasedQuantity(
  db: Db,
  userId: number,
  productId: number,
  quantity: number,
): void {
  db.prepare(
    `INSERT INTO customer_product_purchases (user_id, product_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = quantity + excluded.quantity`,
  ).run(userId, productId, quantity);
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
