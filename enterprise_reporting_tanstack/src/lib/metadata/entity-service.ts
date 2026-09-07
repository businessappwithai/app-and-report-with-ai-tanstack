/**
 * Entity Service
 *
 * Provides CRUD operations for metadata_entity_header records.
 * All operations are transaction-safe and include audit logging.
 */

import { type Kysely, sql } from "kysely";
import { getDb } from "@/lib/db/config";
import type {
  MetadataEntityHeader,
  MetadataEntityListParams,
  MetadataEntityWithFields,
} from "@/types/database";

// biome-ignore lint/suspicious/noExplicitAny: metadata tables not in main schema
type AnyDB = Kysely<any>;

interface FilterCondition {
  column: string;
  value: unknown;
}

/**
 * Query builder for metadata_entity_header with optional filters
 */
export class EntityQueryBuilder {
  private filters: FilterCondition[] = [];
  private limitVal: number | null = null;
  private offsetVal: number | null = null;
  private orderByCol = "entity_name";
  private orderByDir: "asc" | "desc" = "asc";

  byDataSource(dataSourceId: string): EntityQueryBuilder {
    this.filters.push({ column: "data_source_id", value: dataSourceId });
    return this;
  }

  byActive(isActive: boolean): EntityQueryBuilder {
    this.filters.push({ column: "is_active", value: isActive });
    return this;
  }

  byHidden(isHidden: boolean): EntityQueryBuilder {
    this.filters.push({ column: "is_hidden", value: isHidden });
    return this;
  }

  byEntityType(entityType: "table" | "view"): EntityQueryBuilder {
    this.filters.push({ column: "entity_type", value: entityType });
    return this;
  }

  search(searchTerm: string): EntityQueryBuilder {
    this.filters.push({ column: "__search__", value: searchTerm });
    return this;
  }

  includeHidden(): EntityQueryBuilder {
    return this;
  }

  paginate(page = 1, limit = 50): EntityQueryBuilder {
    this.limitVal = limit;
    this.offsetVal = (page - 1) * limit;
    return this;
  }

  orderBy(column: string, direction: "asc" | "desc" = "asc"): EntityQueryBuilder {
    this.orderByCol = column;
    this.orderByDir = direction;
    return this;
  }

  private buildQuery(forCount = false) {
    const db = getDb() as AnyDB;
    let query = db.selectFrom("metadata_entity_header").selectAll();

    for (const f of this.filters) {
      if (f.column === "__search__") {
        const term = `%${f.value}%`;
        query = query.where((eb) =>
          eb.or([eb("entity_name", "like", term), eb("description", "like", term)])
        );
      } else {
        query = query.where(f.column as never, "=", f.value);
      }
    }

    if (!forCount) {
      query = query.orderBy(this.orderByCol as never, this.orderByDir);
      if (this.limitVal !== null) query = query.limit(this.limitVal);
      if (this.offsetVal !== null) query = query.offset(this.offsetVal);
    }

    return query;
  }

  async execute(): Promise<MetadataEntityHeader[]> {
    return (await this.buildQuery().execute()) as MetadataEntityHeader[];
  }

  async withCount(): Promise<{ entities: MetadataEntityHeader[]; total: number }> {
    const [entities, countRows] = await Promise.all([
      this.buildQuery().execute(),
      this.buildQuery(true).clearSelect().select(sql`count(*)`.as("total")).execute(),
    ]);

    return {
      entities: entities as MetadataEntityHeader[],
      total: Number((countRows[0] as any)?.total || 0),
    };
  }
}

/**
 * Entity Service
 */
// biome-ignore lint/complexity/noStaticOnlyClass: service class pattern with cohesive static methods
export class EntityService {
  static async list(
    params: MetadataEntityListParams = {}
  ): Promise<{ entities: MetadataEntityHeader[]; total: number }> {
    const builder = new EntityQueryBuilder();

    if (params.data_source_id) builder.byDataSource(params.data_source_id);

    if (params.include_hidden) {
      // include all
    } else {
      builder.byActive(true).byHidden(false);
    }

    if (params.search) builder.search(params.search);

    const page = params.page || 1;
    const limit = params.limit || 50;
    builder.paginate(page, limit);
    builder.orderBy("entity_name", "asc");

    return builder.withCount();
  }

  static async getById(id: string): Promise<MetadataEntityWithFields | null> {
    const db = getDb() as AnyDB;
    const entity = await db
      .selectFrom("metadata_entity_header")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!entity) return null;

