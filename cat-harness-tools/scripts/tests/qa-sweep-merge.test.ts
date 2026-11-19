/**
 * Regression tests for the qa-sweep script-entry REPLACE behaviour.
 *
 * A `qa-sweep` re-run is a REFRESH of the deterministic (`kind: "script"`)
 * verdict — NOT a new opinion. It must therefore REPLACE the prior script
 * entry for a criterion rather than append a duplicate, so `<block>.qa.json`
 * criterion arrays do not grow unboundedly on every sweep. Agent-kind
 * entries (the multi-reviewer audit trail) and human-kind entries (final
 * authority) are always preserved.
 *
 * The write step qa-sweep performs at each of its three sidecar-write sites
 * is `report.criteria[c] = [...preserveNonScriptEntries(existing), entry]`.
 * `sweepWrite` below reproduces exactly that step, so running it twice on the
 * same criterion array models "two consecutive sweeps of one unchanged block".
 *
 * Covers the acceptance criteria in the task requirements:
 *   §5.1 — array length stable across two consecutive sweeps (no growth)
 *   §5.2 — a pre-existing human entry is retained
 *   §5.3 — a pre-existing agent entry is retained (agents still append)
 *   §5.4 — [script_stale, agent] → [agent, script_fresh] (one script, agent kept)
 *
 * Run via the standard `bun test` harness:
 *
 *     ./scripts/tests/run-tests.sh
 *     # or
 *     cd scripts/tests && bun test qa-sweep-merge.test.ts
 */
import { describe, test, expect } from "bun:test";
import {
  preserveNonScriptEntries,
  insertAdjudication,
} from "../../pipeline/qa-utils.ts";
import type {
  QaCriterionEntry,
  QaReviewerKind,
} from "../../schemas/sdlc/block-qa.ts";

// ── fixture builders ─────────────────────────────────────────────

function entry(
  kind: QaReviewerKind,
  opts: { result?: QaCriterionEntry["result"]; tag?: string } = {},
): QaCriterionEntry {
  return {
    field_hash: { md: opts.tag ?? "aaaaaaaaaaaa" },
    result: opts.result ?? "pass",
    reviewer: {
      kind,
      id:
        kind === "script"
          ? "pipeline/qa-checkers-voice.ts"
          : kind === "agent"
            ? "claude:one-voice-integration-watcher"
            : "litlfred",
      version: "v1",
    },
    reviewed_at: "2026-07-04T00:00:00.000Z",
    reviewed_sha: "0".repeat(40),
  };
}

/**
 * Reproduce the exact write step qa-sweep performs: drop the prior
 * script entry, append the fresh script entry. Returns the new array.
 */
function sweepWrite(
  existing: QaCriterionEntry[],
  fresh: QaCriterionEntry,
): QaCriterionEntry[] {
  return [...preserveNonScriptEntries(existing), fresh];
}

// ── preserveNonScriptEntries — unit ──────────────────────────────

describe("preserveNonScriptEntries", () => {
  test("drops every script entry, keeps agent + human", () => {
    const kept = preserveNonScriptEntries([
      entry("script"),
      entry("agent"),
      entry("script"),
      entry("human"),
    ]);
    expect(kept.map((e) => e.reviewer.kind)).toEqual(["agent", "human"]);
  });

  test("empty array stays empty", () => {
    expect(preserveNonScriptEntries([])).toEqual([]);
  });

  test("does not mutate its input", () => {
    const input = [entry("script"), entry("agent")];
    const before = input.length;
    preserveNonScriptEntries(input);
    expect(input.length).toBe(before);
  });

  test("does not throw on malformed / legacy sidecar entries; preserves them", () => {
    // Sidecars are external JSON that loadQaReport does not shape-validate,
    // so a hand-edited / legacy entry may be null or lack a `reviewer`.
    // preserveNonScriptEntries must not crash, and (being unable to prove
    // such an entry is a script entry) must PRESERVE it rather than drop it
    // — dropping a malformed human entry would break "human always preserved".
    const malformed = [
      null,
      undefined,
      {} as unknown, // no reviewer
      { reviewer: {} } as unknown, // reviewer without kind
      entry("script"),
      entry("human"),
    ] as unknown as QaCriterionEntry[];
    const kept = preserveNonScriptEntries(malformed);
    // the one well-formed script entry is dropped; everything else kept
    expect(kept.length).toBe(malformed.length - 1);
    expect(kept).toContain(malformed[5]); // human preserved
    expect(kept).not.toContain(malformed[4]); // script dropped
  });
});

