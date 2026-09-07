import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth-server";

let _dbReady = false;
async function ensureDb() {
  if (!_dbReady) {
    _dbReady = true;
    const { runMigrations } = await import("@appwithai/core/services");
    await runMigrations().catch((err) => console.error("[DB] Migration error:", err));
  }
}

export const Route = createFileRoute("/api/projects/$id/members/$userId/")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        await ensureDb();
        try {
          const { getDatabase } = await import("@appwithai/core/services");
          const user = await getCurrentUser(request);
          if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const db = getDatabase();
          const projectId = params.id as string;
          const targetUserId = params.userId as string;

          const project = await db
            .selectFrom("projects")
            .selectAll()
            .where("id", "=", projectId)
            .executeTakeFirst();

          if (!project) {
            return new Response(JSON.stringify({ error: "Project not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (project.owner_user_id !== user.id) {
            return new Response(JSON.stringify({ error: "Only owner can modify members" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          const body = await request.json();
          const { permission } = body as { permission?: string };

          if (!permission) {
            return new Response(JSON.stringify({ error: "Permission is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const member = await db
            .selectFrom("project_members")
            .selectAll()
            .where("project_id", "=", projectId)
            .where("user_id", "=", targetUserId)
            .executeTakeFirst();

          if (!member) {
            return new Response(JSON.stringify({ error: "Member not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          await db
            .updateTable("project_members")
            .set({ permission })
            .where("project_id", "=", projectId)
            .where("user_id", "=", targetUserId)
            .execute();

          const updated = await db
            .selectFrom("project_members")
            .innerJoin("auth_users", (join) =>
              join.onRef("project_members.user_id", "=", "auth_users.id")
            )
            .select([
              "project_members.id",
              "project_members.user_id",
              "project_members.permission",
              "project_members.created_at",
              "auth_users.email",
              "auth_users.name",
            ])
            .where("project_members.project_id", "=", projectId)
            .where("project_members.user_id", "=", targetUserId)
            .executeTakeFirst();

          return new Response(JSON.stringify({ member: updated }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error updating member:", error);
          return new Response(JSON.stringify({ error: "Failed to update member" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      DELETE: async ({ request, params }) => {
        await ensureDb();
        try {
          const { getDatabase } = await import("@appwithai/core/services");
          const user = await getCurrentUser(request);
          if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const db = getDatabase();
          const projectId = params.id as string;
          const targetUserId = params.userId as string;

          const project = await db
            .selectFrom("projects")
            .selectAll()
            .where("id", "=", projectId)
            .executeTakeFirst();

          if (!project) {
            return new Response(JSON.stringify({ error: "Project not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (project.owner_user_id !== user.id) {
            return new Response(JSON.stringify({ error: "Only owner can remove members" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          const member = await db
            .selectFrom("project_members")
            .selectAll()
            .where("project_id", "=", projectId)
            .where("user_id", "=", targetUserId)
            .executeTakeFirst();

          if (!member) {
            return new Response(JSON.stringify({ error: "Member not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          await db
            .deleteFrom("project_members")
            .where("project_id", "=", projectId)
            .where("user_id", "=", targetUserId)
            .execute();

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error removing member:", error);
          return new Response(JSON.stringify({ error: "Failed to remove member" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
