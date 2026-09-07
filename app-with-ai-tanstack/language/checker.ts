#!/usr/bin/env bun
/**
 * EML Language Checker
 * ====================
 * Comprehensive validator for APPWITHAI Modeling Language (.mmd) files.
 * Checks every document against appwithai-language.json and the EML spec.
 *
 * Usage:
 *   bun language/checker.ts <file.mmd> [options]
 *
 * Options:
 *   --strict          Treat warnings as errors (exit 1)
 *   --json            Machine-readable JSON output
 *   --no-color        Disable ANSI colour
 *   --no-hint         Suppress inline hints
 *   --summary         Print summary line only (no per-diagnostic detail)
 *   -h, --help        Show this help
 *
 * Exit codes:
 *   0  clean (no errors; warnings allowed unless --strict)
 *   1  one or more errors (or warnings in --strict mode)
 *   2  bad invocation / file not found
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { EmlAttribute, EmlEntity, EmlModel, EmlRule, EmlWorkflow } from "./cli/src/model";
import { parseEml } from "./cli/src/parser";
import { caps } from "./cli/src/util";
import { loadLanguageDefinition, stepNodeTypes } from "./index";

// ---------------------------------------------------------------------------
// Diagnostic types
// ---------------------------------------------------------------------------

export type Severity = "error" | "warning" | "info";

export interface Issue {
  severity: Severity;
  code: string;
  message: string;
  /** Source line number (1-based) when known. */
  line?: number;
  /** Short actionable fix suggestion. */
  hint?: string;
  /** Extra context line to show below the message. */
  context?: string;
}

export interface CheckResult {
  issues: Issue[];
  errors: number;
  warnings: number;
  infos: number;
  ok: boolean; // no errors
}

// ---------------------------------------------------------------------------
// ANSI colour helpers
// ---------------------------------------------------------------------------

/**
 * Colour only when a terminal is on the other end.
 *
 * Guarded rather than assumed because this module is imported by the browser
 * bundle, where `process` does not exist and reading `process.stdout` at module
 * scope would throw before a single check could run.
 */
const useColor =
  typeof process !== "undefined" &&
  !process.env?.NO_COLOR &&
  Boolean(process.stdout?.isTTY) &&
  !hasFlag("--no-color");

const c = {
  reset: (s: string) => (useColor ? `\x1b[0m${s}\x1b[0m` : s),
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  cyan: (s: string) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
  magenta: (s: string) => (useColor ? `\x1b[35m${s}\x1b[0m` : s),
  blue: (s: string) => (useColor ? `\x1b[34m${s}\x1b[0m` : s),
};

function sevColor(s: Severity): (str: string) => string {
  return s === "error" ? c.red : s === "warning" ? c.yellow : c.cyan;
}

function sevLabel(s: Severity): string {
  return s === "error" ? "error" : s === "warning" ? "warn " : "info ";
}

// ---------------------------------------------------------------------------
// Argument helpers
// ---------------------------------------------------------------------------

function hasFlag(name: string): boolean {
  return typeof process !== "undefined" && (process.argv?.includes(name) ?? false);
}

// ---------------------------------------------------------------------------
// Source line tracking (for accurate line numbers in checks that re-parse raw)
// ---------------------------------------------------------------------------

class SourceIndex {
  private lines: string[];

  constructor(source: string) {
    this.lines = source.split("\n");
  }

  /** Find the 1-based line number of the first occurrence of a pattern. */
  findLine(pattern: string | RegExp, startLine = 1): number | undefined {
    for (let i = startLine - 1; i < this.lines.length; i++) {
      const line = this.lines[i]!;
      if (typeof pattern === "string" ? line.includes(pattern) : pattern.test(line)) {
        return i + 1;
      }
    }
    return undefined;
  }

  /** Return the text of a line (1-based). */
  getLine(n: number): string {
    return this.lines[n - 1] ?? "";
  }

