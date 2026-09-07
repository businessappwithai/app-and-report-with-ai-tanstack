/**
 * Retrieved chunks, rendered for a prompt.
 *
 * CopilotKit sends a chat completion, not an agent loop with tools, so the
 * context has to be in the message before the model sees it. That is the right
 * shape here anyway: an assistant helping someone draw an ERD should not have
 * to decide whether to go and look at the model first — it always should, and
 * a tool call it might skip is a tool call it will skip.
 */

import type { Embedder } from "./embedder";
import { type RetrievedChunk, retrieve } from "./store";

/** What the assistant is being asked to help with, which changes what it needs. */
export type AssistantSurface = "entities" | "logic" | "general";

/**
 * Chunk kinds worth retrieving for each surface.
 *
 * Not a hard filter on everything — someone drawing an ERD still asks "why does
 * this field exist?", and the answer is often a workflow that writes to it — but
 * it biases the budget towards what the screen is for.
 */
const SURFACE_KINDS: Record<AssistantSurface, string[] | undefined> = {
  entities: ["overview", "entity", "enums", "spec"],
  logic: ["overview", "entity", "rule", "workflow", "spec"],
  general: undefined,
};

/** How the assistant should behave on each screen. */
const SURFACE_BRIEF: Record<AssistantSurface, string> = {
  entities:
    "You are helping design the data model: entities, their fields, and the " +
    "relationships between them. Prefer extending what already exists over " +
    "introducing a parallel structure, and say which existing entity a new " +
    "field or relationship should hang off.",
  logic:
    "You are helping build business rules and multi-step processes. A rule " +
    "decides something; a process acts on what it decided and can create, " +
    "update and delete other entities, carrying variables between its steps. " +
    "When you propose a step, name the entity and field it writes.",
  general: "You are helping with this application's model.",
};

export interface ModelContext {
  /** Ready to prepend to a system prompt. Empty when nothing was retrieved. */
  text: string;
  chunks: RetrievedChunk[];
}

/**
 * Fetch and render the context for one question.
 *
 * Each chunk is labelled with what it is and where it came from so the model
 * can cite it, and so a chunk from the language specification is not mistaken
 * for something this particular project declares — the difference between "your
 * model does this" and "the language lets you do this" is one an assistant gets
 * wrong constantly without it.
 */
export async function buildModelContext(
  projectId: string,
  question: string,
  options: { surface?: AssistantSurface; topK?: number; embed?: Embedder } = {}
): Promise<ModelContext> {
  const { surface = "general", topK = 8, embed } = options;

  let chunks: RetrievedChunk[] = [];
  try {
    chunks = await retrieve(projectId, question, {
      topK,
      kinds: SURFACE_KINDS[surface],
      embed,
    });
  } catch (error) {
    // Retrieval failing is not a reason to refuse to answer. The assistant is
    // less useful without context, not useless, and an error here would
    // otherwise surface to the user as a broken chat.
    console.error("[model-context] retrieval failed:", error);
    return { text: "", chunks: [] };
  }

  if (!chunks.length) return { text: "", chunks: [] };

  const rendered = chunks
    .map((chunk) => {
      const origin =
        chunk.source === "spec" || chunk.kind === "spec"
          ? "EML language specification"
          : "this project's model";
      return `--- ${chunk.kind}: ${chunk.name} (from ${origin}) ---\n${chunk.text}`;
    })
    .join("\n\n");

  return {
    text: [
      SURFACE_BRIEF[surface],
      "",
      "Here is the relevant part of the model, retrieved for this question.",
      "Treat it as authoritative: prefer it over anything you remember about " +
        "Mermaid or ERDs generally, and if it does not cover something, say so " +
        "rather than inventing a directive that looks plausible.",
      "",
      rendered,
    ].join("\n"),
    chunks,
  };
}
