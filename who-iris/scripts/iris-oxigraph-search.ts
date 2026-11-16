/**
 * WHO-IRIS Oxigraph Search Engine MVP
 *
 * Implements combined complex search and structured Dublin Core queries that
 * DSpace's native discovery API cannot do in a single call:
 * - Cross-graph joins (Catalogue hierarchy + Dublin Core metadata + Bitstream access gates)
 * - Multi-field Boolean search (AND / OR across Creator, Subject, Spatial, Year, Community)
 * - Multi-dimensional faceted aggregation
 * - Dynamic lazy-loading of named subgraphs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import oxigraph from 'oxigraph';

/** Escape a value for a double-quoted SPARQL string literal: backslash first, then quote and line breaks. */
export function sparqlString(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}


/**
 * Run a SPARQL SELECT. `Store.query` is typed as the union over every query
 * form (SELECT rows, ASK boolean, CONSTRUCT quads, serialized string), so a
 * SELECT caller narrows it here, and anything else is an error, not an empty
 * result.
 */
export function selectRows(store: oxigraph.Store, query: string): Map<string, oxigraph.Term>[] {
  const out = store.query(query);
  if (!Array.isArray(out) || (out.length > 0 && !(out[0] instanceof Map))) {
    throw new Error('expected SELECT solutions from a SPARQL query');
  }
  return out as Map<string, oxigraph.Term>[];
}

/** The value a SELECT row binds to a variable the query always binds (not OPTIONAL). */
export function bound(row: Map<string, oxigraph.Term>, name: string): string {
  const term = row.get(name);
  if (!term || !('value' in term)) throw new Error(`SPARQL row does not bind ?${name}`);
  return term.value;
}

export interface ComplexSearchCriteria {
  text?: string;
  creator?: string;
  subject?: string;
  spatial?: string;
  yearFrom?: number;
  yearTo?: number;
  language?: string;
  community?: string;
  communities?: string[];
  collection?: string;
  hasPdf?: boolean;
  copyrightVerdict?: string;
  govdoc?: string;
  isbn?: string;
}

export interface SearchResultItem {
  handle: string;
  title: string;
  creator?: string;
  issued?: string;
  year?: number;
  spatial?: string;
  community?: string;
  collection?: string;
  subjects: string[];
  languages: string[];
  pdfName?: string;
  pdfBytes?: number;
  copyrightGate?: string;
  govdoc?: string;
  isbn?: string;
}

export interface FacetResult {
  facet: string;
  value: string;
  count: number;
}

export interface SearchOptions {
  communities?: string[];
}

export class IrisOxigraphEngine {
  public store: oxigraph.Store;
  private loadedGraphs: Set<string> = new Set();
  private loadedCommunities: Set<string> = new Set();
  private spineLoaded: boolean = false;

  constructor() {
    this.store = new oxigraph.Store();
  }

  /**
   * Load N-Quads (string or file path, compressed or uncompressed) into the store.
   */
  public load(input: string | Buffer, format: string = 'application/n-quads'): void {
    let content: string;
    if (Buffer.isBuffer(input)) {
      content = input.toString('utf8');
    } else if (typeof input === 'string' && fs.existsSync(input)) {
      if (input.endsWith('.gz')) {
        content = zlib.gunzipSync(fs.readFileSync(input)).toString('utf8');
      } else {
        content = fs.readFileSync(input, 'utf8');
      }
    } else {
      content = input;
    }

    this.store.load(content, { format });
  }

  /**
   * Loads the Tier 1 Global Routing Spine into the store.
   */
  public loadSpine(input: string | Buffer): void {
    this.load(input);
    this.loadedGraphs.add('https://iris.who.int/graph/spine');
    this.spineLoaded = true;
  }

  /**
   * Lazily loads an additional named subgraph on-demand into the store.
   */
  public loadSubgraph(graphIri: string, input: string | Buffer): void {
    if (this.loadedGraphs.has(graphIri)) {
      return; // Already mounted
    }
    this.load(input);
    this.loadedGraphs.add(graphIri);
  }

