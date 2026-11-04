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

/**
 * Place an order for a customer. Everything happens in one transaction, so if any
 * line fails (unknown product, not enough stock) nothing is written at all.
 *
 * Rule 3: the input has no price field. Each unit price is read from the products
 * table here, inside the transaction, and saved on the order line.
 */
export function placeOrder(userId: number, items: OrderItemInput[]): OrderDto {
  const db = getDb();

  return db.transaction((): OrderDto => {
    const lines: OrderLine[] = [];

    for (const { productId, quantity } of items) {
      const product = products.findById(db, productId);
      if (!product) {
        throw new AppError(404, "PRODUCT_NOT_FOUND", `Product ${productId} not found.`);
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
    }

    return { id: orderId, createdAt, totalCents, items: lines };
  })();
}
