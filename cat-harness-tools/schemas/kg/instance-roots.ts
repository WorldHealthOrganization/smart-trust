/**
 * Layer DISCOVERY: which directories are layers, and which file in a
 * directory is its declaration. Filesystem only, and deliberately a LEAF:
 * it imports nothing from the schema layer, so `graph-typology-registry.ts` can
 * find each harness's declared `typologies/` graph without importing
 * `cat-harness.ts`, which imports the registry. `cat-harness.ts` re-exports
 * all four.
 *
 * @module cat-harness/schemas/instance-roots
 * @graphNode none — constants and functions that locate a layer's declaration; no schema
 */
import { existsSync, readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { projectedRead } from "../sdlc/read-projections.ts";

/**
 * The REPOSITORY root that contains `instanceRoot` — the aggregate checkout.
 *
 * Handles both monorepo layout (layer is a subdirectory of the repo root)
 * and worktree layout (e.g. `.claude/worktrees/<name>/`).
 */
export function repoRootFor(instanceRoot: string): string {
  const abs = resolve(instanceRoot);
  const parent = join(abs, "..");
  if (basename(parent) === "worktrees" && basename(join(parent, "..")) === ".claude") {
    return resolve(parent, "../..");
  }
  return parent;
}

/**
 * The suffix every layer declaration carries — `<name>.config.json`.
 *
 * ## `harness.json` is gone, and this replaced it
 *
 * The owner, 2026-09-21: *"Excise harness.json.. only
 * `<harness-stub>.config.json` makes instantiation at root of repo"*.
 *
 * There used to be TWO files with no overlap in content: `harness.json` held
 * the DECLARATION (`name`, `directories`, `assets`, `needs`, `stickies`) and
 * `<name>.config.json` held the CONFIG (`contentType`, `adapter`,
 * `dependencies`, `translation`). One layer, two files, and a reader had to
 * know which question each answered. They are one file now.
 *
 * ## A fixed filename cannot be discovered, and that was the point
 *
 * `harness.json` was a CONSTANT, so discovery asked `existsSync(dir +
 * "/harness.json")` and the declared `name` inside was free to be anything.
 * Under `<name>.config.json` the FILENAME CARRIES THE NAME, so the two cannot
 * disagree — and {@link findDeclarationFile} checks exactly that rather than
 * trusting either half.
 *
 * ## What tells a declaration from a plain config — the NAME, then the SUFFIX
 *
 * **A `name` field**, and since 2026-09-21 the suffix as well.
 *
 * Until then both ended `.config.json`, so the only discriminator was inside
 * the file: carrying `name` made it a declaration, lacking one made it a
 * config. That worked and was still the thing `b5f0` §1 warned about — two
 * different schemas, with two different readers, sharing one filename shape
 * and told apart only by which directory they sat in.
 *
 * The owner reversed §1's REPLACE ruling on 2026-09-21 and took its other
 * option, the one `b5f0` recorded as *"`<name>.json` + `<name>.config.json`
 * would at least pair them"*:
 *
 * | file | schema | reader |
 * |---|---|---|
 * | `<name>.json` in the layer | {@link CatHarnessDeclarationSchema} | `readDeclaration` |
 * | `<name>.config.json` at the instantiation root | `HarnessConfigSchema` | `readHarnessConfig` |
 *
 * The `name` check STAYS rather than being replaced by the suffix.
 * {@link findDeclarationFile} still requires the filename stem to equal the
 * declared `name`, which is what makes a declaration self-identifying: a
 * consumer opening a repository it has never seen scans, parses, and takes the
 * file that agrees with itself. That is the property migration-plan I.8 asked
 * for, and it is the reason the suffix could move at all — nothing here
 * derives a filename from a DIRECTORY name, so a clone renamed on disk still
 * resolves.
 */
export const DECLARATION_SUFFIX = ".json";

/**
 * The suffix of an instantiation root's CONFIG, as against its declaration.
 *
 * These were ONE suffix until 2026-09-21, because the declaration had been
 * folded into the config. The owner's reversal separates them again, so there
 * are now two things to spell and they must not be spelled by one constant:
 * composing a config path from {@link DECLARATION_SUFFIX} produced
 * `cat-harness.json` for a file that is `cat-harness.config.json`, and
 * `check:instance-config` reported all three real configs as orphans.
 */
export const CONFIG_SUFFIX = ".config.json";

/**
 * The declaration file in this directory, or `undefined` if there is none.
 *
 * Scans for `*.json` and returns the one that both carries a `name` and
 * whose filename stem EQUALS that name. A file failing either half is not a
 * declaration: no `name` means it is a plain config, and a mismatched stem is
 * the rename-half-done case `check:instance-config` already reports.
 *
 * **Several declarations in one directory THROWS.** Picking one silently is
 * the `dh4f` shape — a consumer reads a declaration, gets an answer, and
 * reports a clean run over the layer it did not see. There is no correct
 * choice to make here, so the caller is told rather than guessed at.
 */
/**
 * A candidate file's parsed `{ name }`, read once per version of the file.
 *
 * Measured 2026-11-13 (a content layer's main red): in a full index of 12
 * layers, one `kg-audit --instance` of that layer
 * took 2 min 55 s, and 126 s of it was this function re-reading and
 * re-parsing the same layer declarations: `layerRootsIn` and
 * `declaredOptInRequires` call it on every layer for every directory resolved.
 * Four `kg-audit` tests have a 30 s budget, so they timed out on core's main
 * once the index grew, though every answer was right.
 *
 * Keyed by path and checked against the file's size, mtime and inode on every
 * call, so an edit, a replacement or a new file is read again. A stat is not an
 * open, and the projected read is reported only when the file is actually
 * read, so a tracing run still pairs each report with its read. A file that
 * fails to parse is not cached: it throws on every call, as before.
 */
const declarationNames = new Map<string, { stamp: string; raw: unknown }>();
function declarationNameOf(abs: string): unknown {
  const stamp = fileStamp(abs);
  const hit = declarationNames.get(abs);
  if (hit !== undefined && hit.stamp === stamp) return hit.raw;
  // Only whether it parses and its `name` are used here. A caller that needs more reads the file again, and that open is not covered.
  projectedRead(abs, "declaration-name");
  const parsed = JSON.parse(readFileSync(abs, "utf-8")) as { name?: unknown } | null;
  const raw = { name: parsed?.name };
  declarationNames.set(abs, { stamp, raw });
  return raw;
}

/** A directory's entries, listed again only when the directory's mtime moves (an entry added, removed or renamed). */
const listings = new Map<string, { mtimeMs: number; entries: string[] }>();
function listDir(dir: string): string[] {
  const mtimeMs = statSync(dir).mtimeMs;
  const hit = listings.get(dir);
  if (hit !== undefined && hit.mtimeMs === mtimeMs) return hit.entries;
  const entries = readdirSync(dir);
  listings.set(dir, { mtimeMs, entries });
  return entries;
}

/** A file's identity for the caches here: size, mtime and inode. */
export function fileStamp(abs: string): string {
  const st = statSync(abs);
  return `${st.size}:${st.mtimeMs}:${st.ino}`;
}

export function findDeclarationFile(dir: string): string | undefined {
  let entries: string[];
  try {
    entries = listDir(resolve(dir));
  } catch {
    // Unreadable directory is "could not look", and a caller asking "is there
    // a declaration here" gets `undefined` either way. The distinction is not
    // lost: every caller that needs it re-reads and throws.
    return undefined;
  }
  const found: string[] = [];
  const broken: string[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(DECLARATION_SUFFIX)) continue;
    // `index.config.json`, `index.lock.json`: the platform's, never a declaration.
    if (isReservedIndexFile(entry)) continue;
    // `*.config.json`, `*.baseline.json`, `package.json`, `tsconfig.json`: configs, baselines and manifests, never a declaration.
    if (entry.endsWith(CONFIG_SUFFIX) || entry.endsWith(".baseline.json") || entry === "package.json" || entry === "tsconfig.json") continue;
    const stem = entry.slice(0, -DECLARATION_SUFFIX.length);
    if (stem.length === 0) continue;
    let raw: unknown;
    try {
      raw = declarationNameOf(join(dir, entry));
    } catch {
      // UNPARSEABLE IS NOT ABSENT. Skipping it here would make "this instance
      // declared something and it is broken" indistinguishable from "there is
      // nothing here" — the `xom7` failure, where a sweep that could not look
      // reports a clean run. It cannot be matched on `name` (there is no
      // parse), so it is collected separately and `readDeclaration` throws on
      // it rather than returning `undefined`.
      //
      // BUT ONLY WHEN IT COULD PLAUSIBLY BE THIS LAYER'S. The suffix was
      // `.config.json` until 2026-09-21, which made "unparseable file with
      // this suffix" a near-certain broken declaration. A bare `.json` makes
      // it near-certainly NOT one: a malformed `folio/landing.json` — a
      // landing sticky, nothing to do with declarations — was reported as a
      // broken declaration and took `readDeclaration` down with it.
      //
      // The two admissible signals, neither of which is used for RESOLUTION:
      // a sibling `<stem>.config.json`, which is the pairing the split
      // created, or a stem equal to the directory's own name. Matching the
      // directory here does NOT reintroduce what migration-plan I.8 warned
      // about — that is about deriving a declaration's location from a
      // directory name, and resolution still goes only through a file
      // agreeing with its own `name`. This is error REPORTING: the cost of
      // being wrong is a worse message, not a missed layer.
      const plausible = stem === basename(dir) || entries.includes(`${stem}${CONFIG_SUFFIX}`);
      if (plausible) broken.push(entry);
      continue;
    }
    if ((raw as { name?: unknown })?.name === stem) found.push(entry);
  }
  // A VALID declaration wins over a broken sibling: a directory may hold an
  // unrelated `*.config.json` that is merely malformed, and that must not stop
  // the layer being read.
  //
  // With NOTHING valid, the broken one is returned rather than thrown on, and
  // that is the whole third-state design. DISCOVERY MUST BE TOTAL —
  // `layerRootsIn` asks "which directories are instances" and a throw there
  // takes out every caller, including the ones written to REPORT an unreadable
  // declaration (`workPlanGraphsIn`, `isActiveKg`). Returning it reproduces
  // the old semantics exactly: `harness.json` present made the directory a
  // layer, and `readDeclaration` threw when it came to parse it. Present
  // and unreadable stays distinguishable from absent, which is the property;
  // where the error is raised is not.
  if (found.length === 0 && broken.length > 0) return broken.sort()[0];
  if (found.length > 1) {
    throw new Error(
      `${resolve(dir)} carries ${found.length} declarations (${found.sort().join(", ")}). ` +
        "A directory is one instance; picking one silently would hide the others.",
    );
  }
  return found[0];
}

