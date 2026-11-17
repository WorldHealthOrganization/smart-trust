/**
 * Which documentation page documents a declared directory — read from the
 * PAGES. The page says what it documents:
 *
 * | page | where it says so |
 * |---|---|
 * | generated from a `WebPage` manifest | `documents:` on the manifest, emitted into the page's front matter by `gen-docs-pages.ts` |
 * | hand-written markdown | a `documents:` front-matter list |
 * | generated HTML | `<meta name="documents" content="…">` from its generator |
 *
 * Each entry is a graph TYPOLOGY (`library`) — the page documents every directory
 * of that kind — or one directory, `<instance>/<id>`, where the kind is too
 * general to claim (`cat-harness/tools`: `tool-graph.md` is about this
 * layer's tool graph, not every `tools` directory). The same two forms, and
 * the same reach rule, as a skill's `graph-typologies:` / `governs:`
 * (`skill-governance.ts`).
 *
 * @module scripts/docs-declarations
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { frontMatterList } from "./skill-governance.js";

/** One page and what it declares it documents. */
export interface DocsPage {
  /** Repository-relative path of the page. */
  page: string;
  /** The layer directory the page lives in (its first path segment). */
  instance: string;
  /** Kinds, and `<instance>/<id>` directories. */
  documents: string[];
}

/** The `content` of `<meta name="documents">`, split on whitespace or commas. */
export function metaDocuments(html: string): string[] {
  const m = /<meta\s+name="documents"\s+content="([^"]*)"/.exec(html);
  return m ? m[1]!.split(/[\s,]+/).filter(Boolean) : [];
}

/** Every page, from the tracked `.md` and `.html` files, that declares `documents`. */
export function docsPages(repoRoot: string, files: readonly string[]): DocsPage[] {
  const out: DocsPage[] = [];
  for (const f of files) {
    const md = f.endsWith(".md");
    if (!md && !f.endsWith(".html")) continue;
    let text: string;
    try {
      text = readFileSync(join(repoRoot, f), "utf-8");
    } catch {
      continue;
    }
    const documents = md ? frontMatterList(text, "documents") : metaDocuments(text);
    if (documents.length > 0) out.push({ page: f, instance: f.split("/")[0]!, documents });
  }
  return out;
}

/**
 * The pages documenting one directory: those naming it (`<instance>/<id>`),
 * or naming one of its kinds from a layer in reach.
 */
export function documentingPages(
  dir: { instance: string; id: string; graphTypologies: readonly string[] },
  pages: readonly DocsPage[],
  repoRoot: string,
  reach: readonly string[],
): string[] {
  const inReach = new Set(reach.map((r) => resolve(r)));
  return pages
    .filter(
      (p) =>
        p.documents.includes(`${dir.instance}/${dir.id}`) ||
        (p.documents.some((d) => !d.includes("/") && dir.graphTypologies.includes(d)) &&
          inReach.has(resolve(repoRoot, p.instance))),
    )
    .map((p) => p.page)
    .sort();
}