// ── the REPLACE-not-append invariant (task §5) ───────────────────

describe("qa-sweep script-entry REPLACE (task §5)", () => {
  test("§5.1 — array length is stable across two consecutive sweeps", () => {
    // Sweep run 1 on a fresh (empty) criterion array.
    const run1 = sweepWrite([], entry("script", { tag: "sha_run1" }));
    // Sweep run 2 on the SAME (unchanged) block re-runs the checker and
    // writes a fresh script entry (fresh reviewed_at / field_hash).
    const run2 = sweepWrite(run1, entry("script", { tag: "sha_run2" }));

    expect(run1.length).toBe(1);
    // No growth: run 2 must not add a second script entry.
    expect(run2.length).toBe(run1.length);
    expect(run2.filter((e) => e.reviewer.kind === "script").length).toBe(1);
  });

  test("§5.2 — a pre-existing human entry is retained after a sweep", () => {
    const start = [entry("human", { result: "fail" }), entry("script")];
    const after = sweepWrite(start, entry("script", { tag: "fresh" }));
    expect(after.filter((e) => e.reviewer.kind === "human").length).toBe(1);
    expect(after.filter((e) => e.reviewer.kind === "script").length).toBe(1);
  });

  test("§5.3 — a pre-existing agent entry is retained (agents still append)", () => {
    const start = [entry("agent")];
    const after = sweepWrite(start, entry("script", { tag: "fresh" }));
    expect(after.map((e) => e.reviewer.kind)).toEqual(["agent", "script"]);
  });

  test("§5.4 — [script_stale, agent] → [agent, script_fresh]", () => {
    const start = [
      entry("script", { tag: "stale" }),
      entry("agent"),
    ];
    const after = sweepWrite(start, entry("script", { tag: "fresh" }));
    expect(after.map((e) => e.reviewer.kind)).toEqual(["agent", "script"]);
    // exactly one script entry, and it is the fresh one
    const scripts = after.filter((e) => e.reviewer.kind === "script");
    expect(scripts.length).toBe(1);
    expect(scripts[0].field_hash.md).toBe("fresh");
  });

  test("multiple agent entries all survive a script sweep", () => {
    const start = [entry("agent"), entry("agent"), entry("script")];
    const after = sweepWrite(start, entry("script", { tag: "fresh" }));
    expect(after.filter((e) => e.reviewer.kind === "agent").length).toBe(2);
    expect(after.filter((e) => e.reviewer.kind === "script").length).toBe(1);
    // Repeated sweeps never grow the agent count or the script count.
    const after2 = sweepWrite(after, entry("script", { tag: "fresher" }));
    expect(after2.length).toBe(after.length);
  });
});

/**
 * The merge side of the same invariant. §5.4 above fixes the order a SWEEP
 * writes; this fixes the order an ADJUDICATION is written in, which is what
 * decides the verdict when the script entry is fresh and the sweep never
 * re-runs.
 */
