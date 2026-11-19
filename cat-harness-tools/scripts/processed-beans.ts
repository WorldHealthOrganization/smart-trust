/**
 * Beans by process: which beans sit at which BPMN step, across every workflow
 * instance of a bean store, and the same view for one bean.
 *
 * @module scripts/processed-beans
 * @covers none — it JOINS committed workflow instances with the store's beans
 *   and the diagrams they run; the state visualiser renders the two pages
 *
 * ## Two pages, one projection
 *
 * `workflow-view.ts` draws one page per INSTANCE. This adds the two views it
 * lacks: `beans-processed/` (every process with an instance, each diagram
 * marked with how many beans wait at each step) and `bean-processed/?bean=<id>`
 * (one bean through every instance that names it). Both read one projection,
 * {@link processedBeansRows}, embedded in the page, so the filters (search,
 * process, last-updated to find stalled beans) run in the browser and the URL
 * query keeps them (`?q=&process=&stale=30`).
 *
 * ## Stuck states
 *
 * The stuck kinds are `stuckStatesOf`'s, plus two the table needs as words:
 * `bean-missing` (the instance names a bean the store does not hold) and
 * `node-missing` (a token sits on a step the current diagram no longer has,
 * so no marker can be drawn for it).
 *
 * ## Lazy drawings
 *
 * The diagrams are the SVGs `render:bpmn` already publishes. A page fetches
 * each one only when its card scrolls near the viewport.
 */
import type { BeanNode } from "./beans.ts";
import type { InstanceState } from "../src/workflow/instance.js";
import type { HistoryEvent } from "../src/workflow/work-plan-store.ts";
import { lastMoved, stuckStatesOf, STUCK_AFTER_DAYS, dayOf } from "./workflow-view.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A bean an instance names, as the page shows it. */
export interface ProcessedBean {
  id: string;
  /** False when the store does not hold this bean (deleted, or another store's). */
  found: boolean;
  title?: string;
  status?: string;
  updatedAt?: string;
  /** The bean's source file on the forge, on the branch that keeps it. */
  source?: string;
  /** Completed or scrapped: what the open/closed filter reads (owner, 2026-11-03). */
  closed?: boolean;
  /** The start of the bean's body, so a reader can read it from the diagram. */
  excerpt?: string;
}

/** A bean no instance names: listed on the store's all-beans page so an empty diagram is not an empty store. */
export interface UnplacedBean {
  id: string;
  title: string;
  status: string;
  closed: boolean;
  updatedAt?: string;
  source?: string;
  excerpt?: string;
  /** Its page under `bean-processed/`, when it has one, relative to the store page. */
  href?: string;
  /** On the combined page: the store it is from. */
  store?: string;
}

/**
 * Route segments a store may not be named: the combined page sits beside the
 * store pages at `…/beans/beans-processed/` (owner, 2026-11-03), and a store
 * of the same name would be overwritten by it.
 */
export const RESERVED_STORE_NAMES: ReadonlySet<string> = new Set(["beans-processed", "bean-processed"]);

/** The statuses a bean is closed in. */
export const CLOSED_STATUSES: ReadonlySet<string> = new Set(["completed", "scrapped"]);

const EXCERPT = 600;
/** The body's first {@link EXCERPT} characters, front matter already gone. */
export function excerptOf(body: string | undefined): string | undefined {
  const t = (body ?? "").trim();
  if (!t) return undefined;
  return t.length > EXCERPT ? `${t.slice(0, EXCERPT - 1)}…` : t;
}

/** One instance, joined with its beans and its diagram. */
export interface ProcessedRow {
  instance: string;
  /** The per-instance page, relative to the page embedding this row. */
  href?: string;
  process: string;
  source: string;
  /** The published SVG, relative to the page, when one is published. */
  drawing?: string;
  /** The processes viewer's page for this diagram, relative to the page. */
  processPage?: string;
  /** The `.bpmn` file on the forge. */
  sourceHref?: string;
  status: string;
  /** Completed, or every token rests on an end event, or no token at all and completed. */
  finished: boolean;
  tokens: string[];
  /** Steps in the history, other than where the tokens are. */
  done: string[];
  lastMoved?: string;
  /** Whole days between `lastMoved` and the build's reference time. */
  ageDays?: number;
  beans: ProcessedBean[];
  /** Stuck kinds, by word: `stuckStatesOf`'s plus `bean-missing` and `node-missing`. */
  stuck: string[];
  /** Tokens on steps the current diagram does not have. */
  missingNodes: string[];
  /** On the combined page: the store the row is from, and that store's page relative to this one. */
  store?: string;
  up?: string;
  /**
   * Where a FINISHED instance ended: its tokens when they rest on an end event,
   * else the last step in its history. Empty while it runs. A finished instance
   * holds no live token, and without this its beans vanished from the diagram
   * (Process_SampleImport, owner, 2026-11-03).
   */
  endedAt: string[];
}

/**
 * One bean's history for its page (cat-harness#991 step 5; owner, 2026-11-03:
 * "show all the processes and the bean stepping through it"). `drawings` maps
 * each process in the history to its published drawing, relative to the page.
 * `unknown` says why the history could not be read: never an empty one.
 */
export type ProcessedBeanHistory = { events: HistoryEvent[]; drawings: Record<string, string> } | { unknown: string };

/** What {@link processedBeansRows} reads. */
export interface ProcessedBeansInput {
  instances: readonly InstanceState[];
  beans: readonly BeanNode[];
  now: Date;
  /** Each instance's diagram node ids and end events, by instance id, when its diagram was found. */
  diagrams: ReadonlyMap<string, { nodes: ReadonlySet<string>; ends: ReadonlySet<string> }>;
  drawingFor: (source: string) => string | undefined;
  instanceHref: (id: string) => string | undefined;
  /** A bean's source file on the forge. */
  beanSource?: (b: BeanNode) => string | undefined;
  /** The processes viewer's page for a `.bpmn` path. */
  processPageFor?: (source: string) => string | undefined;
  /** A `.bpmn` path's file on the forge. */
  sourceHrefFor?: (source: string) => string | undefined;
}

