#!/usr/bin/env bun
/**
 * One ingested library entry → one smart-kg L1 graph document:
 * `publication` → `publication-section` → `recommendation`. Bean `8pzh`.
 *
 * smart-kg's README says *"no PDF extractor, so publication and recommendation
 * nodes must currently be authored by hand"*. The ingest pipeline already
 * holds what such an extractor needs — the sections, their pages and their
 * text — so this reads a library entry rather than the PDF.
 *
 * ## What is READ, and what is never inferred
 *
 * smart-kg `docs/SCOPE.md`: *"a paraphrased recommendation is a different
 * recommendation"*. So:
 *
 * - a recommendation is found only by its PRINTED label (`Recommendation 8:`),
 *   never by prose that mentions recommending something. Those mentions are
 *   counted and reported, never emitted;
 * - its `statement` is the text after the label up to the first terminator
 *   (blank line, a wholly parenthesised line, a `Source:` line, the next
 *   label). Line breaks are joined with one space and NOTHING else changes —
 *   no de-hyphenation, no re-casing. A block with no terminator within
 *   {@link MAX_STATEMENT_LINES} lines is refused rather than cut at a guess;
 * - GRADE `strength` and `certainty` are set only when a GRADE phrase is in
 *   that same block, and the phrase is then a substring of `evidence.quote`.
 *   Anything else — including WHO's own non-GRADE categories such as
 *   *"(Recommended only in specific contexts or conditions)"* — is left
 *   unset, and the node's `note` quotes what the source said instead;
 * - a source attribution under a recommendation (`Source: WHO, 2019 (2).`) is
 *   quoted in the note and never resolved. It is not a `citation` node: the
 *   L1 ontology licenses no edge from a recommendation or a section to a
 *   citation, and an edgeless citation would be a node nothing can reach.
 *
 * Every recommendation is `inferred` — SCOPE: *"extraction from prose is
 * inferred at minimum, never derived"* — so each carries a note and evidence.
 *
 * ## T3 fidelity is a person's, and this tool never passes it
 *
 * T2, the graph's shape, was smart-kg's `tools/validate.mjs`; smart-kg is
 * deprecated (owner, 2026-10-16) and nothing here runs it any more. T3 — does each node say what its source says — is left to a person (bean
 * `8pzh`). The coverage record therefore carries `fidelity.t3: "pending-person"`
 * and the number of inferred nodes awaiting that review, printed with every
 * run. The type admits no other value, so no code path here can report T3 as
 * passed; a person's verdict is recorded elsewhere, never by this extractor.
 *
 * ## Where the document goes
 *
 * BESIDE the entry, as `smart-kg-l1.json` (owner default, bean `8pzh`, after
 * the storage question went unanswered). smart-kg `STORAGE.md` would publish
 * an A-Box with its source and not commit it; here the source IS the entry, so
 * the document travels with it and `--check` is what keeps the copy honest.
 * Nothing is written into smart-kg.
 *
 * `.json`, as smart-kg's own extractors and `validate.mjs` name a graph
 * document, and NOT `.jsonld`: its `@context` is smart-kg's, by URL, and this
 * repository's JSON-LD corpus gates (`check-context-emission`) require every
 * `.jsonld` context to be readable offline. Holding smart-kg's context here
 * to satisfy them would be the copy bean `wg7r` refuses. Measured: as
 * `.jsonld` the document failed that gate with one unresolved context.
 *
 * ## The vocabulary is smart-base's own
 *
 * Every class emitted must be in smart-base's KG class lists ({@link kgClasses});
 * the CLI refuses to write otherwise. The lists hold class ids only.
 *
 *   bun run smart-base/L1/scripts/extract-smart-kg-l1.ts --entry smart-base/library/<id>
 *   bun run smart-base/L1/scripts/extract-smart-kg-l1.ts --check [--entry <dir>]
 *   bun run smart-base/L1/scripts/extract-smart-kg-l1.ts --all    # rewrite every entry --check examines
 *
 * @module smart-base/L1/scripts/extract-smart-kg-l1
 * @covers library
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { directoriesForGraph, repoRootFor } from "../../platform/index.js";
import { pagesOf, readStructure, STRUCTURE_FILENAME, type BaseSection, type BaseStructure } from "../../platform/index.js";
import { kgClasses } from "../../scripts/kg-classes.ts";

const HERE = resolve(import.meta.dir, "..", "..");
const REPO = repoRootFor(HERE);

/** The file written beside each entry; why `.json` is in the module comment. */
export const L1_DOCUMENT_FILENAME = "smart-kg-l1.json";

