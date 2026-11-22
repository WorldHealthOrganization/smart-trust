/**
 * `folio-reference/v1`: one bibliographic reference, as a KG node (bean
 * folio-assistant-63q4).
 *
 * ## Why a node
 *
 * Every `\cite{key}` already becomes `cito:cites` → `references/<key>`
 * (cat-harness `resolveReferenceKey`), and until now nothing was ever written
 * at that IRI: every citation in the KG dangled. A reference node is what is
 * there. It is also what a bibliography viewer lists and exports, path by path,
 * the way the glossary lists terms.
 *
 * @module schemas/reference
 * @graphNode schema
 *
 * ## The body is CSL-JSON, and the node reads as Dublin Core
 *
 * Owner, 2026-10-14, on aligning qou's bibliography: *"1 + 2"*. Keep CSL-JSON
 * as the source (qou's 915 entries, and the LaTeX/BibTeX pipeline built on
 * them), one entry per node. CSL-JSON is the citation format: it carries the
 * volume, issue, page and series that mathematics needs and that Dublin Core
 * has no fields for. Dublin Core is how the node READS: {@link referenceToJsonLd}
 * maps the CSL fields to `dcterms:` and `bibo:` predicates, so every reference,
 * from whatever source, is also a DC description.
 *
 * ## Where a reference comes from
 *
 * One node type for every source, said by {@link ReferenceProvenance}:
 * - `authored`: a folio's own bibliography entry (qou's `references.ts`, then its per-entry files);
 * - `catalogue`: projected from a catalogue's Dublin Core record ({@link dublinCoreToReference}),
 *   e.g. an item of the IRIS catalogue layer;
 * - `library`: a library asset's own manifest;
 * - `extracted`: one entry of a paper's reference list, split out of its references section.
 *
 * Core's, by core's rule: a reference describes what a folio HOLDS or CITES
 * and where it CAME FROM. Not the harness's.
 *
 * Exports: {@link toCslJson}, {@link toBibtex}, {@link toRis}, {@link toJsonLdGraph}.
 *
 * Its fields are CSL-JSON's (no external-schema record names CSL-JSON yet).
 * The tag reader takes ONE spec id per line, so each is its own tag: the
 * comma-separated form declared none of them.
 *
 * @module folio-assistant-core/schemas/reference
 * @conformsTo dcmi-terms
 * @conformsTo purl-bibo
 * @conformsTo spar-fabio
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import { nodeKind } from "@litlfred/cat-harness-tools/schemas/kg/node-kind.ts";
import { readStructure } from "@litlfred/cat-harness-tools/schemas/content/document-structure.ts";
import { FOLIO_BASE, resolveReferenceKey } from "@litlfred/cat-harness-tools/schemas/kg/jsonld.ts";
import { safeHref } from "@litlfred/cat-harness-tools/schemas/ui/safe-url.ts";
import { cslToBibtex } from "@litlfred/cat-harness-tools/pipeline/bibtex-format.ts";
import {
  authorNames,
  issuedYear,
  referenceDirs,
  referenceEntries,
  stringField,
  type ReferenceEntry,
} from "@litlfred/cat-harness-tools/pipeline/reference-entries.ts";
import {
  DC_ELEMENTS_NS,
  DCTERMS_NS,
  DSPACE_NS,
  DUBLIN_CORE_SCHEMA_TAG,
  dcValues,
  type DcField,
  type DublinCoreRecord,
} from "./dublin-core.ts";
import { XSI_NS, renderDcXml } from "./dublin-core-render.ts";

export const REFERENCE_SCHEMA_TAG = "folio-reference/v1" as const;

/** A citation key: what `\cite{…}` names and what `references/<key>` ends in. */
export const ReferenceKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:+-]*$/, {
  message: "a reference key is letters, digits and . _ : + - (no spaces, slashes or #), starting with a letter or digit",
});

/** A CSL-JSON name. Either structured, or `literal` for an organisation. */
const CslNameSchema = z
  .object({ family: z.string().optional(), given: z.string().optional(), literal: z.string().optional() })
  .passthrough();
export type CslName = z.infer<typeof CslNameSchema>;

/** A CSL-JSON date: `date-parts` (`[[2004]]`, `[[2014, 12, 18]]`) or a `raw`/`literal` string. */
const CslDateSchema = z
  .object({
    "date-parts": z.array(z.array(z.union([z.number(), z.string()])).min(1)).min(1).optional(),
    raw: z.string().optional(),
    literal: z.string().optional(),
  })
  .passthrough();

/**
 * One place a work can be read: its publisher's page, a repository record
 * (a DSpace handle), a code forge, a pinned copy, a DOI or arXiv landing page.
 * A reference lists every one it knows; {@link sourcesOf} adds the ones its
 * CSL fields already imply.
 */
export const ReferenceSourceSchema = z
  .object({
    url: z.string().min(1),
    /** What a reader sees for the link. */
    label: z.string().min(1).optional(),
    /** What kind of place it is: `canonical`, `repository`, `pinned`, `handle`, `doi`, `arxiv`, `mirror`. */
    kind: z.string().min(1).optional(),
  })
  .strict();
export type ReferenceSource = z.infer<typeof ReferenceSourceSchema>;

export const ReferenceProvenanceSchema = z.enum(["authored", "catalogue", "library", "extracted"]);
export type ReferenceProvenance = z.infer<typeof ReferenceProvenanceSchema>;

/**
 * A reference node: a CSL-JSON item (`id` is the key) plus what places it in
 * the KG. Unknown CSL fields pass through: the spec has more than a hundred,
 * and qou uses `series`, `note` and others the `csl-json` typing omits.
 */
export const ReferenceNodeSchema = z
  .object({
    $schema: z.literal(REFERENCE_SCHEMA_TAG),
    id: ReferenceKeySchema,
    type: z.string().min(1),
    title: z.string().min(1).optional(),
    author: z.array(CslNameSchema).optional(),
    editor: z.array(CslNameSchema).optional(),
    issued: CslDateSchema.optional(),
    "container-title": z.string().optional(),
    publisher: z.string().optional(),
    volume: z.union([z.string(), z.number()]).optional(),
    issue: z.union([z.string(), z.number()]).optional(),
    page: z.string().optional(),
    DOI: z.string().optional(),
    ISBN: z.string().optional(),
    URL: z.string().optional(),
    language: z.string().optional(),
    abstract: z.string().optional(),
    /** Where the reference came from. Absent means `authored`. */
    provenance: ReferenceProvenanceSchema.optional(),
    /** The asset it was taken from: a DC record, a library manifest, a paper's references section. Repo-relative path or IRI. */
    derivedFrom: z.string().min(1).optional(),
    /** The library asset that holds a copy of the work, when one is held. Repo-relative path or IRI. */
    heldAt: z.string().min(1).optional(),
    /**
     * The entry exactly as the citing document prints it, when no citation
     * style reproduces that wording (a committee's own short form, two works
     * in one entry). A reference list drawn from the node
     * (`scripts/references-render.ts`) prints this text verbatim instead of
     * formatting the CSL fields, so the KG stays the one source without
     * changing a word. Not CSL: dropped from CSL-JSON exports.
     */
    printed: z.string().min(1).optional(),
    /** Every place the work can be read, beyond `URL`: alternates, mirrors, repository records. Not CSL. */
    sources: z.array(ReferenceSourceSchema).optional(),
  })
  .passthrough();
