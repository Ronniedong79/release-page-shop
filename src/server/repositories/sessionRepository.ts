import type { Db } from "../db/connection";

export interface SessionUser {
  id: number;
  email: string;
  role: "customer" | "admin";
}

export function create(db: Db, tokenHash: string, userId: number, expiresAt: string): void {
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    tokenHash,
    userId,
    expiresAt,
  );
}

/** The user behind a session, only if the session hasn't expired. */
export function findUser(db: Db, tokenHash: string, nowIso: string): SessionUser | undefined {
  return db
    .prepare(
      `SELECT u.id, u.email, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, nowIso) as SessionUser | undefined;
}

export function remove(db: Db, tokenHash: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}
