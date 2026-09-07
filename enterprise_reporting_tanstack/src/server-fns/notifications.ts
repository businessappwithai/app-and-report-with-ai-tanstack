import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/config";

async function getSession() {
  const cookie = getRequestHeader("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export const fetchNotificationsFn = createServerFn({ method: "GET" })
  .inputValidator((data: { includeRead?: boolean }) => data)
  .handler(async ({ data: { includeRead = false } }) => {
    try {
      const session = await getSession();
      if (!session?.user) {
        return { success: false, data: [], error: "Unauthorized" };
      }

      const db = getDb();
      let query = (db as any)
        .selectFrom("notifications")
        .where("user_id", "=", session.user.id)
        .orderBy("created_at", "desc")
        .limit(50);

      if (!includeRead) {
        query = query.where("is_read", "=", 0);
      }

      const rows = await query.selectAll().execute();
      return { success: true, data: rows };
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Failed to fetch notifications",
      };
    }
  });

export const markNotificationAsReadFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data: { id } }) => {
    try {
      const session = await getSession();
      if (!session?.user) {
        return { success: false, error: "Unauthorized" };
      }

      const db = getDb();
      await (db as any)
        .updateTable("notifications")
        .set({ is_read: 1 })
        .where("id", "=", id)
        .where("user_id", "=", session.user.id)
        .execute();

      return { success: true };
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update notification",
      };
    }
  });

export const markAllNotificationsAsReadFn = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      const session = await getSession();
      if (!session?.user) {
        return { success: false, error: "Unauthorized" };
      }

      const db = getDb();
      await (db as any)
        .updateTable("notifications")
        .set({ is_read: 1 })
        .where("user_id", "=", session.user.id)
        .where("is_read", "=", 0)
        .execute();

      return { success: true };
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update notifications",
      };
    }
  }
);

export const deleteNotificationFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data: { id } }) => {
    try {
      const session = await getSession();
      if (!session?.user) {
        return { success: false, error: "Unauthorized" };
      }

      const db = getDb();
      await (db as any)
        .deleteFrom("notifications")
        .where("id", "=", id)
        .where("user_id", "=", session.user.id)
        .execute();

      return { success: true };
    } catch (error) {
      console.error("Error deleting notification:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete notification",
      };
    }
  });
