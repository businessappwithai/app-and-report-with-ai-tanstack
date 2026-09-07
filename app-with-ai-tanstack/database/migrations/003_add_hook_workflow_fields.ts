/**
 * Migration: Add Hook Workflow Fields
 *
 * Adds support for hook-based workflows with flowchart format
 */

// Kysely/Knex db schema builder — dynamically typed third-party interop
/* eslint-disable @typescript-eslint/no-explicit-any */

export const migration = {
  version: 3,
  name: "add_hook_workflow_fields",
  up: async (db: any) => {
    // Add new columns to workflows table
    await db.schema
      .alterTable("workflows")
      .addColumn("workflow_type", "text", (col: any) => col.defaultTo("sequence").notNull())
      .execute();

    await db.schema.alterTable("workflows").addColumn("hook_definitions", "text").execute();

    await db.schema.alterTable("workflows").addColumn("flowchart_code", "text").execute();

    await db.schema.alterTable("workflows").addColumn("generated_hook_code", "text").execute();

    await db.schema
      .alterTable("workflows")
      .addColumn("is_draft", "integer", (col: any) => col.defaultTo(0).notNull())
      .execute();

    console.log("Migration 003: Added hook workflow fields to workflows table");
  },

  down: async (db: any) => {
    // Drop the added columns
    await db.schema.alterTable("workflows").dropColumn("workflow_type").execute();

    await db.schema.alterTable("workflows").dropColumn("hook_definitions").execute();

    await db.schema.alterTable("workflows").dropColumn("flowchart_code").execute();

    await db.schema.alterTable("workflows").dropColumn("generated_hook_code").execute();

    await db.schema.alterTable("workflows").dropColumn("is_draft").execute();

    console.log("Migration 003: Removed hook workflow fields from workflows table");
  },
};
