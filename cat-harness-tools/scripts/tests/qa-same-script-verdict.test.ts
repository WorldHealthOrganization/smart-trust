import { describe, expect, test } from "bun:test";
import { sameScriptVerdict } from "../../pipeline/qa-utils";
import type { QaCriterionEntry } from "../../schemas/sdlc/block-qa.ts";

function entry(over: Partial<QaCriterionEntry> = {}): QaCriterionEntry {
  return {
    field_hash: { md: "aaaaaaaaaaaa", ts: "bbbbbbbbbbbb" },
    result: "pass",
    reviewer: {
      kind: "script",
      id: "pipeline/qa-checkers-voice.ts",
      version: "v1",
      script_hash: "111111111111",
      script_commit_sha: "cafebabecafebabecafebabecafebabecafebabe",
    },
    reviewed_at: "2026-01-01T00:00:00.000Z",
    reviewed_sha: "1111111111111111111111111111111111111111",
    ...over,
  } as QaCriterionEntry;
}

describe("sameScriptVerdict", () => {
  test("a re-run that reproduces the verdict is not a change", () => {
    // Only the timestamps differ, which is what a no-op sweep produces.
    const prior = entry();
    const fresh = entry({
      reviewed_at: "2026-08-09T12:00:00.000Z",
      reviewed_sha: "2222222222222222222222222222222222222222",
    });
    expect(sameScriptVerdict(prior, fresh)).toBe(true);
  });

  test("a moved verdict is a change", () => {
    expect(sameScriptVerdict(entry(), entry({ result: "fail" }))).toBe(false);
  });

  test("moved inputs are a change even at the same verdict", () => {
    // Same `pass`, but computed from different content — the sidecar must
    // record the new field_hash or it would claim to have checked the old text.
    const fresh = entry({ field_hash: { md: "cccccccccccc", ts: "bbbbbbbbbbbb" } });
    expect(sameScriptVerdict(entry(), fresh)).toBe(false);
  });

  test("a changed checker is a change", () => {
    const fresh = entry({
      reviewer: { ...entry().reviewer, script_hash: "999999999999" },
    });
    expect(sameScriptVerdict(entry(), fresh)).toBe(false);
  });

  test("changed evidence, notes, metrics or severity are changes", () => {
    for (const over of [
      { notes: "different" },
      { evidence: "a.md:1: x" },
      { metrics: { energy: 2 } },
      { severity: "critical" },
    ] as Partial<QaCriterionEntry>[]) {
      expect(sameScriptVerdict(entry(), entry(over))).toBe(false);
    }
  });

  test("script_commit_sha alone is NOT a change", () => {
    // It is a FILE-level pointer: it moves when a neighbouring criterion is
    // edited. Treating it as a change would reintroduce exactly the file-level
    // coupling that per-criterion script_hash removes.
    const fresh = entry({
      reviewer: {
        ...entry().reviewer,
        script_commit_sha: "0000000000000000000000000000000000000000",
      },
    });
    expect(sameScriptVerdict(entry(), fresh)).toBe(true);
  });

  test("no prior entry is always a change", () => {
    expect(sameScriptVerdict(undefined, entry())).toBe(false);
  });
});
