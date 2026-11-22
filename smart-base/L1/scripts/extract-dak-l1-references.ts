#!/usr/bin/env bun
/**
 * A DAK's Component 1 → the L1 sources it cites, as a smart-kg L1 graph.
 *
 * Bean `5uyl`. Every WHO SMART Guidelines DAK opens with Component 1, "Health
 * interventions and recommendations": §1.1 lists the interventions the DAK
 * covers and §1.2 names the WHO guidelines and guidance they draw from, each
 * with a printed back-reference `(n)` into the DAK's own reference list. That
 * section IS the DAK's L1 bibliography — the documents a library built for the
 * DAK has to hold — and until this script it was read by eye.
 *
 * ## What it emits (smart-kg L1 3.0, WHO main `3f5e477`, plus smart-base's `l1-library` layer)
 *
 *   citation         one per printed `(n)` in §1.2, its text VERBATIM (line
 *                    breaks joined by one space, nothing else changed), and the
 *                    unnumbered source §1.1's lead names, left unresolved
 *   reference-entry  one per reference a citation's number names
 *   publication      what an entry resolves to, when that source is L1
 *   library-node     what an entry resolves to, when the library HOLDS the
 *                    source and it is not L1 — upstream of L1 (owner, 2026-10-07)
 *
 *   citation         numberedAs  reference-entry               derived
 *   reference-entry  resolvesTo  publication | library-node    inferred
 *
 * Until 3.0 this emitted `external-artifact`, `appearsIn` and the §1.1
 * health interventions with `implementedBy`. 3.0 moved the first three to L2,
 * and a 3.0 `health-intervention` is a catalogue entry keyed by its code,
 * which §1.1's bullet list does not print — so none is emitted.
 *
 * ## L1 or not is decided, not assumed
 *
 * §1.2 introduces its cards as "the WHO guidelines and guidance" the DAK draws
 * on: a CONTEXT decision that each is L1 ({@link contextClassification}). A
 * held source's intake may say otherwise — a person's declaration outranks
 * context — and {@link decideL1} reports the disagreement rather than choosing
 * silently. `--record-context` writes the context record onto each held
 * source's intake, once.
 *
 * ## Resolution is a judgement, and is recorded as one
 *
 * The printed number is the evidence: it is the DAK's own back-reference into
 * its own bibliography, so a citation resolves to the entry its number names.
 * What is a judgement is WHICH numbered list that is — a DAK carries several:
 * the reference list, its implementation tools' list, every workflow's
 * numbered steps — so the list is CHOSEN as the one holding every cited
 * number with the most title agreement, and the choice and its score are in
 * each edge's note. Per citation, title agreement is corroboration only: a
 * card often DESCRIBES its source ("Summarizes recommended routine
 * immunizations for all age groups … (29)") rather than naming it ("WHO
 * recommendations for routine immunization – summary tables"). Below
 * {@link AGREEMENT} the edge still resolves, its note says the words differ,
 * and the run reports it for the person who does the fidelity check.
 *
 * §1.1's "WHO universal health coverage list of essential interventions"
 * carries no number, so it is recorded as an UNRESOLVED citation with its
 * title-match candidate named in the note.
 *
 * ## Reuse
 *
 * Section reading and serialisation are `extract-smart-kg-l1.ts`'s
 * ({@link readEntry}, {@link serialise}, {@link isCurrent}); IRIs are smart-kg's
 * (`l1-kgid.ts`), under the DAK's namespace from its DAK declaration (`index.config.json#contentTypes.dak`, or `dak.json`) for what the DAK
 * prints (citations, reference entries) and under the WHO-wide L1 namespace for
 * publications. A publication the library HOLDS is described exactly as
 * `l1-specialise.ts` describes it ({@link publicationProperties}), so the two
 * documents name one publication with one node.
 *
 *   bun run smart-base/L1/scripts/extract-dak-l1-references.ts --entry <DAK library entry> [--uploads <dir>]
 *     [--record-context] [--check] [--validate-zod <smart-base checkout>]
 *
 * Exit: 0 written / current, 1 stale or invalid, 2 usage or unreadable entry.
 *
 * @module smart-base/L1/scripts/extract-dak-l1-references
 * @covers library
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { handleFromUrl, readStructure } from "../../platform/index.js";
import { readIgDakMetadata } from "../../scripts/ig-dak-metadata.ts";
import { isCurrent, readEntry, serialise, type LibraryEntry as BaseEntry } from "./extract-smart-kg-l1.ts";
import { artifactId, citationId, dakNamespace, L1_LIBRARY_CONTEXT, L1_V3_ONTOLOGY_VERSION, publicationId, referenceEntryId, sha256 } from "./l1-kgid.ts";
import { checkClassification, decideL1, LAYER_SCHEME, type IntakeClassification } from "./l1-membership.ts";
import { CAT_HARNESS_NS, dc, heldIntakes, identifiersOf, publicationProperties, type Held } from "./l1-specialise.ts";

/** A library entry, with the checkout it is read from. */
type LibraryEntry = BaseEntry & { repo: string };

