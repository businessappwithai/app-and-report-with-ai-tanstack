/**
 * Who may read or edit a project.
 *
 * A project is owned by the user who created it and shared with the members
 * listed in `project_members`. That rule has to hold for every route that
 * touches a project, not just the ones that happen to remember it: a model is
 * a company's data design, and reading someone else's by guessing an id is the
 * same disclosure whether it arrives as JSON, as an `.mmd` download, or as the
 * parsed sections an editor loads.
 *
 * The check lives here rather than in each route so there is one implementation
 * to keep correct — a copy in one file and not another is exactly how the EML
 * routes ended up open while `/api/projects/$id` was closed.
 */

import { getLogger } from "@appwithai/core/logging";
import { getCurrentUser } from "@/lib/auth-server";

export type ProjectPermission = "read" | "read_write";

export interface ProjectAccessDenied {
  /** The response to return as-is. Present only when access is refused. */
  response: Response;
  user?: undefined;
}

export interface ProjectAccessGranted {
  response?: undefined;
  user: { id: string };
}

export type ProjectAccess = ProjectAccessDenied | ProjectAccessGranted;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Resolve the caller and confirm they may act on this project.
 *
 * Returns either the authenticated user or the response to send back, so a
 * handler guards itself in two lines and cannot forget the failure case:
 *
 * ```ts
 * const access = await requireProjectAccess(request, params.id, "read_write");
 * if (access.response) return access.response;
 * ```
 *
 * A project that does not exist and a project the caller cannot see are both
 * reported as 404 — telling an unauthorised caller that an id is real is itself
 * a disclosure.
 */
export async function requireProjectAccess(
  request: Request,
  projectId: string,
  permission: ProjectPermission = "read"
): Promise<ProjectAccess> {
  const log = getLogger("auth");

  const user = await getCurrentUser(request);
  if (!user) {
    log.event("auth.access.denied", {
      userId: null,
      resource: `project:${projectId}`,
      operation: permission,
      requiredRoles: ["authenticated"],
    });
    return { response: json({ error: "Unauthorized" }, 401) };
  }

  const { getDatabase } = await import("@appwithai/core/services");
  const db = getDatabase();

  const project = await db
    .selectFrom("projects")
    .select(["id", "owner_user_id"])
    .where("id", "=", projectId)
    .executeTakeFirst();

  if (!project) {
    log.event("auth.access.denied", {
      userId: user.id,
      resource: `project:${projectId}`,
      operation: permission,
      requiredRoles: ["member"],
      reason: "no-such-project",
    });
    return { response: json({ error: "Project not found" }, 404) };
  }
  if (project.owner_user_id === user.id) return { user: { id: user.id } };

  const membership = await db
    .selectFrom("project_members")
    .select(["permission"])
    .where("project_id", "=", projectId)
    .where("user_id", "=", user.id)
    .executeTakeFirst();

  if (!membership) {
    // Answered as 404 on the wire so an id is not confirmed to a stranger, but
    // it is a denial, and the log is the one place that may say so plainly.
    log.event("auth.access.denied", {
      userId: user.id,
      resource: `project:${projectId}`,
      operation: permission,
      requiredRoles: ["member"],
      reason: "not-a-member",
    });
    return { response: json({ error: "Project not found" }, 404) };
  }

  if (permission === "read_write" && membership.permission !== "read_write") {
    log.event("auth.access.denied", {
      userId: user.id,
      resource: `project:${projectId}`,
      operation: permission,
      requiredRoles: ["read_write"],
      reason: "read-only-membership",
    });
    return { response: json({ error: "Insufficient permissions" }, 403) };
  }

  return { user: { id: user.id } };
}

/**
 * Every project id this user may read — the ones they own, plus the ones
 * shared with them.
 *
 * For the handful of endpoints that list across projects rather than serving
 * one. `requireProjectAccess` answers "may I touch this project"; a listing has
 * no single project to ask about, and the alternative — serving the whole table
 * and filtering in the client — is how the mermaid library came to hand every
 * project's diagrams to anybody who asked.
 */
export async function accessibleProjectIds(userId: string): Promise<Set<string>> {
  const { getDatabase } = await import("@appwithai/core/services");
  const db = getDatabase();

  const [owned, shared] = await Promise.all([
    db.selectFrom("projects").select(["id"]).where("owner_user_id", "=", userId).execute(),
    db.selectFrom("project_members").select(["project_id"]).where("user_id", "=", userId).execute(),
  ]);

  return new Set([
    ...owned.map((row) => String(row.id)),
    ...shared.map((row) => String(row.project_id)),
  ]);
}
