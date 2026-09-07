/**
 * Migration: NL Query Context Storage with pgvector
 *
 * Stores successful NL→SQL translations with pgvector embeddings
 * Enables context-aware query generation based on similar successful queries
 *
 * Tables:
 * 1. nl_query_context - Stores successful queries with metadata
 * 2. nl_query_role_stats - Tracks query success rate per role
 */

export async function up(db: any): Promise<void> {
  // ========================================================================
  // 1. Create nl_query_context table for successful NL queries
  // ========================================================================
  await db.schema.createTable("nl_query_context", (table) => {
    table.string("id", 36).primary();

    // Query identification
    table.string("data_source_id", 36).notNullable();
    table.string("user_id", 36).notNullable();
    table.string("role_name").notNullable(); // User's primary role when query was executed

    // Natural language and generated SQL
    table.text("nl_question").notNullable(); // Original user question
    table.text("generated_sql").notNullable(); // The SQL we generated
    table.text("nl_question_embedding"); // JSON array: embedding vector for similarity search

    // Execution context
    table.text("schema_context").notNullable(); // JSON: tables, columns, field descriptions
    table.text("rbac_context").notNullable(); // JSON: user roles, permissions at query time
    table.text("field_instructions"); // JSON: schema field hints that were provided

    // Execution metadata
    table.integer("execution_time_ms").defaultTo(0); // How long query took
    table.integer("row_count").defaultTo(0); // Rows returned
    table.boolean("was_successful").defaultTo(true); // Did query execute without error?
    table.text("error_message"); // If failed, what was the error?

    // Confidence scores
    table.decimal("translation_confidence", 3, 2).defaultTo(1.0); // 0.0 to 1.0
    table.decimal("llm_confidence", 3, 2).defaultTo(1.0); // LLM's confidence in translation

    // Query characteristics (for better matching)
    table.string("query_type").defaultTo("SELECT"); // SELECT, JOIN, AGGREGATE, etc.
    table.integer("table_count").defaultTo(1); // Number of tables in query
    table.integer("join_count").defaultTo(0); // Number of joins
    table.boolean("has_aggregation").defaultTo(false); // GROUP BY, aggregate functions?
    table.boolean("has_window_function").defaultTo(false); // Window functions?

    // Audit trail
    table.string("created_by", 36).references("id").inTable("users");
    table.timestamp("created_at").defaultTo(db.fn.now());

    // Indexes for performance
    table.index(["data_source_id", "role_name"]);
    table.index(["user_id", "created_at"]);
    table.index(["was_successful", "role_name"]);
  });

  // Create vector similarity index (PostgreSQL pgvector)
  try {
    await db.raw.execute(
      `CREATE INDEX idx_nl_query_context_embedding
       ON nl_query_context USING ivfflat (nl_question_embedding vector_cosine_ops)
       WHERE nl_question_embedding IS NOT NULL`
    );
  } catch {
    // pgvector may not be available
    console.log("pgvector index not created - pgvector extension may not be available");
  }

  // ========================================================================
  // 2. Create nl_query_role_stats table for tracking role-based performance
  // ========================================================================
  await db.schema.createTable("nl_query_role_stats", (table) => {
    table.string("id", 36).primary();

    // Role identification
    table.string("role_name").notNullable();
    table.string("data_source_id", 36).notNullable();

    // Statistics
    table.integer("total_queries").defaultTo(0); // Total NL queries attempted
    table.integer("successful_queries").defaultTo(0); // How many succeeded
    table.integer("failed_queries").defaultTo(0); // How many failed
    table.decimal("success_rate", 5, 2).defaultTo(0.0); // Percentage

    // Performance metrics
    table.decimal("avg_execution_time_ms", 10, 2).defaultTo(0);
    table.decimal("avg_rows_returned", 10, 2).defaultTo(0);
    table.decimal("avg_confidence", 3, 2).defaultTo(0); // Average translation confidence

    // Most common query patterns
    table.text("common_query_types"); // JSON: frequency map of query types
    table.text("common_tables"); // JSON: tables most frequently queried
    table.text("common_joins"); // JSON: join patterns

    // Last updated
    table.timestamp("updated_at").defaultTo(db.fn.now());

    // Unique constraint
    table.unique(["role_name", "data_source_id"]);
  });

  // ========================================================================
  // 3. Create nl_query_feedback table for improving accuracy
  // ========================================================================
  await db.schema.createTable("nl_query_feedback", (table) => {
    table.string("id", 36).primary();

    // Reference to query
    table
      .string("nl_query_context_id", 36)
      .notNullable()
      .references("id")
      .inTable("nl_query_context");

    // Feedback
    table.enum("feedback_type", [
      "accurate",
      "needs_refinement",
      "incorrect",
      "wrong_interpretation",
    ]);
    table.text("user_feedback"); // User's comment on the generated query
    table.text("corrected_sql"); // If user provided a correct version

    // Metadata
    table.string("feedback_by", 36).references("id").inTable("users");
    table.timestamp("created_at").defaultTo(db.fn.now());

    table.index(["nl_query_context_id"]);
    table.index(["feedback_type"]);
  });
}

export async function down(db: any): Promise<void> {
  // Drop in reverse order
  await db.schema.dropTableIfExists("nl_query_feedback");
  await db.schema.dropTableIfExists("nl_query_role_stats");

  // Drop vector index first if it exists
  try {
    await db.raw.execute(`DROP INDEX IF EXISTS idx_nl_query_context_embedding`);
  } catch {
    // Ignore if index doesn't exist
  }

  await db.schema.dropTableIfExists("nl_query_context");
}
