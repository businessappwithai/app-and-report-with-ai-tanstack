import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import {
  createDashboardSchema,
  updateDashboardSchema,
  getDashboardSchema,
  addWidgetSchema,
  updateWidgetSchema,
  removeWidgetSchema,
} from "@/lib/schemas/dashboards";
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

export const listDashboards = createServerFn({ method: "GET" })
  .inputValidator(paginationInputSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();
        const page = input.page ?? 0;
        const pageSize = Math.min(input.pageSize ?? 20, 100);

        const db = getDb();
        let dashboards = await db
          .selectFrom("dashboard_layouts")
          .selectAll()
          .orderBy("created_at", "desc")
          .execute();

        dashboards = await filterAccessibleResources(
          session.user.id,
          dashboards,
          "dashboard",
          "view"
        );

        const paginatedDashboards = dashboards.slice(page * pageSize, (page + 1) * pageSize);

        return {
          items: paginatedDashboards,
          meta: {
            total: dashboards.length,
            page,
            pageSize,
            totalPages: Math.ceil(dashboards.length / pageSize),
          },
        };
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "listDashboards" },
      }
    );
  });

export const getDashboard = createServerFn({ method: "GET" })
  .inputValidator(getDashboardSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();
        const { id } = input;

        const hasAccess = await hasResourceAccess(session.user.id, "dashboard", id, "view");
        if (!hasAccess) {
          throw new Error("FORBIDDEN");
        }

        const db = getDb();
        const dashboard = await db
          .selectFrom("dashboard_layouts")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        if (!dashboard) {
          throw new Error("NOT_FOUND");
        }

        return dashboard;
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "getDashboard", dashboardId: input.id },
      }
    );
  });

export const createDashboard = createServerFn({ method: "POST" })
  .inputValidator(createDashboardSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();

        const canCreate = await canCreateResource(session.user.id, "dashboard");
        if (!canCreate) {
          throw new Error("FORBIDDEN");
        }

        const db = getDb();
        const id = randomUUID();
        const now = new Date().toISOString();

        await db
          .insertInto("dashboard_layouts")
          .values({
            id,
            name: input.name,
            description: input.description ?? null,
            layout_config: JSON.stringify({
              cols: { lg: 12, md: 10, sm: 6, xs: 4 },
              rowHeight: 100,
              layouts: {},
            }),
            theme_config: null,
            refresh_config: null,
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
          resourceType: "dashboard",
          resourceId: id,
          details: { name: input.name },
        });

        const dashboard = await db
          .selectFrom("dashboard_layouts")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        return dashboard;
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "createDashboard", name: input.name },
      }
    );
  });

export const updateDashboard = createServerFn({ method: "PUT" })
  .inputValidator(updateDashboardSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();
        const { id } = input;

        const hasAccess = await hasResourceAccess(session.user.id, "dashboard", id, "edit");
        if (!hasAccess) {
          throw new Error("FORBIDDEN");
        }

        const db = getDb();
        const existing = await db
          .selectFrom("dashboard_layouts")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        if (!existing) {
          throw new Error("NOT_FOUND");
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (input.name !== undefined) updates.name = input.name;
        if (input.description !== undefined) updates.description = input.description;
        if (input.isPublic !== undefined) updates.is_public = input.isPublic;
        if (input.refreshInterval !== undefined)
          updates.refresh_config = JSON.stringify({ interval: input.refreshInterval });

        await db.updateTable("dashboard_layouts").set(updates).where("id", "=", id).execute();

        await logAudit({
          userId: session.user.id,
          action: "update",
          resourceType: "dashboard",
          resourceId: id,
          details: { name: input.name },
        });

        const dashboard = await db
          .selectFrom("dashboard_layouts")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        return dashboard;
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "updateDashboard", dashboardId: input.id },
      }
    );
  });

export const deleteDashboard = createServerFn({ method: "DELETE" })
  .inputValidator(getDashboardSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();
        const { id } = input;

        const canDelete = await canDeleteResource(session.user.id, "dashboard", id);
        if (!canDelete) {
          throw new Error("FORBIDDEN");
        }

        const db = getDb();

        await db.deleteFrom("dashboard_layouts").where("id", "=", id).execute();

        await logAudit({
          userId: session.user.id,
          action: "delete",
          resourceType: "dashboard",
          resourceId: id,
        });

        return { success: true };
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "deleteDashboard", dashboardId: input.id },
      }
    );
  });

