// Workflow state machines.
// Builds a transition table per entity from the EML state workflows, and
// enforces legal status transitions on update.

import { MODEL } from "./model.js";

/** entity -> { initial, states, statusField, transitions: {from: {event: to}} } */
export const stateMachines = buildStateMachines();

function buildStateMachines() {
  const machines = {};
  for (const wf of MODEL.workflows ?? []) {
    if (wf.kind !== "state" || !wf.entity) continue;
    const transitions = {};
    let initial = null;
    for (const t of wf.transitions ?? []) {
      if (t.from === "[*]") {
        initial = t.to;
        continue;
      }
      if (t.to === "[*]") continue;
      (transitions[t.from] ??= {})[t.event || `${t.from}_to_${t.to}`] = t.to;
    }
    machines[wf.entity] = {
      initial: initial ?? wf.states?.[0] ?? null,
      states: wf.states ?? [],
      statusField: "status",
      transitions,
    };
  }
  return machines;
}

/** Is a direct from->to transition allowed for this entity? */
export function canTransition(entity, from, to) {
  const sm = stateMachines[entity];
  if (!sm) return true; // no state machine => unrestricted
  if (from == null) return true;
  const events = sm.transitions[from] ?? {};
  return Object.values(events).includes(to);
}

/** Reachable next states from a given state. */
export function nextStates(entity, from) {
  const sm = stateMachines[entity];
  if (!sm) return [];
  return Object.values(sm.transitions[from] ?? {});
}
