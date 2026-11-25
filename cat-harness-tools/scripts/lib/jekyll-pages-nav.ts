/**
 * The rail's "Pages" section, built on the SERVER from a Jekyll site's source —
 * owner, 2026-10-15, "folio rail everywhere": ONE left-hand rail on every
 * site, including the just-the-docs ones, with a server-built Pages group.
 *
 * ## Why this exists
 *
 * On a just-the-docs site the page tree is the theme's `<nav id="site-nav">`,
 * built by Liquid from every page's front matter, and `docs-ui.js` folds it
 * under a "Pages" button in the browser (`mountNavPagesHeading`). The rail
 * (`nav.fa-nav`, `lib/navbar.ts`) had no such section, so a site could not
 * move to the rail without losing its pages. This reads the SAME front-matter
 * fields the theme reads and gives the rail the same tree as a
 * {@link NavItem} list, so the one rail can carry it.
 *
 * ## What it models, and what it refuses to guess
 *
 * just-the-docs' navigation rules, as far as a folio's site uses them:
 *
 * - a page is listed when it has a `title` and no `nav_exclude: true` (after
 *   applying `_config.yml`'s `defaults` for `pages`);
 * - pages whose URL sits under a harness's `docs` route (`/docs/<harness>/…`,
 *   `/<handler>/docs/<harness>/…`, `/<harness>/docs/…`) are grouped at the top
 *   level under that harness, derived from the URL and never from a hand-kept
 *   list (bean `xka5`);
 * - below a harness (or at the top level when no harness route is in the URL),
 *   a page with no `parent` is at that level's root; one with `parent: <title>`
 *   sits under the page of that title, and `grand_parent` disambiguates a
 *   parent title used twice;
 * - with `locale`, siblings within each level sort alphabetically in the
 *   reader's locale (`Intl.Collator`, keeping `/` first); without `locale`,
 *   siblings sort by `nav_order` then case-insensitive title;
 * - the address is Jekyll's (`jekyll-permalink.ts`): front-matter
 *   `permalink`, else the `_config.yml` default, else the source path.
 *
 * ## A page that declares its own navigation
 *
 * Front matter cannot say everything a page set's own menu says: a menu
 * entry that is not a Jekyll page (a generated page with no front matter, a
 * PDF, a link to another site), a group that is a label rather than a page,
 * and an order the author chose. A page that DECLARES its navigation
 * (`data-fa-visualiser-nav`, `navbar.ts`) has said all of that already, and
 * the rail draws the declaration as that page's own section. So, given the
 * declarations ({@link declaredNavsIn}), a Pages row whose page declares one
 * takes its children FROM the declaration: the same entries, in the same
 * order and nesting, under the same labels, with no re-sorting and no
 * folding. A front-matter child of that row the declaration does not reach
 * (neither it nor any page below it is listed there) is kept after the
 * declared entries, so no page vanishes; a front-matter page that only
 * stood in for a declared group (all its pages listed under the group) is
 * not drawn twice.
 *
 * A page whose `parent` names no listed page is kept at the top level and
 * REPORTED (`orphans`), never dropped: a page that vanishes from the
 * navigation reads as a page that does not exist.
 *
 * @module scripts/lib/jekyll-pages-nav
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import { pagePermalink, permalinkDefaultsIn, scopeApplies } from "./jekyll-permalink.ts";
import { VISUALISER_NAV_ATTR, type NavItem, type VisualiserNavEntry } from "./navbar.ts";

/** One page as the theme's navigation sees it. */
export interface JekyllNavPage {
  /** Site-relative source path, `/`-separated. */
  rel: string;
  title: string;
  /** Site-absolute URL, no `baseurl`: `/guides/`, `/about.html`. */
  url: string;
  parent?: string;
  grandParent?: string;
  navOrder?: number | string;
  lang?: string;
}

/** Directories Jekyll does not render as pages, or that are never navigation. */
const SKIP_DIR = /^(?:_|\.|assets$|vendor$|node_modules$)/;

function frontMatter(text: string): Record<string, unknown> | undefined {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return undefined;
  try {
    const v = parseYaml(m[1]!) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return undefined;
  }
}

interface FrontMatterDefault {
  path: string;
  values: Record<string, unknown>;
}

