import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { verifySession } from "@/lib/auth/session";
import { ConnectionTestService } from "@/lib/services/connection-test.service";

interface TestConnectionRequest {
  clientType: string;
  connectionConfig: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    filename?: string;
    connectionString?: string;
  };
}

async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export const Route = createFileRoute("/api/data-sources/test")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const testRequestId = Math.random().toString(36).substring(7);
        const startTime = Date.now();

        try {
          console.log(`[API_TEST:${testRequestId}] Connection test request received`);

          const session = await getSession(request);
          if (!session?.user) {
            console.warn(`[API_TEST:${testRequestId}] Unauthorized - no valid session`);
            return json(
              { error: { message: "Unauthorized" } },
              { status: 401 }
            );
          }

          console.log(`[API_TEST:${testRequestId}] User: ${session.user.email || session.user.id}`);

          const body = (await request.json()) as TestConnectionRequest;
          console.log(`[API_TEST:${testRequestId}] Request body received`);
          console.log(`[API_TEST:${testRequestId}] Client type: ${body.clientType}`);

          // Log config without sensitive data
          const configSummary = {
            clientType: body.clientType,
            host: body.connectionConfig.host || 'N/A',
            port: body.connectionConfig.port || 'default',
            database: body.connectionConfig.database || 'N/A',
            user: body.connectionConfig.user || 'N/A',
            hasPassword: !!body.connectionConfig.password,
            hasConnectionString: !!body.connectionConfig.connectionString,
            hasFilename: !!body.connectionConfig.filename,
          };
          console.log(`[API_TEST:${testRequestId}] Config Summary: ${JSON.stringify(configSummary)}`);

          console.log(`[API_TEST:${testRequestId}] Starting connection test service...`);
          const result = await ConnectionTestService.test(
            body.clientType,
            body.connectionConfig
          );

          const duration = Date.now() - startTime;
          console.log(`[API_TEST:${testRequestId}] Test completed in ${duration}ms`);
          console.log(`[API_TEST:${testRequestId}] Result: ${JSON.stringify({
            success: result.connected,
            message: result.message,
            latency: result.latency
          })}`);

          return json({
            data: result,
          });
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : "Test connection failed";
          const errorCode = error instanceof Error ? (error as any).code : "UNKNOWN";
          const errorStack = error instanceof Error ? error.stack : "";

          console.error(`[API_TEST:${testRequestId}] Test FAILED after ${duration}ms`);
          console.error(`[API_TEST:${testRequestId}] Error Code: ${errorCode}`);
          console.error(`[API_TEST:${testRequestId}] Error Message: ${errorMessage}`);
          if (errorStack) {
            console.error(`[API_TEST:${testRequestId}] Stack:\n${errorStack}`);
          }

          return json(
            {
              error: {
                message: errorMessage,
              },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
