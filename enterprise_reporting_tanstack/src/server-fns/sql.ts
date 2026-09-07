"use server";

import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";
import { sqlEditorConfig, validatePageSize } from "@/lib/config/pagination";
import { getDb } from "@/lib/db/config";
import { getConnection } from "@/lib/db/connection-manager";
import { logAudit } from "@/lib/security/audit";
import { validateSQLWithAllowlist } from "@/lib/sql/antlr-validator";
import { isReadOnlyQuery } from "@/lib/sql/validator";
import { executeSqlSchema, validateSqlSchema, introspectSchemaSchema } from "@/lib/schemas/sql";
import { withErrorHandler, NotFoundError } from "@/lib/server-fns/with-error-handler";

const DEFAULT_TIMEOUT = 30000;

interface BatchQueryInput {
  queries: Array<{
    widgetId: string;
    sql: string;
    dataSourceId: string;
    limit?: number;
    offset?: number;
  }>;
}

export const batchExecuteSql = createServerFn({
  method: "POST",
}).handler(async (input: BatchQueryInput) => {
  const session = await requireAuth();

  return withErrorHandler(
    async () => {
      if (!input.queries || input.queries.length === 0) {
        throw new Error("At least one query is required");
      }

      if (input.queries.length > 50) {
        throw new Error("Batch size cannot exceed 50 queries");
      }

      // Validate all queries first
      const validatedQueries = await Promise.all(
        input.queries.map(async (q) => {
          const validated = await executeSqlSchema.parseAsync({
            sql: q.sql,
            dataSourceId: q.dataSourceId,
            limit: q.limit,
            offset: q.offset,
          });
          return { widgetId: q.widgetId, ...validated };
        })
      );

      // Execute all queries in parallel
      const results = await Promise.allSettled(
        validatedQueries.map(async (query) => {
          const { widgetId, sql, dataSourceId, limit, offset = 0, timeout = DEFAULT_TIMEOUT } = query;

          if (!isReadOnlyQuery(sql)) {
            throw new Error("Only SELECT queries are allowed");
          }

          const antlrValidation = validateSQLWithAllowlist(sql);
          if (!antlrValidation.valid) {
            const errorMessages = antlrValidation.errors.map((e) => e.message).join("; ");
            throw new Error(`SQL validation failed: ${errorMessages}`);
          }

          const db = getDb();
          const dataSource = await db
            .selectFrom("data_sources")
            .selectAll()
            .where("id", "=", dataSourceId)
            .where("is_active", "=", true)
            .executeTakeFirst();

          if (!dataSource) {
            throw new Error(`Data source not found: ${dataSourceId}`);
          }

          const connection = await getConnection(dataSource);
          const PAGE_SIZE = sqlEditorConfig.serverPageSize;

          // Execute with timeout
          const startTime = Date.now();
          const result =
            dataSource.client_type === "sqlite3"
              ? await connection.raw(sql)
              : await connection.raw(sql).timeout(timeout);

          const executionTime = Date.now() - startTime;

          let rows: Record<string, unknown>[] = [];
          let columns: { name: string; type: string }[] = [];

          if (Array.isArray(result)) {
            rows = result;
          } else if (result.rows) {
            rows = result.rows;
          } else if (result[0]) {
            rows = Array.isArray(result[0]) ? result[0] : [result[0]];
          }

          if (rows.length > 0) {
            columns = Object.keys(rows[0]).map((name) => ({
              name,
              type: typeof rows[0][name],
            }));
          }

          return {
            widgetId,
            result: {
              columns,
              rows,
              rowCount: rows.length,
              executionTime,
              truncated: rows.length >= PAGE_SIZE,
              pagination: {
                limit: PAGE_SIZE,
                offset,
                hasMore: false,
                serverSide: true,
              },
            },
          };
        })
      );

      // Map results back to widget IDs
      const batchResults: Record<string, unknown> = {};
      const errors: Record<string, string> = {};

      for (const result of results) {
        if (result.status === "fulfilled") {
          batchResults[result.value.widgetId] = result.value.result;
        } else {
          const widgetId = validatedQueries[results.indexOf(result)]?.widgetId || "unknown";
          const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          errors[widgetId] = errorMsg;
        }
      }

      // Log the batch execution
      await logAudit({
        userId: session.user.id,
        action: "batch_execute",
        resourceType: "queries",
        details: {
          queryCount: input.queries.length,
          successCount: Object.keys(batchResults).length,
          errorCount: Object.keys(errors).length,
        },
      }).catch(() => {
        // Ignore audit log errors
      });

      return { results: batchResults, errors };
    },
    {
      user: session.user,
      action: "batch_execute",
      resourceType: "queries",
      details: { queryCount: input.queries.length },
    }
  );
});

