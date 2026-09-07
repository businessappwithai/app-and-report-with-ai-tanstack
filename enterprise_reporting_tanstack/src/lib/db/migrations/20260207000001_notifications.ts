export async function up(db: any): Promise<void> {
  return db.schema.createTable("notifications", (table) => {
    table.uuid("id").primary().defaultTo(db.raw("(uuid_to_bytes(uuid()))"));
    table.uuid("user_id").notNullable();
    table.string("type", 50).notNullable(); // info, warning, error, success
    table.string("title", 255).notNullable();
    table.text("message").notNullable();
    table.json("metadata").nullable(); // Additional data like links, action buttons
    table.boolean("is_read").defaultTo(false);
    table.timestamps(true, true);

    table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE");
    table.index(["user_id", "is_read", "created_at"]);
  });
}

export async function down(db: any): Promise<void> {
  return db.schema.dropTableIfExists("notifications");
}
