import { Kysely, sql } from 'kysely';

/**
 * Stores administrator-designed document report layouts per entity table.
 * The layout field holds an AnkaReport ILayout JSON object.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS sys_report_designs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      table_name VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL DEFAULT 'Default Report',
      layout JSONB,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT sys_report_designs_table_name_unique UNIQUE (table_name)
    )
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS sys_report_designs`.execute(db);
}
