#!/usr/bin/env bun
/**
 * Does a built site serve the IRIs it mints?
 *
 * @module scripts/check-site-iris
 * @graphNode none — a QA check over one built site tree
 * @covers computed — it reads whatever JSON-LD the site publishes
 *
 * IRI fix 1A (owner, 2026-11-18), finding (f). The IRI scan found about
 * 32,000 node IRIs, every glossary concept IRI on 15 instances, and the
 * `@context` of most instances returning 404. Each was minted by a site that
 * did not serve it, and nothing noticed. This check reads a BUILT site (the
 * directory a publish would upload) and fails when an IRI the site mints does
 * not resolve on it. It never touches the network: whether the site serves a
 * path is read off the tree, the way GitHub Pages serves it.
 *
 * ## What counts as minted
 *
 * Each published `.jsonld` (or `.json` JSON-LD) document's node `@id`s: the
 * document's own and each `@graph` member's. Those are the nodes the site
 * claims. An IRI merely MENTIONED (a link to schema.org, another layer) is
 * not this site's to serve and is not checked.
 *
 * - A RELATIVE `@id` is resolved against the document's `@base` (the local
 *   context's), else the document's own published URL (JSON-LD's default).
 *   It was minted here, so it must resolve HERE: a base outside `--base` is a
 *   finding of its own (`foreign-base`), which is exactly the
 *   `https://litlfred.github.io/folio/` case.
 * - An ABSOLUTE `@id` under `--base` must be served (`unserved`). One outside
 *   it is a node the site describes but does not own, and is skipped.
 * - The document's `@context`, when it is a URL under `--base`, must be
 *   served too (`unserved-context`).
 *
 * ## Served, as GitHub Pages serves it
 *
 * A path `p` (after `--base`) is served when the tree holds `p` itself, or,
 * extensionless, `p.html` or `p/index.html` (a directory index: Pages
 * redirects `p` to `p/`). A hash IRI is served when its document is AND the
 * fragment is there: an `id="<frag>"` in an HTML page, or the full IRI as an
 * `@id` in a JSON-LD one. A fragment never 404s, so without that check a
 * concept missing from its namespace document would pass.
 *
 * ## Sampling
 *
 * A site can publish tens of thousands of nodes. `--sample N` (default 400)
 * reads N documents spread evenly over the sorted list, so a run is quick and
 * repeatable; `--sample 0` reads every one.
 *
 * Exit: 0 every sampled IRI is served · 1 some is not · 78 there is no built
 * site to read (no `--site`, or no such directory: a checkout gate run, which
 * a FHIR IG's layer-mode run saw exit 2 on its usage line) or it publishes no
 * JSON-LD · 2 a site is given with no `--base`, or a bad `--sample`.
 *
 * Usage:
 *   bun run cat check:site-iris --site <built site dir> --base <site URL> [--sample N] [--json]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { NOT_APPLICABLE_EXIT, exitNotApplicable } from "./lib/not-applicable.ts";

/** One IRI the site mints and does not serve. */
export interface IriFinding {
  kind: "unserved" | "unserved-context" | "foreign-base";
  /** The site-relative document that minted it. */
  file: string;
  iri: string;
  detail: string;
}

export interface SiteIriReport {
  documents: number;
  sampled: number;
  checked: number;
  findings: IriFinding[];
}

const SKIP_DIRS: ReadonlySet<string> = new Set([".git", "node_modules"]);

/** Every `.jsonld` file under `site`, site-relative with `/`, sorted. */
export function jsonLdFiles(site: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith(".jsonld")) out.push(relative(site, p).split(sep).join("/"));
    }
  };
  if (existsSync(site)) walk(site);
  return out.sort();
}

/** `n` items spread evenly over `items` (all of them when `n` is 0 or at least their count). */
export function evenSample<T>(items: readonly T[], n: number): T[] {
  if (n <= 0 || n >= items.length) return [...items];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(items[Math.floor((i * items.length) / n)]!);
  return out;
}

/** `base` with exactly one trailing slash. */
function withSlash(base: string): string {
  return base.endsWith("/") ? base : `${base}/`;
}

/** The site-relative path `iri` names under `base`, or `undefined` when it is not under it. */
export function pathUnder(iri: string, base: string): string | undefined {
  const b = withSlash(base);
  const noFrag = iri.split("#")[0]!;
  if (noFrag === b.slice(0, -1)) return "";
  if (!noFrag.startsWith(b)) return undefined;
  return decodeURIComponent(noFrag.slice(b.length));
}

/**
 * The file in `site` that GitHub Pages would answer `path` with, or
 * `undefined` when it would 404: the path itself, `<path>.html`, or
 * `<path>/index.html`.
 */
