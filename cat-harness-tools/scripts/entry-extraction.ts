#!/usr/bin/env bun
/**
 * Which extractors ran over a library entry, and what each found — written
 * as `extraction.json` (`schemas/library/entry-extraction.ts`) and reported,
 * ADVISORY, by `check-l1-complete.ts`.
 *
 * Three parts, one per caller:
 *
 * - {@link observeExtraction}: what the entry's own artefacts show, per kind,
 *   for the kinds whose artefacts live in the entry (contents, sections,
 *   figures, tables). An artefact that is absent observes NOTHING — it is not
 *   `none`.
 * - {@link recordExtraction}: one step's own account of itself, merged into
 *   the record. This is how a step that wrote nothing still says it ran (the
 *   table arm over a document with no tables), and how another layer's step —
 *   a reference-list or glossary reader — records its kind.
 * - {@link extractionAdvisories}: per kind, `found N` / `partial` /
 *   `none` / `not-extracted`, from the record and the artefacts.
 *
 * Usage (the last ingest arm):
 *   bun run cat-harness-tools/scripts/entry-extraction.ts --staging <entry> [--library <library root>] [--structure-tool <script>]
 *
 * `--library` is where the entry will be promoted to: a kind a later step
 * recorded there (references, glossary) is kept when this ingest has nothing
 * newer to say about it, since promotion copies this record over that one.
 *
 * Exit 0 always once the record is written; 1 on bad usage.
 *
 * @module scripts/entry-extraction
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  ENTRY_EXTRACTION_FILE,
  ENTRY_EXTRACTION_SCHEMA_ID,
  EXTRACTION_KINDS,
  EntryExtractionSchema,
  ExtractionStepSchema,
  type EntryExtraction,
  type ExtractionState,
  type ExtractionStep,
} from "../schemas/library/entry-extraction.ts";
import { VECTOR_FIGURES_FILE } from "../schemas/content/vector-figure.ts";
import { TABULAR_CSVW_FILENAME } from "../schemas/library/tabular-csvw.ts";
import { STRUCTURE_FILENAME } from "../schemas/content/document-structure.ts";
import { placedFigures } from "../pipeline/gen-library-jsonld.ts";
import { FOOTNOTES_FILE } from "../schemas/content/document-footnotes.ts";
import { SUMMARIES_FILE } from "../schemas/content/block-summary.ts";
import type { LibraryEntryArmContext, LibraryEntryArmsPlugin } from "../pipeline/pipeline-plugins.ts";

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

/** Today, as the record's `at`. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A script's version: the first 12 hex of its sha256, or `undefined` when it cannot be read. */
export function scriptVersion(path: string): string | undefined {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 12);
  } catch {
    return undefined;
  }
}

/** The entry's record, or `undefined` when it has none or it does not validate. */
export function readExtraction(dir: string): EntryExtraction | undefined {
  const raw = readJson<unknown>(join(dir, ENTRY_EXTRACTION_FILE));
  if (raw === undefined) return undefined;
  const r = EntryExtractionSchema.safeParse(raw);
  return r.success ? r.data : undefined;
}

