/**
 * The ⓘ task panel on a process page: an info marker on every task of the
 * drawn diagram, opening a small UML-style object view of what the task
 * requires and who performs it.
 *
 * @module scripts/lib/task-panel
 *
 * Owner, 2026-10-16 (thread "BPMN lane, role and skill modelling"; the
 * implementation spec's §6): *"Don't draw separate UML diagrams per process.
 * Instead, an info icon on each task opens a small UML object view: task →
 * skill → methodology, and lane Role → skills. Every skill, methodology and
 * role in the panel is a link to its own page. It loads only when opened."*
 *
 * ## What is drawn, and from what
 *
 *   «Task» name ──requires──▶ «Skill» s ──uses-methodology──▶ «Methodology» m
 *   «Lane» name ──names────▶ «Role» r ──hasSkill──▶ «Skill» …
 *
 * Every arrow is read, none inferred: `requires` from the task's
 * `<bootstrap.processes:skill ref>`, `uses-methodology` from the skill's own
 * front matter (cat-harness#325; absent → nothing shown, never "none"),
 * `names` from the lane's `partitionElementRef` (or the legacy ref), and
 * `hasSkill` from `roles.json`, closed over `inherits` with the ancestor that
 * supplied each.
 *
 * ## Thin and dynamic
 *
 * The page carries only the markers — one `<button>` per task, positioned in
 * percent of the diagram so they track the image at every width — and a small
 * inline client. The object view's DATA is a sidecar, `<stem>.tasks.json`,
 * fetched the first time any marker is opened and not before. A reader who
 * never clicks downloads nothing extra.
 *
 * ## Where the markers sit
 *
 * On the top-right corner of each task's shape, from the diagram's own BPMN
 * DI bounds (the layout the SVG was drawn from — bpmn-js does not lay out, it
 * renders the DI) mapped through the rendered SVG's `viewBox`. A task with no
 * DI shape, or a diagram with no SVG, gets no marker rather than one placed by
 * guesswork; the step table below the diagram still lists it.
 *
 * ## Links
 *
 * - Skill → its instruction page, `reference/skill-instructions/<s>.html`,
 *   when one is generated (the same test `processPage` already applies); a
 *   skill without one stays code rather than a link that 404s (bean `qgjh`).
 * - Methodology → its own page under the methodologies viewer,
 *   `<route>/<instance>/<name>/` — the URL pattern of cat-harness-tools #422
 *   (`nodePageDir`, owner 2026-10-16: *"use same URL pattern as other
 *   viewers"*), built here from the same declared route so it resolves once
 *   #422 lands.
 * - Role → its row on the auto-docs Roles index, the one page a Role has
 *   today: `<auto-docs route>/index/roles/index.html#<row id>`, the row id
 *   spelled exactly as `gen-auto-docs.ts` spells it.
 */
import { BpmnModdle } from "bpmn-moddle";
import { requireIndexConfig } from "../../schemas/kg/index-config.ts";

/**
 * Does the site built from `checkout` show skills in the ⓘ panel? Its
 * `index.config.json` says, as `site.taskSkills`: absent or `true` shows
 * them (the knowledge graph's own sites), `false` hides them (a site whose
 * processes are not modelled with skills, such as an implementation guide's
 * business processes). One switch, read here and nowhere else.
 */
export function taskSkillsDeclared(checkout: string): boolean {
  return requireIndexConfig(checkout)?.site?.taskSkills !== false;
}

/**
 * The panel's client and styles, as the files the processes viewer writes
 * beside its pages and sidecars, for a page elsewhere on the site to load.
 */
export const PANEL_CLIENT = { script: "task-panel.js", style: "task-panel.css" } as const;

/** The sidecar a process page fetches when a marker is first opened: `<stem>.tasks.json`, beside the page. */
export function panelFile(stem: string): string {
  return `${stem}.tasks.json`;
}

