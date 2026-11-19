/**
 * Tidy what bpmn-js drew, before it is saved as SVG: put every label where it
 * can be read, and fit every name in its box.
 *
 * @module bootstrap-tools/scripts/bpmn-tidy
 * @covers code
 *
 * bpmn-js draws a label where the DI's `BPMNLabel` bounds put it, or, with
 * none, under its shape or at the middle of its flow, without looking at what
 * is already there. It wraps a name at a fixed width and breaks a word that
 * does not fit mid-word. So on a busy diagram a gateway's question lands on
 * its flows' conditions, a condition sits on a line or a box, a data store's
 * name runs across a lane line, and a task's name runs past its box and under
 * its icon (owner, 2026-11-11, on a downstream layer's business processes: *"bad
 * bpmn"*, with eight screenshots). This is the one place every picture passes
 * through, so it is fixed here, for every diagram, not in each `.bpmn`.
 *
 * {@link tidyDrawing} runs INSIDE the page, on a bpmn-js Viewer that has just
 * imported a diagram. It must stay self-contained (no imports, no closures):
 * {@link openRenderer} ships it to the page as its source text.
 *
 * What it does, in order:
 *
 * 1. **Square bends.** Every flow is drawn as straight segments, with no
 *    rounded corner where it turns (owner, 2026-11-11, on process E: *"why not
 *    squares like rest"*).
 * 2. **Names inside shapes** (tasks, call activities, sub-processes) are
 *    re-laid at the largest size from 16px down to 11px at which every word
 *    fits whole, every line fits inside the box, and no line runs under the
 *    task-type icon (top left) or the collapsed or loop marker (bottom
 *    middle). Words are never broken.
 * 3. **Pool and lane names** get the same treatment in their header strip.
 * 4. **Labels outside shapes** (gateways, events, data stores and data objects,
 *    and flow conditions) are each tried at a handful of places and widths
 *    around their shape or along their flow. Each place is scored by what it
 *    would cover: a shape, a flow, a lane or pool line, the header strip, or
 *    a label already placed. The cheapest place wins. Gateways and events go
 *    first, then flows, nearest the gateway first.
 *
 * It returns what it could not fix, as `issues`, so a caller (or a check) can
 * say so instead of publishing it silently.
 */

/** What {@link tidyDrawing} reads from the page's text style. */
export interface TidyStyle {
  /** Inside shapes: the starting size, shrunk down to `minFontSize` to fit. */
  defaultStyle: { fontSize: number; lineHeight: number };
  /** Outside shapes. */
  externalStyle: { fontSize: number; lineHeight: number };
  /** Pool and lane names. */
  headerStyle: { fontSize: number; lineHeight: number };
  minFontSize: number;
  squareBends: boolean;
}

