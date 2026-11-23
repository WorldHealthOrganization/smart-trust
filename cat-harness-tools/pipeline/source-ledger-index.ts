#!/usr/bin/env bun
/**
 * Source-ledger indexer — migrate the source ledger's rows to the
 * `source-ledger/v1` shape and seed a row for every document in `uploads/`.
 * The ledger is read and written through `schemas/library/bib-attestations.ts`: the
 * attestation store's `bib-verification` family, or the legacy
 * `<folio>/bib-qa-verifications.json` while the store has none.
 *
 * ## What this does
 *
 * 1. **Migrate.**  Each legacy `VerificationEntry` becomes a `LedgerEntry`:
 *    its `local_pdf` becomes `source: { kind: "upload", file }`; an entry
 *    with no local copy becomes `source: { kind: "external", url }` taken
 *    from the reference's URL/DOI.  Nothing is lost — `local_pdf` is kept
 *    for one release as a deprecated read-path.
 *
 * 2. **Seed.**  Every file under `uploads/` that has no row gets one, at
 *    `status: "unreviewed"`.  Where the filename is an arXiv id that
 *    `references.ts` already cites, `id` is filled in; otherwise `id` is
 *    `null` and the relevance triage resolves it.
 *
 * The indexer deliberately does **not** parse PDFs.  Identifying an
 * unlabelled document is a judgement call, and the relevance triage reads
 * the document anyway — see `.claude/skills/local/paper-relevance-triage.md`.
 * An optional `--matches <file>` accepts a precomputed
 * `{ "<upload-basename>": ["<refId>", …] }` map (see
 * `scripts/extract-upload-titles.py`) to seed `id` for documents whose
 * filename carries no arXiv id.
 *
 * ## One source of truth
 *
 * This script writes judgements and joins only.  It never copies a title,
 * author, year, or DOI out of `references.ts` — see the schema header in
 * `schemas/library/bib-verification.ts`.
 *
 * ## Usage
 *
 *   bun run cat-harness-tools/pipeline/source-ledger-index.ts            # report only
 *   bun run cat-harness-tools/pipeline/source-ledger-index.ts --write
 *   bun run cat-harness-tools/pipeline/source-ledger-index.ts --write --matches m.json
 *
 * @module pipeline/source-ledger-index
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import type { LedgerEntry, SourceLedger, SourceRef } from "../schemas/library/bib-verification.ts";
import {
  readSourceLedger,
  SOURCE_LEDGER_AUTHORITATIVE_FOR,
  SOURCE_LEDGER_SCHEMA,
  writeSourceLedger,
} from "../schemas/library/bib-attestations.ts";
import { directoryForGraph, deferResolution} from "../schemas/kg/cat-harness.js";
import { entryUrl, referenceEntries } from "./reference-entries.ts";

const REPO_ROOT = process.env.FOLIO_REPO_ROOT ?? process.cwd();
// declared-path-literal: the convention fallback, at the call site so the choice is visible.
const UPLOADS_DIR = deferResolution(() => directoryForGraph(REPO_ROOT, "uploads") ?? join(REPO_ROOT, "uploads"), {
  moduleUrl: import.meta.url,
  what: "UPLOADS_DIR",
  under: REPO_ROOT,
});

const SCHEMA_ID = SOURCE_LEDGER_SCHEMA;

/** Documents we index.  Anything else in `uploads/` is scaffolding. */
const SOURCE_EXTENSIONS = [".pdf", ".txt", ".tex", ".djvu", ".epub"];

// ── reference probing ────────────────────────────────────────────────────
//
// Read through `reference-entries.ts`: the per-entry files a folio keeps
// (`<folio>/references/<key>.json`) and any `ref({…})` left in
// `references.ts`. Nothing is imported or executed. Only two facts are read:
// which ids exist, and which arXiv ids they mention.

interface RefIndex {
  /** Every `ref()` id. */
  ids: Set<string>;
  /** arXiv id (lower-case, no version) → reference id. */
  byArxiv: Map<string, string>;
  /** reference id → its URL, for the `external` source fallback. */
  urls: Map<string, string>;
}

