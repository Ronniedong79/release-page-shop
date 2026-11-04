-- 001_init: users, sessions, products (current price + stock), price history,
-- orders, order items, and per-customer purchase totals.
-- STRICT tables make SQLite enforce column types (e.g. no '1.5' in an INTEGER column).
-- Money is stored as integer cents to avoid floating point errors.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('customer', 'admin')),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- Only a SHA-256 hash of the session token is stored, so a leaked DB can't be used to log in.
CREATE TABLE sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT    NOT NULL
) STRICT;
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Current price and stock live on the product row: one row to read and lock when ordering.
CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  sku         TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock       INTEGER NOT NULL CHECK (stock >= 0),          -- stock can never go negative
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- Audit trail of every price change (old_price_cents is NULL for the initial price).
CREATE TABLE price_history (
  id              INTEGER PRIMARY KEY,
  product_id      INTEGER NOT NULL REFERENCES products(id),
  old_price_cents INTEGER CHECK (old_price_cents >= 0),
  new_price_cents INTEGER NOT NULL CHECK (new_price_cents >= 0),
  changed_by      INTEGER NOT NULL REFERENCES users(id),
  changed_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX idx_price_history_product ON price_history(product_id, changed_at);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX idx_orders_user ON orders(user_id, created_at);

-- unit_price_cents is the price actually charged, copied from products at order time (rule 3).
CREATE TABLE order_items (
  id               INTEGER PRIMARY KEY,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  quantity         INTEGER NOT NULL CHECK (quantity >= 1),       -- rule 6
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  UNIQUE (order_id, product_id)
) STRICT;
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- Running total of units each customer has bought per product (rule 4).
-- The service checks the limit first and returns a clear error; this CHECK is the
-- database-level backstop so the limit holds even if application code has a bug.
CREATE TABLE customer_product_purchases (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL CHECK (quantity BETWEEN 0 AND 2),
  PRIMARY KEY (user_id, product_id)
) STRICT, WITHOUT ROWID;
