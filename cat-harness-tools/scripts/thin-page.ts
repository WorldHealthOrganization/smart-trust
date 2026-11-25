/**
 * The THIN PAGE — one asset's own rendering, materialised as a real file that
 * loads the asset's published JSON-LD at runtime.
 *
 * @module scripts/thin-page
 *
 * ## The rules
 *
 * - every asset has ONE IRI, the address of its published JSON-LD;
 * - its rendering is a SEPARATE resource at a path of its own (`<…>/<id>/`),
 *   with `rel="canonical"` naming itself and `rel="alternate"
 *   type="application/ld+json"` naming the asset;
 * - no `#` or `?` in the address, and no 404 routing — the page is a file;
 * - nothing of the asset's content is written into the page. The script
 *   reads it; the `<noscript>` names where it lives.
 * - the asset carries no link to its renderings. The page points at the
 *   asset, never the other way round.
 *
 * ## Who uses it
 *
 * The library and todo page families render through the theme's layout
 * (`gen-library-viz.ts` `libraryPageHtml`, `todo-page.ts` `todoPageHtml`), so
 * no generator calls {@link thinPageHtml} today; they keep the same rules and
 * still name themselves through {@link thinPageConfigOf}.
 *
 * ## The page DECLARES its node — twice, in two standards (issue #1830)
 *
 * A page given a {@link ThinPage.node} says which node it renders, of what
 * class, without any script of ours:
 *
 * - **RDFa** on the element the renderer fills: `resource` = the node's IRI,
 *   `typeof` = its classes, and `<html prefix="…">` the namespaces the classes
 *   are written in (owner, Q-THIN-1 = C). The caller writes the element and
 *   puts {@link nodeAttrs} on it; {@link thinPageHtml} refuses a body that
 *   does not.
 * - **A JSON-LD stub** in the head with the same `@id` and `@type`, and the
 *   prefixes as its `@context` (owner, Q-THIN-1: "combine with B"). Only the
 *   identity: the node's content stays in its own `.jsonld`, linked as
 *   `alternate` (site-size rule: link, don't embed).
 *
 * {@link pageNodeProblems} holds the two equal. A page with a node loads the
 * one generic renderer ({@link KG_RENDER_ASSET}, `templates/kg-render.js`),
 * which finds every `[resource][typeof]` and hands it to the renderer a
 * family registered for that class or namespace — so the family's script
 * draws, but the page says what it is.
 *
 * Node IRIs are slash IRIs, no `#` (owner, 2026-11-02), extensionless
 * `…/<kind>/<id>` with the data at `<id>.jsonld` (owner, Q-THIN-2 = A).
 *
 * ## The rail is LINKED, and that is a declaration
 *
 * {@link NAVBAR_LINKED} is written by default: `assets/css/navbar.css` and the
 * row's own files are LINKED, so the page carries only the rail's markup. The
 * build's rail passes honour the meta; `check-viewer-nav.ts` reads it as
 * `linked`, railed at build.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NAVBAR_LINKED } from "./lib/harness-rail.ts";
import { pageLayoutTags } from "./page-layout.ts";

/** Where a site holds the generic renderer, relative to a family's data root. */
export const KG_RENDER_ASSET = "assets/kg-render.js";

/** The generic renderer's source (`templates/kg-render.js`), for a generator to publish at {@link KG_RENDER_ASSET}. */
export function kgRenderScript(): string {
  return readFileSync(join(import.meta.dir, "templates", "kg-render.js"), "utf8");
}

/**
 * The Contents card (issue #1885): the IG sites' table-of-contents card, as a
 * script that defines `window.faContentsCard(scope)` and its stylesheet, for a
 * generator to bundle with the renderer that draws its pages.
 */
export function contentsCardScript(): string {
  return readFileSync(join(import.meta.dir, "templates", "contents-card.js"), "utf8");
}
/** The Contents card's style (`templates/contents-card.css`). */
export function contentsCardStyle(): string {
  return readFileSync(join(import.meta.dir, "templates", "contents-card.css"), "utf8");
}

