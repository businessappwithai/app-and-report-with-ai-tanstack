/**
 * Graph layout for the viewers.
 *
 * Three pictures, one algorithm: the ERD is a graph of entity boxes, a decision
 * flow is a graph of step boxes, a state machine is a graph of status pills.
 * All three read as "what leads to what", so all three get the same layered
 * placement -- rank by longest path from the sources, order within a rank to
 * pull each node towards its neighbours, then space by measured size.
 *
 * Written here rather than pulled in because the site carries no bundler and
 * takes no third-party runtime: the design tool reaches for ELK, which is
 * hundreds of kilobytes of JavaScript for a job that is two hundred lines when
 * the graphs are this size. Nothing on this page is bigger than a few hundred
 * nodes.
 */

/**
 * Rank every node by the longest path reaching it.
 *
 * Longest path rather than breadth-first: a node with two incoming edges of
 * different lengths must sit after *both* of its sources, or the edge from the
 * longer branch points backwards and the picture reads as a cycle that is not
 * there. Genuine cycles -- a state machine that can return to `draft` -- are
 * broken at the first back edge found in a depth-first walk, which keeps the
 * ranks finite and leaves the returning edge drawn as what it is.
 */
function rankNodes(ids, edges) {
  const outgoing = new Map(ids.map((id) => [id, []]));
  for (const edge of edges) {
    if (!outgoing.has(edge.source) || !outgoing.has(edge.target)) continue;
    if (edge.source === edge.target) continue;
    outgoing.get(edge.source).push(edge.target);
  }

  // Depth-first, marking the edges that close a cycle so the ranking below can
  // ignore them. `state` is 0 unvisited, 1 on the stack, 2 finished. Iterative
  // rather than recursive: a chain of two hundred entities is a stack overflow
  // in a browser and a diagram that never draws.
  const state = new Map(ids.map((id) => [id, 0]));
  const backEdges = new Set();
  for (const root of ids) {
    if (state.get(root) !== 0) continue;
    const stack = [{ id: root, next: 0 }];
    state.set(root, 1);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const children = outgoing.get(frame.id);
      if (frame.next >= children.length) {
        state.set(frame.id, 2);
        stack.pop();
        continue;
      }
      const child = children[frame.next++];
      const seen = state.get(child);
      if (seen === 1) backEdges.add(frame.id + " " + child);
      else if (seen === 0) {
        state.set(child, 1);
        stack.push({ id: child, next: 0 });
      }
    }
  }

  const forward = edges.filter(
    (edge) =>
      edge.source !== edge.target &&
      outgoing.has(edge.source) &&
      outgoing.has(edge.target) &&
      !backEdges.has(edge.source + " " + edge.target)
  );

  const incoming = new Map(ids.map((id) => [id, 0]));
  for (const edge of forward) incoming.set(edge.target, incoming.get(edge.target) + 1);

  const rank = new Map(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => incoming.get(id) === 0);
  const pending = new Map(incoming);

  const outEdges = new Map(ids.map((id) => [id, []]));
  for (const edge of forward) outEdges.get(edge.source).push(edge.target);

  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    for (const target of outEdges.get(id)) {
      rank.set(target, Math.max(rank.get(target), rank.get(id) + 1));
      pending.set(target, pending.get(target) - 1);
      if (pending.get(target) === 0) queue.push(target);
    }
  }

  // Anything the sweep could not reach sits in a cycle with no entry point.
  // Ranking it zero puts it on the first row rather than dropping it.
  return rank;
}

/**
 * Order the nodes within each rank so edges cross as little as possible.
 *
 * The barycentre heuristic: repeatedly move each node to the average position
 * of its neighbours, alternating down the ranks and back up. Four sweeps is
 * where the improvement flattens out on graphs this size, and an exact ordering
 * is NP-hard, so further passes buy nothing a reader would notice.
 */
