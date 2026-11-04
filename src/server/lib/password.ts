import crypto from "node:crypto";

// scrypt is built into Node, so no extra dependency is needed.
const KEY_LENGTH = 64;

/** Returns "salt:hash" (both hex). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  // constant-time comparison so response timing doesn't leak how close a guess was
  return crypto.timingSafeEqual(actual, expected);
}