/** The namespaces a page's classes are written in: prefix → namespace IRI (slash, no `#`). */
export type Prefixes = Readonly<Record<string, string>>;

/** The node a page renders: its IRI, and its classes as CURIEs over the page's {@link Prefixes} or as full IRIs. */
export interface PageNode {
  iri: string;
  types: readonly string[];
}

/** HTML-escape for text and attribute values, both quote characters included. */
export function escHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** One thin page. Every href is relative to the page itself. */
export interface ThinPage {
  /** The document title, plain text. */
  title: string;
  /**
   * The asset this page renders — its published JSON-LD, relative to the page.
   * Absent only when the asset has no published serialisation yet: then no
   * `alternate` is written, and the caller must say so in {@link noscript}.
   */
  jsonld?: string;
  /** The script that draws the page, relative to the page. */
  script: string;
  /** An optional stylesheet, relative to the page. */
  stylesheet?: string;
  /**
   * Link the shared page layout (`page-layout.ts`): the path from the page to
   * the site root that serves it, `""` at the root or `"../"` one level down.
   * The body then opts in by its classes (`fa-page-bar`, `fa-page-main`).
   * Absent, nothing is linked.
   */
  layout?: string;
  /**
   * The id of the `<script type="application/json">` config block. Each
   * family of pages names its own, which is what lets a generator recognise
   * its own output (and prune it) without touching anybody else's. A page
   * that declares its {@link node} needs none: it is recognised by what it
   * declares.
   */
  configId?: string;
  /** The page's identity, read by the script. Never the asset's content. Written only with {@link configId}. */
  config?: Record<string, unknown>;
  /**
   * The node this page renders — declared as RDFa on the body's element that
   * carries {@link nodeAttrs}, and as a JSON-LD stub in the head.
   */
  node?: PageNode;
  /** The namespaces {@link node}'s CURIEs use, written as `<html prefix>` and as the stub's `@context`. */
  prefixes?: Prefixes;
  /** The generic renderer, relative to the page; loaded before {@link script}. Required with {@link node}. */
  renderer?: string;
  /**
   * The skeleton the script fills, as HTML. The caller's — and the caller
   * escapes anything interpolated into it.
   */
  body: string;
  /** What a reader without JavaScript sees, as HTML, BEFORE the link to the asset. Defaults to "This page". */
  noscriptLead?: string;
  /**
   * The whole `<noscript>` content, as HTML, replacing the default sentence —
   * for a page that loads more than its own asset and must name what else.
   * The caller escapes anything interpolated into it.
   */
  noscript?: string;
  /** HTML written after the page's script, before `</body>` — e.g. a mount fragment. Its own line, even when empty. */
  tail?: string;
  /** `lang` of the document. */
  lang?: string;
  /** Keep the viewer rail. Off by default — see the module docs. */
  navbar?: boolean;
  /** The tab icon's href. Defaults to {@link DEFAULT_ICON}. */
  icon?: string;
  /**
   * The page's own address, relative to itself, for `rel="canonical"`.
   * Defaults to `./` — right for a page written as `<…>/<id>/index.html`.
   * A family whose pages are FILES at addresses readers already link
   * (an IG's `artifact/<Type>-<id>.html`, the IG Publisher's own names)
   * passes the file's name, so the canonical names the page and not its
   * directory.
   */
  canonical?: string;
}

/**
 * An inline icon, so a thin page makes no request the browser would otherwise
 * make for `/favicon.ico` — a 404 on every page view, which reads in the
 * console exactly like a broken asset.
 */
export const DEFAULT_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%23276749'/%3E%3C/svg%3E";

/** The config block's JSON, safe to sit inside a `<script>` element. */
function configJson(config: Record<string, unknown>): string {
  return JSON.stringify(config).replace(/</g, "\\u003c");
}

