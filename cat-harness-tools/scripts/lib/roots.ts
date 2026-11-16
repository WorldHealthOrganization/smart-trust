/**
 * The three roots a file in this layer means, named once.
 *
 * ## Why this exists
 *
 * Code that lived in `cat-harness/` computed "the harness" as
 * `import.meta.dir/..` — 460 such sites in 399 files, measured for bean `70lx`
 * (S5 stage 1a). Once that code moves here the same expression means
 * `cat-harness-tools/`, which holds no skills, processes, docs or results, and
 * nothing fails loudly: a scan over an empty directory reports a clean run (the
 * bean `dh4f` shape). So every such site is rewritten, as it moves, to ask for
 * the root it meant:
 *
 * | constant | means | is |
 * |---|---|---|
 * | {@link HARNESS_ROOT} | the harness CONTENT this layer serves — skills, processes, schemas, `test/results/` | resolved, see below |
 * | {@link TOOLS_ROOT} | this layer itself — the code that moved | `import.meta.dir/../..` |
 * | {@link REPO_ROOT} | the checkout holding both, when there is one | `undefined` standalone |
 *
 * ## How the harness is found, and why in this order
 *
 * 1. `--harness <dir>` (or `--harness=<dir>`) — the caller said so, for this run.
 * 2. `$CAT_HARNESS_ROOT` — the environment said so, for every run.
 * 3. The sibling `../cat-harness`, **only if its declaration's `name` is
 *    `cat-harness`**. A directory that merely has the right name is not the
 *    harness; the declaration is the contract, as it is everywhere else here.
 *
 * Nothing found is a THROW, not a guess. Every caller of `HARNESS_ROOT` reads
 * content from it, and a wrong root reads as an empty corpus.
 *
 * An explicit root (1 or 2) is checked the same way: it must hold a
 * `cat-harness.json` naming `cat-harness`. A typo in `$CAT_HARNESS_ROOT`
 * should fail where it is made, not three calls later as "no skills".
 *
 * ## Why this file reads the declaration itself
 *
 * It could import `readDeclaration` from the harness, but that import is a
 * relative path into the sibling — which assumes the very layout this module
 * exists to resolve. One `JSON.parse` of one field keeps the resolver free of
 * the thing it is resolving.
 *
 * @module scripts/lib/roots
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The harness's machine name, as its declaration states it. */
export const HARNESS_NAME = "cat-harness";

/**
 * This layer's root: `cat-harness-tools/`, two levels above this file.
 * `import.meta.dir` is Bun's; Playwright loads this module under Node, which
 * has only `import.meta.url`.
 */
export const TOOLS_ROOT: string = resolve(import.meta.dir ?? dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Where a harness root came from — reported, so a surprise is diagnosable. */
export type HarnessRootSource = "flag" | "env" | "sibling";

export interface HarnessRootInputs {
  /** Command-line arguments to scan for `--harness`. Defaults to `process.argv`. */
  argv?: readonly string[];
  /** Environment to read `CAT_HARNESS_ROOT` from. Defaults to `process.env`. */
  env?: Readonly<Record<string, string | undefined>>;
  /** This layer's root, whose sibling is tried last. Defaults to {@link TOOLS_ROOT}. */
  toolsRoot?: string;
}

/** `--harness <dir>` or `--harness=<dir>`; the last one wins, as with any flag. */
export function harnessFlag(argv: readonly string[]): string | undefined {
  let found: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--harness" && i + 1 < argv.length) found = argv[++i];
    else if (a.startsWith("--harness=")) found = a.slice("--harness=".length);
  }
  return found === "" ? undefined : found;
}

/** Does `dir` hold a declaration whose `name` is the harness's? */
export function isHarnessRoot(dir: string): boolean {
  const decl = join(dir, `${HARNESS_NAME}.json`);
  if (!existsSync(decl)) return false;
  try {
    return (JSON.parse(readFileSync(decl, "utf8")) as { name?: unknown }).name === HARNESS_NAME;
  } catch {
    return false;
  }
}

/**
 * Resolve the harness root: flag, then environment, then the declared sibling.
 *
 * Throws when an explicit root is not the harness, and when nothing is found.
 */
