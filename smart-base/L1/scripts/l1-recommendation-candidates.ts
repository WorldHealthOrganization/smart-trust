#!/usr/bin/env bun
/**
 * An ingested L1 guideline (`library/<entry>/`) → its recommendation
 * CANDIDATES, and — once an agent has curated them — an L1 3.0 graph of the
 * recommendations and remarks, gated verbatim and by coverage. Steps 3 to 6 of
 * the `recommendation-extraction` skill, made one tool; its Tool node is
 * `l1-recommendation-candidates` in `smart-base/L1/tools/` (the L1 subgraph's tools graph).
 *
 * ## Hybrid, and where each half lives
 *
 * 1. **Mechanical (this script, no curation):** every normative sentence of
 *    the entry's page text, found by folio-assistant-core's `l1-coverage`
 *    markers (imported, not copied), with mechanical HINTS where a reading is
 *    uncertain — licence or imprint text, a glossary page, a sentence the page
 *    layout split. The publication's identity is PROPOSED from the printed
 *    ISBN. Output: the work list `recommendation-candidates.json` and the
 *    warnings report; no recommendation is asserted.
 * 2. **Agent judgement (the skill, not this code):** an agent records, per
 *    candidate location, whether it is a `recommendation`, a `remark` of one,
 *    `part-of` one, or proposed for exclusion, each with a `basis`, in an
 *    `l1-recommendation-curation/v1` YAML. Nothing in this script guesses that.
 * 3. **Mechanical again (this script, with `--curation`):** the curation is
 *    REFUSED when a statement is not verbatim, a decision names a location
 *    the entry does not hold, or a remark names no recommendation. Otherwise
 *    it writes `l1.json` (L1 3.0, `smart-base/L1/schemas/l1.ts`, checked with
 *    `smart-base/L1/schemas/validate.ts`), `exclusions.proposed.json` (l1-coverage's shape),
 *    and the coverage totals. Every node is `inferred` and a candidate; a
 *    person signs exclusions and reviews scenarios, an agent never does.
 *
 * A publication the curation types `implementation-guidance` or `methodology`
 * makes no recommendations of its own (handbook §1.9): its decisions emit the
 * `l1-library` extension's `implementation-practice` nodes instead (owner
 * ruling 1b, 2026-10-12). Every proposed exclusion names the role that must
 * sign it, `l1-extraction-reviewer` (ruling 3b).
 *
 * The graph then feeds `l1-recommendation-scenarios.ts`, which proposes the
 * L2 user-scenario candidates (persona, process, domain).
 *
 * ## Provenance
 *
 * Each run writes a `folio-run-context/v1` (`run-context.json`, cat-harness
 * `schemas/run-context.ts`) beside its output, and the work list cites it by
 * reference. `--check` ignores the reference, as it ignores `generatedAt`.
 *
 *   bun run smart-base/L1/scripts/l1-recommendation-candidates.ts \
 *     --entry smart-base/library/<id> [--curation <curation.yaml>] --out <dir> [--check]
 *
 * @module smart-base/L1/scripts/l1-recommendation-candidates
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

import { coverage, normalise, type Exclusion, type Page, type Sentence } from "../../../folio-assistant-core/scripts/l1-coverage.ts";
import { contentHash, normText } from "../schemas/kgid.ts";
import { L1_VALUE_SETS } from "../schemas/l1.ts";
import { check as checkGraph } from "../schemas/validate.ts";
import { L1_V3_CONTEXT, L1_V3_ONTOLOGY_VERSION, publicationId, type Identifier } from "./l1-kgid.ts";
import { buildRunContext, writeRunContext, type RunContextRef } from "./l1-run-context.ts";
import { readStructure, STRUCTURE_FILENAME } from "../../platform/index.js";

export const CANDIDATES_SCHEMA_TAG = "l1-recommendation-candidates/v1" as const;
export const CURATION_SCHEMA_TAG = "l1-recommendation-curation/v1" as const;
export const SKILL = "smart-base/recommendation-extraction";

/** The context a graph names when it holds a class from the `l1-library` extension (`smart-base/L1/schemas/l1-library.ts`). */
export const L1_LIBRARY_CONTEXT = "http://smart.who.int/kg/l1-library.context.jsonld";

/** L1's publication-type codes, read from the ontology rather than restated. */
export const PUBLICATION_TYPES = L1_VALUE_SETS.find((v) => v.id === "publication-type")!.codes.map((c) => c.code) as [string, ...string[]];

