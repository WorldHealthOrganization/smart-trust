/**
 * Which checkout holds this layer, and whether it is the AGGREGATE.
 *
 * ## Why a test needs to ask (bean `ho66`)
 *
 * cat-harness is rehearsed as the repository it will be once separated: its
 * tracked files, and its declared closure's, laid out as sibling clones with
 * nothing above them (`probeStandalone` in `cat-harness-tools/scripts/seed-ready.ts`).
 * A handful of tests read what only the aggregate checkout holds — the bean
 * store and the todo graph at its root, another layer's tree, or a
 * committed output that was generated with the higher layers present.
 * Run alone, they fail on a missing input rather than on a defect, and that
 * failure looks exactly like a regression.
 *
 * The owner's ruling (2026-10-05) was to skip or guard those reads in a
 * principled way. This is the guard, and it is ONE predicate so that "needs
 * the aggregate" means the same thing at every call site.
 *
 * ## Derived, never configured
 *
 * The answer comes from the filesystem and the declarations — git's own
 * toplevel, and whether that toplevel holds layers other than this one —
 * never from an environment variable or a hardcoded path. A switch somebody
 * sets is a switch somebody forgets, and then the test is skipped in the one
 * checkout where it can run.
 *
 * git rather than `checkoutRootFor`, because two of the tests that use this
 * are tests OF `checkoutRootFor`: an oracle computed by the function under
 * test can only agree with it.
 *
 * ## A skip, visibly
 *
 * Callers use `test.skipIf(!inAggregate())`, or {@link notApplicableAlone}
 * where the skip should name what is absent, so a standalone run REPORTS the
 * skip rather than counting a pass; in the aggregate every guarded test runs
 * exactly as before. A test that reads a BUILT site file — one the publish
 * build writes and `.gitignore` keeps out of every clone — uses
 * {@link siteNotBuilt}, which skips only when that file is actually absent. A test whose subject can be found in cat-harness's own
 * content is rewritten to read that instead, and does not use this at all.
 *
 * @module test/support/checkout
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

import { layerRootsIn, siteDirFor } from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath, readPathAt, writePathAt } from "../../scripts/lib/layer-output.ts";
import { builtAtPublishOf } from "../../scripts/mount-from-lock.ts";

/** The cat-harness layer root — the directory this file's `test/` sits in. */
export const INSTANCE = resolve(HARNESS_ROOT);

/**
 * The working tree git says holds `dir` — the main checkout, an agent's
 * worktree, or a standalone clone.
 *
 * Throws rather than guessing when `dir` is in no git work tree: "could not
 * determine" must not turn into either answer.
 */
export function checkoutHolding(dir: string): string {
  // input-site: tree #150736c6 — the work tree holding dir, as git sees it
  const r = spawnSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { encoding: "utf-8" });
  const top = r.status === 0 ? r.stdout.trim() : "";
  if (top === "") {
    throw new Error(`cannot determine the checkout holding ${dir}: it is not in a git work tree (${r.stderr.trim() || "no output"})`);
  }
  return resolve(top);
}

/**
 * Whether `instanceRoot` sits inside a checkout that aggregates other
 * layers — the monorepo — rather than being a checkout of its own.
 *
 * True when git's toplevel is not the layer itself AND declares at least
 * one layer besides it. A standalone clone is its own toplevel, so false.
 */
export function inAggregate(instanceRoot: string = INSTANCE): boolean {
  const inst = resolve(instanceRoot);
  const top = checkoutHolding(inst);
  if (top === inst) return false;
  return layerRootsIn(top).some((r) => resolve(r) !== inst);
}

/**
 * Whether cat-harness is STANDING ALONE: its own checkout, with no composed
 * checkout above it — the negation of {@link inAggregate}, computed once.
 */
export const STANDALONE: boolean = !inAggregate();

/**
 * The guard for a test whose subject exists only in a COMPOSED checkout — a
 * state-branch graph (`beans/`, `todos/`, `fsh-guts/`, `issue-marks/`) or
 * another checkout-level tree — so that standing alone it reports a NAMED
 * "not applicable" rather than a failure (owner's ruling 2026-10-09,
 * litlfred/folio-assistant#2521, ruling 1(c)).
 *
 * `absent` names what is missing and why, at the call site. Standing alone it
 * is printed, so the skip says what it skipped in the run's own output rather
 * than only being counted; in the composed checkout this returns `false`, and
 * the guarded test runs exactly as before — and fails loudly if the graph is
 * not there. Use it as `test.skipIf(notApplicableAlone("…"))`.
 */
export function notApplicableAlone(absent: string): boolean {
  if (STANDALONE) console.warn(`not applicable standing alone: ${absent}`);
  return STANDALONE;
}