function orderRanks(ranks, edges) {
  const positionOf = new Map();
  const index = (rank) => {
    rank.forEach((id, at) => {
      positionOf.set(id, at);
    });
  };
  for (const rank of ranks) index(rank);

  const neighbours = new Map();
  const link = (from, to) => {
    if (!neighbours.has(from)) neighbours.set(from, []);
    neighbours.get(from).push(to);
  };
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    link(edge.source, edge.target);
    link(edge.target, edge.source);
  }

  const sweep = (order) => {
    for (const rank of order) {
      const scored = rank.map((id, at) => {
        const linked = (neighbours.get(id) || [])
          .map((other) => positionOf.get(other))
          .filter((value) => value !== undefined);
        const barycentre = linked.length
          ? linked.reduce((total, value) => total + value, 0) / linked.length
          : at;
        return { id, barycentre, at };
      });
      scored.sort((left, right) => left.barycentre - right.barycentre || left.at - right.at);
      rank.length = 0;
      for (const entry of scored) rank.push(entry.id);
      index(rank);
    }
  };

  for (let pass = 0; pass < 2; pass++) {
    sweep(ranks);
    sweep([...ranks].reverse());
  }
}

/**
 * Place a graph.
 *
 * `sizes` maps a node id to `{ width, height }` -- measured, never assumed: an
 * entity box is as tall as it has columns, and laying out against a guessed
 * height is what makes a diagram overlap at exactly the entity worth reading.
 *
 * `direction` is `"down"` for a picture that reads top to bottom (a rule, a
 * saga) or `"right"` for one that reads left to right (a state machine, an ERD).
 */
export function layoutGraph(nodes, edges, options) {
  const settings = options || {};
  const direction = settings.direction === "down" ? "down" : "right";
  const gapWithin = settings.gapWithin === undefined ? 40 : settings.gapWithin;
  const gapBetween = settings.gapBetween === undefined ? 90 : settings.gapBetween;
  const sizes = settings.sizes || new Map();
  const sizeOf = (id) => sizes.get(id) || { width: 180, height: 60 };

  const ids = nodes.map((node) => (typeof node === "string" ? node : node.id));
  if (ids.length === 0) return { positions: new Map(), width: 0, height: 0 };

  const rank = rankNodes(ids, edges);
  let depth = 0;
  for (const id of ids) depth = Math.max(depth, rank.get(id) || 0);

  const ranks = [];
  for (let level = 0; level <= depth; level++) {
    ranks.push(ids.filter((id) => (rank.get(id) || 0) === level));
  }
  orderRanks(ranks, edges);

  /* Along the rank axis every node in a rank shares one coordinate, set by the
     thickest node in that rank; across it they are stacked in the order above.
     Each rank is then centred against the widest, so the picture has an axis
     rather than a ragged edge. */
  const positions = new Map();
  const acrossOf = (id) => (direction === "down" ? sizeOf(id).width : sizeOf(id).height);
  const alongOf = (id) => (direction === "down" ? sizeOf(id).height : sizeOf(id).width);

  const spans = ranks.map((rankIds) =>
    rankIds.reduce((total, id, index) => total + acrossOf(id) + (index ? gapWithin : 0), 0)
  );
  const widest = spans.reduce((most, span) => Math.max(most, span), 0);

  let along = 0;
  ranks.forEach((rankIds, level) => {
    let across = (widest - spans[level]) / 2;
    const thickness = rankIds.reduce((most, id) => Math.max(most, alongOf(id)), 0);
    for (const id of rankIds) {
      const size = sizeOf(id);
      positions.set(
        id,
        direction === "down"
          ? { x: across, y: along + (thickness - size.height) / 2 }
          : { x: along + (thickness - size.width) / 2, y: across }
      );
      across += acrossOf(id) + gapWithin;
    }
    along += thickness + gapBetween;
  });

  const total = Math.max(0, along - gapBetween);
  return {
    positions,
    width: direction === "down" ? widest : total,
    height: direction === "down" ? total : widest,
  };
}

