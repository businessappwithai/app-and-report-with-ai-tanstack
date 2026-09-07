/**
 * Rebuilds the PostgreSQL config database with the correct schema.
 * Drops all existing tables and recreates them fresh.
 * Run: bun scripts/rebuild-db.ts
 */

import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { Database } from "@/lib/db/kysely-db";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || "enterprise"}:${process.env.POSTGRES_PASSWORD || "enterprise_pass"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "enterprise_config"}`;

console.log(`Connecting to PostgreSQL: ${DATABASE_URL.replace(/:([^@]+)@/, ":***@")}`);

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });

async function rebuildDatabase() {
  console.log("Dropping all tables...");

  // Drop in reverse dependency order
  const tables = [
    "generated_report_artifacts",
    "nl_report_definitions",
    "monitoring_executions",
    "monitoring_rules",
    "adk_intents",
    "help_articles",
    "notifications",
    "nl_query_feedback",
    "nl_query_role_stats",
    "nl_query_context",
    "schema_table_instructions",
    "schema_field_instructions",
    "ds_entity_permissions",
    "ds_user_roles",
    "ds_roles",
    "ds_schema_cache",
    "chart_filters",
    "report_filters",
    "filter_definitions",
    "resource_permissions",
    "email_templates",
    "logs",
    "audit_log",
    "job_executions",
    "job_definitions",
    "dashboard_widgets",
    "dashboard_layouts",
    "chart_definitions",
    "report_definitions",
    "saved_queries",
    "data_sources",
    "metadata_entity_field",
    "metadata_entity_header",
    "user_roles",
    "roles",
    "users",
  ];

  for (const table of tables) {
    await sql`DROP TABLE IF EXISTS ${sql.table(table)} CASCADE`.execute(db);
    console.log(`  dropped: ${table}`);
  }

  console.log("\nRecreating schema via bootstrapSchema...");
  const { bootstrapSchema } = await import("@/lib/db/bootstrap");
  await bootstrapSchema(db);

  console.log("\nDatabase rebuilt successfully.");
  await db.destroy();
}

rebuildDatabase().catch((err) => {
  console.error("Rebuild failed:", err);
  process.exit(1);
});
