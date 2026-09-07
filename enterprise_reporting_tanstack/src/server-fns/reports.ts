"use server";

import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db/config";
import { logAudit } from "@/lib/security/audit";
import { listReportsSchema, createReportSchema, updateReportSchema, getReportSchema } from "@/lib/schemas/reports";

export const listReports = createServerFn({
  method: "GET",
}).handler(async (input) => {
  const validated = await listReportsSchema.parseAsync(input).catch((err) => {
    throw new Error(`Validation failed: ${err.message}`);
  });
  const _session = await requireAuth();
  const { page = 0, pageSize = 20 } = validated;

  const db = getDb();
  const reports = await db
    .selectFrom("report_definitions")
    .selectAll()
    .orderBy("created_at", "desc")
    .limit(pageSize)
    .offset(page * pageSize)
    .execute();

  const countResult = await db
    .selectFrom("report_definitions")
    .select((eb) => eb.fn.count("id").as("count"))
    .executeTakeFirst();
  const total = Number(countResult?.count || 0);

  return {
    items: reports,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  };
});

export const getReport = createServerFn({
  method: "GET",
}).handler(async (input) => {
  const validated = await getReportSchema.parseAsync(input).catch((err) => {
    throw new Error(`Validation failed: ${err.message}`);
  });
  const _session = await requireAuth();
  const { id } = validated;

  const db = getDb();
  const report = await db
    .selectFrom("report_definitions")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!report) {
    throw new Error("Report not found");
  }

  return report;
});

export const createReport = createServerFn({
  method: "POST",
}).handler(async (input) => {
  const validated = await createReportSchema.parseAsync(input).catch((err) => {
    throw new Error(`Validation failed: ${err.message}`);
  });
  const session = await requireAuth();

  const {
    name,
    description,
    savedQueryId,
    columnConfig,
    filterConfig,
    sortConfig,
    paginationConfig,
    exportFormats,
  } = validated;

  const db = getDb();
  const id = randomUUID();

  await db
    .insertInto("report_definitions")
    .values({
      id,
      name,
      description: description || null,
      saved_query_id: savedQueryId || null,
      column_config: JSON.stringify(columnConfig || []),
      filter_config: filterConfig ? JSON.stringify(filterConfig) : null,
      sort_config: sortConfig ? JSON.stringify(sortConfig) : null,
      pagination_config: paginationConfig ? JSON.stringify(paginationConfig) : null,
      export_formats: JSON.stringify(exportFormats || ["csv", "xlsx", "pdf"]),
      created_by: session.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();

  await logAudit({
    userId: session.user.id,
    action: "create",
    resourceType: "report",
    resourceId: id,
    details: { name },
  });

  return { id };
});

export const updateReport = createServerFn({
  method: "PUT",
}).handler(async (input) => {
  const validated = await updateReportSchema.parseAsync(input).catch((err) => {
    throw new Error(`Validation failed: ${err.message}`);
  });
  const session = await requireAuth();
  const { id, ...updates } = validated;

  const db = getDb();
  await db
    .updateTable("report_definitions")
    .set({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .where("id", "=", id)
    .execute();

  await logAudit({
    userId: session.user.id,
    action: "update",
    resourceType: "report",
    resourceId: id,
    details: updates,
  });

  return { success: true };
});

export const deleteReport = createServerFn({
  method: "DELETE",
}).handler(async (input) => {
  const validated = await getReportSchema.parseAsync(input).catch((err) => {
    throw new Error(`Validation failed: ${err.message}`);
  });
  const session = await requireAuth();
  const { id } = validated;

  const db = getDb();
  await db.deleteFrom("report_definitions").where("id", "=", id).execute();

  await logAudit({
    userId: session.user.id,
    action: "delete",
    resourceType: "report",
    resourceId: id,
  });

  return { success: true };
});
