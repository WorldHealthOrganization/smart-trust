/**
 * What each publish-time writer READ and WROTE, recorded from its own run, for
 * the rerun-and-measure deploy.
 *
 * @module cat-harness-tools/scripts/writer-cone
 * @graphNode none — a helper of `derive-at-publish.ts`; it judges no graph
 *
 * ## Why records and not declarations
 *
 * Most of a deploy's files come out of writers, and no writer says which
 * outputs depend on which inputs; a hand-kept list would drift (inputs are
 * declared or derived, never hand-narrowed: `task-io.ts`). So, as `ci-cone.ts`
 * does for checks, the read set is DERIVED from the run itself: each writer
 * runs under `strace`, and what it touched inside the checkout is recorded
 * with the state of each path, beside what it wrote.
 *
 * ## The argument, the same one `ci-cone.ts` makes
 *
 * Take a writer run W that read the set R and wrote the set O. A later run with
 * the same code (the fingerprint hashes the script's import closure and the
 * audited environment) and the same state at every path in R and every git
 * answer it got takes the same path, reads the same R and writes the same O.
 * So when every recorded read matches, its outputs as the last full deploy
 * published them ARE what it would write, and the writer need not run. A run
 * that reached an input the audit cannot hash (a `traced` site), read a path
 * and then rewrote it, or whose fingerprint moved while it ran, records
 * nothing, so that writer always runs.
 *
 * ## What this step does: RECORD, skip nothing
 *
 * With `CAT_WRITER_RECORD=1` (and a working `strace`), `derive:publish` runs
 * every writer traced and writes {@link WRITER_RECORD_FILE}. Nothing is
 * skipped and every verdict is the writer's own: a traced run that fails is
 * asked again untraced, and that answer stands. The deploy keeps the file
 * next to the build stamp, so the NEXT deploy can ask {@link decideWriter}
 * which writers could have been skipped, and the dry run can check that
 * answer against what the full build wrote.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { gitKey, gitState, MAX_TRACE_BYTES, parseTrace, pathState, readState, stateLike, STRACE_ARGS, TRACER_VERSION, type GitCall, type ReadSet } from "./ci-cone.ts";
import { fingerprint, FileDigests, toolsLine } from "./input-hash.ts";
import { projectedReads, type ProjectionName } from "../schemas/sdlc/read-projections.ts";

/** Bump when the record's meaning changes; a record from another version is ignored, so every writer runs. 2: each record names its own commit and keeps its rewritten files, so it can be carried forward (#1702). */
export const WRITER_RECORD_VERSION = 2;
// input-site: inert #f12d34f1 — names the build-output directory the records live in; no writer reads it
export const WRITER_CONE_DIR = join("build", "writer-cone");
export const WRITER_RECORD_FILE = join(WRITER_CONE_DIR, "records.json");
/** Each recorded writer's outputs, in `derive-cache.ts` entries keyed by the recording commit. */
export const WRITER_OUTPUTS_DIR = join(WRITER_CONE_DIR, "outputs");
/** `1`: skip a writer whose records match, putting back its recorded outputs (previews; owner 2026-10-31 14:32Z). */
export const WRITER_SKIP_ENV = "CAT_WRITER_SKIP";
/** Turns recording on in `derive:publish`. */
export const WRITER_RECORD_ENV = "CAT_WRITER_RECORD";

/** One writer's traced run. */
export interface WriterRecord {
  /**
   * The main commit whose run traced it, and whose outputs entry
   * ({@link WRITER_OUTPUTS_DIR}) holds what it wrote. A record carried forward
   * by an incremental record ({@link carryRecord}) keeps its own commit, so it
   * can differ from the file's {@link WriterRecords.sha}.
   */
  sha: string;
  /** The fingerprint WITHOUT the tree: script closure, audited environment, tool versions ({@link writerBase}). */
  base: string;
  /** `clean` when the input-site audit cleared the writer's closure; otherwise why not, and the record is evidence, not proof. */
  audit: string;
  /** Every path it touched inside the checkout and did not write, with its state after the run. */
  reads: Record<string, string>;
  /** Every git command it ran, and what that command answered after the run. */
  git: Record<string, string>;
  /** Every path it wrote that exists after the run, with its state. */
  outputs: Record<string, string>;
  /** Files it read and then rewrote, kept as its reads; carried with the record so a later run can still check them against other writers' outputs. */
  rewritten?: string[];
}