/** A rectangle in diagram coordinates. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One marker: the task it opens, and where it sits, in percent of the drawn diagram. */
export interface Marker {
  id: string;
  name: string;
  left: number;
  top: number;
  /**
   * The shape's [+] marker and the 24 × 24 hit area around it, in percent of
   * the drawn diagram: the click target when the step links somewhere. Never
   * the whole shape (owner, 2026-11-03, cat-harness#991: "the subprocess
   * should be opened by the [+] not the whole box"), so the title keeps its
   * own link and the box is not one big target.
   */
  box?: { left: number; top: number; width: number; height: number };
  /**
   * Where a click on the [+] goes: for a call activity, the called
   * process's page. Absent → the step has no [+] link and only the ⓘ opens.
   */
  href?: string;
}

/** A linkable name in the panel. `href` absent → shown as code, never as a guessed link. */
export interface PanelLink {
  name: string;
  href?: string;
}

/** One skill as the panel shows it, with the methodologies it says it uses. */
export interface PanelSkill extends PanelLink {
  /** `uses-methodology`, when the skill's front matter says it. Absent → not said. */
  methodologies?: PanelLink[];
}

/** One task's object view. */
export interface PanelTask {
  id: string;
  name: string;
  type: string;
  /**
   * The step's own page: its subject IRI `…/process/P/node/T` (#603). Absent
   * when its layer's graph publishes no subject pages.
   */
  href?: string;
  /**
   * The step's row in its process page's step table, `<stem>.html#step-T`:
   * where the panel's title goes, so a reader lands on the step's description
   * (owner, 2026-11-08: "title of task should skip to description thats
   * below"). The subject page, when there is one, stays on the `id` line.
   */
  stepHref?: string;
  lane?: string;
  /**
   * The lane's own page, `…/process/P/lane/L`; where its instance publishes
   * none, its row in the process page's lanes table.
   */
  laneHref?: string;
  skills: PanelSkill[];
  /**
   * For a call activity: the process it descends into. `href` is the called
   * process's own page (its subject IRI) where one is published, else its
   * diagram page; `diagram` is the diagram page.
   */
  calls?: PanelLink & { diagram?: string };
  /**
   * For a call to a GLOBAL TASK: the step this layer shares, its BPMN kind,
   * and the values this call gives its inputs. The task's skills are the
   * global task's (owner, 2026-10-20, "a1 b1 c1").
   */
  shared?: { id: string; type: string; inputs?: Record<string, string> };
  /** The Role the lane names, with its skills — absent when the lane names none. */
  role?: PanelLink & { title?: string; skills: (PanelLink & { via?: string })[] };
  /** Why there is no role: the lane's binding verdict, when it is not `bound`. */
  binding?: string;
}

/** The sidecar a process page fetches on first open. */
export interface PanelData {
  $schema: "process-task-panel/v1";
  process: string;
  /**
   * `false` when the site declares `site.taskSkills: false` in its
   * `index.config.json`: the panel then shows no skill, neither a task's nor
   * its role's, and says nothing about their absence. Absent means shown.
   * A switch, not a gap in the data: a site whose processes are not modelled
   * with skills (an implementation guide's business processes) turns them
   * off, and turns them on again with that one line when they are.
   */
  skills?: false;
  /**
   * Where each ⓘ goes, as the process page draws them. A page that shows the
   * drawing without server-drawn markers (a guide's business-processes page)
   * reads them from here, so it draws the same affordances from the same
   * data rather than a second copy of the placement.
   */
  markers?: Marker[];
  /** The process's own page, `…/process/P` (#603); where none is published, the process page itself. */
  processHref?: string;
  tasks: Record<string, PanelTask>;
}

/** The SVG's `viewBox`, or undefined when it carries none. */
export function svgViewBox(svg: string): Box | undefined {
  const m = /<svg\b[^>]*\bviewBox="\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
  if (!m) return undefined;
  const [x, y, width, height] = m.slice(1, 5).map(Number) as [number, number, number, number];
  return width > 0 && height > 0 ? { x, y, width, height } : undefined;
}

/**
 * Element id → its DI bounds, from the FIRST diagram's plane — the one the
 * renderer draws (`bpmn-render.ts`: the top-level plane is rendered, the rest
 * are counted). Parse warnings are ignored here on purpose: placement needs
 * only shapes, and whether the diagram is well-formed is `loadProcessModel`'s
 * question, already asked for the same file.
 */
