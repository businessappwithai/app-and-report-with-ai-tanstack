import OpenAI from "openai";

// AI_* vars store the full OpenAI-compatible base URL (including /v1).
// They take priority over the legacy LLAMA_* vars (which omit /v1, so /v1 is appended).
const STT_BASE_URL =
  process.env.AI_STT_BASE_URL ?? `${process.env.LLAMA_STT_URL ?? "http://localhost:8081"}/v1`;
const STT_API_KEY = process.env.AI_STT_API_KEY ?? process.env.LLAMA_STT_API_KEY ?? "none";

const NL2SQL_BASE_URL =
  process.env.AI_NL2SQL_BASE_URL ??
  `${process.env.LLAMA_REASONING_URL ?? "http://localhost:8080"}/v1`;
const NL2SQL_API_KEY =
  process.env.AI_NL2SQL_API_KEY ?? process.env.LLAMA_REASONING_API_KEY ?? "none";

const TTS_BASE_URL =
  process.env.AI_TTS_BASE_URL ?? `${process.env.LLAMA_TTS_URL ?? "http://localhost:8083"}/v1`;
const TTS_API_KEY = process.env.AI_TTS_API_KEY ?? process.env.LLAMA_TTS_API_KEY ?? "none";

export function createSttClient() {
  return new OpenAI({ baseURL: STT_BASE_URL, apiKey: STT_API_KEY });
}

export function createReasoningClient() {
  return new OpenAI({ baseURL: NL2SQL_BASE_URL, apiKey: NL2SQL_API_KEY });
}

export function createTtsClient() {
  return new OpenAI({ baseURL: TTS_BASE_URL, apiKey: TTS_API_KEY });
}

function isLocal(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

export async function isLlamaSttAvailable(): Promise<boolean> {
  if (!isLocal(STT_BASE_URL)) return true;
  try {
    const base = STT_BASE_URL.replace(/\/v1$/, "");
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function isLlamaReasoningAvailable(): Promise<boolean> {
  if (!isLocal(NL2SQL_BASE_URL)) return true;
  try {
    const base = NL2SQL_BASE_URL.replace(/\/v1$/, "");
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function isLlamaTtsAvailable(): Promise<boolean> {
  if (!isLocal(TTS_BASE_URL)) return true;
  try {
    const base = TTS_BASE_URL.replace(/\/v1$/, "");
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