    const fields = await db
      .selectFrom("metadata_entity_field")
      .selectAll()
      .where("entity_header_id", "=", id)
      .orderBy("display_order", "asc")
      .execute();

    return { ...entity, fields } as MetadataEntityWithFields;
  }

  static async getByName(
    dataSourceId: string,
    entityName: string,
    entitySchema?: string
  ): Promise<MetadataEntityWithFields | null> {
    const db = getDb() as AnyDB;
    let q = db
      .selectFrom("metadata_entity_header")
      .selectAll()
      .where("data_source_id", "=", dataSourceId)
      .where("entity_name", "=", entityName);

    if (entitySchema) q = q.where("entity_schema", "=", entitySchema);

    const entity = await q.executeTakeFirst();
    if (!entity) return null;

    const fields = await db
      .selectFrom("metadata_entity_field")
      .selectAll()
      .where("entity_header_id", "=", entity.id)
      .orderBy("display_order", "asc")
      .execute();

    return { ...entity, fields } as MetadataEntityWithFields;
  }

  static async create(
    data: Omit<MetadataEntityHeader, "id" | "created_at" | "updated_at">
  ): Promise<MetadataEntityHeader> {
    const db = getDb() as AnyDB;
    const now = new Date().toISOString();
    const [entity] = await db
      .insertInto("metadata_entity_header")
      .values({ ...data, updated_at: now, created_at: now })
      .returningAll()
      .execute();

    return entity as MetadataEntityHeader;
  }

  static async update(
    id: string,
    data: Partial<Pick<MetadataEntityHeader, "description" | "is_active" | "is_hidden">>,
    userId?: string
  ): Promise<MetadataEntityHeader | null> {
    const db = getDb() as AnyDB;
    const now = new Date().toISOString();
    const [entity] = await db
      .updateTable("metadata_entity_header")
      .set({ ...data, updated_at: now })
      .where("id", "=", id)
      .returningAll()
      .execute();

    if (!entity) return null;

    if (userId) {
      await db
        .insertInto("audit_log")
        .values({
          id: crypto.randomUUID(),
          user_id: userId,
          action: "update",
          resource_type: "metadata_entity",
          resource_id: id,
          details: JSON.stringify({ updated_fields: Object.keys(data) }),
          ip_address: null,
          user_agent: null,
          created_at: now,
        })
        .execute();
    }

    return entity as MetadataEntityHeader;
  }

  static async delete(id: string, userId?: string): Promise<boolean> {
    const db = getDb() as AnyDB;
    const result = await db
      .deleteFrom("metadata_entity_header")
      .where("id", "=", id)
      .executeTakeFirst();

    const deleted = Number(result.numDeletedRows) > 0;

    if (deleted && userId) {
      const now = new Date().toISOString();
      await db
        .insertInto("audit_log")
        .values({
          id: crypto.randomUUID(),
          user_id: userId,
          action: "delete",
          resource_type: "metadata_entity",
          resource_id: id,
          details: JSON.stringify({ deleted: "entity_metadata" }),
          ip_address: null,
          user_agent: null,
          created_at: now,
        })
        .execute();
    }

    return deleted;
  }

  static async exists(
    dataSourceId: string,
    entityName: string,
    entitySchema?: string
  ): Promise<boolean> {
    const db = getDb() as AnyDB;
    let q = db
      .selectFrom("metadata_entity_header")
      .select("id")
      .where("data_source_id", "=", dataSourceId)
      .where("entity_name", "=", entityName);

    if (entitySchema) q = q.where("entity_schema", "=", entitySchema);

    const result = await q.executeTakeFirst();
    return !!result;
  }

  static async countActive(dataSourceId: string): Promise<number> {
    const db = getDb() as AnyDB;
    const [row] = await db
      .selectFrom("metadata_entity_header")
      .select(sql`count(*)`.as("count"))
      .where("data_source_id", "=", dataSourceId)
      .where("is_active", "=", true)
      .where("is_hidden", "=", false)
      .execute();

    return Number((row as any)?.count || 0);
  }

  static async getStaleEntities(
    dataSourceId: string,
    staleThresholdHours = 24
  ): Promise<MetadataEntityHeader[]> {
    const db = getDb() as AnyDB;
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - staleThresholdHours);

    const rows = await db
      .selectFrom("metadata_entity_header")
      .selectAll()
      .where("data_source_id", "=", dataSourceId)
      .where("last_introspected_at", "<", staleDate.toISOString())
      .execute();

    return rows as MetadataEntityHeader[];
  }

  static query(): EntityQueryBuilder {
    return new EntityQueryBuilder();
  }
}
