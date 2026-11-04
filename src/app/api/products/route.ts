import { requireRole } from "@/server/http/auth";
import { route } from "@/server/http/handler";
import { createProductSchema, parseBody } from "@/server/http/validation";
import { createProduct, listAvailableProducts } from "@/server/services/productService";

// GET /api/products - available products with current prices.
export const GET = route(() => Response.json({ products: listAvailableProducts() }));

// POST /api/products (admin) { sku, name, priceCents, stock }
export const POST = route(async (req: Request) => {
  const admin = requireRole(req, "admin");
  const input = await parseBody(req, createProductSchema);
  return Response.json({ product: createProduct(input, admin.id) }, { status: 201 });
});