/** The projection both pages embed. Pure: the same input gives the same rows. */
export function processedBeansRows(input: ProcessedBeansInput): ProcessedRow[] {
  const byId = new Map(input.beans.map((b) => [b.id, b]));
  return input.instances
    .map((s): ProcessedRow => {
      const diagram = input.diagrams.get(s.id);
      const ends = diagram?.ends ?? new Set<string>();
      const atEnd = s.tokens.length > 0 && s.tokens.every((t) => ends.has(t));
      const finished = s.status === "completed" || atEnd;
      const ids = [...new Set([...(s.bean ? [s.bean] : []), ...(s.carriedBeans ?? [])])];
      const beans = ids.map((id): ProcessedBean => {
        const b = byId.get(id);
        if (!b) return { id, found: false };
        const source = input.beanSource?.(b);
        const excerpt = excerptOf(b.body);
        return {
          id,
          found: true,
          title: b.title,
          status: b.status,
          updatedAt: b.updatedAt,
          closed: CLOSED_STATUSES.has(b.status),
          ...(source ? { source } : {}),
          ...(excerpt ? { excerpt } : {}),
        };
      });
      const missingNodes = diagram ? s.tokens.filter((t) => !diagram.nodes.has(t)) : [];
      const stuck = [...new Set(stuckStatesOf(s, input.beans, input.now, ends).map((x) => x.kind as string))];
      if (!finished && beans.some((b) => !b.found)) stuck.push("bean-missing");
      if (missingNodes.length > 0) stuck.push("node-missing");
      const moved = lastMoved(s);
      const movedMs = moved ? Date.parse(moved) : Number.NaN;
      const tokens = new Set(s.tokens);
      const done = [...new Set((s.history ?? []).map((h) => h.node).filter((n): n is string => typeof n === "string" && !tokens.has(n)))];
      const drawing = s.source ? input.drawingFor(s.source) : undefined;
      const href = input.instanceHref(s.id);
      const processPage = s.source ? input.processPageFor?.(s.source) : undefined;
      const sourceHref = s.source ? input.sourceHrefFor?.(s.source) : undefined;
      return {
        instance: s.id,
        ...(href ? { href } : {}),
        process: s.processId,
        source: s.source ?? "",
        ...(drawing ? { drawing } : {}),
        ...(processPage ? { processPage } : {}),
        ...(sourceHref ? { sourceHref } : {}),
        status: s.status ?? "",
        finished,
        tokens: [...s.tokens],
        done,
        ...(moved ? { lastMoved: moved } : {}),
        ...(Number.isNaN(movedMs) ? {} : { ageDays: Math.floor((input.now.getTime() - movedMs) / DAY_MS) }),
        beans,
        stuck,
        missingNodes,
        endedAt: !finished ? [] : atEnd ? [...s.tokens] : (s.history ?? []).map((h) => h.node).filter((n): n is string => typeof n === "string").slice(-1),
      };
    })
    .sort((a, b) => (a.lastMoved ?? "").localeCompare(b.lastMoved ?? "") || a.instance.localeCompare(b.instance));
}

/** The store's beans that no row names, newest first. */
export function unplacedBeans(beans: readonly BeanNode[], rows: readonly ProcessedRow[], beanSource?: (b: BeanNode) => string | undefined): UnplacedBean[] {
  const named = new Set(rows.flatMap((r) => r.beans.map((b) => b.id)));
  return beans
    .filter((b) => !named.has(b.id))
    .map((b): UnplacedBean => {
      const source = beanSource?.(b);
      const excerpt = excerptOf(b.body);
      return {
        id: b.id,
        title: b.title,
        status: b.status,
        closed: CLOSED_STATUSES.has(b.status),
        ...(b.updatedAt ? { updatedAt: b.updatedAt } : {}),
        ...(source ? { source } : {}),
        ...(excerpt ? { excerpt } : {}),
      };
    })
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.id.localeCompare(b.id));
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** JSON safe inside a `<script>` element. */
function scriptJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c");
}

/** The pages' own styles. Ink follows the theme; a state is told by its word, never by hue alone. */
export const PB_CSS = `.pb-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.6rem; margin: 0 0 1rem; }
.pb-filters label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.8rem; font-weight: 600; }
.pb-filters input, .pb-filters select { font: inherit; font-size: 0.95rem; padding: 0.35rem 0.45rem; min-width: 0; }
.pb-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 1rem; padding: 0; list-style: none; }
.pb-chips li::before { content: none; }
.pb-chip { border: 1px solid rgba(127,127,127,0.5); border-radius: 999px; padding: 0.05rem 0.6rem; font-size: 0.8rem; }
.pb-chip.is-stalled { border-color: #b86a00; border-width: 2px; }
.pb-chip.is-broken { border-color: #b3263e; border-width: 2px; border-style: dashed; }
.pb-card { border: 1px solid rgba(127,127,127,0.4); border-radius: 8px; padding: 0.8rem 1rem; margin: 0 0 1rem; }
.pb-card h2 { font-size: 1.05rem; margin: 0 0 0.2rem; }
.pb-diagram { overflow-x: auto; background: #fff; border-radius: 6px; margin: 0.5rem 0; min-height: 4rem; }
.pb-diagram svg { display: block; min-width: 56rem; max-width: none; height: auto; }
.pb-diagram .pb-token .djs-visual > :first-child { stroke: #0d6e78 !important; stroke-width: 5px !important; }
.pb-diagram .pb-token.pb-stalled .djs-visual > :first-child { stroke: #b86a00 !important; }
.pb-diagram .pb-done .djs-visual > :first-child { stroke-dasharray: 6 4 !important; }
.pb-mark { cursor: pointer; }
.pb-mark text { font: 600 18px ui-monospace, monospace; fill: #fff; }
.pb-table { overflow-x: auto; }
.pb-table table { font-size: 0.85rem; font-variant-numeric: tabular-nums; }
.pb-table button { all: unset; cursor: pointer; text-decoration: underline; }
.pb-hist { list-style: none; padding: 0; margin: 0; }
.pb-hist li::before { content: none; }
.pb-hist li { margin: 0 0 0.4rem; font-size: 0.85rem; }
.pb-steps { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin: 0.5rem 0; }
.pb-steps button { font: inherit; font-size: 0.9rem; min-width: 2.75rem; min-height: 2.75rem; padding: 0.3rem 0.7rem; border-radius: 6px; border: 1px solid rgba(127,127,127,0.6); background: transparent; color: inherit; cursor: pointer; }
.pb-steps button:focus-visible, .pb-steps input:focus-visible { outline: 3px solid #0d6e78; outline-offset: 2px; }
.pb-steps input[type=range] { flex: 1 1 12rem; min-height: 2.75rem; }
.pb-now { border-left: 4px solid #0d6e78; padding: 0.4rem 0.8rem; margin: 0.5rem 0; }
.pb-events { list-style: none; padding: 0; margin: 0.5rem 0 0; max-height: 18rem; overflow-y: auto; font-size: 0.85rem; }
.pb-events li::before { content: none; }
.pb-events li { padding: 0.2rem 0.4rem; border-radius: 4px; cursor: pointer; }
.pb-events li[aria-current="step"] { outline: 2px solid #0d6e78; font-weight: 600; }
.pb-diagram .pb-ended .djs-visual > :first-child { stroke: #555 !important; stroke-width: 4px !important; }
.pb-list { list-style: none; padding: 0; margin: 0.5rem 0; }
.pb-list li::before { content: none; }
.pb-list li { border-top: 1px solid rgba(127,127,127,0.3); padding: 0.4rem 0; font-size: 0.9rem; }
.pb-list details { margin: 0.2rem 0 0; }
.pb-list details p, .pb-detail details p { white-space: pre-wrap; font-size: 0.85rem; margin: 0.3rem 0; }
.pb-detail { border-left: 4px solid #0d6e78; }
.pb-stores { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; border: 1px solid rgba(127,127,127,0.4); border-radius: 6px; margin: 0 0 1rem; padding: 0.4rem 0.8rem; }
.pb-stores label { display: flex; align-items: center; gap: 0.3rem; min-height: 2.75rem; }
.pb-stores input { width: 1.25rem; height: 1.25rem; }
.pb-live { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; font-size: 0.9rem; margin: 0 0 0.8rem; }
.pb-live input { width: 1.25rem; height: 1.25rem; }
.pb-detail button { font: inherit; min-height: 2.75rem; padding: 0.3rem 0.7rem; border-radius: 6px; border: 1px solid rgba(127,127,127,0.6); background: transparent; color: inherit; cursor: pointer; }`;

