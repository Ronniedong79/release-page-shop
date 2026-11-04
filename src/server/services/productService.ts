import { SqliteError } from "better-sqlite3";
import { getDb } from "../db/connection";
import { conflict, notFound } from "../errors";
import * as products from "../repositories/productRepository";

export type ProductDto = products.ProductRow;
export type NewProduct = Omit<ProductDto, "id">;

/** Products customers can buy right now, with their current price from the database. */
export function listAvailableProducts(): ProductDto[] {
  return products.listInStock(getDb());
}

/** Admin view: every product, including sold-out ones (so they can be restocked). */
export function listAllProducts(): ProductDto[] {
  return products.listAll(getDb());
}

function getOrThrow(id: number): ProductDto {
  const product = products.findById(getDb(), id);
  if (!product) throw notFound(`Product ${id} not found.`);
  return product;
}

/** Admin: create a product. The initial price is recorded in price_history too. */
export function createProduct(input: NewProduct, adminId: number): ProductDto {
  const db = getDb();
  try {
    return db.transaction(() => {
      const id = products.insert(db, input);
      products.insertPriceHistory(db, id, null, input.priceCents, adminId);
      return getOrThrow(id);
    })();
  } catch (err) {
    // Rely on the UNIQUE constraint instead of "check then insert", which would race.
    if (err instanceof SqliteError && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw conflict("SKU_TAKEN", `A product with SKU "${input.sku}" already exists.`);
    }
    throw err;
  }
}

/** Admin: change the price. Only affects future orders; past orders keep the price they paid. */
export function updatePrice(id: number, priceCents: number, adminId: number): ProductDto {
  const db = getDb();
  return db.transaction(() => {
    const before = getOrThrow(id);
    products.updatePrice(db, id, priceCents);
    products.insertPriceHistory(db, id, before.priceCents, priceCents, adminId);
    return getOrThrow(id);
  })();
}

/** Admin: set the stock level (absolute value, e.g. after a recount or restock). */
export function updateStock(id: number, stock: number): ProductDto {
  const db = getDb();
  return db.transaction(() => {
    getOrThrow(id);
    products.updateStock(db, id, stock);
    return getOrThrow(id);
  })();
}
