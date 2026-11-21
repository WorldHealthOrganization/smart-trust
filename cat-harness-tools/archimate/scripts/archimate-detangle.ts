#!/usr/bin/env bun
/**
 * Untangle an ArchiMate view: re-route its lines, and swap same-size boxes
 * in a row, wherever that lowers the count `archimate-crossings.ts` gives.
 *
 * @module cat-harness/archimate/scripts/archimate-detangle
 * @covers archimate
 *
 * Owner, 2026-10-31, of a view drawn with lines across each other and
 * through boxes: *"lots crossed lines. detangle."*, then *"improve skills /
 * make mechanical tools where you can"*. The counter says how tangled a view
 * is; this lowers it, so an author does not do by hand what a search can do.
 *
 * Usage:
 *   bun run cat-harness-tools/archimate/scripts/archimate-detangle.ts --model <file.archimate> [--view <id or page slug>] [--routes-only] [--no-slide] [--apply] [--json]
 *
 * Without `--apply` it only reports, per view, the tangles now and after,
 * and what it would change. With `--apply` it writes the model back in place.
 *
 * ## What it may change, and what it never does
 *
 * - **A line's route.** Straight, or an orthogonal route of one or two
 *   bendpoints: an L through a corner, or a Z through a free lane between
 *   rows or columns of boxes. A route is kept only if it lowers the tangles.
 * - **Two boxes' places**, unless `--routes-only`: two boxes of the same size,
 *   inside the same parent, in the same row or column, swap. Their contents
 *   move with them. Rows, bands and sizes stay as the author drew them.
 * - **A box's place inside its own parent**, unless `--routes-only` or
 *   `--no-slide`: a box may slide into free space next to a box it is joined
 *   to, never overlapping another box and never out of its parent (or into
 *   a box that is not its parent), since nesting is meaning.
 *
 * It never adds, removes, renames or resizes anything, and never touches a
 * line that ends on another line, or a line that shares both ends with
 * another (the renderer sets those side by side). A change that does not
 * lower the tangles is not made, so a view that is already clean is left
 * byte-for-byte as it is.
 *
 * ## The score
 *
 * Crossings plus lines through boxes, as counted (`tanglesOf`), plus lines
 * drawn on top of each other along the same lane, which the counter does not
 * see but a reader cannot tell apart. Ties go to the shorter route with
 * fewer bends.
 *
 * ## Writing back
 *
 * Only the `<bounds>` of a moved box and the `<bendpoint>`s of a re-routed
 * line change in the XML; every other byte is kept. Archi's zipped archive is
 * written back as a zip, its other entries (images) copied unchanged.
 */
import { deflateRawSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { modelXmlOf, parseArchimate, type ArchimateView, type ArchimateViewConnection, type ArchimateViewNode } from "../schemas/archimate.ts";
import { routeConnections, type Pt, type RoutedConnection } from "./render-view.ts";
import { tanglesOf, viewOf } from "./archimate-crossings.ts";

type Bend = ArchimateViewConnection["bendpoints"][number];

export interface Score {
  crossings: number;
  throughBox: number;
  /** Pairs of lines drawn along the same lane, on top of each other. */
  overlaps: number;
  /** Total drawn length, px: a tie-breaker only. */
  length: number;
  bends: number;
}

const centre = (n: ArchimateViewNode): Pt => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });
const inside = (p: Pt, n: ArchimateViewNode, pad = 0): boolean => p.x > n.x - pad && p.x < n.x + n.w + pad && p.y > n.y - pad && p.y < n.y + n.h + pad;

/** How far apart two parallel segments may be and still read as one line. */
const LANE_TOL = 4;
/** How much two such segments must share to count as on top of each other. */
const SHARE_MIN = 6;

function overlapsOf(routed: RoutedConnection[]): number {
  type Seg = { c: number; horiz: boolean; at: number; lo: number; hi: number };
  const segs: Seg[] = [];
  routed.forEach((r, c) => {
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1]!, b = r.pts[i]!;
      if (Math.abs(a.y - b.y) < 0.5) segs.push({ c, horiz: true, at: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
      else if (Math.abs(a.x - b.x) < 0.5) segs.push({ c, horiz: false, at: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
    }
  });
  const pairs = new Set<string>();
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i]!, t = segs[j]!;
      if (s.c === t.c || s.horiz !== t.horiz || Math.abs(s.at - t.at) > LANE_TOL) continue;
      if (Math.min(s.hi, t.hi) - Math.max(s.lo, t.lo) < SHARE_MIN) continue;
      pairs.add(s.c < t.c ? `${s.c} ${t.c}` : `${t.c} ${s.c}`);
    }
  }
  return pairs.size;
}

