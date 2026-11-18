#!/usr/bin/env bun
/**
 * Repair the generated artefacts a merge left wrong — by ASKING each gate.
 *
 * @module scripts/regen-after-merge
 * @graphNode none — a maintenance command over the gate set
 *
 * Two branches can change one committed generated file in non-overlapping
 * places; git merges them with **no conflict** into a state no generator
 * would produce. The only reliable check is to RE-RUN THE GENERATOR, never to
 * read the diff.
 *
 * ## It asks the gates rather than regenerating everything
 *
 * The gate set is loaded from the CI workflow, through `loadGates` (the
 * workflow is the authority, not `package.json`), so a `:check` CI does not
 * run is not this command's business. Each check is asked FIRST, so the
 * output is exactly the set of artefacts the merge left wrong, and correct
 * artefacts are not rewritten.
 *
 * ## The outcomes
 *
 * | state | what happened |
 * |---|---|
 * | `current` | the check passed; nothing was run |
 * | `judged` | a judge-mode check passed; nothing was run |
 * | `regenerated` | the check failed, its writer ran, the check now passes |
 * | **`unrepaired`** | the check failed, its writer ran, **and it still fails** |
 * | `no-writer` | the check failed and has no writer counterpart |
 * | `writer-failed` | the check failed, its writer EXITED NON-ZERO, and the check still fails |
 * | `no-browser` | as `unrepaired`/`writer-failed`, for a browser-job check on a machine with no Chromium |
 *
 * **`unrepaired` is a real defect, not staleness**, and is never reported as
 * a repair. **`writer-failed` is a verdict about the TOOL, not the tree**: it
 * points the reader at the writer's `package.json` command rather than at the
 * artefact. **`no-browser`** is could-not-determine, never green, and never
 * a claim that the tree is wrong.
 *
 * ## The whole gate set by default
 *
 * Regen asks only verify/write PAIRS and never runs `playwright test`, so
 * the default is the whole set; `--fast` restricts it to the fast set
 * (`bun run cat gates`' inner-loop boundary, the jobs that install no
 * browser).
 *
 * ## Speed, without changing a verdict
 *
 * - **Input-hash skipping** (`input-hash.ts`). A pair whose declared inputs,
 *   outputs and script sources hash to what was recorded at its last green run
 *   is not asked again — it cannot answer differently. A pair with no
 *   declaration, or whose inputs cannot be determined, is ALWAYS asked. The
 *   cache is local (`build/regen-cache/`, ignored by version control) and is
 *   off under `CI`, so CI asks every pair. Each check that RAN and passed in a
 *   settled run is also recorded on its own, so the `gates` run that follows
 *   can skip it — and a check `gates` saw pass on these inputs is skipped here
 *   too (`pairSkip`).
 * - **A worker pool** (`task-pool.ts`). A pair whose CHECK declares
 *   `outputs: []` (it only reads) is asked beside other such pairs. Every
 *   WRITER runs alone — no check reading and no other writer writing — and
 *   writers run in pair order. A pair whose check has no declaration is a
 *   barrier: it runs alone and in order. Per-pair lines (`--explain`) print in
 *   the original order.
 *
 * A pass that ran a writer is always followed by another, and the run is
 * settled only after a pass in which NO writer ran, or whose writers repaired
 * nothing and left the tree measurably unchanged — so the final verdicts were
 * all read from a tree no writer changed.
 *
 * ## Asking only what a change can have affected
 *
 * Both cuts select by the same FOOTPRINT (`changed-paths.ts`): a pair's
 * declared input/output globs, its scripts' import closure, its
 * `package.json` commands and `bun.lock` — what the input hash covers.
 *
 * - **`--changed <base>`** asks, in the first pass, only the pairs whose
 *   footprint meets a path changed since `<base>` (`git diff <base>...HEAD`
 *   plus the working tree and untracked files). A pair outside it is an
 *   ASSUMPTION about `<base>`, reported as `not asked` and never recorded in
 *   the hash cache as a green run. `merge:main` passes the merge's fork point
 *   (see `regenArgs` in `merge-base.ts`). Unlike the cache it needs no earlier
 *   run on this machine, and it works under CI.
 * - **The narrowed fixpoint.** Each pass after the first asks only the pairs
 *   whose footprint meets a path the previous pass ACTUALLY changed —
 *   measured by snapshotting `git` status before and after the pass, never
 *   taken from a writer's declaration.
 *
 * Neither ever skips a pair with no input declaration, a `{tracked}` pair
 * when anything changed, or a pair whose footprint or change set cannot be
 * determined. The `{tracked}` pairs (`kg:audit:all:check`,
 * `skill:register:check`, `kg:audit:check`) read the whole tree and so run
 * after any merge; narrow declarations in `task-io.ts` are what let these
 * cuts skip anything.
 *
 * Usage:
 *   bun run cat regen                # ask every gate; repair what is stale
 *   bun run cat regen --fast         # ...only the fast set (no browser-job pairs)
 *   bun run cat regen --dry-run      # report what is stale, change nothing
 *   bun run cat regen --jobs 3       # pool size (default: CPUs - 1)
 *   bun run cat regen --no-cache     # ask every pair; neither read nor update the hash cache
 *   bun run cat regen --explain      # say, per pair, why it ran or was skipped
 *   bun run cat regen --changed <base>  # ask only pairs whose inputs changed since <base>
 *   bun run cat regen --max-passes 8 # raise the fixpoint bound (default: DEFAULT_MAX_PASSES)
 *   bun run cat regen --no-mount     # skip the `state:mount` regen runs first (merge:main has just run it)
 *
 * `--all` is accepted and is the default.
 *
 * Exit (one decision, in {@link exitCodeFor}):
 *   0  every pair is current, judged or regenerated, and the run SETTLED
 *   1  at least one check is `unrepaired`, `no-writer`, `writer-failed` or `no-browser` — not staleness
 *   2  the run did not reach a fixed point: COULD NOT DETERMINE, never clean
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { loadGates, type Gate } from "./gates.ts";
import {
  FileDigests,
  cacheEnabled,
  againstRefsOf,
  checkFingerprint,
  decide,
  decideCheck,
  fingerprint,
  loadCache,
  qaBaselineIdentity,
  saveCache,
  type HashCache,
  type PairIO,
  type SkipDecision,
} from "./input-hash.ts";
import {
  affects,
  changedBaseFromArgv,
  changedSince,
  diffSnapshots,
  footprintOf,
  scriptsChangedSince,
  snapshotTree,
  type Affected,
} from "./changed-paths.ts";
import { ReadWriteGate, jobsFromArgv, orderedEmitter, runCaptured, runPool } from "./task-pool.ts";
import { openTrace } from "../schemas/sdlc/input-trace.ts";
import { TASK_IO, pairIO } from "./task-io.ts";
import { foldable, settleCovered } from "./pair-cover.ts";
import { WorkingCopyFailed, ensureWorkingCopy, workingCopyState } from "./qa-working-copy.ts";
import { repoRootFor } from "../schemas/kg/cat-harness.ts";
import { scriptsOf as scriptTableOf } from "../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = join(HARNESS_ROOT);
const dryRun = process.argv.includes("--dry-run");
const fast = process.argv.includes("--fast");
const all = !fast;
const explain = process.argv.includes("--explain");

/** The npm script a gate command runs, when it runs exactly one. */
export function scriptOf(command: string): string | undefined {
  const m = /^bun run (?:cat )?([A-Za-z0-9:_-]+)\s*$/.exec(command.trim());
  return m?.[1];
}

/**
 * The writer for a `:check` script, when the pair exists.
 *
 * The convention this repository already follows everywhere: `X` writes and
 * `X:check` verifies. Read from `package.json` rather than assumed, because a
 * check whose writer was renamed must come back as `no-writer` — a reported
 * gap — and not as a command that silently runs nothing.
 */
