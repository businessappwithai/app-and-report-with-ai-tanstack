/**
 * The database entity viewer.
 *
 * Draws the `erDiagram` half of a model: one box per entity, every column with
 * the type the generator resolved it to, the key modifiers, the enum it is
 * bound to and the help text that becomes its label in the generated
 * application -- and between the boxes the relationships, in crow's foot
 * notation, because the glyph pair is the cardinality and drawing a plain arrow
 * throws away the half of it that decides where the foreign key lands.
 *
 * Everything drawn here was read by `eml-model.js`, which is this repository's
 * own parser. The viewer decides how a column looks, never what it is.
 */

import { Canvas, el, svg } from "./canvas.js";

/** How the parser's canonical types read on a column row. */
const TYPE_LABEL = {
  string: "string",
  text: "text",
  integer: "integer",
  decimal: "decimal",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  json: "json",
};

/**
 * The crow's foot glyphs, per cardinality and per end.
 *
 * `oneToMany` puts the many end on the target, `manyToOne` on the source, and
 * `manyToMany` on both -- which is the whole reason the viewer keeps the
 * direction rather than drawing an undirected line: the foreign key lives on
 * the many side, and a reader working out which table carries the column reads
 * it off this notation.
 */
const CROWS_FOOT = {
  oneToOne: { source: "one", target: "one" },
  oneToMany: { source: "one", target: "many" },
  manyToOne: { source: "many", target: "one" },
  manyToMany: { source: "many", target: "many" },
};

const CARDINALITY_LABEL = {
  oneToOne: "1 : 1",
  oneToMany: "1 : n",
  manyToOne: "n : 1",
  manyToMany: "n : n",
};

/** Colour a category consistently, so the same group reads alike everywhere. */
function categoryHue(name) {
  let hash = 0;
  for (let index = 0; index < name.length; index++) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return hash;
}

function badge(text, className, title) {
  const node = el("span", "awv-badge " + className, text);
  if (title) node.title = title;
  return node;
}

/**
 * One column row: name, badges, type, and the enum or help underneath.
 *
 * Help text is drawn only on an opened box. Seventeen entities with a sentence
 * under every column is a diagram no zoom level makes readable -- and the
 * overview's question is *what columns are there*, not what each one means.
 * Double-clicking a box asks the second question.
 */
function fieldRow(attribute, entity, expanded) {
  const row = el("div", "awv-field");
  if (attribute.name === entity.primaryKey) row.classList.add("is-key");

  const line = el("div", "awv-field-line");
  line.append(el("span", "awv-field-name", attribute.name));

  const badges = el("span", "awv-field-badges");
  if (attribute.name === entity.primaryKey) {
    badges.append(badge("PK", "is-pk", "Primary key"));
  } else if (attribute.isForeignKey) {
    badges.append(badge("FK", "is-fk", "Foreign key -- rendered as a lookup, not a text box"));
  }
  if (attribute.unique && attribute.name !== entity.primaryKey) {
    badges.append(badge("UK", "is-uk", "Unique"));
  }
  if (attribute.required) badges.append(badge("required", "is-required", "Must be filled in"));
  if (badges.childElementCount) line.append(badges);

  const type = attribute.semanticType || TYPE_LABEL[attribute.type] || attribute.type;
  const typeNode = el(
    "span",
    "awv-field-type",
    type + (attribute.maxLength ? "(" + attribute.maxLength + ")" : "")
  );
  if (attribute.semanticType) {
    typeNode.classList.add("is-semantic");
    typeNode.title = "Declared as " + attribute.semanticType + ", stored as " + attribute.type;
  }
  line.append(typeNode);
  row.append(line);

  if (attribute.enumRef) {
    /* Collapsed, the enum's *name* is what matters: this column is a dropdown
       rather than a text box. Its values are the opened box's business, for the
       same reason the help text is -- a state machine's seven values under
       every status column is what made the overview unreadable. */
    const values = el("div", "awv-field-enum");
    const name = el("span", "awv-field-enum-name", attribute.enumRef);
    name.title = (attribute.enumValues || []).join(", ");
    values.append(name);
    if (expanded) {
      for (const value of attribute.enumValues || []) {
        values.append(el("span", "awv-enum-value", value));
      }
    } else {
      values.append(
        el("span", "awv-field-enum-count", (attribute.enumValues || []).length + " values")
      );
    }
    row.append(values);
  }

  if (attribute.description) {
    if (expanded) row.append(el("p", "awv-field-help", attribute.description));
  } else {
    row.classList.add("has-no-help");
  }

  return row;
}

