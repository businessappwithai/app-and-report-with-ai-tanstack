import { sendEmail } from "@/lib/email/email-service";
import { createNotification } from "@/lib/notifications";
import { getDb } from "@/lib/db/config";
import type {
  MonitoringRule,
  AlertRecipient,
  AlertDispatchResult,
  AlertChannel,
  ThresholdEvaluation,
} from "@/types/monitoring";

// ---------------------------------------------------------------------------
// SSRF-safe webhook URL validation
// ---------------------------------------------------------------------------

/**
 * Returns true when the URL is safe to POST to (i.e. not an RFC-1918 private
 * address, loopback, or link-local range).
 *
 * Blocked ranges:
 *   - 127.0.0.0/8  (loopback)
 *   - 10.0.0.0/8
 *   - 172.16.0.0/12  (172.16.x.x – 172.31.x.x)
 *   - 192.168.0.0/16
 *   - 169.254.0.0/16 (link-local)
 *   - "localhost" hostname
 */
export function validateWebhookUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Only allow https (and http in non-production)
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost by name
  if (hostname === "localhost" || hostname === "::1") {
    return false;
  }

  // For IP addresses, parse the octets and check RFC-1918 / loopback ranges
  // IPv6 addresses (other than ::1) are passed through — further IPv6 SSRF
  // hardening can be added here as needed.
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  if (match) {
    const [, a, b, c] = match.map(Number);

    if (a === 127) return false; // 127.0.0.0/8
    if (a === 10) return false; // 10.0.0.0/8
    if (a === 169 && b === 254) return false; // 169.254.0.0/16
    if (a === 192 && b === 168) return false; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
  }

  return true;
}

// ---------------------------------------------------------------------------
// Recipient resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a list of AlertRecipient entries into email address strings.
 * Handles both direct user IDs and role IDs (all users with that role).
 */
export async function resolveEmailRecipients(recipients: AlertRecipient[]): Promise<string[]> {
  if (recipients.length === 0) return [];

  const db = getDb();
  const emails = new Set<string>();

  const userRecipients = recipients.filter((r) => r.type === "user");
  const roleRecipients = recipients.filter((r) => r.type === "role");

  // Resolve direct user recipients
  if (userRecipients.length > 0) {
    const userIds = userRecipients.map((r) => r.id);
    const users = await db
      .selectFrom("users")
      .where("id", "in", userIds)
      .where("is_active", "=", true)
      .select(["email"])
      .execute();

    for (const user of users) {
      if ((user as unknown as { email: string }).email) {
        emails.add((user as unknown as { email: string }).email);
      }
    }

    // Also honour inline email addresses (e.g. from external alert recipients)
    for (const r of userRecipients) {
      if (r.email) emails.add(r.email);
    }
  }

  // Resolve role recipients: fetch all active users who hold the given roles
  if (roleRecipients.length > 0) {
    const roleIds = roleRecipients.map((r) => r.id);

    const usersInRoles = await db
      .selectFrom("user_roles")
      .innerJoin("users", "user_roles.user_id", "users.id")
      .where("user_roles.role_id", "in", roleIds)
      .where("users.is_active", "=", true)
      .select(["users.email"])
      .execute();

    for (const row of usersInRoles) {
      if ((row as unknown as { email: string }).email) {
        emails.add((row as unknown as { email: string }).email);
      }
    }
  }

  return Array.from(emails);
}

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------

/**
 * Build a professional alert email including a severity badge and breach
 * details suitable for monitoring notifications.
 */
