import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/config";
import type { AuditAction, AuditLog, ResourceType } from "@/types/database";

export interface AuditLogEntry {
  userId?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  const db = getDb();

  await db
    .insertInto("audit_log")
    .values({
      id: randomUUID(),
      user_id: entry.userId ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      details: entry.details ? JSON.stringify(entry.details) : null,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
      created_at: new Date().toISOString(),
    })
    .execute();
}

export async function getAuditLogs(options: {
  userId?: string;
  resourceType?: ResourceType;
  resourceId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const db = getDb();

  let query = db.selectFrom("audit_log").selectAll();

  if (options.userId) {
    query = query.where("user_id", "=", options.userId);
  }
  if (options.resourceType) {
    query = query.where("resource_type", "=", options.resourceType);
  }
  if (options.resourceId) {
    query = query.where("resource_id", "=", options.resourceId);
  }
  if (options.action) {
    query = query.where("action", "=", options.action);
  }
  if (options.startDate) {
    query = query.where("created_at", ">=", options.startDate.toISOString());
  }
  if (options.endDate) {
    query = query.where("created_at", "<=", options.endDate.toISOString());
  }

  // Count query with the same filters
  let countQuery = db.selectFrom("audit_log").select(db.fn.count<number>("id").as("count"));
  if (options.userId) {
    countQuery = countQuery.where("user_id", "=", options.userId);
  }
  if (options.resourceType) {
    countQuery = countQuery.where("resource_type", "=", options.resourceType);
  }
  if (options.resourceId) {
    countQuery = countQuery.where("resource_id", "=", options.resourceId);
  }
  if (options.action) {
    countQuery = countQuery.where("action", "=", options.action);
  }
  if (options.startDate) {
    countQuery = countQuery.where("created_at", ">=", options.startDate.toISOString());
  }
  if (options.endDate) {
    countQuery = countQuery.where("created_at", "<=", options.endDate.toISOString());
  }

  const countResult = await countQuery.executeTakeFirstOrThrow();
  const total = Number(countResult.count);

  const logs = await query
    .orderBy("created_at", "desc")
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0)
    .execute();

  return { logs: logs as unknown as AuditLog[], total };
}

export async function getResourceHistory(
  resourceType: ResourceType,
  resourceId: string
): Promise<AuditLog[]> {
  const db = getDb();

  const rows = await db
    .selectFrom("audit_log")
    .selectAll()
    .where("resource_type", "=", resourceType)
    .where("resource_id", "=", resourceId)
    .orderBy("created_at", "desc")
    .execute();

  return rows as unknown as AuditLog[];
}

export async function getUserActivity(userId: string, limit = 50): Promise<AuditLog[]> {
  const db = getDb();

  const rows = await db
    .selectFrom("audit_log")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .limit(limit)
    .execute();

  return rows as unknown as AuditLog[];
}

export function createAuditMiddleware(resourceType: ResourceType) {
  return {
    onCreate: async (userId: string, resourceId: string, data: Record<string, unknown>) => {
      await logAudit({
        userId,
        action: "create",
        resourceType,
        resourceId,
        details: { data },
      });
    },
    onUpdate: async (
      userId: string,
      resourceId: string,
      before: Record<string, unknown>,
      after: Record<string, unknown>
    ) => {
      await logAudit({
        userId,
        action: "update",
        resourceType,
        resourceId,
        details: { before, after },
      });
    },
    onDelete: async (userId: string, resourceId: string, data: Record<string, unknown>) => {
      await logAudit({
        userId,
        action: "delete",
        resourceType,
        resourceId,
        details: { data },
      });
    },
    onView: async (userId: string, resourceId: string) => {
      await logAudit({
        userId,
        action: "view",
        resourceType,
        resourceId,
      });
    },
    onExecute: async (userId: string, resourceId: string, parameters?: Record<string, unknown>) => {
      await logAudit({
        userId,
        action: "execute",
        resourceType,
        resourceId,
        details: parameters ? { parameters } : undefined,
      });
    },
    onExport: async (userId: string, resourceId: string, format: string) => {
      await logAudit({
        userId,
        action: "export",
        resourceType,
        resourceId,
        details: { format },
      });
    },
  };
}
