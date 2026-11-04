import { beforeEach, describe, expect, it } from "vitest";
import * as priceRoute from "@/app/api/products/[id]/price/route";
import * as stockRoute from "@/app/api/products/[id]/stock/route";
import * as productsRoute from "@/app/api/products/route";
import type { Db } from "@/server/db/connection";
import { call, freshDb, loginAs, PRODUCTS } from "./helpers";

let db: Db;
let admin: string;

beforeEach(async () => {
  db = freshDb();
  admin = await loginAs("admin");
});

const create = (body: unknown) =>
  call(productsRoute.POST, { method: "POST", token: admin, body });
const setPrice = (id: string, body: unknown) =>
  call(priceRoute.PATCH, { method: "PATCH", token: admin, params: { id }, body });
const setStock = (id: string, body: unknown) =>
  call(stockRoute.PATCH, { method: "PATCH", token: admin, params: { id }, body });

describe("admin: products", () => {
  it("creates a product and records its initial price", async () => {
    const res = await create({ sku: "PHOENIX-04", name: "Phoenix", priceCents: 15000, stock: 4 });
    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({ sku: "PHOENIX-04", priceCents: 15000, stock: 4 });

    const listed = await call(productsRoute.GET);
    expect(listed.body.products.map((p: { sku: string }) => p.sku)).toContain("PHOENIX-04");
    expect(
      db.prepare("SELECT old_price_cents o, new_price_cents n FROM price_history WHERE product_id = ?").get(res.body.product.id),
    ).toEqual({ o: null, n: 15000 });
  });

  it("rejects a duplicate SKU with 409", async () => {
    const res = await create({ sku: "DRAGON-01", name: "Copy", priceCents: 1, stock: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SKU_TAKEN");
  });

  it("validates every field and reports each problem", async () => {
    const res = await create({ sku: "bad sku", name: " ", priceCents: 1.5, stock: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(
      ["name", "priceCents", "sku", "stock"],
    );
  });

  it("updates the price and writes an audit row in the same transaction", async () => {
    const res = await setPrice("1", { priceCents: 13950 });
    expect(res.status).toBe(200);
    expect(res.body.product.priceCents).toBe(13950);
    expect(
      db.prepare("SELECT old_price_cents o, new_price_cents n, changed_by u FROM price_history ORDER BY id DESC LIMIT 1").get(),
    ).toEqual({ o: PRODUCTS.dragon.priceCents, n: 13950, u: 1 });
  });

  it("updates the stock; a product at 0 stock leaves the public list", async () => {
    const res = await setStock("3", { stock: 0 });
    expect(res.status).toBe(200);
    const listed = await call(productsRoute.GET);
    expect(listed.body.products.map((p: { id: number }) => p.id)).not.toContain(3);
  });

  it("lets an admin find a sold-out product through the API and restock it", async () => {
    await setStock("3", { stock: 0 });
    const customer = await loginAs("alice");
    const ids = async (token?: string) =>
      (await call(productsRoute.GET, { token })).body.products.map((p: { id: number }) => p.id);

    expect(await ids()).not.toContain(3); // anonymous: in stock only
    expect(await ids(customer)).not.toContain(3); // customers: in stock only
    expect(await ids(admin)).toContain(3); // admins see every product

    expect((await setStock("3", { stock: 5 })).status).toBe(200);
    expect(await ids(customer)).toContain(3); // back on sale
  });

  it.each([
    ["a string price", { priceCents: "100" }],
    ["a negative price", { priceCents: -1 }],
    ["an unknown field", { priceCents: 100, discount: 50 }],
  ])("rejects %s with 400", async (_label, body) => {
    expect((await setPrice("1", body)).status).toBe(400);
  });

  it("returns 404 for a missing product and 400 for a bad id", async () => {
    expect((await setStock("999", { stock: 1 })).status).toBe(404);
    expect((await setStock("abc", { stock: 1 })).status).toBe(400);
  });
});