/**
 * The client: reads the embedded rows, filters them from the form (kept in the
 * URL query), draws one card per process and a table, and fetches a card's
 * drawing only when it nears the viewport.
 */
const PB_SCRIPT = String.raw`<script>
(function () {
  var root = document.querySelector("[data-pb]");
  if (!root) return;
  var ROWS = JSON.parse(document.getElementById("pb-rows").textContent);
  var MODE = root.getAttribute("data-pb");
  var STALL = +root.getAttribute("data-pb-stall");
  var UP = root.getAttribute("data-pb-up");
  var seg = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
  // On the combined page a row carries its own store's page as "up".
  var upOf = function (r) { return (r && r.up) || UP; };
  var beanHref = function (id, r) { return seg.test(id) ? upOf(r) + "bean-processed/" + id + "/" : null; };
  var procHref = function (id, r) { return seg.test(id) ? upOf(r) + "beans-processed/" + id + "/" : null; };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var stalled = function (r) { return !r.finished && r.ageDays != null && r.ageDays > STALL; };
  var cache = {};
  function fetchSvg(href) {
    if (!cache[href]) {
      var url = new URL(href, document.baseURI);
      cache[href] = fetch(url).then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); }).then(function (t) { return { text: t, url: url }; });
    }
    return cache[href];
  }
  // Draws the diagram into host and marks steps: marks = { node: { rows: [...], done: bool } }.
  function draw(host, href, marks, onMark) {
    fetchSvg(href).then(function (got) {
      var svg = new DOMParser().parseFromString(got.text, "image/svg+xml").documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== "svg") return;
      svg.querySelectorAll("script").forEach(function (s) { s.remove(); });
      svg.querySelectorAll("a").forEach(function (a) {
        ["href", "xlink:href"].forEach(function (k) { var h = a.getAttribute(k); if (h) a.setAttribute(k, new URL(h, got.url).href); });
      });
      svg = document.importNode(svg, true);
      host.replaceChildren(svg);
      Object.keys(marks).forEach(function (node) {
        var m = marks[node];
        var g = svg.querySelector('g.djs-element[data-element-id="' + CSS.escape(node) + '"]');
        if (!g) return;
        var fin = m.fin || [];
        if (!m.rows.length && !fin.length) { g.classList.add("pb-done"); return; }
        var late = m.rows.some(stalled);
        g.classList.add(m.rows.length ? "pb-token" : "pb-ended");
        if (late) g.classList.add("pb-stalled");
        var bb = g.getBBox(), t = g.transform.baseVal.consolidate();
        var tx = t ? t.matrix.e : 0, ty = t ? t.matrix.f : 0;
        var label = m.rows.length ? m.rows.length + (late ? " stalled" : "") : fin.length + " finished";
        var w = 24 + label.length * 11, x = tx + bb.x + bb.width - w / 2, y = ty + bb.y - 30;
        var ns = "http://www.w3.org/2000/svg";
        var mk = document.createElementNS(ns, "g");
        mk.setAttribute("class", "pb-mark"); mk.setAttribute("tabindex", "0"); mk.setAttribute("role", "button");
        var title = document.createElementNS(ns, "title");
        title.textContent = m.rows.concat(fin).map(function (r) { return r.beans.map(function (b) { return b.id + " — " + (b.title || "bean not in this store"); }).join("\n"); }).join("\n");
        var rect = document.createElementNS(ns, "rect");
        rect.setAttribute("x", x); rect.setAttribute("y", y); rect.setAttribute("rx", 13); rect.setAttribute("width", w); rect.setAttribute("height", 26);
        rect.setAttribute("fill", !m.rows.length ? "#555" : late ? "#b86a00" : "#0d6e78");
        var text = document.createElementNS(ns, "text");
        text.setAttribute("x", x + 12); text.setAttribute("y", y + 19); text.textContent = label;
        mk.append(title, rect, text);
        if (onMark) {
          mk.setAttribute("aria-label", label + " at " + node + ": open the beans");
          mk.addEventListener("click", function () { onMark(node, m); });
          mk.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMark(node, m); } });
        }
        svg.append(mk);
      });
      // A badge sits above its step; on a step at the top of the drawing it
      // was cut off by the viewBox (owner, 2026-11-03). Grow the viewBox to hold it.
      try {
        var vb = svg.viewBox.baseVal, all = svg.getBBox();
        if (vb && vb.width) {
          var x0 = Math.min(vb.x, all.x - 4), y0 = Math.min(vb.y, all.y - 4);
          var x1 = Math.max(vb.x + vb.width, all.x + all.width + 4), y1 = Math.max(vb.y + vb.height, all.y + all.height + 4);
          svg.setAttribute("viewBox", [x0, y0, x1 - x0, y1 - y0].join(" "));
          svg.removeAttribute("height");
        }
      } catch (e) { /* a drawing without a viewBox keeps its own size */ }
    }).catch(function () { host.textContent = "The drawing could not be loaded; the steps are listed in the table."; });
  }
  function lazy(host, fn) {
    if (!("IntersectionObserver" in window)) return fn();
    var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); } }, { rootMargin: "300px" });
    io.observe(host);
  }
  function beanCell(r) {
    return r.beans.map(function (b) {
      var h = beanHref(b.id, r);
      return (h ? '<a href="' + esc(h) + '"><code>' + esc(b.id) + "</code></a> " : "<code>" + esc(b.id) + "</code> ") +
        (b.found ? esc(b.title) + ' <span class="pb-chip">' + esc(b.status) + "</span>" + (b.source ? ' <a href="' + esc(b.source) + '">source</a>' : "") : '<span class="pb-chip is-broken">not in this store</span>');
    }).join("<br>") || "none named";
  }
  function stuckCell(r) {
    return r.stuck.map(function (k) { return '<span class="pb-chip ' + (k === "enabled-not-taken" ? "is-stalled" : "is-broken") + '">' + esc(k) + "</span>"; }).join(" ") || "none found";
  }
  function stepCell(r) {
    return r.tokens.map(function (t) {
      return r.processPage ? '<a href="' + esc(r.processPage) + '#steps"><code>' + esc(t) + "</code></a>" : "<code>" + esc(t) + "</code>";
    }).join(", ") || "no step";
  }
  function procLinks(r) {
    return (r.processPage ? ' · <a href="' + esc(r.processPage) + '">process page</a>' : "") +
      (r.sourceHref ? ' · <a href="' + esc(r.sourceHref) + '">BPMN source</a>' : "");
  }
  function procName(proc, r) {
    var ph = procHref(proc, r);
    return ph ? '<a href="' + esc(ph) + '"><code>' + esc(proc) + "</code></a>" : "<code>" + esc(proc) + "</code>";
  }
  var isOpen = function (b) { return !b.closed; };
  var openMatch = function (sel, b) { return !sel || (sel === "closed" ? !!b.closed : isOpen(b)); };
  // One bean, readable where it is shown: status, links, and its body behind a disclosure.
  function beanDetail(b, extra, r) {
    // A bean in a process has a page; one in no process has none, so it is not linked to one.
    var h = b.href ? b.href : b.found !== undefined ? beanHref(b.id, r) : null;
    var st = (r && r.store) || b.store;
    return "<li>" + (st ? '<span class="pb-chip">' + esc(st) + "</span> " : "") + (h ? '<a href="' + esc(h) + '"><code>' + esc(b.id) + "</code></a> " : "<code>" + esc(b.id) + "</code> ") +
      (b.found === false ? '<span class="pb-chip is-broken">not in this store</span>' : esc(b.title) + ' <span class="pb-chip">' + esc(b.status) + "</span>") +
      (b.updatedAt ? " · updated " + esc(String(b.updatedAt).slice(0, 10)) : "") +
      (b.source ? ' · <a href="' + esc(b.source) + '">source</a>' : "") + (extra || "") +
      (b.excerpt ? "<details><summary>Read the bean</summary><p>" + esc(b.excerpt) + "</p></details>" : "") + "</li>";
  }
  function moved(r) { return r.lastMoved ? esc(r.lastMoved.slice(0, 10)) + " (" + r.ageDays + " days)" : "unknown"; }

  if (MODE === "index") {
    var FI = { q: $("pb-q"), beans: $("pb-open") };
    var ALL = JSON.parse(document.getElementById("pb-unplaced-data").textContent);
    var renderIndex = function () {
      var q = FI.q.value.trim().toLowerCase();
      var shown = ALL.filter(function (b) { return openMatch(FI.beans.value, b) && (!q || (b.id + " " + b.title).toLowerCase().indexOf(q) >= 0); });
      $("pb-chips").innerHTML = '<li class="pb-chip">' + shown.length + " of " + ALL.length + " beans</li>" +
        '<li class="pb-chip">' + ALL.filter(isOpen).length + " open</li>" +
        '<li class="pb-chip">' + ALL.filter(function (b) { return b.closed; }).length + " closed</li>";
      $("pb-index").innerHTML = shown.map(function (b) { return beanDetail(b); }).join("") || "<li>No bean matches these filters.</li>";
    };
    Object.keys(FI).forEach(function (k) { FI[k].addEventListener("input", renderIndex); });
    renderIndex();
    return;
  }
  if (MODE === "all") {
    var F = { q: $("pb-q"), process: $("pb-process"), state: $("pb-state"), bean: $("pb-beanstatus"), stale: $("pb-stale"), beans: $("pb-open") };
    // The combined page's store tick boxes (owner, 2026-11-03): every store on by default.
    var storeBoxes = [].slice.call(document.querySelectorAll("[data-pb-store-box]"));
    // "Include the stores it depends on" (owner, 2026-11-03: "needs dependencies"):
    // the ticked stores, widened by their needs, and theirs, all the way down.
    var needsEl = document.getElementById("pb-needs");
    var NEEDS = needsEl ? JSON.parse(needsEl.textContent) : {};
    var depsBox = $("pb-deps");
    var storeOn = function (name) {
      if (!storeBoxes.length || !name) return true;
      var on = storeBoxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      if (depsBox && depsBox.checked) {
        for (var i = 0; i < on.length; i++) (NEEDS[on[i]] || []).forEach(function (n) { if (on.indexOf(n) < 0) on.push(n); });
      }
      return on.indexOf(name) >= 0;
    };
    var unplacedEl = document.getElementById("pb-unplaced-data");
    var UNPLACED = unplacedEl ? JSON.parse(unplacedEl.textContent) : null;
    var detail = $("pb-detail");
    // A badge opens the beans at its step: read them, open their pages, or narrow the table.
    var openDetail = function (node, m) {
      var rs = m.rows.concat(m.fin || []);
      detail.innerHTML = "<h2>At <code>" + esc(node) + "</code>: " + rs.length + " instance(s)</h2>" +
        '<ul class="pb-list">' + rs.map(function (r) {
          var extra = " · " + (r.href ? '<a href="' + esc(r.href) + '">' + esc(r.instance) + "</a>" : esc(r.instance)) +
            " · " + (r.finished ? "finished" : "running") + " · last moved " + moved(r) + " " + stuckCell(r);
          return r.beans.map(function (b) { return beanDetail(b, extra, r); }).join("");
        }).join("") + "</ul>" +
        '<p><button type="button" id="pb-narrow">Show only these in the table</button> <button type="button" id="pb-close">Close</button></p>';
      detail.hidden = false;
      detail.focus();
      $("pb-narrow").addEventListener("click", function () { F.q.value = node; render(); $("pb-table").scrollIntoView(); });
      $("pb-close").addEventListener("click", function () { detail.hidden = true; });
    };
    var sortKey = "lastMoved", sortDir = 1;
    var match = function (r) {
      var q = F.q.value.trim().toLowerCase();
      var hay = [r.instance, r.process, r.tokens.join(" ")].concat(r.beans.map(function (b) { return b.id + " " + (b.title || ""); })).join(" ").toLowerCase();
      var st = F.stale.value === "" ? 0 : +F.stale.value;
      return (!q || hay.indexOf(q) >= 0) &&
        (!F.process.value || r.process === F.process.value) &&
        (!F.state.value || (F.state.value === "running" ? !r.finished : F.state.value === "finished" ? r.finished : r.stuck.length > 0)) &&
        (!F.bean.value || r.beans.some(function (b) { return (b.found ? b.status : "not in this store") === F.bean.value; })) &&
        r.beans.some(function (b) { return openMatch(F.beans.value, b); }) && storeOn(r.store) &&
        (!st || (!r.finished && (r.ageDays == null || r.ageDays > st)));
    };
    var render = function () {
      var rows = ROWS.filter(match);
      var procs = [];
      rows.forEach(function (r) { if (procs.indexOf(r.process) < 0) procs.push(r.process); });
      $("pb-chips").innerHTML =
        '<li class="pb-chip">' + rows.length + " of " + ROWS.length + " instances</li>" +
        '<li class="pb-chip">' + procs.length + " processes</li>" +
        '<li class="pb-chip is-stalled">' + rows.filter(stalled).length + " stalled: not moved in " + STALL + "+ days</li>" +
        '<li class="pb-chip is-broken">' + rows.filter(function (r) { return r.stuck.indexOf("bean-closed") >= 0; }).length + " running on a closed bean</li>" +
        '<li class="pb-chip is-broken">' + rows.filter(function (r) { return r.stuck.indexOf("bean-missing") >= 0; }).length + " bean not in this store</li>";
      var cards = $("pb-cards");
      cards.replaceChildren();
      procs.forEach(function (proc) {
        var its = rows.filter(function (r) { return r.process === proc; });
        var marks = {};
        its.forEach(function (r) {
          if (!r.finished) r.tokens.forEach(function (t) { (marks[t] = marks[t] || { rows: [], fin: [] }).rows.push(r); });
          else r.endedAt.forEach(function (t) { (marks[t] = marks[t] || { rows: [], fin: [] }).fin.push(r); });
        });
        var missing = [];
        its.forEach(function (r) { r.missingNodes.forEach(function (n) { if (missing.indexOf(n) < 0) missing.push(n); }); });
        var withDrawing = its.filter(function (r) { return r.drawing; })[0];
        var card = document.createElement("section");
        card.className = "pb-card";
        card.innerHTML = "<h2>" + procName(proc, its[0]) + '</h2><p class="sv-sub"><code>' + esc(its[0].source) + "</code>" + procLinks(its[0]) + " · " +
          its.filter(function (r) { return !r.finished; }).length + " running, " + its.filter(function (r) { return r.finished; }).length +
          " finished. A badge counts the beans at a step (running, stalled, or finished there); select it to read them.</p>" +
          (withDrawing ? '<div class="pb-diagram"><p class="sv-sub">The drawing loads when this card scrolls into view.</p></div>' : '<p class="sv-sub">No drawing of this process is published, so the positions are in the table only.</p>') +
          (missing.length ? '<p class="sv-sub"><strong>node-missing</strong>: a token sits on ' + missing.map(function (n) { return "<code>" + esc(n) + "</code>"; }).join(", ") + ", which the current diagram does not have.</p>" : "");
        cards.append(card);
        if (withDrawing) {
          var host = card.querySelector(".pb-diagram");
          lazy(host, function () { draw(host, withDrawing.drawing, marks, openDetail); });
        }
      });
      rows.sort(function (a, b) { return String(a[sortKey] == null ? "" : a[sortKey]).localeCompare(String(b[sortKey] == null ? "" : b[sortKey])) * sortDir; });
      $("pb-tbody").innerHTML = rows.map(function (r) {
        return "<tr><td>" + beanCell(r) + "</td><td>" + (r.store ? '<span class="pb-chip">' + esc(r.store) + "</span> " : "") + procName(r.process, r) + "</td><td>" + stepCell(r) + "</td><td>" +
          (r.href ? '<a href="' + esc(r.href) + '">' + esc(r.instance) + "</a>" : esc(r.instance)) + " · " + (r.finished ? "finished" : "running") +
          "</td><td>" + moved(r) + "</td><td>" + stuckCell(r) + "</td></tr>";
      }).join("") || '<tr><td colspan="6">No instance matches these filters.</td></tr>';
      if (UNPLACED) {
        var q = F.q.value.trim().toLowerCase();
        var un = UNPLACED.filter(function (b) {
          return openMatch(F.beans.value, b) && storeOn(b.store) && (!F.bean.value || b.status === F.bean.value) && (!q || (b.id + " " + b.title).toLowerCase().indexOf(q) >= 0);
        });
        $("pb-unplaced").innerHTML = un.map(function (b) { return beanDetail(b); }).join("") || "<li>No bean outside a process matches these filters.</li>";
        $("pb-chips").insertAdjacentHTML("beforeend", '<li class="pb-chip">' + un.length + " of " + UNPLACED.length + " beans in no process</li>");
      }
    };
    Object.keys(F).forEach(function (k) { F[k].addEventListener("input", render); });
    storeBoxes.forEach(function (b) { b.addEventListener("change", render); });
    if (depsBox) depsBox.addEventListener("change", render);
    document.querySelectorAll("[data-pb-sort]").forEach(function (b) {
      b.addEventListener("click", function () { var k = b.getAttribute("data-pb-sort"); sortDir = sortKey === k ? -sortDir : 1; sortKey = k; render(); });
    });
    render();

    // The 5-second refresh (owner, 2026-11-03): only on a page served from this
    // machine, from the local store server's read-only route. The page keeps the
    // drawings and links it was built with; only the positions and beans move.
    var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (LOCAL && $("pb-live")) {
      $("pb-live").hidden = false;
      var STORE = root.getAttribute("data-pb-store"), PROC = root.getAttribute("data-pb-process");
      var liveBox = $("pb-live-on"), liveState = $("pb-live-state");
      var bases = [location.origin, "http://localhost:8080"], base = null, lastSig = "", timer = null;
      var merge = function (fresh) {
        var byInst = {}, byProc = {}, src = {};
        ROWS.forEach(function (r) {
          byInst[r.instance] = r;
          if (r.drawing && !byProc[r.process]) byProc[r.process] = r;
          r.beans.forEach(function (b) { if (b.source) src[b.id] = b.source; });
        });
        (UNPLACED || []).forEach(function (b) { if (b.source) src[b.id] = b.source; });
        var keepSrc = function (b) { if (src[b.id] && !b.source) b.source = src[b.id]; return b; };
        ROWS = fresh.rows.filter(function (r) { return !PROC || r.process === PROC; }).map(function (r) {
          var mine = byInst[r.instance], like = mine || byProc[r.process] || {};
          ["drawing", "processPage", "sourceHref"].forEach(function (k) { if (like[k]) r[k] = like[k]; });
          if (mine && mine.href) r.href = mine.href;
          r.beans.forEach(keepSrc);
          return r;
        });
        if (UNPLACED) UNPLACED = fresh.unplaced.map(keepSrc);
      };
      var tick = function () {
        var tryAt = base ? [base] : bases;
        (function attempt(i) {
          if (i >= tryAt.length) { base = null; liveState.textContent = "Live updates off: no local store server answered; showing the page as built."; return; }
          fetch(tryAt[i] + "/api/work-plan/beans-processed", { cache: "no-store" })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (x) {
              base = tryAt[i];
              if (!x.ok) { liveState.textContent = "Live: the local store could not be read (" + (x.j.error || "no reason given") + "); showing the last answer."; return; }
              if (x.j.store !== STORE) { liveState.textContent = "Live: the local server holds " + x.j.store + "'s work plan, not " + STORE + "'s."; return; }
              liveState.textContent = "Live · " + x.j.tool + " · checked " + String(x.j.at).slice(11, 19) + " UTC";
              var sig = JSON.stringify([x.j.rows, x.j.unplaced]);
              if (sig === lastSig) return;
              lastSig = sig;
              merge(x.j);
              render();
            })
            .catch(function () { attempt(i + 1); });
        })(0);
      };
      var start = function () { if (!timer) { tick(); timer = setInterval(tick, 5000); } };
      var stop = function () { if (timer) { clearInterval(timer); timer = null; } liveState.textContent = "Live updates paused."; };
      liveBox.addEventListener("change", function () { if (liveBox.checked) start(); else stop(); });
      start();
    }
  } else {
    var show = function () {
      var id = root.getAttribute("data-pb-bean");
      var its = ROWS.filter(function (r) { return r.beans.some(function (b) { return b.id === id; }); });
      var b = its.length ? its[0].beans.filter(function (x) { return x.id === id; })[0] : null;
      var out = $("pb-one");
      out.innerHTML = (b ? '<section class="pb-card"><h2><code>' + esc(id) + "</code></h2><p>" + (b.found ? esc(b.title) + ' <span class="pb-chip">' + esc(b.status) + "</span> · updated " + esc((b.updatedAt || "").slice(0, 10)) + (b.source ? ' · <a href="' + esc(b.source) + '">source</a>' : "") : '<span class="pb-chip is-broken">not in this store</span>') +
        '</p><p class="sv-sub">Named by ' + its.length + " workflow instance(s). Solid outline: where the token is; dashed: steps already in the history.</p></section>" : "") +
        its.map(function (r, i) {
          return '<section class="pb-card"><h2>' + procName(r.process, r) + "</h2><p>" + (r.href ? '<a href="' + esc(r.href) + '">' + esc(r.instance) + "</a>" : esc(r.instance)) +
            " · " + (r.finished ? "finished" : "running") + " · token at " + stepCell(r) + " · last moved " + moved(r) + procLinks(r) + "</p><p>" + stuckCell(r) + "</p>" +
            (r.drawing ? '<div class="pb-diagram" id="pb-d' + i + '"></div>' : '<p class="sv-sub">No drawing of this process is published.</p>') +
            (r.missingNodes.length ? '<p class="sv-sub"><strong>node-missing</strong>: ' + r.missingNodes.map(function (n) { return "<code>" + esc(n) + "</code>"; }).join(", ") + " is not in the current diagram.</p>" : "") +
            "</section>";
        }).join("");
      its.forEach(function (r, i) {
        if (!r.drawing) return;
        var marks = {};
        r.done.forEach(function (n) { marks[n] = { rows: [] }; });
        if (!r.finished) r.tokens.forEach(function (n) { marks[n] = { rows: [r] }; });
        else r.endedAt.forEach(function (n) { marks[n] = { rows: [], fin: [r] }; });
        var host = $("pb-d" + i);
        lazy(host, function () { draw(host, r.drawing, marks); });
      });
    };
    show();

    // The history stepper (owner, 2026-11-03): every event, the process the bean
    // was in at that moment drawn with its step, and keyboard and button controls.
    var histEl = document.getElementById("pb-history");
    var H = histEl ? JSON.parse(histEl.textContent) : null;
    if (H && H.events && H.events.length) {
      var EV = H.events, at = EV.length - 1, timer = null;
      var list = $("pb-events"), now = $("pb-now"), range = $("pb-at"), label = $("pb-at-label"), dia = $("pb-hist-diagram");
      var playBtn = document.querySelector('[data-pb-go="play"]');
      list.innerHTML = EV.map(function (e, i) {
        return '<li data-i="' + i + '"><time>' + esc(e.at.slice(0, 16).replace("T", " ")) + "</time> · " + esc(e.kind) + " · " + esc(e.what) + "</li>";
      }).join("");
      // The steps an instance had reached BY event i: what the diagram dashes as done.
      var reached = function (i, inst) {
        var seen = [];
        for (var k = 0; k < i; k++) if (EV[k].instance === inst && EV[k].node && seen.indexOf(EV[k].node) < 0) seen.push(EV[k].node);
        return seen;
      };
      // The latest step event at or before i: the process the bean is in at that moment.
      var stepAt = function (i) { for (var k = i; k >= 0; k--) if (EV[k].kind === "step-reached") return k; return -1; };
      var drawn = null;
      var go = function (i) {
        at = Math.max(0, Math.min(EV.length - 1, i));
        var e = EV[at];
        range.value = at;
        label.textContent = "event " + (at + 1) + " of " + EV.length;
        now.innerHTML = "<strong>" + esc(e.kind) + "</strong> · " + esc(e.at.replace("T", " ").replace(/\.\d+/, "")) + " · by " + esc(e.by) +
          "<br>" + esc(e.what) + (e.instance ? '<br><span class="sv-sub">instance <code>' + esc(e.instance) + "</code>" + (e.node ? " at <code>" + esc(e.node) + "</code>" : "") + "</span>" : "");
        list.querySelectorAll("li").forEach(function (li) {
          if (+li.getAttribute("data-i") === at) { li.setAttribute("aria-current", "step"); li.scrollIntoView({ block: "nearest" }); }
          else li.removeAttribute("aria-current");
        });
        var k = stepAt(at);
        if (k < 0) { dia.hidden = true; drawn = null; return; }
        var s = EV[k], proc = s.what.split(":")[0], href = H.drawings[proc];
        if (!href) { dia.hidden = false; dia.textContent = "No drawing of " + proc + " is published."; drawn = null; return; }
        var marks = {};
        reached(k, s.instance).forEach(function (n) { marks[n] = { rows: [] }; });
        marks[s.node] = { rows: [{ beans: [{ id: root.getAttribute("data-pb-bean"), title: s.what }], finished: false }] };
        var key = href + "|" + k;
        if (drawn === key) return;
        drawn = key;
        dia.hidden = false;
        draw(dia, href, marks);
      };
      var stop = function () { if (timer) { clearInterval(timer); timer = null; } playBtn.setAttribute("aria-pressed", "false"); playBtn.textContent = "▶ Play"; };
      var play = function () {
        if (timer) return stop();
        if (at >= EV.length - 1) go(0);
        playBtn.setAttribute("aria-pressed", "true"); playBtn.textContent = "⏸ Pause";
        timer = setInterval(function () { if (at >= EV.length - 1) stop(); else go(at + 1); }, 1200);
      };
      var act = { first: function () { stop(); go(0); }, prev: function () { stop(); go(at - 1); }, next: function () { stop(); go(at + 1); }, last: function () { stop(); go(EV.length - 1); }, play: play };
      document.querySelectorAll("[data-pb-go]").forEach(function (b) { b.addEventListener("click", function () { act[b.getAttribute("data-pb-go")](); }); });
      range.addEventListener("input", function () { stop(); go(+range.value); });
      list.addEventListener("click", function (ev) { var li = ev.target.closest("li[data-i]"); if (li) { stop(); go(+li.getAttribute("data-i")); } });
      document.addEventListener("keydown", function (ev) {
        var t = ev.target, tag = t && t.tagName;
        // A form control keeps its own keys: the slider steps itself (and fires its own input event).
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
        if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
        var k = ev.key;
        if (k === "ArrowRight") act.next();
        else if (k === "ArrowLeft") act.prev();
        else if (k === "Home") act.first();
        else if (k === "End") act.last();
        else if (k === " " && (tag !== "BUTTON")) act.play();
        else return;
        ev.preventDefault();
      });
      go(at);
    }
  }
})();
</script>`;

