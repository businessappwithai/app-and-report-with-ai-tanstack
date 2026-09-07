/**
 * Schema Introspect Tool
 *
 * Fetches the RBAC-filtered schema for a user+datasource pair.
 * Only tables and columns that the user is permitted to access are returned.
 * Admins receive the full schema (getUserAccessibleEntities returns [] for admins,
 * which signals "no filtering needed").
 */

import { z } from "zod";
import { getDb } from "@/lib/db/config";
import { getUserAccessibleEntities } from "@/lib/permissions/ds-rbac";
import { getSchemaContext } from "@/lib/mastra/schema-store";
import type { DataSource } from "@/types/database";

// ─── Input / Output Schemas ───────────────────────────────────────────────────

export const SchemaIntrospectInput = z.object({
  dataSourceId: z.string().min(1),
  userId: z.string().min(1),
});

export const SchemaIntrospectOutput = z.object({
  tables: z.array(
    z.object({
      name: z.string(),
      schema: z.string().optional(),
      columns: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          nullable: z.boolean().optional(),
        }),
      ),
    }),
  ),
  /** Empty array signals admin / unrestricted access */
  allowedTableNames: z.array(z.string()),
  /** Compact text representation for LLM context */
  schemaText: z.string(),
  dataSourceType: z.string(),
});

export type SchemaIntrospectOutput = z.infer<typeof SchemaIntrospectOutput>;

// ─── Executor ─────────────────────────────────────────────────────────────────

export async function executeSchemaIntrospect(
  input: z.infer<typeof SchemaIntrospectInput>,
): Promise<SchemaIntrospectOutput> {
  const { dataSourceId, userId } = SchemaIntrospectInput.parse(input);

  const db = getDb();

  // Resolve the data source
  const dataSource = (await db
    .selectFrom("data_sources")
    .where("id", "=", dataSourceId)
    .where("is_active", "=", true)
    .selectAll()
    .executeTakeFirst()) as DataSource | undefined;

  if (!dataSource) {
    throw new Error(`Data source ${dataSourceId} not found or inactive`);
  }

  // Fetch RBAC-accessible entities for this user.
  // An empty result from getUserAccessibleEntities indicates admin access —
  // the subsequent filter logic treats length === 0 as "no restriction".
  const accessibleEntities = await getUserAccessibleEntities(userId, dataSourceId);
  const allowedTableNames = accessibleEntities.map((e) => e.entity_name);

  // Retrieve (or lazily build) the full cached schema for this data source
  const schemaCtx = await getSchemaContext(dataSource);
  const rawTables: Array<{
    name: string;
    schema?: string;
    columns?: Array<{ name: string; type: string; nullable?: boolean }>;
  }> = schemaCtx.schemaInfo?.tables ?? [];

  // Filter tables to those the user may see.
  // When allowedTableNames is empty (admin / no DS-role restrictions) all
  // tables pass through.
  const filteredTables = rawTables
    .filter(
      (t) => allowedTableNames.length === 0 || allowedTableNames.includes(t.name),
    )
    .map((t) => {
      let columns: Array<{ name: string; type: string; nullable?: boolean }> =
        (t.columns ?? []).map((c) => ({
          name: c.name,
          type: c.type,
          nullable: c.nullable,
        }));

      // Apply column-level restrictions from the entity permission record
      const entityPerm = accessibleEntities.find((e) => e.entity_name === t.name);
      if (entityPerm?.column_restrictions) {
        try {
          const restrictions: string[] = JSON.parse(entityPerm.column_restrictions as string);
          if (Array.isArray(restrictions) && restrictions.length > 0) {
            columns = columns.filter((c) => restrictions.includes(c.name));
          }
        } catch {
          // Malformed JSON in column_restrictions — serve all columns for this table
        }
      }

      return {
        name: t.name,
        schema: t.schema as string | undefined,
        columns,
      };
    });

  // Build a compact, LLM-friendly schema text:
  // orders(id:integer, user_id:integer, total:decimal)
  const schemaText = filteredTables
    .map(
      (t) =>
        `${t.name}(${t.columns.map((c) => `${c.name}:${c.type}`).join(", ")})`,
    )
    .join("\n");

  return SchemaIntrospectOutput.parse({
    tables: filteredTables,
    allowedTableNames,
    schemaText,
    dataSourceType: dataSource.client_type,
  });
}
