/**
 * The record panel — fields, controls and validation, all from the dictionary.
 *
 * It renders above the grid rather than replacing it, and its header carries
 * the field count and how many are required, exactly as the React application's
 * does. Each field wears a chip naming its type. That chip is not decoration:
 * in a dictionary-driven application the reason a control is a dropdown rather
 * than a text box lives in a table, and showing the reason next to the control
 * is what makes the dictionary legible from the screen it produced.
 *
 * Three things here are worth knowing.
 *
 * A field renders as a dropdown when its column carries a list reference, which
 * is what `%%enum` compiles to; the values come from `/sys/ref-list` rather than
 * from anything baked into this file, so adding a value to the model adds it to
 * the form.
 *
 * A rule refusal comes back as a 422 with the rule's own violations, and they
 * are shown attached to the record rather than as a generic error, because "the
 * server said no" and "the rule you wrote said no, and here it is" are different
 * messages to the person who wrote the rule.
 *
 * And the transitions panel offers only the moves the record's state machine
 * allows from where it actually is, marking the ones the caller's roles do not
 * permit. Offering a button the server will refuse is worse than offering none.
 */

import { el, mount, spinner, toast, displayValue } from "../dom.js";
import { api } from "../api.js";
import { setActions, childEntitiesOf } from "../main.js";

const referenceCache = new Map();
const lookupCache = new Map();

async function refList(referenceId) {
  if (!referenceCache.has(referenceId)) {
    referenceCache.set(referenceId, await api.get(`/sys/ref-list?referenceId=${referenceId}`));
  }
  return referenceCache.get(referenceId);
}

/**
 * The rows a Table Direct column can point at.
 *
 * `sys_column.ref_table_name` says which table; this asks the server for its
 * ids and labels. An empty table is a real answer, not a failure — the control
 * says so and disables itself rather than presenting a box for a uuid nobody
 * can be expected to type.
 */
async function lookupOptions(table) {
  if (!lookupCache.has(table)) {
    lookupCache.set(
      table,
      api.get(`/sys/lookup?table=${encodeURIComponent(table)}`).catch(() => ({ options: [] }))
    );
  }
  const result = await lookupCache.get(table);
  const options = result?.options ?? [];
  /* An empty table is the one answer worth asking again for: it is the state
     the user is about to change, by going and creating the record the lookup
     had none of. Caching it means they come back, find the same "No X records
     yet", and have no way to tell the form otherwise short of reloading. */
  if (options.length === 0) lookupCache.delete(table);
  return options;
}