export function writerFor(scripts: Record<string, string>, check: string): string | undefined {
  const override = WRITER_OVERRIDES[check];
  if (override !== undefined) return scripts[override] === undefined ? undefined : override;
  if (!check.endsWith(":check")) return undefined;
  const base = check.slice(0, -":check".length);
  return scripts[base] === undefined ? undefined : base;
}

/**
 * The checks whose writer is NOT `<check minus ":check">` — bean `eowd`.
 *
 * Declared, one line each, rather than inferred: the convention holds for
 * nearly every pair, and for these it is measurably wrong. Without this table
 * `regen` reported each as "a real defect, not staleness" while one command
 * fixed it — a false verdict on the one line meant to be trusted.
 *
 * - `translate-bpmn` with no flag only REPORTS; the writing mode is
 *   `--extract`, exposed as its own script so the writer stays a name read
 *   from `package.json` (a writer renamed away still comes back `no-writer`).
 */
const OWN_WRITER_OVERRIDES: Readonly<Record<string, string>> = {
  "translate-bpmn:check": "translate-bpmn:extract",
  // Bean `uju6`: a `check:X` gate is `check:`-PREFIXED, so the convention never
  // offered it and regen skipped it outright. It did not even count it as
  // `no-writer`. #1550 went red on this one while regen reported "63 current,
  // 0 regenerated". `prov-qaqc.ts` without `--check` rewrites the page.
  "check:prov-qaqc": "prov:qaqc",
  // Same bean, one gate later: `check:term-mapping` arrived with #1633 and is
  // a genuine pair — `check-term-mapping.ts` without `--check` REWRITES
  // `test/results/term-mapping.qa-results.json`, which the `--check` form
  // compares against. Declared here rather than inferred from the name,
  // because the writer is spelled `term:mapping` where the check is spelled
  // `check:term-mapping`, and because inference is what got `check:raci` and
  // `check:subgraphs` wrong: an earlier version of this fix on #1633 paired
  // both by name, ran commands that repair nothing, and reported `unrepaired`
  // — the verdict about the tool that `NO_WRITER` below exists to prevent.
  "check:term-mapping": "term:mapping",
  // Found by MEASURING, not from uju6's list of four (2026-09-30): every
  // `check:X` whose command is some writer's command plus ` --check`. Main went
  // red on `check:glossary` at 7bdda74 while regen, not knowing this pair,
  // could not repair it. `glossary-page.ts` regenerates from its sources.
  "check:glossary": "glossary:page",
  "glossary:check": "glossary:export",
  "libraries:check": "libraries:derive",
  // Re-materialises a remote package's skills at its PINNED commit, so it is
  // deterministic and is exactly the repair for a stale copy.
  "check:remote-skills": "sync:remote-skills",
  // Bean `i1q7` / `0utt`. The gate COMPARES the committed
  // `kg-export.bootstrap.qa-results.json` with a fresh re-export (bean `ymsu`
  // stopped it rewriting the file on its way past), so a stale sidecar is red
  // here and nothing in regen knew the writer: it had to be run by hand after
  // every merge that changed `kg-export.ts` or the bootstrap layer.
  // `kg-export.ts --instance ./bootstrap` rewrites exactly that sidecar. A red
  // that is NOT staleness (the export itself failing) comes back `unrepaired`.
  "check:published-instance-exports": "kg:export:bootstrap",
  // Bean `v556`: the convention's `kg:export` writes the HOST's document and
  // sidecar only, so a stale `kg-export.<stub>` sidecar would come back
  // `unrepaired`. `--sidecars` rewrites exactly the set `--check` compares.
  "kg:export:check": "kg:export:sidecars",
  // Bean `wczm` item 1: two gates regen could not repair, so a merge train's
  // single `regen` called the tree current and CI then went red (trains 2 and
  // 3, #1876, #1883). `check:l1-complete -- --check` was not a bare script,
  // so regen never saw it; it is now the named `check:l1-complete:check`,
  // whose writer is `--write`. (Its sibling gate, which took one `--entry`
  // at a time, is declared by its own layer under `taskIo` since bean
  // `0r7u`.)
  "check:l1-complete:check": "l1-complete:write",
  // the formal-math layer's checkout script (bean `folio-assistant-63q4`):
  // `extract-references.ts` without `--check` rewrites exactly the
  // `extracted-references/` nodes the `--check` form compares. Spelled
  // `extract:references` where the check is `check:extracted-references`, so
  // the convention cannot pair it; and sci is remote-mounted, so a `taskIo`
  // writer in its own declaration is not read (`collectTaskIo`, bean `hupw`).
  "check:extracted-references": "extract:references",
};

/**
 * {@link OWN_WRITER_OVERRIDES} plus each present layer's declared
 * `taskIo[check].writer` (bean `0r7u`): a layer above declares the writer of
 * its own check rather than this table naming it. A check given a writer in
 * both places throws — two answers to one question.
 */
export const WRITER_OVERRIDES: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = { ...OWN_WRITER_OVERRIDES };
  for (const [check, io] of Object.entries(TASK_IO)) {
    if (io.writer === undefined) continue;
    if (out[check] !== undefined) throw new Error(`the writer of "${check}" is declared twice — in regen-after-merge.ts and by its instance`);
    out[check] = io.writer;
  }
  return out;
})();

/**
 * Verify/write pairs that are NOT gates but whose artefacts something gated
 * READS — bean `5qq3`, owner's option 1 (2026-10-01).
 *
 * `library:viz`, `schema:viz` and `uploads:viz` are ungated by the owner's 2026-09-20 ruling
 * (they derive from the whole repository, so a red would mean "somebody else
 * merged"; see the NOT GATED comment in code-quality-gates.yml). That ruling
 * stands: they are still not gates. But their OUTPUT is an input to things that
 * are — `methodologies:viz` reads the library index, and
 * `library-viewer-scope.e2e.ts` reads it in CI. Measured on PR #1769: regen
 * reported a clean fixed point, `library:viz` was 18 artefacts stale, and CI
 * failed twice on what read it. Running the writer here keeps the artefact
 * fresh without making staleness a gate.
 *
 * Asked FIRST, so a fast-set check that reads their output is asked after the
 * write in the same pass rather than one pass late.
 */
export const UNGATED_INPUTS: readonly { check: string; writer: string }[] = [
  { check: "library:viz:check", writer: "library:viz" },
  { check: "schema:viz:check", writer: "schema:viz" },
  // uploads:viz is ungated for library:viz's reason (it renders the same
  // projection), but every page it writes carries the viewer RAIL, and
  // `check:nav-names:check` — a gate — reads railed pages. Without it here a
  // merge that changes a rail label leaves /cat-harness/uploads/ stale, and
  // regen reports check:nav-names as "a real defect, not staleness".
  // Measured 2026-10-03: merge-main refused #1804 and #1958 on exactly that,
  // and `bun run cat uploads:viz` alone turned the check green.
  { check: "uploads:viz:check", writer: "uploads:viz" },
];

/**
 * `check:`-prefixed gates whose same-named script exists but is NOT a writer —
 * bean `uju6`, each read before being listed. Pairing them by name would run a
 * command that repairs nothing and then report `unrepaired`, a verdict about
 * the tool rather than the tree. So they are recorded here, and not asked.
 *
 * - `raci-chart.ts` without `--check` only PRINTS the chart.
 * - `check-subgraphs.ts` without `--check` only changes the exit code.
 * - `harness-dirs.ts` materialises declared DIRECTORIES; `check-harness-dirs`
 *   compares two config files and has nothing to regenerate.
 */
