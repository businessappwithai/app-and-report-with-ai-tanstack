/**
 * Add generation and deployment fields to projects table
 */

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    // Generation fields
    table.text("generated_path").nullable();
    table.string("generation_status", 20).nullable(); // pending, generating, completed, failed

    // Deployment fields
    table.text("deployment_url").nullable();
    table.string("deployment_status", 20).nullable(); // pending, running, stopped, error
    table.text("uptime").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.dropColumn("generated_path");
    table.dropColumn("generation_status");
    table.dropColumn("deployment_url");
    table.dropColumn("deployment_status");
    table.dropColumn("uptime");
  });
}
