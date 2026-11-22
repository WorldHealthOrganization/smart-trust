#!/usr/bin/env bun
/**
 * folio-l1-coverage — run `l1-coverage` over a folio and the L1 entry it was
 * seeded from, with no per-folio code.
 *
 *   bun run folio-assistant-core/scripts/folio-l1-coverage.ts \
 *     --document <name> --l1 <library entry dir> [--folio folio/<name>] \
 *     [--exclusions folio/<name>/l1-coverage.exclusions.json] \
 *     [--quotes folio/<name>/l1-coverage.quotes.json] \
 *     [--glossary glossary] [--out folio/<name>/l1-coverage.json] [--check]
 *
 * Each DTH used to carry its own copy of this wiring (bean cysv, stage 1).
 * The copies read the L1 pages, collected the folio's text, and called
 * `l1-coverage.ts`; they differed only in literals. This is the one copy.
 *
 * ## Inputs
 *
 * - The L1 entry's sections, in the order of its structure file (else the sorted
 *   `sections/*.md`). Front matter and the "no text on this page" marker are
 *   dropped. Section N is "page" N of the report, so `p3:s2` is the second
 *   sentence of the third section.
 * - Every `.md` and `.ts` file under the folio directory is captured text:
 *   the whole file, the file with Markdown markup removed, and each line and
 *   sentence of it. A fragment shorter than 25 characters is not used, so a
 *   short phrase cannot capture a long sentence by appearing inside it.
 * - Every string in the `*.json` files of the glossary directory (`glossary/`
 *   unless `--glossary` names another): the glossary is published with the
 *   handbook, so a definition it quotes is held. Words are also matched with
 *   their inner hyphens removed, because the L1 extraction drops the hyphen of
 *   a word broken across lines.
 * - The quotes file, if there is one: `[{ "block", "quote", "location"?,
 *   "note"? }]`. A quote is a declared capture, for a sentence the folio holds
 *   in other words or split differently (a step number dropped from a
 *   heading, say). The quote must occur in the block's text, else it is a
 *   problem; it then captures any L1 sentence it occurs in. With `"l1"`, the
 *   quote stands for that L1 sentence instead (a source typo the folio
 *   corrected), as a declared mapping a person decided.
 * - The exclusions file, if there is one: `[{ "text" | "location", "reason",
 *   "signedOffBy"?, "signedOffAt"?, "note"? }]`. `text` is preferred, because
 *   a location moves when a section's text does. As in `l1-coverage`, an
 *   exclusion with no `signedOffBy` is a proposal and its sentence stays
 *   unaccounted: an agent may write the proposal, only a person signs it.
 *
 * ## Output
 *
 * The `l1-coverage-report/v1` report with each sentence's section id, written
 * to `--out`. `generatedAt` is left out so the file only changes when the
 * coverage does. With `--check` nothing is written: it exits 1 if a sentence
 * is unaccounted or the committed report is out of date, else 0.
 *
 * @graphNode none — a check over a folio and its L1 entry, not a schema
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { folioDir as declaredFolioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { readStructure, STRUCTURE_FILENAME } from "@litlfred/cat-harness-tools/schemas/content/document-structure.js";
import { coverage, exitCodeFor, normalise, sentencesOf, type Captured, type Exclusion, type Page } from "./l1-coverage.ts";

/** Fragments shorter than this are not used as captured text. */
export const MIN_FRAGMENT = 25;

export interface SectionPage extends Page {
  sectionId: string;
}

function stripFrontMatter(raw: string): string {
  const m = /^---\n[\s\S]*?\n---\n?/.exec(raw);
  return (m ? raw.slice(m[0].length) : raw).replace(/^_\(no text on this page\)_\s*$/gm, "");
}

/**
 * The L1 entry's sections, as numbered pages, in reading order: the order of
 * its structure file, read through the shared accessor. With no structure
 * file, the sorted `sections/*.md`. A structure file that cannot be read is an
 * error, never an entry with no sections.
 */
