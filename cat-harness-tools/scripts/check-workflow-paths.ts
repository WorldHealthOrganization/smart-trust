#!/usr/bin/env bun
/**
 * TWO criteria over the same parse of `.github/workflows/`:
 *
 * 1. **Every script path a workflow invokes must RESOLVE** — from the
 *    directory the step actually runs in.
 * 2. **Every `working-directory` must EXIST.**
 *
 * One module, because the cwd model criterion 1 needs is criterion 2's whole
 * subject.
 *
 * ## Criterion 1 — a path that does not resolve
 *
 * A path that does not resolve is not a type, lint or test error; it is found
 * only when the step runs, and a dispatch-only or rarely scheduled workflow
 * may never run.
 *
 * The cwd is COMPUTED: the job's `defaults.run.working-directory`, then the
 * step's own `working-directory`, then any `cd` earlier in the same `run:`
 * block. So a bare `pipeline/build.ts` after `cd content` is judged from
 * there.
 *
 * Where the tree is matters too: `actions/checkout` with a `path:` puts it
 * below the workspace root, which then holds nothing, so a path resolves only
 * under a checkout that is there. A checkout at another `ref:` (e.g.
 * `gh-pages`) is not the HEAD tree, so a path under it is
 * {@link Verdict.Undetermined}.
 *
 * Not visible here: `bun run cat check:l1-complete` is an npm script NAME, so
 * {@link invokedPath} declines it (naming the script is the recommended fix).
 * That moves the risk into the script's own root resolution, guarded only by
 * each script refusing its own empty corpus.
 *
 * When a `cd` names something not resolvable statically (a shell variable, a
 * glob, a command substitution), the invocation is
 * {@link Verdict.Undetermined} and the run FAILS.
 *
 * Paths that name a *folio's* tree, absent from this repository, are declared
 * in {@link FOLIO_PATHS} with a reason each; an entry matching nothing is
 * itself a failure.
 *
 * ## Criterion 2 — `working-directory` must exist
 *
 * A step whose `working-directory` is missing fails every time, whatever it
 * runs (including steps that invoke no script path). Differences from
 * criterion 1, each with its reason at the code: `cd` targets are excluded
 * (a `cd` may target what the block just created); a checkout at another
 * `ref:` **resolves** at its root here; and a workflow-level default is ONE
 * finding however many jobs inherit it, folded only when the verdict is
 * identical.
 *
 * Its allowlist is {@link FOLIO_WORKDIRS} (absent on purpose). Separately,
 * {@link workDirBaseline} is a RATCHET for ones still owed an answer.
 *
 * Usage:
 *   bun run cat check:workflow-paths          # report and exit non-zero on a finding
 *   bun run cat check:workflow-paths --list   # print every invocation, verdict and cwd
 *
 * A sibling test covers every path-shaped token on the lines of a few
 * allowlisted workflows; this covers only script invocations, in all
 * workflows, with a cwd model. Neither subsumes the other.
 *
 * @module scripts/check-workflow-paths
 * @covers none — .github/workflows/ is not a declared graph typology
 */
import { TOOLS_ROOT } from "./lib/roots.ts";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { repoRootFor, resolveDirectories } from "../schemas/kg/cat-harness.js";
import { parse } from "yaml";

import { rootProfile } from "./lib/root-gate-set.ts";

const ROOT = repoRootFor(resolve(import.meta.dir, ".."));

/** Where the workflows live, relative to the repository root. */
export const WORKFLOW_DIR = join(".github", "workflows");

/** What became of one invocation. */
export enum Verdict {
  /** The file is there, from the directory the step runs in. */
  Resolves = "resolves",
  /** The cwd is known and the file is not there. A defect. */
  Missing = "missing",
  /** Declared in {@link FOLIO_PATHS}: absent here on purpose. */
  NeedsFolio = "needs-folio",
  /** The cwd could not be computed. NOT a pass. */
  Undetermined = "undetermined",
}

/**
 * A path that is absent from the platform repository ON PURPOSE.
 *
 * `match` is a substring of the invoked path. Every entry must match at least
 * one invocation, or the run fails — an exemption for a step that no longer
 * exists is a claim about the present that stopped being true.
 */
export interface FolioPath {
  match: string;
  reason: string;
}

// Empty since folio-assistant#3066 (2026-11-10). Every entry named a step in a
// workflow that came across in the qou split and could not run here —
// `publish.yml` (its `cd content` scripts) and `snappea_wasm.yml` (the
// `folio-assistant/snappea-wasm` shell scripts). Those workflows were moved to
// qou or dropped, the entries matched nothing, and an entry matching nothing
// fails the run. A future folio-relative path comes back here with its reason.
export const FOLIO_PATHS: FolioPath[] = [
];

/** One script invocation found in a workflow. */
export interface Invocation {
  file: string;
  job: string;
  step: string;
  /** The path exactly as the workflow spells it. */
  path: string;
  /** The directory the step runs in, relative to the repo root; "" is the root. */
  cwd: string;
  verdict: Verdict;
  /** Set on {@link Verdict.NeedsFolio} and {@link Verdict.Undetermined}. */
  note?: string;
}

