/**
 * The generic pipeline slots folio-assistant-core fills, as one typed table,
 * the same shape a content layer's own table takes. Each `pipeline-plugins/<slot>.json`
 * node names this table and its slot; this table is what `tsc` checks against
 * the generic side's contract (`PipelinePlugins`).
 *
 * One slot today: `tabular-csvw` (bean `urat`). On 2026-10-20 the owner ruled
 * that the tabular ingest step moves up into core, next to its CSVW
 * extractors, so `ingest-document.ts` reaches them through this slot.
 *
 * Routing is by CONTENT, as everywhere on the ingest ladder: the sniffed
 * mimetype says workbook, and a source with no magic bytes is tried as
 * delimited text. Anything else, including an OpenDocument spreadsheet (which
 * core has no CSVW reader for yet), is `null`: not a table this reader takes.
 * A source that looks like one but does not split into one is `null` too, and
 * `NotATableError` says why on stderr.
 *
 * And `library-entry-arms` (owner, 2026-11-14: "not sure all have biblio,
 * glossary, table, figure, keyword, TOC, section, summaries etc fully
 * extracted"): `cat ingest` runs core's two readers over each promoted entry —
 * the Tools `references-extract` and `glossary-from-source`, the ones skill
 * `l1-document-ingestion` names — and records what each did in the entry's
 * `extraction.json`. `none` is written only when the reader RAN over the
 * entry's sections and found nothing; when it could not run (no `sections/`,
 * no `references` or `glossary` directory declared, a library other than the
 * declared one) the step is `not-extracted` and says why.
 *
 * @module folio-assistant-core/pipeline/plugin-slots
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { LibraryEntryArmContext, PipelinePlugins } from "@litlfred/cat-harness-tools/pipeline/pipeline-plugins.js";
import { instanceDirectoryForGraph } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import type { ExtractionStep } from "@litlfred/cat-harness-tools/schemas/library/entry-extraction.js";
import { GlossarySchema, type Glossary } from "../schemas/glossary.js";
import { candidates, merge, sectionsUnder } from "../scripts/glossary-from-source.js";
import { write as writeReferences } from "../scripts/references-extract.js";
import { NotATableError, extractCsv } from "../scripts/tabular-csv.js";
import { extractXlsx } from "../scripts/tabular-xlsx.js";

/** The OOXML workbook mimetype `_tech_meta.sniff_zip_package` reports. */
export const XLSX_MIMETYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** A step that could not run, saying why. */
/*
 * The two helpers the extraction record uses, kept here rather than imported
 * from cat-harness-tools' `scripts/entry-extraction.ts`: this table is loaded
 * by every pass that reads the layer's contributions (kind validators, site
 * builds), including under a tools pin older than that script, and a missing
 * module there failed every such pass, not just ingest. Same definitions as
 * the tools' own.
 */
/** Today, `YYYY-MM-DD`. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
/** A script's version: the first 12 hex of its sha256, or `undefined` when it cannot be read. */
function scriptVersion(path: string): string | undefined {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 12);
  } catch {
    return undefined;
  }
}

const notRun = (tool: string, note: string): ExtractionStep => ({ state: "not-extracted", tool, at: today(), note });

/** Where a reader looks, or why it cannot: the entry's `sections/`, under the library the instance declares. */
function sectionsOf(ctx: LibraryEntryArmContext, tool: string): string | ExtractionStep {
  const sections = join(ctx.entry, "sections");
  if (!existsSync(sections)) return notRun(tool, "the entry has no sections/ to read");
  const declared = instanceDirectoryForGraph(ctx.instanceRoot, "library");
  if (!declared || resolve(declared) !== resolve(ctx.library)) {
    return notRun(tool, `${relative(ctx.instanceRoot, ctx.library) || "."} is not the instance's declared library directory`);
  }
  return sections;
}

const REFERENCES_SCRIPT = join(import.meta.dir, "..", "scripts", "references-extract.ts");
const GLOSSARY_SCRIPT = join(import.meta.dir, "..", "scripts", "glossary-from-source.ts");

