export async function up(db: any): Promise<void> {
  // Add soft delete columns to data_sources
  await db.schema.alterTable("data_sources", (table) => {
    table.boolean("is_deleted").defaultTo(false);
    table.timestamp("deleted_at");
    table.string("deleted_by", 36).references("id").inTable("users");
  });

  // Add soft delete columns to saved_queries
  await db.schema.alterTable("saved_queries", (table) => {
    table.boolean("is_deleted").defaultTo(false);
    table.timestamp("deleted_at");
    table.string("deleted_by", 36).references("id").inTable("users");
  });

  // Add soft delete columns to report_definitions
  await db.schema.alterTable("report_definitions", (table) => {
    table.boolean("is_deleted").defaultTo(false);
    table.timestamp("deleted_at");
    table.string("deleted_by", 36).references("id").inTable("users");
  });

  // Add soft delete columns to chart_definitions
  await db.schema.alterTable("chart_definitions", (table) => {
    table.boolean("is_deleted").defaultTo(false);
    table.timestamp("deleted_at");
    table.string("deleted_by", 36).references("id").inTable("users");
  });

  // Add soft delete columns to dashboard_layouts
  await db.schema.alterTable("dashboard_layouts", (table) => {
    table.boolean("is_deleted").defaultTo(false);
    table.timestamp("deleted_at");
    table.string("deleted_by", 36).references("id").inTable("users");
  });

  // Add soft delete columns to job_definitions
  await db.schema.alterTable("job_definitions", (table) => {
    table.boolean("is_deleted").defaultTo(false);
    table.timestamp("deleted_at");
    table.string("deleted_by", 36).references("id").inTable("users");
  });

  // Update indexes to exclude deleted records
  await db.raw(
    "CREATE INDEX IF NOT EXISTS idx_data_sources_active ON data_sources(is_deleted) WHERE is_deleted = 0"
  );
  await db.raw(
    "CREATE INDEX IF NOT EXISTS idx_saved_queries_active ON saved_queries(is_deleted) WHERE is_deleted = 0"
  );
  await db.raw(
    "CREATE INDEX IF NOT EXISTS idx_report_definitions_active ON report_definitions(is_deleted) WHERE is_deleted = 0"
  );
  await db.raw(
    "CREATE INDEX IF NOT EXISTS idx_chart_definitions_active ON chart_definitions(is_deleted) WHERE is_deleted = 0"
  );
  await db.raw(
    "CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_active ON dashboard_layouts(is_deleted) WHERE is_deleted = 0"
  );
  await db.raw(
    "CREATE INDEX IF NOT EXISTS idx_job_definitions_active ON job_definitions(is_deleted) WHERE is_deleted = 0"
  );
}

export async function down(db: any): Promise<void> {
  // Drop new indexes
  await db.raw("DROP INDEX IF EXISTS idx_job_definitions_active");
  await db.raw("DROP INDEX IF EXISTS idx_dashboard_layouts_active");
  await db.raw("DROP INDEX IF EXISTS idx_chart_definitions_active");
  await db.raw("DROP INDEX IF NOT EXISTS idx_report_definitions_active");
  await db.raw("DROP INDEX IF NOT EXISTS idx_saved_queries_active");
  await db.raw("DROP INDEX IF NOT EXISTS idx_data_sources_active");

  // Remove soft delete columns from job_definitions
  await db.schema.alterTable("job_definitions", (table) => {
    table.dropColumn("deleted_by");
    table.dropColumn("deleted_at");
    table.dropColumn("is_deleted");
  });

  // Remove soft delete columns from dashboard_layouts
  await db.schema.alterTable("dashboard_layouts", (table) => {
    table.dropColumn("deleted_by");
    table.dropColumn("deleted_at");
    table.dropColumn("is_deleted");
  });

  // Remove soft delete columns from chart_definitions
  await db.schema.alterTable("chart_definitions", (table) => {
    table.dropColumn("deleted_by");
    table.dropColumn("deleted_at");
    table.dropColumn("is_deleted");
  });

  // Remove soft delete columns from report_definitions
  await db.schema.alterTable("report_definitions", (table) => {
    table.dropColumn("deleted_by");
    table.dropColumn("deleted_at");
    table.dropColumn("is_deleted");
  });

  // Remove soft delete columns from saved_queries
  await db.schema.alterTable("saved_queries", (table) => {
    table.dropColumn("deleted_by");
    table.dropColumn("deleted_at");
    table.dropColumn("is_deleted");
  });

  // Remove soft delete columns from data_sources
  await db.schema.alterTable("data_sources", (table) => {
    table.dropColumn("deleted_by");
    table.dropColumn("deleted_at");
    table.dropColumn("is_deleted");
  });
}
