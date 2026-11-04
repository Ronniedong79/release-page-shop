import Link from "next/link";
import { formatCents } from "@/lib/format";
import { getCurrentUser } from "@/server/http/currentUser";
import { listAvailableProducts } from "@/server/services/productService";
import { BuyForm } from "./BuyForm";

// Prices and stock change during the day: render on every request, never from a build-time cache.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const products = listAvailableProducts();
  const isCustomer = user?.role === "customer";

  return (
    <>
      <h1>Current release</h1>
      {!user && (
        <p>
          <Link href="/login">Log in</Link> to buy.
        </p>
      )}
      {products.length === 0 ? (
        <p>Nothing available right now.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>In stock</th>
              {isCustomer && <th>Buy</th>}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{formatCents(p.priceCents)}</td>
                <td>{p.stock}</td>
                {isCustomer && (
                  <td>
                    <BuyForm productId={p.id} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
