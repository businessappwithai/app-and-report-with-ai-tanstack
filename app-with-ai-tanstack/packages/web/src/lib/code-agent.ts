/**
 * Code Agent API utilities for client-side interaction
 */

export interface CodeGenerationOptions {
  task: string;
  erdCode?: string;
  stack?: "tanstackjs-nestjs";
  options?: {
    includeTests?: boolean;
    includeMigrations?: boolean;
    outputFormat?: "files" | "preview";
  };
}

export interface CodeGenerationStatus {
  step: string;
  message: string;
  progress: number;
  partial?: string;
}

export interface CodeGenerationResult {
  result: string;
  message: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export type CodeGenerationEvent =
  | { type: "status"; data: CodeGenerationStatus }
  | { type: "progress"; data: { partial: string; progress: number } }
  | { type: "complete"; data: CodeGenerationResult }
  | { type: "error"; data: { message: string; error?: string } };

/**
 * Generate code from ERD using the Code Agent API
 */
export async function generateCode(
  options: CodeGenerationOptions,
  onEvent?: (event: CodeGenerationEvent) => void
): Promise<CodeGenerationResult> {
  const response = await fetch("/api/ai/code-agent-stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate code: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error("No response body");
  }

  let buffer = "";
  let result: CodeGenerationResult | null = null;

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
            onEvent?.({ type: "status", data });
          }

          if (data.partial) {
            onEvent?.({ type: "progress", data });
          }

          if (data.result) {
            result = data;
            onEvent?.({ type: "complete", data });
          }

          if (data.error) {
            onEvent?.({ type: "error", data });
          }
        } catch (e) {
          console.error("[Code Agent] Parse error:", e);
        }
      }
    }
  }

  if (!result) {
    throw new Error("No result received from code agent");
  }

  return result;
}

/**
 * Simple code generation without streaming
 */
export async function generateCodeSimple(
  options: CodeGenerationOptions
): Promise<CodeGenerationResult> {
  const response = await fetch("/api/ai/code-agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate code: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Validate code generation options
 */
export function validateCodeGenerationOptions(options: CodeGenerationOptions): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!options.task || options.task.trim().length === 0) {
    errors.push("Task description is required");
  }

  if (options.stack && options.stack !== "tanstackjs-nestjs") {
    errors.push('Invalid stack. Must be "tanstackjs-nestjs"');
  }

  if (
    options.options?.outputFormat &&
    !["files", "preview"].includes(options.options.outputFormat)
  ) {
    errors.push('Invalid output format. Must be "files" or "preview"');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get suggested tasks for code generation
 */
export function getSuggestedTasks(): Array<{ label: string; task: string }> {
  return [
    {
      label: "Full Stack App",
      task: "Generate a complete full-stack application with authentication, CRUD operations, and responsive UI",
    },
    {
      label: "API Only",
      task: "Generate a REST API with controllers, services, and database models",
    },
    {
      label: "Database Migrations",
      task: "Create database migration files with proper schema, indexes, and constraints",
    },
    {
      label: "Unit Tests",
      task: "Generate comprehensive unit tests for all entities and relationships",
    },
    {
      label: "Frontend UI",
      task: "Create React components for all entities with forms, tables, and validation",
    },
    {
      label: "Authentication",
      task: "Add user authentication with JWT tokens, login, and registration",
    },
  ];
}
