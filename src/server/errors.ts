/**
 * An expected, user-facing error. Services throw these; the HTTP layer turns them
 * into `{ error: { code, message, details } }` with the matching status code.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = (message = "Please log in to do that.") =>
  new AppError(401, "UNAUTHENTICATED", message);

export const forbidden = (message = "You don't have permission to do that.") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (message: string) => new AppError(404, "NOT_FOUND", message);

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);

export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
