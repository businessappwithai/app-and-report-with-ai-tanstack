import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/api/ai/convert-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await requireUser(request, "ai:convert", "write");
        if (caller.response) return caller.response;

        try {
          const body = await request.json();
          const { description, currentErdCode } = body as {
            description: string;
            currentErdCode?: string;
          };

          if (!description || typeof description !== "string") {
            return new Response(JSON.stringify({ error: "Description is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const encoder = new TextEncoder();

          const stream = new ReadableStream({
            async start(controller) {
              const send = (data: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              };

              // Send a heartbeat every 5 s so the client knows we're still alive
              const heartbeat = setInterval(() => {
                try {
                  controller.enqueue(encoder.encode(": heartbeat\n\n"));
                } catch {
                  clearInterval(heartbeat);
                }
              }, 5000);

              try {
                send({
                  step: "analyzing",
                  message: "Analyzing business domain and entity relationships...",
                });

                const { analyzeDomainWithOpenAI, generateMermaidWithValidation } = await import(
                  "@appwithai/ai"
                );

                const domainAnalysis = await analyzeDomainWithOpenAI(
                  description,
                  currentErdCode ?? ""
                );

                if (!domainAnalysis) {
                  send({
                    step: "error",
                    message: "AI returned an empty domain analysis — please try again.",
                  });
                  controller.close();
                  return;
                }

                send({ step: "generating", message: "Building entity model and relationships..." });

                const { mermaidSyntax } = await generateMermaidWithValidation(
                  domainAnalysis.entities,
                  domainAnalysis.relationships
                );

                if (!mermaidSyntax) {
                  send({
                    step: "error",
                    message: "AI returned an empty diagram — please try again with more detail.",
                  });
                  controller.close();
                  return;
                }

                send({ step: "validating", message: "Validating ERD diagram syntax..." });
                send({ mermaidSyntax });
              } catch (error) {
                const message = error instanceof Error ? error.message : "Conversion failed";
                send({ step: "error", message });
              } finally {
                clearInterval(heartbeat);
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        } catch (error) {
          console.error("Convert-stream error:", error);
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Conversion failed",
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