/**
 * Publication types that make no recommendations of their own (handbook §1.9).
 * What they print as normative is an `implementation-practice`, not a
 * `recommendation` (owner ruling 1b, 2026-10-12).
 */
export const NON_RECOMMENDING_TYPES: readonly string[] = ["implementation-guidance", "methodology"];

/** The class a `recommendation` decision emits, by the publication's type. */
export const statementClass = (publicationType: string | undefined): "recommendation" | "implementation-practice" =>
  publicationType !== undefined && NON_RECOMMENDING_TYPES.includes(publicationType) ? "implementation-practice" : "recommendation";

/**
 * The role that must sign an L1 extraction's exclusions (owner ruling 3b,
 * 2026-10-12), as a role-graph `RoleRef` (`cat-harness/schemas/role-graph.ts`):
 * declared in `smart-base/scenarios/roles.json`. An exclusion names it and
 * stays unsigned until a person acting in that role signs it.
 */
export const EXCLUSION_SIGNER_ROLE = { role: "l1-extraction-reviewer" } as const;

/** An exclusion as written: l1-coverage's shape, plus the role that must sign it. */
export type ProposedExclusion = Exclusion & { signerRole: { role: string } };
export const CANDIDATES_FILENAME = "recommendation-candidates.json";
export const GRAPH_FILENAME = "l1.json";
export const EXCLUSIONS_FILENAME = "exclusions.proposed.json";
export const WARNINGS_FILENAME = "extraction-warnings.md";

// ── hints: mechanical, never a decision ─────────────────────────────────────

export const HINTS = {
  "licence-or-imprint": "licence, rights or imprint text — normally excluded as `editorial`",
  "glossary-page": "printed on a glossary or abbreviations page — a definition, not a recommendation",
  "layout-fragment": "the sentence looks split by the page layout (a table, list or figure); read the page before deciding",
} as const;
export type Hint = keyof typeof HINTS;

const LICENCE = /creative commons|some rights reserved|licen[cs]e|\bWHO logo\b|suggested citation|mediation|liable for damages|translation was not created|WHO endorses/i;

/** The mechanical hints for one sentence on its page. */
export function hintsFor(text: string, pageText: string): Hint[] {
  const out: Hint[] = [];
  if (LICENCE.test(text) || /some rights reserved/i.test(pageText)) out.push("licence-or-imprint");
  if (/^\s*(glossary|abbreviations)\s*$/im.test(pageText)) out.push("glossary-page");
  const t = text.trim();
  if (t.length < 30 || /^[a-z•\-–*]/.test(t) || !/[.!?:)”"]$/.test(t)) out.push("layout-fragment");
  return out;
}

// ── the library entry ───────────────────────────────────────────────────────

export interface Entry {
  dir: string;
  docId: string;
  sourceSha256?: string;
  pages: (Page & { file: string })[];
}

/** One page per `sections/*.md`, front matter stripped; the page number is the front matter's `pdf_page` (or `pages` start). */
export function readEntry(dir: string): Entry {
  const sec = join(dir, "sections");
  if (!existsSync(sec)) throw new Error(`${dir}: no sections/ — ingest the entry first`);
  let sourceSha256: string | undefined;
  let docId = basename(resolve(dir));
  // Through the platform's accessor (bean rkqp), so every structure variant is
  // read one way. An entry with no structure keeps its directory name; one whose
  // structure will not read is an error, never a silent fallback.
  if (existsSync(join(dir, STRUCTURE_FILENAME))) {
    const s = readStructure(dir);
    if ("reason" in s) throw new Error(`${dir}: ${s.reason}`);
    sourceSha256 = (s.raw as { source?: { sha256?: string } }).source?.sha256;
    docId = s.doc_id;
  }
  const pages = readdirSync(sec)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const raw = readFileSync(join(sec, f), "utf8");
      const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
      const fm = m ? m[1]! : "";
      const page = Number(/^pdf_page:\s*(\d+)/m.exec(fm)?.[1] ?? /^pages:\s*(\d+)/m.exec(fm)?.[1] ?? NaN);
      const text = (m ? raw.slice(m[0].length) : raw).replace(/^_\(no text on this page\)_\s*$/m, "");
      return { file: f, page, text };
    })
    .filter((p) => Number.isFinite(p.page));
  if (!pages.length) throw new Error(`${dir}: no page-tagged section text`);
  return { dir, docId, sourceSha256, pages };
}

