/**
 * One FHIR IG artefact as a JSON-LD node — the asset an artefact's thin page
 * renders (`kg-viewer` rule 3: one IRI per asset, its page a separate
 * resource that loads it).
 *
 * @module fhir-harness/schemas/ig-artifact-jsonld
 * @covers ig-artifact-jsonld
 *
 * ## Borrowed vocabularies, nothing minted
 *
 * Owner, 2026-10-11 (option A): *"tiny html w/ dynamic load from json(ld)
 * KG"*, with the JSON-LD free of anything WHO's (fhir-harness/AGENTS.md).
 *
 * | term | what it says |
 * |---|---|
 * | `@type` `fhir:<resourceType>` | the FHIR RDF class (`http://hl7.org/fhir/`), as FHIR's own Turtle types a resource |
 * | `dcterms:identifier` | the index key, `<resourceType>/<id>` |
 * | `schema:name`, `dcterms:title`, `dcterms:description`, `schema:version` | the resource's own `name`, `title`, `description`, `version` |
 * | `dcterms:type` | the Publisher's `artifacts.html` grouping |
 * | `schema:sameAs` | the FHIR canonical URL: the artefact's identity, never where its bytes are |
 * | `schema:encoding` | each representation as a `schema:MediaObject` (`schema:contentUrl`, `schema:encodingFormat`, `dcterms:source`): first the reduced copy the site serves at its root as `<Type>-<id>.json` (`local`), then the full copy in the AST cache by raw URL (`mirror`), then the IG's own published file (`upstream`) |
 * | `schema:creativeWorkStatus` | `materialized` or `referenced`, the index's own two states |
 * | `prov:wasGeneratedBy` | for a compiled copy, the toolchain (`schema:instrument`) and the revision it built (`prov:used`) |
 * | `dcterms:isPartOf` | the IG, by package id, version and canonical base |
 * | `dcterms:conformsTo` | the resource's own `meta.profile`, each profile by its canonical URL |
 * | `dcterms:subject` | the resource's own `code` concept, each coding a `schema:DefinedTerm` (`schema:termCode`, its display as `schema:name`, its system as `schema:inDefinedTermSet`), and the concept's `text`, when it has one, a `schema:DefinedTerm` with only a `schema:name` |
 *
 * The last two are what an INSTANCE (an artefact with no canonical URL) states about itself, and are written for instances only. A configuration
 * instance (a `Basic` that is a page, a role or a task) has no title or
 * description, and its list row was empty until it showed them (owner,
 * 2026-10-12). Both are copied from the resource, never looked up: a coding
 * with no display has no `schema:name`.
 *
 * FHIR RDF is used for the CLASS only. Its property shape (`fhir:url [ fhir:v
 * "…" ]`) describes a whole resource, which this node deliberately is not:
 * the resource's bytes are one of its `schema:encoding`s, and the page fetches
 * them. A node that restated half a resource in FHIR RDF would be a second,
 * partial copy that could disagree with the first.
 *
 * The node carries NO link to its renderings: the page points at the node,
 * never the other way round (`thin-page.ts`).
 *
 * `$schema` names the family for `check:kind-validators`. It is not a term
 * of the context, so a JSON-LD processor drops it on expansion and it adds no
 * triple.
 *
 * @graphNode schema
 */
import { z } from "zod";

import { nodeKind } from "@litlfred/cat-harness-tools/schemas/kg/node-kind.ts";

export const IG_ARTIFACT_JSONLD_SCHEMA_TAG = "folio-ig-artifact-jsonld/v1";

export const IG_ARTIFACT_JSONLD_CONTEXT = {
  fhir: "http://hl7.org/fhir/",
  dcterms: "http://purl.org/dc/terms/",
  schema: "https://schema.org/",
  prov: "http://www.w3.org/ns/prov#",
} as const;

/** The media type FHIR registers for its JSON. */
export const FHIR_JSON = "application/fhir+json";

const IdRef = z.object({ "@id": z.string().min(1) }).strict();

/** `dcterms:conformsTo`: the profiles the resource claims, by canonical URL, as written. */
export const IgConformsToSchema = z.array(IdRef).min(1);

/** One term of `dcterms:subject`: a coding of the resource's `code`, or the concept's text alone. */
export const IgDefinedTermSchema = z
  .object({
    "@type": z.literal("schema:DefinedTerm"),
    "schema:termCode": z.string().min(1).optional(),
    "schema:name": z.string().min(1).optional(),
    "schema:inDefinedTermSet": IdRef.optional(),
  })
  .strict()
  .refine((t) => t["schema:termCode"] !== undefined || t["schema:name"] !== undefined, "a term with neither a code nor a name says nothing");
