#!/usr/bin/env bun
/**
 * Is a `library/<bib-slug>/` entry complete as L1 source content? L1 source
 * to L1 KG is not complete while a required derived artefact is missing.
 *
 * Each requirement is `met`, `unmet`, or `not-derivable`. A requirement whose
 * derivation is not built yet is reported as `not-derivable`, never as a pass
 * and never dropped silently.
 *
 * This reports only: it does not open a bean or move the document back to
 * `uploads/` on failure.
 *
 * Usage:
 *   bun run cat check:l1-complete                 # every entry in library/
 *   bun run cat check:l1-complete library/<slug>  # one
 *   bun run cat check:l1-complete -- --json
 *   bun run cat check:l1-complete -- --write   # commit the verdict as a sidecar
 *
 * Exit: 0 complete (or nothing to check), 1 a requirement unmet, 2 could not check.
 * An unmet requirement in {@link QA_ONLY} is a QA finding: reported and
 * written, never exit 1.
 *
 * @module scripts/check-l1-complete
 * @covers library
 */
import { noteAbsent, splitDeclared } from "./lib/declared-presence.ts";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  ARCHIVE_CONTENTS_SCHEMA_ID,
  ArchiveContentsSchema,
  isArchiveMimetype,
} from "../schemas/library/archive-contents.ts";
import { LIBRARY_BLOCK_ORIGIN, ProvenanceSchema, isIngested } from "../schemas/content/attribution.ts";
import { NarrativeSlotSchema, narrativesOfSlot, type NarrativeSlot } from "../schemas/content/narrative.ts";
import { STRUCTURE_FILENAME, structureOf } from "../schemas/content/document-structure.ts";
import {
  TABULAR_RECORDS_SCHEMA_ID,
  TabularRecordsSchema,
  isTabularMimetype,
} from "../schemas/library/tabular-records.ts";
import { TABULAR_CSVW_FILENAME, TABULAR_CSVW_SCHEMA_ID, TABULAR_TABLES_DIR, TabularCsvwSchema } from "../schemas/library/tabular-csvw.ts";
import {
  RECORDING_FILENAME,
  RECORDING_SCHEMA_ID,
  RecordingSchema,
  TRANSCRIPT_DIR,
  TRANSCRIPT_SCHEMA_ID,
  TranscriptSchema,
  isRecordingMimetype,
  segmentsCanonical,
  type Transcript,
} from "../schemas/library/recording.ts";
import { DESCRIBABLE_ROLES, ImagesSidecarSchema } from "../schemas/content/document-image.ts";
import { VECTOR_LABELS_FILE, VectorLabelsSidecarSchema } from "../schemas/content/vector-labels.ts";
import {
  VECTOR_FIGURES_DIR,
  FIGURE_DATA_DIR,
  VECTOR_FIGURES_FILE,
  VectorFiguresSidecarSchema,
} from "../schemas/content/vector-figure.ts";
import { LICENCE_FILENAME } from "../pipeline/gen-library-jsonld.ts";
import { TITLE_CORRECTION_FILE } from "../pipeline/library-title.ts";
import { COVER_FILENAME } from "./library-graph.ts";
import { NARRATIVE_BEARING, narrativesIn } from "./narratives.ts";
import { DEFAULT_NARRATIVE_LANG } from "./lib/narrative-display.ts";
import { readHarnessConfig, TranslationConfigSchema } from "../schemas/kg/harness-config.ts";

/**
 * A slot's state(s) for a one-line detail: one state for the single form,
 * `lang:state` per entry for a list (bean `cat-tools-e1lo`, stage 3).
 */
function slotStates(slot: NarrativeSlot): string {
  return narrativesOfSlot(slot)
    .map((n) => (n.lang ? `${n.lang}:${n.state}` : n.state))
    .join(", ");
}
import { SUMMARIES_FILE } from "../schemas/content/block-summary.ts";
import { DocumentErrataSchema, ERRATA_FILE } from "../schemas/content/document-errata.ts";
import { DocumentFootnotesSchema, FOOTNOTES_FILE } from "../schemas/content/document-footnotes.ts";
import { KEYWORDS_FILE } from "../schemas/library/library-keywords.ts";
import { ENTRY_EXTRACTION_FILE } from "../schemas/library/entry-extraction.ts";
import { extractionAdvisories, type ExtractionAdvisory } from "./entry-extraction.ts";
import { entryDirs, entryItems, sidecarDefects, summaryLangs, tally } from "./summaries.ts";
import { againstOrUsage, buildQaResult, qaResultPath, qaResultState, writeQaResult, type QaResultState } from "./qa-results.ts";
import { resolveQaLocation, type QaLocation } from "./qa-store.ts";
import { REFERENCED_SOURCE_SCHEMA_ID, ReferencedSourceSchema } from "../schemas/library/referenced-source.ts";
import { corpusDirectoriesForGraph, instanceConfigFor } from "../schemas/kg/harness-config.js";
import { instanceDirectoryForGraph } from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { entrySubgraphDirs, libraryEntryDir, libraryEntryDirs, nonEntryDirs } from "./lib/library-entry-graphs.ts";
import { defaultGraphTypologies, type GraphTypologyRegistry } from "../schemas/kg/graph-typology-registry.ts";

export type State = "met" | "unmet" | "not-derivable";

export interface Requirement {
  name: string;
  state: State;
  detail: string;
}

export interface EntryReport {
  slug: string;
  /**
   * The library this entry is in, repo-relative — present only when there is
   * more than one, so a single-library layer's output is unchanged.
   *
   * A slug alone stopped locating an entry when `library` gained a second home
   * (bean `frs5`): the report printed `library/milnorlink/` and
   * `library/who-pub-tps-931/` identically while they sat in different
   * layers. Same reasoning as the per-directory root names in
   * `graph-index.ts` and the MCP server's GRAPH_ROOTS — a line that says where
   * something came from is useless the moment two sources share a name.
   */
  library?: string;
  requirements: Requirement[];
  /**
   * ADVISORY, never gating: per extracted kind (contents, sections, figures,
   * tables, references, glossary, footnotes, summaries), found N / partial /
   * none in source / not extracted — from the entry's `extraction.json` and its artefacts
   * (`scripts/entry-extraction.ts`). A paged entry only. The requirements
   * above pass an entry whose tables, references or glossary were never
   * looked for; this says so without failing it (owner, 2026-11-14).
   */
  advisories?: ExtractionAdvisory[];
}

/**
 * Requirements the four existing rungs can actually satisfy today. Anything
 * else belongs in the not-derivable list below, with the bean that would move
 * it here.
 */
/**
 * What SHAPE of document is this entry? — measured 2026-09-20.
 *
 * ## The regression this exists to undo
 *
 * `derivableRequirements` applied every requirement to every entry. Two of
 * them — `tabular-records` and `archive-contents` — already ask the entry
 * what it is and answer *"not tabular (application/pdf)"*. The reverse was
 * never done, so a CSV was asked for `structure.json`, `sections/`, `blocks/`
 * and an `images.json`, with `image-descriptions` advising a reader to *"run
 * scripts/pdf-images.py"* on a spreadsheet.
 *
 * That was a wrong report until `pn6j` gated promotion on it. Then it became
 * a PERMANENT BLOCKER: a CSV cannot have a chapter tree, so it could never be
 * promoted, and the gate I had just added made every non-paged document
 * un-ingestable. Found by running a real CSV through the live pipeline rather
 * than by reading the code.
 *
 * ## Why the sidecar and not the mimetype
 *
 * The obvious route is `source.mimetype_sniffed`, which the other two
 * requirements use. It cannot work here: a CSV has **no magic bytes**, so its
 * source block honestly records `mimetype_sniffed: null` and
 * `mimetype_source: "unrecognised"` — `p67i` established that routing a CSV
 * cannot be a sniff and must not become an extension guess.
 *
 * What an entry DOES carry is the sidecar its rung wrote. That is a fact
 * about the entry rather than a claim about the file, which is the same
 * argument `nso8` makes for sniffing over extensions, one level up.
 */
export type EntryKind = "paged" | "tabular" | "archive" | "referenced" | "recording" | "undetermined";

/** Which sidecar identifies which shape. One place, so a fourth rung adds one line. */
/**
 * WHAT AN ENTRY MAY CONTAIN — a closed set, and `3psh` is why it is closed.
 *
 * ## The defect
 *
 * `pdf-images.py` once derived the doc id differently from `pdf-structure.py`
 * and wrote `images.json` into a SIBLING of the entry it belonged to. That is
 * fixed, but the SHAPE arrives from any arm handed `-o <library-root>` with a
 * doc id the entry does not have — and this session reproduced it by hand,
 * following `ingest`'s own printed next-step (#1035).
 *
 * Measured 2026-09-23, on a real complete entry:
 *
 * | the entry | verdict |
 * |---|---|
 * | clean | passes |
 * | + a nested orphan directory holding an `images.json` with the WRONG `doc_id` | **passes** |
 * | + a wholly unexpected loose file | **passes** |
 *
 * Because no requirement said what an entry may NOT contain. Both duplicates
 * in the original incident were byte-identical to the entry's own
 * `images.json` apart from `doc_id`, and both were committed unnoticed.
 *
 * ## An allowlist, and why that is not the denylist `3psh` rejects
 *
 * The orphan was named `260725032v1` — a perfectly plausible doc id. Nothing
 * about the NAME was wrong; it was wrong that it was there at all. A denylist
 * would have to predict the next arm's spelling, which is the drift this
 * cluster of defects is made of. A closed set predicts nothing: it is what
 * the pipeline produces, and an arm that starts writing something new must
 * say so here, once.
 *
 * ## Where each name comes from, so the list is auditable rather than assumed
 *
 * Directories are the arms' outputs — `sections/` and `blocks/` from the rung
 * and `l1-blocks.ts`, `images/` from `pdf-images.py`, `ocr/` from
 * `pdf-ocr.py`. Sidecars are {@link KIND_SIDECAR}'s three, plus the two every
 * paged entry carries. Verified against the corpus the same day: 21 entries,
 * every child accounted for — `sections`, `structure.json`, `manifest.jsonld`,
 * `blocks` and `images.json` on all 21, `images/` on 13, `ocr/` on 2, and
 * **nothing else anywhere**.
 */
// `figures/` is the vector arm's renders — `pdf-vector-figures.py`, bean `ay3x`.
// `sheets/` is a workbook's grouping nodes, one per sheet, the tabular
// counterpart of `sections/` (`pipeline/tabular-nodes.ts`, written by
// gen-library-jsonld under its `GROUPING_DIRS`).
// `transcript/` is a recording's transcripts, one file per language (bean `1r0p`).
// `figure-data/` is a figure transcribed as data for a redrawing (owner, 2026-10-31).
// `tables/` is the CSV files of tables transcribed from a PDF's pages, named by `tabular.csvw.json` (who-iris#224).
export const ENTRY_DIRECTORIES: readonly string[] = ["sections", "sheets", "blocks", "images", "ocr", VECTOR_FIGURES_DIR, FIGURE_DATA_DIR, TRANSCRIPT_DIR, TABULAR_TABLES_DIR];

