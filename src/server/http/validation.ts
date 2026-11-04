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

// ---- request schemas ----

export const loginSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }).max(254),
  password: z.string({ error: "Password is required." }).min(1, "Password is required.").max(200),
});
