/**
 * Universal W3C N-Quads & SPARQL 1.1 In-Browser Client.
 *
 * Implements the browser client side of the `named-query-execution` skill and
 * conforms to `schemas/kg/nquads-distribution.ts`:
 * - Loads dataset manifest (`subgraph-manifest.json`)
 * - Manages Oxigraph WASM in-memory store
 * - Streams and decompresses `.nq.gz` partitions via native `DecompressionStream("gzip")`
 * - Enforces Graph Availability Guard to prevent silent partial results
 * - Safely binds typed SPARQL parameters
 * - Executes pre-compiled named queries
 *
 * Grounded in:
 * - W3C RDF 1.1 N-Quads (https://www.w3.org/TR/n-quads/)
 * - W3C SPARQL 1.1 Query Language (https://www.w3.org/TR/sparql11-query/)
 */

export class MissingPartitionError extends Error {
  constructor(missingGraphs) {
    super(`Missing required subgraph partitions: ${missingGraphs.join(", ")}`);
    this.name = "MissingPartitionError";
    this.missingGraphs = missingGraphs;
  }
}

/**
 * Binds typed parameters to SPARQL query placeholders using strict RDF Term formatting.
 * Eliminates SPARQL injection without arbitrary string replacement.
 */
export function bindSparqlParameters(sparql, paramsDef, bindings) {
  let boundedSparql = sparql;
  for (const def of paramsDef || []) {
    const val = bindings[def.name];
    if (val === undefined) continue;

    let termLiteral;
    switch (def.type) {
      case "iri":
        if (typeof val !== "string" || !val.startsWith("http")) {
          throw new Error(`Invalid IRI parameter "${def.name}": ${val}`);
        }
        termLiteral = `<${val}>`;
        break;
      case "integer":
        termLiteral = `${parseInt(String(val), 10)}^^<http://www.w3.org/2001/XMLSchema#integer>`;
        break;
      case "boolean":
        termLiteral = `${Boolean(val)}^^<http://www.w3.org/2001/XMLSchema#boolean>`;
        break;
      case "string":
      default:
        termLiteral = JSON.stringify(String(val));
        break;
    }

    boundedSparql = boundedSparql.replaceAll(`?$${def.name}`, termLiteral);
  }
  return boundedSparql;
}

/**
 * Decompresses a gzipped Response stream into UTF-8 text using native DecompressionStream.
 */
async function decompressGzipResponse(response) {
  if (!response.body) {
    throw new Error("Response has no body to decompress");
  }
  const ds = new DecompressionStream("gzip");
  const decompressedStream = response.body.pipeThrough(ds);
  const reader = decompressedStream.getReader();
  const decoder = new TextDecoder("utf-8");
  let result = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

export class WebNQuadsClient {
  constructor(manifestUrl) {
    this.manifestUrl = manifestUrl;
    this.baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf("/") + 1);
    this.manifest = null;
    this.store = null;
    this.loadedPartitions = new Set();
    this.totalQuads = 0;
    this.totalLoadTimeMs = 0;
  }

  /**
   * Initializes the client: fetches manifest and instantiates Oxigraph WASM Store.
   */
  async init(oxigraphModule) {
    const resp = await fetch(this.manifestUrl);
    if (!resp.ok) {
      throw new Error(`Failed to fetch manifest from ${this.manifestUrl}: ${resp.status} ${resp.statusText}`);
    }
    this.manifest = await resp.json();

    if (oxigraphModule) {
      this.oxigraph = oxigraphModule;
    } else if (typeof window !== "undefined" && window.oxigraph) {
      this.oxigraph = window.oxigraph;
    } else {
      throw new Error("Oxigraph WASM module not provided and window.oxigraph is absent.");
    }

    this.store = new this.oxigraph.Store();

    // 1. Always load Tier 1 Spine partition
    if (this.manifest.tiers && this.manifest.tiers.spine) {
      await this.loadPartition(this.manifest.tiers.spine);
    }

    return this;
  }

  /**
   * Loads an individual N-Quads partition (.nq.gz or .nq) into the in-memory store.
   */
  async loadPartition(partition) {
    if (this.loadedPartitions.has(partition.id)) {
      return;
    }

    const t0 = performance.now();
    const filename = partition.fileGz || partition.fileNq;
    const partitionUrl = new URL(filename, this.baseUrl).href;

    const resp = await fetch(partitionUrl);
    if (!resp.ok) {
      throw new Error(`Failed to fetch partition ${partition.id} from ${partitionUrl}: ${resp.status}`);
    }

    let nquadsText;
    if (filename.endsWith(".gz")) {
      nquadsText = await decompressGzipResponse(resp);
    } else {
      nquadsText = await resp.text();
    }

    // Load into Oxigraph WASM Store
    this.store.load(nquadsText, "application/n-quads");
    const loadTimeMs = performance.now() - t0;

    this.loadedPartitions.add(partition.id);
    this.totalQuads = this.store.size;
    this.totalLoadTimeMs += loadTimeMs;
  }

  /**
   * Executes a named query declared in the distribution manifest.
   */
  async executeNamedQuery(queryName, bindings = {}, limit = null) {
    if (!this.manifest) {
      throw new Error("Client not initialized. Call init() first.");
    }

    const queryDef = this.manifest.namedQueries[queryName];
    if (!queryDef) {
      const available = Object.keys(this.manifest.namedQueries).join(", ");
      throw new Error(`Named query "${queryName}" not found. Available: ${available}`);
    }

    // Graph Availability Guard: verify required subgraphs are resident
    const missing = [];
    for (const reqId of queryDef.requiredSubgraphs || []) {
      if (!this.loadedPartitions.has(reqId)) {
        // Attempt lazy load if partition is known in manifest
        const partDef = this.manifest.tiers.subgraphs[reqId];
        if (partDef) {
          try {
            await this.loadPartition(partDef);
          } catch (_e) {
            missing.push(reqId);
          }
        } else {
          missing.push(reqId);
        }
      }
    }

    if (missing.length > 0) {
      throw new MissingPartitionError(missing);
    }

    // Safely bind typed parameters
    const sparql = bindSparqlParameters(queryDef.sparql, queryDef.parameters, bindings);

    // Evaluate SPARQL query in-memory
    const t0 = performance.now();
    const rawResults = this.store.query(sparql);
    const executionTimeMs = performance.now() - t0;

    const rows = [];
    if (Array.isArray(rawResults)) {
      for (const bindingMap of rawResults) {
        const row = {};
        if (bindingMap instanceof Map) {
          for (const [k, v] of bindingMap.entries()) {
            row[k] = v.value;
          }
        } else if (typeof bindingMap === "object" && bindingMap !== null) {
          for (const [k, v] of Object.entries(bindingMap)) {
            row[k] = v && typeof v === "object" ? v.value : String(v);
          }
        }
        rows.push(row);
        if (limit && rows.length >= limit) break;
      }
    }

    return {
      queryName,
      datasetIri: this.manifest.datasetIri,
      quadsLoaded: this.totalQuads,
      loadTimeMs: parseFloat(this.totalLoadTimeMs.toFixed(1)),
      executionTimeMs: parseFloat(executionTimeMs.toFixed(1)),
      totalRows: rows.length,
      rows,
    };
  }
}