/**
 * The guard for a test whose subject is a BUILT SITE file: a projection,
 * page or include the publish build writes (`docs/assets/<graph>/…`,
 * `docs/en/<harness>/<visualiser>/index.html`, `docs/_data/harness.json`,
 * `docs/_includes/generated/…`) and `.gitignore` keeps out of every clone, so
 * a fresh standalone checkout has never had it (owner, 2026-10-30, bean
 * `folio-assistant-w1gy` F18 option A: "a second named guard ('site not
 * built') that only skips in standalone").
 *
 * It is narrower than {@link notApplicableAlone} on purpose: a built site is
 * not something only a composed checkout CAN hold — a standalone clone that
 * ran the build holds it too — so the skip needs BOTH conditions. It skips
 * when the run stands alone AND at least one of `built` is absent, and says
 * which; standing alone with the site built, or in the composed checkout
 * whatever is on disk, it returns `false` and the test runs exactly as before
 * — and fails loudly if the file is missing there.
 *
 * `what` names the prerequisite and what writes it, at the call site; `built`
 * are the absolute paths the test reads. Use it as
 * `test.skipIf(siteNotBuilt("…", path))`.
 */
export function siteNotBuilt(what: string, ...built: string[]): boolean {
  return siteNotBuiltWhen(STANDALONE, what, built);
}

/**
 * {@link siteNotBuilt} with standing-alone passed in, so the guard's own test
 * can ask both layouts of one filesystem. Not for call sites: a caller that
 * chose `standalone` itself would be the switch this module refuses.
 */
export function siteNotBuiltWhen(standalone: boolean, what: string, built: readonly string[]): boolean {
  if (built.length === 0) throw new Error(`siteNotBuilt: no path given for ${what} — a guard over nothing cannot say what is absent`);
  if (!standalone) return false;
  const missing = built.filter((p) => !existsSync(p));
  if (missing.length === 0) return false;
  const shown = missing.map((p) => relative(dirname(INSTANCE), p)).join(", ");
  console.warn(`site not built (standing alone): ${what} — absent: ${shown}`);
  return true;
}

/**
 * The guard for a test that runs a command from, or reads, the checkout
 * ROOT's own `package.json`: the `cat` alias (`bun run cat <script>`) and the
 * scripts declared there (`bootstrap:schemas:check`, …). The composed
 * checkout holds that manifest; clones laid side by side have nothing above
 * them, so the root a script resolves (`repoRootFor`, `dirname(HARNESS_ROOT)`)
 * has none (bean `folio-assistant-w1gy` F11, the sibling root).
 *
 * It skips only when the manifest is ACTUALLY absent at `repo` and the run
 * stands alone ({@link notApplicableAlone}); in the composed checkout, or
 * wherever the manifest is there, it returns `false` and the test runs —
 * and fails loudly if the manifest is missing in the composed checkout.
 * `needs` says what the test takes from it, at the call site.
 */
export function noRootManifest(repo: string, needs: string): boolean {
  return (
    !existsSync(join(repo, "package.json")) &&
    notApplicableAlone(`the checkout root's \`package.json\` at ${repo}, for ${needs} (clones side by side have no root above them)`)
  );
}

/**
 * Build the publish-time projections `gen-docs-pages.ts` writes
 * (`assets/todos/index.json`, `assets/beans/index.json`,
 * `assets/beans/count.json`, `todos.jsonld`) when running in the composed
 * checkout and the projections are not yet on disk (#411). Standing alone this
 * is a no-op so {@link siteNotBuilt} skips remain intact.
 */
export function ensureDocsPages(instanceRoot: string = INSTANCE): void {
  if (STANDALONE) return;
  const root = resolve(instanceRoot);
  const index = join(root, siteDirFor(root), "assets", "todos", "index.json");
  if (existsSync(overlayPath(index))) return;
  buildDocsProjections(checkoutHolding(root));
}

/**
 * Write into `repo` the projections a full `gen-docs-pages.ts` run builds at
 * publish, WITHOUT running it over `repo`: it runs over a
 * {@link scratchCheckoutOf} `repo`, and only the paths each layer declares
 * `builtAtPublish` are copied back ({@link copyBuiltAtPublish}).
 */
