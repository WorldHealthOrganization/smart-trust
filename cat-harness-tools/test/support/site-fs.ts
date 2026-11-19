/**
 * The four `node:fs` reads an end-to-end spec makes of a site, through the
 * layer overlay (bean `cat-tools-sm8r`, item 4).
 *
 * In a composed checkout a mounted layer's computed files (`_data/harness.json`,
 * `assets/library/index.json`, generated pages, …) are written at its output
 * root, `build/layers/<instance>/…`, never into the pinned mount. A spec that
 * reads the site by its layer path must therefore read the output-root copy
 * when there is one, and the pinned bytes otherwise. These are drop-in
 * replacements for `node:fs`'s own: a path outside any mount, or in a layer's
 * own checkout, resolves to itself, so nothing changes there.
 */
import * as fs from "node:fs";

import { join } from "node:path";

import { overlayDirs, overlayPath } from "../../scripts/lib/layer-output.ts";
import { siteFileFor, siteLayersFor } from "../../schemas/kg/cat-harness.ts";

/** `fs.readFileSync`, reading the copy a reader of the site sees. */
export const readFileSync = ((path: fs.PathOrFileDescriptor, ...rest: unknown[]) =>
  (fs.readFileSync as (...a: unknown[]) => unknown)(typeof path === "string" ? overlayPath(path) : path, ...rest)) as typeof fs.readFileSync;

/** `fs.existsSync`: true when the output root or the layer itself holds `path`. */
export const existsSync = ((path: fs.PathLike) =>
  fs.existsSync(typeof path === "string" ? overlayPath(path) : path)) as typeof fs.existsSync;

/** `fs.statSync` of the copy a reader of the site sees: the output root's when it holds `path`. */
export const statSync = ((path: fs.PathLike, ...rest: unknown[]) =>
  (fs.statSync as (...a: unknown[]) => unknown)(typeof path === "string" ? overlayPath(path) : path, ...rest)) as typeof fs.statSync;

/**
 * `fs.readdirSync` over the overlay: the union of the output-root directory
 * and the layer's own, output root first, each name once. With neither
 * present it is `fs.readdirSync(path)`, which throws as it always has.
 */
export const readdirSync = ((path: fs.PathLike, options?: unknown) => {
  const dirs = typeof path === "string" ? overlayDirs(path) : [];
  if (dirs.length <= 1) return (fs.readdirSync as (...a: unknown[]) => unknown)(dirs[0] ?? path, options);
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const d of dirs) {
    for (const e of (fs.readdirSync as (...a: unknown[]) => unknown[])(d, options)) {
      const name = typeof e === "string" ? e : (e as fs.Dirent).name;
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(e);
    }
  }
  return out;
}) as typeof fs.readdirSync;

/**
 * Lay `src` at `dest` as symlinks, over the overlay: a file, or a directory
 * only one side holds, is one link; a directory both sides hold becomes a
 * real directory whose entries are linked the same way, the output root's
 * copy winning. A spec that serves a site from a scratch directory sees
 * exactly what a reader of the site would.
 */
export function linkOverlay(src: string, dest: string): void {
  const dirs = overlayDirs(src);
  if (dirs.length <= 1 || !fs.statSync(dirs[0]!).isDirectory()) {
    fs.symlinkSync(overlayPath(src), dest);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src) as string[]) linkOverlay(`${src}/${name}`, `${dest}/${name}`);
}

/**
 * `siteFileFor` over the overlay: the site-relative path of `rel` in the
 * highest site layer that holds it, at the layer's output root or in the layer
 * itself. `siteFileFor` asks only the pinned mounts, so a file only the output
 * root holds (`assets/beans/count.json`) resolved to the base layer and was
 * read from where nothing writes it.
 */
export function siteFileAt(root: string, rel: string): string {
  const layers = siteLayersFor(root);
  for (let i = layers.length - 1; i >= 0; i--) {
    if (fs.existsSync(overlayPath(join(root, layers[i]!, rel)))) return join(layers[i]!, rel);
  }
  return siteFileFor(root, rel);
}
