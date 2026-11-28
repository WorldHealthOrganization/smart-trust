#!/usr/bin/env bun
/**
 * MeSH authority validation: the third stage of `skill-pipeline-subject-indexing`
 * for the Medical Subject Headings.
 *
 * @module folio-assistant-core/scripts/mesh-authority
 *
 * A draft lists candidate headings, each a label (a preferred heading or an
 * entry term) or a descriptor id, with an optional qualifier. Every candidate
 * is looked up in NLM's MeSH authority (https://id.nlm.nih.gov/mesh/), and
 * the result says, per candidate, what the authority holds:
 *
 * - `resolved`: one descriptor; its id and preferred label are returned. When
 *   the label was an entry term, the preferred label replaces it.
 * - `not-found`: the authority has no descriptor for it. It is dropped from
 *   the validated list. The method never emits a term the authority lacks.
 * - `ambiguous`: more than one descriptor carries the label. A person chooses.
 * - `qualifier-not-allowed`: the descriptor resolved, but the qualifier is not
 *   among its allowable qualifiers. The descriptor is kept without it.
 *
 * It never adds a heading the draft did not propose, and never decides what a
 * work is about: that is stage one, and its output is a draft for review.
 *
 * ```sh
 * bun run folio-assistant-core/scripts/mesh-authority.ts lookup "Rubeola"
 * bun run folio-assistant-core/scripts/mesh-authority.ts validate draft.json [--json]
 * ```
 */
import { readFileSync } from "node:fs";

export const MESH_BASE = "https://id.nlm.nih.gov/mesh";

/** A heading a stage-one draft proposes. */
export interface Candidate {
  /** A preferred heading or an entry term, as written in the draft. */
  label?: string;
  /** A descriptor id such as `D008457`, when the draft already has one. */
  descriptor?: string;
  /** A qualifier (subheading) label such as `diagnosis`, if any. */
  qualifier?: string;
  /** Why stage one proposed it: carried through for the reviewer, never read. */
  why?: string;
}

export type Status = "resolved" | "not-found" | "ambiguous" | "qualifier-not-allowed";

export interface Validation {
  candidate: Candidate;
  status: Status;
  /** The descriptor, when exactly one was found. */
  descriptor?: { id: string; label: string; iri: string };
  /** The qualifier, when it was asked for and is allowable. */
  qualifier?: { id: string; label: string };
  /** The label was an entry term, so the preferred label replaced it. */
  viaEntryTerm?: boolean;
  /** Every descriptor that carries the label, when there is more than one. */
  options?: { id: string; label: string }[];
  note?: string;
}

export interface Report {
  authority: string;
  checkedAt: string;
  results: Validation[];
  /** Only the `resolved` and `qualifier-not-allowed` descriptors: the headings a reviewer sees. */
  validated: { descriptor: string; label: string; qualifier?: string }[];
}

/** A fetch that returns parsed JSON, so tests can stand in for NLM. */
export type JsonGet = (url: string) => Promise<unknown>;

export const httpGet: JsonGet = async (url) => {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r.json();
};

const idOf = (iri: string): string => iri.slice(iri.lastIndexOf("/") + 1);
const DESCRIPTOR_ID = /^D\d{6,9}$/;

interface LabelRow { resource: string; label: string }

function rows(x: unknown): LabelRow[] {
  if (!Array.isArray(x)) throw new Error("the MeSH lookup did not answer with a list");
  return x.filter((r): r is LabelRow => typeof r?.resource === "string" && typeof r?.label === "string");
}

/** Current descriptors whose entry term (any term of any concept) is exactly `label`. */
export function entryTermQuery(label: string): string {
  const lit = JSON.stringify(label);
  return [
    "PREFIX meshv: <http://id.nlm.nih.gov/mesh/vocab#>",
    "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>",
    "SELECT DISTINCT ?d ?dl WHERE {",
    `  ?t meshv:prefLabel ${lit}@en .`,
    "  ?c meshv:preferredTerm|meshv:term ?t .",
    "  ?d meshv:preferredConcept|meshv:concept ?c .",
    "  ?d a meshv:TopicalDescriptor ; rdfs:label ?dl .",
    `  FILTER(STRSTARTS(STR(?d), "http://id.nlm.nih.gov/mesh/D"))`,
    "}",
  ].join("\n");
}

/** Descriptors for a label: the preferred heading first, then entry terms. */
export async function findDescriptors(label: string, get: JsonGet = httpGet): Promise<{ hits: LabelRow[]; viaEntryTerm: boolean }> {
  const exact = rows(await get(`${MESH_BASE}/lookup/descriptor?label=${encodeURIComponent(label)}&match=exact&year=current&limit=10`));
  if (exact.length > 0) return { hits: exact, viaEntryTerm: false };
  const q = new URLSearchParams({ query: entryTermQuery(label), format: "JSON", inference: "false", year: "current" });
  const res = (await get(`${MESH_BASE}/sparql?${q}`)) as { results?: { bindings?: { d?: { value?: string }; dl?: { value?: string } }[] } };
  const hits = (res.results?.bindings ?? [])
    .filter((b) => b.d?.value && b.dl?.value)
    .map((b) => ({ resource: b.d!.value!, label: b.dl!.value! }));
  return { hits, viaEntryTerm: hits.length > 0 };
}