export function buildDocsProjections(repo: string): void {
  const scratch = scratchCheckoutOf(repo);
  try {
    runDocsPagesIn(scratch, repo);
    copyBuiltAtPublish(scratch, repo);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * A COPY of the checkout `repo`, in a fresh temporary directory, for a test
 * that must run a writer over the whole checkout (bean `cat-tools-sm8r` item
 * 4): `gen-docs-pages.ts` re-renders every layer's committed pages, process
 * diagrams and translation templates, and run in place it left 7 of 12 mounts
 * of a composed checkout `edited` after one `bun test`. The mounts are not git
 * work trees, so {@link restoringTracked} — which asks git what to restore —
 * restored nothing there.
 *
 * Every file is copied except `.git`, which is SYMLINKED to the original (the
 * writer reads git — the origin's URL, the state branches — but never writes
 * it), and `node_modules/`, which is LINKED rather than copied
 * ({@link linkNodeModules}). The caller removes the copy.
 */
export function scratchCheckoutOf(repo: string): string {
  const from = resolve(repo);
  // input-site: inert #89b3cdd3 — a temp dir the caller removes; its name never reaches an answer
  const to = mkdtempSync(join(tmpdir(), "scratch-checkout-"));
  cpSync(from, to, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (src, dest) => {
      const name = basename(src);
      if (src === from) return true;
      if (name === ".git") {
        mkdirSync(dirname(dest), { recursive: true });
        symlinkSync(src, dest);
        return false;
      }
      if (name === "node_modules") {
        linkNodeModules(src, dest);
        return false;
      }
      return true;
    },
  });
  return to;
}

/**
 * `node_modules/` for a scratch copy: a real directory whose packages are
 * symlinks to the originals, but whose WORKSPACE links are recreated as they
 * are. A workspace link is relative (`@litlfred/cat-harness ->
 * ../../cat-harness`), so recreated it names the layer IN THE COPY. Symlinking
 * the whole directory instead resolved it through the original, so the copy's
 * writer imported the real checkout's modules and wrote the real tree.
 */
function linkNodeModules(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, e.name);
    const to = join(dest, e.name);
    if (e.isSymbolicLink()) symlinkSync(readlinkSync(from), to);
    else if (e.isDirectory() && e.name.startsWith("@")) linkNodeModules(from, to);
    else symlinkSync(from, to);
  }
}

/** Run the full `gen-docs-pages.ts` in `scratch`, a {@link scratchCheckoutOf} `repo`: the copy's own script, with the copy as the working directory. */
export function runDocsPagesIn(scratch: string, repo: string): SpawnSyncReturns<string> {
  // input-site: runs */scripts/gen-docs-pages.ts,scripts/gen-docs-pages.ts #dad99286 — builds the docs pages in a scratch copy of the checkout, inheriting this environment
  return spawnSync("bun", [join(scratch, relative(resolve(repo), TOOLS_ROOT), "scripts", "gen-docs-pages.ts")], { cwd: scratch, encoding: "utf-8" });
}

/**
 * Copy back, from a scratch copy into the checkout it was made from, only what
 * each layer declares it builds at publish (`builtAtPublish`): the projections
 * a test reads (`assets/todos/index.json`, `assets/beans/`, `todos.jsonld`, …)
 * and nothing a mount digest hashes, so every mount stays `current`.
 */
export function copyBuiltAtPublish(scratch: string, repo: string): void {
  for (const root of layerRootsIn(repo)) {
    const rel = relative(repo, root);
    for (const path of builtAtPublishOf(root)) {
      // A mounted layer's projections are written at its output root, in the
      // scratch copy and here alike (bean `cat-tools-sm8r`, item 4).
      const src = readPathAt(scratch, join(scratch, rel, path));
      if (!existsSync(src)) continue;
      const dest = writePathAt(repo, join(root, path));
      mkdirSync(dirname(dest), { recursive: true });
      // Fill what is missing; never replace a file the publish already built
      // (a rebuild in a scratch copy is not byte-identical to it, and every
      // later reader in the run would see the replacement).
      cpSync(src, dest, { recursive: true, force: false });
    }
  }
}

/** One tracked file's bytes, as found before a run that may rewrite it. */
interface TrackedCopy {
  path: string;
  bytes: Buffer | undefined;
}

/**
 * Run `fn`, which spawns a writer over the real tree, and put every TRACKED
 * file under `dirs` back exactly as it was, so the test leaves the
 * repositories as it found them (bean `folio-assistant-w1gy` F24: a full
 * `docs:pages` re-derives the committed QA witnesses under
 * `test/results/witnesses/`, and `bun test` dirtied a sibling repository).
 *
 * What is restored is what git tracks under each directory — read from git,
 * per directory, so it holds in a composed checkout and in side-by-side
 * clones alike. A file the run deletes is written back; a file it changes is
 * given its old bytes; a file it ADDS is the writer's and the caller's to
 * judge (the orphan sweep test asserts exactly that). Then the restore is
 * CHECKED: a tracked file still differing from what was saved throws, so a
 * restore that silently missed something fails the test rather than the
 * next `git status`.
 */
export function restoringTracked<T>(dirs: readonly string[], fn: () => T): T {
  const saved: TrackedCopy[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    // input-site: tree #fbace24d — the files git tracks under dir
    const r = spawnSync("git", ["-C", dir, "ls-files", "-z", "--", "."], { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) continue; // not in a work tree: nothing tracked to protect
    for (const rel of r.stdout.split("\0").filter((f) => f !== "")) {
      const path = join(dir, rel);
      saved.push({ path, bytes: existsSync(path) ? readFileSync(path) : undefined });
    }
  }
  try {
    return fn();
  } finally {
    const left: string[] = [];
    for (const { path, bytes } of saved) {
      if (bytes === undefined) continue; // already absent before the run
      const now = existsSync(path) ? readFileSync(path) : undefined;
      if (now !== undefined && now.equals(bytes)) continue;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes);
      if (!readFileSync(path).equals(bytes)) left.push(path);
    }
    if (left.length > 0) throw new Error(`could not restore ${left.length} tracked file(s): ${left.join(", ")}`);
  }
}
