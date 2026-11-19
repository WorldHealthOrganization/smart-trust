#!/usr/bin/env bun
/**
 * Does every script live in the manifest of the layer it runs?
 *
 * Scripts are split by layer (`cat-harness/schemas/sdlc/script-table.ts`). A
 * script whose command names one layer's paths belongs to that layer; one
 * naming several belongs to the one that needs all the others (its declared
 * `needs`, transitively); one naming none, or naming layers no single one
 * needs, belongs to the root, the aggregate.
 *
 * The layers and their order are READ from each layer's declaration, never
 * listed here. A submodule (another repository's checkout) is not a layer of
 * this one: a script running its code stays at the root.
 *
 *   bun run cat check:script-placement
 *
 * @covers none — it places scripts by the paths their commands name; it judges no graph
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { scriptTable } from "../schemas/sdlc/script-table.ts";
import { mountScopeFor } from "../schemas/kg/remote-mount.ts";

const REPO = resolve(import.meta.dir, "..", "..");

/** The layers of this repository (not submodules), each with its declared `needs`. */
export function layersOf(repo: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const inst of layerRootsIn(repo)) {
    if (resolve(inst) === resolve(repo)) continue;
    if (existsSync(join(inst, ".git"))) continue; // a submodule: another repository
    const name = basename(inst);
    const decl = join(inst, `${name}.json`);
    const needs = existsSync(decl)
      ? (((JSON.parse(readFileSync(decl, "utf-8")) as { needs?: unknown[] }).needs ?? []) as unknown[])
          .map((n) => (typeof n === "string" ? n : ((n as { id?: string; path?: string }).id ?? (n as { path?: string }).path ?? "")))
          .filter(Boolean)
      : [];
    out.set(relative(repo, inst), needs);
  }
  return out;
}

/** The manifest a command belongs in: a layer's `package.json`, or the root's. */
export function ownerOf(command: string, layers: Map<string, string[]>, foreign: ReadonlySet<string> = new Set()): string {
  const closure = (l: string, seen = new Set<string>()): Set<string> => {
    for (const n of layers.get(l) ?? []) if (!seen.has(n)) { seen.add(n); closure(n, seen); }
    return seen;
  };
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A MOUNTED layer (bean `nn8e`) still counts when following `needs` — a
  // layer above it reaches the rest of the stack through it — but it cannot
  // OWN a script here: its manifest belongs to its own repository.
  const named = [...layers.keys()].filter((l) => !foreign.has(l)).filter((l) => new RegExp(`(^|[\\s"'=(/])${esc(l)}(/|$|[\\s"')])`).test(command));
  if (named.length === 0) return "package.json";
  const owners = named.filter((c) => named.every((o) => o === c || closure(c).has(o)));
  return owners.length === 1 ? `${owners[0]}/package.json` : "package.json";
}

if (import.meta.main) {
  const layers = layersOf(REPO);
  const foreign = new Set([...layers.keys()].filter((l) => mountScopeFor(join(REPO, l)) !== undefined));
  let table;
  try {
    table = scriptTable(REPO);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
  const wrong: string[] = [];
  for (const e of table.values()) {
    if (e.name === "cat" && e.manifest === "package.json") continue; // the runner itself
    // A mounted layer's manifest is its own repository's to keep (bean `nn8e`):
    // its scripts sit where that repository put them, and this checkout cannot move them.
    if (e.manifest !== "package.json" && mountScopeFor(dirname(join(REPO, e.manifest))) !== undefined) continue;
    const want = ownerOf(e.command, layers, foreign);
    if (want !== e.manifest) wrong.push(`  ${e.name}: in ${e.manifest}, belongs in ${want}\n      ${e.command}`);
  }
  if (wrong.length > 0) {
    console.error(`✗ ${wrong.length} script(s) in the wrong manifest:\n${wrong.join("\n")}`);
    console.error("  A layer's scripts go in its package.json under `checkoutScripts`; the root keeps only what runs no single layer.");
    process.exit(1);
  }
  console.log(`✓ ${table.size} script(s), each in the manifest of the layer it runs`);
}
