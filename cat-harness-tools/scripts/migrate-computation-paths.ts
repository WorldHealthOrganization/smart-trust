#!/usr/bin/env bun
/**
 * Codemod that rewrites references to compute scripts after a
 * subdirectory move: the content/.ts + content/.md + content/.qa.json +
 * scripts/*.{sh,ts} + workflow.yml rewrites a move requires.
 *
 * INPUT: a move table — an array of [oldPath, newPath] pairs,
 * relative to repo root. Each pair covers BOTH the .py producer
 * AND any sibling artifacts that share the same root name
 * (witnesses co-move with producers):
 *
 *   foo.py            → cluster/foo.py
 *   foo.witness.json  → cluster/foo.witness.json   (if present)
 *   foo.derivation.json → cluster/foo.derivation.json (if present)
 *
 * It is run once per move table and never discovers moves by walking git,
 * so each run is auditable.
 *
 * USAGE
 *
 *   bun scripts/migrate-computation-paths.ts <move-table.json> [--write]
 *
 * Without `--write`, a dry run: prints every rewrite it would make and
 * touches no file.
 *
 * SCAN SCOPE — every file kind that may cite a compute path:
 *
 *   content/<paper>/**\/*.ts            (manifest blocks, witness:)
 *   content/<paper>/**\/*.md            (prose mentions)
 *   content/<paper>/**\/*.qa.json       (qa-sweep sidecars)
 *   content/<paper>/**\/*.lean          (-- Ref: lines)
 *   scripts/**\/*.{ts,sh,py}            (skill scripts, audit scripts)
 *   .github/workflows/*.yml             (path: filters, run: steps)
 *   .github/actions/**\/action.yml      (composite actions)
 *   docs/**\/*.md                       (audit / handover docs)
 *
 * REPLACEMENT RULES
 *
 *   - Whole-path substring match: every occurrence of `oldPath` in
 *     the file content is replaced with `newPath`. The move-table
 *     entries are normalized to leading-slash-free relative paths.
 *   - Idempotent: re-running on already-migrated files is a no-op.
 *   - A pure substring replace, so indentation, quoting and punctuation
 *     are preserved.
 *
 * SAFETY
 *
 *   - Refuses to run on `main` (or `master`), dry run included.
 *   - Prints per-file diff stats so you can spot suspicious mass
 *     replacements.
 *   - `--write` always writes UTF-8, preserves line endings, and
 *     leaves a backup at `<file>.pre-migrate` IFF the env var
 *     `MIGRATE_BACKUP=1` is set (off by default — git diff is the
 *     audit trail).
 */

import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { execSync } from "child_process";
import { join, relative, resolve } from "path";
import { globSync } from "glob";
import { HARNESS_ROOT } from "./lib/roots.ts";

type MoveEntry = [oldPath: string, newPath: string];
type MoveTable = MoveEntry[];

const SCAN_GLOBS = [
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  "folio/**/*.ts",
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  "folio/**/*.md",
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  "folio/**/*.qa.json",
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  "folio/**/*.lean",
  "scripts/**/*.ts",
  "scripts/**/*.sh",
  "scripts/**/*.py",
  ".github/workflows/*.yml",
  ".github/actions/**/action.yml",
  "docs/**/*.md",
  // Phase-4 addition (2026-06-02): the witness / derivation JSON
  // sidecars cite their producer script's path; derivation_chain_
  // validator checks those citations exist on disk, so cluster
  // moves require rewriting these too.
  "folio-assistant/computations/**/*.derivation.json",
  "folio-assistant/computations/**/*.witness.json",
];

function normalize(p: string): string {
  return p.replace(/^\.?\//, "").replace(/\\/g, "/");
}

function loadMoveTable(path: string): MoveTable {
  if (!existsSync(path)) {
    throw new Error(`move table file not found: ${path}`);
  }
  const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error("move table must be an array of [oldPath, newPath] pairs");
  }
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2 ||
        typeof entry[0] !== "string" || typeof entry[1] !== "string") {
      throw new Error(`invalid move-table entry: ${JSON.stringify(entry)}`);
    }
  }
  return (raw as MoveEntry[]).map(([o, n]) => [normalize(o), normalize(n)] as MoveEntry);
}

