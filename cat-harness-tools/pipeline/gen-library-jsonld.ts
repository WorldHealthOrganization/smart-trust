#!/usr/bin/env bun
/**
 * The ingest writer — Stage A/B artefacts become graph nodes.
 *
 * `pdf-structure.py` produces `structure.json` + `sections/*.md`, and
 * `extract-candidates.py` produces `candidates.json`. Both are flat. This
 * turns them into the same kind of graph the authored side emits, so one
 * loader, one `@context` and one QA sweep serve both populations.
 *
 * ```
 * library/<doc-id>/
 *   structure.json          Stage A  (input)
 *   sections/<sid>.md       Stage A  (input, and the prose block's text)
 *   candidates.json         Stage B  (input)
 *   manifest.jsonld         ← document node, ordered contains → sections
 *   sections/<sid>.jsonld   ← grouping node, ordered contains → blocks
 *   blocks/<bid>.jsonld     ← content blocks
 *   blocks/<bid>.md         ← an extracted claim's text
 * ```
 *
 * ## A tabular entry is a second rung, not the same one with holes
 *
 * A tabular entry carries its tabular record and no Stage A output at all.
 * It gets its own branch (`pipeline/tabular-nodes.ts`, bean `p67i`)
 * rather than a parameterised `buildDocumentNodes`, because the shapes differ
 * where it matters: a workbook's grouping node is a *sheet*, and a CSV has no
 * grouping node whatsoever — its tables hang off the manifest, because the
 * source genuinely has no sheets (`jg8s`).
 *
 * ```
 * library/<doc-id>/
 *   tabular.jsonld          (input — or tabular.csvw.json, once eief lands)
 *   manifest.jsonld         ← contains → sheets, OR → blocks for a CSV
 *   sheets/<key>.jsonld     ← grouping node, workbook only
 *   blocks/table-NNN.jsonld ← one per sheet, carrying the header vocabulary
 * ```
 *
 * ## Blocks own the files; a section is a manifest
 *
 * A section node carries no text. Its `contains` is an **ordered** list of
 * block ids, exactly as a chapter holds sections and a section holds
 * `blocks[]` on the authored side. The section's prose becomes one `prose`
 * block whose `text` points at the *existing* `sections/<sid>.md` — no copy,
 * so the 24.7 M extracted characters stay exactly where the corpus-grep
 * checklist already looks for them.
 *
 * Extraction is therefore incremental rather than all-or-nothing: whatever
 * Stage B recognises becomes a typed block, and the rest stays in the prose
 * block. As extractors improve, prose shrinks and typed blocks multiply,
 * without the section's identity or its `@id` changing.
 *
 * ## These nodes are NOT folio content
 *
 * `candidates.json` says so itself — *"proposals only … nothing here is folio
 * content and nothing here creates Lean"* — and the graph must not blur it.
 * Every node here carries `provenance: "ingested"` and is attributed to its
 * source document, so a query can always separate *what this paper claims*
 * from *what the folio claims*. Promotion into `content/` stays the separate,
 * deliberate act that `document-intake` Stage 4 describes.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/gen-library-jsonld.ts
 *   bun run cat-harness-tools/pipeline/gen-library-jsonld.ts --check
 *   bun run cat-harness-tools/pipeline/gen-library-jsonld.ts --doc <doc-id>
 *   bun run cat-harness-tools/pipeline/gen-library-jsonld.ts --entry <entry-dir>
 *   (any other argument is refused, and nothing is written)
 *
 * @module pipeline/gen-library-jsonld
 * @covers library, uploads
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { typesForKind } from "../schemas/kg/jsonld.ts";
import { ContributionRegistry, type FolioContribution } from "../schemas/content/contributions.ts";
import { loadContributionsSync } from "../schemas/kg/harness-config.ts";
import { contributionsRoot } from "./repo-root";
import {
  defaultInstancePrefixes,
  documentContext,
  instancePrefixes,
} from "../schemas/content/content-context.ts";
import { termCurie } from "../schemas/kg/namespaces.ts";
import { LABEL_PREFIXES } from "../schemas/constraints.ts";
import { findContentRepoRoot } from "./repo-root";
import { serialisedAtInstanceContext } from "./instance-document-context.ts";
import { declaredSubgraphNode } from "../scripts/kg-export.ts";
import { memberOf } from "../scripts/subgraph-node.ts";
import type { ImagesSidecar } from "../schemas/content/document-image.ts";
import { VECTOR_FIGURES_FILE, type VectorFigure, type VectorFiguresSidecar } from "../schemas/content/vector-figure.ts";
import { buildTabularNodes, tableBlockId, tabularShapeOf } from "./tabular-nodes.ts";
import { TABULAR_CSVW_FILENAME } from "../schemas/library/tabular-csvw.ts";
import {
  RECORDING_FILENAME,
  RecordingSchema,
  TRANSCRIPT_DIR,
  TranscriptSchema,
  type Transcript,
} from "../schemas/library/recording.ts";
import { readStructure, STRUCTURE_FILENAME, type BaseStructure, type DocumentStructure } from "../schemas/content/document-structure.ts";
import type { INGEST_RUNGS } from "../schemas/ui/site-indexes.ts";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.js";
import { applyVocabMapping, vocabMapping, type VocabMapping } from "../schemas/content/vocab-mapping.ts";
import type { SourceLicence } from "../schemas/library/source-licence.ts";
import { libraryAssetIri } from "../schemas/library/library-iri.ts";
import { instanceDirectories, readDeclaration } from "../schemas/kg/cat-harness.ts";
import {
  readTitleCandidates,
  resolveLibraryTitle,
  structureTitleCandidates,
  type LibraryTitleSource,
} from "./library-title.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { presentGroupsIn } from "../scripts/concern-groups.ts";
import { libraryEntryDirs, nonEntryDirs, type LibraryEntryDir } from "../scripts/lib/library-entry-graphs.ts";

/** A resolved manifest title and where it came from (issue #1794). */
export interface ManifestTitle {
  title: string;
  source: LibraryTitleSource;
  /** `<file> <field>` it was read from; absent for `slug`. */
  from?: string;
  /** The editor's record when it came from `title-correction.json` (bean `v8wg`). */
  correction?: { title: string; basis: string; corrected_on: string; bean?: string };
}

/**
 * The manifest fields that carry the title's provenance. `meta.title_source`
 * is one of `LIBRARY_TITLE_SOURCES`, and `check:library-qa` judges against it.
 */
function titleMeta(t: ManifestTitle, md?: Structure["metadata"]): Record<string, unknown> {
  return {
    title_source: t.source,
    title_from: t.from,
    // Bean `w6fu`: an editor's title and a corroborated one are each a CHECKED
    // title, and a corrected one keeps what extraction said beside it, so a
    // correction never passes for an extraction.
    title_verified: t.source === "editorial" || t.source === "corroborated" ? true : undefined,
    title_correction:
      t.source !== "editorial"
        ? undefined
        : md?.title_correction
          ? { ...md.title_correction, extracted: md.title ?? null }
          : t.correction
            ? { ...t.correction, extracted: null }
            : undefined,
  };
}

interface StructureSection {
  id: string;
  number: string | null;
  title: string;
  level: number;
  page_start: number | null;
  page_end: number | null;
  n_chars: number;
  n_words: number;
}

interface Structure {
  _schema?: string;
  doc_id: string;
  source?: { file?: string; sha256?: string; pages?: number };
  metadata?: {
    title?: string | null;
    authors_raw?: string | null;
    arxiv?: string | null;
    doi?: string | null;
    title_source?: string;
    title_verified?: boolean;
    title_correction?: { title: string; basis: string; corrected_on: string; bean?: string };
  };
  sections?: StructureSection[];
}