/** smart-kg's L1 context; `validate.mjs` reads the layer from this URL's file name. */
export const L1_CONTEXT = "http://smart.who.int/kg/l1.context.jsonld";

/**
 * `schemaVersion` of smart-kg's `ontology/l1/l1.json` when the class lists
 * were taken. The code lists do not carry it, so it is stated here.
 */
export const L1_ONTOLOGY_VERSION = "1.0";

/** The class system L1 class ids are codes in (`code-lists/sgkg-l1-classes.json`). */
const L1_SYSTEM = "sgkg-l1";

const SKILL = "smart-base/extract-smart-kg-l1";

/** A labelled block running longer than this with no terminator is refused, not cut. */
export const MAX_STATEMENT_LINES = 25;

// ── The document's shape: smart-kg shapes/recommendation-graph.schema.json ──

type Derivation = "derived" | "inferred" | "decided";

interface Evidence {
  location: string;
  quote?: string;
}

interface NodeBase {
  id: string;
  label: string;
  derivation: Derivation;
  note?: string;
  evidence?: Evidence;
  skill: string;
}

/** Only the properties the L1 class declares, and only those this reads. */
export interface PublicationNode extends NodeBase {
  type: "publication";
  properties: { title?: string; identifier?: string; sha256?: string };
}
export interface SectionNode extends NodeBase {
  type: "publication-section";
  properties: { heading: string; number?: string; pageRange?: string };
}
export interface RecommendationNode extends NodeBase {
  type: "recommendation";
  properties: { identifier: string; statement: string; strength?: Strength; certainty?: Certainty };
}
export type L1Node = PublicationNode | SectionNode | RecommendationNode;

export interface L1Edge {
  type: "Statement";
  predicate: "contains";
  source: string;
  target: string;
  derivation: Derivation;
  skill: string;
}

export interface ProvenanceSource {
  path: string;
  sha256: string;
  note?: string;
}

export interface L1Document {
  "@context": string;
  id: string;
  type: "Entity";
  ontologyVersion: string;
  generatedAt: string;
  wasDerivedFrom: ProvenanceSource[];
  nodes: L1Node[];
  edges: L1Edge[];
}

/** GRADE values, as the L1 class's propertyNote spells them. */
export type Strength = "strong" | "conditional";
export type Certainty = "high" | "moderate" | "low" | "very-low";

// ── Identity — mirrors smart-kg tools/kgid.mjs (`sha256`, `shortHash`) ──────

const sha256 = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");
const shortHash = (s: string): string => sha256(Buffer.from(s)).slice(0, 12);

/**
 * A publication's IRI. The ISBN when the text states one unambiguously — so
 * two graphs that cite the same book meet at one node — and otherwise the
 * source file's own sha256, which the ingest recorded and is exact.
 */
export function publicationId(isbn: string | undefined, fileSha256: string): string {
  return isbn ? `urn:isbn:${isbn.replace(/[^0-9]/g, "")}` : `urn:sha256:${fileSha256}`;
}

// ── The entry, as read ──────────────────────────────────────────────────────

/** One section's text file, with the line its body starts on. */
export interface SectionText {
  /** Repo-relative path of `sections/<id>.md`. */
  path: string;
  /** The whole file, front matter included, so line numbers are the file's own. */
  text: string;
}

export interface LibraryEntry {
  /** Repo-relative path of the entry directory. */
  path: string;
  structure: BaseStructure;
  structureSha256: string;
  /** By section id. A section with no text file is absent, and counted. */
  texts: Map<string, SectionText>;
}

/** Read an entry from disk. `{ reason }` for anything that is not an entry. */
export function readEntry(dir: string, repoRoot = REPO): LibraryEntry | { reason: string } {
  const structure = readStructure(dir);
  if ("reason" in structure) return structure;
  const rel = (p: string): string => relative(repoRoot, p).split("\\").join("/");
  const texts = new Map<string, SectionText>();
  for (const s of structure.sections) {
    const p = join(dir, "sections", `${s.id}.md`);
    if (existsSync(p)) texts.set(s.id, { path: rel(p), text: readFileSync(p, "utf-8") });
  }
  return {
    path: rel(dir),
    structure,
    structureSha256: sha256(readFileSync(join(dir, STRUCTURE_FILENAME))),
    texts,
  };
}

