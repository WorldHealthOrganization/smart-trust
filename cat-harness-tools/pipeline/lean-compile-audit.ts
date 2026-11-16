#!/usr/bin/env bun
/**
 * Lean compile diagnostics auditor.
 *
 * Populates `docs/audits/lean-compile-diagnostics.json` by collecting
 * per-file diagnostics from the lean-lsp MCP server.
 *
 * Usage (agent-driven):
 *   Agents call `mcp__lean-lsp__lean_diagnostic_messages` per file
 *   and feed results to this script's `--ingest` mode.
 *
 * Usage (CLI, ingestion mode):
 *   bun run cat-harness-tools/pipeline/lean-compile-audit.ts --ingest <diagnostics.jsonl>
 *
 *   Each line of the JSONL input:
 *     { "file": "<repo-relative-path>", "diagnostics": [...] }
 *
 * Usage (CLI, list mode):
 *   bun run cat-harness-tools/pipeline/lean-compile-audit.ts --list [content-root]
 *
 * Output:
 *   docs/audits/lean-compile-diagnostics.json
 *
 * @module pipeline/lean-compile-audit
 */

import { folioDir } from "../schemas/kg/cat-harness.js";
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join, relative, extname, sep } from "path";
import { fileURLToPath } from "url";
import { hashFile } from "./qa-utils";
import { siteDirFor } from "../schemas/kg/cat-harness.ts";

const __filename = fileURLToPath(import.meta.url);
const INSTANCE_ROOT = resolve(dirname(__filename), "..");
const OUTPUT_PATH = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT), "audits/lean-compile-diagnostics.json");

interface DiagnosticEntry {
  line: number;
  severity: string;
  message: string;
}

interface FileEntry {
  errors: DiagnosticEntry[];
  /**
   * 12-char SHA-256 prefix of the `.lean` source at collection time —
   * same convention as the sidecar `source_hashes.lean` (computed by
   * `qa-utils.hashFile`). Lets the `proof-lean-compiles` checker tell
   * whether these diagnostics are stale (file changed since) without a
   * fragile timestamp comparison. `undefined` only if the file was
   * unreadable at ingest.
   */
  lean_sha?: string;
  checked_at: string;
}

interface DiagnosticsReport {
  // `v2` adds the per-file `lean_sha`. `v1` caches (no `lean_sha`) are
  // still readable (treated as stale by the checker until regenerated
  // here), so the schema tag is a union reflecting both on-disk shapes;
  // every write below stamps `v2`.
  $schema: "lean-compile-diagnostics/v1" | "lean-compile-diagnostics/v2";
  generated_at: string;
  files: Record<string, FileEntry>;
}

const EMPTY_REPORT: DiagnosticsReport = {
  $schema: "lean-compile-diagnostics/v2",
  generated_at: "",
  files: {},
};

/**
 * Hash a `.lean` path with the sidecar SHA convention. Accepts either
 * a repo-relative path (the diagnostics-cache key form) or an absolute
 * path — `resolve` returns an absolute input unchanged and anchors a
 * relative one at `INSTANCE_ROOT`.
 *
 * Containment + extension guard: the diagnostics cache only ever hashes
 * `.lean` files inside the repo, but `--ingest` keys come from JSONL
 * input. Reject anything that resolves outside `INSTANCE_ROOT` (absolute
 * paths or `../` traversal) or is not a `.lean` file, so a crafted key
 * cannot read arbitrary files. A rejected path returns `undefined`,
 * which the checker treats as "no SHA → stale" (fail-safe).
 */
function leanSha(pathOrRelPath: string): string | undefined {
  const abs = resolve(INSTANCE_ROOT, pathOrRelPath);
  if (abs !== INSTANCE_ROOT && !abs.startsWith(INSTANCE_ROOT + sep)) return undefined;
  if (extname(abs) !== ".lean") return undefined;
  return hashFile(abs);
}

function loadExistingReport(): DiagnosticsReport {
  if (!existsSync(OUTPUT_PATH)) return { ...EMPTY_REPORT };
  try {
    return JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
  } catch {
    return { ...EMPTY_REPORT };
  }
}

function findLeanFilesWithSiblingTs(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(d, e);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (e === "node_modules" || e === ".lake" || e === "build" || e === "lake-packages" || e === "lean") continue;
        walk(full);
      } else if (extname(e) === ".lean") {
        const tsPath = full.replace(/\.lean$/, ".ts");
        if (existsSync(tsPath)) {
          results.push(relative(INSTANCE_ROOT, full));
        }
      }
    }
  }
  walk(dir);
  return results.sort();
}

function ingestJsonl(jsonlPath: string): void {
  const existing = loadExistingReport();

  const lines = readFileSync(jsonlPath, "utf-8").trim().split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const { file, diagnostics } = JSON.parse(line) as {
      file: string;
      diagnostics: Array<{ line?: number; severity?: string; message?: string }>;
    };
    const errors: DiagnosticEntry[] = (diagnostics || [])
      .filter((d) => d.severity === "error")
      .map((d) => ({
        line: d.line ?? 0,
        severity: d.severity ?? "error",
        message: (d.message ?? "").slice(0, 500),
      }));
    existing.files[file] = {
      errors,
      lean_sha: leanSha(file),
      checked_at: new Date().toISOString(),
    };
  }
  existing.$schema = "lean-compile-diagnostics/v2";
  existing.generated_at = new Date().toISOString();
  writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 2) + "\n");
  console.log(`Updated ${OUTPUT_PATH} — ${Object.keys(existing.files).length} files tracked`);
}

