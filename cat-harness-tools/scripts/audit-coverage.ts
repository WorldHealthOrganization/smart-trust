#!/usr/bin/env bun
/**
 * Which audits reach which KIND of node — measured, with denominators.
 *
 * Answers "what audits this kind of node", so that question is not answered
 * from whatever signal is at hand (a sidecar count says nothing about gates).
 * `check:kind-validators` asks whether a kind can be *typed*; this asks who
 * *judges* it. A kind can be typed and audited by nothing. Like that gate, it
 * uses the open registry as the denominator and REPORTS a gap rather than
 * failing.
 *
 * ## Coverage is DECLARED, not inferred
 *
 * A gate names the kinds it covers in its own module docblock:
 *
 *     @covers bean-defs, beans
 *     @covers none — a language-level check, not a graph audit
 *     @covers computed — it sweeps whichever kinds declare `nodeSchemas`
 *
 * Grepping a gate's source for kind names or directories would be wrong both
 * ways (a gate using `directoriesForGraph` names no path at all). An
 * undeclared gate is `undeclared` — counted, printed, never zero;
 * `--require-all` makes that a failure.
 *
 * - **`@covers none`** — the gate has decided it audits no declared graph
 *   (`check:workflows` reads `.github/workflows/`), distinct from not saying.
 * - **`@covers computed`** — the covered set is derived at run time
 *   (`check:kind-validators` walks whichever kinds declare `nodeSchemas`). It
 *   counts as neither coverage nor a gap; that gate reports its own kinds.
 *
 * ## Three states per kind, kept distinguishable
 *
 * 1. **no directory** — no layer declares a directory of this kind (a
 *    nested kind such as `bean-defs` inside `beans/`, or one this layer
 *    does not have). NOT a gap.
 * 2. **a directory with no files** — a determined empty.
 * 3. **files, and no criterion and no gate reaching them** — the finding.
 *
 * Every row prints all four counts and names its state. A declared directory
 * absent from the checkout is `unknown`.
 *
 * ## The record holds COVERAGE; the census is printed
 *
 * `files` and `sidecars` are printed, not written to the sidecar: they move
 * on any commit that adds a file. The sidecar records the coverage relation —
 * declared directories, criteria reaching the kind, gates declaring it, and
 * the resulting state — plus `hasFiles`, the one census fact the states need.
 * `files` counts files (excluding QA sidecars and dot-prefixed paths), not
 * nodes; only a kind's own validator knows which files are nodes.
 *
 * ## What `--check` fails on
 *
 * `--check` fails on a finding that is **NEW** against a baseline (a kind
 * that lost its audit, a gate that stopped declaring). Standing findings are
 * reported and do not fail; `--strict` fails on them too. The baseline is the
 * working copy, or `--against <ref>` (a `qa-reports` ref); a baseline that is
 * not there is UNKNOWN — reported, never a pass, never a failure.
 *
 * `--check` does NOT write: a checker that repairs what it reports cannot
 * fail twice.
 *
 * Usage:
 *   bun run cat audit:coverage                 # print the report, write the sidecar
 *   bun run cat audit:coverage --check         # judge, write nothing; fail on a NEW finding
 *   bun run cat audit:coverage --check --against main   # ...new against the qa-reports branch
 *   bun run cat audit:coverage --strict        # ...and fail on a kind nothing JUDGES
 *                                          #    (unaudited or typed-only alike)
 *   bun run cat audit:coverage --require-all   # ...and on any gate that has not declared
 *
 * @module scripts/audit-coverage
 * @covers none — it measures coverage rather than auditing a graph; a row about
 *   itself would be a criterion that cannot fail.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import {
  type ResolvedDirectory,
  declaredKinds,
  defaultGraphTypologies,
  layerRootsIn,
  readDeclaration,
  repoRootFor,
  resolveDirectories,
} from "../schemas/kg/cat-harness.js";
import { KG_CRITERIA, KG_SUBJECT_GRAPH_TYPOLOGIES, type KgQaReport, type KgSubjectKind } from "../schemas/sdlc/kg-qa.js";
import { gitFiles } from "../schemas/sdlc/git-corpus.ts";
import { attestationsHomeFor, kgAttestationTrees, storedAdversarialReviews } from "../schemas/sdlc/qa-attestations.ts";
import { contentIsOffCheckout, resolveSubgraphSource, type SubgraphSource } from "../schemas/kg/subgraph-source.ts";
// The same single reader `check:declared-dirs` uses, so the two gates cannot
// disagree about whether a tip-keyed graph is readable here (bean `9ofm`).
import { routePresence, tipPresence } from "./check-declared-dirs.ts";
import { type Gate, SCRIPT_EXEMPTIONS, loadGatesCiRuns } from "./gates.js";
import {
  againstOrUsage,
  buildQaResult,
  judgeQaResult,
  judgeUsage,
  qaResultPath,
  writeQaResult,
} from "./qa-results.js";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { quietly } from "../schemas/sdlc/input-trace.ts";
import { readQaTree } from "./qa-store.ts";
import { rootProfile } from "./lib/root-gate-set.ts";
import { overlayDirs } from "./lib/layer-output.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";
import { stateMountedDirs } from "./mount-from-lock.ts";
import { absenceAt } from "./branch-store.ts";

/** The LAYER root — this file lives at `<instance>/scripts/`. */
const ROOT = resolve(HARNESS_ROOT);
const REPO = repoRootFor(ROOT);

