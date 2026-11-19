#!/usr/bin/env bun
/**
 * Report, and optionally fix, what makes a BPMN diagram hard to read at 100%:
 * too wide or too tall, labels on labels, flows or boxes, crossing flows, and a
 * lane order that sends flows across lanes they do not stop in.
 *
 * Runs as both a QA and an author check. The criteria and the budget are
 * `src/workflow/diagram-fit.ts`; the procedure is the `bpmn-detangle` skill.
 *
 * Usage:
 *   bun run cat bpmn:detangle <file.bpmn|dir>...           # report
 *   bun run cat bpmn:detangle <file.bpmn> --write          # also apply the best lane order
 *   bun run cat bpmn:detangle <file.bpmn|dir>... --write --labels-only  # only move labels
 *   bun run cat bpmn:detangle <file.bpmn|dir>... --check   # exit 1 on any finding
 *   bun run cat bpmn:detangle <file.bpmn|dir>... --di-only # skip the browser
 *
 * Labels are checked where bpmn-js DRAWS them, so the browser is used when it
 * is there: a diagram with no `BPMNLabel` bounds leaves label placement to
 * bpmn-js. Without a browser, or with `--di-only`, only labels the file
 * places itself are checked, and the report says so.
 *
 * `--write` moves labels off flows, shapes, other labels and lane lines,
 * draws every task box at one square size (`TASK_SIZE`, growing the lane;
 * a name that does not fit is shortened, never given a bigger box), changes
 * the lane order (re-routing the flows between lanes as elbows) and re-routes
 * slanted flows at right angles. Moving steps is the author's judgement, so
 * it is reported, never guessed. Re-render and look.
 *
 * @module scripts/bpmn-detangle
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { applyLaneOrder, bestLaneOrder, crossings, diagonalEdges, diagramFit, edgesThroughShapes, fixTaskSize, headerOverflow, laneOrder, placeLabels, readDi, resizeShapes, shapeOverlaps, straightenFlows, TASK_SIZE, type DrawnLabels } from "../src/workflow/diagram-fit.ts";

type Draw = (xml: string) => Promise<DrawnLabels | undefined>;

/** bpmn-js in Chromium, through bootstrap-tools' renderer, or undefined when either is missing. */
async function openDraw(): Promise<{ draw: Draw; close: () => Promise<void> } | undefined> {
  try {
    const mod = await import("@litlfred/bootstrap-tools/scripts/render-bpmn.ts");
    const viewer = Bun.resolveSync("bpmn-js/dist/bpmn-viewer.production.min.js", import.meta.dir);
    const r = await mod.openRenderer(viewer);
    return {
      // A renderer from before bootstrap-tools drew labels at TEXT_STYLE returns no layout.
      draw: async (xml) => ((await r.render(xml)) as { layout?: DrawnLabels }).layout,
      close: () => r.close(),
    };
  } catch (e) {
    console.error(`· no browser renderer (${(e instanceof Error ? e.message : String(e)).split("\n")[0]}): labels checked from DI bounds only`);
    return undefined;
  }
}

const args = process.argv.slice(2);
const write = args.includes("--write");
// Move labels only: no lane, flow or box changes, so the diff is labels alone.
const labelsOnly = args.includes("--labels-only");
const fix = write && !labelsOnly;
const check = args.includes("--check");
const paths = args.filter((a) => !a.startsWith("--"));
if (paths.length === 0) {
  console.error("usage: bpmn-detangle <file.bpmn|dir>... [--write] [--check]");
  process.exit(2);
}

function bpmnFiles(p: string): string[] {
  if (statSync(p).isFile()) return p.endsWith(".bpmn") ? [p] : [];
  return readdirSync(p).flatMap((f) => (f === "node_modules" || f.startsWith(".") ? [] : bpmnFiles(join(p, f))));
}

