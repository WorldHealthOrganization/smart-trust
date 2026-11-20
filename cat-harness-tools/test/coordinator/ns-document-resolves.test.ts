/**
 * A layer's namespace DOCUMENT is published at the path its terms name.
 *
 * Every term hangs off a layer's namespace IRI — `fac:Catalogue` is
 * `…/folio-assistant-core/ns#Catalogue` — and the workflows publish one
 * document per layer so that IRI dereferences. The directory they publish
 * into was a LITERAL in a shell loop, and the IRI is a constant in
 * `schemas/kg/namespaces.ts`. Nothing compared them.
 *
 * They drifted. #477 renamed the core layer from `folio-assist-core` to
 * `folio-assistant-core` and moved `CORE_NS` with it; both workflows kept
 * publishing to `_site/folio-assist-core/ns.jsonld`. So from that merge until
 * 2026-09-20, **every `fac:` term dereferenced to nothing** — the document sat
 * at a path no term named, and the path every term named had no document.
 *
 * `docs-site.yml` says the rule in its own comment — *"each of those is an IRI
 * stem, so each needs a document or `bs:Actor` dereferences to nothing — the
 * very defect this work exists to fix"* — and `ns-export.ts` asserts the
 * outcome outright: *"Every term lives in its layer's namespace … each of
 * which IS a file and dereferences."* Both were false for one of the three,
 * and no check read either claim.
 *
 * This is that comparison. It reads the loop out of the YAML rather than
 * restating the pairs, so a fourth layer is covered the day it is added.
 *
 * @module test/ns-document-resolves
 *
 * Moved here from `cat-harness/scripts/tests/` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: every test in it reads the aggregate
 * repository's own root — `.github/workflows/docs-site.yml` and
 * `feature-staging.yml` — which a standalone cat-harness layer does not have,
 * and `check:cat-harness-standalone` collects every test in that layer.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { namespaceForLayer } from "../../schemas/kg/namespaces.ts";
import { contentLayerInstance } from "../../schemas/kg/graph-typology-registry.ts";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = join(ORIGIN_DIR, "../../..");

/** The workflows that publish per-layer namespace documents. */
const WORKFLOWS = [".github/workflows/docs-site.yml", ".github/workflows/feature-staging.yml"] as const;

type Layer = "bootstrap" | "harness" | "core";

/**
 * The `layer:directory` pairs a workflow publishes namespace documents for.
 *
 * Read out of the `for pair in …` line rather than listed here. A test that
 * restated the pairs would pass while the workflow said something else, which
 * is the exact failure being guarded.
 */
function pairsIn(workflow: string): Array<{ layer: Layer; dir: string }> {
  const yaml = readFileSync(join(REPO, workflow), "utf-8");
  const line = yaml.split("\n").find((l) => l.includes("for pair in"));
  if (!line) throw new Error(`${workflow}: no \`for pair in …\` loop — has the publishing step been renamed?`);
  const looped = [...line.matchAll(/"([a-z-]+):([a-z0-9-]+)"/g)].map((m) => ({
    layer: m[1] as Layer,
    dir: m[2]!,
  }));
  // bootstrap's document is bootstrap's OWN, written by bootstrap-tools and
  // committed (owner, 2026-09-30, bean `xsqm`), so the workflow COPIES it
  // rather than building it in the loop. Read that line too: where it lands
  // is the same question the loop answers for the other layers.
  const copied = [...yaml.matchAll(/cp \.\/bootstrap\/ns\.jsonld "\.\/_site\/([a-z0-9-]+)\//g)].map((m) => ({
    layer: "bootstrap" as Layer,
    dir: m[1]!,
  }));
  return [...copied.slice(0, 1), ...looped];
}

/** The path segment a layer's namespace IRI names, e.g. `folio-assistant-core`. */
function segmentOf(layer: Layer): string {
  // The core layer's namespace is its declaring layer's (folio-assistant#2598).
  const ns = layer === "core" ? contentLayerInstance()!.namespace : namespaceForLayer(layer);
  // Skipping a release segment (`v0`, or an older copy's `0.1.0`), which is the version and not the layer.
  const m = ns.match(/\/([^/]+)\/(?:(?:\d+\.\d+\.\d+|v\d+)\/)?ns\/$/);
  if (!m) throw new Error(`namespace for ${layer} is not <base>/<segment>/ns/: ${ns}`);
  return m[1]!;
}

describe("a layer's namespace document is published where its terms say it is", () => {
  test.each(WORKFLOWS.map((w): [string] => [w]))("%s publishes each layer under its own IRI segment", (workflow) => {
    const pairs = pairsIn(workflow);

    // Vacuity guard FIRST. `check-declared-assets` shipped the version
    // without one and reported "0 across 0 instances, exit 0" (bean `6tkl`);
    // a regex that stops matching would otherwise turn this into a test that
    // asserts nothing and passes forever.
    expect(pairs.length).toBeGreaterThanOrEqual(3);

    const mismatched = pairs
      .filter((p) => p.dir !== segmentOf(p.layer))
      .map((p) => `${p.layer}: published to ${p.dir}, but its terms name ${segmentOf(p.layer)}`);
    expect(mismatched).toEqual([]);
  });

  test("the two workflows agree with each other", () => {
    // They publish the same documents into two different trees, so a fix
    // applied to one and not the other leaves previews lying about the site.
    // That is how the original drift survived: docs-site and feature-staging
    // carried the same literal and both were wrong, so neither contradicted
    // the other.
    const [a, b] = WORKFLOWS.map(pairsIn);
    expect(a!.length).toBeGreaterThanOrEqual(3);
    expect(b).toEqual(a!);
  });

  test("every layer with a namespace is published by the loop", () => {
    // The inverse direction. The checks above pass if a layer is simply
    // dropped from the loop — its document then does not exist at all, which
    // is worse than existing at the wrong path.
    const published = new Set(pairsIn(WORKFLOWS[0]).map((p) => p.layer));
    for (const layer of ["bootstrap", "harness", "core"] as const) {
      expect({ layer, published: published.has(layer) }).toEqual({ layer, published: true });
    }
  });
});