  /**
   * Lazily mounts an individual Tier 2 community subgraph into the store.
   */
  public loadCommunity(communityId: string, input: string | Buffer): void {
    const graphIri = `https://iris.who.int/graph/community/${communityId}`;
    if (this.loadedCommunities.has(communityId) || this.loadedGraphs.has(graphIri)) {
      return;
    }
    this.load(input);
    this.loadedGraphs.add(graphIri);
    this.loadedCommunities.add(communityId);
  }

  /**
   * Lazily mounts multiple community subgraphs into the store.
   */
  public loadCommunities(
    communityIds: string[],
    resolver: string | ((communityId: string) => string | Buffer)
  ): void {
    for (const cId of communityIds) {
      if (this.isCommunityLoaded(cId)) continue;
      let payload: string | Buffer | undefined;
      if (typeof resolver === 'function') {
        payload = resolver(cId);
      } else {
        const nqPath = path.join(resolver, `iris_who_int_graph_community_${cId}.nq`);
        const gzPath = `${nqPath}.gz`;
        if (fs.existsSync(gzPath)) {
          payload = gzPath;
        } else if (fs.existsSync(nqPath)) {
          payload = nqPath;
        }
      }
      if (payload) {
        this.loadCommunity(cId, payload);
      }
    }
  }

  public isCommunityLoaded(communityId: string): boolean {
    return this.loadedCommunities.has(communityId) || this.loadedGraphs.has(`https://iris.who.int/graph/community/${communityId}`);
  }

  public isSpineLoaded(): boolean {
    return this.spineLoaded || this.loadedGraphs.has('https://iris.who.int/graph/spine');
  }

  public getLoadedCommunities(): string[] {
    return Array.from(this.loadedCommunities);
  }

  public getLoadedGraphs(): string[] {
    return Array.from(this.loadedGraphs);
  }

  /**
   * Fast Tier 1 search over the global routing spine.
   * Does not require Tier 2 community partitions to be loaded.
   */
  public searchSpine(criteria: ComplexSearchCriteria = {}): SearchResultItem[] {
    const filters: string[] = [];

    if (criteria.text) {
      const escaped = sparqlString(criteria.text.toLowerCase());
      filters.push(`CONTAINS(LCASE(?title), "${escaped}")`);
    }
    if (criteria.creator) {
      const escaped = sparqlString(criteria.creator.toLowerCase());
      filters.push(`CONTAINS(LCASE(?creator), "${escaped}")`);
    }
    if (criteria.community) {
      const escaped = sparqlString(criteria.community.toLowerCase());
      filters.push(`CONTAINS(LCASE(?commName), "${escaped}")`);
    }
    if (criteria.collection) {
      const escaped = sparqlString(criteria.collection.toLowerCase());
      filters.push(`CONTAINS(LCASE(?collName), "${escaped}")`);
    }
    if (criteria.yearFrom) {
      filters.push(`(?year >= ${criteria.yearFrom})`);
    }
    if (criteria.yearTo) {
      filters.push(`(?year <= ${criteria.yearTo})`);
    }
    if (criteria.hasPdf) {
      filters.push(`BOUND(?pdfName)`);
    }
    if (criteria.copyrightVerdict) {
      const escaped = sparqlString(criteria.copyrightVerdict.toLowerCase());
      filters.push(`LCASE(?copyrightGate) = "${escaped}"`);
    }

    const filterClause = filters.length > 0 ? `FILTER (${filters.join(' && ')})` : '';

    const query = `
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX dspace: <https://iris.who.int/ns/dspace#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      SELECT DISTINCT ?handle ?title ?creator ?issued ?year ?commName ?collName ?pdfName ?pdfBytes ?copyrightGate
      WHERE {
        GRAPH <https://iris.who.int/graph/spine> {
          ?handle a dspace:Item ;
                  dcterms:title ?title .
          OPTIONAL { ?handle dcterms:creator ?creator }
          OPTIONAL { ?handle dcterms:issued ?issued }
          OPTIONAL {
            ?handle dspace:inCommunity ?comm .
            ?comm rdfs:label ?commName .
          }
          OPTIONAL {
            ?handle dspace:inCollection ?coll .
            ?coll rdfs:label ?collName .
          }
          OPTIONAL {
            ?handle dspace:hasBitstream ?bs .
            ?bs dspace:mediaType "application/pdf" ;
                dspace:fileName ?pdfName .
            OPTIONAL { ?bs dspace:fileBytes ?pdfBytes }
            OPTIONAL { ?bs dspace:copyrightGate ?copyrightGate }
          }
        }
        BIND(IF(BOUND(?issued), xsd:integer(SUBSTR(STR(?issued), 1, 4)), 0) AS ?year)
        ${filterClause}
      }
      ORDER BY DESC(?year) ?title
    `;

    const rawRows = selectRows(this.store, query);
    const results: SearchResultItem[] = [];
    for (const row of rawRows) {
      const yearVal = row.get('year')?.value;
      const pdfBytesVal = row.get('pdfBytes')?.value;
      results.push({
        handle: bound(row, 'handle'),
        title: bound(row, 'title'),
        creator: row.get('creator')?.value,
        issued: row.get('issued')?.value,
        year: yearVal ? parseInt(yearVal, 10) : undefined,
        community: row.get('commName')?.value,
        collection: row.get('collName')?.value,
        subjects: [],
        languages: [],
        pdfName: row.get('pdfName')?.value,
        pdfBytes: pdfBytesVal ? parseInt(pdfBytesVal, 10) : undefined,
        copyrightGate: row.get('copyrightGate')?.value
      });
    }
    return results;
  }

