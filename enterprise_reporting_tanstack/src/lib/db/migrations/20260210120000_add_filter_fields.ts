export async function up(db: any): Promise<void> {
  // Add field_type and operator columns to filter_definitions table
  await db.schema.alterTable("filter_definitions", (table) => {
    table.string("field_type").defaultTo("id").after("value_field");
    table.string("operator").defaultTo("in").after("field_type");
  });
}

export async function down(db: any): Promise<void> {
  await db.schema.alterTable("filter_definitions", (table) => {
    table.dropColumn("field_type");
    table.dropColumn("operator");
  });
}
