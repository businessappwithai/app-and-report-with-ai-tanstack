import knex from "knex";
import config from "../database/knexfile.ts";

const db = knex(config.development);

async function runMigration() {
  try {
    // Get existing columns
    const existingColumns = await db("projects").columnInfo();
    console.log("Existing columns:", Object.keys(existingColumns));

    if (!existingColumns.generated_path) {
      await db.schema.alterTable("projects", (table) => {
        table.text("generated_path").nullable();
      });
      console.log("Added generated_path column");
    }

    if (!existingColumns.deployment_status) {
      await db.schema.alterTable("projects", (table) => {
        table.string("deployment_status", 20).nullable();
      });
      console.log("Added deployment_status column");
    }

    if (!existingColumns.deployment_url) {
      await db.schema.alterTable("projects", (table) => {
        table.text("deployment_url").nullable();
      });
      console.log("Added deployment_url column");
    }

    if (!existingColumns.uptime) {
      await db.schema.alterTable("projects", (table) => {
        table.text("uptime").nullable();
      });
      console.log("Added uptime column");
    }

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

runMigration();
