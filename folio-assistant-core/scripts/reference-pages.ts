/**
 * The `folio-reference` kind's pages: its nodes are shown by this layer's
 * Bibliography, so the node-kind pages link there instead of drawing a
 * generic page per reference.
 *
 * @module folio-assistant-core/scripts/reference-pages
 * @graphNode none — a page renderer named by the validator node's `pages`, not a schema
 *
 * Every node kind gets pages (owner, 2026-11-13), and the schemas page links
 * them, so the kind page and its harness pages stay. What goes is the second
 * copy of every reference: a catalogue layer with thousands of extracted
 * references published a generic page for each, and a multi-megabyte index,
 * beside the Bibliography's summaries, side panel and search (owner,
 * 2026-11-15, option A: "the 7,110 generic reference pages come off").
 *
 * `nodesShownBy` is read by the node-kind page writer from
 * cat-harness-tools#2301 on. An older writer ignores it and still finds a
 * renderer (an empty `dashboard`), so a layer whose cone pins an older tools
 * commit builds and type-checks as before, generic pages and all.
 */
import { visualiserRoute } from "@litlfred/cat-harness-tools/schemas/kg/visualiser-route.ts";
import type { KindPages } from "@litlfred/cat-harness-tools/scripts/gen-node-kind-pages.ts";

/** The Bibliography visualiser this layer declares (`folio-assistant-core.json` `visualisers`). */
export const BIBLIOGRAPHY = { harness: "folio-assistant-core", visualiser: "bibliography", label: "Bibliography" } as const;

/** The Bibliography's page directory, site-relative with no trailing slash. */
export const bibliographyRoute = (locale: string): string =>
  visualiserRoute({ locale, harness: BIBLIOGRAPHY.harness, visualiser: BIBLIOGRAPHY.visualiser }).replace(/\/$/, "");

/** `KindPages.nodesShownBy`, stated here so this module type-checks against a tools pin that predates it. */
export interface NodesShownBy {
  label: string;
  route(locale: string): string;
}

export const ReferencePages: KindPages & { nodesShownBy: NodesShownBy } = {
  // No section of its own: present so a writer that predates `nodesShownBy` still reads this as a renderer.
  dashboard: () => [],
  nodesShownBy: { label: BIBLIOGRAPHY.label, route: bibliographyRoute },
};
