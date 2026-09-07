/**
 * Give the CopilotKit assistant this project's model.
 *
 * Two channels, because they answer different needs.
 *
 * `useCopilotReadable` publishes a small always-present summary — what the
 * application is, which entities exist. It is cheap enough to sit in every
 * message and it stops the most common failure, which is the assistant
 * proposing an entity that already exists under another name.
 *
 * `useCopilotAction` gives it retrieval. The detail — a rule's decision table,
 * a process's steps, the directive syntax for a delete workflow — is far too
 * much to send every time and is only needed for some questions. Making it a
 * search the model chooses to run also shows the user what was consulted, which
 * matters when the reply is about to change their data model.
 */

import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { useCallback } from "react";

export type AssistantSurface = "entities" | "logic" | "general";

export interface ModelSummary {
  name: string;
  entities: string[];
  ruleNames: string[];
  workflowNames: string[];
}

interface RetrievedChunk {
  kind: string;
  name: string;
  score: number;
  text: string;
}

export interface UseModelAssistantOptions {
  projectId: string;
  surface: AssistantSurface;
  /** The cheap always-on summary. Omit while the model is still loading. */
  summary?: ModelSummary;
}

const SURFACE_DESCRIPTION: Record<AssistantSurface, string> = {
  entities:
    "Search this application's data model and the EML language specification. " +
    "Use it before proposing entities, fields or relationships, so you extend " +
    "what exists instead of duplicating it.",
  logic:
    "Search this application's business rules, multi-step processes, entities " +
    "and the EML language specification. Use it before proposing a rule or a " +
    "workflow step, so you know which entities and fields are available and " +
    "what already runs on them.",
  general: "Search this application's model and the EML language specification.",
};

export function useModelAssistant({ projectId, surface, summary }: UseModelAssistantOptions) {
  useCopilotReadable({
    description:
      "The application currently being designed: its name and the entities, " +
      "rules and processes it already declares. Names only — use the " +
      "searchModel action for any detail.",
    value: summary ?? null,
    // Nothing useful to say until the model has loaded, and publishing an empty
    // shape reads to the assistant as "this application has no entities".
    available: summary ? "enabled" : "disabled",
  });

  const search = useCallback(
    async ({ question }: { question: string }) => {
      const response = await fetch("/api/model-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, question, surface }),
      });

      if (!response.ok) {
        const detail = await response.text();
        // Returned rather than thrown: the assistant can say it could not look
        // something up and carry on, where a throw ends the turn.
        return `The model search failed (${response.status}). ${detail.slice(0, 200)}`;
      }

      const payload = (await response.json()) as { context: string; chunks: RetrievedChunk[] };
      if (!payload.chunks?.length) {
        return "Nothing in this model or the language specification matches that. Say so rather than guessing.";
      }
      return payload.context;
    },
    [projectId, surface]
  );

  useCopilotAction({
    name: "searchModel",
    description: SURFACE_DESCRIPTION[surface],
    parameters: [
      {
        name: "question",
        type: "string",
        description:
          "What you need to know, in plain language — for example 'which processes write to CAPA' " +
          "or 'how do I declare a workflow that runs on delete'.",
        required: true,
      },
    ],
    handler: search,
  });
}
