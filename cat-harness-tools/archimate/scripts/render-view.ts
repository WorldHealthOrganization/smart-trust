/**
 * Draw one ArchiMate view as SVG, from the model's own diagram: the bounds
 * Archi stored for every box, and the bendpoints it stored for every line.
 *
 * @module cat-harness/archimate/scripts/render-view
 * @covers archimate
 *
 * ## Why here, and not Archi's own report
 *
 * Archi's HTML report draws views too, but it needs the tool itself — a JVM,
 * a virtual display and a 200 MB download per CI run — and what it draws is a
 * raster nobody can link into. This draws from the same coordinates, with no
 * tool, into SVG whose every box links to its element's page. It is a
 * rendering OF the model, never a copy kept beside it: regenerated on every
 * build, so a change made in Archi shows on the next one.
 *
 * ## The notation, as far as it is drawn
 *
 * ArchiMate 3.2's colours per layer (Archi's defaults, which every view in
 * the WHO models was drawn in), its shapes by aspect — square for structure,
 * rounded for behaviour, a pill for a service, a clipped corner for a
 * motivation element — and its relationship lines with their own ends. Each
 * box carries its type as a small label in its corner, not Archi's icons:
 * the icons are the tool's artwork, not the notation's. A box whose element
 * the model does not hold is drawn hatched and named as missing, never
 * dropped, so a broken reference shows where it is.
 *
 * A box drawn inside another already says how the two relate: ArchiMate's
 * nesting notation. So a connection between a box and one that encloses it is
 * not drawn, as Archi does by default for the relationships nesting stands
 * for. Drawn, it runs from the inner box to the outer box's centre, which lies
 * inside or beside the inner box: its arrowhead lands in the middle of a box
 * and the line cuts across the boxes around it. The element pages still list
 * the relationship.
 *
 * Archi stores a bendpoint twice: as an offset from the source's centre and
 * from the target's. The two agree when the line was routed; when a box was
 * moved afterwards they no longer do, and the blend of the two (what Archi
 * draws) twists the line back on itself. Such a line is drawn straight. Two or
 * more straight lines between the same pair of boxes are drawn side by side,
 * not on top of each other. A line whose bendpoints make it orthogonal is
 * drawn with rounded corners (`linePath`), and a line's label sits on its
 * longest straight run, clear of the other labels.
 *
 * A view with nothing on it says so, rather than drawing an empty frame.
 *
 * Every string from the model is escaped: the model is its authors', and a
 * name is text, never markup.
 */
import type { ArchimateElement, ArchimateLayer, ArchimateModel, ArchimateRelationship, ArchimateView, ArchimateViewConnection, ArchimateViewNode } from "../schemas/archimate.ts";

// The layer colours and outlines are the shared figure theme's (figure-theme.ts).
import { LAYER_FILL, outlineOf, bandColours, THEME, HANDBOOK } from "./figure-theme.ts";
export { LAYER_FILL, outlineOf };

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** `ApplicationComponent` → `Application Component`. */
export const typeLabel = (type: string): string => type.replace(/([a-z])([A-Z])/g, "$1 $2");

const FONT = 11;
const CHAR_W = FONT * 0.56;
const LINE_H = FONT * 1.25;

/** Greedy word wrap to a width, by an average glyph width. */
export function wrap(text: string, width: number, maxLines: number): string[] {
  const per = Math.max(4, Math.floor(width / CHAR_W));
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= per) line = next;
      else {
        if (line) lines.push(line);
        line = word.length > per ? `${word.slice(0, per - 1)}…` : word;
      }
    }
    lines.push(line);
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/…$/, "").slice(0, per - 1)}…`;
    return kept;
  }
  return lines;
}

/** How an element's box is outlined: square, rounded, a pill, or a clipped corner. */
type Shape = "rect" | "round" | "pill" | "clipped" | "junction";
function shapeOf(e: ArchimateElement | undefined): Shape {
  if (!e) return "rect";
  if (e.type === "Junction") return "junction";
  if (e.layer === "Motivation") return "clipped";
  if (/Service$/.test(e.type) || e.type === "ValueStream") return "pill";
  if (/(Process|Function|Interaction|Event)$/.test(e.type) || /^(Capability|CourseOfAction|WorkPackage)$/.test(e.type)) return "round";
  return "rect";
}

function box(n: ArchimateViewNode, shape: ReturnType<typeof shapeOf>, fill: string, extra: string): string {
  const { x, y, w, h } = n;
  if (shape === "pill") return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(h / 2, w / 2)}" fill="${fill}"${extra}/>`;
  if (shape === "round") return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"${extra}/>`;
  if (shape === "clipped") {
    const c = Math.min(10, w / 4, h / 4);
    const pts = [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]];
    return `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="${fill}"${extra}/>`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
}

