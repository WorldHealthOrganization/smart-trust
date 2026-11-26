/**
 * The OpenAPI harness's shapes: what a layer declares, what an ingest
 * records, and how an OpenAPI document's OPERATIONS become nodes with IRIs.
 *
 * @module cat-harness/openapi/schemas/openapi
 * @graphNode schema
 *
 * ## The node is the document; the operation is a node inside it
 *
 * Owner, 2026-10-03 (bean `s4ta`): *"kind is an OpenAPI node. need page + IRI
 * for each operation."* So a directory of graph typology `openapi` holds OpenAPI
 * documents, one node each, and every operation in a document is a node of
 * its own, addressable the way `harness-requirements` §"Serialisations"
 * requires of every node: `<…>/<doc>/<operation>.jsonld` and `.json`, with
 * its rendering — a thin page — at `<…>/<doc>/<operation>/`.
 *
 * ## The operation's id
 *
 * The document's own `operationId` where it gives one, because that is the
 * name the API's authors chose and a client generator already uses. Where it
 * gives none, `<method>-<path>` made filename-safe. The two cannot collide
 * silently: {@link operationsOf} refuses a document in which two operations
 * would share an id, rather than suffixing one and minting an IRI nobody
 * chose.
 *
 * ## Why the document is validated so little
 *
 * {@link OpenApiDocumentSchema} checks what this harness READS — the version,
 * `info.title`, and `paths` with their operations — and passes everything
 * else through. A full OpenAPI validator would refuse documents the published
 * API serves today over a detail no page here renders; the source of truth
 * for the API is its authors, and the harness renders what they published.
 */
import { z } from "zod";

/** The HTTP methods OpenAPI 3 names as operations on a path item, in its order. */
export const OPENAPI_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;
export type OpenApiMethod = (typeof OPENAPI_METHODS)[number];

/** A document id, and an operation id: one path segment, filename-safe. */
const SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * `cat-openapi.config.json` — at the root of the repository that instantiates
 * this harness (`harness-tiles`: a `<name>.config.json` at a repository root
 * is the instantiation). Owner, 2026-10-03: *"the consumer instance would have an
 * cat-openapi.config.json in the repo root or so"*.
 *
 * It names each OpenAPI document the layer holds and where it comes from.
 * The bytes themselves are ingested into the layer's `openapi` directory;
 * this file is the CONFIG, never a copy.
 */
export const OPENAPI_CONFIG_SCHEMA_TAG = "cat-openapi-config/v1";
export const OpenApiSourceSchema = z
  .object({
    /** `owner/repo` on GitHub. */
    repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    /** Path of the document inside that repository. */
    path: z.string().min(1),
    /** Branch, tag or commit to read it from. The ingest records the commit it resolved to. */
    ref: z.string().min(1).default("main"),
  })
  .strict();
export const OpenApiConfigDocumentSchema = z
  .object({
    /** The document's id: its file stem, its page directory and its IRI segment. */
    id: z.string().regex(SEGMENT),
    /** What a reader calls it. Absent, the document's own `info.title` is used. */
    title: z.string().min(1).optional(),
    /** One sentence on what this API is and why this layer holds it. */
    description: z.string().min(1).optional(),
    source: OpenApiSourceSchema,
  })
  .strict();
/**
 * Where a RENDERED document is read from: an already-published spec, by URL
 * (bean `folio-assistant-7jkp`; owner ruling 2026-10-10: two tools,
 * `openapi-ingest-source` and `openapi-ingest-rendered`). A different input
 * from a repository, and it fails differently — so a different list, not a
 * mode of {@link OpenApiSourceSchema}.
 */
export const OpenApiRenderedSourceSchema = z
  .object({
    /** The published spec's URL: an OpenAPI 3 JSON document, served over https. */
    url: z.string().url().refine((u) => u.startsWith("https://"), "a rendered spec is read over https"),
  })
  .strict();
export const OpenApiRenderedDocumentSchema = z
  .object({
    id: z.string().regex(SEGMENT),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    rendered: OpenApiRenderedSourceSchema,
  })
  .strict();
export type OpenApiRenderedDocument = z.infer<typeof OpenApiRenderedDocumentSchema>;

export const OpenApiConfigSchema = z
  .object({
    $schema: z.literal(OPENAPI_CONFIG_SCHEMA_TAG),
    /** The `<instance>.json` directory id of graph typology `openapi` the documents are ingested into. */
    directory: z.string().min(1),
    /** Documents read from a repository (`openapi-ingest-source`). */
    documents: z.array(OpenApiConfigDocumentSchema).default([]),
    /** Documents read from a published spec URL (`openapi-ingest-rendered`). */
    rendered: z.array(OpenApiRenderedDocumentSchema).default([]),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.documents.length + c.rendered.length === 0) {
      ctx.addIssue({ code: "custom", path: ["documents"], message: "a config names at least one document, from a repository or rendered" });
    }
    const seen = new Set<string>();
    for (const [list, docs] of [["documents", c.documents], ["rendered", c.rendered]] as const) {
      for (const [i, d] of docs.entries()) {
        if (seen.has(d.id)) ctx.addIssue({ code: "custom", path: [list, i, "id"], message: `document id "${d.id}" is declared twice` });
        seen.add(d.id);
      }
    }
  });
