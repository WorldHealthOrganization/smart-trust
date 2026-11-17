import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkTestRuns } from "../test-run-conformance.js";
import { knownSkills } from "../known-skills.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const INSTANCE = resolve(HARNESS_ROOT);
const SKILLS = knownSkills(INSTANCE);
const dir = mkdtempSync(join(tmpdir(), "test-runs-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const basis = { hash: "abc", inputs: ["x"] };
function run(name: string, body: Record<string, unknown>): void {
  writeFileSync(
    join(dir, `${name}.test-run.json`),
    JSON.stringify({ $schema: "folio-test-run/v1", subject: "s", data: basis, process: basis, outcome: {}, updated_at: "t", ...body }),
  );
}

const good = { input: { text: "can you add a tool" }, output: { fires: true, categories: ["direct-capability"], excluded: false } };

describe("a test run is checked against the contract of the skill it names (#1168, B4)", () => {
  test("each state is reported separately, never folded into a pass", () => {
    run("a-good", { skill: "crdm-detect", cases: [good] });
    run("b-bad-output", { skill: "crdm-detect", cases: [good, { input: { text: "x" }, output: { fires: "yes" } }] });
    run("c-ghost", { skill: "no-such-skill-here", cases: [good] });
    run("d-no-cases", { skill: "crdm-detect" });
    run("e-no-contract", { skill: "role-model", cases: [good] });
    run("f-unparseable", { cases: [good] });

    const r = checkTestRuns(INSTANCE, dir, SKILLS);
    const names = (fs: { where: string }[]) => fs.map((f) => f.where.replace(/^.*\//, "").replace(".test-run.json", "")).sort();

    expect(r.runs).toBe(6);
    expect(r.checked).toBe(1);
    expect(names(r.nonconforming)).toEqual(["b-bad-output"]);
    expect(r.nonconforming[0]!.detail).toContain("case 1: output");
    expect(names(r.unresolved)).toEqual(["c-ghost", "f-unparseable"]);
    expect(names(r.unchecked)).toEqual(["d-no-cases", "e-no-contract"]);
  });
});

describe("an absent results directory is not 'no runs' (audit C5, bean 2gst)", () => {
  test("absent: looked is false and nothing is counted, so the caller reports unknown, not n/a", () => {
    const r = checkTestRuns(INSTANCE, join(dir, "never-created"), SKILLS);
    expect(r.looked).toBe(false);
    expect(r.runs).toBe(0);
  });
  test("present but empty: NOT looked — another writer may have made it (cat-harness-tools#759)", () => {
    const empty = mkdtempSync(join(tmpdir(), "test-runs-empty-"));
    try {
      const r = checkTestRuns(INSTANCE, empty, SKILLS);
      expect(r.looked).toBe(false);
      expect(r.runs).toBe(0);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
  test("present but empty when determined (qa:refresh, or a committed directory): looked — a determined zero the caller may call n/a", () => {
    const empty = mkdtempSync(join(tmpdir(), "test-runs-empty-"));
    try {
      const r = checkTestRuns(INSTANCE, empty, SKILLS, undefined, { determined: true });
      expect(r.looked).toBe(true);
      expect(r.runs).toBe(0);
      // determined never conjures a directory that is not there
      expect(checkTestRuns(INSTANCE, join(empty, "never-created"), SKILLS, undefined, { determined: true }).looked).toBe(false);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
  test("present but empty, store hit: the store's runs are checked", () => {
    const empty = mkdtempSync(join(tmpdir(), "test-runs-empty-"));
    try {
      const r = checkTestRuns(INSTANCE, empty, SKILLS, () => ({ looked: true, files: [] }));
      expect(r.looked).toBe(true);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
  test("storeFallback: miss or corrupt remains looked=false (unknown); hit checks files from the store", () => {
    const missed = checkTestRuns(INSTANCE, join(dir, "never-created"), SKILLS, () => ({ looked: false, files: [] }));
    expect(missed.looked).toBe(false);
    expect(missed.runs).toBe(0);

    const hitText = JSON.stringify({
      $schema: "folio-test-run/v1",
      subject: "s",
      data: basis,
      process: basis,
      outcome: {},
      updated_at: "t",
      skill: "crdm-detect",
      cases: [good],
    });
    const hit = checkTestRuns(INSTANCE, join(dir, "never-created"), SKILLS, () => ({
      looked: true,
      files: [{ where: "test/results/a-good.test-run.json", text: hitText }],
    }));
    expect(hit.looked).toBe(true);
    expect(hit.runs).toBe(1);
    expect(hit.checked).toBe(1);
  });
});