function textBlock(lines: string[], cx: number, top: number, cls: string): string {
  return (
    `<text class="${cls}" x="${cx}" y="${top + FONT}" text-anchor="middle">` +
    lines.map((l, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : LINE_H}">${esc(l)}</tspan>`).join("") +
    `</text>`
  );
}

export type Pt = { x: number; y: number };
const centre = (n: ArchimateViewNode): Pt => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

/** Where the segment from a box's centre towards `p` leaves the box. */
function clip(n: ArchimateViewNode, toward: Pt): Pt;
/** Where the segment from `from` (inside the box) towards `toward` leaves the box. */
function clip(n: ArchimateViewNode, from: Pt, toward: Pt): Pt;
function clip(n: ArchimateViewNode, a: Pt, b?: Pt): Pt {
  if (b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const tx = dx > 0 ? (n.x + n.w - a.x) / dx : dx < 0 ? (n.x - a.x) / dx : Infinity;
    const ty = dy > 0 ? (n.y + n.h - a.y) / dy : dy < 0 ? (n.y - a.y) / dy : Infinity;
    const t = Math.min(tx, ty, 1);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }
  const toward = a;
  const c = centre(n);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const sx = dx === 0 ? Infinity : n.w / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : n.h / 2 / Math.abs(dy);
  const s = Math.min(sx, sy, 1);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

/** The ends and line style each relationship type is drawn with. */
function lineStyle(r: ArchimateRelationship | undefined): { start?: string; end?: string; dash?: string } {
  switch (r?.type) {
    case "Composition":
      return { start: "diamond-filled" };
    case "Aggregation":
      return { start: "diamond-hollow" };
    case "Assignment":
      return { start: "dot", end: "arrow-filled" };
    case "Realization":
      return { end: "triangle-hollow", dash: "6 4" };
    case "Serving":
      return { end: "arrow-open" };
    case "Access": {
      const a = r.accessType ?? "write";
      return { dash: "2 3", ...(a === "write" || a === "readwrite" ? { end: "arrow-small" } : {}), ...(a === "read" || a === "readwrite" ? { start: "arrow-small" } : {}) };
    }
    case "Influence":
      return { end: "arrow-open", dash: "6 4" };
    case "Triggering":
      return { end: "arrow-filled" };
    case "Flow":
      return { end: "arrow-filled", dash: "8 4" };
    case "Specialization":
      return { end: "triangle-hollow" };
    case "Association":
      return r.directed ? { end: "arrow-small" } : {};
    default:
      return {};
  }
}

/** How far apart, in px, a bendpoint's two stored positions may be before the line counts as stale. */
const STALE = 40;
/** The gap between side-by-side lines joining the same two boxes. */
const PARALLEL_GAP = 8;
/** How far, in px, two bendpoints may be off a shared x or y and still be drawn as one straight run. */
const SNAP = 12;
/** How far inside a box's edge a square-on end must stay, so it never meets the box at a corner. */
const INSET = 6;
/** How much two boxes' x (or y) ranges must overlap for a line between them to be drawn straight across. */
const OVERLAP = 2 * INSET;

const MARKERS = `<defs>
<marker id="arrow-open" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 1 L11 6 L1 11" fill="none" stroke="#333" stroke-width="1.3"/></marker>
<marker id="arrow-filled" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 1 L11 6 L1 11 Z" fill="#333"/></marker>
<marker id="arrow-small" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="#333" stroke-width="1.2"/></marker>
<marker id="triangle-hollow" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="13" markerHeight="13" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 1 L13 7 L1 13 Z" fill="#fff" stroke="#333" stroke-width="1.2"/></marker>
<marker id="diamond-filled" viewBox="0 0 16 10" refX="1" refY="5" markerWidth="16" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 5 L8 1 L15 5 L8 9 Z" fill="#333"/></marker>
<marker id="diamond-hollow" viewBox="0 0 16 10" refX="1" refY="5" markerWidth="16" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 5 L8 1 L15 5 L8 9 Z" fill="#fff" stroke="#333" stroke-width="1.2"/></marker>
<marker id="dot" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse"><circle cx="4" cy="4" r="3.2" fill="#333"/></marker>
<pattern id="missing" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#fff"/><line x1="0" y1="0" x2="0" y2="8" stroke="#d33" stroke-width="2"/></pattern>
</defs>`;

const STYLE = `<style>
.av-name{font:600 ${FONT}px system-ui,-apple-system,"Segoe UI",sans-serif;fill:#111}
.av-type{font:italic 8px system-ui,sans-serif;fill:#555}
.av-group{font:600 ${FONT}px system-ui,sans-serif;fill:#333}
.av-note{font:${FONT - 1}px system-ui,sans-serif;fill:#222}
.av-key{font:11px system-ui,sans-serif;fill:#222}
.av-keyh{font:600 11px system-ui,sans-serif;fill:#333}
.av-keyt{font:700 13px system-ui,sans-serif;fill:#111}
.av-rel{font:9px system-ui,sans-serif;fill:#333;paint-order:stroke;stroke:#fff;stroke-width:3px}
a:hover rect,a:hover polygon,a:focus rect,a:focus polygon{stroke:#06c;stroke-width:2.5}
</style>`;

export interface RenderOptions {
  /** The href a box links to, given its element's id; absent, boxes are not links. */
  elementHref?: (elementId: string) => string;
  /** The href a relationship line links to; absent, lines are not links. */
  relationshipHref?: (relationshipId: string) => string;
  /** The href a view-reference box links to. */
  viewHref?: (viewId: string) => string;
  /** Draw a key below the view: what each colour, shape and line used in it means (`legendSvg`). Default true. */
  legend?: boolean;
  /**
   * `poster` (the default): the shared figure theme (`figure-theme.ts`) — a
   * title banner, and each grouping a band tinted in the hue of the layer most
   * of its boxes belong to, under a deep header strip. Box fills stay the
   * ArchiMate layer colours either way. `plain`: grey groupings, no banner.
   * `handbook`: close to a printed handbook figure, for a figure redrawn from
   * a printed source (`HANDBOOK` in figure-theme.ts). It draws white boxes with teal
   * outlines and no type label, pale panels with teal headings, and the title in
   * ink above.
   */
  theme?: "poster" | "plain" | "handbook";
}

/** One view as a standalone SVG document. */
export function renderViewSvg(model: ArchimateModel, view: ArchimateView, opts: RenderOptions = {}): string {
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const relationships = new Map(model.relationships.map((r) => [r.id, r]));
  const views = new Map(model.views.map((v) => [v.id, v]));

  const pad = 20;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };
  for (const n of view.nodes) {
    grow(n.x, n.y);
    grow(n.x + n.w, n.y + n.h);
  }
  const out: string[] = [];
  // What the view uses, for its key: only what a reader can see on it.
  const nodes = new Map(view.nodes.map((n) => [n.id, n]));
  const used = { layers: new Set<ArchimateLayer>(), shapes: new Set<Shape>(), relationships: new Set<string>(), groups: false, notes: false, nested: false, viewRefs: false };
  const hb = opts.theme === "handbook";
  const poster = opts.theme !== "plain" && !hb;
  // Handbook look: how many grouping boxes enclose a node (0 = outermost).
  const isGroupish = (id: string): boolean => {
    const n = nodes.get(id);
    return !!n && (n.kind === "group" || (n.kind === "element" && elements.get(n.ref ?? "")?.type === "Grouping"));
  };
  const depthOf = (id: string): number => {
    let d = 0;
    for (let p = nodes.get(id)?.parent; p; p = nodes.get(p)?.parent) if (isGroupish(p)) d++;
    return d;
  };
  // A panel as the handbook prints it: outer ones pale with an upper-case heading,
  // inner ones white with a small centred heading.
  const hbPanel = (n: ArchimateViewNode, label: string): string => {
    const d = depthOf(n.id);
    const fill = d === 0 ? HANDBOOK.panel : HANDBOOK.box;
    const head = d < 2
      ? `<text class="av-group" x="${n.x + 12}" y="${n.y + FONT + 9}" style="fill:${HANDBOOK.tealText};font-weight:700;letter-spacing:.06em">${esc(wrap(label.toUpperCase(), n.w - 24, 1)[0] ?? "")}</text>`
      : `<text class="av-group" x="${n.x + n.w / 2}" y="${n.y + FONT + 7}" text-anchor="middle" style="fill:${HANDBOOK.tealText};font-weight:400">${esc(wrap(label, n.w - 16, 1)[0] ?? "")}</text>`;
    return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${d === 0 ? 12 : 9}" fill="${fill}" stroke="${HANDBOOK.teal}" stroke-width="${d < 2 ? 1.8 : 1}"/>` + head;
  };
  // A grouping's hue: the layer fill most of the boxes inside it (at any depth) have.
  const kids = new Map<string, string[]>();
  for (const n of view.nodes) if (n.parent) kids.set(n.parent, [...(kids.get(n.parent) ?? []), n.id]);
  const hueOf = (id: string): string => {
    const count = new Map<string, number>();
    const walk = (k: string) => {
      for (const c of kids.get(k) ?? []) {
        const e = elements.get(nodes.get(c)?.ref ?? "");
        if (e && nodes.get(c)?.kind === "element") count.set(LAYER_FILL[e.layer], (count.get(LAYER_FILL[e.layer]) ?? 0) + 1);
        walk(c);
      }
    };
    walk(id);
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "#e2e8f0";
  };
  if (!Number.isFinite(minX)) {
    minX = 0; minY = 0; maxX = 360; maxY = 60;
    out.push(`<text class="av-note" x="180" y="34" text-anchor="middle">This view is empty: the model draws nothing on it.</text>`);
  }

  for (const n of view.nodes) {
    if (n.parent && nodes.get(n.parent)?.kind === "element" && n.kind === "element") used.nested = true;
    if (n.kind === "group" && hb) {
      used.groups = true;
      out.push(`<g class="av-g">${hbPanel(n, n.text ?? "")}</g>`);
    } else if (n.kind === "group" && poster) {
      used.groups = true;
      const c = bandColours(hueOf(n.id));
      const hh = LINE_H + 8;
      out.push(
        `<g class="av-g"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" fill="${c.ground}" stroke="${c.stroke}" stroke-width="1.2"/>` +
          `<path d="M${n.x} ${n.y + 6} a6 6 0 0 1 6 -6 h${n.w - 12} a6 6 0 0 1 6 6 v${hh - 6} h${-n.w} z" fill="${c.header}"/>` +
          `<text class="av-group" x="${n.x + 8}" y="${n.y + FONT + 5}" style="fill:#fff">${esc(wrap(n.text ?? "", n.w - 16, 1)[0] ?? "")}</text></g>`,
      );
    } else if (n.kind === "group") {
      used.groups = true;
      const fill = n.fill ?? "#f2f2f2";
      out.push(
        `<g class="av-g"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="${esc(fill)}" fill-opacity=".55" stroke="#888"/>` +
          `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${LINE_H + 6}" fill="${esc(fill)}" stroke="#888"/>` +
          `<text class="av-group" x="${n.x + 6}" y="${n.y + FONT + 3}">${esc(wrap(n.text ?? "", n.w - 12, 1)[0] ?? "")}</text></g>`,
      );
    } else if (n.kind === "note") {
      used.notes = true;
      const f = 10;
      const pts = [[n.x, n.y], [n.x + n.w - f, n.y], [n.x + n.w, n.y + f], [n.x + n.w, n.y + n.h], [n.x, n.y + n.h]];
      const lines = wrap(n.text ?? "", n.w - 12, Math.max(1, Math.floor((n.h - 8) / LINE_H)));
      out.push(
        `<g class="av-n"><polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="${esc(n.fill ?? "#ffffff")}" stroke="#888"/>` +
          `<text class="av-note" x="${n.x + 6}" y="${n.y + FONT + 4}">` +
          lines.map((l, i) => `<tspan x="${n.x + 6}" dy="${i === 0 ? 0 : LINE_H}">${esc(l)}</tspan>`).join("") +
          `</text></g>`,
      );
    } else if (n.kind === "view-ref") {
      used.viewRefs = true;
      const v = views.get(n.ref ?? "");
      const label = v?.name ?? "(missing view)";
      const shape = `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="#dcdcdc" stroke="#555"/>` + textBlock(wrap(label, n.w - 10, 3), n.x + n.w / 2, n.y + 6, "av-name");
      out.push(v && opts.viewHref ? `<a href="${esc(opts.viewHref(v.id))}" target="_top"><title>View: ${esc(label)}</title>${shape}</a>` : `<g>${shape}</g>`);
    } else {
      const e = elements.get(n.ref ?? "");
      const shape = shapeOf(e);
      if (shape === "junction") {
        const c = centre(n);
        out.push(`<circle cx="${c.x}" cy="${c.y}" r="${Math.min(n.w, n.h) / 2}" fill="#000"/>`);
        continue;
      }
      if (hb && e?.type === "Grouping") {
        used.groups = true;
        const title = `<title>${esc(e.name)} (Grouping)</title>`;
        const body = hbPanel(n, e.name);
        out.push(opts.elementHref ? `<a href="${esc(opts.elementHref(e.id))}" target="_top">${title}${body}</a>` : `<g>${title}${body}</g>`);
        continue;
      }
      if (poster && e?.type === "Grouping") {
        // A Grouping element is drawn as a band, like a diagram group, and still links to its page.
        used.groups = true;
        const c = bandColours(hueOf(n.id));
        const hh = LINE_H + 8;
        const body =
          `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" fill="${c.ground}" stroke="${c.stroke}" stroke-width="1.2" stroke-dasharray="6 3"/>` +
          `<path d="M${n.x} ${n.y + 6} a6 6 0 0 1 6 -6 h${n.w - 12} a6 6 0 0 1 6 6 v${hh - 6} h${-n.w} z" fill="${c.header}"/>` +
          `<text class="av-group" x="${n.x + 8}" y="${n.y + FONT + 5}" style="fill:#fff">${esc(wrap(e.name, n.w - 16, 1)[0] ?? "")}</text>`;
        const title = `<title>${esc(e.name)} (Grouping)</title>`;
        out.push(opts.elementHref ? `<a href="${esc(opts.elementHref(e.id))}" target="_top">${title}${body}</a>` : `<g>${title}${body}</g>`);
        continue;
      }
      if (e) {
        if (!hb) used.layers.add(e.layer);
        used.shapes.add(shape);
      }
      const fill = e ? (hb ? HANDBOOK.box : n.fill ?? LAYER_FILL[e.layer]) : "url(#missing)";
      const name = e ? e.name : "(element missing from the model)";
      const type = e ? typeLabel(e.type) : "";
      const lines = wrap(name, n.w - 10, Math.max(1, Math.floor((n.h - 14) / LINE_H)));
      const body =
        box(n, shape, esc(fill), ` stroke="${e ? (hb ? HANDBOOK.teal : outlineOf(fill)) : "#d33"}" stroke-width="1"`) +
        (type && !hb ? `<text class="av-type" x="${n.x + n.w - (shape === "pill" ? n.h / 3 : shape === "clipped" ? 9 : 5)}" y="${n.y + 10}" text-anchor="end">${esc(type)}</text>` : "") +
        textBlock(lines, n.x + n.w / 2, hb ? n.y + Math.max(8, (n.h - lines.length * LINE_H) / 2) : n.y + 12, hb ? "av-name av-hb" : "av-name");
      const title = `<title>${esc(name)}${type ? ` (${esc(type)})` : ""}</title>`;
      out.push(e && opts.elementHref ? `<a href="${esc(opts.elementHref(e.id))}" target="_top">${title}${body}</a>` : `<g>${title}${body}</g>`);
    }
  }

  // Lines over boxes, each along its route (`routeConnections`).
  const labels: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  for (const { connection: c, pts, half } of routeConnections(view)) {
    for (const p of pts) grow(p.x, p.y);
    const r = c.relationship ? relationships.get(c.relationship) : undefined;
    if (r) used.relationships.add(r.type);
    const st = lineStyle(r);
    const d = linePath(pts);
    const line =
      `<path d="${d}" fill="none" stroke="#333" stroke-width="1.2"${st.dash ? ` stroke-dasharray="${st.dash}"` : ""}` +
      `${st.start ? ` marker-start="url(#${st.start})"` : ""}${st.end ? ` marker-end="url(#${st.end})"` : ""}/>` +
      // A wide transparent twin, so a thin line is easy to point at.
      `<path d="${d}" fill="none" stroke="transparent" stroke-width="8"/>`;
    const label = [r?.name, r?.type === "Influence" ? r.strength : undefined].filter(Boolean).join(" ");
    const at = label ? labelAt(pts, half, label, labels) : half;
    const text = label ? `<text class="av-rel" x="${round(at.x)}" y="${round(at.y - 3)}" text-anchor="middle">${esc(label)}</text>` : "";
    const title = r ? `<title>${esc(typeLabel(r.type))}${r.name ? `: ${esc(r.name)}` : ""}</title>` : "";
    out.push(r && opts.relationshipHref ? `<a href="${esc(opts.relationshipHref(r.id))}" target="_top">${title}${line}${text}</a>` : `<g>${title}${line}${text}</g>`);
  }

  if (opts.legend !== false && Number.isFinite(maxY)) {
    const key = legendSvg(used, minX, maxY + 28, hb ? "handbook" : poster);
    if (key.h > 0) {
      out.push(key.svg);
      grow(minX + key.w, maxY + 28 + key.h);
    }
  }

  const banner = poster || hb ? 52 : 0;
  const vx = Math.floor(minX - pad);
  const vy = Math.floor(minY - pad - banner);
  const vw = Math.ceil(maxX - minX + 2 * pad);
  const vh = Math.ceil(maxY - minY + 2 * pad + banner);
  const head = hb
    ? `<text x="${vx + pad}" y="${vy + 28}" style="font:700 18px ${esc(THEME.font)};fill:${HANDBOOK.ink}">${esc(view.name)}</text>` +
      `<text x="${vx + pad}" y="${vy + 44}" style="font:italic 10px ${esc(THEME.font)};fill:${HANDBOOK.muted}">Drawn from the ArchiMate model “${esc(model.name)}”</text>`
    : poster
    ? `<rect x="${vx}" y="${vy}" width="${vw}" height="${banner}" fill="${THEME.frame}"/>` +
      `<text x="${vx + pad}" y="${vy + 24}" style="font:700 17px ${esc(THEME.font)};fill:#fff">${esc(view.name)}</text>` +
      `<text x="${vx + pad}" y="${vy + 41}" style="font:italic 10px ${esc(THEME.font)};fill:#c9d6e6">Drawn from the ArchiMate model “${esc(model.name)}”</text>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}" role="img" aria-labelledby="av-title">` +
    `<title id="av-title">${esc(view.name)} — ${esc(model.name)}</title>${poster || hb ? STYLE.replace(/system-ui,-apple-system,"Segoe UI",sans-serif|system-ui,sans-serif/g, THEME.font) : STYLE}${hb ? `<style>.av-hb{font-weight:400;fill:${HANDBOOK.ink}}</style>` : ""}${MARKERS}` +
    `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${hb ? HANDBOOK.page : poster ? THEME.page : "#fff"}"/>` + head +
    out.join("\n") +
    `</svg>\n`
  );
}

