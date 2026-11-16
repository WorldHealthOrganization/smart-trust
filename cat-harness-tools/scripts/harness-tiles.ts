/**
 * One fat, themed navbar tile per INITIATED HARNESS, with its stats and its
 * existing visualisations, bootstrap at the bottom.
 *
 * @module scripts/harness-tiles
 *
 * **Nothing here renders a graph.** A tile LINKS to a viewer that already
 * exists, and where none exists it says so rather than linking somewhere.
 *
 * ## "Bootstrap at bottom" is DECLARED, not a name literal
 *
 * Bootstrap's declaration carries a `renderExemption` (*"bootstrap IS the
 * navbar footer"*), so the ordering reads {@link isExemptFrom}`(decl,
 * "visualiser")` rather than testing for the string `bootstrap`. An instance
 * exempt from owing a visualiser is exactly one whose tile has nothing to
 * open.
 *
 * ## A link is DECLARATION-driven and PRESENCE-checked
 *
 * The declaration supplies the CANDIDATES — a layer's declared graphs are
 * the only things a tile may claim to show — and the disk decides whether
 * each one is a LINK or a gap. A candidate with no page is reported, never
 * linked: a dead link is worse than none.
 *
 * ## The tone comes from the layer's OWN THEME, else the AVATAR's
 *
 * When the sticky a layer contributes about itself resolves to a theme
 * THE LAYER DECLARES ITSELF (by reference, owner first — `themeByRef`; not
 * one of the platform's shared themes), the tile's `tone` is the HUE of that
 * theme's `accent` (`hexHue`). Otherwise it is the avatar's hue angle
 * (`schemas/content/avatars.ts`), so there is no second colour vocabulary
 * beside `schemas/ui/theme.ts`. `toneFrom` says which answer was used. A
 * layer with no avatar of its own takes `GENERIC`, which is reported as a
 * finding rather than rendered as a blank.
 *
 * A tone is a HUE and nothing more: the tile's words (title, counts, viewer
 * names) carry its state, so colour is never the only channel (WCAG SC 1.4.1).
 */
import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { BLANK_AVATAR, GENERIC, avatarFor, hasAvatar } from "../schemas/content/avatars.js";
import { hexHue, resolveThemeBackdrop } from "../schemas/ui/theme.js";
import { PLATFORM_THEME_OWNER, themeByRef } from "../schemas/ui/theme-by-ref.js";
import { instantiatedHarnessNames } from "../schemas/kg/harness-config.js";
import { flattenDependencies } from "../schemas/kg/dependency-order.js";
import {
  type CatHarnessDeclaration,
  type NavbarIcon,
  artefactStub,
  resolveNavbarIcons,
  findDeclarationFile,
  isExemptFrom,
  readDeclaration,
  siteDirFor,
  visualisationsOf,
  visualisationResolves,
  defaultGraphTypologies,
  instanceDirectories,
  nestedDirectories,
} from "../schemas/kg/cat-harness.js";
import { declaredVisualisers, existingPageDir, pageParts, withViewers } from "./viewer-declarations.js";
import { aliasRoute, visualiserRoute } from "../schemas/kg/visualiser-route.js";
import { subscribedHarnesses, subscribedTile } from "./subscribed-harnesses.js";
import { labelVisualisations, nameInstanceRoot } from "./lib/nav-label.js";
import type { HarnessMark } from "./lib/harness-mark.js";
import { publishedPagePath } from "./lib/jekyll-permalink.js";
// A cycle (mount-instance-docs → lib/foreign-site-scope → here), safe because
// both sides only call each other's hoisted functions, never at load time.
import { mountedKindRoutes } from "./mount-instance-docs.ts";
// The `folio` graph typology is registered by CORE. This module is a LIBRARY, so it
// does NOT import that registration: a library's edge is inherited by every
// module that imports it, and the harness may not depend on core. The
// COMMAND that runs carries it — and since #840 every caller does, because
// the trigger sits at the foot of `cat-harness.ts` and a reader lives in that
// module, so loading it is a precondition of calling one.
//
// THIS COMMENT NAMED `check:composition-roots` AS THE GUARANTEE UNTIL
// 2026-09-22, in SEVEN files, AND THAT SCRIPT DOES NOT EXIST. `bun run
// check:composition-roots` exits "Script not found". The safety argument for
// a library omitting the registration rested on a gate nobody built, and no
// gate failed to say so — the same silence this repository keeps paying for.
// It is moot now rather than fixed: #840 made the registration automatic, so
// there is no longer a command that can forget it (bean `z9ax`).

/** One number a tile shows as an icon with a badge. */
export type HarnessStat = {
  /** Stable id, so the template picks the glyph rather than parsing a label. */
  id: "directories" | "kinds" | "views";
  /** What a reader is told the number counts. Goes in the accessible name. */
  label: string;
  value: number;
};

/** One viewer a tile can open, or one it cannot. */
export type HarnessVisualisation = {
  /** The declared graph typology this shows. */
  kind: string;
  /**
   * What every surface CALLS this row — set by `labelVisualisations` in
   * `lib/nav-label.ts`, and never composed by a surface (bean `ob3m`,
   * finding 6: "One name everywhere"). The kind's display name, or, where two
   * of this layer's kinds share one page, the display name of the kind its
   * directories declare first, so that page has one name.
   */
  label?: string;
  /**
   * Set when this kind's page is the SAME destination as another kind's row
   * of this layer, and names that kind — or, when the page is the
   * layer's own root, names the HARNESS (`nameInstanceRoot`). A list of
   * destinations skips the row, so one page is listed once, under one name.
   */
  sameAs?: string;
  /**
   * The kind this one is a sub-graph of, from the registry's `within`
   * (issue #1164). Every list of kinds draws it inside that kind's row,
   * folded shut. Absent for a top-level kind.
   */
  within?: string;
  /** Site-root-relative, for `relative_url`. Absent when nothing is published. */
  path?: string;
  /**
   * The kind's content is materialized: openable, and not editable here.
   *
   * ## The two greys, at this level
   *
   * Absent {@link path} and `readOnly` both render inert and mean different
   * things: the first has nothing to open, the second opens and refuses an
   * edit. The second is the one that offers the copy-out, so collapsing them
   * takes away the only route to working on frozen content.
   *
   * ABSENT IS THREE THINGS AT ONCE HERE, and all three are honestly absent:
   * no directory declaring this kind has answered; or they disagree, which is
   * reported as its own finding rather than resolved by a rule; or nothing
   * here is materialized. None of them is "writable", so none of them earns a
   * `false`.
   */
  readOnly?: boolean;
  /**
   * WHY this row is inert, in the words a reader sees — absent when
   * {@link path} is present, because a row that opens owes no explanation.
   *
   * ## Why the note is DATA and not a word the navbar picks
   *
   * "No viewer" is four states, and this function already separates them a
   * few dozen lines down in order to word four different findings:
   * `stagingOnly` and a declared `renderExemption` are INTENDED, `undiscovered`
   * is built-and-unreachable, `unbuilt` is nobody-built-it. Until now that
   * classification reached the reader only as prose inside a collapsed
   * `<details>` of "gaps", while the navbar row it describes said nothing at
   * all on one surface and `title="declared, with no published viewer"` on
   * the other — one wording for four states, and wrong for two of them.
   *
   * That is the mistake this file has already paid for twice, in the two
   * comments above about `staging-only` and `renderExemption`: **an intended
   * state reported as a defect is the same disease as a real gap hidden.** A
   * navbar that labelled a staging-only row "no viewer yet" would be making
   * it a third time, on the surface a reader is actually looking at.
   *
   * So the note is computed HERE, where the four states are already told
   * apart, and both navbars render what they are given. Neither composes it,
   * which is what keeps them one navbar rather than two that agree by
   * maintenance.
   */
  note?: string;
  /**
   * The page this row opens is WITHHELD from the canonical deploy.
   *
   * `compose-docs.ts` lays a `publish: "staging-only"` page into the site only
   * under `--staging`, so on the canonical build the file exists in the SOURCE
   * and not in the published tree. `path` is resolved against the source, so
   * it is present and correct and the link is still dead.
   *
   * The graph TILE has carried this since `graphTiles` was written, and
   * `docs-ui.js` skips such a tile unless the page says it is a staging
   * preview — its own comment: *"Conflating them would let 'show hidden'
   * resurrect a link to a 404."* The navbar's folder list carried it nowhere
   * and linked `fsh-guts` on the canonical site, which is that 404 arriving by
   * the other door. Measured 2026-09-23 by sweeping a canonical-shaped local
   * build: 1 of 387 sidebar links.
   *
   * Absent means "publishes normally". It is not a third state: a page that is
   * withheld says so, and everything else is published.
   */
  stagingOnly?: true;
};

