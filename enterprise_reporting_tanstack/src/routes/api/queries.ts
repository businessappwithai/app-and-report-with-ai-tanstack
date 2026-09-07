import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { auth } from "@/lib/auth/config";
import { getDb } from "@/lib/db/config";
import { createLogger } from "@/lib/logging/logger";
import { AUDIT_ACTIONS } from "@/types/actions";
import { LOG_COMPONENTS } from "@/types/components";
import { v4 as uuidv4 } from "uuid";

async function getSession(request: Request) {
  return auth(request);
}

export const Route = createFileRoute("/api/queries")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const logger = createLogger({ component: LOG_COMPONENTS.SAVED_QUERIES_API });
        try {
          const session = await getSession(request);
          if (!session?.user) {
            logger.warn("Unauthorized access attempt to queries list", {
              timestamp: new Date().toISOString(),
              remoteIp: request.headers.get("x-forwarded-for") || "unknown",
            });
            return json(
              { success: false, error: { message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const db = getDb();
          const queries = await db.selectFrom("saved_queries").selectAll().execute();

          logger.info("Queries list retrieved", {
            userId: session.user.id,
            email: session.user.email,
            userName: session.user.name,
            queriesCount: queries.length,
            action: AUDIT_ACTIONS.QUERIES.LIST_RETRIEVED,
            timestamp: new Date().toISOString(),
          });

          return json({ success: true, data: { items: queries, meta: { total: queries.length } } });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          logger.error(
            "Failed to fetch queries",
            error instanceof Error ? error : new Error(errorMessage),
            {
              errorMessage,
              timestamp: new Date().toISOString(),
            }
          );
          return json(
            { success: false, error: { message: "Failed to fetch queries" } },
            { status: 500 }
          );
        }
      },
      POST: async ({ request }) => {
        const logger = createLogger({ component: LOG_COMPONENTS.SAVED_QUERIES_API });
        const startTime = Date.now();
        try {
          const session = await getSession(request);
          if (!session?.user) {
            logger.warn("Unauthorized access attempt to create query", {
              timestamp: new Date().toISOString(),
              remoteIp: request.headers.get("x-forwarded-for") || "unknown",
            });
            return json(
              { success: false, error: { message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const body = (await request.json()) as {
            name: string;
            description?: string;
            dataSourceId: string;
            sqlContent: string;
          };

          if (!body.name || !body.dataSourceId || !body.sqlContent) {
            logger.warn("Query creation attempted with missing required fields", {
              userId: session.user.id,
              email: session.user.email,
              action: AUDIT_ACTIONS.QUERIES.VALIDATION_FAILED,
              missingFields: {
                name: !body.name,
                dataSourceId: !body.dataSourceId,
                sqlContent: !body.sqlContent,
              },
              timestamp: new Date().toISOString(),
            });
            return json(
              { success: false, error: { message: "Missing required fields" } },
              { status: 400 }
            );
          }

          const id = uuidv4();
          const db = getDb();

          logger.info("Query creation started", {
            userId: session.user.id,
            email: session.user.email,
            queryName: body.name,
            dataSourceId: body.dataSourceId,
            action: AUDIT_ACTIONS.QUERIES.CREATE_STARTED,
            timestamp: new Date().toISOString(),
          });

          const now = new Date().toISOString();
          await db
            .insertInto("saved_queries")
            .values({
              id,
              created_by: session.user.id,
              name: body.name,
              description: body.description || null,
              data_source_id: body.dataSourceId,
              sql_content: body.sqlContent,
              created_at: now,
              updated_at: now,
            })
            .execute();

          const executionTime = Date.now() - startTime;
          logger.info("Query created successfully", {
            userId: session.user.id,
            email: session.user.email,
            userName: session.user.name,
            queryId: id,
            queryName: body.name,
            dataSourceId: body.dataSourceId,
            sqlLength: body.sqlContent.length,
            description: body.description,
            action: AUDIT_ACTIONS.QUERIES.CREATE_SUCCESS,
            executionTime,
            timestamp: new Date().toISOString(),
          });

          return json({ success: true, data: { id } }, { status: 201 });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const executionTime = Date.now() - startTime;
          logger.error(
            "Failed to create query",
            error instanceof Error ? error : new Error(errorMessage),
            {
              errorMessage,
              errorType: error?.constructor?.name,
              action: AUDIT_ACTIONS.QUERIES.CREATE_FAILED,
              executionTime,
              timestamp: new Date().toISOString(),
            }
          );
          return json(
            { success: false, error: { message: "Failed to create query" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
