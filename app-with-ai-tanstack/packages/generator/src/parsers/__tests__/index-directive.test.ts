/**
 * `%%index` has to reach the database.
 *
 * The directive was reserved, documented and validated by the checker, but no
 * parser ever read it — so every declaration in every model produced nothing.
 * It looked like it worked: the three `unique` declarations in the
 * drug-discovery model all name columns that also carry `UK`, and the `UK`
 * convention emits an index of its own, so the expected index existed and the
 * directive appeared to be doing it. The composite declarations, which no
 * convention can produce, were the ones that quietly went missing.
 *
 * These tests cover the parse and the merge. The merge matters as much as the
 * parse: both sources name an index after its columns, so emitting them
 * independently produced two `CREATE INDEX IF NOT EXISTS` statements with the
 * same name, and the second — the one carrying `unique` — was the no-op.
 */

import { entityToBusEntity } from "@appwithai/core/types";
import { describe, expect, it } from "vitest";
import { MermaidParser } from "../mermaid.parser";

const parse = (source: string) => new MermaidParser().parse(source);

const MODEL = `erDiagram
    Contact {
        string id PK
        string email UK
        string name
        string company_id FK
        string status
    }

    %%index Contact(company_id, status)
    %%index Contact(email) unique
`;

describe("%%index", () => {
  it("reads a composite declaration in the order written", () => {
    const contact = parse(MODEL).entities.find((e) => e.name === "Contact");
    expect(contact?.indexes).toContainEqual({
      columns: ["company_id", "status"],
      unique: false,
    });
  });

  it("reads the unique flag", () => {
    const contact = parse(MODEL).entities.find((e) => e.name === "Contact");
    expect(contact?.indexes).toContainEqual({ columns: ["email"], unique: true });
  });

  it("ignores a declaration naming an unknown entity", () => {
    // The migration would fail on a table that does not exist, and a migration
    // that cannot apply is worse than a missing index.
    const { entities } = parse(`${MODEL}\n    %%index Ghost(id)\n`);
    expect(entities.some((e) => e.name === "Ghost")).toBe(false);
  });

  it("ignores a declaration naming a column the entity does not have", () => {
    const { entities } = parse(`${MODEL}\n    %%index Contact(nope)\n`);
    const contact = entities.find((e) => e.name === "Contact");
    expect(contact?.indexes?.some((i) => i.columns.includes("nope"))).toBe(false);
  });

  it("leaves ordinary %% comments alone", () => {
    const { entities } = parse(`${MODEL}\n    %% just a note about indexes\n`);
    expect(entities.find((e) => e.name === "Contact")?.indexes).toHaveLength(2);
  });
});

describe("merging declared indexes with the conventional ones", () => {
  const contact = entityToBusEntity(
    parse(MODEL).entities.find((e) => e.name === "Contact") as never
  );
  const names = contact.indexes?.map((i) => i.columns.join(","));

  it("keeps one index per column set", () => {
    expect(names).toHaveLength(new Set(names).size);
  });

  it("lets the declaration win over the convention on overlap", () => {
    // `email` is both UK and explicitly declared unique. One index, unique —
    // not two with the same name where the unique one is silently skipped.
    const email = contact.indexes?.filter((i) => i.columns.join(",") === "email");
    expect(email).toHaveLength(1);
    expect(email?.[0]?.unique).toBe(true);
  });

  it("still adds the conventional index for a column with no declaration", () => {
    expect(contact.indexes).toContainEqual({ columns: ["name"], unique: false });
  });

  it("keeps the composite, which no convention would produce", () => {
    expect(contact.indexes).toContainEqual({
      columns: ["company_id", "status"],
      unique: false,
    });
  });
});
