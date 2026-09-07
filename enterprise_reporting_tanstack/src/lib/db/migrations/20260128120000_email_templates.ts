export async function up(db: any): Promise<void> {
  // Email templates table for dynamic email template system
  await db.schema.createTable("email_templates", (table) => {
    table.string("id", 36).primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
    table.string("name", 255).notNullable();
    table.text("subject").notNullable();
    table.text("htmlBody").notNullable();
    table
      .string("query_id", 36)
      .nullable()
      .references("id")
      .inTable("saved_queries")
      .onDelete("SET NULL");
    table.text("columnMappings"); // JSON object mapping placeholders to column names
    table.timestamp("created_at").defaultTo(db.fn.now());
    table.timestamp("updated_at").defaultTo(db.fn.now());

    table.index("query_id");
    table.index("name");
  });
}

export async function down(db: any): Promise<void> {
  await db.schema.dropTableIfExists("email_templates");
}
