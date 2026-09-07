/**
 * Sync Service
 *
 * Integrates with datasource inspection to automatically create and update
 * metadata_entity_header and metadata_entity_field records.
 */

import type { Kysely } from "kysely";
import { getDb } from "@/lib/db/config";
import { getConnection } from "@/lib/db/connection-manager";
import { introspectSchema } from "@/lib/sql/schema-introspection";
import type { TableInfo } from "@/types/api";
import type { MetadataEntityField } from "@/types/database";

// biome-ignore lint/suspicious/noExplicitAny: metadata tables not in main schema
type AnyDB = Kysely<any>;

/**
 * Sync Service
 */
// biome-ignore lint/complexity/noStaticOnlyClass: service class pattern with cohesive static methods
export class SyncService {
  /**
   * Sync a single datasource (create/update entity and field metadata)
   */
  static async syncDataSource(
    dataSourceId: string,
    userId?: string
  ): Promise<{
    entitiesCreated: number;
    entitiesUpdated: number;
    fieldsCreated: number;
    fieldsUpdated: number;
    errors: string[];
  }> {
    let entitiesCreated = 0;
    let entitiesUpdated = 0;
    let fieldsCreated = 0;
    let fieldsUpdated = 0;
    const errors: string[] = [];

    const db = getDb() as AnyDB;

    const dataSource = await db
      .selectFrom("data_sources")
      .selectAll()
      .where("id", "=", dataSourceId)
      .executeTakeFirst();

    if (!dataSource) {
      throw new Error(`Data source ${dataSourceId} not found`);
    }

    const connection = await getConnection({
      id: dataSourceId,
      name: dataSource.name,
      client_type: dataSource.client_type as "pg" | "mysql" | "sqlite3" | "mssql",
      type: dataSource.type as "DB_QUERY" | "API_REQUEST",
      connection_config: dataSource.connection_config,
      is_active: dataSource.is_active,
      created_at: dataSource.created_at,
      updated_at: dataSource.updated_at,
    });

    if (!connection) {
      throw new Error("Failed to establish connection to datasource");
    }

    const introspectionResult = await introspectSchema(
      connection,
      dataSource.client_type as "pg" | "mysql" | "sqlite3" | "mssql"
    );

    await db.transaction().execute(async (trx: AnyDB) => {
      for (const tableInfo of introspectionResult.schema.tables) {
        try {
          const now = new Date().toISOString();

          let existingEntityQuery = trx
            .selectFrom("metadata_entity_header")
            .selectAll()
            .where("data_source_id", "=", dataSourceId)
            .where("entity_name", "=", tableInfo.name);

          if (tableInfo.schema) {
            existingEntityQuery = existingEntityQuery.where("entity_schema", "=", tableInfo.schema);
          }

          const existingEntity = await existingEntityQuery.executeTakeFirst();

          const schemaMetadata = JSON.stringify({
            tableName: tableInfo.name,
            schema: tableInfo.schema,
            entityType: "table",
            primaryKey: tableInfo.primaryKey,
            foreignKeys: tableInfo.foreignKeys || [],
            indexes: tableInfo.indexes || [],
            columns: tableInfo.columns || [],
          });

          if (existingEntity) {
            await trx
              .updateTable("metadata_entity_header")
              .set({ schema_metadata: schemaMetadata, last_introspected_at: now, updated_at: now })
              .where("id", "=", existingEntity.id)
              .execute();

            const fieldResult = await SyncService.syncFields(
              trx,
              existingEntity.id,
              tableInfo,
              userId
            );

            entitiesUpdated++;
            fieldsCreated += fieldResult.created;
            fieldsUpdated += fieldResult.updated;
          } else {
            const newEntityId = crypto.randomUUID();
            await trx
              .insertInto("metadata_entity_header")
              .values({
                id: newEntityId,
                data_source_id: dataSourceId,
                entity_name: tableInfo.name,
                entity_schema: tableInfo.schema || null,
                entity_type: "table",
                schema_metadata: schemaMetadata,
                last_introspected_at: now,
                is_active: false,
                is_hidden: true,
                created_by: userId ?? null,
                updated_at: now,
                created_at: now,
              })
              .execute();

            const fieldResult = await SyncService.syncFields(
              trx,
              newEntityId,
              tableInfo,
              userId,
              true
            );

            entitiesCreated++;
            fieldsCreated += fieldResult.created;
            fieldsUpdated += fieldResult.updated;
          }
        } catch (error) {
          errors.push(`Error syncing entity ${tableInfo.name}: ${error}`);
        }
      }

      if (userId) {
        const now = new Date().toISOString();
        await trx
          .insertInto("audit_log")
          .values({
            id: crypto.randomUUID(),
            user_id: userId,
            action: "create",
            resource_type: "metadata_entity",
            resource_id: dataSourceId,
            details: JSON.stringify({
              operation: "sync_datasource",
              entitiesCreated,
              entitiesUpdated,
              fieldsCreated,
              fieldsUpdated,
              errors,
              table_count: introspectionResult.schema.tables.length,
            }),
            ip_address: null,
            user_agent: null,
            created_at: now,
          })
          .execute();
      }
    });

    return { entitiesCreated, entitiesUpdated, fieldsCreated, fieldsUpdated, errors };
  }