/**
 * Pull the invoked script path out of one shell line.
 *
 * Two verbs, for two reasons.
 *
 * `bun run <path>` and `bun <path>`, where the path looks like a file rather
 * than an npm script name. `bun run cat check:ci-health` is a script NAME and is
 * deliberately not a path — which is also the fix this check recommends,
 * since it puts the path in `package.json` once instead of in every caller.
 *
 * `bash <path>` and `sh <path>`, added 2026-09-20 because **the class
 * recurred in the same file within the hour, from a different session**.
 * `feature-staging.yml`'s `cleanup` job ran
 * `bash cat-harness/scripts/render-log-union-attr.sh` at the workspace root
 * while the platform is checked out at `source/` — twice — and both calls
 * died `rc=127` under `bash -e`, taking the retry they were added to protect
 * with them. A shell script has no `package.json` indirection to escape
 * into, so the path in the workflow is the only spelling there is and the
 * verb was the only reason this reader could not see it.
 *
 * A `-c` or a flag is not a path and is declined by the extension test: a
 * shell script here ends `.sh`.
 */
export function invokedPath(line: string): string | undefined {
  const t = line.trim();
  const bun = /^(?:bun|bunx)\s+(?:run\s+)?(?:--cwd\s+\S+\s+)?(\S+)/.exec(t);
  if (bun) {
    const candidate = bun[1];
    if (!/\.(ts|js|mjs)$/.test(candidate)) return undefined; // an npm script name
    if (candidate.startsWith("-")) return undefined;
    return candidate;
  }
  const sh = /^(?:bash|sh)\s+(\S+)/.exec(t);
  if (sh) {
    const candidate = sh[1];
    if (!/\.sh$/.test(candidate)) return undefined; // `-c`, a flag, a heredoc
    if (candidate.startsWith("-")) return undefined;
    return candidate;
  }
  return undefined;
}

/**
 * The `--cwd` flag, which bun applies instead of the shell's directory.
 *
 * Read separately from {@link invokedPath} because it relocates the path
 * without a `cd`, and missing it would report a correct invocation as broken.
 */
export function cwdFlag(line: string): string | undefined {
  return /--cwd\s+(\S+)/.exec(line)?.[1];
}

