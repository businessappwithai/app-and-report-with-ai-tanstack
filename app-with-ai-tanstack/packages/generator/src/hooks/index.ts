/**
 * `%%hook` directives → generated lifecycle handlers.
 *
 * A workflow's diagram is how a reader sees the lifecycle; its `%%hook`
 * directives are what the generated application runs. The directives were being
 * stored faithfully in the model and then dropped on the floor at generation
 * time — `getHooks()` in the generated backend always returned `{}`, so a model
 * could declare `beforeCreate hashPassword on User` and the generated app would
 * silently do nothing.
 *
 * This module reads the directives, validates them against the entities the
 * model actually declares, and hands the generator a list it can turn into
 * handler modules and a registry.
 *
 * The directive is self-describing (`... on <Entity>`), so hooks are collected
 * from the whole document rather than per workflow section. A hook declared
 * outside a `%%workflow` block is still a hook.
 */

/** The lifecycle events a hook may bind to. Mirrors `language/appwithai-language.json`. */
export const HOOK_TYPES = [
  "beforeCreate",
  "afterCreate",
  "beforeUpdate",
  "afterUpdate",
  "beforeDelete",
  "afterDelete",
  "beforeRead",
  "afterRead",
  "beforeQuery",
  "afterQuery",
  "beforeList",
  "afterList",
  "customValidate",
] as const;

export type HookType = (typeof HOOK_TYPES)[number];

const HOOK_TYPE_SET: ReadonlySet<string> = new Set(HOOK_TYPES);

/** What each hook is handed and what the generated service does with the result. */
export const HOOK_CONTRACTS: Record<
  HookType,
  { param: string; paramType: string; returns: string; summary: string }
> = {
  beforeCreate: {
    param: "data",
    paramType: "Record<string, any>",
    returns: "Record<string, any>",
    summary: "Runs before the insert. Return the record to write.",
  },
  afterCreate: {
    param: "record",
    paramType: "Record<string, any>",
    returns: "void",
    summary: "Runs after the insert. Side effects only.",
  },
  beforeUpdate: {
    param: "data",
    paramType: "Record<string, any>",
    returns: "Record<string, any>",
    summary: "Runs before the update. Return the values to write.",
  },
  afterUpdate: {
    param: "record",
    paramType: "Record<string, any>",
    returns: "void",
    summary: "Runs after the update. Side effects only.",
  },
  beforeDelete: {
    param: "id",
    paramType: "string",
    returns: "boolean",
    summary: "Runs before the delete. Return false to block it.",
  },
  afterDelete: {
    param: "record",
    paramType: "Record<string, any>",
    returns: "void",
    summary: "Runs after the delete. Clean up related state.",
  },
  beforeRead: {
    param: "params",
    paramType: "Record<string, any>",
    returns: "Record<string, any>",
    summary: "Runs before a single-record read. Return the lookup params.",
  },
  afterRead: {
    param: "record",
    paramType: "Record<string, any>",
    returns: "void",
    summary: "Runs after a single-record read. Redact or enrich in place.",
  },
  beforeQuery: {
    param: "query",
    paramType: "Record<string, any>",
    returns: "Record<string, any>",
    summary: "Runs before a query. Return the query to execute.",
  },
  afterQuery: {
    param: "rows",
    paramType: "Record<string, any>[]",
    returns: "void",
    summary: "Runs after a query. Post-process the rows.",
  },
  beforeList: {
    param: "params",
    paramType: "Record<string, any>",
    returns: "Record<string, any>",
    summary: "Runs before a list. Return the filter/sort/paging params.",
  },
  afterList: {
    param: "rows",
    paramType: "Record<string, any>[]",
    returns: "void",
    summary: "Runs after a list. Post-process the page.",
  },
  customValidate: {
    param: "data",
    paramType: "Record<string, any>",
    returns: "void",
    summary: "Runs on every create and update. Throw to reject the write.",
  },
};

export interface CompiledHook {
  entity: string;
  type: HookType;
  /** The generated function's name. */
  handler: string;
  /** Field the hook is scoped to, when the directive names one. */
  field?: string;
  /** Order of declaration within the entity — hooks run in the order written. */
  order: number;
}

