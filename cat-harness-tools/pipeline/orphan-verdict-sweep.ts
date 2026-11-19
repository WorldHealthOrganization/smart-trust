#!/usr/bin/env bun
/**
 * Verdicts in the results tree whose block is gone — the corpus-wide half.
 *
 * ## Why `no-orphan-sidecar` cannot be this
 *
 * That check runs per directory load and, since bean `2634`, reaches exactly
 * one results directory: the mirror of the block directory being loaded. That
 * is enough for the case it exists for — a block MOVING between chapters and
 * leaving a verdict at the old path — because both chapters still exist and
 * both get loaded.
 *
 * It is structurally blind to one case. **Delete a block directory outright
 * and its mirror survives with nothing to visit it, ever**, because the only
 * thing that reaches a mirror is a load of the directory it mirrors. Under the
 * old adjacency this could not arise: the verdicts were INSIDE the directory
 * and went with it. Bean `pb2b`.
 *
 * Widening `no-orphan-sidecar` to walk the whole tree was rejected and the
 * reasoning is worth keeping: it would report the entire repo's orphans when
 * you asked to validate one chapter, and it would report each of them once per
 * chapter loaded. A corpus question needs a corpus entry point.
 *
 * ## Two kinds of finding, because the remedies differ
 *
 * `moved` — the block directory still exists and the manifest does not. A
 * block moved or was deleted; `validate` sees this too, and either place is a
 * fine one to notice it.
 *
 * `abandoned` — **the block directory itself is gone.** Nothing else in this
 * repository will ever report it. This is the finding that justifies the
 * sweep, and it is reported separately so a reader can tell the sweep earned
 * its run.
 *
 * ## An absent tree is "could not determine", never "no orphans"
 *
 * This sweep used to treat a missing `test/results/block-qa/` as a determined
 * empty and print `✓ no orphaned block verdicts`. Bean `c8uq` (reader audit
 * `qa-readers-audit-2026-10-01.md`, defect **C6**): once derived QA leaves
 * `main` for the `qa-reports` branch, EVERY checkout lacks the tree until
 * `bun run cat qa:fetch` materialises it, so that `✓` would be printed on every run
 * over zero verdicts — measured, it was. {@link sweepOrphanVerdicts} therefore
 * reports how many verdicts it EXAMINED, and the CLI refuses through
 * `vacuityRefusal` (exit 2, "could not determine") when that is zero. A folio
 * that genuinely has never swept gets the same refusal, which is the honest
 * answer: nothing was judged, so nothing can be called clean.
 *
 * @module pipeline/orphan-verdict-sweep
 * @covers qa
 */
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { BLOCK_QA_RESULTS_DIR, BLOCK_QA_SUFFIX, blockOfQaPath } from "./qa-paths";

export interface OrphanVerdict {
  /** Repo-relative path of the verdict with no block behind it. */
  verdict: string;
  /** Repo-relative path of the manifest it claims to audit. */
  expects: string;
  /**
   * `abandoned` when the block's whole directory is gone — the case only this
   * sweep can see. `moved` when the directory survives without the manifest.
   */
  kind: "abandoned" | "moved";
}

/** Every `*.qa.json` under the results tree, depth-first. */
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(BLOCK_QA_SUFFIX)) out.push(p);
  }
  return out;
}

/**
 * Orphaned block verdicts across the whole results tree.
 *
 * Returns only what was FOUND. An absent tree yields `[]` here, and that `[]`
 * is not a verdict: callers that report a result must use
 * {@link sweepOrphanVerdicts}, which says how many verdicts were examined, so
 * an empty corpus cannot read as a clean one (bean `c8uq`, defect C6).
 */
export function orphanVerdicts(repoRoot: string): OrphanVerdict[] {
  return sweepOrphanVerdicts(repoRoot).orphans;
}

/** What one sweep looked at, and what it found there. */
export interface OrphanSweep {
  orphans: OrphanVerdict[];
  /** Block verdicts examined. Zero means the sweep judged nothing. */
  examined: number;
  /** The results tree it walked, absolute. */
  tree: string;
  /** Whether that tree exists in this checkout. */
  present: boolean;
}

/**
 * The sweep, with its population. `examined === 0` is the case a caller must
 * NOT report as clean: either the tree is absent (not fetched, or never
 * written) or it holds no block verdict at all.
 */
export function sweepOrphanVerdicts(repoRoot: string): OrphanSweep {
  const tree = join(repoRoot, BLOCK_QA_RESULTS_DIR);
  const verdicts = walk(tree);
  const out: OrphanVerdict[] = [];
  for (const verdict of verdicts) {
    const ts = blockOfQaPath(repoRoot, verdict);
    // `undefined` means the path is not under the results tree, which `walk`
    // makes impossible — but the contract is allowed to refuse and this must
    // not invent an answer when it does.
    if (!ts || existsSync(ts)) continue;
    out.push({
      verdict: relative(repoRoot, verdict),
      expects: relative(repoRoot, ts),
      kind: existsSync(dirname(ts)) ? "moved" : "abandoned",
    });
  }
  return {
    orphans: out.sort((a, b) => a.verdict.localeCompare(b.verdict)),
    examined: verdicts.length,
    tree,
    present: existsSync(tree),
  };
}

if (import.meta.main) {
  const { findContentRepoRoot } = await import("./repo-root");
  const { vacuityRefusal } = await import("../scripts/vacuity-refusal");
  const root = findContentRepoRoot();
  const sweep = sweepOrphanVerdicts(root);
  const found = sweep.orphans;
  const abandoned = found.filter((f) => f.kind === "abandoned");

  // Zero examined is "could not determine", never "no orphans" (C6). The
  // refusal names the tree and its state, and the remedy: the derived corpus
  // is fetched from `qa-reports`, not assumed to be in the checkout.
  const refusal = vacuityRefusal({ script: "check:orphan-verdicts", covers: "qa" }, [
    { label: "block-qa verdicts", dir: sweep.tree, present: sweep.present, found: sweep.examined },
  ]);
  if (refusal) {
    console.error(refusal);
    console.error(
      `\nThe derived QA corpus is published to the \`qa-reports\` branch. Materialise it\n` +
        `first — \`bun run cat qa:fetch --ref main\` (or \`--ref pr/<n>\`) — then re-run this sweep.`,
    );
    process.exit(2);
  }

  if (found.length === 0) {
    console.log(`✓ no orphaned block verdicts under ${BLOCK_QA_RESULTS_DIR} (${sweep.examined} examined)`);
    process.exit(0);
  }
  console.error(`${found.length} orphaned block verdict(s):\n`);
  for (const f of found) {
    console.error(`  ✗ ${f.verdict}`);
    console.error(`      expects ${f.expects} — ${f.kind === "abandoned"
      ? "its block DIRECTORY is gone; nothing else reports this"
      : "the directory survives, so validate sees this too"}`);
  }
  console.error(
    `\n${abandoned.length} of them are abandoned directories, which only this sweep can see.\n` +
      `Delete the verdict (git history keeps it) or restore the manifest.`,
  );
  // Non-zero, because an orphan inflates every census taken over the tree and
  // can never be refreshed — no sweep will visit a block that does not exist.
  process.exit(1);
}
