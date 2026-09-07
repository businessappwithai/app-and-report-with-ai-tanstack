/**
 * Migration: Optimize Rule Lookup Index
 *
 * Creates optimized composite index for sys_rule table lookup performance.
 * Replaces existing idx_rule_lookup with better column ordering.
 *
 * Query pattern: SELECT * FROM sys_rule WHERE entity = ? AND trigger = ? AND active = true
 * Index ordering: entity (highest cardinality) → trigger (medium) → active (boolean filter)
 *
 * Performance impact:
 * - Read: Faster rule lookups (most queries filter on active=true)
 * - Write: Minimal overhead (index updates on insert/update)
 *
 * Created by: DATABASE-002 ticket
 * Week: 1
 */

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Drop existing suboptimal index
  await knex.raw("DROP INDEX IF EXISTS idx_rule_lookup");

  // Create optimized composite index
  // Column order matters: entity (high cardinality) → trigger (medium) → active (low cardinality)
  // This ordering maximizes index effectiveness for multi-column queries
  await knex.schema.alterTable("sys_rule", (table) => {
    table.index(["entity", "trigger", "active"], "idx_rule_lookup_optimized");
  });

  // Add partial index for active rules only (PostgreSQL feature)
  // This is more efficient for queries that only need active rules
  await knex.raw(`
    CREATE INDEX idx_rule_active_only
    ON sys_rule (entity, trigger)
    WHERE active = true
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop optimized index
  await knex.raw("DROP INDEX IF EXISTS idx_rule_lookup_optimized");

  // Drop partial index
  await knex.raw("DROP INDEX IF EXISTS idx_rule_active_only");

  // Restore original index (for rollback)
  await knex.schema.alterTable("sys_rule", (table) => {
    table.index(["entity", "trigger", "active"], "idx_rule_lookup");
  });
}
