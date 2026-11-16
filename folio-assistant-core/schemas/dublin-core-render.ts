/**
 * Dublin Core RENDERINGS of a catalogue record: DC XML for a harvester, and
 * JSON-LD bound to DCMI Metadata Terms.
 *
 * @module schemas/dublin-core-render
 * @graphNode schema
 *
 * Bean `7eak`, owner 2026-09-30: *"do we render the proper xml for dublin
 * core? it should be in rendering ppiple as skill and tool … and then pushed
 * to gh-pages"*; and (paraphrased) the owner asked that a catalogue layer
 * above this layer link to its JSON and XML renderings.
 * The skill that governs this is `skills/library/dublin-core-renderings.md`;
 * the script and Tool are `scripts/dc-render.ts` and `dublin-core-render` in
 * `tools/index.ts`.
 *
 * ## Why this is not {@link dublinCoreToJsonLd}
 *
 * That projection is the LOSSLESS DSpace graph, and its header argues for
 * both of the things that make it the wrong thing to publish as Dublin Core:
 * every qualified field goes to a minted `dspace:` predicate (so a DCMI-aware
 * consumer finds no `dcterms:issued`, `dcterms:abstract`, …), and every value
 * sits in an `@list` (so `dcterms:title`'s object would be an RDF LIST rather
 * than a literal — a graph in which the title of the handbook is a list
 * node). Both are right for what it is for, and both are wrong for a
 * rendering a stranger reads. So this is a second projection with a different
 * job, and the first is untouched.
 *
 * ## Every mapping is a row in one table, and each row cites the term
 *
 * {@link DCTERMS_MAP} maps a qualified DSpace field name to the DCMI term it
 * is, plus the facts DCMI Metadata Terms (2020-01-20, the edition the
 * `dcmi-terms` registry record pins) states about that term: whether its
 * range is a LITERAL or a resource (linked-data voice,
 * `ld-know-which-properties-are-object-properties`: read the ontology, do not
 * guess from the value's shape), and the encoding scheme its values are in
 * where the field name itself says so (`uri` → `dcterms:URI`, `mesh` →
 * `dcterms:MESH`, `iso` → `dcterms:RFC4646`).
 *
 * A field with no row is NOT forced onto the nearest DCMI term. In JSON-LD it
 * keeps the predicate {@link dcPredicate} already gives it, so the two
 * projections agree about every field DCMI does not define; in XML it is
 * dumbed down to its DCMI element, per the DCMI dumb-down principle, with the
 * original field name beside it in a comment. A field in a non-`dc` schema
 * (`who.relation.languageVersion`) has no DCMI element to dumb down to and is
 * listed as not expressible, never silently dropped.
 *
 * ## A value of a non-literal term is a node, never a string
 *
 * `dcterms:creator`'s range is `dcterms:Agent`. The record holds the TEXT
 * "World Health Organization" and no IRI for the agent. Emitting the string
 * makes the creator a literal (voice rule `ld-object-property-is-a-link`);
 * minting an IRI for it invents an address (`ld-link-is-the-node-release-
 * address`). DCMI's own answer — *Expressing Dublin Core metadata using the
 * Resource Description Framework* (2008), "value strings" — is a blank node
 * carrying the string as `rdf:value`, which is what this emits. A vocabulary
 * encoding scheme rides on that node as `dcam:memberOf`.
 *
 * ## Nothing is composed
 *
 * Every value is the record's own string, verbatim, in source order. An
 * encoding scheme is asserted only when the FIELD NAME says it (`uri`,
 * `mesh`, `iso`) or, for dates, only when the value actually matches the
 * W3CDTF profile — `"1993"` does, a free-text date would not and gets none.
 *
 * @conformsTo dcmi-terms
 * @conformsTo w3c-rdf
 * @conformsTo w3c-xsd11-structures
 */
