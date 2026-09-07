/**
 * The audit trail.
 *
 * Admin-only to read, written by every path that changes a record and by every
 * sign-in attempt. Failures are recorded too: a run of AUTH_LOGIN with
 * success=false is what an attack looks like from the trail, and a trail that
 * only holds successes cannot show one.
 *
 * `recordAudit` never throws. An audit write must not be able to fail the
 * operation it is describing — losing one line of history is recoverable, and
 * refusing a save the user already saw succeed is not.
 */

import { Router } from "../lib/router.js";
import { badRequest, json, readJson } from "../lib/http.js";
import { requireAdmin, checkOperationAccess } from "../lib/guards.js";

export async function recordAudit(db, entry) {
  try {
    const changed =
      entry.before && entry.after
        ? Object.keys(entry.after).filter(
            (key) => JSON.stringify(entry.before[key]) !== JSON.stringify(entry.after[key])
          )
        : [];
    await db.insert("sys_audit_log", {
      user_id: entry.user ? entry.user.id : null,
      user_email: entry.user ? entry.user.email : entry.email ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId == null ? null : String(entry.entityId),
      before_value: entry.before ? JSON.stringify(entry.before) : null,
      after_value: entry.after ? JSON.stringify(entry.after) : null,
      changed_fields: JSON.stringify(changed),
      source: entry.source ?? "WEB_UI",
      success: entry.success !== false,
      error_message: entry.error ?? null,
    });
  } catch (error) {
    console.warn("[audit] could not record entry:", error.message);
  }
}

export function auditRoutes() {
  const router = new Router();

  router.get("/", async (_request, { db, query, user }) => {
    requireAdmin(user);
    const page = Math.max(1, Number(query.get("page") || 1));
    const limit = Math.min(200, Math.max(1, Number(query.get("limit") || 50)));
    const entityType = query.get("entityType");

    const where = entityType ? "WHERE entity_type = $1" : "";
    const parameters = entityType ? [entityType] : [];

    const total = await db.value(`SELECT COUNT(*)::int FROM sys_audit_log ${where}`, parameters);
    const data = await db.query(
      `SELECT * FROM sys_audit_log ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      parameters
    );
    return json({ data, total, page, limit });
  });

  /**
   * One record's history.
   *
   * Not admin-only, and that is the point: this is the trail shown at the foot
   * of a record's own screen, so anyone who may read the record may read what
   * has been done to it. Access is checked against the entity itself rather
   * than assumed — the same `read` the record needed to be on screen at all, so
   * a role that cannot see Invoices cannot read their history either.
   *
   * Admin-only is still the rule for the whole log (`GET /audit`), which spans
   * every table and every sign-in attempt.
   */
  router.get("/record/:table/:id", async (_request, { db, params, user }) => {
    await checkOperationAccess(db, user, params.table, "read");

    const rows = await db.query(
      `SELECT sys_audit_log_id, user_email, action, changed_fields, before_value, after_value,
              success, error_message, created_at
         FROM sys_audit_log
        WHERE entity_type = $1 AND entity_id = $2
        ORDER BY created_at DESC
        LIMIT 50`,
      [params.table, String(params.id)]
    );

    /* Normalised here rather than in the browser, so a screen does not have to
       know how history is stored.
       
       These columns are JSONB, so the driver hands back a parsed value already
       — but `recordAudit` writes them with `JSON.stringify`, and a build that
       stored them as TEXT would hand back the string. Accepting both is what
       stops `changedFields` silently arriving empty: parsing an array throws,
       and the catch turned every entry into "nothing changed". A value that
       will not parse is returned as null rather than failing the request; one
       corrupt line of history is not worth refusing the other forty-nine. */
    const safe = (value) => {
      if (value == null) return null;
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    return json({
      data: rows.map((row) => ({
        id: row.sys_audit_log_id,
        userEmail: row.user_email,
        action: row.action,
        changedFields: safe(row.changed_fields) ?? [],
        before: safe(row.before_value),
        after: safe(row.after_value),
        success: row.success !== false,
        error: row.error_message,
        at: row.created_at,
      })),
    });
  });

  /**
   * The notes people have left on a record.
   *
   * Readable by whoever may read the record, writable by whoever may update
   * it: a note is a change to what the record says about itself, even though
   * it touches no column of it. Never editable and never deleted — a note that
   * can be rewritten is worth no more than a conversation nobody remembers.
   */
  router.get("/notes/:table/:id", async (_request, { db, params, user }) => {
    await checkOperationAccess(db, user, params.table, "read");
    const rows = await db.query(
      `SELECT sys_note_id, note, user_name, user_email, created_at
         FROM sys_note
        WHERE table_name = $1 AND record_id = $2
        ORDER BY created_at DESC
        LIMIT 100`,
      [params.table, String(params.id)]
    );
    return json({
      data: rows.map((row) => ({
        id: row.sys_note_id,
        note: row.note,
        userName: row.user_name,
        userEmail: row.user_email,
        at: row.created_at,
      })),
    });
  });

  router.post("/notes/:table/:id", async (request, { db, params, user }) => {
    await checkOperationAccess(db, user, params.table, "update");

    const body = await readJson(request);
    const note = String(body.note ?? "").trim();
    if (!note) throw badRequest("A note needs some text.");
    if (note.length > 4000) throw badRequest("A note is at most 4000 characters.");

    const created = await db.insert("sys_note", {
      table_name: params.table,
      record_id: String(params.id),
      note,
      user_id: user ? user.id : null,
      user_name: user ? user.name ?? user.username ?? null : null,
      user_email: user ? user.email : null,
    });

    return json(
      {
        id: created.sys_note_id,
        note: created.note,
        userName: created.user_name,
        userEmail: created.user_email,
        at: created.created_at,
      },
      { status: 201 }
    );
  });

  router.get("/entity-types", async (_request, { db, user }) => {
    requireAdmin(user);
    const rows = await db.query(
      "SELECT DISTINCT entity_type FROM sys_audit_log WHERE entity_type IS NOT NULL ORDER BY entity_type"
    );
    return json(rows.map((row) => row.entity_type));
  });

  return router;
}
