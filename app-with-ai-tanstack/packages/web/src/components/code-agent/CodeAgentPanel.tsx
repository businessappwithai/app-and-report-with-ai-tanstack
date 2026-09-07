"use client";

import { Loader2, Play, Settings } from "lucide-react";
import { useState } from "react";

interface CodeAgentStatus {
  step: string;
  message: string;
  progress: number;
  partial?: string;
}

interface CodeAgentResult {
  result: string;
  message: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

interface CodeAgentPanelProps {
  erdCode: string;
  projectId?: string;
  projectName?: string;
}

export function CodeAgentPanel({ erdCode }: CodeAgentPanelProps) {
  const [task, setTask] = useState("");
  const [stack, setStack] = useState<"tanstack-start-nestjs">("tanstack-start-nestjs");
  const [includeTests, setIncludeTests] = useState(true);
  const [includeMigrations, setIncludeMigrations] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<CodeAgentStatus | null>(null);
  const [result, setResult] = useState<CodeAgentResult | null>(null);

  const handleGenerateCode = async () => {
    if (!task.trim()) return;

    setIsProcessing(true);
    setStatus(null);
    setResult(null);

    try {
      const response = await fetch("/api/ai/code-agent-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task,
          erdCode,
          stack,
          options: {
            includeTests,
            includeMigrations,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate code");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            line.slice(6).trim();
            continue;
          }

          if (line.startsWith("data:")) {
            try {
              const data = JSON.parse(line.slice(5));

              if (data.step) {
                setStatus(data);
              }

              if (data.result) {
                setResult(data);
                setIsProcessing(false);
              }

              if (data.error) {
                console.error("[Code Agent] Error:", data.error);
                setStatus({
                  step: "error",
                  message: data.message,
                  progress: 0,
                });
                setIsProcessing(false);
              }
            } catch (e) {
              console.error("[Code Agent] Parse error:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("[Code Agent] Request error:", error);
      setStatus({
        step: "error",
        message: error instanceof Error ? error.message : "Failed to generate code",
        progress: 0,
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Task Input */}
      <div className="space-y-2">
        <label
          htmlFor="codeagentpanel-field"
          className="block text-sm font-medium text-slate-900 dark:text-white"
        >
          What code would you like to generate?
        </label>
        <textarea
          id="codeagentpanel-field"
          placeholder="e.g., Generate a complete TanStack Start application with user authentication, or Create database migrations for the ERD"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </div>

      {/* Stack Selection */}
      <div className="space-y-2">
        <label
          htmlFor="codeagentpanel-target-stack"
          className="block text-sm font-medium text-slate-900 dark:text-white"
        >
          Target Stack
        </label>
        <select
          id="codeagentpanel-target-stack"
          value={stack}
          onChange={(e) => setStack(e.target.value as "tanstack-start-nestjs")}
          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="tanstack-start-nestjs">TanStack Start + NestJS</option>
        </select>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <span className="block text-sm font-medium text-slate-900 dark:text-white">
          Generation Options
        </span>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="include-tests"
            checked={includeTests}
            onChange={(e) => setIncludeTests(e.target.checked)}
            className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
          />
          <label
            htmlFor="include-tests"
            className="text-sm cursor-pointer text-slate-700 dark:text-slate-300"
          >
            Include unit tests
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="include-migrations"
            checked={includeMigrations}
            onChange={(e) => setIncludeMigrations(e.target.checked)}
            className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
          />
          <label
            htmlFor="include-migrations"
            className="text-sm cursor-pointer text-slate-700 dark:text-slate-300"
          >
            Include database migrations
          </label>
        </div>
      </div>

      {/* Status Display */}
      {status && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900 dark:text-white">{status.message}</span>
            <span className="text-slate-600 dark:text-slate-400">{status.progress}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-violet-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${status.progress}%` }}
            />
          </div>
          {status.partial && (
            <div className="text-xs text-slate-600 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded">
              {status.partial}
            </div>
          )}
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              Code Generated Successfully!
            </span>
            {result.usage && (
              <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
                {result.usage.completionTokens} tokens
              </span>
            )}
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded max-h-64 overflow-y-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap">{result.result}</pre>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGenerateCode}
          disabled={!task.trim() || isProcessing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Generate Code
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setTask("");
            setStatus(null);
            setResult(null);
          }}
          disabled={isProcessing}
          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
