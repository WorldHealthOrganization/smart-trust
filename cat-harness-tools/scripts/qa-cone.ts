/**
 * The dependency cone for the QA working copy: main records what each
 * `qa:refresh` step READ, and a preview reruns only the steps whose reads
 * changed, putting back main's outputs for the rest.
 *
 * @module cat-harness-tools/scripts/qa-cone
 * @graphNode none — a helper of `qa-refresh.ts`; it judges no graph
 *
 * ## The same argument as the writers'
 *
 * `writer-cone.ts` makes it for `derive:publish` writers, and a QA step is a
 * writer of the `qa` tree: a run with the same code and the same state at
 * every path it read, and the same git answers, writes the same files. So the
 * records, the decision ({@link decideWriter}) and the output snapshots
 * (`derive-cache.ts`) are the writers' own, keyed `qa:<step id>` so they never
 * collide with a writer of the same name.
 *
 * ## When it is on
 *
 * - **Record** (`CAT_WRITER_RECORD=1` and `strace` runs): every step runs
 *   traced; a step that succeeded, reached no `traced` input site and whose
 *   trace can be enumerated is recorded, with a snapshot of what it wrote.
 *   Recording never changes a step's outcome: a traced run that fails is asked
 *   again untraced, and that answer stands.
 * - **Skip** (`CAT_WRITER_SKIP=1`, a preview): a step whose record matches is
 *   not run, and its recorded outputs are put back. Any doubt runs it.
 * - Otherwise nothing changes: every step runs.
 *
 * Steps run in their declared order, and each is decided just before it would
 * run, so a step that reads an earlier step's output compares what that step
 * just wrote or put back.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { commitStaged, hasEntry, restoreOutputs, stageOutputs } from "./derive-cache.ts";
import { FileDigests, toolsLine } from "./input-hash.ts";
import {
  decideWriter,
  emptyRecords,
  loadWriterRecords,
  projectedReadsOf,
  readTraceFile,
  saveWriterRecords,
  STRACE_SEES,
  tracedArgv,
  WRITER_CONE_DIR,
  WRITER_OUTPUTS_DIR,
  WRITER_RECORD_ENV,
  WRITER_SKIP_ENV,
  writerRecordOf,
  type WriterBase,
  type WriterDecision,
  type WriterRecords,
} from "./writer-cone.ts";
import { NOT_APPLICABLE_EXIT } from "./lib/not-applicable.ts";
import { openTrace } from "../schemas/sdlc/input-trace.ts";

/** Where the QA steps' records live, beside the writers' (the same cache keeps both). */
export const QA_RECORD_FILE = join(WRITER_CONE_DIR, "qa-records.json");

/** The key a QA step's record and snapshot are filed under. */
export const qaKey = (id: string): string => `qa:${id}`;

/** What the cone needs to know about one step. */
export interface ConeStep {
  id: string;
  /** `bun run cat` arguments. */
  run: readonly string[];
  /** Repository-relative globs of what it writes (`*` one segment, `**` any). */
  writes: readonly string[];
}

/** A glob of {@link ConeStep.writes} as a matcher. */
export function globMatcher(globs: readonly string[]): (rel: string) => boolean {
  const res = globs.map(
    (g) =>
      new RegExp(
        "^" +
          g
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*\*/g, "\u0000")
            .replace(/\*/g, "[^/]*")
            .replace(/\u0000/g, ".*") +
          "$",
      ),
  );
  return (rel) => res.some((r) => r.test(rel));
}

/**
 * The key of a step besides its reads: the tools line, its arguments, the
 * package script they name and `bun.lock`. Its source files are in the traced
 * reads (they sit in the checkout), as for a writer whose audit does not
 * clear (`writerBase`); such a record is evidence, which the main dry run tests.
 */
export function qaBase(root: string, scripts: Readonly<Record<string, string>>, step: ConeStep, digests: FileDigests): WriterBase {
  const h = createHash("sha256");
  h.update(`qa-cone base v1\n${toolsLine()}run ${JSON.stringify(step.run)}\nscript ${scripts[step.run[0] ?? ""] ?? "(a path)"}\n`);
  if (existsSync(join(root, "bun.lock"))) h.update(`bun.lock\0${digests.digest("bun.lock")}\n`);
  return { hash: h.digest("hex"), audit: "a QA step: keyed on its traced reads, not on an audited closure" };
}

export type ConeMode = "record" | "skip" | "off";

/** Whether `strace` runs here (recording needs it). */
export function straceWorks(): boolean {
  // input-site: inert #50824495 — probes for the tracer; its answer only turns recording on or off
  const r = spawnSync("strace", ["-f", "-qq", "-o", "/dev/null", "true"], { stdio: "ignore" });
  return r.status === 0;
}

/** Which mode this run is in. `straceWorks` is asked only when recording is asked for. */
export function coneMode(env: Readonly<Record<string, string | undefined>>, straceWorks: () => boolean): ConeMode {
  if (env[WRITER_RECORD_ENV] === "1") return straceWorks() ? "record" : "off";
  if (env[WRITER_SKIP_ENV] === "1") return "skip";
  return "off";
}

/** One step's run, as `qa-refresh.ts` counts it. */
export interface StepRun {
  id: string;
  exit: number | null;
  seconds: number;
}

/**
 * Runs the steps of one `qa:refresh` through the cone. `run(step, prefix, env)`
 * runs a step for real (with `prefix` argv before `bun`, and `env` for the
 * child); this decides whether to call it, and records what it did.
 */
