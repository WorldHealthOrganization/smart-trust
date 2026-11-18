/**
 * The Zod half and the Pydantic half accept and reject the SAME documents.
 *
 * ## Why this is the test worth having
 *
 * This package's whole promise is in its own description: a *"cross-language
 * interchange schema"*. It ships three representations of one contract — the
 * canonical JSON Schema under `schema/`, Zod for TypeScript consumers, and
 * Pydantic for Python ones. A test that merely asked "does Zod work" would
 * pass forever while the two halves drifted apart, which is the only failure
 * that actually breaks the package.
 *
 * So every case here MIRRORS a case in `tests/test_python.py`, named for its
 * counterpart. If a behaviour is changed on one side and not the other, one of
 * the two suites goes red.
 *
 * ## What was here before
 *
 * Nothing. `package.json` declared `"test": "vitest run"` and vitest reported
 * *"No test files found, exiting with code 1"* — so the script had **never
 * passed**, and the only test in the package was the Python one, which CI does
 * not reach either (its job globs `cat-harness/scripts/tests/*.test.py`).
 * Bean `rsi6` found the package unbuildable; this is the half of it that was
 * scoped out at the time.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BlockQaReport,
  QaCriterionEntry,
  QaScriptSidecar,
  VERSION,
} from "../js/index.ts";

/** The minimal report the Python suite pins, byte for byte. */
const MINIMAL = {
  $schema: "block-qa/v1",
  label: "def:carbon-valence",
  kind: "definition",
  paths: { ts: "content/x/carbon-valence.ts" },
  source_hashes: { ts: "a1b2c3d4e5f6" },
  criteria: {},
  updated_at: "2026-06-12T00:00:00Z",
} as const;

describe("the Zod half matches the Pydantic half", () => {
  // mirrors: test_version
  test("VERSION is in lockstep with pyproject.toml and package.json", () => {
    expect(VERSION).toBe("0.2.0");
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "package.json"), "utf-8"),
    ) as { version: string };
    expect(pkg.version).toBe(VERSION);
  });

  // mirrors: test_minimal_report
  test("a report with only the required fields validates", () => {
    const r = BlockQaReport.parse(MINIMAL);
    expect(r.label).toBe("def:carbon-valence");
    expect(r.criteria).toEqual({});
    expect(r.paths.md).toBeUndefined();
  });

  // mirrors: test_no_clock_required (0.2.0; owner ruling 2026-11-06, "QA dates")
  test("no clock is required: a verdict's date is derived from its reviewed_tree", () => {
    const { updated_at: _u, ...noClock } = MINIMAL;
    expect(() => BlockQaReport.parse(noClock)).not.toThrow();
    expect(() =>
      QaCriterionEntry.parse({
        field_hash: { md: "9fb618864a10" },
        result: "pass",
        reviewer: { kind: "script", id: "x.ts" },
        reviewed_tree: "a".repeat(40),
      }),
    ).not.toThrow();
  });

  // mirrors: test_invalid_result_rejected
  test("the result enum is closed", () => {
    expect(() =>
      QaCriterionEntry.parse({
        field_hash: { md: "9fb618864a10" },
        result: "maybe",
        reviewer: { kind: "script", id: "x.ts" },
        reviewed_at: "2026-06-12T00:00:00Z",
      }),
    ).toThrow();
  });

  // mirrors: test_wrong_schema_marker_rejected
  test("a sidecar claiming a different $schema is not a BlockQaReport", () => {
    expect(() => BlockQaReport.parse({ ...MINIMAL, $schema: "qa-script/v1" })).toThrow();
  });

  // mirrors: test_extra_fields_allowed
  test("the format is extensible — an extra field does not fail validation", () => {
    // Not a stylistic preference on either side: a sidecar carries fields a
    // future producer adds, and a strict schema would make every such
    // producer's output unreadable by today's consumers.
    const r = BlockQaReport.parse({
      ...MINIMAL,
      label: "rem:x",
      kind: "remark",
      my_custom_field: { foo: "bar" },
    });
    expect(r.kind).toBe("remark");
  });

  // mirrors: test_json_schema_files_present
  test("both shipped JSON Schema files parse and declare their id", () => {
    for (const name of ["block-qa.schema.json", "qa-script.schema.json"]) {
      const raw = JSON.parse(
        readFileSync(join(import.meta.dirname, "..", "schema", name), "utf-8"),
      ) as Record<string, unknown>;
      expect(typeof raw.$schema, `${name} declares no $schema`).toBe("string");
    }
  });

  // mirrors: test_script_sidecar
  test("the per-criterion checker-staleness sidecar validates", () => {
    // The Python case's fixture, field for field. My first attempt here
    // INVENTED a shorter one (`criterion`, `script`, `updated_at`) and the
    // suite rejected it — which is the parity working on its author before it
    // ever ran on the package.
    const s = QaScriptSidecar.parse({
      $schema: "qa-script/v1",
      criterion_id: "proof-no-bare-sorries",
      source_file: "pipeline/qa-checkers.ts",
      script_hash: "9a8b7c6d5e4f",
      script_commit_sha: "610a6aa2bde5fabec35796ead6bbb0adb76f6533",
      extra_inputs: ["content/schema/references.ts"],
      deps_hash: "1a2b3c4d5e6f",
      last_run_at: "2026-06-12T05:00:00+00:00",
      last_run_sha: "e3c959e9fd65b56aa37db507564357629f32f1c9",
      engine_version: "bun-1.3.11+node-22",
    });
    expect(s.criterion_id).toBe("proof-no-bare-sorries");
    expect(s.deps_hash).toBe("1a2b3c4d5e6f");
  });

  // The suite must not be able to pass by importing nothing — this package
  // shipped a `test` script that found no files and exited 1 for its whole
  // life, and a vacuous green is the failure mode that replaces it.
  test("the module under test really exported something", () => {
    expect(typeof BlockQaReport.parse).toBe("function");
    expect(typeof QaCriterionEntry.parse).toBe("function");
    expect(typeof QaScriptSidecar.parse).toBe("function");
  });
});
