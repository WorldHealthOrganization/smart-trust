/**
 * The published index files the site's viewers read — each `$schema` family
 * typed, so the graph-typology registry names a validator instead of the script
 * that writes it.
 *
 * Every schema here was taken from what its writer emits and cross-checked
 * against the committed file, so it describes the file as written.
 *
 * Two conventions hold throughout, because the writers share them:
 *
 * - `JSON.stringify` drops `undefined`, so a TypeScript `x?: T` is an ABSENT
 *   key, never `null`. Where the file does carry `null` it is modelled as
 *   `.nullable()`, and nowhere else.
 * - `tile` is the navbar count every generated index carries, typed once by
 *   {@link TileCountsSchema} and reused here.
 *
 * Objects are `.strict()`: these files are generated, so a key nobody declared
 * is a writer that changed without its schema.
 *
 * @graphNode schema
 * @module schemas/site-indexes
 */
import { z } from "zod";

import { SUMMARY_STATUSES } from "../content/block-summary.js";
import { TileCountsSchema } from "./tile-count.js";
import { WithheldEntrySchema } from "../content/withheld.js";
import { BeanIdSchema } from "../tools/tool-types.js";
import { ModelIdSchema } from "@litlfred/bootstrap-tools/schemas/model-registry.ts";

/** A generated-index envelope: its `$schema` tag and the navbar count. */
const envelope = <T extends string>(tag: T) => ({
  $schema: z.literal(tag),
  tile: TileCountsSchema,
});

const StringList = z.array(z.string());
const Count = z.number().int().nonnegative();

// ── folio-bean-index/v1 — scripts/gen-docs-pages.ts → assets/beans/index.json ──

/** One work-plan bean, as the board and the work-plan viewer read it. */
export const BeanIndexItemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    status: z.string(),
    type: z.string(),
    priority: z.string(),
    /** `""` when the bean has no parent; otherwise a typed bean id (#1168 B8). */
    parent: z.union([z.literal(""), BeanIdSchema]),
    blocking: StringList,
    blockedBy: StringList,
    createdAt: z.string(),
    updatedAt: z.string(),
    /** The body, trimmed to its first 400 characters. */
    preview: z.string(),
    /**
     * Path of the bean file ON {@link BeanIndexSchema} `fileRef` — the branch
     * that keeps the store. Equal to the checkout path while the store is on
     * `main`; since the state cutover it is a path on `cat/cat-harness/beans`.
     */
    file: z.string().min(1),
  })
  .strict();

// Declared in `bean-graph.ts`, the HARNESS layer, and imported here. The
// rollup is a bean-store concept, and `cat-harness` may not import
// the content core — core depends on harness, so the declaration has to
// sit on the side that `scripts/milestone-rollup.ts` can reach. Measured by
// `check:partition`, which refused the other direction outright.
import { MilestonePlanSchema, MilestoneRollupSchema } from "../sdlc/bean-graph.ts";

export { MilestonePlanSchema, MilestoneRollupSchema };

export const BeanIndexSchema = z
  .object({
    ...envelope("folio-bean-index/v1"),
    repoWeb: z.string().min(1),
    /**
     * The repository and branch every item's `file` is a path on. A board
     * that composes `<repoWeb>/blob/main/<file>` sends every bean to a 404
     * once the store is kept on its own branch (owner, 2026-10-13). Optional
     * so a projection written before these keys still parses; absent means
     * `repoWeb` at `main`.
     */
    fileWeb: z.string().min(1).optional(),
    fileRef: z.string().min(1).optional(),
    items: z.array(BeanIndexItemSchema),
    /**
     * The block graph as ONE edge set, `blocker → blocked`, over both
     * front-matter declarations (`blocking:` on the blocker, `blocked_by:` on
     * the blocked), deduplicated — `blockEdges` in `scripts/beans.ts`, bean
     * `vhqq`. An end may name no bean in `items`: that edge is kept here and
     * reported as a `blocking-unknown` finding, never dropped.
     */
    edges: z.array(
      z
        .object({
          blocker: BeanIdSchema,
          blocked: BeanIdSchema,
          declaredOn: z.array(z.enum(["blocked_by", "blocking"])).min(1).max(2),
        })
        .strict(),
    ),
    findings: z.array(
      z
        .object({
          kind: z.enum(["blocked-without-expiry", "blocker-closed", "blocking-unknown"]),
          bean: BeanIdSchema,
          blocks: z.string(),
          detail: z.string(),
        })
        .strict(),
    ),
    /**
     * Work plans filed wrong: an item naming a process that is not an epic or
     * a milestone, or a proposal naming no process (`workPlanFindings`,
     * `schemas/sdlc/work-plan.ts`). Written by `gen-docs-pages.ts` since
     * 089be6f8, which left this schema rejecting the index it wrote
     * (check:kind-validators, dth-hrh run 42343581318). OPTIONAL, as `plan`
     * is: an index written before the field is still valid.
     */
    planFindings: z.array(z.object({ id: z.string(), problem: z.string() }).strict()).optional(),
    /**
     * The milestone rollup the board renders. OPTIONAL, because an index
     * written before this field existed is still a valid index — and because
     * "no plan in the projection" is a state the renderer distinguishes from
     * "a plan with nothing done".
     */
    plan: MilestonePlanSchema.optional(),
  })
  .strict();

