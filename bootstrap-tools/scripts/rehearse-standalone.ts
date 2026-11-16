#!/usr/bin/env bun
/**
 * Rehearse the split: run bootstrap-tools against bootstrap with NOTHING else
 * present — the two as sibling checkouts in an empty directory, as
 * `litlfred/bootstrap` and `litlfred/bootstrap-tools` are cloned.
 *
 * @module bootstrap-tools/scripts/rehearse-standalone
 * @covers code — bootstrap-tools itself, run where only bootstrap sits beside it
 *
 * The closure gate proves no IMPORT reaches above bootstrap-tools; it cannot
 * prove a script does not READ a path above it, or that a test does not lean
 * on a file only an enclosing checkout has. Only running them where nothing
 * else exists can. Each check that fails here is such a dependency.
 *
 * What is copied is what git tracks in each directory — a standalone clone
 * has nothing else — and each copy is made a git repository with those files
 * added, as a clone would be. `node_modules` is linked from these tools' own
 * install (or an enclosing checkout's), standing in
 * for the `bun install` a standalone clone would run.
 *
 * NOT rehearsed: `render:check`, which needs a headless Chromium and is run
 * where one is; nothing in it reads a path outside bootstrap-tools.
 *
 * Usage: bun run bootstrap-tools/scripts/rehearse-standalone.ts [--keep]
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

import { gitFiles } from "./git-files.ts";

const TOOLS = join(import.meta.dir, "..");
const REPO = join(TOOLS, "..");

/** The checks a standalone bootstrap-tools must pass, run from its own root. */
export const REHEARSED: ReadonlyArray<readonly [string, string[]]> = [
  ["closure", ["run", "scripts/check-closure.ts"]],
  ["schemas are current", ["run", "scripts/gen-bootstrap-schemas.ts", "--check"]],
  ["vocabulary is current", ["run", "scripts/gen-vocabulary.ts", "--check"]],
  ["IRIs are at the declared version", ["run", "scripts/iri-sync.ts", "--check"]],
  ["node IRIs are their paths", ["run", "scripts/check-node-iris.ts"]],
  ["documents and the built graph parse", ["run", "scripts/validate-bootstrap.ts"]],
  ["README sections are current", ["run", "scripts/readme-sections.ts", "--check"]],
  ["bootstrap-tools' own README sections are current", ["run", "scripts/readme-sections.ts", "--root", ".", "--check"]],
  ["every link on bootstrap's README page lands", ["run", "scripts/readme-book.ts", "--root", "../bootstrap", "--check"]],
  ["every link on bootstrap-tools' README page lands", ["run", "scripts/readme-book.ts", "--root", ".", "--check"]],
  ["bootstrap's JSON Schemas and JSON-LD stage at their IRIs", ["run", "scripts/site.ts", "--root", "../bootstrap", "--check"]],
  ["both instances' named subgraphs frame", ["run", "scripts/subgraph-jsonld.ts", "--check", "--root", "../bootstrap", "--root", "."]],
  // Into the rehearsal's own directory, not /dev/null: the export writes its context beside
  // `--out` (`<out>.context.jsonld`), and `/dev/null.context.jsonld` is EACCES for any user
  // but root, so the step failed on every CI runner while passing as root.
  ["the graph exports", ["run", "scripts/export-graph.ts", "--base-url", "https://example.invalid/bootstrap/", "--out", "../graph-export.jsonld"]],
  ["unit tests", ["test", "."]],
];

function copyTracked(from: string, to: string): number {
  const files = gitFiles(from);
  if (!files) throw new Error(`${from} is not in a git checkout — nothing says which files a clone would hold`);
  for (const abs of files) {
    const rel = relative(from, abs);
    mkdirSync(dirname(join(to, rel)), { recursive: true });
    copyFileSync(abs, join(to, rel));
  }
  // A clone IS a git repository, and some checks ask git what the corpus is
  // (`iri-sync`): an index with the files added is what they read.
  for (const args of [["init", "-q"], ["add", "-A"]]) {
    const r = spawnSync("git", args, { cwd: to, encoding: "utf-8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} in ${to}: ${r.stderr}`);
  }
  return files.length;
}

if (import.meta.main) {
  const keep = process.argv.includes("--keep");
  const root = mkdtempSync(join(tmpdir(), "bootstrap-standalone-"));
  const nb = copyTracked(join(REPO, "bootstrap"), join(root, "bootstrap"));
  const nt = copyTracked(TOOLS, join(root, "bootstrap-tools"));
  // These tools' own install when they have one (a standalone clone), else the
  // enclosing checkout's (the monorepo, where one install serves every package).
  const modules = existsSync(join(TOOLS, "node_modules")) ? join(TOOLS, "node_modules") : join(REPO, "node_modules");
  symlinkSync(modules, join(root, "bootstrap-tools", "node_modules"), "dir");
  console.log(`Rehearsing in ${root}: bootstrap (${nb} files) and bootstrap-tools (${nt} files), nothing else.`);
  let failed = 0;
  for (const [what, args] of REHEARSED) {
    const r = spawnSync("bun", args, { cwd: join(root, "bootstrap-tools"), encoding: "utf-8" });
    if (r.status === 0) console.log(`  ✓ ${what}`);
    else {
      failed++;
      console.error(`  ✗ ${what} (bun ${args.join(" ")})`);
      const tail = `${r.stdout}\n${r.stderr}`.trim().split("\n").slice(-12);
      for (const l of tail) console.error(`      ${l}`);
    }
  }
  if (!keep) rmSync(root, { recursive: true, force: true });
  if (failed) {
    console.error(`\n✗ ${failed} of ${REHEARSED.length} check(s) fail when bootstrap-tools stands alone — each is a dependency the split would break`);
    process.exit(1);
  }
  console.log(`\n✓ bootstrap-tools passes all ${REHEARSED.length} checks standing alone beside bootstrap`);
}
