#!/usr/bin/env bun
/**
 * Every link out of the files an agent reads FIRST still resolves.
 *
 * @module scripts/check-agent-entry-links
 * @covers docs, skills
 *
 * `AGENTS.md` is the file every agent opens before anything else. The two
 * neighbouring checks each miss its outbound links by design:
 *
 * | check | covers |
 * |---|---|
 * | `readme:audit` | `README.md` only |
 * | `check:agents-xref` | section citations **into** `AGENTS.md` |
 * | *this* | links **out of** every agent entry file |
 *
 * It reuses the generic auditor, `src/core/markdown-links.ts`:
 * relative-path-against-working-tree, ref-aware and Pages-aware checking,
 * with a third state for what it could not check.
 *
 * ## Discovery, not a list
 *
 * The entry files are FOUND, not listed (a list would go stale like the
 * links): the three agent-generic names, at the repository root and at any
 * layer root (e.g. `bootstrap/AGENTS.md`), skipping vendored and published
 * trees.
 *
 * ## A moved path
 *
 * A link into a path some layer has moved resolves at the new place while
 * that layer's `moves` entry is in its window (sdlc skill
 * `two-phase-move`), and is reported as moved, not dead; past `until` it is
 * dead again.
 */
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { auditMarkdownFile } from "../src/core/markdown-links.js";
import { publishTargets } from "../src/core/git-refs.js";
import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { checkoutRootFor } from "../schemas/kg/harness-config.js";
import { layerRootsIn } from "../schemas/kg/instance-roots.js";
import { declaredMoves, resolveThroughMove } from "./check-subgraphs.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

/**
 * The `resolveMoved` a link auditor takes: through the moves declared by the
 * layers at and under {@link start} (a layer root or a checkout root)
 * and every layer of its checkout, when it has one.
 */
export function movesResolver(
  start: string,
  today?: string,
): (abs: string) => { resolved: string; move: string } | undefined {
  const roots = [start, ...layerRootsIn(start)];
  try {
    roots.push(...layerRootsIn(checkoutRootFor(start)));
  } catch {
    // Not in a checkout: the layer's own moves are still honoured.
  }
  const moves = declaredMoves(roots, today);
  return (abs) => {
    const through = resolveThroughMove(abs, moves);
    return through && { resolved: through.resolved, move: through.move.id };
  };
}

/**
 * The agent-generic entry files.
 *
 * `AGENTS.md` is read natively by Claude Code, Gemini CLI, Antigravity,
 * Cursor and Copilot; the other two are thin stubs pointing at it. All three
 * are checked, because a stub whose pointer is broken is worse than no stub —
 * it looks like guidance and leads nowhere.
 */
export const ENTRY_NAMES = ["AGENTS.md", "CLAUDE.md", "GEMINI.md"] as const;

/** Directories never worth walking into for this. */
// input-site: inert #2a2b3453 — names a build-output directory only to leave it out of a walk
const SKIP = new Set(["node_modules", ".git", "_site", "dist", "build", ".lake", "docs"]);

/**
 * Entry files at the repository root and one level down.
 *
 * One level, because a layer root is a direct child (`bootstrap/`,
 * `cat-harness/`). Deeper is a folio's own content, which is not this
 * repository's to gate.
 */
export function findEntryFiles(repo: string): string[] {
  const out: string[] = [];
  for (const n of ENTRY_NAMES) if (existsSync(join(repo, n))) out.push(join(repo, n));
  for (const e of readdirSync(repo, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".") || SKIP.has(e.name)) continue;
    for (const n of ENTRY_NAMES) {
      const p = join(repo, e.name, n);
      if (existsSync(p)) out.push(p);
    }
  }
  return out.sort();
}

if (import.meta.main) {
  const repo = repoRootFor(resolve(HARNESS_ROOT));
  const files = findEntryFiles(repo);

  // A green run over zero files is not coverage — the same guard the workflow
  // and skill sweeps carry. If the names ever change, this fails loudly rather
  // than reporting a clean sweep over nothing.
  if (files.length === 0) {
    console.error(
      `✗ no agent entry file found under ${repo}. Expected at least one of ` +
        `${ENTRY_NAMES.join(", ")}; a clean run over zero files is not a clean run.`,
    );
    process.exit(2);
  }

  // Asked once, not per file: the publish targets are a property of the
  // repository, and resolving a Pages URL needs them. Without them every
  // `github.io` link in `AGENTS.md` would come back UNCHECKED — which is the
  // clean-looking blindness bean `v8gh` existed to remove, not a pass.
  const targets = publishTargets(repo);
  const resolveMoved = movesResolver(repo);

  console.log(`Agent entry links — ${files.length} file(s)\n`);
  let dead = 0;
  let unreadable = 0;
  for (const f of files) {
    const rel = relative(repo, f);
    const r = auditMarkdownFile({ root: repo, file: f, ...targets, resolveMoved });
    // exit 2 from the auditor is "could not read it", which is neither a pass
    // nor a dead link and must not be folded into either.
    if (r.exitCode === 2) {
      unreadable += 1;
      console.error(`  ? ${rel.padEnd(24)} COULD NOT DETERMINE — ${r.text.trim()}`);
      continue;
    }
    // The SUMMARY line, not the last line: the auditor prints its
    // not-checked breakdown AFTER the summary, so `pop()` showed
    // "1 × in-page anchor" where `AGENTS.md`'s 43/43 belonged.
    const summary =
      r.text.split("\n").find((l) => l.includes("link(s) checked"))?.trim() ?? r.text.trim();
    console.log(`  ${r.exitCode === 0 ? "✓" : "✗"} ${rel.padEnd(24)} ${summary}`);
    if (r.exitCode !== 0) {
      dead += 1;
      for (const line of r.text.split("\n")) if (line.trim()) console.error(`      ${line}`);
    }
  }

  if (unreadable > 0) {
    console.error(
      `\n✗ ${unreadable} entry file(s) could not be read. That is not the same as ` +
        `having no dead links, and it outranks one: a sweep blind on one file has ` +
        `not cleared the others.`,
    );
    process.exit(2);
  }
  if (dead > 0) {
    console.error(`\n✗ ${dead} entry file(s) carry a dead link.`);
    process.exit(1);
  }
  console.log(`\nEvery link out of every agent entry file resolves.`);
  process.exit(0);
}