/**
 * Every layer in `repoRoot` — the repository root itself when it declares,
 * plus each immediate subdirectory that does.
 *
 * {@link findInstanceRoot} walks UP from a path to the layer owning it;
 * this is the same fact in the other direction, and until now it was the
 * direction nobody had implemented — the note on {@link initializationDoc}
 * said so explicitly ("*NOT implemented and is not assumed here*", bean
 * `wggr`).
 *
 * **Two gates were each carrying their own literal `["cat-harness",
 * "bootstrap"]` instead** (`check-declared-assets`, `check-instance-render`),
 * and by 2026-09-20 there were FOUR layers: those two, `folio-assist-core`,
 * and the repository root. So both gates reported clean runs over sets that
 * excluded half the subject — `dh4f` again, in the two checks whose whole job
 * is to look at layers.
 *
 * `check-instance-render`'s literal even sat under the docstring "*Every
 * instance this repository owns — the root, and any beside it*", which was
 * false in both halves: the root was not in the list and two layers beside
 * it were missing. **A list that has to be edited when a directory is added is
 * a list that will be wrong**, and the fix is to ask the filesystem rather
 * than to lengthen it (bean `6tkl`).
 *
 * Scanning is deliberately ONE level deep and skips dot-prefixed segments,
 * matching the dot-prefix guard the directory conventions already apply
 * everywhere else. Results are sorted so a caller's report is stable, with the
 * repository root first when it declares.
 */
