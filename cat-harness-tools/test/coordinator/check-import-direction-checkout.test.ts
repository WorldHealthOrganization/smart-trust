/**
 * `check-import-direction` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/check-import-direction.test.ts` (bean `7zz1`,
 * owner ruling 2026-10-06 "Top-level instance"): each reads every layer's
 * declaration and code in the checkout, which only the checkout holds.
 * Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { analyse, readInstances, type ImportDirectionReport } from "../../scripts/check-import-direction.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

describe("check:import-direction — the cat-harness / cat-harness-tools boundary", () => {
  const REAL = ["bootstrap", "bootstrap-tools", "cat-harness", "cat-harness-tools"];
  let split: string;
  let report: ImportDirectionReport;

  beforeAll(() => {
    const repo = join(ORIGIN_DIR, "..", "..", "..");
    const needs = new Map(readInstances(repo).map((i) => [i.name, i.needs]));
    split = mkdtempSync(join(tmpdir(), "import-direction-split-"));
    for (const name of REAL) {
      const p = join(split, name, `${name}.json`);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({ name, needs: needs.get(name) }));
    }
    const plant = (rel: string, body: string) => {
      mkdirSync(dirname(join(split, rel)), { recursive: true });
      writeFileSync(join(split, rel), body);
    };
    plant("cat-harness/src/core.ts", "export const core = 1;\n");
    plant("cat-harness-tools/src/server.ts", 'import { core } from "../../cat-harness/src/core.ts";\nexport { core };\n');
    plant("cat-harness/src/planted.ts", 'import { core } from "../../cat-harness-tools/src/server.ts";\nexport { core };\n');
    report = analyse(split);
  });

  afterAll(() => rmSync(split, { recursive: true, force: true }));

  test("the real declarations carry needs for every instance involved", () => {
    expect(report.undeclaredNeeds).toEqual([]);
  });

  test("cat-harness-tools → cat-harness, down the arrow, is allowed", () => {
    expect(report.findings.some((f) => f.file === "cat-harness-tools/src/server.ts")).toBe(false);
    // Not a check that reports nothing at all: the planted import UP the
    // arrow, in the same tree, is reported — as the wrong direction once
    // cat-harness's needs are declared, and as undetermined while they are not
    // (a standalone clone, where the test above fails).
    const verdict = report.undeclaredNeeds.includes("cat-harness") ? "undetermined" : "wrong-direction";
    expect(report.findings.filter((f) => f.file === "cat-harness/src/planted.ts").map((f) => ({ from: f.fromInstance, to: f.toInstance, verdict: f.verdict }))).toEqual([
      { from: "cat-harness", to: "cat-harness-tools", verdict },
    ]);
  });
});