export const NO_WRITER: Readonly<Record<string, string>> = {
  "check:raci": "raci-chart.ts only prints; it writes nothing",
  "check:subgraphs": "check-subgraphs.ts only reports",
  "check:harness-dirs": "compares two config files; harness:dirs makes directories, not what it compares",
  // THE BASELINE CASES: a writer exists and must NOT be run. What it writes is
  // the baseline the gate compares against, and the gate fails only on a
  // REGRESSION, so running it on a failure re-baselines — the regression
  // vanishes and is reported as a repair. There are two, and the second is why
  // this comment no longer says "the one case":
  //
  // - `viewer:nav:audit` writes the viewer-nav baseline.
  // - `check:state-on-main --update` writes the state-on-main baseline, which
  //   may only SHRINK. regen repairing it would be regen RAISING a ratchet,
  //   which is the whole thing the ratchet exists to prevent. Its `--update`
  //   refuses growth without `--allow-growth` as a second line of defence, but
  //   the first is not asking it at all.
  "check:viewer-nav": "its writer re-baselines, which would hide the regression the gate exists to report",
  "check:state-on-main": "its --update writes the ratchet the gate reads; repairing it would RAISE a baseline that may only shrink",
  // Bean `loxz`: the two audit-coverage gates are judge-mode baseline checks
  // against qa-reports, not staleness checks over `audit-coverage.qa-results.json`.
  // Pairing them with `audit:coverage` caused `regen` to treat exit 0 from judge
  // mode as evidence that the on-disk sidecar was current, while the writer
  // produced different output.
  "audit:coverage:strict": "judge-mode baseline check against qa-reports, not an artefact staleness check",
  "audit:coverage:require-all": "judge-mode baseline check against qa-reports, not an artefact staleness check",
};

/**
 * How many passes a fixpoint run may take before it gives up — bean `g5kt`.
 *
 * ## Why it is not 3, which is what it was
 *
 * A pass is reported settled only when it ran NO writer, so a cap of N admits
 * at most **N − 1** writer-running passes. 3 therefore allowed two, and that
 * is below the measured need: the merge sweep of 2026-10-04 found
 * `skill:register` wanting a THIRD writer pass before its chain settled —
 * `skill:register` writes artefacts that other writers read, and
 * `skill-registration.md` records the chain being three deep. Under the old
 * default that run could not converge, and (bean `g5kt` defect 1) said so
 * while exiting 0.
 *
 * ## Why it is a bound at all, rather than "until it settles"
 *
 * Two writers can undo each other — `regen-after-merge.test.ts` has the case
 * — and an unbounded loop over that pair never returns. The bound is what
 * turns a hang into a reported refusal.
 *
 * ## Why this number
 *
 * It is a SANE BOUND, not a derived one, and saying so is the honest version.
 * The derivable bound is the longest chain of writer-reads-writer among the
 * pairs, which this tool cannot compute: `task-io.ts` declarations are
 * partial by design (a pair with no declaration is always asked), so a
 * computed depth would be an underestimate presented as a limit. 6 admits
 * five writer passes — twice the deepest chain ever measured here — and
 * `--max-passes` raises it for anyone who hits it. A run that needs more says
 * so and fails, which is the state this is allowed to leave behind.
 */
export const DEFAULT_MAX_PASSES = 6;

/** `--max-passes N` / `--max-passes=N`, defaulting to {@link DEFAULT_MAX_PASSES}. */
export function maxPassesFromArgv(argv: readonly string[], fallback = DEFAULT_MAX_PASSES): number {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    let v: string | undefined;
    if (a === "--max-passes") v = argv[i + 1];
    else if (a.startsWith("--max-passes=")) v = a.slice("--max-passes=".length);
    else continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`--max-passes needs a positive integer, got ${JSON.stringify(v)}`);
    }
    return n;
  }
  return fallback;
}

export type Outcome = "current" | "regenerated" | "unrepaired" | "no-writer" | "writer-failed" | "no-browser" | "judged";

/**
 * Checks whose execution runs in judge mode against a baseline (e.g. via
 * `judgeQaResult`), rather than comparing an on-disk artefact against fresh
 * generator output.
 *
 * Such a check passing asserts only that no new findings exist against the
 * baseline; it does NOT assert that the artefact on disk matches what a writer
 * would produce. Counting it as `current` is the `1xhc` defect (bean `loxz`).
 */
export const JUDGE_CHECKS: ReadonlySet<string> = new Set([
  "audit:coverage:strict",
  "audit:coverage:require-all",
  "audit:coverage:check",
  "audit:reachability:check",
  "audit:reachability:strict",
  "check:harness-state:check",
  "check:reference-direction:check",
  "check:term-mapping",
  "check:viewer-nav",
  "kg:audit:all:check",
  "kg:audit:check",
  "kg:detangle:check",
  "kg:export:check",
  "lsi:skills:check",
  "root-scan-census:check",
  "translation:block-qa:check",
]);

/** Whether a check or pair is a judge/baseline verdict rather than an artefact staleness check. */
export function isJudgeCheck(check: string, pair?: Pair): boolean {
  if (pair?.judge === true || TASK_IO[check]?.judge === true) return true;
  return JUDGE_CHECKS.has(check);
}

export interface Result {
  check: string;
  writer?: string;
  outcome: Outcome;
  /** `current` because its inputs hash to its last green run, not because it was asked. */
  skipped?: boolean;
  /**
   * `current` because `--changed` touched nothing it reads, so its answer is
   * its answer at the base — ASSUMED, never measured here. Such a pair records
   * no hash in the input-hash cache.
   */
  assumed?: boolean;
  /**
   * The pair whose verdict this one's was DERIVED from (`pair-cover.ts`): the
   * check was answered by its residual plus its coverers, and this names the
   * coverer that decided a non-`current` outcome.
   */
  coveredBy?: string;
  /**
   * The check itself was NOT run this pass: its verdict was derived through
   * `pair-cover.ts` (its residual, if any, ran in its place). Such a verdict
   * records no check-level hash, because no run of the check stands behind it.
   */
  derived?: boolean;
}

/** One verify/write pair, with what it declares about its files (`task-io.ts`). */
export interface Pair {
  check: string;
  writer: string | undefined;
  /**
   * The CHECK's declaration. Undefined: nothing declared — the pair runs alone
   * and is never skipped. `outputs: []` lets it share the pool; `inputs` lets
   * it be skipped.
   */
  io?: PairIO | undefined;
  /**
   * True when the check is a judge/baseline verdict against qa-reports rather
   * than an artefact staleness check.
   */
  judge?: boolean;
}

/** Every repairable gate in the set, in workflow order, deduplicated. */
export function repairableGates(gates: readonly Gate[], scripts: Record<string, string>): {
  check: string;
  writer: string | undefined;
}[] {
  const seen = new Set<string>();
  const out: { check: string; writer: string | undefined }[] = [];
  for (const g of gates) {
    const script = scriptOf(g.command);
    if (script === undefined || (!script.endsWith(":check") && WRITER_OVERRIDES[script] === undefined)) continue;
    // `check:X` gates have `:check` nowhere at the end, so only a DECLARED
    // writer brings one in. NO_WRITER records the rest, with reasons.
    if (seen.has(script)) continue;
    seen.add(script);
    out.push({ check: script, writer: writerFor(scripts, script) });
  }
  return out;
}

/**
 * Runs one npm script and says whether it exited 0. Injected in tests.
 *
 * May be synchronous or asynchronous; the pass awaits either.
 */
export type Runner = (script: string) => boolean | Promise<boolean>;

/** What a pass may be told beyond the pairs and the runner. */
export interface PassOptions {
  /** Report what is stale without running any writer. */
  dryRun?: boolean;
  /** Pool size. 1 reproduces the serial order exactly. */
  jobs?: number;
  /**
   * Whether this pair may be skipped this pass. Asked once per pair per pass —
   * a writer earlier in the run can change a later pair's inputs, so a
   * decision from pass 1 is never reused in pass 2.
   */
  skip?: (pair: Pair) => SkipDecision;
  /** Called IN PAIR ORDER with each pair's result and why it ran or was skipped. */
  report?: (pair: Pair, result: Result, why: string | undefined, ms: number) => void;
}

/** Whether a pair's check is declared read-only, so it may share the pool. */
export function pairShares(pair: Pair): boolean {
  return pair.io?.outputs !== undefined && pair.io.outputs.length === 0;
}