export type ReferenceNode = z.infer<typeof ReferenceNodeSchema>;

/**
 * `folio-reference/v1` as a node kind (issue #2195), so `validators/reference.json`
 * names a kind and `node-kinds:check` files the family under it. Unversioned: the family's tag is not SemVer, so the `$schema` literal stays a
 * field of the shape rather than one `nodeKind()` generates.
 * Not strict: unknown CSL fields pass, as {@link ReferenceNodeSchema} lets them.
 */
export const ReferenceKind = nodeKind("folio-reference", [], ReferenceNodeSchema.shape);

/**
 * The path segment of a reference's own page: `<bibliography>/<sub-graph>/<segment>/`,
 * a slash address with no `#` (owner, 2026-11-08: "a bib entry is a node in
 * the KG"; clean break from the `#ref-<key>` anchors). The key, with the
 * characters a path segment should not carry (`:` `+`) as `-`.
 */
export const referenceSegment = (key: string): string => key.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^\.+/, "");

/** The KG IRI of a reference: `references/<key>`, the one `\cite` already points at. */
export const referenceIri = (key: string): string => resolveReferenceKey(key);

/**
 * Every place a reference says its work can be read, in the order a reader
 * wants them: `URL`, the DOI and arXiv landing pages, then the node's own
 * `sources`. One entry per address; nothing is guessed from a title.
 */
export function sourcesOf(ref: ReferenceNode): ReferenceSource[] {
  const out: ReferenceSource[] = [];
  const seen = new Set<string>();
  const add = (s: ReferenceSource) => {
    const k = s.url.replace(/\/+$/, "");
    if (seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };
  const doiUrl = ref.DOI ? `https://doi.org/${ref.DOI}` : undefined;
  if (ref.URL && !(ref.DOI && ref.URL.includes(ref.DOI))) add({ url: ref.URL, kind: "canonical" });
  if (doiUrl) add({ url: doiUrl, label: `doi:${ref.DOI}`, kind: "doi" });
  const note = typeof ref.note === "string" ? ref.note : "";
  const arxiv = /\barXiv:\s*([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?|[a-z-]+(?:\.[A-Z]{2})?\/[0-9]{7})/.exec(note)?.[1];
  if (arxiv) add({ url: `https://arxiv.org/abs/${arxiv}`, label: `arXiv:${arxiv}`, kind: "arxiv" });
  for (const s of ref.sources ?? []) add(s);
  return out;
}

/** The fields that are the node's and not CSL's. Dropped from a CSL-JSON export. */
const NODE_FIELDS = new Set([
  "$schema",
  "@context",
  "@id",
  "@type",
  "provenance",
  "derivedFrom",
  "heldAt",
  "printed",
  "sources",
  "library",
  "_comment",
  "_generated",
]);

/** The CSL-JSON item a node carries, as a citation processor reads it. */
export function toCslItem(ref: ReferenceNode): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(ref).filter(([k]) => !NODE_FIELDS.has(k) && !k.startsWith("@") && !/^(dcterms|bibo|fabio):/.test(k)),
  );
}

// ── Reading a name and a date ────────────────────────────────────────────────

/** A display name: `Family, Given`, or the literal. */
export function nameText(n: CslName): string {
  if (n.literal) return n.literal;
  return [n.family, n.given].filter(Boolean).join(", ");
}

/** The year, or undefined. */
export function yearOf(ref: Pick<ReferenceNode, "issued">): string | undefined {
  const p = ref.issued?.["date-parts"]?.[0]?.[0];
  if (p !== undefined && String(p).trim()) return String(p);
  const m = /\b(\d{4})\b/.exec(ref.issued?.raw ?? ref.issued?.literal ?? "");
  return m?.[1];
}

/** ISO-ish date text (`2014`, `2014-12`, `2014-12-18`), or undefined. */
export function dateText(ref: Pick<ReferenceNode, "issued">): string | undefined {
  const parts = ref.issued?.["date-parts"]?.[0];
  if (parts?.length) return parts.map((p, i) => (i === 0 ? String(p) : String(p).padStart(2, "0"))).join("-");
  return ref.issued?.raw ?? ref.issued?.literal;
}

// ── JSON-LD: the node read as Dublin Core and BIBO ───────────────────────────

/**
 * The context a reference's JSON-LD uses.
 *
 * `@base` is the folio's, so `"@id": "references/<key>"` expands to the same
 * IRI as a content block's `cito:cites` (resolved against
 * `CONTENT_DOCUMENT_CONTEXT`'s `@base`). Without it the node and the
 * citations naming it expanded against wherever the export was served, and
 * never joined. `dcterms:source` and `dcterms:hasVersion` name assets, so they
 * are coerced to IRIs rather than read as strings.
 */
export const REFERENCE_CONTEXT = {
  "@base": FOLIO_BASE,
  dcterms: "http://purl.org/dc/terms/",
  bibo: "http://purl.org/ontology/bibo/",
  fabio: "http://purl.org/spar/fabio/",
  "dcterms:source": { "@type": "@id" },
  "dcterms:hasVersion": { "@type": "@id" },
} as const;

/** CSL `type` → BIBO class. A type not here is a `bibo:Document`. */
export const BIBO_CLASS: Readonly<Record<string, string>> = {
  "article-journal": "bibo:AcademicArticle",
  article: "bibo:Article",
  "article-magazine": "bibo:Article",
  "article-newspaper": "bibo:Article",
  book: "bibo:Book",
  chapter: "bibo:Chapter",
  "paper-conference": "bibo:AcademicArticle",
  report: "bibo:Report",
  thesis: "bibo:Thesis",
  webpage: "bibo:Webpage",
  manuscript: "bibo:Manuscript",
  standard: "bibo:Standard",
  legislation: "bibo:Legislation",
};

/**
 * The node as JSON-LD: `@id` is `references/<key>`, `@type` is `fabio:Work`
 * plus the BIBO class, and every property is a Dublin Core or BIBO term. A
 * reader that wants the citation data whole takes the CSL-JSON export
 * ({@link toCslJson}); this is the description, not the citation.
 */