/** The first printed ISBN (electronic version preferred) — a PROPOSAL; a curation may override it. */
export function proposedIdentifiers(entry: Entry): { identifiers: Identifier[]; location?: string; quote?: string } {
  for (const pref of [/ISBN\s*([0-9][0-9\- ]{9,}[0-9Xx])\s*\(electronic/i, /ISBN\s*([0-9][0-9\- ]{9,}[0-9Xx])/i]) {
    for (const p of entry.pages) {
      const m = pref.exec(p.text);
      if (m) return { identifiers: [{ type: "isbn", value: m[1]!.trim() }], location: p.file, quote: m[0] };
    }
  }
  return { identifiers: [] };
}

// ── the curation (an agent's judgement, recorded) ──────────────────────────

const Basis = { basis: z.string().min(1) };
const KEY = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.\-]*$/, "a key is letters, digits, dots and hyphens");

export const DecisionSchema = z.discriminatedUnion("as", [
  z.object({
    as: z.literal("recommendation"),
    key: KEY,
    /**
     * Verbatim override, for a sentence the splitter cut wrongly: one bullet of
     * a list read as one sentence, or a statement split across two. It must
     * contain the candidate sentence or be contained in it, and be printed.
     */
    statement: z.string().min(1).optional(),
    kind: z.enum(["recommendation", "context-specific", "research-context", "good-practice-statement", "no-recommendation"]).optional(),
    title: z.string().min(1).optional(),
    ...Basis,
  }).strict(),
  z.object({ as: z.literal("remark"), of: KEY, text: z.string().min(1).optional(), remarkType: z.string().min(1).optional(), ...Basis }).strict(),
  /** The sentence is inside a recommendation's (overridden) statement — counted captured through it. */
  z.object({ as: z.literal("part-of"), of: KEY, ...Basis }).strict(),
  z.object({
    as: z.literal("exclude"),
    reason: z.string().min(1),
    signedOffBy: z.string().min(1).optional(),
    signedOffAt: z.string().min(1).optional(),
    ...Basis,
  }).strict(),
]);
export type Decision = z.infer<typeof DecisionSchema>;

export const CurationSchema = z.object({
  $schema: z.literal(CURATION_SCHEMA_TAG),
  _comment: z.string().optional(),
  entry: z.string().min(1),
  publication: z.object({
    identifiers: z.array(z.object({ type: z.string().min(1), value: z.string().min(1) }).strict()).min(1).optional(),
    title: z.string().min(1).optional(),
    /** L1's publication-type. implementation-guidance or methodology turns every `recommendation` decision into an implementation-practice node. */
    publicationType: z.enum(PUBLICATION_TYPES).optional(),
    ...Basis,
  }).strict().optional(),
  /** Keyed by the candidate's location, `p<page>:s<n>` — l1-coverage's own. */
  /** Several decisions for one location when the splitter joined printed sentences (a bulleted list reads as one). */
  decisions: z.record(z.string().regex(/^p\d+:s\d+$/), z.union([DecisionSchema, z.array(DecisionSchema).min(1)])),
}).strict();
export type Curation = z.infer<typeof CurationSchema>;

export class RefusalError extends Error {
  constructor(public readonly problems: string[]) {
    super(`refused:\n  ${problems.join("\n  ")}`);
  }
}

// ── the run ─────────────────────────────────────────────────────────────────

export interface Candidate {
  location: string;
  page: number;
  file: string;
  text: string;
  markers: string[];
  hints: Hint[];
  decision: Decision["as"] | "undecided";
  keys?: string[];
}

export interface Warning { code: "l1-validator" | "undecided" | "fragment-decided" | "exclusion-unsigned" | "publication-proposed" | "no-publication-identity" | "hint"; key: string; message: string }

export interface Result {
  candidates: Candidate[];
  graph?: Record<string, unknown>;
  exclusions: ProposedExclusion[];
  coverage: { normative: number; captured: number; excluded: number; unaccounted: number; capturedPct: number | null; accountedForPct: number | null };
  warnings: Warning[];
  publication: { iri?: string; identifiers: Identifier[]; title?: string; publicationType?: string; proposedBy: "mechanical" | "curation" | "none" };
  /** `statementClass` is what every `recommendation` decision emitted; `recommendations` counts those decisions whichever class they became. */
  counts: { statementClass: "recommendation" | "implementation-practice"; recommendations: number; remarks: number; partOf: number; excluded: number; undecided: number };
}