/**
 * Where an edge leaves one box and enters another.
 *
 * Anchored on the side that faces the other box rather than always on the
 * bottom, so an edge between two boxes on the same rank -- which a state
 * machine has plenty of -- leaves sideways instead of looping under its own
 * source.
 */
export function anchorPoints(from, to) {
  const fromCentre = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toCentre = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const dx = toCentre.x - fromCentre.x;
  const dy = toCentre.y - fromCentre.y;

  if (Math.abs(dy) >= Math.abs(dx)) {
    const down = dy >= 0;
    return {
      source: { x: fromCentre.x, y: down ? from.y + from.height : from.y, side: down ? "s" : "n" },
      target: { x: toCentre.x, y: down ? to.y : to.y + to.height, side: down ? "n" : "s" },
    };
  }
  const right = dx >= 0;
  return {
    source: { x: right ? from.x + from.width : from.x, y: fromCentre.y, side: right ? "e" : "w" },
    target: { x: right ? to.x : to.x + to.width, y: toCentre.y, side: right ? "w" : "e" },
  };
}

const BOW = { n: -1, s: 1, e: 1, w: -1 };

/** A cubic bezier between two anchors, bowed along whichever axis they face. */
export function bezierPath(source, target) {
  const horizontal = source.side === "e" || source.side === "w";
  const distance = Math.max(
    36,
    Math.hypot(target.x - source.x, target.y - source.y) / (horizontal ? 2.2 : 2.6)
  );
  const c1 = horizontal
    ? { x: source.x + BOW[source.side] * distance, y: source.y }
    : { x: source.x, y: source.y + BOW[source.side] * distance };
  const c2 =
    target.side === "e" || target.side === "w"
      ? { x: target.x + BOW[target.side] * distance, y: target.y }
      : { x: target.x, y: target.y + BOW[target.side] * distance };
  return (
    "M " +
    source.x +
    " " +
    source.y +
    " C " +
    c1.x +
    " " +
    c1.y +
    ", " +
    c2.x +
    " " +
    c2.y +
    ", " +
    target.x +
    " " +
    target.y
  );
}

/**
 * Where the label of that curve belongs.
 *
 * The curve's own midpoint, evaluated at t = 0.5, not the midpoint of the
 * straight line between the ends: on a bowed edge those are a long way apart,
 * and a label sitting off its own curve attaches itself to whatever it happens
 * to land on.
 */
export function bezierMidpoint(source, target) {
  const horizontal = source.side === "e" || source.side === "w";
  const distance = Math.max(
    36,
    Math.hypot(target.x - source.x, target.y - source.y) / (horizontal ? 2.2 : 2.6)
  );
  const c1 = horizontal
    ? { x: source.x + BOW[source.side] * distance, y: source.y }
    : { x: source.x, y: source.y + BOW[source.side] * distance };
  const c2 =
    target.side === "e" || target.side === "w"
      ? { x: target.x + BOW[target.side] * distance, y: target.y }
      : { x: target.x, y: target.y + BOW[target.side] * distance };
  return {
    x: (source.x + 3 * c1.x + 3 * c2.x + target.x) / 8,
    y: (source.y + 3 * c1.y + 3 * c2.y + target.y) / 8,
  };
}

/** A self-loop, for the transition a state makes to itself. */
export function loopPath(box) {
  const x = box.x + box.width;
  const y = box.y + box.height / 2;
  const r = 30;
  return (
    "M " +
    x +
    " " +
    (y - 9) +
    " C " +
    (x + r) +
    " " +
    (y - r) +
    ", " +
    (x + r) +
    " " +
    (y + r) +
    ", " +
    x +
    " " +
    (y + 9)
  );
}

/** Where a self-loop's label belongs. */
export function loopLabelPoint(box) {
  return { x: box.x + box.width + 26, y: box.y + box.height / 2 };
}
