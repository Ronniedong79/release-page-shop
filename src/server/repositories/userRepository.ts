import type { Db } from "../db/connection";

export interface UserWithPassword {
  id: number;
  email: string;
  role: "customer" | "admin";
  passwordHash: string;
}

export function findByEmail(db: Db, email: string): UserWithPassword | undefined {
  return db
    .prepare(
      "SELECT id, email, role, password_hash AS passwordHash FROM users WHERE email = ?",
    )
    .get(email) as UserWithPassword | undefined;
}
