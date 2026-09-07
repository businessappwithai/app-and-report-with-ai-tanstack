import type { AlertChannel, ThresholdOperator } from "@/types/monitoring";

export type ADKIntentType = "monitoring_rule" | "report_generate" | "alert_create" | "ambiguous";
export type ADKIntentStatus =
  | "pending"
  | "classifying"
  | "clarification_needed"
  | "success"
  | "failed";

export interface ADKIntent {
  id: string;
  userId: string;
  rawRequest: string;
  intentType: ADKIntentType;
  confidence: number;
  status: ADKIntentStatus;
  metric?: string;
  dataHint?: string;
  timeWindow?: TimeWindow;
  scheduleNatural?: string;
  scheduleCron?: string;
  thresholdOperator?: ThresholdOperator;
  thresholdValue?: number;
  thresholdUpperBound?: number;
  alertChannels?: AlertChannel[];
  recipients?: string[];
  dataSourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeWindow {
  unit: "hour" | "day" | "week" | "month" | "quarter" | "year";
  value: number;
  description: string;
}

export interface ScheduleIntent {
  natural: string;
  cron: string;
  timezone: string;
  description: string;
}

export interface ThresholdIntent {
  operator: ThresholdOperator;
  value: number;
  upperBound?: number;
  currency?: string;
  unit?: string;
  percentageChange?: boolean;
}

export interface ADKPreview {
  name: string;
  description: string;
  sql: string;
  metricColumn: string;
  thresholdOperator: string;
  thresholdValue: number;
  thresholdUpperBound?: number;
  escalationThresholdPct: number;
  cronExpression: string;
  timezone: string;
  scheduleDescription: string;
  alertChannels: string[];
  notifyOnPass: boolean;
  notifyOnNoData: boolean;
}

export interface ADKPipelineResult {
  success: boolean;
  intentId?: string;
  reportDefinitionId?: string;
  monitoringRuleId?: string;
  jobDefinitionId?: string;
  nextRunAt?: string;
  adkIntent?: ADKIntent;
  preview?: ADKPreview;
  error?: string;
  clarificationNeeded?: boolean;
  clarificationPrompt?: string;
}

export interface ADKStoredIntent {
  id: string;
  user_id: string;
  session_id?: string;
  raw_nl_request: string;
  request_source: "text" | "voice";
  intent_type: string;
  confidence?: number;
  adk_intent_json: ADKIntent;
  pipeline_status: "pending" | "success" | "failed" | "partial";
  report_definition_id?: string;
  monitoring_rule_id?: string;
  error_message?: string;
  classification_ms?: number;
  total_pipeline_ms?: number;
  created_at: string;
}
