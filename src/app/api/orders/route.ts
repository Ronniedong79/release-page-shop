import { requireRole } from "@/server/http/auth";
import { route } from "@/server/http/handler";
import { parseBody, placeOrderSchema } from "@/server/http/validation";
import { placeOrder } from "@/server/services/orderService";

// POST /api/orders (customer) { items: [{ productId, quantity }] }
// Any price fields in the body are dropped by the schema; prices come from the database.
export const POST = route(async (req: Request) => {
  const customer = requireRole(req, "customer"); // rule 1: admins can't order either
  const { items } = await parseBody(req, placeOrderSchema);
  return Response.json({ order: placeOrder(customer.id, items) }, { status: 201 });
});
