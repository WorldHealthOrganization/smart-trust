/**
 * Tests for bean folio-assistant-0kbt:
 * gen-docs-pages publishes a QA count that includes the witness files it deletes in the same run.
 *
 * Done when:
 * - the orphan sweep runs BEFORE the qa projection, or the projection excludes paths the sweep has queued
 * - a test writes an orphan witness, runs the generator once, and asserts the published count matches
 *   the tree the run leaves behind - not the tree it started from
 * - idempotence is pinned: two consecutive runs on an unchanged tree publish identical counts
 *
 * A test about the WHOLE CHECKOUT, written in `cat-harness/scripts/tests/`
 * and moved here (bean `7zz1`, owner ruling 2026-10-06 "Top-level instance"):
 * it spawns the full `gen-docs-pages.ts` from the repository root, which
 * rewrites the published docs tree. Standing alone, cat-harness's own tests
 * read that tree, so running it inside the layer turned nine unrelated tests
 * red in `check:cat-harness-standalone`. Every path below is composed from
 * ORIGIN_DIR, the directory it was written in, so nothing it reads changed.
 *
 * It runs the generator over a SCRATCH COPY of the checkout, never the
 * checkout itself (bean `cat-tools-sm8r` item 4): run in place it rewrote the
 * committed pages, diagrams and translation templates of every layer, and in
 * a composed checkout, whose mounts are not git work trees, nothing put them
 * back. The paths are the same paths, rebased onto the copy.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { readQaGraph } from "../../pipeline/qa-graph-index.ts";
import { directoryForGraph, siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { readPathAt, writePathAt } from "../../scripts/lib/layer-output.ts";
import { runDocsPagesIn, scratchCheckoutOf } from "../support/checkout.ts";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing it reads changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");
const ORIGIN_INSTANCE_ROOT = join(ORIGIN_DIR, "..", "..");
const REPO_ROOT = join(ORIGIN_INSTANCE_ROOT, "..");

describe("gen-docs-pages orphan sweep and QA projection order (bean 0kbt)", () => {
  // The generator re-derives the committed witnesses under every layer's
  // `test/results/`, and re-renders every committed page: it runs over a
  // scratch copy, so the checkout is never written (bean `cat-tools-sm8r`).
  // The copy is the fixture, made once with its own budget: copying a composed
  // checkout takes seconds the test's own timeout was never meant to cover.
  let scratch = "";
  beforeAll(() => {
    scratch = scratchCheckoutOf(REPO_ROOT);
  }, 180_000);
  afterAll(() => {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  }, 180_000);

  test("published QA count matches the post-sweep tree, not the tree it started from, and consecutive runs are idempotent", () => {
    const INSTANCE_ROOT = join(scratch, relative(REPO_ROOT, ORIGIN_INSTANCE_ROOT));
    const QA_ASSET_DIR = join(INSTANCE_ROOT, "test", "results", "witnesses");
    const QA_INDEX_PATH = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT), "assets", "qa", "index.json");
    // A mounted layer's witnesses are written, and swept, at its output root
    // (bean `cat-tools-sm8r`, item 4): plant the orphan where the generator
    // writes, and read what it published the way a reader does.
    const orphanDir = writePathAt(scratch, join(QA_ASSET_DIR, "test-orphan-0kbt"));
    const publishedIndex = (): string => readPathAt(scratch, QA_INDEX_PATH);
    const orphanPath = join(orphanDir, "orphan.kg.json");

    try {
      // Step 1: Write an orphan witness into the witness directory
      mkdirSync(orphanDir, { recursive: true });
      writeFileSync(
        orphanPath,
        JSON.stringify({
          $schema: "qa-witness/v1",
          counts: { fail: 999 },
        }) + "\n",
      );
      expect(existsSync(orphanPath)).toBe(true);

      // Step 2: Run the generator once
      const r1 = runDocsPagesIn(scratch, REPO_ROOT);
      if (r1.status !== 0) {
        console.error("r1 stdout:", r1.stdout);
        console.error("r1 stderr:", r1.stderr);
      }
      expect(r1.status).toBe(0);

      // Step 3: Assert the orphan was deleted by the sweep
      expect(existsSync(orphanPath)).toBe(false);

      // Step 4: Assert published count matches the tree the run leaves behind, not what it started from
      const qaDir = directoryForGraph(INSTANCE_ROOT, "qa");
      expect(qaDir).toBeDefined();
      // Counted over the scratch copy's overlay, as the generator counts it:
      // the overlay is resolved from the checkout the reader runs in.
      const cwd = process.cwd();
      process.chdir(scratch);
      let treeCount: number;
      try {
        treeCount = readQaGraph(qaDir!).files;
      } finally {
        process.chdir(cwd);
      }

      expect(existsSync(publishedIndex())).toBe(true);
      const published1 = JSON.parse(readFileSync(publishedIndex(), "utf-8")) as {
        files: number;
        families: Array<{ schema: string; files: number; buckets?: Record<string, number> }>;
      };

      // The published count must match the post-sweep tree, NOT include the deleted orphan
      expect(published1.files).toBe(treeCount);

      // The fail: 999 bucket from the deleted orphan must NOT be in qa-witness/v1
      const witnessFamily1 = published1.families.find((f) => f.schema === "qa-witness/v1");
      expect(witnessFamily1?.buckets?.["fail"]).not.toBe(999);

      // Step 5: Pin idempotence — a second run on the unchanged tree publishes identical counts
      const r2 = runDocsPagesIn(scratch, REPO_ROOT);
      expect(r2.status).toBe(0);

      const published2 = JSON.parse(readFileSync(publishedIndex(), "utf-8")) as typeof published1;
      expect(published2.files).toBe(published1.files);
      expect(published2).toEqual(published1);
    } finally {
      rmSync(orphanDir, { recursive: true, force: true });
    }
  }, 30000);
});
