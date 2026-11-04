# Release Shop

A small full-stack shop for limited releases. Customers log in, see what's available at today's price, and buy it. Admins load new items and change stock and prices.

**Stack:** TypeScript · Next.js 15 (App Router, route handlers for the API) · React 19 · SQLite (better-sqlite3) · zod · vitest

The business rules are enforced on the server. Calling the API directly and skipping the front end doesn't get around any of them.

Also in this repo:

- [**ASSUMPTIONS.md**](ASSUMPTIONS.md): the assumptions I made, what I wasn't sure about, and the questions I'd ask the business.
- [**NOTE_TO_GM.md**](NOTE_TO_GM.md): a short, non-technical note for the General Manager.

---

## Run it locally

Requires Node.js 22 or newer (`better-sqlite3` and `vitest` need it).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

**There's no separate setup step.** On first run, `npm run dev` creates the SQLite database, applies migrations and seeds it. After that it keeps your data. `npm run build && npm start` does the same.

| Role     | Email               | Password   |
|----------|---------------------|------------|
| Admin    | admin@example.com   | admin123   |
| Customer | alice@example.com   | alice123   |
| Customer | bob@example.com     | bob123     |

Other commands:

```bash
npm test           # API tests (rules 1–6, plus concurrency); uses its own in-memory databases
npm run setup      # optional: wipe the database and reseed it
```

The database is a single file at `data/shop.db`. In dev mode, the first visit to each page takes a few seconds while Next.js compiles it.

### Try the API directly

```bash
# Log in (the token is also set as an httpOnly cookie for the browser)
curl -X POST localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"alice123"}'

# Place an order. The price field is ignored: you're charged the database price.
curl -X POST localhost:3000/api/orders -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":1,"priceCents":1}]}'

# Admin: change a price (customers get 403)
curl -X PATCH localhost:3000/api/products/1/price -H "Authorization: Bearer <admin token>" \
  -H "Content-Type: application/json" -d '{"priceCents":13950}'
```

### API

| Method & path | Who | What |
|---|---|---|
| `POST /api/auth/login` | anyone | `{ email, password }` → session token + httpOnly cookie |
| `POST /api/auth/logout` | logged in | deletes the session |
| `GET /api/auth/me` | logged in | current user |
| `GET /api/products` | anyone | products in stock, with current prices. Admins get every product, including sold-out ones, so they can restock them |
| `POST /api/orders` | customer | `{ items: [{ productId, quantity }] }` |
| `GET /api/orders` | logged in | the caller's own orders |
| `POST /api/products` | admin | `{ sku, name, priceCents, stock }` |
| `PATCH /api/products/:id/price` | admin | `{ priceCents }` |
| `PATCH /api/products/:id/stock` | admin | `{ stock }` |

Money is always whole cents (`12900` = $129.00). Errors look like `{ "error": { "code", "message", "details" } }`, using 400 for invalid input, 401 when not logged in, 403 for the wrong role, 404 when not found, and 409 when the request conflicts with current state (out of stock, over the purchase limit, duplicate SKU).

The UI includes a product list with **Buy now** and a side cart, a **My orders** page, and a basic **admin page** for products. The brief only needed the product list and order form; the other pages use the same API.

---

## Database schema

Defined in [`src/server/db/migrations/001_init.sql`](src/server/db/migrations/001_init.sql).

| Table | Purpose |
|---|---|
| `users` | email, scrypt password hash, `role` (`customer` / `admin`) |
| `sessions` | SHA-256 hash of each session token, expiry |
| `products` | SKU, name, **current** `price_cents` and `stock` |
| `price_history` | every price change: old price, new price, who changed it, when |
| `orders` | one row per order: customer, total, time |
| `order_items` | product, quantity and **`unit_price_cents` actually charged** |
| `customer_product_purchases` | running total of units each customer has bought of each product |

Why it's shaped this way:

- **Current price and stock live on the product row.** Placing an order reads and updates one row per product inside a single transaction.
- **The price charged is copied onto `order_items`.** Later price changes don't rewrite history (rule 3).
- **`price_history`** gives an audit trail of who changed a price and when. Price changes during the day were part of the original problem.
- **`customer_product_purchases`** turns rule 4 into a database constraint, `CHECK (quantity BETWEEN 0 AND 2)`. The limit holds even if application code has a bug. It also makes the check a primary-key lookup instead of summing every past order.
- **Constraints as a backstop:** `stock >= 0`, `quantity >= 1`, valid roles, foreign keys. Tables are `STRICT`, so SQLite rejects `1.5` or `"2"` in an integer column.
- **Integer cents** avoid floating-point rounding.
- **Sessions store only a token hash.** A leaked database can't be used to log in, and logging out takes effect immediately, which JWTs can't do without extra machinery.

---

## Code structure

