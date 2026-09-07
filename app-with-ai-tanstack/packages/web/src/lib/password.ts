/**
 * Password hashing for the generator app's own accounts.
 *
 * Login, registration and the container bootstrap all have to agree on this
 * byte for byte — a bootstrap account hashed differently is an account nobody
 * can sign into — so it lives in one place rather than being reimplemented at
 * each call site.
 *
 * This is a fixed-salt SHA-256, which is weak: it is fast to brute-force and
 * identical passwords produce identical hashes. It is kept as-is because the
 * stored hashes are in this format already and changing it silently locks every
 * existing user out. Replacing it means a migration that rehashes on next
 * successful login, not an edit here.
 */

const SALT = "salt-key";

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}${SALT}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
