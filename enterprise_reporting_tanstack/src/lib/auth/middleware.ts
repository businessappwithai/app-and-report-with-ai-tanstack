"use server";

import { getRequestHeader } from "@tanstack/react-start/server";
import { verifySession as _verifySession } from "./session";

// Get session from current request context in TanStack Start
export async function getServerSession() {
  try {
    const cookie = getRequestHeader("cookie") || "";
    const match = cookie.match(/session_token=([^;]+)/);
    const sessionToken = match?.[1];

    if (sessionToken) {
      const session = await _verifySession(sessionToken);
      return session;
    }
  } catch (e) {
    console.error("Failed to get session:", e);
  }

  return null;
}

// Enforce authentication in server functions
export async function requireAuth() {
  const session = await getServerSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