```
src/
  server/
    db/            connection, migration runner, seed data, SQL migrations
    repositories/  data access only: SQL in, plain objects out
    services/      business rules and transactions (auth, products, orders)
    http/          request handling: auth guards, zod schemas, JSON error responses
    errors.ts      AppError: expected errors with an HTTP status and code
  app/
    api/...        route handlers: authenticate → validate → call a service → respond
    ...            pages (Server Components read via services; Client Components call the API)
  lib/             shared by server and UI: money formatting, rule constants
tests/             API tests that call the route handlers with real Request objects
scripts/           setup (wipe + seed) and ensure-db (runs before dev and start)
```

- **Route handlers are thin.** Each one checks who's calling, validates the body, calls a service and returns the result, so a reviewer can see each endpoint's permission on its first line.
- **Services hold the rules and own the transactions.** They don't know about HTTP, so the same logic serves the API and the pages.
- **Repositories only run SQL** and take the database as a parameter, which keeps them easy to test.
- **Raw SQL instead of an ORM.** The interesting parts of this task are constraints, transactions and locking, and SQL keeps those visible.

---

## How each business rule is enforced

**1. Only logged-in customers can order; only admins manage products.**
`requireRole(req, "customer" | "admin")` runs before the body is parsed. It returns 401 with no valid session and 403 for the wrong role. Admins can't place orders, because the rule says *customers*. Hiding buttons in the UI is only a convenience; the API is the actual control.

**2. Customers only see their own orders.**
`GET /api/orders` takes the user id from the session only. There is no `userId` parameter to tamper with, and the repository query filters `WHERE o.user_id = ?`.

**3. The price is always worked out on the server.** *(key rule)*
- The order schema only defines `productId` and `quantity`. zod's `z.object` strips unknown keys, so `price`, `priceCents`, `total` and similar fields are silently dropped and never reach the service. The rule says "ignored", so the request isn't rejected.
- Inside the order transaction, the unit price is read from `products`, multiplied on the server, and written to `order_items.unit_price_cents` and `orders.total_cents`.
- The response returns what was actually charged, and the UI displays that number rather than its own.
- Tests send `priceCents: 1` and check that the database price is charged. They also check that after an admin price change, new orders use the new price and old orders keep the old one.

**4. At most 2 units of a product per customer, across all their orders.** *(key rule)*
Three layers:
1. **Service check:** inside the order transaction, read the customer's running total from `customer_product_purchases`. If `already + requested > 2`, return 409 `PURCHASE_LIMIT_EXCEEDED` with `{ limit, alreadyBought, requested }`.
2. **Concurrency:** the transaction is `BEGIN IMMEDIATE`, so it takes SQLite's write lock before reading. Two simultaneous orders can't both read "1 bought" and both pass; the second waits and then sees 2. A test fires 6 orders from 6 threads, each with its own connection, at the same instant, and exactly 2 succeed. Removing `IMMEDIATE` makes that test fail.
3. **Database backstop:** `CHECK (quantity BETWEEN 0 AND 2)` rejects a third unit even if the code above were wrong.

The UI also stops a customer adding more than they're allowed and explains why. That's for convenience; the server still decides.

**5. An order fully succeeds or fully fails.**
The whole order runs in one transaction. Every line is checked first (product exists, purchase limit, stock), and nothing is written until all lines pass. Stock is then taken with a conditional `UPDATE … WHERE stock >= ?` as a second guard against overselling. If anything throws, the transaction rolls back. A test uses a trigger to make the second line's insert fail after the order row, the first line, its stock change and its purchase count are already written, and checks that the database is exactly as it was before.

**6. Quantities are whole numbers of 1 or more.**
zod `z.number().int().min(1)`, with no type coercion, so `0`, `-1`, `1.5`, `"2"` and `null` are all rejected with a 400 that names the field. The database has `CHECK (quantity >= 1)` on `STRICT` tables as well.

**Tests:** `npm test` runs 53 tests. [`tests/business-rules.test.ts`](tests/business-rules.test.ts) has one `describe` block per rule. Admin, auth and concurrency tests are in their own files. Each test gets a fresh in-memory database.

---

## What I'd do next

- **Stock adjustments as deltas** (`{ "adjustBy": +5 }`) or with optimistic locking. The current "set stock to N" can lose concurrent sales if an admin restocks during a drop.
- **Idempotency keys on `POST /api/orders`**, so a double-click or retry can't create two orders.
- **PostgreSQL for production**, using row locks (`SELECT … FOR UPDATE`) on the customer's purchase row instead of a database-wide write lock.
- **Rate limiting** on login and orders, plus lockout after repeated failed logins.
- **Payments and order status** (pending → paid → cancelled), and returning units to the purchase limit on cancellation.
- **Per-product limits and release windows** (`max_per_customer`, `on_sale_from`) instead of one global constant.
- **Stricter id parsing.** Route ids go through `Number()`, so `/api/products/1e0/price` and `0x1` are accepted as product 1. That isn't a security issue (the result is still a valid id, and queries are parameterised), but I'd accept only `^\d+$` so each product has one URL.
- **Store the product name on `order_items`** so order history keeps the name at the time of purchase.
- **Admin views** of all orders and price history; an audit log for stock changes.
- **Real UI** built from Figma designs, with Tailwind or the team's design system.
- **E2E tests** (Playwright) and CI running lint, type-check and tests on every push.
