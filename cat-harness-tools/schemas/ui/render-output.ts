/**
 * The ONE implementation of a Tool output's render hint.
 *
 * `schemas/tools/tool.ts` declares what a renderer MAY do with an output
 * ({@link RENDER_AS}); this does exactly that and no more, so a renderer that
 * puts a tool's output into a page calls this rather than deciding for itself.
 *
 * Every branch returns an HTML FRAGMENT that is safe to insert:
 *
 * - `text` (and absent) — escaped. No markup, no link, whatever the value holds.
 * - `url` — an `<a>` only when {@link safeHref} accepts the scheme; otherwise
 *   the value as escaped text. A refused URL is SHOWN, never silently dropped:
 *   a hostile value hidden reads as a missing one.
 * - `markdown` — remark with raw HTML OFF (`sanitize: true`, GitHub's schema),
 *   so `<script>` and event attributes never survive, and a link whose scheme
 *   the sanitiser refuses loses its `href`.
 * - `json` — escaped inside `<pre>`. Data is shown, never evaluated.
 *
 * @module schemas/render-output
 * @graphNode schema
 */
import { remark } from "remark";
import remarkHtml from "remark-html";

import { safeHref } from "./safe-url.js";
import type { ToolRender } from "../tools/tool.js";

/** Escape for HTML text and attribute content alike. */
export function escapeForHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render one Tool output value as its declared hint allows. Absent hint is `text`. */
export function renderToolOutput(value: string, hint?: Pick<ToolRender, "as">): string {
  switch (hint?.as ?? "text") {
    case "url": {
      const href = safeHref(value);
      return href === undefined
        ? escapeForHtml(value)
        : `<a href="${escapeForHtml(href)}" rel="noopener noreferrer">${escapeForHtml(value)}</a>`;
    }
    case "markdown":
      return String(remark().use(remarkHtml, { sanitize: true }).processSync(value)).trim();
    case "json":
      return `<pre>${escapeForHtml(value)}</pre>`;
    default:
      return escapeForHtml(value);
  }
}

/**
 * Resolve a board card's per-card detail URL when its body or tool output is
 * fetched lazily on window open rather than inlined in the board index.
 */
export function cardDetailHref(card: {
  comment?: string;
  detailHref?: string;
  bodyHref?: string;
  artifactHref?: string;
  jsonldHref?: string;
}): string | undefined {
  return (
    card.detailHref ??
    card.bodyHref ??
    card.artifactHref ??
    (!card.comment ? card.jsonldHref : undefined)
  );
}

/**
 * Render a card window's detail payload (markdown body + declared tool/skill
 * outputs) through {@link renderToolOutput} and {@link escapeForHtml}.
 */
export function renderWindowDetail(detail: {
  comment?: string;
  description?: string;
  body?: string;
  outputs?: ReadonlyArray<{
    name?: string;
    value: string;
    render?: Pick<ToolRender, "as">;
  }>;
}): string {
  const parts: string[] = [];
  const rawBody = detail.comment ?? detail.description ?? detail.body;
  if (typeof rawBody === "string" && rawBody.trim() !== "") {
    parts.push(`<div class="fa-sticky-body">${renderToolOutput(rawBody, { as: "markdown" })}</div>`);
  }
  if (detail.outputs && detail.outputs.length > 0) {
    const items = detail.outputs.map((out) => {
      const as = out.render?.as ?? "text";
      const label = out.name
        ? `<span class="fa-sticky-output-name">${escapeForHtml(out.name)}</span>`
        : "";
      return `<div class="fa-sticky-output" data-render-as="${escapeForHtml(as)}">${label}${renderToolOutput(out.value, out.render)}</div>`;
    });
    parts.push(`<div class="fa-sticky-outputs">${items.join("")}</div>`);
  }
  if (parts.length === 0) {
    parts.push(`<div class="fa-sticky-body"><p class="fa-sticky-empty">No detail recorded.</p></div>`);
  }
  return parts.join("");
}

/**
 * Two-phase board/window loader — bean `q2wm`:
 *
 * 1. `renderBoardTiles()` renders the `N` board tiles with **0** per-card
 *    detail fetches up front.
 * 2. `openWindow(id)` lazily fetches that card's detail URL on open (only when
 *    {@link safeHref} accepts the scheme; a hostile scheme is never fetched and
 *    is shown as escaped text), caches the rendered HTML per card `id` so
 *    re-opening makes **0** additional fetches and never pre-fetches the other
 *    `N - 1` cards, and renders all body/tool output through
 *    {@link renderWindowDetail} / {@link renderToolOutput}.
 */
export function createLazyWindowLoader(
  cards: ReadonlyArray<{
    id: string;
    title: string;
    comment?: string;
    detailHref?: string;
    bodyHref?: string;
    artifactHref?: string;
    jsonldHref?: string;
    outputs?: ReadonlyArray<{
      name?: string;
      value: string;
      render?: Pick<ToolRender, "as">;
    }>;
  }>,
  fetcher: (url: string) => Promise<
    | {
        comment?: string;
        description?: string;
        body?: string;
        outputs?: ReadonlyArray<{
          name?: string;
          value: string;
          render?: Pick<ToolRender, "as">;
        }>;
      }
    | string
  >,
) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const cache = new Map<string, string>();

  function renderBoardTiles(): Array<{ id: string; titleHtml: string; lazyHref?: string }> {
    return cards.map((card) => ({
      id: card.id,
      titleHtml: escapeForHtml(card.title),
      lazyHref: cardDetailHref(card),
    }));
  }

  async function openWindow(id: string): Promise<{
    id: string;
    html: string;
    fromCache: boolean;
    fetchedUrl?: string;
  }> {
    const card = byId.get(id);
    if (!card) {
      throw new Error(`Unknown card id: ${id}`);
    }
    const cached = cache.get(id);
    if (cached !== undefined) {
      return { id, html: cached, fromCache: true };
    }
    const rawHref = cardDetailHref(card);
    if (rawHref !== undefined) {
      const safeUrl = safeHref(rawHref);
      if (safeUrl === undefined) {
        const html = renderWindowDetail({
          comment: card.comment,
          outputs: [
            ...(card.outputs ?? []),
            { name: "detailHref", value: rawHref, render: { as: "url" } },
          ],
        });
        cache.set(id, html);
        return { id, html, fromCache: false };
      }
      const raw = await fetcher(safeUrl);
      const parsed =
        typeof raw === "string"
          ? (() => {
              const trimmed = raw.trim();
              if (trimmed.startsWith("{")) {
                try {
                  return JSON.parse(trimmed) as {
                    comment?: string;
                    description?: string;
                    body?: string;
                    outputs?: ReadonlyArray<{
                      name?: string;
                      value: string;
                      render?: Pick<ToolRender, "as">;
                    }>;
                  };
                } catch {
                  return { body: raw };
                }
              }
              return { body: raw };
            })()
          : raw;
      const html = renderWindowDetail({
        comment: parsed.comment ?? parsed.description ?? parsed.body ?? card.comment,
        outputs: parsed.outputs ?? card.outputs,
      });
      cache.set(id, html);
      return { id, html, fromCache: false, fetchedUrl: safeUrl };
    }
    const html = renderWindowDetail({
      comment: card.comment,
      outputs: card.outputs,
    });
    cache.set(id, html);
    return { id, html, fromCache: false };
  }

  return {
    renderBoardTiles,
    openWindow,
    isCached: (id: string) => cache.has(id),
    cacheSize: () => cache.size,
  };
}