/**
 * Ask every pair once: current, or stale and repaired, or not.
 *
 * `writerRan` is the set of writers this pass ran. The caller needs it to know
 * whether another pass could change anything.
 *
 * Pairs are scheduled through {@link runPool}: checks declared read-only share
 * the pool, every writer (with the re-ask that follows it) holds the WRITE
 * side of a {@link ReadWriteGate} so nothing else runs beside it, and a pair
 * without a declaration runs alone and in order — so a run in which nothing is
 * declared is the serial run it always was.
 */
export async function regenPass(
  pairs: readonly Pair[],
  runner: Runner,
  opts: PassOptions | boolean = {},
): Promise<{ results: Result[]; writerRan: string[] }> {
  const o: PassOptions = typeof opts === "boolean" ? { dryRun: opts } : opts;
  const writerRan: string[] = [];
  const emitter = orderedEmitter<{ result: Result; why: string | undefined; ms: number }>((i, v) =>
    o.report?.(pairs[i]!, v.result, v.why, v.ms),
  );

  // Checks other pairs in THIS pass already answer (bean `8qyc`): each is asked
  // only for its residual, and its verdict is settled from the coverers' below.
  const folds = foldable(pairs.map((p) => p.check));

  // Checks that only read share; writers (and the re-ask after one) run alone.
  const gate = new ReadWriteGate();
  const askOne = async (pair: Pair, index: number): Promise<{ result: Result; why: string | undefined; ms: number }> => {
    const { check, writer } = pair;
    const isJudge = isJudgeCheck(check, pair);
    const t0 = performance.now();
    const decision = o.skip?.(pair);
    if (decision?.skip === true) {
      return { result: { check, writer, outcome: isJudge ? "judged" : "current", skipped: true }, why: decision.why, ms: 0 };
    }
    const fold = folds.get(check);
    const why =
      fold === undefined
        ? decision?.why
        : `${decision?.why ?? "asked"}; verdict DERIVED from ${fold.residual ?? "no residual"} + ` +
          `${fold.covers.length} covering pair(s) (pair-cover.ts)`;
    const done = (result: Result) => ({
      result: fold === undefined ? result : { ...result, derived: true },
      why,
      ms: performance.now() - t0,
    });
    // A folded check runs its residual in its place, or nothing at all.
    const ask = fold === undefined ? check : fold.residual;
    if (ask === undefined) return done({ check, writer, outcome: isJudge ? "judged" : "current" });
    if (await gate.read(async () => runner(ask))) return done({ check, writer, outcome: isJudge ? "judged" : "current" });
    if (writer === undefined) return done({ check, outcome: "no-writer" });
    if (o.dryRun) return done({ check, writer, outcome: "regenerated" });
    return gate.write(index, async () => {
      const wrote = await runner(writer);
      writerRan.push(writer);
      // Ask AGAIN. A writer that ran is not a repair that worked, and reporting
      // it as one would be the false-clean this whole command is about.
      // And a writer that EXITED NON-ZERO is named as such (bean `i1q7`): the
      // defect is in the declared writer, not in what it generates from.
      const outcome: Outcome = (await runner(ask)) ? "regenerated" : wrote ? "unrepaired" : "writer-failed";
      return done({ check, writer, outcome });
    });
  };

  const done = await runPool(
    pairs.map((pair, i) => ({
      id: pair.check,
      // A pair runs beside others only when its CHECK declares it writes
      // nothing. Anything else — undeclared, or a check that writes — is a
      // barrier, exactly as serial.
      outputs: pairShares(pair) ? [] : undefined,
      run: () => askOne(pair, i),
    })),
    o.jobs ?? 1,
    (i, v) => emitter.push(i, v),
  );
  // Writers in PAIR order, not completion order, so the record is deterministic.
  const order = new Map(pairs.map((p, i) => [p.writer, i]));
  writerRan.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return { results: settleCovered(done.map((d) => d.result), folds), writerRan };
}

/**
 * Passes until one runs NO writer — or a BARREN one, whose writers repaired
 * nothing and measurably changed nothing — at most `maxPasses` — bean `14ve`.
 *
 * One pass asks each check once, in workflow order. When writer B's output is
 * an INPUT to check A and A comes first, A reads current before B runs, B then
 * changes A's input, and A is stale when regen exits. Measured on #1530:
 * "60 current, 2 regenerated, 0 unrepaired", then `audit:coverage:require-all`
 * failed in CI.
 *
 * So a pass that ran any writer is followed by another. Each check's FINAL
 * outcome is its last pass's, except that `regenerated` in an earlier pass is
 * kept over a later `current`, because the repair happened. The cap keeps two
 * writers that undo each other from looping for ever. The last pass still ran a
 * writer, so its results are reported as they are, not as settled.
 *
 * The same argument is what makes the worker pool safe: the settling pass ran
 * no writer, so every verdict it reports was read from a tree nobody was
 * writing.
 *
 * The cap is {@link DEFAULT_MAX_PASSES}; `--max-passes` raises it. A run that
 * reaches it returns `settled: false`, and that is a REFUSAL, not a pass —
 * see {@link exitCodeFor}.
 */
export async function regenToFixpoint(
  pairs: readonly Pair[],
  runner: Runner,
  maxPasses = DEFAULT_MAX_PASSES,
  opts: PassOptions & FixpointOptions = {},
): Promise<{ results: Result[]; passes: number; settled: boolean }> {
  const final = new Map<string, Result>();
  let passes = 0;
  let settled = false;
  // What the previous pass changed: `null` before the first pass, `undefined`
  // when it could not be measured (which asks every pair).
  let lastChange: ReadonlySet<string> | undefined | null = null;
  while (passes < maxPasses) {
    passes++;
    opts.onPass?.(passes);
    // Bean `7how`: the QA working copy is brought up to date with the tree
    // BEFORE anything reads it. What that changed joins what the last pass
    // changed — a QA path is an input like any other.
    const qa = await opts.beforePass?.(passes);
    const extra = qa === undefined || qa.size === 0 ? undefined : qa;
    if (extra !== undefined && lastChange !== null && lastChange !== undefined) {
      lastChange = new Set([...lastChange, ...extra]);
    }
    const asked: Pair[] = [];
    for (const pair of pairs) {
      let sel =
        lastChange === null
          ? opts.firstPass?.(pair)
          : opts.narrow === undefined
            ? undefined
            : opts.narrow.affects(pair, lastChange);
      // First pass: a pair `--changed` declines is still asked when the
      // rebuilt QA copy touched something it reads.
      if (lastChange === null && extra !== undefined && sel !== undefined && !sel.affected) {
        sel = opts.narrow === undefined ? undefined : opts.narrow.affects(pair, extra);
      }
      if (sel === undefined || sel.affected) {
        asked.push(pair);
        continue;
      }
      opts.onNotAsked?.(pair, sel.why, passes);
      // Never asked at all: its answer is ASSUMED from the base, and the
      // result says so (`hashesToRecord` will not record a hash for it).
      // Asked in an earlier pass: that answer stands — nothing it reads moved.
      if (!final.has(pair.check)) {
        const isJudge = isJudgeCheck(pair.check, pair);
        final.set(pair.check, { check: pair.check, writer: pair.writer, outcome: isJudge ? "judged" : "current", skipped: true, assumed: true });
      }
    }
    const measure = opts.narrow?.begin();
    const { results, writerRan } = await regenPass(asked, runner, opts);
    lastChange = measure === undefined ? undefined : measure();
    for (const r of results) {
      const prev = final.get(r.check);
      final.set(r.check, prev?.outcome === "regenerated" && (r.outcome === "current" || r.outcome === "judged") ? prev : r);
    }
    if (writerRan.length === 0) {
      settled = true;
      break;
    }
    // A BARREN pass (bean `xpcu`, measured 2026-10-06): writers ran, but none
    // repaired anything and — measured, not declared — the tree is exactly
    // as it was before the pass. The next pass would read that same tree and
    // run the same writers to the same effect, so this pass IS the fixed
    // point. Without this a writer that exits non-zero (`writer-failed`)
    // counted as "a writer ran" on every pass: measured, `fsh-guts:viz` took
    // a run to the pass cap re-asking ~80-106 undeclared pairs per pass, then
    // reported NOT SETTLED and recorded no hash at all. Only with the
    // measurement: a change set that could not be read (`undefined`) settles
    // nothing.
    const repaired = results.some((r) => r.outcome === "regenerated");
    if (lastChange !== undefined && lastChange.size === 0 && !repaired) {
      opts.onBarren?.(passes, writerRan);
      settled = true;
      break;
    }
  }
  return { results: pairs.map((p) => final.get(p.check)!), passes, settled };
}

