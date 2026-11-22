#!/usr/bin/env bun
/**
 * An L1 library entry → its smart-kg L1 3.0 layout graph: the publication,
 * its sections and its printed elements, each one a SPECIALISATION of the
 * library node it is read from. Bean `mffs`.
 *
 * Owner, 2026-10-07: *"the publication and publication section should be
 * specialized classes of L1 document ingestion. the document ingestor should
 * check if the document being ingested is L1 then do the library but also do
 * the L1 schema KG … the upstream architecture could change and do
 * chapters/sections or anything and L1 will utilize those sectioning
 * strategies"*; and *"Library is upstream to L1. L1 can point upstream but not
 * downstream"*.
 *
 * So this step reads the library entry and never re-reads the PDF. Whatever
 * sectioning the ingest produced — an outline, the consensus contents (issue
 * #2302), pages — is the sectioning L1 gets, with the ingest's confidence
 * carried into each node's note.
 *
 * ## The layer and the schema
 *
 * litlfred/smart-base `kg/`: L1 3.0 (WorldHealthOrganization/smart-kg main
 * `3f5e477`) plus the `l1-library` layer, which adds the `library-node` class
 * and `specializationOf` (PROV). The document names `l1-library.context.jsonld`
 * so smart-base's validator checks it against both layers:
 *
 *   publication          specializationOf  library-node  (the entry's manifest)
 *   publication-section  specializationOf  library-node  (the entry's section)
 *   publication-element  specializationOf  library-node  (the block it is cut from)
 *   publication / publication-section  contains  publication-section / publication-element
 *
 * Every edge points from L1 to the library or within L1. Nothing in the
 * library is written: it is upstream.
 *
 * ## Only for L1, and only when that is known
 *
 * {@link decideL1} reads the intake's classifications and the Dublin Core
 * record. A document that is not L1 gets no graph and the run says why; an
 * undetermined one gets no graph and the run says what to record.
 *
 *   bun run smart-base/L1/scripts/l1-specialise.ts --entry <library entry> [--uploads <dir>] [--check] [--validate-zod <smart-base checkout>]
 *
 * Exit: 0 written, current, or not L1; 1 stale or invalid; 2 usage, unreadable, or undetermined.
 *
 * @module smart-base/L1/scripts/l1-specialise
 * @covers library
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { requireHarnessRoot } from "../../../cat-harness-tools/schemas/harness-root.ts";
import { instanceNamespaceOf } from "../../../cat-harness-tools/schemas/kg/namespaces.ts";
import { DublinCoreRecordSchema, handleFromUrl, ownDeclaredDirectories, readStructure, STRUCTURE_FILENAME, type DublinCoreRecord } from "../../platform/index.js";
import { L1_LIBRARY_CONTEXT, L1_V3_ONTOLOGY_VERSION, publicationElementId, publicationId, sectionId, sha256, slug, type Identifier } from "./l1-kgid.ts";
import { decideL1, type IntakeRecord, type L1Decision } from "./l1-membership.ts";

export const L1_LIBRARY_FILENAME = "smart-kg-l1-library.jsonld";
const SKILL = "smart-base/dak-l1-library";
/**
 * cat-harness's namespace, `<iriBase>v<major>/ns/`, derived from its declaration's
 * `iriBase` and `version` (bootstrap-tools `release-iri.ts`). Not a literal: a
 * hand-written `0.1.0/ns/` went stale, and every IRI minted under it had to be rewritten by hand.
 */
export const CAT_HARNESS_NS = instanceNamespaceOf(JSON.parse(readFileSync(join(requireHarnessRoot(), "cat-harness.json"), "utf-8")));
const DOCO_NS = "http://purl.org/spar/doco/";
/** Element types L1 3.0 defines that the library does not extract yet — reported, never guessed. */
export const NOT_EXTRACTED = ["table-row", "footnote", "chart", "image", "flowchart", "list"] as const;

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
}

// ── What the repository holds about an entry ────────────────────────────────

export interface Held {
  intake: IntakeRecord;
  /** Repo-relative, as written into the document; `abs` is what is read. */
  intakePath: string;
  record?: DublinCoreRecord;
  recordPath?: string;
  pdfSha256?: string;
  abs: { intake: string; record?: string };
}

/**
 * Every intake under the checkout's `uploads` graph, with its Dublin Core record.
 *
 * The declared directory when the checkout declares one; otherwise the
 * conventional `uploads/` at its root — an undeclared repository (a DAK's IG
 * repository, before it is a layer) "falls back to today's conventions"
 * (AGENTS.md). `uploadsDir` overrides both.
 */
