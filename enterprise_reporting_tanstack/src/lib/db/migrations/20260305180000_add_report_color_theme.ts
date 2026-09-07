export async function up(db: any): Promise<void> {
  // Add color_theme column to report_definitions
  await db.schema.alterTable("report_definitions", (table) => {
    table.text("color_theme").nullable();
  });

  // Add color_theme column to chart_definitions for consistency
  await db.schema.alterTable("chart_definitions", (table) => {
    table.text("color_theme").nullable();
  });
}

export async function down(db: any): Promise<void> {
  await db.schema.alterTable("report_definitions", (table) => {
    table.dropColumn("color_theme");
  });

  await db.schema.alterTable("chart_definitions", (table) => {
    table.dropColumn("color_theme");
  });
}
