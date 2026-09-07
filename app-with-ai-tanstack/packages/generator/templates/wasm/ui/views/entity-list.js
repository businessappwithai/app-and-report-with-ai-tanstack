/**
 * One entity's window: the record panel, then the grid.
 *
 * The two are one screen rather than two routes because that is how the React
 * application arranges them — you open a record and the list stays underneath,
 * so the row you came from is still in view. It also means the grid does not
 * have to be re-fetched when a save succeeds; the panel hands back the saved
 * record and the row is replaced in place.
 *
 * Which columns appear, in what order and under what label is a dictionary
 * query, so hiding a column is a row change rather than a regeneration. The
 * metadata is cached for the session — it is the same answer for every page of
 * every grid, and re-asking on each navigation showed as a flash of empty table.
 */

import { el, mount, spinner, empty, displayValue, toast } from "../dom.js";
import { CSV_EXPORT_LIMIT, csvFileName, downloadCsv, toCsv } from "../csv.js";
import { api, queryString } from "../api.js";
import { setActions, setHelp } from "../main.js";
import { recordPanel } from "./entity-form.js";

const gridCache = new Map();

async function gridFields(route) {
  if (!gridCache.has(route)) gridCache.set(route, await api.get(`/bus/${route}/fields/grid`));
  return gridCache.get(route);
}

/*
 * Two searches, and they are not the same search.
 *
 * The action bar's **Search** names the entity's own columns and asks the
 * server: it is how you find a record that is not on this page, and it is the
 * only one of the two that can. The bar above the grid filters the rows already
 * in the browser — instant, no request, and honest about its reach.
 *
 * They were briefly one thing, with the grid's bar posting `?search=` and the
 * action-bar button doing nothing but focus it. That reads as a simpler design
 * and is a worse one: every keystroke became a round trip, the field list
 * disappeared, and a filter that said "no matches" could not tell you whether
 * it meant on this page or in the table. The NestJS stack never lost the split,
 * which is the other reason to keep it — one model, one behaviour, either
 * stack.
 */

const FILTER_OPERATORS = {
  text: [
    { value: "contains", label: "contains" },
    { value: "equals", label: "equals" },
    { value: "startsWith", label: "starts with" },
    { value: "endsWith", label: "ends with" },
  ],
  number: [
    { value: "equals", label: "=" },
    { value: "gt", label: ">" },
    { value: "gte", label: "≥" },
    { value: "lt", label: "<" },
    { value: "lte", label: "≤" },
  ],
  date: [
    { value: "equals", label: "on" },
    { value: "gt", label: "after" },
    { value: "gte", label: "on or after" },
    { value: "lt", label: "before" },
    { value: "lte", label: "on or before" },
  ],
  boolean: [{ value: "equals", label: "is" }],
};

/** The same `sys_reference_id` split the React stack's filter builder uses. */
function filterCategory(referenceId) {
  if (referenceId === 11 || referenceId === 12) return "number";
  if (referenceId === 15 || referenceId === 16) return "date";
  if (referenceId === 20) return "boolean";
  return "text";
}

/** Does a loaded row match the grid bar's text? Every displayed cell, as text. */
function matchesRow(row, columns, needle, labels) {
  const term = needle.toLowerCase();
  return columns.some((column) => {
    const label = labels?.[column.column_name]?.[row[column.column_name]];
    const cell = label === undefined ? row[column.column_name] : label;
    return cell !== null && cell !== undefined && String(cell).toLowerCase().includes(term);
  });
}

