"use client";

import { useCart } from "./CartContext";

export function CartButton() {
  const cart = useCart();
  if (!cart) return null;
  return <button onClick={() => cart.setOpen(!cart.isOpen)}>Cart ({cart.count})</button>;
}
