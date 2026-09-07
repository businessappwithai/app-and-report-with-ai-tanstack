import { getDb } from "@/lib/db/config";

export interface ErrorMessage {
  id: string;
  error_code: string;
  severity: "error" | "warning" | "info";
  title: string;
  message: string;
  user_message?: string;
  suggestions?: string[];
  documentation_url?: string;
  is_active: boolean;
  category?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WarningConfig {
  id: string;
  warning_code: string;
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  severity: "info" | "warning" | "critical";
  message_template: string;
  suggestions_template?: string[];
  is_active: boolean;
  display_duration: number;
  require_dismissal: boolean;
  enable_auto_resolve: boolean;
  auto_resolve_after?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ErrorOccurrence {
  id: string;
  error_code: string;
  user_id?: string;
  error_message?: string;
  stack_trace?: string;
  component_stack?: string;
  url?: string;
  user_agent?: string;
  context?: Record<string, unknown>;
  is_reported: boolean;
  is_resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

class ErrorManagementService {
  /**
   * Get error message by error code
   */
  async getErrorMessage(errorCode: string): Promise<ErrorMessage | null> {
    const db = getDb();
    const result = await db
      .selectFrom("error_messages")
      .where("error_code", errorCode)
      .where("is_active", true)
      .selectAll()
      .executeTakeFirst();

    if (result?.suggestions) {
      result.suggestions = JSON.parse(result.suggestions as string);
    }
    if (result?.metadata) {
      result.metadata = JSON.parse(result.metadata as string);
    }

    return result;
  }

  /**
   * Get all active error messages
   */
  async getAllErrorMessages(): Promise<ErrorMessage[]> {
    const db = getDb();
    const results = await db
      .selectFrom("error_messages")
      .where("is_active", true)
      .orderBy("category")
      .orderBy("error_code")
      .selectAll()
      .execute();
    return results.map((msg) => ({
      ...msg,
      suggestions: msg.suggestions ? JSON.parse(msg.suggestions as string) : undefined,
      metadata: msg.metadata ? JSON.parse(msg.metadata as string) : undefined,
    }));
  }

  /**
   * Get error messages by category
   */
  async getErrorMessagesByCategory(category: string): Promise<ErrorMessage[]> {
    const db = getDb();
    const results = await db
      .selectFrom("error_messages")
      .where("category", category)
      .where("is_active", true)
      .orderBy("error_code")
      .selectAll()
      .execute();

    return results.map((msg) => ({
      ...msg,
      suggestions: msg.suggestions ? JSON.parse(msg.suggestions as string) : undefined,
      metadata: msg.metadata ? JSON.parse(msg.metadata as string) : undefined,
    }));
  }

  /**
   * Update error message
   */
  async updateErrorMessage(id: string, updates: Partial<ErrorMessage>): Promise<void> {
    const db = getDb();

    const data: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Serialize JSON fields
    if (updates.suggestions) {
      data.suggestions = JSON.stringify(updates.suggestions);
    }
    if (updates.metadata) {
      data.metadata = JSON.stringify(updates.metadata);
    }

    await db.updateTable("error_messages").where("id", id).set(data).execute();
  }

  /**
   * Create new error message
   */
  async createErrorMessage(
    message: Omit<ErrorMessage, "id" | "created_at" | "updated_at">
  ): Promise<ErrorMessage> {
    const db = getDb();

    const data: Record<string, unknown> = {
      ...message,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Serialize JSON fields
    if (message.suggestions) {
      data.suggestions = JSON.stringify(message.suggestions);
    }
    if (message.metadata) {
      data.metadata = JSON.stringify(message.metadata);
    }

    const result = await db.insertInto("error_messages").values(data).executeTakeFirst();
    const _id = result.insertId as string;

    return this.getErrorMessage(message.error_code) as Promise<ErrorMessage>;
  }

  /**
   * Get warning config by code
   */
  async getWarningConfig(warningCode: string): Promise<WarningConfig | null> {
    const db = getDb();
    const result = await db
      .selectFrom("warning_configs")
      .where("warning_code", warningCode)
      .where("is_active", true)
      .selectAll()
      .executeTakeFirst();

    if (result) {
      if (result.trigger_config) {
        result.trigger_config = JSON.parse(result.trigger_config as string);
      }
      if (result.suggestions_template) {
        result.suggestions_template = JSON.parse(result.suggestions_template as string);
      }
      if (result.metadata) {
        result.metadata = JSON.parse(result.metadata as string);
      }
    }

    return result;
  }

  /**
   * Get all active warning configs
   */
  async getAllWarningConfigs(): Promise<WarningConfig[]> {
    const db = getDb();
    const results = await db
      .selectFrom("warning_configs")
      .where("is_active", true)
      .orderBy("severity", "desc")
      .orderBy("warning_code")
      .selectAll()
      .execute();

    return results.map((config) => ({
      ...config,
      trigger_config: config.trigger_config ? JSON.parse(config.trigger_config as string) : undefined,
      suggestions_template: config.suggestions_template
        ? JSON.parse(config.suggestions_template as string)
        : undefined,
      metadata: config.metadata ? JSON.parse(config.metadata as string) : undefined,
    }));
  }

  /**
   * Format error message with template variables
   */
  formatMessage(template: string, variables: Record<string, unknown>): string {
    let message = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      message = message.replace(new RegExp(placeholder, "g"), String(value));
    }
    return message;
  }

  /**
   * Log error occurrence
   */
  async logErrorOccurrence(
    occurrence: Omit<ErrorOccurrence, "id" | "created_at">
  ): Promise<string> {
    const db = getDb();

    const data = {
      ...occurrence,
      context: occurrence.context ? JSON.stringify(occurrence.context) : null,
      created_at: new Date().toISOString(),
    };

    const result = await db.insertInto("error_occurrences").values(data).executeTakeFirst();

    return String(result.insertId);
  }

  /**
   * Mark error occurrence as reported
   */
  async markErrorAsReported(id: string): Promise<void> {
    const db = getDb();
    await db.updateTable("error_occurrences").where("id", id).set({ is_reported: true }).execute();
  }

  /**
   * Get error statistics
   */
  async getErrorStats(days: number = 30) {
    const db = getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const stats = await db
      .selectFrom("error_occurrences")
      .where("created_at", ">=", cutoffDate.toISOString())
      .select(["error_code", db.fn.countAll().as("count")])
      .groupBy("error_code")
      .orderBy("count", "desc")
      .limit(10)
      .execute();

    return stats.map((stat: { error_code: string; count: number }) => ({
      errorCode: stat.error_code,
      count: Number(stat.count),
    }));
  }

  /**
   * Resolve error occurrence
   */
  async resolveErrorOccurrence(id: string): Promise<void> {
    const db = getDb();
    await db
      .updateTable("error_occurrences")
      .where("id", id)
      .set({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .execute();
  }
}

export const errorManagementService = new ErrorManagementService();