/**
 * Top-level BUILD OUTPUT directories, which are never layers, so their
 * `*.json` are never read as candidate declarations. Bean `4rbc`, measured
 * 2026-10-07: every check that discovers layers read
 * `build/qa-refresh.json`, a report stamped with the commit it was built on.
 * That made a build product an input of 17 traced gates, and those gates
 * could never be skipped. The same list as `BUILD_OUTPUT_DIRS` in
 * `scripts/input-hash.ts` (ci-cone.test.ts asserts they agree). This layer
 * may not import that module.
 */
// input-site: inert #8fbd1be9 — the build-output directories layer discovery leaves out; it reads none of them
export const NOT_LAYER_DIRS: readonly string[] = ["build", "_kg", "_site", "dist"];

export function layerRootsIn(repoRoot: string): string[] {
  const root = resolve(repoRoot);
  const out: string[] = [];
  if (findDeclarationFile(root) !== undefined) out.push(root);

  let entries: Dirent[];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    // Unreadable root is "could not determine", and a caller that treats an
    // empty list as "no instances" is the very failure this function exists
    // to end — so say nothing rather than claim an empty set.
    return out;
  }

  const submodules = submodulePathsOf(root);
  // Only a directory INSIDE a checkout has foreign checkouts to exclude. A
  // plain directory of sibling clones — the separated layout, and the
  // standalone rehearsal (bean `ho66`) that lays it out — has no repository
  // for a clone to be foreign to, so every clone in it is a layer. Without
  // this, g43f's filter dropped all of them: `needs` resolved to nothing and
  // 86 tests failed standalone on `main` at 24b5c12 (2026-10-05).
  const inCheckout = insideGitCheckout(root);
  const subs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !NOT_LAYER_DIRS.includes(e.name))
    .map((e) => join(root, e.name))
    .filter((p) => !inCheckout || !isForeignCheckout(p, submodules))
    .filter((p) => findDeclarationFile(p) !== undefined)
    .sort();

  return out.concat(subs);
}