/**
 * Tidy the diagram `viewer` has drawn (see the module comment). Runs in the
 * browser; `viewer` is a bpmn-js Viewer after `importXML`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tidyDrawing(viewer: any, style: TidyStyle): { issues: string[]; fontSize?: number; limitedBy: string[] } {
  type Box = { x: number; y: number; width: number; height: number };
  type Seg = { x1: number; y1: number; x2: number; y2: number };
  type Point = { x: number; y: number };
  /** The part of a bpmn-js diagram element (shape, connection or label) this function reads. */
  interface DiagramElement {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    waypoints?: Point[];
    parent?: DiagramElement;
    source?: DiagramElement;
    target?: DiagramElement;
    labelTarget?: DiagramElement;
    businessObject?: { name?: string; loopCharacteristics?: unknown; isForCompensation?: boolean };
    di?: { isHorizontal?: boolean; isExpanded?: boolean };
  }
  /** An activity with a name (see `acts`). */
  type NamedActivity = DiagramElement & { businessObject: NonNullable<DiagramElement["businessObject"]> };
  /** An external label: drawn for its `labelTarget` (see `labels`). */
  type Label = DiagramElement & { labelTarget: DiagramElement };
  const issues: string[] = [];
  const reg = viewer.get("elementRegistry");
  const texter = viewer.get("textRenderer");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = reg.getAll();
  const NS = "http://www.w3.org/2000/svg";
  const svgRoot = document.querySelector("#canvas svg") as SVGSVGElement;

  // ---- measuring -----------------------------------------------------------
  const probe = document.createElementNS(NS, "text");
  probe.setAttribute("style", "font-family: Arial, sans-serif;");
  svgRoot.appendChild(probe);
  const widthCache = new Map<string, number>();
  const textWidth = (s: string, size: number): number => {
    const k = `${size}|${s}`;
    let w = widthCache.get(k);
    if (w === undefined) {
      probe.style.fontSize = `${size}px`;
      probe.textContent = s;
      w = probe.getComputedTextLength();
      widthCache.set(k, w);
    }
    return w;
  };
  const words = (s: string): string[] => s.split(/\s+/).filter(Boolean);
  const longestWord = (s: string, size: number): number => Math.max(0, ...words(s).map((w) => textWidth(w, size)));
  /** Greedy word wrap at `width`, as bpmn-js does when every word fits. */
  const wrap = (s: string, size: number, width: number): string[] => {
    const lines: string[] = [];
    let cur = "";
    for (const w of words(s)) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && textWidth(next, size) > width) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  /** As {@link wrap}, but a word too wide for a line breaks after a "." "/" "_" or "-" inside it. */
  const wrapSoft = (s: string, size: number, width: number): string[] => {
    const lines: string[] = [];
    let cur = "";
    for (const w of words(s)) {
      const parts = textWidth(w, size) > width ? w.split(/(?<=[./_-])/) : [w];
      parts.forEach((p, i) => {
        const glue = i === 0 ? (cur ? " " : "") : "";
        const next = cur + glue + p;
        if (cur && textWidth(next, size) > width) {
          lines.push(cur);
          cur = p;
        } else cur = next;
      });
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const blockOf = (s: string, size: number, lineHeight: number, width: number) => {
    const lines = wrap(s, size, width);
    return {
      lines,
      width: Math.max(0, ...lines.map((l) => textWidth(l, size))),
      height: lines.length * size * lineHeight,
    };
  };

  // ---- geometry ------------------------------------------------------------
  const overlap = (a: Box, b: Box): number => {
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  };
  const grow = (b: Box, d: number): Box => ({ x: b.x - d, y: b.y - d, width: b.width + 2 * d, height: b.height + 2 * d });
  /** Does an axis-aligned (or any) segment cross box `b`? Liang–Barsky clip. */
  const crosses = (s: Seg, b: Box): boolean => {
    let t0 = 0;
    let t1 = 1;
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const p = [-dx, dx, -dy, dy];
    const q = [s.x1 - b.x, b.x + b.width - s.x1, s.y1 - b.y, b.y + b.height - s.y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i]! < 0) return false;
      } else {
        const t = q[i]! / p[i]!;
        if (p[i]! < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
        if (t0 > t1) return false;
      }
    }
    return true;
  };
  const textBox = (el: SVGGraphicsElement, ox: number, oy: number): Box | undefined => {
    const b = el.getBBox();
    return b.width > 0 ? { x: ox + b.x, y: oy + b.y, width: b.width, height: b.height } : undefined;
  };

  const isFlowNode = (e: DiagramElement) => !e.waypoints && e.type !== "label" && !/Participant|Lane|Process|Collaboration|TextAnnotation|Group/.test(e.type) && e.parent;
  const isActivity = (e: DiagramElement) => /^bpmn:(Task|\w+Task|SubProcess|CallActivity|Transaction|AdHocSubProcess)$/.test(e.type);

  // ---- 1. square bends -----------------------------------------------------
  if (style.squareBends) {
    for (const e of all) {
      if (!Array.isArray(e.waypoints)) continue;
      const path = reg.getGraphics(e)?.querySelector(".djs-visual > path") as SVGPathElement | null;
      if (!path) continue;
      path.setAttribute("d", e.waypoints.map((p: { x: number; y: number }, i: number) => `${i ? "L" : "M"}${p.x},${p.y}`).join(""));
      delete (path as SVGElement & { dataset: DOMStringMap }).dataset.cornerRadius;
    }
  }

  // ---- 2. names inside shapes ---------------------------------------------
  // One size for every name in the diagram: the largest at which all of them
  // fit whole. Names in one picture at three sizes read as three kinds of thing.
  const ICON: Box = { x: 0, y: 0, width: 30, height: 26 };
  const placedText: Box[] = [];
  const side = 6;
  const acts = all.filter((e) => isActivity(e) && e.businessObject?.name && reg.getGraphics(e)?.querySelector(".djs-visual > text.djs-label"));
  const fitIn = (e: NamedActivity, size: number, soft: boolean): { lines: string[]; top: number } | undefined => {
    const name = String(e.businessObject.name);
    const typed = e.type !== "bpmn:Task" && /Task$/.test(e.type);
    const bo = e.businessObject;
    const marked = (/SubProcess|CallActivity|Transaction/.test(e.type) && !e.di?.isExpanded) || !!bo.loopCharacteristics || !!bo.isForCompensation;
    const bottom = marked ? 22 : 5;
    const inner = e.width - 2 * side;
    if (!soft && longestWord(name, size) > inner) return undefined;
    const lh = size * style.defaultStyle.lineHeight;
    const lines = soft ? wrapSoft(name, size, inner) : wrap(name, size, inner);
    if (lines.some((l) => textWidth(l, size) > inner)) return undefined;
    const h = lines.length * lh;
    // Centre the block in the room left; push it below the icon if a line runs under it.
    for (const topMin of typed ? [4, ICON.height + 1] : [4]) {
      const room = e.height - topMin - bottom;
      if (h > room) continue;
      const top = topMin + (room - h) / 2;
      const underIcon = typed && lines.some((l, i) => {
        const w = textWidth(l, size);
        return overlap({ x: (e.width - w) / 2, y: top + i * lh, width: w, height: lh }, ICON) > 0;
      });
      if (!underIcon) return { lines, top };
    }
    return undefined;
  };
  const sizes: number[] = [];
  for (let size = style.defaultStyle.fontSize; size >= style.minFontSize; size--) sizes.push(size);
  // A word too wide for its box (an identifier such as authorization_details)
  // may break after a "." "/" "_" or "-", never elsewhere, when keeping it
  // whole would shrink every name in the diagram by more than a point.
  const whole = sizes.find((z) => acts.every((e) => fitIn(e, z, false)));
  const broken = sizes.find((z) => acts.every((e) => fitIn(e, z, true)));
  const soft = broken !== undefined && (whole === undefined || broken > whole + 1);
  const size = soft ? broken : whole;
  const limitedBy = size === undefined ? [] : acts.filter((e) => !fitIn(e, size + 1, soft)).map((e) => e.id);
  for (const e of acts) {
    const old = reg.getGraphics(e).querySelector(".djs-visual > text.djs-label") as SVGTextElement;
    let at = size;
    let fit = size !== undefined ? fitIn(e, size, soft) : undefined;
    if (!fit) {
      // The diagram has no common size: this one gets the largest size it fits at, alone.
      at = sizes.find((z) => fitIn(e, z, true));
      fit = at !== undefined ? fitIn(e, at, true) : undefined;
    }
    if (!fit || at === undefined) {
      issues.push(`${e.id}: name does not fit its ${e.width}×${e.height} box even at ${style.minFontSize}px`);
      continue;
    }
    const t = texter.createText(fit.lines.join("\n"), {
      box: { width: e.width, height: e.height },
      align: "center-top",
      padding: 0, // lines are already broken to fit inside the side margins
      style: { fontSize: at, lineHeight: style.defaultStyle.lineHeight, fill: old.style.fill || "black" },
    }) as SVGTextElement;
    t.setAttribute("class", "djs-label");
    t.setAttribute("transform", `translate(0 ${fit.top})`);
    old.replaceWith(t);
    const b = textBox(t, e.x, e.y + fit.top);
    if (b) placedText.push(b);
  }

  // ---- 3. pool and lane names ---------------------------------------------
  for (const e of all) {
    if (!/^bpmn:(Participant|Lane)$/.test(e.type) || !e.businessObject?.name) continue;
    if (e.di?.isHorizontal === false) continue;
    const old = reg.getGraphics(e)?.querySelector(".djs-visual > text.djs-label") as SVGTextElement | null;
    if (!old) continue;
    const name = String(e.businessObject.name);
    const room = e.height - 6;
    let size = style.headerStyle.fontSize;
    for (; size > style.minFontSize - 2; size--) {
      if (longestWord(name, size) > room) continue;
      if (blockOf(name, size, style.headerStyle.lineHeight, room).height <= 28) break;
    }
    const block = blockOf(name, size, style.headerStyle.lineHeight, room);
    if (block.height > 28 || longestWord(name, size) > room) issues.push(`${e.id}: name does not fit its header strip`);
    const t = texter.createText(block.lines.join("\n"), {
      box: { width: e.height, height: 30 },
      align: "center-middle",
      padding: 0,
      style: { fontSize: size, lineHeight: style.headerStyle.lineHeight, fill: old.style.fill || "black" },
    }) as SVGTextElement;
    t.setAttribute("class", "djs-label");
    const tf = old.getAttribute("transform");
    if (tf) t.setAttribute("transform", tf);
    old.replaceWith(t);
  }

  // ---- 4. labels outside shapes -------------------------------------------
  const shapes: Box[] = all.filter(isFlowNode).map((e) => ({ x: e.x, y: e.y, width: e.width, height: e.height }));
  const flows: (Seg & { id: string })[] = all
    .filter((e) => Array.isArray(e.waypoints))
    .flatMap((e) => e.waypoints.slice(1).map((p: Point, i: number) => ({ id: e.id, x1: e.waypoints[i].x, y1: e.waypoints[i].y, x2: p.x, y2: p.y })));
  const sharesRun = (f: Seg, g: Seg): boolean => {
    if (f.x1 === f.x2 && g.x1 === g.x2 && Math.abs(f.x1 - g.x1) < 1) {
      return Math.min(Math.max(f.y1, f.y2), Math.max(g.y1, g.y2)) - Math.max(Math.min(f.y1, f.y2), Math.min(g.y1, g.y2)) > 2;
    }
    if (f.y1 === f.y2 && g.y1 === g.y2 && Math.abs(f.y1 - g.y1) < 1) {
      return Math.min(Math.max(f.x1, f.x2), Math.max(g.x1, g.x2)) - Math.max(Math.min(f.x1, f.x2), Math.min(g.x1, g.x2)) > 2;
    }
    return false;
  };
  const pools = all.filter((e) => e.type === "bpmn:Participant");
  const lanes = all.filter((e) => e.type === "bpmn:Lane");
  // Lines a label must not cross: every pool and lane edge, and each header strip's inner edge.
  const rules: Seg[] = [];
  for (const p of [...pools, ...lanes]) {
    rules.push({ x1: p.x, y1: p.y, x2: p.x + p.width, y2: p.y }, { x1: p.x, y1: p.y + p.height, x2: p.x + p.width, y2: p.y + p.height });
    rules.push({ x1: p.x, y1: p.y, x2: p.x, y2: p.y + p.height }, { x1: p.x + p.width, y1: p.y, x2: p.x + p.width, y2: p.y + p.height });
  }
  const headers: Box[] = [...pools, ...lanes].filter((p) => p.di?.isHorizontal !== false).map((p) => ({ x: p.x, y: p.y, width: 30, height: p.height }));
  const placed: Box[] = [...placedText];

  const cost = (r: Box, inPool: boolean): number => {
    const g = grow(r, 2);
    let c = 0;
    for (const s of shapes) {
      const o = overlap(g, s);
      if (o > 0) c += 1000 + o;
    }
    for (const f of flows) if (crosses(f, g)) c += 600;
    for (const l of rules) if (crosses(l, g)) c += 1500;
    for (const h of headers) if (overlap(g, h) > 0) c += 1500;
    for (const p of placed) {
      const o = overlap(g, p);
      if (o > 0) c += 1500 + o;
    }
    // A label belongs inside a pool when its shape or flow is in one; a data store drawn outside every pool keeps its label outside too.
    if (inPool && !pools.some((p) => overlap(r, p) === r.width * r.height)) c += 1500;
    return c;
  };

  const labels = all.filter((e) => e.type === "label" && e.businessObject?.name && e.labelTarget);
  const order = (e: Label) => (Array.isArray(e.labelTarget.waypoints) ? 1 : 0);
  labels.sort((a, b) => order(a) - order(b));
  const ext = style.externalStyle;
  const widths = [90, 120, 160, 210, 260];
  for (const lab of labels) {
    const gfx = reg.getGraphics(lab) as SVGGElement | null;
    const old = gfx?.querySelector(".djs-visual > text") as SVGTextElement | null;
    if (!gfx || !old) continue;
    const name = String(lab.businessObject.name);
    const target = lab.labelTarget;
    const g = 4;
    const cands: { box: Box; width: number; pref: number; lines: string[] }[] = [];
    for (const W of widths) {
      if (longestWord(name, ext.fontSize) > W) continue;
      const blk = blockOf(name, ext.fontSize, ext.lineHeight, W);
      const w = blk.width;
      const h = blk.height;
      const wp = W / 30 + 3 * blk.lines.length; // few lines, not too wide
      if (!Array.isArray(target.waypoints)) {
        const s: Box = { x: target.x, y: target.y, width: target.width, height: target.height };
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        const at = (x: number, y: number, pref: number) => cands.push({ box: { x, y, width: w, height: h }, width: W, pref: pref + wp, lines: blk.lines });
        at(cx - w / 2, s.y + s.height + g, 0);
        at(cx - w / 2, s.y - g - h, 4);
        at(s.x + s.width + g, cy - h / 2, 8);
        at(s.x - g - w, cy - h / 2, 8);
        at(s.x + s.width + g, s.y + s.height + g, 12);
        at(s.x - g - w, s.y + s.height + g, 12);
        at(s.x + s.width + g, s.y - g - h, 12);
        at(s.x - g - w, s.y - g - h, 12);
      } else {
        const pts = target.waypoints as { x: number; y: number }[];
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]!;
          const b = pts[i]!;
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (len < 12) continue;
          const horizontal = Math.abs(b.y - a.y) < Math.abs(b.x - a.x);
          // A stretch another flow also runs along does not say which flow a label is for.
          const shared = flows.some((f) => f.id !== target.id && sharesRun(f, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
          for (const t of [0.5, 0.25, 0.75]) {
            const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            const pref = i * 6 + (t === 0.5 ? 0 : 2) + (shared ? 60 : 0);
            const at = (x: number, y: number, extra: number) => cands.push({ box: { x, y, width: w, height: h }, width: W, pref: pref + extra + wp, lines: blk.lines });
            if (horizontal) {
              at(p.x - w / 2, p.y - g - h, 0);
              at(p.x - w / 2, p.y + g, 1);
            } else {
              at(p.x + g, p.y - h / 2, 0);
              at(p.x - g - w, p.y - h / 2, 1);
            }
          }
          // Just past where the flow leaves its source: the usual place for a condition.
          if (i === 1 && horizontal && !shared) {
            const x = b.x > a.x ? a.x + 6 : a.x - 6 - w;
            cands.push({ box: { x, y: a.y - g - h, width: w, height: h }, width: W, pref: 2 + wp, lines: blk.lines });
            cands.push({ box: { x, y: a.y + g, width: w, height: h }, width: W, pref: 3 + wp, lines: blk.lines });
          }
        }
      }
    }
    if (!cands.length) {
      issues.push(`${target.id}: label has a word wider than ${widths[widths.length - 1]}`);
      continue;
    }
    const anchor = Array.isArray(target.waypoints) ? target.waypoints[0] : { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    const inPool = pools.some((p) => anchor.x >= p.x && anchor.x <= p.x + p.width && anchor.y >= p.y && anchor.y <= p.y + p.height);
    let best = cands[0]!;
    let bestCost = Infinity;
    for (const c of cands) {
      const k = cost(c.box, inPool) + c.pref;
      if (k < bestCost) {
        bestCost = k;
        best = c;
      }
    }
    if (bestCost >= 600) issues.push(`${target.id}: no clear place for its label "${name}"`);
    // The lines are already broken; lay them in a box with room to spare so
    // bpmn-js, measuring a hair differently, cannot break them again, and
    // shift the box back so the text centres on the place chosen.
    const SLACK = 40;
    const t = texter.createText(best.lines.join("\n"), {
      box: { width: best.box.width + SLACK, height: best.box.height },
      align: "center-top",
      padding: 0,
      style: { fontSize: ext.fontSize, lineHeight: ext.lineHeight, fill: old.style.fill || "black" },
    }) as SVGTextElement;
    t.setAttribute("class", "djs-label");
    old.replaceWith(t);
    lab.x = best.box.x - SLACK / 2;
    lab.y = best.box.y;
    lab.width = best.box.width + SLACK;
    lab.height = best.box.height;
    gfx.setAttribute("transform", `matrix(1 0 0 1 ${best.box.x - SLACK / 2} ${best.box.y})`);
    const hit = gfx.querySelector(".djs-hit") as SVGRectElement | null;
    if (hit) {
      hit.setAttribute("width", String(best.box.width + SLACK));
      hit.setAttribute("height", String(best.box.height));
    }
    const b = textBox(t, best.box.x - SLACK / 2, best.box.y);
    placed.push(b ?? best.box);
  }

  // ---- what is still wrong -------------------------------------------------
  // A flow that runs through a shape it neither leaves nor enters.
  for (const e of all) {
    if (!Array.isArray(e.waypoints)) continue;
    const ends = new Set([e.source?.id, e.target?.id]);
    for (const n of all) {
      if (!isFlowNode(n) || ends.has(n.id)) continue;
      const inner = grow({ x: n.x, y: n.y, width: n.width, height: n.height }, -2);
      if (e.waypoints.slice(1).some((p: Point, i: number) => crosses({ x1: e.waypoints[i].x, y1: e.waypoints[i].y, x2: p.x, y2: p.y }, inner))) {
        issues.push(`${e.id}: flow runs through ${n.id}`);
      }
    }
  }
  probe.remove();
  return { issues, fontSize: size, limitedBy };
}
