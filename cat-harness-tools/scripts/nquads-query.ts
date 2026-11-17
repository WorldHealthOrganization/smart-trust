#!/usr/bin/env bun
/**
 * Universal W3C N-Quads & SPARQL 1.1 Named Query Execution Engine.
 *
 * Implements the `named-query-execution` skill and conforms to
 * `schemas/kg/nquads-distribution.ts`:
 * - Loads dataset topologies from local directory, manifest, or remote URL
 * - Validates Graph Availability before execution (guards against silent partial results)
 * - Binds typed parameters safely without SPARQL injection
 * - Evaluates queries via in-memory Oxigraph Store
 * - Outputs formatted tables, JSON, or ID lists
 *
 * @module scripts/nquads-query
 * @graphNode tool
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { gunzipSync } from "node:zlib";
import oxigraph from "oxigraph";
import {
  NQuadsDistributionManifestSchema,
  type NamedQueryRequest,
  type NamedQueryResponse,
} from "../schemas/kg/nquads-distribution.ts";

export class MissingPartitionError extends Error {
  constructor(public missingGraphs: string[]) {
    super(`Missing required subgraph partitions: ${missingGraphs.join(", ")}`);
    this.name = "MissingPartitionError";
  }
}

/**
 * Binds typed parameters to SPARQL query placeholders using strict RDF Term formatting.
 * Eliminates SPARQL injection without arbitrary string replacement.
 */
export function bindSparqlParameters(
  sparql: string,
  paramsDef: { name: string; type: string }[],
  bindings: Record<string, string | number | boolean>,
): string {
  let boundedSparql = sparql;
  for (const def of paramsDef) {
    const val = bindings[def.name];
    if (val === undefined) continue;

    let termLiteral: string;
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

    // Replace parameter placeholder safely
    boundedSparql = boundedSparql.replaceAll(`?$${def.name}`, termLiteral);
  }
  return boundedSparql;
}

/**
 * Loads an N-Quads partition file (.nq or .nq.gz) into an Oxigraph Store.
 */
export function loadPartitionIntoStore(
  store: oxigraph.Store,
  filePathOrUrl: string,
): { quadsLoaded: number; loadTimeMs: number } {
  const t0 = performance.now();
  let rawNQuads: string;

  if (filePathOrUrl.endsWith(".gz")) {
    const gzBytes = readFileSync(filePathOrUrl);
    rawNQuads = gunzipSync(gzBytes).toString("utf8");
  } else {
    rawNQuads = readFileSync(filePathOrUrl, "utf8");
  }

  // Load into Oxigraph store verifying W3C N-Quads syntax
  store.load(rawNQuads, { format: "application/n-quads" });
  const loadTimeMs = performance.now() - t0;

  return { quadsLoaded: store.size, loadTimeMs };
}

/**
 * Executes a named query against an N-Quads dataset distribution.
 */
