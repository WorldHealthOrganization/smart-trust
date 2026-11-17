/**
 * The one UML class-diagram renderer: the same JavaScript draws a diagram in
 * the schemas viewer (in the browser) and on the skill and Tool pages (at
 * build time), so a class looks the same wherever it is drawn and whichever
 * source it was read from.
 *
 * @module scripts/class-diagram
 * @graphNode none — a renderer, not a schema
 *
 * ## One source text, two places it runs
 *
 * {@link CLASS_DIAGRAM_JS} is plain ES5 with no dependencies (the viewer's
 * zero-dependency rule). `viewerHtml` inlines it; {@link renderClassDiagram}
 * evaluates the same text here. There is no second implementation to drift.
 *
 * ## The look (owner, 2026-11-14, mockups artifact)
 *
 * - the source type (`«zod»`, `«json-schema»`, `«fhir»`, `«skill»`) in the
 *   upper right of every box, the class name centred under it;
 * - every field as `name : Type [min..max]`;
 * - generalisation a hollow triangle, a field reference an open arrow
 *   labelled `field [min..max]`, a reference by id dashed, a nested class
 *   joined by a filled diamond (composition);
 * - colours from `uml.css` (`--fa-uml-schema` fill, `--fa-uml-edge` ink),
 *   passed in as CSS variables with the same fallbacks;
 * - every box a link to its class, every type a link to its definition;
 * - "could not determine" a dashed box with the reason, never an empty box.
 */
import { cardinalityOf, classModelOfDocuments, type SchemaDecl, type SchemaEdge } from "./schema-graph.ts";
import { sourceOfKind, typeLink, umlType } from "./type-links.ts";

/** A class to draw. `href` links the name; `links` maps a field type to its definition. */
export interface DiagramClass {
  id: string;
  name: string;
  source: string;
  /** `note`: what a profile says beyond type and cardinality (`MS`, `= value`), drawn `{note}`. */
  fields: { name: string; type: string; card?: string; href?: string; note?: string }[];
  /** The class this diagram is about: outlined in the accent colour. */
  sel?: boolean;
  /** Outside the graph (a type no layer here declares). */
  ext?: boolean;
  /** Could not be determined: drawn dashed, with {@link DiagramClass.note}. */
  und?: boolean;
  note?: string;
  href?: string;
  /** Values of an enum, shown as one row. */
  values?: string[];
}

export interface DiagramEdge {
  from: string;
  to: string;
  kind: "field" | "member" | "extends" | "id-ref";
  via?: string;
  card?: string;
  /** Composition: the target is a nested class of the source. */
  comp?: boolean;
}

export interface DiagramModel {
  classes: DiagramClass[];
  edges: DiagramEdge[];
  /** Accessible name of the figure. */
  label?: string;
  /** Prefix of this diagram's SVG marker ids; default a hash of what it draws. */
  idPrefix?: string;
  /** Most rows a box shows before "… n more". Default 10. */
  maxRows?: number;
  /** Width budget in px: a wider layer wraps into bands. Default 1100. */
  maxWidth?: number;
}

/**
 * The renderer's source. Defines `classDiagram(model) → svg string`.
 *
 * NOTE: no backticks and no `${` in this text — it is inlined into the
 * template literal that carries the viewer page.
 */