interface Candidate {
  kind: string;
  statement?: string;
  name?: string | null;
  /** The source's OWN number for the item ("FXREQ.001", "1-01"), never one an agent made up. */
  number?: string | null;
  /** What the source calls it ("nhwa-indicator", "good-practice-statement"). */
  source_kind?: string | null;
  /** The aspect extractor that proposed it (`extract-candidates.py`). */
  aspect?: string | null;
  strength?: string | null;
  section_file?: string;
  section_title?: string;
  pages?: string;
  formalization_candidate?: boolean;
  route_to?: string | null;
  /**
   * The item's printed fields, by name ("numerator", "denominator",
   * "dataSources"), as plain strings: a list the source prints is one string
   * joined with "; ". Copied into the block's `meta` as they are, so a
   * renderer can show an indicator or a requirement as fields rather than as
   * one paragraph. Never overrides the keys `candidateMeta` sets itself.
   */
  fields?: Record<string, string> | null;
}

interface Candidates {
  document_class?: string;
  validated?: boolean;
  disposition?: string;
  candidates?: Candidate[];
}

/**
 * The AUTHORED licence record beside an entry, carried into `manifest.jsonld`
 * by {@link licenceProperties}: the licence as `dcterms:license`, the record
 * verbatim as `licenceRecord` — the field `check-source-licence` reads.
 *
 * A sidecar because the manifest is generated: a record written into it by hand
 * was erased by the next run, so until 2026-09-30 no licence, `stated` or
 * `unknown`, could survive a regeneration (folio-assistant#1492). Its shape is
 * the checker's (`licenceProblem`), which judges it; this only carries it.
 */
export const LICENCE_FILENAME = "licence.json";

/**
 * The entry's licence record, or `undefined` when there is no sidecar. A
 * sidecar that does not parse is NOT absent: it comes through with a status the
 * checker rejects, so it reports as malformed rather than as "not recorded".
 */
export function readLicence(dir: string): unknown {
  const path = join(dir, LICENCE_FILENAME);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    return { status: "unparseable", note: `${LICENCE_FILENAME}: ${(e as Error).message}` };
  }
}

/** The layer this generator belongs to, whose `vocab-mappings/` it reads. */
const INSTANCE_ROOT = join(HARNESS_ROOT);

let licenceNaming: VocabMapping | undefined;

/**
 * A manifest's licence properties, from the `licence-naming` table — the
 * SAME row a glossary's `dcterms:license` comes from (finding D4 of
 * `docs/proposals/vocabulary-mappings-2026-10-02.md`, bean `gzkt`, owner
 * ruling 2026-10-03: "move it").
 *
 * Until then the licence was `meta.licence`, inside the `@json` literal, so an
 * RDF reader saw a glossary's licence and never a library item's. Now:
 *
 * | record            | `license` (`dcterms:license`) | `licenceRecord` (`@json`) |
 * |-------------------|-------------------------------|---------------------------|
 * | absent            | —                             | —                         |
 * | `stated`, an `id` | the `id`, as written          | the record, verbatim      |
 * | `unknown`, or any other | — never invented        | the record, verbatim      |
 *
 * The record stays whole because the three-state rule lives in it (`unknown`
 * with where somebody searched is not absent), and only `@json` keeps it.
 */
export function licenceProperties(record: unknown): Record<string, unknown> {
  if (record === undefined) return {};
  const r = record as SourceLicence;
  const license = r?.status === "stated" && typeof r.id === "string" && r.id.trim() !== "" ? r.id : undefined;
  licenceNaming ??= vocabMapping(INSTANCE_ROOT, "licence-naming");
  return applyVocabMapping(licenceNaming, { license, licenceRecord: record });
}

/**
 * The LaTeX source `arxiv-source.py` fetched beside an entry, as it records it
 * in `source/source.json`: the e-print's own provenance, and the files it
 * unpacked into `source/files/` (`.tex`, `.bib`, `.bbl`, `.sty`, `.cls`, and a
 * licence file when the bundle carries one).
 */
export interface LatexSource {
  url?: string;
  content_type?: string;
  sha256?: string;
  bytes?: number;
  fetched?: string;
  files?: Array<{ path: string; role: string; sha256: string; bytes: number }>;
}

export const LATEX_SOURCE_RECORD = "source/source.json";

/** Written by `retire-library-pdf.py` when it removes a processed PDF. */
export const SOURCE_MATERIALIZATION_RECORD = "source.materialization.json";

/**
 * The LaTeX source as its own `SourceDocument`, `partOf` the paper's manifest.
 *
 * It IS a source the library holds and blocks are ingested from: the overlay
 * (`latex-math-overlay.py`) takes section text from it. So it is typed the way
 * the PDF is, rather than with a term minted for it, and told apart by its
 * `@id` and by `partOf`. The files are listed in `meta` with their digests, so
 * each one is addressable from the graph and checkable against the disk.
 *
 * The licence is the paper's, one record for both renditions: arXiv states it
 * per submission, not per format.
 */
export function latexSourceNode(
  docId: string,
  src: LatexSource,
  title: string,
  licence: unknown,
  instance?: string,
  subgraphStart: string = findContentRepoRoot(),
): { path: string; content: string } {
  const iri = iriFor(docId, instance);
  return {
    path: "source/manifest.jsonld",
    content: node({
      "@id": iri("source/manifest"),
      "@type": [termCurie("SourceDocument")],
      title: `${title} (LaTeX source)`,
      partOf: iri("manifest"),
      provenance: "ingested",
      ...licenceProperties(licence),
      meta: {
        doc_id: docId,
        format: "latex",
        url: src.url,
        content_type: src.content_type,
        sha256: src.sha256,
        bytes: src.bytes,
        fetched: src.fetched,
        files: (src.files ?? []).map((f) => ({ ...f, path: `source/${f.path}` })),
        disposition: "ingested source material — the authors' LaTeX, attributed to its document, not folio content",
      },
    }, subgraphStart),
  };
}

/** `sec-000-1-introduction` → `sec-000`, the stable part of a section id. */
export function sectionKey(sectionId: string): string {
  const m = sectionId.match(/^(sec-\d+)/);
  return m ? m[1]! : sectionId;
}

/** Label prefix for a kind, without the colon. `prose` has none registered. */
function prefixFor(kind: string): string {
  const p = LABEL_PREFIXES[kind];
  return p ? p.replace(/:$/, "") : kind;
}

/**
 * Deterministic block id.
 *
 * Ordinal is the candidate's position *within its section*, so adding a
 * candidate to section 7 does not renumber section 3 — an `@id` is a public
 * contract once anything annotates it.
 */
export function blockId(kind: string, secKey: string, ordinal?: number): string {
  const base = `${prefixFor(kind)}-${secKey}`;
  return ordinal === undefined ? base : `${base}-${String(ordinal).padStart(2, "0")}`;
}

function docIri(docId: string, rest: string): string {
  return `library/${docId}/${rest}`;
}

/**
 * The entry's node IRIs. Every node keeps its relative `library/<id>/…` id
 * EXCEPT the manifest — the asset itself — which is named by the address its
 * JSON-LD is published at when the entry's layer is known (#1881,
 * `schemas/library/library-iri.ts`). A staged entry, outside any library, has no
 * layer yet and keeps the relative form until it is promoted and
 * regenerated; `--check` then reports it stale, so it cannot linger.
 */
function iriFor(docId: string, instance: string | undefined): (rest: string) => string {
  return (rest) => (rest === "manifest" && instance !== undefined ? libraryAssetIri(instance, docId) : docIri(docId, rest));
}

/**
 * The layer whose library holds `entryDir` — the DECLARED name of the
 * folder holding the library, when that folder declares a layer — else
 * `undefined`. The same answer `library-graph.ts` `instanceOf` gives, so the
 * IRI minted here and the page the viewer draws name one layer.
 *
 * The declared name, never the folder's (bean `j3ls`, as `t5dm` for
 * `instanceOf`): a separated layer's repository is wherever it was cloned,
 * and a separated layer cloned into `wim/` rewrote every manifest IRI to
 * `.../jsonld/wim/<id>/`, so all 813 nodes read as stale.
 */
