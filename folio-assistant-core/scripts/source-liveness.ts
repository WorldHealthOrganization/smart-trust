#!/usr/bin/env bun
/**
 * Is each catalogue node's SOURCE still there — and does a snapshot of it exist?
 *
 * Usage: `bun run cat sources:liveness <instance-root>` (e.g. `who-iris`)
 *
 * Bean `08u4`, from the `v048` roast (objections 6 + 7) and the owner's
 * question *"what happens if data source goes away"*. Nothing read
 * `provenance.upstream` for liveness, and no snapshot pointer existed.
 *
 * ## Three states, and "could not determine" is never live
 *
 * - **live** — the resolvable IRI answered 2xx/3xx.
 * - **gone** — it answered 404 or 410: the source says the thing is not there.
 * - **could-not-determine** — anything else: a network error, a timeout, an
 *   egress proxy refusing the connection, a 401/403 (a refusal is not an
 *   absence), a 5xx. A blocked environment reports this for every node, and
 *   that is the honest answer there — never "live", never "gone".
 *
 * The IRI probed is {@link resolvableIri}: the Handle IRI first, because the
 * Handle is what outlives the host (`iris-dspace.md` R1).
 *
 * ## The snapshot half
 *
 * The Wayback Machine's availability API is asked for the same IRI. A snapshot
 * is `found` (with its URL and timestamp), `none`, or `could-not-determine`.
 * Nothing is written into the catalogue from here: a snapshot pointer is
 * recorded only when a person or a later step decides to, from a `found`
 * result, which is the catalogue's `sourceLoss` statement for referenced items.
 *
 * Exit: 0 when every node is live; 1 when any is gone; 2 when none is gone but
 * any could not be determined — an unverified run is not a clean one.
 *
 * @module folio-assistant-core/scripts/source-liveness
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { CatalogueNodeSchema, resolvableIri, type CatalogueNode } from "../schemas/catalogue.js";
import { assertHttpsHost, fetchChecked } from "./lib/safe-url.js";

/** Hosts that source-liveness and Wayback probes are permitted to contact (over https: only). */
export const ALLOWED_LIVENESS_HOSTS: ReadonlySet<string> = new Set([
  "hdl.handle.net",
  "iris.who.int",
  "iris.paho.org",
  "www.who.int",
  "cdn.who.int",
  "apps.who.int",
  "archive.org",
  "web.archive.org",
]);
const WAYBACK_HOSTS: ReadonlySet<string> = new Set(["archive.org", "web.archive.org"]);

export type Liveness = "live" | "gone" | "could-not-determine";
export type SnapshotState = "found" | "none" | "could-not-determine";

export interface NodeLiveness {
  id: string;
  kind: CatalogueNode["kind"];
  iri: string | undefined;
  viaHandle: boolean;
  liveness: Liveness;
  livenessBasis: string;
  snapshot: SnapshotState;
  snapshotUrl?: string;
  snapshotBasis: string;
}

/** The one network call, injectable so tests never touch the network. */
export type Fetcher = (url: string, init: { method: "HEAD" | "GET"; signal: AbortSignal }) => Promise<{ status: number; json?: () => Promise<unknown> }>;

/** Build a redirect-checking `Fetcher` that enforces `https:` and `allowedHosts` at every hop. */
export function createSafeFetcher(
  rawFetch: typeof fetch = fetch,
  allowedHosts: ReadonlySet<string> = ALLOWED_LIVENESS_HOSTS,
  maxRedirects = 5,
): Fetcher {
  return async (url, init) => {
    const { response } = await fetchChecked(url, allowedHosts, init, rawFetch, maxRedirects);
    return response;
  };
}

const realFetch: Fetcher = createSafeFetcher();

async function withTimeout<T>(ms: number, f: (s: AbortSignal) => Promise<T>): Promise<T> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await f(c.signal);
  } finally {
    clearTimeout(t);
  }
}

/** Classify one IRI. Every failure mode lands in could-not-determine. */
export async function probeLiveness(
  iri: string,
  fetcher: Fetcher = realFetch,
  timeoutMs = 8000,
  allowedHosts: ReadonlySet<string> = ALLOWED_LIVENESS_HOSTS,
): Promise<{ liveness: Liveness; basis: string }> {
  try {
    const checkedIri = assertHttpsHost(iri, allowedHosts).href;
    const r = await withTimeout(timeoutMs, (signal) => fetcher(checkedIri, { method: "HEAD", signal }));
    if (r.status >= 200 && r.status < 400) return { liveness: "live", basis: `HTTP ${r.status}` };
    if (r.status === 404 || r.status === 410) return { liveness: "gone", basis: `HTTP ${r.status}` };
    return { liveness: "could-not-determine", basis: `HTTP ${r.status} — neither present nor absent (a refusal or an error is not an answer)` };
  } catch (e) {
    return { liveness: "could-not-determine", basis: `no answer: ${(e as Error).message || String(e)}` };
  }
}