export const CLASS_DIAGRAM_JS = String.raw`
function classDiagram(model) {
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var CH = 6.7, PAD = 10, LH = 15, HEAD = 34, GX = 34, GY = 74, MAXC = 64, MAXR = model.maxRows || 10;
  /* MARKER IDS ARE PER DIAGRAM. An SVG <marker> is found by document id, so
     fixed ids repeat on every page that draws two diagrams (check:duplicate-ids
     on the Tool pages, fa#3124). The prefix is the caller's, or a hash of what
     the diagram draws, so it is the same on every build; the same diagram drawn
     twice on one page gets a counter. */
  var MK = model.idPrefix || (function () {
    var src = (model.label || "") + "|" + (model.classes || []).map(function (c) { return c.id; }).join("|"), h = 5381;
    for (var i = 0; i < src.length; i++) h = ((h * 33) ^ src.charCodeAt(i)) >>> 0;
    return "cd" + h.toString(36);
  })();
  var seenMk = classDiagram.__seen || (classDiagram.__seen = {});
  seenMk[MK] = (seenMk[MK] || 0) + 1;
  if (seenMk[MK] > 1) MK += "-" + seenMk[MK];
  var cls = model.classes || [], byId = {}, idx = {};
  /* Parallel edges (same ends, same kind) are ONE line with every field named:
     two lines drawn over each other show one label and lose the other. */
  var edges = [], par = {};
  (model.edges || []).forEach(function (e) {
    var k = e.from + "\u0000" + e.to + "\u0000" + e.kind, p = par[k];
    if (p) {
      if (e.via) p.via = p.via ? p.via + ", " + e.via : e.via;
      if (e.card && p.card !== e.card) p.card = p.card ? p.card + ", " + e.card : e.card;
      p.comp = p.comp || e.comp;
      return;
    }
    par[k] = p = { from: e.from, to: e.to, kind: e.kind, via: e.via, card: e.card, comp: e.comp };
    edges.push(p);
  });
  cls.forEach(function (c, i) { byId[c.id] = c; idx[c.id] = i; });
  function rowsOf(c) {
    if (c.und) return [{ t: c.note || "could not determine", und: true }];
    var rows = (c.fields || []).map(function (f) {
      return { name: f.name, type: f.type, card: f.card, href: f.href, note: f.note };
    });
    if (c.values && c.values.length) rows.push({ name: "«enum»", type: c.values.join(" | ") });
    if (rows.length > MAXR) {
      var more = rows.length - MAXR;
      rows = rows.slice(0, MAXR).concat([{ t: "… " + more + " more" }]);
    }
    return rows;
  }
  function rowText(r) {
    if (r.t) return r.t;
    return r.name + " : " + r.type + (r.card ? " [" + r.card + "]" : "") + (r.note ? " {" + clip(r.note, 28) + "}" : "");
  }
  function clip(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  cls.forEach(function (c) {
    c.__rows = rowsOf(c);
    var w = Math.max(c.name.length + 2, ("«" + c.source + "»").length + 4, 12);
    c.__rows.forEach(function (r) { w = Math.max(w, rowText(r).length); });
    c.__w = Math.min(w, MAXC) * CH + PAD * 2;
    c.__h = HEAD + (c.__rows.length ? c.__rows.length * LH + 8 : 0);
  });
  /* Layers: a parent above its child, a referrer above what it references.
     Relaxed a bounded number of times, so a cycle settles instead of hanging. */
  var layer = cls.map(function () { return 0; });
  for (var it = 0; it < cls.length + 1; it++) {
    var moved = false;
    edges.forEach(function (e) {
      var a = idx[e.from], b = idx[e.to];
      if (a === undefined || b === undefined || a === b) return;
      var top = e.kind === "extends" ? b : a, bot = e.kind === "extends" ? a : b;
      if (layer[bot] < layer[top] + 1 && layer[top] + 1 < cls.length) { layer[bot] = layer[top] + 1; moved = true; }
    });
    if (!moved) break;
  }
  var byLayer = {}, lkeys = [];
  cls.forEach(function (c, i) { if (!byLayer[layer[i]]) { byLayer[layer[i]] = []; lkeys.push(layer[i]); } byLayer[layer[i]].push(c); });
  lkeys.sort(function (x, y) { return x - y; });
  /* A layer wider than the budget wraps into bands, so the picture stays
     legible at 1:1 instead of centring its subject off to one side. */
  var BUDGET = Math.max(model.maxWidth || 1100, 320), rows = {}, keys = [], band = 0;
  lkeys.forEach(function (k) {
    var cur = [], w = 0;
    byLayer[k].forEach(function (c) {
      if (cur.length && w + GX + c.__w > BUDGET) { rows[band] = cur; keys.push(band++); cur = []; w = 0; }
      w += (cur.length ? GX : 0) + c.__w; cur.push(c);
    });
    rows[band] = cur; keys.push(band++);
  });
  var W = 0;
  keys.forEach(function (k) {
    var w = -GX; rows[k].forEach(function (c) { w += c.__w + GX; }); rows[k].__w = w; W = Math.max(W, w);
  });
  var y = 8, bandTop = {}, bandBot = {};
  keys.forEach(function (k) {
    var x = (W - rows[k].__w) / 2, hmax = 0;
    rows[k].forEach(function (c) { c.__x = x; c.__y = y; c.__band = k; x += c.__w + GX; hmax = Math.max(hmax, c.__h); });
    bandTop[k] = y; bandBot[k] = y + hmax;
    y += hmax + GY;
  });
  /* A vertical lane that crosses no box of bands a..b (exclusive): the gaps
     between boxes, or the margins, which are always free. Nearest to x wins. */
  function lane(a, b, x) {
    var cands = [-GX / 2, W + GX / 2];
    for (var k = a + 1; k < b; k++) rows[k].forEach(function (c, i) {
      cands.push(c.__x - GX / 2);
      if (i === rows[k].length - 1) cands.push(c.__x + c.__w + GX / 2);
    });
    var best = null;
    cands.forEach(function (cx) {
      for (var k = a + 1; k < b; k++) {
        for (var i = 0; i < rows[k].length; i++) {
          var c = rows[k][i];
          if (cx > c.__x - 4 && cx < c.__x + c.__w + 4) return;
        }
      }
      if (best === null || Math.abs(cx - x) < Math.abs(best - x)) best = cx;
    });
    return best === null ? x : best;
  }
  var H = y - GY + 14, parts = [], right = W, left = 0;
  /* Edges leaving one box start at separate points along its bottom, so a
     composition's diamond is never shared with a plain reference. */
  var outs = {}, seenOut = {};
  edges.forEach(function (e) {
    if (e.kind === "extends" || e.from === e.to || !byId[e.from] || !byId[e.to]) return;
    outs[e.from] = (outs[e.from] || 0) + 1;
  });
  var fanout = {};
  edges.forEach(function (e, i) {
    var a = byId[e.from], b = byId[e.to];
    if (!a || !b) return;
    var t = (e.via || "") + (e.card ? " [" + e.card + "]" : "");
    if (a === b) {
      var sx = a.__x + a.__w, sy = a.__y + 20;
      parts.push('<path class="cd-e" d="M' + sx + " " + sy + " h22 v28 h-22\" marker-end=\"url(#" + MK + "-tip)\"/>");
      if (t) parts.push('<text class="cd-l" x="' + (sx + 26) + '" y="' + (sy + 18) + '">' + esc(t) + "</text>");
      right = Math.max(right, sx + 30 + t.length * 6.4);
      return;
    }
    var up = e.kind === "extends", top = up ? b : a, bot = up ? a : b;
    var key = top.id + ">" + e.kind; fanout[key] = (fanout[key] || 0) + 1;
    var x1 = top.__x + top.__w / 2, y1 = top.__y + top.__h, x2 = bot.__x + bot.__w / 2, y2 = bot.__y;
    if (!up && outs[top.id] > 1) {
      seenOut[top.id] = (seenOut[top.id] || 0) + 1;
      x1 = top.__x + top.__w * seenOut[top.id] / (outs[top.id] + 1);
    }
    /* Turn in the gap just above the target's band, so a route to a lower
       band runs along a gap rather than across the boxes between. */
    var midY = y2 - GY / 2 + ((fanout[key] % 2) ? 0 : 8);
    if (y2 <= y1) { /* same row or upward: route around the right side */
      var rx = Math.max(top.__x + top.__w, bot.__x + bot.__w) + 18;
      var d0 = "M" + (top.__x + top.__w) + " " + (top.__y + 14) + " H" + rx + " V" + (bot.__y + 14) + " H" + (bot.__x + bot.__w);
      parts.push('<path class="cd-e' + (e.kind === "id-ref" ? " cd-id" : "") + '" d="' + d0 + '" marker-end="url(#' + MK + "-" + (up ? "gen" : "tip") + ')"/>');
      right = Math.max(right, rx + 4);
      return;
    }
    var d = up ? "M" + x2 + " " + y2 + " V" + midY + " H" + x1 + " V" + y1 : "M" + x1 + " " + y1 + " V" + midY + " H" + x2 + " V" + y2;
    if (!up && bot.__band > top.__band + 1) {
      /* Bands lie between: leave through the first gap, run down a free lane,
         turn in the gap above the target. */
      var g1 = bandTop[top.__band + 1] - GY / 2 + ((fanout[key] % 3) * 4);
      var lx0 = lane(top.__band, bot.__band, (x1 + x2) / 2) + ((fanout[key] % 3) - 1) * 4;
      d = "M" + x1 + " " + y1 + " V" + g1 + " H" + lx0 + " V" + midY + " H" + x2 + " V" + y2;
      right = Math.max(right, lx0 + 4);
      left = Math.min(left, lx0 - 4);
    }
    parts.push('<path class="cd-e' + (e.kind === "id-ref" ? " cd-id" : "") + '" d="' + d + '" marker-end="url(#' + MK + "-" + (up ? "gen" : "tip") + ')"' +
      (e.comp ? ' marker-start="url(#' + MK + '-dia)"' : "") + "/>");
    if (t && !up) {
      var tw = t.length * 6.4 + 8, lx = x2 + 6, ly = y2 - 12;
      parts.push('<rect class="cd-lb" x="' + (lx - 3) + '" y="' + (ly - 10) + '" width="' + tw + '" height="14" rx="2"/>');
      parts.push('<text class="cd-l" x="' + lx + '" y="' + ly + '">' + esc(t) + "</text>");
      right = Math.max(right, lx + tw);
    }
  });
  cls.forEach(function (c) {
    var k = "cd-box" + (c.source === "skill" ? " cd-skill" : "") + (c.sel ? " cd-sel" : "") + (c.ext ? " cd-ext" : "") + (c.und ? " cd-und" : "");
    var g = '<g class="cd-n" data-id="' + esc(c.id) + '"><title>' + esc(c.name + (c.und ? " — could not be determined" : "")) + "</title>" +
      '<rect class="' + k + '" x="' + c.__x + '" y="' + c.__y + '" width="' + c.__w + '" height="' + c.__h + '" rx="4"/>' +
      '<text class="cd-st" x="' + (c.__x + c.__w - 6) + '" y="' + (c.__y + 12) + '" text-anchor="end">' + esc("«" + (c.ext ? "external" : c.source) + "»") + "</text>";
    var title = '<text class="cd-t" x="' + (c.__x + c.__w / 2) + '" y="' + (c.__y + 27) + '" text-anchor="middle">' + esc(clip(c.name, MAXC)) + "</text>";
    g += c.href ? '<a class="cd-a" href="' + esc(c.href) + '">' + title + "</a>" : title;
    if (c.__rows.length) {
      g += '<line class="cd-e" x1="' + c.__x + '" y1="' + (c.__y + HEAD) + '" x2="' + (c.__x + c.__w) + '" y2="' + (c.__y + HEAD) + '"/>';
      c.__rows.forEach(function (r, i) {
        var ty = c.__y + HEAD + 15 + i * LH, tx = c.__x + PAD;
        if (r.t) { g += '<text class="' + (r.und ? "cd-n-note" : "cd-f") + '" x="' + tx + '" y="' + ty + '">' + esc(clip(r.t, MAXC)) + "</text>"; return; }
        var head = r.name + " : ", type = clip(r.type, Math.max(8, MAXC - head.length - (r.card ? r.card.length + 3 : 0) - (r.note ? Math.min(r.note.length, 28) + 3 : 0)));
        g += '<text class="cd-f" x="' + tx + '" y="' + ty + '">' + esc(head) +
          (r.href ? '<a class="cd-a" href="' + esc(r.href) + '"><tspan class="cd-ty">' + esc(type) + "</tspan></a>" : "<tspan>" + esc(type) + "</tspan>") +
          (r.card ? '<tspan class="cd-c"> [' + esc(r.card) + "]</tspan>" : "") +
          (r.note ? '<tspan class="cd-k"> {' + esc(clip(r.note, 28)) + "}</tspan>" : "") + "</text>";
      });
    }
    parts.push(g + "</g>");
    delete c.__rows;
  });
  var VX = Math.floor(Math.min(left, 0)) - 2, VW = Math.ceil(right + 8) - VX;
  return '<svg class="cd" viewBox="' + VX + " 0 " + VW + " " + H + '" width="' + VW + '" height="' + H + '" role="img" aria-label="' +
    esc(model.label || "Class diagram") + '"><defs>' +
    '<marker id="' + MK + '-gen" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M1 1 L13 7 L1 13 z" class="cd-genhead"/></marker>' +
    '<marker id="' + MK + '-tip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" class="cd-tiphead"/></marker>' +
    '<marker id="' + MK + '-dia" viewBox="0 0 16 10" refX="1" refY="5" markerWidth="14" markerHeight="9" orient="auto"><path d="M1 5 L8 1 L15 5 L8 9 z" class="cd-diahead"/></marker></defs>' +
    parts.join("") + "</svg>";
}
`;