export function readReferences(repoRoot: string = REPO_ROOT): RefIndex {
  const ids = new Set<string>();
  const byArxiv = new Map<string, string>();
  const urls = new Map<string, string>();

  // Every entry, from the per-entry files and the module alike
  // (`reference-entries.ts`). An arXiv id is attributed to the entry it
  // actually appears in: the entry's own file, or its own `ref({…})` body.
  for (const e of referenceEntries(repoRoot)) {
    ids.add(e.id);
    const url = entryUrl(e);
    if (url) urls.set(e.id, url);
    for (const a of e.text.matchAll(
      /(?:arxiv\.org\/abs\/|arXiv:\s*)([a-z-]+\/\d{7}|\d{4}\.\d{4,5})/gi,
    )) {
      byArxiv.set(a[1].toLowerCase(), e.id);
    }
  }
  return { ids, byArxiv, urls };
}

/** The arXiv id a filename encodes, if any.
 *
 * Handles both eras and the browser's duplicate suffix:
 *   `2411.03801v1.pdf`   → `2411.03801`   (new style, complete)
 *   `0409565v2.pdf`      → `0409565`      (old style, archive prefix absent)
 *   `0401068v1 (1).pdf`  → `0401068`
 *
 * Old-style ids arrive without their archive prefix (`math/`, `hep-th/`),
 * so they are matched by suffix against the reference index. */
export function arxivIdFromFilename(file: string): string | null {
  const stem = basename(file)
    .replace(/\.[^.]+$/, "")
    .replace(/\s*\(\d+\)$/, "")
    .trim();
  const modern = stem.match(/^(\d{4}\.\d{4,5})(v\d+)?$/);
  if (modern) return modern[1];
  const legacy = stem.match(/^(\d{7})(v\d+)?$/);
  if (legacy) return legacy[1];
  return null;
}

function lookupArxiv(arxiv: string, refs: RefIndex): string | null {
  const direct = refs.byArxiv.get(arxiv);
  if (direct) return direct;
  // Old-style: the filename lacks the archive prefix, so match on suffix.
  if (!arxiv.includes(".")) {
    for (const [key, id] of refs.byArxiv) {
      if (key.endsWith(`/${arxiv}`)) return id;
    }
  }
  return null;
}

// ── migration ────────────────────────────────────────────────────────────

/** Legacy shape, pre-2026-08-08. */
interface LegacyEntry {
  id: string;
  status: string;
  local_pdf?: string | null;
  [k: string]: unknown;
}

function migrateEntry(e: LegacyEntry, refs: RefIndex): LedgerEntry {
  const { local_pdf, ...rest } = e;
  let source: SourceRef;
  if (local_pdf) {
    source = { kind: "upload", file: local_pdf };
  } else {
    source = { kind: "external", url: refs.urls.get(e.id) ?? "" };
  }
  return {
    ...(rest as Omit<LedgerEntry, "source" | "local_pdf">),
    source,
    // Retained one release for pre-migration readers; new writers omit it.
    ...(local_pdf ? { local_pdf } : {}),
  };
}

// ── main ─────────────────────────────────────────────────────────────────

