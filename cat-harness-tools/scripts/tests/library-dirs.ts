/**
 * Where the declared libraries are, for tests that assert about the REAL
 * corpus rather than a fixture.
 *
 * ## Why this exists
 *
 * Bean `frs5` moved the four library entries out of `cat-harness/library/`
 * into `who-iris/library/` and `folio-assistant-sci/library/`, and twenty-three
 * tests broke — every one of them because it had composed the path instead of
 * reading the declaration. They were not wrong to assert about the real
 * corpus; that is the point of those tests, and a fixture cannot make the
 * claim they make. They were wrong to believe they knew where it was.
 *
 * Composing it once here is not the same as composing it twenty-three times:
 * this reads `harness.json` and follows the next move on its own.
 *
 * @module scripts/tests/library-dirs
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
// The CORPUS (placement PR0, bean `ejye`): the libraries the platform once
// mirrored are asked of the checkout now.
import { corpusDirectoriesForGraph as directoriesForGraph } from "../../schemas/kg/harness-config.js";
import { libraryEntryDirs } from "../lib/library-entry-graphs.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

/** The layer root these helpers resolve against: `cat-harness`. */
export const INSTANCE = resolve(HARNESS_ROOT);

/** Every declared library directory, absolute. Empty when none is declared. */
export function libraryDirs(root: string = INSTANCE): string[] {
  return directoriesForGraph(root, "library").filter((d) => existsSync(d));
}

/**
 * Every ingested document, as `{ slug, dir }` across every declared library.
 *
 * A slug alone stopped locating a document when `library` gained a second
 * home, so this returns the directory with it rather than leaving each caller
 * to rebuild one.
 */
export function libraryEntries(root: string = INSTANCE): Array<{ slug: string; dir: string }> {
  const out: Array<{ slug: string; dir: string }> = [];
  // Flat or filed in a concern group (`library/<group>/<slug>/`, bean `6fez`):
  // the same walk the readers make, so a test cannot see a different corpus.
  for (const lib of libraryDirs(root)) {
    for (const { slug, dir } of libraryEntryDirs(lib)) out.push({ slug, dir });
  }
  return out;
}

/**
 * One named document's directory, or `undefined`.
 *
 * Returns `undefined` rather than throwing so a caller can state its own
 * reason — "this test would be vacuous without it" reads better at the
 * assertion than a stack trace from in here.
 */
export function libraryEntry(slug: string, root: string = INSTANCE): string | undefined {
  return libraryEntries(root).find((e) => e.slug === slug)?.dir;
}