export async function diagramBounds(xml: string): Promise<Map<string, Box>> {
  const out = new Map<string, Box>();
  const { rootElement } = await new BpmnModdle().fromXML(xml);
  type Shape = { bpmnElement?: { id?: string }; bounds?: Box };
  const defs = rootElement as { diagrams?: { plane?: { planeElement?: Shape[] } }[] };
  for (const s of defs.diagrams?.[0]?.plane?.planeElement ?? []) {
    const id = s.bpmnElement?.id;
    if (id && s.bounds) out.set(id, { x: s.bounds.x, y: s.bounds.y, width: s.bounds.width, height: s.bounds.height });
  }
  return out;
}

const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * Where bpmn-js draws a collapsed activity's [+]: a 14 × 14 box across the
 * middle of the shape, its top 20 above the bottom edge. The hit area around it
 * is {@link MIN_TARGET} square.
 */
export const EXPAND_MARKER = { size: 14, fromBottom: 20 } as const;
/** The smallest hit area of a link, in drawing units (WCAG 2.2 SC 2.5.8). */
export const MIN_TARGET = 24;

/** The [+] marker's hit area of a shape at `b`, in drawing units. */
export function expandMarkerBox(b: Box): Box {
  // bpmn-js puts the box's left edge at `width / 2 - 7.5`, half a unit left of centre.
  const cx = b.x + b.width / 2 - 0.5;
  const cy = b.y + b.height - EXPAND_MARKER.fromBottom + EXPAND_MARKER.size / 2;
  return { x: cx - MIN_TARGET / 2, y: cy - MIN_TARGET / 2, width: MIN_TARGET, height: MIN_TARGET };
}

/** Markers for `tasks`, on each shape's top-right corner. A task with no shape gets none. */
export function markersFor(
  tasks: readonly { id: string; name: string }[],
  bounds: ReadonlyMap<string, Box>,
  viewBox: Box,
): Marker[] {
  const out: Marker[] = [];
  for (const t of tasks) {
    const b = bounds.get(t.id);
    if (!b) continue;
    const left = ((b.x + b.width - viewBox.x) / viewBox.width) * 100;
    const top = ((b.y - viewBox.y) / viewBox.height) * 100;
    if (left < 0 || left > 100 || top < 0 || top > 100) continue;
    const plus = expandMarkerBox(b);
    const box = {
      left: round(((plus.x - viewBox.x) / viewBox.width) * 100),
      top: round(((plus.y - viewBox.y) / viewBox.height) * 100),
      width: round((plus.width / viewBox.width) * 100),
      height: round((plus.height / viewBox.height) * 100),
    };
    out.push({ id: t.id, name: t.name, left: round(left), top: round(top), box });
  }
  return out;
}

