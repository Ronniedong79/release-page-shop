import { z } from "zod";
import { badRequest } from "../errors";

/** Parse a JSON body and validate it. Throws a 400 with per-field details on failure. */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("INVALID_JSON", "Request body must be valid JSON.");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest(
      "VALIDATION_ERROR",
      "Some fields are missing or invalid.",
      result.error.issues.map((i) => ({
        field: i.code === "unrecognized_keys" ? i.keys.join(", ") : i.path.join("."),
        message: i.message,
      })),
    );
  }
  return result.data;
}

/** Route param like /products/[id] -> positive integer, or 400. */
export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw badRequest("INVALID_ID", "Id must be a positive whole number.");
  }
  return id;
}

// ---- request schemas ----

// Money is whole cents (e.g. 12900 = $129.00) so there are no rounding errors.
const priceCents = z
  .number({ error: "priceCents must be a number." })
  .int("priceCents must be a whole number of cents.")
  .min(0, "priceCents can't be negative.")
  .max(100_000_000, "priceCents is unrealistically large.");

const stock = z
  .number({ error: "stock must be a number." })
  .int("stock must be a whole number.")
  .min(0, "stock can't be negative.")
  .max(1_000_000, "stock is unrealistically large.");

// Admin schemas are strict: an unexpected field is probably a client bug, so say so.
export const createProductSchema = z.strictObject({
  sku: z
    .string({ error: "sku is required." })
    .trim()
    .regex(/^[A-Z0-9-]{1,32}$/, "sku must be 1-32 characters: A-Z, 0-9 or '-'."),
  name: z.string({ error: "name is required." }).trim().min(1, "name is required.").max(120),
  priceCents,
  stock,
});

export const updatePriceSchema = z.strictObject({ priceCents });
export const updateStockSchema = z.strictObject({ stock });

export const loginSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }).max(254),
  password: z.string({ error: "Password is required." }).min(1, "Password is required.").max(200),
});