/** The score of a view as drawn now. */
export function scoreOf(view: ArchimateView): Score {
  const routed = routeConnections(view);
  const t = tanglesOf(view, routed);
  let length = 0, bends = 0;
  for (const r of routed) {
    bends += r.pts.length - 2;
    for (let i = 1; i < r.pts.length; i++) length += Math.hypot(r.pts[i]!.x - r.pts[i - 1]!.x, r.pts[i]!.y - r.pts[i - 1]!.y);
  }
  return { crossings: t.filter((x) => x.kind === "crossing").length, throughBox: t.filter((x) => x.kind === "through-box").length, overlaps: overlapsOf(routed), length, bends };
}

const tangles = (s: Score): number => s.crossings + s.throughBox + 2 * s.overlaps;
/** Whether `a` is better than `b`: fewer tangles, else (by a clear margin) shorter and with fewer bends. */
function better(a: Score, b: Score): boolean {
  const d = tangles(a) - tangles(b);
  if (d !== 0) return d < 0;
  return a.length + 40 * a.bends < b.length + 40 * b.bends - 1;
}

/** Bendpoints for absolute points on a line from box `s` to box `t`, as Archi stores them. */
export function relativeBends(s: ArchimateViewNode, t: ArchimateViewNode, pts: Pt[]): Bend[] {
  const cs = centre(s), ct = centre(t);
  return pts.map((p) => ({ startX: Math.round(p.x - cs.x), startY: Math.round(p.y - cs.y), endX: Math.round(p.x - ct.x), endY: Math.round(p.y - ct.y) }));
}

