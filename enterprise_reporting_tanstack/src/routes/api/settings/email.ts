import { createFileRoute } from "@tanstack/react-router";
import { verifySession } from "@/lib/auth/session";
import { json } from "@/lib/server/response";

async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export const Route = createFileRoute("/api/settings/email")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          return json({
            success: true,
            data: {
              smtp: {
                host: process.env.SMTP_HOST || "",
                port: Number(process.env.SMTP_PORT || 587),
                secure: process.env.SMTP_SECURE === "true",
                user: process.env.SMTP_USER || "",
                configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
              },
              sender: {
                from: process.env.EMAIL_FROM || "noreply@example.com",
                fromName: process.env.EMAIL_FROM_NAME || "",
              },
              connectionPooling: {
                maxConnections: 5,
                maxMessagesPerConnection: 100,
                autoReuse: true,
              },
            },
          });
        } catch (error) {
          console.error("Error fetching email settings:", error);
          return json(
            {
              success: false,
              error: { code: "SERVER_ERROR", message: "Failed to fetch email settings" },
            },
            { status: 500 }
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const body = (await request.json()) as { action?: string; to?: string };

          if (body.action === "verify") {
            const configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
            if (!configured) {
              return json({
                success: false,
                error: {
                  code: "NOT_CONFIGURED",
                  message:
                    "SMTP not configured. Set SMTP_HOST and SMTP_USER environment variables.",
                },
              });
            }
            return json({
              success: true,
              data: { verified: true, message: "SMTP configuration is valid" },
            });
          }

          if (body.action === "test") {
            if (!body.to) {
              return json({
                success: false,
                error: { code: "INVALID_INPUT", message: "Recipient email address is required" },
              });
            }
            return json({
              success: false,
              error: {
                code: "NOT_CONFIGURED",
                message:
                  "SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables to enable email sending.",
              },
            });
          }

          return json(
            { success: false, error: { code: "INVALID_ACTION", message: "Unknown action" } },
            { status: 400 }
          );
        } catch (error) {
          console.error("Error processing email settings action:", error);
          return json(
            {
              success: false,
              error: { code: "SERVER_ERROR", message: "Failed to process request" },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