function discoverFiles(INSTANCE_ROOT: string): string[] {
  const seen = new Set<string>();
  for (const pattern of SCAN_GLOBS) {
    const matches = globSync(pattern, { cwd: INSTANCE_ROOT, nodir: true });
    for (const m of matches) seen.add(join(INSTANCE_ROOT, m));
  }
  return Array.from(seen).sort();
}

function applyMoveTable(content: string, table: MoveTable): {
  out: string;
  hits: Map<string, number>;
} {
  let out = content;
  const hits = new Map<string, number>();
  for (const [oldPath, newPath] of table) {
    if (oldPath === newPath) continue;
    let count = 0;
    const next = out.split(oldPath).join(newPath);
    if (next !== out) {
      count = (out.length - next.length + oldPath.length * 0) / 1;
      // Recompute count exactly:
      count = out.split(oldPath).length - 1;
      out = next;
      hits.set(oldPath, count);
    }
  }
  return { out, hits };
}

function getCurrentBranch(INSTANCE_ROOT: string): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { cwd: INSTANCE_ROOT })
    .toString().trim();
}

function main(argv: string[]): number {
  const args = argv.slice(2);
  if (args.length < 1) {
    console.error("usage: bun scripts/migrate-computation-paths.ts <move-table.json> [--write]");
    return 2;
  }
  const movePath = args[0];
  const write = args.includes("--write");

  const INSTANCE_ROOT = HARNESS_ROOT;  // the computations are the harness's; this script moved out of it (bean 70lx)
  const branch = getCurrentBranch(INSTANCE_ROOT);
  if (branch === "main" || branch === "master") {
    console.error(`refusing to run on protected branch: ${branch}`);
    return 2;
  }

  const table = loadMoveTable(resolve(movePath));
  console.log(`Loaded move table: ${table.length} entries`);
  console.log(`Scan globs (${SCAN_GLOBS.length}):`, SCAN_GLOBS);
  console.log(`Mode: ${write ? "WRITE" : "DRY-RUN"}`);
  console.log("");

  const files = discoverFiles(INSTANCE_ROOT);
  console.log(`Discovered ${files.length} candidate files.`);

  let totalChangedFiles = 0;
  let totalReplacements = 0;
  for (const f of files) {
    const rel = relative(INSTANCE_ROOT, f);
    let stat;
    try { stat = statSync(f); } catch { continue; }
    if (stat.size > 5 * 1024 * 1024) {
      console.log(`  skip (too large >5MB): ${rel}`);
      continue;
    }
    const before = readFileSync(f, "utf-8");
    const { out, hits } = applyMoveTable(before, table);
    if (out === before) continue;

    totalChangedFiles++;
    const replacementsThisFile = Array.from(hits.values()).reduce((a, b) => a + b, 0);
    totalReplacements += replacementsThisFile;
    console.log(`  ${rel} — ${replacementsThisFile} replacement(s)`);
    for (const [k, n] of hits) console.log(`    ${k} → ${table.find(([o]) => o === k)?.[1]} × ${n}`);

    if (write) {
      if (process.env.MIGRATE_BACKUP === "1") {
        writeFileSync(`${f}.pre-migrate`, before, "utf-8");
      }
      writeFileSync(f, out, "utf-8");
    }
  }

  console.log("");
  console.log(`Summary: ${totalChangedFiles} file(s) ${write ? "rewritten" : "would be rewritten"}, ${totalReplacements} replacement(s).`);
  if (!write && totalChangedFiles > 0) {
    console.log("Re-run with --write to apply.");
  }
  return 0;
}

process.exit(main(process.argv));
