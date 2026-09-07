/**
 * `/workflows` and `/workflow-definitions` — the processes the model declared.
 *
 * A state machine has no endpoint that "runs" it, and inventing one would be a
 * second way to change a record's status that the guards, hooks and rules on
 * the ordinary update path know nothing about. So this module reads: the
 * machines, the transitions available from where a record actually is, and the
 * runs that have already happened. Moving a record is a PUT to the record.
 */

import { Router } from "../lib/router.js";
import { json, notFound } from "../lib/http.js";
import { requireUser } from "../lib/guards.js";
import { resolveEntity } from "./bus.routes.js";
import { ident } from "../lib/db.js";

export function workflowRoutes(model) {
  const router = new Router();
  router.use(async (_request, { user }) => {
    requireUser(user);
  });

  router.get("/definitions", async (_request, { db }) =>
    json(await db.select("sys_workflow_definitions", { orderBy: "name" }))
  );

  router.get("/definitions/:id", async (_request, { db, params }) => {
    const row = await db.one(
      "SELECT * FROM sys_workflow_definitions WHERE sys_workflow_definition_id = $1",
      [params.id]
    );
    if (!row) throw notFound("No such workflow");
    return json(row);
  });

  router.get("/runs", async (_request, { db, query }) => {
    const limit = Math.min(200, Number(query.get("limit") || 50));
    const entityName = query.get("entityName");
    const rows = entityName
      ? await db.select("sys_workflow_runs", {
          where: { entity_name: entityName },
          orderBy: "created_at",
          direction: "desc",
          limit,
        })
      : await db.select("sys_workflow_runs", { orderBy: "created_at", direction: "desc", limit });
    return json({ data: rows, total: rows.length });
  });

  router.get("/entity/:entityName", async (_request, { db, params }) => {
    const entity = resolveEntity(model, params.entityName);
    if (!entity) throw notFound(`No entity "${params.entityName}"`);
    const definitions = await db.select("sys_workflow_definitions", {
      where: { entity_name: entity.name },
      orderBy: "name",
    });
    return json(definitions);
  });

  /**
   * Where a record can go next.
   *
   * The transitions are filtered by the caller's roles here as well as being
   * enforced on the write, because a UI that offers a button the server will
   * refuse is worse than one that offers nothing.
   */
  router.get("/entity/:entityName/:id/transitions", async (_request, { db, params, user }) => {
    const entity = resolveEntity(model, params.entityName);
    if (!entity) throw notFound(`No entity "${params.entityName}"`);

    const workflow = (model.workflows || []).find((item) => item.entity === entity.name);
    if (!workflow) return json({ workflow: null, current: null, transitions: [] });

    const column = ["status", "state", "workflow_state"].find((candidate) =>
      entity.attributes.some((attribute) => attribute.columnName === candidate)
    );
    const record = await db.one(
      `SELECT * FROM ${ident(entity.tableName)} WHERE id = $1 AND deleted_at IS NULL`,
      [params.id]
    );
    if (!record) throw notFound(`No ${entity.name} with id ${params.id}`);

    const current = column ? record[column] : null;
    const restrictions = await db.query(
      "SELECT from_state, to_state, role_name FROM sys_transition_access WHERE table_name = $1 AND is_active = true",
      [entity.tableName]
    );
    const held = new Set((user.roles || []).map((role) => role.toLowerCase().replace(/[\s-]+/g, "_")));

    const transitions = (workflow.transitions || [])
      .filter((transition) => String(transition.from) === String(current ?? workflow.initial ?? ""))
      .map((transition) => {
        const required = restrictions
          .filter(
            (row) => row.from_state === String(transition.from) && row.to_state === String(transition.to)
          )
          .map((row) => row.role_name);
        const permitted =
          !required.length ||
          user.isAdmin ||
          required.some((role) => held.has(role.toLowerCase().replace(/[\s-]+/g, "_")));
        return { ...transition, requiredRoles: required, permitted };
      });

    return json({ workflow: workflow.name, column, current, transitions });
  });

  return router;
}
