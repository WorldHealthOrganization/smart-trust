/**
 * `folio-glossary/v1`: a glossary as W3C SKOS. Core's `glossary` graph typology
 * (`typologies/glossary.json` declares the kind, since folio-assistant#2598).
 *
 * Owner, 2026-09-23: *"put glossary into folio-assistant-core"*, *"it should be
 * part of general pracice w/ glossary/ page"*, and *"can glossary be
 * refefences to external skos schema?"*. Yes, three ways, all SKOS:
 *
 * | how | here |
 * |---|---|
 * | a local term linked to an external concept | `exactMatch` / `closeMatch` / `broadMatch` / `narrowMatch` on a {@link Term} |
 * | a glossary that lists external terms without copying them | `members`: external concept IRIs, emitted as a `skos:Collection` |
 * | a whole external scheme | the declaration's `remoteGraphs` entry with `graphTypologies: ["glossary"]`: known about, not held |
 *
 * Bean `lqo9` settled the rest before this was written, and it is followed,
 * not re-decided:
 * - **SKOS is the model**, `notation` is the code, and version and provenance
 *   sit on the scheme as Dublin Core (`hasVersion`, `modified`, `source`).
 * - **Three states, not two**: `authored`, `candidate` (extracted, not yet
 *   curated), `could-not-extract` (visible, with its reason). A candidate is
 *   not a definition, and nobody reading the page should mistake one for it.
 * - **A term's IRI lives in the layer namespace**, never in the asset that
 *   first defined it: moving the asset must not move the term.
 * - **Reuse is by membership, never by copying a definition.**
 * - **Not named `GlossaryEntry`**, which is already taken twice.
 *
 * @module folio-assistant-core/schemas/glossary
 * @graphNode schema
 * @conformsTo foaf
 * @conformsTo w3c-org
 */
import { z } from "zod";

import { PROV_CONTEXT } from "@litlfred/cat-harness-tools/schemas/content/prov.ts";
import { STANDARD_PREFIXES, applyVocabMapping, contextBindings, vocabMapping, type VocabMapping } from "@litlfred/cat-harness-tools/schemas/content/vocab-mapping.ts";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { checkoutRootFor } from "../scripts/lib/checkout-root.ts";
import { CORE_NAMESPACE } from "./own-namespace.ts";

export const GLOSSARY_SCHEMA_ID = "folio-glossary/v1" as const;

export const SKOS_NS = "http://www.w3.org/2004/02/skos/core#" as const;
export const DCTERMS_NS = "http://purl.org/dc/terms/" as const;

/** The three states from bean `lqo9`. */
export const TERM_STATUSES = ["authored", "candidate", "could-not-extract"] as const;
export type TermStatus = (typeof TERM_STATUSES)[number];

/** A local id: the tail of a term's IRI. Lowercase, so an IRI never differs from another by case alone. */
const LOCAL_ID = /^[a-z0-9][a-z0-9._-]*$/;
/** An absolute IRI: an external concept, a source, a scheme. */
const Iri = z.string().regex(/^[a-z][a-z0-9+.-]*:\/\/\S+$/i, "an absolute IRI");

/**
 * The subject area a scheme's (or a term's) translations BIND in
 * (`dcterms:subject`): a lowercase local id such as `harness-vocabulary` or
 * `digital-health-trust`.
 *
 * Owner, 2026-11-07 (glossary review, "scoped fixed terms"): layer precedence
 * for a fixed translation applies only WITHIN a subject area. A lower layer's
 * `policy` → `策略` (access policy) fixes the harness's own word; it does not
 * bind a health guide's "policy" (`政策`). A match across subject areas is a
 * sense check for a person, never a violation.
 *
 * Why not `scopeNote`: that is prose for a reader, and a check that compares
 * prose would be reading it. `dcterms:subject` is the SKOS-compatible
 * predicate for "what this is about" and takes an id a check can compare.
 *
 * A term with no subject, on itself or its scheme, binds only within its own
 * scheme.
 */
export const SubjectSchema = z.string().regex(LOCAL_ID, "a lowercase local id, such as harness-vocabulary");

/**
 * Whether a term's translation into one locale has been signed off by a
 * person. Absent means `unofficial`: every translation starts as a draft.
 */
export const TRANSLATION_STATUSES = ["official", "unofficial"] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];
const BCP47 = /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/;

/**
 * Text in one language, or per language (BCP 47 keys). SKOS's multilingual
 * labels are why a plain string is not the only shape.
 */
export const LangTextSchema = z.union([
  z.string().min(1),
  z.record(z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/), z.string().min(1)).refine((r) => Object.keys(r).length > 0),
]);
export type LangText = z.infer<typeof LangTextSchema>;

/** The source language when a scheme declares none. */
export const DEFAULT_SOURCE_LANGUAGE = "en" as const;

