import { formatCents } from "@/lib/format";
import { listAvailableProducts } from "@/server/services/productService";

// Prices and stock change during the day: render on every request, never from a build-time cache.
export const dynamic = "force-dynamic";

export default function HomePage() {
  const products = listAvailableProducts();

  return (
    <>
      <h1>Current release</h1>
      {products.length === 0 ? (
        <p>Nothing available right now.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>In stock</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{formatCents(p.priceCents)}</td>
                <td>{p.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
