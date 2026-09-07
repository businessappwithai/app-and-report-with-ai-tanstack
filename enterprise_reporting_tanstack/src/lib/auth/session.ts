import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { getDb } from "@/lib/db/config";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export interface Session {
  user: SessionUser;
  expires: string;
}

const authSecret = process.env.AUTH_SECRET;
if (!authSecret || authSecret.length < 32) {
  throw new Error(
    "[FATAL] AUTH_SECRET env var is missing or too short (minimum 32 characters). " +
      "Set a secure random string: openssl rand -base64 32"
  );
}
const SECRET = new TextEncoder().encode(authSecret);

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const sessionUser = payload.user as SessionUser;

    // Confirm the user still exists — guards against stale sessions after DB reseed
    const db = getDb();
    const user = await db
      .selectFrom("users")
      .select("id")
      .where("id", "=", sessionUser.id)
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (!user) return null;

    return {
      user: sessionUser,
      expires: new Date((payload.exp ?? 0) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const db = getDb();

  const user = await db
    .selectFrom("users")
    .where("email", "=", email)
    .where("is_active", "=", true)
    .selectAll()
    .executeTakeFirst();

  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  const roles = await db
    .selectFrom("roles")
    .innerJoin("user_roles", "roles.id", "user_roles.role_id")
    .where("user_roles.user_id", "=", user.id)
    .selectAll("roles")
    .execute();

  const permissions = roles.flatMap((role: { permissions: string }) => {
    try {
      return JSON.parse(role.permissions);
    } catch {
      return [];
    }
  });

  return {
    id: user.id,
    email: user.email,
    name: user.display_name,
    roles: roles.map((r: { name: string }) => r.name),
    permissions: Array.from(new Set(permissions)) as string[],
  };
}
