import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toRenderableMermaid } from "../mermaid-render";

// Regression: ISSUE-003 — examples/drug-discovery.eml.mmd rendered as
// "No entities defined yet" in the design page's Live Preview because the raw
// EML document was handed straight to mermaid.render(), which rejects EML's
// %% directives, trailing rule/workflow diagrams, and OPTIONAL modifier.
// Found by /qa on 2026-07-30
// Report: .gstack/qa-reports/qa-report-localhost-3000-2026-07-30.md

const EXAMPLE_PATH = path.resolve(__dirname, "../../../../../examples/drug-discovery.eml.mmd");

describe("toRenderableMermaid", () => {
  it("strips the %% banner so output starts at erDiagram", () => {
    const out = toRenderableMermaid(`%% a banner comment
%%meta name: Thing
erDiagram
    Author {
        string id PK
    }`);

    expect(out.startsWith("erDiagram")).toBe(true);
    expect(out).not.toContain("%%");
  });

  it("drops OPTIONAL and NULL, which Mermaid's ER grammar rejects", () => {
    const out = toRenderableMermaid(`erDiagram
    User {
        string id PK
        string team_id FK OPTIONAL
        string note NULL
    }`);

    expect(out).not.toMatch(/\bOPTIONAL\b/);
    expect(out).not.toMatch(/\bNULL\b/);
    expect(out).toContain("string team_id FK");
    expect(out).toContain("string note");
  });

  it("rewrites the UNIQUE alias to UK", () => {
    const out = toRenderableMermaid(`erDiagram
    User {
        string email UNIQUE
    }`);

    expect(out).toContain("string email UK");
    expect(out).not.toContain("UNIQUE");
  });

  it("cuts the document at the first diagram that follows the ERD", () => {
    const out = toRenderableMermaid(`erDiagram
    Author {
        string id PK
    }

flowchart TD
    A --> B

stateDiagram-v2
    [*] --> draft`);

    expect(out).toContain("Author");
    expect(out).not.toContain("flowchart");
    expect(out).not.toContain("stateDiagram");
    expect(out).not.toContain("[*]");
  });

  it("passes non-ERD diagrams through untouched", () => {
    const flowchart = `flowchart TD\n    A --> B`;
    expect(toRenderableMermaid(flowchart)).toBe(flowchart);
  });

  it("reduces the shipped drug-discovery EML example to a single clean ERD", () => {
    const raw = readFileSync(EXAMPLE_PATH, "utf8");
    const out = toRenderableMermaid(raw);

    expect(out.startsWith("erDiagram")).toBe(true);
    // All 19 entities survive the reduction — the first declared and the last,
    // so the assertion catches a truncation at either end rather than only a
    // miscount.
    expect(out).toContain("Program {");
    expect(out).toContain("Team {");
    expect((out.match(/^\s{4}\w+ \{$/gm) ?? []).length).toBe(19);
    // Everything Mermaid chokes on is gone.
    expect(out).not.toContain("%%");
    expect(out).not.toMatch(/\bOPTIONAL\b/);
    expect(out).not.toMatch(/^(flowchart|stateDiagram)/m);
  });
});
