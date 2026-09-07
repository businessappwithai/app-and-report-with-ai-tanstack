import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Use nl_report_definitions to avoid collision with existing report_definitions table
  await sql`
    CREATE TABLE IF NOT EXISTS nl_report_definitions (
      id                  VARCHAR(255) NOT NULL PRIMARY KEY,
      title               VARCHAR(255) NOT NULL,
      created_by          VARCHAR(255) NOT NULL,
      data_source_id      VARCHAR(255) NOT NULL,
      nl_query            TEXT         NOT NULL,
      generated_sql       TEXT         NOT NULL,
      metric_columns      LONGTEXT     NOT NULL,
      dimension_columns   LONGTEXT     NOT NULL,
      filter_config       LONGTEXT     NULL,
      date_range_from     DATE         NULL,
      date_range_to       DATE         NULL,
      chart_type          VARCHAR(20)  NOT NULL DEFAULT 'bar',
      output_formats      LONGTEXT     NOT NULL,
      recipient_config    LONGTEXT     NOT NULL,
      schedule_cron       VARCHAR(100) NULL,
      schedule_timezone   VARCHAR(64)  NOT NULL DEFAULT 'UTC',
      schedule_enabled    TINYINT(1)   NOT NULL DEFAULT 0,
      rbac_snapshot       LONGTEXT     NOT NULL,
      rbac_snapshot_version INT        DEFAULT 1,
      last_run_at         DATETIME     NULL,
      last_run_status     VARCHAR(20)  NULL,
      created_at          DATETIME     DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_nlrd_created_by (created_by),
      INDEX idx_nlrd_data_source (data_source_id),
      INDEX idx_nlrd_created_at (created_at),
      INDEX idx_nlrd_schedule (schedule_enabled, schedule_cron)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS generated_report_artifacts (
      id                    VARCHAR(255)  NOT NULL PRIMARY KEY,
      report_definition_id  VARCHAR(255)  NOT NULL,
      execution_id          VARCHAR(255)  NOT NULL,
      created_by            VARCHAR(255)  NOT NULL,
      format                VARCHAR(10)   NOT NULL,
      file_path             VARCHAR(500)  NOT NULL,
      file_size_bytes       BIGINT        NULL,
      row_count             INT           NULL,
      chart_type            VARCHAR(20)   NULL,
      execution_ms          INT           NULL,
      status                VARCHAR(20)   NOT NULL DEFAULT 'complete',
      error_message         TEXT          NULL,
      triggered_by          VARCHAR(20)   NOT NULL DEFAULT 'manual',
      sql_executed          TEXT          NULL,
      created_at            DATETIME      DEFAULT CURRENT_TIMESTAMP,

      INDEX idx_gra_definition (report_definition_id, created_at DESC),
      INDEX idx_gra_user (created_by, created_at DESC),
      INDEX idx_gra_execution (execution_id),

      CONSTRAINT fk_gra_def FOREIGN KEY (report_definition_id)
        REFERENCES nl_report_definitions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS generated_report_artifacts`.execute(db);
  await sql`DROP TABLE IF EXISTS nl_report_definitions`.execute(db);
}