export function resolveHarnessRoot(inputs: HarnessRootInputs = {}): { root: string; source: HarnessRootSource } {
  const argv = inputs.argv ?? process.argv;
  // input-site: env-unset CAT_HARNESS_ROOT #861163c1 — names a harness root that may lie outside the tree; unset, the root is the in-tree sibling
  const env = inputs.env ?? process.env;
  const toolsRoot = inputs.toolsRoot ?? TOOLS_ROOT;

  const explicit: Array<[HarnessRootSource, string | undefined]> = [
    ["flag", harnessFlag(argv)],
    ["env", env.CAT_HARNESS_ROOT || undefined],
  ];
  for (const [source, dir] of explicit) {
    if (dir === undefined) continue;
    const root = resolve(dir);
    if (!isHarnessRoot(root)) {
      throw new Error(
        `${source === "flag" ? "--harness" : "$CAT_HARNESS_ROOT"} names ${root}, which holds no ` +
          `${HARNESS_NAME}.json declaring name "${HARNESS_NAME}".`,
      );
    }
    return { root, source };
  }

  const sibling = resolve(toolsRoot, "..", HARNESS_NAME);
  if (isHarnessRoot(sibling)) return { root: sibling, source: "sibling" };

  throw new Error(
    `cannot find the harness: no --harness flag, no $CAT_HARNESS_ROOT, and ${sibling} holds no ` +
      `${HARNESS_NAME}.json declaring name "${HARNESS_NAME}". Pass --harness <dir>.`,
  );
}

/**
 * The checkout holding both layers, or `undefined` when there is none.
 *
 * Defined as the common parent when the harness is this layer's sibling. A
 * harness found anywhere else means this layer is standalone, and there is no
 * single directory that is "the repository" for both — so the answer is
 * absent rather than a plausible wrong path.
 */
export function repoRootFor(toolsRoot: string, harnessRoot: string): string | undefined {
  const parent = dirname(resolve(toolsRoot));
  return dirname(resolve(harnessRoot)) === parent ? parent : undefined;
}

const resolved = resolveHarnessRoot();

/** The harness content this layer serves. See the module docblock for the order. */
export const HARNESS_ROOT: string = resolved.root;

/** How {@link HARNESS_ROOT} was found. */
export const HARNESS_ROOT_SOURCE: HarnessRootSource = resolved.source;

/** The checkout holding both layers; `undefined` when this layer is standalone. */
export const REPO_ROOT: string | undefined = repoRootFor(TOOLS_ROOT, HARNESS_ROOT);

// ── The layer being worked on (bean `j3ls`) ──────────────────────────────

/**
 * The machine name `dir` declares, read the way {@link isHarnessRoot} reads the
 * harness's: a `<name>.json` in `dir` whose own `name` is `<name>`. Anything
 * else at that level — `package.json`, `index.config.json`, a lock — names
 * something other than itself and is not a declaration.
 */
export function declaredInstanceName(dir: string): string | undefined {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return undefined;
  }
  for (const f of entries.sort()) {
    if (!f.endsWith(".json")) continue;
    const stem = f.slice(0, -".json".length);
    try {
      if ((JSON.parse(readFileSync(join(dir, f), "utf8")) as { name?: unknown }).name === stem) return stem;
    } catch {
      // Not a declaration; keep looking.
    }
  }
  return undefined;
}

/**
 * The checkout a MOUNTED harness sits in, when that checkout's root declares
 * an instance of its own — else `undefined`.
 *
 * A remote mount is a directory inside somebody's checkout with no `.git` of
 * its own, so the nearest `.git` above the harness is that checkout. A harness
 * that is its own repository (`cat-harness/.git`), a harness beside rather than
 * inside the checkout (the standalone tools repository with a sibling clone),
 * and an index whose root declares nothing all answer `undefined`, and the
 * caller keeps the harness.
 */
