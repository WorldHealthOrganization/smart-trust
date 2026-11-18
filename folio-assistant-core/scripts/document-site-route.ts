/**
 * Where a document folio's site puts its PAGES and its DATA: one answer, used
 * by the site's builders and by the rendered-impact predictor (issue #2527).
 *
 * A page is under the page locale, `en/…`, as every visualiser page is
 * (`PAGE_LOCALE`, `cat-harness-tools/scripts/viewer-declarations.ts`). The
 * pages' chrome is English, so English is the one locale they are written in.
 *
 * Data a page loads stays where it was, so an address a script or another
 * site already reads still answers: a lazy page's `<slug>/blocks/NNN.json`,
 * its comment notes `<slug>/pc-notes.json`, a library entry's
 * `entries/<id>.doc.json`, the dashboard's `comments.json`, and the site's
 * `outline.json`. The landing `index.html` stays at the site root, which is
 * where a reader arrives.
 *
 * A document's images move WITH its page, to `en/<slug>/media/`: its blocks
 * link them relative to the page (`media/<file>`), and the page is what they
 * belong to.
 *
 * Every path here is site-relative, `/`-separated, with no leading slash.
 */
import { posix } from "node:path";

import { PAGE_LOCALE } from "@litlfred/cat-harness-tools/scripts/viewer-declarations.ts";

export { PAGE_LOCALE };

/** A page path under the page locale: `en/<path>`. */
export const localisedPage = (path: string): string => posix.join(PAGE_LOCALE, path);

/** The directory of a document's page: `en/<slug>`. */
export const documentPageDir = (slug: string): string => localisedPage(slug);

/**
 * Where a document's exports go, beside its page: `document-export.ts release
 * --out <site>/<documentExportDir>` writes the Word, PDF and offline files and
 * their stable `-latest` copies there, and the page's download links point at them.
 */
export const documentExportDir = (slug: string): string => `${documentPageDir(slug)}/export`;

/** A document's page: `en/<slug>/index.html`. */
export const documentPage = (slug: string): string => `${documentPageDir(slug)}/index.html`;

/** A lazy document's whole text on one page: `en/<slug>/index.hydrated.html`. */
export const hydratedPage = (slug: string): string => `${documentPageDir(slug)}/index.hydrated.html`;

/** Where a document's data stays: `<slug>`, holding `blocks/` and `pc-notes.json`. */
export const documentDataDir = (slug: string): string => slug;

/** The review page's directory: `en/review`. */
export const REVIEW_PAGE_DIR: string = localisedPage("review");

/** From a page directory to a site path, both site-relative: `en/doc` to `doc/blocks` is `../../doc/blocks`. */
export const fromPageDir = (pageDir: string, to: string): string => posix.relative(pageDir, to);

/**
 * Where a THEMED document page ends (`--document-layout`). A standalone page
 * ends at its closing body tag, and a later step (the public-comment notes)
 * adds to the page just before it. A themed page is a Jekyll page with no
 * body tag of its own, so it ends at this marker instead, inside its Liquid
 * raw block; a step that adds to a document page looks for one or the other
 * and fails when it finds neither.
 */
export const DOCUMENT_END_MARKER = "<!-- fa-doc:end -->";

/** The class every rule of a themed document page is scoped under, and its document's wrapper. */
export const DOC_CLASS = "fa-doc";
