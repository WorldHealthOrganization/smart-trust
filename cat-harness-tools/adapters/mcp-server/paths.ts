/**
 * Shared path constants for the MCP server.
 *
 * @module scripts/mcp-server/paths
 */

import { resolve } from "path";
import { readFileSync } from "fs";
import { findContentRepoRoot } from "../../pipeline/repo-root.ts";
import { deferResolution, directoriesForGraph, directoryForGraph, folioDirDeferred } from "../../schemas/kg/cat-harness.js";

/**
 * The FOLIO's root — the content repo this server serves.
 *
 * Every constant below is a folio concept: `content/`, `chapters/`,
 * `main.tex`, the Lake workspace, `build/`, `todos/`. None of them exist in
 * folio-assistant, which is the platform. This was
 * `resolve(import.meta.dir, "../..")`, so the server rooted itself in the
 * platform and reported `Paper not found` for every paper in the folio it was
 * launched from — and its git operations ran against the platform repo rather
 * than the content branches it is meant to switch between.
 *
 * Same defect class as `q-usage-audit`, `validate`, `validate-bib`,
 * `export-json`, `readme-metadata` and `refresh-authors-note`.
 */
export const REPO_ROOT = findContentRepoRoot();

/** Content objects directory. */
export const folioDirOf = folioDirDeferred(REPO_ROOT, import.meta.url);

/**
 * Ingested documents directory — the `.jsonld` nodes and `sections/*.md` that
 * `docs/proposals/rag-document-ingestion.md` §7-bis specifies.
 *
 * May not exist. That is not an error: the ingest writer is a separate stage,
 * and the graph index reports an absent root as absent rather than as an
 * empty one, so a caller can tell "not built yet" from "nothing matched".
 */
// declared-path-literal: as above — ingestion CREATES library/ on its
// first run, so resolving to nothing before then would make the first
// ingest impossible rather than merely empty.
// The declared `library` graph. Fallback to the convention because ingestion
// CREATES this directory on its first run, and resolving to nothing before
// then would make the first ingest impossible rather than merely empty.
// declared-path-literal: the convention fallback for a WRITE target.
// `directoriesForGraph` returns undefined for a directory that is not there
// yet, and the ingestion queue must be creatable before anything is in it.
// The declared `uploads` graph — the ingestion queue, before anything is L1.
// Write-target fallback, as above.
export const UPLOADS_DIR = deferResolution(
  () => directoryForGraph(REPO_ROOT, "uploads") ?? resolve(REPO_ROOT, "uploads"),
  { moduleUrl: import.meta.url, what: "its uploads directory", under: REPO_ROOT },
);

// EVERY declared library, not the first — the graph tools read all of them.
//
// Singular until bean `a02m`. One name for a list of one was fine while
// `library` had one home; the moment a second is declared, a server exporting
// LIBRARY_DIR serves half the corpus and reports success. Plural here rather
// than at each consumer so the shape of the answer is the shape of the
// question.
//
// declared-path-literal: the convention fallback, at the call site so the
// choice is visible — ingestion CREATES library/ on its first run, so
// resolving to nothing before then would make the first ingest impossible
// rather than merely empty.
export const LIBRARY_DIRS: string[] = (() => {
  const declared = directoriesForGraph(REPO_ROOT, "library");
  return declared.length > 0 ? declared : [resolve(REPO_ROOT, "library")];
})();

/** LaTeX chapters output directory. */
export const CHAPTERS_DIR = resolve(REPO_ROOT, "chapters");

/** Main LaTeX file. */
export const MAIN_TEX = resolve(REPO_ROOT, "main.tex");

/**
 * Default Lean project directory for the MCP server.
 *
 * Points at the repo-root Lake workspace, which aggregates every paper
 * package registered in `folio-assistant/schemas/lean-packages.ts`.
 * For per-paper operations use the package's `lakeRoot` from that
 * registry instead.
 */
export const LEAN_DIR = REPO_ROOT;

/** Build output directory. */
export const BUILD_DIR = resolve(REPO_ROOT, "build");

/** Preference storage file. */
export const PREFS_FILE = resolve(REPO_ROOT, ".folio-assistant-prefs.json");

/** Feedback directory — committed to main via worktree.
 *  Structure: feedback/<paper-dir>/<rootName>.ts */
export const FEEDBACK_DIR = resolve(REPO_ROOT, "folio-assistant/feedback");

/** Worktree directory for committing feedback to main. */
export const FEEDBACK_WORKTREE = resolve(REPO_ROOT, ".feedback-wt");

/** Global config file. */
export const CONFIG_FILE = resolve(REPO_ROOT, "lean-mcp.config.json");

/** Read viewer_port from lean-mcp.config.json (single source of truth). */
function readViewerPort(): number {
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    return cfg.viewer_port ?? 8080;
  } catch {
    return 8080;
  }
}

/** The port the viewer/assistant serves on (from lean-mcp.config.json). */
export const FOLIO_PORT = parseInt(process.env.VIEWER_PORT || String(readViewerPort()), 10);