/**
 * Where one locale's translation of a term came from (owner, option C,
 * 2026-11-18: glossary translations live in the glossary as language-tagged
 * labels and definitions, marked unofficial). `source` is an IRI or a CURIE;
 * `unterm:<id>` names a UN Terminology Database (UNTERM) record. `sourceText`
 * is the SOURCE-language text that record translates, verbatim, so a reader
 * can tell whether the record is about this term or only a similar one.
 *
 * It is provenance, not a sign-off: what it changes is derived by
 * {@link translationStateOf}, never stored.
 */
export const TranslationSourceSchema = z
  .object({
    source: z.string().min(1),
    sourceText: z.string().min(1).optional(),
  })
  .strict();
export type TranslationSource = z.infer<typeof TranslationSourceSchema>;

/**
 * What a reader is told about one locale's text, derived by
 * {@link translationStateOf}: `official` (signed off, or an UNTERM record of
 * exactly this source text), `candidate` (an official source's record of a
 * DIFFERENT source text: offered, not adopted), `unofficial` (everything else,
 * the default).
 */
export const TRANSLATION_STATES = ["official", "candidate", "unofficial"] as const;
export type TranslationState = (typeof TRANSLATION_STATES)[number];

/** The prefix of a UNTERM record's CURIE in {@link TranslationSourceSchema.source}. */
export const UNTERM_PREFIX = "unterm:" as const;

/**
 * What a term's concept is ABOUT, when that is a thing in the world and not
 * only a word: today, an organization (owner, 2026-10-31, option B: "SKOS +
 * W3C ORG"). SKOS's own link for it is `foaf:focus`. The concept keeps the
 * labels, the acronym (`notation`) and the definition. The organization keeps
 * what is true of the organization: its type, homepage and parent. A concept
 * is never also typed as the organization, because one is a word and the
 * other is a body of people.
 *
 * - `type`: a W3C ORG class, `org:Organization` or one of its subclasses.
 * - `iri`: the organization's IRI when someone else already mints one, such
 *   as a ROR id. Without it, the organization is `<term IRI>/_focus`. A term
 *   id cannot begin with `_`, so this never collides with a term.
 * - `homepage`: `foaf:homepage`.
 * - `subOrganizationOf`: `org:subOrganizationOf`. A local term id (its
 *   organization is meant) or an absolute IRI of an organization.
 * - `sameAs`: `owl:sameAs`, the same organization in another register, such
 *   as Wikidata or ROR.
 */
export const ORG_TYPES = ["Organization", "FormalOrganization", "OrganizationalUnit", "OrganizationalCollaboration"] as const;
export const OrgFocusSchema = z
  .object({
    type: z.enum(ORG_TYPES),
    iri: Iri.optional(),
    homepage: Iri.optional(),
    subOrganizationOf: z.array(z.string().min(1)).optional(),
    sameAs: z.array(Iri).optional(),
  })
  .strict();
export type OrgFocus = z.infer<typeof OrgFocusSchema>;

/** ArchiMate 3.2's relationships, by the names its exchange format gives them. */
export const ARCHIMATE_RELATIONSHIPS = [
  "Composition",
  "Aggregation",
  "Assignment",
  "Realization",
  "Serving",
  "Access",
  "Influence",
  "Triggering",
  "Flow",
  "Specialization",
  "Association",
] as const;
export type ArchimateRelationshipType = (typeof ARCHIMATE_RELATIONSHIPS)[number];

/**
 * A concept that is an architecture element: the knowledge graph holds the
 * element and its relationships, and the ArchiMate model is drawn from it.
 * Owner, 2026-11-01 (smart-ra#166, "much of models should be rendered from
 * KG content", option B "whole model from the graph", then A "on each
 * glossary term"). Archi keeps only where the boxes sit.
 *
 * - `archimate`: the element's type, as ArchiMate's exchange format names it
 *   (`ApplicationComponent`, `BusinessRole`, …).
 * - `iri`: the element's IRI when someone else mints one. Without it, the
 *   element is `<term IRI>/_focus`, as an organization is.
 * - `relationships`: from this element to another term's element (a local
 *   term id) or to an element by IRI. `accessType` only on `Access`.
 *
 * The concept keeps the words; the element keeps what is true of the
 * architecture. A model element is linked back to the term by its
 * `skosConcept` property.
 */
export const ArchimateRelationshipSchema = z
  .object({
    type: z.enum(ARCHIMATE_RELATIONSHIPS),
    target: z.string().min(1),
    accessType: z.enum(["read", "write", "readwrite", "access"]).optional(),
  })
  .strict()
  .refine((r) => r.accessType === undefined || r.type === "Access", { message: "accessType is only for an Access relationship" });
export type ArchimateRelationship = z.infer<typeof ArchimateRelationshipSchema>;
export const ArchimateFocusSchema = z
  .object({
    archimate: z.string().regex(/^[A-Z][A-Za-z]+$/, "an ArchiMate element type, such as ApplicationComponent"),
    iri: Iri.optional(),
    relationships: z.array(ArchimateRelationshipSchema).optional(),
  })
  .strict();
