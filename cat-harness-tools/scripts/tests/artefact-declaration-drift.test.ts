/**
 * The `maintains` reconciliation, and the narrowing it acquired on 2026-09-20.
 *
 * Written because it had no test and its semantics were about to change. The
 * gate had encoded "an artefact a Tool maintains is produced by the schema
 * exporter", which was true of the three original carriers and of nothing else.
 * `ns-vocabulary` and `content-context` were the first counterexample — both
 * declarations true, both published by `docs-site.yml`, both reported as drift.
 *
 * These tests pin the three findings apart, because the remedies are opposite:
 * `undeclared` means add a Tool node, `unproduced` means the declaration rotted
 * and a consumer would hit a 404, and `missingSource` means the artefact may be
 * perfectly correct while its PROVENANCE is unfollowable.
 *
 * @module scripts/tests/artefact-declaration-drift
 */
import { describe, expect, it } from "bun:test";

import { artefactDeclarationDrift, declaredArtefacts } from "../harness-schema-export.js";

describe("declaredArtefacts", () => {
  it("carries the declaring Tool's own invocation", () => {
    const declared = declaredArtefacts();
    expect(declared.size).toBeGreaterThan(0);
    // Every entry knows who produces it. Without this the reconciliation cannot
    // tell an artefact this command writes from one the site build writes, which
    // is the whole point of the narrowing.
    for (const [artefact, d] of declared) {
      expect(d.tool, `${artefact} names no Tool`).toBeTruthy();
      expect(d.source, `${artefact} names no source`).toBeTruthy();
    }
  });

  it("names every source as a path that exists in the tree", () => {
    // `missingSource` is the finding; this asserts the corpus is currently clean
    // of it, so a future declaration pointing at a moved module fails here
    // rather than only in CI.
    const { missingSource } = artefactDeclarationDrift([]);
    expect(missingSource).toEqual([]);
  });
});

describe("artefactDeclarationDrift", () => {
  it("reports a produced artefact that no Tool declares", () => {
    const { undeclared } = artefactDeclarationDrift(["not-declared-by-anything.schema.json"]);
    expect(undeclared).toContain("not-declared-by-anything.schema.json");
  });

  it("does NOT report artefacts produced by some other command as unproduced", () => {
    // The narrowing, stated as a test. `cat-harness/ns.jsonld` and
    // `ns/content/v1.jsonld` are maintained by Tools that do not invoke
    // `kg:schema`, so passing an empty produced-list must not indict them: this
    // script cannot see whether the site build wrote them, and a check that
    // answers a question it cannot see is worse than one that declines to.
    const { unproduced } = artefactDeclarationDrift([]);
    const flagged = unproduced.map((u) => u.artefact);
    expect(flagged).not.toContain("cat-harness/ns.jsonld");
    // declared-path-literal: the test's subject is this published context path itself, written as consumers see it.
    expect(flagged).not.toContain("ns/content/v1.jsonld");
  });

  it("still reports this command's OWN artefact when it stops being produced", () => {
    // The guarantee the narrowing keeps. Every schema carrier invokes
    // `bun run cat kg:schema`, so an empty produced-list must indict all of them —
    // otherwise the scoping has thrown away the rot detection it was meant to
    // preserve, which is the way this change could have gone quietly wrong.
    const { unproduced } = artefactDeclarationDrift([]);
    const flagged = unproduced.map((u) => u.artefact);
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.some((a) => a.endsWith(".schema.json"))).toBe(true);
  });
});
