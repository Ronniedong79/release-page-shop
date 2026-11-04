# Assumptions and unknowns

Assumptions I made:

- **The limit of 2 is per product.** A customer can buy 2 of *each* product, counted across all of their orders.
- **Admins can't place orders.** The rule says "only logged-in customers".
- **Browsing products doesn't require login.** Rule 1 only restricts ordering and admin actions.
- **"Available" means stock > 0.** Sold-out products are hidden from customers but still visible to admins so they can be restocked.
- **Currency is AUD**, stored as integer cents.
- **Changing stock sets an absolute value** (the result of a recount or restock), not an increment.
- **Sessions last 8 hours.**

Things I wasn't sure how to handle, and what I did:

- **The price changes between a customer viewing it and ordering.** I wasn't sure whether to charge the new price or ask the customer to confirm. Rule 3 says the server's current price wins, so I charge that and show the amount actually charged in the response and the UI. The cart says prices can change.
- **Cancelled orders and the purchase limit.** There's no cancellation yet, so I didn't have to decide whether cancelled units count toward the limit. The purchases table can be decremented if they shouldn't.
- **Concurrency on SQLite.** SQLite allows one writer at a time, so I used `BEGIN IMMEDIATE` rather than row locks. That's fine at this scale, but I'd change it on PostgreSQL (see above).

Questions I'd ask the business:

1. Should the purchase limit be the same for every release, or set per product?
2. If the price changes while a customer is checking out, should they be charged the new price or asked to confirm?
3. Should units from a cancelled or refunded order count toward the limit?
4. Should sold-out items stay visible as "Sold out" so customers know they were there?
5. Is the limit per account, or also per person, card or address? People with several accounts can get around a per-account limit.
6. Do admins need to see all orders, and should they be able to buy?
7. What should happen to existing carts when stock runs out or a price changes?