export async function entityListView(root, { entity, recordId, navigate }) {
  const params = new URLSearchParams((window.location.hash.split("?")[1] ?? ""));
  const state = {
    page: 1,
    limit: 25,
    /** The grid bar: filters rows already loaded. Never sent anywhere. */
    filter: "",
    /** The action bar: `{column, operator, value}` rows, applied on the server. */
    searchRows: [],
    searchOpen: false,
    /** `?q=` still works as a free-text server search, for links into a list. */
    search: params.get("q") ?? "",
    sort: null,
    order: "desc",
  };

  setHelp(
    `${entity.displayName} is stored in ${entity.tableName}. The columns below, and the fields on ` +
      `the form, come from the Application Dictionary — change a row there and this screen changes.`
  );

  const panelSlot = el("div");
  const listSlot = el("div");

  /* The grid bar. Filters what is on screen, so it re-renders from the page
     already in hand rather than asking for another one. */
  const filterInput = el("input", {
    type: "search",
    placeholder: "Filter these records...",
    value: state.filter,
    "aria-label": `Filter the loaded ${entity.displayName} records`,
    oninput: debounce(() => {
      state.filter = filterInput.value.trim();
      paint();
    }, 120),
  });

  mount(root, panelSlot, listSlot);

  const openRecord = async (id) => {
    if (!id) {
      mount(panelSlot);
      setActions({ onNew: () => openRecord("new"), newLabel: entity.singularName, onSearch: toggleSearch });
      return;
    }
    await recordPanel(panelSlot, {
      entity,
      id,
      onClose: () => {
        navigate(`/entity/${entity.routeName}`);
      },
      onSaved: async () => {
        await renderList();
      },
      navigate,
    });
  };

  const toggleSearch = () => {
    state.searchOpen = !state.searchOpen;
    if (state.searchOpen && !state.searchRows.length) addSearchRow();
    paint();
  };

  /** The last answer from the server; the grid bar filters this, in place. */
  let loaded = null;

  function addSearchRow() {
    const first = (loaded?.fields ?? []).find((field) => field.column_name);
    if (!first) return;
    const category = filterCategory(first.sys_reference_id);
    state.searchRows.push({
      column: first.column_name,
      operator: FILTER_OPERATORS[category][0].value,
      value: "",
    });
  }

  /** `filter.<column>=<operator>:<value>`, the contract both stacks parse. */
  function searchParams() {
    const params = {};
    for (const row of state.searchRows) {
      if (row.column && row.operator && row.value !== "") {
        params[`filter.${row.column}`] = `${row.operator}:${row.value}`;
      }
    }
    return params;
  }

  async function renderList() {
    mount(listSlot, spinner(`Loading ${entity.displayName}`));
    try {
      const [fields, page] = await Promise.all([
        gridFields(entity.routeName),
        api.get(
          `/bus/${entity.routeName}${queryString({
            page: state.page,
            limit: state.limit,
            search: state.search,
            sort: state.sort,
            order: state.order,
            ...searchParams(),
          })}`
        ),
      ]);
      loaded = { fields, page };
      paint();
    } catch (error) {
      mount(listSlot, empty("Could not load these records", error.message));
      if (error.status !== 403) toast(error.message, "error");
    }
  }

  /**
   * Download the list as CSV.
   *
   * The rows are fetched rather than read off the screen: `page.data` holds one
   * page and the reader asked for the list, so this asks for the first
   * CSV_EXPORT_LIMIT rows under the same search and filters the grid is
   * showing. Cells go through `displayValue` and the server's own `labels` map,
   * the two things the table itself renders with, so a date, a boolean and a
   * referenced record read in the file exactly as they read on screen.
   */
  async function exportCsv() {
    if (!loaded) return;
    const columns = loaded.fields.length
      ? loaded.fields
      : entity.attributes
          .slice(0, 6)
          .map((attribute) => ({ column_name: attribute.columnName, name: attribute.displayName }));
    try {
      const full = await api.get(
        `/bus/${entity.routeName}${queryString({
          page: 1,
          limit: CSV_EXPORT_LIMIT,
          search: state.search,
          sort: state.sort,
          order: state.order,
          ...searchParams(),
        })}`
      );

      const body = (full.data ?? []).map((row) =>
        columns.map((column) => {
          const value = row[column.column_name];
          const label = full.labels?.[column.column_name]?.[value];
          if (label !== undefined) return String(label);
          // An em dash is how the table draws an empty cell; a CSV says the
          // same thing with an empty field, and a literal "—" would import as
          // data.
          const shown = displayValue(value, column);
          return shown === "—" ? "" : shown;
        })
      );

      downloadCsv(
        csvFileName(entity.routeName),
        toCsv(
          columns.map((column) => column.name ?? column.column_name),
          body
        )
      );

      if ((full.total ?? 0) > body.length) {
        toast(
          `Exported ${body.length} of ${full.total} rows — a download holds at most ` +
            `${CSV_EXPORT_LIMIT}. Narrow the list to export the rest.`,
          "info"
        );
      }
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function paint() {
    if (!loaded) return;
    const { fields, page } = loaded;

    try {
      const columns = fields.length
        ? fields
        : entity.attributes
            .slice(0, 6)
            .map((attribute) => ({ column_name: attribute.columnName, name: attribute.displayName }));

      /* The grid bar's reach, stated plainly: it filters the rows on this page
         and nothing else. Saying "3 of 25 on this page" rather than "3 entries"
         is the difference between a filter you can trust and one that looks
         like it searched the table. */
      const rows = state.filter
        ? page.data.filter((row) => matchesRow(row, columns, state.filter, page.labels))
        : page.data;

      const bar = el(
        "div.listbar",
        el("div.listbar__search", filterInput),
        el(
          "button.btn.btn--ghost",
          {
            type: "button",
            onclick: exportCsv,
            disabled: page.total === 0,
            title: `Download this list as CSV (at most ${CSV_EXPORT_LIMIT} rows)`,
            "data-testid": "export-csv",
          },
          "CSV"
        ),
        el(
          "span.listbar__count",
          state.filter
            ? `${rows.length} of ${page.data.length} on this page`
            : page.total === 0
              ? "No entries"
              : `Showing ${(page.page - 1) * page.limit + 1} to ` +
                `${Math.min(page.page * page.limit, page.total)} of ${page.total} entries`
        )
      );

      const searching = Object.keys(searchParams()).length > 0 || !!state.search;

      if (!page.data.length) {
        mount(
          listSlot,
          searchPanel(),
          bar,
          empty(
            searching ? "Nothing matched that search" : `No ${entity.displayName} records yet`,
            searching
              ? "Clear the search to see every record."
              : `Use “New ${entity.singularName}” above to add the first one.`
          )
        );
        return;
      }

      if (!rows.length) {
        mount(
          listSlot,
          searchPanel(),
          bar,
          empty(
            "Nothing on this page matches",
            "This filters the records already loaded. Use Search above to look through the whole table."
          )
        );
        return;
      }

      mount(
        listSlot,
        searchPanel(),
        bar,
        el(
          "div.table-wrap",
          el(
            "table.table",
            el(
              "thead",
              el(
                "tr",
                columns.map((column) =>
                  el(
                    "th",
                    {
                      class: state.sort === column.column_name ? "is-sorted" : "",
                      title: `Sort by ${column.name}`,
                      onclick: () => {
                        state.order =
                          state.sort === column.column_name && state.order === "asc" ? "desc" : "asc";
                        state.sort = column.column_name;
                        renderList();
                      },
                    },
                    column.name,
                    el("span.sort", state.sort === column.column_name ? (state.order === "asc" ? "↑" : "↓") : "⇅")
                  )
                )
              )
            ),
            el(
              "tbody",
              rows.map((row) =>
                el(
                  "tr.table__row",
                  { onclick: () => navigate(`/entity/${entity.routeName}/${row.id}`) },
                  columns.map((column) => {
                    /* A reference cell shows the parent record's name, resolved
                       by the server for the ids on this page. The uuid stays in
                       `row` — the click above navigates by it — but nobody has
                       to read it. */
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
        ),
        page.totalPages > 1 ? pager(page, state, renderList) : null
      );
    } catch (error) {
      mount(listSlot, empty("Could not load these records", error.message));
      if (error.status !== 403) toast(error.message, "error");
    }
  }

  /**
   * The action bar's Search: the entity's own columns, an operator each, and a
   * value — applied on the server, so it reaches records this page never had.
   *
   * Which columns are offered is the dictionary's answer, not this file's: a
   * column hidden from the grid is hidden from the search with it, the same way
   * the React stack filters on `is_displayed_grid`.
   */
  function searchPanel() {
    if (!state.searchOpen) return null;
    const fields = (loaded?.fields ?? []).filter((field) => field.column_name);
    if (!fields.length) {
      return el("div.searchpanel", el("p.searchpanel__hint", "This entity has no searchable columns."));
    }

    const rowEl = (row, index) => {
      const field = fields.find((candidate) => candidate.column_name === row.column) ?? fields[0];
      const category = filterCategory(field.sys_reference_id);

      const columnSelect = el(
        "select.searchpanel__col",
        {
          "aria-label": "Column to search",
          onchange: () => {
            row.column = columnSelect.value;
            const next = fields.find((candidate) => candidate.column_name === row.column);
            row.operator = FILTER_OPERATORS[filterCategory(next?.sys_reference_id)][0].value;
            row.value = "";
            paint();
          },
        },
        fields.map((candidate) =>
          el("option", { value: candidate.column_name, selected: candidate.column_name === row.column }, candidate.name)
        )
      );

      const operatorSelect = el(
        "select.searchpanel__op",
        { "aria-label": "How to compare", onchange: () => { row.operator = operatorSelect.value; } },
        FILTER_OPERATORS[category].map((operator) =>
          el("option", { value: operator.value, selected: operator.value === row.operator }, operator.label)
        )
      );

      const valueInput = el("input.searchpanel__val", {
        type: category === "date" ? "date" : category === "number" ? "number" : "text",
        value: row.value,
        placeholder: "Value",
        "aria-label": `Value for ${field.name}`,
        oninput: () => { row.value = valueInput.value; },
        onkeydown: (event) => { if (event.key === "Enter") applySearch(); },
      });

      return el(
        "div.searchpanel__row",
        columnSelect,
        operatorSelect,
        valueInput,
        el(
          "button.btn.searchpanel__drop",
          { title: "Remove this condition", onclick: () => { state.searchRows.splice(index, 1); paint(); } },
          "✕"
        )
      );
    };

    return el(
      "div.searchpanel",
      el(
        "div.searchpanel__rows",
        state.searchRows.length
          ? state.searchRows.map(rowEl)
          : el("p.searchpanel__hint", "No conditions yet — add one to narrow the search.")
      ),
      el(
        "div.searchpanel__actions",
        el("button.btn", { onclick: () => { addSearchRow(); paint(); } }, "+ Add condition"),
        el("button.btn", { onclick: clearSearch }, "Clear"),
        el("button.btn.btn--primary", { onclick: applySearch }, "Search")
      )
    );
  }

  function applySearch() {
    state.page = 1;
    renderList();
  }

  function clearSearch() {
    state.searchRows = [];
    state.search = "";
    state.page = 1;
    renderList();
  }

  setActions({
    onNew: () => navigate(`/entity/${entity.routeName}/new`),
    newLabel: entity.singularName,
    onSearch: toggleSearch,
  });

  await Promise.all([openRecord(recordId), renderList()]);
}

function pager(page, state, render) {
  return el(
    "div.pager",
    el("span.pager__page", `Page ${page.page} of ${page.totalPages}`),
    el(
      "div.pager__controls",
      el(
        "button.btn",
        { disabled: page.page <= 1, onclick: () => { state.page -= 1; render(); } },
        "← Previous"
      ),
      el(
        "button.btn",
        { disabled: page.page >= page.totalPages, onclick: () => { state.page += 1; render(); } },
        "Next →"
      )
    )
  );
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