export interface WriterRecords {
  version: number;
  tracer: number;
  /** The main commit whose deploy wrote this file. */
  sha: string;
  writers: Record<string, WriterRecord>;
  /** Writers that ran and recorded nothing, with why: they always run. */
  unrecorded: Record<string, string>;
  /** Index writers kept for previews to borrow without a record: the commit whose outputs entry holds them. Absent: {@link sha}. */
  kept?: Record<string, string>;
}

/**
 * The recorded outputs that do not hash, as the checkout now holds them, to
 * what the record says (cat-harness-tools#1702): asked right after a skip put
 * them back, so an entry damaged or swapped in the published ref is a rerun,
 * never stale pages.
 */
export function outputsDiffer(root: string, rec: WriterRecord, digests: FileDigests = new FileDigests(root)): string[] {
  return Object.entries(rec.outputs).filter(([p, state]) => pathState(root, p, digests) !== state).map(([p]) => p);
}

/** The commit whose outputs entry holds `writer`'s outputs: its record's, else the commit it was kept at, else the file's. */
export function entryShaOf(records: WriterRecords, writer: string): string {
  return records.writers[writer]?.sha ?? records.kept?.[writer] ?? records.sha;
}

/**
 * An incremental record (bean fwtz; cat-harness-tools#1702): `writer` was
 * skipped against `prev` because every read it recorded still matches, so its
 * record is still a true record of a run over this tree. It is kept as it is,
 * with its own commit, and its outputs entry stays where it is. Only writers
 * whose reads moved are traced again, so a push to main pays for strace on what
 * changed, not on the whole build. False when `prev` holds no record for it.
 */
export function carryRecord(records: WriterRecords, prev: WriterRecords, writer: string): boolean {
  const rec = prev.writers[writer];
  if (rec === undefined) return false;
  records.writers[writer] = rec;
  delete records.unrecorded[writer];
  return true;
}

export function emptyRecords(sha: string): WriterRecords {
  return { version: WRITER_RECORD_VERSION, tracer: TRACER_VERSION, sha, writers: {}, unrecorded: {} };
}

/** The record file, or `undefined` when it is absent, corrupt or of another version: then every writer runs. */
export function loadWriterRecords(root: string, file = join(root, WRITER_RECORD_FILE)): WriterRecords | undefined {
  try {
    const raw = JSON.parse(readFileSync(file, "utf-8")) as WriterRecords;
    if (raw.version === WRITER_RECORD_VERSION && raw.tracer === TRACER_VERSION && typeof raw.writers === "object" && raw.writers !== null) return raw;
  } catch {
    /* absent or corrupt */
  }
  return undefined;
}

export function saveWriterRecords(root: string, records: WriterRecords, path = join(root, WRITER_RECORD_FILE)): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(records, null, 1)}\n`);
}

/** What a writer record is keyed on besides its reads, or why nothing can be. */
export type WriterBase = { hash: string; audit: string } | { undetermined: string };

/**
 * The key a writer record is keyed on besides its reads: the input-hash
 * fingerprint WITHOUT the tree (script closure, audited environment, tools),
 * as `ci-cone.ts` `coneFingerprint` does, when the input-site audit clears
 * the closure (`audit: "clean"`).
 *
 * Measured 2026-10-31: none of the 46 publish-time writers clears the audit
 * today (unannotated env, clock and spawn sites in shared modules), so that
 * alone would record nothing. The trace still sees every source file the run
 * loads, since they sit in the checkout, so "same code" is in the recorded
 * reads either way. What only the audit can vouch for is the environment, the
 * clock and the network. So a writer that fails the audit is keyed on the tools,
 * its script line and `bun.lock` (packages are not traced), and its record says
 * why (`audit`). Such a record is EVIDENCE for the dry run to test against the
 * full build, never proof on its own.
 */
export function writerBase(root: string, scripts: Readonly<Record<string, string>>, writer: string, digests: FileDigests): WriterBase {
  let why: string;
  try {
    const fp = fingerprint(root, scripts, [writer], { inputs: [] }, digests, undefined, { treeReplayed: true });
    if ("hash" in fp) return { hash: fp.hash, audit: "clean" };
    why = fp.undetermined;
  } catch (e) {
    why = (e as Error).message;
  }
  const command = scripts[writer];
  if (command === undefined) return { undetermined: `\`${writer}\` is not a package script` };
  const h = createHash("sha256");
  h.update(`writer-cone weak base v1\n${toolsLine()}script ${writer} = ${command}\n`);
  if (existsSync(join(root, "bun.lock"))) h.update(`bun.lock\0${digests.digest("bun.lock")}\n`);
  return { hash: h.digest("hex"), audit: why };
}

