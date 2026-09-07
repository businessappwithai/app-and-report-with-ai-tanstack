import { describe, expect, it } from "vitest";
import { snakeCase } from "../naming";

// Regression: ISSUE-008 — snakeCase("CAPA") returned "c_a_p_a", so the
// generated migration emitted
//   ALTER TABLE bus_c_a_p_a ADD CONSTRAINT fk_bus_c_a_p_a_deviation_report_id
// against a table created as bus_capa. The DeviationReport -> CAPA foreign key
// silently never landed in the generated drug-discovery database.
// Found by /qa on 2026-07-30
// Report: .gstack/qa-reports/qa-report-localhost-3000-2026-07-30.md

describe("snakeCase", () => {
  it("keeps an all-caps acronym as one word", () => {
    expect(snakeCase("CAPA")).toBe("capa");
    expect(snakeCase("API")).toBe("api");
  });

  it("agrees with the table name derived for the same entity", () => {
    // packages/generator/src/parsers/mermaid.parser.ts#toSnakeCase produces
    // "capa" for this entity; the FK template must target the same table.
    expect(`bus_${snakeCase("CAPA")}`).toBe("bus_capa");
  });

  it("leaves screaming-snake identifiers intact apart from case", () => {
    expect(snakeCase("API_KEY")).toBe("api_key");
    expect(snakeCase("DATABASE_URL")).toBe("database_url");
  });

  it("still splits PascalCase and camelCase", () => {
    expect(snakeCase("DeviationReport")).toBe("deviation_report");
    expect(snakeCase("StabilityPull")).toBe("stability_pull");
    expect(snakeCase("compoundId")).toBe("compound_id");
  });

  it("passes through names that are already snake_case", () => {
    expect(snakeCase("deviation_report_id")).toBe("deviation_report_id");
  });

  // A space before a capital hit both the capital rule and the separator rule
  // and got an underscore from each, so a project called "Drug Discovery Live"
  // generated a database named "drug__discovery__live".
  it("collapses a separator that is also a word boundary", () => {
    expect(snakeCase("Drug Discovery Live")).toBe("drug_discovery_live");
    expect(snakeCase("Stability Test")).toBe("stability_test");
    expect(snakeCase("Round-Trip Check")).toBe("round_trip_check");
  });

  it("normalizes hyphens", () => {
    expect(snakeCase("stability-test")).toBe("stability_test");
  });

  it("returns an empty string for empty input", () => {
    expect(snakeCase("")).toBe("");
  });
});
