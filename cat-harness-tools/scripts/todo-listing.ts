/**
 * The LINEAR FLOOR — every note, in document order, as server-rendered HTML.
 *
 * @module scripts/todo-listing
 *
 * **The tile listing is the artefact and the board is the overlay.** Without
 * this, a reader with JavaScript off gets no note at all. It is an
 * accessibility floor, not a fallback: a board that cannot be read linearly
 * cannot be read by a screen reader, printed, or translated, and this
 * layer's declared interaction profile is **low-dexterity**.
 *
 * ## One function, two callers
 *
 * `gen-docs-pages.ts` emits this into the site as a generated include; the
 * e2e that loads a page with `javaScriptEnabled: false` renders the same
 * function and serves the result. **Everything that could drift — the field
 * set, the order, the escaping, the element structure — is this function's**.
 *
 * The ONE thing that differs is the attachment link: on the site the href
 * must go through Jekyll's `relative_url`, which means nothing to a static
 * server, so the caller supplies {@link TodoListingOptions.pageHref}. The e2e
 * therefore proves the LISTING is served and readable without JavaScript, not
 * that `baseurl` resolution is correct — `site-links.test.ts` covers that.
 *
 * ## Document order is the input's order
 *
 * `readTodoFiles` sorts, so the array this receives is stable across
 * regenerations. This function must **never** sort, filter or reverse: the
 * board may stack by BPMN subprocess depth, but "document order" is the
 * property a screen reader and a printout depend on.
 *
 * ## Everything is escaped
 *
 * A note's `summary` and `comment` are authored and land in HTML here, so
 * {@link escapeHtml} is applied to every interpolated value without
 * exception, including ones that "cannot" contain markup.
 */
import type { TodoIndexItem } from "../schemas/sdlc/todo-index.js";
import { safeHref } from "../schemas/ui/safe-url.js";
import { withInlineCode } from "../schemas/content/inline-code.js";

/** How the caller turns a note's attachment into an href it can serve. */
export interface TodoListingOptions {
  /**
   * The link to a note's attachment, or `undefined` for none.
   *
   * `undefined` is a real answer and the honest one when the caller cannot
   * produce a URL a reader could follow: bean `pb04` — a dead link is worse
   * than no link — so the listing then names the page and node as text.
   */
  pageHref?: (page: string, node: string) => string | undefined;
  /**
   * The link to a todo's OWN page (`<site>/todos/<id>/`, issue #1908), or
   * `undefined` for none. Same rule as {@link pageHref}: the caller composes
   * it because Jekyll owns `baseurl`, and an absent href renders no link.
   */
  todoPageHref?: (id: string) => string | undefined;
  /**
   * Which listing this is (bean `lwjc`). `"folio"`, the default, is every note
   * — the todos board's listing. `"page"` is the notes attached to ONE page,
   * which is what a page's footer shows: its count is that page's own, never
   * the folio's.
   */
  scope?: "folio" | "page";
}

/** What {@link groupTodosByPage} returns: each page's own notes, and the rest. */
export interface TodosByPage {
  /** Page key (a `target.page`) → that page's notes, in input order. */
  pages: Map<string, TodoIndexItem[]>;
  /** Notes with no resolved `target`: the third state, never folded into a page. */
  unplaced: TodoIndexItem[];
}

/**
 * Split the notes by the page they are attached to (bean `lwjc`).
 *
 * Input order is kept within each page, for the same reason
 * {@link renderTodoListing} never sorts. A page with no note gets NO entry, so
 * "nothing here" stays an absence rather than an empty section.
 */
export function groupTodosByPage(items: readonly TodoIndexItem[]): TodosByPage {
  const pages = new Map<string, TodoIndexItem[]>();
  const unplaced: TodoIndexItem[] = [];
  for (const item of items) {
    const page = item.target?.page;
    if (page === undefined) {
      unplaced.push(item);
      continue;
    }
    const list = pages.get(page);
    if (list) list.push(item);
    else pages.set(page, [item]);
  }
  return { pages, unplaced };
}