  /**
   * Complex Combined Search across Dublin Core metadata and Catalogue graphs.
   * Solves DSpace's limitation of only supporting single isolated facet lookups.
   */
  public complexSearch(criteria: ComplexSearchCriteria = {}): SearchResultItem[] {
    const filters: string[] = [];

    // Title / Abstract / Description keyword
    if (criteria.text) {
      const escaped = sparqlString(criteria.text.toLowerCase());
      filters.push(`(CONTAINS(LCASE(?title), "${escaped}") || CONTAINS(LCASE(COALESCE(?abstract, "")), "${escaped}"))`);
    }

    // Creator / Author
    if (criteria.creator) {
      const escaped = sparqlString(criteria.creator.toLowerCase());
      filters.push(`CONTAINS(LCASE(?creator), "${escaped}")`);
    }

    // Subject / MESH
    if (criteria.subject) {
      const escaped = sparqlString(criteria.subject.toLowerCase());
      filters.push(`CONTAINS(LCASE(?subject), "${escaped}")`);
    }

    // Spatial location (Geneva, Manila, etc.)
    if (criteria.spatial) {
      const escaped = sparqlString(criteria.spatial.toLowerCase());
      filters.push(`CONTAINS(LCASE(?spatial), "${escaped}")`);
    }

    // Date range
    if (criteria.yearFrom) {
      filters.push(`(?year >= ${criteria.yearFrom})`);
    }
    if (criteria.yearTo) {
      filters.push(`(?year <= ${criteria.yearTo})`);
    }

    // Language
    if (criteria.language) {
      const escaped = sparqlString(criteria.language.toLowerCase());
      filters.push(`(LCASE(?langCode) = "${escaped}" || CONTAINS(LCASE(?langLabel), "${escaped}"))`);
    }

    // Community hierarchy (single or multiple)
    if (criteria.communities && criteria.communities.length > 0) {
      const commClauses = criteria.communities.map(c => {
        const escaped = sparqlString(c.toLowerCase());
        return `CONTAINS(LCASE(?commName), "${escaped}")`;
      });
      filters.push(`(${commClauses.join(' || ')})`);
    } else if (criteria.community) {
      const escaped = sparqlString(criteria.community.toLowerCase());
      filters.push(`CONTAINS(LCASE(?commName), "${escaped}")`);
    }

    // Collection hierarchy
    if (criteria.collection) {
      const escaped = sparqlString(criteria.collection.toLowerCase());
      filters.push(`CONTAINS(LCASE(?collName), "${escaped}")`);
    }

    // Bitstream requirements
    if (criteria.hasPdf) {
      filters.push(`BOUND(?pdfName)`);
    }

    // Copyright gate verdict
    if (criteria.copyrightVerdict) {
      const escaped = sparqlString(criteria.copyrightVerdict.toLowerCase());
      filters.push(`LCASE(?copyrightGate) = "${escaped}"`);
    }

    // Government document identifier
    if (criteria.govdoc) {
      const escaped = sparqlString(criteria.govdoc.toLowerCase());
      filters.push(`CONTAINS(LCASE(?govdoc), "${escaped}")`);
    }

    // ISBN
    if (criteria.isbn) {
      const escaped = sparqlString(criteria.isbn.toLowerCase());
      filters.push(`CONTAINS(LCASE(?isbn), "${escaped}")`);
    }

    const filterClause = filters.length > 0 ? `FILTER (${filters.join(' && ')})` : '';

    const query = `
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX dspace: <https://iris.who.int/ns/dspace#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX dspaceNs: <https://litlfred.github.io/folio-assistant-core/v0/ns/dspace/>

      SELECT DISTINCT ?handle ?title ?creator ?issued ?year ?spatial ?abstract
                      ?commName ?collName ?pdfName ?pdfBytes ?copyrightGate
                      ?govdoc ?isbn
      WHERE {
        # Graph pattern A: Base item & catalogue hierarchy from catalogue, spine, or metadata
        {
          GRAPH <https://iris.who.int/graph/catalogue> {
            ?handle a dspace:Item .
            OPTIONAL { ?handle dcterms:title ?catTitle }
            OPTIONAL {
              ?handle dspace:inCommunity ?comm .
              ?comm rdfs:label ?commName .
            }
            OPTIONAL {
              ?handle dspace:inCollection ?coll .
              ?coll rdfs:label ?collName .
            }
            OPTIONAL {
              ?handle dspace:hasBitstream ?bs .
              ?bs dspace:mediaType "application/pdf" ;
                  dspace:fileName ?pdfName .
              OPTIONAL { ?bs dspace:fileBytes ?pdfBytes }
              OPTIONAL { ?bs dspace:copyrightGate ?copyrightGate }
            }
          }
        } UNION {
          GRAPH <https://iris.who.int/graph/spine> {
            ?handle a dspace:Item .
            OPTIONAL { ?handle dcterms:title ?spineTitle }
            OPTIONAL { ?handle dcterms:creator ?spineCreator }
            OPTIONAL { ?handle dcterms:issued ?spineIssued }
            OPTIONAL {
              ?handle dspace:inCommunity ?comm .
              ?comm rdfs:label ?commName .
            }
            OPTIONAL {
              ?handle dspace:inCollection ?coll .
              ?coll rdfs:label ?collName .
            }
            OPTIONAL {
              ?handle dspace:hasBitstream ?bs .
              ?bs dspace:mediaType "application/pdf" ;
                  dspace:fileName ?pdfName .
              OPTIONAL { ?bs dspace:fileBytes ?pdfBytes }
              OPTIONAL { ?bs dspace:copyrightGate ?copyrightGate }
            }
          }
        } UNION {
          GRAPH <https://iris.who.int/graph/metadata> {
            ?handle dcterms:title ?metaTitleAlone .
          }
        }

        # Graph pattern B: Dublin Core detailed metadata from <https://iris.who.int/graph/metadata> OR mounted community partition
        OPTIONAL {
          GRAPH ?metaGraph {
            OPTIONAL { ?handle dcterms:title ?metaTitle }
            OPTIONAL {
              ?handle dcterms:creator ?crNode .
              OPTIONAL { ?crNode rdf:value ?metaCr }
            }
            OPTIONAL { ?handle dcterms:issued ?metaIssued }
            OPTIONAL { ?handle dcterms:abstract ?abstract }
            OPTIONAL {
              ?handle dcterms:spatial ?spNode .
              ?spNode rdf:value ?spatial .
            }
            OPTIONAL { ?handle <https://litlfred.github.io/folio-assistant-core/v0/ns/dspace/dc.identifier.govdoc> ?govdoc }
            OPTIONAL { ?handle <https://litlfred.github.io/folio-assistant-core/v0/ns/dspace/dc.identifier.isbn> ?isbn }
            OPTIONAL {
              ?handle dcterms:subject ?sNode .
              ?sNode rdf:value ?subject .
            }
            OPTIONAL {
              ?handle dcterms:language ?lNode .
              ?lNode rdf:value ?langLabel .
              OPTIONAL { ?lNode rdf:value ?langCode }
            }
          }
          FILTER (?metaGraph = <https://iris.who.int/graph/metadata> || STRSTARTS(STR(?metaGraph), "https://iris.who.int/graph/community/"))
        }

        BIND(COALESCE(?metaTitle, ?spineTitle, ?catTitle, ?metaTitleAlone) AS ?title)
        BIND(COALESCE(?metaCr, ?spineCreator) AS ?creator)
        BIND(COALESCE(?metaIssued, ?spineIssued) AS ?issued)
        BIND(IF(BOUND(?issued), xsd:integer(SUBSTR(STR(?issued), 1, 4)), 0) AS ?year)

        ${filterClause}
      }
      ORDER BY DESC(?year) ?title
    `;

    const rawRows = selectRows(this.store, query);
    const itemMap = new Map<string, SearchResultItem>();

    for (const row of rawRows) {
      const handle = bound(row, 'handle');
      if (!itemMap.has(handle)) {
        const issued = row.get('issued')?.value;
        const yearVal = row.get('year')?.value;
        itemMap.set(handle, {
          handle,
          title: bound(row, 'title'),
          creator: row.get('creator')?.value,
          issued,
          year: yearVal ? parseInt(yearVal, 10) : undefined,
          spatial: row.get('spatial')?.value,
          community: row.get('commName')?.value,
          collection: row.get('collName')?.value,
          subjects: [],
          languages: [],
          pdfName: row.get('pdfName')?.value,
          pdfBytes: row.get('pdfBytes')?.value ? parseInt(row.get('pdfBytes')!.value, 10) : undefined,
          copyrightGate: row.get('copyrightGate')?.value,
          govdoc: row.get('govdoc')?.value,
          isbn: row.get('isbn')?.value
        });
      }
    }

    // Hydrate subjects and languages for matched handles
    const results = Array.from(itemMap.values());
    for (const item of results) {
      this.hydrateItemMetadata(item);
    }

    return results;
  }

