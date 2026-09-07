import { useState, useCallback } from "react";
import type { AgentStep } from "@/components/nl-query/AgentStepsDisplay";

export interface StreamingResult {
  sql: string;
  explanation: string;
  warnings?: string[];
}

export function useAgentStreaming() {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [result, setResult] = useState<StreamingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearSteps = useCallback(() => {
    setSteps([]);
    setResult(null);
    setError(null);
  }, []);

  const streamGenerateSQL = useCallback(
    async (question: string, dataSourceId: string): Promise<StreamingResult | null> => {
      // Use a local variable — React setState is async so reading `result` state
      // at the end of this function would always return the stale value.
      let localResult: StreamingResult | null = null;

      try {
        setSteps([]);
        setResult(null);
        setError(null);
        setIsStreaming(true);

        setSteps([
          {
            id: "init",
            title: "Initializing agent",
            description: "Preparing to process your natural language query",
            status: "running",
            timestamp: new Date().toISOString(),
          },
        ]);

        const response = await fetch("/api/copilotkit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            path: "/execute-stream",
            input: { message: question, dataSourceId },
          }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("text/event-stream") && response.body) {
          // True SSE stream
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "step") {
                  setSteps((prev) => {
                    const idx = prev.findIndex((s) => s.id === data.step.id);
                    if (idx >= 0) {
                      const next = [...prev];
                      next[idx] = data.step;
                      return next;
                    }
                    return [...prev, data.step];
                  });
                } else if (data.type === "result") {
                  localResult = data.result;
                  setResult(data.result);
                  setSteps((prev) =>
                    prev.map((s) =>
                      s.id === "init" ? { ...s, status: "completed" } : s
                    )
                  );
                } else if (data.type === "error") {
                  throw new Error(data.error);
                }
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) {
                  // Incomplete JSON chunk — ignore
                } else {
                  throw parseErr;
                }
              }
            }
          }
        } else {
          // Fallback: non-streaming JSON response (server doesn't support SSE yet)
          const data = await response.json();
          if (data.success && data.result) {
            localResult = data.result;
            setResult(data.result);
            setSteps((prev) =>
              prev.map((s) =>
                s.id === "init" ? { ...s, status: "completed" } : s
              )
            );
          } else {
            throw new Error(data.error || "SQL generation failed");
          }
        }

        setIsStreaming(false);
        return localResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setIsStreaming(false);
        setSteps((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], status: "error" };
          return next;
        });
        throw err;
      }
    },
    [clearSteps]
  );

  return {
    steps,
    isStreaming,
    result,
    error,
    streamGenerateSQL,
    clearSteps,
  };
}
