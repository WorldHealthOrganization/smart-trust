/**
 * Reading changes from the WHO IRIS DSpace 7 REST API (owner's choice,
 * 2026-10-30: "DSpace REST only").
 *
 * Confirmed against live `https://iris.who.int/server/api` (2026-10-31, #104):
 *  - `GET /server/api/discover/search` exposes only five `sortOptions` on the
 *    default configuration (`score`, `dc.title`, `dc.date.issued`,
 *    `dc.date.accessioned`, `dc.date.available`); `sort=lastModified,DESC`
 *    returns HTTP 422 (`Unprocessable Entity: Invalid search request`), and
 *    `configuration=workflow` returns HTTP 400 to unauthenticated callers.
 *  - Solr range query `query=lastModified:[<UTC-ISO-Z> TO *]` with
 *    `sort=dc.date.accessioned,DESC` returns HTTP 200 and filters strictly by
 *    `lastModified`. The lower bound MUST be normalised to UTC `Z`
 *    (`new Date(since).toISOString()`), because DSpace's `+00:00` suffix in
 *    `lastModified:[...+00:00 TO *]` returns `totalElements: 0` from Solr.
 *  - Collection-scoped Discovery `scope=<collectionUuid>&sort=dc.date.accessioned,DESC`
 *    returns HTTP 200 and drives the resumable `initial-load` batches.
 *  - `GET /server/api/core/items/{uuid}?embed=bundles/bitstreams&embed=owningCollection`
 *    embeds both `owningCollection` and the first page (20) of each bundle's
 *    bitstreams; bundles with `page.totalPages > 1` are paged via
 *    `GET /server/api/core/bundles/{bundleUuid}/bitstreams?page=N&size=100`.
 *
 * Endpoints:
 *  - GET {api}/discover/search/objects?dsoType=ITEM&query=lastModified:[{isoZ} TO *]&sort=dc.date.accessioned,DESC&page=&size=
 *  - GET {api}/discover/search/objects?dsoType=ITEM&sort=dc.date.accessioned,DESC&page=&size=
 *  - GET {api}/discover/search/objects?dsoType=ITEM&scope={collectionUuid}&sort=dc.date.accessioned,DESC&page=&size=
 *  - GET {api}/core/items/{uuid}?embed=bundles/bitstreams&embed=owningCollection
 *  - GET {api}/core/bundles/{uuid}/bitstreams?page=&size=
 *  - GET {api}/core/bitstreams/{uuid}/content
 */

import { createHash } from "node:crypto";

export const IRIS_API = "https://iris.who.int/server/api";

/** Keys sorted at every depth, so equal metadata always hashes the same. */
function sorted(v: unknown): unknown {
  return Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])])) : v;
}

/**
 * SHA-256 of an object's `metadata` block (the Dublin Core fields), canonical.
 * Metadata can change while the PDF does not (owner, 2026-10-30), and an edit
 * may not move `lastModified`; this is what the weekly check compares.
 */
export const metadataSha = (metadata: unknown): string =>
  createHash("sha256").update(JSON.stringify(sorted(metadata ?? {}))).digest("hex");

export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** One item as Discovery reports it. */
export interface ItemStub {
  uuid: string;
  handle: string | null;
  lastModified: string;
  withdrawn: boolean;
  /** `metadataSha` of the search result's metadata, when Discovery returned it. */
  metadataSha: string | null;
}

interface SearchPage {
  _embedded?: {
    searchResult?: {
      _embedded?: { objects?: { _embedded?: { indexableObject?: Partial<Omit<ItemStub, "metadataSha">> & { type?: string; metadata?: unknown } } }[] };
      page?: { number: number; totalPages: number; totalElements?: number; size?: number };
    };
  };
}

async function getJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json();
}

function stubsOf(page: SearchPage): { items: ItemStub[]; last: boolean; totalPages: number; totalElements: number } {
  const result = page._embedded?.searchResult;
  const objects = result?._embedded?.objects ?? [];
  const items: ItemStub[] = [];
  for (const o of objects) {
    const it = o._embedded?.indexableObject;
    if (!it?.uuid || !it.lastModified) throw new Error(`search result without uuid/lastModified: ${JSON.stringify(it)}`);
    items.push({ uuid: it.uuid, handle: it.handle ?? null, lastModified: it.lastModified, withdrawn: it.withdrawn === true, metadataSha: it.metadata === undefined ? null : metadataSha(it.metadata) });
  }
  const p = result?.page;
  const totalPages = p?.totalPages ?? (items.length > 0 ? 1 : 0);
  const totalElements = p?.totalElements ?? items.length;
  return { items, last: !p || p.number + 1 >= p.totalPages || items.length === 0, totalPages, totalElements };
}

