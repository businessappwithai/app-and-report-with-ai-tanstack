/**
 * Business entity CRUD — the route every generated screen is built on.
 *
 * Nothing here is per-entity. The dictionary already says which tables exist,
 * which columns they have, which are mandatory and which reference something
 * else, so one set of handlers keyed on `:entity` serves an application with
 * three tables and one with three hundred. That is the whole point of a
 * dictionary-driven design, and it is also what makes generation cheap: adding
 * an entity to the model adds rows, not routes.
 *
 * The write path runs in a fixed order — resolve, guard, hook, rule, persist,
 * audit — and every step can refuse. The order matters: rules see the record
 * after before-hooks have stamped their fields, because a rule that fires on a
 * value a hook was about to compute would decide on data that never existed.
 */

import { Router } from "../lib/router.js";
import { badRequest, json, notFound, readJson } from "../lib/http.js";
import { ident } from "../lib/db.js";
import { checkOperationAccess, checkTransitionAccess, requireUser } from "../lib/guards.js";
import { runHooks } from "../lib/hooks.js";
import { evaluateRules } from "../lib/rules.js";
import { recordAudit } from "./audit.routes.js";
import { labelsForRows } from "../lib/labels.js";
import { toRouteName } from "../lib/naming.js";

/** Columns every generated table carries; never editable by a client. */
const MANAGED = new Set([
  "id",
  "version",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "deleted_at",
  "deleted_by",
]);

/**
 * Resolve a URL segment to an entity.
 *
 * Accepts the route form (`sales-order`), the table name (`bus_sales_order`)
 * and the model's own spelling (`SalesOrder`), because all three appear: the UI
 * links with the first, the dictionary stores the second, and rules and
 * workflows are written against the third. Anything that resolves to nothing is
 * a 404 before a table name is ever concatenated into SQL.
 */
export function resolveEntity(model, segment) {
  const wanted = String(segment ?? "").toLowerCase();
  return (
    model.entities.find(
      (entity) =>
        entity.routeName === wanted ||
        entity.tableName === wanted ||
        entity.name.toLowerCase() === wanted ||
        toRouteName(entity.name) === wanted
    ) || null
  );
}

function entityOr404(model, segment) {
  const entity = resolveEntity(model, segment);
  if (!entity) throw notFound(`No entity "${segment}" in this model`);
  return entity;
}

/** Metadata for one entity, assembled from the dictionary rows. */
async function entityMetadata(db, entity) {
  const table = await db.one("SELECT * FROM sys_table WHERE table_name = $1", [entity.tableName]);
  if (!table) throw notFound(`${entity.tableName} is not in the dictionary`);

  const columns = await db.query(
    `SELECT c.sys_column_id, c.column_name, c.sys_reference_id, c.field_length, c.default_value,
            c.ref_table_name, c.is_key, c.is_identifier, c.is_selection_column, c.is_parent,
            f.sys_field_id, f.name, COALESCE(f.description, c.description) AS description,
            f.is_displayed, f.is_displayed_grid,
            f.is_read_only, f.is_mandatory, f.is_updateable, f.is_insertable,
            f.seq_no, f.seq_no_grid, f.field_type, f.sys_field_group_id,
            g.name AS group_name
       FROM sys_column c
       JOIN sys_table t ON t.sys_table_id = c.sys_table_id
       LEFT JOIN sys_tab tb ON tb.sys_table_id = t.sys_table_id
       LEFT JOIN sys_field f ON f.sys_column_id = c.sys_column_id AND f.sys_tab_id = tb.sys_tab_id
       LEFT JOIN sys_field_group g ON g.sys_field_group_id = f.sys_field_group_id
      WHERE t.table_name = $1
      ORDER BY COALESCE(f.seq_no, c.seq_no)`,
    [entity.tableName]
  );

  const window = table.sys_window_id
    ? await db.one("SELECT sys_window_id, name FROM sys_window WHERE sys_window_id = $1", [
        table.sys_window_id,
      ])
    : null;

  return {
    table: {
      sys_table_id: table.sys_table_id,
      table_name: table.table_name,
      name: table.name,
      description: table.description,
    },
    entity: { name: entity.name, route: entity.routeName },
    columns: columns.map((column) => ({
      sys_field_id: column.sys_field_id,
      name: column.name || column.column_name,
      column_name: column.column_name,
      /* `%%field <E>.<c> help:` — sys_field carries it per screen and
         sys_column per model, so the field's own text wins and the column's is
         the fallback. The form renders it under the control. */
      description: column.description ?? null,
      sys_reference_id: column.sys_reference_id,
      is_mandatory: column.is_mandatory ?? false,
      is_updateable: column.is_updateable !== false,
      is_insertable: column.is_insertable !== false,
      is_read_only: column.is_read_only ?? false,
      is_displayed: column.is_displayed !== false,
      is_displayed_grid: column.is_displayed_grid !== false,
      is_key: column.is_key ?? false,
      /* The column tying a detail row to its master, from
         `%%entity <Child> parent: <Parent>`. Projected so the dictionary screen
         can show what the tab links on rather than leaving it a mystery. */
      is_parent: column.is_parent ?? false,
      field_length: column.field_length,
      default_value: column.default_value,
      ref_table_name: column.ref_table_name,
      field_type: column.field_type,
      seq_no: column.seq_no ?? 0,
      seq_no_grid: column.seq_no_grid ?? 0,
      group_name: column.group_name,
    })),
    window: window ? { sys_window_id: window.sys_window_id, name: window.name } : undefined,
  };
}

