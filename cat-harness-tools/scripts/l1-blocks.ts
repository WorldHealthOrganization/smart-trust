#!/usr/bin/env bun
/**
 * The arm between a staged entry and a promotable one: `manifest.jsonld` and
 * one `blocks/*.jsonld` per section — the `blocks` and `manifest`
 * requirements `mayPromote` checks after `bun run cat ingest`
 * (`ingest-document.ts`) stages a document.
 *
 * ## It DERIVES; it does not decide
 *
 * Every field here is computed from `structure.json` and the files beside it.
 * Nothing is inferred, and in particular **no block kind is guessed**: every
 * block is `prose`, because a page of an ingested source IS prose until
 * somebody reads it. Deliberate, not a stub.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/l1-blocks.ts -o <staged-entry-dir>
 *   bun run cat-harness-tools/scripts/l1-blocks.ts -o <dir> --check   # write nothing
 *
 * Exit: 0 written (or check passed), 1 refused, 2 could not determine.
 *
 * @module scripts/l1-blocks
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

// The generator's own naming, imported rather than restated. Bean `xwi8`: this
// arm used to mint `prose-${section id}` — `prose-sec-001-introduction` — while
// `gen-library-jsonld` mints `prose-sec-001` through `sectionKey()`, and only
// the generator's names are what sections reference. Every document that went
// through both writers therefore carried a second, unreferenced, byte-identical
// copy of every prose block: 91 of them across four documents when measured
// (2026-09-23). Two naming rules for one block is one rule too many.
import { blockId, libraryInstanceOf, licenceProperties, sectionKey } from "../pipeline/gen-library-jsonld.ts";
import { manifestLicence } from "../schemas/library/source-licence.ts";
import { libraryAssetIri } from "../schemas/library/library-iri.ts";
import { documentContext } from "../schemas/content/content-context.ts";
import { serialisedAtInstanceContext } from "../pipeline/instance-document-context.ts";
import { typesForKind } from "../schemas/kg/jsonld.ts";
import { termCurie } from "../schemas/kg/namespaces.ts";
import { STRUCTURE_FILENAME, pagesOf, readStructure } from "../schemas/content/document-structure.ts";


/**
 * The `library/<id>/…` stem every `@id` is written against.
 *
 * A STAGED entry lives under `ingest-staging/<slug>/`, and its nodes must
 * already carry the path they will have AFTER promotion — promotion is a copy,
 * so an `@id` naming the staging directory would be wrong the moment it
 * succeeded, and wrong in a file nobody re-reads.
 */
function stem(docId: string): string {
  return `library/${docId}`;
}

/** Sections actually on disk, so a manifest cannot list one that is not there. */
function sectionsOnDisk(dir: string): Set<string> {
  const d = join(dir, "sections");
  if (!existsSync(d)) return new Set();
  return new Set(
    readdirSync(d)
      .filter((f) => f.endsWith(".md"))
      .map((f) => basename(f, ".md")),
  );
}

export interface BuildResult {
  docId: string;
  blocks: number;
  /** Declared in `structure.json` but absent from `sections/` — refused, never skipped. */
  missing: string[];
}

/**
 * Build the manifest and the block nodes for one staged entry.
 *
 * Refuses on a section `structure.json` declares and `sections/` does not
 * hold: that is the `dh4f` shape — a manifest listing a file nobody can open,
 * which every consumer then resolves past and reports a clean run over.
 */