export type ArchimateFocus = z.infer<typeof ArchimateFocusSchema>;

/** What a term's concept is about: an organization, or an architecture element. */
export const FocusSchema = z.union([OrgFocusSchema, ArchimateFocusSchema]);
export type Focus = z.infer<typeof FocusSchema>;
export const isOrgFocus = (f: Focus | undefined): f is OrgFocus => f !== undefined && "type" in f;
export const isArchimateFocus = (f: Focus | undefined): f is ArchimateFocus => f !== undefined && "archimate" in f;

export const TermSchema = z
  .object({
    id: z.string().regex(LOCAL_ID),
    prefLabel: LangTextSchema,
    altLabel: z.array(z.string().min(1)).optional(),
    definition: LangTextSchema.optional(),
    /** The code. SKOS's own word for it. */
    notation: z.string().min(1).optional(),
    scopeNote: z.string().min(1).optional(),
    /**
     * A note for the editors, not part of the meaning (`skos:editorialNote`):
     * the document's own marks such as "Under review" or "To be included
     * before publication". A table drawn from the glossary prints it in
     * brackets after the definition, as the document does (smart-ra Q-RAC-8 A).
     */
    editorialNote: z.string().min(1).optional(),
    /**
     * An instance of the concept (`skos:example`), such as "The Client
     * Registry" for Application Component. A table drawn from the glossary
     * prints it in its own column (smart-ra Q-RAC-7 A, Table 3.1).
     */
    example: LangTextSchema.optional(),
    /** Local term ids or absolute IRIs. */
    broader: z.array(z.string().min(1)).optional(),
    related: z.array(z.string().min(1)).optional(),
    exactMatch: z.array(Iri).optional(),
    closeMatch: z.array(Iri).optional(),
    broadMatch: z.array(Iri).optional(),
    narrowMatch: z.array(Iri).optional(),
    /**
     * Local ids of the terms this definition USES — what a reader must know
     * first (dcterms:requires). In an `ordered` glossary each must come
     * earlier; the scheme refuses one that does not.
     */
    requires: z.array(z.string().min(1)).optional(),
    /** The schema or standard that defines the term (rdfs:isDefinedBy). */
    isDefinedBy: Iri.optional(),
    /**
     * The concept's IRI when its defining vocabulary already mints one. The
     * glossary then DESCRIBES that concept — its labels, translations, order —
     * rather than minting a second IRI for the same term. Owner, 2026-09-30
     * (bean `xsqm`, "one SKOS", option A): bootstrap's terms are
     * `<bootstrap>/ns/Node`, not also `…ns/glossary/terms/node`.
     */
    iri: Iri.optional(),
    /** Overrides the scheme's {@link SubjectSchema subject area} for this term. */
    subject: SubjectSchema.optional(),
    /**
     * Per locale, whether this term's translation is signed off. The
     * translation itself is the locale's entry of `prefLabel`/`definition`
     * (owner, option C, 2026-11-18) or the scheme's `.po`: this records only
     * who stands behind it. A locale not listed is `unofficial`, unless
     * {@link translationStateOf} finds an exact UNTERM record.
     */
    translationStatus: z.record(z.string().regex(BCP47), z.enum(TRANSLATION_STATUSES)).optional(),
    /**
     * Per locale, where that locale's text came from ({@link TranslationSourceSchema}):
     * an UNTERM record, a published glossary, a translator. Read by
     * {@link translationStateOf}.
     */
    translationSource: z.record(z.string().regex(BCP47), TranslationSourceSchema).optional(),
    /** The thing the concept is about, an organization or an architecture element ({@link FocusSchema}): `foaf:focus`. */
    focus: FocusSchema.optional(),
    /** Where the term came from: a repository path (with #anchor) or an IRI. */
    source: z.string().min(1).optional(),
    status: z.enum(TERM_STATUSES),
    /** Required for `could-not-extract`: a person must be able to act on it. */
    reason: z.string().min(1).optional(),
  })
  .strict()
  .refine((t) => t.status !== "authored" || t.definition !== undefined, {
    message: "an authored term has a definition; without one it is a candidate",
    path: ["definition"],
  })
  .refine((t) => t.status !== "could-not-extract" || t.reason !== undefined, {
    message: "could-not-extract says why",
    path: ["reason"],
  });
export type Term = z.infer<typeof TermSchema>;

