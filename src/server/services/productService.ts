import { getDb } from "../db/connection";
import * as products from "../repositories/productRepository";

export type ProductDto = products.ProductRow;

/** Products customers can buy right now, with their current price from the database. */
export function listAvailableProducts(): ProductDto[] {
  return products.listInStock(getDb());
}
