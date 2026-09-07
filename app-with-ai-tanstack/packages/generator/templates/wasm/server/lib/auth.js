/**
 * Sessions and passwords.
 *
 * Better Auth backs the NestJS stack; it expects a Node process, a signing
 * secret and a durable server, and this application has none of the three — it
 * is a database and a server living in one browser tab. So authentication here
 * is the smallest thing that is still real: PBKDF2-hashed passwords, opaque
 * random session tokens in a row that can be deleted, and a cookie.
 *
 * PBKDF2 through WebCrypto rather than the fixed-salt SHA-256 the modelling
 * tool still carries: there are no existing hashes to stay compatible with in
 * an application that was generated a moment ago, so there is no reason to
 * inherit that constraint.
 *
 * What this does not pretend to be: a boundary against the person using the
 * browser. They own the tab, the IndexedDB file and the whole database — roles
 * here decide what the application shows and refuses, exactly as they do on a
 * server, but a local database is not a secret from its owner. Say so rather
 * than implying otherwise.
 */

const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const encoder = new TextEncoder();

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return toHex(buffer);
}

async function derive(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return toHex(bits);
}

/** `pbkdf2$<iterations>$<salt>$<hash>` — self-describing, so it can be rotated. */
export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derive(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${hash}`;
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = String(stored).split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const salt = fromHex(parts[2]);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: Number(parts[1]) },
    key,
    256
  );
  return timingSafeEqual(toHex(bits), parts[3]);
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export const SESSION_COOKIE = "appwithai_session";

export function readCookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(token, maxAgeSeconds = SESSION_TTL_MS / 1000) {
  // No `Secure`: the app is routinely opened over plain http on localhost, and
  // a cookie the browser refuses to store is a login that silently never sticks.
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${Math.floor(maxAgeSeconds)}`;
}

export const clearedSessionCookie = () =>
  `${SESSION_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;

export async function createSession(db, userId, userAgent) {
  const token = randomToken();
  await db.insert("sys_session", {
    token,
    sys_user_id: userId,
    expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    user_agent: userAgent || null,
  });
  return token;
}

/** Resolve the caller: the user row plus the role names they hold. */
export async function resolveSession(db, request) {
  const token = readCookie(request, SESSION_COOKIE) ||
    (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    null;
  if (!token) return null;

  const row = await db.one(
    `SELECT u.sys_user_id, u.name, u.email, u.is_active, s.expires_at
       FROM sys_session s
       JOIN sys_user u ON u.sys_user_id = s.sys_user_id
      WHERE s.token = $1`,
    [token]
  );
  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.remove("sys_session", { token });
    return null;
  }
  if (row.is_active === false) return null;

  const roles = await db.query(
    `SELECT r.name, r.is_admin
       FROM sys_user_roles ur
       JOIN sys_role r ON r.sys_role_id = ur.role_id
      WHERE ur.user_id = $1 AND ur.is_active = true`,
    [row.sys_user_id]
  );

  return {
    id: row.sys_user_id,
    name: row.name,
    email: row.email,
    token,
    roles: roles.map((role) => role.name),
    isAdmin: roles.some((role) => role.is_admin === true),
  };
}

export async function destroySession(db, token) {
  if (token) await db.remove("sys_session", { token });
}