/** Where a kind's files stand relative to the audits that reach them. */
export type KindState =
  /** No layer declares a directory of this kind. Not a gap. */
  | "no-directory"
  /** A directory exists and holds no files. A determined empty. */
  | "empty"
  /** Files, and at least one criterion or gate reaching them. */
  | "covered"
  /**
   * Files that a declared validator TYPES, and nothing judges.
   *
   * Bean `3oqj`. The first version had no such state, so `health` and `todos`
   * read `unaudited` — and that over-reported: both declare a validator, and
   * `check:kind-validators` parses their nodes against it. They read as reached
   * by nothing only because the gate that types them declares
   * `@covers computed`, which this report counts as neither coverage nor gap.
   *
   * **It is still a finding.** `--strict` fails on it, recorded as its own
   * family. Typing is not judging — that is this report's whole thesis, and a
   * state that turned a finding into a pass would be `dh4f` wearing this
   * script's own design. What it buys is telling "a schema parses these nodes
   * and no criterion reads them" from "nothing whatsoever reaches this kind",
   * which are different pieces of work.
   */
  | "typed-only"
  /** Files, and nothing reaching them at all — not even a validator. */
  | "unaudited"
  /**
   * Every directory of this kind declares `storage` (bean `16ei`): its files
   * live on a branch, keyed by commit, and the checkout holds at most a
   * working copy. NOT a census of zero — the checkout is not where they are,
   * and counting a working copy would make the row depend on whether somebody
   * ran `qa:fetch`. Proposal §2.4: `audit:coverage` "stops expecting the files
   * in the checkout". Not a finding, and not covered either.
   */
  | "stored"
  /**
   * A directory of this kind is declared, does NOT declare `storage`, and is
   * not in the checkout, and nothing else of the kind was counted — so the
   * census could not be taken. Bean `0dav`, the readers-audit's **C8**: before
   * this state the `qa` row went from `covered`, 278 files, to `empty`, 0, the
   * moment `test/results/` was absent, and `health` with it. That is `dh4f`:
   * an absent answer printed as a determined zero.
   *
   * Two causes look identical from here — QA results kept off `main` on the
   * `qa-reports` branch (owner rulings D1/D4) before the declaration says so,
   * or a declared directory that does not exist — and this report does not
   * guess between them; `check:harness-dirs` owns the second. Reported, never
   * gated: proposal §2.3, a record that is not here is `unknown`, not a pass
   * and not this change's defect.
   */
  | "unknown"
  /**
   * A directory of this kind is kept at a branch TIP that this checkout
   * cannot read — not cut over, or cut over and not mounted.
   *
   * Bean `9ofm`. A tip mount is DETERMINISTIC, so unlike `stored` there is a
   * right answer here and this run does not have it. Every other count for
   * the kind is therefore a LOWER BOUND, which is why this state is decided
   * before `empty`, `covered` and `unaudited`: reporting `empty` for a
   * directory nothing read is `dh4f` — a clean run over nothing — and
   * reporting `covered` would certify a gate against files it never saw.
   *
   * It is a finding, and `--strict` fails on it. `check:declared-dirs` says
   * which of the two cases it is and how to fix it; this report's job is only
   * to refuse to put a number on what it could not read.
   */
  | "undetermined"
  /**
   * Every directory of this kind that is not `stored` was DETERMINED absent
   * from this checkout by `state:mount` (an `.absent` record, `absenceAt`):
   * declared for every checkout by a mounted instance, not by this root, and
   * not on this checkout's remote — an IG repository that is its own index
   * (cat-harness-tools#1701). Not a lower bound like `undetermined`: the
   * graph is not this checkout's, so there is nothing here to count. Not a
   * finding, and not covered either.
   */
  | "absent";

export type AdversarialCoverageState = "reviewed" | "stale" | "never";

export interface KindCoverage {
  kind: string;
  state: KindState;
  /** Absolute directories, repo-relative for the report. */
  directories: string[];
  /** Printed, never committed — see the docblock. */
  files: number;
  /** `kg-audit` criteria ids reaching a subject kind that lives in this graph. */
  criteria: string[];
  /** Subject kinds of `KG_SUBJECT_GRAPH_TYPOLOGIES` that live in this graph. */
  subjectKinds: KgSubjectKind[];
  /** Gate commands that DECLARE they cover this kind. */
  gates: string[];
  /** QA sidecars found under its directories. Printed, never committed. */
  sidecars: number;
  /**
   * Does the registry declare something that RUNTIME-VALIDATES a node of this
   * kind — a `validator`, or a `nodeSchemas` family?
   *
   * Read from the registry's own declaration rather than resolved here.
   * `check:kind-validators` already fails the build on a declared validator
   * that does not load, so re-resolving would be a second answer to a question
   * that gate settles — the drift `kg-audit`'s `tool-*` criteria exist to
   * avoid. What this reads is the CLAIM; that gate is what keeps the claim true.
   */
  typed: boolean;
  /** Adversarial review state for this kind (child lvlv, proposal §7). */
  adversarial: AdversarialCoverageState;
}

/** A row without its census — what the sidecar records. See the docblock. */
export type KindCoverageRecord = Omit<KindCoverage, "files" | "sidecars"> & { hasFiles: boolean };

/** Strip the volatile half. */
export function asRecord(r: KindCoverage): KindCoverageRecord {
  const { files, sidecars: _s, ...rest } = r;
  return { ...rest, hasFiles: files > 0 };
}

/** What a gate declared, and how we got the declaration. */
export interface GateCoverage {
  command: string;
  /** Repo-relative script paths the command resolves to. */
  scripts: string[];
  /** Kinds it declares. Empty with `declared` set means `@covers none`. */
  covers: string[];
  /** `declared` · `none` · `computed` · `undeclared` · `no-script` */
  state: "declared" | "none" | "computed" | "undeclared" | "no-script";
  /** Why, when the state is not `declared`. */
  why?: string;
}

/** A file this report does not count as a node of anything. */
function countable(name: string): boolean {
  if (name.startsWith(".")) return false;
  // A verdict ABOUT a node is not a node. Counting sidecars would make a
  // directory look fuller the more of it had been audited.
  return !/\.(qa|kg-qa|qa-results|qa-witness)\.json$/.test(name);
}

function isSidecar(name: string): boolean {
  return /\.(qa|kg-qa|qa-results|qa-witness)\.json$/.test(name);
}

/**
 * This script's OWN sidecar, which the census must not count.
 *
 * It lives in the `qa-results` graph, so the `qa` row counts it — and writing it
 * changes the number the next run computes, which changes the sidecar, for ever.
 * The first version had no fixpoint: `audit:coverage` then `audit:coverage:check`
 * failed, and running the writer twice was the only way to satisfy a gate that
 * is supposed to be satisfied by running it once.
 *
 * **A measurement must not be a term in itself.** Not a special case to be
 * embarrassed about but the general reason this exclusion exists, and the path is
 * DERIVED from the same constants that write the file rather than spelled out, so
 * relocating the results directory cannot leave the exclusion pointing elsewhere.
 */
