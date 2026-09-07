import nodemailer from "nodemailer";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  queryId?: string;
  columnMappings: Record<string, string>; // placeholder -> column name
  created_at: string;
  updated_at: string;
}

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
}

// Built-in templates
const builtInTemplates = {
  jobCompleted: {
    subject: "Job Completed: {{jobName}}",
    htmlBody: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .job-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4f46e5; }
          .status { padding: 10px 20px; border-radius: 4px; display: inline-block; margin: 10px 0; }
          .status.success { background: #d1fae5; color: #065f46; }
          .status.failed { background: #fee2e2; color: #991b1b; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
          .data-table th { background: #4f46e5; color: white; padding: 12px; text-align: left; }
          .data-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
          .data-table tr:last-child td { border-bottom: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Job Completed</h1>
          </div>
          <div class="content">
            <p>Hello {{userName}},</p>
            <p>Your scheduled job <strong>{{jobName}}</strong> has completed.</p>

            <div class="job-details">
              <h3>Job Details</h3>
              <p><strong>Status:</strong> <span class="status {{statusClass}}">{{status}}</span></p>
              <p><strong>Scheduled:</strong> {{schedule}}</p>
              <p><strong>Completed At:</strong> {{completedAt}}</p>
              <p><strong>Duration:</strong> {{duration}}ms</p>
              {{#if rowCount}}
              <p><strong>Rows Exported:</strong> {{rowCount}}</p>
              {{/if}}
            </div>

            {{#if resultUrl}}
            <div style="text-align: center;">
              <a href="{{resultUrl}}" class="button">📥 Download Results</a>
            </div>
            {{/if}}

            {{#if queryResults}}
            <div class="job-details">
              <h3>Query Results</h3>
              {{queryResults}}
            </div>
            {{/if}}

            {{#if errorMessage}}
            <div class="job-details" style="border-left-color: #ef4444;">
              <h3 style="color: #dc2626;">❌ Error</h3>
              <p>{{errorMessage}}</p>
            </div>
            {{/if}}
          </div>
          <div class="footer">
            <p>This is an automated message from Enterprise Reporting System</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  jobFailed: {
    subject: "❌ Job Failed: {{jobName}}",
    htmlBody: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .error-box { background: #fee2e2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Job Failed</h1>
          </div>
          <div class="content">
            <p>Hello {{userName}},</p>
            <p>Your scheduled job <strong>{{jobName}}</strong> has failed.</p>

            <div class="error-box">
              <h3>Error Details</h3>
              <p><strong>Time:</strong> {{failedAt}}</p>
              <p><strong>Error:</strong></p>
              <pre style="background: white; padding: 10px; border-radius: 4px; overflow-x: auto;">{{errorMessage}}</pre>
            </div>

            <p>Please check the job configuration and try again.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Enterprise Reporting System</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
};

// Simple template engine with query result support
export function renderTemplate(
  template: string,
  variables: Record<string, any>,
  queryResults?: Record<string, unknown>[] | null
): string {
  let result = template;

  // Replace simple variables first
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, String(value ?? ""));
  });

  // Handle query results placeholder
  if (queryResults && queryResults.length > 0) {
    const columns = Object.keys(queryResults[0]);

    // Check if template has queryResults placeholder
    if (result.includes("{{queryResults}}")) {
      // Generate HTML table from query results
      let tableHtml = '<table class="data-table">\n<thead>\n<tr>\n';
      tableHtml += columns.map((col) => `<th>${col}</th>`).join("\n");
      tableHtml += "\n</tr>\n</thead>\n<tbody>\n";

      queryResults.slice(0, 10).forEach((row) => {
        // Limit to 10 rows for email
        tableHtml += "<tr>\n";
        tableHtml += columns.map((col) => `<td>${row[col] ?? ""}</td>`).join("\n");
        tableHtml += "\n</tr>\n";
      });

      if (queryResults.length > 10) {
        tableHtml += `<tr><td colspan="${columns.length}" style="text-align: center; color: #6b7280;">... and ${queryResults.length - 10} more rows</td></tr>`;
      }

      tableHtml += "\n</tbody>\n</table>";

      result = result.replace("{{queryResults}}", tableHtml);
    }

    // Replace individual column placeholders like {{column_name}}
    if (queryResults.length > 0) {
      columns.forEach((col) => {
        const regex = new RegExp(`{{${col}}}`, "g");
        result = result.replace(regex, String(queryResults[0][col] ?? ""));
      });
    }
  }

  // Handle conditionals {{#if var}}...{{/if}}
  result = result.replace(/{{#if (\w+)}}([\s\S]*?){{\/if}}/g, (_, varName, content) => {
    return variables[varName] ? content : "";
  });

  return result;
}

// Get transporter with connection pooling
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

// Send email with custom template
export async function sendEmail(
  to: string | string[],
  template: {
    subject: string;
    htmlBody: string;
  },
  variables: Record<string, any>,
  queryResults?: Record<string, unknown>[] | null,
  attachments?: EmailAttachment[]
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const transporter = getTransporter();
    const from = process.env.EMAIL_FROM_NAME
      ? `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`
      : process.env.EMAIL_FROM || "noreply@example.com";

    // Render template with variables and query results
    const html = renderTemplate(template.htmlBody, variables, queryResults);
    const subject = renderTemplate(template.subject, variables);

    const mailOptions = {
      from,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
      attachments: attachments?.map((att) => ({
        filename: att.filename,
        path: att.path,
        content: att.content,
      })),
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Send email using built-in template name
export async function sendEmailWithTemplate(
  to: string | string[],
  templateName: keyof typeof builtInTemplates,
  variables: Record<string, any>,
  queryResults?: Record<string, unknown>[] | null,
  attachments?: EmailAttachment[]
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const template = builtInTemplates[templateName];

  return await sendEmail(
    to,
    {
      subject: template.subject,
      htmlBody: template.html,
    },
    variables,
    queryResults,
    attachments
  );
}

// Test email configuration
export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
  const variables = {
    smtpHost: process.env.SMTP_HOST || "localhost",
    smtpPort: process.env.SMTP_PORT || 587,
    fromEmail: process.env.EMAIL_FROM || "noreply@example.com",
    sentAt: new Date().toISOString(),
  };

  return await sendEmailWithTemplate(to, "jobCompleted", variables);
}

// Verify email configuration
export async function verifyEmailConfig(): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}
