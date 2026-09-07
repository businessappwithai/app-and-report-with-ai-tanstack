export async function up(db: any): Promise<void> {
  // Create filter_definitions table
  await db.schema.createTable("filter_definitions", (table) => {
    table.string("id").primary();
    table.string("name").notNullable();
    table.text("description");
    table.string("data_source_id").notNullable();
    table.text("filter_query").notNullable();
    table.string("display_field").notNullable();
    table.string("value_field").notNullable();
    table.string("created_by");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(db.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(db.fn.now());

    table.foreign("data_source_id").references("id").inTable("data_sources").onDelete("CASCADE");
  });

  // Create report_filters table (links filters to reports)
  await db.schema.createTable("report_filters", (table) => {
    table.string("id").primary();
    table.string("report_id").notNullable();
    table.string("filter_id").notNullable();
    table.string("target_column").notNullable();
    table.integer("filter_order").defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(db.fn.now());

    table.foreign("report_id").references("id").inTable("report_definitions").onDelete("CASCADE");
    table.foreign("filter_id").references("id").inTable("filter_definitions").onDelete("CASCADE");

    // Ensure a filter is only linked once per report
    table.unique(["report_id", "filter_id"]);
  });

  // Create chart_filters table (links filters to charts)
  await db.schema.createTable("chart_filters", (table) => {
    table.string("id").primary();
    table.string("chart_id").notNullable();
    table.string("filter_id").notNullable();
    table.string("target_column").notNullable();
    table.integer("filter_order").defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(db.fn.now());

    table.foreign("chart_id").references("id").inTable("chart_definitions").onDelete("CASCADE");
    table.foreign("filter_id").references("id").inTable("filter_definitions").onDelete("CASCADE");

    // Ensure a filter is only linked once per chart
    table.unique(["chart_id", "filter_id"]);
  });
}

export async function down(db: any): Promise<void> {
  await db.schema.dropTableIfExists("chart_filters");
  await db.schema.dropTableIfExists("report_filters");
  await db.schema.dropTableIfExists("filter_definitions");
}