export function readL1Sections(l1Dir: string): SectionPage[] {
  const dir = join(l1Dir, "sections");
  let ids: string[];
  if (existsSync(join(l1Dir, STRUCTURE_FILENAME))) {
    const s = readStructure(l1Dir);
    if ("reason" in s) throw new Error(`${l1Dir}: ${s.reason}`);
    ids = s.sections.map((x) => x.id);
  } else {
    ids = readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => f.replace(/\.md$/, ""));
  }
  return ids.map((sectionId, i) => ({
    page: i + 1,
    sectionId,
    text: stripFrontMatter(readFileSync(join(dir, `${sectionId}.md`), "utf8")),
  }));
}

/** Markdown and table markup removed, so a sentence split across it still matches. */
export function plain(md: string): string {
  return md
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/^\s*(?:[-*+>#]+|\d+[.)])\s+/gm, "")
    .replace(/\s*\|\s*/g, " ");
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) =>
      e.isDirectory()
        ? e.name === "media" ? [] : walk(join(dir, e.name))
        : /\.(md|ts)$/.test(e.name) ? [join(dir, e.name)] : [],
    );
}

/**
 * The text with hyphens inside words removed: the L1 text extraction often
 * drops the hyphen of a word broken across a line ("open- source" becomes
 * "opensource"), so the folio's "open-source" would otherwise not match.
 */
export function unhyphenated(s: string): string {
  return s.replace(/(\w)[-‐‑]\s*(\w)/g, "$1$2");
}

/** Every string value in a JSON document, depth first. */
function jsonStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) jsonStrings(x, out);
  else if (v && typeof v === "object") for (const x of Object.values(v)) jsonStrings(x, out);
  return out;
}

/**
 * The glossary's text as captured statements: every string value of every
 * `*.json` under the glossary directory (definitions, scope notes, quoted
 * candidates). The glossary is published with the handbook, so a sentence it
 * holds is held, not left out (owner, 2026-11-01).
 */
export function glossaryCaptured(glossaryDir: string): Captured[] {
  if (!existsSync(glossaryDir)) return [];
  const out: Captured[] = [];
  const files = readdirSync(glossaryDir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".json")).sort();
  for (const f of files) {
    const id = `glossary/${f.replace(/\.json$/, "")}`;
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(join(glossaryDir, f), "utf8"));
    } catch {
      continue;
    }
    const seen = new Set<string>();
    for (const str of jsonStrings(doc)) {
      for (const t of [str, ...sentencesOf(str)]) {
        for (const v of [t.trim(), unhyphenated(t.trim())]) {
          if (v.length >= MIN_FRAGMENT && !seen.has(v)) {
            seen.add(v);
            out.push({ id, text: v });
          }
        }
      }
    }
  }
  return out;
}

/** Every fragment of the folio's text that can capture an L1 sentence. */
export function folioCaptured(folioDir: string): Captured[] {
  const out: Captured[] = [];
  for (const file of walk(folioDir)) {
    const id = relative(folioDir, file).replace(/\.(md|ts)$/, "");
    const raw = readFileSync(file, "utf8");
    const seen = new Set<string>();
    const add = (t: string) => {
      const s = t.trim();
      for (const v of [s, unhyphenated(s)]) {
        if (v.length >= MIN_FRAGMENT && !seen.has(v)) {
          seen.add(v);
          out.push({ id, text: v });
        }
      }
    };
    add(raw);
    const p = plain(raw);
    add(p);
    for (const line of raw.split(/\n+|\||<br\s*\/?>/i)) {
      const clean = plain(line);
      add(clean);
      for (const s of sentencesOf(clean)) add(s);
    }
    for (const s of sentencesOf(p)) add(s);
  }
  return out;
}

export interface Quote {
  block: string;
  quote: string;
  /**
   * The L1 sentence this quote stands for, when the folio holds it in
   * corrected words (a typo in the source fixed, say). The quote must still
   * occur in the block; the capture is then this L1 text. A person decides
   * that the two say the same, so the mapping is declared, not inferred.
   */
  l1?: string;
  location?: string;
  note?: string;
}

export interface FolioCoverageOptions {
  l1Dir: string;
  folioDir: string;
  exclusions?: (Exclusion & { note?: string })[];
  quotes?: Quote[];
  /** The folio's glossary directory; its text counts as captured. */
  glossaryDir?: string;
}

