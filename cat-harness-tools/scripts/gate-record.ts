/**
 * A tree-keyed record of a local gate run: which tree was judged, which gates
 * the set held, how each came out, and with which tools.
 *
 * Written by `scripts/pre-push-gates.ts` after `bun run cat gates` passes on
 * the tree being pushed. Its one reader is the next push of the same tree
 * (the Claude Code hook runs before `git push`, then git's own pre-push hook
 * runs inside it): a record that covers the tree means the gates are not
 * asked twice.
 *
 * The record never leaves the machine. CI never honours a committer's local
 * gate record (owner's ruling, 2026-11-06): it runs every gate itself, so the
 * record is not attached to the commit and nothing here is pushed.
 *
 * Only a PASS is recorded. A record is a claim that the gates are green on
 * this tree, so a fail, a not-clean run or an undetermined one leaves no
 * record and everything downstream runs as if there were none.
 *
 * Why the tree and not the commit: the gates judge files, and the same tree
 * reached by a rebase or an amend of the message is the same judgment. Why
 * the Bun version: the same tree under another runtime is not the same run.
 * The workflow and `bun.lock` are files of the tree, so the gate list and the
 * dependency set are fixed by the key already.
 *
 * Deliberately free of package imports, so the git hook runs it in a checkout
 * that has not installed anything.
 *
 * @module scripts/gate-record
 * @graphNode none — a helper of the pre-push hook, not a gate itself
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

export const LOCAL_GATE_RECORD_SCHEMA = "cat-local-gate-record/v1";

/** What `bun run cat gates --report` writes (`schemas/sdlc/gates-report.ts`), the fields read here. */
export interface GatesReportLike {
  $schema: string;
  outcome: "pass" | "fail" | "not-clean" | "undetermined";
  exitCode: 0 | 1 | 2;
  set: "fast" | "whole";
  gates: number;
  commands?: string[];
  heldOut?: string[];
  failed: { command: string; job: string; step: string; why: string[] }[];
  skipped: { command: string; why: string }[];
  mutatedBy?: string[];
  undetermined: string[];
}

export interface ToolVersions {
  bun: string;
  git: string;
  platform: string;
}

export interface LocalGateRecord {
  $schema: typeof LOCAL_GATE_RECORD_SCHEMA;
  /** The tree judged: `git rev-parse <commit>^{tree}`. The key. */
  tree: string;
  /** The commit the run was made for. Informative only; the tree is the key. */
  commit: string;
  set: "fast" | "whole";
  outcome: "pass";
  /** Every gate in the set, in workflow order. */
  gates: string[];
  /** Gates of the set this run did not run (`gates --except`): the record does not cover them, CI runs them. */
  heldOut: string[];
  /**
   * The affected-test selection that ran in place of a held-out whole suite
   * (`scripts/affected-tests.ts`): what it ran, and that it passed. Never the
   * suite's verdict.
   */
  affectedTests?: { files: number; passed: boolean } | { all: string };
  /** Gates not asked because the input-hash cache (bean `f017`) holds a pass on identical inputs. */
  skipped: { command: string; why: string }[];
  tools: ToolVersions;
  /** `agent` when a Claude Code session ran it (CLAUDECODE set), else `human`. */
  runBy: "agent" | "human";
  startedAt: string;
  finishedAt: string;
}

/** Run git in `root`; the trimmed stdout, or undefined when git exits non-zero. */
export function git(root: string, args: readonly string[]): string | undefined {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

/** The directory records and logs live in: `<common git dir>/cat-gates`, shared by every worktree. */
export function stateDir(root: string): string {
  const common = git(root, ["rev-parse", "--git-common-dir"]);
  if (common === undefined) throw new Error(`${root} is not inside a git repository`);
  return join(resolve(root, common), "cat-gates");
}

export function treeOf(root: string, rev: string): string | undefined {
  return git(root, ["rev-parse", "--verify", "--quiet", `${rev}^{tree}`]);
}

export function toolVersions(root: string): ToolVersions {
  return {
    bun: typeof Bun !== "undefined" ? Bun.version : "none",
    git: (git(root, ["--version"]) ?? "unknown").replace(/^git version /, ""),
    platform: `${process.platform}-${process.arch}`,
  };
}

export function recordPath(root: string, tree: string): string {
  if (!/^[0-9a-f]{40,64}$/.test(tree)) throw new Error(`not a tree id: ${tree}`);
  return join(stateDir(root), "records", `${tree}.json`);
}

/** The record for a passing report, or undefined when the report is not a pass. */
export function buildRecord(
  report: GatesReportLike,
  ctx: { tree: string; commit: string; tools: ToolVersions; runBy: "agent" | "human"; startedAt: string; finishedAt: string },
): LocalGateRecord | undefined {
  if (report.outcome !== "pass" || report.exitCode !== 0) return undefined;
  // A pass over a set nobody can name is not something to vouch for: the
  // record has to say what it covers.
  if (report.commands === undefined || report.commands.length !== report.gates || report.gates === 0) return undefined;
  return {
    $schema: LOCAL_GATE_RECORD_SCHEMA,
    tree: ctx.tree,
    commit: ctx.commit,
    set: report.set,
    outcome: "pass",
    gates: [...report.commands],
    heldOut: [...(report.heldOut ?? [])],
    skipped: report.skipped.map((s) => ({ command: s.command, why: s.why })),
    tools: ctx.tools,
    runBy: ctx.runBy,
    startedAt: ctx.startedAt,
    finishedAt: ctx.finishedAt,
  };
}

export function writeRecord(root: string, rec: LocalGateRecord): string {
  const p = recordPath(root, rec.tree);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(rec, null, 2) + "\n");
  return p;
}

