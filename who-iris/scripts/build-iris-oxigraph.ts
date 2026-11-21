/**
 * Build script for WHO-IRIS Oxigraph Multi-Graph Dataset
 *
 * Implements 2-Tier Architecture:
 * - Tier 1: Global Routing Spine (<https://iris.who.int/graph/spine>)
 *   Lightweight, fast discovery across all items and catalogue hierarchy.
 *   Emitted as `who-iris-spine.nq` and `who-iris-spine.nq.gz`.
 *
 * - Tier 2: Partitioned Community Subgraphs (<https://iris.who.int/graph/community/{id}>)
 *   Detailed Qualified Dublin Core entities (MeSH subjects, authorities, abstracts,
 *   spatial coverage, full bitstream fixity records).
 *   Emitted per-community as `iris_who_int_graph_community_{id}.nq` and `.nq.gz`.
 *
 * - Manifest: `subgraph-manifest.json` describing tiers, subgraphs, quad counts,
 *   and file mappings for edge dynamic loading.
 *
 * - Solution A Skolemization: Converts all compound anonymous nodes to globally
 *   scoped, deterministic URIs. Asserts zero blank nodes in the entire dataset.
 *
 * - Sorted deterministic output (#104): N-Quads in every partition and spine
 *   file are deduplicated and sorted byte-wise so a nightly full rebuild over
 *   exported records (`--records <dir>` / `opts.recordsDir`) produces
 *   byte-identical files for every partition whose items did not change.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const WHO_IRIS_ROOT = path.resolve(import.meta.dir, '..');
const NODES_DIR = path.join(WHO_IRIS_ROOT, 'catalogue', 'nodes');
const DC_DIR = path.join(WHO_IRIS_ROOT, 'site', 'dublin-core');
const DIST_DIR = path.join(WHO_IRIS_ROOT, 'dist', 'oxigraph');

export const GRAPH_IRIS_SPINE = 'https://iris.who.int/graph/spine';
export const GRAPH_IRIS_CATALOGUE = 'https://iris.who.int/graph/catalogue';
export const GRAPH_IRIS_METADATA = 'https://iris.who.int/graph/metadata';
export const GRAPH_PREFIX_COMMUNITY = 'https://iris.who.int/graph/community/';

const DCTERMS_NS = 'http://purl.org/dc/terms/';
const DC_ELEMENTS_NS = 'http://purl.org/dc/elements/1.1/';
const DCAM_NS = 'http://purl.org/dc/dcam/';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const DSPACE_CORE_NS = 'https://litlfred.github.io/folio-assistant-core/v0/ns/dspace/';

export interface SubgraphPartitionInfo {
  id: string;
  name: string;
  iri: string;
  fileNq: string;
  fileGz: string;
  quadCount: number;
  itemCount: number;
}

export interface SubgraphManifest {
  version: string;
  generatedAt: string;
  tiers: {
    tier1_spine: {
      iri: string;
      fileNq: string;
      fileGz: string;
      quadCount: number;
      itemCount: number;
      description: string;
    };
    tier2_communities: {
      description: string;
      partitions: Record<string, SubgraphPartitionInfo>;
    };
  };
}

export interface BuildResult {
  totalQuads: number;
  spineQuads: number;
  metadataQuads: number;
  catalogueQuads: number;
  skolemizedCount: number;
  outputNqPath: string;
  outputGzPath: string;
  outputSpineNqPath: string;
  outputSpineGzPath: string;
  queriesJsonPath: string;
  manifestJsonPath: string;
  subgraphs: Record<string, number>;
  manifest: SubgraphManifest;
}

export interface BuildIrisOptions {
  /**
   * Directory of exported DSpace records (`records/` layout written by
   * `scripts/iris-cdn/run.ts`: `communities/**.json`, `collections/**.json`,
   * and item `<handle>.json` files). When omitted, reads this repository's
   * `catalogue/nodes` + `site/dublin-core`.
   */
  recordsDir?: string;
  /**
   * Explicit timestamp for `subgraph-manifest.json`. When `recordsDir` is used
   * and `generatedAt` is omitted, derived deterministically from the newest
   * `lastModified` in the exported records so unchanged inputs produce
   * byte-identical manifests.
   */
  generatedAt?: string;
  /**
   * Directory of `folio-reference/v1` nodes: the reference lists extracted
   * from the library's documents (`references/`). When omitted, this
   * repository's `references/` is read for a local build, and none for a
   * `recordsDir` build.
   */
  referencesDir?: string;
}

/**
 * The KG IRI of a reference: core's `referenceIri(key)` (`references/<key>`)
 * resolved against cat-harness's `FOLIO_BASE`, the IRI every `\cite{key}` and
 * every bibliography page already names. Written out here so this build
 * needs no mounted layer.
 */
export const REFERENCE_BASE = 'https://litlfred.github.io/folio/references/';
const CITO_CITES = 'http://purl.org/spar/cito/cites';
const FABIO_WORK = 'http://purl.org/spar/fabio/Work';
const BIBO_DOI = 'http://purl.org/ontology/bibo/doi';

interface ReferenceFile {
  id?: string;
  title?: string;
  printed?: string;
  derivedFrom?: string;
  heldAt?: string;
  DOI?: string;
  URL?: string;
  issued?: { 'date-parts'?: unknown[][]; raw?: string };
}

/**
 * The Handle of a library document from its path: the catalogue node whose
 * `libraryId` is its slug says it (`library/9789241549912-eng/…` →
 * `10665/250796`); a slug that IS a Handle says it too
 * (`library/10665-117378/…` → `10665/117378`).
 */
export function handleOfLibraryPath(p: string | undefined, bySlug: ReadonlyMap<string, string> = new Map()): string | undefined {
  const slug = p ? /^library\/([^/]+)/.exec(p)?.[1] : undefined;
  if (!slug) return undefined;
  const known = bySlug.get(slug);
  if (known) return known;
  const m = /^(\d+)-(\d+)$/.exec(slug);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

/** Library slug → Handle, from the catalogue nodes that name both (`libraryId`, `handle`). */
export function libraryHandles(nodesDir: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!fs.existsSync(nodesDir)) return out;
  for (const f of fs.readdirSync(nodesDir).filter((n) => n.endsWith('.json')).sort()) {
    const n = JSON.parse(fs.readFileSync(path.join(nodesDir, f), 'utf8')) as { libraryId?: unknown; handle?: unknown };
    if (typeof n.libraryId === 'string' && typeof n.handle === 'string') out.set(n.libraryId, n.handle);
  }
  return out;
}

