/**
 * Every knowledge-graph layer smart-base holds, found from its DECLARATIONS
 * rather than imported by name.
 *
 * Each layer is a named subgraph (`L1/`, `L2/`, `L2-bpmn/`, `L2-dmn/`, `L3/`):
 * `smart-base.json` declares the directory, and its `graph.json` declares a
 * `schemas` subgraph from within, whose `index.ts` exports `layers`. This file
 * reads those declarations and imports each `index.ts`, so the engine here in
 * L1 never names a layer above it: an import points only down the layering
 * (L3 -> L2 -> L1), and a new layer is added by declaring it, not by editing
 * the engine.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { LayerSpec } from "./ontology.ts";

/** smart-base/ (this layer's root): this file is `smart-base/L1/schemas/layers.ts`. */
export const LAYER_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export interface HeldLayer {
  /** The layer's id as a document names it: `l1`, `l1-library`, `l2-bpmn`, … */
  key: string;
  spec: LayerSpec;
  /** The schemas directory that holds it, relative to the repository root. */
  dir: string;
  /** The source file, relative to the repository root, for generated banners. */
  file: string;
}

interface Entry {
  id?: string;
  path?: string;
  graphTypologies?: string[];
  subgraph?: boolean;
}

const read = (p: string): { directories?: Entry[] } => JSON.parse(readFileSync(p, "utf8"));

/** The schemas directories the named subgraphs declare, in declaration order. */
export function schemaDirs(): string[] {
  const out: string[] = [];
  for (const d of read(join(LAYER_ROOT, "smart-base.json")).directories ?? []) {
    if (!d.path || !d.graphTypologies?.includes("cat-harness")) continue;
    const graph = join(LAYER_ROOT, d.path, "graph.json");
    if (!existsSync(graph)) continue;
    for (const e of read(graph).directories ?? []) {
      if (e.subgraph && e.path && e.graphTypologies?.includes("schemas")) out.push(join(d.path, e.path));
    }
  }
  return out;
}

const held: HeldLayer[] = [];
for (const rel of schemaDirs()) {
  const index = join(LAYER_ROOT, rel, "index.ts");
  if (!existsSync(index)) continue;
  const mod = (await import(pathToFileURL(index).href)) as { layers?: LayerSpec[] };
  for (const spec of mod.layers ?? []) {
    const key = spec.layer.toLowerCase();
    held.push({ key, spec, dir: join("smart-base", rel).replace(/\/$/, ""), file: join("smart-base", rel, `${key}.ts`) });
  }
}
// The base first, then each layer after the ones it imports.
held.sort((a, b) => depth(a.key) - depth(b.key));
function depth(key: string, seen = new Set<string>()): number {
  const l = held.find((h) => h.key === key);
  if (!l || seen.has(key)) return 0;
  seen.add(key);
  return 1 + Math.max(0, ...(l.spec.imports ?? []).map((i) => depth(i, seen)));
}

/** Every held layer, base first. */
export const HELD: readonly HeldLayer[] = held;

/** The layers by the id a document names them by. */
export const LAYERS: Readonly<Record<string, LayerSpec>> = Object.fromEntries(held.map((h) => [h.key, h.spec]));

/** A layer and everything it imports, the layer itself first. */
export function scopeList(key: string): LayerSpec[] {
  const out: LayerSpec[] = [];
  const walk = (k: string) => {
    const l = LAYERS[k];
    if (!l || out.includes(l)) return;
    out.push(l);
    for (const i of l.imports ?? []) walk(i);
  };
  walk(key);
  return out;
}