export function mountingInstanceRoot(harnessRoot: string): string | undefined {
  let dir = resolve(harnessRoot);
  for (;;) {
    if (existsSync(join(dir, ".git"))) {
      if (dir === resolve(harnessRoot)) return undefined;
      const name = declaredInstanceName(dir);
      return name !== undefined && name !== HARNESS_NAME ? dir : undefined;
    }
    const up = dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}

/** Where the working layer came from — reported, as {@link HarnessRootSource} is. */
export type InstanceRootSource = "flag" | "env" | "mount" | "harness";

export interface InstanceRootInputs {
  /** Command-line arguments to scan for `--instance`. Defaults to `process.argv`. */
  argv?: readonly string[];
  /** Environment to read `CAT_INSTANCE_ROOT` from. Defaults to `process.env`. */
  env?: Readonly<Record<string, string | undefined>>;
  /** The harness the tool serves. Defaults to {@link HARNESS_ROOT}. */
  harnessRoot?: string;
}

/** `--instance <dir>` or `--instance=<dir>`; the last one wins. */
export function instanceFlag(argv: readonly string[]): string | undefined {
  let found: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--instance" && i + 1 < argv.length) found = argv[++i];
    else if (a.startsWith("--instance=")) found = a.slice("--instance=".length);
  }
  return found === "" ? undefined : found;
}

/**
 * The layer a tool is working ON — not the one it was loaded FROM.
 *
 * Every tool here used to answer "this instance" with the harness, which is
 * right in the harness's own repository and in an index checkout, and wrong
 * in a separated layer's repository that remote-mounts the harness: there
 * the harness is somebody else's tree at a pin, gitignored, and a report
 * written into it is lost (bean `j3ls`, measured from a separated content layer). In order:
 *
 * 1. `--instance <dir>` — the caller said so.
 * 2. `$CAT_INSTANCE_ROOT` — the environment said so.
 * 3. The checkout the harness is MOUNTED in, when its root declares a
 *    layer ({@link mountingInstanceRoot}).
 * 4. The harness — every layout this resolver did not change.
 *
 * An explicit root must hold a declaration; a typo throws where it is made
 * rather than reading as an empty layer three calls later.
 *
 * A function, not a constant: `--instance` is parsed here, and a module-level
 * parse would throw in every importer whose own `--instance` means a NAME.
 */
export function resolveWorkingInstanceRoot(inputs: InstanceRootInputs = {}): { root: string; source: InstanceRootSource } {
  const argv = inputs.argv ?? process.argv;
  // input-site: env-unset CAT_INSTANCE_ROOT #861163c1 — names the layer being worked on; unset, it is the layer mounting the harness, else the harness
  const env = inputs.env ?? process.env;
  const harnessRoot = resolve(inputs.harnessRoot ?? HARNESS_ROOT);

  const explicit: Array<[InstanceRootSource, string | undefined]> = [
    ["flag", instanceFlag(argv)],
    ["env", env.CAT_INSTANCE_ROOT || undefined],
  ];
  for (const [source, dir] of explicit) {
    if (dir === undefined) continue;
    const root = resolve(dir);
    if (declaredInstanceName(root) === undefined) {
      throw new Error(
        `${source === "flag" ? "--instance" : "$CAT_INSTANCE_ROOT"} names ${root}, which holds no ` +
          "instance declaration (a `<name>.json` whose `name` is `<name>`).",
      );
    }
    return { root, source };
  }

  const mounting = mountingInstanceRoot(harnessRoot);
  if (mounting !== undefined) return { root: mounting, source: "mount" };
  return { root: harnessRoot, source: "harness" };
}

/**
 * The layer `--instance <dir>` names, validated as
 * {@link resolveWorkingInstanceRoot} validates it — or `undefined` when the
 * flag is absent, so the caller keeps the root it always had.
 *
 * For a tool whose default is its OWN layer and that gains `--instance` as
 * an option: `resolveWorkingInstanceRoot` would also follow
 * `$CAT_INSTANCE_ROOT` and the mounting checkout, which would change what the
 * tool reads when nobody passed the flag.
 */
export function explicitInstanceRoot(argv: readonly string[] = process.argv): string | undefined {
  return instanceFlag(argv) === undefined ? undefined : resolveWorkingInstanceRoot({ argv, env: {} }).root;
}

/**
 * The directory `bun run cat` resolves from: the checkout holding this layer
 * and the harness side by side, else the harness's parent — the one answer
 * every caller gave before {@link REPO_ROOT} existed.
 */
export function runnerRootFor(harnessRoot: string, repoRoot: string | undefined): string {
  return repoRoot ?? resolve(harnessRoot, "..");
}
