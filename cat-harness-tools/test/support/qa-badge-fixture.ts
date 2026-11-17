/**
 * Derive a badge e2e fixture from the GENERATED page, without inheriting the
 * corpus's verdict.
 *
 * @module test/support/qa-badge-fixture
 *
 * ## Two rules, pulling in opposite directions
 *
 * **Shape is worth reading from disk.** A hand-written `<button class="fa-qa-badge …">`
 * can agree with `docs-ui.js` while `docs-ui.js` disagrees with what
 * `gen-docs-pages.ts` really emits — which is how a badge ships broken with a
 * green suite. So the markup here is lifted verbatim out of `docs/<page>.md`.
 *
 * **A verdict is not.** `test/support/qa-fixture.ts` already records what
 * happens otherwise: `qa-panel.e2e.ts` read a sidecar straight off disk, #302
 * correctly adjudicated the failure it asserted on, and `main` went red
 * because the CONTENT got better. That is bean `d2kp`'s own subject one level
 * down, and reintroducing it in the tests for the fix would be a poor joke.
 *
 * So: markup off disk, index rows set by the caller, and **throw by name** if
 * a node the spec addresses has left the page. Defaulting the other way is the
 * failure mode — every assertion downstream would silently test whichever
 * badge happened to be first.
 */

import { readFileSync } from "node:fs";

/** One row of a `folio-qa-index/v1` document. */
export interface QaIndexRow {
  state: string;
  counts: { fail: number; warn: number; pass: number; na: number; unknown: number };
}

/**
 * The `<span class="fa-qa-badges">…</span>` run for one node, as generated.
 *
 * Liquid is resolved the way Jekyll resolves it with an empty `baseurl`:
 * `{{ '/assets/qa/x.json' | relative_url }}` becomes `/assets/qa/x.json`. That
 * substitution is the ONLY edit made to the markup — everything else, including
 * the `pending` class and `aria-busy`, is what a reader's browser receives.
 *
 * @throws if the page holds no badge run for `nodeKey`.
 */
export function badgeRunFor(pageMd: string, nodeKey: string): string {
  // Taken to END OF LINE rather than matched to a closing tag. The generator
  // emits the whole run on one line, and a tag match would have to count nested
  // `</span>`s — which differ between a node carrying one badge and one
  // carrying two, and got this helper wrong on its first draft.
  for (const line of readFileSync(pageMd, "utf8").split("\n")) {
    const at = line.indexOf('<span class="fa-qa-badges">');
    if (at === -1) continue;
    const run = line.slice(at).trimEnd();
    if (run.includes(`data-qa-key="${nodeKey}"`)) {
      return run.replace(/\{\{\s*'([^']+)'\s*\|\s*relative_url\s*\}\}/g, "$1");
    }
  }
  throw new Error(
    `${pageMd} has no badge for node key "${nodeKey}". ` +
      `The node was renamed or its sidecar went away — fix the spec rather than ` +
      `letting it assert against whichever badge sorts first.`,
  );
}

/**
 * The verdict index a generated badge run fetches, as the page names it
 * (`data-qa-index`), so a spec routes the URL the markup really asks for
 * rather than one spelled beside it. A page's index moves with the page: one
 * above the base is at `/assets/qa/<instance>/<page>/qa-index.json`.
 *
 * @throws if the run names no index, or more than one.
 */
export function indexUrlOf(run: string): string {
  const urls = [...new Set([...run.matchAll(/data-qa-index="([^"]+)"/g)].map((m) => m[1]!))];
  if (urls.length !== 1) {
    throw new Error(`a badge run names ${urls.length} verdict indexes (${urls.join(", ")}); expected exactly one`);
  }
  return urls[0]!;
}

/**
 * The page's real verdict index, with named rows replaced or removed.
 *
 * `null` REMOVES the row, which is how a spec reaches "could not determine at
 * the row level" — the index loaded, and it has nothing to say about this
 * badge. Distinct from the index failing to load at all, and the painter
 * renders both as `unknown` on purpose.
 *
 * @throws if a key being overridden is not in the index already.
 */
export function indexWithRows(
  indexPath: string,
  rows: Record<string, QaIndexRow | null>,
): string {
  const doc = JSON.parse(readFileSync(indexPath, "utf8")) as {
    badges: Record<string, QaIndexRow>;
  };
  for (const key of Object.keys(rows)) {
    if (!(key in doc.badges)) {
      throw new Error(
        `${indexPath} has no row for "${key}" — the subject lost its sidecar, ` +
          `so this spec is no longer testing what it names.`,
      );
    }
    const row = rows[key];
    if (row === null) delete doc.badges[key];
    else doc.badges[key] = row;
  }
  return JSON.stringify(doc);
}