/**
 * The reference lists extracted from IRIS documents, as quads (owner,
 * 2026-11-15, card Q-BIBSCALE-1: "A. Oxigraph + sharded text index"):
 * - in the spine, the citation edges — the document `cito:cites` the
 *   reference, and the IRIS item the library holds a copy of, when the
 *   reference is one (`heldAt`);
 * - in the metadata graph and the citing document's community partition,
 *   what the reference says: `fabio:Work`, its title or its citation as
 *   printed (`dcterms:bibliographicCitation`), year, DOI and URL.
 */
export function referenceQuads(
  dir: string,
  handleToCommunity: Readonly<Record<string, string>>,
  bySlug: ReadonlyMap<string, string> = new Map(),
): { spine: string[]; byGraph: Record<string, string[]> } {
  const spine: string[] = [];
  const byGraph: Record<string, string[]> = {};
  if (!fs.existsSync(dir)) return { spine, byGraph };
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ReferenceFile;
    if (!r.id) continue;
    const doc = handleOfLibraryPath(r.derivedFrom, bySlug);
    const ref = `<${REFERENCE_BASE}${encodeURIComponent(r.id)}>`;
    if (doc) {
      spine.push(`<https://hdl.handle.net/${doc}> <${CITO_CITES}> ${ref} <${GRAPH_IRIS_SPINE}> .`);
      const held = handleOfLibraryPath(r.heldAt, bySlug);
      if (held) spine.push(`<https://hdl.handle.net/${doc}> <${CITO_CITES}> <https://hdl.handle.net/${held}> <${GRAPH_IRIS_SPINE}> .`);
    }
    const comm = doc ? handleToCommunity[doc] : undefined;
    const g = comm ? `${GRAPH_PREFIX_COMMUNITY}${comm}` : GRAPH_IRIS_METADATA;
    const triples = [`${ref} <${RDF_NS}type> <${FABIO_WORK}>`];
    if (r.title) triples.push(`${ref} <${DCTERMS_NS}title> ${JSON.stringify(r.title)}`);
    if (r.printed) triples.push(`${ref} <${DCTERMS_NS}bibliographicCitation> ${JSON.stringify(r.printed)}`);
    const year = r.issued?.['date-parts']?.[0]?.[0];
    if (typeof year === 'number') triples.push(`${ref} <${DCTERMS_NS}issued> "${year}"^^<http://www.w3.org/2001/XMLSchema#gYear>`);
    if (r.DOI) triples.push(`${ref} <${BIBO_DOI}> ${JSON.stringify(r.DOI)}`);
    // A URL is an IRI only when every character of it may stand in one unescaped; else it is kept as text.
    if (r.URL) triples.push(/^https?:\/\/[A-Za-z0-9\-._~:/?#@!$&'()*+,;=%]+$/.test(r.URL) ? `${ref} <${DCTERMS_NS}identifier> <${r.URL}>` : `${ref} <${DCTERMS_NS}identifier> ${JSON.stringify(r.URL)}`);
    // As the Dublin Core is: in the metadata graph, and in the community's partition.
    for (const gr of g === GRAPH_IRIS_METADATA ? [g] : [GRAPH_IRIS_METADATA, g]) (byGraph[gr] ??= []).push(...triples.map((t) => `${t} <${gr}> .`));
  }
  return { spine, byGraph };
}

/**
 * Append-Only Streaming Partition Writer (Zero-Accumulation Architecture)
 *
 * Writes N-Quads directly to disk partition streams as records are processed,
 * maintaining an O(1) memory footprint during corpus ingestion (300,000 items).
 */
export class StreamingPartitionWriter {
  private outDir: string;
  private openStreams: Map<string, fs.WriteStream> = new Map();

  constructor(outDir: string) {
    this.outDir = outDir;
    fs.mkdirSync(outDir, { recursive: true });
  }

  public append(partitionFile: string, quads: string[]): void {
    if (quads.length === 0) return;
    const filePath = path.join(this.outDir, partitionFile);
    fs.appendFileSync(filePath, quads.join('\n') + '\n', 'utf8');
  }

  public appendSingle(partitionFile: string, quad: string): void {
    const filePath = path.join(this.outDir, partitionFile);
    fs.appendFileSync(filePath, quad + '\n', 'utf8');
  }
}

/**
 * Upstream Extractor Skolemization Helper (Zero-Pass Minting)
 *
 * Mints a stable, deterministic, content-addressed URI for a Dublin Core entity
 * at the point of ingestion/extraction, preventing blank node generation.
 *
 * URI format: https://iris.who.int/entity/item/{handle_slug}#{property}_{index}
 */
export function mintSkolemUri(handleClean: string, property: string, index: number): string {
  const propClean = property.replace(/^.*[:#]/, '').replace(/[^a-zA-Z0-9]/g, '_');
  return `https://iris.who.int/entity/item/${handleClean}#${propClean}_${index}`;
}

/**
 * Solution A: Skolemization (Mint Deterministic, Content-Addressed URIs)
 *
 * Traverses JSON-LD objects before RDF conversion and assigns globally unique,
 * deterministic URIs to all anonymous compound nodes (creators, subjects, dates,
 * spatial, language, types) based on the parent item handle and property path.
 *
 * URI format: https://iris.who.int/entity/item/{handle_slug}#{property}_{index}
 */
export type JsonLdValue = string | number | boolean | null | JsonLdValue[] | { [key: string]: JsonLdValue };

export function skolemizeJsonLd(node: JsonLdValue, handleClean: string, prefix = 'entity'): JsonLdValue {
  if (Array.isArray(node)) {
    return node.map((item, idx) => {
      const rec = item as { [key: string]: JsonLdValue } | null;
      if (rec && typeof rec === 'object' && !rec['@id'] && !rec['@value']) {
        const mintedId = mintSkolemUri(handleClean, prefix, idx + 1);
        return skolemizeJsonLd(
          { '@id': mintedId, ...rec },
          handleClean,
          `${prefix}_${idx + 1}`
        );
      }
      return skolemizeJsonLd(item, handleClean, `${prefix}_${idx + 1}`);
    });
  } else if (node && typeof node === 'object') {
    const res: { [key: string]: JsonLdValue } = {};
    for (const [key, val] of Object.entries(node)) {
      if (key === '@context') {
        res[key] = val;
        continue;
      }
      const propClean = key.replace(/^.*[:#]/, '').replace(/[^a-zA-Z0-9]/g, '_');
      res[key] = skolemizeJsonLd(val, handleClean, propClean);
    }
    return res;
  }
  return node;
}

const SIMPLE_DC_ELEMENTS = new Set([
  'contributor', 'coverage', 'creator', 'date', 'description', 'format',
  'identifier', 'language', 'publisher', 'relation', 'rights', 'source',
  'subject', 'title', 'type',
]);

interface DctermsSpec {
  term: string;
  range: 'literal' | 'resource';
  ses?: string;
  ves?: string;
}

const DCTERMS_SPECS: Readonly<Record<string, DctermsSpec>> = {
  'dc.title': { term: 'title', range: 'literal' },
  'dc.title.alternative': { term: 'alternative', range: 'literal' },
  'dc.creator': { term: 'creator', range: 'resource' },
  'dc.contributor': { term: 'contributor', range: 'resource' },
  'dc.contributor.author': { term: 'creator', range: 'resource' },
  'dc.coverage': { term: 'coverage', range: 'resource' },
  'dc.coverage.spatial': { term: 'spatial', range: 'resource' },
  'dc.coverage.temporal': { term: 'temporal', range: 'resource' },
  'dc.date': { term: 'date', range: 'literal', ses: 'W3CDTF' },
  'dc.date.available': { term: 'available', range: 'literal', ses: 'W3CDTF' },
  'dc.date.created': { term: 'created', range: 'literal', ses: 'W3CDTF' },
  'dc.date.issued': { term: 'issued', range: 'literal', ses: 'W3CDTF' },
  'dc.description': { term: 'description', range: 'literal' },
  'dc.description.abstract': { term: 'abstract', range: 'literal' },
  'dc.description.tableofcontents': { term: 'tableOfContents', range: 'literal' },
  'dc.format': { term: 'format', range: 'resource' },
  'dc.format.extent': { term: 'extent', range: 'resource' },
  'dc.format.mimetype': { term: 'format', range: 'resource', ves: 'IMT' },
  'dc.identifier': { term: 'identifier', range: 'literal' },
  'dc.identifier.uri': { term: 'identifier', range: 'literal', ses: 'URI' },
  'dc.language': { term: 'language', range: 'resource' },
  'dc.language.iso': { term: 'language', range: 'resource', ses: 'RFC4646' },
  'dc.publisher': { term: 'publisher', range: 'resource' },
  'dc.relation': { term: 'relation', range: 'resource' },
  'dc.rights': { term: 'rights', range: 'resource' },
  'dc.source': { term: 'source', range: 'resource' },
  'dc.subject': { term: 'subject', range: 'resource' },
  'dc.subject.other': { term: 'subject', range: 'resource' },
  'dc.subject.mesh': { term: 'subject', range: 'resource', ves: 'MESH' },
  'dc.type': { term: 'type', range: 'resource' },
};

const W3CDTF = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;

function ntLiteral(value: string, ses: string | undefined, language?: string | null): string {
  const escaped = JSON.stringify(value);
  if (ses !== undefined && (ses !== 'W3CDTF' || W3CDTF.test(value))) {
    return `${escaped}^^<${DCTERMS_NS}${ses}>`;
  }
  if (language && typeof language === 'string' && language.trim() !== '') {
    const langTag = language.trim().replace(/_/g, '-').toLowerCase();
    if (/^[a-z0-9-]+$/.test(langTag)) return `${escaped}@${langTag}`;
  }
  return escaped;
}

interface DSpaceMetaValue {
  value?: string;
  language?: string | null;
  authority?: string | null;
}

/**
 * Convert a DSpace REST `metadata` map (`dc.*` → array of `{ value, language, authority }`)
 * into deterministic, Solution-A-skolemized N-Triples (without graph label).
 */
export function dspaceMetadataTriples(handle: string, metadata: Record<string, DSpaceMetaValue[]>): string[] {
  const handleUri = `<https://hdl.handle.net/${handle}>`;
  const handleClean = handle.replace(/[^a-zA-Z0-9]/g, '_');
  const grouped = new Map<string, { predIri: string; propClean: string; spec: DctermsSpec | undefined; values: DSpaceMetaValue[] }>();

  for (const field of Object.keys(metadata).sort()) {
    const rawVals = metadata[field];
    if (!Array.isArray(rawVals) || rawVals.length === 0) continue;
    const spec = DCTERMS_SPECS[field];
    let predIri: string;
    let propClean: string;
    if (spec) {
      predIri = `${DCTERMS_NS}${spec.term}`;
      propClean = spec.term.replace(/[^a-zA-Z0-9]/g, '_');
    } else {
      const parts = field.split('.');
      if (parts.length === 2 && parts[0] === 'dc' && SIMPLE_DC_ELEMENTS.has(parts[1])) {
        predIri = `${DC_ELEMENTS_NS}${parts[1]}`;
        propClean = parts[1].replace(/[^a-zA-Z0-9]/g, '_');
      } else {
        predIri = `${DSPACE_CORE_NS}${field}`;
        propClean = field.replace(/[^a-zA-Z0-9]/g, '_');
      }
    }
    const existing = grouped.get(predIri);
    if (existing) {
      existing.values.push(...rawVals);
    } else {
      grouped.set(predIri, { predIri, propClean, spec, values: [...rawVals] });
    }
  }

  const triples: string[] = [];
  for (const { predIri, propClean, spec, values } of grouped.values()) {
    let idx = 0;
    for (const v of values) {
      if (typeof v?.value !== 'string') continue;
      idx++;
      const lit = ntLiteral(v.value, spec?.ses, v.language);
      const hasAuthority = typeof v.authority === 'string' && v.authority.trim() !== '';
      const isResource = spec?.range === 'resource' || hasAuthority;
      if (!isResource) {
        triples.push(`${handleUri} <${predIri}> ${lit}`);
      } else {
        const entityUri = `<${mintSkolemUri(handleClean, propClean, idx)}>`;
        triples.push(`${handleUri} <${predIri}> ${entityUri}`);
        triples.push(`${entityUri} <${RDF_NS}value> ${lit}`);
        if (spec?.ves) {
          triples.push(`${entityUri} <${DCAM_NS}memberOf> <${DCTERMS_NS}${spec.ves}>`);
        }
        if (hasAuthority) {
          const auth = v.authority!.trim();
          const authUri = /^https?:\/\//.test(auth) ? `<${auth}>` : `<https://hdl.handle.net/${auth}>`;
          triples.push(`${entityUri} <${DSPACE_CORE_NS}authority> ${authUri}`);
        }
      }
    }
  }
  return triples;
}

function walkJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

interface ExportedContainerRef {
  uuid?: string;
  handle?: string | null;
  name?: string;
}

interface ExportedBitstream {
  uuid?: string;
  name: string;
  bundle?: string;
  sizeBytes?: number;
  bytes?: number;
  mediaType?: string;
  sha256?: string;
  checkSum?: { checkSumAlgorithm?: string; value?: string };
  copyrightGate?: string;
}

interface ExportedRecord {
  uuid?: string;
  handle?: string | null;
  name?: string;
  type?: string;
  withdrawn?: boolean;
  lastModified?: string;
  metadata?: Record<string, DSpaceMetaValue[]>;
  parentCommunity?: ExportedContainerRef | null;
  owningCollection?: ExportedContainerRef | null;
  inCommunity?: string;
  inCollection?: string;
  bitstreams?: ExportedBitstream[];
}

function titleOfRecord(rec: ExportedRecord, fallback: string): string {
  const dcTitle = rec.metadata?.['dc.title']?.[0]?.value;
  if (typeof dcTitle === 'string' && dcTitle.trim() !== '') return dcTitle;
  if (typeof rec.name === 'string' && rec.name.trim() !== '') return rec.name;
  return fallback;
}

function sortedUnique(lines: readonly string[]): string[] {
  return [...new Set(lines)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function buildIrisDataset(outDir: string = DIST_DIR, opts: BuildIrisOptions = {}): Promise<BuildResult> {
  fs.mkdirSync(outDir, { recursive: true });

  const spineQuadsRaw: string[] = [];
  const subgraphQuads: Record<string, string[]> = {
    [GRAPH_IRIS_SPINE]: spineQuadsRaw,
    [GRAPH_IRIS_CATALOGUE]: [],
    [GRAPH_IRIS_METADATA]: [],
  };

  const communityMetadata: Record<string, { id: string; name: string; itemCount: number }> = {};
  const handleToCommunity: Record<string, string> = {};
  let totalItemsCount = 0;
  let skolemizedCount = 0;
  let maxLastModified = '';

  if (opts.recordsDir) {
    // Build over the exported DSpace records (`records/` in the CDN release).
    const commFiles = walkJsonFiles(path.join(opts.recordsDir, 'communities'));
    const collFiles = walkJsonFiles(path.join(opts.recordsDir, 'collections'));
    const allFiles = walkJsonFiles(opts.recordsDir);
    const containerSet = new Set([...commFiles, ...collFiles]);
    const itemFiles = allFiles.filter(f => !containerSet.has(f));

    const commByHandleOrUuid = new Map<string, { id: string; name: string; parentId?: string }>();
    for (const f of commFiles) {
      const rec = JSON.parse(fs.readFileSync(f, 'utf8')) as ExportedRecord;
      const commId = rec.uuid || rec.handle || path.basename(f, '.json');
      const title = titleOfRecord(rec, commId);
      const parentId = rec.parentCommunity?.uuid || rec.parentCommunity?.handle || undefined;
      commByHandleOrUuid.set(commId, { id: commId, name: title, parentId });
      if (rec.uuid) commByHandleOrUuid.set(rec.uuid, { id: commId, name: title, parentId });
      if (rec.handle) commByHandleOrUuid.set(rec.handle, { id: commId, name: title, parentId });

      communityMetadata[commId] = { id: commId, name: title, itemCount: 0 };
      const commUri = `<https://iris.who.int/community/${commId}>`;
      const commQuads = [
        `${commUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://iris.who.int/ns/dspace#Community>`,
        `${commUri} <http://www.w3.org/2000/01/rdf-schema#label> ${JSON.stringify(title)}`,
        `${commUri} <https://iris.who.int/ns/dspace#communityId> ${JSON.stringify(`community/${commId}`)}`
      ];
      for (const q of commQuads) {
        subgraphQuads[GRAPH_IRIS_CATALOGUE].push(`${q} <${GRAPH_IRIS_CATALOGUE}> .`);
        spineQuadsRaw.push(`${q} <${GRAPH_IRIS_SPINE}> .`);
      }
    }

    const rootCommunityId = (key: string | undefined): string | undefined => {
      let cur = key ? commByHandleOrUuid.get(key)?.id ?? key : undefined;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        const parent = commByHandleOrUuid.get(cur)?.parentId;
        if (!parent) break;
        cur = commByHandleOrUuid.get(parent)?.id ?? parent;
      }
      return cur;
    };

    const collToComm = new Map<string, string>();
    const collIdByKey = new Map<string, string>();
    for (const f of collFiles) {
      const rec = JSON.parse(fs.readFileSync(f, 'utf8')) as ExportedRecord;
      const collId = rec.uuid || rec.handle || path.basename(f, '.json');
      const title = titleOfRecord(rec, collId);
      collIdByKey.set(collId, collId);
      if (rec.uuid) collIdByKey.set(rec.uuid, collId);
      if (rec.handle) collIdByKey.set(rec.handle, collId);

      const parentKey = rec.parentCommunity?.uuid || rec.parentCommunity?.handle || undefined;
      const commId = rootCommunityId(parentKey);
      if (commId) {
        collToComm.set(collId, commId);
        if (rec.uuid) collToComm.set(rec.uuid, commId);
        if (rec.handle) collToComm.set(rec.handle, commId);
        if (!communityMetadata[commId]) {
          const commTitle = rec.parentCommunity?.name || commId;
          communityMetadata[commId] = { id: commId, name: commTitle, itemCount: 0 };
        }
      }

      const collUri = `<https://iris.who.int/collection/${collId}>`;
      const collQuads = [
        `${collUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://iris.who.int/ns/dspace#Collection>`,
        `${collUri} <http://www.w3.org/2000/01/rdf-schema#label> ${JSON.stringify(title)}`,
        `${collUri} <https://iris.who.int/ns/dspace#collectionId> ${JSON.stringify(`collection/${collId}`)}`
      ];
      if (commId) {
        collQuads.push(`${collUri} <https://iris.who.int/ns/dspace#parentCommunity> <https://iris.who.int/community/${commId}>`);
      }
      for (const q of collQuads) {
        subgraphQuads[GRAPH_IRIS_CATALOGUE].push(`${q} <${GRAPH_IRIS_CATALOGUE}> .`);
        spineQuadsRaw.push(`${q} <${GRAPH_IRIS_SPINE}> .`);
      }
    }

    for (const f of itemFiles) {
      const rec = JSON.parse(fs.readFileSync(f, 'utf8')) as ExportedRecord;
      const handle = rec.handle || (rec.uuid ? `uuid/${rec.uuid}` : undefined);
      if (!handle) continue;
      totalItemsCount++;
      if (typeof rec.lastModified === 'string' && rec.lastModified > maxLastModified) {
        maxLastModified = rec.lastModified;
      }

      const title = titleOfRecord(rec, handle);
      const handleUri = `<https://hdl.handle.net/${handle}>`;
      const itemQuads = [
        `${handleUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://iris.who.int/ns/dspace#Item>`,
        `${handleUri} <https://iris.who.int/ns/dspace#handle> ${JSON.stringify(handle)}`,
        `${handleUri} <http://purl.org/dc/terms/title> ${JSON.stringify(title)}`
      ];
      if (rec.withdrawn === true) {
        itemQuads.push(`${handleUri} <https://iris.who.int/ns/dspace#withdrawn> "true"^^<http://www.w3.org/2001/XMLSchema#boolean>`);
      }

      const rawCollKey = rec.owningCollection?.uuid || rec.owningCollection?.handle || rec.inCollection?.replace(/^collection\//, '');
      const collId = rawCollKey ? (collIdByKey.get(rawCollKey) ?? rawCollKey) : undefined;
      if (collId) {
        itemQuads.push(`${handleUri} <https://iris.who.int/ns/dspace#inCollection> <https://iris.who.int/collection/${collId}>`);
      }

      const explicitComm = rec.inCommunity?.replace(/^community\//, '');
      const commId = (explicitComm ? rootCommunityId(explicitComm) : undefined)
        ?? (rawCollKey ? collToComm.get(rawCollKey) : undefined)
        ?? (collId ? collToComm.get(collId) : undefined);

      if (commId) {
        itemQuads.push(`${handleUri} <https://iris.who.int/ns/dspace#inCommunity> <https://iris.who.int/community/${commId}>`);
        handleToCommunity[handle] = commId;
        if (!communityMetadata[commId]) {
          communityMetadata[commId] = { id: commId, name: commId, itemCount: 0 };
        }
        communityMetadata[commId].itemCount++;
      }

      if (Array.isArray(rec.bitstreams)) {
        for (const b of rec.bitstreams) {
          if (b.bundle && b.bundle !== 'ORIGINAL') continue;
          const bsId = b.sha256 || b.checkSum?.value || b.uuid || b.name;
          const bsUri = `<https://iris.who.int/bitstream/${bsId}>`;
          const mediaType = b.mediaType || (b.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
          const bytes = b.sizeBytes ?? b.bytes ?? 0;
          itemQuads.push(
            `${handleUri} <https://iris.who.int/ns/dspace#hasBitstream> ${bsUri}`,
            `${bsUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://iris.who.int/ns/dspace#Bitstream>`,
            `${bsUri} <https://iris.who.int/ns/dspace#fileName> ${JSON.stringify(b.name)}`,
            `${bsUri} <https://iris.who.int/ns/dspace#mediaType> ${JSON.stringify(mediaType)}`,
            `${bsUri} <https://iris.who.int/ns/dspace#fileBytes> "${bytes}"^^<http://www.w3.org/2001/XMLSchema#integer>`
          );
          if (b.copyrightGate) {
            itemQuads.push(`${bsUri} <https://iris.who.int/ns/dspace#copyrightGate> ${JSON.stringify(b.copyrightGate)}`);
          }
        }
      }

      for (const q of itemQuads) {
        subgraphQuads[GRAPH_IRIS_CATALOGUE].push(`${q} <${GRAPH_IRIS_CATALOGUE}> .`);
        spineQuadsRaw.push(`${q} <${GRAPH_IRIS_SPINE}> .`);
      }

      const md = rec.metadata ?? {};
      const creator = md['dc.contributor.author']?.[0]?.value ?? md['dc.creator']?.[0]?.value;
      if (typeof creator === 'string' && creator.trim() !== '') {
        spineQuadsRaw.push(`${handleUri} <http://purl.org/dc/terms/creator> ${JSON.stringify(creator)} <${GRAPH_IRIS_SPINE}> .`);
      }
      const issued = md['dc.date.issued']?.[0]?.value;
      if (typeof issued === 'string' && issued.trim() !== '') {
        spineQuadsRaw.push(`${handleUri} <http://purl.org/dc/terms/issued> ${JSON.stringify(issued)} <${GRAPH_IRIS_SPINE}> .`);
      }

      const commGraph = commId ? `${GRAPH_PREFIX_COMMUNITY}${commId}` : GRAPH_IRIS_METADATA;
      if (!subgraphQuads[commGraph]) {
        subgraphQuads[commGraph] = [];
      }

      for (const triple of dspaceMetadataTriples(handle, md)) {
        subgraphQuads[GRAPH_IRIS_METADATA].push(`${triple} <${GRAPH_IRIS_METADATA}> .`);
        if (commGraph !== GRAPH_IRIS_METADATA) {
          subgraphQuads[commGraph].push(`${triple} <${commGraph}> .`);
        }
      }
    }
  } else {
    // 1. Process catalogue nodes
    const nodeFiles = fs.readdirSync(NODES_DIR).filter(f => f.endsWith('.json')).sort();
    for (const f of nodeFiles) {
      const node = JSON.parse(fs.readFileSync(path.join(NODES_DIR, f), 'utf8'));

      if (node.kind === 'container' && node.id.startsWith('community/')) {
        const commId = node.id.replace('community/', '');
        if (communityMetadata[commId]) {
          communityMetadata[commId].name = node.title;
        } else {
          communityMetadata[commId] = { id: commId, name: node.title, itemCount: 0 };
        }
        const commUri = `<https://iris.who.int/${node.id}>`;
        const commQuads = [
          `${commUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://iris.who.int/ns/dspace#Community>`,
          `${commUri} <http://www.w3.org/2000/01/rdf-schema#label> ${JSON.stringify(node.title)}`,
          `${commUri} <https://iris.who.int/ns/dspace#communityId> ${JSON.stringify(node.id)}`
        ];

        for (const q of commQuads) {
          subgraphQuads[GRAPH_IRIS_CATALOGUE].push(`${q} <${GRAPH_IRIS_CATALOGUE}> .`);
          spineQuadsRaw.push(`${q} <${GRAPH_IRIS_SPINE}> .`);
        }
      } else if (node.kind === 'container' && node.id.startsWith('collection/')) {
        const collUri = `<https://iris.who.int/${node.id}>`;
        const collQuads = [
          `${collUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://iris.who.int/ns/dspace#Collection>`,
          `${collUri} <http://www.w3.org/2000/01/rdf-schema#label> ${JSON.stringify(node.title)}`,
          `${collUri} <https://iris.who.int/ns/dspace#collectionId> ${JSON.stringify(node.id)}`
        ];

        if (node.parents && node.parents[0]) {
          const parentComm = node.parents[0].find((p: string) => p.startsWith('community/'));
          if (parentComm) {
            collQuads.push(`${collUri} <https://iris.who.int/ns/dspace#parentCommunity> <https://iris.who.int/${parentComm}>`);
          }
        }

        for (const q of collQuads) {
          subgraphQuads[GRAPH_IRIS_CATALOGUE].push(`${q} <${GRAPH_IRIS_CATALOGUE}> .`);
          spineQuadsRaw.push(`${q} <${GRAPH_IRIS_SPINE}> .`);
        }
      } else if (node.kind === 'item' && node.handle) {
        totalItemsCount++;
        const handleUri = `<https://hdl.handle.net/${node.handle}>`;
        const itemQuads = [
          `${handleUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://iris.who.int/ns/dspace#Item>`,
          `${handleUri} <https://iris.who.int/ns/dspace#handle> ${JSON.stringify(node.handle)}`,
          `${handleUri} <http://purl.org/dc/terms/title> ${JSON.stringify(node.title)}`
        ];

        if (node.parents && node.parents[0]) {
          for (const p of node.parents[0]) {
            if (p.startsWith('collection/')) {
              itemQuads.push(`${handleUri} <https://iris.who.int/ns/dspace#inCollection> <https://iris.who.int/${p}>`);
            }
            if (p.startsWith('community/')) {
              itemQuads.push(`${handleUri} <https://iris.who.int/ns/dspace#inCommunity> <https://iris.who.int/${p}>`);
              const cId = p.replace('community/', '');
              handleToCommunity[node.handle] = cId;
              if (!communityMetadata[cId]) {
                communityMetadata[cId] = { id: cId, name: cId, itemCount: 0 };
              }
              communityMetadata[cId].itemCount++;
            }
          }
        }

        if (Array.isArray(node.bitstreams)) {
          for (const b of node.bitstreams) {
            const bsId = b.fixity?.digest || b.name;
            const bsUri = `<https://iris.who.int/bitstream/${bsId}>`;
            itemQuads.push(
              `${handleUri} <https://iris.who.int/ns/dspace#hasBitstream> ${bsUri}`,
              `${bsUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://iris.who.int/ns/dspace#Bitstream>`,
              `${bsUri} <https://iris.who.int/ns/dspace#fileName> ${JSON.stringify(b.name)}`,
              `${bsUri} <https://iris.who.int/ns/dspace#mediaType> ${JSON.stringify(b.mediaType || 'application/octet-stream')}`,
              `${bsUri} <https://iris.who.int/ns/dspace#fileBytes> "${b.bytes}"^^<http://www.w3.org/2001/XMLSchema#integer>`
            );

            if (b.materialization?.gates?.copyright?.verdict) {
              itemQuads.push(`${bsUri} <https://iris.who.int/ns/dspace#copyrightGate> ${JSON.stringify(b.materialization.gates.copyright.verdict)}`);
            }
          }
        }

        for (const q of itemQuads) {
          subgraphQuads[GRAPH_IRIS_CATALOGUE].push(`${q} <${GRAPH_IRIS_CATALOGUE}> .`);
          spineQuadsRaw.push(`${q} <${GRAPH_IRIS_SPINE}> .`);
        }
      }
    }

    // 2. Process Dublin Core JSON-LD records with Solution A Skolemization
    type JsonLdModule = { toRDF(doc: unknown, opts: { format: string }): Promise<unknown> };
    const jsonldMod = (await import('jsonld' as string)) as JsonLdModule & { default?: JsonLdModule };
    const jsonld: JsonLdModule = jsonldMod.default ?? jsonldMod;
    const dcFiles = fs.readdirSync(DC_DIR).filter(f => f.endsWith('.dc.jsonld')).sort();
    for (const f of dcFiles) {
      const raw = JSON.parse(fs.readFileSync(path.join(DC_DIR, f), 'utf8'));
      const handle = raw['@id'] ? raw['@id'].replace('https://hdl.handle.net/', '') : '';
      const handleClean = handle.replace(/[^a-zA-Z0-9]/g, '_');
      const commId = handleToCommunity[handle];
      const commGraph = commId ? `${GRAPH_PREFIX_COMMUNITY}${commId}` : GRAPH_IRIS_METADATA;

      if (!subgraphQuads[commGraph]) {
        subgraphQuads[commGraph] = [];
      }

      // Extract primary creator & issued date for Tier 1 Spine
      const handleUri = `<https://hdl.handle.net/${handle}>`;
      if (Array.isArray(raw['dcterms:creator']) && raw['dcterms:creator'][0]?.value?.['@value']) {
        const cr = raw['dcterms:creator'][0].value['@value'];
        spineQuadsRaw.push(`${handleUri} <http://purl.org/dc/terms/creator> ${JSON.stringify(cr)} <${GRAPH_IRIS_SPINE}> .`);
      }
      if (Array.isArray(raw['dcterms:issued']) && raw['dcterms:issued'][0]?.['@value']) {
        const issued = raw['dcterms:issued'][0]['@value'];
        spineQuadsRaw.push(`${handleUri} <http://purl.org/dc/terms/issued> ${JSON.stringify(issued)} <${GRAPH_IRIS_SPINE}> .`);
      }

      // Solution A: Skolemize anonymous compound nodes before toRDF conversion
      const skolemized = skolemizeJsonLd(raw, handleClean);
      const nquadsText = (await jsonld.toRDF(skolemized, { format: 'application/n-quads' })) as string;
      const lines = nquadsText.split('\n').filter(Boolean);

      for (let line of lines) {
        if (/_:[a-zA-Z0-9_-]+/.test(line)) {
          skolemizedCount++;
          line = line.replace(/_:(b[0-9a-zA-Z_-]+)/g, `<https://iris.who.int/.well-known/genid/item_${handleClean}_$1>`);
        }

        const quadMetadata = line.replace(/\s*\.\s*$/, ` <${GRAPH_IRIS_METADATA}> .\n`);
        subgraphQuads[GRAPH_IRIS_METADATA].push(quadMetadata.trim());

        if (commGraph !== GRAPH_IRIS_METADATA) {
          const quadComm = line.replace(/\s*\.\s*$/, ` <${commGraph}> .\n`);
          subgraphQuads[commGraph].push(quadComm.trim());
        }
      }
    }
  }

  // The documents' reference lists: citation edges in the spine, the
  // references themselves beside their citing document's metadata.
  const refsDir = opts.referencesDir ?? (opts.recordsDir ? undefined : path.join(WHO_IRIS_ROOT, 'references'));
  if (refsDir) {
    const rq = referenceQuads(refsDir, handleToCommunity, opts.recordsDir ? new Map() : libraryHandles(NODES_DIR));
    spineQuadsRaw.push(...rq.spine);
    for (const [g, qs] of Object.entries(rq.byGraph)) (subgraphQuads[g] ??= []).push(...qs);
  }

  // Sort and deduplicate every subgraph's quads so unchanged partitions are byte-identical
  for (const k of Object.keys(subgraphQuads)) {
    subgraphQuads[k] = sortedUnique(subgraphQuads[k]);
  }
  const spineQuads = subgraphQuads[GRAPH_IRIS_SPINE];

  // Assemble full reference dataset (sorted)
  const allQuads: string[] = sortedUnique([
    ...subgraphQuads[GRAPH_IRIS_CATALOGUE],
    ...subgraphQuads[GRAPH_IRIS_METADATA],
  ]);

  // Assert Solution A: Zero Blank Nodes Invariant across all graphs
  const allCombined = [...allQuads, ...spineQuads];
  const residualBnodes = allCombined.filter(q => /(^|\s)_:[a-zA-Z0-9_-]+/.test(q));
  if (residualBnodes.length > 0) {
    throw new Error(`Skolemization check failed: ${residualBnodes.length} blank node(s) detected in dataset output.`);
  }

  const formatNq = (lines: readonly string[]): string => (lines.length > 0 ? lines.join('\n') + '\n' : '');

  // 1. Emit Full Combined Dataset
  const outNq = path.join(outDir, 'who-iris-dataset.nq');
  const allText = formatNq(allQuads);
  fs.writeFileSync(outNq, allText, 'utf8');
  const outGz = path.join(outDir, 'who-iris-dataset.nq.gz');
  fs.writeFileSync(outGz, zlib.gzipSync(Buffer.from(allText)));

  // 2. Emit Tier 1 Global Routing Spine
  const spineNq = path.join(outDir, 'who-iris-spine.nq');
  const spineText = formatNq(spineQuads);
  fs.writeFileSync(spineNq, spineText, 'utf8');
  const spineGz = path.join(outDir, 'who-iris-spine.nq.gz');
  fs.writeFileSync(spineGz, zlib.gzipSync(Buffer.from(spineText)));

  // 3. Emit Tier 2 Community Subgraphs (sorted by graph URI)
  const manifestPartitions: Record<string, SubgraphPartitionInfo> = {};
  for (const graphUri of Object.keys(subgraphQuads).sort()) {
    if (graphUri === GRAPH_IRIS_SPINE) continue;
    const qlines = subgraphQuads[graphUri];
    const safeName = graphUri.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const subNq = path.join(outDir, `${safeName}.nq`);
    const subText = formatNq(qlines);
    fs.writeFileSync(subNq, subText, 'utf8');
    fs.writeFileSync(`${subNq}.gz`, zlib.gzipSync(Buffer.from(subText)));

    if (graphUri.startsWith(GRAPH_PREFIX_COMMUNITY)) {
      const cId = graphUri.replace(GRAPH_PREFIX_COMMUNITY, '');
      const meta = communityMetadata[cId] || { id: cId, name: cId, itemCount: 0 };
      manifestPartitions[cId] = {
        id: cId,
        name: meta.name,
        iri: graphUri,
        fileNq: `${safeName}.nq`,
        fileGz: `${safeName}.nq.gz`,
        quadCount: qlines.length,
        itemCount: meta.itemCount,
      };
    }
  }

  const generatedAt = opts.generatedAt
    ?? (opts.recordsDir ? (maxLastModified || '1970-01-01T00:00:00.000Z') : '2026-10-31T00:05:35.763Z');

  // 4. Emit Subgraph Manifest
  const manifest: SubgraphManifest = {
    version: '1.0.0',
    generatedAt,
    tiers: {
      tier1_spine: {
        iri: GRAPH_IRIS_SPINE,
        fileNq: 'who-iris-spine.nq',
        fileGz: 'who-iris-spine.nq.gz',
        quadCount: spineQuads.length,
        itemCount: totalItemsCount,
        description: 'Global routing spine: hierarchy, item handles, title, creator, year, bitstream access clearance'
      },
      tier2_communities: {
        description: 'On-demand partitioned community subgraphs containing detailed Dublin Core metadata, MeSH authorities, abstracts, spatial tags',
        partitions: manifestPartitions
      }
    }
  };

  const manifestJsonPath = path.join(outDir, 'subgraph-manifest.json');
  fs.writeFileSync(manifestJsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  // 5. Emit Prepared Queries Catalog
  const queries = {
    "discoverySearch": {
      "description": "Cross-graph join: Match author/creator, MESH subject, year range, and open access bitstream across metadata and catalogue graphs",
      "sparql": `
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX dspace: <https://iris.who.int/ns/dspace#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT DISTINCT ?handle ?title ?creator ?issued ?commTitle ?pdfName ?copyright WHERE {
  GRAPH <https://iris.who.int/graph/metadata> {
    ?handle dcterms:title ?title ;
            dcterms:creator ?crNode .
    ?crNode rdf:value ?creator .
    OPTIONAL { ?handle dcterms:issued ?issued }
  }
  GRAPH <https://iris.who.int/graph/catalogue> {
    ?handle dspace:inCommunity ?comm ;
            dspace:hasBitstream ?bs .
    ?comm rdfs:label ?commTitle .
    ?bs dspace:fileName ?pdfName ;
        dspace:mediaType "application/pdf" .
    OPTIONAL { ?bs dspace:copyrightGate ?copyright }
  }
}
ORDER BY DESC(?issued)
      `.trim()
    },
    "tier1DiscoverySearch": {
      "description": "Fast Tier 1 search over global routing spine: matches title, creator, year, and open-access clearance",
      "sparql": `
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX dspace: <https://iris.who.int/ns/dspace#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?handle ?title ?creator ?issued ?commTitle ?pdfName ?copyright WHERE {
  GRAPH <https://iris.who.int/graph/spine> {
    ?handle a dspace:Item ;
            dcterms:title ?title ;
            dspace:inCommunity ?comm .
    ?comm rdfs:label ?commTitle .
    OPTIONAL { ?handle dcterms:creator ?creator }
    OPTIONAL { ?handle dcterms:issued ?issued }
    OPTIONAL {
      ?handle dspace:hasBitstream ?bs .
      ?bs dspace:fileName ?pdfName ;
          dspace:mediaType "application/pdf" .
      OPTIONAL { ?bs dspace:copyrightGate ?copyright }
    }
  }
}
ORDER BY DESC(?issued)
      `.trim()
    },
    "tier2CommunitySearch": {
      "description": "Tier 2 cross-graph search combining global routing spine with mounted community detailed metadata (MeSH authorities, abstracts, spatial tags)",
      "sparql": `
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX dspace: <https://iris.who.int/ns/dspace#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT DISTINCT ?handle ?title ?creator ?subject ?issued ?commName ?pdfName ?copyright WHERE {
  GRAPH <https://iris.who.int/graph/spine> {
    ?handle a dspace:Item ;
            dcterms:title ?title ;
            dspace:inCommunity ?comm .
    ?comm rdfs:label ?commName .
    OPTIONAL {
      ?handle dspace:hasBitstream ?bs .
      ?bs dspace:fileName ?pdfName .
      OPTIONAL { ?bs dspace:copyrightGate ?copyright }
    }
  }
  GRAPH ?communityGraph {
    ?handle dcterms:subject ?sNode .
    ?sNode rdf:value ?subject .
    OPTIONAL {
      ?handle dcterms:creator ?crNode .
      ?crNode rdf:value ?creator .
    }
    OPTIONAL { ?handle dcterms:issued ?issued }
  }
  FILTER (STRSTARTS(STR(?communityGraph), "https://iris.who.int/graph/community/"))
}
ORDER BY DESC(?issued)
      `.trim()
    },
    "facetCounts": {
      "description": "Aggregate count of items grouped by community hierarchy and bitstream clearance",
      "sparql": `
PREFIX dspace: <https://iris.who.int/ns/dspace#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?communityName ?copyright (COUNT(DISTINCT ?handle) AS ?count) WHERE {
  GRAPH <https://iris.who.int/graph/spine> {
    ?handle a dspace:Item ;
            dspace:inCommunity ?comm .
    ?comm rdfs:label ?communityName .
    OPTIONAL {
      ?handle dspace:hasBitstream ?bs .
      OPTIONAL { ?bs dspace:copyrightGate ?copyright }
    }
  }
}
GROUP BY ?communityName ?copyright
ORDER BY ?communityName
      `.trim()
    }
  };

  const queriesJsonPath = path.join(outDir, 'queries.json');
  fs.writeFileSync(queriesJsonPath, JSON.stringify(queries, null, 2) + '\n', 'utf8');

  const subgraphCounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(subgraphQuads)) {
    subgraphCounts[k] = v.length;
  }

  return {
    totalQuads: allQuads.length,
    spineQuads: spineQuads.length,
    metadataQuads: subgraphQuads[GRAPH_IRIS_METADATA].length,
    catalogueQuads: subgraphQuads[GRAPH_IRIS_CATALOGUE].length,
    skolemizedCount,
    outputNqPath: outNq,
    outputGzPath: outGz,
    outputSpineNqPath: spineNq,
    outputSpineGzPath: spineGz,
    queriesJsonPath,
    manifestJsonPath,
    subgraphs: subgraphCounts,
    manifest,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const recIdx = args.indexOf('--records');
  const outIdx = args.indexOf('--out');
  const recordsDir = recIdx >= 0 ? path.resolve(args[recIdx + 1]) : undefined;
  const outDir = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : DIST_DIR;
  buildIrisDataset(outDir, { recordsDir }).then(res => {
    console.log(`✓ Built WHO-IRIS Oxigraph 2-Tier dataset:`);
    console.log(`  - Tier 1 Spine quads: ${res.spineQuads}`);
    console.log(`  - Tier 2 Metadata quads: ${res.metadataQuads}`);
    console.log(`  - Emitted Spine: ${res.outputSpineNqPath} (${fs.statSync(res.outputSpineNqPath).size} bytes)`);
    console.log(`  - Emitted Spine Gz: ${res.outputSpineGzPath} (${fs.statSync(res.outputSpineGzPath).size} bytes)`);
    console.log(`  - Subgraph Manifest: ${res.manifestJsonPath}`);
    console.log(`  - Partitions: ${Object.keys(res.manifest.tiers.tier2_communities.partitions).length} communities`);
  }).catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}
