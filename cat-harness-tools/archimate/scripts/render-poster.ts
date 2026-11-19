/**
 * Draw a layered ArchiMate view as a poster: bands of cards, with the type
 * and spacing of a printed figure, instead of Archi's own boxes and bounds.
 *
 * @module cat-harness/archimate/scripts/render-poster
 * @covers archimate
 *
 * `render-view.ts` draws a view exactly as Archi stored it. This one draws the
 * same view the way a report's figure shows a layered architecture (owner,
 * 2026-11-01, Q-IV-4 A): every box's colour is still its ArchiMate layer
 * (`figure-theme.ts`), but the layout is worked out from the view's
 * structure, not copied from its coordinates.
 *
 * ## What it reads from the view
 *
 * - **Bands.** Each top-level Grouping in the left-hand stack is a band, in
 *   the order the view has them top to bottom. A top-level Grouping to the
 *   right of that stack is a side column, drawn dashed, beside every band.
 * - **Frames.** A band holding only Groupings, in more than one row, is a
 *   frame holding those as bands; Groupings that share a row are bands side by
 *   side, as wide as the view draws them. One frame round the whole stack
 *   counts its own Groupings as the stack (DTH SC Fig. 14). A band whose
 *   Groupings all sit in one row is a row of panels, each holding its own
 *   cards. Elements beside the panels are cards of their own.
 * - **Rows.** Cards keep the view's row breaks: as many to a row as the view's
 *   widest row, at most ten.
 * - **Cards.** One per element: its name, and the `note` property's text
 *   split at " · " into lines. A card whose element has the `star` property
 *   set to `true` gets a star. In the side column, an element whose note is a
 *   list of five or more short items is drawn as pills.
 * - **Marks** (option): a filled dot on an element with `formerName` (renamed),
 *   a ring on one with `candidateMatch` (a new element beside a similar one).
 *
 * Every string is escaped: a name is text, never markup.
 */
import type { ArchimateElement, ArchimateModel, ArchimateView, ArchimateViewNode } from "../schemas/archimate.ts";
import { bandColours, fillOfType, outlineOf, THEME } from "./figure-theme.ts";

export interface PosterOptions {
  /** The property holding a card's short text. Default `figureNote`. */
  noteProperty?: string;
  /** The property that stars a card when `true`. Default `star`. */
  starProperty?: string;
  /** The words under a starred card and in the key, e.g. "REDDHI component". Default none. */
  starLabel?: string;
  /** Mark renamed and candidate-match elements, with a key. Default false. */
  marks?: boolean;
  /** Link each card to its element's page. */
  elementHref?: (elementId: string) => string;
  /** The heading. Default: the view's name. */
  title?: string;
  /** Total width in px. Default 1800. */
  width?: number;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Greedy word wrap to `n` characters a line. */
export function wrapWords(s: string, n: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of s.split(/\s+/).filter(Boolean)) {
    if (cur && cur.length + 1 + w.length > n) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  return cur ? [...out, cur] : out;
}

/** A note's items; short ones share a line, as a printed figure sets them. */
export function noteItems(note: string | undefined, merge = true): string[] {
  const raw = (note ?? "").split(" · ").map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    const last = out[out.length - 1];
    if (merge && last !== undefined && t.length < 14 && last.length + t.length < 30) out[out.length - 1] = `${last} · ${t}`;
    else out.push(t);
  }
  return out;
}

interface Tree {
  node: ArchimateViewNode;
  el?: ArchimateElement;
  kids: Tree[];
}

const isGroup = (t: Tree): boolean => t.el?.type === "Grouping" || t.node.kind === "group";
const prop = (e: ArchimateElement | undefined, k: string): string | undefined => e?.properties.find((p) => p.key === k)?.value;
const nameOf = (t: Tree): string => t.el?.name ?? t.node.text ?? "";

/**
 * Whether a view reads as a poster: no lines, at least three top-level
 * groupings stacked down its left edge, and nearly every box inside one. Views with lines keep their
 * drawn layout (`render-view.ts`), since a poster would drop the lines.
 */
