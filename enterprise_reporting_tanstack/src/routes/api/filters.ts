import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { auth } from "@/lib/auth/config";
import { getDb } from "@/lib/db/config";

async function getSession(request: Request) {
  return auth(request);
}

export const Route = createFileRoute("/api/filters")({
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
          const filters = await db.selectFrom("filter_definitions").selectAll().execute();

          return json({ success: true, data: filters });
        } catch (error) {
          console.error("Error fetching filters:", error);
          return json(
            { success: false, error: { message: "Failed to fetch filters" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
