/**
 * Sign in, sign out, and who am I.
 *
 * The login form accepts either the administrator's email or the bare local
 * part of it, because an application that seeds `admin@admin.com` and then
 * refuses `admin` is failing a guess anyone would make first.
 */

import { Router } from "../lib/router.js";
import { json, readJson, unauthorized } from "../lib/http.js";
import {
  clearedSessionCookie,
  createSession,
  destroySession,
  hashPassword,
  sessionCookie,
  verifyPassword,
} from "../lib/auth.js";
import { requireUser } from "../lib/guards.js";
import { recordAudit } from "./audit.routes.js";

export function authRoutes(model) {
  const router = new Router();

  router.post("/login", async (request, { db }) => {
    const body = await readJson(request);
    const identifier = String(body.email ?? body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    const user = await db.one(
      "SELECT * FROM sys_user WHERE lower(email) = $1 OR lower(split_part(email, '@', 1)) = $1 LIMIT 1",
      [identifier]
    );

    const ok = user && user.is_active !== false && (await verifyPassword(password, user.password_hash));
    if (!ok) {
      await recordAudit(db, {
        action: "AUTH_LOGIN",
        entityType: "auth",
        email: identifier,
        success: false,
        error: "Invalid email or password",
      });
      throw unauthorized("Invalid email or password");
    }

    const token = await createSession(db, user.sys_user_id, request.headers.get("user-agent"));
    await db.update("sys_user", { last_login: new Date().toISOString() }, { sys_user_id: user.sys_user_id });
    await recordAudit(db, {
      action: "AUTH_LOGIN",
      entityType: "auth",
      user: { id: user.sys_user_id, email: user.email },
    });

    const roles = await db.query(
      `SELECT r.name, r.is_admin FROM sys_user_roles ur
         JOIN sys_role r ON r.sys_role_id = ur.role_id
        WHERE ur.user_id = $1 AND ur.is_active = true`,
      [user.sys_user_id]
    );

    return json(
      {
        user: {
          id: user.sys_user_id,
          name: user.name,
          email: user.email,
          roles: roles.map((role) => role.name),
          isAdmin: roles.some((role) => role.is_admin === true),
        },
        token,
      },
      { headers: { "Set-Cookie": sessionCookie(token) } }
    );
  });

  router.post("/logout", async (_request, { db, user }) => {
    if (user) {
      await destroySession(db, user.token);
      await recordAudit(db, { action: "AUTH_LOGOUT", entityType: "auth", user });
    }
    return json({ success: true }, { headers: { "Set-Cookie": clearedSessionCookie() } });
  });

  router.get("/me", async (_request, { user }) => json(requireUser(user)));

  router.get("/me/permissions", async (_request, { db, user }) => {
    requireUser(user);
    const operations = await db.query(
      "SELECT table_name, entity_name, operation, role_name FROM sys_operation_access WHERE is_active = true"
    );
    const transitions = await db.query(
      "SELECT table_name, entity_name, transition, from_state, to_state, role_name FROM sys_transition_access WHERE is_active = true"
    );
    return json({ roles: user.roles, isAdmin: user.isAdmin, operations, transitions });
  });

  router.post("/change-password", async (request, { db, user }) => {
    requireUser(user);
    const body = await readJson(request);
    const row = await db.one("SELECT password_hash FROM sys_user WHERE sys_user_id = $1", [user.id]);
    if (!(await verifyPassword(String(body.currentPassword ?? ""), row.password_hash))) {
      throw unauthorized("Current password is incorrect");
    }
    const next = String(body.newPassword ?? "");
    if (next.length < 4) throw unauthorized("New password is too short");
    await db.update("sys_user", { password_hash: await hashPassword(next) }, { sys_user_id: user.id });
    await recordAudit(db, { action: "AUTH_PASSWORD_CHANGE", entityType: "auth", user });
    return json({ success: true });
  });

  /**
   * What the sign-in screen offers.
   *
   * An application nobody can get into is not a demonstration of anything, and
   * hiding seeded credentials does not make a database that lives in the
   * reader's own browser any more private.
   *
   * Every seeded account is listed, not only the administrator, and each says
   * how many entities its role can see. That count is the whole point of
   * listing them: the administrator bypasses every restriction the model wrote,
   * so an application you can only sign into as the administrator is one whose
   * access control you cannot look at. `support.agent@… — 5 of 17 entities` is
   * an invitation to check.
   */
  router.get("/config", async () => {
    const visibility = model.entityVisibility || {};
    const total = (model.entities || []).length;
    const countFor = (declaredRole) => {
      if (!declaredRole) return total;
      const normalize = (value) =>
        String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      const wanted = normalize(declaredRole);
      return (model.entities || []).filter((entity) => {
        const roles = visibility[entity.name];
        if (!roles || roles.length === 0) return true;
        return roles.some((role) => normalize(role) === wanted);
      }).length;
    };

    const accounts = (model.users || []).map((user) => {
      const role = (model.roles || []).find((candidate) => candidate.name === user.roleName);
      return {
        email: user.email,
        password: model.project.adminPassword,
        role: user.roleName,
        isAdmin: !!user.isAdmin,
        entities: user.isAdmin ? total : countFor(role?.declaredAs),
      };
    });

    return json({
      seededAdmin: {
        email: model.project.adminEmail,
        password: model.project.adminPassword,
      },
      seededAccounts: accounts,
      totalEntities: total,
      /* False when the model declared no `read` restrictions, in which case the
         counts are all the same and a table of them says nothing. */
      scoped: Object.keys(visibility).length > 0,
    });
  });

  return router;
}
