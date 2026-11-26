#!/usr/bin/env bun
/**
 * Measure the prefix-sharded identifier lookup at full WHO IRIS scale.
 *
 * @module cat-harness-tools/scripts/bench-id-lookup
 *
 * The method behind the recorded lookup measurements, so they can be
 * reproduced.
 *
 * ## The corpus is SYNTHETIC at scale, and says so
 *
 * IRIS is not reachable from here, so the run indexes the real referenced
 * IRIS nodes PLUS `--items` synthetic item nodes (default 273,559, the item
 * count IRIS's home page states):
 *
 * - the id is `item/<uuid>`, with a version-4 UUID from a seeded generator.
 *   DSpace 7 mints random v4 UUIDs, so uniform hex is the real distribution's
 *   shape, not an approximation of it;
 * - the url is `https://iris.who.int/items/<uuid>`, DSpace 7's item route;
 * - the title is a run of consecutive words cut from the real text of the
 *   three publications the IRIS replica holds, at a length drawn uniformly
 *   from 20 to `--title-max` characters (default 180, so a mean near 100) —
 *   longer than the real titles, so the index is not flattered. Bytes per
 *   entry are reported so another title length can be scaled linearly.
 *
 * Everything is seeded, so two runs build byte-identical indexes.
 *
 * ## What it reports
 *
 * Index bytes on disk (raw, and gzip since static hosts serve it gzipped),
 * shard count, shard size p50/p95/max, bytes fetched per lookup, build time,
 * and with `--browser` the lookup latency and JS heap in Chromium via
 * Playwright against a local static server, unthrottled and at a "slow 4G"
 * profile (150 ms RTT, 1.6 Mbit/s down).
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/bench-id-lookup.ts [--items N] [--title-max N] [--browser] [--lookups N] [--out DIR] [--json]
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

import { buildIdLookup, type IdEntry } from "../schemas/kg/id-lookup.js";
import { catalogueNodesDir, defaultSource, libraryDirOfSource, referencedEntries } from "./gen-id-lookup.js";

const INSTANCE = resolve(import.meta.dir, "..");

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

/** mulberry32: small, seeded, and good enough to spread UUID bits. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function uuidV4(r: () => number): string {
  const h = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16));
  h[12] = "4";
  h[16] = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/**
 * Real running text to draw titles from: the sections of the publications
 * the IRIS replica holds, found through its `library` declaration. Titles cut from
 * WHO's own prose carry WHO's vocabulary and its word frequencies, which a
 * made-up word list would not -- that does not matter to the lookup, whose
 * bytes depend only on length, but it decides how large an inverted index
 * built over the same titles would be.
 */