export const executeSql = createServerFn({
  method: "POST",
}).handler(async (input) => {
  const session = await requireAuth();

  return withErrorHandler(
    async () => {
      const validated = await executeSqlSchema.parseAsync(input).catch((err) => {
        throw new Error(`Validation failed: ${err.message}`);
      });
      const { sql, dataSourceId, limit, offset = 0, timeout = DEFAULT_TIMEOUT } = validated;

      if (!isReadOnlyQuery(sql)) {
        throw new Error("Only SELECT queries are allowed in the SQL editor");
      }

  // ANTLR validation: keyword allowlist enforcement (D11)
  const antlrValidation = validateSQLWithAllowlist(sql);
  if (!antlrValidation.valid) {
    const errorMessages = antlrValidation.errors.map((e) => e.message).join("; ");
    throw new Error(`SQL validation failed: ${errorMessages}`);
  }

  // Log validation warnings for security audit
  if (antlrValidation.warnings.length > 0) {
    const securityWarnings = antlrValidation.warnings.filter((w) => w.type === "security");
    if (securityWarnings.length > 0) {
      await logAudit({
        userId: session.user.id,
        action: "sql_validation_warning",
        resourceType: "query",
        resourceId: dataSourceId,
        details: {
          warnings: securityWarnings.map((w) => w.message),
          sql: sql.substring(0, 200),
        },
      });
    }
  }

  const db = getDb();
  const dataSource = await db
    .selectFrom("data_sources")
    .selectAll()
    .where("id", "=", dataSourceId)
    .where("is_active", "=", true)
    .executeTakeFirst();

  if (!dataSource) {
    throw new Error("Data source not found");
  }

  const connection = await getConnection(dataSource);
  const PAGE_SIZE = sqlEditorConfig.serverPageSize;
  const MAX_CLIENT_ROWS = sqlEditorConfig.maxClientRows;

  let totalRowCount = 0;
  const countSQL = `SELECT COUNT(*) as total FROM (${sql.replace(/;$/, "")}) as count_query`;

  try {
    const countResult =
      dataSource.client_type === "sqlite3"
        ? await connection.raw(countSQL)
        : await connection.raw(countSQL).timeout(5000);

    if (Array.isArray(countResult) && countResult[0]) {
      totalRowCount = Number(countResult[0].total) || 0;
    }
  } catch (e) {
    console.error("Could not count total rows:", e);
  }

  const tooLargeForInteractive = totalRowCount > MAX_CLIENT_ROWS;
  if (tooLargeForInteractive) {
    return {
      columns: [],
      rows: [],
      rowCount: totalRowCount,
      executionTime: 0,
      truncated: false,
      pagination: { limit: PAGE_SIZE, offset, hasMore: false, serverSide: true },
      warning: {
        code: "DATASET_TOO_LARGE",
        message: `Query returns ${totalRowCount.toLocaleString()} rows, which exceeds the interactive limit of ${MAX_CLIENT_ROWS.toLocaleString()} rows.`,
        suggestion: "Run this query as a background job instead.",
        totalRows: totalRowCount,
        interactiveLimit: MAX_CLIENT_ROWS,
      },
    };
  }

  let limitedSQL = sql.trim();
  const effectiveLimit = validatePageSize(limit || sqlEditorConfig.serverPageSize);

  if (!/\bLIMIT\s+\d+/i.test(limitedSQL) && !/\bTOP\s+\d+/i.test(limitedSQL)) {
    if (limitedSQL.endsWith(";")) limitedSQL = limitedSQL.slice(0, -1);
    limitedSQL = `${limitedSQL} LIMIT ${effectiveLimit} OFFSET ${offset}`;
  } else if (
    /\bLIMIT\s+\d+/i.test(limitedSQL) &&
    !/\bOFFSET\s+\d+/i.test(limitedSQL) &&
    offset > 0
  ) {
    if (limitedSQL.endsWith(";")) limitedSQL = limitedSQL.slice(0, -1);
    limitedSQL = `${limitedSQL} OFFSET ${offset}`;
  }

  const limitMatch = limitedSQL.match(/\bLIMIT\s+(\d+)/i);
  if (limitMatch) {
    const userLimit = parseInt(limitMatch[1], 10);
    const validatedLimit = validatePageSize(userLimit);
    if (userLimit !== validatedLimit) {
      limitedSQL = limitedSQL.replace(/\bLIMIT\s+\d+/i, `LIMIT ${validatedLimit}`);
    }
  }

  const startTime = Date.now();
  const result =
    dataSource.client_type === "sqlite3"
      ? await connection.raw(limitedSQL)
      : await connection.raw(limitedSQL).timeout(timeout);

  const executionTime = Date.now() - startTime;

  let rows: Record<string, unknown>[] = [];
  let columns: { name: string; type: string }[] = [];

  if (Array.isArray(result)) {
    rows = result;
  } else if (result.rows) {
    rows = result.rows;
  } else if (result[0]) {
    rows = Array.isArray(result[0]) ? result[0] : [result[0]];
  }

  if (rows.length > 0) {
    columns = Object.keys(rows[0]).map((name) => ({
      name,
      type: typeof rows[0][name],
    }));
  }

  await logAudit({
    userId: session.user.id,
    action: "execute",
    resourceType: "query",
    resourceId: dataSourceId,
    details: { sql: sql.substring(0, 500), rowCount: rows.length, executionTime },
  });

      return {
        columns,
        rows,
        rowCount: rows.length,
        totalRows: totalRowCount,
        executionTime,
        truncated: rows.length >= PAGE_SIZE,
        pagination: {
          limit: PAGE_SIZE,
          offset,
          totalRows: totalRowCount,
          hasMore: totalRowCount > 0 ? offset + rows.length < totalRowCount : false,
          serverSide: true,
          maxClientRows: MAX_CLIENT_ROWS,
        },
      };
    },
    {
      user: session.user,
      action: "execute",
      resourceType: "query",
      resourceId: dataSourceId,
    }
  );
});