export const GlossarySchema = z
  .object({
    $schema: z.literal(GLOSSARY_SCHEMA_ID),
    /** The scheme's local id: the tail of its IRI. */
    id: z.string().regex(LOCAL_ID),
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    /** dcterms:hasVersion. */
    hasVersion: z.string().min(1).optional(),
    /** dcterms:modified, a date. */
    modified: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    /** dcterms:source: what the terms were drawn from. */
    source: z.string().min(1).optional(),
    /** The subject area this scheme's translations bind in ({@link SubjectSchema}): `dcterms:subject`. */
    subject: SubjectSchema.optional(),
    /** The licence the terms are published under: an SPDX id or a URL. */
    license: z.string().min(1).optional(),
    /**
     * The language the scheme is authored in (BCP 47): what a plain-string
     * label or definition is in, and which entry of a per-language one is the
     * source. Absent means `en`.
     */
    sourceLanguage: z.string().regex(BCP47).optional(),
    terms: z.array(TermSchema).default([]),
    /**
     * The terms are in a LOGICAL order, each defined only by terms above it,
     * and a reader should meet them in that order — not alphabetically. The
     * owner, 2026-09-29, of bootstrap's terms: keep "logical rather than
     * alphabetical order". Published as a skos:OrderedCollection.
     */
    ordered: z.boolean().optional(),
    /** External concept IRIs this glossary lists without copying: a `skos:Collection`. */
    members: z.array(Iri).optional(),
  })
  .strict()
  .superRefine((g, ctx) => {
    const ids = new Set<string>();
    g.terms.forEach((t, i) => {
      if (ids.has(t.id)) ctx.addIssue({ code: "custom", path: ["terms", i, "id"], message: `term id "${t.id}" appears twice` });
      ids.add(t.id);
    });
    // `requires` names terms of THIS glossary; in an ordered one, earlier ones.
    const at = new Map(g.terms.map((t, i) => [t.id, i]));
    g.terms.forEach((t, i) => {
      (t.requires ?? []).forEach((ref, j) => {
        const k = at.get(ref);
        const why =
          k === undefined ? `"${ref}" is not a term in this glossary`
          : k === i ? `a term does not require itself`
          : g.ordered && k > i ? `"${ref}" comes after "${t.id}", and this glossary is ordered`
          : undefined;
        if (why) ctx.addIssue({ code: "custom", path: ["terms", i, "requires", j], message: why });
      });
    });
    // A local reference must name a term here; anything else must be an IRI.
    g.terms.forEach((t, i) => {
      ((isOrgFocus(t.focus) && t.focus.subOrganizationOf) || []).forEach((ref, j) => {
        const local = g.terms.find((u) => u.id === ref);
        if (local ? !isOrgFocus(local.focus) : !/^[a-z][a-z0-9+.-]*:\/\//i.test(ref)) {
          ctx.addIssue({
            code: "custom",
            path: ["terms", i, "focus", "subOrganizationOf", j],
            message: local
              ? `"${ref}" is a term with no focus, so it names no organization`
              : `"${ref}" is neither a term in this glossary nor an absolute IRI`,
          });
        }
      });
      ((isArchimateFocus(t.focus) && t.focus.relationships) || []).forEach((r, j) => {
        const local = g.terms.find((u) => u.id === r.target);
        if (local ? !isArchimateFocus(local.focus) : !/^[a-z][a-z0-9+.-]*:\/\//i.test(r.target)) {
          ctx.addIssue({
            code: "custom",
            path: ["terms", i, "focus", "relationships", j, "target"],
            message: local
              ? `"${r.target}" is a term whose focus is no ArchiMate element`
              : `"${r.target}" is neither a term in this glossary nor an absolute IRI`,
          });
        }
      });
      for (const field of ["broader", "related"] as const) {
        (t[field] ?? []).forEach((ref, j) => {
          if (!ids.has(ref) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(ref)) {
            ctx.addIssue({
              code: "custom",
              path: ["terms", i, field, j],
              message: `"${ref}" is neither a term in this glossary nor an absolute IRI`,
            });
          }
        });
      }
    });
  });
export type Glossary = z.infer<typeof GlossarySchema>;

/**
 * The subject area a term's translation binds in: its own, else its scheme's,
 * else none (it binds only within its scheme).
 */
export function subjectOf(g: Pick<Glossary, "subject">, t: Pick<Term, "subject">): string | undefined {
  return t.subject ?? g.subject;
}

/**
 * A term's translation into `locale` is FIXED when the term is `authored` and
 * its scheme's catalogue (`translations/<locale>/glossary/<instance>--<scheme>.po`)
 * holds a non-empty, non-fuzzy `msgstr` for its `prefLabel`. Derived, never
 * stored: the `.po` is the one place a translation lives, so there is no flag
 * to fall out of step with it. `msgstr` is that entry's text, or undefined
 * when the catalogue has none.
 */
export function isFixedTranslation(t: Pick<Term, "status">, msgstr: string | undefined, fuzzy = false): boolean {
  return t.status === "authored" && !fuzzy && typeof msgstr === "string" && msgstr.trim() !== "";
}