/** A `cd` this module can follow. Anything else returns undefined. */
export function cdTarget(line: string): string | undefined | null {
  const m = /^cd\s+(\S+)/.exec(line.trim());
  if (!m) return undefined;
  const target = m[1].replace(/^["']|["']$/g, "");
  // A variable, a substitution or a glob cannot be resolved by reading.
  if (/[$*?`]/.test(target)) return null;
  return target;
}

/** Join a cwd with a `cd`, honouring `..` and absolute-ish resets. */
function applyCd(cwd: string, target: string): string {
  if (target === ".") return cwd;
  if (isAbsolute(target)) return cwd; // an absolute cd leaves the repo's frame
  const parts = cwd ? cwd.split("/") : [];
  for (const seg of target.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

interface WorkflowDoc {
  /**
   * Workflow-level `defaults:`. Read because `snappea_wasm.yml` sets its cwd
   * HERE and not per job, so every path in it was being measured from the
   * repository root — the same "wrong frame" error this module exists to
   * catch, inside the module that catches it.
   */
  defaults?: { run?: { "working-directory"?: string } };
  jobs?: Record<
    string,
    {
      defaults?: { run?: { "working-directory"?: string } };
      steps?: {
        name?: string;
        run?: string;
        uses?: string;
        with?: { path?: string; repository?: string; ref?: string };
        "working-directory"?: string;
      }[];
    }
  >;
}

/**
 * A `ref:` that names the commit the workflow is already running on.
 *
 * `ref: ${{ github.sha }}` and friends check out the same tree the checkout
 * would have taken by default, so they are NOT a different commit. Anything
 * else — a branch name, a tag, a computed ref — is a tree this module cannot
 * read from a working copy of HEAD.
 */
const SELF_REF = /github\.(sha|ref|head_ref|event\.pull_request\.head\.sha)/;

/**
 * What a job actually materialises by checking THIS repository out.
 *
 * `actions/checkout` with a `path:` puts the repo somewhere other than the
 * workspace root, and a step working there spells its paths from that
 * directory — correctly. Locally that directory does not exist, so without
 * this the check would call a working workflow broken, which is the failure
 * mode that teaches people to skim its output.
 *
 * **`atRoot` is the half that was missing, and it is the half that catches
 * things.** Collecting the prefixes only ever made the check MORE permissive:
 * a path under a checkout resolved, and a path *not* under one resolved too,
 * because it was then measured against the repository. So a job that checks
 * out to `source/` and runs `bun run cat-harness/scripts/x.ts` from the
 * workspace root passed — while at run time that directory is empty and the
 * step dies. Knowing the prefixes is not the same as knowing where the tree
 * IS.
 *
 * A checkout naming a DIFFERENT `repository:` is deliberately not collected:
 * its contents are not this repo's and nothing here can say whether a path
 * in it resolves. `any` therefore counts checkouts of THIS repository only —
 * a job whose sole checkout is someone else's tree is one this module has no
 * layout for, and it falls back to the old behaviour rather than inventing a
 * verdict.
 */
export interface CheckoutLayout {
  /** Non-root `path:` values holding THIS commit's tree, in workflow order. */
  paths: string[];
  /**
   * Checkouts of this repository at a DIFFERENT ref — `ref: gh-pages` and the
   * like. The directory exists at run time and holds a real tree; it is just
   * not the tree this module can read. Kept apart from {@link paths} because
   * stripping such a prefix measures a path against the wrong commit, which
   * is how the third of `feature-staging.yml`'s three broken backoff calls
   * went on passing after the other two were caught.
   */
  otherRef: { path: string; ref: string }[];
  /** This repository is checked out AT the workspace root. */
  atRoot: boolean;
  /** This repository is checked out somewhere, root or not. */
  any: boolean;
}

export function checkoutLayout(
  steps: NonNullable<WorkflowDoc["jobs"]>[string]["steps"],
): CheckoutLayout {
  const paths: string[] = [];
  const otherRef: { path: string; ref: string }[] = [];
  let atRoot = false;
  let any = false;
  for (const step of steps ?? []) {
    if (!step.uses?.startsWith("actions/checkout")) continue;
    if (step.with?.repository) continue; // someone else's tree
    const path = step.with?.path;
    const ref = step.with?.ref;
    if (path && /[$*?`]/.test(path)) continue; // a computed directory
    if (ref !== undefined && !SELF_REF.test(ref)) {
      // A different commit of this repository. `path` is required in practice
      // for such a checkout to coexist with another; without one it REPLACES
      // the root tree, so nothing here can be judged and the job gets no
      // usable layout.
      if (path) otherRef.push({ path: path.replace(/\/+$/, ""), ref });
      continue;
    }
    any = true;
    // No `path:` at all, or an explicit `.`, is the workspace root — the
    // default, and the case every ordinary workflow uses.
    if (!path || path === "." || path === "./") {
      atRoot = true;
      continue;
    }
    paths.push(path.replace(/\/+$/, ""));
  }
  return { paths, otherRef, atRoot, any };
}

/**
 * Strip a checkout prefix, so `source/cat-harness/x.ts` resolves as
 * `cat-harness/x.ts`.
 *
 * Applied to the JOINED, normalised path rather than to the cwd alone. The
 * first version stripped only the cwd, and CI found the two shapes it
 * therefore missed within the hour — `feature-staging.yml` spells the prefix
 * in the PATH from the workspace root (`bun run source/cat-harness/...`), and
 * once, from a sibling checkout, relatively (`bun run ../source/cat-harness/
 * ...`). Both are correct invocations that this reported as broken.
 *
 * A check whose false positives are the thing people meet first is worse than
 * no check: it teaches the reader to skim, and then the true positive goes by
 * unread too.
 */
function stripCheckout(path: string, checkouts: string[]): string {
  for (const c of checkouts) {
    if (path === c) return "";
    if (path.startsWith(`${c}/`)) return path.slice(c.length + 1);
  }
  return path;
}

/**
 * Every script invocation in one workflow, with the cwd each runs in.
 *
 * `folioPaths` is {@link FOLIO_PATHS} unless a caller supplies its own — which
 * only a test does, to exercise the NEEDS-FOLIO verdict when the shipped table
 * holds nothing (it has been empty since folio-assistant#3066).
 */
export function invocationsFrom(
  file: string,
  text: string,
  folioPaths: readonly FolioPath[] = FOLIO_PATHS,
): Invocation[] {
  const doc = parse(text) as WorkflowDoc;
  const out: Invocation[] = [];
  for (const [job, def] of Object.entries(doc.jobs ?? {})) {
    // Precedence is GitHub's: step, then job defaults, then workflow
    // defaults, then the workspace root.
    const jobCwd =
      def.defaults?.run?.["working-directory"] ??
      doc.defaults?.run?.["working-directory"] ??
      "";
    const layout = checkoutLayout(def.steps);
    for (const step of def.steps ?? []) {
      if (!step.run) continue;
      const stepCwd = step["working-directory"] ?? jobCwd;
      // `cd` accumulates WITHIN a run block and resets between them: each
      // `run:` is its own shell, which is exactly why a `cd content` in the
      // install step does not carry into the step that follows it. Reading
      // it as if it did is how an unprefixed path looks correct.
      let cwd: string | null = stepCwd;
      for (const raw of step.run.split("\n")) {
        for (const segment of raw.split("&&")) {
          const line = segment.trim();
          if (!line || line.startsWith("#")) continue;
          const cd = cdTarget(line);
          if (cd === null) {
            cwd = null; // unresolvable from here on in this block
            continue;
          }
          if (cd !== undefined) {
            cwd = cwd === null ? null : applyCd(cwd, cd);
            continue;
          }
          const path = invokedPath(line);
          if (!path) continue;
          const flag = cwdFlag(line);
          const effective = cwd === null ? null : flag ? applyCd(cwd, flag) : cwd;
          out.push(
            classify(
              { file, job, step: step.name ?? "(unnamed step)", path, cwd: effective },
              layout,
              folioPaths,
            ),
          );
        }
      }
    }
  }
  return out;
}

function classify(
  inv: { file: string; job: string; step: string; path: string; cwd: string | null },
  layout: CheckoutLayout,
  folioPaths: readonly FolioPath[],
): Invocation {
  const base = { file: inv.file, job: inv.job, step: inv.step, path: inv.path };
  if (inv.cwd === null) {
    return {
      ...base,
      cwd: "(unresolved)",
      verdict: Verdict.Undetermined,
      note: "a `cd` in this block names a variable, glob or substitution",
    };
  }
  // Join FIRST, then strip: the prefix may be in the cwd, in the path, or
  // reached relatively through `..` from a sibling checkout.
  const joined = applyCd(inv.cwd, inv.path);
  const inTree = stripCheckout(joined, layout.paths);
  // Lands inside a checkout of a DIFFERENT commit. The directory is there and
  // its contents are real; they are simply not readable from here, so this is
  // an unknown rather than a pass — the house rule this module already states
  // for an unresolvable `cd`.
  const foreign = layout.otherRef.find(
    (c) => joined === c.path || joined.startsWith(`${c.path}/`),
  );
  if (foreign) {
    return {
      ...base,
      cwd: inv.cwd,
      verdict: Verdict.Undetermined,
      note:
        `it resolves inside \`${foreign.path}/\`, which is this repository at ` +
        `\`${foreign.ref}\` — a different tree from the one being checked. ` +
        `Nothing here can say whether \`${joined}\` is in it`,
    };
  }
  // A job that checks this repository out SOMEWHERE ELSE has an empty
  // workspace root. A path that lands there names a directory the job never
  // materialised, and it is broken however well the same spelling reads
  // against the repository — which is exactly how three of four backoff
  // calls in `feature-staging.yml` passed this check while aborting their
  // step at run time (bean `7iog`).
  if (layout.any && !layout.atRoot && inTree === joined) {
    return {
      ...base,
      cwd: inv.cwd,
      verdict: Verdict.Missing,
      note:
        `this job checks the repository out to ` +
        `${layout.paths.map((p) => `\`${p}/\``).join(", ")} and nothing to the ` +
        `workspace root, so \`${joined}\` names an empty directory at run ` +
        `time. The same spelling resolves here, which is why it reads as ` +
        `correct`,
    };
  }
  if (existsSync(resolve(ROOT, inTree))) {
    return { ...base, cwd: inv.cwd, verdict: Verdict.Resolves };
  }
  const folio = folioPaths.find((f) => inv.path.includes(f.match));
  if (folio) {
    return { ...base, cwd: inv.cwd, verdict: Verdict.NeedsFolio, note: folio.reason };
  }
  return { ...base, cwd: inv.cwd, verdict: Verdict.Missing };
}

