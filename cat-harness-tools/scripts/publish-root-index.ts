#!/usr/bin/env bun
/**
 * Publish the root index, `<site>/index.jsonld` (and its `index.json`
 * alias), on a LAYER's site: every graph document it maps, then the map.
 *
 * @module scripts/publish-root-index
 * @covers none — a PUBLISHER: it writes deploy files and judges no graph; `root-index.ts` refuses a short map
 *
 * ```sh
 * bun run cat-harness-tools/scripts/publish-root-index.ts --site ./_site [--base-url URL]
 * ```
 *
 * ## Why this exists
 *
 * `root-index.ts` maps the graph documents a deploy has already written, and
 * refuses to write when one is missing. Until this script only
 * folio-assistant's own `docs-site.yml` wrote those documents, so every site
 * published by `stage-local.ts` / `folio-site-publish.yml` had no
 * `index.jsonld` (owner, 2026-11-13, asking why a layer's site published
 * none). A layer turns it on with
 * `site.build.rootIndex: true`, and `build-instance-site.ts` runs this after
 * the platform's writers.
 *
 * ## What it writes, in the order `docs-site.yml` writes it
 *
 * 1. The host harness's document, by `kg-export.ts --scope instance`, at
 *    `<name>/<stub>.jsonld`: the host is published by its own step
 *    (`PUBLISHED_ELSEWHERE`), never by `instance-exports.ts`.
 * 2. bootstrap's, when it is mounted and published, by bootstrap-tools'
 *    `export-graph.ts` (the same exemption).
 * 3. Every other declared layer's, by `instance-exports.ts`.
 * 4. The root index, by `root-index.ts`'s {@link buildRootIndex}.
 *
 * Each document gets its `.json` alias, since Pages serves `.jsonld` as
 * octet-stream.
 *
 * ## The subgraph roots, without the subgraph tree
 *
 * An entry's `subgraph` is read from the repository's subgraph index. The
 * tree's IRIs are canonical at the harness's own site
 * (`gen-subgraph-jsonld.ts`: "the IRIs are canonical whatever site this
 * tree is built for"), and that site serves it. So this script frames the
 * index in memory ({@link generateSubgraphs}) and hands it to the root index
 * as a file in a temporary directory: the layer's site does not carry a
 * second copy of the tree (measured for one layer: 2,377 files, 40 MB), and
 * no mount is written into, so the next build's fixity check still passes.
 *
 * Any step that fails stops the run with exit 1, and nothing is mapped: a
 * shorter map is never published.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { artefactStub, readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.js";
import { isPublished } from "../schemas/kg/url-space.js";
import { SUBGRAPH_INDEX_FILE } from "../schemas/kg/subgraph-manifest.js";
import { instanceDocPath } from "./instance-exports.ts";
import { sitePathOf } from "./print-published-path.ts";
import { buildRootIndex, ROOT_INDEX_ALIAS, ROOT_INDEX_FILE } from "./root-index.ts";
import { instanceRoots } from "./lib/scheme-owner.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";

/** One command this script runs, as argv, from the checkout root. */
export interface Step {
  label: string;
  argv: string[];
  /** The document the step writes, given its `.json` alias afterwards. */
  writes?: string;
}

/**
 * The export steps for a checkout, in order: the host, bootstrap, then every
 * other layer. Pure over the declarations; runs nothing.
 */
export function exportSteps(o: { repo: string; harnessRoot: string; toolsRoot: string; site: string; qaRoot: string; baseUrl?: string }): Step[] {
  const steps: Step[] = [];
  const base = o.baseUrl?.replace(/\/+$/, "");
  const host = readDeclaration(o.harnessRoot);
  if (!host) throw new Error(`publish-root-index: no declaration at ${o.harnessRoot}`);
  if (isPublished(host)) {
    const out = join(o.site, instanceDocPath({ name: host.name, stub: artefactStub(host) }));
    steps.push({
      label: `${host.name} (the host)`,
      // `--qa-root`: the QA sidecar is the committed copy's, compared by
      // `kg:export:check`; written into the mount it would break the mount's
      // fixity, as `instance-exports.ts` says for the same reason.
      argv: ["bun", "run", join(o.toolsRoot, "scripts", "kg-export.ts"), ...(base ? ["--base-url", base] : []), "--scope", "instance", "--out", out, "--qa-root", o.qaRoot],
      writes: out,
    });
  }
  const roots = instanceRoots(o.repo);
  const boot = roots.find((r) => r.name === "bootstrap");
  const bootTools = roots.find((r) => r.name === "bootstrap-tools");
  const bootDecl = boot ? readDeclaration(boot.root) : undefined;
  const bootDir = bootDecl ? sitePathOf(bootDecl) : undefined;
  if (boot && bootDecl && bootDir !== undefined) {
    if (!bootTools) throw new Error("publish-root-index: bootstrap is mounted but bootstrap-tools, which exports it, is not");
    const out = join(o.site, `${bootDir}${artefactStub(bootDecl)}.jsonld`);
    steps.push({
      label: "bootstrap",
      argv: ["bun", "run", join(bootTools.root, "scripts", "export-graph.ts"), "--root", boot.root, ...(base ? ["--base-url", `${base}/${bootDir}`] : []), "--provenance", "--out", out],
      writes: out,
    });
  }
  steps.push({
    label: "every other layer",
    argv: ["bun", "run", join(o.toolsRoot, "scripts", "instance-exports.ts"), "--out-dir", o.site, ...(base ? ["--base-url", base] : [])],
  });
  return steps;
}