/** A fat navbar tile for one initiated harness. */
export type HarnessTile = {
  name: string;
  title: string;
  /**
   * What the tile SAYS, which is `title` unless another tile says the same.
   *
   * Owner, 2026-09-21, on the sidebar: two tiles both read `folio-assistant` —
   * the repository root acting as a layer, and `cat-harness`, whose
   * declared title is the product's name. Both link `/`, so a reader could not
   * tell which one they were about to open, or that they were two.
   *
   * A title is a person's choice and is not required to be unique; a LABEL in
   * a list of links has to be, or it is not a label. So the disambiguation
   * happens where the whole set is visible — {@link disambiguate} — rather
   * than by forbidding a title somebody chose.
   */
  label: string;
  description: string;
  /** The reader's one line, when declared (`ob3m` 4/5). The landing prefers it to {@link description}. */
  summary?: string;
  /** Other spellings of the name, rendered as a list (`ob3m` 5). */
  alsoWritten?: readonly string[];
  /**
   * Exempt from owing a visualiser — the declared reason bootstrap sorts
   * last. See the module docs.
   */
  footer: boolean;
  icon: { src: string; title: string } | null;
  /**
   * Which icons this layer's navbar row shows, after inheritance.
   *
   * OPTIONAL, and absent means UNDETERMINED — neither this layer nor
   * anything it needs nor the site owner has decided. `[]` is a different
   * answer and means "show none", which the owner asked for by name. A
   * consumer that renders the two the same reports an un-migrated layer as
   * a deliberate one.
   */
  navbarIcons?: NavbarIcon[];
  /**
   * The mark the navbar renders — THE one answer every navbar surface reads
   * (bean `2vpn`): the theme avatar if there is one, else the layer's own
   * icon, else its glyph from the avatar registry. An image carries `src` (and
   * its crop, both declared and solved); a glyph carries `glyph`, SVG path data
   * in a 24×24 box. Absent only when a layer has none of the three — and
   * the navbar then draws an INITIAL, which is a different answer from a broken
   * image and from a placeholder glyph.
   *
   * Until 2026-10-04 the glyph was not a candidate, and the mounted and viewer
   * pages read `icon` rather than this field, so the IRIS replica — whose mark is a
   * glyph since the owner removed its emblem — drew the letter "W" on every
   * page while declaring a mark. Consumers turn this into a navbar item with
   * `navMarkFields` (`lib/harness-mark.ts`) and nothing else.
   */
  mark?: HarnessMark;
  /**
   * THE PAGE GROUND — this layer's theme art behind every one of its docs
   * pages (bean `yj32`, owner card Q-DEP-2 A, 2026-11-01: "behind every docs
   * page").
   *
   * `scopes` are the URL segments that make a page this layer's, matched
   * with `contains` by `_includes/page_ground.html` — the same rule the
   * layer webpage theme already uses (`/<name>/`), plus the site mount.
   * The FIRST tile that matches wins, and tiles come dependents first, so the
   * content layer a page is about beats the platform that renders it
   * (`/en/cat-harness/processes/<content layer>/` is that layer's page).
   * `siteDefault` marks the site owner, whose mount is `/`: its ground is the
   * fallback for a page no scope claims, never a scope itself, because `/`
   * is in every URL and would claim them all.
   *
   * `art` is all three crops or absent: absent means this layer's theme
   * has no backdrop (or no theme), and its pages get NO ground rather than
   * the owner's — a palette-only theme is a choice. The scrim is the page's
   * own (`docs-ui.css`, `.fa-page-ground`), not the theme's sticky scrim,
   * because the ink it protects is the page's ink, not the card's.
   */
  pageGround?: {
    scopes: string[];
    siteDefault?: true;
    art?: Record<"mobile" | "laptop" | "card", string>;
    title?: string;
  };
  /**
   * Hue angle — the tile's theme. From the layer's own theme accent when it
   * resolves one, else from the avatar registry; {@link toneFrom} says which.
   */
  tone: number;
  /** Where {@link tone} came from: the layer's own theme accent, or the avatar registry. */
  toneFrom: "theme" | "avatar";
  /** What the avatar reads as, for the accessible name. */
  reads: string;
  /** Whether the avatar is the layer's own or the generic fallback. */
  genericAvatar: boolean;
  /**
   * INSTANTIATED here, rather than merely present as a dependency.
   *
   * The owner, 2026-09-21: *"only the instiatiated harnesses (not all
   * dependent ones) in teh folio... so repo root has
   * `<harness>.config.json`"*. So the signal is the config at the
   * instantiation root, not the declaration: `harness.json` says what a
   * layer DECLARES, and the config says that the layer is instantiated
   * HERE. Two different facts, and the navbar could not be derived from the
   * declarations alone.
   */
  instantiated: boolean;
  /**
   * Where the tile GOES when clicked — the layer's own themed root when it
   * has one, else its first viewer, else absent and the tile is not a link.
   */
  href?: string;
  /**
   * What {@link href} points AT, which is three different kinds of thing:
   *
   * - `folio`   — the layer's own themed root
   * - `section` — its own section of the landing page, for an INSTANTIATED
   *               layer with no folio. Before `viewer`, so a harness row
   *               never takes the name of a graph's page (bean `ob3m` 6).
   * - `viewer`  — a kind handler's view of one of its graphs
   * - `handled` — one of the layer's OWN files, published for it by the
   *               site build and named by its `renderExemption.reachableAt`.
   *               Only a render-exempt layer can have this, and it is the
   *               last resort.
   */
  hrefKind?: "folio" | "section" | "viewer" | "handled";
  stats: HarnessStat[];
  visualisations: HarnessVisualisation[];
  /**
   * Every graph this layer declares, each marked LOCAL or REMOTE — `603s`'s
   * last open item: *"a tab for all materizled local subgraphs and declared
   * remote graphs. opening up content should indicate if local or remote"*.
   * See {@link subgraphsOf}.
   */
  subgraphs: HarnessSubgraph[];
  /**
   * The layers this one sits on, as declared. `undefined` is UNDETERMINED
   * — nobody has said — and is a different answer from `[]`, which is a
   * layer asserting it sits on nothing.
   */
  needs?: readonly string[];
  /** Candidates with no published page, and any other honest gap. */
  findings: string[];
};

/**
 * One graph a layer declares, and WHERE it is.
 *
 * `local` — its bytes are in this checkout, at `path` (repository-relative —
 * the caller rebases the declaration's instance-relative path).
 * `remote` — it is declared and lives elsewhere, at `url`: a `remoteGraphs`
 * entry, or a `subscriptions` entry pinned at `ref`, whose `materialised`
 * subgraphs have been copied in and are local copies of something remote.
 *
 * The distinction must SHOW (`603s`): *"a remote graph that renders
 * identically to a local one is how somebody edits a copy that is not the
 * source."*
 */
export type HarnessSubgraph =
  | { readonly id: string; readonly kinds: readonly string[]; readonly where: "local"; readonly path: string }
  | {
      readonly id: string;
      readonly kinds: readonly string[];
      readonly where: "remote";
      readonly url: string;
      readonly via: "remote-graph" | "subscription";
      /** A subscription's pinned commit, abbreviated for display. */
      readonly ref?: string;
      /** A subscription's subgraphs copied into this checkout. */
      readonly materialised?: readonly string[];
    };

/**
 * The graphs a layer declares, local first, then remote — `603s`.
 *
 * READ, never scanned: local rows are the declared directories (`dirs`, the
 * same list the "declared directories" stat counts, so the two cannot
 * disagree), remote rows are `remoteGraphs` and `subscriptions` as declared.
 * Each list keeps its declared order within its half.
 *
 * Owner's ruling `owt6` (*"dividers, not a dashboard"*) is why this feeds the
 * page a harness tab OPENS (`_includes/harness_details.html`) rather than the
 * sidebar.
 */
export function subgraphsOf(
  decl: Pick<CatHarnessDeclaration, "remoteGraphs" | "subscriptions">,
  dirs: readonly { id: string; path: string; graphTypologies?: readonly string[] }[],
): HarnessSubgraph[] {
  const local: HarnessSubgraph[] = dirs.map((d) => ({
    id: d.id,
    kinds: [...(d.graphTypologies ?? [])],
    where: "local" as const,
    path: d.path,
  }));
  const remote: HarnessSubgraph[] = [
    ...(decl.remoteGraphs ?? []).map((g) => ({
      id: g.id,
      kinds: [...g.graphTypologies],
      where: "remote" as const,
      url: g.url,
      via: "remote-graph" as const,
    })),
    ...(decl.subscriptions ?? []).map((sub) => ({
      id: sub.id,
      kinds: [] as string[],
      where: "remote" as const,
      url: `https://github.com/${sub.repository}/tree/${sub.ref}`,
      via: "subscription" as const,
      ref: sub.ref.slice(0, 7),
      ...(sub.subgraphs?.length ? { materialised: [...sub.subgraphs] } : {}),
    })),
  ];
  return [...local, ...remote];
}

/**
 * A declared icon's path, as the PUBLISHED site serves it.
 *
 * ## The defect this replaced, measured on the served bytes
 *
 * Owner, 2026-09-21: *"broken image on LHS navbar"*. Read out of
 * `origin/gh-pages`, because egress to the published site is blocked from the
 * build container and the branch is the only place the served bytes can be
 * had:
 *
 * ```
 * <img class="fa-harness-tile__mark"
 *      src="/folio-assistant/branches/<branch>/docs/assets/img/icons/cat-mark.svg">
 * ```
 *
 * `docs/` is the layer's site directory, and the site build copies that
 * directory's CONTENTS to the mount — so the declared prefix is exactly what a
 * published URL does not carry. Every reader got a 404 and a placeholder.
 *
 * The old helper was handed the wrong KIND of value and could never have
 * stripped anything: `siteDir` is ABSOLUTE
 * (`/…/cat-harness/docs`) while `icon.src` is relative to the layer
 * (`docs/assets/…`), so the prefix test was false for every input. A helper
 * that silently passes everything through is indistinguishable from one that
 * is working, which is why this now takes the layer's own directory and
 * derives the prefix from its OWN declaration.
 *
 * ## Two parts, because a layer is not always at the site root
 *
 * The published path is the layer's mount plus the asset's path with its
 * site directory removed. A layer whose mount is unknown gets **no icon at
 * all** — the `pb04` rule one layer down: an `<img>` whose `src` 404s is worse
 * than no `<img>`, because a placeholder reads as a broken site rather than as
 * a layer with no art.
 *
 * ## `folioRoot` IS THE WRONG MOUNT FOR THIS, and it shipped
 *
 * This took `folioRoot` — *"`/` for the instance that owns the site,
 * `/<name>/` for one mounted beneath it"* — and that is the layer's FRONT
 * DOOR, which is a different question from where its SITE DIRECTORY lands.
 *
 * MEASURED by running the mount rather than by reading either file:
 *
 *     <iris>/library/  ->  /<iris>/        (1378 files)
 *     <iris>/docs/     ->  /docs/<iris>/   (4 files)
 *
 * (`<iris>` being the IRIS replica layer.)
 *
 * `mount-instance-docs` gives every layer a `<kind>/<name>` route
 * unconditionally and a bare `<name>` route to whichever kind claims it first.
 * For the IRIS replica that is the **library**, so `/<iris>/` serves 1,378 corpus
 * files and the front door is not the docs at all. The icon composed against
 * it 404s — confirmed, 404 against 200 for the same asset at
 * `/docs/<iris>/assets/img/who-emblem.svg`.
 *
 * So this composes against the route the site directory ACTUALLY takes: the
 * unconditional `<kind>/<name>` one, from the kind the layer declares for
 * that directory. The site owner keeps `/`, because its docs are the site
 * root and are not mounted at all.
 *
 * The local preview hid it: `preview:site` does not run the mount, so the
 * asset was missing there for an unrelated reason and the wrong URL looked
 * like the same 404.
 */
function publishedIcon(
  instanceDir: string,
  src: string,
  siteMount: string | undefined,
): string | undefined {
  if (siteMount === undefined) return undefined;
  const prefix = `${siteDirFor(instanceDir)}/`;
  if (!src.startsWith(prefix)) return undefined;
  return `${siteMount.replace(/\/$/, "")}/${src.slice(prefix.length)}`;
}

/**
 * Where this layer's SITE DIRECTORY is served from.
 *
 * `/` for the layer that owns the site — the main docs pipeline builds it
 * in place. For every other layer, the `<kind>/<name>` route
 * `mount-instance-docs` always produces, with the kind read from the
 * declaration entry whose path IS the site directory. `undefined` when the
 * layer declares no kind for it, which is a real answer: nothing can be
 * said about where a directory nobody classified will be served.
 */
function siteDirMount(
  decl: CatHarnessDeclaration,
  instanceDir: string,
  ownsSite: boolean,
): string | undefined {
  if (ownsSite) return "/";
  const site = siteDirFor(instanceDir);
  const entry = (decl.directories ?? []).find(
    (d) => (d.path ?? "").replace(/\/$/, "") === site,
  );
  const kind = entry?.graphTypologies?.[0];
  return kind === undefined ? undefined : `/${kind}/${decl.name}/`;
}

