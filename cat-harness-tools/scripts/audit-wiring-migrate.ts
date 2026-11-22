#!/usr/bin/env bun
/**
 * Migration: stamp ``auditOnly`` on every Python witness JSON whose
 * filename appears in any ``docs/audits/*.md`` report.
 *
 * Witnesses in ``folio-assistant/computations/*.witness.json`` fall into
 * three buckets:
 *
 *   1. **wired**       — referenced by ``computation.witness`` in some
 *                        content block.
 *   2. **audit-only**  — declares ``"auditOnly": "docs/audits/<file>.md"``.
 *   3. **orphan**      — neither of the above; actionable.
 *
 * This one-pass migration:
 *
 *   - Reads every ``docs/audits/*.md`` and grep-matches witness filenames
 *     (``<name>.witness.json``).
 *   - For each matched witness without an ``auditOnly`` field, inserts
 *     ``"auditOnly": "docs/audits/<file>.md"`` immediately after
 *     ``contentBlock``, else before ``parameters`` / ``data`` /
 *     ``caveats``, else at the end.
 *
 * It is **idempotent**: re-running it on a stamped witness is a no-op. A
 * witness referenced from more than one audit report gets the first match
 * (lexicographic order of report filenames).
 *
 * Usage
 * -----
 *   bun run cat-harness-tools/scripts/audit-wiring-migrate.ts          # apply (writes in place)
 *   bun run cat-harness-tools/scripts/audit-wiring-migrate.ts --dry    # preview only
 *
 * Pre-conditions: clean working tree (recommended). The script does not
 * stage or commit.
 *
 * @module scripts/audit-wiring-migrate
 */

import { readFileSync, writeFileSync } from "fs";
import { basename, relative } from "path";
import { globSync } from "glob";
import { findContentRepoRoot } from "../pipeline/repo-root";

// Was `import.meta.dir`-relative, i.e. the PLATFORM — but every path below is
// folio content (`content/**`, `computations/**`), and this is used as the cwd
// for those globs. `findContentRepoRoot()` walks up from the real cwd;
// `import.meta.dir` resolves back through a folio's `folio-assistant/` symlink.
const REPO_ROOT = findContentRepoRoot();

interface Args {
  dry: boolean;
  verbose: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { dry: false, verbose: false };
  for (const v of argv) {
    if (v === "--dry" || v === "--dry-run") a.dry = true;
    else if (v === "-v" || v === "--verbose") a.verbose = true;
    else if (v === "-h" || v === "--help") {
      console.log(readFileSync(import.meta.path, "utf-8").split("*/")[0]);
      process.exit(0);
    }
  }
  return a;
}

interface MigrationStats {
  auditsScanned: number;
  witnessesScanned: number;
  alreadyStamped: number;
  newlyStamped: number;
  ambiguous: number; // referenced by >1 audit report
  missing: number;   // referenced from audit but file gone
}

function buildAuditMap(): {
  map: Map<string, string[]>; // witness basename -> array of audit paths (rel)
  reportCount: number;
} {
  const auditFiles = globSync("docs/audits/*.md", {
    cwd: REPO_ROOT,
    absolute: true,
  }).sort();
  const map = new Map<string, string[]>();
  // Match every "<token>.witness.json" appearing in audit prose.  Tokens
  // are filenames so we constrain to the standard charset.
  const witnessRefRe = /([A-Za-z0-9_./-]+\.witness\.json)/g;
  for (const af of auditFiles) {
    let src: string;
    try {
      src = readFileSync(af, "utf-8");
    } catch {
      continue;
    }
    const seenInThisAudit = new Set<string>();
    for (const m of src.matchAll(witnessRefRe)) {
      const base = basename(m[1]);
      if (seenInThisAudit.has(base)) continue;
      seenInThisAudit.add(base);
      const relAudit = relative(REPO_ROOT, af).split("\\").join("/");
      const list = map.get(base);
      if (list) list.push(relAudit);
      else map.set(base, [relAudit]);
    }
  }
  return { map, reportCount: auditFiles.length };
}