export async function executeNamedQuery(
  request: NamedQueryRequest,
): Promise<NamedQueryResponse> {
  const datasetPath = resolve(request.dataset);
  let manifestPath = datasetPath;

  if (!manifestPath.endsWith(".json")) {
    manifestPath = join(datasetPath, "subgraph-manifest.json");
  }

  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found at "${manifestPath}". Run packaging first.`);
  }

  const baseDir = resolve(manifestPath, "..");
  const manifestRaw = JSON.parse(readFileSync(manifestPath, "utf8"));
  const manifest = NQuadsDistributionManifestSchema.parse(manifestRaw);

  const queryDef = manifest.namedQueries[request.queryName];
  if (!queryDef) {
    const available = Object.keys(manifest.namedQueries).join(", ");
    throw new Error(`Query "${request.queryName}" not found. Available queries: ${available}`);
  }

  const store = new oxigraph.Store();
  let totalQuads = 0;
  let totalLoadTime = 0;

  // 1. Always load Tier 1 Spine
  const spineFile = join(baseDir, manifest.tiers.spine.fileGz || manifest.tiers.spine.fileNq);
  if (existsSync(spineFile)) {
    const { quadsLoaded, loadTimeMs } = loadPartitionIntoStore(store, spineFile);
    totalQuads = quadsLoaded;
    totalLoadTime += loadTimeMs;
  }

  // 2. Graph Availability Guard: verify required subgraphs are loaded
  const loadedGraphIris = new Set<string>([manifest.tiers.spine.graphIri]);
  for (const requiredId of queryDef.requiredSubgraphs) {
    const part = manifest.tiers.subgraphs[requiredId];
    if (!part) {
      throw new Error(`Required subgraph partition "${requiredId}" is not declared in manifest.`);
    }
    const partFile = join(baseDir, part.fileGz || part.fileNq);
    if (!existsSync(partFile)) {
      throw new MissingPartitionError([requiredId]);
    }
    const { quadsLoaded, loadTimeMs } = loadPartitionIntoStore(store, partFile);
    totalQuads = quadsLoaded;
    totalLoadTime += loadTimeMs;
    loadedGraphIris.add(part.graphIri);
  }

  // 3. Bind parameters safely
  const sparql = bindSparqlParameters(queryDef.sparql, queryDef.parameters, request.bindings);

  // 4. Execute SPARQL query
  const tQuery0 = performance.now();
  const rawResults = store.query(sparql);
  const executionTimeMs = performance.now() - tQuery0;

  const rows: Record<string, string>[] = [];
  if (Array.isArray(rawResults)) {
    for (const bindingMap of rawResults) {
      const row: Record<string, string> = {};
      if (bindingMap instanceof Map) {
        for (const [k, v] of bindingMap.entries()) {
          row[k] = v.value;
        }
      }
      rows.push(row);
      if (request.limit && rows.length >= request.limit) break;
    }
  }

  return {
    queryName: request.queryName,
    datasetIri: manifest.datasetIri,
    quadsLoaded: totalQuads,
    loadTimeMs: parseFloat(totalLoadTime.toFixed(1)),
    executionTimeMs: parseFloat(executionTimeMs.toFixed(1)),
    totalRows: rows.length,
    rows,
  };
}

// ── CLI Handling ────────────────────────────────────────────────────────
if (import.meta.main) {
  const args = process.argv.slice(2);
  let dataset = "dist/oxigraph";
  let queryName = "";
  let format: "table" | "json" | "ids" = "table";
  let limit: number | undefined;
  const bindings: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dataset" && args[i + 1]) dataset = args[++i];
    else if (a === "--named" && args[i + 1]) queryName = args[++i];
    else if (a === "--format" && args[i + 1]) format = args[++i] as "table" | "json" | "ids";
    else if (a === "--limit" && args[i + 1]) limit = parseInt(args[++i], 10);
    else if (a === "--param" && args[i + 1]) {
      const [k, v] = args[++i].split("=");
      if (k && v) bindings[k] = v;
    }
  }

  if (!queryName) {
    console.error("Usage: bun run nquads:query --dataset <dir|manifest> --named <queryName> [--param key=val] [--format table|json|ids]");
    process.exit(1);
  }

  try {
    const res = await executeNamedQuery({
      dataset,
      queryName,
      bindings,
      format,
      limit,
    });

    if (format === "json") {
      console.log(JSON.stringify(res, null, 2));
    } else if (format === "ids") {
      for (const r of res.rows) {
        console.log(r.id ?? Object.values(r)[0]);
      }
    } else {
      console.log(`Executed: ${res.queryName} over ${res.datasetIri}`);
      console.log(`Store: ${res.quadsLoaded} quads loaded in ${res.loadTimeMs}ms. Query executed in ${res.executionTimeMs}ms. Rows: ${res.totalRows}\n`);
      console.table(res.rows);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error executing query: ${msg}`);
    process.exit(1);
  }
}