import {
  bcp47,
  DC_ELEMENTS_NS,
  DCTERMS_NS,
  DSPACE_NS,
  SIMPLE_ELEMENTS,
  dcFieldName,
  dcPredicate,
  type DcField,
  type DcValue,
  type DublinCoreRecord,
} from "./dublin-core.js";
import { HANDLE_RESOLVER } from "./catalogue.js";

/** DCMI Abstract Model terms — `dcam:memberOf`. Published in DCMI Metadata Terms §"Terms for vocabulary description". */
export const DCAM_NS = "http://purl.org/dc/dcam/";
/** RDF, for `rdf:value` on a value-string node. */
export const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
/** XML Schema instance, for `xsi:type` — how the DCMI XML guidelines carry an encoding scheme. */
export const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";

/** The two renderings' `$schema`-like identity, as their filenames' suffix. */
export const DC_XML_SUFFIX = ".dc.xml";
export const DC_JSONLD_SUFFIX = ".dc.jsonld";

/** One row: the DCMI term a field IS, and what DCMI says about its values. */
export interface DctermsMapping {
  /** The local name under `http://purl.org/dc/terms/`. */
  term: string;
  /**
   * `literal` when DCMI gives the term the range `rdfs:Literal` or gives no
   * range and the value is prose; `resource` when the range is a class
   * (Agent, Location, LinguisticSystem, …) or DCMI says the term is
   * "intended to be used with non-literal values".
   */
  range: "literal" | "resource";
  /** A syntax encoding scheme the values are in, by the field's own name. Becomes a datatype (JSON-LD) or `xsi:type` (XML). */
  ses?: string;
  /** A vocabulary encoding scheme the values are members of. Becomes `dcam:memberOf` (JSON-LD) or `xsi:type` (XML). */
  ves?: string;
}

/**
 * Qualified DSpace field → DCMI term. Keyed on {@link dcFieldName}.
 *
 * `dc.contributor.author` → `creator`: DSpace's own `oai_dc` crosswalk maps
 * it there, and an author is DCMI's "entity primarily responsible for making
 * the resource". `dc.date.accessioned` is ABSENT on purpose — it is when the
 * repository took the item in, which is not `dateAccepted` ("date of
 * acceptance of the resource", e.g. of a thesis) however close the words are.
 * `dc.identifier.isbn` / `govdoc` and `dc.title.release` are absent because
 * DCMI defines no term or scheme for them.
 */
export const DCTERMS_MAP: Readonly<Record<string, DctermsMapping>> = {
  "dc.title": { term: "title", range: "literal" },
  "dc.title.alternative": { term: "alternative", range: "literal" },
  "dc.creator": { term: "creator", range: "resource" },
  "dc.contributor": { term: "contributor", range: "resource" },
  "dc.contributor.author": { term: "creator", range: "resource" },
  "dc.coverage": { term: "coverage", range: "resource" },
  "dc.coverage.spatial": { term: "spatial", range: "resource" },
  "dc.coverage.temporal": { term: "temporal", range: "resource" },
  "dc.date": { term: "date", range: "literal", ses: "W3CDTF" },
  "dc.date.available": { term: "available", range: "literal", ses: "W3CDTF" },
  "dc.date.created": { term: "created", range: "literal", ses: "W3CDTF" },
  "dc.date.issued": { term: "issued", range: "literal", ses: "W3CDTF" },
  "dc.description": { term: "description", range: "literal" },
  "dc.description.abstract": { term: "abstract", range: "literal" },
  "dc.description.tableofcontents": { term: "tableOfContents", range: "literal" },
  "dc.format": { term: "format", range: "resource" },
  "dc.format.extent": { term: "extent", range: "resource" },
  "dc.format.mimetype": { term: "format", range: "resource", ves: "IMT" },
  "dc.identifier": { term: "identifier", range: "literal" },
  "dc.identifier.uri": { term: "identifier", range: "literal", ses: "URI" },
  "dc.language": { term: "language", range: "resource" },
  "dc.language.iso": { term: "language", range: "resource", ses: "RFC4646" },
  "dc.publisher": { term: "publisher", range: "resource" },
  "dc.relation": { term: "relation", range: "resource" },
  "dc.rights": { term: "rights", range: "resource" },
  "dc.source": { term: "source", range: "resource" },
  "dc.subject": { term: "subject", range: "resource" },
  "dc.subject.other": { term: "subject", range: "resource" },
  "dc.subject.mesh": { term: "subject", range: "resource", ves: "MESH" },
  "dc.type": { term: "type", range: "resource" },
};

