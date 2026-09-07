import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Store detailed schema instructions per field
  await db.schema
    .createTable("schema_field_instructions")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("data_source_id", "uuid", (col) =>
      col.references("data_sources.id").onDelete("cascade").notNull()
    )
    .addColumn("table_name", "text", (col) => col.notNull())
    .addColumn("field_name", "text", (col) => col.notNull())
    .addColumn("field_type", "text", (col) => col.notNull()) // varchar, integer, date, etc.
    .addColumn("is_nullable", "boolean", (col) => col.defaultTo(true))
    .addColumn("is_primary_key", "boolean", (col) => col.defaultTo(false))
    .addColumn("is_foreign_key", "boolean", (col) => col.defaultTo(false))
    .addColumn("foreign_key_table", "text") // Referenced table if FK
    .addColumn("foreign_key_field", "text") // Referenced field if FK
    .addColumn("description", "text") // What this field represents
    .addColumn("llm_instructions", "text") // Detailed instructions for LLM context
    .addColumn("example_values", "text") // JSON array of example values for LLM
    .addColumn("constraints", "text") // JSON: range, pattern, allowed values, etc.
    .addColumn("business_meaning", "text") // Business context and interpretation
    .addColumn("created_at", "timestamp", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamp", (col) => col.defaultTo(sql`now()`))
    .addColumn("created_by", "uuid", (col) => col.references("users.id").onDelete("setNull"))
    .addColumn("updated_by", "uuid", (col) => col.references("users.id").onDelete("setNull"))
    .unique(["data_source_id", "table_name", "field_name"])
    .execute();

  // Store table-level instructions
  await db.schema
    .createTable("schema_table_instructions")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("data_source_id", "uuid", (col) =>
      col.references("data_sources.id").onDelete("cascade").notNull()
    )
    .addColumn("table_name", "text", (col) => col.notNull())
    .addColumn("description", "text") // What this table represents
    .addColumn("llm_instructions", "text") // Context for LLM about this table
    .addColumn("example_queries", "text") // JSON array of example SQL patterns
    .addColumn("business_domain", "text") // e.g., "Customer Management", "Order Processing"
    .addColumn("created_at", "timestamp", (col) => col.defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamp", (col) => col.defaultTo(sql`now()`))
    .addColumn("created_by", "uuid", (col) => col.references("users.id").onDelete("setNull"))
    .addColumn("updated_by", "uuid", (col) => col.references("users.id").onDelete("setNull"))
    .unique(["data_source_id", "table_name"])
    .execute();

  // Index for fast lookups
  await db.schema
    .createIndex("idx_schema_field_instructions_ds_table")
    .on("schema_field_instructions")
    .columns(["data_source_id", "table_name"])
    .execute();

  await db.schema
    .createIndex("idx_schema_table_instructions_ds")
    .on("schema_table_instructions")
    .columns(["data_source_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("schema_field_instructions").execute();
  await db.schema.dropTable("schema_table_instructions").execute();
}
