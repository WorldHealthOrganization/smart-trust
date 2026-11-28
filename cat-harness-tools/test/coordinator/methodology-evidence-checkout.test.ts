/**
 * `methodology-evidence` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/methodology-evidence.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads the methodology graphs
 * of the content layers, smart-base's among them, which only the checkout
 * holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { checkMethodologyEvidence } from "../../scripts/check-methodology-evidence.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const INSTANCE_ROOT = resolve(ORIGIN_DIR, "..", "..");

describe("the real corpus", () => {
  const report = checkMethodologyEvidence(INSTANCE_ROOT);

  it("finds the methodology graph at all — undetermined is a third state", () => {
    // An empty sweep and a clean sweep must not share a spelling (`dh4f`). If
    // this ever flips, the axis reports nothing and exits 2 rather than
    // printing a clean run over a corpus it never located.
    expect(report.undetermined).toBe(false);
    expect(report.nodes).toBeGreaterThan(0);
  });

  it("every node in the corpus validates", () => {
    expect(report.invalid).toEqual([]);
  });

  it("no node cites an `evidence` that resolves nowhere", () => {
    // The one evidence finding that DOES gate. A pointer claiming to resolve
    // and failing to is worse than no pointer: every listing reads it as
    // backed.
    expect(report.unresolved).toEqual([]);
  });

  it("reaches `diig` in the repository-scoped smart-base graph, not just the harness's", () => {
    // `smart-base/methodologies/` is repository-scoped so it lifts out whole.
    // A sweep resolving only instance-relative directories would miss it and
    // report a smaller, cleaner corpus than exists. (This read `grade` in
    // `smart-kg/` until GRADE became a skill, bean `wg7r`.)
    const names = [...report.resolved.map((r) => r.name), ...report.noEvidence.map((f) => f.name)];
    expect(names).toContain("diig");
  });

  it("swot is backed by BOTH its sources, and each is really on disk", () => {
    const swot = report.resolved.filter((r) => r.name === "swot");
    expect(swot.map((r) => r.evidence).sort()).toEqual([
      "library/gurel-tat-2017-swot-analysis",
      "library/sammut-bonnici-galea-2015-swot-analysis",
    ]);
    for (const r of swot) expect(existsSync(join(INSTANCE_ROOT, r.at))).toBe(true);
  });

  it("a node is backed only when EVERY source it cites resolves", () => {
    // Half-backed must not read as backed. `resolved` holds one entry per
    // (node, source) pair, so counting it as a count of METHODOLOGIES reported
    // 2 of 5 the moment swot gained a second source — the count bug this
    // assertion pins shut.
    const backed = new Set(report.resolved.map((r) => r.name));
    const unresolved = new Set(report.unresolved.map((f) => f.name));
    for (const name of backed) expect(unresolved.has(name)).toBe(false);
    expect(backed.size).toBeLessThanOrEqual(report.nodes);
  });

  it("does NOT descend into a methodology's own subgraph directory", () => {
    // `x4v4`: a subgraph's nodes are its own. `methodologies/crdm/` is declared
    // separately as a `skills` graph, so collecting `crdm-detect.md` here would
    // attribute a CRDM skill to the methodology graph and make every count
    // computed from it wrong.
    const all = [...report.resolved, ...report.noEvidence, ...report.invalid, ...report.untagged];
    expect(all.map((n) => ("node" in n ? n.node : "")).filter((p) => /methodologies\/[^/]+\//.test(p))).toEqual([]);
  });
});
