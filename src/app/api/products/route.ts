import { route } from "@/server/http/handler";
import { listAvailableProducts } from "@/server/services/productService";

// GET /api/products - available products with current prices.
export const GET = route(() => Response.json({ products: listAvailableProducts() }));
