/**
 * A test run records both hashes, and neither is derivable from the other.
 *
 * Bean `folio-assistant-zz0a`, issue #363. Its three criteria are the three
 * describe blocks below, in order, so a reader can check the bean against
 * the file rather than against a claim about the file.
 *
 * @module schemas/test-run.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  TEST_RUN_SCHEMA_ID,
  type TestRun,
  TestRunBasisError,
  TestRunSchema,
  UNKNOWN_HASH,
  basisOverlap,
  buildTestRun,
  hashBasis,
  hashesReproduce,
} from "./sdlc/test-run.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { harnessRel } from "../scripts/lib/harness-layout.ts";

const ROOT = resolve(HARNESS_ROOT);
const temps: string[] = [];

/** A throwaway root holding `files`, as {path: contents}. */
function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "test-run-"));
  temps.push(dir);
  for (const [p, body] of Object.entries(files)) writeFileSync(join(dir, p), body);
  return dir;
}

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

describe("criterion 1 — both hashes, neither derivable from the other", () => {
  test("a run carries a data hash and a process hash, over different inputs", () => {
    const root = fixture({ "corpus.json": "[1,2,3]", "runner.ts": "// a runner" });
    const run = buildTestRun({
      root,
      skill: "s",
      subject: "s",
      dataInputs: ["corpus.json"],
      processInputs: ["runner.ts"],
      outcome: { score: 1 },
    });
    expect(run.data.hash).not.toBe(run.process.hash);
    expect(run.data.inputs).toEqual(["corpus.json"]);
    expect(run.process.inputs).toEqual(["runner.ts"]);
    expect(() => TestRunSchema.parse(run)).not.toThrow();
  });

  test("overlapping bases are REFUSED, because the pair would say nothing extra", () => {
    // This is the criterion made structural rather than promised. A file in
    // both bases moves both hashes together, so two hashes carry exactly
    // what one would.
    const root = fixture({ "both.json": "{}", "runner.ts": "//" });
    let err: unknown;
    try {
      buildTestRun({
        root,
        skill: "s",
        subject: "s",
        dataInputs: ["both.json"],
        processInputs: ["both.json", "runner.ts"],
        outcome: {},
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TestRunBasisError);
    expect((err as TestRunBasisError).overlap).toEqual(["both.json"]);
  });

  test("basisOverlap reports every shared input, not just the first", () => {
    const a = { hash: "x", inputs: ["p", "q", "r"] };
    const b = { hash: "y", inputs: ["q", "r", "s"] };
    expect(basisOverlap(a, b)).toEqual(["q", "r"]);
    expect(basisOverlap(a, { hash: "y", inputs: ["s"] })).toEqual([]);
  });

  test("the real runner's two bases are in fact disjoint", () => {
    // Not a fixture: the shipped call. If somebody later adds the corpus to
    // the process basis, this fails here rather than at the next run.
    const run = buildTestRun({
      root: dirname(ROOT),
      skill: "crdm-detect",
      subject: "crdm-detect phrase signals against the issue corpus",
      dataInputs: ["cat-harness-tools/scripts/eval/crdm-detect-corpus.json"],
      // declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
      processInputs: ["cat-harness-tools/scripts/eval-crdm-detect.ts", `cat-harness/${harnessRel("skills/process/crdm/crdm-detect.md")}`],
      outcome: {},
    });
    expect(run.data.hash).not.toBe(UNKNOWN_HASH);
    expect(run.process.hash).not.toBe(UNKNOWN_HASH);
  });
});

describe("criterion 2 — an unchanged data set and process reproduce the hashes", () => {
  test("hashing the same files twice gives the same digest", () => {
    const root = fixture({ "corpus.json": "[1,2,3]" });
    expect(hashBasis(root, ["corpus.json"])).toEqual(hashBasis(root, ["corpus.json"]));
  });

  test("input ORDER does not change the hash, but input SET does", () => {
    const root = fixture({ "a.json": "1", "b.json": "2" });
    expect(hashBasis(root, ["a.json", "b.json"]).hash).toBe(
      hashBasis(root, ["b.json", "a.json"]).hash,
    );
    expect(hashBasis(root, ["a.json"]).hash).not.toBe(hashBasis(root, ["a.json", "b.json"]).hash);
  });

  test("two files swapping NAMES is a different basis", () => {
    // Content-only hashing would call these identical. The path is hashed
    // alongside the bytes precisely so it does not.
    const one = fixture({ "a.json": "A", "b.json": "B" });
    const two = fixture({ "a.json": "B", "b.json": "A" });
    expect(hashBasis(one, ["a.json", "b.json"]).hash).not.toBe(
      hashBasis(two, ["a.json", "b.json"]).hash,
    );
  });

  test("an unchanged run reproduces on both halves", () => {
    const root = fixture({ "c.json": "[1]", "r.ts": "//" });
    const mk = () =>
      buildTestRun({
        root,
        skill: "s",
        subject: "s",
        dataInputs: ["c.json"],
        processInputs: ["r.ts"],
        outcome: {},
      });
    expect(hashesReproduce(mk(), mk())).toEqual({ data: true, process: true, both: true });
  });
});

describe("criterion 3 — a deliberate change to either is detected", () => {
  test("changing the DATA moves the data hash and only the data hash", () => {
    const root = fixture({ "c.json": "[1]", "r.ts": "//" });
    const mk = () =>
      buildTestRun({ root, skill: "s", subject: "s", dataInputs: ["c.json"], processInputs: ["r.ts"], outcome: {} });
    const before = mk();
    writeFileSync(join(root, "c.json"), "[1,2]");
    const after = mk();
    expect(hashesReproduce(before, after)).toEqual({ data: false, process: true, both: false });
  });

  test("changing the PROCESS moves the process hash and only the process hash", () => {
    // The direction `cv10` missed: the subject is untouched and the thing
    // that judged it has changed.
    const root = fixture({ "c.json": "[1]", "r.ts": "//" });
    const mk = () =>
      buildTestRun({ root, skill: "s", subject: "s", dataInputs: ["c.json"], processInputs: ["r.ts"], outcome: {} });
    const before = mk();
    writeFileSync(join(root, "r.ts"), "// changed");
    const after = mk();
    expect(hashesReproduce(before, after)).toEqual({ data: true, process: false, both: false });
  });
});

describe("`unknown` is a third state, not a value that matches itself", () => {
  test("an unreadable input yields unknown rather than a hash of nothing", () => {
    const root = fixture({});
    const b = hashBasis(root, ["missing.json"]);
    expect(b.hash).toBe(UNKNOWN_HASH);
    // The inputs are still recorded: a reader must be able to see WHAT could
    // not be read, not merely that something could not.
    expect(b.inputs).toEqual(["missing.json"]);
  });

  test("one unreadable input makes the WHOLE basis unknown", () => {
    // All-or-nothing. Hashing the readable subset would give a confident
    // digest over a different set than the one `inputs` claims.
    const root = fixture({ "there.json": "1" });
    expect(hashBasis(root, ["there.json", "missing.json"]).hash).toBe(UNKNOWN_HASH);
  });

  test("unknown does not reproduce unknown", () => {
    // Two runs that both failed to read their inputs have not been shown to
    // agree — they have both failed to answer. Rendering that as
    // "reproduced" is the third-state defect in its purest form.
    const run: TestRun = {
      $schema: TEST_RUN_SCHEMA_ID,
      skill: "s",
      subject: "s",
      data: { hash: UNKNOWN_HASH, inputs: ["x"] },
      process: { hash: UNKNOWN_HASH, inputs: ["y"] },
      outcome: {},
      updated_at: "2026-09-19T00:00:00.000Z",
    };
    expect(hashesReproduce(run, run)).toEqual({ data: false, process: false, both: false });
  });

  test("a real hash still reproduces itself — the guard is not simply 'never equal'", () => {
    // Vacuity check on the test above: if `hashesReproduce` always returned
    // false it would pass, and prove nothing.
    const run: TestRun = {
      $schema: TEST_RUN_SCHEMA_ID,
      skill: "s",
      subject: "s",
      data: { hash: "abc123abc123", inputs: ["x"] },
      process: { hash: "def456def456", inputs: ["y"] },
      outcome: {},
      updated_at: "2026-09-19T00:00:00.000Z",
    };
    expect(hashesReproduce(run, run).both).toBe(true);
  });
});

describe("the schema refuses what it cannot mean", () => {
  test("a basis with no inputs is rejected — a hash over nothing is not a hash", () => {
    expect(() =>
      TestRunSchema.parse({
        $schema: TEST_RUN_SCHEMA_ID,
        skill: "s",
        subject: "s",
        data: { hash: "a", inputs: [] },
        process: { hash: "b", inputs: ["y"] },
        outcome: {},
        updated_at: "t",
      }),
    ).toThrow();
  });

  test("a recorded run, written and read back, parses as what it declares", () => {
    // A FRESH run through the writer's own serialisation, not the committed
    // `crdm-detect-eval.test-run.json`: that file is derived QA output on its
    // way to the `qa-reports` branch, and a test must not assert on the
    // corpus (bean `cxcn`, reader audit F7 R70).
    const root = fixture({ "corpus.json": "[1]", "runner.ts": "//" });
    const run = buildTestRun({ root, skill: "s", subject: "s", dataInputs: ["corpus.json"], processInputs: ["runner.ts"], outcome: { f1: 1 } });
    const file = join(root, "s.test-run.json");
    writeFileSync(file, JSON.stringify(run, null, 2) + "\n");
    const parsed = TestRunSchema.parse(JSON.parse(readFileSync(file, "utf-8")));
    expect(parsed.$schema).toBe(TEST_RUN_SCHEMA_ID);
    expect(basisOverlap(parsed.data, parsed.process)).toEqual([]);
  });
});

describe("a run may name the plan it executed and the system under test (bean ygzh)", () => {
  const base = () => {
    const root = fixture({ "d.json": "[]", "p.ts": "//" });
    return buildTestRun({ root, skill: "s", subject: "s", dataInputs: ["d.json"], processInputs: ["p.ts"], outcome: {} });
  };
  const sut = { kind: "agent" as const, model: "claude-opus-5", configuration: "harness", actor: "claude-code", version: "2.1.0", reach: "internet" as const };

  test("a run recorded before plans existed still parses, with neither field", () => {
    // The shape `crdm-detect-eval.test-run.json` was recorded in, as a
    // fixture rather than read from the committed corpus (bean `cxcn`).
    const legacy = {
      $schema: TEST_RUN_SCHEMA_ID,
      skill: "crdm-detect",
      subject: "crdm-detect phrase signals against the issue corpus",
      data: { hash: "2e3ab7fa317f", inputs: ["scripts/eval/crdm-detect-corpus.json"] },
      process: { hash: "cac2af445036", inputs: ["scripts/eval-crdm-detect.ts", "src/crdm/detect-signals.ts"] },
      outcome: { population: 27, precision: 0.9545, recall: 0.9545, f1: 0.9545 },
      cases: [{ input: { text: "t" }, output: { fires: false, categories: [], excluded: false } }],
      updated_at: "2026-09-19T00:00:00.000Z",
    };
    const parsed = TestRunSchema.parse(JSON.parse(JSON.stringify(legacy)));
    expect(parsed.plan).toBeUndefined();
    expect(parsed.sut).toBeUndefined();
  });

  test("plan and sut are carried through buildTestRun and parse", () => {
    const root = fixture({ "d.json": "[]", "p.ts": "//" });
    const run = buildTestRun({
      root,
      skill: "s",
      subject: "s",
      dataInputs: ["d.json"],
      processInputs: ["p.ts"],
      outcome: {},
      plan: { id: "crdm-detect", version: "1" },
      sut,
    });
    const parsed = TestRunSchema.parse(run);
    expect(parsed.plan).toEqual({ id: "crdm-detect", version: "1" });
    expect(parsed.sut).toEqual(sut);
  });

  test("a plan with no system under test is refused — a plan is run AGAINST something", () => {
    const r = TestRunSchema.safeParse({ ...base(), plan: { id: "p", version: "1" } });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["sut"]);
  });

  test("reach is the actor-reach vocabulary plus `unknown`, and nothing else", () => {
    const plan = { id: "p", version: "1" };
    expect(TestRunSchema.safeParse({ ...base(), plan, sut: { ...sut, reach: "unknown" } }).success).toBe(true);
    expect(TestRunSchema.safeParse({ ...base(), plan, sut: { ...sut, reach: "online" } }).success).toBe(false);
  });

  // FR-002 (owner, 2026-10-30, option A): an agent names its model and configuration; any other kind names neither.
  test("SC-002: an agent run without a model or a configuration is refused", () => {
    const plan = { id: "p", version: "1" };
    const { model: _m, ...noModel } = sut;
    const { configuration: _c, ...noConfiguration } = sut;
    expect(TestRunSchema.safeParse({ ...base(), plan, sut }).success).toBe(true);
    expect(TestRunSchema.safeParse({ ...base(), plan, sut: noModel }).success).toBe(false);
    expect(TestRunSchema.safeParse({ ...base(), plan, sut: noConfiguration }).success).toBe(false);
    expect(TestRunSchema.safeParse({ ...base(), plan, sut: { ...sut, model: "Claude Opus" } }).success).toBe(false);
  });

  test("a skill names no model, and a system under test must say its kind", () => {
    const plan = { id: "p", version: "1" };
    const script = { kind: "skill", actor: "crdm-detect-signals", version: "1", reach: "air-gapped" };
    expect(TestRunSchema.safeParse({ ...base(), plan, sut: script }).success).toBe(true);
    expect(TestRunSchema.safeParse({ ...base(), plan, sut: { ...script, model: "claude-opus-5" } }).success).toBe(false);
    const { kind: _k, ...noKind } = script;
    expect(TestRunSchema.safeParse({ ...base(), plan, sut: noKind }).success).toBe(false);
  });

  test("the plan ref carries a version, because a case id means nothing across plan versions", () => {
    expect(TestRunSchema.safeParse({ ...base(), plan: { id: "p" }, sut }).success).toBe(false);
  });
});