export const validateSql = createServerFn({
  method: "POST",
}).handler(async (input) => {
  const validated = await validateSqlSchema.parseAsync(input).catch((err) => {
    throw new Error(`Validation failed: ${err.message}`);
  });
  const _session = await requireAuth();
  const { sql, dataSourceId } = validated;

  if (!sql) {
    throw new Error("SQL content is required");
  }

  const { validateSQL } = await import("@/lib/sql/validator");
  let dialect = "sqlite3";

  if (dataSourceId) {
    const db = getDb();
    const dataSource = await db
      .selectFrom("data_sources")
      .selectAll()
      .where("id", "=", dataSourceId)
      .executeTakeFirst();
    if (dataSource) {
      dialect = dataSource.client_type;
    }
  }

  return validateSQL(sql, dialect);
});

export const introspectSchema = createServerFn({
  method: "GET",
}).handler(async (input) => {
  const validated = await introspectSchemaSchema.parseAsync(input).catch((err) => {
    throw new Error(`Validation failed: ${err.message}`);
  });
  const session = await requireAuth();
  const { dataSourceId } = validated;

  const db = getDb();
  const dataSource = await db
    .selectFrom("data_sources")
    .selectAll()
    .where("id", "=", dataSourceId)
    .where("is_active", "=", true)
    .executeTakeFirst();

  if (!dataSource) {
    throw new Error("Data source not found or not active");
  }

  const connection = await getConnection(dataSource);
  const { introspectSchema: introspect } = await import("@/lib/sql/schema-introspection");
  const { schema, logs } = await introspect(connection, dataSource.client_type);

  let syncResult: {
    entitiesCreated: number;
    entitiesUpdated: number;
    fieldsCreated: number;
    fieldsUpdated: number;
    errors: string[];
  } | undefined;
  try {
    const { SyncService } = await import("@/lib/metadata/sync-service");
    syncResult = await SyncService.syncDataSource(dataSourceId, session.user.id);
  } catch (_e) {
    console.error("[Schema Sync] Failed to sync metadata:", _e);
  }

  if (schema.tables.length === 0 && schema.views.length === 0) {
    return {
      ...schema,
      logs,
      warning:
        "No tables or views found in this database. The database may be empty or you may not have permission to access the tables.",
    };
  }

  return {
    ...schema,
    logs,
    metadataSync: syncResult
      ? {
          entitiesCreated: syncResult.entitiesCreated,
          entitiesUpdated: syncResult.entitiesUpdated,
          fieldsCreated: syncResult.fieldsCreated,
          fieldsUpdated: syncResult.fieldsUpdated,
        }
      : undefined,
  };
});
