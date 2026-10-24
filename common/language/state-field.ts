/**
 * The state field — the one column a `kind: state` workflow drives.
 *
 * An entity with a state machine keeps its current state in `status`, else
 * `state`, else `stage`, whichever it declares first in that order. That column
 * is **system-managed**: no person changes it through a form or a direct API
 * write. Only background workflows move it — a saga's `UpdateEntity` step, a
 * rule's `trigger-workflow`, a hook, the application's own code — and a new
 * record starts in the machine's initial state. It is shown read-only in the
 * header of the record's form and always as a column of the list grid, never as
 * a field in a `%%section` row.
 *
 * This is the only statement of which column that is. The checker, the
 * generator's dictionary, the NestJS seeds and the browser runtime all ask it,
 * because three heuristics had grown up for one fact and disagreed (one of them
 * drove a `workflow_status` column on an entity whose state was `stage`). Pure —
 * no `node:` imports — so the browser bundles carry it too.
 */

/** Column names that hold a state machine's current state, in priority order. */
export const STATE_FIELD_CANDIDATES = ["status", "state", "stage"] as const;

/**
 * The state field among `columns`, or `undefined` when there is none.
 *
 * Only meaningful for an entity that has a `kind: state` workflow: on any other
 * entity a `status` column is ordinary data that a person may edit.
 */
export function stateFieldOf(columns: Iterable<string>): string | undefined {
  const names = new Set(columns);
  return STATE_FIELD_CANDIDATES.find((candidate) => names.has(candidate));
}

/** The error code a person's attempt to write a state field is refused with. */
export const STATE_FIELD_REFUSAL_CODE = "STATE_FIELD_SYSTEM_MANAGED";