/**
 * `traced` input-site lines whose every read a writer run under strace sees
 * for itself, inside the checkout: `git-refs` spawns git, whose command line
 * `gitReplayable` judges and the next run replays; `process-presentations`
 * loads a manifest file by path, which is an `openat` like any other. A site
 * that reads outside the checkout (a branch store, the beans CLI, the
 * network) is not here: strace leaves those paths out of a read set.
 */
export const STRACE_SEES: readonly string[] = ["git-refs: git", "process-presentations: computed load"];

/** Whether `rel` is one of `outputs` (repo-relative; a directory ends in `/`) or inside one. */
export function underOutputs(outputs: readonly string[]): (rel: string) => boolean {
  const dirs = outputs.filter((o) => o.endsWith("/")).map((o) => o.slice(0, -1));
  const files = new Set(outputs.filter((o) => !o.endsWith("/")));
  return (rel) => files.has(rel) || dirs.some((d) => rel === d || rel.startsWith(`${d}/`));
}

/** `argv`, run under the tracer, writing its trace to `log`. */
export function tracedArgv(argv: readonly string[], log: string): string[] {
  return ["strace", ...STRACE_ARGS, "-o", log, ...argv];
}

/** The trace at `log` as a read set, or why it cannot be one. */
export function readTraceFile(
  log: string,
  root: string,
  ownOutput?: (rel: string) => boolean,
  rewriteAsInput?: (rel: string) => boolean,
  countOpens?: ReadonlySet<string>,
): ReadSet {
  if (!existsSync(log)) return { undetermined: "no trace was written" };
  const size = statSync(log).size;
  if (size > MAX_TRACE_BYTES) return { undetermined: `the trace is ${size} bytes, more than ${MAX_TRACE_BYTES}` };
  return parseTrace(readFileSync(log, "utf-8"), root, { writes: "collect", ownOutput, rewriteAsInput, ...(countOpens ? { countOpens } : {}) });
}

/** A run's projected reads (`read-projections.ts`), keyed by repository-relative path. */
export type ProjectedReads = ReadonlyMap<string, { name: ProjectionName | undefined; count: number }>;

/** The projected-read lines of a run's input trace, as {@link ProjectedReads} under `root`. Paths outside it are dropped. */
export function projectedReadsOf(lines: readonly string[], root: string): ProjectedReads {
  const roots = [...new Set([resolve(root), realpathOr(root)])];
  const out = new Map<string, { name: ProjectionName | undefined; count: number }>();
  for (const [abs, v] of projectedReads(lines)) {
    const r = roots.find((x) => abs.startsWith(`${x}/`));
    if (r === undefined) continue;
    const rel = abs.slice(r.length + 1);
    const prev = out.get(rel);
    out.set(rel, prev === undefined ? v : { name: prev.name === v.name ? v.name : undefined, count: prev.count + v.count });
  }
  return out;
}