/** The free lanes along one axis: the middles of the gaps no leaf box covers, with a step either side. */
function lanes(view: ArchimateView, axis: "x" | "y"): number[] {
  const parents = new Set(view.nodes.map((n) => n.parent).filter(Boolean));
  const spans = view.nodes
    .filter((n) => n.kind !== "group" && !parents.has(n.id))
    .map((n) => (axis === "x" ? [n.x, n.x + n.w] : [n.y, n.y + n.h]) as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const out: number[] = [];
  let end = -Infinity;
  for (const [lo, hi] of spans) {
    if (end > -Infinity && lo - end >= 12) {
      const mid = (lo + end) / 2;
      const room = (lo - end) / 2 - 4;
      for (const k of [0, -1, 1, -2, 2]) if (Math.abs(k * 10) <= room) out.push(Math.round(mid + k * 10));
    }
    end = Math.max(end, hi);
  }
  return out;
}

/** The clear space kept around a slid box, px. */
const GAP = 10;

/** How far outside the span of its two ends a lane may be and still be tried: no long detours. */
const DETOUR = 80;

/** The candidate routes for a line between boxes `s` and `t`, as absolute bendpoints. */
function candidates(s: ArchimateViewNode, t: ArchimateViewNode, laneX: number[], laneY: number[]): Pt[][] {
  const cs = centre(s), ct = centre(t);
  const out: Pt[][] = [[], [{ x: ct.x, y: cs.y }], [{ x: cs.x, y: ct.y }]];
  const near = (ls: number[], a: number, b: number) => {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const gap = (p: number) => (p >= lo && p <= hi ? 0 : Math.min(Math.abs(p - lo), Math.abs(p - hi)));
    // Lanes between the two ends first, then the nearest just outside them.
    return ls.filter((p) => gap(p) <= DETOUR).sort((p, q) => gap(p) - gap(q)).slice(0, 8);
  };
  // A line may leave a box off its centre, so lines from one box do not share a trunk.
  const ports = (n: ArchimateViewNode, axis: "x" | "y") => {
    const c = centre(n)[axis], q = (axis === "x" ? n.w : n.h) / 4;
    return [c, c - q, c + q];
  };
  for (const y of near(laneY, cs.y, ct.y)) for (const sx of ports(s, "x")) for (const tx of ports(t, "x")) out.push([{ x: sx, y }, { x: tx, y }]);
  for (const x of near(laneX, cs.x, ct.x)) for (const sy of ports(s, "y")) for (const ty of ports(t, "y")) out.push([{ x, y: sy }, { x, y: ty }]);
  // A bend inside either end's box would be clipped into a line back through it.
  return out.filter((r) => r.every((p) => !inside(p, s, 2) && !inside(p, t, 2)));
}

export interface Change {
  kind: "route" | "swap" | "slide";
  /** The connection re-routed, or the two boxes swapped. */
  ids: string[];
}

export interface Result {
  before: Score;
  after: Score;
  view: ArchimateView;
  changes: Change[];
  /** Diagram ids whose bounds moved, by how much. */
  moved: Map<string, Pt>;
  /** Connection ids whose bendpoints were rewritten. */
  rerouted: Set<string>;
}

const cloneView = (v: ArchimateView): ArchimateView => ({ ...v, nodes: v.nodes.map((n) => ({ ...n })), connections: v.connections.map((c) => ({ ...c, bendpoints: c.bendpoints.map((b) => ({ ...b })) })) });

/** Search for a less tangled drawing of one view. The view passed in is not changed. */
export function detangle(input: ArchimateView, opts: { routesOnly?: boolean; noSlide?: boolean; passes?: number } = {}): Result {
  const view = cloneView(input);
  const nodes = new Map(view.nodes.map((n) => [n.id, n]));
  const before = scoreOf(view);
  let best = before;
  const changes: Change[] = [];
  const moved = new Map<string, Pt>();
  const rerouted = new Set<string>();
  const descendants = (id: string): ArchimateViewNode[] => view.nodes.filter((n) => {
    for (let p = n.parent, k = 0; p && k < 64; p = nodes.get(p)?.parent, k++) if (p === id) return true;
    return false;
  });
  const shift = (id: string, dx: number, dy: number) => {
    const n = nodes.get(id)!;
    n.x += dx; n.y += dy;
    for (const d of descendants(id)) { d.x += dx; d.y += dy; }
    const m = moved.get(id) ?? { x: 0, y: 0 };
    moved.set(id, { x: m.x + dx, y: m.y + dy });
  };
  /** Whether box n, moved by (dx, dy), would overlap a box that is neither its ancestor nor its descendant, or leave its parent. */
  const fits = (n: ArchimateViewNode, dx: number, dy: number, inner: Set<string>): boolean => {
    const x = n.x + dx, y = n.y + dy;
    const par = n.parent ? nodes.get(n.parent) : undefined;
    // Keep clear of the parent's label band at its top.
    if (par && (x < par.x + GAP || y < par.y + 28 || x + n.w > par.x + par.w - GAP || y + n.h > par.y + par.h - GAP)) return false;
    const anc = new Set<string>();
    for (let p = n.parent, k = 0; p && k < 64; p = nodes.get(p)?.parent, k++) anc.add(p);
    for (const o of view.nodes) {
      if (o.id === n.id || inner.has(o.id) || anc.has(o.id)) continue;
      if (x < o.x + o.w + GAP && x + n.w + GAP > o.x && y < o.y + o.h + GAP && y + n.h + GAP > o.y) return false;
    }
    return true;
  };
  /** The best place to slide box n to, if any lowers the tangles. */
  const slideOf = (n: ArchimateViewNode): { dx: number; dy: number; score: Score } | undefined => {
    const inner = new Set(descendants(n.id).map((d) => d.id));
    const mates = view.connections.flatMap((c) => (c.source === n.id ? [c.target] : c.target === n.id ? [c.source] : [])).map((id) => nodes.get(id)).filter((m): m is ArchimateViewNode => !!m && !inner.has(m.id));
    const spots: Pt[] = [];
    for (const m of mates) {
      spots.push({ x: m.x, y: m.y - n.h - 2 * GAP }, { x: m.x, y: m.y + m.h + 2 * GAP }, { x: m.x - n.w - 2 * GAP, y: m.y }, { x: m.x + m.w + 2 * GAP, y: m.y });
      spots.push({ x: m.x + (m.w - n.w) / 2, y: n.y }, { x: n.x, y: m.y + (m.h - n.h) / 2 });
    }
    let pick: { dx: number; dy: number; score: Score } | undefined;
    for (const sp of spots) {
      const dx = Math.round(sp.x - n.x), dy = Math.round(sp.y - n.y);
      if ((!dx && !dy) || !fits(n, dx, dy, inner)) continue;
      const saved = view.connections.map((c) => c.bendpoints);
      const touched = new Set([n.id, ...inner]);
      for (const c of view.connections) if (touched.has(c.source) || touched.has(c.target)) c.bendpoints = [];
      shift(n.id, dx, dy);
      const sc = scoreOf(view);
      shift(n.id, -dx, -dy);
      view.connections.forEach((c, k) => { c.bendpoints = saved[k]!; });
      if (tangles(sc) < tangles(pick?.score ?? best)) pick = { dx, dy, score: sc };
    }
    return pick;
  };
  const pairCount = new Map<string, number>();
  const pk = (c: ArchimateViewConnection) => (c.source < c.target ? `${c.source} ${c.target}` : `${c.target} ${c.source}`);
  for (const c of view.connections) pairCount.set(pk(c), (pairCount.get(pk(c)) ?? 0) + 1);
  const routable = () => view.connections.filter((c) => {
    const s = nodes.get(c.source), t = nodes.get(c.target);
    return s && t && s.kind !== "group" && t.kind !== "group" && pairCount.get(pk(c)) === 1;
  });

  const passes = opts.passes ?? 6;
  for (let pass = 0; pass < passes && tangles(best) > 0; pass++) {
    const start = best;
    if (!opts.routesOnly) {
      // Swaps: same parent, same size, same row or column.
      for (;;) {
        const boxes = view.nodes.filter((n) => n.kind === "element" || n.kind === "view-ref" || n.kind === "note");
        let pick: { a: ArchimateViewNode; b: ArchimateViewNode; score: Score } | undefined;
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!, b = boxes[j]!;
            if (a.parent !== b.parent || a.w !== b.w || a.h !== b.h || (a.x !== b.x && a.y !== b.y)) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const saved = view.connections.map((c) => c.bendpoints);
            // Lines on a moved box lose their bendpoints: drawn from the old places, they would be stale.
            const touched = new Set([a.id, b.id, ...descendants(a.id).map((n) => n.id), ...descendants(b.id).map((n) => n.id)]);
            for (const c of view.connections) if (touched.has(c.source) || touched.has(c.target)) c.bendpoints = [];
            shift(a.id, dx, dy); shift(b.id, -dx, -dy);
            const sc = scoreOf(view);
            shift(a.id, -dx, -dy); shift(b.id, dx, dy);
            view.connections.forEach((c, k) => { c.bendpoints = saved[k]!; });
            if (tangles(sc) < tangles(pick?.score ?? best)) pick = { a, b, score: sc };
          }
        }
        if (!pick) break;
        const { a, b } = pick;
        const dx = b.x - a.x, dy = b.y - a.y;
        const touched = new Set([a.id, b.id, ...descendants(a.id).map((n) => n.id), ...descendants(b.id).map((n) => n.id)]);
        for (const c of view.connections) if ((touched.has(c.source) || touched.has(c.target)) && c.bendpoints.length) { c.bendpoints = []; rerouted.add(c.id); }
        shift(a.id, dx, dy); shift(b.id, -dx, -dy);
        best = pick.score;
        changes.push({ kind: "swap", ids: [a.id, b.id] });
      }
      // Slides: a box moves to free space inside its own parent, next to a box
      // it is joined to. Never into another parent: nesting is meaning.
      if (!opts.noSlide) {
        for (const n of view.nodes.filter((x) => x.kind === "element" || x.kind === "note" || x.kind === "view-ref")) {
          const sc = slideOf(n);
          if (!sc) continue;
          const touched = new Set([n.id, ...descendants(n.id).map((d) => d.id)]);
          for (const c of view.connections) if ((touched.has(c.source) || touched.has(c.target)) && c.bendpoints.length) { c.bendpoints = []; rerouted.add(c.id); }
          shift(n.id, sc.dx, sc.dy);
          best = sc.score;
          changes.push({ kind: "slide", ids: [n.id] });
        }
      }
    }
    // Routes: one line at a time, keeping a route only if it is better.
    const laneX = lanes(view, "x"), laneY = lanes(view, "y");
    for (const c of routable()) {
      const s = nodes.get(c.source)!, t = nodes.get(c.target)!;
      const old = c.bendpoints;
      let pick: { bends: Bend[]; score: Score } | undefined;
      for (const pts of candidates(s, t, laneX, laneY)) {
        c.bendpoints = relativeBends(s, t, pts);
        const sc = scoreOf(view);
        // Only a route with fewer tangles replaces what the author drew; among those, the shortest.
        if (tangles(sc) < tangles(best) && (!pick || better(sc, pick.score))) pick = { bends: c.bendpoints, score: sc };
      }
      c.bendpoints = old;
      if (pick) {
        c.bendpoints = pick.bends;
        best = pick.score;
        rerouted.add(c.id);
        changes.push({ kind: "route", ids: [c.id] });
      }
    }
    if (tangles(best) >= tangles(start)) break;
  }
  return { before, after: best, view, changes, moved, rerouted };
}