/**
 * Which pairs a pass asks — bean `94zs`. Every hook is optional, and with none
 * of them every pass asks every pair, exactly as before.
 */
export interface FixpointOptions {
  onPass?: (pass: number) => void;
  /**
   * Bean `7how`. Awaited at the start of every pass, before any pair is
   * selected or asked: brings the QA working copy up to date with the tree
   * and returns the QA paths it changed (empty or `undefined`: none). It
   * THROWS when the copy could not be built, which ends the run — a pass
   * over a half-built copy would write generated pages from it.
   */
  beforePass?: (pass: number) => Promise<ReadonlySet<string> | undefined> | ReadonlySet<string> | undefined;
  /**
   * `--changed <base>`: whether the FIRST pass asks this pair. A pair it
   * declines was not touched by the change since `<base>`.
   */
  firstPass?: (pair: Pair) => Affected;
  /**
   * The narrowed fixpoint. `begin()` is called before every pass and returns
   * a function that, called after it, says which paths the pass ACTUALLY
   * changed (`undefined`: could not be measured). The next pass asks only the
   * pairs `affects` says that change touched.
   *
   * Why the settling guarantee survives: a pair not re-asked has the answer it
   * gave in an earlier pass, and by induction nothing it reads has changed
   * since it gave it — it was read from a tree identical, on its footprint, to
   * this one. A pass that asks nobody runs no writer, and so settles.
   */
  narrow?: {
    begin: () => () => ReadonlySet<string> | undefined;
    affects: (pair: Pair, changed: ReadonlySet<string> | undefined) => Affected;
  };
  /** Called for each pair a pass does not ask, before the pass runs. */
  onNotAsked?: (pair: Pair, why: string, pass: number) => void;
  /** Called when a pass settles as BARREN: its writers repaired nothing and changed nothing measured. */
  onBarren?: (pass: number, writers: readonly string[]) => void;
}

/** Why a run exited as it did — one of these, never a bare number. */
export type ExitReason = "dry-run" | "clean" | "not-settled" | "not-staleness";

/**
 * The outcomes that are not staleness, so a run carrying one is not clean.
 *
 * Derived from {@link Outcome} by exclusion rather than listed independently:
 * `current` and `regenerated` are the only two a clean run may hold, so a
 * NEW outcome joins this set by default and has to be deliberately excluded.
 * The merge that brought in `writer-failed` and `no-browser` (2026-10-04) is
 * why — a hand-kept list of failures is a list that forgets the next one, and
 * forgetting here means exiting 0.
 */
const CLEAN_OUTCOMES = new Set<Outcome>(["current", "regenerated", "judged"]);
const NOT_STALENESS: ReadonlySet<Outcome> = new Set<Outcome>(
  (["current", "regenerated", "judged", "unrepaired", "no-writer", "writer-failed", "no-browser"] as const).filter(
    (o) => !CLEAN_OUTCOMES.has(o),
  ),
);

/**
 * The TAG that carries regen's verdict into a caller's own output.
 *
 * Declared once because two modules read the same token: `merge-base.ts`
 * prints it when it aborts, and `merge-main-comment.ts` recovers the verdict
 * from the captured log to decide whether the PR comment says "Error" or
 * "Could not determine". Matching the abort's PROSE instead would make the
 * bot's reporting depend on a sentence nobody thinks of as an interface.
 */
export const REGEN_VERDICT_TAG = "regen-verdict:";

/** What a caller holding only regen's EXIT CODE may truthfully say about it. */
export interface RegenExit {
  verdict: ExitReason | "crashed";
  /**
   * Did regen establish a fact about the TREE?
   *
   * False for `not-settled` (every verdict was read from a tree a writer was
   * still changing) and for `crashed` (nothing was measured at all). True for
   * `not-staleness`, where regen did measure checks — though its OWN output is
   * the only place the kinds are separated, which is why {@link RegenExit.why}
   * sends the reader there rather than naming one.
   */
  determined: boolean;
  why: string;
}

/**
 * Read a non-zero `regen` exit HONESTLY — the inverse of {@link exitCodeFor}.
 *
 * ## The false reason this replaces
 *
 * `merge-base.ts` had one line for every non-zero exit:
 *
 * ```ts
 * if (regen.status !== 0) abort("the gate set could not reproduce the resolution (regen reported unrepaired checks)");
 * ```
 *
 * {@link exitCodeFor} returns three distinct verdicts and that message asserts
 * one cause for all of them. It is FALSE in three of the four cases a caller
 * can see:
 *
 * - **exit 2** — regen reported *no* unrepaired check. It reported that it
 *   could not reach a fixed point, so it cannot stand behind the count it
 *   printed. Its own words: *"this is NOT a clean regeneration"*.
 * - **exit 1, every bad check `no-browser`** — regen labels that
 *   could-not-determine in as many words: *"not a finding about the tree, and
 *   it is not a pass either"*. Reporting it as an unrepaired check asserts a
 *   defect in a tree nothing measured.
 * - **exit 1, `no-writer`** — a check with no writer counterpart is a
 *   different finding from one whose writer ran and did not fix it. Bean
 *   `i1q7` split `writer-failed` out for exactly this reason: a verdict about
 *   the TOOL is not a verdict about the tree.
 * - **any other code, or a signal** — regen itself failed, and the message
 *   described that as a measurement.
 *
 * **The abort was right in every case; only the recorded reason was wrong.**
 * That is the same shape as commit `732c17f65`, whose resolution was correct
 * and whose stated reason ("the pins diverged") was measured in a shallow
 * submodule and false — and it is why this is a named function with tests
 * rather than a longer string at the call site.
 */
export function regenExitMeaning(code: number | null): RegenExit {
  if (code === 0) {
    return { verdict: "clean", determined: true, why: "every pair is current or was regenerated, and the run settled" };
  }
  if (code === 1) {
    return {
      verdict: "not-staleness",
      determined: true,
      why:
        "regen found at least one check that staleness does not explain, and its own output above " +
        "says which — AND WHICH KIND. `unrepaired` is a defect (the writer ran and the check still " +
        "fails); `no-writer` is a check with no writer counterpart; `writer-failed` is a verdict " +
        "about the tool; `no-browser` is COULD NOT DETERMINE on a machine with no Chromium. Do not " +
        "report them as one finding.",
    };
  }
  if (code === 2) {
    return {
      verdict: "not-settled",
      determined: false,
      why:
        "COULD NOT DETERMINE: regen did not reach a fixed point, so every verdict it printed was " +
        "read from a tree a writer was still changing. It reported NO unrepaired check — it " +
        "reported that it cannot stand behind the count.",
    };
  }
  return {
    verdict: "crashed",
    determined: false,
    why:
      `regen exited ${code === null ? "on a signal" : code}, which is none of its three verdicts ` +
      "(0 clean, 1 not-staleness, 2 not-settled). The tool itself failed and nothing was measured " +
      "about the merged tree.",
  };
}

/** {@link exitCodeFor}'s verdict: the code, which reason earned it, and the line to print. */
export interface ExitVerdict {
  code: number;
  reason: ExitReason;
  message?: string;
}