export type IgDefinedTerm = z.infer<typeof IgDefinedTermSchema>;
export const IgSubjectSchema = z.array(IgDefinedTermSchema).min(1);

export const IgArtifactEncodingSchema = z
  .object({
    "@type": z.literal("schema:MediaObject"),
    "schema:contentUrl": IdRef,
    "schema:encodingFormat": z.string().min(1),
    /**
     * `local`: a copy this site serves (the reduced `<Type>-<id>.json` at the
     * site root, listed first); `mirror`: the full copy in the IG's AST cache,
     * by raw URL pinned to the cache commit; `upstream`: the file where the IG
     * publishes it.
     */
    "dcterms:source": z.enum(["local", "mirror", "upstream"]),
  })
  .strict();
export type IgArtifactEncoding = z.infer<typeof IgArtifactEncodingSchema>;

/**
 * The type and the key are two statements of one fact; a node whose two
 * disagree is a generator bug, not a choice. Named so the schema and its node
 * kind run the same check.
 */
const typeMatchesKey = (n: { "@type": string; "dcterms:identifier": string }, ctx: z.RefinementCtx): void => {
  if (n["@type"] !== `fhir:${n["dcterms:identifier"].split("/")[0]}`) {
    ctx.addIssue({ code: "custom", path: ["@type"], message: `${n["@type"]} does not match the key ${n["dcterms:identifier"]}` });
  }
};

export const IgArtifactJsonLdSchema = z
  .object({
    "@context": z.object({ fhir: z.literal(IG_ARTIFACT_JSONLD_CONTEXT.fhir), dcterms: z.string(), schema: z.string(), prov: z.string() }).strict(),
    $schema: z.literal(IG_ARTIFACT_JSONLD_SCHEMA_TAG),
    "@id": z.string().min(1),
    "@type": z.string().regex(/^fhir:[A-Z][A-Za-z]+$/, "a FHIR RDF class, fhir:<ResourceType>"),
    "dcterms:identifier": z.string().regex(/^[A-Z][A-Za-z]+\/[A-Za-z0-9\-.]{1,64}$/, "<resourceType>/<id>"),
    "schema:name": z.string().min(1).optional(),
    "dcterms:title": z.string().min(1).optional(),
    "dcterms:description": z.string().min(1).optional(),
    "schema:version": z.string().min(1).optional(),
    "dcterms:type": z.string().min(1).optional(),
    "schema:sameAs": IdRef.optional(),
    "schema:creativeWorkStatus": z.enum(["materialized", "referenced"]),
    "schema:encoding": z.array(IgArtifactEncodingSchema),
    "prov:wasGeneratedBy": z
      .object({
        "@type": z.literal("prov:Activity"),
        "schema:instrument": z.string().min(1),
        "prov:used": z.string().min(1),
      })
      .strict()
      .optional(),
    "dcterms:isPartOf": z
      .object({
        "@type": z.literal("fhir:ImplementationGuide"),
        "dcterms:identifier": z.string().min(1).optional(),
        "schema:version": z.string().min(1).optional(),
        "schema:sameAs": IdRef.optional(),
      })
      .strict(),
    "dcterms:conformsTo": IgConformsToSchema.optional(),
    "dcterms:subject": IgSubjectSchema.optional(),
  })
  .strict()
  .superRefine(typeMatchesKey);
export type IgArtifactJsonLd = z.infer<typeof IgArtifactJsonLdSchema>;

/**
 * `folio-ig-artifact-jsonld/v1` as a node kind (issue #2195), so
 * `validators/ig-artifact-jsonld.json` names a kind and `node-kinds:check`
 * files the family under it. Unversioned: the family's tag is not SemVer, so
 * the `$schema` literal stays a field of the shape. Strict and refined exactly
 * as {@link IgArtifactJsonLdSchema} is.
 */
export const IgArtifactJsonLdKind = nodeKind("folio-ig-artifact-jsonld", [], IgArtifactJsonLdSchema.shape, { strict: true, refine: typeMatchesKey });