/** Sidecars an entry may carry beyond {@link KIND_SIDECAR}'s kind markers. */
export const ENTRY_SIDECARS: readonly string[] = [
  "images.json",
  // The entry's first-page thumbnail, written by `library:covers` (#437).
  COVER_FILENAME,
  VECTOR_LABELS_FILE,
  VECTOR_FIGURES_FILE,
  "manifest.jsonld",
  SUMMARIES_FILE,
  // Authored: errors in the source's own text, recorded beside it and never
  // substituted for it (owner, 2026-11-11, "add to L1 doc schema errata").
  ERRATA_FILE,
  // The PDF's footnotes and the marks that call them, written by the
  // `pdf-footnotes.py` arm (owner, 2026-11-11, "also foot notes/marks").
  FOOTNOTES_FILE,
  // LEGACY: the entry's LSI keywords, once written here by `library-keywords.ts`
  // (issue #2302). Keywords are now built at publish into docs/assets/keywords/
  // (cat-harness#1144); still allowed until the committed files are removed,
  // and the `library-keywords` health check counts any that remain.
  KEYWORDS_FILE,
  // Authored, not produced by an arm: the licence record gen-library-jsonld
  // carries into manifest.jsonld as dcterms:license + licenceRecord (#1492, D4).
  LICENCE_FILENAME,
  // A dataset's addressable values, written by an ingest tool beside its
  // tabular.jsonld (e.g. codata-ingest, bean uyp8; resolved by liquid-values).
  "values.json",
  // A slide deck's accessibility report, written by `slides-structure.py`
  // beside its structure.json (bean `scfh`, issue #1614).
  "accessibility.json",
  // A JSON-LD context the SOURCE ITSELF publishes among its files, held so a
  // documentLoader can serve it offline instead of fetching it (bean `9y9j`,
  // the linked-data voice's `ld-no-context-fetched-at-run-time`; first case:
  // PROV-JSONLD's, pinned by sha256 in schemas/content/prov.ts).
  "context.jsonld",
  // A smart-kg L1 graph document (publication → section → recommendation)
  // DERIVED from this entry by a DAK base layer's scripts/extract-smart-kg-l1.ts and
  // kept beside it, owner default (bean `8pzh`); its --check keeps it current.
  // `.json`, not `.jsonld`: its @context is smart-kg's, not held here.
  "smart-kg-l1.json",
  // Two more smart-kg L1 3.0 graphs (bean `mffs`): an L1 entry's layout as
  // specialisations of its library nodes (`l1-specialise.ts`), and a DAK's
  // Component 1 citations (`extract-dak-l1-references.ts`, no longer written
  // by default). Each has a --check. The first is `.jsonld`: its context is
  // generated in that DAK base layer's `kg/` and served offline by that
  // package's document loader, so it is linked data, not JSON shaped like it.
  "smart-kg-l1-library.jsonld",
  "smart-kg-l1-dak-references.json",
  // Authored, not produced by an arm: an editor's title, read by
  // gen-library-jsonld over the extracted one (bean `v8wg`).
  TITLE_CORRECTION_FILE,
  // A volume scan's proposed article boundaries, written by
  // `volume-separation.py propose` (cat-harness-tools#132). Proposed, never
  // applied: a person confirms a span before it becomes an entry.
  "separation-proposal.json",
  // A scanned entry's advisory formula-region bounding boxes, written by
  // `pdf-formula-regions.py` (cat-harness-tools#131, bean `f0hv`). Advisory,
  // never transcribed and never gated.
  "formula-regions.json",
  // The two review-anchor arms of the document adapter (`docx-structure.py`,
  // `pdf-line-map.py`): the .docx's own structure and the PDF's page/line map,
  // written beside `structure.json` so a public comment citing "page 12, line
  // 340" of a circulated draft still resolves after the folio is edited. Each
  // names the source it was read from by sha256, like every sidecar here.
  "docx-structure.json",
  "pdf-line-map.json",
  // Stage B's proposals (`extract-candidates.py`, schema ingest-candidates/v1),
  // which gen-library-jsonld turns into typed blocks: requirements, indicators
  // and normative statements in a DAK or DTH source (cat-harness-tools#1356).
  "candidates.json",
  // Which extractors ran over the entry and what each found, per kind
  // (`scripts/entry-extraction.ts`, the last ingest arm). Advisory only.
  ENTRY_EXTRACTION_FILE,
];

/**
 * The children of an entry that ARE the source it was derived from — held in
 * the entry, byte for byte.
 *
 * An entry normally holds what the arms derived and keeps its source in
 * `uploads/`. Some sources must stay with their derivation: a draft circulated
 * for public comment is FROZEN, every comment cites a page and line of those
 * exact bytes, and moving them is the edit the freeze forbids. The closed set
 * above cannot name such a file, because its name is the document's.
 *
 * So the rule is a fact the entry already records, not a name: a child is a
 * held source when a sidecar of this entry names it as its `source` (`file`,
 * or a `files[]` member's `path`) AND its bytes hash to the sha256 that
 * sidecar recorded. A misfiled arm output, a stray upload or a later edit of
 * the source fails the hash and stays a stray — the `3psh` reasoning holds,
 * because nothing is admitted by its spelling.
 */
export function heldSources(dir: string, sidecars: Iterable<string>): Set<string> {
  const claims = new Map<string, Set<string>>();
  const claim = (file: unknown, sha: unknown) => {
    if (typeof file !== "string" || typeof sha !== "string" || !file || file.includes("/") || file.includes("\\")) return;
    if (!claims.has(file)) claims.set(file, new Set());
    claims.get(file)!.add(sha.toLowerCase());
  };
  for (const name of sidecars) {
    if (!name.endsWith(".json") && !name.endsWith(".jsonld")) continue;
    const f = join(dir, name);
    if (!existsSync(f)) continue;
    let src: unknown;
    try {
      src = (JSON.parse(readFileSync(f, "utf-8")) as Record<string, unknown>)?.source;
    } catch {
      continue; // the owning requirement reports an unparseable sidecar
    }
    if (!src || typeof src !== "object") continue;
    const s = src as Record<string, unknown>;
    claim(s.file, s.sha256);
    if (Array.isArray(s.files)) for (const m of s.files) if (m && typeof m === "object") claim((m as Record<string, unknown>).path, (m as Record<string, unknown>).sha256);
  }
  const held = new Set<string>();
  for (const [file, shas] of claims) {
    const p = join(dir, file);
    try {
      if (!statSync(p).isFile()) continue;
      if (shas.has(createHash("sha256").update(readFileSync(p)).digest("hex"))) held.add(file);
    } catch {
      continue; // absent: the source is held elsewhere, which is the normal case
    }
  }
  return held;
}

export const KIND_SIDECAR: ReadonlyArray<readonly [EntryKind, string]> = [
  ["paged", STRUCTURE_FILENAME],
  ["tabular", "tabular.jsonld"],
  // The CSVW record that replaces v1 for delimited and workbook sources, and
  // carries the same `source` block (bean `urat`, owner ruling 2026-10-20).
  ["tabular", TABULAR_CSVW_FILENAME],
  ["archive", "contents.jsonld"],
  // Recorded, text withheld by licence — `referenced-source.py`, bean `scfh`.
  ["referenced", "referenced.json"],
  // A recorded meeting or talk — `recording-transcript.py`, bean `1r0p`.
  ["recording", RECORDING_FILENAME],
];

/**
 * The entry's shape, or `undetermined`.
 *
 * Third state, and it is NOT "assume paged". An entry with no sidecar at all
 * is one no rung has run on, and asking it for a chapter tree would report a
 * defect where the fact is that nothing has been derived yet.
 */
/**
 * Distinct figure labels the document's own text DECLARES, as a lower bound.
 *
 * ## Why this exists — bean `m4xy`
 *
 * `pdf-images.py` recovers the RASTER layer. WHO's conceptual figures —
 * frameworks, maturity models, taxonomies, process flows — are drawn in
 * VECTOR, so they are never extracted, and `image-descriptions` went on
 * reporting `met` over documents whose every figure was missing. Measured
 * 2026-09-22 across a DAK base layer's `library/`:
 *
 *   9789240120747-eng   declares 6 captioned figures, places ZERO images,
 *                       and reported "0 image(s), 0 describable and all
 *                       described" — a DETERMINED empty that is true about
 *                       raster and misleading about figures.
 *   9789240010567-eng   declares 42, places 17, and the 17 are logos, a
 *                       photograph and a barcode. On page 92 the five
 *                       component logos were extracted and Fig. 5.6.2, the
 *                       diagram they sit INSIDE, was not.
 *
 * ## What this does NOT do
 *
 * **It does not compare counts.** Declared figures and placed images are not
 * commensurable and a ratio between them asserts a coverage this cannot
 * establish: the MAPS Toolkit declares 4 figures and places 162 images, of
 * which 63 are blank fragments of one title page. `placed >= declared` would
 * read as "covered" there and be wrong in both directions.
 *
 * So the number is reported and never graded, which is the same rule the
 * repository applies to every count it prints.
 *
 * ## Lower bound, and the matching is stated rather than assumed
 *
 * A caption is matched only at the START of a line, because a cross-reference
 * ("see Fig. 3.1") runs mid-sentence. That misses a caption typeset inline and
 * counts one that begins a line for another reason, so the figure is a LOWER
 * BOUND on what the document declares — said here rather than left for a
 * reader to infer from a bare integer.
 */
export function declaredFigureLabels(sectionsDir: string): Set<string> {
  return new Set(declaredFigureCaptions(sectionsDir).keys());
}

/**
 * Every figure the text declares, with its CAPTION TEXT where it has one.
 *
 * ## Why this is the primitive and `declaredFigureLabels` is derived from it
 *
 * Two scanners over one corpus is the defect #1001 just took out of the
 * navbar: they agree by maintenance, and the agreement has to be re-bought on
 * every change. The label count and the caption text are two questions about
 * the same lines, so they are answered by ONE regex here and
 * `declaredFigureLabels` is `keys()`. Its semantics are unchanged — any
 * line-start mention, the lower bound its own docstring describes.
 *
 * ## A caption is `Fig. N.` + text. A cross-reference is `Fig. N` + a sentence
 *
 * Measured on `9789240120747-eng`, 2026-09-23: NINE line-start matches for SIX
 * declared figures. Three of the nine are cross-references that wrapped onto a
 * new line —
 *
 * ```
 * Fig. 1).                      the tail of "(see Fig. 1)."
 * Fig. 5 illustrates the M&E    a cross-reference
 * Fig. 6 further illustrates    a cross-reference
 * Fig. 3. DIIG digital health   an actual caption
 * ```
 *
 * — and only the `Set` dedupe hid them, because their labels happened to
 * coincide with real captions. On a document where they did not, the count
 * would be wrong and nothing would say so.
 *
 * So the period after the number is the discriminator, and it is a fact about
 * the typesetting rather than a threshold somebody chose. That distinction is
 * why this change needs no number: `m4xy` refuses to pick a coverage
 * threshold, having found the distribution continuous across three orders of
 * magnitude.
 *
 * ## `null` is a third state, not an empty caption
 *
 * A label maps to `null` when the line is a mention without a caption — a
 * cross-reference, or a caption this lower bound could not read. It does NOT
 * mean "declared with an empty caption". A consumer deciding whether the
 * captions can stand in for the images must be able to tell "this figure has
 * no caption text here" from "this figure has a caption and it is blank", and
 * collapsing them is how a gate passes over content it never saw.
 *
 * A label seen BOTH ways keeps the caption: one real caption and three
 * cross-references is a captioned figure, which is what `Fig. 5` is above.
 */
/**
 * What the VECTOR arm recovered for this entry, as a sentence — or `""`.
 *
 * Bean `a8wy`. Appended to `image-descriptions`' detail and to **nothing
 * else**: it never changes a state. The raster arm and the vector arm answer
 * different questions about the same page, and `m4xy`'s rule holds over the
 * pair as it does over declared-versus-placed — labels recovered and figures
 * declared are not commensurable, so no ratio between them is computed here.
 *
 * The empty string is returned for three DIFFERENT situations, and that is
 * deliberate rather than sloppy: no sidecar, an undetermined sidecar, and a
 * determined-empty one all mean "this line has nothing to add". Which of the
 * three it is belongs in the sidecar, where the reason is, not smuggled into a
 * gate's one-line detail.
 */
export function vectorLabelNote(dir: string): string {
  const f = join(dir, VECTOR_LABELS_FILE);
  if (!existsSync(f)) return "";
  let pages;
  try {
    ({ pages } = VectorLabelsSidecarSchema.parse(JSON.parse(readFileSync(f, "utf-8"))));
  } catch {
    // A sidecar that will not parse is a defect of THIS file, and
    // `entry-contents` is where a malformed sidecar is reported. Saying it
    // twice would make one defect look like two.
    return "";
  }
  if (pages === null || pages.length === 0) return "";
  const labels = pages.reduce((n, p) => n + p.labels.length, 0);
  return (
    ` The vector arm recovered ${labels} positioned label(s) across ${pages.length} page(s) ` +
    `that declare a figure — see ${VECTOR_LABELS_FILE}; which labels belong to which figure ` +
    `is NOT established (bean a8wy).`
  );
}