/**
 * The root of the layer named `name` within `repoRoot`: the repository root
 * itself when it declares `<name>.json` (the standalone layout, where a layer
 * IS its repository), else the one-level-deep layer that does (the
 * monorepo, where it is `<repoRoot>/<dir>`). `undefined` when neither does.
 *
 * Bean `uxn1`: three callers wrote `join(repoRoot, "cat-harness")`, which is
 * right only in the monorepo, so a standalone cat-harness found no actors and
 * no skill-definitions directory. Asking the declarations answers both
 * layouts with one rule, and never guesses a path that does not exist.
 */
export function layerRootNamed(repoRoot: string, name: string): string | undefined {
  const want = `${name}${DECLARATION_SUFFIX}`;
  return layerRootsIn(repoRoot).find((root) => findDeclarationFile(root) === want);
}

/**
 * The submodule paths `root/.gitmodules` declares, or an empty set when it
 * declares none. Git's own declaration of which nested checkouts belong to
 * this repository — read rather than re-derived, so the answer is git's.
 */
function submodulePathsOf(root: string): ReadonlySet<string> {
  const file = join(root, ".gitmodules");
  if (!existsSync(file)) return new Set();
  const out = new Set<string>();
  for (const m of readFileSync(file, "utf-8").matchAll(/^\s*path\s*=\s*(.+?)\s*$/gm)) out.add(m[1]!);
  return out;
}

/**
 * Whether `dir` is a SEPARATE checkout — it holds its own `.git` (a directory
 * for a clone, a FILE for a worktree or submodule) and its parent's
 * `.gitmodules` does not name it — and so is not an instance of the
 * repository being scanned (bean `g43f`).
 *
 * ## The escape this closes
 *
 * {@link repoRootFor} is `dirname`, so for the ROOT layer it climbs out of
 * the checkout. In a Claude Code worktree that lands on `.claude/worktrees/`,
 * whose every child is a sibling worktree declaring `folio-assistant` at its
 * root. Measured 2026-10-03 from `agent-aefc4dcac619f2e1f`:
 * `layerRootsIn(repoRootFor(root))` returned **ten sibling worktrees** as
 * instances of this one. A caller asking for its siblings that way reads other
 * sessions' uncommitted work as its own corpus.
 *
 * The rule is the same one git applies: a nested checkout is not part of the
 * enclosing tree unless it is a declared submodule. `bootstrap/` and
 * `bootstrap-tools/` have a `.git` file and ARE layers, which is why the
 * `.gitmodules` half exists; a layer directory with no `.git` is
 * untouched, so non-git fixtures read exactly as before.
 */
export function isForeignCheckout(dir: string, submodules: ReadonlySet<string> = submodulePathsOf(resolve(dir, ".."))): boolean {
  if (!existsSync(join(dir, ".git"))) return false;
  return !submodules.has(basename(dir));
}

/**
 * Whether `dir` or any ancestor holds a `.git` — that is, whether `dir` lies
 * inside some checkout. Read from the filesystem: a spawned `git rev-parse`
 * would be slower on a hot path and no more correct.
 */
function insideGitCheckout(dir: string): boolean {
  for (let d = resolve(dir); ; d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return true;
    if (dirname(d) === d) return false;
  }
}

// ── The instantiation root's CONFIG files, scanned once ──────────────────────

/**
 * The retired global config name. Not a layer called `harness`; kept so
 * `check:instance-config` can FIND it, never so a reader can fall back to it.
 * Defined here (a leaf) and re-exported by `schemas/kg/harness-config.ts`, which
 * is where every existing importer looks for it.
 */
export const LEGACY_HARNESS_CONFIG = "harness.config.json";

/**
 * `index.config.json` — the instantiation root's INDEX: which harnesses this
 * checkout instantiates, where each comes from, and which one the site lands
 * on (`schemas/kg/index-config.ts`, `folio-index-config/v1`).
 *
 * It ends in {@link CONFIG_SUFFIX}, so every scan that read "each root
 * `*.config.json` is a harness" would have read it as a harness called
 * `index`. That is why the name is RESERVED ({@link RESERVED_LAYER_NAMES})
 * and why the scan below is the one place the suffix is matched.
 */