const searchUrl = (api: string, page: number, size: number, extraQuery = ""): string =>
  `${api}/discover/search/objects?dsoType=ITEM${extraQuery}&sort=dc.date.accessioned,DESC&page=${page}&size=${size}`;

/**
 * Every item modified at or after `cursor` (ISO 8601). Inclusive on purpose:
 * an item modified in the same second as the last run is re-read rather than
 * missed, and re-reading an unchanged item writes the same bytes (no churn).
 *
 * Uses `query=lastModified:[<isoZ> TO *]&sort=dc.date.accessioned,DESC` because
 * live `iris.who.int` rejects `sort=lastModified,DESC` with HTTP 422 and
 * requires a `Z`-suffixed UTC timestamp in Solr range queries.
 * Returned oldest first, de-duplicated by uuid.
 */
export async function changedSince(fetcher: Fetcher, cursor: string, opts: { api?: string; size?: number; maxPages?: number } = {}): Promise<ItemStub[]> {
  const api = opts.api ?? IRIS_API;
  const size = opts.size ?? 100;
  const maxPages = opts.maxPages ?? 10_000;
  const since = Date.parse(cursor);
  if (Number.isNaN(since)) throw new Error(`cursor is not a date: ${cursor}`);
  const isoZ = new Date(since).toISOString();
  const rangeQuery = `&query=${encodeURIComponent(`lastModified:[${isoZ} TO *]`)}`;
  const byId = new Map<string, ItemStub>();
  for (let page = 0; page < maxPages; page++) {
    const { items, last } = stubsOf((await getJson(fetcher, searchUrl(api, page, size, rangeQuery))) as SearchPage);
    let reachedCursor = false;
    for (const it of items) {
      if (Date.parse(it.lastModified) < since) {
        reachedCursor = true;
        break;
      }
      if (!byId.has(it.uuid)) byId.set(it.uuid, it);
    }
    if (reachedCursor || last) {
      return [...byId.values()].sort((a, b) => Date.parse(a.lastModified) - Date.parse(b.lastModified) || (a.uuid < b.uuid ? -1 : 1));
    }
  }
  throw new Error(`changedSince: more than ${maxPages} pages; refusing to guess where the cursor is`);
}

/**
 * One page of items scoped to a collection (`scope=<collectionUuid>`), used by
 * `initial-load` both to discover `totalPages` when planning batches and to
 * harvest each batch page.
 */
export async function collectionItemsPage(
  fetcher: Fetcher,
  collectionUuid: string,
  page: number,
  size = 100,
  api = IRIS_API,
): Promise<{ items: ItemStub[]; totalPages: number; totalElements: number; last: boolean }> {
  const scopeQuery = `&scope=${encodeURIComponent(collectionUuid)}`;
  return stubsOf((await getJson(fetcher, searchUrl(api, page, size, scopeQuery))) as SearchPage);
}

/**
 * Every item Discovery lists, for the weekly reconciliation: uuid → the
 * hash of its metadata. The listing pages already carry each item's
 * metadata, so a metadata edit that did not move `lastModified` is caught
 * without fetching 274k items one by one.
 */
export async function allItems(fetcher: Fetcher, opts: { api?: string; size?: number; maxPages?: number } = {}): Promise<Map<string, string | null>> {
  const api = opts.api ?? IRIS_API;
  const size = opts.size ?? 100;
  const maxPages = opts.maxPages ?? 100_000;
  const out = new Map<string, string | null>();
  for (let page = 0; page < maxPages; page++) {
    const { items, last } = stubsOf((await getJson(fetcher, searchUrl(api, page, size))) as SearchPage);
    for (const it of items) out.set(it.uuid, it.metadataSha);
    if (last) return out;
  }
  throw new Error(`allItems: more than ${maxPages} pages`);
}

export async function allItemIds(fetcher: Fetcher, opts: { api?: string; size?: number; maxPages?: number } = {}): Promise<Set<string>> {
  return new Set((await allItems(fetcher, opts)).keys());
}

/**
 * Every community or collection. A renamed collection changes no item, so
 * these are re-read in full each night (IRIS has 68 communities and 720
 * collections as measured 2026-10-31); an unchanged one serialises to the same
 * bytes and is not rewritten. Requests `embed=parentCommunity` so the
 * collection → community hierarchy is preserved in the exported records.
 */