/**
 * One `filter.<column>=<operator>:<value>` clause, or null if it names nothing.
 *
 * The operator set is the NestJS controller's, deliberately: the advanced
 * search sends the same query string to either stack, and a model that filters
 * one way in the browser and another way deployed would make the browser
 * application a demonstration of something else.
 *
 * Text operators compare `::text` so a uuid or a number still matches
 * `contains`; the rest coerce through the column's own type, so `gt` on a date
 * compares dates rather than strings. Everything goes through a bound
 * parameter — `ident()` is the only thing interpolated, and it only ever
 * receives a column name the model declared.
 */
function filterCondition(entity, column, raw, parameters) {
  const attribute = entity.attributes.find((item) => item.columnName === column);
  if (!attribute) return null;

  const separator = String(raw).indexOf(":");
  const operator = separator === -1 ? "equals" : String(raw).slice(0, separator);
  const value = separator === -1 ? String(raw) : String(raw).slice(separator + 1);
  if (value === "") return null;

  const bind = (bound) => {
    parameters.push(bound);
    return parameters.length;
  };

  switch (operator) {
    case "contains":
      return `${ident(column)}::text ILIKE $${bind(`%${value}%`)}`;
    case "startsWith":
      return `${ident(column)}::text ILIKE $${bind(`${value}%`)}`;
    case "endsWith":
      return `${ident(column)}::text ILIKE $${bind(`%${value}`)}`;
    case "gt":
      return `${ident(column)} > $${bind(coerce(value, attribute))}`;
    case "gte":
      return `${ident(column)} >= $${bind(coerce(value, attribute))}`;
    case "lt":
      return `${ident(column)} < $${bind(coerce(value, attribute))}`;
    case "lte":
      return `${ident(column)} <= $${bind(coerce(value, attribute))}`;
    case "equals":
    case "eq":
    default:
      return `${ident(column)} = $${bind(coerce(value, attribute))}`;
  }
}