/** Written beside the DAK's entry. Not `smart-kg-l1.json`: that name is the recommendation extractor's. */
export const DAK_L1_FILENAME = "smart-kg-l1-dak-references.json";
const SKILL = "smart-base/dak-l1-library";
/** Below this share of a citation's words found in the reference's title, the match is flagged for a person. */
export const AGREEMENT = 0.34;

type Derivation = "derived" | "inferred" | "decided";
interface Evidence {
  location: string;
  quote?: string;
  by?: string;
  at?: string;
}
export interface Node {
  id: string;
  type: string;
  label: string;
  properties: Record<string, unknown>;
  derivation: Derivation;
  note?: string;
  evidence?: Evidence;
  skill: string;
}
export interface Edge {
  type: "Statement";
  predicate: string;
  source: string;
  target: string;
  derivation: Derivation;
  note?: string;
  evidence?: Evidence;
  skill: string;
}
export interface Doc {
  "@context": string;
  id: string;
  type: "Entity";
  ontologyVersion: string;
  generatedAt: string;
  wasDerivedFrom: { path: string; sha256: string; note?: string }[];
  nodes: Node[];
  edges: Edge[];
  dak?: Record<string, unknown>;
}

/** The ingested PDF, as `structure.json` recorded it. */
const sourceOf = (e: LibraryEntry): { file: string; sha256: string } => (e.structure.raw as unknown as { source: { file: string; sha256: string } }).source;
const joinLines = (lines: string[]): string => lines.map((l) => l.trim()).filter((l) => l !== "").join(" ");

// ── Reading the pages ───────────────────────────────────────────────────────

interface Page {
  /** Repo-relative path of the section file. */
  path: string;
  /** Body lines (front matter removed) with their 1-based line number in the file. */
  lines: { n: number; text: string }[];
  pdfPage?: number;
}

function pagesOf(entry: LibraryEntry): Page[] {
  const out: Page[] = [];
  for (const s of entry.structure.sections) {
    const t = entry.texts.get(s.id);
    if (!t) continue;
    const all = t.text.split("\n");
    let start = 0;
    if (all[0] === "---") start = all.indexOf("---", 1) + 1;
    const pdf = /^pdf_page:\s*(\d+)/m.exec(t.text)?.[1];
    out.push({ path: t.path, lines: all.slice(start).map((text, i) => ({ n: start + i + 1, text })), pdfPage: pdf ? Number(pdf) : undefined });
  }
  return out;
}

// ── Component 1 ─────────────────────────────────────────────────────────────

const H11 = /^\s*1\.1\s+\S/;
const H12 = /^\s*1\.2\s+.*\b(guidelines?|recommendations?|guidance)\b/i;
/** The end of §1.2: Component 2 begins, or a numbered §2.x heading. */
const END12 = /^\s*(Component\s*$|Generic personas\s*$|2\.\d\s)/;

export interface Citation {
  text: string;
  number: number;
  page: Page;
  line: number;
}