export function buildL1(dir: string, write = true): BuildResult {
  if (!existsSync(join(dir, STRUCTURE_FILENAME))) throw new Error(`${dir}: no structure.json — this is not a staged entry`);
  // Through the shared accessor (bean rkqp), so a notebook entry builds its
  // blocks like a PDF's and a variant nobody declared is refused, not guessed.
  const read = readStructure(dir);
  if ("reason" in read) throw new Error(`${dir}: ${read.reason}`);
  const raw = read.raw as { granularity?: string; source: { file: string; sha256: string } };
  const st = { doc_id: read.doc_id, granularity: raw.granularity, source: raw.source };
  const declared = read.sections;
  if (declared.length === 0) throw new Error(`${dir}: structure.json declares no sections`);

  const onDisk = sectionsOnDisk(dir);
  const missing = declared.map((s) => s.id).filter((id) => !onDisk.has(id));
  if (missing.length > 0) return { docId: st.doc_id, blocks: 0, missing };

  const base = stem(st.doc_id);
  // The asset's own IRI once the entry sits in a layer's library (#1881);
  // a STAGED entry keeps the relative form until promotion regenerates it.
  const instance = libraryInstanceOf(dir);
  const manifestIri = instance !== undefined ? libraryAssetIri(instance, st.doc_id) : `${base}/manifest`;
  const blocksDir = join(dir, "blocks");
  if (write) mkdirSync(blocksDir, { recursive: true });

  for (const s of declared) {
    const bid = blockId("prose", sectionKey(s.id));
    const node = {
      "@context": documentContext(typesForKind("prose")),
      "@id": `${base}/blocks/${bid}`,
      "@type": typesForKind("prose"),
      kind: "prose",
      title: s.title ?? s.id,
      // Pages only where the format has them: a notebook section is located
      // by cells, and a cell index is never written as a page number.
      ...(pagesOf(s) ? { pageStart: pagesOf(s)!.start, pageEnd: pagesOf(s)!.end } : {}),
      text: `../sections/${s.id}.md`,
      derivedFrom: manifestIri,
      sourceDocument: manifestIri,
      provenance: "ingested",
    };
    if (write) {
      writeFileSync(join(blocksDir, `${bid}.jsonld`), serialisedAtInstanceContext(`${JSON.stringify(node, null, 2)}\n`, join(blocksDir, `${bid}.jsonld`)));
    }
  }

  // A licence record is a finding somebody made by searching (issue #1023,
  // `check:source-licence`), not something this arm can derive. Rewriting the
  // manifest must carry it over, or re-running the arm silently turns
  // "unknown after five places searched" into "nobody looked".
  const manifestPath = join(dir, "manifest.jsonld");
  let licence: unknown;
  if (existsSync(manifestPath)) {
    try {
      licence = manifestLicence(JSON.parse(readFileSync(manifestPath, "utf-8")));
    } catch {
      licence = undefined;
    }
  }
  const manifest = {
    "@context": documentContext([termCurie("SourceDocument")]),
    "@id": manifestIri,
    "@type": [termCurie("SourceDocument")],
    title: st.doc_id,
    // The section NODE is `sections/sec-NNN` — the generator's name for it. The
    // full section id names the `.md` file beside it, which is not a node.
    contains: declared.map((s) => `${base}/sections/${sectionKey(s.id)}`),
    provenance: "ingested",
    // Out of `meta`, by the `licence-naming` row (finding D4, bean `gzkt`).
    ...licenceProperties(licence),
    meta: {
      doc_id: st.doc_id,
      source_file: st.source?.file ?? null,
      source_sha256: st.source?.sha256 ?? null,
      granularity: st.granularity ?? null,
      disposition: "ingested source material — attributed to its document, not folio content",
    },
  };
  if (write) writeFileSync(manifestPath, serialisedAtInstanceContext(`${JSON.stringify(manifest, null, 2)}\n`, manifestPath));

  return { docId: st.doc_id, blocks: declared.length, missing: [] };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("-o");
  const dir = i >= 0 ? argv[i + 1] : undefined;
  if (dir === undefined) {
    console.error("usage: l1-blocks.ts -o <staged-entry-dir> [--check]");
    console.error("  Nothing was checked. That is `could not determine`, not a pass.");
    process.exit(2);
  }
  const abs = resolve(dir);
  const r = buildL1(abs, !argv.includes("--check"));
  if (r.missing.length > 0) {
    console.error(`✗ ${r.docId}: ${r.missing.length} section(s) declared and not on disk:`);
    for (const m of r.missing.slice(0, 8)) console.error(`    ${m}`);
    console.error("  Nothing written — a manifest listing a file nobody can open is worse than none.");
    process.exit(1);
  }
  console.log(`ok  ${r.docId.padEnd(48)} ${r.blocks} block(s) + manifest`);
}