/**
 * Insert (or update) the ``auditOnly`` key in a witness JSON object,
 * preserving textual order: the field is placed immediately after
 * ``contentBlock`` if present, else just before ``parameters`` /
 * ``data`` / ``caveats``, else at the end.
 *
 * We work on the parsed object and re-serialise.  Existing witnesses
 * are written by ``json.dump(indent=2, ensure_ascii=False)`` with a
 * trailing newline (see ``witness_base.WitnessBuilder.save``); we
 * match that format.
 */
function stamp(witness: Record<string, unknown>, auditPath: string): Record<string, unknown> {
  // Re-build with deterministic key order matching WitnessBuilder.build.
  const KEY_ORDER = [
    "engine",
    "engineVersion",
    "computedAt",
    "commitSha",
    "assertions",
    "allPassed",
    "durationMs",
    "computation",
    "scriptFile",
    "scriptHash",
    "scriptCommitSha",
    "description",
    "contentBlock",
    "auditOnly",
    "parameters",
    "data",
    "caveats",
  ];
  const out: Record<string, unknown> = {};
  // First emit known keys in canonical order
  for (const k of KEY_ORDER) {
    if (k === "auditOnly") {
      out["auditOnly"] = auditPath;
    } else if (k in witness) {
      out[k] = witness[k];
    }
  }
  // Then any extra/unknown keys, preserving original order
  for (const k of Object.keys(witness)) {
    if (!(k in out)) out[k] = witness[k];
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const { map, reportCount } = buildAuditMap();

  const stats: MigrationStats = {
    auditsScanned: reportCount,
    witnessesScanned: 0,
    alreadyStamped: 0,
    newlyStamped: 0,
    ambiguous: 0,
    missing: 0,
  };

  const witnessFiles = globSync(
    "folio-assistant/computations/*.witness.json",
    { cwd: REPO_ROOT, absolute: true }
  );
  const witnessByBasename = new Map<string, string>();
  for (const wf of witnessFiles) {
    witnessByBasename.set(basename(wf), wf);
  }

  // First, account for audit-references whose witness file is missing
  for (const base of map.keys()) {
    if (!witnessByBasename.has(base)) stats.missing++;
  }

  for (const [base, wf] of witnessByBasename.entries()) {
    stats.witnessesScanned++;
    const audits = map.get(base);
    if (!audits || audits.length === 0) continue;

    if (audits.length > 1) {
      stats.ambiguous++;
      if (args.verbose) {
        console.log(`  ambiguous: ${base} referenced by ${audits.length} audits — using ${audits[0]}`);
      }
    }
    const chosenAudit = audits[0];

    let witness: Record<string, unknown>;
    try {
      witness = JSON.parse(readFileSync(wf, "utf-8"));
    } catch {
      console.error(`  malformed JSON: ${wf} — skipped`);
      continue;
    }

    if (typeof witness.auditOnly === "string" && witness.auditOnly.length > 0) {
      stats.alreadyStamped++;
      continue;
    }

    const stamped = stamp(witness, chosenAudit);
    if (args.dry) {
      console.log(`  would stamp: ${relative(REPO_ROOT, wf)}  →  ${chosenAudit}`);
    } else {
      writeFileSync(
        wf,
        JSON.stringify(stamped, null, 2) + "\n",
        "utf-8"
      );
      if (args.verbose) {
        console.log(`  stamped: ${relative(REPO_ROOT, wf)}  →  ${chosenAudit}`);
      }
    }
    stats.newlyStamped++;
  }

  console.log("");
  console.log("audit-wiring migrate summary:");
  console.log(`  audit reports scanned:  ${stats.auditsScanned}`);
  console.log(`  witnesses scanned:      ${stats.witnessesScanned}`);
  console.log(`  already stamped:        ${stats.alreadyStamped}`);
  console.log(`  newly stamped:          ${stats.newlyStamped}${args.dry ? " (dry-run)" : ""}`);
  console.log(`  ambiguous (>1 audit):   ${stats.ambiguous}`);
  console.log(`  missing (audit ref → no witness): ${stats.missing}`);
}

main();
