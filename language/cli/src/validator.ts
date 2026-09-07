/**
 * EML validator with self-correction.
 *
 * Validates a parsed {@link EmlModel} against the language definition and, when
 * `autofix` is enabled, repairs the fixable problems in place (recording each
 * repair as an `info` diagnostic with a `fix` note). Remaining problems are
 * reported as `error`/`warning` diagnostics.
 *
 * Self-corrections applied:
 *  - Entity with no primary key           -> add `string id PK`
 *  - Duplicate attribute names            -> drop later duplicates
 *  - Relationship endpoint not an entity  -> synthesize a minimal entity
 *  - Hook bound to unknown entity         -> synthesize a minimal entity
 *  - Enum reference with no %%enum        -> warn (kept, treated as free string)
 *  - Duplicate entity names               -> merge attribute sets
 *  - Missing document name                -> derive from first entity / default
 */

import { loadLanguageDefinition } from "../../index.ts";
import type { Diagnostic, EmlEntity, EmlModel } from "./model.ts";
import { toSnakeCase } from "./util.ts";

export interface ValidateOptions {
  autofix?: boolean;
}

export interface ValidationSummary {
  errors: number;
  warnings: number;
  fixes: number;
  ok: boolean;
}

const IDENT = /^[A-Za-z][A-Za-z0-9_]*$/;

