/**
 * The harness data a FOLIO's own site serves, scoped to that folio (#2263).
 *
 * The owner's words, and the site they were said about, are on issue #2263 and
 * in the `harness-tiles` skill: an IG repository's own site showed the
 * PLATFORM's bean and todo counts, and its bean and todo links 404'd. This
 * module names no layer -- the platform does not know its dependents.
 *
 * ## What went wrong
 *
 * An IG repository's own site (the IG-repository site template) is built
 * inside the platform's chrome: `compose-docs.ts
 * --shell` copies the platform's `_data/` and `assets/`. Two of those are not
 * chrome at all — they are PROJECTIONS OF THE PLATFORM'S OWN GRAPHS:
 *
 * - `_data/harness.json` — the tiles (with the platform's baked counts: beans
 *   916, todos 3), the navbar icon row, the rail's folders and scopes, the
 *   harness rows, the site's title. Every path in it is ROOT-relative to the
 *   PLATFORM's site (`/beans/`), so on `/<folio>/` it resolves to
 *   `/<folio>/beans/`, which does not exist.
 * - `assets/<graph>/count.json` and `index.json` — the platform's bean and
 *   todo indexes, which the icon row's badges fetch from the page's OWN site.
 *   So the folio's rail showed the platform's 537 open beans.
 *
 * `_includes/generated/` was already blanked in a shell for the same reason
 * (#2235 F1); these two were the same kind of thing and were not.
 *
 * Two more of the same kind outlived that fix (the #2263 follow-up):
 *
 * - `_data/translation-qa.json` and `_data/translations.json` — the platform's
 *   translation sweep and translation index. Every folio page's title badge
 *   read the sweep as its own site's ("Swept 49/689"), and with a locale
 *   chosen the index rewrote the folio's own Home link to `/<folio>/fr/`,
 *   which 404s: the index's paths are the platform's pages.
 * - `fsh-guts`. Its icon was re-based to the platform's page as a link, but on
 *   a page that loads `docs-ui.js` the icon is a BUTTON whose count is
 *   fetched from `<this site>/fsh-guts.json` -- which a folio's site does not
 *   publish -- so it showed "?", an error, where the truth is "absent".
 *
 * ## The rule this applies
 *
 * **A page's tiles describe the layer whose site the page is on.**
 *
 * - A tile, icon or folder over a graph the FOLIO declares stays, and resolves
 *   on the folio's own site (`/<instance>/x` → `/x`).
 * - A tile over a **`state`** graph the folio does not declare (beans, todos,
 *   QA, health, uploads …) is NOT borrowed: no link and no count. State is a
 *   fact about one layer's work, and another layer's number is not this
 *   folio's — `zero` would be a lie too, because the folio has not said
 *   (`schemas/ui/tile-count.ts`: absent is a third state). The icon row says why
 *   in words (`harness-tiles` §"An inert row SAYS why").
 * - A tile over the PLATFORM's content, context or derived graphs (skills,
 *   processes, tools, schemas, docs …) is re-based to the platform's
 *   published site, absolute, with its qualifier SHOWN so it reads as the
 *   platform's — and its count dropped, because a count beside another
 *   site's link is still another layer's number on this page.
 * - A kind this module cannot classify is treated as state: the
 *   conservative direction, since a missing link is visible and a wrong
 *   number is not.
 *
 * **No root-relative path survives.** Every href leaves here either
 * absolute on the platform, or as a path inside the folio's own root.
 *
 * **The same rule binds a FIGURE that is not a tile.** A badge or count the
 * chrome reads from the page's own site describes the folio or is not shown:
 * the host's data behind it is left out of the shell
 * ({@link HOST_DATA_PROJECTIONS}), and the chrome is told, in
 * `foreignSite.absent`, what to SAY instead of a number. Absent is not zero.
 *
 * @module scripts/lib/foreign-site-scope
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { readDeclaration, siteDirFor, visualisationResolves, visualisationsOf } from "../../schemas/kg/cat-harness.js";
import { defaultGraphTypologies } from "../../schemas/kg/graph-typology-registry.ts";
import { layerRootsIn } from "../../schemas/kg/instance-roots.ts";
import { generatedPageOf, isGeneratedSite, publishedUrlOf } from "../harness-tiles.ts";

/** What the scoping needs to know about the site and the declarations. */
export interface ForeignScope {
  /** The folio layer whose site this is, or undefined when the caller cannot say. */
  instance?: string;
  /** The platform's published root, no trailing slash: `https://litlfred.github.io/folio-assistant`. */
  platformBase: string;
  /** The graph kinds the folio ITSELF declares. Empty when it declares none or is unknown. */
  ownKinds: ReadonlySet<string>;
  /** A directory id's declared kinds, across every declaration the platform holds; undefined when unknown. */
  kindsOf: (directoryId: string) => readonly string[] | undefined;
  /** Which layer a kind holds (`content`, `context`, `state`, `derived`); undefined when the kind is unknown. */
  holdsOf: (kind: string) => string | undefined;
  /** The site's own title — what its header and home row say. */
  title?: string;
  /**
   * The site paths the folio's OWN declaration publishes at this site's root
   * (`/beans/`, `/schemas/`), when the folio is the root of the checkout the
   * harness data was generated from. Issue #46, gap 1: such a folio's pages are
   * written root-relative, not under `/<instance>/`, and were read as "not
   * published on this site". Undefined when the folio is not the root.
   */
  ownPages?: ReadonlySet<string>;
}