const sha256 = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");

export function run(entry: Entry, curation: Curation | undefined, entryPath: string, generatedAt: string): Result {
  const report = coverage(entry.pages, []);
  const byPage = new Map(entry.pages.map((p) => [p.page, p]));
  const candidates: Candidate[] = report.sentences.map((s: Sentence) => {
    const pg = byPage.get(s.page)!;
    return { location: s.location, page: s.page, file: pg.file, text: s.text, markers: s.markers, hints: hintsFor(s.text, pg.text), decision: "undecided" as const };
  });
  const byLoc = new Map(candidates.map((c) => [c.location, c]));
  const warnings: Warning[] = [];
  const problems: string[] = [];
  const decided: [string, Decision][] = Object.entries(curation?.decisions ?? {}).flatMap(([loc, d]) => (Array.isArray(d) ? d : [d]).map((x) => [loc, x] as [string, Decision]));
  const decisionsAt = (loc: string): Decision[] => decided.filter(([l]) => l === loc).map(([, d]) => d);

  // publication identity
  const prop = proposedIdentifiers(entry);
  const identifiers = curation?.publication?.identifiers ?? prop.identifiers;
  const proposedBy = curation?.publication?.identifiers ? "curation" : prop.identifiers.length ? "mechanical" : "none";
  let pubIri: string | undefined;
  try {
    pubIri = identifiers.length ? publicationId(identifiers) : undefined;
  } catch {
    pubIri = undefined;
  }
  if (!pubIri) warnings.push({ code: "no-publication-identity", key: entry.docId, message: "no isbn, iris-handle, doi, issn or url found; give one in the curation's `publication.identifiers`" });
  else if (proposedBy === "mechanical") warnings.push({ code: "publication-proposed", key: entry.docId, message: `identity proposed from the printed "${prop.quote}" (${prop.location}); confirm it in the curation` });

  // decisions: refusals first, all at once
  const fullText = normalise(entry.pages.map((p) => p.text).join("\n"));
  const recs = new Map<string, { loc: string; d: Extract<Decision, { as: "recommendation" }>; statement: string }>();
  for (const [loc, d] of decided) {
    const c = byLoc.get(loc);
    if (!c) { problems.push(`${loc}: the entry has no normative sentence at this location`); continue; }
    if (d.as === "recommendation") {
      if (recs.has(d.key)) problems.push(`${loc}: key "${d.key}" is already used by ${recs.get(d.key)!.loc}`);
      const statement = d.statement ?? c.text;
      if (d.statement !== undefined && !normalise(d.statement).includes(normalise(c.text)) && !normalise(c.text).includes(normalise(d.statement))) problems.push(`${loc}: the statement override neither contains nor is contained in the candidate sentence — it would be a different statement`);
      if (!fullText.includes(normalise(statement))) problems.push(`${loc}: statement is not verbatim — "${statement.slice(0, 80)}…" is not printed in the entry`);
      recs.set(d.key, { loc, d, statement });
    }
  }
  for (const [loc, ds] of Object.entries(curation?.decisions ?? {})) {
    if (Array.isArray(ds) && ds.some((d) => d.as === "exclude")) problems.push(`${loc}: an exclusion is the only decision for its location`);
  }
  for (const [loc, d] of decided) {
    if ((d.as === "remark" || d.as === "part-of") && !recs.has(d.of)) problems.push(`${loc}: ${d.as} of "${d.of}", which no recommendation decision declares`);
    if (d.as === "remark" && d.text !== undefined && !fullText.includes(normalise(d.text))) problems.push(`${loc}: remark text is not verbatim`);
    if (d.as === "part-of") {
      const r = recs.get(d.of);
      const c = byLoc.get(loc);
      if (r && c && !normalise(r.statement).includes(normalise(c.text))) problems.push(`${loc}: part-of "${d.of}", but that statement does not contain this sentence`);
    }
  }
  const pubType = curation?.publication?.publicationType;
  const cls = statementClass(pubType);
  if (cls === "implementation-practice") {
    for (const [loc, d] of decided) {
      if (d.as === "recommendation" && d.kind !== undefined) problems.push(`${loc}: kind "${d.kind}" is a recommendation kind, and a ${pubType} publication makes no recommendations of its own (handbook §1.9) — its statements are implementation-practice nodes, which carry no kind`);
      if (d.as === "remark") problems.push(`${loc}: remark of "${d.of}", but in a ${pubType} publication "${d.of}" is an implementation-practice, and L1 3.0's remark attaches only to a recommendation (its IRI is minted under one) — exclude the sentence, make it its own practice, or wait for remark to be licensed upstream`);
    }
  }
  if (problems.length) throw new RefusalError(problems);

  // apply
  const exclusions: ProposedExclusion[] = [];
  for (const c of candidates) {
    const ds = decisionsAt(c.location);
    const d = ds[0];
    if (!d) {
      c.decision = "undecided";
      // An undecided licence sentence still gets an exclusion PROPOSAL — unsigned, so it stays unaccounted.
      if (c.hints.includes("licence-or-imprint")) exclusions.push({ location: c.location, reason: "editorial", signerRole: EXCLUSION_SIGNER_ROLE });
      continue;
    }
    c.decision = d.as;
    const keys = ds.flatMap((x) => (x.as === "recommendation" ? [x.key] : x.as === "remark" || x.as === "part-of" ? [x.of] : []));
    if (keys.length) c.keys = keys;
    if (d.as === "exclude") exclusions.push({ location: c.location, reason: d.reason, signerRole: EXCLUSION_SIGNER_ROLE, ...(d.signedOffBy ? { signedOffBy: d.signedOffBy } : {}), ...(d.signedOffAt ? { signedOffAt: d.signedOffAt } : {}) });
  }

  // the L1 3.0 graph
  const nodes: Record<string, unknown>[] = [];
  const edges: Record<string, unknown>[] = [];
  const captured: { id: string; text: string }[] = [];
  const entryRel = entryPath.replace(/\/+$/, "");
  if (pubIri && recs.size) {
    nodes.push({
      id: pubIri, type: "publication", label: curation?.publication?.title ?? entry.docId,
      properties: { ...(curation?.publication?.title ? { title: curation.publication.title } : {}), identifiers, ...(pubType ? { publicationType: pubType } : {}), ...(entry.sourceSha256 ? { sha256: entry.sourceSha256 } : {}) },
      derivation: "inferred",
      note: curation?.publication?.basis ?? `Identity proposed from the printed ISBN.`,
      evidence: { location: `${entryRel}/sections/${prop.location ?? entry.pages[0]!.file}`, ...(prop.quote ? { quote: prop.quote } : {}) },
      skill: SKILL,
    });
    const remarkOrdinal = new Map<string, number>();
    for (const [key, { loc, d, statement }] of recs) {
      const c = byLoc.get(loc)!;
      const id = `${pubIri}/${cls}/${key}`;
      captured.push({ id: key, text: statement });
      nodes.push({
        id, type: cls, label: d.title ?? key,
        properties: { identifier: key, statement, ...(d.kind ? { kind: d.kind } : {}), contentHash: contentHash(normText(statement)) },
        derivation: "inferred", note: d.basis,
        evidence: { location: `${entryRel}/sections/${c.file}`, quote: c.text },
        skill: SKILL,
      });
      edges.push({ type: "Statement", predicate: "definedIn", source: id, target: pubIri, derivation: "inferred", note: "Printed in this publication.", evidence: { location: `${entryRel}/sections/${c.file}` }, skill: SKILL });
      if (c.hints.includes("layout-fragment") && d.statement === undefined) warnings.push({ code: "fragment-decided", key, message: `${loc} looks split by the layout and was taken as printed; check the statement is whole` });
    }
    for (const [loc, d] of decided) {
      if (d.as !== "remark") continue;
      const c = byLoc.get(loc)!;
      const n = (remarkOrdinal.get(d.of) ?? 0) + 1;
      remarkOrdinal.set(d.of, n);
      const recId = `${pubIri}/recommendation/${d.of}`;
      const id = `${recId}/remark/${n}`;
      const text = d.text ?? c.text;
      captured.push({ id: `${d.of}/remark/${n}`, text });
      nodes.push({
        id, type: "remark", label: `${d.of} remark ${n}`,
        properties: { text, ...(d.remarkType ? { remarkType: d.remarkType } : {}), ordinal: n, contentHash: contentHash(normText(text)) },
        derivation: "inferred", note: d.basis, evidence: { location: `${entryRel}/sections/${c.file}`, quote: c.text }, skill: SKILL,
      });
      edges.push({ type: "Statement", predicate: "hasRemark", source: recId, target: id, derivation: "inferred", note: d.basis, evidence: { location: `${entryRel}/sections/${c.file}` }, skill: SKILL });
    }
  }
  const graph = nodes.length
    ? {
        // A graph holding an extension class names the extension's context, so the validator scopes L1 + l1-library.
        "@context": cls === "recommendation" ? L1_V3_CONTEXT : L1_LIBRARY_CONTEXT,
        id: `${pubIri}#recommendation-candidates`,
        type: "Entity",
        ontologyVersion: L1_V3_ONTOLOGY_VERSION,
        generatedAt,
        wasDerivedFrom: [
          ...(entry.sourceSha256 ? [{ path: `${entryRel}/${STRUCTURE_FILENAME}`, sha256: sha256(readFileSync(join(entry.dir, STRUCTURE_FILENAME))), note: `The entry's structure; the source PDF's sha256 is ${entry.sourceSha256}.` }] : []),
          { path: `${entryRel}/sections/`, sha256: sha256(entry.pages.map((p) => `${sha256(readFileSync(join(entry.dir, "sections", p.file)))}  ${p.file}`).join("\n") + "\n"), note: "The page texts read, hashed as a sha256sum listing in file order." },
        ],
        nodes,
        edges,
      }
    : undefined;
  if (graph) {
    const v = checkGraph(graph);
    if (v.errors.length) throw new RefusalError(v.errors.map((e) => `L1 3.0 validation: ${e}`));
    // The validator's warnings, grouped: the same finding on 22 nodes is one line with a count.
    const groups = new Map<string, number>();
    for (const w of v.warnings) {
      const k = w.replace(/"[^"]*"/g, "…");
      groups.set(k, (groups.get(k) ?? 0) + 1);
    }
    for (const [k, n] of groups) warnings.push({ code: "l1-validator", key: `x${n}`, message: k });
  }

  // coverage over the curated graph
  const cov = coverage(entry.pages, captured, exclusions).totals;

  // warnings: the work list
  const undecided = candidates.filter((c) => c.decision === "undecided");
  for (const c of undecided) warnings.push({ code: "undecided", key: c.location, message: `${c.text.slice(0, 100)}${c.text.length > 100 ? "…" : ""}${c.hints.length ? ` [${c.hints.join(", ")}]` : ""}` });
  for (const e of exclusions) if (!e.signedOffBy) warnings.push({ code: "exclusion-unsigned", key: e.location!, message: `proposed \`${e.reason}\`; counts only once a person acting as \`${e.signerRole.role}\` signs it` });

  const count = (as: string) => decided.filter(([, d]) => d.as === as).length;
  return {
    candidates, graph, exclusions, coverage: cov, warnings,
    publication: { iri: pubIri, identifiers, title: curation?.publication?.title, ...(pubType ? { publicationType: pubType } : {}), proposedBy },
    counts: { statementClass: cls, recommendations: recs.size, remarks: count("remark"), partOf: count("part-of"), excluded: count("exclude"), undecided: undecided.length },
  };
}

