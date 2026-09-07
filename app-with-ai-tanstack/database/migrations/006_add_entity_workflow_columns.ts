/**
 * Migration: Add Workflow Columns to Entity Tables
 *
 * Adds workflow tracking columns to all business entity tables (bus_*).
 * This migration adds:
 * - workflow_status: Current status of the workflow (none, draft, success, error)
 * - workflow_run_id: Reference to the workflow run
 * - created_by: User who created the record
 * - updated_by: User who last updated the record
 */

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Get all business tables from sys_table
  const businessTables = await knex("sys_table")
    .where("table_name", "like", "bus_%")
    .orWhere("is_document", true)
    .pluck("table_name");

  // Add workflow columns to each business table
  for (const tableName of businessTables) {
    // Check if table exists
    const exists = await knex.schema.hasTable(tableName);
    if (!exists) {
      console.log(`Table ${tableName} does not exist, skipping...`);
      continue;
    }

    await knex.schema.table(tableName, (table) => {
      // Workflow status column
      table
        .string("workflow_status", 20)
        .nullable()
        .defaultTo("none")
        .comment("Current workflow status: none, draft, success, error");

      // Reference to workflow run
      table
        .uuid("workflow_run_id")
        .nullable()
        .references("id")
        .inTable("sys_workflow_runs")
        .onDelete("SET NULL")
        .comment("Reference to the workflow run");

      // Audit columns
      table
        .uuid("created_by")
        .nullable()
        .references("id")
        .inTable("better_auth_users")
        .onDelete("SET NULL")
        .comment("User who created this record");

      table
        .uuid("updated_by")
        .nullable()
        .references("id")
        .inTable("better_auth_users")
        .onDelete("SET NULL")
        .comment("User who last updated this record");
    });

    // Create index for workflow_status
    await knex.raw(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_workflow_status ON ${tableName}(workflow_status) WHERE workflow_status != 'none'`
    );

    // Create index for created_by
    await knex.raw(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_created_by ON ${tableName}(created_by)`
    );

    console.log(`Added workflow columns to ${tableName}`);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Get all business tables from sys_table
  const businessTables = await knex("sys_table")
    .where("table_name", "like", "bus_%")
    .orWhere("is_document", true)
    .pluck("table_name");

  // Remove workflow columns from each business table
  for (const tableName of businessTables) {
    // Check if table exists
    const exists = await knex.schema.hasTable(tableName);
    if (!exists) {
      continue;
    }

    await knex.schema.table(tableName, (table) => {
      table.dropColumn("workflow_status");
      table.dropColumn("workflow_run_id");
      table.dropColumn("created_by");
      table.dropColumn("updated_by");
    });

    // Drop indexes
    await knex.raw(`DROP INDEX IF EXISTS idx_${tableName}_workflow_status`);
    await knex.raw(`DROP INDEX IF EXISTS idx_${tableName}_created_by`);

    console.log(`Removed workflow columns from ${tableName}`);
  }
}
