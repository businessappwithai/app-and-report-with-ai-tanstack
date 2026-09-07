import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { verifySession } from "@/lib/auth/session";
import { transcribeAudio } from "@/lib/voice/qwen-asr";

async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export const Route = createFileRoute("/api/nl-query/voice")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json({ success: false, error: "Unauthorized" }, { status: 401 });
          }

          // Parse audio from the incoming multipart/form-data
          let formData: FormData;
          try {
            formData = await request.formData();
          } catch {
            return json({ success: false, error: "Expected multipart/form-data with audio field" });
          }

          const audioEntry = formData.get("audio");
          if (!audioEntry || !(audioEntry instanceof Blob)) {
            return json({ success: false, error: "No audio data in request" });
          }

          // Transcribe using llama.cpp Qwen3-ASR
          const text = await transcribeAudio(audioEntry);

          if (!text) {
            console.error("[Voice] Transcription returned empty result");
            return json({
              success: false,
              error: "Transcription failed. Ensure Qwen3-ASR is available on llama.cpp server.",
            });
          }

          if (!text) {
            return json({ success: false, error: "No speech detected — try speaking more clearly" });
          }

          return json({ success: true, text });
        } catch (error) {
          console.error("[Voice] Error:", error);
          const msg = error instanceof Error ? error.message : "Transcription failed";
          return json({ success: false, error: msg });
        }
      },
    },
  },
});
