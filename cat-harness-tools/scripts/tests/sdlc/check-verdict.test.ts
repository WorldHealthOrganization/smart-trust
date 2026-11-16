/**
 * The three states, and the two bugs that made them two.
 *
 * @module scripts/tests/check-verdict
 *
 * Every fixture is SYNTHETIC. The subject is a classification, so reading the
 * real API would test GitHub's current weather rather than this code — and a
 * test that passes or fails on whichever runs happen to exist today is the
 * `9x9r` shape one corpus over.
 *
 * The property under test is that `pass`, `fail`, `pending` and `undetermined`
 * stay FOUR answers. Both bugs this module was written for were collapses:
 * `cancelled` folded into failure (reporting a green `main` as red), and
 * `stale` folded into failure for the same reason one draft later.
 */
import { describe, expect, test } from "bun:test";
import {
  exitCodeFor,
  explainSuperseded,
  verdictOf,
  type CheckRun,
} from "../../../src/workflow/check-verdict.js";

const done = (name: string, conclusion: string): CheckRun => ({ name, status: "completed", conclusion });
const running = (name: string): CheckRun => ({ name, status: "in_progress", conclusion: null });

describe("verdictOf — the four states stay four", () => {
  test("every check clean is a PASS", () => {
    expect(verdictOf([done("a", "success"), done("b", "skipped")]).state).toBe("pass");
  });

  test("`neutral` is clean — it is a verdict of 'nothing to say', not a failure", () => {
    expect(verdictOf([done("a", "neutral")]).state).toBe("pass");
  });

  test("a CANCELLED run is UNDETERMINED, not a failure — the bug this exists for", () => {
    // Measured on `main` @ 3d2c7fbe869, 2026-09-30: every hard gate green and
    // one cancelled `build-and-deploy`. The two-state version said FAIL.
    const v = verdictOf([done("Repository gates (hard)", "success"), done("build-and-deploy", "cancelled")]);
    expect(v.state).toBe("undetermined");
    expect(v.names).toEqual(["build-and-deploy"]);
  });

  test("a STALE run is UNDETERMINED too — GitHub marks it when a NEWER run supersedes", () => {
    // The second bug, found while falsifying the first: `stale` was classified
    // as a failure, which is the same collapse wearing a different word.
    expect(verdictOf([done("a", "success"), done("b", "stale")]).state).toBe("undetermined");
  });

  test("a FAILURE beside a cancellation is still a FAIL — failure wins", () => {
    const v = verdictOf([done("a", "failure"), done("b", "cancelled")]);
    expect(v.state).toBe("fail");
    expect(v.names).toEqual(["a"]);
  });

  test("PENDING beats cancelled — an in-flight run may yet fail, so nothing is concluded", () => {
    expect(verdictOf([running("a"), done("b", "cancelled")]).state).toBe("pending");
  });

  test("`timed_out` and `action_required` are failures", () => {
    expect(verdictOf([done("a", "timed_out")]).state).toBe("fail");
    expect(verdictOf([done("a", "action_required")]).state).toBe("fail");
  });
});

describe("the vacuous cases — `dh4f`, where nothing looked and it read as clean", () => {
  test("NO check runs is UNDETERMINED, never a pass", () => {
    const v = verdictOf([]);
    expect(v.state).toBe("undetermined");
    expect(v.because).toContain("NOT a pass");
  });

  test("an unreadable response is UNDETERMINED, never a pass", () => {
    const v = verdictOf(undefined);
    expect(v.state).toBe("undetermined");
    expect(v.because).toContain("NOT a pass");
  });

  test("only teardown jobs is UNDETERMINED — they carry no verdict about the tree", () => {
    // `cleanup` and `cleanup-dispatch` report `skipped` on every ordinary run.
    // Counting them would make a commit with no real checks read as green.
    const v = verdictOf([done("cleanup", "skipped"), done("cleanup-dispatch", "skipped")]);
    expect(v.state).toBe("undetermined");
  });

  test("a teardown job does NOT mask a real failure beside it", () => {
    expect(verdictOf([done("cleanup", "skipped"), done("a", "failure")]).state).toBe("fail");
  });
});

describe("explainSuperseded — WHOSE contention, which the check run cannot say", () => {
  test("the branch HAS moved: name the superseding commit and where to look next", () => {
    const s = explainSuperseded(["aaa older", "bbb newer"]);
    expect(s).toContain("bbb newer");
    expect(s).toContain("Judge the newer commit instead");
  });

  test("the branch has NOT moved: refuse to assume concurrency", () => {
    // The whole point. An unexplained cancellation is a thing to look at, and
    // "probably concurrency" is the guess this module exists to refuse.
    const s = explainSuperseded([]);
    expect(s).toContain("has NOT moved");
    expect(s).not.toContain("concurrency, not a failure");
  });
});

describe("exitCodeFor — undetermined has its OWN code, and it is never 0", () => {
  test("pass 0, fail 1, undetermined 2, pending 2", () => {
    expect(exitCodeFor("pass")).toBe(0);
    expect(exitCodeFor("fail")).toBe(1);
    expect(exitCodeFor("undetermined")).toBe(2);
    expect(exitCodeFor("pending")).toBe(2);
  });

  test("no state maps to 0 except pass — asserted as an ABSENCE", () => {
    // A caller that treats "not 1" as success is the two-state collapse
    // rebuilt at the call site, so the exit codes have to carry the third
    // state as well as the report does.
    const states = ["pass", "fail", "pending", "undetermined"] as const;
    expect(states.filter((s) => exitCodeFor(s) === 0)).toEqual(["pass"]);
  });
});
