/**
 * Discovery for script-QA targets.
 *
 * Walks the script roots declared in `SCRIPT_ROOTS` and yields one
 * descriptor per audited script. Currently covers Python compute
 * scripts under the CONTENT repo's `computations/`; extending to
 * TypeScript or Rust just adds another entry to `SCRIPT_ROOTS`.
 *
 * `SCRIPT_ROOTS` entries are relative to the **content repo**, and
 * `walkScripts` must be handed that root — see `findContentRepoRoot()` in
 * ./repo-root. Handing it the platform root instead is what made this
 * walker a silent no-op; see the note on `SCRIPT_ROOTS` below.
 *
 * @module pipeline/script-walker
 */

import {
  existsSync,
  readdirSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from "fs";
import { createHash } from "crypto";
import { join, relative, basename, extname, dirname } from "path";
import type { ScriptLanguage } from "../schemas/sdlc/script-qa.ts";

export interface ScriptTarget {
  /** Absolute path on disk. */
  abs: string;
  /** Repo-relative path (for sidecar `script_path`). */
  rel: string;
  /** Inferred source language. */
  language: ScriptLanguage;
  /** 12-char SHA-256 prefix of the script content. */
  source_hash: string;
  /** Path the QA sidecar should be written to (absolute). */
  sidecar_abs: string;
  /** Repo-relative path of the QA sidecar. */
  sidecar_rel: string;
}

/**
 * Roots to walk + which language tag to assign to matching files.
 * Order is preserved in the walk; subdirectory `script-qa/` is
 * always excluded to keep the walker from auditing its own output.
 */
export interface ScriptRoot {
  /** Repo-relative directory to walk. */
  dir: string;
  /** Extensions (with leading dot) that mark an audited file. */
  exts: string[];
  /** Language tag to assign. */
  language: ScriptLanguage;
}

/**
 * Paths here are relative to the **content repo** (`qou`, …), never to
 * folio-assistant. That is the same convention the sidecars already record:
 * a `script-qa/*.script-qa.json` carries `script_path:
 * "computations/hecke/hecke_characters.py"`, with no `folio-assistant/`
 * prefix.
 *
 * This read `folio-assistant/computations` and was joined onto the PLATFORM
 * root, producing `<folio-assistant>/folio-assistant/computations` — a
 * doubled path that does not exist. `walkRoot` returns early on
 * `!existsSync`, so the sweep audited **zero** scripts and exited 0 reporting
 * "0 script(s) audited / 0 findings" — indistinguishable from a clean sweep
 * of everything. Measured on `qou` at the time of the fix: 1086 of 1798
 * script-qa sidecars were hash-stale and unrefreshable behind it.
 *
 * `repo-root.ts` already diagnosed this class in its own docstring —
 * "the caller reported a clean run over nothing" — and this walker was
 * simply never migrated onto it.
 */
export const SCRIPT_ROOTS: ScriptRoot[] = [
  {
    dir: "computations",
    exts: [".py"],
    language: "python",
  },
];

const SIDECAR_DIR_NAME = "script-qa";
const SIDECAR_EXT = ".script-qa.json";

function hashFile(abs: string): string {
  // Stream the file through SHA-256 in 64 KiB chunks via the
  // synchronous file-descriptor API. `walkScripts` is a synchronous
  // generator, so we cannot adopt the async streaming API without
  // restructuring every caller; `openSync` + `readSync` gives us
  // deterministic chunked reads with bounded memory. Most scripts
  // under `SCRIPT_ROOTS` are small enough to fit in one chunk, but
  // if the walker is ever pointed at a directory that contains a
  // misplaced data file or large generated artefact the loop keeps
  // memory at ~64 KiB regardless of file size.
  const h = createHash("sha256");
  const fd = openSync(abs, "r");
  try {
    const buf = Buffer.alloc(64 * 1024);
    let bytesRead = 0;
    while ((bytesRead = readSync(fd, buf, 0, buf.length, null)) > 0) {
      h.update(buf.subarray(0, bytesRead));
    }
  } finally {
    closeSync(fd);
  }
  return h.digest("hex").slice(0, 12);
}

/** Sidecar path next to a script: `<parent>/script-qa/<base>.script-qa.json`. */
export function sidecarPathFor(scriptAbs: string): string {
  const parent = dirname(scriptAbs);
  const stem = basename(scriptAbs, extname(scriptAbs));
  return join(parent, SIDECAR_DIR_NAME, stem + SIDECAR_EXT);
}

/**
 * Walk a single root and yield `ScriptTarget`s. Skips hidden
 * directories, `node_modules`, and the sidecar subdir itself.
 */
function* walkRoot(
  rootAbs: string,
  root: ScriptRoot,
  repoRoot: string,
): Generator<ScriptTarget> {
  if (!existsSync(rootAbs)) return;
  function* recurse(d: string): Generator<ScriptTarget> {
    for (const entry of readdirSync(d)) {
      if (
        entry.startsWith(".") ||
        entry === "node_modules" ||
        entry === SIDECAR_DIR_NAME
      ) {
        continue;
      }
      const full = join(d, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        yield* recurse(full);
      } else if (root.exts.includes(extname(entry))) {
        const sidecarAbs = sidecarPathFor(full);
        yield {
          abs: full,
          rel: relative(repoRoot, full),
          language: root.language,
          source_hash: hashFile(full),
          sidecar_abs: sidecarAbs,
          sidecar_rel: relative(repoRoot, sidecarAbs),
        };
      }
    }
  }
  yield* recurse(rootAbs);
}

/** Walk all configured script roots. */
export function* walkScripts(
  repoRoot: string,
  roots: ScriptRoot[] = SCRIPT_ROOTS,
): Generator<ScriptTarget> {
  for (const r of roots) {
    yield* walkRoot(join(repoRoot, r.dir), r, repoRoot);
  }
}
