/**
 * The node-view coverage report's library: the node census per kind, the
 * expected routes, the folder-page link reader (HTML and data files), and the
 * per-row measurement. `scripts/node-view-coverage.ts` is the command.
 *
 * Every guard before this asked about a FOLDER page or a KIND (the node-kind
 * view audit, 2026-11-13, §3). This one asks, for each node a declared
 * directory holds, whether it has an IRI, a `.jsonld`, a page and a row
 * (`kg-viewer` §"Every asset has its own IRI", rules 1-3).
 *
 * ## How nodes are counted
 *
 * Per kind, by the rule in {@link CENSUS_RULES}: entry folders (a library, a
 * Tool, a voice), files of the kind's extensions, or the layer's export where
 * a file is not a node (a schema module, an actor in a roles file, a skill).
 * A directory another declaration of the same layer claims is left to that
 * declaration: the narrowest path wins. The rule used is recorded on each row
 * (`census`), so a count can be checked against the files it was taken from.
 *
 * ## How a folder page is read
 *
 * Its `<main>` (the rail is navigation, not rows), with scripts removed, AND
 * its data files: the inline `application/json` blocks it carries (not the
 * site's own `fa-*` ones) and every `.json` it names under `assets/<vis>/` or
 * beside itself. Several folder pages draw their rows in the browser from
 * those files (`SITE_HREF + r.page`), and the static link check could not see
 * them; that is how the schema and folio 404s shipped.
 *
 * @module scripts/lib/node-view-coverage
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import type { CoverageRow, Count, NodeLack, NodeRow } from "../../schemas/sdlc/node-view-coverage.ts";

// ─────────────────────────────────────────────────────────────────────────────
// THE CENSUS
// ─────────────────────────────────────────────────────────────────────────────

/** How one kind's nodes are found in its directory. */
export interface CensusRule {
  /** `entries`: each sub-folder is a node. `files`: each matching file is one. */
  rule: "entries" | "files";
  /** File suffixes (`.bpmn`, `.attestations.json`). The id drops the matched suffix. */
  suffixes?: readonly string[];
  /** Suffixes never counted (`.test.ts`, `.prov.jsonld`). */
  except?: readonly string[];
  /** For `entries`: a file an entry must hold to count (`voice.json`). */
  holds?: string;
  /** Read the layer's export first: a file is not the node here. */
  exportFirst?: true;
}

const JSON_FILES: CensusRule = { rule: "files", suffixes: [".json", ".jsonld"], except: [".prov.jsonld", ".schema.json"] };

/**
 * The census rule per kind. A kind not listed is counted by {@link JSON_FILES},
 * the platform's `NODE_EXTENSIONS` (one node per `.json`/`.jsonld` file).
 */
export const CENSUS_RULES: Readonly<Record<string, CensusRule>> = {
  library: { rule: "entries" },
  tools: { rule: "entries" },
  voices: { rule: "entries", holds: "voice.json" },
  "voice-vendors": { rule: "entries" },
  processes: { rule: "files", suffixes: [".bpmn", ".dmn"] },
  "business-processes": { rule: "files", suffixes: [".bpmn", ".dmn"] },
  attestations: { rule: "files", suffixes: [".attestations.json"] },
  "translation-sources": { rule: "files", suffixes: [".po", ".pot"] },
  glossary: { rule: "files", suffixes: [".glossary.json"] },
  "software-library": { rule: "files", suffixes: [".library.json", ".json"] },
  code: { rule: "files", suffixes: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".sh", ".rb", ".go"] },
  docs: { rule: "files", suffixes: [".md", ".html"] },
  "doc-group": { rule: "files", suffixes: [".md", ".html"] },
  beans: { rule: "files", suffixes: [".md"] },
  "bean-defs": { rule: "files", suffixes: [".md"] },
  "bean-notes": { rule: "files", suffixes: [".md"] },
  methodology: { rule: "files", suffixes: [".md", ".bpmn", ".json"] },
  themes: { rule: "files", suffixes: [".json", ".ts"], except: [".test.ts", ".d.ts"] },
  skills: { rule: "files", suffixes: [".md"], exportFirst: true },
  schemas: { rule: "files", suffixes: [".ts", ".json"], except: [".test.ts", ".d.ts"], exportFirst: true },
  scenarios: { ...JSON_FILES, exportFirst: true },
  "external-schema": { ...JSON_FILES, exportFirst: true },
};