/**
 * Where a visualiser's sub-graph page for one layer is published:
 * `/<locale>/<harness>/<visualiser>/<subject>/` — `visualiserRoute`, the ONE
 * function every route is computed with (owner, 2026-10-09), under the page
 * locale (`pageParts`, folio-assistant#2527). The subject never comes first:
 * `<base>/<instance>/` is the layer presenting itself.
 */
export function subjectPage(handler: string, visualiser: string, subject: string): string {
  return `/${visualiserRoute(pageParts({ harness: handler, visualiser, subgraph: subject }))}`;
}

/**
 * The opt-in ALIAS of a visualiser — `<base>/<alias>/` (bean `t4xb`). Until
 * 2026-10-09 this was where the site owner's state dashboards were DRAWN
 * (`state-visualizer` rule 3, "the root elides its own name"); now each is
 * drawn at its route and this URL is a composed redirect, present only where
 * a declaration opts in.
 */
export function ownStatePage(alias: string): string {
  return `/${aliasRoute(alias)}`;
}

/**
 * A layer's OWN themed root — `<base>/<name>/` — when it has one.
 *
 * The owner, 2026-09-20, settled the two routes in `mount-instance-docs.ts`
 * (quoted at its top: the kind route is the cat-harness handler's default,
 * the layer's own root is themed), and, 2026-09-21, on what a tile should open:
 *
 * > cliking shoud go to folio view, not the schema viweer
 *
 * So the tile's target is the LAYER acting as handler for its own name, not
 * a kind handler's default rendering of it. A layer has that root exactly
 * when it has its own `docs/` to mount — which is what `mount-instance-docs`
 * walks — so the test is for that directory rather than for a published page.
 *
 * **Probing the built site would give the wrong answer**, and that is measured
 * rather than assumed: the IRIS replica's `docs/` is generated by the layer's own
 * `gen-iris-pages.ts` and mounted at build time, so a working tree that has
 * not run it carries no `docs/<iris>/` while the published site does. The
 * DECLARATION-shaped question — does this layer have docs of its own? — is
 * the one that survives both.
 *
 * The site owner's root is the site root: `mount-instance-docs` leaves it to
 * the main docs pipeline, unchanged.
 */
function folioRoot(repoRoot: string, name: string, atSiteRoot: boolean): string | undefined {
  if (atSiteRoot) return "/";
  const dir = join(repoRoot, name);
  // The layer's OWN site directory, read from its OWN declaration rather
  // than assumed to be `docs/`. `check:declared-paths` is what caught the
  // literal, and it was right to: a layer may publish from anywhere, and
  // this function would have quietly answered "no folio view" for one that
  // did.
  if (findDeclarationFile(dir) === undefined) return undefined;
  return existsSync(join(dir, siteDirFor(dir))) ? `/${name}/` : undefined;
}

/** Every `harness.json` in the tree: the repository root and one level down. Exported for `harness-panel.ts`. */
export function instanceDirs(repoRoot: string, names: readonly string[]): string[] {
  const out: string[] = [];
  if (findDeclarationFile(repoRoot) !== undefined) out.push(repoRoot);
  for (const name of names) {
    const dir = join(repoRoot, name);
    if (dir !== repoRoot && findDeclarationFile(dir) !== undefined) out.push(dir);
  }
  return out;
}

/**
 * The words an inert navbar row shows — one per bucket, and nothing else.
 *
 * ## Why this is a separate exported function
 *
 * TWO OF ITS FOUR ANSWERS NEVER OCCUR IN THIS REPOSITORY. Measured 2026-09-23
 * over all 31 unlinked kinds in `docs/_data/harness.json`: 24 are `unbuilt`,
 * 7 are `unbuilt` under `bootstrap`'s declared exemption, and `staging-only`
 * and `undiscovered` occur **not at all** — `harnessTiles` emits no finding
 * of either shape here either.
 *
 * Of those two, `undiscovered` is at least reached by a fixture: the `flh4`
 * test for a viewer that resolves outside the site directory. `staging-only`
 * is reached by NOTHING — not the corpus, not a fixture — so before this
 * function existed its wording would have been a line that no test and no
 * deploy ever ran. That is how the read-only mark came to ship live CSS and
 * live JS rendering on 0 of 3 deployed pages (the comment further down
 * records it, found by reading a deploy rather than a diff), and `1xhc` is
 * the general form: a gate that does not fire is indistinguishable from one
 * that passed. Lifting the decision out makes all four answers assertable
 * directly, with no declaration to construct.
 *
 * `exempt` narrows `unbuilt` ONLY. A staging-only viewer is withheld by its
 * own `publish` setting and a declared-but-unreachable one exists, so neither
 * is anything a `renderExemption` has a view about.
 *
 * @param bucket which of the three reasons a kind has no published viewer
 * @param exempt the layer declares `renderExemption.of: ["visualiser"]`
 */
export function inertNote(bucket: "staging-only" | "undiscovered" | "unbuilt", exempt: boolean): string {
  if (bucket === "staging-only") return "staging only";
  if (bucket === "undiscovered") return "viewer not published";
  return exempt ? "no viewer by design" : "no viewer yet";
}