/**
 * How far the vector FIGURE arm reaches into the BARE figures — bean `ay3x`.
 *
 * Measured against the bare set and nothing wider, on purpose: a figure with
 * caption text is already covered by the owner's 2026-09-23 caption ruling,
 * so counting it here would credit the arm with work the caption did. The
 * bare figures are the only ones neither a raster image nor a caption reaches.
 *
 * Three disjoint answers per bare label, and only the first is coverage:
 *
 * - `shown` — an INSPECTED render says it shows this figure (`shows`), and
 *   carries a narrative. Somebody looked; the figure has a description.
 * - `candidate` — a render exists on a page whose caption candidates name the
 *   label, and nobody has looked. NOT coverage: a candidate may be a
 *   cross-reference, so the page may not show the figure at all.
 * - `neither` — no render names it. The arm did not reach it.
 *
 * `undefined` when there is no vector sidecar, or it is undetermined — the
 * third state, carried rather than flattened to "reached nothing".
 */
export function vectorFigureReach(
  dir: string,
  bare: readonly string[],
): { shown: string[]; candidate: string[]; neither: string[]; renders: number; inspected: number } | undefined {
  const f = join(dir, VECTOR_FIGURES_FILE);
  if (!existsSync(f)) return undefined;
  let figures;
  try {
    ({ figures } = VectorFiguresSidecarSchema.parse(JSON.parse(readFileSync(f, "utf-8"))));
  } catch {
    // A malformed sidecar is `entry-contents`' to report, not this line's.
    return undefined;
  }
  if (figures === null) return undefined;
  const rendered = figures.filter((x) => x.file !== null);
  const inspected = rendered.filter((x) => x.basis.method === "inspection");
  const shownSet = new Set(
    inspected.filter((x) => x.narrative !== undefined && narrativesOfSlot(x.narrative).some((n) => n.text)).flatMap((x) => x.shows ?? []),
  );
  const candidateSet = new Set(
    rendered.filter((x) => x.basis.method === "assembly").flatMap((x) => x.captionLabels),
  );
  const shown = bare.filter((l) => shownSet.has(l));
  const candidate = bare.filter((l) => !shownSet.has(l) && candidateSet.has(l));
  const neither = bare.filter((l) => !shownSet.has(l) && !candidateSet.has(l));
  return { shown, candidate, neither, renders: rendered.length, inspected: inspected.length };
}

/** {@link vectorFigureReach} as a sentence for a gate's detail, or `""`. */
export function vectorFigureNote(dir: string, bare: readonly string[]): string {
  const r = vectorFigureReach(dir, bare);
  if (!r || r.renders === 0) return "";
  const list = (xs: string[]) => (xs.length ? ` (Fig. ${xs.join(", ")})` : "");
  return (
    ` The vector figure arm rendered ${r.renders} caption page(s), ${r.inspected} inspected; of the ` +
    `${bare.length} bare figure(s), ${r.shown.length} shown by an inspected render${list(r.shown)}, ` +
    `${r.candidate.length} named on a render nobody has inspected${list(r.candidate)}, ` +
    `${r.neither.length} on no render${list(r.neither)} — see ${VECTOR_FIGURES_FILE} (bean ay3x).`
  );
}

export function declaredFigureCaptions(sectionsDir: string): Map<string, string | null> {
  const figures = new Map<string, string | null>();
  let files: string[];
  try {
    files = readdirSync(sectionsDir).filter((f) => f.endsWith(".md"));
  } catch {
    // No sections directory is "could not determine", not "declares none" —
    // the same third state the rest of this file keeps.
    return figures;
  }
  // ONE pattern, two captures. `(\.[ \t]+(\S.*))?` is the caption and is
  // optional, which is what makes a mention and a caption the same match with
  // different groups rather than two regexes that must be kept in step.
  // `Fig\.?`: the dot after `Fig` is optional, because `9789240101197-eng`
  // writes `Fig 1. Public health supply chain ...`; requiring it hid nine of
  // that handbook's figures from this check (the same fix as `CAPTION` in
  // pdf-vector-labels.py).
  const FIGURE = /^[ \t]*(?:Fig\.?|Figure)[ \t]*(\d+(?:\.\d+)*)(?:\.[ \t]+(\S.*))?/gm;
  for (const f of files.sort()) {
    let body: string;
    try {
      body = readFileSync(join(sectionsDir, f), "utf-8");
    } catch {
      continue;
    }
    for (const m of body.matchAll(FIGURE)) {
      const label = m[1]!;
      const caption = m[2]?.trim();
      // A caption never loses to a later bare mention -- see the docstring.
      if (caption) figures.set(label, caption);
      else if (!figures.has(label)) figures.set(label, null);
    }
  }
  return figures;
}

/**
 * The locales an entry's narratives are owed in: the `translation.supportedLocales`
 * its layer declares, else the schema's default (the six UN languages).
 *
 * Bean `d5f1`'s Done-when is *"a description per configured language"*. The
 * gate used to ask only whether an image had ANY narrative, so an entry whose
 * figures were described in English alone read `met`: on 2026-10-30 the drain
 * reported "0 remaining English-only figures" while smart-ra's copy of the
 * DPI-H reference architecture held 31, which nothing could see.
 *
 * The entry is `<instance>/library/<slug>`, so its layer is two levels up.
 */
export function entryLocales(dir: string): string[] {
  let raw: unknown = {};
  try {
    raw = (readHarnessConfig(resolve(dir, "..", "..")) as { translation?: unknown } | null)?.translation ?? {};
  } catch {
    raw = {};
  }
  const parsed = TranslationConfigSchema.safeParse(raw);
  return (parsed.success ? parsed.data : TranslationConfigSchema.parse({})).supportedLocales;
}

/**
 * Which of these images lack an authored narrative in which locale: `images`
 * counts the images with any gap, `byLocale` how many miss each locale (only a
 * locale with a gap is in it). An entry with no `lang` is in
 * {@link DEFAULT_NARRATIVE_LANG}, as `narrativeFor` reads it; a `not-authored`
 * entry covers nothing.
 */
export function localeGaps(
  images: readonly { narrative?: NarrativeSlot }[],
  locales: readonly string[],
): { images: number; byLocale: Map<string, number> } {
  const byLocale = new Map<string, number>();
  let short = 0;
  for (const img of images) {
    if (img.narrative === undefined) continue;
    const have = new Set(
      narrativesOfSlot(img.narrative)
        .filter((n) => n.state !== "not-authored")
        .map((n) => n.lang ?? DEFAULT_NARRATIVE_LANG),
    );
    const missing = locales.filter((l) => !have.has(l));
    if (missing.length) short++;
    for (const l of missing) byLocale.set(l, (byLocale.get(l) ?? 0) + 1);
  }
  return { images: short, byLocale };
}

export function entryKind(has: (file: string) => boolean): EntryKind {
  for (const [kind, file] of KIND_SIDECAR) if (has(file)) return kind;
  return "undetermined";
}

/**
 * Requirements reported as QA findings, never as a failed check (owner,
 * 2026-10-15: "make QA check"). An unmet one stays `unmet` in the entry's
 * verdict and in the `library-qa` sidecar `--write` commits, so the QA views
 * still show it; it just does not set the exit code, so it cannot stop a
 * publish. `image-descriptions` is here because a document gains images the
 * moment it is ingested, while a narrative for each is written later by a
 * person or an agent: a DAK IG's library stopped every publish on
 * 42 undescribed figures (folio-assistant run 38801998160).
 */
export const QA_ONLY: ReadonlySet<string> = new Set(["image-descriptions"]);

/** The unmet requirements that fail the check: every unmet one not in {@link QA_ONLY}. */
export function blockingUnmet(requirements: readonly Requirement[]): Requirement[] {
  return requirements.filter((q) => q.state === "unmet" && !QA_ONLY.has(q.name));
}

/** Requirements that only make sense for a PAGED document. */
export const PAGED_ONLY: readonly string[] = [
  "structure",
  "structure-note",
  "sections",
  "blocks",
  "image-descriptions",
  "block-summaries",
];

/**
 * Does this requirement apply to an entry of this shape?
 *
 * `undetermined` keeps EVERYTHING, deliberately. An entry nothing has run on
 * must not quietly satisfy the gate by having no applicable requirements —
 * that is the vacuity this repository keeps paying for, and it would let an
 * empty directory promote.
 */
/**
 * Requirements for any entry whose ingest GENERATES blocks — paged and
 * tabular, not an archive. `narrative-provenance` was paged-only until the
 * first tabular entry (CODATA 2022, bean `uyp8`): a tabular sheet becomes a
 * `table` block claiming "ingested", and that claim is exactly what this
 * requirement checks, so exempting it would leave it unchecked.
 */
export const BLOCK_BEARING: readonly string[] = ["narrative-provenance"];

export function appliesTo(requirement: string, kind: EntryKind): boolean {
  if (kind === "paged" || kind === "undetermined") return true;
  // A recording's transcripts are blocks too, each naming who drafted it.
  if (BLOCK_BEARING.includes(requirement)) return kind === "tabular" || kind === "recording";
  return !PAGED_ONLY.includes(requirement);
}

/**
 * The `source` block, from whichever sidecar this entry actually has.
 *
 * ONE definition, deliberately. This logic existed THREE times —
 * `tabular-records`, `archive-contents` and `technical-metadata` each rolled
 * their own, all reading `structure.json` only. Teaching the first to look
 * beyond it left the other two reporting `no source block — re-run the ingest
 * rung` for a CSV whose `tabular.jsonld` carries a complete one: advice that
 * was wrong, and that re-running would not have fixed.
 *
 * One rule in three places is three rules, and this file has already paid for
 * that once today — `narrative-review` restated the review queue's bearing
 * list and went stale at the same moment the queue's copy did (bean `04vl`).
 */
export function sourceBlockOf(dir: string): Record<string, unknown> | undefined {
  for (const [, file] of KIND_SIDECAR) {
    const f = join(dir, file);
    if (!existsSync(f)) continue;
    try {
      const d = JSON.parse(readFileSync(f, "utf-8")) as Record<string, unknown>;
      if (d.source) return d.source as Record<string, unknown>;
    } catch {
      continue; // the owning requirement reports an unparseable sidecar
    }
  }
  return undefined;
}

