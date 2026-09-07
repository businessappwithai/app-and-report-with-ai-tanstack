import { type Session, verifySession } from "./session";

export type { Session };

export async function auth(request?: Request): Promise<Session | null> {
  let req = request;
  if (!req) {
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      req = getRequest();
    } catch {
      return null;
    }
  }

  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export async function getAuthSession(request?: Request): Promise<Session | null> {
  return auth(request);
}