export function validateModel(model: EmlModel, opts: ValidateOptions = {}): ValidationSummary {
  const fix = opts.autofix ?? false;
  const diags = model.diagnostics;
  const def = loadLanguageDefinition();
  const hookTypeSet = new Set(def.hooks.types.map((h) => h.type));

  const add = (d: Diagnostic) => diags.push(d);

  // --- Document metadata -----------------------------------------------------
  if (!model.meta.name) {
    const derived = model.entities[0]?.name ? `${model.entities[0].name} App` : "EML App";
    if (fix) {
      model.meta.name = derived;
      add({
        severity: "info",
        code: "EML001",
        message: "No document name.",
        fix: `name set to "${derived}"`,
      });
    } else {
      add({ severity: "warning", code: "EML001", message: "No document name (%%meta name:)." });
    }
  }

  // --- Entities: names, duplicates, primary keys, attributes -----------------
  const seenEntities = new Map<string, EmlEntity>();
  for (const entity of [...model.entities]) {
    if (!IDENT.test(entity.name)) {
      add({ severity: "error", code: "EML100", message: `Invalid entity name "${entity.name}".` });
    }

    // Merge duplicate entity declarations.
    const prior = seenEntities.get(entity.name);
    if (prior) {
      if (fix) {
        for (const a of entity.attributes) {
          if (!prior.attributes.some((p) => p.name === a.name)) prior.attributes.push(a);
        }
        model.entities.splice(model.entities.indexOf(entity), 1);
        add({
          severity: "info",
          code: "EML101",
          message: `Duplicate entity "${entity.name}".`,
          fix: "merged attributes into the first declaration",
        });
        continue;
      }
      add({ severity: "error", code: "EML101", message: `Duplicate entity "${entity.name}".` });
    } else {
      seenEntities.set(entity.name, entity);
    }

    // Duplicate attribute names.
    const seenAttrs = new Set<string>();
    for (let i = entity.attributes.length - 1; i >= 0; i--) {
      const a = entity.attributes[i];
      if (!a) continue;
      if (seenAttrs.has(a.name)) {
        if (fix) {
          entity.attributes.splice(i, 1);
          add({
            severity: "info",
            code: "EML102",
            message: `Duplicate attribute "${entity.name}.${a.name}".`,
            fix: "removed the duplicate",
          });
        } else {
          add({
            severity: "warning",
            code: "EML102",
            message: `Duplicate attribute "${entity.name}.${a.name}".`,
          });
        }
      } else {
        seenAttrs.add(a.name);
      }
    }

    // Primary key presence.
    const hasPk = entity.attributes.some((a) => a.isPrimaryKey);
    if (!hasPk) {
      if (fix) {
        entity.attributes.unshift({
          name: "id",
          type: "string",
          rawType: "string",
          required: true,
          unique: true,
          isPrimaryKey: true,
          isForeignKey: false,
        });
        entity.primaryKey = "id";
        add({
          severity: "info",
          code: "EML103",
          message: `Entity "${entity.name}" had no primary key.`,
          fix: "added `string id PK`",
        });
      } else {
        add({
          severity: "warning",
          code: "EML103",
          message: `Entity "${entity.name}" has no primary key.`,
        });
      }
    }
  }

  const entityNames = new Set(model.entities.map((e) => e.name));

  // --- Relationships: endpoints must be entities -----------------------------
  for (const rel of model.relationships) {
    for (const endpoint of [rel.source, rel.target]) {
      if (!entityNames.has(endpoint)) {
        if (fix) {
          const synth = synthEntity(endpoint);
          model.entities.push(synth);
          entityNames.add(endpoint);
          add({
            severity: "info",
            code: "EML120",
            message: `Relationship references undeclared entity "${endpoint}".`,
            fix: "synthesized a minimal entity",
          });
        } else {
          add({
            severity: "error",
            code: "EML120",
            message: `Relationship references undeclared entity "${endpoint}".`,
          });
        }
      }
    }
  }

  // --- Hooks: valid type + known entity --------------------------------------
  for (const hook of model.hooks) {
    if (!hookTypeSet.has(hook.type)) {
      add({ severity: "error", code: "EML202", message: `Unknown hook type "${hook.type}".` });
    }
    if (!entityNames.has(hook.entity)) {
      if (fix) {
        model.entities.push(synthEntity(hook.entity));
        entityNames.add(hook.entity);
        add({
          severity: "info",
          code: "EML210",
          message: `Hook "${hook.handler}" bound to undeclared entity "${hook.entity}".`,
          fix: "synthesized a minimal entity",
        });
      } else {
        add({
          severity: "warning",
          code: "EML210",
          message: `Hook "${hook.handler}" bound to undeclared entity "${hook.entity}".`,
        });
      }
    }
  }

  // --- Enum references resolve to a declared %%enum --------------------------
  const enumNames = new Set(model.enums.map((e) => e.name));
  for (const entity of model.entities) {
    for (const attr of entity.attributes) {
      if (attr.enumRef && !enumNames.has(attr.enumRef)) {
        add({
          severity: "warning",
          code: "EML130",
          message: `Field "${entity.name}.${attr.name}" references unknown enum "${attr.enumRef}"; treated as free string.`,
        });
      }
    }
  }

  // --- Rules: must have input and output -------------------------------------
  for (const rule of model.rules) {
    const hasInput = rule.nodes.some((n) => n.jdmType === "inputNode");
    const hasOutput = rule.nodes.some((n) => n.jdmType === "outputNode");
    if (!hasInput || !hasOutput) {
      add({
        severity: "warning",
        code: "EML300",
        message: `Rule "${rule.name}" should have a start (input) and an end (output) node.`,
      });
    }
    if (rule.entity && !entityNames.has(rule.entity)) {
      add({
        severity: "warning",
        code: "EML301",
        message: `Rule "${rule.name}" bound to undeclared entity "${rule.entity}".`,
      });
    }
  }

  // --- Workflows: state machines should have transitions ---------------------
  for (const wf of model.workflows) {
    if (wf.kind === "state" && wf.transitions.length === 0) {
      add({
        severity: "warning",
        code: "EML400",
        message: `State workflow "${wf.name}" has no transitions.`,
      });
    }
    if (wf.entity && !entityNames.has(wf.entity)) {
      add({
        severity: "warning",
        code: "EML401",
        message: `Workflow "${wf.name}" bound to undeclared entity "${wf.entity}".`,
      });
    }
  }

  const errors = diags.filter((d) => d.severity === "error").length;
  const warnings = diags.filter((d) => d.severity === "warning").length;
  const fixes = diags.filter((d) => d.severity === "info" && d.fix).length;
  return { errors, warnings, fixes, ok: errors === 0 };
}

function synthEntity(name: string): EmlEntity {
  return {
    name,
    tableName: toSnakeCase(name),
    attributes: [
      {
        name: "id",
        type: "string",
        rawType: "string",
        required: true,
        unique: true,
        isPrimaryKey: true,
        isForeignKey: false,
      },
    ],
    primaryKey: "id",
    timestamps: true,
  };
}
