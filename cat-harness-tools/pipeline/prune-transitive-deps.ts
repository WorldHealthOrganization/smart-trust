#!/usr/bin/env bun
/**
 * Prune transitive dependencies from content block uses[] fields.
 *
 * If A uses B and B uses C, then A does not need C in its uses[] —
 * only immediate neighbors belong in uses[].
 *
 * This computes the transitive reduction of the dependency graph:
 * for each block, remove any uses[] entry that is reachable through
 * another uses[] entry.
 *
 * ## Editorial relation only
 *
 * `uses[]` is the **editorial** relation — what a reader must have read
 * first (see `BlockBase.uses` in `schemas/types.ts`). Transitive
 * reduction is sound HERE precisely because reading-order is transitive:
 * a reader sent to B, who is in turn sent to C, has read C. Listing C
 * directly adds nothing.
 *
 * It is NOT sound on the **formal** relation, and this script must never
 * be pointed at one. A direct formal dependency is a fact about the
 * proof term — that this declaration mentions that one — and remains
 * true no matter what else the proof also invokes. Reducing it would
 * discard real structure.
 *
 * The `uses-editorial-hygiene` QA criterion reports (as `warn`) blocks
 * this script would change.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/prune-transitive-deps.ts              # dry-run (report only)
 *   bun run cat-harness-tools/pipeline/prune-transitive-deps.ts --apply      # rewrite .ts files
 *   bun run cat-harness-tools/pipeline/prune-transitive-deps.ts --paper NAME # multi-paper folio
 *
 * @module pipeline/prune-transitive-deps
 */

import { folioDirDeferred } from "../schemas/kg/cat-harness.js";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Paper, Chapter, Section, Block } from "../schemas/types.ts";
import { findContentRepoRoot } from "./repo-root";
import { requirePaper } from "./repo-root";
import { findUsesField, replaceUsesArray, removeUsesField } from "./uses-field";
import { verifyEditedBlock } from "./block-module";

// Was rooted at this file's own location, which is the PLATFORM — but every
// path below is folio content. `findContentRepoRoot()` walks up from cwd;
// it must not use `import.meta.dir`, which resolves back through a folio's
// `folio-assistant/` symlink to the platform.
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

// Read `--flag <value>`, rejecting a flag that was given without one.
//
// The bare `args[args.indexOf(flag) + 1]` this replaced took whatever followed
// the flag, whatever it was. `--paper --apply` therefore handed `requirePaper`
// the string `"--apply"`, which it returns unchanged — an explicit name is
// trusted, by design, since a paper directory is exactly what the caller means
// to name — and the run then died much later looking for a paper directory
// called `--apply`. `--paper` in last position gave `undefined`, which falls
// through to the "N papers found — name one explicitly" error, hiding the fact
// that the caller *did* try to name one.
//
// This is the mirror image of the positional hazard described below, which is
// why the flag form is not automatically the safe one: whichever convention you
// pick, one token has to be checked for being a flag rather than a value.
//
// Deliberately evaluated ABOVE `findContentRepoRoot()`, so a usage error is
// reported as a usage error wherever you run it, rather than being pre-empted
// by "no content repo found" when the mistake is in the argv.
const argValue = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const v = args[i + 1];
  if (v === undefined || v.startsWith("-")) {
    throw new Error(
      `${flag} needs a value — \`${flag} <paper-name>\`. ` +
        (v === undefined
          ? "Nothing followed it."
          : `Got \`${v}\`, which is another flag.`),
    );
  }
  return v;
};
const PAPER_ARG = argValue("--paper");

