/**
 * A tile's count is the count of THE PAGE THAT TILE OPENS.
 *
 * Issue #863. #862 shipped two badges that broke this, and both looked fine:
 *
 * | tile | badge shipped | page it opens | actually shows |
 * |---|---|---|---|
 * | `schemas` | 137 modules | `.../schemas/cat-harness/` | 122 |
 * | `library` | 8 entries | `.../library/cat-harness/` | **0** |
 *
 * The `library` one is the worse of the two and the more instructive. That
 * directory's own declaration says *"THIS INSTANCE HOLDS NONE"* — bean `frs5`
 * moved all four entries out — so the tile advertised eight entries over an
 * empty page. It is exactly the empty-viewer case bean `v18c` observed and
 * that this whole feature was built to surface, and the first version of the
 * feature hid it behind a number.
 *
 * ## Why this is asserted as an invariant and not as a snapshot
 *
 * Pinning "library is 0" would go red the first time somebody ingests a
 * document into this layer, which is a corpus change and not a defect. So
 * the assertion is the SUM: every scoped tile counts a disjoint slice of one
 * graph, so their counts can never add up to more than the graph holds.
 *
 * A whole-graph number on a scoped tile breaks that the moment more than one
 * layer contributes — which is the defect's own shape, and is why this
 * fails on the code as it shipped rather than merely describing it. Equality
 * holds today because every contributing layer's page is declared; a page
 * nobody declares gets no tile and no count, so the sum falls BELOW the total
 * without anything being wrong. Hence `<=` rather than `===`.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "../../../test/support/site-fs.ts";
import { join } from "node:path";

import { readTileCounts } from "../../../schemas/ui/tile-count.ts";
import { siteDirFor } from "../../../schemas/kg/cat-harness.ts";
import "../../../schemas/kg/folio-graph-typology.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { notApplicableAlone, siteNotBuilt } from "../../../test/support/checkout.ts";

/**
 * Resolved, never written down. `check:site-root` forbids the literal in
 * source AND in test fixtures, and it caught the first draft of this file
 * doing exactly that — a layer's site root is a fact its declaration
 * answers, and a second copy here is free to be wrong the day it moves.
 */
const INSTANCE = join(HARNESS_ROOT);
const SITE = join(INSTANCE, siteDirFor(INSTANCE));

function projection(seg: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(SITE, "assets", seg, "index.json"), "utf8")) as Record<
    string,
    unknown
  >;
}

/**
 * Standing alone, whether the projections a test reads are unbuilt: the site
 * build writes `assets/<graph>/index.json` at publish, and they are gitignored.
 */
const notBuilt = (...segs: string[]): boolean =>
  siteNotBuilt(
    `the ${segs.join(", ")} projection${segs.length > 1 ? "s" : ""} the site build writes at publish (gitignored)`,
    ...segs.map((seg) => join(SITE, "assets", seg, "index.json")),
  );

describe("scoped counts partition their graph — they never over-count it", () => {
  test.skipIf(notBuilt("library"))("the library projection is readable, so what follows is not vacuous", () => {
    const p = projection("library");
    expect(Array.isArray(p.entries)).toBe(true);
    expect(readTileCounts(p).size).toBeGreaterThan(0);
  });

  test.skipIf(notBuilt("library"))("library: the entry counts do not exceed the entries", () => {
    const p = projection("library");
    const total = (p.entries as unknown[]).length;
    // `uploads` is excluded BY ITS UNIT, not by its name. It counts waiting
    // uploads, not entries, and its page is the unscoped queue view — a
    // different graph slice answering a different question. Filtering on the
    // unit means a tile that changes what it counts leaves this sum on its
    // own, rather than silently staying in a total it no longer belongs to.
    const sum = [...readTileCounts(p).values()]
      .filter((c) => c.unit === "entries" || c.unit === "entry")
      .reduce((n, c) => n + c.count, 0);
    expect(sum).toBeLessThanOrEqual(total);
  });

  test.skipIf(notBuilt("schemas"))("schemas: the module counts do not exceed the modules", () => {
    const p = projection("schemas");
    const total = (p.modules as unknown[]).length;
    const sum = [...readTileCounts(p).values()]
      .filter((c) => c.unit === "modules" || c.unit === "module")
      .reduce((n, c) => n + c.count, 0);
    expect(sum).toBeLessThanOrEqual(total);
  });

  // More than one layer is a property of the COMPOSED build: a standalone
  // clone that builds its own site projects only itself, so this is not
  // applicable standing alone even with the projection present.
  test.skipIf(
    notApplicableAlone("a schema projection built over more than one instance (only the composed checkout's build has one)"),
  )("and more than one instance contributes, so the sum can actually fail", () => {
    // Without this, both assertions above would pass trivially on a corpus
    // with a single layer — one scoped count carrying the whole graph would
    // equal the total and nothing would notice. Measured rather than assumed,
    // because it is the precondition that makes this file a check at all.
    const p = projection("schemas");
    const instances = new Set(
      (p.modules as Array<{ instance?: string }>).map((m) => m.instance),
    );
    expect(instances.size).toBeGreaterThan(1);
  });
});

describe("a unit is pluralised by the declarer", () => {
  test.skipIf(notBuilt("library", "schemas", "beans", "todos", "qa", "voices"))("no count of one carries a plural unit", () => {
    // `tile-count.ts` puts pluralisation on the declarer, because only it
    // knows whether its unit pluralises regularly. This is the visible half:
    // a tile reading "1 entries" makes a careful reader trust the number less,
    // and it shipped that way until it was caught by RENDERING the tiles
    // rather than by any gate.
    for (const seg of ["library", "schemas", "beans", "todos", "qa", "voices"]) {
      for (const [id, c] of readTileCounts(projection(seg))) {
        if (c.count !== 1) continue;
        expect(`${seg}/${id}: ${c.count} ${c.unit}`).not.toMatch(/s$/);
      }
    }
  });
});