export function libraryInstanceOf(entryDir: string): string | undefined {
  // Resolved first: from `library/<id>` the folder above is ".".
  const parent = dirname(resolve(entryDir));
  const flat = readDeclaration(dirname(parent))?.name;
  if (flat !== undefined) return flat;
  // Filed in a concern group, `library/<group>/<id>` (bean `6fez`): the
  // library is one folder higher. Only a group the library declares or
  // inherits counts, so an entry sitting in some other folder still gets
  // `undefined` rather than a guess. Measured 2026-11-02: cat-harness filed
  // its 74 entries into groups and every manifest IRI fell back to the
  // relative form, 5531 nodes stale.
  const grouped = dirname(parent);
  const library = presentGroupsIn(grouped, "library").has(basename(parent)) ? grouped : parent;
  const above = readDeclaration(dirname(library))?.name;
  if (above !== undefined) return above;
  // A library declared from WITHIN a sub-graph (cat-harness#1032:
  // `library/corpus/<group>/<id>`, the corpus a directory below the
  // layer): the declaring layer is further up. Walked to the nearest
  // declaration, and only when that layer's checkout declares THIS folder
  // a `library` corpus — never a guess from the folder's name. Measured
  // 2026-11-07: with the corpus moved, 5611 nodes read as stale.
  for (let at = dirname(dirname(library)); at !== dirname(at); at = dirname(at)) {
    const decl = readDeclaration(at);
    if (decl === undefined) continue;
    const declared = corpusDirectoriesForGraph(at, "library").map((d) => resolve(d));
    return declared.includes(library) ? decl.name : undefined;
  }
  return undefined;
}

/**
 * Where an entry's `library` subgraph is looked up: the layer whose library
 * holds it, when that layer declares a `library` of its own, so an entry in
 * a sibling's library is a member of THAT library. Asked from the content repo
 * root instead, every layer's manifests named cat-harness's. A layer
 * that only inherits the entry keeps the content repo root's answer: asked
 * from there, the several layers declaring it are ambiguous.
 */
export function librarySubgraphStart(locatedAt: string): string {
  if (libraryInstanceOf(locatedAt) === undefined) return findContentRepoRoot();
  // The layer is the nearest declaration above the entry, not always two
  // folders up: a library declared from within (`library/corpus/<id>`,
  // core#702) sits one folder deeper, and reading `library/` as the layer
  // found no declaration and fell back to the content repo root, so in an
  // index every such manifest named cat-harness's library.
  for (let at = dirname(locatedAt); at !== dirname(at); at = dirname(at)) {
    const decl = readDeclaration(at);
    if (decl === undefined) continue;
    return instanceDirectories(at, decl).some((d) => d.id === "library") ? at : findContentRepoRoot();
  }
  return findContentRepoRoot();
}

/**
 * One table transcribed from a paged source's pages: an entry of the
 * `tables` of a `tabular.csvw.json` that sits BESIDE `structure.json`
 * (a content layer's issue #224). Read raw, as `library-document.ts` reads it for the site:
 * the `fac:` fields below are the transcriber's, and none is required.
 */
export interface TranscribedTable {
  url: string;
  tableSchema?: { columns?: { titles?: unknown }[] };
  "fac:label"?: unknown;
  "fac:caption"?: unknown;
  "fac:pages"?: unknown;
  "fac:narrative"?: unknown;
}

/** The pages a transcribed table spans, in order; `[]` when it does not say. */
function tablePages(t: TranscribedTable): number[] {
  const p = t["fac:pages"];
  return Array.isArray(p) ? p.filter((n): n is number => Number.isInteger(n)).sort((a, b) => a - b) : [];
}

/** A kept figure, raster or vector, as a figure block reads it. */
export interface PlacedFigure {
  id: string;
  /** Relative to the entry. */
  file: string;
  page: number;
  narrative?: unknown;
}

/**
 * Every figure an entry KEEPS, in page order, raster before vector on a page:
 * `images.json`'s placed images and `vector-figures.json`'s renders whose role
 * an inspection set to `figure`.
 *
 * The vector half is why this exists. The figure blocks were built from
 * `images.json` alone, so a figure drawn in vector ink — a diagram, a chart,
 * a flow — reached the sidecar, the narrative queue and the viewer, and never
 * the graph: 330 such figures in 49 entries of one library had a render and a
 * description and no block (owner, 2026-11-14: "has no figures ... needs
 * reingesting"). A render with no file (`unrendered_reason`) and an
 * assembly-only record (`role: undetermined`) are not kept figures, so neither
 * becomes a block.
 */
export function placedFigures(
  images: ImagesSidecar | undefined | null,
  vectorFigures?: { figures?: readonly unknown[] | null } | null,
): PlacedFigure[] {
  const out: PlacedFigure[] = [];
  for (const img of images?.images ?? []) {
    if (img.role !== "figure" || img.basis === undefined) continue;
    out.push({ id: img.id, file: img.file, page: img.basis.page, narrative: img.narrative });
  }
  for (const raw of vectorFigures?.figures ?? []) {
    const f = raw as Partial<VectorFigure>;
    if (f.role !== "figure" || typeof f.file !== "string" || !f.file || typeof f.id !== "string") continue;
    if (typeof f.page !== "number" || !Number.isInteger(f.page)) continue;
    out.push({ id: f.id, file: f.file, page: f.page, narrative: f.narrative });
  }
  return out;
}

