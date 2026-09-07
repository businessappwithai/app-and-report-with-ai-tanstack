/**
 * The administrative screens: dictionary, rules, processes, audit, model.
 *
 * They are grouped in one module because they share a shape — read something
 * the generator seeded, show it next to what the running database now says
 * about it — and because separating five read-only tables into five files would
 * be filing, not structure.
 *
 * The rules screen earns its place. A rule compiled from a flowchart has prose
 * decisions, and the engine's reading of them is a guess that can be wrong;
 * showing the expression each decision became, and marking the ones nothing
 * matched, is the difference between a rule you can trust and a rule that
 * returns "passed".
 */

import { el, mount, spinner, empty, displayValue, toast } from "../dom.js";
import { api } from "../api.js";
import { setHelp } from "../main.js";

/**
 * The Application Dictionary, as the application actually holds it.
 *
 * It used to list the tables and stop there, which showed the smallest part of
 * the dictionary and none of the part that decides what a screen looks like.
 * The reference type on a column is why a field is a dropdown rather than a
 * text box; the reference lists are the dropdown's values; the windows and tabs
 * are how the screens are grouped. All of it is seeded at first boot and all of
 * it is readable, so all of it is shown.
 *
 * Picking a table opens its columns. That is one request per table rather than
 * one for every table at load, because a seventeen-entity model has several
 * hundred columns and nobody reads them all at once.
 */
export async function dictionaryView(root) {
  mount(root, spinner("Reading the dictionary"));
  const [tables, summary, references, refLists, windows, tabs] = await Promise.all([
    api.get("/sys/tables"),
    api.get("/sys/model-summary"),
    api.get("/sys/references"),
    api.get("/sys/ref-list"),
    api.get("/sys/windows"),
    api.get("/sys/tabs"),
  ]);

  const columnsByTable = new Map();
  const listsByReference = new Map();
  for (const row of refLists) {
    if (!listsByReference.has(row.sys_reference_id)) listsByReference.set(row.sys_reference_id, []);
    listsByReference.get(row.sys_reference_id).push(row);
  }
  const referenceName = new Map(references.map((row) => [row.sys_reference_id, row.name]));

  /* The lists a model declared, rather than the twenty-two standard types every
     application has: those are the %%enum vocabularies, and they are the ones
     worth reading next to the columns that use them. */
  const modelReferences = references.filter((row) => row.sys_reference_id >= 1000);

  const detail = el("div.dict__detail", el("p.muted", "Select a table to see its columns."));

  async function showColumns(table) {
    if (!columnsByTable.has(table.sys_table_id)) {
      columnsByTable.set(
        table.sys_table_id,
        await api.get(`/sys/columns?tableId=${table.sys_table_id}`)
      );
    }
    const columns = columnsByTable.get(table.sys_table_id);
    mount(
      detail,
      el(
        "div",
        el("h3.section-title", `${table.name} — ${columns.length} columns`),
        table.description ? el("p.lede", table.description) : null,
        el(
          "div.table-wrap",
          el(
            "table.table",
            el(
              "thead",
              el(
                "tr",
                ["Column", "Name", "Reference", "Lookup", "Required", "Length", "Default", "Help"].map(
                  (heading) => el("th", heading)
                )
              )
            ),
            el(
              "tbody",
              columns.map((column) =>
                el(
                  "tr",
                  el("td", el("code", column.column_name)),
                  el("td", column.name || "—"),
                  el(
                    "td",
                    referenceName.get(column.sys_reference_id) ??
                      (column.sys_reference_id >= 1000 ? "List" : String(column.sys_reference_id ?? "—"))
                  ),
                  el("td", column.ref_table_name ? el("code", column.ref_table_name) : "—"),
                  el("td", column.is_mandatory ? "Yes" : "No"),
                  el("td", displayValue(column.field_length ?? "—")),
                  el("td", displayValue(column.default_value ?? "—")),
                  el("td.dict__help", column.description || "—")
                )
              )
            )
          )
        )
      )
    );
  }

  mount(
    root,
    panel(
      "Application Dictionary",
      "Every screen in this application is drawn from these rows. Change one and the screen changes.",
      el(
        "div",
        statRow([
          ["Tables", tables.length],
          ["References", references.length],
          ["List values", refLists.length],
          ["Windows", windows.length],
          ["Tabs", tabs.length],
          ["Rules", summary.counts.rules],
        ]),

        el("h3.section-title", "Tables"),
        el(
          "div.table-wrap",
          el(
            "table.table",
            el(
              "thead",
              el(
                "tr",
                ["Table", "Name", "Category", "Window", "Records", "Help"].map((heading) =>
                  el("th", heading)
                )
              )
            ),
            el(
              "tbody",
              tables.map((table) =>
                el(
                  "tr.dict__row",
                  {
                    onclick: () => showColumns(table),
                    title: `Show the columns of ${table.name}`,
                  },
                  el("td", el("code", table.table_name)),
                  el("td", table.name),
                  el("td", table.category_name || "—"),
                  el("td", table.window_name || "—"),
                  el("td", displayValue(summary.records[entityFor(table.name, summary)] ?? "—")),
                  el("td.dict__help", table.description || "—")
                )
              )
            )
          )
        ),

        el("h3.section-title", "Columns"),
        detail,

        el("h3.section-title", "Reference lists"),
        modelReferences.length === 0
          ? el("p.muted", "This model declares no %%enum vocabularies.")
          : el(
              "div.table-wrap",
              el(
                "table.table",
                el(
                  "thead",
                  el("tr", ["Reference", "Name", "Values"].map((heading) => el("th", heading)))
                ),
                el(
                  "tbody",
                  modelReferences.map((reference) =>
                    el(
                      "tr",
                      el("td", el("code", String(reference.sys_reference_id))),
                      el("td", reference.name),
                      el(
                        "td",
                        (listsByReference.get(reference.sys_reference_id) ?? [])
                          .map((row) => row.name || row.value)
                          .join(" · ") || "—"
                      )
                    )
                  )
                )
              )
            ),

        el("h3.section-title", "Windows and tabs"),
        el(
          "div.table-wrap",
          el(
            "table.table",
            el(
              "thead",
              el("tr", ["Window", "Tab", "Table", "Sequence"].map((heading) => el("th", heading)))
            ),
            el(
              "tbody",
              tabs.length === 0
                ? [el("tr", el("td", { colspan: 4 }, "No tabs seeded."))]
                : tabs.map((tab) => {
                    const window = windows.find((row) => row.sys_window_id === tab.sys_window_id);
                    const table = tables.find((row) => row.sys_table_id === tab.sys_table_id);
                    return el(
                      "tr",
                      el("td", window?.name || "—"),
                      el("td", tab.name),
                      el("td", table ? el("code", table.table_name) : "—"),
                      el("td", displayValue(tab.seq_no ?? "—"))
                    );
                  })
            )
          )
        )
      )
    )
  );
}