/**
 * The diagram's stylesheet: classes `cd-*`, colours from the `uml.css` tokens
 * with the same fallbacks that file declares. Diagrams render light in both
 * colour schemes, as `uml.css` says of every UML figure.
 */
export const CLASS_DIAGRAM_CSS = `
.cd { max-width: none; height: auto; display: block; }
.cd-box { fill: var(--fa-uml-schema, #e9edf3); stroke: var(--fa-uml-edge, #1b2432); stroke-width: 1; }
.cd-box.cd-skill { fill: var(--fa-uml-scenario, #e8f0ee); }
.cd-box.cd-sel { stroke: #2f5d9e; stroke-width: 2.2; }
.cd-box.cd-ext { fill: var(--fa-uml-other, #f4f4f1); stroke-dasharray: 2 3; }
.cd-box.cd-und { fill: var(--fa-uml-other, #f4f4f1); stroke-dasharray: 5 4; }
.cd-t { fill: var(--fa-uml-edge, #1b2432); font: 600 12px ui-monospace, Menlo, Consolas, monospace; }
.cd-st { fill: #4a5568; font: 10px ui-monospace, Menlo, Consolas, monospace; }
.cd-f { fill: var(--fa-uml-edge, #1b2432); font: 11px ui-monospace, Menlo, Consolas, monospace; }
.cd-c { fill: #4a5568; }
.cd-k { fill: #7a3e9d; font-style: italic; }
.cd-n-note { fill: #8a4b00; font: italic 11px ui-sans-serif, system-ui, sans-serif; }
.cd-e { stroke: var(--fa-uml-edge, #1b2432); fill: none; stroke-width: 1.2; }
.cd-e.cd-id { stroke-dasharray: 5 4; }
.cd-l { fill: var(--fa-uml-edge, #1b2432); font: 10.5px ui-monospace, Menlo, Consolas, monospace; }
.cd-lb { fill: #fbfcfd; }
.cd-genhead { fill: #fbfcfd; stroke: var(--fa-uml-edge, #1b2432); stroke-width: 1.2; }
.cd-tiphead { fill: none; stroke: var(--fa-uml-edge, #1b2432); stroke-width: 1.3; }
.cd-diahead { fill: var(--fa-uml-edge, #1b2432); }
.cd-a { cursor: pointer; }
.cd-a .cd-ty { fill: #2f5d9e; text-decoration: underline; }
.cd-a:hover .cd-t, .cd-a:focus-visible .cd-t { fill: #2f5d9e; text-decoration: underline; }
.cd-wrap { overflow-x: auto; background: #fbfcfd; border: 1px solid #d5dbe3; border-radius: 6px; padding: 8px; margin: 8px 0 16px; }
`;

