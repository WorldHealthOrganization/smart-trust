/**
 * The IG site's own search: a box in the IG's top bar, an index of the IG's
 * pages and artefacts written at build time, and a small script that searches
 * it in the reader's browser.
 *
 * @module fhir-harness/scripts/ig-search
 * @covers none — a build step's helper: it writes a search index and a box, and judges no graph
 *
 * ## Why
 *
 * Owner, 2026-10-15, choosing layout "C" from wireframes: the folio rail
 * stands in for the theme's side menu, and the IG's top bar gets a search box
 * that searches the IG's pages and artefacts. The live roots had the theme's
 * search (`#search-input`) on every page; the IG route's pages are thin, laid
 * out by no theme, and had none (the WHO SMART Immunizations IG: on 1386 of 1386 live
 * pages, on 0 of 2021 built). The box carries `id="search-input"`, the id
 * the root parity guard (cat-harness-tools `site-parity.ts`) looks for, and
 * it is that id because the box really searches, not to satisfy the guard.
 *
 * ## What it searches, and what it does not
 *
 * - Each of the IG's own pages (the narrative, `input/pagecontent/` and the
 *   pages the build generates with front matter): its title and its whole
 *   text, with Liquid, HTML and markdown markup taken out (owner,
 *   2026-10-15: "index whole pages"; it was cut at 6000 characters, so a
 *   word deep in a long page was not found).
 * - Each artefact in the artefact index: its title, name, id, key, canonical
 *   and description, linked to its thin page `artifact/<Type>-<id>.html`.
 *
 * ## The artefacts are read from the index node, not copied
 *
 * When the site serves the artefact index node (`artifact/index.jsonld`,
 * `ig-artifact-jsonld.ts`), the search index holds only the pages and names
 * that node (`artifacts`); the client fetches both and makes the artefact
 * entries from the node's rows. The node already lists every artefact with
 * its title, key, canonical and description for the thin `artifacts` and
 * `toc` pages, and repeats the computer name for this search, so a second
 * list of the same artefacts in `ig-search.json` was a copy (owner,
 * 2026-11-10, "do B": 0.28 MB of 0.40 MB on one IG). A reader who searches
 * downloads about what they did before, compressed (the node is 30 KB
 * gzipped, the artefact half of the old index 26 KB), and a reader who has
 * opened the artifacts page has the node already. A site with no node (a
 * `--full-pages` build) keeps the artefacts in the search index, as before.
 *
 * Not the artefacts' element tables or narratives: those are in the
 * resources, which the thin pages load on demand, and indexing them would
 * put the whole AST into one file every reader downloads.
 *
 * The index is fetched on the first focus of the box, never on page load, so
 * a reader who does not search pays nothing for it. No Publisher HTML is read
 * to build it (owner, 2026-10-14: "I DO NOT WANT THE IG PUBLISHER HTML").
 *
 * ## Why not the theme's search, and not docs-ui's
 *
 * The thin pages carry no just-the-docs layout, so the theme's lunr search has
 * no box to bind to and its index (`assets/js/search-data.json`) excludes the
 * artefact pages by design (`search_exclude`). docs-ui adopts a `.search`
 * element into its band; this box is `.ig-search`, so it stays in the top bar
 * where the owner placed it.
 *
 * Nothing here may know about WHO (fhir-harness/AGENTS.md).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { escHtml } from "../../cat-harness-tools/scripts/thin-page.ts";
import { PAGE_BAR_CLASS, PAGE_LAYOUT_MARK, pageLayoutTags } from "../../cat-harness-tools/scripts/page-layout.ts";
import type { FhirArtifact } from "../schemas/fhir-artifact-index.js";
import { ARTIFACT_DIR, ARTIFACT_INDEX_FILE, artifactPageName } from "./ig-artifact-jsonld.ts";

/** The IG's one stylesheet, under the docs root (`ig-thin-pages.ts` `THIN_PAGE_STYLE`). */
export const IG_ARTIFACT_CSS_FILE = "assets/ig-artifact.css";

/** The index, under the IG's docs root. */
export const IG_SEARCH_INDEX_FILE = "assets/ig-search.json";
/** The client, under the IG's docs root. */
export const IG_SEARCH_SCRIPT_FILE = "assets/ig-search.js";
/** The client's source, beside the other thin-page templates. */
export const IG_SEARCH_SCRIPT_SOURCE = join(import.meta.dir, "templates", "ig-pages", "ig-search.js");
/**
 * The index's format, which the client checks. v2 added `artifacts`; the
 * client reads v1 too.
 */
