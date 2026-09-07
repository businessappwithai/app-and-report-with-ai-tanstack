import { createFileRoute } from "@tanstack/react-router";
import { transcribeAudio } from "@/lib/voice/qwen-asr";

export const Route = createFileRoute("/api/voice/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const formData = await request.formData();
          const audioFile = formData.get("audio") as File | null;

          if (!audioFile) {
            return new Response(JSON.stringify({ error: "No audio file provided" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const blob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type });
          const text = await transcribeAudio(blob);

          if (!text) {
            return new Response(JSON.stringify({ error: "Transcription failed" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ success: true, text }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("[Transcribe] Error:", error);
          return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
