/* KG subgraph viewer: a Graphviz layout drawn in the reader's browser, then made movable.
 *
 * Skill `kg-subgraph-layout` (skills/kg/graph-management/). Owner, 2026-10-09:
 * "giant diagram --> this is skill to generalize for layout of KG subgraphs visualizer";
 * "could use the wasm-graphviz to make the graph visualizers overview more dynamic. also
 * allow users to drag nodes around for better visualization."
 *
 * Every element <div class="kg-graph" data-dot-src="x.dot"> is laid out from its DOT by Graphviz
 * compiled to WebAssembly (@hpcc-js/wasm-graphviz, vendored by this site under
 * assets/js/vendor/wasm-graphviz/, never fetched from a third party), with the pipeline of the
 * i2ce Form Documentor: `unflatten -f -l 2 -c 2 | dot`. The reader can then:
 *   - pan (drag the background, or the arrow keys) and zoom (wheel, + / -, or the buttons);
 *   - drag a node: the edges that touch it follow, their ends moved with it and their middles
 *     in proportion; a found node moves with Shift + the arrow keys;
 *   - find a node by name: the view centres and outlines it;
 *   - fit the view, and reset the layout.
 *
 * Lazy: Graphviz (about 740 KB) is fetched only when a graph is first SHOWN. A graph inside a
 * hidden view (the UML pages' Portrait / Landscape / Interactive switch) waits until the reader
 * picks it. Without script the element keeps its own fallback text, so the page works without it.
 *
 * Colours are not written here: the DOT carries the fill of each node (read from uml.css by
 * scripts/uml-palette.ts) and a class per kind, and the chrome is styled by uml.css.
 * Ported from the ihris folio's src/site/kg-graph.js. No build step.
 */
const GRAPHVIZ = new URL("./vendor/wasm-graphviz/index.js", import.meta.url).href;
let gvPromise = null;
const graphviz = () => (gvPromise ||= import(GRAPHVIZ).then((m) => m.Graphviz.load()));

/** Numbers of an SVG path or points attribute, as [x, y] pairs. */
function pairs(s) {
  const n = (s.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
  const out = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]);
  return out;
}

function pathFrom(pts) {
  // Graphviz edges are `M p0 C p1 p2 p3 [p4 p5 p6 ...]`.
  const f = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  return `M${f(pts[0])}C` + pts.slice(1).map(f).join(" ");
}

