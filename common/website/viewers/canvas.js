/**
 * The canvas the three viewers are drawn on.
 *
 * One surface, three pictures. A viewer hands it nodes -- each an element it
 * built itself -- and edges between them; the canvas measures the nodes, asks
 * `layout.js` where they go, draws the edges underneath as SVG, and owns pan,
 * zoom, fit and selection. That split is what keeps the ERD, the workflow and
 * the rule viewers from each growing their own half-working version of the same
 * interaction.
 *
 * Nodes are HTML rather than SVG on purpose: an entity box is a table of
 * columns with badges and help text, and laying that out by hand in SVG means
 * measuring text. The browser is better at it, and it is what makes a field row
 * selectable and a help string wrap.
 */

import {
  anchorPoints,
  bezierMidpoint,
  bezierPath,
  layoutGraph,
  loopLabelPoint,
  loopPath,
} from "./layout.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** `document.createElement`, with the class and text most call sites want. */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/** The same, in the SVG namespace, where `createElement` produces a dead node. */
export function svg(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const key in attributes || {}) {
    if (attributes[key] === undefined || attributes[key] === null) continue;
    node.setAttribute(key, String(attributes[key]));
  }
  return node;
}

/** Zoom bounds. Below the floor a diagram is unreadable; above it, pointless. */
const MIN_SCALE = 0.12;
const MAX_SCALE = 2.4;

export class Canvas {
  /**
   * @param {HTMLElement} host element the canvas fills
   * @param {object} options `direction`, `gapWithin`, `gapBetween`, `onSelect`
   */
  constructor(host, options) {
    const settings = options || {};
    this.host = host;
    this.direction = settings.direction || "right";
    this.gapWithin = settings.gapWithin;
    this.gapBetween = settings.gapBetween;
    this.onSelect = settings.onSelect || null;
    this.emptyMessage = settings.emptyMessage || "Nothing to draw yet.";

    host.classList.add("awv-canvas");
    host.innerHTML = "";

    this.viewport = el("div", "awv-viewport");
    this.edgeLayer = svg("svg", { class: "awv-edges" });
    this.nodeLayer = el("div", "awv-nodes");
    this.viewport.append(this.edgeLayer, this.nodeLayer);

    this.empty = el("p", "awv-empty", this.emptyMessage);
    this.empty.hidden = true;

    host.append(this.viewport, this.empty, this.buildControls());

    this.transform = { x: 0, y: 0, scale: 1 };
    this.nodes = [];
    this.edges = [];
    this.boxes = new Map();
    this.selectedId = null;

    // Clicking the background clears the selection. Bound once, on the host, so
    // it survives every re-render; the node handlers stop propagation, so this
    // only ever sees a click that landed on nothing.
    host.addEventListener("click", (event) => {
      if (event.target.closest(".awv-control")) return;
      this.select(null);
    });

    this.bindPointer();

    /* A canvas built inside a hidden panel measures every node at zero. Rather
       than each caller remembering to re-layout when its tab is opened, the
       canvas watches its own box: nothing to something is the signal, and a
       window resize is answered by the same code. */
    if (typeof ResizeObserver === "function") {
      let last = "";
      const observer = new ResizeObserver(() => {
        const rect = this.host.getBoundingClientRect();
        const key = Math.round(rect.width) + "x" + Math.round(rect.height);
        if (key === last || rect.width === 0 || rect.height === 0) return;
        last = key;
        this.layout();
      });
      observer.observe(host);
    }
  }

  buildControls() {
    const bar = el("div", "awv-controls");
    const button = (label, title, action) => {
      const node = el("button", "awv-control", label);
      node.type = "button";
      node.title = title;
      node.setAttribute("aria-label", title);
      node.addEventListener("click", action);
      return node;
    };
    bar.append(
      button("+", "Zoom in", () => this.zoomBy(1.25)),
      button("−", "Zoom out", () => this.zoomBy(0.8)),
      button("▢", "Fit the whole diagram", () => this.fit())
    );
    return bar;
  }

