#!/usr/bin/env bun
/**
 * Export CSL-JSON references to BibTeX.
 *
 * Reads the authoritative bibliography from `schema/references.ts`
 * and writes `references.bib` in the repo root for LaTeX consumption.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/export-bibtex.ts
 *   bun run cat-harness-tools/pipeline/export-bibtex.ts --out /path/to/references.bib
 *
 * @module pipeline/export-bibtex
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import type { Data as CSLData } from "csl-json";
import { cslToBibtex } from "./bibtex-format";
import { references } from "./references-registry-di";
import { findContentRepoRoot } from "./repo-root";
import { readSourceLedger } from "../schemas/library/bib-attestations.ts";
import { readDeclaration } from "../schemas/kg/cat-harness.ts";

// Content repo root (was import-relative, which pointed at
// folio-assistant and made every content path below miss).
const REPO_ROOT = findContentRepoRoot();

/**
 * BibTeX header title line from the folio's declaration or `<name>.config.json`,
 * falling back to `"% Bibliography"` when no title is declared.
 */
export function folioBibtexTitle(repoRoot: string = REPO_ROOT): string {
  try {
    const decl = readDeclaration(repoRoot);
    if (decl?.title?.trim()) return `% Bibliography for ${decl.title.trim()}`;
  } catch {
    // Fall back to raw config scan below when registry kinds are not all loaded.
  }
  if (existsSync(repoRoot)) {
    try {
      const cfgFile = readdirSync(repoRoot)
        .filter((f) => f.endsWith(".config.json") && f !== "index.config.json")
        .sort()[0];
      if (cfgFile) {
        const raw = JSON.parse(readFileSync(join(repoRoot, cfgFile), "utf-8")) as {
          title?: string;
          projectName?: string;
        };
        const title = (raw.title ?? raw.projectName)?.trim();
        if (title) return `% Bibliography for ${title}`;
      }
    } catch {
      // Fall back to generic header below.
    }
  }
  return "% Bibliography";
}

// ── Verification status sidecar (added 2026-05-19) ──────────────
// Loaded lazily; each entryToBibtex() reads its own row and emits an
// `annotation = {...}` field that LaTeX / biblatex / pandoc can
// display in the rendered bibliography.

import type { Verifier } from "../schemas/library/bib-verification.ts";
import { verifierLabel } from "../schemas/library/bib-verification.ts";

interface VerifEntry {
  id: string;
  status: string;
  local_pdf?: string;
  verified_at?: string;
  verified_by?: Verifier;
  human_adjudicated?: { who: string; at: string; note?: string };
  fixes_applied?: number;
  fix_commit?: string;
  note?: string;
}

const verifCache = new Map<string, Map<string, VerifEntry>>();

function verifMapFor(repoRoot: string = REPO_ROOT): Map<string, VerifEntry> {
  const hit = verifCache.get(repoRoot);
  if (hit) return hit;
  // The ONE reader of the source ledger (store, or the legacy file while the
  // store has no `bib-verification` family); it says which on stderr.
  const verifRead = readSourceLedger(repoRoot);
  if (import.meta.main) console.error(verifRead.note);
  const map = new Map(
    (verifRead.ledger.entries as unknown as VerifEntry[]).map((e) => [e.id, e]),
  );
  verifCache.set(repoRoot, map);
  return map;
}

function verificationAnnotation(id: string, repoRoot: string = REPO_ROOT): string | null {
  const v = verifMapFor(repoRoot).get(id);
  if (!v) return null;
  // Short symbol per status (works in BibTeX `annotation` field and HTML)
  const SYM: Record<string, string> = {
    "verified-clean":    "[Verified]",
    "fixed":             "[Verified+Fixed]",
    "partial":           "[Partial]",
    "pending":           "[Pending]",
    "pending-placement": "[Pending-Placement]",
    "uncited":           "[Uncited]",
    "paper-mismatch":    "[Paper-Mismatch]",
    "unfetchable":       "[Unfetchable]",
  };
  const sym = SYM[v.status] ?? `[${v.status}]`;
  const parts = [sym];
  if (v.fixes_applied && v.fixes_applied > 0) {
    parts.push(`${v.fixes_applied} fix${v.fixes_applied !== 1 ? "es" : ""}`);
  }
  if (v.verified_by) parts.push(`by ${verifierLabel(v.verified_by)}`);
  if (v.verified_at) parts.push(v.verified_at.slice(0, 10)); // YYYY-MM-DD
  return parts.join(" ");
}

// ── Formatting: pipeline/bibtex-format.ts (pure) ────────────────

/** One entry, with its verification marker from the source ledger. */
function entryToBibtex(entry: CSLData, repoRoot: string = REPO_ROOT): string {
  return cslToBibtex(entry, verificationAnnotation(entry.id, repoRoot));
}

// ── Build full .bib file ────────────────────────────────────────

function buildBibtex(entriesList: readonly CSLData[] = references, repoRoot: string = REPO_ROOT): string {
  const header = [
    folioBibtexTitle(repoRoot),
    "% AUTO-GENERATED from folio bibliography — do not edit manually.",
    "%",
    "% Key convention:  <firstauthorlastname><year>  (all lower-case)",
    "% Source of truth: references/ or schema/references.ts (CSL-JSON)",
    "% Generator:       pipeline/export-bibtex.ts",
    `% Generated:       ${new Date().toISOString()}`,
    "",
  ].join("\n");

  const entries = entriesList.map((e) => entryToBibtex(e, repoRoot)).join("\n\n");
  return header + entries + "\n";
}

// ── CLI ─────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? resolve(args[outIdx + 1]) : join(REPO_ROOT, "references.bib");
  const bibtex = buildBibtex();
  writeFileSync(outPath, bibtex);
  console.log(`Exported ${references.length} references → ${outPath}`);
  console.log(`  (${(bibtex.length / 1024).toFixed(1)} KB)`);
}

export { buildBibtex, entryToBibtex };
