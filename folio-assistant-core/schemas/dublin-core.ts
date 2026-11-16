/**
 * Qualified Dublin Core, as a graph node.
 *
 * @module schemas/dublin-core
 * @graphNode schema
 *
 * ## Why this is in the content layer and not in the IRIS catalogue layer
 *
 * The owner, 2026-09-20: *"break up working bits (like .ts record for dublin
 * core) etc. fully worked for the three examples"*, and in the same breath
 * *"mionimal tools in who specific stuff."* Dublin Core is ISO 15836 and
 * DSpace is a repository platform; neither is WHO's. What IS WHO's is how IRIS
 * *uses* them — three identifier systems, MeSH as the subject vocabulary, a
 * legacy handle kept alive after a server merge — and that lives in the
 * IRIS catalogue layer's skill, beside the three records themselves.
 *
 * The line is the one {@link module:schemas/folio-graph-typology} already draws:
 * the layer that owns a vocabulary is the layer that can serve it to anybody.
 *
 * ## Qualified, repeatable, language-tagged — and all three are load-bearing
 *
 * This type is shaped by ONE measured record, not by a reading of the DC spec.
 * The full item record for `wpr-rdo-2020-003-eng`, extracted with `pdftotext`
 * on 2026-09-20, does all three of the things a naive model forbids:
 *
 *   - **Qualified.** Every field is `element.qualifier`: `dc.date.accessioned`,
 *     `dc.identifier.govdoc`, `dc.subject.mesh`, `dc.description.abstract`. A
 *     model keyed on the fifteen simple elements cannot address any of them.
 *   - **Repeated.** FOUR fields occur twice in that one record — two
 *     `dc.date.accessioned`, two `dc.date.available`, two `dc.identifier.uri`,
 *     two `dc.subject.mesh`. `Record<string, string>` silently keeps the last
 *     and drops the rest, and the ones it would drop are a real alternate
 *     identifier and half the subject indexing.
 *   - **Language-tagged.** The record carries a per-FIELD language column
 *     (`en` on `dc.description`, on `dc.title`, on each `dc.subject.mesh`, and
 *     conspicuously NOT on `dc.contributor.author` or the dates). The absence
 *     is data: an untagged value is not an English value, it is a value whose
 *     language nobody asserted.
 *
 * So the value type is a LIST of language-tagged values, always, even when the
 * list has one entry. A shape that is sometimes a string and sometimes an array
 * makes every consumer branch, and the consumer that forgets to branch is the
 * one that loses the second handle.
 *
 * ## What this type deliberately does NOT do
 *
 * It does not resolve, validate or deduplicate. `dc.identifier.uri` appearing
 * twice is not an error to be cleaned up — in the measured record the second is
 * `http://iris.wpro.who.int/handle/10665.1/14518`, a regional IRIS instance
 * that was merged into the global one, and dropping it would discard the only
 * evidence this repository holds of a source host disappearing. Judgement about
 * which identifier is authoritative belongs to the `iris-dspace` skill, which
 * can say WHY; a schema that deduplicated would make that judgement invisibly
 * and permanently.
 *
 * @conformsTo dcmi-terms
 */
import { z } from "zod";

import { DSPACE_NAMESPACE } from "./own-namespace.js";

/** The `$schema` tag a record declares itself with. Extension is a coincidence; a declaration inside the file is the contract. */
export const DUBLIN_CORE_SCHEMA_TAG = "folio-dublin-core/v1";

/**
 * One value of one field.
 *
 * `language` is OPTIONAL and its absence means "nobody asserted one" — never
 * "English". The measured record leaves it off the dates and off
 * `dc.contributor.author` while setting it on `dc.title`, so the two states
 * genuinely occur side by side in a single item.
 */
export const DcValueSchema = z
  .object({
    value: z.string().min(1),
    /** BCP 47, as DSpace stores it (`en`, `en_US`, `fr`). */
    language: z.string().min(1).optional(),
    /**
     * The authority record this value is controlled by, where there is one.
     * `dc.subject.mesh` is a controlled vocabulary with its own resolution; a
     * free-text keyword is not. Keeping the distinction addressable is what
     * lets a later tool ask "which of these subjects can I look up".
     */
    authority: z.string().min(1).optional(),
  })
  .strict();
export type DcValue = z.infer<typeof DcValueSchema>;

/**
 * A qualified field name, split rather than stringly-typed.
 *
 * Split, because the two halves answer different questions and consumers ask
 * them separately: "give me every identifier" is `element === "identifier"`,
 * while "give me the government document number" is
 * `qualifier === "govdoc"`. On the flat string `dc.identifier.govdoc` the first
 * question becomes a prefix match, and a prefix match on `dc.date` also catches
 * `dc.dateAccepted` in instances that mint one.
 */
export const DcFieldSchema = z
  .object({
    /** The namespace prefix. `dc` throughout the measured record; DSpace also mints `dcterms`, `local` and others. */
    schema: z.string().min(1).default("dc"),
    element: z.string().min(1),
    qualifier: z.string().min(1).optional(),
    /** Every value, in the order the source gave them. Never collapsed. */
    values: z.array(DcValueSchema).min(1),
  })
  .strict();