export function posterFits(model: ArchimateModel, view: ArchimateView): boolean {
  if (view.connections.length) return false;
  const els = new Map(model.elements.map((e) => [e.id, e]));
  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  const grouping = (n: ArchimateViewNode) => n.kind === "group" || (n.kind === "element" && els.get(n.ref ?? "")?.type === "Grouping");
  const tops = view.nodes.filter((n) => !n.parent && grouping(n));
  const boxes = view.nodes.filter((n) => n.kind === "element" && !grouping(n));
  const inside = boxes.filter((n) => n.parent && byId.has(n.parent)).length;
  const left = Math.min(...tops.map((n) => n.x));
  const stack = tops.filter((n) => n.x <= left + 20);
  // One frame round the whole stack counts its own groupings as the bands.
  const framed = stack.length === 1 ? view.nodes.filter((n) => n.parent === stack[0]!.id && grouping(n)).length : 0;
  return Math.max(stack.length, framed) >= 3 && boxes.length > 0 && inside >= 0.9 * boxes.length;
}

export function renderPosterSvg(model: ArchimateModel, view: ArchimateView, opts: PosterOptions = {}): string {
  const NOTE = opts.noteProperty ?? "figureNote";
  const STAR = opts.starProperty ?? "star";
  const W = opts.width ?? 1800;
  const els = new Map(model.elements.map((e) => [e.id, e]));
  const trees = new Map<string, Tree>();
  for (const n of view.nodes) if (n.kind === "element" || n.kind === "group") trees.set(n.id, { node: n, el: n.ref ? els.get(n.ref) : undefined, kids: [] });
  const roots: Tree[] = [];
  for (const t of trees.values()) {
    const p = t.node.parent ? trees.get(t.node.parent) : undefined;
    (p ? p.kids : roots).push(t);
  }
  const byPos = (a: Tree, b: Tree) => a.node.y - b.node.y || a.node.x - b.node.x;
  for (const t of trees.values()) t.kids.sort(byPos);
  const tops = roots.filter(isGroup).sort(byPos);
  const left = Math.min(...tops.map((t) => t.node.x));
  const stack = tops.filter((t) => t.node.x <= left + 20);
  const side = tops.filter((t) => t.node.x > left + 20);

  const out: string[] = [];
  const T = (x: number, y: number, s: string, size: number, weight = 400, fill: string = THEME.body, anchor = "start", italic = false) =>
    out.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ""}>${esc(s)}</text>`);
  const R = (x: number, y: number, w: number, h: number, fill: string, stroke = "none", rx = 6, sw = 1, dash = "") =>
    out.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
  let starred = false;
  let marked = false;
  const mark = (x: number, y: number, e?: ArchimateElement) => {
    if (!opts.marks || !e) return;
    const former = prop(e, "formerName");
    const cand = prop(e, "candidateMatch");
    if (former !== undefined) out.push(`<circle cx="${x}" cy="${y}" r="5" fill="#2b6cb0"><title>renamed from ${esc(former)}</title></circle>`);
    else if (cand !== undefined) out.push(`<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#c05621" stroke-width="2"><title>new; may match ${esc(cand)}</title></circle>`);
    else return;
    marked = true;
  };

  // A card: measured first, then drawn at the height of its row.
  const cardLines = (t: Tree, w: number) => {
    const title = wrapWords(nameOf(t), Math.max(8, Math.floor(w / 7.4)));
    const body: string[] = [];
    for (const item of noteItems(prop(t.el, NOTE))) wrapWords(item, Math.max(8, Math.floor(w / 6.3) - 2)).forEach((l, i) => body.push(i ? `  ${l}` : `· ${l}`));
    const star = prop(t.el, STAR) === "true";
    return { title, body, star, h: 14 + 15 * title.length + 12 * body.length + (star && opts.starLabel ? 16 : 0) + 8 };
  };
  const card = (t: Tree, x: number, y: number, w: number, h: number) => {
    const { title, body, star } = cardLines(t, w);
    const fill = fillOfType(t.el?.type ?? "");
    const href = t.el && opts.elementHref ? opts.elementHref(t.el.id) : undefined;
    if (href) out.push(`<a href="${esc(href)}" target="_top">`);
    R(x, y, w, h, fill, outlineOf(fill), 6, 1.3);
    let ty = y + 17;
    for (const l of title) {
      T(x + 9, ty, l, 11.5, 700, THEME.ink);
      ty += 15;
    }
    ty += 1;
    for (const l of body) {
      T(x + 9, ty, l, 9.5, 400, THEME.body);
      ty += 12;
    }
    if (star) {
      starred = true;
      T(x + w - 10, y + 20, "★", 18, 400, THEME.star, "end");
      if (opts.starLabel) T(x + 9, y + h - 8, opts.starLabel, 9, 400, THEME.starText, "start", true);
    }
    mark(x + w - (star ? 26 : 9), y + h - 9, t.el);
    if (href) out.push("</a>");
  };
  // Boxes in rows as the view has them: a box starts a new row when it sits below the middle of the row's first box.
  const rowsOf = (items: Tree[]): Tree[][] => {
    const rows: Tree[][] = [];
    for (const t of items) {
      const r = rows[rows.length - 1];
      if (r && t.node.y < r[0]!.node.y + r[0]!.node.h / 2) r.push(t);
      else rows.push([t]);
    }
    return rows;
  };
  // A row of cards across `w`, as many a row as the view puts in its widest row, at most ten; returns its height.
  const cardRow = (items: Tree[], x: number, y: number, w: number, draw: boolean): number => {
    const per = Math.min(Math.max(0, ...rowsOf(items).map((r) => r.length)), 10) || 1;
    const bw = (w - 10 * (per - 1)) / per;
    let total = 0;
    for (let r = 0; r * per < items.length; r++) {
      const row = items.slice(r * per, r * per + per);
      const h = Math.max(...row.map((t) => cardLines(t, bw).h));
      if (draw) row.forEach((t, i) => card(t, x + i * (bw + 10), y + total, bw, h));
      total += h + 10;
    }
    return total - 10;
  };
  // A row of panels (Groupings side by side) and loose cards; returns its height.
  const panelRow = (items: Tree[], x: number, y: number, w: number, draw: boolean): number => {
    const units = items.reduce((n, t) => n + (isGroup(t) ? Math.max(1, t.kids.length) : 1), 0);
    const gap = 10;
    const uw = (w - gap * (items.length - 1)) / units;
    const widthOf = (t: Tree) => uw * (isGroup(t) ? Math.max(1, t.kids.length) : 1) + (isGroup(t) ? gap * (Math.max(1, t.kids.length) - 1) / Math.max(1, t.kids.length) : 0);
    const headOf = (t: Tree, pw: number) => wrapWords(prop(t.el, NOTE) ?? "", Math.floor(pw / 5.2)).slice(0, 2);
    const inner = (t: Tree, pw: number) => (pw - 16 - 8 * (t.kids.length - 1)) / Math.max(1, t.kids.length);
    let h = 0;
    for (const t of items) {
      const pw = widthOf(t);
      h = Math.max(h, isGroup(t) ? 24 + 12 * headOf(t, pw).length + 8 + Math.max(0, ...t.kids.map((k) => cardLines(k, inner(t, pw)).h)) + 8 : cardLines(t, pw).h);
    }
    if (!draw) return h;
    let cx = x;
    for (const t of items) {
      const pw = widthOf(t);
      if (isGroup(t)) {
        R(cx, y, pw, h, "#ffffff", THEME.bandStroke, 6, 1.2);
        T(cx + 10, y + 18, nameOf(t), 13, 700, THEME.ink);
        const head = headOf(t, pw);
        head.forEach((l, i) => T(cx + 10, y + 31 + i * 11, l, 9, 400, THEME.muted, "start", true));
        const top = y + 24 + 12 * head.length + 8;
        const iw = inner(t, pw);
        t.kids.forEach((k, i) => card(k, cx + 8 + i * (iw + 8), top, iw, y + h - 8 - top));
      } else card(t, cx, y, pw, h);
      cx += pw + gap;
    }
    return h;
  };
  // A frame holds only groupings, in rows; a row of several is drawn as bands side by side.
  const isFrame = (t: Tree) => t.kids.length > 1 && t.kids.every(isGroup) && rowsOf(t.kids).length > 1;
  // A band takes the hue of the layer most of its elements are in.
  const leaves = (t: Tree): Tree[] => (isGroup(t) ? t.kids.flatMap(leaves) : [t]);
  const hueOf = (t: Tree): string => {
    const n = new Map<string, number>();
    for (const l of leaves(t)) {
      const f = fillOfType(l.el?.type ?? "");
      n.set(f, (n.get(f) ?? 0) + 1);
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "#ffffff";
  };
  const PAD = 36;
  const COLW = side.length ? 270 : 0;
  const LW = W - 2 * PAD - (side.length ? COLW + 16 : 0);
  // A band, stretched to at least `minH`; returns its height.
  const band = (t: Tree, x: number, y: number, w: number, draw: boolean, minH = 0): number => {
    const sub = prop(t.el, NOTE);
    const hdr = sub ? 40 : 28;
    if (isFrame(t)) {
      const frameAt = out.length;
      let h = hdr;
      for (const row of rowsOf(t.kids)) {
        const gap = 10;
        const span = row.reduce((n, k) => n + Math.max(1, k.node.w), 0);
        const avail = w - 16 - gap * (row.length - 1);
        const ws = row.map((k) => (avail * Math.max(1, k.node.w)) / span);
        const rh = Math.max(...row.map((k, i) => band(k, 0, 0, ws[i]!, false)));
        let bx = x + 8;
        row.forEach((k, i) => {
          band(k, bx, y + h, ws[i]!, draw, rh);
          bx += ws[i]! + gap;
        });
        h += rh + 10;
      }
      h = Math.max(h, minH - 4);
      if (draw) {
        out.splice(frameAt, 0, `<rect x="${x}" y="${y}" width="${w}" height="${h + 4}" rx="10" fill="#ffffff" stroke="${THEME.frame}" stroke-width="2.2"/>`, `<path d="M${x} ${y + 10} a10 10 0 0 1 10 -10 h${w - 20} a10 10 0 0 1 10 10 v${hdr - 14} h${-w} z" fill="${THEME.frame}"/>`);
        T(x + 14, y + 19, nameOf(t).toUpperCase(), 12, 700, "#ffffff");
        if (sub) T(x + 14, y + 33, sub, 10, 400, "#dfe5ee", "start", true);
      }
      return h + 4;
    }
    const panels = t.kids.some(isGroup);
    const inner = panels ? panelRow(t.kids, x + 12, y + hdr, w - 24, false) : cardRow(t.kids, x + 12, y + hdr, w - 24, false);
    const h = Math.max(hdr + inner + 12, minH);
    if (draw) {
      const c = bandColours(hueOf(t));
      R(x, y, w, h, c.ground, c.stroke, 8, 1.4);
      out.push(`<path d="M${x} ${y + 8} a8 8 0 0 1 8 -8 h${w - 16} a8 8 0 0 1 8 8 v${hdr - 12} h${-w} z" fill="${c.header}"/>`);
      T(x + 14, y + 18, nameOf(t).toUpperCase(), 11, 700, "#ffffff");
      if (sub) T(x + 14, y + 32, sub, 10, 400, "#ffffff", "start", true);
      if (panels) panelRow(t.kids, x + 12, y + hdr, w - 24, true);
      else cardRow(t.kids, x + 12, y + hdr, w - 24, true);
    }
    return h;
  };

  const TOP = 82;
  let y = TOP;
  for (const t of stack) y += band(t, PAD, y, LW, true) + 12;
  let bottom = y - 12;
  // The side column, beside every band.
  if (side.length) {
    const x = W - PAD - COLW;
    const body: string[] = [];
    const save = out.length;
    let yy = TOP + 14;
    for (const g of side) {
      T(x + COLW / 2, yy + 10, nameOf(g).toUpperCase(), 13, 700, THEME.ink, "middle");
      yy += 26;
      for (const k of g.kids) {
        const items = noteItems(prop(k.el, NOTE), false);
        if (items.length >= 5 && items.every((s) => s.length <= 24)) {
          T(x + 12, yy + 4, nameOf(k).toUpperCase(), 10.5, 700, THEME.ink);
          yy += 12;
          let px = x + 12;
          const fill = fillOfType(k.el?.type ?? "");
          for (const p of items) {
            const pw = p.length * 5.6 + 18;
            if (px + pw > x + COLW - 10) {
              px = x + 12;
              yy += 24;
            }
            out.push(`<rect x="${px.toFixed(1)}" y="${yy.toFixed(1)}" width="${pw.toFixed(1)}" height="19" rx="9.5" fill="${fill}" stroke="${outlineOf(fill)}" stroke-width="1.1"/>`);
            T(px + pw / 2, yy + 13, p, 9, 700, THEME.ink, "middle");
            px += pw + 6;
          }
          mark(x + COLW - 18, yy - 8, k.el);
          yy += 34;
        } else {
          const h = cardLines(k, COLW - 24).h;
          card(k, x + 12, yy, COLW - 24, h);
          yy += h + 12;
        }
      }
    }
    const col = out.splice(save);
    bottom = Math.max(bottom, yy);
    const c = bandColours(hueOf({ node: side[0]!.node, kids: side, el: side[0]!.el }));
    R(x, TOP, COLW, bottom - TOP, c.ground, c.header, 10, 2, "8 5");
    out.push(`<path d="M${x} ${TOP + 10} a10 10 0 0 1 10 -10 h${COLW - 20} a10 10 0 0 1 10 10 v26 h${-COLW} z" fill="${c.header}"/>`);
    // Only the first heading sits on the column's header bar; the others stay dark on its ground.
    const first = col.findIndex((l) => l.includes(`text-anchor="middle"`) && l.includes('font-size="13"'));
    out.push(...col.map((l, i) => (i === first ? l.replace(`fill="${THEME.ink}"`, 'fill="#ffffff"') : l)), ...body);
  }
  // Key.
  let ky = bottom + 28;
  const key: string[] = [];
  if (starred && opts.starLabel) key.push(`<text x="${PAD}" y="${ky}" font-size="11" fill="${THEME.ink}"><tspan fill="${THEME.star}" font-size="14">★</tspan> ${esc(opts.starLabel)}</text>`);
  if (marked) {
    const kx = PAD + (key.length ? 220 : 0);
    key.push(`<circle cx="${kx + 6}" cy="${ky - 4}" r="5" fill="#2b6cb0"/><text x="${kx + 18}" y="${ky}" font-size="11" fill="${THEME.ink}">renamed (old name kept as formerName)</text>`);
    key.push(`<circle cx="${kx + 286}" cy="${ky - 4}" r="5" fill="none" stroke="#c05621" stroke-width="2"/><text x="${kx + 298}" y="${ky}" font-size="11" fill="${THEME.ink}">new element beside a similar one (candidateMatch)</text>`);
  }
  if (!key.length) ky -= 20;
  const H = ky + 20;
  const title = opts.title ?? view.name;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family='${THEME.font}' role="img" aria-label="${esc(title)}">`,
    `<rect width="${W}" height="${H}" fill="${THEME.page}"/>`,
    `<rect width="${W}" height="72" fill="${THEME.frame}"/>`,
    `<text x="${PAD}" y="42" font-size="26" font-weight="800" fill="#ffffff">${esc(title)}</text>`,
    `<text x="${PAD}" y="61" font-size="11" fill="#c9d6e6" font-style="italic">Drawn from the ArchiMate model “${esc(model.name)}”, view “${esc(view.name)}”</text>`,
    ...out,
    ...key,
    "</svg>",
  ].join("\n");
}

if (import.meta.main) {
  const { readFileSync, writeFileSync } = await import("node:fs");
  const { readArchimate } = await import("../schemas/archimate.ts");
  const args = process.argv.slice(2);
  const flag = (k: string) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const model = flag("model");
  const viewName = flag("view");
  const outPath = flag("out");
  if (!model || !viewName || !outPath) {
    console.error('usage: render-poster.ts --model <model.xml|.archimate> --view "<name>" --out <file.svg> [--note-property k] [--star-property k] [--star-label text] [--marks]');
    process.exit(2);
  }
  const m = readArchimate(readFileSync(model));
  const v = m.views.find((x) => x.name === viewName);
  if (!v) {
    console.error(`no view "${viewName}"; the model has: ${m.views.map((x) => x.name).join(" | ")}`);
    process.exit(1);
  }
  writeFileSync(outPath, renderPosterSvg(m, v, { noteProperty: flag("note-property"), starProperty: flag("star-property"), starLabel: flag("star-label"), marks: args.includes("--marks") }));
  console.log(`wrote ${outPath}`);
}
