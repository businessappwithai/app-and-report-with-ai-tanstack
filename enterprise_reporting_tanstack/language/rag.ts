/**
 * EML → retrieval chunks.
 *
 * A model is a structured document, and the useful thing about Docling's
 * approach to RAG is that it refuses to forget that: it splits along a
 * document's own structure — headings, tables, list items — rather than every
 * N characters, and it writes the surrounding context into each piece so a
 * retrieved chunk still says what it is. A table row arrives with its headers
 * attached; a paragraph arrives knowing its section.
 *
 * Splitting an `.eml.mmd` by character count produces the opposite. A 512-char
 * window cuts an `erDiagram` block through the middle of an entity, severs a
 * decision table's JSON, and separates a `%%step` directive from the flowchart
 * node it annotates. What comes back from the vector store is unparseable
 * Mermaid with no indication of which entity or workflow it belonged to — and
 * an assistant asked "what happens when a Sample is deleted?" gets fragments
 * that cannot answer it.
 *
 * So the unit here is the unit the model already has. One chunk per entity,
 * per rule, per workflow, per spec section. Each is complete — an entity chunk
 * carries its fields, its relationships in both directions, and the rules and
 * workflows bound to it — and each opens with a line naming what it is, so the
 * text embeds meaningfully on its own rather than depending on a neighbour.
 *
 * Deliberately dependency-free and structurally typed. `language/` is the
 * source of truth for both the generator and the applications it generates, and
 * this file is copied into generated apps verbatim; an import of
 * `@erdwithai/*` here would not survive the trip.
 */

/* -------------------------------------------------------------------------- */
/*  Input shapes — structural, so any caller with the same fields can pass in  */
/* -------------------------------------------------------------------------- */

export interface RagAttribute {
  name: string;
  type: string;
  required: boolean;
  unique?: boolean;
  isForeignKey?: boolean;
}

export interface RagEntity {
  name: string;
  tableName: string;
  description?: string;
  attributes: RagAttribute[];
  primaryKey: string;
}

export interface RagRelationship {
  sourceEntity: string;
  targetEntity: string;
  cardinality: string;
  name?: string;
  foreignKey?: string;
}

export interface RagCategory {
  name: string;
  description?: string;
  entities: string[];
}

export interface RagRule {
  name: string;
  entity: string;
  tableName?: string;
  event: string;
  operation: string;
  priority?: number;
  /** The JDM decision graph, serialised. Read for a human summary, not embedded raw. */
  jdmContent?: string;
}

export interface RagStep {
  /** Flowchart node the step is bound to — `nodeId`, as the compiler spells it. */
  nodeId: string;
  type: string;
  props: Record<string, string>;
}

export interface RagSaga {
  name: string;
  entity: string;
  trigger: string;
  operation: string;
  steps: RagStep[];
}

export interface RagWorkflow {
  name: string;
  entity: string;
  /** State machines and lifecycle-hook sets, which have no ordered steps. */
  states?: string[];
  hooks?: { type: string; handler: string }[];
}

export interface RagModel {
  name?: string;
  version?: string;
  description?: string;
  entities: RagEntity[];
  relationships: RagRelationship[];
  categories?: RagCategory[];
  enums?: { name: string; values: string[] }[];
  rules?: RagRule[];
  sagas?: RagSaga[];
  workflows?: RagWorkflow[];
}

/* -------------------------------------------------------------------------- */
/*  Output                                                                     */
/* -------------------------------------------------------------------------- */

export type ChunkKind = "overview" | "entity" | "enums" | "rule" | "workflow" | "spec";

export interface RagChunk {
  /**
   * Stable across re-ingests of the same model, so re-embedding replaces a
   * chunk rather than accumulating a second copy of it.
   */
  id: string;
  kind: ChunkKind;
  /** What this chunk is about — the entity, rule or workflow name. */
  name: string;
  /** The text that gets embedded. Self-contained by construction. */
  text: string;
  /** Filterable facts. Kept flat: vector stores filter on scalars, not trees. */
  metadata: {
    kind: ChunkKind;
    name: string;
    /** The entity this concerns, when it concerns exactly one. */
    entity?: string;
    /** CREATE / UPDATE / DELETE / ALL, for rules and sagas. */
    operation?: string;
    /** Lifecycle event, for rules. */
    event?: string;
    /** Entities this chunk touches, including through workflow steps. */
    touches?: string[];
    /** Where it came from, so an answer can cite it. */
    source: string;
  };
}

