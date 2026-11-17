/**
 * Content-repo root resolution for pipeline code.
 *
 * The pipeline lives in **folio-assistant** but operates on a downstream
 * *content* repo (e.g. `qou`), which embeds folio-assistant as a symlinked
 * subdirectory.  Computing the root as `resolve(HARNESS_ROOT)`
 * therefore lands inside folio-assistant's own tree — *not* the content repo
 * — so witness files under `<content-repo>/computations/…` and
 * `<content-repo>/content/<paper>/…` can never be resolved.
 *
 * Instead, walk up from the current working directory (which, for every
 * pipeline invocation, is the content repo) until we find the directory that
 * contains both `computations/` and `content/`.  Fall back to the old
 * import-relative guess if the walk fails (e.g. unusual harnesses), so behaviour
 * never regresses below the previous baseline.
 *
 * @module pipeline/repo-root
 */

// The `folio` graph typology is registered by CORE. This module is a LIBRARY, so it
// does NOT import that registration: a library's edge is inherited by every
// module that imports it, and the harness may not depend on core. The
// COMMAND that runs carries it — and since #840 every caller does, because
// the trigger sits at the foot of `cat-harness.ts` and a reader lives in that
// module, so loading it is a precondition of calling one.
//
// THIS COMMENT NAMED `check:composition-roots` AS THE GUARANTEE UNTIL
// 2026-09-22, in SEVEN files, AND THAT SCRIPT DOES NOT EXIST. `bun run
// check:composition-roots` exits "Script not found". The safety argument for
// a library omitting the registration rested on a gate nobody built, and no
// gate failed to say so — the same silence this repository keeps paying for.
// It is moot now rather than fixed: #840 made the registration automatic, so
// there is no longer a command that can forget it (bean `z9ax`).
import { folioDir } from "../schemas/kg/cat-harness.js";
import { existsSync, readdirSync, statSync } from "fs";
import { dirname, join, resolve } from "path";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

/**
 * Locate the content-repo root by walking up from `process.cwd()`.
 *
 * Two passes, because `computations/` is NOT universal — it is a
 * convention of folios that carry Python computation witnesses. A paper
 * folio with no computations, or a WHO SMART Guidelines folio, has only
 * `content/`. Requiring both made this resolver silently return the
 * folio-assistant tree for such repos, which is how "platform, not
 * content" leaks: every pipeline script then reads the wrong root.
 *
 * 1. Prefer an ancestor with BOTH `computations/` and `content/` — the
 *    strongest signal, and it keeps behaviour identical for folios that
 *    have both.
 * 2. Otherwise accept the nearest ancestor with `content/`.
 *
 * The first pass runs to completion before the second, so a nested
 * `content/` directory cannot shadow a true root further up.
 */
export function findContentRepoRoot(): string {
  const ancestors: string[] = [];
  let dir = process.cwd();
  for (let i = 0; i < 12 && dir !== dirname(dir); i++) {
    ancestors.push(dir);
    dir = dirname(dir);
  }
  // A CANDIDATE THAT CANNOT BE READ IS NOT A MATCH, AND NOT A CRASH. `folioDir`
  // resolves through the layer's declaration and THROWS when it will not
  // parse — which became reachable here on 2026-09-21: `harness.json` was
  // excised, so a corrupt config is now a corrupt DECLARATION too, and one
  // unreadable ancestor took down an entire `qa-sweep` that was not about it.
  //
  // This is a SEARCH. Skipping a candidate it cannot read is the same answer
  // as skipping one that has no folio directory, and the function already ends
  // in a declared fallback — so nothing is silently guessed that was not
  // already being guessed.
  const folioDirOf = (d: string): string | undefined => {
    try {
      return folioDir(d);
    } catch {
      return undefined;
    }
  };
  for (const d of ancestors) {
    const f = folioDirOf(d);
    if (f !== undefined && existsSync(join(d, "computations")) && existsSync(f)) return d;
  }
  for (const d of ancestors) {
    const f = folioDirOf(d);
    if (f !== undefined && existsSync(f)) return d;
  }
  // Fallback: import-relative heuristic (two levels up from
  // pipeline/). Preserves behaviour when the walk-up finds nothing.
  return resolve(HARNESS_ROOT);
}