export const INDEX_CONFIG_FILENAME = "index.config.json";

/**
 * Layer names no harness may take, because a file the platform owns
 * already spells `<name>.config.json` with them. `index` is the root index.
 */
export const RESERVED_LAYER_NAMES: readonly string[] = ["index"];

/**
 * Every `<name>.config.json` directly in `root`, as its stem, sorted — the
 * retired {@link LEGACY_HARNESS_CONFIG} and the reserved
 * {@link INDEX_CONFIG_FILENAME} excluded. `[]` when `root` cannot be read.
 *
 * THE ONE SCAN. Five scripts each re-implemented it with `readdirSync` and a
 * suffix test (`check-avatar-instances`, `check-folio-mount`,
 * `check-instance-config`, `scan-repo-content`, `build-folio-site`), one of
 * them without the legacy exclusion, and none could have known about the
 * reserved `index`. A sixth copy is how the reserved name leaks back in.
 *
 * This is the FILE set, which is not always the INSTANTIATED set: when the
 * root carries `index.config.json` that file is authoritative, and
 * `instantiatedHarnessNames` in `schemas/kg/harness-config.ts` is the answer.
 */
export function rootConfigStems(root: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }
  return entries
    .filter((f) => f.endsWith(CONFIG_SUFFIX) && f !== LEGACY_HARNESS_CONFIG && !isReservedIndexFile(f))
    .map((f) => f.slice(0, -CONFIG_SUFFIX.length))
    .filter((n) => n.length > 0 && !RESERVED_LAYER_NAMES.includes(n))
    .sort();
}

// ── The mount lock's filename, and the transition from the old one ───────────

/**
 * `index.lock.json` — the GENERATED companion to {@link INDEX_CONFIG_FILENAME}:
 * what the declared remote mounts resolved to (`cat-harness-mount-lock/v1`,
 * `schemas/kg/remote-mount.ts`). The owner, 2026-10-07: rename the lock to sit
 * beside the index it is generated from.
 */
export const INDEX_LOCK_FILENAME = "index.lock.json";

/** The lock's retired suffix: `<root-instance>.mount-lock.json`. READ during the transition, never written. */
export const LEGACY_MOUNT_LOCK_SUFFIX = ".mount-lock.json";

/**
 * Whether `file`, a name directly in an instantiation root, is one the
 * platform owns under the reserved `index` stem — `index.config.json`,
 * `index.lock.json`, `index.json`. No scan may read one as a harness's config
 * or declaration: the `index` stem is reserved across the board.
 */
export function isReservedIndexFile(file: string): boolean {
  return file === "index.json" || file.startsWith("index.");
}

/**
 * The lock file(s) in `dir`, as names: `index.lock.json` when it exists, else
 * every legacy `*.mount-lock.json` (a downstream folio or an old branch that
 * has not migrated). BOTH present is a `conflict` and `files` is empty —
 * merging two locks silently would replay whichever pins happened to win.
 *
 * The tools layer's `scripts/mount-from-lock.ts` re-states this rule inline, because
 * it imports nothing but `node:*` by design; its test holds the two together.
 */
export function lockFilesIn(dir: string): { files: string[]; conflict?: string } {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return { files: [] };
  }
  const legacy = entries.filter((n) => n.endsWith(LEGACY_MOUNT_LOCK_SUFFIX)).sort();
  if (entries.includes(INDEX_LOCK_FILENAME)) {
    if (legacy.length > 0) {
      return {
        files: [],
        conflict: `${join(dir, INDEX_LOCK_FILENAME)} and ${legacy.map((n) => join(dir, n)).join(", ")} both exist — one lock per checkout; keep ${INDEX_LOCK_FILENAME} (\`git mv\` the legacy one over it, or remove the stale one) rather than have two replayed`,
      };
    }
    return { files: [INDEX_LOCK_FILENAME] };
  }
  return { files: legacy };
}

// Old names, kept so callers in other layers keep working while they move to
// the layer names (cat-harness#1138 P4). Remove once no layer imports them.
/** @deprecated Use {@link NOT_LAYER_DIRS}. */
export const NOT_INSTANCE_DIRS = NOT_LAYER_DIRS;
/** @deprecated Use {@link layerRootsIn}. */
export const instanceRootsIn = layerRootsIn;
/** @deprecated Use {@link layerRootNamed}. */
export const instanceRootNamed = layerRootNamed;
/** @deprecated Use {@link RESERVED_LAYER_NAMES}. */
export const RESERVED_INSTANCE_NAMES = RESERVED_LAYER_NAMES;