  /**
   * Sync fields for an entity
   */
  private static async syncFields(
    trx: AnyDB,
    entityHeaderId: string,
    tableInfo: TableInfo,
    _userId?: string,
    isNewEntity = false
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    const existingFieldsMap = new Map<string, MetadataEntityField>();
    if (!isNewEntity) {
      const existingFields = await trx
        .selectFrom("metadata_entity_field")
        .selectAll()
        .where("entity_header_id", "=", entityHeaderId)
        .execute();

      for (const field of existingFields as MetadataEntityField[]) {
        existingFieldsMap.set(field.field_name, field);
      }
    }

    for (const column of tableInfo.columns || []) {
      const now = new Date().toISOString();
      const existingField = existingFieldsMap.get(column.name);

      const fkInfo = tableInfo.foreignKeys?.find((fk) => fk.column === column.name);

      const fieldData = {
        entity_header_id: entityHeaderId,
        field_name: column.name,
        data_type: column.type || "unknown",
        is_nullable: column.nullable ?? true,
        is_primary_key: tableInfo.primaryKey?.includes(column.name) ?? false,
        is_foreign_key: !!fkInfo,
        foreign_key_table: fkInfo?.referencedTable ?? null,
        foreign_key_column: fkInfo?.referencedColumn ?? null,
        default_value:
          column.defaultValue !== undefined && column.defaultValue !== null
            ? String(column.defaultValue)
            : null,
      };

      if (existingField) {
        await trx
          .updateTable("metadata_entity_field")
          .set({ ...fieldData, updated_at: now })
          .where("id", "=", existingField.id)
          .execute();
        updated++;
      } else {
        await trx
          .insertInto("metadata_entity_field")
          .values({
            id: crypto.randomUUID(),
            ...fieldData,
            description: null,
            is_display_field: false,
            is_searchable: true,
            display_order: null,
            relationship_ui_type: null,
            created_at: now,
            updated_at: now,
          })
          .execute();
        created++;
      }
    }

    return { created, updated };
  }

  static async getStaleDataSources(
    staleThresholdHours = 24
  ): Promise<Array<{ id: string; name: string; last_synced?: string }>> {
    const db = getDb() as AnyDB;
    const dataSources = await db
      .selectFrom("data_sources")
      .select(["id", "name"])
      .where("is_active", "=", true)
      .execute();

    const staleSources: Array<{ id: string; name: string; last_synced?: string }> = [];

    for (const ds of dataSources as Array<{ id: string; name: string }>) {
      const entities = await db
        .selectFrom("metadata_entity_header")
        .select("last_introspected_at")
        .where("data_source_id", "=", ds.id)
        .orderBy("last_introspected_at", "desc")
        .limit(1)
        .execute();

      if (entities.length === 0) {
        staleSources.push({ id: ds.id, name: ds.name, last_synced: undefined });
      } else {
        const lastSynced = new Date((entities[0] as any).last_introspected_at);
        const staleDate = new Date();
        staleDate.setHours(staleDate.getHours() - staleThresholdHours);

        if (lastSynced < staleDate) {
          staleSources.push({ id: ds.id, name: ds.name, last_synced: lastSynced.toISOString() });
        }
      }
    }

    return staleSources;
  }

  static async syncStaleDataSources(
    staleThresholdHours = 24,
    userId?: string
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    details: Array<{
      dataSourceId: string;
      dataSourceName: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const staleSources = await SyncService.getStaleDataSources(staleThresholdHours);
    const details: Array<{
      dataSourceId: string;
      dataSourceName: string;
      success: boolean;
      error?: string;
    }> = [];
    let succeeded = 0;
    let failed = 0;

    for (const ds of staleSources) {
      try {
        await SyncService.syncDataSource(ds.id, userId);
        details.push({ dataSourceId: ds.id, dataSourceName: ds.name, success: true });
        succeeded++;
      } catch (error) {
        details.push({
          dataSourceId: ds.id,
          dataSourceName: ds.name,
          success: false,
          error: String(error),
        });
        failed++;
      }
    }

    return { processed: staleSources.length, succeeded, failed, details };
  }
}
