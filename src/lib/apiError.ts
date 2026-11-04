/** Turn our API's `{ error: { message, details } }` body into one readable line. */
export function apiErrorMessage(body: unknown, status: number): string {
  const err = (body as { error?: { message?: string; details?: unknown } } | null)?.error;
  const details = Array.isArray(err?.details)
    ? " " + err.details.map((d: { message?: string }) => d.message).filter(Boolean).join(" ")
    : "";
  return (err?.message ?? `Request failed (${status}).`) + details;
}
