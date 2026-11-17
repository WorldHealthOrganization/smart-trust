#!/usr/bin/env bun
/**
 * QA checkers for the `uses` axis — proper use of the **editorial**
 * dependency relation.
 *
 * `uses[]` records what a *reader* must have read to follow a block.
 * It is agent/human maintained. It is NOT the formal dependency graph
 * — that is machine-derived from `lean.ref` (see `content-graph.ts`).
 *
 * These checkers therefore audit `uses[]` **as an editorial artefact**:
 * is it well-formed, and does it read as a deliberate judgement? They
 * never compare it to Lean for the purpose of correcting it. The one
 * checker that looks at both relations (`uses-formal-coverage`) reports
 * an advisory exposition-gap signal and is incapable of failing a
 * build.
 *
 * @module pipeline/qa-checkers-uses
 */

import { folioDir } from "../schemas/kg/cat-harness.js";
import { existsSync, readFileSync } from "fs";
import type { CheckerResult } from "../schemas/sdlc/block-qa.ts";


import {
  buildContentGraph,
  extractUses,
  type ContentGraph,
} from "./content-graph";
import { findContentRepoRoot } from "./repo-root";

// ── Shared graph (built once per process) ───────────────────────
//
// Built over the whole `content/` tree, not a single paper, so
// cross-paper `paper-dir:label` references resolve. `_graphLoaded`
// gates on a *successful* build: a missing content root must yield
// `n/a`, never a false "everything passes".

let _graph: ContentGraph | null = null;
let _graphLoaded = false;
let _graphTried = false;

function graph(): ContentGraph | null {
  if (_graphTried) return _graphLoaded ? _graph : null;
  _graphTried = true;
  try {
    const repoRoot = findContentRepoRoot();
    const folioRoot = folioDir(repoRoot);
    if (!existsSync(folioRoot)) return null;
    _graph = buildContentGraph(folioRoot, repoRoot);
    _graphLoaded = _graph.nodes.size > 0;
    return _graphLoaded ? _graph : null;
  } catch {
    return null;
  }
}

/** Test hook: drop the memoized graph so a test can rebuild it. */
export function resetUsesGraphCache(): void {
  _graph = null;
  _graphLoaded = false;
  _graphTried = false;
}

/**
 * A `uses[]` entry that is not a bare in-paper label.
 *
 * Cross-folio refs are absolute URLs; cross-paper refs are
 * `paper-dir:label`. Neither can be resolved against the blocks walked
 * here without fetching or assuming a sibling checkout, so both are
 * accepted as-is. (`schemas/constraints.ts` → `uses-resolve` owns
 * deeper validation of those forms.)
 *
 * A bare label always contains a kind prefix (`def:`, `thm:`, …), so
 * the discriminator is whether anything precedes that prefix.
 */
const KIND_PREFIX =
  /^(def|thm|lem|prop|cor|conj|rem|ex|eq|fig|alg|sim|prose|diagram):/;

function isExternalRef(u: string): boolean {
  if (/^https?:\/\//.test(u)) return true;
  // `paper-dir:def:foo` — a kind prefix appears, but not at position 0.
  return !KIND_PREFIX.test(u) && u.includes(":");
}

function label(tsPath: string): string | undefined {
  try {
    return readFileSync(tsPath, "utf-8").match(/\blabel\s*:\s*"([^"]+)"/)?.[1];
  } catch {
    return undefined;
  }
}

// ── uses-editorial-hygiene (MECHANICAL) ─────────────────────────

/**
 * Structural well-formedness of `uses[]` as an editorial list.
 *
 * Checks, in order of severity:
 *  1. self-reference — a block cannot be its own prerequisite;
 *  2. unresolvable bare label — points at no block in the corpus;
 *  3. duplicate entry — inflates every degree/cone metric downstream;
 *  4. transitive redundancy — A uses B, B uses C, A also lists C.
 *
 * (4) is sound on the `uses` relation specifically: a prerequisite of a
 * prerequisite is one too, so listing C adds nothing a reader gains. It
 * is NOT sound on the wider editorial relation — an `interprets` edge
 * carries no prerequisite forward (see the note at the check itself) —
 * and it is never applied to formal edges, where a direct dependency is
 * a fact about the proof term rather than a claim about reading order.
 */