export function titleWords(): string[] {
  const libDir = libraryDirOfSource(defaultSource());
  const words: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) {
        for (const w of readFileSync(p, "utf8").replace(/[#*_`>[\]()|]/g, " ").split(/\s+/)) {
          if (/^[A-Za-z][A-Za-z'-]*[.,;:]?$/.test(w)) words.push(w);
        }
      }
    }
  };
  walk(libDir);
  if (words.length < 1000) throw new Error(`only ${words.length} words of title text found; titles drawn from that would not be representative`);
  return words;
}

/** The real referenced nodes plus `items` synthetic items. Deterministic for a given seed and word list. */
export function syntheticCorpus(real: IdEntry[], items: number, titleMax: number, words: string[], seed = 4): IdEntry[] {
  const r = rng(seed);
  const out = [...real];
  for (let i = 0; i < items; i++) {
    const u = uuidV4(r);
    const len = 20 + Math.floor(r() * (titleMax - 19));
    let at = Math.floor(r() * words.length);
    let t = "";
    while (t.length < len) t += (t ? " " : "") + words[at++ % words.length];
    out.push({ id: `item/${u}`, title: t.slice(0, len).trim(), url: `https://iris.who.int/items/${u}` });
  }
  return out;
}

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

export interface SizeReport {
  entries: number;
  meanTitleChars: number;
  buildMs: number;
  prefixLength: Record<string, number>;
  shardCount: number;
  totalBytes: number;
  totalGzipBytes: number;
  bytesPerEntry: number;
  manifestBytes: number;
  manifestGzipBytes: number;
  shardBytes: { p50: number; p95: number; max: number };
  shardGzipBytes: { p50: number; p95: number; max: number };
}

export function measure(entries: IdEntry[]): { report: SizeReport; files: Map<string, string> } {
  const t0 = performance.now();
  const { manifest, files } = buildIdLookup(entries, { source: `${defaultSource()}-synthetic`, selection: "bench-id-lookup.ts: synthetic, see its module comment" });
  const buildMs = performance.now() - t0;
  const raw: number[] = [];
  const gz: number[] = [];
  let total = 0;
  let totalGz = 0;
  let manifestBytes = 0;
  let manifestGzipBytes = 0;
  for (const [f, body] of files) {
    const b = Buffer.byteLength(body);
    const g = gzipSync(body, { level: 9 }).length;
    total += b;
    totalGz += g;
    if (f === "manifest.json") {
      manifestBytes = b;
      manifestGzipBytes = g;
    } else {
      raw.push(b);
      gz.push(g);
    }
  }
  raw.sort((a, b) => a - b);
  gz.sort((a, b) => a - b);
  return {
    files,
    report: {
      entries: entries.length,
      meanTitleChars: entries.reduce((s, e) => s + e.title.length, 0) / entries.length,
      buildMs,
      prefixLength: Object.fromEntries(Object.entries(manifest.namespaces).map(([k, v]) => [k, v.prefixLength])),
      shardCount: raw.length,
      totalBytes: total,
      totalGzipBytes: totalGz,
      bytesPerEntry: total / entries.length,
      manifestBytes,
      manifestGzipBytes,
      shardBytes: { p50: pct(raw, 50), p95: pct(raw, 95), max: raw[raw.length - 1]! },
      shardGzipBytes: { p50: pct(gz, 50), p95: pct(gz, 95), max: gz[gz.length - 1]! },
    },
  };
}

export interface BrowserReport {
  profile: string;
  openMs: number;
  lookupMs: { p50: number; p95: number; max: number };
  found: number;
  lookups: number;
  /** JS heap of the blank page before the lookup is loaded, so the two below can be read as deltas. */
  heapBaselineBytes: number;
  heapAfterOpenBytes: number;
  heapAfterLookupsBytes: number;
}

async function browserRun(dir: string, ids: string[]): Promise<BrowserReport[]> {
  const { chromium } = await import("playwright");
  const { resolveChromium } = await import("./playwright-chromium.js");
  const choice = resolveChromium(process.env as Record<string, string | undefined>);
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const p = decodeURIComponent(new URL(req.url).pathname);
      const f = Bun.file(join(dir, p.endsWith("/") ? p + "index.html" : p));
      return f.exists().then((ok) => (ok ? new Response(f) : new Response("not found", { status: 404 })));
    },
  });
  const browser = await chromium.launch({ executablePath: choice.path, args: ["--no-sandbox", "--enable-precise-memory-info"] });
  const out: BrowserReport[] = [];
  try {
    for (const profile of ["unthrottled", "slow-4g"] as const) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      if (profile === "slow-4g") {
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 150,
          downloadThroughput: (1.6 * 1024 * 1024) / 8,
          uploadThroughput: (750 * 1024) / 8,
        });
      }
      await cdp.send("Performance.enable");
      await page.goto(`http://127.0.0.1:${server.port}/blank.html`);
      const heap = async () => {
        await cdp.send("HeapProfiler.collectGarbage");
        const m = (await cdp.send("Performance.getMetrics")) as { metrics: Array<{ name: string; value: number }> };
        return m.metrics.find((x) => x.name === "JSHeapUsedSize")!.value;
      };
      const heapBaselineBytes = await heap();
      const openMs = await page.evaluate(async (spec: string) => {
        const t = performance.now();
        // A variable specifier: this runs in the page, and the module is the page's, not this script's.
        const mod = (await import(spec)) as typeof import("../id-lookup/lookup.js");
        (window as unknown as { __ix: unknown }).__ix = await mod.openIndex(new URL("/index/", location.href).href);
        return performance.now() - t;
      }, "/lookup.js");
      const heapAfterOpenBytes = await heap();
      const times = (await page.evaluate(async (list: string[]) => {
        const ix = (window as unknown as { __ix: { lookup(id: string): Promise<{ state: string }> } }).__ix;
        const res: Array<[number, boolean]> = [];
        for (const id of list) {
          const t = performance.now();
          const r = await ix.lookup(id);
          res.push([performance.now() - t, r.state === "found"]);
        }
        return res;
      }, ids)) as Array<[number, boolean]>;
      const heapAfterLookupsBytes = await heap();
      const ms = times.map((t) => t[0]).sort((a, b) => a - b);
      out.push({
        profile,
        openMs,
        lookupMs: { p50: pct(ms, 50), p95: pct(ms, 95), max: ms[ms.length - 1]! },
        found: times.filter((t) => t[1]).length,
        lookups: ids.length,
        heapBaselineBytes,
        heapAfterOpenBytes,
        heapAfterLookupsBytes,
      });
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.stop(true);
  }
  return out;
}

if (import.meta.main) {
  const items = Number(arg("items", "273559"));
  const titleMax = Number(arg("title-max", "180"));
  const lookups = Number(arg("lookups", "200"));
  const real = referencedEntries(catalogueNodesDir(defaultSource()));
  const entries = syntheticCorpus(real, items, titleMax, titleWords());
  const { report, files } = measure(entries);
  const result: { size: SizeReport; browser?: BrowserReport[] } = { size: report };

  const keep = process.argv.includes("--out");
  const dir = keep ? resolve(arg("out", "")) : mkdtempSync(join(tmpdir(), "id-lookup-bench-"));
  try {
    for (const [f, body] of files) {
      mkdirSync(dirname(join(dir, "index", f)), { recursive: true });
      writeFileSync(join(dir, "index", f), body);
    }
    writeFileSync(join(dir, "lookup.js"), readFileSync(join(INSTANCE, "id-lookup", "lookup.js")));
    writeFileSync(join(dir, "blank.html"), "<!doctype html><title>bench</title>");
    if (process.argv.includes("--browser")) {
      // Distinct shards where possible, so every lookup is a cold fetch rather than a cache hit.
      const r = rng(99);
      const pick = new Set<string>();
      const items = entries.filter((e) => e.id.startsWith("item/"));
      while (pick.size < Math.min(lookups, items.length)) pick.add(items[Math.floor(r() * items.length)]!.id);
      result.browser = await browserRun(dir, [...pick]);
    }
  } finally {
    if (!keep) rmSync(dir, { recursive: true, force: true });
  }
  console.log(JSON.stringify(result, null, 2));
}
