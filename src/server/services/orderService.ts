import { getDb } from "../db/connection";
import { AppError, conflict } from "../errors";
import * as orders from "../repositories/orderRepository";
import * as products from "../repositories/productRepository";

export interface OrderItemInput {
  productId: number;
  quantity: number;
}

export interface OrderLine {
  productId: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface OrderDto {
  id: number;
  createdAt: string;
  totalCents: number;
  items: OrderLine[];
}

/** Rule 4: max units of one product a customer can buy, in total across all orders. */
export const MAX_UNITS_PER_CUSTOMER = 2;

/**
 * Place an order for a customer. Everything happens in one transaction, so if any
 * line fails (unknown product, over the limit, not enough stock) nothing is written.
 *
 * Rule 3: the input has no price field. Each unit price is read from the products
 * table here, inside the transaction, and saved on the order line.
 *
 * Rule 4: the transaction is IMMEDIATE, so it takes SQLite's write lock before reading
 * anything. Two orders from the same customer can't both read "1 bought so far" and
 * both pass the check: the second waits until the first commits, then sees 2.
 */
export function placeOrder(userId: number, items: OrderItemInput[]): OrderDto {
  const db = getDb();

  const run = db.transaction((): OrderDto => {
    const lines: OrderLine[] = [];

    for (const { productId, quantity } of items) {
      const product = products.findById(db, productId);
      if (!product) {
        throw new AppError(404, "PRODUCT_NOT_FOUND", `Product ${productId} not found.`);
      }
      const alreadyBought = orders.getPurchasedQuantity(db, userId, productId);
      if (alreadyBought + quantity > MAX_UNITS_PER_CUSTOMER) {
        throw conflict(
          "PURCHASE_LIMIT_EXCEEDED",
          `You can buy at most ${MAX_UNITS_PER_CUSTOMER} of "${product.name}" in total. ` +
            `You've already bought ${alreadyBought}.`,
          { productId, limit: MAX_UNITS_PER_CUSTOMER, alreadyBought, requested: quantity },
        );
      }
      // Conditional UPDATE: can't oversell even if stock changed since we read it.
      if (!orders.decrementStock(db, productId, quantity)) {
        throw conflict(
          "OUT_OF_STOCK",
          `Only ${product.stock} of "${product.name}" left.`,
          { productId, available: product.stock, requested: quantity },
        );
      }
      lines.push({
        productId,
        name: product.name,
        quantity,
        unitPriceCents: product.priceCents, // from the database, never from the request
        lineTotalCents: product.priceCents * quantity,
      });
    }

    const totalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
    const createdAt = new Date().toISOString();
    const orderId = orders.insertOrder(db, userId, totalCents, createdAt);
    for (const l of lines) {
      orders.insertItem(db, orderId, l.productId, l.quantity, l.unitPriceCents);
      orders.addPurchasedQuantity(db, userId, l.productId, l.quantity);
    }

    return { id: orderId, createdAt, totalCents, items: lines };
  });

  return run.immediate();
}