function derivableRequirements(dir: string, registry: GraphTypologyRegistry = defaultGraphTypologies): Requirement[] {
  const out: Requirement[] = [];
  const has = (p: string) => existsSync(join(dir, p));

  // ── contents — `3psh`. WHAT AN ENTRY MAY NOT CONTAIN ────────────────────
  //
  // Every other requirement here asks whether something is PRESENT. None
  // asked what else is, so an entry passed with an orphan directory inside
  // it — measured 2026-09-23 on a real complete entry, which passed clean,
  // passed again with a nested orphan holding an `images.json` under the
  // WRONG `doc_id`, and passed a third time with a wholly unexpected loose
  // file. See {@link ENTRY_DIRECTORIES} for the incident this comes from.
  //
  // REPORTED, NEVER REMOVED. `deletion-requires-confirmation`: an agent does
  // not delete a durable artefact on its own initiative, and an orphan is
  // evidence of which arm misfiled it. Naming it is the whole job.
  //
  // `unmet` rather than a third state, and deliberately: unlike a vector
  // figure no arm can read, this is a file somebody can move or delete. It
  // is actionable, so it blocks.
  {
    const allowed = new Set([...ENTRY_DIRECTORIES, ...ENTRY_SIDECARS, ...KIND_SIDECAR.map(([, f]) => f)]);
    let children: string[];
    try {
      children = readdirSync(dir);
    } catch {
      // Unreadable is not empty. A directory this cannot list has not been
      // shown to be clean, and saying "contents: met" over it would be the
      // pass-by-default every other check here refuses.
      children = [];
      out.push({ name: "contents", state: "unmet", detail: `could not list ${dir}` });
    }
    // The entry's GENERATED README (bean `qgjh`, owner 2026-09-30: a page per
    // library item "like bootstrap readmes", written by `library-readmes.ts`).
    // Allowed only when it carries that generator's marker region: a README
    // an arm or a person dropped here without it is still a stray.
    const generatedReadme = (c: string): boolean => {
      if (c !== "README.md") return false;
      try {
        return readFileSync(join(dir, c), "utf-8").includes("<!-- kg:subgraph:begin -->");
      } catch {
        return false;
      }
    };
    // A DECLARED library sub-graph inside the entry (bean `8pzh` item 1, owner
    // 2026-10-12: L1 extraction output lives beside its entry and is published
    // with it). The layer declares the directory with a kind that is
    // `within: "library"`, so it is the entry's own KG content, not an arm's
    // misfiled output — the same lookup the library publisher follows. An
    // UNDECLARED directory there is still a stray.
    const declaredSubgraphs = new Set(
      entrySubgraphDirs(dir, registry).map((d) => relative(resolve(dir), d.abs).split(/[\\/]/)[0]),
    );
    const held = heldSources(dir, [...allowed].filter((c) => children.includes(c)));
    const stray = children.filter(
      (c) => !allowed.has(c) && !c.startsWith(".") && !generatedReadme(c) && !declaredSubgraphs.has(c) && !held.has(c),
    );
    if (stray.length > 0) {
      out.push({
        name: "contents",
        state: "unmet",
        detail:
          `${stray.length} unexpected child(ren): ${stray.sort().join(", ")}. ` +
          `An entry holds only ${[...allowed].sort().join(", ")} — an arm handed ` +
          `-o with a doc id this entry does not have writes here (bean 3psh). ` +
          `Reported, not removed.`,
      });
    } else if (children.length > 0) {
      out.push({
        name: "contents",
        state: "met",
        detail:
          `${children.length} child(ren), all declared` +
          (held.size ? `; ${held.size} held source(s) matching their recorded sha256: ${[...held].sort().join(", ")}` : ""),
      });
    }
  }

  const structPath = join(dir, STRUCTURE_FILENAME);
  if (!has(STRUCTURE_FILENAME)) {
    out.push({ name: "structure", state: "unmet", detail: "no structure.json" });
  } else {
    let s: Record<string, unknown> | null = null;
    try {
      s = JSON.parse(readFileSync(structPath, "utf-8")) as Record<string, unknown>;
    } catch (e) {
      out.push({
        name: "structure",
        state: "unmet",
        detail: `structure.json will not parse: ${e instanceof Error ? e.message : e}`,
      });
    }
    if (s) {
      const secs = Array.isArray(s.sections) ? s.sections.length : 0;
      // Conformance to ONE of the declared variants (issue #1112; bean rkqp
      // made it a base with variants, `schemas/content/document-structure.ts`). A file
      // that parses but conforms to none is not "met": a second spelling of a
      // field is how gen-library-jsonld crashed on `section_id`. Read through
      // `structureOf`, the accessor every reader shares, so this gate cannot
      // accept a shape the readers do not.
      const base = structureOf(s);
      const ok = !("reason" in base);
      out.push({
        name: "structure",
        state: secs > 0 && ok ? "met" : "unmet",
        detail: ok
          ? `${s._schema ?? "no $schema"}, toc_source=${s.toc_source}, ${secs} sections`
          : base.reason,
      });
      // `structure_note` is where a rung says what it did NOT claim -- notably
      // that no chapter tree was inferred (bean 6xaz). Its absence is not a
      // failure; an empty structure with no note is, because nothing records
      // whether the emptiness was determined.
      if (secs === 0 && !s.structure_note) {
        out.push({
          name: "structure-note",
          state: "unmet",
          detail: "no sections and no structure_note — nothing says whether that was determined",
        });
      }
    }
  }

  for (const [name, rel] of [
    ["sections", "sections"],
    ["blocks", "blocks"],
  ] as const) {
    const n = has(rel) && statSync(join(dir, rel)).isDirectory() ? readdirSync(join(dir, rel)).length : -1;
    out.push({
      name,
      state: n > 0 ? "met" : "unmet",
      detail: n < 0 ? `no ${rel}/ directory` : `${n} files`,
    });
  }

  // Narrative review state (bean `ju0u`).
  //
  // Every narrative-bearing file in the entry must hold a VALID narrative
  // record. The schema carries the rules that matter — text and state agree,
  // anything written names its drafter, only a human confirms, a rejection
  // keeps its reason — so this gate does not restate them and cannot drift
  // from them.
  //
  // A `draft` is reported but is NOT a failure: it is work waiting on a
  // person, and `bun run cat narratives` is where they see it. Calling it unmet
  // would make an unreviewed queue indistinguishable from a broken arm.
  {
    // The list and the shape both come from `scripts/narratives.ts`, which is
    // the review queue itself. They were RESTATED here — the same three files,
    // and the same `doc.narrative` single-narrative read — and went stale in
    // exactly the same way, at the same time, for the same reason: `d5f1` put
    // 24 draft narratives into `library/<slug>/images.json`, which holds MANY
    // at `images[i].narrative` and has no top-level `narrative` at all. So
    // this gate reported "no narrative-bearing file in this entry" over four
    // entries holding 24 drafts, while the queue reported zero awaiting review
    // (bean `04vl`).
    //
    // One rule in two places is two rules. Importing the queue's own
    // definition means a third bearing file cannot be added to one and missed
    // by the other.
    const bad: string[] = [];
    const counts: Record<string, number> = {};
    let looked = 0;
    for (const name of NARRATIVE_BEARING) {
      if (!has(name)) continue;
      let doc: Record<string, unknown>;
      try {
        doc = JSON.parse(readFileSync(join(dir, name), "utf-8")) as Record<string, unknown>;
      } catch {
        continue; // the owning requirement reports an unparseable file
      }
      for (const { narrative } of narrativesIn(doc)) {
        looked++;
        counts[narrative.state] = (counts[narrative.state] ?? 0) + 1;
      }
      // A `narrative` key that `narrativesIn` could not parse is a DEFECT,
      // not an absence — reported rather than skipped, which is what the
      // old `safeParse` branch was for and must not be lost in the move.
      if ("narrative" in doc && !NarrativeSlotSchema.safeParse(doc.narrative).success) {
        bad.push(`${name}: narrative will not parse`);
      }
    }
    const tally = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ");
    out.push({
      name: "narrative-review",
      state: bad.length ? "unmet" : "met",
      detail: bad.length
        ? bad.slice(0, 2).join("; ")
        : looked === 0
          // Precise about WHICH zero: `who-pub-tps-931` has an images.json
          // with 121 page scans and no narrative in any of them, which is not
          // the same fact as having no bearing file at all.
          ? "no narrative in any bearing file"
          : tally,
    });
  }

  // Errata — errors in the SOURCE's own text (owner, 2026-11-11, who-iris
  // card Q-ODD-1 = A, "add to L1 doc schema errata"). Optional and authored:
  // an entry with none is not incomplete. Unmet only when the file does not
  // mean what it says: it will not parse, names another entry, or points at a
  // block the entry does not have.
  {
    const r = errataRequirement(dir);
    if (r) out.push(r);
    const f = footnotesRequirement(dir);
    if (f) out.push(f);
  }

  // Block summaries — the agent-summary QA sidecar (owner, 2026-09-24).
  //
  // ADVISORY, like `narrative-review`: the backlog is reported and never
  // failed on. An entry is not incomplete because nobody has summarised its
  // sections yet — the owner's word was "slowly drain", and a gate that
  // failed on a backlog of 1325 would be a gate everybody learned to ignore.
  //
  // What IS unmet is a sidecar that does not mean what it says: one that will
  // not parse, names another entry, or records a summary of a block that is
  // not there or of a text the block no longer points at. The schema cannot
  // see any of those; this is the semantic half of its QA.
  {
    const defects = sidecarDefects(dir);
    if (defects.length) {
      out.push({ name: "block-summaries", state: "unmet", detail: defects.slice(0, 2).join("; ") });
    } else {
      const items = entryItems(dir);
      const t = tally(items);
      // Summaries are owed in each configured locale, like image descriptions
      // (owner, 2026-11-11). Advisory too: the gap is reported, not failed on.
      const locales = entryLocales(dir);
      const gaps = new Map<string, number>();
      for (const it of items) {
        const langs = summaryLangs(it);
        if (!langs.length) continue;
        for (const l of locales) if (!langs.includes(l)) gaps.set(l, (gaps.get(l) ?? 0) + 1);
      }
      const owed = gaps.size ? `; missing a configured language: ${[...gaps].map(([l, n]) => `${l} (${n})`).join(", ")}` : "";
      out.push({
        name: "block-summaries",
        state: "met",
        detail:
          t.prose === 0
            // A determined zero, said as one.
            ? "no prose block with text to summarise"
            : `${t.summarised} of ${t.prose} prose block(s) summarised ` +
              `(${t.draft} draft, ${t.confirmed} confirmed); backlog ${t.backlog} ` +
              `(${t.stale} stale, ${t.rejected} rejected)${owed} — advisory`,
      });
    }
  }

  // Tabular records (bean `p67i`).
  //
  // Scoped the same way as `archive-contents`, and for the same reason: the
  // entry's OWN `source.mimetype_sniffed` says whether it came from a
  // workbook, so this is derived rather than judged. That field carries the
  // refined answer — an `.xlsx` reads as the spreadsheet type, not as
  // `application/zip` — because the router and the recorder ask one function.
  //
  // A CSV is the case the mimetype cannot cover: it has no magic bytes and is
  // honestly `unrecognised`, so an entry with a `tabular.jsonld` is checked on
  // its merits whatever its mimetype, and one without is only REQUIRED to have
  // it when the mimetype declares a workbook. Requiring it of every
  // unrecognised entry would demand a dataset of every text file.
  {
    // From whichever sidecar this entry actually has. Reading `structure.json`
    // alone reported `no source block — re-run the ingest rung` for a CSV,
    // whose `tabular.jsonld` carries a complete one; the advice was wrong and
    // re-running would not have helped.
    const src = sourceBlockOf(dir);
    const mime = src?.mimetype_sniffed;
    if (has(TABULAR_CSVW_FILENAME)) {
      // The CSVW record (bean `urat`). It must carry the `source` the rest of
      // this check reads, or the entry has no technical metadata at all.
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(join(dir, TABULAR_CSVW_FILENAME), "utf-8"));
      } catch (e) {
        parsed = undefined;
        out.push({ name: "tabular-records", state: "unmet", detail: `${TABULAR_CSVW_FILENAME} unparseable: ${String(e)}` });
      }
      if (parsed !== undefined) {
        const r = TabularCsvwSchema.safeParse(parsed);
        out.push(
          !r.success
            ? {
                name: "tabular-records",
                state: "unmet",
                detail: `${TABULAR_CSVW_FILENAME} is not ${TABULAR_CSVW_SCHEMA_ID}: ${r.error.issues[0]?.message ?? "invalid"}`,
              }
            : !r.data.source
              ? { name: "tabular-records", state: "unmet", detail: `${TABULAR_CSVW_FILENAME} carries no source block — re-run the tabular rung` }
              : entryKind(has) === "paged"
                // A PDF whose printed tables were transcribed into `tables/`
                // (transcribed tables in a paged entry) is a PAGED source that holds tables, not a
                // dataset: `structure.json` comes first in KIND_SIDECAR, and
                // its own sniffed mimetype says what it is.
                ? {
                    name: "tabular-records",
                    state: "met",
                    detail: `not tabular (${typeof mime === "string" && mime ? mime : "no sniffed mimetype"}); ${r.data.tables.length} table(s) transcribed from its pages as CSVW`,
                  }
                : {
                    name: "tabular-records",
                    state: "met",
                    detail: `${r.data.tables.length} table(s) as CSVW, narrative ${r.data.narrative ? slotStates(r.data.narrative) : "absent"}`,
                  },
        );
      }
    } else if (!has("tabular.jsonld")) {
      out.push(
        isTabularMimetype(mime)
          ? {
              name: "tabular-records",
              state: "unmet",
              detail: `declares ${mime} but no tabular record (${TABULAR_CSVW_FILENAME}; tabular.jsonld for ODS) — re-run the ingest's tabular rung`,
            }
          : {
              name: "tabular-records",
              state: "met",
              detail: `not tabular (${typeof mime === "string" && mime ? mime : "no sniffed mimetype"})`,
            },
      );
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(join(dir, "tabular.jsonld"), "utf-8"));
      } catch (e) {
        parsed = undefined;
        out.push({ name: "tabular-records", state: "unmet", detail: `tabular.jsonld unparseable: ${String(e)}` });
      }
      if (parsed !== undefined) {
        const r = TabularRecordsSchema.safeParse(parsed);
        out.push({
          name: "tabular-records",
          state: r.success ? "met" : "unmet",
          detail: r.success
            ? `${r.data.n_sheets} sheet(s), ${r.data.header_vocabulary.length} header(s), narrative ${slotStates(r.data.narrative)}`
            : `tabular.jsonld is not ${TABULAR_RECORDS_SCHEMA_ID}: ${r.error.issues[0]?.message ?? "invalid"}`,
        });
      }
    }
  }

  // Archive contents (bean `twqe`).
  //
  // WHICH entries this applies to is DERIVED, not guessed: `nso8` already
  // records `source.mimetype_sniffed`, so "this entry came from a zip" is a
  // fact on the entry rather than a judgement about its name. An entry whose
  // source sniffed as an archive must carry `contents.jsonld`, validated
  // against `ArchiveContentsSchema` so the gate and the writer cannot drift.
  //
  // The corpus holds FOUR PDFs and no archives, so this reports a determined
  // zero — `not an archive (application/pdf)`. That is the point of saying it
  // rather than staying silent: "nothing to check here" and "the check never
  // ran" are different facts, and only one of them is a pass. The requirement
  // is proved to fire by fixtures in `scripts/tests/archive-contents.test.ts`.
  {
    const src = sourceBlockOf(dir);
    const mime = src?.mimetype_sniffed;
    if (!isArchiveMimetype(mime)) {
      out.push({
        name: "archive-contents",
        state: "met",
        // An EMPTY string is an absence, not a mimetype: rendering it gave
        // `not an archive ()`, which tells a reader nothing about whether
        // anything looked. `_tech_meta.py` writes `null` for unrecognised
        // bytes, and both spellings of "there isn't one" say so here.
        detail: `not an archive (${typeof mime === "string" && mime ? mime : "no sniffed mimetype"})`,
      });
    } else if (!has("contents.jsonld")) {
      out.push({
        name: "archive-contents",
        state: "unmet",
        detail: `sniffed ${mime} but no contents.jsonld — run scripts/archive-contents.py`,
      });
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(join(dir, "contents.jsonld"), "utf-8"));
      } catch (e) {
        parsed = undefined;
        out.push({ name: "archive-contents", state: "unmet", detail: `contents.jsonld unparseable: ${String(e)}` });
      }
      if (parsed !== undefined) {
        const r = ArchiveContentsSchema.safeParse(parsed);
        out.push({
          name: "archive-contents",
          state: r.success ? "met" : "unmet",
          detail: r.success
            ? `${r.data.n_files} file(s), ${r.data.n_directories} dir(s), ${r.data.format}`
            : `contents.jsonld is not ${ARCHIVE_CONTENTS_SCHEMA_ID}: ${r.error.issues[0]?.message ?? "invalid"}`,
        });
      }
    }
  }

  // ── audio-transcripts — bean `1r0p` ─────────────────────────────────────
  //
  // Scoped like `archive-contents`: the entry's own sniffed mimetype says
  // whether it is a recording, so every other entry reports a determined
  // "not a recording" rather than nothing.
  out.push(...audioTranscripts(dir));

  // ── referenced-record — bean `scfh` ──────────────────────────────────────
  //
  // A source RECORDED and not held: its licence forbids posting copies, so the
  // entry identifies the exact bytes and holds none of them. Two failures
  // matter. A record that does not say it is `referenced` or does not say WHY
  // is a claim with no basis. And an entry of this kind that carries
  // `sections/` or `blocks/` is the copy this kind exists NOT to make, which is
  // worse than no entry, so it is refused rather than tolerated.
  if (has("referenced.json")) {
    let r: unknown;
    try {
      r = JSON.parse(readFileSync(join(dir, "referenced.json"), "utf-8"));
    } catch (e) {
      out.push({ name: "referenced-record", state: "unmet", detail: `referenced.json unparseable: ${String(e)}` });
    }
    if (r !== undefined) {
      const problems: string[] = [];
      // The whole record, by the schema the writer is held to — not a list of
      // spot checks here that could drift from it.
      const parsed = ReferencedSourceSchema.safeParse(r);
      if (!parsed.success) {
        const i = parsed.error.issues[0];
        problems.push(`not ${REFERENCED_SOURCE_SCHEMA_ID}: ${i?.path.join(".")} ${i?.message ?? "invalid"}`);
      }
      for (const d of ["sections", "blocks", "images"]) if (has(d)) problems.push(`holds ${d}/ — the text is meant to be withheld`);
      out.push({
        name: "referenced-record",
        state: problems.length ? "unmet" : "met",
        detail:
          problems.length || !parsed.success
            ? problems.join("; ")
            : `${parsed.data.identity.title} — ${parsed.data.outline.length} outline entries, no text held`,
      });
    }
  }

  // Narrative provenance (bean `iqim`).
  //
  // Every block declares how its text came to be: the literal `"ingested"` for
  // verbatim source text, which has no author, or an `Attribution` naming the
  // human, agent (with its model) or script that wrote it.
  //
  // TWO failures are checked, and the second is the one that matters.
  //
  //   1. A `provenance` that is neither — an open string, a malformed
  //      attribution, an `agent` with no `model`. `ProvenanceSchema` decides,
  //      so the gate and the type cannot drift apart.
  //   2. A block of an AUTHORED kind carrying `"ingested"`. That is a false
  //      statement about verbatim extraction, and it is what stops a narrative
  //      arm landing descriptions with no attribution: closing the union means
  //      a new arm has to choose rather than omit.
  //
  // The narrative COUNT is reported either way, including a determined zero.
  // "No narrative blocks here" and "the classifier never ran" are different
  // facts, and a gate that renders them the same way is the failure this
  // repository keeps paying for. Today every one of the 424 blocks is
  // extracted prose, so the count is a real zero — and the authored branch is
  // proved to fire by a fixture in `scripts/tests/attribution.test.ts`, not by
  // the corpus.
  {
    const bdir = join(dir, "blocks");
    const files = has("blocks") && statSync(bdir).isDirectory()
      ? readdirSync(bdir).filter((f) => f.endsWith(".jsonld"))
      : [];
    if (files.length === 0) {
      out.push({
        name: "narrative-provenance",
        state: "unmet",
        detail: "no blocks to attribute — see the `blocks` requirement",
      });
    } else {
      const bad: string[] = [];
      let narrative = 0;
      let unclassified = 0;
      for (const f of files) {
        let b: Record<string, unknown>;
        try {
          b = JSON.parse(readFileSync(join(bdir, f), "utf-8")) as Record<string, unknown>;
        } catch {
          bad.push(`${f}: unparseable`);
          continue;
        }
        const kind = typeof b.kind === "string" ? b.kind : "";
        const origin = LIBRARY_BLOCK_ORIGIN[kind];
        if (origin === undefined) {
          unclassified++;
          bad.push(`${f}: kind \`${kind || "(absent)"}\` is not classified in LIBRARY_BLOCK_ORIGIN`);
          continue;
        }
        if (!ProvenanceSchema.safeParse(b.provenance).success) {
          bad.push(`${f}: \`provenance\` is neither "ingested" nor a well-formed attribution`);
          continue;
        }
        if (origin === "authored") {
          narrative++;
          if (isIngested(b.provenance)) {
            bad.push(`${f}: kind \`${kind}\` is authored, but claims "ingested" — nobody is credited`);
          }
        }
      }
      const tally = `${files.length} block(s), ${narrative} narrative, ${unclassified} unclassified kind(s)`;
      out.push({
        name: "narrative-provenance",
        state: bad.length ? "unmet" : "met",
        detail: bad.length ? `${bad.length} of ${files.length}: ${bad.slice(0, 3).join("; ")}` : tally,
      });
    }
  }

  // Technical metadata (bean `nso8`) — moved out of NOT-DERIVABLE once both
  // ingest rungs began writing it. `sha256` is the load-bearing field: an
  // asset with one can be re-fetched and compared, an asset without one is an
  // assertion.
  //
  // `mimetype_sniffed: null` is NOT a failure. The sniffer reads magic bytes
  // and refuses to fall back to the extension, so an unrecognised format is
  // honestly unrecognised — `mimetype_source: "unrecognised"` records that the
  // file WAS looked at, which absence alone would not say. What fails is the
  // field being absent entirely, i.e. an older ingest that never sniffed.
  {
    const src = sourceBlockOf(dir);
    if (!src) {
      out.push({
        name: "technical-metadata",
        state: "unmet",
        detail: "no `source` block — re-run the ingest rung",
      });
    } else if (src.kind === "published") {
      // A PUBLICATION recorded by reference (a FHIR IG — owner, 2026-10-02):
      // there are no bytes, so no sha256 to ask for. Its identity is the
      // publisher's own canonical + version, and `ReferencedSourceSchema`
      // (the referenced-record requirement above) holds it to that shape.
      // Met, and the detail says what stands in for the hash rather than
      // letting a missing one read as an older ingest that never sniffed.
      const ok = typeof src.canonical === "string" && typeof src.version === "string";
      out.push({
        name: "technical-metadata",
        state: ok ? "met" : "unmet",
        detail: ok
          ? `published resource, no bytes held or hashed — ${String(src.canonical)} ${String(src.version)}`
          : "published `source` missing canonical or version",
      });
    } else {
      const want = ["file", "sha256", "bytes", "mtime", "mimetype_source"];
      const missing = want.filter((k) => !(k in src));
      out.push({
        name: "technical-metadata",
        state: missing.length ? "unmet" : "met",
        detail: missing.length
          ? `\`source\` missing ${missing.join(", ")}`
          : `sha256 ${String(src.sha256).slice(0, 12)}…, ${src.bytes} bytes, ${src.mimetype_source}`,
      });
    }
  }

  if (!has("manifest.jsonld")) {
    out.push({ name: "manifest", state: "unmet", detail: "no manifest.jsonld" });
  } else {
    try {
      const m = JSON.parse(readFileSync(join(dir, "manifest.jsonld"), "utf-8")) as Record<string, unknown>;
      const missing = ["@id", "@type", "contains"].filter((k) => !(k in m));
      out.push({
        name: "manifest",
        state: missing.length ? "unmet" : "met",
        detail: missing.length ? `missing ${missing.join(", ")}` : `${(m.contains as unknown[]).length} entries`,
      });
      out.push({
        name: "provenance",
        state: "provenance" in m ? "met" : "unmet",
        detail: "provenance" in m ? "recorded on the manifest" : "no `provenance` on the manifest",
      });
    } catch (e) {
      out.push({
        name: "manifest",
        state: "unmet",
        detail: `manifest.jsonld will not parse: ${e instanceof Error ? e.message : e}`,
      });
    }
  }

  // ── image-descriptions — moved OUT of NOT_DERIVABLE 2026-09-20 ──────────
  //
  // `d5f1` shipped: `pdf-images.py` classifies every placed image by geometry,
  // `apply-image-verdicts.ts` records an inspection basis naming who looked,
  // and a describable role carries a narrative. All four entries have one.
  // The gate went on reporting this as "no arm builds this yet" until the
  // probe in NOT_DERIVABLE was added — see there for why that is the failure
  // rather than the oversight.
  {
    const f = join(dir, "images.json");
    if (!existsSync(f)) {
      out.push({
        name: "image-descriptions",
        state: "unmet",
        detail: "no images.json — run scripts/pdf-images.py",
      });
    } else {
      try {
        const parsed = ImagesSidecarSchema.parse(JSON.parse(readFileSync(f, "utf-8")));
        if (parsed.images === null) {
          // The sidecar's OWN could-not-determine, carried through rather than
          // flattened. No backend could place the images and the reason is
          // recorded; calling that `unmet` asks somebody to fix a document
          // that is not broken.
          out.push({
            name: "image-descriptions",
            state: "not-derivable",
            detail: `images could not be determined — ${parsed.undetermined_reason ?? "no reason recorded"}`,
          });
        } else {
          const describable = parsed.images.filter((i) => DESCRIBABLE_ROLES.includes(i.role));
          const undescribed = describable.filter(
            (i) => i.narrative === undefined || narrativesOfSlot(i.narrative).every((n) => n.state === "not-authored"),
          );
          // An `undetermined` ROLE is the third state one level down: nobody
          // has judged what this image is, so whether it needs describing is
          // unknown. Counting it as described would be the pass-by-default
          // this gate exists against.
          const unjudged = parsed.images.filter((i) => i.role === "undetermined");
          // What the TEXT declares, against what the raster arm placed — bean
          // `m4xy`. Never compared as a ratio; see `declaredFigureLabels`.
          const declaredCaptions = declaredFigureCaptions(join(dir, "sections"));
          const declared = new Set(declaredCaptions.keys());
          const bareLabels = [...declaredCaptions].filter(([, c]) => c === null).map(([l]) => l);
          const declaredNote =
            (declared.size > 0
              ? ` The text declares at least ${declared.size} captioned figure(s); ` +
                `which of them correspond to placed images is NOT established.`
              : "") +
            // A page can need BOTH arms, which is why this rides the branches
            // where raster images WERE placed rather than only the empty ones.
            // `9789240010567-eng` page 92 is the case: the raster arm extracted
            // five component logos and Fig. 5.6.2, the diagram they sit inside,
            // is drawn.
            vectorLabelNote(dir) +
            // Reported, never a state change here: which bare figures the
            // placed raster images already are is NOT established, so the
            // arm's reach is information beside a `met`, not a verdict on it.
            vectorFigureNote(dir, bareLabels);
          if (undescribed.length || unjudged.length) {
            out.push({
              name: "image-descriptions",
              state: "unmet",
              detail:
                `${undescribed.length} describable image(s) with no narrative, ` +
                `${unjudged.length} with an undetermined role.${declaredNote}`,
            });
          } else if (parsed.images.length === 0 && declared.size > 0) {
            // ZERO IMAGES PLACED, AND THE TEXT DECLARES FIGURES — `m4xy`.
            //
            // The owner ruled 2026-09-23, over building a vector arm: **the
            // CAPTION is the handle, and the arm is a later bean.** So the
            // question here stopped being "did an arm read them" and became
            // "does each declared figure carry text a reader can read instead".
            //
            // WHY THE CAPTION NEEDS NO NUMBER, which is most of why it won.
            // The vector arm needs a coverage threshold to tell a figure from
            // furniture, and `m4xy` refuses to propose one: pooled over 296
            // figures the distribution runs continuously across three orders
            // of magnitude, and "a threshold chosen after seeing this corpus
            // is a number chosen to fit the answer". A caption either has text
            // after `Fig. N.` or it does not.
            //
            // IT IS PER-FIGURE, and that is load-bearing rather than tidy.
            // `m4xy` exists because an entry could be "L1-complete,
            // gate-green, and missing every figure it declares, with nothing
            // anywhere signalling a gap". Flipping this to `met` on a COUNT
            // would rebuild that exactly. Measured 2026-09-23:
            // `9789240093362-eng` declares 18 and only THREE are captions —
            // the other fifteen are cross-references the lower bound counted.
            // A blanket `met` there would pass over fifteen figures nothing
            // describes.
            const figures = declaredCaptions;
            // A bare figure an INSPECTED render shows is covered — bean
            // `ay3x`. Only `shown` counts: a render nobody looked at is a
            // candidate, and crediting it would be the pass-on-a-count this
            // branch exists against. What is left is the "neither the caption
            // nor the arm reaches" set, and it stays `not-derivable`.
            const reach = vectorFigureReach(dir, bareLabels);
            const shown = new Set(reach?.shown ?? []);
            const bare = bareLabels.filter((l) => !shown.has(l));
            if (bare.length === 0 && shown.size > 0) {
              out.push({
                name: "image-descriptions",
                state: "met",
                detail:
                  `no raster image was placed — the figures are drawn in vector. ` +
                  `${figures.size - shown.size} declared figure(s) carry caption text and ` +
                  `${shown.size} more (Fig. ${[...shown].join(", ")}) are shown by a vector render ` +
                  `somebody inspected and described — see ${VECTOR_FIGURES_FILE} (bean ay3x).` +
                  vectorLabelNote(dir),
              });
            } else if (bare.length === 0) {
              out.push({
                name: "image-descriptions",
                state: "met",
                detail:
                  `no raster image was placed — the figures are drawn in vector — but ` +
                  `all ${figures.size} declared figure(s) carry caption text, which is ` +
                  `the reader's handle (owner ruling 2026-09-23, bean m4xy). ` +
                  `Captions: ${[...figures].map(([l, c]) => `Fig. ${l} "${c}"`).join("; ")}` +
                  vectorLabelNote(dir),
              });
            } else {
              // `not-derivable` rather than `unmet`: the document is not
              // broken and no amount of describing would satisfy it. It is
              // reported and does not block promotion, which is what makes it
              // safe to be honest rather than a new permanent blocker — the
              // `pn6j` failure. The BARE LABELS are named, so a reader sees
              // which figures are uncovered rather than a bare shortfall.
              out.push({
                name: "image-descriptions",
                state: "not-derivable",
                detail:
                  `no raster image was placed, and ${bare.length} of ${figures.size} ` +
                  `declared figure(s) carry no caption text either — Fig. ` +
                  `${bare.join(", ")}. They are drawn in vector and neither the caption handle ` +
                  `nor an inspected vector render reaches them (beans m4xy, ay3x).` +
                  vectorLabelNote(dir) +
                  vectorFigureNote(dir, bareLabels),
              });
            }
          } else {
            // Described — but in every configured language? Bean `d5f1`'s
            // Done-when is one description per language, and a figure
            // described in English alone is not that. Still QA-only
            // (`QA_ONLY`), so a missing translation never stops a publish.
            const gaps = localeGaps(describable, entryLocales(dir));
            if (gaps.images > 0) {
              out.push({
                name: "image-descriptions",
                state: "unmet",
                detail:
                  `${parsed.images.length} image(s), ${describable.length} describable and all described, ` +
                  `but ${gaps.images} lack a narrative in a configured language: ` +
                  `${[...gaps.byLocale].map(([l, n]) => `${l} (${n})`).join(", ")}.${declaredNote}`,
              });
            } else {
              out.push({
                name: "image-descriptions",
                state: "met",
                detail:
                  `${parsed.images.length} image(s), ${describable.length} describable ` +
                  `and all described.${declaredNote}`,
              });
            }
          }
        }
      } catch (e) {
        out.push({
          name: "image-descriptions",
          state: "unmet",
          detail: `images.json will not parse: ${e instanceof Error ? e.message : e}`,
        });
      }
    }
  }

  // Applied LAST, over the whole list, so a requirement cannot be silently
  // skipped at its own call site and later look like it passed.
  const kind = entryKind(has);
  return out.filter((r) => appliesTo(r.name, kind));
}

