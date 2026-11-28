/**
 * `folio-viz` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/folio-viz.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads the folio directory a content
 * layer above cat-harness declares, which only the checkout holds. Standing
 * alone, cat-harness has none of it, and `check:cat-harness-standalone`
 * collects every test in that layer. The rest of that file's tests stay there;
 * every path here is composed from ORIGIN_DIR, the directory they were written
 * in, so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { viewersOf, type ViewedDirectory } from "../../scripts/viewer-declarations.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

/**
 * The folio graph has a view of its own. Bean `7ofc`.
 *
 * Owner, 2026-09-22: *"folio must be in cat-harness and visualizer owned by
 * it."* `folio` is the only `renderable` kind — its CONTENT already renders
 * as the landing board — so what was missing was a view of the GRAPH, and
 * `check:subgraph-coverage` never asked for it because `owesVisualiser`
 * exempts the kind. The obligation is `2krx`'s: a directory nobody can see
 * is one nobody checks.
 */

const ROOT = join(ORIGIN_DIR, "..", "..");
const REPO = repoRootFor(ROOT);

describe("the generated artefacts are the ones declared", () => {

  test("the folio directory's viewer — read from the harness declaration — is the page that exists", () => {
    // A viewer that resolves to nothing is `pb04`: the coverage reads as met
    // and the link is dead. Since #1168 B7a-2b the page names the directory it
    // draws, and the directory no longer names its page.
    const decl = JSON.parse(readFileSync(join(ROOT, "cat-harness.json"), "utf-8")) as {
      directories: ViewedDirectory[];
    };
    const folio = decl.directories.find((d) => d.id === "folio");
    expect(folio).toBeDefined();
    const vis = viewersOf(folio!, ROOT, REPO)[0]?.ref;
    expect(vis).toBeDefined();
    expect(existsSync(join(REPO, vis!)), `${vis} does not resolve`).toBe(true);
  });
});