export const addWidget = createServerFn({ method: "POST" })
  .inputValidator(addWidgetSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();
        const { dashboardId, widget } = input;

        const hasAccess = await hasResourceAccess(session.user.id, "dashboard", dashboardId, "edit");
        if (!hasAccess) {
          throw new Error("FORBIDDEN");
        }

        const db = getDb();
        const dashboard = await db
          .selectFrom("dashboard_layouts")
          .selectAll()
          .where("id", "=", dashboardId)
          .executeTakeFirst();

        if (!dashboard) {
          throw new Error("NOT_FOUND");
        }

        const widgetId = widget.id || randomUUID();
        const layoutConfig = JSON.parse(dashboard.layout_config || "{}");
        const dashboardWidgets = (layoutConfig.widgets || []) as any[];
        dashboardWidgets.push({ id: widgetId, ...widget });
        layoutConfig.widgets = dashboardWidgets;

        await db
          .updateTable("dashboard_layouts")
          .set({
            layout_config: JSON.stringify(layoutConfig),
            updated_at: new Date().toISOString(),
          })
          .where("id", "=", dashboardId)
          .execute();

        await logAudit({
          userId: session.user.id,
          action: "update",
          resourceType: "dashboard",
          resourceId: dashboardId,
          details: { operation: "addWidget", widgetId },
        });

        const updated = await db
          .selectFrom("dashboard_layouts")
          .selectAll()
          .where("id", "=", dashboardId)
          .executeTakeFirst();

        return updated;
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "addWidget", dashboardId: input.dashboardId },
      }
    );
  });

export const updateWidget = createServerFn({ method: "PUT" })
  .inputValidator(updateWidgetSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();
        const { dashboardId, widgetId, widget } = input;

        const hasAccess = await hasResourceAccess(session.user.id, "dashboard", dashboardId, "edit");
        if (!hasAccess) {
          throw new Error("FORBIDDEN");
        }

        const db = getDb();
        const dashboard = await db
          .selectFrom("dashboard_layouts")
          .selectAll()
          .where("id", "=", dashboardId)
          .executeTakeFirst();

        if (!dashboard) {
          throw new Error("NOT_FOUND");
        }

        const layoutConfig = JSON.parse(dashboard.layout_config || "{}");
        const dashboardWidgets = (layoutConfig.widgets || []) as any[];
        const widgetIndex = dashboardWidgets.findIndex((w) => w.id === widgetId);

        if (widgetIndex === -1) {
          throw new Error("NOT_FOUND");
        }

        dashboardWidgets[widgetIndex] = { id: widgetId, ...widget };
        layoutConfig.widgets = dashboardWidgets;

        await db
          .updateTable("dashboard_layouts")
          .set({
            layout_config: JSON.stringify(layoutConfig),
            updated_at: new Date().toISOString(),
          })
          .where("id", "=", dashboardId)
          .execute();

        await logAudit({
          userId: session.user.id,
          action: "update",
          resourceType: "dashboard",
          resourceId: dashboardId,
          details: { operation: "updateWidget", widgetId },
        });

        const updated = await db
          .selectFrom("dashboard_layouts")
          .selectAll()
          .where("id", "=", dashboardId)
          .executeTakeFirst();

        return updated;
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "updateWidget", dashboardId: input.dashboardId },
      }
    );
  });

export const removeWidget = createServerFn({ method: "DELETE" })
  .inputValidator(removeWidgetSchema)
  .handler(async ({ data: input }) => {
    return withErrorHandler(
      async () => {
        const session = await requireAuth();
        const { dashboardId, widgetId } = input;

        const hasAccess = await hasResourceAccess(session.user.id, "dashboard", dashboardId, "edit");
        if (!hasAccess) {
          throw new Error("FORBIDDEN");
        }

        const db = getDb();
        const dashboard = await db
          .selectFrom("dashboard_layouts")
          .selectAll()
          .where("id", "=", dashboardId)
          .executeTakeFirst();

        if (!dashboard) {
          throw new Error("NOT_FOUND");
        }

        const layoutConfig = JSON.parse(dashboard.layout_config || "{}");
        const dashboardWidgets = (layoutConfig.widgets || []) as any[];
        const filteredWidgets = dashboardWidgets.filter((w) => w.id !== widgetId);

        if (filteredWidgets.length === dashboardWidgets.length) {
          throw new Error("NOT_FOUND");
        }

        layoutConfig.widgets = filteredWidgets;

        await db
          .updateTable("dashboard_layouts")
          .set({
            layout_config: JSON.stringify(layoutConfig),
            updated_at: new Date().toISOString(),
          })
          .where("id", "=", dashboardId)
          .execute();

        await logAudit({
          userId: session.user.id,
          action: "update",
          resourceType: "dashboard",
          resourceId: dashboardId,
          details: { operation: "removeWidget", widgetId },
        });

        const updated = await db
          .selectFrom("dashboard_layouts")
          .selectAll()
          .where("id", "=", dashboardId)
          .executeTakeFirst();

        return updated;
      },
      {
        userId: (await requireAuth()).user.id,
        action: "execute",
        details: { operation: "removeWidget", dashboardId: input.dashboardId },
      }
    );
  });
