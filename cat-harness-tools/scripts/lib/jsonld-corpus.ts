/**
 * The corpus of `.jsonld` documents in a checkout — read by
 * `gen-instance-contexts` and `check-content-keys` (bean
 * `folio-assistant-63q4`).
 *
 * It lived in `check-context-emission.ts`, which the per-instance contexts
 * replaced and which is now retired; the corpus it read stays here.
 *
 * @module scripts/lib/jsonld-corpus
 * @covers schemas
 */
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { gitCorpus } from "../../schemas/sdlc/git-corpus.ts";

/** The checkout this layer sits in: `scripts/lib/` → `scripts/` → the layer → the checkout. */
const REPO = resolve(import.meta.dir, "..", "..", "..");

/**
 * Every `.jsonld` document in the REPOSITORY — asked of git, not of the disk.
 *
 * **The corpus of a repository is what git says it is.** Bean `ramz`: this
 * walked the filesystem behind a hand-written denylist
 * (`node_modules`, `_kg`, `_site`, `_docs`, `.git`) and therefore swept every
 * gitignored path the list did not happen to name. On 2026-09-25 a clean
 * checkout of `main` failed `bun test` on **145 documents** under
 * `cat-harness/ingest-staging/` — gitignored, untracked, residue of one
 * machine's ingestion five days earlier. The assertion is named *"the real
 * corpus"*, and what it read was not the repository's.
 *
 * Two failures in one, and the second is the worse: a denylist is wrong
 * whenever somebody adds an ignored directory it does not name (a false
 * finding about code the contributor did not touch), and it cannot tell
 * anybody WHICH set it read, so a pass over the wrong corpus reads exactly
 * like a pass over the right one.
 *
 * `--cached --others --exclude-standard` is tracked files PLUS untracked ones
 * git would not ignore. Not `--cached` alone: a `.jsonld` a contributor has
 * just written and not yet staged is part of the change under test, and a
 * check that cannot see it passes on the file it exists to examine.
 *
 * The git half is `gitCorpus`, shared rather than restated: `xd1g` counted 11
 * scanners here walking a root with no gitignore awareness and said the rule
 * wants stating once. It was copied a second time within a day of being
 * written (bean `rsi6`, `check-subgraphs`), which settled the question.
 *
 * **Falls back to the walk, and says so**, when `repo` is not a git work tree
 * — every test fixture is such a directory, and refusing there would trade a
 * false finding for an unrunnable check. The fallback is the LOOSER set, so
 * it can only over-report; could-not-determine is never rendered as clean.
 */
export function contentDocuments(repo: string = REPO): string[] {
  const listed = gitCorpus(repo, ["*.jsonld"]);
  if (listed !== undefined) return listed;

  const out: string[] = [];
  // input-site: inert #6a968168 — names the build output directories a corpus walk skips; never reads them
  const skip = new Set(["node_modules", "_kg", "_site", "_docs", ".git"]);
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || skip.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonld")) out.push(p);
    }
  };
  walk(repo);
  return out;
}