const renderer = args.includes("--di-only") ? undefined : await openDraw();
let total = 0;
for (const file of paths.flatMap(bpmnFiles).sort()) {
  let xml = readFileSync(file, "utf8");
  if (!/<(?:\w+:)?process\b/.test(xml)) continue;
  const shown = relative(process.cwd(), file);
  // What the layout fixes must not make worse: flows through boxes, flows
  // crossing, slanted flows, steps drawn on top of each other. If together they do, the file keeps its layout
  // and only its labels are moved.
  const original = xml;
  const harm = (x: string): number[] => {
    const di = readDi(x);
    return [edgesThroughShapes(di).length, crossings(di).length, diagonalEdges(di).length, shapeOverlaps(di).length];
  };
  const harmBefore = harm(xml);
  if (fix) {
    const before = readDi(xml);
    const best = bestLaneOrder(before);
    if (best.cost < best.current) {
      const next = applyLaneOrder(xml, best.order);
      const was = crossings(before).length, now = crossings(readDi(next)).length;
      const thruWas = edgesThroughShapes(before).length, thruNow = edgesThroughShapes(readDi(next)).length;
      // A swap that shortens the lane trips but adds crossings, or draws a
      // flow through a box, is not a detangle.
      if (now <= was && thruNow <= thruWas) {
        writeFileSync(file, next);
        xml = next;
        console.log(`✓ ${shown}: lanes reordered, lane crossings ${best.current} → ${best.cost}, flow crossings ${was} → ${now}`);
      } else {
        console.log(`· ${shown}: a lane swap would add flow crossings (${was} → ${now}) or flows through boxes (${thruWas} → ${thruNow}); left as it is`);
      }
    }
  }
  if (fix) {
    const { xml: next, fixed } = straightenFlows(xml);
    if (fixed.length > 0) {
      writeFileSync(file, next);
      xml = next;
      console.log(`✓ ${shown}: ${fixed.length} slanted flow(s) routed at right angles (${fixed.join(", ")})`);
    }
  }
  // Every task box one size, square (TASK_SIZE): a box never grows to fit
  // its name, the name is shortened (owner, 2026-11-01). Whole file first;
  // when that makes the layout worse (a flow through a box, a crossing, a
  // slant), the tasks one at a time, keeping each that does not.
  const worse = (x: string, than: number[]): boolean => harm(x).some((n, i) => n > than[i]!);
  const square = (from: string): { xml: string; fixed: string[]; left: number } => {
    const base = harm(from);
    const all = fixTaskSize(from);
    if (all.fixed.length === 0 || !worse(all.xml, base)) return { ...all, left: 0 };
    let next = from;
    const kept: string[] = [];
    for (const id of all.fixed) {
      const one = fixTaskSize(next, new Set([id]));
      if (one.fixed.length > 0 && !worse(one.xml, base)) {
        next = one.xml;
        kept.push(id);
      }
    }
    return { xml: next, fixed: kept, left: all.fixed.length - kept.length };
  };
  const squared = (r: { fixed: string[]; left: number }): void => {
    if (r.left > 0) console.log(`· ${shown}: ${r.left} task(s) left off ${TASK_SIZE.width} × ${TASK_SIZE.height}: resizing them would draw a flow through a box, a crossing, a slant or two steps on top of each other (move the step or the flow)`);
    if (r.fixed.length > 0) console.log(`✓ ${shown}: ${r.fixed.length} task(s) drawn at ${TASK_SIZE.width} × ${TASK_SIZE.height}`);
  };
  if (fix) {
    const r = square(xml);
    if (r.fixed.length > 0) {
      writeFileSync(file, r.xml);
      xml = r.xml;
    }
    squared(r);
  }
  if (fix && renderer) {
    // Pool and lane names that spill out of their header strip: grow the
    // lane (for a pool, its last lane) until the name fits.
    const over = headerOverflow(await renderer.draw(xml).catch(() => undefined));
    if (over.length > 0) {
      const di = readDi(xml);
      const order = laneOrder(di);
      const min = new Map<string, number>();
      for (const h of over) {
        if (di.lanes.has(h.id)) min.set(h.id, Math.max(min.get(h.id) ?? 0, h.need));
        else if (di.pools.has(h.id) && order.length > 0) {
          const last = order.at(-1)!;
          const lh = di.lanes.get(last)!.height;
          min.set(last, Math.max(min.get(last) ?? 0, lh + (h.need - h.room)));
        }
      }
      // A one-lane pool: the pool's own need and the lane's are the same lane.
      xml = resizeShapes(xml, new Map(), min);
      writeFileSync(file, xml);
      console.log(`✓ ${shown}: ${over.length} pool/lane name(s) given room (${over.map((h) => h.id).join(", ")})`);
    }
  }
  if (fix && xml !== original) {
    const now = harm(xml);
    if (now.some((n, i) => n > harmBefore[i]!)) {
      // Keep the square tasks alone, when they on their own do no harm: the
      // other fixes are what tipped it.
      const r = square(original);
      xml = r.fixed.length > 0 && !worse(r.xml, harmBefore) ? r.xml : original;
      writeFileSync(file, xml);
      console.log(`· ${shown}: the layout fixes would add flows through boxes, crossings, slants or overlapping steps ` +
        `(${harmBefore.join("/")} → ${now.join("/")}); layout left as it is${xml === original ? "" : ", but for the square tasks"}, labels only`);
    }
  }
  if (write && renderer) {
    // Labels on flows, shapes, other labels or lane lines go to the nearest
    // clear place. Moving one can free or block another, so a few passes.
    for (let pass = 0; pass < 3; pass++) {
      const seen = await renderer.draw(xml).catch(() => undefined);
      if (!seen) break;
      const { xml: next, moved } = placeLabels(xml, seen);
      if (moved.length === 0) break;
      xml = next;
      writeFileSync(file, xml);
      console.log(`✓ ${shown}: ${moved.length} label(s) moved clear (${moved.join(", ")})`);
    }
  }
  const drawn = renderer ? await renderer.draw(xml).catch(() => undefined) : undefined;
  const findings = Object.entries(diagramFit(xml, drawn)).filter(([, fs]) => fs.length > 0);
  const n = findings.reduce((s, [, fs]) => s + fs.length, 0);
  total += n;
  if (n === 0) {
    console.log(`✓ ${shown}`);
    continue;
  }
  console.log(`⚠ ${shown}: ${n} finding(s)`);
  for (const [k, fs] of findings) for (const f of fs) console.log(`    ${k}  ${f.where}  ${f.detail}`);
}
await renderer?.close();
if (check && total > 0) process.exit(1);