// ── Writing back ─────────────────────────────────────────────────────────

/** The span of the element with this id: from `<tag` to the end of its opening tag, and to its close. */
function elementSpan(xml: string, id: string): { open: number; openEnd: number; selfClosing: boolean; close: number; tag: string } {
  const at = xml.indexOf(` id="${id}"`);
  if (at < 0) throw new Error(`no object with id ${id} in the model XML`);
  const open = xml.lastIndexOf("<", at);
  const tag = /^<([\w:]+)/.exec(xml.slice(open))![1]!;
  const openEnd = xml.indexOf(">", at) + 1;
  const selfClosing = xml[openEnd - 2] === "/";
  if (selfClosing) return { open, openEnd, selfClosing, close: openEnd, tag };
  // Same-tag elements nest (a child inside a child): count depth to the matching close.
  const re = new RegExp(`<${tag}[\\s>/]|</${tag}>`, "g");
  re.lastIndex = openEnd;
  let depth = 1;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    if (m[0].startsWith("</")) { if (--depth === 0) return { open, openEnd, selfClosing, close: m.index, tag }; }
    else if (xml[xml.indexOf(">", m.index) - 1] !== "/") depth++;
  }
  throw new Error(`unclosed <${tag}> for ${id}`);
}

function setAttr(tag: string, name: string, value: number): string {
  const re = new RegExp(`\\s${name}="[^"]*"`);
  if (value === 0) return tag.replace(re, "");
  if (re.test(tag)) return tag.replace(re, ` ${name}="${value}"`);
  return tag.replace(/^<bounds/, `<bounds ${name}="${value}"`);
}