let compiled: ((m: DiagramModel) => string) | undefined;

/** Draw `model` to an SVG string, with the very code the viewer runs. */
export function renderClassDiagram(model: DiagramModel): string {
  compiled ??= new Function(`${CLASS_DIAGRAM_JS}; return classDiagram;`)() as (m: DiagramModel) => string;
  // The renderer annotates classes while laying out; give it copies.
  return compiled({ ...model, classes: model.classes.map((c) => ({ ...c })), edges: model.edges.map((e) => ({ ...e })) });
}

/**
 * The diagram of some declarations of the class model — a skill's contracts,
 * a Tool's MCP input schema — built the way the viewer builds one, so the
 * boxes match.
 *
 * `hrefOf` links a class (e.g. to its row in the schemas viewer); a type that
 * is not a declaration links to its definition through `type-links.ts`.
 */
export function diagramOfDecls(
  decls: readonly SchemaDecl[],
  edges: readonly SchemaEdge[],
  opts: { focus?: readonly string[]; hrefOf?: (d: SchemaDecl) => string | undefined; label?: string } = {},
): DiagramModel {
  const ids = new Set(decls.map((d) => d.id));
  const byName = new Map(decls.map((d) => [d.name, d]));
  const classes: DiagramClass[] = decls.map((d) => {
    const source = sourceOfKind(d.kind === "undetermined" ? (d.module.endsWith(".json") ? "json-schema" : "zod-object") : d.kind);
    const href = opts.hrefOf?.(d);
    return {
      id: d.id,
      name: d.name,
      source,
      fields: d.fields.map((f) => {
        const type = umlType(source, f.type);
        const target = byName.get(type.replace(/\[\]$/, ""));
        const link = target ? opts.hrefOf?.(target) : typeLink(source, type, f.typeLinks);
        return { name: f.name, type, card: cardinalityOf(f), ...(link ? { href: link } : {}), ...(f.constraint ? { note: f.constraint } : {}) };
      }),
      ...(d.values.length ? { values: d.values } : {}),
      ...(opts.focus?.includes(d.id) ? { sel: true } : {}),
      ...(d.kind === "undetermined" ? { und: true, note: d.note ?? "could not determine" } : {}),
      ...(href ? { href } : {}),
    };
  });
  const out: DiagramEdge[] = [];
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    const from = decls.find((d) => d.id === e.from)!;
    const f = from.fields.find((x) => x.name === e.via);
    const to = decls.find((d) => d.id === e.to)!;
    out.push({
      from: e.from,
      to: e.to,
      kind: e.kind,
      ...(e.via ? { via: e.via } : {}),
      ...(f && e.kind !== "extends" ? { card: cardinalityOf(f) } : {}),
      // A nested class (`Parent.part`) is composed, not referenced.
      ...(to.name.startsWith(`${from.name}.`) ? { comp: true } : {}),
    });
  }
  return { classes, edges: out, ...(opts.label ? { label: opts.label } : {}) };
}