/** The sign-off status of a term's translation into `locale`: `unofficial` unless recorded otherwise. */
export function translationStatusOf(t: Pick<Term, "translationStatus">, locale: string): TranslationStatus {
  return t.translationStatus?.[locale] ?? "unofficial";
}

/** The scheme's source language: its `sourceLanguage`, else `en`. */
export function sourceLanguageOf(g: Pick<Glossary, "sourceLanguage">): string {
  return g.sourceLanguage ?? DEFAULT_SOURCE_LANGUAGE;
}

/** The text in `lang`, or undefined. A plain string is in the source language. */
export function textIn(t: LangText | undefined, lang: string, sourceLang: string = DEFAULT_SOURCE_LANGUAGE): string | undefined {
  if (t === undefined) return undefined;
  if (typeof t === "string") return lang === sourceLang ? t : undefined;
  return t[lang];
}

/** The source-language text: the `sourceLang` entry, else the first. */
export function sourceTextOf(t: LangText, sourceLang: string = DEFAULT_SOURCE_LANGUAGE): string {
  return typeof t === "string" ? t : (t[sourceLang] ?? Object.values(t)[0]!);
}

/**
 * The locales a term has its own text in, other than the source: every
 * language of its `prefLabel` and `definition`, sorted.
 */
export function translatedLocales(t: Pick<Term, "prefLabel" | "definition">, sourceLang: string = DEFAULT_SOURCE_LANGUAGE): string[] {
  const keys = (x: LangText | undefined) => (x === undefined || typeof x === "string" ? [] : Object.keys(x));
  return [...new Set([...keys(t.prefLabel), ...keys(t.definition)])].filter((l) => l !== sourceLang).sort();
}

/**
 * What a reader is told about a term's text in `locale` ({@link TRANSLATION_STATES}).
 *
 * - `official` when a person signed it off (`translationStatus`), or when it
 *   is an UNTERM record (`translationSource` `unterm:<id>`) whose `sourceText`
 *   is EXACTLY this term's source-language `prefLabel`: an official
 *   candidate the UN already stands behind for this very term.
 * - `candidate` when it comes from UNTERM but the record's `sourceText` is
 *   absent or differs: the UN's translation of a similar term, offered for a
 *   person to adopt, not yet this term's.
 * - `unofficial` otherwise.
 */
export function translationStateOf(
  t: Pick<Term, "prefLabel" | "translationStatus" | "translationSource">,
  locale: string,
  sourceLang: string = DEFAULT_SOURCE_LANGUAGE,
): TranslationState {
  if (translationStatusOf(t, locale) === "official") return "official";
  const src = t.translationSource?.[locale];
  if (src?.source.startsWith(UNTERM_PREFIX)) {
    return src.sourceText !== undefined && src.sourceText === sourceTextOf(t.prefLabel, sourceLang) ? "official" : "candidate";
  }
  return "unofficial";
}

/** The IRI of a scheme, and of a term in it: `<ns>glossary/<scheme>` and `…/<term>`. */
export function schemeIri(ns: string, g: Pick<Glossary, "id">): string {
  return `${ns}glossary/${g.id}`;
}
export function termIri(ns: string, g: Pick<Glossary, "id">, termId: string): string {
  return `${schemeIri(ns, g)}/${termId}`;
}
/** The IRI of the thing a term is about: its own `iri`, else `<concept IRI>/_focus`. */
export function focusIri(conceptIri: string, f: Pick<Focus, "iri">): string {
  return f.iri ?? `${conceptIri}/_focus`;
}

export const FOAF_NS = "http://xmlns.com/foaf/0.1/" as const;
export const ORG_NS = "http://www.w3.org/ns/org#" as const;
/** The Open Group's namespace for the ArchiMate exchange format. */
export const ARCHIMATE_NS = "http://www.opengroup.org/xsd/archimate/3.1/" as const;
export const OWL_NS = "http://www.w3.org/2002/07/owl#" as const;

/**
 * Language-tagged literals. A plain string is in the scheme's source language
 * and is tagged with it: `"Policy"` and `"Policy"@en` are different literals,
 * and only the tagged one says which language a SKOS reader is looking at.
 */
function langValues(t: LangText, sourceLang: string): Array<{ "@value": string; "@language": string }> {
  return typeof t === "string"
    ? [{ "@value": t, "@language": sourceLang }]
    : Object.entries(t).map(([lang, v]) => ({ "@value": v, "@language": lang }));
}

/**
 * The namespace of the platform's own glossary-translation terms. No existing
 * vocabulary records whether ONE LANGUAGE'S label is signed off: ADMS's
 * `adms:status` is an asset's lifecycle, TBX's `administrativeStatus` is a
 * term's admissibility, and SKOS has no label resource at all. So the label
 * is a SKOS-XL `skosxl:Label` (W3C, the existing vocabulary for a label as a
 * resource), and its status is this layer's own `translationStatus`, a plain
 * literal from {@link TRANSLATION_STATES}, with the record it came from as
 * `dcterms:source`.
 */
