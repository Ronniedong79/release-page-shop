"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatCents } from "@/lib/format";

type Status = { ok: boolean; text: string } | null;

/**
 * Order form for one product. It only sends productId and quantity: the price is
 * decided by the server, and the confirmation shows what was actually charged.
 */
export function BuyForm({ productId }: { productId: number }) {
  const router = useRouter();
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
      body: JSON.stringify({ items: [{ productId, quantity: Number(quantity) }] }),
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
      const err = body?.error;
      const details = Array.isArray(err?.details)
        ? " " + err.details.map((d: { message: string }) => d.message).join(" ")
        : "";
      setStatus({ ok: false, text: (err?.message ?? `Order failed (${res.status}).`) + details });
    }
  }

  return (
    <form className="inline" onSubmit={onSubmit}>
      <input
        type="number"
        min={1}
        step={1}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        aria-label="Quantity"
      />
      <button type="submit" disabled={busy}>
        {busy ? "Ordering..." : "Buy"}
      </button>
      {status && <span className={status.ok ? "success" : "error"}>{status.text}</span>}
    </form>
  );
}
