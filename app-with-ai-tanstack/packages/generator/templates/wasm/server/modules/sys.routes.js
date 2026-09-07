/**
 * `/sys` — the Application Dictionary.
 *
 * Reads are open to any signed-in user and writes are administrator-only, which
 * is not symmetry for its own sake: every list and every form in this
 * application is drawn from these rows, so gating reads leaves a non-admin
 * looking at empty pages, while a write changes what everyone else sees.
 *
 * The write guard keys on the HTTP method rather than on per-route decoration.
 * There are more write routes than anyone remembers, and one added later would
 * otherwise default to open.
 */

import { Router } from "../lib/router.js";
import { ident } from "../lib/db.js";
import { columnsOf, labelForTable } from "../lib/labels.js";
import { json, notFound, readJson } from "../lib/http.js";
import { readableTables, requireAdmin, requireUser } from "../lib/guards.js";
import { recordAudit } from "./audit.routes.js";

export function sysRoutes(model) {
  const router = new Router();

  router.use(async (request, { user }) => {
    requireUser(user);
    if (request.method !== "GET") requireAdmin(user);
  });

  /* Scoped, not merely guarded. `EntityAccessGuard` already refuses a read the
     caller's roles do not permit, but a navigation full of entries that answer
     403 is a worse application than a shorter one: the reader cannot tell a
     permission from a bug. This is the same rule the guard enforces, applied
     one screen earlier. */
  router.get("/tables", async (_request, { db, query, user }) => {
    const prefix = query.get("prefix");
    const rows = await db.query(
      `SELECT t.*, w.name AS window_name, c.name AS category_name
         FROM sys_table t
         LEFT JOIN sys_window w ON w.sys_window_id = t.sys_window_id
         LEFT JOIN sys_category c ON c.sys_category_id = t.sys_category_id
        WHERE ($1::text IS NULL OR t.table_name LIKE $1 || '%')
        ORDER BY t.name`,
      [prefix ?? null]
    );
    const visible = readableTables(user, model);
    return json(visible ? rows.filter((row) => visible.has(row.table_name)) : rows);
  });

  router.get("/tables/:id", async (_request, { db, params }) => {
    const row = await db.one("SELECT * FROM sys_table WHERE sys_table_id = $1", [params.id]);
    if (!row) throw notFound("No such table");
    return json(row);
  });

  router.get("/columns", async (_request, { db, query }) => {
    const tableId = query.get("tableId");
    const rows = tableId
      ? await db.select("sys_column", { where: { sys_table_id: tableId }, orderBy: "seq_no" })
      : await db.select("sys_column", { orderBy: "seq_no" });
    return json(rows);
  });

  router.get("/windows", async (_request, { db }) => json(await db.select("sys_window", { orderBy: "name" })));
  router.get("/tabs", async (_request, { db }) => json(await db.select("sys_tab", { orderBy: "seq_no" })));
  router.get("/references", async (_request, { db }) =>
    json(await db.select("sys_reference", { orderBy: "sys_reference_id" }))
  );
  router.get("/roles", async (_request, { db }) => json(await db.select("sys_role", { orderBy: "name" })));

  router.get("/ref-list", async (_request, { db, query }) => {
    const referenceId = query.get("referenceId") || query.get("sys_reference_id");
    const rows = referenceId
      ? await db.select("sys_ref_list", {
          where: { sys_reference_id: Number(referenceId) },
          orderBy: "seq_no",
        })
      : await db.select("sys_ref_list", { orderBy: "seq_no" });
    return json(rows);
  });

  /**
   * Options for a Table Direct lookup.
   *
   * The dictionary already knows which table a reference column points at
   * (`sys_column.ref_table_name`); this turns that into something a select can
   * render — an id and the label a person recognises. What the label *is* comes
   * from `labelFor`, which reads the dictionary's `is_identifier` columns, so
   * the dropdown here and the grid that displays the chosen value cannot end up
   * calling the same record two different things.
   */
  router.get("/lookup", async (_request, { db, query }) => {
    const table = query.get("table");
    if (!table) return json({ options: [], label: null });

    const columns = await columnsOf(db, table);
    if (!columns || columns.length === 0) return json({ options: [], label: null });

    const { key, label, expression } = await labelForTable(db, table, columns);
    const limit = Math.min(Number(query.get("limit") ?? 500) || 500, 1000);
    const rows = await db.query(
      `SELECT ${ident(key)} AS id, ${expression} AS label
         FROM ${ident(table)}
        ORDER BY 2
        LIMIT ${limit}`
    );
    return json({ options: rows, label });
  });

  router.get("/users", async (_request, { db }) =>
    json(
      await db.query(
        `SELECT u.sys_user_id, u.name, u.email, u.is_active, u.last_login,
                COALESCE(json_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '[]') AS roles
           FROM sys_user u
           LEFT JOIN sys_user_roles ur ON ur.user_id = u.sys_user_id AND ur.is_active = true
           LEFT JOIN sys_role r ON r.sys_role_id = ur.role_id
          GROUP BY u.sys_user_id
          ORDER BY u.name`
      )
    )
  );

  router.get("/categories", async (_request, { db }) =>
    json(await db.select("sys_category", { orderBy: "seq_no" }))
  );

  router.get("/categories/with-entities", async (_request, { db, user }) => {
    const categories = await db.select("sys_category", { orderBy: "seq_no" });
    const all = await db.query(
      `SELECT t.table_name, t.name, t.sys_category_id FROM sys_table t
        WHERE t.entity_type = 'bus' ORDER BY t.name`
    );
    const visible = readableTables(user, model);
    const tables = visible ? all.filter((table) => visible.has(table.table_name)) : all;
    return json(
      categories
        .map((category) => ({
          ...category,
          entities: tables.filter((table) => table.sys_category_id === category.sys_category_id),
        }))
        /* A group whose every entity belongs to another role is not an empty
           group, it is somebody else's. Showing it as a card reading "0
           entities" tells the reader nothing they can act on. */
        .filter((category) => !visible || category.entities.length > 0)
    );
  });

  router.get("/fields", async (_request, { db, query }) => {
    const tabId = query.get("tabId");
    const rows = tabId
      ? await db.select("sys_field", { where: { sys_tab_id: tabId }, orderBy: "seq_no" })
      : await db.select("sys_field", { orderBy: "seq_no" });
    return json(rows);
  });

  router.get("/field-groups", async (_request, { db }) =>
    json(await db.select("sys_field_group", { orderBy: "seq_no" }))
  );

  /**
   * Toggling a field's visibility is the one dictionary write the application
   * itself offers, because it is the one that pays off immediately: a column
   * hidden here disappears from every grid and form without regenerating.
   */
  router.patch("/fields/:id", async (request, { db, params }) => {
    const body = await readJson(request);
    const allowed = {};
    for (const key of [
      "name",
      "is_displayed",
      "is_displayed_grid",
      "is_read_only",
      "is_mandatory",
      "seq_no",
      "seq_no_grid",
    ]) {
      if (key in body) allowed[key] = body[key];
    }
    const updated = await db.update("sys_field", allowed, { sys_field_id: params.id });
    if (!updated) throw notFound("No such field");
    return json(updated);
  });

  /** What the model said, for the screens that show the model rather than the data. */
  /**
   * Empty every business table, and nothing else.
   *
   * A generated application arrives with sample rows in it so that it can be
   * looked at, and the reader who has finished looking wants their own data in
   * it — which meant deleting ten rows per entity by hand, seventeen times, or
   * regenerating and losing everything else they had done. One button is the
   * honest answer to that.
   *
   * Administrator-only, and not by a decorator: this router already refuses any
   * non-GET from a caller who is not one. Destructive enough that the interface
   * asks twice before calling it.
   *
   * **Business tables only.** The dictionary, the roles, the users, the rules
   * and the workflow definitions are what the application *is*, not what it
   * holds; emptying those leaves a running application with no screens. One
   * `TRUNCATE` naming every `bus_` table at once, so the foreign keys between
   * them need no ordering and no `CASCADE` — a `CASCADE` here would reach the
   * audit trail, and a purge that erases its own record of having happened is
   * the wrong shape entirely.
   */
  router.post("/purge-business-data", async (_request, { db, user }) => {
    const tables = model.entities.map((entity) => entity.tableName);
    if (tables.length === 0) return json({ deleted: 0, tables: 0 });

    let deleted = 0;
    for (const table of tables) {
      deleted += (await db.value(`SELECT COUNT(*)::int FROM ${ident(table)}`)) ?? 0;
    }

    await db.query(`TRUNCATE TABLE ${tables.map((table) => ident(table)).join(", ")}`);
    /* Recorded after the truncate, so the trail's first entry afterwards says
       what happened to everything before it. */
    await recordAudit(db, {
      action: "DATA_PURGE",
      entityType: "sys",
      user,
      after: { rows: deleted, tables: tables.length },
    });

    return json({ deleted, tables: tables.length });
  });

  router.get("/model-summary", async (_request, { db }) => {
    const counts = {
      entities: model.entities.length,
      rules: (model.rules || []).length,
      workflows: (model.workflows || []).length,
      sagas: (model.sagas || []).length,
      hooks: (model.hooks || []).length,
      categories: (model.categories || []).length,
    };
    const records = {};
    for (const entity of model.entities) {
      records[entity.name] = await db.value(
        `SELECT COUNT(*)::int FROM ${ident(entity.tableName)} WHERE deleted_at IS NULL`
      );
    }
    // The seeded password belongs on the sign-in screen (/auth/config), which
    // says why it is shown there. Repeating it in every summary response is
    // just a wider blast radius for no gain.
    const { adminPassword: _password, ...project } = model.project;
    return json({ project, counts, records });
  });

  return router;
}

