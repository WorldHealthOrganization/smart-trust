/**
 * ONE selector for "did this generator write this page, HERE?".
 *
 * A generator that writes and never deletes leaves a page serving a subject
 * the declaration no longer describes, at a URL nothing links to. `--check`
 * cannot see it: it inspects only the files it is about to write, so it finds
 * a page that is WRONG and never one that SHOULD NOT EXIST. Use this rather
 * than writing another selector.
 *
 * ## What is parameterised, and what is not
 *
 * The **ownership test** is the parameter. The **unit** is not: this walks
 * directories that hold an `index.html`, full stop. Selectors over flat files
 * (`prunableStickies` over `.json` files, the IRIS replica's
 * `OWNED`/`OWNED_LIB`/`OWNED_DOCS` over filenames) are a different unit and
 * stay outside it; widening the unit is a design step of its own.
 *
 * ## The rules it applies
 *
 * - A non-owned directory is **`foreign`** — a third state, listed and left
 *   alone, never dropped silently.
 * - An unreadable page is **not ours**, because a file we cannot read is one
 *   we cannot prove we wrote; it is reported, never thrown on.
 *
 * Its callers are `orphanSubjectPages` and `prunableDashboards`.
 *
 * @module scripts/orphan-pages
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The line a generated viewer page uses to say WHICH SUBJECT it is for.
 *
 * `viewerHtml` in `gen-schema-viz.ts` emits it into every page it writes, so
 * a page carries its own identity rather than borrowing one from the
 * directory it sits in. That is what makes pruning safe: ownership is read
 * off the file. It moved here with the selector that reads it, rather than
 * being left behind as a constant nothing used.
 */
const SCOPE_LINE = /^var SCOPE = "([^"]*)";$/m;

/**
 * Does this page belong to this generator, at this location?
 *
 * Takes the page's CONTENT and the name of the directory holding it. Both
 * arguments matter: a marker answers *did I write this*, while the directory
 * name is what lets a test also answer *did I write it HERE*.
 */
export type OwnershipTest = (content: string, dirName: string) => boolean;

/**
 * The default, and the strongest of the tests in use.
 *
 * The page must name ITSELF: `var SCOPE = "<dirname>";` where `<dirname>` is
 * the directory it sits in. A page whose `SCOPE` says something else is one
 * this generator did not write *for this location*, and guessing is exactly
 * what the scoping rule exists to stop. It needs no extra bytes in the page
 * and it catches a case a bare marker cannot see at all.
 */
export const declaresItsOwnDirectory: OwnershipTest = (content, dirName) => {
  const m = SCOPE_LINE.exec(content);
  return m !== null && m[1] === dirName;
};

/**
 * A marker naming the generator, for pages that carry no scope line.
 *
 * Weaker than {@link declaresItsOwnDirectory} and the right answer where the
 * stronger test cannot apply: state dashboards publish at the SITE ROOT among
 * directories nothing here owns, and their identity is the graph id rather
 * than the path, so there is no self-naming for a page to do.
 */
export function carriesMarker(marker: string): OwnershipTest {
  return (content) => content.includes(marker);
}

/**
 * Split the directories under `parentPageDir` into ours and everything else.
 *
 * `deletion-requires-confirmation` is about artefacts an agent did not
 * create, so "everything under `parentPageDir` that is not wanted" would be
 * the wrong rule — it would delete a page somebody hand-added. A directory is
 * `owned` only when its `index.html` passes `owns`. Anything else is returned
 * as `foreign`, so a caller can REPORT it rather than act on it.
 *
 * `foreign` is a third state and not a rounding of "no": a directory with no
 * `index.html`, one whose page fails the test, and one that cannot be read
 * are all cases this tool declined to claim, and none of them is a clean
 * examination that found nothing.
 */
export function orphanSubjectPages(
  parentPageDir: string,
  wanted: readonly string[],
  owns: OwnershipTest = declaresItsOwnDirectory,
): { owned: string[]; foreign: string[] } {
  if (!existsSync(parentPageDir)) return { owned: [], foreign: [] };
  const keep = new Set(wanted);
  const owned: string[] = [];
  const foreign: string[] = [];

  for (const e of readdirSync(parentPageDir, { withFileTypes: true })) {
    if (!e.isDirectory() || keep.has(e.name)) continue;
    const page = join(parentPageDir, e.name, "index.html");
    if (!existsSync(page)) {
      foreign.push(e.name);
      continue;
    }
    let content: string;
    try {
      content = readFileSync(page, "utf-8");
    } catch {
      // UNREADABLE IS NOT OURS, and it is not an error either. A file we
      // cannot read is a file we cannot prove we wrote, and the safe answer
      // is to leave it and say so. Reading bare here would abort a whole
      // generator over one unreadable page.
      foreign.push(e.name);
      continue;
    }
    if (owns(content, e.name)) owned.push(e.name);
    else foreign.push(e.name);
  }
  return { owned: owned.sort(), foreign: foreign.sort() };
}