/** Everything one document contributes, as files to write. */
export function buildDocumentNodes(
  docId: string,
  structure: Structure,
  candidates: Candidates | undefined,
  hasSectionMd: (sid: string) => boolean,
  images?: ImagesSidecar,
  licence?: unknown,
  titled?: ManifestTitle,
  instance?: string,
  subgraphStart: string = findContentRepoRoot(),
  sourceMaterialization?: unknown,
  tables?: readonly TranscribedTable[],
  /** The owning layer's root, whose dependency closure types the blocks ({@link owningLayerRoot}). */
  typingRoot?: string,
  vectorFigures?: VectorFiguresSidecar | { figures?: readonly unknown[] | null } | null,
): Array<{ path: string; content: string }> {
  // Without a resolved title (a test, a caller with no disk), resolve from the
  // structure alone: the Info dictionary or a text heading, never the page-1
  // parse, then the slug. The walk passes one that has asked the catalogue.
  const resolvedTitle: ManifestTitle =
    titled ??
    (() => {
      const st = structureTitleCandidates(structure as unknown as Record<string, unknown>);
      const r = resolveLibraryTitle({ slug: docId, ...st.candidates });
      return { ...r, from: r.source === "slug" ? undefined : st.from[r.source] };
    })();
  const out: Array<{ path: string; content: string }> = [];
  const iri = iriFor(docId, instance);
  const sections = structure.sections ?? [];

  // Group candidates by the section file they were extracted from.
  const bySection = new Map<string, Candidate[]>();
  for (const c of candidates?.candidates ?? []) {
    const sid = (c.section_file ?? "").replace(/^sections\//, "").replace(/\.md$/, "");
    if (!sid) continue;
    const list = bySection.get(sid) ?? [];
    list.push(c);
    bySection.set(sid, list);
  }

  // Figures, by the page they sit on. Only FIGURES: of 164 placed images in
  // this corpus 140 are page scans, and a scan is the page itself rather than
  // something on it — `schemas/content/document-image.ts` carries the measurement.
  // `images: null` means the extractor could not look, which is not the same
  // as "no figures" and must not become an empty map silently; it does become
  // one here, but the sidecar keeps the reason and `pdf-images.py` exits 2.
  const figuresByPage = new Map<number, PlacedFigure[]>();
  for (const f of placedFigures(images, vectorFigures)) {
    const list = figuresByPage.get(f.page) ?? [];
    list.push(f);
    figuresByPage.set(f.page, list);
  }

  const sectionIris: string[] = [];

  // A figure belongs to the FIRST section whose page range contains it.
  //
  // Section ranges OVERLAP -- a section's `page_end` is the start page of the
  // next one, inclusive -- so without this a figure is emitted once per
  // containing section, every emission writing the SAME path with a different
  // `derivedFrom`. Measured 2026-09-22 on an IG library entry (`9789240093362-eng`)
  // (bean `imen`): page 71 falls inside FOUR sections, page 68 inside three,
  // page 30 inside two. Last write won, and `--check` then reported the losers
  // stale forever, because re-running reproduced the same race.
  //
  // It needed both an embedded outline (so sections have real ranges rather
  // than one page each) and placed raster figures, and no entry had both until
  // the WHO digital-health corpus arrived. The comment below on `page_end`
  // shows the single-page case WAS considered; the overlapping one was not.
  //
  // FIRST rather than last, on the owner's ruling of 2026-09-22 (issue #877):
  // it matches reading order, so a figure introduced at the end of a section
  // stays with the section that introduced it. Last is what the race happened
  // to land on and is not a reason.
  const figureOwned = new Set<string>();

  // Tables transcribed from the pages (`tabular.csvw.json` beside the
  // structure), placed like figures: in the FIRST section containing the
  // table's first page. Until this, the paged rung never read that file, so
  // a transcribed table had no block and its `fac:narrative` drafts (1464 in
  // one content layer) reached neither the graph nor the library viewer, though the
  // narrative queue offered them. The block carries the narrative as figure
  // blocks carry theirs: a copy, reviewed in the file it was copied from.
  const tableOwned = new Set<number>();
  const tableBlock = (t: TranscribedTable, i: number, owner: string): string => {
    const bid = tableBlockId(i);
    const pages = tablePages(t);
    const label = typeof t["fac:label"] === "string" && t["fac:label"] ? t["fac:label"] : bid;
    const caption = typeof t["fac:caption"] === "string" && t["fac:caption"] ? t["fac:caption"] : undefined;
    const headers = (t.tableSchema?.columns ?? []).map((c) => (typeof c.titles === "string" ? c.titles : ""));
    out.push({
      path: `blocks/${bid}.jsonld`,
      content: node({
        "@id": iri(`blocks/${bid}`),
        "@type": typesForKind("table"),
        kind: "table",
        label,
        title: caption,
        // The CSV, relative to the block, as `file` is for a figure.
        file: `../${t.url}`,
        headers: headers.length ? headers : undefined,
        pageStart: pages[0],
        pageEnd: pages[pages.length - 1],
        narrative: t["fac:narrative"] ?? undefined,
        derivedFrom: owner,
        sourceDocument: iri("manifest"),
        provenance: "ingested",
      }, subgraphStart),
    });
    return iri(`blocks/${bid}`);
  };

  for (const sec of sections) {
    const key = sectionKey(sec.id);
    const contained: string[] = [];

    // The section's own prose, pointing at the file Stage A already wrote.
    if (hasSectionMd(sec.id)) {
      const bid = blockId("prose", key);
      contained.push(iri(`blocks/${bid}`));
      out.push({
        path: `blocks/${bid}.jsonld`,
        content: node({
          "@id": iri(`blocks/${bid}`),
          "@type": typesForKind("prose"),
          kind: "prose",
          title: sec.title,
          pageStart: sec.page_start ?? undefined,
          pageEnd: sec.page_end ?? undefined,
          text: `../sections/${sec.id}.md`,
          derivedFrom: iri("manifest"),
          sourceDocument: iri("manifest"),
          provenance: "ingested",
        }, subgraphStart),
      });
    }

    // Typed blocks for whatever Stage B recognised in this section.
    const cands = bySection.get(sec.id) ?? [];
    cands.forEach((c, i) => {
      const bid = blockId(c.kind, key, i + 1);
      const statement = (c.statement ?? "").trim();
      contained.push(iri(`blocks/${bid}`));
      out.push({
        path: `blocks/${bid}.jsonld`,
        content: node({
          "@id": iri(`blocks/${bid}`),
          // A dependency's kind (a higher layer's `functional-requirement`
          // or `indicator`) is typed through the contribution registry; without
          // it such a node had no `@type` at all.
          "@type": candidateTypes(c.kind, typingRoot ?? subgraphStart),
          kind: c.kind,
          title: c.name ?? undefined,
          pageStart: sec.page_start ?? undefined,
          pageEnd: sec.page_end ?? undefined,
          text: statement ? `${bid}.md` : undefined,
          derivedFrom: iri(`sections/${key}`),
          sourceDocument: iri("manifest"),
          provenance: "ingested",
          meta: candidateMeta(c),
        }, subgraphStart),
      });
      if (statement) out.push({ path: `blocks/${bid}.md`, content: `${statement}\n` });
    });

    // Figures whose page falls in this section. A section with no `page_end`
    // claims only its start page — the same rule `pdf-tables.py` applies, so
    // a figure and a table on one page are attributed to the same section.
    const from = sec.page_start ?? undefined;
    const to = sec.page_end ?? sec.page_start ?? undefined;
    if (from !== undefined && to !== undefined) {
      for (let pg = from; pg <= to; pg++) {
        for (const img of figuresByPage.get(pg) ?? []) {
          // An earlier section already claimed it; `sections` is in document
          // order, so "already claimed" IS "first containing section".
          if (figureOwned.has(img.id)) continue;
          figureOwned.add(img.id);
          const bid = `figure-${img.id}`;
          contained.push(iri(`blocks/${bid}`));
          out.push({
            path: `blocks/${bid}.jsonld`,
            content: node({
              "@id": iri(`blocks/${bid}`),
              "@type": typesForKind("figure"),
              kind: "figure",
              // Relative to the block, as `text` already is for prose.
              file: `../${img.file}`,
              pageStart: pg,
              pageEnd: pg,
              // Carried through so a reader can see the description's STATE,
              // not merely its absence: "nobody has written one" and "a human
              // rejected the draft" are different facts.
              narrative: img.narrative ?? undefined,
              derivedFrom: iri(`sections/${key}`),
              sourceDocument: iri("manifest"),
              provenance: "ingested",
            }, subgraphStart),
          });
        }
      }
    }

    // Tables whose first page falls in this section, by the same rule.
    if (from !== undefined && to !== undefined) {
      (tables ?? []).forEach((t, i) => {
        const first = tablePages(t)[0];
        if (first === undefined || first < from || first > to || tableOwned.has(i)) return;
        tableOwned.add(i);
        contained.push(tableBlock(t, i, iri(`sections/${key}`)));
      });
    }

    const sIri = iri(`sections/${key}`);
    sectionIris.push(sIri);
    out.push({
      path: `sections/${key}.jsonld`,
      content: node({
        "@id": sIri,
        "@type": ["doco:Section"],
        title: sec.title,
        pageStart: sec.page_start ?? undefined,
        pageEnd: sec.page_end ?? undefined,
        // Ordered: reading order is the document's, and losing it would make
        // the section a bag rather than a sequence.
        contains: contained,
        derivedFrom: iri("manifest"),
        sourceDocument: iri("manifest"),
        provenance: "ingested",
      }, subgraphStart),
    });
  }

  // A table no section holds (no page, or a page outside every section) hangs
  // off the document itself, after the sections, rather than being dropped:
  // dropping it is the hiding this exists to end.
  const unplaced: string[] = [];
  (tables ?? []).forEach((t, i) => {
    if (!tableOwned.has(i)) unplaced.push(tableBlock(t, i, iri("manifest")));
  });

  const librarySubgraph = declaredSubgraphNode(subgraphStart, "library");
  out.push({
    path: "manifest.jsonld",
    content: node({
      "@id": iri("manifest"),
      "@type": [termCurie("SourceDocument")],
      // NEVER the unverified `structure.metadata.title` — the page-1 parse
      // (#1794, ruling of 2026-10-01). An editor's `title_correction` and a
      // corroborated extraction (bean `w6fu`, ruling of 2026-10-02 on #1838)
      // each have a slot. See `library-title.ts` for the order.
      title: resolvedTitle.title,
      contains: [...sectionIris, ...unplaced],
      provenance: "ingested",
      ...(librarySubgraph ? memberOf(librarySubgraph.iri) : {}),
      ...licenceProperties(licence),
      meta: {
        doc_id: docId,
        ...titleMeta(resolvedTitle, structure.metadata),
        source_file: structure.source?.file,
        source_sha256: structure.source?.sha256,
        pages: structure.source?.pages,
        // The PDF's own state once `retire-library-pdf.py` has removed it:
        // `referenced`, with the sha256 of the removed bytes and the two
        // places to get them back (the arXiv version or DOI, and the commit
        // that still holds the file). Absent while the PDF is here.
        source_materialization: sourceMaterialization ?? undefined,
        arxiv: structure.metadata?.arxiv ?? null,
        doi: structure.metadata?.doi ?? null,
        document_class: candidates?.document_class ?? null,
        extractor_validated: candidates?.validated ?? null,
        // Carried verbatim so a consumer cannot miss it.
        disposition:
          candidates?.disposition ??
          "ingested source material — attributed to its document, not folio content",
      },
    }, subgraphStart),
  });

  return out;
}

const contentPrefixes = new Map<string, Map<string, string>>();

/**
 * The layer prefixes a library node may use: this checkout's, plus every
 * layer the entry's owning layer (`subgraphStart`, defaulting to the content
 * repository root) declares as a dependency.
 *
 * `defaultInstancePrefixes` reads only the checkout this module sits in, so
 * run from a content repository it could not bind a dependency's prefix
 * (e.g. the science layer's) —
 * the prefix of the `Theorem` and `Definition` types that theorem candidates
 * carry — and every entry with a candidate threw. Measured on qou 2026-10-11:
 * 18 entries had no section nodes for that reason. `instancePrefixes` already
 * takes the layer root and walks its declared dependency chain; keyed per
 * `subgraphStart` so a mounted layer's library resolves its own dependencies.
 */
function libraryPrefixes(subgraphStart: string = findContentRepoRoot()): Map<string, string> {
  const root = resolve(subgraphStart);
  let prefixes = contentPrefixes.get(root);
  if (prefixes === undefined) {
    prefixes = new Map([...defaultInstancePrefixes(), ...instancePrefixes(root, root)]);
    contentPrefixes.set(root, prefixes);
  }
  return prefixes;
}

const contributionsByRoot = new Map<string, ContributionRegistry | null>();

/**
 * The block kinds the entry's owning layer (`subgraphStart`, defaulting to the
 * content repository) and its declared dependencies contribute — the DAK
 * layer's `functional-requirement`, `non-functional-requirement`, `indicator`
 * and the rest — loaded once per root, as `gen-block-jsonld` loads them.
 *
 * Rooted at the layer that OWNS the library entry, not at the checkout. From
 * the checkout root the registry held every mounted layer's kinds, so the same
 * committed node was typed by whatever happened to be mounted: a lower layer's
 * indicator candidates were typed by an upper DAK layer when mounted in an
 * index and as `cat-harness:Block` in the lower layer's own checkout, so no
 * committed file passed both checks. `loadContributionsSync` walks the root's
 * own declared dependencies, so a layer is typed only by kinds it can see in
 * any checkout. A root whose contributions cannot be loaded types only the core
 * kinds, which is what it did before.
 */
function contributedKinds(subgraphStart?: string): ContributionRegistry | undefined {
  const root =
    subgraphStart === undefined || resolve(subgraphStart) === resolve(findContentRepoRoot())
      ? contributionsRoot()
      : resolve(subgraphStart);
  if (!contributionsByRoot.has(root)) {
    try {
      contributionsByRoot.set(
        root,
        loadContributionsSync<FolioContribution, ContributionRegistry>(
          root,
          new ContributionRegistry(),
        ),
      );
    } catch {
      contributionsByRoot.set(root, null);
    }
  }
  return contributionsByRoot.get(root) ?? undefined;
}

/**
 * The layer a library entry belongs to, for typing its blocks: the nearest
 * directory above it that carries a layer declaration. An entry with none
 * above it (a bare content repository) is typed from the checkout, as before.
 */
export function owningLayerRoot(locatedAt: string): string {
  for (let at = dirname(resolve(locatedAt)); at !== dirname(at); at = dirname(at)) {
    if (readDeclaration(at) !== undefined) return at;
  }
  return contributionsRoot();
}

/**
 * A candidate's `@type`: its kind's, through the owning layer's contribution
 * registry (`subgraphStart`), or the generic library block class when no
 * dependency of that layer types the kind. An L1 library may hold another
 * layer's `indicator` without depending on that layer; its node is then still
 * a typed block, never one with no type and never one whose `@type` shifts when
 * the library is mounted into a host index that also mounts the other layer.
 */
export function candidateTypes(kind: string, subgraphStart?: string): string[] {
  const types = typesForKind(kind, contributedKinds(subgraphStart));
  return types.length ? types : [termCurie("Block")];
}

/**
 * What a candidate says about ITSELF that a reader of the node needs: the
 * source's own number, what the source calls it, its strength, which aspect
 * proposed it, and its printed `fields` (strings only; empty ones dropped). `undefined` when it says none of these, so a node built
 * from a candidate without them is byte-identical to before.
 */
export function candidateMeta(c: Candidate): Record<string, string> | undefined {
  const m: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.fields ?? {})) {
    if (typeof v === "string" && v.trim() !== "") m[k] = v;
  }
  if (c.number) m.source_number = c.number;
  if (c.source_kind) m.source_kind = c.source_kind;
  if (c.strength) m.strength = c.strength;
  if (c.aspect) m.aspect = c.aspect;
  return Object.keys(m).length ? m : undefined;
}

