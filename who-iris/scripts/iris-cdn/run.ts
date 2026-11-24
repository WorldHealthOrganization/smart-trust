/**
 * The IRIS CDN Exporter's runner — what `.github/workflows/iris-cdn.yml`
 * calls. One mode per process in `processes/`:
 *
 *   bun scripts/iris-cdn/run.ts initial-load --release <dir> --budget <json-or-file>
 *   bun scripts/iris-cdn/run.ts nightly      --release <dir>
 *   bun scripts/iris-cdn/run.ts reconcile    --release <dir>
 *   bun scripts/iris-cdn/run.ts verify       --release <dir> [--revert-on-failure]
 *   bun scripts/iris-cdn/run.ts revert       --release <dir>
 *   bun scripts/iris-cdn/run.ts subset       [--handles <file>] [--query <q> --sample <n>] [--root .]   (who-iris#207, no bytes)
 *
 * `<dir>` is a checkout of the release-history git repository on Cloudflare
 * Artifacts. This script writes files into `<dir>` (or creates a `git revert`
 * commit in `revert` mode); the workflow commits and pushes.
 *
 * Bytes go to R2 under `sha256/<aa>/<digest>`, and only when that key is not
 * already there (the no-churn rule). The BagIt payload manifest maps each
 * logical path (`records/<handle>.json`, `bitstreams/<item>/<name>`,
 * `graph/<partition>`) to its digest, so the manifest in git is the index of
 * what R2 holds.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash, type webcrypto } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { S3Client } from "bun";
import { diffManifests, isEmptyDiff, itemManifest, itemManifestPath, parsePayloadManifest, sha256Hex, tagFiles, type PayloadEntry } from "./bag.ts";
import { didWebUrl, importPrivateJwk, signDetached, verifyDetached, type DidDocument } from "./signing.ts";
import {
  allContainers,
  allItems,
  bitstreamContentUrl,
  changedSince,
  collectionItemsPage,
  extractBitstreamsFromItem,
  IRIS_API,
  type BitstreamStub,
  metadataSha,
  withdrawnOrHidden,
  type Fetcher,
} from "./rest-feed.ts";
import { buildIrisDataset } from "../build-iris-oxigraph.ts";
import { CATALOGUE_NODE_SCHEMA_TAG, CatalogueNodeSchema, dspaceToRecord, type CatalogueNode } from "../../platform.ts";

const USER_AGENT = "who-iris-cdn-exporter (+https://github.com/litlfred/who-iris)";

/** Canonical JSON: keys sorted at every depth, two-space indent, LF, trailing newline. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(sort(value), null, 2) + "\n";
}

function containerRefOf(raw: unknown): { uuid?: string; handle?: string | null; name?: string } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const out: { uuid?: string; handle?: string | null; name?: string } = {};
  if (typeof obj.uuid === "string") out.uuid = obj.uuid;
  if (typeof obj.handle === "string" || obj.handle === null) out.handle = obj.handle as string | null;
  if (typeof obj.name === "string") out.name = obj.name;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * HAL `_links` carry request-specific URLs; they are not part of the record.
 * When `_embedded` carries `owningCollection` or `parentCommunity`, their
 * `{ uuid, handle, name }` identifier is lifted onto the record so the
 * Oxigraph graph builder can link items → collections → communities.
 */
export function recordOf(item: Record<string, unknown>): Record<string, unknown> {
  const { _links, _embedded, ...rest } = item;
  const out: Record<string, unknown> = { ...rest };
  if (_embedded && typeof _embedded === "object") {
    const emb = _embedded as Record<string, unknown>;
    const owning = containerRefOf(emb.owningCollection);
    if (owning && out.owningCollection === undefined) out.owningCollection = owning;
    const parent = containerRefOf(emb.parentCommunity);
    if (parent && out.parentCommunity === undefined) out.parentCommunity = parent;
  }
  return out;
}

const politeFetch: Fetcher = async (url) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if ((res.status === 429 || res.status === 503) && attempt < 5) {
      await Bun.sleep(2 ** attempt * 1000);
      continue;
    }
    return res;
  }
};