/** Every `(n)` in §1.2 with the text since the previous one, verbatim. */
export function readCitations(pages: Page[]): { section?: { page: Page; line: number; heading: string }; citations: Citation[] } {
  for (const page of pages) {
    const at = page.lines.findIndex((l) => H12.test(l.text));
    if (at < 0) continue;
    const citations: Citation[] = [];
    let buf: string[] = [];
    for (const l of page.lines.slice(at + 1)) {
      if (END12.test(l.text)) break;
      buf.push(l.text);
      const m = /\((\d{1,3})\)\s*$/.exec(l.text);
      if (!m) continue;
      let text = joinLines(buf);
      // The run-in sentence before the first card ("These interventions draw
      // from the following …") ends with a full stop; a card does not.
      const lastStop = text.lastIndexOf(". ");
      if (lastStop >= 0) text = text.slice(lastStop + 2);
      citations.push({ text, number: Number(m[1]), page, line: l.n });
      buf = [];
    }
    return { section: { page, line: page.lines[at]!.n, heading: joinLines([page.lines[at]!.text]) }, citations };
  }
  return { citations: [] };
}

export interface Intervention {
  name: string;
  group: string;
  page: Page;
  line: number;
}

/** §1.1's bulleted interventions: `»` opens a group, `–` an item. */
export function readInterventions(pages: Page[]): { section?: { page: Page; line: number; heading: string; lead?: string }; items: Intervention[] } {
  for (const page of pages) {
    const at = page.lines.findIndex((l) => H11.test(l.text));
    if (at < 0) continue;
    const items: Intervention[] = [];
    let group = "";
    let lead: string | undefined;
    let cur: { lines: string[]; line: number } | undefined;
    let mode: "lead" | "group" | "item" = "lead";
    const flush = () => {
      if (cur && mode === "item") items.push({ name: joinLines(cur.lines).replace(/[.,;]$/, ""), group, page, line: cur.line });
      cur = undefined;
    };
    const rest = page.lines.slice(at + 1);
    for (const l of rest) {
      const t = l.text.trim();
      if (/^Note:/.test(t) || H12.test(l.text)) break;
      if (t === "»") {
        flush();
        mode = "group";
        cur = { lines: [], line: l.n };
        continue;
      }
      if (t === "–") {
        if (mode === "group" && cur) group = joinLines(cur.lines);
        flush();
        mode = "item";
        cur = { lines: [], line: l.n + 1 };
        continue;
      }
      if (mode === "lead" && /\.$/.test(t) && !lead && !/^1\.1/.test(t) && t.length > 20) lead = t;
      cur?.lines.push(l.text);
    }
    flush();
    const heading = joinLines(page.lines.slice(at, at + 2).map((l) => l.text).filter((x) => !/^Interventions referenced/.test(x)));
    return { section: { page, line: page.lines[at]!.n, heading, lead }, items };
  }
  return { items: [] };
}

// ── Reference lists ─────────────────────────────────────────────────────────

export interface Reference {
  number: number;
  text: string;
  page: Page;
  line: number;
}

/** Every numbered list in the document; numbering restarting at 1 starts a new list. */
export function readReferenceLists(pages: Page[]): Reference[][] {
  const lists: Reference[][] = [];
  let list: Reference[] | undefined;
  for (const page of pages) {
    let cur: { r: Reference; lines: string[] } | undefined;
    const close = () => {
      if (cur) cur.r.text = joinLines(cur.lines);
      cur = undefined;
    };
    for (const l of page.lines) {
      const m = /^(\d{1,3})\.\s+(\S.*)$/.exec(l.text);
      if (m) {
        close();
        const n = Number(m[1]);
        if (n === 1 || !list || n !== list[list.length - 1]!.number + 1) {
          list = [];
          lists.push(list);
        }
        const r: Reference = { number: n, text: "", page, line: l.n };
        list.push(r);
        cur = { r, lines: [m[2]!] };
        continue;
      }
      // A reference ends at its closing ")." (the URL WHO's style puts last),
      // at the next numbered entry, or at page furniture: a bare page number
      // or a running heading. NOT at the first full stop — the title ends with
      // one, and closing there dropped reference 26's place, year and URL.
      const t = l.text.trim();
      if (cur && !/\)\.\s*$/.test(joinLines(cur.lines)) && t !== "" && !/^\d+$/.test(t) && !/^References\d*$/.test(t)) cur.lines.push(l.text);
      else close();
    }
    close();
  }
  return lists;
}

