/**
 * A published static site, as a graph: what a CDN serves, at which routes.
 *
 * @module schemas/site
 * @graphNode schema
 *
 * Two kinds, one per capability tier:
 *
 * - **`basic-cdn-site`** — a CDN that serves files by path and nothing else:
 *   no MIME-type mapping, no redirects, no headers. GitHub Pages is one (its
 *   `gh-pages` Tool says so: *"Pages cannot serve server-side redirects or
 *   custom headers"*).
 * - **`cdn-site`** — the same, plus the three a real CDN adds, for a
 *   downstream layer's CDN deployment.
 *
 * ## A site is an archive with routes
 *
 * A site's files are {@link ArchiveEntrySchema} entries, and what a site adds
 * over an archive is the ROUTE layout: the release root, where staging
 * previews sit, and the per-instance sub-sites.
 *
 * ## Where a site comes from, and where it goes
 *
 * A site is `derived`: it is built from the renderable graphs its directory's
 * `derivedFrom` names, by a build Tool (locally, `site-build-local`; in CI,
 * `pages-publish` — two Tools, one skill), and put on its CDN by the Tool its
 * `storage.tool` names (`gh-pages`). Generators are code, not graphs, so the
 * build Tools are reached by the skill they satisfy, never by `derivedFrom`.
 */
import { z } from "zod";

import { ArchiveEntrySchema } from "../library/archive-contents.js";
import { nodeKind } from "./node-kind.js";

/**
 * Node kinds since #2195's gate (`node-kinds:check` refuses a new family with
 * no `nodeKind()`), so the short SemVer names the owner chose for kinds
 * (2026-10-05): the name is the URL segment, the version lives in `$schema`.
 * No document carried the earlier `folio-*-site/v1` tags, so nothing is
 * retagged.
 */
export const BASIC_CDN_SITE_SCHEMA_ID = "basic-cdn-site/1.0.0";
export const CDN_SITE_SCHEMA_ID = "cdn-site/1.0.0";

/** A path within the site: relative, no leading slash, ending `/` for a directory route. */
const SitePath = z
  .string()
  .regex(/^(?!\/)[^\s]*$/, "a site path is relative to the site root and carries no leading slash or whitespace");

/** One layer's sub-site: the route it answers at, and the layer it is. */
export const SubSiteSchema = z
  .object({
    path: SitePath,
    instance: z.string().min(1),
  })
  .strict();

/**
 * Where a site's routes sit. `release` is the published root; `previews` is a
 * route TEMPLATE whose one `<slug>` segment names a staged branch.
 */
export const SiteRoutesSchema = z
  .object({
    release: SitePath,
    previews: SitePath.refine((p) => (p.match(/<slug>/g) ?? []).length === 1, {
      message: "the previews route is a template with exactly one `<slug>` segment",
    }).optional(),
    subSites: z.array(SubSiteSchema).optional(),
  })
  .strict();

/** The commit a published site was built from — the back-link every off-main graph carries (bean r6es). */
export const SiteBuiltFromSchema = z
  .object({
    ref: z.string().min(1),
    sha: z.string().regex(/^[0-9a-f]{7,40}$/),
  })
  .strict();

const siteShape = {
  /** The site's root URL. */
  "@id": z.string().url(),
  routes: SiteRoutesSchema,
  builtFrom: SiteBuiltFromSchema.optional(),
  /** The files served — archive entries, since a site is an archive with routes. */
  files: z.array(ArchiveEntrySchema).optional(),
};

/** A site on a CDN that serves files by path and nothing more. */
export const BasicCdnSiteKind = nodeKind(BASIC_CDN_SITE_SCHEMA_ID, [], siteShape);
export const BasicCdnSiteSchema = BasicCdnSiteKind.schema.strict();
export type BasicCdnSite = z.infer<typeof BasicCdnSiteSchema>;

/** A media type the CDN serves for paths matching a glob. */
export const MimeTypeRuleSchema = z.object({ match: z.string().min(1), contentType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/) }).strict();

/** A server-side redirect. */
export const RedirectRuleSchema = z
  .object({
    from: SitePath,
    to: z.string().min(1),
    status: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]),
  })
  .strict();

/** A response header set on paths matching a glob. */
export const HeaderRuleSchema = z.object({ match: z.string().min(1), name: z.string().regex(/^[A-Za-z0-9-]+$/), value: z.string() }).strict();

/** A site on a CDN that also controls media types, redirects and headers. */
/**
 * A SUBCLASS of {@link BasicCdnSiteKind}: everything a basic site carries,
 * plus control over media types, redirects and headers.
 */
export const CdnSiteKind = nodeKind(CDN_SITE_SCHEMA_ID, [BasicCdnSiteKind], {
  mimeTypes: z.array(MimeTypeRuleSchema).optional(),
  redirects: z.array(RedirectRuleSchema).optional(),
  headers: z.array(HeaderRuleSchema).optional(),
});
export const CdnSiteSchema = CdnSiteKind.schema.strict();
export type CdnSite = z.infer<typeof CdnSiteSchema>;