// ── Reading recommendations ─────────────────────────────────────────────────

const LABEL = /^\s*Recommendation\s+(\d+[A-Za-z0-9.]*)\s*:\s*(\S.*)$/;
const PARENTHESISED = /^\s*\(.*\)\s*$/;
const SOURCE_LINE = /^\s*Source:\s*(\S.*)$/;
/** Prose that recommends without a printed label — counted, never emitted. */
const UNLABELLED = /\bWHO recommends\b/;

/** One GRADE phrase found in a block, verbatim, and what it reads as. */
interface GradeRead<T> {
  value: T;
  phrase: string;
}

const STRENGTH_PATTERNS: RegExp[] = [
  /\b(strong|conditional)\s+recommendation\b/i,
  /\bstrength of (?:the )?recommendation\s*[:\-–]\s*(strong|conditional)\b/i,
];
const CERTAINTY_PATTERNS: RegExp[] = [
  /\b(high|moderate|low|very low)[- ]certainty(?: of)?(?: the)? evidence\b/i,
  /\bcertainty of (?:the )?evidence\s*[:\-–]\s*(high|moderate|low|very low)\b/i,
];

/** The GRADE strength stated in `text`, with the phrase it was read from. */
export function readStrength(text: string): GradeRead<Strength> | undefined {
  for (const re of STRENGTH_PATTERNS) {
    const m = re.exec(text);
    const v = m?.[1]?.toLowerCase();
    if (m && (v === "strong" || v === "conditional")) return { value: v, phrase: m[0] };
  }
  return undefined;
}

/** The GRADE certainty stated in `text`, with the phrase it was read from. */
export function readCertainty(text: string): GradeRead<Certainty> | undefined {
  for (const re of CERTAINTY_PATTERNS) {
    const m = re.exec(text);
    const v = m?.[1]?.toLowerCase().replace(/\s+/g, "-");
    if (m && (v === "high" || v === "moderate" || v === "low" || v === "very-low")) return { value: v, phrase: m[0] };
  }
  return undefined;
}

/** A labelled recommendation block, as found in one section's text. */
export interface FoundRecommendation {
  identifier: string;
  statement: string;
  /** The wholly parenthesised line that closed the block, if one did. */
  qualifier?: string;
  /** What a `Source:` line under the block says, verbatim. */
  attribution?: string;
  /** One-based line of the label in the section file. */
  line: number;
  /** The statement block and its qualifier, line breaks joined — what `evidence.quote` holds. */
  quote: string;
}

/** A label whose block never ended, so no statement could be bounded. */
export interface Refused {
  identifier: string;
  line: number;
  reason: string;
}

const joinLines = (lines: string[]): string => lines.map((l) => l.trim()).filter((l) => l !== "").join(" ");

/** Every labelled recommendation in one section's text, and every label refused. */
export function findRecommendations(text: string): { found: FoundRecommendation[]; refused: Refused[]; unlabelled: number } {
  const lines = text.split("\n");
  const found: FoundRecommendation[] = [];
  const refused: Refused[] = [];
  let unlabelled = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = LABEL.exec(lines[i]!);
    if (!m) {
      if (UNLABELLED.test(lines[i]!)) unlabelled++;
      continue;
    }
    const identifier = m[1]!;
    const block = [m[2]!];
    let j = i + 1;
    let terminated = false;
    for (; j < lines.length && j <= i + MAX_STATEMENT_LINES; j++) {
      const l = lines[j]!;
      if (l.trim() === "" || PARENTHESISED.test(l) || SOURCE_LINE.test(l) || LABEL.test(l)) {
        terminated = true;
        break;
      }
      block.push(l);
    }
    if (!terminated && j < lines.length) {
      refused.push({ identifier, line: i + 1, reason: `no terminator within ${MAX_STATEMENT_LINES} lines of the label, so the statement could not be bounded` });
      continue;
    }
    const statement = joinLines(block);
    let qualifier: string | undefined;
    if (j < lines.length && PARENTHESISED.test(lines[j]!)) {
      qualifier = lines[j]!.trim();
      j++;
    }
    const src = j < lines.length ? SOURCE_LINE.exec(lines[j]!) : null;
    found.push({
      identifier,
      statement,
      ...(qualifier ? { qualifier } : {}),
      ...(src ? { attribution: src[1]!.trim() } : {}),
      line: i + 1,
      quote: qualifier ? `${statement} ${qualifier}` : statement,
    });
    i = j - 1;
  }
  return { found, refused, unlabelled };
}