function ingestSingleFile(filePath: string, diagnostics: DiagnosticEntry[]): void {
  const existing = loadExistingReport();

  existing.files[filePath] = {
    errors: diagnostics.filter((d) => d.severity === "error"),
    lean_sha: leanSha(filePath),
    checked_at: new Date().toISOString(),
  };
  existing.$schema = "lean-compile-diagnostics/v2";
  existing.generated_at = new Date().toISOString();
  writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 2) + "\n");
}

/**
 * Staleness reporter. Compares every cached entry's `lean_sha` against
 * the live `.lean` file's hash and classifies each as fresh / stale /
 * missing-sha / file-gone. Prints a summary so a reader can SEE at a
 * glance how much of the diagnostics cache is trustworthy — without
 * re-running Lean. Exit code 1 if any entry is stale (CI-friendly).
 */
function reportStale(): void {
  const report = loadExistingReport();
  const paths = Object.keys(report.files);
  if (paths.length === 0) {
    console.log("No lean-compile-diagnostics cache found (nothing to check).");
    return;
  }
  const fresh: string[] = [];
  const stale: string[] = [];
  const missingSha: string[] = [];
  const fileGone: string[] = [];
  for (const p of paths) {
    const entry = report.files[p];
    const cur = leanSha(p);
    if (cur === undefined) fileGone.push(p);
    else if (!entry.lean_sha) missingSha.push(p);
    else if (entry.lean_sha !== cur) stale.push(p);
    else fresh.push(p);
  }
  const unusable = stale.length + missingSha.length + fileGone.length;
  console.log(`lean-compile-diagnostics: ${report.$schema}`);
  console.log(`  generated_at: ${report.generated_at || "(unknown)"}`);
  console.log(`  tracked:      ${paths.length}`);
  console.log(`  fresh:        ${fresh.length}  (lean_sha matches live file)`);
  console.log(`  STALE:        ${stale.length}  (lean_sha != live file)`);
  console.log(`  missing-sha:  ${missingSha.length}  (legacy v1 entries — treated as stale)`);
  console.log(`  file-gone:    ${fileGone.length}  (.lean no longer present)`);
  const show = (label: string, list: string[]) => {
    if (list.length === 0) return;
    console.log(`\n${label} (${list.length}):`);
    for (const p of list.slice(0, 40)) console.log(`  ${p}`);
    if (list.length > 40) console.log(`  … and ${list.length - 40} more`);
  };
  show("STALE", stale);
  show("missing-sha", missingSha);
  show("file-gone", fileGone);
  if (unusable > 0) {
    console.log(
      `\n${unusable}/${paths.length} entries are unusable (stale / no-sha / gone). ` +
        `The proof-lean-compiles checker reports these as n/a. ` +
        `Regenerate with the agent workflow below to refresh.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${paths.length} entries fresh ✓`);
  }
}

// CLI entry
const args = process.argv.slice(2);

if (args[0] === "--ingest" && args[1]) {
  ingestJsonl(args[1]);
} else if (args[0] === "--stale") {
  reportStale();
} else if (args[0] === "--list") {
  const contentRoot = args[1] || folioDir(INSTANCE_ROOT);
  const files = findLeanFilesWithSiblingTs(contentRoot);
  for (const f of files) console.log(f);
  console.log(`\n${files.length} .lean files with .ts siblings`);
} else {
  console.log(`Usage:
  bun run cat-harness-tools/pipeline/lean-compile-audit.ts --list [content-root]
    List all .lean files with .ts siblings

  bun run cat-harness-tools/pipeline/lean-compile-audit.ts --ingest <diagnostics.jsonl>
    Ingest MCP lean_diagnostic_messages output (JSONL).
    Each entry is stamped with the .lean source's 12-char SHA so the
    proof-lean-compiles checker can detect staleness.

  bun run cat-harness-tools/pipeline/lean-compile-audit.ts --stale
    Report which cached entries are stale (lean_sha != live file),
    missing a SHA (legacy v1), or point at a deleted file. Exit 1 if
    any are unusable. Makes cache staleness visible without re-running
    Lean.

Agent workflow:
  1. Run --list to get .lean file paths
  2. Call mcp__lean-lsp__lean_diagnostic_messages(file_path) per file
  3. Write results as JSONL and --ingest, or use the qa-sweep
     proof-lean-compiles criterion which reads the cache at
     docs/audits/lean-compile-diagnostics.json
  4. Run --stale anytime to see how much of the cache is still fresh`);
}

export { findLeanFilesWithSiblingTs, ingestSingleFile };
export type { DiagnosticEntry, DiagnosticsReport };
