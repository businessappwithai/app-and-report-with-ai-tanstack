/**
 * CopilotKit endpoint — exact path.
 *
 * The runtime itself lives in `lib/copilot-runtime.ts`; this file and the `$`
 * splat beside it both delegate to it, so the adapter is configured once
 * instead of the two routes drifting apart.
 */

import { createFileRoute } from "@tanstack/react-router";
import { copilotError, handleCopilotRequest } from "@/lib/copilot-runtime";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/api/copilotkit")({
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