/** The Tool `references-extract` over one entry: its reference lists become `folio-reference/v1` nodes. */
export function referencesArm(ctx: LibraryEntryArmContext): ExtractionStep {
  const tool = "references-extract";
  const where = sectionsOf(ctx, tool);
  if (typeof where !== "string") return where;
  if (!instanceDirectoryForGraph(ctx.instanceRoot, "references")) {
    return notRun(tool, "the instance declares no references directory to hold the nodes");
  }
  const { perEntry } = writeReferences(ctx.instanceRoot, ctx.slug);
  const mine = perEntry.find((e) => e.slug === ctx.slug);
  const version = scriptVersion(REFERENCES_SCRIPT);
  const by = { tool, at: today(), ...(version ? { version } : {}) };
  if (!mine) return { state: "none", count: 0, ...by, note: "no reference list in the entry's sections" };
  if (mine.references === 0) return { state: "partial", ...by, note: `${mine.lists} reference list(s) found but no entry kept` };
  return { state: "found", count: mine.references, ...by };
}

/**
 * The scheme an entry's candidates go to: one in the glossary directory whose
 * terms already cite this entry (a person may have named it otherwise), else
 * `<slug>.glossary.json`.
 */
export function schemeFor(glossaryDir: string, entryRel: string, slug: string): string {
  if (existsSync(glossaryDir)) {
    for (const f of readdirSync(glossaryDir).filter((n) => n.endsWith(".glossary.json")).sort()) {
      try {
        const g = JSON.parse(readFileSync(join(glossaryDir, f), "utf-8")) as { terms?: { source?: unknown }[] };
        if ((g.terms ?? []).some((t) => typeof t.source === "string" && t.source.startsWith(`${entryRel}/`))) return join(glossaryDir, f);
      } catch {
        // An unreadable scheme is check:glossary's finding, not this arm's.
      }
    }
  }
  return join(glossaryDir, `${slug}.glossary.json`);
}

/** The entry's title for a new scheme: `manifest.jsonld`'s, else the slug. */
function entryTitle(entry: string, slug: string): string {
  try {
    const t = (JSON.parse(readFileSync(join(entry, "manifest.jsonld"), "utf-8")) as { title?: unknown }).title;
    if (typeof t === "string" && t.trim()) return t.trim();
  } catch {
    // No manifest: the slug names it.
  }
  return slug;
}

/** The Tool `glossary-from-source` over one entry: its glossary and abbreviations sections become candidate terms. */
export function glossaryArm(ctx: LibraryEntryArmContext): ExtractionStep {
  const tool = "glossary-from-source";
  const where = sectionsOf(ctx, tool);
  if (typeof where !== "string") return where;
  const dir = instanceDirectoryForGraph(ctx.instanceRoot, "glossary");
  if (!dir) return notRun(tool, "the instance declares no glossary directory to hold the scheme");
  const version = scriptVersion(GLOSSARY_SCRIPT);
  const by = { tool, at: today(), ...(version ? { version } : {}) };
  const inputs = sectionsUnder(ctx.instanceRoot, where);
  if (!inputs.length) return { state: "none", count: 0, ...by, note: "no glossary, definitions or abbreviations section in the entry's sections" };
  const found = candidates(inputs);
  if (!found.length) return { state: "partial", ...by, note: `${inputs.length} glossary section(s) found but no term read` };
  const out = schemeFor(dir, relative(ctx.instanceRoot, ctx.entry), ctx.slug);
  const existing: Glossary | undefined = existsSync(out) ? GlossarySchema.parse(JSON.parse(readFileSync(out, "utf-8"))) : undefined;
  const g = merge(existing, found, { id: existing?.id ?? ctx.slug, title: existing?.title ?? entryTitle(ctx.entry, ctx.slug) });
  writeFileSync(out, `${JSON.stringify(g, null, 2)}\n`);
  return { state: "found", count: found.length, ...by, note: `candidates in ${relative(ctx.instanceRoot, out)}` };
}

export const PIPELINE_IMPLEMENTATIONS: Pick<PipelinePlugins, "tabular-csvw" | "library-entry-arms"> = {
  "tabular-csvw": {
    extract(source, { url, docId, mimetype }) {
      try {
        if (mimetype === XLSX_MIMETYPE) return extractXlsx(source, { url, docId });
        if (mimetype === null) return extractCsv(source.toString("utf-8"), { url, docId });
        return null;
      } catch (e) {
        if (e instanceof NotATableError) {
          console.error(`tabular-csvw: ${url}: ${e.message}`);
          return null;
        }
        throw e;
      }
    },
  },
  "library-entry-arms": {
    arms: (ctx) => [
      { kind: "references", run: () => referencesArm(ctx) },
      { kind: "glossary", run: () => glossaryArm(ctx) },
    ],
  },
};