/**
 * The IG's artefact INDEX as one JSON-LD node: the list the thin `artifacts`
 * and `toc` pages draw (owner, 2026-10-11, option A; "make thin default",
 * 2026-10-12), so neither page fetches every artefact's node to draw a list.
 *
 * Written beside the nodes, `artifact/index.jsonld` (no artefact page name
 * can be `index`: every one is `<Type>-<id>`). The same vocabularies:
 *
 * | term | what it says |
 * |---|---|
 * | `@type` `fhir:ImplementationGuide` | the IG the list is of |
 * | `dcterms:identifier`, `schema:version`, `schema:sameAs` | its package id, version and canonical base |
 * | `dcterms:title` | the IG's display name, as the site shows it |
 * | `schema:numberOfItems` | how many artefacts the index holds; QA holds the list to it |
 * | `schema:hasPart` | one entry per artefact, in the Publisher's order (`byCategory`), each naming its node by `@id` and repeating only what a list row shows: key, class, title, description, grouping, and for an instance (no canonical URL), which has no description to show, what the resource states instead — its profiles (`dcterms:conformsTo`) and its code (`dcterms:subject`). Its canonical (`schema:sameAs`) is repeated so a row can link a profile that is another artefact of the same IG, and its computer name (`schema:name`) only when the title shown is not that name and it is not the id, so the IG's search (`ig-search.js`) finds an artefact by every identifier from this one list. `schema:contentUrl` is the resource file the site serves at its root, `<Type>-<id>.json`, the node's first `local` encoding |
 *
 * An entry is a SUMMARY of the node it names, never a second home for a fact
 * the node lacks: `check` holds every entry's key, class, canonical, profiles,
 * code and name to its node's.
 */
export const IG_ARTIFACT_INDEX_JSONLD_SCHEMA_TAG = "folio-ig-artifact-index-jsonld/v1";

export const IgArtifactIndexEntrySchema = z
  .object({
    "@id": z.string().min(1),
    "@type": z.string().regex(/^fhir:[A-Z][A-Za-z]+$/),
    "dcterms:identifier": z.string().regex(/^[A-Z][A-Za-z]+\/[A-Za-z0-9\-.]{1,64}$/),
    "dcterms:title": z.string().min(1),
    "schema:name": z.string().min(1).optional(),
    "dcterms:description": z.string().min(1).optional(),
    "dcterms:type": z.string().min(1).optional(),
    "schema:sameAs": IdRef.optional(),
    "dcterms:conformsTo": IgConformsToSchema.optional(),
    "dcterms:subject": IgSubjectSchema.optional(),
    /** The resource this site serves at its root, `<Type>-<id>.json` (the node's first `local` encoding), so a harvester finds every file from this one list. */
    "schema:contentUrl": IdRef.optional(),
  })
  .strict();
export type IgArtifactIndexEntry = z.infer<typeof IgArtifactIndexEntrySchema>;

/** The count is the list's length, and every entry's type agrees with its key. Shared by the schema and its node kind. */
const indexAgrees = (
  n: { "schema:numberOfItems": number; "schema:hasPart": { "@type": string; "dcterms:identifier": string }[] },
  ctx: z.RefinementCtx,
): void => {
  if (n["schema:hasPart"].length !== n["schema:numberOfItems"]) {
    ctx.addIssue({ code: "custom", path: ["schema:numberOfItems"], message: `says ${n["schema:numberOfItems"]}, lists ${n["schema:hasPart"].length}` });
  }
  n["schema:hasPart"].forEach((e, i) => {
    if (e["@type"] !== `fhir:${e["dcterms:identifier"].split("/")[0]}`) {
      ctx.addIssue({ code: "custom", path: ["schema:hasPart", i, "@type"], message: `${e["@type"]} does not match the key ${e["dcterms:identifier"]}` });
    }
  });
};

export const IgArtifactIndexJsonLdSchema = z
  .object({
    "@context": z.object({ fhir: z.literal(IG_ARTIFACT_JSONLD_CONTEXT.fhir), dcterms: z.string(), schema: z.string(), prov: z.string() }).strict(),
    $schema: z.literal(IG_ARTIFACT_INDEX_JSONLD_SCHEMA_TAG),
    "@id": z.string().min(1),
    "@type": z.literal("fhir:ImplementationGuide"),
    "dcterms:identifier": z.string().min(1).optional(),
    "schema:version": z.string().min(1).optional(),
    "schema:sameAs": IdRef.optional(),
    "dcterms:title": z.string().min(1).optional(),
    "schema:numberOfItems": z.number().int().nonnegative(),
    "schema:hasPart": z.array(IgArtifactIndexEntrySchema),
  })
  .strict()
  .superRefine(indexAgrees);
export type IgArtifactIndexJsonLd = z.infer<typeof IgArtifactIndexJsonLdSchema>;

/** `folio-ig-artifact-index-jsonld/v1` as a node kind: strict and refined exactly as {@link IgArtifactIndexJsonLdSchema} is. */
export const IgArtifactIndexJsonLdKind = nodeKind("folio-ig-artifact-index-jsonld", [], IgArtifactIndexJsonLdSchema.shape, { strict: true, refine: indexAgrees });
