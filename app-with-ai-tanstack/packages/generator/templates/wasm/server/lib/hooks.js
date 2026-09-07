/**
 * Lifecycle hooks — what `%%hook` compiled to.
 *
 * A `%%hook` directive names a handler; it does not write one. The NestJS stack
 * generates a stub per handler for a developer to fill in, which works because
 * that application is source code someone will open. This one is assembled in a
 * browser and never edited, so a stub would be a handler that silently does
 * nothing forever.
 *
 * So handlers resolve in three steps: a built-in whose name matches the
 * declared handler, then a built-in matching the *shape* of the name
 * (`timestampX`, `generateX`, `computeX`, `notifyX`), then a recorded no-op
 * that shows up in the run log as unimplemented. The third case is visible in
 * the UI on purpose — "declared but not implemented" is information the model's
 * author needs, and it is exactly what a stub hides.
 */

import { snakeCase } from "./naming.js";

/** Handlers keyed by the verb the directive used. `field` is the bound column. */
const BUILT_INS = {
  /** `%%hook beforeCreate timestampAnomaly on X[field: anomaly_timestamp]` */
  timestamp: (record, { field }) => {
    if (field && !record[field]) record[field] = new Date().toISOString();
    return record;
  },
  /** A deterministic identifier for a field the model wants populated. */
  generate: (record, { field }) => {
    if (field && !record[field]) record[field] = cryptoId();
    return record;
  },
  /** Copy the record as it was, so an after-hook can diff it. */
  snapshot: (record, { previous, state }) => {
    state.snapshot = previous ? { ...previous } : null;
    return record;
  },
  /** Refuse the write when the bound field is empty. */
  require: (record, { field, fail }) => {
    if (field && isBlank(record[field])) fail(`${field} is required`);
    return record;
  },
  validate: (record, { field, fail }) => {
    if (field && isBlank(record[field])) fail(`${field} is required`);
    return record;
  },
  enforce: (record, { field, fail }) => {
    if (field && isBlank(record[field])) fail(`${field} is required`);
    return record;
  },
  /** Everything else that only needs to be seen: notifications, indexing, emits. */
  notify: (record, { note, handler }) => {
    note(`${handler} notified`);
    return record;
  },
  index: (record, { note, handler }) => {
    note(`${handler} queued for indexing`);
    return record;
  },
  emit: (record, { note, handler }) => {
    note(`${handler} emitted`);
    return record;
  },
  compute: (record, { field, note, handler }) => {
    if (field && record[field] == null) note(`${handler} left ${field} unset`);
    return record;
  },
};

const isBlank = (value) => value == null || String(value).trim() === "";

function cryptoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}`;
}

/** `generateInchiKey` -> `generate`; `notifyQualityTeam` -> `notify`. */
function verbOf(handler) {
  const first = snakeCase(handler).split("_")[0];
  return BUILT_INS[first] ? first : null;
}

/**
 * Run every hook declared for one entity lifecycle event, in the order the
 * model declared them, threading the record through each.
 */
export async function runHooks(hooks, lifecycle, entity, record, options = {}) {
  const applicable = (hooks || [])
    .filter((hook) => hook.entity === entity && hook.type === lifecycle)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const log = [];
  const failures = [];
  const state = {};
  let current = record;

  for (const hook of applicable) {
    const verb = verbOf(hook.handler);
    const context = {
      field: hook.field ? snakeCase(hook.field) : null,
      previous: options.previous ?? null,
      handler: hook.handler,
      state,
      note: (message) => log.push({ handler: hook.handler, lifecycle, message }),
      fail: (message) => failures.push({ handler: hook.handler, lifecycle, message }),
    };

    if (!verb) {
      log.push({
        handler: hook.handler,
        lifecycle,
        message: `declared by the model, no implementation matched`,
        unimplemented: true,
      });
      continue;
    }

    try {
      const result = await BUILT_INS[verb](current, context);
      if (result !== undefined) current = result;
      if (!log.some((entry) => entry.handler === hook.handler)) {
        log.push({ handler: hook.handler, lifecycle, message: "ran" });
      }
    } catch (error) {
      failures.push({ handler: hook.handler, lifecycle, message: error.message });
    }
  }

  return { record: current, log, failures };
}
