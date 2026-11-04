// Rule 4 under real concurrency: several threads, each with its own database
// connection (like several server processes), order at the same instant.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/connection";
import { freshDb, PRODUCTS, USERS } from "./helpers";

let db: Db | undefined;
let dbFile: string;

afterEach(() => {
  db?.close();
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(dbFile + suffix, { force: true });
});

async function race(threads: number, userId: number, productId: number): Promise<string[]> {
  const gate = new SharedArrayBuffer(4);
  const workers = Array.from(
    { length: threads },
    () =>
      new Worker(new URL("./support/order-worker.ts", import.meta.url), {
        execArgv: ["--import", "tsx"],
        workerData: { dbFile, gate, userId, productId },
      }),
  );
  try {
    await Promise.all(workers.map((w) => once(w, "message"))); // all connected and waiting
    const results = workers.map((w) => once(w, "message").then(([msg]) => msg as string));
    Atomics.store(new Int32Array(gate), 0, 1);
    Atomics.notify(new Int32Array(gate), 0); // go!
    return await Promise.all(results);
  } finally {
    await Promise.all(workers.map((w) => w.terminate()));
  }
}

describe("Rule 4 under concurrency", () => {
  it(
    "lets exactly 2 of 6 simultaneous orders from one customer through",
    async () => {
      dbFile = path.join(os.tmpdir(), `release-shop-race-${process.pid}-${Date.now()}.db`);
      db = freshDb(dbFile);

      const results = await race(6, USERS.alice, PRODUCTS.dragon.id);

      expect(results.filter((r) => r === "ok")).toHaveLength(2);
      expect(results.filter((r) => r === "PURCHASE_LIMIT_EXCEEDED")).toHaveLength(4);
      expect(
        db.prepare("SELECT quantity FROM customer_product_purchases WHERE user_id = ?").pluck().get(USERS.alice),
      ).toBe(2);
      expect(db.prepare("SELECT stock FROM products WHERE id = ?").pluck().get(PRODUCTS.dragon.id)).toBe(
        PRODUCTS.dragon.stock - 2,
      );
    },
    30_000,
  );
});
