import { NextResponse } from "next/server";
import { getSessionToken, SESSION_COOKIE } from "@/server/http/auth";
import { route } from "@/server/http/handler";
import { logout } from "@/server/services/authService";

// POST /api/auth/logout - deletes the session server-side, so the token stops working immediately.
export const POST = route((req: Request) => {
  const token = getSessionToken(req);
  if (token) logout(token);

  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
