"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCents } from "@/lib/format";
import { MAX_UNITS_PER_CUSTOMER } from "@/lib/rules";
import { useCart } from "./cart/CartContext";

type Status = { ok: boolean; text: string } | null;

interface Props {
  product: { id: number; name: string; priceCents: number };
  /** Units this customer may still buy (rule 4), worked out on the server. */
  remaining: number;
}

/**
 * Order controls for one product: buy it now, or add it to the cart.
 * Only productId and quantity are ever sent; the server decides the price.
 *
 * The limit check here is only earlier feedback. The order API checks the
 * limit again, so skipping this UI doesn't get around it.
 */
export function BuyForm({ product, remaining }: Props) {
  const router = useRouter();
  const cart = useCart();
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ productId: product.id, quantity: Number(quantity) }] }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);

    if (res.ok) {
      const { order } = body;
      const line = order.items[0];
      setStatus({
        ok: true,
        text: `Order #${order.id}: ${line.quantity} × ${formatCents(line.unitPriceCents)} = ${formatCents(order.totalCents)}`,
      });
      router.refresh(); // show the new stock level
    } else {
      setStatus({ ok: false, text: apiErrorMessage(body, res.status) });
    }
  }

  function addToCart() {
    if (!cart) return;
    const n = Number(quantity);
    if (!Number.isInteger(n) || n < 1) {
      setStatus({ ok: false, text: "Quantity must be a whole number of 1 or more." });
      return;
    }
    const inCart = cart.lines.find((l) => l.productId === product.id)?.quantity ?? 0;
    if (inCart + n > remaining) {
      const canAdd = Math.max(0, remaining - inCart);
      setStatus({
        ok: false,
        text:
          `Limit is ${MAX_UNITS_PER_CUSTOMER} per customer. ` +
          (canAdd === 0
            ? "You can't add any more of this."
            : `You can add ${canAdd} more.`),
      });
      return;
    }
    cart.add(
      { productId: product.id, name: product.name, priceCents: product.priceCents, maxQuantity: remaining },
      n,
    );
    cart.setOpen(true);
    setStatus(null);
  }

  if (remaining === 0) {
    return (
      <span className="error">
        Limit reached ({MAX_UNITS_PER_CUSTOMER} per customer)
      </span>
    );
  }

  return (
    <form className="inline" onSubmit={onSubmit}>
      <input
        type="number"
        min={1}
        max={remaining}
        step={1}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        aria-label="Quantity"
      />
      <button type="submit" disabled={busy}>
        {busy ? "Ordering..." : "Buy now"}
      </button>
      {cart && (
        <button type="button" onClick={addToCart}>
          Add to cart
        </button>
      )}
      {Number(quantity) >= remaining && <LimitHint remaining={remaining} />}
      {status && <span className={status.ok ? "success" : "error"}>{status.text}</span>}
    </form>
  );
}

/** Shown when the quantity is at the cap, so the customer knows why it won't go higher. */
export function LimitHint({ remaining }: { remaining: number }) {
  const bought = MAX_UNITS_PER_CUSTOMER - remaining;
  return (
    <small className="hint">
      Limit {MAX_UNITS_PER_CUSTOMER} per customer for each product
      {bought > 0 && ` (you've already bought ${bought})`}.
    </small>
  );
}