/* -------------------------------------------------------------------------- */
/*  Rendering helpers                                                          */
/* -------------------------------------------------------------------------- */

/** Cardinality glyphs and camelCase names read badly in prose. */
function cardinalityPhrase(cardinality: string): string {
  switch (cardinality) {
    case "oneToMany":
      return "has many";
    case "manyToOne":
      return "belongs to";
    case "oneToOne":
      return "has one";
    case "manyToMany":
      return "relates to many";
    default:
      return "relates to";
  }
}

function attributeLine(attribute: RagAttribute): string {
  const flags = [
    attribute.required ? "required" : "optional",
    attribute.unique ? "unique" : null,
    attribute.isForeignKey ? "foreign key" : null,
  ].filter(Boolean);
  return `  - ${attribute.name} (${attribute.type}, ${flags.join(", ")})`;
}

interface DecisionTableContent {
  hitPolicy?: string;
  inputs?: { name?: string; field?: string }[];
  outputs?: { name?: string; field?: string }[];
  rules?: Record<string, string>[];
}

/**
 * A decision table, row by row.
 *
 * The rows are the whole point: "critical deviations get a one-day containment
 * window" lives in a table cell, and a chunk that says "there is a decision
 * table here" cannot answer a question about it. Rendered as prose rather than
 * as the raw JSON, because a serialised table is mostly punctuation and cell
 * ids — it embeds close to every other serialised table and reads as noise.
 */
function describeDecisionTable(content: DecisionTableContent, label: string): string[] {
  if (!content.rules?.length) return [];
  const inputs = content.inputs ?? [];
  const outputs = content.outputs ?? [];

  const lines = [
    `${label} (hit policy: ${content.hitPolicy ?? "first"}):`,
    `  reads ${inputs.map((i) => i.field || i.name).join(", ") || "the record"}, ` +
      `writes ${outputs.map((o) => o.field || o.name).join(", ") || "nothing"}`,
  ];

  for (const row of content.rules) {
    const condition = inputs
      .map((_input, index) => row[`i${index + 1}`])
      .filter((cell) => cell?.trim())
      .join(" and ");
    const results = outputs
      .map((output, index) => {
        const cell = row[`o${index + 1}`];
        if (!cell?.trim() || cell === "''") return null;
        return `${output.field || output.name} = ${cell}`;
      })
      .filter(Boolean)
      .join(", ");
    lines.push(`  - when ${condition || "no earlier row matched"} → ${results || "nothing"}`);
  }
  return lines;
}

/** A readable summary of a rule's decision graph. */
function describeJdm(jdmContent: string | undefined): string[] {
  if (!jdmContent?.trim()) return [];
  let graph: { nodes?: { name?: string; type?: string; content?: unknown }[] };
  try {
    graph = JSON.parse(jdmContent);
  } catch {
    return [];
  }

  const lines: string[] = [];
  for (const node of graph.nodes ?? []) {
    if (node.type === "decisionTableNode") {
      lines.push(
        ...describeDecisionTable(
          node.content as DecisionTableContent,
          `Decision table "${node.name ?? "table"}"`
        )
      );
    } else if (node.type === "switchNode" || node.type === "expressionNode") {
      lines.push(
        `  ${node.type === "switchNode" ? "decides" : "does"}: ${node.name ?? ""}`.trimEnd()
      );
    }
  }
  return lines;
}