export type OpenApiConfig = z.infer<typeof OpenApiConfigSchema>;

/**
 * What the ingest records beside each document — `<id>.source.json`. The
 * document's bytes are kept VERBATIM (it is the API's, not ours), so where
 * they came from is a node of its own rather than a field written into them.
 */
export const OPENAPI_SOURCE_SCHEMA_TAG = "folio-openapi-source/v1";
export const OpenApiProvenanceSchema = z
  .object({
    $schema: z.literal(OPENAPI_SOURCE_SCHEMA_TAG),
    id: z.string().regex(SEGMENT),
    /** The document file beside this one. */
    file: z.string().regex(/^[A-Za-z0-9._-]+\.openapi\.json$/),
    source: OpenApiSourceSchema.extend({ commit: z.string().regex(/^[0-9a-f]{40}$/) }).strict(),
    bytes: z.number().int().positive(),
    /** The document's `openapi` version, and its `info.title` / `info.version`, as published. */
    openapi: z.string().min(1),
    title: z.string().min(1),
    version: z.string().min(1),
    /** How many operations it holds — every one of which gets a page. */
    operations: z.number().int().nonnegative(),
    /**
     * The document IS a held copy of upstream bytes, so it says so in the
     * shared `folio-materialization/v1` shape (`core`'s
     * `MaterializationSchema`): where from, where it landed, why it was
     * taken, its fixity and the five gates. Checked here only as far as this
     * harness relies on it — the state, the path and the digest; the full
     * record is that schema's to judge, and `check:read-only-graphs` reads
     * `state` to agree with the directory's `readOnly`.
     */
    materialization: z
      .object({
        $schema: z.literal("folio-materialization/v1"),
        state: z.literal("materialized"),
        localPath: z.string().min(1),
        purpose: z.literal("working"),
        fixity: z.object({ algorithm: z.literal("sha256"), digest: z.string().regex(/^[0-9a-f]{64}$/) }).strict(),
      })
      .passthrough(),
  })
  .strict();
export type OpenApiProvenance = z.infer<typeof OpenApiProvenanceSchema>;

/**
 * What `openapi-ingest-rendered` records beside a document read from a URL.
 * Same file name and shape as {@link OpenApiProvenanceSchema}, except the
 * source: a URL and WHEN it was fetched, because a published spec has no
 * commit to pin — what pins the bytes is the digest in `materialization`.
 */
export const OpenApiRenderedProvenanceSchema = OpenApiProvenanceSchema.extend({
  source: OpenApiRenderedSourceSchema.extend({ fetchedAt: z.string().datetime() }).strict(),
}).strict();
export type OpenApiRenderedProvenance = z.infer<typeof OpenApiRenderedProvenanceSchema>;

const OperationSchema = z
  .object({
    operationId: z.string().min(1).optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    deprecated: z.boolean().optional(),
  })
  .passthrough();

/** An OpenAPI 3 document, checked only as far as this harness reads it. */
export const OpenApiDocumentSchema = z
  .object({
    openapi: z.string().regex(/^3\.\d+\.\d+$/, "an OpenAPI 3.x document"),
    info: z.object({ title: z.string().min(1), version: z.string().min(1), description: z.string().optional() }).passthrough(),
    paths: z.record(z.string(), z.record(z.string(), z.unknown())),
  })
  .passthrough();
export type OpenApiDocument = z.infer<typeof OpenApiDocumentSchema>;

/** One operation, as a node: what its page and its JSON-LD are built from. */
export interface OpenApiOperation {
  /** The node id: `operationId`, or `<method>-<path>` made filename-safe. */
  id: string;
  /** Whether {@link id} is the document's own `operationId`. */
  declaredId: boolean;
  method: OpenApiMethod;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  deprecated: boolean;
}

/** `post /trust/reference` → `post-trust-reference`. */
export function fallbackOperationId(method: string, path: string): string {
  const slug = path.replace(/[{}]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${method}-${slug || "root"}`;
}

/**
 * Every operation in a document, in the document's own order (paths as
 * written, methods in OpenAPI's order within a path). Throws on two
 * operations that would share an id — see the module docs.
 */
export function operationsOf(doc: OpenApiDocument): OpenApiOperation[] {
  const out: OpenApiOperation[] = [];
  const seen = new Map<string, string>();
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of OPENAPI_METHODS) {
      if (!(method in item)) continue;
      const op = OperationSchema.parse(item[method]);
      const declared = op.operationId !== undefined && SEGMENT.test(op.operationId);
      const id = declared ? op.operationId! : fallbackOperationId(method, path);
      const where = `${method.toUpperCase()} ${path}`;
      const prior = seen.get(id);
      if (prior) throw new Error(`two operations would share the id "${id}": ${prior} and ${where}`);
      seen.set(id, where);
      out.push({
        id,
        declaredId: declared,
        method,
        path,
        ...(op.summary ? { summary: op.summary } : {}),
        ...(op.description ? { description: op.description } : {}),
        tags: op.tags ?? [],
        deprecated: op.deprecated ?? false,
      });
    }
  }
  return out;
}
