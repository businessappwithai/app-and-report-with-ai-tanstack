/**
 * `/rules` — the rules the model declared, and a way to try one.
 *
 * `POST /rules/evaluate` matters more than it looks: a rule compiled from a
 * flowchart is only as trustworthy as the reading the engine gave its prose
 * decisions, and this is where that reading becomes visible. The response
 * carries the trace — which condition became which expression, and which the
 * engine could not read and assumed — so "the rule passed" is never something
 * the caller has to take on faith.
 */

import { Router } from "../lib/router.js";
import { badRequest, json, notFound, readJson } from "../lib/http.js";
import { requireUser } from "../lib/guards.js";
import { evaluateRules, interpretCondition } from "../lib/rules.js";
import { resolveEntity } from "./bus.routes.js";

export function rulesRoutes(model) {
  const router = new Router();
  router.use(async (_request, { user }) => {
    requireUser(user);
  });

  router.get("/", async (_request, { db, query }) => {
    const entityName = query.get("entityName") || query.get("entity");
    const rows = entityName
      ? await db.select("sys_rule_definitions", { where: { entity_name: entityName }, orderBy: "priority" })
      : await db.select("sys_rule_definitions", { orderBy: "priority" });
    return json(rows.map(withReading(model)));
  });

  router.get("/:id", async (_request, { db, params }) => {
    const row = await db.one("SELECT * FROM sys_rule_definitions WHERE sys_rule_definition_id = $1", [
      params.id,
    ]);
    if (!row) throw notFound("No such rule");
    return json(withReading(model)(row));
  });

  router.post("/evaluate", async (request, { db }) => {
    const body = await readJson(request);
    const entityName = body.entity || body.entityName;
    if (!entityName) throw badRequest("evaluate needs an `entity`");
    const entity = resolveEntity(model, entityName);
    if (!entity) throw notFound(`No entity "${entityName}" in this model`);

    const operation = String(body.operation || "ALL").toUpperCase();
    const rules = await db.query(
      `SELECT name, jdm_content FROM sys_rule_definitions
        WHERE entity_name = $1 AND operation IN ($2, 'ALL') AND is_active = true
        ORDER BY priority`,
      [entity.name, operation]
    );

    const outcome = await evaluateRules(rules, body.data || {}, {
      columns: entity.attributes.map((attribute) => attribute.columnName),
    });
    return json({ entity: entity.name, operation, rulesEvaluated: rules.length, ...outcome });
  });

  return router;
}

/**
 * Annotate a rule with how its decisions were read.
 *
 * Attached on the way out rather than stored, because the reading depends on
 * the entity's current columns — renaming one in the dictionary should change
 * what the rule screen says about the rule, not leave a stale note behind.
 */
function withReading(model) {
  return (rule) => {
    let graph;
    try {
      graph = JSON.parse(rule.jdm_content);
    } catch {
      return { ...rule, reading: { readable: false, decisions: [] } };
    }
    const entity = resolveEntity(model, rule.entity_name);
    const columns = entity ? entity.attributes.map((attribute) => attribute.columnName) : [];
    const decisions = (graph.nodes || [])
      .filter((node) => node.type === "switchNode")
      .map((node) => ({ label: node.name, ...interpretCondition(node.name, columns) }));
    return {
      ...rule,
      reading: {
        readable: decisions.every((decision) => !decision.assumed),
        shape: (graph.nodes || []).some((node) => node.type === "decisionTableNode") ? "decision-table" : "graph",
        decisions,
      },
    };
  };
}
