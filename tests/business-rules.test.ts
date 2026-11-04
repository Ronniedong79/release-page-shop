// One describe block per business rule in the brief. Every test goes through the
// HTTP route handlers, i.e. the same path as someone calling the API directly.
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logoutRoute from "@/app/api/auth/logout/route";
import * as ordersRoute from "@/app/api/orders/route";
import * as priceRoute from "@/app/api/products/[id]/price/route";
import * as stockRoute from "@/app/api/products/[id]/stock/route";
import * as productsRoute from "@/app/api/products/route";
import type { Db } from "@/server/db/connection";
import { call, freshDb, loginAs, PRODUCTS, snapshot } from "./helpers";

const { dragon, comet, robot } = PRODUCTS;

let db: Db;
let alice: string;
let bob: string;
let admin: string;

beforeEach(async () => {
  db = freshDb();
  [alice, bob, admin] = await Promise.all([loginAs("alice"), loginAs("bob"), loginAs("admin")]);
});

const order = (token: string | undefined, items: unknown, extra: object = {}) =>
  call(ordersRoute.POST, { method: "POST", token, body: { items, ...extra } });

const myOrders = (token?: string, url = "http://test/api/orders") =>
  call(ordersRoute.GET, { token, url });

const stockOf = (productId: number) =>
  (db.prepare("SELECT stock FROM products WHERE id = ?").get(productId) as { stock: number })
    .stock;

