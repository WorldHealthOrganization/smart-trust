/**
 * ig-menu.ts — a FHIR IG's own navigation, as data.
 *
 * ## Why this exists
 *
 * The owner, 2026-09-23, with a screenshot of WHO SMART Trust's published top
 * bar: *"navar menu is now on LHS"*. The menu could not be rendered anywhere,
 * because it was **not held**: the WHO SMART Trust IG's `fhir-artifact-index/index.json`
 * carries 674 artefacts harvested from gh-pages and no `menu`, and no raw HTML
 * was retained. Measured the same day, the twelve labels visible in that
 * screenshot matched **0 of 674** artefact titles — the harvest kept the IG's
 * FHIR artefacts and dropped both its navigation and the narrative pages that
 * navigation points at.
 *
 * `SushiConfigLogicalModel` already modelled the shape (`menu: array`,
 * *"Navigation menu structure for the IG"*, with `subItems`), so the schema was
 * never the gap. This is the gap: somewhere to put the data, with provenance.
 *
 * ## It is INGESTED, never transcribed
 *
 * The obvious shortcut was to type the menu out of the screenshot. Refused,
 * and the reason generalises past this case:
 *
 * - **A screenshot carries no hrefs.** Writing them means guessing URLs into a
 *   published artefact, and a guessed link is worse than an absent one — it
 *   resolves for a reader and lands somewhere nobody chose.
 * - **A closed dropdown and an empty menu look identical.** Three of the five
 *   were shut in that picture, so a capture made from it could not tell "this
 *   item has no children" from "the picture was taken with it closed". That is
 *   the `dh4f` distinction arriving at the point of capture rather than at the
 *   point of reporting.
 *
 * `wjfu` had already set the rule for this corpus: *"Generated from the KG,
 * never transcribed."*
 *
 * ## The provenance is a DIFFERENT source from the artefact index's
 *
 * `index.json` says `{kind: "gh-pages", of: <published site>}` — it is the
 * IG's OUTPUT. A menu comes from `sushi-config.yaml`, which is the IG's
 * SOURCE, in a git repository, at a commit. Two sources, two provenance
 * blocks, and folding the menu into `index.json` would give one file two
 * answers to "where did this come from".
 *
 * @graphNode schema
 * @module schemas/ig-menu
 */

import { z } from "zod";

export const IG_MENU_SCHEMA_TAG = "folio-ig-menu/v1";

/**
 * Where a menu was read from.
 *
 * `ref` is a commit SHA and is PROVENANCE, not a reference a consumer resolves
 * — `instance-versioning.md` §3.3's distinction, and the reason
 * `check:published-refs` classifies by key rather than by the look of the
 * value. It records which bytes this menu was read out of; nobody is being
 * asked to fetch it.
 */
export const IgMenuSourceSchema = z.object({
  kind: z.literal("sushi-config"),
  /** The repository the config was read from. */
  of: z.string().url(),
  /** The commit it was read at. Provenance. */
  ref: z.string().min(7),
  /** The path within that repository. */
  path: z.string().min(1),
  readAt: z.string().min(4),
});

/**
 * One leaf: a label and the page it opens.
 *
 * `href` is kept EXACTLY as `sushi-config.yaml` writes it — a bare
 * `index.html`, relative to the IG's canonical base. Resolving it here would
 * bake one base into the data and make the file wrong the moment the same IG
 * is read from a preview or a mirror. The consumer joins it to `canonical`.
 */
export const IgMenuItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

/**
 * One top-level group — a dropdown in the IG's top bar.
 *
 * `items` is REQUIRED and may be empty, and the two are different facts: `[]`
 * is a group `sushi-config.yaml` declares with no children, which is legal.
 * There is deliberately no third "unknown" state here, because an ingest from
 * the source config always knows — the uncertainty belonged to the screenshot
 * capture this schema exists to avoid.
 */
export const IgMenuGroupSchema = z.object({
  label: z.string().min(1),
  /** Set when the group itself is a page rather than only a container. */
  href: z.string().min(1).optional(),
  items: z.array(IgMenuItemSchema),
});

export const IgMenuSchema = z.object({
  $schema: z.literal(IG_MENU_SCHEMA_TAG),
  /** The IG's `id` from `sushi-config.yaml`, e.g. `hl7.fhir.uv.ips`. */
  id: z.string().min(1),
  /** Its `canonical`, the base every `href` is relative to. */
  canonical: z.string().url(),
  version: z.string().min(1).optional(),
  source: IgMenuSourceSchema,
  groups: z.array(IgMenuGroupSchema),
});

export type IgMenu = z.infer<typeof IgMenuSchema>;
export type IgMenuGroup = z.infer<typeof IgMenuGroupSchema>;
export type IgMenuItem = z.infer<typeof IgMenuItemSchema>;

/**
 * The absolute URL a menu entry opens.
 *
 * One function so the join is written once: every consumer that composed
 * `canonical + "/" + href` by hand would be a place a double slash or a
 * missing one could appear, and a broken link in a navigation bar is the kind
 * of defect a reader hits before any test does.
 */
export function menuHref(menu: Pick<IgMenu, "canonical">, item: { href: string }): string {
  if (/^https?:\/\//.test(item.href)) return item.href;
  return `${menu.canonical.replace(/\/+$/, "")}/${item.href.replace(/^\/+/, "")}`;
}

/** Total leaves across every group — the count a report should quote. */
export function menuItemCount(menu: Pick<IgMenu, "groups">): number {
  return menu.groups.reduce((n, g) => n + g.items.length, 0);
}