/**
 * A `working-directory` that is absent from the platform repository ON PURPOSE.
 *
 * Same contract as {@link FOLIO_PATHS} and for the same reason: `match` is the
 * declared value, every entry carries a reason, and an entry matching nothing
 * FAILS the run. An exemption that outlives its step reads as coverage.
 */
export interface FolioWorkDir {
  match: string;
  reason: string;
}

// `content` left this table under bean `52dz` (2026-09-24): its only matches
// were `qa-sweep` and `lean-build`, which moved to the `folio_init` templates.
// `folio-assistant/computations` and `folio-assistant/snappea-wasm` left it
// under folio-assistant#3066 (2026-11-10), with `witness-refresh.yml` and
// `snappea_wasm.yml`, the only workflows that declared them.
export const FOLIO_WORKDIRS: FolioWorkDir[] = [
  {
    // declared-path-literal: a value this repo MATCHES against workflow text, not a path it reads. No declaration answers it — the workflows own the spelling.
    match: "tools/hecke-engine",
    reason:
      "the Rust engine's own source. `tools/` exists here and holds " +
      "`index.ts` alone, so this is absent content rather than a stale " +
      "prefix. Matches `tools/hecke-engine-wasm` too",
  },
  {
    // declared-path-literal: a value this repo MATCHES against workflow text, not a path it reads. No declaration answers it — the workflows own the spelling.
    match: "tools/pyhecke",
    reason: "the Python binding's own source; absent here for the same reason",
  },
];

/**
 * One `working-directory` declaration, and what became of it.
 *
 * ## Why this is a SEPARATE criterion from {@link Invocation}
 *
 * `invocationsFrom` reads `working-directory` to compute the frame a script
 * path resolves against. It is INPUT there, and trusted — nothing asks
 * whether the directory is there. Bean `ai9u`: eight declarations named
 * absent directories across four workflows while this module printed
 * `✓ every workflow script path resolves`.
 *
 * Two causes, and they compound. The value is never a subject; and a step
 * running `npx typedoc` rather than a script path contributes NO invocation
 * at all, so it is never examined however broken it is. A step whose
 * `working-directory` is missing fails 100 % of the time whatever it runs —
 * a stronger property than any path resolution here, and the one not checked.
 *
 * ## Why `cd` targets are NOT included
 *
 * GitHub evaluates `working-directory` **before** the script runs, so the
 * directory must pre-exist. A `cd` inside a `run:` block need not: the same
 * block may have just created it, and `publish.yml` does exactly that
 * (`mkdir -p appendices/`, then works in it). Folding the two together would
 * report a correct workflow as broken, which this module's own header calls
 * worse than having no check — it teaches the reader to skim, and then the
 * true positive goes by unread too.
 */
export interface WorkDir {
  file: string;
  job: string;
  /** The step's name, or `(job defaults)` / `(workflow defaults)`. */
  step: string;
  /** The value exactly as the workflow spells it. */
  dir: string;
  verdict: Verdict;
  note?: string;
}