  /**
   * Pan with a drag, zoom with the wheel.
   *
   * Pointer events rather than mouse events so a trackpad, a touchscreen and a
   * pen all work without three code paths. The wheel is intercepted only over
   * the canvas, and `passive: false` is what lets it be -- without it the page
   * scrolls behind the diagram while the diagram also zooms.
   */
  bindPointer() {
    let dragging = null;

    this.host.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".awv-control")) return;
      dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.host.setPointerCapture(event.pointerId);
      this.host.classList.add("is-panning");
    });

    this.host.addEventListener("pointermove", (event) => {
      if (!dragging || dragging.id !== event.pointerId) return;
      this.transform.x += event.clientX - dragging.x;
      this.transform.y += event.clientY - dragging.y;
      dragging.x = event.clientX;
      dragging.y = event.clientY;
      this.applyTransform();
    });

    const release = (event) => {
      if (!dragging || dragging.id !== event.pointerId) return;
      dragging = null;
      this.host.classList.remove("is-panning");
    };
    this.host.addEventListener("pointerup", release);
    this.host.addEventListener("pointercancel", release);

    this.host.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const rect = this.host.getBoundingClientRect();
        this.zoomBy(Math.exp(-event.deltaY * 0.0015), {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      },
      { passive: false }
    );
  }

  applyTransform() {
    this.viewport.style.transform =
      "translate(" +
      this.transform.x +
      "px, " +
      this.transform.y +
      "px) scale(" +
      this.transform.scale +
      ")";
  }

  /** Zoom about a point, so the diagram grows towards the cursor. */
  zoomBy(factor, about) {
    const rect = this.host.getBoundingClientRect();
    const origin = about || { x: rect.width / 2, y: rect.height / 2 };
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.transform.scale * factor));
    const ratio = next / this.transform.scale;
    this.transform.x = origin.x - (origin.x - this.transform.x) * ratio;
    this.transform.y = origin.y - (origin.y - this.transform.y) * ratio;
    this.transform.scale = next;
    this.applyTransform();
  }

  /**
   * Draw a graph.
   *
   * `nodes` are `{ id, element, className }`; `edges` are
   * `{ id, source, target, label, className, dashed }`. The element is built by
   * the caller because only the caller knows what an entity or a step looks
   * like -- this measures it and places it.
   */
  render(nodes, edges) {
    this.nodes = nodes;
    this.edges = edges || [];
    this.nodeLayer.innerHTML = "";
    this.edgeLayer.innerHTML = "";
    this.boxes = new Map();

    this.empty.hidden = nodes.length > 0;
    if (nodes.length === 0) {
      this.contentSize = { width: 0, height: 0 };
      return;
    }

    for (const node of nodes) {
      const wrapper = el("div", "awv-node " + (node.className || ""));
      wrapper.dataset.nodeId = node.id;
      wrapper.append(node.element);
      wrapper.addEventListener("click", (event) => {
        event.stopPropagation();
        this.select(node.id);
      });
      this.nodeLayer.append(wrapper);
    }

    this.layout();
  }

  /**
   * Measure the nodes, place them, and draw the edges between them.
   *
   * Separate from `render` because it has to run again whenever the answer
   * would change -- and the answer changes when the panel this canvas lives in
   * was hidden at the moment it was built. A hidden element measures zero in
   * every dimension, so every node came out one pixel square, the layout spaced
   * one-pixel boxes and the diagram arrived on screen as a cluster in the
   * corner. The `ResizeObserver` in the constructor is what catches that: the
   * panel becoming visible is a resize from nothing to something.
   */
  layout() {
    if (!this.nodes.length) return;

    const wrappers = new Map();
    for (const wrapper of this.nodeLayer.children) wrappers.set(wrapper.dataset.nodeId, wrapper);

    const sizes = new Map();
    for (const node of this.nodes) {
      const wrapper = wrappers.get(node.id);
      if (!wrapper) continue;
      sizes.set(node.id, {
        width: Math.max(1, Math.round(wrapper.offsetWidth)),
        height: Math.max(1, Math.round(wrapper.offsetHeight)),
      });
    }

    const laid = layoutGraph(this.nodes, this.edges, {
      direction: this.direction,
      gapWithin: this.gapWithin,
      gapBetween: this.gapBetween,
      sizes,
    });

    this.boxes = new Map();
    for (const node of this.nodes) {
      const position = laid.positions.get(node.id) || { x: 0, y: 0 };
      const size = sizes.get(node.id);
      const wrapper = wrappers.get(node.id);
      if (!wrapper || !size) continue;
      wrapper.style.transform = "translate(" + position.x + "px, " + position.y + "px)";
      this.boxes.set(node.id, {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      });
    }

    this.contentSize = { width: laid.width, height: laid.height };
    this.edgeLayer.innerHTML = "";
    this.drawEdges();
    if (this.onLayout) this.onLayout();
    this.fit();
  }

  drawEdges() {
    const defs = svg("defs");
    for (const variant of ["", "-muted", "-strong"]) {
      const marker = svg("marker", {
        id: "awv-arrow" + variant,
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerWidth: 6,
        markerHeight: 6,
        orient: "auto-start-reverse",
        class: "awv-marker" + variant,
      });
      marker.append(svg("path", { d: "M 0 0 L 10 5 L 0 10 z" }));
      defs.append(marker);
    }
    this.edgeLayer.append(defs);

    let minX = 0;
    let minY = 0;
    for (const edge of this.edges) {
      const from = this.boxes.get(edge.source);
      const to = this.boxes.get(edge.target);
      if (!from || !to) continue;

      const group = svg("g", { class: "awv-edge " + (edge.className || "") });
      // Kept on the edge rather than looked up by index later: an edge whose
      // endpoints are missing draws nothing, so the nth group is not the nth
      // edge, and highlighting by index lit up the wrong arrows.
      edge.group = group;
      if (edge.title) {
        const title = svg("title");
        title.textContent = edge.title;
        group.append(title);
      }
      let labelAt;

      if (edge.source === edge.target) {
        group.append(
          svg("path", {
            d: loopPath(from),
            class: "awv-edge-line",
            "marker-end": "url(#awv-arrow" + (edge.markerVariant || "") + ")",
          })
        );
        labelAt = loopLabelPoint(from);
      } else {
        const anchors = anchorPoints(from, to);
        group.append(
          svg("path", {
            d: bezierPath(anchors.source, anchors.target),
            class: "awv-edge-line" + (edge.dashed ? " is-dashed" : ""),
            "marker-end": "url(#awv-arrow" + (edge.markerVariant || "") + ")",
          })
        );
        labelAt = bezierMidpoint(anchors.source, anchors.target);
      }

      if (edge.label) {
        // Drawn as a rect behind the text rather than with a paint-order stroke:
        // Safari does not honour `paint-order` on text, and an unbacked label
        // over an edge is unreadable in exactly the dense diagrams that need it.
        const text = svg("text", {
          x: labelAt.x,
          y: labelAt.y,
          class: "awv-edge-label",
          "text-anchor": "middle",
          "dominant-baseline": "middle",
        });
        text.textContent = edge.label;
        const width = edge.label.length * 6.1 + 10;
        group.append(
          svg("rect", {
            x: labelAt.x - width / 2,
            y: labelAt.y - 9,
            width,
            height: 18,
            rx: 4,
            class: "awv-edge-label-bg",
          }),
          text
        );
        minX = Math.min(minX, labelAt.x - width / 2);
      }

      minY = Math.min(minY, labelAt.y - 9);
      this.edgeLayer.append(group);
    }

    // Self-loops and labels reach outside the laid-out box; the viewBox has to
    // cover them or they are clipped away at the edge of the diagram.
    const pad = 48;
    this.edgeLayer.setAttribute(
      "viewBox",
      minX -
        pad +
        " " +
        (minY - pad) +
        " " +
        (this.contentSize.width - minX + pad * 2) +
        " " +
        (this.contentSize.height - minY + pad * 2)
    );
    this.edgeLayer.style.left = minX - pad + "px";
    this.edgeLayer.style.top = minY - pad + "px";
    this.edgeLayer.style.width = this.contentSize.width - minX + pad * 2 + "px";
    this.edgeLayer.style.height = this.contentSize.height - minY + pad * 2 + "px";
  }

  /** Bring the whole diagram into view, at no more than natural size. */
  fit() {
    if (!this.contentSize || !this.nodes.length) return;
    const rect = this.host.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const pad = 48;
    const scale = Math.min(
      1,
      Math.max(
        MIN_SCALE,
        Math.min(
          (rect.width - pad) / Math.max(1, this.contentSize.width),
          (rect.height - pad) / Math.max(1, this.contentSize.height)
        )
      )
    );
    this.transform.scale = scale;
    this.transform.x = (rect.width - this.contentSize.width * scale) / 2;
    this.transform.y = (rect.height - this.contentSize.height * scale) / 2;
    this.applyTransform();
  }

  /** Select a node, or clear the selection with `null`. */
  select(id) {
    if (this.selectedId === id) return;
    this.selectedId = id;
    for (const wrapper of this.nodeLayer.children) {
      wrapper.classList.toggle("is-selected", wrapper.dataset.nodeId === id);
    }
    for (const edge of this.edges) {
      if (!edge.group) continue;
      edge.group.classList.toggle(
        "is-linked",
        Boolean(id) && (edge.source === id || edge.target === id)
      );
    }
    if (this.onSelect) this.onSelect(id);
  }

  /** Centre one node in the viewport, at the current zoom. */
  focus(id) {
    const box = this.boxes.get(id);
    if (!box) return;
    const rect = this.host.getBoundingClientRect();
    const scale = this.transform.scale;
    this.transform.x = rect.width / 2 - (box.x + box.width / 2) * scale;
    this.transform.y = rect.height / 2 - (box.y + box.height / 2) * scale;
    this.applyTransform();
  }
}
