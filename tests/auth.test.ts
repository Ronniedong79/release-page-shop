import { beforeEach, describe, expect, it } from "vitest";
import * as loginRoute from "@/app/api/auth/login/route";
import * as logoutRoute from "@/app/api/auth/logout/route";
import * as meRoute from "@/app/api/auth/me/route";
import type { Db } from "@/server/db/connection";
import { call, freshDb } from "./helpers";

let db: Db;
beforeEach(() => {
  db = freshDb();
});

const login = (body: unknown) => call(loginRoute.POST, { method: "POST", body });

describe("auth", () => {
  it("logs in a seed user and returns a working token", async () => {
    const res = await login({ email: "alice@example.com", password: "alice123" });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 2, email: "alice@example.com", role: "customer" });

    const me = await call(meRoute.GET, { token: res.body.token });
    expect(me.body.user.email).toBe("alice@example.com");
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    const wrongPassword = await login({ email: "alice@example.com", password: "nope" });
    const unknownEmail = await login({ email: "ghost@example.com", password: "nope" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it("validates the login body", async () => {
    const res = await login({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
      "email",
      "password",
    ]);
  });

  it("stores only a hash of the session token", async () => {
    const { token } = (await login({ email: "bob@example.com", password: "bob123" })).body;
    const stored = db.prepare("SELECT token_hash FROM sessions").pluck().get() as string;
    expect(stored).not.toBe(token);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it("logout invalidates the token immediately", async () => {
    const { token } = (await login({ email: "bob@example.com", password: "bob123" })).body;
    expect((await call(logoutRoute.POST, { method: "POST", token })).status).toBe(204);
    expect((await call(meRoute.GET, { token })).status).toBe(401);
  });
});