export type DcField = z.infer<typeof DcFieldSchema>;

/** Render a field back to its `schema.element.qualifier` spelling. */
export function dcFieldName(f: Pick<DcField, "schema" | "element" | "qualifier">): string {
  return [f.schema, f.element, f.qualifier].filter(Boolean).join(".");
}

/**
 * A record, as one item's metadata.
 *
 * `fields` is an ARRAY and not a map keyed by field name, for the same reason
 * `values` is an array: the source has an order, the order is sometimes
 * meaningful (DSpace's `place` ordering on repeated fields), and a map keyed by
 * `dcFieldName` would make the two `dc.identifier.uri` entries collide at the
 * top level instead of the value level.
 */
export const DublinCoreRecordSchema = z
  .object({
    $schema: z.literal(DUBLIN_CORE_SCHEMA_TAG),
    /**
     * The repository's own identifier for the item — a DSpace UUID here. NOT
     * the library slug: the slug is derived downstream and is the weakest of
     * the three identifiers this repository holds for the one worked item.
     */
    id: z.string().min(1),
    fields: z.array(DcFieldSchema).min(1),
    /**
     * Where this record was read from, and when. A metadata record with no
     * provenance is the `source: null` defect bean `r1lz` was opened over,
     * wearing a different hat.
     */
    provenance: z
      .object({
        source: z.string().min(1),
        retrievedAt: z.string().min(1),
        method: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export type DublinCoreRecord = z.infer<typeof DublinCoreRecordSchema>;

/** Every value of one qualified field, in source order. Empty when absent — which is not the same as a field present with no values, a state the schema forbids. */
export function dcValues(
  rec: DublinCoreRecord,
  element: string,
  qualifier?: string,
): DcValue[] {
  return rec.fields
    .filter((f) => f.element === element && f.qualifier === qualifier)
    .flatMap((f) => f.values);
}

/**
 * Every value across all qualifiers of one element.
 *
 * The question "what identifiers does this item have" spans `uri`, `govdoc`
 * and any other qualifier the instance mints, and a consumer that enumerated
 * the qualifiers it knew about would miss the one it did not.
 */
export function dcElement(rec: DublinCoreRecord, element: string): DcField[] {
  return rec.fields.filter((f) => f.element === element);
}

// ---------------------------------------------------------------------------
// JSON-LD projection
// ---------------------------------------------------------------------------

/**
 * The fifteen simple elements. DCMI publishes these at the `elements/1.1/`
 * stem and the qualified refinements at `terms/`; they are different
 * namespaces and this module keeps them apart on purpose.
 */
export const DC_ELEMENTS_NS = "http://purl.org/dc/elements/1.1/";

/**
 * DCMI Metadata Terms. Duplicated from `cat-harness-tools/schemas/kg/jsonld.ts`, which
 * needs it for the block context and cannot import content-layer modules.
 *
 * An unavoidable duplicate is fine; an UNCHECKED one is not — so
 * `dublin-core.test.ts` asserts the two spellings are byte-identical. If the
 * platform's ever changes, this fails rather than drifting into two
 * namespaces that look the same in a diff and join with nothing.
 */
export const DCTERMS_NS = "http://purl.org/dc/terms/";

/**
 * Where a qualified field name with no DCMI equivalent is minted.
 *
 * Under the content layer's published stem, because this is the layer that
 * owns the Dublin Core model — the same rule that put this module here rather
 * than in the IRIS catalogue layer.
 */
export const DSPACE_NS = DSPACE_NAMESPACE;

/** The fifteen. A qualifier on any of them is a refinement, not one of these. Exported for the renderer's dumb-down (`dublin-core-render.ts`). */
export const SIMPLE_ELEMENTS: ReadonlySet<string> = new Set([
  "contributor", "coverage", "creator", "date", "description", "format",
  "identifier", "language", "publisher", "relation", "rights", "source",
  "subject", "title", "type",
]);

/**
 * The predicate IRI for one field.
 *
 * ## The hazard this routes around, which is the whole reason the function exists
 *
 * The obvious projection maps every `dc.identifier.*` onto `dcterms:identifier`
 * and every `dc.date.*` onto `dcterms:date`. It is wrong, and wrong in exactly
 * the way the `iris-dspace` skill's R1 and R2 are about.
 *
 * The measured record carries `dc.identifier.uri` TWICE and
 * `dc.identifier.govdoc` once. Those are three values from **three different
 * identifier systems** — a Handle guaranteed outside WHO, a legacy regional
 * URI kept alive after a server merge, and a WHO publication number with no
 * authority behind it. Collapsed onto one predicate they become an unordered
 * bag of three strings, and the distinction R1 exists to preserve ("resolve by
 * Handle, treat govdoc as secondary") is no longer *expressible* in the
 * projected graph. Nothing errors. The consumer just cannot ask the question.
 *
 * So: a QUALIFIED field gets its own minted IRI, keyed on the full
 * `schema.element.qualifier` spelling. A BARE field whose element is one of the
 * fifteen gets the DCMI elements IRI, because there the mapping is exact and
 * standard. Everything else is minted.
 */
export function dcPredicate(f: Pick<DcField, "schema" | "element" | "qualifier">): string {
  if (f.schema === "dc" && !f.qualifier && SIMPLE_ELEMENTS.has(f.element)) {
    return DC_ELEMENTS_NS + f.element;
  }
  return DSPACE_NS + dcFieldName(f);
}

/** A JSON-LD value object, or a controlled-value node when an authority is asserted. */
type DcJsonLdValue =
  | { "@value": string; "@language"?: string }
  | { "@type": string; "rdf:value": { "@value": string; "@language"?: string }; [k: string]: unknown };

function projectValue(v: DcValue): DcJsonLdValue {
  // ALWAYS a value object, never a bare string, for the reason the module
  // header gives about `values`: a shape that is sometimes one thing and
  // sometimes another makes every consumer branch, and the consumer that
  // forgets to branch is the one that loses data.
  const literal: { "@value": string; "@language"?: string } = { "@value": v.value };
  if (v.language !== undefined) literal["@language"] = bcp47(v.language);

  if (v.authority === undefined) return literal;

  // A controlled value is not a literal — it is a thing with an authority
  // record behind it, which is what makes `dc.subject.mesh` resolvable and a
  // free-text keyword not (R5). JSON-LD value objects may not carry extra
  // keys, so it becomes a node with `rdf:value`.
  return {
    "@type": `${DSPACE_NS}ControlledValue`,
    "rdf:value": literal,
    [`${DSPACE_NS}authority`]: v.authority,
  };
}

/**
 * A record's language as a BCP 47 tag, for RDF and XML.
 *
 * DSpace stores a POSIX locale (`en_US`). The record keeps it verbatim, because
 * that is what the source says. RDF and `xml:lang` need BCP 47, whose subtags
 * are joined by `-`. Emitted as is, `en_US` makes an N-Quads language tag that
 * no parser accepts (`"20 p"@en_us`), so the conversion is made here, where the
 * record becomes RDF.
 */
export function bcp47(language: string): string {
  return language.replace(/_/g, "-");
}

/**
 * Project a record to JSON-LD.
 *
 * ## Why repeated values are an `@list` and not an array
 *
 * A plain JSON-LD array is an unordered SET — two serialisations with the
 * values swapped are the same graph. DSpace stores a `place` on every repeated
 * field and the order is meaningful, so a set would silently discard it: the
 * two `dc.identifier.uri` values would still both be present (R2 satisfied)
 * but "which one did the source give first" would be unanswerable. `@list`
 * preserves it.
 *
 * ## Why `@id` is not the Handle
 *
 * R1 says a later tool should resolve by Handle. That is a JUDGEMENT about
 * which of three identifier systems is authoritative, and this module's header
 * says plainly that such judgement belongs to the `iris-dspace` skill, which
 * can explain itself, and not to a schema that would make it invisibly and
 * permanently. So `@id` is minted from `rec.id` — the repository's own key,
 * the one the record is actually keyed on — and a caller that wants
 * Handle-keyed nodes passes `opts.id` and owns that decision where a reader
 * can see it.
 */
export function dublinCoreToJsonLd(
  rec: DublinCoreRecord,
  opts: { id?: string } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    "@id": opts.id ?? `${DSPACE_NS}item/${rec.id}`,
    "@type": `${DSPACE_NS}Item`,
  };

  // Fields are merged by PREDICATE, not by array position: the schema permits
  // the same qualified name to appear as two separate `DcField` entries (the
  // header says why `fields` is an array), and two JSON keys with one name is
  // not a thing JSON can represent. Source order is preserved across the join.
  const byPredicate = new Map<string, DcJsonLdValue[]>();
  for (const f of rec.fields) {
    const p = dcPredicate(f);
    const acc = byPredicate.get(p) ?? [];
    acc.push(...f.values.map(projectValue));
    byPredicate.set(p, acc);
  }
  for (const [p, values] of byPredicate) out[p] = { "@list": values };

  out[`${DSPACE_NS}provenance`] = {
    [`${DSPACE_NS}source`]: rec.provenance.source,
    [`${DSPACE_NS}retrievedAt`]: rec.provenance.retrievedAt,
    [`${DSPACE_NS}method`]: rec.provenance.method,
  };

  return out;
}

/**
 * The `@context` a projected record compacts against.
 *
 * Deliberately NOT merged into the platform's `CONTENT_CONTEXT`. That context
 * is shared by authored blocks and ingested `library/**` nodes so that one
 * loader serves both; a catalogue record is a third population with its own
 * vocabulary, and folding sixty minted DSpace terms into the block context
 * would make every block's published context grow a namespace no block uses.
 */
export const DUBLIN_CORE_CONTEXT = {
  "@version": 1.1,
  dc: DC_ELEMENTS_NS,
  dcterms: DCTERMS_NS,
  dspace: DSPACE_NS,
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
} as const;