function title(g) {
  const t = g.querySelector(":scope > title");
  return t ? t.textContent : "";
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

let seq = 0;

async function mount(el) {
  el.dataset.kgMounted = "1";
  if (!el.id) el.id = `kg-graph-${++seq}`;
  el.textContent = "";
  const status = el.appendChild(document.createElement("p"));
  status.className = "kg-graph-status";
  status.setAttribute("role", "status");
  status.textContent = "Laying out the graph…";
  let svgText;
  try {
    const res = await fetch(el.dataset.dotSrc);
    if (!res.ok) throw new Error(`HTTP ${res.status} for the DOT source`);
    const dot = await res.text();
    const gv = await graphviz();
    const [l, f, c] = (el.dataset.unflatten || "2,1,2").split(",").map(Number);
    svgText = gv.dot(l > 0 ? gv.unflatten(dot, l, !!f, c) : dot);
  } catch (e) {
    // Could not lay it out is never drawn as an empty graph: say so, and where the source is.
    status.textContent = `The graph could not be laid out here (${e.message}). `;
    const a = status.appendChild(document.createElement("a"));
    a.href = el.dataset.dotSrc;
    a.textContent = "The DOT source";
    status.append(" is still available.");
    el.dataset.kgState = "failed";
    return;
  }
  status.textContent = "";
  const stage = document.createElement("div");
  stage.className = "kg-graph-stage";
  stage.tabIndex = 0;
  stage.innerHTML = svgText.replace(/^[\s\S]*?(<svg)/, "$1");
  el.appendChild(stage);
  const svg = stage.querySelector("svg");
  const root = svg.querySelector("g.graph");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", el.dataset.label || "Graph");
  stage.setAttribute("aria-label", `${el.dataset.label || "Graph"}. Arrow keys pan, plus and minus zoom, 0 fits. After Find, Shift and the arrow keys move the found node.`);

  // ---- the view: pan and zoom by rewriting the viewBox
  // The view always has the stage's aspect ratio, so a screen point maps to the viewBox without letterboxing.
  const vb0 = svg.viewBox.baseVal;
  const drawn = { x: vb0.x, y: vb0.y, w: vb0.width, h: vb0.height };
  const fitted = () => {
    const r = svg.getBoundingClientRect(), k = r.height / r.width || 1;
    const w = Math.max(drawn.w, drawn.h / k), h = w * k;
    return { x: drawn.x - (w - drawn.w) / 2, y: drawn.y - (h - drawn.h) / 2, w, h };
  };
  let full = fitted();
  let view = { ...full };
  const apply = () => svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  apply();
  new ResizeObserver(() => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const k = r.height / r.width || 1;
    full = fitted();
    view = { ...view, h: view.w * k };
    apply();
  }).observe(stage);
  const toSvg = (cx, cy) => {
    const r = svg.getBoundingClientRect();
    return [view.x + ((cx - r.left) / r.width) * view.w, view.y + ((cy - r.top) / r.height) * view.h];
  };
  const zoom = (k, cx, cy) => {
    const [px, py] = cx === undefined ? [view.x + view.w / 2, view.y + view.h / 2] : toSvg(cx, cy);
    view = { x: px - (px - view.x) * k, y: py - (py - view.y) * k, w: view.w * k, h: view.h * k };
    apply();
  };
  const pan = (fx, fy) => { view = { ...view, x: view.x + fx * view.w, y: view.y + fy * view.h }; apply(); };
  svg.addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });

  // ---- what moves with a node: each edge's endpoints, from its title "a->b"
  // A node whose class says `kg-graph-anchor` is layout scaffolding (an invisible grid anchor): it is
  // neither listed nor draggable.
  const nodes = new Map();
  for (const g of root.querySelectorAll("g.node")) {
    if (g.classList.contains("kg-graph-anchor")) continue;
    nodes.set(title(g), { g, dx: 0, dy: 0 });
  }
  const edges = [];
  for (const g of root.querySelectorAll("g.edge")) {
    const m = title(g).split("->");
    const path = g.querySelector("path");
    if (m.length !== 2 || !path) continue;
    const pts = pairs(path.getAttribute("d"));
    if (!pts.length) continue;
    const first = pts[0], last = pts[pts.length - 1];
    edges.push({
      from: m[0], to: m[1], path, pts, d0: path.getAttribute("d"),
      // An arrowhead sits at the end it is nearer: a composition's diamond is at its tail.
      ends: [...g.querySelectorAll("polygon, ellipse")].map((p) => {
        const ps = p.tagName === "ellipse" ? [[+p.getAttribute("cx"), +p.getAttribute("cy")]] : pairs(p.getAttribute("points"));
        const c = ps.reduce((s, q) => [s[0] + q[0] / ps.length, s[1] + q[1] / ps.length], [0, 0]);
        return { el: p, pts: ps, atTail: dist2(c, first) < dist2(c, last), points0: p.getAttribute("points") };
      }),
      labels: [...g.querySelectorAll("text")].map((t) => ({ el: t, x: +t.getAttribute("x"), y: +t.getAttribute("y") })),
    });
  }
  const shift = (name) => nodes.get(name) || { dx: 0, dy: 0 };
  function redraw(e) {
    const a = shift(e.from), b = shift(e.to), n = Math.max(1, e.pts.length - 1);
    if (!a.dx && !a.dy && !b.dx && !b.dy) {
      // Back where Graphviz put it: Graphviz's own text, not a re-serialisation of it.
      e.path.setAttribute("d", e.d0);
      for (const h of e.ends) {
        if (h.el.tagName === "ellipse") { h.el.setAttribute("cx", h.pts[0][0]); h.el.setAttribute("cy", h.pts[0][1]); }
        else h.el.setAttribute("points", h.points0);
      }
      for (const l of e.labels) { l.el.setAttribute("x", l.x); l.el.setAttribute("y", l.y); }
      return;
    }
    const pts = e.pts.map(([x, y], i) => [x + a.dx + (b.dx - a.dx) * (i / n), y + a.dy + (b.dy - a.dy) * (i / n)]);
    e.path.setAttribute("d", pathFrom(pts));
    for (const h of e.ends) {
      const s = h.atTail ? a : b;
      if (h.el.tagName === "ellipse") { h.el.setAttribute("cx", h.pts[0][0] + s.dx); h.el.setAttribute("cy", h.pts[0][1] + s.dy); }
      else h.el.setAttribute("points", h.pts.map(([x, y]) => `${x + s.dx},${y + s.dy}`).join(" "));
    }
    for (const l of e.labels) { l.el.setAttribute("x", l.x + (a.dx + b.dx) / 2); l.el.setAttribute("y", l.y + (a.dy + b.dy) / 2); }
  }
  const moveNode = (node, ddx, ddy) => {
    node.dx += ddx;
    node.dy += ddy;
    node.g.setAttribute("transform", `translate(${node.dx} ${node.dy})`);
    const name = title(node.g);
    for (const ed of edges) if (ed.from === name || ed.to === name) redraw(ed);
  };

  // ---- dragging: a node moves itself and its edges; the background pans
  let drag = null;
  svg.addEventListener("pointerdown", (e) => {
    e.preventDefault(); // a drag, not a text selection
    stage.focus({ preventScroll: true });
    const g = e.target.closest("g.node");
    const node = g && nodes.get(title(g));
    const [x, y] = toSvg(e.clientX, e.clientY);
    drag = node ? { node, x, y } : { pan: true, x: e.clientX, y: e.clientY, v: { ...view } };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add("kg-dragging");
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (drag.pan) {
      const r = svg.getBoundingClientRect();
      view = { ...drag.v, x: drag.v.x - ((e.clientX - drag.x) / r.width) * drag.v.w, y: drag.v.y - ((e.clientY - drag.y) / r.height) * drag.v.h };
      apply();
      return;
    }
    const [x, y] = toSvg(e.clientX, e.clientY);
    moveNode(drag.node, x - drag.x, y - drag.y);
    drag.x = x;
    drag.y = y;
  });
  const end = () => { drag = null; svg.classList.remove("kg-dragging"); };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);

  // ---- controls
  const bar = document.createElement("div");
  bar.className = "kg-graph-bar";
  // Found by what the reader sees (a node's header), else by its id; a header two nodes share is
  // qualified with the id, so every name finds exactly one node.
  const byName = new Map();
  const counts = new Map();
  for (const [id, n] of nodes) { const l = labelOf(n.g) || id; counts.set(l, (counts.get(l) || 0) + 1); }
  for (const [id, n] of nodes) {
    const l = labelOf(n.g) || id;
    byName.set(counts.get(l) > 1 ? `${l} (${id})` : l, n);
    byName.set(id, n);
  }
  const names = [...new Set([...byName.keys()].filter((k) => !nodes.has(k) || !labelOf(nodes.get(k).g)))].sort();
  bar.innerHTML = `<label>Find <input type="search" list="${el.id}-names" autocomplete="off"></label>
<datalist id="${el.id}-names">${names.map((n) => `<option value="${esc(n)}"></option>`).join("")}</datalist>
<button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">&minus;</button>
<button type="button" data-z="fit">Fit</button><button type="button" data-z="reset">Reset layout</button>`;
  el.insertBefore(bar, stage);
  let found = null;
  bar.addEventListener("click", (e) => {
    const z = e.target.dataset && e.target.dataset.z;
    if (z === "in") zoom(1 / 1.3);
    else if (z === "out") zoom(1.3);
    else if (z === "fit") { view = { ...full }; apply(); }
    else if (z === "reset") {
      for (const n of nodes.values()) { n.dx = n.dy = 0; n.g.removeAttribute("transform"); }
      edges.forEach(redraw);
    }
  });
  const find = bar.querySelector("input");
  find.addEventListener("change", () => {
    const n = byName.get(find.value.trim());
    root.querySelectorAll(".kg-found").forEach((g) => g.classList.remove("kg-found"));
    found = n || null;
    if (!n) { status.textContent = find.value.trim() ? `No node named ${find.value.trim()}.` : ""; return; }
    n.g.classList.add("kg-found");
    // The node's box on screen, in viewBox units (Graphviz draws inside a translated group, so getBBox is not).
    const r = n.g.getBoundingClientRect(), s = svg.getBoundingClientRect();
    const [cx, cy] = toSvg(r.left + r.width / 2, r.top + r.height / 2);
    const bw = (r.width / s.width) * view.w;
    const w = Math.max(bw * 4, full.w / 12), h = w * (view.h / view.w);
    view = { x: cx - w / 2, y: cy - h / 2, w, h };
    apply();
    status.textContent = `Found ${find.value.trim()}.`;
  });

  // ---- the keyboard: the same floor as the site's figure viewer (graph-rendering rule 9)
  stage.addEventListener("keydown", (e) => {
    const step = 0.1;
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key]) {
      const [ax, ay] = arrows[e.key];
      if (e.shiftKey && found) moveNode(found, ax * view.w * 0.02, ay * view.h * 0.02);
      else pan(ax * step, ay * step);
    } else if (e.key === "+" || e.key === "=") zoom(1 / 1.3);
    else if (e.key === "-" || e.key === "_") zoom(1.3);
    else if (e.key === "0") { view = { ...full }; apply(); }
    else return;
    e.preventDefault();
  });
  el.dataset.kgState = "ready";
}