  private hydrateItemMetadata(item: SearchResultItem): void {
    const subjQuery = `
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT DISTINCT ?subject WHERE {
        GRAPH ?metaGraph {
          <${item.handle}> dcterms:subject ?sNode .
          ?sNode rdf:value ?subject .
        }
        FILTER (?metaGraph = <https://iris.who.int/graph/metadata> || STRSTARTS(STR(?metaGraph), "https://iris.who.int/graph/community/"))
      }
    `;
    for (const r of selectRows(this.store, subjQuery)) {
      const val = bound(r, 'subject');
      if (!item.subjects.includes(val)) {
        item.subjects.push(val);
      }
    }

    const langQuery = `
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT DISTINCT ?lang WHERE {
        GRAPH ?metaGraph {
          <${item.handle}> dcterms:language ?lNode .
          ?lNode rdf:value ?lang .
        }
        FILTER (?metaGraph = <https://iris.who.int/graph/metadata> || STRSTARTS(STR(?metaGraph), "https://iris.who.int/graph/community/"))
      }
    `;
    for (const r of selectRows(this.store, langQuery)) {
      const val = bound(r, 'lang');
      if (!item.languages.includes(val)) {
        item.languages.push(val);
      }
    }
  }

  /**
   * Faceted Aggregations: Computes counts across multiple dimensions.
   */
  public facetCounts(facetName: 'subject' | 'creator' | 'community' | 'year' | 'type'): FacetResult[] {
    let query = '';

    if (facetName === 'subject') {
      query = `
        PREFIX dcterms: <http://purl.org/dc/terms/>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT ?val (COUNT(DISTINCT ?handle) AS ?count) WHERE {
          GRAPH ?metaGraph {
            ?handle dcterms:subject ?sNode .
            ?sNode rdf:value ?val .
          }
          FILTER (?metaGraph = <https://iris.who.int/graph/metadata> || STRSTARTS(STR(?metaGraph), "https://iris.who.int/graph/community/"))
        }
        GROUP BY ?val ORDER BY DESC(?count) ?val
      `;
    } else if (facetName === 'creator') {
      query = `
        PREFIX dcterms: <http://purl.org/dc/terms/>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT ?val (COUNT(DISTINCT ?handle) AS ?count) WHERE {
          {
            GRAPH ?metaGraph {
              ?handle dcterms:creator ?cNode .
              ?cNode rdf:value ?val .
            }
            FILTER (?metaGraph = <https://iris.who.int/graph/metadata> || STRSTARTS(STR(?metaGraph), "https://iris.who.int/graph/community/"))
          } UNION {
            GRAPH <https://iris.who.int/graph/spine> {
              ?handle dcterms:creator ?val .
            }
          }
        }
        GROUP BY ?val ORDER BY DESC(?count) ?val
      `;
    } else if (facetName === 'community') {
      query = `
        PREFIX dspace: <https://iris.who.int/ns/dspace#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?val (COUNT(DISTINCT ?handle) AS ?count) WHERE {
          GRAPH ?catGraph {
            ?handle dspace:inCommunity ?comm .
            ?comm rdfs:label ?val .
          }
          FILTER (?catGraph = <https://iris.who.int/graph/catalogue> || ?catGraph = <https://iris.who.int/graph/spine>)
        }
        GROUP BY ?val ORDER BY DESC(?count) ?val
      `;
    } else if (facetName === 'year') {
      query = `
        PREFIX dcterms: <http://purl.org/dc/terms/>
        SELECT ?val (COUNT(DISTINCT ?handle) AS ?count) WHERE {
          {
            GRAPH ?metaGraph {
              ?handle dcterms:issued ?issued .
              BIND(SUBSTR(STR(?issued), 1, 4) AS ?val)
            }
            FILTER (?metaGraph = <https://iris.who.int/graph/metadata> || STRSTARTS(STR(?metaGraph), "https://iris.who.int/graph/community/"))
          } UNION {
            GRAPH <https://iris.who.int/graph/spine> {
              ?handle dcterms:issued ?issued .
              BIND(SUBSTR(STR(?issued), 1, 4) AS ?val)
            }
          }
        }
        GROUP BY ?val ORDER BY DESC(?val)
      `;
    } else if (facetName === 'type') {
      query = `
        PREFIX dcterms: <http://purl.org/dc/terms/>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT ?val (COUNT(DISTINCT ?handle) AS ?count) WHERE {
          GRAPH ?metaGraph {
            ?handle dcterms:type ?tNode .
            ?tNode rdf:value ?val .
          }
          FILTER (?metaGraph = <https://iris.who.int/graph/metadata> || STRSTARTS(STR(?metaGraph), "https://iris.who.int/graph/community/"))
        }
        GROUP BY ?val ORDER BY DESC(?count) ?val
      `;
    }

    const rows = selectRows(this.store, query);
    const results: FacetResult[] = [];
    for (const row of rows) {
      results.push({
        facet: facetName,
        value: bound(row, 'val'),
        count: parseInt(bound(row, 'count'), 10)
      });
    }
    return results;
  }
}

