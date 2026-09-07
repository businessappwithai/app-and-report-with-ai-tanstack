import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('sys_workflow_definitions')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('entity_name', 'varchar(100)', (col) => col.notNull())
    .addColumn('operation', 'varchar(20)', (col) => col.notNull().defaultTo('ALL'))
    .addColumn('bpmn_xml', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    // How the definition is reached.
    //   automatic  run on every write matching entity_name + operation
    //   rule       run only when a rule's trigger-workflow action names it
    // Without this every definition ran on every matching write, so a workflow
    // a rule was supposed to gate on a condition fired regardless of it.
    .addColumn('trigger_type', 'varchar(20)', (col) => col.notNull().defaultTo('automatic'))
    // Who owns the definition.
    //   model      declared by a %%workflow section; the seed rewrites it on
    //              every generation and the Workflow Designer shows it read-only
    //   designer   built in the app; regeneration never touches it
    // Without the distinction the two authoring paths silently clobbered each
    // other: a regeneration overwrote hand-drawn workflows that happened to
    // share a name, with no record that anything had been lost.
    .addColumn('source', 'varchar(20)', (col) => col.notNull().defaultTo('designer'))
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_by', 'uuid')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // createTable ... ifNotExists is a no-op on a database that predates these
  // columns, so add them separately for those.
  await sql`ALTER TABLE sys_workflow_definitions ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(20) NOT NULL DEFAULT 'automatic'`.execute(db);
  await sql`ALTER TABLE sys_workflow_definitions ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'designer'`.execute(db);

  await db.schema
    .createIndex('idx_workflow_def_entity_op')
    .on('sys_workflow_definitions')
    .columns(['entity_name', 'operation', 'is_active'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('sys_workflow_definitions').ifExists().execute();
}
