/**
 * Shared utilities for QA sidecar tooling.
 *
 * @module pipeline/qa-utils
 */

import { createHash } from "crypto";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "fs";
import { join, resolve } from "path";
import { execFileSync } from "child_process";
import { findDeclarationFile, graphLayer, readDeclaration } from "../schemas/kg/cat-harness.js";
import { portableSegment } from "../schemas/kg/portable-path.ts";
import { criterionSourceHash } from "./qa-criterion-hash";
import { maskStringsAndComments, parseStringField } from "./uses-field";
import {
  formalStatementHash,
  listFormalSourceFiles,
  resolveCanonicalFormal,
  type FormalTreeCache,
} from "../schemas/formal-ref.js";
import { mkdirSync } from "fs";
import { dirname } from "path";
import type {
  BlockQaReport,
  QaFieldHash,
  QaCriterionEntry,
  QaScriptSidecar,
  CompanionRole,
  QaCriterionDefinition,
} from "../schemas/sdlc/block-qa.ts";
import { COMPANION_ROLES } from "../schemas/sdlc/block-qa.ts";
import { ALL_BLOCK_BUILDER_ALT, blockBuilderAlt, kindForBuilder } from "../schemas/content/block-kinds.ts";
import { QA_CRITERIA_BY_ID } from "./qa-criteria-registry";
import { findContentRepoRoot } from "./repo-root";
import { loadBlockModuleSync, type BlockLoadFailure } from "./block-module";
import { blockQaPath, existingBlockQaPath } from "./qa-paths";
import { overlayPath, writePathOf } from "../scripts/lib/layer-output.ts";
import { readBaseline } from "../scripts/qa-results.ts";
import { evaluateJsonManifest, isJsonManifest } from "./json-manifest.ts";
import type { QaStoreOptions } from "../scripts/qa-store.ts";

// ── Hashing ─────────────────────────────────────────────────────

/**
 * 12-char SHA-256 prefix of a file's UTF-8 bytes — mirrors
 * `folio-assistant/computations/witness_staleness_tracker.py`.
 */
export function hashFile(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const buf = readFileSync(path);
  return createHash("sha256").update(buf).digest("hex").slice(0, 12);
}

/**
 * Build a companion hash bundle, omitting absent files.
 *
 * Accepts any {@link CompanionRole}, not just the paper adapter's
 * `md`/`ts`/`lean` — a WHO L2 block hashes its `.dmn`, an L3 block its
 * `.fsh`. Roles the caller does not pass are simply absent, so every
 * existing `{md, ts, lean}` call site is unchanged.
 */
export function hashBlockFiles(
  paths: Partial<Record<CompanionRole, string>>,
): QaFieldHash {
  const out: QaFieldHash = {};
  for (const role of COMPANION_ROLES) {
    if (role === "lean") continue; // handled below — it also derives a statement hash
    const p = paths[role];
    if (!p) continue;
    const h = hashFile(p);
    if (h) out[role] = h;
  }
  if (paths.lean) {
    const h = hashFile(paths.lean);
    if (h) out.lean = h;
    // Statement-level hash for criteria that only read the signature
    // (`lean_granularity: "statement"`). `undefined` when the file has
    // no lexable declarations — freshness then falls back to `lean`,
    // which over-invalidates rather than under.
    const sh = formalStatementHash(paths.lean);
    if (sh) out.lean_statement = sh;
  }
  return out;
}

// ── Repo info ───────────────────────────────────────────────────

/**
 * Sentinel used when git is unavailable or the path is untracked.
 * Matches the convention in `witness_base._git_file_sha()` (Python
 * compute pipeline) so JSON consumers see an explicit token rather
 * than an empty string.
 */
export const GIT_SHA_UNKNOWN = "unknown";

/**
 * Current HEAD SHA (full). Returns the `unknown` sentinel outside
 * a git repo.
 */
