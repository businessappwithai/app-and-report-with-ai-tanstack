export async function up(db: any): Promise<void> {
  // Add is_public column to report_definitions
  await db.schema.alterTable("report_definitions", (table) => {
    table.boolean("is_public").defaultTo(false).notNullable();
  });

  // Add is_public column to chart_definitions
  await db.schema.alterTable("chart_definitions", (table) => {
    table.boolean("is_public").defaultTo(false).notNullable();
  });

  // Add is_public column to dashboard_layouts if not exists
  const hasPublicColumn = await db.schema.hasColumn("dashboard_layouts", "is_public");
  if (!hasPublicColumn) {
    await db.schema.alterTable("dashboard_layouts", (table) => {
      table.boolean("is_public").defaultTo(false).notNullable();
    });
  }
}

export async function down(db: any): Promise<void> {
  await db.schema.alterTable("report_definitions", (table) => {
    table.dropColumn("is_public");
  });

  await db.schema.alterTable("chart_definitions", (table) => {
    table.dropColumn("is_public");
  });

  await db.schema.alterTable("dashboard_layouts", (table) => {
    table.dropColumn("is_public");
  });
}
