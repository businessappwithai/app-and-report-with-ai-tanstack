const knex = require("knex");

const config = {
  development: {
    client: "better-sqlite3",
    connection: {
      filename: "./database/generator.sql",
    },
    useNullAsDefault: true,
  },
};

const db = knex(config.development);

async function runMigration() {
  try {
    // Get existing columns
    const pragma = await db.raw("PRAGMA table_info(projects)");
    const existingColumns = pragma.map((col) => col.name);
    console.log("Existing columns:", existingColumns);

    if (!existingColumns.includes("generated_path")) {
      await db.schema.alterTable("projects", (table) => {
        table.text("generated_path").nullable();
      });
      console.log("Added generated_path column");
    }

    if (!existingColumns.includes("deployment_status")) {
      await db.schema.alterTable("projects", (table) => {
        table.string("deployment_status", 20).nullable();
      });
      console.log("Added deployment_status column");
    }

    if (!existingColumns.includes("deployment_url")) {
      await db.schema.alterTable("projects", (table) => {
        table.text("deployment_url").nullable();
      });
      console.log("Added deployment_url column");
    }

    if (!existingColumns.includes("uptime")) {
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