/** Coerce a submitted value to what the column can actually store. */
function coerce(value, attribute) {
  if (value === "" || value === undefined) return attribute.required ? value : null;
  if (value === null) return null;
  switch (attribute.type) {
    case "integer":
      return Number.parseInt(value, 10);
    case "decimal":
    case "number":
      return Number(value);
    case "boolean":
      return value === true || value === "true" || value === 1 || value === "1";
    case "json":
      return typeof value === "string" ? safeJson(value) : value;
    default:
      return value;
  }
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Keep only real columns, coerced. Unknown keys are dropped, not rejected. */
function sanitize(entity, body) {
  const values = {};
  for (const attribute of entity.attributes) {
    const column = attribute.columnName;
    if (MANAGED.has(column)) continue;
    if (!Object.prototype.hasOwnProperty.call(body, column)) continue;
    values[column] = coerce(body[column], attribute);
  }
  return values;
}

function validate(entity, values, mode) {
  const errors = [];
  for (const attribute of entity.attributes) {
    if (MANAGED.has(attribute.columnName)) continue;
    const present = Object.prototype.hasOwnProperty.call(values, attribute.columnName);
    const value = values[attribute.columnName];
    if (attribute.required && (mode === "create" ? !present || isBlank(value) : present && isBlank(value))) {
      errors.push(`${attribute.displayName || attribute.columnName} is required`);
    }
    if (present && attribute.maxLength && typeof value === "string" && value.length > attribute.maxLength) {
      errors.push(`${attribute.displayName} must be ${attribute.maxLength} characters or fewer`);
    }
    if (present && !isBlank(value) && (attribute.type === "integer" || attribute.type === "decimal")) {
      if (Number.isNaN(Number(value))) errors.push(`${attribute.displayName} must be a number`);
    }
  }
  if (errors.length) throw badRequest("Validation failed", errors);
}

const isBlank = (value) => value == null || String(value).trim() === "";

/** The column a state machine moves, when the entity has one. */
function statusColumn(entity, model) {
  const workflow = (model.workflows || []).find((item) => item.entity === entity.name);
  if (!workflow) return null;
  const candidates = ["status", "state", "workflow_state"];
  return entity.attributes.find((attribute) => candidates.includes(attribute.columnName))?.columnName ?? null;
}

async function rulesFor(db, entity, operation) {
  return db.query(
    `SELECT name, jdm_content FROM sys_rule_definitions
      WHERE entity_name = $1 AND operation IN ($2, 'ALL') AND is_active = true
      ORDER BY priority ASC`,
    [entity.name, operation]
  );
}

export function busRoutes(model) {
  const router = new Router();

  router.get("/:entity/meta", async (_request, { db, params }) =>
    json(await entityMetadata(db, entityOr404(model, params.entity)))
  );

  router.get("/:entity/fields/form", async (_request, { db, params, query }) => {
    const metadata = await entityMetadata(db, entityOr404(model, params.entity));
    const includeHidden = query.get("includeHidden") === "true";
    return json(
      metadata.columns
        .filter((column) => includeHidden || column.is_displayed)
        .sort((a, b) => a.seq_no - b.seq_no)
    );
  });

  router.get("/:entity/fields/grid", async (_request, { db, params, query }) => {
    const metadata = await entityMetadata(db, entityOr404(model, params.entity));
    const includeHidden = query.get("includeHidden") === "true";
    return json(
      metadata.columns
        .filter((column) => includeHidden || column.is_displayed_grid)
        .sort((a, b) => a.seq_no_grid - b.seq_no_grid)
    );
  });

  router.get("/:entity", async (_request, { db, params, query, user }) => {
    const entity = entityOr404(model, params.entity);
    await checkOperationAccess(db, user, entity.tableName, "read");

    const page = Math.max(1, Number(query.get("page") || 1));
    const limit = Math.min(500, Math.max(1, Number(query.get("limit") || 25)));
    const search = (query.get("search") || "").trim();
    const sort = query.get("sort");
    const order = String(query.get("order") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    const conditions = ["deleted_at IS NULL"];
    const parameters = [];

    // Equality filters arrive as bare query keys naming a column — the grid's
    // column filters and every "records of this parent" link use them.
    //
    // `filter.<column>=<operator>:<value>` is the richer form the advanced
    // search sends, and it is the same contract the NestJS stack's controller
    // parses: one stack's model must not search differently from the other's.
    for (const [key, value] of query.entries()) {
      if (["page", "limit", "search", "sort", "order"].includes(key)) continue;

      if (key.startsWith("filter.")) {
        const condition = filterCondition(entity, key.slice("filter.".length), value, parameters);
        if (condition) conditions.push(condition);
        continue;
      }

      const attribute = entity.attributes.find((item) => item.columnName === key);
      if (!attribute) continue;
      parameters.push(coerce(value, attribute));
      conditions.push(`${ident(key)} = $${parameters.length}`);
    }

    if (search) {
      const searchable = entity.attributes.filter(
        (attribute) => attribute.type === "string" || attribute.type === "text"
      );
      if (searchable.length) {
        parameters.push(`%${search}%`);
        const index = parameters.length;
        conditions.push(
          `(${searchable.map((attribute) => `${ident(attribute.columnName)}::text ILIKE $${index}`).join(" OR ")})`
        );
      }
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const sortColumn = entity.attributes.find((attribute) => attribute.columnName === sort)
      ? sort
      : "created_at";

    const total = await db.value(
      `SELECT COUNT(*)::int FROM ${ident(entity.tableName)} ${where}`,
      parameters
    );
    const data = await db.query(
      `SELECT * FROM ${ident(entity.tableName)} ${where}
        ORDER BY ${ident(sortColumn)} ${order}
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      parameters
    );

    /* The rows carry foreign keys, which is what editing and filtering need,
       and a uuid is not what a reader came to see. The names travel alongside
       rather than replacing the ids, so the grid can show one and act on the
       other. */
    const labels = await labelsForRows(db, entity, data);

    return json({
      data,
      labels,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });

  router.get("/:entity/:id", async (_request, { db, params, user }) => {
    const entity = entityOr404(model, params.entity);
    await checkOperationAccess(db, user, entity.tableName, "read");
    const row = await db.one(
      `SELECT * FROM ${ident(entity.tableName)} WHERE id = $1 AND deleted_at IS NULL`,
      [params.id]
    );
    if (!row) throw notFound(`No ${entity.name} with id ${params.id}`);
    return json(row);
  });

  router.post("/:entity", async (request, { db, params, user }) => {
    const entity = entityOr404(model, params.entity);
    requireUser(user);
    await checkOperationAccess(db, user, entity.tableName, "create");

    const body = await readJson(request);
    let values = sanitize(entity, body);

    const before = await runHooks(model.hooks, "beforeCreate", entity.name, values);
    if (before.failures.length) throw badRequest("A lifecycle hook refused the write", before.failures);
    values = before.record;

    validate(entity, values, "create");

    const outcome = await evaluateRules(await rulesFor(db, entity, "CREATE"), values, {
      columns: entity.attributes.map((attribute) => attribute.columnName),
    });
    if (outcome.violations.length) {
      return json(
        { statusCode: 422, message: "A business rule refused this record", violations: outcome.violations },
        { status: 422 }
      );
    }
    Object.assign(values, applicableMutations(entity, outcome.mutations));

    values.created_by = user.id;
    values.updated_by = user.id;

    const created = await db.insert(entity.tableName, values);
    const after = await runHooks(model.hooks, "afterCreate", entity.name, created);

    await recordAudit(db, {
      user,
      action: "CREATE",
      entityType: entity.tableName,
      entityId: created.id,
      after: created,
    });

    return json(
      { ...created, _hooks: [...before.log, ...after.log], _notifications: outcome.notifications },
      { status: 201 }
    );
  });

  const write = async (request, { db, params, user }) => {
    const entity = entityOr404(model, params.entity);
    requireUser(user);
    await checkOperationAccess(db, user, entity.tableName, "update");

    const current = await db.one(
      `SELECT * FROM ${ident(entity.tableName)} WHERE id = $1 AND deleted_at IS NULL`,
      [params.id]
    );
    if (!current) throw notFound(`No ${entity.name} with id ${params.id}`);

    const body = await readJson(request);
    let values = sanitize(entity, body);

    const before = await runHooks(model.hooks, "beforeUpdate", entity.name, values, { previous: current });
    if (before.failures.length) throw badRequest("A lifecycle hook refused the write", before.failures);
    values = before.record;

    validate(entity, values, "update");

    // The rule sees the record it would become, not the fragment submitted:
    // `status == 'draft'` has to be answerable when the write only sets a title.
    const merged = { ...current, ...values };
    const outcome = await evaluateRules(await rulesFor(db, entity, "UPDATE"), merged, {
      columns: entity.attributes.map((attribute) => attribute.columnName),
    });
    if (outcome.violations.length) {
      return json(
        { statusCode: 422, message: "A business rule refused this change", violations: outcome.violations },
        { status: 422 }
      );
    }
    Object.assign(values, applicableMutations(entity, outcome.mutations));

    await checkTransitionAccess(db, user, entity.tableName, current, { ...current, ...values }, statusColumn(entity, model));

    values.updated_by = user.id;
    values.updated_at = new Date().toISOString();
    values.version = (current.version ?? 1) + 1;

    const updated = await db.update(entity.tableName, values, { id: params.id });
    const after = await runHooks(model.hooks, "afterUpdate", entity.name, updated, { previous: current });

    await recordWorkflowRun(db, model, entity, current, updated, user);
    await recordAudit(db, {
      user,
      action: "UPDATE",
      entityType: entity.tableName,
      entityId: params.id,
      before: current,
      after: updated,
    });

    return json({ ...updated, _hooks: [...before.log, ...after.log], _notifications: outcome.notifications });
  };

  router.put("/:entity/:id", write);
  router.patch("/:entity/:id", write);

  router.delete("/:entity/:id", async (_request, { db, params, user }) => {
    const entity = entityOr404(model, params.entity);
    requireUser(user);
    await checkOperationAccess(db, user, entity.tableName, "delete");

    const current = await db.one(
      `SELECT * FROM ${ident(entity.tableName)} WHERE id = $1 AND deleted_at IS NULL`,
      [params.id]
    );
    if (!current) throw notFound(`No ${entity.name} with id ${params.id}`);

    const before = await runHooks(model.hooks, "beforeDelete", entity.name, current);
    if (before.failures.length) throw badRequest("A lifecycle hook refused the delete", before.failures);

    const outcome = await evaluateRules(await rulesFor(db, entity, "DELETE"), current, {
      columns: entity.attributes.map((attribute) => attribute.columnName),
    });
    if (outcome.violations.length) {
      return json(
        { statusCode: 422, message: "A business rule refused this delete", violations: outcome.violations },
        { status: 422 }
      );
    }

    // Soft delete: the audit trail refers to rows by id, and a hard delete
    // would leave the trail pointing at nothing.
    await db.update(
      entity.tableName,
      { deleted_at: new Date().toISOString(), deleted_by: user.id },
      { id: params.id }
    );
    await runHooks(model.hooks, "afterDelete", entity.name, current);
    await recordAudit(db, {
      user,
      action: "DELETE",
      entityType: entity.tableName,
      entityId: params.id,
      before: current,
    });

    return json({ success: true, id: params.id });
  });

  return router;
}

/** Only apply a rule's `set` when the target is a real column of the entity. */
function applicableMutations(entity, mutations) {
  const applicable = {};
  for (const [field, value] of Object.entries(mutations || {})) {
    const attribute = entity.attributes.find((item) => item.columnName === field);
    if (attribute) applicable[field] = coerce(value, attribute);
  }
  return applicable;
}

/** Record a state change against the entity's machine, when it crossed one. */
async function recordWorkflowRun(db, model, entity, before, after, user) {
  const column = statusColumn(entity, model);
  if (!column) return;
  const from = before[column];
  const to = after[column];
  if (!to || from === to) return;

  const workflow = (model.workflows || []).find((item) => item.entity === entity.name);
  const transition = (workflow?.transitions || []).find(
    (item) => item.from === String(from) && item.to === String(to)
  );

  await db.insert("sys_workflow_runs", {
    workflow_name: workflow ? workflow.name : `${entity.name} status`,
    entity_name: entity.name,
    record_id: after.id,
    from_state: from == null ? null : String(from),
    to_state: String(to),
    trigger: transition?.trigger ?? null,
    status: transition ? "completed" : "unmodelled",
    detail: JSON.stringify({ modelled: !!transition }),
    created_by: user.id,
  });
}
