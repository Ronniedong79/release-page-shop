import { optionalUser, requireRole } from "@/server/http/auth";
import { route } from "@/server/http/handler";
import { createProductSchema, parseBody } from "@/server/http/validation";
import {
  createProduct,
  listAllProducts,
  listAvailableProducts,
} from "@/server/services/productService";

// GET /api/products
// Everyone: products in stock, with current prices.
// Admins: every product, including sold-out ones, so they can find and restock them.
export const GET = route((req: Request) => {
  const isAdmin = optionalUser(req)?.role === "admin";
  return Response.json({ products: isAdmin ? listAllProducts() : listAvailableProducts() });
});

// POST /api/products (admin) { sku, name, priceCents, stock }
export const POST = route(async (req: Request) => {
  const admin = requireRole(req, "admin");
  const input = await parseBody(req, createProductSchema);
  return Response.json({ product: createProduct(input, admin.id) }, { status: 201 });
});
