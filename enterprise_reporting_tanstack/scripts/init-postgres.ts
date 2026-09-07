/**
 * Initialize PostgreSQL database with Enterprise Reporting schema
 * Run: DATABASE_URL="postgresql://postgres@localhost:5432/hospital_management_system" bun scripts/init-postgres.ts
 */
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const ADMIN_USER = {
  id: "1aa00cc2af0225000c5c114df3eebb69",
  email: "admin@admin.com",
  password_hash: "$2a$10$9aE.ODJU.nWyAVpLuNSnS.j2Kz5X1g27dZM6ycAb0xzUyf0/fw3bO",
  display_name: "Admin",
};

// Initialize PostgreSQL connection
const pool = new Pool({ connectionString: DATABASE_URL });
const client = await pool.connect();

try {
  console.log("Initializing PostgreSQL database...");

  // Drop all tables
  const tablesToDrop = [
    "logs", "app_settings", "audit_log", "resource_permissions", "job_executions", "job_definitions",
    "dashboard_widgets", "dashboard_layouts", "chart_filters", "chart_definitions",
    "report_filters", "report_definitions", "filter_definitions", "saved_queries",
    "ds_entity_permissions", "data_source_entity_permissions", "ds_user_roles",
    "ds_roles", "data_sources", "user_roles", "roles", "notifications",
    "email_templates", "nl_query_history", "error_messages", "warning_configs", "error_occurrences",
    "metadata_entity_fields", "metadata_entity_registry", "data_source_filters",
    "filters", "jobs", "reports", "charts", "dashboards", "users", "_migrations",
    "schema_field_instructions", "schema_table_instructions", "nl_query_context", "nl_query_role_stats", "nl_query_feedback",
    "ds_schema_cache"
  ];

  for (const table of tablesToDrop) {
    try {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    } catch (e) {
      // Ignore errors if table doesn't exist
    }
  }

  console.log("Creating tables...");

  // Create each table
  const tables = [
    `CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE user_roles (
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id)
    )`,
    `CREATE TABLE data_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      client_type TEXT NOT NULL,
      connection_config TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      is_editable BOOLEAN DEFAULT false,
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP,
      deleted_by TEXT REFERENCES users(id),
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE saved_queries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
      sql_content TEXT NOT NULL,
      parameters_schema TEXT,
      is_validated BOOLEAN DEFAULT false,
      validation_result TEXT,
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP,
      deleted_by TEXT REFERENCES users(id),
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE report_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      saved_query_id TEXT REFERENCES saved_queries(id),
      column_config TEXT,
      filter_config TEXT,
      sort_config TEXT,
      pagination_config TEXT,
      export_formats TEXT,
      color_theme TEXT,
      is_public BOOLEAN DEFAULT false,
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP,
      deleted_by TEXT REFERENCES users(id),
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE chart_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      saved_query_id TEXT REFERENCES saved_queries(id),
      chart_type TEXT NOT NULL,
      chart_config TEXT,
      data_mapping TEXT,
      refresh_interval INTEGER,
      color_theme TEXT,
      is_public BOOLEAN DEFAULT false,
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP,
      deleted_by TEXT REFERENCES users(id),
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE dashboard_layouts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      layout_config TEXT,
      theme_config TEXT,
      refresh_config TEXT,
      is_public BOOLEAN DEFAULT false,
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP,
      deleted_by TEXT REFERENCES users(id),
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE dashboard_widgets (
      id TEXT PRIMARY KEY,
      dashboard_id TEXT REFERENCES dashboard_layouts(id) ON DELETE CASCADE,
      widget_type TEXT NOT NULL,
      report_id TEXT REFERENCES report_definitions(id),
      chart_id TEXT REFERENCES chart_definitions(id),
      position_config TEXT,
      widget_config TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE filter_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
      filter_query TEXT NOT NULL,
      display_field TEXT NOT NULL,
      value_field TEXT NOT NULL,
      field_type TEXT,
      operator TEXT,
      date_validation_config TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE report_filters (
      id TEXT PRIMARY KEY,
      report_id TEXT REFERENCES report_definitions(id) ON DELETE CASCADE,
      filter_id TEXT REFERENCES filter_definitions(id) ON DELETE CASCADE,
      target_column TEXT NOT NULL,
      filter_order INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE chart_filters (
      id TEXT PRIMARY KEY,
      chart_id TEXT REFERENCES chart_definitions(id) ON DELETE CASCADE,
      filter_id TEXT REFERENCES filter_definitions(id) ON DELETE CASCADE,
      target_column TEXT NOT NULL,
      filter_order INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE job_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      job_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      schedule_cron TEXT,
      parameters TEXT,
      notification_config TEXT,
      is_active BOOLEAN DEFAULT true,
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP,
      deleted_by TEXT REFERENCES users(id),
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE job_executions (
      id TEXT PRIMARY KEY,
      job_definition_id TEXT REFERENCES job_definitions(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      result_location TEXT,
      error_message TEXT,
      execution_metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE email_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE resource_permissions (
      id TEXT PRIMARY KEY,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
      permission_level TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE logs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      component TEXT NOT NULL,
      user_id TEXT REFERENCES users(id),
      session_id TEXT,
      metadata TEXT,
      error_stack TEXT,
      request_id TEXT,
      message_vector TEXT
    )`,
    `CREATE TABLE notifications (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE nl_query_history (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      natural_language_query TEXT NOT NULL,
      generated_sql TEXT,
      parsed_entities TEXT,
      access_check_result TEXT NOT NULL DEFAULT 'pending',
      access_check_details TEXT,
      execution_result TEXT,
      error_message TEXT,
      execution_time_ms INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE ds_schema_cache (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
      schema_metadata TEXT,
      sample_data TEXT,
      embedding_data TEXT,
      last_introspected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(data_source_id)
    )`,
    `CREATE TABLE error_messages (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      error_code TEXT NOT NULL UNIQUE,
      severity TEXT DEFAULT 'error',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      user_message TEXT,
      suggestions TEXT,
      documentation_url TEXT,
      is_active BOOLEAN DEFAULT true,
      category TEXT,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE warning_configs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      warning_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      trigger_type TEXT NOT NULL,
      trigger_config TEXT,
      severity TEXT DEFAULT 'warning',
      message_template TEXT NOT NULL,
      suggestions_template TEXT,
      is_active BOOLEAN DEFAULT true,
      display_duration INTEGER DEFAULT 5000,
      require_dismissal BOOLEAN DEFAULT false,
      enable_auto_resolve BOOLEAN DEFAULT true,
      auto_resolve_after INTEGER DEFAULT 30000,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE error_occurrences (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      error_message_id TEXT REFERENCES error_messages(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      session_id TEXT,
      context_data TEXT,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE ds_roles (
      id TEXT PRIMARY KEY,
      data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE ds_user_roles (
      data_source_id TEXT,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      ds_role_id TEXT REFERENCES ds_roles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (data_source_id, user_id, ds_role_id)
    )`,
    `CREATE TABLE ds_entity_permissions (
      id TEXT PRIMARY KEY,
      data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
      ds_role_id TEXT REFERENCES ds_roles(id) ON DELETE CASCADE,
      entity_name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_schema TEXT,
      permission_level TEXT NOT NULL,
      column_restrictions TEXT,
      row_filter TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE schema_field_instructions (
      id TEXT PRIMARY KEY,
      data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE NOT NULL,
      table_name TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_type TEXT NOT NULL,
      is_nullable BOOLEAN DEFAULT true,
      is_primary_key BOOLEAN DEFAULT false,
      is_foreign_key BOOLEAN DEFAULT false,
      foreign_key_table TEXT,
      foreign_key_field TEXT,
      description TEXT,
      llm_instructions TEXT,
      example_values TEXT,
      constraints TEXT,
      business_meaning TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(data_source_id, table_name, field_name)
    )`,
    `CREATE TABLE schema_table_instructions (
      id TEXT PRIMARY KEY,
      data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE NOT NULL,
      table_name TEXT NOT NULL,
      description TEXT,
      llm_instructions TEXT,
      example_queries TEXT,
      business_domain TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(data_source_id, table_name)
    )`,
    `CREATE TABLE nl_query_context (
      id TEXT PRIMARY KEY,
      data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      role_name TEXT,
      nl_question TEXT,
      generated_sql TEXT,
      nl_question_embedding TEXT,
      schema_context TEXT,
      rbac_context TEXT,
      field_instructions TEXT,
      execution_time_ms INTEGER,
      row_count INTEGER,
      was_successful BOOLEAN,
      error_message TEXT,
      translation_confidence NUMERIC,
      llm_confidence NUMERIC,
      query_type TEXT,
      table_count INTEGER,
      join_count INTEGER,
      has_aggregation BOOLEAN,
      has_window_function BOOLEAN,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE nl_query_role_stats (
      id TEXT PRIMARY KEY,
      role_name TEXT,
      data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
      total_queries INTEGER,
      successful_queries INTEGER,
      failed_queries INTEGER,
      success_rate NUMERIC,
      avg_execution_time_ms NUMERIC,
      avg_rows_returned NUMERIC,
      avg_confidence NUMERIC,
      common_query_types TEXT,
      common_tables TEXT,
      common_joins TEXT,
      updated_at TIMESTAMP
    )`,
    `CREATE TABLE nl_query_feedback (
      id TEXT PRIMARY KEY,
      nl_query_context_id TEXT REFERENCES nl_query_context(id),
      feedback_type TEXT,
      user_feedback TEXT,
      corrected_sql TEXT,
      feedback_by TEXT,
      created_at TIMESTAMP
    )`,
  ];

  for (const table of tables) {
    await client.query(table);
  }

  // Enable pgvector and Apache AGE (knowledge graph) extensions
  await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS age`);
    await client.query(`LOAD 'age'`);
    await client.query(`SET search_path = ag_catalog, "$user", public`);
    await client.query(`SELECT create_graph('knowledge_graph')`);
    console.log("Apache AGE knowledge_graph created.");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("already exists")) {
      console.warn("AGE extension not available (install apache/age or use postgres-graph service):", msg);
    }
  }
  await client.query(`
    CREATE TABLE IF NOT EXISTS nl_query_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      data_source_id TEXT NOT NULL,
      natural_language_query TEXT NOT NULL,
      generated_sql TEXT NOT NULL,
      explanation TEXT,
      query_hash TEXT NOT NULL,
      embedding vector(384) NOT NULL,
      row_count INTEGER,
      execution_time_ms INTEGER,
      success BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (data_source_id, query_hash)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS nl_schema_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      data_source_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      schema_text TEXT NOT NULL,
      sample_data JSONB,
      embedding vector(384) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (data_source_id, table_name)
    )
  `);

  console.log("Creating indexes...");

  // Create indexes
  const indexes = [
    `CREATE INDEX idx_logs_timestamp ON logs(timestamp)`,
    `CREATE INDEX idx_logs_level ON logs(level)`,
    `CREATE INDEX idx_logs_user_id ON logs(user_id)`,
    `CREATE INDEX idx_logs_component ON logs(component)`,
    `CREATE INDEX idx_schema_field_instructions_ds_table ON schema_field_instructions(data_source_id, table_name)`,
    `CREATE INDEX idx_schema_table_instructions_ds ON schema_table_instructions(data_source_id)`,
  ];

  for (const index of indexes) {
    try {
      await client.query(index);
    } catch (e) {
      // Ignore if index already exists
    }
  }

  console.log("Inserting admin user...");

  // Insert admin user
  await client.query(
    `INSERT INTO users (id, email, password_hash, display_name, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [ADMIN_USER.id, ADMIN_USER.email, ADMIN_USER.password_hash, ADMIN_USER.display_name, true]
  );

  // Insert default roles
  const roles = [
    {
      id: "role_admin",
      name: "Admin",
      description: "Administrator with full access",
      permissions: JSON.stringify(["read", "write", "delete", "admin"])
    },
    {
      id: "role_user",
      name: "User",
      description: "Standard user",
      permissions: JSON.stringify(["read", "write"])
    },
    {
      id: "role_viewer",
      name: "Viewer",
      description: "Read-only access",
      permissions: JSON.stringify(["read"])
    }
  ];

  for (const role of roles) {
    await client.query(
      `INSERT INTO roles (id, name, description, permissions, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [role.id, role.name, role.description, role.permissions]
    );
  }

  // Assign admin role to admin user
  await client.query(
    `INSERT INTO user_roles (user_id, role_id, assigned_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)`,
    [ADMIN_USER.id, "role_admin"]
  );

  console.log("Database initialization complete.");
  console.log(`✓ Admin user: ${ADMIN_USER.email}`);
  console.log(`✓ Default roles created: Admin, User, Viewer`);

} finally {
  await client.end();
  await pool.end();
  process.exit(0);
}
