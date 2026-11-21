#!/usr/bin/env bun
/**
 * Tool `openapi-ingest-rendered` (bean `folio-assistant-7jkp`): ingest each
 * document the layer's `cat-openapi.config.json` lists under `rendered` —
 * an already-PUBLISHED OpenAPI spec, by URL — verbatim, with a
 * `<id>.source.json` recording the URL and when it was fetched.
 *
 * The counterpart of `ingest-openapi.ts` (`openapi-ingest-source`), and a
 * separate tool on the owner's ruling: a URL and a repository are different
 * inputs that fail differently. A URL has no commit, so the sha256 in the
 * provenance is what pins the bytes; `ingest-openapi.ts --check` verifies
 * the committed copy against it, offline.
 *
 * Usage:
 *   bun run cat-harness-tools/openapi/scripts/ingest-openapi-rendered.ts --instance <instance-dir> [--only <id>]
 *
 * @module cat-harness-tools/openapi/scripts/ingest-openapi-rendered
 * @covers openapi
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { OpenApiRenderedProvenance } from "../schemas/openapi.ts";
import { localDirOf, openapiDir, provenanceForRendered, readConfig } from "./ingest-openapi.ts";

/** What fetching one URL yields: its bytes, or why there are none. */
export type Fetcher = (url: string) => Promise<{ ok: true; bytes: Buffer } | { ok: false; reason: string }>;

export const httpFetcher: Fetcher = async (url) => {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, redirect: "follow" });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    return { ok: true, bytes: Buffer.from(await res.arrayBuffer()) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
};

export type RenderedOutcome =
  | { id: string; state: "ingested"; provenance: OpenApiRenderedProvenance }
  | { id: string; state: "failed"; reason: string };

/**
 * Fetch, validate and write each rendered document. A document that cannot be
 * fetched, or is not an OpenAPI 3 document, is `failed` and NOTHING is written
 * for it — a held copy is never replaced by bytes that did not validate.
 */
export async function ingestRendered(
  root: string,
  opts: { only?: string; fetcher?: Fetcher; now?: () => Date } = {},
): Promise<RenderedOutcome[]> {
  const config = readConfig(root);
  const dir = openapiDir(root, config);
  const fetcher = opts.fetcher ?? httpFetcher;
  const now = opts.now ?? (() => new Date());
  const out: RenderedOutcome[] = [];
  for (const d of config.rendered) {
    if (opts.only && d.id !== opts.only) continue;
    const got = await fetcher(d.rendered.url);
    if (!got.ok) {
      out.push({ id: d.id, state: "failed", reason: `${d.rendered.url}: ${got.reason}` });
      continue;
    }
    let prov: OpenApiRenderedProvenance;
    try {
      prov = provenanceForRendered(d.id, got.bytes, { url: d.rendered.url, fetchedAt: now().toISOString() }, localDirOf(root, dir));
    } catch (e) {
      out.push({ id: d.id, state: "failed", reason: `${d.rendered.url}: not an OpenAPI 3 document (${e instanceof Error ? e.message.split("\n")[0] : String(e)})` });
      continue;
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, prov.file), got.bytes);
    writeFileSync(join(dir, `${d.id}.source.json`), `${JSON.stringify(prov, null, 2)}\n`);
    out.push({ id: d.id, state: "ingested", provenance: prov });
  }
  return out;
}

if (import.meta.main) {
  const argv = process.argv;
  const at = (n: string) => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
  const instance = at("instance");
  if (!instance) {
    console.error("usage: ingest-openapi-rendered.ts --instance <dir> [--only <id>]");
    process.exit(2);
  }
  const outcomes = await ingestRendered(resolve(instance), { only: at("only") });
  if (outcomes.length === 0) console.log(`${instance}: no rendered documents configured`);
  for (const o of outcomes) {
    if (o.state === "ingested") console.log(`${o.id}: ${o.provenance.title} ${o.provenance.version} — ${o.provenance.operations} operations, ${o.provenance.bytes} bytes from ${o.provenance.source.url}`);
    else console.error(`✗ ${o.id}: ${o.reason}`);
  }
  process.exit(outcomes.some((o) => o.state === "failed") ? 1 : 0);
}
