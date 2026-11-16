#!/usr/bin/env bun
/**
 * render-changed-blocks.ts — Render per-block standalone PDFs for every
 * content block touched by the current branch (or an explicit file list),
 * scrape the LaTeX logs for human-relevant feedback, and optionally push
 * the clean PDFs to Google Drive. The render-on-change hook calls it after
 * every content edit.
 *
 * By default output is local: PDFs land under `build/block-pdfs/` with a
 * JSON report beside them, and nothing leaves the machine. `--upload-drive`
 * additionally pushes each clean PDF to Google Drive — third-party egress,
 * so it is opt-in at the call site.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/render-changed-blocks.ts
 *   bun run cat-harness-tools/scripts/render-changed-blocks.ts --paper quantum-observable-universe
 *   bun run cat-harness-tools/scripts/render-changed-blocks.ts --base main
 *   bun run cat-harness-tools/scripts/render-changed-blocks.ts content/paper/ch/block.ts
 *   bun run cat-harness-tools/scripts/render-changed-blocks.ts --upload-drive
 *   bun run cat-harness-tools/scripts/render-changed-blocks.ts --upload-drive --drive-folder "QOU/blocks"
 *   bun run cat-harness-tools/scripts/render-changed-blocks.ts --all   # render every block in paper
 *
 * Exit codes:
 *   0  all blocks rendered clean (or only warnings)
 *   1  one or more blocks had LaTeX errors
 *   2  setup error (no manifest, no pdflatex, etc.)
 *
 * @module scripts/render-changed-blocks
 */

import { folioDirDeferred } from "../schemas/kg/cat-harness.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve, relative, basename } from "path";
import { spawnSync } from "child_process";
import type { Paper } from "../schemas/types.ts";
import { readEffectiveConfig } from "../schemas/kg/harness-config.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";

// ── Repo layout ──────────────────────────────────────────────────────────────

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
const folioDirOf = folioDirDeferred(INSTANCE_ROOT, import.meta.url);
const PREAMBLE_PATH = join(INSTANCE_ROOT, "latex", "preamble.tex");
const BLOCK_PDFS_DIR = join(INSTANCE_ROOT, "build", "block-pdfs");
const GOOGLE_DRIVE_MCP = join(TOOLS_ROOT, "src", "google-drive-mcp.py");

// ── Arg parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function argVal(flag: string, fallback?: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}
function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const PAPER = argVal("--paper", "quantum-observable-universe")!;
const BASE = argVal("--base", "");               // git base ref for diff
const UPLOAD_DRIVE = hasFlag("--upload-drive");
const DRIVE_FOLDER = argVal("--drive-folder")    // explicit folder override
  ?? resolveConfigDriveFolder()
  ?? "folio-pdfs/blocks";
const RENDER_ALL = hasFlag("--all");
const EXPLICIT_FILES = args.filter(a => !a.startsWith("--") && (a.endsWith(".ts") || a.endsWith(".md")));

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveConfigDriveFolder(): string | undefined {
  // Read this layer's config (its index entry, else `<name>.config.json`) if present.
  const eff = readEffectiveConfig(INSTANCE_ROOT);
  if (eff.state !== "ok") return undefined;
  try {
    const cfg = eff.config as { googleDrive?: { folderPath?: unknown } };
    if (cfg?.googleDrive?.folderPath) {
      const base = String(cfg.googleDrive.folderPath).replace(/\/$/, "");
      return `${base}/blocks`;
    }
  } catch { /* ignore */ }
  return undefined;
}

function hasCommand(cmd: string): boolean {
  const r = spawnSync("which", [cmd], { stdio: "pipe" });
  return r.status === 0;
}

// ── Find changed block files via git diff ────────────────────────────────────

