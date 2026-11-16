/**
 * Test suite for Universal W3C N-Quads Distribution & Named Query Execution.
 *
 * Verifies:
 * 1. Schema conformance (folio-nquads-distribution/v1)
 * 2. Parameter binding safety (anti-injection)
 * 3. Graph Availability Guard (MissingPartitionError on missing required subgraphs)
 * 4. End-to-end SPARQL 1.1 execution over in-memory Oxigraph store
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import {
  NQuadsDistributionManifestSchema,
  MAX_RECOMMENDED_PARTITION_BYTES,
  type NQuadsDistributionManifest,
} from "../../schemas/kg/nquads-distribution.ts";
import {
  bindSparqlParameters,
  executeNamedQuery,
  MissingPartitionError,
} from "../nquads-query.ts";

describe("W3C N-Quads Distribution & Named Query Engine", () => {
  it("enforces partition budget ceiling constant", () => {
    expect(MAX_RECOMMENDED_PARTITION_BYTES).toBe(5 * 1024 * 1024);
  });

  it("safely binds typed parameters without SPARQL injection", () => {
    const sparql = "SELECT ?item WHERE { ?item a ?$type ; <http://example.org/val> ?$val ; <http://example.org/ref> ?$ref . }";
    const paramsDef = [
      { name: "type", type: "string" },
      { name: "val", type: "integer" },
      { name: "ref", type: "iri" },
    ];
    const bindings = {
      type: "Book",
      val: 42,
      ref: "http://example.org/items/123",
    };

    const bound = bindSparqlParameters(sparql, paramsDef, bindings);
    expect(bound).toBe(
      'SELECT ?item WHERE { ?item a "Book" ; <http://example.org/val> 42^^<http://www.w3.org/2001/XMLSchema#integer> ; <http://example.org/ref> <http://example.org/items/123> . }'
    );

    // Refuses invalid IRI
    expect(() =>
      bindSparqlParameters(sparql, paramsDef, { ...bindings, ref: "not-an-iri" })
    ).toThrow(/Invalid IRI parameter/);
  });

  it("validates manifest schema and executes named queries with Graph Availability Guard", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nquads-test-"));

    // Create sample W3C N-Quads spine partition
    const spineQuads = [
      '<http://example.org/root> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/SpineNode> <http://example.org/graphs/spine> .',
      '<http://example.org/root> <http://example.org/hasCommunity> <http://example.org/comm1> <http://example.org/graphs/spine> .',
    ].join("\n");
    const spineGz = gzipSync(Buffer.from(spineQuads, "utf8"));
    writeFileSync(join(dir, "spine.nq.gz"), spineGz);

    // Create sample W3C N-Quads subgraph partition
    const commQuads = [
      '<http://example.org/comm1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/Community> <http://example.org/graphs/comm1> .',
      '<http://example.org/comm1> <http://example.org/title> "Global Health Catalogue" <http://example.org/graphs/comm1> .',
    ].join("\n");
    const commGz = gzipSync(Buffer.from(commQuads, "utf8"));
    writeFileSync(join(dir, "comm1.nq.gz"), commGz);

    const manifest: NQuadsDistributionManifest = {
      $schema: "folio-nquads-distribution/v1",
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      datasetIri: "http://example.org/dataset/test",
      servedRoute: "test/dist/oxigraph",
      tiers: {
        spine: {
          id: "spine",
          name: "Test Spine",
          graphIri: "http://example.org/graphs/spine",
          fileNq: "spine.nq",
          fileGz: "spine.nq.gz",
          mediaType: "application/n-quads",
          compressFormat: "application/gzip",
          quadCount: 2,
          itemCount: 1,
        },
        subgraphs: {
          comm1: {
            id: "comm1",
            name: "Community 1",
            graphIri: "http://example.org/graphs/comm1",
            fileNq: "comm1.nq",
            fileGz: "comm1.nq.gz",
            mediaType: "application/n-quads",
            compressFormat: "application/gzip",
            quadCount: 2,
            itemCount: 1,
          },
          comm_missing: {
            id: "comm_missing",
            name: "Missing Subgraph",
            graphIri: "http://example.org/graphs/missing",
            fileNq: "missing.nq",
            fileGz: "missing.nq.gz",
            mediaType: "application/n-quads",
            compressFormat: "application/gzip",
            quadCount: 1,
            itemCount: 1,
          },
        },
      },
      queriesFile: "queries.json",
      namedQueries: {
        "get-community": {
          id: "get-community",
          description: "Get community title",
          sparql: "SELECT ?title WHERE { GRAPH ?g { ?$comm <http://example.org/title> ?title . } }",
          requiredSubgraphs: ["comm1"],
          parameters: [{ name: "comm", type: "iri", required: true }],
          outputVariables: ["title"],
        },
        "query-missing-graph": {
          id: "query-missing-graph",
          description: "Query over absent partition",
          sparql: "SELECT ?s WHERE { ?s ?p ?o . }",
          requiredSubgraphs: ["comm_missing"],
          parameters: [],
          outputVariables: ["s"],
        },
      },
    };

    // Verify manifest against Zod schema
    const parsed = NQuadsDistributionManifestSchema.parse(manifest);
    writeFileSync(join(dir, "subgraph-manifest.json"), JSON.stringify(parsed, null, 2));

    // 1. Successful execution with resident required subgraph
    const res = await executeNamedQuery({
      dataset: dir,
      queryName: "get-community",
      bindings: { comm: "http://example.org/comm1" },
      format: "json",
    });

    expect(res.queryName).toBe("get-community");
    expect(res.datasetIri).toBe("http://example.org/dataset/test");
    expect(res.quadsLoaded).toBe(4); // 2 in spine + 2 in comm1
    expect(res.totalRows).toBe(1);
    expect(res.rows[0].title).toBe("Global Health Catalogue");

    // 2. Graph Availability Guard refusal on missing required subgraph
    await expect(
      executeNamedQuery({
        dataset: dir,
        queryName: "query-missing-graph",
        bindings: {},
        format: "json",
      })
    ).rejects.toBeInstanceOf(MissingPartitionError);
  });
});