/** Serialise, dropping undefined so output is byte-stable. */
function node(doc: Record<string, unknown>, subgraphStart?: string): string {
  const clean: Record<string, unknown> = {
    "@context": documentContext((doc["@type"] as string[] | undefined) ?? [], { prefixes: libraryPrefixes(subgraphStart) }),
  };
  for (const [k, v] of Object.entries(doc)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    clean[k] = v;
  }
  return `${JSON.stringify(clean, null, 2)}\n`;
}

function readJson<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

/** Which ingest rung an entry is on — bean `p67i`. */
export type IngestRung = (typeof INGEST_RUNGS)[number];

/**
 * The input file that puts an entry on each rung, in precedence order.
 *
 * A table rather than a chain of `existsSync` in the walk: the decision is
 * then something a test can hold, and a rung added here cannot be one the
 * walk silently ignores. `check-l1-complete.ts` settled the same question the
 * same way with `KIND_SIDECAR`.
 */
export const RUNG_INPUT: ReadonlyArray<readonly [IngestRung, readonly string[]]> = [
  ["paged", [STRUCTURE_FILENAME]],
  ["tabular", ["tabular.jsonld", TABULAR_CSVW_FILENAME]],
  // A source RECORDED and not held (bean `scfh`): `referenced-source.py`
  // writes the record, and this writes the manifest, as for every other rung.
  ["referenced", ["referenced.json"]],
  // A recorded meeting or talk (bean `1r0p`): `recording-transcript.py`
  // writes the record and the transcripts, and this writes the manifest and
  // one `transcript` block per language.
  ["recording", [RECORDING_FILENAME]],
];

/**
 * `none` is a DETERMINED answer — the entry has no ingest input at all, which
 * is different from having one this could not read. The walk keeps those two
 * apart and reports them differently, because "never processed" and "present
 * but unreadable" point at different fixes.
 */
export function ingestRungOf(has: (file: string) => boolean): IngestRung {
  for (const [rung, inputs] of RUNG_INPUT) {
    if (inputs.some((f) => has(f))) return rung;
  }
  return "none";
}

/**
 * Directories that may sit between a manifest and a block.
 *
 * `sections/` for a paged document, `sheets/` for a workbook. A CSV uses
 * neither — its tables hang off the manifest, because the source has no
 * sheets to model (`jg8s`).
 */
export const GROUPING_DIRS: readonly string[] = ["sections", "sheets"];

/**
 * `library/<id>/blocks/<bid>` → `<bid>`; anything else → `undefined`.
 *
 * Narrow on purpose. A manifest's `contains` points at *sections* for a paged
 * document and at *blocks* for a CSV, so the same scan now sees both kinds of
 * reference — and taking the last path segment of either would enter
 * `page-001` into the block reference set, where it could mask an orphan of
 * that name. Only a reference that actually names a block counts as one.
 */
export function blockRefIn(ref: string): string | undefined {
  const parts = ref.split("/");
  const id = parts.pop();
  return id && parts.pop() === "blocks" ? id : undefined;
}

