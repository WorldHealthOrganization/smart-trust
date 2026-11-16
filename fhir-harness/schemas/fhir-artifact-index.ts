/**
 * The artefact index of a published FHIR Implementation Guide.
 *
 * @module schemas/fhir-artifact-index
 * @graphNode schema
 *
 * ## What this models, and why it is not `catalogue`
 *
 * A published IG is a remote corpus modelled by reference — which is
 * {@link module:schemas/catalogue} word for word, and the two share
 * {@link MaterializationSchema} for exactly that reason. What they do not
 * share is a SHAPE. A catalogue node is a container or an item with a
 * `flavour`; a FHIR artefact is a `resourceType` at a CANONICAL URL, published
 * simultaneously in several representations, in a versioned package, against a
 * FHIR version. None of those five facts has anywhere to live on a
 * `CatalogueNode`, and a `flavour: "fhir"` that smuggled them into free text
 * would be a catalogue that cannot answer the only questions anybody asks of
 * an IG.
 *
 * So: different code, not different rules — the test AGENTS.md sets for adding
 * a content type, applied one level down to a graph typology.
 *
 * ## The index is RECONSTRUCTED, never downloaded
 *
 * This is the finding that shaped the module, measured 2026-09-21 against the
 * `gh-pages` branch of the WHO SMART Trust IG's repository (342,656 files;
 * IG v1.8.0; FHIR 5.0.0):
 *
 * > **No IG publishes an artefact-index instance document.**
 *
 * `ValueSets.schema.json` and `LogicalModels.schema.json` sit at the published
 * ROOT — not under `schemas/`, contrary to how the IG's API hub page links them — and
 * both are JSON *Schemas* describing the shape of an enumeration response.
 * Each carries an `example` block that happens to hold the real list. There is
 * no `ValueSets.json`. An ingest that went looking for the index would find a
 * description of one.
 *
 * Hence {@link IndexProvenanceSchema}, and hence its being REQUIRED: every
 * field in this graph was assembled from some file, and a reader who cannot
 * tell which cannot tell a transcription from an inference.
 *
 * ## Two layers, and only one of them is universal
 *
 * | layer | supplies | present in |
 * |---|---|---|
 * | IG-publisher standard | `package/.index.json`, `canonicals.json`, `artifacts.html`, `package.manifest.json` | **every** IG |
 * | IG API | `.schema.json`, `.displays.json`, `.openapi.json`, `.jsonld` per artefact, plus JSON-LD contexts | only IGs that publish one |
 *
 * The standard layer is the SPINE and the IG API is an {@link SidecarOverlaySchema |
 * overlay}. That ordering is what keeps the type valid for an IG with no IG
 * API — the overlay is simply absent — and it is why `sidecars` is optional on an
 * artefact rather than the artefact being optional on a sidecar entry.
 *
 * ## Two traps, recorded so no pipeline re-learns them
 *
 * **`openapi/openapi.json` is not the IG API.** In the WHO SMART Trust IG that path
 * holds the *DDCC Gateway* API — a domain API about certificate exchange that
 * merely lives there. A pipeline globbing for `openapi` will file a subject-
 * matter API as an artefact descriptor. {@link SidecarOverlaySchema.openapi} is
 * therefore keyed off the ARTEFACT's name, never off a directory scan.
 *
 * **`.index.json` is lossy.** Its Organization entries in the WHO SMART Trust IG carry a
 * truncated `"type": "["`. `canonicals.json` gives `id`/`type`/`url`/`version`/
 * `name` and is the better spine for anything canonical; `.index.json` is the
 * better spine for the rest, because it is the only file listing artefacts
 * that have no canonical URL at all. Neither is sufficient alone, which is why
 * {@link IndexProvenanceSchema} records both rather than naming a winner.
 *
 * ## Counts
 *
 * {@link FhirArtifactIndexSchema} carries a `count`, and it is checked against
 * `artifacts.length` by a refinement rather than trusted. This is not the
 * "never quote a count from prose" rule being broken — that rule is about
 * PROSE, where a number is a claim nothing re-derives. A machine-written count
 * that fails validation when it disagrees with the array is the opposite: it
 * is the claim and its check shipped together. The published enumeration
 * schemas require `count` too, so dropping it would make a round-trip to the
 * IG API's own shape lossy.
 */