/** The stylesheet as a tag, emitted once by a page that draws diagrams. */
export const CLASS_DIAGRAM_STYLE = `<style>${CLASS_DIAGRAM_CSS.replace(/\s*\n\s*/g, " ").trim()}</style>`;

/** One contract document: a skill's input or output, a Tool's MCP input. */
export interface ContractDoc {
  /** `input`, `output`, or an MCP tool's name. */
  io: string;
  /** Repo-relative path, or a stable pseudo-path for a schema that is not a file. */
  file: string;
  schema: Record<string, unknown>;
  /** Where the contract's root class links: its page, or its file. */
  href?: string;
}

/**
 * The class diagram of what a skill or Tool takes and gives: the owner as a
 * `«skill»` / `«tool»` box with one edge per contract to that contract's root
 * class, and every class of every contract below it — read by the same JSON
 * Schema reader the schemas viewer uses and drawn by the same renderer.
 *
 * Returns one line of HTML (a `<div>` holding the SVG), safe in Markdown as a
 * raw block. Pair it with {@link CLASS_DIAGRAM_STYLE} once per page.
 */
export function contractDiagramHtml(
  owner: { name: string; source: "skill" | "tool"; href?: string },
  docs: readonly ContractDoc[],
): string {
  if (docs.length === 0) return "";
  const m = classModelOfDocuments(docs.map((d) => ({ text: JSON.stringify(d.schema), module: d.file })));
  const model = diagramOfDecls(m.decls, m.edges, { label: `${owner.name}: ${docs.map((d) => d.io).join(", ")}` });
  const ownerId = `owner:${owner.name}`;
  const fields: DiagramClass["fields"] = [];
  const edges: DiagramEdge[] = [];
  for (const d of docs) {
    const root = m.decls.find((x) => x.module === d.file);
    if (!root) continue;
    const box = model.classes.find((c) => c.id === root.id);
    if (box && d.href) box.href = d.href;
    fields.push({ name: d.io, type: root.name, card: "1..1", ...(d.href ? { href: d.href } : {}) });
    edges.push({ from: ownerId, to: root.id, kind: "field", via: d.io, card: "1..1" });
  }
  model.classes.unshift({ id: ownerId, name: owner.name, source: owner.source, fields, sel: true, ...(owner.href ? { href: owner.href } : {}) });
  model.edges.unshift(...edges);
  return `<div class="cd-wrap">${renderClassDiagram(model)}</div>`;
}
