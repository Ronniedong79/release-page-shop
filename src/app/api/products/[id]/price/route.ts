import { requireRole } from "@/server/http/auth";
import { route } from "@/server/http/handler";
import { parseBody, parseId, updatePriceSchema } from "@/server/http/validation";
import { updatePrice } from "@/server/services/productService";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/products/:id/price (admin) { priceCents }
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const admin = requireRole(req, "admin");
  const id = parseId((await params).id);
  const { priceCents } = await parseBody(req, updatePriceSchema);
  return Response.json({ product: updatePrice(id, priceCents, admin.id) });
});