/**
 * The root whose declaration lists the folio's DEPENDENCIES, i.e. where
 * `loadContributions` must start.
 *
 * Contributions (checkers, tools) come from what the FOLIO declares, so the
 * answer is normally `findContentRepoRoot()`. But that falls back to this
 * platform's own `cat-harness/` when no ancestor holds a folio, as in the
 * platform's own repository, and `cat-harness/` declares no dependencies.
 * Loading from there registers nothing, which is indistinguishable from
 * "nothing to contribute". In that case the layer actually running is the
 * repository root above it, so that is returned.
 *
 * Measured 2026-09-29 (folio-assistant#1492): qa-sweep loaded from
 * `cat-harness/` and registered 0 contributed checkers, so
 * the contributed `proof-compile-cost` and `proof-no-cost-regression`
 * never ran in a real sweep, while `qa-checker-discovery.test.ts`, which
 * loads from the repository root, found both.
 */
export function contributionsRoot(): string {
  const platformInstance = resolve(HARNESS_ROOT);
  const folioRoot = findContentRepoRoot();
  return folioRoot === platformInstance ? resolve(platformInstance, "..") : folioRoot;
}

/**
 * Discover the folio's papers: directories under `content/` that carry a
 * same-named manifest (`content/<paper>/<paper>.ts`).
 *
 * Exists so pipeline code stops hardcoding a paper directory. A folio
 * may hold several papers, and the platform must not privilege one of
 * them — see `beans/` and `docs/proposals/` for the portability work.
 *
 * Returns directory names (not paths), sorted, so callers can join them
 * onto their own root.
 */
export function findPapers(repoRoot?: string): string[] {
  const root = repoRoot ?? findContentRepoRoot();
  const folioRoot = folioDir(root);
  if (!existsSync(folioRoot)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(folioRoot)) {
    if (entry.startsWith(".")) continue;
    const d = join(folioRoot, entry);
    try {
      if (!statSync(d).isDirectory()) continue;
    } catch {
      continue;
    }
    if (existsSync(join(d, `${entry}.ts`))) out.push(entry);
  }
  return out.sort();
}

/**
 * The single paper of a one-paper folio.
 *
 * Returns `undefined` when the folio has zero or several papers —
 * callers must then take the paper as an explicit argument rather than
 * guess. Guessing is what produced the hardcoded paper names this
 * helper replaces.
 */
export function soleFolioPaper(repoRoot?: string): string | undefined {
  const papers = findPapers(repoRoot);
  return papers.length === 1 ? papers[0] : undefined;
}

/**
 * The paper to operate on: an explicit name if given, else the folio's sole
 * paper.
 *
 * Throws — with the folio's actual contents in the message — when there is no
 * unambiguous answer. That is the point: the hardcoded
 * `"quantum-observable-universe"` defaults this replaces did not fail when the
 * folio was absent or held a different paper, they silently pointed at a
 * directory that was not there, and the caller reported a clean run over
 * nothing.
 */
export function requirePaper(explicit?: string, repoRoot?: string): string {
  if (explicit) return explicit;
  const root = repoRoot ?? findContentRepoRoot();
  const sole = soleFolioPaper(root);
  if (sole) return sole;
  const papers = findPapers(root);
  throw new Error(
    papers.length === 0
      ? `No paper found under ${folioDir(root)}. folio-assistant is the ` +
        `PLATFORM; papers live in a folio. Run this from the content repo, or ` +
        `name a paper explicitly.`
      : `${papers.length} papers found (${papers.join(", ")}) — name one explicitly.`,
  );
}
