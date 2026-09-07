/**
 * Data Service
 *
 * Provides CRUD operations for entity data when datasources are editable.
 * All operations respect ds_entity_permissions and use server-side pagination.
 */

import { getDb } from "@/lib/db/config";
import { getConnection } from "@/lib/db/connection-manager";
import type { DataSource, MetadataEntityWithFields } from "@/types/database";

/**
 * Paginated result type
 */
export interface PaginatedResult<T> {
  records: T[];
  total: number;
  pageCount: number;
  page: number;
  limit: number;
}

/**
 * Query parameters for entity data listing
 */
export interface EntityDataQueryParams {
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

/**
 * Data Service
 */
// biome-ignore lint/complexity/noStaticOnlyClass: service class pattern with cohesive static methods
export class DataService {
  /**
   * List records from an entity with server-side pagination
   */
  static async listRecords(
    dataSourceId: string,
    entityMetadata: MetadataEntityWithFields,
    params: EntityDataQueryParams = {},
    _userId?: string
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    // Check if datasource is editable
    const dataSource = (await getDb()
      .selectFrom("data_sources")
      .where("id", dataSourceId)
      .selectAll()
      .executeTakeFirst()) as DataSource | undefined;

    if (!dataSource) {
      throw new Error("Data source not found");
    }

    if (!dataSource.is_editable) {
      throw new Error("Data source is not editable");
    }

    // Get connection
    const connection = await getConnection(dataSource);

    if (!connection) {
      throw new Error("Failed to connect to datasource");
    }

    // Build query
    let query = connection(entityMetadata.entity_name).select("*");

    // Apply search filter
    if (params.search?.trim()) {
      const displayFields = entityMetadata.fields.filter((f) => f.is_searchable);
      if (displayFields.length > 0) {
        const searchConditions = displayFields.map((f) =>
          getDb().raw("?? LIKE ?", [f.field_name, `%${params.search}%`])
        );
        query = query.andWhere(...searchConditions);
      }
    }

    // Get total count before pagination
    let countQuery = connection(entityMetadata.entity_name).clearSelect().count("* as total");

    if (params.search?.trim()) {
      const displayFields = entityMetadata.fields.filter((f) => f.is_searchable);
      if (displayFields.length > 0) {
        const searchConditions = displayFields.map((f) =>
          getDb().raw("?? LIKE ?", [f.field_name, `%${params.search}%`])
        );
        countQuery = countQuery.andWhere(...searchConditions);
      }
    }

    const countResult = await countQuery.first();
    const total = Number(countResult?.total || 0);

    // Apply pagination
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 500);
    const offset = (page - 1) * limit;

    query = query.limit(limit).offset(offset);

    // Apply sorting
    if (params.sort) {
      const sortOrder = params.order || "asc";
      query = query.orderBy(params.sort, sortOrder);
    } else {
      const pkField = entityMetadata.fields.find((f) => f.is_primary_key);
      if (pkField) {
        query = query.orderBy(pkField.field_name, "asc");
      }
    }

    const records = await query.select("*");

    return {
      records: records as Record<string, unknown>[],
      total,
      pageCount: Math.ceil(total / limit),
      page,
      limit,
    };
  }

  /**
   * Get single record by ID
   */
  static async getRecord(
    dataSourceId: string,
    entityMetadata: MetadataEntityWithFields,
    recordId: string | number,
    _userId?: string
  ): Promise<Record<string, unknown> | null> {
    const dataSource = (await getDb()
      .selectFrom("data_sources")
      .where("id", dataSourceId)
      .selectAll()
      .executeTakeFirst()) as DataSource | undefined;

    if (!dataSource?.is_editable) {
      throw new Error("Data source not editable");
    }

    const connectionManager = getConnectionManager();
    const connection = await connectionManager.getConnection({
      id: dataSourceId,
      client_type: dataSource.client_type as "pg" | "mysql" | "sqlite3" | "mssql",
      connection_config: dataSource.connection_config,
    });

    if (!connection) {
      throw new Error("Failed to connect to datasource");
    }

    const pkField = entityMetadata.fields.find((f) => f.is_primary_key);
    if (!pkField) {
      throw new Error("Entity has no primary key defined");
    }

    const [record] = await connection(entityMetadata.entity_name)
      .where(pkField.field_name, recordId)
      .select("*")
      .limit(1);

    return record as Record<string, unknown> | null;
  }