export function translationStatusIri(coreNs: string): string {
  return `${coreNs}translationStatus`;
}
export const SKOSXL_NS = "http://www.w3.org/2008/05/skos-xl#" as const;

/**
 * One candidate's AUTOMATED matches, as `check:term-mapping` found them:
 * `exactMatch` where its label matched a concept's prefLabel, `closeMatch`
 * where only an altLabel or a cross-vocabulary display did. Every value is an
 * absolute IRI. Resolving `<scheme>:<id>` is the caller's job, and a value it
 * cannot resolve is left out rather than invented.
 */
export interface AutomatedMatch {
  term: string;
  exactMatch: string[];
  closeMatch: string[];
}

/**
 * The named graph a scheme's automated matches live in.
 *
 * `_` cannot begin a term id (`LOCAL_ID`), so this never collides with a
 * term's IRI, which is `<scheme>/<id>`.
 */
export function automatedGraphIri(ns: string, g: Pick<Glossary, "id">): string {
  return `${schemeIri(ns, g)}/_automated-matches`;
}

/** The blank node naming one run of the check: it has no release address. */
export const AUTOMATED_RUN = "_:term-mapping-run";

/**
 * The automated matches, kept apart from everything a person wrote, and
 * saying so in PROV. Owner, 2026-10-02: publish both `exactMatch` and
 * `closeMatch`, "each marked as AUTOMATED".
 *
 * **A named graph, not the default graph.** Every other triple in a scheme
 * document is in the default graph and is something a person decided. That
 * includes an authored term's `skos:exactMatch`. These are a label match.
 * In their own graph, the assertion and its provenance are one thing: a
 * triple is in that graph BECAUSE a program matched it. Rejected:
 *
 * - **RDF reification** (`rdf:Statement`) DESCRIBES a triple without
 *   asserting it, so the owner's "publish as `skos:exactMatch`" would not
 *   hold. Pairing it with the plain triple lets any reader that ignores the
 *   reification read an unmarked `exactMatch`, which is the one confusion
 *   the marker exists to prevent.
 * - **RDF-star / JSON-LD-star** annotation is not in JSON-LD 1.1.
 * - **`skos:note` on the concept** is a literal that no processor can join
 *   to the match it is about.
 *
 * **The marker is PROV, in PROV-JSONLD's shape** (rule
 * `ld-prov-in-prov-jsonld-shape`). The graph is an `Entity` with a qualified
 * `Generation` by an `Activity`. The activity's `Association` names the
 * agent as a `prov:SoftwareAgent`, and no person appears anywhere in the
 * chain.
 *
 * The activity is a blank node. A run of a check has no release address,
 * and minting one would be the invented address that
 * `ld-link-is-the-node-release-address` refuses. No timestamp is written,
 * so an unchanged result regenerates byte-identically.
 *
 * `agent` is the agent's release address, or `undefined` when it has none.
 * In that case the agent is a blank node that still carries its type. It is
 * never a string under a term that coerces to `@id`.
 */
function automatedNodes(
  graphIri: string,
  idOf: (termId: string) => string,
  matches: readonly AutomatedMatch[],
  agent: string | undefined,
): Record<string, unknown>[] {
  const link = (xs: Iterable<string>) => [...new Set(xs)].sort().map((x) => ({ "@id": x }));
  const inner = [...matches]
    .sort((a, b) => (a.term < b.term ? -1 : a.term > b.term ? 1 : 0))
    .map((m) => {
      const self = idOf(m.term);
      const exact = new Set(m.exactMatch.filter((x) => x !== self));
      // exactMatch is a sub-property of closeMatch in SKOS, so a concept
      // already stated exact is not restated as close.
      const close = m.closeMatch.filter((x) => x !== self && !exact.has(x));
      return {
        "@id": self,
        ...(exact.size ? { "skos:exactMatch": link(exact) } : {}),
        ...(close.length ? { "skos:closeMatch": link(close) } : {}),
      };
    })
    .filter((n) => Object.keys(n).length > 1);
  if (!inner.length) return [];
  return [
    {
      "@id": graphIri,
      "@type": "Entity",
      label: "Automated label matches from check:term-mapping. Not confirmed by a person.",
      "@graph": inner,
    },
    { "@type": "Generation", entity: graphIri, activity: AUTOMATED_RUN },
    {
      "@id": AUTOMATED_RUN,
      "@type": "Activity",
      label: "check:term-mapping: a normalised-label match against authorised vocabularies, run by a program",
    },
    {
      "@type": "Association",
      activity: AUTOMATED_RUN,
      agent: { ...(agent ? { "@id": agent } : {}), "@type": "prov:SoftwareAgent" },
    },
  ];
}

let licenceNaming: VocabMapping | undefined;

