import Link from "next/link";
import { formatCents } from "@/lib/format";
import { getCurrentUser } from "@/server/http/currentUser";
import { listMyOrders } from "@/server/services/orderService";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" });

// Same rule as GET /api/orders: the user comes from the session, never from the URL.
export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <h1>My orders</h1>
        <p>
          <Link href="/login">Log in</Link> to see your orders.
        </p>
      </>
    );
  }

  const orders = listMyOrders(user.id);

  return (
    <>
      <h1>My orders</h1>
      {orders.length === 0 ? (
        <p>
          No orders yet. <Link href="/">Browse the current release</Link>.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Items</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  #{o.id}
                  <br />
                  <small>{dateFormat.format(new Date(o.createdAt))}</small>
                </td>
                <td>
                  {o.items.map((i) => (
                    <div key={i.productId}>
                      {i.quantity} × {i.name} @ {formatCents(i.unitPriceCents)}
                    </div>
                  ))}
                </td>
                <td>{formatCents(o.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