/**
 * What `pn6j` asks for that nothing can produce yet.
 *
 * ## The third state has to EXPIRE, and this one did not
 *
 * The entry above used to read *"this list shrinks by work rather than by
 * editing"*. It does not. Nothing forced the edit, so when `d5f1` shipped —
 * `pdf-images.py`, the inspection pass, 164 classified images across all four
 * library entries — the gate went on reporting `image-descriptions` as *"no
 * arm builds this yet"*. Measured 2026-09-20: four entries, four `images.json`
 * files, 2 / 20 / 121 / 21 images, every one with a role and a basis, and the
 * gate checking none of it.
 *
 * A not-derivable entry is a declared exception, and this repository has now
 * paid for the same shape three times in one session: a reason living in a
 * YAML comment that nothing compared and had become false (`ot9a`), a drift
 * backlog that exempted a whole page so it could drift further in silence
 * (`07p7`), and this. Each outlived its premise because nothing re-derived it.
 *
 * So each entry carries a `probe`: the artefact whose EXISTENCE means the arm
 * now runs. {@link expiredExceptions} fails the gate when one is found, and
 * the fix is to move the requirement into {@link derivableRequirements} rather
 * than to edit the reason.
 *
 * **The probe is the corpus, not the bean's status.** `d5f1` is still
 * `in-progress` while its output is committed and complete, so a status field
 * would have reported this as correctly not-derivable. A human-maintained flag
 * is the weak signal; the artefact on disk is the strong one.
 */