export interface Store {
  has(digest: string): Promise<boolean>;
  put(digest: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get?(digest: string): Promise<Uint8Array>;
}

const keyOf = (digest: string): string => `sha256/${digest.slice(0, 2)}/${digest}`;

function r2Store(): Store {
  const need = (k: string): string => {
    const v = process.env[k];
    if (!v) throw new Error(`${k} is not set`);
    return v;
  };
  const client = new S3Client({
    accessKeyId: need("R2_ACCESS_KEY_ID"),
    secretAccessKey: need("R2_SECRET_ACCESS_KEY"),
    endpoint: `https://${need("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    bucket: need("R2_BUCKET"),
  });
  return {
    has: (d) => client.file(keyOf(d)).exists(),
    put: async (d, bytes, type) => {
      await client.write(keyOf(d), bytes, { type });
    },
    get: async (d) => new Uint8Array(await client.file(keyOf(d)).arrayBuffer()),
  };
}

interface State {
  cursor: string;
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf-8")) as T) : fallback;
}

/** The payload manifest of the last published release, as entries. */
export function heldEntries(release: string): Map<string, PayloadEntry> {
  const out = new Map<string, PayloadEntry>();
  const sizes = readJson<Record<string, number>>(join(release, "state", "sizes.json"), {});
  const mf = join(release, "manifest-sha256.txt");
  if (!existsSync(mf)) return out;
  for (const [path, sha256] of parsePayloadManifest(readFileSync(mf, "utf-8"))) out.set(path, { path, sha256, bytes: sizes[path] ?? 0 });
  return out;
}

async function storeBytes(store: Store, bytes: Uint8Array, type: string, counts: { stored: number; skipped: number }): Promise<string> {
  const digest = sha256Hex(bytes);
  if (await store.has(digest)) counts.skipped++;
  else {
    await store.put(digest, bytes, type);
    counts.stored++;
  }
  return digest;
}

/*
 * IRIS values become path segments of the release (`records/<handle>.json`,
 * `bitstreams/<handle>/<bundle>/<name>`) and parts of API URLs. Each is
 * checked by value and refused, never repaired: a refused item or file is
 * listed in the report and left out of the release.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLE = /^[0-9]+\/[0-9]+$/;

/** A DSpace uuid, or the reason it is refused. */
export function uuidProblem(v: unknown): string | null {
  return typeof v === "string" && UUID.test(v) ? null : `not a uuid: ${JSON.stringify(v)}`;
}

/** A handle (`prefix/suffix`, digits only), or the reason it is refused. */
export function handleProblem(v: unknown): string | null {
  return typeof v === "string" && HANDLE.test(v) ? null : `not a handle: ${JSON.stringify(v)}`;
}

/** One path segment (a bundle or file name), or the reason it is refused. */
export function segmentProblem(v: unknown): string | null {
  if (typeof v !== "string" || v === "" || v === "." || v === "..") return `not a path segment: ${JSON.stringify(v)}`;
  if (/[\/\\\u0000-\u001f\u007f]/.test(v)) return `path segment holds a separator or control character: ${JSON.stringify(v)}`;
  return null;
}

/** The item's handle as a path, or `uuid/<uuid>` when IRIS gives none. Throws on a malformed value. */
export function itemKey(handle: unknown, uuid: unknown): string {
  if (handle !== undefined && handle !== null) {
    const p = handleProblem(handle);
    if (p) throw new Error(p);
    return handle as string;
  }
  const p = uuidProblem(uuid);
  if (p) throw new Error(p);
  return `uuid/${uuid as string}`;
}

export type BinaryFetcher = (url: string) => Promise<{ ok: boolean; status: number; headers?: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }>;

const defaultBinaryFetch: BinaryFetcher = (url) => fetch(url, { headers: { "User-Agent": USER_AGENT } });

async function ingestItem(
  uuid: string,
  entries: Map<string, PayloadEntry>,
  store: Store,
  report: Report,
  opts: { fetcher?: Fetcher; binaryFetcher?: BinaryFetcher; api?: string; recordCache?: Map<string, Uint8Array> } = {},
): Promise<void> {
  const fetcher = opts.fetcher ?? politeFetch;
  const binFetch = opts.binaryFetcher ?? defaultBinaryFetch;
  const api = opts.api ?? IRIS_API;

  const bad = uuidProblem(uuid);
  if (bad) {
    report.quarantined.push(`item ${bad}`);
    return;
  }
  const res = await fetcher(`${api}/core/items/${uuid}?embed=bundles/bitstreams&embed=owningCollection`);
  if (!res.ok) throw new Error(`item ${uuid}: HTTP ${res.status}`);
  const item = (await res.json()) as Record<string, unknown>;
  let handle: string;
  try {
    handle = itemKey(item.handle, uuid);
  } catch (e) {
    report.quarantined.push(`item ${uuid}: ${(e as Error).message}`);
    return;
  }

  const bitstreams = await extractBitstreamsFromItem(fetcher, item as Parameters<typeof extractBitstreamsFromItem>[1], api);
  const recObj = recordOf(item);
  if (bitstreams.length > 0 && recObj.bitstreams === undefined) {
    recObj.bitstreams = bitstreams;
  }

  const record = new TextEncoder().encode(canonicalJson(recObj));
  const path = `records/${handle}.json`;
  report.uuids[uuid] = path;
  report.touched.add(handle);
  report.metadataSha[uuid] = metadataSha(item.metadata);
  const recSha = await storeBytes(store, record, "application/json", report.objects);
  opts.recordCache?.set(recSha, record);
  entries.set(path, { path, sha256: recSha, bytes: record.byteLength });

  for (const bs of bitstreams) {
    const refused = segmentProblem(bs.bundle) ?? segmentProblem(bs.name) ?? uuidProblem(bs.uuid);
    if (refused) {
      report.quarantined.push(`item ${uuid} bitstream: ${refused}`);
      continue;
    }
    const bpath = `bitstreams/${handle}/${bs.bundle}/${bs.name}`;
    const held = entries.get(bpath);
    if (held && report.md5[bpath] === bs.checkSum.value) continue; // unchanged upstream: not fetched again
    const r = await binFetch(bitstreamContentUrl(bs.uuid, api));
    if (!r.ok) throw new Error(`bitstream ${bs.uuid}: HTTP ${r.status}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bs.checkSum.checkSumAlgorithm === "MD5" && createHash("md5").update(bytes).digest("hex") !== bs.checkSum.value) {
      report.quarantined.push(bpath);
      continue;
    }
    entries.set(bpath, { path: bpath, sha256: await storeBytes(store, bytes, r.headers?.get("content-type") ?? "application/octet-stream", report.objects), bytes: bytes.byteLength });
    report.md5[bpath] = bs.checkSum.value;
  }
}

/** Communities and collections, re-read in full; unchanged ones write nothing new. */
async function ingestContainers(
  entries: Map<string, PayloadEntry>,
  store: Store,
  report: Report,
  opts: { fetcher?: Fetcher; api?: string; recordCache?: Map<string, Uint8Array>; preloadedCollections?: Record<string, unknown>[] } = {},
): Promise<void> {
  const fetcher = opts.fetcher ?? politeFetch;
  const api = opts.api ?? IRIS_API;
  for (const kind of ["communities", "collections"] as const) {
    const list = kind === "collections" && opts.preloadedCollections
      ? opts.preloadedCollections
      : await allContainers(fetcher, kind, { api });
    for (const obj of list) {
      let handle: string;
      try {
        handle = itemKey(obj.handle, obj.uuid);
      } catch (e) {
        report.quarantined.push(`${kind}: ${(e as Error).message}`);
        continue;
      }
      const bytes = new TextEncoder().encode(canonicalJson(recordOf(obj)));
      const path = `records/${kind}/${handle}.json`;
      const digest = await storeBytes(store, bytes, "application/json", report.objects);
      opts.recordCache?.set(digest, bytes);
      if (entries.get(path)?.sha256 !== digest) report.containersChanged++;
      entries.set(path, { path, sha256: digest, bytes: bytes.byteLength });
    }
  }
}

/**
 * Call_Rebuild / Call_BuildGraph: rebuild the 2-Tier Oxigraph N-Quads dataset
 * over the exported records (`records/**.json`), with sorted deterministic
 * output so unchanged partitions keep their exact SHA-256 and are skipped by
 * `storeBytes`.
 */
export async function rebuildGraph(
  entries: Map<string, PayloadEntry>,
  store: Store,
  report: Report,
  recordCache: ReadonlyMap<string, Uint8Array> = new Map(),
): Promise<void> {
  const recordEntries = [...entries.values()].filter((e) => e.path.startsWith("records/") && e.path.endsWith(".json"));
  if (recordEntries.length === 0) return;

  const workDir = mkdtempSync(join(tmpdir(), "iris-cdn-graph-"));
  const recordsDir = join(workDir, "records");
  const outDir = join(workDir, "out");
  try {
    for (const e of recordEntries) {
      const rel = e.path.slice("records/".length);
      const bytes = recordCache.get(e.sha256) ?? (store.get ? await store.get(e.sha256) : undefined);
      if (!bytes) continue;
      const dest = join(recordsDir, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, bytes);
    }
    if (!existsSync(recordsDir)) return;
    await buildIrisDataset(outDir, { recordsDir });
    for (const fname of readdirSync(outDir).sort()) {
      const full = join(outDir, fname);
      const bytes = new Uint8Array(readFileSync(full));
      const gpath = `graph/${fname}`;
      const contentType = fname.endsWith(".json")
        ? "application/json"
        : fname.endsWith(".gz")
          ? "application/gzip"
          : "application/n-quads";
      const digest = await storeBytes(store, bytes, contentType, report.objects);
      if (entries.get(gpath)?.sha256 !== digest) report.graphPartitionsChanged++;
      entries.set(gpath, { path: gpath, sha256: digest, bytes: bytes.byteLength });
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

export interface Report {
  mode: string;
  changedItems: number;
  objects: { stored: number; skipped: number };
  quarantined: string[];
  withdrawn: string[];
  md5: Record<string, string>;
  /** item uuid → its record path; the weekly listing is by uuid. */
  uuids: Record<string, string>;
  /** item uuid → hash of its metadata as last ingested (the weekly check). */
  metadataSha: Record<string, string>;
  containersChanged: number;
  graphPartitionsChanged: number;
  /** handles of items ingested this run; only these can need a new item signature. */
  touched: Set<string>;
  itemsSigned: number;
  batchesCompleted?: number;
  batchesRemaining?: number;
}

/**
 * Task_StateBudget (`processes/iris-cdn-initial-load.bpmn`):
 * Scope, rate limit and upstream denominators. A budget with no denominator
 * is refused.
 */
export interface InitialLoadBudget {
  totalItemsUpstream: number;
  totalFilesUpstream: number;
  totalBytesUpstream: number;
  maxRequestsPerSecond: number;
  maxBatchesPerRun?: number;
  pageSize?: number;
}

export interface BatchSpec {
  id: string;
  collectionUuid: string;
  collectionKey: string;
  page: number;
  size: number;
  status: "pending" | "done";
  itemsIngested?: number;
}

export interface InitialLoadCheckpoint {
  budget: InitialLoadBudget;
  batches: BatchSpec[];
  cursor: string;
}

export function parseBudget(input: unknown): InitialLoadBudget {
  let obj: unknown = input;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) throw new Error("Task_StateBudget: --budget is empty");
    const text = existsSync(trimmed) ? readFileSync(trimmed, "utf-8") : trimmed;
    try {
      obj = JSON.parse(text);
    } catch {
      throw new Error(`Task_StateBudget: --budget is neither a readable JSON file nor valid JSON: ${trimmed}`);
    }
  }
  if (!obj || typeof obj !== "object") {
    throw new Error("Task_StateBudget: budget must be a JSON object stating upstream denominators and maxRequestsPerSecond");
  }
  const b = obj as Record<string, unknown>;
  const posNum = (k: string): number => {
    const v = b[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
      throw new Error(`Task_StateBudget: budget.${k} must be a positive number (a budget with no denominator is a preference, not a limit)`);
    }
    return v;
  };
  const totalItemsUpstream = posNum("totalItemsUpstream");
  const totalFilesUpstream = posNum("totalFilesUpstream");
  const totalBytesUpstream = posNum("totalBytesUpstream");
  const maxRequestsPerSecond = posNum("maxRequestsPerSecond");

  let maxBatchesPerRun: number | undefined;
  if (b.maxBatchesPerRun !== undefined) {
    if (typeof b.maxBatchesPerRun !== "number" || !Number.isInteger(b.maxBatchesPerRun) || b.maxBatchesPerRun < 1) {
      throw new Error("Task_StateBudget: budget.maxBatchesPerRun must be a positive integer");
    }
    maxBatchesPerRun = b.maxBatchesPerRun;
  }
  let pageSize = 100;
  if (b.pageSize !== undefined) {
    if (typeof b.pageSize !== "number" || !Number.isInteger(b.pageSize) || b.pageSize < 1) {
      throw new Error("Task_StateBudget: budget.pageSize must be a positive integer");
    }
    pageSize = b.pageSize;
  }
  return {
    totalItemsUpstream,
    totalFilesUpstream,
    totalBytesUpstream,
    maxRequestsPerSecond,
    ...(maxBatchesPerRun !== undefined ? { maxBatchesPerRun } : {}),
    pageSize,
  };
}

/**
 * Task_PlanBatches: one batch per collection, with large collections split by
 * page. Deterministic order by collection handle/uuid.
 */
export async function planInitialLoadBatches(
  fetcher: Fetcher,
  collections: readonly Record<string, unknown>[],
  budget: InitialLoadBudget,
  api = IRIS_API,
): Promise<BatchSpec[]> {
  const size = budget.pageSize ?? 100;
  const valid: { uuid: string; key: string }[] = [];
  for (const c of collections) {
    if (uuidProblem(c.uuid)) continue;
    try {
      valid.push({ uuid: c.uuid as string, key: itemKey(c.handle, c.uuid) });
    } catch {
      continue;
    }
  }
  valid.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const batches: BatchSpec[] = [];
  for (const c of valid) {
    const first = await collectionItemsPage(fetcher, c.uuid, 0, size, api);
    const pages = Math.max(1, first.totalPages);
    for (let page = 0; page < pages; page++) {
      batches.push({
        id: `${c.key}:p${page}`,
        collectionUuid: c.uuid,
        collectionKey: c.key,
        page,
        size,
        status: "pending",
      });
    }
  }
  return batches;
}

let signer: { key: webcrypto.CryptoKey; kid: string } | null = null;
async function getSigner(): Promise<{ key: webcrypto.CryptoKey; kid: string }> {
  if (signer) return signer;
  const did = process.env.IRIS_CDN_DID;
  const jwk = process.env.IRIS_CDN_SIGNING_JWK;
  if (!did || !jwk) throw new Error("IRIS_CDN_DID and IRIS_CDN_SIGNING_JWK must be set to sign");
  signer = { key: await importPrivateJwk(JSON.parse(jwk)), kid: `${did}#${process.env.IRIS_CDN_KEY_ID ?? "release-1"}` };
  return signer;
}

export function resetSignerForTest(): void {
  signer = null;
}

/**
 * A detached JWS on each touched library item's own manifest. An item whose
 * manifest bytes did not change keeps its existing signature: ES256 is
 * randomised, so re-signing would change bytes for nothing.
 */
async function signItems(entries: Map<string, PayloadEntry>, store: Store, report: Report): Promise<void> {
  for (const handle of [...report.touched].sort()) {
    const text = itemManifest(handle, entries.values());
    const mpath = itemManifestPath(handle);
    const bytes = new TextEncoder().encode(text);
    if (entries.get(mpath)?.sha256 === sha256Hex(bytes) && entries.has(`${mpath}.jws`)) continue;
    const { key, kid } = await getSigner();
    const jws = new TextEncoder().encode((await signDetached(text, key, kid)) + "\n");
    entries.set(mpath, { path: mpath, sha256: await storeBytes(store, bytes, "text/plain", report.objects), bytes: bytes.byteLength });
    entries.set(`${mpath}.jws`, { path: `${mpath}.jws`, sha256: await storeBytes(store, jws, "application/jose", report.objects), bytes: jws.byteLength });
    report.itemsSigned++;
  }
}

/** Sign changed items, write the bag, and sign the release only if the payload changed. */
export async function publish(release: string, previous: Map<string, PayloadEntry>, next: Map<string, PayloadEntry>, store: Store, report: Report): Promise<boolean> {
  await signItems(next, store, report);
  const prevMap = new Map([...previous].map(([p, e]) => [p, e.sha256]));
  const nextMap = new Map([...next].map(([p, e]) => [p, e.sha256]));
  const diff = diffManifests(prevMap, nextMap);
  console.log(JSON.stringify({ added: diff.added.length, changed: diff.changed.length, removed: diff.removed.length, unchanged: diff.unchanged }));
  if (isEmptyDiff(diff)) return false;
  const tags = tagFiles([...next.values()], { "Source-Organization": "WHO IRIS (ingested copy)", "External-Identifier": "https://iris.who.int" });
  for (const [name, text] of Object.entries(tags)) writeFileSync(join(release, name), text);
  const { key, kid } = await getSigner();
  writeFileSync(join(release, "tagmanifest-sha256.txt.jws"), (await signDetached(tags["tagmanifest-sha256.txt"], key, kid)) + "\n");
  mkdirSync(join(release, "state"), { recursive: true });
  writeFileSync(join(release, "state", "sizes.json"), canonicalJson(Object.fromEntries([...next].map(([p, e]) => [p, e.bytes]))));
  return true;
}

/**
 * Task_Revert (`processes/iris-cdn-sign-publish.bpmn`):
 * Revert `HEAD` in the release git repository so the previous verified release
 * remains the one served, and its cursor in `state/cursor.json` is restored.
 */
export function revertRelease(release: string, opts: { push?: boolean } = {}): { revertedCommit: string; headCommit: string; pushed: boolean } {
  const git = (...args: string[]): string =>
    execFileSync("git", ["-C", release, ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  let revertedCommit: string;
  try {
    revertedCommit = git("rev-parse", "HEAD");
    git("rev-parse", "--verify", "HEAD~1");
  } catch {
    throw new Error(`Task_Revert: ${release} has no parent commit (HEAD~1) to revert to`);
  }
  git(
    "-c", "user.name=who-iris CDN exporter",
    "-c", "user.email=iris-cdn@users.noreply.github.com",
    "revert", "--no-edit", "HEAD",
  );
  const headCommit = git("rev-parse", "HEAD");
  let pushed = false;
  if (opts.push !== false) {
    try {
      const remotes = git("remote");
      if (remotes.split(/\s+/).includes("origin")) {
        const env: NodeJS.ProcessEnv = { ...process.env };
        if (process.env.ARTIFACTS_TOKEN) {
          env.GIT_CONFIG_COUNT = "1";
          env.GIT_CONFIG_KEY_0 = "http.extraHeader";
          env.GIT_CONFIG_VALUE_0 = `Authorization: Bearer ${process.env.ARTIFACTS_TOKEN}`;
        }
        execFileSync("git", ["-C", release, "push", "origin", "HEAD"], { env, stdio: ["ignore", "pipe", "pipe"] });
        pushed = true;
      }
    } catch {
      pushed = false;
    }
  }
  return { revertedCommit, headCommit, pushed };
}

/**
 * Task_Verify: check the tag files against the tag manifest, then the
 * signature against the key resolved from did:web — never from the package.
 * Exits non-zero on `failed` and on `unknown`, so the workflow does not
 * treat an unverifiable release as published. When `revertOnFailure` is true,
 * runs `revertRelease(release)` before exiting non-zero.
 */
export async function checkRelease(
  release: string,
  opts: { did?: string; anchorJwk?: string; didDocFetcher?: (url: string) => Promise<DidDocument | null> } = {},
): Promise<{ state: "verified" | "failed" | "unknown"; reason?: string; kid?: string; chain?: string }> {
  const tmPath = join(release, "tagmanifest-sha256.txt");
  const jwsPath = join(release, "tagmanifest-sha256.txt.jws");
  if (!existsSync(tmPath) || !existsSync(jwsPath)) {
    return { state: "failed", reason: "tagmanifest-sha256.txt or tagmanifest-sha256.txt.jws is missing" };
  }
  const tm = readFileSync(tmPath, "utf-8");
  for (const [name, digest] of tm.split("\n").filter(Boolean).map((l) => l.split(/\s+/) as [string, string]).map(([d, n]) => [n, d])) {
    const p = join(release, name);
    if (!existsSync(p) || sha256Hex(readFileSync(p)) !== digest) {
      return { state: "failed", reason: `tag file ${name} does not match the tag manifest` };
    }
  }
  const jws = readFileSync(jwsPath, "utf-8").trim();
  const did = opts.did ?? process.env.IRIS_CDN_DID;
  const anchor = opts.anchorJwk ?? process.env.IRIS_CDN_TRUST_ANCHOR_JWK;
  if (!did || !anchor) {
    return { state: "unknown", reason: "IRIS_CDN_DID and IRIS_CDN_TRUST_ANCHOR_JWK must both be set to verify" };
  }
  let doc: DidDocument | null = null;
  try {
    if (opts.didDocFetcher) {
      doc = await opts.didDocFetcher(didWebUrl(did));
    } else {
      const res = await fetch(didWebUrl(did), { headers: { "User-Agent": USER_AGENT }, redirect: "error" });
      if (res.ok) doc = (await res.json()) as DidDocument;
    }
  } catch {
    doc = null;
  }
  if (doc && doc.id !== did) doc = null;
  return verifyDetached(tm, jws, doc, { anchors: [JSON.parse(anchor)], expectDid: did });
}

async function verify(release: string, noRevert = false): Promise<void> {
  const verdict = await checkRelease(release);
  console.log(JSON.stringify(verdict));
  if (verdict.state !== "verified") {
    if (!noRevert && existsSync(join(release, ".git"))) {
      try {
        const rev = revertRelease(release);
        console.log(JSON.stringify({ action: "reverted", ...rev }));
      } catch (e) {
        console.error(JSON.stringify({ action: "revert-failed", error: (e as Error).message }));
      }
    }
    process.exit(1);
  }
}

/**
 * Execute `initial-load` (`processes/iris-cdn-initial-load.bpmn`):
 * plans batches by collection, checkpoints after each batch in
 * `state/initial-load.json`, skips completed batches on restart, rebuilds the
 * Oxigraph graph, signs and publishes the release, and writes
 * `state/cursor.json` once all batches finish.
 */
export async function runInitialLoad(opts: {
  release: string;
  budget: InitialLoadBudget;
  fetcher?: Fetcher;
  binaryFetcher?: BinaryFetcher;
  store?: Store;
  api?: string;
}): Promise<Report> {
  const { release, budget } = opts;
  const fetcher = opts.fetcher ?? politeFetch;
  const binaryFetcher = opts.binaryFetcher ?? defaultBinaryFetch;
  const store = opts.store ?? r2Store();
  const api = opts.api ?? IRIS_API;

  const statePath = join(release, "state", "cursor.json");
  const checkpointPath = join(release, "state", "initial-load.json");
  const md5Path = join(release, "state", "md5.json");
  const uuidsPath = join(release, "state", "uuids.json");
  const metaPath = join(release, "state", "metadata-sha.json");

  const previous = heldEntries(release);
  const next = new Map(previous);
  const recordCache = new Map<string, Uint8Array>();
  const report: Report = {
    mode: "initial-load",
    changedItems: 0,
    objects: { stored: 0, skipped: 0 },
    quarantined: [],
    withdrawn: [],
    md5: readJson(md5Path, {}),
    uuids: readJson(uuidsPath, {}),
    metadataSha: readJson(metaPath, {}),
    containersChanged: 0,
    graphPartitionsChanged: 0,
    touched: new Set(),
    itemsSigned: 0,
    batchesCompleted: 0,
    batchesRemaining: 0,
  };

  const saveState = (cp: InitialLoadCheckpoint): void => {
    mkdirSync(join(release, "state"), { recursive: true });
    writeFileSync(md5Path, canonicalJson(report.md5));
    writeFileSync(uuidsPath, canonicalJson(report.uuids));
    writeFileSync(metaPath, canonicalJson(report.metadataSha));
    writeFileSync(checkpointPath, canonicalJson(cp));
  };

  let checkpoint: InitialLoadCheckpoint;
  let preloadedCollections: Record<string, unknown>[] | undefined;
  if (existsSync(checkpointPath)) {
    checkpoint = JSON.parse(readFileSync(checkpointPath, "utf-8")) as InitialLoadCheckpoint;
    checkpoint.budget = budget;
  } else {
    preloadedCollections = await allContainers(fetcher, "collections", { api });
    const batches = await planInitialLoadBatches(fetcher, preloadedCollections, budget, api);
    checkpoint = { budget, batches, cursor: "" };
    saveState(checkpoint);
  }

  await ingestContainers(next, store, report, { fetcher, api, recordCache, preloadedCollections });

  const minDelayMs = budget.maxRequestsPerSecond >= 1000 ? 0 : Math.floor(1000 / budget.maxRequestsPerSecond);
  const maxBatches = budget.maxBatchesPerRun ?? Number.POSITIVE_INFINITY;
  let processedThisRun = 0;

  for (const batch of checkpoint.batches) {
    if (batch.status === "done") continue;
    if (processedThisRun >= maxBatches) break;

    const page = await collectionItemsPage(fetcher, batch.collectionUuid, batch.page, batch.size, api);
    for (const it of page.items) {
      if (minDelayMs > 0) await Bun.sleep(minDelayMs);
      await ingestItem(it.uuid, next, store, report, { fetcher, binaryFetcher, api, recordCache });
      report.changedItems++;
      if (!checkpoint.cursor || Date.parse(it.lastModified) > Date.parse(checkpoint.cursor)) {
        checkpoint.cursor = it.lastModified;
      }
    }
    batch.status = "done";
    batch.itemsIngested = page.items.length;
    processedThisRun++;
    report.batchesCompleted = (report.batchesCompleted ?? 0) + 1;
    // Task_Checkpoint: persist after every batch so a stopped run resumes cleanly
    saveState(checkpoint);
  }

  report.batchesRemaining = checkpoint.batches.filter((b) => b.status === "pending").length;

  await rebuildGraph(next, store, report, recordCache);
  await publish(release, previous, next, store, report);
  saveState(checkpoint);

  if (report.batchesRemaining === 0 && checkpoint.cursor) {
    writeFileSync(statePath, canonicalJson({ cursor: checkpoint.cursor }));
  }
  return report;
}

// ---------------------------------------------------------------------------
// A SUBSET catalogued by reference (who-iris#207): mode `subset`.
//
//   bun scripts/iris-cdn/run.ts subset [--handles <file>] [--query <q> [--sample <n> --seed <s> | --limit <n>]] [--root .] [--dry-run]
//
// For each item: `catalogue/records/<key>.dc.json` (the record as DSpace
// returns it, via core's `dspaceToRecord`) and `catalogue/nodes/item-<key>.json`,
// state `referenced`, whose ORIGINAL bitstreams link to
// `https://iris.who.int/bitstreams/{uuid}/download`. No bytes are fetched.
// `<key>` is the Handle with `/` as `-` (rule R1). A handles file goes first
// (`<handle> <reason>`, `#` comments), then the Discovery query's matches.
// `IRIS_DSPACE_TOKEN`, when set, is sent as `Authorization: Bearer …`.
// It never touches a node it did not write: an item another node already
// carries is skipped and reported. Its own nodes carry OWN_NOTE_PREFIX and are
// rewritten only when what they say changed (the no-churn rule).
// ---------------------------------------------------------------------------

export const IRIS_ORIGIN = "https://iris.who.int";
export const OWN_NOTE_PREFIX = "Catalogued by reference by scripts/iris-cdn/run.ts subset";

type DspaceMetadata = Parameters<typeof dspaceToRecord>[1];

/** One item Discovery or the core API returned. */
export interface ItemResource {
  uuid: string;
  handle?: string | null;
  name?: string;
  withdrawn?: boolean;
  inArchive?: boolean;
  discoverable?: boolean;
  metadata: DspaceMetadata;
  _embedded?: Record<string, unknown>;
}

/** Why an item is in the subset: a cited Handle with its reason, or the query. */
export interface Pick {
  uuid?: string;
  handle?: string;
  reason: string;
}

/** `10665/360869` → `10665-360869`. Refuses anything that is not a Handle. */
export function keyOfHandle(handle: string): string {
  if (!/^\d+(?:\.\d+)*\/[A-Za-z0-9._-]+$/.test(handle)) throw new Error(`not a Handle: ${JSON.stringify(handle)}`);
  return handle.replace("/", "-");
}

/** Parse a handles file: `10665/123 reason words`, `#` comments, blank lines. */
export function parseHandles(text: string): Pick[] {
  const out: Pick[] = [];
  const seen = new Set<string>();
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [handle, ...rest] = line.split(/\s+/);
    keyOfHandle(handle!);
    if (seen.has(handle!)) continue;
    seen.add(handle!);
    out.push({ handle, reason: rest.join(" ") || "listed" });
  }
  return out;
}

/** A small seeded PRNG (mulberry32), so a sample is reproducible from its seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` distinct indices in [0, total), from the seed. */
export function sampleIndices(total: number, n: number, seed: number): number[] {
  const rnd = seededRandom(seed);
  const picked = new Set<number>();
  const want = Math.min(n, total);
  while (picked.size < want) picked.add(Math.floor(rnd() * total));
  return [...picked].sort((a, b) => a - b);
}

const first = (md: DspaceMetadata, field: string): string | undefined => md[field]?.find((v) => v.value?.trim())?.value;

const mediaTypeOf = (name: string): string | undefined =>
  /\.pdf$/i.test(name) ? "application/pdf" : /\.docx$/i.test(name) ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : undefined;

/**
 * A title as the catalogue shows it. Some IRIS records were loaded from Excel,
 * and carry its OOXML escape `_xHHHH_` for a control character, most often
 * `_x000D_` (a carriage return), verbatim in `dc.title`. Decode each escape,
 * then fold any line break (CR, LF or CRLF, with the spaces around it) into
 * one space, so a title stays on one line. The Dublin Core record keeps
 * IRIS's value as it is; only the node's display title is normalised.
 */
export function displayTitle(raw: string): string {
  return raw
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/[ \t]*(?:\r\n|\r|\n)[ \t]*/g, " ")
    .trim();
}

/** The node this tool writes for one item. Pure: the same inputs give the same node. */
export function nodeOf(item: ItemResource, bitstreams: BitstreamStub[], reasons: string[], key: string): CatalogueNode {
  const raw = first(item.metadata, "dc.title") ?? item.name;
  const title = raw === undefined ? undefined : displayTitle(raw);
  if (!title) throw new Error(`item ${item.uuid} has no dc.title`);
  if (!item.handle) throw new Error(`item ${item.uuid} has no Handle`);
  const owning = item._embedded?.owningCollection as { uuid?: string; name?: string } | undefined;
  const where = owning?.uuid ? ` IRIS files it in the collection "${owning.name ?? "?"}" (${owning.uuid}), which is not a node here, so parents is [] (rule R10).` : "";
  const originals = bitstreams.filter((b) => b.bundle === "ORIGINAL");
  return CatalogueNodeSchema.parse({
    $schema: CATALOGUE_NODE_SCHEMA_TAG,
    id: `item/${item.uuid}`,
    kind: "item",
    flavour: "item",
    title,
    parents: [],
    handle: item.handle,
    bitstreams: originals.map((b) => ({
      name: b.name,
      bundle: "ORIGINAL",
      bytes: b.sizeBytes,
      ...(mediaTypeOf(b.name) ? { mediaType: mediaTypeOf(b.name) } : {}),
      materialization: {
        state: "referenced",
        provenance: { upstream: `${IRIS_ORIGIN}/bitstreams/${b.uuid}/download` },
        note: `Bytes not held. IRIS reports ${b.checkSum?.checkSumAlgorithm ?? "no"} checksum ${b.checkSum?.value ?? "-"}; a sha256 is recorded only once the bytes are fetched (rule R13).`,
      },
    })),
    materialization: {
      state: "referenced",
      provenance: { upstream: `${IRIS_ORIGIN}/items/${item.uuid}` },
      note: `${OWN_NOTE_PREFIX} (who-iris#207): the Dublin Core record from the DSpace REST API and a link to each ORIGINAL file on IRIS; nothing ingested. In the subset because: ${reasons.join("; ")}.${where}`,
    },
    metadataRef: `catalogue/records/${key}.dc.json`,
  });
}

/** Canonical JSON with keys in the order given (2-space indent, LF, trailing newline). */
const pretty = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";

/** A record without its retrieval time, so a re-read of unchanged metadata compares equal. */
function recordBody(rec: Record<string, unknown>): string {
  const { provenance, ...rest } = rec as { provenance?: Record<string, unknown> };
  const { retrievedAt: _r, ...prov } = provenance ?? {};
  return JSON.stringify({ ...rest, provenance: prov });
}

/** Handles and UUIDs of nodes already in the catalogue, split into ours and others'. */
export function heldNodes(nodesDir: string): { others: Set<string>; ours: Set<string> } {
  const others = new Set<string>();
  const ours = new Set<string>();
  if (!existsSync(nodesDir)) return { others, ours };
  for (const f of readdirSync(nodesDir)) {
    if (!f.endsWith(".json")) continue;
    const n = JSON.parse(readFileSync(join(nodesDir, f), "utf-8")) as CatalogueNode;
    const mine = typeof n.materialization?.note === "string" && n.materialization.note.startsWith(OWN_NOTE_PREFIX);
    const set = mine ? ours : others;
    if (n.handle) set.add(n.handle);
    set.add(n.id.replace(/^item\//, ""));
  }
  return { others, ours };
}

export function subsetFetcher(opts: { token?: string; delayMs?: number } = {}): Fetcher & { requests: number } {
  const delay = opts.delayMs ?? 500;
  const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const f = (async (url: string) => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers, redirect: "manual" });
      f.requests++;
      await Bun.sleep(delay);
      if ((res.status === 429 || res.status === 503) && attempt < 5) {
        await Bun.sleep(2 ** attempt * 1000);
        continue;
      }
      return res;
    }
  }) as Fetcher & { requests: number };
  f.requests = 0;
  return f;
}

