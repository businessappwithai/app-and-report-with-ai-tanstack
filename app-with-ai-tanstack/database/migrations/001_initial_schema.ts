/**
 * Initial schema migration for APPWITHAI
 * Creates tables for projects, ERD versions, and workflows
 */

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Projects table
  await knex.schema.createTable("projects", (table) => {
    table.string("id").primary();
    table.string("name").notNullable();
    table.text("description").nullable();
    table.string("icon", 50).defaultTo("📊");
    table.string("icon_color", 20).defaultTo("#3b82f6");
    table.string("status", 20).defaultTo("draft"); // draft, active, archived
    table.boolean("is_deleted").defaultTo(false);

    // Configuration (Step 1)
    table.string("stack_type", 20).defaultTo("tanstackjs-nestjs"); // tanstackjs-nestjs, odata-ui5
    table.integer("port").defaultTo(4001);
    table.text("database_url").nullable();
    table.json("environment_variables").nullable(); // Store env vars as JSON

    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    // Indexes
    table.index("status");
    table.index("is_deleted");
    table.index("created_at");
  });

  // ERD Versions table - for history/versions feature
  await knex.schema.createTable("erd_versions", (table) => {
    table.string("id").primary();
    table
      .string("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.integer("version_number").notNullable();
    table.text("mermaid_code").notNullable();
    table.text("description").nullable();
    table.boolean("is_current").defaultTo(false);

    // Validation results
    table.json("validation_errors").nullable();

    // Metadata
    table.string("created_by").nullable(); // User or AI
    table.timestamp("created_at").defaultTo(knex.fn.now());

    // Indexes
    table.unique(["project_id", "version_number"]);
    table.index("project_id");
    table.index("is_current");
  });

  // Workflows table - for workflow enhancement
  await knex.schema.createTable("workflows", (table) => {
    table.string("id").primary();
    table
      .string("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.string("name").notNullable();
    table.string("service_name").notNullable();
    table.text("mermaid_code").notNullable();
    table.text("description").nullable();

    // Extension points
    table.json("extension_points").nullable(); // before/after CRUD hooks

    // Status
    table.string("status", 20).defaultTo("draft"); // draft, active, inactive
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    // Indexes
    table.index("project_id");
    table.index("service_name");
  });

  // Generation history table
  await knex.schema.createTable("generation_history", (table) => {
    table.string("id").primary();
    table
      .string("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.string("stack_type").notNullable();
    table.string("status", 20).notNullable(); // pending, generating, completed, failed

    // Output
    table.text("generated_path").nullable();
    table.integer("port").nullable();

    // Logs
    table.text("logs").nullable(); // Store generation logs
    table.text("error_message").nullable();

    // Timestamps
    table.timestamp("started_at").defaultTo(knex.fn.now());
    table.timestamp("completed_at").nullable();

    // Indexes
    table.index("project_id");
    table.index("status");
  });

  // Deployment table
  await knex.schema.createTable("deployments", (table) => {
    table.string("id").primary();
    table
      .string("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.string("status", 20).defaultTo("stopped"); // running, stopped, error

    // Deployment info
    table.string("deployment_url").nullable();
    table.integer("port").defaultTo(4001);
    table.text("uptime").nullable();

    // Timestamps
    table.timestamp("started_at").nullable();
    table.timestamp("stopped_at").nullable();

    // Indexes
    table.index("project_id");
    table.index("status");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("deployments");
  await knex.schema.dropTableIfExists("generation_history");
  await knex.schema.dropTableIfExists("workflows");
  await knex.schema.dropTableIfExists("erd_versions");
  await knex.schema.dropTableIfExists("projects");
}
