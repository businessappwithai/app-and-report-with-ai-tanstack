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

export const Route = createFileRoute("/api/projects/$id/members/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
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
            return new Response(JSON.stringify({ error: "Only owner can view members" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          const members = await db
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
            .execute();

          return new Response(JSON.stringify({ members }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error fetching members:", error);
          return new Response(JSON.stringify({ error: "Failed to fetch members" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      POST: async ({ request, params }) => {
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
            return new Response(JSON.stringify({ error: "Only owner can add members" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          const body = await request.json();
          const { email, permission = "read_only" } = body as {
            email: string;
            permission?: string;
          };

          if (!email) {
            return new Response(JSON.stringify({ error: "Email is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const targetUser = await db
            .selectFrom("auth_users")
            .selectAll()
            .where("email", "=", email)
            .executeTakeFirst();

          if (!targetUser) {
            return new Response(JSON.stringify({ error: "User not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (targetUser.id === user.id) {
            return new Response(JSON.stringify({ error: "Cannot share with yourself" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const existingMember = await db
            .selectFrom("project_members")
            .selectAll()
            .where("project_id", "=", projectId)
            .where("user_id", "=", targetUser.id)
            .executeTakeFirst();

          if (existingMember) {
            return new Response(JSON.stringify({ error: "User is already a member" }), {
              status: 409,
              headers: { "Content-Type": "application/json" },
            });
          }

          const memberId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const now = new Date().toISOString();

          await db
            .insertInto("project_members")
            .values({
              id: memberId,
              project_id: projectId,
              user_id: targetUser.id,
              permission,
              created_at: now,
            })
            .execute();

          const member = await db
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
            .where("project_members.id", "=", memberId)
            .executeTakeFirst();

          return new Response(JSON.stringify({ member }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error adding member:", error);
          return new Response(JSON.stringify({ error: "Failed to add member" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