/** One entity box. Opened, it also carries the prose and every column. */
function entityCard(entity, options) {
  const expanded = Boolean(options && options.expanded);
  const card = el("article", "awv-entity");
  if (entity.category) {
    card.style.setProperty("--awv-entity-hue", String(categoryHue(entity.category)));
    card.classList.add("has-category");
  }
  if (entity.parentEntity) card.classList.add("is-child");

  const header = el("header", "awv-entity-head");
  header.append(el("h3", "awv-entity-name", entity.name));
  header.append(el("code", "awv-entity-table", entity.tableName));
  card.append(header);

  const chips = el("div", "awv-entity-chips");
  if (entity.category)
    chips.append(badge(entity.category, "is-category", "Declared by %%category"));
  if (entity.parentEntity) {
    chips.append(
      badge(
        "tab of " + entity.parentEntity,
        "is-parent",
        "%%entity " +
          entity.name +
          " parent: " +
          entity.parentEntity +
          " -- a line item, shown inside its parent rather than as a window of its own"
      )
    );
  }
  if (entity.readableBy.length) {
    chips.append(
      badge(
        entity.readableBy.length + " role" + (entity.readableBy.length === 1 ? "" : "s"),
        "is-roles",
        "Readable by " + entity.readableBy.join(", ")
      )
    );
  } else {
    chips.append(
      badge("all roles", "is-open", "No %%rbac read rule -- every signed-in user sees this")
    );
  }
  if (chips.childElementCount) card.append(chips);

  if (entity.description && expanded) {
    card.append(el("p", "awv-entity-help", entity.description));
  }

  const fields = el("div", "awv-fields");
  const shown = expanded ? entity.attributes : entity.attributes.slice(0, 10);
  for (const attribute of shown) fields.append(fieldRow(attribute, entity, expanded));
  card.append(fields);

  if (shown.length < entity.attributes.length) {
    card.append(
      el(
        "p",
        "awv-entity-more",
        "+" + (entity.attributes.length - shown.length) + " more columns -- click to open"
      )
    );
  }

  if (entity.indexes && entity.indexes.length) {
    const indexes = el("div", "awv-entity-indexes");
    for (const index of entity.indexes) {
      indexes.append(
        badge(
          (index.unique ? "unique " : "") + index.columns.join(" + "),
          "is-index",
          "Declared by %%index"
        )
      );
    }
    card.append(indexes);
  }

  return card;
}

/**
 * Crow's foot ends, drawn onto the edge layer after the canvas has placed it.
 *
 * The canvas owns the curve; this only decorates its two ends, which is why it
 * runs off the boxes the canvas measured rather than computing a second layout.
 */
function decorateEnds(canvas, relationships) {
  for (const relationship of relationships) {
    const path = canvas.edgeLayer.querySelector(
      '[data-edge="' + relationship.id + '"] .awv-edge-line'
    );
    if (!path) continue;
    const length = path.getTotalLength();
    if (!length) continue;

    const feet = CROWS_FOOT[relationship.cardinality] || CROWS_FOOT.oneToMany;
    const group = path.parentNode;

    const draw = (at, kind, inward) => {
      const point = path.getPointAtLength(at);
      const ahead = path.getPointAtLength(Math.min(length, Math.max(0, at + inward * 14)));
      const angle = (Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180) / Math.PI;
      const foot = svg("g", {
        class: "awv-foot is-" + kind,
        transform: "translate(" + point.x + "," + point.y + ") rotate(" + angle + ")",
      });
      if (kind === "many") {
        foot.append(svg("path", { d: "M 0 0 L 12 -7 M 0 0 L 12 0 M 0 0 L 12 7" }));
      } else {
        foot.append(svg("path", { d: "M 9 -6 L 9 6" }));
      }
      group.append(foot);
    };

    // Inset from the very end so the glyph sits beside the box, not under the
    // arrowhead that marks the direction the relationship was declared in.
    draw(4, feet.source, 1);
    draw(Math.max(0, length - 16), feet.target, -1);
  }
}