type Json = Record<string, unknown>;

const isAbsoluteUrl = (p: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith("//");

/**
 * Where a site-absolute path goes on a FOLIO's site: inside the folio's own
 * root when it is under `/<instance>/`, else on the platform's site.
 * Absolute URLs and non-root paths (`#x`, `x.html`) pass through.
 */
export function siteHref(p: string, scope: Pick<ForeignScope, "instance" | "platformBase" | "ownPages">): string {
  if (isAbsoluteUrl(p) || !p.startsWith("/")) return p;
  if (scope.ownPages?.has(p)) return p;
  if (scope.instance) {
    const own = `/${scope.instance}/`;
    if (p === own.slice(0, -1) || p === own) return "/";
    if (p.startsWith(own)) return `/${p.slice(own.length)}`;
  }
  return `${scope.platformBase}${p}`;
}

/** Is `p` a path inside the folio's own root (`/<instance>/…`), or a page its declaration publishes at this site's root? */
export function isOwnPath(p: string, scope: Pick<ForeignScope, "instance" | "ownPages">): boolean {
  if (scope.ownPages?.has(p)) return true;
  if (!scope.instance) return false;
  const own = `/${scope.instance}/`;
  return p === own.slice(0, -1) || p.startsWith(own);
}

/**
 * Is a graph of these kinds one a folio's site must not borrow from another
 * layer? A STATE graph is a fact about one layer's work; a kind this
 * module cannot classify is treated the same way, the conservative direction.
 * Ownership is decided by WHERE the link points (`isOwnPath`), never by the
 * folio declaring a kind of the same name: an IG folio declares a `qa`
 * directory, and the platform's QA tile is still the platform's QA.
 */
export function isStateLike(kinds: readonly string[] | undefined, scope: Pick<ForeignScope, "holdsOf">): boolean {
  if (!kinds || kinds.length === 0) return true;
  return kinds.some((k) => {
    const layer = scope.holdsOf(k);
    return layer === undefined || layer === "state";
  });
}

/** The words an inert slot says, so absence is stated rather than drawn. */
export function absentNote(kind: string, scope: ForeignScope): string {
  const who = scope.instance ?? "this site";
  return scope.ownKinds.has(kind) ? `${who}'s ${kind} graph is not published on this site` : `${who} declares no ${kind} graph`;
}

/** One link on a folio's site: its own (resolved here), the platform's (absolute), or none, with why. */
export function scopeLink(
  path: string,
  kinds: readonly string[] | undefined,
  scope: ForeignScope,
): { href: string; own: boolean } | { note: string } {
  if (isAbsoluteUrl(path) || !path.startsWith("/")) return { href: path, own: false };
  if (isOwnPath(path, scope)) return { href: siteHref(path, scope), own: true };
  if (isStateLike(kinds, scope)) return { note: absentNote(kinds?.[0] ?? "this", scope) };
  return { href: siteHref(path, scope), own: false };
}

interface Tile extends Json {
  id: string;
  directory: string;
  href?: string;
  count?: number;
  unit?: string;
  qualifier?: string;
  showQualifier?: true;
}

/**
 * The graph tiles, scoped. An own tile keeps its count. A borrowed one loses
 * it, and shows its qualifier so it reads as the platform's. A state tile
 * that is not the folio's loses its link, and the client draws no tile
 * without one (`pb04`).
 */
export function scopeTiles(tiles: readonly Tile[], scope: ForeignScope): Tile[] {
  return tiles.map((t) => {
    const { href, count: _c, unit: _u, showQualifier: _s, ...rest } = t;
    if (!href) return rest as Tile;
    const l = scopeLink(href, scope.kindsOf(t.directory), scope);
    if ("note" in l) return rest as Tile;
    if (l.own) return { ...t, href: l.href };
    return { ...rest, href: l.href, ...(t.qualifier ? { showQualifier: true as const } : {}) } as Tile;
  });
}

interface NavbarRow extends Json {
  icons?: string[];
  hrefs?: Record<string, string>;
  notes?: Record<string, string>;
  folders?: Json[];
}

/**
 * The navbar icon row and its folders, scoped. An icon id names its kind
 * (`todos`, `beans`, `fsh-guts`); a folder carries `kind`. A slot with no
 * link keeps its place and SAYS why (`harness-tiles` §"An inert row SAYS
 * why"), so "where are this folio's beans" is answered rather than blank.
 */
export function scopeNavbarRow(row: unknown, scope: ForeignScope): unknown {
  if (!row || typeof row !== "object") return row;
  const r = row as NavbarRow;
  const hrefs: Record<string, string> = {};
  const notes: Record<string, string> = { ...(r.notes ?? {}) };
  // WHOSE a borrowed link is: the icon row has no qualifier to show, so an
  // icon re-based onto the platform says so in its accessible name, the way
  // a borrowed tile shows its qualifier.
  const whose: Record<string, string> = {};
  for (const [id, href] of Object.entries(r.hrefs ?? {})) {
    const l = scopeLink(href, [id], scope);
    if ("note" in l) notes[id] = l.note;
    else {
      hrefs[id] = l.href;
      if (!l.own && isAbsoluteUrl(l.href) && !isAbsoluteUrl(href)) whose[id] = `the platform's: ${absentNote(id, scope)}`;
    }
  }
  const folders = Array.isArray(r.folders)
    ? r.folders.map((f) => {
        const { path, ...rest } = f;
        if (typeof path !== "string") return f;
        const l = scopeLink(path, typeof f.kind === "string" ? [f.kind] : undefined, scope);
        return "note" in l ? { ...rest, note: l.note } : { ...rest, path: l.href };
      })
    : r.folders;
  return { ...r, hrefs, notes, ...(Object.keys(whose).length ? { whose } : {}), ...(folders ? { folders } : {}) };
}

/**
 * The rail scopes, scoped: only the folio's own, at this site's root. Every
 * other layer's scope names a route that does not exist here, and the
 * platform's root scope would have listed the platform's folders on every
 * folio page ("FOLDERS 29" on an IG folio's pages).
 */
export function scopeRailScopes(scopes: unknown, scope: ForeignScope): unknown[] {
  if (!Array.isArray(scopes) || !scope.instance) return [];
  return scopes
    .filter((s): s is Json => !!s && typeof s === "object" && (s as Json).name === scope.instance)
    .map((s) => ({
      ...s,
      href: "/",
      ...(Array.isArray(s.folders)
        ? {
            folders: (s.folders as Json[]).map((f) => {
              const { path, ...rest } = f;
              return typeof path === "string" ? { ...rest, path: siteHref(path, scope) } : f;
            }),
          }
        : {}),
    }));
}

/** Every `path` string in a nested value, made to resolve on this site. */
function deepPaths(v: unknown, scope: ForeignScope): unknown {
  if (Array.isArray(v)) return v.map((x) => deepPaths(x, scope));
  if (!v || typeof v !== "object") return v;
  return Object.fromEntries(
    Object.entries(v as Json).map(([k, x]) => [k, (k === "path" || k === "href") && typeof x === "string" ? siteHref(x, scope) : deepPaths(x, scope)]),
  );
}

/**
 * `_data/harness.json` as a folio's site must serve it. Pure: the caller
 * reads and writes the file.
 */
export function scopeHarnessData(data: Json, scope: ForeignScope): Json {
  const tiles = Array.isArray(data.tiles) ? scopeTiles(data.tiles as Tile[], scope) : data.tiles;
  const linked = new Set(Array.isArray(tiles) ? (tiles as Tile[]).filter((t) => t.href).map((t) => t.id) : []);
  const glass = data.glassStrip as { pinned?: string[] } | undefined;
  const navbar = scopeNavbarRow(data.navbar, scope) as NavbarRow | undefined;
  const links = Array.isArray(data.links)
    ? (data.links as Json[]).map((l) => {
        const { path, ...rest } = l;
        // The site links (`kg`, `jsonld`) are the PLATFORM's graph; an absolute
        // `url` is printed as-is by head_custom.html.
        return typeof path === "string" ? { ...rest, url: siteHref(path, { platformBase: scope.platformBase }) } : l;
      })
    : data.links;
  return {
    ...data,
    ...(scope.title ? { title: scope.title } : {}),
    tiles,
    ...(glass && Array.isArray(glass.pinned)
      ? { glassStrip: { ...glass, pinned: glass.pinned.filter((id) => id.startsWith("glass-") || linked.has(id)) } }
      : {}),
    links,
    navbar,
    railScopes: scopeRailScopes(data.railScopes, scope),
    ...(Array.isArray(data.harnesses) ? { harnesses: deepPaths(data.harnesses, scope) } : {}),
    ...(data.config ? { config: deepPaths(data.config, { ...scope, instance: undefined }) } : {}),
    foreignSite: {
      ...(scope.instance ? { instance: scope.instance } : {}),
      platformBase: scope.platformBase,
      absent: absentFigures(navbar, scope),
    },
  };
}

const escHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The footer line a folio's site prints in place of the platform's.
 *
 * The platform's `_config.yml` `footer_content` describes the PLATFORM — its
 * name and the licences of its code and documentation. Shipped in a shell it
 * was printed on every page of a folio's site as if it described the folio,
 * which is the same defect as a borrowed tile: another layer's facts on
 * this site's page.
 *
 * A declaration carries no footer or licence field, so there is no folio text
 * to prefer here; the line names the folio (its `title`, else its layer
 * name) and says what built it, linking the platform's site absolutely. It
 * states NO licence: absent is not zero, and a licence the folio has not
 * declared is not one the platform may print for it.
 *
 * @param platformName what the platform calls itself — its own config's `title`.
 */
/**
 * The landing stickies (`_data/stickies.json`), scoped to a folio's site: a
 * sticky link that is a path on the PLATFORM's site (`/docs/cat-harness/…`) is
 * re-based onto it with {@link siteHref}, and marked `external`, because the
 * landing template applies `relative_url` only to a non-external link and
 * doing that to an absolute URL breaks it. A link inside the folio's own root
 * stays the folio's. Found on the IRIS replica's own site (2026-10-09): the platform's
 * sticky linked `/docs/cat-harness/concepts/…` under the folio's baseurl, where
 * no such page is.
 */
export function scopeStickies(data: Json, scope: Pick<ForeignScope, "instance" | "platformBase">): Json {
  const stickies = Array.isArray(data.stickies) ? data.stickies : undefined;
  if (!stickies) return data;
  return {
    ...data,
    stickies: stickies.map((st) => {
      if (!st || typeof st !== "object" || !Array.isArray((st as Json).links)) return st;
      const links = ((st as Json).links as Json[]).map((l) => {
        if (!l || typeof l !== "object" || l.external === true || typeof l.href !== "string") return l;
        const href = siteHref(l.href, scope);
        return href === l.href ? l : { ...l, href, external: isAbsoluteUrl(href) };
      });
      return { ...(st as Json), links };
    }),
  };
}

export function foreignFooterContent(scope: Pick<ForeignScope, "instance" | "title" | "platformBase">, platformName: string): string {
  const who = scope.title ?? scope.instance;
  const link = `<a href="${escHtml(`${scope.platformBase}/`)}">${escHtml(platformName)}</a>`;
  return who ? `${escHtml(who)} — built with ${link}.` : `This site is built with ${link}.`;
}

/**
 * The shell's merged `_config.yml` as a folio's site must serve it: the
 * platform's `footer_content` replaced by {@link foreignFooterContent}. Pure;
 * a config with no `footer_content` comes back unchanged, since there is then
 * no platform text to keep off the folio's pages.
 */
export function scopeSiteConfig(config: Json, scope: Pick<ForeignScope, "instance" | "title" | "platformBase">): Json {
  if (!Object.hasOwn(config, "footer_content")) return config;
  const platformName = typeof config.title === "string" && config.title ? config.title : "the platform";
  return { ...config, footer_content: foreignFooterContent(scope, platformName) };
}

/**
 * The host's `_data/` files that are PROJECTIONS of the host's own pages, not
 * chrome, and what their absence makes the chrome say on a folio's site.
 * `compose-docs --shell` leaves each one out ({@link isHostProjection}); the
 * folio's own build may write its own in their place, and then the chrome
 * shows the folio's figure, because the Liquid reads whatever file is there.
 *
 * Named rather than sniffed: neither file declares what it is about, and the
 * `tile` test that finds the `assets/` projections does not reach them. A new
 * data file that describes the host's pages is a new row here, and
 * `foreign-site-scope.test.ts` fails on the shell until it is one.
 */
export const HOST_DATA_PROJECTIONS: Readonly<Record<string, { what: string; absent: string }>> = {
  // The title badge read it as this site's sweep: "Swept 49/689" on every
  // page of an IG folio's site was the platform's 49 translated pages out of 689.
  "_data/translation-qa.json": {
    what: "the platform's translation QA sweep (pages swept, pages translated)",
    absent: "the sweep badge says no sweep is published for this site — not 'not run', which would be a claim about the folio",
  },
  // Its paths are the platform's pages. With a locale chosen, the folio's own
  // Home ("/") matched the platform's "/" and became `/<folio>/fr/index.html`.
  "_data/translations.json": {
    what: "the platform's translation index (which of ITS pages exist in which locale)",
    absent: "the index reads as null — 'could not determine' — and the navbar is left exactly as built",
  },
};

/** The words for a figure the folio's site does not publish. */
export function absentFigureNote(what: string, scope: Pick<ForeignScope, "instance">): string {
  return `${scope.instance ?? "this site"} publishes no ${what} on this site`;
}

/**
 * What the chrome must SAY rather than count, per figure, on a folio's site.
 * Read by `head_custom.html` (`site.data.harness.foreignSite.absent`).
 *
 * - `translationQa`: used only when the site carries no
 *   `_data/translation-qa.json` of its own.
 * - `fshGuts`: present unless the folio's OWN fsh-guts graph is linked. The
 *   icon's count is fetched from this site's `/fsh-guts.json`; a folio that
 *   does not publish one would otherwise show "?" — an error, for what is an
 *   absence.
 */
function absentFigures(navbar: NavbarRow | undefined, scope: ForeignScope): Record<string, string> {
  const fish = navbar?.hrefs?.["fsh-guts"];
  const ownFish = typeof fish === "string" && fish.startsWith("/") && !fish.startsWith("//");
  return {
    translationQa: absentFigureNote("translation QA sweep", scope),
    ...(ownFish ? {} : { fshGuts: navbar?.notes?.["fsh-guts"] ?? absentNote("fsh-guts", scope) }),
  };
}

/**
 * Is this file a projection of the HOST's graph rather than chrome? A JSON
 * asset declaring a headline `tile` count (`schemas/ui/tile-count.ts`) is one:
 * the bean and todo indexes and their `count.json`, the library, QA and
 * schema indexes. So is every {@link HOST_DATA_PROJECTIONS} data file. On a
 * folio's site either would be read as the folio's own.
 */
export function isHostProjection(rel: string, text: string): boolean {
  if (Object.hasOwn(HOST_DATA_PROJECTIONS, rel.replace(/\\/g, "/"))) return true;
  if (!/^assets[\\/].+\.json$/.test(rel)) return false;
  if (/^---\s*$/m.test(text.split("\n", 1)[0] ?? "")) return false; // Liquid-rendered from _data, scoped there
  try {
    const doc = JSON.parse(text) as unknown;
    return !!doc && typeof doc === "object" && !Array.isArray(doc) && "tile" in (doc as Json);
  } catch {
    return false;
  }
}

/** Every root-relative href or path left in scoped data — for the gate. Empty is the contract. */
export function rootRelativeLeft(data: unknown, at = ""): string[] {
  if (Array.isArray(data)) return data.flatMap((x, i) => rootRelativeLeft(x, `${at}[${i}]`));
  if (!data || typeof data !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(data as Json)) {
    const here = at ? `${at}.${k}` : k;
    if (typeof v === "string" && (k === "href" || k === "path") && v.startsWith("/") && !v.startsWith("//") && v !== "/") {
      out.push(`${here}=${v}`);
    } else if (k === "hrefs" && v && typeof v === "object") {
      for (const [id, h] of Object.entries(v as Json)) if (typeof h === "string" && h.startsWith("/") && !h.startsWith("//")) out.push(`${here}.${id}=${h}`);
    } else out.push(...rootRelativeLeft(v, here));
  }
  return out;
}

/**
 * Build a {@link ForeignScope} from the declarations a checkout holds: the
 * folio's OWN directories and kinds, and every declared directory's kinds.
 * A layer this checkout does not declare yields empty own sets — every
 * state tile is then unlinked, which is the conservative direction.
 */
export function foreignScopeFor(
  repo: string,
  opts: { instance?: string; platformBase: string; title?: string },
): ForeignScope {
  const decls = layerRootsIn(repo).flatMap((root) => {
    const d = readDeclaration(root);
    return d ? [d] : [];
  });
  const kinds = new Map<string, string[]>();
  for (const d of decls) {
    for (const dir of d.directories ?? []) {
      const ks = [...(dir.graphTypologies ?? [])];
      kinds.set(dir.id, [...new Set([...(kinds.get(dir.id) ?? []), ...ks])]);
    }
  }
  const own = opts.instance ? decls.find((d) => d.name === opts.instance) : undefined;
  const ownPages = opts.instance ? rootOwnPages(repo, opts.instance) : undefined;
  return {
    ...(ownPages ? { ownPages } : {}),
    ...(opts.instance ? { instance: opts.instance } : {}),
    platformBase: opts.platformBase.replace(/\/$/, ""),
    ownKinds: new Set((own?.directories ?? []).flatMap((d) => d.graphTypologies ?? [])),
    kindsOf: (id) => kinds.get(id),
    holdsOf: (k) => defaultGraphTypologies.get(k)?.holds,
    ...(opts.title ? { title: opts.title } : {}),
  };
}

/**
 * The pages a folio publishes at its OWN site's root: its declared
 * visualisers under its site directory, when the folio IS the checkout's root
 * (issue #46, gap 1). The same rule `harness-tiles.ts` applies to resolve
 * those visualisers (`ownsSite || isRepoRoot`) and to place the folio's icon,
 * so the scope and the tiles name the same paths. Undefined otherwise: a
 * folio mounted beneath the root publishes under `/<instance>/`, which
 * {@link isOwnPath} already reads.
 */
export function rootOwnPages(repo: string, instance: string): ReadonlySet<string> | undefined {
  const root = resolve(repo);
  const decl = readDeclaration(root);
  if (decl?.name !== instance) return undefined;
  const prefix = `${siteDirFor(root)}/`;
  // A GENERATED site (no site directory on disk) publishes a writer-built
  // viewer at its ref — `generatedPageOf`, the rule the tiles link it by.
  const generated = isGeneratedSite(root);
  const pages = new Set<string>();
  for (const d of decl.directories ?? []) {
    for (const v of visualisationsOf(d.coverage, d.id)) {
      if (!visualisationResolves(v, (p) => existsSync(join(root, p)))) continue;
      if (v.ref.startsWith(prefix)) pages.add(publishedUrlOf(v.ref.slice(prefix.length)));
      else if (generated) {
        const page = generatedPageOf(root, v);
        if (page !== undefined) pages.add(page);
      }
    }
  }
  return pages.size > 0 ? pages : undefined;
}