const STOP = new Set(["the", "and", "for", "with", "from", "this", "that", "including", "updated", "cited", "who", "of", "in", "on", "to", "a", "an"]);
const words = (s: string): Set<string> =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
      .map((w) => w.replace(/(ations?|ed|s)$/, "")),
  );

/** The reference's title: the text before its first full stop. */
export const titleOf = (ref: string): string => ref.split(/\.\s/)[0]!.replace(/\s*\[[^\]]+\]\s*$/, "").trim();

/** Share of the citation's content words found in the reference title. */
export function agreement(citation: string, ref: string): number {
  const c = words(citation);
  const t = words(titleOf(ref));
  if (c.size === 0) return 0;
  let hit = 0;
  for (const w of c) if (t.has(w)) hit++;
  return hit / c.size;
}

/** The list the citations point into: holds every number, most title agreement. */
export function chooseList(lists: Reference[][], cites: Citation[]): { list: Reference[]; score: number } | undefined {
  const needed = [...new Set(cites.map((c) => c.number))];
  let best: { list: Reference[]; score: number } | undefined;
  for (const list of lists) {
    const by = new Map(list.map((r) => [r.number, r]));
    if (!needed.every((n) => by.has(n))) continue;
    const score = cites.reduce((s, c) => s + agreement(c.text, by.get(c.number)!.text), 0) / Math.max(cites.length, 1);
    if (!best || score > best.score) best = { list, score };
  }
  return best;
}

// ── What the library holds ──────────────────────────────────────────────────

/** A held source: its intake and record, and the library entry its PDF became (by hash). */
interface HeldSource extends Held {
  entryDir?: string;
  manifestIri?: string;
}

/** Resolve a library node id against its manifest's `@base`, as JSON-LD would. */
function manifestIriOf(dir: string): string | undefined {
  const p = join(dir, "manifest.jsonld");
  if (!existsSync(p)) return undefined;
  const m = JSON.parse(readFileSync(p, "utf-8")) as { "@context"?: unknown; "@id": string };
  const ctx = Array.isArray(m["@context"]) ? m["@context"] : [m["@context"]];
  const base = ctx.map((c) => (c && typeof c === "object" ? (c as { "@base"?: string })["@base"] : undefined)).find(Boolean);
  return /^[a-z]+:/i.test(m["@id"]) || !base ? m["@id"] : new URL(m["@id"], base).href;
}

/** A URL as a lookup key: scheme, `www.`, query, fragment, trailing slash and case dropped. */
export const urlKey = (u: string): string =>
  u.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "");

/**
 * Held sources keyed by IRIS handle AND by their record's `dc.identifier.uri`
 * (as {@link urlKey}), joined to their library entry by PDF hash. The URL key
 * is what reaches a source with no handle — a who.int item page.
 */
function heldByHandle(repo: string, libraryDirs: string[], uploadsDir?: string): Map<string, HeldSource> {
  const entryBySha = new Map<string, string>();
  for (const lib of libraryDirs) {
    for (const d of existsSync(lib) ? readdirSync(lib, { withFileTypes: true }) : []) {
      if (!d.isDirectory()) continue;
      const structure = readStructure(join(lib, d.name));
      if ("reason" in structure) continue;
      const sha = (structure.raw as unknown as { source?: { sha256?: string } }).source?.sha256;
      if (sha) entryBySha.set(sha, join(lib, d.name));
    }
  }
  const out = new Map<string, HeldSource>();
  for (const h of heldIntakes(repo, uploadsDir)) {
    if (!h.record) continue;
    const entryDir = h.pdfSha256 ? entryBySha.get(h.pdfSha256) : undefined;
    for (const uri of dc(h.record, "identifier", "uri")) {
      const held = { ...h, entryDir, manifestIri: entryDir ? manifestIriOf(entryDir) : undefined };
      const handle = handleFromUrl(uri);
      if (handle) out.set(handle, held);
      out.set(urlKey(uri), held);
    }
  }
  return out;
}

