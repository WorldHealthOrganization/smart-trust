/**
 * stage-workflow-local: an agent replays the staging workflow's own steps
 * (owner, 2026-11-01, Q-ABP-1 A; folio-assistant#2881).
 */
import { describe, test, expect } from "bun:test";
import { evaluate, interpolate, parseCommandFile, stepRuns, usesKind, type ExprContext } from "../../stage-workflow-local.ts";

function ctx(values: Record<string, unknown>, failed = false): ExprContext {
  return {
    failed,
    lookup: (path) => {
      let v: unknown = values;
      for (const k of path) v = v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined;
      return (v ?? "") as never;
    },
  };
}

describe("expressions, as Actions evaluates them", () => {
  const c = ctx({ github: { event_name: "pull_request", sha: "abc" }, inputs: { verify_pr: "", branch: "b" }, steps: { carry: { outputs: { api: "yes" } } }, vars: { WRITER_SKIP: "" } });
  test("the checkout ref picks the merge sha on a PR", () => {
    expect(evaluate("github.event_name == 'pull_request' && github.sha || (inputs.verify_pr != '' && format('refs/pull/{0}/merge', inputs.verify_pr)) || inputs.branch || github.ref", c)).toBe("abc");
  });
  test("an empty input equals '' and a missing one does too", () => {
    expect(evaluate("inputs.verify_pr == ''", c)).toBe(true);
    expect(evaluate("inputs.nothing == ''", c)).toBe(true);
  });
  test("&& and || return values, not booleans", () => {
    expect(evaluate("vars.WRITER_SKIP != 'off' && '1' || ''", c)).toBe("1");
  });
  test("string comparison ignores case, as Actions does", () => {
    expect(evaluate("steps.carry.outputs.api == 'YES'", c)).toBe(true);
  });
  test("interpolation substitutes every ${{ }}", () => {
    expect(interpolate("name (staging: ${{ inputs.branch }}) at ${{ github.sha }}", c)).toBe("name (staging: b) at abc");
  });
  test("an unknown function refuses rather than guessing", () => {
    expect(() => evaluate("fromJSON('1')", c)).toThrow("not replayed");
  });
});

describe("a step's if", () => {
  test("no status function means success() && (…)", () => {
    expect(stepRuns("github.event_name == 'pull_request'", ctx({ github: { event_name: "pull_request" } }))).toBe(true);
    expect(stepRuns("github.event_name == 'pull_request'", ctx({ github: { event_name: "pull_request" } }, true))).toBe(false);
  });
  test("!cancelled() runs after a failure", () => {
    expect(stepRuns("${{ !cancelled() }}", ctx({}, true))).toBe(true);
  });
  test("no if runs only while nothing has failed", () => {
    expect(stepRuns(undefined, ctx({}))).toBe(true);
    expect(stepRuns(undefined, ctx({}, true))).toBe(false);
  });
});

describe("$GITHUB_OUTPUT and $GITHUB_ENV", () => {
  test("k=v lines and heredoc blocks", () => {
    expect(parseCommandFile("a=1\nb=x=y\nc<<EOF\nl1\nl2\nEOF\n")).toEqual({ a: "1", b: "x=y", c: "l1\nl2" });
  });
});

describe("marketplace actions", () => {
  test("each one the staging workflow uses has a replay", () => {
    expect(usesKind("actions/checkout@abc")).toBe("checkout");
    expect(usesKind("actions/cache/restore@abc")).toBe("skip");
    expect(usesKind("./.github/actions/typedoc-api")).toBe("local");
  });
  test("an unknown action refuses", () => {
    expect(() => usesKind("someone/else@v1")).toThrow("no local replay");
  });
});