// CLI interactive runner
if (import.meta.main) {
  const engine = new IrisOxigraphEngine();
  const defaultNq = path.resolve(import.meta.dir, '..', 'dist', 'oxigraph', 'who-iris-dataset.nq');

  if (!fs.existsSync(defaultNq)) {
    console.error(`Dataset not found at ${defaultNq}. Run build-iris-oxigraph.ts first.`);
    process.exit(1);
  }

  engine.load(defaultNq);
  console.log(`Loaded WHO-IRIS dataset into Oxigraph (${engine.store.size} quads)\n`);

  // Run complex search test
  console.log('=== 1. Combined Complex Search: Subject="Guidelines" AND Community="Western Pacific" ===');
  const res1 = engine.complexSearch({ subject: 'Guidelines', community: 'Western Pacific' });
  console.log(JSON.stringify(res1, null, 2));

  console.log('\n=== 2. Combined Complex Search: Spatial="Geneva" AND Year <= 2000 ===');
  const res2 = engine.complexSearch({ spatial: 'Geneva', yearTo: 2000 });
  console.log(JSON.stringify(res2, null, 2));

  console.log('\n=== 3. Subject Facets (Multi-dimensional count) ===');
  const subjects = engine.facetCounts('subject');
  for (const s of subjects) {
    console.log(`- ${s.value}: ${s.count}`);
  }

  console.log('\n=== 4. Community Facets ===');
  const comms = engine.facetCounts('community');
  for (const c of comms) {
    console.log(`- ${c.value}: ${c.count}`);
  }
}