/** Front-matter `defaults` for pages in `siteDir`'s `_config.yml`, in file order. */
function frontMatterDefaultsIn(siteDir: string): FrontMatterDefault[] {
  const cfg = join(siteDir, "_config.yml");
  if (!existsSync(cfg)) return [];
  let parsed: unknown;
  try {
    parsed = parseYaml(readFileSync(cfg, "utf-8"));
  } catch {
    return [];
  }
  const defaults = (parsed as { defaults?: unknown } | null)?.defaults;
  if (!Array.isArray(defaults)) return [];
  const out: FrontMatterDefault[] = [];
  for (const d of defaults as Array<{ scope?: { path?: unknown; type?: unknown }; values?: unknown }>) {
    const type = d?.scope?.type;
    if (type !== undefined && type !== "pages") continue;
    const values = d?.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) continue;
    const path = typeof d?.scope?.path === "string" ? d.scope.path : "";
    out.push({ path, values: values as Record<string, unknown> });
  }
  return out;
}

/**
 * Effective front matter for `rel`: `_config.yml` `defaults` whose `scope.path`
 * covers `rel` (shortest path first so longer scopes and later entries win, as
 * in Jekyll's `FrontmatterDefaults#all`), overlaid by `own`. A page setting
 * `parent: ""` overrides a folder default's `parent` (bean `xka5`).
 */
function effectiveFrontMatter(
  rel: string,
  own: Record<string, unknown>,
  defaults: readonly FrontMatterDefault[],
): Record<string, unknown> {
  const matching = defaults
    .map((d, idx) => ({ d, idx }))
    .filter(({ d }) => scopeApplies(d.path, rel))
    .sort((a, b) => a.d.path.length - b.d.path.length || a.idx - b.idx);
  const merged: Record<string, unknown> = {};
  for (const { d } of matching) {
    for (const [k, v] of Object.entries(d.values)) merged[k] = v;
  }
  for (const [k, v] of Object.entries(own)) {
    if (v !== undefined) merged[k] = v;
  }
  return merged;
}

/** The pages a just-the-docs site's navigation lists, read from its SOURCE directory. */
export function jekyllNavPages(siteDir: string): JekyllNavPage[] {
  const defaults = permalinkDefaultsIn(siteDir);
  const fmDefaults = frontMatterDefaultsIn(siteDir);
  const out: JekyllNavPage[] = [];
  const walk = (dir: string, prefix: string): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP_DIR.test(e.name)) walk(join(dir, e.name), `${prefix}${e.name}/`);
        continue;
      }
      if (!/\.(md|markdown|html)$/i.test(e.name)) continue;
      const rel = `${prefix}${e.name}`;
      const rawFm = frontMatter(readFileSync(join(dir, e.name), "utf-8"));
      if (!rawFm) continue; // no front matter: Jekyll copies it through, it is not a page
      const fm = effectiveFrontMatter(rel, rawFm, fmDefaults);
      const title = typeof fm.title === "string" ? fm.title.trim() : "";
      if (!title || fm.nav_exclude === true) continue;
      const url = pagePermalink(rel, rawFm, defaults).replace(/(^|\/)index\.html$/, "$1");
      out.push({
        rel,
        title,
        url: url === "" ? "/" : url,
        ...(typeof fm.parent === "string" && fm.parent.trim() ? { parent: fm.parent.trim() } : {}),
        ...(typeof fm.grand_parent === "string" && fm.grand_parent.trim() ? { grandParent: fm.grand_parent.trim() } : {}),
        ...(typeof fm.nav_order === "number" || typeof fm.nav_order === "string" ? { navOrder: fm.nav_order } : {}),
        ...(typeof fm.lang === "string" && fm.lang.trim() ? { lang: fm.lang.trim() } : {}),
      });
    }
  };
  walk(siteDir, "");
  return out;
}

/**
 * The harness a page's URL places it under, derived from its `docs` route —
 * `/docs/<harness>/…`, `/<handler>/docs/<harness>/…`, or `/<harness>/docs/…`
 * — and `undefined` when the URL names no harness docs route. Bean `xka5`.
 */
