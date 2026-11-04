// Test helpers: a fresh seeded database per test, and a way to call route handlers
// with real Request objects (so auth, validation and status codes are all exercised)
// without starting a server.
import * as loginRoute from "@/app/api/auth/login/route";
import { openDb, setDb, type Db } from "@/server/db/connection";
import { migrate } from "@/server/db/migrate";
import { seed } from "@/server/db/seed";

// Seed data (see src/server/db/seed.ts)
export const USERS = { admin: 1, alice: 2, bob: 3 } as const;
export const PRODUCTS = {
  dragon: { id: 1, priceCents: 12900, stock: 10 },
  comet: { id: 2, priceCents: 4500, stock: 5 },
  robot: { id: 3, priceCents: 8900, stock: 3 },
} as const;

/** New migrated + seeded database, installed as the app's connection. */
export function freshDb(file = ":memory:"): Db {
  const db = openDb(file);
  migrate(db);
  seed(db);
  setDb(db);
  return db;
}

type Handler = (req: Request, ctx: never) => Response | Promise<Response>;

export interface CallOptions {
  method?: string;
  token?: string;
  body?: unknown;
  rawBody?: string;
  params?: Record<string, string>;
  url?: string;
}

/** Call a route handler like an HTTP client would. Returns status and parsed JSON. */
export async function call(handler: Handler, opts: CallOptions = {}) {
  const { method = "GET", token, body, rawBody, params = {}, url = "http://test/api" } = opts;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new Request(url, {
    method,
    headers,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const res = await handler(req, { params: Promise.resolve(params) } as never);
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test convenience
  return { status: res.status, body: (text ? JSON.parse(text) : null) as any };
}

/** Log in as a seed user and return the session token. */
export async function loginAs(who: keyof typeof USERS): Promise<string> {
  const res = await call(loginRoute.POST, {
    method: "POST",
    body: { email: `${who}@example.com`, password: `${who}123` },
  });
  if (res.status !== 200) throw new Error(`login as ${who} failed: ${res.status}`);
  return res.body.token;
}

/** Everything an order touches, for "nothing changed" assertions. */
export function snapshot(db: Db) {
  return {
    stock: db.prepare("SELECT id, stock FROM products ORDER BY id").all(),
    orders: db.prepare("SELECT * FROM orders ORDER BY id").all(),
    items: db.prepare("SELECT * FROM order_items ORDER BY id").all(),
    purchases: db.prepare("SELECT * FROM customer_product_purchases ORDER BY 1, 2").all(),
  };
}
