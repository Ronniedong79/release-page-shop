import { requireRole, requireUser } from "@/server/http/auth";
import { route } from "@/server/http/handler";
import { parseBody, placeOrderSchema } from "@/server/http/validation";
import { listMyOrders, placeOrder } from "@/server/services/orderService";

// GET /api/orders - the caller's own order history (rule 2).
// There is deliberately no userId parameter: the user comes only from the session.
export const GET = route((req: Request) => {
  const user = requireUser(req);
  return Response.json({ orders: listMyOrders(user.id) });
});

// POST /api/orders (customer) { items: [{ productId, quantity }] }
// Any price fields in the body are dropped by the schema; prices come from the database.
export const POST = route(async (req: Request) => {
  const customer = requireRole(req, "customer"); // rule 1: admins can't order either
  const { items } = await parseBody(req, placeOrderSchema);
  return Response.json({ order: placeOrder(customer.id, items) }, { status: 201 });
});
