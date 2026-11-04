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

export function listPurchasedQuantities(
  db: Db,
  userId: number,
): { productId: number; quantity: number }[] {
  return db
    .prepare(
      "SELECT product_id AS productId, quantity FROM customer_product_purchases WHERE user_id = ?",
    )
    .all(userId) as { productId: number; quantity: number }[];
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

export interface OrderItemRow {
  orderId: number;
  createdAt: string;
  totalCents: number;
  productId: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

/**
 * One row per order line for this user, oldest order first.
 * The WHERE on user_id is what keeps customers out of each other's orders (rule 2).
 */
export function listByUser(db: Db, userId: number): OrderItemRow[] {
  return db
    .prepare(
      `SELECT o.id AS orderId, o.created_at AS createdAt, o.total_cents AS totalCents,
              i.product_id AS productId, p.name, i.quantity, i.unit_price_cents AS unitPriceCents
         FROM orders o
         JOIN order_items i ON i.order_id = o.id
         JOIN products p    ON p.id = i.product_id
        WHERE o.user_id = ?
        ORDER BY o.created_at, o.id, i.id`,
    )
    .all(userId) as OrderItemRow[];
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