const SELF_SIDECAR = qaResultPath(ROOT, "audit-coverage");

/**
 * Files and sidecars under `dir` that GIT accounts for. Unreadable is zero,
 * reported by the caller.
 *
 * ## It changes no count today, and the docblock nearly claimed otherwise
 *
 * `xd1g`. Measured over the three largest declared directories at the
 * conversion — `cat-harness/skills` (389), `beans/defs` (1049),
 * `cat-harness/test/results` (945) — **identical before and after**, nothing
 * swept and nothing gained. The committed sidecar moves by its timestamp and
 * script hash alone.
 *
 * That is the honest result, and it took a correction to reach. The same
 * comparison over the REPOSITORY ROOT is dramatic — 31437 files before, 14135
 * after, 17302 swept and every one of them gitignored (14561 in
 * `node_modules/`, 2723 of build output, 18 in `_kg/`) — and it was nearly
 * written here as what this scanner had been doing. It is not: {@link census}
 * is called on DECLARED GRAPH DIRECTORIES only, never on a root, and every one
 * of them happens to hold no ignored content. A number measured on a different
 * input is not this function's measurement.
 *
 * What the root figure does show is the SHAPE, and the shape is one
 * declaration away: the old recursion skipped only dot-prefixed names, so it
 * had no defence at all if a declared directory ever came to contain build
 * output. `_kg/` is 18 such files sitting one level above the directories this
 * does census.
 *
 * `dir` is any directory inside the work tree, not only a root: `gitCorpus`
 * runs `git ls-files` with `cwd: dir`, which lists exactly that subtree.
 *
 * The dot rule is kept explicitly — git's corpus includes `.github/` and
 * `.claude/`, and folding a dot rule into the helper would change what several
 * scanners read without saying so.
 */
export function census(dir: string, skip: ReadonlySet<string> = new Set([SELF_SIDECAR])): { files: number; sidecars: number; readable: boolean } {
  if (!existsSync(dir)) return { files: 0, sidecars: 0, readable: false };
  const found = gitFiles(dir, (rel) => !rel.split("/").some((s) => s.startsWith(".")));
  let files = 0;
  let sidecars = 0;
  for (const abs of found.files) {
    if (skip.has(abs)) continue;
    const base = abs.split(/[\\/]/).at(-1)!;
    if (isSidecar(base)) sidecars++;
    else if (countable(base)) files++;
  }
  return { files, sidecars, readable: true };
}

/**
 * {@link census} over several directories, and the two reasons one is not
 * censused where it was declared.
 *
 * A directory declaring `storage.branch` (bean `16ei`) keeps its files on that
 * branch. What that means for the census depends on the **keying**, and bean
 * `9ofm` measured the cost of treating the two alike:
 *
 * - **`commit`**-keyed (qa-store's layout) — what sits at the path in the
 *   checkout is a working copy whose size depends on whether `qa:fetch` ran.
 *   Counting it would make this report a measurement of the contributor's last
 *   command, so it is skipped and counted in `stored`.
 * - a branch **TIP** — the mount is deterministic, so there IS a right answer.
 *   Mounted, it is censused at the marker's `into` like any other directory:
 *   these are real files, and 1,389 beans dropping out of the census the day a
 *   declaration flipped would be a silent loss of the whole work plan from
 *   this report. Not mounted, it is `undetermined` — never folded into
 *   `stored`, because `stored` means "not where the files are, by design" and
 *   this means "could not read the files", and a caller that cannot tell those
 *   apart will read a lower bound as a measurement.
 *
 * - **`route`**-keyed — there is no route store to census: `state-mount.ts` walks
 *   tip-keyed entries only, so no mount of one ever exists locally and no amount
 *   of fetching produces a path for `census` to walk. Cut over, that is `stored`
 *   and the statement is true. **Not** cut over, it is `undetermined` like a
 *   not-cut-over tip, because `stored` asserts the files are elsewhere by design
 *   and during that window they are tracked right here — a true-sounding bucket
 *   holding a false claim is worse than the honest "could not read".
 *
 * `uncounted` is the third answer (bean `0dav`, C8): a directory that is NOT
 * stored, not tip-keyed, and not in the checkout either. Its zero is not a
 * measurement, so it is counted apart and a caller can tell "examined, empty"
 * from "not here".
 *
 * So `stored` tells "all stored" from "all empty", and `undetermined` tells
 * both from "could not say".
 *
 * @param repoRoot the checkout a tip mount is resolved against. Only read for
 *   tip-keyed directories, so a caller with none needs no git repository.
 */
export function censusDirectories(
  // `storage` as the declaration holds it — read only through the resolver, which parses it.
  dirs: ReadonlyArray<{ id?: string; absPath: string; storage?: unknown; source?: SubgraphSource }>,
  skip?: ReadonlySet<string>,
  repoRoot: string = process.cwd(),
): { files: number; sidecars: number; stored: number; undetermined: number; uncounted: number; absent: number } {
  let files = 0;
  let sidecars = 0;
  let stored = 0;
  let undetermined = 0;
  let uncounted = 0;
  let absent = 0;
  for (const d of dirs) {
    let at = d.absPath;
    if (contentIsOffCheckout(d)) {
      let src;
      try {
        src = resolveSubgraphSource({ id: d.id ?? "", path: d.absPath, source: d.source, storage: d.storage });
      } catch {
        // The resolver's contradictions are `check:declared-dirs`'s finding to
        // report, with the remedy. Here the only honest number is "none".
        undetermined++;
        continue;
      }
      if (src.kind === "branch" && src.keyedBy === "route") {
        // `stored` means "not where the files are, BY DESIGN" — true once the
        // cutover has happened, and false while it has not: the files are right
        // there in the checkout. So the one state route shares with tip gets
        // tip's answer, and only the state route does not share keeps `stored`.
        if (routePresence(src, d.absPath, repoRoot).state === "not-cut-over") undetermined++;
        else stored++;
        continue;
      }
      if (src.kind !== "branch" || src.keyedBy !== "tip") {
        stored++;
        continue;
      }
      const t = tipPresence(src, d.absPath, repoRoot);
      if (t.state !== "mounted") {
        // Determined NOT this checkout's at mount time (cat-harness-tools#1701):
        // nothing to count, and no lower bound either. Only an unmounted tip
        // with that record; a not-cut-over one stays undetermined.
        if (t.state === "unmounted" && absenceAt(repoRoot, relative(repoRoot, d.absPath).split(sep).join("/"), d.id)) {
          absent++;
          continue;
        }
        undetermined++;
        continue;
      }
      at = t.into;
    }
    const c = census(at, skip);
    if (!c.readable) {
      uncounted++;
      continue;
    }
    files += c.files;
    sidecars += c.sidecars;
  }
  return { files, sidecars, stored, undetermined, uncounted, absent };
}