/** A URL segment: what a process id or bean id must be to get a page of its own. */
export const PB_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * The routes these pages take under a bean store's page
 * (`<base>/<harness>/beans/<store>/`), every one a path IRI, never a query:
 * `beans-processed/`, `beans-processed/<processId>/` and
 * `bean-processed/<beanId>/`. An id that is not a URL segment gets no page,
 * and is shown as text where it is named.
 */
export function processedBeansRoutes(rows: readonly ProcessedRow[]): { processes: string[]; beans: string[] } {
  return {
    processes: [...new Set(rows.map((r) => r.process))].filter((p) => PB_SEGMENT.test(p)).sort(),
    beans: [...new Set(rows.flatMap((r) => r.beans.map((b) => b.id)))].filter((b) => PB_SEGMENT.test(b)).sort(),
  };
}

/** The lead sentence every page carries: what the rows are and when "stalled" starts. */
function lead(store: string, now: Date, up: string): string {
  return (
    `<p class="sv-sub">BPMN workflow instances recorded in <code>${esc(store)}</code>'s work plan, joined with the beans they name. ` +
    `Ages are measured on ${esc(dayOf(now))} (UTC, the day this page was built); an instance is <strong>stalled</strong> when it is running ` +
    `and has not moved for more than ${STUCK_AFTER_DAYS} days. A finished instance is marked where it ended. Beans that no instance names ` +
    `are listed under "Beans in no process"; <a href="${up}">the store page</a> has every bean. A running subprocess is followed on each instance's own page.</p>`
  );
}

