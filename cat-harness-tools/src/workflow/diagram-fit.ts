/**
 * Is a BPMN diagram readable at 100%, without zooming? And is it tangled?
 *
 * Owner, 2026-10-31, on the content-change-review page: *"make the font a bit
 * bigger, the spacing a bit more compact so dont need to zoom as much"*, then
 * *"QA on too wide/too tall bpms?"*, then *"bpmn detangle skill including swap
 * lanes"*, *"add as QA and author check"*.
 *
 * ## The budget is arithmetic, not taste
 *
 * The renderer draws text at 16px in diagram units (bootstrap-tools
 * `TEXT_STYLE`). A page shows a diagram at most as wide as its band: about
 * 1200 CSS px once the nav rail is subtracted on a 1440px screen. A diagram
 * `W` units wide is shown at scale `min(1, 1200 / W)`, so its text reads at
 * `16 × 1200 / W` px. 1400 keeps it near 14px (owner: "font a bit bigger").
 * Height: about 760px of a 900px viewport is left once the page's header and
 * the figure toolbar are drawn; 900 keeps a diagram on about one screen. A taller
 * diagram still reads, but needs scrolling to see its decisions together.
 * Change {@link FIT_WIDTH} and `TEXT_STYLE` together.
 *
 * ## What is checked
 *
 * | criterion | from |
 * |---|---|
 * | `diagram-too-wide` · `diagram-too-tall` | the DI extent, against the budget above |
 * | `label-overlap` | two drawn labels intersect (e.g. "Satisfied with changes?" over "No") |
 * | `label-on-edge` | a label sits on a flow, its own included |
 * | `label-on-shape` | a label covers a task, event or gateway that is not its own |
 * | `label-on-lane-line` | a label is drawn across the line between two lanes, or a pool's top, bottom or right edge |
 * | `header-overflow` | a pool or lane name spills out of its 30-wide header strip |
 * | `text-overflow` | a task's name spills out of its box (16px text in a box drawn for 12px), or runs under its type icon or [+] marker |
 * | `edge-diagonal` | a flow runs at a slant (owner, 2026-10-31: *"straight angled arrows ugly"*) |
 * | `edge-crossing` | two flows cross |
 * | `shape-overlap` | two steps drawn on top of each other (a boundary event on its task, or a step inside its subprocess, does not count) |
 * | `edge-through-shape` | a flow is drawn through a task, event or gateway that is neither its source nor its target |
 * | `edge-through-own-end` | a flow starts inside the box it leaves or runs on inside the box it enters (waypoints laid for a box of another size) |
 * | `edge-detached` | a flow's first or last waypoint is more than 6 from its own shape |
 * | `edge-shared-port` | a flow ends on a shape at the point another flow leaves it, so the two read as one line passing through (owner, 2026-11-08: *"output and input arrows shouldn't be at same point"*) |
 * | `shape-outside-pool` | a step is drawn outside every pool of a diagram that has pools |
 * | `lane-order` | another order of the lanes makes the cross-lane flows shorter |
 *
 * Label positions come from where bpmn-js DREW them (`DrawnLayout`), because
 * a file with no `BPMNLabel` bounds leaves the placement to bpmn-js; without a
 * drawn layout, labels with DI bounds are checked and the rest are not.
 *
 * Text-level parsing on purpose, like `bpmn-render.ts`'s plane cut: rewriting
 * DI through a parse/serialise round trip risks the namespace prefixes.
 *
 * @module cat-harness-tools/src/workflow/diagram-fit
 */

/** The renderer's text size inside shapes (bootstrap-tools `TEXT_STYLE`). */
export const TEXT_PX = 16;
/** Widest a diagram may be drawn and still read at about 14px in a 1200px band. */
export const FIT_WIDTH = 1400;
/** Tallest a diagram may be drawn and still be seen whole on one screen. */
export const FIT_HEIGHT = 900;

export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Finding {
  where: string;
  detail: string;
}

/** The DI of one plane: shapes (with any label bounds), edges and lanes. */
export interface DiLayout {
  shapes: Map<string, Box & { label?: Box }>;
  edges: Map<string, { points: Pt[]; label?: Box }>;
  /** Lane id → bounds, in the order the DI lists them. */
  lanes: Map<string, Box>;
  /** Participant (pool) id → bounds. */
  pools: Map<string, Box>;
  /** Sequence/message flow id → source and target ids. */
  flows: Map<string, { source: string; target: string; name?: string }>;
  /** Element id → its name, for messages. */
  names: Map<string, string>;
  /** Element id → its BPMN element kind (userTask, callActivity, …). */
  kinds?: Map<string, string>;
}

/** Where the renderer drew the external labels and the flows (bootstrap-tools `DrawnLayout`). */
export interface DrawnLabels {
  labels: (Box & { id: string; text: string })[];
  edges?: { id: string; points: Pt[] }[];
  /** The text drawn inside each shape, keyed by shape id (bootstrap-tools `DrawnLayout.texts`). */
  texts?: (Box & { id: string })[];
  /** Pool and lane names as laid out in their 30-wide header strips (bootstrap-tools `DrawnLayout.headers`). */
  headers?: { id: string; width: number; height: number; room: number }[];
}

/** How far a label may be moved from where it is drawn when no place beside its element is clear. */
const REACH = 80;
/** How far from its own flow or shape a label moved that far may sit. */
const STAY = 24;
/** Height of one line of 16px label text as bpmn-js draws it. */
const LINE_PX = 19;

/** Width of the name strip bpmn-js draws down the left of a horizontal pool or lane. */
const HEADER = 30;

const num = (s: string | undefined): number => Number(s ?? "NaN");
const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/** A shape's or edge's DI body cut into its own part and its BPMNLabel, wherever in the body the label sits. */
const LABEL_RE = /<(?:\w+:)?BPMNLabel\b(?:[^>]*\/>|[\s\S]*?<\/(?:\w+:)?BPMNLabel>)/;
function splitLabel(body: string): [own: string, label: string] {
  const m = LABEL_RE.exec(body);
  return m ? [body.slice(0, m.index) + body.slice(m.index + m[0].length), m[0]] : [body, ""];
}

function boundsIn(body: string): Box | undefined {
  const b = /<(?:\w+:)?Bounds\b([^>]*)\/?>/.exec(body);
  if (!b) return undefined;
  const box = { x: num(attr(b[1]!, "x")), y: num(attr(b[1]!, "y")), width: num(attr(b[1]!, "width")), height: num(attr(b[1]!, "height")) };
  return Object.values(box).every(Number.isFinite) ? box : undefined;
}

/** The first diagram plane only: the one the renderer draws (`bpmn-render.ts`). */
function firstPlane(xml: string): string {
  const m = /<(?:\w+:)?BPMNPlane\b[\s\S]*?<\/(?:\w+:)?BPMNPlane>/.exec(xml);
  return m ? m[0] : "";
}