export function referenceToJsonLd(ref: ReferenceNode): Record<string, unknown> {
  const out: Record<string, unknown> = {
    "@context": REFERENCE_CONTEXT,
    "@id": referenceIri(ref.id),
    "@type": ["fabio:Work", BIBO_CLASS[ref.type] ?? "bibo:Document"],
  };
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return;
    out[k] = v;
  };
  set("dcterms:title", ref.title);
  set("dcterms:creator", ref.author?.map(nameText));
  set("bibo:editor", ref.editor?.map(nameText));
  set("dcterms:issued", dateText(ref));
  set("dcterms:publisher", ref.publisher);
  set("dcterms:isPartOf", ref["container-title"]);
  set("bibo:volume", ref.volume === undefined ? undefined : String(ref.volume));
  set("bibo:issue", ref.issue === undefined ? undefined : String(ref.issue));
  set("bibo:pages", ref.page);
  set("bibo:doi", ref.DOI);
  set("bibo:isbn", ref.ISBN);
  set("dcterms:identifier", ref.URL);
  set("dcterms:language", ref.language);
  set("dcterms:abstract", ref.abstract);
  set("dcterms:source", ref.derivedFrom);
  set("dcterms:hasVersion", ref.heldAt);
  return out;
}

// ── Dublin Core → reference ──────────────────────────────────────────────────

/** DC `type` values → CSL type. A record with none is a `document`. */
const DC_TYPE_TO_CSL: Readonly<Record<string, string>> = {
  book: "book",
  "book chapter": "chapter",
  article: "article-journal",
  "journal article": "article-journal",
  report: "report",
  "technical report": "report",
  thesis: "thesis",
  "web page": "webpage",
  webpage: "webpage",
  standard: "standard",
  legislation: "legislation",
  document: "document",
  "technical documents": "report",
  publications: "book",
};

/** A `dc.type` already spelled as the CSL type it maps to, as {@link referenceToDublinCoreRecord} writes it. */
const CSL_TYPES_FROM_DC: ReadonlySet<string> = new Set(Object.values(DC_TYPE_TO_CSL));

/**
 * A DC creator as a CSL name. `Family, Given` splits on the first comma, which
 * is how DSpace stores a person. A name with no comma is an organisation's,
 * and stays whole as `literal`: "World Health Organization" has no family name.
 */
export function dcCreatorToName(value: string): CslName {
  const i = value.indexOf(",");
  if (i < 0) return { literal: value.trim() };
  const family = value.slice(0, i).trim();
  const given = value.slice(i + 1).trim();
  return given ? { family, given } : { literal: family };
}

/** `2014-12-18`, `2014-12`, `2014` → CSL `date-parts`. Anything else → `raw`. */
export function dcDateToCsl(value: string): NonNullable<ReferenceNode["issued"]> {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(value.trim());
  if (!m) return { raw: value };
  return { "date-parts": [[m[1], m[2], m[3]].filter((x): x is string => !!x).map(Number)] };
}

/**
 * A Dublin Core record as a reference node. The key is the caller's: the
 * record's own `id` is a repository UUID, not something a reader cites.
 * Only what the record states is carried. Nothing is inferred, and a field
 * the record lacks is absent here too.
 */
