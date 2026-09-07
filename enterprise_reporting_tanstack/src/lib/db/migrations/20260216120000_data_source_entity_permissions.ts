export async function up(db: any): Promise<void> {
  // Data source roles - roles specific to data source entity access
  // These are separate from the application-level roles in the 'roles' table
  await db.schema.createTable("ds_roles", (table) => {
    table.string("id", 36).primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
    table
      .string("data_source_id", 36)
      .notNullable()
      .references("id")
      .inTable("data_sources")
      .onDelete("CASCADE");
    table.string("name").notNullable();
    table.string("description");
    table.boolean("is_active").defaultTo(true);
    table.string("created_by", 36).references("id").inTable("users");
    table.timestamp("created_at").defaultTo(db.fn.now());
    table.timestamp("updated_at").defaultTo(db.fn.now());
    table.unique(["data_source_id", "name"]);
  });

  // Data source user-role assignments
  await db.schema.createTable("ds_user_roles", (table) => {
    table
      .string("data_source_id", 36)
      .notNullable()
      .references("id")
      .inTable("data_sources")
      .onDelete("CASCADE");
    table.string("user_id", 36).notNullable().references("id").inTable("users").onDelete("CASCADE");
    table
      .string("ds_role_id", 36)
      .notNullable()
      .references("id")
      .inTable("ds_roles")
      .onDelete("CASCADE");
    table.timestamp("assigned_at").defaultTo(db.fn.now());
    table.primary(["data_source_id", "user_id", "ds_role_id"]);
  });

  // Data source entity permissions - permissions on specific tables/views within a data source
  await db.schema.createTable("ds_entity_permissions", (table) => {
    table.string("id", 36).primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
    table
      .string("data_source_id", 36)
      .notNullable()
      .references("id")
      .inTable("data_sources")
      .onDelete("CASCADE");
    table
      .string("ds_role_id", 36)
      .notNullable()
      .references("id")
      .inTable("ds_roles")
      .onDelete("CASCADE");
    table.string("entity_name").notNullable(); // table or view name
    table.string("entity_type").notNullable().defaultTo("table"); // 'table' or 'view'
    table.string("entity_schema"); // schema name (for pg, mssql)
    table.string("permission_level").notNullable().defaultTo("select"); // 'select', 'insert', 'update', 'delete', 'all'
    table.text("column_restrictions"); // JSON array of allowed columns, null = all columns
    table.text("row_filter"); // SQL WHERE clause fragment for row-level security
    table.string("created_by", 36).references("id").inTable("users");
    table.timestamp("created_at").defaultTo(db.fn.now());
    table.timestamp("updated_at").defaultTo(db.fn.now());
    table.unique(["data_source_id", "ds_role_id", "entity_name", "entity_schema"]);
  });

  // Schema cache - stores introspected schema metadata for RAG
  await db.schema.createTable("ds_schema_cache", (table) => {
    table.string("id", 36).primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
    table
      .string("data_source_id", 36)
      .notNullable()
      .unique()
      .references("id")
      .inTable("data_sources")
      .onDelete("CASCADE");
    table.text("schema_metadata").notNullable(); // JSON: full schema info
    table.text("sample_data"); // JSON: sample rows per table
    table.text("embedding_data"); // JSON: chunked text for RAG embedding
    table.timestamp("last_introspected_at").notNullable().defaultTo(db.fn.now());
    table.timestamp("created_at").defaultTo(db.fn.now());
    table.timestamp("updated_at").defaultTo(db.fn.now());
  });

  // NL query history - audit trail for natural language queries
  await db.schema.createTable("nl_query_history", (table) => {
    table.string("id", 36).primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
    table
      .string("data_source_id", 36)
      .notNullable()
      .references("id")
      .inTable("data_sources")
      .onDelete("CASCADE");
    table.string("user_id", 36).notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.text("natural_language_query").notNullable();
    table.text("generated_sql");
    table.text("parsed_entities"); // JSON: tables/views extracted from SQL
    table.string("access_check_result").notNullable().defaultTo("pending"); // 'granted', 'denied', 'pending', 'error'
    table.text("access_check_details"); // JSON: detailed access check results
    table.text("execution_result"); // JSON: query results summary (row count, etc.)
    table.text("error_message");
    table.integer("execution_time_ms");
    table.timestamp("created_at").defaultTo(db.fn.now());
  });

  // Indexes
  await db.schema.raw("CREATE INDEX idx_ds_roles_data_source ON ds_roles(data_source_id)");
  await db.schema.raw("CREATE INDEX idx_ds_user_roles_user ON ds_user_roles(user_id)");
  await db.schema.raw("CREATE INDEX idx_ds_user_roles_ds ON ds_user_roles(data_source_id)");
  await db.schema.raw("CREATE INDEX idx_ds_entity_perms_role ON ds_entity_permissions(ds_role_id)");
  await db.schema.raw(
    "CREATE INDEX idx_ds_entity_perms_ds ON ds_entity_permissions(data_source_id)"
  );
  await db.schema.raw(
    "CREATE INDEX idx_ds_entity_perms_entity ON ds_entity_permissions(entity_name)"
  );
  await db.schema.raw(
    "CREATE INDEX idx_nl_query_history_user ON nl_query_history(user_id, created_at)"
  );
  await db.schema.raw("CREATE INDEX idx_nl_query_history_ds ON nl_query_history(data_source_id)");
}

export async function down(db: any): Promise<void> {
  await db.schema.dropTableIfExists("nl_query_history");
  await db.schema.dropTableIfExists("ds_schema_cache");
  await db.schema.dropTableIfExists("ds_entity_permissions");
  await db.schema.dropTableIfExists("ds_user_roles");
  await db.schema.dropTableIfExists("ds_roles");
}