const REPO_ROOT = findContentRepoRoot();
const folioDirOf = folioDirDeferred(REPO_ROOT, import.meta.url);
// Was a hardcoded folio paper name in PLATFORM code; see `requirePaper`.
// `--paper` matters in a MULTI-paper folio: `requirePaper()` with no argument
// throws "5 papers found — name one explicitly", and until this flag existed
// the script could not run there at all.
//
// A FLAG rather than a positional. `main`'s 21498cc ("nine scripts were
// unrunnable in a multi-paper folio") gives the general reason and is the
// better one: several scripts in this directory already use `argv[2]` for an
// output path or a `--strict` flag, so a positional would collide;
// `extract-status-sections.ts` is the match. It is also forced here
// specifically, because this script takes `--apply`: under a positional
// convention `prune-transitive-deps.ts --apply` would read `argv[2]` as the
// paper name and `requirePaper` would hand `"--apply"` straight back.
//
// That positional hazard is the MIRROR IMAGE of the flag hazard `argValue`
// guards above. Neither convention is free: whichever you pick, one token has
// to be checked for being a flag rather than a value.
//
// (An earlier version of this comment said `generate-index.ts` and
// `find-dangling-remarks.ts` both take the paper positionally and that a flag
// here was a deliberate exception. 21498cc converted `generate-index.ts` to the
// flag form, so the flag is the convention now and `find-dangling-remarks.ts`
// is the remaining positional holdout.)
//
// (qou carries five papers: bach2013-double-slit, fred2005-formal-groups,
// quantum-observable-universe, unital-groebner-bases, visualizer.)
const PAPER_NAME = requirePaper(PAPER_ARG);
const PAPER_DIR = join(folioDirOf(), PAPER_NAME);

// ── Load all blocks ─────────────────────────────────────────────

interface BlockInfo {
  label: string;
  uses: string[];
  rootName: string;
  tsPath: string;
}

async function loadAllBlocks(): Promise<BlockInfo[]> {
  const paperPath = join(PAPER_DIR, `${PAPER_NAME}.ts`);
  const paper: Paper = (await import(paperPath)).default;
  const blocks: BlockInfo[] = [];

  for (const chRef of paper.chapters) {
    const chDir = join(PAPER_DIR, chRef.dir);
    const chPath = join(chDir, `${chRef.dir}.ts`);
    const ch: Chapter = (await import(chPath)).default;

    for (const sec of ch.sections) {
      if ("name" in sec && !("blocks" in sec)) continue;
      const section = sec as Section;

      for (const rootName of section.blocks) {
        const tsPath = join(chDir, `${rootName}.ts`);
        try {
          const block: Block = (await import(tsPath)).default;
          const label = "label" in block ? block.label : undefined;
          const uses = "uses" in block ? (block.uses as string[] ?? []) : [];
          if (label) {
            blocks.push({ label, uses, rootName, tsPath });
          }
        } catch (e) {
          console.warn(`  ⚠ Failed to load block: ${tsPath}`, e);
        }
      }
    }
  }

  return blocks;
}

// ── Transitive reduction ────────────────────────────────────────

/**
 * Check if `target` is reachable from `start` in the dependency graph,
 * WITHOUT going through `start`'s direct edge to `target`.
 *
 * We do BFS from each of start's OTHER uses entries, checking if any
 * path leads to target.
 */
function isReachableIndirectly(
  start: string,
  target: string,
  graph: Map<string, string[]>,
): boolean {
  const directUses = graph.get(start) ?? [];
  // Start BFS from all neighbors EXCEPT the direct edge to target
  const queue: string[] = directUses.filter(u => u !== target);
  const visited = new Set<string>();
  visited.add(start); // don't revisit start

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = graph.get(current) ?? [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        queue.push(n);
      }
    }
  }
  return false;
}

/**
 * Compute the transitive reduction: for each block, remove uses[]
 * entries that are reachable via another uses[] entry.
 */