/**
 * Generated block files that nothing references any more — bean `d5f1`.
 *
 * This generator WRITES and never removed, so a block whose subject stopped
 * qualifying stayed on disk indefinitely. Measured 2026-09-20: reclassifying
 * 22 of 24 extracted images from `figure` to `logo` or `decorative` left 22
 * orphaned block files asserting, among other things, that the JSTOR
 * publisher mark is a figure of Milnor's paper. Nothing pointed at them, so
 * nothing failed — the directory simply carried false statements.
 *
 * It REPORTS and never deletes. Four of the five repository-health checks are
 * about artefacts accumulating and every one names a person as the actor; the
 * worked example in `deletion-requires-confirmation` is `plj1`, a workflow
 * whose shape deleted every open PR's preview without anybody deciding it.
 * Pruning here is a `--prune` a person passes.
 */
export function orphanedBlocks(
  dir: string,
  listFiles: (d: string) => string[],
  readText: (p: string) => string | undefined,
): string[] {
  const referenced = new Set<string>();
  // Everything that may point at a block. A paged document goes
  // manifest → section → block; a tabular one goes manifest → sheet → block,
  // or, for a CSV, manifest → block with NOTHING between, because a CSV has
  // no sheets. Scanning `sections/` alone made every table block of a tabular
  // entry look orphaned — and `--prune` deletes what this reports.
  const pointers: string[] = [join(dir, "manifest.jsonld")];
  for (const g of GROUPING_DIRS) {
    for (const f of listFiles(join(dir, g))) {
      if (f.endsWith(".jsonld")) pointers.push(join(dir, g, f));
    }
  }
  for (const p of pointers) {
    const body = readText(p);
    // ABSENT contributes nothing and is a determined empty: the manifest of an
    // entry that has not been generated names no blocks, and neither does a
    // grouping directory that is not there.
    if (body === undefined) continue;
    let contains: unknown;
    try {
      contains = (JSON.parse(body) as { contains?: unknown }).contains ?? [];
    } catch {
      // UNREADABLE is the other case: we cannot know what it references, and
      // an unknown reference set would make every block look orphaned. Refuse
      // to judge this directory rather than report a deletable list from it.
      return [];
    }
    if (!Array.isArray(contains)) return [];
    for (const c of contains as string[]) {
      if (typeof c !== "string") continue;
      const id = blockRefIn(c);
      if (id !== undefined) referenced.add(id);
    }
  }
  return listFiles(join(dir, "blocks"))
    .filter((f) => f.endsWith(".jsonld"))
    .map((f) => f.replace(/\.jsonld$/, ""))
    .filter((id) => !referenced.has(id))
    .sort();
}

/**
 * What one library entry becomes — three outcomes, and they are three facts.
 *
 * Extracted from the walk so the BRANCH is testable, not only the emitters it
 * calls (bean `p67i`). While this lived inline, the only way to exercise the
 * tabular rung was to put a dataset in `library/` — and a dataset in this
 * repository is content in the platform, so there was none, so the branch was
 * unreachable from CI. A tested function nothing calls and an untestable
 * caller are the same defect from two sides.
 */
export type EntryOutcome =
  | { state: "built"; rung: IngestRung; files: Array<{ path: string; content: string }> }
  /** No ingest input at all. A DETERMINED "not processed", and it passes. */
  | { state: "no-input" }
  /** An input is there and did not parse. Undetermined, and it fails. */
  | { state: "unreadable"; rung: IngestRung };

/** Resolve an entry's title by the authority order, or `undefined` if a record it names will not read. */
function entryTitle(
  dir: string,
  docId: string,
  pre: Parameters<typeof readTitleCandidates>[2],
  locatedAt: string = dir,
): ManifestTitle | undefined {
  const read = readTitleCandidates(dir, docId, pre, locatedAt);
  if (read.unreadable.length) return undefined;
  const r = resolveLibraryTitle(read.candidates);
  return {
    ...r,
    from: r.source === "slug" ? undefined : read.from[r.source],
    ...(r.source === "editorial" && read.correction ? { correction: read.correction } : {}),
  };
}

/**
 * `locatedAt` is where the entry WILL sit when it is not there yet. The
 * layer a manifest names is read off the entry's location, and a STAGED
 * entry sits in `ingest-staging/`, which belongs to whichever layer holds
 * the staging tree — not to the library it is being promoted into. Measured
 * 2026-10-06 (bean `apui`): a document staged and promoted into
 * a SIBLING layer's library carried a manifest `@id` naming
 * `cat-harness`, and `--check` called 37 of its nodes stale. So the files are
 * READ from `dir` and the identity is minted for `locatedAt`.
 */
export function buildEntryNodes(docId: string, dir: string, locatedAt: string = dir): EntryOutcome {
  const outcome = buildEntryNodesAtContentContext(docId, dir, locatedAt);
  if (outcome.state !== "built") return outcome;
  // Every node names the context of the layer it will LIVE in — `locatedAt`,
  // the same place its identity is minted for (bean folio-assistant-63q4).
  return { ...outcome, files: outcome.files.map((f) => ({ ...f, content: serialisedAtInstanceContext(f.content, join(locatedAt, f.path)) })) };
}