/** One workflow step, in the order it runs, saying what it touches. */
function describeStep(step: RagStep, index: number, ownEntity: string): string {
  const props = step.props ?? {};
  const target = props.entity?.trim() || ownEntity;
  const parts: string[] = [`  ${index + 1}. ${step.type}`];

  switch (step.type) {
    case "Decision": {
      if (props.rule) {
        parts.push(`evaluates the rule "${props.rule}"`);
      } else {
        parts.push("evaluates a decision table declared inside the step");
      }
      if (props.publish) parts.push(`publishing ${props.publish}`);

      // Spell the table out. Its rows are the policy — leaving them as a
      // reference to "a decision table" makes the step unanswerable.
      if (props.decisionTable) {
        try {
          const rows = describeDecisionTable(
            JSON.parse(props.decisionTable) as DecisionTableContent,
            "     table"
          );
          if (rows.length) return [parts.join(" "), ...rows.map((row) => `   ${row}`)].join("\n");
        } catch {
          // A table that does not parse is a model defect the checker reports;
          // the step still describes itself without it.
        }
      }
      break;
    }
    case "CreateEntity":
      parts.push(`creates a ${target}`);
      if (props.as) parts.push(`and remembers its id as "${props.as}"`);
      if (props.fields) parts.push(`with fields ${props.fields}`);
      break;
    case "UpdateEntity":
      parts.push(`updates ${target}.${props.field ?? "?"}`);
      if (props.source) parts.push(`from the variable "${props.source}"`);
      else if (props.value) parts.push(`to "${props.value}"`);
      if (props.targetSource) parts.push(`on the row remembered as "${props.targetSource}"`);
      break;
    case "DeleteEntity":
      parts.push(`deletes ${target} rows`);
      if (props.targetField) parts.push(`matched on ${props.targetField}`);
      if (props.targetSource) parts.push(`= the variable "${props.targetSource}"`);
      break;
    case "Formula":
      parts.push(
        `computes "${props.target ?? "?"}" as ${props.source ?? "?"} ${props.operation ?? "?"} ${props.operand ?? ""}`.trimEnd()
      );
      break;
    case "REST":
      parts.push(`calls ${props.method ?? "POST"} ${props.url ?? "?"}`);
      break;
    default:
      parts.push(
        Object.entries(props)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ")
      );
  }
  return parts.join(" ");
}

/** Every entity a saga writes to, so "what touches CAPA?" is answerable. */
function entitiesTouchedBySaga(saga: RagSaga): string[] {
  const touched = new Set<string>([saga.entity]);
  for (const step of saga.steps ?? []) {
    const entity = step.props?.entity?.trim();
    if (entity) touched.add(entity);
  }
  return [...touched];
}

/* -------------------------------------------------------------------------- */
/*  Chunkers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The whole model in one chunk.
 *
 * Answers "what is this application?" and "which entities exist?", neither of
 * which any single entity chunk can answer. Deliberately a list rather than
 * detail — the detail lives in the per-entity chunks, and duplicating it here
 * would make this chunk win searches it should lose.
 */
function overviewChunk(model: RagModel, source: string): RagChunk {
  const lines: string[] = [
    `Application model: ${model.name ?? "unnamed"}${model.version ? ` (version ${model.version})` : ""}.`,
  ];
  if (model.description) lines.push(model.description);

  lines.push("", `Entities (${model.entities.length}):`);
  for (const entity of model.entities) {
    lines.push(
      `  - ${entity.name} (table ${entity.tableName}, ${entity.attributes.length} fields)`
    );
  }

  if (model.categories?.length) {
    lines.push("", "Grouped into:");
    for (const category of model.categories) {
      lines.push(`  - ${category.name}: ${category.entities.join(", ")}`);
    }
  }

  if (model.relationships.length) {
    lines.push("", `Relationships (${model.relationships.length}):`);
    for (const relationship of model.relationships) {
      lines.push(
        `  - ${relationship.sourceEntity} ${cardinalityPhrase(relationship.cardinality)} ${relationship.targetEntity}`
      );
    }
  }

  const counts = [
    model.rules?.length ? `${model.rules.length} business rules` : null,
    model.sagas?.length ? `${model.sagas.length} multi-step processes` : null,
    model.workflows?.length ? `${model.workflows.length} lifecycle workflows` : null,
  ].filter(Boolean);
  if (counts.length) lines.push("", `It declares ${counts.join(", ")}.`);

  return {
    id: "overview",
    kind: "overview",
    name: model.name ?? "model",
    text: lines.join("\n"),
    metadata: { kind: "overview", name: model.name ?? "model", source },
  };
}

/**
 * One entity, with everything bound to it.
 *
 * The relationships are rendered from both directions and the rules and
 * workflows that name the entity are listed here too, because the question
 * people actually ask is "tell me about Sample" — and an answer that omits the
 * workflow that deletes Samples is wrong in the way that matters.
 */
