import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

interface CodeAgentRequest {
  task: string;
  erdCode?: string;
  stack?: "tanstackjs-nestjs";
  options?: {
    includeTests?: boolean;
    includeMigrations?: boolean;
    outputFormat?: "files" | "preview";
  };
}

export const Route = createFileRoute("/api/ai/code-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await requireUser(request, "ai:code-agent", "write");
        if (caller.response) return caller.response;

        try {
          const body: CodeAgentRequest = await request.json();
          const { task, erdCode, stack, options } = body;

          let prompt = `Task: ${task}\n`;

          if (erdCode) {
            prompt += `\nCurrent ERD Diagram:\n${erdCode}\n`;
          }

          if (stack) {
            prompt += `\nTarget Stack: ${stack}\n`;
          }

          if (options) {
            prompt += `\nOptions:\n`;
            if (options.includeTests) prompt += `- Include unit tests\n`;
            if (options.includeMigrations) prompt += `- Include database migrations\n`;
            if (options.outputFormat) prompt += `- Output format: ${options.outputFormat}\n`;
          }

          const { codeAgent } = await import("@appwithai/ai");
          const result = await codeAgent.generate(prompt, {
            maxSteps: 25,
          });

          const responseText = result.text;

          return new Response(
            JSON.stringify({
              success: true,
              result: responseText,
              usage: result.usage,
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("[Code Agent] Error:", error);

          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to execute code agent",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
