import { createTtsClient } from "./llama-client";

const LLAMA_TTS_MODEL = process.env.LLAMA_TTS_MODEL || "Qwen3-TTS";

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const client = createTtsClient();

  const response = await client.audio.speech.create({
    model: LLAMA_TTS_MODEL,
    voice: "alloy",
    input: text,
    response_format: "mp3",
  });

  // response is a Readable stream from the Node.js fetch
  const buffer = await response.arrayBuffer();
  return buffer;
}
