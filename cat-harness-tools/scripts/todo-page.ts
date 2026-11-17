/**
 * One todo's RENDERING — a thin page at `<site>/todos/<id>/` that loads the
 * todo's published JSON-LD.
 *
 * @module scripts/todo-page
 *
 * The page follows the thin-page rules (`thin-page.ts`) on the site's layout.
 * What is todo-specific is only the skeleton the script fills and the config
 * it reads: the todo's id, where its JSON-LD and the whole graph are, and —
 * when the todo is attached to a block — the href of that block's RENDERING,
 * so the page can link a reader to the sentence the todo is about. That href
 * is a fact about renderings, so it lives on this page and never on the todo.
 *
 * The script and stylesheet are static assets under `assets/todos/`, shared
 * by every todo page, so a page is a few hundred bytes of identity.
 */
import type { TodoIndexItem } from "../schemas/sdlc/todo-index.js";
import { themedPage } from "./lib/themed-page.ts";
import { KG_RENDER_ASSET, escHtml, pageNodeOf, themedNodeDeclaration } from "./thin-page.ts";
import { segment, todoIri } from "./todo-graph.ts";

/** A todo's class, as its JSON-LD types it (`Todo` → `ical:Vtodo`, `todo-graph.ts`). */
export const TODO_CLASS = "http://www.w3.org/2002/12/cal/ical#Vtodo";
const PREFIXES = { ical: "http://www.w3.org/2002/12/cal/ical#" };

/**
 * The config block's id an EARLIER todo page carried (before issue #1830) —
 * kept only so the orphan sweep can still recognise, and remove, the pages
 * at the old `todos/<id>/` path.
 */
export const LEGACY_TODO_PAGE_CONFIG_ID = "fa-todo-page-config";

/** The shared script and stylesheet, site-relative. */
export const TODO_PAGE_SCRIPT = "assets/todos/todo-page.js";
export const TODO_PAGE_STYLESHEET = "assets/todos/todo-page.css";

/** What the page needs to know about where it sits. */
export interface TodoPageOptions {
  /**
   * The href of the attached block's RENDERING, relative to the todo page,
   * or `undefined` when the todo is attached to nothing this build renders.
   */
  targetHref?: string;
}

/**
 * The page, for a todo at `<site>/todo/<id>/` — every href is two levels below the site root.
 * "All todos" goes to the board, which stays at `todos/`, not to `todo/`, which serves nothing.
 *
 * A THEMED Jekyll page since 2026-10-07 (`lib/themed-page.ts`): on the site's
 * `default` layout, so it carries the top band (search, Folio, language) that
 * only that layout delivers. It keeps the thin page's rules — one IRI, the
 * content loaded at runtime, the asset named as `alternate` (written by
 * `head_custom.html` from `alternate_jsonld`) — and DECLARES its todo on
 * `#fa-todo-page`: RDFa `resource`/`typeof` (`ical:Vtodo`) with the prefix
 * there, and a JSON-LD stub beside it (issue #1830), which is how
 * {@link isTodoPage} and the orphan sweep recognise it. What the script needs
 * besides is `data-kg-*` on the same element; no private config block. The
 * page loads the generic renderer, which hands the element to
 * `todo-page.js`. The shared stylesheet styles only `.fa-todo-page`.
 */
export function todoPageHtml(item: TodoIndexItem, opts: TodoPageOptions = {}): string {
  const toRoot = "../../";
  const id = segment(item.id);
  const jsonld = `../${id}.jsonld`;
  const decl = themedNodeDeclaration({ iri: todoIri(item.id), types: ["ical:Vtodo"] }, PREFIXES);
  const data = Object.entries({ graph: `${toRoot}todos.jsonld`, pages: "../", "target-href": opts.targetHref })
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` data-kg-${k}="${escHtml(v!)}"`)
    .join("");
  return themedPage({
    title: `Todo: ${item.id}`,
    generator: "cat-harness-tools/scripts/gen-docs-pages.ts",
    command: "bun run docs:pages",
    // One skeleton for every todo, filled at runtime: nothing to index.
    frontMatter: { search_exclude: true, alternate_jsonld: jsonld },
    body: `<link rel="stylesheet" href="${escHtml(`${toRoot}${TODO_PAGE_STYLESHEET}`)}">
<div class="fa-todo-page" id="fa-todo-page"${decl.attrs}${data}>
${decl.stub}
<p class="fa-todo-page-up"><a href="${escHtml(`${toRoot}todos/`)}">All todos</a></p>
<h1 id="fa-todo-summary">${escHtml(item.id)}</h1>
<p class="fa-todo-page-status" id="fa-todo-status" role="status">loading…</p>
<dl class="fa-todo-page-meta" id="fa-todo-meta"></dl>
<div class="fa-todo-page-body" id="fa-todo-body"></div>
<ul class="fa-todo-page-edges" id="fa-todo-edges"></ul>
<section class="fa-todo-page-siblings" id="fa-todo-siblings" hidden>
<h2>Other todos on this block</h2>
<ul id="fa-todo-sibling-list"></ul>
</section>
<noscript><p>This todo loads its content from <a href="${escHtml(jsonld)}">its JSON-LD</a>; it needs JavaScript to draw it.</p></noscript>
</div>
<script src="${escHtml(`${toRoot}${KG_RENDER_ASSET}`)}"></script>
<script src="${escHtml(`${toRoot}${TODO_PAGE_SCRIPT}`)}"></script>`,
  });
}

/** Is this file a todo page — by its own declaration, not by its path? */
export function isTodoPage(content: string): boolean {
  return pageNodeOf(content)?.rdfa.some((n) => n.types.some((t) => t === TODO_CLASS)) ?? false;
}

/** Is this file a todo page written before issue #1830 — by its old config block? For the orphan sweep only. */
export function isLegacyTodoPage(content: string): boolean {
  return content.includes(`<script type="application/json" id="${LEGACY_TODO_PAGE_CONFIG_ID}">`);
}
