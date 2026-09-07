/**
 * The business-rule designer, as a viewer.
 *
 * A `%%rule` section is a decision flowchart whose node *shapes* carry the
 * role -- a stadium is where the rule starts or ends, a diamond is a branch, a
 * rectangle applies an outcome, a rounded node works a value out. This draws
 * the same five roles in the same five colours the design tool's canvas uses,
 * because a rule someone drew there and a rule a language model wrote should
 * not look like two different kinds of thing.
 *
 * The roles arrive already resolved from `eml-model.js`, which reads them the
 * way the rule compiler does. Colouring them is this file's whole job.
 *
 * `%%action` directives are drawn beside the flowchart rather than inside it:
 * they are what the rule *emits* -- a refusal, a transform, a workflow trigger
 * -- and they are the half a reader most often forgets is there, because
 * Mermaid renders the diagram identically with or without them.
 */

import { Canvas, el } from "./canvas.js";

const ROLE_LABELS = {
  start: "Start",
  decision: "Decision",
  action: "Action",
  compute: "Compute",
  end: "End",
};

const ROLE_HINTS = {
  start: "Where the rule begins -- the input context.",
  decision: "A branch. Each outgoing arrow carries its condition.",
  action: "Sets a value or applies an outcome.",
  compute: "Works out a value from the inputs.",
  end: "The rule's result.",
};

const ROLE_GLYPHS = {
  start: "▶",
  decision: "◆",
  action: "■",
  compute: "ƒ",
  end: "◼",
};

/**
 * What each action type does to a write, in the runtime's terms.
 *
 * The generated rules engine reads its own vocabulary, and the generator
 * translates EML's into it -- `validation-error` becomes `prevent`, a
 * `transform` becomes one `transformData` object. A reader looking at the
 * directive needs to know which of those it is looking at, because only one of
 * them stops the write.
 */
const ACTION_EFFECT = {
  "validation-error": "Refuses the write and reports the message.",
  prevent: "Refuses the write and reports the message.",
  transform: "Rewrites a field before the record is saved.",
  "trigger-workflow": "Starts the named workflow once the write succeeds.",
  "set-value": "Writes a value onto the record.",
  notify: "Sends a notification once the write succeeds.",
};

function nodeCard(node) {
  const card = el("div", "awv-step is-" + node.role);
  const head = el("div", "awv-step-head");
  head.append(el("span", "awv-step-glyph", ROLE_GLYPHS[node.role] || "■"));
  head.append(el("span", "awv-step-role", ROLE_LABELS[node.role] || node.role));
  head.title = ROLE_HINTS[node.role] || "";
  card.append(head);
  card.append(el("p", "awv-step-label", node.label || "Untitled step"));
  return card;
}

/** The decision-flow canvas for one rule. */
export class RuleFlowViewer {
  constructor(host) {
    this.canvas = new Canvas(host, {
      direction: "down",
      gapWithin: 44,
      gapBetween: 74,
      emptyMessage: "This rule declares no steps yet.",
    });
  }

  render(rule) {
    const nodes = rule.nodes.map((node) => ({
      id: node.id,
      element: nodeCard(node),
      className: "awv-node-step",
    }));

    const edges = rule.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      className: edge.label ? "is-branch" : "",
    }));

    this.canvas.render(nodes, edges);
  }
}

/** The `%%action` directives a rule emits, with what each one does. */
export function actionList(actions) {
  const list = el("div", "awv-actions");
  if (actions.length === 0) {
    list.append(
      el(
        "p",
        "awv-actions-empty",
        "This rule declares no %%action, so it decides an outcome without changing anything."
      )
    );
    return list;
  }

  for (const action of actions) {
    const card = el("article", "awv-action");
    const head = el("div", "awv-action-head");
    head.append(el("span", "awv-action-name", action.name));
    head.append(el("code", "awv-action-type", action.type));
    card.append(head);

    const effect = ACTION_EFFECT[action.type];
    if (effect) card.append(el("p", "awv-action-effect", effect));

    const when = el("p", "awv-action-when");
    when.append(el("span", "awv-badge is-when", "when"));
    when.append(document.createTextNode(" "));
    when.append(el("code", null, action.when));
    card.append(when);

    const keys = Object.keys(action.props || {});
    if (keys.length) {
      const props = el("dl", "awv-action-props");
      for (const key of keys) props.append(el("dt", null, key), el("dd", null, action.props[key]));
      card.append(props);
    }

    list.append(card);
  }

  return list;
}

/**
 * The rule as the generated application will hold it.
 *
 * Which table it is bound to, which write runs it, at what priority. The
 * flowchart says what the rule decides; this says when it is asked.
 */
export function ruleSummary(rule) {
  const summary = el("dl", "awv-rule-summary");
  const row = (term, value, title) => {
    const dt = el("dt", null, term);
    const dd = el("dd", null, value);
    if (title) dd.title = title;
    summary.append(dt, dd);
  };

  row("Entity", rule.entity);
  row("Table", rule.tableName, "The table the rules engine matches on");
  row("Event", rule.event);
  row("Operation", rule.operation, "The write the rules engine keys on");
  row("Priority", String(rule.priority), "Lower runs first");
  if (!rule.compiled) {
    row(
      "Status",
      "not compiled",
      "The section did not compile, so this rule is not in the generated application. The checker reports why."
    );
    summary.classList.add("is-uncompiled");
  }
  return summary;
}