/**
 * The links every page leads with. `instances` is false when the store has no
 * workflow instance: its `workflows/` hub is then never written (it is drawn
 * only over instances), so the link is left out rather than left dead. A
 * store with beans and no instance is a content layer mounted in an IG's site
 * (found 2026-11-03 rendering a newly harnessed IG: `../workflows/` from
 * a content layer's `beans-processed/` page was the one dead chrome link).
 */
function nav(store: string, up: string, instances = true): string {
  return `<p class="sv-sub"><a href="${up}">${esc(store)}'s work plan</a> · <a href="${up}beans-processed/">beans by process</a>${instances ? ` · <a href="${up}workflows/">every instance</a>` : ""}</p>`;
}

/**
 * `beans-processed/` (no `process`) or `beans-processed/<process>/`: the
 * processes with an instance, the beans on each diagram, filters. `rows` are
 * this page's rows, hrefs relative to it; `up` is the store page relative to it.
 */
export function processedBeansBody(
  store: string,
  rows: readonly ProcessedRow[],
  now: Date,
  up: string,
  process?: string,
  unplaced?: readonly UnplacedBean[],
  /** The combined page: the stores it joins, each with a tick box (owner, 2026-11-03). */
  stores?: readonly string[],
  /** The combined page: each store's dependencies among `stores`, for "include what it depends on". */
  needs?: Readonly<Record<string, readonly string[]>>,
): string {
  const procs = [...new Set(rows.map((r) => r.process))].sort();
  const beanStates = [...new Set(rows.flatMap((r) => r.beans.map((b) => (b.found ? b.status! : "not in this store"))))].sort();
  const id = process ? `beans-processed-${process}` : "beans-processed";
  return (
    `<h1 id="${esc(id)}">${process ? `Beans in <code>${esc(process)}</code>` : "Beans by process"}: ${esc(store)}</h1>` +
    (stores
      ? `<p class="sv-sub"><a href="${up}">the bean stores</a> · ${stores.map((st) => `<a href="${up}${esc(st)}/beans-processed/">${esc(st)}</a>`).join(" · ")}</p>`
      : nav(store, up, rows.length > 0)) +
    lead(store, now, up) +
    `<div data-pb="all" data-pb-stall="${STUCK_AFTER_DAYS}" data-pb-up="${esc(up)}" data-pb-store="${esc(store)}"${process ? ` data-pb-process="${esc(process)}"` : ""}>` +
    // Shown only on a page opened from localhost: the refresh reads the local
    // store server; on the published site there is nothing to refresh from.
    (stores ? "" : `<p class="pb-live" id="pb-live" hidden><label><input type="checkbox" id="pb-live-on" checked> Refresh every 5 s from the local bean store</label> <span id="pb-live-state" role="status"></span></p>`) +
    `<form class="pb-filters" onsubmit="return false">` +
    `<label for="pb-q">Search<input id="pb-q" type="search" placeholder="bean, title, step, instance"></label>` +
    (process
      ? `<select id="pb-process" hidden><option value=""></option></select>`
      : `<label for="pb-process">Process<select id="pb-process"><option value="">All processes</option>${procs.map((p) => `<option>${esc(p)}</option>`).join("")}</select></label>`) +
    `<label for="pb-open">Beans<select id="pb-open"><option value="open" selected>Open</option><option value="closed">Closed</option><option value="">Open and closed</option></select></label>` +
    `<label for="pb-state">Instance<select id="pb-state"><option value="">Any</option><option value="running">Running</option><option value="finished">Finished</option><option value="stuck">Any stuck state</option></select></label>` +
    `<label for="pb-beanstatus">Bean status<select id="pb-beanstatus"><option value="">Any</option>${beanStates.map((s) => `<option>${esc(s)}</option>`).join("")}</select></label>` +
    `<label for="pb-stale">Not moved for<select id="pb-stale"><option value="">Any time</option><option value="${STUCK_AFTER_DAYS}">More than ${STUCK_AFTER_DAYS} days</option><option value="30">More than 30 days</option><option value="60">More than 60 days</option></select></label>` +
    `</form>` +
    (stores
      ? `<fieldset class="pb-stores"><legend>Stores</legend>${stores
          .map((st) => `<label><input type="checkbox" data-pb-store-box value="${esc(st)}" checked> ${esc(st)}</label>`)
          .join("")}` +
        `<label class="pb-deps"><input type="checkbox" id="pb-deps"> and the stores each ticked store depends on (its <code>needs</code>)</label></fieldset>` +
        `<script type="application/json" id="pb-needs">${scriptJson(needs ?? {})}</script>`
      : "") +
    `<ul class="pb-chips" id="pb-chips"></ul>` +
    `<section class="pb-card pb-detail" id="pb-detail" tabindex="-1" aria-live="polite" hidden></section>` +
    (rows.length === 0 ? `<p class="sv-sub">No BPMN instance is recorded in this store, so no bean sits at any step.</p>` : "") +
    `<div id="pb-cards"></div>` +
    `<h2 class="sv-h2" id="pb-table">Beans in processes</h2>` +
    `<div class="pb-table"><table><thead><tr><th>bean</th><th><button type="button" data-pb-sort="process">process</button></th><th>step</th><th>instance</th><th><button type="button" data-pb-sort="lastMoved">last moved</button></th><th>stuck</th></tr></thead><tbody id="pb-tbody"></tbody></table></div>` +
    (unplaced
      ? `<h2 class="sv-h2" id="pb-unplaced-h">Beans in no process</h2>` +
        `<p class="sv-sub">Beans of this store that no workflow instance names, so no diagram shows them. The filters above apply.</p>` +
        `<ul class="pb-list" id="pb-unplaced"></ul>`
      : "") +
    `</div><script type="application/json" id="pb-rows">${scriptJson(rows)}</script>` +
    (unplaced ? `<script type="application/json" id="pb-unplaced-data">${scriptJson(unplaced)}</script>` : "") +
    PB_SCRIPT
  );
}