/** A value GitHub computes at run time — nothing here can resolve it. */
const COMPUTED = /[$*?`]/;

function classifyWorkDir(
  wd: { file: string; job: string; step: string; dir: string },
  layout: CheckoutLayout,
): WorkDir {
  const base = { file: wd.file, job: wd.job, step: wd.step, dir: wd.dir };
  if (COMPUTED.test(wd.dir)) {
    return {
      ...base,
      verdict: Verdict.Undetermined,
      note:
        "the value is a matrix entry or expression, so which directory it " +
        "names is not knowable from the file",
    };
  }
  const dir = wd.dir.replace(/^\.\//, "").replace(/\/+$/, "");

  // A checkout at another ref RESOLVES here, and that is a real difference
  // from how {@link classify} treats the same prefix.
  //
  // For a script path the question is *what is in that tree*, which a working
  // copy of HEAD cannot answer — hence `Undetermined` there. For a cwd the
  // question is only *does the directory exist when the step starts*, and
  // `actions/checkout` creates it. `feature-staging.yml` works in `pages/`
  // holding `gh-pages`: its contents are unknowable from here and completely
  // beside the point. Carrying the invocation rule across would have made a
  // correct workflow an unfixable permanent unknown — an exemption nobody
  // could ever retire, which is the shape this module refuses everywhere else.
  const foreign = layout.otherRef.find((c) => dir === c.path || dir.startsWith(`${c.path}/`));
  if (foreign && dir === foreign.path) return { ...base, verdict: Verdict.Resolves };
  if (foreign) {
    return {
      ...base,
      verdict: Verdict.Undetermined,
      note:
        `it is below \`${foreign.path}/\`, this repository at ` +
        `\`${foreign.ref}\` — the checkout makes that root, but whether it ` +
        `holds \`${dir}\` is a fact about a tree HEAD cannot read`,
    };
  }

  // Under a checkout of THIS commit, so the run-time directory is the tree
  // below that prefix. An empty remainder is the checkout root itself.
  const inTree = stripCheckout(dir, layout.paths);
  if (inTree === "") return { ...base, verdict: Verdict.Resolves };

  // Checked out somewhere else entirely, and this value is not under it: the
  // workspace root is empty at run time, so the step's cwd is a directory the
  // job never materialised. Bean `7iog`, in the cwd rather than the path.
  if (layout.any && !layout.atRoot && inTree === dir) {
    return {
      ...base,
      verdict: Verdict.Missing,
      note:
        `this job checks the repository out to ` +
        `${layout.paths.map((p) => `\`${p}/\``).join(", ")} and nothing to ` +
        `the workspace root, so \`${dir}/\` is empty when the step starts`,
    };
  }

  if (existsSync(resolve(ROOT, inTree))) return { ...base, verdict: Verdict.Resolves };

  const folio = FOLIO_WORKDIRS.find((f) => dir.startsWith(f.match));
  if (folio) return { ...base, verdict: Verdict.NeedsFolio, note: folio.reason };

  return { ...base, verdict: Verdict.Missing };
}

/** The ratchet file, beside this module — see {@link workDirBaseline}. */
const BASELINE_FILE = join(TOOLS_ROOT, "scripts", "workdir-baseline.json");

/**
 * Known-open `working-directory` declarations — a RATCHET, not an exemption.
 *
 * {@link FOLIO_WORKDIRS} says a directory is absent here on purpose and always
 * will be. This file says the opposite: somebody still owes an answer, and
 * until they give it the gate should not be red for everyone else. So it may
 * only SHRINK — an entry that stops matching FAILS the run rather than being
 * dropped, which is the same direction `gates.ts` and {@link FOLIO_PATHS}
 * ratchet in, and for the same reason: a stale allowance reads as coverage.
 *
 * Keyed `<workflow>: <value>` rather than by line, so an unrelated step added
 * above does not churn it. Each key carries its reasoning in `why`, checked
 * against `known` on load — a baseline entry with no stated reason is how a
 * temporary allowance becomes permanent.
 */
export function workDirBaseline(): Set<string> {
  // `import.meta.dir`, not a spelled-out path, and the same way
  // `check-lockfile-pinning.ts` reaches its own. The file sits BESIDE this
  // module, so it travels with it; composing `cat-harness/scripts/` here
  // would be a second place that knows where this script lives, and this
  // repository's `check:declared-paths` gate catches exactly that — it
  // caught this, at 0 → 2, before the change left the working tree.
  if (!existsSync(BASELINE_FILE)) return new Set();
  const raw = JSON.parse(readFileSync(BASELINE_FILE, "utf-8")) as {
    known?: string[];
    why?: Record<string, string>;
  };
  const known = raw.known ?? [];
  const unexplained = known.filter((k) => !raw.why?.[k]?.trim());
  if (unexplained.length > 0) {
    throw new Error(
      `workdir-baseline.json: ${unexplained.length} entr(ies) carry no reason ` +
        `in \`why\` — ${unexplained.join(", ")}. An allowance with no stated ` +
        `reason is one nobody can ever retire.`,
    );
  }
  return new Set(known);
}

/** How a {@link WorkDir} is keyed in the baseline. */
export const workDirKey = (w: WorkDir): string => `${w.file}: ${w.dir}`;

/** Every `working-directory` in one workflow, at all three levels. */
export function workDirsFrom(file: string, text: string): WorkDir[] {
  const doc = parse(text) as WorkflowDoc;
  const out: WorkDir[] = [];
  const fileCwd = doc.defaults?.run?.["working-directory"];
  /** Workflow-level verdicts, deduped — see the comment at its push site. */
  const fileLevel = new Map<string, WorkDir>();
  for (const [job, def] of Object.entries(doc.jobs ?? {})) {
    const layout = checkoutLayout(def.steps);
    const jobCwd = def.defaults?.run?.["working-directory"];
    if (fileCwd !== undefined) {
      // A workflow-level default is ONE declaration, however many jobs
      // inherit it — `snappea_wasm.yml` sets one covering four. Emitting it
      // per job would turn a single edit into four findings and make the
      // count read as a severity. It is still CLASSIFIED per job, because
      // each job has its own checkout layout and the same value can resolve
      // in one and not another; a second verdict is therefore a real second
      // finding, and only an identical repeat is folded away.
      const wd = classifyWorkDir({ file, job, step: "(workflow defaults)", dir: fileCwd }, layout);
      const seen = fileLevel.get(wd.verdict + (wd.note ?? ""));
      if (seen) seen.job += `, ${job}`;
      else fileLevel.set(wd.verdict + (wd.note ?? ""), wd);
    }
    if (jobCwd !== undefined) {
      out.push(classifyWorkDir({ file, job, step: "(job defaults)", dir: jobCwd }, layout));
    }
    for (const step of def.steps ?? []) {
      const own = step["working-directory"];
      if (own === undefined) continue;
      out.push(
        classifyWorkDir({ file, job, step: step.name ?? "(unnamed step)", dir: own }, layout),
      );
    }
  }
  return [...fileLevel.values(), ...out];
}

