"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * A cart line. name and priceCents are only for display: when the order is placed
 * we send just productId and quantity, and the server decides the price (rule 3).
 */
export interface CartLine {
  productId: number;
  name: string;
  priceCents: number;
  quantity: number;
  /** Most this customer may still buy (rule 4) when the line was added; UI hint only. */
  maxQuantity?: number;
}

interface Cart {
  lines: CartLine[];
  count: number;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  add: (line: Omit<CartLine, "quantity">, quantity: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

const CartContext = createContext<Cart | null>(null);

/** null when the viewer isn't a customer (no cart for admins or anonymous users). */
export const useCart = () => useContext(CartContext);

// Per-user key, so two customers sharing a browser don't see each other's cart.
const storageKey = (userId: number) => `release-shop:cart:${userId}`;

export function CartProvider({ userId, children }: { userId: number; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isOpen, setOpen] = useState(false);

  // Restore after mount (localStorage doesn't exist during server rendering).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(userId));
      if (saved) setLines(JSON.parse(saved));
    } catch {
      // storage unavailable or corrupt: start with an empty cart
    }
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(lines));
    } catch {
      // storage unavailable: the cart still works for this page view
    }
  }, [lines, loaded, userId]);

  const cart: Cart = {
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    isOpen,
    setOpen,
    // Adding a product that's already in the cart merges the quantities
    // (the API accepts each product only once per order).
    add: (line, quantity) =>
      setLines((prev) =>
        prev.some((l) => l.productId === line.productId)
          ? prev.map((l) =>
              l.productId === line.productId
                ? { ...l, quantity: l.quantity + quantity, maxQuantity: line.maxQuantity }
                : l,
            )
          : [...prev, { ...line, quantity }],
      ),
    // Clamp to 1..maxQuantity so the cart can't be edited past the purchase limit.
    setQuantity: (productId, quantity) =>
      setLines((prev) =>
        prev.map((l) =>
          l.productId === productId
            ? { ...l, quantity: Math.max(1, Math.min(quantity, l.maxQuantity ?? quantity)) }
            : l,
        ),
      ),
    remove: (productId) => setLines((prev) => prev.filter((l) => l.productId !== productId)),
    clear: () => setLines([]),
  };

  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}