/**
 * Resolve a gate command to the script files it runs.
 *
 * `bun run check:x` → `package.json.scripts["check:x"]` → the `.ts` paths in it.
 * One level of indirection is followed, because that is all the corpus has;
 * a deeper chain resolves to whatever the first hop names and is reported as
 * such rather than followed blindly.
 */
export function scriptsFor(command: string, scripts: Record<string, string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const walk = (cmd: string, depth: number): void => {
    for (const m of cmd.matchAll(/[\w./@-]+\.ts\b/g)) {
      const p = m[0].replace(/^\.\//, "");
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
    if (depth > 2) return;
    for (const m of cmd.matchAll(/\bbun(?:x)? run (?:cat )?([\w:.-]+)/g)) {
      const name = m[1]!;
      const next = scripts[name];
      if (next !== undefined) walk(next, depth + 1);
    }
    // `publish-check.ts <writer>` runs that writer and then its `--check` (B1):
    // the writer's script is what the gate audits, and it carries the
    // `@covers`. Without this hop every check routed through publish-check
    // read as covering nothing, and its kinds as unaudited.
    for (const m of cmd.matchAll(/publish-check\.ts\s+([\w:.-]+)/g)) {
      const next = scripts[m[1]!];
      if (next !== undefined) walk(next, depth + 1);
    }
    // `run-script.ts <name>` is how `run-gates.py` invokes a layer's declared
    // `check:` / `:check` scripts; follow `<name>` through `scripts` just as
    // `bun run cat <name>` and `publish-check.ts <writer>` do.
    for (const m of cmd.matchAll(/run-script\.ts\s+([\w:.-]+)/g)) {
      const next = scripts[m[1]!];
      if (next !== undefined) walk(next, depth + 1);
    }
  };
  walk(command, 0);
  return out;
}

/**
 * Every `@covers` line in a module docblock, flattened. `["none"]` is a decision.
 *
 * ## The indentation is load-bearing
 *
 * `^ \* @covers ` — exactly one space, the star, exactly one space. The first
 * version accepted any leading whitespace, and the file it could not read
 * correctly was THIS ONE: the docblock above documents the syntax by showing
 * three `@covers` lines indented as a code sample, and a lenient pattern read
 * them as declarations. `audit-coverage` was credited with auditing
 * `bean-defs`, `beans` and nothing-in-particular, by its own examples.
 *
 * That is worth a rule rather than a patch: **a docblock that documents a tag
 * necessarily contains the tag**, so any parser over docblocks has to
 * distinguish a use from a mention, and indentation is the distinction JSDoc
 * already uses. A continuation line (` *   …`) is a mention too, which is why
 * the reason may wrap without leaking into the list.
 */
export function coversIn(text: string): string[] | undefined {
  const lines = [...text.matchAll(/^ \* @covers (.+)$/gm)].map((m) => m[1]!);
  if (lines.length === 0) return undefined;
  const out: string[] = [];
  for (const line of lines) {
    // Everything before an em-dash is the list; the rest is the reason.
    const list = line.split(/\s+[—–-]{1,2}\s+/)[0]!;
    for (const tok of list.split(/[,\s]+/)) {
      const t = tok.trim();
      if (t.length > 0 && !out.includes(t)) out.push(t);
    }
  }
  return out;
}

export function gateCoverage(root: string, repo: string, given?: readonly Gate[]): GateCoverage[] {
  let scripts: Record<string, string> = {};
  try {
    scripts = scriptsOf(repo);
  } catch {
    scripts = {};
  }
  for (const dir of [repo, TOOLS_ROOT]) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as { checkoutScripts?: Record<string, string> };
      if (pkg.checkoutScripts && typeof pkg.checkoutScripts === "object") {
        scripts = { ...pkg.checkoutScripts, ...scripts };
      }
    } catch {
      // ignore unreadable manifest
    }
  }
  // `--all`: the browser jobs gate the corpus too, and a coverage report that
  // silently dropped them would under-count for a reason invisible in its own
  // output.
  // What CI RUNS, not what the local runner can execute. `loadGates` omits a
  // command whose shell variable the extraction discarded (bean `9zok`); CI
  // runs that command correctly, and a gate that declares `@covers` covers its
  // kind regardless of this tool's ability to invoke it. Using the runner's
  // list here made the census 209 and the "all N have declared" verdict narrower
  // than reality.
  const gates = given ?? loadGatesCiRuns(repo, { all: true });
  const out: GateCoverage[] = [];
  const byCommand = new Map<string, GateCoverage>();
  for (const g of gates) {
    if (byCommand.has(g.command)) continue;
    const files = scriptsFor(g.command, scripts);
    if (files.length === 0) {
      const c: GateCoverage = {
        command: g.command,
        scripts: [],
        covers: [],
        state: "no-script",
        why: "resolves to no script in this repository — a language-level tool, not a graph audit",
      };
      byCommand.set(g.command, c);
      out.push(c);
      continue;
    }
    const declared: string[] = [];
    let anyRead = false;
    let anyDeclared = false;
    for (const f of files) {
      let text: string | undefined;
      const candidates = [join(repo, f), join(root, f)];
      const chIdx = f.indexOf("cat-harness/");
      if (chIdx !== -1) {
        const after = f.slice(chIdx + "cat-harness/".length);
        candidates.push(join(repo, "cat-harness", after));
        candidates.push(join(root, after));
      }
      const chtIdx = f.indexOf("cat-harness-tools/");
      if (chtIdx !== -1) {
        const after = f.slice(chtIdx + "cat-harness-tools/".length);
        candidates.push(join(repo, "cat-harness-tools", after));
        candidates.push(join(TOOLS_ROOT, after));
      }
      for (const cand of candidates) {
        try {
          text = readFileSync(cand, "utf-8");
          break;
        } catch {
          // try next candidate
        }
      }
      if (text === undefined) continue;
      anyRead = true;
      const covers = coversIn(text);
      if (covers === undefined) continue;
      anyDeclared = true;
      for (const k of covers) if (!declared.includes(k)) declared.push(k);
    }
    const kinds = declared.filter((k) => k !== "none" && k !== "computed");
    const isComputed = declared.includes("computed");
    const c: GateCoverage = !anyRead
      ? {
          command: g.command,
          scripts: files,
          covers: [],
          state: "undeclared",
          why: `none of its ${files.length} script path(s) could be read`,
        }
      : !anyDeclared
        ? { command: g.command, scripts: files, covers: [], state: "undeclared", why: "no @covers line in its docblock" }
        : kinds.length === 0
          ? { command: g.command, scripts: files, covers: [], state: isComputed ? "computed" : "none" }
          : { command: g.command, scripts: files, covers: kinds, state: "declared" };
    byCommand.set(g.command, c);
    out.push(c);
  }
  // `relative` is applied by the caller for display; paths stay repo-relative.
  void root;
  return out;
}