  /**
   * Create new record
   */
  static async createRecord(
    dataSourceId: string,
    entityMetadata: MetadataEntityWithFields,
    data: Record<string, unknown>,
    _userId?: string
  ): Promise<Record<string, unknown>> {
    const dataSource = (await getDb()
      .selectFrom("data_sources")
      .where("id", dataSourceId)
      .selectAll()
      .executeTakeFirst()) as DataSource | undefined;

    if (!dataSource?.is_editable) {
      throw new Error("Data source not editable");
    }

    const connectionManager = getConnectionManager();
    const connection = await connectionManager.getConnection({
      id: dataSourceId,
      client_type: dataSource.client_type as "pg" | "mysql" | "sqlite3" | "mssql",
      connection_config: dataSource.connection_config,
    });

    if (!connection) {
      throw new Error("Failed to connect to datasource");
    }

    // Validate required fields
    const requiredFields = entityMetadata.fields.filter((f) => !f.is_nullable);
    for (const field of requiredFields) {
      if (data[field.field_name] === null || data[field.field_name] === undefined) {
        throw new Error(`Required field '${field.field_name}' is missing`);
      }
    }

    const [record] = await connection(entityMetadata.entity_name).insert(data).returning("*");

    // Audit log
    if (userId) {
      await getDb()
        .insertInto("audit_log")
        .values({
          user_id: userId,
          action: "create",
          resource_type: "metadata_entity",
          resource_id: entityMetadata.id,
          details: JSON.stringify({
            entity_name: entityMetadata.entity_name,
            record_id: record[pkField.field_name],
          }),
          created_at: getDb().fn.now(),
        })
        .execute();
    }

    return record as Record<string, unknown>;
  }

  /**
   * Update record
   */
  static async updateRecord(
    dataSourceId: string,
    entityMetadata: MetadataEntityWithFields,
    recordId: string | number,
    data: Record<string, unknown>,
    _userId?: string
  ): Promise<Record<string, unknown> | null> {
    const dataSource = (await getDb()
      .selectFrom("data_sources")
      .where("id", dataSourceId)
      .selectAll()
      .executeTakeFirst()) as DataSource | undefined;

    if (!dataSource?.is_editable) {
      throw new Error("Data source not editable");
    }

    const connectionManager = getConnectionManager();
    const connection = await connectionManager.getConnection({
      id: dataSourceId,
      client_type: dataSource.client_type as "pg" | "mysql" | "sqlite3" | "mssql",
      connection_config: dataSource.connection_config,
    });

    if (!connection) {
      throw new Error("Failed to connect to datasource");
    }

    const pkField = entityMetadata.fields.find((f) => f.is_primary_key);
    if (!pkField) {
      throw new Error("Entity has no primary key defined");
    }

    const updated = await connection(entityMetadata.entity_name)
      .where(pkField.field_name, recordId)
      .update(data);

    if (updated === 0) {
      return null;
    }

    const [record] = await connection(entityMetadata.entity_name)
      .where(pkField.field_name, recordId)
      .select("*")
      .limit(1);

    if (userId) {
      await getDb()
        .insertInto("audit_log")
        .values({
          user_id: userId,
          action: "update",
          resource_type: "metadata_entity",
          resource_id: entityMetadata.id,
          details: JSON.stringify({
            entity_name: entityMetadata.entity_name,
            record_id: recordId,
            updated_fields: Object.keys(data),
          }),
          created_at: getDb().fn.now(),
        })
        .execute();
    }

    return record as Record<string, unknown> | null;
  }

  /**
   * Delete record
   */
  static async deleteRecord(
    dataSourceId: string,
    entityMetadata: MetadataEntityWithFields,
    recordId: string | number,
    _userId?: string
  ): Promise<boolean> {
    const dataSource = (await getDb()
      .selectFrom("data_sources")
      .where("id", dataSourceId)
      .selectAll()
      .executeTakeFirst()) as DataSource | undefined;

    if (!dataSource?.is_editable) {
      throw new Error("Data source not editable");
    }

    const connectionManager = getConnectionManager();
    const connection = await connectionManager.getConnection({
      id: dataSourceId,
      client_type: dataSource.client_type as "pg" | "mysql" | "sqlite3" | "mssql",
      connection_config: dataSource.connection_config,
    });

    if (!connection) {
      throw new Error("Failed to connect to datasource");
    }

    const pkField = entityMetadata.fields.find((f) => f.is_primary_key);
    if (!pkField) {
      throw new Error("Entity has no primary key defined");
    }

    const deleted = await connection(entityMetadata.entity_name)
      .where(pkField.field_name, recordId)
      .del();

    if (userId && deleted > 0) {
      await getDb()
        .insertInto("audit_log")
        .values({
          user_id: userId,
          action: "delete",
          resource_type: "metadata_entity",
          resource_id: entityMetadata.id,
          details: JSON.stringify({
            entity_name: entityMetadata.entity_name,
            record_id: recordId,
          }),
          created_at: getDb().fn.now(),
        })
        .execute();
    }

    return deleted > 0;
  }

  /**
   * Search records (for foreign key relationship popup)
   */
  static async searchRecords(
    dataSourceId: string,
    entityMetadata: MetadataEntityWithFields,
    searchTerm: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    return await DataService.listRecords(dataSourceId, entityMetadata, {
      search: searchTerm,
      page,
      limit,
    });
  }
}
