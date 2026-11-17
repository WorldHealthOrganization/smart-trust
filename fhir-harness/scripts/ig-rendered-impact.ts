#!/usr/bin/env bun
/**
 * The FHIR IG renderer's answer to the rendered-impact contract
 * (`cat-harness/schemas/rendered-impact.ts`, bean `bnjs`): from the IG source
 * files a change touched, the rendered files of its just-the-docs site that
 * the change alters, predicted from the dependency cone before any build.
 *
 * @covers fhir-artifact-index
 *
 * ## The chain, and where each link comes from
 *
 * | link | from |
 * |---|---|
 * | changed `.fsh` / `.cql` → FSH and CQL nodes, plus every node using them | `fsh-cone.ts` (`changeImpact`; an Alias- or RuleSet-only file reaches its users through `fileUsers`) |
 * | node → output resource | SUSHI's own `fsh-generated/data/fsh-index.json` (FSH name → `<Type>-<id>.json`), never re-derived |
 * | resource → AST artefact page and served JSON | `gen-ig-pages.ts` (`artifactPageName`), and the AST manifest's `file` when one is given |
 * | `input/pagecontent/<p>.md` → `<p>.html`, and every page that includes it | `build-ig-site.ts` |
 *
 * Measured on a real IG (bean `c65n`): one FSH edit to
 * one PlanDefinition reached 1 of 722 resources, and the build changed exactly the
 * served JSON, the AST index and the search index. That case is this module's
 * acceptance test.
 *
 * ## What it cannot place, and says so
 *
 * `sushi-config.yaml`, `ig.ini` and the shared includes can change any page
 * (`scope: all`); images, diagrams and any directory this chain does not read
 * are `unknown`. A node with no `fsh-index` entry (SUSHI never ran, or the
 * node produces no resource) is reported, not skipped. Nothing outside the
 * IG's source is considered: a dependency package or a Publisher upgrade
 * changes every page, which is a toolchain change, not a Change Set's.
 *
 * Usage:
 *   bun run fhir-harness/scripts/ig-rendered-impact.ts --ig <root> --changed a.fsh,b.md [--ast <output-ast>]
 *     [--site-prefix <p>] [--ast-prefix ast] [--data-prefix ast-data] [--out impact.json]
 *   bun run fhir-harness/scripts/ig-rendered-impact.ts --ig <root> --base <ref> [--head <ref>] ...
 *
 * Nothing here may know about WHO (fhir-harness/AGENTS.md).
 *
 * @module fhir-harness/scripts/ig-rendered-impact
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { buildFshGraph, changeImpact, fileUsers, type FshGraph } from "./fsh-cone.ts";
import {
  pinImpact,
  RENDERED_IMPACT_TAG,
  RenderedImpactSchema,
  type RenderedFile,
  type RenderedImpact,
} from "@litlfred/cat-harness-tools/schemas/ui/rendered-impact.ts";
import { gitBlobs } from "../../cat-harness-tools/scripts/git-blobs.ts";
import { artifactPageName } from "../schemas/fhir-artifact-index.js";

export const RENDERER = "fhir-ig-pages";

export interface IgImpactOptions {
  /** The IG source root (the directory holding `sushi-config.yaml`). */
  ig: string;
  /** Changed files, relative to `ig`. */
  changed: string[];
  /** SUSHI's index; default `<ig>/fsh-generated/data/fsh-index.json`. */
  fshIndex?: string;
  /** An AST directory whose manifest names each resource's served file. */
  ast?: string;
  /** Where the IG's own pages sit in the built site ("" for its root). */
  sitePrefix?: string;
  /** Where the AST artefact pages sit, under `sitePrefix`. */
  astPrefix?: string;
  /** Where the AST's resources are served, under `sitePrefix`. */
  dataPrefix?: string;
  base?: string;
  head?: string;
  /** A graph already built for `ig`, to skip rebuilding it. */
  graph?: FshGraph;
}

interface FshIndexEntry {
  outputFile: string;
  fshName: string;
}

