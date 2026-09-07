import type { Knex } from "knex";

/**
 * 004_add_business_rules_system
 *
 * This migration implements the Application Dictionary extension for business rules.
 * It follows the Compiere/ADempiere metadata-driven architecture pattern.
 *
 * Tables created:
 * - sys_rule: Stores business rule definitions (metadata)
 * - sys_rule_version: Version history for audit trail and rollback
 * - sys_rule_execution_log: Execution logs for monitoring and debugging
 *
 * Execution modes:
 * - 'code': Rule is generated as TypeScript code (requires redeploy to change)
 * - 'runtime': Rule is stored as JSON decision model and executed by rule engine (instant updates)
 */

export async function up(knex: Knex): Promise<void> {
  // Create sys_rule table
  await knex.schema.createTable("sys_rule", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("name", 255).notNullable();
    table.text("description");

    // Entity and trigger information
    table.string("entity", 255).notNullable(); // e.g., "PurchaseOrder", "Invoice"
    table.string("trigger", 50).notNullable(); // e.g., "beforeCreate", "afterUpdate", "beforeDelete"

    // Rule definition (can be code or decision model)
    table.enum("execution_mode", ["code", "runtime"]).notNullable().defaultTo("runtime");
    table.text("decision_model"); // JSON: GoRules decision graph (for runtime mode)
    table.text("generated_code"); // TypeScript: Generated code (for code mode)

    // Rule metadata
    table.boolean("active").notNullable().defaultTo(true);
    table.integer("priority").defaultTo(0); // Execution order (higher = earlier)
    table.integer("version").notNullable().defaultTo(1); // Optimistic locking

    // Governance
    table.string("created_by", 255).notNullable();
    table.string("updated_by", 255);
    table.timestamps(true, true);

    // Indexes
    table.unique(["entity", "trigger", "name"], "idx_rule_unique");
    table.index(["entity", "trigger", "active"], "idx_rule_lookup");
    table.index(["execution_mode"], "idx_rule_mode");
  });

  // Create sys_rule_version table (audit trail and rollback)
  await knex.schema.createTable("sys_rule_version", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("rule_id").notNullable().references("id").inTable("sys_rule").onDelete("CASCADE");

    // Version snapshot
    table.integer("version").notNullable();
    table.text("decision_model"); // JSON snapshot
    table.text("generated_code"); // Code snapshot

    // Change metadata
    table.string("change_reason", 500);
    table.string("changed_by", 255).notNullable();
    table.timestamp("changed_at").notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(["rule_id", "version"], "idx_rule_version_lookup");
    table.unique(["rule_id", "version"], "idx_rule_version_unique");
  });

  // Create sys_rule_execution_log table (monitoring and debugging)
  await knex.schema.createTable("sys_rule_execution_log", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("rule_id").notNullable().references("id").inTable("sys_rule").onDelete("CASCADE");

    // Execution context
    table.string("entity", 255).notNullable();
    table.string("trigger", 50).notNullable();
    table.uuid("entity_record_id"); // ID of the record being processed
    table.string("request_id", 100); // For tracing

    // Input/Output
    table.jsonb("input_facts"); // Input data
    table.jsonb("output_decision"); // Rule decision

    // Execution result
    table.boolean("allowed").notNullable();
    table.string("action", 100); // e.g., "approve", "route_to_manager", "reject"
    table.text("reason"); // Explanation

    // Performance metrics
    table.integer("execution_time_ms").notNullable(); // Execution duration
    table.timestamp("executed_at").notNullable().defaultTo(knex.fn.now());

    // Error handling
    table.text("error_message"); // If execution failed
    table.boolean("success").notNullable().defaultTo(true);

    // Indexes
    table.index(["rule_id", "executed_at"], "idx_rule_execution_time");
    table.index(["entity", "entity_record_id"], "idx_rule_execution_entity");
    table.index(["success"], "idx_rule_execution_status");
  });

  // Create a sequence for rule version numbering (PostgreSQL)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION sys_rule_version_next_func()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.version = (SELECT COALESCE(MAX(version), 0) + 1 FROM sys_rule_version WHERE rule_id = NEW.rule_id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Trigger to auto-increment version
  await knex.raw(`
    DROP TRIGGER IF EXISTS sys_rule_version_auto_increment ON sys_rule_version;
    CREATE TRIGGER sys_rule_version_auto_increment
      BEFORE INSERT ON sys_rule_version
      FOR EACH ROW
      EXECUTE FUNCTION sys_rule_version_next_func();
  `);

  // Trigger to create version snapshot on rule update
  await knex.raw(`
    CREATE OR REPLACE FUNCTION sys_rule_create_version()
    RETURNS TRIGGER AS $$
    BEGIN
      IF (TG_OP = 'UPDATE' AND OLD IS DISTINCT FROM NEW) THEN
        INSERT INTO sys_rule_version (rule_id, decision_model, generated_code, change_reason, changed_by, changed_at)
        VALUES (NEW.id, NEW.decision_model, NEW.generated_code, 'Auto-version on update', NEW.updated_by, NOW());
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    DROP TRIGGER IF EXISTS sys_rule_auto_version ON sys_rule;
    CREATE TRIGGER sys_rule_auto_version
      AFTER UPDATE ON sys_rule
      FOR EACH ROW
      EXECUTE FUNCTION sys_rule_create_version();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP TRIGGER IF EXISTS sys_rule_auto_version ON sys_rule");
  await knex.raw("DROP FUNCTION IF EXISTS sys_rule_create_version()");
  await knex.raw("DROP TRIGGER IF EXISTS sys_rule_version_auto_increment ON sys_rule_version");
  await knex.raw("DROP FUNCTION IF EXISTS sys_rule_version_next_func()");

  await knex.schema.dropTableIfExists("sys_rule_execution_log");
  await knex.schema.dropTableIfExists("sys_rule_version");
  await knex.schema.dropTableIfExists("sys_rule");
}
