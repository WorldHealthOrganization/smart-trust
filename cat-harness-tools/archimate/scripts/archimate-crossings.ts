#!/usr/bin/env bun
/**
 * Count the tangles in an ArchiMate view as it is drawn: lines that cross
 * each other, and lines that run through a box they do not connect.
 *
 * @module cat-harness/archimate/scripts/archimate-crossings
 * @covers archimate
 *
 * Owner, 2026-10-31, of a view with lines drawn across each other: *"lots
 * crossed lines. detangle. (skill/process always check and try minimize
 * when authoring archimate)"*. So an author counts before and after every
 * change to a view, and a change does not add tangles.
 *
 * Usage:
 *   bun run cat-harness-tools/archimate/scripts/archimate-crossings.ts --model <file.archimate> [--view <id or page slug>] [--json]
 *   bun run cat-harness-tools/archimate/scripts/archimate-crossings.ts --model <file> --view <id> --max <n>   # gate: exit 1 above n
 *
 * The lines are the ones `render-view.ts` draws (`routeConnections`), so what
 * is counted is what a reader sees. What counts:
 *
 * - **crossing**: two lines whose segments cross at a point inside both. Lines
 *   that only meet at a shared box are not a crossing.
 * - **through a box**: a line passing through the inside of an element or
 *   note box that is not one of its ends and does not hold one of its ends.
 *   Groups, and Grouping elements (drawn as bands too), are bands a line may
 *   cross; they are not counted.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readArchimate, type ArchimateModel, type ArchimateView } from "../schemas/archimate.ts";
import { planSlugs } from "../schemas/slugs.ts";
import { routeConnections, type Pt, type RoutedConnection } from "./render-view.ts";
import { segmentsCross as cross, segmentThroughBox as through, segmentsOf } from "../../src/diagram/segment-geometry.ts";

export interface Tangle {
  kind: "crossing" | "through-box";
  /** The connection ids involved: two for a crossing, one for a line through a box. */
  connections: string[];
  /** The box a line runs through. */
  node?: string;
  at: Pt;
}

/** Every tangle in a view, as drawn. `routed` defaults to the view's own routing; a caller that already has it passes it in. */
export function tanglesOf(view: ArchimateView, routed: RoutedConnection[] = routeConnections(view), model?: ArchimateModel): Tangle[] {
  const nodes = new Map(view.nodes.map((n) => [n.id, n]));
  const ancestors = (id: string): Set<string> => {
    const out = new Set<string>([id]);
    for (let p = nodes.get(id)?.parent, seen = 0; p && seen < 64; p = nodes.get(p)?.parent, seen++) out.add(p);
    return out;
  };
  const segs = segmentsOf;
  const out: Tangle[] = [];
  for (let i = 0; i < routed.length; i++) {
    const a = routed[i]!;
    for (let j = i + 1; j < routed.length; j++) {
      const b = routed[j]!;
      for (const [p1, p2] of segs(a.pts)) {
        for (const [p3, p4] of segs(b.pts)) {
          const at = cross(p1, p2, p3, p4);
          if (at) out.push({ kind: "crossing", connections: [a.connection.id, b.connection.id], at });
        }
      }
    }
  }
  // A Grouping element is drawn as a band, as a diagram group is: a line may cross it.
  const groupings = new Set((model?.elements ?? []).filter((e) => e.type === "Grouping").map((e) => e.id));
  const boxes = view.nodes.filter((n) => (n.kind === "element" && !groupings.has(n.ref ?? "")) || n.kind === "note" || n.kind === "view-ref");
  for (const r of routed) {
    const own = new Set([...ancestors(r.connection.source), ...ancestors(r.connection.target)]);
    for (const n of boxes) {
      if (own.has(n.id)) continue;
      // A box that holds one of the line's ends is its container, not in its way.
      for (const [p1, p2] of segs(r.pts)) {
        const at = through(p1, p2, n);
        if (at) {
          out.push({ kind: "through-box", connections: [r.connection.id], node: n.id, at });
          break;
        }
      }
    }
  }
  return out;
}

/**
 * The view a `--view` argument names: by Archi id, by its page slug
 * (`slugs.ts`, e.g. `1-central-health-workforce-registry`), else by exact
 * name. The Tool definitions declare it a `Slug`, so an id or a slug is what
 * a caller passes; the name is for an author at a shell.
 */
export function viewOf(model: ArchimateModel, key: string): ArchimateView | undefined {
  const byId = model.views.find((v) => v.id === key);
  if (byId) return byId;
  const slugs = planSlugs(model);
  return model.views.find((v) => slugs.get(v.id) === key) ?? model.views.find((v) => v.name === key);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const file = arg("model");
  if (!file) {
    console.error("usage: archimate-crossings.ts --model <file.archimate> [--view <id or page slug>] [--max <n>] [--json]");
    process.exit(2);
  }
  const model = readArchimate(readFileSync(resolve(file)));
  const key = arg("view");
  const views = key ? [viewOf(model, key)] : model.views;
  if (views[0] === undefined) {
    console.error(`no view "${key}" in ${file}`);
    process.exit(2);
  }
  const max = arg("max") === undefined ? undefined : Number(arg("max"));
  const names = new Map<string, string>();
  for (const e of model.elements) names.set(e.id, e.name);
  const rows = (views as ArchimateView[]).map((v) => {
    const t = tanglesOf(v, undefined, model);
    return { id: v.id, name: v.name, crossings: t.filter((x) => x.kind === "crossing").length, throughBox: t.filter((x) => x.kind === "through-box").length, tangles: t };
  });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(rows.map(({ tangles, ...r }) => ({ ...r, tangles: key ? tangles : undefined })), null, 2));
  } else {
    for (const r of rows) console.log(`${String(r.crossings).padStart(4)} crossing(s) ${String(r.throughBox).padStart(4)} through a box  ${r.name} (${r.id})`);
    if (key) {
      const v = views[0]!;
      const label = (cid: string) => {
        const c = v.connections.find((x) => x.id === cid)!;
        const end = (id: string) => { const n = v.nodes.find((x) => x.id === id); return (n?.ref && names.get(n.ref)) || n?.text || id; };
        return `${end(c.source)} → ${end(c.target)}`;
      };
      for (const t of rows[0]!.tangles) {
        const box = t.node ? v.nodes.find((n) => n.id === t.node) : undefined;
        console.log(t.kind === "crossing"
          ? `  ✗ crossing: ${label(t.connections[0]!)}  ×  ${label(t.connections[1]!)}`
          : `  ✗ through "${(box?.ref && names.get(box.ref)) || box?.text || t.node}": ${label(t.connections[0]!)}`);
      }
    }
  }
  if (max !== undefined) {
    const over = rows.filter((r) => r.crossings + r.throughBox > max);
    if (over.length) {
      console.error(`✗ ${over.length} view(s) above ${max} tangle(s)`);
      process.exit(1);
    }
  }
}