export const warningLine = (w: Warning): string => `WARNING ${w.code} ${w.key}: ${w.message}`;

export function warningsReport(r: Result, entryPath: string): string {
  const c = r.counts;
  const byHint = Object.keys(HINTS).map((h) => `${h} ${r.candidates.filter((x) => x.hints.includes(h as Hint)).length}`).join(", ");
  const lines = [
    `# Recommendation candidates — ${entryPath}`,
    "",
    `Generated by \`smart-base/L1/scripts/l1-recommendation-candidates.ts\` (skill \`recommendation-extraction\`). Everything here is a **candidate**: an agent decides, a person signs exclusions and reviews.`,
    "",
    `- normative sentences (l1-coverage markers): **${r.candidates.length}**; hints: ${byHint}`,
    `- decided: ${c.recommendations} ${c.statementClass === "recommendation" ? "recommendation(s)" : "implementation practice(s) (the publication makes no recommendations of its own)"}, ${c.remarks} remark(s), ${c.partOf} part-of, ${c.excluded} proposed exclusion(s); **undecided ${c.undecided}**`,
    `- coverage: captured ${r.coverage.captured}/${r.coverage.normative} (${r.coverage.capturedPct ?? "n/a"} %), accounted-for ${r.coverage.accountedForPct ?? "n/a"} % — 100 % needs every exclusion signed by a person acting as \`${EXCLUSION_SIGNER_ROLE.role}\``,
    `- publication: ${r.publication.iri ?? "none"} (${r.publication.proposedBy})`,
    "",
    `## Warnings (${r.warnings.length})`,
    "",
    "```",
    ...r.warnings.map(warningLine),
    "```",
    "",
  ];
  return lines.join("\n");
}

