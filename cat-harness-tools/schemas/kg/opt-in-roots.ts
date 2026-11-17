/**
 * Where a layer's opt-in sub-graphs are on disk.
 *
 * @module schemas/kg/opt-in-roots
 * @graphNode none — a reader over declared opt-in sub-graphs; it defines no schema
 *
 * Every opt-in sub-graph a layer declares (`optIn: true`, top level or from
 * within), whether or not it is switched on, with its qualified id. A page
 * that is always mounted must not link into one (`check:optin-links`), and a
 * generated list names what is inside one without linking it (`readme:sync`).
 * Rule and reader live in `opt-in-subgraphs.ts`; this module only locates.
 */
import { sep } from "node:path";

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { defaultEnabledSubgraphs, readDeclaration, resolveDirectories } from "./cat-harness.js";
import { isSubgraphEnabled, qualifiedSubgraphId } from "./opt-in-subgraphs.js";
import { leftOutByMount } from "./remote-mount.js";

/** One opt-in sub-graph: its qualified id and absolute path (no trailing separator). */
export interface OptInRoot {
  id: string;
  abs: string;
}

/** Every opt-in sub-graph `root` declares, top level or from within, switched on or not. */
export function optInRootsOf(root: string): OptInRoot[] {
  const decl = readDeclaration(root);
  if (decl === undefined) return [];
  return resolveDirectories([{ name: decl.name, root, own: true }], undefined, { enabledSubgraphs: "all" })
    .filter((d) => d.own && (d as { optIn?: boolean }).optIn === true)
    .map((d) => ({ id: qualifiedSubgraphId(decl.name, d.id), abs: d.absPath.replace(/[\\/]+$/, "") }));
}

/** The innermost opt-in sub-graph holding `abs`, if any. */
export function groupOf(abs: string, roots: readonly OptInRoot[]): OptInRoot | undefined {
  let best: OptInRoot | undefined;
  for (const r of roots) {
    if ((abs === r.abs || abs.startsWith(r.abs + sep)) && (best === undefined || r.abs.length > best.abs.length)) best = r;
  }
  return best;
}

/**
 * The opt-in sub-graphs of `root` that are switched off for the resolution
 * rooted there — by the root that MOUNTED it, when a mount placed it
 * (`defaultEnabledSubgraphs`, owner 2026-11-12, card Q-OPTIN-DIRS A).
 *
 * - `onDisk`: switched off and still on disk — a check can read what is in
 *   them, and judge by name.
 * - `leftOut`: switched off and left out by the mount (`leftOutByMount`) —
 *   nothing is on disk, so what they hold cannot be listed here.
 */
export function switchedOffGroups(root: string): { onDisk: OptInRoot[]; leftOut: OptInRoot[] } {
  const onDisk: OptInRoot[] = [];
  const leftOut: OptInRoot[] = [];
  const enabled = defaultEnabledSubgraphs(root);
  for (const g of optInRootsOf(root)) {
    if (isSubgraphEnabled(enabled, g.id)) continue;
    if (existsSync(g.abs)) onDisk.push(g);
    else if (leftOutByMount(root, g.abs)) leftOut.push(g);
  }
  return { onDisk, leftOut };
}

/** Every file under `dir` whose name ends with `ext`, by stem. */
function stemsUnder(dir: string, ext: string, out: Set<string> = new Set()): Set<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) stemsUnder(join(dir, e.name), ext, out);
    else if (e.name.endsWith(ext)) out.add(e.name.slice(0, -ext.length));
  }
  return out;
}

/**
 * Why a thing of `root`'s named `stem` (a file `<stem><ext>`) that a check
 * cannot find is NOT judged here, or `undefined` when it is a defect.
 *
 * - A `<stem><ext>` in a switched-off group still on disk: held there.
 * - `root` has switched-off groups the mount left out: it may be in one, and
 *   nothing on disk can say; the layer that switches them on judges it.
 * - Otherwise `undefined`: missing for a reason consent does not explain.
 */
export function notJudgedInSwitchedOff(
  stem: string,
  ext: string,
  root: string,
  groups: { onDisk: readonly OptInRoot[]; leftOut: readonly OptInRoot[] } = switchedOffGroups(root),
): { groups: string[]; reason: string } | undefined {
  const held = groups.onDisk.filter((g) => stemsUnder(g.abs, ext).has(stem)).map((g) => g.id);
  if (held.length) return { groups: held, reason: "held in an opt-in sub-graph switched off here" };
  if (groups.leftOut.length) {
    return { groups: groups.leftOut.map((g) => g.id), reason: "may be in an opt-in sub-graph the mount left out; judged where it is switched on" };
  }
  return undefined;
}
