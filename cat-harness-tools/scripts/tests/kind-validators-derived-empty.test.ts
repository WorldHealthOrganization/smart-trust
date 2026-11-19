/**
 * An empty working copy of a DERIVED, commit-keyed store is "could not
 * determine", never `EXAMINED NOTHING` (cat-harness-tools#1204).
 *
 * `qa` is stored on `qa-reports` and is not committed, so whether its local
 * directory holds nodes depends on which gates wrote there earlier in the
 * same shard. Failing on an empty one made the verdict depend on run order,
 * the defect #759 fixed for `test-run-conformance`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runWithFailureRecap, sweepFamilies } from "../check-kind-validators.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

const made: string[] = [];
afterAll(() => {
  for (const p of made) rmSync(p, { recursive: true, force: true });
});

describe("check:kind-validators and a derived store with no local node", () => {
  const parent = mkdtempSync(join(tmpdir(), "kv-derived-"));
  made.push(parent);
  const inst = join(parent, "fixture");
  mkdirSync(join(inst, "test", "results"), { recursive: true });
  writeDeclaration(inst, {
    name: "fixture",
    directories: [
      { id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: { branch: "qa-reports", keyedBy: "commit" } },
    ],
  });

  test("is reported as not computed here, not as an empty corpus", async () => {
    const qa = (await sweepFamilies(inst)).find((f) => f.kind === "qa");
    expect(qa).toBeDefined();
    const nodes = Object.values(qa!.counts).reduce((a, c) => a + c.nodes, 0);
    expect(nodes).toBe(0);
    expect(qa!.derivedNotComputed).toEqual([{ id: "qa", at: "fixture/test/results", branch: "qa-reports" }]);
  });
});

describe("runWithFailureRecap", () => {
  test("repeats every ✗ line at the end when the run fails", async () => {
    const lines: string[] = [];
    const code = await runWithFailureRecap(async () => {
      console.log("qa: 0 families\n  ✗ EXAMINED NOTHING — qa");
      console.log("  ✓ fine");
      console.log("  ✗ unmapped family x/v1");
      return 1;
    }, (l) => lines.push(l));
    expect(code).toBe(1);
    const recap = lines.slice(lines.findIndex((l) => l.includes("repeated so the CI summary")));
    expect(recap).toEqual([
      "\nFailures (2), repeated so the CI summary keeps them:",
      "  ✗ EXAMINED NOTHING — qa",
      "  ✗ unmapped family x/v1",
    ]);
  });

  test("adds nothing on a pass", async () => {
    const lines: string[] = [];
    expect(await runWithFailureRecap(async () => (console.log("  ✗ noted"), 0), (l) => lines.push(l))).toBe(0);
    expect(lines).toEqual(["  ✗ noted"]);
  });
});
