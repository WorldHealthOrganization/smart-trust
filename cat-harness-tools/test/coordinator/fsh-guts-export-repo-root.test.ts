/**
 * `fsh-guts-export` tests that read the aggregate repository's own root — the
 * root-declared `fsh-guts` trashcan and `.github/workflows/docs-site.yml` —
 * moved here from `cat-harness/scripts/tests/fsh-guts-export.test.ts` (bean
 * `ho66`), as `merge-guard-workflows.test.ts` was: a standalone cat-harness
 * layer has no such root, and `check:cat-harness-standalone` collects every
 * test in that layer. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

import { buildFshGutsExport, fshGutsDirs } from "../../scripts/fsh-guts-export.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { readFshGutsNode, withoutFrozenSubtrees } from "../../schemas/kg/fsh-guts.js";
import { writeDeclaration } from "../support/instance-fixture.js";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = resolve(ORIGIN_DIR, "../..");

/**
 * A throwaway layer that declares a trashcan.
 *
 * A REPOSITORY holding a layer, which is the live shape: `fsh-guts/` is
 * declared `scope: "repository"`, so the directory sits beside the layer
 * rather than inside it. The fixture makes its own repository directory
 * instead of letting `repoRootFor` reach `/tmp` — that was shared, so every
 * fixture in this file wrote into one trashcan and the isolation each `try`
 * block believed it had was not there.
 */
function instance(declare = true): string {
  const repo = mkdtempSync(join(tmpdir(), "fsh-guts-export-"));
  const root = join(repo, "inst");
  mkdirSync(root, { recursive: true });
  mkdirSync(join(repo, "fsh-guts"), { recursive: true });
  writeDeclaration(root, JSON.stringify({
      name: "t",
      stub: "t",
      canonicalUrl: "https://example.invalid/t",
      directories: declare
        ? [
            {
              id: "fsh-guts",
              path: "fsh-guts/",
              scope: "repository",
              description: "trashcan",
              graphTypologies: ["fsh-guts"],
            },
          ]
        : [],
    }));
  return root;
}

describe("the real corpus", () => {
  const doc = buildFshGutsExport(ROOT);

  test("every committed node is in the document", () => {
    // The vacuity guard first: everything below filters this graph, and a
    // filter over nothing passes.
    expect(doc.nodeCount).toBeGreaterThan(0);
    expect(doc["@graph"]).toHaveLength(doc.nodeCount);
    expect(doc.scans).toContain("fsh-guts");
    // Every committed node, by path: each file in a scanned directory
    // (outside a frozen subtree, which is one item) that reads as a node has
    // an entry whose `sourcePath` is it. Listed from the disk, not with
    // `git ls-files`: the trashcan is kept on its own branch and MOUNTED
    // (`state:mount`), as bytes the checkout ignores, so git tracks none of it.
    const inDoc = new Set(doc["@graph"].map((n) => n.sourcePath));
    const nodes: string[] = [];
    for (const dir of fshGutsDirs(ROOT)) {
      const files = (readdirSync(dir.absPath, { recursive: true }) as string[])
        .map((f) => f.split("\\").join("/"))
        .filter((f) => statSync(join(dir.absPath, f)).isFile());
      for (const f of withoutFrozenSubtrees(dir.absPath, files).live) {
        if (![".md", ".json"].includes(extname(f).toLowerCase())) continue;
        if (readFshGutsNode(readFileSync(join(dir.absPath, f), "utf8")).node) nodes.push(join(dir.path, f));
      }
    }
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.filter((rel) => !inDoc.has(rel))).toEqual([]);
  });

  test("the directory is resolved from the declaration, not spelled", () => {
    expect(fshGutsDirs(ROOT)).toEqual([
      { absPath: join(repoRootFor(ROOT), "fsh-guts"), path: "fsh-guts" },
    ]);
    expect(fshGutsDirs(instance(false))).toEqual([]);
  });
});

describe("the folded block scalar the corpus actually uses", () => {

  test("every real node's summary survived the parse", () => {
    const withSummary = buildFshGutsExport(ROOT)["@graph"].filter((n) => n.description);
    expect(withSummary.length).toBeGreaterThan(0);
    for (const n of withSummary) expect(String(n.description)).not.toBe(">-");
  });
});