/** Every `working-directory` in every workflow, in file order. */
export function allWorkDirs(root = ROOT): WorkDir[] {
  const dir = join(root, WORKFLOW_DIR);
  const out: WorkDir[] = [];
  if (!existsSync(dir)) throw new NoInvocationsFound();
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    out.push(...workDirsFrom(f, readFileSync(join(dir, f), "utf-8")));
  }
  return out;
}

/** Thrown when the reader finds nothing — never reported as a clean run. */
export class NoInvocationsFound extends Error {
  constructor() {
    super(
      `${WORKFLOW_DIR}: no script invocations were extracted. That is not a ` +
        `clean sweep, it is a broken reader — a filter over nothing passes. ` +
        `Fix the extraction; do not treat this as green.`,
    );
    this.name = "NoInvocationsFound";
  }
}

/** Every invocation in every workflow, in file order. */
export function allInvocations(root = ROOT): Invocation[] {
  const dir = join(root, WORKFLOW_DIR);
  const out: Invocation[] = [];
  if (!existsSync(dir)) throw new NoInvocationsFound();
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    out.push(...invocationsFrom(f, readFileSync(join(dir, f), "utf-8")));
  }
  if (out.length === 0) throw new NoInvocationsFound();
  return out;
}

/**
 * Why the allowlist ratchets ({@link FOLIO_PATHS}, {@link FOLIO_WORKDIRS},
 * {@link workDirBaseline}) cannot be judged STALE in `root`, or null when they can.
 *
 * Every entry describes a step of the HARNESS index's own workflows — the root
 * that carries the gates workflow (`rootProfile` "harness"). In a CONTENT root
 * (an instance run by layer-pr-checks, e.g. smart-ips-pilgrimage#13) those
 * steps were never here, so "matches nothing" says nothing about whether the
 * exemption outlived its step (cat-harness-tools#1701). Both criteria still
 * judge this root's own workflows in full, and a harness root ratchets as before.
 */
export function allowlistsNotOursReason(root: string): string | null {
  return rootProfile(root) === "content"
    ? "this is a content root (no .github/workflows/code-quality-gates.yml); the entry exempts a step of the harness index's workflows, not of this root's"
    : null;
}

/**
 * `.github/` prefixes and bootstrap files a workflow `run:` step may invoke
 * directly (bean `folio-assistant-dtda`). Skill and tool source belongs in
 * declared KG directories, never under `.github/skills/` or another hidden
 * `.github/` subtree.
 */
export const ALLOWED_GITHUB_PREFIXES = [
  ".github/workflows/",
  ".github/scripts/",
  ".github/ci-image/",
  ".github/actions/",
] as const;

export const ALLOWED_GITHUB_FILES = [
  ".github/mount-from-lock.sh",
  ".github/cat.ts",
] as const;

/** A workflow `run:` step invoking a disallowed path under `.github/`. */
export interface GithubPathFinding {
  file: string;
  job: string;
  step: string;
  /** The path as written in the `run:` block. */
  path: string;
  /** The normalised `.github/...` path. */
  githubPath: string;
}

/**
 * Whether a `.github/...` path is allowed as a workflow `run:` invocation:
 * `.github/workflows/`, CI plumbing (`.github/scripts/`, `.github/ci-image/`,
 * `.github/actions/`, `.github/mount-from-lock.sh`, `.github/cat.ts`), or a
 * directory declared in a graph manifest (`declaredDirs`).
 */