function entityChunks(model: RagModel, source: string): RagChunk[] {
  return model.entities.map((entity) => {
    const lines: string[] = [`Entity ${entity.name} (database table ${entity.tableName}).`];
    if (entity.description) lines.push(entity.description);

    const category = model.categories?.find((c) => c.entities.includes(entity.name));
    if (category) lines.push(`Belongs to the "${category.name}" group.`);

    lines.push("", `Fields (primary key ${entity.primaryKey}):`);
    for (const attribute of entity.attributes) lines.push(attributeLine(attribute));

    const outgoing = model.relationships.filter((r) => r.sourceEntity === entity.name);
    const incoming = model.relationships.filter((r) => r.targetEntity === entity.name);
    if (outgoing.length || incoming.length) {
      lines.push("", "Relationships:");
      for (const relationship of outgoing) {
        lines.push(
          `  - ${entity.name} ${cardinalityPhrase(relationship.cardinality)} ${relationship.targetEntity}`
        );
      }
      for (const relationship of incoming) {
        lines.push(
          `  - ${relationship.sourceEntity} ${cardinalityPhrase(relationship.cardinality)} ${entity.name}`
        );
      }
    }

    const rules = (model.rules ?? []).filter((rule) => rule.entity === entity.name);
    if (rules.length) {
      lines.push("", "Business rules on this entity:");
      for (const rule of rules) lines.push(`  - ${rule.name}, runs on ${rule.event}`);
    }

    const sagas = (model.sagas ?? []).filter((saga) =>
      entitiesTouchedBySaga(saga).includes(entity.name)
    );
    if (sagas.length) {
      lines.push("", "Processes that read or write this entity:");
      for (const saga of sagas) {
        const own = saga.entity === entity.name;
        lines.push(
          `  - ${saga.name} (${own ? `runs on ${entity.name} ${saga.operation}` : `writes to ${entity.name} from a ${saga.entity} process`})`
        );
      }
    }

    return {
      id: `entity:${entity.name}`,
      kind: "entity" as const,
      name: entity.name,
      text: lines.join("\n"),
      metadata: {
        kind: "entity" as const,
        name: entity.name,
        entity: entity.name,
        source,
      },
    };
  });
}

/** Enums together — each is a line, and one per chunk would be noise. */
function enumChunks(model: RagModel, source: string): RagChunk[] {
  return (model.enums ?? []).map((declaration) => ({
    id: `enum:${declaration.name}`,
    kind: "enums" as const,
    name: declaration.name,
    // One chunk per enumeration, not one chunk listing all of them.
    //
    // Pooled, a model's two dozen enumerations averaged into a single vector
    // that matched no question about any of them: "what statuses can a
    // deviation report have" retrieved the DeviationReport entity, which names
    // its `status` field without saying what may go in it. Alone, each
    // declaration embeds its own name beside its own values, which is what the
    // question is actually asking for.
    text:
      `The ${declaration.name} enumeration. A field of this type may be ` +
      `one of: ${declaration.values.join(", ")}.`,
    metadata: { kind: "enums" as const, name: declaration.name, source },
  }));
}

/** One rule, with its decision logic spelled out. */
function ruleChunks(model: RagModel, source: string): RagChunk[] {
  return (model.rules ?? []).map((rule) => {
    const lines: string[] = [
      `Business rule "${rule.name}" on ${rule.entity}.`,
      `Runs on ${rule.event} (${rule.operation})${rule.priority !== undefined ? `, priority ${rule.priority}` : ""}.`,
    ];
    const logic = describeJdm(rule.jdmContent);
    if (logic.length) {
      lines.push("", "Logic:");
      lines.push(...logic);
    }
    return {
      id: `rule:${rule.name}`,
      kind: "rule" as const,
      name: rule.name,
      text: lines.join("\n"),
      metadata: {
        kind: "rule" as const,
        name: rule.name,
        entity: rule.entity,
        operation: rule.operation,
        event: rule.event,
        source,
      },
    };
  });
}

/** One process, its steps in order, and the entities it reaches. */
function sagaChunks(model: RagModel, source: string): RagChunk[] {
  return (model.sagas ?? []).map((saga) => {
    const touched = entitiesTouchedBySaga(saga);
    const lines: string[] = [
      `Multi-step process "${saga.name}" on ${saga.entity}.`,
      saga.trigger === "rule"
        ? "Runs only when a business rule triggers it by name."
        : `Runs automatically on ${saga.entity} ${saga.operation}.`,
    ];

    lines.push("", "Steps, in order:");
    for (const [index, step] of (saga.steps ?? []).entries()) {
      lines.push(describeStep(step, index, saga.entity));
    }

    if (touched.length > 1) {
      lines.push("", `Entities written by this process: ${touched.join(", ")}.`);
    }

    return {
      id: `workflow:${saga.name}`,
      kind: "workflow" as const,
      name: saga.name,
      text: lines.join("\n"),
      metadata: {
        kind: "workflow" as const,
        name: saga.name,
        entity: saga.entity,
        operation: saga.operation,
        touches: touched,
        source,
      },
    };
  });
}

