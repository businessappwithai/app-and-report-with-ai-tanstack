export const AuditAction = {
  // Authentication
  AUTH_LOGIN: "AUTH_LOGIN",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  AUTH_LOGIN_FAILED: "AUTH_LOGIN_FAILED",
  AUTH_PASSWORD_RESET: "AUTH_PASSWORD_RESET",
  AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",

  // Business entity
  ENTITY_CREATE: "ENTITY_CREATE",
  ENTITY_UPDATE: "ENTITY_UPDATE",
  ENTITY_DELETE: "ENTITY_DELETE",
  ENTITY_BULK_CREATE: "ENTITY_BULK_CREATE",

  // System dictionary
  SYS_FIELD_UPDATE: "SYS_FIELD_UPDATE",
  SYS_FIELD_GROUP_CHANGE: "SYS_FIELD_GROUP_CHANGE",
  SYS_TABLE_CHANGE: "SYS_TABLE_CHANGE",
  SYS_WINDOW_CHANGE: "SYS_WINDOW_CHANGE",

  // AI agent
  AI_SQL_GENERATED: "AI_SQL_GENERATED",
  AI_SQL_EXECUTED: "AI_SQL_EXECUTED",
  AI_REPORT_GENERATED: "AI_REPORT_GENERATED",
  AI_WORKFLOW_APPROVED: "AI_WORKFLOW_APPROVED",
  AI_WORKFLOW_REJECTED: "AI_WORKFLOW_REJECTED",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export type AuditSource = "WEB_UI" | "API" | "AGENT" | "SYSTEM";

export interface AuditEvent {
  id?: string;
  immudb_key?: string;
  timestamp?: string;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  session_id?: string | null;
  action: AuditActionType | string;
  entity_type?: string | null;
  entity_id?: string | null;
  before_value?: Record<string, unknown> | null;
  after_value?: Record<string, unknown> | null;
  changed_fields?: string[];
  ip_address?: string | null;
  user_agent?: string | null;
  source?: AuditSource;
  request_id?: string | null;
  correlation_id?: string | null;
  success?: boolean;
  error_message?: string | null;
}

export interface AuditSearchParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  user_id?: string;
  user_email?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  source?: AuditSource;
  success?: boolean;
  search?: string;
}

/** Fields whose values are masked before storage. */
export const SENSITIVE_FIELDS = new Set([
  "password",
  "password_hash",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "secret",
  "private_key",
  "credit_card",
  "card_number",
  "cvv",
  "ssn",
  "national_id",
]);

export function maskSensitive(
  obj: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!obj) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_FIELDS.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): string[] {
  if (!before || !after) return [];
  return Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}