/** {@link buildEntryNodes} before the context switch: every node names the shared content context. */
function buildEntryNodesAtContentContext(docId: string, dir: string, locatedAt: string): EntryOutcome {
  const instance = libraryInstanceOf(locatedAt);
  const iri = iriFor(docId, instance);
  const subgraphStart = librarySubgraphStart(locatedAt);
  const librarySubgraph = declaredSubgraphNode(subgraphStart, "library");
  // Two ingest rungs reach this walk, and a tabular entry has no Stage A
  // output at all — no `structure.json`, no `sections/*.md` — so it is not a
  // `buildDocumentNodes` with different arguments. Its own branch, which is
  // `jg8s`'s rule one level up: model reality, do not force conformance.
  const rung = ingestRungOf((f) => existsSync(join(dir, f)));

  if (rung === "paged") {
    // Through the shared accessor (bean rkqp): a variant nobody declared is
    // `unreadable` here rather than half-rendered. The variant's own fields
    // (arXiv id, DOI, page count) are read off `raw`; a notebook has none of
    // them and they render as null, as a PDF without them always has.
    const parsed = readStructure(dir);
    // A legacy or overlaid record that predates the `_schema` union is read
    // as a PDF directly; its `raw` is the file as found, not a validated
    // `DocumentStructure`, which is what the cast below says.
    let read: BaseStructure;
    if (!("reason" in parsed)) {
      read = parsed;
    } else {
      const raw = readJson<Record<string, unknown>>(join(dir, STRUCTURE_FILENAME));
      if (raw && (raw._schema === "pdf-structure/v1" || !raw._schema) && Array.isArray(raw.sections)) {
        read = {
          variant: "pdf",
          doc_id: String(raw.doc_id ?? docId),
          title: ((raw.metadata as Record<string, unknown> | undefined)?.title as string | null) ?? null,
          sections: (raw.sections as Array<Record<string, unknown>>).map((s) => ({
            id: String(s.id),
            number: (s.number as string | null) ?? null,
            title: String(s.title ?? ""),
            level: Number(s.level ?? 1),
            n_chars: Number(s.n_chars ?? 0),
            n_words: Number(s.n_words ?? 0),
            locator: { kind: "pages" as const, start: Number(s.page_start ?? 1), end: Number(s.page_end ?? 1) },
          })),
          raw: raw as unknown as DocumentStructure,
        };
      } else {
        return { state: "unreadable", rung };
      }
    }
    const structure = read.raw as unknown as Structure;
    const candidates = readJson<Candidates>(join(dir, "candidates.json"));
    const images = readJson<ImagesSidecar>(join(dir, "images.json"));
    // Tables transcribed from the pages, when the entry has them. `rung` is
    // `paged`, so this file is not the entry's own record: it is beside it.
    const transcribed = readJson<{ tables?: TranscribedTable[] }>(join(dir, TABULAR_CSVW_FILENAME));
    const licence = readLicence(dir);
    // A catalogue node names a record that will not read: the title cannot be
    // determined, and the slug over a record that exists is the R8 defect.
    const titled = entryTitle(dir, docId, { structure: read.raw as Record<string, unknown> }, locatedAt);
    if (!titled) return { state: "unreadable", rung };
    const files = buildDocumentNodes(
      docId,
      structure,
      candidates,
      (sid) => existsSync(join(dir, "sections", `${sid}.md`)),
      images,
      licence,
      titled,
      instance,
      subgraphStart,
      readJson<unknown>(join(dir, SOURCE_MATERIALIZATION_RECORD)),
      Array.isArray(transcribed?.tables) ? transcribed.tables : undefined,
      owningLayerRoot(locatedAt),
      // Vector figures an inspection kept (`role: figure`), blocks beside the
      // raster ones — see `placedFigures`.
      readJson<{ figures?: unknown[] | null }>(join(dir, VECTOR_FIGURES_FILE)),
    );
    const latex = readJson<LatexSource>(join(dir, LATEX_SOURCE_RECORD));
    if (latex) files.push(latexSourceNode(docId, latex, titled.title, licence, instance, subgraphStart));
    return { state: "built", rung, files };
  }

  if (rung === "tabular") {
    const record =
      readJson<Record<string, unknown>>(join(dir, "tabular.jsonld")) ??
      readJson<Record<string, unknown>>(join(dir, TABULAR_CSVW_FILENAME));
    const shape = record ? tabularShapeOf(record) : undefined;
    // The record is there and we could not read it. Reporting an empty
    // document here would assert the dataset has no sheets, which is a claim
    // nobody made.
    if (!shape) return { state: "unreadable", rung };
    // A tabular record's `title` is its source FILE name (`tabularShapeOf`),
    // which is never a title. It goes in as a source file so nothing that
    // merely repeats it can be taken for one.
    const titled = entryTitle(dir, docId, { sourceFiles: shape.title ? [shape.title] : [] }, locatedAt);
    if (!titled) return { state: "unreadable", rung };
    return {
      state: "built",
      rung,
      files: buildTabularNodes(shape, {
        title: titled.title,
        iri,
        // Where the headers and shape came from. The manifest points at
        // sheets and blocks; without this nothing in the graph says which
        // record produced them.
        meta: { ...titleMeta(titled), tabular_record: record?.$schema },
        properties: {
          ...licenceProperties(readLicence(dir)),
          ...(librarySubgraph ? memberOf(librarySubgraph.iri) : {}),
        },
      }),
    };
  }

  if (rung === "referenced") {
    const record = readJson<{
      identity?: { title?: string };
      source?: { file?: string; sha256?: string; kind?: string; url?: string; canonical?: string; version?: string };
    }>(join(dir, "referenced.json"));
    // Two shapes of source (`schemas/library/referenced-source.ts`): one FILE, whose
    // bytes were hashed, or a PUBLICATION — a FHIR IG — identified by its
    // canonical and version, with nothing to hash. A record that is neither
    // is unreadable, and is reported so rather than guessed at.
    const src = record?.source;
    const published = src?.kind === "published" && !!src.canonical && !!src.version;
    if (!record || !src || (!published && !src.sha256)) return { state: "unreadable", rung };
    const titled = entryTitle(dir, docId, {
      referenced: record as Record<string, unknown>,
      sourceFiles: src.file ? [src.file] : [],
    }, locatedAt);
    if (!titled) return { state: "unreadable", rung };
    const manifest = {
      "@context": documentContext([termCurie("SourceDocument")], { prefixes: libraryPrefixes(subgraphStart) }),
      "@id": iri("manifest"),
      "@type": [termCurie("SourceDocument")],
      title: titled.title,
      // EMPTY on purpose: the entry holds no content nodes. The manifest says
      // the source exists and that none of it is held here.
      contains: [],
      // The same value every manifest carries; `disposition` below says that
      // none of the source's text is held.
      provenance: "ingested",
      ...(librarySubgraph ? memberOf(librarySubgraph.iri) : {}),
      ...licenceProperties(readLicence(dir)),
      meta: published
        ? {
            // NO new keys here: `meta` is an opaque `@json` literal (finding
            // D4, #1873), so a field added to it is invisible to any graph
            // reader. The publication's canonical, version and URL stay in
            // `referenced.json`, where `ReferencedSourceSchema` types them.
            doc_id: docId,
            ...titleMeta(titled),
            disposition: "referenced source — an external publication, nothing copied",
          }
        : {
            doc_id: docId,
            ...titleMeta(titled),
            source_file: src.file,
            source_sha256: src.sha256,
            disposition: "referenced source — recorded, text withheld by licence",
          },
    };
    return {
      state: "built",
      rung,
      files: [{ path: "manifest.jsonld", content: JSON.stringify(manifest, null, 2) + "\n" }],
    };
  }

  if (rung === "recording") {
    const parsed = RecordingSchema.safeParse(readJson<unknown>(join(dir, RECORDING_FILENAME)));
    if (!parsed.success) return { state: "unreadable", rung };
    const record = parsed.data;
    const titled = entryTitle(dir, docId, { sourceFiles: [record.source.file] }, locatedAt);
    if (!titled) return { state: "unreadable", rung };
    // The source-language transcript first, then each translation by tag.
    const tdir = join(dir, TRANSCRIPT_DIR);
    const transcripts: Transcript[] = [];
    if (existsSync(tdir)) {
      for (const f of readdirSync(tdir).filter((x) => x.endsWith(".json")).sort()) {
        const t = TranscriptSchema.safeParse(readJson<unknown>(join(tdir, f)));
        // check:l1-complete names a transcript that will not parse; the
        // manifest lists only what is there to read.
        if (t.success && f === `${t.data.lang}.json`) transcripts.push(t.data);
      }
    }
    const spoken = record.identity.language;
    transcripts.sort((a, b) => (a.lang === spoken ? -1 : b.lang === spoken ? 1 : a.lang.localeCompare(b.lang)));
    const files: Array<{ path: string; content: string }> = [];
    const contains: string[] = [];
    for (const t of transcripts) {
      const bId = `transcript-${t.lang}`;
      const bIri = iri(`blocks/${bId}`);
      contains.push(bIri);
      files.push({
        path: `blocks/${bId}.jsonld`,
        content: node({
          "@id": bIri,
          "@type": [termCurie("Block")],
          kind: "transcript",
          lang: t.lang,
          label: t.translated_from ? `Transcript (${t.lang}, translated from ${t.translated_from.lang})` : `Transcript (${t.lang})`,
          // The text, its segments and its review state are in the file.
          file: `../${TRANSCRIPT_DIR}/${t.lang}.json`,
          state: t.state,
          derivedFrom: iri("manifest"),
          sourceDocument: iri("manifest"),
          // Authored (LIBRARY_BLOCK_ORIGIN.transcript): who drafted it.
          provenance: t.drafted_by,
        }, subgraphStart),
      });
    }
    const manifest = {
      "@context": documentContext([termCurie("SourceDocument")], { prefixes: libraryPrefixes(subgraphStart) }),
      "@id": iri("manifest"),
      "@type": [termCurie("SourceDocument")],
      title: titled.title,
      contains,
      provenance: "ingested",
      ...(librarySubgraph ? memberOf(librarySubgraph.iri) : {}),
      ...licenceProperties(readLicence(dir)),
      meta: {
        doc_id: docId,
        ...titleMeta(titled),
        source_file: record.source.file,
        source_sha256: record.source.sha256,
        disposition: "recorded speech — the recording's transcripts, one per language",
      },
    };
    files.unshift({ path: "manifest.jsonld", content: JSON.stringify(manifest, null, 2) + "\n" });
    return { state: "built", rung, files };
  }

  // Not a parse failure to hide: an entry with no ingest input simply has not
  // been processed, and saying so is the point.
  return { state: "no-input" };
}

/** The flags `run` reads, and those that take a value. */
const FLAGS = new Set(["--check", "--prune", "--entry", "--doc"]);
const VALUED = new Set(["--entry", "--doc"]);

/**
 * An argument `run` would not read, or undefined. A flag it does not know
 * used to be ignored, so `--help` ran a full WRITE over every library
 * (2026-10-14, litlfred/dth-hrh): an unknown flag is now refused before
 * anything is written.
 */