/**
 * The run's exit code — bean `g5kt` defect 1.
 *
 * ## The false clean this replaces
 *
 * This was inline in the CLI and consulted `unrepaired` and `no-writer` only.
 * `settled` was computed, printed as *"CAP REACHED: the last pass still ran a
 * writer, so the tree may not be settled"*, and then **dropped** — so a run
 * that could not reach a fixed point exited 0. Every reader of an exit code
 * (a pre-push sweep, `prepare-merge`, a CI step, an agent) was told the tree
 * was regenerated when the tool's own last line said it did not know.
 *
 * That is the standing could-not-determine rule — *"a sweep blind on one
 * check has not cleared the others"* — broken by one of the tools that
 * reports it, which is why it is a function with a name and a test rather
 * than three lines at the bottom of a script.
 *
 * ## Why not-settled outranks a clean count
 *
 * An unsettled run's verdicts were read from a tree a writer was still
 * changing, so `0 unrepaired` over it is not a finding of zero — it is a
 * count nobody can stand behind. The order below is therefore deliberate:
 * `not-staleness` first because it names specific checks a person must read,
 * then `not-settled`, and `clean` only when neither holds.
 *
 * `--dry-run` ran no writer by construction, so it cannot settle anything and
 * is not judged on it.
 */
export function exitCodeFor(run: {
  results: readonly Result[];
  settled: boolean;
  dryRun?: boolean;
  passes?: number;
}): ExitVerdict {
  if (run.dryRun === true) return { code: 0, reason: "dry-run" };
  const bad = run.results.filter((r) => NOT_STALENESS.has(r.outcome));
  if (bad.length > 0) {
    // `no-browser` is in the set because bean `i1q7` put it there, and it stays
    // exit 1 for the reason that set exists: it is not staleness, so it must
    // not read as a clean regeneration. But it is a could-not-determine
    // rather than a defect in the tree, and the one-size message called every
    // one of them something "a generator cannot fix" — which misdescribes a
    // machine that simply has no Chromium. So the count is main's and the
    // wording is split.
    const blind = bad.filter((r) => r.outcome === "no-browser");
    const real = bad.length - blind.length;
    const parts: string[] = [];
    if (real > 0) {
      parts.push(
        `${real} check(s) are NOT explained by staleness. Read them: a generator ` +
          "cannot fix a defect in what it is generating from.",
      );
    }
    if (blind.length > 0) {
      parts.push(
        `${blind.length} check(s) COULD NOT BE DETERMINED here: they repair through a ` +
          `browser and this machine has none (${blind.map((r) => r.check).join(", ")}). ` +
          "That is not a finding about the tree, and it is not a pass either — " +
          "run them where a browser exists.",
      );
    }
    return { code: 1, reason: "not-staleness", message: parts.join("\n\n") };
  }
  if (!run.settled) {
    return {
      code: 2,
      reason: "not-settled",
      message:
        `COULD NOT DETERMINE: the run did not reach a fixed point within ` +
        `${run.passes ?? DEFAULT_MAX_PASSES} pass(es) — the last one still ran a writer. ` +
        "Every verdict above was read from a tree a writer was still changing, so this " +
        "is NOT a clean regeneration. Re-run with `--max-passes` raised; if it still will " +
        "not settle, two writers are undoing each other and that is the defect to fix.",
    };
  }
  return { code: 0, reason: "clean" };
}

/**
 * Re-label a failure that only a browser could repair, on a machine with none.
 *
 * `render:bpmn:check` renders through Chromium. Without one, the check and its
 * writer both fail, and `unrepaired` would assert "a real defect" that nothing
 * measured. Only checks OUTSIDE the fast set are candidates, because the fast
 * set is by derivation the jobs that install no browser; inside it, a failure
 * is the tree's or the tool's and keeps its verdict.
 */
export function relabelForMissingBrowser(
  results: readonly Result[],
  fastChecks: ReadonlySet<string>,
  browserPresent: boolean,
): Result[] {
  if (browserPresent) return [...results];
  return results.map((r) =>
    (r.outcome === "unrepaired" || r.outcome === "writer-failed") && !fastChecks.has(r.check)
      ? { ...r, outcome: "no-browser" as const }
      : r,
  );
}