/** The DCMI term a field is, or undefined when DCMI defines none. */
export function dctermsFor(f: Pick<DcField, "schema" | "element" | "qualifier">): DctermsMapping | undefined {
  return DCTERMS_MAP[dcFieldName(f)];
}

/**
 * The W3CDTF profile of ISO 8601 (W3C Note, 1997): `YYYY`, `YYYY-MM`,
 * `YYYY-MM-DD`, then `Thh:mm[:ss[.s]]TZD`. A value that does not match gets
 * no scheme — asserting one would be a claim the source never made.
 */
const W3CDTF = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;

function sesApplies(ses: string | undefined, v: DcValue): string | undefined {
  if (ses === undefined) return undefined;
  if (ses === "W3CDTF" && !W3CDTF.test(v.value)) return undefined;
  return ses;
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

/**
 * The document's OWN inline context — nothing is fetched to read it
 * (voice: `ld-no-context-fetched-at-run-time`), and `@base`, when present, is
 * here rather than in a remote context that would be ignored
 * (`ld-no-base-in-a-remote-context`).
 *
 * The link-valued properties are TERMS with `"@type": "@id"`, and the
 * document uses the terms, never a prefixed key — a compact-IRI key does not
 * inherit a term's coercion (`ld-coercion-belongs-to-the-term`).
 */
export function dcJsonLdContext(base?: string): Record<string, unknown> {
  const ctx: Record<string, unknown> = { "@version": 1.1 };
  if (base !== undefined) ctx["@base"] = base;
  return {
    ...ctx,
    dcterms: DCTERMS_NS,
    dc: DC_ELEMENTS_NS,
    dcam: DCAM_NS,
    rdf: RDF_NS,
    dspace: DSPACE_NS,
    value: { "@id": `${RDF_NS}value` },
    memberOf: { "@id": `${DCAM_NS}memberOf`, "@type": "@id" },
    authority: { "@id": `${DSPACE_NS}authority`, "@type": "@id" },
  };
}

type Literal = { "@value": string; "@language"?: string; "@type"?: string };


function literal(v: DcValue, ses: string | undefined): Literal {
  const out: Literal = { "@value": v.value };
  const s = sesApplies(ses, v);
  // A typed literal may not carry a language: JSON-LD forbids both on one
  // value object. A scheme the field name asserts wins, because it says what
  // the string IS; the language tag on an ISO date says nothing about it.
  if (s !== undefined) out["@type"] = `${DCTERMS_NS}${s}`;
  else if (v.language !== undefined) out["@language"] = bcp47(v.language);
  return out;
}

function jsonLdValue(v: DcValue, m: DctermsMapping | undefined): Record<string, unknown> {
  const lit = literal(v, m?.ses);
  const resource = m?.range === "resource" || v.authority !== undefined;
  if (!resource) return lit;
  const node: Record<string, unknown> = { value: lit };
  if (m?.ves !== undefined) node.memberOf = `${DCTERMS_NS}${m.ves}`;
  if (v.authority !== undefined) node.authority = v.authority;
  return node;
}

/**
 * The subject of a rendering: the item at its Handle when the catalogue
 * records one (relative to an inline `@base` of the Handle resolver), else
 * the record's own minted id, absolute — never a guess at a Handle.
 */
export interface DcSubject {
  handle?: string;
}

function compactPredicate(iri: string): string {
  if (iri.startsWith(DSPACE_NS)) return `dspace:${iri.slice(DSPACE_NS.length)}`;
  if (iri.startsWith(DC_ELEMENTS_NS)) return `dc:${iri.slice(DC_ELEMENTS_NS.length)}`;
  return iri;
}

/** Render one record as a DCMI-Terms JSON-LD document. Deterministic: same record, same bytes. */
export function dublinCoreToDcterms(rec: DublinCoreRecord, subject: DcSubject = {}): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    "@context": dcJsonLdContext(subject.handle !== undefined ? HANDLE_RESOLVER : undefined),
    "@id": subject.handle ?? `${DSPACE_NS}item/${rec.id}`,
  };
  const byKey = new Map<string, Record<string, unknown>[]>();
  for (const f of rec.fields) {
    const m = dctermsFor(f);
    // Compacted against the inline context's prefixes so a reader sees
    // `dspace:dc.title.release` beside `dcterms:title`; expansion gives the
    // same absolute IRI {@link dcPredicate} does.
    const key = m ? `dcterms:${m.term}` : compactPredicate(dcPredicate(f));
    const acc = byKey.get(key) ?? [];
    acc.push(...f.values.map((v) => jsonLdValue(v, m)));
    byKey.set(key, acc);
  }
  for (const [k, vs] of byKey) doc[k] = vs;
  return doc;
}

