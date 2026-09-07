"use server";

import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db/config";
import { withErrorHandler, NotFoundError } from "@/lib/server-fns/with-error-handler";

// Filter link type
interface FilterLink {
  id: string;
  dashboardId: string;
  widgetId: string;
  field: string;
  operator: string;
  value: unknown;
  createdAt: string;
}

interface GetDashboardFilterLinksInput {
  dashboardId: string;
}

export const getDashboardFilterLinks = createServerFn({
  method: "GET",
}).handler(async (input: GetDashboardFilterLinksInput) => {
  const session = await requireAuth();

  return withErrorHandler(
    async () => {
      const { dashboardId } = input;

      const db = getDb();
      const dashboard = await db
        .selectFrom("dashboards")
        .selectAll()
        .where("id", "=", dashboardId)
        .where("is_deleted", "=", false)
        .executeTakeFirst();

      if (!dashboard) {
        throw new NotFoundError("Dashboard", dashboardId);
      }

      // For now, filter links would be stored in dashboard config
      // In a full implementation, they'd be in a dedicated table
      let filterLinks: FilterLink[] = [];

      if (dashboard.widget_config) {
        try {
          const config = JSON.parse(dashboard.widget_config);
          if (config.filterLinks && Array.isArray(config.filterLinks)) {
            filterLinks = config.filterLinks;
          }
        } catch {
          // Invalid JSON, skip filter links
        }
      }

      return { filterLinks, dashboardId };
    },
    {
      user: session.user,
      action: "read",
      resourceType: "dashboard_filters",
      resourceId: input.dashboardId,
    }
  );
});

interface ApplyFilterInput {
  dashboardId: string;
  widgetId: string;
  columnName: string;
  value: unknown;
  operator?: "equals" | "contains" | "gt" | "lt" | "gte" | "lte" | "in" | "between";
}

export const applyDashboardFilter = createServerFn({
  method: "POST",
}).handler(async (input: ApplyFilterInput) => {
  const session = await requireAuth();

  return withErrorHandler(
    async () => {
      // This just validates the filter - actual application happens client-side
      // Real implementation would execute filtered queries server-side if needed
      const { dashboardId, widgetId, columnName, value } = input;

      if (!columnName || columnName.length === 0) {
        throw new Error("Column name is required");
      }

      if (value === undefined || value === null) {
        throw new Error("Filter value is required");
      }

      return {
        success: true,
        dashboardId,
        widgetId,
        columnName,
        appliedAt: new Date().toISOString(),
      };
    },
    {
      user: session.user,
      action: "apply_filter",
      resourceType: "dashboard",
      resourceId: input.dashboardId,
      details: {
        widgetId: input.widgetId,
        columnName: input.columnName,
      },
    }
  );
});
