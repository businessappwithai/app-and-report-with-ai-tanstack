/**
 * Migration: Add Workflow and Rules Tables
 *
 * Creates tables for:
 * - sys_rule_definitions: JDM rule definitions per entity
 * - sys_workflow_runs: Workflow execution tracking
 */

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create sys_rule_definitions table
  await knex.schema.createTable("sys_rule_definitions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("entity_name", 100).notNullable();
    table.string("rule_name", 100).notNullable();
    table.string("operation", 20).notNullable();
    table.jsonb("jdm_content").notNullable(); // JDM (JSON Decision Model) content
    table.integer("version").notNullable().defaultTo(1);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.uuid("created_by").references("id").inTable("better_auth_users").onDelete("SET NULL");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    // Constraint: unique rule per entity and operation
    table.unique(["entity_name", "operation", "rule_name"]);

    // Check constraint for valid operations
    table.checkRaw("operation IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'ALL')");
  });

  // Create sys_workflow_runs table
  await knex.schema.createTable("sys_workflow_runs", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("trigger_run_id", 255); // Trigger.dev run ID for cross-reference
    table.string("entity_name", 100).notNullable();
    table.uuid("entity_id").notNullable();
    table.string("operation", 20).notNullable();
    table.string("status", 20).notNullable().defaultTo("draft");
    table.jsonb("input_payload"); // JSON sent to Zen Engine
    table.jsonb("output_payload"); // JSON received from Zen Engine
    table.jsonb("mutations_applied"); // What was actually changed in the DB
    table.text("error_details");
    table.integer("duration_ms"); // Execution time in milliseconds
    table.uuid("created_by").references("id").inTable("better_auth_users").onDelete("SET NULL");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("completed_at");

    // Check constraint for valid status
    table.checkRaw("status IN ('draft', 'success', 'error')");

    // Check constraint: completed_at must be set if status is not draft
    table.checkRaw(
      "((status = 'draft' AND completed_at IS NULL) OR (status IN ('success', 'error') AND completed_at IS NOT NULL))"
    );
  });

  // Create indexes for better performance
  await knex.raw(
    "CREATE INDEX idx_rule_definitions_entity ON sys_rule_definitions(entity_name, operation)"
  );
  await knex.raw(
    "CREATE INDEX idx_rule_definitions_active ON sys_rule_definitions(is_active) WHERE is_active = true"
  );

  await knex.raw(
    "CREATE INDEX idx_workflow_runs_entity ON sys_workflow_runs(entity_name, entity_id)"
  );
  await knex.raw("CREATE INDEX idx_workflow_runs_status ON sys_workflow_runs(status)");
  await knex.raw("CREATE INDEX idx_workflow_runs_created_at ON sys_workflow_runs(created_at DESC)");
  await knex.raw(
    "CREATE INDEX idx_workflow_runs_trigger_run_id ON sys_workflow_runs(trigger_run_id)"
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sys_workflow_runs");
  await knex.schema.dropTableIfExists("sys_rule_definitions");
}
