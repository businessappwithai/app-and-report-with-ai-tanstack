export async function up(db: any): Promise<void> {
  // Error messages configuration table
  await db.schema.createTable("error_messages", (table) => {
    table.string("id", 36).primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
    table.string("error_code", 100).notNullable().unique();
    table.string("severity").defaultTo("error"); // 'error', 'warning', 'info'
    table.string("title").notNullable();
    table.text("message").notNullable();
    table.text("user_message"); // More user-friendly explanation
    table.text("suggestions"); // JSON array of suggestions
    table.text("documentation_url");
    table.boolean("is_active").defaultTo(true);
    table.string("category"); // 'database', 'auth', 'api', 'ui', 'system'
    table.text("metadata"); // JSON for additional config
    table.timestamp("created_at").defaultTo(db.fn.now());
    table.timestamp("updated_at").defaultTo(db.fn.now());
  });

  // Warning configurations table (for proactive warnings)
  await db.schema.createTable("warning_configs", (table) => {
    table.string("id", 36).primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
    table.string("warning_code", 100).notNullable().unique();
    table.string("name").notNullable();
    table.text("description");
    table.string("trigger_type").notNullable(); // 'query_error', 'timeout', 'limit_exceeded', 'connection_failed'
    table.text("trigger_config"); // JSON config for trigger conditions
    table.string("severity").defaultTo("warning"); // 'info', 'warning', 'critical'
    table.text("message_template").notNullable();
    table.text("suggestions_template"); // JSON array of suggestion templates
    table.boolean("is_active").defaultTo(true);
    table.integer("display_duration").defaultTo(5000); // How long to show in ms
    table.boolean("require_dismissal").defaultTo(false);
    table.boolean("enable_auto_resolve").defaultTo(true);
    table.integer("auto_resolve_after").defaultTo(30000); // Auto-dismiss after ms
    table.text("metadata"); // JSON for additional config
    table.timestamp("created_at").defaultTo(db.fn.now());
    table.timestamp("updated_at").defaultTo(db.fn.now());
  });

  // Error occurrence tracking table
  await db.schema.createTable("error_occurrences", (table) => {
    table.string("id", 36).primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
    table.string("error_code", 100).notNullable();
    table.string("user_id", 36).references("id").inTable("users");
    table.text("error_message");
    table.text("stack_trace");
    table.text("component_stack");
    table.string("url");
    table.string("user_agent");
    table.text("context"); // JSON - additional context
    table.boolean("is_reported").defaultTo(false);
    table.boolean("is_resolved").defaultTo(false);
    table.timestamp("resolved_at");
    table.timestamp("created_at").defaultTo(db.fn.now());

    table.index(["error_code", "created_at"]);
    table.index(["user_id", "created_at"]);
    table.index(["is_reported"]);
    table.index(["is_resolved"]);
  });

  // Insert default error messages
  await db("error_messages").insert([
    {
      id: "err_0001",
      error_code: "DATABASE_CONNECTION_FAILED",
      severity: "error",
      title: "Database Connection Failed",
      message: "Unable to connect to the database",
      user_message:
        "We're having trouble connecting to our database. Please check your internet connection and try again.",
      suggestions: JSON.stringify([
        "Check your internet connection",
        "Verify the database server is running",
        "Try refreshing the page",
        "Contact support if the problem persists",
      ]),
      documentation_url: "/docs/errors/database-connection",
      is_active: true,
      category: "database",
      metadata: JSON.stringify({ retry_automatically: true, max_retries: 3 }),
    },
    {
      id: "err_0002",
      error_code: "QUERY_TIMEOUT",
      severity: "warning",
      title: "Query Timeout",
      message: "The query took too long to execute",
      user_message:
        "Your query is taking longer than expected. This might be due to a large dataset or complex joins.",
      suggestions: JSON.stringify([
        "Try adding more filters to reduce the result set",
        "Consider adding indexes to frequently queried columns",
        "Break the query into smaller parts",
        "Contact support for query optimization assistance",
      ]),
      is_active: true,
      category: "database",
      metadata: JSON.stringify({ timeout_threshold: 30000 }),
    },
    {
      id: "err_0003",
      error_code: "AUTHENTICATION_FAILED",
      severity: "error",
      title: "Authentication Failed",
      message: "Invalid credentials provided",
      user_message: "We couldn't sign you in. Please check your email and password.",
      suggestions: JSON.stringify([
        "Verify your email address is correct",
        "Reset your password if you've forgotten it",
        "Check if Caps Lock is on",
        "Contact your administrator if you continue to have issues",
      ]),
      is_active: true,
      category: "auth",
      metadata: JSON.stringify({ max_attempts: 3, lockout_duration: 900000 }),
    },
    {
      id: "err_0004",
      error_code: "DATA_SOURCE_UNAVAILABLE",
      severity: "warning",
      title: "Data Source Unavailable",
      message: "The selected data source is not available",
      user_message:
        "The data source you selected is currently not responding. It may be down for maintenance.",
      suggestions: JSON.stringify([
        "Wait a moment and try again",
        "Check if the data source status is active",
        "Contact your database administrator",
        "Switch to an alternative data source if available",
      ]),
      is_active: true,
      category: "database",
      metadata: JSON.stringify({ retry_after: 5000 }),
    },
    {
      id: "err_0005",
      error_code: "SQL_SYNTAX_ERROR",
      severity: "error",
      title: "SQL Syntax Error",
      message: "The SQL query contains a syntax error",
      user_message:
        "Your SQL query has a syntax error. Please review the error details and correct your query.",
      suggestions: JSON.stringify([
        "Check for missing or extra commas",
        "Verify all parentheses are balanced",
        "Ensure table and column names are correct",
        "Use the Validate button to check syntax before running",
        "Refer to SQL documentation for proper syntax",
      ]),
      is_active: true,
      category: "database",
      metadata: JSON.stringify({ show_line_number: true }),
    },
    {
      id: "err_0006",
      error_code: "INSUFFICIENT_PERMISSIONS",
      severity: "error",
      title: "Insufficient Permissions",
      message: "You don't have permission to perform this action",
      user_message:
        "You don't have the necessary permissions to perform this action. Please contact your administrator.",
      suggestions: JSON.stringify([
        "Verify you are logged in with the correct account",
        "Contact your administrator to request access",
        "Check if your role has the required permissions",
        "Ensure your account is active",
      ]),
      is_active: true,
      category: "auth",
      metadata: JSON.stringify({ require_admin_approval: true }),
    },
    {
      id: "err_0007",
      error_code: "RATE_LIMIT_EXCEEDED",
      severity: "warning",
      title: "Rate Limit Exceeded",
      message: "You have exceeded the rate limit",
      user_message: "You're making requests too quickly. Please slow down and try again later.",
      suggestions: JSON.stringify([
        "Wait a few seconds before trying again",
        "Reduce the frequency of your requests",
        "Consider using batch operations for bulk actions",
        "Contact support to request a higher rate limit",
      ]),
      is_active: true,
      category: "api",
      metadata: JSON.stringify({ limit_per_minute: 60, cooldown_seconds: 60 }),
    },
    {
      id: "err_0008",
      error_code: "FILE_EXPORT_FAILED",
      severity: "error",
      title: "Export Failed",
      message: "Failed to export the file",
      user_message: "We encountered an error while generating your export. Please try again.",
      suggestions: JSON.stringify([
        "Try reducing the amount of data being exported",
        "Check if you have sufficient disk space",
        "Try a different export format",
        "Contact support if the problem persists",
      ]),
      is_active: true,
      category: "system",
      metadata: JSON.stringify({ max_rows: 1000000 }),
    },
    {
      id: "err_0009",
      error_code: "SCHEMA_LOAD_FAILED",
      severity: "warning",
      title: "Schema Loading Failed",
      message: "Failed to load the database schema",
      user_message:
        "We couldn't load the schema for this data source. Some features may be limited.",
      suggestions: JSON.stringify([
        "The data source connection may be unstable",
        "Try reconnecting to the data source",
        "Check if the database user has schema read permissions",
        "Use SQL Editor without autocomplete if this persists",
      ]),
      is_active: true,
      category: "database",
      metadata: JSON.stringify({ fallback_to_basic: true }),
    },
    {
      id: "err_0010",
      error_code: "INVALID_DATA_SOURCE_CONFIG",
      severity: "error",
      title: "Invalid Data Source Configuration",
      message: "The data source configuration is invalid",
      user_message:
        "The data source configuration has errors. Please review and correct the settings.",
      suggestions: JSON.stringify([
        "Verify all required fields are filled",
        "Check that the connection string is correct",
        "Test the connection before saving",
        "Ensure the database type is supported",
        "Contact support for help with configuration",
      ]),
      is_active: true,
      category: "database",
      metadata: JSON.stringify({ require_connection_test: true }),
    },
  ]);

  // Insert default warning configurations
  await db("warning_configs").insert([
    {
      id: "warn_0001",
      warning_code: "LARGE_RESULT_SET",
      name: "Large Result Set Warning",
      description: "Warn users when querying large datasets",
      trigger_type: "query_result_size",
      trigger_config: JSON.stringify({ threshold_rows: 10000, threshold_time_ms: 5000 }),
      severity: "warning",
      message_template:
        "This query returned {row_count} rows and took {duration_ms}ms. Consider adding filters to improve performance.",
      suggestions_template: JSON.stringify([
        "Add WHERE clause to filter results",
        "Use LIMIT to restrict rows",
        "Create an indexed view for frequent queries",
        "Consider exporting data instead of displaying all rows",
      ]),
      is_active: true,
      display_duration: 8000,
      require_dismissal: true,
      enable_auto_resolve: false,
      metadata: JSON.stringify({ show_query_tips: true }),
    },
    {
      id: "warn_0002",
      warning_code: "SLOW_QUERY",
      name: "Slow Query Warning",
      description: "Warn when queries take too long",
      trigger_type: "query_timeout_warning",
      trigger_config: JSON.stringify({ warning_threshold_ms: 10000, critical_threshold_ms: 30000 }),
      severity: "info",
      message_template: "Query is taking longer than expected ({duration_ms}ms). Please wait...",
      suggestions_template: JSON.stringify([
        "Consider running during off-peak hours",
        "Check database server performance",
        "Optimize your query with proper indexes",
        "Use query execution plan to identify bottlenecks",
      ]),
      is_active: true,
      display_duration: 5000,
      require_dismissal: false,
      enable_auto_resolve: true,
      auto_resolve_after: 10000,
      metadata: JSON.stringify({}),
    },
    {
      id: "warn_0003",
      warning_code: "CONNECTION_POOL_FULL",
      name: "Connection Pool Warning",
      description: "Warn when connection pool is near capacity",
      trigger_type: "connection_pool_usage",
      trigger_config: JSON.stringify({
        warning_threshold_percent: 80,
        critical_threshold_percent: 95,
      }),
      severity: "warning",
      message_template:
        "Database connection pool is at {usage_percent}% capacity. Performance may be affected.",
      suggestions_template: JSON.stringify([
        "Close any unused queries or reports",
        "Wait for current operations to complete",
        "Contact administrator to increase pool size",
        "Schedule heavy operations for off-peak hours",
      ]),
      is_active: true,
      display_duration: 10000,
      require_dismissal: true,
      enable_auto_resolve: true,
      auto_resolve_after: 30000,
      metadata: JSON.stringify({ pool_monitoring: true }),
    },
  ]);
}

export async function down(db: any): Promise<void> {
  await db.schema.dropTableIfExists("error_occurrences");
  await db.schema.dropTableIfExists("warning_configs");
  await db.schema.dropTableIfExists("error_messages");
}
