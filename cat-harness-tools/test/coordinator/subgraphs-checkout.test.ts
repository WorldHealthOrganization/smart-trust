/**
 * `subgraphs` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/subgraphs.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each attributes the directories smart-base
 * and the root layer declare, which only the checkout holds. Standing
 * alone, cat-harness has none of it, and `check:cat-harness-standalone`
 * collects every test in that layer. The rest of that file's tests stay there;
 * every path here is composed from ORIGIN_DIR, the directory they were written
 * in, so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  owningDirectory,
  resolveDirectories,
} from "../../schemas/kg/cat-harness.ts";
import { scanSubgraphs } from "../../scripts/check-subgraphs.ts";
import { checkoutDirectories } from "../../schemas/kg/harness-config.ts";
import { writeDeclaration } from "../support/instance-fixture.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = resolve(ORIGIN_DIR, "../..");
const dirs = resolveDirectories([{ name: "(local)", root: ROOT, own: true }]);
// The real corpus, scanned ONCE at module scope (bean sff8's remedy, as in
// instance-render.test.ts). Four tests read it; two scanned it again inside
// the test body, where a whole-repo walk (~6 s measured 2026-10-05) ran
// against bun's 5 s per-test limit and timed out in CI. Nothing in this file
// writes to the tree, so one scan answers every test exactly as four did.
const REAL = scanSubgraphs(ROOT);

describe("subgraph containment is derived from declared paths", () => {

  test("a repository-scoped directory is not a child of an instance-relative one", () => {
    // `smart-base/methodologies/` is repository-scoped so the extraction is
    // literal. Reading it as a child of `methodologies/` would be wrong on
    // the path AND on the intent. (The example was `smart-kg/methodologies/`
    // until it was removed, bean `wg7r`.)
    // Since placement PR0 (bean `ejye`) smart-base declares it itself, and the
    // platform reaches it through the CHECKOUT rather than a mirror: the tree
    // over the corpus must still not read it as a child of the harness's own.
    const corpus = checkoutDirectories(ROOT, { stackedOn: ROOT });
    const scoped = corpus.find((d) => d.absPath === resolve(ROOT, "..", "smart-base", "methodologies"));
    expect(scoped, "smart-base's methodologies did not resolve — vacuous").toBeDefined();
    const own = dirs.find((d) => d.id === "methodologies")!;
    expect(owningDirectory([own, scoped!], join(scoped!.absPath, "x.md"))?.absPath).toBe(scoped!.absPath);
  });
});

describe("the entanglement report", () => {

  test("the dangling category exists and is computed, not skipped", () => {
    // This asserted `dangling.length > 0` until 2026-09-20, on the reasoning
    // that the corpus always had some. Bean `rl3h` drained them to zero and
    // the guard inverted: it failed ON SUCCESS, which is the worst shape a
    // guard can take — it punishes the fix it exists to encourage.
    //
    // What it should pin is that the category is COMPUTED. A synthetic file
    // with a link to nothing must be reported, whatever the real corpus
    // happens to contain today.
    const probe = REAL.dangling;
    expect(Array.isArray(probe), "the category is absent, not merely empty").toBe(true);
    // The synthetic file: a link to nothing, in a declared directory of a
    // throwaway layer, swept by the same `scanSubgraphs`. It must come back
    // in the dangling category, by file and target.
    const fixture = mkdtempSync(join(tmpdir(), "subgraphs-dangling-"));
    try {
      mkdirSync(join(fixture, "notes"), { recursive: true });
      writeDeclaration(fixture, JSON.stringify({
        name: "t",
        stub: "t",
        canonicalUrl: "https://example.invalid/t",
        directories: [{ id: "notes", path: "notes/", description: "notes", graphTypologies: ["code"] }],
      }));
      writeFileSync(join(fixture, "notes", "n.md"), "# n\n\n[x](./no-such-file.md)\n");
      expect(scanSubgraphs(fixture).dangling.map((d) => `${d.from} → ${d.target}`)).toEqual(["notes/n.md → ./no-such-file.md"]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
    // And the corpus itself is clean — stated as its own assertion so that
    // "clean" and "not computed" can never be the same passing test.
    expect(probe.map((d) => `${d.from} → ${d.target}`)).toEqual([]);
  });
});

describe("repository-scoped directories are attributed", () => {
  const report = REAL;

  test("fsh-guts is exempt because it DECLARES an unpublished kind", () => {
    // It was already skipped before this bean — by accident, via the path
    // bug. Right answer, wrong reason, and therefore not one to rely on.
    // Declared by the checkout's ROOT layer since placement PR0, so it is
    // labelled `folio-assistant/fsh-guts`.
    expect(report.exempt.some((d) => /(^|\/)fsh-guts \(/.test(d))).toBe(true);
    // And the exemption is narrow: it must not swallow ordinary directories.
    expect(report.exempt.length).toBeLessThan(3);
  });

  test("the x4v4 separation survives the change", () => {
    // Making scoped paths attributable must NOT make `smart-base/methodologies/`
    // read as a child of `methodologies/` — that separation is deliberate and
    // was settled in bean `x4v4`. This is the trap the bean named in advance.
    for (const r of report.tree) {
      expect(r.children).not.toContain("smart-base-methodologies");
    }
    // The positive half USED to be `methodologies` → [methodology-crdm,
    // methodology-raci]. Both declarations went on 2026-09-22.
    //
    // The negative assertion above must not become vacuous, which it does the
    // moment the tree is empty ("clean" and "not computed" must never be one
    // passing test). So what is pinned is that the tree was COMPUTED and that
    // the scoped entry RESOLVED — the two facts that make "it is nobody's
    // child" mean something. The tree is non-empty again since `main`
    // declared `test/` as a `code` graph, but this test does not depend on
    // that either way.
    // smart-base's own entry, reached through the checkout since placement PR0.
    const scoped = checkoutDirectories(ROOT, { stackedOn: ROOT }).find(
      (d) => d.absPath === resolve(ROOT, "..", "smart-base", "methodologies"),
    );
    expect(scoped, "smart-base's methodologies did not resolve — the check above is vacuous").toBeDefined();
    expect(Array.isArray(report.tree), "containment was not computed at all").toBe(true);
  });
});