/** `bean-processed/<bean>/`: one bean through every instance that names it. `rows` are that bean's. */
export function processedBeanBody(store: string, bean: string, rows: readonly ProcessedRow[], now: Date, up: string, history?: ProcessedBeanHistory): string {
  return (
    `<h1 id="bean-processed-${esc(bean)}">Bean <code>${esc(bean)}</code> in its processes</h1>` +
    nav(store, up) +
    lead(store, now, up) +
    `<div data-pb="one" data-pb-stall="${STUCK_AFTER_DAYS}" data-pb-up="${esc(up)}" data-pb-bean="${esc(bean)}">` +
    historySection(history) +
    `<div id="pb-one"></div></div>` +
    `<script type="application/json" id="pb-rows">${scriptJson(rows)}</script>` +
    (history ? `<script type="application/json" id="pb-history">${scriptJson(history)}</script>` : "") +
    PB_SCRIPT
  );
}

/** The history stepper's frame; the client fills it. Absent history: the section says so. */
function historySection(history?: ProcessedBeanHistory): string {
  const head = `<h2 class="sv-h2" id="pb-history-h">History</h2>`;
  if (!history) return `<section class="pb-card" aria-labelledby="pb-history-h">${head}<p class="sv-sub">This page was built without the bean's history.</p></section>`;
  if ("unknown" in history) {
    return `<section class="pb-card" aria-labelledby="pb-history-h">${head}<p class="sv-sub"><strong>The history could not be read</strong>, so it is not shown: ${esc(history.unknown)}</p></section>`;
  }
  if (history.events.length === 0) return `<section class="pb-card" aria-labelledby="pb-history-h">${head}<p class="sv-sub">No change to this bean is recorded yet.</p></section>`;
  return (
    `<section class="pb-card" aria-labelledby="pb-history-h" id="pb-history-card">${head}` +
    `<p class="sv-sub">Every change to the bean and every step of a process it went through, oldest first. ` +
    `Step with the buttons, or the keyboard: <kbd>←</kbd> <kbd>→</kbd> one event, <kbd>Home</kbd> <kbd>End</kbd> first and last, <kbd>Space</kbd> play or pause.</p>` +
    `<div class="pb-steps" role="toolbar" aria-label="Step through the history">` +
    `<button type="button" data-pb-go="first" aria-label="First event">⏮</button>` +
    `<button type="button" data-pb-go="prev" aria-label="Previous event">◀</button>` +
    `<button type="button" data-pb-go="play" aria-label="Play" aria-pressed="false">▶ Play</button>` +
    `<button type="button" data-pb-go="next" aria-label="Next event">▶</button>` +
    `<button type="button" data-pb-go="last" aria-label="Last event">⏭</button>` +
    `<input type="range" id="pb-at" min="0" max="${history.events.length - 1}" value="${history.events.length - 1}" aria-label="Event">` +
    `<span id="pb-at-label" aria-hidden="true"></span>` +
    `</div>` +
    `<div class="pb-now" id="pb-now" aria-live="polite"></div>` +
    `<div class="pb-diagram" id="pb-hist-diagram" hidden></div>` +
    `<ol class="pb-events" id="pb-events"></ol>` +
    `</section>`
  );
}