export function isAllowedGithubInvocation(
  ghPath: string,
  declaredDirs: ReadonlySet<string> = new Set(),
): boolean {
  const clean = ghPath.replace(/^\.\//, "");
  if (!clean.startsWith(".github/")) return true;
  if ((ALLOWED_GITHUB_FILES as readonly string[]).includes(clean)) return true;
  if (ALLOWED_GITHUB_PREFIXES.some((p) => clean.startsWith(p))) return true;
  for (const raw of declaredDirs) {
    const d = raw.replace(/^\.\//, "").replace(/\/+$/, "");
    if (clean === d || clean.startsWith(`${d}/`)) return true;
  }
  return false;
}

function invokedCandidateOnLine(line: string): string | undefined {
  const direct = invokedPath(line);
  if (direct) return direct;
  const t = line.trim();
  const pyMod = /^python3?\s+(?:-[\w-]+\s+)*-m\s+["']?(\.github\.[\w.]+)["']?(?:\s|$)/.exec(t);
  if (pyMod) return pyMod[1]!.replace(/\./g, "/");
  const interp = /^(?:python3?|node|deno\s+run)\s+(?:-[\w-]+\s+)*["']?(\S+?)["']?(?:\s|$)/.exec(t);
  if (interp && !interp[1]!.startsWith("-") && /\.(?:py|ts|mts|js|mjs|cjs|sh)$/.test(interp[1]!)) {
    return interp[1]!;
  }
  const bare = /^["']?((?:\.{1,2}\/)*\.github\/\S+?)["']?(?:\s|$)/.exec(t);
  if (bare) return bare[1]!;
  return undefined;
}

/**
 * Disallowed `.github/` invocations in one workflow (bean
 * `folio-assistant-dtda`).
 */
export function githubPathFindingsFrom(
  file: string,
  text: string,
  declaredDirs: ReadonlySet<string> = new Set(),
): GithubPathFinding[] {
  const doc = parse(text) as WorkflowDoc;
  const out: GithubPathFinding[] = [];
  for (const [job, def] of Object.entries(doc.jobs ?? {})) {
    const jobCwd =
      def.defaults?.run?.["working-directory"] ??
      doc.defaults?.run?.["working-directory"] ??
      "";
    const layout = checkoutLayout(def.steps);
    for (const step of def.steps ?? []) {
      if (!step.run) continue;
      let cwd: string | null = step["working-directory"] ?? jobCwd;
      for (const raw of step.run.split("\n")) {
        for (const segment of raw.split("&&")) {
          const line = segment.trim();
          if (!line || line.startsWith("#")) continue;
          const cd = cdTarget(line);
          if (cd === null) {
            cwd = null;
            continue;
          }
          if (cd !== undefined) {
            cwd = cwd === null ? null : applyCd(cwd, cd);
            continue;
          }
          const candidate = invokedCandidateOnLine(line);
          if (!candidate) continue;
          const flag = cwdFlag(line);
          const effective = cwd === null ? "" : flag ? applyCd(cwd, flag) : cwd;
          const joined = applyCd(effective, candidate);
          const inTree = stripCheckout(joined, layout.paths);
          const m =
            /(?:^|\/)(\.github\/\S+)$/.exec(inTree) ??
            /(?:^|\/)(\.github\/\S+)$/.exec(candidate);
          if (!m) continue;
          const githubPath = m[1]!;
          if (!isAllowedGithubInvocation(githubPath, declaredDirs)) {
            out.push({
              file,
              job,
              step: step.name ?? "(unnamed step)",
              path: candidate,
              githubPath,
            });
          }
        }
      }
    }
  }
  return out;
}

/** Declared directories across `root` and its mounted instance directories, relative to `root`. */
export function declaredDirsFor(root = ROOT): Set<string> {
  const out = new Set<string>();
  const addFrom = (inst: string): void => {
    try {
      for (const d of resolveDirectories([{ name: "(local)", root: inst, own: true }])) {
        const rel = d.absPath ? relative(root, d.absPath) : d.path;
        if (rel) out.add(rel.replace(/\/+$/, ""));
      }
    } catch {
      // Non-instance directory contributes nothing.
    }
  };
  addFrom(root);
  if (existsSync(root)) {
    for (const e of readdirSync(root, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
        addFrom(join(root, e.name));
      }
    }
  }
  return out;
}

/** Every disallowed `.github/` invocation across every workflow in `root`. */
export function allGithubPathFindings(
  root = ROOT,
  declaredDirs: ReadonlySet<string> = declaredDirsFor(root),
): GithubPathFinding[] {
  const dir = join(root, WORKFLOW_DIR);
  const out: GithubPathFinding[] = [];
  if (!existsSync(dir)) throw new NoInvocationsFound();
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    out.push(...githubPathFindingsFrom(f, readFileSync(join(dir, f), "utf-8"), declaredDirs));
  }
  return out;
}

function main(): number {
  const list = process.argv.includes("--list");
  const invocations = allInvocations();
  const workDirs = allWorkDirs();

  if (list) {
    for (const i of invocations) {
      const where = i.cwd === "" ? "<root>" : i.cwd;
      console.log(`${i.verdict.padEnd(12)} ${i.path}  [${i.file} ${where}]`);
    }
    for (const w of workDirs) {
      console.log(`${w.verdict.padEnd(12)} cwd ${w.dir}  [${w.file} ${w.job}]`);
    }
  }

  const missing = invocations.filter((i) => i.verdict === Verdict.Missing);
  const undetermined = invocations.filter((i) => i.verdict === Verdict.Undetermined);
  const folio = invocations.filter((i) => i.verdict === Verdict.NeedsFolio);

  // An exemption matching nothing is a claim about the present that stopped
  // being true. Ratchet in the other direction, same as `gates.ts`.
  const notOurs = allowlistsNotOursReason(ROOT);
  const unusedAll = FOLIO_PATHS.filter(
    (f) => !invocations.some((i) => i.path.includes(f.match)),
  );
  // cat-harness-tools#1701: in a content root an unused entry is excused, and
  // said so, rather than red — see allowlistsNotOursReason.
  const unused = notOurs === null ? unusedAll : [];
  for (const f of notOurs === null ? [] : unusedAll) {
    console.log(`· FOLIO_PATHS entry \`${f.match}\` matches no invocation — not applicable here — ${notOurs}.`);
  }

  console.log(
    `${invocations.length} invocation(s): ${invocations.length - missing.length - undetermined.length - folio.length} resolve, ` +
      `${folio.length} need a folio, ${missing.length} missing, ${undetermined.length} undetermined`,
  );

  for (const i of missing) {
    // A `note` means the invocation failed for a reason the generic sentence
    // would MISSTATE. The layout case resolves perfectly well from the
    // repository root — saying it does not is the misconception the check
    // exists to correct, printed by the check itself.
    console.error(
      i.note
        ? `✗ ${i.file} › ${i.step}: \`${i.path}\` — ${i.note}.`
        : `✗ ${i.file} › ${i.step}: \`${i.path}\` does not resolve from ` +
            `${i.cwd === "" ? "the repository root" : `\`${i.cwd}/\``}. ` +
            `If the script moved under \`cat-harness/\`, call the npm script ` +
            `instead so the path is written down once.`,
    );
  }
  for (const i of undetermined) {
    console.error(`? ${i.file} › ${i.step}: \`${i.path}\` — ${i.note}. Not treated as a pass.`);
  }
  for (const f of unused) {
    console.error(
      `✗ FOLIO_PATHS entry \`${f.match}\` matches no invocation — remove it. ` +
        `An exemption outliving its step reads as coverage.`,
    );
  }

  // ── The SECOND criterion: does the cwd itself exist? (bean `ai9u`) ──
  const baseline = workDirBaseline();
  const isKnown = (w: WorkDir): boolean => baseline.has(workDirKey(w));
  const badDirs = workDirs.filter((w) => w.verdict === Verdict.Missing && !isKnown(w));
  const openDirs = workDirs.filter((w) => w.verdict === Verdict.Undetermined && !isKnown(w));
  const heldDirs = workDirs.filter(
    (w) => w.verdict !== Verdict.Resolves && w.verdict !== Verdict.NeedsFolio && isKnown(w),
  );
  // Same direction as every other ratchet here: an allowance that no longer
  // matches anything is a claim about the present that stopped being true.
  const staleBaselineAll = [...baseline].filter(
    (k) => !workDirs.some((w) => workDirKey(w) === k && w.verdict !== Verdict.Resolves),
  );
  const folioDirs = workDirs.filter((w) => w.verdict === Verdict.NeedsFolio);
  const unusedDirsAll = FOLIO_WORKDIRS.filter(
    (f) => !workDirs.some((w) => w.dir.startsWith(f.match)),
  );
  // cat-harness-tools#1701: same excuse as FOLIO_PATHS above, for both ratchets.
  const staleBaseline = notOurs === null ? staleBaselineAll : [];
  const unusedDirs = notOurs === null ? unusedDirsAll : [];
  if (notOurs !== null) {
    for (const k of staleBaselineAll) {
      console.log(`· workdir-baseline.json entry \`${k}\` matches nothing open — not applicable here — ${notOurs}.`);
    }
    for (const f of unusedDirsAll) {
      console.log(`· FOLIO_WORKDIRS entry \`${f.match}\` matches no declaration — not applicable here — ${notOurs}.`);
    }
  }

  console.log(
    `${workDirs.length} working-directory declaration(s): ` +
      `${workDirs.length - badDirs.length - openDirs.length - folioDirs.length - heldDirs.length} resolve, ` +
      `${folioDirs.length} need a folio, ${heldDirs.length} baselined, ` +
      `${badDirs.length} missing, ${openDirs.length} undetermined`,
  );

  // Printed on a GREEN run too. A baselined defect that nobody is reminded of
  // is one nobody retires, and this file exists to be emptied.
  for (const w of heldDirs) {
    console.log(
      `· held  ${w.file} › ${w.job} › ${w.step}: \`${w.dir}\` (${w.verdict}) — ` +
        `baselined, still owed`,
    );
  }
  for (const k of staleBaseline) {
    console.error(
      `✗ workdir-baseline.json entry \`${k}\` matches nothing open — remove it. ` +
        `A baseline may only shrink, and a stale one reads as coverage.`,
    );
  }

  for (const w of badDirs) {
    console.error(
      w.note
        ? `✗ ${w.file} › ${w.job} › ${w.step}: \`working-directory: ${w.dir}\` — ${w.note}.`
        : `✗ ${w.file} › ${w.job} › ${w.step}: \`working-directory: ${w.dir}\` does ` +
            `not exist. GitHub evaluates it BEFORE the step runs, so this step ` +
            `fails every time regardless of what it does.`,
    );
  }
  for (const w of openDirs) {
    console.error(
      `? ${w.file} › ${w.job} › ${w.step}: \`working-directory: ${w.dir}\` — ` +
        `${w.note}. Not treated as a pass.`,
    );
  }
  for (const f of unusedDirs) {
    console.error(
      `✗ FOLIO_WORKDIRS entry \`${f.match}\` matches no declaration — remove it. ` +
        `An exemption outliving its step reads as coverage.`,
    );
  }

  // ── The THIRD criterion: no workflow `run:` invokes undeclared `.github/` paths (bean `folio-assistant-dtda`) ──
  const ghFindings = allGithubPathFindings();
  for (const g of ghFindings) {
    console.error(
      `✗ ${g.file} › ${g.job} › ${g.step}: \`${g.path}\` invokes \`${g.githubPath}\` — ` +
        `a workflow \`run:\` may not invoke a path under \`.github/\` other than ` +
        `\`.github/workflows/\`, CI plumbing (\`.github/scripts/\`, \`.github/ci-image/\`, ` +
        `\`.github/actions/\`, \`.github/mount-from-lock.sh\`, \`.github/cat.ts\`) or a ` +
        `declared directory.`,
    );
  }

  const bad =
    missing.length +
    undetermined.length +
    unused.length +
    badDirs.length +
    openDirs.length +
    unusedDirs.length +
    staleBaseline.length +
    ghFindings.length;
  if (bad === 0) {
    console.log(
      "✓ every workflow script path resolves, and every `working-directory` " +
        "exists — or is declared folio-only with a reason.",
    );
    return 0;
  }
  return 1;
}

if (import.meta.main) process.exit(main());
