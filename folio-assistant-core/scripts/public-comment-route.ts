/**
 * Where a folio's public-comment dashboard is published: one answer, used by
 * the site builder, the change-set issues and the rendered-impact predictor.
 *
 * Rule 1 of the route conventions (`skills/kg/kg-core/schema-management.md`):
 * a HANDLER rendering a KIND's assets lives at
 * `<base>/<handler>/<kind>/<optional subject>`. The handler is this layer
 * (folio-assistant-core), the kind is `public-comments`, and the subject is
 * the path of the materialised document in the folio, `folio/<slug>`
 * (owner, 2026-10-07: "url for review process should be more reflective of
 * other visualize paths and IRIs … folio-assistant-core/public-comments/
 * <path to materialized document in folio>"). It was a flat
 * `public-comments/index.html` until then; a clean break, with no redirect
 * left at the old address (owner: "no deprecated/redirect links").
 */
import { join, relative } from "node:path";

import { folioDir, readDeclaration } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { localisedPage } from "./document-site-route.js";

/** This layer's declared name: the handler segment. */
export const HANDLER = (readDeclaration(join(import.meta.dir, "..")) as { name?: string } | undefined)?.name ?? "folio-assistant-core";

/** The kind segment. */
export const KIND = "public-comments";

/**
 * `<handler>/public-comments/<folio path>/<slug>`, relative to the site root,
 * no trailing slash: where the dashboard's DATA is, `comments.json`.
 */
export function dashboardRoute(repoRoot: string, slug: string): string {
  const folio = relative(repoRoot, folioDir(repoRoot)).split("\\").join("/") || "folio";
  return `${HANDLER}/${KIND}/${folio}/${slug}`;
}

/**
 * Where the dashboard PAGE is: {@link dashboardRoute} under the page locale,
 * `en/<handler>/public-comments/<folio path>/<slug>` (issue #2527). Its data
 * stays at {@link dashboardRoute}; see `document-site-route.ts`.
 */
export function dashboardPageRoute(repoRoot: string, slug: string): string {
  return localisedPage(dashboardRoute(repoRoot, slug));
}

/** From a page at `route` back to the site root: one `../` per segment. */
export function toSiteRoot(route: string): string {
  return "../".repeat(route.split("/").length);
}
