#!/usr/bin/env bun
/**
 * Lean elaboration-cost ingest — populates
 * `docs/audits/lean-profile.json`, the cache the `proof-compile-cost`
 * criterion reads.
 *
 * ## Why
 *
 * `proof-simplifier` has always referenced `lean_profile_proof` and
 * recorded nothing, so refactoring gains were judgement-only and
 * regressions were invisible. A proof can get shorter and slower at the
 * same time — `simp` doing more search than the explicit `rw` chain it
 * replaced is the standard way — and with no recorded cost that trade
 * looks like a pure win.
 *
 * This caches per-declaration elaboration cost so a before/after is a
 * measurement rather than an opinion.
 *
 * ## Source
 *
 * Agent-driven, like `lean-compile-audit.ts`: call
 * `mcp__lean-lsp__lean_profile_proof` per file and feed the results in
 * as JSONL. There is no CLI path, because profiling requires a live
 * elaboration the pipeline cannot perform on its own.
 *
 * Every entry is stamped with the `.lean` SHA at collection time, so a
 * stale measurement is detectable rather than silently compared against
 * edited source — comparing costs across different source is worse than
 * having no measurement, since it manufactures a confident wrong answer.
 *
 * ## Usage
 *
 *   bun run cat-harness-tools/pipeline/lean-profile-ingest.ts --ingest <profile.jsonl>
 *   bun run cat-harness-tools/pipeline/lean-profile-ingest.ts --stale
 *   bun run cat-harness-tools/pipeline/lean-profile-ingest.ts --report
 *
 * JSONL, one declaration per line:
 *   { "decl": "QOU.Foo.bar", "lean_path": "content/…/foo.lean",
 *     "elab_ms": 812.5, "tactic_count": 14 }
 *
 * @module pipeline/lean-profile-ingest
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, extname, resolve, sep } from "path";
import { hashFile } from "./qa-utils";
import { findContentRepoRoot } from "./repo-root";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

const OUTPUT_REL = "docs/audits/lean-profile.json";

export interface ProfileEntry {
  /** Total elaboration time in milliseconds. */
  elab_ms: number;
  /** Tactic steps in the proof, when the profiler reports it. */
  tactic_count?: number;
  /** Repo-relative `.lean` the declaration lives in. */
  lean_path?: string;
  /** 12-char SHA of that file at measurement time. */
  lean_sha?: string;
  /** Repo HEAD at measurement time, for before/after attribution. */
  measured_sha?: string;
  measured_at: string;
}

export interface ProfileCache {
  $schema: "lean-profile/v1";
  generated_at: string;
  decls: Record<string, ProfileEntry>;
  /**
   * Previous measurement per declaration, kept so a regression can be
   * detected without a git archaeology step. Overwritten on each
   * ingest that supersedes a *fresh* entry — a stale prior is dropped
   * rather than carried forward, since comparing against a measurement
   * taken on different source is exactly the false-confidence case.
   */
  previous: Record<string, ProfileEntry>;
}

const EMPTY: ProfileCache = {
  $schema: "lean-profile/v1",
  generated_at: "",
  decls: {},
  previous: {},
};

function outputPath(repoRoot: string): string {
  return join(repoRoot, OUTPUT_REL);
}

export function loadProfileCache(repoRoot: string): ProfileCache {
  const p = outputPath(repoRoot);
  if (!existsSync(p)) return { ...EMPTY, decls: {}, previous: {} };
  try {
    const parsed = JSON.parse(readFileSync(p, "utf-8"));
    return { ...EMPTY, ...parsed, decls: parsed.decls ?? {}, previous: parsed.previous ?? {} };
  } catch {
    return { ...EMPTY, decls: {}, previous: {} };
  }
}

/** Same containment + extension guard as the other ingest scripts. */
function leanSha(repoRoot: string, p: string): string | undefined {
  const abs = resolve(repoRoot, p);
  if (abs !== repoRoot && !abs.startsWith(repoRoot + sep)) return undefined;
  if (extname(abs) !== ".lean") return undefined;
  return hashFile(abs);
}

/** Is an entry's measurement still valid for the live source? */
export function entryFresh(repoRoot: string, e: ProfileEntry | undefined): boolean {
  if (!e?.lean_path || !e.lean_sha) return false;
  return leanSha(repoRoot, e.lean_path) === e.lean_sha;
}

