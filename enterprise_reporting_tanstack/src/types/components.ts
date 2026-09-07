/**
 * Central definition of all logging components used throughout the application.
 * Use these constants instead of hardcoding component names in logger calls.
 * Ensures consistency and makes it easy to track all components in one place.
 */

export const LOG_COMPONENTS = {
  // Authentication & Session
  Authentication: "Authentication",

  // SQL Editor & Execution
  SQL_EDITOR: "SQL Editor",
  SQL_EXECUTOR: "SQL Executor",

  // Query Management
  SAVED_QUERIES_API: "Saved Queries API",

  // Reports
  REPORTS_API: "Reports API",

  // Charts
  CHARTS_API: "Charts API",

  // Dashboards
  DASHBOARDS_API: "Dashboards API",

  // Data Sources
  DATA_SOURCES_API: "Data Sources API",

  // Jobs & Queue
  JOBS_API: "Jobs API",
  JOB_WORKER: "Job Worker",
  QUEUE_MANAGER: "Queue Manager",

  // Audit & Logging
  AUDIT_LOG: "Audit Log",
  SECURITY: "Security",

  // Admin
  ADMIN_API: "Admin API",
  USER_MANAGEMENT: "User Management",
  ROLE_MANAGEMENT: "Role Management",
  PERMISSIONS: "Permissions",

  // Filters
  FILTERS_API: "Filters API",

  // Email & Notifications
  EMAIL_SERVICE: "Email Service",
  NOTIFICATIONS: "Notifications",

  // Metadata Services
  METADATA_SERVICE: "Metadata Service",
  ENTITY_SERVICE: "Entity Service",
  FIELD_SERVICE: "Field Service",

  // AI & NL Query
  NL_QUERY_API: "NL Query API",
  MASTRA_AI: "Mastra AI",

  // Database & Migrations
  DATABASE: "Database",
  MIGRATIONS: "Migrations",

  // Configuration
  CONFIG: "Configuration",

  // Error Handling
  ERROR_HANDLER: "Error Handler",

  // Generic/System
  SYSTEM: "System",
  SERVER: "Server",
  CLIENT: "Client",
} as const;

// Type for ensuring component values are from the defined set
export type LogComponent = (typeof LOG_COMPONENTS)[keyof typeof LOG_COMPONENTS];