/** Write the record — every step validated, kinds in a stable order. */
export function writeExtraction(dir: string, docId: string, kinds: Record<string, ExtractionStep>): EntryExtraction {
  const order = (k: string) => {
    const i = (EXTRACTION_KINDS as readonly string[]).indexOf(k);
    return i < 0 ? EXTRACTION_KINDS.length : i;
  };
  const sorted = Object.fromEntries(
    Object.entries(kinds).sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b)),
  );
  const record = EntryExtractionSchema.parse({ $schema: ENTRY_EXTRACTION_SCHEMA_ID, doc_id: docId, kinds: sorted });
  writeFileSync(join(dir, ENTRY_EXTRACTION_FILE), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/**
 * One step's account of itself, merged into the entry's record. Throws when
 * the step does not validate: a record that says "found" with no count is the
 * claim this exists to stop.
 */
export function recordExtraction(dir: string, kind: string, step: ExtractionStep): EntryExtraction {
  const parsed = ExtractionStepSchema.parse(step);
  const prior = readExtraction(dir);
  const docId = prior?.doc_id ?? basename(dir);
  return writeExtraction(dir, docId, { ...(prior?.kinds ?? {}), [kind]: parsed });
}

/** A `found N` or `none` step from a count. */
export function counted(count: number, tool: string, at: string, extra: Partial<ExtractionStep> = {}): ExtractionStep {
  return count > 0 ? { state: "found", count, tool, at, ...extra } : { state: "none", count: 0, tool, at, ...extra };
}

interface ObserveOptions {
  at?: string;
  /** The rung that wrote `structure.json`, as a script path — names the contents and sections step. */
  structureTool?: string;
}

/**
 * What the entry's own artefacts show, per kind. A kind whose artefact is
 * absent is left OUT: absence is not evidence that a source has none.
 */
export function observeExtraction(dir: string, opts: ObserveOptions = {}): Partial<Record<string, ExtractionStep>> {
  const at = opts.at ?? today();
  const out: Partial<Record<string, ExtractionStep>> = {};
  const structure = readJson<Record<string, unknown>>(join(dir, STRUCTURE_FILENAME));
  let captions: number | undefined;
  if (structure) {
    const tool = opts.structureTool
      ? basename(opts.structureTool)
      : typeof structure._schema === "string" ? structure._schema : STRUCTURE_FILENAME;
    const version = opts.structureTool ? scriptVersion(opts.structureTool) : undefined;
    const v = version ? { version } : {};
    // CONTENTS — the contents tree. A tree refused below the trust floor is
    // `partial` with the rung's own reason, never `none`: the rung found
    // headings, could not trust them, and fell back to one section per page.
    const toc = structure.toc;
    const refused =
      typeof structure.toc_undetermined_reason === "string" && structure.toc_undetermined_reason
        ? structure.toc_undetermined_reason
        : undefined;
    if (Array.isArray(toc) && toc.length > 0) {
      out.contents = { state: "found", count: toc.length, tool, at, ...v, note: `contents from ${String(structure.toc_source ?? "the rung")}` };
    } else if (refused) {
      out.contents = { state: "partial", tool, at, ...v, note: `contents refused, page granularity instead: ${refused}` };
    } else if (structure.granularity === "page") {
      // No contents tree claimed, one section per page instead (`pdf-pages.py`):
      // the same partial answer, with the rung's own note.
      const why = typeof structure.structure_note === "string" && structure.structure_note ? structure.structure_note : "no contents tree claimed";
      out.contents = { state: "partial", tool, at, ...v, note: `page granularity: ${why}` };
    } else if (Array.isArray(toc)) {
      out.contents = { state: "none", count: 0, tool, at, ...v };
    }
    // SECTIONS — what the rung split the text into.
    if (Array.isArray(structure.sections)) {
      const n = (structure.sections as unknown[]).length;
      out.sections = counted(n, tool, at, { ...v, ...(structure.granularity === "page" ? { note: "one section per page" } : {}) });
    }
    // The figure and table captions the rung read off the pages: a note on figures.
    if (Array.isArray(structure.figures)) captions = structure.figures.length;
  }
  const captionNote = captions !== undefined ? `${captions} caption(s) read off the pages` : undefined;
  const notes = (...parts: (string | undefined)[]): string | undefined => parts.filter(Boolean).join("; ") || undefined;

  // FIGURES — raster and vector, role `figure`.
  const images = readJson<{ images?: unknown[] | null; undetermined_reason?: string }>(join(dir, "images.json"));
  const vector = readJson<{ figures?: unknown[] | null; undetermined_reason?: string }>(join(dir, VECTOR_FIGURES_FILE));
  if (images !== undefined || vector !== undefined) {
    const tool = [images !== undefined ? "pdf-images.py" : "", vector !== undefined ? "pdf-vector-figures.py" : ""]
      .filter(Boolean)
      .join("+");
    const kept = placedFigures(images as Parameters<typeof placedFigures>[0], vector);
    const raster = kept.filter((f) => !f.id.startsWith("vfig-")).length;
    const pending = (vector?.figures ?? []).filter((f) => (f as { role?: string }).role === "undetermined").length;
    const unreadable = [images?.images === null ? images.undetermined_reason : undefined, vector?.figures === null ? vector.undetermined_reason : undefined]
      .filter((r): r is string => typeof r === "string" && r.length > 0);
    if (pending > 0) {
      const note = notes(`${kept.length} kept (${raster} raster, ${kept.length - raster} vector); ${pending} vector render(s) not yet inspected`, captionNote)!;
      out.figures = { state: "partial", ...(kept.length ? { count: kept.length } : {}), tool, at, note };
    } else if (kept.length > 0) {
      out.figures = { state: "found", count: kept.length, tool, at, note: notes(`${raster} raster, ${kept.length - raster} vector`, captionNote) };
    } else if (unreadable.length > 0 && (images?.images ?? null) === null && (vector?.figures ?? null) === null) {
      out.figures = { state: "not-extracted", tool, at, note: `the figure steps could not look: ${unreadable.join("; ")}` };
    } else {
      const note = notes(captionNote);
      out.figures = { state: "none", count: 0, tool, at, ...(note ? { note } : {}) };
    }
  }

  // TABLES — the CSVW record beside the structure.
  const tabular = readJson<{ tables?: unknown[] }>(join(dir, TABULAR_CSVW_FILENAME));
  if (tabular && Array.isArray(tabular.tables)) out.tables = counted(tabular.tables.length, TABULAR_CSVW_FILENAME, at);
  // FOOTNOTES — `pdf-footnotes.py`'s record.
  // Only a note a mark calls is a footnote (skill l1-document-ingestion,
  // "Footnotes and their marks"). The uncalled lines are table rows, figure
  // labels and running footers as often as notes, and adding them gave
  // 9 / 10 / 60 for entries that print 0 / 1 / 23 (re-ingest pilot,
  // 2026-11-14). With nothing linked but lines or marks left over, the step
  // could not decide: partial, for a reader, never a count of the leftovers.
  const foot = readJson<{ footnotes?: unknown[]; uncalled_notes?: unknown[]; unlinked_marks?: unknown[] }>(join(dir, FOOTNOTES_FILE));
  if (foot && Array.isArray(foot.footnotes)) {
    const called = foot.footnotes.length;
    const uncalled = foot.uncalled_notes?.length ?? 0;
    const unlinked = foot.unlinked_marks?.length ?? 0;
    const left = [uncalled ? `${uncalled} foot-of-page line(s) no mark calls` : "", unlinked ? `${unlinked} mark(s) with no note found` : ""].filter(Boolean).join(", ");
    out.footnotes =
      called === 0 && left
        ? { state: "partial", tool: "pdf-footnotes.py", at, note: `no footnote linked to a mark; ${left}, kept for a reader to judge` }
        : counted(called, "pdf-footnotes.py", at, left ? { note: `called from the text; also kept: ${left}` } : {});
  }
  // SUMMARIES — the block summaries drained so far.
  const sums = readJson<{ summaries?: unknown[] }>(join(dir, SUMMARIES_FILE));
  if (sums && Array.isArray(sums.summaries)) {
    // A record with no written text is a slot, not a summary.
    const written = sums.summaries.filter((r) => {
      const n = (r as { narrative?: unknown }).narrative;
      const list = Array.isArray(n) ? n : n ? [n] : [];
      return list.some((x) => typeof (x as { text?: unknown })?.text === "string" && (x as { text: string }).text.trim() !== "");
    }).length;
    const sections = Array.isArray(structure?.sections) ? (structure!.sections as unknown[]).length : undefined;
    out.summaries =
      written > 0 && sections !== undefined && written < sections
        ? { state: "partial", count: written, tool: "summaries", at, note: `${written} of ${sections} section(s) summarised` }
        : counted(written, "summaries", at);
  }
  return out;
}

/** One kind's advisory line. */
export interface ExtractionAdvisory {
  kind: string;
  state: ExtractionState;
  count?: number;
  detail: string;
}

/**
 * How many reference nodes a reference-list reader wrote for `slug` in a
 * references directory (`<slug>.<section>.<n>.json`), or `undefined` when
 * there is no such directory to look in.
 */
export function referenceNodesFor(referencesDir: string | undefined, slug: string): number | undefined {
  if (!referencesDir || !existsSync(referencesDir)) return undefined;
  try {
    return readdirSync(referencesDir).filter((f) => f.startsWith(`${slug}.`) && f.endsWith(".json")).length;
  } catch {
    return undefined;
  }
}

/**
 * Per kind, what is known about its extraction. Precedence: a fresh `found`
 * from the artefacts, then the record, then any other observation, then
 * `not-extracted`. Reference nodes on disk count as `found` (`referencesDir`).
 */
export function extractionAdvisories(dir: string, opts: { referencesDir?: string } = {}): ExtractionAdvisory[] {
  const record = readExtraction(dir)?.kinds ?? {};
  const observed = observeExtraction(dir);
  const refs = referenceNodesFor(opts.referencesDir, basename(dir));
  if (refs !== undefined && refs > 0 && observed.references === undefined) {
    observed.references = { state: "found", count: refs, tool: "reference nodes", at: today() };
  }
  const kinds = [...EXTRACTION_KINDS, ...Object.keys(record).filter((k) => !(EXTRACTION_KINDS as readonly string[]).includes(k))];
  return kinds.map((kind) => {
    const o = observed[kind];
    const r = record[kind];
    // A fresh `found` from the artefacts beats a stale record; a record that
    // agrees with it keeps its tool and version.
    const step = o?.state === "found" && r?.state !== "found" ? o : (r ?? o);
    if (!step) {
      return { kind, state: "not-extracted" as const, detail: "not extracted — no step recorded for this kind and no artefact of it" };
    }
    const by = [step.tool ? `${step.tool}${step.version ? `@${step.version}` : ""}` : "", step.at ?? ""].filter(Boolean).join(", ");
    const src = by ? ` (${by})` : "";
    const why = step.note ? ` — ${step.note}` : "";
    const head =
      step.state === "found"
        ? `found ${step.count}`
        : step.state === "partial"
          ? `partial${step.count ? ` ${step.count}` : ""}`
          : step.state === "none"
            ? "none in source"
            : "not extracted";
    return { kind, state: step.state, ...(step.count !== undefined ? { count: step.count } : {}), detail: `${head}${src}${why}` };
  });
}

/**
 * The record for a staged entry: the steps this run recorded in the entry,
 * then what its artefacts show, then what the destination entry's record
 * already said about any other kind.
 */
export function stagedRecord(
  staging: string,
  destinationEntry: string | undefined,
  opts: ObserveOptions = {},
): Record<string, ExtractionStep> {
  const prior = destinationEntry ? (readExtraction(destinationEntry)?.kinds ?? {}) : {};
  const observed = observeExtraction(staging, opts);
  // Re-run over an entry already promoted (staging IS the destination), the
  // record in it is the last run's, not this one's: it must not outrank what
  // the artefacts show now. It kept 'figures partial 16' over the 30 the
  // sidecars held once 14 renders were inspected (re-ingest pilot, 2026-11-14).
  const same = destinationEntry !== undefined && resolve(destinationEntry) === resolve(staging);
  const ran = same ? {} : (readExtraction(staging)?.kinds ?? {});
  const out: Record<string, ExtractionStep> = { ...prior };
  for (const [k, v] of Object.entries(observed)) if (v) out[k] = v;
  for (const [k, v] of Object.entries(ran)) out[k] = v;
  return out;
}

/** The kinds the `library-entry-arms` slot exists to cover. */
export const ENTRY_ARM_KINDS: readonly string[] = ["references", "glossary"];

/**
 * Run a higher layer's arms over a PROMOTED entry and record each one's step.
 * GUARDED: an arm that throws is recorded as `not-extracted` with its error,
 * and the next arm still runs. With no plugin, each of {@link ENTRY_ARM_KINDS}
 * the record does not already name is recorded `not-extracted`, saying why —
 * a kind a reader recorded earlier is never overwritten by "nothing ran".
 */
export function runEntryArms(
  plugin: LibraryEntryArmsPlugin | undefined,
  ctx: LibraryEntryArmContext,
  at: string = today(),
): Array<{ kind: string; step: ExtractionStep }> {
  const out: Array<{ kind: string; step: ExtractionStep }> = [];
  if (!plugin) {
    const known = readExtraction(ctx.entry)?.kinds ?? {};
    for (const kind of ENTRY_ARM_KINDS) {
      if (known[kind]) continue;
      const step: ExtractionStep = {
        state: "not-extracted",
        tool: "cat ingest",
        at,
        note: "no layer in this composition fills the `library-entry-arms` pipeline slot",
      };
      recordExtraction(ctx.entry, kind, step);
      out.push({ kind, step });
    }
    return out;
  }
  let arms: Array<{ kind: string; run(): ExtractionStep }>;
  try {
    arms = plugin.arms(ctx);
  } catch (e) {
    arms = [];
    for (const kind of ENTRY_ARM_KINDS) {
      const step: ExtractionStep = { state: "not-extracted", tool: "library-entry-arms", at, note: `the slot's arms() threw: ${e instanceof Error ? e.message : String(e)}` };
      recordExtraction(ctx.entry, kind, step);
      out.push({ kind, step });
    }
  }
  for (const arm of arms) {
    let step: ExtractionStep;
    try {
      step = ExtractionStepSchema.parse(arm.run());
    } catch (e) {
      step = { state: "not-extracted", tool: arm.kind, at, note: `the arm failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    recordExtraction(ctx.entry, arm.kind, step);
    out.push({ kind: arm.kind, step });
  }
  return out;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const staging = arg("--staging");
  if (!staging || !existsSync(staging)) {
    console.error("usage: entry-extraction.ts --staging <entry> [--library <library root>] [--structure-tool <script>]");
    process.exit(1);
  }
  const library = arg("--library");
  const slug = basename(staging);
  const kinds = stagedRecord(staging, library ? join(library, slug) : undefined, { structureTool: arg("--structure-tool") });
  const record = writeExtraction(staging, readJson<{ doc_id?: string }>(join(staging, STRUCTURE_FILENAME))?.doc_id ?? slug, kinds);
  for (const a of extractionAdvisories(staging)) console.log(`  ${a.kind.padEnd(11)} ${a.detail}`);
  console.log(`wrote ${join(staging, ENTRY_EXTRACTION_FILE)} (${Object.keys(record.kinds).length} kind(s))`);
}
