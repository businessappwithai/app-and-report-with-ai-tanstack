import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";

async function getSession(_request: Request) {
  const { getAuthSession } = await import("@/lib/auth/config");
  return getAuthSession();
}

export const Route = createFileRoute("/api/charts/$id/filters")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session) {
            return json({ error: "Unauthorized" }, { status: 401 });
          }

          // For now, return empty filters array
          // Charts can be extended with filter support later
          return json([]);
        } catch (error) {
          console.error("Error fetching chart filters:", error);
          return json({ error: "Failed to fetch chart filters" }, { status: 500 });
        }
      },
    },
  },
});
