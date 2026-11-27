#!/usr/bin/env bun
/**
 * List the IG layers whose source repository carries an IG Publisher AST
 * cache, one line each, tab-separated: `<instance-dir> <clone-url> <label> <chrome-owner|->`.
 *
 * @module fhir-harness/scripts/stage-ast-sites
 * @covers fhir-artifact-index
 *
 * The staging workflow names no IG (see its "Build each IG's own site" step):
 * which IGs are rendered is DATA. Here the data is two facts the repository
 * already holds and one it asks the IG's repository for:
 *
 * - the layer has a `fhir-artifact-index/` (it is an IG layer);
 * - its declaration names the IG's `repository` (`owner/repo`);
 * - that repository has a `cat/fhir-harness/fhir-ast/*` branch (`git
 *   ls-remote`; bean tlk2, the older names retired with bean oycs), i.e. a
 *   seeded AST cache `ig-cache.sh restore` can fetch.
 *
 * A layer with no AST branch is skipped AND SAID to be, on stderr: a
 * preview that silently lacks an AST site cannot be told from one whose
 * pipeline broke.
 *
 * The fourth column is the layer that owns the template chrome, also as
 * data: the layer's own `fhir-artifact-index/chrome.json` if it has one,
 * else the ONE layer in the repository that holds one, else `-` (none,
 * and the page generator says the chrome is absent).
 *
 * Nothing here may know about WHO (fhir-harness/AGENTS.md).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { declarationPathIn } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { readChangedFiles, siteFilter } from "../../cat-harness-tools/scripts/staging-cone.ts";
import { indexReadPath } from "./lib/ig-index-at.ts";

const ROOT = resolve(import.meta.dir, "..", "..");

/** Which layer owns the template chrome for `instance`, or undefined. */
export function chromeOwnerFor(root: string, instance: string, all: string[]): string | undefined {
  const has = (i: string) => existsSync(indexReadPath(join(root, i), "chrome.json"));
  if (has(instance)) return instance;
  const holders = all.filter(has);
  return holders.length === 1 ? holders[0] : undefined;
}

/** The IG layers under `root` that declare a source repository. */
export function igInstances(root: string): { instance: string; repository: string; label: string }[] {
  const out: { instance: string; repository: string; label: string }[] = [];
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
    const dir = join(root, e.name);
    const index = indexReadPath(dir, "index.json");
    if (!existsSync(index)) continue;
    const decl = declarationPathIn(dir);
    if (!decl || !existsSync(decl)) continue;
    let repository: string | undefined;
    try {
      repository = (JSON.parse(readFileSync(decl, "utf-8")) as { repository?: string }).repository;
    } catch {
      continue;
    }
    if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) continue;
    let packageId: string | undefined;
    try {
      packageId = (JSON.parse(readFileSync(index, "utf-8")) as { packageId?: string }).packageId;
    } catch {
      // the index is the gate's business, not this lister's
    }
    out.push({ instance: e.name, repository, label: `${packageId ?? e.name} (AST build)` });
  }
  return out.sort((a, b) => a.instance.localeCompare(b.instance));
}

/** The code an AST site is drawn by: this lister, the shell driver, and the three scripts it runs. */
export const AST_SITE_WRITERS = [
  "fhir-harness/scripts/stage-ast-sites.ts",
  "fhir-harness/scripts/ig-ast-site.sh",
  "fhir-harness/scripts/ig-ast.ts",
  "fhir-harness/scripts/ast-to-artifact-index.ts",
  "fhir-harness/scripts/gen-ig-pages.ts",
];

if (import.meta.main) {
  const igs = igInstances(ROOT);
  const names = igs.map((i) => i.instance);
  // The staging cone (bean `4j86`): `--changed-files <file>` stages only the
  // IGs a changed file reaches. Without it, every IG is listed, as before.
  const at = process.argv.indexOf("--changed-files");
  const inCone = siteFilter(ROOT, readChangedFiles(at >= 0 ? process.argv[at + 1] : undefined), AST_SITE_WRITERS);
  for (const ig of igs) {
    const d = inCone(ig.instance);
    if (!d.carry) {
      console.error(`skipped: ${ig.instance} — not in the staging cone: ${d.why}`);
      continue;
    }
    const url = `https://github.com/${ig.repository}`;
    const ls = spawnSync("git", ["ls-remote", "--heads", url, "refs/heads/cat/fhir-harness/fhir-ast/*"], { encoding: "utf-8", timeout: 60_000 });
    if (ls.status !== 0) {
      console.error(`could not determine: ${ig.instance} — git ls-remote ${url} failed; no AST site staged`);
      continue;
    }
    if (!ls.stdout.trim()) {
      console.error(`skipped: ${ig.instance} — ${url} has no cat/fhir-harness/fhir-ast/* branch (no seeded AST cache)`);
      continue;
    }
    console.log(`${ig.instance}\t${url}\t${ig.label}\t${chromeOwnerFor(ROOT, ig.instance, names) ?? "-"}`);
  }
}