const entityFor = (name, summary) =>
  Object.keys(summary.records).find((key) => key.toLowerCase() === String(name).replace(/\s+/g, "").toLowerCase()) ??
  name;

export async function rulesView(root) {
  mount(root, spinner("Loading rules"));
  const rules = await api.get("/rules");

  if (!rules.length) {
    mount(root, panel("Business rules", "", empty("This model declares no rules", "Add a %%rule section to the EML and regenerate.")));
    return;
  }

  mount(
    root,
    panel(
      "Business rules",
      "Compiled from the model's %%rule sections into GoRules JDM, and evaluated here by the browser engine.",
      el(
        "div.cards",
        rules.map((rule) =>
          el(
            "article.rule",
            el(
              "header.rule__head",
              el("h3.rule__name", rule.name),
              el("span.badge", `${rule.entity_name} · ${rule.event}`)
            ),
            el(
              "p.rule__meta",
              `${rule.reading.shape === "decision-table" ? "Decision table" : "Decision graph"} · priority ${rule.priority}`
            ),
            rule.reading.decisions.length
              ? el(
                  "ul.decisions",
                  rule.reading.decisions.map((decision) =>
                    el(
                      `li.decision${decision.assumed ? ".decision--assumed" : ""}`,
                      el("span.decision__label", decision.label),
                      el(
                        "span.decision__reading",
                        decision.assumed ? `assumed true — ${decision.reason}` : decision.expression
                      )
                    )
                  )
                )
              : el("p.rule__meta", "No branching decisions."),
            el(
              "button.btn.btn--small",
              { onclick: () => tryRule(rule) },
              "Try this rule"
            )
          )
        )
      )
    )
  );
}

/** Evaluate a rule against a record the reader types, and show the trace. */
async function tryRule(rule) {
  const input = prompt(
    `Evaluate ${rule.name} against a record.\nJSON, e.g. {"status":"draft"}`,
    '{"status":"draft"}'
  );
  if (input == null) return;
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    toast("That is not valid JSON", "error");
    return;
  }
  try {
    const result = await api.post("/rules/evaluate", {
      entity: rule.entity_name,
      operation: rule.operation,
      data,
    });
    const lines = [
      `${result.rulesEvaluated} rule(s) evaluated`,
      `${result.violations.length} refusal(s)`,
      ...result.violations.map((violation) => `  ✗ ${violation.message}`),
      ...Object.entries(result.mutations).map(([field, value]) => `  → sets ${field} = ${value}`),
      ...result.notifications.map((note) => `  ! ${note.message || note.action}`),
    ];
    toast(lines.join("\n"), result.violations.length ? "error" : "success");
  } catch (error) {
    toast(error.message, "error");
  }
}

