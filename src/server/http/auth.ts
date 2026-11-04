import { forbidden, unauthorized } from "../errors";
import { getUserBySessionToken, type AuthUser, type Role } from "../services/authService";

export const SESSION_COOKIE = "session";

/** Session token from `Authorization: Bearer <token>` (API clients) or the session cookie (browser). */
export function getSessionToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim() || null;

  const cookies = req.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("=")) || null;
  }
  return null;
}

/** 401 unless the request carries a valid, unexpired session. */
export function requireUser(req: Request): AuthUser {
  const token = getSessionToken(req);
  const user = token ? getUserBySessionToken(token) : null;
  if (!user) throw unauthorized();
  return user;
}

/** 401 if not logged in, 403 if logged in with the wrong role (rule 1). */
export function requireRole(req: Request, role: Role): AuthUser {
  const user = requireUser(req);
  if (user.role !== role) {
    throw forbidden(role === "admin" ? "Only admins can do that." : "Only customers can do that.");
  }
  return user;
}