export function servedFile(site: string, path: string): string | undefined {
  const p = path.replace(/^\/+/, "");
  const candidates = p === "" || p.endsWith("/") ? [`${p}index.html`] : [p, `${p}.html`, `${p}/index.html`];
  for (const c of candidates) {
    const abs = join(site, c);
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return undefined;
}

/** Whether `iri`, under `base`, resolves on `site`: its document is served, and its fragment is in it. */
export function isServed(site: string, base: string, iri: string): { ok: boolean; detail: string } {
  const path = pathUnder(iri, base);
  if (path === undefined) return { ok: false, detail: `not under ${base}` };
  const file = servedFile(site, path);
  if (file === undefined) return { ok: false, detail: `no ${path || "index.html"}, ${path}.html or ${path}/index.html in the site` };
  const hash = iri.indexOf("#");
  if (hash === -1) return { ok: true, detail: "" };
  const frag = iri.slice(hash + 1);
  if (frag === "") return { ok: true, detail: "" };
  const text = readFileSync(file, "utf-8");
  const has = file.endsWith(".html")
    ? text.includes(`id="${frag}"`) || text.includes(`id='${frag}'`)
    : text.includes(JSON.stringify(iri)) || text.includes(JSON.stringify(`#${frag}`));
  return has ? { ok: true, detail: "" } : { ok: false, detail: `${relative(site, file)} is served, but has no #${frag}` };
}

/** The `@base` a document's local context sets, if any. */
function localBase(ctx: unknown): string | undefined {
  const parts = Array.isArray(ctx) ? ctx : [ctx];
  let base: string | undefined;
  for (const c of parts) {
    if (c !== null && typeof c === "object" && typeof (c as Record<string, unknown>)["@base"] === "string") {
      base = (c as Record<string, string>)["@base"];
    }
  }
  return base;
}

/** The context URLs a document names. */
function contextUrls(ctx: unknown): string[] {
  return (Array.isArray(ctx) ? ctx : [ctx]).filter((c): c is string => typeof c === "string");
}

/** The node `@id`s a document mints: its own and each `@graph` member's. */
function mintedIds(doc: Record<string, unknown>): string[] {
  const ids: string[] = [];
  if (typeof doc["@id"] === "string") ids.push(doc["@id"]);
  const graph = doc["@graph"];
  if (Array.isArray(graph)) {
    for (const n of graph) {
      if (n !== null && typeof n === "object" && typeof (n as Record<string, unknown>)["@id"] === "string") ids.push((n as Record<string, string>)["@id"]);
    }
  }
  return ids;
}

const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i;

/** Check one built site: every sampled document's minted `@id`s and its own context. */
export function checkSiteIris(site: string, base: string, sample = 400): SiteIriReport {
  const siteBase = withSlash(base);
  const all = jsonLdFiles(site);
  const files = evenSample(all, sample);
  const findings: IriFinding[] = [];
  let checked = 0;
  for (const file of files) {
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(join(site, file), "utf-8"));
    } catch {
      continue; // not JSON: a page check's business, not this one's
    }
    if (doc === null || typeof doc !== "object" || Array.isArray(doc)) continue;
    const rec = doc as Record<string, unknown>;
    const docUrl = `${siteBase}${file}`;
    for (const url of contextUrls(rec["@context"])) {
      if (pathUnder(url, siteBase) === undefined) continue;
      checked++;
      const s = isServed(site, siteBase, url);
      if (!s.ok) findings.push({ kind: "unserved-context", file, iri: url, detail: s.detail });
    }
    const declaredBase = localBase(rec["@context"]);
    for (const id of mintedIds(rec)) {
      if (id.startsWith("_:")) continue; // a blank node is nobody's address
      checked++;
      if (ABSOLUTE.test(id)) {
        if (pathUnder(id, siteBase) === undefined) continue; // described here, owned elsewhere
        const s = isServed(site, siteBase, id);
        if (!s.ok) findings.push({ kind: "unserved", file, iri: id, detail: s.detail });
        continue;
      }
      const against = declaredBase ?? docUrl;
      const iri = new URL(id, against).href;
      if (pathUnder(iri, siteBase) === undefined) {
        findings.push({ kind: "foreign-base", file, iri, detail: `relative @id ${JSON.stringify(id)} resolves against ${against}, which is not this site (${siteBase})` });
        continue;
      }
      const s = isServed(site, siteBase, iri);
      if (!s.ok) findings.push({ kind: "unserved", file, iri, detail: s.detail });
    }
  }
  return { documents: all.length, sampled: files.length, checked, findings };
}

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const site = arg(argv, "--site");
  const base = arg(argv, "--base");
  // No built site is not a usage error: a gate run over a checkout has none
  // to give it, and a site build always passes both (siteIriCheckStep).
  if (site === undefined || site === "") exitNotApplicable("check:site-iris", "no built site was given (--site <dir>); it judges a built site tree, not a checkout");
  if (!existsSync(site) || !statSync(site).isDirectory()) exitNotApplicable("check:site-iris", `there is no built site at ${site}`);
  if (base === undefined) {
    console.error("usage: check-site-iris.ts --site <built site dir> --base <site URL> [--sample N] [--json]");
    process.exit(2);
  }
  const sampleArg = arg(argv, "--sample");
  const sample = sampleArg === undefined ? 400 : Number(sampleArg);
  if (!Number.isInteger(sample) || sample < 0) {
    console.error(`check-site-iris: --sample must be a whole number, not ${JSON.stringify(sampleArg)}`);
    process.exit(2);
  }
  const r = checkSiteIris(site, base, sample);
  if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  if (r.documents === 0) {
    console.log(`check:site-iris: ${site} publishes no JSON-LD — nothing to check`);
    process.exit(NOT_APPLICABLE_EXIT);
  }
  if (!argv.includes("--json")) {
    for (const f of r.findings.slice(0, 40)) console.log(`✗ ${f.kind}: ${f.iri} (minted by ${f.file}) — ${f.detail}`);
    if (r.findings.length > 40) console.log(`  … and ${r.findings.length - 40} more`);
    console.log(`check:site-iris: ${r.sampled} of ${r.documents} JSON-LD document(s) read, ${r.checked} IRI(s) checked, ${r.findings.length} not served by the site`);
  }
  process.exit(r.findings.length > 0 ? 1 : 0);
}