export class ErdViewer {
  constructor(host, options) {
    this.host = host;
    this.onSelect = (options && options.onSelect) || null;
    this.expanded = new Set();
    this.canvas = new Canvas(host, {
      direction: "right",
      gapWithin: 44,
      gapBetween: 130,
      emptyMessage: "No entities yet. The ERD appears as soon as the model declares one.",
      onSelect: (id) => {
        if (this.onSelect) this.onSelect(id);
      },
    });
  }

  /** Draw a model. Called on every change, so it rebuilds rather than diffs. */
  render(model, filter) {
    this.model = model;
    const term = (filter || "").trim().toLowerCase();
    const entities = term
      ? model.entities.filter(
          (entity) =>
            entity.name.toLowerCase().includes(term) ||
            entity.tableName.includes(term) ||
            (entity.category || "").toLowerCase().includes(term) ||
            entity.attributes.some((attribute) => attribute.name.toLowerCase().includes(term))
        )
      : model.entities;

    const visible = new Set(entities.map((entity) => entity.name));

    const nodes = entities.map((entity) => ({
      id: entity.name,
      element: entityCard(entity, { expanded: this.expanded.has(entity.name) }),
      className: "awv-node-entity",
    }));

    const edges = model.relationships
      .filter(
        (relationship) =>
          visible.has(relationship.sourceEntity) && visible.has(relationship.targetEntity)
      )
      .map((relationship, index) => ({
        id: "r" + index,
        source: relationship.sourceEntity,
        target: relationship.targetEntity,
        label: relationship.name.replace(/_/g, " "),
        cardinality: relationship.cardinality,
        className: "is-relationship",
        markerVariant: "-muted",
      }));

    this.canvas.render(nodes, edges);

    // The canvas writes each edge's group; tag it so the crow's feet can find
    // the path they belong to without re-deriving the order.
    for (const edge of edges) {
      if (edge.group) edge.group.setAttribute("data-edge", edge.id);
    }
    decorateEnds(this.canvas, edges);

    // A second click on a selected entity opens it in full, which is how a box
    // with forty columns is read without every box being forty rows tall.
    for (const wrapper of this.canvas.nodeLayer.children) {
      wrapper.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        const name = wrapper.dataset.nodeId;
        if (this.expanded.has(name)) this.expanded.delete(name);
        else this.expanded.add(name);
        this.render(this.model, filter);
      });
    }
  }

  focus(name) {
    this.canvas.select(name);
    this.canvas.focus(name);
  }
}

/** The inspector panel's account of one entity. */
export function describeEntity(model, name) {
  const entity = model.entities.find((candidate) => candidate.name === name);
  if (!entity) return null;

  const links = model.relationships
    .filter(
      (relationship) => relationship.sourceEntity === name || relationship.targetEntity === name
    )
    .map((relationship) => ({
      other:
        relationship.sourceEntity === name ? relationship.targetEntity : relationship.sourceEntity,
      outgoing: relationship.sourceEntity === name,
      name: relationship.name.replace(/_/g, " "),
      cardinality: CARDINALITY_LABEL[relationship.cardinality] || relationship.cardinality,
      foreignKey: relationship.foreignKey,
    }));

  return {
    entity,
    links,
    rules: model.rules.filter((rule) => rule.entity === name),
    hooks: model.hooks.filter((hook) => hook.entity === name),
    workflows: model.workflows.filter((workflow) => workflow.entity === name),
    sagas: model.sagas.filter((saga) => saga.entity === name),
    access: model.rbac.operations.filter((rule) => rule.entity === name),
  };
}
