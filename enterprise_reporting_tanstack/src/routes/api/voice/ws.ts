import { createFileRoute } from "@tanstack/react-router";
import { transcribeAudioStream } from "@/lib/voice/qwen-asr";
import { translateNLToSQLViaLlama } from "@/lib/nlquery/llama-translator";
import type { EnhancedSchemaMetadata } from "@/lib/nlquery/llama-translator";

/**
 * WebSocket endpoint for real-time voice transcription + NL-to-SQL
 *
 * Flow:
 * 1. Client connects, sends binary PCM16@16kHz audio chunks
 * 2. Chunks accumulated into segments (~500ms)
 * 3. Each segment transcribed via Qwen3-ASR
 * 4. Partial transcripts streamed back to browser
 * 5. On final transcript, calls Qwen3.6 for SQL generation
 * 6. SQL + explanation streamed back
 */
export const Route = createFileRoute("/api/voice/ws")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // Check if this is a WebSocket upgrade request
        if (request.headers.get("upgrade") !== "websocket") {
          return new Response("Expected WebSocket", { status: 400 });
        }

        // TanStack Start WebSocket support via Bun's native WebSocket
        const server = (request as any).server;
        if (!server || !server.upgrade) {
          return new Response("WebSocket not supported", { status: 400 });
        }

        const socket = server.upgrade(request);

        // Store accumulated audio chunks
        const audioChunks: Uint8Array[] = [];
        let isProcessing = false;

        socket.onopen = () => {
          console.log("[WS] Voice connection established");
          socket.send(JSON.stringify({ type: "ready" }));
        };

        socket.onmessage = async (event: MessageEvent) => {
          try {
            if (event.data instanceof ArrayBuffer) {
              // Binary audio data
              audioChunks.push(new Uint8Array(event.data));
              return;
            }

            const message = JSON.parse(event.data as string);

            if (message.type === "transcribe") {
              // Process accumulated audio chunks
              if (audioChunks.length === 0) {
                socket.send(JSON.stringify({ type: "error", error: "No audio data" }));
                return;
              }

              if (isProcessing) {
                socket.send(JSON.stringify({ type: "error", error: "Already processing" }));
                return;
              }

              isProcessing = true;

              try {
                // Transcribe audio stream
                const transcript = await transcribeAudioStream(
                  audioChunksAsAsyncIterable(audioChunks)
                );
                audioChunks.length = 0; // Clear chunks

                socket.send(
                  JSON.stringify({
                    type: "transcript",
                    text: transcript,
                    isFinal: true,
                  })
                );

                // If requested, generate SQL from transcript
                if (message.generateSQL && message.schema) {
                  const result = await translateNLToSQLViaLlama(
                    transcript,
                    message.schema as EnhancedSchemaMetadata,
                    message.userId,
                    message.dataSourceId
                  );

                  if (result) {
                    socket.send(
                      JSON.stringify({
                        type: "sql",
                        sql: result.sql,
                        explanation: result.explanation,
                        warnings: result.warnings,
                      })
                    );
                  } else {
                    socket.send(
                      JSON.stringify({
                        type: "error",
                        error: "SQL generation failed",
                      })
                    );
                  }
                }
              } finally {
                isProcessing = false;
              }
            }
          } catch (error) {
            console.error("[WS] Message handling error:", error);
            socket.send(
              JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "Unknown error",
              })
            );
          }
        };

        socket.onclose = () => {
          console.log("[WS] Voice connection closed");
        };

        socket.onerror = (error: any) => {
          console.error("[WS] WebSocket error:", error);
        };

        return new Response(null, { status: 101 });
      },
    },
  },
});

/**
 * Convert array of Uint8Array chunks to AsyncIterable for streaming
 */
async function* audioChunksAsAsyncIterable(chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const chunk of chunks) {
    yield chunk;
  }
}