/** Read the DI and the flow/lane/pool facts the checks need. */
export function readDi(xml: string): DiLayout {
  const plane = firstPlane(xml);
  const out: DiLayout = { shapes: new Map(), edges: new Map(), lanes: new Map(), pools: new Map(), flows: new Map(), names: new Map() };
  const laneIds = new Set([...xml.matchAll(/<(?:\w+:)?lane\b[^>]*\sid="([^"]+)"/g)].map((m) => m[1]!));
  const poolIds = new Set([...xml.matchAll(/<(?:\w+:)?participant\b[^>]*\sid="([^"]+)"/g)].map((m) => m[1]!));
  for (const m of xml.matchAll(/<(?:\w+:)?(sequenceFlow|messageFlow)\b([^>]*)>/g)) {
    const id = attr(m[2]!, "id"), source = attr(m[2]!, "sourceRef"), target = attr(m[2]!, "targetRef");
    if (id && source && target) out.flows.set(id, { source, target, name: attr(m[2]!, "name") || undefined });
  }
  for (const m of xml.matchAll(/<(?:\w+:)?\w+\b[^>]*\sid="([^"]+)"[^>]*\sname="([^"]*)"/g)) out.names.set(m[1]!, m[2]!);
  out.kinds = new Map([...xml.matchAll(/<(?:\w+:)?(\w+)\b[^>]*\sid="([^"]+)"/g)].map((m) => [m[2]!, m[1]!] as const));
  for (const m of plane.matchAll(/<(?:\w+:)?BPMNShape\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?BPMNShape>/g)) {
    const id = attr(m[1]!, "bpmnElement");
    const [own, labelPart] = splitLabel(m[2]!);
    const b = boundsIn(own!);
    if (!id || !b) continue;
    const label = labelPart ? boundsIn(labelPart) : undefined;
    if (laneIds.has(id)) out.lanes.set(id, b);
    else if (poolIds.has(id)) out.pools.set(id, b);
    else out.shapes.set(id, label ? { ...b, label } : b);
  }
  for (const m of plane.matchAll(/<(?:\w+:)?BPMNEdge\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?BPMNEdge>/g)) {
    const id = attr(m[1]!, "bpmnElement");
    if (!id) continue;
    const [own, labelPart] = splitLabel(m[2]!);
    const points = [...own!.matchAll(/<(?:\w+:)?waypoint\b([^>]*)\/?>/g)].map((w) => ({ x: num(attr(w[1]!, "x")), y: num(attr(w[1]!, "y")) }));
    const label = labelPart ? boundsIn(labelPart) : undefined;
    out.edges.set(id, label ? { points, label } : { points });
  }
  return out;
}

/** The smallest box holding every shape, lane and pool. */
export function extent(di: DiLayout): Box | undefined {
  const all = [...di.shapes.values(), ...di.lanes.values(), ...di.pools.values()];
  if (all.length === 0) return undefined;
  const x0 = Math.min(...all.map((b) => b.x)), y0 = Math.min(...all.map((b) => b.y));
  const x1 = Math.max(...all.map((b) => b.x + b.width)), y1 = Math.max(...all.map((b) => b.y + b.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// ── Geometry ─────────────────────────────────────────────────────────────

/** Strict interior overlap, after shrinking each box by `inset` (anti-alias slack). */
export function boxesOverlap(a: Box, b: Box, inset = 1): boolean {
  return a.x + inset < b.x + b.width - inset && b.x + inset < a.x + a.width - inset &&
    a.y + inset < b.y + b.height - inset && b.y + inset < a.y + a.height - inset;
}

/** Does segment p→q pass through the interior of `b`? (Liang–Barsky clip.) */
export function segmentHitsBox(p: Pt, q: Pt, b: Box, inset = 1): boolean {
  const x0 = b.x + inset, x1 = b.x + b.width - inset, y0 = b.y + inset, y1 = b.y + b.height - inset;
  if (x0 >= x1 || y0 >= y1) return false;
  const dx = q.x - p.x, dy = q.y - p.y;
  let t0 = 0, t1 = 1;
  for (const [pk, qk] of [[-dx, p.x - x0], [dx, x1 - p.x], [-dy, p.y - y0], [dy, y1 - p.y]] as [number, number][]) {
    if (pk === 0) {
      if (qk < 0) return false;
    } else {
      const r = qk / pk;
      if (pk < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return t1 > t0;
}

const cross = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Do two segments cross at a single interior point? Touching ends and collinear runs do not count. */
export function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

const segments = (pts: Pt[]): [Pt, Pt][] => pts.slice(1).map((q, i) => [pts[i]!, q]);

/**
 * Every pair of flows that cross, as `[a, b]` ids. Two flows meeting at a
 * shared node are not a crossing (`segmentsCross` ignores touching ends), but
 * two flows of one node that cross on the way are: that is the tangle.
 */
export function crossings(di: DiLayout): [string, string][] {
  const ids = [...di.edges.keys()];
  const out: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const sa = segments(di.edges.get(ids[i]!)!.points), sb = segments(di.edges.get(ids[j]!)!.points);
      if (sa.some(([p, q]) => sb.some(([r, s]) => segmentsCross(p, q, r, s)))) out.push([ids[i]!, ids[j]!]);
    }
  }
  return out;
}

/** Does `outer` hold all of `inner`? (An expanded subprocess holds its own steps.) */
const holds = (outer: Box, inner: Box): boolean =>
  outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height;

/**
 * Every flow drawn through a shape it does not start or end at, as
 * `[flow, shape]`. A shape that holds the flow's source or target (the
 * expanded subprocess the flow runs inside) or overlaps it (the task a
 * boundary event sits on) is not counted.
 */
export function edgesThroughShapes(di: DiLayout): [string, string][] {
  const out: [string, string][] = [];
  for (const [eid, e] of di.edges) {
    const f = di.flows.get(eid);
    const src = f && di.shapes.get(f.source), tgt = f && di.shapes.get(f.target);
    for (const [sid, b] of di.shapes) {
      if (f && (sid === f.source || sid === f.target)) continue;
      if ([src, tgt].some((x) => x && (holds(b, x) || boxesOverlap(b, x, 0)))) continue;
      if (segments(e.points).some(([p, q]) => segmentHitsBox(p, q, b, 2))) out.push([eid, sid]);
    }
  }
  return out;
}

/** How far a flow's end may sit from its shape's box and still be drawn as touching it. */
const END_SLACK = 6;
/** How deep into its own source or target a flow may run (a gateway's or event's corner is inside its box). */
const OWN_INSET = 4;

const gap = (p: Pt, b: Box): number =>
  Math.hypot(Math.max(b.x - p.x, 0, p.x - (b.x + b.width)), Math.max(b.y - p.y, 0, p.y - (b.y + b.height)));

/**
 * Every flow drawn THROUGH its own source or target, as `[flow, shape]`: it
 * starts inside the box it leaves, or runs on inside the box it enters.
 * `edgesThroughShapes` skips a flow's own ends, so a flow whose waypoints
 * were laid for a smaller box (a task resized to `TASK_SIZE`, the flow left
 * where it was) was invisible to it: the arrow from "Commit, push, open the
 * PR" up through "Run the gates against the merge…" in `code-change-review`
 * (owner's screenshot, 2026-11-03, cat-harness#991).
 */
export function edgesThroughOwnEnds(di: DiLayout): [string, string][] {
  const out: [string, string][] = [];
  for (const [eid, e] of di.edges) {
    const f = di.flows.get(eid);
    if (!f) continue;
    for (const sid of new Set([f.source, f.target])) {
      const b = di.shapes.get(sid);
      if (!b) continue;
      if (segments(e.points).some(([p, q]) => segmentHitsBox(p, q, b, OWN_INSET))) out.push([eid, sid]);
    }
  }
  return out;
}

/** How close a flow's end and another flow's start may sit on one shape before they read as one point. */
export const PORT_SLACK = 2;

/**
 * Every shape where a flow ENDS at the point another flow STARTS, as
 * `[incoming flow, outgoing flow, shape]`. Two arrows meeting on one spot of
 * a box read as one line passing through it, and a reader cannot tell which
 * way the work goes. Flows that only arrive may share a point (a join), and
 * so may flows that only leave.
 */
export function sharedPorts(di: DiLayout): [string, string, string][] {
  const ins = new Map<string, [string, Pt][]>();
  const outs = new Map<string, [string, Pt][]>();
  for (const [eid, e] of di.edges) {
    const f = di.flows.get(eid);
    if (!f || e.points.length < 2) continue;
    if (!outs.has(f.source)) outs.set(f.source, []);
    outs.get(f.source)!.push([eid, e.points[0]!]);
    if (!ins.has(f.target)) ins.set(f.target, []);
    ins.get(f.target)!.push([eid, e.points[e.points.length - 1]!]);
  }
  const out: [string, string, string][] = [];
  for (const [sid, arriving] of ins) {
    for (const [a, p] of arriving) {
      for (const [b, r] of outs.get(sid) ?? []) {
        if (a !== b && Math.abs(p.x - r.x) <= PORT_SLACK && Math.abs(p.y - r.y) <= PORT_SLACK) out.push([a, b, sid]);
      }
    }
  }
  return out;
}

/**
 * Every flow whose first or last waypoint is not on its own shape, as
 * `[flow, shape]`: the arrow stops short of the box it enters, or starts in
 * empty space beside the box it leaves.
 */
export function detachedEdges(di: DiLayout): [string, string][] {
  const out: [string, string][] = [];
  for (const [eid, e] of di.edges) {
    const f = di.flows.get(eid);
    if (!f || e.points.length < 2) continue;
    const ends: [string, Pt][] = [[f.source, e.points[0]!], [f.target, e.points[e.points.length - 1]!]];
    for (const [sid, p] of ends) {
      const b = di.shapes.get(sid);
      if (b && gap(p, b) > END_SLACK) out.push([eid, sid]);
    }
  }
  return out;
}

/**
 * Every step drawn outside every pool, when the diagram has pools: an end
 * event left above the pool by a retrofit (`test-plan-execution`'s "Not yours
 * — left alone", cat-harness#991), or end events past the pool's right edge.
 */
/** Artefacts BPMN lets sit outside a pool: a data store, a data object, a note, a group. */
const OUTSIDE_OK = new Set(["dataStoreReference", "dataObjectReference", "textAnnotation", "group"]);

export function shapesOutsidePools(di: DiLayout): string[] {
  if (di.pools.size === 0) return [];
  const pools = [...di.pools.values()];
  return [...di.shapes]
    .filter(([id, b]) => !OUTSIDE_OK.has(di.kinds?.get(id) ?? "") && !pools.some((p) => holds(p, b)))
    .map(([id]) => id);
}

// ── Lane order ───────────────────────────────────────────────────────────

/** Which lane each shape sits in, by its centre. */
export function laneOf(di: DiLayout): Map<string, string> {
  const out = new Map<string, string>();
  for (const [id, b] of di.shapes) {
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    for (const [lane, l] of di.lanes) {
      if (cx >= l.x && cx <= l.x + l.width && cy >= l.y && cy <= l.y + l.height) out.set(id, lane);
    }
  }
  return out;
}

/** Lanes top to bottom (horizontal pools). Nested lanes are not reordered: only leaf lanes of one pool. */
export function laneOrder(di: DiLayout): string[] {
  return [...di.lanes].sort((a, b) => a[1].y - b[1].y).map(([id]) => id);
}

/**
 * The cost of an order: every flow between two lanes costs the number of lane
 * boundaries it crosses. A flow crossing a lane it does not stop in is the
 * long detour the owner pointed at (Stage → Review crossing two lanes).
 */
export function laneOrderCost(di: DiLayout, order: readonly string[]): number {
  const at = new Map(order.map((l, i) => [l, i]));
  const lane = laneOf(di);
  let cost = 0;
  for (const f of di.flows.values()) {
    const a = at.get(lane.get(f.source) ?? ""), b = at.get(lane.get(f.target) ?? "");
    if (a !== undefined && b !== undefined) cost += Math.abs(a - b);
  }
  return cost;
}

function* permutations<T>(xs: readonly T[]): Generator<T[]> {
  if (xs.length <= 1) {
    yield [...xs];
    return;
  }
  for (let i = 0; i < xs.length; i++) {
    for (const rest of permutations([...xs.slice(0, i), ...xs.slice(i + 1)])) yield [xs[i]!, ...rest];
  }
}

/** Past this many lanes the search is not exhaustive (8! = 40320 is still cheap; 9! is not worth it). */
const EXHAUSTIVE_LANES = 8;

/**
 * The cheapest lane order. Ties keep the current order, so a diagram already
 * at its best is never churned. Lanes that do not all share one pool, or more
 * lanes than {@link EXHAUSTIVE_LANES}, return the current order.
 */
export function bestLaneOrder(di: DiLayout): { order: string[]; cost: number; current: number } {
  const order = laneOrder(di);
  const current = laneOrderCost(di, order);
  if (order.length < 2 || order.length > EXHAUSTIVE_LANES || nested(di)) return { order, cost: current, current };
  let best = { order, cost: current };
  for (const p of permutations(order)) {
    const c = laneOrderCost(di, p);
    if (c < best.cost) best = { order: p, cost: c };
  }
  return { ...best, current };
}

/** True when a lane sits inside another, or the lanes span different pools. */
function nested(di: DiLayout): boolean {
  const ls = [...di.lanes.values()];
  if (ls.some((a) => ls.some((b) => a !== b && a.y >= b.y && a.y + a.height <= b.y + b.height && a.height < b.height))) return true;
  const xs = new Set(ls.map((l) => `${l.x}/${l.width}`));
  return xs.size > 1;
}

// ── Rewriting DI: swap lanes ─────────────────────────────────────────────

const fmt = (n: number): string => String(Math.round(n * 100) / 100);

/**
 * Move every lane to its place in `order`, keeping each lane's height. Shapes
 * and same-lane flows move with their lane; a flow between two lanes keeps
 * its bends, each moving with the lane it lies in. Only when that route now
 * runs through a box is it re-routed, by the first of a few right-angled
 * routes that runs through none (a flow that loops back along a lane went
 * straight through every step in it when it was always re-routed). A
 * cross-lane flow's label bounds are dropped so bpmn-js places it beside the
 * new route rather than where the old route was.
 */
export function applyLaneOrder(xml: string, order: readonly string[]): string {
  const di = readDi(xml);
  const current = laneOrder(di);
  if (order.join() === current.join()) return xml;
  const top = Math.min(...current.map((l) => di.lanes.get(l)!.y));
  const dy = new Map<string, number>();
  let y = top;
  for (const l of order) {
    const b = di.lanes.get(l)!;
    dy.set(l, y - b.y);
    y += b.height;
  }
  const lane = laneOf(di);
  const moved = (id: string): Box | undefined => {
    const b = di.shapes.get(id);
    if (!b) return undefined;
    return { ...b, y: b.y + (dy.get(lane.get(id) ?? "") ?? 0) };
  };
  const laneAtY = (y: number): string | undefined =>
    current.find((l) => { const b = di.lanes.get(l)!; return y >= b.y && y <= b.y + b.height; }) ??
    (y < top ? current[0] : current.at(-1));
  const after = new Map([...di.shapes.keys()].map((sid) => [sid, moved(sid)!] as const));
  const blocked = (route: Pt[], source: string, target: string): boolean => {
    const src = after.get(source), tgt = after.get(target);
    return [...after].some(([sid, b]) =>
      sid !== source && sid !== target &&
      ![src, tgt].some((x) => x && (holds(b, x) || boxesOverlap(b, x, 0))) &&
      segments(route).some(([p, q]) => segmentHitsBox(p, q, b, 2)));
  };

  let plane = firstPlane(xml);
  const original = plane;
  plane = plane.replace(/(<(?:\w+:)?BPMNShape\b([^>]*)>)([\s\S]*?)(<\/(?:\w+:)?BPMNShape>)/g, (all, open: string, attrs: string, body: string, close: string) => {
    const id = attr(attrs, "bpmnElement") ?? "";
    const d = di.lanes.has(id) ? dy.get(id) : dy.get(lane.get(id) ?? "");
    if (!d) return all;
    return open + body.replace(/(<(?:\w+:)?Bounds\b[^>]*\sy=")([-\d.]+)(")/g, (_m, a: string, v: string, b: string) => a + fmt(Number(v) + d) + b) + close;
  });
  plane = plane.replace(/(<(?:\w+:)?BPMNEdge\b([^>]*)>)([\s\S]*?)(<\/(?:\w+:)?BPMNEdge>)/g, (all, open: string, attrs: string, body: string, close: string) => {
    const id = attr(attrs, "bpmnElement") ?? "";
    const f = di.flows.get(id);
    if (!f) return all;
    const ls = lane.get(f.source), lt = lane.get(f.target);
    if (ls === lt) {
      const d = dy.get(ls ?? "") ?? 0;
      if (!d) return all;
      return open + body.replace(/(\sy=")([-\d.]+)(")/g, (_m, a: string, v: string, b: string) => a + fmt(Number(v) + d) + b) + close;
    }
    const s = moved(f.source), t = moved(f.target);
    if (!s || !t) return all;
    const indent = /\n(\s*)<(?:\w+:)?waypoint/.exec(body)?.[1] ?? "        ";
    const prefix = /<(\w+:)?waypoint/.exec(body)?.[1] ?? "di:";
    // Keep the author's bends: each waypoint moves with the lane it lies in,
    // its ends with their shapes. A horizontal run stays in one lane and a
    // vertical one keeps its x, so the route stays at right angles. Only if
    // that now runs through a box is a fresh route tried.
    const old = di.edges.get(id)?.points ?? [];
    const kept = old.map((p, i) => ({
      x: p.x,
      y: p.y + (dy.get((i === 0 ? ls : i === old.length - 1 ? lt : laneAtY(p.y)) ?? "") ?? 0),
    }));
    const clear = (route: Pt[]): boolean => route.length >= 2 && !blocked(route, f.source, f.target);
    const pts = [kept, elbow(s, t), orthogonalRoute(s, t), elbow(t, s).reverse()].find(clear) ?? (kept.length >= 2 ? kept : elbow(s, t));
    const wps = pts.map((p) => `\n${indent}<${prefix}waypoint x="${fmt(p.x)}" y="${fmt(p.y)}" />`).join("");
    const closeIndent = /\n(\s*)$/.exec(body)?.[1] ?? "      ";
    return `${open}${wps}\n${closeIndent}${close}`;
  });
  return xml.replace(original, plane);
}

/** One orthogonal elbow from box `s` to box `t` in another lane. */
export function elbow(s: Box, t: Box): Pt[] {
  const scx = s.x + s.width / 2, tcx = t.x + t.width / 2, tcy = t.y + t.height / 2;
  const down = t.y > s.y;
  const start = { x: scx, y: down ? s.y + s.height : s.y };
  if (Math.abs(scx - tcx) < 1) return [start, { x: scx, y: down ? t.y : t.y + t.height }];
  const side = tcx > scx ? t.x : t.x + t.width;
  return [start, { x: scx, y: tcy }, { x: side, y: tcy }];
}

// ── Rectilinear: no slanted flows ───────────────────────────────────────

/** A segment that moves more than this in both x and y is a slant. */
const SLANT = 1;

/** Flows with at least one segment that is neither horizontal nor vertical. */
export function diagonalEdges(di: DiLayout): string[] {
  return [...di.edges]
    .filter(([, e]) => segments(e.points).some(([p, r]) => Math.abs(p.x - r.x) > SLANT && Math.abs(p.y - r.y) > SLANT))
    .map(([id]) => id);
}

/**
 * A right-angled route from box `s` to box `t`: side to side through the
 * gap between them when they do not overlap horizontally (out, along the
 * middle of the gap, in), else bottom/top to top/bottom through the middle
 * of the vertical gap. Straight when the two line up.
 */
export function orthogonalRoute(s: Box, t: Box): Pt[] {
  const scx = s.x + s.width / 2, scy = s.y + s.height / 2;
  const tcx = t.x + t.width / 2, tcy = t.y + t.height / 2;
  if (s.x + s.width <= t.x || t.x + t.width <= s.x) {
    const right = t.x >= s.x + s.width;
    const sx = right ? s.x + s.width : s.x, tx = right ? t.x : t.x + t.width;
    if (Math.abs(scy - tcy) <= SLANT) return [{ x: sx, y: scy }, { x: tx, y: scy }];
    const mx = (sx + tx) / 2;
    return [{ x: sx, y: scy }, { x: mx, y: scy }, { x: mx, y: tcy }, { x: tx, y: tcy }];
  }
  const down = t.y >= s.y + s.height;
  const sy = down ? s.y + s.height : s.y, ty = down ? t.y : t.y + t.height;
  if (Math.abs(scx - tcx) <= SLANT) return [{ x: scx, y: sy }, { x: scx, y: ty }];
  const my = (sy + ty) / 2;
  return [{ x: scx, y: sy }, { x: scx, y: my }, { x: tcx, y: my }, { x: tcx, y: ty }];
}

/**
 * Re-route every slanted flow at right angles ({@link orthogonalRoute}). A
 * new route that would pass through another shape is not written, so the
 * finding stays for the author. The flow's label bounds are dropped so
 * bpmn-js places it beside the new route. Returns the new XML and the flows
 * it changed.
 */
export function straightenFlows(xml: string): { xml: string; fixed: string[] } {
  const di = readDi(xml);
  const routes = new Map<string, Pt[]>();
  for (const id of diagonalEdges(di)) {
    const f = di.flows.get(id);
    const s = f && di.shapes.get(f.source), t = f && di.shapes.get(f.target);
    if (!f || !s || !t) continue;
    const route = orthogonalRoute(s, t);
    const blocked = [...di.shapes].some(([sid, b]) =>
      sid !== f.source && sid !== f.target && segments(route).some(([p, r]) => segmentHitsBox(p, r, b)));
    if (!blocked) routes.set(id, route);
  }
  if (routes.size === 0) return { xml, fixed: [] };
  const plane = firstPlane(xml);
  const next = plane.replace(/(<(?:\w+:)?BPMNEdge\b([^>]*)>)([\s\S]*?)(<\/(?:\w+:)?BPMNEdge>)/g, (all, open: string, attrs: string, body: string, close: string) => {
    const route = routes.get(attr(attrs, "bpmnElement") ?? "");
    if (!route) return all;
    const indent = /\n(\s*)<(?:\w+:)?waypoint/.exec(body)?.[1] ?? "        ";
    const prefix = /<(\w+:)?waypoint/.exec(body)?.[1] ?? "di:";
    const closeIndent = /\n(\s*)$/.exec(body)?.[1] ?? "      ";
    return `${open}${route.map((p) => `\n${indent}<${prefix}waypoint x="${fmt(p.x)}" y="${fmt(p.y)}" />`).join("")}\n${closeIndent}${close}`;
  });
  return { xml: xml.replace(plane, next), fixed: [...routes.keys()] };
}

// ── Text that does not fit its box ──────────────────────────────────────

/** Room left around a shape's text: bpmn-js pads 5, and the eye wants a little more. */
const TEXT_PAD = 8;

/** Kinds bpmn-js draws a type icon for, in the top-left corner. */
const ICON_KINDS = new Set(["userTask", "serviceTask", "scriptTask", "manualTask", "sendTask", "receiveTask", "businessRuleTask"]);
/** Kinds bpmn-js draws a [+] marker for, at the bottom centre. */
const MARKER_KINDS = new Set(["callActivity", "subProcess", "adHocSubProcess", "transaction"]);
/** The icon's corner square, and the marker's height. */
const ICON = 22;
const MARKER = 18;

/**
 * Pairs of steps drawn on top of each other. A boundary event on its task,
 * and a step inside the sub-process that holds it, do not count.
 */
export function shapeOverlaps(di: DiLayout): [string, string][] {
  const out: [string, string][] = [];
  const ids = [...di.shapes.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = di.shapes.get(ids[i]!)!, c = di.shapes.get(ids[j]!)!;
      if (holds(a, c) || holds(c, a)) continue;
      if ([ids[i]!, ids[j]!].some((x) => di.kinds?.get(x) === "boundaryEvent")) continue;
      if (boxesOverlap(a, c, 2)) out.push([ids[i]!, ids[j]!]);
    }
  }
  return out;
}

/**
 * The one size every task box is drawn at: square, so a name sits clear of
 * the type icon and the [+] marker without the box growing to fit it (owner,
 * 2026-11-01: *"i want the boxes to be fixed size. just make them
 * taller/square"*, *"square tasks with icons as before"*). A name that does
 * not fit is shortened; the box is not made bigger.
 */
export const TASK_SIZE = { width: 120, height: 120 } as const;

/** Kinds drawn as a task box. */
const ACTIVITY_KINDS = new Set(["task", ...ICON_KINDS, ...MARKER_KINDS]);

/**
 * The task boxes not at {@link TASK_SIZE}. An expanded sub-process
 * (`isExpanded="true"`) holds other shapes, so it keeps its size.
 */
export function offSizeTasks(xml: string): string[] {
  const di = readDi(xml);
  const expanded = new Set([...xml.matchAll(/<(?:\w+:)?BPMNShape\b[^>]*>/g)]
    .filter((m) => /\sisExpanded="true"/.test(m[0]))
    .map((m) => /\sbpmnElement="([^"]+)"/.exec(m[0])?.[1] ?? ""));
  return [...di.shapes].filter(([id, b]) => ACTIVITY_KINDS.has(di.kinds?.get(id) ?? "") && !expanded.has(id) &&
    (b.width !== TASK_SIZE.width || b.height !== TASK_SIZE.height)).map(([id]) => id);
}

/**
 * Draw every task box at {@link TASK_SIZE}, about its centre (smaller boxes
 * grow, bigger ones shrink), then let {@link resizeShapes} make room in the
 * columns and lanes and re-route the flows that touch them. `only` limits it
 * to those tasks.
 */
export function fixTaskSize(xml: string, only?: ReadonlySet<string>): { xml: string; fixed: string[] } {
  const ids = new Set(offSizeTasks(xml).filter((id) => !only || only.has(id)));
  if (ids.size === 0) return { xml, fixed: [] };
  const next = xml.replace(/(<(?:\w+:)?BPMNShape\b[^>]*\sbpmnElement="([^"]+)"[^>]*>\s*<(?:\w+:)?Bounds\s)x="([\d.-]+)"\s+y="([\d.-]+)"\s+width="([\d.]+)"\s+height="([\d.]+)"/g,
    (all, pre: string, id: string, xs: string, ys: string, ws: string, hs: string) => {
      if (!ids.has(id)) return all;
      const [x, y, w, h] = [xs, ys, ws, hs].map(Number) as [number, number, number, number];
      return `${pre}x="${x + (w - TASK_SIZE.width) / 2}" y="${y + (h - TASK_SIZE.height) / 2}" width="${TASK_SIZE.width}" height="${TASK_SIZE.height}"`;
    });
  return { xml: resizeShapes(next, new Map([...ids].map((id) => [id, { ...TASK_SIZE }]))), fixed: [...ids] };
}

/** Shapes whose drawn text runs outside them, or under their icon or marker, with the size the text needs. */
export function textOverflow(di: DiLayout, drawn?: DrawnLabels): { id: string; box: Box; need: Box }[] {
  const out: { id: string; box: Box; need: Box }[] = [];
  for (const t of drawn?.texts ?? []) {
    const b = di.shapes.get(t.id);
    if (!b) continue;
    const spills = t.x < b.x - 1 || t.y < b.y - 1 || t.x + t.width > b.x + b.width + 1 || t.y + t.height > b.y + b.height + 1;
    // The task-type icon top left (a person, a cog) and the [+] or loop
    // marker bottom centre are drawn over the text when the box is tight.
    const kind = di.kinds?.get(t.id) ?? "";
    const icon = ICON_KINDS.has(kind) && boxesOverlap(t, { x: b.x, y: b.y, width: ICON, height: ICON }, 0);
    const marker = MARKER_KINDS.has(kind) && boxesOverlap(t, { x: b.x + b.width / 2 - MARKER, y: b.y + b.height - MARKER, width: 2 * MARKER, height: MARKER }, 0);
    if (spills || icon || marker) {
      const pad = icon ? ICON : marker ? MARKER : TEXT_PAD;
      out.push({ id: t.id, box: b, need: { x: b.x, y: b.y, width: t.width + 2 * TEXT_PAD, height: t.height + 2 * pad } });
    }
  }
  return out;
}

/** The header strip bpmn-js gives a pool's or lane's name, across. */
const STRIP = 30;
/** One line of a header name: bootstrap-tools `HEADER_STYLE`, 13px at 1.05. */
const HEADER_LINE = 13 * 1.05;

/**
 * Pool and lane names that spill out of their strip, with the height the
 * lane (or pool) needs for the name to fit in the lines the strip holds.
 */
export function headerOverflow(drawn?: DrawnLabels): { id: string; room: number; need: number }[] {
  const fit = Math.max(1, Math.floor(STRIP / HEADER_LINE));
  return (drawn?.headers ?? [])
    .filter((h) => h.height > STRIP + 1)
    .map((h) => ({ id: h.id, room: h.room, need: Math.ceil((Math.ceil(h.height / HEADER_LINE) * h.width) / fit + 2 * TEXT_PAD) }));
}

/**
 * Resize shapes about their centres (never smaller), then make each lane tall
 * enough for what it holds, moving the lanes below it down, and re-route
 * every flow that touches a resized shape at right angles. Pools grow with
 * their lanes. Used by `bpmn:detangle --write` for {@link textOverflow}.
 */
export function resizeShapes(
  xml: string,
  sizes: ReadonlyMap<string, { width: number; height: number }>,
  laneMin: ReadonlyMap<string, number> = new Map(),
): string {
  const di0 = readDi(xml);
  const lane = laneOf(di0);
  const shapes = new Map(di0.shapes);
  for (const [id, sz] of sizes) {
    const b = shapes.get(id);
    if (!b) continue;
    const w = Math.max(b.width, Math.ceil(sz.width)), h = Math.max(b.height, Math.ceil(sz.height));
    shapes.set(id, { x: b.x - (w - b.width) / 2, y: b.y - (h - b.height) / 2, width: w, height: h });
  }
  // Columns left to right: a shape that grew must not crowd the next column.
  // Everything starting right of a shape is pushed right until there is
  // GAP between them; shapes stacked in one column (overlapping in x before
  // the change) are not pushed apart.
  const GAP = 40;
  const byX = [...shapes.keys()].sort((a, b) => di0.shapes.get(a)!.x - di0.shapes.get(b)!.x);
  let dx = 0;
  for (let i = 0; i < byX.length; i++) {
    const id = byX[i]!, o = di0.shapes.get(id)!, b = shapes.get(id)!;
    for (let j = 0; j < i; j++) {
      const pid = byX[j]!, po = di0.shapes.get(pid)!, pb = shapes.get(pid)!;
      const sameColumn = po.x < o.x + o.width && o.x < po.x + po.width;
      if (sameColumn) continue;
      // Keep the gap it had, up to GAP: an event close beside its task stays close.
      const was = o.x - (po.x + po.width);
      if (was < 0) continue;
      const needed = pb.x + pb.width + Math.min(was, GAP) - (b.x + dx);
      if (needed > 0) dx += needed;
    }
    shapes.set(id, { ...b, x: b.x + dx });
  }
  const widen = dx;

  // Lanes top to bottom: keep each shape at least MARGIN inside its lane, growing the lane and pushing the rest down.
  const MARGIN = 12;
  const order = laneOrder(di0);
  const lanes = new Map(di0.lanes);
  const shiftOf = new Map<string, number>();
  let shift = 0;
  for (const l of order) {
    const b0 = di0.lanes.get(l)!;
    const top = b0.y + shift;
    let bottom = b0.y + b0.height + shift;
    for (const [id, b] of shapes) {
      if (lane.get(id) !== l) continue;
      let y = b.y + shift;
      if (y < top + MARGIN) y = top + MARGIN;
      shapes.set(id, { ...b, y });
      bottom = Math.max(bottom, y + b.height + MARGIN);
    }
    // A lane at least as tall as its name needs, the extra split above and below its shapes.
    const min = laneMin.get(l) ?? 0;
    if (bottom - top < min) {
      const extra = min - (bottom - top);
      for (const [id, b] of shapes) if (lane.get(id) === l) shapes.set(id, { ...b, y: b.y + extra / 2 });
      bottom = top + min;
    }
    shiftOf.set(l, shift);
    lanes.set(l, { ...b0, y: top, height: bottom - top, width: b0.width + widen });
    shift += bottom - top - b0.height;
  }
  const touched = new Set([...sizes.keys()]);
  for (const [id, b] of shapes) if (b.y !== di0.shapes.get(id)!.y || b.x !== di0.shapes.get(id)!.x) touched.add(id);

  // Where an old coordinate lands now. A function of the coordinate alone,
  // so points that shared an x (or a y) still do, and a right-angled route
  // stays right-angled. x moves with the column it lies in (or the nearest
  // one to its left); y with the lane it lies in.
  const olds = [...di0.shapes].filter(([sid]) => shapes.has(sid));
  const mapX = (x: number): number => {
    const inCol = olds.find(([, o]) => x >= o.x && x <= o.x + o.width);
    if (inCol) {
      const [sid, o] = inCol, n = shapes.get(sid)!;
      return x + (n.x + n.width / 2) - (o.x + o.width / 2);
    }
    let best: [string, Box] | undefined;
    for (const e of olds) if (e[1].x + e[1].width < x && (!best || e[1].x + e[1].width > best[1].x + best[1].width)) best = e;
    if (!best) return x;
    const n = shapes.get(best[0])!;
    return x + (n.x + n.width) - (best[1].x + best[1].width);
  };
  const mapY = (y: number): number => {
    const l = order.find((k) => { const b = di0.lanes.get(k)!; return y >= b.y && y <= b.y + b.height; });
    return y + (l ? shiftOf.get(l) ?? 0 : y < (di0.lanes.get(order[0] ?? "")?.y ?? 0) ? 0 : shift);
  };
  // An end that sat on a side of its shape stays on that side.
  const snap = (p: Pt, o: Box | undefined, n: Box): Pt => {
    if (!o) return p;
    const E = 1.5;
    if (Math.abs(p.x - o.x) < E) return { ...p, x: n.x };
    if (Math.abs(p.x - (o.x + o.width)) < E) return { ...p, x: n.x + n.width };
    if (Math.abs(p.y - o.y) < E) return { ...p, y: n.y };
    if (Math.abs(p.y - (o.y + o.height)) < E) return { ...p, y: n.y + n.height };
    return p;
  };
  const onEdge = (p: Pt, b: Box): boolean => {
    const E = 1.5, inX = p.x >= b.x - E && p.x <= b.x + b.width + E, inY = p.y >= b.y - E && p.y <= b.y + b.height + E;
    return (inY && (Math.abs(p.x - b.x) < E || Math.abs(p.x - b.x - b.width) < E)) ||
      (inX && (Math.abs(p.y - b.y) < E || Math.abs(p.y - b.y - b.height) < E)) ||
      (inX && inY);
  };
  const movedRoute = (pts: Pt[], so: Box | undefined, sn: Box, to: Box | undefined, tn: Box): Pt[] | undefined => {
    if (pts.length < 2) return undefined;
    const m = pts.map((p) => ({ x: mapX(p.x), y: mapY(p.y) }));
    const first = snap(pts[0]!, so, sn), last = snap(pts.at(-1)!, to, tn);
    if (first !== pts[0]) m[0] = first.x !== pts[0]!.x ? { x: first.x, y: m[0]!.y } : { x: m[0]!.x, y: first.y };
    if (last !== pts.at(-1)) m[m.length - 1] = last.x !== pts.at(-1)!.x ? { x: last.x, y: m.at(-1)!.y } : { x: m.at(-1)!.x, y: last.y };
    return onEdge(m[0]!, sn) && onEdge(m.at(-1)!, tn) ? m : undefined;
  };
  const routeBlocked = (route: Pt[], source: string, target: string): boolean => {
    const src = shapes.get(source), tgt = shapes.get(target);
    return [...shapes].some(([sid, b]) =>
      sid !== source && sid !== target &&
      ![src, tgt].some((x) => x && (holds(b, x) || boxesOverlap(b, x, 0))) &&
      segments(route).some(([p, q]) => segmentHitsBox(p, q, b, 2)));
  };

  let plane = firstPlane(xml);
  const original = plane;
  const setBounds = (body: string, b: Box): string =>
    body.replace(/<((?:\w+:)?Bounds)\b[^>]*\/?>/, (_m, tag: string) => `<${tag} x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.width)}" height="${fmt(b.height)}" />`);
  plane = plane.replace(/(<(?:\w+:)?BPMNShape\b([^>]*)>)([\s\S]*?)(<\/(?:\w+:)?BPMNShape>)/g, (all, open: string, attrs: string, body: string, close: string) => {
    const id = attr(attrs, "bpmnElement") ?? "";
    const [own, labelPart] = splitLabel(body);
    const rest = [labelPart];
    if (lanes.has(id)) return open + setBounds(own!, lanes.get(id)!) + rest.join("") + close;
    if (di0.pools.has(id)) {
      const p = di0.pools.get(id)!;
      return open + setBounds(own!, { ...p, height: p.height + shift, width: p.width + widen }) + rest.join("") + close;
    }
    const b = shapes.get(id);
    if (!b) return all;
    const d = b.y - di0.shapes.get(id)!.y, ddx = (b.x + b.width / 2) - (di0.shapes.get(id)!.x + di0.shapes.get(id)!.width / 2);
    const label = rest.join("")
      .replace(/(\sy=")([-\d.]+)(")/g, (_m, a: string, v: string, c: string) => a + fmt(Number(v) + d) + c)
      .replace(/(\sx=")([-\d.]+)(")/g, (_m, a: string, v: string, c: string) => a + fmt(Number(v) + ddx) + c);
    return open + setBounds(own!, b) + label + close;
  });
  plane = plane.replace(/(<(?:\w+:)?BPMNEdge\b([^>]*)>)([\s\S]*?)(<\/(?:\w+:)?BPMNEdge>)/g, (all, open: string, attrs: string, body: string, close: string) => {
    const id = attr(attrs, "bpmnElement") ?? "";
    const f = di0.flows.get(id);
    if (!f) return all;
    if (touched.has(f.source) || touched.has(f.target)) {
      const s = shapes.get(f.source), t = shapes.get(f.target);
      if (!s || !t) return all;
      const indent = /\n(\s*)<(?:\w+:)?waypoint/.exec(body)?.[1] ?? "        ";
      const prefix = /<(\w+:)?waypoint/.exec(body)?.[1] ?? "di:";
      const closeIndent = /\n(\s*)$/.exec(body)?.[1] ?? "      ";
      // Keep the author's bends where they still run clear; else the first
      // right-angled route that does. Re-routing every touched flow drew a
      // loop-back flow straight through the steps of its lane.
      const kept = movedRoute(di0.edges.get(id)?.points ?? [], di0.shapes.get(f.source), s, di0.shapes.get(f.target), t);
      const clear = (r: Pt[] | undefined): r is Pt[] => !!r && r.length >= 2 && !routeBlocked(r, f.source, f.target);
      const route = [kept, orthogonalRoute(s, t), elbow(s, t), elbow(t, s).reverse()].find(clear) ?? orthogonalRoute(s, t);
      return `${open}${route.map((p) => `\n${indent}<${prefix}waypoint x="${fmt(p.x)}" y="${fmt(p.y)}" />`).join("")}\n${closeIndent}${close}`;
    }
    const d = shiftOf.get(lane.get(f.source) ?? "") ?? 0;
    if (!d) return all;
    return open + body.replace(/(\sy=")([-\d.]+)(")/g, (_m, a: string, v: string, c: string) => a + fmt(Number(v) + d) + c) + close;
  });
  return xml.replace(original, plane);
}

// ── Labels clear of everything ──────────────────────────────────────────

/** The top and bottom edge of every lane and pool, keyed by lane or pool id. */
function laneLines(di: DiLayout): [string, [Pt, Pt]][] {
  const out: [string, [Pt, Pt]][] = [];
  for (const [id, b] of [...di.lanes, ...di.pools]) {
    out.push([id, [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y }]]);
    out.push([id, [{ x: b.x, y: b.y + b.height }, { x: b.x + b.width, y: b.y + b.height }]]);
  }
  // A pool's right edge is drawn too: an end label run across it was the
  // owner's screenshot (test-plan-execution, 2026-11-03, cat-harness#991).
  for (const [id, b] of di.pools) out.push([id, [{ x: b.x + b.width, y: b.y }, { x: b.x + b.width, y: b.y + b.height }]]);
  return out;
}

/** Space kept between a label and what it names. */
const LABEL_GAP = 4;

/** Where a label may go, nearest first: around its shape, or beside each run of its flow. */
function labelCandidates(di: DiLayout, id: string, w: number, h: number): Box[] {
  const s = di.shapes.get(id);
  const at = (x: number, y: number): Box => ({ x, y, width: w, height: h });
  if (s) {
    const cx = s.x + s.width / 2, cy = s.y + s.height / 2, g = LABEL_GAP;
    const below = s.y + s.height + g, above = s.y - h - g, right = s.x + s.width + g, left = s.x - w - g;
    return [
      at(cx - w / 2, below), at(cx - w / 2, above), at(right, cy - h / 2), at(left, cy - h / 2),
      at(right, below), at(left, below), at(right, above), at(left, above),
      at(right, s.y + s.height - h), at(left, s.y + s.height - h), at(right, s.y), at(left, s.y),
    ];
  }
  const e = di.edges.get(id);
  if (!e) return [];
  const out: Box[] = [];
  for (const [p, r] of segments(e.points)) {
    const len = Math.hypot(r.x - p.x, r.y - p.y);
    for (const t of [0.5, 0.25, 0.75]) {
      const m = { x: p.x + (r.x - p.x) * t, y: p.y + (r.y - p.y) * t };
      if (p.y === r.y && len >= 20) out.push(at(m.x - w / 2, m.y - h - 3), at(m.x - w / 2, m.y + 3));
      else if (p.x === r.x && len >= 20) out.push(at(m.x + 4, m.y - h / 2), at(m.x - w - 4, m.y - h / 2));
    }
    // Hugging the start of a run, where a gateway's answers usually sit.
    if (p.y === r.y) out.push(at(Math.min(p.x, r.x) + 6, p.y - h - 3), at(Math.max(p.x, r.x) - w - 6, p.y - h - 3));
    if (p.x === r.x) out.push(at(p.x + 4, Math.min(p.y, r.y) + 4), at(p.x + 4, Math.max(p.y, r.y) - h - 4));
  }
  // A run too short to hold its label: the four corners where the flow
  // leaves its source, then where it meets its target.
  for (const p of [e.points[0], e.points.at(-1)]) {
    if (p) out.push(at(p.x + 4, p.y - h - 3), at(p.x + 4, p.y + 3), at(p.x - w - 4, p.y - h - 3), at(p.x - w - 4, p.y + 3));
  }
  return out;
}

/**
 * Move every label that sits on a flow, a shape, another label, a lane line
 * or a name strip to the nearest place where it touches none of them, and
 * write that place as its `BPMNLabel` bounds. Sizes are the drawn ones, so a
 * drawing is needed; a label with nowhere clear to go is left where it is
 * and the check still reports it. Owner, 2026-10-31: *"need to check for
 * text on arrows"*.
 */
export function placeLabels(xml: string, drawn: DrawnLabels): { xml: string; moved: string[] } {
  const di = readDi(xml);
  const lane = laneOf(di);
  const labels = labelBoxes(di, drawn);
  const placed = new Map(labels.map((l) => [l.id, l.box]));
  const edgePts = drawn.edges ? new Map(drawn.edges.map((e) => [e.id, e.points])) : new Map([...di.edges].map(([id, e]) => [id, e.points]));
  const lines = laneLines(di);
  const strips = [...di.pools.values(), ...di.lanes.values()].map((h) => ({ x: h.x, y: h.y, width: HEADER, height: h.height }));
  const area = extent(di);
  const clear = (id: string, b: Box): boolean => {
    if (area && (b.x < area.x || b.y < area.y || b.x + b.width > area.x + area.width || b.y + b.height > area.y + area.height)) return false;
    const home = lane.get(id) && di.lanes.get(lane.get(id)!);
    if (home && !(b.y >= home.y && b.y + b.height <= home.y + home.height)) return false;
    for (const [oid, ob] of placed) if (oid !== id && boxesOverlap(b, ob)) return false;
    for (const s of di.shapes.values()) if (boxesOverlap(b, s)) return false;
    for (const pts of edgePts.values()) if (segments(pts).some(([p, r]) => segmentHitsBox(p, r, b, 2))) return false;
    for (const [, [p, r]] of lines) if (segmentHitsBox(p, r, b, 2)) return false;
    for (const st of strips) if (boxesOverlap(b, st)) return false;
    return true;
  };
  // A label moved far must still read as its own element's: a flow's label
  // stays nearer its flow than any other, a shape's beside its shape. A
  // branch label beside the wrong branch is worse than one on its line.
  const gap = (b: Box, p: Pt, r: Pt): number => {
    const dx = Math.max(0, b.x - Math.max(p.x, r.x), Math.min(p.x, r.x) - (b.x + b.width));
    const dy = Math.max(0, b.y - Math.max(p.y, r.y), Math.min(p.y, r.y) - (b.y + b.height));
    return Math.hypot(dx, dy);
  };
  const toEdge = (b: Box, pts: Pt[]): number => Math.min(...segments(pts).map(([p, r]) => gap(b, p, r)));
  const staysWith = (id: string, b: Box): boolean => {
    const own = edgePts.get(id);
    if (own) {
      const d = toEdge(b, own);
      return d <= STAY && [...edgePts].every(([oid, pts]) => oid === id || toEdge(b, pts) > d);
    }
    const s = di.shapes.get(id);
    if (!s) return false;
    const dx = Math.max(0, b.x - (s.x + s.width), s.x - (b.x + b.width)), dy = Math.max(0, b.y - (s.y + s.height), s.y - (b.y + b.height));
    return Math.hypot(dx, dy) <= STAY;
  };
  const moves = new Map<string, Box>();
  for (const l of labels) {
    if (clear(l.id, l.box)) continue;
    // bpmn-js wraps an outside label at its DI width (90 when there is
    // none), so the box written keeps that width and the text's height.
    const own = di.shapes.get(l.id)?.label ?? di.edges.get(l.id)?.label;
    const w = Math.max(l.box.width, own?.width ?? 90);
    // Where no place holds it at its width, a wider box wraps the same text
    // into fewer lines: a five-line gateway question at 90 is three at 150.
    const lines = Math.max(1, Math.round(l.box.height / LINE_PX));
    const lineH = l.box.height / lines;
    const sizes = [w, ...[1.5, 2, 2.5].map((k) => Math.min(Math.round(w * k), 260)).filter((x) => x > w)]
      .map((ww) => ({ ww, hh: Math.ceil(Math.ceil(lines * w / ww) * lineH) }))
      .filter((sz, i, all) => i === 0 || sz.hh < all[i - 1]!.hh);
    let to: Box | undefined;
    for (const { ww, hh } of sizes) {
      to = labelCandidates(di, l.id, ww, hh).find((c) => clear(l.id, c));
      if (to) break;
    }
    // Still nowhere: the nearest clear place within reach of where it is
    // drawn now, nearest first, so it stays readable as its element's.
    for (const { ww, hh } of to ? [] : sizes) {
      const cx = l.box.x + l.box.width / 2, cy = l.box.y + l.box.height / 2;
      const ring: Box[] = [];
      for (let dy = -REACH; dy <= REACH; dy += 8) {
        for (let dx = -REACH; dx <= REACH; dx += 8) ring.push({ x: cx + dx - ww / 2, y: cy + dy - hh / 2, width: ww, height: hh });
      }
      ring.sort((a, b) => Math.hypot(a.x + ww / 2 - cx, a.y + hh / 2 - cy) - Math.hypot(b.x + ww / 2 - cx, b.y + hh / 2 - cy));
      to = ring.find((c) => clear(l.id, c) && staysWith(l.id, c));
      if (to) break;
    }
    if (!to) continue;
    placed.set(l.id, to);
    moves.set(l.id, to);
  }
  if (moves.size === 0) return { xml, moved: [] };
  const plane = firstPlane(xml);
  const bounds = (tag: string, b: Box): string => `<${tag} x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.width)}" height="${fmt(b.height)}" />`;
  const next = plane.replace(/(<((?:\w+:)?)(BPMNShape|BPMNEdge)\b([^>]*)>)([\s\S]*?)(<\/(?:\w+:)?(?:BPMNShape|BPMNEdge)>)/g,
    (all, open: string, pre: string, _k: string, attrs: string, body: string, close: string) => {
      const b = moves.get(attr(attrs, "bpmnElement") ?? "");
      if (!b) return all;
      const dc = /<(\w+:)?Bounds\b/.exec(body)?.[1] ?? "dc:";
      const label = `<${pre}BPMNLabel>${bounds(`${dc}Bounds`, b)}</${pre}BPMNLabel>`;
      // An existing label element, with or without bounds, is replaced whole.
      const had = /<(?:\w+:)?BPMNLabel\b(?:[^>]*\/>|[\s\S]*?<\/(?:\w+:)?BPMNLabel>)/;
      if (had.test(body)) return open + body.replace(had, label) + close;
      const indent = /\n(\s*)<\/[^>]*>$/.exec(body + close)?.[1] ?? "      ";
      return `${open}${body.replace(/\s*$/, "")}\n${indent}  ${label}\n${indent}${close}`;
    });
  return { xml: xml.replace(plane, next), moved: [...moves.keys()] };
}

// ── The checks ───────────────────────────────────────────────────────────

/** Label boxes: drawn ones when given, else the DI's own `BPMNLabel` bounds. */
function labelBoxes(di: DiLayout, drawn?: DrawnLabels): { id: string; text: string; box: Box }[] {
  if (drawn) return drawn.labels.map((l) => ({ id: l.id, text: l.text, box: l }));
  const out: { id: string; text: string; box: Box }[] = [];
  for (const [id, s] of di.shapes) if (s.label) out.push({ id, text: di.names.get(id) ?? id, box: s.label });
  for (const [id, e] of di.edges) if (e.label) out.push({ id, text: di.flows.get(id)?.name ?? id, box: e.label });
  return out;
}

const q = (s: string): string => `"${s.replace(/\s+/g, " ").trim()}"`;

/** Every readable-at-100% and detangle criterion for one diagram, findings keyed by criterion id. */
/** The criteria `diagramFit` reports that kg:audit records (`edge-through-shape` is `edge-through-node` there). */
export const FIT_CRITERIA = ["diagram-too-wide", "diagram-too-tall", "label-overlap", "label-on-edge", "label-on-shape", "label-on-lane-line", "shape-overlap", "lane-order"] as const;

export function diagramFit(xml: string, drawn?: DrawnLabels): Record<string, Finding[]> {
  const di = readDi(xml);
  const out: Record<string, Finding[]> = {
    "diagram-too-wide": [],
    "diagram-too-tall": [],
    "label-overlap": [],
    "label-on-edge": [],
    "label-on-shape": [],
    "label-on-lane-line": [],
    "text-overflow": [],
    "header-overflow": [],
    "edge-diagonal": [],
    "edge-crossing": [],
    "edge-through-shape": [],
    "edge-through-own-end": [],
    "edge-detached": [],
    "edge-shared-port": [],
    "shape-outside-pool": [],
    "shape-overlap": [],
    "lane-order": [],
  };
  const ext = extent(di);
  if (ext && ext.width > FIT_WIDTH) {
    out["diagram-too-wide"]!.push({
      where: "diagram",
      detail: `${Math.round(ext.width)} wide, budget ${FIT_WIDTH}: text shows at ${(TEXT_PX * 1200 / ext.width).toFixed(1)}px in a 1200px band. ` +
        `Close the gaps between columns, stack steps of different lanes in one column, or split by phase.`,
    });
  }
  if (ext && ext.height > FIT_HEIGHT) {
    out["diagram-too-tall"]!.push({
      where: "diagram",
      detail: `${Math.round(ext.height)} tall, budget ${FIT_HEIGHT}: a reader scrolls to see it whole. Shrink lanes to their content, or split by phase.`,
    });
  }

  const labels = labelBoxes(di, drawn);
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (boxesOverlap(labels[i]!.box, labels[j]!.box)) {
        out["label-overlap"]!.push({
          where: `${labels[i]!.id}+${labels[j]!.id}`,
          detail: `label ${q(labels[i]!.text)} overlaps ${q(labels[j]!.text)}. Give one a BPMNLabel position clear of the other (a gateway's question above it, its answers beside their flows).`,
        });
      }
    }
  }
  const edgePts = drawn?.edges ? new Map(drawn.edges.map((e) => [e.id, e.points])) : new Map([...di.edges].map(([id, e]) => [id, e.points]));
  for (const l of labels) {
    for (const [eid, pts] of edgePts) {
      // Its own flow too: a label drawn over its own arrow hides both.
      if (segments(pts).some(([p, r]) => segmentHitsBox(p, r, l.box, 2))) {
        out["label-on-edge"]!.push({ where: `${l.id}/${eid}`, detail: `label ${q(l.text)} sits on flow ${eid}. Move the label off the line (\`bpmn:detangle --write\` does it).` });
      }
    }
    // The name strip down the left of a horizontal pool or lane is drawn text too.
    for (const [hid, h] of [...di.pools, ...di.lanes]) {
      if (boxesOverlap(l.box, { x: h.x, y: h.y, width: HEADER, height: h.height })) {
        out["label-on-shape"]!.push({ where: `${l.id}/${hid}`, detail: `label ${q(l.text)} runs into the name of ${q(di.names.get(hid) ?? hid)}.` });
      }
    }
    // Its OWN shape too: a gateway's question wrapped onto the diamond is the
    // collision the owner circled, half of it.
    for (const [sid, s] of di.shapes) {
      if (boxesOverlap(l.box, s)) {
        out["label-on-shape"]!.push({ where: `${l.id}/${sid}`, detail: `label ${q(l.text)} covers ${q(di.names.get(sid) ?? sid)}.` });
      }
    }
  }

  for (const l of labels) {
    for (const [lid, line] of laneLines(di)) {
      if (segmentHitsBox(line[0], line[1], l.box, 2)) {
        out["label-on-lane-line"]!.push({
          where: `${l.id}/${lid}`,
          detail: `label ${q(l.text)} is drawn across the edge of ${q(di.names.get(lid) ?? lid)}. Move it inside one lane (\`bpmn:detangle --write\` does it).`,
        });
        break;
      }
    }
  }

  for (const h of headerOverflow(drawn)) {
    out["header-overflow"]!.push({
      where: h.id,
      detail: `the name of ${q(di.names.get(h.id) ?? h.id)} needs about ${Math.round(h.need)} of height to fit its header strip in two lines; ` +
        `it has ${Math.round(h.room)}. Make the lane taller (\`bpmn:detangle --write\` does it) or the name shorter.`,
    });
  }
  for (const o of textOverflow(di, drawn)) {
    out["text-overflow"]!.push({
      where: o.id,
      detail: `the name of ${q(di.names.get(o.id) ?? o.id)} needs about ${Math.round(o.need.width)} × ${Math.round(o.need.height)}, its box is ` +
        `${Math.round(o.box.width)} × ${Math.round(o.box.height)}. Every task is a fixed ${TASK_SIZE.width} × ${TASK_SIZE.height} (\`bpmn:detangle --write\` sets it); a name that spills from that is shortened.`,
    });
  }
  for (const id of diagonalEdges(di)) {
    out["edge-diagonal"]!.push({
      where: id,
      detail: `flow ${id} runs at a slant. Route it at right angles: out of the side facing its target, along, and in. \`bpmn:detangle --write\` does it.`,
    });
  }
  for (const [a, b] of crossings(di)) {
    out["edge-crossing"]!.push({ where: `${a}×${b}`, detail: `flows ${a} and ${b} cross. Re-route one around the other, move a step, or swap lanes (\`bpmn:detangle\`).` });
  }
  for (const [a, b] of shapeOverlaps(di)) {
    out["shape-overlap"]!.push({ where: `${a}+${b}`, detail: `${q(di.names.get(a) ?? a)} and ${q(di.names.get(b) ?? b)} are drawn on top of each other. Move one.` });
  }
  for (const [eid, sid] of edgesThroughShapes(di)) {
    out["edge-through-shape"]!.push({
      where: `${eid}/${sid}`,
      detail: `flow ${eid} is drawn through ${q(di.names.get(sid) ?? sid)}, which it neither leaves nor enters. Route it around the box.`,
    });
  }
  for (const [eid, sid] of edgesThroughOwnEnds(di)) {
    out["edge-through-own-end"]!.push({
      where: `${eid}/${sid}`,
      detail: `flow ${eid} is drawn through ${q(di.names.get(sid) ?? sid)}, its own ${di.flows.get(eid)?.source === sid ? "source" : "target"}: ` +
        `its waypoints were laid for a box of another size. Start it on the side of the box it leaves and end it on the side it enters.`,
    });
  }
  for (const [eid, sid] of detachedEdges(di)) {
    out["edge-detached"]!.push({
      where: `${eid}/${sid}`,
      detail: `flow ${eid} ${di.flows.get(eid)?.source === sid ? "starts" : "ends"} more than ${END_SLACK} from ${q(di.names.get(sid) ?? sid)}. Move that waypoint onto the box's edge.`,
    });
  }
  for (const [a, b, sid] of sharedPorts(di)) {
    out["edge-shared-port"]!.push({
      where: `${a}+${b}/${sid}`,
      detail: `flow ${a} ends on ${q(di.names.get(sid) ?? sid)} at the point flow ${b} leaves it, so the two read as one line. ` +
        `Give the outgoing flow another side of the box (bpmn-processes §"Edge routing").`,
    });
  }
  for (const id of shapesOutsidePools(di)) {
    out["shape-outside-pool"]!.push({ where: id, detail: `${q(di.names.get(id) ?? id)} is drawn outside its pool. Move it inside its lane, or widen the pool and its lanes to hold it.` });
  }
  const best = bestLaneOrder(di);
  if (best.cost < best.current) {
    const name = (id: string): string => di.names.get(id) ?? id;
    out["lane-order"]!.push({
      where: "lanes",
      detail: `flows cross ${best.current} lane boundaries; ordering the lanes ${best.order.map(name).join(" / ")} makes it ${best.cost}. ` +
        `Run \`bun run cat bpmn:detangle <file> --write\`.`,
    });
  }
  return out;
}
