import { createSttClient } from "./llama-client";

const STT_MODEL = process.env.AI_STT_MODEL ?? process.env.LLAMA_STT_MODEL ?? "Qwen3-ASR";

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const client = createSttClient();

  const file = new File([audioBlob], "audio.wav", { type: "audio/wav" });

  const response = await client.audio.transcriptions.create({
    file: file,
    model: STT_MODEL,
    response_format: "json",
  });

  return response.text;
}

export async function transcribeAudioStream(
  audioChunks: AsyncIterable<Uint8Array>
): Promise<string> {
  // Accumulate chunks into a single blob
  const chunks: Uint8Array[] = [];
  for await (const chunk of audioChunks) {
    chunks.push(chunk);
  }

  const blob = new Blob(chunks, { type: "audio/wav" });
  return transcribeAudio(blob);
}
