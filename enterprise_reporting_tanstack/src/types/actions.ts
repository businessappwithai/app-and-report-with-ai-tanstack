/**
 * Comprehensive audit action definitions for the entire application.
 * Every user action must be logged using one of these actions for complete traceability.
 * This is the single source of truth for all trackable actions in the system.
 */

export const AUDIT_ACTIONS = {
  // === AUTHENTICATION ACTIONS ===
  AUTH: {
    LOGIN_ATTEMPT: "auth:login_attempt" as const,
    LOGIN_SUCCESS: "auth:login_success" as const,
    LOGIN_FAILURE: "auth:login_failure" as const,
    LOGOUT: "auth:logout" as const,
    SESSION_CREATED: "auth:session_created" as const,
    SESSION_EXPIRED: "auth:session_expired" as const,
    SESSION_REVOKED: "auth:session_revoked" as const,
    PASSWORD_CHANGED: "auth:password_changed" as const,
    PASSWORD_RESET_REQUESTED: "auth:password_reset_requested" as const,
    PASSWORD_RESET_COMPLETED: "auth:password_reset_completed" as const,
  },

  // === SQL QUERY EXECUTION ===
  SQL: {
    QUERY_EXECUTION_STARTED: "sql:query_execution_started" as const,
    QUERY_EXECUTION_SUCCESS: "sql:query_execution_success" as const,
    QUERY_EXECUTION_FAILED: "sql:query_execution_failed" as const,
    QUERY_VALIDATION_STARTED: "sql:query_validation_started" as const,
    QUERY_VALIDATION_FAILED: "sql:query_validation_failed" as const,
    NON_SELECT_QUERY_REJECTED: "sql:non_select_query_rejected" as const,
    SCHEMA_INTROSPECTION_STARTED: "sql:schema_introspection_started" as const,
    SCHEMA_INTROSPECTION_SUCCESS: "sql:schema_introspection_success" as const,
    SCHEMA_INTROSPECTION_FAILED: "sql:schema_introspection_failed" as const,
  },

  // === SAVED QUERIES ===
  QUERIES: {
    LIST_RETRIEVED: "queries:list_retrieved" as const,
    CREATE_STARTED: "queries:create_started" as const,
    CREATE_SUCCESS: "queries:create_success" as const,
    CREATE_FAILED: "queries:create_failed" as const,
    UPDATE_STARTED: "queries:update_started" as const,
    UPDATE_SUCCESS: "queries:update_success" as const,
    UPDATE_FAILED: "queries:update_failed" as const,
    DELETE_STARTED: "queries:delete_started" as const,
    DELETE_SUCCESS: "queries:delete_success" as const,
    DELETE_FAILED: "queries:delete_failed" as const,
    RETRIEVE_SINGLE: "queries:retrieve_single" as const,
    EXECUTE_SAVED_QUERY: "queries:execute_saved_query" as const,
    VALIDATION_FAILED: "queries:validation_failed" as const,
  },

  // === REPORTS ===
  REPORTS: {
    LIST_RETRIEVED: "reports:list_retrieved" as const,
    CREATE_STARTED: "reports:create_started" as const,
    CREATE_SUCCESS: "reports:create_success" as const,
    CREATE_FAILED: "reports:create_failed" as const,
    UPDATE_STARTED: "reports:update_started" as const,
    UPDATE_SUCCESS: "reports:update_success" as const,
    UPDATE_FAILED: "reports:update_failed" as const,
    DELETE_STARTED: "reports:delete_started" as const,
    DELETE_SUCCESS: "reports:delete_success" as const,
    DELETE_FAILED: "reports:delete_failed" as const,
    RETRIEVE_SINGLE: "reports:retrieve_single" as const,
    GENERATE_STARTED: "reports:generate_started" as const,
    GENERATE_SUCCESS: "reports:generate_success" as const,
    GENERATE_FAILED: "reports:generate_failed" as const,
    EXPORT_STARTED: "reports:export_started" as const,
    EXPORT_SUCCESS: "reports:export_success" as const,
    EXPORT_FAILED: "reports:export_failed" as const,
    SCHEDULE_CREATED: "reports:schedule_created" as const,
    SCHEDULE_DELETED: "reports:schedule_deleted" as const,
  },

  // === DASHBOARDS ===
  DASHBOARDS: {
    LIST_RETRIEVED: "dashboards:list_retrieved" as const,
    CREATE_STARTED: "dashboards:create_started" as const,
    CREATE_SUCCESS: "dashboards:create_success" as const,
    CREATE_FAILED: "dashboards:create_failed" as const,
    UPDATE_STARTED: "dashboards:update_started" as const,
    UPDATE_SUCCESS: "dashboards:update_success" as const,
    UPDATE_FAILED: "dashboards:update_failed" as const,
    DELETE_STARTED: "dashboards:delete_started" as const,
    DELETE_SUCCESS: "dashboards:delete_success" as const,
    DELETE_FAILED: "dashboards:delete_failed" as const,
    RETRIEVE_SINGLE: "dashboards:retrieve_single" as const,
    WIDGET_ADDED: "dashboards:widget_added" as const,
    WIDGET_REMOVED: "dashboards:widget_removed" as const,
    WIDGET_REORDERED: "dashboards:widget_reordered" as const,
    REFRESH_STARTED: "dashboards:refresh_started" as const,
    REFRESH_SUCCESS: "dashboards:refresh_success" as const,
    REFRESH_FAILED: "dashboards:refresh_failed" as const,
  },

  // === CHARTS ===
  CHARTS: {
    LIST_RETRIEVED: "charts:list_retrieved" as const,
    CREATE_STARTED: "charts:create_started" as const,
    CREATE_SUCCESS: "charts:create_success" as const,
    CREATE_FAILED: "charts:create_failed" as const,
    UPDATE_STARTED: "charts:update_started" as const,
    UPDATE_SUCCESS: "charts:update_success" as const,
    UPDATE_FAILED: "charts:update_failed" as const,
    DELETE_STARTED: "charts:delete_started" as const,
    DELETE_SUCCESS: "charts:delete_success" as const,
    DELETE_FAILED: "charts:delete_failed" as const,
    RETRIEVE_SINGLE: "charts:retrieve_single" as const,
    CONFIG_CHANGED: "charts:config_changed" as const,
    DATA_REFRESH_STARTED: "charts:data_refresh_started" as const,
    DATA_REFRESH_SUCCESS: "charts:data_refresh_success" as const,
    DATA_REFRESH_FAILED: "charts:data_refresh_failed" as const,
  },

  // === DATA SOURCES ===
  DATA_SOURCES: {
    LIST_RETRIEVED: "data_sources:list_retrieved" as const,
    CREATE_STARTED: "data_sources:create_started" as const,
    CREATE_SUCCESS: "data_sources:create_success" as const,
    CREATE_FAILED: "data_sources:create_failed" as const,
    UPDATE_STARTED: "data_sources:update_started" as const,
    UPDATE_SUCCESS: "data_sources:update_success" as const,
    UPDATE_FAILED: "data_sources:update_failed" as const,
    DELETE_STARTED: "data_sources:delete_started" as const,
    DELETE_SUCCESS: "data_sources:delete_success" as const,
    DELETE_FAILED: "data_sources:delete_failed" as const,
    TEST_CONNECTION_STARTED: "data_sources:test_connection_started" as const,
    TEST_CONNECTION_SUCCESS: "data_sources:test_connection_success" as const,
    TEST_CONNECTION_FAILED: "data_sources:test_connection_failed" as const,
    CREDENTIALS_UPDATED: "data_sources:credentials_updated" as const,
    CREDENTIALS_ENCRYPTED: "data_sources:credentials_encrypted" as const,
  },

  // === FILTERS ===
  FILTERS: {
    CREATE_STARTED: "filters:create_started" as const,
    CREATE_SUCCESS: "filters:create_success" as const,
    CREATE_FAILED: "filters:create_failed" as const,
    UPDATE_STARTED: "filters:update_started" as const,
    UPDATE_SUCCESS: "filters:update_success" as const,
    UPDATE_FAILED: "filters:update_failed" as const,
    DELETE_STARTED: "filters:delete_started" as const,
    DELETE_SUCCESS: "filters:delete_success" as const,
    DELETE_FAILED: "filters:delete_failed" as const,
    APPLIED: "filters:applied" as const,
    REMOVED: "filters:removed" as const,
  },

  // === JOBS / QUEUE ===
  JOBS: {
    CREATED: "jobs:created" as const,
    STARTED: "jobs:started" as const,
    COMPLETED: "jobs:completed" as const,
    FAILED: "jobs:failed" as const,
    RETRIED: "jobs:retried" as const,
    CANCELLED: "jobs:cancelled" as const,
    PAUSED: "jobs:paused" as const,
    RESUMED: "jobs:resumed" as const,
    QUEUE_CLEARED: "jobs:queue_cleared" as const,
  },

  // === USER MANAGEMENT (ADMIN) ===
  USER_MANAGEMENT: {
    LIST_RETRIEVED: "user_management:list_retrieved" as const,
    CREATE_STARTED: "user_management:create_started" as const,
    CREATE_SUCCESS: "user_management:create_success" as const,
    CREATE_FAILED: "user_management:create_failed" as const,
    UPDATE_STARTED: "user_management:update_started" as const,
    UPDATE_SUCCESS: "user_management:update_success" as const,
    UPDATE_FAILED: "user_management:update_failed" as const,
    DELETE_STARTED: "user_management:delete_started" as const,
    DELETE_SUCCESS: "user_management:delete_success" as const,
    DELETE_FAILED: "user_management:delete_failed" as const,
    ACTIVATE_USER: "user_management:activate_user" as const,
    DEACTIVATE_USER: "user_management:deactivate_user" as const,
    ROLE_ASSIGNED: "user_management:role_assigned" as const,
    ROLE_REMOVED: "user_management:role_removed" as const,
    PERMISSIONS_CHANGED: "user_management:permissions_changed" as const,
  },

  // === ROLE MANAGEMENT (ADMIN) ===
  ROLE_MANAGEMENT: {
    LIST_RETRIEVED: "role_management:list_retrieved" as const,
    CREATE_STARTED: "role_management:create_started" as const,
    CREATE_SUCCESS: "role_management:create_success" as const,
    CREATE_FAILED: "role_management:create_failed" as const,
    UPDATE_STARTED: "role_management:update_started" as const,
    UPDATE_SUCCESS: "role_management:update_success" as const,
    UPDATE_FAILED: "role_management:update_failed" as const,
    DELETE_STARTED: "role_management:delete_started" as const,
    DELETE_SUCCESS: "role_management:delete_success" as const,
    DELETE_FAILED: "role_management:delete_failed" as const,
    PERMISSION_ADDED: "role_management:permission_added" as const,
    PERMISSION_REMOVED: "role_management:permission_removed" as const,
  },

  // === PERMISSIONS / ACCESS CONTROL ===
  PERMISSIONS: {
    CHECK_STARTED: "permissions:check_started" as const,
    CHECK_PASSED: "permissions:check_passed" as const,
    CHECK_FAILED: "permissions:check_failed" as const,
    ACCESS_DENIED: "permissions:access_denied" as const,
    RESOURCE_ACCESS_GRANTED: "permissions:resource_access_granted" as const,
    RESOURCE_ACCESS_DENIED: "permissions:resource_access_denied" as const,
    PERMISSION_REQUIRED: "permissions:permission_required" as const,
    ADMIN_CHECK_FAILED: "permissions:admin_check_failed" as const,
  },

  // === AUDIT & LOGS ===
  AUDIT: {
    LOG_RETRIEVED: "audit:log_retrieved" as const,
    LOG_FILTERED: "audit:log_filtered" as const,
    LOG_EXPORTED: "audit:log_exported" as const,
    AUDIT_TRAIL_VIEWED: "audit:audit_trail_viewed" as const,
  },

  // === SYSTEM ACTIONS ===
  SYSTEM: {
    STARTUP: "system:startup" as const,
    SHUTDOWN: "system:shutdown" as const,
    CONFIGURATION_CHANGED: "system:configuration_changed" as const,
    DATABASE_MIGRATION_STARTED: "system:database_migration_started" as const,
    DATABASE_MIGRATION_SUCCESS: "system:database_migration_success" as const,
    DATABASE_MIGRATION_FAILED: "system:database_migration_failed" as const,
    ERROR_OCCURRED: "system:error_occurred" as const,
    WARNING_TRIGGERED: "system:warning_triggered" as const,
    HEALTH_CHECK_PASSED: "system:health_check_passed" as const,
    HEALTH_CHECK_FAILED: "system:health_check_failed" as const,
  },

  // === SHARING & PUBLIC ACCESS ===
  SHARING: {
    PUBLIC_LINK_CREATED: "sharing:public_link_created" as const,
    PUBLIC_LINK_DELETED: "sharing:public_link_deleted" as const,
    PUBLIC_LINK_ACCESSED: "sharing:public_link_accessed" as const,
    SHARED_WITH_USER: "sharing:shared_with_user" as const,
    UNSHARED_WITH_USER: "sharing:unshared_with_user" as const,
    PERMISSION_LEVEL_CHANGED: "sharing:permission_level_changed" as const,
  },

  // === EMAIL & NOTIFICATIONS ===
  EMAIL: {
    SEND_STARTED: "email:send_started" as const,
    SEND_SUCCESS: "email:send_success" as const,
    SEND_FAILED: "email:send_failed" as const,
    TEMPLATE_USED: "email:template_used" as const,
    BATCH_SEND_STARTED: "email:batch_send_started" as const,
    BATCH_SEND_SUCCESS: "email:batch_send_success" as const,
    BATCH_SEND_FAILED: "email:batch_send_failed" as const,
  },

  // === METADATA ENTITY MANAGEMENT ===
  METADATA: {
    ENTITY_LIST_RETRIEVED: "metadata:entity_list_retrieved" as const,
    ENTITY_CREATE_STARTED: "metadata:entity_create_started" as const,
    ENTITY_CREATE_SUCCESS: "metadata:entity_create_success" as const,
    ENTITY_CREATE_FAILED: "metadata:entity_create_failed" as const,
    ENTITY_UPDATE_STARTED: "metadata:entity_update_started" as const,
    ENTITY_UPDATE_SUCCESS: "metadata:entity_update_success" as const,
    ENTITY_UPDATE_FAILED: "metadata:entity_update_failed" as const,
    ENTITY_DELETE_STARTED: "metadata:entity_delete_started" as const,
    ENTITY_DELETE_SUCCESS: "metadata:entity_delete_success" as const,
    ENTITY_DELETE_FAILED: "metadata:entity_delete_failed" as const,
    FIELD_ADDED: "metadata:field_added" as const,
    FIELD_MODIFIED: "metadata:field_modified" as const,
    FIELD_DELETED: "metadata:field_deleted" as const,
    RELATIONSHIP_CREATED: "metadata:relationship_created" as const,
    RELATIONSHIP_DELETED: "metadata:relationship_deleted" as const,
  },

  // === IMPORT/EXPORT ===
  IMPORT_EXPORT: {
    IMPORT_STARTED: "import_export:import_started" as const,
    IMPORT_SUCCESS: "import_export:import_success" as const,
    IMPORT_FAILED: "import_export:import_failed" as const,
    EXPORT_STARTED: "import_export:export_started" as const,
    EXPORT_SUCCESS: "import_export:export_success" as const,
    EXPORT_FAILED: "import_export:export_failed" as const,
    FORMAT_CONVERSION: "import_export:format_conversion" as const,
  },

  // === MONITORING & ADK ===
  MONITORING: {
    RULE_CREATED: "monitoring:rule_created" as const,
    RULE_UPDATED: "monitoring:rule_updated" as const,
    RULE_DELETED: "monitoring:rule_deleted" as const,
    RULE_PAUSED: "monitoring:rule_paused" as const,
    RULE_RESUMED: "monitoring:rule_resumed" as const,
    RULE_EXECUTED: "monitoring:rule_executed" as const,
    BREACH_DETECTED: "monitoring:breach_detected" as const,
    ESCALATION_DETECTED: "monitoring:escalation_detected" as const,
    ALERT_DISPATCHED: "monitoring:alert_dispatched" as const,
    NO_DATA: "monitoring:no_data" as const,
    RBAC_DRIFT_DETECTED: "monitoring:rbac_drift_detected" as const,
    RBAC_REVOKED: "monitoring:rbac_revoked" as const,
  },

  // === ADK PIPELINE ===
  ADK: {
    INTENT_RECEIVED: "adk:intent_received" as const,
    INTENT_CLASSIFIED: "adk:intent_classified" as const,
    PIPELINE_STARTED: "adk:pipeline_started" as const,
    PIPELINE_COMPLETED: "adk:pipeline_completed" as const,
    PIPELINE_FAILED: "adk:pipeline_failed" as const,
    SCHEMA_INTROSPECTED: "adk:schema_introspected" as const,
    SQL_GENERATED: "adk:sql_generated" as const,
    RULE_PERSISTED: "adk:rule_persisted" as const,
    CLARIFICATION_REQUESTED: "adk:clarification_requested" as const,
  },
} as const;

/**
 * Audit action types - Union of all possible actions
 */
export type AuditAction = {
  [K in keyof typeof AUDIT_ACTIONS]: (typeof AUDIT_ACTIONS)[K][keyof (typeof AUDIT_ACTIONS)[K]];
}[keyof typeof AUDIT_ACTIONS];

/**
 * Get all available actions flattened for reference
 */
export function getAllActions(): readonly AuditAction[] {
  const actions: AuditAction[] = [];

  for (const category of Object.values(AUDIT_ACTIONS)) {
    for (const action of Object.values(category)) {
      actions.push(action);
    }
  }

  return actions;
}

/**
 * Check if a string is a valid action
 */
export function isValidAction(action: string): action is AuditAction {
  const allActions = getAllActions();
  return allActions.includes(action as AuditAction);
}