/** One store's part of the combined page: its rows and beans in no process, hrefs relative to its own page. */
export interface StoreRows {
  store: string;
  rows: readonly ProcessedRow[];
  unplaced: readonly UnplacedBean[];
  /** The layers this store's layer `needs` (its declaration): the stores it depends on. */
  needs?: readonly string[];
}

/**
 * `…/beans/beans-processed/`: every store's beans by process on one page, a
 * tick box per store (owner, 2026-11-03). Each row keeps its own store's links:
 * its hrefs are re-anchored at `../<store>/` and it carries that as `up`.
 */
export function processedBeansCombinedBody(parts: readonly StoreRows[], now: Date): string {
  const stores = parts.map((p) => p.store).sort();
  const rows = parts.flatMap((p) => rebase(p.rows, `../${p.store}/`).map((r) => ({ ...r, store: p.store, up: `../${p.store}/` })));
  const unplaced = parts.flatMap((p) => p.unplaced.map((b) => ({ ...b, store: p.store })));
  const needs = Object.fromEntries(parts.map((p) => [p.store, [...(p.needs ?? [])].filter((n) => stores.includes(n))]));
  return processedBeansBody("every store", rows, now, "../", undefined, unplaced, stores, needs);
}

/**
 * `bean-processed/`: every bean with a page of its own, filterable by open or
 * closed (default open; owner, 2026-11-03) and by text. `up` is the store page.
 */