/** The RDFa attributes for the element that renders `node`: ` resource="…" typeof="…"`, leading space included. */
export function nodeAttrs(node: PageNode): string {
  return ` resource="${escHtml(node.iri)}" typeof="${escHtml(node.types.join(" "))}"`;
}

/** The `prefix` attribute's value: `p1: iri1 p2: iri2`, in key order. */
function prefixValue(prefixes: Prefixes): string {
  return Object.keys(prefixes)
    .sort()
    .map((k) => `${k}: ${prefixes[k]}`)
    .join(" ");
}

/** The head's JSON-LD stub: identity only, safe inside a `<script>`. */
function nodeStub(node: PageNode, prefixes: Prefixes): string {
  const ctx = Object.fromEntries(Object.keys(prefixes).sort().map((k) => [k, prefixes[k]]));
  const type = node.types.length === 1 ? node.types[0] : [...node.types];
  return JSON.stringify({ "@context": ctx, "@id": node.iri, "@type": type }).replace(/</g, "\\u003c");
}

/** Render a thin page. Deterministic: the same input gives the same bytes. */
export function thinPageHtml(p: ThinPage): string {
  const lead = p.noscriptLead ?? "This page";
  if (p.noscript === undefined && p.jsonld === undefined) {
    throw new Error(`thin page "${p.title}": no JSON-LD to name, so its <noscript> must be given`);
  }
  if (p.node !== undefined) {
    if (/[#?]/.test(p.node.iri)) throw new Error(`thin page "${p.title}": node IRI ${p.node.iri} has a '#' or '?' — node IRIs are slash IRIs`);
    if (p.renderer === undefined) throw new Error(`thin page "${p.title}": declares a node, so it must load the generic renderer`);
    if (!p.body.includes(nodeAttrs(p.node))) {
      throw new Error(`thin page "${p.title}": declares node ${p.node.iri}, but no element of its body carries nodeAttrs(node)`);
    }
    for (const t of p.node.types) {
      const pfx = /^([A-Za-z][\w.-]*):(?!\/\/)/.exec(t)?.[1];
      if (pfx !== undefined && !(p.prefixes && pfx in p.prefixes)) throw new Error(`thin page "${p.title}": class ${t} uses prefix "${pfx}", which the page does not declare`);
    }
  }
  if ((p.configId === undefined) !== (p.config === undefined)) {
    throw new Error(`thin page "${p.title}": a config block needs both its id and its content`);
  }
  if (p.configId === undefined && p.node === undefined) {
    throw new Error(`thin page "${p.title}": declares neither a node nor a config block, so nothing could recognise it`);
  }
  const prefixes = p.prefixes ?? {};
  const prefixAttr = p.node !== undefined && Object.keys(prefixes).length > 0 ? ` prefix="${escHtml(prefixValue(prefixes))}"` : "";
  const noscript =
    p.noscript ??
    `<p>${lead} loads its content from <a href="${escHtml(p.jsonld!)}">its JSON-LD</a>; it needs JavaScript to draw it.</p>`;
  return `<!doctype html>
<html lang="${escHtml(p.lang ?? "en")}"${prefixAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(p.title)}</title>
<link rel="canonical" href="${escHtml(p.canonical ?? "./")}">
<link rel="icon" href="${escHtml(p.icon ?? DEFAULT_ICON)}">
${p.navbar ? "" : `${NAVBAR_LINKED}\n`}${p.jsonld !== undefined ? `<link rel="alternate" type="application/ld+json" href="${escHtml(p.jsonld)}">\n` : ""}${p.node !== undefined ? `<script type="application/ld+json">${nodeStub(p.node, prefixes)}</script>\n` : ""}${p.layout !== undefined ? `${pageLayoutTags(escHtml(p.layout))}\n` : ""}${p.stylesheet ? `<link rel="stylesheet" href="${escHtml(p.stylesheet)}">\n` : ""}</head>
<body>
${p.body.trimEnd()}
<noscript>${noscript}</noscript>
${p.configId !== undefined ? `<script type="application/json" id="${escHtml(p.configId)}">${configJson(p.config!)}</script>\n` : ""}${p.renderer !== undefined ? `<script src="${escHtml(p.renderer)}"></script>\n` : ""}<script src="${escHtml(p.script)}"></script>
${p.tail !== undefined ? `${p.tail}\n` : ""}</body>
</html>
`;
}

/**
 * A thin page's config, read back from its own markup — or `undefined` when
 * the page carries no block with that id, or the block does not parse.
 *
 * This is how a generator recognises its OWN output: by the declaration the
 * page makes about itself, not by its name or its directory.
 */
export function thinPageConfigOf(content: string, configId: string): Record<string, unknown> | undefined {
  const esc = configId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`<script type="application/json" id="${esc}">([^<]*)</script>`).exec(content);
  if (!m) return undefined;
  try {
    const v: unknown = JSON.parse(m[1]!);
    return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** What a page declares about its node, read back from its markup. */
export interface DeclaredNode {
  /** Every `prefix` attribute on the page, parsed. */
  prefixes: Record<string, string>;
  /** Every element carrying both `resource` and `typeof`, classes expanded to full IRIs where a prefix is declared. */
  rdfa: Array<{ iri: string; types: string[] }>;
  /** The head's JSON-LD stub, classes expanded the same way, or undefined when there is none. */
  stub?: { iri: string; types: string[] };
}

const unesc = (s: string): string =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** A CURIE over `prefixes`, expanded; anything else as it is. */
function expand(curie: string, prefixes: Record<string, string>): string {
  const m = /^([A-Za-z][\w.-]*):(?!\/\/)(.*)$/.exec(curie);
  return m && m[1]! in prefixes ? `${prefixes[m[1]!]}${m[2]}` : curie;
}

/**
 * The node a page declares, read from its own markup: how a generator
 * recognises its output and how a check holds the RDFa and the stub equal.
 * `undefined` when the page declares no node at all.
 */
export function pageNodeOf(html: string): DeclaredNode | undefined {
  // Every `prefix` attribute on the page, on <html> or on the node's own
  // element (a themed page, whose layout owns <html>). Pages here declare
  // each prefix once, so scope does not matter for reading them back.
  const prefixes: Record<string, string> = {};
  for (const m of html.matchAll(/<[a-zA-Z][\w-]*\b[^>]*\sprefix="([^"]*)"/g)) {
    const parts = unesc(m[1]!).trim().split(/\s+/);
    for (let i = 0; i + 1 < parts.length; i += 2) prefixes[parts[i]!.replace(/:$/, "")] ??= parts[i + 1]!;
  }
  const rdfa: DeclaredNode["rdfa"] = [];
  for (const m of html.matchAll(/<[a-zA-Z][\w-]*\b([^>]*)>/g)) {
    const attrs = m[1]!;
    const r = /\sresource="([^"]*)"/.exec(attrs)?.[1];
    const t = /\stypeof="([^"]*)"/.exec(attrs)?.[1];
    if (r === undefined || t === undefined) continue;
    rdfa.push({ iri: unesc(r), types: unesc(t).trim().split(/\s+/).map((x) => expand(x, prefixes)) });
  }
  let stub: DeclaredNode["stub"];
  // The stub: the first JSON-LD script, in the head or (a themed page) beside the node's element.
  const s = /<script type="application\/ld\+json">([^<]*)<\/script>/.exec(html)?.[1];
  if (s !== undefined) {
    try {
      const j = JSON.parse(s) as { "@context"?: Record<string, string>; "@id"?: string; "@type"?: string | string[] };
      const ctx = { ...prefixes, ...(j["@context"] ?? {}) };
      if (typeof j["@id"] === "string") {
        const ts = j["@type"] === undefined ? [] : Array.isArray(j["@type"]) ? j["@type"] : [j["@type"]];
        stub = { iri: j["@id"], types: ts.map((x) => expand(x, ctx)) };
      }
    } catch {
      /* an unparsable stub is reported by pageNodeProblems */
    }
  }
  return rdfa.length === 0 && stub === undefined ? undefined : { prefixes, rdfa, ...(stub ? { stub } : {}) };
}

