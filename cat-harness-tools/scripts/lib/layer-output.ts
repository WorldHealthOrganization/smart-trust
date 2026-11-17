/**
 * Where a step writes, and reads back, a file it COMPUTES for a layer: one
 * output root per layer, outside the mounts.
 *
 * @module scripts/lib/layer-output
 * @graphNode none — a path resolver every writer of a layer's computed files calls
 *
 * Owner ruling on bean `cat-tools-sm8r`, item 4 ("no CI step writes inside a
 * mount"), planned in the bean before any code. A mounted layer is
 * READ-ONLY in a checkout that mounts it: its directory holds the pinned
 * bytes and nothing else, so `mount-from-lock.sh --check` stays `current`
 * after a local gate run, and no later `state:mount` refuses an "edited"
 * mount. Measured 2026-11-06: earlier jobs' writers (the IG index, the QA
 * working copy, glossary pages, the docs) wrote into every mounted layer and
 * reddened all eight `state:mount` steps of a local run.
 *
 * ## The rule
 *
 * - A **mounted** layer (one the checkout's `index.lock.json` lists with a
 *   mount path): its computed files go under
 *   `build/layers/<instance>/<the same instance-relative path>`.
 * - A **local** layer (the checkout's own, `source.local`): its computed
 *   files go where they always have, inside the layer. A layer building
 *   itself changes nothing.
 *
 * Reading is an OVERLAY: the output root when the file is there, else the
 * layer's own path, which for a mount is the pinned bytes.
 *
 * Nothing else may join a layer path to a computed file; the write-site
 * check that enforces that is plan step 1's second half.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { inputSiteReached } from "../../schemas/sdlc/input-trace.js";

/** The directory, under the checkout root, that holds every mounted layer's computed files. */
// input-site: inert #ccbbe842 — names where a writer WRITES; the one read of it, in readPathFor, reports itself to the input trace
export const LAYER_OUTPUT_ROOT = "build/layers";

/** The parts of an `index.lock.json` layer entry this module reads. */
interface LockInstance {
  instance: string;
  path?: string;
}

/**
 * The checkout's MOUNTED layers, as `instance → mount path` (relative to
 * the root). Read from `index.lock.json`; a checkout with no lock mounts
 * nothing, so the map is empty and every layer is local.
 *
 * Throws on a lock that is present but does not parse: treating an
 * unreadable lock as "nothing mounted" would send every write into the
 * mounts, the very thing this module exists to stop.
 */
export function mountedInstances(root: string): Map<string, string> {
  const file = join(resolve(root), "index.lock.json");
  const out = new Map<string, string>();
  if (!existsSync(file)) return out;
  let lock: { instances?: LockInstance[] };
  try {
    lock = JSON.parse(readFileSync(file, "utf-8")) as typeof lock;
  } catch (e) {
    throw new Error(`${file} does not parse, so which instances are mounted cannot be determined: ${String(e)}`);
  }
  for (const i of lock.instances ?? []) {
    if (typeof i.instance === "string" && typeof i.path === "string" && i.path !== "") out.set(i.instance, i.path);
  }
  return out;
}

/** One layer as a writer names it: its name, and its path in the checkout (relative to the root). */
export interface LayerRef {
  instance: string;
  /** Where the layer's files are in the checkout: its mount path, or the local layer's directory ("" or "." for the root). */
  path: string;
}

/**
 * Where a writer writes `rel` (instance-relative) for `layer`: under
 * {@link LAYER_OUTPUT_ROOT} when the layer is mounted, else inside the
 * layer. Pass `mounted` to avoid re-reading the lock in a loop.
 */
export function outputPathFor(root: string, layer: LayerRef, rel: string, mounted: Map<string, string> = mountedInstances(root)): string {
  const r = resolve(root);
  return mounted.has(layer.instance) ? join(r, LAYER_OUTPUT_ROOT, layer.instance, rel) : join(r, layer.path, rel);
}

/**
 * Where a reader reads `rel` for `layer`: the output root when a writer put
 * the file there, else the layer's own path (for a mount, the pinned bytes).
 */
export function readPathFor(root: string, layer: LayerRef, rel: string, mounted: Map<string, string> = mountedInstances(root)): string {
  const computed = outputPathFor(root, layer, rel, mounted);
  // A computed file is build output, which the tree digest leaves out, so a
  // check that reads one cannot be skipped on its fingerprint.
  if (mounted.has(layer.instance)) inputSiteReached(`layer-output: ${layer.instance}/${rel}`);
  return existsSync(computed) ? computed : join(resolve(root), layer.path, rel);
}

/**
 * The output-root twin of an ABSOLUTE path inside the checkout: where a
 * writer puts the computed file a reader would otherwise find at `abs`.
 * `undefined` when `abs` is in no mounted layer (a local layer's computed
 * files are its own path). For a reader that holds a resolved path (a
 * declared directory's `absPath`) rather than a layer and a relative path.
 * The longest mount path that holds `abs` wins, so a mount nested in another
 * resolves to its own layer.
 */