function computePruning(
  blocks: BlockInfo[],
): Map<string, { original: string[]; pruned: string[]; removed: string[] }> {
  // Build adjacency map
  const graph = new Map<string, string[]>();
  for (const b of blocks) {
    graph.set(b.label, [...b.uses]);
  }

  const results = new Map<string, { original: string[]; pruned: string[]; removed: string[] }>();

  for (const b of blocks) {
    if (b.uses.length <= 1) continue; // nothing to prune with 0-1 deps

    const removed: string[] = [];
    const pruned: string[] = [];

    for (const dep of b.uses) {
      if (isReachableIndirectly(b.label, dep, graph)) {
        removed.push(dep);
      } else {
        pruned.push(dep);
      }
    }

    if (removed.length > 0) {
      results.set(b.label, {
        original: b.uses,
        pruned,
        removed,
      });
    }
  }

  return results;
}

// ── Apply changes to .ts files ──────────────────────────────────

async function applyPruning(
  blocks: BlockInfo[],
  pruning: Map<string, { pruned: string[] }>,
): Promise<number> {
  let filesChanged = 0;
  let refused = 0;
  const blockByLabel = new Map<string, BlockInfo>();
  for (const b of blocks) blockByLabel.set(b.label, b);

  for (const [label, { pruned }] of pruning) {
    const block = blockByLabel.get(label);
    if (!block) continue;

    const tsPath = block.tsPath;
    let content = readFileSync(tsPath, "utf-8");

    // Locate the uses[] field. The previous pattern was
    // `/uses:\s*\[[\s\S]*?\]/` — no word boundary, so on a block with a
    // `causes:` field earlier in the object this WROTE OVER THAT FIELD,
    // and non-greedy, so an entry containing `]` truncated the match
    // mid-array. This is the write path; both mistakes edit content.
    if (!findUsesField(content)) {
      console.warn(`  ⚠ Could not find uses[] in ${tsPath}`);
      continue;
    }

    if (pruned.length === 0) {
      content = removeUsesField(content);
    } else if (pruned.length === 1) {
      content = replaceUsesArray(content, `["${pruned[0]}"]`);
    } else {
      const indent = "    ";
      const entries = pruned.map((u) => `${indent}"${u}",`).join("\n");
      content = replaceUsesArray(content, `[\n${entries}\n  ]`);
    }

    // Verify the edit against the module system before it lands.
    //
    // Every version of this write path has been a text edit trusted on
    // faith. The block is a module, so its post-edit `uses[]` can simply
    // be read rather than assumed — and that catches any way the splice
    // could be wrong, including ones nobody anticipated, instead of only
    // the two that have been found so far.
    const verdict = await verifyEditedBlock(tsPath, content, pruned);
    if (!verdict.ok) {
      console.error(`  ✗ REFUSED to write ${tsPath}\n      ${verdict.reason}`);
      refused++;
      continue;
    }

    writeFileSync(tsPath, content);
    filesChanged++;
  }

  if (refused > 0) {
    console.error(
      `\n  ${refused} file(s) NOT written — the edit did not verify against the ` +
        `loaded module. Nothing was changed for those blocks.`,
    );
  }
  return filesChanged;
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("Loading all content blocks...");
  const blocks = await loadAllBlocks();
  console.log(`  ${blocks.length} blocks loaded, ${blocks.filter(b => b.uses.length > 0).length} with uses[]`);

  console.log("\nComputing transitive reduction...");
  const pruning = computePruning(blocks);

  if (pruning.size === 0) {
    console.log("\n✓ No transitive dependencies found. Graph is already minimal.");
    return;
  }

  // Report
  let totalRemoved = 0;
  console.log(`\n${pruning.size} blocks have transitive deps to prune:\n`);
  for (const [label, { original, pruned, removed }] of pruning) {
    totalRemoved += removed.length;
    console.log(`  ${label}  (${original.length} → ${pruned.length})`);
    for (const r of removed) {
      console.log(`    - ${r}`);
    }
  }
  console.log(`\nTotal edges to remove: ${totalRemoved}`);

  if (APPLY) {
    console.log("\nApplying changes...");
    const changed = await applyPruning(blocks, pruning);
    console.log(`✓ ${changed} files updated.`);
  } else {
    console.log("\nDry run — pass --apply to rewrite files.");
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