/** What is wrong with a page's node declaration — empty when the RDFa and the JSON-LD stub agree, or when it declares none. */
export function pageNodeProblems(html: string): string[] {
  const d = pageNodeOf(html);
  if (d === undefined) return [];
  const out: string[] = [];
  if (d.stub === undefined) out.push("declares a node in RDFa but has no JSON-LD stub");
  const first = d.rdfa[0];
  if (first === undefined) out.push("has a JSON-LD stub but no element carries resource and typeof");
  if (d.stub && first) {
    if (d.stub.iri !== first.iri) out.push(`JSON-LD stub names ${d.stub.iri}, RDFa names ${first.iri}`);
    if ([...d.stub.types].sort().join(" ") !== [...first.types].sort().join(" ")) {
      out.push(`JSON-LD stub types ${d.stub.types.join(" ")} differ from RDFa typeof ${first.types.join(" ")}`);
    }
  }
  for (const n of d.rdfa) {
    if (/[#?]/.test(n.iri)) out.push(`node IRI ${n.iri} has a '#' or '?'`);
    for (const t of n.types) if (!/^https?:\/\//.test(t)) out.push(`class ${t} on ${n.iri} uses an undeclared prefix`);
  }
  return out;
}

/** The page served AT a node's IRI when its rendering lives elsewhere (Q-THIN-3 = A, issue #1830). */
export interface NodeStubPage {
  title: string;
  node: PageNode;
  prefixes: Prefixes;
  /** The node's data, relative to the stub (`<id>.jsonld`). */
  jsonld: string;
  /** The rendering page, relative to the stub. */
  page: string;
  lang?: string;
}

/**
 * The small page at a node's IRI: the same declaration as its rendering —
 * RDFa on `<main>`, the JSON-LD stub, the `.jsonld` alternate — and a link
 * and a redirect to the page that draws it. A static host serves `<id>.html`
 * at the extensionless IRI, so the IRI opens in a browser and stays
 * processable without any script. No content, no rail, no script.
 */
export function nodeStubPageHtml(p: NodeStubPage): string {
  if (/[#?]/.test(p.node.iri)) throw new Error(`stub "${p.title}": node IRI ${p.node.iri} has a '#' or '?' — node IRIs are slash IRIs`);
  const page = escHtml(p.page);
  return `<!doctype html>
<html lang="${escHtml(p.lang ?? "en")}" prefix="${escHtml(prefixValue(p.prefixes))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(p.title)}</title>
<link rel="canonical" href="${page}">
<link rel="alternate" type="application/ld+json" href="${escHtml(p.jsonld)}">
<script type="application/ld+json">${nodeStub(p.node, p.prefixes)}</script>
<meta http-equiv="refresh" content="0; url=${page}">
</head>
<body>
<main${nodeAttrs(p.node)}><h1>${escHtml(p.title)}</h1><p><a href="${page}">Open its page</a> · <a href="${escHtml(p.jsonld)}">its JSON-LD</a></p></main>
</body>
</html>
`;
}

/**
 * The node's declaration for a page whose layout owns `<html>` and `<head>`
 * (a themed Jekyll page): the RDFa attributes WITH their `prefix` (RDFa 1.1
 * lets any element declare prefixes), and the JSON-LD stub as a body
 * element. The caller puts `attrs` on the element the renderer fills and
 * writes `stub` beside it.
 */
export function themedNodeDeclaration(node: PageNode, prefixes: Prefixes): { attrs: string; stub: string } {
  if (/[#?]/.test(node.iri)) throw new Error(`node IRI ${node.iri} has a '#' or '?' — node IRIs are slash IRIs`);
  return {
    attrs: ` prefix="${escHtml(prefixValue(prefixes))}"${nodeAttrs(node)}`,
    stub: `<script type="application/ld+json">${nodeStub(node, prefixes)}</script>`,
  };
}