/** `bus_purchase_order` -> `Purchase Order`, for a message about an empty table. */
function tableLabel(table) {
  return String(table)
    .replace(/^bus_/, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The controls a reference type asks the browser for.
 *
 * `color` (27) is deliberately absent: `<input type="color">` has no way to say
 * "no colour", so every optional colour column a user never touched would save
 * as black. It stays a text box until the form can offer a swatch that clears.
 */
const INPUT_BY_REFERENCE = { 24: "url", 29: "password", 30: "email", 31: "tel" };

/** The label shown on a field's type chip, and the class that colours it. */
function typeChip(attribute, field) {
  if (field.sys_reference_id >= 1000 || attribute.enumValues?.length) return ["List", "list"];
  if (attribute.refTable || /_id$/.test(attribute.columnName)) return ["Direct Lookup", "lookup"];
  switch (Number(field.sys_reference_id)) {
    case 24: return ["URL", "text"];
    case 27: return ["Colour", "text"];
    case 29: return ["Password", "text"];
    case 30: return ["Email", "text"];
    case 31: return ["Phone", "text"];
    default: break;
  }
  switch (attribute.type) {
    case "integer": return ["Integer", "number"];
    case "decimal": return ["Amount", "number"];
    case "boolean": return ["Yes/No", "bool"];
    case "date": return ["Date", "date"];
    case "datetime": return ["Date/Time", "date"];
    case "json": return ["JSON", "number"];
    case "text": return ["Long Text", "text"];
    default: return ["Text", "text"];
  }
}

export async function recordPanel(root, { entity, id, onClose, onSaved, navigate }) {
  const isNew = !id || id === "new";
  mount(root, el("div.record", el("div.record__body", spinner(isNew ? "Preparing the form" : "Loading the record"))));

  let fields;
  let record = {};
  try {
    fields = await api.get(`/bus/${entity.routeName}/fields/form`);
    if (!isNew) record = await api.get(`/bus/${entity.routeName}/${id}`);
  } catch (error) {
    mount(root, el("div.empty", el("h3", "Could not open this record"), el("p", error.message)));
    return;
  }

  const editable = fields.filter((field) => !["id", "version"].includes(field.column_name));
  const requiredCount = editable.filter((field) => field.is_mandatory).length;

  const inputs = new Map();
  const violationBox = el("div.violations", { hidden: true });

  const controls = await Promise.all(
    editable.map((field) => control(field, record, entity, inputs))
  );

  const grouped = new Map();
  for (const [field, node] of controls) {
    const group = field.group_name || "General";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(node);
  }

  const submit = async () => {
    violationBox.hidden = true;
    setActions({ ...currentActions, busy: true });

    const payload = {};
    for (const [column, input] of inputs) {
      payload[column] = input.type === "checkbox" ? input.checked : input.value;
    }

    try {
      const saved = isNew
        ? await api.post(`/bus/${entity.routeName}`, payload)
        : await api.put(`/bus/${entity.routeName}/${id}`, payload);
      toast(isNew ? `${entity.singularName} created` : "Saved", "success");
      /* This row may be what some other entity's lookup is missing, and its
         label may be what an existing option now reads as. Neither is worth a
         reload to discover. */
      lookupCache.clear();
      await onSaved(saved);
      if (isNew) navigate(`/entity/${entity.routeName}/${saved.id}`, { replace: true });
    } catch (error) {
      showProblem(violationBox, error);
    } finally {
      setActions({ ...currentActions, busy: false });
    }
  };

  const currentActions = {
    onSave: submit,
    saveLabel: isNew ? "Create" : "Save",
    onNew: () => navigate(`/entity/${entity.routeName}/new`),
    newLabel: entity.singularName,
  };
  setActions(currentActions);

  const saveButton = el(
    "button.btn.btn--primary",
    { type: "submit" },
    isNew ? "Create" : "Save changes"
  );

  const form = el(
    "form",
    {
      onsubmit: (event) => {
        event.preventDefault();
        submit();
      },
    },
    el(
      "div.record__meta",
      `${editable.length} field${editable.length === 1 ? "" : "s"}`,
      requiredCount ? el("span.record__required", `${requiredCount} required`) : null,
      el("button.btn.btn--primary.btn--small", { type: "submit" }, isNew ? "Create" : "Save")
    ),
    violationBox,
    el(
      "div.record__body",
      [...grouped.entries()].map(([group, nodes]) =>
        el(
          "section",
          el("h3.group__name", group),
          el("p.group__desc", `${group} information fields`),
          el("div.group__fields", nodes)
        )
      )
    ),
    el(
      "div.record__actions",
      isNew
        ? null
        : el(
            "button.btn.btn--danger",
            {
              type: "button",
              onclick: async () => {
                if (!confirm(`Delete this ${entity.singularName}?`)) return;
                try {
                  await api.delete(`/bus/${entity.routeName}/${id}`);
                  toast("Deleted", "success");
                  await onSaved(null);
                  onClose();
                } catch (error) {
                  showProblem(violationBox, error);
                }
              },
            },
            "Delete"
          ),
      el("button.btn", { type: "button", onclick: onClose }, "Cancel"),
      saveButton
    )
  );

  /*
   * The line items belonging to this record.
   *
   * Rendered under the form rather than as a separate screen, because that is
   * what `parent:` means: an invoice line is part of the invoice you are
   * looking at. Only for a saved record — a child of a parent with no id yet
   * has nothing to hang from, and offering the tab would be offering a list
   * that cannot exist.
   */
  const detailSlot = el("div");
  if (!isNew) void renderDetails(detailSlot, entity, id, navigate);

  /*
   * What has been done to this record, at the foot of it.
   *
   * The trail is written on every create, update and delete; showing it here
   * is what makes it answerable rather than archival — "who changed this, and
   * to what" is a question asked about a record you are looking at, not one
   * anybody goes to an admin screen to ask.
   */
  const auditSlot = el("div");
  const notesSlot = el("div");
  if (!isNew) {
    void renderNotes(notesSlot, entity, id);
    void renderAudit(auditSlot, entity, id);
  }

  mount(
    root,
    el(
      "div.record",
      el(
        "header.record__head",
        el("h2.record__title", isNew ? `New ${entity.singularName}` : recordTitle(record, editable, entity)),
        el("button.record__close", { title: "Close", "aria-label": "Close", onclick: onClose }, "✕")
      ),
      form,
      detailSlot,
      notesSlot,
      auditSlot
    ),
    isNew ? null : el("div.split", el("div"), el("aside.side", await sidePanels(entity, id, record, onSaved)))
  );
}

/**
 * Notes on a record: what a person wanted to say about it.
 *
 * Above the history rather than inside it, and deliberately so. The trail
 * records what the system observed and must not be editable; a note is
 * somebody's sentence, and belongs beside that account without becoming part
 * of it. Both are stamped with who and when, which is the only thing they
 * genuinely have in common.
 *
 * A note cannot be edited or removed once left. That is not an omission: a
 * note somebody can quietly rewrite is worth about as much as a conversation
 * nobody remembers.
 */
async function renderNotes(slot, entity, id) {
  const path = `/audit/notes/${entity.tableName}/${encodeURIComponent(id)}`;

  const listSlot = el("div.notes__list");
  const box = el("textarea.notes__input", {
    rows: 2,
    placeholder: `Add a note about this ${entity.singularName}…`,
    "aria-label": `Add a note about this ${entity.singularName}`,
    maxlength: 4000,
  });
  const addButton = el("button.btn.btn--primary.btn--small", { type: "button" }, "Add note");

  const when = (value) => {
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? String(value ?? "") : at.toLocaleString();
  };

  const paint = (entries) =>
    mount(
      listSlot,
      entries.length
        ? el(
            "ol.notes__items",
            entries.map((entry) =>
              el(
                "li.note",
                el(
                  "div.note__line",
                  el("span.note__who", entry.userEmail || "unknown"),
                  el("span.note__when", when(entry.at))
                ),
                /* textContent, not markup: a note is whatever somebody typed. */
                el("p.note__text", entry.note)
              )
            )
          )
        : el("p.notes__empty", "No notes yet.")
    );

  let entries;
  try {
    entries = (await api.get(path)).data ?? [];
  } catch {
    return; // No read access to the entity means no notes panel.
  }
  paint(entries);

  addButton.addEventListener("click", async () => {
    const note = box.value.trim();
    if (!note) return;
    addButton.disabled = true;
    try {
      const created = await api.post(path, { note });
      entries = [created, ...entries];
      box.value = "";
      paint(entries);
      toast("Note added", "success");
    } catch (error) {
      toast(error.message || "Could not add the note", "error");
    } finally {
      addButton.disabled = false;
    }
  });

  mount(
    slot,
    el(
      "section.notes",
      el("div.notes__head", el("h3.notes__title", "Notes")),
      el("div.notes__compose", box, addButton),
      listSlot
    )
  );
}

const AUDIT_LABEL = { CREATE: "Created", UPDATE: "Updated", DELETE: "Deleted" };

/**
 * This record's history: who changed it, when, and which columns moved.
 *
 * Fifty entries at most and newest first, because the question is nearly always
 * "what happened to it recently". Each update lists the columns that actually
 * changed — the server works that out by comparing before and after, so a save
 * that touched one field does not read as a rewrite of the whole record.
 *
 * A role that may not read the entity is refused the trail with it, and the
 * section simply does not appear: its absence is the access rules working.
 */
async function renderAudit(slot, entity, id) {
  let entries;
  try {
    const answer = await api.get(`/audit/record/${entity.tableName}/${encodeURIComponent(id)}`);
    entries = answer.data ?? [];
  } catch {
    return;
  }
  if (!entries.length) return;

  const when = (value) => {
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? String(value ?? "") : at.toLocaleString();
  };

  mount(
    slot,
    el(
      "section.audit",
      el(
        "div.audit__head",
        el("h3.audit__title", "History"),
        el("span.audit__count", `${entries.length} change${entries.length === 1 ? "" : "s"}`)
      ),
      el(
        "ol.audit__list",
        entries.map((entry) => {
          const changed = (entry.changedFields || []).filter(
            (column) => !["updated_at", "updated_by", "version"].includes(column)
          );
          return el(
            "li.audit__entry",
            { "data-action": entry.action, "data-failed": entry.success ? null : "true" },
            el(
              "div.audit__line",
              el("span.audit__action", AUDIT_LABEL[entry.action] ?? entry.action),
              el("span.audit__who", entry.userEmail || "unknown"),
              el("span.audit__when", when(entry.at))
            ),
            /* Which columns moved, and to what. The old value is worth the room
               only when there was one — a create has nothing to compare. */
            changed.length
              ? el(
                  "ul.audit__fields",
                  changed.slice(0, 8).map((column) =>
                    el(
                      "li.audit__field",
                      el("span.audit__col", column),
                      entry.before && entry.before[column] !== undefined
                        ? el("span.audit__from", String(entry.before[column] ?? "—"))
                        : null,
                      el("span.audit__arrow", "→"),
                      el(
                        "span.audit__to",
                        String((entry.after && entry.after[column]) ?? "—")
                      )
                    )
                  )
                )
              : null,
            entry.success ? null : el("p.audit__error", entry.error || "This attempt failed.")
          );
        })
      )
    )
  );
}

/**
 * The detail tabs: one per entity that named this one as its `parent:`.
 *
 * Each asks the server for exactly the rows whose link column holds this
 * record's id — the same equality filter the grid's column filters already use,
 * so no new endpoint and no new contract. A row opens the child in its own
 * window; the child has no dashboard card, but it is still a record with a form.
 */
async function renderDetails(slot, entity, id, navigate) {
  const children = childEntitiesOf(entity.name);
  if (!children.length) return;

  const sections = [];
  for (const child of children) {
    if (!child.parentLinkColumn) continue;
    try {
      const [fields, page] = await Promise.all([
        api.get(`/bus/${child.routeName}/fields/grid`),
        api.get(`/bus/${child.routeName}?${child.parentLinkColumn}=${encodeURIComponent(id)}&limit=100`),
      ]);
      const columns = fields.filter((field) => field.column_name !== child.parentLinkColumn);

      sections.push(
        el(
          "section.detail",
          el(
            "div.detail__head",
            el("h3.detail__title", child.displayName),
            el("span.detail__count", `${page.total} row${page.total === 1 ? "" : "s"}`)
          ),
          page.data.length
            ? el(
                "div.table-wrap",
                el(
                  "table.table",
                  el("thead", el("tr", columns.map((column) => el("th", column.name)))),
                  el(
                    "tbody",
                    page.data.map((row) =>
                      el(
                        "tr.table__row",
                        { onclick: () => navigate(`/entity/${child.routeName}/${row.id}`) },
                        columns.map((column) => {
                          const label = page.labels?.[column.column_name]?.[row[column.column_name]];
                          return el(
                            "td",
                            label === undefined
                              ? displayValue(row[column.column_name], column)
                              : el("span.cell--ref", { title: row[column.column_name] }, label)
                          );
                        })
                      )
                    )
                  )
                )
              )
            : el("p.detail__empty", `No ${child.displayName} on this ${entity.singularName} yet.`)
        )
      );
    } catch {
      // A child the signed-in role may not read is simply not shown. The 403 is
      // the access rules working, not a fault worth putting on screen.
    }
  }

  if (sections.length) mount(slot, ...sections);
}

async function sidePanels(entity, id, record, onSaved) {
  const panels = [];

  try {
    const workflow = await api.get(`/workflows/entity/${entity.routeName}/${id}/transitions`);
    if (workflow.workflow) {
      panels.push(
        el(
          "div.side__card",
          el("h3.side__title", "Process"),
          el("p.side__meta", `${workflow.workflow} — currently ${workflow.current ?? "unset"}`),
          workflow.transitions.length
            ? el(
                "div.side__transitions",
                workflow.transitions.map((transition) =>
                  el(
                    "button.btn",
                    {
                      disabled: !transition.permitted,
                      title: transition.permitted
                        ? `Move to ${transition.to}`
                        : `Requires ${transition.requiredRoles.join(" or ")}`,
                      onclick: async () => {
                        try {
                          await api.put(`/bus/${entity.routeName}/${id}`, {
                            [workflow.column]: transition.to,
                          });
                          toast(`Moved to ${transition.to}`, "success");
                          await onSaved(null);
                          window.location.reload();
                        } catch (error) {
                          toast(error.message, "error");
                        }
                      },
                    },
                    transition.trigger || `→ ${transition.to}`
                  )
                )
              )
            : el("p.side__empty", "No transitions available from here.")
        )
      );
    }
  } catch {
    // A model with no workflows simply has no panel.
  }

  panels.push(
    el(
      "div.side__card",
      el("h3.side__title", "Record"),
      el(
        "dl.side__list",
        el("dt", "Created"), el("dd", displayValue(record.created_at)),
        el("dt", "Updated"), el("dd", displayValue(record.updated_at)),
        el("dt", "Version"), el("dd", displayValue(record.version)),
        el("dt", "Id"), el("dd", String(record.id ?? "—").slice(0, 8))
      )
    )
  );

  return panels;
}

async function control(field, record, entity, inputs) {
  const attribute = entity.attributes.find((item) => item.columnName === field.column_name) || {};
  const value = record[field.column_name];
  const id = `field-${field.column_name}`;
  const [chipLabel, chipKind] = typeChip(attribute, field);
  let input;

  const values = attribute.enumValues?.length
    ? attribute.enumValues.map((item) => ({ value: item, name: title(item) }))
    : field.sys_reference_id >= 1000
      ? (await refList(field.sys_reference_id)).map((row) => ({ value: row.value, name: row.name }))
      : null;

  if (values) {
    input = el(
      "select.field__input",
      { id, name: field.column_name },
      el("option", { value: "" }, field.is_mandatory ? `Select ${field.name}...` : "—"),
      values.map((option) =>
        el("option", { value: option.value, selected: String(value ?? "") === option.value }, option.name)
      )
    );
  } else if (field.ref_table_name) {
    /* A Table Direct column. Until this existed the field fell through to the
       plain-text branch below, so a reference rendered as an empty box that
       said "Direct Lookup" on its chip and accepted anything typed into it. */
    const options = await lookupOptions(field.ref_table_name);
    const current = value == null ? "" : String(value);
    const known = options.some((option) => String(option.id) === current);

    if (options.length === 0) {
      input = el(
        "select.field__input",
        { id, name: field.column_name, disabled: true },
        el("option", { value: "" }, `No ${tableLabel(field.ref_table_name)} records yet`)
      );
    } else {
      input = el(
        "select.field__input",
        { id, name: field.column_name },
        el("option", { value: "" }, field.is_mandatory ? `Select ${field.name}...` : "—"),
        /* A value the list does not contain — an older row, or one beyond the
           page — is kept as its own option, so opening a record and saving it
           cannot quietly drop the reference. */
        !known && current
          ? [el("option", { value: current, selected: true }, `${current} (not in the list)`)]
          : [],
        options.map((option) =>
          el(
            "option",
            { value: String(option.id), selected: String(option.id) === current },
            option.label == null || option.label === "" ? String(option.id) : String(option.label)
          )
        )
      );
    }
  } else if (attribute.type === "boolean") {
    input = el("input.field__checkbox", { id, type: "checkbox", checked: value === true });
  } else if (attribute.type === "text") {
    input = el("textarea.field__input.field__input--area", { id, rows: 4 }, value ?? "");
  } else if (INPUT_BY_REFERENCE[Number(field.sys_reference_id)]) {
    /* The dictionary knows this column is an address, a number to ring, a link
       or a secret — `email`, `phone`, `url` and `password` in the model. Every
       one of them is a `string` by the time it reaches SQL, so the reference is
       the only thing left that can ask the browser for the right keyboard on a
       phone and the right masking on a password. */
    input = el("input.field__input", {
      id,
      type: INPUT_BY_REFERENCE[Number(field.sys_reference_id)],
      value: value == null ? "" : String(value),
      maxlength: attribute.maxLength || null,
      required: field.is_mandatory || null,
      autocomplete: Number(field.sys_reference_id) === 29 ? "new-password" : null,
    });
  } else {
    input = el("input.field__input", {
      id,
      type:
        attribute.type === "integer" || attribute.type === "decimal"
          ? "number"
          : attribute.type === "date"
            ? "date"
            : attribute.type === "datetime"
              ? "datetime-local"
              : "text",
      step: attribute.type === "decimal" ? "any" : null,
      value: normalizeForInput(value, attribute.type),
      maxlength: attribute.maxLength || null,
      required: field.is_mandatory || null,
    });
  }

  if (field.is_read_only || (record.id && field.is_updateable === false)) input.disabled = true;
  inputs.set(field.column_name, input);

  return [
    field,
    el(
      `div.field${attribute.type === "text" ? ".field--wide" : ""}`,
      el(
        "div.field__head",
        el("label.field__label", { for: id }, field.name),
        field.is_mandatory ? el("span.field__required", { title: "Required" }, "*") : null,
        el(`span.chip.chip--${chipKind}`, chipLabel),
        el(
          "button.field__help",
          {
            type: "button",
            title: `${field.column_name} — ${attribute.type ?? "text"}${
              attribute.maxLength ? `, up to ${attribute.maxLength} characters` : ""
            }`,
          },
          "?"
        )
      ),
      input,
      field.description ? el("p.field__note", field.description) : null
    ),
  ];
}

function normalizeForInput(value, type) {
  if (value == null) return "";
  if (type === "date") return String(value).slice(0, 10);
  if (type === "datetime") return String(value).slice(0, 16);
  return String(value);
}

function showProblem(box, error) {
  const items = error.violations?.length
    ? error.violations.map((violation) =>
        el("li", el("strong", violation.ruleId || "Rule"), ` — ${violation.message}`)
      )
    : error.detail?.length
      ? error.detail.map((line) => el("li", typeof line === "string" ? line : line.message))
      : [el("li", error.message)];

  mount(
    box,
    el("h4.violations__title", error.status === 422 ? "A business rule refused this" : "This could not be saved"),
    el("ul.violations__list", items)
  );
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function recordTitle(record, fields, entity) {
  const identifier = fields.find((field) =>
    ["name", "title", "code", "reference", "first_name"].includes(field.column_name)
  );
  return identifier && record[identifier.column_name]
    ? String(record[identifier.column_name])
    : entity.singularName;
}

const title = (value) =>
  String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