/** Inputs that can change any page of the site. */
const WHOLE_SITE = [/^sushi-config\.yaml$/, /^ig\.ini$/, /^input\/includes\//, /^input\/ignoreWarnings\.txt$/];

const join2 = (...parts: string[]) => parts.filter(Boolean).join("/");

/** `<Type>-<id>.json` → its type and id: a FHIR type has no `-`, so the first one splits. */
function typeAndId(outputFile: string): { resourceType: string; id: string } | undefined {
  const m = outputFile.match(/^([A-Za-z]+)-(.+)\.json$/);
  return m ? { resourceType: m[1], id: m[2] } : undefined;
}

/** The served path of each resource, by `Type/id`, read off an AST manifest. */
function astFiles(ast: string | undefined): Map<string, string> | undefined {
  if (!ast) return undefined;
  const mf = JSON.parse(readFileSync(join(ast, "manifest.json"), "utf-8")) as { resources: Array<{ resourceType: string; id: string; file: string }> };
  return new Map(mf.resources.map((r) => [`${r.resourceType}/${r.id}`, r.file]));
}

/** Pages under `input/pagecontent` and `input/includes` that include `name`. */
function includers(ig: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\{%-?\\s*include\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s%]`);
  const dir = join(ig, "input", "pagecontent");
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md") || f === name) continue;
    if (re.test(readFileSync(join(dir, f), "utf-8"))) out.push(f);
  }
  return out.sort();
}

export function igRenderedImpact(opts: IgImpactOptions): RenderedImpact {
  const ig = resolve(opts.ig);
  const site = opts.sitePrefix ?? "";
  const astAt = join2(site, opts.astPrefix ?? "ast");
  const dataAt = join2(site, opts.dataPrefix ?? "ast-data");
  const files = new Map<string, RenderedFile>();
  const undetermined: RenderedImpact["undetermined"] = [];
  const add = (f: RenderedFile) => {
    if (!files.has(f.path)) files.set(f.path, f);
  };
  const searchIndex = join2(site, "assets/js/search-data.json");

  const source = opts.changed.filter((f) => /^input\/(fsh\/.*\.fsh|cql\/.*\.cql)$/.test(f));
  if (source.length) {
    const g = opts.graph ?? buildFshGraph(ig);
    const users = fileUsers(g);
    // A file that declares no node (Aliases, RuleSets only) changes its users.
    const reach = new Set(source);
    for (const f of source) for (const u of users[f] ?? []) reach.add(u);
    const { rebuild } = changeImpact(g, reach);
    const fshIndexPath = opts.fshIndex ?? join(ig, "fsh-generated", "data", "fsh-index.json");
    const index: FshIndexEntry[] | undefined = existsSync(fshIndexPath) ? JSON.parse(readFileSync(fshIndexPath, "utf-8")) : undefined;
    if (!index) {
      for (const f of source) undetermined.push({ input: f, reason: `no SUSHI index at ${fshIndexPath}: run SUSHI so FSH names map to resources`, scope: "unknown" });
    } else {
      const byName = new Map(index.map((e) => [e.fshName, e.outputFile]));
      const served = astFiles(opts.ast);
      let any = false;
      for (const name of [...rebuild].sort()) {
        const node = g.nodes.get(name);
        if (!node || node.kind === "RuleSet" || node.kind === "Invariant" || node.kind === "Mapping" || node.kind === "CQL") continue;
        const out = byName.get(name);
        const ti = out ? typeAndId(out) : undefined;
        if (!out || !ti) {
          undetermined.push({ input: node.file, reason: `${node.kind} ${name} has no resource in SUSHI's index`, scope: "unknown" });
          continue;
        }
        any = true;
        const via = [node.file, name, `${ti.resourceType}/${ti.id}`];
        add({ path: join2(astAt, "artifact", `${artifactPageName(ti)}.html`), change: "changed", role: "content", via });
        const file = served?.get(`${ti.resourceType}/${ti.id}`) ?? `resources/${out}`;
        add({ path: join2(dataAt, file.replace(/^[^/]*?resources\//, "resources/")), change: "changed", role: "data", via });
      }
      if (any) {
        // The AST index carries the build revision (gen-ig-pages, bean c65n), so it
        // changes on every commit that rebuilds; the search index lists every page.
        add({ path: join2(astAt, "index.html"), change: "changed", role: "index", via: [] });
        add({ path: searchIndex, change: "changed", role: "index", via: [] });
      }
    }
  }

  for (const f of opts.changed) {
    if (source.includes(f)) continue;
    const page = f.match(/^input\/pagecontent\/([^/]+)\.md$/);
    if (page) {
      add({ path: join2(site, `${page[1]}.html`), change: existsSync(join(ig, f)) ? "changed" : "removed", role: "content", via: [f] });
      for (const p of includers(ig, `${page[1]}.md`)) add({ path: join2(site, p.replace(/\.md$/, ".html")), change: "changed", role: "content", via: [f, `input/pagecontent/${p}`] });
      add({ path: searchIndex, change: "changed", role: "index", via: [] });
      continue;
    }
    if (WHOLE_SITE.some((re) => re.test(f))) undetermined.push({ input: f, reason: "site-wide input: can change any page", scope: "all" });
    else undetermined.push({ input: f, reason: "not an input this renderer maps (fsh, cql, pagecontent)", scope: "unknown" });
  }

  return RenderedImpactSchema.parse({
    $schema: RENDERED_IMPACT_TAG,
    renderer: RENDERER,
    method: "cone",
    ...(site ? { site } : {}),
    ...(opts.base ? { base: opts.base } : {}),
    ...(opts.head ? { head: opts.head } : {}),
    inputs: [...opts.changed].sort(),
    files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path)),
    undetermined,
  });
}


if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const ig = arg("--ig");
  if (!ig) {
    console.error("usage: ig-rendered-impact.ts --ig <root> (--changed a,b | --base <ref> [--head <ref>]) [--ast dir] [--out file]");
    process.exit(2);
  }
  const base = arg("--base");
  const head = arg("--head") ?? (base ? "HEAD" : undefined);
  const changed = arg("--changed")?.split(",").filter(Boolean)
    ?? (base ? execFileSync("git", ["-C", ig, "diff", "--name-only", `${base}...${head}`], { encoding: "utf-8" }).split("\n").filter(Boolean) : []);
  const impact = igRenderedImpact({
    ig,
    changed,
    ast: arg("--ast"),
    fshIndex: arg("--fsh-index"),
    sitePrefix: arg("--site-prefix"),
    astPrefix: arg("--ast-prefix"),
    dataPrefix: arg("--data-prefix"),
    base,
    head,
  });
  // Pinned to the inputs' blobs at head (rendered-impact.ts, "A PIN"); no git, no pin.
  let pinned = impact;
  try {
    const blobs = gitBlobs(ig, head ?? "HEAD", changed);
    pinned = pinImpact(impact, (p) => blobs.get(p));
  } catch (e) {
    console.error(`not pinned: ${(e as Error).message.split("\n")[0]}`);
  }
  const json = JSON.stringify(pinned, null, 2) + "\n";
  const out = arg("--out");
  if (out) writeFileSync(out, json);
  else process.stdout.write(json);
}
