#!/usr/bin/env bun
/**
 * QA checkers for the `ids` axis — a block's label is its identity in the
 * `folio/` graph, and these criteria keep that identity trustworthy.
 *
 * Everything that compares or annotates a folio keys on the label: the
 * content graph (`content-graph.ts` sets `nodes` by label), a block-level
 * diff between `main` and a staging branch, a review comment anchored to a
 * block, and a heat map aggregating by block. If a label is shared, or
 * changes silently, each of those goes wrong without failing:
 *
 * - **Shared.** `buildContentGraph` overwrites the earlier node, and
 *   `validate.ts` adds labels to a `Set`, so the second block silently takes
 *   the first one's place. `validate.ts` does catch a block NAME listed twice
 *   in a chapter manifest; it does not catch two different blocks declaring
 *   one LABEL. Measured 2026-09-22.
 * - **Changed.** A diff reads a renamed block as one removed and one added,
 *   and every review comment on the old label is orphaned.
 *
 * Two criteria, both mechanical:
 *
 * - `id-unique` — no two blocks in the folio declare one label, and no block
 *   takes a label another block records as a former id (`renamedFrom`).
 *   Reusing a retired id re-attaches the old block's review history to an
 *   unrelated block, which is worse than losing it.
 * - `id-stable` — a block whose `.ts` existed at the base ref (default
 *   `origin/main`) keeps that label, or records the old one in
 *   `renamedFrom`.
 *
 * A third, `id-reingest-stable`, is deliberately NOT here: it needs an ingest
 * that emits blocks, and none does yet (bean `xtpc`). A criterion with nothing
 * to check would sweep as `n/a` everywhere, which reads as coverage.
 *
 * @module pipeline/qa-checkers-ids
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { folioDir } from "../schemas/kg/cat-harness.js";
import type { CheckerHit, CheckerPaths, CheckerResult } from "../schemas/sdlc/block-qa.ts";

import { parseManifestStringArray } from "./qa-checkers-extended";
import { readBlockManifest, walkBlocks } from "./qa-utils";
import { findContentRepoRoot } from "./repo-root";
import { parseStringField } from "./uses-field";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

// ── Corpus label index (built once per process) ─────────────────

interface LabelIndex {
  /** label → every `.ts` declaring it. Length > 1 is the defect. */
  owners: Map<string, string[]>;
  /** former label → the `.ts` whose `renamedFrom` records it. */
  retired: Map<string, string[]>;
}

let _index: LabelIndex | null = null;
let _indexTried = false;
let _indexRoot: string | undefined;

/**
 * The folio's label index, or `null` when there is no folio to walk.
 *
 * `null` is not an empty index: a missing content root must yield `n/a`,
 * never a pass, because "no collisions found" over nothing is not a finding.
 */
function labelIndex(): LabelIndex | null {
  if (_indexTried) return _index;
  _indexTried = true;
  try {
    const root = _indexRoot ?? folioDir(findContentRepoRoot());
    if (!existsSync(root)) return null;
    const owners = new Map<string, string[]>();
    const retired = new Map<string, string[]>();
    for (const b of walkBlocks(root)) {
      owners.set(b.label, [...(owners.get(b.label) ?? []), b.ts]);
      for (const old of parseManifestStringArray(readFileSync(b.ts, "utf-8"), "renamedFrom")) {
        retired.set(old, [...(retired.get(old) ?? []), b.ts]);
      }
    }
    _index = owners.size > 0 ? { owners, retired } : null;
    return _index;
  } catch {
    return null;
  }
}

/**
 * Test hook: drop the memoized index, and optionally point the next build at
 * a fixture root instead of the content repo's folio directory.
 */
export function resetIdsIndexCache(root?: string): void {
  _index = null;
  _indexTried = false;
  _indexRoot = root;
}

