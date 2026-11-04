import { cookies } from "next/headers";
import { getUserBySessionToken, type AuthUser } from "../services/authService";
import { SESSION_COOKIE } from "./auth";

/** The logged-in user for a Server Component (reads the session cookie), or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? getUserBySessionToken(token) : null;
}
