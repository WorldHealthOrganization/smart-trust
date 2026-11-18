/**
 * The classes a page opts into the shared page layout with (`page-layout.ts`).
 * Apart from that module, which reads its templates from disk, so the browser
 * bundle (`navbar-client.ts`) can name the page bar too.
 *
 * @module scripts/lib/page-layout-classes
 */
export const PAGE_BAR_CLASS = "fa-page-bar";
export const PAGE_MAIN_CLASS = "fa-page-main";
export const PAGE_FOOT_CLASS = "fa-page-foot";
/** A table that fills the content column rather than scrolling inside its own box. */
export const PAGE_WIDE_TABLE_CLASS = "fa-page-wide";
