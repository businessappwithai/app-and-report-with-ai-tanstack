import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // adk_intents — stores parsed NL intent pipeline results
  await sql`
    CREATE TABLE IF NOT EXISTS adk_intents (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      session_id VARCHAR(255),
      raw_nl_request LONGTEXT NOT NULL,
      request_source VARCHAR(20) DEFAULT 'text',
      intent_type VARCHAR(50) NOT NULL,
      confidence DECIMAL(4,3),
      adk_intent_json LONGTEXT NOT NULL,
      pipeline_status VARCHAR(20) DEFAULT 'pending',
      report_definition_id VARCHAR(255),
      monitoring_rule_id VARCHAR(255),
      error_message TEXT,
      classification_ms INT,
      total_pipeline_ms INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_adk_user_id (user_id),
      INDEX idx_adk_created_at (created_at),
      INDEX idx_adk_intent_type (intent_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  // monitoring_rules — the persisted monitoring rules
  await sql`
    CREATE TABLE IF NOT EXISTS monitoring_rules (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      report_definition_id VARCHAR(255) NOT NULL,
      job_definition_id VARCHAR(255),
      data_source_id VARCHAR(255) NOT NULL,
      created_by VARCHAR(255) NOT NULL,
      metric_column VARCHAR(255) NOT NULL,
      threshold_operator VARCHAR(20) NOT NULL,
      threshold_value DECIMAL(20,4) NOT NULL,
      threshold_upper_bound DECIMAL(20,4),
      escalation_threshold_pct DECIMAL(5,2) DEFAULT 20.0,
      cron_expression VARCHAR(100) NOT NULL,
      timezone VARCHAR(64) DEFAULT 'UTC',
      trigger_schedule_id VARCHAR(255),
      alert_channels LONGTEXT NOT NULL,
      alert_recipients LONGTEXT NOT NULL,
      webhook_url VARCHAR(500),
      notify_on_pass BOOLEAN DEFAULT FALSE,
      notify_on_no_data BOOLEAN DEFAULT TRUE,
      rbac_snapshot LONGTEXT NOT NULL,
      rbac_snapshot_version INT DEFAULT 1,
      is_active BOOLEAN DEFAULT TRUE,
      is_paused BOOLEAN DEFAULT FALSE,
      pause_reason TEXT,
      original_nl_request LONGTEXT,
      adk_intent_id VARCHAR(255),
      last_executed_at DATETIME,
      last_execution_status VARCHAR(20),
      last_metric_value DECIMAL(20,4),
      consecutive_breaches INT DEFAULT 0,
      total_executions INT DEFAULT 0,
      total_alerts_sent INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_mr_created_by (created_by),
      INDEX idx_mr_data_source_id (data_source_id),
      INDEX idx_mr_is_active (is_active),
      INDEX idx_mr_last_executed (last_executed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  // monitoring_executions — per-run execution records
  await sql`
    CREATE TABLE IF NOT EXISTS monitoring_executions (
      id VARCHAR(255) PRIMARY KEY,
      monitoring_rule_id VARCHAR(255) NOT NULL,
      job_execution_id VARCHAR(255),
      executed_at DATETIME NOT NULL,
      execution_ms INT,
      rows_returned INT,
      sql_executed LONGTEXT,
      metric_value DECIMAL(20,4),
      previous_metric_value DECIMAL(20,4),
      delta_pct DECIMAL(8,4),
      evaluation_status VARCHAR(20) NOT NULL,
      evaluation_detail TEXT,
      alert_dispatched BOOLEAN DEFAULT FALSE,
      alert_channels_used LONGTEXT,
      alert_recipients_sent LONGTEXT,
      alert_sent_at DATETIME,
      error_message TEXT,
      error_phase VARCHAR(30),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_me_rule_id (monitoring_rule_id),
      INDEX idx_me_executed_at (executed_at),
      INDEX idx_me_status (evaluation_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS monitoring_executions`.execute(db);
  await sql`DROP TABLE IF EXISTS monitoring_rules`.execute(db);
  await sql`DROP TABLE IF EXISTS adk_intents`.execute(db);
}