export interface NotDerivable {
  name: string;
  /** The bean that would move this into the checked set. */
  bean: string;
  /** Filename within a library entry whose presence means the arm now runs. */
  probe: string;
}

// EMPTY, and measured so: `audio-transcripts` was the last entry (bean
// `1r0p`), and moved into {@link derivableRequirements} when its arm landed.
// Its probe was `transcript`, the directory that arm writes.
export const NOT_DERIVABLE: readonly NotDerivable[] = [];

/**
 * Not-derivable claims the corpus has outgrown.
 *
 * Never empty-by-accident: {@link checkAll} reports `undefined` rather than
 * `[]` when it cannot read the library, and this is only consulted on a real
 * list of entries.
 */
export function expiredExceptions(
  entries: readonly string[],
  has: (dir: string, file: string) => boolean,
  list: readonly NotDerivable[] = NOT_DERIVABLE,
): { name: string; bean: string; probe: string; found: string }[] {
  const out: { name: string; bean: string; probe: string; found: string }[] = [];
  for (const nd of list) {
    const found = entries.find((d) => has(d, nd.probe));
    if (found) out.push({ name: nd.name, bean: nd.bean, probe: nd.probe, found });
  }
  return out;
}

/**
 * A recording's transcripts — bean `1r0p`.
 *
 * `met` with "not a recording" for every other entry. For a recording:
 * `recording.json` conforms; `transcript/` holds the source-language
 * transcript, named `<lang>.json` for the language the recording is recorded
 * in; every file there is a transcript of THESE bytes (`recording_sha256`),
 * named for its own `lang`; and a translation is of the source language, cut
 * at the source's segment times one for one.
 *
 * A translation whose `segments_sha256` no longer matches the source is
 * reported as stale and does NOT fail: the source was corrected after it was
 * translated, which is a backlog for a translator, as a stale block summary
 * is. A draft is not a failure either; confirming one is a person's work.
 */
export function audioTranscripts(dir: string): Requirement[] {
  const name = "audio-transcripts";
  const src = sourceBlockOf(dir);
  const mime = src?.mimetype_sniffed;
  if (!isRecordingMimetype(mime)) {
    return [{ name, state: "met", detail: `not a recording (${typeof mime === "string" && mime ? mime : "no sniffed mimetype"})` }];
  }
  const recPath = join(dir, RECORDING_FILENAME);
  if (!existsSync(recPath)) {
    return [{ name, state: "unmet", detail: `sniffed ${mime} but no ${RECORDING_FILENAME} — run scripts/recording-transcript.py record` }];
  }
  let rec: ReturnType<typeof RecordingSchema.safeParse>;
  try {
    rec = RecordingSchema.safeParse(JSON.parse(readFileSync(recPath, "utf-8")));
  } catch (e) {
    return [{ name, state: "unmet", detail: `${RECORDING_FILENAME} unparseable: ${String(e)}` }];
  }
  if (!rec.success) {
    const i = rec.error.issues[0];
    return [{ name, state: "unmet", detail: `${RECORDING_FILENAME} is not ${RECORDING_SCHEMA_ID}: ${i?.path.join(".")} ${i?.message ?? "invalid"}` }];
  }
  const spoken = rec.data.identity.language;
  const tdir = join(dir, TRANSCRIPT_DIR);
  const files = existsSync(tdir) && statSync(tdir).isDirectory() ? readdirSync(tdir).filter((f) => !f.startsWith(".")).sort() : [];
  if (!files.includes(`${spoken}.json`)) {
    return [{
      name,
      state: "unmet",
      detail: `no ${TRANSCRIPT_DIR}/${spoken}.json, the transcript in the language it is recorded in — run scripts/recording-transcript.py transcript`,
    }];
  }
  const problems: string[] = [];
  const docs = new Map<string, Transcript>();
  for (const f of files) {
    if (!f.endsWith(".json")) {
      problems.push(`${TRANSCRIPT_DIR}/${f}: not a transcript file`);
      continue;
    }
    let r: ReturnType<typeof TranscriptSchema.safeParse>;
    try {
      r = TranscriptSchema.safeParse(JSON.parse(readFileSync(join(tdir, f), "utf-8")));
    } catch {
      problems.push(`${TRANSCRIPT_DIR}/${f}: unparseable`);
      continue;
    }
    if (!r.success) {
      const i = r.error.issues[0];
      problems.push(`${TRANSCRIPT_DIR}/${f}: not ${TRANSCRIPT_SCHEMA_ID}: ${i?.path.join(".")} ${i?.message ?? "invalid"}`);
      continue;
    }
    if (f !== `${r.data.lang}.json`) problems.push(`${TRANSCRIPT_DIR}/${f}: holds lang ${r.data.lang}`);
    if (r.data.recording_sha256 !== rec.data.source.sha256) problems.push(`${TRANSCRIPT_DIR}/${f}: transcribes other bytes than ${rec.data.source.file}`);
    docs.set(r.data.lang, r.data);
  }
  const source = docs.get(spoken);
  if (source && source.translated_from) problems.push(`${TRANSCRIPT_DIR}/${spoken}.json: the source-language transcript is marked as a translation`);
  const stale: string[] = [];
  const sourceSha = source ? createHash("sha256").update(segmentsCanonical(source.segments)).digest("hex") : undefined;
  for (const [lang, t] of docs) {
    if (lang === spoken) continue;
    if (!t.translated_from) {
      problems.push(`${TRANSCRIPT_DIR}/${lang}.json: a second recogniser transcript; only ${spoken} is spoken here`);
      continue;
    }
    if (t.translated_from.lang !== spoken) problems.push(`${TRANSCRIPT_DIR}/${lang}.json: translated from ${t.translated_from.lang}, not ${spoken}`);
    if (source) {
      const same =
        t.segments.length === source.segments.length &&
        t.segments.every((s, i) => s.start_ms === source.segments[i]!.start_ms && s.end_ms === source.segments[i]!.end_ms);
      if (!same) problems.push(`${TRANSCRIPT_DIR}/${lang}.json: its segments are not the source's, one for one`);
      else if (t.translated_from.segments_sha256 !== sourceSha) stale.push(lang);
    }
  }
  if (problems.length) return [{ name, state: "unmet", detail: problems.slice(0, 3).join("; ") }];
  const parts = [...docs].map(([lang, t]) => `${lang} (${lang === spoken ? "source" : "translation"}, ${t.state})`);
  return [{
    name,
    state: "met",
    detail:
      `${source!.segments.length} segment(s); ${parts.join(", ")}` +
      (stale.length ? `; ${stale.length} stale translation(s), the source changed after: ${stale.join(", ")} — advisory` : ""),
  }];
}

