/**
 * Migration: Add Error Codes Table
 *
 * Creates centralized error code management system.
 * Error codes are stored in database (not hardcoded) for configurability.
 *
 * Created by: DATABASE-001 ticket
 * Week: 1
 */

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create sys_error_codes table
  await knex.schema.createTable("sys_error_codes", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("code", 50).notNullable().unique(); // e.g., "VALIDATION_ERROR"
    table.string("message", 500).notNullable(); // Error message template
    table.string("severity", 20).notNullable(); // "info", "warning", "error", "critical"
    table.string("category", 50).notNullable(); // "validation", "execution", "system", "authorization"
    table.text("description"); // Detailed explanation
    table.jsonb("metadata"); // Additional context (optional)
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    table.uuid("created_by").references("id").inTable("better_auth_users").onDelete("SET NULL");

    // Indexes
    table.index(["code"], "idx_error_codes_code");
    table.index(["severity"], "idx_error_codes_severity");
    table.index(["category"], "idx_error_codes_category");
    table.index(["severity", "category"], "idx_error_codes_severity_category");
  });

  // Seed common error codes
  const errorCodes = [
    // Validation errors (100-199)
    {
      code: "VALIDATION_ERROR",
      message: "Validation failed: {field} failed validation",
      severity: "error",
      category: "validation",
      description: "Generic validation error for field validation failures",
      metadata: { hint: "Check field constraints and data types" },
    },
    {
      code: "REQUIRED_FIELD_MISSING",
      message: "Required field '{field}' is missing",
      severity: "error",
      category: "validation",
      description: "Required field not provided in request",
      metadata: { hint: "Provide all required fields" },
    },
    {
      code: "INVALID_DATA_TYPE",
      message: "Invalid data type for field '{field}': expected {expectedType}, got {actualType}",
      severity: "error",
      category: "validation",
      description: "Field value doesn't match expected data type",
      metadata: { hint: "Ensure correct data type for field" },
    },
    {
      code: "VALUE_OUT_OF_RANGE",
      message: "Value '{value}' for field '{field}' is out of range (min: {min}, max: {max})",
      severity: "error",
      category: "validation",
      description: "Numeric value outside allowed range",
      metadata: { hint: "Provide value within allowed range" },
    },
    {
      code: "INVALID_FORMAT",
      message: "Invalid format for field '{field}': {format}",
      severity: "error",
      category: "validation",
      description: "String value doesn't match required format (e.g., email, UUID)",
      metadata: { hint: "Ensure value matches expected format" },
    },

    // Rule execution errors (200-299)
    {
      code: "RULE_NOT_FOUND",
      message: "No active rule found for entity '{entity}' and operation '{operation}'",
      severity: "warning",
      category: "execution",
      description: "No rule defined for this entity/operation combination",
      metadata: { hint: "Define a rule or check entity/operation names" },
    },
    {
      code: "RULE_EVALUATION_FAILED",
      message: "Rule evaluation failed for rule '{ruleName}': {details}",
      severity: "error",
      category: "execution",
      description: "Zen engine failed to evaluate rule (syntax error, missing nodes, etc.)",
      metadata: { hint: "Check JDM structure in GoRules editor" },
    },
    {
      code: "ENGINE_COMPILATION_ERROR",
      message: "Failed to compile decision model: {details}",
      severity: "critical",
      category: "execution",
      description: "Zen engine failed to compile JDM to Rust",
      metadata: { hint: "Validate JDM structure before saving" },
    },
    {
      code: "RULE_TIMEOUT",
      message: "Rule evaluation timed out after {timeout}ms",
      severity: "error",
      category: "execution",
      description: "Rule execution exceeded maximum allowed time",
      metadata: { hint: "Optimize rule complexity or increase timeout" },
    },

    // Workflow errors (300-399)
    {
      code: "WORKFLOW_DISPATCH_FAILED",
      message: "Failed to dispatch workflow: {details}",
      severity: "error",
      category: "execution",
      description: "Trigger.dev failed to accept workflow job",
      metadata: { hint: "Check Trigger.dev connection and configuration" },
    },
    {
      code: "WORKFLOW_STATUS_POLL_TIMEOUT",
      message: "Workflow {workflowRunId} did not complete after {timeout}ms",
      severity: "warning",
      category: "execution",
      description: "Workflow execution exceeded timeout while polling for status",
      metadata: { hint: "Increase timeout or check workflow logs" },
    },
    {
      code: "WORKFLOW_TRANSACTION_FAILED",
      message: "Database transaction failed during workflow execution: {details}",
      severity: "error",
      category: "execution",
      description: "Failed to commit workflow results in database",
      metadata: { hint: "Check database connection and transaction locks" },
    },

    // Authorization errors (400-499)
    {
      code: "UNAUTHORIZED",
      message: "Authentication required: {details}",
      severity: "error",
      category: "authorization",
      description: "User not authenticated",
      metadata: { hint: "Log in to access this resource" },
    },
    {
      code: "PERMISSION_DENIED",
      message: "Permission denied: insufficient privileges for '{action}' on '{resource}'",
      severity: "error",
      category: "authorization",
      description: "User lacks required permission for operation",
      metadata: { hint: "Contact administrator for access" },
    },
    {
      code: "FORBIDDEN_OPERATION",
      message: "Operation '{operation}' not allowed: {reason}",
      severity: "error",
      category: "authorization",
      description: "User attempted operation outside their permissions",
      metadata: { hint: "Check user roles and permissions" },
    },

    // System errors (500-599)
    {
      code: "DATABASE_CONNECTION_ERROR",
      message: "Failed to connect to database: {details}",
      severity: "critical",
      category: "system",
      description: "Cannot establish database connection",
      metadata: { hint: "Check database is running and connection string is correct" },
    },
    {
      code: "DATABASE_QUERY_ERROR",
      message: "Database query failed: {details}",
      severity: "error",
      category: "system",
      description: "SQL query execution failed",
      metadata: { hint: "Check query syntax and table existence" },
    },
    {
      code: "CACHE_ERROR",
      message: "Cache operation failed: {details}",
      severity: "warning",
      category: "system",
      description: "Redis or in-memory cache operation failed",
      metadata: { hint: "Cache may be stale, retry with fresh data" },
    },
    {
      code: "SERVICE_UNAVAILABLE",
      message: "Service temporarily unavailable: {service} - {details}",
      severity: "critical",
      category: "system",
      description: "Required service is down or unreachable",
      metadata: { hint: "Check service status and retry later" },
    },

    // Entity errors (600-699)
    {
      code: "ENTITY_NOT_FOUND",
      message: "Entity '{entity}' with ID '{entityId}' not found",
      severity: "error",
      category: "validation",
      description: "Requested entity record doesn't exist in database",
      metadata: { hint: "Verify entity ID and check if entity was deleted" },
    },
    {
      code: "ENTITY_ALREADY_EXISTS",
      message: "Entity '{entity}' with unique key '{key}' already exists",
      severity: "error",
      category: "validation",
      description: "Cannot create duplicate entity (unique constraint violation)",
      metadata: { hint: "Use update operation instead or provide different key value" },
    },
    {
      code: "ENTITY_STALE_DATA",
      message: "Entity '{entity}' has been modified by another user: {details}",
      severity: "warning",
      category: "execution",
      description: "Optimistic lock failure: entity changed since read",
      metadata: { hint: "Refresh entity data and retry operation" },
    },

    // Configuration errors (700-799)
    {
      code: "FEATURE_FLAG_DISABLED",
      message: "Feature '{feature}' is disabled: {details}",
      severity: "info",
      category: "system",
      description: "Feature is disabled via environment variable",
      metadata: { hint: "Enable feature flag to use this functionality" },
    },
    {
      code: "CONFIGURATION_INVALID",
      message: "Invalid configuration: {parameter} = {value}",
      severity: "error",
      category: "system",
      description: "Configuration value is invalid or out of range",
      metadata: { hint: "Check environment variables and configuration file" },
    },
    {
      code: "DEPENDENCY_MISSING",
      message: "Required dependency not available: {dependency}",
      severity: "critical",
      category: "system",
      description: "Required service or library is not available",
      metadata: { hint: "Install dependency or configure connection" },
    },
  ];

  // Insert error codes
  for (const errorCode of errorCodes) {
    await knex("sys_error_codes").insert({
      code: errorCode.code,
      message: errorCode.message,
      severity: errorCode.severity,
      category: errorCode.category,
      description: errorCode.description,
      metadata: errorCode.metadata ? JSON.stringify(errorCode.metadata) : null,
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sys_error_codes");
}
