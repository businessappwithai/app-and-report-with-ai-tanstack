/**
 * The dashboard — entities grouped by the categories the model declared.
 *
 * The arrangement mirrors the React application's: a coloured monospace heading
 * per category with its count, the category's own description underneath, then
 * a grid of cards reading "Manage X records". The Application Dictionary is the
 * last group, listed like any other, because from the reader's point of view it
 * is another set of windows.
 *
 * Record counts come from one endpoint rather than one request per entity — a
 * model with forty entities would otherwise open with forty round trips through
 * the Service Worker before showing anything.
 */

import { el, mount, spinner, toast } from "../dom.js";
import { api } from "../api.js";
import { setHelp } from "../main.js";

/** The administrative windows every generated application has. */
const DICTIONARY = [
  ["Audit Log", "audit", "Every write and sign-in", "▤"],
  ["Business Rules", "rules", "What the model decides", "◇"],
  ["Processes", "processes", "State machines and sagas", "⇄"],
  ["Table and Column", "dictionary", "The Application Dictionary", "▦"],
  ["The Model", "model", "The EML this was built from", "◈"],
];

export async function dashboardView(root, { entities, navigate, project, user }) {
  mount(root, spinner("Loading"));
  setHelp(
    "Each card opens a window onto one entity. What the window shows — which columns, " +
      "in what order, under what labels — comes from the Application Dictionary, so it can be " +
      "changed without regenerating the application."
  );

  const [summary, health] = await Promise.all([
    api.get("/sys/model-summary"),
    api.get("/health").catch(() => null),
  ]);

  const byCategory = new Map();
  for (const entity of entities) {
    const key = entity.category || "General";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(entity);
  }

  const descriptions = new Map(
    (summary.model?.categories ?? []).map((category) => [category.name, category.description])
  );

  mount(
    root,
    el(
      "div",

      /*
       * The manual, above everything else on the dashboard.
       *
       * Generation writes `manual.html` beside this application — every entity,
       * every field, the processes and the decisions, out of the same model the
       * screens below are drawn from. It opens in a new tab rather than as a
       * screen of its own: the application runs inside an iframe on the guide,
       * where a full-width document has nowhere to go, and a reader wants the
       * manual open *beside* the screen it describes rather than instead of it.
       */
      manualBanner(project),

      /*
       * A role that may read nothing gets told so.
       *
       * `%%rbac … .read` decides what a role sees, and the seeded `User`
       * account holds no functional role at all — deliberately, because an
       * account that can reach nothing is what demonstrates that a restriction
       * restricts. Rendered as bare emptiness that reads as a broken build, so
       * it says which of the two it is.
       */
      entities.length === 0
        ? el(
            "section.category",
            el("div.category__head", el("span.category__name", "Nothing to show")),
            el(
              "p.category__desc",
              `This account holds no role that may read any of this application's entities. ` +
                `That is what the model says rather than a fault: %%rbac grants read access by ` +
                `role, and this one has none. Sign out and pick a role account to see the ` +
                `application it was given.`
            )
          )
        : null,

      [...byCategory.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, group]) =>
          el(
            "section.category",
            el(
              "div.category__head",
              el("span.category__name", category),
              el("span.category__count", `(${group.length})`)
            ),
            el("p.category__desc", descriptions.get(category) || `${group.length} entities in this group`),
            el(
              "div.cards",
              group.map((entity) =>
                el(
                  "button.card",
                  { onclick: () => navigate(`/entity/${entity.routeName}`) },
                  el(
                    "div.card__top",
                    el("span.card__icon", "▤"),
                    el("span.card__name", entity.displayName)
                  ),
                  el("span.card__arrow", "→"),
                  el(
                    "p.card__sub",
                    `Manage ${entity.displayName} records · `,
                    el("span.card__count", `${summary.records[entity.name] ?? 0}`)
                  )
                )
              )
            )
          )
        ),

      el(
        "section.category",
        el(
          "div.category__head",
          el("span.category__name", "Application Dictionary"),
          el("span.category__count", `(${DICTIONARY.length})`)
        ),
        el(
          "p.category__desc",
          "The metadata every screen above is drawn from, and the record of what the application did"
        ),
        el(
          "div.cards",
          DICTIONARY.map(([name, route, description, icon]) =>
            el(
              "button.card",
              { onclick: () => navigate(`/${route}`) },
              el("div.card__top", el("span.card__icon", icon), el("span.card__name", name)),
              el("span.card__arrow", "→"),
              el("p.card__sub", description)
            )
          )
        )
      ),

      /*
       * Start over without regenerating.
       *
       * A generated application arrives with sample rows so that it can be
       * looked at, and the reader who has finished looking wants their own data
       * in it. Without this that meant deleting ten rows per entity by hand,
       * once per entity, or regenerating and losing everything else they had
       * done.
       *
       * Administrator-only, because it is the one action here that cannot be
       * undone, and two-step rather than a `confirm()` — this application runs
       * inside an iframe on the guide, where a modal dialog is not guaranteed
       * to appear at all.
       */
      user?.isAdmin ? purgeSection(project, navigate) : null,

      health
        ? el(
            "p.runtime-note",
            `${summary.counts.entities} entities · ${summary.counts.rules} rules · `,
            `${summary.counts.workflows + summary.counts.sagas} processes · `,
            `${Object.values(summary.records).reduce((total, value) => total + (Number(value) || 0), 0)} records`,
            el("span.runtime-note__db", `${health.runtime} — ${String(health.database).split(",")[0]}`)
          )
        : null
    )
  );
}

