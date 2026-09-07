/**
 * Optimize Rule Auto-Version Trigger
 *
 * Optimizes the sys_rule_create_version() trigger to only create
 * version snapshots when the decision_model column actually changes,
 * not on every UPDATE operation.
 *
 * Created by: DATABASE-003 ticket
 * Week: 4
 */

import type { Knex } from "knex";

/**
 * Up migration: Optimize trigger to only fire on decision_model changes
 */
export async function up(knex: Knex): Promise<void> {
  // Drop existing trigger function (if exists)
  await knex.raw(`
    DROP FUNCTION IF EXISTS sys_rule_create_version() CASCADE;
  `);

  // Create optimized trigger function
  // Only creates version snapshot when decision_model actually changes
  await knex.raw(`
    CREATE OR REPLACE FUNCTION sys_rule_create_version()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Only create version on UPDATE if decision_model changed
      IF (TG_OP = 'UPDATE' AND OLD.decision_model IS DISTINCT FROM NEW.decision_model) THEN
        INSERT INTO sys_rule_version (
          rule_id,
          version,
          name,
          entity,
          trigger,
          execution_mode,
          decision_model,
          generated_code,
          active,
          priority,
          created_by,
          created_at
        )
        SELECT
          NEW.id,
          NEW.version,
          NEW.name,
          NEW.entity,
          NEW.trigger,
          NEW.execution_mode,
          NEW.decision_model,
          NEW.generated_code,
          NEW.active,
          NEW.priority,
          NEW.updated_by,
          NEW.created_at;

      -- Always create version on INSERT (new rule)
      ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO sys_rule_version (
          rule_id,
          version,
          name,
          entity,
          trigger,
          execution_mode,
          decision_model,
          generated_code,
          active,
          priority,
          created_by,
          created_at
        )
        SELECT
          NEW.id,
          NEW.version,
          NEW.name,
          NEW.entity,
          NEW.trigger,
          NEW.execution_mode,
          NEW.decision_model,
          NEW.generated_code,
          NEW.active,
          NEW.priority,
          NEW.updated_by,
          NEW.created_at;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Re-create trigger with optimized function
  await knex.raw(`
    DROP TRIGGER IF EXISTS sys_rule_auto_version ON sys_rule;
  `);

  await knex.raw(`
    CREATE TRIGGER sys_rule_auto_version
    AFTER INSERT OR UPDATE ON sys_rule
    FOR EACH ROW
    EXECUTE FUNCTION sys_rule_create_version();
  `);
}

/**
 * Down migration: Revert to simple trigger (creates version on every UPDATE)
 */
export async function down(knex: Knex): Promise<void> {
  // Drop optimized trigger
  await knex.raw(`
    DROP TRIGGER IF EXISTS sys_rule_auto_version ON sys_rule;
  `);

  // Drop optimized function
  await knex.raw(`
    DROP FUNCTION IF EXISTS sys_rule_create_version() CASCADE;
  `);

  // Create simple trigger function (original version - creates version on every UPDATE)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION sys_rule_create_version()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO sys_rule_version (
        rule_id,
        version,
        name,
        entity,
        trigger,
        execution_mode,
        decision_model,
        generated_code,
        active,
        priority,
        created_by,
        created_at
      )
      SELECT
        NEW.id,
        NEW.version,
        NEW.name,
        NEW.entity,
        NEW.trigger,
        NEW.execution_mode,
        NEW.decision_model,
        NEW.generated_code,
        NEW.active,
        NEW.priority,
        NEW.updated_by,
        NEW.created_at;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Re-create trigger with simple function
  await knex.raw(`
    CREATE TRIGGER sys_rule_auto_version
    AFTER INSERT OR UPDATE ON sys_rule
    FOR EACH ROW
    EXECUTE FUNCTION sys_rule_create_version();
  `);
}