function getChangedBlockFiles(): string[] {
  if (EXPLICIT_FILES.length > 0) return EXPLICIT_FILES.map(f => resolve(f));

  const paperDir = join(folioDirOf(), PAPER);
  if (!existsSync(paperDir)) {
    console.error(`[render-changed-blocks] Paper directory not found: ${paperDir}`);
    process.exit(2);
  }

  // Determine base ref: explicit --base, or merge-base with default branch, or HEAD~1
  let base = BASE;
  if (!base) {
    // Try to find the remote default branch merge-base
    const defaultBranch = spawnSync("git", ["remote", "show", "origin"], {
      cwd: INSTANCE_ROOT, stdio: "pipe",
    });
    const m = defaultBranch.stdout?.toString().match(/HEAD branch: (\S+)/);
    const defaultRef = m ? `origin/${m[1]}` : "origin/main";
    const mergeBase = spawnSync("git", ["merge-base", "HEAD", defaultRef], {
      cwd: INSTANCE_ROOT, stdio: "pipe",
    });
    base = mergeBase.status === 0
      ? mergeBase.stdout.toString().trim()
      : "HEAD~1";
  }

  const diff = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], {
    cwd: INSTANCE_ROOT, stdio: "pipe",
  });
  if (diff.status !== 0) {
    // Fallback: uncommitted changes
    const status = spawnSync("git", ["diff", "--name-only"], {
      cwd: INSTANCE_ROOT, stdio: "pipe",
    });
    if (status.status !== 0) return [];
    return parseBlockPaths(status.stdout.toString(), paperDir);
  }
  return parseBlockPaths(diff.stdout.toString(), paperDir);
}

/**
 * Given the raw output of `git diff --name-only`, return absolute paths of
 * block .ts/.md files (excluding chapter manifests and paper manifests).
 */
function parseBlockPaths(diffOutput: string, paperDir: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of diffOutput.split("\n")) {
    const rel = line.trim();
    if (!rel) continue;
    const abs = join(INSTANCE_ROOT, rel);

    // Must be under content/<paper>/
    if (!abs.startsWith(paperDir + "/")) continue;

    // Must end in .ts or .md
    if (!abs.endsWith(".ts") && !abs.endsWith(".md")) continue;

    // Compute parts relative to paperDir: <chapterDir>/<file>
    const relToPaper = relative(paperDir, abs);
    const parts = relToPaper.split("/");
    // Depth 1 = paper manifest (e.g. paper.ts) — skip
    // Depth 2 = chapter-level file (e.g. ch1/ch1.ts) — skip if name matches dir
    if (parts.length < 2) continue;
    const chapterDir = parts[0];
    const fileName = basename(rel, ".ts").replace(/\.md$/, "");
    // Skip if file base-name === chapter dir name (it's the chapter manifest)
    if (fileName === chapterDir) continue;
    // Skip if it's the paper manifest itself
    if (fileName === PAPER) continue;

    const blockName = basename(rel).replace(/\.(ts|md)$/, "");
    if (seen.has(blockName)) continue;
    seen.add(blockName);

    result.push(abs);
  }
  return result;
}

// ── Load paper manifest and block registry ───────────────────────────────────

interface BlockEntry {
  blockName: string;
  tsPath: string;
  mdPath: string;
  chapterDir: string;
  sourceDir: string; // relative to repo root
}

