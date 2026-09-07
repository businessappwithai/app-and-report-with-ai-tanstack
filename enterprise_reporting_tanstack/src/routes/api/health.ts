import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        return json({ status: "ok", timestamp: new Date().toISOString() });
      },
    },
  },
});
