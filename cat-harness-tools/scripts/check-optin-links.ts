#!/usr/bin/env bun
/**
 * No always-on page links into an opt-in sub-graph.
 *
 * @module scripts/check-optin-links
 * @covers cat-harness — every layer in the checkout
 *
 * An opt-in sub-graph (`optIn: true`, `opt-in-subgraphs.ts`) is left out of
 * every downstream that has not switched it on: the whole mount does not lay
 * it down, and the agent is not given it. A page that is ALWAYS there and
 * links into one therefore links to nothing wherever the group is off, and
 * nothing else notices, because the layer that declares the group switches it
 * on for itself and every link resolves there.
 *
 * The owner, 2026-11-11 (card "Fix links into switched-off groups how?",
 * option B): a gate fails on these links, and each is fixed by hand. So this
 * reports, and never rewrites.
 *
 * ## The rule
 *
 * A relative Markdown link in a layer's own `.md` file whose target lies
 * inside an opt-in sub-graph (of any layer in the checkout, top level or
 * declared from within) is a finding, unless the file sits inside that same
 * sub-graph. A link between two different opt-in groups is a finding too:
 * each is switched on alone.
 *
 * Not read: a file inside a directory declared to hold a machine-written
 * graph, a file that declares itself generated, a translation mirror (its
 * link is fixed in the English source), and `node_modules/`, `.git/`,
 * `translations/`. A generated skill list must not link into a group either;
 * `readme:sync` writes those entries unlinked.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-optin-links.ts [--json]
 *
 * Exit 0 no link into a switched-off group · 1 at least one · 2 no layer found.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { findDeclarationFile, layerRootsIn, readDeclaration, rootForScope, isDerivedGraph, isStateGraph } from "../schemas/kg/cat-harness.js";
import { groupOf, optInRootsOf, type OptInRoot } from "../schemas/kg/opt-in-roots.js";
import { declaresGenerated, declaresTranslationMirror } from "./check-reference-direction.ts";

const SKIP_DIRS = new Set(["node_modules", ".git", "translations"]);

export interface OptInLinkFinding {
  /** Checkout-relative path of the file that holds the link. */
  file: string;
  /** The link target as written. */
  target: string;
  /** The opt-in sub-graph the target is inside. */
  group: string;
}

export { groupOf, optInRootsOf, type OptInRoot };

/** Directories `root` declares as holding only machine-written graphs, top level or from within. */
function machineWrittenDirs(root: string): string[] {
  const decl = readDeclaration(root);
  if (decl === undefined) return [];
  const written = (kinds: readonly string[] | undefined): boolean =>
    kinds !== undefined && kinds.length > 0 && kinds.every((k) => isStateGraph(k) || isDerivedGraph(k));
  const out: string[] = [];
  for (const d of decl.directories ?? []) {
    if (d.path === undefined || d.path === "") continue;
    const dir = join(rootForScope(root, d.scope), d.path);
    if (written(d.graphTypologies)) out.push(dir);
    const graph = join(dir, "graph.json");
    if (!existsSync(graph)) continue;
    try {
      const inner = JSON.parse(readFileSync(graph, "utf-8")) as { directories?: { path?: string; graphTypologies?: string[] }[] };
      for (const e of inner.directories ?? []) if (e.path && written(e.graphTypologies)) out.push(join(dir, e.path));
    } catch {
      // unparseable: read its files rather than skip them
    }
  }
  return out.map((p) => p.replace(/[\\/]+$/, ""));
}

const LINK = /\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

/** The relative link targets of Markdown `text`, outside fenced code. */
export function relativeLinks(text: string): string[] {
  const out: string[] = [];
  const prose = text.replace(/^(```|~~~)[\s\S]*?^\1/gm, "");
  for (const m of prose.matchAll(LINK)) {
    const t = m[1]!;
    if (/^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith("/") || t.startsWith("#") || t.startsWith("{")) continue;
    out.push(t);
  }
  return out;
}

/** The links into opt-in sub-graphs among `files`, judged against `roots`. */
export function findingsIn(files: readonly string[], roots: readonly OptInRoot[], checkout: string): OptInLinkFinding[] {
  const out: OptInLinkFinding[] = [];
  for (const abs of files) {
    const own = groupOf(abs, roots);
    const text = readFileSync(abs, "utf-8");
    for (const target of relativeLinks(text)) {
      const path = decodeURI(target.split("#")[0]!.split("?")[0]!);
      if (path === "") continue;
      const into = groupOf(resolve(dirname(abs), path).replace(/[\\/]+$/, ""), roots);
      if (into === undefined || into.id === own?.id) continue;
      out.push({ file: relative(checkout, abs).split(sep).join("/"), target, group: into.id });
    }
  }
  return out;
}

function markdownUnder(dir: string, skip: (abs: string) => boolean): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (skip(p)) continue;
    if (e.isDirectory()) {
      if (findDeclarationFile(p) !== undefined) continue; // another layer, scanned as itself
      out.push(...markdownUnder(p, skip));
    } else if (e.name.endsWith(".md") && statSync(p).isFile()) out.push(p);
  }
  return out;
}

export function checkOptInLinks(checkout: string): { layers: number; files: number; findings: OptInLinkFinding[] } {
  const layers = layerRootsIn(checkout);
  const roots = layers.flatMap(optInRootsOf);
  const written = layers.flatMap(machineWrittenDirs);
  const isWritten = (abs: string): boolean => written.some((d) => abs === d || abs.startsWith(d + sep));
  const files = layers
    .flatMap((l) => markdownUnder(l, isWritten))
    .filter((f) => !declaresGenerated(f) && !declaresTranslationMirror(f));
  const unique = [...new Set(files)].sort();
  return { layers: layers.length, files: unique.length, findings: findingsIn(unique, roots, checkout) };
}

function main(argv: readonly string[]): number {
  const checkout = process.cwd();
  const r = checkOptInLinks(checkout);
  if (argv.includes("--json")) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    for (const f of r.findings) console.log(`  ✗ ${f.file} → ${f.target} (opt-in ${f.group})`);
    console.log(
      r.layers === 0
        ? "? no layer declaration in this checkout — not a pass"
        : r.findings.length === 0
          ? `✓ no always-on page links into an opt-in sub-graph (${r.files} file(s), ${r.layers} layer(s))`
          : `✗ ${r.findings.length} link(s) into an opt-in sub-graph, dead wherever it is switched off — fix each by hand (owner, 2026-11-11)`,
    );
  }
  return r.layers === 0 ? 2 : r.findings.length > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