export const IG_SEARCH_FORMAT = "fhir-harness-ig-search/v2";
/** One searchable thing. Short keys: the file is downloaded by every reader who searches. */
export interface IgSearchEntry {
  /** Title, as shown. */
  t: string;
  /** Href, relative to the docs root. */
  h: string;
  /** Kind: `page`, or the artefact's resource type. */
  k: string;
  /** Identifiers: an artefact's id, name, key and canonical. */
  i?: string;
  /** A one-line description, shown under the title. */
  d?: string;
  /** A page's text, searched and not shown. */
  x?: string;
}

export interface IgSearchIndex {
  format: typeof IG_SEARCH_FORMAT;
  /** Where the hrefs are relative to, relative to the index file. */
  base: "../";
  /**
   * The artefact index node the client makes the artefact entries from,
   * relative to the index file; absent, `entries` holds the artefacts.
   */
  artifacts?: string;
  entries: IgSearchEntry[];
}

/** The index node, relative to the search index (`assets/` → `artifact/index.jsonld`). */
export const IG_SEARCH_ARTIFACTS_NODE = `../${ARTIFACT_DIR}/${ARTIFACT_INDEX_FILE}`;

/** Where the box's index and script are, relative to (or absolute from) the page carrying it. */
export interface IgSearchRef {
  index: string;
  script: string;
}

/**
 * Where docs-ui puts the language picker: beside the box, in the bar that
 * holds it (owner, 2026-10-15: "move the language picker into the IG top
 * bar"). docs-ui (cat-harness `docs-ui.js`) fills the first element marked
 * `data-fa-slot="locale"` and, on a page with none, keeps the picker in its
 * own band; so this layer names a place, and knows nothing of the picker.
 * A `<span>`, empty until docs-ui runs.
 */
export const IG_LOCALE_SLOT = `<span class="ig-locale-slot" data-fa-slot="locale"></span>`;

/**
 * The box, and beside it the language picker's slot ({@link IG_LOCALE_SLOT}).
 * A `<form>` holding the input and an empty result list; the script makes it
 * work. No `<div>`: the composed pages lift the top bar out of the staged
 * layout up to its first closing `</div>` at a line end.
 */
export function igSearchBox(ref: IgSearchRef, label: string): string {
  const name = `Search ${label}`;
  return (
    `<form class="ig-search" role="search" data-ig-search-index="${escHtml(ref.index)}">` +
    `<label class="ig-search-label" for="search-input">${escHtml(name)}</label>` +
    `<input type="search" id="search-input" class="ig-search-input" placeholder="Search pages and artefacts" autocomplete="off" aria-controls="ig-search-results" aria-expanded="false">` +
    `<ul id="ig-search-results" class="ig-search-results" hidden></ul>` +
    `</form>` +
    IG_LOCALE_SLOT
  );
}

/** The `<script>` that loads the client, deferred. */
export const igSearchScript = (ref: IgSearchRef): string => `<script src="${escHtml(ref.script)}" defer></script>`;

/** Search box styles, shared by the top bar (`.ig-topbar`) and the thin pages' header (`.iga-top`). */
export const IG_SEARCH_CSS = `
.ig-search{position:relative;z-index:1000;margin-left:auto;flex:0 1 18rem;min-width:10rem}
.ig-search-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ig-search-input{width:100%;box-sizing:border-box;padding:.3rem .6rem;font:inherit;font-size:var(--fa-text-sm,0.875rem);color:#1f2328;background:#fff;border:1px solid #c8d1dc;border-radius:4px}
.ig-search-results{position:absolute;right:0;z-index:30;width:min(32rem,90vw);max-height:70vh;overflow:auto;margin:.25rem 0 0;padding:.25rem 0;list-style:none;background:#fff;color:#1f2328;border:1px solid #ccc;box-shadow:0 2px 6px rgba(0,0,0,.15);text-align:left}
.ig-search-results li{margin:0;padding:0}
.ig-search-results li::before{content:none;display:none}
.ig-search-results a{display:block;padding:.3rem .75rem;color:#0b5cad;text-decoration:none}
.ig-search-results a:hover,.ig-search-results a[aria-selected="true"]{background:#eef3f8}
.ig-search-results small{display:block;color:#59636e;font-size:var(--fa-text-xs,0.75rem);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ig-search-kind{display:inline-block;margin-right:.4rem;padding:0 .4em;border-radius:1em;font-size:var(--fa-text-xs,0.75rem);color:#fff;background:#6e7781}
.ig-search-none{padding:.3rem .75rem;color:#59636e}
html:not([data-fa-scheme="light"]) .ig-search-results{background:#2f2e35;color:#e6edf3;border-color:#44434d;box-shadow:0 2px 8px rgba(0,0,0,.5)}
html:not([data-fa-scheme="light"]) .ig-search-results a{color:#cfe0f7}
html:not([data-fa-scheme="light"]) .ig-search-results a:hover,html:not([data-fa-scheme="light"]) .ig-search-results a[aria-selected="true"]{background:#3a3943}
html:not([data-fa-scheme="light"]) .ig-search-results small,html:not([data-fa-scheme="light"]) .ig-search-none{color:#9198a1}
`;

