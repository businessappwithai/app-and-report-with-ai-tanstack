import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

let _dbReady = false;
async function ensureDb() {
  if (!_dbReady) {
    _dbReady = true;
    const { runMigrations } = await import("@appwithai/core/services");
    await runMigrations().catch((err) => console.error("[DB] Migration error:", err));
  }
}

export const Route = createFileRoute("/api/rules/$ruleId/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        await ensureDb();
        const caller = await requireUser(request, `rule:${params.ruleId}`);
        if (caller.response) return caller.response;

        try {
          const { rulesDb } = await import("@appwithai/core/services");
          const rule = await rulesDb.findById(params.ruleId);
          if (!rule) {
            return new Response(JSON.stringify({ error: "Rule not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ rule }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error fetching rule:", error);
          return new Response(JSON.stringify({ error: "Failed to fetch rule" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      PUT: async ({ request, params }) => {
        await ensureDb();
        const caller = await requireUser(request, `rule:${params.ruleId}`, "write");
        if (caller.response) return caller.response;

        try {
          const { rulesDb } = await import("@appwithai/core/services");
          const body = await request.json();
          const { entityName, ruleName, operation, jdmContent } = body;

          const existing = await rulesDb.findById(params.ruleId);
          if (!existing) {
            return new Response(JSON.stringify({ error: "Rule not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const rule = await rulesDb.update(params.ruleId, {
            entityName,
            ruleName,
            operation,
            jdmContent,
          });
          return new Response(JSON.stringify({ success: true, rule }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error updating rule:", error);
          return new Response(JSON.stringify({ error: "Failed to update rule" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      DELETE: async ({ request, params }) => {
        await ensureDb();
        const caller = await requireUser(request, `rule:${params.ruleId}`, "delete");
        if (caller.response) return caller.response;

        try {
          const { rulesDb } = await import("@appwithai/core/services");
          const existing = await rulesDb.findById(params.ruleId);
          if (!existing) {
            return new Response(JSON.stringify({ error: "Rule not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          await rulesDb.delete(params.ruleId);
          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error deleting rule:", error);
          return new Response(JSON.stringify({ error: "Failed to delete rule" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
