#!/usr/bin/env bun
/**
 * Write and read a sweep step's last-checked mark.
 *
 * The session-start sweep asks the agent to run `check:session-staleness`,
 * which it cannot run itself (the input is a `list_sessions` listing only an
 * agent holds). The check writes a last-checked **timestamp** to the state
 * branch and the sweep reads it back, so a skipped step is visible after the
 * terminal scrolls. Shape: `@litlfred/cat-harness/schemas/sdlc/sweep-mark.ts`.
 *
 * The directory is the bean graph's `sweep-marks` node, asked of the graph
 * and never composed here. Reading has five answers, and only one of them is
 * a mark: a store that declares no such node, a store that cannot be reached
 * and a mark that does not parse are each said as themselves, never as "never
 * checked".
 *
 * Usage (from the sweep): `bun run cat sweep:mark --read session-staleness`
 *
 * ## The gate: `sweep:mark:check`
 *
 * A validator TYPES a mark (`cat-harness/validators/sweep-marks-sweep-mark.json`);
 * `--check` JUDGES every mark in the store: it must parse, name the check its
 * file is named for, and not be dated in the future. A store that declares no
 * marks node has nothing to judge; one that cannot be reached is UNKNOWN,
 * never a pass.
 *
 * @module scripts/sweep-mark
 * @covers sweep-marks
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { SWEEP_MARK_TAG, SweepMarkSchema, type SweepMark } from "../schemas/sdlc/sweep-mark.ts";

import { resolveBeanGraphNode } from "./beans.ts";
import { REPO_ROOT } from "./lib/roots.ts";
import { concludeJudgement, judgeUsage, judging } from "./qa-results.ts";

export type MarkRead =
  | { state: "marked"; mark: SweepMark; ageHours: number }
  | { state: "none"; dir: string }
  | { state: "undeclared" }
  | { state: "unreachable"; reason: string }
  | { state: "corrupt"; path: string; reason: string };

export type MarkWrite = { state: "written"; path: string } | { state: "not-written"; reason: string };

/** The marks directory, or why there is none. */
function marksDir(root: string): { dir: string } | { undeclared: true } | { unreachable: string; absent?: true } {
  const r = resolveBeanGraphNode(root, "sweep-marks");
  if (r.unreachable) return { unreachable: r.unreachable, ...(r.absent ? { absent: true as const } : {}) };
  if (!r.dir) return { undeclared: true };
  return { dir: r.dir };
}

/** Replace `<check>.json` with a mark for this run. Never throws: a mark that cannot be written is said, not hidden. */
export function writeSweepMark(
  root: string,
  run: { check: string; read: number; findings: number; by?: string },
  now: Date = new Date(),
): MarkWrite {
  const where = marksDir(root);
  if ("undeclared" in where) return { state: "not-written", reason: "the bean graph declares no sweep-marks directory" };
  if ("unreachable" in where) return { state: "not-written", reason: where.unreachable };
  const mark = SweepMarkSchema.parse({
    $schema: SWEEP_MARK_TAG,
    check: run.check,
    checkedAt: now.toISOString(),
    ...(run.by ? { by: run.by } : {}),
    read: run.read,
    findings: run.findings,
  });
  const path = join(where.dir, `${run.check}.json`);
  try {
    mkdirSync(where.dir, { recursive: true });
    writeFileSync(path, `${JSON.stringify(mark, null, 2)}\n`);
  } catch (e) {
    return { state: "not-written", reason: `${path}: ${(e as Error).message.split("\n")[0]}` };
  }
  return { state: "written", path };
}

export function readSweepMark(root: string, check: string, now: Date = new Date()): MarkRead {
  const where = marksDir(root);
  if ("undeclared" in where) return { state: "undeclared" };
  if ("unreachable" in where) return { state: "unreachable", reason: where.unreachable };
  const path = join(where.dir, `${check}.json`);
  if (!existsSync(path)) return { state: "none", dir: where.dir };
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { state: "corrupt", path, reason: `does not parse: ${(e as Error).message.split("\n")[0]}` };
  }
  const r = SweepMarkSchema.safeParse(json);
  if (!r.success) return { state: "corrupt", path, reason: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  if (r.data.check !== check) return { state: "corrupt", path, reason: `marks check "${r.data.check}", not "${check}"` };
  const ageHours = (now.getTime() - Date.parse(r.data.checkedAt)) / 3_600_000;
  return { state: "marked", mark: r.data, ageHours };
}