/**
 * A glossary's licence, by the `licence-naming` table row a library item's
 * licence uses too (finding D4, bean `gzkt`, owner 2026-10-03). The key is the
 * row's predicate written as a CURIE, because this document's context binds
 * prefixes rather than terms: `dcterms:license`, as before the table existed.
 */
export function licenceTerms(license: string | undefined): Record<string, unknown> {
  licenceNaming ??= vocabMapping(join(checkoutRootFor(fileURLToPath(new URL("..", import.meta.url))), "cat-harness"), "licence-naming");
  const applied = applyVocabMapping(licenceNaming, { license });
  const curies = contextBindings([licenceNaming], {
    inContext: { dcterms: DCTERMS_NS },
    prefixes: STANDARD_PREFIXES,
    only: ["license"],
  });
  return Object.fromEntries(Object.entries(applied).map(([k, v]) => [curies[k] ?? k, v]));
}

/**
 * The glossary as SKOS JSON-LD. `ns` is the declaring layer's namespace,
 * so the IRIs follow the layer, not the file (bean `lqo9`).
 *
 * A candidate or could-not-extract term is emitted too, with its status as a
 * `skos:note` so a consumer reading only SKOS can still tell it is not a
 * curated definition. Leaving it out would make the graph claim fewer terms
 * than the page shows.
 */