export function outputTwinOf(root: string, abs: string, mounted: Map<string, string> = mountedInstances(root)): string | undefined {
  const r = resolve(root);
  const rel = relative(r, resolve(abs)).split(sep).join("/");
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return undefined;
  let best: { instance: string; path: string } | undefined;
  for (const [instance, p] of mounted) {
    const path = p.replace(/^\.\/|\/+$/g, "");
    if (path === "" || !(rel === path || rel.startsWith(`${path}/`))) continue;
    if (best === undefined || path.length > best.path.length) best = { instance, path };
  }
  if (best === undefined) return undefined;
  return outputPathFor(r, best, rel.slice(best.path.length + 1), mounted);
}

/**
 * {@link readPathFor} for an ABSOLUTE path: the output-root twin when a
 * writer put the file (or directory) there, else `abs` itself. Changes
 * nothing while no writer writes under {@link LAYER_OUTPUT_ROOT}.
 */
export function readPathAt(root: string, abs: string, mounted: Map<string, string> = mountedInstances(root)): string {
  const twin = outputTwinOf(root, abs, mounted);
  if (twin === undefined) return abs;
  inputSiteReached(`layer-output: ${relative(resolve(root), twin).split(sep).join("/")}`);
  return existsSync(twin) ? twin : abs;
}

/** Per-root cache of {@link mountedInstances}: a reader asks per file, and the lock does not change during a run. */
const mountedCache = new Map<string, Map<string, string>>();

/** {@link mountedInstances}, read once per root per process. */
export function mountedInstancesCached(root: string): Map<string, string> {
  const r = resolve(root);
  let m = mountedCache.get(r);
  if (m === undefined) {
    m = mountedInstances(r);
    mountedCache.set(r, m);
  }
  return m;
}

/** Forget every cached lock read: for a test that writes a lock between reads. */
export function clearMountedCache(): void {
  mountedCache.clear();
}

/**
 * The checkout a reader with only an absolute path stands in: the nearest
 * directory at or above `cwd` that holds a `.git` entry. Commands run from
 * the checkout root (`bun run cat …`), and a mount carries no `.git` (its
 * bytes are laid down from the lock), so this is the composed checkout, never
 * a mount that happens to carry an `index.lock.json` of its own. `undefined`
 * outside a checkout, where nothing is mounted.
 */
const checkouts = new Map<string, string | undefined>();
export function checkoutRoot(cwd: string = process.cwd()): string | undefined {
  if (checkouts.has(cwd)) return checkouts.get(cwd);
  let found: string | undefined;
  for (let d = resolve(cwd); ; d = dirname(d)) {
    if (existsSync(join(d, ".git"))) {
      found = d;
      break;
    }
    if (dirname(d) === d) break;
  }
  checkouts.set(cwd, found);
  return found;
}

/**
 * {@link readPathAt} for a reader that holds only an absolute path: the
 * output-root twin when a writer put the file there, else `abs`. `root` is
 * the checkout; by default the one the working directory is in. Outside a
 * checkout, or for a path in no mounted layer, it is `abs` unchanged, so a
 * reader moved onto it reads exactly what it read before until a writer
 * writes under {@link LAYER_OUTPUT_ROOT}.
 */
export function overlayPath(abs: string, root: string | undefined = checkoutRoot()): string {
  if (root === undefined) return abs;
  let mounted: Map<string, string>;
  try {
    mounted = mountedInstancesCached(root);
  } catch {
    // An unparseable lock: a READER falls back to the pinned bytes. Only a
    // writer must refuse it (see mountedInstances).
    return abs;
  }
  if (mounted.size === 0) return abs;
  return readPathAt(root, abs, mounted);
}

/**
 * Where a WRITER writes the computed file a reader finds at `abs`: its
 * output-root twin when `abs` is in a mounted layer of `root`, else `abs`.
 * `root` defaults to the checkout this process runs in; an explicit
 * `undefined` means "no checkout", so `abs` is returned as is. Unlike a
 * reader, a writer refuses an unparseable lock (see {@link mountedInstances}):
 * reading it as "nothing mounted" would write into the mounts.
 */
export function writePathOf(abs: string, root?: string): string {
  const at = arguments.length < 2 ? checkoutRoot() : root;
  if (at === undefined) return abs;
  const mounted = mountedInstancesCached(at);
  return mounted.size === 0 ? abs : (outputTwinOf(at, abs, mounted) ?? abs);
}

/**
 * {@link writePathOf} for a writer that already holds its checkout `root`
 * (and, optionally, the mounts it read): where it writes `abs`.
 */
export function writePathAt(root: string, abs: string, mounted: Map<string, string> = mountedInstances(root)): string {
  if (mounted.size === 0) return abs;
  return outputTwinOf(root, abs, mounted) ?? abs;
}

/**
 * The directories a reader LISTS for the directory it knows as `abs`: the
 * output-root twin first, then `abs` itself, each only if it exists. A
 * directory reader walks both and lets the first hold a relative path win,
 * which is the union {@link readPathAt} gives file by file.
 */
export function overlayDirs(abs: string, root: string | undefined = checkoutRoot()): string[] {
  let twin: string | undefined;
  if (root !== undefined) {
    try {
      const mounted = mountedInstancesCached(root);
      twin = mounted.size ? outputTwinOf(root, abs, mounted) : undefined;
    } catch {
      twin = undefined;
    }
  }
  return [twin, abs].filter((d): d is string => d !== undefined && existsSync(d));
}