export function dublinCoreToReference(
  rec: DublinCoreRecord,
  opts: { key: string; derivedFrom?: string; heldAt?: string },
): ReferenceNode {
  const all = (element: string, qualifier?: string) => dcValues(rec, element, qualifier).map((v) => v.value);
  const first = (element: string, qualifier?: string) => all(element, qualifier)[0];
  const dcType = first("type")?.toLowerCase();
  const ref: ReferenceNode = {
    $schema: REFERENCE_SCHEMA_TAG,
    id: opts.key,
    type:
      (dcType && (DC_TYPE_TO_CSL[dcType] ?? (CSL_TYPES_FROM_DC.has(dcType) ? dcType : undefined))) ??
      (all("identifier", "isbn").length ? "book" : "document"),
    provenance: "catalogue",
  };
  const put = <K extends keyof ReferenceNode>(k: K, v: ReferenceNode[K] | undefined) => {
    if (v !== undefined && !(Array.isArray(v) && !v.length)) ref[k] = v;
  };
  put("title", first("title"));
  put("author", all("contributor", "author").map(dcCreatorToName));
  put("editor", all("contributor", "editor").map(dcCreatorToName));
  const issued = first("date", "issued");
  put("issued", issued ? dcDateToCsl(issued) : undefined);
  put("publisher", first("publisher"));
  // A journal article's container and locators: qualified DC as DSpace stores
  // them (`dc.relation.ispartof`, `dc.citation.*`), so a work that is no
  // library entry (bean djj5) can be cited from its record alone.
  put("container-title", first("relation", "ispartof"));
  put("volume", first("citation", "volume"));
  put("issue", first("citation", "issue"));
  const spage = first("citation", "spage");
  const epage = first("citation", "epage");
  put("page", spage ? (epage ? `${spage}–${epage}` : spage) : undefined);
  // Pass-through CSL fields the IGs' entries carry (bean djj5): CSL keeps them,
  // and the node accepts any CSL field.
  const extra = ref as Record<string, unknown>;
  const place = first("publisher", "place");
  if (place) extra["publisher-place"] = place;
  const accessed = first("date", "accessed");
  if (accessed) extra.accessed = dcDateToCsl(accessed);
  const version = first("citation", "version");
  if (version) extra.version = version;
  const status = first("citation", "status");
  if (status) extra.status = status;
  put("ISBN", first("identifier", "isbn"));
  put("DOI", first("identifier", "doi"));
  put("URL", first("identifier", "uri"));
  // Every handle the record carries (a legacy one kept after a server merge
  // too), and the repository record it was read from: the DSpace links.
  const recSources: ReferenceSource[] = all("identifier", "uri")
    .slice(1)
    .map((url) => ({ url, kind: "handle" }));
  const from = rec.provenance?.source;
  if (typeof from === "string" && /^https?:\/\//.test(from)) recSources.push({ url: from, label: "repository record", kind: "repository" });
  put("sources", recSources.length ? recSources : undefined);
  put("language", first("language", "iso") ?? first("language"));
  put("abstract", first("description", "abstract"));
  put("derivedFrom", opts.derivedFrom);
  put("heldAt", opts.heldAt);
  return ReferenceNodeSchema.parse(ref);
}

// ── Exports ──────────────────────────────────────────────────────────────────

/** CSL-JSON: an array of items, as citeproc, Zotero and pandoc read it. */
export function toCslJson(refs: readonly ReferenceNode[]): string {
  return `${JSON.stringify(refs.map(toCslItem), null, 2)}\n`;
}

/** BibTeX, through the same formatter `export-bibtex` writes `references.bib` with. */
export function toBibtex(refs: readonly ReferenceNode[]): string {
  return refs.map((r) => cslToBibtex(toCslItem(r) as Parameters<typeof cslToBibtex>[0])).join("\n\n") + (refs.length ? "\n" : "");
}

/** CSL type → RIS `TY`. */
const RIS_TYPE: Readonly<Record<string, string>> = {
  "article-journal": "JOUR",
  article: "JOUR",
  "article-magazine": "MGZN",
  "article-newspaper": "NEWS",
  book: "BOOK",
  chapter: "CHAP",
  "paper-conference": "CPAPER",
  report: "RPRT",
  thesis: "THES",
  webpage: "ELEC",
  manuscript: "UNPB",
  standard: "STAND",
};

/** RIS, one record per reference, as EndNote, Zotero and Mendeley import it. */
export function toRis(refs: readonly ReferenceNode[]): string {
  const rec = (r: ReferenceNode): string => {
    const lines: string[] = [`TY  - ${RIS_TYPE[r.type] ?? "GEN"}`, `ID  - ${r.id}`];
    const add = (tag: string, v: unknown) => {
      if (v !== undefined && v !== "") lines.push(`${tag}  - ${String(v).replace(/\s*\n\s*/g, " ")}`);
    };
    for (const a of r.author ?? []) add("AU", nameText(a));
    for (const e of r.editor ?? []) add("ED", nameText(e));
    add("TI", r.title);
    add("T2", r["container-title"]);
    add("PY", yearOf(r));
    add("DA", dateText(r)?.replace(/-/g, "/"));
    add("PB", r.publisher);
    add("VL", r.volume);
    add("IS", r.issue);
    const [sp, ep] = (r.page ?? "").split(/[-–]/);
    add("SP", sp?.trim() || undefined);
    add("EP", ep?.trim() || undefined);
    add("DO", r.DOI);
    add("SN", r.ISBN);
    add("UR", r.URL);
    add("LA", r.language);
    add("AB", r.abstract);
    lines.push("ER  - ");
    return lines.join("\r\n");
  };
  return refs.map(rec).join("\r\n\r\n") + (refs.length ? "\r\n" : "");
}

/** Dublin Core / BIBO JSON-LD: every reference as one `@graph`. */
export function toJsonLdGraph(refs: readonly ReferenceNode[]): string {
  const graph = refs.map((r) => {
    const { "@context": _c, ...rest } = referenceToJsonLd(r);
    return rest;
  });
  return `${JSON.stringify({ "@context": REFERENCE_CONTEXT, "@graph": graph }, null, 2)}\n`;
}

// ── Reference → Dublin Core XML (via 7eak's renderDcXml) ─────────────────────

/**
 * Convert a {@link ReferenceNode} to a {@link DublinCoreRecord} so it can be
 * rendered through `7eak`'s {@link renderDcXml}.
 */
export function referenceToDublinCoreRecord(ref: ReferenceNode): DublinCoreRecord {
  const fields: DcField[] = [];
  const lang = ref.language;
  const push = (element: string, qualifier: string | undefined, values: (string | undefined)[], tagged = false) => {
    const clean = values.map((v) => v?.trim()).filter((v): v is string => !!v);
    if (!clean.length) return;
    fields.push({
      schema: "dc",
      element,
      ...(qualifier ? { qualifier } : {}),
      values: clean.map((value) => (tagged && lang ? { value, language: lang } : { value })),
    });
  };
  push("title", undefined, [ref.title ?? ref.id], true);
  push("contributor", "author", (ref.author ?? []).map(nameText));
  push("contributor", "editor", (ref.editor ?? []).map(nameText));
  push("date", "issued", [dateText(ref)]);
  push("publisher", undefined, [ref.publisher]);
  const csl = ref as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : undefined);
  push("publisher", "place", [str(csl["publisher-place"])]);
  push("date", "accessed", [csl.accessed ? dateText({ issued: csl.accessed as ReferenceNode["issued"] }) : undefined]);
  push("citation", "version", [str(csl.version)]);
  push("citation", "status", [str(csl.status)]);
  push("relation", "ispartof", [ref["container-title"]]);
  push("citation", "volume", [ref.volume === undefined ? undefined : String(ref.volume)]);
  push("citation", "issue", [ref.issue === undefined ? undefined : String(ref.issue)]);
  const [spage, epage] = (ref.page ?? "").split(/\s*[–-]\s*/, 2);
  push("citation", "spage", [spage]);
  push("citation", "epage", [epage]);
  push("identifier", "doi", [ref.DOI]);
  push("identifier", "isbn", [ref.ISBN]);
  push("identifier", "uri", [ref.URL ?? (ref.DOI ? `https://doi.org/${ref.DOI}` : undefined)]);
  push("language", "iso", [ref.language]);
  push("description", "abstract", [ref.abstract], true);
  push("type", undefined, [ref.type]);
  return {
    $schema: DUBLIN_CORE_SCHEMA_TAG,
    id: ref.id,
    fields,
    provenance: {
      source: ref.derivedFrom ?? referenceIri(ref.id),
      retrievedAt: dateText(ref) ?? "1970-01-01",
      method: ref.provenance ?? "authored",
    },
  };
}

/**
 * Dublin Core XML export (`references.dc.xml`), reusing `7eak`'s
 * {@link renderDcXml}. A single reference renders as one `<metadata>` document;
 * multiple references render as `<records>` wrapping each record's `<metadata>`.
 */