/**
 * The ISBN the text states for THIS file. The one labelled as the electronic
 * version when the front matter lists several, since the ingested file is the
 * PDF; the only one when there is exactly one; otherwise none, and why.
 */
export function readIsbn(texts: Iterable<SectionText>): { isbn?: string; evidence?: Evidence; reason?: string } {
  const seen = new Map<string, Evidence>();
  let electronic: { isbn: string; evidence: Evidence } | undefined;
  for (const t of texts) {
    t.text.split("\n").forEach((line, i) => {
      const m = /\bISBN\s+(97[89](?:[- ]?\d){10})\b/.exec(line);
      if (!m) return;
      const isbn = m[1]!;
      const ev = { location: `${t.path}:${i + 1}`, quote: line.trim() };
      if (!seen.has(isbn)) seen.set(isbn, ev);
      if (!electronic && /electronic/i.test(line)) electronic = { isbn, evidence: ev };
    });
  }
  if (electronic) return electronic;
  if (seen.size === 1) {
    const [[isbn, evidence]] = [...seen];
    return { isbn, evidence };
  }
  return { reason: seen.size === 0 ? "the text states no ISBN" : `the text states ${seen.size} ISBNs and labels none as the electronic version` };
}

// ── The document ────────────────────────────────────────────────────────────

export interface Coverage {
  sections: number;
  sectionsWithoutText: number;
  recommendations: number;
  withStrength: number;
  withCertainty: number;
  refused: Array<Refused & { section: string }>;
  /** `WHO recommends` in prose outside any labelled block: paraphrase, so not emitted. */
  unlabelledMentions: number;
  /** T3 fidelity: always pending a person, for every inferred node (see the module doc). */
  fidelity: { t3: "pending-person"; inferredNodes: number };
}

const pageRangeOf = (s: BaseSection): string | undefined => {
  const p = pagesOf(s);
  return p ? (p.start === p.end ? `${p.start}` : `${p.start}-${p.end}`) : undefined;
};

/** Why a GRADE field is unset, quoting what the block said instead. */
function omissionNote(field: string, r: FoundRecommendation): string {
  return r.qualifier
    ? `${field} is not stated in GRADE terms in the recommendation block — the block's own qualifier reads "${r.qualifier}" — so it is left unset rather than mapped.`
    : `${field} is not stated in the recommendation block, so it is left unset.`;
}

