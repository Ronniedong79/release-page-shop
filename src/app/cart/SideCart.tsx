"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCents } from "@/lib/format";
import { LimitHint } from "../BuyForm";
import { useCart } from "./CartContext";

type Status = { ok: boolean; text: string; productId?: number } | null;

export function SideCart() {
  const cart = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  if (!cart?.isOpen) return null;

  const estimate = cart.lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);

  async function placeOrder() {
    if (!cart) return;
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Only ids and quantities: the server works out every price (rule 3).
      body: JSON.stringify({
        items: cart.lines.map(({ productId, quantity }) => ({ productId, quantity })),
      }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);

    if (res.ok) {
      cart.clear();
      setStatus({ ok: true, text: `Order #${body.order.id} placed. Charged ${formatCents(body.order.totalCents)}.` });
      router.refresh(); // update stock on the page
    } else {
      // The whole order failed (rule 5); keep the cart so the customer can fix it.
      const productId = body?.error?.details?.productId;
      setStatus({ ok: false, text: apiErrorMessage(body, res.status), productId });
    }
  }

  return (
    <aside className="side-cart" aria-label="Cart">
      <div className="side-cart-head">
        <h2>Your cart</h2>
        <button onClick={() => cart.setOpen(false)} aria-label="Close cart">
          ✕
        </button>
      </div>

      {cart.lines.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <ul>
            {cart.lines.map((l) => (
              <li key={l.productId} className={status?.productId === l.productId ? "problem" : ""}>
                <div>{l.name}</div>
                <div className="inline">
                  <input
                    type="number"
                    min={1}
                    max={l.maxQuantity}
                    step={1}
                    value={l.quantity}
                    onChange={(e) => cart.setQuantity(l.productId, Math.trunc(Number(e.target.value)) || 1)}
                    aria-label={`Quantity of ${l.name}`}
                  />
                  × {formatCents(l.priceCents)}
                  <button onClick={() => cart.remove(l.productId)}>Remove</button>
                  {l.maxQuantity !== undefined && l.quantity >= l.maxQuantity && (
                    <LimitHint remaining={l.maxQuantity} />
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p>
            Estimated total: <strong>{formatCents(estimate)}</strong>
            <br />
            <small>Prices can change during the day; you pay the price at the time you order.</small>
          </p>
          <button onClick={placeOrder} disabled={busy}>
            {busy ? "Placing order..." : "Place order"}
          </button>
        </>
      )}

      {status && <p className={status.ok ? "success" : "error"}>{status.text}</p>}
    </aside>
  );
}