// ── folio-translation-status/v1 — scripts/gen-translation-status.ts ──

const CatalogueCountsShape = {
  entries: Count,
  translated: Count,
  fuzzy: Count,
  untranslated: Count,
};

const LocaleStatusSchema = z
  .object({
    locale: z.string().min(1),
    templates: Count,
    catalogues: Count,
    ...CatalogueCountsShape,
    unreadable: StringList,
    // `CatalogueRow` and `LocaleOfficiality` in the tools layer's
    // `scripts/gen-translation-status.ts` (bean `cat-tools-bbnd`, tools #466):
    // the translation drawer's per-catalogue rows, and who signed the locale
    // off, read from both the PO headers and `status.json`. The generator has
    // written both since #466 and this strict schema never learned them.
    // Optional: a projection written before #466 has neither.
    files: z
      .array(z.object({ path: z.string(), official: z.string().optional(), ...CatalogueCountsShape }).strict())
      .optional(),
    officiality: z
      .object({
        state: z.enum(["official", "unofficial", "disagree", "unreadable"]),
        signedOffBy: z.string().optional(),
        signedOffAt: z.string().optional(),
        officialCatalogues: Count,
        findings: Count,
      })
      .strict()
      .optional(),
  })
  .strict();

export const TranslationStatusSchema = z
  .object({
    ...envelope("folio-translation-status/v1"),
    /** `YYYY-MM-DD`: the day the counts last changed. */
    changedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** The translations directory counted, repository-relative. */
    scope: z.string(),
    /**
     * The status page, site-relative, which the translation drawer links as
     * "Full translation status" (bean `cat-tools-bbnd`). Optional: an index
     * written before the drawer existed has none.
     */
    page: z.string().optional(),
    locales: z.array(LocaleStatusSchema),
    /**
     * Every OTHER layer's declared `translation-sources` directory, each
     * measured on its own (issue #2228). Optional: an index written before
     * the field existed is still a valid index.
     */
    instances: z
      .array(
        z
          .object({
            instance: z.string().min(1),
            scope: z.string(),
            locales: z.array(LocaleStatusSchema),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

// ── folio-schema-graph/v1 — scripts/gen-schema-viz.ts ──

// The kinds `schema-graph.ts` emits as `DeclKind`. `json-schema` (a
// bootstrap `.schema.json` declaration, read since the separation) was
// missing here, so every projection carrying one failed its own validator
// — `check:kind-validators`, folio-assistant#2518. Kept equal to `DeclKind`
// by `scripts/tests/schema-graph-kinds.test.ts` rather than by memory.
export const DECL_KINDS = [
  "zod-object", "zod-union", "zod-enum", "zod-array", "zod-record", "zod-scalar",
  "interface", "type-alias", "json-schema", "fhir-logical", "fhir-profile",
  "owl-class", "rdfs-class", "rdf-property-set", "moddle-class", "moddle-enum", "undetermined",
] as const;

export const SchemaGraphIndexSchema = z
  .object({
    ...envelope("folio-schema-graph/v1"),
    roots: StringList,
    modules: z.array(
      z
        .object({
          module: z.string(),
          instance: z.string(),
          name: z.string(),
          graphNode: z.enum(["schema", "none", "undeclared"]),
          reason: z.string().optional(),
          summary: z.string().optional(),
          isTest: z.boolean(),
        })
        .strict(),
    ),
    decls: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          module: z.string(),
          kind: z.enum(DECL_KINDS),
          note: z.string().optional(),
          doc: z.string().optional(),
          fields: z.array(
            z
              .object({
                name: z.string(),
                type: z.string(),
                optional: z.boolean(),
                array: z.boolean(),
                // `min..max`, from `cardinalityOf` (bean `cat-tools-4xq6`).
                card: z.string().optional(),
                // The UML type the diagram shows, when not the written one.
                utype: z.string().optional(),
                // What a profile says of the field: MS, = fixed, ~ pattern, prohibited.
                constraint: z.string().optional(),
                // Type name -> its definition's URL (`scripts/type-links.ts`).
                links: z.record(z.string(), z.string()).optional(),
                doc: z.string().optional(),
              })
              .strict(),
          ),
          extendsNames: StringList,
          values: StringList,
          refs: StringList,
          unresolved: StringList,
          external: StringList,
          // The source label drawn upper right of the box (bean `cat-tools-4xq6`).
          source: z.enum(["zod", "typescript", "json-schema", "fhir", "fhir:profile", "skill", "owl", "rdfs", "rdf", "moddle"]).optional(),
          canonical: z.string().optional(),
          exported: z.boolean(),
        })
        .strict(),
    ),
    edges: z.array(
      z
        .object({
          from: z.string(),
          to: z.string(),
          via: z.string(),
          kind: z.enum(["field", "member", "extends", "id-ref"]),
          optional: z.boolean(),
          array: z.boolean(),
        })
        .strict(),
    ),
    // Sources asked for and not read, e.g. an artefact index built at publish.
    unread: StringList.optional(),
    // `NodeKindRow` in `scripts/gen-schema-viz.ts` (issue #2278): every node
    // kind, `$schema` family and whole-typology validator, joined to the
    // declaration that defines it. The generator has written it since #2278;
    // this strict schema never learned it, so every projection failed with
    // `Unrecognized key: "nodeKinds"` (folio-assistant#2518, 2026-10-09).
    nodeKinds: z
      .array(
        z
          .object({
            id: z.string(),
            source: z.enum(["node-kind", "family", "typology"]),
            instance: z.string().optional(),
            decl: z.string().optional(),
            tag: z.string().optional(),
            parents: StringList.optional(),
            subclasses: StringList.optional(),
            typologies: StringList,
            page: z.string().optional(),
            note: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
    // `SourceDescriptorRow` in the tools layer's `scripts/gen-schema-viz.ts`
    // (bean `folio-assistant-1nu0`): the source descriptors in the declared
    // schema directories, a separate table on the page and never folded into
    // `decls`. Written by the generator and never learned here, so every
    // projection failed with `Unrecognized key: "sources"`. Optional: an
    // index written before the field existed is still valid.
    sources: z
      .array(
        z
          .object({
            id: z.string(),
            file: z.string(),
            instance: z.string(),
            title: z.string().optional(),
            system: z.string().optional(),
            baseUrl: z.string().optional(),
            nodeKind: z.string().optional(),
            subsetStrategies: StringList.optional(),
            subsetIsSelfContained: z.boolean().optional(),
            identifiers: z
              .array(z.object({ name: z.string(), authoritative: z.boolean(), example: z.string().optional() }).strict())
              .optional(),
            enumeration: z
              .object({
                method: z.string(),
                pageSize: z.number().optional(),
                totalNodes: z.number().optional(),
                requests: z.number().optional(),
              })
              .strict()
              .optional(),
            termsUrl: z.string().optional(),
            character: z
              .object({
                remote: z.boolean(),
                large: z.boolean(),
                volatility: z.string(),
                availability: z.string(),
                hasOwnSearch: z.boolean(),
              })
              .strict()
              .optional(),
            note: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

// ── folio-library-index/v1 and folio-library-entry/v1 — scripts/gen-library-viz.ts ──

const PageNumber = z.number().int().nullable();

/**
 * Which ingest rung a library entry sits on. The one list: `IngestRung` in
 * `pipeline/gen-library-jsonld.ts` is derived from it, so a rung added
 * there is a rung this index accepts. It was two lists until the `referenced`
 * rung (bean `scfh`) met an index that knew only three.
 */
export const INGEST_RUNGS = ["paged", "tabular", "referenced", "recording", "none"] as const;

export const LibraryIndexEntrySchema = z
  .object({
    id: z.string().min(1),
    instance: z.string(),
    dir: z.string(),
    title: z.string(),
    /** The manifest's extracted title, only when a catalogue title replaced it (bean `gnqa`). */
    extractedTitle: z.string().optional(),
    provenance: z.string(),
    rung: z.enum(INGEST_RUNGS),
    docId: z.string(),
    sourceFile: z.string(),
    sourceSha256: z.string(),
    arxiv: z.string(),
    doi: z.string(),
    documentClass: z.string(),
    sections: Count,
    blocks: Count,
    /** Raster images placed (`images.json`), every role. */
    images: Count,
    /** Kept figures, raster and vector (role `figure`). Optional so an index built before it still reads. */
    figures: Count.optional(),
    ocrPages: Count,
    hasOcr: z.boolean(),
    hasManifest: z.boolean(),
    hasStructure: z.boolean(),
    hasImagesJson: z.boolean(),
    // The item's generated README on the repository host (bean `qgjh`).
    readme: z.string().url().optional(),
    /**
     * Where else to go for a `referenced` entry — an absolute URL, or a
     * site-root path with a leading `/` that the viewer composes against its
     * own base (owner, 2026-10-02: a trust IG as an external reference).
     */
    links: z
      .array(
        z
          .object({
            label: z.string().min(1),
            href: z.union([z.string().url(), z.string().regex(/^\/[a-z0-9][a-z0-9._/-]*$/)]),
          })
          .strict(),
      )
      .optional(),
    /**
     * The page that RENDERS this entry, site-root path with a leading `/` and
     * no base (the avatar's convention): another layer's declared root for
     * a referenced entry it renders, else the entry's own library page.
     * GENERATED by `gen-library-viz`, never stored in the asset (#1881).
     */
    // Upper case too: a catalogued entry's id is its Dublin Core record's
    // file name, which library-graph accepts as [A-Za-z0-9._-] (WHO-..., WER...).
    view: z.string().regex(/^\/[A-Za-z0-9][A-Za-z0-9._/-]*\/$/).optional(),
    /**
     * The kind of viewer the entry's held source opens in, set only when the
     * page at `view` draws a view panel for it; the folio glass shows its eye
     * from it (owner, 2026-10-16). GENERATED by `gen-library-viz`. Absent
     * means no viewer, or nobody derived it.
     */
    viewable: z.enum(["pdf", "image"]).optional(),
    /**
     * The title's language and the titles of the entry's held language
     * editions, by language (owner, 2026-11-13). GENERATED by
     * `gen-library-viz` (`listingTitles`); absent when not known.
     */
    lang: z.string().optional(),
    titles: z.record(z.string(), z.string()).optional(),
    pageStart: PageNumber,
    pageEnd: PageNumber,
    words: Count,
    chars: Count,
    bytes: Count,
    upload: z.enum(["match", "differs", "absent", "unknown"]),
    uploadInstance: z.string(),
    /** Absent means the reference scan did not run — a third state, not "none". */
    referencedBy: z
      .array(z.object({ kind: z.string(), instance: z.string(), from: z.string(), count: Count }).strict())
      .optional(),
    /** Why the entry is withheld (bean `cw35`/`mkao`): no avatar, no verbatim excerpt. */
    withheld: z.string().min(1).optional(),
    /**
     * The structured half of `withheld` (issue #1794): which gates refused,
     * and the catalogue record — copied from `folio-withheld/v1`, so the same
     * shapes, never restated.
     */
    withheldBy: z
      .object({
        gates: WithheldEntrySchema.shape.gates,
        record: WithheldEntrySchema.shape.record,
      })
      .strict()
      .optional(),
    /**
     * The catalogue record behind this entry (`library-graph.ts` `catalogueInfo`
     * / `referencedCatalogueEntries`, #1752 / #1765).
     */
    catalogue: z
      .object({
        record: z.string().min(1).optional(),
        handle: z.string().min(1).optional(),
        xml: z.string().min(1).optional(),
        node: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    /**
     * Original file URLs upstream for an entry catalogued by reference (#1765).
     */
    upstream: z
      .array(
        z
          .object({
            label: z.string().min(1),
            href: z.string().url(),
          })
          .strict(),
      )
      .optional(),
    avatar: z.object({ href: z.string(), src: z.string(), source: z.enum(["cover", "figure"]) }).strict().optional(),
    summaries: z
      .object({
        prose: Count,
        summarised: Count,
        backlog: Count,
        draft: Count,
        confirmed: Count,
        stale: Count,
        rejected: Count,
        notSummarised: Count,
        unreadable: Count,
        empty: Count,
      })
      .strict()
      .optional(),
  })
  .strict();

export const LibraryIndexSchema = z
  .object({
    ...envelope("folio-library-index/v1"),
    entries: z.array(LibraryIndexEntrySchema),
    uploads: z.array(
      z
        .object({
          file: z.string(),
          kind: z.enum(["file", "intake"]),
          instance: z.string(),
          path: z.string(),
          bytes: Count,
          ext: z.string(),
          ingestedBy: z.string(),
          docId: z.string(),
          title: z.string(),
          declaredFiles: Count,
        })
        .strict(),
    ),
    queues: z.array(
      z.object({ instance: z.string(), dir: z.string(), total: Count, ingested: Count, uningested: Count }).strict(),
    ),
    // NO `filesRead` here, deliberately — bean `65oe`. It counted the files the
    // scan read ON DISK, so it was a property of the checkout rather than of the
    // library, and committing it made this artefact disagree with itself across
    // environments: CI wrote ~2555, a cloud container ~2663, and each side saw
    // the other as stale for ever. `library:viz` is one of the two inputs
    // `regen` names as UNGATED, so nothing ever went red and the churn was
    // silent. The count still exists where a fact about a run belongs — the
    // run's own console output.
    //
    // The PRESENCE of refScan is still the signal that the scan ran at all
    // ("nobody looked" is a third answer, distinct from "nothing referenced
    // it"), and `unreadable` is still what makes a zero provisional.
    refScan: z.object({ unreadable: StringList }).strict().optional(),
  })
  .strict();

/** A block summary as the library viewer shows it; optional keys are omitted when empty. */
export const BlockSummaryViewSchema = z
  .object({
    status: z.enum(SUMMARY_STATUSES),
    text: z.string().optional(),
    state: z.string().optional(),
    draftedBy: z.object({ kind: z.string(), id: z.string(), model: ModelIdSchema.optional() }).strict().optional(),
    draftedAt: z.string().optional(),
    confirmedBy: z.string().optional(),
    rejectionReason: z.string().optional(),
  })
  .strict();

/**
 * One entry's DOCUMENT view (`entries/<id>.doc.json`, issue #2302), built by
 * `scripts/lib/library-document.ts` from the ingestion schema. An entry with
 * no structure.json is written as `{ $schema, id, absent: true }` — a
 * determined "nothing in this schema to show", served as a file so the viewer
 * never has to tell a 404 from a failure.
 */
const DocKeyword = z.object({ term: z.string(), heading: z.boolean() }).strict();
const AlignmentList = z.object({ count: z.number().int(), items: StringList }).strict();
export const LibraryDocumentViewSchema = z
  .object({
    $schema: z.literal("folio-library-document/v1"),
    id: z.string().min(1),
    title: z.string().nullable(),
    /** Which structure variant: only a PDF has pages and a TOC (library-document.ts). */
    variant: z.enum(["pdf", "notebook", "text"]).optional(),
    /** Unknown is not zero: an older ingestion records no page count. */
    pages: z.number().int().nullable(),
    /** When `pages` is unknown, the last page a section reaches. */
    pagesCovered: z.number().int().optional(),
    tocSource: z.string().nullable(),
    tocMethod: z.string().nullable(),
    toc: z.array(
      z
        .object({
          level: z.number().int(),
          title: z.string(),
          number: z.string().nullable(),
          page: PageNumber,
          pageLabel: z.string().nullable(),
          confidence: z.number().nullable(),
          evidence: StringList.nullable(),
          source: z.string(),
          section: z.string().nullable(),
        })
        .strict(),
    ),
    sections: z.array(
      z
        .object({
          id: z.string(),
          number: z.string().nullable(),
          title: z.string(),
          level: z.number().int(),
          pageStart: PageNumber,
          pageEnd: PageNumber,
          labelStart: z.string().nullable(),
          labelEnd: z.string().nullable(),
          words: z.number().int(),
          summary: z.object({ text: z.string(), status: z.string() }).strict().nullable(),
          keywords: z.array(DocKeyword),
          extract: z.string().nullable(),
          extractCut: z.boolean(),
          /** The folio block this section was materialised as, for [edit] (bean zcak). */
          edit: z.object({ path: z.string().min(1), label: z.string().min(1) }).strict().optional(),
          /** The blocks the section's own `contains` lists, by `@id`, for the Contents tree. */
          blocks: z.array(z.string().min(1)).optional(),
        })
        .strict(),
    ),
    keywords: z.array(DocKeyword).optional(),
    pageLabels: z
      .array(z.object({ physical: z.number().int(), label: z.string().nullable(), source: z.string().nullable(), confidence: z.number() }).strict())
      .optional(),
    figures: z
      .array(
        z
          .object({
            kind: z.string(),
            number: z.string(),
            title: z.string(),
            page: z.number().int(),
            pageLabel: z.string().nullable(),
            confidence: z.number(),
            evidence: StringList,
          })
          .strict(),
      )
      .optional(),
    checks: z
      .object({
        tocAlignment: z.record(z.string(), AlignmentList).optional(),
        figureSequenceGaps: StringList.optional(),
        pageLabelConflicts: AlignmentList.optional(),
      })
      .strict(),
    /**
     * The entry's KEPT figures (role `figure`, a WebP on disk), each with every
     * language's description. Absent when it keeps none.
     */
    images: z
      .array(
        z
          .object({
            id: z.string().min(1),
            file: z.string().min(1),
            page: z.number().int().nullable(),
            /** The captions a vector render shows. */
            shows: StringList.optional(),
            narratives: z.record(z.string(), z.string()),
            state: z.string(),
          })
          .strict(),
      )
      .optional(),
    /** The entry's transcribed tables (`tabular.csvw.json`), cells inline. Absent when it has none. */
    tables: z
      .array(
        z
          .object({
            label: z.string(),
            caption: z.string(),
            pages: z.array(z.number().int()),
            columns: z.array(z.object({ titles: z.string(), group: z.string().optional() }).strict()),
            rows: z.array(StringList),
            notes: z.string().optional(),
            narratives: z.record(z.string(), z.string()),
            csv: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
    withheld: z.boolean(),
    /** What was extracted, kind by kind — found, none in the text, or not extracted (owner, 2026-11-14). */
    coverage: z
      .array(
        z
          .object({
            kind: z.enum(["contents", "sections", "figures", "tables", "references", "glossary", "footnotes", "summaries"]),
            state: z.enum(["found", "partial", "none", "not-extracted"]),
            count: z.number().int().nonnegative().optional(),
            note: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
    /** Where [source] and [feedback] point: the repository and the entry's directory (bean zcak). */
    links: z.object({ repo: z.string().min(1), branch: z.string().min(1), dir: z.string().min(1) }).strict().optional(),
  })
  .strict();

export const LibraryDocumentSchema = z.union([
  LibraryDocumentViewSchema,
  z.object({ $schema: z.literal("folio-library-document/v1"), id: z.string().min(1), absent: z.literal(true) }).strict(),
]);

export const LibraryEntrySchema = z
  .object({
    $schema: z.literal("folio-library-entry/v1"),
    id: z.string().min(1),
    blocks: z.array(
      z
        .object({
          id: z.string(),
          types: StringList,
          kind: z.string(),
          title: z.string(),
          pageStart: PageNumber,
          pageEnd: PageNumber,
          target: z.string().nullable(),
          narrative: z.string().nullable(),
          content: z.string().nullable(),
          truncated: z.boolean(),
          provenance: z.string(),
          summary: BlockSummaryViewSchema.nullable(),
        })
        .strict(),
    ),
  })
  .strict();

// ── folio-voices-index/v1 — scripts/gen-voices-viz.ts ──

export const VoicesIndexSchema = z
  .object({
    ...envelope("folio-voices-index/v1"),
    directories: z.array(
      z.object({ instance: z.string(), dir: z.string(), present: z.boolean(), voices: StringList }).strict(),
    ),
    voices: z.array(
      z
        .object({
          id: z.string().min(1),
          title: z.string(),
          description: z.string(),
          instance: z.string(),
          path: z.string(),
          provenance: z.string(),
          overlaySeverity: z.string(),
          criterion: z.string(),
          sources: z.array(z.object({ title: z.string(), year: z.number().int().optional() }).strict()),
          hasInstructions: z.boolean(),
          provenanceFlags: z.array(
            z
              .object({ code: z.literal("declared-outside-cites-inside"), ruleIds: StringList, detail: z.string() })
              .strict(),
          ),
          rules: z.array(
            z
              .object({
                id: z.string(),
                title: z.string(),
                description: z.string(),
                category: z.string(),
                severity: z.string(),
                patterns: Count,
                terminology: Count,
                judgementOnly: z.boolean(),
                citation: z.enum(["library", "kg-node", "none"]),
                cites: z.string().optional(),
                citesInstance: z.string().optional(),
                pages: z.string().optional(),
                quote: z.string(),
                counterintuitive: z.boolean().optional(),
                commonError: z.string().optional(),
                // Where a LIBRARY citation links (bean `qgjh`,
                // `scripts/lib/library-links.ts`): each present only where it
                // resolves. `viewer` and `entry` are site-relative; the
                // others absolute.
                links: z
                  .object({
                    viewer: z.string().optional(),
                    entry: z.string().optional(),
                    readme: z.string().url().optional(),
                    source: z.string().url().optional(),
                  })
                  .strict()
                  .optional(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    totals: z
      .object({ voices: Count, rules: Count, citingLibrary: Count, citingKgNode: Count, mechanical: Count })
      .strict(),
  })
  .strict();

// ── folio-graph-projection/v1 — scripts/gen-folio-viz.ts ──

export const FolioGraphProjectionSchema = z
  .object({
    ...envelope("folio-graph-projection/v1"),
    directories: z.array(
      z
        .object({
          dir: z.string(),
          present: z.boolean(),
          nodes: Count,
          /**
           * The list view (bean ohx6): every file the directory holds, as the
           * harness's own `folioFileList` answers, with a formatted size. Empty
           * for an absent directory.
           */
          files: z.array(z.object({ path: z.string(), bytes: Count, size: z.string() }).strict()),
        })
        .strict(),
    ),
    nodes: z.array(
      z
        .object({
          id: z.string(),
          summary: z.string(),
          theme: z.string().nullable(),
          /** `"<kind>:<page>"`, or null when the note is anchored to nothing. */
          anchor: z.string().nullable(),
          declaredIn: z.string().nullable(),
          links: z.array(z.object({ label: z.string(), href: z.string() }).strict()),
          chars: Count,
          file: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

// ── folio-qa-index/v1 — scripts/gen-docs-pages.ts → test/results/witnesses/<slug>/qa-index.json ──

/** A QA badge's verdict: the roll-up state and the counts behind it. */
export const QaIndexBadgeSchema = z
  .object({
    state: z.enum(["fail", "warn", "pass", "unswept"]),
    counts: z.object({ fail: Count, warn: Count, pass: Count, na: Count, unknown: Count }).strict(),
  })
  .strict();

export const QaIndexSchema = z
  .object({
    $schema: z.literal("folio-qa-index/v1"),
    /** The page's slug. */
    page: z.string().min(1),
    /**
     * Whether the build that wrote this had the derived QA corpus (bean
     * `4l4d`). `absent`: every badge on the page reads "not available in this
     * build", and `badges` and `unswept` are empty because nothing was known.
     * Optional only for an index written before that bean, which the painter
     * reads as `present` with no `unswept` list — what it then meant.
     */
    corpus: z.enum(["present", "absent"]).optional(),
    /** Keyed `<nodeId>.<family>` or `page.<family>`; may be empty. */
    badges: z.record(z.string().min(1), QaIndexBadgeSchema),
    /**
     * Keys whose subject has NO sidecar — "not swept", painted inert. Decided
     * here rather than in the committed page since bean `4l4d`.
     */
    unswept: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const unswept = doc.unswept ?? [];
    if (doc.corpus === "absent" && (Object.keys(doc.badges).length > 0 || unswept.length > 0)) {
      ctx.addIssue({ code: "custom", message: "corpus absent: an index that knew nothing carries no rows" });
    }
    for (const k of unswept) {
      if (k in doc.badges) ctx.addIssue({ code: "custom", message: `${k} is both a row and unswept` });
    }
  });

// ── folio-qa-translation-pages/v1 — scripts/gen-docs-pages.ts → test/results/witnesses/translation-qa-pages.json ──

/** Which HAND-AUTHORED pages have a translation projection; fetched by `docs-ui.js` (bean `4l4d`). */
export const QaTranslationPagesSchema = z
  .object({
    $schema: z.literal("folio-qa-translation-pages/v1"),
    corpus: z.enum(["present", "absent"]),
    /** Page slugs (path, `/` → `-`). Empty with `corpus: "absent"`. */
    pages: z.array(z.string().min(1)),
  })
  .strict();