export function censusRuleFor(kind: string): CensusRule {
  return CENSUS_RULES[kind] ?? JSON_FILES;
}

/** A node the census found. `path` is layer-relative. */
export interface NodeCandidate {
  id: string;
  path?: string;
  iri?: string;
  /** Its source is JSON, so a `.json` twin of its IRI is owed. */
  json?: boolean;
}

const SKIPPED = new Set(["README.md", "node_modules", "index.md"]);
const hidden = (n: string): boolean => n.startsWith(".") || n.startsWith("_");
const posix = (p: string): string => p.split(sep).join("/");

/** The matched suffix of `name` under `rule`, or `undefined`. */
function suffixOf(name: string, rule: CensusRule): string | undefined {
  if (rule.except?.some((s) => name.endsWith(s))) return undefined;
  return rule.suffixes?.find((s) => name.endsWith(s));
}

/**
 * The nodes a directory holds under a rule. `layerRoot` makes paths
 * layer-relative; `claimed` are absolute paths other declarations of the
 * layer own (skipped, with everything under them).
 */
export function censusFiles(absDir: string, layerRoot: string, rule: CensusRule, claimed: readonly string[] = []): NodeCandidate[] {
  const out: NodeCandidate[] = [];
  const isClaimed = (p: string): boolean => claimed.some((c) => p === c || p.startsWith(c + sep));
  if (rule.rule === "entries") {
    for (const e of safeDir(absDir)) {
      if (!e.isDirectory() || hidden(e.name) || SKIPPED.has(e.name)) continue;
      const abs = join(absDir, e.name);
      if (isClaimed(abs)) continue;
      if (rule.holds && !existsSync(join(abs, rule.holds))) continue;
      if (safeDir(abs).length === 0) continue;
      out.push({ id: e.name, path: posix(relative(layerRoot, abs)) + "/" });
    }
    return out.sort((a, b) => a.id.localeCompare(b.id, "en"));
  }
  const walk = (d: string): void => {
    for (const e of safeDir(d)) {
      if (hidden(e.name) || SKIPPED.has(e.name)) continue;
      const abs = join(d, e.name);
      if (isClaimed(abs)) continue;
      if (e.isDirectory()) walk(abs);
      else {
        const s = suffixOf(e.name, rule);
        if (s === undefined) continue;
        const rel = posix(relative(absDir, abs));
        out.push({ id: rel.slice(0, rel.length - s.length), path: posix(relative(layerRoot, abs)), json: s.endsWith(".json") });
      }
    }
  };
  walk(absDir);
  return out.sort((a, b) => a.id.localeCompare(b.id, "en"));
}