export async function processesView(root) {
  mount(root, spinner("Loading processes"));
  const [definitions, runs] = await Promise.all([
    api.get("/workflows/definitions"),
    api.get("/workflows/runs?limit=25"),
  ]);

  mount(
    root,
    panel(
      "Processes",
      "State machines and sagas the model declared. A record moves through one by being updated — there is no side door.",
      el(
        "div",
        definitions.length
          ? el(
              "div.cards",
              definitions.map((definition) => {
                const parsed = typeof definition.definition === "string" ? JSON.parse(definition.definition) : definition.definition;
                return el(
                  "article.rule",
                  el(
                    "header.rule__head",
                    el("h3.rule__name", definition.name),
                    el("span.badge", `${definition.entity_name} · ${definition.kind}`)
                  ),
                  parsed.states
                    ? el(
                        "div.states",
                        parsed.states.map((state) =>
                          el(
                            `span.state${state === parsed.initial ? ".state--initial" : ""}`,
                            typeof state === "string" ? state : state.name
                          )
                        )
                      )
                    : null,
                  parsed.transitions
                    ? el(
                        "ul.transitions",
                        parsed.transitions.map((transition) =>
                          el("li", `${transition.from} → ${transition.to}`, transition.trigger ? el("span.badge.badge--soft", transition.trigger) : null)
                        )
                      )
                    : null,
                  parsed.steps
                    ? el("ol.transitions", parsed.steps.map((step) => el("li", `${step.name} (${step.type})`)))
                    : null
                );
              })
            )
          : empty("This model declares no processes"),
        el("h2.section-title", "Recent transitions"),
        runs.data.length
          ? el(
              "div.table-wrap",
              el(
                "table.table",
                el("thead", el("tr", ["When", "Process", "Entity", "From", "To", "Modelled"].map((h) => el("th", h)))),
                el(
                  "tbody",
                  runs.data.map((run) =>
                    el(
                      "tr",
                      el("td", displayValue(run.created_at)),
                      el("td", run.workflow_name),
                      el("td", run.entity_name),
                      el("td", run.from_state || "—"),
                      el("td", run.to_state),
                      el("td", run.status === "completed" ? "Yes" : "No")
                    )
                  )
                )
              )
            )
          : empty("Nothing has moved yet", "Change a record's status to see it here.")
      )
    )
  );
}

export async function auditView(root) {
  mount(root, spinner("Loading the audit trail"));
  try {
    const page = await api.get("/audit?limit=100");
    mount(
      root,
      panel(
        "Audit trail",
        "Every write and every sign-in, successful or not.",
        page.data.length
          ? el(
              "div.table-wrap",
              el(
                "table.table",
                el("thead", el("tr", ["When", "Who", "Action", "Entity", "Record", "OK"].map((h) => el("th", h)))),
                el(
                  "tbody",
                  page.data.map((entry) =>
                    el(
                      `tr${entry.success ? "" : ".table__row--bad"}`,
                      el("td", displayValue(entry.created_at)),
                      el("td", entry.user_email || "—"),
                      el("td", el("code", entry.action)),
                      el("td", entry.entity_type || "—"),
                      el("td", entry.entity_id ? el("code", String(entry.entity_id).slice(0, 8)) : "—"),
                      el("td", entry.success ? "✓" : "✗")
                    )
                  )
                )
              )
            )
          : empty("Nothing recorded yet")
      )
    );
  } catch (error) {
    mount(root, panel("Audit trail", "", empty("Not available", error.message)));
  }
}

export async function modelView(root) {
  mount(root, spinner("Loading the model"));
  // Through the client, not a bare fetch: the session is a bearer token the
  // client holds, so a direct fetch here would be the one unauthenticated
  // request in the application and would answer 401.
  const [model, source] = await Promise.all([
    api.get("/model"),
    api.get("/model/source").catch(() => ""),
  ]);

  mount(
    root,
    panel(
      "The model",
      "The EML this application was compiled from. It ships inside the app so the app can describe itself.",
      el(
        "div",
        statRow([
          ["Entities", model.entities.length],
          ["Relationships", model.relationships.length],
          ["Rules", model.rules.length],
          ["Processes", model.workflows.length + (model.sagas || []).length],
          ["Hooks", model.hooks.length],
          ["Access rules", model.rbac.operations.length + model.rbac.transitions.length],
        ]),
        model.rbac.operations.length || model.rbac.transitions.length
          ? el(
              "div",
              el("h2.section-title", "Access control"),
              el(
                "ul.plain-list",
                model.rbac.operations.map((rule) =>
                  el("li", el("code", `${rule.entity}.${rule.operation}`), ` restricted to ${rule.roles.join(" or ")}`)
                ),
                model.rbac.transitions.map((rule) =>
                  el("li", el("code", `${rule.entity}.${rule.transition}`), ` (transition) restricted to ${rule.roles.join(" or ")}`)
                )
              )
            )
          : null,
        el("h2.section-title", "Source"),
        el("pre.source", el("code", source || "— not shipped with this application —"))
      )
    )
  );
}

/** Every administrative screen has the same shape: a title, a lede, a body. */
function panel(title, subtitle, body) {
  if (subtitle) setHelp(subtitle);
  return el("section", el("h2.section-title", title), subtitle ? el("p.lede", subtitle) : null, body);
}

function statRow(entries) {
  return el(
    "div.stats",
    entries.map(([label, value]) => el("div.stat", el("span.stat__value", String(value)), el("span.stat__label", label)))
  );
}