function realpathOr(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

/**
 * The projection a path is recorded through, or `undefined`: only when every
 * open of it in the trace was reported as projected, under one projection.
 */
export function projectionFor(rel: string, reads: ReadSet, projected: ProjectedReads | undefined): ProjectionName | undefined {
  if (projected === undefined || "undetermined" in reads) return undefined;
  const p = projected.get(rel);
  if (p?.name === undefined) return undefined;
  const opens = reads.opened?.[rel];
  return opens !== undefined && opens <= p.count ? p.name : undefined;
}

/**
 * The record of one traced writer run, or why it records nothing. It needs
 * all of: the run succeeded, it reached no `traced` site, its trace can be
 * enumerated, and its fingerprint was the same before and after.
 */
export function writerRecordOf(a: {
  sha: string;
  ran: boolean;
  before: WriterBase;
  after: WriterBase;
  reads: ReadSet;
  reached: string | undefined;
  root: string;
  digests: FileDigests;
  /** The run's projected reads; a path every open of which was reported is recorded through its projection. */
  projected?: ProjectedReads;
  /** Answers a git call now; tests replace it. */
  git?: (root: string, c: GitCall) => string;
}): WriterRecord | { none: string } {
  if (!a.ran) return { none: "the writer did not succeed" };
  if ("undetermined" in a.before) return { none: a.before.undetermined };
  if ("undetermined" in a.after || a.after.hash !== a.before.hash) return { none: "its script, imports or audited environment moved while it ran" };
  if (a.reached !== undefined) return { none: `the run reached a traced input site (${a.reached})` };
  if ("undetermined" in a.reads) return { none: a.reads.undetermined };
  // A path it probed absent and then created is its own output, never an
  // input: a skipped writer's outputs are put back from the published site.
  const reads: Record<string, string> = {};
  const listed = new Set(a.reads.listed ?? []);
  for (const p of a.reads.paths) reads[p] = readState(a.root, p, a.digests, listed, projectionFor(p, a.reads, a.projected));
  const outputs: Record<string, string> = {};
  for (const p of a.reads.writes ?? []) {
    const s = pathState(a.root, p, a.digests);
    if (s !== "absent") outputs[p] = s;
  }
  const git: Record<string, string> = {};
  for (const c of a.reads.git) git[gitKey(c)] = (a.git ?? gitState)(a.root, c);
  return { sha: a.sha, base: a.before.hash, audit: a.before.audit, reads, git, outputs };
}

/**
 * What a skipped writer must have put back: its declared outputs and every
 * file its traced run actually wrote outside them. A write into another
 * writer's declared outputs cannot be put back without clobbering that writer,
 * so the writer is not recorded (bean fwtz; owner 2026-10-31 21:45Z: "rerun
 * only the scripts whose inputs moved, and publish what they actually wrote").
 */
export function snapshotPaths(
  declared: readonly string[],
  written: readonly string[],
  ownDeclared: (rel: string) => boolean,
  anyDeclared: (rel: string) => boolean,
): { paths: string[] } | { none: string } {
  const extra = written.filter((p) => !ownDeclared(p)).sort();
  const foreign = extra.find((p) => anyDeclared(p));
  if (foreign !== undefined) return { none: `the writer wrote ${foreign}, which another writer declares as its output` };
  return { paths: [...declared, ...extra] };
}

/** How many changed reads {@link changedWhy} names before it only counts. */
export const CHANGED_SHOWN = 8;

/** `a changed`, or `a changed (+3 more: b, c, d)`: the first changed read keeps its old wording. */
export function changedWhy(changed: readonly string[]): string {
  const [first, ...rest] = changed;
  if (rest.length === 0) return `${first} changed`;
  const shown = rest.slice(0, CHANGED_SHOWN - 1);
  const more = rest.length - shown.length;
  return `${first} changed (+${rest.length} more: ${shown.join(", ")}${more > 0 ? `, and ${more} others` : ""})`;
}

/** `proof`: the record's audit was clean, so the skip rests on the argument above; otherwise it is evidence the dry run must confirm. */
export type WriterDecision =
  | { skip: true; sha: string; proof: boolean; why: string }
  | { skip: false; why: string; cause?: ChurnCause };

/** What made a recorded writer run again, in a form the churn report can group by. */
export type ChurnCause = { kind: "script" } | { kind: "path"; path: string } | { kind: "git"; args: string[] };

/**
 * Whether `writer` could be skipped now: its fingerprint and the state of
 * every path it read, and every git answer it got, match its record exactly.
 * Asked BEFORE any writer runs, so a predecessor's outputs are compared as the
 * checkout holds them then; a writer whose predecessor runs is asked again
 * after it (the dry run's job, not this function's).
 */
export function decideWriter(
  records: WriterRecords | undefined,
  writer: string,
  base: WriterBase,
  root: string,
  digests: FileDigests,
  git: (root: string, c: GitCall) => string = gitState,
): WriterDecision {
  if (records === undefined) return { skip: false, why: "no writer records from a full deploy" };
  const rec = records.writers[writer];
  if (rec === undefined) return { skip: false, why: records.unrecorded[writer] ? `not recorded: ${records.unrecorded[writer]}` : `the deploy at ${records.sha.slice(0, 12)} recorded nothing for it` };
  if ("undetermined" in base) return { skip: false, why: `no key: ${base.undetermined}` };
  if (base.hash !== rec.base) return { skip: false, why: "its script, imports, audited environment or tools changed", cause: { kind: "script" } };
  // Every changed read, not only the first: the first is often the checkout's
  // own listing (`.`), which hid what else moved (bean fwtz, S-CI3).
  const changed: string[] = [];
  for (const [p, state] of Object.entries(rec.reads)) {
    let now: string;
    try {
      now = stateLike(root, p, digests, state);
    } catch (e) {
      return { skip: false, why: `could not read ${p}: ${(e as Error).message}` };
    }
    if (now !== state) changed.push(p);
  }
  if (changed.length > 0) return { skip: false, why: changedWhy(changed.map((p) => p || ".")), cause: { kind: "path", path: changed[0]! } };
  for (const [key, state] of Object.entries(rec.git)) {
    let call: GitCall;
    try {
      const [cwd, ...args] = JSON.parse(key) as string[];
      call = { cwd: cwd!, args };
    } catch {
      return { skip: false, why: `an unreadable git record ${key}` };
    }
    if (git(root, call) !== state) return { skip: false, why: `git ${call.args.join(" ")} answers differently`, cause: { kind: "git", args: call.args } };
  }
  const proof = rec.audit === "clean";
  return {
    skip: true,
    sha: rec.sha,
    proof,
    why: `reads unchanged since ${rec.sha.slice(0, 12)} (${Object.keys(rec.reads).length} paths, ${Object.keys(rec.outputs).length} outputs)${proof ? "" : `; evidence only, the audit did not clear it: ${rec.audit}`}`,
  };
}

/** One writer, judged after a full build: could it have been skipped, and would that have been right? */
export type WriterVerdict =
  | { writer: string; verdict: "rerun"; why: string }
  | { writer: string; verdict: "skip-safe"; proof: boolean; outputs: number }
  | { writer: string; verdict: "skip-unsafe"; proof: boolean; differs: string[] };

/**
 * The dry run of the rerun-and-measure switch for writers. After a FULL
 * build, every writer the previous deploy recorded is asked {@link
 * decideWriter} against the checkout as it stands (its predecessors' fresh
 * outputs included). One that could have been skipped is then checked: each
 * output its record names must be what this build wrote, and no file this
 * build wrote under its declared outputs may be missing from the record. A
 * `skip-unsafe` writer is one the switch would have served stale.
 */
export function verifyWriters(o: {
  prev: WriterRecords | undefined;
  writers: readonly string[];
  base: (writer: string) => WriterBase;
  root: string;
  digests: FileDigests;
  /** Every file under the writer's declared outputs now, repo-relative. */
  filesNow: (writer: string) => string[];
  git?: (root: string, c: GitCall) => string;
}): WriterVerdict[] {
  return o.writers.map((w): WriterVerdict => {
    const d = decideWriter(o.prev, w, o.base(w), o.root, o.digests, o.git);
    if (!d.skip) return { writer: w, verdict: "rerun", why: d.why };
    const rec = o.prev!.writers[w]!;
    const differs: string[] = [];
    for (const [p, state] of Object.entries(rec.outputs)) if (pathState(o.root, p, o.digests) !== state) differs.push(p);
    for (const p of o.filesNow(w)) if (!(p in rec.outputs)) differs.push(`${p} (not in the record)`);
    return differs.length
      ? { writer: w, verdict: "skip-unsafe", proof: d.proof, differs: differs.sort() }
      : { writer: w, verdict: "skip-safe", proof: d.proof, outputs: Object.keys(rec.outputs).length };
  });
}

/** The step summary for {@link verifyWriters}: unsafe first, bounded. */
export function verifySummary(v: readonly WriterVerdict[], prevSha?: string): string {
  const unsafe = v.filter((x) => x.verdict === "skip-unsafe");
  const safe = v.filter((x) => x.verdict === "skip-safe");
  const rerun = v.filter((x) => x.verdict === "rerun");
  const lines = [
    "### Writers, rerun and measure — dry run (bean `fwtz`, option B)",
    "",
    `**${unsafe.length ? "unsafe" : "safe"}**${prevSha ? ` · records from ${prevSha.slice(0, 12)}` : ""} · could skip ${safe.length + unsafe.length} of ${v.length} · would have been stale ${unsafe.length} · must rerun ${rerun.length}`,
    "",
  ];
  for (const x of unsafe) if (x.verdict === "skip-unsafe") lines.push(`- \`${x.writer}\` would have been STALE${x.proof ? "" : " (evidence record)"}: ${x.differs.slice(0, 5).map((p) => `\`${p}\``).join(", ")}${x.differs.length > 5 ? ` … ${x.differs.length - 5} more` : ""}`);
  for (const x of safe) if (x.verdict === "skip-safe") lines.push(`- \`${x.writer}\` could skip: ${x.outputs} output(s) matched${x.proof ? " (proof)" : " (evidence)"}`);
  for (const x of rerun.slice(0, 20)) if (x.verdict === "rerun") lines.push(`- \`${x.writer}\` reruns: ${x.why}`);
  if (rerun.length > 20) lines.push(`- … ${rerun.length - 20} more rerun`);
  return lines.join("\n") + "\n";
}