/**
 * `%%hook <type> <handler> on <Entity>[field: a, field: b]`
 *
 * The leading `%%` may be repeated (`%%%%hook`), which older generated
 * flowcharts emitted, so the anchor allows a run of them — but it is still an
 * anchor. Matching `%%hook` anywhere in the line meant a plain `%%` comment
 * that merely *mentioned* a hook compiled into a real one: prose is the one
 * thing the language promises is inert, and every other directive parser in the
 * generator anchors at `^%%` for exactly this reason.
 */
const DIRECTIVE = /^%%+hook\s+(\w+)\s+([A-Za-z_]\w*)\s+on\s+([A-Za-z_]\w*)\s*(\[[^\]]*\])?/;

/** Cheap pre-filter, held to the same anchor as DIRECTIVE. */
const DIRECTIVE_LINE = /^%%+hook\b/;

function parseFields(bracket: string | undefined): string | undefined {
  if (!bracket) return undefined;
  const inner = bracket.slice(1, -1).trim();
  if (!inner) return undefined;
  for (const part of inner.split(",")) {
    const match = part.trim().match(/^(?:field:\s*)?(\w+)$/);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

/**
 * Read every `%%hook` directive in the document.
 *
 * `knownEntities` is what the ERD declares. A hook naming something else would
 * generate an import of a module for an entity that does not exist, so it is
 * reported and dropped rather than allowed to break the build.
 */
export function compileHooks(
  source: string,
  knownEntities: string[] = [],
  onWarn: (message: string) => void = () => {}
): CompiledHook[] {
  const known = new Set(knownEntities);
  const hooks: CompiledHook[] = [];
  const seen = new Set<string>();
  const perEntity = new Map<string, number>();

  for (const rawLine of (source ?? "").split("\n")) {
    const line = rawLine.trim();
    if (!DIRECTIVE_LINE.test(line)) continue;

    const match = line.match(DIRECTIVE);
    if (!match) {
      onWarn(`Skipping malformed hook directive: ${line}`);
      continue;
    }

    const [, type, handler, entity, bracket] = match as unknown as [
      string,
      string,
      string,
      string,
      string | undefined,
    ];

    if (!HOOK_TYPE_SET.has(type)) {
      onWarn(`Hook "${handler}" on ${entity} uses unknown event "${type}" — skipped.`);
      continue;
    }
    if (known.size && !known.has(entity)) {
      onWarn(`Hook "${handler}" targets unknown entity "${entity}" — skipped.`);
      continue;
    }

    // Two directives naming the same function on the same event would generate
    // a duplicate export; the second is redundant either way.
    const key = `${entity}:${type}:${handler}`;
    if (seen.has(key)) {
      onWarn(`Hook "${handler}" is declared twice for ${entity}.${type} — keeping the first.`);
      continue;
    }
    seen.add(key);

    const order = perEntity.get(entity) ?? 0;
    perEntity.set(entity, order + 1);

    hooks.push({
      entity,
      type: type as HookType,
      handler,
      field: parseFields(bracket),
      order,
    });
  }

  // A handler name is a function name in a per-entity module, so the same name
  // cannot serve two events for one entity.
  const byName = new Map<string, CompiledHook>();
  const kept: CompiledHook[] = [];
  for (const hook of hooks) {
    const nameKey = `${hook.entity}:${hook.handler}`;
    const clash = byName.get(nameKey);
    if (clash) {
      onWarn(
        `Hook "${hook.handler}" on ${hook.entity} is bound to both ${clash.type} and ` +
          `${hook.type} — keeping ${clash.type}. Give each event its own handler name.`
      );
      continue;
    }
    byName.set(nameKey, hook);
    kept.push(hook);
  }

  return kept;
}

/** Group hooks by entity, preserving declaration order. */
export function hooksByEntity(hooks: CompiledHook[]): Map<string, CompiledHook[]> {
  const grouped = new Map<string, CompiledHook[]>();
  for (const hook of hooks) {
    const list = grouped.get(hook.entity);
    if (list) list.push(hook);
    else grouped.set(hook.entity, [hook]);
  }
  for (const list of grouped.values()) list.sort((a, b) => a.order - b.order);
  return grouped;
}