async function loadAllBlocks(): Promise<{
  paper: Paper;
  entries: Map<string, BlockEntry>;
}> {
  const { buildPaper } = await import(
    join(folioDirOf(), "pipeline", "build.ts")
  );
  const paperManifestPath = join(folioDirOf(), PAPER, `${PAPER}.ts`);
  if (!existsSync(paperManifestPath)) {
    console.error(`[render-changed-blocks] Paper manifest not found: ${paperManifestPath}`);
    process.exit(2);
  }

  // Called for its side effects — it resolves and validates the manifest
  // before we read blocks off it. The return value is not needed here.
  await buildPaper(paperManifestPath);
  const paperMod = await import(paperManifestPath);
  const paper = paperMod.default as Paper;

  // Build a flat map blockName → entry by scanning paper chapter dirs
  const entries = new Map<string, BlockEntry>();
  const paperDir = join(folioDirOf(), PAPER);

  for (const chapterRef of paper.chapters ?? []) {
    const chDir = join(paperDir, chapterRef.dir);
    // Discover blocks by listing .ts files that are not chapter manifests
    const chManifest = chapterRef.dir + ".ts";
    const chTsFiles = (await import("fs")).readdirSync(chDir)
      .filter((f: string) => f.endsWith(".ts") && f !== chManifest && !f.endsWith(".d.ts"));

    for (const tsFile of chTsFiles) {
      const blockName = tsFile.replace(/\.ts$/, "");
      const tsPath = join(chDir, tsFile);
      const mdPath = join(chDir, `${blockName}.md`);
      const sourceDir = relative(INSTANCE_ROOT, chDir);
      entries.set(blockName, { blockName, tsPath, mdPath, chapterDir: chapterRef.dir, sourceDir });
    }
  }

  return { paper, entries };
}

// ── Log scraper ──────────────────────────────────────────────────────────────

export interface LogIssue {
  kind: "error" | "warning";
  category: "latex-error" | "overfull" | "undefined-ref" | "missing-file" | "other-warning";
  message: string;
}

/**
 * Parse a pdflatex/latexmk .log file and return only human-relevant issues.
 * Suppresses: package loading messages, font substitution, kpathsea lookups,
 * overfull-in-preamble noise, and other boilerplate.
 */
export function scrapeLog(logText: string): LogIssue[] {
  const issues: LogIssue[] = [];
  const lines = logText.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Hard LaTeX errors — always surface
    if (/^! /.test(line)) {
      // Collect context (next 1–2 lines for "l.<n>" context)
      const ctx = lines.slice(i + 1, i + 3)
        .filter(l => l.trim())
        .join(" | ");
      const msg = ctx ? `${line.trim()} → ${ctx}` : line.trim();
      issues.push({ kind: "error", category: "latex-error", message: msg });
      continue;
    }

    // Overfull hbox/vbox
    if (/^Overfull \\[hv]box/.test(line)) {
      issues.push({ kind: "warning", category: "overfull", message: line.trim() });
      continue;
    }

    // Undefined cross-references
    if (/^LaTeX Warning: Reference `.+' on page \d+ undefined/.test(line)) {
      issues.push({ kind: "warning", category: "undefined-ref", message: line.trim() });
      continue;
    }
    if (/^LaTeX Warning: Citation `.+' on page \d+ undefined/.test(line)) {
      issues.push({ kind: "warning", category: "undefined-ref", message: line.trim() });
      continue;
    }

    // Missing file errors
    if (/LaTeX Error: File .+ not found/.test(line)) {
      issues.push({ kind: "error", category: "missing-file", message: line.trim() });
      continue;
    }

    // Other LaTeX warnings worth surfacing (not the noisy package ones)
    if (
      /^LaTeX Warning:/.test(line) &&
      !/Font shape/.test(line) &&
      !/Size substitution/.test(line) &&
      !/You have requested/.test(line) &&
      !/Label(s) may have changed/.test(line)
    ) {
      issues.push({ kind: "warning", category: "other-warning", message: line.trim() });
    }
  }

  return issues;
}

// ── Drive upload ─────────────────────────────────────────────────────────────

function uploadToDrive(localPath: string, driveFolder: string): {
  ok: boolean;
  link?: string;
  error?: string;
} {
  if (!existsSync(GOOGLE_DRIVE_MCP)) {
    return { ok: false, error: "google-drive-mcp.py not found — Drive upload skipped" };
  }
  const py = spawnSync("python3", [
    GOOGLE_DRIVE_MCP,
    "--upload", localPath,
    "--folder", driveFolder,
    "--json",
  ], { stdio: "pipe", timeout: 60_000 });

  if (py.status !== 0) {
    const err = py.stderr?.toString().trim() || "unknown error";
    return { ok: false, error: err };
  }

  try {
    const out = JSON.parse(py.stdout.toString().trim());
    return { ok: true, link: out.webViewLink ?? out.link };
  } catch {
    return { ok: false, error: `Drive upload returned non-JSON: ${py.stdout.toString().trim()}` };
  }
}