/** The serialised file: two-space JSON and a trailing newline, so `--check` compares bytes. */
export function renderDcJsonLd(rec: DublinCoreRecord, subject: DcSubject = {}): string {
  return `${JSON.stringify(dublinCoreToDcterms(rec, subject), null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

function xmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** XML comment text may not contain `--`. */
function commentEsc(s: string): string {
  return s.replace(/-{2,}/g, (m) => m.split("").join(" "));
}

/**
 * Render one record as Dublin Core XML, per DCMI's *Guidelines for
 * implementing Dublin Core in XML* (2003-04-02): `dc:` and `dcterms:`
 * elements under one container, `xml:lang` for a value's language, and
 * `xsi:type="dcterms:<Scheme>"` for an encoding scheme.
 *
 * The container is `metadata` in the content layer's DSpace namespace — the
 * guidelines leave the container to the implementer and ask only that it be
 * namespaced.
 */
export function renderDcXml(rec: DublinCoreRecord): string {
  const lines: string[] = [];
  const omitted: string[] = [];
  for (const f of rec.fields) {
    const name = dcFieldName(f);
    const m = dctermsFor(f);
    let el: string;
    let note = "";
    if (m) el = `dcterms:${m.term}`;
    else if (f.schema === "dc" && SIMPLE_ELEMENTS.has(f.element)) {
      el = `dc:${f.element}`;
      note = ` <!-- ${commentEsc(name)} -->`;
    } else {
      if (!omitted.includes(name)) omitted.push(name);
      continue;
    }
    for (const v of f.values) {
      const attrs: string[] = [];
      const s = sesApplies(m?.ses, v) ?? m?.ves;
      if (s !== undefined) attrs.push(`xsi:type="dcterms:${s}"`);
      if (v.language !== undefined) attrs.push(`xml:lang="${xmlEsc(bcp47(v.language))}"`);
      const a = attrs.length ? ` ${attrs.join(" ")}` : "";
      lines.push(`  <${el}${a}>${xmlEsc(v.value)}</${el}>${note}`);
    }
  }
  const head = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- Dublin Core rendering of ${commentEsc(rec.id)}, generated by folio-assistant-core/scripts/dc-render.ts. Do not edit. -->`,
  ];
  if (omitted.length) {
    head.push(`<!-- not expressible as DC XML (no DCMI element): ${commentEsc(omitted.join(", "))} -->`);
  }
  head.push(
    `<metadata xmlns="${DSPACE_NS}"`,
    `    xmlns:dc="${DC_ELEMENTS_NS}"`,
    `    xmlns:dcterms="${DCTERMS_NS}"`,
    `    xmlns:xsi="${XSI_NS}">`,
  );
  return `${[...head, ...lines, "</metadata>"].join("\n")}\n`;
}