/** 1-based line of the first `label:` declaration, for a hit. */
function labelLine(src: string): number {
  const i = src.search(/(^|[{,\s])label\s*:/m);
  return i < 0 ? 1 : src.slice(0, i).split("\n").length;
}

// ── id-unique ───────────────────────────────────────────────────

export function checkIdUnique(paths: CheckerPaths): CheckerResult {
  const ts = paths.ts;
  if (!ts) return { result: "n/a", hits: [], notes: "no .ts manifest" };
  const block = readBlockManifest(ts);
  if (!block) return { result: "n/a", hits: [], notes: "not a labelled block manifest" };
  const index = labelIndex();
  if (!index) {
    return { result: "n/a", hits: [], notes: "no folio content root to index — uniqueness undetermined" };
  }

  const self = resolve(ts);
  const hits: CheckerHit[] = [];
  for (const other of index.owners.get(block.label) ?? []) {
    if (resolve(other) === self) continue;
    hits.push({
      file: other,
      line: labelLine(readFileSync(other, "utf-8")),
      text: `label "${block.label}" is also declared here — one id, two blocks`,
    });
  }
  for (const other of index.retired.get(block.label) ?? []) {
    if (resolve(other) === self) continue;
    hits.push({
      file: other,
      line: 1,
      text: `label "${block.label}" is recorded in this block's renamedFrom — a retired id reused by another block`,
    });
  }
  return hits.length > 0 ? { result: "fail", hits } : { result: "pass", hits: [] };
}

// ── id-stable ───────────────────────────────────────────────────

/** The ref a block's label must be stable against. */
export function idBaseRef(): string {
  // input-site: env QA_ID_BASE_REF #af4f5d54 — names the base ref; the ref itself is read behind the traced git wrapper
  return process.env.QA_ID_BASE_REF || "origin/main";
}

function git(cwd: string, args: string[]): string | undefined {
  try {
    // input-site: traced #6c307a64 — a generic git wrapper; its callers read the base ref
    inputSiteReached("qa-checkers-ids: git");
    return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined;
  }
}

interface BaseDiff {
  top: string;
  /** Repo-relative path on this side → its path at the base (renames followed). */
  changed: Map<string, string>;
}

const _diffs = new Map<string, BaseDiff | null>();

/**
 * Files that differ from the base ref, one `git diff` per repository rather
 * than one `git show` per block. An unchanged file cannot have changed its
 * label, so only these are read at the base. `-M` follows a moved file, so a
 * block that moved AND changed its label is still compared with its old self.
 *
 * `null` means the question could not be asked (no git, no such ref), which
 * the checker reports as `n/a` — never as stable.
 */
function baseDiff(fromDir: string, base: string): BaseDiff | null {
  const top = git(fromDir, ["rev-parse", "--show-toplevel"])?.trim();
  if (!top) return null;
  const key = `${top}\0${base}`;
  if (_diffs.has(key)) return _diffs.get(key)!;
  let result: BaseDiff | null = null;
  if (git(top, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]) !== undefined) {
    const out = git(top, ["diff", "--name-status", "-M", base, "--"]);
    if (out !== undefined) {
      const changed = new Map<string, string>();
      for (const line of out.split("\n")) {
        const cols = line.split("\t");
        // R (renamed) and C (copied) both carry `old\tnew`, and mean different
        // things. A rename IS the old block, so it is compared with its old
        // self. A copy is a NEW block: a fresh label on it is an addition, and
        // a copy that kept the source's label is `id-unique`'s finding, not
        // this one's. So a copy maps to its own path, which the base lacks.
        if (cols[0]?.startsWith("R")) changed.set(cols[2]!, cols[1]!);
        else if (cols[0]?.startsWith("C")) changed.set(cols[2]!, cols[2]!);
        else if (cols.length >= 2) changed.set(cols[1]!, cols[1]!);
      }
      // `git diff` does not list untracked files. Without them a block file
      // not yet `git add`-ed would read as "unchanged since base" — true
      // verdict, false reason. Listed as changed, it is read at the base,
      // is not found there, and is reported as the addition it is.
      for (const p of (git(top, ["ls-files", "--others", "--exclude-standard"]) ?? "").split("\n")) {
        if (p) changed.set(p, p);
      }
      result = { top, changed };
    }
  }
  _diffs.set(key, result);
  return result;
}

/** Test hook: forget the per-repository diffs. */
export function resetIdsBaseCache(): void {
  _diffs.clear();
}

export function checkIdStable(paths: CheckerPaths): CheckerResult {
  const ts = paths.ts;
  if (!ts) return { result: "n/a", hits: [], notes: "no .ts manifest" };
  const block = readBlockManifest(ts);
  if (!block) return { result: "n/a", hits: [], notes: "not a labelled block manifest" };

  const base = idBaseRef();
  const diff = baseDiff(dirname(realpathSync(ts)), base);
  if (!diff) {
    return { result: "n/a", hits: [], notes: `base ref "${base}" not reachable — stability undetermined` };
  }
  // `--show-toplevel` is a real path; compare like with like, or a checkout
  // reached through a symlink matches nothing and every block reads unchanged.
  const rel = relative(diff.top, realpathSync(ts));
  const basePath = diff.changed.get(rel);
  if (basePath === undefined) {
    return { result: "pass", hits: [], notes: `unchanged since ${base}` };
  }
  const baseSrc = git(diff.top, ["show", `${base}:${basePath}`]);
  if (baseSrc === undefined) {
    return { result: "pass", hits: [], notes: `new since ${base} — an addition, not a rename` };
  }
  const baseLabel = parseStringField(baseSrc, "label");
  if (!baseLabel || baseLabel === block.label) {
    return { result: "pass", hits: [] };
  }

  const src = readFileSync(ts, "utf-8");
  if (parseManifestStringArray(src, "renamedFrom").includes(baseLabel)) {
    return { result: "pass", hits: [], notes: `renamed from "${baseLabel}" (declared in renamedFrom)` };
  }
  return {
    result: "fail",
    hits: [
      {
        file: ts,
        line: labelLine(src),
        text:
          `label changed from "${baseLabel}" (at ${base}) to "${block.label}" without ` +
          `renamedFrom: ["${baseLabel}"] — a diff reads this as a removal plus an addition, ` +
          `and review comments on "${baseLabel}" are orphaned`,
      },
    ],
  };
}