import { z } from "zod";
import { MaterializationSchema } from "../../folio-assistant-core/schemas/materialization.js";

export const FHIR_ARTIFACT_INDEX_SCHEMA_TAG = "folio-fhir-artifact-index/v2";
export const FHIR_ARTIFACT_SCHEMA_TAG = "folio-fhir-artifact/v1";

/**
 * How the IG's published output was reached.
 *
 * `gh-pages` and `output` are the two the request named, and they are NOT the
 * same evidence: `output/` is a LOCAL build whose contents depend on who ran
 * the publisher and when, while `gh-pages` is what the world can see. An index
 * built from the first and labelled as the second would assert public
 * availability for artefacts that may never have been published.
 */
export const IG_SOURCE_KINDS = ["gh-pages", "output", "url"] as const;
export type IgSourceKind = (typeof IG_SOURCE_KINDS)[number];

export const IgSourceSchema = z
  .object({
    kind: z.enum(IG_SOURCE_KINDS),
    /** The URI the artefacts are published AT — what a `published` URL is resolved against. */
    of: z.string().min(1),
    /** Git revision of the branch read, when the source was a checkout. Absent means not established. */
    revision: z.string().min(1).optional(),
    /** When the source was read. An index with no read date cannot be told from a current one. */
    readAt: z.string().min(1),
  })
  .strict();
export type IgSource = z.infer<typeof IgSourceSchema>;

/**
 * Which published file each part of the index came out of.
 *
 * REQUIRED, and every field is a published path rather than a description.
 * The module doc says why: no IG publishes an index, so every row here was
 * assembled, and "assembled from `canonicals.json`" and "assembled from an
 * `example` block inside a schema" are different degrees of evidence that a
 * reader must be able to tell apart.
 *
 * A field absent means that file was not present in the source — which is a
 * fact about the IG, not a gap in the ingest. `artifactsHtml` absent means the
 * IG published no artefact page, and every artefact's `category` will then be
 * absent too, rather than guessed.
 */