export function processedBeanIndexBody(store: string, beans: readonly UnplacedBean[], up: string): string {
  return (
    `<h1 id="bean-processed">Beans in processes: ${esc(store)}</h1>` +
    nav(store, up) +
    (beans.length === 0
      ? `<p class="sv-sub">No workflow instance in this store names a bean.</p>`
      : `<div data-pb="index" data-pb-up="${esc(up)}" data-pb-stall="${STUCK_AFTER_DAYS}">` +
        `<form class="pb-filters" onsubmit="return false">` +
        `<label for="pb-q">Search<input id="pb-q" type="search" placeholder="bean or title"></label>` +
        `<label for="pb-open">Beans<select id="pb-open"><option value="open" selected>Open</option><option value="closed">Closed</option><option value="">Open and closed</option></select></label>` +
        `</form><ul class="pb-chips" id="pb-chips"></ul><ul class="pb-list" id="pb-index"></ul></div>` +
        `<script type="application/json" id="pb-rows">[]</script>` +
        `<script type="application/json" id="pb-unplaced-data">${scriptJson(beans)}</script>` +
        PB_SCRIPT)
  );
}

/** Rows with every page-relative href re-anchored one or more levels deeper. */
export function rebase(rows: readonly ProcessedRow[], prefix: string): ProcessedRow[] {
  const at = (h?: string) => (h === undefined || /^[a-z]+:|^\//.test(h) ? h : prefix + h);
  return rows.map((r) => ({
    ...r,
    ...(r.href ? { href: at(r.href) } : {}),
    ...(r.drawing ? { drawing: at(r.drawing) } : {}),
    ...(r.processPage ? { processPage: at(r.processPage) } : {}),
  }));
}