export function gitHeadSha(repoRoot?: string): string {
  try {
    // `repoRoot` matters once the pipeline is run from a DIFFERENT repo
    // than the one being described. Without `-C`, this reads
    // `process.cwd()` — the content repo — which is right for a block
    // verdict's `reviewed_sha` and wrong for anything recording the
    // platform's own state.
    const args = repoRoot
      ? ["-C", repoRoot, "rev-parse", "HEAD"]
      : ["rev-parse", "HEAD"];
    // input-site: head #0901bc77 — rev-parse HEAD
    return execFileSync("git", args, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return GIT_SHA_UNKNOWN;
  }
}

/**
 * Tree id of HEAD (`HEAD^{tree}`, full). Returns the `unknown` sentinel
 * outside a git repo. `-C repoRoot` is handled as in {@link gitHeadSha}.
 *
 * A QA verdict records this as `reviewed_tree` rather than HEAD's commit id
 * (bean 69lr; owner card Q4, 2026-11-05: "the tree is the identity"). On a
 * pull_request CI run HEAD is GitHub's synthetic `refs/pull/<n>/merge`
 * commit, which is replaced when main moves and may be garbage-collected, so
 * a commit id recorded there stops being an address. The commit that lands on
 * main has the same tree, so the tree id stays reachable and names exactly the
 * inputs the verdict was computed from — and a bundle built on the PR names
 * the same thing main would.
 *
 * Like `reviewed_sha` before it, the tree is an honest address of what was
 * reviewed only when the working tree is clean: uncommitted edits are not in
 * `HEAD^{tree}`. Under CI the checkout is clean but for generated outputs;
 * nothing here detects a dirty tree, exactly as nothing did for the sha.
 */
export function gitHeadTree(repoRoot?: string): string {
  try {
    const args = repoRoot
      ? ["-C", repoRoot, "rev-parse", "HEAD^{tree}"]
      : ["rev-parse", "HEAD^{tree}"];
    // input-site: head #0901bc77 — rev-parse HEAD^{tree}: the tree of HEAD
    return execFileSync("git", args, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return GIT_SHA_UNKNOWN;
  }
}

/**
 * Full git SHA of the most recent commit touching `relPath`, where
 * `relPath` is repo-relative (e.g. `pipeline/foo.ts`).
 * Returns the `unknown` sentinel if `path` is not tracked / outside
 * a git repo.
 *
 * Runs `git -C <repoRoot> log ... -- <relPath>` via `execFileSync`
 * (no shell interpolation) — git pathspecs are interpreted relative
 * to the repo root, so passing an absolute path is brittle and
 * tooling-cwd-dependent. Pinning cwd via `-C` makes the call
 * robust regardless of where the qa-sweep process is invoked from.
 */
/**
 * Is this checkout truncated? Cached PER REPOSITORY — `gitFileCommitSha` is
 * called once per criterion, so the probe is worth caching, but keying it on
 * nothing is a bug: one process can legitimately ask about two repositories
 * (a test fixture, a folio plus the platform), and a shared boolean answers
 * the second question with the first one's answer. Caught by the test that
 * builds a full clone and a shallow clone in the same run.
 */
const shallowCache = new Map<string, boolean>();
function isShallowRepo(repoRoot: string): boolean {
  const hit = shallowCache.get(repoRoot);
  if (hit !== undefined) return hit;
  let value: boolean;
  try {
    value =
      // input-site: head #78047794 — rev-parse --is-shallow-repository: the shallow boundary, hashed with HEAD
      execFileSync("git", ["-C", repoRoot, "rev-parse", "--is-shallow-repository"], {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim() === "true";
  } catch {
    // Cannot tell ⇒ assume truncated. The safe direction is to decline to
    // answer, never to answer wrongly.
    value = true;
  }
  shallowCache.set(repoRoot, value);
  return value;
}

/** The commits at a shallow clone's graft boundary, where history stops. */
const boundaryCache = new Map<string, Set<string>>();
function graftBoundary(repoRoot: string): Set<string> {
  const hit = boundaryCache.get(repoRoot);
  if (hit) return hit;
  let value: Set<string>;
  try {
    value = new Set(
      // input-site: head #a7c85737 — rev-list --max-parents=0 HEAD
      execFileSync("git", ["-C", repoRoot, "rev-list", "--max-parents=0", "HEAD"], {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim()
        .split("\n")
        .filter(Boolean),
    );
  } catch {
    value = new Set();
  }
  boundaryCache.set(repoRoot, value);
  return value;
}

/**
 * `<repoRoot>\0<relPath>` -> the answer, and the HEAD it was computed AT.
 *
 * ## Why this is cached, with the measurement
 *
 * `git log -n 1` costs **20.05 ms** (measured 2026-09-27, bean `sff8`), and
 * `entry()` in `translation-block-qa.ts` calls this once PER CRITERION, so one
 * `buildReport` spent ~66 ms of subprocess time re-asking two questions whose
 * answers do not change. That is a production cost, not a test one: the QA sweep
 * runs `buildReport` per block per locale, so a sweep over N subjects paid 66N ms
 * for it. It surfaced as a test that is 4 % of its budget on an idle machine and
 * was twice seen at 28-41x over it, because PROCESS CREATION is what degrades
 * under load — the spawns queue behind every other test file's work.
 *
 * ## Why it is keyed on HEAD rather than cached for the process lifetime
 *
 * The owner's decision of 2026-09-27, and the reason is a failure mode this
 * repository has twice: a **stale provenance recorded as a fresh verdict** is what
 * `sfjo` and `rmcf` are both about. `qa-utils.ts` is reachable from the
 * long-running MCP server, where a commit can land mid-process — and a verdict
 * stamped with the previous HEAD would be confidently wrong rather than unknown.
 *
 * Keying on HEAD is sound because the answer — the last commit that touched a path
 * — can only change when a new commit lands, which moves HEAD. And it is cheap
 * because `git rev-parse HEAD` costs **1.96 ms** against that 20.05 ms, so the
 * probe stays UNCACHED as the invalidation signal and only the expensive half is
 * memoised: ~66 ms per `buildReport` becomes ~6 ms.
 *
 * `GIT_SHA_UNKNOWN` is cached like any other answer. A non-git directory returns it
 * for every path under one key, which is correct: the question has one answer there.
 */
const fileCommitCache = new Map<string, { head: string; sha: string }>();

export function gitFileCommitSha(relPath: string, repoRoot: string): string {
  // The invalidation probe, deliberately NOT memoised — it is what makes the
  // memo safe, and at 1.96 ms it is a tenth of what it protects.
  const head = gitHeadSha(repoRoot);
  const key = `${repoRoot}\u0000${relPath}`;
  const hit = fileCommitCache.get(key);
  if (hit && hit.head === head) return hit.sha;
  const sha = computeFileCommitSha(relPath, repoRoot);
  fileCommitCache.set(key, { head, sha });
  return sha;
}

/** The uncached body — every `git` call this function ever made lives here. */
function computeFileCommitSha(relPath: string, repoRoot: string): string {
  try {
    // input-site: head #99683ba2 — git log -1 -- <path>: history reachable from HEAD
    const out = execFileSync(
      "git",
      ["-C", repoRoot, "log", "-n", "1", "--format=%H", "--", relPath],
      { stdio: ["ignore", "pipe", "ignore"] },
    )
      .toString()
      .trim();
    if (!out) return GIT_SHA_UNKNOWN;

    // A SHALLOW CLONE CANNOT ANSWER THIS QUESTION, and answers anyway.
    //
    // `git log -1 -- <file>` reports the newest commit IN THE FETCHED WINDOW
    // that touched the file. For a file untouched inside that window it
    // reports the GRAFT BOUNDARY — the commit where history stops and every
    // file looks newly added — which is indistinguishable, to the caller,
    // from a real answer.
    //
    // Measured 2026-09-18 in a 102-commit shallow checkout: a sweep rewrote
    // 77 of 78 script sidecars to the single boundary sha, destroying real
    // provenance that carried NINE distinct commits. The corruption is
    // silent and looks like a tidy-up; it took reading `.git/shallow` to
    // see it. Same wall ci-health.yml avoids by checking out with
    // `fetch-depth: 0`.
    //
    // So: boundary commit in a shallow repo ⇒ "unknown", not that commit.
    // Callers preserve the stored value on "unknown" rather than overwrite,
    // which keeps a truthful record instead of a confident wrong one.
    if (isShallowRepo(repoRoot) && graftBoundary(repoRoot).has(out)) {
      return GIT_SHA_UNKNOWN;
    }
    return out;
  } catch {
    return GIT_SHA_UNKNOWN;
  }
}

// ── Script-hash helpers ─────────────────────────────────────────

/**
 * 12-char SHA-256 prefix of the concatenated content of `paths`,
 * in the order given. Used for `deps_hash` on reviewer entries
 * (multiple extra inputs roll up into one fingerprint).
 *
 * Each entry of `paths` is `{ label, abs }`: `abs` is the
 * filesystem path to read bytes from; `label` is the path string
 * mixed into the hash to disambiguate "two files with the same
 * content but different declared paths" from each other AND to
 * mark presence/absence. Callers should pass **repo-relative**
 * labels (not absolute) so the hash is portable across machines /
 * checkout locations — otherwise the same byte-identical inputs
 * produce different `deps_hash` values per environment.
 */
export function hashFiles(
  paths: Array<{ label: string; abs: string }>,
): string | undefined {
  if (paths.length === 0) return undefined;
  const h = createHash("sha256");
  for (const { label, abs } of paths) {
    if (!existsSync(abs)) {
      h.update(`__absent__:${label}\n`);
      continue;
    }
    h.update(`__file__:${label}\n`);
    h.update(readFileSync(abs));
    h.update("\n");
  }
  return h.digest("hex").slice(0, 12);
}

/**
 * Cache key for the script-hash bundle attached to one criterion.
 * Computed once per qa-sweep run and reused for every block under
 * sweep.
 */
export interface CriterionScriptHashes {
  /** Criterion id. */
  criterion_id: string;
  /** Path to checker source file (may not exist on disk). */
  source_file: string;
  /**
   * 12-char SHA-256 of the checker's own code: its dispatch entry plus the
   * transitive closure of module-local declarations it references. Falls back
   * to hashing the whole source file when that closure cannot be resolved.
   * Empty if the file is absent.
   *
   * Per-criterion rather than per-file so that editing one checker does not
   * invalidate every other criterion sharing its module — see
   * `qa-criterion-hash.ts` for why that matters.
   */
  script_hash: string;
  /** Full git SHA of the file's most recent commit. */
  script_commit_sha: string;
  /** Resolved extra-input paths, in declared order. */
  extra_inputs: string[];
  /** 12-char SHA-256 over concat(extra_inputs). Undefined if no extras. */
  deps_hash?: string;
  /**
   * 12-char SHA-256 over the criterion definition's run-affecting fields.
   * See {@link criterionDefHash} and `QaReviewer.def_hash`.
   */
  def_hash?: string;
}

/**
 * Hash the fields of a criterion definition that decide WHETHER or HOW it
 * runs, so that editing one invalidates the verdicts it would now answer
 * differently.
 *
 * The six fields, and why each is here:
 *
 * - `profiles` / `adapters` / `voices` — whether the criterion applies to this
 *   folio at all. `voices` is here for the same reason the other two are: a
 *   criterion narrowed to a voice nobody activated must go `n/a` on the next
 *   sweep, not keep its last verdict. These are the ones that were silently inert: the profile gate in
 *   `qa-sweep` is reached only when the freshness gate lets the block through.
 * - `applies_to` — whether it applies to this block's KIND.
 * - `depends_on` — which companion files gate applicability AND which hashes
 *   `entryIsFresh` compares, so a change here changes the freshness question
 *   itself.
 * - `default_severity` — recorded on the entry, so a re-grading has to
 *   propagate or the sidecar under-reports.
 * - `lean_granularity` — selects statement-vs-file hash comparison.
 *
 * `description` is excluded on purpose: for a script criterion it is
 * documentation, and hashing it would re-sweep a corpus over a typo.
 *
 * Order is fixed by this function rather than by the object's key order, so
 * two definitions that differ only in field order hash the same. Absent
 * fields hash as the empty string rather than being omitted, so adding a
 * field with its default value is not mistaken for a change.
 */
export function criterionDefHash(def: {
  profiles?: readonly string[];
  voices?: readonly string[];
  adapters?: readonly string[];
  applies_to?: readonly string[];
  depends_on?: readonly string[];
  default_severity?: string;
  lean_granularity?: string;
}): string {
  // Sorted, so a reordering of a list that is semantically a SET does not
  // read as a change. All six are sets in use.
  const list = (v?: readonly string[]) =>
    v === undefined ? "" : [...v].sort().join(",");
  const parts = [
    list(def.profiles),
    list(def.voices),
    list(def.adapters),
    list(def.applies_to),
    list(def.depends_on),
    def.default_severity ?? "",
    def.lean_granularity ?? "",
  ];
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 12);
}

/**
 * Build the script-hash bundle for one criterion: hash its source
 * file + its extra-input files (if any). Pure read of disk; no
 * caching here — callers should memoize across the sweep run.
 *
 * `sourceFile` and `extraInputs` are repo-relative paths. `repoRoot`
 * is the absolute directory they should be resolved against — this
 * decouples the helper from `process.cwd()`, since qa-sweep runs
 * with cwd inside `content/`.
 */
export function computeCriterionScriptHashes(
  criterionId: string,
  sourceFile: string,
  extraInputs: string[] = [],
  repoRoot: string = process.cwd(),
  /**
   * The criterion definition, for `def_hash`. Optional so a caller that has
   * only the id still compiles — but a bundle without it cannot invalidate on
   * a re-scoping, which is the whole point of the field, so pass it.
   */
  def?: Parameters<typeof criterionDefHash>[0],
  /**
   * What the sidecar should RECORD as `source_file`, when that differs from
   * the path the bytes are read at. Defaults to `sourceFile`.
   *
   * They differ for a CONTRIBUTED checker: the bytes live in the contributing
   * layer, so `repoRoot`/`sourceFile` point there, while the recorded label
   * is `<contributor>/<sourceFile>`. Without it two layers holding the same
   * relative path would write the same `source_file` into different sidecars,
   * and a reader could not tell whose checker a verdict came from.
   *
   * `script_commit_sha` deliberately still uses `sourceFile` against
   * `repoRoot`: it is a git pathspec, and git must be asked about the file
   * that actually exists.
   */
  recordAs?: string,
): CriterionScriptHashes {
  const absSource = join(repoRoot, sourceFile);
  // Hash extra inputs with their repo-relative labels (NOT
  // absolute paths) so the resulting `deps_hash` is portable across
  // machines / checkout locations. Bytes are still read from the
  // absolute path; only the label salt comes from the relative
  // form.
  const labelled = extraInputs.map((p) => ({
    label: p,
    abs: join(repoRoot, p),
  }));
  return {
    criterion_id: criterionId,
    source_file: recordAs ?? sourceFile,
    // Prefer the per-criterion closure hash; fall back to the whole file when
    // the criterion cannot be located or its closure cannot be trusted. The
    // fallback over-invalidates (churn) rather than under-invalidating (stale
    // verdicts silently kept), which is the safe direction.
    script_hash:
      criterionSourceHash(absSource, criterionId) ?? hashFile(absSource) ?? "",
    // Pass the repo-relative `sourceFile` (not `absSource`) so git
    // interprets the pathspec correctly against `repoRoot`.
    script_commit_sha: gitFileCommitSha(sourceFile, repoRoot),
    extra_inputs: extraInputs,
    deps_hash: extraInputs.length > 0 ? hashFiles(labelled) : undefined,
    def_hash: def ? criterionDefHash(def) : undefined,
  };
}

// ── Canonical lean.ref resolution — DELEGATED ───────────────────
//
// The resolver itself moved to `pipeline/lean-formal-ref.ts` (the
// science layer) on the owner ruling of 2026-09-27 that the `lean.ref` grammar
// is science vocabulary. What is left here is two one-line delegations at the
// OLD names and arities, because three qou scripts and `src/qa-agent-write.ts`
// call them and one of them holds a cache across a whole sweep
// (`scripts/check-base-ring.ts`).
//
// The bodies moved verbatim rather than being rewritten in transit: this is
// THE single source of truth for `lean.ref` -> on-disk file, and a rewrite
// during a move makes a behaviour change indistinguishable from the move.

/**
 * Per-package basename → first-path index for one source root, keyed by the
 * absolute root path. Bulk callers (walking many blocks) build this once and
 * reuse it so the tree is scanned a single time rather than once per ref.
 *
 * Now an alias of core's formalism-neutral {@link FormalTreeCache}. The NAME is
 * kept because `scripts/check-base-ring.ts` imports the type by it.
 */
export type LakeTreeCache = FormalTreeCache;

/**
 * Resolve a content block's package-qualified `lean.ref` URI (e.g.
 * `qou:QOU.FluidDynamics.q_bkm_criterion`) to the **canonical compiled
 * declaration file** under the package's Lake tree.
 *
 * Returns `undefined` when the ref is absent or malformed, the package is
 * unknown, no file is found — **or no formalism layer is installed**. That last
 * case is new only in its visibility: before the move, an unconfigured
 * `leanPackageByName` returned `undefined` and produced the same answer with no
 * way to ask. Callers that can proceed without resolution should now consult
 * `formalRefResolverConfigured()` and report "not checked" rather than a clean
 * result — the conflation recorded as qou bean `qou-i2ed`.
 *
 * Pass a shared `cache` when resolving many refs so the tree is scanned once.
 */
export function resolveCanonicalLean(
  ref: string | undefined,
  repoRoot: string,
  cache?: LakeTreeCache,
): string | undefined {
  return resolveCanonicalFormal(ref, repoRoot, cache);
}

/**
 * Enumerate every `*.lean` file under every configured package's Lake tree
 * (absolute paths). Consumed by orphan-coverage scans that audit Lean files
 * reachable by **no** block's `lean.ref`.
 *
 * Returns `[]` both when no packages are configured and when no formalism layer
 * is installed. Those are different facts and this signature cannot tell them
 * apart, so a scan that finds nothing must say which it measured.
 */
export function listPackageLeanFiles(repoRoot: string): string[] {
  return listFormalSourceFiles(repoRoot);
}

// ── Block discovery ─────────────────────────────────────────────

/**
 * Resolve every companion file present for a block stem.
 *
 * Roles the caller has already resolved (`md`, `ts`, and especially `lean`,
 * which may live in the Lake tree rather than beside the manifest) are passed
 * in and taken as-is. The rest are plain `<stem>.<role>` siblings.
 *
 * Returning a map rather than named fields is what lets `qa-sweep` gate
 * applicability by iterating a criterion's `depends_on` instead of carrying a
 * hard-coded `if` per role — which is how `.dmn` and `.fsh` blocks would
 * otherwise have fallen through to `n/a-no-md` and recorded a clean verdict
 * for an axis that never ran.
 */
/**
 * The first companion role a criterion needs and the block does not have, or
 * `undefined` when the criterion applies.
 *
 * Pure and exported so the applicability rule can be tested directly. It used
 * to be two hard-coded `if` statements inside `qa-sweep`'s block loop, keyed
 * on `.md` and `.lean` — the paper adapter's companion set. A criterion over a
 * `.dmn` decision table or a `.fsh` profile therefore had no gate, and every
 * WHO L2/L3 block took the `.md` branch and recorded a clean `n/a` for an axis
 * that never ran.
 *
 * Order matters and follows the criterion's own `depends_on` array, so the
 * reported role (and the sidecar `notes` string built from it) is stable.
 */
export function applicabilityGap(
  depends_on: readonly CompanionRole[],
  companions: Partial<Record<CompanionRole, string>>,
): CompanionRole | undefined {
  return depends_on.find((role) => !companions[role]);
}

/** The sidecar `notes` string recorded when {@link applicabilityGap} fires. */
export function missingCompanionNote(role: CompanionRole): string {
  return `block has no .${role} sibling`;
}

export function resolveCompanions(
  root: string,
  known: Partial<Record<CompanionRole, string>> = {},
): Partial<Record<CompanionRole, string>> {
  const out: Partial<Record<CompanionRole, string>> = {};
  for (const role of COMPANION_ROLES) {
    const preset = known[role];
    if (preset !== undefined) {
      out[role] = preset;
      continue;
    }
    if (role in known) continue; // explicitly resolved to absent
    const p = `${root}.${role}`;
    if (existsSync(p)) out[role] = p;
  }
  return out;
}

export interface BlockPaths {
  /** Block label (e.g. `def:carbon-valence`). Read from the .ts file. */
  label: string;
  /** Block kind (`definition`, `proposition`, `remark`, …). */
  kind: string;
  /**
   * Absolute path **stem** shared by all sibling files — the sibling paths
   * minus their extension, e.g. `/abs/path/to/carbon-valence`. Append an
   * extension to get a sibling: `` `${root}.lean` ``.
   *
   * Not a bare basename, which is what this said before ("Root name … e.g.
   * `carbon-valence`"). A caller who believed that and wrote
   * `join(dirname(b.ts), \`${b.root}.lean\`)` doubles the path and matches
   * nothing — and gets a clean `0` rather than an error, which is exactly how a
   * sibling-coverage measurement reported "0 siblings across 3486 blocks" and
   * looked plausible enough to nearly publish.
   */
  root: string;
  /** Absolute paths to present sibling files. */
  ts: string;
  md?: string;
  lean?: string;
  qa?: string;
  /**
   * Every present companion, keyed by role — the paper adapter's
   * `md`/`ts`/`lean` plus the WHO L2/L3 siblings (`bpmn`, `dmn`, `fsh`,
   * `cql`, `json`, `xlsx`).
   *
   * `md`, `ts` and `lean` are mirrored here as well as in their own fields, so
   * a caller iterating `depends_on` generically does not have to special-case
   * the three that predate the map. `lean` carries the Lake-resolved path when
   * there is no literal sibling, which is why it is copied rather than
   * re-derived from `root`.
   */
  companions: Partial<Record<CompanionRole, string>>;
}

/**
 * `export default <kind>(` for every kind in the schema's `Block` union.
 *
 * Built from `BLOCK_KINDS` rather than written out, because writing it out is
 * what went wrong: this regex listed 13 of the 15 kinds, omitting `algorithm`
 * and `table`. `readBlockManifest` returns `undefined` for an unrecognised
 * builder and `walkBlocks` skips whatever it returns `undefined` for, so on
 * the qou corpus 461 blocks — 445 `table`, 16 `algorithm` — were never
 * yielded to any QA tool. Never swept, never audited, no sidecar; ~13% of the
 * corpus, excluded by a stale list rather than by a decision.
 *
 * Container kinds (`chapter`, `paper`, `folio`) are correctly absent: they are
 * not in the `Block` union, and `readBlockManifest` is documented to reject
 * them.
 */
// Alternates over BUILDER names, not kind strings. For the paper adapter the
// two are the same token; for a CONTRIBUTED adapter they need not be — a `dak`
// kind like `decision-table` is data and a hyphen is not a valid identifier, so
// its builder is `decisionTable` and `kindForBuilder` maps back. Longest-first
// ordering matters in an alternation: a shorter builder must not shadow a
// longer one it prefixes.
//
// The constant is the BUILT-IN builders. A caller holding contributed builders
// (`ContributionRegistry.contributedBuilders()`) passes them, and gets a regex
// over both from {@link builderRegexFor} — the `dak` builders were baked in
// here until bean `1335` moved the adapter to the IG layer.
const BLOCK_BUILDER_RE = new RegExp(
  `export\\s+default\\s+(${ALL_BLOCK_BUILDER_ALT})\\s*\\(`,
);

/** One regex per contributed-builder map, built once. */
const builderRegexCache = new WeakMap<ReadonlyMap<string, string>, RegExp>();

/** The builder-call regex over the built-in builders plus `contributed`. */
function builderRegexFor(contributed: ReadonlyMap<string, string> | undefined): RegExp {
  if (!contributed || contributed.size === 0) return BLOCK_BUILDER_RE;
  let re = builderRegexCache.get(contributed);
  if (!re) {
    re = new RegExp(`export\\s+default\\s+(${blockBuilderAlt(contributed.keys())})\\s*\\(`);
    builderRegexCache.set(contributed, re);
  }
  return re;
}

/**
 * Read `export default <kind>({ ... label: "...", ... })` from a .ts
 * manifest. Returns the block's kind + label, or `undefined` if the
 * file is not a single-block manifest (chapter, paper, etc.).
 *
 * **This detects a candidate; it does not establish identity.** Reading a
 * label out of source text is wrong in three demonstrated ways, pinned in
 * `scripts/tests/block-walk-verify.test.ts`:
 *
 * | source                          | this reads        | the block *is*   |
 * |---------------------------------|-------------------|------------------|
 * | `label: LBL` (a constant)       | `undefined` — skipped | `prop:computed` |
 * | an earlier `label:` in a helper | `not-the-block`   | `prop:real`      |
 * | `proposition({label:"theorem:x"})` | `theorem:x`    | rejected by the schema |
 *
 * The middle row is the dangerous one: not a miss but a *wrong answer*, which
 * keys a sidecar and a graph node to a label the block does not have.
 * `walkBlocks(root, { verify: true })` settles identity by loading the module
 * instead — see `loadBlockModuleSync`.
 *
 * What this stays authoritative for is **whether a file may be executed at
 * all**. A content tree holds more than manifests, and importing runs them, so
 * the masked regex below is the gate that decides what the loader is allowed to
 * touch. Keep it cheap and keep it textual.
 *
 * **Matched against a string- and comment-masked copy**, so a builder call or
 * a `label:` written inside a string literal or a comment cannot make an
 * ordinary source file look like a block manifest. Offsets are preserved by
 * masking, so the values still come from the original text.
 *
 * That is not a hypothetical: `pipeline/witness-substitution-audit.ts`
 * contains a self-test reading
 *
 * ```ts
 * parseWitnessList(`export default proposition({ label: "prop:x" });`)
 * ```
 *
 * and the raw scan yielded that audit script as a content block labelled
 * `prop:x`. Every per-block checker then ran on it and attributed the results
 * to a block that does not exist.
 */
export function readBlockManifest(
  tsPath: string,
  contributedBuilders?: ReadonlyMap<string, string>,
): { kind: string; label: string } | undefined {
  if (!existsSync(tsPath)) return undefined;
  if (tsPath.endsWith(".json")) {
    const b = jsonBlockIdentity(tsPath);
    return b?.label ? { kind: b.kind, label: b.label } : undefined;
  }
  const src = readFileSync(tsPath, "utf-8");
  const masked = maskStringsAndComments(src);
  const kindMatch = masked.match(builderRegexFor(contributedBuilders));
  if (!kindMatch) return undefined;
  const label = parseStringField(src, "label");
  if (!label) return undefined;
  // The regex captures a BUILDER name; the block's kind is what it builds.
  // Identical for paper kinds, different for a multi-word contributed kind.
  const kind = kindForBuilder(kindMatch[1]!, contributedBuilders);
  if (!kind) return undefined;
  return { kind, label };
}

/**
 * Walk a content directory (recursively) and yield every block
 * triple. Skips chapter manifests, paper manifests, and any .ts
 * file that is not a single-block manifest.
 */
/**
 * A block manifest that declares a builder but **no `label:`** — `prose()`
 * connective tissue. Returns its kind plus the file's slug standing in for the
 * label; `undefined` when the file is not a block manifest at all, or when it
 * does have a label (use `readBlockManifest` for those).
 *
 * The slug is what the corpus's existing sidecars for these blocks already key
 * on, so this adopts the convention rather than minting a second one.
 *
 * Masked like `readBlockManifest`, so a builder call inside a string or comment
 * still does not qualify — the fix in `#125` must not be undone by the looser
 * path being added beside it.
 */
export function readUnlabelledBlockManifest(
  tsPath: string,
  contributedBuilders?: ReadonlyMap<string, string>,
): { kind: string; label: string } | undefined {
  if (!existsSync(tsPath)) return undefined;
  if (tsPath.endsWith(".json")) {
    const b = jsonBlockIdentity(tsPath);
    if (!b || b.label) return undefined;
    return { kind: b.kind, label: tsPath.split("/").pop()!.replace(/\.json$/, "") };
  }
  const src = readFileSync(tsPath, "utf-8");
  if (parseStringField(src, "label")) return undefined; // labelled: not ours
  const kindMatch = maskStringsAndComments(src).match(builderRegexFor(contributedBuilders));
  if (!kindMatch) return undefined;
  const slug = tsPath.split("/").pop()!.replace(/\.ts$/, "");
  const kind = kindForBuilder(kindMatch[1]!, contributedBuilders);
  if (!kind) return undefined;
  return { kind, label: slug };
}

/**
 * `{ kind, label }` of a JSON block manifest (bean `y9r6`), or `undefined`
 * when the file is not one or its value is not a block. Reading data executes
 * nothing, so unlike the `.ts` path no textual gate is needed first. A builder
 * that rejects the data throws, as importing the `.ts` would.
 */
function jsonBlockIdentity(path: string): { kind: string; label?: string } | undefined {
  if (!isJsonManifest(path)) return undefined;
  const v = evaluateJsonManifest(path) as { kind?: unknown; label?: unknown } | undefined;
  if (!v || typeof v !== "object" || typeof v.kind !== "string") return undefined;
  return { kind: v.kind, label: typeof v.label === "string" && v.label ? v.label : undefined };
}

export interface WalkBlocksOptions {
  /**
   * Builders a dependency CONTRIBUTED, builder name → kind —
   * `ContributionRegistry.contributedBuilders()`.
   *
   * Absent means the built-in vocabulary only, which is what every caller got
   * before bean `1335` minus the `dak` builders that core used to bake in.
   * Those are the IG layer's now; a caller that has loaded contributions (the
   * sweep does) passes them here, and a contributed manifest is then found,
   * read and verified exactly as a built-in one is.
   */
  contributedBuilders?: ReadonlyMap<string, string>;

  /**
   * Also yield blocks that declare **no `label:`** — `prose()` connective
   * tissue (chapter intros and outros, author's notes, the notation register).
   *
   * Default `false`, which is right for the **dependency graph**: a block with
   * no label cannot be a node, and nothing can reference it.
   *
   * It is wrong for **QA**. `walkBlocks` is not only the graph's enumeration,
   * it is every checker's, and 63 such blocks in the `qou` corpus render into
   * the paper carrying 27,390 words that no criterion could reach. They already
   * hold `.qa.json` sidecars — written by a one-off bulk pass that enumerated
   * differently — which `qa-sweep` could never refresh, so a stale sidecar and
   * a current one were indistinguishable. See `qou/3fui`.
   *
   * Unlabelled blocks are yielded with their **slug** as `label`, which is the
   * identity the existing sidecars already use; this adopts a convention rather
   * than inventing one.
   */
  includeUnlabelled?: boolean;

  /**
   * Settle each block's `kind` and `label` by **importing** it, instead of
   * reading them out of its source text.
   *
   * The textual read is wrong in three ways `readBlockManifest` now documents,
   * and the middle one returns a confidently wrong label rather than nothing.
   * Importing runs the builder, so what comes back is the block the rest of the
   * pipeline sees, validated against the schema.
   *
   * `readBlockManifest` still decides *which* files are candidates — importing
   * executes a module, and a content tree holds scripts as well as manifests
   * (`qa-agent-drain-queue.ts` starts a sweep at import time). Verification
   * upgrades identity; it does not widen what gets executed.
   *
   * **Default `true`, on measured evidence.** This repo has twice learned that
   * changing what the walk enumerates must be measured against real content
   * before it lands — `#125` admitted a non-block, `qou/3fui` missed 63 real
   * ones and the measurement reversed the recommendation the change had been
   * argued on. So `verify-block-walk.ts` was written first and run against the
   * `qou` corpus, all 3557 blocks:
   *
   *     textual walk : 3557 blocks in  493 ms
   *     verified walk: 3557 blocks in 1473 ms
   *     identity differences 0 · found by only one mode 0 · failed to import 0
   *
   * A second of wall-clock, and nothing else about that corpus moves. What it
   * buys is the three failure classes above becoming impossible rather than
   * merely absent-so-far. Measured on **one** corpus; `verify: false` is the
   * escape hatch, and re-run that command on any other folio before relying on
   * the default there.
   *
   * The one new coupling: importing a block resolves its imports, and a folio's
   * blocks import the platform through a symlink its setup script creates
   * (`<folio>/folio-assistant`). Without it every block fails to load — the
   * walk still yields all of them under their textual identity, and says so.
   */
  verify?: boolean;

  /**
   * Where a block that fails to import is reported.
   *
   * A block that throws is a *finding*, not a file to pass over — that is how a
   * sweep reports clean by looking at nothing. Omit this and failures go to
   * stderr, once per file. Either way the block is still yielded, carrying its
   * degraded textual identity: dropping it would trade a loud problem for a
   * silent coverage hole, which is the `qou/3fui` mistake in reverse.
   */
  onLoadFailure?: (failure: BlockLoadFailure) => void;

  /**
   * Walk directories the layer declares as **not content** — `context` and
   * `state` graphs.
   *
   * Default `false`. Owner, 2026-09-20: *"qa-sweep skips fsh-guts"*, and the
   * general form in the same breath — *"qasweep is only on active/working
   * content, unless explicit otherwise"*. This flag is that "unless".
   *
   * ## It is the EXISTING axis, not a new one
   *
   * `fsh-guts` declares `holds: "context"` — *"Read, never written by a
   * process"* — because what is in it is deprecated or superseded. `graphLayer`
   * already answers the question, so nothing here spells a directory name and a
   * newly retired graph is skipped the day it is declared, with no edit.
   *
   * Measured on this layer 2026-09-20 — what the default excludes, and what
   * it does NOT:
   *
   *     skipped (context/state)  fsh-guts/  memory/  interaction/  uploads/
   *                              beans/  todos/  issue-marks/  test/results/
   *                              test/health/results/  methodologies/
   *     walked  (content)        folio/  library/  voices/  skills/  tools/
   *                              schemas/  translations/  src/skills/ …
   *
   * `folio/` is the one that matters and it is kept: the active corpus is
   * exactly what a sweep is for.
   *
   * ## Why a guard rather than a fix
   *
   * Nothing is wrong today. `walkBlocks` over `fsh-guts/` yields **0** blocks,
   * because the only `.ts` in there is a script rather than a manifest. The
   * rule exists for the day somebody retires a real block into it — which is
   * what the directory is FOR — at which point a sweep would start reporting
   * findings about material nobody maintains, and a reader could not tell
   * those from live ones.
   */
  includeNonContent?: boolean;
}

/**
 * The layer root whose declaration governs `dir` — the nearest ancestor
 * carrying a `harness.json` or a `.git`.
 *
 * Deliberately NOT `findContentRepoRoot()`, which takes no argument and walks
 * up from `process.cwd()`. That answers "where was I invoked", which is the
 * same thing only when the walk target happens to sit under the caller's cwd.
 * Falls back to `dir` itself, so an unrooted walk simply finds no declaration
 * and skips nothing.
 */
function declaringRootFor(dir: string): string {
  let d = resolve(dir);
  for (;;) {
    if (findDeclarationFile(d) !== undefined || existsSync(join(d, ".git"))) return d;
    const parent = dirname(d);
    if (parent === d) return resolve(dir);
    d = parent;
  }
}

export function* walkBlocks(
  rootDir: string,
  opts: WalkBlocksOptions = {},
): Generator<BlockPaths> {
  // When a block's sibling `<root>.lean` is missing but its `lean.ref`
  // URI points at a file in the package's Lake tree (the cluster-
  // migration pattern, e.g. lean/QOU/BraidKnot/MarkovAxiomsPrimitive.lean),
  // fall back to the canonical resolver so qa-checkers that consume the
  // .lean source (wall-side, voice, q-usage, …) don't silently skip.
  // `resolveCanonicalLean` is the single source of truth for that walk;
  // a shared cache scans each Lake tree once across the whole block walk.
  // The Lake tree lives in the CONTENT repo (e.g. qou/content/**/lean), not
  // the folio-assistant tree this pipeline lives in — resolve against the
  // content-repo root (findContentRepoRoot), else `resolve(import.meta.dir,
  // "../..")` lands in folio-assistant and library-only blocks (no sibling
  // .lean) resolve to `undefined`, silently skipping every checker that reads
  // the .lean (wall-side, compute-prop-has-probe/-consumer, voice, q-usage).
  const REPO_ROOT = findContentRepoRoot();
  const lakeCache: LakeTreeCache = new Map();
  const verify = opts.verify ?? true;
  const report = makeFailureReporter(opts);
  // The kinds the loader may accept beyond the built-in ones: whatever the
  // contributed builders build. Computed once per walk.
  const contributedKinds = opts.contributedBuilders
    ? new Set(opts.contributedBuilders.values())
    : undefined;

  // Directories this layer declares as NOT content — `context` or `state`.
  // See {@link WalkBlocksOptions.includeNonContent} for the ruling and the
  // measurement. Computed once per walk and compared by absolute path, so a
  // declared directory OUTSIDE `rootDir` simply never matches and costs
  // nothing. Resolved from the declaration rather than from a name list: a
  // graph retired tomorrow is skipped the day it is declared.
  //
  // A declaration that cannot be read yields an EMPTY skip set, not a throw.
  // This is a walker, and refusing to enumerate a corpus because a declaration
  // is malformed would turn a config fault into a total QA outage. The loud
  // path for that is `kgDirectories`, which throws for exactly this reason.
  //
  // Resolved from the root being WALKED, not from `REPO_ROOT`. `REPO_ROOT`
  // comes from `findContentRepoRoot()`, which takes no argument and walks up
  // from `process.cwd()` — so it answers "where is the repo I was invoked in",
  // not "which instance owns this corpus". Using it read THIS checkout's
  // declaration while walking a temporary fixture, and the skip silently never
  // matched. Caught by the fixture test, which is the only reason it is not
  // still there.
  const nonContentDirs = new Set<string>();
  if (!opts.includeNonContent) {
    try {
      for (const e of readDeclaration(declaringRootFor(rootDir))?.directories ?? []) {
        const layers = (e.graphTypologies ?? []).map((g) => graphLayer(g));
        // Skip only when the entry DECLARES graphs and none of them is
        // content. An entry declaring none says nothing about being retired,
        // so it stays walked — silence is not evidence.
        //
        // There is deliberately no `l !== undefined` arm. The first draft had
        // one, on the reading that an unregistered kind should not count as
        // non-content. It is unreachable: `readDeclaration` THROWS on an
        // unknown kind ("declares unknown graph typology …"), and a registered one
        // always has `holds`, which the schema requires. So the only way to
        // reach this loop is with every kind registered and layered. Measured
        // rather than reasoned — see the test that pins the throw.
        if (layers.length > 0 && layers.every((l) => l !== "content")) {
          nonContentDirs.add(resolve(declaringRootFor(rootDir), e.path));
        }
      }
    } catch {
      // Empty set: walk everything, as before.
    }
  }

  function* recurse(d: string): Generator<BlockPaths> {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      if (entry.startsWith(".") || entry === "node_modules" || entry === "lean")
        continue;
      const full = join(d, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (nonContentDirs.has(resolve(full))) continue;
        yield* recurse(full);
      } else if (entry.endsWith(".ts") || (entry.endsWith(".json") && isJsonManifest(full))) {
        // Skip chapter / paper manifests by checking the export shape. The
        // masked builder-call match is the gate on what may be *executed*
        // below; the label is a question about identity, answered after.
        const textual = readBlockManifest(full, opts.contributedBuilders);
        // Reading the unlabelled shape costs a second read + mask, so only pay
        // it when someone can act on the answer.
        const unlabelled =
          textual || !(verify || opts.includeUnlabelled)
            ? undefined
            : readUnlabelledBlockManifest(full, opts.contributedBuilders);
        if (!textual && !unlabelled) continue; // not a block manifest at all
        const manifest = verify
          ? verifiedManifest(full, textual, unlabelled, report, contributedKinds)
          : textualIdentity(textual, unlabelled);
        if (!manifest) continue;
        if (!manifest.labelled && !opts.includeUnlabelled) continue;
        const root = full.replace(/\.(ts|json)$/, ""); // strip the manifest extension
        const md = root + ".md";
        const lean = root + ".lean";
        let leanResolved: string | undefined = existsSync(lean) ? lean : undefined;
        if (!leanResolved) {
          // Parse the .ts source for a lean.ref URI and try Lake-tree
          // resolution.  Manifest is already loaded; extract the URI
          // via a regex over the raw file (mirrors q-usage-audit).
          const tsSrc = readFileSync(full, "utf-8");
          const refMatch = tsSrc.match(/["']?ref["']?:\s*["']([^"']+)["']/);
          leanResolved = resolveCanonicalLean(refMatch?.[1], REPO_ROOT, lakeCache);
        }
        const mdResolved = existsSync(md) ? md : undefined;
        yield {
          label: manifest.label,
          kind: manifest.kind,
          root,
          ts: full,
          md: mdResolved,
          lean: leanResolved,
          // Prefer the results-tree verdict, falling back to the legacy
          // sibling (a downstream folio that has not migrated its verdicts
          // yet) — see qa-paths.ts. `undefined` here means genuinely
          // unaudited, never "looked in the wrong place": every consumer of
          // `BlockPaths.qa` (e.g. qa-agent-drain-queue, semantic-cone) already
          // treats an absent path as "no report", so this preserves that
          // absent/present distinction exactly while widening where "present"
          // is looked for.
          qa: existingBlockQaPath(REPO_ROOT, root),
          companions: resolveCompanions(root, {
            ts: full,
            md: mdResolved,
            lean: leanResolved,
          }),
        };
      }
    }
  }
  yield* recurse(rootDir);
}

type TextualManifest = { kind: string; label: string };
/**
 * `labelled` records whether the block has a real `label:` — which only the
 * module can settle — as opposed to standing in under its slug. `walkBlocks`
 * needs the distinction *after* verification, because a computed label makes a
 * block labelled even though its source text does not say so.
 */
type VerifiedManifest = TextualManifest & { labelled: boolean };

/** The reading `walkBlocks` has always used: whatever the source text says. */
function textualIdentity(
  textual: TextualManifest | undefined,
  unlabelled: TextualManifest | undefined,
): VerifiedManifest | undefined {
  if (textual) return { ...textual, labelled: true };
  if (unlabelled) return { ...unlabelled, labelled: false };
  return undefined;
}

/**
 * Replace a textually-read `{ kind, label }` with the one the module actually
 * exports.
 *
 * On a throw the textual reading is kept and the failure reported: the block
 * stays in the walk (so no criterion silently stops covering it) while the
 * reason it could not be verified is visible. A `undefined` return from the
 * loader means the default export is not a block after all — the candidate gate
 * was fooled — which is likewise reported rather than silently dropped.
 */
function verifiedManifest(
  tsPath: string,
  textual: TextualManifest | undefined,
  unlabelled: TextualManifest | undefined,
  report: FailureReporter,
  contributedKinds?: ReadonlySet<string>,
): VerifiedManifest | undefined {
  const degraded = () => textualIdentity(textual, unlabelled);
  try {
    const loaded = loadBlockModuleSync(tsPath, contributedKinds);
    // A label the module actually carries. This is the only reading that can
    // be trusted, and it is how a computed `label:` — invisible to the regex —
    // becomes a labelled block rather than being skipped or mistaken for prose.
    if (loaded) return { kind: loaded.kind, label: loaded.label, labelled: true };
  } catch (e) {
    report(tsPath, String(e).replace(/\s+/g, " ").slice(0, 300));
    return degraded();
  }
  // The loader found no labelled block. When the source had no textual label
  // either, that agrees with `prose()` connective tissue and its slug identity
  // stands. When the source *did* carry a label, the candidate gate was fooled
  // by a file whose default export is not a block — a finding.
  if (unlabelled) return { ...unlabelled, labelled: false };
  report(
    tsPath,
    `default export is not a labelled block, but the source looks like a ` +
      `manifest (read textually as ${textual?.kind} ${textual?.label})`,
  );
  return degraded();
}

/**
 * How many unloadable files are named before the rest are only counted.
 *
 * When a folio is checked out without its `folio-assistant` symlink, *every*
 * block fails for the same reason — measured: 3557 of 3557 on `qou`. Naming
 * them one by one buries the single line that says what to fix under three and
 * a half thousand that do not, so the enumeration stops and the tail is
 * summarised.
 */
const MAX_NAMED_LOAD_FAILURES = 5;

type FailureReporter = (file: string, error: string) => void;

/**
 * One reporter per walk, **not** one per process.
 *
 * A process runs several walks — `qa-sweep` calls `usesGraphHash` before its
 * own — and a budget shared across them means the second walk's genuine
 * failures are swallowed by the first walk's having spent it. Scoping the
 * counter to the walk keeps each one's report complete on its own terms.
 */
function makeFailureReporter(opts: WalkBlocksOptions): FailureReporter {
  const sink = opts.onLoadFailure;
  if (sink) return (file, error) => sink({ file, error });
  const seen = new Set<string>();
  return (file, error) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (seen.size <= MAX_NAMED_LOAD_FAILURES) {
      console.warn(
        `  ⚠ ${file} could not be loaded; using its source text for kind/label.\n` +
          `      ${error}`,
      );
    } else if (seen.size === MAX_NAMED_LOAD_FAILURES + 1) {
      console.warn(
        `  ⚠ …and more blocks that would not load. Every one is walked under its\n` +
          `      source-text identity, so nothing is skipped — but none of them was\n` +
          `      verified. If this is the whole corpus, the cause is usually a folio\n` +
          `      checked out without its platform symlink (<folio>/folio-assistant).\n` +
          `      Run: bun run cat-harness-tools/pipeline/verify-block-walk.ts <content-root>`,
      );
    }
  };
}

// ── QA report IO ────────────────────────────────────────────────

/** Paths already warned about, so a sweep reports each file once. */
const warnedSidecars = new Set<string>();

export function loadQaReport(path: string): BlockQaReport | undefined {
  if (!existsSync(path)) return undefined;
  return parseQaReport(readFileSync(path, "utf-8"), path);
}

/**
 * {@link loadQaReport} over text already in hand — a sidecar read from the
 * qa-reports branch rather than off disk (bean `8wj1`). `label` names it in a
 * warning; the shape rules are the same, so a branch read and a disk read of
 * the same bytes give the same report.
 */
export function parseQaReport(text: string, label: string): BlockQaReport | undefined {
  const path = label;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    // A corrupt sidecar used to return `undefined` — the same answer as a file
    // that does not exist. Callers treat that as "no QA has ever been done"
    // and `qa-sweep` bootstraps a fresh report over the top of it, so a stray
    // edit could destroy a block's recorded history without a word. Say so.
    if (!warnedSidecars.has(path)) {
      warnedSidecars.add(path);
      console.error(
        `qa: sidecar is not valid JSON, ignoring: ${path}\n` +
          `    ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return undefined;
  }
  try {
    const rec = raw as Record<string, unknown>;
    if (rec?.$schema !== "block-qa/v1") {
      // The marker was introduced after some sidecars were written. Rejecting
      // an unmarked file outright discarded real recorded state: 32 sidecars
      // in the qou corpus carry 315 criterion entries between them and were
      // invisible to every reader. Worse, once their blocks became reachable
      // again, the next sweep would have bootstrapped empty reports over them.
      //
      // Accept on SHAPE instead — a `criteria` object is what block-qa/v1 is —
      // and say the marker is missing so it gets added. Anything else (a
      // paper-level `section-title-audit.qa.json` is `{criterion, paper,
      // chapters}`) is genuinely not this schema and is still rejected.
      if (!rec || typeof rec.criteria !== "object" || rec.criteria === null) {
        return undefined;
      }
      if (!warnedSidecars.has(path)) {
        warnedSidecars.add(path);
        console.error(`qa: sidecar missing '$schema: "block-qa/v1"', reading anyway: ${path}`);
      }
      rec.$schema = "block-qa/v1";
    }
    // Normalize malformed criterion values at the IO boundary: some
    // agent-written sidecars carry a bare entry OBJECT where block-qa/v1
    // requires a single-entry ARRAY (observed corpus-wide in qou on
    // 2026-07-12: 83 sidecars × 13 `da-*` criteria). Downstream code
    // (entryIsFresh iteration, preserveNonScriptEntries) assumes arrays
    // and crashed with `existing.filter is not a function`. Wrapping here
    // preserves the entry verbatim; any other non-array shape (string,
    // number, null) is dropped as unrecoverable.
    const criteria = rec.criteria as Record<string, unknown> | undefined;
    if (criteria && typeof criteria === "object") {
      for (const [id, value] of Object.entries(criteria)) {
        if (Array.isArray(value)) continue;
        if (value && typeof value === "object") criteria[id] = [value];
        else delete criteria[id];
      }
    }
    return rec as unknown as BlockQaReport;
  } catch {
    return undefined;
  }
}

/** A block writer's prior: the report (absent is a miss), or a refusal. */
export type PriorBlockReport =
  | { ok: true; report?: BlockQaReport; from: string }
  | { ok: false; state: string; path: string; reason: string };

/**
 * The sidecar a block writer is about to rewrite, as it stands now.
 *
 * Without `priorFrom`, the working copy, as every writer has always read it:
 * the results-tree copy, else the legacy sibling (`existingBlockQaPath`).
 *
 * With `priorFrom` (bean `8wj1`, owner ruling B, 2026-10-22), it is read from
 * qa-reports at that ref, at the block's canonical results-tree path, so the
 * rewrite carries the entries other writers left even when `test/results/` is
 * absent. A miss is no prior. A read that cannot be made, or a sidecar that is
 * not a block-qa report, REFUSES: the caller writes nothing for the block and
 * the run exits 2. It never falls back to the working copy.
 */
export function loadPriorBlockReport(
  repoRoot: string,
  blockRoot: string,
  priorFrom?: string,
  store?: QaStoreOptions,
): PriorBlockReport {
  if (priorFrom === undefined) {
    const p = existingBlockQaPath(repoRoot, blockRoot);
    return { ok: true, report: p ? loadQaReport(p) : undefined, from: "working copy" };
  }
  const out = blockQaPath(repoRoot, blockRoot);
  const b = readBaseline(out, { against: priorFrom, ...(store ? { store } : {}) });
  if (b.state === "miss") return { ok: true, from: b.from };
  if (b.state !== "hit") return { ok: false, state: b.state, path: out, reason: `prior on ${b.from}: ${b.reason}` };
  const report = parseQaReport(b.text, `${b.from}:${out}`);
  if (!report) return { ok: false, state: "corrupt", path: out, reason: `prior on ${b.from} is not a block-qa/v1 report` };
  return { ok: true, report, from: b.from };
}

/** One line for a prior that could not be read; the writer wrote nothing for this block. */
export function priorRefusalLine(writer: string, subject: string, r: { state: string; path: string; reason: string }): string {
  return `${writer}: UNKNOWN ${subject} — ${r.state}: ${r.reason}. Nothing was written for it.`;
}

export function saveQaReport(path: string, report: BlockQaReport): void {
  // The directory may not exist, and that is new since bean `2634`.
  //
  // A verdict used to be the block's own sibling, so its directory was the
  // block's directory and existed by construction — no writer ever had to
  // think about it. The results tree mirrors that directory instead, and a
  // chapter that has never had a verdict written under the new convention has
  // no mirrored directory yet. Without this, the FIRST write for every such
  // block throws ENOENT.
  //
  // Centralised here rather than at each call site: four writers reach the
  // verdict through this function, and a rule that has to be remembered
  // separately by each of them is one that will be forgotten by the fifth.
  // A mounted layer's verdict goes to its layer output root, never into the
  // mount (bean `cat-tools-sm8r`, item 4); `existingBlockQaPath` reads it there.
  const to = writePathOf(path);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, JSON.stringify(report, null, 2) + "\n");
}

// ── Staleness check ─────────────────────────────────────────────

/**
 * The files whose hashes invalidate a cached verdict for `def`:
 * `depends_on` (which also gates applicability) UNION
 * `also_invalidated_by` (which does not).
 *
 * Always use this — not `depends_on` alone — when computing freshness.
 * A criterion that reads a file it cannot list in `depends_on` (because
 * doing so would `n/a` the blocks it exists to check) is otherwise
 * unable to clear its own stale verdict when that file is the only
 * thing that changed.
 */
export function freshnessKeys(def: {
  depends_on: CompanionRole[];
  also_invalidated_by?: Array<CompanionRole | "graph">;
}): Array<CompanionRole | "graph"> {
  return [...new Set([...def.depends_on, ...(def.also_invalidated_by ?? [])])];
}

/**
 * A criterion entry is "fresh" iff every file the criterion depends
 * on has the same current hash as the entry's field_hash. Otherwise
 * the entry is stale (the source files have changed since the audit).
 *
 * An `n/a` entry is fresh iff the not-applicable condition still
 * holds: the file the entry was missing is still missing AND the
 * files the entry DID see have not changed.
 */
export function entryIsFresh(
  entry: QaCriterionEntry,
  current: QaFieldHash,
  depends_on: Array<CompanionRole | "graph">,
  current_script_hashes?: CriterionScriptHashes,
  lean_granularity?: "file" | "statement",
): boolean {
  // Uniform rule for every result kind: a file the criterion
  // depends on is "stable" iff (a) it was absent at audit AND is
  // absent now (the criterion's lean-side / md-side did not apply
  // then and still does not), OR (b) the hashes match.
  for (const k of depends_on) {
    // Legacy / older-schema entries (e.g. agent-authored `n/a` verdicts
    // written before the per-entry field_hash convention) may lack
    // `field_hash` entirely. Optional-chain so a missing hash is treated
    // as "not verifiable ⇒ stale": any currently-present depended-on file
    // then trips the `!expected && actual` branch below (re-review), and
    // the sweep no longer crashes with `undefined is not an object`.
    // Statement-granularity criteria compare the SIGNATURE hash, so a
    // proof-body rewrite leaves them fresh. Falls back to the
    // whole-file hash whenever either side lacks a statement hash —
    // an unlexable file, or an entry written before this field existed.
    // That fallback over-invalidates, which is the safe direction: the
    // alternative is presenting a stale verdict as current.
    const useStatement =
      k === "lean" &&
      lean_granularity === "statement" &&
      entry.field_hash?.lean_statement !== undefined &&
      current.lean_statement !== undefined;
    const key: keyof QaFieldHash = useStatement ? "lean_statement" : k;
    const expected = entry.field_hash?.[key];
    const actual = current[key];
    if (!expected && !actual) continue; // both absent — still inapplicable
    if (!expected && actual) return false; // file appeared since audit
    if (expected && !actual) return false; // file removed since audit
    if (expected !== actual) return false; // file changed since audit
  }
  // Script-side staleness — only applies to `kind: "script"` entries
  // that were written by a sweep aware of the script-hash convention.
  // Legacy entries lacking these fields are treated as fresh: missing
  // metadata is not an invalidation signal.
  if (entry.reviewer.kind === "script" && current_script_hashes) {
    if (
      entry.reviewer.script_hash &&
      current_script_hashes.script_hash &&
      entry.reviewer.script_hash !== current_script_hashes.script_hash
    ) {
      return false; // checker source file changed
    }
    const recordedDepsHash = entry.reviewer.deps_hash;
    const currentDepsHash = current_script_hashes.deps_hash;
    if (
      recordedDepsHash &&
      currentDepsHash &&
      recordedDepsHash !== currentDepsHash
    ) {
      return false; // one of the extra inputs changed
    }
    // Asymmetry case: entry never recorded deps_hash but the
    // current criterion now declares extra_inputs. Treat as stale —
    // the new dep declaration must propagate.
    if (!recordedDepsHash && currentDepsHash) return false;

    // Definition-side staleness, same three-case shape as `deps_hash` above.
    // The asymmetry matters and is the deliberate direction: an entry written
    // before this field existed has no `def_hash`, so the FIRST sweep after
    // this lands re-runs every script criterion once and stamps it. That is a
    // one-time churn, it replaces only `kind: "script"` entries (see
    // `preserveNonScriptEntries` — agent and human entries are kept), and the
    // alternative is presenting a verdict the criterion would no longer give.
    const recordedDefHash = entry.reviewer.def_hash;
    const currentDefHash = current_script_hashes.def_hash;
    if (recordedDefHash && currentDefHash && recordedDefHash !== currentDefHash) {
      return false; // the criterion's scope or grading changed
    }
    if (!recordedDefHash && currentDefHash) return false;
  }
  return true;
}

/**
 * Entries a script sweep must NOT drop when it re-runs a criterion.
 *
 * A script re-run is a REFRESH, not a new opinion: it must REPLACE the
 * prior `kind: "script"` entry rather than append a duplicate. So when
 * a sweep writes a fresh script entry it keeps only the non-script
 * entries — `kind: "agent"` (the multi-reviewer audit trail across
 * agent passes is meaningful and co-exists) and `kind: "human"` (final
 * authority; never dropped) — and appends the one fresh script entry.
 *
 * Filtering the stale script entry here is what keeps `<block>.qa.json`
 * criterion arrays from growing unboundedly on every sweep. This mirrors
 * the invalidation contract in the `integration-audit` skill ("Pure
 * script: delete every `kind:"script"` reviewer entry; sweep re-runs" /
 * "Human: always preserved").
 */
/**
 * Place a new agent / human adjudication so that it LEADS its criterion.
 *
 * Order is the verdict. `projectEntryArrays` in `qa-witness.ts` reads
 * `list[0]` as a criterion's effective result, and `qa-sweep` writes
 * `[...preserveNonScriptEntries(existing), scriptEntry]`, so the invariant
 * across the pipeline is: non-script entries lead, the script entry trails
 * (`scripts/tests/qa-sweep-merge.test.ts` §5.4 states it as
 * `[script_stale, agent] -> [agent, script_fresh]`).
 *
 * `qa-merge-findings` appended instead, which broke the invariant in exactly
 * the case it matters: an adjudication merged onto a block whose script
 * verdict is FRESH. The sweep then short-circuits and never reorders, so the
 * script `fail` keeps leading and the reviewer's `pass` is recorded but not in
 * force. Measured 2026-09-19 on eleven voice adjudications over
 * `docs/source`: all eleven merged, all eleven still read `fail`.
 *
 * The script entry is KEPT, below — nothing is silently rewritten, and the
 * disagreement between the checker and the reviewer stays legible.
 */
export function insertAdjudication(
  existing: QaCriterionEntry[],
  entry: QaCriterionEntry,
): QaCriterionEntry[] {
  // A reviewer's LATER opinion supersedes their own earlier one, so it goes
  // ahead of it; a DIFFERENT reviewer's opinion is additional history and keeps
  // its place. Without the first half, re-adjudicating a criterion leaves the
  // superseded entry leading — and since `list[0]` is the effective verdict, the
  // sidecar then serves reasoning its own author has withdrawn.
  //
  // Measured 2026-09-19 on `every-workflow-in-the-repo`: the diagram count line
  // was edited, the script re-fired, and the re-adjudication landed BEHIND the
  // original — whose notes quoted a sentence that no longer existed. Both said
  // `pass`, so nothing broke; that is exactly what makes it worth pinning,
  // because the next such pair will disagree.
  const sameReviewer = (e: QaCriterionEntry | undefined) =>
    e?.reviewer?.kind === entry.reviewer.kind &&
    e?.reviewer?.id === entry.reviewer.id;
  const firstOwn = existing.findIndex(sameReviewer);
  if (firstOwn !== -1) {
    // Replace in place: an audit trail of one reviewer contradicting themselves
    // is noise, and `preserveNonScriptEntries` exists to stop arrays growing
    // without bound. The superseded text is in git.
    return existing.map((e, i) => (i === firstOwn ? entry : e)).filter((e, i) =>
      i === firstOwn ? true : !sameReviewer(e),
    );
  }
  const firstScript = existing.findIndex((e) => e?.reviewer?.kind === "script");
  return firstScript === -1
    ? [...existing, entry]
    : [
        ...existing.slice(0, firstScript),
        entry,
        ...existing.slice(firstScript),
      ];
}

export function preserveNonScriptEntries(
  existing: QaCriterionEntry[],
): QaCriterionEntry[] {
  // Optional chaining guards against malformed / legacy / hand-edited
  // sidecar entries (a null entry, or one missing its `reviewer`): the
  // `.qa.json` files are external JSON that `loadQaReport` does not
  // shape-validate. Such an entry is NOT a recognizable script entry, so
  // it is PRESERVED rather than dropped — dropping a malformed `human`
  // entry would violate the "human always preserved" invariant above.
  return existing.filter((e) => e?.reviewer?.kind !== "script");
}

/**
 * Does a freshly-computed script entry say the same thing as the one already
 * recorded?
 *
 * Compares everything that carries meaning — verdict, the input hashes it was
 * computed from, the reviewer identity and its script/deps hashes, and the
 * checker's own output (notes, evidence, metrics, severity) — while ignoring
 * `reviewed_at`, `reviewed_tree` and the legacy `reviewed_sha`, which say only
 * WHEN (at which tree, or commit) the sweep last ran.
 *
 * Callers use this to keep the existing entry verbatim when a re-run reproduces
 * it, so re-running a checker is not by itself a change to the sidecar. That
 * matters because some criteria are deliberately re-evaluated on every sweep
 * (an `n/a` whose `depends_on` is now satisfied must be re-checked in case it
 * became applicable); without this, each such re-check restamped the entry and
 * dirtied the file forever.
 *
 * `reviewed_tree` (like `reviewed_sha` before it) is deliberately NOT
 * refreshed on an unchanged verdict: the matching `field_hash` already proves
 * the inputs are identical, so the older tree remains a truthful record of
 * when the verdict was established (bean 69lr; owner card Q4, 2026-11-05).
 *
 * `script_commit_sha` is excluded for the same reason. It is a FILE-level
 * pointer — the last commit to touch the checker module — so it moves when a
 * neighbouring criterion is edited, and comparing it would reintroduce exactly
 * the file-level coupling that per-criterion `script_hash` exists to remove.
 * `script_hash` is the field that actually answers "did this criterion's code
 * change", and it IS compared.
 */
export function sameScriptVerdict(
  a: QaCriterionEntry | undefined,
  b: QaCriterionEntry,
): boolean {
  if (!a) return false;
  const shape = (e: QaCriterionEntry) => ({
    result: e.result,
    field_hash: e.field_hash,
    notes: e.notes,
    evidence: e.evidence,
    metrics: e.metrics,
    severity: e.severity,
    reviewer: {
      kind: e.reviewer?.kind,
      id: e.reviewer?.id,
      version: e.reviewer?.version,
      script_hash: e.reviewer?.script_hash,
      deps_hash: e.reviewer?.deps_hash,
    },
  });
  return JSON.stringify(shape(a)) === JSON.stringify(shape(b));
}

/**
 * The date a verdict is shown and ordered by.
 *
 * Owner rulings 2026-11-06 (card "QA dates", option 1; card "Date source",
 * option 1, derive on read): a verdict's date is DERIVED from its `reviewed_tree` — the commit date of the commit carrying
 * that tree, which `tree-commits` (`scripts/qa-site-assets.ts`) records in
 * its index's `dates` — so a writer stamps no clock, and the same verdict
 * over the same tree is the same bytes on a PR and on main. A legacy entry's
 * own `reviewed_at` is the fallback; with neither, there is no date, which a
 * reader shows as unknown, never as now.
 */
export function entryDate(
  e: Pick<QaCriterionEntry, "reviewed_at" | "reviewed_tree">,
  treeDates?: Readonly<Record<string, string>>,
): string | undefined {
  return (e.reviewed_tree ? treeDates?.[e.reviewed_tree] : undefined) ?? e.reviewed_at;
}

/**
 * Newest first by {@link entryDate}. On equal dates, or none, the EARLIER
 * position comes first: order is the verdict (`list[0]` is a criterion's
 * effective result, `projectEntryArrays` in `qa-witness.ts`), and
 * `insertAdjudication` puts a new adjudication at the front. Verdicts on one
 * tree all share its date, so the tie is the common case once writers stamp no
 * clock, and it must agree with that invariant.
 */
export function newestFirst<T extends Pick<QaCriterionEntry, "reviewed_at" | "reviewed_tree">>(
  entries: readonly T[],
  treeDates?: Readonly<Record<string, string>>,
): T[] {
  return entries
    .map((e, i) => ({ e, i, d: entryDate(e, treeDates) ?? "" }))
    .sort((a, b) => b.d.localeCompare(a.d) || a.i - b.i)
    .map((x) => x.e);
}

/**
 * Per-criterion freshness summary for one block.
 *
 * - `fresh-entries`: reviewer entries whose field_hash matches.
 * - `stale-entries`: reviewer entries whose field_hash does not match.
 * - `most_recent`: the newest entry (by {@link entryDate}), regardless of
 *   freshness; used by the watcher to surface "last result was X but
 *   it's stale" diagnostics.
 */
export interface CriterionFreshness {
  criterion: string;
  fresh_entries: QaCriterionEntry[];
  stale_entries: QaCriterionEntry[];
  most_recent?: QaCriterionEntry;
  is_fresh: boolean;
}

export function summariseFreshness(
  report: BlockQaReport,
  current: QaFieldHash,
  scriptHashesByCriterion?: Record<string, CriterionScriptHashes>,
  /**
   * The criterion index to resolve definitions against.
   *
   * Defaults to the static registry, which is right for every criterion
   * written out in it — but NOT for the voice-overlay criteria, which since
   * bean `btuv` are derived from the voices a layer ships. A caller that
   * has a layer root passes `qaCriteriaByIdFor(root)`.
   *
   * The fallback below happens to give a voice criterion the right answer
   * today, because its `depends_on` is `["md"]` and so is the fallback. That
   * is a COINCIDENCE, not a design: the fallback exists for a criterion that
   * is unknown or fenced out, and reading it as coverage for a criterion that
   * is merely registered somewhere else would make the first `depends_on`
   * change on a voice silently produce stale-looking-fresh entries.
   */
  criteriaById: Record<string, QaCriterionDefinition> = QA_CRITERIA_BY_ID,
): CriterionFreshness[] {
  const out: CriterionFreshness[] = [];
  for (const [criterion, entries] of Object.entries(report.criteria)) {
    const def = criteriaById[criterion];
    const dependsOn = def ? freshnessKeys(def) : (["md"] as CompanionRole[]);
    const sh = scriptHashesByCriterion?.[criterion];
    const fresh: QaCriterionEntry[] = [];
    const stale: QaCriterionEntry[] = [];
    for (const e of entries) {
      if (entryIsFresh(e, current, dependsOn, sh, def?.lean_granularity)) fresh.push(e);
      else stale.push(e);
    }
    const sorted = newestFirst(entries);
    out.push({
      criterion,
      fresh_entries: fresh,
      stale_entries: stale,
      most_recent: sorted[0],
      is_fresh: fresh.length > 0,
    });
  }
  return out;
}

// ── Script sidecar IO ──────────────────────────────────────────

/**
 * Repo-relative directory where per-criterion script sidecars live.
 * One file per automated criterion: `<criterion-id>.script.json`.
 */
// declared-path-literal: bean 70lx — the sidecars stay in the harness, under its qa graph, while this code moved
export const SCRIPT_SIDECAR_DIR = "test/results/script-sidecars";

/**
 * Resolve a criterion's script-sidecar path. `repoRoot` should be
 * the absolute path to the repo root; the sidecar lives under
 * `<repoRoot>/test/results/script-sidecars/<id>.script.json` ({@link SCRIPT_SIDECAR_DIR}).
 *
 * The id is {@link portableSegment}-encoded, because a criterion id is an
 * identifier rather than a filename and nothing constrains it to be one. Every
 * caller resolves through here — write and read alike — so the encoding cannot
 * put the writer and the reader in different places.
 */
export function scriptSidecarPath(
  criterionId: string,
  repoRoot: string = process.cwd(),
): string {
  return join(repoRoot, SCRIPT_SIDECAR_DIR, `${portableSegment(criterionId)}.script.json`);
}

/** Load a script sidecar by criterion id; returns undefined if absent. */
export function loadQaScriptSidecar(
  criterionId: string,
  repoRoot: string = process.cwd(),
): QaScriptSidecar | undefined {
  const p = overlayPath(scriptSidecarPath(criterionId, repoRoot));
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as QaScriptSidecar;
  } catch {
    return undefined;
  }
}

/** Write a script sidecar; deterministic JSON formatting. */
export function saveQaScriptSidecar(
  sidecar: QaScriptSidecar,
  repoRoot: string = process.cwd(),
): void {
  // Skip the write when nothing SUBSTANTIVE changed.
  //
  // `last_run_at` is a fresh timestamp on every sweep, so an unconditional
  // write dirtied every script sidecar in this repo each time any consumer
  // ran a sweep — 76 modified files after one qou run, none of them a real
  // change. That churn is not free: it is indistinguishable, in `git
  // status`, from an actual checker-hash movement.
  //
  // The comparison is over the CONTENT-derived fields only: the source file,
  // the three hashes and the extra inputs. Identical there means the recorded
  // state is already accurate. `last_run_at`, `last_run_sha` and
  // `engine_version` describe the RUN, not the checker, so on their own they
  // are not a reason to write.
  //
  // `engine_version` was compared too until bean `3ozg` (2026-09-27), and that
  // kept the churn alive: the committed sidecars carried CI's `bun-1.3.14`, a
  // local run is `bun-1.3.11`, so every sweep from a different bun rewrote all
  // 72. `init-folio-qa.test.ts` runs a real sweep, which made `bun test` dirty
  // the tree and `bun run cat gates` report "NOT clean" on every branch. No reader
  // uses a script sidecar's `engine_version` for freshness (`entryIsFresh`
  // compares hashes), so it is left as a record of the last CONTENT change's
  // engine rather than the last run's.
  //
  // Why this took two beans to find (`rmcf`, then `3ozg`; #1451): the comment
  // here used to say everything but the two `last_run_*` fields was
  // content-derived. That was false for `engine_version`, which comes from the
  // ENVIRONMENT, and it ruled the environment out, so the hunt went looking
  // for a test alone. Both halves were needed: the WRITER is a test, the
  // TRIGGER was this term plus an off-pin engine. The pin (`.bun-version`)
  // and this skip are kept together, on the owner's choice.
  const prev = loadQaScriptSidecar(sidecar.criterion_id, repoRoot);
  if (
    prev &&
    prev.source_file === sidecar.source_file &&
    prev.script_hash === sidecar.script_hash &&
    prev.script_commit_sha === sidecar.script_commit_sha &&
    prev.deps_hash === sidecar.deps_hash &&
    JSON.stringify(prev.extra_inputs ?? []) ===
      JSON.stringify(sidecar.extra_inputs ?? [])
  ) {
    return;
  }
  const p = writePathOf(scriptSidecarPath(sidecar.criterion_id, repoRoot));
  // Use `dirname(p)` (not `join(p, "..")`) — the latter happens to
  // normalise to the parent on POSIX but reads as "go up from this
  // FILE", which is semantically wrong. `dirname` is the standard
  // idiom and tools that statically interpret paths don't see a
  // bogus directory entry.
  // Native `mkdirSync({ recursive: true })` rather than shelling out
  // to `mkdir -p` — avoids shell escaping issues if a criterion id
  // ever contains unusual characters, and is faster.
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(sidecar, null, 2) + "\n");
}

/**
 * The actor a SCRIPT sweep is acting as, resolved from the environment.
 *
 * Bean `a58y` measured that **0 of 5,896 QA verdicts resolved to a declared
 * actor**: `QaReviewer.id` is a script path, an actor id is a persona, and the
 * two sides never shared a vocabulary. So `qa-reporting` — the permission
 * governing who may emit a QA report at all — was not *unmet* but
 * **unevaluable**, for every verdict in the repository, while reading from the
 * permission graph as a control.
 *
 * ## Why two actors and not one
 *
 * The owner's ruling, 2026-09-22: attribute by **where the sweep ran**, not by
 * what it is. A single `qa-sweep` actor would have been simpler and would have
 * said less — and the difference is not bookkeeping:
 *
 * > A CI verdict is reproducible from the `reviewed_sha` it records. A local
 * > one may rest on an **uncommitted edit**, so the same sha addresses a tree
 * > that produced something else.
 *
 * Recording which one ruled is what keeps `reviewed_sha` an address rather
 * than a decoration. Both actors hold `qa-reporting`; neither holds
 * `content-authoring`.
 *
 * ## Why there is no third state here
 *
 * Every other resolver in this file reports "could not determine" rather than
 * guessing, and the absence of one here is deliberate rather than an omission.
 * The environment is always readable and the partition is total: `CI` is set
 * by every CI system and absent locally, so there is no case where the answer
 * is unknown. Inventing an `unknown-sweep` actor would manufacture a state
 * that cannot occur, and a state that cannot occur is one nobody maintains.
 *
 * `ci-pipeline` is declared generically — *"the build and validation system"* —
 * so a non-GitHub CI resolving to it is correct rather than a near-miss.
 */
export const CI_SWEEP_ACTOR = "ci-pipeline";
/** @see {@link sweepActor} */
export const LOCAL_SWEEP_ACTOR = "local-sweep";

/** Which of the two declared sweep actors is running. Takes `env` so it is testable. */
// input-site: env CI,GITHUB_ACTIONS #eddec1a1 — which sweep actor is named in a sidecar
export function sweepActor(env: Record<string, string | undefined> = process.env): string {
  return env.CI === "true" || env.GITHUB_ACTIONS === "true" ? CI_SWEEP_ACTOR : LOCAL_SWEEP_ACTOR;
}

/**
 * Where the script sidecars go: the `--script-sidecar-root` the caller gave,
 * else the platform folder when it is the platform's own checkout, else
 * nowhere (`null`).
 *
 * A folio runs this sweep from a remote-mounted copy of the platform
 * (`cat-harness-tools/` at its root, laid down by `remote-mount.ts`). That
 * copy has no `.git` and is fixity-checked against the lock, so a sidecar
 * written into it is a change nobody can commit, and the next mount refuses
 * the copy as "somebody's work" (smart-ra, 2026-10-30: a local
 * `qa-sweep.ts folio` blocked the staging publish).
 */
export function scriptSidecarTarget(explicit: string | undefined, platformRoot: string): string | null {
  if (explicit !== undefined) return explicit;
  return existsSync(join(platformRoot, ".git")) ? platformRoot : null;
}