// ── The document ────────────────────────────────────────────────────────────

const urlOf = (ref: string): string | undefined => {
  const m = /\((https?:\/\/[^)]*)\)\.?\s*$/.exec(ref);
  // A URL broken across lines was joined with a space; the space is the join, not the URL.
  return m ? m[1]!.replace(/\s+/g, "") : undefined;
};
const yearOf = (ref: string): string | undefined => [...ref.replace(/\(https?:[^)]*\)/g, "").matchAll(/\b(19|20)\d{2}\b/g)].pop()?.[0];
/** "<title>. <place>: <publisher>; <year>" or, for an undated web page, "<place>: <publisher> (<url>)". */
const publisherOf = (ref: string): string | undefined => /\.\s+[^.:;]+:\s*([^;:(]+?)\s*[;(]/.exec(ref)?.[1]?.trim();

/**
 * L1 3.0 publicationType from the title's own words, and only from them. A
 * guideline's subtype (standard, consolidated, interim…) turns on its GRC
 * history, which a title does not carry, so "guideline" yields none.
 */
export function publicationTypeOf(title: string): string | undefined {
  if (/\bsummary tables?\b/i.test(title)) return "summary-table";
  if (/\bposition papers?\b/i.test(title)) return "position-paper";
  if (/\bclassification\b/i.test(title)) return "classification";
  if (/\bguidance\b/i.test(title)) return "implementation-guidance";
  return undefined;
}

/** The context decision §1.2 makes about every source it cites. */
export const contextClassification = (n: number, heading: string): IntakeClassification => ({
  scheme: LAYER_SCHEME,
  code: "l1",
  member: true,
  source: "context",
  basis: `cited as reference ${n} in DAK Component 1 ${heading.replace(/\s+/g, " ")} — the WHO guidelines and guidance the DAK draws on (smart-base/L1/scripts/extract-dak-l1-references.ts)`,
});

export function dakL1Document(
  entry: LibraryEntry,
  dakNs: string,
  held: Map<string, HeldSource>,
  generatedAt: string,
  dakJson?: Record<string, unknown>,
): { doc: Doc; report: string[]; context: { held: HeldSource; record: IntakeClassification }[] } {
  const pages = pagesOf(entry);
  const report: string[] = [];
  const docId = entry.path.split("/").pop()!;
  const artifact = artifactId(dakNs, docId);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const context: { held: HeldSource; record: IntakeClassification }[] = [];
  const at = (p: Page, line: number) => `${p.path}:${line}${p.pdfPage ? ` (PDF p. ${p.pdfPage})` : ""}`;
  const add = (n: Node) => {
    if (!nodes.some((x) => x.id === n.id)) nodes.push(n);
  };

  // §1.2 — cited guidance
  const { section: s12, citations } = readCitations(pages);
  if (!s12) report.push("no §1.2 heading (\"1.2 … guidelines / recommendations / guidance\") found — nothing cited is read");
  const lists = readReferenceLists(pages);
  const chosen = chooseList(lists, citations);
  if (citations.length && !chosen) report.push(`no numbered list holds every cited number (${[...new Set(citations.map((c) => c.number))].join(", ")})`);

  for (const c of citations) {
    const ref = chosen?.list.find((r) => r.number === c.number);
    const score = ref ? agreement(c.text, ref.text) : 0;
    const weak = !!ref && score < AGREEMENT;
    const cid = citationId(dakNs, c.text);
    add({
      id: cid,
      type: "citation",
      label: `${c.text.replace(/\s*\(\d+\)$/, "")} (${c.number})`,
      properties: { text: c.text, numbering: String(c.number), citationKind: "reference", resolutionStatus: ref ? "resolved" : "unresolved" },
      derivation: "derived",
      evidence: { location: at(c.page, c.line), quote: c.text },
      skill: SKILL,
    });
    if (!ref) {
      report.push(`(${c.number}) is not in the chosen reference list`);
      continue;
    }
    if (weak) report.push(`(${c.number}) "${c.text}" — title agreement ${score.toFixed(2)} < ${AGREEMENT}: resolved by its number; a person should confirm it`);
    const rid = referenceEntryId(artifact, String(c.number));
    const url = urlOf(ref.text);
    edges.push({
      type: "Statement",
      predicate: "numberedAs",
      source: cid,
      target: rid,
      derivation: "derived",
      note: `By the printed number (${c.number}) into the reference list starting ${chosen!.list[0]!.page.path}:${chosen!.list[0]!.line} (chosen of ${lists.length} numbered lists: it holds every cited number, mean title agreement ${chosen!.score.toFixed(2)}); title agreement ${score.toFixed(2)}${weak ? ` — BELOW ${AGREEMENT}: the card describes its source rather than naming it, so a person should confirm it` : ""}.`,
      skill: SKILL,
    });
    if (nodes.some((n) => n.id === rid)) continue;

    // What the entry resolves to: the held source's own decision, with §1.2's context added.
    const handle = url ? handleFromUrl(url) : undefined;
    const h = (handle ? held.get(handle) : undefined) ?? (url ? held.get(urlKey(url)) : undefined);
    const ctx = contextClassification(c.number, s12!.heading);
    let target: string | undefined;
    let how = "";
    if (h?.record) {
      if (!(h.intake.classifications ?? []).some((x) => x.source === "context")) context.push({ held: h, record: ctx });
      const recorded = h.intake.classifications ?? [];
      const decision = decideL1({ ...h.intake, classifications: recorded.some((x) => x.source === "context") ? recorded : [...recorded, ctx] }, h.record);
      for (const d of decision.disagreements) report.push(`(${c.number}) ${d}`);
      if (decision.status === "member") {
        target = publicationId(identifiersOf(h.record));
        add({
          id: target,
          type: "publication",
          label: String(dc(h.record, "title")[0] ?? titleOf(ref.text)),
          properties: publicationProperties(h.record, h.pdfSha256, decision.publicationType ?? publicationTypeOf(titleOf(ref.text))),
          derivation: decision.derivation === "decided" ? "decided" : "inferred",
          note: `Held by this library${h.entryDir ? ` (${h.manifestIri})` : ""}. L1 because ${decision.decidedBy!.source}: ${decision.decidedBy!.basis}. Properties are its repository Dublin Core record (${h.recordPath}); sha256 pins the PDF.`,
          evidence: { location: h.intakePath, quote: decision.decidedBy!.basis, ...(decision.derivation === "decided" ? { by: decision.decidedBy!.by ?? "unknown", at: (decision.decidedBy!.at ?? "").slice(0, 10) } : {}) },
          skill: SKILL,
        });
        how = `the held source ${h.recordPath}, matched by handle ${handle}; it is L1, so the target is its L1 publication`;
      } else if (h.manifestIri) {
        target = h.manifestIri;
        add({ id: target, type: "library-node", label: `Library entry ${h.entryDir!.split("/").pop()}`, properties: { iri: target, libraryClass: `${CAT_HARNESS_NS}SourceDocument`, entry: h.entryDir!.split("/").pop()! }, derivation: "derived", skill: SKILL });
        how = `the held source ${h.recordPath}, matched by handle ${handle}; it is ${decision.status === "not-member" ? `not L1 (${decision.decidedBy!.source}: ${decision.decidedBy!.basis})` : "of undetermined membership"}, so the target is its library entry — upstream of L1`;
      } else report.push(`(${c.number}) held as ${h.recordPath} but not L1 and not ingested — left unresolved`);
    } else if (url) {
      const title = titleOf(ref.text);
      target = publicationId([{ type: "url", value: url }]);
      const props: Record<string, unknown> = {
        title,
        ...(yearOf(ref.text) ? { issued: yearOf(ref.text) } : {}),
        ...(publisherOf(ref.text) ? { publisher: publisherOf(ref.text) } : {}),
        identifiers: [{ type: "url", value: url }],
        url,
        ...(publicationTypeOf(title) ? { publicationType: publicationTypeOf(title) } : {}),
      };
      add({
        id: target,
        type: "publication",
        label: title,
        properties: props,
        derivation: "inferred",
        note: `Not held by this library. L1 by context: ${ctx.basis}. Read from reference ${c.number}: title = the text before its first full stop, issued = the last year outside the URL, publisher = the name after "<place>:", url = the parenthesised URL with line-break spaces removed${props.publicationType ? `; publicationType "${props.publicationType}" from the title's own words` : ""}.`,
        evidence: { location: at(ref.page, ref.line), quote: ref.text },
        skill: SKILL,
      });
      how = "the reference's own URL; the source is not held";
    } else report.push(`(${c.number}) carries no URL and is not held — left unresolved`);

    add({
      id: rid,
      type: "reference-entry",
      label: `(${c.number})`,
      properties: { number: String(c.number), text: ref.text, ...(url ? { url } : {}), resolutionStatus: target ? "resolved" : "unresolved" },
      derivation: "derived",
      evidence: { location: at(ref.page, ref.line), quote: ref.text },
      skill: SKILL,
    });
    if (target) {
      edges.push({ type: "Statement", predicate: "resolvesTo", source: rid, target, derivation: "inferred", note: `Resolved through ${how}.`, evidence: { location: at(ref.page, ref.line), quote: ref.text }, skill: SKILL });
    }
  }

  // §1.1's lead names a source without a number: a citation, unresolved.
  const { section: s11 } = readInterventions(pages);
  if (s11?.lead) {
    const m = /based on (WHO [^.]+?)\./i.exec(s11.lead);
    if (m) {
      const text = m[1]!;
      const cand = lists.flat().map((r) => ({ r, s: agreement(text, r.text) })).sort((a, b) => b.s - a.s)[0];
      add({
        id: citationId(dakNs, text),
        type: "citation",
        label: text,
        properties: { text, citationKind: "reference", resolutionStatus: "unresolved" },
        derivation: "derived",
        note: cand && cand.s >= AGREEMENT ? `Unnumbered (§1.1). Best title match is reference ${cand.r.number} ("${titleOf(cand.r.text)}", agreement ${cand.s.toFixed(2)}); not resolved on words alone.` : "Unnumbered (§1.1), and no reference title agrees with it.",
        evidence: { location: at(s11.page, s11.line), quote: s11.lead },
        skill: SKILL,
      });
    }
  }

  const pageFiles = [...new Set([...citations.map((c) => c.page), ...(s11 ? [s11.page] : []), ...(chosen ? chosen.list.map((r) => r.page) : [])].map((p) => p.path))];
  const repo = entry.repo;
  const listing = pageFiles.map((p) => `${sha256(readFileSync(join(repo, p)))}  ${p}`).join("\n") + "\n";
  const records = [...new Set([...held.values()].filter((h) => nodes.some((n) => n.evidence?.location === h.intakePath || n.id === h.manifestIri)).flatMap((h) => [h.intakePath, ...(h.recordPath ? [h.recordPath] : [])]))].sort();
  const doc: Doc = {
    "@context": L1_LIBRARY_CONTEXT,
    id: `${artifact}/kg/l1-references`,
    type: "Entity",
    ontologyVersion: L1_V3_ONTOLOGY_VERSION,
    generatedAt,
    wasDerivedFrom: [
      { path: sourceOf(entry).file, sha256: sourceOf(entry).sha256, note: "The DAK PDF as hashed at ingest (structure.json); not re-read here." },
      { path: `${entry.path}/structure.json`, sha256: entry.structureSha256 },
      { path: `${entry.path}/sections/`, sha256: sha256(listing), note: `The ${pageFiles.length} section text(s) read, hashed as a sha256sum listing (<hex>  <path>).` },
      ...records.map((p) => ({ path: p, sha256: sha256(readFileSync(join(repo, p))), note: "An intake or Dublin Core record a resolution was read from." })),
    ],
    nodes,
    edges,
    ...(dakJson ? { dak: Object.fromEntries(["id", "name", "title", "version", "status", "canonicalUrl", "publicationUrl"].filter((k) => k in dakJson).map((k) => [k, dakJson[k]])) } : {}),
  };
  const n = (t: string) => nodes.filter((x) => x.type === t).length;
  report.unshift(`${n("citation")} citation(s), ${n("reference-entry")} reference entr(ies) → ${n("publication")} L1 publication(s), ${n("library-node")} held non-L1 source(s)`);
  return { doc, report, context };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function gitRoot(dir: string): string {
  return execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim();
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const entryArg = opt("--entry");
  if (!entryArg) {
    console.error("usage: extract-dak-l1-references.ts --entry <DAK library entry> [--uploads <dir>] [--record-context] [--context-only] [--check] [--validate-zod <smart-base>]");
    process.exit(2);
  }
  const dir = resolve(entryArg);
  const repo = gitRoot(dir);
  const entry = readEntry(dir, repo);
  if ("reason" in entry) {
    console.error(`✗ ${entryArg}: ${entry.reason}`);
    process.exit(2);
  }
  const dakMeta = readIgDakMetadata(repo);
  const dakJson = dakMeta?.data as { canonicalUrl?: string } | undefined;
  if (typeof dakJson?.canonicalUrl !== "string") {
    console.error(`✗ ${repo}: no DAK declaration (index.config.json contentTypes.dak, or dak.json) with a canonicalUrl — the DAK namespace citation IRIs are minted under`);
    process.exit(2);
  }
  const held = heldByHandle(repo, [dirname(dir)], opt("--uploads"));
  const { doc, report, context } = dakL1Document({ ...entry, repo }, dakNamespace(dakJson.canonicalUrl), held, new Date().toISOString().replace(/\.\d+Z$/, "Z"), dakJson);
  for (const r of report) console.log(`  ${r}`);
  // The context decision, written onto each held source's intake once (--record-context).
  for (const { held: h, record } of context) {
    if (!args.includes("--record-context")) {
      console.log(`  context: ${h.intakePath} would record L1 by context (--record-context writes it)`);
      continue;
    }
    const errs = checkClassification(record);
    if (errs.length) throw new Error(`context record breaks cat-harness/schemas/intake.ts: ${errs.join("; ")}`);
    const raw = JSON.parse(readFileSync(h.abs.intake, "utf-8"));
    raw.classifications = [...(raw.classifications ?? []), record];
    writeFileSync(h.abs.intake, `${JSON.stringify(raw, null, 2)}\n`);
    console.log(`  context: recorded on ${h.intakePath}`);
  }
  // Owner, 2026-10-08: a DAK is not L1, so it carries no L1 graph. Reading
  // Component 1 is how its L1 sources are found and decided by context;
  // --context-only does that and writes nothing beside the DAK.
  if (args.includes("--context-only")) process.exit(0);
  const target = join(dir, DAK_L1_FILENAME);
  const existing = existsSync(target) ? readFileSync(target, "utf-8") : undefined;
  if (args.includes("--check")) {
    if (!isCurrent(existing, doc as never)) {
      console.error(`✗ ${relative(process.cwd(), target)} is stale — re-run without --check`);
      process.exit(1);
    }
    console.log(`✓ ${relative(process.cwd(), target)} current`);
  } else if (!isCurrent(existing, doc as never)) {
    writeFileSync(target, serialise(doc as never));
    console.log(`wrote ${relative(process.cwd(), target)}`);
  } else console.log(`${relative(process.cwd(), target)} current`);
  const zod = opt("--validate-zod");
  if (zod) process.exit(spawnSync("npx", ["tsx", "src/validate.ts", target], { cwd: join(zod, "kg"), stdio: "inherit" }).status ?? 1);
}