/** The universe of kinds: the registry, plus anything a layer declares that it does not know. */
export function kindUniverse(repo: string): { registered: string[]; declaredOnly: string[] } {
  const registered = defaultGraphTypologies.names().sort();
  const extra = new Set<string>();
  for (const inst of layerRootsIn(repo)) {
    let decl;
    try {
      decl = readDeclaration(inst);
    } catch {
      continue;
    }
    if (!decl) continue;
    for (const k of declaredKinds(inst, decl)) if (!registered.includes(k)) extra.add(k);
  }
  return { registered, declaredOnly: [...extra].sort() };
}

/**
 * Adversarial review coverage per declared graph typology (proposal §7, child lvlv).
 *
 * Reads `adversarial_reviews[]` from two places and checks each against the
 * subject's current source hash:
 *
 * - the attestation store (`test/attestations/adversarial-review/`, ruling D2 (a)), where
 *   the reviews are committed and pinned by `source_hash`;
 * - the derived `test/results/kg-qa/` sidecars, which still carry the reviews
 *   `adversarial-backfill` wrote before the store held them, pinned by
 *   `source_hash`.
 *
 * The derived tree is not committed since cat-harness#857 and no generator
 * writes the reviews, so a reader that looked only there reported every
 * reviewed kind as `never` on a fresh checkout.
 */
export function adversarialCoverageByGraph(repo: string, root: string = ROOT): Map<string, AdversarialCoverageState> {
  const result = new Map<string, { hasFresh: boolean; hasStale: boolean }>();

  const record = (
    subject: { kind?: string; path?: string | null } | undefined,
    pinned: string | undefined,
  ): void => {
    const subjKind = subject?.kind as KgSubjectKind | undefined;
    const graph = subjKind ? KG_SUBJECT_GRAPH_TYPOLOGIES[subjKind] : undefined;
    if (!graph) return;

    let isFresh = true;
    if (subject?.path) {
      const candidates = [join(root, subject.path), join(repo, subject.path), join(repo, "cat-harness", subject.path)];
      for (const cand of candidates) {
        if (existsSync(cand)) {
          const currentHash = createHash("sha256").update(readFileSync(cand)).digest("hex").slice(0, 12);
          if (pinned && pinned !== currentHash) {
            isFresh = false;
          }
          break;
        }
      }
    }

    const existing = result.get(graph) ?? { hasFresh: false, hasStale: false };
    if (isFresh) existing.hasFresh = true;
    else existing.hasStale = true;
    result.set(graph, existing);
  };

  const scanDir = (dir: string): void => {
    if (!existsSync(dir)) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        scanDir(full);
      } else if (ent.name.endsWith(".kg-qa.json")) {
        try {
          const sc = JSON.parse(readFileSync(full, "utf-8")) as KgQaReport;
          if (!sc.adversarial_reviews || sc.adversarial_reviews.length === 0) continue;
          record(sc.subject, sc.source_hash ?? undefined);
        } catch {
          // ignore unparseable sidecar
        }
      }
    }
  };

  // Each tree through the layer output overlay: a mounted layer's sidecars are
  // under `build/layers/<instance>/` (bean `cat-tools-sm8r`, item 4).
  const scanOverlay = (dir: string): void => {
    for (const d of overlayDirs(dir)) scanDir(d);
  };
  scanOverlay(join(root, "test", "results", "kg-qa"));
  if (repo !== root) {
    scanOverlay(join(repo, "test", "results", "kg-qa"));
    scanOverlay(join(repo, "cat-harness", "test", "results", "kg-qa"));
  }

  // The committed half. The harness root's own store first, then every
  // layer's that `kg-audit` would resolve from it; a layout whose
  // layers cannot be listed still reads the harness root's.
  const homes = new Set<string>([resolve(attestationsHomeFor(root).root)]);
  try {
    for (const t of kgAttestationTrees(repo, root)) homes.add(resolve(t.attHome));
  } catch {
    // layer discovery failed: the harness root's store is still read
  }
  for (const home of homes) {
    for (const s of storedAdversarialReviews(home)) record(s.file.subject, s.file.source_hash ?? undefined);
  }
  if (!result.get("tools")?.hasFresh || !result.get("skills")?.hasFresh) {
    try {
      const store = quietly(() => readQaTree("main", "", { repoRoot: repo, log: () => {} }));
      if (store.state === "hit") {
        for (const [rel, text] of store.files) {
          if (!rel.endsWith(".kg-qa.json") || !rel.includes("/kg-qa/")) continue;
          try {
            const sc = JSON.parse(text) as KgQaReport;
            if (!sc.adversarial_reviews || sc.adversarial_reviews.length === 0) continue;
            record(sc.subject, sc.source_hash ?? undefined);
          } catch {
            // ignore unparseable sidecar
          }
        }
      }
    } catch {
      // ignore unreachable store
    }
  }

  const out = new Map<string, AdversarialCoverageState>();
  for (const [graph, entry] of result.entries()) {
    if (entry.hasFresh) out.set(graph, "reviewed");
    else if (entry.hasStale) out.set(graph, "stale");
    else out.set(graph, "never");
  }
  return out;
}