describe("insertAdjudication — an adjudication leads its criterion", () => {
  test("[script] + agent → [agent, script]", () => {
    const out = insertAdjudication(
      [entry("script", { result: "fail", tag: "s" })],
      entry("agent", { result: "pass", tag: "a" }),
    );
    expect(out.map((e) => e.reviewer.kind)).toEqual(["agent", "script"]);
    // `list[0]` is what `qa-witness.projectEntryArrays` reads.
    expect(out[0]!.result).toBe("pass");
  });

  test("the script entry is KEPT — a disagreement stays legible", () => {
    const out = insertAdjudication(
      [entry("script", { result: "fail" })],
      entry("agent", { result: "pass" }),
    );
    expect(out).toHaveLength(2);
    expect(out[1]!.result).toBe("fail");
  });

  test("with no script entry it appends, preserving reviewer history order", () => {
    // Two DISTINCT agent reviewers: the multi-reviewer trail is history and both
    // are kept, in order. (One reviewer entered twice is a supersession, not
    // history — see the describe block below.)
    const first = entry("agent", { tag: "first" });
    first.reviewer.id = "watcher-a";
    const second = entry("agent", { tag: "second" });
    second.reviewer.id = "watcher-b";
    const out = insertAdjudication([first], second);
    // `tag` lands in `field_hash.md` in this fixture, which is what
    // distinguishes the two agent entries.
    expect(out.map((e) => e.field_hash.md)).toEqual(["first", "second"]);
  });

  test("an existing agent entry still precedes the new one, both before script", () => {
    const out = insertAdjudication(
      [entry("agent", { tag: "old" }), entry("script", { result: "fail" })],
      entry("human", { result: "pass", tag: "new" }),
    );
    expect(out.map((e) => e.reviewer.kind)).toEqual(["agent", "human", "script"]);
  });

  test("a sweep after a merge is order-stable — the two writers agree", () => {
    // The composition that was broken: merge an adjudication, then sweep.
    // Both steps must leave the adjudication leading.
    const merged = insertAdjudication(
      [entry("script", { result: "fail" })],
      entry("agent", { result: "pass" }),
    );
    const swept = [
      ...preserveNonScriptEntries(merged),
      entry("script", { result: "fail", tag: "fresh" }),
    ];
    expect(swept.map((e) => e.reviewer.kind)).toEqual(["agent", "script"]);
    expect(swept[0]!.result).toBe("pass");
  });
});

describe("insertAdjudication — a reviewer supersedes their own earlier entry", () => {
  const agent = (tag: string, result: QaCriterionEntry["result"] = "pass") => {
    const e = entry("agent", { result, tag });
    e.reviewer.id = "voice-editorial-review";
    return e;
  };

  test("a re-adjudication replaces the reviewer's own earlier one", () => {
    const out = insertAdjudication(
      [agent("old"), entry("script", { result: "fail" })],
      agent("new"),
    );
    expect(out.map((e) => e.reviewer.kind)).toEqual(["agent", "script"]);
    expect(out[0]!.field_hash.md).toBe("new");
  });

  test("a DIFFERENT reviewer's entry is history and is kept", () => {
    const other = entry("agent", { tag: "other" });
    other.reviewer.id = "one-voice-integration-watcher";
    const out = insertAdjudication(
      [other, entry("script", { result: "fail" })],
      agent("mine"),
    );
    expect(out).toHaveLength(3);
    // The earlier reviewer keeps the lead: among DIFFERENT reviewers the order is
    // history, and only the script entry is required to trail. Changing that
    // would be a separate decision about which of two disagreeing agents wins,
    // and this change is only about a reviewer superseding THEMSELVES.
    expect(out.map((e) => e.reviewer.id)).toEqual([
      "one-voice-integration-watcher",
      "voice-editorial-review",
      "pipeline/qa-checkers-voice.ts",
    ]);
  });

  test("a human entry is never displaced by an agent one", () => {
    const human = entry("human", { result: "fail", tag: "authority" });
    const out = insertAdjudication([human, entry("script")], agent("mine"));
    expect(out.some((e) => e.reviewer.kind === "human")).toBe(true);
    expect(out).toHaveLength(3);
  });
});
