#!/usr/bin/env bun
/**
 * The values a folio's text refers to, as knowledge-graph nodes: `values.jsonld`.
 *
 *   bun run cat-harness-tools/pipeline/gen-values-jsonld.ts --out <site dir>
 *
 * Every `{{ … }}` reference in a block's Markdown is resolved here exactly as
 * the renderers resolve it (`resolveKey` and `applyFilters`, bean `kott`), and
 * written as one node per distinct reference: the key, the stored value, the
 * text the page prints, and where the value came from. A reader's tool (the
 * ✍ suggest editor) shows a variable's current value from this file, so the
 * value is read from the graph rather than re-derived in the browser.
 *
 * A pass-through prefix (`site.data`, the FHIR IG harness) is resolved by Jekyll or
 * the IG Publisher, later than this runs: its references are listed with
 * `state: "pass-through"` and no value, for that pipeline to fill. A reference
 * that does not resolve is listed with its reason, never left out: an absent
 * node would read as "not a variable" (owner, 2026-10-14).
 *
 * @module pipeline/gen-values-jsonld
 * @covers folio
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { folioDir } from "../schemas/kg/cat-harness.js";
import { applyFilters, buildValueScope, LIQUID_VALUE, resolveKey, type ValueProvenance, type ValueScope } from "./liquid-values";
import { findContentRepoRoot } from "./repo-root";

export const VALUES_CONTEXT = { "@vocab": "https://litlfred.github.io/folio-assistant/ns/values#" } as const;

export interface ValueNode {
  "@id": string;
  key: string;
  /** The reference as written, filters included: what a page prints differs by filter. */
  reference: string;
  state: "resolved" | "unresolved" | "pass-through";
  value?: unknown;
  formatted?: string;
  reason?: string;
  provenance?: ValueProvenance;
  /** Repo-relative Markdown files that use it. */
  usedIn: string[];
}

function markdownUnder(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) markdownUnder(p, out);
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

/** One node per distinct reference in the folio's Markdown, sorted by reference. */
export function valuesGraph(repoRoot: string, scope: ValueScope = buildValueScope(repoRoot)): { "@context": typeof VALUES_CONTEXT; "@graph": ValueNode[] } {
  const nodes = new Map<string, ValueNode>();
  for (const file of markdownUnder(folioDir(repoRoot)).sort()) {
    const rel = relative(repoRoot, file);
    for (const m of readFileSync(file, "utf-8").matchAll(LIQUID_VALUE)) {
      const key = m[1]!;
      const filters = (m[2] ?? "").trim();
      const reference = filters ? `${key} ${filters}` : key;
      const seen = nodes.get(reference);
      if (seen) {
        if (!seen.usedIn.includes(rel)) seen.usedIn.push(rel);
        continue;
      }
      const r = resolveKey(key, scope);
      if (r.state === "not-ours") continue; // `page.*` and other foreign names are Jekyll's own
      const node: ValueNode = { "@id": `values/${encodeURIComponent(reference)}`, key, reference, state: "unresolved", usedIn: [rel] };
      if (r.state === "pass-through") node.state = "pass-through";
      else if (r.state === "unresolved") node.reason = r.reason;
      else {
        try {
          node.formatted = applyFilters(r.raw, r.text, filters);
          node.state = "resolved";
          node.value = r.raw;
          node.provenance = r.provenance;
        } catch (e) {
          node.reason = (e as Error).message;
        }
      }
      nodes.set(reference, node);
    }
  }
  return { "@context": VALUES_CONTEXT, "@graph": [...nodes.values()].sort((a, b) => a.reference.localeCompare(b.reference)) };
}

/** Write `<out>/values.jsonld`; returns how many references it holds. */
export function writeValuesJsonLd(repoRoot: string, out: string): number {
  const g = valuesGraph(repoRoot);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "values.jsonld"), JSON.stringify(g, null, 1) + "\n");
  return g["@graph"].length;
}

if (import.meta.main) {
  const i = process.argv.indexOf("--out");
  const out = i > 0 ? process.argv[i + 1] : undefined;
  if (!out) {
    console.error("usage: bun run cat-harness-tools/pipeline/gen-values-jsonld.ts --out <site dir>");
    process.exit(2);
  }
  const n = writeValuesJsonLd(findContentRepoRoot(), out);
  console.log(`values.jsonld: ${n} reference(s) → ${join(out, "values.jsonld")}`);
}
