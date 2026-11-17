#!/usr/bin/env bun
/**
 * migrate-bib-verifier.ts — Convert legacy free-text `verified_by` strings
 * in the source ledger (`schemas/library/bib-attestations.ts`) to the discriminated `Verifier`
 * union defined in `folio-assistant/schemas/bib-verification.ts`.
 *
 * The legacy shape was:
 *
 *     "verified_by": "Claude (claude-opus-4-7)"
 *     "verified_by": "Claude (claude-sonnet-4-6)"
 *
 * The new shape is:
 *
 *     "verified_by": { "kind": "agent", "model": "claude-opus-4-7" }
 *
 * The script is idempotent — entries that already carry the structured
 * shape are left alone.  A `--dry-run` flag previews the conversion
 * without writing.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/migrate-bib-verifier.ts          # apply
 *   bun run cat-harness-tools/pipeline/migrate-bib-verifier.ts --dry-run
 */

import { readSourceLedger, writeSourceLedger } from "../schemas/library/bib-attestations.ts";
import { findContentRepoRoot } from "./repo-root";

// Was rooted at this file's own location, which is the PLATFORM — but the
// ledger is folio content. `findContentRepoRoot()` walks up from cwd; it must
// not use `import.meta.dir`, which resolves back through a folio's
// `folio-assistant/` symlink to the platform.
const REPO_ROOT = findContentRepoRoot();

/** Parse legacy "Claude (model-name)" pattern → `{ kind: "agent", model }`. */
function parseLegacyVerifier(s: string): { kind: "agent"; model: string } | null {
  // Common pattern: "Claude (claude-opus-4-7)"
  const m = s.match(/^Claude\s+\(([^)]+)\)\s*$/);
  if (m) return { kind: "agent", model: m[1].trim() };
  // Bare model name fallback.
  if (/^claude-[a-z0-9-]+$/.test(s.trim())) {
    return { kind: "agent", model: s.trim() };
  }
  return null;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  // The ONE reader of the source ledger (store, or legacy before migration); it says which.
  const read = readSourceLedger(REPO_ROOT);
  console.log(read.note);
  if (read.from === "none") {
    console.error("ERROR: this folio has no source ledger");
    process.exit(1);
  }
  // `verified_by` is either the legacy string or the `Verifier` union this
  // script migrates it to.
  interface VerificationEntry { id?: string | null; verified_by?: unknown }
  const entries = read.ledger.entries as unknown as VerificationEntry[];

  let migrated = 0;
  let alreadyStructured = 0;
  const unparseable: string[] = [];

  for (const e of entries) {
    const v = e.verified_by;
    if (v == null) continue;
    if (typeof v === "object" && v !== null && "kind" in v) {
      alreadyStructured++;
      continue;
    }
    if (typeof v === "string") {
      const parsed = parseLegacyVerifier(v);
      if (!parsed) {
        unparseable.push(`${e.id}: ${JSON.stringify(v)}`);
        continue;
      }
      e.verified_by = parsed;
      migrated++;
    }
  }

  // This script once also rewrote `_schema` to a free-text description and
  // dropped `_verified_by_caveat`. The ledger's header is now the constant
  // `source-ledger/v1` (`schemas/library/bib-attestations.ts`), and rewriting it would
  // regress every reader, so the header is left alone.

  console.log(`Migrated:           ${migrated}`);
  console.log(`Already structured: ${alreadyStructured}`);
  console.log(`Unparseable:        ${unparseable.length}`);
  for (const u of unparseable) console.log(`  ${u}`);

  if (dryRun) {
    console.log("\n(dry run — no writes)");
    process.exit(0);
  }

  console.log(`\n${writeSourceLedger(REPO_ROOT, read.ledger).note}`);
}
