import { describe, expect, it } from "vitest";
import { compileHooks, hooksByEntity } from "../index";

const ENTITIES = ["Compound", "Experiment", "ChemicalInventory"];

describe("compileHooks", () => {
  it("reads a directive with its event, handler and entity", () => {
    const hooks = compileHooks("    %%hook beforeCreate generateInchiKey on Compound", ENTITIES);

    expect(hooks).toHaveLength(1);
    expect(hooks[0]).toMatchObject({
      entity: "Compound",
      type: "beforeCreate",
      handler: "generateInchiKey",
    });
    expect(hooks[0]?.field).toBeUndefined();
  });

  // Regression: ISSUE-003 — the scan matched `%%hook` anywhere in a line, so a
  // plain `%%` comment that merely mentioned a hook compiled into a real one:
  // a handler module and a registered lifecycle binding nobody declared, with
  // no warning. The shipped example models all carry prose headers like this.
  // Found by /qa on 2026-09-01
  // Report: .gstack/qa-reports/qa-report-dance-studio-qa-2026-09-01.md
  it("does not read a directive out of the middle of a prose comment", () => {
    const warnings: string[] = [];
    const source = `
%% Passwords are hashed on the way in. See %%hook beforeCreate hashPassword on Compound
%% for how that is wired; the registry never stores a plaintext one.
%% Every %%hook lifecycle event is exercised somewhere in this model.
`;
    expect(compileHooks(source, ENTITIES, (m) => warnings.push(m))).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("still reads a directive indented, or with the doubled %% older diagrams wrote", () => {
    expect(
      compileHooks("      %%hook afterCreate indexForSearch on Compound", ENTITIES)
    ).toHaveLength(1);
    expect(compileHooks("%%%%hook afterCreate indexForSearch on Compound", ENTITIES)).toHaveLength(
      1
    );
  });

  it("reads the field a directive scopes to", () => {
    const hooks = compileHooks(
      "%%hook customValidate validateSmiles on Compound[field: smiles]",
      ENTITIES
    );
    expect(hooks[0]?.field).toBe("smiles");
  });

  it("finds directives inside a workflow section, past the diagram", () => {
    const source = `
%%meta name: Compound Registration
%%workflow CompoundRegistration entity: Compound kind: hook
flowchart TD
    request[Request] --> validate[Validate Compound]
    validate --> step1[beforeCreate: generateInchiKey]

    %%hook beforeCreate generateInchiKey on Compound[field: inchi_key]
    %%hook afterCreate indexForSearch on Compound
`;
    const hooks = compileHooks(source, ENTITIES);
    expect(hooks.map((hook) => hook.handler)).toEqual(["generateInchiKey", "indexForSearch"]);
  });

  it("tolerates the doubled %% older generated flowcharts emitted", () => {
    const hooks = compileHooks("    %%%%hook afterCreate notifyTeam on Compound", ENTITIES);
    expect(hooks).toHaveLength(1);
    expect(hooks[0]?.handler).toBe("notifyTeam");
  });

  it("drops a hook on an entity the model does not declare", () => {
    const warnings: string[] = [];
    const hooks = compileHooks("%%hook beforeCreate doThing on Nonexistent", ENTITIES, (message) =>
      warnings.push(message)
    );

    expect(hooks).toHaveLength(0);
    expect(warnings[0]).toContain("unknown entity");
  });

  it("drops a hook bound to an event that is not a lifecycle event", () => {
    const warnings: string[] = [];
    const hooks = compileHooks("%%hook whenever doThing on Compound", ENTITIES, (message) =>
      warnings.push(message)
    );

    expect(hooks).toHaveLength(0);
    expect(warnings[0]).toContain("unknown event");
  });

  it("keeps the first of two identical directives", () => {
    const warnings: string[] = [];
    const hooks = compileHooks(
      ["%%hook beforeCreate stamp on Compound", "%%hook beforeCreate stamp on Compound"].join("\n"),
      ENTITIES,
      (message) => warnings.push(message)
    );

    expect(hooks).toHaveLength(1);
    expect(warnings[0]).toContain("declared twice");
  });

  it("refuses one handler name serving two events on the same entity", () => {
    // Both would become the same exported function in the entity's module.
    const warnings: string[] = [];
    const hooks = compileHooks(
      ["%%hook beforeCreate stamp on Compound", "%%hook beforeUpdate stamp on Compound"].join("\n"),
      ENTITIES,
      (message) => warnings.push(message)
    );

    expect(hooks).toHaveLength(1);
    expect(hooks[0]?.type).toBe("beforeCreate");
    expect(warnings[0]).toContain("its own handler name");
  });

  it("allows the same handler name on different entities", () => {
    const hooks = compileHooks(
      ["%%hook beforeCreate stamp on Compound", "%%hook beforeCreate stamp on Experiment"].join(
        "\n"
      ),
      ENTITIES
    );
    expect(hooks).toHaveLength(2);
  });

  it("ignores everything that is not a hook directive", () => {
    const source = [
      "erDiagram",
      "    Compound { uuid id PK }",
      "%%rule sampleExpiry on Sample event: beforeUpdate",
      "%%category Compound Registry: Compound",
    ].join("\n");

    expect(compileHooks(source, ENTITIES)).toEqual([]);
  });

  it("groups by entity in declaration order", () => {
    const hooks = compileHooks(
      [
        "%%hook beforeCreate one on Compound",
        "%%hook beforeUpdate two on Experiment",
        "%%hook afterCreate three on Compound",
      ].join("\n"),
      ENTITIES
    );

    const grouped = hooksByEntity(hooks);
    expect([...grouped.keys()].sort()).toEqual(["Compound", "Experiment"]);
    expect(grouped.get("Compound")?.map((hook) => hook.handler)).toEqual(["one", "three"]);
  });
});

/**
 * The generated registry and the generated `getHooks` must agree on how an
 * entity identifier is normalised, because the identifier reaching the service
 * is whatever the caller used: the REST route sends `bus_compound`, the UI
 * sends `chemical-inventory`, the model says `ChemicalInventory`. This is a
 * copy of the function the generator emits — if it changes there, it changes
 * here, and this test says what it has to keep satisfying.
 */
function hookKey(entity: string): string {
  const flat = entity.toLowerCase().replace(/^bus_/, "").replace(/[_-]/g, "");
  return flat.endsWith("s") && !flat.endsWith("ss") ? flat.slice(0, -1) : flat;
}

describe("hookKey", () => {
  it("resolves every spelling of a single-word entity to one key", () => {
    const keys = ["Compound", "compound", "compounds", "bus_compound", "bus_compounds"].map(
      hookKey
    );
    expect(new Set(keys).size).toBe(1);
  });

  it("resolves every spelling of a multi-word entity to one key", () => {
    const keys = [
      "ChemicalInventory",
      "chemical-inventory",
      "chemical_inventory",
      "bus_chemical_inventory",
    ].map(hookKey);
    expect(new Set(keys).size).toBe(1);
  });

  it("keeps a double-s ending intact", () => {
    expect(hookKey("Address")).toBe("address");
    expect(hookKey("bus_address")).toBe("address");
  });

  it("keeps distinct entities distinct", () => {
    expect(hookKey("Compound")).not.toBe(hookKey("CompoundAlias"));
  });
});
