import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/http/auth";
import { route } from "@/server/http/handler";
import { loginSchema, parseBody } from "@/server/http/validation";
import { login } from "@/server/services/authService";

// POST /api/auth/login  { email, password }
// Sets an httpOnly session cookie for the browser and also returns the token for API clients.
export const POST = route(async (req: Request) => {
  const { email, password } = await parseBody(req, loginSchema);
  const session = login(email, password);

  const res = NextResponse.json({ token: session.token, expiresAt: session.expiresAt, user: session.user });
  res.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true, // not readable from JavaScript, so an XSS bug can't steal it
    sameSite: "lax", // not sent on cross-site POSTs (basic CSRF protection)
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  return res;
});
