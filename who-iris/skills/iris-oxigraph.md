---
name: iris-oxigraph
description: >
  How to build WHO IRIS catalogue and Qualified Dublin Core metadata into
  partitioned N-Quads, and query it with Oxigraph — in Bun on the build side,
  in WebAssembly in the browser — including cross-graph joins and facet counts.
conformsTo:
  - w3c-sparql-1.1-query
  - w3c-n-quads
graph-typologies:
  - catalogue
  - skills
---

# Oxigraph multi-graph search for WHO IRIS

The IRIS catalogue and its Dublin Core records are compiled into named graphs
and queried with **Oxigraph**: natively in Bun at build time, and as
WebAssembly in a browser. One SPARQL query can then join Dublin Core
properties, catalogue containment and bitstream access gates — which DSpace
Discovery cannot do in a single call.

## Build and query

<!-- command-path-ok: run from the who-iris instance root (where scripts/ lives); in an index checkout that mounts who-iris at who-iris/ and has its own root scripts/, check:command-paths resolves scripts/ against the index root -->
```sh
# Build from catalogue/nodes and site/dublin-core into dist/oxigraph/
bun run scripts/build-iris-oxigraph.ts

# Build from exported DSpace records (the CDN release's records/ tree)
bun run scripts/build-iris-oxigraph.ts --records <dir> --out <dir>

# Load dist/oxigraph/who-iris-dataset.nq and run sample searches and facets
bun run scripts/iris-oxigraph-search.ts

bun test scripts/tests/iris-oxigraph.test.ts
```

`scripts/iris-oxigraph-search.ts` exports `IrisOxigraphEngine`
(`loadSpine`, `loadCommunity`, `searchSpine`, `complexSearch`, `facetCounts`).
The CDN exporter (`scripts/iris-cdn/run.ts`) calls the build over exported
records and publishes each output file as `graph/<file>`.

## 1. Graphs and files

The build writes, sorted and de-duplicated so unchanged inputs give
byte-identical files:

- **Tier 1, the spine** — `<https://iris.who.int/graph/spine>`, in
  `who-iris-spine.nq` and `.nq.gz`. Hierarchy (`dspace:Community`,
  `dspace:Collection`), item Handles, titles, first creator, issued date, and
  bitstream descriptors with copyright verdicts. Loaded first.
- **Tier 2, one partition per community** —
  `<https://iris.who.int/graph/community/{id}>`, in
  `iris_who_int_graph_community_{id}.nq` and `.nq.gz`. The full Dublin Core of
  that community's items: MeSH authorities, abstracts, spatial coverage, govdoc
  numbers, ISBNs. Mounted on demand.
- **Catalogue and metadata graphs** — `<https://iris.who.int/graph/catalogue>`
  and `<https://iris.who.int/graph/metadata>`, each in its own
  `iris_who_int_graph_{catalogue,metadata}.nq(.gz)`, and merged in
  `who-iris-dataset.nq` and `.nq.gz` for server-side use and integrity checks.
