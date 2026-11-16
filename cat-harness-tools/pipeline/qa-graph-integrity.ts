/**
 * Every document in every declared `qa` directory must be readable: no git
 * conflict markers, and every `.json` parses.
 *
 * Bean `de9k`, defect C1 of the reader audit
 * (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md` §4.1).
 *
 * ## The defect
 *
 * Merge `48aab0bd` committed git conflict markers into three `kg-qa/v1`
 * sidecars, in the HOSTED homes `cat-harness/test/results/bootstrap/` and
 * `…/bootstrap-tools/`. Three things made the damage invisible:
 *
 * - every reader that tolerates a parse error treated those files as absent
 *   (`readAttestations` and `readVoiceReviews` returned `[]`; since bean
 *   `2gst` they read the attestation store and answer `corrupt` instead);
 * - `readQaGraph` counted them as "3 unreadable", and nothing fails on that
 *   count;
 * - `kg-qa.test.ts` validates only `test/results/kg-qa/**`, so it never saw
 *   the hosted homes.
 *
 * A tolerant reader is the right reader for a corpus that may be partly
 * written. It is the wrong place to discover a corrupt corpus, so the
 * corruption needs a check of its own. It goes here, and not in any one
 * family's schema test.
 *
 * ## Scope: the DECLARED directories, of every layer
 *
 * The directories come from each layer's `<instance>.json`. They are never
 * hardcoded under a path, because a hardcoded path is how the hosted homes went
 * unseen. A walk covers everything below a declared root, so a hosted home is
 * covered as soon as its host is.
 *
 * ## What counts as a marker
 *
 * A line that starts with seven or more `<` or `>` followed by a space or the
 * end of the line. This merge wrote EIGHT, because git widens the marker for a
 * rename/rename conflict, so a check for exactly seven would have missed it.
 * The `=======` separator is deliberately not matched alone: it is a legal
 * setext heading underline in Markdown, and the two outer markers always come
 * with it.
 *
 * @module folio-assistant/pipeline/qa-graph-integrity
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { directoriesForGraph, layerRootsIn } from "../schemas/kg/cat-harness.js";

/** A start or end conflict marker, of any width git writes. */
export const CONFLICT_MARKER = /^(?:<{7,}|>{7,})(?: |$)/m;

/** One file that a tolerant reader would silently treat as absent. */
export interface QaIntegrityFinding {
  path: string;
  problem: "conflict-marker" | "unparseable-json";
  detail: string;
}

/** The result of a sweep. `examined` is the denominator, and `0` is not clean. */
export interface QaIntegrityReport {
  dirs: string[];
  examined: number;
  findings: QaIntegrityFinding[];
}

/** Files larger than this are not scanned as text. No QA document is near it. */
const MAX_TEXT_BYTES = 32 * 1024 * 1024;

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) out.push(...filesUnder(p));
    else if (s.isFile() && s.size <= MAX_TEXT_BYTES) out.push(p);
  }
  return out;
}

/** Check one file. Returns a finding, or `undefined` if the file is readable. */
export function checkQaFile(path: string): QaIntegrityFinding | undefined {
  const buf = readFileSync(path);
  // A binary file (an image, an archive) has no lines to carry a marker.
  if (buf.includes(0)) return undefined;
  const text = buf.toString("utf8");
  const m = CONFLICT_MARKER.exec(text);
  if (m) {
    const line = text.slice(0, m.index).split("\n").length;
    return { path, problem: "conflict-marker", detail: `line ${line}: ${m[0].trim()}…` };
  }
  if (path.endsWith(".json")) {
    try {
      JSON.parse(text);
    } catch (err) {
      return { path, problem: "unparseable-json", detail: (err as Error).message };
    }
  }
  return undefined;
}

/** Sweep the given directories, deduped and nesting-safe. */
export function checkQaDirs(dirs: readonly string[]): QaIntegrityReport {
  const roots = [...new Set(dirs.map((d) => resolve(d)))].sort();
  const files = new Set<string>();
  for (const d of roots) for (const f of filesUnder(d)) files.add(f);
  const findings: QaIntegrityFinding[] = [];
  for (const f of [...files].sort()) {
    const finding = checkQaFile(f);
    if (finding) findings.push(finding);
  }
  return { dirs: roots, examined: files.size, findings };
}

/**
 * Every directory declared as a `qa` or `attestations` graph, by every
 * layer in the checkout. The attestation store is swept too (bean `2gst`):
 * it holds the judgements C1's conflict markers would have destroyed, and its
 * readers now refuse a corrupt file rather than reading it as empty — this is
 * where such a file is reported before a reader meets it.
 *
 * `kinds` narrows it: a test sweeps only `attestations`, the half that stays
 * on `main`; the derived `qa` half is judged by `check:qa-corpus` over the
 * fetched tree (bean `cxcn`).
 */
export function declaredQaDirs(
  repoRoot: string,
  kinds: readonly ("qa" | "attestations")[] = ["qa", "attestations"],
): string[] {
  const dirs = new Set<string>();
  for (const inst of layerRootsIn(repoRoot)) {
    for (const kind of kinds) {
      for (const d of directoriesForGraph(inst, kind)) dirs.add(resolve(d));
    }
  }
  return [...dirs].sort();
}