/** How far ahead of now a mark may be dated before it is a finding: clock skew between runners. */
const FUTURE_SLACK_MS = 5 * 60_000;

export type MarksVerdict =
  | { state: "judged"; dir: string; read: number; findings: { path: string; problem: string }[] }
  | { state: "undeclared" }
  /** The bean graph is determinably not this checkout's (bean `x5e0`), so there are no marks to judge. */
  | { state: "absent"; reason: string }
  | { state: "unreachable"; reason: string };

/** Judge every mark in the store. Pure apart from reading it; writes nothing. */
export function judgeSweepMarks(root: string, now: Date = new Date()): MarksVerdict {
  const where = marksDir(root);
  if ("undeclared" in where) return { state: "undeclared" };
  if ("unreachable" in where) return where.absent ? { state: "absent", reason: where.unreachable } : { state: "unreachable", reason: where.unreachable };
  if (!existsSync(where.dir)) return { state: "judged", dir: where.dir, read: 0, findings: [] };
  const files = readdirSync(where.dir).filter((f) => f.endsWith(".json")).sort();
  const findings: { path: string; problem: string }[] = [];
  for (const f of files) {
    const stem = f.slice(0, -".json".length);
    const m = readSweepMark(root, stem, now);
    if (m.state === "corrupt") findings.push({ path: m.path, problem: m.reason });
    else if (m.state === "marked" && m.ageHours * 3_600_000 < -FUTURE_SLACK_MS) {
      findings.push({ path: join(where.dir, f), problem: `dated ${m.mark.checkedAt}, after this run (${now.toISOString()})` });
    }
  }
  return { state: "judged", dir: where.dir, read: files.length, findings };
}

/** One line for the sweep. Every state but `marked` says what it is, never "not checked". */
export function describeMark(check: string, m: MarkRead): string {
  switch (m.state) {
    case "marked": {
      const age = m.ageHours < 48 ? `${m.ageHours.toFixed(1)} h` : `${(m.ageHours / 24).toFixed(1)} days`;
      const by = m.mark.by ? ` by ${m.mark.by}` : "";
      return `Last checked ${m.mark.checkedAt} (${age} ago)${by}: ${m.mark.read} read, ${m.mark.findings} finding(s).`;
    }
    case "none":
      return `No mark: \`${check}\` has not been run against this store since marks began (bean rq8s). Not "none waiting".`;
    case "undeclared":
      return "Could not determine: this store's bean graph declares no sweep-marks directory, so no run is recorded.";
    case "unreachable":
      return `Could not determine: the mark store is unreachable — ${m.reason}`;
    case "corrupt":
      return `Could not determine: ${m.path} is not a sweep mark — ${m.reason}`;
  }
}

/** The running session, when the environment names it. */
export function sessionId(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.CLAUDE_CODE_REMOTE_SESSION_ID || env.CLAUDE_CODE_SESSION_ID || undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const rootAt = argv.indexOf("--root");
  const root = rootAt >= 0 ? argv[rootAt + 1]! : REPO_ROOT ?? process.cwd();
  if (judging()) {
    const GATE = "sweep:mark:check";
    const usage = judgeUsage(GATE, argv, ["--root"]);
    if (usage !== undefined) process.exit(usage);
    const v = judgeSweepMarks(root);
    if (v.state === "undeclared") {
      process.exit(concludeJudgement({ gate: GATE, judgement: "ok", detail: "this store's bean graph declares no sweep-marks directory, so there is nothing to judge" }));
    }
    if (v.state === "absent") {
      process.exit(concludeJudgement({ gate: GATE, judgement: "ok", detail: `not applicable: ${v.reason}` }));
    }
    if (v.state === "unreachable") process.exit(concludeJudgement({ gate: GATE, judgement: "unknown", detail: v.reason }));
    for (const f of v.findings) console.log(`  ✗ ${f.path}: ${f.problem}`);
    process.exit(
      concludeJudgement({
        gate: GATE,
        judgement: v.findings.length > 0 ? "finding" : "ok",
        detail: `${v.read} mark(s) under ${v.dir}, ${v.findings.length} not a valid mark`,
      }),
    );
  }
  const at = argv.indexOf("--read");
  const check = at >= 0 ? argv[at + 1] : undefined;
  if (!check) {
    console.error("usage: sweep-mark --read <check> [--root <checkout>] | sweep-mark --check [--root <checkout>]");
    process.exit(2);
  }
  const m = readSweepMark(root, check);
  console.log(describeMark(check, m));
  process.exit(m.state === "marked" || m.state === "none" ? 0 : 2);
}
