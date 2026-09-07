import { Kysely, sql } from 'kysely';

/**
 * Stores the valid state-machine transitions declared by `%%workflow … kind: state`
 * directives. The entity-access guard reads this table to refuse writes that move
 * a record to a state that has no incoming edge from the current state.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS sys_workflow_transitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      table_name VARCHAR(100) NOT NULL,
      status_field VARCHAR(100) NOT NULL DEFAULT 'status',
      from_state VARCHAR(100) NOT NULL,
      to_state VARCHAR(100) NOT NULL,
      transition_name VARCHAR(100),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT sys_workflow_transitions_unique
        UNIQUE (table_name, status_field, from_state, to_state)
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_sys_wf_transitions_lookup
    ON sys_workflow_transitions (table_name, status_field, to_state)
    WHERE is_active = TRUE
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS sys_workflow_transitions`.execute(db);
}