export function checkUsesEditorialHygiene(tsPath?: string): CheckerResult {
  if (!tsPath || !existsSync(tsPath)) return { result: "n/a", hits: [] };
  const g = graph();
  if (!g) {
    return {
      result: "n/a",
      hits: [],
      notes: "content graph unavailable (no folio/ root found)",
    };
  }
  const src = readFileSync(tsPath, "utf-8");
  const me = label(tsPath);
  if (!me) return { result: "n/a", hits: [] };

  // Raw (pre-dedup) list: `parseUses` deduplicates, which is right for
  // the graph but would hide a duplicate entry from this check.
  const extracted = extractUses(src);
  const raw = extracted?.entries ?? [];
  if (raw.length === 0) return { result: "pass", hits: [] };

  const usesLine = src.slice(0, extracted!.index).split("\n").length || 1;
  const hits: Array<{ file: string; line: number; text: string }> = [];
  const hit = (text: string) => hits.push({ file: tsPath, line: usesLine, text });

  // Defects are graded. A broken edge (1-3) corrupts the graph every
  // downstream metric is computed from, so it fails. Transitive
  // redundancy (4) is a tidiness lint — the graph it produces is still
  // correct, just not minimal — so it warns. Rolling both into one
  // `fail` would bury the handful of real breakages under a flood of
  // lint (on the qou corpus: ~350 redundancies, single-digit breakages).
  let broken = 0;

  // 1. self-reference
  if (raw.includes(me)) {
    hit(`self-reference: uses[] lists its own label "${me}"`);
    broken++;
  }

  // 2. unresolvable bare label
  for (const u of raw) {
    if (isExternalRef(u)) continue;
    if (!g.nodes.has(u)) {
      hit(`unresolvable dependency "${u}" — no block in the corpus has that label`);
      broken++;
    }
  }

  // 3. duplicates
  const seen = new Set<string>();
  for (const u of raw) {
    if (seen.has(u)) {
      hit(`duplicate entry "${u}" — listed more than once`);
      broken++;
    }
    seen.add(u);
  }

  // 4. transitive redundancy: an entry also reachable through another entry.
  const direct = [...seen];
  let redundant = 0;
  //
  // Walk `uses` ONLY — not the full editorial relation.
  //
  // Redundancy here means "the reader already had to read `u` to get through
  // `other`", and only `uses` transmits that. An `interprets` edge does not:
  // owner ruling 2026-08-24 — sending a reader to a remark ABOUT B lets them
  // take B's assertions for granted, and follow the reference if they want
  // more; it does not mean they have read B's prerequisites. So a path that
  // leaves a block by its `interprets` edge carries nothing forward, and an
  // entry reachable only that way is not redundant.
  //
  // This is what the criterion was SPECIFIED to do — bean `folio-assistant-r0ax`,
  // 2026-08-07: "transitive redundancy (A uses B, B uses C, A uses C)". It
  // walked `cone(other, "editorial")`, which meant `uses` until `i8ad`
  // (2026-08-15) made `interprets` an editorial edge, silently widening it.
  // `ContentGraph.usesCone` is that walk, named — there is no `EdgeKind` for
  // `uses`, because `uses`/`interprets` is a different axis from the
  // editorial/formal provenance `EdgeKind` records.
  //
  // The cost of the widening, measured over qou 2026-08-24: 374 blocks warned,
  // carrying 594 redundancy reports, and ALL 594 were `interprets`-only — not
  // one ran through `uses`. Every one of them also named
  // `prune-transitive-deps.ts` as the remedy, which reduces `uses[]` alone and
  // would have reported nothing for any of them.
  for (const u of direct) {
    for (const other of direct) {
      if (other === u) continue;
      if (!g.usesCone(other).has(u)) continue;
      hit(
        `transitively redundant "${u}" — already reachable via "${other}"; ` +
          `run prune-transitive-deps.ts`,
      );
      redundant++;
      break;
    }
  }

  return {
    result: broken > 0 ? "fail" : redundant > 0 ? "warn" : "pass",
    hits,
    metrics: {
      uses_count: direct.length,
      broken_edges: broken,
      redundant_edges: redundant,
    },
  };
}

// ── Registry ────────────────────────────────────────────────────

/**
 * Automated checkers for the generic `uses` axis (`uses-editorial-hygiene`).
 *
 * The paper/Lean `uses` checkers (`uses-formal-coverage` and `lean-ref-owns-decl`)
 * live in the sci layer (https://github.com/litlfred/folio-assistant-sci/blob/main/pipeline/qa-checkers-uses.ts) and are registered
 * via `folio-qa-checker/v1` contribution nodes (bean `saqd` Group 8).
 *
 * `uses-editorial-completeness` is deliberately absent: it is
 * `automated: false` in the registry, adjudicated by an agent or human
 * reading the narrative.
 */
export const USES_AUTOMATED_CHECKERS: Record<
  string,
  (paths: { md?: string; ts?: string; lean?: string }) => CheckerResult
> = {
  "uses-editorial-hygiene": (p) => checkUsesEditorialHygiene(p.ts),
};