export function unknownArgument(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!FLAGS.has(a)) return a;
    if (VALUED.has(a)) i++;
  }
  return undefined;
}

/**
 * Entry directories in `libraryDir`, dropping dotfiles and directories declared
 * for another graph typology (`nonEntryDirs`, e.g. `library/processes/` or
 * `library/skills/`).
 */
export function libraryEntriesIn(libraryDir: string): LibraryEntryDir[] {
  const others = nonEntryDirs(libraryDir);
  return libraryEntryDirs(libraryDir).filter(
    ({ slug, dir }) => !slug.startsWith(".") && !others.has(dir) && !others.has(resolve(dir)),
  );
}

async function run(): Promise<number> {
  const argv = process.argv.slice(2);
  const unknown = unknownArgument(argv);
  if (unknown !== undefined) {
    console.error(`gen-library-jsonld: unknown argument ${JSON.stringify(unknown)}; nothing written.`);
    console.error("usage: gen-library-jsonld.ts [--check] [--prune] [--doc <doc-id>] | --entry <dir>");
    return 2;
  }
  // ONE entry directory, wherever it is — a STAGED entry, before promotion.
  // `ingest-document.ts` runs this as the `referenced` rung's manifest arm
  // (bean `scfh`), so the manifest has one writer whether the entry is staged
  // or already in a library.
  if (argv.includes("--entry")) {
    const dir = argv[argv.indexOf("--entry") + 1]!;
    const outcome = buildEntryNodes(basename(dir), dir);
    if (outcome.state !== "built") {
      console.error(`gen-library-jsonld: ${dir}: ${outcome.state}`);
      return 1;
    }
    for (const f of outcome.files) {
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.content);
    }
    console.log(`ok  ${basename(dir)}  ${outcome.files.length} file(s), rung ${outcome.rung}`);
    return 0;
  }
  const check = argv.includes("--check");
  const only = argv.includes("--doc") ? argv[argv.indexOf("--doc") + 1] : undefined;

  const root = findContentRepoRoot();
  // EVERY declared library, not the one. This GENERATES the JSON-LD the whole
  // corpus is read through, so a library it skips is a set of documents that
  // exist on disk and nowhere in the graph, with a clean exit code over them.
  //
  // `directoryForGraph` REFUSES here — `library` has three homes since bean
  // `frs5` — which is the accessor doing its job rather than picking one.
  //
  // declared-path-literal: the convention fallback, at the call site so the
  // choice is visible. An absent directory is handled below as "nothing to
  // ingest", which is the determined-empty third state.
  const declaredLibraries = corpusDirectoriesForGraph(root, "library");
  const libraryDirs = (declaredLibraries.length > 0 ? declaredLibraries : [join(root, "library")]).filter(
    (d) => existsSync(d),
  );
  if (libraryDirs.length === 0) {
    console.log(`gen-library-jsonld: no library/ under ${root} — nothing to ingest.`);
    return 0;
  }

  // A document is (id, WHICH library), because an id alone no longer locates
  // one. A slug in two libraries is REFUSED rather than merged: node ids are
  // composed from the slug, so ingesting both would overwrite one and the next
  // run would look idempotent.
  const docs: Array<{ docId: string; dir: string }> = [];
  const seen = new Map<string, string>();
  for (const libraryDir of libraryDirs) {
    // Flat or filed in a concern group (`library/<group>/<slug>/`, bean `6fez`):
    // the slug is the docId either way, so ids do not move with the entry.
    for (const { slug: d, dir } of libraryEntriesIn(libraryDir)) {
      if (only && d !== only) continue;
      const prior = seen.get(d);
      if (prior !== undefined) {
        console.error(
          `gen-library-jsonld: slug "${d}" is declared in two libraries — ` +
            `${prior} and ${dir}. Node ids are composed from the slug, so ingesting ` +
            `both would silently overwrite one. Rename one, or declare only one library.`,
        );
        return 1;
      }
      seen.set(d, dir);
      docs.push({ docId: d, dir });
    }
  }

  const prune = argv.includes("--prune");
  const orphans: string[] = [];
  let pruned = 0;
  let written = 0;
  let unchanged = 0;
  let docsDone = 0;
  let blocks = 0;
  const stale: string[] = [];
  const skipped: string[] = [];
  // An input that is THERE and did not parse is NOT the same fact as an entry
  // with no input at all, and collapsing them would report an ingest failure
  // as "never ingested" — naming the wrong cause and the wrong fix.
  const unreadable: string[] = [];

  for (const { docId, dir } of docs) {
    const outcome = buildEntryNodes(docId, dir);
    if (outcome.state === "unreadable") {
      unreadable.push(docId);
      continue;
    }
    if (outcome.state === "no-input") {
      skipped.push(docId);
      continue;
    }
    const files = outcome.files;

    for (const f of files) {
      const abs = join(dir, f.path);
      const prev = existsSync(abs) ? readFileSync(abs, "utf-8") : undefined;
      if (prev === f.content) {
        unchanged++;
        continue;
      }
      if (check) {
        stale.push(`${docId}/${f.path}`);
        continue;
      }
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, f.content);
      written++;
    }
    docsDone++;
    blocks += files.filter((f) => f.path.startsWith("blocks/") && f.path.endsWith(".jsonld")).length;

    // After writing: what is on disk that no section points at any more?
    if (!check) {
      const found = orphanedBlocks(
        dir,
        (d) => (existsSync(d) ? readdirSync(d) : []),
        (f) => (existsSync(f) ? readFileSync(f, "utf-8") : undefined),
      );
      for (const id of found) {
        orphans.push(`${docId}/blocks/${id}.jsonld`);
        if (prune) {
          rmSync(join(dir, "blocks", `${id}.jsonld`), { force: true });
          // The `.md` sibling a typed block may carry goes with it, or it
          // becomes an orphan of an orphan.
          rmSync(join(dir, "blocks", `${id}.md`), { force: true });
          pruned++;
        }
      }
    }
  }

  if (unreadable.length) {
    // Not a warning. `skipped` is a DETERMINED "not ingested" and passes; this
    // is the undetermined one — a record is there and its shape is unknown —
    // and a run that could not determine something has not cleared it.
    console.error(
      `\n${unreadable.length} document(s) carry an ingest input this could ` +
        `not read — present, but not reduced: ${unreadable.join(", ")}\n` +
        `Neither "not ingested" nor "empty" is true of them.`,
    );
  }

  if (skipped.length) {
    console.warn(
      `${skipped.length} document(s) have neither structure.json nor a ` +
        `tabular record — not ingested, not silently counted as empty: ` +
        `${skipped.slice(0, 5).join(", ")}` +
        (skipped.length > 5 ? ` …` : ""),
    );
  }

  if (check) {
    if (stale.length) {
      console.error(
        `\n${stale.length} library node(s) stale or missing:\n` +
          stale.slice(0, 20).map((s) => `  ${s}`).join("\n") +
          (stale.length > 20 ? `\n  … and ${stale.length - 20} more` : "") +
          `\n\nRun: bun run cat-harness-tools/pipeline/gen-library-jsonld.ts`,
      );
      return 1;
    }
    if (unreadable.length) return 1;
    console.log(`gen-library-jsonld --check: ${unchanged} node(s) up to date.`);
    return 0;
  }

  console.log(
    `gen-library-jsonld: ${docsDone} document(s), ${blocks} block(s), ` +
      `${written} file(s) written, ${unchanged} unchanged` +
      (pruned ? `, ${pruned} orphan(s) pruned` : ""),
  );
  if (orphans.length > 0 && !prune) {
    // A finding, not a failure: the nodes that matter are correct, and what
    // to do about the leftovers is a person's call.
    console.log();
    console.log(`  ${orphans.length} orphaned block file(s) — referenced by no section:`);
    for (const o of orphans.slice(0, 10)) console.log(`      ${o}`);
    if (orphans.length > 10) console.log(`      … and ${orphans.length - 10} more`);
    console.log(`  These are stale generator output. Remove with --prune, once you have looked.`);
  }
  return unreadable.length ? 1 : 0;
}

if (import.meta.main) {
  run()
    .then((c) => process.exit(c))
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}