export const serialise = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";

/** Same content, ignoring the volatile fields. */
export function sameIgnoring(onDisk: string, fresh: unknown, keys: string[]): boolean {
  const strip = (o: unknown): unknown => (o && typeof o === "object" && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k))) : o);
  try {
    return serialise(strip(JSON.parse(onDisk))) === serialise(strip(fresh));
  } catch {
    return false;
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string): string | undefined => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const entryPath = opt("--entry"), out = opt("--out"), curationPath = opt("--curation");
  if (!entryPath || !out) {
    console.error("usage: l1-recommendation-candidates.ts --entry <library/<id>> [--curation <curation.yaml>] --out <dir> [--check]");
    process.exit(2);
  }
  let result: Result;
  let curation: Curation | undefined;
  try {
    curation = curationPath ? CurationSchema.parse(parseYaml(readFileSync(curationPath, "utf8"))) : undefined;
    result = run(readEntry(entryPath), curation, entryPath, new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));
  } catch (err) {
    if (err instanceof RefusalError) { console.error(`✗ ${err.problems.length} refusal(s):\n  ${err.problems.join("\n  ")}`); process.exit(1); }
    if (err instanceof z.ZodError) { console.error(`✗ invalid curation:\n${err.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`); process.exit(1); }
    throw err;
  }
  const report = warningsReport(result, entryPath);
  const workList = {
    $schema: CANDIDATES_SCHEMA_TAG,
    entry: entryPath,
    ...(curationPath ? { curation: { path: curationPath, sha256: sha256(readFileSync(curationPath)) } } : {}),
    publication: result.publication,
    counts: result.counts,
    coverage: result.coverage,
    hints: HINTS,
    candidates: result.candidates,
  };
  const files: [string, string, unknown][] = [
    [join(out, CANDIDATES_FILENAME), "json", workList],
    [join(out, EXCLUSIONS_FILENAME), "json", result.exclusions],
    [join(out, WARNINGS_FILENAME), "text", report],
    ...(result.graph ? ([[join(out, GRAPH_FILENAME), "json", result.graph]] as [string, string, unknown][]) : []),
  ];
  const summary = `${result.candidates.length} candidates: ${result.counts.recommendations} ${result.counts.statementClass === "recommendation" ? "recommendations" : "implementation practices"}, ${result.counts.remarks} remarks, ${result.counts.excluded} proposed exclusions, ${result.counts.undecided} undecided; ${result.warnings.length} warning(s)`;
  if (args.includes("--check")) {
    const stale = files.filter(([p, kind, v]) => !existsSync(p) || (kind === "text" ? readFileSync(p, "utf8") !== v : !sameIgnoring(readFileSync(p, "utf8"), v, ["runContext", "generatedAt"])));
    if (stale.length) { console.error(`✗ stale — re-run without --check: ${stale.map(([p]) => p).join(", ")}`); process.exit(1); }
    console.log(`✓ current — ${summary}`);
    process.exit(0);
  }
  mkdirSync(out, { recursive: true });
  const ctx = buildRunContext(process.argv[1]!, [join(entryPath, STRUCTURE_FILENAME), ...(curationPath ? [curationPath] : [])].filter(existsSync), out);
  let ref: RunContextRef | undefined;
  if (ctx) ref = writeRunContext(ctx, out);
  else console.error("WARNING run-context: no git checkout to name as the platform; run-context.json not written");
  for (const [p, kind, v] of files) {
    // An unchanged graph keeps its bytes: downstream (the scenario candidates) pins it by sha256.
    if (p.endsWith(GRAPH_FILENAME) && existsSync(p) && sameIgnoring(readFileSync(p, "utf8"), v, ["generatedAt"])) continue;
    const body = kind === "text" ? (v as string) : serialise(p.endsWith(CANDIDATES_FILENAME) && ref ? { ...(v as object), runContext: ref } : v);
    writeFileSync(p, body);
  }
  for (const w of result.warnings.filter((w) => w.code !== "undecided")) console.error(warningLine(w));
  console.log(`wrote ${out} — ${summary}`);
}
