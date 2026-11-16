/**
 * Partitioned RDF N-Quads Dataset Distribution & Named Query Manifest Schema.
 *
 * Grounded in W3C Standards:
 * - W3C RDF 1.1 N-Quads line-based dataset serialization (conformsTo w3c-n-quads)
 * - W3C VoID (Vocabulary of Interlinked Datasets) for dataset partitioning and dumps
 * - W3C DCAT v3 (Data Catalog Vocabulary) for downloadable distributions
 *
 * Architecture:
 * - Generic platform partition model: datasets are split by named subgraphs
 *   (e.g., WHO-IRIS communities, Beans workflow domains).
 * - Guaranteed graph completeness: queries declare required subgraphs, and
 *   the execution engine refuses execution if required subgraphs are not resident.
 *
 * @module schemas/nquads-distribution
 * @graphNode schema
 * @conformsTo w3c-n-quads
 */
import { z } from "zod";

export const NQUADS_DISTRIBUTION_SCHEMA_TAG = "folio-nquads-distribution/v1";

/**
 * Maximum recommended gzipped partition size (5 MB ~ 50,000 quads) to protect
 * browser V8 heap and mobile memory allocations during decompression.
 */
export const MAX_RECOMMENDED_PARTITION_BYTES = 5 * 1024 * 1024;

/**
 * Individual N-Quads graph partition.
 * Models a single named graph distribution file (corresponds to void:dataDump / dcat:Distribution).
 */
export const NQuadsPartitionSchema = z.object({
  id: z.string().min(1).describe("Partition identifier, e.g. 'spine' or community/subgraph id"),
  name: z.string().min(1).describe("Human-readable title for the partition"),
  graphIri: z.string().url().describe("Target named graph IRI serialized in the N-Quads"),
  fileNq: z.string().endsWith(".nq").describe("Relative filename of uncompressed W3C N-Quads"),
  fileGz: z.string().endsWith(".nq.gz").describe("Relative filename of gzipped W3C N-Quads"),
  mediaType: z.literal("application/n-quads").default("application/n-quads"),
  compressFormat: z.literal("application/gzip").default("application/gzip"),
  quadCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  byteSize: z.number().int().positive().optional(),
  sha256: z.string().length(64).optional(),
});
export type NQuadsPartition = z.infer<typeof NQuadsPartitionSchema>;

/** Parameter definition for safe, injection-proof SPARQL queries */
export const QueryParameterDefSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_]+$/),
  type: z.enum(["string", "iri", "integer", "boolean"]),
  required: z.boolean().default(false),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().optional(),
});
export type QueryParameterDef = z.infer<typeof QueryParameterDefSchema>;

/**
 * Pre-compiled, audited named SPARQL 1.1 query.
 * Declares the subgraphs required in-memory to prevent the silent partial result defect.
 */
export const NamedQueryDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  description: z.string().min(1),
  sparql: z.string().min(1),
  requiredSubgraphs: z.array(z.string()).default([]).describe(
    "List of subgraph partition IDs that must be resident in the store before execution",
  ),
  parameters: z.array(QueryParameterDefSchema).default([]),
  outputVariables: z.array(z.string()).default([]),
});
export type NamedQueryDef = z.infer<typeof NamedQueryDefSchema>;

/**
 * Top-level Topology Manifest (`subgraph-manifest.json`).
 * Defines the dataset hierarchy, primary routing spine, lazily-loadable subgraphs, and query catalog.
 */
export const NQuadsDistributionManifestSchema = z.object({
  $schema: z.literal(NQUADS_DISTRIBUTION_SCHEMA_TAG),
  version: z.string().min(1),
  generatedAt: z.string().datetime(),
  datasetIri: z.string().url().describe("Root dataset IRI identifier"),
  servedRoute: z.string().min(1).describe("Base relative route where files are served, e.g. 'dataset/dist/oxigraph'"),
  tiers: z.object({
    spine: NQuadsPartitionSchema.describe("Primary routing backbone graph loaded on bootstrap"),
    subgraphs: z.record(z.string(), NQuadsPartitionSchema).describe(
      "Dictionary of partitioned subgraphs (e.g. communities, domains) loaded on demand",
    ),
  }),
  queriesFile: z.string().endsWith(".json").default("queries.json"),
  namedQueries: z.record(z.string(), NamedQueryDefSchema).default({}),
});
export type NQuadsDistributionManifest = z.infer<typeof NQuadsDistributionManifestSchema>;

/** Standard I/O Contract: Request to execute a named query */
export const NamedQueryRequestSchema = z.object({
  dataset: z.string().describe("Dataset manifest file path, distribution directory, or HTTP URL"),
  queryName: z.string().min(1).describe("Identifier of the pre-compiled named query to execute"),
  bindings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  format: z.enum(["table", "json", "ids"]).default("table"),
  limit: z.number().int().positive().optional(),
});
export type NamedQueryRequest = z.infer<typeof NamedQueryRequestSchema>;

/** Standard I/O Contract: Result of executing a named query */
export const NamedQueryResponseSchema = z.object({
  queryName: z.string(),
  datasetIri: z.string(),
  quadsLoaded: z.number().int().nonnegative(),
  loadTimeMs: z.number().nonnegative(),
  executionTimeMs: z.number().nonnegative(),
  totalRows: z.number().int().nonnegative(),
  rows: z.array(z.record(z.string(), z.string())),
});
export type NamedQueryResponse = z.infer<typeof NamedQueryResponseSchema>;