// ── The churn report (owner, 2026-11-01 07:32Z: "track what changed and input/output in render pipeline") ──

/** Where the churn report is written, beside the records it reads. */
export const WRITER_CHURN_FILE = join(WRITER_CONE_DIR, "churn.json");

/** What one writer did in a build that could skip writers. */
export type ChurnEntry = {
  writer: string;
  did: "skipped" | "ran" | "reused";
  why: string;
  cause?: ChurnCause;
  seconds: number;
};

/** One reason for reruns: what changed, who wrote it, and which writers ran again because of it. */
export type ChurnGroup = { cause: string; writtenBy: string; reran: string[]; seconds: number };

export type ChurnReport = {
  against: string;
  skipped: number;
  ran: number;
  reused: number;
  groups: ChurnGroup[];
  writers: ChurnEntry[];
};

/**
 * Group the writers that ran by what made them run. A changed path is put down
 * to the writer whose record, or whose declared outputs, hold it; any other
 * path came with the commit itself ("the commit"). Groups are ordered by the
 * seconds they cost, so the first line is the churn most worth removing.
 */
export function churnReport(
  entries: readonly ChurnEntry[],
  against: string,
  writerOf: (path: string) => string | undefined,
): ChurnReport {
  const groups = new Map<string, ChurnGroup>();
  for (const e of entries) {
    if (e.did !== "ran") continue;
    const c = e.cause;
    const [cause, writtenBy] =
      c === undefined ? [e.why, "-"]
      : c.kind === "script" ? ["its script, imports or tools", "the commit"]
      : c.kind === "git" ? [`git ${c.args.join(" ")}`, "the repository"]
      : [c.path || ".", writerOf(c.path) ?? "the commit"];
    const g = groups.get(cause) ?? { cause, writtenBy, reran: [], seconds: 0 };
    g.reran.push(e.writer);
    g.seconds += e.seconds;
    groups.set(cause, g);
  }
  const count = (d: ChurnEntry["did"]) => entries.filter((e) => e.did === d).length;
  return {
    against,
    skipped: count("skipped"),
    ran: count("ran"),
    reused: count("reused"),
    groups: [...groups.values()].sort((a, b) => b.seconds - a.seconds || a.cause.localeCompare(b.cause)),
    writers: [...entries].sort((a, b) => a.writer.localeCompare(b.writer)),
  };
}

/** The report as a Markdown table, for a job summary. */
export function renderChurn(r: ChurnReport): string {
  const cell = (s: string) => s.replace(/[\\|]/g, "\\$&");
  const lines = [
    `### Render churn against ${r.against.slice(0, 12)}`,
    "",
    `${r.skipped} writer(s) skipped, ${r.reused} reused from the cache, ${r.ran} ran.`,
    "",
  ];
  if (r.groups.length === 0) return [...lines, "Nothing ran again."].join("\n") + "\n";
  lines.push("| What changed | Written by | Ran again because of it | Seconds |", "|---|---|---|---|");
  for (const g of r.groups) lines.push(`| \`${cell(g.cause)}\` | ${cell(g.writtenBy)} | ${g.reran.map((w) => `\`${w}\``).join(", ")} | ${g.seconds.toFixed(0)} |`);
  return lines.join("\n") + "\n";
}
