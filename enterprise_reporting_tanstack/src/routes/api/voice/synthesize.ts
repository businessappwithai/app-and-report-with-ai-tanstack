import { createFileRoute } from "@tanstack/react-router";
import { synthesizeSpeech } from "@/lib/voice/qwen-tts";

export const Route = createFileRoute("/api/voice/synthesize")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as { text?: string };

          if (!body.text || typeof body.text !== "string") {
            return new Response(JSON.stringify({ error: "Text field is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const audioBuffer = await synthesizeSpeech(body.text);

          if (!audioBuffer) {
            return new Response(JSON.stringify({ error: "TTS synthesis failed" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(audioBuffer, {
            status: 200,
            headers: { "Content-Type": "audio/mpeg" },
          });
        } catch (error) {
          console.error("[Synthesize] Error:", error);
          return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
