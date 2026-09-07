import { Kysely, sql } from 'kysely';

/**
 * Columns that decide *when* a workflow runs and *who owns it*.
 *
 * Both are also declared in 004's createTable, which covers a fresh database.
 * They live here as well because the migration runner tracks by filename: an
 * application generated before these columns existed has already recorded 004
 * as executed, so editing 004 would never reach it. Without this migration,
 * regenerating an existing project produced a seed that failed on
 * `column "source" does not exist`.
 *
 *   trigger_type   automatic — run on every write matching entity + operation
 *                  rule      — run only when a rule's trigger-workflow action
 *                              names it, so the rule's condition decides
 *   source         model     — declared by a %%workflow section; the seed
 *                              rewrites it and the designer shows it read-only
 *                  designer  — built in the app; regeneration never touches it
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE sys_workflow_definitions ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(20) NOT NULL DEFAULT 'automatic'`.execute(db);
  await sql`ALTER TABLE sys_workflow_definitions ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'designer'`.execute(db);

  // Which definition a run belongs to. A run row used to say an entity had been
  // processed but not by what, so two definitions on the same entity were
  // indistinguishable in the run list and in the audit trail.
  await sql`ALTER TABLE sys_workflow_runs ADD COLUMN IF NOT EXISTS workflow_name VARCHAR(200)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE sys_workflow_definitions DROP COLUMN IF EXISTS trigger_type`.execute(db);
  await sql`ALTER TABLE sys_workflow_definitions DROP COLUMN IF EXISTS source`.execute(db);
  await sql`ALTER TABLE sys_workflow_runs DROP COLUMN IF EXISTS workflow_name`.execute(db);
}
