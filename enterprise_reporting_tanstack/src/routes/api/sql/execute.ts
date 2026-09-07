import { createFileRoute } from "@tanstack/react-router";
import { sql as kyselySql } from "kysely";
import { verifySession } from "@/lib/auth/session";
import { sqlEditorConfig, validatePageSize } from "@/lib/config/pagination";
import { getDb } from "@/lib/db/config";
import { getConnection } from "@/lib/db/connection-manager";
import { logAudit } from "@/lib/security/audit";
import { json } from "@/lib/server/response";
import { isReadOnlyQuery } from "@/lib/sql/validator";
import { createLogger } from "@/lib/logging/logger";
import { AUDIT_ACTIONS } from "@/types/actions";
import { LOG_COMPONENTS } from "@/types/components";
import type { DataSource } from "@/types/database";

async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export const Route = createFileRoute("/api/sql/execute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const logger = createLogger({ component: LOG_COMPONENTS.SQL_EXECUTOR });
        const startTime = Date.now();

        try {
          const session = await getSession(request);
          if (!session?.user) {
            logger.warn("SQL execution attempt without authentication", {
              timestamp: new Date().toISOString(),
              remoteIp: request.headers.get("x-forwarded-for") || "unknown",
            });
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const body = (await request.json()) as {
            sql: string;
            dataSourceId: string;
            parameters?: unknown[];
            limit?: number;
            offset?: number;
            timeout?: number;
          };

          const { sql, dataSourceId, limit, offset } = body;

          if (!sql) {
            logger.warn("SQL execution with empty query", {
              userId: session.user.id,
              email: session.user.email,
              timestamp: new Date().toISOString(),
            });
            return json(
              {
                success: false,
                error: { code: "INVALID_INPUT", message: "SQL content is required" },
              },
              { status: 400 }
            );
          }

          if (!dataSourceId) {
            logger.warn("SQL execution without data source", {
              userId: session.user.id,
              email: session.user.email,
              sqlLength: sql.length,
              timestamp: new Date().toISOString(),
            });
            return json(
              {
                success: false,
                error: { code: "INVALID_INPUT", message: "Data source ID is required" },
              },
              { status: 400 }
            );
          }

          if (!isReadOnlyQuery(sql)) {
            logger.warn("Non-SELECT query attempted", {
              userId: session.user.id,
              email: session.user.email,
              dataSourceId,
              sqlPreview: sql.substring(0, 100),
              action: AUDIT_ACTIONS.SQL.NON_SELECT_QUERY_REJECTED,
              timestamp: new Date().toISOString(),
            });
            return json(
              {
                success: false,
                error: {
                  code: "FORBIDDEN",
                  message: "Only SELECT queries are allowed in the SQL editor",
                },
              },
              { status: 403 }
            );
          }

          const db = getDb();
          const dataSource = await db
            .selectFrom("data_sources")
            .selectAll()
            .where("id", "=", dataSourceId)
            .where("is_active", "=", true)
            .executeTakeFirst();

          if (!dataSource) {
            logger.warn("Data source not found or inactive", {
              userId: session.user.id,
              email: session.user.email,
              dataSourceId,
              timestamp: new Date().toISOString(),
            });
            return json(
              { success: false, error: { code: "NOT_FOUND", message: "Data source not found" } },
              { status: 404 }
            );
          }

          logger.info("SQL query execution started", {
            userId: session.user.id,
            email: session.user.email,
            dataSourceName: (dataSource as any).name,
            dataSourceId,
            sqlLength: sql.length,
            sqlPreview: sql.substring(0, 200),
            limit,
            offset,
            action: AUDIT_ACTIONS.SQL.QUERY_EXECUTION_STARTED,
            timestamp: new Date().toISOString(),
          });

          const connection = await getConnection(dataSource as unknown as DataSource);

          const PAGE_SIZE = sqlEditorConfig.serverPageSize;
          const MAX_CLIENT_ROWS = sqlEditorConfig.maxClientRows;

          let totalRowCount = 0;

          // Try to get count, but don't fail if it doesn't work
          // Different databases have different syntax quirks
          try {
            const cleanSql = sql.trim().replace(/;$/, "");
            const countSQL = `SELECT COUNT(*) as total FROM (${cleanSql}) as count_query`;
            const { rows: countRows } = await kyselySql.raw(countSQL).execute(connection);
            totalRowCount = Number((countRows[0] as Record<string, unknown>)?.total) || 0;
          } catch (e) {
            // If counting fails, just continue without total row count
            logger.debug("Could not count total rows (non-blocking)", {
              userId: session.user.id,
              error: (e as Error)?.message,
            });
            totalRowCount = 0;
          }

          let limitedSQL = sql.trim();
          const effectiveLimit = validatePageSize(limit || sqlEditorConfig.serverPageSize);
          const effectiveOffset = offset || 0;

          if (!/\bLIMIT\s+\d+/i.test(limitedSQL) && !/\bTOP\s+\d+/i.test(limitedSQL)) {
            if (limitedSQL.endsWith(";")) limitedSQL = limitedSQL.slice(0, -1);
            limitedSQL = `${limitedSQL} LIMIT ${effectiveLimit} OFFSET ${effectiveOffset}`;
          } else if (
            /\bLIMIT\s+\d+/i.test(limitedSQL) &&
            !/\bOFFSET\s+\d+/i.test(limitedSQL) &&
            effectiveOffset > 0
          ) {
            if (limitedSQL.endsWith(";")) limitedSQL = limitedSQL.slice(0, -1);
            limitedSQL = `${limitedSQL} OFFSET ${effectiveOffset}`;
          }

          const limitMatch = limitedSQL.match(/\bLIMIT\s+(\d+)/i);
          if (limitMatch) {
            const userLimit = parseInt(limitMatch[1], 10);
            const validatedLimit = validatePageSize(userLimit);
            if (userLimit !== validatedLimit) {
              limitedSQL = limitedSQL.replace(/\bLIMIT\s+\d+/i, `LIMIT ${validatedLimit}`);
            }
          }

          const executionStartTime = Date.now();

          const { rows: rawRows } = await kyselySql.raw(limitedSQL).execute(connection);

          const executionTime = Date.now() - executionStartTime;

          const rows = rawRows as Record<string, unknown>[];

          // Database drivers may return values as strings from the wire protocol;
          // infer numeric/boolean columns by checking if every non-null value
          // in the first row (and a few sample rows) looks like a number/boolean.
          function inferType(colName: string): string {
            const samples = rows.slice(0, 5);
            const nonNull = samples
              .map((r) => r[colName])
              .filter((v) => v !== null && v !== undefined && v !== "");
            if (nonNull.length === 0) return "string";
            const allNumeric = nonNull.every(
              (v) =>
                typeof v === "number" ||
                (typeof v === "string" && !Number.isNaN(Number(v)) && v.trim() !== "")
            );
            if (allNumeric) return "number";
            if (nonNull.every((v) => typeof v === "boolean")) return "boolean";
            return "string";
          }

          const columns: { name: string; type: string }[] =
            rows.length > 0
              ? Object.keys(rows[0]).map((name) => ({ name, type: inferType(name) }))
              : [];

          logger.info("SQL query executed successfully", {
            userId: session.user.id,
            email: session.user.email,
            dataSourceName: (dataSource as any).name,
            dataSourceId,
            rowCount: rows.length,
            totalRows: totalRowCount,
            executionTime,
            columnCount: columns.length,
            columnNames: columns.map((c) => c.name),
            limit: effectiveLimit,
            offset: effectiveOffset,
            sql: sql,
            action: AUDIT_ACTIONS.SQL.QUERY_EXECUTION_SUCCESS,
            timestamp: new Date().toISOString(),
          });

          await logAudit({
            userId: session.user.id,
            action: "execute",
            resourceType: "query",
            resourceId: dataSourceId,
            details: { sql: sql.substring(0, 500), rowCount: rows.length, executionTime },
          });

          return json({
            success: true,
            data: {
              columns,
              rows,
              rowCount: rows.length,
              totalRows: totalRowCount,
              executionTime,
              truncated: rows.length >= PAGE_SIZE,
              pagination: {
                limit: PAGE_SIZE,
                offset: effectiveOffset,
                totalRows: totalRowCount,
                hasMore: totalRowCount > 0 ? effectiveOffset + rows.length < totalRowCount : false,
                serverSide: true,
                maxClientRows: MAX_CLIENT_ROWS,
              },
            },
          });
        } catch (error) {
          const session = await getSession(request);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const totalTime = Date.now() - startTime;

          const body = (await request.json()) as { sql: string };
          logger.error(
            "SQL execution failed",
            error instanceof Error ? error : new Error(errorMessage),
            {
              userId: session?.user?.id || "unknown",
              email: session?.user?.email || "unknown",
              errorMessage,
              errorType: error?.constructor?.name || "Unknown",
              sql: body?.sql,
              action: AUDIT_ACTIONS.SQL.QUERY_EXECUTION_FAILED,
              executionTime: totalTime,
              timestamp: new Date().toISOString(),
            }
          );

          return json(
            {
              success: false,
              error: {
                code: "EXECUTION_ERROR",
                message: errorMessage,
              },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
