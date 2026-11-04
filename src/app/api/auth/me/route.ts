import { requireUser } from "@/server/http/auth";
import { route } from "@/server/http/handler";

// GET /api/auth/me - the logged-in user, or 401.
export const GET = route((req: Request) => Response.json({ user: requireUser(req) }));
