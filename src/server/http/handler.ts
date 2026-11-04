import { AppError } from "../errors";

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  // Unexpected: log the real error, but never leak internals to the client.
  console.error(err);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

/** Wrap a route handler so every thrown error becomes a consistent JSON error response. */
export function route<Args extends unknown[]>(
  fn: (req: Request, ...args: Args) => Response | Promise<Response>,
) {
  return async (req: Request, ...args: Args): Promise<Response> => {
    try {
      return await fn(req, ...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