/** The link to the generated manual. */
function manualBanner(project) {
  return el(
    "section.manual",
    el(
      "div.manual__body",
      el("h2.manual__title", "Manual"),
      el(
        "p.manual__desc",
        `Every kind of record ${project?.name || "this application"} keeps, every field on it, ` +
          "the processes it runs and the decisions it makes \u2014 written from the same model " +
          "this application was generated from."
      )
    ),
    el(
      "div.manual__actions",
      el(
        "a.btn.btn--primary",
        {
          href: new URL("manual.html", location.href).href,
          target: "_blank",
          rel: "noopener",
        },
        "Open the manual"
      )
    )
  );
}

/** The purge control: one button, which becomes two before it does anything. */
function purgeSection(project, navigate) {
  const section = el("section.danger");

  const render = (armed) => {
    section.replaceChildren(
      el(
        "div.danger__body",
        el("h2.danger__title", "Start from an empty database"),
        el(
          "p.danger__desc",
          armed
            ? "Every business record is deleted — the sample rows and anything you have added. The model, the dictionary, the rules and the accounts are untouched. This cannot be undone."
            : `Deletes every record in ${project?.name || "this application"} and leaves the application itself in place.`
        ),
        armed
          ? el(
              "div.danger__actions",
              el(
                "button.btn.btn--danger",
                {
                  onclick: async (event) => {
                    const button = event.currentTarget;
                    button.disabled = true;
                    button.textContent = "Deleting…";
                    try {
                      const result = await api.post("/sys/purge-business-data", {});
                      toast(
                        `Deleted ${result.deleted} record(s) across ${result.tables} table(s)`,
                        "success"
                      );
                      // Straight back through the router: every count on this
                      // screen is now wrong, and a stale dashboard after a purge
                      // reads as the purge having failed.
                      navigate("/");
                    } catch (error) {
                      toast(error.message, "error");
                      render(false);
                    }
                  },
                },
                "Yes, delete every record"
              ),
              el("button.btn", { onclick: () => render(false) }, "Cancel")
            )
          : el(
              "div.danger__actions",
              el("button.btn", { onclick: () => render(true) }, "Delete all records")
            )
      )
    );
  };

  render(false);
  return section;
}