/** The row id `gen-auto-docs.ts` gives an item — `a-<path, sanitised>` — so a link lands on the row. */
export function autoDocsRowId(path: string): string {
  return `a-${path.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}

/** The methodology page directory, as #422's `nodePageDir` spells it. */
export function methodologyPageDir(instance: string, name: string): string {
  return `${encodeURIComponent(instance)}/${encodeURIComponent(name)}/`;
}

const escAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The client: opens the panel beside a marker, fetching the sidecar once.
 * Plain DOM, no library, and every value is inserted as TEXT (`textContent`),
 * never as markup — the names come from authored diagrams and front matter.
 * No double braces anywhere: the page is Liquid-processed (it sits inside the
 * page's raw block as well, belt and braces).
 */
export const PANEL_SCRIPT = `(function () {
  Array.prototype.forEach.call(document.querySelectorAll(".pt-diagram:not([data-pt-ready])"), init);
  function init(root) {
  root.setAttribute("data-pt-ready", "");
  // Every href in the sidecar is relative to the sidecar (it sits beside the
  // process page), so a page elsewhere on the site that shows the same
  // drawing resolves them to the same targets.
  // A drawing with no sidecar (a page that only highlights steps, where no
  // processes viewer is published) gets the highlight and nothing else.
  var sidecar = root.getAttribute("data-panel");
  var base = new URL(sidecar || "", location.href);
  function abs(h) { try { return new URL(h, base).href; } catch (e) { return h; } }
  // A page with no server-drawn markers gets them from the sidecar.
  var drawn = !!root.querySelector(".pt-layer");
  if (!drawn) {
    var ly = document.createElement("div"); ly.className = "pt-layer"; root.appendChild(ly);
    var pn = document.createElement("div"); pn.className = "pt-panel"; pn.setAttribute("role", "dialog");
    pn.setAttribute("aria-label", "Task details"); pn.hidden = true; root.appendChild(pn);
  }
  var panel = root.querySelector(".pt-panel"), data = null, pending = null, open = null;
  function load() {
    if (data) return Promise.resolve(data);
    if (!pending) pending = fetch(root.getAttribute("data-panel")).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    }).then(function (j) { data = j; return j; });
    return pending;
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function link(l, cls) {
    var e = el(l.href ? "a" : "code", cls, l.name);
    if (l.href) e.href = abs(l.href); else e.title = "no page for this one";
    return e;
  }
  function obj(stereo, name, kind) {
    var box = el("div", "pt-obj pt-" + kind), head = el("div", "pt-head");
    head.appendChild(el("span", "pt-st", "\\u00ab" + stereo + "\\u00bb"));
    head.appendChild(typeof name === "string" ? el("b", null, name) : name);
    box.appendChild(head);
    return box;
  }
  function edge(label) { return el("div", "pt-edge", "\\u2502 " + label + " \\u25bc"); }
  function render(t) {
    panel.textContent = "";
    var close = el("button", "pt-close", "\\u00d7"); close.type = "button"; close.setAttribute("aria-label", "Close");
    close.onclick = function () { hide(); }; panel.appendChild(close);
    // The title opens the step's description below the drawing; the step's
    // own page, where it has one, is its id.
    var title = link({ name: t.name, href: t.stepHref || t.href });
    if (t.stepHref) title.onclick = function () { hide(); };
    var task = obj(t.type.replace(/^bpmn:/, ""), title, "task");
    var idl = el("div", "pt-attr", "id = ");
    if (t.stepHref && t.href) idl.appendChild(link({ name: t.id, href: t.href })); else idl.appendChild(document.createTextNode(t.id));
    task.appendChild(idl);
    if (t.lane) {
      var ln = el("div", "pt-attr", "lane = "); ln.appendChild(link({ name: t.lane, href: t.laneHref }));
      // The lane is a partition; the Role it names is who acts (owner,
      // 2026-10-31: "i thought there was a Role/person or actor that should be
      // linked"). Shown here too, not only in the Role box further down.
      if (t.role) { ln.appendChild(el("span", "pt-st", " \u2192 role ")); ln.appendChild(link(t.role)); }
      task.appendChild(ln);
    }
    if (data && data.processHref) { var pr = el("div", "pt-attr", "process = "); pr.appendChild(link({ name: data.process, href: data.processHref })); task.appendChild(pr); }
    panel.appendChild(task);
    if (t.calls) {
      panel.appendChild(edge("calls"));
      var cp = obj("Process", link(t.calls), "proc");
      if (t.calls.diagram && t.calls.diagram !== t.calls.href) { var dg = el("div", "pt-attr"); dg.appendChild(link({ name: "diagram", href: t.calls.diagram })); cp.appendChild(dg); }
      panel.appendChild(cp);
    }
    if (t.shared) {
      panel.appendChild(edge("calls"));
      var gt = obj(t.shared.type.replace(/^bpmn:/, ""), t.shared.id, "proc");
      Object.keys(t.shared.inputs || {}).forEach(function (k) { gt.appendChild(el("div", "pt-attr", k + " = " + t.shared.inputs[k])); });
      panel.appendChild(gt);
    }
    var sk_on = !(data && data.skills === false);
    (sk_on ? t.skills : []).forEach(function (s) {
      panel.appendChild(edge("requires"));
      var sk = obj("Skill", link(s), "skill");
      (s.methodologies || []).forEach(function (m) {
        var row = el("div", "pt-attr"); row.appendChild(el("span", "pt-st", "uses-methodology \\u2192 "));
        row.appendChild(link(m)); sk.appendChild(row);
      });
      panel.appendChild(sk);
    });
    if (sk_on && !t.skills.length && !t.calls) panel.appendChild(el("div", "pt-none", "This task names no skill."));
    if (t.role) {
      panel.appendChild(edge("lane names"));
      var role = obj("Role", link(t.role), "role");
      if (t.role.title) role.appendChild(el("div", "pt-attr", "title = " + t.role.title));
      if (sk_on) {
        var list = el("div", "pt-attr"); list.appendChild(el("span", "pt-st", "hasSkill: "));
        if (!t.role.skills.length) list.appendChild(el("i", null, "none listed"));
        t.role.skills.forEach(function (s, i) {
          if (i) list.appendChild(document.createTextNode(", "));
          list.appendChild(link(s));
          if (s.via) list.appendChild(el("span", "pt-via", " (via " + s.via + ")"));
        });
        role.appendChild(list);
      }
      panel.appendChild(role);
    } else if (t.binding) {
      panel.appendChild(el("div", "pt-none", "Lane role: " + t.binding + "."));
    }
  }
  // THE MARKERS FOLLOW THE DRAWING, not the box around it. The site's figure
  // viewer (docs-ui.js) swaps the <img> for an inlined <svg>, puts a toolbar
  // above it, and zooms and pans it inside a scroll box. Positioned against
  // this block, every marker and link drifted off its shape (owner,
  // 2026-10-31: "misaligned"). So the layer is laid over wherever the drawing
  // is actually drawn, and re-laid whenever that can change.
  var layer = root.querySelector(".pt-layer"), queued = false;
  function art() {
    var c = root.querySelectorAll("img, svg");
    for (var i = 0; i < c.length; i++) {
      var e = c[i];
      if (e.closest(".pt-layer, .pt-panel, .fa-figure-tools")) continue;
      if (e.parentElement && e.parentElement.closest("svg")) continue;
      return e;
    }
    return null;
  }
  // A page may name steps to pick out (a journey's step shows the tasks it
  // realises): \`data-pt-highlight="Task_A Task_B"\`. Marked once the drawing
  // is inline, which is when its shapes exist to mark.
  var hl = (root.getAttribute("data-pt-highlight") || "").split(/\\s+/).filter(Boolean);
  if (hl.length) root.classList.add("pt-has-hl");
  function mark(a) {
    if (!hl.length || a.tagName.toLowerCase() !== "svg" || a.hasAttribute("data-pt-marked")) return;
    a.setAttribute("data-pt-marked", "");
    Array.prototype.forEach.call(a.querySelectorAll("[data-element-id]"), function (g) {
      if (hl.indexOf(g.getAttribute("data-element-id")) >= 0) g.setAttribute("data-pt-hl", "");
    });
  }
  function place() {
    queued = false;
    var a = art();
    if (a) mark(a);
    if (!layer || !a) return;
    var r = root.getBoundingClientRect(), b = a.getBoundingClientRect();
    var x = b.left - r.left, y = b.top - r.top, w = b.width, h = b.height, vw = 0, vh = 0;
    if (a.tagName.toLowerCase() === "img") { vw = a.naturalWidth; vh = a.naturalHeight; }
    else { var vb = (a.getAttribute("viewBox") || "").trim().split(/[\\s,]+/).map(Number); vw = vb[2]; vh = vb[3]; }
    // An SVG keeps its aspect inside a box of another shape (xMidYMid meet).
    if (vw > 0 && vh > 0 && w > 0 && h > 0) {
      var k = vw / vh;
      if (w / h > k) { var nw = h * k; x += (w - nw) / 2; w = nw; } else { var nh = w / k; y += (h - nh) / 2; h = nh; }
    }
    layer.style.left = x + "px"; layer.style.top = y + "px"; layer.style.width = w + "px"; layer.style.height = h + "px";
    // Zoomed in, the drawing scrolls inside its box: markers past the edge are hidden with it.
    var sc = a.parentElement;
    while (sc && sc !== root && !(sc.scrollWidth > sc.clientWidth + 1 || sc.scrollHeight > sc.clientHeight + 1)) sc = sc.parentElement;
    if (sc && sc !== root) {
      var s = sc.getBoundingClientRect(), L = r.left + x, T = r.top + y;
      layer.style.clipPath = "inset(" + Math.max(0, s.top - T) + "px " + Math.max(0, L + w - s.right) + "px " +
        Math.max(0, T + h - s.bottom) + "px " + Math.max(0, s.left - L) + "px)";
    } else layer.style.clipPath = "";
    if (open) at(open);
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(root);
  if (window.MutationObserver) new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) if (!layer || !layer.contains(ms[i].target)) { schedule(); return; }
  }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "viewBox"] });
  root.addEventListener("scroll", schedule, true);
  root.addEventListener("load", schedule, true);
  window.addEventListener("resize", schedule);
  schedule();
  if (!drawn && sidecar) load().then(function (j) {
    (j.markers || []).forEach(function (m) {
      var t = j.tasks[m.id], to = t && t.calls ? (t.calls.diagram || t.calls.href) : null;
      if (to && m.box) {
        var g = el("a", "pt-go"); g.href = abs(to);
        g.style.left = m.box.left + "%"; g.style.top = m.box.top + "%"; g.style.width = m.box.width + "%"; g.style.height = m.box.height + "%";
        g.setAttribute("aria-label", "Open subprocess: " + m.name); g.title = "Open subprocess: " + m.name; layer.appendChild(g);
      }
      var b = el("button", "pt-mark", "i"); b.type = "button"; b.setAttribute("data-task", m.id);
      b.style.left = m.left + "%"; b.style.top = m.top + "%"; b.setAttribute("aria-expanded", "false");
      b.setAttribute("aria-label", "About step: " + m.name); b.title = "About: " + m.name; layer.appendChild(b);
    });
    schedule();
  }).catch(function (e) { console.warn("task panel: could not load " + base.href + " (" + e.message + ")"); });
  function at(b) {
    var r = root.getBoundingClientRect(), m = b.getBoundingClientRect();
    panel.style.left = (m.left + m.width / 2 - r.left) + "px"; panel.style.top = (m.top + m.height / 2 - r.top) + "px";
  }
  function hide() { panel.hidden = true; if (open) open.setAttribute("aria-expanded", "false"); open = null; }
  root.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest(".pt-mark");
    if (!b) return;
    if (open === b) { hide(); return; }
    if (open) open.setAttribute("aria-expanded", "false");
    open = b; b.setAttribute("aria-expanded", "true");
    at(b);
    panel.hidden = false; panel.textContent = "Loading\\u2026";
    load().then(function (j) {
      var t = j.tasks[b.getAttribute("data-task")];
      if (open === b) { if (t) render(t); else panel.textContent = "No details for this task."; }
    }).catch(function (e) { if (open === b) panel.textContent = "Could not load task details: " + e.message; });
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && open) hide(); });
  }
})();`;

/** Styles, scoped under `.pt-diagram`. Colours follow the page's own text colour where they can. */
export const PANEL_CSS = [
  ".pt-diagram{position:relative;width:100%}",
  ".pt-diagram>img{display:block;width:100%;height:auto}",
  ".pt-mark{position:absolute;transform:translate(-50%,-50%);width:1.35em;height:1.35em;padding:0;border-radius:50%;" +
    "border:1px solid #1f6feb;background:#fff;color:#1f6feb;font:bold 0.8em/1 sans-serif;cursor:pointer;" +
    "display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,.25)}",
  // A call activity's [+] is a link to the process it calls (owner,
  // 2026-10-31: "i thought i would be able click to follow to a subprocess";
  // 2026-11-03: "the subprocess should be opened by the [+] not the whole
  // box"). The ⓘ stays the way to the details.
  // The layer is laid over the drawing by the client; with no script it is the whole block.
  ".pt-layer{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2}",
  ".pt-layer>*{pointer-events:auto}",
  ".pt-go{position:absolute;display:block;border-radius:3px;cursor:pointer}",
  ".pt-go:hover,.pt-go:focus-visible{outline:2px solid #1f6feb;outline-offset:1px;background:rgba(31,111,235,.07)}",
  ".pt-mark{z-index:1}",
  ".pt-mark:hover,.pt-mark[aria-expanded=true]{background:#1f6feb;color:#fff}",
  ".pt-mark:focus-visible{outline:2px solid #1f6feb;outline-offset:2px}",
  ".pt-panel{position:absolute;z-index:5;text-align:left;margin:0.9em 0 0 -0.6em;max-width:min(26em,90vw);min-width:14em;padding:0.6em 0.7em;" +
    "background:#fff;color:#1b1f24;border:1px solid #8c959f;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.18);font-size:0.85em;line-height:1.35}",
  ".pt-close{position:absolute;top:0.2em;right:0.35em;border:0;background:none;font-size:1.2em;cursor:pointer;color:inherit}",
  ".pt-obj{border:1px solid #57606a;border-radius:3px;margin:0.15em 0}",
  ".pt-head{border-bottom:1px solid #57606a;padding:0.15em 0.45em;background:#f6f8fa;text-decoration:underline}",
  ".pt-head .pt-st{text-decoration:none;display:inline-block;margin-right:0.35em}",
  ".pt-attr{padding:0.1em 0.45em}",
  ".pt-st,.pt-via{color:#57606a;font-size:0.9em}",
  ".pt-edge{color:#57606a;font-size:0.85em;padding-left:1em}",
  ".pt-role .pt-head{background:#fff8c5}.pt-skill .pt-head{background:#ddf4ff}.pt-task .pt-head{background:#f6f8fa}",
  ".pt-none{color:#57606a;font-style:italic;margin-top:0.3em}",
  // A highlighted step (data-pt-highlight). The drawing's own classes are
  // prefixed when docs-ui.js inlines it, so they are matched by their ending.
  '.pt-diagram [data-pt-hl]>[class$="djs-visual"]>:first-child{stroke:#d97706!important;stroke-width:4px!important;fill:#fff3d6!important}',
  '.pt-diagram [data-pt-hl]>[class$="djs-visual"]>path:first-child{fill:none!important}',
  '.pt-has-hl [class*="djs-shape"]:not([data-pt-hl])>[class$="djs-visual"]>:first-child{opacity:.75}',
].join("");

/**
 * The diagram block for a process page: the image, a marker per task, the
 * (empty, hidden) panel, and the client. `panelHref` is the sidecar's URL
 * relative to the page.
 */
export function diagramBlock(opts: { img: string; alt: string; markers: readonly Marker[]; panelHref: string }): string[] {
  if (opts.markers.length === 0) {
    return [`<img src="${escAttr(opts.img)}" alt="${escAttr(opts.alt)}" style="max-width:100%">`];
  }
  const L: string[] = [];
  L.push(`<style>${PANEL_CSS}</style>`);
  L.push(`<div class="pt-diagram" data-panel="${escAttr(opts.panelHref)}">`);
  L.push(`<img src="${escAttr(opts.img)}" alt="${escAttr(opts.alt)}">`);
  L.push(`<div class="pt-layer">`);
  for (const m of opts.markers) {
    if (m.href && m.box) {
      L.push(
        `<a class="pt-go" href="${escAttr(m.href)}" style="left:${m.box.left}%;top:${m.box.top}%;width:${m.box.width}%;height:${m.box.height}%" ` +
          `aria-label="Open subprocess: ${escAttr(m.name)}" title="Open subprocess: ${escAttr(m.name)}"></a>`,
      );
    }
    L.push(
      `<button type="button" class="pt-mark" data-task="${escAttr(m.id)}" style="left:${m.left}%;top:${m.top}%" ` +
        `aria-expanded="false" aria-label="About step: ${escAttr(m.name)}" title="About: ${escAttr(m.name)}">i</button>`,
    );
  }
  L.push(`</div>`);
  L.push(`<div class="pt-panel" role="dialog" aria-label="Task details" hidden></div>`);
  L.push(`</div>`);
  L.push(`<script>${PANEL_SCRIPT}</script>`);
  return L;
}

/** One name in a panel that links nowhere: what kind it is, and the step that shows it. */
export interface UnlinkedRef {
  kind: "task" | "lane" | "process" | "skill" | "methodology" | "role" | "role-skill" | "calls";
  name: string;
  task: string;
}

/**
 * Every name `data`'s panels show as code rather than a link — the "no page
 * for this one" a reader meets (owner, 2026-11-08: "need QA report"). Read
 * off the sidecar the reader is served, so the report and the panel cannot
 * disagree. A `skills: false` site shows no skills, so reports none.
 */
export function unlinkedPanelRefs(data: PanelData): UnlinkedRef[] {
  const out: UnlinkedRef[] = [];
  const skillsOn = data.skills !== false;
  if (!data.processHref) out.push({ kind: "process", name: data.process, task: "" });
  for (const t of Object.values(data.tasks)) {
    const add = (kind: UnlinkedRef["kind"], l: PanelLink | undefined): void => {
      if (l && !l.href) out.push({ kind, name: l.name, task: t.id });
    };
    if (!t.href && !t.stepHref) out.push({ kind: "task", name: t.name, task: t.id });
    if (t.lane && !t.laneHref) out.push({ kind: "lane", name: t.lane, task: t.id });
    add("calls", t.calls);
    add("role", t.role);
    if (!skillsOn) continue;
    for (const s of t.skills) {
      add("skill", s);
      for (const m of s.methodologies ?? []) add("methodology", m);
    }
    for (const s of t.role?.skills ?? []) add("role-skill", s);
  }
  return out;
}

/**
 * The QA report page: every unlinked panel name, grouped by kind, with the
 * process pages that show it. `pages` maps a process page's stem to its
 * unlinked names.
 */
export function panelLinksReport(pages: ReadonlyMap<string, { title: string; refs: readonly UnlinkedRef[] }>, frontMatter: string): string {
  const byKind = new Map<string, Map<string, Set<string>>>();
  let total = 0;
  for (const [stem, p] of pages) {
    for (const r of p.refs) {
      total++;
      const names = byKind.get(r.kind) ?? new Map<string, Set<string>>();
      byKind.set(r.kind, names);
      const at = names.get(r.name) ?? new Set<string>();
      names.set(r.name, at);
      at.add(r.task ? `[${p.title.replace(/[\\[\]|]/g, "\\$&")}](${stem}.html#step-${r.task})` : `[${p.title.replace(/[\\[\]|]/g, "\\$&")}](${stem}.html)`);
    }
  }
  const L: string[] = ["---", "title: 'Task panel links: QA'", "nav_exclude: true", frontMatter, "---", ""];
  L.push("{: .note }");
  L.push("> Generated by `gen-processes-viz.ts` from the ⓘ task panels' data — do not edit here. [All processes](index.html)");
  L.push("");
  L.push("# Task panel links: QA");
  L.push("");
  L.push(
    "Every name an ⓘ task panel shows as plain text, with the tooltip \"no page for this one\", because nothing it " +
      "could link to was found: no instruction page or source file for a skill, no page for a role, methodology, lane or step.",
  );
  L.push("");
  if (total === 0) {
    L.push("**Every name in every panel links to a page.**");
    return `${L.join("\n")}\n`;
  }
  L.push(`**${total}** unlinked name(s) across **${[...pages.values()].filter((p) => p.refs.length > 0).length}** process page(s).`);
  L.push("");
  for (const [kind, names] of [...byKind].sort((a, b) => a[0].localeCompare(b[0], "en"))) {
    L.push(`## ${kind}`);
    L.push("");
    L.push("| name | shown on |");
    L.push("|---|---|");
    for (const [name, at] of [...names].sort((a, b) => a[0].localeCompare(b[0], "en"))) {
      L.push(`| \`${name.replace(/[|`]/g, "")}\` | ${[...at].sort().join(", ")} |`);
    }
    L.push("");
  }
  return `${L.join("\n")}\n`;
}
