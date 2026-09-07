/**
 * Who may call a route that is not about one project.
 *
 * `requireProjectAccess` answers the project-scoped question — owner, member,
 * or neither. It has no answer for the routes that are not scoped to a project
 * at all: the business-rule store, the workflow-run log, the admin screens'
 * read models. Those were left with no check whatsoever, so an anonymous
 * request could list every rule in the installation, rewrite one, or delete it.
 * A rule decides whether a write is refused, so that is not a read of metadata;
 * it is control of what the application permits.
 *
 * The shape mirrors `requireProjectAccess` deliberately, so a handler guards
 * itself the same way whichever question it is asking:
 *
 * ```ts
 * const caller = await requireUser(request);
 * if (caller.response) return caller.response;
 * ```
 */

import { getLogger } from "@appwithai/core/logging";
import { getCurrentUser } from "@/lib/auth-server";

export interface UserDenied {
  response: Response;
  user?: undefined;
}

export interface UserGranted {
  response?: undefined;
  user: { id: string; role?: string | null };
}

export type CallerAccess = UserDenied | UserGranted;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Resolve the caller, refusing an unauthenticated one with 401.
 *
 * `resource` and `operation` name what was being reached for, so the denial is
 * legible in the log without the route having to write a sentence.
 */
export async function requireUser(
  request: Request,
  resource: string,
  operation = "read"
): Promise<CallerAccess> {
  const user = await getCurrentUser(request);

  if (!user) {
    getLogger("auth").event("auth.access.denied", {
      userId: null,
      resource,
      operation,
      requiredRoles: ["authenticated"],
    });
    return { response: json({ error: "Unauthorized" }, 401) };
  }

  return { user: { id: user.id, role: (user as { role?: string | null }).role ?? null } };
}