// ── Compile a single block ───────────────────────────────────────────────────

interface BlockResult {
  blockName: string;
  texPath: string;
  pdfPath: string | null;
  issues: LogIssue[];
  driveLink?: string;
  driveError?: string;
  compileOk: boolean;
}

async function renderBlock(entry: BlockEntry, paper: Paper): Promise<BlockResult> {
  const { generateBlockStandaloneTex } = await import(
    join(folioDirOf(), "pipeline", "generate-block-tex.ts")
  );

  // Load block
  const blockMod = await import(entry.tsPath);
  const block = blockMod.default;
  const mdContent = existsSync(entry.mdPath)
    ? readFileSync(entry.mdPath, "utf-8")
    : "";

  // Generate .tex
  mkdirSync(BLOCK_PDFS_DIR, { recursive: true });
  const texPath = join(BLOCK_PDFS_DIR, `${entry.blockName}.tex`);
  const bibPath = join(INSTANCE_ROOT, "references");

  const tex = generateBlockStandaloneTex(
    paper, block, mdContent, entry.blockName, entry.sourceDir,
    { preamblePath: PREAMBLE_PATH, bibliographyPath: bibPath },
  );
  writeFileSync(texPath, tex);

  // Compile
  const compile = spawnSync("latexmk", [
    "-pdf",
    "-interaction=nonstopmode",
    `-jobname=${entry.blockName}`,
    `-output-directory=${BLOCK_PDFS_DIR}`,
    texPath,
  ], {
    cwd: INSTANCE_ROOT,
    stdio: "pipe",
    timeout: 120_000,
  });

  const pdfPath = join(BLOCK_PDFS_DIR, `${entry.blockName}.pdf`);
  const logPath = join(BLOCK_PDFS_DIR, `${entry.blockName}.log`);
  const logText = existsSync(logPath)
    ? readFileSync(logPath, "utf-8")
    : compile.stdout?.toString() ?? "";

  const issues = scrapeLog(logText);
  const compileOk = compile.status === 0 && existsSync(pdfPath);

  let driveLink: string | undefined;
  let driveError: string | undefined;

  if (UPLOAD_DRIVE && compileOk) {
    const up = uploadToDrive(pdfPath, DRIVE_FOLDER);
    if (up.ok) {
      driveLink = up.link;
    } else {
      driveError = up.error;
    }
  }

  return {
    blockName: entry.blockName,
    texPath,
    pdfPath: compileOk ? pdfPath : null,
    issues,
    driveLink,
    driveError,
    compileOk,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Pre-flight
  if (!hasCommand("latexmk")) {
    console.error("[render-changed-blocks] latexmk not found. Install TeX Live or run scripts/install-tex.sh");
    process.exit(2);
  }
  if (!existsSync(PREAMBLE_PATH)) {
    console.error(`[render-changed-blocks] Preamble not found: ${PREAMBLE_PATH}`);
    process.exit(2);
  }

  console.log(`[render-changed-blocks] Paper: ${PAPER}`);
  if (UPLOAD_DRIVE) console.log(`[render-changed-blocks] Drive folder: ${DRIVE_FOLDER}`);

  // Load paper
  const { paper, entries } = await loadAllBlocks();

  // Determine which blocks to render
  let blockNames: string[];
  if (RENDER_ALL) {
    blockNames = [...entries.keys()];
    console.log(`[render-changed-blocks] Rendering all ${blockNames.length} blocks`);
  } else {
    const changedFiles = getChangedBlockFiles();
    if (changedFiles.length === 0) {
      console.log("[render-changed-blocks] No changed content blocks found — nothing to render");
      writeJsonReport([], BLOCK_PDFS_DIR);
      process.exit(0);
    }
    // Map changed files → block names that exist in the paper
    const changedNames = new Set(
      changedFiles.map(f => basename(f).replace(/\.(ts|md)$/, ""))
    );
    blockNames = [...changedNames].filter(n => entries.has(n));
    const unknown = [...changedNames].filter(n => !entries.has(n));
    if (unknown.length > 0) {
      console.log(`  ⚠ Skipping non-block files: ${unknown.join(", ")}`);
    }
    console.log(`[render-changed-blocks] Rendering ${blockNames.length} changed block(s)`);
  }

  if (blockNames.length === 0) {
    console.log("[render-changed-blocks] No renderable blocks found");
    writeJsonReport([], BLOCK_PDFS_DIR);
    process.exit(0);
  }

  // Render blocks
  mkdirSync(BLOCK_PDFS_DIR, { recursive: true });
  const results: BlockResult[] = [];
  let anyError = false;

  for (const name of blockNames) {
    const entry = entries.get(name)!;
    process.stdout.write(`  rendering ${name} … `);
    try {
      const result = await renderBlock(entry, paper);
      results.push(result);

      const errors = result.issues.filter(i => i.kind === "error");
      const warnings = result.issues.filter(i => i.kind === "warning");
      const status = result.compileOk
        ? (errors.length === 0 ? "✓" : "✗")
        : "✗";
      process.stdout.write(`${status}`);
      if (result.driveLink) process.stdout.write(` → ${result.driveLink}`);
      if (result.driveError) process.stdout.write(` ⚠ Drive: ${result.driveError}`);
      process.stdout.write("\n");

      if (errors.length > 0) {
        anyError = true;
        for (const e of errors) console.log(`    ✗ [${e.category}] ${e.message}`);
      }
      if (warnings.length > 0) {
        for (const w of warnings) console.log(`    ⚠ [${w.category}] ${w.message}`);
      }
    } catch (e) {
      console.log(`✗ (exception: ${e instanceof Error ? e.message : String(e)})`);
      results.push({
        blockName: name, texPath: "", pdfPath: null, issues: [
          { kind: "error", category: "other-warning", message: String(e) },
        ], compileOk: false,
      });
      anyError = true;
    }
  }

  // Summary
  const ok = results.filter(r => r.compileOk).length;
  const fail = results.filter(r => !r.compileOk).length;
  const warns = results.reduce((s, r) => s + r.issues.filter(i => i.kind === "warning").length, 0);
  console.log(`\n[render-changed-blocks] ${ok} ok, ${fail} failed, ${warns} warning(s)`);

  writeJsonReport(results, BLOCK_PDFS_DIR);
  process.exit(anyError ? 1 : 0);
}

function writeJsonReport(results: BlockResult[], outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(),
    paper: PAPER,
    uploadDrive: UPLOAD_DRIVE,
    driveFolderBase: UPLOAD_DRIVE ? DRIVE_FOLDER : null,
    blocks: results.map(r => ({
      blockName: r.blockName,
      compileOk: r.compileOk,
      pdfPath: r.pdfPath,
      errorCount: r.issues.filter(i => i.kind === "error").length,
      warningCount: r.issues.filter(i => i.kind === "warning").length,
      issues: r.issues,
      driveLink: r.driveLink ?? null,
      driveError: r.driveError ?? null,
    })),
  };
  writeFileSync(join(outDir, "render-report.json"), JSON.stringify(report, null, 2));
  console.log(`[render-changed-blocks] Report: ${join(outDir, "render-report.json")}`);
}

main().catch(e => {
  console.error("[render-changed-blocks] Fatal:", e);
  process.exit(2);
});
