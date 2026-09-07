import { type Kysely, sql } from "kysely";

/**
 * Let a workflow definition be an automation, not only a BPMN diagram.
 *
 * The automation builder writes mermaid with `%%` directives — the same
 * artifact the generator reads — so a definition it saves has no BPMN XML at
 * all. Before this, `bpmn_xml` was NOT NULL and the service rejected anything
 * without a `<bpmn:` tag, which meant the builder could not save a single
 * automation into a generated app.
 *
 * `kind` says which of the two a row is, so listing automations never has to
 * guess from the shape of the content.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("sys_workflow_definitions")
    .addColumn("mermaid_code", "text")
    .execute()
    .catch(() => {
      // Column already present — this migration is also applied by hand to
      // databases generated before it existed.
    });

  await db.schema
    .alterTable("sys_workflow_definitions")
    .addColumn("kind", "varchar(20)", (col) => col.notNull().defaultTo("bpmn"))
    .execute()
    .catch(() => {});

  // An automation carries mermaid instead of BPMN, so the old NOT NULL cannot
  // stand. Existing BPMN rows are untouched.
  await sql`ALTER TABLE sys_workflow_definitions ALTER COLUMN bpmn_xml DROP NOT NULL`
    .execute(db)
    .catch(() => {});

  await db.schema
    .createIndex("idx_workflow_definitions_kind")
    .ifNotExists()
    .on("sys_workflow_definitions")
    .columns(["kind", "entity_name"])
    .execute()
    .catch(() => {});
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_workflow_definitions_kind").ifExists().execute().catch(() => {});
  await db.schema
    .alterTable("sys_workflow_definitions")
    .dropColumn("kind")
    .execute()
    .catch(() => {});
  await db.schema
    .alterTable("sys_workflow_definitions")
    .dropColumn("mermaid_code")
    .execute()
    .catch(() => {});
}
