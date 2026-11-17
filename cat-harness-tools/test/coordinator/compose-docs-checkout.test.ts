/**
 * `compose-docs` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/compose-docs.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads the root layer's
 * declaration, which declares the `root-docs` layer, which only the checkout
 * holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { docsLayers, OUTPUT_LAYER_SUFFIX } from "../../scripts/compose-docs.ts";
import {  } from "../../schemas/kg/cat-harness.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = resolve(ORIGIN_DIR, "..", "..", "..");

describe("compose-docs reads its layers from the declaration", () => {

  test("the REAL repository declares the site chrome as the base and docs over it", () => {
    // Vacuity guard: every fixture test below would pass against a repository
    // that had no layers at all. The root's empty `root-docs` overlay was
    // excised (bean `yywu`, owner 2026-10-06); the overlay mechanism stays,
    // exercised by the fixtures, for a folio that declares one.
    const { layers, missing } = docsLayers(REPO);
    expect(missing).toEqual([]);
    // Semantic subgraphs, slice 1 (owner, 2026-10-09): the just-the-docs
    // CHROME is its own `docs` layer, declared first, and the harness's pages
    // overlay it.
    // A mounted layer's computed pages are laid over it as `<id>@output` only
    // when a writer has run in this checkout (sm8r item 4, step 4), so the
    // DECLARED layers are what is asserted, and a twin, when one is there,
    // sits directly over its base.
    const ids = layers.map((l) => l.id);
    expect(ids.filter((id) => !id.endsWith(OUTPUT_LAYER_SUFFIX))).toEqual(["site-chrome", "docs"]);
    for (const [i, id] of ids.entries()) {
      if (id.endsWith(OUTPUT_LAYER_SUFFIX)) expect(ids[i - 1]).toBe(id.slice(0, -OUTPUT_LAYER_SUFFIX.length));
    }
  });
});
