"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCents } from "@/lib/format";
import type { ProductDto } from "@/server/services/productService";

type Status = { ok: boolean; text: string } | null;

/** Call one of our admin APIs; returns a message to show next to the control. */
async function send(method: string, url: string, body: unknown): Promise<Status> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true, text: "Saved." };
  return { ok: false, text: apiErrorMessage(await res.json().catch(() => null), res.status) };
}

// The form takes dollars for convenience; the API only ever receives whole cents.
const toCents = (dollars: string) => Math.round(Number(dollars) * 100);

function ProductRow({ product }: { product: ProductDto }) {
  const router = useRouter();
  const [price, setPrice] = useState((product.priceCents / 100).toFixed(2));
  const [stock, setStock] = useState(String(product.stock));
  const [status, setStatus] = useState<Status>(null);

  async function save(kind: "price" | "stock") {
    const body = kind === "price" ? { priceCents: toCents(price) } : { stock: Number(stock) };
    const result = await send("PATCH", `/api/products/${product.id}/${kind}`, body);
    setStatus(result);
    if (result?.ok) router.refresh();
  }

  return (
    <tr>
      <td>
        {product.name}
        <br />
        <small>{product.sku}</small>
      </td>
      <td>
        {formatCents(product.priceCents)}
        <div className="inline">
          $<input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
          <button onClick={() => save("price")}>Update price</button>
        </div>
      </td>
      <td>
        {product.stock === 0 ? <span className="error">Sold out</span> : product.stock}
        <div className="inline">
          <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" />
          <button onClick={() => save("stock")}>Update stock</button>
        </div>
      </td>
      <td className={status?.ok ? "success" : "error"}>{status?.text}</td>
    </tr>
  );
}

function NewProductForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const result = await send("POST", "/api/products", {
      sku: String(form.get("sku")).toUpperCase(),
      name: form.get("name"),
      priceCents: toCents(String(form.get("price"))),
      stock: Number(form.get("stock")),
    });
    setStatus(result?.ok ? { ok: true, text: "Product created." } : result);
    if (result?.ok) {
      formEl.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <input name="sku" placeholder="SKU, e.g. PHOENIX-04" required />
      <input name="name" placeholder="Name" required />
      <input name="price" placeholder="Price in $, e.g. 150.00" inputMode="decimal" required />
      <input name="stock" placeholder="Stock, e.g. 4" inputMode="numeric" required />
      <button type="submit">Create product</button>
      {status && <p className={status.ok ? "success" : "error"}>{status.text}</p>}
    </form>
  );
}

export function AdminPanel({ products }: { products: ProductDto[] }) {
  return (
    <>
      <h2>Products</h2>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Stock</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </tbody>
      </table>

      <h2>New product</h2>
      <NewProductForm />
    </>
  );
}