function ingest(repoRoot: string, jsonlPath: string): void {
  const cache = loadProfileCache(repoRoot);
  // input-site: traced #a456dd98 — stamps an ingested profile; reached only from --ingest
  inputSiteReached("lean-profile-ingest: clock");
  const now = new Date().toISOString();
  let n = 0;
  for (const line of readFileSync(jsonlPath, "utf-8").trim().split("\n")) {
    if (!line.trim()) continue;
    const rec = JSON.parse(line) as {
      decl: string;
      lean_path?: string;
      elab_ms?: number;
      tactic_count?: number;
      measured_sha?: string;
    };
    if (!rec.decl || typeof rec.elab_ms !== "number") continue;

    // Demote the superseded entry to `previous` when the source it was
    // measured against differs from the source being measured now.
    //
    // The baseline is valid BECAUSE it was taken on the pre-refactor
    // source — that is what makes the pair a before/after. (An earlier
    // version gated this on the prior still matching the *current*
    // file, which is self-defeating: after a refactor it never does, so
    // `previous` stayed empty and regression detection could never
    // fire.)
    //
    // Equal shas mean a re-measurement of unchanged source: keep the
    // existing baseline rather than overwriting it with a duplicate,
    // which would silently reset an accumulated regression to zero.
    const prior = cache.decls[rec.decl];
    const newSha = rec.lean_path ? leanSha(repoRoot, rec.lean_path) : undefined;
    if (prior?.lean_sha && newSha && prior.lean_sha !== newSha) {
      cache.previous[rec.decl] = prior;
    }

    cache.decls[rec.decl] = {
      elab_ms: rec.elab_ms,
      tactic_count: rec.tactic_count,
      lean_path: rec.lean_path,
      lean_sha: rec.lean_path ? leanSha(repoRoot, rec.lean_path) : undefined,
      measured_sha: rec.measured_sha,
      measured_at: now,
    };
    n++;
  }
  cache.$schema = "lean-profile/v1";
  cache.generated_at = now;
  const p = outputPath(repoRoot);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(cache, null, 2) + "\n");
  console.log(`Ingested ${n} measurements -> ${p}`);
}

function stale(repoRoot: string): void {
  const cache = loadProfileCache(repoRoot);
  const decls = Object.keys(cache.decls);
  if (!decls.length) {
    console.log(`No ${OUTPUT_REL} cache (nothing to check).`);
    return;
  }
  const fresh = decls.filter((d) => entryFresh(repoRoot, cache.decls[d]));
  const bad = decls.length - fresh.length;
  console.log(`lean-profile: ${decls.length} tracked, ${fresh.length} fresh, ${bad} stale/unusable`);
  if (bad > 0) {
    for (const d of decls.filter((d) => !entryFresh(repoRoot, cache.decls[d])).slice(0, 25)) {
      console.log(`  STALE ${d}`);
    }
    console.log(`\nproof-compile-cost reports n/a for stale entries — a cost\ncompared across different source is a confident wrong answer.`);
    process.exitCode = 1;
  }
}

function report(repoRoot: string): void {
  const cache = loadProfileCache(repoRoot);
  const rows: Array<{ decl: string; now: number; then: number; delta: number }> = [];
  for (const [decl, e] of Object.entries(cache.decls)) {
    const prev = cache.previous[decl];
    if (!prev || !entryFresh(repoRoot, e)) continue;
    rows.push({
      decl,
      now: e.elab_ms,
      then: prev.elab_ms,
      delta: prev.elab_ms ? (e.elab_ms - prev.elab_ms) / prev.elab_ms : 0,
    });
  }
  rows.sort((a, b) => b.delta - a.delta);
  if (!rows.length) {
    console.log("No before/after pairs yet — ingest a second measurement to compare.");
    return;
  }
  console.log(`cost deltas (${rows.length} declarations with a comparable baseline):\n`);
  for (const r of rows.slice(0, 25)) {
    const pct = (r.delta * 100).toFixed(1);
    const mark = r.delta > 0.1 ? "REGRESSED" : r.delta < -0.1 ? "improved " : "         ";
    console.log(`  ${mark} ${pct.padStart(7)}%  ${r.then.toFixed(0)}ms -> ${r.now.toFixed(0)}ms  ${r.decl}`);
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const repoRoot = findContentRepoRoot();
  if (args[0] === "--ingest" && args[1]) ingest(repoRoot, args[1]);
  else if (args[0] === "--stale") stale(repoRoot);
  else if (args[0] === "--report") report(repoRoot);
  else {
    console.log(`Lean elaboration-cost ingest -> ${OUTPUT_REL}

  --ingest <jsonl>   Ingest lean_profile_proof measurements.
                     {"decl":"…","lean_path":"…","elab_ms":812.5,"tactic_count":14}
  --stale            Entries whose .lean changed since measurement.
  --report           Before/after cost deltas, regressions first.

Agent workflow: call mcp__lean-lsp__lean_profile_proof per file, write
the results as JSONL, --ingest. Re-ingest after a refactor to get a
comparable pair.`);
  }
}
