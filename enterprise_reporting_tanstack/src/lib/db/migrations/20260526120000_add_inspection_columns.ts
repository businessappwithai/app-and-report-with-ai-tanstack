export async function up(db: any): Promise<void> {
  // Add inspection tracking columns to data_sources table
  await db.schema.alterTable("data_sources", (table) => {
    table.boolean("is_inspected").defaultTo(false);
    table.timestamp("last_inspected_at").nullable();
  });
}

export async function down(db: any): Promise<void> {
  // Remove inspection tracking columns from data_sources table
  await db.schema.alterTable("data_sources", (table) => {
    table.dropColumn("is_inspected");
    table.dropColumn("last_inspected_at");
  });
}