/** Declared captures, each checked against its block's text. */
export function quoteCaptures(folioDir: string, quotes: Quote[], problems: string[]): Captured[] {
  const out: Captured[] = [];
  for (const q of quotes) {
    const file = [".md", ".ts"].map((x) => join(folioDir, q.block + x)).find((f) => existsSync(f));
    if (!file) {
      problems.push(`quote for ${q.block}: no block ${q.block}.md or .ts in ${folioDir}`);
      continue;
    }
    if (!normalise(plain(readFileSync(file, "utf8"))).includes(normalise(plain(q.quote)))) {
      problems.push(`quote for ${q.block}: not found in ${relative(".", file)}: ${q.quote}`);
      continue;
    }
    out.push({ id: q.block, text: q.l1 ?? q.quote });
  }
  return out;
}

export function folioCoverage(o: FolioCoverageOptions) {
  const sections = readL1Sections(o.l1Dir);
  const problems: string[] = [];
  const captured = [
    ...quoteCaptures(o.folioDir, o.quotes ?? [], problems),
    ...folioCaptured(o.folioDir),
    ...(o.glossaryDir ? glossaryCaptured(o.glossaryDir) : []),
  ];
  const report = coverage(sections, captured, o.exclusions ?? []);
  report.problems.push(...problems);
  const { generatedAt: _drop, ...rest } = report;
  return {
    ...rest,
    l1Entry: o.l1Dir,
    folio: o.folioDir,
    pages: rest.pages.map((p) => ({ sectionId: sections[p.page - 1].sectionId, ...p })),
    sentences: rest.sentences.map((s) => ({ sectionId: sections[s.page - 1].sectionId, ...s })),
    _report: report,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const doc = at("--document");
  const l1Dir = at("--l1");
  if (!doc || !l1Dir) {
    console.error("usage: folio-l1-coverage.ts --document <name> --l1 <dir> [--folio <dir>] [--exclusions <file>] [--quotes <file>] [--glossary <dir>] [--out <file>] [--check]");
    process.exit(2);
  }
  const folioDir = at("--folio") ?? join(relative(process.cwd(), declaredFolioDir(process.cwd())), doc);
  const exFile = at("--exclusions") ?? join(folioDir, "l1-coverage.exclusions.json");
  const outFile = at("--out") ?? join(folioDir, "l1-coverage.json");
  const quFile = at("--quotes") ?? join(folioDir, "l1-coverage.quotes.json");
  const exclusions = existsSync(exFile) ? JSON.parse(readFileSync(exFile, "utf8")) : [];
  const quotes = existsSync(quFile) ? JSON.parse(readFileSync(quFile, "utf8")) : [];
  const glossaryDir = at("--glossary") ?? "glossary";
  const { _report, ...out } = folioCoverage({ l1Dir, folioDir, exclusions, quotes, glossaryDir });
  const json = JSON.stringify(out, null, 2) + "\n";
  const t = out.totals;
  for (const s of out.sentences.filter((x) => x.state === "unaccounted")) {
    console.error(`✗ ${s.location} (${s.sectionId}) unaccounted${s.proposedReason ? ` (proposed ${s.proposedReason}, not signed off)` : ""}: ${s.text}`);
  }
  for (const p of out.problems) console.error(`✗ ${p}`);
  let code = exitCodeFor(_report);
  if (args.includes("--check")) {
    if (!existsSync(outFile) || readFileSync(outFile, "utf8") !== json) {
      console.error(`✗ ${outFile} is out of date: run this without --check`);
      code = code || 1;
    }
  } else {
    writeFileSync(outFile, json);
    console.log(`wrote ${outFile}`);
  }
  console.log(
    `${code ? "✗" : "✓"} L1 coverage of ${doc}: ${t.normative} normative sentence(s) in ${out.pages.length} section(s); ${t.captured} captured, ${t.excluded} excluded, ${t.unaccounted} unaccounted (${t.accountedForPct}% accounted for)`,
  );
  process.exit(code);
}