export function harnessOfUrl(url: string): string | undefined {
  const clean = url.replace(/[?#].*$/, "");
  const segs = clean.split("/").filter(Boolean);
  if (segs[0] === "docs" && segs.length >= 2 && !segs[1]!.endsWith(".html")) return segs[1];
  if (segs[1] === "docs") {
    if (segs.length >= 3 && !segs[2]!.endsWith(".html")) return segs[2];
    if (!segs[0]!.endsWith(".html")) return segs[0];
  }
  return undefined;
}

function isHarnessDocsRoot(url: string, harness: string): boolean {
  const clean = url.replace(/[?#].*$/, "");
  return (
    clean === `/docs/${harness}/` ||
    clean === `/${harness}/docs/` ||
    (/^\/[^/]+\/docs\/[^/]+\/$/.test(clean) && clean.endsWith(`/docs/${harness}/`))
  );
}

function isHomeUrl(url: string): boolean {
  return url === "/" || /^\/[a-z]{2,3}(?:-[a-z0-9]+)*\/$/i.test(url);
}

function makeCollator(locale?: string): Intl.Collator {
  try {
    return new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  } catch {
    return new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
  }
}

/** The theme's sibling order: numeric `nav_order` first, then string ones, then none; ties by title. */
function byNavOrder(collator: Intl.Collator): (a: JekyllNavPage, b: JekyllNavPage) => number {
  const rank = (p: JekyllNavPage) => (typeof p.navOrder === "number" ? 0 : typeof p.navOrder === "string" ? 1 : 2);
  return (a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0 && a.navOrder !== b.navOrder) return (a.navOrder as number) - (b.navOrder as number);
    if (ra === 1 && a.navOrder !== b.navOrder) return collator.compare(String(a.navOrder), String(b.navOrder));
    return collator.compare(a.title, b.title);
  };
}

/**
 * Alphabetical order within a level in the reader's locale (`Intl.Collator`),
 * keeping the site or locale root (`/`, `/fr/`) first — bean `xka5`.
 */
function byLocaleTitle(collator: Intl.Collator): (a: JekyllNavPage, b: JekyllNavPage) => number {
  return (a, b) => {
    const ha = isHomeUrl(a.url);
    const hb = isHomeUrl(b.url);
    if (ha !== hb) return ha ? -1 : 1;
    return collator.compare(a.title, b.title);
  };
}

function shiftDepth(item: NavItem, delta: number): NavItem {
  const nextDepth = (item.depth ?? 0) + delta;
  const children = item.children?.map((c) => shiftDepth(c, delta));
  if (children && DECLARED_ROWS.has(item.children!)) DECLARED_ROWS.add(children);
  return {
    ...item,
    ...(nextDepth > 0 ? { depth: nextDepth } : {}),
    ...(children ? { children } : {}),
  };
}

/** The summary of a folded set of child pages — one wording. */
export function childPages(n: number): string {
  return n === 1 ? "1 page" : `${n} pages`;
}

/**
 * A page's declared navigation with every on-site href made site-absolute
 * (`/concepts.html`), as {@link pagesNav} takes it. An off-site href
 * (`https://…`) is kept as it is.
 */
export type DeclaredPageNav = readonly VisualiserNavEntry[];

/** The comparable form of a site-absolute URL: no query or fragment, `index.html` as its directory. */
function pageKey(url: string): string {
  return url.replace(/[?#].*$/, "").replace(/(^|\/)index\.html$/, "$1");
}

const OFF_SITE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * A declaration's entries read off a built page at `toRoot` (`.`, `..`), with
 * each on-site href made site-absolute. `undefined` when an href is neither
 * off-site nor under `toRoot` — an in-page anchor (`#x`) — because entries
 * that are places on one page are that page's contents, not pages.
 */
export function siteAbsoluteDeclaration(entries: readonly VisualiserNavEntry[], toRoot: string): DeclaredPageNav | undefined {
  const at = `${toRoot}/`;
  const abs = (href: string | undefined): string | undefined | false => {
    if (href === undefined || href === "") return undefined;
    if (OFF_SITE.test(href)) return href;
    if (href.startsWith(at)) return `/${href.slice(at.length)}`;
    return false;
  };
  const out: VisualiserNavEntry[] = [];
  for (const e of entries) {
    if (typeof e?.label !== "string" || !e.label) continue;
    const href = abs(typeof e.href === "string" ? e.href : undefined);
    if (href === false) return undefined;
    const items: Array<{ label: string; href?: string }> = [];
    for (const k of Array.isArray(e.items) ? e.items : []) {
      if (typeof k?.label !== "string" || !k.label) continue;
      const kh = abs(typeof k.href === "string" ? k.href : undefined);
      if (kh === false) return undefined;
      items.push({ label: k.label, ...(kh ? { href: kh } : {}) });
    }
    out.push({ label: e.label, ...(href ? { href } : {}), ...(items.length ? { items } : {}) });
  }
  return out.length ? out : undefined;
}

/**
 * The declared navigation of every listed page that has pages under it,
 * read off the BUILT site at `siteDir` before the rail is put in (the rail
 * moves a declaration into shared data). Keyed by the page's URL as
 * {@link JekyllNavPage.url} gives it. A page with no children is not read:
 * its declaration has no Pages rows to stand for.
 */
export function declaredNavsIn(siteDir: string, pages: readonly JekyllNavPage[]): Map<string, DeclaredPageNav> {
  const out = new Map<string, DeclaredPageNav>();
  const parents = new Set(pages.map((p) => p.parent).filter((t): t is string => t !== undefined));
  for (const p of pages) {
    if (!parents.has(p.title) || out.has(p.url)) continue;
    const rel = p.url.replace(/^\/+/, "").replace(/[?#].*$/, "");
    const file = rel === "" || rel.endsWith("/") ? `${rel}index.html` : rel;
    if (!/\.html$/i.test(file)) continue;
    const abs = join(siteDir, file);
    if (!existsSync(abs)) continue;
    const entries = visualiserNavEntriesOf(readFileSync(abs, "utf-8"));
    if (!entries) continue;
    const depth = file.split("/").length - 1;
    const declared = siteAbsoluteDeclaration(entries, depth === 0 ? "." : new Array(depth).fill("..").join("/"));
    if (declared) out.set(p.url, declared);
  }
  return out;
}

/**
 * The entries of a page's declared navigation (`visualiserNavDeclaration`,
 * `navbar.ts`), as written, or `undefined` when it declares none or declares
 * it badly. `visualiserNavOf` reads the same element into the page's own
 * section; it is not reused here because it returns rail rows, not entries,
 * and changing it changes the browser bundle (`navbar.js`) it is part of.
 */
export function visualiserNavEntriesOf(html: string): VisualiserNavEntry[] | undefined {
  const m = new RegExp(`<script\\b[^>]*\\b${VISUALISER_NAV_ATTR}\\b[^>]*>([\\s\\S]*?)</script>`, "i").exec(html);
  if (!m) return undefined;
  try {
    const raw = JSON.parse(m[1]!) as unknown;
    return Array.isArray(raw) ? (raw as VisualiserNavEntry[]) : undefined;
  } catch {
    return undefined;
  }
}

/** Children arrays drawn from a declaration: never re-sorted or folded. */
const DECLARED_ROWS = new WeakSet<readonly NavItem[]>();

/**
 * The page tree as rail rows. `prefix` is put before every site-absolute URL
 * (`..` for a page one level down; `""` for Liquid, whose `relative_url` adds
 * the base). `here` — the current page's URL — is drawn as "you are here".
 * `locale` orders each level alphabetically in the reader's locale (bean `xka5`).
 * `declared` gives, by page URL, the navigation a page declares
 * ({@link declaredNavsIn}); that page's children are drawn from it.
 */
export function pagesNav(
  pages: readonly JekyllNavPage[],
  o: { prefix?: string; here?: string; locale?: string; declared?: ReadonlyMap<string, DeclaredPageNav> } = {},
): { items: NavItem[]; orphans: string[] } {
  const prefix = o.prefix ?? "";
  const collator = makeCollator(o.locale);
  const cmp = o.locale !== undefined ? byLocaleTitle(collator) : byNavOrder(collator);
  const listed = new Set(pages.map((p) => p.title));
  const orphans = pages.filter((p) => p.parent !== undefined && !listed.has(p.parent)).map((p) => p.rel);
  const kidsOf = (parent: JekyllNavPage | undefined, grand: JekyllNavPage | undefined): JekyllNavPage[] =>
    pages
      .filter((p) =>
        parent === undefined
          ? p.parent === undefined || !listed.has(p.parent)
          : p.parent === parent.title && (p.grandParent === undefined || p.grandParent === grand?.title) && p !== parent,
      )
      .sort(cmp);
  const hrefOf = (url: string): { href: string } | { current: true } =>
    !OFF_SITE.test(url) && o.here !== undefined && pageKey(o.here) === pageKey(url)
      ? { current: true }
      : { href: OFF_SITE.test(url) ? url : `${prefix}${url}` };
  /** Every page at or below `p` in the front-matter tree. */
  const below = (p: JekyllNavPage, grand: JekyllNavPage | undefined, seen = new Set<JekyllNavPage>()): JekyllNavPage[] => {
    if (seen.has(p)) return [];
    seen.add(p);
    return [p, ...kidsOf(p, grand).flatMap((k) => below(k, p, seen))];
  };
  const declaredKids = (p: JekyllNavPage, grand: JekyllNavPage | undefined, depth: number, entries: DeclaredPageNav): NavItem[] => {
    const covered = new Set<string>();
    for (const e of entries) {
      if (e.href && !OFF_SITE.test(e.href)) covered.add(pageKey(e.href));
      for (const k of e.items ?? []) if (k.href && !OFF_SITE.test(k.href)) covered.add(pageKey(k.href));
    }
    const leaf = (label: string, href: string | undefined, d: number): NavItem => ({
      label,
      depth: d,
      ...(href ? hrefOf(href) : {}),
    });
    const out: NavItem[] = entries.map((e) => {
      const kids = (e.items ?? []).map((k) => leaf(k.label, k.href, depth + 2));
      if (kids.length) DECLARED_ROWS.add(kids);
      return { ...leaf(e.label, e.href, depth + 1), ...(kids.length ? { children: kids, fold: childPages(kids.length) } : {}) };
    });
    // A front-matter child the declaration does not reach stays, after it.
    for (const k of kidsOf(p, grand)) {
      if (below(k, p).some((b) => covered.has(pageKey(b.url)))) continue;
      out.push(row(k, p, depth + 1, p));
    }
    DECLARED_ROWS.add(out);
    return out;
  };
  const row = (p: JekyllNavPage, grand: JekyllNavPage | undefined, depth: number, parent?: JekyllNavPage): NavItem => {
    const declared = o.declared?.get(p.url);
    // just-the-docs nests three levels; deeper is not navigation. A declared
    // section is the page set's own, drawn as it declares it.
    const kids = declared
      ? declaredKids(p, grand, depth, declared)
      : depth < 2
        ? kidsOf(p, grand).map((k) => row(k, p, depth + 1, p))
        : [];
    const here = o.here !== undefined && o.here === p.url;
    return {
      label: parent === undefined ? p.title : labelUnder(p.title, parent.title),
      // Indented one step per level, as the theme's nested lists are.
      ...(depth > 0 ? { depth } : {}),
      ...(here ? { current: true } : { href: `${prefix}${p.url}` }),
      ...(kids.length ? { children: kids, fold: childPages(kids.length) } : {}),
    };
  };
  const topPages = kidsOf(undefined, undefined);
  const byHarness = new Map<string, { root?: JekyllNavPage; children: NavItem[] }>();
  const topItems: Array<{ item: NavItem; isHome: boolean; orderPage?: JekyllNavPage }> = [];
  for (const p of topPages) {
    const h = harnessOfUrl(p.url);
    if (h === undefined) {
      topItems.push({ item: row(p, undefined, 0), isHome: isHomeUrl(p.url), orderPage: p });
      continue;
    }
    let group = byHarness.get(h);
    if (!group) {
      group = { children: [] };
      byHarness.set(h, group);
    }
    const built = row(p, undefined, 0);
    if (isHarnessDocsRoot(p.url, h) && group.root === undefined) {
      group.root = p;
      if (built.children && DECLARED_ROWS.has(built.children) && group.children.length === 0) {
        group.children = [...built.children];
        DECLARED_ROWS.add(group.children);
      }
      else if (built.children) group.children.push(...built.children);
    } else {
      group.children.push(shiftDepth(built, 1));
    }
  }
  const harnessEntries = [...byHarness.entries()].sort(([a, ga], [b, gb]) =>
    collator.compare(ga.root?.title ?? a, gb.root?.title ?? b),
  );
  for (const [h, group] of harnessEntries) {
    const label = group.root?.title ?? h;
    const here = group.root !== undefined && o.here !== undefined && o.here === group.root.url;
    const href = group.root !== undefined && !here ? `${prefix}${group.root.url}` : undefined;
    const children = DECLARED_ROWS.has(group.children) ? group.children : [...group.children].sort((a, b) => collator.compare(a.label, b.label));
    topItems.push({
      item: {
        label,
        ...(here ? { current: true } : href !== undefined ? { href } : {}),
        ...(children.length ? { children, fold: childPages(children.length) } : {}),
      },
      isHome: false,
    });
  }
  if (o.locale !== undefined || byHarness.size > 0) {
    topItems.sort((a, b) => {
      if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
      if (o.locale === undefined && a.orderPage && b.orderPage) return cmp(a.orderPage, b.orderPage);
      return collator.compare(a.item.label, b.item.label);
    });
  }
  return { items: foldTitlePrefixes(topItems.map((x) => x.item)), orphans };
}

/**
 * `Bibliography: library/w3c`, `Tools — cat-harness`: the head and the rest of
 * a title that names its family first, or `undefined` for any other title.
 */
export function titlePrefix(label: string): { head: string; rest: string } | undefined {
  const m = /^(.+?)(?::\s+|\s+\u2014\s+)(.+)$/.exec(label);
  if (!m) return undefined;
  const head = m[1]!.trim();
  const rest = m[2]!.trim();
  return head && rest ? { head, rest } : undefined;
}

/**
 * A child row's label without what its parent row already says: under
 * `Bibliography`, the page `Bibliography: smart-immunizations-catalogue` reads
 * `smart-immunizations-catalogue`; under that, `Bibliography:
 * smart-immunizations-catalogue/who-handbook` reads `who-handbook` (owner,
 * 2026-11-10: bibliography entry pages nest under Bibliography). Any other
 * title is left as it is.
 */
export function labelUnder(title: string, parentTitle: string): string {
  const p = titlePrefix(title);
  if (!p) return title;
  const pp = titlePrefix(parentTitle);
  if (p.head !== parentTitle && p.head !== pp?.head) return title;
  return pp && p.rest.startsWith(`${pp.rest}/`) ? p.rest.slice(pp.rest.length + 1) : p.rest;
}

/**
 * Sibling rows whose titles share a family head — `Bibliography: …` or
 * `Tools — …` — fold under ONE `<head>` row, at every level (owner,
 * 2026-11-01: "Tools and biblio in LHS should be collapsible";
 * cat-harness-tools#1261). A sibling titled `<head>` itself (the `Tools`
 * page) becomes the parent and keeps its link; otherwise the parent is a
 * label-only row. A family of one is left as it is. The fold opens by itself
 * when the current page is inside it (`navbar.ts`).
 */
export function foldTitlePrefixes(items: readonly NavItem[]): NavItem[] {
  // A declared section is drawn as declared (`pagesNav`, `declared`).
  const recur = (item: NavItem): NavItem =>
    item.children && !DECLARED_ROWS.has(item.children) ? { ...item, children: foldTitlePrefixes(item.children) } : item;
  const families = new Map<string, number>();
  for (const item of items) {
    const p = titlePrefix(item.label);
    if (p) families.set(p.head, (families.get(p.head) ?? 0) + 1);
  }
  const folded = new Set([...families].filter(([, n]) => n >= 2).map(([head]) => head));
  if (folded.size === 0) return items.map(recur);
  const out: NavItem[] = [];
  const groups = new Map<string, { at: number; own?: NavItem; kids: NavItem[] }>();
  const groupOf = (head: string, depth: number | undefined) => {
    let g = groups.get(head);
    if (!g) {
      g = { at: out.length, kids: [] };
      out.push({ label: head, ...(depth ? { depth } : {}) });
      groups.set(head, g);
    }
    return g;
  };
  for (const item of items) {
    const p = titlePrefix(item.label);
    if (folded.has(item.label)) groupOf(item.label, item.depth).own = recur(item);
    else if (p && folded.has(p.head)) groupOf(p.head, item.depth).kids.push(shiftDepth({ ...recur(item), label: p.rest }, 1));
    else out.push(recur(item));
  }
  for (const g of groups.values()) {
    const parent = g.own ?? out[g.at]!;
    const kids = [...(parent.children ?? []), ...g.kids];
    out[g.at] = { ...parent, children: kids, fold: childPages(kids.length) };
  }
  return out;
}