async function getJson<T>(fetcher: Fetcher, url: string): Promise<T> {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

type SearchBody = {
  _embedded?: { searchResult?: { page?: { totalElements?: number }; _embedded?: { objects?: { _embedded?: { indexableObject?: ItemResource } }[] } } };
};

const searchUrl = (api: string, query: string, page: number, size: number) =>
  `${api}/discover/search/objects?dsoType=ITEM&sort=dc.date.accessioned,DESC&size=${size}&page=${page}&query=${encodeURIComponent(query)}`;

/** How many items a Discovery query matches. */
export async function countMatches(fetcher: Fetcher, query: string, api = IRIS_API): Promise<number> {
  const body = await getJson<SearchBody>(fetcher, searchUrl(api, query, 0, 1));
  return body._embedded?.searchResult?.page?.totalElements ?? 0;
}

/** UUIDs of the query's matches: a seeded sample, the first `limit`, or all. */
export async function queryPicks(fetcher: Fetcher, query: string, opts: { sample?: number; seed?: number; limit?: number; api?: string }): Promise<Pick[]> {
  const api = opts.api ?? IRIS_API;
  const total = await countMatches(fetcher, query, api);
  const objectsOf = (b: SearchBody) => (b._embedded?.searchResult?._embedded?.objects ?? []).map((o) => o._embedded?.indexableObject).filter((x): x is ItemResource => !!x?.uuid);
  const reason = `matches the subset query (${total} matches)`;
  if (opts.sample !== undefined) {
    const out: Pick[] = [];
    for (const i of sampleIndices(total, opts.sample, opts.seed ?? 1)) {
      const [it] = objectsOf(await getJson<SearchBody>(fetcher, searchUrl(api, query, i, 1)));
      if (it) out.push({ uuid: it.uuid, reason: `${reason}, sampled with seed ${opts.seed ?? 1}` });
    }
    return out;
  }
  const want = Math.min(opts.limit ?? total, total);
  const out: Pick[] = [];
  for (let page = 0; out.length < want; page++) {
    const got = objectsOf(await getJson<SearchBody>(fetcher, searchUrl(api, query, page, 100)));
    if (got.length === 0) break;
    for (const it of got) if (out.length < want) out.push({ uuid: it.uuid, reason });
  }
  return out;
}

/** A Handle → the item's UUID, through DSpace's PID resolver (a redirect to `/core/items/{uuid}`). */
export async function uuidOfHandle(fetcher: Fetcher, handle: string, api = IRIS_API): Promise<string | undefined> {
  const res = (await fetcher(`${api}/pid/find?id=${encodeURIComponent(`hdl:${handle}`)}`)) as Awaited<ReturnType<Fetcher>> & { headers?: { get(n: string): string | null } };
  const loc = res.headers?.get("location") ?? "";
  return /\/core\/items\/([0-9a-f-]{36})$/.exec(loc)?.[1];
}

export interface SubsetReport {
  written: string[];
  unchanged: string[];
  skippedHeld: string[];
  unresolved: string[];
  refused: string[];
  requests?: number;
}

/** Catalogue each pick under `root`. Handles first, then query picks; duplicates merge their reasons. */
export async function catalogueSubset(
  fetcher: Fetcher,
  root: string,
  picks: Pick[],
  opts: { api?: string; now?: Date; dryRun?: boolean } = {},
): Promise<SubsetReport> {
  const api = opts.api ?? IRIS_API;
  const now = (opts.now ?? new Date()).toISOString().replace(/\.\d+Z$/, "Z");
  const nodesDir = join(root, "catalogue", "nodes");
  const recordsDir = join(root, "catalogue", "records");
  const report: SubsetReport = { written: [], unchanged: [], skippedHeld: [], unresolved: [], refused: [] };
  const { others } = heldNodes(nodesDir);

  // Resolve to UUIDs, merging reasons for an item picked more than once.
  const byUuid = new Map<string, string[]>();
  for (const p of picks) {
    if (p.handle && others.has(p.handle)) {
      report.skippedHeld.push(p.handle);
      continue;
    }
    const uuid = p.uuid ?? (p.handle ? await uuidOfHandle(fetcher, p.handle, api) : undefined);
    if (!uuid) {
      report.unresolved.push(p.handle ?? "?");
      continue;
    }
    byUuid.set(uuid, [...(byUuid.get(uuid) ?? []), p.reason]);
  }

  for (const [uuid, reasons] of byUuid) {
    if (others.has(uuid)) {
      report.skippedHeld.push(uuid);
      continue;
    }
    const item = await getJson<ItemResource>(fetcher, `${api}/core/items/${uuid}?embed=bundles/bitstreams&embed=owningCollection`);
    if (!item.handle || item.withdrawn || item.inArchive === false || item.discoverable === false) {
      report.refused.push(`${uuid}: ${!item.handle ? "no Handle" : "withdrawn or not public"}`);
      continue;
    }
    if (others.has(item.handle)) {
      report.skippedHeld.push(item.handle);
      continue;
    }
    const key = keyOfHandle(item.handle);
    const bitstreams = await extractBitstreamsFromItem(fetcher, item as Parameters<typeof extractBitstreamsFromItem>[1], api);
    const node = nodeOf(item, bitstreams, [...new Set(reasons)].sort(), key);
    const record = dspaceToRecord(uuid, item.metadata, `${api}/core/items/${uuid}`, now);

    const nodePath = join(nodesDir, `item-${key}.json`);
    const recordPath = join(recordsDir, `${key}.dc.json`);
    const nodeText = pretty(node);
    const sameNode = existsSync(nodePath) && readFileSync(nodePath, "utf-8") === nodeText;
    const sameRecord = existsSync(recordPath) && recordBody(JSON.parse(readFileSync(recordPath, "utf-8"))) === recordBody(record as Record<string, unknown>);
    if (sameNode && sameRecord) {
      report.unchanged.push(item.handle);
      continue;
    }
    if (!opts.dryRun) {
      mkdirSync(nodesDir, { recursive: true });
      mkdirSync(recordsDir, { recursive: true });
      if (!sameNode) writeFileSync(nodePath, nodeText);
      if (!sameRecord) writeFileSync(recordPath, pretty(record));
    }
    report.written.push(item.handle);
  }
  return report;
}


async function subsetMain(rest: string[]): Promise<void> {
  const arg = (name: string): string | undefined => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const root = arg("--root") ?? ".";
  const handlesFile = arg("--handles");
  const query = arg("--query");
  const sample = arg("--sample");
  const limit = arg("--limit");
  if (!handlesFile && !query) throw new Error("subset: give --handles <file>, --query <q>, or both");
  const fetcher = subsetFetcher({ token: process.env.IRIS_DSPACE_TOKEN || undefined, delayMs: Number(arg("--delay-ms") ?? 500) });
  const picks: Pick[] = handlesFile ? parseHandles(readFileSync(handlesFile, "utf-8")) : [];
  if (query) {
    picks.push(
      ...(await queryPicks(fetcher, query, {
        sample: sample === undefined ? undefined : Number(sample),
        seed: Number(arg("--seed") ?? 1),
        limit: limit === undefined ? undefined : Number(limit),
      })),
    );
  }
  const report = await catalogueSubset(fetcher, root, picks, { dryRun: rest.includes("--dry-run") });
  const counts = Object.fromEntries(Object.entries(report).map(([k, v]) => [k, (v as unknown[]).length]));
  console.log(canonicalJson({ mode: "subset", ...report, counts, requests: fetcher.requests }));
}

async function main(): Promise<void> {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "subset") return subsetMain(rest);
  const relIdx = rest.indexOf("--release");
  const release = relIdx >= 0 ? rest[relIdx + 1] : undefined;
  if (!release || !existsSync(release)) throw new Error("--release <checkout of the Cloudflare git repository> is required");
  if (mode === "verify") return verify(release, rest.includes("--no-revert"));
  if (mode === "revert") {
    const rev = revertRelease(release);
    console.log(canonicalJson({ mode: "revert", ...rev }));
    return;
  }
  if (mode === "initial-load") {
    const bIdx = rest.indexOf("--budget");
    const rawBudget = bIdx >= 0 ? rest[bIdx + 1] : process.env.IRIS_CDN_BUDGET;
    if (!rawBudget) {
      throw new Error("Task_StateBudget: initial-load requires --budget <json-or-file> (or IRIS_CDN_BUDGET)");
    }
    const budget = parseBudget(rawBudget);
    const report = await runInitialLoad({ release, budget });
    const { md5: _md5, uuids: _u, metadataSha: _m, touched: _t, ...summary } = report;
    console.log(canonicalJson(summary));
    return;
  }

  const statePath = join(release, "state", "cursor.json");
  const md5Path = join(release, "state", "md5.json");
  const uuidsPath = join(release, "state", "uuids.json");
  const withdrawnPath = join(release, "state", "withdrawn.json");
  const metaPath = join(release, "state", "metadata-sha.json");
  const store = r2Store();
  const previous = heldEntries(release);
  const next = new Map(previous);
  const recordCache = new Map<string, Uint8Array>();
  const report: Report = {
    mode,
    changedItems: 0,
    objects: { stored: 0, skipped: 0 },
    quarantined: [],
    withdrawn: [],
    md5: readJson(md5Path, {}),
    uuids: readJson(uuidsPath, {}),
    metadataSha: readJson(metaPath, {}),
    containersChanged: 0,
    graphPartitionsChanged: 0,
    touched: new Set(),
    itemsSigned: 0,
  };
  const saveState = (): void => {
    mkdirSync(join(release, "state"), { recursive: true });
    writeFileSync(md5Path, canonicalJson(report.md5));
    writeFileSync(uuidsPath, canonicalJson(report.uuids));
    writeFileSync(metaPath, canonicalJson(report.metadataSha));
  };

  if (mode === "nightly") {
    const state = readJson<State>(statePath, { cursor: "" });
    if (!state.cursor) throw new Error("no cursor: run the initial load first");
    const changed = await changedSince(politeFetch, state.cursor);
    report.changedItems = changed.length;
    for (const it of changed) await ingestItem(it.uuid, next, store, report, { recordCache });
    await ingestContainers(next, store, report, { recordCache });
    if (changed.length > 0 || report.containersChanged > 0) {
      await rebuildGraph(next, store, report, recordCache);
    }
    const changedAnything = await publish(release, previous, next, store, report);
    if (changed.length > 0) state.cursor = changed[changed.length - 1].lastModified;
    if (changedAnything || changed.length > 0) {
      saveState();
      writeFileSync(statePath, canonicalJson(state));
    }
  } else if (mode === "reconcile") {
    const listing = await allItems(politeFetch);
    const listed = new Set(listing.keys());
    // Throws above the 1% guard: a short listing is not a mass withdrawal.
    const missing = withdrawnOrHidden(Object.keys(report.uuids), listed);
    // Metadata edited without moving lastModified: re-ingest exactly those.
    for (const [uuid, sha] of listing) {
      if (sha !== null && report.uuids[uuid] && report.metadataSha[uuid] !== sha) await ingestItem(uuid, next, store, report, { recordCache });
    }
    await ingestContainers(next, store, report, { recordCache });
    const withdrawn = readJson<Record<string, string>>(withdrawnPath, {});
    for (const uuid of missing) {
      const res = await politeFetch(`${IRIS_API}/core/items/${uuid}`);
      if (res.status === 404 || res.status === 401 || res.status === 403) {
        withdrawn[uuid] = res.status === 404 ? "gone" : "private";
        report.withdrawn.push(uuid);
      } else if (res.ok) {
        await ingestItem(uuid, next, store, report, { recordCache }); // the record carries `withdrawn: true` itself
        if (((await res.json()) as { withdrawn?: boolean }).withdrawn) report.withdrawn.push(uuid);
      } else throw new Error(`re-check ${uuid}: HTTP ${res.status}`);
    }
    // Withdrawn items keep their record and bytes in the manifest: a citation may point at them.
    if (report.withdrawn.length > 0) writeFileSync(withdrawnPath, canonicalJson(withdrawn));
    if (report.touched.size > 0 || report.containersChanged > 0 || report.withdrawn.length > 0) {
      await rebuildGraph(next, store, report, recordCache);
    }
    if ((await publish(release, previous, next, store, report)) || report.withdrawn.length > 0) saveState();
  } else {
    throw new Error(`unknown mode ${mode}: expected initial-load, nightly, reconcile, verify, or revert`);
  }
  const { md5: _md5, uuids: _u, metadataSha: _m, touched: _t, ...summary } = report;
  console.log(canonicalJson(summary));
}

if (import.meta.main) await main();