export function coverage(repo: string): { rows: KindCoverage[]; gates: GateCoverage[]; universe: { registered: string[]; declaredOnly: string[] } } {
  const universe = kindUniverse(repo);
  const kinds = [...universe.registered, ...universe.declaredOnly];
  const gates = gateCoverage(ROOT, repo);
  const advCoverage = adversarialCoverageByGraph(repo, ROOT);

  const criteriaByGraph = new Map<string, { ids: string[]; subjects: Set<KgSubjectKind> }>();
  for (const c of KG_CRITERIA) {
    for (const s of c.applies) {
      const graph = KG_SUBJECT_GRAPH_TYPOLOGIES[s];
      const e = criteriaByGraph.get(graph) ?? { ids: [], subjects: new Set<KgSubjectKind>() };
      if (!e.ids.includes(c.id)) e.ids.push(c.id);
      e.subjects.add(s);
      criteriaByGraph.set(graph, e);
    }
  }

  const gatesByKind = new Map<string, string[]>();
  // A check exempted as `covered-by` (`gateExemptions`, bean `0r7u`) is run
  // by its own layer's CI at every pin this checkout mounts, so the kinds its
  // script declares in `@covers` are judged, by that run. It is not one of
  // THIS checkout's gates, so it joins the kind's judges and nothing else: the
  // gate census and `gates-undeclared` stay what CI here runs.
  const ran = new Set(gates.map((g) => g.command));
  const elsewhere = gateCoverage(
    ROOT,
    repo,
    SCRIPT_EXEMPTIONS.filter((e) => e.kind === "covered-by")
      .map((e) => ({ job: "covered-by", step: e.script, command: `bun run cat ${e.script}` }))
      .filter((g) => !ran.has(g.command)),
  );
  for (const g of [...gates, ...elsewhere]) {
    for (const k of g.covers) {
      const list = gatesByKind.get(k) ?? [];
      if (!list.includes(g.command)) list.push(g.command);
      gatesByKind.set(k, list);
    }
  }

  // Each layer's directories, resolved ONCE rather than once per kind. The
  // resolution does not depend on the kind, and it was the run's cost: about
  // 50 ms per pass over the checkout's layers, repeated for each of ~90
  // kinds, so most of a `coverage()` call (measured 2026-10-26: 6.5 s, of
  // which under 1 s was the gates, the universe and the census). A layer
  // whose declaration will not resolve is skipped here as it was in the loop.
  const dirsByInstance: ResolvedDirectory[][] = [];
  for (const inst of layerRootsIn(repo)) {
    try {
      dirsByInstance.push(resolveDirectories([{ name: "(local)", root: inst, own: true }]));
    } catch {
      continue;
    }
  }
  const rows: KindCoverage[] = [];
  for (const kind of kinds) {
    // `directoriesForGraph`, kept whole rather than reduced to paths, so the
    // census can see which directories are STORED (`storage`, bean `16ei`).
    const resolved = new Map<string, Pick<ResolvedDirectory, "id" | "absPath" | "storage">>();
    for (const dirsForInst of dirsByInstance) {
      for (const d of dirsForInst) {
        if (d.graphTypologies.includes(kind as never) && !resolved.has(d.absPath)) resolved.set(d.absPath, d);
      }
    }
    const dirs = new Set(resolved.keys());
    const { files, sidecars, stored, undetermined, uncounted, absent } = censusDirectories([...resolved.values()], undefined, repo);
    const crit = criteriaByGraph.get(kind);
    const gs = gatesByKind.get(kind) ?? [];
    const def = defaultGraphTypologies.get(kind);
    const typed = Boolean(def?.validator) || Boolean(def?.nodeSchemas);
    const judged = (crit?.ids.length ?? 0) > 0 || gs.length > 0;
    const adversarial: AdversarialCoverageState = advCoverage.get(kind) ?? "never";
    const state: KindState =
      dirs.size === 0
        ? "no-directory"
        // Decided BEFORE `empty`, `covered` and `unaudited`, because a
        // directory this run could not read makes every count below a lower
        // bound (bean `9ofm`). `stored` keeps its precedence over the counts
        // for the same reason it always had it.
        : undetermined > 0
          ? "undetermined"
          : absent > 0 && absent + stored === dirs.size
            ? "absent"
          : stored === dirs.size
            ? "stored"
            : files === 0 && uncounted > 0
            ? "unknown"
            : files === 0
            ? "empty"
            : judged
              ? "covered"
              : typed
                ? "typed-only"
                : "unaudited";
    rows.push({
      kind,
      state,
      directories: [...dirs].map((d) => relative(repo, d)).sort(),
      files,
      criteria: (crit?.ids ?? []).sort(),
      subjectKinds: [...(crit?.subjects ?? [])].sort(),
      gates: gs.sort(),
      sidecars,
      typed,
      adversarial,
    });
  }
  return { rows, gates, universe };
}

const GATE = "audit:coverage";