  /** Lines containing a token, returning {lineNo, text} pairs. */
  findAll(pattern: string | RegExp): Array<{ lineNo: number; text: string }> {
    const results: Array<{ lineNo: number; text: string }> = [];
    for (let i = 0; i < this.lines.length; i++) {
      const text = this.lines[i]!;
      if (typeof pattern === "string" ? text.includes(pattern) : pattern.test(text)) {
        results.push({ lineNo: i + 1, text });
      }
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// Foreign key naming
// ---------------------------------------------------------------------------

/**
 * FK column names that carry no suffix but still name a person by role.
 * Mirrors `foreignKeys.personRoleColumns.names` in appwithai-language.json.
 */
/**
 * Column names the generator and the state machines both treat as the record's
 * lifecycle. A `kind: state` workflow tracks one of these (EML500), and the
 * Application Dictionary gives it a List reference only when a %%field binds it
 * to an enum (EML146).
 */
export const LIFECYCLE_COLUMN_NAMES = new Set(["status", "state", "stage"]);

/**
 * Column names every generated table already carries.
 *
 * The key, the optimistic-lock counter, the audit pair and the soft-delete
 * pair are the generator's, in both stacks, whether or not a model mentions
 * them. A model that declares one gets EML103 — see the check for what used to
 * happen when it did.
 */
export const MANAGED_COLUMN_NAMES = new Set([
  "version",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "deleted_at",
  "deleted_by",
]);

/* -------------------------------------------------------------------------- */
/*  The automation dialect                                                     */
/*                                                                             */
/*  A constrained profile of the saga form, and the shape the automation        */
/*  builder in every running application writes. It differs in three ways: the  */
/*  workflow is named with `%%workflow name:`, the entity comes from `%%hook`,   */
/*  and a step is spread over several lines with its type behind a `type:` key. */
/*                                                                             */
/*  These mirror packages/generator/src/workflows/steps.ts, which does the same  */
/*  translation for the compiler. They are duplicated rather than imported       */
/*  because language/ is bundled standalone into html/checker.js and cannot      */
/*  reach into packages/ — the same reason PROP_SPLIT exists three times. If      */
/*  one changes, change the others: a checker and a compiler that disagree       */
/*  about a directive is worse than either being wrong alone.                    */
/* -------------------------------------------------------------------------- */

/** `%%workflow name: <name>` — an automation, whose entity comes from %%hook. */
const AUTOMATION_WORKFLOW = /^%%workflow\s+name:\s*\S/;

/** `%%step <nodeId> type: <StepType> [as: <name>]` — the type line. */
const AUTO_TYPE_DIRECTIVE = /^%%step\s+([A-Za-z_]\w*)\s+type:\s*([A-Za-z]\w*)\s*(.*)$/;

/** `%%step <nodeId> <key>: <value>` — one property of an automation step. */
const AUTO_PROP_DIRECTIVE = /^%%step\s+([A-Za-z_]\w*)\s+([A-Za-z_]\w*):\s*(.*)$/;

/**
 * Rewrite automation property names as the saga names the contracts are written
 * in, so every check downstream sees one vocabulary.
 *
 * Mirrors `sagaPropsFromAutomation` in packages/generator/src/workflows/steps.ts.
 * `{{name}}` is how an automation references an earlier step's result; a saga
 * spells the same thing as a bare `source:`/`targetSource:`, so the braces are
 * unwrapped rather than checked as a literal value.
 */
function sagaPropsFromAutomation(
  type: string,
  props: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = { ...props };
  /** `{{x}}` -> `x`, anything else -> null. */
  const ref = (value?: string): string | null =>
    value?.trim().match(/^\{\{\s*([^}]+?)\s*\}\}$/)?.[1] ?? null;
  const move = (from: string, to: string) => {
    const value = out[from];
    if (value !== undefined && out[to] === undefined) out[to] = value;
    delete out[from];
  };

  if (type === "Decision") {
    move("ruleTable", "rule");
    move("table", "decisionTable");
    delete out.inputs;
  } else if (type === "CreateEntity") {
    move("values", "fields");
  } else if (type === "UpdateEntity" || type === "DeleteEntity") {
    const target = ref(out.target);
    if (target) {
      out.targetSource = out.targetSource ?? target;
      delete out.target;
    } else move("target", "targetField");

    const value = ref(out.value);
    if (value) {
      out.source = out.source ?? value;
      delete out.value;
    }
  } else if (type === "Formula") {
    move("as", "target");
    const left = ref(out.left);
    if (left) out.source = out.source ?? left;
    else if (out.left !== undefined) out.value = out.value ?? out.left;
    delete out.left;
    move("right", "operand");
  } else if (type === "REST") {
    move("body", "bodyTemplate");
  }

  return out;
}

const PERSON_ROLE_COLUMN_NAMES = new Set([
  "assigned_to",
  "author_id",
  "lab_manager_id",
  "manager_id",
  "owner_id",
  "pi_id",
  "remediation_owner",
  "remediation_owner_id",
  "user_id",
]);

/**
 * Whether an FK column names a person by the role they played rather than by
 * entity — `reported_by_id`, `pi_id`, `assigned_to`. These resolve to the user
 * entity, not to a table derived from the column name: there is no
 * `bus_reported_by`.
 */
export function isPersonRoleColumn(columnName: string): boolean {
  return (
    columnName.endsWith("_by") ||
    columnName.endsWith("_by_id") ||
    PERSON_ROLE_COLUMN_NAMES.has(columnName)
  );
}

/**
 * Whether a column name is one the generator can resolve to a table at all.
 *
 * This mirrors isForeignKeyColumnName() in
 * packages/core/src/types/bus-entity.types.ts, which decides TABLE_DIRECT. The
 * language tools build standalone (tsconfig.language.json) and do not import the
 * workspace packages, so the rule is repeated here rather than imported; if one
 * changes, the other has to change with it or the checker starts describing a
 * dictionary the generator does not produce.
 */
export function isForeignKeyColumnName(columnName: string): boolean {
  return columnName.endsWith("_id") || columnName.endsWith("_by");
}

// ---------------------------------------------------------------------------
// Check engine
// ---------------------------------------------------------------------------

class CheckEngine {
  private issues: Issue[] = [];
  private src: SourceIndex;
  private def = loadLanguageDefinition();
  private validHookTypes: Set<string>;
  private validCardinalities: Set<string>;
  private validModifiers = new Set(["PK", "FK", "UK", "UNIQUE", "OPTIONAL", "NULL"]);
  private validEntityKeys = new Set([
    "audited",
    "softDelete",
    "prefix",
    "label",
    "icon",
    /* `help` and its synonym `description` are compiled: the parser hangs the
       text on the entity and it becomes sys_table.description, which the
       dictionary and the entity's screen both show. */
    "help",
    "description",
    /* `parent` is compiled too, and it is the one key that changes the shape of
       the application rather than its text: the entity becomes a line item of
       the one it names — no window, no dashboard card, a tab inside its
       parent's window linked on the foreign key it already declared. */
    "parent",
  ]);
  private validFieldKeys = new Set(["enum", "ui", "default", "min", "max", "help", "format"]);
  private validMetaKeys = new Set(["name", "kind", "version", "entity", "stack", "description"]);
  private validWorkflowKinds = new Set(["hook", "state", "saga"]);
  private validTriggerSources = /^(cron:|webhook:|message:)/;
  // role:name1|name2 or role:name1|role:name2 are both valid per spec
  private validRoleExpr = /^role:[A-Za-z][A-Za-z0-9_]*(\|(?:role:)?[A-Za-z][A-Za-z0-9_]*)*$/;
  private identRe = /^[A-Za-z][A-Za-z0-9_]*$/;
  private slugRe = /^[a-z][a-z0-9_]*$/;

  constructor(
    private model: EmlModel,
    source: string
  ) {
    this.src = new SourceIndex(source);
    this.validHookTypes = new Set(this.def.hooks.types.map((h) => h.type));
    this.validCardinalities = new Set(this.def.cardinalities.map.map((c) => c.operator));
  }

  private add(issue: Issue): void {
    this.issues.push(issue);
  }

  private error(
    code: string,
    message: string,
    opts: Partial<Omit<Issue, "severity" | "code" | "message">> = {}
  ): void {
    this.add({ severity: "error", code, message, ...opts });
  }

  private warn(
    code: string,
    message: string,
    opts: Partial<Omit<Issue, "severity" | "code" | "message">> = {}
  ): void {
    this.add({ severity: "warning", code, message, ...opts });
  }

  private info(
    code: string,
    message: string,
    opts: Partial<Omit<Issue, "severity" | "code" | "message">> = {}
  ): void {
    this.add({ severity: "info", code, message, ...opts });
  }

  // -------------------------------------------------------------------------
  // Run all checks
  // -------------------------------------------------------------------------

  run(): CheckResult {
    // Surface parse-time diagnostics from the parser
    for (const d of this.model.diagnostics) {
      this.add({
        severity: d.severity === "info" ? "info" : d.severity,
        code: d.code,
        message: d.message,
        line: d.line,
      });
    }

    this.checkDocument();
    this.checkEntities();
    this.checkRelationships();
    this.checkEnums();
    this.checkFieldDirectives();
    this.checkIndexDirectives();
    this.checkEntityDirectives();
    this.checkHooks();
    this.checkAutomationTriggers();
    this.checkGuards();
    this.checkRbac();
    this.checkTriggers();
    this.checkWorkflowDirectives();
    this.checkStepDirectives();
    this.checkActionDirectives();
    this.checkRuleDirectives();
    this.checkRules();
    this.checkWorkflows();
    this.checkCrossDocument();

    const errors = this.issues.filter((i) => i.severity === "error").length;
    const warnings = this.issues.filter((i) => i.severity === "warning").length;
    const infos = this.issues.filter((i) => i.severity === "info").length;
    return { issues: this.issues, errors, warnings, infos, ok: errors === 0 };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Convert an entity name (PascalCase) to the expected FK column name. */
  private entityToFkName(entityName: string): string {
    const snake = entityName
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
      .toLowerCase()
      .replace(/^bus_/, "");
    return `${snake}_id`;
  }

  /** Convert a FK column name back to the candidate parent entity name. */
  private fkToEntityName(fkAttr: string): string {
    if (isPersonRoleColumn(fkAttr)) return this.personEntity();
    const base = fkAttr.slice(0, -3); // strip _id
    return base.replace(/(^|_)([a-z])/g, (_, _sep, ch) => ch.toUpperCase());
  }

  private personEntity(): string {
    const names = new Set(this.model.entities.map((e) => e.name));
    if (names.has("User")) return "User";
    if (names.has("Staff")) return "Staff";
    if (names.has("Employee")) return "Employee";
    return "User";
  }

  // -------------------------------------------------------------------------
  // EML001-EML009: Document-level checks
  // -------------------------------------------------------------------------

  private checkDocument(): void {
    const { meta } = this.model;

    if (!meta.name) {
      this.warn("EML001", "Missing document name.", {
        hint: "Add  %%meta name: <YourModelName>  before the first section.",
      });
    }

    if (meta.kind && !["erd", "rules", "workflow"].includes(meta.kind)) {
      this.warn("EML002", `Unknown %%meta kind: "${meta.kind}".`, {
        hint: "Valid values: erd, rules, workflow",
        line: this.src.findLine(`%%meta kind: ${meta.kind}`),
      });
    }

    if (meta.stack && !["tanstack-start-nestjs", "openui5-odatav4"].includes(meta.stack)) {
      this.warn("EML003", `Unknown %%meta stack: "${meta.stack}".`, {
        hint: "Valid values: tanstack-start-nestjs, openui5-odatav4",
        line: this.src.findLine(`%%meta stack:`),
      });
    }

    // EML005: Unknown or malformed %%meta key.
    //
    // Nothing validated these, so a misspelt key was accepted in silence — and
    // because the value then never reached the model, the failure surfaced
    // later as a missing name or kind, with nothing pointing at the typo that
    // caused it.
    for (const { lineNo, text } of this.src.findAll(/^\s*%%meta\b/)) {
      const m = text.trim().match(/^%%meta\s+([A-Za-z_]\w*)\s*:\s*(.*)$/);
      if (!m) {
        this.error("EML005", `Invalid %%meta syntax: "${text.trim()}"`, {
          line: lineNo,
          hint: "Syntax: %%meta <key>: <value>",
          context: text.trim(),
        });
        continue;
      }
      const [key] = caps(m, 2);
      if (!this.validMetaKeys.has(key)) {
        this.warn("EML005", `Unknown %%meta key "${key}".`, {
          line: lineNo,
          hint: `Known keys: ${[...this.validMetaKeys].join(", ")}.`,
        });
      }
    }

    if (
      this.model.entities.length === 0 &&
      this.model.rules.length === 0 &&
      this.model.workflows.length === 0
    ) {
      this.error("EML004", "Empty document: no entities, rules, or workflows found.", {
        hint: "Add an erDiagram section with at least one entity block.",
      });
    }
  }

  // -------------------------------------------------------------------------
  // EML100-EML119: Entity checks
  // -------------------------------------------------------------------------

  private checkEntities(): void {
    const seenNames = new Map<string, number>(); // name → first occurrence line

    for (const entity of this.model.entities) {
      const entityLine = this.src.findLine(new RegExp(`^\\s*${entity.name}\\s*\\{`));

      // EML100: Entity name must be a valid identifier
      if (!this.identRe.test(entity.name)) {
        this.error(
          "EML100",
          `Invalid entity name "${entity.name}": must match ^[A-Za-z][A-Za-z0-9_]*$.`,
          {
            line: entityLine,
            hint: "Use PascalCase for entity names (e.g. CustomerOrder).",
          }
        );
      }

      // EML101: Unique entity names
      const prev = seenNames.get(entity.name);
      if (prev !== undefined) {
        this.error("EML101", `Duplicate entity declaration "${entity.name}".`, {
          line: entityLine,
          hint: `First declared on line ${prev}. Merge both blocks into one.`,
        });
      } else {
        seenNames.set(entity.name, entityLine ?? 0);
      }

      // EML102: At least one attribute
      if (entity.attributes.length === 0) {
        this.warn("EML102", `Entity "${entity.name}" has no attributes.`, {
          line: entityLine,
          hint: "The generator will auto-add  string id PK  if no id is present.",
        });
      }

      this.checkAttributes(entity, entityLine);
    }
  }

  private checkAttributes(entity: EmlEntity, entityLine?: number): void {
    const declaredEntityNames = new Set(this.model.entities.map((e) => e.name));
    const seenAttrNames = new Map<string, number>();
    /* Where each name was last found, so a column declared twice reports two
       different lines. Searching from the entity every time returned the first
       occurrence for both, which sent the reader — and the fixer — to the line
       that was fine and left the duplicate in place. */
    const lastLineByName = new Map<string, number>();
    let pkCount = 0;

    for (const attr of entity.attributes) {
      const searchFrom = lastLineByName.has(attr.name)
        ? (lastLineByName.get(attr.name) as number) + 1
        : entityLine;
      const attrLine =
        this.src.findLine(new RegExp(`\\b${attr.name}\\b`), searchFrom) ??
        this.src.findLine(new RegExp(`\\b${attr.name}\\b`), entityLine);
      if (attrLine !== undefined) lastLineByName.set(attr.name, attrLine);

      // EML110: Attribute name format
      if (!this.identRe.test(attr.name)) {
        this.error(
          "EML110",
          `Invalid attribute name "${entity.name}.${attr.name}": must match ^[A-Za-z][A-Za-z0-9_]*$.`,
          {
            line: attrLine,
            hint: "Use snake_case for attribute names (e.g. first_name, order_id).",
          }
        );
      }

      // EML111: Attribute name style recommendation
      if (
        this.identRe.test(attr.name) &&
        !this.slugRe.test(attr.name) &&
        attr.name !== attr.name.toUpperCase()
      ) {
        this.info("EML111", `Attribute "${entity.name}.${attr.name}" is not snake_case.`, {
          line: attrLine,
          hint: "snake_case is recommended for attribute names per the EML spec.",
        });
      }

      // EML112: Duplicate attribute names
      if (seenAttrNames.has(attr.name)) {
        this.warn("EML112", `Duplicate attribute "${entity.name}.${attr.name}".`, {
          line: attrLine,
          hint: `First occurrence on line ${seenAttrNames.get(attr.name)}. Remove the duplicate.`,
        });
      } else {
        seenAttrNames.set(attr.name, attrLine ?? 0);
      }

      // EML113: Multiple primary keys
      if (attr.isPrimaryKey) {
        pkCount++;
        if (pkCount > 1) {
          this.error(
            "EML113",
            `Entity "${entity.name}" declares more than one PK (found "${attr.name}").`,
            {
              line: attrLine,
              hint: "Each entity may have exactly one primary key. Remove the extra PK modifier.",
            }
          );
        }
      }

      // EML114: FK naming convention. The generator derives an FK's target from
      // the column name alone, so a name that does not end in _id resolves to
      // nothing and the column degrades to a plain string — the raw UUID renders
      // in grids and forms with no lookup.
      if (attr.isForeignKey && !attr.name.endsWith("_id")) {
        const isPersonRole = attr.name.endsWith("_by");
        this.warn("EML114", `Foreign key "${entity.name}.${attr.name}" does not end with "_id".`, {
          line: attrLine,
          hint: isPersonRole
            ? `Rename to "${attr.name}_id" — a _by column names a person by role, so it resolves to the user entity. Run  bun language/fixer.ts  to apply this automatically.`
            : `Convention: rename to "${attr.name}_id" so the generator can derive the referenced table. Run  bun language/fixer.ts  to apply this automatically.`,
        });
      }

      // EML119: A column shaped like a reference that nobody marked FK.
      //
      // attributeReferenceId() (packages/core/src/types/bus-entity.types.ts)
      // gives TABLE_DIRECT only when the attribute is BOTH isForeignKey and
      // named _id/_by. Drop the modifier and the Application Dictionary records
      // the column as a plain String: the generated form renders the raw uuid in
      // a text box instead of a lookup on the parent table, and nothing else in
      // the language notices — the column parses, the relationship line can even
      // be there, and the model checks clean.
      //
      // Only fires when the name resolves to an entity this document declares,
      // so an `external_id` or a `tax_id` that points at nothing stays quiet.
      if (!attr.isForeignKey && !attr.isPrimaryKey && isForeignKeyColumnName(attr.name)) {
        const target = this.fkToEntityName(attr.name);
        if (declaredEntityNames.has(target) && attr.name !== entity.primaryKey) {
          this.warn(
            "EML119",
            `Column "${entity.name}.${attr.name}" looks like a reference to "${target}" but is not marked FK.`,
            {
              line: attrLine,
              hint: `Add FK:  ${attr.rawType ?? "string"} ${attr.name} FK. Without it the Application Dictionary records the column as String and the form shows the raw id instead of a "${target}" lookup.`,
            }
          );
        }
      }

      // EML103: A column the generator manages, declared in the model.
      //
      // Every generated table carries `id`, `version`, the audit pair and the
      // soft-delete pair whether or not the model asks for them. Declaring one
      // is redundant, and until the generator learned to drop the duplicate it
      // was fatal: PostgreSQL refuses a CREATE TABLE that names a column twice,
      // so the application failed to open with `column "created_at" specified
      // more than once` — a message that says nothing about which model line
      // caused it.
      if (MANAGED_COLUMN_NAMES.has(attr.name.toLowerCase()) && !attr.isPrimaryKey) {
        this.warn("EML103", `Column "${entity.name}.${attr.name}" is added by the generator.`, {
          line: attrLine,
          hint: `Every table carries ${[...MANAGED_COLUMN_NAMES].join(", ")} already. Delete the line: the generator's own definition is used, and yours is ignored.`,
        });
      }

      // EML115: Unknown raw type (falls back to string)
      const def = this.def;
      const rawBase = attr.rawType?.replace(/\(\d+\)/, "").toLowerCase();
      if (rawBase && rawBase !== "string" && !(rawBase in def.types.map)) {
        this.warn(
          "EML115",
          `Unknown type "${attr.rawType}" on "${entity.name}.${attr.name}"; mapped to "string".`,
          {
            line: attrLine,
            hint: `Valid types: ${def.types.canonical.join(", ")} (plus aliases listed in appwithai-language.json).`,
          }
        );
      }

      // EML116: PK should not be OPTIONAL (check raw source — parser sets required:false for all PKs by design)
      if (attr.isPrimaryKey && attrLine) {
        const rawLine = this.src.getLine(attrLine).toUpperCase();
        if (
          rawLine.includes("OPTIONAL") ||
          rawLine.includes(" NULL ") ||
          rawLine.endsWith(" NULL")
        ) {
          this.error("EML116", `Primary key "${entity.name}.${attr.name}" is marked OPTIONAL.`, {
            line: attrLine,
            hint: "Remove OPTIONAL from the PK attribute — primary keys are always required.",
          });
        }
      }

      // EML118: Unknown attribute modifier.
      //
      // Nothing checked these, and a dropped modifier is silent by
      // construction: the parser reads the tokens it knows and ignores the
      // rest, so `string email UNQIUE` yields a column that is simply not
      // unique. The typo is invisible in the rendered diagram too, because
      // Mermaid draws the token either way.
      //
      // A quoted trailing string is legal Mermaid and is read as the
      // attribute's description, so it is stripped before the tokens are
      // judged.
      if (attrLine !== undefined) {
        const raw = this.src
          .getLine(attrLine)
          .trim()
          .replace(/"[^"]*"\s*$/, "");
        for (const token of raw.split(/\s+/).slice(2)) {
          const upper = token.toUpperCase();
          if (!upper || this.validModifiers.has(upper)) continue;
          this.warn(
            "EML118",
            `Unknown modifier "${token}" on "${entity.name}.${attr.name}" — it will be ignored.`,
            {
              line: attrLine,
              hint: `Known modifiers: ${[...this.validModifiers].join(", ")}. Use a quoted string for a description.`,
              context: raw,
            }
          );
        }
      }
    }

    // EML117: No primary key
    if (pkCount === 0 && entity.attributes.length > 0) {
      this.warn("EML117", `Entity "${entity.name}" has no primary key (PK modifier).`, {
        line: entityLine,
        hint: "Add  string id PK  as the first attribute or mark one existing attribute with PK.",
      });
    }
  }

  // -------------------------------------------------------------------------
  // EML120-EML129: Relationship checks
  // -------------------------------------------------------------------------

  private checkRelationships(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));
    const seenRels = new Map<string, number>(); // "A|op|B" → lineNo

    for (const rel of this.model.relationships) {
      const relLine = this.src.findLine(new RegExp(`\\b${rel.source}\\b.+\\b${rel.target}\\b`));

      // EML120: Source entity must exist
      if (!entityNames.has(rel.source)) {
        this.error("EML120", `Relationship references undeclared entity "${rel.source}".`, {
          line: relLine,
          hint: `Add an entity block for "${rel.source}" in the erDiagram section.`,
        });
      }

      // EML121: Target entity must exist
      if (!entityNames.has(rel.target)) {
        this.error("EML121", `Relationship references undeclared entity "${rel.target}".`, {
          line: relLine,
          hint: `Add an entity block for "${rel.target}" in the erDiagram section.`,
        });
      }

      // EML122: Cardinality operator is valid
      if (rel.operator && !this.validCardinalities.has(rel.operator)) {
        this.error(
          "EML122",
          `Unknown cardinality operator "${rel.operator}" between "${rel.source}" and "${rel.target}".`,
          {
            line: relLine,
            hint: `Valid operators: ${[...this.validCardinalities].join("  ")}.`,
          }
        );
      }

      // EML123: Self-referential relationship (info only)
      if (rel.source === rel.target) {
        this.info("EML123", `Self-referential relationship on "${rel.source}".`, {
          line: relLine,
          hint: "Self-references are valid (e.g. Category ||--o{ Category). Ensure parent_id is modelled.",
        });
      }

      // EML124: Duplicate relationship
      const key = `${rel.source}|${rel.operator}|${rel.target}`;
      if (seenRels.has(key)) {
        this.warn(
          "EML124",
          `Duplicate relationship: "${rel.source}" ${rel.operator} "${rel.target}".`,
          {
            line: relLine,
            hint: `First declared on line ${seenRels.get(key)}. Remove the duplicate.`,
          }
        );
      } else {
        seenRels.set(key, relLine ?? 0);
      }

      // EML125: FK attribute exists in many-side entity (FK is named after the ONE-side entity)
      if (
        (rel.cardinality === "manyToOne" || rel.cardinality === "oneToMany") &&
        entityNames.has(rel.source) &&
        entityNames.has(rel.target)
      ) {
        const manySideName = rel.cardinality === "manyToOne" ? rel.source : rel.target;
        const oneSideName = rel.cardinality === "manyToOne" ? rel.target : rel.source;
        const manySide = this.model.entities.find((e) => e.name === manySideName);
        if (manySide && manySide.attributes.length > 0) {
          const expectedFk = this.entityToFkName(oneSideName);
          const fkExists = manySide.attributes.some((a) => a.isForeignKey || a.name === expectedFk);
          if (!fkExists) {
            this.info(
              "EML125",
              `No FK attribute found in "${manySideName}" for relationship to "${oneSideName}".`,
              {
                line: relLine,
                hint: `Add  string ${expectedFk} FK  to "${manySideName}".`,
              }
            );
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // EML130-EML139: Enum checks
  // -------------------------------------------------------------------------

  private checkEnums(): void {
    const seenEnumNames = new Map<string, number>();

    for (const em of this.model.enums) {
      const enumLine = this.src.findLine(new RegExp(`%%enum\\s+${em.name}\\s*:`));

      // EML130: Enum name format
      if (!this.identRe.test(em.name)) {
        this.error(
          "EML130",
          `Invalid enum name "${em.name}": must match ^[A-Za-z][A-Za-z0-9_]*$.`,
          {
            line: enumLine,
            hint: "Use PascalCase for enum names (e.g. OrderStatus).",
          }
        );
      }

      // EML131: Duplicate enum name
      if (seenEnumNames.has(em.name)) {
        this.warn("EML131", `Duplicate enum declaration "%%enum ${em.name}".`, {
          line: enumLine,
          hint: `First declared on line ${seenEnumNames.get(em.name)}. Merge values into one %%enum directive.`,
        });
      } else {
        seenEnumNames.set(em.name, enumLine ?? 0);
      }

      // EML132: Enum must have at least one value
      if (em.values.length === 0) {
        this.error("EML132", `Enum "${em.name}" has no values.`, {
          line: enumLine,
          hint: `Syntax: %%enum ${em.name}: value1, value2, value3`,
        });
      }

      // EML133: Duplicate enum values
      const seenValues = new Set<string>();
      for (const v of em.values) {
        if (seenValues.has(v)) {
          this.warn("EML133", `Duplicate value "${v}" in enum "${em.name}".`, {
            line: enumLine,
            hint: "Remove the duplicate value.",
          });
        }
        seenValues.add(v);
      }

      // EML134: Enum values should be slug-like (warn)
      for (const v of em.values) {
        if (!/^[A-Za-z0-9_-]+$/.test(v)) {
          this.warn("EML134", `Enum "${em.name}" value "${v}" contains special characters.`, {
            line: enumLine,
            hint: "Use alphanumeric, underscore, or hyphen values for safe serialization.",
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // EML140-EML149: %%field directive checks
  // -------------------------------------------------------------------------

  private checkFieldDirectives(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));
    const enumNames = new Set(this.model.enums.map((e) => e.name));
    const entityAttrMap = new Map<string, Set<string>>();
    for (const e of this.model.entities) {
      entityAttrMap.set(e.name, new Set(e.attributes.map((a) => a.name)));
    }

    // Re-scan source for %%field directives (model doesn't expose them directly)
    const fieldLines = this.src.findAll(/^%%field\b/);
    for (const { lineNo, text } of fieldLines) {
      const m = text.trim().match(/^%%field\s+(\w+)\.(\w+)\s+([A-Za-z_]\w*)\s*:\s*(.+)$/);
      if (!m) {
        this.error("EML140", `Invalid %%field syntax: "${text.trim()}"`, {
          line: lineNo,
          hint: "Syntax: %%field <Entity>.<attr> <key>: <value>",
          context: text.trim(),
        });
        continue;
      }
      const [entityName, attrName, key, value] = caps(m, 4);

      // EML141: Entity must be declared
      if (!entityNames.has(entityName)) {
        this.error("EML141", `%%field references undeclared entity "${entityName}".`, {
          line: lineNo,
          hint: `Declare "${entityName}" in the erDiagram section first.`,
        });
        continue;
      }

      // EML142: Attribute must exist on entity
      const attrs = entityAttrMap.get(entityName);
      if (attrs && !attrs.has(attrName)) {
        this.error(
          "EML142",
          `%%field references undeclared attribute "${entityName}.${attrName}".`,
          {
            line: lineNo,
            hint: `Add "${attrName}" to the "${entityName}" entity block, or check for a typo.`,
          }
        );
      }

      // EML143: Key must be a known %%field key
      if (!this.validFieldKeys.has(key)) {
        this.warn("EML143", `Unknown %%field key "${key}" on "${entityName}.${attrName}".`, {
          line: lineNo,
          hint: `Known keys: ${[...this.validFieldKeys].join(", ")}.`,
        });
      }

      // EML144: enum: value must reference a declared %%enum
      if (key === "enum" && !enumNames.has(value.trim())) {
        this.error(
          "EML144",
          `%%field "${entityName}.${attrName}" references undeclared enum "${value.trim()}".`,
          {
            line: lineNo,
            hint: `Add  %%enum ${value.trim()}: value1, value2  before the erDiagram block.`,
          }
        );
      }

      // EML145: min/max values should be numeric
      if ((key === "min" || key === "max") && Number.isNaN(Number(value.trim()))) {
        this.warn(
          "EML145",
          `%%field "${entityName}.${attrName}" has non-numeric ${key}: "${value.trim()}".`,
          {
            line: lineNo,
            hint: `${key}: should be a number, e.g.  ${key}: 0`,
          }
        );
      }
    }

    // EML146: A lifecycle column nobody bound to an enum.
    //
    // A %%enum on its own does nothing to a column. attributeReferenceId() reads
    // attr.enumReferenceId, which the parser sets from the %%field binding —
    // without it the Application Dictionary records String, and the user gets a
    // free-text box on the one column a state machine is not allowed to be
    // surprised by. EML428 covers the machine's side of this; EML146 covers the
    // column, which is where the dropdown is lost.
    const boundFields = new Set(
      this.src
        .findAll(/^\s*%%field\s+\w+\.\w+\s+enum\s*:/)
        .map(({ text }) => {
          const m = text.trim().match(/^%%field\s+(\w+)\.(\w+)/);
          return m ? `${m[1]}.${m[2]}` : "";
        })
        .filter(Boolean)
    );
    // `status` is a lifecycle column wherever it appears. `state` and `stage`
    // are only lifecycle columns when a machine says so — `Address.state` is a
    // county, and warning about it would be noise.
    const entitiesWithMachines = new Set(
      this.model.workflows.filter((w) => w.kind === "state" && w.entity).map((w) => w.entity)
    );
    for (const entity of this.model.entities) {
      for (const attr of entity.attributes) {
        if (!LIFECYCLE_COLUMN_NAMES.has(attr.name)) continue;
        if (attr.name !== "status" && !entitiesWithMachines.has(entity.name)) continue;
        if (boundFields.has(`${entity.name}.${attr.name}`)) continue;
        this.warn("EML146", `Column "${entity.name}.${attr.name}" has no %%field enum binding.`, {
          line: this.src.findLine(new RegExp(`^\\s+\\w+\\s+${attr.name}\\b`)),
          hint: `Declare  %%enum ${entity.name}Status: ...  and bind it with  %%field ${entity.name}.${attr.name} enum: ${entity.name}Status. Unbound, the Application Dictionary records free text and the form accepts values the state machine cannot act on.`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // EML150-EML159: %%index directive checks
  // -------------------------------------------------------------------------

  private checkIndexDirectives(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));
    const entityAttrMap = new Map<string, Set<string>>();
    for (const e of this.model.entities) {
      entityAttrMap.set(e.name, new Set(e.attributes.map((a) => a.name)));
    }

    for (const idx of this.model.indexes) {
      const idxLine = this.src.findLine(new RegExp(`%%index\\s+${idx.entity}\\s*\\(`));

      // EML150: Entity must be declared
      if (!entityNames.has(idx.entity)) {
        this.error("EML150", `%%index references undeclared entity "${idx.entity}".`, {
          line: idxLine,
          hint: `Declare "${idx.entity}" in the erDiagram section.`,
        });
        continue;
      }

      // EML151: Columns must exist on entity
      const attrs = entityAttrMap.get(idx.entity);
      for (const col of idx.columns) {
        if (attrs && !attrs.has(col)) {
          this.error(
            "EML151",
            `%%index on "${idx.entity}" references undeclared column "${col}".`,
            {
              line: idxLine,
              hint: `Add "${col}" to the "${idx.entity}" entity, or check for a typo.`,
            }
          );
        }
      }

      // EML152: Index on no columns
      if (idx.columns.length === 0) {
        this.error("EML152", `%%index on "${idx.entity}" has no columns.`, {
          line: idxLine,
          hint: "Syntax: %%index Entity(col1, col2) [unique]",
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // EML160-EML169: %%entity directive checks
  // -------------------------------------------------------------------------

  private checkEntityDirectives(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));
    const entityLines = this.src.findAll(/^%%entity\b/);

    for (const { lineNo, text } of entityLines) {
      const m = text.trim().match(/^%%entity\s+(\w+)\s+([A-Za-z_]\w*)\s*:\s*(.+)$/);
      if (!m) {
        this.error("EML160", `Invalid %%entity syntax: "${text.trim()}"`, {
          line: lineNo,
          hint: "Syntax: %%entity <EntityName> <key>: <value>",
        });
        continue;
      }
      const [entityName, key] = caps(m, 2);

      // EML161: Entity must be declared
      if (!entityNames.has(entityName)) {
        this.warn("EML161", `%%entity references undeclared entity "${entityName}".`, {
          line: lineNo,
          hint: `Declare "${entityName}" in the erDiagram section, or check the spelling.`,
        });
      }

      // EML162: Key must be a known %%entity key
      if (!this.validEntityKeys.has(key)) {
        this.warn("EML162", `Unknown %%entity key "${key}" on "${entityName}".`, {
          line: lineNo,
          hint: `Known keys: ${[...this.validEntityKeys].join(", ")}.`,
        });
      }

      /*
       * `parent:` decides where an entity lives, so both halves of it are
       * checked. A parent nobody declared, or a child with no key back to it,
       * leaves the line item with nowhere to be shown — it loses its own
       * window to the directive and gains no tab in exchange, which is an
       * entity that has quietly vanished from the application.
       */
      if (key === "parent") {
        const parentName = (m[3] ?? "").trim();
        const parent = this.model.entities.find((candidate) => candidate.name === parentName);
        const child = this.model.entities.find((candidate) => candidate.name === entityName);

        if (!parent) {
          this.error("EML147", `%%entity ${entityName} parent: "${parentName}" is not declared.`, {
            line: lineNo,
            hint: `Declare "${parentName}" in the erDiagram section, or name the entity that owns ${entityName}.`,
          });
        } else if (parentName === entityName) {
          this.error("EML147", `%%entity ${entityName} cannot be its own parent.`, {
            line: lineNo,
            hint: "A line item belongs to a different entity. Remove the directive if it has no owner.",
          });
        } else if (child) {
          const snake = parentName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
          const link = child.attributes.find(
            (attribute) =>
              attribute.isForeignKey &&
              (attribute.name === `${snake}_id` || attribute.name.startsWith(`${snake}_`))
          );
          if (!link) {
            this.error(
              "EML148",
              `%%entity ${entityName} parent: ${parentName}, but ${entityName} has no foreign key to it.`,
              {
                line: lineNo,
                hint: `Add \`string ${snake}_id FK\` to ${entityName}. The tab links its rows to the open ${parentName} on that column.`,
              }
            );
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // EML200-EML219: %%hook directive checks
  // -------------------------------------------------------------------------

  private checkHooks(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));
    const entityAttrMap = new Map<string, Set<string>>();
    for (const e of this.model.entities) {
      entityAttrMap.set(e.name, new Set(e.attributes.map((a) => a.name)));
    }
    const seenHooks = new Map<string, number>(); // "entity|type|handler" → line

    for (const hook of this.model.hooks) {
      const hookLine = this.src.findLine(
        new RegExp(`%%hook\\s+${hook.type}\\s+${hook.handler}\\s+on\\s+${hook.entity}`)
      );

      // EML200: Hook type must be valid
      if (!this.validHookTypes.has(hook.type)) {
        this.error("EML200", `Unknown hook type "${hook.type}" in %%hook.`, {
          line: hookLine,
          hint: `Valid hook types: ${[...this.validHookTypes].join(", ")}.`,
        });
      }

      // EML201: Handler name must be a valid identifier
      if (!this.identRe.test(hook.handler)) {
        this.error("EML201", `Invalid hook handler name "${hook.handler}".`, {
          line: hookLine,
          hint: "Handler names must match ^[A-Za-z_][A-Za-z0-9_]*$ (camelCase recommended).",
        });
      }

      // EML202: Entity must be declared
      if (!entityNames.has(hook.entity)) {
        this.warn(
          "EML202",
          `%%hook "${hook.handler}" references undeclared entity "${hook.entity}".`,
          {
            line: hookLine,
            hint: `Declare "${hook.entity}" in the erDiagram section.`,
          }
        );
      }

      // EML203: Field params must reference declared attributes
      if (hook.fields.length > 0 && entityNames.has(hook.entity)) {
        const attrs = entityAttrMap.get(hook.entity);
        for (const field of hook.fields) {
          if (attrs && !attrs.has(field)) {
            this.warn(
              "EML203",
              `%%hook "${hook.handler}" references undeclared field "${hook.entity}.${field}".`,
              {
                line: hookLine,
                hint: `Add "${field}" to "${hook.entity}", or check for a typo.`,
              }
            );
          }
        }
      }

      // EML204: Duplicate hooks (same entity + type + handler)
      const hookKey = `${hook.entity}|${hook.type}|${hook.handler}`;
      if (seenHooks.has(hookKey)) {
        this.warn("EML204", `Duplicate hook: "${hook.type} ${hook.handler} on ${hook.entity}".`, {
          line: hookLine,
          hint: `Already declared on line ${seenHooks.get(hookKey)}. Remove the duplicate.`,
        });
      } else {
        seenHooks.set(hookKey, hookLine ?? 0);
      }
    }
  }

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // EML210-EML219: %%rbac directive checks
  //
  // These matter more than most: a %%rbac rule that does not compile is not a
  // rule that does nothing, it is an access restriction the author believes is
  // in place and is not. Every one of these is an error rather than a warning
  // for that reason.
  // -------------------------------------------------------------------------

  private checkRbac(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));
    const crudOps = new Set([
      "create",
      "insert",
      "add",
      "read",
      "view",
      "select",
      "list",
      "update",
      "edit",
      "write",
      "modify",
      "delete",
      "remove",
      "destroy",
      "*",
      "all",
      "any",
    ]);

    /** Transition events declared by an entity's state machines, normalised. */
    const eventsFor = (entity: string): Set<string> => {
      const events = new Set<string>();
      for (const wf of this.model.workflows) {
        if (wf.entity !== entity || wf.kind !== "state") continue;
        for (const t of wf.transitions) {
          if (t.event)
            events.add(
              t.event
                .trim()
                .toLowerCase()
                .replace(/[\s-]+/g, "_")
            );
        }
      }
      return events;
    };

    for (const { lineNo, text } of this.src.findAll(/^\s*%%rbac\b/)) {
      const m = text.trim().match(/^%%rbac\s+(\S+)\s+on\s+([A-Za-z_]\w*)\.([A-Za-z_*]\w*)\s*$/);
      if (!m) {
        this.error("EML210", `Invalid %%rbac syntax: "${text.trim()}"`, {
          line: lineNo,
          hint: "Syntax: %%rbac <roleExpr> on <Entity>.<op>   e.g.  %%rbac role:admin on Order.delete",
          context: text.trim(),
        });
        continue;
      }

      const [roleExpr, entity, target] = caps(m, 3);

      // EML211: the role expression must name at least one role.
      const roles = roleExpr
        .split("|")
        .map((part) =>
          part
            .trim()
            .replace(/^role:/i, "")
            .trim()
        )
        .filter(Boolean);
      if (roles.length === 0) {
        this.error("EML211", `%%rbac on ${entity}.${target} names no role.`, {
          line: lineNo,
          hint: "A rule with no roles can never be satisfied, so it locks the operation for everyone.",
        });
        continue;
      }
      if (!this.validRoleExpr.test(roleExpr) && !/^[A-Za-z][\w|:]*$/.test(roleExpr)) {
        this.warn("EML212", `%%rbac role expression "${roleExpr}" may be malformed.`, {
          line: lineNo,
          hint: "Format: role:<name> or role:<a>|<b> or role:<a>|role:<b>",
        });
      }

      // EML213: the entity must exist.
      if (!entityNames.has(entity)) {
        this.error("EML213", `%%rbac references undeclared entity "${entity}".`, {
          line: lineNo,
          hint: `Declare "${entity}" in the erDiagram section, or check the spelling.`,
        });
        continue;
      }

      // EML214: the target must be a CRUD operation or a declared transition.
      const lower = target.toLowerCase();
      if (crudOps.has(lower)) continue;

      const events = eventsFor(entity);
      if (events.has(lower)) continue;

      this.error(
        "EML214",
        `%%rbac on ${entity}.${target} names neither a CRUD operation nor a transition of ${entity}.`,
        {
          line: lineNo,
          hint: events.size
            ? `Use one of create, read, update, delete, * — or a transition of ${entity}: ${[...events].join(", ")}.`
            : `Use one of create, read, update, delete, * — ${entity} declares no state machine to take a transition from.`,
        }
      );
    }
  }

  // EML220-EML229: %%guard directive checks
  // -------------------------------------------------------------------------

  private checkGuards(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));

    for (const guard of this.model.guards) {
      const guardLine = this.src.findLine(
        new RegExp(`%%guard.+on\\s+${guard.entity}\\.${guard.op}`)
      );

      // EML223: %%guard written in the retired RBAC shape.
      //
      // %%guard meant "restrict this operation to these roles" until the keyword
      // was needed for automation conditions; the restriction sense is %%rbac
      // now, and the automation reader skips a guard shaped like the old one
      // rather than reading `role:admin` as a field name. So this line is not a
      // malformed guard — it is an access rule that does nothing, in a document
      // whose author believes the operation is restricted. Reported instead of
      // EML220/EML222, which would describe it as a guard with a spelling
      // problem.
      const guardText = guardLine ? this.src.getLine(guardLine).trim() : "";
      if (/^%%guard\s+role\s*:/.test(guardText)) {
        this.warn(
          "EML223",
          `%%guard on "${guard.entity}.${guard.op}" is written as an access rule, which %%guard no longer means.`,
          {
            line: guardLine,
            hint: `Rewrite it as  %%rbac ${guardText.replace(/^%%guard\s+/, "")}. As a %%guard it is skipped, so the operation is open to any authenticated caller.`,
          }
        );
        continue;
      }

      // EML220: Role expression syntax
      const roleExprMatch = guardText.match(/^%%guard\s+(\S+)\s+on/);
      const roleExpr = roleExprMatch ? caps(roleExprMatch, 2)[0] : "";
      if (roleExpr && !this.validRoleExpr.test(roleExpr)) {
        this.warn("EML220", `%%guard role expression "${roleExpr}" may be malformed.`, {
          line: guardLine,
          hint: "Format: role:<name> or role:<name>|role:<name>  (e.g. role:admin|role:manager)",
        });
      }

      // EML221: Entity must be declared
      if (!entityNames.has(guard.entity)) {
        this.warn("EML221", `%%guard references undeclared entity "${guard.entity}".`, {
          line: guardLine,
          hint: `Declare "${guard.entity}" in the erDiagram section.`,
        });
      }

      // EML222: No roles declared
      if (guard.roles.length === 0) {
        this.warn("EML222", `%%guard on "${guard.entity}.${guard.op}" has no roles.`, {
          line: guardLine,
          hint: "Add at least one role, e.g. %%guard role:admin on Entity.op",
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // EML230-EML239: %%trigger directive checks
  // -------------------------------------------------------------------------

  private checkTriggers(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));

    for (const trigger of this.model.triggers) {
      const triggerLine = this.src.findLine(new RegExp(`%%trigger.+on\\s+${trigger.entity}`));

      // EML230: Source format
      if (!this.validTriggerSources.test(trigger.source)) {
        this.error("EML230", `%%trigger source "${trigger.source}" is not a valid format.`, {
          line: triggerLine,
          hint: "Valid formats: cron:<expr>  webhook:<name>  message:<topic>",
        });
      }

      // EML231: Cron expression should have 5 or 6 fields
      if (trigger.source.startsWith("cron:")) {
        const expr = trigger.source.slice(5).trim();
        const parts = expr.split(/\s+/);
        if (parts.length < 5 || parts.length > 6) {
          this.warn(
            "EML231",
            `%%trigger cron expression "${expr}" has ${parts.length} field(s); expected 5 or 6.`,
            {
              line: triggerLine,
              hint: "Standard cron: minute hour day-of-month month day-of-week  (e.g. 0 9 * * *)",
            }
          );
        }
      }

      // EML232: Entity must be declared
      if (!entityNames.has(trigger.entity)) {
        this.warn("EML232", `%%trigger references undeclared entity "${trigger.entity}".`, {
          line: triggerLine,
          hint: `Declare "${trigger.entity}" in the erDiagram section.`,
        });
      }

      // EML233: Handler name validity
      if (!this.identRe.test(trigger.handler)) {
        this.error("EML233", `%%trigger handler "${trigger.handler}" is not a valid identifier.`, {
          line: triggerLine,
          hint: "Handler names must match ^[A-Za-z][A-Za-z0-9_]*$ (camelCase recommended).",
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // EML240-EML249: %%workflow directive checks
  // -------------------------------------------------------------------------

  /**
   * Validate the two-token `%%hook <event> on <Entity>` — an automation's
   * trigger.
   *
   * The parser leaves this form alone (it names no handler, so it is not a
   * handler binding and never joins `model.hooks`), which means nothing checked
   * it at all. An automation whose trigger names an event the services never
   * fire is an automation that silently never runs, so it is worth two checks
   * of its own rather than the silence it had.
   */
  private checkAutomationTriggers(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));

    for (const { lineNo, text } of this.src.findAll(/^\s*%%hook\b/)) {
      const m = text.trim().match(/^%%hook\s+(\w+)\s+on\s+(\w+)\s*$/);
      if (!m) continue; // the three-token handler form; checkHooks has it
      const [event, entity] = caps(m, 2);

      // EML205: the event has to be one the generated services actually fire.
      if (!this.validHookTypes.has(event)) {
        this.error("EML205", `Automation trigger uses unknown event "${event}".`, {
          line: lineNo,
          hint: `Valid events: ${[...this.validHookTypes].join(", ")}.`,
        });
      }

      // EML206: the entity has to exist, or the automation binds to nothing.
      if (!entityNames.has(entity)) {
        this.warn("EML206", `Automation trigger references undeclared entity "${entity}".`, {
          line: lineNo,
          hint: `Declare "${entity}" in the erDiagram section.`,
        });
      }
    }
  }

  private checkWorkflowDirectives(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));
    const workflowLines = this.src.findAll(/^%%workflow\b/);

    for (const { lineNo, text } of workflowLines) {
      // `%%workflow name: <name>` — the automation form. It carries only the
      // name and takes its entity from the accompanying `%%hook` line, which is
      // why there is nothing else on it to check here. This is what
      // `serializeAutomation()` writes for every automation built in a running
      // application; reading it as the positional form and reporting EML240 is
      // what stopped any of them validating.
      if (AUTOMATION_WORKFLOW.test(text.trim())) continue;

      const m = text.trim().match(/^%%workflow\s+(\w+)\s+entity:\s*(\w+)\s+kind:\s*(\w+)/);
      if (!m) {
        this.error("EML240", `Invalid %%workflow syntax: "${text.trim()}"`, {
          line: lineNo,
          hint: "Syntax: %%workflow <name> entity: <Entity> kind: <hook|state|saga>, or %%workflow name: <name> for an automation",
        });
        continue;
      }
      const [name, entityName, kind] = caps(m, 3);

      // EML241: Kind must be valid
      if (!this.validWorkflowKinds.has(kind)) {
        this.error("EML241", `%%workflow "${name}" has unknown kind "${kind}".`, {
          line: lineNo,
          hint: "Valid kinds: hook, state, saga",
        });
      }

      // EML242: Entity must be declared
      if (!entityNames.has(entityName)) {
        this.warn("EML242", `%%workflow "${name}" references undeclared entity "${entityName}".`, {
          line: lineNo,
          hint: `Declare "${entityName}" in the erDiagram section.`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // EML280-EML289: %%action directive checks (rule actions)
  // -------------------------------------------------------------------------

  /**
   * Validate the side-effecting actions a rules section declares.
   *
   * An action the engine cannot execute is dropped silently at evaluation time,
   * so a rule appears to be wired up and does nothing. These checks move that
   * to the model — particularly the workflow name, which is the join between a
   * rule and the saga it is supposed to start.
   */
  private checkActionDirectives(): void {
    const actionTypes = new Map(
      (this.def.ruleNodes.actions?.types ?? []).map((action) => [action.name, action])
    );
    const workflowNames = new Set(this.model.workflows.map((wf) => wf.name));

    for (const { lineNo, text } of this.src.findAll(/^\s*%%action\b/)) {
      const match = text.trim().match(/^%%action\s+([A-Za-z_][\w-]*)\s+([A-Za-z][\w-]*)\s*(.*)$/);
      if (!match) {
        this.error("EML280", `Invalid %%action syntax: "${text.trim()}"`, {
          line: lineNo,
          hint: "Syntax: %%action <name> <actionType> when: <expr> <key>: <value> ...",
        });
        continue;
      }

      const [, name, typeName, rest] = match as unknown as [string, string, string, string];
      const contract = actionTypes.get(typeName);

      // EML281: an unknown action type is dropped by the engine.
      if (!contract) {
        this.error("EML281", `%%action "${name}" has unknown type "${typeName}".`, {
          line: lineNo,
          hint: `Valid action types: ${[...actionTypes.keys()].join(", ")}.`,
        });
        continue;
      }

      const props = this.parseStepProps(rest ?? "");
      const has = (key: string) => (props[key] ?? "").trim().length > 0;

      // EML282: no condition means the action fires on every write, which is
      // almost never what someone writing a conditional rule intended.
      if (!has("when")) {
        this.warn("EML282", `%%action "${name}" has no "when" — it fires on every write.`, {
          line: lineNo,
          hint: 'Add a condition, e.g. when: severity == "critical". Use when: true to say "always" on purpose.',
        });
      }

      // EML283: properties the action cannot run without.
      const missing = contract.required.filter((key) => !has(key));
      if (missing.length > 0) {
        this.error(
          "EML283",
          `%%action "${name}" (${typeName}) is missing: ${missing.join(", ")}.`,
          {
            line: lineNo,
            hint: `${typeName} requires ${contract.required.join(", ")}.`,
          }
        );
      }

      // EML284: the workflow a trigger-workflow names has to exist, or the run
      // logs "No active workflow named …" and nothing happens.
      const workflow = props.workflow?.trim();
      if (typeName === "trigger-workflow" && workflow && !workflowNames.has(workflow)) {
        this.warn(
          "EML284",
          `%%action "${name}" triggers workflow "${workflow}", which this document does not declare.`,
          {
            line: lineNo,
            hint: `Declare it with %%workflow ${workflow} entity: <Entity> kind: saga trigger: rule, or correct the name.`,
          }
        );
      }

      // EML285: an unknown key is ignored, so the action runs without it.
      const known = new Set(["when", ...contract.required, ...(contract.optional ?? [])]);
      for (const key of Object.keys(props)) {
        if (!known.has(key)) {
          this.warn("EML285", `%%action "${name}" has unknown property "${key}".`, {
            line: lineNo,
            hint: `${typeName} understands: ${[...known].sort().join(", ")}.`,
          });
        }
      }
    }

    // EML286: a saga declared trigger: rule that no action ever names never
    // runs at all — the definition is seeded and nothing reaches it.
    const triggered = new Set(
      this.src
        .findAll(/^\s*%%action\b/)
        .map(({ text }) => text.match(/\bworkflow:\s*(\S+)/)?.[1])
        .filter((name): name is string => !!name)
    );
    for (const { lineNo, text } of this.src.findAll(/^%%workflow\b/)) {
      const m = text.match(/^%%workflow\s+(\w+)[^\n]*kind:\s*saga/);
      if (!m || !/\btrigger:\s*rule\b/.test(text)) continue;
      if (triggered.has(m[1]!)) continue;
      this.warn("EML286", `Saga "${m[1]}" is rule-triggered but no %%action names it.`, {
        line: lineNo,
        hint: `Add %%action <name> trigger-workflow when: <condition> workflow: ${m[1]} to a %%rule section, or change it to trigger: automatic.`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // EML260-EML279: %%step directive checks (saga workflows)
  // -------------------------------------------------------------------------

  /**
   * Validate the executable steps of every `kind: saga` workflow.
   *
   * A step the executor cannot run is skipped at runtime with a log line, which
   * is a bad place to discover that a workflow has quietly been doing nothing.
   * These checks move that discovery to the model.
   *
   * The vocabulary comes from `workflowConstructs.stepNodes` in
   * appwithai-language.json, so a new step type is declared in one place.
   */
  private checkStepDirectives(): void {
    const stepTypes = new Map(stepNodeTypes().map((step) => [step.name, step]));
    const entitySpellings = this.entitySpellings();
    // Rules a Decision step may name. Also picks up `%%rule` lines the model
    // parser did not turn into a rule, so a naming slip is not reported twice.
    const ruleNames = new Set<string>([
      ...this.model.rules.map((rule) => rule.name),
      ...this.src
        .findAll(/^%%rule\b/)
        .map(({ text }) => text.match(/^%%rule\s+(\w+)/)?.[1])
        .filter((name): name is string => !!name),
    ]);

    for (const section of this.sagaSections()) {
      // Variables a step can read: whatever an earlier step published, plus the
      // columns of the record that triggered the saga — those are in scope from
      // the first step, because the executor puts the triggering row there.
      //
      // Seeding them is what stops EML264 firing on a perfectly good model:
      // `%%workflow … entity: Admission` reaching `targetSource: bed_id` is
      // reading its own trigger's column, which the diagnostic's own hint
      // already excused in prose while the check itself still reported it.
      const published = new Set<string>();
      const trigger = this.model.entities.find(
        (candidate) => candidate.name.toLowerCase() === section.entity.toLowerCase()
      );
      for (const attribute of trigger?.attributes ?? []) published.add(attribute.name);

      const bound = new Set<string>();

      for (const { lineNo, nodeId, typeName, props, automation } of this.stepEntries(
        section.steps
      )) {
        const contract = stepTypes.get(typeName);

        // EML261: the step type has to be one the executor knows.
        if (!contract) {
          this.error("EML261", `%%step on node ${nodeId} has unknown type "${typeName}".`, {
            line: lineNo,
            hint: `Valid step types: ${[...stepTypes.keys()].join(", ")}.`,
          });
          continue;
        }

        // EML270: the compiler keeps the first binding, so the second is dead
        // text that reads as though it were doing something.
        //
        // Only the positional form can trip this. The automation dialect spreads
        // one step over several lines that share a node id on purpose, and those
        // are already folded into a single entry by stepEntries().
        if (!automation && bound.has(nodeId)) {
          this.error("EML270", `Node "${nodeId}" has more than one %%step.`, {
            line: lineNo,
            hint: "Only the first binding runs. Give the second step its own node.",
          });
          continue;
        }
        bound.add(nodeId);

        // EML263: a step bound to a node that is not on the canvas runs at the
        // end, detached from the order the author drew — almost never intended.
        if (!section.nodeIds.has(nodeId)) {
          this.warn("EML263", `%%step binds node "${nodeId}", which is not in the flowchart.`, {
            line: lineNo,
            hint: `Add a node "${nodeId}" to the flowchart, or bind the step to an existing one.`,
          });
        }

        const has = (key: string) => (props[key] ?? "").trim().length > 0;

        // EML262: properties the step cannot run without.
        const missing: string[] = [];
        for (const key of contract.required ?? []) {
          if (!has(key)) missing.push(key);
        }
        for (const group of contract.oneOf ?? []) {
          if (!group.some((key) => has(key))) missing.push(`one of ${group.join(" / ")}`);
        }
        if (typeName === "Formula" && has("operation")) {
          const extra = contract.perOperation?.[props.operation!.trim()]?.required ?? [];
          for (const key of extra) {
            if (!has(key)) missing.push(key);
          }
        }
        if (missing.length > 0) {
          this.error(
            "EML262",
            `%%step ${nodeId} (${typeName}) is missing: ${missing.join(", ")}.`,
            {
              line: lineNo,
              hint: `${typeName} requires ${(contract.required ?? []).join(", ") || "no fixed properties"}. See spec/03-workflows.md.`,
            }
          );
        }

        // EML268: a misspelt key is silently ignored by the executor, so the
        // step runs without the property the author thought they had set.
        // `in` is not part of any step's contract because it belongs to none of
        // them: it is loop membership, which the saga compiler reads off every
        // step type alike (steps.ts reads `step.props.in` before it looks at the
        // type at all). Leaving it out of the contracts made a correctly
        // authored %%loop unauthorable — every member step drew EML268, and the
        // hint listed the properties it could use without mentioning the one it
        // was already using correctly.
        const known = new Set([
          ...(contract.required ?? []),
          ...(contract.optional ?? []),
          ...(contract.oneOf ?? []).flat(),
          ...(typeName === "Formula" ? ["source", "operand", "value"] : []),
          "in",
          // `as` names a step's result so later steps can read it, and the
          // builder writes it on every step type that produces one — not just
          // the Formula whose `as` the translation above renames to `target`.
          // So it is known wherever the automation dialect declared the step,
          // for the same reason `in` is: it belongs to the dialect, not to any
          // one contract.
          ...(automation ? ["as"] : []),
        ]);
        for (const key of Object.keys(props)) {
          if (!known.has(key)) {
            this.warn("EML268", `%%step ${nodeId} (${typeName}) has unknown property "${key}".`, {
              line: lineNo,
              hint: `${typeName} understands: ${[...known].sort().join(", ")}.`,
            });
          }
        }

        // EML266: the target entity has to exist.
        const entityProp = props.entity?.trim();
        if (entityProp && !entitySpellings.has(entityProp.toLowerCase())) {
          this.warn(
            "EML266",
            `%%step ${nodeId} targets entity "${entityProp}", which the model does not declare.`,
            {
              line: lineNo,
              hint: "Use the entity name from the erDiagram, or its bus_ table name.",
            }
          );
        }

        // EML267: an unparseable field map means the whole step is skipped.
        if (typeName === "CreateEntity" && has("fields")) {
          try {
            const parsed = JSON.parse(props.fields!);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              throw new Error("not an object");
            }
            if (Object.keys(parsed).length === 0) {
              this.error("EML267", `%%step ${nodeId} (CreateEntity) sets no fields.`, {
                line: lineNo,
                hint: 'Give at least one column, e.g. fields: {"status":"open"}.',
              });
            }
          } catch {
            this.error("EML267", `%%step ${nodeId} (CreateEntity) has an invalid "fields" map.`, {
              line: lineNo,
              hint: '`fields` must be a JSON object and the last key on the line, e.g. fields: {"status":"open"}.',
            });
          }
        }

        // EML271: a decision table that will not parse means the step is
        // skipped, and a workflow whose branch silently never runs looks like
        // a workflow that ran and decided nothing.
        if (typeName === "Decision" && has("decisionTable")) {
          try {
            const table = JSON.parse(props.decisionTable!) as {
              outputs?: unknown;
              rules?: unknown;
            };
            if (!table || typeof table !== "object" || Array.isArray(table)) {
              throw new Error("not an object");
            }
            if (!Array.isArray(table.rules) || table.rules.length === 0) {
              this.error("EML271", `%%step ${nodeId} (Decision) has a table with no rows.`, {
                line: lineNo,
                hint: "A table with no rows matches nothing and publishes nothing. Add a row, or drop the step.",
              });
            } else if (Array.isArray(table.outputs)) {
              // Every row must set every output column. The engine drops a row
              // that does not, without saying so, and one such row is enough to
              // stop the whole table matching.
              const columns = (table.outputs as { id?: string }[])
                .map((output) => output?.id)
                .filter((id): id is string => Boolean(id));
              const incomplete = (table.rules as Record<string, unknown>[]).filter((row) =>
                columns.some((column) => row?.[column] === undefined)
              );
              if (incomplete.length > 0) {
                this.error(
                  "EML272",
                  `%%step ${nodeId} (Decision) has ${incomplete.length} row(s) that do not set every output column.`,
                  {
                    line: lineNo,
                    hint: `Give every row a value for each of ${columns.join(", ")} — use "''" for the ones it deliberately leaves blank. The engine discards an incomplete row silently.`,
                  }
                );
              }
            }
          } catch {
            this.error("EML271", `%%step ${nodeId} (Decision) has an invalid "decisionTable".`, {
              line: lineNo,
              hint: '`decisionTable` must be a JSON object and the last key on the line, e.g. decisionTable: {"hitPolicy":"collect","inputs":[…],"outputs":[…],"rules":[…]}.',
            });
          }
        }

        // EML273: naming a rule that the model does not declare leaves the step
        // with nothing to evaluate.
        if (typeName === "Decision" && has("rule") && !ruleNames.has(props.rule!.trim())) {
          this.warn(
            "EML273",
            `%%step ${nodeId} (Decision) names rule "${props.rule!.trim()}", which the model does not declare.`,
            {
              line: lineNo,
              hint: "Declare it in a `kind: rules` flowchart, or author the table inline with decisionTable. A rule seeded outside the model still resolves at runtime.",
            }
          );
        }

        // EML265: the executor refuses a cross-entity write it cannot aim.
        if (
          (typeName === "UpdateEntity" || typeName === "DeleteEntity") &&
          entityProp &&
          !has("targetSource") &&
          (props.targetField ?? "id").trim() === "id"
        ) {
          this.error(
            "EML265",
            `%%step ${nodeId} (${typeName}) targets "${entityProp}" without saying which row.`,
            {
              line: lineNo,
              hint: "Set targetSource to a context key holding the row id, or targetField to a foreign key column. The executor refuses this rather than guessing a row.",
            }
          );
        }

        // EML264: reading a variable nothing has published yet. Entity columns
        // are also in scope, so this is a warning: the checker cannot know the
        // target entity's columns from here.
        const reference = props.targetSource?.trim();
        if (reference && !published.has(reference)) {
          this.warn(
            "EML264",
            `%%step ${nodeId} reads "${reference}", which no earlier step publishes.`,
            {
              line: lineNo,
              hint: `Publish it with \`as: ${reference}\` on a CreateEntity step or \`target: ${reference}\` on a Formula step — unless it is a column of the triggering record.`,
            }
          );
        }

        for (const name of this.stepPublishes(typeName, props, entityProp)) published.add(name);
      }
    }

    // EML269: a %%step outside a section that carries steps does nothing at all.
    for (const { lineNo, text } of this.src.findAll(/^\s*%%step\b/)) {
      if (this.sagaStepLines.has(lineNo)) continue;
      this.warn(
        "EML269",
        `%%step is only read inside a saga or automation workflow: "${text.trim()}"`,
        {
          line: lineNo,
          hint: "Move it into a %%workflow ... kind: saga or %%workflow name: ... section, or delete it.",
        }
      );
    }
  }

  /** Line numbers of every %%step the saga scan claimed. */
  private sagaStepLines = new Set<number>();

  /**
   * One entry per step, whichever dialect declared it.
   *
   * The positional form is one line per step. The automation dialect spreads a
   * step over several lines sharing a node id — a `type:` line and one line per
   * property — so those are folded together here and their property names
   * translated into saga vocabulary. Everything downstream then sees one shape
   * and needs no knowledge that a second dialect exists, which is the same
   * arrangement the compiler makes in workflows/steps.ts.
   *
   * The automation patterns are tried first, deliberately: the positional
   * pattern matches `%%step s1 type: UpdateEntity` too, and reads `type` as the
   * step type — which is exactly the EML261 that made every saga built in the
   * application fail to validate.
   */
  private stepEntries(steps: Array<{ lineNo: number; text: string }>): Array<{
    lineNo: number;
    text: string;
    nodeId: string;
    typeName: string;
    props: Record<string, string>;
    automation: boolean;
  }> {
    type Entry = {
      lineNo: number;
      text: string;
      nodeId: string;
      typeName: string;
      props: Record<string, string>;
      automation: boolean;
    };

    const order: Entry[] = [];
    const auto = new Map<string, Entry>();
    /** The node's entry, created on whichever of its lines arrives first. */
    const entryFor = (nodeId: string, lineNo: number, text: string): Entry => {
      const existing = auto.get(nodeId);
      if (existing) return existing;
      const created: Entry = {
        lineNo,
        text,
        nodeId,
        typeName: "",
        props: {},
        automation: true,
      };
      auto.set(nodeId, created);
      order.push(created);
      return created;
    };

    for (const { lineNo, text } of steps) {
      const line = text.trim();

      const typeLine = line.match(AUTO_TYPE_DIRECTIVE);
      if (typeLine) {
        const [, nodeId = "", typeName = "", rest = ""] = typeLine;
        const entry = entryFor(nodeId, lineNo, text);
        entry.typeName = typeName;
        // Report against the `type:` line: it is the one naming the step, and
        // a property line may well have come first.
        entry.lineNo = lineNo;
        entry.text = text;
        Object.assign(entry.props, this.parseStepProps(rest));
        continue;
      }

      const propLine = line.match(AUTO_PROP_DIRECTIVE);
      if (propLine && propLine[2] !== "type") {
        const [, nodeId = "", key = "", value = ""] = propLine;
        entryFor(nodeId, lineNo, text).props[key] = value.trim();
        continue;
      }

      const match = line.match(/^%%step\s+([A-Za-z_]\w*)\s+([A-Za-z]\w*)\s*(.*)$/);
      if (!match) {
        this.error("EML260", `Invalid %%step syntax: "${line}"`, {
          line: lineNo,
          hint: "Syntax: %%step <nodeId> <StepType> <key>: <value> ..., or %%step <nodeId> type: <StepType> for an automation",
        });
        continue;
      }
      const [, nodeId = "", typeName = "", rest = ""] = match;
      order.push({
        lineNo,
        text,
        nodeId,
        typeName,
        props: this.parseStepProps(rest),
        automation: false,
      });
    }

    for (const entry of order) {
      if (!entry.automation) continue;

      // EML274: property lines with no `type:` line to say what they configure.
      // The compiler treats such a node as a Formula and runs it; saying so is
      // better than letting a step the author never named do something.
      if (!entry.typeName) {
        this.error("EML274", `%%step node "${entry.nodeId}" has no "type:" line.`, {
          line: entry.lineNo,
          hint: `Add %%step ${entry.nodeId} type: <StepType>. Without it the step compiles as a Formula.`,
        });
        continue;
      }
      entry.props = sagaPropsFromAutomation(entry.typeName, entry.props);
    }

    return order.filter((entry) => entry.typeName);
  }

  /**
   * Split the document into the sections that may carry `%%step`.
   *
   * Two headers open one. `%%workflow … kind: saga` is the positional form, and
   * `%%workflow name: <name>` is an automation — which takes its entity from the
   * `%%hook <event> on <Entity>` line that follows, because the automation
   * envelope puts it there rather than on the workflow directive.
   *
   * Both are included because a step written in the automation dialect turns up
   * under either header: the builder writes `%%step s1 type: Formula` even when
   * it emits the positional saga line above it, so reading the dialect only in
   * automation sections would still have failed every saga built in the app.
   *
   * Sections run to the next `%%workflow`/`%%rule` directive, which mirrors how
   * the composer's extractor carves the document up.
   */
  private sagaSections(): Array<{
    name: string;
    entity: string;
    nodeIds: Set<string>;
    steps: Array<{ lineNo: number; text: string }>;
  }> {
    const sections: Array<{
      name: string;
      entity: string;
      nodeIds: Set<string>;
      steps: Array<{ lineNo: number; text: string }>;
    }> = [];

    let current: {
      name: string;
      entity: string;
      nodeIds: Set<string>;
      steps: Array<{ lineNo: number; text: string }>;
    } | null = null;

    const nodeRef =
      /([A-Za-z_]\w*)\s*(?:\(\[[^\]]*\]\)|\(\([^)]*\)\)|\[[^\]]*\]|\{[^}]*\}|\([^)]*\))?/g;
    const edge = /(?:-->|---|-\.->|==>)/;

    const all = this.src.findAll(/.*/);
    for (const { lineNo, text } of all) {
      const trimmed = text.trim();

      const automation = trimmed.match(/^%%workflow\s+name:\s*(.+?)\s*$/);
      if (automation) {
        if (current) sections.push(current);
        // The entity is unknown until the %%hook line below it arrives.
        current = { name: automation[1]!, entity: "", nodeIds: new Set<string>(), steps: [] };
        continue;
      }

      const workflow = trimmed.match(/^%%workflow\s+(\w+)\s+entity:\s*(\w+)\s+kind:\s*(\w+)/);
      if (workflow) {
        if (current) sections.push(current);
        current =
          workflow[3] === "saga"
            ? { name: workflow[1]!, entity: workflow[2]!, nodeIds: new Set<string>(), steps: [] }
            : null;
        continue;
      }
      if (trimmed.startsWith("%%rule ")) {
        if (current) sections.push(current);
        current = null;
        continue;
      }
      if (!current) continue;

      // The automation envelope carries the entity here, not on %%workflow.
      const trigger = trimmed.match(/^%%hook\s+\w+\s+on\s+(\w+)\s*$/);
      if (trigger && !current.entity) {
        current.entity = trigger[1]!;
        continue;
      }

      if (trimmed.startsWith("%%step")) {
        current.steps.push({ lineNo, text });
        this.sagaStepLines.add(lineNo);
        continue;
      }
      if (!trimmed || trimmed.startsWith("%%")) continue;

      // Any bare identifier on a diagram line is a node reference — either end
      // of an edge, or a standalone node definition.
      if (edge.test(trimmed) || /[[({]/.test(trimmed)) {
        nodeRef.lastIndex = 0;
        let m: RegExpExecArray | null;
        // Not matchAll: the body advances lastIndex past zero-length matches.
        // biome-ignore lint/suspicious/noAssignInExpressions: standard exec-loop idiom
        while ((m = nodeRef.exec(trimmed)) !== null) {
          if (m[0].trim()) current.nodeIds.add(m[1]!);
          if (m.index === nodeRef.lastIndex) nodeRef.lastIndex++;
        }
      }
    }
    if (current) sections.push(current);
    return sections;
  }

  /** Every spelling of a declared entity a %%step's `entity:` may use. */
  private entitySpellings(): Set<string> {
    const spellings = new Set<string>();
    for (const entity of this.model.entities) {
      const snake = entity.name
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/-/g, "_")
        .toLowerCase();
      const bare = snake.replace(/^bus_/, "");
      spellings.add(entity.name.toLowerCase());
      spellings.add(snake);
      spellings.add(bare);
      spellings.add(`bus_${bare}`);
    }
    return spellings;
  }

  /**
   * The context variables a step makes available to the ones after it.
   *
   * A list rather than a single name: a Decision publishes one variable per
   * output column of whichever row matches. When the table is authored inline
   * the columns are readable from it; when it names a rule they are not, so
   * `publish` is the only declaration available and an absent one means the
   * checker cannot know — it stays quiet rather than guessing wrong.
   */
  private stepPublishes(
    typeName: string,
    props: Record<string, string>,
    entityProp: string | undefined
  ): string[] {
    if (typeName === "CreateEntity") {
      const explicit = props.as?.trim();
      if (explicit) return [explicit];
      return entityProp ? [`${entityProp.replace(/^bus_/, "")}Id`] : [];
    }

    if (typeName === "Formula") {
      const target = props.target?.trim();
      return target ? [target] : [];
    }

    if (typeName === "Decision") {
      const allowed = (props.publish ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      if (allowed.length > 0) return allowed;

      const inline = props.decisionTable?.trim();
      if (!inline) return [];
      try {
        const table = JSON.parse(inline) as { outputs?: { field?: string }[] };
        return (table.outputs ?? [])
          .map((output) => output?.field?.trim())
          .filter((field): field is string => Boolean(field));
      } catch {
        // EML271 already reports the parse failure; do not report it twice.
        return [];
      }
    }

    return [];
  }

  /** `key: value` pairs, each value running to the next `key:` token. */
  private parseStepProps(rest: string): Record<string, string> {
    const props: Record<string, string> = {};
    const trimmed = rest.trim();
    if (!trimmed) return props;
    // The `(?!\/\/)` is what keeps a URL whole: `url: https://host/path` would
    // otherwise split at `https:`, leaving `url` empty and `https` an unknown
    // property, so every REST step failed EML262 for a url it plainly had.
    // Kept identical in packages/generator/src/workflows/steps.ts (PROP_SPLIT)
    // and packages/web/src/lib/automation/model.ts, which parse the same line.
    for (const chunk of trimmed.split(/\s+(?=[A-Za-z_]\w*:(?!\/\/))/)) {
      const at = chunk.indexOf(":");
      if (at <= 0) continue;
      const key = chunk.slice(0, at).trim();
      if (key) props[key] = chunk.slice(at + 1).trim();
    }
    return props;
  }

  // -------------------------------------------------------------------------
  // EML250-EML259: %%rule directive checks
  // -------------------------------------------------------------------------

  private checkRuleDirectives(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));
    const ruleLines = this.src.findAll(/^%%rule\b/);

    for (const { lineNo, text } of ruleLines) {
      const m = text
        .trim()
        .match(/^%%rule\s+(\w+)\s+on\s+(\w+)(?:\s+event:\s*(\w+))?(?:\s+priority:\s*(\d+))?/);
      if (!m) {
        this.error("EML250", `Invalid %%rule syntax: "${text.trim()}"`, {
          line: lineNo,
          hint: "Syntax: %%rule <name> on <Entity> event: <hookType> priority: <n>",
        });
        continue;
      }
      const [name, entityName, event] = caps(m, 3);

      // EML251: Entity must be declared
      if (!entityNames.has(entityName)) {
        this.warn("EML251", `%%rule "${name}" references undeclared entity "${entityName}".`, {
          line: lineNo,
          hint: `Declare "${entityName}" in the erDiagram section.`,
        });
      }

      // EML252: Event must be a valid hook type (if provided)
      if (event && !this.validHookTypes.has(event)) {
        this.error("EML252", `%%rule "${name}" has unknown event "${event}".`, {
          line: lineNo,
          hint: `Valid event values: ${[...this.validHookTypes].join(", ")}.`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // EML300-EML349: Business rule (flowchart) checks
  // -------------------------------------------------------------------------

  private checkRules(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));

    for (const rule of this.model.rules) {
      // EML300: Must have at least one inputNode
      const inputs = rule.nodes.filter((n) => n.jdmType === "inputNode");
      if (inputs.length === 0) {
        this.error("EML300", `Rule "${rule.name}" has no start (input) node.`, {
          hint: "Add a stadium node as the start:  A([Start: description]) --> ...  as the first step.",
        });
      } else if (inputs.length > 1) {
        this.warn("EML301", `Rule "${rule.name}" has ${inputs.length} input nodes; expected 1.`, {
          hint: "A well-formed rule has exactly one start stadium. Merge extra start nodes.",
        });
      }

      // EML302: Must have at least one outputNode
      const outputs = rule.nodes.filter((n) => n.jdmType === "outputNode");
      if (outputs.length === 0) {
        this.error("EML302", `Rule "${rule.name}" has no end (output) node.`, {
          hint: "Add a terminal stadium node with only incoming edges:  ... --> Z([End: description])",
        });
      }

      // EML303: Decision nodes should have at least 2 outgoing edges
      const edgeSources = new Map<string, number>();
      for (const e of rule.edges) {
        edgeSources.set(e.source, (edgeSources.get(e.source) ?? 0) + 1);
      }
      for (const node of rule.nodes) {
        if (node.shape === "diamond") {
          const outCount = edgeSources.get(node.id) ?? 0;
          if (outCount < 2) {
            this.warn(
              "EML303",
              `Rule "${rule.name}": decision node "${node.id}" (${node.label}) has only ${outCount} outgoing edge(s).`,
              {
                hint: "Decision (diamond) nodes should branch at least Yes/No — add a second outgoing edge.",
              }
            );
          }
        }
      }

      // EML304: Decision node edges should be labeled
      for (const edge of rule.edges) {
        const srcNode = rule.nodes.find((n) => n.id === edge.source);
        if (srcNode?.shape === "diamond" && !edge.label) {
          this.warn(
            "EML304",
            `Rule "${rule.name}": unlabeled edge from decision node "${srcNode.id}".`,
            {
              hint: `Add a condition label:  ${edge.source} -->|Yes| ${edge.target}  or  ${edge.source} -->|condition| ${edge.target}`,
            }
          );
        }
      }

      // EML305: Disconnected nodes (no incoming or outgoing edges from start)
      if (rule.nodes.length > 0 && rule.edges.length > 0) {
        const reachable = this.reachableNodes(rule);
        for (const node of rule.nodes) {
          if (!reachable.has(node.id) && node.jdmType !== "inputNode") {
            this.warn(
              "EML305",
              `Rule "${rule.name}": node "${node.id}" (${node.label}) is unreachable from the start node.`,
              {
                hint: "Add an edge from the start or another reachable node to this node.",
              }
            );
          }
        }
      }

      // EML306: Empty rule (no nodes)
      if (rule.nodes.length === 0) {
        this.warn("EML306", `Rule "${rule.name}" has no nodes.`, {
          hint: "Add flowchart nodes using the shapes documented in spec/02-business-rules.md.",
        });
      }

      // EML307: Rule entity must be declared
      if (rule.entity && !entityNames.has(rule.entity)) {
        this.warn("EML307", `Rule "${rule.name}" bound to undeclared entity "${rule.entity}".`, {
          hint: `Declare "${rule.entity}" in the erDiagram section or check the %%rule directive.`,
        });
      }
    }
  }

  private reachableNodes(rule: EmlRule): Set<string> {
    const startNode = rule.nodes.find((n) => n.jdmType === "inputNode");
    if (!startNode) return new Set();
    const visited = new Set<string>();
    const queue = [startNode.id];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const e of rule.edges) {
        if (e.source === id && !visited.has(e.target)) queue.push(e.target);
      }
    }
    return visited;
  }

  // -------------------------------------------------------------------------
  // EML400-EML449: Workflow checks
  // -------------------------------------------------------------------------

  private checkWorkflows(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));

    for (const wf of this.model.workflows) {
      // EML400: Entity must be declared
      if (wf.entity && !entityNames.has(wf.entity)) {
        this.warn("EML400", `Workflow "${wf.name}" bound to undeclared entity "${wf.entity}".`, {
          hint: `Declare "${wf.entity}" in the erDiagram section.`,
        });
      }

      if (wf.kind === "hook") {
        this.checkHookWorkflow(wf);
      } else if (wf.kind === "state") {
        this.checkStateWorkflow(wf);
      } else if (wf.kind === "saga") {
        this.checkSagaWorkflow(wf);
      }
    }
  }

  private checkHookWorkflow(wf: EmlWorkflow): void {
    // EML410: Hook workflow should have %%hook directives
    if (wf.hooks.length === 0 && wf.entity) {
      this.warn(
        "EML410",
        `Hook workflow "${wf.name}" (entity: ${wf.entity}) has no %%hook directives.`,
        {
          hint: `Add  %%hook <type> <handler> on ${wf.entity}  inside or before the flowchart section.`,
        }
      );
    }
  }

  private checkStateWorkflow(wf: EmlWorkflow): void {
    // EML420: Must have transitions
    if (wf.transitions.length === 0) {
      this.warn("EML420", `State workflow "${wf.name}" has no transitions.`, {
        hint: "Add state transitions:  StateA --> StateB : eventName",
      });
      return;
    }

    // EML421: Must have an initial state ([*] --> FirstState)
    const hasInitial = wf.transitions.some((t) => t.from === "[*]");
    if (!hasInitial) {
      this.error(
        "EML421",
        `State workflow "${wf.name}" has no initial transition ([*] --> FirstState).`,
        {
          hint: "Add  [*] --> <firstStateName>  as the first transition.",
        }
      );
    }

    // EML422: Must have at least one final state (<state> --> [*])
    const hasFinal = wf.transitions.some((t) => t.to === "[*]");
    if (!hasFinal) {
      this.warn(
        "EML422",
        `State workflow "${wf.name}" has no final state (no transition to [*]).`,
        {
          hint: "Add  <TerminalState> --> [*]  to mark a terminal state.",
        }
      );
    }

    // EML423: All states should be reachable from initial
    const reachableStates = this.reachableStates(wf);
    for (const state of wf.states) {
      if (!reachableStates.has(state) && state !== "[*]") {
        this.warn(
          "EML423",
          `State workflow "${wf.name}": state "${state}" is not reachable from [*].`,
          {
            hint: `Add a transition to "${state}" from a reachable state, or remove it.`,
          }
        );
      }
    }

    // EML424: All states should eventually reach [*]
    const canReachFinal = this.statesReachingFinal(wf);
    for (const state of wf.states) {
      if (!canReachFinal.has(state)) {
        this.warn(
          "EML424",
          `State workflow "${wf.name}": state "${state}" has no path to a terminal state ([*]).`,
          {
            hint: `Add a transition from "${state}" to [*] or to a state that eventually reaches [*].`,
          }
        );
      }
    }

    // EML425: Transition events should be valid identifiers
    for (const t of wf.transitions) {
      if (t.event && !this.identRe.test(t.event.replace(/[- ]/g, "_"))) {
        this.warn(
          "EML425",
          `State workflow "${wf.name}": transition event "${t.event}" may not be a valid identifier.`,
          {
            hint: "Use snake_case or camelCase event names (e.g. submit, mark_paid, close_won).",
          }
        );
      }
    }

    // EML426/427/428: the states of a state machine are the values a status
    // column may hold, so they should line up with a declared %%enum.
    //
    // The candidate enum is found by *partial* overlap and not by an exact
    // match. Requiring every state to already appear in the enum was the
    // original test, and it made EML426 unreachable: the branch could only be
    // entered when nothing was missing, so the "states missing from the enum"
    // it then looked for was always empty. The whole point is to catch the
    // model that added a state and forgot the enum value, which is exactly the
    // case an exact match excludes.
    const namedStates = wf.states.filter((state) => state !== "[*]");
    if (wf.entity && namedStates.length > 0) {
      const stateSet = new Set(namedStates);

      // Best overlap wins. A model may declare several enums, and the status
      // enum is the one sharing the most values with this machine's states.
      let candidate: { name: string; values: string[]; overlap: number } | undefined;
      for (const em of this.model.enums) {
        const enumSet = new Set(em.values);
        const overlap = namedStates.filter((state) => enumSet.has(state)).length;
        if (overlap > 0 && (!candidate || overlap > candidate.overlap)) {
          candidate = { name: em.name, values: em.values, overlap };
        }
      }

      if (!candidate) {
        // No enum shares a single value with these states. Nothing declares
        // what the status column may hold, so the generated column is a free
        // string and a typo in a transition becomes a state no rule can match.
        this.warn(
          "EML428",
          `State workflow "${wf.name}" has no matching %%enum; its states are not a declared vocabulary.`,
          {
            hint: `Add  %%enum ${wf.entity}Status: ${namedStates.join(", ")}  and bind it with  %%field ${wf.entity}.status enum: ${wf.entity}Status`,
          }
        );
      } else {
        const enumSet = new Set(candidate.values);
        const missingInEnum = namedStates.filter((state) => !enumSet.has(state));
        const extraInEnum = candidate.values.filter((value) => !stateSet.has(value));

        if (missingInEnum.length > 0) {
          this.warn(
            "EML426",
            `State workflow "${wf.name}": states [${missingInEnum.join(", ")}] are not in enum "${candidate.name}".`,
            {
              hint: `Add these values to  %%enum ${candidate.name}: ...`,
            }
          );
        }
        if (extraInEnum.length > 0) {
          this.info(
            "EML427",
            `Enum "${candidate.name}" has values [${extraInEnum.join(", ")}] not present as states in workflow "${wf.name}".`,
            {
              hint: "These may be future states or unreachable values — remove if not needed.",
            }
          );
        }
      }
    }
  }

  private reachableStates(wf: EmlWorkflow): Set<string> {
    const visited = new Set<string>();
    const queue = wf.transitions.filter((t) => t.from === "[*]").map((t) => t.to);
    while (queue.length > 0) {
      const s = queue.shift()!;
      if (visited.has(s) || s === "[*]") continue;
      visited.add(s);
      for (const t of wf.transitions) {
        if (t.from === s && !visited.has(t.to)) queue.push(t.to);
      }
    }
    return visited;
  }

  private statesReachingFinal(wf: EmlWorkflow): Set<string> {
    // Reverse reachability: which states can reach [*]?
    const canReach = new Set<string>();
    // Seed: direct transitions to [*]
    for (const t of wf.transitions) {
      if (t.to === "[*]") canReach.add(t.from);
    }
    // Propagate backwards
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of wf.transitions) {
        if (canReach.has(t.to) && !canReach.has(t.from) && t.from !== "[*]") {
          canReach.add(t.from);
          changed = true;
        }
      }
    }
    return canReach;
  }

  private checkSagaWorkflow(wf: EmlWorkflow): void {
    // EML430: a saga's steps come from %%step directives. It used to be checked
    // for %%hook directives instead, from when saga was a documented-but-unbuilt
    // kind — a saga with steps and no hooks is the normal case now.
    const declared = this.sagaSections().find((section) => section.name === wf.name);
    if (declared && declared.steps.length === 0 && wf.hooks.length === 0) {
      this.warn("EML430", `Saga workflow "${wf.name}" declares no steps.`, {
        hint: "Bind its flowchart nodes with %%step directives, e.g. %%step B UpdateEntity field: status value: escalated.",
      });
    }
  }

  // -------------------------------------------------------------------------
  // EML500-EML529: Cross-document consistency checks
  // -------------------------------------------------------------------------

  private checkCrossDocument(): void {
    const entityNames = new Set(this.model.entities.map((e) => e.name));
    const enumNames = new Set(this.model.enums.map((e) => e.name));
    const entityAttrMap = new Map<string, Map<string, EmlAttribute>>();
    for (const e of this.model.entities) {
      const m = new Map<string, EmlAttribute>();
      for (const a of e.attributes) m.set(a.name, a);
      entityAttrMap.set(e.name, m);
    }

    // EML500: State workflow entity should have a status/state field
    for (const wf of this.model.workflows) {
      if (wf.kind === "state" && wf.entity && entityNames.has(wf.entity)) {
        const attrs = entityAttrMap.get(wf.entity);
        const hasStatusField =
          attrs && (attrs.has("status") || attrs.has("state") || attrs.has("stage"));
        if (!hasStatusField) {
          this.warn(
            "EML500",
            `State workflow "${wf.name}" is bound to "${wf.entity}" which has no "status", "state", or "stage" field.`,
            {
              hint: `Add  string status  to "${wf.entity}" — the state machine needs a field to track the current state.`,
            }
          );
        }
      }
    }

    // EML501: %%field enum references — check they exist
    // (done already in checkFieldDirectives, but also check attributes with enumRef from parser)
    for (const entity of this.model.entities) {
      for (const attr of entity.attributes) {
        if (attr.enumRef && !enumNames.has(attr.enumRef)) {
          this.warn(
            "EML501",
            `Attribute "${entity.name}.${attr.name}" has enum reference "${attr.enumRef}" but no matching %%enum is declared.`,
            {
              hint: `Add  %%enum ${attr.enumRef}: value1, value2  to the document.`,
            }
          );
        }
      }
    }

    // EML502: FK attributes — verify a relationship exists between this entity and the referenced entity
    const declaredNames = new Set(this.model.entities.map((candidate) => candidate.name));
    for (const entity of this.model.entities) {
      /*
       * Parents this entity declares an edge to, minus the ones another foreign
       * key already accounts for by name. The generator resolves an unnamed
       * key through exactly this list — see `buildFkOverrides` — so a column
       * the compiler resolves must not be reported here as resolving to
       * nothing. `ImagingReport.radiologist_id` derives a `Radiologist` nobody
       * declared, and the model plainly says `Doctor ||--o{ ImagingReport`;
       * the compiler wins, and the definition is the bug.
       */
      const claimed = new Set(
        entity.attributes
          .filter((candidate) => candidate.isForeignKey && candidate.name.endsWith("_id"))
          .map((candidate) => this.fkToEntityName(candidate.name))
          .filter((name) => declaredNames.has(name))
      );
      const spareParents = this.model.relationships
        .filter((r) => r.target === entity.name && r.source !== entity.name)
        .map((r) => r.source)
        .filter((name) => declaredNames.has(name) && !claimed.has(name));

      for (const attr of entity.attributes) {
        if (attr.isForeignKey && attr.name.endsWith("_id")) {
          // Derive the expected parent entity name from the FK attribute name
          const parentEntityName = this.fkToEntityName(attr.name);
          const hasRelationship = this.model.relationships.some(
            (r) =>
              (r.source === entity.name || r.target === entity.name) &&
              (r.source === parentEntityName || r.target === parentEntityName)
          );
          // A name that resolves to nothing, on an entity with a spare declared
          // parent, is the case the generator overrides rather than drops.
          const resolvedByRelationship =
            !declaredNames.has(parentEntityName) && spareParents.length > 0;
          if (resolvedByRelationship) spareParents.shift();

          if (!hasRelationship && !resolvedByRelationship) {
            this.info(
              "EML502",
              `FK attribute "${entity.name}.${attr.name}" has no relationship to "${parentEntityName}".`,
              {
                hint: `Add:  ${parentEntityName} ||--o{ ${entity.name} : "..."  (or reverse for manyToOne).`,
              }
            );
          }
        }
      }
    }

    // EML503: Entities with no relationships at all (isolated)
    if (this.model.entities.length > 1) {
      const connectedEntities = new Set<string>();
      for (const r of this.model.relationships) {
        connectedEntities.add(r.source);
        connectedEntities.add(r.target);
      }
      for (const e of this.model.entities) {
        if (!connectedEntities.has(e.name)) {
          this.info("EML503", `Entity "${e.name}" has no relationships to other entities.`, {
            hint: "Is this intentional? Isolated entities are valid but may indicate a missing relationship.",
          });
        }
      }
    }

    // EML504: Duplicate rule names
    const ruleNames = new Set<string>();
    for (const rule of this.model.rules) {
      if (ruleNames.has(rule.name)) {
        this.warn("EML504", `Duplicate rule name "${rule.name}".`, {
          hint: "Give each business rule a unique name in its %%rule directive.",
        });
      }
      ruleNames.add(rule.name);
    }

    // EML505: Duplicate workflow names
    const workflowNames = new Set<string>();
    for (const wf of this.model.workflows) {
      if (workflowNames.has(wf.name)) {
        this.warn("EML505", `Duplicate workflow name "${wf.name}".`, {
          hint: "Give each workflow a unique name in its %%workflow directive.",
        });
      }
      workflowNames.add(wf.name);
    }

    // EML506: Rules with no entity binding have limited generator impact
    for (const rule of this.model.rules) {
      if (!rule.entity) {
        this.info("EML506", `Rule "${rule.name}" has no entity binding.`, {
          hint: `Add  %%rule ${rule.name} on <Entity> event: <hookType>  to bind this rule to an entity lifecycle.`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The checker, as a function
// ---------------------------------------------------------------------------

/**
 * Check an EML document held in memory.
 *
 * Everything below this line reads a file, writes an `.error` file beside it and
 * prints in colour, none of which a browser tab can do — but the checking itself
 * only ever needed the text. Exposing it is what lets `appwithai-wasm` and the
 * upload page refuse a broken model with the same diagnostics the CLI prints,
 * rather than each growing a weaker check of its own.
 */
export function checkSource(source: string): CheckResult {
  return new CheckEngine(parseEml(source), source).run();
}

// ---------------------------------------------------------------------------
// Auto-fixable error codes — the fixer knows how to repair these
// ---------------------------------------------------------------------------

/** Issues the fixer.ts can repair automatically. */
export const AUTO_FIXABLE_CODES = new Set([
  "EML117", // no PK → add string id PK
  "EML421", // no initial state → add [*] --> firstState
  "EML422", // no terminal state → add lastState --> [*]
  "EML001", // missing meta name → add %%meta name:
  "EML114", // FK not ending in _id → append the suffix (_by columns then resolve to bus_user)
  "EML112", // duplicate attribute → delete the later line, keeping the stronger constraints
  "EML103", // a column the generator adds → delete the line
]);

/** Structured output written to <file>.error for the fixer to consume. */
interface ErrorFileContent {
  /** The .mmd file that was checked. */
  file: string;
  /** ISO timestamp of this check run. */
  checkedAt: string;
  /** Language spec version the checker ran against. */
  languageVersion: string;
  summary: { errors: number; warnings: number; infos: number; ok: boolean };
  issues: Array<
    Issue & {
      /** Whether fixer.ts can repair this automatically. */
      autoFixable: boolean;
    }
  >;
}

function buildErrorFile(
  result: CheckResult,
  filePath: string,
  languageVersion: string
): ErrorFileContent {
  return {
    file: path.resolve(filePath),
    checkedAt: new Date().toISOString(),
    languageVersion,
    summary: {
      errors: result.errors,
      warnings: result.warnings,
      infos: result.infos,
      ok: result.ok,
    },
    issues: result.issues.map((issue) => ({
      ...issue,
      autoFixable: AUTO_FIXABLE_CODES.has(issue.code),
    })),
  };
}

function writeErrorFile(filePath: string, content: ErrorFileContent): void {
  const errorFilePath = `${filePath.replace(/\.mmd$/, "")}.mmd.error`;
  writeFileSync(errorFilePath, JSON.stringify(content, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

function formatIssues(issues: Issue[], filePath: string, showHints: boolean): string {
  if (issues.length === 0) return "";
  const lines: string[] = [];
  for (const issue of issues) {
    const col = sevColor(issue.severity);
    const label = sevLabel(issue.severity);
    const loc = issue.line ? c.dim(`:${issue.line}`) : "";
    const filePart = c.dim(`${path.basename(filePath)}${loc}`);
    const code = c.dim(`[${issue.code}]`);
    lines.push(`  ${col(label)} ${code} ${filePart}  ${issue.message}`);
    if (showHints && issue.hint) {
      lines.push(`         ${c.dim("→")} ${c.dim(issue.hint)}`);
    }
    if (issue.context) {
      lines.push(`         ${c.dim(issue.context)}`);
    }
  }
  return lines.join("\n");
}

function formatSummary(result: CheckResult, filePath: string): string {
  const parts: string[] = [];
  if (result.errors > 0) parts.push(c.red(`${result.errors} error(s)`));
  else parts.push(c.green("0 errors"));
  if (result.warnings > 0) parts.push(c.yellow(`${result.warnings} warning(s)`));
  else parts.push("0 warnings");
  if (result.infos > 0) parts.push(c.cyan(`${result.infos} info`));
  return `${c.dim(path.basename(filePath))}  ${parts.join(c.dim(" · "))}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`${c.bold("eml-check")} — EML language checker

${c.bold("USAGE")}
  bun language/checker.ts <file.mmd> [options]
  bun language/checker.ts <dir/>         # Check all .mmd files in a directory

${c.bold("OPTIONS")}
  --strict     Treat warnings as errors (exit 1)
  --json       Machine-readable JSON output
  --no-color   Disable ANSI colour
  --no-hint    Suppress inline hints
  --summary    Print summary line only
  -h, --help   Show this help

${c.bold("EXAMPLES")}
  bun language/checker.ts examples/crm.eml.mmd
  bun language/checker.ts examples/crm.eml.mmd --strict
  bun language/checker.ts examples/ --json
  bun language/checker.ts examples/drug-discovery.eml.mmd --no-hint

${c.bold("EXIT CODES")}
  0  No errors (warnings allowed unless --strict)
  1  One or more errors (or warnings with --strict)
  2  Bad invocation / file not found
`);
}

async function checkFile(
  filePath: string,
  languageVersion: string
): Promise<{ result: CheckResult; file: string; errorFilePath: string }> {
  const result = checkSource(readFileSync(filePath, "utf8"));

  // Always write the .error file (overwrites previous run)
  const errorContent = buildErrorFile(result, filePath, languageVersion);
  writeErrorFile(filePath, errorContent);
  const errorFilePath = `${filePath.replace(/\.mmd$/, "")}.mmd.error`;

  return { result, file: filePath, errorFilePath };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--") && a !== "-h");
  const flags = {
    strict: hasFlag("--strict"),
    json: hasFlag("--json"),
    showHints: !hasFlag("--no-hint"),
    summary: hasFlag("--summary"),
    help: hasFlag("--help") || hasFlag("-h") || process.argv.includes("-h"),
  };

  if (flags.help || process.argv.length < 3) {
    printHelp();
    process.exit(0);
  }

  const inputArg = args[0];
  if (!inputArg) {
    console.error(c.red("Error: No input file or directory specified."));
    printHelp();
    process.exit(2);
  }

  if (!existsSync(inputArg)) {
    console.error(c.red(`Error: File or directory not found: ${inputArg}`));
    process.exit(2);
  }

  // Collect files to check
  let files: string[] = [];
  const { statSync, readdirSync } = await import("node:fs");
  const stat = statSync(inputArg);
  if (stat.isDirectory()) {
    const entries = readdirSync(inputArg, { withFileTypes: true });
    files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".mmd"))
      .map((e) => path.join(inputArg, e.name));
    if (files.length === 0) {
      console.error(c.yellow(`No .mmd files found in: ${inputArg}`));
      process.exit(0);
    }
  } else {
    files = [inputArg];
  }

  // Language version (for .error file metadata)
  let languageVersion = "1.0.0";
  try {
    const { loadLanguageDefinition } = await import("./index");
    languageVersion = loadLanguageDefinition().language.version;
  } catch {
    /* ignore */
  }

  // Run checks
  const allResults: Array<{ result: CheckResult; file: string; errorFilePath: string }> = [];
  for (const file of files) {
    try {
      const r = await checkFile(file, languageVersion);
      allResults.push(r);
    } catch (err) {
      console.error(
        c.red(`Error reading ${file}: ${err instanceof Error ? err.message : String(err)}`)
      );
      process.exit(2);
    }
  }

  // Output
  if (flags.json) {
    const output = allResults.map(({ result, file }) => ({
      file,
      ok: flags.strict
        ? result.issues.filter((i) => i.severity !== "info").length === 0
        : result.ok,
      errors: result.errors,
      warnings: result.warnings,
      infos: result.infos,
      issues: result.issues,
    }));
    console.log(JSON.stringify(output.length === 1 ? output[0] : output, null, 2));
  } else {
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const { result, file, errorFilePath } of allResults) {
      const effectiveErrors = flags.strict ? result.errors + result.warnings : result.errors;

      if (!flags.summary) {
        const header = `\n${c.bold("Checking")} ${c.cyan(file)}`;
        console.log(header);
        const formatted = formatIssues(result.issues, file, flags.showHints);
        if (formatted) {
          console.log(formatted);
        } else {
          console.log(c.green("  ✓ No issues found."));
        }
        // Always report where the error file was written
        const autoFixCount = result.issues.filter(
          (i) => AUTO_FIXABLE_CODES.has(i.code) && i.severity === "error"
        ).length;
        const fixHint =
          autoFixCount > 0
            ? c.cyan(
                ` (${autoFixCount} auto-fixable — run: bun language/fixer.ts ${path.basename(errorFilePath)})`
              )
            : "";
        console.log(c.dim(`  → wrote ${path.relative(process.cwd(), errorFilePath)}${fixHint}`));
      }

      console.log(`  ${formatSummary(result, file)}`);
      totalErrors += effectiveErrors;
      totalWarnings += result.warnings;
    }

    if (allResults.length > 1) {
      console.log();
      console.log(
        c.bold("Total: ") +
          (totalErrors > 0 ? c.red(`${totalErrors} error(s)`) : c.green("0 errors")) +
          c.dim("  ·  ") +
          (totalWarnings > 0 ? c.yellow(`${totalWarnings} warning(s)`) : "0 warnings")
      );
    }
  }

  // Exit code
  const anyErrors = allResults.some(({ result }) =>
    flags.strict ? result.errors > 0 || result.warnings > 0 : result.errors > 0
  );
  process.exit(anyErrors ? 1 : 0);
}

// Run only when this file *is* the command. Importing it — which the WASM
// generator now does, to check a model before compiling it — must not start a
// CLI, parse argv, or exit the process.
if (import.meta.main) {
  main().catch((err) => {
    console.error(c.red(`Fatal: ${err instanceof Error ? err.message : String(err)}`));
    if (process.env.EML_DEBUG) console.error(err);
    process.exit(2);
  });
}
