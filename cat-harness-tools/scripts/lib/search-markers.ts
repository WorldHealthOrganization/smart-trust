/**
 * The two `<meta>` markers that tell the site's search what a page is, named
 * once and imported by the writer (`lib/site-bar.ts`) and the readers
 * (`search-split.ts`; `publish-verify.ts` keeps its own copy of the first).
 *
 * A LEAF: it imports nothing. `search-split.ts` runs under Node as well as Bun
 * (the Playwright specs import `buildIndex` from it), and `lib/site-bar.ts`
 * pulls in `page-layout.ts`, which reads Bun's `import.meta.dir` when it loads.
 * Importing the marker from `site-bar.ts` broke every Node import of
 * `search-split.ts` (#2428, measured 2026-11-18: `test/search-scoped.e2e.ts`
 * stopped loading).
 *
 * @module scripts/lib/search-markers
 * @graphNode none — two string constants the search writers and readers share
 */

/** The marker `publish-verify` reads for a page left out of the theme's search index on purpose. */
export const SEARCH_EXCLUDE_META = '<meta name="fa-search-exclude" content="true">';

/**
 * The marker for a page the theme's index cannot hold but the SITE's search
 * should: a mounted layer's own HTML, laid out by its own generator, such as
 * a handbook under `/en/<layer>/`. `search-split.ts` reads each such
 * page of the built site and adds its sections to the index before cutting
 * the scopes (owner, 2026-11-17: "we've lost some of the search indexing
 * features and layered knowledge graph"; measured that day: one handbook site
 * indexed 0 of its handbook's pages). The page keeps
 * {@link SEARCH_EXCLUDE_META} too, because a tree that is never split (a
 * build that stops before `search-split`) still has the theme's index only.
 */
export const SEARCH_POST_BUILD_META = '<meta name="fa-search-post-build" content="true">';