/** The model XML with the result's moves and routes written in; every other byte as it was. */
export function writeBack(xml: string, result: Result): string {
  let out = xml;
  for (const [id, d] of result.moved) {
    if (!d.x && !d.y) continue;
    const span = elementSpan(out, id);
    const b = out.indexOf("<bounds", span.openEnd);
    const e = out.indexOf(">", b) + 1;
    const tag = out.slice(b, e);
    const num = (n: string) => Number(new RegExp(`\\s${n}="([^"]*)"`).exec(tag)?.[1] ?? 0);
    // Keep Archi's own order: x, y, width, height.
    let next = setAttr(tag, "y", num("y") + d.y);
    next = setAttr(next, "x", num("x") + d.x);
    out = out.slice(0, b) + next + out.slice(e);
  }
  const conns = new Map(result.view.connections.map((c) => [c.id, c]));
  for (const id of result.rerouted) {
    const c = conns.get(id)!;
    const span = elementSpan(out, id);
    const lineStart = out.lastIndexOf("\n", span.open) + 1;
    const indent = out.slice(lineStart, span.open);
    const bends = c.bendpoints
      .map((b) => `${indent}  <bendpoint${(["startX", "startY", "endX", "endY"] as const).map((k) => (b[k] ? ` ${k}="${b[k]}"` : "")).join("")}/>`)
      .join("\n");
    if (span.selfClosing) {
      if (!bends) continue;
      const head = out.slice(span.open, span.openEnd).replace(/\s*\/>$/, ">");
      out = out.slice(0, span.open) + `${head}\n${bends}\n${indent}</${span.tag}>` + out.slice(span.openEnd);
    } else {
      const body = out.slice(span.openEnd, span.close).replace(/\n[ \t]*<bendpoint\b[^>]*\/>/g, "");
      const rest = body.replace(/\s+$/, "");
      if (!bends && !rest.trim()) {
        out = out.slice(0, span.open) + out.slice(span.open, span.openEnd).replace(/>$/, "/>") + out.slice(span.close + `</${span.tag}>`.length);
      } else {
        out = out.slice(0, span.openEnd) + (bends ? `\n${bends}` : "") + rest + `\n${indent}` + out.slice(span.close);
      }
    }
  }
  return out;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Buffer): number => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** The file's bytes with its model XML replaced: plain XML, or Archi's zip with `model.xml` swapped and every other entry copied. */