/** A descriptor's preferred label and its allowable qualifiers, by id. */
export async function details(id: string, get: JsonGet = httpGet): Promise<{ label: string; qualifiers: LabelRow[] } | undefined> {
  const d = (await get(`${MESH_BASE}/lookup/details?descriptor=${encodeURIComponent(id)}`)) as {
    terms?: { label?: string; preferred?: boolean }[];
    qualifiers?: unknown;
  };
  const label = d.terms?.find((t) => t.preferred)?.label;
  if (!label) return undefined;
  return { label, qualifiers: rows(d.qualifiers ?? []) };
}

export async function validateOne(c: Candidate, get: JsonGet = httpGet): Promise<Validation> {
  let id: string;
  let viaEntryTerm = false;
  if (c.descriptor) {
    if (!DESCRIPTOR_ID.test(c.descriptor)) return { candidate: c, status: "not-found", note: `${c.descriptor} is not a descriptor id` };
    id = c.descriptor;
  } else if (c.label?.trim()) {
    const found = await findDescriptors(c.label.trim(), get);
    const ids = [...new Map(found.hits.map((h) => [idOf(h.resource), h.label])).entries()];
    if (ids.length === 0) return { candidate: c, status: "not-found", note: "no descriptor has this heading or entry term" };
    if (ids.length > 1) return { candidate: c, status: "ambiguous", options: ids.map(([i, l]) => ({ id: i, label: l })) };
    id = ids[0]![0];
    viaEntryTerm = found.viaEntryTerm;
  } else {
    return { candidate: c, status: "not-found", note: "the candidate has neither a label nor a descriptor id" };
  }
  const det = await details(id, get);
  if (!det) return { candidate: c, status: "not-found", note: `${id} has no current record` };
  const descriptor = { id, label: det.label, iri: `${MESH_BASE}/${id}` };
  const base = { candidate: c, descriptor, ...(viaEntryTerm ? { viaEntryTerm } : {}) };
  if (!c.qualifier) return { ...base, status: "resolved" };
  const q = det.qualifiers.find((x) => x.label.toLowerCase() === c.qualifier!.trim().toLowerCase());
  if (!q) return { ...base, status: "qualifier-not-allowed", note: `"${c.qualifier}" is not an allowable qualifier of ${det.label}` };
  return { ...base, status: "resolved", qualifier: { id: idOf(q.resource), label: q.label } };
}

export async function validate(cands: Candidate[], get: JsonGet = httpGet, now: () => Date = () => new Date()): Promise<Report> {
  const results: Validation[] = [];
  for (const c of cands) results.push(await validateOne(c, get));
  const validated = results
    .filter((r) => r.descriptor && (r.status === "resolved" || r.status === "qualifier-not-allowed"))
    .map((r) => ({ descriptor: r.descriptor!.id, label: r.descriptor!.label, ...(r.qualifier ? { qualifier: r.qualifier.label } : {}) }));
  return { authority: MESH_BASE, checkedAt: now().toISOString(), results, validated };
}

/** The report as a review table: one row per candidate, in draft order. */
export function reportTable(r: Report): string {
  const cell = (s: string) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
  const lines = ["| # | proposed | status | MeSH heading | note |", "|---|---|---|---|---|"];
  r.results.forEach((v, i) => {
    const proposed = [v.candidate.label ?? v.candidate.descriptor ?? "", v.candidate.qualifier ? `/ ${v.candidate.qualifier}` : ""].join(" ").trim();
    const heading = v.descriptor ? `${v.descriptor.label}${v.qualifier ? `/${v.qualifier.label}` : ""} (${v.descriptor.id})` : "";
    const note = v.options ? `one of: ${v.options.map((o) => `${o.label} (${o.id})`).join(", ")}` : (v.note ?? (v.viaEntryTerm ? "entry term, replaced by the preferred heading" : ""));
    lines.push(`| ${i + 1} | ${cell(proposed)} | ${v.status} | ${cell(heading)} | ${cell(note)} |`);
  });
  return lines.join("\n");
}

if (import.meta.main) {
  const [cmd, arg, ...rest] = process.argv.slice(2);
  if (cmd === "lookup" && arg) {
    console.log(JSON.stringify(await validateOne({ label: arg }), null, 2));
  } else if (cmd === "validate" && arg) {
    const draft = JSON.parse(readFileSync(arg, "utf-8")) as { candidates?: Candidate[] } | Candidate[];
    const cands = Array.isArray(draft) ? draft : (draft.candidates ?? []);
    const report = await validate(cands);
    console.log(rest.includes("--json") ? JSON.stringify(report, null, 2) : reportTable(report));
  } else {
    console.error('usage: mesh-authority.ts lookup "<label>" | validate <draft.json> [--json]');
    process.exit(2);
  }
}