export function toSkos(
  g: Glossary,
  ns: string,
  automated?: { matches: readonly AutomatedMatch[]; agent: string | undefined },
  /** The platform's namespace, where `translationStatus` is minted; defaults to this layer's own. */
  coreNs: string = CORE_NAMESPACE,
): Record<string, unknown> {
  const scheme = schemeIri(ns, g);
  const srcLang = sourceLanguageOf(g);
  let hasXl = false;
  // A term that names its own concept IRI is referred to by it, everywhere.
  const own = new Map(g.terms.filter((t) => t.iri).map((t) => [t.id, t.iri!]));
  const idOf = (termId: string) => own.get(termId) ?? termIri(ns, g, termId);
  const ref = (r: string) => ({ "@id": /^[a-z][a-z0-9+.-]*:\/\//i.test(r) ? r : idOf(r) });
  const iris = (xs?: string[]) => (xs && xs.length ? { value: xs.map((x) => ({ "@id": x })) } : undefined);
  const graph: Record<string, unknown>[] = [
    {
      "@id": scheme,
      "@type": "skos:ConceptScheme",
      "skos:prefLabel": g.title,
      ...(g.description ? { "skos:definition": g.description } : {}),
      ...(g.hasVersion ? { "dcterms:hasVersion": g.hasVersion } : {}),
      ...(g.modified ? { "dcterms:modified": g.modified } : {}),
      ...(g.source ? { "dcterms:source": g.source } : {}),
      ...(g.subject ? { "dcterms:subject": g.subject } : {}),
      // The `licence-naming` row a library item's licence comes from too
      // (finding D4, bean `gzkt`): one row, so one predicate for both.
      ...licenceTerms(g.license),
    },
  ];
  for (const t of g.terms) {
    const node: Record<string, unknown> = {
      "@id": idOf(t.id),
      "@type": "skos:Concept",
      "skos:inScheme": { "@id": scheme },
      "skos:prefLabel": langValues(t.prefLabel, srcLang),
    };
    if (t.altLabel?.length) node["skos:altLabel"] = t.altLabel.map((a) => ({ "@value": a, "@language": srcLang }));
    if (t.definition) node["skos:definition"] = langValues(t.definition, srcLang);
    // Each translated label as a SKOS-XL label resource, carrying what a
    // reader is told about it (unofficial unless signed off or an exact UNTERM
    // record) and where it came from. The plain `skos:prefLabel` above stays,
    // so a reader that knows only SKOS still finds every language.
    const xl = translatedLocales(t, srcLang)
      .filter((loc) => textIn(t.prefLabel, loc, srcLang) !== undefined)
      .map((loc) => {
        const src = t.translationSource?.[loc]?.source;
        return {
          "@id": `${idOf(t.id)}#label-${loc}`,
          "@type": "skosxl:Label",
          "skosxl:literalForm": { "@value": textIn(t.prefLabel, loc, srcLang)!, "@language": loc },
          "fa:translationStatus": translationStateOf(t, loc, srcLang),
          ...(src ? { "dcterms:source": /^[a-z][a-z0-9+.-]*:\/\//i.test(src) ? { "@id": src } : src } : {}),
        };
      });
    if (xl.length) {
      hasXl = true;
      node["skosxl:prefLabel"] = xl.map((l) => ({ "@id": l["@id"] }));
    }
    if (t.notation) node["skos:notation"] = t.notation;
    if (t.scopeNote) node["skos:scopeNote"] = t.scopeNote;
    if (t.editorialNote) node["skos:editorialNote"] = t.editorialNote;
    if (t.example) node["skos:example"] = langValues(t.example, srcLang);
    if (t.broader?.length) node["skos:broader"] = t.broader.map(ref);
    if (t.related?.length) node["skos:related"] = t.related.map(ref);
    for (const m of ["exactMatch", "closeMatch", "broadMatch", "narrowMatch"] as const) {
      const v = iris(t[m]);
      if (v) node[`skos:${m}`] = v.value;
    }
    if (t.requires?.length) node["dcterms:requires"] = t.requires.map(ref);
    if (t.isDefinedBy) node["rdfs:isDefinedBy"] = { "@id": t.isDefinedBy };
    if (t.source) node["dcterms:source"] = t.source;
    if (t.subject) node["dcterms:subject"] = t.subject;
    if (t.status !== "authored") node["skos:note"] = t.reason ? `${t.status}: ${t.reason}` : t.status;
    graph.push(node);
    graph.push(...xl);
    if (isArchimateFocus(t.focus)) {
      const f = t.focus;
      const fIri = focusIri(idOf(t.id), f);
      node["foaf:focus"] = { "@id": fIri };
      const elRef = (r: string) => {
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(r)) return { "@id": r };
        const target = g.terms.find((u) => u.id === r)!;
        return { "@id": focusIri(idOf(r), target.focus!) };
      };
      // Each relationship is a predicate in ArchiMate's namespace, lower-cased
      // as RDF properties are: `archimate:serving`, `archimate:realization`.
      const rels: Record<string, { "@id": string }[]> = {};
      for (const r of f.relationships ?? []) (rels[`archimate:${r.type[0]!.toLowerCase()}${r.type.slice(1)}`] ??= []).push(elRef(r.target));
      graph.push({ "@id": fIri, "@type": `archimate:${f.archimate}`, "rdfs:label": langValues(t.prefLabel, srcLang), ...rels });
    } else if (isOrgFocus(t.focus)) {
      const f = t.focus;
      const fIri = focusIri(idOf(t.id), f);
      node["foaf:focus"] = { "@id": fIri };
      const orgRef = (r: string) => {
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(r)) return { "@id": r };
        const parent = g.terms.find((u) => u.id === r)!;
        return { "@id": focusIri(idOf(r), parent.focus!) };
      };
      graph.push({
        "@id": fIri,
        "@type": `org:${f.type}`,
        "rdfs:label": langValues(t.prefLabel, srcLang),
        ...(f.homepage ? { "foaf:homepage": { "@id": f.homepage } } : {}),
        ...(f.subOrganizationOf?.length ? { "org:subOrganizationOf": f.subOrganizationOf.map(orgRef) } : {}),
        ...(f.sameAs?.length ? { "owl:sameAs": f.sameAs.map((x) => ({ "@id": x })) } : {}),
      });
    }
  }
  if (g.ordered && g.terms.length) {
    // The order is part of what was said: a reader meets each term after the
    // terms its definition uses. SKOS states it with an OrderedCollection,
    // whose memberList is an RDF list — `@list` in JSON-LD.
    graph.push({
      "@id": `${scheme}#order`,
      "@type": "skos:OrderedCollection",
      "skos:prefLabel": `${g.title}, in order`,
      "skos:memberList": { "@list": g.terms.map((t) => ({ "@id": idOf(t.id) })) },
    });
  }
  if (g.members?.length) {
    graph.push({
      "@id": `${scheme}#members`,
      "@type": "skos:Collection",
      "skos:prefLabel": `${g.title}: external terms`,
      "skos:member": g.members.map((m) => ({ "@id": m })),
    });
  }
  const hasFocus = g.terms.some((t) => isOrgFocus(t.focus));
  const hasElement = g.terms.some((t) => isArchimateFocus(t.focus));
  const context = {
    skos: SKOS_NS,
    dcterms: DCTERMS_NS,
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    ...(hasFocus || hasElement ? { foaf: FOAF_NS } : {}),
    ...(hasFocus ? { org: ORG_NS, owl: OWL_NS } : {}),
    ...(hasElement ? { archimate: ARCHIMATE_NS } : {}),
    ...(hasXl ? { skosxl: SKOSXL_NS, fa: coreNs } : {}),
  };
  const prov = automated ? automatedNodes(automatedGraphIri(ns, g), idOf, automated.matches, automated.agent) : [];
  if (!prov.length) return { "@context": context, "@graph": graph };
  // PROV-JSONLD's context comes FIRST and ours after it, so our prefixes win
  // any clash. It is named by URL and never fetched here: a reader that
  // verifies serves the copy pinned by sha256 (`publish:verify`'s
  // localLoader). Every @id is absolute, so no @base is relied on; in a
  // remote context it would be ignored anyway (`ld-no-base-in-a-remote-context`).
  return {
    "@context": [PROV_CONTEXT, { ...context, prov: "http://www.w3.org/ns/prov#" }],
    "@graph": [...graph, ...prov],
  };
}