export function heldIntakes(repo: string, uploadsDir?: string): Held[] {
  // declared-path-literal: the convention fallback for a checkout that declares no uploads graph (a DAK's IG repository), tried only after its declaration; it names that checkout's uploads/, not folio-assistant's
  const uploads = uploadsDir ?? ownDeclaredDirectories(repo, "uploads")[0] ?? join(repo, "uploads");
  if (!existsSync(uploads)) return [];
  const out: Held[] = [];
  for (const d of readdirSync(uploads, { withFileTypes: true })) {
    const intakePath = join(uploads, d.name, "intake.json");
    if (!d.isDirectory() || !existsSync(intakePath)) continue;
    const intake = JSON.parse(readFileSync(intakePath, "utf-8")) as IntakeRecord;
    if (!Array.isArray(intake.files)) throw new Error(`${intakePath}: no files[] — not a folio-intake/v1 record`);
    const recordPath = intake.record ? join(uploads, d.name, intake.record) : undefined;
    const record = recordPath && existsSync(recordPath) ? DublinCoreRecordSchema.parse(JSON.parse(readFileSync(recordPath, "utf-8"))) : undefined;
    const pdfSha256 = intake.files.find((f) => f.role === "original-bitstream")?.sha256 ?? undefined;
    out.push({ intake, intakePath: relative(repo, intakePath), record, recordPath: recordPath ? relative(repo, recordPath) : undefined, pdfSha256, abs: { intake: intakePath, record: recordPath } });
  }
  return out;
}

export const dc = (rec: DublinCoreRecord, element: string, qualifier?: string): string[] =>
  rec.fields.filter((f) => f.element === element && f.qualifier === qualifier).flatMap((f) => f.values.map((v) => v.value));

/** L1 identifiers from a repository record: ISBNs as printed (electronic first, as IRIS lists them), the handle, then any other page URL. */
export function identifiersOf(rec: DublinCoreRecord): Identifier[] {
  const isbns = dc(rec, "identifier", "isbn").map((v) => ({ type: "isbn", value: v.replace(/\s*\(.*\)\s*$/, "").trim() }));
  const handles = dc(rec, "identifier", "uri")
    .map((u) => handleFromUrl(u))
    .filter((h): h is string => !!h)
    .map((value) => ({ type: "iris-handle", value }));
  // A record with neither (a who.int item page) is identified by its page: `url`
  // comes last in smart-kg's IRI order, so it never displaces an ISBN or a handle.
  const urls = dc(rec, "identifier", "uri")
    .filter((u) => !handleFromUrl(u))
    .map((value) => ({ type: "url", value }));
  return [...isbns, ...handles, ...urls];
}

/** smart-kg publication properties from a Dublin Core record. Only fields the record states. */
export function publicationProperties(rec: DublinCoreRecord, pdfSha256: string | undefined, publicationType: string | undefined): Record<string, unknown> {
  const props: Record<string, unknown> = {
    title: dc(rec, "title")[0],
    creator: [...dc(rec, "contributor", "author"), ...dc(rec, "creator")],
    publisher: dc(rec, "publisher")[0],
    issued: dc(rec, "date", "issued")[0],
    identifiers: identifiersOf(rec),
    language: dc(rec, "language", "iso").join(", ") || undefined,
    rights: dc(rec, "rights")[0],
    url: dc(rec, "identifier", "uri")[0],
    sha256: pdfSha256,
    publicationType,
  };
  for (const k of Object.keys(props)) if (props[k] === undefined || (Array.isArray(props[k]) && (props[k] as unknown[]).length === 0)) delete props[k];
  return props;
}

// ── The library's own IRIs ──────────────────────────────────────────────────

interface Manifest {
  "@context"?: unknown;
  "@id": string;
  contains?: string[];
}

/** Resolve a library node's id the way JSON-LD would: against the manifest context's `@base`. */
function resolver(manifest: Manifest): (id: string) => string {
  const ctx = Array.isArray(manifest["@context"]) ? manifest["@context"] : [manifest["@context"]];
  const base = ctx.map((c) => (c && typeof c === "object" ? (c as { "@base"?: string })["@base"] : undefined)).find(Boolean);
  return (id) => (/^[a-z]+:/i.test(id) || !base ? id : new URL(id, base).href);
}

// ── Sections ────────────────────────────────────────────────────────────────