export function checkEntry(dir: string, registry: GraphTypologyRegistry = defaultGraphTypologies): EntryReport {
  const advisories = entryKind((f) => existsSync(join(dir, f))) === "paged"
    ? extractionAdvisories(dir, { referencesDir: referencesDirFor(dir, registry) })
    : undefined;
  return {
    slug: dir.split("/").filter(Boolean).pop() ?? dir,
    requirements: [
      ...derivableRequirements(dir, registry),
      ...NOT_DERIVABLE.map((nd) => ({
        name: nd.name,
        state: "not-derivable" as const,
        detail: `no arm builds this yet — bean ${nd.bean}`,
      })),
    ],
    ...(advisories ? { advisories } : {}),
  };
}

/**
 * The `references` directory of the layer that holds an entry, where a
 * reference-list reader writes `<slug>.<section>.<n>.json` — or `undefined`
 * when no layer above the entry declares one. Read, never required.
 */
const referencesDirCache = new Map<string, string | undefined>();
export function referencesDirFor(dir: string, registry: GraphTypologyRegistry = defaultGraphTypologies): string | undefined {
  const key = resolve(dir, "..");
  if (registry === defaultGraphTypologies && referencesDirCache.has(key)) return referencesDirCache.get(key);
  const found = findReferencesDir(dir, registry);
  if (registry === defaultGraphTypologies) referencesDirCache.set(key, found);
  return found;
}