export function withModelXml(bytes: Buffer, xml: string): Buffer {
  if (!(bytes.length >= 4 && bytes.readUInt32LE(0) === 0x04034b50)) return Buffer.from(xml, "utf8");
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) if (bytes.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  const count = bytes.readUInt16LE(eocd + 10);
  let p = bytes.readUInt32LE(eocd + 16);
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (let n = 0; n < count; n++) {
    const method0 = bytes.readUInt16LE(p + 10);
    const time = bytes.readUInt16LE(p + 12), date = bytes.readUInt16LE(p + 14);
    let crc = bytes.readUInt32LE(p + 16), csize = bytes.readUInt32LE(p + 20), usize = bytes.readUInt32LE(p + 24);
    const nameLen = bytes.readUInt16LE(p + 28), extraLen = bytes.readUInt16LE(p + 30), commentLen = bytes.readUInt16LE(p + 32);
    const local = bytes.readUInt32LE(p + 42);
    const name = bytes.subarray(p + 46, p + 46 + nameLen);
    const dataAt = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    let data: Buffer = bytes.subarray(dataAt, dataAt + csize);
    let method = method0;
    if (name.toString("utf8") === "model.xml") {
      const raw = Buffer.from(xml, "utf8");
      data = deflateRawSync(raw);
      method = 8; crc = crc32(raw); csize = data.length; usize = raw.length;
    }
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(csize, 18); lh.writeUInt32LE(usize, 22);
    lh.writeUInt16LE(nameLen, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(csize, 20); ch.writeUInt32LE(usize, 24);
    ch.writeUInt16LE(nameLen, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, data);
    centrals.push(ch, name);
    offset += 30 + nameLen + data.length;
    p += 46 + nameLen + extraLen + commentLen;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const file = arg("model");
  if (!file) {
    console.error("usage: archimate-detangle.ts --model <file.archimate> [--view <id or page slug>] [--routes-only] [--no-slide] [--apply] [--json]");
    process.exit(2);
  }
  const path = resolve(file);
  const bytes = readFileSync(path);
  let xml = modelXmlOf(bytes);
  const model = parseArchimate(xml);
  const key = arg("view");
  const views = key ? [viewOf(model, key)] : model.views;
  if (views[0] === undefined) {
    console.error(`no view "${key}" in ${file}`);
    process.exit(2);
  }
  const routesOnly = process.argv.includes("--routes-only");
  const noSlide = process.argv.includes("--no-slide");
  const rows = [];
  for (const v of views as ArchimateView[]) {
    const r = detangle(v, { routesOnly, noSlide });
    const improved = tangles(r.after) < tangles(r.before);
    if (improved) xml = writeBack(xml, r);
    rows.push({ id: v.id, name: v.name, before: r.before, after: improved ? r.after : r.before, changes: improved ? r.changes : [] });
  }
  if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 2));
  else {
    const fmt = (s: Score) => `${s.crossings}×/${s.throughBox}▢/${s.overlaps}=`;
    for (const r of rows) {
      const swaps = r.changes.filter((c) => c.kind === "swap").length, slides = r.changes.filter((c) => c.kind === "slide").length, routes = r.changes.filter((c) => c.kind === "route").length;
      console.log(`${fmt(r.before).padStart(12)} → ${fmt(r.after).padEnd(12)} ${swaps ? `${swaps} swap(s) ` : ""}${slides ? `${slides} slide(s) ` : ""}${routes ? `${routes} route(s) ` : ""}${r.name} (${r.id})`);
    }
    console.log("  (crossings × / lines through a box ▢ / lines on top of each other =)");
  }
  if (process.argv.includes("--apply")) {
    writeFileSync(path, withModelXml(bytes, xml));
    // Read it back: what was written must parse and score as reported.
    const again = parseArchimate(modelXmlOf(readFileSync(path)));
    for (const r of rows) {
      const s = scoreOf(again.views.find((v) => v.id === r.id)!);
      if (tangles(s) > tangles(r.after)) console.error(`✗ ${r.name}: wrote ${tangles(s)} tangles, expected ${tangles(r.after)}`);
    }
    console.log(`✓ wrote ${path}`);
  }
}