function runStep(step: Step, cwd: string): void {
  console.log(`▶ export: ${step.label}`);
  const r = spawnSync(step.argv[0]!, step.argv.slice(1), { cwd, stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) throw new Error(`export of ${step.label} exited ${r.status ?? r.signal}: nothing is mapped`);
  if (step.writes) copyFileSync(step.writes, step.writes.replace(/\.jsonld$/, ".json"));
}

/** Write every graph document, then the root index. Throws, having mapped nothing, when any step fails. */
export async function publishRootIndex(o: { site: string; baseUrl?: string; harnessRoot?: string; toolsRoot?: string }): Promise<{ harnesses: number }> {
  const site = resolve(o.site);
  const harnessRoot = resolve(o.harnessRoot ?? HARNESS_ROOT);
  const toolsRoot = resolve(o.toolsRoot ?? TOOLS_ROOT);
  const repo = repoRootFor(harnessRoot);
  mkdirSync(site, { recursive: true });
  // Nothing this run writes outside the site lands in the checkout or a mount.
  const tmp = mkdtempSync(join(tmpdir(), "root-index-"));
  try {
    const qaRoot = join(tmp, "qa");
    mkdirSync(qaRoot);
    for (const step of exportSteps({ repo, harnessRoot, toolsRoot, site, qaRoot, ...(o.baseUrl ? { baseUrl: o.baseUrl } : {}) })) runStep(step, repo);

    // Dynamic: the framer imports kg-export's whole graph, which only this step needs.
    const { generateSubgraphs } = await import("./gen-subgraph-jsonld.ts");
    console.log("▶ subgraph roots (framed in memory; the tree is served at the harness's site)");
    const sg = await generateSubgraphs({ root: harnessRoot });
    if (sg.plan.problems.length > 0) throw new Error(`the subgraph index could not be framed:\n${sg.plan.problems.map((p) => `  ✗ ${p}`).join("\n")}`);
    const repoIndex = sg.files.get(join(sg.outDir, SUBGRAPH_INDEX_FILE));
    if (repoIndex === undefined) throw new Error(`gen-subgraph-jsonld wrote no ${join(sg.outDir, SUBGRAPH_INDEX_FILE)}`);
    const subgraphIndex = join(tmp, SUBGRAPH_INDEX_FILE);
    writeFileSync(subgraphIndex, repoIndex);
    const { doc, problems } = buildRootIndex(site, { repo, subgraphIndex, ...(o.baseUrl ? { baseUrl: o.baseUrl } : {}) });
    if (problems.length > 0) throw new Error(`root-index: not written —\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
    const text = `${JSON.stringify(doc, null, 2)}\n`;
    mkdirSync(dirname(join(site, ROOT_INDEX_FILE)), { recursive: true });
    writeFileSync(join(site, ROOT_INDEX_FILE), text);
    writeFileSync(join(site, ROOT_INDEX_ALIAS), text);
    const harnesses = (doc.hasHarness as unknown[]).length;
    console.log(`root-index: ${harnesses} layer(s) → ${join(site, ROOT_INDEX_FILE)} (+ ${ROOT_INDEX_ALIAS})`);
    return { harnesses };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const arg = (flag: string): string | undefined => {
    const i = process.argv.indexOf(flag);
    return i !== -1 ? process.argv[i + 1] : undefined;
  };
  const site = arg("--site");
  if (!site) {
    console.error("usage: publish-root-index.ts --site <dir> [--base-url <url>]");
    process.exit(2);
  }
  const baseUrl = arg("--base-url");
  try {
    await publishRootIndex({ site, ...(baseUrl ? { baseUrl } : {}) });
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