export function renderAlertMessage(
  rule: MonitoringRule,
  evaluation: ThresholdEvaluation,
  executionId: string
): { subject: string; htmlBody: string; textBody: string } {
  const severity = evaluation.breachSeverity ?? "WARNING";
  const statusLabel = evaluation.status;

  const severityColor = severity === "CRITICAL" ? "#dc2626" : "#d97706";
  const severityBg = severity === "CRITICAL" ? "#fee2e2" : "#fef3c7";
  const statusColor =
    evaluation.status === "PASS"
      ? "#059669"
      : evaluation.status === "ESCALATE"
        ? "#dc2626"
        : "#d97706";

  const operatorLabel: Record<string, string> = {
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
    eq: "=",
    neq: "≠",
    between: "between",
  };

  const thresholdDisplay =
    rule.threshold_operator === "between"
      ? `${rule.threshold_value} and ${rule.threshold_upper_bound}`
      : `${operatorLabel[rule.threshold_operator] ?? rule.threshold_operator} ${rule.threshold_value}`;

  const deltaLine =
    evaluation.deltaFromPrevious !== undefined && Number.isFinite(evaluation.deltaFromPrevious)
      ? `<tr>
            <td style="padding:8px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb">Change from previous</td>
            <td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #e5e7eb">${
              evaluation.deltaFromPrevious >= 0 ? "+" : ""
            }${evaluation.deltaFromPrevious.toFixed(2)}%</td>
          </tr>`
      : "";

  const subject = `[${statusLabel}] Monitoring Alert: ${rule.name} — ${severity}`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:${severityColor};padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Monitoring Alert</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${rule.name}</p>
            </td>
          </tr>

          <!-- Severity badge -->
          <tr>
            <td style="padding:24px 32px 0;">
              <span style="display:inline-block;padding:6px 16px;border-radius:9999px;background:${severityBg};color:${severityColor};font-weight:700;font-size:13px;letter-spacing:0.5px;">
                ${severity}
              </span>
              &nbsp;
              <span style="display:inline-block;padding:6px 16px;border-radius:9999px;background:#e0e7ff;color:#4338ca;font-weight:700;font-size:13px;letter-spacing:0.5px;">
                ${statusLabel}
              </span>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:16px 32px;">
              <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">${evaluation.message}</p>
            </td>
          </tr>

          <!-- Metric details table -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;font-size:14px;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Field</th>
                    <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:8px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Rule</td>
                    <td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #e5e7eb;">${rule.name}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Metric column</td>
                    <td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #e5e7eb;font-family:monospace;">${rule.metric_column}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Actual value</td>
                    <td style="padding:8px 12px;font-weight:700;color:${statusColor};border-bottom:1px solid #e5e7eb;">${
                      evaluation.actualValue !== null ? evaluation.actualValue : "N/A"
                    }</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Threshold</td>
                    <td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #e5e7eb;">${thresholdDisplay}</td>
                  </tr>
                  ${deltaLine}
                  <tr>
                    <td style="padding:8px 12px;color:#6b7280;">Execution ID</td>
                    <td style="padding:8px 12px;font-family:monospace;font-size:12px;">${executionId}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                This is an automated alert from the Enterprise Reporting monitoring system.
                Execution ID: ${executionId} &middot; ${new Date().toUTCString()}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textBody = [
    `MONITORING ALERT: ${rule.name}`,
    `Status: ${statusLabel} | Severity: ${severity}`,
    ``,
    evaluation.message,
    ``,
    `Metric column : ${rule.metric_column}`,
    `Actual value  : ${evaluation.actualValue !== null ? evaluation.actualValue : "N/A"}`,
    `Threshold     : ${thresholdDisplay}`,
    evaluation.deltaFromPrevious !== undefined && Number.isFinite(evaluation.deltaFromPrevious)
      ? `Change        : ${evaluation.deltaFromPrevious >= 0 ? "+" : ""}${evaluation.deltaFromPrevious.toFixed(2)}%`
      : null,
    `Execution ID  : ${executionId}`,
    `Timestamp     : ${new Date().toUTCString()}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, htmlBody, textBody };
}

// ---------------------------------------------------------------------------
// Alert dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatch alerts across all configured channels for a monitoring rule.
 * Returns one AlertDispatchResult per channel attempted.
 */
export async function dispatchAlerts(
  rule: MonitoringRule,
  evaluation: ThresholdEvaluation,
  rows: Record<string, unknown>[],
  executionId: string
): Promise<AlertDispatchResult[]> {
  const results: AlertDispatchResult[] = [];
  const { subject, htmlBody, textBody } = renderAlertMessage(rule, evaluation, executionId);

  for (const channel of rule.alert_channels) {
    switch (channel) {
      case "email": {
        results.push(await dispatchEmailChannel(rule, subject, htmlBody, executionId));
        break;
      }
      case "in_app": {
        results.push(await dispatchInAppChannel(rule, evaluation, executionId));
        break;
      }
      case "webhook": {
        results.push(await dispatchWebhookChannel(rule, evaluation, rows, executionId));
        break;
      }
      default: {
        const _exhaustive: never = channel;
        results.push({
          channel: channel as AlertChannel,
          success: false,
          recipientCount: 0,
          error: `Unknown alert channel: ${String(_exhaustive)}`,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Per-channel dispatch helpers
// ---------------------------------------------------------------------------

async function dispatchEmailChannel(
  rule: MonitoringRule,
  subject: string,
  htmlBody: string,
  executionId: string
): Promise<AlertDispatchResult> {
  let emails: string[] = [];
  try {
    emails = await resolveEmailRecipients(rule.alert_recipients);
  } catch (err) {
    return {
      channel: "email",
      success: false,
      recipientCount: 0,
      error: `Failed to resolve email recipients: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (emails.length === 0) {
    return {
      channel: "email",
      success: false,
      recipientCount: 0,
      error: "No email recipients resolved.",
    };
  }

  try {
    const result = await sendEmail(
      emails,
      { subject, htmlBody },
      {
        ruleName: rule.name,
        executionId,
        metricColumn: rule.metric_column,
      }
    );

    return {
      channel: "email",
      success: result.success,
      messageId: result.messageId,
      recipientCount: emails.length,
      error: result.error,
    };
  } catch (err) {
    return {
      channel: "email",
      success: false,
      recipientCount: emails.length,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function dispatchInAppChannel(
  rule: MonitoringRule,
  evaluation: ThresholdEvaluation,
  executionId: string
): Promise<AlertDispatchResult> {
  // Collect user IDs to notify (direct users and role-resolved users)
  let userIds: string[] = [];
  try {
    userIds = await resolveUserIds(rule.alert_recipients);
  } catch (err) {
    return {
      channel: "in_app",
      success: false,
      recipientCount: 0,
      error: `Failed to resolve user IDs: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (userIds.length === 0) {
    return {
      channel: "in_app",
      success: false,
      recipientCount: 0,
      error: "No in-app notification recipients resolved.",
    };
  }

  const severity = evaluation.breachSeverity ?? "WARNING";
  const notifType = severity === "CRITICAL" ? "error" : "warning";
  const title = `Monitoring Alert: ${rule.name}`;
  const message = evaluation.message;

  let successCount = 0;
  const errors: string[] = [];

  await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        await createNotification({
          userId,
          type: notifType,
          title,
          message,
          metadata: {
            ruleId: rule.id,
            executionId,
            status: evaluation.status,
            severity,
            actualValue: evaluation.actualValue,
            thresholdValue: evaluation.thresholdValue,
            operator: evaluation.operator,
          },
        });
        successCount++;
      } catch (err) {
        errors.push(`User ${userId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  return {
    channel: "in_app",
    success: successCount > 0,
    recipientCount: successCount,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

async function dispatchWebhookChannel(
  rule: MonitoringRule,
  evaluation: ThresholdEvaluation,
  rows: Record<string, unknown>[],
  executionId: string
): Promise<AlertDispatchResult> {
  if (!rule.webhook_url) {
    return {
      channel: "webhook",
      success: false,
      recipientCount: 0,
      error: "No webhook_url configured on rule.",
    };
  }

  if (!validateWebhookUrl(rule.webhook_url)) {
    return {
      channel: "webhook",
      success: false,
      recipientCount: 0,
      error: `Webhook URL '${rule.webhook_url}' failed SSRF validation and was blocked.`,
    };
  }

  const payload = {
    event: "monitoring_alert",
    executionId,
    rule: {
      id: rule.id,
      name: rule.name,
      metricColumn: rule.metric_column,
      dataSourceId: rule.data_source_id,
    },
    evaluation: {
      status: evaluation.status,
      actualValue: evaluation.actualValue,
      thresholdValue: evaluation.thresholdValue,
      operator: evaluation.operator,
      breachSeverity: evaluation.breachSeverity,
      deltaFromPrevious: evaluation.deltaFromPrevious,
      message: evaluation.message,
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(rule.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "EnterpriseReporting-Monitor/1.0",
      },
      body: JSON.stringify(payload),
      // Prevent redirects to internal addresses
      redirect: "error",
    });

    if (!response.ok) {
      return {
        channel: "webhook",
        success: false,
        recipientCount: 1,
        error: `Webhook returned HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      channel: "webhook",
      success: true,
      recipientCount: 1,
    };
  } catch (err) {
    return {
      channel: "webhook",
      success: false,
      recipientCount: 1,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve all recipient entries to a deduplicated list of user IDs.
 * Role recipients are expanded to their member user IDs.
 */
async function resolveUserIds(recipients: AlertRecipient[]): Promise<string[]> {
  if (recipients.length === 0) return [];

  const db = getDb();
  const ids = new Set<string>();

  const userRecipients = recipients.filter((r) => r.type === "user");
  const roleRecipients = recipients.filter((r) => r.type === "role");

  for (const r of userRecipients) {
    ids.add(r.id);
  }

  if (roleRecipients.length > 0) {
    const roleIds = roleRecipients.map((r) => r.id);
    const usersInRoles = await db
      .selectFrom("user_roles")
      .innerJoin("users", "user_roles.user_id", "users.id")
      .where("user_roles.role_id", "in", roleIds)
      .where("users.is_active", "=", true)
      .select(["users.id"])
      .execute();

    for (const row of usersInRoles) {
      ids.add((row as unknown as { id: string }).id);
    }
  }

  return Array.from(ids);
}
