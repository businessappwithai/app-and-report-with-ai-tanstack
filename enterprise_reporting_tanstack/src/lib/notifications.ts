import { getDb } from "./db/config";

export async function createNotification(params: {
  userId: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  metadata?: Record<string, any>;
}) {
  const db = getDb();
  const id = crypto.randomUUID();
  await (db as any)
    .insertInto("notifications")
    .values({
      id,
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    })
    .execute();
  return { id };
}

export async function createNotificationForAllUsers(params: {
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  metadata?: Record<string, any>;
}) {
  const db = getDb();
  const users = await db.selectFrom("users").where("is_active", "=", true).select("id").execute();

  const notifications = await Promise.all(
    users.map((user) =>
      (db as any).insertInto("notifications").values({
        user_id: user.id,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      })
    )
  );

  return notifications;
}