/** The radius of a rounded corner on an orthogonal line. */
const CORNER = 8;

/** The points of a line without repeats: a bendpoint stored on a box's side repeats the clipped end. */
function distinct(pts: readonly Pt[]): Pt[] {
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y) > 0.5);
}

/**
 * A line's SVG path. A line whose every segment is horizontal or vertical
 * (an orthogonal route, as a router writes it) is drawn with its corners
 * rounded, each by up to CORNER px and never more than half of either
 * segment beside it; any other line is drawn straight from point to point, as
 * before. Repeated points are dropped first, so no segment is of zero length
 * and an arrowhead always takes the direction of the segment it ends.
 */
export function linePath(raw: readonly Pt[]): string {
  const pts = distinct(raw);
  const xy = (p: Pt) => `${round(p.x)} ${round(p.y)}`;
  const orthogonal = pts.length > 2 && pts.every((p, i) => i === 0 || Math.abs(p.x - pts[i - 1]!.x) < 0.5 || Math.abs(p.y - pts[i - 1]!.y) < 0.5);
  if (!orthogonal) return `M${pts.map(xy).join(" L")}`;
  let d = `M${xy(pts[0]!)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]!, p = pts[i]!, b = pts[i + 1]!;
    const la = Math.hypot(p.x - a.x, p.y - a.y), lb = Math.hypot(b.x - p.x, b.y - p.y);
    const r = Math.min(CORNER, la / 2, lb / 2);
    const p1 = { x: p.x + ((a.x - p.x) / la) * r, y: p.y + ((a.y - p.y) / la) * r };
    const p2 = { x: p.x + ((b.x - p.x) / lb) * r, y: p.y + ((b.y - p.y) / lb) * r };
    d += ` L${xy(p1)} Q${xy(p)} ${xy(p2)}`;
  }
  return `${d} L${xy(pts[pts.length - 1]!)}`;
}

/** The corner points of a line: repeats dropped, and points in the middle of a straight run merged into it. */
function runs(raw: readonly Pt[]): Pt[] {
  const pts = distinct(raw);
  return pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return true;
    const a = pts[i - 1]!, b = pts[i + 1]!;
    return Math.abs((p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)) > 0.5;
  });
}

type Rect = { x0: number; y0: number; x1: number; y1: number };
const labelRect = (p: Pt, text: string): Rect => {
  const w = text.length * 5 + 6;
  return { x0: p.x - w / 2, y0: p.y - 13, x1: p.x + w / 2, y1: p.y - 1 };
};
const overlaps = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Where a line's label goes: on its longest straight run, at the first of a
 * few places along it (the middle first) that is clear of the labels already
 * placed in the view, else at that run's middle. The rectangle it takes is
 * added to `placed`.
 */
function labelAt(raw: readonly Pt[], fallback: Pt, text: string, placed: Rect[]): Pt {
  const pts = runs(raw);
  const segs = pts.slice(1).map((b, i) => ({ a: pts[i]!, b, l: Math.hypot(b.x - pts[i]!.x, b.y - pts[i]!.y) })).sort((p, q) => q.l - p.l);
  let at = segs[0] ? { x: (segs[0].a.x + segs[0].b.x) / 2, y: (segs[0].a.y + segs[0].b.y) / 2 } : fallback;
  search: for (const { a, b } of segs) {
    for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      const p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      if (!placed.some((r) => overlaps(r, labelRect(p, text)))) { at = p; break search; }
    }
  }
  placed.push(labelRect(at, text));
  return at;
}

/** A connection as drawn: the points of its line, ends clipped to the boxes, and its midpoint. */
export interface RoutedConnection {
  connection: ArchimateViewConnection;
  pts: Pt[];
  half: Pt;
}

/**
 * Every connection of a view along the route it is drawn with: Archi's
 * bendpoints where they are current, else straight, with lines that share
 * both ends set side by side. A connection may end on another connection (a
 * relationship on a relationship): that end is the other line's midpoint,
 * unclipped. A line between a box and one drawn inside it is not routed, as
 * the nesting shows it. One routing, shared by the drawing and by the
 * crossing count (`archimate-crossings.ts`), so what is counted is what is drawn.
 */
export function routeConnections(view: ArchimateView): RoutedConnection[] {
  const nodes = new Map(view.nodes.map((n) => [n.id, n]));
  const within = (inner: string, outer: string): boolean => {
    for (let p = nodes.get(inner)?.parent, seen = 0; p && seen < 64; p = nodes.get(p)?.parent, seen++) if (p === outer) return true;
    return false;
  };
  const routed: RoutedConnection[] = [];
  const mid = new Map<string, Pt>();
  const ends = (id: string): { at: Pt; node?: ArchimateViewNode } | undefined => {
    const n = nodes.get(id);
    if (n) return { at: centre(n), node: n };
    const m = mid.get(id);
    return m ? { at: m } : undefined;
  };
  const pending = view.connections.filter((c) => !within(c.source, c.target) && !within(c.target, c.source));
  // Straight lines per pair of boxes, so lines sharing both ends sit side by side.
  const pairKey = (a: string, b: string) => (a < b ? `${a} ${b}` : `${b} ${a}`);
  const stale = (c: (typeof pending)[number]): boolean => {
    const s = nodes.get(c.source), t = nodes.get(c.target);
    if (!s || !t) return false;
    const cs = centre(s), ct = centre(t);
    return c.bendpoints.some((b) => Math.hypot(cs.x + b.startX - ct.x - b.endX, cs.y + b.startY - ct.y - b.endY) > STALE);
  };
  const taken = new Map<string, number[]>();
  const straight = new Map<string, string[]>();
  for (const c of pending) {
    if (c.bendpoints.length && !stale(c)) continue;
    const key = pairKey(c.source, c.target);
    straight.set(key, [...(straight.get(key) ?? []), c.id]);
  }
  for (let guard = 0; pending.length && guard < 4; guard++) {
    for (let i = 0; i < pending.length; ) {
      const c = pending[i]!;
      const s = ends(c.source);
      const t = ends(c.target);
      if (!s || !t) { i++; continue; }
      pending.splice(i, 1);
      const route = stale(c) ? [] : c.bendpoints;
      const k = route.length;
      const bends = route.map((b, j) => {
        const wgt = (j + 1) / (k + 1);
        return { x: (1 - wgt) * (s.at.x + b.startX) + wgt * (t.at.x + b.endX), y: (1 - wgt) * (s.at.y + b.startY) + wgt * (t.at.y + b.endY) };
      });
      const [a, inner, z] = squareUp(s, t, bends, taken);
      const pts = [a, ...inner, z].map((p) => ({ ...p }));
      const twins = k === 0 ? straight.get(pairKey(c.source, c.target)) ?? [] : [];
      if (twins.length > 1) {
        // Shift sideways along the normal of the pair's own direction, so a line
        // and its reverse move apart rather than together.
        const [p, q] = c.source < c.target ? [a, z] : [z, a];
        const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const off = (twins.indexOf(c.id) - (twins.length - 1) / 2) * PARALLEL_GAP;
        const nx = (-(q.y - p.y) / len) * off, ny = ((q.x - p.x) / len) * off;
        for (const pt of pts) { pt.x += nx; pt.y += ny; }
      }
      const half = pts.length % 2 === 1 ? pts[(pts.length - 1) / 2]! : { x: (pts[pts.length / 2 - 1]!.x + pts[pts.length / 2]!.x) / 2, y: (pts[pts.length / 2 - 1]!.y + pts[pts.length / 2]!.y) / 2 };
      mid.set(c.id, half);
      routed.push({ connection: c, pts, half });
    }
  }
  return routed;
}

const inside = (n: ArchimateViewNode, p: Pt, m = 0): boolean => p.x >= n.x - m && p.x <= n.x + n.w + m && p.y >= n.y - m && p.y <= n.y + n.h + m;

/**
 * Where a line leaves box `n` heading for `p`: square-on where it can be. When
 * `p` lies above or below the box, within its x range, the line leaves the top
 * or bottom edge at `p`'s x; beside it, within its y range, the left or right
 * edge at `p`'s y. Otherwise it is clipped towards `p` from the centre, as
 * before.
 */
function attach(n: ArchimateViewNode, p: Pt): Pt {
  const inX = p.x >= n.x + INSET && p.x <= n.x + n.w - INSET;
  const inY = p.y >= n.y + INSET && p.y <= n.y + n.h - INSET;
  if (inX && !inY) return { x: p.x, y: p.y < n.y ? n.y : n.y + n.h };
  if (inY && !inX) return { x: p.x < n.x ? n.x : n.x + n.w, y: p.y };
  return clip(n, p);
}

/** The overlap of [a0, a1] and [b0, b1], kept INSET clear of either end, if it is at least OVERLAP long. */
function overlapOf(a0: number, a1: number, b0: number, b1: number): [number, number] | undefined {
  const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
  return hi - lo >= OVERLAP ? [lo + INSET, hi - INSET] : undefined;
}

/**
 * Where in [lo, hi] a straight-across line runs: the middle, else the nearest
 * place PARALLEL_GAP·2 clear of the lines already run across the same axis
 * into either box (`taken`), so two lines into one box never lie on top of
 * each other.
 */
function freeSpot(lo: number, hi: number, taken: readonly number[]): number {
  const mid = (lo + hi) / 2;
  const gap = PARALLEL_GAP * 2;
  for (let step = 0; step <= (hi - lo) / gap + 1; step++) {
    for (const c of step ? [mid - step * gap, mid + step * gap] : [mid]) {
      if (c < lo || c > hi) continue;
      if (taken.every((u) => Math.abs(u - c) >= gap)) return c;
    }
  }
  return mid;
}

/**
 * A line's two ends and the bends between them, straightened (cat-harness-tools#1886):
 * bends lying inside an end box are dropped; bends a few px off a shared x or y
 * (as Archi stores them) are snapped onto it; each end meets its box square-on
 * where the next point allows; and a line with no bends between boxes whose x
 * (or y) ranges overlap runs vertically (horizontally) through the overlap.
 */
function squareUp(s: { at: Pt; node?: ArchimateViewNode }, t: { at: Pt; node?: ArchimateViewNode }, raw: readonly Pt[], taken: Map<string, number[]> = new Map()): [Pt, Pt[], Pt] {
  const bends = raw.filter((b) => !(s.node && inside(s.node, b)) && !(t.node && inside(t.node, b))).map((b) => ({ ...b }));
  for (let i = 1; i < bends.length; i++) {
    const p = bends[i - 1]!, q = bends[i]!;
    if (Math.abs(q.x - p.x) < SNAP && Math.abs(q.x - p.x) <= Math.abs(q.y - p.y)) q.x = p.x;
    else if (Math.abs(q.y - p.y) < SNAP) q.y = p.y;
  }
  if (!bends.length && s.node && t.node) {
    const sn = s.node, tn = t.node;
    const ox = overlapOf(sn.x, sn.x + sn.w, tn.x, tn.x + tn.w);
    const oy = overlapOf(sn.y, sn.y + sn.h, tn.y, tn.y + tn.h);
    // Claim a spot on both boxes along the line's axis.
    const spot = (axis: "x" | "y", [lo, hi]: [number, number]): number => {
      const keys = [`${sn.id} ${axis}`, `${tn.id} ${axis}`];
      const c = freeSpot(lo, hi, keys.flatMap((k) => taken.get(k) ?? []));
      for (const k of keys) taken.set(k, [...(taken.get(k) ?? []), c]);
      return c;
    };
    if (ox && !oy) {
      const x = spot("x", ox);
      const down = tn.y > sn.y;
      return [{ x, y: down ? sn.y + sn.h : sn.y }, [], { x, y: down ? tn.y : tn.y + tn.h }];
    }
    if (oy && !ox) {
      const y = spot("y", oy);
      const right = tn.x > sn.x;
      return [{ x: right ? sn.x + sn.w : sn.x, y }, [], { x: right ? tn.x : tn.x + tn.w, y }];
    }
    if (!ox && !oy) {
      // Apart on both axes: corner to facing corner (each INSET in), so the
      // line keeps to the outside and does not cut across the lines that leave
      // the boxes' sides square-on.
      const near = (n: ArchimateViewNode, o: ArchimateViewNode): Pt => ({
        x: o.x > n.x + n.w ? n.x + n.w - INSET : n.x + INSET,
        y: o.y > n.y + n.h ? n.y + n.h - INSET : n.y + INSET,
      });
      const a = near(sn, tn), z = near(tn, sn);
      return [clip(sn, a, z), [], clip(tn, z, a)];
    }
  }
  const first = bends[0] ?? t.at;
  const last = bends[bends.length - 1] ?? s.at;
  const a = s.node ? (bends.length ? attach(s.node, first) : clip(s.node, first)) : s.at;
  const z = t.node ? (bends.length ? attach(t.node, last) : clip(t.node, last)) : t.at;
  // An end that came out square-on pulls its neighbouring bend onto its line,
  // so the leg into the box is exactly horizontal or vertical.
  if (bends.length) {
    const fix = (end: Pt, b: Pt, n?: ArchimateViewNode) => {
      if (!n) return;
      if (end.x === b.x || end.y === b.y) return;
      if (Math.abs(end.x - b.x) < SNAP) b.x = end.x;
      else if (Math.abs(end.y - b.y) < SNAP) b.y = end.y;
    };
    fix(a, bends[0]!, s.node);
    fix(z, bends[bends.length - 1]!, t.node);
    // Record a square-on end, so a straight line drawn later into the same box keeps clear of it.
    const claim = (end: Pt, b: Pt, n?: ArchimateViewNode) => {
      if (!n) return;
      const axis = end.x === b.x ? "x" : end.y === b.y ? "y" : undefined;
      if (axis) taken.set(`${n.id} ${axis}`, [...(taken.get(`${n.id} ${axis}`) ?? []), end[axis]]);
    };
    claim(a, bends[0]!, s.node);
    claim(z, bends[bends.length - 1]!, t.node);
  }
  return [a, bends, z];
}

// ── The key ──────────────────────────────────────────────────────────────
//
// Owner, 2026-10-31: "what do various arrows mean? we need legend … also
// what do colors mean … and shapes? … need to assume that most readers not
// familiar with archimate conventions nor our house rules." So every view
// carries its own key, in plain words, listing only what it uses.

/** What each layer's colour says, for a reader who has never seen ArchiMate. */
export const LAYER_MEANING: Record<ArchimateLayer, string> = {
  Motivation: "Why: who cares (stakeholders), and the drivers, goals, outcomes, values and requirements",
  Strategy: "Strategy: what the organisation is able to do (capabilities) and with what (resources, value streams)",
  Business: "Business: people, roles and organisations, the processes they carry out and the information they use",
  Application: "Software: systems and their parts, the services they offer, and the data they hold",
  Technology: "Technology: the devices, platforms and networks the software runs on",
  Physical: "Physical: equipment, facilities and materials",
  "Implementation & Migration": "Change: work packages, deliverables and the stages of a transition",
  Other: "Other: groupings, locations and junctions",
};
/** What each box shape says. */
export const SHAPE_MEANING: Record<Exclude<Shape, "junction">, string> = {
  rect: "Square corners: something that exists, such as a system, a role, or a piece of data",
  round: "Rounded corners: something done or an ability, such as a capability, process or function",
  pill: "Rounded ends: a service, offered for others to use",
  clipped: "Cut corners: a reason or aim, such as a stakeholder, goal, outcome or value",
};
/** What each kind of line says, read from the line's start to its end. */
export const RELATIONSHIP_MEANING: Record<string, string> = {
  Composition: "is made up of (the end is a part that cannot exist without the start)",
  Aggregation: "groups (the end is a part that can also exist on its own)",
  Assignment: "is assigned to, or carries out",
  Realization: "makes real, or achieves",
  Serving: "serves (provides what the end needs)",
  Access: "reads or writes data (the arrow shows which way the data goes)",
  Influence: "influences, or contributes to",
  Triggering: "triggers (happens first, and starts the end)",
  Flow: "passes something, such as information, to",
  Specialization: "is a kind of",
  Association: "is related to (no more specific meaning)",
};
const RELATIONSHIP_ORDER = ["Realization", "Serving", "Assignment", "Composition", "Aggregation", "Access", "Flow", "Triggering", "Influence", "Specialization", "Association"];
const LAYER_ORDER: ArchimateLayer[] = ["Motivation", "Strategy", "Business", "Application", "Technology", "Physical", "Implementation & Migration", "Other"];

/**
 * The key for one view: a heading, then one row per colour, shape and kind
 * of line the view uses, each in plain words. Drawn at (x, y); returns its
 * size so the drawing can grow to hold it.
 */
export function legendSvg(
  used: { layers: Set<ArchimateLayer>; shapes: Set<Shape>; relationships: Set<string>; groups: boolean; notes: boolean; nested: boolean; viewRefs: boolean },
  x: number,
  y: number,
  poster: boolean | "handbook" = false,
): { svg: string; w: number; h: number } {
  const hb = poster === "handbook";
  const rows: string[] = [];
  const ROW = 20, SW = 44, CHAR = 6.2;
  // The key is as wide as its longest line, so no line runs past the frame.
  let W = 640;
  let cy = y + 30;
  const fit = (left: number, t: string) => { W = Math.max(W, Math.ceil(left + t.length * CHAR)); };
  const text = (t: string) => { fit(SW + 14, t); return `<text class="av-key" x="${x + SW + 14}" y="${cy + 4}">${esc(t)}</text>`; };
  const head = (t: string) => { fit(0, t); rows.push(`<text class="av-keyh" x="${x}" y="${cy + 4}">${esc(t)}</text>`); cy += ROW; };
  const layers = LAYER_ORDER.filter((l) => used.layers.has(l));
  if (layers.length) {
    head("Colour: which part of the architecture a box belongs to");
    for (const l of layers) {
      rows.push(`<rect x="${x}" y="${cy - 7}" width="${SW}" height="14" fill="${LAYER_FILL[l]}" stroke="${outlineOf(LAYER_FILL[l])}"/>` + text(LAYER_MEANING[l]));
      cy += ROW;
    }
  }
  const shapes = (["clipped", "round", "pill", "rect"] as const).filter((sh) => used.shapes.has(sh));
  if (shapes.length) {
    head(hb ? "Shape: what kind of thing a box is (point at a box to see its exact kind)" : "Shape: what kind of thing a box is (its small italic label names the exact kind)");
    for (const sh of shapes) {
      // Taller than a colour swatch, so the corners can be told apart.
      cy += 4;
      rows.push(box({ id: "", kind: "element", x, y: cy - 12, w: SW, h: 24 }, sh, "#fff", ` stroke="${hb ? HANDBOOK.teal : "#555"}"`) + text(SHAPE_MEANING[sh]));
      cy += ROW + 6;
    }
  }
  const extras: Array<[(cy: number) => string, string]> = [];
  if (used.nested) extras.push([(c) => `<rect x="${x}" y="${c - 9}" width="${SW}" height="18" fill="#fff" stroke="#555"/><rect x="${x + 10}" y="${c - 4}" width="${SW - 20}" height="9" fill="#fff" stroke="#555"/>`, "A box inside another box: a part of it"]);
  if (used.groups && hb) extras.push([(c) => `<rect x="${x}" y="${c - 7}" width="${SW}" height="14" rx="4" fill="${HANDBOOK.panel}" stroke="${HANDBOOK.teal}" stroke-width="1.5"/>`, "Panel with a teal outline and heading: a grouping for layout only; it adds no meaning"]);
  else if (used.groups && poster) extras.push([(c) => `<rect x="${x}" y="${c - 7}" width="${SW}" height="14" rx="3" fill="${bandColours("#b5ffff").ground}" stroke="${bandColours("#b5ffff").stroke}"/><rect x="${x}" y="${c - 7}" width="${SW}" height="5" fill="${bandColours("#b5ffff").header}"/>`, "Band with a dark header: a grouping for layout only; it adds no meaning (tinted in the layer most of its boxes belong to)"]);
  else if (used.groups) extras.push([(c) => `<rect x="${x}" y="${c - 7}" width="${SW}" height="14" fill="#f2f2f2" stroke="#888"/>`, "Grey band: a grouping for layout only; it adds no meaning"]);
  if (used.notes) extras.push([(c) => `<polygon points="${x},${c - 7} ${x + SW - 6},${c - 7} ${x + SW},${c - 1} ${x + SW},${c + 7} ${x},${c + 7}" fill="#fff" stroke="#888"/>`, "Note: a comment from the authors"]);
  if (used.viewRefs) extras.push([(c) => `<rect x="${x}" y="${c - 7}" width="${SW}" height="14" fill="#dcdcdc" stroke="#555"/>`, "Dark grey box: a link to another view"]);
  if (extras.length) head("Other marks");
  for (const [sw, t] of extras) {
    rows.push(sw(cy) + text(t));
    cy += ROW;
  }
  const rels = RELATIONSHIP_ORDER.filter((r) => used.relationships.has(r));
  if (rels.length) {
    head("Line: how two boxes are related, read from where the line starts to where it ends");
    for (const r of rels) {
      const st = lineStyle({ type: r } as ArchimateRelationship);
      rows.push(
        `<path d="M${x + 10} ${cy} L${x + SW - 2} ${cy}" fill="none" stroke="#333" stroke-width="1.2"${st.dash ? ` stroke-dasharray="${st.dash}"` : ""}` +
          `${st.start ? ` marker-start="url(#${st.start})"` : ""}${st.end ? ` marker-end="url(#${st.end})"` : ""}/>` +
          text(`${typeLabel(r)}: ${RELATIONSHIP_MEANING[r] ?? ""}`),
      );
      cy += ROW;
    }
  }
  if (!rows.length) return { svg: "", w: 0, h: 0 };
  const h = cy - y + 4;
  return {
    svg: `<g class="av-legend"><rect x="${x - 10}" y="${y}" width="${W + 20}" height="${h}" fill="#fafafa" stroke="#bbb"/>` +
      `<text class="av-keyt" x="${x}" y="${y + 18}">Key</text>${rows.join("")}</g>`,
    w: W + 10,
    h,
  };
}

const round = (n: number): number => Math.round(n * 10) / 10;
