import { createFileRoute } from "@tanstack/react-router";
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { createOpenAI } from "@ai-sdk/openai";
import OpenAI from "openai";

class OpenAIChatAdapter extends OpenAIAdapter {
  private _chatModel: string;
  private _chatBaseURL: string;
  private _chatApiKey: string;

  constructor(params: { openai: OpenAI; model: string }) {
    super(params);
    this._chatModel = params.model;
    this._chatBaseURL = params.openai.baseURL;
    this._chatApiKey = params.openai.apiKey as string;
  }

  getLanguageModel() {
    const provider = createOpenAI({
      baseURL: this._chatBaseURL,
      apiKey: this._chatApiKey,
    });
    return provider.chat(this._chatModel);
  }
}

let _handler: { handleRequest: (req: Request) => Response | Promise<Response> } | null = null;

function getHandler() {
  if (!_handler) {
    // Use AI_NL2SQL_BASE_URL (headroom proxy) if set, otherwise fall back to MASTRA_URL/v1
    const aiBaseURL = process.env.AI_NL2SQL_BASE_URL
      || (process.env.MASTRA_URL ? `${process.env.MASTRA_URL}/v1` : "http://localhost:4111/v1");
    const baseURL = aiBaseURL.endsWith("/v1") ? aiBaseURL.slice(0, -3) : aiBaseURL;
    const apiKey =
      process.env.AI_NL2SQL_API_KEY ?? process.env.LLAMA_REASONING_API_KEY ?? "none";
    const model =
      process.env.AI_NL2SQL_MODEL ?? process.env.LLAMA_REASONING_MODEL ?? "qwen3.6";

    const openai = new OpenAI({
      baseURL: aiBaseURL,
      apiKey,
    });

    const runtime = new CopilotRuntime();
    _handler = copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      serviceAdapter: new OpenAIChatAdapter({ openai, model }),
      endpoint: "/api/copilotkit",
    });
  }
  return _handler;
}

export const Route = createFileRoute("/api/copilotkit/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return getHandler().handleRequest(request);
      },
      POST: async ({ request }) => {
        return getHandler().handleRequest(request);
      },
    },
  },
});
