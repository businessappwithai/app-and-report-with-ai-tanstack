/**
 * CopilotKit endpoint — splat.
 *
 * The client posts to sub-paths under `/api/copilotkit`, so this catches those
 * and hands them to the same runtime the exact-path route uses.
 */

import { createFileRoute } from "@tanstack/react-router";
import { copilotError, handleCopilotRequest } from "@/lib/copilot-runtime";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/api/copilotkit/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await requireUser(request, "copilotkit", "read");
        if (caller.response) return caller.response;

        try {
          return await handleCopilotRequest(request, "/api/copilotkit");
        } catch (error) {
          return copilotError(error, "GET");
        }
      },
      POST: async ({ request }) => {
        const caller = await requireUser(request, "copilotkit", "write");
        if (caller.response) return caller.response;

        try {
          return await handleCopilotRequest(request, "/api/copilotkit");
        } catch (error) {
          return copilotError(error, "POST");
        }
      },
    },
  },
});