function findReferencesDir(dir: string, registry: GraphTypologyRegistry): string | undefined {
  let at = resolve(dir);
  for (let i = 0; i < 4; i++) {
    const up = resolve(at, "..");
    if (up === at) return undefined;
    at = up;
    try {
      const refs = instanceDirectoryForGraph(at, "references", registry);
      if (refs !== undefined) return refs;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** One line for an entry's advisories: `contents 12 · tables none in source · …`. */
export function advisoryLine(advisories: readonly ExtractionAdvisory[]): string {
  const word = { found: "", partial: "partial", none: "none in source", "not-extracted": "not extracted" } as const;
  return advisories
    .map((a) => `${a.kind} ${a.state === "found" ? String(a.count) : word[a.state]}`)
    .join(" · ");
}

/**
 * The layer root, which is NOT the current working directory.
 *
 * This resolved the library from `resolve(".")` alone. The layer moved
 * under `cat-harness/` (bean `wggr`), npm scripts run from the REPOSITORY
 * root, and so `bun run cat check:l1-complete` — a CI gate — found no declaration,
 * reported "no library/ entries — nothing to check" and **exited 0**. Measured
 * 2026-09-20: four entries present, zero checked, gate green.
 *
 * That is `xom7` one level in: a check that cannot fail is indistinguishable
 * from a check that passes. Tries the working directory first, so a downstream
 * folio invoking this from its own root still resolves its own library, and
 * falls back to the directory this module lives in.
 */
export function libraryRootFor(cwd: string): string | undefined {
  // `.length > 0`, not `[0]`. The question here is PRESENCE — does this root
  // declare a library at all — and asking it by indexing reads as though the
  // first one mattered. It never did here, and after bean `a02m` a root may
  // declare several.
  if (corpusDirectoriesForGraph(cwd, "library").length > 0) return cwd;
  const own = resolve(HARNESS_ROOT);
  return corpusDirectoriesForGraph(own, "library").length > 0 ? own : undefined;
}

/**
 * Entries to check, or `undefined` when no `library` is declared ANYWHERE.
 *
 * Three states, and the middle one is the point. `[]` means "a library is
 * declared and holds nothing" — a determined finding. `undefined` means
 * "no declaration was found", which is not the same and must never be
 * rendered as a clean run.
 */
export function checkAll(root: string): EntryReport[] | undefined {
  // Declared, not composed — see `libraryRoot` in `ingest-document.ts` for why.
  //
  // EVERY declared library. This is the L1 COMPLETENESS gate, and the one
  // failure it must never have is reporting a complete pass over part of the
  // corpus — which is exactly what it did when it ran from the repository
  // root and checked nothing (the comment on `libraryRootFor` above). Half
  // is the same bug as none, with better camouflage: none at least yields the
  // `undefined` third state. `directoriesForGraph(...)[0]` until bean `a02m`.
  const libs = corpusDirectoriesForGraph(root, "library");
  if (libs.length === 0) return undefined;
  const out: EntryReport[] = [];
  // A slug in two libraries is REFUSED, not merged. The committed sidecar is
  // `library-qa/<slug>.qa-results.json` — keyed on the slug alone — so two
  // entries sharing one would write over each other's verdict and the second
  // run would look idempotent. `gen-library-jsonld` refuses the same collision
  // for the same reason, and this does not delegate to it: a gate that relies
  // on a DIFFERENT tool having run is a gate with a hole in it.
  const seen = new Map<string, string>();
  // Declared-but-absent is REPORTED, not dropped (bean `95ir`).
  const presence = splitDeclared(libs);
  noteAbsent(presence.absent, "a library");
  for (const lib of presence.present) {
    const others = nonEntryDirs(lib);
    // Flat or filed in a concern group (`library/<group>/<slug>/`, bean `6fez`).
    for (const { slug: d, dir } of libraryEntryDirs(lib)) {
      // Another kind's directory kept in the library is not an entry.
      if (others.has(dir)) continue;
      const prior = seen.get(d);
      if (prior !== undefined) {
        throw new Error(
          `slug "${d}" appears in two libraries — ${prior} and ${dir}. ` +
            `The committed verdict is keyed on the slug alone, so one would silently ` +
            `overwrite the other. Rename one.`,
        );
      }
      seen.set(d, dir);
      out.push({
        ...checkEntry(dir),
        library: libs.length > 1 ? relative(root, lib) : undefined,
      });
    }
  }
  return out;
}

/**
 * The verdict as a committed sidecar, so it outlives the console.
 *
 * Bean `pn6j` asks that "the verdict is recorded on the document". This is the
 * half of that which does not need a decision nobody has made yet: a
 * `qa-results/v1` document under the declared `qa` tree, whose **subject is the
 * asset** and whose **producer records the tool** — `script` plus
 * `script_hash`, so a verdict written by an older checker is visibly that.
 *
 * No sixth schema family. `qa-results/v1` already carries
 * `subject: { kind, id }` with an OPEN vocabulary, so an ingested document is a
 * new `kind`, not a new shape. The tool was never a separate subject: it is
 * provenance, and it was already on every one of these.
 *
 * ## `total` is deliberately never zero, and that is the honest reading
 *
 * It is tempting to count only `unmet` so a good entry reads `total: 0`. That
 * would be a lie: six requirements are **not derivable by any arm that
 * exists**, so no entry in `library/` is fully verified today, and a sidecar
 * claiming otherwise is exactly the "unknown rendered as a pass" this
 * repository keeps paying for. The two families are separate so a reader can
 * tell a DEFECT from a GAP at a glance, and neither is hidden.
 *
 * Path mirrors the subject (`library-qa/<slug>`) rather than flattening: the
 * `kg-qa` tree learned that the hard way, where four basenames already
 * collided across packages.
 */
export function sidecarDocument(report: EntryReport) {
  const unmet = report.requirements.filter((q) => q.state === "unmet");
  const nd = report.requirements.filter((q) => q.state === "not-derivable");
  const result = buildQaResult({
    script: "scripts/check-l1-complete.ts",
    scriptAbsPath: join(import.meta.dir, "check-l1-complete.ts"),
    subject: { kind: "library-document", id: `library/${report.slug}` },
    families: {
      unmet: {
        summary:
          "L1 requirements this entry does not satisfy. A DEFECT in the entry, " +
          "fixable by re-running the ingest rung that produces the artefact.",
        entries: unmet.map((q) => ({ requirement: q.name, detail: q.detail })),
      },
      notDerivable: {
        summary:
          "L1 requirements NO ingest arm can produce yet. Not a defect in this " +
          "entry and not a pass either — nothing has checked them, so this " +
          "entry is not fully verified. Each names the bean that would make it " +
          "checkable.",
        entries: nd.map((q) => ({ requirement: q.name, detail: q.detail })),
      },
    },
  });
  return result;
}

/** {@link sidecarDocument}, written under the declared `qa` tree of the layer that owns the entry. */
export function sidecarFor(root: string, report: EntryReport): string {
  return writeQaResult(sidecarRootFor(root, report.slug), join("library-qa", report.slug), sidecarDocument(report));
}

/**
 * The layer whose `qa` tree holds an entry's verdict: the one that owns the
 * library the entry sits in. In a standalone layer that is `root` itself.
 * In the index checkout `root` declares no layer (owner, 2026-10-08), and
 * writing under it put 79 sidecars in an undeclared `<index>/test/results/`
 * while the libraries sat in the IRIS replica and the others (measured 2026-10-09).
 * An entry no declared library holds stays at `root`, as before.
 */
export function sidecarRootFor(
  root: string,
  slug: string,
  // The libraries, when the caller already has them: {@link sidecarStates}
  // asks once per entry, and resolving every declaration again for each of 87
  // entries was most of its cost.
  libs: readonly string[] = corpusDirectoriesForGraph(root, "library"),
): string {
  for (const lib of libs) {
    // Flat or filed in a concern group (bean `6fez`): a filed entry is not at
    // `<lib>/<slug>`, and missing it would write its sidecar to the wrong root.
    const entry = libraryEntryDir(lib, slug) ?? join(lib, slug);
    if (existsSync(entry)) {
      const owner = instanceConfigFor(entry)?.root;
      if (owner && (owner === root || instanceDirectoryForGraph(owner, "qa") !== undefined)) {
        return owner;
      }
      return owner ? (instanceDirectoryForGraph(root, "qa") !== undefined ? root : resolve(HARNESS_ROOT)) : root;
    }
  }
  return root;
}

/**
 * Is the committed sidecar what this checker would write now? One state per
 * entry, in the five {@link QaResultState}s.
 *
 * A committed verdict that nobody re-writes is worse than none: it reads as a
 * current answer while describing an older corpus, which is the defect
 * `kg-audit` grew its `source_hash` for. Compared whole: the document carries
 * no `updated_at` (`y7b3`), so an old sidecar that still has one reads stale
 * and is regenerated away.
 *
 * `against` reads the baseline from the `qa-reports` branch instead of the
 * working copy (bean `0dav`); the path is the same one either way.
 */
export function sidecarStates(
  root: string,
  reports: EntryReport[],
  against?: string,
): { slug: string; state: QaResultState }[] {
  // Resolved once for every entry, not once per entry: the libraries here, the
  // qa location as in qa-results' storedOn. Unresolvable means what it means
  // there: no directory is stored.
  const libs = corpusDirectoriesForGraph(root, "library");
  let location: QaLocation | undefined;
  try {
    location = resolveQaLocation();
  } catch {
    location = undefined;
  }
  return reports.map((r) => ({
    slug: r.slug,
    state: qaResultState(qaResultPath(sidecarRootFor(root, r.slug, libs), join("library-qa", r.slug)), sidecarDocument(r), { against, location }),
  }));
}

/**
 * {@link sidecarStates}, as the lines a reader acts on — every entry whose
 * committed verdict is not `current`. Absent is never folded into current:
 * "no sidecar" is its own line.
 */
export function staleSidecars(root: string, reports: EntryReport[], against?: string): string[] {
  const words: Record<QaResultState, string> = {
    current: "current",
    stale: "stale",
    absent: "no sidecar",
    unreadable: "sidecar will not parse",
    unknown: "could not read the qa-reports baseline",
  };
  return sidecarStates(root, reports, against)
    .filter((x) => x.state !== "current")
    .map((x) => `${x.slug}: ${words[x.state]}`);
}

function format(reports: EntryReport[]): string {
  if (reports.length === 0) return "L1 completeness\n  · no library/ entries — nothing to check";
  const mark = { met: "✓", unmet: "✗", "not-derivable": "·" } as const;
  const out: string[] = [];
  for (const r of reports) {
    const unmet = blockingUnmet(r.requirements);
    // `<library>/<slug>/` when several libraries are in play, `library/<slug>/`
    // when there is only one — a layer with a single library reads exactly
    // as it always did.
    out.push(`${unmet.length ? "✗" : "✓"} ${r.library ?? "library"}/${r.slug}/`);
    for (const q of r.requirements) {
      if (q.state === "not-derivable") continue;
      const qa = q.state === "unmet" && QA_ONLY.has(q.name);
      out.push(`    ${qa ? "◦" : mark[q.state]} ${q.name.padEnd(16)} ${qa ? "QA finding, not gating: " : ""}${q.detail}`);
    }
    for (const q of unmet) void q;
    if (r.advisories?.length) out.push(`    ◦ extraction     advisory, not gating: ${advisoryLine(r.advisories)}`);
  }
  // Per kind across every entry: how many found something, found none in the
  // source, could not tell, or were never looked at.
  const withAdvisories = reports.filter((r) => r.advisories?.length);
  if (withAdvisories.length) {
    const kinds = [...new Set(withAdvisories.flatMap((r) => r.advisories!.map((a) => a.kind)))];
    out.push("");
    out.push(`  ◦ extraction across ${withAdvisories.length} paged entr${withAdvisories.length === 1 ? "y" : "ies"} (advisory — extraction.json):`);
    for (const k of kinds) {
      const n = (st: string) => withAdvisories.filter((r) => r.advisories!.some((a) => a.kind === k && a.state === st)).length;
      out.push(
        `    ${k.padEnd(11)} found ${n("found")}, partial ${n("partial")}, ` +
          `none in source ${n("none")}, not extracted ${n("not-extracted")}`,
      );
    }
  }
  const nd = reports[0]?.requirements.filter((q) => q.state === "not-derivable") ?? [];
  if (nd.length) {
    out.push("");
    out.push(`  · ${nd.length} requirement(s) NOT DERIVABLE by any arm yet, so not checked:`);
    out.push(`    ${nd.map((q) => q.name).join(", ")}`);
    out.push("    These are not passes. Beans: " + NOT_DERIVABLE.map((nd) => nd.bean).join(", "));
  }
  return out.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const target = argv.find((a) => !a.startsWith("--"));
  let reports: EntryReport[];
  try {
    if (target) {
      reports = [checkEntry(target)];
    } else {
      const root = libraryRootFor(resolve("."));
      if (root === undefined) {
        console.error("Could not find a declared `library` directory from " + resolve("."));
        console.error("This is NOT a pass. Treat it as unknown.");
        process.exit(2);
      }
      const all = checkAll(root);
      if (all === undefined) {
        console.error(`No \`library\` graph is declared under ${root}.`);
        console.error("This is NOT a pass. Treat it as unknown.");
        process.exit(2);
      }
      reports = all;
    }
  } catch (e) {
    console.error(`Could not check L1 completeness: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  // An EXPIRED exception is a gate lying about its own coverage, so it is
  // checked before anything else and on every run, not only under `--check`.
  // `image-descriptions` sat in NOT_DERIVABLE naming `d5f1` for as long as it
  // took somebody to notice, while all four entries carried a complete
  // `images.json`.
  if (!target) {
    const libRoot = libraryRootFor(resolve("."));
    // Across EVERY declared library: an exception that has expired in the
    // second one is a gate lying about its coverage just as much as one that
    // expired in the first. Bean `a02m`.
    const declaredLibs = libRoot ? splitDeclared(corpusDirectoriesForGraph(libRoot, "library")) : { present: [], absent: [] };
    noteAbsent(declaredLibs.absent, "a library");
    const libs = declaredLibs.present;
    if (libs.length > 0) {
      const dirs = libs.flatMap((lib) =>
        readdirSync(lib)
          .map((d) => join(lib, d))
          .filter((d) => statSync(d).isDirectory()),
      );
      const expired = expiredExceptions(dirs, (d, f) => existsSync(join(d, f)));
      if (expired.length) {
        console.error("A `not-derivable` claim has EXPIRED — the arm now runs:");
        for (const x of expired) {
          console.error(`  ✗ ${x.name} (bean ${x.bean}) — ${x.found} has its artefact (\`${x.probe}\`)`);
        }
        console.error("\nMove it into `derivableRequirements` and check it. A third state");
        console.error("that never expires is an exemption, not a measurement.");
        process.exit(1);
      }
    }
  }

  if (argv.includes("--check")) {
    // COMPUTE AND JUDGE (bean `0dav`). The verdict this gate fails on — an
    // UNMET requirement — is computed fresh on every run and decides the exit
    // below, with or without `--check`. What `--check` added was "the committed
    // verdicts are current", and that has no subject once QA results leave
    // `main` (owner rulings D1/D4): absent is then the normal state, and a
    // gate that failed on it would be red for nobody's defect. So the
    // committed copies are REPORTED — against the working copy, or the
    // `qa-reports` branch with `--against <ref>` — and never decide the exit.
    const { against, exit: badRef } = againstOrUsage("check:l1-complete", argv);
    if (badRef !== undefined) process.exit(badRef);
    const root = libraryRootFor(resolve(".")) ?? resolve(".");
    const states = sidecarStates(root, reports, against);
    const off = staleSidecars(root, reports, against);
    if (off.length) {
      console.log(
        `  advisory: ${off.length} of ${states.length} committed L1 verdict(s) are not current ` +
          `(${against ? `qa-reports:${against}` : "working copy"}). Not gated (bean 0dav). ` +
          "`bun run cat check:l1-complete -- --write` rewrites them:",
      );
      for (const x of off) console.log(`    · ${x}`);
    } else {
      console.log(`✓ ${reports.length} committed L1 verdict(s) current`);
    }
  }
  if (argv.includes("--write")) {
    // The SAME root the reports came from. `resolve(".")` wrote the sidecars
    // beside the working directory, so running the documented command from
    // the repository root put them in a `test/` tree of their own while the
    // committed ones sat under the layer — two sets, neither checking the
    // other. Measured 2026-09-20.
    const writeRoot = libraryRootFor(resolve(".")) ?? resolve(".");
    for (const r of reports) console.log(`wrote ${sidecarFor(writeRoot, r)}`);
  }
  console.log(argv.includes("--json") ? JSON.stringify(reports, null, 2) : format(reports));
  if (!target && !argv.includes("--json")) {
    // The drain's backlog, corpus-wide. Reported, never gated — see
    // `block-summaries` above and `scripts/summaries.ts`.
    const root = libraryRootFor(resolve(".")) ?? resolve(".");
    const t = tally(entryDirs(root).flatMap((d) => {
      try {
        return entryItems(d);
      } catch {
        return []; // that entry's `block-summaries` already says why
      }
    }));
    console.log(
      `\n  · block summaries: ${t.backlog} of ${t.prose} prose block(s) in the backlog ` +
        `(${t.stale} stale), ${t.draft} draft(s) awaiting a person. Advisory — bun run cat summaries`,
    );
  }
  const findings = reports.filter((r) => r.requirements.some((q) => q.state === "unmet" && QA_ONLY.has(q.name)));
  if (findings.length) {
    console.log(
      `\n  ◦ ${findings.length} entr${findings.length === 1 ? "y carries" : "ies carry"} QA findings ` +
        `(${[...QA_ONLY].join(", ")}): recorded in the library-qa verdicts, not gating`,
    );
  }
  process.exit(reports.some((r) => blockingUnmet(r.requirements).length > 0) ? 1 : 0);
}

/**
 * The `errata` requirement for one entry, or `undefined` when it has no
 * `errata.json` (no errata recorded is not a defect). Exported for tests.
 */
export function errataRequirement(dir: string): Requirement | undefined {
  const f = join(dir, ERRATA_FILE);
  if (!existsSync(f)) return undefined;
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(f, "utf-8"));
  } catch (e) {
    return { name: "errata", state: "unmet", detail: `${ERRATA_FILE} unparseable: ${String(e)}` };
  }
  const parsed = DocumentErrataSchema.safeParse(doc);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { name: "errata", state: "unmet", detail: `${ERRATA_FILE}: ${i?.path.join(".")} ${i?.message}` };
  }
  const slug = dir.replace(/\/+$/, "").split("/").pop() ?? "";
  if (parsed.data.entry !== slug) {
    return { name: "errata", state: "unmet", detail: `${ERRATA_FILE} names entry ${parsed.data.entry}, not ${slug}` };
  }
  const missing = parsed.data.errata.filter((e) => {
    if (!e.block) return false;
    const name = e.block.split("/").pop() ?? "";
    return !existsSync(join(dir, "blocks", `${name}.jsonld`));
  });
  if (missing.length) {
    return {
      name: "errata",
      state: "unmet",
      detail: `${missing.length} erratum/errata name a block this entry does not have (${missing[0]!.id}: ${missing[0]!.block})`,
    };
  }
  return { name: "errata", state: "met", detail: `${parsed.data.errata.length} erratum/errata recorded against the source's own text` };
}

/**
 * The `footnotes` requirement for one entry, or `undefined` when it has no
 * `footnotes.json` (an entry ingested before the arm existed, or not a PDF).
 * Unmet only when the file will not parse or names another entry.
 */
export function footnotesRequirement(dir: string): Requirement | undefined {
  const f = join(dir, FOOTNOTES_FILE);
  if (!existsSync(f)) return undefined;
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(f, "utf-8"));
  } catch (e) {
    return { name: "footnotes", state: "unmet", detail: `${FOOTNOTES_FILE} unparseable: ${String(e)}` };
  }
  const parsed = DocumentFootnotesSchema.safeParse(doc);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { name: "footnotes", state: "unmet", detail: `${FOOTNOTES_FILE}: ${i?.path.join(".")} ${i?.message}` };
  }
  const slug = dir.replace(/\/+$/, "").split("/").pop() ?? "";
  if (parsed.data.entry !== slug) {
    return { name: "footnotes", state: "unmet", detail: `${FOOTNOTES_FILE} names entry ${parsed.data.entry}, not ${slug}` };
  }
  const d = parsed.data;
  return {
    name: "footnotes",
    state: "met",
    detail: `${d.footnotes.length} footnote(s) called from the text, ${d.uncalled_notes.length} uncalled, ${d.unlinked_marks.length} mark(s) unlinked (${d.status})`,
  };
}