/** The first line of text a node draws: its header, for the find list. */
function labelOf(g) {
  const t = g.querySelector("text");
  return t ? t.textContent.trim() : "";
}

/** Shown means laid out by the browser: a graph inside a hidden view waits until it is picked. */
const shown = (el) => el.getClientRects().length > 0;

/*
 * AND NEAR THE VIEWPORT (owner, 2026-11-14: "do lazy load content and libs"): a shown graph far
 * below the fold waits until it comes within 800px, so Graphviz is not fetched for it at load.
 * PRINT ("Make sure printing loads all of the content before it renders the PDF"): once the
 * page is idle every shown graph is laid out in the background, and `beforeprint` lays out any
 * still waiting; `window.faMountAllGraphs()` returns a promise for a caller that can wait.
 */
const unmounted = () => [...document.querySelectorAll(".kg-graph[data-dot-src]:not([data-kg-mounted])")];
const near = typeof IntersectionObserver === "function"
  ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      near.unobserve(e.target);
      if (!e.target.dataset.kgMounted && shown(e.target)) mount(e.target);
    }
  }, { rootMargin: "800px 0px" })
  : null;

function mountShown() {
  unmounted().forEach((el) => {
    if (!shown(el)) return;
    if (near) near.observe(el);
    else mount(el);
  });
}

function mountAllShown() {
  return Promise.all(unmounted().filter(shown).map((el) => mount(el)));
}
window.faMountAllGraphs = mountAllShown;
window.addEventListener("beforeprint", () => { mountAllShown(); });
const whenIdle = () => (typeof requestIdleCallback === "function"
  ? requestIdleCallback(() => mountAllShown(), { timeout: 5000 })
  : setTimeout(() => mountAllShown(), 2000));
if (document.readyState === "complete") whenIdle();
else window.addEventListener("load", whenIdle);

mountShown();
// The UML pages switch views with radio buttons and CSS; a pick may reveal a graph.
document.addEventListener("change", mountShown);