export async function allContainers(fetcher: Fetcher, kind: "communities" | "collections", opts: { api?: string; size?: number; maxPages?: number } = {}): Promise<Record<string, unknown>[]> {
  const api = opts.api ?? IRIS_API;
  const size = opts.size ?? 100;
  const maxPages = opts.maxPages ?? 1_000;
  const out: Record<string, unknown>[] = [];
  for (let page = 0; page < maxPages; page++) {
    const body = (await getJson(fetcher, `${api}/core/${kind}?page=${page}&size=${size}&embed=parentCommunity`)) as {
      _embedded?: Record<string, Record<string, unknown>[]>;
      page?: { number: number; totalPages: number };
    };
    const got = body._embedded?.[kind] ?? [];
    out.push(...got);
    const p = body.page;
    if (!p || p.number + 1 >= p.totalPages || got.length === 0) return out;
  }
  throw new Error(`allContainers(${kind}): more than ${maxPages} pages`);
}

/**
 * Ids the catalogue holds that IRIS no longer lists. These are NOT deleted
 * from the release: each is re-fetched by id, and only one IRIS confirms as
 * withdrawn (or that now answers 404/401) is marked so in its record. A
 * listing that came back short because of a paging fault must not look like
 * a mass withdrawal, so the caller refuses to act above `maxFraction`.
 */
export function withdrawnOrHidden(held: Iterable<string>, listed: ReadonlySet<string>, maxFraction = 0.01): string[] {
  const heldIds = [...held];
  const gone = heldIds.filter((id) => !listed.has(id)).sort();
  if (heldIds.length > 0 && gone.length / heldIds.length > maxFraction) {
    throw new Error(`${gone.length} of ${heldIds.length} held items are missing from the listing — above ${maxFraction * 100}%; treating the listing as faulty, not acting`);
  }
  return gone;
}

/** A bitstream as `core/items/{uuid}?embed=bundles/bitstreams` reports it. */
export interface BitstreamStub {
  uuid: string;
  name: string;
  bundle: string;
  sizeBytes: number;
  checkSum: { checkSumAlgorithm: string; value: string };
}

interface BundleResource {
  uuid?: string;
  name: string;
  _embedded?: {
    bitstreams?: {
      _embedded?: { bitstreams?: Omit<BitstreamStub, "bundle">[] };
      page?: { number: number; totalPages: number };
    };
  };
}

interface ItemWithBundles {
  _embedded?: { bundles?: { _embedded?: { bundles?: BundleResource[] } } };
}

export async function extractBitstreamsFromItem(fetcher: Fetcher, item: ItemWithBundles, api = IRIS_API): Promise<BitstreamStub[]> {
  const out: BitstreamStub[] = [];
  for (const b of item._embedded?.bundles?._embedded?.bundles ?? []) {
    for (const bs of b._embedded?.bitstreams?._embedded?.bitstreams ?? []) {
      out.push({ uuid: bs.uuid, name: bs.name, bundle: b.name, sizeBytes: bs.sizeBytes, checkSum: bs.checkSum });
    }
    const totalPages = b._embedded?.bitstreams?.page?.totalPages ?? 1;
    if (totalPages > 1 && b.uuid) {
      for (let p = 1; p < totalPages; p++) {
        const pageBody = (await getJson(fetcher, `${api}/core/bundles/${b.uuid}/bitstreams?page=${p}&size=100`)) as {
          _embedded?: { bitstreams?: Omit<BitstreamStub, "bundle">[] };
          page?: { number: number; totalPages: number };
        };
        const list = pageBody._embedded?.bitstreams ?? [];
        for (const bs of list) {
          out.push({ uuid: bs.uuid, name: bs.name, bundle: b.name, sizeBytes: bs.sizeBytes, checkSum: bs.checkSum });
        }
        if (!pageBody.page || pageBody.page.number + 1 >= pageBody.page.totalPages || list.length === 0) break;
      }
    }
  }
  return out.sort((a, b) => (a.uuid < b.uuid ? -1 : 1));
}

export async function itemBitstreams(fetcher: Fetcher, uuid: string, api = IRIS_API): Promise<BitstreamStub[]> {
  const item = (await getJson(fetcher, `${api}/core/items/${uuid}?embed=bundles/bitstreams`)) as ItemWithBundles;
  return extractBitstreamsFromItem(fetcher, item, api);
}

export const bitstreamContentUrl = (uuid: string, api = IRIS_API): string => `${api}/core/bitstreams/${uuid}/content`;