/** The L1 graph document for one entry. Pure: `generatedAt` is the caller's. */
export function l1Document(entry: LibraryEntry, generatedAt: string): { doc: L1Document; coverage: Coverage } {
  const { structure } = entry;
  const fileSha = structure.raw.source.sha256;
  const isbn = readIsbn(entry.texts.values());
  const pubId = publicationId(isbn.isbn, fileSha);

  const publication: PublicationNode = {
    id: pubId,
    type: "publication",
    label: structure.title ?? structure.doc_id,
    properties: {
      ...(structure.title ? { title: structure.title } : {}),
      ...(isbn.isbn ? { identifier: `ISBN ${isbn.isbn}` } : {}),
      sha256: fileSha,
    },
    derivation: "derived",
    ...(isbn.evidence ? { evidence: isbn.evidence } : { note: `No identifier: ${isbn.reason}.` }),
    skill: SKILL,
  };
  const nodes: L1Node[] = [publication];
  const edges: L1Edge[] = [];
  const coverage: Coverage = {
    sections: structure.sections.length,
    sectionsWithoutText: 0,
    recommendations: 0,
    withStrength: 0,
    withCertainty: 0,
    refused: [],
    unlabelledMentions: 0,
    fidelity: { t3: "pending-person", inferredNodes: 0 },
  };
  const seen = new Set<string>();

  for (const s of structure.sections) {
    const t = entry.texts.get(s.id);
    if (!t) {
      coverage.sectionsWithoutText++;
      continue;
    }
    const { found, refused, unlabelled } = findRecommendations(t.text);
    coverage.unlabelledMentions += unlabelled;
    coverage.refused.push(...refused.map((r) => ({ ...r, section: s.id })));
    // A section is emitted only when it holds a recommendation: the graph is
    // for traversing to recommendations, and a section with none has no reader.
    if (found.length === 0) continue;
    const pages = pageRangeOf(s);
    const section: SectionNode = {
      id: `${pubId}#section-${s.id}`,
      type: "publication-section",
      label: s.title,
      properties: { heading: s.title, ...(s.number ? { number: s.number } : {}), ...(pages ? { pageRange: pages } : {}) },
      derivation: "derived",
      skill: SKILL,
    };
    nodes.push(section);
    edges.push({ type: "Statement", predicate: "contains", source: pubId, target: section.id, derivation: "derived", skill: SKILL });

    for (const r of found) {
      const id = `${pubId}#recommendation-${shortHash(r.statement)}`;
      // The same statement printed twice is one recommendation, at its first place.
      if (seen.has(id)) continue;
      seen.add(id);
      const strength = readStrength(r.quote);
      const certainty = readCertainty(r.quote);
      const where = pages ? ` (PDF pp. ${pages}, section "${s.title}"; the page within the section is not recorded by the ingest)` : "";
      nodes.push({
        id,
        type: "recommendation",
        label: `Recommendation ${r.identifier}`,
        properties: {
          identifier: r.identifier,
          statement: r.statement,
          ...(strength ? { strength: strength.value } : {}),
          ...(certainty ? { certainty: certainty.value } : {}),
        },
        derivation: "inferred",
        note: [
          `Located by its printed label "Recommendation ${r.identifier}:"; the statement is the text after the label up to the first terminator, with line breaks joined by single spaces and nothing else changed.`,
          strength ? `Strength read from "${strength.phrase}".` : omissionNote("Strength", r),
          certainty ? `Certainty read from "${certainty.phrase}".` : omissionNote("Certainty", r),
          ...(r.attribution ? [`Attributed in the source to "Source: ${r.attribution}" — left unresolved; the L1 ontology licenses no edge from a recommendation to a citation.`] : []),
        ].join(" "),
        evidence: { location: `${t.path}:${r.line}${where}`, quote: r.quote },
        skill: SKILL,
      });
      edges.push({ type: "Statement", predicate: "contains", source: section.id, target: id, derivation: "derived", skill: SKILL });
      coverage.recommendations++;
      if (strength) coverage.withStrength++;
      if (certainty) coverage.withCertainty++;
    }
  }

  // The section texts are hashed as a unit, `sha256sum`-format in structure
  // order, so editing any one of them makes the document stale.
  const listing = [...entry.texts.values()].map((t) => `${sha256(t.text)}  ${t.path}\n`).join("");
  const doc: L1Document = {
    "@context": L1_CONTEXT,
    id: `${pubId}#kg-l1`,
    type: "Entity",
    ontologyVersion: L1_ONTOLOGY_VERSION,
    generatedAt,
    wasDerivedFrom: [
      {
        path: structure.raw.source.file,
        sha256: fileSha,
        note: "The source file as hashed at ingest and recorded in the entry's structure.json; not re-read here.",
      },
      { path: `${entry.path}/${STRUCTURE_FILENAME}`, sha256: entry.structureSha256 },
      {
        path: `${entry.path}/sections/`,
        sha256: sha256(listing),
        note: `The ${entry.texts.size} section text(s) read, hashed as a sha256sum listing (<hex>  <path>) in structure order.`,
      },
    ],
    nodes,
    edges,
  };
  coverage.fidelity.inferredNodes = nodes.filter((n) => n.derivation === "inferred").length;
  return { doc, coverage };
}

/** Classes the document uses that the KG class lists do not hold. */
export function unpinnedClasses(doc: L1Document, pinned: Set<string>): string[] {
  return [...new Set(doc.nodes.map((n) => n.type))].filter((c) => !pinned.has(`${L1_SYSTEM}#${c}`));
}