/**
 * The bar a page gets when the site has no IG bar to give it (no composed
 * home page to take one from): the IG's name, linked home, then the box and
 * the picker's slot. A page bar of the shared page layout, so its place and
 * scrolling are every other page's; its look is `ig-artifact.css`'s
 * (`.ig-search-top`).
 */
export function igFallbackBar(ref: IgSearchRef, label: string, home: string): string {
  return `<header class="ig-search-top ${PAGE_BAR_CLASS}"><a class="ig-search-home" href="${escHtml(home)}">${escHtml(label)}</a>${igSearchBox(ref, label)}</header>`;
}

/** A page's own IG header, which {@link withIgBar} replaces with the IG's bar: a thin page's, or a fallback bar. */
const OWN_HEADER = /<header class="(?:iga-top|ig-search-top)\b[^"]*">[\s\S]*?<\/header>/;
/** The IG's bar, which a page that holds it keeps. */
const IG_BAR = /<div class="ig-topbar[ "]/;

/**
 * A built page given the IG's ONE top bar — the bar every composed page
 * carries (`build-ig-site.ts` `igTopBar`: title, menu, search box, language
 * picker's slot) — and the two stylesheets that lay it out: the shared page
 * layout (cat-harness-tools `page-layout.ts`) and `ig-artifact.css`. Pure.
 *
 * - A page that holds the IG's bar is returned as it was.
 * - A page with its own IG header (a thin artefact or list page's
 *   `.iga-top`) has it REPLACED, so the bar is the same on every page.
 * - A page with neither (an IG API hub page, the OpenAPI pages) is given
 *   the bar at the top of its body.
 * - A page with a search box in some other bar, or with no `<head>` and
 *   `<body>`, is returned as it was.
 *
 * `bar` is the IG's bar, site-absolute; undefined, {@link igFallbackBar}.
 * Its scripts are dropped and the search client is linked once, at the end
 * of the body, unless the page already loads it. `up` is the path from the
 * page to the site root.
 *
 * WHY HERE, AND NOT IN THE PAGES' OWN WRITERS (owner, 2026-10-15: the search
 * box on the API hub page and the `openapi/` pages too; then "please
 * consolidate behaviours/appearance"). Those pages are written by layers this
 * one does not own: the hub by an overlay above this layer, the OpenAPI pages
 * by cat-harness-tools and that overlay; and the thin artefact pages are
 * written before the menu the bar shows is laid out. So the IG's
 * `publisher-pages` step, which already gives every built page the language
 * picker's block, gives every built page this bar: one pass over the
 * finished site, keyed on what the page holds, never on its name.
 */
export function withIgBar(html: string, o: { bar?: string; ref: IgSearchRef; label: string; home: string; up: string }): string {
  const head = html.search(/<\/head>/i);
  if (head < 0) return html;
  const open = /<body\b[^>]*>/i.exec(html.slice(head));
  if (!open) return html;
  const afterOpen = head + open.index + open[0].length;
  const close = html.toLowerCase().lastIndexOf("</body>");
  if (close < afterOpen) return html;
  let body = html.slice(afterOpen, close);
  if (IG_BAR.test(body)) return html;
  const bar = o.bar ? o.bar.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "") : igFallbackBar(o.ref, o.label, o.home);
  const own = OWN_HEADER.exec(body);
  if (own) body = body.replace(own[0], () => bar);
  else if (body.includes('id="search-input"')) return html;
  else body = `\n${bar}${body}`;
  const script = /assets\/ig-search\.js"/.test(body) ? "" : `${igSearchScript(o.ref)}\n`;
  const sheet = html.slice(0, head).includes(`${IG_ARTIFACT_CSS_FILE}"`) ? "" : `<link rel="stylesheet" href="${escHtml(o.up)}${IG_ARTIFACT_CSS_FILE}">`;
  const layout = html.includes(PAGE_LAYOUT_MARK) ? "" : pageLayoutTags(escHtml(o.up));
  // The layout before the IG's sheet, which builds on it.
  return html.slice(0, head) + layout + sheet + html.slice(head, afterOpen) + body + script + html.slice(close);
}

