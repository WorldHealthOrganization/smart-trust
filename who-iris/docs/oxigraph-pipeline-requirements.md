# Oxigraph Static Pipeline & Search Requirements

How the IRIS catalogue is compiled into named graphs with **Oxigraph**,
checked, published, and queried. How to build and query it is in the
[`iris-oxigraph`](../skills/iris-oxigraph.md) skill.

> [!IMPORTANT]
> **Binary assets are never embedded in the graph.** PDFs, image bitstreams and
> covers stay on the CDN. The graph holds typed entities, Dublin Core values,
> containment, and each bitstream's file name, media type, byte size and
> copyright verdict.

---

## 1. Pipeline Architecture & Placement

The pipeline is modelled in the cat-harness BPMN process files, which are the
source of truth:

- **Package and distribute partitioned N-Quads** (spine, community partitions,
  manifest, prepared queries):
  [`processes/kg/nquads-distribution.bpmn`](https://github.com/litlfred/cat-harness/blob/main/processes/kg/nquads-distribution.bpmn)

  ![BPMN: package and distribute partitioned N-Quads and named queries](https://cdn.jsdelivr.net/gh/litlfred/cat-harness@main/docs/assets/img/workflows/nquads-distribution.svg)

- **Run a prepared SPARQL query in Oxigraph** (browser WASM or local engine):
  [`processes/kg/named-query-execution.bpmn`](https://github.com/litlfred/cat-harness/blob/main/processes/kg/named-query-execution.bpmn)

  ![BPMN: named query execution](https://cdn.jsdelivr.net/gh/litlfred/cat-harness@main/docs/assets/img/workflows/named-query-execution.svg)

How this instance feeds the pipeline from IRIS and publishes to Cloudflare is
in [IRIS CDN Exporter: processes](iris-cdn-export.md); its nightly full
rebuild calls `nquads-distribution`.

---

## 2. Pipeline Integration Stages

### Stage 1: Build-Time Ingestion, Skolemization & 2-Tier Partitioning
- **Input**, either:
  - `catalogue/nodes/*.json` (communities, collections, items, bitstreams) and
    `site/dublin-core/*.dc.jsonld` (Qualified Dublin Core records conforming to
    `dublin-core.ts`); or
  - `--records <dir>`: DSpace records exported by `scripts/iris-cdn/run.ts`.
- **Tool:** `scripts/build-iris-oxigraph.ts` (`--out <dir>`, default
  `dist/oxigraph/`).
- **Actions:**
  1. **Skolemization:** mint deterministic URIs
     (`https://iris.who.int/entity/item/{handle}#{prop}_{idx}`) for every
     anonymous compound Dublin Core object. The build fails if any blank node
     (`_:`) remains.
  2. **Partitioning:**
     - **Tier 1 (Spine)**: `<https://iris.who.int/graph/spine>` — hierarchy,
       item Handles, title, first creator, issued date, and bitstream
       descriptors with copyright verdicts. `who-iris-spine.nq` and `.nq.gz`.
     - **Tier 2 (Partitions)**: `<https://iris.who.int/graph/community/{id}>` —
       the full Dublin Core of each community's items (MeSH authorities,
       abstracts, spatial tags, govdoc, ISBN).
       `iris_who_int_graph_community_{id}.nq` and `.nq.gz`.
     - **Catalogue and metadata graphs**:
       `iris_who_int_graph_catalogue.nq(.gz)` and
       `iris_who_int_graph_metadata.nq(.gz)`, merged in `who-iris-dataset.nq`
       and `.nq.gz`.
  3. **Manifest & prepared queries:** `subgraph-manifest.json` (partition
     registry) and `queries.json` (prepared SPARQL).
  4. Every file is sorted and de-duplicated, so unchanged partitions are
     byte-identical across rebuilds.

### Stage 2: Build-Time Tests
<!-- command-path-ok: run from the who-iris instance root (where scripts/ lives); in an index checkout that mounts who-iris at who-iris/ and has its own root scripts/, check:command-paths resolves scripts/ against the index root -->
```bash
bun run scripts/build-iris-oxigraph.ts
bun test scripts/tests/iris-oxigraph.test.ts
```
The test builds the dataset and checks: zero blank nodes; multi-condition
search, date-range search and facet counts; additive community mounting; the
`discoverySearch` prepared query; that the manifest's partition files exist;
and that a rebuild over exported records leaves unchanged partitions
byte-identical.

Not yet checked by any test: every item declares a collection and community
path; every bitstream declares bytes and media type; every item has a
`10665/...` Handle.

### Stage 3: CDN Distribution

Exported data is published to **Cloudflare**: R2 behind the Cloudflare CDN,
with release history in a git repository on Cloudflare Artifacts (see
[IRIS CDN Exporter: deployment](iris-cdn-deployment.md)).
- `scripts/iris-cdn/run.ts` rebuilds the dataset over the exported records and
  lists each output file in the release manifest as `graph/<file>`:
  - `who-iris-spine.nq.gz` (Tier 1 spine)
  - `subgraph-manifest.json` (partition registry)
  - `iris_who_int_graph_community_{id}.nq.gz` (Tier 2 partitions)
  - `who-iris-dataset.nq.gz` (merged graph)
  - `queries.json` (prepared queries)
- The bytes are stored in R2 under `sha256/<aa>/<digest>`.
- **Cache Policy:** `Cache-Control: public, max-age=31536000, immutable` on
  `sha256/*`. A changed file has a new digest, so a cached object never goes
  stale.

### Stage 4: Client-Side Execution (Browser WASM)

The intended client pattern (no page in this repository loads Oxigraph yet;
the replica's home page filters an index embedded in the page with plain
JavaScript):
  1. Create an in-memory store: `const store = new oxigraph.Store();`
  2. Fetch the spine (`who-iris-spine.nq.gz`) and `subgraph-manifest.json`.
  3. Decompress and load:
     `store.load(decompressedNq, { format: 'application/n-quads' })`.
  4. Run prepared SPARQL locally for title search, year filters and
     open-access gates.
  5. When the user selects a community, fetch its `.nq.gz` partition from the
     manifest and `store.load()` it; existing quads are kept.

---

## 3. Formal Requirements (Checkable Specifications)

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **SR-1** | **No Binary Embeddings in Graph**: No RDF literal or URI may represent raw file bytes (base64 or blob data). Bitstreams are nodes reached by `dspace:hasBitstream`, with `fileName`, `fileBytes` (integer) and `mediaType`. | Not automated. |
| **SR-2** | **Upstream Skolemization at the Extractor (Zero Blank Nodes)**: Extractors and ingestion pipelines assign deterministic URIs (`https://iris.who.int/entity/item/{handle}#{prop}_{idx}`) at extraction for all compound nodes (creators, subjects, dates). No blank node (`_:`) may be emitted. | The build throws on any residual blank node; `iris-oxigraph.test.ts` asserts none in the dataset. |
| **SR-3** | **Multi-Graph Isolation**: Catalogue containment and rights gates reside in `<https://iris.who.int/graph/catalogue>`; bibliographic records in `<https://iris.who.int/graph/metadata>`. | Not automated. The catalogue graph also carries `rdf:type`, `rdfs:label` and `dcterms:title`. |
| **SR-4** | **Sub-50ms Query Execution**: Standard discovery and complex search queries over the materialized dataset complete in under 50 milliseconds in WASM. | Not measured by any test. |
| **SR-5** | **Additive Subgraph Mounting**: `store.load()` of an additional named subgraph must not clobber, mutate, or duplicate loaded quads. | `iris-oxigraph.test.ts`: a query before mounting returns N items; after mounting a community, N + M. |
| **SR-6** | **Handle Authority**: Every item subject URI uses the Handle system: `https://hdl.handle.net/10665/{id}`. | Graph check: every `a dspace:Item` subject starts with `https://hdl.handle.net/`. |
| **SR-7** | **Compressed Transport Ceiling**: At full scale (300,000 items), a community partition must not exceed 25 MB compressed. | Not measured in CI. |
| **SR-8** | **Prepared Query Equivalence**: Every entry in `queries.json` is valid SPARQL 1.1 and runs against the dataset with 0 errors. | `iris-oxigraph.test.ts` runs `discoverySearch` only. |
| **SR-9** | **Append-Only Streaming Partitioning**: The build writes partitions as an append-only stream, with memory bounded regardless of corpus size (300,000 items). | **Not met:** `buildIrisDataset` holds and sorts every quad in memory; `StreamingPartitionWriter` is unused. Target: heap under 250 MB for the whole corpus. |

---

## 4. Scale Modeling & Corpus Sizing (300,000 Items)

WHO IRIS holds **273,559 items** across **1,057,223 files**, about
**361.55 GiB** of PDFs, reports and images (see
[`iris-dspace`](../skills/iris-dspace.md) §Scale). The figures below are
estimates for about 300,000 items.

### Sizing Comparison: Raw Full-Text vs. Pure KG Extract in Oxigraph

| Metric | Raw Full-Text in Oxigraph | Pure KG Metadata Extract (Architecture Standard) |
| :--- | :--- | :--- |
| **Content Included** | Full OCR extracted page text + bibliographic metadata | Dublin Core, MeSH authorities, bitstream descriptors, access gates, hierarchy paths |
| **Binary Blobs in RDF** | **0** (strictly excluded) | **0** (strictly excluded) |
| **Quads / Triples** | ~45,000,000 quads (including sentence/paragraph chunks) | ~12,000,000 quads (~40 quads per item) |
| **Uncompressed N-Quads** | ~45 – 60 GB | ~1.2 – 1.5 GB |
| **Brotli / Gzip Payload** | ~8 – 12 GB compressed | **~95 – 140 MB compressed** (>90% compression ratio) |
| **Partition Size (per Community)** | ~1.2 – 1.8 GB compressed | **~12 – 20 MB compressed** |
| **WASM In-Memory RAM** | **> 4 GB** (Exceeds 32-bit WASM limit &rarr; **Browser Crash**) | **~35 – 65 MB RAM** per loaded partition |
| **Load Time over CDN (4G/Fiber)** | Impossible in browser | **150 ms – 350 ms** |
| **Query Latency** | Slow regex/filter scans (> 5,000 ms) | **< 15 ms** index-backed graph pattern matching |

### Architectural Recommendation
1. **Never load full text into Oxigraph.** Substring filters over millions of
   text literals are slow and exceed browser memory.
2. **Hybrid search:**
   - A static inverted index (e.g. Pagefind, MiniSearch, or a sharded SQLite
     FTS5 WASM slice) handles full-text lookup and yields candidate item IRIs.
   - The candidates go into Oxigraph as `VALUES ?item { ... }` for facets, MeSH
     hierarchies, collection constraints and copyright gates.

---

## 5. Registered Tools, Skills & Verification

### Executable Scripts & Tools
- `scripts/build-iris-oxigraph.ts`: N-Quads compiler, skolemizer and gzip
  writer.
- `scripts/iris-oxigraph-search.ts`: `IrisOxigraphEngine` — boolean search,
  facet counts and incremental subgraph mounting.
- `scripts/gen-iris-pages.ts`: static site generator; the home page's facet
  chips and filters run over an index embedded in the page, not Oxigraph.

### Test Suites
- Unit: `bun test scripts/tests/iris-oxigraph.test.ts`.
- End-to-end: `bunx playwright test cat-harness-tools/test/who-iris-search.e2e.ts`
  (browser search, facet chips, open-access filters, multilingual UI).

### Formal Skills & Specifications
- `skills/iris-oxigraph.md`: requirements `OX-1` through `OX-9`.
- `docs/oxigraph-pipeline-requirements.md`: system requirements `SR-1` through
  `SR-9`.
