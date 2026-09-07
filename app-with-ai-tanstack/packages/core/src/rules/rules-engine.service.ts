/**
 * Rules Engine Service
 *
 * Main service for business rule evaluation using GoRules zen-engine.
 * Integrates rule caching, validation, and evaluation.
 *
 * Created by: CORE-004 ticket
 * Week: 1
 */

import { validateJDM } from "./jdm.schema";
import { ruleCache } from "./rule-cache.service";
import type {
  IRulesEngineService,
  JDMContent,
  RuleDefinition,
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleValidationResult,
} from "./rules.types";
import { zenEngine } from "./zen-engine.singleton";

/**
 * Database row structure for sys_rule_definitions table
 */
interface RuleDefinitionRow {
  id: string;
  entity_name: string;
  name: string;
  trigger: string;
  execution_mode: string;
  decision_model: JDMContent;
  generated_code: string | null;
  active: boolean;
  priority: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * Rules Engine Service implementation
 */
export class RulesEngineService implements IRulesEngineService {
  /**
   * @param db - Database instance
   */
  constructor(private db: any) {}

  /**
   * Evaluate a rule against evaluation context
   *
   * @param jdmContent - JDM content to evaluate
   * @param context - Evaluation context with entity data and metadata
   * @returns Evaluation result with success flag and mutations or error
   */
  async evaluate(
    jdmContent: JDMContent,
    context: RuleEvaluationContext
  ): Promise<RuleEvaluationResult> {
    try {
      // Validate JDM structure before evaluation
      const validation = await this.validateRule(jdmContent);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid JDM: ${validation.errors?.join(", ") || "unknown error"}`,
          validationErrors: validation.errors,
        };
      }

      // Prepare evaluation input from context
      // Zen-engine expects direct input object, not nested context structure
      const input = {
        ...context.entity,
        _metadata: context.metadata,
      };

      // Evaluate using zen-engine
      const result = await zenEngine.evaluate(jdmContent, input);

      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || "Rule evaluation failed",
        };
      }

      // Extract decision output
      const decision = result.decision?.result;

      // Apply mutations if decision returned
      const mutations: {
        entity?: Record<string, unknown>;
        relations?: Record<string, Record<string, unknown>>;
      } = {};

      if (decision && typeof decision === "object") {
        // Apply decision mutations to entity
        mutations.entity = { ...context.entity, ...decision };
      }

      return {
        success: true,
        mutations,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Validate JDM content using Zod schema
   *
   * @param jdmContent - JDM content to validate
   * @returns Validation result with success flag and errors
   */
  async validateRule(jdmContent: JDMContent): Promise<RuleValidationResult> {
    const result = validateJDM(jdmContent);

    if (result.success) {
      return { valid: true };
    }

    const errors = result.error.errors.map((e) => {
      const path = e.path.join(".");
      return `${path}: ${e.message}`;
    });

    return {
      valid: false,
      errors,
    };
  }

  /**
   * Get active rule for entity and operation
   *
   * Checks cache first, then database.
   *
   * @param entityName - Entity name (e.g., "Patient")
   * @param operation - Operation type (CREATE, READ, UPDATE, DELETE)
   * @returns Rule definition or null if not found
   */
  async getRule(
    entityName: string,
    operation: "CREATE" | "READ" | "UPDATE" | "DELETE"
  ): Promise<RuleDefinition | null> {
    // Check cache first
    const cached = ruleCache.get(entityName, operation);
    if (cached) {
      // Convert cached JDM to RuleDefinition format
      return {
        id: "cached",
        entityName,
        ruleName: cached.name,
        operation,
        jdmContent: cached,
        version: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Query database for active rule
    const row = await this.db
      .selectFrom("sys_rule_definitions" as any)
      .selectAll()
      .where("entity_name", "=", entityName)
      .where("trigger", "=", operation)
      .where("active", "=", true)
      .orderBy("priority", "asc")
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    // Cache the rule for future access
    ruleCache.set(entityName, operation, row.decision_model);

    return this.mapRowToDefinition(row);
  }

  /**
   * Create a new rule definition
   *
   * @param entityName - Entity name
   * @param ruleName - Human-readable rule name
   * @param operation - Operation type
   * @param jdmContent - JDM content
   * @param userId - Optional user ID for created_by field
   * @returns Created rule definition
   */
  async createRule(
    entityName: string,
    ruleName: string,
    operation: "CREATE" | "READ" | "UPDATE" | "DELETE" | "ALL",
    jdmContent: JDMContent,
    userId?: string
  ): Promise<RuleDefinition> {
    const now = new Date();

    const row = await this.db
      .insertInto("sys_rule_definitions" as any)
      .values({
        id: this.generateId(),
        entity_name: entityName,
        name: ruleName,
        trigger: operation,
        execution_mode: "runtime",
        decision_model: jdmContent,
        generated_code: null,
        active: true,
        priority: 0,
        created_by: userId || null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        version: 1,
      })
      .returningAll()
      .executeTakeFirst();

    if (!row) {
      throw new Error("Failed to create rule: no row returned");
    }

    // Invalidate cache for this entity/operation
    ruleCache.set(entityName, operation, jdmContent);

    return this.mapRowToDefinition(row);
  }

  /**
   * Update an existing rule definition
   *
   * @param ruleId - Rule ID to update
   * @param jdmContent - New JDM content
   * @returns Updated rule definition
   */
  async updateRule(ruleId: string, jdmContent: JDMContent): Promise<RuleDefinition> {
    // Get current rule to find version
    const current = await this.db
      .selectFrom("sys_rule_definitions" as any)
      .selectAll()
      .where("id", "=", ruleId)
      .executeTakeFirst();

    if (!current) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const row = await this.db
      .updateTable("sys_rule_definitions" as any)
      .set({
        decision_model: jdmContent,
        updated_at: new Date().toISOString(),
        version: (current.version || 0) + 1,
      })
      .where("id", "=", ruleId)
      .returningAll()
      .executeTakeFirst();

    if (!row) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    // Invalidate cache for this entity/operation
    ruleCache.invalidate(row.entity_name, row.trigger);

    return this.mapRowToDefinition(row);
  }

  /**
   * Get rule version history
   *
   * @param ruleId - Rule ID
   * @returns Array of rule definitions from version history
   */
  async getRuleHistory(ruleId: string): Promise<RuleDefinition[]> {
    const rows = (await this.db("sys_rule_versions")
      .where({ rule_id: ruleId })
      .orderBy("version", "desc")) as RuleDefinitionRow[] | any[];

    return (rows as RuleDefinitionRow[]).map((row: RuleDefinitionRow) =>
      this.mapVersionRowToDefinition(row)
    );
  }

  /**
   * Get all rules with pagination
   *
   * Created by: CORE-008 ticket
   *
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   * @param entityName - Optional entity name filter
   * @returns Paginated list of rules with metadata
   */
  async getAllRules(
    page: number = 1,
    limit: number = 10,
    entityName?: string
  ): Promise<{
    rules: RuleDefinition[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;

    // Build base query
    let countQuery = this.db.selectFrom("sys_rule_definitions" as any).selectAll();
    let selectQuery = this.db.selectFrom("sys_rule_definitions" as any).selectAll();

    if (entityName) {
      countQuery = countQuery.where("entity_name", "=", entityName);
      selectQuery = selectQuery.where("entity_name", "=", entityName);
    }

    // Get total count
    const countResult = await countQuery.execute();
    const total = countResult.length;

    // Get paginated results
    const rows = await selectQuery
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      rules: rows.map((row: any) => this.mapRowToDefinition(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Dry run rule evaluation without persisting changes
   *
   * @param jdmContent - JDM content to evaluate
   * @param context - Evaluation context
   * @returns Evaluation result (same as evaluate, but explicitly non-persisting)
   */
  async dryRun(
    jdmContent: JDMContent,
    context: RuleEvaluationContext
  ): Promise<RuleEvaluationResult> {
    // Dry run is identical to evaluate in runtime mode
    // The distinction matters more in code-generation mode
    return this.evaluate(jdmContent, context);
  }

  /**
   * Generate a unique ID for new rules
   */
  private generateId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Map database row to RuleDefinition
   */
  private mapRowToDefinition(row: RuleDefinitionRow): RuleDefinition {
    return {
      id: row.id,
      entityName: row.entity_name,
      ruleName: row.name,
      operation: row.trigger as "CREATE" | "READ" | "UPDATE" | "DELETE" | "ALL",
      jdmContent: row.decision_model,
      version: row.version,
      isActive: row.active,
      createdBy: row.created_by || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map version row to RuleDefinition
   */
  private mapVersionRowToDefinition(row: RuleDefinitionRow): RuleDefinition {
    return {
      id: row.id,
      entityName: row.entity_name,
      ruleName: row.name,
      operation: row.trigger as "CREATE" | "READ" | "UPDATE" | "DELETE" | "ALL",
      jdmContent: row.decision_model,
      version: row.version,
      isActive: row.active,
      createdBy: row.created_by || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export default RulesEngineService;
