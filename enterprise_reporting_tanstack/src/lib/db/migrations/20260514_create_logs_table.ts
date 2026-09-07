import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("logs")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo("gen_random_uuid()"))
    .addColumn("timestamp", "timestamptz", (col) => col.notNull().defaultTo("now()"))
    .addColumn("level", "varchar(20)", (col) => col.notNull())
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("component", "varchar(255)", (col) => col.notNull())
    .addColumn("user_id", "uuid")
    .addColumn("session_id", "varchar(255)")
    .addColumn("metadata", "jsonb")
    .addColumn("error_stack", "text")
    .addColumn("request_id", "varchar(255)")
    .execute();

  await db.schema.createIndex("idx_logs_timestamp").on("logs").column("timestamp").execute();

  await db.schema.createIndex("idx_logs_level").on("logs").column("level").execute();

  await db.schema.createIndex("idx_logs_user_id").on("logs").column("user_id").execute();

  await db.schema.createIndex("idx_logs_component").on("logs").column("component").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("logs").execute();
}