function main(): void {
  const write = process.argv.includes("--write");
  const matchesIdx = process.argv.indexOf("--matches");
  let seeded: Record<string, string[]> = {};
  if (matchesIdx !== -1) {
    const p = process.argv[matchesIdx + 1];
    if (!p || !existsSync(p)) {
      console.error(`--matches: file not found: ${p}`);
      process.exit(2);
    }
    seeded = JSON.parse(readFileSync(p, "utf-8"));
  }

  const refs = readReferences();
  // The ONE reader of the source ledger: the attestation store, or the legacy
  // file while the store has no `bib-verification` family. It says which.
  const read = readSourceLedger(REPO_ROOT);
  console.log(read.note);
  const legacy = read.ledger.entries as unknown as LegacyEntry[];

  const entries: LedgerEntry[] = legacy.map((e) =>
    // Idempotent: a row already carrying `source` is left alone.
    (e as unknown as LedgerEntry).source
      ? (e as unknown as LedgerEntry)
      : migrateEntry(e, refs),
  );

  const haveFile = new Set(
    entries
      .map((e) => (e.source?.kind === "upload" ? e.source.file : null))
      .filter((f): f is string => !!f)
      .map((f) => basename(f)),
  );

  // Seed a row for every uploaded document that has none.
  let addedWithRef = 0;
  let addedOrphan = 0;
  const unresolvedRefIds: string[] = [];

  if (existsSync(UPLOADS_DIR())) {
    for (const f of readdirSync(UPLOADS_DIR()).sort()) {
      if (!SOURCE_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext))) continue;
      if (haveFile.has(f)) continue;

      const arxiv = arxivIdFromFilename(f);
      let id: string | null = arxiv ? lookupArxiv(arxiv, refs) : null;

      if (!id) {
        // Fall back to a precomputed title match, when supplied.  A match
        // naming an id that no longer exists is dropped, not trusted.
        const cands = (seeded[f] ?? []).filter((c) => refs.ids.has(c));
        const dropped = (seeded[f] ?? []).filter((c) => !refs.ids.has(c));
        unresolvedRefIds.push(...dropped);
        // Only an unambiguous single match seeds the join; anything else is
        // left for the triage to adjudicate.
        if (cands.length === 1) id = cands[0];
      }

      entries.push({
        // Where the file really is, repo-relative, not the root queue's spelling (bean `gz47`).
        source: { kind: "upload", file: relative(REPO_ROOT, join(UPLOADS_DIR(), f)) },
        id,
        status: "unreviewed",
      });
      if (id) addedWithRef++;
      else addedOrphan++;
    }
  }

  const ledger: SourceLedger = {
    _schema: SCHEMA_ID,
    _authoritative_for: SOURCE_LEDGER_AUTHORITATIVE_FOR,
    entries,
  };

  const uploads = entries.filter((e) => e.source?.kind === "upload");
  const triaged = entries.filter((e) => e.relevance);

  // An `upload` row naming a file that is not in the repo records a source
  // examination nobody can reproduce.  Surface it rather than let the join
  // dangle: the reading may well have happened, but the evidence did not
  // survive the session that claimed it.
  const dangling = uploads.filter(
    (e) => e.source.kind === "upload" && !existsSync(join(REPO_ROOT, e.source.file)),
  );
  console.log(`references.ts entries      : ${refs.ids.size}`);
  console.log(`ledger rows                : ${entries.length}`);
  console.log(`  migrated from legacy     : ${legacy.length}`);
  console.log(`  seeded (ref resolved)    : ${addedWithRef}`);
  console.log(`  seeded (orphan, id null) : ${addedOrphan}`);
  console.log(`uploads with a row         : ${uploads.length}`);
  console.log(`  file missing from repo   : ${dangling.length}`);
  console.log(`rows with a relevance pass : ${triaged.length}`);
  console.log(`rows still to triage       : ${entries.length - triaged.length}`);
  if (dangling.length) {
    console.log(
      `\n${dangling.length} row(s) cite a local file that is not in the repo. The examination ` +
        `they record cannot be reproduced; re-fetch the source or downgrade the status:`,
    );
    for (const e of dangling.slice(0, 10)) {
      const f = e.source.kind === "upload" ? e.source.file : "";
      console.log(`  ${(e.id ?? "(no ref)").padEnd(28)} ${e.status.padEnd(15)} ${f}`);
    }
    if (dangling.length > 10) console.log(`  … and ${dangling.length - 10} more`);
  }
  if (unresolvedRefIds.length) {
    console.log(
      `\n--matches named ${unresolvedRefIds.length} id(s) absent from references.ts (dropped): ` +
        `${[...new Set(unresolvedRefIds)].slice(0, 8).join(", ")}`,
    );
  }

  if (write) {
    // Written back to where it was read from (store, or legacy before migration).
    console.log(`\n${writeSourceLedger(REPO_ROOT, ledger).note}`);
  } else {
    console.log("\n(dry run — pass --write to persist)");
  }
}

// Run only as a script, so a test can import `readReferences`.
if (import.meta.main) main();
