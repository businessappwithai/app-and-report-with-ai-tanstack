/**
 * Auto-bootstrap the database schema on first startup.
 * Uses CREATE TABLE IF NOT EXISTS so it is safe to run on every boot.
 * The admin user is only inserted when no users exist.
 *
 * PostgreSQL only.
 */

import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { Database } from "./kysely-db";
import { seedHelpArticles } from "./help-seed";

// bcrypt hash of "admin" (10 rounds) – pre-computed to avoid runtime bcrypt dependency
const ADMIN_PASSWORD_HASH =
  "$2a$10$9aE.ODJU.nWyAVpLuNSnS.j2Kz5X1g27dZM6ycAb0xzUyf0/fw3bO";
const ADMIN_ID = "1aa00cc2af0225000c5c114df3eebb69";

// bcrypt hash of "nlquery" (10 rounds)
const NLQUERY_PASSWORD_HASH =
  "$2a$10$1UDYFHzn1PDgcNfKbTpX2O7aykAUkAL.tgWGm6aGEuXG3pnMCTH3S";
const NLQUERY_USER_ID = "nlquery0user00000000000000000000";
const NLQUERY_ROLE_ID = "nlquery0role00000000000000000000";

export async function bootstrapSchema(db: Kysely<Database>): Promise<void> {
  console.log("[bootstrap] Starting database schema bootstrap...");

  const tables = [
    sql`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      avatar_url VARCHAR(500),
      is_active BOOLEAN DEFAULT TRUE,
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL,
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS user_roles (
      user_id VARCHAR(255) NOT NULL,
      role_id VARCHAR(255) NOT NULL,
      assigned_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id)
    )`,

    sql`CREATE TABLE IF NOT EXISTS data_sources (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      client_type VARCHAR(50) NOT NULL,
      connection_config TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      is_editable BOOLEAN DEFAULT FALSE,
      is_inspected BOOLEAN DEFAULT FALSE,
      last_inspected_at VARCHAR(255),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at VARCHAR(255),
      deleted_by VARCHAR(255),
      created_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS saved_queries (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      data_source_id VARCHAR(255) NOT NULL,
      sql_content TEXT NOT NULL,
      parameters_schema TEXT,
      is_validated BOOLEAN DEFAULT FALSE,
      validation_result TEXT,
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at VARCHAR(255),
      deleted_by VARCHAR(255),
      created_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS report_definitions (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      saved_query_id VARCHAR(255),
      column_config TEXT NOT NULL,
      filter_config TEXT,
      sort_config TEXT,
      pagination_config TEXT,
      export_formats TEXT DEFAULT '["csv","xlsx","pdf"]',
      filename_template TEXT,
      color_theme TEXT,
      is_public BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at VARCHAR(255),
      deleted_by VARCHAR(255),
      created_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS chart_definitions (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      saved_query_id VARCHAR(255),
      chart_type VARCHAR(50) NOT NULL,
      chart_config TEXT NOT NULL,
      data_mapping TEXT NOT NULL,
      refresh_interval INT,
      color_theme TEXT,
      is_public BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at VARCHAR(255),
      deleted_by VARCHAR(255),
      created_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS dashboard_layouts (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      layout_config TEXT NOT NULL,
      theme_config TEXT,
      refresh_config TEXT,
      is_public BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at VARCHAR(255),
      deleted_by VARCHAR(255),
      created_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS dashboard_widgets (
      id VARCHAR(255) PRIMARY KEY,
      dashboard_id VARCHAR(255) NOT NULL,
      widget_type VARCHAR(50) NOT NULL,
      report_id VARCHAR(255),
      chart_id VARCHAR(255),
      position_config TEXT NOT NULL,
      widget_config TEXT,
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS job_definitions (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      job_type VARCHAR(50) NOT NULL,
      target_id VARCHAR(255) NOT NULL,
      schedule_cron VARCHAR(255),
      parameters TEXT,
      notification_config TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at VARCHAR(255),
      deleted_by VARCHAR(255),
      created_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS job_executions (
      id VARCHAR(255) PRIMARY KEY,
      job_definition_id VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      started_at VARCHAR(255),
      completed_at VARCHAR(255),
      result_location VARCHAR(500),
      error_message TEXT,
      execution_metadata TEXT,
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS audit_log (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255),
      action VARCHAR(255) NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255),
      details TEXT,
      ip_address VARCHAR(45),
      user_agent VARCHAR(500),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS logs (
      id VARCHAR(255) PRIMARY KEY,
      timestamp VARCHAR(255) NOT NULL,
      level VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      component VARCHAR(255) NOT NULL,
      user_id VARCHAR(255),
      session_id VARCHAR(255),
      metadata TEXT,
      error_stack TEXT,
      request_id VARCHAR(255),
      message_vector TEXT
    )`,

    sql`CREATE TABLE IF NOT EXISTS email_templates (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      body TEXT NOT NULL,
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS resource_permissions (
      id VARCHAR(255) PRIMARY KEY,
      resource_type VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255) NOT NULL,
      role_id VARCHAR(255) NOT NULL,
      permission_level VARCHAR(50) NOT NULL,
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS filter_definitions (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      data_source_id VARCHAR(255) NOT NULL,
      filter_query TEXT NOT NULL,
      display_field VARCHAR(255) NOT NULL,
      value_field VARCHAR(255) NOT NULL,
      field_type VARCHAR(50),
      operator VARCHAR(50),
      date_validation_config TEXT,
      created_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS report_filters (
      id VARCHAR(255) PRIMARY KEY,
      report_id VARCHAR(255) NOT NULL,
      filter_id VARCHAR(255) NOT NULL,
      target_column VARCHAR(255) NOT NULL,
      filter_order INT NOT NULL,
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS chart_filters (
      id VARCHAR(255) PRIMARY KEY,
      chart_id VARCHAR(255) NOT NULL,
      filter_id VARCHAR(255) NOT NULL,
      target_column VARCHAR(255) NOT NULL,
      filter_order INT NOT NULL,
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS ds_roles (
      id VARCHAR(255) PRIMARY KEY,
      data_source_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS ds_user_roles (
      data_source_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      ds_role_id VARCHAR(255) NOT NULL,
      assigned_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (data_source_id, user_id, ds_role_id)
    )`,

    sql`CREATE TABLE IF NOT EXISTS ds_entity_permissions (
      id VARCHAR(255) PRIMARY KEY,
      data_source_id VARCHAR(255) NOT NULL,
      ds_role_id VARCHAR(255) NOT NULL,
      entity_name VARCHAR(255) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_schema VARCHAR(255),
      permission_level VARCHAR(50) NOT NULL,
      column_restrictions TEXT,
      row_filter VARCHAR(500),
      created_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS schema_field_instructions (
      id VARCHAR(255) PRIMARY KEY,
      data_source_id VARCHAR(255) NOT NULL,
      table_name VARCHAR(255) NOT NULL,
      field_name VARCHAR(255) NOT NULL,
      field_type VARCHAR(100) NOT NULL,
      is_nullable BOOLEAN DEFAULT FALSE,
      is_primary_key BOOLEAN DEFAULT FALSE,
      is_foreign_key BOOLEAN DEFAULT FALSE,
      foreign_key_table VARCHAR(255),
      foreign_key_field VARCHAR(255),
      description TEXT,
      llm_instructions TEXT,
      example_values TEXT,
      constraints TEXT,
      business_meaning TEXT,
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(255),
      updated_by VARCHAR(255)
    )`,

    sql`CREATE TABLE IF NOT EXISTS schema_table_instructions (
      id VARCHAR(255) PRIMARY KEY,
      data_source_id VARCHAR(255) NOT NULL,
      table_name VARCHAR(255) NOT NULL,
      description TEXT,
      llm_instructions TEXT,
      example_queries TEXT,
      business_domain VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(255),
      updated_by VARCHAR(255)
    )`,

    sql`CREATE TABLE IF NOT EXISTS nl_query_context (
      id VARCHAR(255) PRIMARY KEY,
      data_source_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      role_name VARCHAR(255) NOT NULL,
      nl_question TEXT NOT NULL,
      generated_sql TEXT NOT NULL,
      nl_question_embedding TEXT,
      schema_context TEXT NOT NULL,
      rbac_context TEXT NOT NULL,
      field_instructions TEXT,
      execution_time_ms INT,
      row_count INT,
      was_successful BOOLEAN NOT NULL,
      error_message TEXT,
      translation_confidence DECIMAL(5,4),
      llm_confidence DECIMAL(5,4),
      query_type VARCHAR(100),
      table_count INT,
      join_count INT,
      has_aggregation BOOLEAN,
      has_window_function BOOLEAN,
      created_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS nl_query_role_stats (
      id VARCHAR(255) PRIMARY KEY,
      role_name VARCHAR(255) NOT NULL,
      data_source_id VARCHAR(255) NOT NULL,
      total_queries INT,
      successful_queries INT,
      failed_queries INT,
      success_rate DECIMAL(5,4),
      avg_execution_time_ms DECIMAL(10,2),
      avg_rows_returned DECIMAL(10,2),
      avg_confidence DECIMAL(5,4),
      common_query_types TEXT,
      common_tables TEXT,
      common_joins TEXT,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS nl_query_feedback (
      id VARCHAR(255) PRIMARY KEY,
      nl_query_context_id VARCHAR(255) NOT NULL,
      feedback_type VARCHAR(100),
      user_feedback TEXT,
      corrected_sql TEXT,
      feedback_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS metadata_entity_header (
      id VARCHAR(255) PRIMARY KEY,
      data_source_id VARCHAR(255) NOT NULL,
      entity_name VARCHAR(255) NOT NULL,
      entity_schema VARCHAR(255),
      entity_type VARCHAR(50) NOT NULL DEFAULT 'table',
      schema_metadata TEXT NOT NULL,
      last_introspected_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      description TEXT,
      is_active BOOLEAN DEFAULT FALSE,
      is_hidden BOOLEAN DEFAULT TRUE,
      created_by VARCHAR(255),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (data_source_id, entity_name, entity_schema)
    )`,

    sql`CREATE TABLE IF NOT EXISTS metadata_entity_field (
      id VARCHAR(255) PRIMARY KEY,
      entity_header_id VARCHAR(255) NOT NULL,
      field_name VARCHAR(255) NOT NULL,
      data_type VARCHAR(255) NOT NULL,
      is_nullable BOOLEAN,
      is_primary_key BOOLEAN DEFAULT FALSE,
      is_foreign_key BOOLEAN DEFAULT FALSE,
      foreign_key_table VARCHAR(255),
      foreign_key_column VARCHAR(255),
      default_value TEXT,
      description TEXT,
      is_display_field BOOLEAN DEFAULT FALSE,
      is_searchable BOOLEAN DEFAULT TRUE,
      display_order INT,
      section_name VARCHAR(255),
      relationship_ui_type VARCHAR(50),
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (entity_header_id, field_name)
    )`,

    sql`CREATE TABLE IF NOT EXISTS ds_schema_cache (
      id VARCHAR(255) PRIMARY KEY,
      data_source_id VARCHAR(255) NOT NULL UNIQUE,
      schema_metadata TEXT NOT NULL,
      sample_data TEXT,
      embedding_data TEXT,
      last_introspected_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      created_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP,
      updated_at VARCHAR(255) DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS adk_intents (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      session_id VARCHAR(255),
      raw_nl_request TEXT NOT NULL,
      request_source VARCHAR(20) DEFAULT 'text',
      intent_type VARCHAR(50) NOT NULL,
      confidence DECIMAL(4,3),
      adk_intent_json TEXT NOT NULL,
      pipeline_status VARCHAR(20) DEFAULT 'pending',
      report_definition_id VARCHAR(255),
      monitoring_rule_id VARCHAR(255),
      error_message TEXT,
      classification_ms INT,
      total_pipeline_ms INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS monitoring_rules (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      report_definition_id VARCHAR(255) NOT NULL,
      job_definition_id VARCHAR(255),
      data_source_id VARCHAR(255) NOT NULL,
      created_by VARCHAR(255) NOT NULL,
      metric_column VARCHAR(255) NOT NULL,
      threshold_operator VARCHAR(20) NOT NULL,
      threshold_value DECIMAL(20,4) NOT NULL,
      threshold_upper_bound DECIMAL(20,4),
      escalation_threshold_pct DECIMAL(5,2) DEFAULT 20.0,
      cron_expression VARCHAR(100) NOT NULL,
      timezone VARCHAR(64) DEFAULT 'UTC',
      trigger_schedule_id VARCHAR(255),
      alert_channels TEXT NOT NULL,
      alert_recipients TEXT NOT NULL,
      webhook_url VARCHAR(500),
      notify_on_pass BOOLEAN DEFAULT FALSE,
      notify_on_no_data BOOLEAN DEFAULT TRUE,
      rbac_snapshot TEXT NOT NULL,
      rbac_snapshot_version INT DEFAULT 1,
      is_active BOOLEAN DEFAULT TRUE,
      is_paused BOOLEAN DEFAULT FALSE,
      pause_reason TEXT,
      original_nl_request TEXT,
      adk_intent_id VARCHAR(255),
      last_executed_at TIMESTAMP,
      last_execution_status VARCHAR(20),
      last_metric_value DECIMAL(20,4),
      consecutive_breaches INT DEFAULT 0,
      total_executions INT DEFAULT 0,
      total_alerts_sent INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS monitoring_executions (
      id VARCHAR(255) PRIMARY KEY,
      monitoring_rule_id VARCHAR(255) NOT NULL,
      job_execution_id VARCHAR(255),
      executed_at TIMESTAMP NOT NULL,
      execution_ms INT,
      rows_returned INT,
      sql_executed TEXT,
      metric_value DECIMAL(20,4),
      previous_metric_value DECIMAL(20,4),
      delta_pct DECIMAL(8,4),
      evaluation_status VARCHAR(20) NOT NULL,
      evaluation_detail TEXT,
      alert_dispatched BOOLEAN DEFAULT FALSE,
      alert_channels_used TEXT,
      alert_recipients_sent TEXT,
      alert_sent_at TIMESTAMP,
      error_message TEXT,
      error_phase VARCHAR(30),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS nl_report_definitions (
      id VARCHAR(255) NOT NULL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      created_by VARCHAR(255) NOT NULL,
      data_source_id VARCHAR(255) NOT NULL,
      nl_query TEXT NOT NULL,
      generated_sql TEXT NOT NULL,
      metric_columns TEXT NOT NULL,
      dimension_columns TEXT NOT NULL,
      filter_config TEXT,
      date_range_from DATE,
      date_range_to DATE,
      chart_type VARCHAR(20) NOT NULL DEFAULT 'bar',
      output_formats TEXT NOT NULL,
      recipient_config TEXT NOT NULL,
      schedule_cron VARCHAR(100),
      schedule_timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
      schedule_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      rbac_snapshot TEXT NOT NULL,
      rbac_snapshot_version INT DEFAULT 1,
      last_run_at TIMESTAMP,
      last_run_status VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS generated_report_artifacts (
      id VARCHAR(255) NOT NULL PRIMARY KEY,
      report_definition_id VARCHAR(255) NOT NULL,
      execution_id VARCHAR(255) NOT NULL,
      created_by VARCHAR(255) NOT NULL,
      format VARCHAR(10) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size_bytes BIGINT,
      row_count INT,
      chart_type VARCHAR(20),
      execution_ms INT,
      status VARCHAR(20) NOT NULL DEFAULT 'complete',
      error_message TEXT,
      triggered_by VARCHAR(20) NOT NULL DEFAULT 'manual',
      sql_executed TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    sql`CREATE TABLE IF NOT EXISTS help_articles (
      id VARCHAR(255) PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      icon VARCHAR(100) NOT NULL DEFAULT 'HelpCircle',
      color VARCHAR(50) NOT NULL DEFAULT 'blue',
      title VARCHAR(255) NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      is_published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  // Indexes — separate statements because PostgreSQL doesn't support inline index creation
  const indexes = [
    sql`CREATE INDEX IF NOT EXISTS idx_adk_user_id ON adk_intents (user_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_adk_created_at ON adk_intents (created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_mr_created_by ON monitoring_rules (created_by)`,
    sql`CREATE INDEX IF NOT EXISTS idx_mr_data_source_id ON monitoring_rules (data_source_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_mr_is_active ON monitoring_rules (is_active)`,
    sql`CREATE INDEX IF NOT EXISTS idx_me_rule_id ON monitoring_executions (monitoring_rule_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_me_executed_at ON monitoring_executions (executed_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_me_status ON monitoring_executions (evaluation_status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications (user_id, is_read, created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_nlrd_created_by ON nl_report_definitions (created_by)`,
    sql`CREATE INDEX IF NOT EXISTS idx_nlrd_data_source ON nl_report_definitions (data_source_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_nlrd_created_at ON nl_report_definitions (created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_gra_definition ON generated_report_artifacts (report_definition_id, created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_gra_user ON generated_report_artifacts (created_by, created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_gra_execution ON generated_report_artifacts (execution_id)`,
  ];

  console.log("[bootstrap] Creating tables...");
  for (const table of tables) {
    try {
      await table.execute(db);
    } catch (err) {
      console.warn("[bootstrap] table create warning:", (err as Error).message?.slice(0, 120));
    }
  }

  console.log("[bootstrap] Creating indexes...");
  for (const idx of indexes) {
    try {
      await idx.execute(db);
    } catch (err) {
      console.warn("[bootstrap] index create warning:", (err as Error).message?.slice(0, 120));
    }
  }

  // Seed admin user and role
  console.log("[bootstrap] Seeding admin user...");
  const adminRoleId = "admin-role-id";
  const ADMIN_PERMISSIONS = JSON.stringify([
    "*:*",
    "admin:*",
    "user:*",
    "role:*",
    "data_source:*",
    "report:*",
    "dashboard:*",
    "chart:*",
    "query:*",
    "job:*",
    "audit:*",
    "nl_query:*",
    "filter:*",
    "monitoring_rule:*",
    "log:*",
    "setting:*",
    "queue:*",
    "metadata_entity:*",
  ]);

  const now = new Date().toISOString();

  // Upsert admin role (PostgreSQL ON CONFLICT syntax)
  await db
    .insertInto("roles")
    .values({
      id: adminRoleId,
      name: "Administrator",
      description: "Full system administrator",
      permissions: ADMIN_PERMISSIONS,
      created_at: now,
    })
    .onConflict((oc) => oc.column("id").doUpdateSet({ permissions: ADMIN_PERMISSIONS }))
    .execute()
    .catch((err) => {
      console.warn("[bootstrap] admin role upsert warning:", (err as Error).message?.slice(0, 120));
    });

  const userCount = await db
    .selectFrom("users")
    .select(db.fn.count<number>("id").as("count"))
    .executeTakeFirst();

  if (!userCount || Number(userCount.count) === 0) {
    await db
      .insertInto("users")
      .values({
        id: ADMIN_ID,
        email: "admin@admin.com",
        password_hash: ADMIN_PASSWORD_HASH,
        display_name: "System Administrator",
        avatar_url: null,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .execute()
      .catch((err) => {
        console.warn("[bootstrap] admin user insert warning:", (err as Error).message?.slice(0, 120));
      });

    await db
      .insertInto("user_roles")
      .values({ user_id: ADMIN_ID, role_id: adminRoleId, assigned_at: now })
      .execute()
      .catch((err) => {
        console.warn("[bootstrap] admin user_roles insert warning:", (err as Error).message?.slice(0, 120));
      });

    console.log("[bootstrap] Admin created: admin@admin.com / admin");
  }

  const nlQueryPermissions = JSON.stringify(["nl_query:*"]);
  const now2 = new Date().toISOString();

  await db
    .insertInto("roles")
    .values({
      id: NLQUERY_ROLE_ID,
      name: "NLQueryUser",
      description: "Access limited to natural language query only",
      permissions: nlQueryPermissions,
      created_at: now2,
    })
    .onConflict((oc) => oc.column("id").doUpdateSet({ permissions: nlQueryPermissions }))
    .execute()
    .catch((err) => {
      console.warn("[bootstrap] nlquery role insert warning:", (err as Error).message?.slice(0, 120));
    });

  await db
    .insertInto("users")
    .values({
      id: NLQUERY_USER_ID,
      email: "nlquery@nlquery.com",
      password_hash: NLQUERY_PASSWORD_HASH,
      display_name: "nlquery",
      avatar_url: null,
      is_active: true,
      created_at: now2,
      updated_at: now2,
    })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute()
    .catch((err) => {
      console.warn("[bootstrap] nlquery user insert warning:", (err as Error).message?.slice(0, 120));
    });

  await db
    .insertInto("user_roles")
    .values({ user_id: NLQUERY_USER_ID, role_id: NLQUERY_ROLE_ID, assigned_at: now2 })
    .onConflict((oc) => oc.columns(["user_id", "role_id"]).doNothing())
    .execute()
    .catch((err) => {
      console.warn("[bootstrap] nlquery user_roles insert warning:", (err as Error).message?.slice(0, 120));
    });

  console.log("[bootstrap] NL Query user ensured: nlquery@nlquery.com / nlquery");

  console.log("[bootstrap] Seeding help articles...");
  await seedHelpArticles(db);

  console.log("[bootstrap] Database bootstrap complete!");
}
