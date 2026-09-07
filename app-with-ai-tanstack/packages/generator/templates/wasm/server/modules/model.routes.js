/**
 * `/model` — the EML this application was generated from.
 *
 * The generated code is the model compiled: reading it tells you what the
 * application does but not what it was asked to do, and nothing in it records
 * that a decision table had three rows for a reason. Serving the source back
 * makes the application self-describing, and it is what lets the model screen
 * show a diagram next to the tables it produced.
 */

import { Router } from "../lib/router.js";
import { json, text } from "../lib/http.js";
import { readableTables, requireUser } from "../lib/guards.js";

export function modelRoutes(model, readAsset) {
  const router = new Router();

  // Signed-in callers only. The model is not more secret than the data it
  // describes, but it is not less secret either, and an endpoint that answers
  // anyone is one an entity route would never be allowed to be.
  router.use(async (_request, { user }) => {
    requireUser(user);
  });

  /*
   * Scoped to the caller, because this is where the navigation comes from.
   *
   * The interface builds its entity list from this response rather than from
   * `/sys/tables` — one round trip instead of one per screen — which means
   * filtering the dictionary alone left every entity in the menu and only
   * refused it on opening. A role's application is the set of entities it may
   * read, and this is the endpoint that has to say so.
   *
   * The categories are narrowed with them: a group whose every entity belongs
   * to another role is not an empty group, it is somebody else's.
   */
  router.get("/", async (_request, { user }) => {
    const visible = readableTables(user, model);
    const entities = visible
      ? model.entities.filter((entity) => visible.has(entity.tableName))
      : model.entities;
    const names = new Set(entities.map((entity) => entity.name));
    const categories = visible
      ? (model.categories || [])
          .map((category) => ({
            ...category,
            entities: (category.entities || []).filter((name) => names.has(name)),
          }))
          .filter((category) => category.entities.length > 0)
      : model.categories;

    return json({
      project: model.project,
      entities: entities.map((entity) => ({
        name: entity.name,
        tableName: entity.tableName,
        route: entity.routeName,
        displayName: entity.displayName,
        /* A line item: no dashboard card, reached as a tab under its parent.
           The link column is the child's own key back, so the tab can ask for
           exactly the rows belonging to the record on screen. */
        parentEntity: entity.parentEntity,
        parentLinkColumn: entity.parentLinkColumn,
        attributes: entity.attributes.map((attribute) => ({
          name: attribute.columnName,
          label: attribute.displayName,
          type: attribute.type,
          required: attribute.required,
          enumValues: attribute.enumValues,
          refTable: attribute.refTableName,
        })),
      })),
      relationships: model.relationships,
      categories,
      rules: (model.rules || []).map((rule) => ({
        name: rule.name,
        entity: rule.entity,
        event: rule.event,
        operation: rule.operation,
        priority: rule.priority,
      })),
      workflows: (model.workflows || []).map((workflow) => ({
        name: workflow.name,
        entity: workflow.entity,
        initial: workflow.initial,
        states: workflow.states,
        transitions: workflow.transitions,
      })),
      sagas: model.sagas,
      hooks: model.hooks,
      rbac: model.rbac,
    });
  });

  router.get("/source", async () => {
    const source = await readAsset("model/model.eml.mmd").catch(() => "");
    return text(source || "-- no model source was written with this application --");
  });

  return router;
}
