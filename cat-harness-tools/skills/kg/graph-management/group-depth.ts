/**
 * The grouping-depth derivation, in a module that can be IMPORTED.
 *
 * @module cat-harness/skills/kg/graph-management/group-depth
 *
 * Kept apart from `kg-detangle.ts`, where the rule is used, so a test can
 * import `groupDepthFor` without loading the detangle script. A test that ran
 * the script would write its sidecars and make `kg:detangle:check` report
 * "current" over any tree. `ROOT` is computed here, not imported from
 * `kg-detangle.ts`, for the same reason; the test pins its decisive cases by
 * VALUE, so a divergence fails rather than hides.
 */
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../../../..");

/**
 * At what path depth this directory NAMES its candidate groups — derived, not
 * tabulated.
 *
 * ## The table this replaces, and why it had to go
 *
 * `SCAN` paired each path with a hardcoded depth, and carried a
 * `declared-path-literal` marker saying so: *"the scan list is REPO-relative and
 * pairs each path with a grouping depth no declaration carries; deriving it is
 * its own change."* This is that change.
 *
 * The cost of the table was not tidiness. The owner's instruction was
 * *"breakdown of large graphes into themed sub=graphs-> sub-dir=named ssubgraph
 * declared by harness"* — and with a hardcoded depth that is only true where the
 * table happens to say 3. Creating `schemas/<theme>/` produced NO new subgraph,
 * because `cat-harness/schemas` was pinned at 2; the same subdirectory under
 * `cat-harness/skills` became one immediately, because that row said 3. One
 * mechanism, two behaviours, decided by a literal.
 *
 * ## The rule, and the measurement it came from
 *
 * A directory names its groups one level DOWN when its nodes live in
 * subdirectories, and at itself when they do not. Measured over the corpus
 * rather than guessed from the name, because the two disagree:
 *
 *     cat-harness/skills        1 node here, 364 nested  -> depth + 1
 *     cat-harness/processes    69 here,        9 nested  -> depth
 *     cat-harness/schemas     182 here,       54 nested  -> depth
 *     bootstrap/skills          9 here,        0 nested  -> depth
 *
 * `bootstrap/skills` is the entry that kills every simpler rule: same graph typology
 * as `cat-harness/skills`, opposite answer, so the depth cannot come from the
 * kind. And `cat-harness/skills` kills "no files at all" — it holds one stray
 * `kg-qa.manifest.json` beside its 21 packages, which is why that file appears
 * as a group of size 1 in the report.
 *
 * Reproduces all eight present `SCAN` depths exactly, which is the point: this
 * is a refactor whose correctness is checkable rather than asserted, and
 * `detangle-group-depth.test.ts` pins it.
 *
 * ## The consequence worth stating, because it is a threshold
 *
 * Majority, not presence. So a PARTIAL carve is invisible: move 50 of
 * `schemas/`'s 182 nodes into themed subdirectories and `here` still exceeds
 * `nested`, so the depth does not flip and the new directories are not yet
 * groups. It flips when most of the nodes have moved.
 *
 * Presence was the alternative and it is worse: `schemas/` already holds 54
 * nested nodes (a published package with its `dist/`) and `processes/` holds 9,
 * neither of them a themed carve, so "any nested node" would promote both today
 * and silently re-group 29 measurements.
 *
 * @param path repo-relative scanned directory
 * @param scanned its corpus, already filtered — passed in rather than re-walked,
 *   so this cannot disagree with what the caller measures, and so the
 *   `node_modules` inflation `qook` records cannot re-enter through a second walk
 */
export function groupDepthFor(path: string, scanned: readonly string[]): number {
  const declared = path.split("/").length;
  const dir = join(ROOT, path);
  let here = 0;
  let nested = 0;
  for (const abs of scanned) {
    if (relative(dir, abs).includes("/")) nested += 1;
    else here += 1;
  }
  return nested > here ? declared + 1 : declared;
}