- **The documents' reference lists** — the `folio-reference/v1` nodes in
  `references/` (written by `references:extract`, one per entry a document
  prints). In the spine, the citation edges: the document's Handle
  `cito:cites` the reference (`https://litlfred.github.io/folio/references/<key>`,
  the IRI its bibliography page names), and `cito:cites` the IRIS item when
  the library holds the cited work (`heldAt`). In the metadata graph and the
  citing document's community partition, the reference itself: `fabio:Work`,
  `dcterms:title` or `dcterms:bibliographicCitation` (as printed),
  `dcterms:issued` (`xsd:gYear`), `bibo:doi`, `dcterms:identifier`. A
  document's Handle comes from the catalogue node whose `libraryId` is its
  library slug. A `--records` build reads none unless given `referencesDir`.
  The bibliography's own word search is a separate static index
  (`<route>/search/`, core's `bibliography-search.ts`).
- **`subgraph-manifest.json`** — the spine and each community partition, with
  file names, quad counts and item counts.
- **`queries.json`** — prepared SPARQL queries.

### Namespaces

- `dspace:` = `https://iris.who.int/ns/dspace#` — catalogue terms (`Item`,
  `inCommunity`, `hasBitstream`, `fileName`, …).
- `dspaceNs:` = `https://litlfred.github.io/folio-assistant-core/v0/ns/dspace/`
  — Dublin Core value terms, including `authority`.

### No binary bytes in the graph

PDFs, cover images and archives are never stored as literals. A bitstream node
carries only:

- `dspace:fileName` (e.g. `"WPR-RDO-2020-003-eng.pdf"`)
- `dspace:mediaType` (e.g. `"application/pdf"`)
- `dspace:fileBytes` (integer)
- `dspace:copyrightGate` — the copyright gate's verdict, e.g. `"permitted"`

The bytes are fetched from the CDN.

## 2. Requirements

| # | Requirement | Why, in one line |
|---|---|---|
| **OX-1** | **Mint stable URIs at the extractor** (`https://iris.who.int/entity/item/{handle}#{prop}_{idx}`); the build fails if any blank node remains | no multi-document collisions, every node addressable, no normalizer pass |
| **OX-2** | **Store zero binary bytes in RDF** | keeps WASM memory small; binaries are static files on the CDN |
| **OX-3** | **Join across named graphs with explicit `GRAPH` blocks** | separates containment and rights from bibliographic description |
| **OX-4** | **Use Handle URIs as the item subject** (`https://hdl.handle.net/...`) | identity resolves outside WHO's servers |
| **OX-5** | **Treat bitstream rights as access gates** | results can be filtered by whether the PDF may be downloaded |
| **OX-6** | **Partition by community** | a client fetches only the slice it needs |
| **OX-7** | **Never scan whole-corpus text in SPARQL** | full text belongs in a static inverted index |
| **OX-8** | **Preserve controlled-vocabulary authorities** (`dspaceNs:authority`) | distinguishes MeSH headings from free keywords |
| **OX-9** | **Append-only streaming partition emission** | bounded memory at 300,000 items. **Not met yet:** `buildIrisDataset` holds and sorts every quad in memory; `StreamingPartitionWriter` is defined but unused |

## 3. SPARQL recipes

### Recipe 1: multi-condition search

Items in the **Western Pacific** community, issued in or after **2000**, with a
subject containing **"guidelines"**, and a PDF whose copyright verdict is
`permitted`.

```sparql
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX dspace: <https://iris.who.int/ns/dspace#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT DISTINCT ?handle ?title ?creator ?issued ?pdfName WHERE {
  # 1. Join Dublin Core Metadata
  GRAPH <https://iris.who.int/graph/metadata> {
    ?handle dcterms:title ?title ;
            dcterms:creator ?crNode ;
            dcterms:subject ?sNode .
    ?crNode rdf:value ?creator .
    ?sNode rdf:value ?subject .
    OPTIONAL { ?handle dcterms:issued ?issued }
  }

  # 2. Join Catalogue Hierarchy & Access Gates
  GRAPH <https://iris.who.int/graph/catalogue> {
    ?handle dspace:inCommunity ?comm ;
            dspace:hasBitstream ?bs .
    ?comm rdfs:label ?commLabel .
    ?bs dspace:mediaType "application/pdf" ;
        dspace:fileName ?pdfName ;
        dspace:copyrightGate "permitted" .
  }

  # 3. Multi-Field Filter Evaluation
  BIND(IF(BOUND(?issued), xsd:integer(SUBSTR(STR(?issued), 1, 4)), 0) AS ?year)
  FILTER (
    CONTAINS(LCASE(?subject), "guidelines") &&
    CONTAINS(LCASE(?commLabel), "western pacific") &&
    (?year >= 2000)
  )
}
ORDER BY DESC(?year)
```

### Recipe 2: facet counts

Item counts per subject term and its authority.

```sparql
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX dspaceNs: <https://litlfred.github.io/folio-assistant-core/v0/ns/dspace/>

SELECT ?subject (COUNT(DISTINCT ?handle) AS ?itemCount) ?authority WHERE {
  GRAPH <https://iris.who.int/graph/metadata> {
    ?handle dcterms:subject ?sNode .
    ?sNode rdf:value ?subject .
    OPTIONAL { ?sNode dspaceNs:authority ?authority }
  }
}
GROUP BY ?subject ?authority
ORDER BY DESC(?itemCount) ?subject
```

## 4. Browser pattern: spine first, communities on demand

```typescript
import oxigraph from 'oxigraph';

// Where the graph files are served from, e.g. a release's graph/ directory.
const BASE = '<graph-base-url>';

async function gunzipText(resp: Response): Promise<string> {
  const stream = resp.body!.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

const store = new oxigraph.Store();

// 1. Fetch the spine and the manifest
const [spineResp, manifestResp] = await Promise.all([
  fetch(`${BASE}/who-iris-spine.nq.gz`),
  fetch(`${BASE}/subgraph-manifest.json`),
]);
const manifest = await manifestResp.json();

// 2. Load the spine: hierarchy, title search and rights filtering work now
store.load(await gunzipText(spineResp), { format: 'application/n-quads' });

// 3. Mount a community when the user selects it. load() adds its named
//    graph without clobbering what is already in the store.
async function mountCommunity(commId: string) {
  const partition = manifest.tiers.tier2_communities.partitions[commId];
  if (!partition) return;
  const resp = await fetch(`${BASE}/${partition.fileGz}`);
  store.load(await gunzipText(resp), { format: 'application/n-quads' });
}

// 4. Run a prepared query locally
for (const binding of store.query(myPreparedQuery)) {
  console.log(binding.get('title').value);
}
```
