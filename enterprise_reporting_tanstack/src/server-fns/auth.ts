import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { verifySession } from "@/lib/auth/session";
import { createLogger } from "@/lib/logging/logger";
import { AUDIT_ACTIONS } from "@/types/actions";
import { LOG_COMPONENTS } from "@/types/components";

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const logger = createLogger({ component: LOG_COMPONENTS.Authentication });

  try {
    const cookie = getRequestHeader("cookie") || "";
    const match = cookie.match(/session_token=([^;]+)/);
    const token = match?.[1];

    if (token) {
      const session = await verifySession(token);
      if (session?.user) {
        logger.info("User logout", {
          userId: session.user.id,
          email: session.user.email,
          userName: session.user.name,
          action: AUDIT_ACTIONS.AUTH.LOGOUT,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    logger.debug("Error logging logout action", {
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }

  setResponseHeader("Set-Cookie", "session_token=; Path=/; HttpOnly; Max-Age=0");
  throw redirect({ to: "/login" });
});

export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const cookie = getRequestHeader("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
});
