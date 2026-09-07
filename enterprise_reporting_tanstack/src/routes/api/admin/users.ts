import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { auth } from "@/lib/auth/config";
import { getDb } from "@/lib/db/config";

async function getSession(request: Request) {
  return auth(request);
}

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const db = getDb();
          const users = await db
            .selectFrom("users")
            .selectAll()
            .orderBy("created_at", "desc")
            .execute();

          return json({ success: true, data: users });
        } catch (error) {
          console.error("Error fetching users:", error);
          return json(
            { success: false, error: { message: "Failed to fetch users" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
