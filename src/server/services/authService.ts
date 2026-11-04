import crypto from "node:crypto";
import { getDb } from "../db/connection";
import { AppError } from "../errors";
import { hashPassword, verifyPassword } from "../lib/password";
import * as sessions from "../repositories/sessionRepository";
import * as users from "../repositories/userRepository";

export type Role = "customer" | "admin";
export type AuthUser = sessions.SessionUser;

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// Compared against when the email doesn't exist, so a login for an unknown email takes
// about as long as one with a wrong password (doesn't reveal which emails are registered).
let dummyHash: string | undefined;

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export function login(email: string, password: string) {
  const user = users.findByEmail(getDb(), email);
  const ok = verifyPassword(password, user?.passwordHash ?? (dummyHash ??= hashPassword("x")));
  if (!user || !ok) {
    // Same message either way: don't tell an attacker which part was wrong.
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  sessions.create(getDb(), hashToken(token), user.id, expiresAt);

  return {
    token,
    expiresAt,
    user: { id: user.id, email: user.email, role: user.role } satisfies AuthUser,
  };
}

export function getUserBySessionToken(token: string): AuthUser | null {
  return sessions.findUser(getDb(), hashToken(token), new Date().toISOString()) ?? null;
}

export function logout(token: string): void {
  sessions.remove(getDb(), hashToken(token));
}