interface TocEntry {
  level: number;
  title: string;
  page?: number;
  number?: string;
  confidence?: number;
  evidence?: string[];
  source?: string;
}
interface RawSection {
  id: string;
  number?: string | null;
  title: string;
  level: number;
  page_start: number;
  page_end: number;
  label_start?: string | null;
  label_end?: string | null;
}
interface RawFigure {
  kind: string;
  number: string;
  title: string;
  page: number;
  confidence?: number;
  evidence?: string[];
  page_label?: string;
}
interface RawStructure {
  toc_source?: string;
  granularity?: string;
  toc?: TocEntry[];
  sections: RawSection[];
  figures?: RawFigure[];
  source: { file: string; sha256: string };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const range = (a?: string | number | null, b?: string | number | null) => (a == null ? undefined : b == null || String(a) === String(b) ? String(a) : `${a}-${b}`);

/**
 * The number as PRINTED in the contents: the ingest records "1" for a line that
 * reads "Annex 1. Designing …", so the word before the number is recovered
 * from the contents line that carries the title. Issue #2302 test case.
 */
export function printedNumber(number: string, title: string, frontMatter: string): string {
  const t = norm(title).slice(0, 40);
  for (const line of frontMatter.split("\n")) {
    const m = /^\s*((?:Annex|Appendix|Chapter|Part|Section)\s+[A-Z0-9]+(?:\.[A-Z0-9]+)*)\.?\s+(.*)$/i.exec(line);
    if (m && m[1]!.endsWith(number) && norm(m[2]!).startsWith(t)) return m[1]!;
  }
  return number;
}

// ── The document ────────────────────────────────────────────────────────────

export interface Input {
  entryPath: string;
  structure: RawStructure;
  structureSha256: string;
  manifest: Manifest;
  manifestSha256: string;
  frontMatter: string;
  held: Held;
  decision: L1Decision;
  generatedAt: string;
}

export function l1LibraryDocument(i: Input): { doc: Doc; report: string[] } {
  const report: string[] = [];
  const { structure: st, held, decision } = i;
  const rec = held.record!;
  const pub = publicationId(identifiersOf(rec));
  const docId = i.entryPath.split("/").pop()!;
  const abs = resolver(i.manifest);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const edge = (predicate: string, source: string, target: string, derivation: Derivation, note?: string, evidence?: Evidence) =>
    edges.push({ type: "Statement", predicate, source, target, derivation, ...(note ? { note } : {}), ...(evidence ? { evidence } : {}), skill: SKILL });
  const libNode = (iri: string, cls: string, label: string, pageRange?: string) =>
    nodes.push({ id: iri, type: "library-node", label, properties: { iri, libraryClass: cls, entry: docId, ...(pageRange ? { pageRange } : {}) }, derivation: "derived", skill: SKILL });

  // Publication — decided when a person declared it, else inferred (its minimum).
  const by = decision.decidedBy!;
  const declared = decision.derivation === "decided";
  nodes.push({
    id: pub,
    type: "publication",
    label: String(dc(rec, "title")[0] ?? docId),
    properties: publicationProperties(rec, held.pdfSha256, decision.publicationType),
    derivation: declared ? "decided" : "inferred",
    note:
      `L1 because ${by.source} (${by.basis}). Properties are the repository's Dublin Core record (${held.recordPath}); sha256 pins the PDF ingested. ` +
      `The library does not yet extract these element types, so none is emitted: ${NOT_EXTRACTED.join(", ")}.` +
      (decision.disagreements.length ? ` Disagreeing records: ${decision.disagreements.join(" | ")}.` : ""),
    evidence: { location: held.intakePath, quote: by.basis, ...(declared ? { by: by.by ?? "unknown", at: (by.at ?? "").slice(0, 10) } : {}) },
    skill: SKILL,
  });
  const manifestIri = abs(i.manifest["@id"]);
  libNode(manifestIri, `${CAT_HARNESS_NS}SourceDocument`, `Library entry ${docId}`);
  edge("specializationOf", pub, manifestIri, "derived");

  // Sections — every one the library made, the front matter excepted.
  const contains = i.manifest.contains ?? [];
  const toc = st.toc ?? [];
  const body = st.sections.filter((s) => s.id !== "sec-front-matter");
  if (body.length < st.sections.length) report.push("front matter is a library section but not a publication-section: not emitted");
  const seen = new Set<string>();
  const ids = new Map<string, string>();
  const stack: { level: number; id: string }[] = [];
  const ordinals = new Map<string, number>();
  for (const s of body) {
    const t = toc.find((e) => norm(e.title) === norm(s.title) && (s.number == null || e.number === s.number));
    let key = s.number ? printedNumber(s.number, s.title, i.frontMatter) : slug(s.title);
    // A number printed twice (chapter 1 and annex 1 when the prefix is lost)
    // first takes its title; a heading printed many times ("Analysis" under
    // every chapter) then takes its position among its namesakes, in order.
    if (seen.has(key) && s.number) key = `${key}-${slug(s.title)}`;
    if (seen.has(key)) {
      let n = 2;
      while (seen.has(`${key}-${n}`)) n++;
      key = `${key}-${n}`;
    }
    seen.add(key);
    const id = sectionId(pub, key);
    ids.set(s.id, id);
    while (stack.length && stack[stack.length - 1]!.level >= s.level) stack.pop();
    const parent = stack.length ? stack[stack.length - 1]!.id : pub;
    stack.push({ level: s.level, id });
    const ordinal = (ordinals.get(parent) ?? 0) + 1;
    ordinals.set(parent, ordinal);
    const printed = range(s.label_start, s.label_end);
    const how =
      st.toc_source === "outline"
        ? "read from the PDF's embedded outline"
        : st.toc_source === "inferred"
          ? `from the ingest's inferred contents${t ? ` (confidence ${t.confidence}, evidence ${(t.evidence ?? []).join("+")})` : ""}`
          : `a ${st.granularity ?? "structural"} section of the library entry`;
    nodes.push({
      id,
      type: "publication-section",
      label: key === slug(s.title) ? s.title : `${key} ${s.title}`,
      properties: { heading: s.title, ...(s.number ? { number: key } : {}), pageRange: printed ?? range(s.page_start, s.page_end)!, ordinal },
      derivation: "inferred",
      note: `The library section ${s.id}, ${how}. pageRange is the printed page labels${printed ? "" : " (none printed, so physical pages)"}; physical ${range(s.page_start, s.page_end)}.${key !== (s.number ?? slug(s.title)) && s.number ? ` The ingest recorded number "${s.number}"; "${key}" is the contents line's.` : ""}`,
      evidence: { location: `${i.entryPath}/structure.json`, quote: s.title },
      skill: SKILL,
    });
    edge("contains", parent, id, "inferred", "Nesting follows the library section levels.", { location: `${i.entryPath}/structure.json`, quote: s.title });
    const libId = contains.find((c) => s.id.startsWith(c.split("/").pop()!));
    if (!libId) {
      report.push(`${s.id}: no node for it in the manifest's contains — no specializationOf`);
      continue;
    }
    libNode(abs(libId), `${DOCO_NS}Section`, `Library section ${s.id}`, range(s.page_start, s.page_end));
    edge("specializationOf", id, abs(libId), "derived");
  }
  const sectioned = new Set(body.map((s) => norm(s.title)));
  for (const e of toc) if (!sectioned.has(norm(e.title)) && e.page != null) report.push(`contents entry "${e.title}" (p. ${e.page}) has no library section — L1 inherits none`);

  // Elements — what the ingest's figure reader found.
  const holder = (page: number) =>
    body
      .filter((s) => s.page_start <= page && page <= s.page_end)
      .sort((a, b) => b.level - a.level || b.page_start - a.page_start)[0];
  const blockOf = (s: RawSection) => abs(`library/${docId}/blocks/prose-${s.id.split("-").slice(0, 2).join("-")}`);
  const elOrd = new Map<string, number>();
  for (const f of st.figures ?? []) {
    const label = `${f.kind[0]!.toUpperCase()}${f.kind.slice(1)} ${f.number}`;
    const id = publicationElementId(pub, label);
    const s = holder(f.page);
    const parent = s ? ids.get(s.id)! : pub;
    const ordinal = (elOrd.get(parent) ?? 0) + 1;
    elOrd.set(parent, ordinal);
    const ev = { location: `${i.entryPath}/structure.json`, quote: f.title };
    nodes.push({
      id,
      type: "publication-element",
      label,
      properties: { elementType: f.kind, label, ...(f.title?.trim() ? { caption: f.title } : {}), pageRange: f.page_label ?? String(f.page), ordinal },
      derivation: "inferred",
      note: `Found by the ingest's figure reader (confidence ${f.confidence}, evidence ${(f.evidence ?? []).join("+")}) on physical page ${f.page}. caption is the text the reader took as the caption; for a box it may run into the box's body.`,
      evidence: ev,
      skill: SKILL,
    });
    edge("contains", parent, id, "inferred", `The ${s ? "deepest section" : "publication"} whose pages hold physical page ${f.page}.`, ev);
    if (s) {
      const block = blockOf(s);
      if (!nodes.some((n) => n.id === block)) libNode(block, `${CAT_HARNESS_NS}Block`, `Library block for ${s.id}`, range(s.page_start, s.page_end));
      edge("specializationOf", id, block, "inferred", `The library holds no block of its own for ${label}; it is cut from the prose block of the section printed on its page.`, ev);
    }
  }

  const doc: Doc = {
    "@context": L1_LIBRARY_CONTEXT,
    id: `${pub}/kg/l1-library`,
    type: "Entity",
    ontologyVersion: L1_V3_ONTOLOGY_VERSION,
    generatedAt: i.generatedAt,
    wasDerivedFrom: [
      { path: st.source.file, sha256: st.source.sha256, note: "The PDF as hashed at ingest (structure.json); not re-read here." },
      { path: `${i.entryPath}/structure.json`, sha256: i.structureSha256 },
      { path: `${i.entryPath}/manifest.jsonld`, sha256: i.manifestSha256 },
      { path: held.intakePath, sha256: sha256(readFileSync(held.abs.intake)) },
      ...(held.recordPath && held.abs.record ? [{ path: held.recordPath, sha256: sha256(readFileSync(held.abs.record)) }] : []),
    ],
    nodes,
    edges,
  };
  const count = (t: string) => nodes.filter((n) => n.type === t).length;
  report.unshift(`L1 (${decision.publicationType ?? "type undetermined"}, ${decision.derivation}): ${count("publication-section")} section(s), ${count("publication-element")} element(s), ${count("library-node")} library node(s)`);
  return { doc, report };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function serialise(doc: Doc): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
/** Current up to generatedAt — the one field a regeneration must change. */
export function isCurrent(existing: string | undefined, doc: Doc): boolean {
  if (existing === undefined) return false;
  try {
    const prior = JSON.parse(existing) as { generatedAt?: string };
    return typeof prior.generatedAt === "string" && existing === serialise({ ...doc, generatedAt: prior.generatedAt });
  } catch {
    return false;
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const entryArg = opt("--entry");
  if (!entryArg) {
    console.error("usage: l1-specialise.ts --entry <library entry> [--uploads <dir>] [--check] [--validate-zod <smart-base checkout>]");
    process.exit(2);
  }
  const dir = resolve(entryArg);
  const repo = execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim();
  const read = readStructure(dir);
  if ("reason" in read) {
    console.error(`✗ ${entryArg}: ${read.reason}`);
    process.exit(2);
  }
  const structure = read.raw as unknown as RawStructure;
  const held = heldIntakes(repo, opt("--uploads")).find((h) => h.pdfSha256 === structure.source.sha256);
  if (!held?.record) {
    console.error(`✗ ${entryArg}: no intake with a Dublin Core record whose original bitstream has sha256 ${structure.source.sha256} under uploads/ — L1 membership cannot be decided`);
    process.exit(2);
  }
  const decision = decideL1(held.intake, held.record);
  for (const d of decision.disagreements) console.log(`  ! ${d}`);
  if (decision.status === "undetermined") {
    console.error(`✗ ${entryArg}: L1 membership undetermined — record a declared classification (scheme https://smart.who.int/kg/layer, code l1) on ${held.intakePath}`);
    process.exit(2);
  }
  if (decision.status === "not-member") {
    console.log(`  not L1 (${decision.decidedBy!.source}: ${decision.decidedBy!.basis}) — no L1 graph; the library entry is the only representation`);
    process.exit(0);
  }
  const manifestPath = join(dir, "manifest.jsonld");
  const fm = join(dir, "sections", "sec-front-matter.md");
  const { doc, report } = l1LibraryDocument({
    entryPath: relative(repo, dir),
    structure,
    structureSha256: sha256(readFileSync(join(dir, STRUCTURE_FILENAME))),
    manifest: JSON.parse(readFileSync(manifestPath, "utf-8")),
    manifestSha256: sha256(readFileSync(manifestPath)),
    frontMatter: existsSync(fm) ? readFileSync(fm, "utf-8") : "",
    held,
    decision,
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  });
  for (const r of report) console.log(`  ${r}`);
  const target = join(dir, L1_LIBRARY_FILENAME);
  const existing = existsSync(target) ? readFileSync(target, "utf-8") : undefined;
  if (args.includes("--check")) {
    if (!isCurrent(existing, doc)) {
      console.error(`✗ ${relative(process.cwd(), target)} is stale — re-run without --check`);
      process.exit(1);
    }
    console.log(`✓ ${relative(process.cwd(), target)} current`);
  } else if (!isCurrent(existing, doc)) {
    writeFileSync(target, serialise(doc));
    console.log(`wrote ${relative(process.cwd(), target)}`);
  } else console.log(`${relative(process.cwd(), target)} current`);
  const zod = opt("--validate-zod");
  if (zod) process.exit(spawnSync("npx", ["tsx", "src/validate.ts", target], { cwd: join(zod, "kg"), stdio: "inherit" }).status ?? 1);
}
