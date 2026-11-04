import { requireRole } from "@/server/http/auth";
import { route } from "@/server/http/handler";
import { parseBody, parseId, updateStockSchema } from "@/server/http/validation";
import { updateStock } from "@/server/services/productService";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/products/:id/stock (admin) { stock }
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  requireRole(req, "admin");
  const id = parseId((await params).id);
  const { stock } = await parseBody(req, updateStockSchema);
  return Response.json({ product: updateStock(id, stock) });
});
