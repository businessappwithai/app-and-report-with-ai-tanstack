import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseModel } from "../../pipeline/generate-application";
import { chunkMarkdown, chunkModel, extractEnums, type RagModel } from "../index";

/**
 * The chunker's job is to keep semantic units whole. These assert the two
 * things a character-window splitter gets wrong: a unit is never cut in half,
 * and a chunk says enough on its own to answer a question about it.
 */

const ROOT = join(import.meta.dirname, "../../../../..");
const EML = readFileSync(join(ROOT, "examples/drug-discovery.eml.mmd"), "utf-8");

function drugDiscovery(): RagModel {
  const parsed = parseModel(EML);
  return {
    name: "Drug Discovery",
    entities: parsed.entities,
    relationships: parsed.relationships,
    categories: parsed.categories,
    enums: extractEnums(EML),
    rules: parsed.rules.map((rule) => ({
      name: rule.name,
      entity: rule.entity,
      event: rule.event,
      operation: rule.operation,
      priority: rule.priority,
      jdmContent: rule.jdmContent,
    })),
    sagas: parsed.sagas,
  };
}

describe("chunkModel", () => {
  const chunks = chunkModel(drugDiscovery(), "drug-discovery");
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));

  it("emits one chunk per entity, rule and process", () => {
    const kinds = chunks.reduce<Record<string, number>>((counts, chunk) => {
      counts[chunk.kind] = (counts[chunk.kind] ?? 0) + 1;
      return counts;
    }, {});

    expect(kinds.overview).toBe(1);
    expect(kinds.entity).toBe(19);
    expect(kinds.rule).toBe(3);
    expect(kinds.workflow).toBe(3);
    // One per declaration, not one for all of them: pooled, two dozen
    // enumerations averaged into a vector that matched no question about
    // any of them.
    expect(kinds.enums).toBe(30);
  });

  it("gives every chunk a stable id, so re-ingesting replaces rather than duplicates", () => {
    const ids = chunks.map((chunk) => chunk.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(chunkModel(drugDiscovery(), "drug-discovery").map((c) => c.id)).toEqual(ids);
  });

  // An entity chunk has to carry its own context. Retrieved alone it is the
  // whole answer to "tell me about CAPA".
  it("keeps an entity whole, with its fields and both sides of its relationships", () => {
    const capa = byId.get("entity:CAPA");
    expect(capa).toBeDefined();
    expect(capa?.text).toContain("Entity CAPA");
    expect(capa?.text).toContain("required_resolution_date");
    expect(capa?.text).toContain("DeviationReport has many CAPA");
  });

  // The cross-entity reach is the part a naive splitter cannot recover: the
  // saga is declared on DeviationReport and never mentions CAPA in its header.
  it("tells an entity about processes that write to it from elsewhere", () => {
    expect(byId.get("entity:CAPA")?.text).toContain("CriticalDeviationEscalation");
  });

  it("spells out a decision table's rows inside the process that carries it", () => {
    const escalation = chunks.find((chunk) => chunk.name === "CriticalDeviationEscalation");
    expect(escalation?.text).toContain('when "critical"');
    expect(escalation?.text).toContain("capaCategory = 'immediate_containment'");
  });

  it("records the steps of a process in order, and what each one touches", () => {
    const retirement = chunks.find((chunk) => chunk.name === "AssayRetirement");
    expect(retirement?.text).toContain("Runs automatically on Assay DELETE");
    expect(retirement?.text).toContain("deletes AssayRun rows");
    expect(retirement?.metadata.touches).toContain("AssayRun");
    expect(retirement?.metadata.operation).toBe("DELETE");
  });

  it("carries filterable metadata on every chunk", () => {
    for (const chunk of chunks) {
      expect(chunk.metadata.kind).toBe(chunk.kind);
      expect(chunk.metadata.source).toBe("drug-discovery");
      expect(chunk.text.trim().length).toBeGreaterThan(0);
    }
  });

  // Measured against a real embedding model: pooled into one chunk, two dozen
  // enumerations averaged into a vector that lost to the entity chunk for
  // "what statuses can a deviation report have" — and the entity chunk names
  // the `status` field without saying what may go in it. One chunk each, with
  // the name beside its values, puts the right answer first.
  it("gives each enumeration its own chunk, naming it beside its values", () => {
    const status = byId.get("enum:DeviationStatus");

    expect(status).toBeDefined();
    expect(status?.name).toBe("DeviationStatus");
    expect(status?.text).toContain("DeviationStatus");
    expect(status?.text).toContain("under_investigation");
    // The severity enum is a separate chunk, not pooled with it.
    expect(byId.get("enum:DeviationSeverity")?.text).toContain("catastrophic");
  });

  it("lists the entities in an overview no single entity chunk could answer", () => {
    const overview = byId.get("overview");
    expect(overview?.text).toContain("Entities (19)");
    expect(overview?.text).toContain("AssayResult");
  });
});

describe("extractEnums", () => {
  it("reads the declarations the parsed model drops", () => {
    const enums = extractEnums(EML);
    const severity = enums.find((declaration) => declaration.name === "DeviationSeverity");
    expect(severity?.values).toEqual(["minor", "major", "critical", "catastrophic"]);
  });
});

describe("chunkMarkdown", () => {
  const spec = readFileSync(join(ROOT, "language/spec/03-workflows.md"), "utf-8");
  const chunks = chunkMarkdown(spec, "spec/03-workflows.md");

  it("splits on headings rather than on length", () => {
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((chunk) => chunk.kind === "spec")).toBe(true);
  });

  // A section taken from deep in a document is meaningless without knowing
  // which part of the document it came from.
  it("leads each chunk with its heading trail", () => {
    const nested = chunks.find((chunk) => chunk.text.includes("›"));
    expect(nested).toBeDefined();
    expect(nested?.text.split("\n")[0]).toContain("EML");
  });
});