function safeDir(d: string): import("node:fs").Dirent[] {
  try {
    return readdirSync(d, { withFileTypes: true });
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE EXPORT: which `@id` belongs to which node
// ─────────────────────────────────────────────────────────────────────────────

/** The fields of an export node this report reads. */
export interface ExportNode {
  "@id": string;
  "@type"?: string | string[];
  name?: string;
  localId?: string;
  path?: string;
  sourcePath?: string;
  instructionsPath?: string;
  module?: string;
  inSubgraph?: string | string[];
  partOf?: unknown;
}

/** Types that describe the graph, not a node a directory holds. */
const STRUCTURAL = /\/(Subgraph|GraphTypology|SequenceFlow|ProcessNode|Lane)$/;

/** IRI segments a kind's nodes are minted under, for nodes the export ties to no directory. */
export const IRI_SEGMENTS: Readonly<Record<string, string>> = {
  tools: "tools",
  scenarios: "actor",
  "external-schema": "externalSchema",
};

const asList = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const typeOf = (n: ExportNode): string => asList(n["@type"]).join(" ");

/** The layer-relative path an export node names, if any. */
export function exportPathOf(n: ExportNode): string | undefined {
  return n.sourcePath ?? n.instructionsPath ?? n.path ?? n.module;
}

/** The id an export node reads as: its `name`, `localId`, or its IRI's last segment. */
export function exportIdOf(n: ExportNode): string {
  return n.name ?? n.localId ?? n["@id"].replace(/\/+$/, "").split("/").pop()!.replace(/\.jsonld$/, "");
}

/**
 * The export nodes that belong to one declared directory: tied to it by
 * `inSubgraph` (`…/directory/<id>`), or naming a path under it; for a kind in
 * {@link IRI_SEGMENTS}, minted under that segment. Process parts (flows,
 * lanes, steps) and the graph's own structure are not nodes of the directory.
 */
export function exportNodesOf(graph: readonly ExportNode[], dir: { id: string; path: string }, kind: string): ExportNode[] {
  const prefix = dir.path.replace(/\/*$/, "/");
  const seg = IRI_SEGMENTS[kind];
  return graph.filter((n) => {
    if (STRUCTURAL.test(typeOf(n)) || n.partOf !== undefined) return false;
    if (asList(n.inSubgraph).some((s) => s.endsWith(`/directory/${dir.id}`))) return true;
    const p = exportPathOf(n);
    if (p !== undefined && (p === dir.path || p.startsWith(prefix))) return true;
    return seg !== undefined && asList(n.inSubgraph).length === 0 && p === undefined && n["@id"].includes(`/${seg}/`);
  });
}

/**
 * Give each file-census node the `@id` of the export node for it: same path,
 * a path inside its entry folder, or the same id. A node with none keeps no IRI.
 */
export function attachIris(nodes: NodeCandidate[], exported: readonly ExportNode[]): NodeCandidate[] {
  const byPath = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const n of exported) {
    const p = exportPathOf(n);
    if (p !== undefined && !byPath.has(p)) byPath.set(p, n["@id"]);
    const id = exportIdOf(n);
    if (!byId.has(id)) byId.set(id, n["@id"]);
  }
  return nodes.map((c) => {
    let iri = c.path !== undefined ? byPath.get(c.path) : undefined;
    if (iri === undefined && c.path?.endsWith("/")) {
      for (const [p, i] of byPath) if (p.startsWith(c.path)) { iri = i; break; }
    }
    iri ??= byId.get(c.id) ?? byId.get(c.id.split("/").pop()!);
    return iri === undefined ? c : { ...c, iri };
  });
}

/** Does an IRI end in a file extension, so it is not extensionless? */
export function iriHasExtension(iri: string): boolean {
  const last = iri.replace(/[#?].*$/, "").split("/").pop() ?? "";
  return /\.(jsonld|json|html|ttl|xml)$/i.test(last);
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/** A node's path segment under its folder: each part URL-encoded, lower case kept as written. */
export function nodeSegment(id: string): string {
  return id.split("/").filter(Boolean).map(encodeURIComponent).join("/") + "/";
}

/** The canonical page of a node: `<folder page><id>/`. */
export function nodePageUrl(folderUrl: string, id: string): string {
  return folderUrl.replace(/\/*$/, "/") + nodeSegment(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// READING A FOLDER PAGE
// ─────────────────────────────────────────────────────────────────────────────

const RAW_REPO = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(blob|tree)\//;

/** Is this a raw repository link (a `github.com/<o>/<r>/blob|tree/…` URL)? */
export function isRawRepoLink(href: string): boolean {
  return RAW_REPO.test(href);
}

/**
 * What one page holds, read by an HTML parser (Bun's `HTMLRewriter`, as
 * `build-instance-site.ts` reads its links), never by stripping tags with a
 * regex: the rows' anchors, the inline JSON blocks and the JSON-LD the page
 * names. A link inside a `<script>` string is not an element, so it is not
 * read as a row.
 */
export interface PageRead {
  /** `href`s of anchors in `<main>` (the whole page when it has none), outside the rail. */
  rowHrefs: string[];
  /** Texts of `<script type="application/json">` blocks, except the site's own `fa-*` ones. */
  jsonBlocks: string[];
  /** The `href` of `<link rel="alternate" type="application/ld+json">`, if any. */
  alternate?: string;
}

export async function readPage(html: string): Promise<PageRead> {
  const inMain: string[] = [];
  const all: string[] = [];
  const rail = new Set<string>();
  let hasMain = false;
  const jsonBlocks: string[] = [];
  let alternate: string | undefined;
  let block: string[] | undefined;
  await new HTMLRewriter()
    .on("main", {
      element() {
        hasMain = true;
      },
    })
    .on("main a[href]", {
      element(el) {
        inMain.push(el.getAttribute("href")!);
      },
    })
    .on("a[href]", {
      element(el) {
        all.push(el.getAttribute("href")!);
      },
    })
    .on("nav.fa-nav a[href]", {
      element(el) {
        rail.add(el.getAttribute("href")!);
      },
    })
    .on('script[type="application/json"]', {
      element(el) {
        if ((el.getAttribute("id") ?? "").startsWith("fa-")) {
          block = undefined;
          return;
        }
        const parts: string[] = [];
        block = parts;
        el.onEndTag(() => {
          jsonBlocks.push(parts.join(""));
          block = undefined;
        });
      },
      text(t) {
        block?.push(t.text);
      },
    })
    .on('link[rel="alternate"][type="application/ld+json"]', {
      element(el) {
        alternate ??= el.getAttribute("href") ?? undefined;
      },
    })
    .transform(new Response(html))
    .text();
  const rowHrefs = (hasMain ? inMain : all).filter((h) => !rail.has(h));
  return { rowHrefs, jsonBlocks, ...(alternate ? { alternate } : {}) };
}

/** The absolute links (fragment dropped) in a page's rows. */
export async function htmlLinks(html: string, pageUrl: string): Promise<string[]> {
  const out = new Set<string>();
  for (const href of (await readPage(html)).rowHrefs) {
    if (!href || href.startsWith("#") || /^(mailto|javascript|data):/i.test(href)) continue;
    try {
      out.add(new URL(href, pageUrl).href.split("#")[0]!);
    } catch {
      // not a URL: not a link a reader can follow either
    }
  }
  return [...out];
}

/**
 * The data files a folder page draws from: `.json` it names under
 * `assets/<vis>/` or beside itself. Site-wide files (the rail, beans, QA,
 * translations) are not this folder's rows.
 */
export function dataFileRefs(html: string, pageUrl: string, siteUrl: string, vis: string): string[] {
  const out = new Set<string>();
  const assets = new URL(`assets/${vis}/`, siteUrl).href;
  const here = pageUrl.replace(/[^/]*$/, "");
  for (const m of html.matchAll(/["'(]([^"'()\s]+?\.json)(?:\?[^"')]*)?["')]/g)) {
    let u: string;
    try {
      u = new URL(m[1]!, pageUrl).href;
    } catch {
      continue;
    }
    if (u.startsWith(assets) || (u.startsWith(here) && !u.slice(here.length).includes("/"))) out.add(u);
  }
  return [...out];
}

/** The inline `application/json` blocks a page carries, except the site's own `fa-*` ones. */
export async function inlineData(html: string): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const t of (await readPage(html)).jsonBlocks) {
    try {
      out.push(JSON.parse(t));
    } catch {
      // unreadable block: not rows
    }
  }
  return out;
}

const LINK_KEYS = /^(page|href|url|link|pageUrl|pagePath|route|view)$/i;

/**
 * The links in a folder's data, each as its ALTERNATIVE readings. Strings under
 * a link-named key are relative, and a data file does not say to what: the
 * schema graph's `page` is read against the site root (`SITE_HREF + r.page`),
 * the Tools graph's against its folder page. So a relative string is read
 * against each of `bases` in turn, and the caller keeps the first that
 * resolves. An absolute URL anywhere is one reading. An object that names
 * another layer (`instance`/`layer`) is that layer's row, not this one's.
 */
export function dataLinks(data: unknown, bases: readonly string[], layer: string): string[][] {
  const out = new Map<string, string[]>();
  const walk = (v: unknown, key: string): void => {
    if (typeof v === "string") {
      if (/^https?:\/\//.test(v)) {
        const u = v.split("#")[0]!;
        out.set(u, [u]);
      } else if (LINK_KEYS.test(key) && /^[\w.~%/-]+$/.test(v) && (v.endsWith("/") || v.endsWith(".html"))) {
        try {
          out.set(v, [...new Set(bases.map((b) => new URL(v.replace(/^\/+/, ""), b).href))]);
        } catch {
          // not a path
        }
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x, key);
      return;
    }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const owner = typeof o.instance === "string" ? o.instance : typeof o.layer === "string" ? o.layer : undefined;
      if (owner !== undefined && owner !== layer) return;
      for (const [k, x] of Object.entries(o)) walk(x, k);
    }
  };
  walk(data, "");
  return [...out.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCHING — a built site directory, or a live base
// ─────────────────────────────────────────────────────────────────────────────

/** Status of a URL: an HTTP code, or 0 for "could not ask" (off-site, network down). */
export interface Fetcher {
  status(url: string): Promise<number>;
  text(url: string): Promise<string | undefined>;
}

/**
 * A built site directory served at `siteUrl`. A URL outside it is asked of
 * `fallback` (the network, with `--network`) or answered 0, could not ask.
 */
export function dirFetcher(siteDir: string, siteUrl: string, fallback?: Fetcher): Fetcher {
  const fileOf = (url: string): string | undefined => {
    if (!url.startsWith(siteUrl)) return undefined;
    let rel = decodeURIComponent(url.slice(siteUrl.length).split(/[?#]/)[0]!);
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const abs = join(siteDir, rel);
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
    // A Jekyll site serves `<x>.html` at `<x>` and `<x>/index.html` at `<x>`.
    for (const alt of [`${abs}.html`, join(abs, "index.html")]) if (existsSync(alt) && statSync(alt).isFile()) return alt;
    return "";
  };
  return {
    async status(url) {
      const f = fileOf(url);
      if (f === undefined) return fallback ? fallback.status(url) : 0;
      return f ? 200 : 404;
    },
    async text(url) {
      const f = fileOf(url);
      if (f === undefined) return fallback?.text(url);
      return f ? readFileSync(f, "utf-8") : undefined;
    },
  };
}

/** A live fetcher, cached, at most `concurrency` requests in flight. */
export function httpFetcher(concurrency = 16, impl: typeof fetch = fetch): Fetcher {
  const statuses = new Map<string, Promise<number>>();
  const texts = new Map<string, Promise<string | undefined>>();
  let active = 0;
  const queue: (() => void)[] = [];
  const slot = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= concurrency) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
  const once = async (url: string, method: "HEAD" | "GET"): Promise<Response | undefined> => {
    for (let i = 0; i < 2; i++) {
      try {
        return await impl(url, { method, redirect: "follow" });
      } catch {
        // one retry: a reset connection is not a 404
      }
    }
    return undefined;
  };
  return {
    status(url) {
      let p = statuses.get(url);
      if (!p) {
        p = slot(async () => (await once(url, "HEAD"))?.status ?? 0);
        statuses.set(url, p);
      }
      return p;
    },
    text(url) {
      let p = texts.get(url);
      if (!p) {
        p = slot(async () => {
          const r = await once(url, "GET");
          if (!r) return undefined;
          statuses.set(url, Promise.resolve(r.status));
          return r.ok ? r.text() : undefined;
        });
        texts.set(url, p);
      }
      return p;
    },
  };
}

const ok = (s: number): boolean => s >= 200 && s < 300;

/** The `<link rel="alternate" type="application/ld+json">` a page names, absolute. */
export async function alternateJsonld(html: string, pageUrl: string): Promise<string | undefined> {
  const href = (await readPage(html)).alternate;
  if (!href) return undefined;
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONE ROW
// ─────────────────────────────────────────────────────────────────────────────

/** Everything one row is measured from. */
export interface RowInput {
  layer: string;
  directory: { id: string; path: string };
  kind: string;
  /** The nodes, or why they could not be counted. */
  nodes: NodeCandidate[] | { unknown: string };
  census: string;
  /** IRIs could not be read for this layer (the export failed): why. */
  iriUnknown?: string;
  viewer: CoverageRow["viewer"];
  /** Candidate folder page URLs, first is canonical. Empty with no viewer. */
  folderUrls: string[];
  siteUrl: string;
  /** The visualiser id, for the data-file rule. */
  vis?: string;
  fetcher?: Fetcher;
  /** Fetch IRIs (`<iri>.jsonld`) through this one; off-site, the site fetcher answers 0. */
  iriFetcher?: Fetcher;
  probeLimit: number;
}

/** Measure one layer × directory × kind. */
export async function coverRow(r: RowInput): Promise<CoverageRow> {
  const base = {
    layer: r.layer,
    directory: r.directory.id,
    path: r.directory.path,
    kind: r.kind,
    viewer: r.viewer,
    census: r.census,
  };
  if (!Array.isArray(r.nodes)) {
    return {
      ...base,
      ...(r.folderUrls[0] ? { folderPage: siteRel(r.folderUrls[0], r.siteUrl) } : {}),
      folderPageFound: "unknown",
      declared: "unknown",
      withIri: "unknown",
      withJsonld: "unknown",
      withPage: "unknown",
      listed: "unknown",
      deadLinks: [],
      rawRepoLinks: "unknown",
      reason: r.nodes.unknown,
      nodes: [],
    };
  }
  const nodes = r.nodes;
  const f = r.fetcher;
  const reasons: string[] = [];

  // The folder page and the links it (and its data) holds.
  let folderUrl: string | undefined;
  let folderFound: boolean | "unknown" = r.folderUrls.length === 0 ? false : "unknown";
  let links: string[] = [];
  if (f && r.folderUrls.length > 0) {
    for (const u of r.folderUrls) {
      const html = await f.text(u);
      if (html === undefined) continue;
      folderUrl = u;
      folderFound = true;
      const set = new Set(await htmlLinks(html, u));
      const datas = [...(await inlineData(html))];
      for (const d of dataFileRefs(html, u, r.siteUrl, r.vis ?? "")) {
        const t = await f.text(d);
        if (t === undefined) continue;
        try {
          datas.push(JSON.parse(t));
        } catch {
          reasons.push(`data file ${siteRel(d, r.siteUrl)} does not parse`);
        }
      }
      for (const d of datas) {
        for (const alts of dataLinks(d, [r.siteUrl, u], r.layer)) {
          // The first reading that resolves; with none, the first is the dead one.
          let pick = alts[0]!;
          if (alts.length > 1) {
            for (const a of alts) {
              if (ok(await f.status(a))) {
                pick = a;
                break;
              }
            }
          }
          set.add(pick);
        }
      }
      set.delete(u);
      links = [...set];
      break;
    }
    if (folderUrl === undefined) {
      const s = await f.status(r.folderUrls[0]!);
      folderFound = s === 0 ? "unknown" : false;
    }
  } else if (!f) reasons.push("no built site or base was given, so pages, rows and links were not read");

  const rawRepo = links.filter(isRawRepoLink).length;
  const internal = links.filter((l) => l.startsWith(r.siteUrl));
  const linkSet = new Set(links);
  const lastSeg = (u: string): string =>
    decodeURIComponent(u.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? "").replace(/\.(html|jsonld|json)$/, "");

  // Dead links: only the site's own, and only page-like (not assets).
  const dead: string[] = [];
  if (f) {
    const pageLike = internal.filter((l) => !/\/assets\//.test(l) && !/\.(css|js|png|svg|jpg|woff2?)$/.test(l));
    const st = await Promise.all(pageLike.map((l) => f.status(l)));
    pageLike.forEach((l, i) => {
      if (st[i]! >= 400) dead.push(siteRel(l, r.siteUrl));
    });
  }

  const rows: NodeRow[] = await Promise.all(
    nodes.map(async (n, i): Promise<NodeRow> => {
      const missing: NodeLack[] = [];
      const unknown: string[] = [];
      const within = i < r.probeLimit;
      // 3. page, 4. listed — first, because a page names its asset's JSON-LD (rule 3).
      let page: string | undefined;
      let pageUrl: string | undefined;
      const canon = folderUrl ?? r.folderUrls[0];
      const canonUrl = canon ? nodePageUrl(canon, n.id) : undefined;
      const tail = n.id.split("/").pop()!;
      const named = links.filter(
        (l) => l === canonUrl || (n.iri !== undefined && (l === n.iri || l === `${n.iri}.jsonld`)) || (!isRawRepoLink(l) && lastSeg(l) === tail),
      );
      const listed = canonUrl !== undefined && (linkSet.has(canonUrl) || named.length > 0);
      if (!canonUrl) {
        missing.push("page", "listed");
      } else if (!f) {
        unknown.push("page and row: no site read");
      } else {
        const s = within ? await f.status(canonUrl) : -1;
        if (s === -1) unknown.push("page: over --probe-limit");
        else if (s === 0) unknown.push("page: could not ask");
        else if (ok(s)) pageUrl = canonUrl;
        else {
          // A page elsewhere that the folder links counts as a page, at the wrong address.
          for (const l of named.filter((x) => x.startsWith(r.siteUrl) && x !== canonUrl)) {
            if (ok(await f.status(l))) {
              pageUrl = l;
              break;
            }
          }
          if (pageUrl) missing.push("canonical-page");
          else missing.push("page");
        }
        if (folderFound === true && !listed) missing.push("listed");
        else if (folderFound === "unknown") unknown.push("row: folder page could not be read");
        else if (folderFound === false) missing.push("listed");
      }
      if (pageUrl) page = siteRel(pageUrl, r.siteUrl);

      // 1. IRI: the export's `@id`, or else the JSON-LD the page names
      // (`rel=alternate type=application/ld+json`) — the library mints its
      // IRIs outside the export (`library-iri.ts`), and its pages say so.
      let iri = n.iri;
      let iriFromPage = false;
      if (iri === undefined && pageUrl && f) {
        const alt = await alternateJsonld((await f.text(pageUrl)) ?? "", pageUrl);
        if (alt) {
          iri = alt.replace(/\.jsonld$/, "");
          iriFromPage = true;
        }
      }
      const iriUnknown = iri === undefined ? r.iriUnknown : undefined;
      if (iriUnknown) unknown.push(`IRI: ${iriUnknown}`);
      else if (!iri) missing.push("iri");
      else if (!iriFromPage && iriHasExtension(iri)) missing.push("iri-extension");
      // 2. JSON-LD (and the JSON twin)
      if (iri) {
        const lf = iriFromPage ? f : r.iriFetcher ?? f;
        if (!lf || !within) unknown.push(!within ? "jsonld: over --probe-limit" : "jsonld: nothing to fetch with");
        else {
          const doc = iriHasExtension(iri) ? iri : `${iri}.jsonld`;
          const s = await lf.status(doc);
          if (s === 0) unknown.push(`jsonld: could not ask ${doc}`);
          else if (!ok(s)) missing.push("jsonld");
          if (n.json && !iriHasExtension(iri)) {
            const sj = await lf.status(`${iri}.json`);
            if (sj === 0) unknown.push("json: could not ask");
            else if (!ok(sj)) missing.push("json");
          }
        }
      } else if (!iriUnknown) {
        missing.push("jsonld");
      }
      const verdict: NodeRow["verdict"] = missing.length > 0 ? "missing" : unknown.length > 0 ? "unknown" : "ok";
      return {
        id: n.id,
        ...(n.path ? { path: n.path } : {}),
        ...(iri ? { iri } : {}),
        ...(page ? { page } : {}),
        verdict,
        ...(missing.length ? { missing: [...new Set(missing)] } : {}),
        ...(unknown.length ? { reason: unknown.join("; ") } : {}),
      };
    }),
  );

  // A count is unknown when any node's part of it could not be asked, whatever else that node lacks.
  const anyUnknown = (pred: (n: NodeRow) => boolean): boolean => rows.some(pred);
  const count = (has: (n: NodeRow) => boolean, unknownWhen: (n: NodeRow) => boolean): Count =>
    anyUnknown(unknownWhen) ? "unknown" : rows.filter(has).length;
  const lacks = (n: NodeRow, l: NodeLack): boolean => n.missing?.includes(l) ?? false;
  const why = (n: NodeRow, w: string): boolean => (n.reason ?? "").includes(w);
  const anyJson = nodes.some((n) => n.json);
  return {
    ...base,
    ...(folderUrl ?? r.folderUrls[0] ? { folderPage: siteRel((folderUrl ?? r.folderUrls[0])!, r.siteUrl) } : {}),
    folderPageFound: folderFound,
    declared: nodes.length,
    withIri: count((n) => n.iri !== undefined, (n) => why(n, "IRI:")),
    withJsonld: count((n) => n.iri !== undefined && !lacks(n, "jsonld") && !why(n, "jsonld"), (n) => why(n, "jsonld") || why(n, "IRI")),
    ...(anyJson ? { withJson: count((n) => n.iri !== undefined && !lacks(n, "json") && !why(n, "json:") && !lacks(n, "jsonld"), (n) => why(n, "json")) } : {}),
    withPage: count((n) => n.page !== undefined, (n) => why(n, "page")),
    listed: count((n) => !lacks(n, "listed") && !why(n, "row") && !why(n, "page and row"), (n) => why(n, "row")),
    deadLinks: dead.sort(),
    rawRepoLinks: f && folderFound !== "unknown" ? rawRepo : "unknown",
    ...(reasons.length ? { reason: reasons.join("; ") } : {}),
    nodes: rows,
  };
}

/** A URL as the site sees it: relative to the site root, or as given when off-site. */
export function siteRel(url: string, siteUrl: string): string {
  return url.startsWith(siteUrl) ? url.slice(siteUrl.length) || "/" : url;
}

// ─────────────────────────────────────────────────────────────────────────────
// FINDINGS — what the judge compares
// ─────────────────────────────────────────────────────────────────────────────

/** One finding, in the canonical shape `judgeSidecarTree` keys on. */
export type CoverageFinding =
  | { directory: string; kind: string; node: string; missing: string }
  | { directory: string; kind: string; deadLink: string };

/** The findings of a layer's rows: every node with a `missing`, every dead link. Unknown is not a finding. */
export function findingsOf(rows: readonly CoverageRow[]): CoverageFinding[] {
  const out: CoverageFinding[] = [];
  for (const r of rows) {
    for (const n of r.nodes) if (n.verdict === "missing") out.push({ directory: r.directory, kind: r.kind, node: n.id, missing: n.missing!.join(",") });
    for (const d of r.deadLinks) out.push({ directory: r.directory, kind: r.kind, deadLink: d });
  }
  return out;
}

/** A row's counts as one Markdown table line. */
export function summaryLine(r: CoverageRow): string {
  const c = (x: Count | undefined): string => (x === undefined ? "—" : String(x));
  const v = r.viewer.state === "declared" ? r.viewer.id! : r.viewer.state;
  return `| ${r.layer} | ${r.directory} (\`${r.path}\`) | ${r.kind} | ${v} | ${c(r.declared)} | ${c(r.withIri)} | ${c(r.withJsonld)} | ${c(r.withPage)} | ${c(r.listed)} | ${r.deadLinks.length} | ${c(r.rawRepoLinks)} |`;
}

export const SUMMARY_HEAD =
  "| layer | folder | kind | viewer | nodes | IRI | .jsonld | page | listed | dead links | raw repo links |\n" +
  "|---|---|---|---|---|---|---|---|---|---|---|";