export function readRecord(root: string, tree: string): LocalGateRecord | undefined {
  const p = recordPath(root, tree);
  if (!existsSync(p)) return undefined;
  try {
    const r = JSON.parse(readFileSync(p, "utf-8")) as LocalGateRecord;
    return r.$schema === LOCAL_GATE_RECORD_SCHEMA && r.tree === tree ? r : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether a record covers `tree` for a push now: it is a pass on that tree,
 * under the Bun that would run the gates now. Returns the reason either way.
 */
export function covers(rec: LocalGateRecord | undefined, tree: string, now: ToolVersions): { covered: boolean; why: string } {
  if (rec === undefined) return { covered: false, why: "no local gate record for this tree" };
  if (rec.tree !== tree) return { covered: false, why: `the record is for tree ${rec.tree}` };
  if (rec.outcome !== "pass") return { covered: false, why: `the record's outcome is ${rec.outcome}` };
  if (rec.tools.bun !== now.bun) return { covered: false, why: `the record was made under bun ${rec.tools.bun}, this is ${now.bun}` };
  return { covered: true, why: `gates passed on this tree at ${rec.finishedAt} (${rec.gates.length} gate(s), ${rec.set} set)` };
}

/** One line of the push log: every bypass, refusal and undetermined push is written here. */
export function logPush(root: string, entry: Record<string, unknown>): string {
  const p = join(stateDir(root), "push.log");
  mkdirSync(dirname(p), { recursive: true });
  appendFileSync(p, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
  return p;
}

// ── Per-gate outcomes, pass or fail (the "no new failures" baseline) ─────
//
// A fresh agent container is not CI: measured 2026-11-05 (folio-assistant
// #2946), `CI=1 bun run cat gates` there reddened 11 `bun test` cases that
// pass in CI on the same tree, for want of the publish-time pages and of a
// faster machine. A red here is therefore a finding about THIS PUSH only when
// the same gate was green on the push's base in the same environment, which
// is the rule CI's own "no new failures" jobs apply. So every run records how
// each gate came out, keyed by tree, and a push compares against its base.

export const LOCAL_GATE_RESULTS_SCHEMA = "cat-local-gate-results/v1";

export type GateOutcomeHere = "pass" | "fail" | "skipped";

export interface LocalGateResults {
  $schema: typeof LOCAL_GATE_RESULTS_SCHEMA;
  tree: string;
  tools: ToolVersions;
  at: string;
  outcomes: Record<string, GateOutcomeHere>;
}

/** Each gate's outcome in a report, or undefined when the report cannot name its gates or reached no verdict. */
export function outcomesOf(report: GatesReportLike): Record<string, GateOutcomeHere> | undefined {
  if (report.commands === undefined || report.exitCode === 2 || report.outcome === "undetermined") return undefined;
  const failed = new Set(report.failed.map((f) => f.command));
  const skipped = new Set(report.skipped.map((s) => s.command));
  const out: Record<string, GateOutcomeHere> = {};
  for (const c of report.commands) out[c] = failed.has(c) ? "fail" : skipped.has(c) ? "skipped" : "pass";
  return out;
}

export function resultsPath(root: string, tree: string): string {
  if (!/^[0-9a-f]{40,64}$/.test(tree)) throw new Error(`not a tree id: ${tree}`);
  return join(stateDir(root), "results", `${tree}.json`);
}

export function writeResults(root: string, r: LocalGateResults): void {
  const p = resultsPath(root, r.tree);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(r, null, 2) + "\n");
}

/** The outcomes recorded for `tree`; a passing record stands for them when no results file was written. */
export function readResults(root: string, tree: string): LocalGateResults | undefined {
  try {
    const r = JSON.parse(readFileSync(resultsPath(root, tree), "utf-8")) as LocalGateResults;
    if (r.$schema === LOCAL_GATE_RESULTS_SCHEMA && r.tree === tree) return r;
  } catch {
    // fall through to the record
  }
  const rec = readRecord(root, tree);
  if (rec === undefined) return undefined;
  const skipped = new Set(rec.skipped.map((s) => s.command));
  const outcomes: Record<string, GateOutcomeHere> = {};
  for (const c of rec.gates) outcomes[c] = skipped.has(c) ? "skipped" : "pass";
  return { $schema: LOCAL_GATE_RESULTS_SCHEMA, tree, tools: rec.tools, at: rec.finishedAt, outcomes };
}

/**
 * The gates red now that were green (passed, or skipped on a pass) on the
 * base, in the same Bun. Only these are this push's. A gate red on both, or
 * one the base has no result for, is not decided here: CI decides it.
 */
export function newFailures(failedNow: readonly string[], base: LocalGateResults | undefined, now: ToolVersions): string[] {
  if (base === undefined || base.tools.bun !== now.bun) return [];
  return failedNow.filter((c) => base.outcomes[c] === "pass" || base.outcomes[c] === "skipped");
}