export const serialise = (doc: L1Document): string => `${JSON.stringify(doc, null, 2)}\n`;

/**
 * Whether `existing` is `doc` up to its `generatedAt`. The timestamp is the
 * one field a regeneration must change, so comparing it would make every
 * document stale; every other field, the source hashes included, must agree.
 */
export function isCurrent(existing: string | undefined, doc: L1Document): boolean {
  if (existing === undefined) return false;
  let prior: unknown;
  try {
    prior = JSON.parse(existing);
  } catch {
    return false;
  }
  if (typeof prior !== "object" || prior === null || !("generatedAt" in prior) || typeof prior.generatedAt !== "string") return false;
  return existing === serialise({ ...doc, generatedAt: prior.generatedAt });
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function report(path: string, c: Coverage): void {
  console.log(
    `  ${path}: ${c.recommendations} recommendation(s) in ${c.sections} section(s)` +
      (c.sectionsWithoutText ? ` (${c.sectionsWithoutText} without a text file)` : "") +
      `; GRADE strength stated for ${c.withStrength}, certainty for ${c.withCertainty}`,
  );
  for (const r of c.refused) console.log(`    refused: Recommendation ${r.identifier} at ${r.section}:${r.line} — ${r.reason}`);
  console.log(`    T3 fidelity: PENDING a person for ${c.fidelity.inferredNodes} inferred node(s) — never passed by this tool`);
  if (c.unlabelledMentions) console.log(`    not extracted: ${c.unlabelledMentions} "WHO recommends" mention(s) in prose outside a labelled block — paraphrase, not a statement`);
}

/** Entries of this layer's library graph that already carry a document. */
function entriesWithDocument(): string[] {
  const out: string[] = [];
  for (const lib of directoriesForGraph(HERE, "library")) {
    if (!existsSync(lib)) continue;
    for (const d of readdirSync(lib, { withFileTypes: true })) {
      if (d.isDirectory() && existsSync(join(lib, d.name, L1_DOCUMENT_FILENAME))) out.push(join(lib, d.name));
    }
  }
  return out.sort();
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const check = args.includes("--check");
  const entryArg = opt("--entry");
  // `--all` is the writer `--check` pairs with (bean `wczm` item 1): the same
  // entries, rewritten. Without it the only writer took one `--entry` at a
  // time, so `regen` had no command that repairs what the gate reports, and a
  // merge train went red on it after `regen` called the tree current.
  if (!entryArg && !check && !args.includes("--all")) {
    console.error("usage: extract-smart-kg-l1.ts --entry <library entry> | --all | --check [--entry <library entry>]");
    process.exit(2);
  }
  const dirs = entryArg ? [resolve(entryArg)] : entriesWithDocument();
  if (dirs.length === 0) {
    console.log("✓ no library entry of this instance carries a smart-kg L1 document");
    process.exit(0);
  }
  const pinned = kgClasses();
  let bad = 0;
  for (const dir of dirs) {
    const entry = readEntry(dir);
    const target = join(dir, L1_DOCUMENT_FILENAME);
    const shown = relative(process.cwd(), target);
    if ("reason" in entry) {
      console.error(`✗ ${relative(process.cwd(), dir)}: could not read the entry — ${entry.reason}`);
      bad++;
      continue;
    }
    const { doc, coverage } = l1Document(entry, new Date().toISOString().replace(/\.\d+Z$/, "Z"));
    const unpinned = unpinnedClasses(doc, pinned);
    if (unpinned.length) {
      console.error(`✗ ${shown}: class(es) ${unpinned.join(", ")} are not in the KG class lists`);
      bad++;
      continue;
    }
    const existing = existsSync(target) ? readFileSync(target, "utf-8") : undefined;
    const current = isCurrent(existing, doc);
    if (check) {
      if (!current) {
        console.log(`✗ ${shown} is stale — run with --entry ${relative(process.cwd(), dir)}`);
        bad++;
      } else console.log(`✓ ${shown} current`);
      continue;
    }
    if (current) console.log(`${shown} current`);
    else {
      writeFileSync(target, serialise(doc));
      console.log(`${shown} written`);
    }
    report(entry.path, coverage);
  }
  process.exit(bad === 0 ? 0 : 1);
}
