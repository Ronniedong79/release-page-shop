import type { Db } from "../db/connection";

export interface ProductRow {
  id: number;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
}

const COLUMNS = "id, sku, name, price_cents AS priceCents, stock";

export function listInStock(db: Db): ProductRow[] {
  return db
    .prepare(`SELECT ${COLUMNS} FROM products WHERE stock > 0 ORDER BY id`)
    .all() as ProductRow[];
}