export class QaCone {
  readonly mode: ConeMode;
  private readonly records: WriterRecords;
  private readonly prev: WriterRecords | undefined;
  private readonly outDir: string;
  private readonly anyOutput: (rel: string) => boolean;
  private readonly digests: FileDigests;
  /** Each step's decision, for the log and the report. */
  readonly log: { id: string; did: "skipped" | "ran"; why: string }[] = [];

  constructor(
    private readonly root: string,
    private readonly scripts: Readonly<Record<string, string>>,
    steps: readonly ConeStep[],
    mode: ConeMode,
    sha: string,
  ) {
    this.mode = mode;
    this.records = emptyRecords(sha);
    this.prev = mode === "skip" ? loadWriterRecords(root, join(root, QA_RECORD_FILE)) : undefined;
    this.outDir = join(root, WRITER_OUTPUTS_DIR);
    this.anyOutput = globMatcher(steps.flatMap((s) => s.writes));
    this.digests = new FileDigests(root);
  }

  /** The decision for `step` now, in skip mode. */
  decide(step: ConeStep): WriterDecision {
    this.digests.clear();
    return decideWriter(this.prev, qaKey(step.id), qaBase(this.root, this.scripts, step, this.digests), this.root, this.digests);
  }

  /** Run (or skip) one step. */
  step(step: ConeStep, run: (prefix: readonly string[], env?: Record<string, string | undefined>) => StepRun): StepRun {
    const key = qaKey(step.id);
    if (this.mode === "skip") {
      const t = Date.now();
      const d = this.decide(step);
      if (d.skip && this.prev !== undefined && hasEntry(this.outDir, key, this.prev.sha) && restoreOutputs(this.outDir, key, this.prev.sha, this.root, [])) {
        this.log.push({ id: step.id, did: "skipped", why: d.why });
        console.log(`qa:refresh: skipped ${step.id}: ${d.why}; put back its outputs from ${this.prev.sha.slice(0, 12)}`);
        return { id: step.id, exit: 0, seconds: Math.round((Date.now() - t) / 1000) };
      }
      const why = d.skip ? "its recorded outputs are not here" : d.why;
      this.log.push({ id: step.id, did: "ran", why });
      console.log(`qa:refresh: ${step.id} runs: ${why}`);
      return run([]);
    }
    if (this.mode !== "record") return run([]);
    return this.recorded(step, run);
  }

  private recorded(step: ConeStep, run: (prefix: readonly string[], env?: Record<string, string | undefined>) => StepRun): StepRun {
    const key = qaKey(step.id);
    const before = qaBase(this.root, this.scripts, step, new FileDigests(this.root));
    const trace = openTrace(this.root);
    // input-site: inert #adc3af68 — a scratch file for the trace, removed before this returns
    const traceLog = join(tmpdir(), `qa-cone-${process.pid}-${step.id.replace(/[^\w.-]/g, "_")}.strace`);
    const first = run(tracedArgv([], traceLog), trace.env);
    try {
      if (first.exit !== 0) {
        this.records.unrecorded[key] = `the traced run exited ${first.exit ?? "on a signal"}`;
        trace.reached();
        // Not applicable here is an answer, not a tracer failure: it is not asked again.
        return first.exit === NOT_APPLICABLE_EXIT ? first : run([]);
      }
      const digests = new FileDigests(this.root);
      const own = globMatcher(step.writes);
      const reached = trace.reached([], STRACE_SEES);
      const projected = projectedReadsOf(trace.projected(), this.root);
      const rec = writerRecordOf({
        sha: this.records.sha,
        ran: true,
        before,
        after: qaBase(this.root, this.scripts, step, digests),
        reads: readTraceFile(traceLog, this.root, own, (rel) => !this.anyOutput(rel), new Set(projected.keys())),
        reached,
        root: this.root,
        digests,
        projected,
      });
      if ("none" in rec) this.records.unrecorded[key] = rec.none;
      else {
        this.records.writers[key] = rec;
        const outputs = Object.keys(rec.outputs).filter((p) => rec.outputs[p]!.startsWith("file "));
        commitStaged(this.outDir, key, this.records.sha, stageOutputs(this.outDir, key, this.records.sha, this.root, outputs, []));
      }
    } catch (e) {
      // Recording is never allowed to change the step's outcome.
      this.records.unrecorded[key] = (e as Error).message;
    } finally {
      rmSync(traceLog, { force: true });
    }
    return first;
  }

  /** Save the records (record mode), and say what the cone did. */
  finish(): void {
    if (this.mode === "record") {
      saveWriterRecords(this.root, this.records, join(this.root, QA_RECORD_FILE));
      const un = Object.entries(this.records.unrecorded);
      console.log(`qa:refresh: QA step records: ${Object.keys(this.records.writers).length} recorded, ${un.length} not (${QA_RECORD_FILE})`);
      for (const [k, why] of un) console.log(`  not recorded: ${k} — ${why}`);
    }
    if (this.mode === "skip") {
      const skipped = this.log.filter((l) => l.did === "skipped").length;
      console.log(
        `qa:refresh: QA cone ${this.prev ? `against ${this.prev.sha.slice(0, 12)}` : "with no records from main"}: ${skipped} step(s) skipped, ${this.log.length - skipped} ran`,
      );
    }
  }
}