/**
 * The include file a page's listing is written to, under
 * `_includes/generated/todo-listing/`. A page key is a site path
 * (`guides/beans-and-todos`); `/` becomes `__` so every fragment is one file in
 * one directory.
 */
export function todoListingFileFor(page: string): string {
  return `${page.replace(/\//g, "__")}.html`;
}

/**
 * HTML-escape, including both quote characters.
 *
 * `'` is escaped as well as `"` because an attribute value in this file may
 * legitimately be single-quoted by a later edit, and an escaper that is only
 * correct for today's quoting style is one refactor from a hole.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Paragraphs, split on blank lines — the same split `docs-ui.js` performs. */
function paragraphs(text: string): string[] {
  return String(text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

function metaRow(label: string, value: string): string {
  return `        <dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
}

function renderItem(item: TodoIndexItem, opts: TodoListingOptions): string {
  const lines: string[] = [];
  // `data-fa-todo` is how `docs-ui.js` finds the slot it is overlaying. The
  // board does not REPLACE this element — see `board-windows`: an action whose
  // inverse is not reachable is not a toggle, and a listing the board removed
  // would have no way back with the board open.
  lines.push(
    `    <li class="fa-todo-listing-item" id="fa-todo-listing-${escapeHtml(item.id)}" ` +
      `data-fa-todo="${escapeHtml(item.id)}">`,
  );
  lines.push(`      <h3 class="fa-todo-listing-summary">${withInlineCode(item.summary, escapeHtml)}</h3>`);
  lines.push(`      <dl class="fa-todo-listing-meta">`);
  lines.push(metaRow("Status", item.status));
  lines.push(metaRow("Priority", item.priority));
  if (item.origin !== undefined) lines.push(metaRow("Raised by", item.origin));
  lines.push(metaRow("Created", item.createdAt));
  if (item.target !== undefined) {
    // The parts, never the composite: `target` exists precisely so a consumer
    // — this one included — never splits `sec:<page>-<node>` to find out which
    // page a note is on. See `schemas/sdlc/todo-index.ts`.
    const { page, node } = item.target;
    // The caller's own composition, still checked: `gen-docs-pages.ts` passes a
    // Liquid `relative_url` call, which `safeHref` reads as a relative
    // reference and lets through — so the check costs the legitimate case
    // nothing and refuses the one that matters.
    const href = safeHref(opts.pageHref?.(page, node));
    const text = `${escapeHtml(page)} &rsaquo; ${escapeHtml(node)}`;
    lines.push(
      `        <dt>About</dt><dd>` +
        (href === undefined ? text : `<a href="${href}">${text}</a>`) +
        `</dd>`,
    );
  } else if (item.targetLabel !== undefined) {
    // A label that resolved to no block in this build. Reported rather than
    // dropped, and rather than guessed at by splitting the string.
    lines.push(
      `        <dt>About</dt><dd><code>${escapeHtml(item.targetLabel)}</code> ` +
        `<span class="fa-todo-listing-unresolved">(no block in this build carries this label)</span></dd>`,
    );
  }
  lines.push(`      </dl>`);

  const paras = paragraphs(item.comment);
  lines.push(`      <div class="fa-todo-listing-body">`);
  if (paras.length === 0) {
    // A determined empty, said as one. "No detail recorded" and "the detail
    // failed to load" are opposite facts and this one is the first.
    lines.push(`        <p class="fa-todo-listing-empty">No detail recorded.</p>`);
  } else {
    // Backtick spans render as <code> rather than showing their markers (bean
    // `mylx`); every piece still goes through `escapeHtml`.
    for (const p of paras) lines.push(`        <p>${withInlineCode(p, escapeHtml)}</p>`);
  }
  lines.push(`      </div>`);

  // EVERY href goes through `safeHref` — see `schemas/ui/safe-url.ts`. Escaping
  // closes tags and does nothing about a scheme, so an escaper here is the
  // wrong tool that looks like the right one. A refused URL renders as text
  // rather than as a link to nowhere (`pb04`).
  const links: string[] = [];
  // The todo's own page first: it is this site's rendering of the todo, where
  // the source links below leave the site.
  const own = safeHref(opts.todoPageHref?.(item.id));
  // Not re-escaped, like `pageHref` above: the site passes a Liquid call whose
  // single quotes must survive to Jekyll. `safeHref` has already refused a
  // scheme, and a todo id is a slug (`TodoNodeSchema`).
  if (own !== undefined) links.push(`<a href="${own}">Open this todo</a>`);
  const view = safeHref(item.viewHref);
  // data-fa-link: the platform's one recipe rebuilds these from their URLs (edit-links.js, bean v433).
  if (view !== undefined) links.push(`<a data-fa-link="source" href="${escapeHtml(view)}">View source</a>`);
  const edit = safeHref(item.editHref);
  if (edit !== undefined) links.push(`<a data-fa-link="edit" href="${escapeHtml(edit)}">Edit</a>`);
  if (links.length) {
    lines.push(`      <p class="fa-todo-listing-links">${links.join(" &middot; ")}</p>`);
  }

  if (item.relations.length) {
    lines.push(`      <ul class="fa-todo-listing-relations">`);
    for (const r of item.relations) {
      const text = `${escapeHtml(r.axis)}: ${escapeHtml(r.label)}`;
      // Same `pb04` rule as the attachment: an edge that resolved to nothing
      // is shown as text, never as a link to nowhere — and now also an edge
      // whose scheme is not one a link may carry. `TodoRelationSchema.href` is
      // `z.string()`, so the schema permits what this refuses.
      const href = safeHref(r.href);
      lines.push(
        `        <li>` +
          (href === undefined ? text : `<a href="${escapeHtml(href)}">${text}</a>`) +
          `</li>`,
      );
    }
    lines.push(`      </ul>`);
  }

  lines.push(`    </li>`);
  return lines.join("\n");
}

/**
 * The whole listing, as one HTML fragment.
 *
 * Emitted on every page, because the board is launched from every page and a
 * floor that exists only where somebody remembered to put it is not a floor.
 */
export function renderTodoListing(
  items: readonly TodoIndexItem[],
  opts: TodoListingOptions = {},
): string {
  const out: string[] = [];
  // `lang="en" dir="ltr"` (bean `giiw`): one English listing is included on
  // every locale's pages, so on an Arabic page it is English laid out as
  // English, not inheriting `dir="rtl"` from <html>.
  out.push(
    `<section class="fa-todo-listing" id="fa-todo-listing" lang="en" dir="ltr" ` +
      `aria-labelledby="fa-todo-listing-heading" data-fa-todo-scope="${opts.scope ?? "folio"}" ` +
      `data-fa-todo-count="${items.length}">`,
  );
  const scope = opts.scope ?? "folio";
  const heading = scope === "page" ? "Notes on this page" : "Open notes";
  const lead =
    scope === "page"
      ? "The notes attached to this page, in document order. Every note in this folio is on the todos board."
      : "Every note in this folio, in document order. This listing is the artefact; the board is an overlay over it.";
  out.push(
    `  <h2 class="fa-todo-listing-heading" id="fa-todo-listing-heading">` +
      `${heading} (${items.length})</h2>`,
  );
  out.push(`  <p class="fa-todo-listing-lead">${lead}</p>`);
  if (items.length === 0) {
    // Zero notes is a DETERMINED empty and says so. The failure this guards
    // against is the other one — a board that opens empty is
    // indistinguishable from a person with nothing outstanding.
    out.push(`  <p class="fa-todo-listing-none">No notes are open in this folio.</p>`);
  } else {
    out.push(`  <ol class="fa-todo-listing-items">`);
    for (const item of items) out.push(renderItem(item, opts));
    out.push(`  </ol>`);
  }
  out.push(`</section>`);
  return out.join("\n") + "\n";
}
