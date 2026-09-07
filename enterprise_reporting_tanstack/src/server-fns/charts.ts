import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  createChartSchema,
  updateChartSchema,
  getChartSchema,
  type CreateChartInput,
  type UpdateChartInput,
} from "@/lib/schemas/charts";
import { paginationInputSchema } from "@/lib/schemas/common";
import { requireAuth } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db/config";
import { logAudit } from "@/lib/security/audit";
import {
  filterAccessibleResources,
  hasResourceAccess,
  canCreateResource,
  canDeleteResource,
} from "@/lib/permissions/permissions";
import { withErrorHandler } from "@/lib/server-fns/with-error-handler";

export const listCharts = createServerFn({ method: "GET" })
  .inputValidator(paginationInputSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();
        const page = input.page ?? 0;
        const pageSize = Math.min(input.pageSize ?? 20, 100);

        const db = getDb();
        let charts = await db
          .selectFrom("chart_definitions")
          .selectAll()
          .orderBy("created_at", "desc")
          .execute();

        charts = await filterAccessibleResources(session.user.id, charts, "chart", "view");
        const paginatedCharts = charts.slice(page * pageSize, (page + 1) * pageSize);

        return {
          items: paginatedCharts,
          meta: {
            total: charts.length,
            page,
            pageSize,
            totalPages: Math.ceil(charts.length / pageSize),
          },
        };
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "listCharts" },
      }
    );
  });

export const getChart = createServerFn({ method: "GET" })
  .inputValidator(getChartSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();
        const { id } = input;

        const hasAccess = await hasResourceAccess(session.user.id, "chart", id, "view");
        if (!hasAccess) {
          throw new Error("FORBIDDEN");
        }

        const db = getDb();
        const chart = await db
          .selectFrom("chart_definitions")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        if (!chart) {
          throw new Error("NOT_FOUND");
        }

        return chart;
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "getChart", chartId: input.id },
      }
    );
  });

export const createChart = createServerFn({ method: "POST" })
  .inputValidator(createChartSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();

        const canCreate = await canCreateResource(session.user.id, "chart");
        if (!canCreate) {
          throw new Error("FORBIDDEN");
        }

        const db = getDb();
        const id = randomUUID();
        const now = new Date().toISOString();

        await db
          .insertInto("chart_definitions")
          .values({
            id,
            name: input.name,
            description: input.description ?? null,
            saved_query_id: null,
            chart_type: input.chartType,
            chart_config: JSON.stringify(input.chartConfig || {}),
            data_mapping: JSON.stringify({ xAxis: { field: "" }, yAxis: [] }),
            refresh_interval: null,
            color_theme: input.colorScheme ?? null,
            is_public: input.isPublic ?? false,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            created_by: session.user.id,
            created_at: now,
            updated_at: now,
          })
          .execute();

        await logAudit({
          userId: session.user.id,
          action: "create",
          resourceType: "chart",
          resourceId: id,
          details: { name: input.name, chartType: input.chartType },
        });

        const chart = await db
          .selectFrom("chart_definitions")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        return chart;
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "createChart", name: input.name },
      }
    );
  });

export const updateChart = createServerFn({ method: "PUT" })
  .inputValidator(updateChartSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();
        const { id } = input;

        const hasAccess = await hasResourceAccess(session.user.id, "chart", id, "edit");
        if (!hasAccess) {
          throw new Error("FORBIDDEN");
        }

        const db = getDb();
        const existing = await db
          .selectFrom("chart_definitions")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        if (!existing) {
          throw new Error("NOT_FOUND");
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (input.name !== undefined) updates.name = input.name;
        if (input.description !== undefined) updates.description = input.description;
        if (input.chartType !== undefined) updates.chart_type = input.chartType;
        if (input.chartConfig !== undefined) updates.chart_config = JSON.stringify(input.chartConfig);
        if (input.colorScheme !== undefined) updates.color_theme = input.colorScheme;
        if (input.isPublic !== undefined) updates.is_public = input.isPublic;

        await db.updateTable("chart_definitions").set(updates).where("id", "=", id).execute();

        await logAudit({
          userId: session.user.id,
          action: "update",
          resourceType: "chart",
          resourceId: id,
          details: { name: input.name },
        });

        const chart = await db
          .selectFrom("chart_definitions")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        return chart;
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "updateChart", chartId: input.id },
      }
    );
  });

export const deleteChart = createServerFn({ method: "DELETE" })
  .inputValidator(getChartSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();
        const { id } = input;

        const canDelete = await canDeleteResource(session.user.id, "chart", id);
        if (!canDelete) {
          throw new Error("FORBIDDEN");
        }

        const db = getDb();

        await db.deleteFrom("chart_definitions").where("id", "=", id).execute();

        await logAudit({
          userId: session.user.id,
          action: "delete",
          resourceType: "chart",
          resourceId: id,
        });

        return { success: true };
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "deleteChart", chartId: input.id },
      }
    );
  });
