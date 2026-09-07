/**
 * Migration: dataset_cache and dataset_refresh_jobs tables
 * Supports the WASM-centric Parquet export / dataset caching pipeline.
 */

export async function up(db: any): Promise<void> {
  // Dataset registry
  await db.schema.createTable("dataset_cache", (table) => {
    table.text("id").primary();
    table.text("name").notNullable();
    table.text("description");
    table.text("data_source_id").notNullable().references("id").inTable("data_sources");
    table.text("query").notNullable();
    table.integer("row_count").notNullable().defaultTo(0);
    table.integer("file_size").notNullable().defaultTo(0);
    table.integer("compressed_size").notNullable().defaultTo(0);
    table.text("schema").notNullable().defaultTo("[]"); // JSON array of ColumnSchema
    table.text("file_path").notNullable();
    table.text("hash").notNullable();
    table.text("created_at").notNullable();
    table.text("updated_at").notNullable();
    table.text("last_accessed_at");
    table.text("refresh_schedule"); // cron expression
    table.text("last_refresh_at");
    table.text("status").notNullable().defaultTo("pending"); // pending | ready | error
    table.text("error_message");
    table.text("created_by").notNullable();
    table.text("permissions").notNullable().defaultTo("{}"); // JSON RBAC

    table.index("data_source_id", "idx_dataset_cache_ds");
    table.index("status", "idx_dataset_cache_status");
    table.index("updated_at", "idx_dataset_cache_updated");
  });

  // Dataset refresh jobs
  await db.schema.createTable("dataset_refresh_jobs", (table) => {
    table.text("id").primary();
    table.text("dataset_id").notNullable().references("id").inTable("dataset_cache");
    table.text("status").notNullable().defaultTo("pending"); // pending | processing | completed | failed
    table.text("started_at");
    table.text("completed_at");
    table.integer("row_count");
    table.integer("file_size");
    table.text("error_message");
    table.text("created_by").notNullable();
    table.text("created_at").notNullable();

    table.index("dataset_id", "idx_refresh_jobs_dataset");
    table.index("status", "idx_refresh_jobs_status");
  });
}

export async function down(db: any): Promise<void> {
  await db.schema.dropTableIfExists("dataset_refresh_jobs");
  await db.schema.dropTableIfExists("dataset_cache");
}