/** Ask the Wayback Machine whether a snapshot of `iri` exists. */
export async function probeSnapshot(
  iri: string,
  fetcher: Fetcher = realFetch,
  timeoutMs = 8000,
  allowedHosts: ReadonlySet<string> = ALLOWED_LIVENESS_HOSTS,
): Promise<{ snapshot: SnapshotState; url?: string; basis: string }> {
  try {
    const checkedIri = assertHttpsHost(iri, allowedHosts).href;
    const api = `https://archive.org/wayback/available?url=${encodeURIComponent(checkedIri)}`;
    const r = await withTimeout(timeoutMs, (signal) => fetcher(api, { method: "GET", signal }));
    if (r.status !== 200 || !r.json) return { snapshot: "could-not-determine", basis: `availability API answered HTTP ${r.status}` };
    const body = (await r.json()) as { archived_snapshots?: { closest?: { available?: boolean; url?: string; timestamp?: string } } };
    const c = body?.archived_snapshots?.closest;
    if (c?.available && c.url) {
      const checkedSnapshotUrl = assertHttpsHost(c.url, WAYBACK_HOSTS).href;
      return { snapshot: "found", url: checkedSnapshotUrl, basis: `closest snapshot ${c.timestamp ?? "(no timestamp)"}` };
    }
    if (body && typeof body === "object" && "archived_snapshots" in body) return { snapshot: "none", basis: "the availability API reports no snapshot" };
    return { snapshot: "could-not-determine", basis: "the availability API answered in an unexpected shape" };
  } catch (e) {
    return { snapshot: "could-not-determine", basis: `no answer: ${(e as Error).message || String(e)}` };
  }
}

/** Every node of `<instanceRoot>/catalogue/nodes`, validated. */
export function catalogueNodes(instanceRoot: string): CatalogueNode[] {
  const dir = join(resolve(instanceRoot), "catalogue", "nodes");
  if (!existsSync(dir)) throw new Error(`${dir} does not exist — no catalogue to check`);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => CatalogueNodeSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf-8"))));
}

export async function checkSourceLiveness(nodes: CatalogueNode[], fetcher: Fetcher = realFetch): Promise<NodeLiveness[]> {
  const out: NodeLiveness[] = [];
  for (const n of nodes) {
    const iri = resolvableIri(n);
    if (!iri) {
      out.push({
        id: n.id, kind: n.kind, iri, viaHandle: false,
        liveness: "could-not-determine", livenessBasis: "the node names no resolvable IRI",
        snapshot: "could-not-determine", snapshotBasis: "no IRI to ask about",
      });
      continue;
    }
    const [l, s] = await Promise.all([probeLiveness(iri, fetcher), probeSnapshot(iri, fetcher)]);
    out.push({
      id: n.id, kind: n.kind, iri, viaHandle: Boolean(n.handle),
      liveness: l.liveness, livenessBasis: l.basis,
      snapshot: s.snapshot, ...(s.url ? { snapshotUrl: s.url } : {}), snapshotBasis: s.basis,
    });
  }
  return out;
}

/** 0 all live · 1 any gone · 2 none gone but any undetermined. */
export function exitCodeFor(results: NodeLiveness[]): 0 | 1 | 2 {
  if (results.some((r) => r.liveness === "gone")) return 1;
  if (results.some((r) => r.liveness === "could-not-determine")) return 2;
  return 0;
}

if (import.meta.main) {
  const root = process.argv[2];
  if (!root) {
    console.error("usage: source-liveness.ts <instance-root>");
    process.exit(2);
  }
  const results = await checkSourceLiveness(catalogueNodes(root));
  for (const r of results) {
    const mark = r.liveness === "live" ? "✓" : r.liveness === "gone" ? "✗" : "?";
    console.log(`${mark} ${r.id} (${r.kind}) — ${r.liveness}: ${r.livenessBasis}`);
    console.log(`    ${r.iri ?? "(no IRI)"}${r.viaHandle ? "  [via Handle]" : ""}`);
    console.log(`    snapshot: ${r.snapshot}${r.snapshotUrl ? ` ${r.snapshotUrl}` : ""} — ${r.snapshotBasis}`);
  }
  const code = exitCodeFor(results);
  const count = (v: Liveness) => results.filter((r) => r.liveness === v).length;
  console.log(
    `\n${results.length} node(s): ${count("live")} live, ${count("gone")} gone, ${count("could-not-determine")} could not be determined.` +
      (code === 2 ? " NOT VERIFIED — an undetermined source is not a live one." : ""),
  );
  process.exit(code);
}
