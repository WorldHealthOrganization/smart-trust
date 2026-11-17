/**
 * Paper adapter — path constants.
 *
 * These are resolved relative to the repo root, which is passed in at runtime.
 * For backward compatibility with the copied tool files, we export the same
 * constants that the original paths.ts did, but computed from REPO_ROOT.
 *
 * @module folio-assistant/adapters/paper/paths
 */

import { resolve } from "path";
import { directoryForGraph, folioDir, folioDirDeferred } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

// Default: assume folio-assistant/adapters/paper/ is inside the repo
let _repoRoot = resolve(import.meta.dir, "../../..");

/** Set the repo root (called at startup). */
export function setRepoRoot(root: string): void {
  _repoRoot = root;
}

/** Repository root directory. */
export function getRepoRoot(): string {
  return _repoRoot;
}

// ── Convenience getters (match original paths.ts export names) ───

export const get = {
  REPO_ROOT: () => _repoRoot,
  FOLIO_DIR: () => folioDir(_repoRoot),
  CHAPTERS_DIR: () => resolve(_repoRoot, "chapters"),
  MAIN_TEX: () => resolve(_repoRoot, "main.tex"),
  /**
   * Default Lean workspace directory.  Points at the repo root where
   * the aggregating `lakefile.toml` lives (see schemas/lean-packages.ts
   * for per-paper Lake roots).
   */
  LEAN_DIR: () => _repoRoot,
  BUILD_DIR: () => resolve(_repoRoot, "build"),
  PREFS_FILE: () => resolve(_repoRoot, ".folio-prefs.json"),
  FEEDBACK_DIR: () => resolve(_repoRoot, ".folio-feedback"),
  // declared-path-literal: the convention fallback for a WRITE target —
  // see adapters/mcp-server/paths.ts for the reasoning.
  // The declared `uploads` graph, falling back to the convention because
  // this is a WRITE target: `directoriesForGraph` returns undefined for a
  // directory that is not there yet, and the ingestion queue has to be
  // creatable before anything has been dropped in it.
  UPLOADS_DIR: () => directoryForGraph(_repoRoot, "uploads") ?? resolve(_repoRoot, "uploads"),
};

// ── Static exports for backward compatibility with tool files ────
// These are evaluated once at import time. For dynamic resolution,
// tools should import `get` above.

export const REPO_ROOT = _repoRoot;
// DEFERRED, unlike its neighbours: `folioDir` throws on a malformed
// declaration, and a throw here aborts this module's evaluation — leaving
// every export below unbound and producing an error far from its cause (bean
// `95s1`). The value is still resolved at import time, like the rest; only the
// failure waits for a caller. `get.FOLIO_DIR()` above was already lazy and is
// untouched.
export const folioDirOf = folioDirDeferred(_repoRoot, import.meta.url);
export const CHAPTERS_DIR = resolve(_repoRoot, "chapters");
export const MAIN_TEX = resolve(_repoRoot, "main.tex");
export const LEAN_DIR = _repoRoot;
export const BUILD_DIR = resolve(_repoRoot, "build");
export const PREFS_FILE = resolve(_repoRoot, ".folio-prefs.json");
export const FEEDBACK_DIR = resolve(_repoRoot, ".folio-feedback");