/** State machines and lifecycle-hook sets. */
function workflowChunks(model: RagModel, source: string): RagChunk[] {
  return (model.workflows ?? []).map((workflow) => {
    const lines: string[] = [`Lifecycle workflow "${workflow.name}" on ${workflow.entity}.`];
    if (workflow.states?.length) {
      lines.push("", `Statuses: ${workflow.states.join(" → ")}.`);
    }
    if (workflow.hooks?.length) {
      lines.push("", "Lifecycle handlers:");
      for (const hook of workflow.hooks) lines.push(`  - ${hook.type}: ${hook.handler}`);
    }
    return {
      id: `workflow:${workflow.name}`,
      kind: "workflow" as const,
      name: workflow.name,
      text: lines.join("\n"),
      metadata: {
        kind: "workflow" as const,
        name: workflow.name,
        entity: workflow.entity,
        source,
      },
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  Entry points                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Read `%%enum` declarations straight from the document.
 *
 * The parsed model does not carry them — the generator resolves enums into
 * column constraints and has no reason to keep the list. Retrieval does: "which
 * statuses can a Sample have?" is answered by the declaration and by nothing
 * else in the model.
 */
export function extractEnums(eml: string): { name: string; values: string[] }[] {
  // Keyed by name so a redeclaration replaces rather than appends. Models do
  // repeat a declaration — drug-discovery declares ExperimentStatus twice — and
  // while a duplicate is harmless while enums are a list, it stops being
  // harmless the moment each one becomes a chunk with an id derived from its
  // name: two chunks would claim the same id, and the id is what makes
  // re-ingesting a model replace its chunks instead of accumulating them.
  const byName = new Map<string, string[]>();

  for (const line of eml.split("\n")) {
    const match = /^\s*%%enum\s+([A-Za-z_][\w]*)\s*:\s*(.+)$/.exec(line);
    if (!match) continue;
    const values = (match[2] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (match[1] && values.length) byName.set(match[1], values);
  }

  return [...byName].map(([name, values]) => ({ name, values }));
}

/**
 * Chunk a parsed model.
 *
 * `source` is recorded on every chunk so an answer can say where it came from —
 * a project's own model, or the language specification.
 */
export function chunkModel(model: RagModel, source = "model"): RagChunk[] {
  const chunks: RagChunk[] = [overviewChunk(model, source), ...entityChunks(model, source)];
  chunks.push(
    ...enumChunks(model, source),
    ...ruleChunks(model, source),
    ...sagaChunks(model, source),
    ...workflowChunks(model, source)
  );
  return chunks;
}

/**
 * Chunk a markdown document by heading.
 *
 * Used for the EML specification, which is what an assistant needs in order to
 * write a `%%step` or a `%%rule` correctly rather than inventing a directive
 * that looks plausible and does not parse. Sections carry their heading trail
 * so a chunk taken from deep in a document still says what it is about.
 */
export function chunkMarkdown(markdown: string, source: string): RagChunk[] {
  const lines = markdown.split("\n");
  const chunks: RagChunk[] = [];

  let heading = source;
  let trail: string[] = [];
  let buffer: string[] = [];
  let index = 0;

  const flush = () => {
    const body = buffer.join("\n").trim();
    buffer = [];
    if (!body) return;
    chunks.push({
      id: `spec:${source}:${index++}`,
      kind: "spec",
      name: heading,
      // The heading trail leads the text, so the embedding carries the context
      // the words alone would lose.
      text: `${trail.join(" › ")}\n\n${body}`,
      metadata: { kind: "spec", name: heading, source },
    });
  };

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (match) {
      flush();
      const depth = match[1]?.length ?? 1;
      heading = (match[2] ?? "").trim();
      trail = [...trail.slice(0, depth - 1), heading];
      continue;
    }
    buffer.push(line);
  }
  flush();

  return chunks;
}