export function toDublinCoreXml(refs: readonly ReferenceNode[]): string {
  if (refs.length === 1) return renderDcXml(referenceToDublinCoreRecord(refs[0]!));
  const body = refs
    .map((r) => {
      const xml = renderDcXml(referenceToDublinCoreRecord(r))
        .replace(/^<\?xml[^?]*\?>\n/, "")
        .trimEnd();
      return xml
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n");
    })
    .join("\n");
  const head = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<records xmlns="${DSPACE_NS}"`,
    `    xmlns:dc="${DC_ELEMENTS_NS}"`,
    `    xmlns:dcterms="${DCTERMS_NS}"`,
    `    xmlns:xsi="${XSI_NS}">`,
  ];
  return `${[...head, ...(body ? [body] : []), "</records>"].join("\n")}\n`;
}

// ── Library items → Reference nodes ──────────────────────────────────────────

const ORG_KEYWORDS = /\b(organization|organisation|institute|university|consortium|commission|committee|ministry|department|agency|association|council|society|group|collaboration|foundation|press|bureau|center|centre)\b/i;

function oneAuthorToCslName(part: string): CslName {
  const s = part.trim().replace(/\s+/g, " ");
  if (!s) return { literal: s };
  if (ORG_KEYWORDS.test(s)) return { literal: s };
  if (s.includes(",")) return dcCreatorToName(s);
  const tokens = s.split(" ");
  if (tokens.length === 1) return { family: tokens[0]! };
  const family = tokens[tokens.length - 1]!;
  const given = tokens.slice(0, -1).join(" ");
  return { family, given };
}

/**
 * Parse an `authors_raw` string (from library document structure or PDF
 * `docinfo.Author`) into CSL-JSON author objects.
 */
export function authorsRawToNames(raw: string): CslName[] {
  const cleaned = raw.trim();
  if (!cleaned) return [];
  if (ORG_KEYWORDS.test(cleaned) && !cleaned.includes(";") && !/\band\b/i.test(cleaned)) {
    return [{ literal: cleaned }];
  }
  const chunks = cleaned.includes(";")
    ? cleaned.split(";")
    : /,/.test(cleaned) && !/\band\b/i.test(cleaned) && cleaned.split(",").length > 2
      ? cleaned.split(",")
      : cleaned.split(/\s*,?\s+\band\b\s+|\s*&\s*/i);
  const out: CslName[] = [];
  for (const chunk of chunks) {
    // Handle "A. Einstein, B. Podolsky" before the final "and N. Rosen"
    if (!cleaned.includes(";") && chunk.includes(",") && /\b[A-Z]\.\s*[A-Z]/.test(chunk)) {
      for (const sub of chunk.split(",")) {
        const t = sub.trim();
        if (t) out.push(oneAuthorToCslName(t));
      }
    } else {
      const t = chunk.trim();
      if (t) out.push(oneAuthorToCslName(t));
    }
  }
  return out;
}

/**
 * Project a library item directory (`library/<slug>/manifest.jsonld` +
 * document structure metadata) to a {@link ReferenceNode} with
 * `provenance: "library"`.
 */
export function libraryItemToReference(
  entryDir: string,
  opts: { key?: string; derivedFrom?: string; heldAt?: string } = {},
): ReferenceNode {
  const manifestPath = join(entryDir, "manifest.jsonld");
  let manifest: Record<string, unknown> = {};
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
    } catch {
      manifest = {};
    }
  }
  const structRes = readStructure(entryDir);
  const structure = "reason" in structRes ? undefined : structRes;
  const meta = (structure?.raw.metadata ?? {}) as {
    title?: string | null;
    title_correction?: { title?: string };
    authors_raw?: string | null;
    abstract?: string | null;
    doi?: string | null;
    arxiv?: string | { id?: string | null; date?: string | null } | null;
    docinfo?: Record<string, unknown>;
  };
  const docinfo = (meta.docinfo ?? {}) as Record<string, unknown>;
  const docinfoStr = (k: string): string | undefined =>
    typeof docinfo[k] === "string" && (docinfo[k] as string).trim() ? (docinfo[k] as string).trim() : undefined;

  const rawKey =
    opts.key ??
    (typeof manifest.docId === "string" && manifest.docId.trim()
      ? manifest.docId.trim()
      : structure?.doc_id?.trim() || basename(entryDir));
  const key = rawKey.replace(/[^A-Za-z0-9._:+-]/g, "-").replace(/^[^A-Za-z0-9]+/, "") || "library-item";

  const title =
    (meta.title_correction?.title?.trim() || undefined) ??
    (structure?.title?.trim() || undefined) ??
    (typeof manifest.title === "string" && manifest.title.trim() ? manifest.title.trim() : undefined) ??
    (typeof manifest["dcterms:title"] === "string" && (manifest["dcterms:title"] as string).trim()
      ? (manifest["dcterms:title"] as string).trim()
      : undefined) ??
    docinfoStr("Title");

  const authorsRaw = (typeof meta.authors_raw === "string" ? meta.authors_raw.trim() : "") || docinfoStr("Author") || "";
  const author = authorsRaw ? authorsRawToNames(authorsRaw) : undefined;

  const doi = typeof meta.doi === "string" && meta.doi.trim() ? meta.doi.trim() : undefined;
  const arxivObj = meta.arxiv;
  const arxivId =
    typeof arxivObj === "string"
      ? arxivObj.trim() || undefined
      : typeof arxivObj?.id === "string" && arxivObj.id.trim()
        ? arxivObj.id.trim()
        : undefined;
  const arxivDate =
    typeof arxivObj === "object" && arxivObj !== null && typeof arxivObj.date === "string" && arxivObj.date.trim()
      ? arxivObj.date.trim()
      : undefined;
  // A text source ingested from a forge names it (`source.upstream`): the
  // repository at its branch is where a reader goes, the commit is the copy
  // the library holds.
  const upstream = ((structure?.raw as { source?: { upstream?: unknown } } | undefined)?.source?.upstream ?? undefined) as
    | { repository?: string; commit?: string; ref?: string; path?: string }
    | undefined;
  const upstreamSources: ReferenceSource[] = [];
  if (upstream && typeof upstream.repository === "string" && /^https:\/\//.test(upstream.repository)) {
    const repo = upstream.repository.replace(/\/+$/, "").replace(/\.git$/, "");
    const path = typeof upstream.path === "string" && upstream.path !== "." ? upstream.path.replace(/^\.?\/+/, "") : "";
    const at = (rev: string) => `${repo}/${path ? (/\.[A-Za-z0-9]+$/.test(path) ? "blob" : "tree") : "tree"}/${encodeURIComponent(rev)}${path ? `/${path}` : ""}`;
    if (upstream.ref) upstreamSources.push({ url: at(upstream.ref), label: `${repo.replace(/^https:\/\/[^/]+\//, "")} at ${upstream.ref}`, kind: "repository" });
    else upstreamSources.push({ url: repo, kind: "repository" });
    if (upstream.commit) upstreamSources.push({ url: at(upstream.commit), label: `copy held (commit ${upstream.commit.slice(0, 7)})`, kind: "pinned" });
  }
  const sourceUrl =
    (typeof manifest.sourceUrl === "string" && manifest.sourceUrl.trim() ? manifest.sourceUrl.trim() : undefined) ??
    (arxivId ? `https://arxiv.org/abs/${arxivId}` : undefined) ??
    (doi ? `https://doi.org/${doi}` : undefined) ??
    upstreamSources[0]?.url;

  // Never `ingestedAt`: that is when the copy was made, not when the work was
  // published, and a bibliography that dates a 2004 paper 2026 is wrong
  // (bean djj5). No date is better than that one.
  const dateCandidate =
    arxivDate ||
    docinfoStr("CreationDate")?.slice(0, 10) ||
    (/\b((?:19|20)\d{2})\b/.exec(key)?.[1] ?? undefined);

  const ref: ReferenceNode = {
    $schema: REFERENCE_SCHEMA_TAG,
    id: key,
    type: arxivId || doi ? "article-journal" : "document",
    provenance: "library",
  };
  if (title) ref.title = title;
  if (author?.length) ref.author = author;
  if (dateCandidate) ref.issued = dcDateToCsl(dateCandidate);
  if (doi) ref.DOI = doi;
  if (sourceUrl) ref.URL = sourceUrl;
  if (typeof meta.abstract === "string" && meta.abstract.trim()) ref.abstract = meta.abstract.trim();
  if (arxivId) (ref as Record<string, unknown>).note = `arXiv:${arxivId}`;
  const more = upstreamSources.filter((s) => s.url !== sourceUrl);
  if (more.length) ref.sources = more;
  if (opts.derivedFrom) ref.derivedFrom = opts.derivedFrom;
  if (opts.heldAt) ref.heldAt = opts.heldAt;
  return ReferenceNodeSchema.parse(ref);
}

// ── gen-reference-jsonld: CSL-JSON → references/<key>.jsonld ─────────────────

/**
 * Convert a {@link ReferenceEntry} (from a `.json` file or `schema/references.ts`
 * `ref({…})` call) to a validated {@link ReferenceNode}.
 */
export function referenceEntryToNode(entry: ReferenceEntry): ReferenceNode {
  if (entry.kind === "file") {
    const raw = { ...entry.data };
    if (!raw.$schema) raw.$schema = REFERENCE_SCHEMA_TAG;
    if (!raw.type) raw.type = "document";
    return ReferenceNodeSchema.parse(raw);
  }
  const type = stringField(entry, "type") ?? "article";
  const title = stringField(entry, "title");
  const containerTitle = stringField(entry, "container-title");
  const publisher = stringField(entry, "publisher");
  const volume = stringField(entry, "volume");
  const issue = stringField(entry, "issue");
  const page = stringField(entry, "page");
  const DOI = stringField(entry, "DOI");
  const ISBN = stringField(entry, "ISBN");
  const URL = stringField(entry, "URL");
  const note = stringField(entry, "note");
  const year = issuedYear(entry);
  const fams = authorNames(entry);
  const ref: Record<string, unknown> = {
    $schema: REFERENCE_SCHEMA_TAG,
    id: entry.id,
    type,
    provenance: "authored",
  };
  if (title) ref.title = title;
  if (fams.length) ref.author = fams.map((f) => ({ family: f }));
  if (year) ref.issued = { "date-parts": [[Number(year)]] };
  if (containerTitle) ref["container-title"] = containerTitle;
  if (publisher) ref.publisher = publisher;
  if (volume) ref.volume = volume;
  if (issue) ref.issue = issue;
  if (page) ref.page = page;
  if (DOI) ref.DOI = DOI;
  if (ISBN) ref.ISBN = ISBN;
  if (URL) ref.URL = URL;
  if (note) ref.note = note;
  return ReferenceNodeSchema.parse(ref);
}

/**
 * Generate (or check with `{ check: true }`) `references/<key>.jsonld` files
 * from a folio's CSL-JSON bibliography (per-entry `references/<key>.json` files
 * and/or `<folio>/schema/references.ts`).
 */
export function genReferenceJsonLd(
  repoRoot: string,
  opts: { outDir?: string; check?: boolean } = {},
): { written: string[]; stale: string[] } {
  const entries = referenceEntries(repoRoot).filter((e) => !e.file.endsWith(".jsonld"));
  const targetDir =
    opts.outDir ??
    referenceDirs(repoRoot)[0] ??
    // declared-path-literal: the convention fallback for a WRITE target, when the
    // folio declares no `references` directory and has none yet: this generator
    // creates it, so resolving to nothing would make the first run impossible.
    join(repoRoot, "references");
  const written: string[] = [];
  const stale: string[] = [];
  if (!opts.check && entries.length > 0) {
    mkdirSync(targetDir, { recursive: true });
  }
  for (const e of entries) {
    const node = referenceEntryToNode(e);
    const jsonld = `${JSON.stringify(referenceToJsonLd(node), null, 2)}\n`;
    const outPath = join(targetDir, `${node.id}.jsonld`);
    if (opts.check) {
      if (!existsSync(outPath) || readFileSync(outPath, "utf-8") !== jsonld) {
        stale.push(outPath);
      }
    } else {
      writeFileSync(outPath, jsonld);
      written.push(outPath);
    }
  }
  return { written, stale };
}

// ── Standalone reference creation from the bibliography viewer (✍) ──────────

/** Input fields for creating a standalone reference node (`references/<key>.jsonld`) from the viewer. */
export interface StandaloneReferenceInput {
  id?: string;
  key?: string;
  title?: string;
  type?: string;
  authors?: string | readonly (string | CslName)[];
  issued?: string | number | NonNullable<ReferenceNode["issued"]>;
  DOI?: string;
  URL?: string;
  ISBN?: string;
  arXiv?: string;
  containerTitle?: string;
  "container-title"?: string;
  publisher?: string;
  volume?: string | number;
  issue?: string | number;
  page?: string;
  language?: string;
  abstract?: string;
  note?: string;
  provenance?: ReferenceProvenance;
  /** Optional raw BibTeX or CSL-JSON / JSON-LD text to parse before applying explicit fields. */
  raw?: string;
}

const BIBTEX_TYPE_TO_CSL: Readonly<Record<string, string>> = {
  article: "article-journal",
  book: "book",
  booklet: "book",
  inbook: "chapter",
  incollection: "chapter",
  inproceedings: "paper-conference",
  conference: "paper-conference",
  proceedings: "book",
  techreport: "report",
  report: "report",
  mastersthesis: "thesis",
  phdthesis: "thesis",
  thesis: "thesis",
  unpublished: "manuscript",
  manual: "report",
  online: "webpage",
  electronic: "webpage",
  webpage: "webpage",
  misc: "document",
};

const BIBO_TO_CSL_TYPE: Readonly<Record<string, string>> = {
  "bibo:AcademicArticle": "article-journal",
  "bibo:Article": "article",
  "bibo:Book": "book",
  "bibo:Chapter": "chapter",
  "bibo:Report": "report",
  "bibo:Thesis": "thesis",
  "bibo:Webpage": "webpage",
  "bibo:Manuscript": "manuscript",
  "bibo:Standard": "standard",
  "bibo:Legislation": "legislation",
};

/**
 * Normalise a standalone `.jsonld` reference object (whether pure JSON-LD from
 * {@link referenceToJsonLd} or a combined `folio-reference/v1` + JSON-LD node
 * from {@link buildStandaloneReference}) into a validated {@link ReferenceNode}.
 */
export function jsonLdToReferenceNode(raw: Record<string, unknown>): ReferenceNode {
  const out: Record<string, unknown> = { ...raw, $schema: REFERENCE_SCHEMA_TAG };
  if (typeof out.id !== "string" && typeof raw["@id"] === "string") {
    out.id = (raw["@id"] as string).replace(/^references\//, "");
  }
  if (typeof out.type !== "string") {
    const types = Array.isArray(raw["@type"]) ? (raw["@type"] as unknown[]) : typeof raw["@type"] === "string" ? [raw["@type"]] : [];
    const bibo = types.find((t): t is string => typeof t === "string" && t in BIBO_TO_CSL_TYPE);
    out.type = (bibo ? BIBO_TO_CSL_TYPE[bibo] : undefined) ?? "document";
  }
  if (typeof out.title !== "string" && typeof raw["dcterms:title"] === "string") {
    out.title = raw["dcterms:title"];
  }
  if (!Array.isArray(out.author) && Array.isArray(raw["dcterms:creator"])) {
    out.author = (raw["dcterms:creator"] as unknown[])
      .filter((c): c is string => typeof c === "string")
      .map(dcCreatorToName);
  }
  if (out.issued === undefined && typeof raw["dcterms:issued"] === "string") {
    out.issued = dcDateToCsl(raw["dcterms:issued"] as string);
  }
  if (typeof out["container-title"] !== "string" && typeof raw["dcterms:isPartOf"] === "string") {
    out["container-title"] = raw["dcterms:isPartOf"];
  }
  if (typeof out.publisher !== "string" && typeof raw["dcterms:publisher"] === "string") {
    out.publisher = raw["dcterms:publisher"];
  }
  if (out.volume === undefined && typeof raw["bibo:volume"] === "string") {
    out.volume = raw["bibo:volume"];
  }
  if (out.issue === undefined && typeof raw["bibo:issue"] === "string") {
    out.issue = raw["bibo:issue"];
  }
  if (typeof out.page !== "string" && typeof raw["bibo:pages"] === "string") {
    out.page = raw["bibo:pages"];
  }
  if (typeof out.DOI !== "string" && typeof raw["bibo:doi"] === "string") {
    out.DOI = raw["bibo:doi"];
  }
  if (typeof out.ISBN !== "string" && typeof raw["bibo:isbn"] === "string") {
    out.ISBN = raw["bibo:isbn"];
  }
  if (typeof out.URL !== "string" && typeof raw["dcterms:identifier"] === "string") {
    const safe = safeHref(raw["dcterms:identifier"] as string);
    if (safe) out.URL = safe;
  }
  if (typeof out.language !== "string" && typeof raw["dcterms:language"] === "string") {
    out.language = raw["dcterms:language"];
  }
  if (typeof out.abstract !== "string" && typeof raw["dcterms:abstract"] === "string") {
    out.abstract = raw["dcterms:abstract"];
  }
  if (typeof out.derivedFrom !== "string" && typeof raw["dcterms:source"] === "string") {
    out.derivedFrom = raw["dcterms:source"];
  }
  if (typeof out.heldAt !== "string" && typeof raw["dcterms:hasVersion"] === "string") {
    out.heldAt = raw["dcterms:hasVersion"];
  }
  return ReferenceNodeSchema.parse(out);
}

/**
 * Parse a BibTeX entry or CSL-JSON / JSON-LD string into {@link StandaloneReferenceInput} fields.
 */
export function parseBibtexOrCsl(raw: string): Partial<StandaloneReferenceInput> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    const item = (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, unknown> | undefined;
    if (!item || typeof item !== "object") return {};
    const out: Partial<StandaloneReferenceInput> = {};
    const id = typeof item.id === "string" ? item.id : typeof item["@id"] === "string" ? (item["@id"] as string).replace(/^references\//, "") : undefined;
    if (id) out.id = id;
    if (typeof item.type === "string") out.type = item.type;
    const title = typeof item.title === "string" ? item.title : typeof item["dcterms:title"] === "string" ? (item["dcterms:title"] as string) : undefined;
    if (title) out.title = title;
    if (Array.isArray(item.author)) out.authors = item.author as CslName[];
    else if (typeof item.author === "string") out.authors = item.author;
    else if (Array.isArray(item["dcterms:creator"])) out.authors = (item["dcterms:creator"] as unknown[]).filter((x): x is string => typeof x === "string");
    if (item.issued && typeof item.issued === "object") out.issued = item.issued as NonNullable<ReferenceNode["issued"]>;
    else if (typeof item.issued === "string" || typeof item.issued === "number") out.issued = item.issued;
    else if (typeof item["dcterms:issued"] === "string") out.issued = item["dcterms:issued"] as string;
    const container =
      typeof item["container-title"] === "string"
        ? (item["container-title"] as string)
        : typeof item.containerTitle === "string"
          ? (item.containerTitle as string)
          : typeof item["dcterms:isPartOf"] === "string"
            ? (item["dcterms:isPartOf"] as string)
            : undefined;
    if (container) out.containerTitle = container;
    if (typeof item.publisher === "string") out.publisher = item.publisher;
    if (typeof item.volume === "string" || typeof item.volume === "number") out.volume = item.volume;
    if (typeof item.issue === "string" || typeof item.issue === "number") out.issue = item.issue;
    if (typeof item.page === "string") out.page = item.page;
    const doi = typeof item.DOI === "string" ? item.DOI : typeof item["bibo:doi"] === "string" ? (item["bibo:doi"] as string) : undefined;
    if (doi) out.DOI = doi;
    const isbn = typeof item.ISBN === "string" ? item.ISBN : typeof item["bibo:isbn"] === "string" ? (item["bibo:isbn"] as string) : undefined;
    if (isbn) out.ISBN = isbn;
    const url = typeof item.URL === "string" ? item.URL : typeof item["dcterms:identifier"] === "string" ? (item["dcterms:identifier"] as string) : undefined;
    if (url) out.URL = url;
    if (typeof item.arXiv === "string") out.arXiv = item.arXiv;
    if (typeof item.abstract === "string") out.abstract = item.abstract;
    if (typeof item.note === "string") out.note = item.note;
    return out;
  }
  const head = /^@([A-Za-z]+)\s*\{\s*([^,\s]+)\s*,([\s\S]*)\}\s*$/.exec(trimmed);
  if (!head) return {};
  const [, rawType, rawKey, body] = head;
  const out: Partial<StandaloneReferenceInput> = {
    id: rawKey!.trim(),
    type: BIBTEX_TYPE_TO_CSL[rawType!.toLowerCase()] ?? "document",
  };
  const fields = new Map<string, string>();
  const fieldRe = /([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[^,\n}]+)/g;
  for (const m of body!.matchAll(fieldRe)) {
    const k = m[1]!.toLowerCase();
    const v = m[2]!.trim().replace(/^\{([\s\S]*)\}$|^"([\s\S]*)"$/, "$1$2").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
    if (v) fields.set(k, v);
  }
  if (fields.get("title")) out.title = fields.get("title");
  if (fields.get("author")) out.authors = fields.get("author");
  const yr = fields.get("year") ?? fields.get("date");
  if (yr) out.issued = yr;
  const venue = fields.get("journal") ?? fields.get("booktitle") ?? fields.get("series");
  if (venue) out.containerTitle = venue;
  if (fields.get("publisher") ?? fields.get("institution") ?? fields.get("school")) {
    out.publisher = fields.get("publisher") ?? fields.get("institution") ?? fields.get("school");
  }
  if (fields.get("volume")) out.volume = fields.get("volume");
  if (fields.get("number") ?? fields.get("issue")) out.issue = fields.get("number") ?? fields.get("issue");
  if (fields.get("pages")) out.page = fields.get("pages")!.replace(/--/g, "-");
  if (fields.get("doi")) out.DOI = fields.get("doi");
  if (fields.get("isbn")) out.ISBN = fields.get("isbn");
  if (fields.get("url")) out.URL = fields.get("url");
  if (fields.get("eprint") ?? fields.get("arxiv")) out.arXiv = fields.get("eprint") ?? fields.get("arxiv");
  if (fields.get("abstract")) out.abstract = fields.get("abstract");
  if (fields.get("note")) out.note = fields.get("note");
  return out;
}

function sanitiseReferenceKey(candidate: string): string {
  const cleaned = candidate.trim().replace(/[^A-Za-z0-9._:+-]+/g, "-").replace(/^[^A-Za-z0-9]+/, "").replace(/-+$/, "");
  return cleaned || "ref-item";
}

/**
 * Build a validated standalone `folio-reference/v1` node (`references/<key>.jsonld`)
 * and its CSL-JSON / BibTeX representations from viewer form fields or pasted
 * BibTeX/CSL-JSON. Any URL is checked with {@link safeHref} before inclusion.
 */
export function buildStandaloneReference(input: StandaloneReferenceInput): {
  node: ReferenceNode;
  jsonldNode: ReferenceNode & Record<string, unknown>;
  json: string;
  jsonld: string;
  csl: Record<string, unknown>;
  cslJson: string;
  bibtex: string;
  path: string;
  jsonPath: string;
} {
  const base = input.raw ? parseBibtexOrCsl(input.raw) : {};
  const merged: StandaloneReferenceInput = { ...base };
  for (const [k, v] of Object.entries(input)) {
    if (k !== "raw" && v !== undefined && v !== "") {
      (merged as Record<string, unknown>)[k] = v;
    }
  }

  let authors: CslName[] | undefined;
  if (typeof merged.authors === "string" && merged.authors.trim()) {
    authors = authorsRawToNames(merged.authors);
  } else if (Array.isArray(merged.authors) && merged.authors.length) {
    authors = merged.authors.flatMap((a) => (typeof a === "string" ? authorsRawToNames(a) : [a]));
  }

  let issued: ReferenceNode["issued"] | undefined;
  if (typeof merged.issued === "number") {
    issued = { "date-parts": [[merged.issued]] };
  } else if (typeof merged.issued === "string" && merged.issued.trim()) {
    issued = dcDateToCsl(merged.issued.trim());
  } else if (merged.issued && typeof merged.issued === "object") {
    issued = merged.issued;
  }

  const rawKey = (merged.id ?? merged.key ?? "").trim();
  const fallbackKey = (() => {
    const fam = (authors?.[0]?.family ?? authors?.[0]?.literal ?? "ref").split(/\s+/)[0]!.toLowerCase();
    const yr = issued ? yearOf({ issued }) ?? "" : "";
    const word = (merged.title ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    return sanitiseReferenceKey([fam, yr, word].filter(Boolean).join("") || "ref-item");
  })();
  const id = ReferenceKeySchema.safeParse(rawKey).success ? rawKey : sanitiseReferenceKey(rawKey || fallbackKey);
  const type = (merged.type ?? "article-journal").trim() || "article-journal";
  const title = merged.title?.trim() || undefined;
  const containerTitle = (merged.containerTitle ?? merged["container-title"])?.trim() || undefined;
  const publisher = merged.publisher?.trim() || undefined;
  const doi = merged.DOI?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "") || undefined;
  const isbn = merged.ISBN?.trim() || undefined;
  const arxiv = merged.arXiv?.trim().replace(/^arxiv:/i, "") || undefined;
  const candidateUrl =
    merged.URL?.trim() ||
    (arxiv ? `https://arxiv.org/abs/${arxiv}` : undefined) ||
    (doi ? `https://doi.org/${doi}` : undefined);
  const safeUrl = safeHref(candidateUrl);
  const abstract = merged.abstract?.trim() || undefined;
  const noteParts = [merged.note?.trim(), arxiv && !(merged.note ?? "").includes(arxiv) ? `arXiv:${arxiv}` : undefined].filter(
    (x): x is string => !!x,
  );
  const note = noteParts.length ? noteParts.join("; ") : undefined;

  const rawNode: Record<string, unknown> = {
    $schema: REFERENCE_SCHEMA_TAG,
    id,
    type,
    provenance: merged.provenance ?? "authored",
  };
  if (title) rawNode.title = title;
  if (authors?.length) rawNode.author = authors;
  if (issued) rawNode.issued = issued;
  if (containerTitle) rawNode["container-title"] = containerTitle;
  if (publisher) rawNode.publisher = publisher;
  if (merged.volume !== undefined && String(merged.volume).trim() !== "") rawNode.volume = merged.volume;
  if (merged.issue !== undefined && String(merged.issue).trim() !== "") rawNode.issue = merged.issue;
  if (merged.page?.trim()) rawNode.page = merged.page.trim();
  if (doi) rawNode.DOI = doi;
  if (isbn) rawNode.ISBN = isbn;
  if (safeUrl) rawNode.URL = safeUrl;
  if (merged.language?.trim()) rawNode.language = merged.language.trim();
  if (abstract) rawNode.abstract = abstract;
  if (note) rawNode.note = note;

  const node = ReferenceNodeSchema.parse(rawNode);
  const jsonldNode = ReferenceNodeSchema.parse({
    ...referenceToJsonLd(node),
    ...node,
  }) as ReferenceNode & Record<string, unknown>;

  return {
    node,
    jsonldNode,
    json: `${JSON.stringify(node, null, 2)}\n`,
    jsonld: `${JSON.stringify(jsonldNode, null, 2)}\n`,
    csl: toCslItem(node),
    cslJson: toCslJson([node]),
    bibtex: toBibtex([node]),
    path: `references/${node.id}.jsonld`,
    jsonPath: `references/${node.id}.json`,
  };
}

/**
 * Build a `safeHref`-checked GitHub new-file URL for creating a standalone
 * reference node at `<dir>/<key>.jsonld` (default `references/<key>.jsonld`).
 * Returns `undefined` when the repository URL is refused by `safeHref`.
 */
export function newReferenceUrl(opts: {
  repoUrl?: string;
  repo?: string;
  branch?: string;
  dir?: string;
  key: string;
  value?: string;
}): string | undefined {
  const base = (opts.repoUrl ?? (opts.repo ? `https://github.com/${opts.repo}` : "https://github.com/litlfred/folio-assistant")).replace(
    /\/+$/,
    "",
  );
  if (safeHref(base) === undefined) return undefined;
  const branch = (opts.branch ?? "main").trim() || "main";
  const dir = (opts.dir ?? "references").replace(/^\/+|\/+$/g, "") || "references";
  const key = ReferenceKeySchema.safeParse(opts.key).success ? opts.key : sanitiseReferenceKey(opts.key);
  const encodedDir = dir.split("/").map(encodeURIComponent).join("/");
  const q = new URLSearchParams({ filename: `${key}.jsonld` });
  if (opts.value) q.set("value", opts.value);
  return safeHref(`${base}/new/${encodeURIComponent(branch)}/${encodedDir}?${q.toString()}`);
}