// ---------------------------------------------------------------------------
describe("Rule 1: only logged-in customers can order; only admins manage products", () => {
  it("rejects an order with no session (401)", async () => {
    const res = await order(undefined, [{ productId: dragon.id, quantity: 1 }]);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects an order with a made-up or logged-out token (401)", async () => {
    expect((await order("not-a-real-token", [{ productId: 1, quantity: 1 }])).status).toBe(401);

    await call(logoutRoute.POST, { method: "POST", token: alice });
    expect((await order(alice, [{ productId: 1, quantity: 1 }])).status).toBe(401);
  });

  it("rejects an order from an admin (403)", async () => {
    const res = await order(admin, [{ productId: dragon.id, quantity: 1 }]);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lets a logged-in customer order (201)", async () => {
    const res = await order(alice, [{ productId: dragon.id, quantity: 1 }]);
    expect(res.status).toBe(201);
  });

  const adminCalls = {
    "create a product": (token?: string) =>
      call(productsRoute.POST, {
        method: "POST",
        token,
        body: { sku: "NEW-1", name: "New", priceCents: 100, stock: 1 },
      }),
    "change a price": (token?: string) =>
      call(priceRoute.PATCH, {
        method: "PATCH",
        token,
        params: { id: "1" },
        body: { priceCents: 1 },
      }),
    "change stock": (token?: string) =>
      call(stockRoute.PATCH, {
        method: "PATCH",
        token,
        params: { id: "1" },
        body: { stock: 999 },
      }),
  };

  describe.each(Object.entries(adminCalls))("%s", (_name, send) => {
    it("is rejected with no session (401)", async () => {
      expect((await send(undefined)).status).toBe(401);
    });

    it("is rejected for a customer (403) and changes nothing", async () => {
      const before = db.prepare("SELECT * FROM products ORDER BY id").all();
      expect((await send(alice)).status).toBe(403);
      expect(db.prepare("SELECT * FROM products ORDER BY id").all()).toEqual(before);
    });

    it("is allowed for an admin", async () => {
      expect((await send(admin)).status).toBeLessThan(300);
    });
  });

  it("checks the role before looking at the body (customer gets 403, not 400)", async () => {
    const res = await call(priceRoute.PATCH, {
      method: "PATCH",
      token: alice,
      params: { id: "1" },
      rawBody: "{not json",
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe("Rule 2: customers can only see their own orders", () => {
  beforeEach(async () => {
    await order(alice, [{ productId: dragon.id, quantity: 1 }]);
    await order(bob, [{ productId: comet.id, quantity: 2 }]);
  });

  it("returns only the caller's orders", async () => {
    const forAlice = await myOrders(alice);
    const forBob = await myOrders(bob);

    expect(forAlice.status).toBe(200);
    expect(forAlice.body.orders).toHaveLength(1);
    expect(forAlice.body.orders[0].items[0].productId).toBe(dragon.id);

    expect(forBob.body.orders).toHaveLength(1);
    expect(forBob.body.orders[0].items[0].productId).toBe(comet.id);
  });

  it("ignores any attempt to pick another user in the URL", async () => {
    const res = await myOrders(bob, "http://test/api/orders?userId=2&user_id=2");
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].items[0].productId).toBe(comet.id); // still Bob's
  });

  it("requires a session (401)", async () => {
    expect((await myOrders()).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe("Rule 3: the price comes from the database; browser prices are ignored", () => {
  it("charges the database price even when the request sends its own prices", async () => {
    const res = await order(
      alice,
      [{ productId: dragon.id, quantity: 2, priceCents: 1, unitPriceCents: 1, price: 0.01 }],
      { totalCents: 1, total: 0.01 },
    );

    expect(res.status).toBe(201);
    expect(res.body.order.items[0].unitPriceCents).toBe(dragon.priceCents);
    expect(res.body.order.totalCents).toBe(dragon.priceCents * 2);

    // ...and that is what was saved on the order
    expect(db.prepare("SELECT unit_price_cents AS p FROM order_items").get()).toEqual({
      p: dragon.priceCents,
    });
    expect(db.prepare("SELECT total_cents AS t FROM orders").get()).toEqual({
      t: dragon.priceCents * 2,
    });
  });

  it("uses the new price after an admin change, and old orders keep the price they paid", async () => {
    await order(alice, [{ productId: dragon.id, quantity: 1 }]);

    const change = await call(priceRoute.PATCH, {
      method: "PATCH",
      token: admin,
      params: { id: String(dragon.id) },
      body: { priceCents: 15000 },
    });
    expect(change.status).toBe(200);

    const second = await order(alice, [{ productId: dragon.id, quantity: 1 }]);
    expect(second.body.order.totalCents).toBe(15000);

    const history = (await myOrders(alice)).body.orders;
    expect(history.map((o: { totalCents: number }) => o.totalCents)).toEqual([12900, 15000]);
  });
});

// ---------------------------------------------------------------------------
describe("Rule 4: at most 2 units of a product per customer, across all orders", () => {
  it("rejects 3 units in a single order", async () => {
    const res = await order(alice, [{ productId: dragon.id, quantity: 3 }]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PURCHASE_LIMIT_EXCEEDED");
    expect(res.body.error.details).toMatchObject({ limit: 2, alreadyBought: 0, requested: 3 });
  });

  it("counts units across separate orders", async () => {
    expect((await order(alice, [{ productId: dragon.id, quantity: 1 }])).status).toBe(201);
    expect((await order(alice, [{ productId: dragon.id, quantity: 1 }])).status).toBe(201);

    const third = await order(alice, [{ productId: dragon.id, quantity: 1 }]);
    expect(third.status).toBe(409);
    expect(third.body.error.details).toMatchObject({ alreadyBought: 2, requested: 1 });
    expect(stockOf(dragon.id)).toBe(dragon.stock - 2);
  });

  it("is per customer: one customer's purchases don't use up another's", async () => {
    await order(alice, [{ productId: dragon.id, quantity: 2 }]);
    expect((await order(bob, [{ productId: dragon.id, quantity: 2 }])).status).toBe(201);
  });

  it("is per product: buying 2 of one product doesn't block another", async () => {
    await order(alice, [{ productId: dragon.id, quantity: 2 }]);
    expect((await order(alice, [{ productId: comet.id, quantity: 2 }])).status).toBe(201);
  });

  it("is also enforced by the database, even if application code is bypassed", async () => {
    await order(alice, [{ productId: dragon.id, quantity: 2 }]);
    expect(() =>
      db
        .prepare(
          "UPDATE customer_product_purchases SET quantity = 3 WHERE user_id = 2 AND product_id = 1",
        )
        .run(),
    ).toThrow(/CHECK constraint failed/);
  });
});

// ---------------------------------------------------------------------------
describe("Rule 5: an order fully succeeds or fully fails", () => {
  it("writes nothing when one line is over the purchase limit", async () => {
    await order(alice, [{ productId: comet.id, quantity: 2 }]);
    const before = snapshot(db);

    const res = await order(alice, [
      { productId: dragon.id, quantity: 1 }, // fine on its own
      { productId: comet.id, quantity: 1 }, // would be her 3rd
    ]);

    expect(res.status).toBe(409);
    expect(snapshot(db)).toEqual(before);
  });

  it("writes nothing when one line is out of stock", async () => {
    await order(bob, [{ productId: robot.id, quantity: 2 }]); // 1 robot left
    const before = snapshot(db);

    const res = await order(alice, [
      { productId: dragon.id, quantity: 1 },
      { productId: robot.id, quantity: 2 },
    ]);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("OUT_OF_STOCK");
    expect(snapshot(db)).toEqual(before);
  });

  it("writes nothing when a product doesn't exist", async () => {
    const before = snapshot(db);
    const res = await order(alice, [
      { productId: dragon.id, quantity: 1 },
      { productId: 999, quantity: 1 },
    ]);
    expect(res.status).toBe(404);
    expect(snapshot(db)).toEqual(before);
  });

  it("rolls back earlier writes if something fails halfway through writing", async () => {
    // Simulate a crash while inserting the 2nd order line, after the order row,
    // the 1st line, its stock change and its purchase count have been written.
    db.exec(`CREATE TRIGGER crash BEFORE INSERT ON order_items WHEN NEW.product_id = 2
             BEGIN SELECT RAISE(ABORT, 'simulated failure'); END`);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const before = snapshot(db);

    const res = await order(alice, [
      { productId: dragon.id, quantity: 1 },
      { productId: comet.id, quantity: 1 },
    ]);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR"); // no internals leaked
    expect(snapshot(db)).toEqual(before);
    quiet.mockRestore();
  });
});

// ---------------------------------------------------------------------------
describe("Rule 6: quantities must be whole numbers of 1 or more", () => {
  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fraction", 1.5],
    ["numeric string", "2"],
    ["null", null],
  ])("rejects a %s quantity (400) and writes nothing", async (_label, quantity) => {
    const before = snapshot(db);
    const res = await order(alice, [{ productId: dragon.id, quantity }]);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("items.0.quantity");
    expect(snapshot(db)).toEqual(before);
  });

  it("rejects a missing quantity", async () => {
    expect((await order(alice, [{ productId: dragon.id }])).status).toBe(400);
  });

  it("rejects an empty order", async () => {
    expect((await order(alice, [])).status).toBe(400);
  });

  it("rejects the same product twice in one order", async () => {
    const res = await order(alice, [
      { productId: dragon.id, quantity: 1 },
      { productId: dragon.id, quantity: 1 },
    ]);
    expect(res.status).toBe(400);
  });

  it("rejects a body that isn't valid JSON", async () => {
    const res = await call(ordersRoute.POST, { method: "POST", token: alice, rawBody: "{oops" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});
