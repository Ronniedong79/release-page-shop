import { listAvailableProducts } from "@/server/services/productService";

// GET /api/products - available products with current prices.
export function GET() {
  return Response.json({ products: listAvailableProducts() });
}