export const IndexProvenanceSchema = z
  .object({
    /** `package.manifest.json` — package id, version, FHIR version, build date. */
    packageManifest: z.string().min(1).optional(),
    /** `canonicals.json` — the spine for anything with a canonical URL. */
    canonicals: z.string().min(1).optional(),
    /** `package.tgz` -> `package/.index.json` — the spine for everything else. Lossy; see the module doc. */
    packageIndex: z.string().min(1).optional(),
    /** `artifacts.html` — the ONLY source of an artefact's editorial category. */
    artifactsHtml: z.string().min(1).optional(),
    /**
     * The IG API enumeration schemas, when present.
     *
     * Named in the plural and as PATHS because there is one per enumerated
     * type (`ValueSets.schema.json`, `LogicalModels.schema.json`, ...) and
     * because what was read is a schema's `example`, not a response.
     */
    sidecarEnumerations: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type IndexProvenance = z.infer<typeof IndexProvenanceSchema>;

/**
 * One published representation of one artefact.
 *
 * `url` is absolute and RESOLVED, never composed — the same rule
 * `readme-sections.ts` applies to a README link, and for the same reason: a
 * composed URL is a guess that looks like a fact.
 */
export const RepresentationSchema = z
  .object({
    url: z.string().min(1),
    /** Instance-relative path, present iff these bytes were materialised. */
    localPath: z.string().min(1).optional(),
    bytes: z.number().int().nonnegative().optional(),
  })
  .strict();
export type Representation = z.infer<typeof RepresentationSchema>;

/**
 * The representations the IG publisher emits for every artefact.
 *
 * All optional: an IG may omit Turtle, and an artefact that exists only as an
 * example has no `html` page of its own.
 */
export const PublishedFormatsSchema = z
  .object({
    json: RepresentationSchema.optional(),
    xml: RepresentationSchema.optional(),
    ttl: RepresentationSchema.optional(),
    html: RepresentationSchema.optional(),
  })
  .strict();
export type PublishedFormats = z.infer<typeof PublishedFormatsSchema>;

/**
 * The IG API overlay — the JSON Schema / JSON-LD surface, where one exists.
 *
 * This is the half the request is actually about: "recreate artefact index
 * linking to json/jsonschema". An artefact with no `sidecars` is not a defect; it
 * is an artefact the IG API does not cover, and in the WHO SMART Trust IG that is 655 of
 * 674.
 *
 * `codeCount` and `propertyCount` are the two fields the published enumeration
 * schemas define, kept under their own names rather than merged into one
 * `count`: a ValueSet's code count and a logical model's property count are
 * different measurements, and a reader handed `count: 5` could not say which.
 */
export const SidecarOverlaySchema = z
  .object({
    /** `schemas/<name>.schema.json` — the JSON Schema for this artefact. */
    schema: RepresentationSchema.optional(),
    /** `schemas/<name>.displays.json` — display strings, keyed by code. */
    displays: RepresentationSchema.optional(),
    /** `schemas/<name>.openapi.json` — this ARTEFACT's OpenAPI fragment. Never `openapi/openapi.json`; see the module doc. */
    openapi: RepresentationSchema.optional(),
    /** `<name>.jsonld` — the JSON-LD vocabulary, published at the IG ROOT, not under `schemas/`. */
    jsonld: RepresentationSchema.optional(),
    /** Number of codes, for a ValueSet. */
    codeCount: z.number().int().nonnegative().optional(),
    /** Number of properties, for a logical model. */
    propertyCount: z.number().int().nonnegative().optional(),
  })
  .strict();
export type SidecarOverlay = z.infer<typeof SidecarOverlaySchema>;

/** A FHIR concept as a resource writes it: its text and its codings, nothing resolved. */
export const FhirConceptSchema = z
  .object({
    text: z.string().min(1).optional(),
    coding: z
      .array(
        z
          .object({
            system: z.string().min(1).optional(),
            code: z.string().min(1).optional(),
            display: z.string().min(1).optional(),
          })
          .strict(),
      )
      .min(1)
      .optional(),
  })
  .strict()
  .refine((c) => c.text !== undefined || c.coding !== undefined, "a concept with neither text nor a coding says nothing");
export type FhirConcept = z.infer<typeof FhirConceptSchema>;

/**
 * One artefact of the IG.
 *
 * `canonical` is OPTIONAL and that is load-bearing: examples and instance
 * resources have no canonical URL, and they are a majority of a large IG. A
 * schema that required one would push the ingest into minting canonicals that
 * resolve to nothing — the `collection/hq-publications` failure in the
 * who-iris catalogue, where inventing a UUID to fill a slot was refused for
 * the same reason.
 *
 * `category` is the editorial grouping from `artifacts.html`
 * ("Terminology: Value Sets"). Absent means the IG published no artefact page,
 * never "uncategorised" — the three-state discipline this repository applies
 * to every determination.
 */
export const FhirArtifactSchema = z
  .object({
    $schema: z.literal(FHIR_ARTIFACT_SCHEMA_TAG).optional(),
    /** Stable within the index: `<resourceType>/<id>`, which is unique where a bare id is not. */
    key: z.string().min(1),
    resourceType: z.string().min(1),
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    /** FHIR canonical URL. Absent for examples and instances; see the doc above. */
    canonical: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    /** Editorial grouping from `artifacts.html`. Absent means the IG published no artefact page. */
    category: z.string().min(1).optional(),
    /**
     * Position on the Publisher's `artifacts.html`, 0-based, first appearance.
     * The category's order and the artefact's order within it are both read
     * off this — a renderer that must match the Publisher's page (owner,
     * 2026-10-01: every phase renders equivalent to the standard IG render)
     * has no other source for either. Absent exactly when `category` is.
     */
    listedAt: z.number().int().nonnegative().optional(),
    /**
     * The resource's own `meta.profile`: the profiles it says it conforms to,
     * as written. An instance has no canonical, title or description of its
     * own, and this and `code` are what it does state; a list that showed
     * neither showed an empty row. Absent when the resource claims none.
     */
    profiles: z.array(z.string().min(1)).min(1).optional(),
    /**
     * The resource's own `code` when it is a concept (`Basic.code`, a
     * CodeableConcept; `Questionnaire.code`, a list of Codings, kept as the
     * codings with no text). A string `code` (SearchParameter's) is a
     * computable name, not a concept, and is not this. Copied, never looked up:
     * a coding with no display stays without one.
     */
    code: FhirConceptSchema.optional(),
    published: PublishedFormatsSchema,
    sidecars: SidecarOverlaySchema.optional(),
    materialization: MaterializationSchema,
  })
  .strict();
export type FhirArtifact = z.infer<typeof FhirArtifactSchema>;

/**
 * A JSON-LD context the IG publishes for its own consumers.
 *
 * Indexed at the IG level rather than per artefact because a context is shared
 * — the WHO SMART Trust IG's `tng-context/v1.jsonld` binds terms drawn from four separate
 * ValueSets — so hanging it off any one artefact would misstate what it covers.
 */
export const JsonLdContextSchema = z
  .object({
    id: z.string().min(1),
    representation: RepresentationSchema,
    /** Canonical URLs of the artefacts whose terms this context binds, where that could be established. */
    binds: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type JsonLdContext = z.infer<typeof JsonLdContextSchema>;

/**
 * The index document — one per published IG.
 *
 * `sidecarApi` is a three-state determination and NOT a boolean derived from
 * whether any artefact carries an overlay. "This IG publishes no IG API" and
 * "the ingest did not look" are different facts, and only the first is a
 * reason to stop ingesting.
 */
/**
 * An IG API sidecar the enumeration lists that could not be bound to an artefact.
 *
 * RECORDED RATHER THAN DROPPED, and that is the whole reason this type exists.
 * The WHO SMART Immunizations IG publishes 198 JSON Schemas and the first ingest bound
 * 188 — the ten Logical Models are named after the model's TITLE
 * (`StructureDefinition-IMMZ_C4_Create_client_record`) while the artefact's id
 * is `IMMZC4`, so a filename composed as `<ResourceType>-<id>` missed every
 * one of them. The count came out ten short and nothing said so.
 *
 * A printed warning would have been gone by the next run. An entry here
 * survives in the committed index, so "this IG names its sidecars in a way we
 * cannot bind" and "this IG has no sidecars" stay different facts.
 */
export const UnboundSidecarSchema = z
  .object({
    /** The sidecar file the enumeration named. */
    filename: z.string().min(1),
    /** Its title, as the enumeration gives it — usually the only human handle on what was missed. */
    title: z.string().min(1).optional(),
    /** Which enumeration listed it. */
    enumeration: z.string().min(1),
    /** Why no artefact matched: the strategies tried, in order. */
    reason: z.string().min(1),
  })
  .strict();
export type UnboundSidecar = z.infer<typeof UnboundSidecarSchema>;

export const SIDECAR_API_STATES = ["unknown", "absent", "present"] as const;
export type SidecarApiState = (typeof SIDECAR_API_STATES)[number];

export const FhirArtifactIndexSchema = z
  .object({
    $schema: z.literal(FHIR_ARTIFACT_INDEX_SCHEMA_TAG),
    /** Instance id — the directory this index lives in, e.g. `<ig>`. */
    id: z.string().min(1),
    title: z.string().min(1),
    /** NPM-style package id, e.g. `hl7.fhir.uv.ips`. */
    packageId: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    /** The IG's own publication status (`draft`, `active`, `retired`), from its ImplementationGuide resource. */
    status: z.string().min(1).optional(),
    fhirVersion: z.array(z.string().min(1)).optional(),
    /** The canonical base every artefact's canonical URL extends, e.g. `http://hl7.org/fhir/uv/ips`. */
    canonicalBase: z.string().min(1).optional(),
    /** The IG's own build timestamp, verbatim from `package.manifest.json`. Not reformatted: a transcription that normalises is no longer a transcription. */
    builtAt: z.string().min(1).optional(),
    source: IgSourceSchema,
    provenance: IndexProvenanceSchema,
    sidecarApi: z.enum(SIDECAR_API_STATES),
    contexts: z.array(JsonLdContextSchema).optional(),
    /**
     * The IG API hub: the region of the IG's hub page between the two markers
     * its post-processing writes after the Publisher has run (`ig-api.html`
     * between `IG_API_HUB_START` and `IG_API_HUB_END` by default; an overlay
     * whose post-processing uses other names passes them to the ingest).
     * `url` is the page it was read from; `localPath` is the fragment, held so
     * a page can fetch it (bean `680p`) rather than retype its prose — as a
     * JSON node (`{ from, between, html }`), because an `.html` fragment
     * published in the served graph would be a page with no <body>. Absent
     * means the IG publishes no hub, or it was not materialised.
     *
     * `placeholder` is the comment the hub page's SOURCE holds where the
     * post-processing writes the hub, so an IG site rendered from that source
     * knows where to put it back. Recorded per IG at ingest because the
     * layer that stages every IG's site at once has no other per-IG place to
     * read it from, and names no post-processor's marker itself (bean `d313`;
     * this field was `dakApiHub` until then).
     *
     * No page reads a `localPath` fragment any more: that path was retired once
     * no IG layer committed its index (#124). Built at publish
     * (`build-ig-indexes`, bean `h7ap`) it holds no copy, no
     * `localPath`: the hub is drawn from the index's own bound sidecars
     * (`ig-api-hub.ts`), and `url` is the IG's hub page. `label` is what the
     * layer above calls the API (`ig-api.json`); absent, "IG API".
     */
    igApiHub: RepresentationSchema.extend({ placeholder: z.string().min(1).optional(), label: z.string().min(1).optional() }).optional(),
    /**
     * The IG's own `package.tgz` — every resource's JSON in one file, as the
     * Publisher packaged it. Held (`--materialize-package`) so a page can
     * fetch the one archive and read a resource out of it in the browser,
     * rather than this graph copying hundreds of resource files (bean `680p`,
     * `visualizer-loading`). Absent means not held.
     */
    package: RepresentationSchema.optional(),
    /**
     * Sidecars an enumeration listed that bound to no artefact. Absent means
     * none; an empty array is not written. See {@link UnboundSidecarSchema}
     * for why these are recorded rather than warned about and forgotten.
     */
    sidecarsUnbound: z.array(UnboundSidecarSchema).optional(),
    /**
     * Where the bound sidecars' bytes are read from when the site does not
     * hold them: an absolute base, the IG API in the AST cache commit
     * (`https://raw.githubusercontent.com/<owner>/<repo>/<sha>/ig-api/sidecars`;
     * owner, 2026-11-10, card "A"). A sidecar is then fetched at
     * `<sidecarBase>/<file>` (`ig-api-hub.ts` `sidecarHref`), and its
     * `localPath` stays the path it would be held at. Absent, each is served at
     * its `localPath`.
     */
    sidecarBase: z.string().url().optional(),
    count: z.number().int().nonnegative(),
    artifacts: z.array(FhirArtifactSchema),
  })
  .strict()
  .refine((ix) => ix.count === ix.artifacts.length, {
    message: "count must equal artifacts.length — a count that disagrees with its array is the failure this field exists to catch",
    path: ["count"],
  })
  .refine((ix) => ix.sidecarApi !== "absent" || ix.artifacts.every((a) => a.sidecars === undefined), {
    message: "sidecarApi is 'absent' but an artefact carries an IG API overlay",
    path: ["sidecarApi"],
  })
  .refine((ix) => new Set(ix.artifacts.map((a) => a.key)).size === ix.artifacts.length, {
    message: "artifact keys must be unique within an index",
    path: ["artifacts"],
  });
export type FhirArtifactIndex = z.infer<typeof FhirArtifactIndexSchema>;

/**
 * How many artefacts are in each materialisation state.
 *
 * Mirrors `materializationCensus` in `catalogue.ts` deliberately: the question
 * "what have we actually got" is asked of both graphs by the same reader, and
 * two functions with different shapes would make the two answers
 * incomparable.
 */
export function materializationCensus(artifacts: FhirArtifact[]): Record<string, number> {
  const census: Record<string, number> = { unknown: 0, referenced: 0, materialized: 0 };
  for (const a of artifacts) census[a.materialization.state] = (census[a.materialization.state] ?? 0) + 1;
  return census;
}

/**
 * How many artefacts carry each part of the IG API overlay.
 *
 * Reported per SIDECAR rather than as one "has sidecars" tally, because the four
 * are independently published: the WHO SMART Trust IG emits `.displays.json` for every
 * ValueSet but for no logical model, and a single count would hide that.
 */
export function sidecarCensus(artifacts: FhirArtifact[]): Record<string, number> {
  const census: Record<string, number> = { schema: 0, displays: 0, openapi: 0, jsonld: 0 };
  for (const a of artifacts) {
    if (!a.sidecars) continue;
    for (const k of ["schema", "displays", "openapi", "jsonld"] as const) {
      if (a.sidecars[k]) census[k] += 1;
    }
  }
  return census;
}

/**
 * Artefacts grouped by their `artifacts.html` category.
 *
 * Artefacts with no category are grouped under `undefined` rather than under a
 * coined "Other": the IG's own artefact page HAS a literal "Other" section,
 * and inventing a second one with the same name would make "Other" mean two
 * different things in one index.
 */
/**
 * The file stem of an artefact's page on a site rendered from this index:
 * `<ResourceType>-<id>`, with anything outside `[A-Za-z0-9._-]` made `_`.
 *
 * One rule, read by every generator that writes or links such a page —
 * `gen-smart-trust-pages.ts` writes them, `build-ig-site.ts` links to them
 * from an IG's `artifacts` page (bean `jut3`). Two copies of the rule would be
 * two answers to "what is this artefact's URL", free to disagree silently.
 */
export function artifactPageName(a: { resourceType: string; id: string }): string {
  return `${a.resourceType}-${a.id}`.replace(/[^A-Za-z0-9._-]/g, "_");
}

/**
 * In the Publisher's order, read off `listedAt` rather than restated (#1901):
 * categories by their first artefact's position on `artifacts.html`, artefacts
 * within one by their own, the uncategorised bucket last. An alphabetical sort
 * put Terminology: Code Systems ahead of Requirements on the WHO SMART Trust IG, which is
 * the opposite of the page it mirrors. Ties (no `listedAt`) keep input order.
 */
export function byCategory(artifacts: FhirArtifact[]): Map<string | undefined, FhirArtifact[]> {
  const out = new Map<string | undefined, FhirArtifact[]>();
  for (const a of artifacts) {
    const bucket = out.get(a.category) ?? [];
    bucket.push(a);
    out.set(a.category, bucket);
  }
  const at = (a: FhirArtifact) => a.listedAt ?? Number.POSITIVE_INFINITY;
  const first = (list: FhirArtifact[]) => Math.min(...list.map(at));
  for (const list of out.values()) list.sort((x, y) => at(x) - at(y));
  return new Map(
    [...out.entries()].sort(([ka, a], [kb, b]) =>
      ka === undefined ? (kb === undefined ? 0 : 1) : kb === undefined ? -1 : first(a) - first(b),
    ),
  );
}
