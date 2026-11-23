/**
 * Where the cat-harness layer lives: the directory holding `cat-harness.json`.
 *
 * Schema modules that need cat-harness's data files (`code-lists/`,
 * `test/fixtures/`, the declaration) cannot find them by walking up from
 * their own file, since they live in cat-harness-tools. This is the one place
 * that says where the harness is.
 *
 * Tried in order:
 *
 * 1. `CAT_HARNESS_ROOT`, for a checkout laid out some other way.
 * 2. A `cat-harness/` directory beside this repository.
 * 3. The `@litlfred/cat-harness` package, as a composed index links it.
 *
 * The sibling comes before the package: in a composed index they are the same
 * directory, and where they differ (the standalone rehearsal,
 * `probeStandalone`, links the index's `node_modules` beside a scratch
 * closure) the package resolves to the wrong cat-harness.
 *
 * Does not throw at import: a module that only needs the harness for one
 * function should still load where the harness is absent.
 *
 * @graphNode none — functions that locate the harness instance; no schema
 * @module schemas/harness-root
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let cached: string | undefined | null = null;

/** The cat-harness layer root, or `undefined` when none can be found. */
export function harnessRoot(): string | undefined {
  if (cached !== null) return cached;
  // input-site: env-unset CAT_HARNESS_ROOT #5f5eb0bf — an override naming a cat-harness root outside the checkout; unset in CI
  const env = process.env.CAT_HARNESS_ROOT;
  if (env && existsSync(join(env, "cat-harness.json"))) return (cached = resolve(env));
  const here = dirname(fileURLToPath(import.meta.url));
  const sibling = resolve(here, "..", "..", "cat-harness");
  if (existsSync(join(sibling, "cat-harness.json"))) return (cached = sibling);
  try {
    const p = createRequire(import.meta.url).resolve("@litlfred/cat-harness/cat-harness.json");
    return (cached = dirname(p));
  } catch {
    // not linked as a package
  }
  return (cached = undefined);
}

/** Like {@link harnessRoot}, but throws naming what was tried. */
export function requireHarnessRoot(): string {
  const r = harnessRoot();
  if (!r) {
    throw new Error(
      "cannot find the cat-harness instance: set CAT_HARNESS_ROOT, link @litlfred/cat-harness, or check it out beside cat-harness-tools",
    );
  }
  return r;
}