function main(): number {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const strict = argv.includes("--strict");
  const requireAll = argv.includes("--require-all");
  if (check) {
    const usage = judgeUsage(GATE, argv, ["--strict", "--require-all", "--against"]);
    if (usage !== undefined) return usage;
  }
  const { against, exit: badRef } = againstOrUsage(GATE, argv);
  if (badRef !== undefined) return badRef;
  const { rows, gates, universe } = coverage(REPO);

  // §1.2a of `generalise-the-fix`: a sweep prints its own denominator. A
  // report over zero kinds, or over zero gates, passes every assertion below
  // and has measured nothing.
  const declaredKindCount = universe.registered.length + universe.declaredOnly.length;
  if (rows.length === 0 || gates.length === 0) {
    console.log(`⚠ EXAMINED NOTHING — ${rows.length} kind(s), ${gates.length} gate(s)`);
    return 1;
  }
  console.log(
    `Audit coverage  (${rows.length} of ${declaredKindCount} declared kind(s) examined, ` +
      `${gates.length} gate(s) in the CI set, ${KG_CRITERIA.length} kg-audit criteria)`,
  );
  if (universe.declaredOnly.length > 0) {
    console.log(`  · ${universe.declaredOnly.length} kind(s) declared by an instance and NOT in the registry: ${universe.declaredOnly.join(", ")}`);
  }
  console.log("");

  const byState = (s: KindState): KindCoverage[] => rows.filter((r) => r.state === s);
  const pad = (s: string, n: number): string => (s.length >= n ? s : s + " ".repeat(n - s.length));
  const num = (n: number, w: number): string => " ".repeat(Math.max(0, w - String(n).length)) + String(n);

  console.log(`    ${pad("kind", 20)} ${" ".repeat(1)}files  crit  gates  sidecars  ${pad("adversarial", 11)}  state`);
  for (const r of rows) {
    // `typed-only` is marked `~` rather than `✓` or `✗`: it is a finding, and
    // it is a DIFFERENT one from `unaudited`. A shared mark would put the two
    // pieces of work in one bucket, which is what this state exists to undo.
    const mark =
      r.state === "unaudited"
        ? "✗"
        : r.state === "typed-only"
          ? "~"
          // `?`, not `✗`: this is not a coverage gap, it is this run declining
          // to put a number on a directory it could not read (bean `9ofm`).
          : r.state === "undetermined"
            ? "?"
            : r.state === "covered"
              ? "✓"
              : r.state === "unknown"
                ? "?"
                : "·";
    console.log(
      `  ${mark} ${pad(r.kind, 20)} ${num(r.files, 6)} ${num(r.criteria.length, 5)} ${num(r.gates.length, 6)} ${num(r.sidecars, 9)}  ${pad(r.adversarial, 11)}  ${r.state}`,
    );
  }
  console.log("");

  const advReviewed = rows.filter((r) => r.adversarial === "reviewed");
  const advStale = rows.filter((r) => r.adversarial === "stale");
  const advNever = rows.filter((r) => r.adversarial === "never");
  console.log(
    `Adversarial reviews: ${advReviewed.length} reviewed · ${advStale.length} stale · ${advNever.length} never\n`,
  );

  const unaudited = byState("unaudited");
  const typedOnly = byState("typed-only");
  const uncensused = byState("unknown");
  // C8, said where a reader of the table looks. NOT "empty": the directories
  // are not in this checkout, so there is no count to be zero.
  const unknownLines = uncensused.map(
    (r) =>
      `${r.kind}: no census — its declared director${r.directories.length === 1 ? "y is" : "ies are"} not in this checkout ` +
      `(${r.directories.join(", ")}) and none declares \`storage\`. NOT empty, and NOT a pass for this kind`,
  );
  if (uncensused.length > 0) {
    console.log(`? ${uncensused.length} kind(s) could not be census-ed — UNKNOWN, never "empty":`);
    for (const l of unknownLines) console.log(`    · ${l}`);
  }
  if (unaudited.length > 0) {
    console.log(`✗ ${unaudited.length} kind(s) hold files that NOTHING reaches — no criterion, no gate, not even a validator:`);
    for (const r of unaudited) console.log(`    · ${r.kind}: ${r.files} file(s) under ${r.directories.join(", ")}`);
  } else {
    console.log("✓ every kind with files is reached by a criterion, a gate, or a declared validator");
  }
  if (typedOnly.length > 0) {
    console.log(`~ ${typedOnly.length} kind(s) are TYPED and judged by nothing — a schema parses their nodes, no criterion reads them:`);
    for (const r of typedOnly) console.log(`    · ${r.kind}: ${r.files} file(s) under ${r.directories.join(", ")}`);
  }
  const undet = byState("undetermined");
  if (undet.length > 0) {
    console.log(
      `? ${undet.length} kind(s) are kept at a branch TIP this checkout cannot read, so their rows above ` +
        `are LOWER BOUNDS and not measurements:`,
    );
    for (const r of undet) console.log(`    · ${r.kind}: ${r.directories.join(", ")}`);
    console.log(
      `    Run \`bun run cat check:declared-dirs\` — it says, per directory, whether the declaration is ` +
        `flipped ahead of the cutover or the mount is simply missing.`,
    );
  }

  const undeclared = gates.filter((g) => g.state === "undeclared");
  const noScript = gates.filter((g) => g.state === "no-script");
  const none = gates.filter((g) => g.state === "none");
  const computed = gates.filter((g) => g.state === "computed");
  const declared = gates.filter((g) => g.state === "declared");
  console.log(
    `\nGates: ${declared.length} declare a kind · ${none.length} declare @covers none · ` +
      `${computed.length} compute their set · ${noScript.length} run no script here · ` +
      `${undeclared.length} have NOT said`,
  );
  if (undeclared.length > 0) {
    const msg =
      `${undeclared.length} gate(s) declare no coverage. A kind they audit reads here as ` +
      `uncovered, so every "unaudited" above is an UPPER bound, not a verdict`;
    console.log(requireAll ? `✗ ${msg}:` : `⚠ ${msg}:`);
    for (const g of undeclared.slice(0, 12)) console.log(`    · ${g.command} — ${g.why}`);
    if (undeclared.length > 12) console.log(`    · …and ${undeclared.length - 12} more (see the sidecar)`);
  }

  const result = buildQaResult({
    script: relative(REPO, join(TOOLS_ROOT, "scripts", "audit-coverage.ts")),
    scriptAbsPath: join(TOOLS_ROOT, "scripts", "audit-coverage.ts"),
    subject: { kind: "audit-coverage", id: "graph-typologies" },
    families: {
      "kinds-unaudited": {
        summary:
          `A declared kind whose directories hold files that NOTHING reaches — no kg-audit ` +
          `criterion, no gate declaring @covers, and no declared validator. ` +
          (undeclared.length > 0
            ? `An UPPER bound while gates remain undeclared: ${undeclared.length} of ${gates.length} have not said what they cover.`
            : `All ${gates.length} gate(s) have declared, so this is a verdict rather than an upper bound (bean \`3srh\`).`),
        entries: unaudited.map((r) => ({ kind: r.kind, directories: r.directories })),
      },
      "kinds-typed-only": {
        summary:
          `A declared kind whose nodes a declared validator TYPES and no criterion or gate ` +
          `JUDGES. Kept apart from kinds-unaudited because they are different pieces of work, ` +
          `and still a finding — \`--strict\` fails on it. Typing is not judging: a kind can ` +
          `parse perfectly against its schema while nothing has an opinion about what it says.`,
        entries: typedOnly.map((r) => ({ kind: r.kind, directories: r.directories })),
      },
      "kinds-no-directory": {
        summary:
          `No instance declares a directory of this kind — a nested kind reached through its ` +
          `parent (\`bean-defs\` inside \`beans/\`), or one this repository does not have. Recorded ` +
          `so it cannot be read as a coverage gap, and so a kind that LOSES its directory shows up.`,
        entries: byState("no-directory").map((r) => ({ kind: r.kind, criteria: r.criteria.length, gates: r.gates })),
      },
      "kinds-empty": {
        summary:
          "A directory of this kind exists and holds no countable file. A determined empty, not an absent answer.",
        entries: byState("empty").map((r) => ({ kind: r.kind, directories: r.directories })),
      },
      "kinds-unknown": {
        summary:
          "A declared directory of this kind is not in the checkout and declares no `storage`, and nothing " +
          "else of the kind was counted — the census was not taken (bean `0dav`, readers-audit C8). Never " +
          "`empty`: that would print an absent answer as a determined zero. Not gated: proposal §2.3.",
        entries: uncensused.map((r) => ({ kind: r.kind, directories: r.directories })),
      },
      "gates-undeclared": {
        summary:
          `A gate CI runs whose script carries no @covers line. Reported and never failed by ` +
          `default (--require-all fails it): the gap is real, and hiding it would render an ` +
          `unmeasured corpus as clean.`,
        entries: undeclared.map((g) => ({ command: g.command, scripts: g.scripts, why: g.why })),
      },
      // Not findings. The MEASUREMENT, committed, so a reader with only the file
      // can tell "audited clean" from "never audited" — which is the whole
      // reason this is a sidecar rather than console output.
      "coverage-measured": {
        summary:
          `Every declared kind with its four counts and its state. Not findings: the measurement ` +
          `itself, so the committed record answers "what audits this kind" without rerunning ` +
          `anything. The file COUNTS are printed rather than recorded — a census moves on any ` +
          `commit and a gate keyed on it is stale by default; \`hasFiles\` carries the only ` +
          `thing it decides. ${rows.length} of ${declaredKindCount} declared kind(s), ` +
          `${gates.length} gate(s), ${KG_CRITERIA.length} criteria.`,
        entries: rows.map(asRecord),
      },
    },
  });

  // ── The gate: COMPUTE AND JUDGE, write nothing (bean `0dav`) ────────────
  //
  // It used to fail `--check` on its own committed sidecar being stale or
  // absent — and absent is the state QA results are in once they leave
  // `main` (owner rulings D1/D4), so the gate would have been red on every
  // run for a reason that is nobody's defect. Now:
  //
  // - `--strict` fails on every kind nothing reaches or nothing judges, and
  //   `--require-all` on every undeclared gate — as before.
  // - plain `--check` fails on what is NEW in those three families against a
  //   baseline: the committed working copy today, `--against <ref>` on the
  //   `qa-reports` branch after the move. That is what "stale" used to catch
  //   and the only part of it that was ever a finding.
  // - a missing baseline, and a kind with no census, are UNKNOWN: printed,
  //   never a pass, never a failure (proposal §2.3).
  //
  // The LAYER root, not the repository root: `check:undeclared-files`
  // caught the first version writing to `<repo>/test/results/`, a directory no
  // declaration names — the `dh4f` defect, committed by the script whose whole
  // subject is coverage.
  if (!check) {
    // Bean `loxz`: an unmounted tree must not leave a committed sidecar that
    // drops unmounted graphs as `undetermined`. Refuse to write.
    // A CONTENT root with no state branch mounted (a document folio in its
    // PR checks): the undetermined graphs are the ones kept on state branches,
    // which that root does not hold. Not a failure of the root, and not a
    // verdict either — not applicable, exit 78 (cat-harness-tools#281).
    if (undet.length > 0 && rootProfile(REPO) === "content" && stateMountedDirs(REPO).length === 0) {
      exitNotApplicable(
        GATE,
        `${undet.length} declared graph(s) are undetermined (${undet.map((u) => u.kind).join(", ")}) and no state branch is mounted in this content root, ` +
          "so no complete census can be written here (`bun run cat state:mount` to write one)",
      );
    }
    if (undet.length > 0) {
      console.error(
        `\nRefusing to write audit-coverage.qa-results.json: ${undet.length} declared graph(s) are undetermined (${undet.map((u) => u.kind).join(", ")}). ` +
          "Mount required remotes before generating coverage.",
      );
      return 1;
    }
    const out = writeQaResult(ROOT, "audit-coverage", result);
    console.log(`\n· ${relative(REPO, out)} — written.`);
    if (strict && (unaudited.length > 0 || typedOnly.length > 0)) return 1;
    if (requireAll && undeclared.length > 0) return 1;
    return 0;
  }
  console.log("");
  // `undetermined` fails `--strict` for a stronger reason than either: it is
  // not a known gap but an UNKNOWN, and a strict run that passed over it would
  // certify coverage of files it never read (bean `9ofm`).
  if (strict && undet.length > 0) return 1;
  return judgeQaResult({
    gate: `${GATE}${strict ? ":strict" : requireAll ? ":require-all" : ":check"}`,
    fresh: result,
    // `typed-only` fails `--strict` too. It is a finding, so a flag that passed
    // over it would launder the gap the state was introduced to make visible.
    failOn: [...(strict ? ["kinds-unaudited", "kinds-typed-only"] : []), ...(requireAll ? ["gates-undeclared"] : [])],
    failOnNew: ["kinds-unaudited", "kinds-typed-only", "gates-undeclared"],
    unknowns: unknownLines,
    baseline: { root: ROOT, stem: "audit-coverage", writer: "audit:coverage", against },
  }).exit;
}

if (import.meta.main) process.exit(main());