/** Is there a Chromium playwright can launch? Probed, never assumed. */
async function browserPresent(): Promise<boolean> {
  try {
    const { chromiumExecutable } = await import("./bpmn-render.ts");
    if (chromiumExecutable() !== undefined) return true;
    const { chromium } = await import("playwright");
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

/** The cache key of a pair: both script names, so a re-paired check starts fresh. */
export function cacheKey(pair: Pair): string {
  return `${pair.check} -> ${pair.writer ?? "(none)"}`;
}

/**
 * Whether a pair may be skipped: its own record (check AND writer, at a green
 * run), or failing that a record of its CHECK ALONE having passed on these
 * inputs — written by `gates` or by an earlier regen (bean `f017`). A passing
 * check is all a pair needs to be `current`, so either is enough; neither is
 * consulted when the cache is off.
 */
export function pairSkip(
  cache: HashCache | undefined,
  pair: Pair,
  fp: (pair: Pair) => ReturnType<typeof fingerprint>,
  fpCheck: (check: string) => ReturnType<typeof fingerprint>,
): SkipDecision {
  const own = decide(cache, cacheKey(pair), fp(pair));
  if (own.skip || cache === undefined) return own;
  const alone = decideCheck(cache, pair.check, fpCheck(pair.check));
  return alone.skip ? alone : own;
}

/** The npm scripts a pair runs, check first. */
function scriptsOf(pair: Pair): string[] {
  return pair.writer === undefined ? [pair.check] : [pair.check, pair.writer];
}

/**
 * The hashes to record after a run: only for pairs that ended `current` or
 * `regenerated` (and were actually asked, or were skipped against a hash that
 * still holds), only when the run SETTLED, and only where the fingerprint
 * could be computed. Everything else is dropped from the cache, so it is
 * asked next time.
 *
 * `fpCheck`, when given, also records the CHECK SCRIPT ALONE (bean `f017`) —
 * the entry `gates` reads, so the gate run that follows a regen does not ask
 * again what regen just asked on the same tree. Stricter than the pair entry,
 * because `gates` will treat it as "this script passed on these inputs": it is
 * recorded only for a check that was actually RUN and came back green in a
 * settled run — never for a skipped pair (no run stands behind it now), an
 * assumed one (`--changed`), or a derived one (`pair-cover.ts`: the check
 * itself never ran). Those leave whatever a real run recorded, which still
 * holds while its hash matches. A red or unsettled check's entry is dropped.
 */
export function hashesToRecord(
  pairs: readonly Pair[],
  results: readonly Result[],
  settled: boolean,
  fp: (pair: Pair) => ReturnType<typeof fingerprint>,
  previous: HashCache,
  fpCheck?: (check: string) => ReturnType<typeof fingerprint>,
): HashCache {
  const next: HashCache = { version: previous.version, pairs: { ...previous.pairs }, checks: { ...previous.checks } };
  const checks = next.checks!;
  pairs.forEach((pair, i) => {
    const key = cacheKey(pair);
    const r = results[i];
    // Assumed from the base rather than asked: a green hash recorded now
    // would launder that premise into a measurement. Leave whatever a real
    // run recorded (if it still matches, it still holds).
    if (r?.assumed === true) return;
    const green = r !== undefined && (r.outcome === "current" || r.outcome === "regenerated" || r.outcome === "judged");
    if (!settled || !green) {
      delete next.pairs[key];
      if (fpCheck !== undefined && r?.derived !== true) delete checks[pair.check];
      return;
    }
    const f = fp(pair);
    if ("undetermined" in f) delete next.pairs[key];
    else next.pairs[key] = f.hash;
    if (fpCheck === undefined || r.skipped === true || r.derived === true) return;
    const c = fpCheck(pair.check);
    if ("undetermined" in c) delete checks[pair.check];
    else checks[pair.check] = c.hash;
  });
  return next;
}

/**
 * Whether regen mounts the branch-kept graphs before it grades anything —
 * folio-assistant#2247, gap 3. `merge:main` mounts against the MERGED
 * declarations and then runs regen (bean `9c7h`), but a bare `bun run cat
 * regen` never mounted. With `cat/cat-harness/fsh-guts` unmounted it reported
 * `audit:coverage:strict` as "a real defect, not staleness" and `fsh-guts:viz`
 * as "the declared writer is not a writer" (seen on #2245); both passed after
 * `state:mount`. `--no-mount` is for a caller that has just mounted.
 */
export function mountFirst(argv: readonly string[]): boolean {
  return !argv.includes("--no-mount");
}

if (import.meta.main) {
  const repoRoot = repoRootFor(ROOT);
  if (mountFirst(process.argv)) {
    // Idempotent, and the mounted paths are ignored, so the tree regen grades
    // is unchanged apart from what it reads. A mount that fails leaves regen
    // reading graphs that may be absent: could-not-determine (exit 2), never
    // a verdict about the tree.
    const mount = spawnSync("bun", ["run", "cat", "state:mount"], { cwd: repoRoot, stdio: "inherit" });
    if (mount.status !== 0) {
      console.error(
        `\nCOULD NOT DETERMINE — \`bun run cat state:mount\` failed (exit ${mount.status ?? mount.signal}), so the ` +
          "branch-kept graphs regen reads may be missing. Fix the mount, or pass --no-mount if you have just mounted. Not a pass.",
      );
      process.exit(2);
    }
  }
  const scripts = scriptTableOf(repoRoot);
  const jobs = jobsFromArgv(process.argv);
  const maxPasses = maxPassesFromArgv(process.argv);
  const useCache = cacheEnabled(process.argv, process.env);
  const changedBase = changedBaseFromArgv(process.argv);
  const t0 = performance.now();

  const gates = loadGates(repoRoot, { all });
  const gated = repairableGates(gates, scripts);
  const extra = UNGATED_INPUTS.filter((p) => !gated.some((g) => g.check === p.check));
  // The ungated inputs stay BARRIERS whatever their checks declare: they are
  // asked first precisely so their writes land before any gated check reads
  // (bean `5qq3`), and sharing the pool would let a dependent check read first.
  const repairable: Pair[] = [
    ...extra.map((p) => ({ ...p, io: { inputs: pairIO(p.check)?.inputs } })),
    ...gated.map((p) => ({ ...p, io: pairIO(p.check) })),
  ];
  console.log(
    `regen-after-merge — ${gated.length} verify/write pair(s) in the ` +
      `${all ? "whole" : "fast"} gate set (of ${gates.length} gate(s))` +
      (extra.length > 0 ? `, plus ${extra.length} ungated input(s): ${extra.map((p) => p.writer).join(", ")}` : ""),
  );
  const declared = repairable.filter((p) => p.io?.inputs !== undefined).length;
  const sharing = repairable.filter(pairShares).length;
  console.log(
    `  ${jobs} worker(s); input-hash cache ${useCache ? "ON" : "OFF (--no-cache or CI)"}; ` +
      `${declared} of ${repairable.length} pair(s) declare inputs and may be skipped; ` +
      `${sharing} have read-only checks and may share the pool`,
  );

  const cache = useCache ? loadCache(repoRoot) : undefined;
  // A fresh digest table per pass: a writer in pass N changes files that pass
  // N+1 must hash again, and a reused table could serve a stale digest when an
  // mtime does not move within one clock tick.
  let digests = new FileDigests(repoRoot);
  // Resolved once per run: a baseline that moves DURING a run is the next run's input.
  const baseline = qaBaselineIdentity({ repoRoot });
  // A check whose run reached a `traced` input site (`input-trace.ts`) read
  // something no fingerprint sees: nothing is recorded for it this run.
  const traced = new Map<string, string>();
  const untraced = (check: string): { undetermined: string } | undefined => {
    const what = traced.get(check);
    return what === undefined ? undefined : { undetermined: `its run reached a traced input site — ${what}` };
  };
  const fp = (pair: Pair) =>
    untraced(pair.check) ?? fingerprint(repoRoot, scripts, scriptsOf(pair), pair.io, digests, baseline);
  const fpCheck = (check: string) =>
    untraced(check) ?? checkFingerprint(repoRoot, scripts, check, pairIO(check), digests, baseline);
  // The pair's own record first; failing that, a record of the CHECK alone
  // having passed on these inputs — written by `gates` or by an earlier regen
  // (bean `f017`). Either way the check would answer exactly as it did then,
  // and a passing check is all a pair needs to be `current`.
  const skip = (pair: Pair): SkipDecision => pairSkip(cache, pair, fp, fpCheck);

  const checks = new Set(repairable.map((p) => p.check));
  const asyncRun = async (script: string): Promise<boolean> => {
    const trace = checks.has(script) && useCache ? openTrace(repoRoot) : undefined;
    const ok = (await runCaptured(["bun", "run", "cat", script], repoRoot, trace?.env)).code === 0;
    const reached = trace?.reached(againstRefsOf(scripts, script));
    if (reached !== undefined) traced.set(script, reached);
    // A writer changed files: digests computed before it are of a tree that
    // no longer exists. (The fixpoint would catch a stale skip one pass later;
    // this makes the pass after the write see it at once.)
    if (!checks.has(script)) digests.clear();
    return ok;
  };
  const report: PassOptions["report"] = explain
    ? (pair, r, why, ms) => {
        const verb = r.skipped ? "skip" : "ran ";
        const time = r.skipped ? "" : ` (${(ms / 1000).toFixed(1)}s, ${r.outcome})`;
        console.log(`    ${verb} ${pair.check}${time} — ${why ?? "cache disabled (--no-cache or CI)"}`);
      }
    : undefined;

  // Bean `94zs`. A footprint is recomputed each pass: a writer can create a
  // file a glob now matches. Memoised within the pass.
  let footprints = new Map<string, ReturnType<typeof footprintOf>>();
  const footprint = (pair: Pair) => {
    let f = footprints.get(pair.check);
    if (f === undefined) footprints.set(pair.check, (f = footprintOf(repoRoot, scripts, scriptsOf(pair), pair.io)));
    return f;
  };
  let firstPass: ((pair: Pair) => Affected) | undefined;
  if (changedBase !== undefined) {
    const ch = changedSince(repoRoot, changedBase);
    if ("undetermined" in ch) {
      console.log(`  --changed ${changedBase}: COULD NOT DETERMINE the change (${ch.undetermined}) — asking every pair`);
    } else {
      const scriptsChanged = scriptsChangedSince(repoRoot, ch.baseSha, scripts);
      firstPass = (pair) => affects(footprint(pair), ch.paths, { scriptsChanged });
      const untouched = repairable.filter((p) => !firstPass!(p).affected).length;
      console.log(
        `  --changed ${changedBase} (${ch.baseSha.slice(0, 10)}): ${ch.paths.size} path(s) changed; ` +
          `${untouched} of ${repairable.length} pair(s) read none of them and are not asked — ` +
          "their answer is their answer at the base",
      );
    }
  }
  const narrow = {
    begin: () => {
      const before = snapshotTree(repoRoot);
      return () => {
        footprints = new Map();
        const after = snapshotTree(repoRoot);
        return before === undefined || after === undefined ? undefined : diffSnapshots(before, after);
      };
    },
    affects: (pair: Pair, changed: ReadonlySet<string> | undefined) => affects(footprint(pair), changed),
  };
  const onNotAsked = explain
    ? (pair: Pair, why: string, pass: number) =>
        console.log(`    skip ${pair.check} — not asked${pass === 1 ? ` (--changed ${changedBase})` : " (unaffected by the last pass)"}: ${why}`)
    : undefined;

  // Bean `7how`. Generators and checks read the QA working copy from disk, so
  // a pass must never read one built from another tree. Rebuilt before any
  // pass whose tree moved since the copy's stamp; the paths it changed join
  // the narrowed fixpoint's change set (`beforePass`).
  const beforePass = async (n: number): Promise<ReadonlySet<string> | undefined> => {
    const r = ensureWorkingCopy(repoRoot, { force: n === 1 && process.argv.includes("--no-cache") });
    if (!r.ran) {
      if (explain) console.log(`  QA working copy: ${r.why}`);
      return undefined;
    }
    if (!r.ok) {
      throw new WorkingCopyFailed(
        `the QA working copy could not be built before pass ${n} (\`${r.step}\` exited ${r.exit ?? "on a signal"}), ` +
          "and every generator that reads it would write from a partial tree",
      );
    }
    console.log(`  QA working copy rebuilt before pass ${n} (${r.why}): ${r.changed.size} QA file(s) changed`);
    return r.changed;
  };

  let results: Result[];
  let settled = false;
  if (dryRun) {
    const st = workingCopyState(repoRoot);
    if (st.state !== "current") {
      console.log(
        `  QA working copy is ${st.state.toUpperCase()} (${st.why}) — a dry run builds nothing, so the verdict of a ` +
          "check that reads it may be wrong; `bun run cat qa:working-copy` first",
      );
    }
    results = (
      await regenToFixpoint(repairable, asyncRun, 1, { dryRun: true, jobs, skip, report, firstPass, onNotAsked })
    ).results;
  } else {
    let fx: Awaited<ReturnType<typeof regenToFixpoint>>;
    try {
      fx = await regenToFixpoint(repairable, asyncRun, maxPasses, {
        jobs,
        skip,
        report,
        firstPass,
        narrow,
        onNotAsked,
        beforePass,
        onBarren: (n, writers) =>
          console.log(
            `  pass ${n} was BARREN — its writer(s) (${writers.join(", ")}) repaired nothing and changed ` +
              "nothing in the tree (measured), so the next pass would repeat it: settled here",
          ),
        onPass: (n) => {
          digests = new FileDigests(repoRoot);
          if (explain) console.log(`  pass ${n}:`);
        },
      });
    } catch (e) {
      if (!(e instanceof WorkingCopyFailed)) throw e;
      console.error(`\nCOULD NOT DETERMINE — ${e.message}. Fix the failing step, then run regen again. Not a pass.`);
      process.exit(2);
    }
    // Bean `i1q7`: a browser-job check that could not be repaired on a machine
    // with no Chromium is `no-browser` — could-not-determine, never a defect.
    const fastChecks = new Set(repairableGates(loadGates(repoRoot, { all: false }), scripts).map((p) => p.check));
    results = relabelForMissingBrowser(fx.results, fastChecks, await browserPresent());
    settled = fx.settled;
    console.log(
      `  ${fx.passes} pass(es)` +
        (fx.settled
          ? ""
          : ` of ${maxPasses} — CAP REACHED: the last pass still ran a writer, so the tree is NOT settled`),
    );
  }
  if (cache !== undefined && !dryRun) {
    digests = new FileDigests(repoRoot);
    // Another process (`gates`) may have recorded checks since this run
    // loaded the cache. Keep them: an entry names the inputs it passed on, so
    // one recorded from a real run stays true whoever wrote it.
    const onDisk = loadCache(repoRoot);
    const base: HashCache = { ...cache, checks: { ...onDisk.checks, ...cache.checks } };
    saveCache(repoRoot, hashesToRecord(repairable, results, settled, fp, base, fpCheck));
  }
  for (const r of results) {
    if (r.coveredBy !== undefined) {
      // Derived (`pair-cover.ts`): the line that matters is the coverer's own,
      // printed in its place; this one says where the verdict came from.
      console.log(`  ${r.outcome === "regenerated" ? "·" : "✗"} ${r.check} is ${r.outcome} through ${r.coveredBy} (see its line)`);
      continue;
    }
    if (r.outcome === "judged") {
      console.log(`  ✓ ${r.check} passed (judge mode, wrote nothing)`);
    } else if (r.outcome === "regenerated") {
      console.log(
        dryRun
          ? `  · ${r.check} is stale — would run \`bun run cat ${r.writer}\``
          : `  ✓ ${r.check} was stale — regenerated with \`bun run cat ${r.writer}\``,
      );
    } else if (r.outcome === "unrepaired") {
      console.log(`  ✗ ${r.check} STILL fails after \`bun run cat ${r.writer}\` — a real defect, not staleness`);
    } else if (r.outcome === "no-writer") {
      console.error(`  ✗ ${r.check} fails and has NO writer counterpart — not staleness`);
    } else if (r.outcome === "writer-failed") {
      console.error(
        `  ✗ ${r.check} still fails, and its writer \`bun run cat ${r.writer}\` EXITED NON-ZERO — ` +
          "the declared writer is not a writer; fix the pairing, not the artefact",
      );
    } else if (r.outcome === "no-browser") {
      console.error(
        `  ? ${r.check} could NOT be asked: it needs Chromium and none is installed ` +
          "(`npx playwright install chromium`, or `--fast` to leave it out). Not a pass",
      );
    }
  }
  const unasked = gates.map((g) => scriptOf(g.command)).filter((c): c is string => c !== undefined && NO_WRITER[c] !== undefined);
  if (unasked.length > 0) {
    console.log(`  (not asked — no writer, by declaration: ${[...new Set(unasked)].join(", ")})`);
  }

  const by = (o: Outcome): Result[] => results.filter((r) => r.outcome === o);
  const assumedCount = results.filter((r) => r.assumed).length;
  const skippedCount = results.filter((r) => r.skipped && !r.assumed).length;
  const skipNotes = [
    ...(skippedCount > 0 ? [`${skippedCount} skipped: inputs unchanged since their last green run`] : []),
    ...(assumedCount > 0 ? [`${assumedCount} not asked: --changed touched nothing they read`] : []),
  ];
  console.log(
    `\n${by("current").length} current${skipNotes.length > 0 ? ` (${skipNotes.join("; ")})` : ""}, ` +
      `${by("judged").length > 0 ? `${by("judged").length} judged, ` : ""}` +
      `${by("regenerated").length} ` +
      `${dryRun ? "stale" : "regenerated"}, ${by("unrepaired").length} unrepaired, ` +
      `${by("no-writer").length} without a writer, ${by("writer-failed").length} with a failing writer, ` +
      `${by("no-browser").length} needing a browser — ${((performance.now() - t0) / 1000).toFixed(0)}s wall`,
  );
  // THE DENOMINATOR, on the line people read — bean `5qq3`. "0 regenerated"
  // over the fast set is not "the tree is current", and a qualifier that lives
  // only on the FIRST line gets read past. Counted against the whole gate set.
  if (!all) {
    const everywhere = repairableGates(loadGates(repoRoot, { all: true }), scripts);
    const asked = new Set(repairable.map((p) => p.check));
    const outside = everywhere.filter((p) => !asked.has(p.check));
    if (outside.length > 0) {
      console.log(
        `NOT covered: ${outside.length} verify/write pair(s) outside this --fast run (browser jobs, other workflows) — ` +
          `\`bun run cat regen\` asks them too: ${outside.map((p) => p.check).join(", ")}`,
      );
    }
  }
  if (dryRun) console.log("--dry-run: nothing was changed.");
  // One decision, in one tested place — bean `g5kt`. `settled` used to be
  // printed and then dropped, so a run that could not reach a fixed point
  // exited 0.
  const verdict = exitCodeFor({ results, settled, dryRun, passes: maxPasses });
  if (verdict.message !== undefined) console.error(`\n${verdict.message}`);
  if (verdict.code !== 0) process.exit(verdict.code);
  // `--dry-run` changed nothing, so there is nothing to review or commit.
  if (!dryRun && by("regenerated").length > 0) {
    // folio-assistant#2247, gap 2: generated files tracked under a gitignored
    // directory are staged by `git add -A` but skipped by `git add -A <dir>`
    // and refused by `git add <file>`. A pathspec-limited add once left the
    // skills LSI out of a commit and `skill:register:check` failed in CI.
    console.log(
      "\nReview `git diff`, then commit the regenerated artefacts with your merge: `git add -A` " +
        "(not a pathspec-limited add, which skips tracked files under an ignored directory). Regenerated: " +
        by("regenerated").map((r) => r.writer ?? r.check).join(", "),
    );
  }
}