function tileFor(
  decl: CatHarnessDeclaration,
  handler: string,
  siteDir: string,
  ownsSite: boolean,
  repoRoot: string,
  /** This layer IS the repository root — the checkout acting as a layer. */
  isRepoRoot: boolean,
  /** This layer's OWN directory, which is where its declared paths are relative to. */
  instanceDir: string,
  /**
   * The SITE-OWNING layer — its declaration and its directory.
   *
   * Needed because theme art is routinely declared by the harness that
   * SUPPLIES it rather than by the layer it is about: `bootstrap` declares
   * a sticky with `theme: bootstrap` and **no images at all**, while
   * `cat-harness` declares the `landing-bootstrap` role's three layouts. That
   * is the inversion `ThemeBackdropSchema` describes — a theme names a ROLE,
   * and whoever holds images for that role supplies the art.
   */
  owner?: { decl: CatHarnessDeclaration; dir: string },
): HarnessTile {
  // THE SUB-GRAPHS A DIRECTORY DECLARES FROM WITHIN (issue #1164) join the
  // list — but only those whose kind says it is LISTED under its parent
  // (`within`). `beans/` and `todos/` also carry nested declarations, and
  // their inner nodes (`bean-defs`, `workflow-state`) are parts of one graph,
  // not graphs a reader browses; `within` is the registry's statement that a
  // kind is the second thing.
  const byId = new Map((decl.directories ?? []).map((d) => [d.id, d]));
  const listedSubgraphs = nestedDirectories(instanceDir, decl).filter((n) => {
    const parentKinds = byId.get(n.parentId)?.graphTypologies ?? [];
    return n.graphTypologies.some((g) => {
      const w = defaultGraphTypologies.get(g)?.within;
      return w !== undefined && parentKinds.includes(w);
    });
  });
  type Dir = NonNullable<CatHarnessDeclaration["directories"]>[number];
  // `instanceDirectories` adds the LAYER directories declared from within
  // (bean `cmsl`: `skills/skills.json` names `voices/`). `nestedDirectories`
  // walks only DECLARED parents, and `skills/` is now inherited, so without
  // this SMART Base's voices tile vanished (measured 2026-09-30).
  // Every directory's viewers resolved from the DECLARED visualisers — the
  // nested and from-within ones too, which `harnessTiles` did not resolve
  // with the declaration's own list.
  const resolved = (xs: Dir[]): Dir[] => withViewers(xs, instanceDir, repoRoot, siteDir);
  const dirs: Dir[] = [
    ...(decl.directories ?? []),
    ...resolved(listedSubgraphs.map(({ parentId: _parent, ...d }) => d as Dir)),
  ];
  for (const d of instanceDirectories(instanceDir, decl)) {
    if (!dirs.some((x) => x.id === d.id)) dirs.push(...resolved([d as Dir]));
  }
  const kinds = [...new Set(dirs.flatMap((d) => d.graphTypologies ?? []))].sort();
  const findings: string[] = [];

  // WHERE THE SITE IS, repo-relative, computed once. `siteDir` arrives
  // absolute while every declared path is relative to the repository root, so
  // one has to be rebased onto the other; deriving it from the value
  // `harnessTiles` already passed in means this and `handled` below cannot
  // disagree about where the site is.
  const sitePrefix = `${relative(repoRoot, siteDir)}/`;

  /* WHAT THE DECLARATION SAYS, before what the conventions guess.
   *
   * `coverage.visualiser` names the page that renders a directory's graph,
   * and a directory says which kinds it holds — so between them the
   * declaration answers "is this kind viewable" directly. Reading only the
   * two conventional paths made that answer unreachable: `translations/`
   * declared a resolving visualiser at `docs/translation-status/` and the
   * tile's own `directories` list linked it, while `visualisations` two
   * lines away still reported the kind as having no viewer. One question,
   * two answers, free to disagree — and the wrong one is the one that gets
   * counted in a finding.
   *
   * `flh4` is the rule: a DECLARED visualiser that does not resolve is a
   * different defect from no visualiser at all. It has always been reported
   * as such below; what was missing is the other side of it, that one which
   * DOES resolve is a viewer.
   *
   * Only a ref under the published site directory counts. A page that
   * resolves on disk but is not published is not something a tile can open,
   * and claiming it would put a 404 behind the tab — `pb04`.
   */
  // A COMPOSED directory of this layer is the second place a declared ref
  // can be published, and its URL is as computable as the site prefix's:
  // `compose-docs.ts` copies the directory to `_docs/<name>/`, so a page in it
  // is served at `/<name>/<path within it>`. Reading `composed` off the
  // declaration, as `composedInstances` does, rather than restating the rule.
  // Before this, a layer's own generated viewer (`<instance>/docs/`, with
  // `rendered-by` naming a kind's viewer Tool) was found and then reported as
  // "built and unreachable" — the routing gap the `declaredFor` note below
  // names. #1767, stage C3.
  const instanceRel = relative(repoRoot, instanceDir).split(sep).join("/");
  const composedPrefixes = (decl.directories ?? [])
    // An `igSite` directory is served at the same `/<name>/` route, inside the IG's own site (bean `mftp`).
    .filter((d) => ((d as { composed?: boolean }).composed === true || (d as { igSite?: boolean }).igSite === true) && typeof d.path === "string")
    .map((d) => `${instanceRel}/${d.path!.replace(/^\.?\/+/, "").replace(/\/*$/, "/")}`);
  // THE LAYER'S OWN SITE DIRECTORY, when it is served at the site root: the
  // `ownsSite || isRepoRoot` rule `siteDirMount` already applies to its
  // declared ICON (issue #46, gap 3). A folio that generates its own site and
  // is the checkout's root declared its pages under its own `docs/`, and they
  // were dropped here because only the SITE OWNER's directory counted, while
  // its icon under the same directory resolved: one directory, two answers.
  // Measured on litlfred/ihris: a declared `docs/schemas/` read "no viewer
  // yet", and `beans`/`glossary` resolved only by convention.
  const ownSitePrefix =
    ownsSite || isRepoRoot
      ? `${relative(repoRoot, join(instanceDir, siteDirFor(instanceDir))).split(sep).join("/")}/`
      : undefined;
  const publishedRefOf = (ref: string): string | undefined => {
    if (ref.startsWith(sitePrefix)) return publishedUrlOf(ref.slice(sitePrefix.length));
    if (ownSitePrefix !== undefined && ref.startsWith(ownSitePrefix)) return publishedUrlOf(ref.slice(ownSitePrefix.length));
    const under = composedPrefixes.find((p) => ref.startsWith(p));
    return under === undefined ? undefined : publishedUrlOf(`${decl.name}/${ref.slice(under.length)}`);
  };

  // A FOLIO WHOSE WHOLE SITE IS GENERATED (litlfred/smart-ra): it is the
  // checkout's root, has no site directory on disk, and its viewers are pages
  // its declared `writer`s build into the site source at publish. Such a ref
  // IS the page's site path — the rule core's `landingLinks` already links the
  // landing by. Without it every Folders row on that site read "viewer not
  // published" over pages the site serves (owner, 2026-10-14).
  const generatedSite = isRepoRoot && isGeneratedSite(instanceDir);
  const generatedRefOf = (v: { ref: string; writer?: readonly string[] }): string | undefined =>
    generatedSite ? generatedPageOf(repoRoot, v) : undefined;

  const declared = new Map<string, string>();
  for (const d of dirs) {
    for (const v of visualisationsOf(d.coverage, d.id)) {
      // Built at publish (bean 0b8c) counts as present: its page is never
      // committed, and the answer must not depend on a local copy.
      if (!visualisationResolves(v, (p) => existsSync(join(repoRoot, p)))) continue;
      const page = publishedRefOf(v.ref) ?? generatedRefOf(v);
      if (page === undefined) continue;
      for (const kind of d.graphTypologies ?? []) {
        if (!declared.has(kind)) declared.set(kind, page);
      }
    }
  }

  // ...and on such a site the DIRECTORY'S OWN declaration counts as well:
  // `withViewers` puts a harness's viewer in its place (cat-harness's
  // archimate viewer over smart-ra's `archimate/`), which that site never
  // builds, while the folio's own declared page is the one it serves.
  if (generatedSite) {
    for (const d of instanceDirectories(instanceDir)) {
      for (const v of visualisationsOf(d.coverage, d.id)) {
        if (v.publish === "staging-only" || !visualisationResolves(v, (p) => existsSync(join(repoRoot, p)))) continue;
        const page = generatedRefOf(v);
        if (page === undefined) continue;
        for (const kind of d.graphTypologies ?? []) if (!declared.has(kind)) declared.set(kind, page);
      }
    }
  }

  // THE DECLARATION ALONE (owner, 2026-10-09). A kind's page is the route of
  // a visualiser some harness DECLARES over one of this layer's
  // directories of that kind — `<base>/<locale>/<harness>/<visualiser>/[<sub-graph>/]`
  // from `visualiserRoute` — and nothing else. Until then this probed two
  // CONVENTIONS first (`/<handler>/<kind>/<name>/`, and `/<kind>/` for the
  // site owner) and fell back to the declaration; a convention is a URL the
  // reader chose, which is the contention the owner ruled out. The short
  // `/<kind>/` survives only as a declared ALIAS, composed as a redirect.
  /**
   * THE READ-ONLY ANSWER FOR A KIND, resolved across the directories declaring
   * it — and `undefined` when they do not agree.
   *
   * A kind can be declared by more than one directory, so it can be declared
   * read-only by one and writable by another. The IRIS replica is exactly that shape
   * one field along: `catalogue/` is frozen and `uploads/` is the drop zone.
   * Picking the first answer would make the listing depend on declaration
   * order; picking `true` if any says so would freeze a kind on the strength of
   * one directory. Disagreement is a THIRD state and it is reported as one —
   * undefined here, and named in a finding below, rather than resolved by a
   * rule nobody chose.
   */
  const readOnlyFor = (kind: string): boolean | undefined => {
    const said = dirs
      .filter((d) => (d.graphTypologies ?? []).includes(kind))
      .map((d) => d.readOnly)
      .filter((v): v is boolean => v !== undefined);
    if (said.length === 0) return undefined;
    return said.every((v) => v === said[0]) ? said[0] : undefined;
  };

  const visualisations: HarnessVisualisation[] = [];
  // A SUB-GRAPH OF THE SITE ITSELF — a directory the site's own docs layer
  // holds and declares from within (`docs/docs.json`'s `proposals/`) — is not
  // a visualiser: it is content, served at its own path. Read from the
  // DIRECTORY'S declared path, never composed from the kind's name.
  const sitePageFor = (kind: string): string | undefined => {
    for (const d of dirs) {
      if (!(d.graphTypologies ?? []).includes(kind) || !d.path) continue;
      const abs = join(instanceDir, d.path);
      const rel = relative(siteDir, abs);
      if (rel === "" || rel.startsWith("..")) continue;
      const dir = rel.split(sep).join("/").replace(/\/*$/, "");
      if (existsSync(join(abs, "index.html"))) return publishedUrlOf(`${dir}/`);
      // An `index.md` is published where the site's permalink defaults put
      // it, not at its source path: `docs/start/index.md` is served at
      // `/docs/cat-harness/start/` (bean `kc7k`), and the tile linked a
      // `/start/` nothing serves (fa#2739).
      if (existsSync(join(abs, "index.md"))) return publishedUrlOf(publishedPagePath(siteDir, `${dir}/index`));
    }
    return undefined;
  };
  // THE MOUNT'S OWN ROUTE, last: a directory with no declared viewer that the
  // mount pass publishes at its kind route (`docs/` → `/docs/<layer>/`) is a
  // page the site serves, and the row opened nothing (owner, 2026-11-13).
  // Read lazily, once: most layers resolve every kind above.
  let mounted: Map<string, string> | undefined;
  const mountedPageFor = (kind: string): string | undefined => {
    mounted ??= mountedKindRoutes(repoRoot, decl.name);
    return mounted.get(kind);
  };
  for (const kind of kinds) {
    const path = declared.get(kind) ?? sitePageFor(kind) ?? mountedPageFor(kind);
    // READ-ONLY IS ORTHOGONAL TO WHETHER A VIEWER WAS FOUND, and keeping the
    // two independent here is the whole of the two-greys distinction: `path`
    // answers "is there anything to open", `readOnly` answers "may it be
    // edited". Both branches carry it, so a kind never loses its read-only
    // state by failing to resolve a page.
    const ro = readOnlyFor(kind);
    // WITHHELD FROM THE CANONICAL DEPLOY — read from the same declaration
    // `declaredFor` reads it from, rather than inferred from anything. See
    // `HarnessVisualisation.stagingOnly` for what its absence cost.
    const withheld = dirs.some(
      (d) =>
        (d.graphTypologies ?? []).includes(kind) &&
        visualisationsOf(d.coverage, d.id).some((v) => v.publish === "staging-only"),
    );
    const within = defaultGraphTypologies.get(kind)?.within;
    visualisations.push({
      kind,
      ...(within ? { within } : {}),
      ...(path ? { path } : {}),
      ...(ro === undefined ? {} : { readOnly: ro }),
      ...(withheld ? { stagingOnly: true as const } : {}),
    });
  }
  // TWO REASONS A KIND HAS NO PATH, and they are not the same finding.
  //
  // Discovery above is by CONVENTION — a page at `/<handler>/<kind>/<name>/`
  // or, for the site's owner, `/<kind>/`. A kind can therefore have a viewer
  // that is real, declared and on disk, and still not be found here, because
  // it was published somewhere the convention does not look: a layer's own
  // mounted `docs/`, for example.
  //
  // Reporting both as "no published viewer" makes the artefact assert
  // something false. Measured 2026-09-22: the IRIS replica's `catalogue` gained a viewer
  // at its `docs/catalogue.html`, declared and resolving — and this
  // finding went on saying nobody had built one, while the declared-ref check
  // twenty lines below reported the same declaration as perfectly fine. Two
  // halves of one file disagreeing about one graph.
  //
  // HALF OF THE DISCOVERY NOW HAPPENS, and the two halves met in a merge
  // (2026-09-22). A declared ref UNDER the published site directory is linked
  // by the `declared` map above: its published path is the ref with the site
  // prefix stripped, so there is nothing to resolve and nothing to guess.
  // Those kinds never reach this block, because they have a `path`.
  //
  // What is left here is the case that genuinely needs `withRoutes`: a ref
  // INSIDE a layer's own tree, which the site build mounts somewhere the
  // strip above cannot compute — that replica's `docs/catalogue.html` is the
  // measured example. For those the fix is still the DISTINCTION rather than
  // the discovery: naming the case stops the report lying in the meantime,
  // and tells whoever does the routing work which gap they are closing.
  const declaredFor = (kind: string, stagingOnly: boolean): string | undefined => {
    for (const d of dirs) {
      if (!(d.graphTypologies ?? []).includes(kind)) continue;
      for (const v of visualisationsOf(d.coverage, d.id)) {
        if ((v.publish === "staging-only") !== stagingOnly) continue;
        if (visualisationResolves(v, (p) => existsSync(join(siteDir, "..", "..", p)))) return v.ref;
      }
    }
    return undefined;
  };

  const unlinked = visualisations.filter((v) => v.path === undefined).map((v) => v.kind);
  // A STAGING-ONLY viewer is unlinked ON PURPOSE, so it is neither of the two
  // gaps below. Saying otherwise would have this generator report the
  // `publish: "staging-only"` design as a defect — which it did for `fsh-guts`
  // the moment the split above started working, and a report that flags an
  // intended state as a finding is the same disease as one that hides a real
  // gap. It is STATED rather than dropped: silence would make "deliberately
  // withheld" indistinguishable from "nobody looked".
  const stagingOnly = unlinked.filter((k) => declaredFor(k, true) !== undefined);
  const rest = unlinked.filter((k) => !stagingOnly.includes(k));
  const undiscovered = rest.filter((k) => declaredFor(k, false) !== undefined);
  const unbuilt = rest.filter((k) => declaredFor(k, false) === undefined);

  /* THE SAME CLASSIFICATION, ONTO THE ROW — see `HarnessVisualisation.note`.
   *
   * Four buckets are already in hand and were, until now, spent entirely on
   * `findings`: prose, inside a `<details>` a reader opens on purpose. The
   * navbar row that each bucket is ABOUT carried none of it. This loop is the
   * whole of the fix, and it invents no state — every branch below reads a
   * variable computed above.
   *
   * `renderExemption` (instance-wide) and `coverage.exempt.visualiser`
   * (directory-level, as `check-subgraph-coverage.ts` honours for e.g.
   * a higher layer's Lean template directory; bean
   * `folio-assistant-6gme`) split `unbuilt`, and only `unbuilt`: the same
   * predicate the finding twenty lines down calls, so an exempt layer or
   * directory cannot be told "no viewer yet" by one surface and "not a gap" by
   * the other.
   */
  const exempt = isExemptFrom(decl, "visualiser");
  const isKindExempt = (kind: string): boolean => {
    if (exempt) return true;
    const holding = dirs.filter((d) => (d.graphTypologies ?? []).includes(kind));
    return (
      holding.length > 0 &&
      holding.every(
        (d) =>
          typeof d.coverage?.exempt?.visualiser === "string" &&
          d.coverage.exempt.visualiser.trim().length > 0,
      )
    );
  };
  for (const v of visualisations) {
    if (v.path !== undefined) continue;
    const bucket = stagingOnly.includes(v.kind)
      ? "staging-only"
      : undiscovered.includes(v.kind)
        ? "undiscovered"
        : "unbuilt";
    v.note = inertNote(bucket, isKindExempt(v.kind));
  }

  // ONE NAME PER DESTINATION (bean `ob3m` finding 6). Labelled here, where
  // the directories are in hand, and read by every surface from the data.
  labelVisualisations(visualisations, dirs);

  if (stagingOnly.length > 0) {
    findings.push(
      `${decl.name}: ${stagingOnly.length} graph(s) declare a staging-only viewer, deliberately ` +
        `not linked on the canonical deploy — ${stagingOnly.join(", ")}. Not a gap.`,
    );
  }

  if (unbuilt.length > 0) {
    /* A RENDER-EXEMPT LAYER IS NOT MISSING ANYTHING, and this finding said
     * it was. Bean `sbck`, third done-when.
     *
     * bootstrap declares `renderExemption.of: ["visualiser", ...]` — the
     * owner's 2026-09-20 ruling that the bottom of the stack renders nothing
     * — and this line went on reporting four graphs as gaps against it, which
     * is the state the bean names: "reported as gaps against a layer that is
     * exempt from exactly that, which reads as noise and trains readers to
     * ignore it."
     *
     * `isExemptFrom` is the predicate that already exists for this, and its
     * own doc comment says so: *"the predicate the `2krx` axis calls before
     * raising a no-visualiser finding, so the exemption is read from the
     * declaration rather than from a hardcoded instance name."* This file
     * IMPORTS it and used it for `footer` while the finding twenty lines away
     * did not — one file, two answers to "is this instance excused".
     *
     * STATED, NEVER DROPPED. `2krx` is that an opt-out without a reason per
     * entry becomes a silence list, so the kinds are still named and the
     * exemption's `owes` is named with them: a reader sees what is unrendered
     * AND what the layer carries instead, which is the whole bargain the
     * exemption struck. Same shape as `staging-only` above, for the same
     * reason — an intended state reported as a defect is the same disease as
     * a real gap hidden.
     */
    if (isExemptFrom(decl, "visualiser")) {
      findings.push(
        `${decl.name}: ${unbuilt.length} graph(s) render no viewer — ${unbuilt.join(", ")} — ` +
          `under a declared \`renderExemption\`. Not a gap: it owes ${decl.renderExemption?.owes}`,
      );
    } else {
      const dirExempt = unbuilt.filter((k) => isKindExempt(k));
      const gaps = unbuilt.filter((k) => !isKindExempt(k));
      if (dirExempt.length > 0) {
        const reasons = dirExempt.flatMap((k) =>
          dirs
            .filter((d) => (d.graphTypologies ?? []).includes(k))
            .map((d) => d.coverage?.exempt?.visualiser?.trim())
            .filter((r): r is string => Boolean(r)),
        );
        findings.push(
          `${decl.name}: ${dirExempt.length} graph(s) render no viewer — ${dirExempt.join(", ")} — ` +
            `under a declared \`coverage.exempt.visualiser\`. Not a gap: ${reasons.join("; ")}`,
        );
      }
      if (gaps.length > 0) {
        findings.push(
          `${decl.name}: declares ${gaps.length} graph(s) with no published viewer — ` +
            `${gaps.join(", ")}. Declared and not rendered is a gap, not a dead link.`,
        );
      }
    }
  }
  if (undiscovered.length > 0) {
    findings.push(
      `${decl.name}: ${undiscovered.length} graph(s) have a declared viewer that exists but is ` +
        `not at a conventional path, so no tile links it — ` +
        `${undiscovered.map((k) => `${k} (${declaredFor(k, false)})`).join(", ")}. ` +
        `Built and unreachable is a different gap from unbuilt.`,
    );
  }

  // READ-ONLY IS STATED WHETHER OR NOT A VIEWER EXISTS, and that separation is
  // the whole point of the two greys.
  //
  // Every read-only kind in this repository today ALSO lacks a viewer, so a
  // mark that rode the viewer list would render zero times — which is exactly
  // what happened on the first attempt: the mark shipped on the graph-tile
  // surface, `readOnly` is never populated there, and reading the staging
  // deploy found it on 0 of 3 pages. Live CSS, live JS, nothing to style.
  //
  // So the fact goes where it cannot be hidden by the gap. A reader told only
  // "catalogue: no published viewer" learns that nothing opens, and not that
  // what is behind it is frozen and needs a copy-out to work on.
  const frozen = visualisations.filter((v) => v.readOnly === true).map((v) => v.kind);
  if (frozen.length > 0) {
    findings.push(
      `${decl.name}: ${frozen.length} graph(s) hold materialized content and are READ-ONLY — ` +
        `${frozen.join(", ")}. Readable, not editable here: copy one out to your own ` +
        `folio/ to work on it. Separate from whether a viewer is published.`,
    );
  }

  // A DECLARED visualiser that does not resolve is `flh4`'s defect, and it is
  // a different finding from "no viewer": one says nobody built it, the other
  // says the declaration is wrong.
  for (const d of dirs) {
    // EVERY declared visualisation, not "the" one: a directory may now declare
    // several — the owner's *"harness can declare >= 1 visualiztion (which
    // then has a title)"* — and checking only the first would report a clean
    // directory whose second viewer is missing.
    for (const v of visualisationsOf(d.coverage, d.id)) {
      if (!visualisationResolves(v, (p) => existsSync(join(siteDir, "..", "..", p)))) {
        findings.push(
          `${decl.name}/${d.id}: declares visualiser "${v.title}" at "${v.ref}", ` +
            `which does not resolve on disk.`,
        );
      }
    }
  }

  // THE OTHER HALF OF `flh4`: a page published for this layer by a
  // declared visualiser that covers NONE of its directories. The tile must not
  // link it — the declaration decides what a tile claims to show — but staying
  // silent would hide a working viewer behind a rule, and the remedy is one
  // line in a declaration rather than a mystery. Asked of the DECLARED routes
  // (`<harness>/<visualiser>/<this instance>/`), never of a directory listing.
  const linked = new Set(visualisations.map((v) => v.path).filter((p): p is string => p !== undefined));
  for (const v of declaredVisualisers(repoRoot)) {
    if (v.subgraphs !== "instance") continue;
    // The page under the locale, or at the old address on a site not yet
    // regenerated (folio-assistant#2527) — the URL is wherever it IS.
    const at = existingPageDir(siteDir, { harness: v.harness, visualiser: v.id, subgraph: decl.name });
    if (at === undefined || !existsSync(join(at, "index.html"))) continue;
    const url = `/${relative(siteDir, at).split(sep).join("/")}/`;
    if (linked.has(url)) continue;
    findings.push(
      `${decl.name}: a viewer is published at ${url} by ${v.harness}'s \`${v.id}\` visualiser, ` +
        `which covers none of this instance's directories. Declare one it covers and the tile links it.`,
    );
  }

  // The declaration's own `avatar` first (sod4 #4), so a tile is drawn from
  // the layer it describes; the table by name covers the layers below
  // the harness that carry none.
  const own = decl.avatar !== undefined || hasAvatar(decl.name);
  const avatar = decl.avatar ?? (own ? avatarFor(decl.name) : GENERIC);
  if (!own) {
    findings.push(`${decl.name}: no avatar declared for this instance — showing the blank mark.`);
  }

  const icon = decl.images?.find((i) => i.id === decl.icon);

  // THE CLICK TARGET: the layer's own themed root FIRST, a kind handler's
  // viewer only when it has none. The owner asked for exactly this — "cliking
  // shoud go to folio view, not the schema viweer" — and the first version got
  // it wrong by taking whichever viewer happened to sort first, which for
  // `detangle` and `large-datasets` is the schema viewer.
  // TWO layers resolve to `/`, and that is this repository rather than a
  // bug: `mount-instance-docs` leaves the site root to the main docs pipeline,
  // which the site-owning harness supplies, and the repository root layer IS
  // the checkout that pipeline publishes. Saying so beats giving one of them a
  // link that 404s — `docs/cat-harness/` has viewers beneath it and no index.
  const folio = folioRoot(repoRoot, decl.name, ownsSite || isRepoRoot);

  // THE ICON, published rather than declared — see `publishedIcon`. Resolved
  // here rather than beside `icon` because it needs the mount, and the mount
  // is `folio`.
  // The SITE-DIR mount, not `folio` — see `publishedIcon`. `folio` is the
  // layer's front door, which for the IRIS replica is its 1,378-file library.
  const siteMount = siteDirMount(decl, instanceDir, ownsSite || isRepoRoot);
  const iconSrc = icon ? publishedIcon(instanceDir, icon.src, siteMount) : undefined;
  if (icon && iconSrc === undefined) {
    // Reported, never rendered as a placeholder. The layer ASKED for a
    // mark and did not get one, and that is a fact about its declaration
    // rather than about this tile.
    findings.push(
      `${decl.name}: declares icon "${decl.icon}" at ${icon.src}, which this build cannot ` +
        `turn into a published path — the instance has no mount, or the path is not under ` +
        `its declared site directory. Showing no mark rather than a broken image.`,
    );
  }
  const firstViewer = visualisations.find((v) => v.path)?.path;

  /* THE THIRD TARGET, for a layer that renders nothing of its own.
   *
   * bootstrap is instantiated, correctly has no viewer (it declares a
   * `renderExemption` — the owner, 2026-09-20: *"it is exception to
   * harness/layer not having visualtion/workflow visualizer"*), and therefore
   * had no href at all. `nav_footer_custom.html` rendered its tab as a greyed
   * `<span>`, and the owner read that as broken: *"Boostrap should be
   * clicable."*
   *
   * Nothing was wrong with the declaration OR with `pb04`'s rule that a tab
   * with nowhere to go is not a link. What was missing is that the exemption
   * said "I do not render myself" without saying "so go here instead".
   * `reachableAt` is that second half, and it is DECLARED for the same reason
   * the exemption itself is — a checker naming one instance states a rule
   * true only for the layer somebody remembered (`hfkl`).
   *
   * THE FILE IS CHECKED, not composed. A declared path that does not resolve
   * is `flh4`'s defect and a DIFFERENT finding from "nothing is published":
   * one says the declaration is wrong, the other says nobody built it. Both
   * leave the tab unlinked, which is correct either way.
   *
   * RELATIVE TO THE LAYER, and inside it (owner, 2026-09-23, bean iwtn:
   * "bootstrap is bootstrap"). It named a page in the site-owning harness's
   * docs until then, which made the floor of the stack point at a layer above
   * it. It now names one of the layer's OWN files, which the site build
   * publishes at `<base>/<stub>/` (`publish-instance-files.ts`), `.md`
   * rendered as `.html`.
   */
  let handled: string | undefined;
  const reachable = decl.renderExemption?.reachableAt;
  if (folio === undefined && firstViewer === undefined && reachable !== undefined) {
    const onDisk = resolve(instanceDir, reachable);
    const inside = !isAbsolute(reachable) && !relative(instanceDir, onDisk).startsWith("..");
    if (!inside) {
      findings.push(
        `${decl.name}: its renderExemption declares \`reachableAt: ${reachable}\`, which is ` +
          `outside the instance. It must name one of the instance's own files, relative to ` +
          `its own directory, so the tab stays unlinked.`,
      );
    } else if (!existsSync(onDisk)) {
      findings.push(
        `${decl.name}: its renderExemption declares \`reachableAt: ${reachable}\`, which is ` +
          `not a file. The tab stays unlinked — a declared path that does not resolve is a ` +
          `wrong declaration, which is a different problem from nothing being published.`,
      );
    } else {
      // `.md` is published as `.html` (`publish-instance-files.ts`); anything
      // else is served as it sits.
      handled = `/${artefactStub(decl)}/${reachable.replace(/\.md$/, ".html")}`;
    }
  }

  // The layer's theme, from the sticky it contributes about ITSELF. A
  // contribution whose id is this layer is the layer talking about
  // itself, which is the same key `composeContributions` dedupes on.
  // THE LAYER'S OWN STICKY — and a card id is NOT the layer name.
  //
  // This matched `st.id === decl.name` and therefore found nothing for
  // the content core, whose card id is `folio-assist-core`. That is not
  // a stale declaration: `landing-sticky.test.ts` pins the divergence
  // deliberately, because *"a card id is a published identifier on the landing
  // page and the directory is only where the files sit ... which is exactly
  // why it broke when they were assumed to be one string."* The exact
  // assumption, written here one file over, and it cost core its avatar while
  // its theme had been declared all along.
  //
  // THE SET IS ALREADY RIGHT: `decl.stickies` is what THIS layer
  // contributes, so its own card is in there whatever it is called. An exact
  // match still wins where one exists (cat-harness, bootstrap); a lone
  // contribution is taken as the layer's own; and several with no exact
  // match is REPORTED rather than picked from, because choosing by order would
  // make the avatar depend on declaration order.
  const contributed = decl.stickies ?? [];
  const exact = contributed.find((st) => st.id === decl.name);
  const ownSticky = exact ?? (contributed.length === 1 ? contributed[0] : undefined);
  if (exact === undefined && contributed.length > 1) {
    findings.push(
      `${decl.name}: contributes ${contributed.length} stickies and none carries its own name ` +
        `(${contributed.map((st) => st.id).join(", ")}), so which one is this instance's own card ` +
        `cannot be told — showing no theme avatar rather than picking by declaration order.`,
    );
  }
  // By REFERENCE, owner first (bean `v8n5`), so `{instance, themeId}` means
  // what #1168 B8 says it means rather than being read as a bare id.
  const found = ownSticky?.theme === undefined ? undefined : themeByRef(ownSticky.theme, repoRoot, decl.name);
  const theme = found?.ok ? found.theme : undefined;
  if (ownSticky?.theme !== undefined && theme === undefined) {
    findings.push(
      `${decl.name}: its sticky names theme "${ownSticky.theme.themeId}", which is not installed — ` +
        `showing no theme avatar rather than a broken image.`,
    );
  }
  // THE TONE, from the accent of a theme the layer DECLARED ITSELF (bean
  // `v8n5`). Scoped to a layer's own theme on purpose: a card citing one
  // of the platform's shared sticky themes chose a note style, not an
  // identity colour, and re-hueing every such tile is a change nobody asked
  // for. A grey accent has no hue, and then the avatar's tone stands.
  const ownTheme = found?.ok === true && found.owner !== undefined && found.owner !== PLATFORM_THEME_OWNER;
  const themeTone = theme && ownTheme ? hexHue(theme.palette.accent) : undefined;

  // Resolved theme for blank fallback: when a layer has no avatar, its blank
  // mark takes the colour from the resolved theme (including parent/owner theme).
  const ownerContributed = owner?.decl.stickies ?? [];
  const ownerExact = owner ? ownerContributed.find((st) => st.id === owner.decl.name) : undefined;
  const ownerSticky = ownerExact ?? (ownerContributed.length === 1 ? ownerContributed[0] : undefined);
  const ownerThemeFound =
    owner && ownerSticky?.theme !== undefined ? themeByRef(ownerSticky.theme, repoRoot, owner.decl.name) : undefined;
  const inheritedTheme = ownerThemeFound?.ok ? ownerThemeFound.theme : undefined;
  const resolvedTheme = theme ?? inheritedTheme;
  const resolvedTone = resolvedTheme ? hexHue(resolvedTheme.palette.accent) : undefined;
  // OWN IMAGES FIRST, THE SITE OWNER'S SECOND — the overlay order this
  // repository uses everywhere else, and the one the theme docs describe: *"an
  // instance declaring its own `landing` images gets its own backdrop"*, with
  // the supplier as the fallback rather than the only answer.
  //
  // MEASURED, and it is why `bootstrap` had no avatar until now: it declares a
  // sticky naming `theme: bootstrap` and **zero images**, while `cat-harness`
  // declares the `landing-bootstrap` role. Resolving against `decl.images`
  // alone found nothing and reported a gap that was not one.
  // `gen-landing-data.ts` has always resolved a contributed sticky's art
  // against the site owner's images, so this is that join rather than a second
  // one — widened by the own-first step, which changes no existing answer
  // because no layer below the owner declares a landing role today.
  const ownCard = theme ? resolveThemeBackdrop(theme, decl.images).art.get("card") : undefined;
  const ownerCard =
    theme && ownCard === undefined && owner
      ? resolveThemeBackdrop(theme, owner.decl.images).art.get("card")
      : undefined;
  const card = ownCard ?? ownerCard;
  // THE PAGE GROUND (bean `yj32`): the same own-first join, all three crops.
  const ownArt = theme ? resolveThemeBackdrop(theme, decl.images).art : undefined;
  const ownerArt =
    theme && (ownArt === undefined || ownArt.size === 0) && owner
      ? resolveThemeBackdrop(theme, owner.decl.images).art
      : undefined;
  const groundFromOwn = ownArt !== undefined && ownArt.size > 0;
  const groundArt = groundFromOwn ? ownArt : ownerArt;
  const groundSrcs: Record<string, string> = {};
  for (const [layout, img] of groundArt ?? []) {
    const src = groundFromOwn
      ? publishedIcon(instanceDir, img.src, siteMount)
      : publishedIcon(owner!.dir, img.src, "/");
    if (src !== undefined) groundSrcs[layout] = src;
  }
  const groundComplete = ["mobile", "laptop", "card"].every((l) => groundSrcs[l] !== undefined);
  // THE PATH FOLLOWS THE SOURCE. An image declared by the site owner is
  // published under the SITE's own root, not under this layer's mount —
  // composing it from `folio` would point at a path the layer does not
  // serve, which is `68au` with the baseurl replaced by the wrong layer.
  const cardSrc = card
    ? ownCard !== undefined
      ? publishedIcon(instanceDir, card.src, siteMount)
      : publishedIcon(owner!.dir, card.src, "/")
    : undefined;
  const themeAvatar =
    card && cardSrc !== undefined
      ? {
          src: cardSrc,
          title: theme!.name,
          ...(card.avatarRegion ? { region: card.avatarRegion } : {}),
          // THE SAME CROP, SOLVED — for a consumer that cannot do arithmetic.
          //
          // `region` is the declaration and `navbar.ts`'s `mark()` solves it
          // itself for a mounted page. The Liquid sidebar cannot: dividing two
          // floats in a template is the kind of thing that silently yields an
          // integer. So the four CSS values are computed here, exactly as
          // `sync-docs-harness.ts` already does for the site title's avatar.
          //
          // Two fields from one declaration, both generated, neither authored
          // — which is why this is not the duplication `sjic` is about. The
          // sum has ONE home; only its output has two shapes.
          ...(card.avatarRegion ? { crop: solveCrop(card.avatarRegion) } : {}),
        }
      : undefined;
  if (card && card.avatarRegion === undefined) {
    // A card with no crop would render the whole 1254px composition in a 32px
    // frame — `603s` measured that and called it "grey mush". Reported rather
    // than rendered: an uncropped card is a declaration gap, not an avatar.
    findings.push(
      `${decl.name}: its theme's card art declares no avatarRegion, so the navbar has no ` +
        `crop to show — the whole card in a 2rem frame is unreadable. Declare one.`,
    );
  }

  // Resolved after both candidates exist. `icon` keeps its own field for
  // `mount-instance-docs.ts`, which builds a NavItem rather than reading this.
  const iconMark: HarnessMark | undefined =
    iconSrc === undefined
      ? undefined
      : {
          src: iconSrc,
          title: icon?.title ?? "",
          ...(icon?.avatarRegion ? { region: icon.avatarRegion, crop: solveCrop(icon.avatarRegion) } : {}),
          ...(icon?.ground ? { ground: icon.ground } : {}),
        };
  // The registry glyph is the THIRD candidate, not a separate mechanism: a
  // layer with its own avatar entry (never the generic one, which is a
  // fallback rather than a mark) still has a mark when it declares no image.
  // When a layer has no declared avatar (own === false), it renders the
  // themed blank mark (owner ruling 2026-09-20: "there is always an avatar,
  // even when there is none (always have default blank/themecolor if no avatar. etc)").
  const blankMark: HarnessMark = { glyph: BLANK_AVATAR.glyph, title: BLANK_AVATAR.reads, blank: true };
  const glyphMark: HarnessMark | undefined = own ? { glyph: avatar.glyph, title: avatar.reads } : blankMark;
  // The order is the owner's (*"use theme avatar not the purply thing"*,
  // 2026-09-22) and the Jekyll `.site-title` follows it too
  // (`_includes/title.html`), so every surface draws the same mark.
  const navMark = themeAvatar ?? iconMark ?? glyphMark;

  // A FOLIO AT THE SITE ROOT IS THE LANDING PAGE, which every harness row is
  // already beside: `ob3m` finding 2 measured Folio Assistant and C@T Harness
  // both linking to `/`, two rows that open one page and say nothing about
  // which harness was chosen. The landing gives each harness its own section,
  // `id="harness-<name>"` (`_includes/harness_details.html`), so that section
  // is the honest destination — the same page, at this harness's place on it.
  const rooted = folio === "/" ? `/#harness-${decl.name}` : folio;
  // AN INSTANTIATED HARNESS WITH NO FOLIO OF ITS OWN goes to its own section
  // of the landing too, never to one of its graphs' viewers. Bean `ob3m`
  // finding 6 ("One name everywhere"): bootstrap's row linked `/processes/`,
  // so one page was called "Bootstrap" on the harness row and "processes" one
  // row below it. The landing renders a section for every instantiated
  // harness (`_includes/harness_details.html`), so the anchor always resolves.
  // The CHECKOUT's answer, index included (cat-harness#21's rule): an index
  // lists its layers in `index.config.json` and none has a root
  // `<name>.config.json`, so the file test made every harness uninstantiated
  // and the landing listed none of them (`harness-row-alignment`,
  // `rail-tips`, 2026-10-09).
  const instantiated = instantiatedHarnessNames(repoRoot).includes(decl.name);
  const section = rooted === undefined && instantiated ? `/#harness-${decl.name}` : undefined;
  const href = rooted ?? section ?? firstViewer ?? handled;
  // A VIEWER AT THE LAYER'S OWN ROOT is the harness's page again, and
  // takes the harness's name (stage C of #1767 put the `fhir-artifact-index`
  // viewer at a DAK base layer's root). See `nameInstanceRoot`.
  nameInstanceRoot(visualisations, folio, decl);
  if (folio === undefined && section !== undefined) {
    findings.push(
      `${decl.name}: has no docs/ of its own, so the tile opens its section of the landing ` +
        `(${section}) rather than the instance's own themed root.`,
    );
  } else if (folio === undefined && firstViewer !== undefined) {
    findings.push(
      `${decl.name}: has no docs/ of its own, so the tile opens a kind handler's viewer ` +
        `(${firstViewer}) rather than the instance's own themed root.`,
    );
  }
  if (handled !== undefined && section === undefined) {
    findings.push(
      `${decl.name}: renders nothing of its own (render-exempt), so its tab opens one of its ` +
        `own files as published (${handled}), declared as \`reachableAt\`.`,
    );
  }

  return {
    name: decl.name,
    title: decl.title ?? decl.name,
    // Provisional. `disambiguate` is what settles it, because only the whole
    // set can say whether this title identifies anything.
    label: decl.title ?? decl.name,
    description: decl.description ?? "",
    ...(decl.summary ? { summary: decl.summary } : {}),
    ...(decl.alsoWritten ? { alsoWritten: decl.alsoWritten } : {}),
    footer: isExemptFrom(decl, "visualiser"),
    ...(decl.needs ? { needs: decl.needs } : {}),
    // `avatarRegion` rides the ICON too, when the icon image declares one.
    // None does today; the THEME avatar below is where the declared crops
    // actually live. Kept because the two are different questions: a layer
    // may declare a mark that wants cropping without having a theme at all.
    icon:
      iconSrc === undefined
        ? null
        : {
            src: iconSrc,
            title: icon?.title ?? "",
            ...(icon?.avatarRegion ? { region: icon.avatarRegion } : {}),
          },
    // THE THEME AVATAR — *"use theme avatar not the purply thing"*.
    //
    // I reported on 2026-09-22 that the harness->card assignment "does not
    // exist". THAT WAS WRONG, and the correction matters because it was the
    // reason gap 6 was left unwired: the assignment is THEME-MEDIATED and has
    // been all along. A layer contributes a sticky, the sticky names a
    // `theme`, the theme names an `imageRole`, and the layer's own images
    // carry that role per layout. `resolveThemeBackdrop` is the join and it
    // already returns the DeclaredImage, so the `avatarRegion` `603s` measured
    // comes with it. Nothing new is invented here; a chain that existed is
    // read.
    //
    // THE CARD LAYOUT, because it is the square one — 1254x1254 — and
    // `KgImageSchema` refuses a non-square `avatarRegion` in PIXELS. A
    // landscape layout would carry a box that is square in fractions and not
    // in pixels, which is exactly the stretch that refusal exists to stop.
    ...(themeAvatar ? { avatar: themeAvatar } : {}),
    /**
     * THE MARK THE NAVBAR SHOWS, resolved once here rather than branched on in
     * a template.
     *
     * Theme avatar first, the layer's own `icon` second, its registry
     * glyph third (bean `2vpn`). The precedence is
     * the owner's — *"use theme avatar not the purply thing"* — and it is
     * decided HERE because the alternative is five branches of Liquid
     * (`avatar` with a crop, `avatar` without, `icon` with a crop, `icon`
     * without, initial) that would each have to agree about the order.
     *
     * The crop rides whichever source won, so an ICON may be cropped too:
     * The IRIS replica declares the WHO emblem-and-wordmark at 581x178 and an
     * `avatarRegion` taking the leftmost square, which is the emblem. Before
     * this, a region on an icon was carried in the data and rendered by
     * nothing.
     */
    ...(navMark ? { mark: navMark } : {}),
    pageGround: {
      scopes: [
        ...new Set([`/${decl.name}/`, `/${artefactStub(decl)}/`, ...(siteMount && siteMount !== "/" ? [siteMount] : [])]),
      ],
      ...(siteMount === "/" ? { siteDefault: true as const } : {}),
      ...(groundComplete
        ? { art: groundSrcs as Record<"mobile" | "laptop" | "card", string>, title: theme!.name }
        : {}),
    },
    tone: own ? (themeTone ?? avatar.tone) : (resolvedTone ?? themeTone ?? avatar.tone),
    toneFrom: (themeTone !== undefined || (!own && resolvedTone !== undefined)) ? ("theme" as const) : ("avatar" as const),
    reads: own ? avatar.reads : BLANK_AVATAR.reads,
    genericAvatar: !own,
    instantiated,
    ...(href === undefined
      ? {}
      : {
          href,
          hrefKind:
            folio !== undefined
              ? ("folio" as const)
              : section !== undefined
                ? ("section" as const)
                : firstViewer !== undefined
                ? ("viewer" as const)
                : ("handled" as const),
        }),
    stats: [
      { id: "directories", label: "declared directories", value: dirs.length },
      { id: "kinds", label: "declared graph typologies", value: kinds.length },
      { id: "views", label: "visualisations you can open", value: visualisations.filter((v) => v.path).length },
    ],
    visualisations,
    // Paths REPOSITORY-relative: a declared `path` is the layer's own
    // (`library/`), and a reader needs to know which `library/`.
    subgraphs: subgraphsOf(
      decl,
      dirs.map((d) => ({ ...d, path: `${relative(repoRoot, join(instanceDir, d.path)).split("\\").join("/")}/` })),
    ),
    findings,
  };
}

/**
 * Every initiated harness, as a tile, with the footer layers last.
 *
 * `harnessRoot` is the layer that owns the published site — its `docs/` is
 * the site root, and it supplies the handler segment every subject page sits
 * under. `names` is the directory list to look in, passed rather than globbed
 * so a caller can test this against a fixture without a filesystem walk.
 */
export function harnessTiles(
  repoRoot: string,
  harnessRoot: string,
  names: readonly string[],
): HarnessTile[] {
  // THE SITE OWNER IS READ FIRST, because `siteDirFor` THROWS on a directory
  // with no declaration rather than returning a default — correctly, since a
  // guessed site root would write pages into a directory nobody named. A
  // caller pointed at a tree that has no harness gets no tiles, which is a
  // real answer; an exception here would take down the whole docs sync over a
  // question that has one.
  const ownerDecl = readDeclaration(harnessRoot);
  const handler = ownerDecl?.name;
  if (!handler) return [];
  const siteDir = join(harnessRoot, siteDirFor(harnessRoot));

  const tiles: HarnessTile[] = [];
  const decls: { dir: string; decl: CatHarnessDeclaration }[] = [];
  for (const dir of instanceDirs(repoRoot, names)) {
    let read = readDeclaration(dir);
    if (!read) continue;
    if (ownerDecl && read.name === ownerDecl.name) {
      read = ownerDecl;
    }
    // Viewers RESOLVED from the pages (#1168 B7a-2b): a directory no longer
    // names its viewer, the page names the directories it draws.
    // The REPOSITORY root passed explicitly: its default, `repoRootFor(dir)`, is
    // "the parent directory", which for the checkout root's own declaration is
    // the directory ABOVE the repository. Since cmsl step 2 (issue #1694) that
    // declaration holds `beans`/`todos`/`issue-marks`, so their dashboards went
    // undiscovered and the tiles rendered "no viewer yet".
    const decl = { ...read, directories: withViewers(read.directories ?? [], dir, repoRoot, siteDir) };
    decls.push({ dir, decl });
  }

  // THE ICON ROW IS RESOLVED OVER THE WHOLE SET, not per tile, because
  // inheritance is a question about the OTHER layers. Owner: *"should be in
  // each harness config which are shown (so some could show none, but make
  // this default in cat-harness that is inherited)."*
  //
  // `handler` is the floor rather than a literal `"cat-harness"`: the
  // site-owning layer is whoever declares this site, and naming it here
  // would be the hardcoded-four-names failure `builtOn` was declared to end.
  const declaredIcons = new Map(decls.map(({ decl }) => [decl.name, decl.navbarIcons]));
  const needsOf = new Map(decls.map(({ decl }) => [decl.name, decl.needs]));

  for (const { dir, decl } of decls) {
    const tile = tileFor(
      decl,
      handler,
      siteDir,
      dir === harnessRoot,
      repoRoot,
      dir === repoRoot,
      dir,
      ownerDecl ? { decl: ownerDecl, dir: harnessRoot } : undefined,
    );
    const icons = resolveNavbarIcons(decl.name, declaredIcons, needsOf, handler);
    // UNDETERMINED IS NOT EMPTY, and the field is omitted rather than set to
    // `[]` so a consumer cannot read "nobody decided" as "show none". That is
    // the distinction `navbarIcons`' own docs are about, and collapsing it
    // here would undo it one layer down.
    if (icons !== undefined) tile.navbarIcons = [...icons];
    tiles.push(tile);
  }

  // SUBSCRIBED HARNESSES (issue #1719, slice 7): a harness a subscription
  // chose, with `<name>.config.json` at the root and no local declaration, is
  // instantiated here and gets a tile drawn from its cached snapshot. A local
  // layer of the same name wins: `kg:instantiate` refuses that case, and
  // drawing both would be the duplicate `disambiguate` exists to flag.
  const local = new Set(decls.map(({ decl }) => decl.name));
  for (const h of subscribedHarnesses(repoRoot, decls)) {
    if (!h.instantiated || local.has(h.harness)) continue;
    local.add(h.harness);
    tiles.push(subscribedTile(h));
  }

  return orderTiles(disambiguate(tiles));
}

/**
 * Make every tile's label identify its subject, and say when it did not.
 *
 * A duplicate is qualified with the layer's own directory name, which IS
 * unique — it is the directory the declaration was read from. `folio-assistant`
 * and `folio-assistant (cat-harness)` are then two labels a reader can act on.
 *
 * **The finding is not optional.** Two tiles that read the same and link the
 * same place are indistinguishable from one tile rendered twice, and this
 * repository has already paid for a defect of exactly that shape — a count
 * that was not the thing it counted. Qualifying the label fixes what a reader
 * sees; the finding is what tells somebody a declaration is ambiguous.
 */
/**
 * A source path under the site directory, as the URL the built site serves it at.
 *
 * ## The defect this closes, measured rather than argued
 *
 * This was `replace(/index\.html$/, "")` inline — it handled the `.html` case
 * and silently passed a `.md` path through as if it were a URL. Owner,
 * 2026-09-22: *"fix the .md paths in the harness tabs too."*
 *
 * Swept with a HEAD request per link against a local build, 2026-09-22:
 * **3 of 31** distinct harness-tab links returned 404, and all three were the
 * `index.md` ones — `/processes/index.md`, `/tools/index.md`,
 * `/fsh-guts/index.md`. The other 28 were fine, so this is the whole of it and
 * not a sample.
 *
 * **The declaration was never wrong.** A `coverage` ref names a SOURCE FILE —
 * that is what `resolveCoveragePath` resolves it to, on disk. The bug was
 * treating a source path as a URL, which is a conversion with exactly one
 * correct home: here.
 *
 * ## The rules are Jekyll's, and they were verified, not assumed
 *
 * `_config.yml` sets **no** `permalink`, so Jekyll's default applies. Checked
 * against the built site rather than read off the documentation:
 *
 * | source | served at | measured |
 * |---|---|---|
 * | `processes/index.md` | `/processes/` | 200 |
 * | `tool-graph.md` | `/concepts/tool-graph.html` | 200 |
 * | `tool-graph.md` | ~~`/tool-graph/`~~ | **404** |
 *
 * So an `index` leaf addresses as its directory and every other page addresses
 * as itself with an `.html` extension. The second row is why this does not
 * simply strip `.md`: that would have produced `/tool-graph/`, which is a 404
 * this repository would have shipped in place of the one it had.
 *
 * **If a `permalink` is ever set, this becomes wrong** — and it will be wrong
 * silently, because a 404 behind a tab looks like a broken site rather than a
 * stale rule. The test pins the three cases above; a `permalink` added to
 * `_config.yml` should send somebody here.
 */
/**
 * A declared crop, solved into the four values CSS wants.
 *
 * The image is scaled by `1/w` and `1/h` and then offset by `-x` and `-y` OF
 * THE SCALED image, which is why the offsets divide by the same fractions.
 * `navbar.ts`'s `mark()` does the identical sum for a mounted page, and
 * `sync-docs-harness.ts` for the site title.
 *
 * SOLVED IN TYPESCRIPT because the consumer is Liquid, which cannot be trusted
 * to divide two floats without quietly producing an integer.
 *
 * EXPORTED so that the one test that matters about it can be written: that it
 * and `mark()` agree. Two copies of one sum, each with its own test asserting
 * its own copy, is exactly the shape that let the navbar widths be stated
 * twice and both be green (`sjic`). The only way that cannot happen is a test
 * that reads both, which needs both reachable.
 */
export function solveCrop(r: { x: number; y: number; w: number; h: number }): {
  width: number;
  height: number;
  left: number;
  top: number;
} {
  return {
    width: +(100 / r.w).toFixed(4),
    height: +(100 / r.h).toFixed(4),
    left: +((-100 * r.x) / r.w).toFixed(4),
    top: +((-100 * r.y) / r.h).toFixed(4),
  };
}

/**
 * Is this checkout-root layer's site GENERATED — no authored site on disk,
 * every page written into the site source at publish (litlfred/smart-ra)?
 *
 * "Authored" is a Jekyll config or a home page, not the directory existing:
 * the build's own `gen-landing-data` step writes `docs/_data/stickies.json`
 * into such a checkout before `compose-docs` runs, and a test on the
 * directory alone flipped the answer mid-build — the Folders rows then
 * linked to the platform (found on smart-ra's preview, 2026-10-14).
 */
export function isGeneratedSite(instanceDir: string): boolean {
  const site = join(instanceDir, siteDirFor(instanceDir));
  return !["_config.yml", "index.md", "index.html"].some((f) => existsSync(join(site, f)));
}

/**
 * On a generated site, the published path of a viewer its `writer` builds:
 * the ref IS the site path (core's `landingLinks` rule). Undefined for a ref
 * on disk, one with no writer, or one that is absolute or climbs out. The
 * one rule `harnessTiles` and `foreign-site-scope`'s `rootOwnPages` share, so
 * the Folders row and the scope that keeps it on this site cannot disagree.
 */
export function generatedPageOf(repoRoot: string, v: { ref: string; writer?: readonly string[] }): string | undefined {
  if (v.writer === undefined || v.ref.startsWith("/") || v.ref.split("/").includes("..")) return undefined;
  if (existsSync(join(repoRoot, v.ref))) return undefined;
  return publishedUrlOf(v.ref);
}

export function publishedUrlOf(relPathUnderSite: string): string {
  const withoutIndex = relPathUnderSite.replace(/(^|\/)index\.(html|md)$/, "$1");
  // Only a LEAF page is rewritten. A path already ending in `/` is a
  // directory and addresses as itself.
  return `/${withoutIndex.replace(/\.md$/, ".html")}`;
}

export function disambiguate(tiles: readonly HarnessTile[]): HarnessTile[] {
  const byTitle = new Map<string, number>();
  for (const t of tiles) byTitle.set(t.title, (byTitle.get(t.title) ?? 0) + 1);
  return tiles.map((t) => {
    if ((byTitle.get(t.title) ?? 0) < 2) return t;
    // `folio-assistant (folio-assistant)` says nothing twice. When the title
    // IS the directory name there is no further fact to add, so the label is
    // left alone and the other tiles carry the qualifier — which is what makes
    // the pair distinguishable.
    return {
      ...t,
      label: t.name === t.title ? t.title : `${t.title} (${t.name})`,
      findings: [
        ...t.findings,
        `${t.name}: its title "${t.title}" is also another instance's. The tile is ` +
          `labelled with its directory name as well, because a label that does not ` +
          `identify its subject is not a label.`,
      ],
    };
  });
}

const byName = (a: HarnessTile, b: HarnessTile) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * Top to bottom: the most derived layer first, the floor last.
 *
 * The owner, 2026-09-20, giving the spine in one sentence:
 *
 * > So bootsteap, cat harness, fa-core, f-a, from bottom to top.
 *
 * That is **dependency order, reversed** — the foundation at the bottom and
 * what is built on it above, which is how a layer diagram is drawn everywhere
 * else in this repository. So it is computed from the declared `needs` rather
 * than written out as four names: a list of names would be a rule true only
 * for the layers somebody remembered, which is exactly why
 * `bootstrap`'s footer position is read from its declared exemption
 * instead of from its name.
 *
 * ## The sort is `flattenDependencies`, not a second topological sort
 *
 * `dependency-order.ts` exists because *"a repeatable subprocess is a thing
 * with one implementation"* — its own words, and it names four callers that
 * would otherwise each write their own. This is the fourth. `fatal` is
 * required there because a RUNNER must not inherit a failure policy nobody
 * chose; nothing is run here, so every step takes `false` and the field is
 * carried rather than consulted.
 *
 * ## A layer with no declared layer is UNDETERMINED, and says so
 *
 * `flattenDependencies` is free to put a node that needs nothing first, so an
 * unlabelled layer would land on the floor beside the bootstrap — asserting
 * something nobody declared. They are partitioned out instead and listed
 * above the spine, alphabetically, with a finding. Absent is not `[]`.
 *
 * ## A broken graph does not blank the navbar
 *
 * `flattenDependencies` returns an EMPTY order when it finds a cycle or a
 * missing dependency, which is right for a pipeline — a partial order over a
 * broken graph is the shape that gets run anyway. A sidebar is not a pipeline:
 * showing nothing hides every layer over one typo. So the problems are
 * reported on the tiles and the list falls back to alphabetical, which is
 * undetermined rather than wrong.
 */
export function orderTiles(tiles: readonly HarnessTile[]): HarnessTile[] {
  const known = new Set(tiles.map((t) => t.name));
  const needed = new Set(tiles.flatMap((t) => [...(t.needs ?? [])]));
  const spine = tiles.filter((t) => t.needs !== undefined || needed.has(t.name));
  const unplaced = tiles.filter((t) => !spine.includes(t)).sort(byName);
  for (const t of unplaced) {
    t.findings.push(
      `${t.name}: declares no \`needs\`, so its place in the stack is alphabetical rather than derived.`,
    );
  }

  const { order, problems } = flattenDependencies(
    // Declaration order is what `flattenDependencies` breaks ties on, so the
    // input is sorted by name: two layers on the same layer then read
    // alphabetically instead of in whichever order the directory was walked.
    [...spine].sort(byName).map((t) => ({
      id: t.name,
      needs: (t.needs ?? []).filter((n) => known.has(n)),
      fatal: false,
    })),
  );
  const dangling = spine.flatMap((t) =>
    (t.needs ?? [])
      .filter((n) => !known.has(n))
      .map((n) => `${t.name}: needs "${n}", which names no instance in this tree.`),
  );
  for (const p of [...problems.map((p) => p.detail), ...dangling]) {
    const owner = tiles.find((t) => p.startsWith(`${t.name}:`)) ?? tiles[0];
    owner?.findings.push(p);
  }
  if (problems.length > 0) return [...tiles].sort(byName);

  const byId = new Map(spine.map((t) => [t.name, t]));
  // REVERSED: `flattenDependencies` yields foundation-first, and the owner
  // asked for bottom-to-top.
  const stack = [...order].reverse().map((s) => byId.get(s.id)!);
  // THE MOST DERIVED LAYER IS ON TOP, and the undetermined sit under it.
  //
  // The owner, 2026-09-21: *"in reverse dep order (so bootsrap on bottom,
  // folio-asst, on top)"*. The first version put the whole unplaced group
  // above the spine, which left `folio-assistant` eighth from the top — the
  // sentence's two endpoints were both wrong.
  //
  // So the spine's head keeps the top and its floor keeps the bottom, and a
  // layer whose layer nobody declared goes immediately BELOW the head:
  // the only thing known about it is that it is neither the root layer nor
  // the floor. It still carries the finding that says its place is not derived.
  const [head, ...rest] = stack;
  return floorLast(head === undefined ? unplaced : [head, ...unplaced, ...rest]);
}

/**
 * The declared floor goes last, whatever the dependency graph said.
 *
 * TWO RULES THAT AGREE TODAY, kept as two on purpose. The dependency order
 * puts `bootstrap` last because it is what everything sits on; its own
 * `renderExemption` puts it last because *"bootstrap IS the navbar
 * footer"*. In this repository they give the same answer, and a test asserts
 * it.
 *
 * They are not the same rule, though, and collapsing them would lose the one
 * that survives a missing declaration: a layer that declares no `needs`
 * is undetermined and would float to the top of the unplaced group, so a
 * bootstrap whose layer nobody wrote down would land ABOVE everything it
 * underpins. The exemption is the fact that does not depend on the ordering
 * having been declared, so it is applied last and wins.
 *
 * A stable partition rather than a comparator, so two exempt layers keep
 * the order the stack gave them.
 */
function floorLast(tiles: readonly HarnessTile[]): HarnessTile[] {
  return [...tiles.filter((t) => !t.footer), ...tiles.filter((t) => t.footer)];
}