/** A page's source made plain text: front matter, Liquid, HTML and markdown markup removed. Pure. */
export function plainText(source: string): string {
  let s = source.replace(/^---\n[\s\S]*?\n---\n?/, "");
  s = s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, " ");
  s = s.replace(/\{%[\s\S]*?%\}/g, " ").replace(/\{\{[\s\S]*?\}\}/g, " ");
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1");
  s = s.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, " ");
  s = s.replace(/\{:[^}]*\}/g, " ");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/[#*_`|>~]+/g, " ").replace(/^\s*[-+]\s+/gm, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** A front matter value, unquoted; undefined when absent. */
function fmValue(fm: string, key: string): string | undefined {
  const m = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(fm);
  if (!m) return undefined;
  const v = m[1]!.trim();
  if (/^".*"$/.test(v)) {
    try {
      return JSON.parse(v) as string;
    } catch {
      return v.slice(1, -1);
    }
  }
  return v.replace(/^'(.*)'$/, "$1").replace(/''/g, "'");
}

/**
 * The IG's own pages in a staged site source: every `.md` or `.html` with
 * front matter, outside `_*` directories and outside the artefact pages,
 * that does not ask to be left out of search (`search_exclude: true`). Its
 * href is the page Jekyll builds (`<stem>.html`). Sorted by href.
 */
export function pageSearchEntries(staged: string): IgSearchEntry[] {
  const out: IgSearchEntry[] = [];
  const walk = (rel: string): void => {
    const dir = rel ? join(staged, rel) : staged;
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith("_") || name.startsWith(".")) continue;
      const r = rel ? `${rel}/${name}` : name;
      const abs = join(staged, r);
      if (statSync(abs).isDirectory()) {
        if (!rel && (name === ARTIFACT_DIR || name === "assets")) continue;
        walk(r);
        continue;
      }
      if (!/\.(md|markdown|html)$/.test(name)) continue;
      const text = readFileSync(abs, "utf-8");
      if (!text.startsWith("---\n")) continue;
      const end = text.indexOf("\n---", 3);
      if (end < 0) continue;
      const fm = text.slice(4, end);
      if (/^search_exclude:\s*true\s*$/m.test(fm)) continue;
      const href = r.replace(/\.(md|markdown|html)$/, ".html");
      const body = plainText(text.slice(end + 4));
      const title = fmValue(fm, "title") ?? href;
      out.push({ t: title, h: href, k: "page", ...(body ? { x: body } : {}) });
    }
  };
  if (existsSync(staged)) walk("");
  return out.sort((a, b) => (a.h < b.h ? -1 : a.h > b.h ? 1 : 0));
}

/** A description cut to one line. */
const oneLine = (s: string, n = 160): string => {
  const t = plainText(s);
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Every artefact of the index, linked to its thin page, in the index's order. Pure. */
export function artifactSearchEntries(artifacts: ReadonlyArray<Pick<FhirArtifact, "key" | "resourceType" | "id" | "name" | "title" | "description" | "canonical">>): IgSearchEntry[] {
  return artifacts.map((a) => {
    const ids = [...new Set([a.id, a.name, a.key, a.canonical].filter((v): v is string => typeof v === "string" && v !== ""))];
    return {
      t: a.title ?? a.name ?? a.id,
      h: `${ARTIFACT_DIR}/${artifactPageName(a)}.html`,
      k: a.resourceType,
      ...(ids.length ? { i: ids.join(" ") } : {}),
      ...(a.description ? { d: oneLine(a.description) } : {}),
    };
  });
}

/**
 * The index file's content. Deterministic. `artifacts` is either the
 * artefact entries, or the path of the index node they are read from
 * ({@link IG_SEARCH_ARTIFACTS_NODE}).
 */
export function igSearchIndex(pages: readonly IgSearchEntry[], artifacts: readonly IgSearchEntry[] | string): IgSearchIndex {
  return typeof artifacts === "string"
    ? { format: IG_SEARCH_FORMAT, base: "../", artifacts, entries: [...pages] }
    : { format: IG_SEARCH_FORMAT, base: "../", entries: [...pages, ...artifacts] };
}
