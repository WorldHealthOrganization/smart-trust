/**
 * The downstream-tool criterion family — bean `fq5u`.
 *
 * The three-state read, the per-Tool verdict and the undeclared-tool finding,
 * each asserted on a case built to break it.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { existsSync } from "../../test/support/site-fs.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { downstreamState, listToolRuns, readToolRun, writeToolRun, TOOL_RUNS_DIR, UNKNOWN_FINGERPRINT, type ToolRunRecord } from "../../schemas/tools/tool-run.ts";
import type { ToolDefinition } from "../../schemas/tools/tool.ts";
import { MEMBERS, toolDownstreamEntry, undeclaredDownstreamEntry } from "../downstream-runs";
import { tools } from "../../tools/discover";
import { VERIFIERS } from "../publish-verify";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ok = (fp: string): ToolRunRecord => ({ $schema: "folio-tool-run/v1", tool: "x", target: "t", outcome: "succeeded", inputFingerprint: fp });

describe("the three-state read", () => {
  test("fresh ONLY for a successful run over the current inputs", () => {
    expect(downstreamState(ok("a"), "a")).toBe("fresh");
    expect(downstreamState(ok("a"), "b")).toBe("stale");
  });
  test("no record is NOT-RUN and a failed run is FAILED — never green", () => {
    expect(downstreamState(undefined, "a")).toBe("not-run");
    expect(downstreamState({ ...ok("a"), outcome: "failed" }, "a")).toBe("failed");
  });
  test("an unknown fingerprint matches nothing, not even another unknown", () => {
    expect(downstreamState(ok(UNKNOWN_FINGERPRINT), UNKNOWN_FINGERPRINT)).toBe("stale");
  });
  test("a record round-trips, and rewriting identical content is a no-op", () => {
    const root = mkdtempSync(join(tmpdir(), "tool-run-"));
    writeToolRun(root, { tool: "x", target: "a/b", outcome: "succeeded", inputFingerprint: "f" });
    expect(readToolRun(root, "x", "a/b")?.inputFingerprint).toBe("f");
    const l = listToolRuns(root);
    expect(l.state === "hit" ? l.runs.map((r) => r.path) : l).toEqual([join("test", "results", "tool-runs", "x", "a", "b.tool-run.json")]);
  });
});

const tool = (downstream?: ToolDefinition["downstream"], id = "t"): ToolDefinition =>
  ({ id, downstream }) as unknown as ToolDefinition;

describe("the per-Tool verdict", () => {
  test("n/a for a Tool that declares no downstream output", () => {
    expect(toolDownstreamEntry(tool(), []).result).toBe("n/a");
  });
  test("an output judged only in the published tree is UNKNOWN naming its verifier — never pass", () => {
    const e = toolDownstreamEntry(tool({ output: "o", inputs: ["i"], judgedAt: "published", verifier: "v" }), ["v"]);
    expect(e.result).toBe("unknown");
    expect(e.findings[0]!.detail).toContain("`v`");
  });
  test("...and FAILS when that verifier is not in the set", () => {
    expect(toolDownstreamEntry(tool({ output: "o", inputs: ["i"], judgedAt: "published", verifier: "gone" }), ["v"]).result).toBe("fail");
  });
  test("a checkout-judged declaration with no member reader cannot be judged: UNKNOWN", () => {
    expect(toolDownstreamEntry(tool({ output: "o", inputs: ["i"], judgedAt: "checkout" }, "no-member"), []).result).toBe("unknown");
  });
});

/** A layer root whose record directory exists and is empty: a determined "no records". */
const emptyListed = (): string => {
  const root = mkdtempSync(join(tmpdir(), "tool-run-"));
  mkdirSync(join(root, TOOL_RUNS_DIR), { recursive: true });
  return root;
};

describe("a downstream tool with no declaration is a finding", () => {
  test("a run record naming an undeclared Tool", () => {
    const root = mkdtempSync(join(tmpdir(), "tool-run-"));
    writeToolRun(root, { tool: "ghost", target: "t", outcome: "succeeded", inputFingerprint: "f" });
    const e = undeclaredDownstreamEntry([], root, []);
    expect(e.result).toBe("fail");
    expect(e.findings.some((x) => x.detail.includes('Tool "ghost"'))).toBe(true);
  });
  test("a publish verifier naming an undeclared Tool", () => {
    expect(undeclaredDownstreamEntry([], emptyListed(), [{ id: "v", tool: "ghost" }]).findings.some((x) => x.where === "v")).toBe(true);
  });
  test("a member reader with no declaring Tool", () => {
    const e = undeclaredDownstreamEntry([], emptyListed(), []);
    expect(e.result).toBe("fail");
    expect(e.findings.map((x) => x.where)).toEqual(Object.keys(MEMBERS));
  });
  test("THIS repository declares every member and every verifier's Tool — or says it could not see the records", () => {
    const root = join(HARNESS_ROOT);
    const e = undeclaredDownstreamEntry(tools(), root, VERIFIERS.map((v) => ({ id: v.id, tool: v.tool })));
    // With the records moved to the qa-reports branch and not fetched, the
    // record half is not asked: `unknown`, never the pass this asserts below.
    if (!existsSync(join(root, TOOL_RUNS_DIR))) expect(e.result).toBe("unknown");
    else expect(e).toEqual({ result: "pass", findings: [] });
  });
});

describe("records that are not in the checkout are UNKNOWN, never an empty list (bean oq1j)", () => {
  test("listToolRuns over an unfetched store reports unknown, not an empty list", () => {
    const root = mkdtempSync(join(tmpdir(), "tool-run-"));
    const l = listToolRuns(root);
    expect(l.state).toBe("unknown");
    expect("runs" in l).toBe(false);
    if (l.state === "unknown") expect(l.reason).toContain("qa:fetch");
  });
  test("an EXISTING empty directory is a determined empty", () => {
    expect(listToolRuns(emptyListed())).toEqual({ state: "hit", runs: [] });
  });
  test("the criterion is UNKNOWN when the records were not examined, even with nothing else wrong", () => {
    const root = mkdtempSync(join(tmpdir(), "tool-run-"));
    const declaring = Object.keys(MEMBERS).map((id) => tool({ output: "o", inputs: ["i"], judgedAt: "checkout" }, id));
    const e = undeclaredDownstreamEntry(declaring, root, []);
    expect(e.result).toBe("unknown");
    expect(e.findings.map((f) => f.detail).join(" ")).toContain("not examined");
  });
  test("...and UNKNOWN outranks a finding the other halves made", () => {
    const e = undeclaredDownstreamEntry([], mkdtempSync(join(tmpdir(), "tool-run-")), []);
    expect(e.result).toBe("unknown");
    expect(e.findings.length).toBe(Object.keys(MEMBERS).length + 1);
  });
});
