#!/usr/bin/env bun
/**
 * Render the ingested-IRIS replica pages from the catalogue.
 *
 * @module who-iris/scripts/gen-iris-pages
 * @covers catalogue
 *
 * Owner, 2026-09-20: *"<baseurl>/who-iris/communty-list is page"*, a replica of
 * <https://iris.who.int/community-list>, and *"there are not really special
 * visualizers, just webapages that are static rendered."* So: static HTML, no
 * client-side application, generated here and committed.
 *
 * ## Generated from the catalogue, never transcribed
 *
 * Every community, collection, item, byte count and handle on these pages is
 * read out of `who-iris/catalogue/nodes/`. Hand-writing the HTML would have
 * been quicker and would have produced a page that agrees with the KG exactly
 * once — on the day it was written. The screenshots the owner supplied are the
 * LAYOUT reference; the catalogue is the DATA.
 *
 * ## The WHO logo is deliberately absent
 *
 * Owner: *"leeav off WHO logo (as with all who-pages for now, not until
 * published under WHO, just use colors)."* `who_logo.svg` is sitting in the
 * capture and is NOT referenced here. A replica carrying the real mark would
 * be indistinguishable from the real thing at a glance, which is the whole
 * reason the instruction exists — so the wordmark is set in type and the
 * identity is carried by colour alone.
 *
 * ## Nothing is greyed out
 *
 * Owner: *"collectiosn w/ nothing greyed out. only 3 materialized assets in KG
 * so one or two link works."* A disabled-looking row reads as "broken"; a row
 * that says **referenced** reads as "upstream, not here", which is the actual
 * state and the distinction the whole catalogue-by-reference model is for. So
 * every row is live and each one states its own materialisation state.
 *
 * ## Colours come from the `iris-web` theme, which was measured
 *
 * Not eyedroppered off the screenshots. `who-iris/themes/themes.ts` reads them
 * out of the captured `client-theme.css`, and its tests re-read that file, so
 * these pages inherit that provenance instead of starting a second opinion.
 *
 * Usage:
 *   bun run who-iris/scripts/gen-iris-pages.ts
 *   bun run who-iris/scripts/gen-iris-pages.ts --check
 *   bun run who-iris/scripts/gen-iris-pages.ts --extract-pot
 *
 * ## Six languages (issue #2228)
 *
 * The replica pages are built in English at `site/` and in Arabic, Chinese,
 * French, Russian and Spanish at `site/<locale>/`. The interface's words are
 * the `SITE_STRINGS` table below; `--extract-pot` writes them to each
 * locale's `translations/<locale>/site/iris-site.pot`, and the generator
 * reads the `.po` beside it. A publication's own title, authors and abstract
 * are never translated. `--check` covers the catalogues as well as the pages.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { basename, dirname, join, posix, relative, resolve, sep } from "path";

import {
  bytesFor,
  folioMountFragment,
  formatPot,
  libraryResolver,
  parsePo,
  parsePoEntries,
  publicationBlockers,
  readDeclaration,
  repoRelative,
  repoRootFor,
  resolvableIri,
  declaredRoute,
  siteDirFor,
  withRenderedBy,
  withRenderedByFrontMatter,
  withRoutes,
  themedPage,
  visualiserRoute,
  type CatalogueNode,
  type PotEntry,
} from "../platform.ts";
import { whoThemeById } from "../themes/themes.js";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";


const INSTANCE = resolve(import.meta.dir, "..");
/**
 * The checkout root. Standing alone, it IS this instance's own repository
 * (bean g8jp) and the platform it reads (`cat-harness/`, the architecture
 * drawing) is a remote mount inside it; in the index checkout the platform is
 * its sibling. Whichever directory holds cat-harness is the checkout.
 */
const REPO_ROOT = existsSync(join(INSTANCE, "cat-harness")) ? INSTANCE : resolve(INSTANCE, "..");

const NODES = join(INSTANCE, "catalogue", "nodes");
/**
 * WHERE EACH PAGE GOES, and the two are different KINDS of thing.
 *
 * Owner, 2026-09-21: *"the iris KG should be in who-iris/library (served by
 * cat-harness/library) which may or may not inlude materialized content, the
 * docs in who-iris/docs (served by cat-harness/docs)."*
 *
 * So the split is not cosmetic. The replica — the home page, the community
 * list, every collection and item page — is a RENDERING OF THE KG, and the KG
 * is library-side. The ingestion notes and the portal proposal are
 * DOCUMENTATION, and documentation is docs-side. One directory served both
 * until now, and `mount-instance-docs.ts` copies a declared directory to
 * `/<kind>/<instance>/`, so `/docs/who-iris/` was byte-for-byte the replica
 * with the replica's own top navbar. That is what the owner was looking at.
 *
 * **Only loose files go into `library/`.** Every DIRECTORY under a library
 * graph is read as a corpus entry by `library-graph.ts` — it walks
 * subdirectories and treats each as a slug — so an `assets/` folder there
 * would appear in the L1 listing as a document titled "assets" with no
 * sections. The covers therefore stay where the catalogue's `localPath`
 * already names them, and nothing about `yl5w` has to move again.
 *
 * ## The replica LEFT `library/` on 2026-09-30 — bean `2b5s`
 *
 * Owner, choosing *"site/ + publish covers"*: the replica pages move to their
 * own directory, `site/`, which is the instance root; `library/` holds the
 * corpus only. The 2026-09-21 words place the KG — corpus and materialized
 * content — in `library/`, and say nothing about where its RENDERING lives.
 * Keeping the rendering there meant the build copied the whole corpus (1,367
 * sidecars) to two published routes as if it were pages, because a mount
 * copies the directory whose `index.html` it found.
 *
 * So `LIB` is now the CORPUS side only — the covers the replica shows and the
 * `withheld.json` this generator writes — and `SITE` is where the pages go.
 * The covers are NOT copied into `site/`: a page references
 * `../library/<slug>-cover.png`, which resolves in the checkout, and the
 * mount's referenced-asset rule publishes exactly the files a page embeds
 * (`referencedAssets` in `mount-instance-docs.ts`). A copy here would be a
 * second committed binary of one image, free to drift from the one the
 * catalogue's `localPath` names.
 */
const LIB = join(INSTANCE, "library");
const SITE = join(INSTANCE, "site");
const DOCS = join(INSTANCE, "docs");

/**
 * A THIRD SIDE: the catalogue VISUALISER, which who-iris DECLARES.
 *
 * `library/` and `docs/` above are who-iris's own tree, which the build MOUNTS.
 * This page is the visualiser `who-iris.json` declares in `visualisers` —
 * `catalogue`, `renderedBy: iris-pages` — which `visualiserRoute` makes
 * `who-iris/catalogue/` (owner, 2026-10-09: *"I still want the harness to be
 * where specific visualizers/pages are declared for the harness at the
 * level"*).
 *
 * IT IS COMMITTED HERE, in who-iris's own site directory at
 * `<site>/catalogue/` — the declared route with this instance's own name
 * dropped — and no longer in cat-harness's tree (wrong-direction move M1,
 * 2026-10-20). Written into cat-harness's site directory, the page made the
 * platform name the layer above it, and in the index checkout, where
 * cat-harness is a remote mount, this generator could not write it at all
 * (bean `kx0p`), so the platform's copy was nobody's to regenerate. Here it is
 * this generator's own output, checked by `iris:pages:check` like every other
 * page. The site build publishes it at its declared route through Jekyll
 * (`compose-docs` lays a visualiser page a harness holds in its own site
 * directory there), and the docs mount leaves it out, so it is published once.
 *
 * NOTHING HERE IS SPELLED. The route comes from the declaration through
 * `declaredRoute`, and the site directory from `siteDirFor` — the same answers
 * every reader uses, so this generator and the tiles cannot drift into
 * disagreeing about where the page is.
 */
const HARNESS_ROOT = join(REPO_ROOT, "cat-harness");
/** This generator's Tool node (`who-iris/tools/`), the one who-iris's catalogue visualiser is `renderedBy`. */
const VIEWER_TOOL = "iris-pages";
const SUBJECT = readDeclaration(INSTANCE)?.name ?? "who-iris";
/** `who-iris/catalogue` — the declared route, without slashes. */
const CATALOGUE_ROUTE = ((): string => {
  const r = declaredRoute(INSTANCE, VIEWER_TOOL);
  if (r === undefined) {
    throw new Error(
      `who-iris.json declares no visualiser renderedBy \`${VIEWER_TOOL}\`, so the catalogue page has no ` +
        "route. Declare it in `visualisers`, or this generator would publish to a URL nothing declared.",
    );
  }
  return r;
})();
/** `who-iris/<site>/catalogue/index.html`, absolute: the declared route under this instance's own site directory. */
export const CATALOGUE_VIEWER = join(INSTANCE, siteDirFor(INSTANCE), ...ownSiteRoute().split("/"), "index.html");

// No `outDirFor(name)` helper: the map key carries the side, so nothing has to
// infer it from a filename. An inference would have to be kept in step with
// the two OWNED patterns below, and three answers to one question is how a
// page ends up written to one side and pruned from the other.
/**
 * The skill this page is a PROJECTION of — never a second copy of it.
 *
 * Owner, 2026-09-20: *"captiure all your issues in ingesting iris documents in
 * skills"*, then *"that are visible in who-iris/docs"*. Two instructions that
 * pull opposite ways if you obey them separately: a skill an agent reads, and
 * a page a person reads, each free to drift from the other the moment one is
 * edited.
 *
 * So the page is generated FROM the skill. `who-iris/skills/iris-dspace.md` is
 * the single place a finding is written down; the requirements table in it is
 * parsed below and rendered here. Editing the page means editing the skill,
 * and `iris:pages:check` fails if somebody edits the skill and does not
 * re-render — which is the whole mechanism keeping the two honest.
 */
const SKILL = join(INSTANCE, "skills", "iris-dspace.md");

/**
 * The architecture drawing, INLINED rather than linked.
 *
 * It lives in the platform (`cat-harness/docs/assets/img/`) because the
 * pattern is generic and who-iris is one worked example of it — a second copy
 * under this instance would be two drawings of one architecture, free to
 * disagree the first time either is edited.
 *
 * Inlined rather than referenced because these pages are served from **two**
 * mount routes (`/who-iris/` and `/docs/who-iris/`), so any relative path to a
 * file outside this directory resolves under one of them and 404s under the
 * other. An absolute site URL would work and would hard-code the publication
 * base into a generated page, which is the thing `canonicalUrl` exists to stop.
 * Reading the bytes sidesteps both.
 */
const ARCH_SVG = join(REPO_ROOT, "cat-harness", "docs", "assets", "img", "kg-to-portal-architecture.svg");

/**
 * THE ONE PLACE THAT SAYS WHAT THIS GENERATOR OWNS. Everything below derives.
 *
 * Ownership is what licenses the prune sweep to DELETE, so it is deliberately
 * a pattern over this generator's own naming rather than "everything in the
 * directory". `deletion-requires-confirmation` is about durable artefacts an
 * agent did not create; this reclaims only what this file itself emits, the
 * same licence `prunableStickies` operates under. A hand-authored page, an
 * asset directory or a `.nojekyll` beside them is untouched.
 *
 * ## Why one declaration, and why it is split this way
 *
 * There were SIX enumerations of this one fact — `DOC_PAGES` exported here
 * with no consumer anywhere, a LOCAL `DOC_PAGES` in the test reusing the name
 * with different membership, `OWNED`, `OWNED_LIB`, `OWNED_DOCS`, and a
 * `wanted` set in the test. Two were already broken when this was written
 * (bean `o6vj`, issue #895): the exported `DOC_PAGES` was dead, and `OWNED`
 * still named `catalogue` after #888 moved that page out of who-iris.
 *
 * `catalogue.html` was written to `docs/` and named in NEITHER side's
 * pattern, so the sweep could never have reclaimed it — and that sweep is not
 * decorative: re-keying two items on 2026-09-20 left nine files where seven
 * were wanted, two serving records the catalogue no longer described.
 *
 * FIXED vs FAMILIES is the load-bearing split. Deriving ownership wholesale
 * from what is being written this run would delete the property the sweep
 * exists for: `item-*.html` must stay prunable when the item is GONE, which
 * is precisely when it is absent from the write set. So the families stay
 * explicit patterns, and only the fixed names — the class `catalogue` fell
 * through — are enumerated once here.
 */
/**
 * The languages the replica is BUILT in besides English — the five other UN
 * languages (issue #2228). Each gets its own copy of every site-side page at
 * `site/<locale>/<page>.html`, the layout the docs locale globe already links
 * to. Declared up here because the ownership patterns below are built from it.
 */
export const SITE_LOCALES = ["ar", "es", "fr", "ru", "zh"] as const;
type Locale = "en" | (typeof SITE_LOCALES)[number];

const PAGES = {
  site: {
    /** The replica: the KG rendered. */
    fixed: ["index", "community-list", "search"],
    /** One page per collection and per item; prunable when the node is gone. */
    families: ["collection-.*", "item-.*"],
  },
  docs: {
    /**
     * Prose about the work, plus an index.
     *
     * `index` is owned on BOTH sides deliberately: the replica needs one
     * because it is a site, and the docs side needs one because
     * `mount-instance-docs.ts` will not mount a directory without it. The
     * cross-side sweep therefore subtracts what is owned HERE, or it deletes
     * the docs index on sight.
     */
    fixed: ["index", "ingestion-notes", "kg-to-portal"],
    /**
     * The RENDERINGS of the authored pages in `docs/` (bean `mw5z`, owner's
     * option 1): each `<name>.md` a person wrote is rendered to `<name>.html`
     * here, so the docs mount keeps its one rule -- everything in it is
     * already HTML. Derived from the directory, never listed by hand.
     */
    families: authoredDocs(DOCS).map((d) => d.file.replace(/\.md$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) as string[],
  },
} as const;

/** The sides a page can be written to — the keys, never a second list. */
export type Side = keyof typeof PAGES;
export const SIDES = Object.keys(PAGES) as Side[];

const ownedPattern = (names: readonly string[]): RegExp =>
  new RegExp(`^(${names.join("|")})\\.html$`);

/**
 * What it owns in `site/` — including each language's copy beneath
 * `site/<locale>/`, which is the page's name with the locale in front. The
 * sweeps below list one directory at a time, so a bare name never carries a
 * slash and this pattern means exactly what it did for them.
 */
export const OWNED_SITE = new RegExp(
  `^(?:(?:${SITE_LOCALES.join("|")})/)?(${[...PAGES.site.fixed, ...PAGES.site.families].join("|")})\\.html$`,
);

/** What it owns in `docs/`. */
export const OWNED_DOCS = ownedPattern([...PAGES.docs.fixed, ...PAGES.docs.families]);

/**
 * Everything this generator writes, on either side.
 *
 * A union of the two above rather than a third hand-written pattern. It named
 * `catalogue` for a day after that page left the repository, which is what a
 * third answer to one question buys you.
 */
export const OWNED = ownedPattern([
  ...new Set(SIDES.flatMap((s) => [...PAGES[s].fixed, ...PAGES[s].families])),
]);

/** The fixed pages of one side, as filenames. Used by the guard and the tests. */
export const fixedPagesOf = (side: Side): string[] =>
  PAGES[side].fixed.map((n) => `${n}.html`);

/** The pattern that governs one side. */
export const ownedOn = (side: Side): RegExp => (side === "site" ? OWNED_SITE : OWNED_DOCS);

/**
 * Where a committed file is actually served from.
 *
 * The owner asked for *"links to working assets"*, so a link here is built
 * from a path that RESOLVED rather than from one the catalogue claims. Until
 * 2026-09-21 those were different things — bean `yl5w`: every ORIGINAL
 * `localPath` named `who-iris/uploads/…` while the bytes sat in
 * `cat-harness/uploads/`, and `lib/bytes.ts` carried a fallback so the links
 * worked anyway. The sources have since moved into the folio and the fallback
 * is gone, so the two now agree; the rule stays, because a generator that
 * emits a link from an unverified claim is one relocation away from shipping
 * dead links again.
 */
const RAW = "https://raw.githubusercontent.com/litlfred/who-iris/main";

/**
 * The same bytes, through a CDN.
 *
 * Owner, 2026-09-20: *"there is iris-source, shold also be local repllca page
 * that loads from CDN. both links there -> show power of CDN + KG."*
 *
 * jsDelivr serves any public GitHub repository at
 * `cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/<path>`, so an item the catalogue
 * knows about is fetchable from an edge cache **without this repository
 * serving anything** — which is the point being demonstrated: the KG says what
 * exists and where, and the bytes come from wherever is nearest.
 *
 * **Pinned to `main` rather than to a tag, deliberately**, because the point
 * is that the catalogue's answer stays current. A tag would demonstrate a
 * frozen copy, which is a different claim.
 *
 * NOT VERIFIABLE FROM THE ENVIRONMENT THAT WRITES THIS. `cdn.jsdelivr.net` is
 * egress-blocked here (CONNECT 403, the same block `r1lz` recorded for
 * `iris.who.int`), so unlike the `raw.githubusercontent.com` links — fetched,
 * 200, byte counts matching the catalogue — these are composed from jsDelivr's
 * documented URL form and cannot be exercised by the generator or its tests.
 *
 * **The owner confirmed one by hand on 2026-09-20** ("cdn link works"), which
 * is the only evidence there is and the only evidence there can be from inside
 * this container. Both forms stay on the page: the CDN one costs this project
 * nothing to serve, and a reader who finds either unavailable still has the
 * other. If the repository is ever made private, the CDN form is the one that
 * breaks first and silently — nothing here will catch that.
 */
const CDN = "https://cdn.jsdelivr.net/gh/litlfred/who-iris@main";

/** A repo-relative path, encoded once, for either host. */
function encPath(rel: string): string {
  return rel.split("/").map(encodeURIComponent).join("/");
}

/**
 * A node, as the SCHEMA defines it — not a hand-written restatement of it.
 *
 * This was a local `type Node = { … }` listing about a dozen fields. It went
 * stale the moment `pixelWidth`/`pixelHeight` were added to `BitstreamSchema`,
 * and the way it went stale is the argument: `tsc` reported that
 * `materialization.note` "does not exist" on a node that has carried a `note`
 * since the catalogue was written. A second declaration of one type does not
 * catch drift, it REPORTS drift as an error in the wrong file.
 */
type Node = CatalogueNode;

/**
 * The catalogue's own header — the upstream figures, read rather than restated.
 *
 * `totalItemsUpstream` and `totalFilesUpstream` are SEPARATE fields, and this
 * page is the reason they are. The catalogue used to carry the file count in
 * the items field with a note saying so, because the statistics page publishes
 * files and IRIS's item count was not known. It is on the home page this mocks
 * — the search placeholder — so both are now stored, and `1,057,223 files` was
 * hard-coded into the old landing page's prose where neither this file nor
 * anything else would have noticed it going stale.
 */
function catalogue(): { totalItemsUpstream?: number; totalFilesUpstream?: number; totalBytesUpstream?: number } {
  return JSON.parse(readFileSync(join(INSTANCE, "catalogue", "catalogue.json"), "utf-8"));
}

/**
 * Every catalogue node, in a DETERMINISTIC order.
 *
 * **The sort is the whole point of this function having a comment.**
 * `readdirSync` returns entries in whatever order the filesystem gives, which
 * is not stable across machines — and several pages below render LISTS of
 * these nodes, so the generated HTML inherited that order. The result was a
 * generator that produced different bytes from identical inputs: green on the
 * machine that wrote the pages, and `iris:pages:check` red in CI with exactly
 * the two list-rendering pages stale (`index.html`, `community-list.html`)
 * while the four per-node pages passed.
 *
 * Sorted on `id`, which every node carries and which is unique — the filename
 * would do today but is derived, and a node renamed on disk should not reorder
 * a page.
 */
function nodes(): Node[] {
  return readdirSync(NODES)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = JSON.parse(readFileSync(join(NODES, f), "utf-8"));
      for (const k of Object.keys(raw)) if (k.startsWith("_")) delete raw[k];
      return raw as Node;
    })
    .sort((a, b) => a.id.localeCompare(b.id, "en"));
}

/** HTML-escape. Every interpolated value goes through it — titles are external data. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/*
 * RECORD DATA IS DIRECTION-ISOLATED FROM THE INTERFACE AROUND IT (bean `lffo`).
 *
 * The interface is translated; the records are not — a title, an author, a
 * citation, a collection's name stay as WHO published them. On a right-to-left
 * page that leaves Latin runs sitting inside Arabic sentences, and the Unicode
 * bidi algorithm then resolves the neutral characters at the seam against the
 * PAGE's direction. Measured on the ar home page before this: the WPRO item's
 * citation line rendered as `(12-05-2020 :تاريخ النشر ,WPR/RDO/2020/003)`, and
 * each abstract's truncation ellipsis landed at the left.
 *
 * Two shapes, chosen by where the value sits:
 *
 * - **Inline**, inside a translated sentence or beside a label: {@link data}
 *   wraps it in `<bdi>`, whose direction defaults to `auto`.
 * - **A whole block** (a heading, an abstract): {@link dataBlock} sets
 *   `dir="auto"` on the element itself, so it aligns by its own first strong
 *   character rather than the page's.
 *
 * `auto`, never `ltr`: a record field is not guaranteed to be English, and an
 * Arabic title on the English page needs the same isolation the other way.
 * `lang` only where it is KNOWN — the record's own `dc.language.iso` — and only
 * where it differs from the page's, so a screen reader switches voice for an
 * English title on the Arabic page and the English page gains no noise. A node
 * with no record gets isolation and no `lang`: guessing one would be a claim
 * the catalogue does not make.
 *
 * Values interpolated into an ATTRIBUTE (`title=`, `alt=`) are not wrapped —
 * markup there is text, and an attribute has no direction of its own to fix.
 */

/** ` lang="…"` for a value whose language is known and is not the page's; otherwise nothing. */
function langAttr(lang: string | undefined): string {
  return lang !== undefined && lang !== LOCALE ? ` lang="${esc(lang)}"` : "";
}

/** Record data in running text: escaped, isolated, and language-tagged where known. */
function data(s: string, lang?: string): string {
  return `<bdi${langAttr(lang)}>${esc(s)}</bdi>`;
}

/**
 * A breadcrumb's text. A crumb that names a node (`record` set) is record data
 * and isolated like any other; an interface crumb ("Home") is translated text
 * in the page's own direction and is left as it is.
 */
function crumbLabel(c: { label: string; record?: { lang?: string } }): string {
  return c.record === undefined ? esc(c.label) : data(c.label, c.record.lang);
}

/** The attributes for an element whose whole content is record data. */
function dataBlock(lang?: string): string {
  return ` dir="auto"${langAttr(lang)}`;
}

/**
 * The language a node's own record declares — `dc.language.iso` — or nothing.
 *
 * Shape-checked as a BCP 47 primary tag with optional subtags, because the
 * value is emitted into a `lang` attribute and a malformed one is worse than
 * none: a reader's tools act on it.
 */
function langOf(n: Node): string | undefined {
  const iso = dc(n, "language", "iso")[0]?.trim();
  return iso !== undefined && /^[a-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(iso) ? iso : undefined;
}

/**
 * Bytes, in the units that round-trip the source.
 *
 * **GiB, not GB, and the difference is not pedantry here.** The IRIS storage
 * report prints "238.58 GB" for Headquarters and the catalogue stores
 * 256,173,324,370 bytes. Divided by 10^9 that renders as *256.17 GB* — a page
 * disagreeing with the note in its own data by 7%. Divided by 2^30 it is
 * 238.58, exactly what the report says. So the report's "GB" is GiB, the
 * catalogue stored it faithfully, and rendering it as GB would have invented a
 * discrepancy. `check-catalogue.ts` already prints GiB for the same reason.
 */
function gb(bytes: number): string {
  return `${num(bytes / 2 ** 30, 2)} GiB`;
}

/**
 * Bytes as megabytes — or the fact that nobody measured them.
 *
 * `Bitstream.bytes` is OPTIONAL in the schema, and this file's hand-written
 * copy of the type said it was required. `(undefined / 1048576).toFixed(2)`
 * is the string `"NaN"`, so a bitstream with no recorded size would have
 * rendered `NaN MB` on the item page — a measurement-shaped hole, which is
 * exactly the thing `unknown`-as-a-third-state exists to stop. Nothing in the
 * catalogue hits it today; deleting the duplicate type is what surfaced it.
 */
function mb(bytes: number | undefined): string {
  return bytes === undefined ? t("not recorded") : t("{size} MB", { size: num(bytes / 1048576, 2) });
}

/**
 * The bytes actually on disk for an item, or undefined when there are none.
 *
 * HELD is not PUBLISHED (bean `cw35`). `withheld` names the publication gates
 * (`copyright`, `restrictions`) that are not `permitted`, with each verdict and
 * its recorded basis; when it is non-empty no page may link the bytes, and
 * {@link linkOrWithheld} is the one place that decides. Counts of what is held
 * here still count it — the copy exists, it is just not ours to redistribute.
 */
function assetHref(
  n: Node,
): { href: string; cdn: string; name: string; bytes?: number; withheld: string[] } | undefined {
  const b = n.bitstreams?.find(
    (x) => x.bundle !== "THUMBNAIL" && x.materialization?.state === "materialized",
  );
  if (!b) return undefined;
  // Where the bytes ARE, which is not where the catalogue says — bean `yl5w`,
  // and the resolution order is in core's `scripts/lib/bytes.ts` so the workaround has one
  // home to be deleted from.
  const found = bytesFor(INSTANCE, b.materialization?.localPath, b.name);
  if (!found) return undefined;
  // Relative to the INSTANCE, which is the root of litlfred/who-iris since the
  // cutover (bean g8jp). Relative to REPO_ROOT these were monorepo paths
  // (`who-iris-approval/uploads/…`) that 404 once the instance left it.
  const rel = encPath(repoRelative(INSTANCE, found));
  const gates = b.materialization?.gates;
  const withheld = publicationBlockers(gates).map(
    (k) => `${k}: ${gates?.[k]?.verdict ?? "not recorded"}${gates?.[k]?.basis ? ` — ${gates[k].basis}` : ""}`,
  );
  return { href: `${RAW}/${rel}`, cdn: `${CDN}/${rel}`, name: b.name, bytes: b.bytes, withheld };
}

/**
 * What the site must not SERVE from `library/`, for the mount to honour
 * (`WITHHELD_FILE` in `mount-instance-docs.ts`, bean `cw35`).
 *
 * Removing a link does not stop a URL: the mount copied `library/` wholesale
 * until bean `2b5s`, so a refused publication's cover and its ingested text
 * stayed reachable. It no longer mounts `library/` at all; it publishes the
 * files a replica page EMBEDS, and it still consults this list for each, so a
 * page that came to embed a withheld cover would be refused rather than
 * served. For
 * every item whose ORIGINAL bitstream's publication gates block, its whole
 * library entry is withheld — the text, figures and structure are derived from
 * the same bytes under the same licence. A blocked THUMBNAIL is withheld on its
 * own gates. The item's catalogue PAGE stays: it is metadata, and it says why.
 */
export function withheldManifest(all: Node[]): string {
  const paths: {
    path: string;
    reason: string;
    gates?: { gate: string; verdict: string }[];
    record?: { id: string; page?: string; uri?: string };
  }[] = [];
  for (const n of all) {
    for (const b of n.bitstreams ?? []) {
      const blocked = publicationBlockers(b.materialization?.gates);
      if (!blocked.length || b.materialization?.state !== "materialized") continue;
      const reason = `${n.id} ${b.bundle} "${b.name}": ${blocked
        .map((k) => `${k} ${b.materialization?.gates?.[k]?.verdict ?? "not recorded"}`)
        .join(", ")}`;
      // The ENTRY carries its gates and its catalogue record as data (issue
      // #1794), so the library viewer can say which gate refused and send the
      // reader to the record without parsing `reason`. The URI is the item's
      // own resolvable IRI, absent when it records none. No record PAGE since
      // 2026-10-30: the IRIS replica's item pages are gone (owner), and the
      // library entry page is the item's one page.
      if (b.bundle === "ORIGINAL" && n.libraryId) {
        const uri = sourceOf(n);
        paths.push({
          path: `${n.libraryId}/`,
          reason,
          gates: blocked.map((k) => ({ gate: k, verdict: b.materialization?.gates?.[k]?.verdict ?? "not recorded" })),
          record: {
            id: n.id,
            ...(uri ? { uri } : {}),
          },
        });
      }
      const lp = b.materialization?.localPath;
      if (b.bundle === "THUMBNAIL" && lp?.startsWith("library/")) paths.push({ path: lp.slice("library/".length), reason });
    }
  }
  paths.sort((a, b) => a.path.localeCompare(b.path));
  return (
    JSON.stringify(
      {
        $schema: "folio-withheld/v1",
        _comment:
          "GENERATED by who-iris/scripts/gen-iris-pages.ts from the catalogue's publication gates (bean cw35). " +
          "mount-instance-docs.ts copies nothing listed here to the site. Do not edit by hand.",
        paths,
      },
      null,
      2,
    ) + "\n"
  );
}

/** The download links for a held item — or why it is held and not linked. */
function linkOrWithheld(a: NonNullable<ReturnType<typeof assetHref>>, withSize: boolean): string {
  if (a.withheld.length > 0) {
    return `<span class="none" title="${esc(a.withheld.join("; "))}">${t("held here, not published — {gates}", { gates: esc(
      a.withheld.map((w) => w.split(" — ")[0]).join(", "),
    ) })}</span>`;
  }
  return (
    `<a href="${esc(a.href)}">${esc(a.name)}</a> &middot; <a class="cdn" href="${esc(a.cdn)}">${t("via CDN")}</a>` +
    (withSize ? ` &middot; <code class="ui">${esc(mb(a.bytes))}</code>` : "")
  );
}

/**
 * The cover thumbnail, or nothing.
 *
 * A THUMBNAIL-bundle bitstream **this repository rendered itself** — not the
 * one DSpace generates upstream. `folio-assistant-core/scripts/gen-covers.ts` writes the
 * bytes and the node records the derivation; here it is only read.
 *
 * Nothing is invented when it is absent, and nothing is guessed when it is
 * present: the box comes from `pixelWidth`/`pixelHeight` on the bitstream, so
 * a listing reserves the right space before the image loads. The three covers
 * are 2:3, 0.705:1 and a scanned page — any default would be wrong about two
 * of them, and a wrong box is a reflow rather than a missing image, which is
 * the harder failure to notice.
 */
/**
 * Are the rendered covers SHOWN on the replica?
 *
 * **Yes, with the emblem masked — the owner's ruling of 2026-09-21.**
 *
 * The question first put to them was whether the emblem printed on a WHO
 * publication reads as *content* — the document's own cover — or as *branding*
 * this page is wearing. They named it with the logo: *"logo and other
 * branding"*, and the covers were withheld. Asked again whether to show them
 * masked, they chose masking over withholding.
 *
 * So the standing instruction is still honoured — *"leave off WHO logo (as
 * with all who-pages for now, not until published under WHO, just use
 * colors)"* — and the covers are back. The emblem never reaches this page:
 * `pdf-cover.py` blanks it **before the PNG is written**, so the committed
 * bytes do not contain it and no display flag can leak it. The regions and
 * their reason are declared on each THUMBNAIL bitstream as `maskedRegions`.
 *
 * **The TITLE is not masked where it contains "WHO"** — *WHO Editorial Style
 * Manual*, *WHO Handbook for Guideline Development*. That is the work's name,
 * a bibliographic fact about the publication, not branding this replica is
 * wearing. Masking it would leave a cover that names no book.
 *
 * `false` still works and still says *"cover withheld"* rather than *"no
 * cover"*, because those remain different facts. It is no longer the position
 * the covers are in, only the switch that would put them back.
 */
const COVERS_SHOWN = true;

/** Why a rendered cover is withheld by its publication gates, or undefined when it is not (bean `cw35`). */
function coverWithheld(n: Node): string | undefined {
  const b = n.bitstreams?.find((x) => x.bundle === "THUMBNAIL");
  if (!b?.materialization?.localPath) return undefined;
  const blocked = publicationBlockers(b.materialization.gates);
  return blocked.length ? blocked.map((k) => `${k}: ${b.materialization?.gates?.[k]?.verdict ?? "not recorded"}`).join(", ") : undefined;
}

function coverSrc(n: Node): { src: string; w: number; h: number; masked: boolean } | undefined {
  const b = n.bitstreams?.find((x) => x.bundle === "THUMBNAIL");
  const lp = b?.materialization?.localPath;
  if (!b || !lp || b.pixelWidth === undefined || b.pixelHeight === undefined) return undefined;
  // Declared path honoured directly here, unlike `assetHref`: these bytes are
  // ones this repository wrote, at the path the node names, so a fallback
  // would be covering for a bug of our own making rather than for `yl5w`.
  const abs = join(INSTANCE, lp);
  if (!existsSync(abs)) return undefined;
  // A cover render reproduces the publication's own cover, so it is published
  // only when ITS gates permit it (bean `cw35`) — same rule as the PDF.
  if (publicationBlockers(b.materialization?.gates).length > 0) return undefined;
  // RELATIVE TO THE DIRECTORY THE PAGE IS WRITTEN INTO, computed, not stripped.
  //
  // This was `lp.replace(/^docs\//, "")`, correct for exactly as long as these
  // pages lived in `docs/`. They moved to `library/` in `zgba` and the covers
  // did not, so every `src` resolved to `library/assets/covers/...` -- a 404,
  // invisible because `COVERS_SHOWN` was false and the `<img>` was never
  // emitted. Two faults stacked, the outer one hiding the inner.
  //
  // A literal prefix is a second answer to "where is this page", and it goes
  // stale the moment the first answer moves. `relative()` asks the one answer.
  return {
    src: encPath(relative(siteDir(), abs).split(sep).join("/")),
    w: b.pixelWidth,
    h: b.pixelHeight,
    // Read off the bitstream rather than assumed for every cover: a future
    // item whose cover carries no emblem needs no mask, and alt text claiming
    // one was removed would be describing a different image.
    masked: (b.maskedRegions ?? []).length > 0,
  };
}

// ── The replica's own words, and the languages it is shown in ─────────────
//
// Issue #2228, bean `lffo`. Owner, 2026-10-05: *"help make sure who-iris has
// all translations"*, and after measurement, the replica's INTERFACE in the
// five non-English UN languages.
//
// The model is `cat-harness-tools/scripts/kg-viewer-strings.ts`, for the reason it
// gives: **a generated artefact is not a translation source; its generator
// is.** The pages are regenerated on every catalogue change, so a `.pot`
// extracted from them would churn its references with every run. The words
// are declared HERE, extracted by `--extract-pot` into
// `translations/<locale>/site/iris-site.pot` (the instance's declared
// `translation-sources` directory) and read back from each `.po`.
//
// **The msgid is the English text, not a key** — the gettext convention the
// platform follows everywhere. And `t()` refuses a string that is not in this
// table, so a page cannot say something no translator was asked about.
//
// ## Interface, not records
//
// Here: every word the REPLICA says — chrome, labels, headings, the banner,
// its own explanatory notes. NOT here: a publication's title, authors,
// abstract, citation, a collection's or community's name, a catalogue note, a
// bundle name, a gate's verdict. Those are the catalogue's DATA, and WHO
// publishes its own language versions of its works; a machine-translated
// title would misrepresent the record. Every translated page says so.
//
// Markup inside a msgid is deliberate: a sentence with a `<strong>` in it is
// one sentence, and splitting it at the tag would hand a translator three
// fragments whose order their language may need to change. A `{placeholder}`
// is substituted after translation and must survive it; `--check` enforces
// both that and that every tag a msgid carries survives too.

/** One string the replica says. */
interface UiString {
  /** The English text, which is also the gettext `msgid`. */
  readonly en: string;
  /** Where it appears and what each `{placeholder}` becomes — a `#.` comment in the POT. */
  readonly comment: string;
}

export const SITE_STRINGS: readonly UiString[] = [
  // ── Every page: head, banner, masthead, navbar, footer ──────────────────
  { en: "{title} — ingested IRIS replica", comment: "The browser tab title of every replica page. {title} is the page's own title (a collection or item name from the catalogue, which is not translated)." },
  { en: "A replica of a WHO IRIS page, rendered from this repository's ingested catalogue. Not WHO, and not live.", comment: "The page's meta description, read by search engines and link previews." },
  { en: "<strong>INGESTED COPY — not WHO, and not live.</strong> This page is rendered by {folioAssistant} from its own catalogue of {iris}, modelled <em>by reference</em>: {figures}. The WHO logo is deliberately omitted, and the rendered covers are withheld from display for the same reason — they carry the emblem printed on the publications.", comment: "The banner at the top of every page. {folioAssistant} and {iris} are links whose text is a name (folio-assistant, WHO IRIS) and is not translated. {figures} is the sentence about node counts below." },
  { en: "{nodes} nodes of a {items}-item {size} repository, of which <strong>{held} items</strong> are held here", comment: "Inside the banner. {nodes} is how many catalogue nodes exist here, {items} how many items IRIS holds upstream, {size} a size such as '361.55 GiB', {held} how many items are held here (2 or more)." },
  { en: "{nodes} nodes of a {items}-item {size} repository, of which <strong>1 item</strong> is held here", comment: "As above, when exactly one item is held here." },
  { en: "{nodes} nodes of a repository of unmeasured size, of which <strong>{held} item(s)</strong> are held here", comment: "As above, when the upstream size was never measured." },
  { en: "World Health<br>Organization", comment: "The wordmark in the masthead, set in type because the WHO logo is deliberately omitted. Use the Organization's official name in your language; the <br> breaks it over two lines and may move." },
  { en: "Institutional Repository<br>for Information Sharing", comment: "What the letters IRIS stand for, under the 'iris.' wordmark. Use the name WHO uses for IRIS in your language if there is one; the <br> may move." },
  { en: "Logo omitted, covers withheld — replica, not published under WHO", comment: "Small notice at the right of the masthead." },
  { en: "Communities &amp; Collections", comment: "Navbar link to the community list. DSpace's own label; keep &amp; as written if you use an ampersand." },
  { en: "Browse IRIS", comment: "Navbar item (shown, not a link, in the replica)." },
  { en: "Statistics", comment: "Navbar item (shown, not a link, in the replica)." },
  { en: "About", comment: "Navbar item (shown, not a link, in the replica)." },
  { en: "Contact", comment: "Navbar item (shown, not a link, in the replica)." },
  { en: "Help", comment: "Navbar item (shown, not a link, in the replica)." },
  { en: "Home", comment: "First breadcrumb, and the home page's own breadcrumb." },
  { en: "Community List", comment: "Breadcrumb on the community list page." },
  { en: "<strong>Ingested replica.</strong> Rendered from {catalogue} by {generator}. Layout after {iris}; every figure on this page is read out of the catalogue, not copied from a screenshot.", comment: "Footer, first paragraph. {catalogue} and {generator} are file paths in code type; {iris} is a link to iris.who.int. None are translated." },
  { en: "Source of record: {iris} — © WHO. This copy asserts no endorsement and carries no WHO mark.", comment: "Footer, second paragraph. {iris} is a link to iris.who.int." },
  { en: "Interface language", comment: "Accessible name of the row of language links in the banner. The links themselves are each language's own name and are not translated." },
  { en: "The interface is shown in {language}. Publication titles, authors, abstracts and other catalogue records are shown as WHO published them.", comment: "Shown on every translated page. {language} is the language's own name. It states where the translation stops: the records are WHO's data and are never machine-translated." },
  { en: "This interface translation was produced by an agent and has not been reviewed by a person.", comment: "Shown with the note above until a person signs the catalogue off." },

  // ── Materialisation states (a closed vocabulary the generator emits) ────
  { en: "materialized", comment: "State badge: the bytes are held in this repository. Shown in capitals by the stylesheet where the script has case." },
  { en: "referenced", comment: "State badge: known to the catalogue, held upstream at WHO only." },
  { en: "unknown", comment: "State badge: the catalogue has not determined the state." },

  // ── Table cells shared by several pages ─────────────────────────────────
  { en: "Item", comment: "Table column heading; also the badge on an item in the search results." },
  { en: "Collection", comment: "Table column heading; also the badge on a collection in the search results." },
  { en: "Community", comment: "The badge on a community in the search results." },
  { en: "State", comment: "Table column heading: the materialisation state." },
  { en: "Upstream", comment: "Table column heading: where the item lives at WHO." },
  { en: "Held copy", comment: "Table column heading: the copy held in this repository." },
  { en: "Metadata record", comment: "Table column heading: the item's Dublin Core record." },
  { en: "no collection recorded", comment: "In the Collection column when the catalogue names none." },
  { en: "in {communities}", comment: "Under a collection's name: the communities it sits in. {communities} is a list of names from the catalogue." },
  { en: "none captured", comment: "In the Metadata record column when no record was captured." },
  { en: "declared, but missing on disk", comment: "In the Metadata record column when the record is declared but its file is absent." },
  { en: "Download {file}", comment: "Link to download a metadata record. {file} is a file name." },
  { en: "via CDN", comment: "Second link to the same file, served by a content delivery network." },
  { en: "qualified Dublin Core · {size} KB", comment: "Under the download link: the record's format and size. {size} is a number." },
  { en: "no record, so nothing to render", comment: "In the Dublin Core renderings row when the item has no record." },
  { en: "this instance declares no published root", comment: "In the Dublin Core renderings row when there is nowhere to publish them." },
  { en: "{label}: not rendered (run {command})", comment: "A rendering that has not been produced. {label} is the rendering's name, {command} a command in code type." },
  { en: "Dublin Core XML", comment: "Link to the item's record as XML." },
  { en: "JSON-LD (DCMI Terms)", comment: "Link to the item's record as JSON-LD." },
  { en: "Local replica →", comment: "Link from a table row to this replica's page for the item. Flip the arrow if your language reads right to left." },
  { en: "IRIS source →", comment: "Link from a table row to the item's page at WHO. Flip the arrow if your language reads right to left." },
  { en: "no upstream URI recorded", comment: "In the Upstream column when the catalogue has no WHO address for the item." },
  { en: "held here, not published — {gates}", comment: "In place of a download link when a file is held but may not be published. {gates} names the publication gates that refused it, which are not translated." },
  { en: "not held here", comment: "In place of a download link when the file is not held in this repository." },
  { en: "not recorded", comment: "A file size the catalogue does not record." },
  { en: "{size} MB", comment: "A file size in megabytes. {size} is a number with two decimals." },

  // ── The community list ──────────────────────────────────────────────────
  { en: "List of Communities", comment: "Title and heading of the community list page, and a link to it from the home page." },
  { en: "{files} files · {size} upstream", comment: "Under a community: how many files it holds at WHO and their total size. {files} is a number, {size} a size such as '12.3 GiB'." },
  { en: "size upstream <strong>unknown</strong> — the storage report's second page was never read, and a number interpolated from the first would look measured", comment: "Under a community whose size at WHO was never measured." },
  { en: "{modelled} item(s) modelled, {held} held here", comment: "Beside a collection: how many of its items the catalogue models, and how many are held here. Both are numbers; rephrase freely to avoid plural agreement." },
  { en: "Every row below is <strong>live</strong>. A row is not greyed out when this repository does not hold it — it says {referenced} instead, which is the actual state and the whole point of a catalogue modelled by reference. {materialized} means the bytes are here.", comment: "Introduction to the community list. {referenced} and {materialized} are the state badges, already translated." },
  { en: "Held here — {n} materialized item(s)", comment: "Heading of the table of held items. {n} is a number." },
  { en: "Each row carries <strong>three routes to the same item</strong>: the <strong>IRIS source</strong> upstream at WHO, this repository's own <strong>local replica</strong> page, and the <strong>asset itself</strong> — downloadable from the repository and, separately, from a CDN edge.", comment: "Paragraph under that heading." },
  { en: "<strong>Three routes to one item, which is the point.</strong> The catalogue knows this item once; the bytes are reachable <em>upstream at WHO</em>, <em>here as a replica page</em>, and <em>from a CDN edge</em> — jsDelivr serves any public repository, so the last one costs this project no hosting at all. The KG says what exists and where; the CDN says nothing and just serves it.", comment: "Note under the held-items table. KG is 'knowledge graph'; jsDelivr is a product name." },
  { en: "<strong>Both link forms are confirmed working.</strong> The <code>raw.githubusercontent.com</code> links were fetched and returned 200 with byte counts matching the catalogue exactly. The <em>via CDN</em> links could not be checked from the environment that generated this page — <code>cdn.jsdelivr.net</code> is egress-blocked there — so they were composed from jsDelivr's documented URL form and the owner exercised one by hand on 2026-09-20. Both are kept: one costs this project nothing to serve, and a reader who finds either unavailable still has the other.", comment: "Note under the held-items table. Keep everything in <code> as written." },
  { en: "<strong>Where the held copies actually live — bean <code>yl5w</code>.</strong> The catalogue records each of these at <code>uploads/&lt;name&gt;.pdf</code> relative to <code>who-iris/</code>, and <em>all three of those paths are missing</em>: #477 moved <code>library/</code> into this instance and left <code>uploads/</code> in <code>cat-harness/</code>.", comment: "Note under the held-items table. A 'bean' is an agent's note on the work still needed (its state) for a Task, in one instance of a Process flow. It is NOT a task: Task is its own term here. Translate 'bean' with your language's ordinary word for a bean or kernel (as in a coffee bean), used the same way every time (owner ruling 2026-10-11). #477 is a pull request number. Keep everything in <code> as written." },
  { en: "The download links above point at where the bytes <em>are</em>, so they work. The claim in the catalogue is what is wrong, and <code>check:catalogue</code> does not check <code>localPath</code> at all — it verifies <code>metadataRef</code> and <code>libraryId</code>, and reports a clean run over three <code>materialized</code> claims that resolve to nothing.", comment: "Continues the note above. Keep everything in <code> as written: they are field and command names." },

  // ── A collection ────────────────────────────────────────────────────────
  { en: "Permanent URI for this collection", comment: "DSpace label before the collection's handle URL." },
  { en: "none recorded", comment: "In place of a URL or link the catalogue does not record." },
  { en: "<strong>How this node was established.</strong> {note}", comment: "Box above a collection's items. {note} is the catalogue's own note, which is not translated." },
  { en: "Items in this Collection", comment: "DSpace heading over a collection's item list." },
  { en: "Now showing 1 – {n} of {n} <em>modelled</em>. The upstream collection is larger; this catalogue holds what was materialised, and says so per row.", comment: "Under that heading. {n} is the number of items the catalogue models in this collection." },

  // ── An item ─────────────────────────────────────────────────────────────
  { en: "Permanent URI for this item", comment: "DSpace label before the item's handle URL." },
  { en: "none recorded — ingested from a local copy, not resolved from IRIS", comment: "In place of the item's URL when it has none." },
  { en: "In: {path}", comment: "Under the item's URL: the community and collection it sits in. {path} is names from the catalogue joined by ›." },
  { en: "Files", comment: "DSpace heading over the item's files." },
  { en: "Name", comment: "Table column heading: a file's name." },
  { en: "Bundle", comment: "Table column heading: the DSpace bundle a file belongs to (ORIGINAL, THUMBNAIL — those values are not translated)." },
  { en: "Size", comment: "Table column heading: a file's size." },
  { en: "Read it here", comment: "Heading over the embedded PDF reader." },
  { en: "Both links, as asked for", comment: "Heading over the table of the item's links: upstream at WHO and held here." },
  { en: "Where", comment: "Table column heading." },
  { en: "Link", comment: "Table column heading." },
  { en: "Upstream, at WHO", comment: "Row label: the item's address at WHO." },
  { en: "Held here, in folio-assistant", comment: "Row label: the copy held in this repository. folio-assistant is a name." },
  { en: "not held", comment: "In the row above when nothing is held." },
  { en: "In collection", comment: "Row label: the collection the item belongs to." },
  { en: "Ingested text (L1)", comment: "Row label: the item's text as extracted into this repository's library. L1 is a level name; keep it." },
  { en: "Dublin Core record", comment: "Row label: the item's metadata record." },
  { en: "Dublin Core renderings", comment: "Row label: the record rendered as XML and JSON-LD." },
  { en: "<strong>No Dublin Core record.</strong> The catalogue says so rather than synthesising metadata from the PDF — the <code>iris-dspace</code> skill's R8, <em>never infer metadata from the PDF when a record exists</em>, whose converse is that an absent record stays absent.", comment: "Shown on an item with no metadata record. iris-dspace is the name of a skill and R8 a rule number; keep both." },

  // ── The home page ───────────────────────────────────────────────────────
  { en: "The primary objective of the Institutional Repository for Information Sharing (IRIS) is to provide free digital access to the scientific and technical publications of the World Health Organization (WHO), including contributions from its Country Offices, Regional Offices, and Headquarters. Additionally, IRIS encompasses the mandates established by the Organization’s Governing Bodies in collaboration with its Member States.", comment: "The hero paragraph on the home page, as IRIS's own home page states it. Use the Organization's official names for its offices and Governing Bodies in your language." },
  { en: "Replica. No WHO emblem, no photograph — colour only, from the {theme} theme measured off the site’s own stylesheet.", comment: "Small print under the hero paragraph. {theme} is a theme's name in code type." },
  { en: "Search through the repository’s {n} items", comment: "Placeholder text inside the search box. {n} is a number, written without separators." },
  { en: "Search through the repository items and referenced identifier lookup", comment: "Accessible name of the search box." },
  { en: "Search", comment: "The search button." },
  { en: "Search across <strong>{held}</strong> items held by value and referenced communities/collections. To look up any of the <strong>{referenced}</strong> referenced nodes by identifier, search here or open the {lookup}.", comment: "Note under the search box. {held} and {referenced} are numbers; {lookup} is a link whose text is the next string." },
  { en: "identifier lookup", comment: "Link text: the page that looks a node up by its identifier." },
  { en: "Upstream IRIS reports <strong>{items}</strong> items across <strong>{files}</strong> files.", comment: "Continues the note above. {items} and {files} are numbers." },
  { en: "Recent Submissions", comment: "DSpace heading on the home page." },
  { en: "Ordered by {key}, latest first — the key IRIS’s own list sorts on. Where a record carries several accessions the latest is used; the WPRO item has two, five days apart, the second being the regional-IRIS merge.", comment: "Under that heading. {key} is a metadata field name in code type. WPRO is the WHO Western Pacific Regional Office; keep the acronym." },
  { en: "Browse", comment: "Heading on the home page." },
  { en: "{link} — the replica of {url}, with every node’s materialisation state ({communities} communities, {collections} collections)", comment: "A list entry under Browse. {link} is the 'List of Communities' link, {url} an address in code type, {communities} and {collections} numbers." },
  { en: "{link} — collection", comment: "A list entry under Browse. {link} is a collection's name from the catalogue, which is not translated." },
  { en: "no author recorded", comment: "In a recent submission's byline when the record names no author." },
  { en: "Publication Date: {date}", comment: "In a recent submission's byline, as IRIS labels it. {date} is a date such as 2020-05-14." },
  { en: "A cover is rendered and held here. It is not published: {gates}.", comment: "Tooltip on a withheld cover. {gates} names the publication gates that refused it, which are not translated." },
  { en: "cover<br>withheld", comment: "Placeholder in place of a withheld cover image, over two lines. The <br> may move." },
  { en: "no cover rendered", comment: "Tooltip on the placeholder of an item with no cover." },
  { en: "no cover", comment: "Placeholder in place of a cover that was never rendered." },
  { en: "Cover of {title}, rendered here from page 1 of the held PDF", comment: "Alternative text of a cover image, read by a screen reader. {title} is the publication's title, which is not translated." },
  { en: "Cover of {title}, rendered here from page 1 of the held PDF, with the WHO emblem masked out", comment: "As above, for a cover whose WHO emblem was masked." },
  { en: "A cover is rendered and recorded for this item. It is not displayed: the publication's cover carries the WHO emblem, and this replica is not published under WHO.", comment: "Tooltip on a cover the replica chooses not to display." },
  { en: "No <code>dc.description.abstract</code> in the captured record.", comment: "In place of an abstract the record does not carry. Keep the field name in <code> as written." },

  // ── The search box's results, drawn in the browser ─────────────────────
  { en: "Matching catalogue nodes ({n}):", comment: "Heading of the search results. {n} is a number." },
  { en: "Also search identifier lookup:", comment: "Before a link that repeats the search in the identifier lookup." },
  { en: "Look up “{q}” in referenced nodes →", comment: "That link. {q} is what the reader typed. Use your language's quotation marks; flip the arrow for right-to-left." },
  { en: "No materialized items or collections matched “<strong>{q}</strong>”.", comment: "When nothing matches. {q} is what the reader typed." },
  { en: "Search for “{q}” in the referenced identifier lookup ({n} nodes) →", comment: "Link shown when nothing matches. {q} is what the reader typed, {n} a number. Flip the arrow for right-to-left." },

  // ── The search page (issue #196), mimicking iris.who.int/search ──────
  { en: "Filters", comment: "Heading of the search page's sidebar of facets." },
  { en: "Author", comment: "A facet on the search page: the items' authors (dc.contributor.author)." },
  { en: "Subject", comment: "A facet on the search page: the items' subjects. IRIS shows two facets with this label (MeSH headings, then all subjects)." },
  { en: "Date issued", comment: "A facet on the search page: when the item was published (dc.date.issued)." },
  { en: "Start", comment: "Label of the first year box in the Date issued facet." },
  { en: "End", comment: "Label of the second year box in the Date issued facet." },
  { en: "Apply", comment: "Button that applies the year range typed in the Date issued facet." },
  { en: "Has files", comment: "A facet on the search page: whether the item has files." },
  { en: "Yes", comment: "A value of the Has files facet." },
  { en: "No", comment: "A value of the Has files facet." },
  { en: "Publisher", comment: "A facet on the search page: the items' publishers (dc.publisher)." },
  { en: "Series", comment: "A facet on the search page: the series or journal an item is part of." },
  { en: "Type", comment: "A facet on the search page: the item's type (dc.type), such as Publications or Journal articles." },
  { en: "Show more", comment: "Button under a facet that lists more of its values; also under a long abstract." },
  { en: "Show less", comment: "Button that undoes Show more." },
  { en: "Search author name", comment: "Placeholder of the box that searches within the Author facet." },
  { en: "Search subject", comment: "Placeholder of the box that searches within a Subject facet." },
  { en: "Search publisher", comment: "Placeholder of the box that searches within the Publisher facet." },
  { en: "Search series", comment: "Placeholder of the box that searches within the Series facet." },
  { en: "Search type", comment: "Placeholder of the box that searches within the Type facet." },
  { en: "Settings", comment: "Heading of the search page's sort and page-size settings." },
  { en: "Sort By", comment: "Label of the search page's sort menu." },
  { en: "Most Relevant", comment: "A sort order on the search page." },
  { en: "Title Ascending", comment: "A sort order on the search page: by title, A to Z." },
  { en: "Date Issued Descending", comment: "A sort order on the search page: newest publication date first." },
  { en: "Accessioned Date Descending", comment: "A sort order on the search page: most recently taken into IRIS first." },
  { en: "Available Date Descending", comment: "A sort order on the search page: most recently made available first." },
  { en: "Results per page", comment: "Label of the search page's page-size menu." },
  { en: "Search Results", comment: "Heading above the search results." },
  { en: "Now showing {from} - {to} of {total}", comment: "Above the search results. {from}, {to} and {total} are numbers." },
  { en: "Accepted: {date}", comment: "In a search result's byline, as IRIS labels it (dc.date.accessioned). {date} is a date such as 2020-05-14." },
  { en: "Available Online: {date}", comment: "In a search result's byline, as IRIS labels it (dc.date.available). {date} is a date such as 2020-05-14." },
  { en: "List view", comment: "Button that shows the search results as a list." },
  { en: "Grid view", comment: "Button that shows the search results as a grid of cards." },
  { en: "Your search returned no results.", comment: "Shown when nothing matches the search and filters." },
  { en: "Remove filter: {value}", comment: "Accessible name of an applied-filter chip, read by a screen reader. {value} is the facet and its value." },
  { en: "Reset filters", comment: "Link that removes every applied filter." },
  { en: "Previous page", comment: "Accessible name of the « link in the pagination." },
  { en: "Next page", comment: "Accessible name of the » link in the pagination." },
  { en: "Pagination", comment: "Accessible name of the row of page numbers." },
  { en: "Search the repository", comment: "Accessible name of the search page's search box." },
  { en: "This page searches the {held} items catalogued here, in your browser; upstream IRIS holds {upstream}. The filters are IRIS’s own; their values and counts are computed from the current results.", comment: "Note under the search page's search box. {held} is how many items the catalogue here describes (more than are held by value), {upstream} how many IRIS holds." },
];

const SITE_TABLE = new Map(SITE_STRINGS.map((s) => [s.en, s]));

/**
 * The six UN languages in the order the docs locale globe draws them
 * (`UN_LOCALES` in `docs-ui.js`), so the `fa-translation-meta` block a page
 * carries reads the same as every other page's.
 */
const SUPPORTED_LOCALES: readonly Locale[] = ["ar", "zh", "en", "fr", "ru", "es"];

/** Each language's name in its own language: a reader looking for 中文 is not looking for "Chinese". */
const LOCALE_NAMES: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
  es: "Español",
  fr: "Français",
  ru: "Русский",
  zh: "中文",
};

/** The gettext catalogue's name, under `<translations>/<locale>/site/`. */
const SITE_CATALOGUE = "iris-site";
const SITE_CATALOGUE_DIR = "site";

/** The declared `translation-sources` directory — never a spelled path. */
function translationsDir(): string {
  const entry = readDeclaration(INSTANCE)?.directories?.find((d) =>
    (d.graphTypologies ?? []).includes("translation-sources"),
  );
  if (entry === undefined) {
    throw new Error("gen-iris-pages: who-iris declares no `translation-sources` directory, so there is nowhere to read the replica's translations from.");
  }
  return join(INSTANCE, entry.path);
}

const catalogueFile = (locale: string, ext: "po" | "pot"): string =>
  join(translationsDir(), locale, SITE_CATALOGUE_DIR, `${SITE_CATALOGUE}.${ext}`);

const CATALOGUES = new Map<string, Map<string, string>>();
function catalogueFor(locale: string): Map<string, string> {
  let m = CATALOGUES.get(locale);
  if (m === undefined) {
    const f = catalogueFile(locale, "po");
    m = existsSync(f) ? parsePo(readFileSync(f, "utf-8")) : new Map();
    CATALOGUES.set(locale, m);
  }
  return m;
}

/** The language the page being rendered is in. Set per page set by `main`. */
let LOCALE: Locale = "en";

/**
 * A string in the current page's language, with its placeholders filled.
 *
 * Falls back to the English per string, so a missing translation renders as
 * English rather than as nothing — and `--check` reports the gap. `vars` are
 * substituted AFTER translation and must already be escaped: the msgid is
 * trusted markup from this table, a value is not.
 */
function t(en: string, vars: Record<string, string | number> = {}): string {
  if (!SITE_TABLE.has(en)) {
    throw new Error(`gen-iris-pages: "${en.slice(0, 60)}" is not in SITE_STRINGS, so no translator was ever asked about it. Add it there.`);
  }
  let s = LOCALE === "en" ? en : catalogueFor(LOCALE).get(en) || en;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** A number in the current page's language, in Latin digits (as WHO's own Arabic pages print them). */
function num(n: number, decimals?: number): string {
  const fixed = decimals === undefined ? {} : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return n.toLocaleString(LOCALE === "en" ? "en-US" : `${LOCALE}-u-nu-latn`, fixed);
}

/** The directory the current page set is written to. */
const siteDir = (): string => (LOCALE === "en" ? SITE : join(SITE, LOCALE));
/** What a current page prefixes to reach the replica's root. */
const toSiteRoot = (): string => (LOCALE === "en" ? "" : "../");

/** Every `{placeholder}` a string carries, sorted. */
function placeholdersOf(s: string): string[] {
  return [...s.matchAll(/\{([a-zA-Z]\w*)\}/g)].map((m) => m[1]!).sort();
}

/** Every element a string opens or closes, sorted — a translation must keep the same markup. */
function tagsOf(s: string): string[] {
  return [...s.matchAll(/<\/?([a-zA-Z]+)/g)].map((m) => m[0]!.toLowerCase()).sort();
}

/** The table as POT entries, each pointing at the line of this file that declares it. */
export function sitePotEntries(): PotEntry[] {
  const source = readFileSync(import.meta.path, "utf-8").split("\n");
  return SITE_STRINGS.map((s) => {
    const needle = `en: ${JSON.stringify(s.en)}`;
    const i = source.findIndex((l) => l.includes(needle));
    return {
      source: "who-iris/scripts/gen-iris-pages.ts",
      line: i + 1,
      msgid: s.en,
      kind: "ui-string",
      comment: s.comment,
    };
  });
}

/**
 * Drift between the table and the catalogues: a stale template, a translation
 * of a string the replica no longer says, a dropped placeholder or tag, an
 * empty or fuzzy entry. Coverage below 100 % is drift here, not a note: the
 * owner asked for every page in every language, and a gap would render as
 * English inside a page that says it is translated.
 */
export function catalogueProblems(): { problems: string[]; notes: string[] } {
  const problems: string[] = [];
  const notes: string[] = [];
  for (const loc of SITE_LOCALES) {
    const pot = catalogueFile(loc, "pot");
    const po = catalogueFile(loc, "po");
    if (!existsSync(pot)) problems.push(`${loc}: no ${SITE_CATALOGUE}.pot — run with --extract-pot`);
    else {
      const ids = new Set(parsePoEntries(readFileSync(pot, "utf-8")).map((e) => e.msgid));
      const missing = SITE_STRINGS.filter((s) => !ids.has(s.en)).length;
      const extra = [...ids].filter((id) => !SITE_TABLE.has(id)).length;
      if (missing || extra) problems.push(`${loc}: ${SITE_CATALOGUE}.pot is stale — ${missing} string(s) missing, ${extra} no longer said. Run with --extract-pot.`);
    }
    if (!existsSync(po)) {
      problems.push(`${loc}: no ${SITE_CATALOGUE}.po`);
      continue;
    }
    const entries = parsePoEntries(readFileSync(po, "utf-8"));
    const byId = new Map(entries.map((e) => [e.msgid, e]));
    let done = 0;
    for (const e of entries) {
      if (!SITE_TABLE.has(e.msgid)) problems.push(`${loc}: translates a string the replica no longer says — "${e.msgid.slice(0, 48)}…"`);
    }
    for (const s of SITE_STRINGS) {
      const e = byId.get(s.en);
      if (e === undefined || e.msgstr === "") {
        problems.push(`${loc}: untranslated — "${s.en.slice(0, 48)}…"`);
        continue;
      }
      if (e.flags.includes("fuzzy")) problems.push(`${loc}: fuzzy — "${s.en.slice(0, 48)}…"`);
      if (placeholdersOf(s.en).join() !== placeholdersOf(e.msgstr).join()) {
        problems.push(`${loc}: placeholders differ — "${s.en.slice(0, 40)}…" has {${placeholdersOf(s.en).join(",")}}, the translation {${placeholdersOf(e.msgstr).join(",")}}`);
      }
      if (tagsOf(s.en).join() !== tagsOf(e.msgstr).join()) {
        problems.push(`${loc}: markup differs — "${s.en.slice(0, 40)}…" has [${tagsOf(s.en).join(" ")}], the translation [${tagsOf(e.msgstr).join(" ")}]`);
      }
      done++;
    }
    notes.push(`${loc}: ${done}/${SITE_STRINGS.length} — ${LOCALE_NAMES[loc]}`);
  }
  return { problems, notes };
}

/** Write each locale's `.pot` from the table. The `.po` beside it is a translator's, and is never touched. */
function extractPot(): void {
  const entries = sitePotEntries();
  for (const loc of SITE_LOCALES) {
    const f = catalogueFile(loc, "pot");
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, formatPot(entries, { projectName: `who-iris ${SITE_CATALOGUE}`, locale: loc }));
    console.log(`  ${relative(REPO_ROOT, f)}`);
  }
  console.log(`${entries.length} string(s) extracted for ${SITE_LOCALES.join(", ")}.`);
}

/** The same replica page in another language, relative to the current one. */
function hrefIn(target: Locale, file: string): string {
  return `${toSiteRoot()}${target === "en" ? "" : `${target}/`}${file}`;
}

/**
 * What a replica page puts in its `<head>` to say which language it is in and
 * where its other languages are.
 *
 * The `fa-translation-meta` block is the docs pages' own (`_includes/
 * head_custom.html`), carried here because a mounted page is never laid out
 * by Jekyll: `docs-ui.js` reads it to draw the locale globe, and
 * `set-html-lang.ts` to stamp the served `<html lang>`. Every locale is
 * AVAILABLE here — the globe greys out a locale with no page, and the
 * replica has a page in all six (issue #2219 drew the globe with five of them
 * greyed out, because until now there were none). The layout it links to,
 * `<dir>/<locale>/<page>`, is `localePath` in `docs-ui.js`, so the globe and
 * the links below agree without either knowing about the other.
 */
function localeHead(file: string): string {
  const meta = {
    lang: LOCALE,
    translationStatus: LOCALE === "en" ? "" : "unverified",
    translationSource: LOCALE === "en" ? "" : `who-iris/site/${file}`,
    supportedLocales: SUPPORTED_LOCALES,
    availableLocales: SUPPORTED_LOCALES,
  };
  const alternates = SUPPORTED_LOCALES.map(
    (loc) => `\n<link rel="alternate" hreflang="${loc}" href="${esc(hrefIn(loc, file))}">`,
  ).join("");
  return `${alternates}\n<script type="application/json" id="fa-translation-meta">${JSON.stringify(meta)}</script>`;
}

/**
 * The row of language links in the banner, and — on a translated page —
 * where the translation stops.
 *
 * Each language is named in its own language and marked with its own `lang`,
 * so a screen reader pronounces 中文 as Chinese inside an English page.
 */
function localeBar(file: string): string {
  const links = SUPPORTED_LOCALES.map((loc) =>
    loc === LOCALE
      ? `<span lang="${loc}" aria-current="page">${LOCALE_NAMES[loc]}</span>`
      : `<a href="${esc(hrefIn(loc, file))}" lang="${loc}" hreflang="${loc}">${LOCALE_NAMES[loc]}</a>`,
  ).join("");
  const note =
    LOCALE === "en"
      ? ""
      : `\n  <p class="langnote">${t("The interface is shown in {language}. Publication titles, authors, abstracts and other catalogue records are shown as WHO published them.", { language: LOCALE_NAMES[LOCALE] })}
  ${t("This interface translation was produced by an agent and has not been reviewed by a person.")}</p>`;
  return `\n  <nav class="langs" aria-label="${esc(t("Interface language"))}">${links}</nav>${note}`;
}

const THEME = whoThemeById("iris-web")!;

/**
 * The shared chrome.
 *
 * `--iris-*` custom properties, named after the theme's ROLES rather than after
 * the colours, for the reason `schemas/theme.ts` exists: a rule that reads
 * `var(--iris-accent)` still means something when the accent changes.
 */
/**
 * The sticky banner's figures, COMPUTED.
 *
 * They were three literals — "12 nodes of a 361.55 GiB repository, of which 3
 * items are held here" — and by the time the covers landed the first was
 * wrong: the catalogue had thirteen nodes and every page said twelve. That is
 * the failure this repository keeps naming in its own prose, *a count in prose
 * is a claim rather than evidence*, committed on the one line that appears at
 * the top of every page.
 *
 * Memoised because it appears on all of them and the inputs cannot change
 * within a run.
 */
const BANNER = new Map<Locale, string>();
function banner(): string {
  const memo = BANNER.get(LOCALE);
  if (memo !== undefined) return memo;
  const all = nodes();
  const held = all.filter((n) => n.flavour === "item" && assetHref(n) !== undefined).length;
  const c = catalogue();
  const figures =
    c.totalBytesUpstream === undefined || c.totalItemsUpstream === undefined
      ? t("{nodes} nodes of a repository of unmeasured size, of which <strong>{held} item(s)</strong> are held here", { nodes: num(all.length), held: num(held) })
      : held === 1
        ? t("{nodes} nodes of a {items}-item {size} repository, of which <strong>1 item</strong> is held here", { nodes: num(all.length), items: num(c.totalItemsUpstream), size: gb(c.totalBytesUpstream) })
        : t("{nodes} nodes of a {items}-item {size} repository, of which <strong>{held} items</strong> are held here", { nodes: num(all.length), items: num(c.totalItemsUpstream), size: gb(c.totalBytesUpstream), held: num(held) });
  BANNER.set(LOCALE, figures);
  return figures;
}

/**
 * The pattern that finds the SITE ROOT from one of these pages' own URLs, and
 * the folio mount built from it.
 *
 * F8/F9, bean `jpjt`. Owner: *"who-iris, smart-* etc are content libraries a
 * user is browsing and their 'folio' from the cat-harness is consistent
 * across them."* The reader carries their folio into the library; the library
 * does not implement one. `board-windows` puts the test plainly — *"the test
 * is not 'is this folio good' but 'is this the same folio'"* — so the page
 * loads the platform's own stylesheet and script and there is no second
 * implementation here to drift.
 *
 * **The pattern lives in this file and not in the platform**, because it is a
 * statement about THIS instance's routes: `who-iris/site/` is served at
 * `/who-iris/` and `who-iris/docs/` at `/docs/who-iris/`, exactly as the
 * comment below records. A platform module that knew that would be the
 * platform knowing about one library.
 *
 * Both mounts, and the two bases this site is actually served under:
 *
 * | URL | site root |
 * |---|---|
 * | `/who-iris/item-x.html` | `/` |
 * | `/docs/who-iris/ingestion-notes.html` | `/` |
 * | `/folio-assistant/who-iris/item-x.html` | `/folio-assistant/` |
 * | `/branches/<branch>/who-iris/item-x.html` | `/branches/<branch>/` |
 *
 * | `/who-iris/who-iris/item-x.html` | `/who-iris/` |
 * | `/who-iris/docs/who-iris/ingestion-notes.html` | `/who-iris/` |
 *
 * That fourth row is why this is derived in the browser rather than written as
 * an absolute URL: a baked site URL is correct on exactly one of those.
 *
 * **The LAST `who-iris/` in the path is the route, not the first.** The last
 * two rows are this instance's OWN site (owner, 2026-10-09: "index.html should
 * follow cat-harness and folio-asst"), served from a repository that is itself
 * named `who-iris`, so the base path and the route spell the same word. A lazy
 * match stopped at the base, rooted the site at the host, and every PDF frame
 * asked for `/assets/vendor/pdfjs/…` — a 404 the owner hit on the live site.
 * The lookahead keeps the lazy group but forbids a later `who-iris/`.
 */
const FOLIO_ROUTE = /^(.*?)(?:docs\/)?who-iris\/(?!.*who-iris\/)/;
/**
 * The folio mount, emitted on who-iris's OWN pages and withheld on the
 * `harness` side. The withholding is measured, not stylistic.
 *
 * `FOLIO_ROUTE` is `^(.*?)(?:docs\/)?who-iris\/(?!.*who-iris\/)`, which MATCHES
 * `/cat-harness/catalogue/who-iris/` — the route the catalogue viewer moved to
 * for bean `ha78` — and derives the site root as `/cat-harness/catalogue/`.
 * The mount would then request its two assets from a path that 404s. A script
 * that matches the WRONG thing is worse than one that does not match at all:
 * it runs, it fails, and it looks installed.
 *
 * Widening the pattern is not the repair either. The mount exists so a reader
 * browsing WHO-IRIS carries their folio (#796, F8/F9); a kind viewer published
 * under cat-harness's handler is on cat-harness's site, which has its own
 * chrome. Matching it would put who-iris's furniture on a cat-harness route.
 *
 * #879's own gate agrees by construction: who-iris declares
 * `folioMount.roots` as `["site/", "docs/"]`, and the viewer is under
 * neither, so nothing asks that page for the marker.
 */
const FOLIO_MOUNT = folioMountFragment(FOLIO_ROUTE);

/**
 * One replica page.
 *
 * `side` is not decoration: the two sides are MOUNTED AT DIFFERENT ROUTES —
 * `who-iris/site/` at `/who-iris/` and `who-iris/docs/` at
 * `/docs/who-iris/` — so a relative link written on one side and rendered on
 * the other resolves to a path that does not exist. Both sides carried exactly
 * that, and both 404ed on the deployed site: the shared chrome's
 * `community-list.html` from every docs page, and the landing page's
 * `ingestion-notes.html` from `/who-iris/`. The comment below anticipated it
 * in 2026-09-21 — *"linking across two mount points … breaks the first time
 * either route moves"* — and the links were written anyway.
 *
 * Nothing here composes a cross-mount path to replace them. **The harness rail
 * is the cross-mount navigation** (`◆ who-iris`, `D docs`, `L library`), and
 * it is injected at mount time by the layer that knows the routes. A generator
 * that composed `../../who-iris/` would be this instance holding a second copy
 * of the mount table, free to disagree with it.
 */
function page(
  title: string,
  crumbs: { label: string; href?: string; record?: { lang?: string } }[],
  body: string,
  /**
   * WHICH SITE THIS PAGE IS ON. `site` and `docs` are who-iris's own tree,
   * mounted under its routes. The third answer, `harness` — the catalogue
   * viewer, published into cat-harness's site — left this function on
   * 2026-10-07 for the site's own layout ({@link catalogueViewer}).
   */
  side: "site" | "docs",
  /**
   * The graph typologies this page documents, as `<meta name="documents">` — the
   * page names what it is about, so the directory need not name the page
   * (#1168 B7c). Only the docs index carries one.
   */
  documents: readonly string[] = [],
  /**
   * The page's file name within the replica, for a page built in every
   * language: it is what the language links, the `hreflang` alternates and the
   * `fa-translation-meta` block are made from. Absent on the docs and harness
   * sides, which are English only and carry none of the three.
   */
  file?: string,
): string {
  /* A CRUMB WITH NO HREF IS A LABEL, never `<a href="#">`.
   *
   * The fallback used to be `#`, which was harmless while every non-final
   * crumb carried an href — and stopped being harmless the moment one did
   * not. Moving the catalogue viewer to the conventional route (bean `ha78`)
   * dropped its "Documentation" href, because the docs index is on a mount
   * route and no relative path reaches it from here. The crumb then rendered
   * as `<a href="#">who-iris</a>`: focusable, styled as a link, announced as
   * a link, and doing nothing.
   *
   * That is the defect the href was dropped to AVOID, reintroduced by the
   * template one layer down. Verified by rendering the page rather than by
   * reading the call site, which is what `gjli` is about — the generator's
   * input looked right and its output did not.
   */
  const crumbHtml = crumbs
    .map((c, i) =>
      i === crumbs.length - 1 || c.href === undefined
        ? `<span class="here">${crumbLabel(c)}</span>`
        : `<a href="${esc(c.href)}">${crumbLabel(c)}</a>`,
    )
    .join('<span class="sep">•</span>');

  const dir = LOCALE === "ar" ? ' dir="rtl"' : "";
  return `<!DOCTYPE html>
<html lang="${LOCALE}"${dir}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t("{title} — ingested IRIS replica", { title }))}</title>${documents.length ? `\n<meta name="documents" content="${esc(documents.join(" "))}">` : ""}
<meta name="description" content="${esc(t("A replica of a WHO IRIS page, rendered from this repository's ingested catalogue. Not WHO, and not live."))}">${file === undefined ? "" : localeHead(file)}
<!-- Generated by who-iris/scripts/gen-iris-pages.ts. Do not hand-edit: the next run overwrites it, and \`iris:pages:check\` fails on the difference. -->
<style>
  :root {
    /* Measured in who-iris/themes/themes.ts from the captured client-theme.css. */
    --iris-accent: ${THEME.palette.accent};
    --iris-ink: ${THEME.palette.ink};
    --iris-edge: ${THEME.palette.edge};
    --iris-surface: ${THEME.palette.surface};
    --iris-dark: #005072;          /* --dark */
    --iris-deep: #2B4E72;          /* --blue */
    --iris-breadcrumb-bg: #e9ecef; /* --ds-breadcrumb-bg */
    --iris-wash: #FAFAFA;          /* --ds-almost-white */
    --iris-current: #d86422;       /* --warning */
    --iris-muted: #6c757d;         /* --gray */
    --iris-ingested: #006666;      /* --info */
    --iris-col: ${(THEME.layouts as { laptop: { minWidth: string } }).laptop.minWidth};
    --iris-pad: ${(THEME.layouts as { laptop: { padding: string } }).laptop.padding};
    /* TEXT roles, split from the grounds they share a colour with in light
       mode, so dark mode can give each its own value. */
    --iris-link: var(--iris-accent);
    --iris-heading: var(--iris-dark);
    --iris-paper: #fff;
    --iris-cdn: var(--iris-ingested);
    --iris-tag-bg: #e2eaf0;
    --iris-mat: #1d5c1d; --iris-mat-edge: #94BA65; --iris-mat-bg: #f0f6e9;
    --iris-unk: #7a4a10; --iris-unk-edge: #ec9433; --iris-unk-bg: #fdf4e8;
  }
  /* DARK MODE (owner, 2026-10-30: "dark mode of main display of who-iris is
     still white"). The replica is IRIS's light page; in dark the same roles
     take dark grounds and light inks, keyed on the site's scheme switch
     (data-fa-scheme) and else the OS, as the rail and page-layout.css are.
     Text pairs are at least 4.5:1 (WCAG AA); the accent ground darkens so
     white on it is too. Same values in both blocks. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-fa-scheme="light"]) {
      --iris-surface: #0d1117; --iris-ink: #e6edf3; --iris-edge: #3d444d;
      --iris-wash: #151b23; --iris-breadcrumb-bg: #151b23; --iris-muted: #9198a1;
      --iris-paper: #161b22; --iris-accent: #0b6a9a; --iris-link: #6cb6ff;
      --iris-heading: #79c0ff; --iris-current: #f0883e; --iris-cdn: #56d4d4;
      --iris-tag-bg: #1c2d3d;
      --iris-mat: #8fd18f; --iris-mat-edge: #4d7a2a; --iris-mat-bg: rgba(148,186,101,.16);
      --iris-unk: #f0c27a; --iris-unk-edge: #8a6420; --iris-unk-bg: rgba(236,148,51,.16);
      color-scheme: dark;
    }
  }
  :root[data-fa-scheme="dark"] {
    --iris-surface: #0d1117; --iris-ink: #e6edf3; --iris-edge: #3d444d;
    --iris-wash: #151b23; --iris-breadcrumb-bg: #151b23; --iris-muted: #9198a1;
    --iris-paper: #161b22; --iris-accent: #0b6a9a; --iris-link: #6cb6ff;
    --iris-heading: #79c0ff; --iris-current: #f0883e; --iris-cdn: #56d4d4;
    --iris-tag-bg: #1c2d3d;
    --iris-mat: #8fd18f; --iris-mat-edge: #4d7a2a; --iris-mat-bg: rgba(148,186,101,.16);
    --iris-unk: #f0c27a; --iris-unk-edge: #8a6420; --iris-unk-bg: rgba(236,148,51,.16);
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    /* The stack the captured stylesheet declares, verbatim. */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
    font-size: 1rem; font-weight: 400; line-height: 1.5;
    color: var(--iris-ink); background: var(--iris-surface);
  }
  .wrap { max-width: var(--iris-col); margin: 0 auto; padding: 0 var(--iris-pad); }
  /* A long path in inline code has no break opportunity, and at a 390 px
     viewport three of them made kg-to-portal 566 px wide (bean xwrt). These
     pages are mounted verbatim, so the harness's narrow-viewport.css never
     reaches them. Breaking the string beats widening the page. */
  :not(pre) > code { overflow-wrap: anywhere; }
  a { color: var(--iris-link); text-decoration: none; }
  a:hover, a:focus { text-decoration: underline; }

  /* ── The banner. Not decoration: it is requirement 1. ───────────────── */
  .ingested {
    background: var(--iris-ingested); color: #fff;
    padding: 0.7rem var(--iris-pad); font-size: 0.95rem;
  }
  .ingested strong { letter-spacing: 0.02em; }
  .ingested .wrap { padding: 0; }
  .ingested a { color: #fff; text-decoration: underline; }
  /* The language row and, on a translated page, where its translation stops. */
  .ingested .langs { margin: 0.45rem 0 0; display: flex; flex-wrap: wrap; gap: 0.25rem 0.9rem; font-size: 0.9rem; }
  .ingested .langs [aria-current] { font-weight: 700; }
  .ingested .langnote { margin: 0.45rem 0 0; font-size: 0.88rem; }

  /* ── Masthead. NO WHO logo, by instruction — a wordmark in type. ────── */
  header.mast { background: var(--iris-paper); border-bottom: 1px solid var(--iris-edge); }
  .mast .wrap { display: flex; align-items: center; gap: 1rem; padding-top: 1.1rem; padding-bottom: 1.1rem; }
  .wordmark { display: flex; align-items: baseline; gap: 0.55rem; }
  .wordmark .org {
    font-size: 1.05rem; font-weight: 700; line-height: 1.15;
    color: var(--iris-link); max-width: 11rem;
  }
  .wordmark .bar { width: 1px; align-self: stretch; background: var(--iris-edge); }
  .wordmark .stack { display: flex; flex-direction: column; }
  .wordmark .iris { font-size: 2.1rem; font-weight: 700; color: var(--iris-link); letter-spacing: -0.02em; line-height: 1; }
  .wordmark .iris .dot { color: var(--iris-current); }
  .wordmark .sub { font-size: 0.78rem; color: var(--iris-link); line-height: 1.2; }
  .none { color: var(--iris-muted); font-style: italic; }
  /* The CDN link is secondary to the one that is known to work. */
  .cdn { font-size: 0.88em; color: var(--iris-cdn); }
  /* TRANSLATED text set in the code face (a size, a container path). Arabic is
     cursive, and a monospace face gives every letter its own cell, so on the ar
     page "ميغابايت" rendered as eight separate letters (bean lffo). There it
     takes the page's face; Latin and CJK keep the code look. */
  code.ui:lang(ar) { font-family: inherit; }
  .nologo {
    margin-inline-start: auto; font-size: 0.78rem; color: var(--iris-muted);
    text-align: end; max-width: 16rem;
  }

  /* ── Navbar. Solid accent, white links, as the source page. ─────────── */
  nav.main { background: var(--iris-accent); }
  nav.main .wrap { display: flex; flex-wrap: wrap; gap: 1.6rem; padding-top: 0.75rem; padding-bottom: 0.75rem; }
  nav.main a, nav.main span { color: #fff; font-weight: 700; font-size: 0.98rem; }
  nav.main span { opacity: 0.75; font-weight: 400; }

  .crumbs { background: var(--iris-breadcrumb-bg); }
  .crumbs .wrap { padding-top: 0.8rem; padding-bottom: 0.8rem; font-size: 0.98rem; }
  .crumbs .sep { color: var(--iris-muted); margin: 0 0.55rem; }
  .crumbs .here { color: var(--iris-current); }

  main.wrap { padding-top: 2rem; padding-bottom: 3rem; }
  h1 { font-size: 2.6rem; font-weight: 500; line-height: 1.2; margin: 0 0 1.6rem; }
  h2 { font-size: 1.85rem; font-weight: 500; line-height: 1.2; margin: 2.4rem 0 0.9rem; }
  h3 { font-size: 1.15rem; font-weight: 600; margin: 1.6rem 0 0.5rem; }

  ul.communities { list-style: none; margin: 0; padding: 0; }
  ul.communities > li { padding: 0.55rem 0; }
  .row { display: flex; align-items: baseline; gap: 0.7rem; }
  .chev { color: var(--iris-ink); font-size: 1.05rem; line-height: 1; }
  .row .title { font-size: 1.32rem; }
  .note { color: var(--iris-muted); font-size: 0.95rem; margin: 0.2rem 0 0; margin-inline-start: 1.9rem; }
  .kids { margin: 0.35rem 0 0.5rem; margin-inline-start: 1.9rem; padding: 0; list-style: none; }
  .kids li { padding: 0.3rem 0; }

  /* ── Materialisation state. A WORD, never a colour alone (SC 1.4.1). ── */
  .state {
    display: inline-block; font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.04em; text-transform: uppercase;
    padding: 0.12rem 0.45rem; border-radius: 3px; border: 1px solid;
    vertical-align: 0.12em;
  }
  .state.materialized { color: var(--iris-mat); border-color: var(--iris-mat-edge); background: var(--iris-mat-bg); }
  .state.referenced   { color: var(--iris-heading); border-color: var(--iris-edge); background: var(--iris-wash); }
  .state.unknown      { color: var(--iris-unk); border-color: var(--iris-unk-edge); background: var(--iris-unk-bg); }
  /* The KG view's tables. Deliberately plainer than the replica's furniture:
     this page is ABOUT the catalogue rather than a mock of IRIS, and dressing
     it as IRIS would invite a reader to take its counts for IRIS's. */
  .kg { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: .95rem; }
  .kg th, .kg td { text-align: start; padding: .4rem .55rem; border-bottom: 1px solid var(--iris-edge); vertical-align: top; }
  .kg th { font-weight: 600; white-space: nowrap; }
  .dim { opacity: .65; font-size: .85em; }

  table.items { width: 100%; border-collapse: collapse; margin-top: 0.8rem; font-size: 0.97rem; }
  table.items th, table.items td {
    text-align: start; padding: 0.7rem 0.6rem; border-bottom: 1px solid var(--iris-edge);
    vertical-align: top;
  }
  table.items th { font-weight: 700; background: var(--iris-wash); }
  /* Six columns on the held-items table; without a floor the title and
     collection cells wrap to one word per line. */
  table.items td:first-child, table.items th:first-child { min-width: 13rem; }
  table.items td:nth-child(2) { min-width: 9rem; }
  table.items code { font-size: 0.86rem; color: var(--iris-muted); }
  /* Wraps at EVERY width (bean on the 2026-09-30 QA re-run): nowrap held the
     "Metadata record" column to its longest file name, so collection pages ran
     1338-1475px wide at 1280 and 1162-1405px at 1024. #1592 fixed this only
     below 640px. A long file name breaks inside the link; the short
     format/size label stays on one line. */
  .dl { white-space: normal; }
  .dl a { overflow-wrap: anywhere; }
  .dl code { white-space: nowrap; }

  /* ── IRIS home replica ────────────────────────────────────────────────
     Bands in the capture's order: hero, search, Recent Submissions. Measured
     against who-iris/uploads/iris-home/iris-capture/IRIS-Home.pdf page 1.

     The hero bleeds to the wrap's edges rather than to the viewport: 100vw
     inside a centred column is the classic horizontal-scrollbar bug, and a
     replica that scrolls sideways on a phone is a worse infidelity than a
     hero 32px narrower than the original. */
  .hero {
    margin: 0 calc(-1 * var(--iris-pad)) 1.6rem;
    padding: 3.2rem var(--iris-pad) 2.4rem;
    /* Colour only. The real hero is a photograph of the Geneva headquarters
       with the WHO emblem on the facade; see landingPage() for why neither is
       here. Both stops are theme roles, not literals. */
    background: linear-gradient(135deg, var(--iris-dark) 0%, var(--iris-accent) 55%, var(--iris-deep) 100%);
    color: #fff;
  }
  .hero-in { max-width: 34rem; }
  .hero h1 { font-size: 3.6rem; line-height: 1; margin: 0 0 1.2rem; color: #fff; font-weight: 400; }
  .hero p { font-size: 1.06rem; line-height: 1.5; margin: 0; color: rgba(255,255,255,0.95); }
  /* Two classes, not one: the rule .hero p is class+element and beat the bare
     .hero-note, so the margin below was declared and never applied -- the
     replica note sat flush against the last line of the hero paragraph and
     read as part of it. */
  .hero .hero-note {
    margin: 1.6rem 0 0; font-size: 0.8rem; color: rgba(255,255,255,0.8);
    border-top: 1px solid rgba(255,255,255,0.25); padding-top: 0.9rem;
  }
  .hero-note code { color: #fff; }

  .searchbar { display: flex; gap: 0; margin: 1.8rem 0 0.5rem; }
  .searchbar input {
    flex: 1; padding: 0.7rem 0.9rem; font-size: 1rem; font-family: inherit;
    border: 1px solid var(--iris-edge); border-inline-end: none;
    border-radius: 0; border-start-start-radius: 4px; border-end-start-radius: 4px;
    background: var(--iris-paper); color: var(--iris-ink);
  }
  .searchbar button {
    padding: 0.7rem 1.4rem; font-size: 1rem; font-family: inherit; font-weight: 600;
    border: 1px solid var(--iris-accent);
    border-radius: 0; border-start-end-radius: 4px; border-end-end-radius: 4px;
    background: var(--iris-accent); color: #fff; cursor: pointer;
  }
  .searchbar button:hover, .searchbar button:focus {
    background: var(--iris-dark);
  }
  .search-results-panel {
    margin: 1rem 0 1.5rem;
    border: 1px solid var(--iris-edge);
    border-radius: 4px;
    background: var(--iris-surface);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    padding: 1rem;
  }
  .search-results-panel h3 {
    margin: 0 0 0.8rem;
    font-size: 1.05rem;
    color: var(--iris-heading);
  }
  .search-results-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .search-result-item {
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--iris-edge);
    border-radius: 4px;
    background: var(--iris-wash);
  }
  .search-result-item a {
    font-weight: 600;
    font-size: 1.02rem;
  }
  .search-result-meta {
    font-size: 0.88rem;
    color: var(--iris-muted);
    margin-top: 0.25rem;
  }
  .search-result-badge {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 0.15rem 0.45rem;
    border-radius: 3px;
    background: var(--iris-accent);
    color: #fff;
    margin-inline-end: 0.5rem;
  }
  .search-remote-box {
    border-top: 1px solid var(--iris-edge);
    padding-top: 0.75rem;
    margin-top: 0.75rem;
    font-size: 0.92rem;
  }
  mark.search-mark {
    background: #ffeb3b;
    color: #212529;
    padding: 0 2px;
    border-radius: 2px;
  }
  .searchnote { font-size: 0.88rem; color: var(--iris-muted); margin: 0.4rem 0 2rem; }
  .ordering { font-size: 0.88rem; color: var(--iris-muted); margin: 0.2rem 0 1.4rem; }

  .subs { display: flex; flex-direction: column; gap: 1.8rem; }
  .sub { display: flex; gap: 1.2rem; align-items: flex-start; }
  /* A fixed column so a landscape cover and a portrait one start on the same
     line. The IMAGE keeps its own aspect -- pixelWidth and pixelHeight are on
     the tag, so the box is reserved before the bytes arrive and nothing
     reflows. */
  .sub-cover { flex: 0 0 104px; }
  .sub-cover img { width: 104px; height: auto; display: block; border: 1px solid var(--iris-edge); }
  /* Centred by FLEX, not by a line-height equal to the height: the withheld
     placeholder is two lines, and a 140px line-height would put the first of
     them below the box. */
  .sub-cover .nocover {
    display: flex; align-items: center; justify-content: center;
    width: 104px; height: 140px; border: 1px dashed var(--iris-edge);
    color: var(--iris-muted); font-size: 0.78rem; text-align: center; line-height: 1.3;
  }
  .sub-body { flex: 1; min-width: 0; }
  .sub-title { font-size: 1.02rem; line-height: 1.35; text-decoration: underline; }
  .sub-by { margin: 0.35rem 0 0.4rem; font-size: 0.9rem; color: var(--iris-ink); }
  .sub-abs {
    margin: 0 0 0.5rem; font-size: 0.93rem; line-height: 1.5;
    /* The capture truncates each abstract under a "Show more" control. This
       clamps instead of shipping a disclosure widget -- the owner asked for a
       replica of the look, not working functionality. */
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .sub-abs.none { display: block; font-style: italic; color: var(--iris-muted); }
  .sub-links { margin: 0; font-size: 0.88rem; }

  p.lede { font-size: 1.05rem; line-height: 1.6; max-width: 46rem; }

  table.reqs { width: 100%; border-collapse: collapse; margin-top: 0.9rem; font-size: 0.95rem; }
  table.reqs th, table.reqs td {
    text-align: start; padding: 0.65rem 0.7rem; border-bottom: 1px solid var(--iris-edge);
    vertical-align: top;
  }
  table.reqs thead th { background: var(--iris-wash); font-weight: 700; }
  table.reqs th.rid {
    width: 3.2rem; white-space: nowrap; font-weight: 700; color: var(--iris-link);
  }
  table.reqs td.why { color: var(--iris-muted); }
  table.reqs code { font-size: 0.87em; }
  table.reqs td .why { font-size: 0.88em; color: var(--iris-muted); }

  /* The architecture drawing, inlined. Authored at 1000x432 and scaled down on
     a narrow screen: an auto height keeps its aspect, which a figure of
     labelled boxes cannot survive losing.
     NOTE FOR ANYONE EDITING THESE COMMENTS: this whole stylesheet is inside a
     JS template literal, so a backtick here ends the string and the generator
     stops parsing. It has happened four times. Write CSS identifiers plainly. */
  figure.arch { margin: 1.6rem 0; }
  figure.arch svg { width: 100%; height: auto; max-width: 1000px; display: block; border: 1px solid var(--iris-edge); border-radius: 6px; }
  figure.arch figcaption { font-size: 0.88rem; color: var(--iris-muted); margin-top: 0.6rem; }

  .caveat {
    border-inline-start: 4px solid var(--iris-current); background: var(--iris-wash);
    padding: 0.9rem 1.1rem; margin: 1.6rem 0; font-size: 0.95rem;
  }
  .caveat p { margin: 0.4rem 0; }
  .caveat p:first-child { margin-top: 0; }
  .caveat p:last-child { margin-bottom: 0; }

  footer.mast { background: var(--iris-accent); color: #fff; margin-top: 3rem; }
  footer.mast .wrap { padding-top: 1.8rem; padding-bottom: 1.8rem; font-size: 0.93rem; }
  footer.mast a { color: #fff; text-decoration: underline; }
  footer.mast .rule { height: 1px; background: rgba(255,255,255,0.35); margin: 1rem 0; }

  @media (max-width: 640px) {
    h1 { font-size: 1.9rem; }
    /* .none and .cdn are defined above and were duplicated in here; the
       copies said nothing the base rules did not. A .nologo display:none was
       in here too, which HID the "replica, not published under WHO" notice on
       exactly the screens where a reader is least able to tell a replica from
       the real site. It shrinks now; it does not disappear. */
    .nologo { font-size: 0.72rem; max-width: none; }
    .wordmark .iris { font-size: 1.7rem; }
    table.items, table.items tbody, table.items tr, table.items td { display: block; width: 100%; }
    table.items thead { display: none; }
    table.items td { border-bottom: none; padding: 0.25rem 0; }
    /* The download-cell wrap that g9r2 put here (537 px wide at 390) now
       applies at every width, in the \`.dl\` rule above: desktop overflowed
       the same way, one column wider. */
    table.items tr { border-bottom: 1px solid var(--iris-edge); padding: 0.7rem 0; }
    table.reqs, table.reqs tbody, table.reqs tr, table.reqs td, table.reqs th { display: block; width: auto; }
    table.reqs thead { display: none; }
    table.reqs td, table.reqs th.rid { border-bottom: none; padding: 0.2rem 0; }
    table.reqs tr { border-bottom: 1px solid var(--iris-edge); padding: 0.7rem 0; }
    .hero h1 { font-size: 2.6rem; }
    .searchbar { flex-direction: column; }
    .searchbar input { border-inline-end: 1px solid var(--iris-edge); border-radius: 4px 4px 0 0; }
    .searchbar button { border-radius: 0 0 4px 4px; }
    .sub { flex-direction: column; }
  }
</style>
</head>
<body>
${side === "site" ? replicaNav() : ""}
<div class="ingested"><div class="wrap">
  ${t("<strong>INGESTED COPY — not WHO, and not live.</strong> This page is rendered by {folioAssistant} from its own catalogue of {iris}, modelled <em>by reference</em>: {figures}. The WHO logo is deliberately omitted, and the rendered covers are withheld from display for the same reason — they carry the emblem printed on the publications.", {
    folioAssistant: `<a href="https://github.com/litlfred/folio-assistant">folio-assistant</a>`,
    iris: `<a href="https://iris.who.int/">WHO IRIS</a>`,
    figures: banner(),
  })}${file === undefined ? "" : localeBar(file)}
</div></div>

<header class="mast"><div class="wrap">
  <div class="wordmark">
    <span class="org">${t("World Health<br>Organization")}</span>
    <span class="bar"></span>
    <span class="stack">
      <span class="iris">iris<span class="dot">.</span></span>
      <span class="sub">${t("Institutional Repository<br>for Information Sharing")}</span>
    </span>
  </div>
  <div class="nologo">${t("Logo omitted, covers withheld — replica, not published under WHO")}</div>
</div></header>

<!--
  THE DOCUMENTATION IS NOT IN THIS NAVBAR, and that is the owner's ruling of
  2026-09-21: *"the docs/ should not be for the who-iris top navbar, instead,
  f-a navbar should still be on the left, with who-iris and then link to docs
  on side in navbar."*

  This strip is the REPLICA's chrome -- it exists to look like the IRIS site,
  and the IRIS site has no page about how this repository ingested it. The
  ingestion notes and the portal proposal are reached from the folio-assistant
  navbar on the left, through who-iris's own tile in harness-tiles.ts, which
  is where a reader looking for documentation about this harness is standing.
  Putting them here also meant linking across two mount points once the split
  landed, which is a relative path that breaks the first time either route
  moves.

  (No backticks in this comment: it sits inside the page template literal, and
  one here closes the string and turns the rest of the file into TypeScript,
  failing at a line far from the mistake.)
-->
<nav class="main"><div class="wrap">
  ${side === "site"
    ? `<a href="${esc(cataloguePageHref())}">${t("Communities &amp; Collections")}</a>`
    : `<span>${t("Communities &amp; Collections")}</span>`}
  <span>${t("Browse IRIS")}</span><span>${t("Statistics")}</span><span>${t("About")}</span><span>${t("Contact")}</span><span>${t("Help")}</span>
</div></nav>

<div class="crumbs"><div class="wrap">${crumbHtml}</div></div>

<main class="wrap">
${body}
</main>

<footer class="mast"><div class="wrap">
  <p>${t("<strong>Ingested replica.</strong> Rendered from {catalogue} by {generator}. Layout after {iris}; every figure on this page is read out of the catalogue, not copied from a screenshot.", {
    catalogue: "<code dir=\"ltr\">who-iris/catalogue/</code>",
    generator: "<code dir=\"ltr\">who-iris/scripts/gen-iris-pages.ts</code>",
    iris: `<a href="https://iris.who.int/community-list">iris.who.int</a>`,
  })}</p>
  <div class="rule"></div>
  <p>${t("Source of record: {iris} — © WHO. This copy asserts no endorsement and carries no WHO mark.", {
    iris: `<a href="https://iris.who.int/">iris.who.int</a>`,
  })}</p>
</div></footer>
${FOLIO_MOUNT}
</body>
</html>
`;
}

function stateBadge(state: string): string {
  // The three states are a closed vocabulary the generator itself emits, so
  // their WORDS are interface and are translated; the class keeps the value,
  // so the colour does not depend on the language. A state outside the three
  // is the catalogue's data and is shown as written.
  const word = state === "materialized" || state === "referenced" || state === "unknown" ? t(state) : esc(state);
  return `<span class="state ${esc(state)}">${word}</span>`;
}

/**
 * The catalogue as a GRAPH — what it knows, and what it says it does not.
 *
 * ## Why this is not `community-list.html` under another name
 *
 * The replica pages answer *"what does IRIS look like?"*. They are a faithful
 * mock and they are supposed to look finished. This page answers a different
 * question — *"what does this catalogue actually know?"* — and the difference
 * is not presentational:
 *
 * - the replica shows three items; this shows that all six of their bitstreams
 *   carry `copyright: unknown` and `restrictions: unknown`;
 * - the replica shows a community; this shows that community is `referenced`,
 *   meaning nothing of it is held here;
 * - the replica cannot show a gap at all, because a gap has no page.
 *
 * `who-iris/AGENTS.md` states the point this page exists to render: *"the gap
 * between twelve modelled nodes and a million upstream files is the POINT
 * rather than a backlog"*. Nothing rendered it until now, so the one fact the
 * instance is built around was the one fact no reader could see.
 *
 * ## Every count here is derived
 *
 * Including the one in the sentence above — that prose says twelve and the
 * corpus holds thirteen, which is exactly why `bpmn-processes`' rule ("count
 * the directory rather than quoting a number from this paragraph") is general.
 * Nothing on this page is transcribed.
 */
/**
 * A gate VERDICT, wearing the state palette but never a state's word.
 *
 * The first version of this reused `stateBadge` and mapped `permitted` to
 * `materialized` to borrow the green. That rendered a `retention` gate as the
 * word **materialized**, which is false: a verdict says whether a question was
 * answered and how, a state says whether bytes are here. Reusing the badge
 * meant reusing its vocabulary, and the reader would have had no way to tell
 * that the word in the cell was not the word in the data.
 *
 * Borrowing the COLOURS is fine and deliberate — green for a determined
 * permit, amber for unknown, so the two axes read consistently at a glance —
 * but the text is the verdict as recorded.
 */
function verdictBadge(verdict: string, count?: { n: number; of: number }): string {
  const tone = verdict === "unknown" ? "unknown" : verdict === "permitted" ? "materialized" : "referenced";
  // The count goes INSIDE its pill and says what it counts (bean `kx0p`
  // finding 6): beside the pill as a bare number, "PERMITTED 3 UNKNOWN 3" read
  // as one run rather than two verdicts with a count each.
  const label = count === undefined ? esc(verdict) : `${esc(verdict)}: ${count.n} of ${count.of}`;
  return `<span class="state ${tone}">${label}</span>`;
}

/** What the catalogue page may link, which depends on the site it is built into. */
export interface CatalogueViewerOptions {
  /**
   * The site builds the library viewer, so a "held as" id may open it. False
   * on who-iris's own site (`--catalogue-into`), which builds no viewer: the
   * link would be published dead, and the build's link check refuses that.
   */
  libraryViewer: boolean;
}

/**
 * A "held as" library id, linked the way every library reference is (bean
 * `qgjh`, `lib/library-links.ts`): the library viewer opened on the item, the
 * item's page and its source, each only where it resolves. The viewer link is
 * made relative to this page. An id nothing resolves stays code.
 */
function heldAs(id: string, opts: CatalogueViewerOptions): string {
  const code = `<code>${esc(id)}</code>`;
  const l = HELD_ITEM_LINKS(id) ?? LIBRARY_LINKS.links(id, SUBJECT);
  if (l === undefined) return code;
  const from = CATALOGUE_ROUTE;
  const viewer = l.viewer;
  const parts = [viewer === undefined || !opts.libraryViewer ? code : (() => {
    const [path, hash] = viewer.split("#");
    return `<a href="${esc(`${posix.relative(from, path!)}/#${hash}`)}">${code}</a>`;
  })()];
  if (l.readme !== undefined) parts.push(`<a href="${esc(l.readme)}">item page</a>`);
  if (l.source !== undefined) parts.push(`<a href="${esc(l.source)}">source</a>`);
  return parts.join(" &middot; ");
}

/** Materialized first, then referenced, then unknown — bean `kx0p` finding 4. */
const STATE_ORDER = ["materialized", "referenced", "unknown"];

/**
 * The "Every node" columns, each with the row attribute it sorts by (bean
 * `kx0p` finding 4: the list could be neither filtered nor sorted). `rank` is
 * the held-first order the rows are written in, so the page opens sorted by it.
 */
const NODE_COLUMNS: { key: string; label: string; numeric?: boolean }[] = [
  { key: "rank", label: "state", numeric: true },
  { key: "kind", label: "kind" },
  { key: "node", label: "node" },
  { key: "held", label: "held as", numeric: true },
  { key: "record", label: "record", numeric: true },
  { key: "bitstreams", label: "bitstreams", numeric: true },
];

/**
 * Filter by state and by title or id, and sort by any column (bean `kx0p`).
 * The controls are hidden until this runs, so a reader without scripts sees
 * the table as it was, in held-first order, and no control that does nothing.
 * No backticks in the script body, and no dollar-brace but the one that inlines
 * which columns sort as numbers.
 */
const CATALOGUE_TABLE_SCRIPT = `<script>
(function () {
  var table = document.getElementById("ic-node-table");
  var bar = document.getElementById("ic-filter");
  if (!table || !bar) return;
  var body = table.tBodies[0];
  var numeric = ${JSON.stringify(Object.fromEntries(NODE_COLUMNS.map((c) => [c.key, !!c.numeric])))};
  var state = document.getElementById("ic-filter-state");
  var q = document.getElementById("ic-filter-q");
  var shown = document.getElementById("ic-shown");
  function filter() {
    var s = state.value, t = q.value.trim().toLowerCase(), n = 0;
    Array.prototype.forEach.call(body.rows, function (r) {
      var ok = (!s || r.dataset.state === s) && (!t || r.dataset.node.indexOf(t) >= 0);
      r.hidden = !ok; if (ok) n++;
    });
    shown.textContent = String(n);
  }
  function sortBy(btn) {
    var key = btn.dataset.key, th = btn.parentNode;
    var dir = th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
    Array.prototype.forEach.call(table.tHead.rows[0].cells, function (c) { c.removeAttribute("aria-sort"); });
    th.setAttribute("aria-sort", dir);
    var rows = Array.prototype.slice.call(body.rows).map(function (r, i) { return { r: r, i: i }; });
    rows.sort(function (a, b) {
      var x = a.r.dataset[key], y = b.r.dataset[key];
      var c = numeric[key] ? Number(x) - Number(y) : x.localeCompare(y, "en", { numeric: true });
      return (dir === "ascending" ? c : -c) || a.i - b.i;
    });
    rows.forEach(function (o) { body.appendChild(o.r); });
  }
  state.addEventListener("change", filter);
  q.addEventListener("input", filter);
  Array.prototype.forEach.call(table.querySelectorAll("button.ic-sort"), function (b) {
    b.addEventListener("click", function () { sortBy(b); });
  });
  bar.hidden = false;
})();
</script>`;

function cataloguePage(all: Node[], opts: CatalogueViewerOptions): string {
  const c = catalogue();
  const byState = (s: string): Node[] => all.filter((n) => (n.materialization?.state ?? "unknown") === s);
  const materialized = byState("materialized");
  const referenced = byState("referenced");
  const unknownState = byState("unknown");

  // Gate verdicts across every bitstream of every node. Counted rather than
  // sampled: a page that showed one item's gates would invite the reader to
  // generalise from it, and the interesting fact here is a UNIVERSAL one.
  const verdicts = new Map<string, Map<string, number>>();
  let bitstreams = 0;
  for (const n of all) {
    for (const b of n.bitstreams ?? []) {
      bitstreams++;
      for (const [gate, v] of Object.entries(b.materialization?.gates ?? {})) {
        const verdict = (v as { verdict?: string }).verdict ?? "unknown";
        const m = verdicts.get(gate) ?? new Map<string, number>();
        m.set(verdict, (m.get(verdict) ?? 0) + 1);
        verdicts.set(gate, m);
      }
    }
  }
  const unknownGates = [...verdicts.entries()].filter(([, m]) => (m.get("unknown") ?? 0) > 0);

  const gateRows = [...verdicts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "en"))
    .map(([gate, m]) => {
      const cells = [...m.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "en"))
        .map(([v, n]) => verdictBadge(v, { n, of: [...m.values()].reduce((a, b) => a + b, 0) }))
        .join(" ");
      return `<tr><td><code>${esc(gate)}</code></td><td>${cells}</td></tr>`;
    })
    .join("\n");

  // The held rows FIRST (bean `kx0p` finding 4): in the order nodes are read,
  // the ten referenced rows came first and the first held item sat about two
  // screens down. A stable sort, so each group keeps the order it had.
  const rank = (n: Node): number => {
    const i = STATE_ORDER.indexOf(n.materialization?.state ?? "unknown");
    return i < 0 ? STATE_ORDER.length : i;
  };
  const nodeRows = all
    .map((n, i) => ({ n, i }))
    .sort((a, b) => rank(a.n) - rank(b.n) || a.i - b.i)
    .map(({ n }) => {
      const state = n.materialization?.state ?? "unknown";
      const held = n.libraryId ? heldAs(n.libraryId, opts) : "—";
      const rec = n.metadataRef ? "yes" : "—";
      const bs = (n.bitstreams ?? []).length;
      const kind = n.flavour ?? n.kind ?? "?";
      // What the filter and the sort read (bean `kx0p` finding 4): the cells
      // carry markup, so the values a reader filters and sorts by ride on the row.
      return `<tr data-state="${esc(state)}" data-rank="${rank(n)}" data-kind="${esc(kind)}" data-node="${esc(`${n.title} ${n.id}`.toLowerCase())}" data-held="${n.libraryId ? 1 : 0}" data-record="${n.metadataRef ? 1 : 0}" data-bitstreams="${bs}">
  <td>${stateBadge(state)}</td>
  <td><code>${esc(kind)}</code></td>
  <td>${titleCell(n)}<br><code class="dim">${esc(n.id)}</code></td>
  <td>${held}</td>
  <td>${rec}</td>
  <td>${bs || "—"}</td>
</tr>`;
    })
    .join("\n");

  const files = c.totalFilesUpstream;
  const items = c.totalItemsUpstream;

  return `<div class="ic-page">
<h1 id="ic-title">The catalogue, as a graph</h1>

<p class="lede">The replica pages show what IRIS looks like. This one shows what this
catalogue <em>knows</em> — and, more usefully, what it records that it does not know.</p>

<div class="note">
<p><strong>The gap is the point, not a backlog.</strong> This instance models
<strong>${all.length}</strong> node(s)${
    items !== undefined ? ` against <strong>${items.toLocaleString("en")}</strong> items` : ""
  }${files !== undefined ? ` across <strong>${files.toLocaleString("en")}</strong> files` : ""} upstream.
Cataloguing by reference means recording that something exists without holding it,
so a small number here is the design rather than a shortfall.</p>
</div>

<h2 id="ic-held">What is held, and what is only named</h2>

<table class="kg">
<tr><th>state</th><th>nodes</th><th>what it means</th></tr>
<tr><td>${stateBadge("materialized")}</td><td>${materialized.length}</td><td>the bytes are in this repository</td></tr>
<tr><td>${stateBadge("referenced")}</td><td>${referenced.length}</td><td>upstream, not here — a fact, not a gap</td></tr>
<tr><td>${stateBadge("unknown")}</td><td>${unknownState.length}</td><td>nobody has looked; never rendered as either of the above</td></tr>
</table>

<h2 id="ic-gates">What the gates say about the ${bitstreams} held bitstream(s)</h2>

${
  unknownGates.length > 0
    ? `<p><strong>Not everything permitted is everything known.</strong> ${unknownGates
        .map(([g, m]) => `<code>${esc(g)}</code> is unknown on ${m.get("unknown")}`)
        .join(", ")} of them. A gate that returned <em>unknown</em> is a question
nobody has answered — which is a different state from a gate that was asked and
said yes, and collapsing the two would turn an open question into a clearance.</p>`
    : `<p>Every gate on every held bitstream returned a determined verdict. Stated
rather than left implicit: an absent warning and a clean result are not the same claim.</p>`
}

<table class="kg">
<tr><th>gate</th><th>verdicts</th></tr>
${gateRows}
</table>

<h2 id="ic-nodes">Every node</h2>

<p class="ic-filter" id="ic-filter" hidden>
<label>State <select id="ic-filter-state"><option value="">every state</option>${STATE_ORDER.map((st) => `<option value="${st}">${st}</option>`).join("")}</select></label>
<label>Find <input id="ic-filter-q" type="search" placeholder="title or id" autocomplete="off"></label>
<span class="dim" role="status"><span id="ic-shown">${all.length}</span> of ${all.length} shown</span>
</p>

<table class="kg" id="ic-node-table">
<thead><tr>${NODE_COLUMNS.map((c) => `<th${c.key === "rank" ? ' aria-sort="ascending"' : ""}><button type="button" class="ic-sort" data-key="${c.key}">${c.label}</button></th>`).join("")}</tr></thead>
<tbody>
${nodeRows}
</tbody>
</table>
${CATALOGUE_TABLE_SCRIPT}

<p class="caveat">Generated from <code>catalogue/</code> by
<code>who-iris/scripts/gen-iris-pages.ts</code>. Every count above is derived from the
nodes themselves; none is transcribed. <code>bun run cat check:catalogue</code> separately
verifies that each node validates and that every <code>metadataRef</code>,
<code>libraryId</code>, <code>localPath</code> and parent path resolves — so this page
reports what the catalogue says, and that check reports whether it hangs together.</p>
</div>`;
}

/**
 * The catalogue viewer as a THEMED Jekyll page (2026-10-07).
 *
 * It is cat-harness's own view of this catalogue, published on cat-harness's
 * site — not the replica — so it wears the SITE's chrome rather than IRIS's:
 * on the theme's default layout it carries the top band (search, Folio,
 * language) that only that layout delivers, and the theme's sidebar is its
 * navigation, so there is no rail. Every rule is scoped under .ic-page, with
 * no rule on body, :root or a (on the layout those would restyle the theme).
 * The state palette keeps its three tones and its WORDS, keyed on the site's
 * own scheme switch (data-fa-scheme), dark first because the site's ground is;
 * the light tones are the replica's measured ones. Everything else is the
 * theme's ink with opacity and a neutral translucent edge.
 *
 * NO BACKTICKS IN THE STYLESHEET BELOW: it is a template literal.
 */
export function catalogueViewer(all: Node[], opts: CatalogueViewerOptions = { libraryViewer: true }): string {
  return themedPage({
    title: "The catalogue, as a graph — who-iris",
    generator: "who-iris/scripts/gen-iris-pages.ts",
    command: "bun run iris:pages",
    body: `<style>
.ic-page { --ic-edge: rgba(127,127,127,.4); --ic-wash: rgba(127,127,127,.12);
  --ic-mat: #8fd18f; --ic-mat-edge: #4d7a2a; --ic-mat-bg: rgba(148,186,101,.16);
  --ic-ref: currentColor; --ic-ref-edge: rgba(127,127,127,.55); --ic-ref-bg: rgba(127,127,127,.12);
  --ic-unk: #f0c27a; --ic-unk-edge: #8a6420; --ic-unk-bg: rgba(236,148,51,.16);
  --ic-current: #e8875a; }
:root[data-fa-scheme="light"] .ic-page {
  --ic-mat: #1d5c1d; --ic-mat-edge: #94BA65; --ic-mat-bg: #f0f6e9;
  --ic-ref: #005072; --ic-ref-edge: #ced4da; --ic-ref-bg: #FAFAFA;
  --ic-unk: #7a4a10; --ic-unk-edge: #ec9433; --ic-unk-bg: #fdf4e8;
  --ic-current: #d86422; }
.ic-page :not(pre) > code { overflow-wrap: anywhere; }
.ic-page p.lede { font-size: 1.05rem; line-height: 1.6; max-width: 46rem; }
.ic-page .note { border-inline-start: 4px solid var(--ic-edge); background: var(--ic-wash);
  padding: .6rem 1rem; margin: 1rem 0; }
.ic-page .note p { margin: 0; }
.ic-page .state { display: inline-block; font-size: .72rem; font-weight: 700;
  letter-spacing: .04em; text-transform: uppercase;
  padding: .12rem .45rem; border-radius: 3px; border: 1px solid; vertical-align: .12em; }
.ic-page .state.materialized { color: var(--ic-mat); border-color: var(--ic-mat-edge); background: var(--ic-mat-bg); }
.ic-page .state.referenced { color: var(--ic-ref); border-color: var(--ic-ref-edge); background: var(--ic-ref-bg); }
.ic-page .state.unknown { color: var(--ic-unk); border-color: var(--ic-unk-edge); background: var(--ic-unk-bg); }
.ic-page .kg { display: table; width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: .95rem; }
.ic-page .kg th, .ic-page .kg td { text-align: start; padding: .4rem .55rem; border: 0;
  border-bottom: 1px solid var(--ic-edge); vertical-align: top; background: transparent; }
.ic-page .kg th { font-weight: 600; white-space: nowrap; }
.ic-page .dim { opacity: .9; font-size: .85em; }
.ic-page .ic-filter { display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: center; margin: .5rem 0 0; }
.ic-page .ic-filter select, .ic-page .ic-filter input { font: inherit; margin-inline-start: .3rem; }
.ic-page button.ic-sort { font: inherit; font-weight: 600; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.ic-page th[aria-sort="ascending"] button.ic-sort::after { content: " \\25B2"; font-size: .7em; }
.ic-page th[aria-sort="descending"] button.ic-sort::after { content: " \\25BC"; font-size: .7em; }
.ic-page .caveat { border-inline-start: 4px solid var(--ic-current); background: var(--ic-wash);
  padding: .9rem 1.1rem; margin: 1.6rem 0; font-size: .95rem; }
</style>
${cataloguePage(all, opts)}`,
  });
}

/**
 * The replica's own page tree, for the harness rail's section (owner,
 * 2026-10-15: the rail on who-iris's site showed no contents, only the
 * Graphs and Harnesses groups). These pages are mounted as finished HTML, so
 * no Jekyll sidebar lists them, and their headings carry no ids for the rail
 * to index; the page itself has to say what the replica holds.
 *
 * The format is the platform's visualiser-nav declaration (cat-harness-tools
 * `lib/navbar.ts`: `visualiserNavDeclaration` writes it, `visualiserNavOf`
 * reads it at mount time). Written here rather than imported because this
 * checkout resolves cat-harness-tools only through folio-assistant-core's
 * facade, which does not re-export it. Every page of one locale sits in the
 * same directory, so each href is a bare file name.
 */
let REPLICA_NAV_ALL: Node[] = [];
function replicaNav(): string {
  const all = REPLICA_NAV_ALL;
  const entries: { label: string; href?: string; items?: { label: string; href?: string }[] }[] = [
    { label: t("Home"), href: "index.html" },
    { label: t("Search"), href: "search.html" },
    { label: t("Community List"), href: cataloguePageHref() },
  ];
  // The held items, each to its library entry page: since 2026-10-30 that is
  // the item's one page (owner), and the replica keeps only its home page.
  // Held items only: an item catalogued by reference has a page too, but
  // listing 17k of them in every page's rail would swamp it.
  for (const n of all.filter((x) => x.flavour === "item" && x.libraryId)) {
    const href = itemPageHref(n);
    if (href !== undefined) entries.push({ label: n.title, href });
  }
  return `<script type="application/json" data-fa-visualiser-nav>${JSON.stringify(entries).replace(/</g, "\\u003c")}</script>\n`;
}

/**
 * The catalogue page's way to the replica, relative (bean `qgjh`).
 *
 * The replica is the INSTANCE ROOT, and since bean `2b5s` that is the only
 * route it answers at: `site/` shares the `docs` kind with `docs/`, and
 * `withRoutes` gives the kind route to the sibling that is not the instance
 * root. It used to link the kind route `library/who-iris`, which is now a
 * redirect to the library viewer — a link that would land on a different page
 * from the one it names. So the route is ASKED of `withRoutes`, fed from the
 * declaration, rather than spelled: the declaration says which directory is
 * the root, and `withRoutes` says where that puts it. Relative, so it holds
 * under the bare site, the project baseurl and a staging preview alike.
 */
const LIBRARY_LINKS = libraryResolver(repoRootFor(HARNESS_ROOT), HARNESS_ROOT);

/**
 * The library listing for this instance, and one entry's page under it,
 * relative to the site root (`<locale>/<harness>/<library>/<instance>/` and
 * `.../<id>/`, the routes `gen-library-viz` publishes). `undefined` when the
 * platform declares no library directory. Since 2026-10-30 an entry's page is
 * a held item's one page (owner): the catalogue and the replica's home link
 * there.
 */
const LIBRARY_LISTING_ROUTE = ((): string | undefined => {
  const decl = readDeclaration(HARNESS_ROOT);
  // A top-level `library` entry, or (cat-harness#1032) the named sub-graph
  // whose `graph.json` declares the corpus FROM WITHIN: the viewer publishes
  // under the top-level directory's name either way (gen-library-viz `topOf`).
  const holdsCorpus = (d: { path: string }): boolean => {
    const f = join(HARNESS_ROOT, d.path, "graph.json");
    if (!existsSync(f)) return false;
    try {
      const nested = JSON.parse(readFileSync(f, "utf-8")) as { directories?: Array<{ graphTypologies?: string[] }> };
      return (nested.directories ?? []).some((n) => (n.graphTypologies ?? []).includes("library"));
    } catch {
      return false;
    }
  };
  const lib =
    decl?.directories?.find((d) => (d.graphTypologies ?? []).includes("library")) ??
    decl?.directories?.find((d) => holdsCorpus(d));
  if (decl?.name === undefined || lib === undefined) return undefined;
  return visualiserRoute({ locale: "en", harness: decl.name, visualiser: basename(lib.path.replace(/\/+$/, "")), subgraph: SUBJECT });
})();

/**
 * The library viewer's page for an item this instance holds, at the route the
 * platform DECLARES for it — `<locale>/<harness>/<library>/<instance>/#<instance>/<id>`,
 * the same href `LIBRARY_LINKS` gives when the page is on disk.
 *
 * Needed because the catalogue page is COMMITTED (move M1) while the viewer is
 * built at publish: `LIBRARY_LINKS` links the viewer only where its page is on
 * disk, so a committed page drawn from it would depend on whether the
 * checkout happened to hold a built site — current in one composition and
 * stale in the next, under the same `iris:pages:check`. The site that
 * publishes this page builds the viewer, so the declared route is where the
 * link lands. The locale is the page's own: the catalogue page is English.
 * `undefined` when the platform declares no library directory.
 */
const DECLARED_LIBRARY_VIEWER = ((): ((id: string) => string | undefined) => {
  if (LIBRARY_LISTING_ROUTE === undefined) return () => undefined;
  return (id) => `${LIBRARY_LISTING_ROUTE}/#${encodeURIComponent(`${SUBJECT}/${id}`)}`;
})();

/**
 * The links of an item this instance's own library holds (`<library>/<id>/`),
 * read from who-iris's committed tree and declaration only: the viewer at its
 * declared route ({@link DECLARED_LIBRARY_VIEWER}) and the item's README in
 * this repository. `undefined` for an id the library does not hold.
 *
 * Not `LIBRARY_LINKS`, because the catalogue page is COMMITTED (move M1) and
 * what that resolver returns depends on the composition it runs in: the
 * library projection and viewer page are built at publish (`derive:publish`),
 * and the README resolves only where the checkout root holds who-iris as a
 * subdirectory. The same commit was drawn three ways (no links; viewer only;
 * viewer and item page) and `iris:pages:check` could not pass in all of them.
 * The resolver's `source` (an arXiv or DOI id from the item's manifest) is
 * not drawn here: no item this instance holds carries one.
 */
const HELD_ITEM_LINKS = ((): ((id: string) => { viewer?: string; readme?: string } | undefined) => {
  const dirs = (readDeclaration(INSTANCE)?.directories ?? [])
    .filter((d) => (d.graphTypologies ?? []).includes("library"))
    .map((d) => d.path.replace(/\/+$/, ""));
  return (id) => {
    if (id === "" || id.includes("/")) return undefined;
    const dir = dirs.find((d) => statSync(join(INSTANCE, d, id), { throwIfNoEntry: false })?.isDirectory() === true);
    if (dir === undefined) return undefined;
    const readme = `${dir}/${id}/README.md`;
    return {
      viewer: DECLARED_LIBRARY_VIEWER(id),
      readme: REPOSITORY && existsSync(join(INSTANCE, readme)) ? `https://github.com/${REPOSITORY}/blob/main/${readme}` : undefined,
    };
  };
})();

/** The replica's route from the site root (no slashes), as `withRoutes` gives it. */
const REPLICA_ROUTE = (() => {
  const declared = (readDeclaration(INSTANCE)?.directories ?? []).flatMap((d) =>
    (d.graphTypologies ?? []).map((kind) => ({ name: SUBJECT, kind, dir: d.path, instanceRoot: (d as { instanceRoot?: boolean }).instanceRoot === true })),
  );
  const { candidates } = withRoutes(declared);
  const root = candidates.find((c) => c.instanceRoot && c.route === SUBJECT);
  if (root === undefined) {
    throw new Error(
      "who-iris.json marks no directory `instanceRoot`, so the replica has no route for the " +
        "catalogue page to link. Mark the replica's directory, or this link is a guess.",
    );
  }
  return root.route;
})();

function libraryEntryRoute(n: Node): string | undefined {
  if (LIBRARY_LISTING_ROUTE === undefined || n.flavour !== "item") return undefined;
  const id = n.libraryId;
  if (id) return HELD_ITEM_LINKS(id) ? `${LIBRARY_LISTING_ROUTE}${encodeURIComponent(id)}/` : undefined;
  return catalogued(n);
}
/**
 * The library entry page of an item catalogued BY REFERENCE — owner,
 * 2026-11-10: its link goes to *"our ingested record in linbrary and
 * associated KG"*, not IRIS (card Q-IRIS-5 = A). The library publishes one
 * page per `referenced` item whose Dublin Core record resolves, named by the
 * record's stem (cat-harness-tools `referencedCatalogueEntries`).
 */
function catalogued(n: Node): string | undefined {
  const ref = n.metadataRef;
  if (n.materialization.state !== "referenced" || !ref || !ref.endsWith(".dc.json") || ref.includes("..")) return undefined;
  if (!existsSync(join(INSTANCE, ref))) return undefined;
  return `${LIBRARY_LISTING_ROUTE}${encodeURIComponent(basename(ref).slice(0, -".dc.json".length))}/`;
}
/** A catalogue row's title: a held item links to its library entry page; anything else is plain text. */
function titleCell(n: Node): string {
  const to = libraryEntryRoute(n);
  return to === undefined ? esc(n.title) : `<a href="${esc(`${posix.relative(CATALOGUE_ROUTE, to)}/`)}">${esc(n.title)}</a>`;
}
/**
 * From a replica page (the home page, in English at the replica's route or in
 * a translation one level below it) up to the site root. Read off `LOCALE`,
 * the language the page is being rendered in.
 */
function replicaUp(): string {
  return "../".repeat(REPLICA_ROUTE.split("/").length + (LOCALE === "en" ? 0 : 1));
}
/** A held item's library entry page, from a replica page; `undefined` for an item with none. */
function itemPageHref(n: Node): string | undefined {
  const to = libraryEntryRoute(n);
  return to === undefined ? undefined : `${replicaUp()}${to}`;
}
/** The catalogue page, from a replica page: where its communities and collections now go. */
function cataloguePageHref(): string {
  return `${replicaUp()}${CATALOGUE_ROUTE}/`;
}
/**
 * Where an item's title and cover go: its library entry page. A held item
 * has one, and since 2026-11-10 so does an item catalogued by reference
 * ({@link catalogued}; owner: *"i dont wnat this this link to go to iris"*).
 * An item with neither goes to its own record upstream at WHO IRIS; it used
 * to go to the catalogue page, which lists every node and says nothing more
 * about this one. The catalogue page is left only
 * for an item that records no upstream address at all.
 */
function itemHref(n: Node): string {
  return itemPageHref(n) ?? sourceOf(n) ?? cataloguePageHref();
}


/**
 * The item's upstream URI, or undefined when it has none.
 *
 * **Undefined is the common case and it must survive to the page.** Two of the
 * three held items record no IRIS handle at all — they were ingested from a
 * PDF somebody had, not resolved from IRIS — and an earlier version of this
 * function fell back to `https://iris.who.int/`, so every row rendered a
 * confident "IRIS source →" and one third of them went to the front page. A
 * link that resolves is not the same as a link that is true.
 *
 * ## It no longer guesses from the scheme
 *
 * This asked `of?.startsWith("http")`, because `of` held upstream URIs and
 * local references in one field and the scheme was the only thing telling them
 * apart. That proxy worked by luck: a local reference that happened to be an
 * `http` URL would have rendered as an IRIS source, and an upstream one under
 * any other scheme would have vanished. `provenance.upstream` answers the
 * question the function is actually asking, so the heuristic is gone.
 */
function sourceOf(n: Node): string | undefined {
  // Bean `08u4`: the Handle IRI first (it outlives the host), the host URL
  // second, never the front page — one definition, in the schema.
  return resolvableIri(n);
}

/**
 * The Dublin Core record as something a reader can actually download.
 *
 * Owner: *"link to emtada record i can download?"* It was printed as a code
 * path, which tells a reader where it is and makes them go and find it.
 *
 * All three held items DO carry one — checked, not assumed; an earlier note
 * here claimed only one did, from reading a truncated dump. The branch that
 * says "none captured" is still live because `metadataRef` is optional in the
 * schema and an item ingested without a captured DSpace record is the ordinary
 * case upstream; it just is not the case for these three.
 */
/**
 * The Dublin Core record behind a node, where one was captured.
 *
 * Read rather than summarised into the node. The catalogue node says what
 * EXISTS and where; the record says what the source SAYS about it, and R8 is
 * the rule that those two never get merged — the moment a title lives in both,
 * one of them is a copy that can drift from the capture it was transcribed
 * from.
 */
function record(n: Node): { fields: { schema: string; element: string; qualifier?: string; values: { value: string; language?: string }[] }[] } | undefined {
  if (!n.metadataRef) return undefined;
  const abs = join(INSTANCE, n.metadataRef);
  if (!existsSync(abs)) return undefined;
  const raw = JSON.parse(readFileSync(abs, "utf-8"));
  for (const k of Object.keys(raw)) if (k.startsWith("_")) delete raw[k];
  return raw;
}

/**
 * Every value of one qualified field, IN ORDER and never deduplicated.
 *
 * R2 and R3 in one function. `dc.identifier.uri` appears twice in the WPRO
 * record — the global Handle and a regional host that was merged away — and
 * `dc.date.accessioned` twice for the same reason. A reader that returned the
 * first, or a unique set, would be discarding the only evidence this
 * repository holds that a source host can disappear.
 */
function dc(n: Node, element: string, qualifier?: string): string[] {
  const r = record(n);
  if (!r) return [];
  return r.fields
    .filter((f) => f.schema === "dc" && f.element === element && (f.qualifier ?? undefined) === qualifier)
    .flatMap((f) => f.values.map((v) => v.value));
}

/**
 * When IRIS took the item in — the key its own "Recent Submissions" sorts on.
 *
 * The LATEST of the accessions where a record carries several, which is the
 * one a descending sort surfaces. The WPRO item has two, five days apart:
 * 2020-05-12 and 2020-05-17, the second being the regional-IRIS merge. Taking
 * the earlier would order this list by original deposit, which is a different
 * and equally defensible list — so the choice is stated rather than left to be
 * inferred from the output.
 *
 * Returns `undefined` rather than a date when nothing was captured. A node
 * with no accession is not a node accessioned at the epoch.
 */
function accessioned(n: Node): string | undefined {
  const all = dc(n, "date", "accessioned");
  return all.length ? all.slice().sort()[all.length - 1] : undefined;
}

/**
 * Recent submissions, in the order IRIS would show them.
 *
 * Descending accession, **with the catalogue id as the tie-break** — and the
 * tie-break is not decoration. `readdirSync` order already produced a
 * generator that emitted different bytes from identical inputs once this
 * session (`gen-iris-pages.test.ts`); a sort with ties is the same defect with
 * a smaller blast radius. Items with no captured accession sort last, together,
 * by id: unknown is a position, not a zero.
 */
/**
 * Remove XML comments, repeated until nothing changes, so a comment that one
 * pass of removal itself forms (`<!-<!---->-`) cannot survive (CodeQL
 * js/incomplete-multi-character-sanitization).
 */
export function stripXmlComments(text: string): string {
  let prev: string;
  do {
    prev = text;
    text = text.replace(/<!--[\s\S]*?-->\s*/g, "");
  } while (text !== prev);
  return text;
}

/** How many items the home page's Recent Submissions shows. */
export const RECENT_SUBMISSIONS_MAX = 10;

export function recentOrder(items: Node[]): Node[] {
  return items.slice().sort((a, b) => {
    const da = accessioned(a);
    const db = accessioned(b);
    if (da !== db) {
      if (da === undefined) return 1;
      if (db === undefined) return -1;
      return db.localeCompare(da, "en");
    }
    return a.id.localeCompare(b.id, "en");
  });
}

/** A date as IRIS prints it in a submission line: the day, not the timestamp. */
function day(iso: string | undefined): string | undefined {
  return iso?.slice(0, 10);
}

/**
 * The instance's front door — `<base-url>/<kind>/<instance>/`.
 *
 * Owner, 2026-09-20: *"`<baseurl>/who-iris` should be defaul harness
 * behaviour, themed. that default harness benafour shoud show lassets in
 * library"*, and then the addressing rule: *"`<path-to-kind-or-node>`"*, with
 * `library/who-iris` as the worked example.
 *
 * **This is a front door, not the library visualiser.** The library
 * visualiser is bean `jbx2` and belongs to another agent — the owner said so
 * in the same session: *"library is another agent."* So this lists what is
 * held and links onward; it does not try to be the thing somebody else is
 * building, which would be two answers to one question.
 *
 * It exists for a second, mechanical reason: `mount-instance-docs.ts` mounts a
 * directory only when it carries an `index.html` at its root, because "has a
 * front door" is the difference between a built visualiser and a directory of
 * source files served under a URL that promises one.
 */
/**
 * The IRIS home page, replicated.
 *
 * Owner, 2026-09-20, on finding the generic index here:
 *
 * > *"i would have expected to go to the harness defaiult landing page = folio
 * > show pages (or am i wrong), or to have a designated landing page whcih
 * > mocks the iris landing page. … go back to orinal .pdf of iris pages and
 * > validate look."*
 *
 * Validated against `who-iris/uploads/iris-home/iris-capture/IRIS-Home.pdf`,
 * page 1, rendered at 900px on 2026-09-20. Five bands, in the source's order:
 * masthead, hero, search, Recent Submissions, footer. Everything below is
 * either read off that capture or read out of the catalogue; nothing is
 * remembered.
 *
 * ## What is copied, and what deliberately is not
 *
 * **No WHO logo and no hero photograph.** The real page sets its hero over a
 * photograph of the Geneva headquarters with the WHO emblem on the facade. A
 * replica carrying either would be indistinguishable from the real site at a
 * glance, which is the whole reason the instruction exists. The hero is a
 * gradient in the `iris-web` theme's own measured colours instead — owner:
 * *"just use colors."*
 *
 * **Item covers ARE shown, with the emblem masked out of the bytes.** This
 * took two rulings. The covers are the publications' own and the emblem on
 * them is printed on the documents, so the file first argued they were content
 * rather than chrome; the owner read it otherwise on 2026-09-21, naming the
 * emblem with the logo — *"logo and other branding"* — and they were withheld.
 * Asked then whether to show them masked, they chose masking.
 *
 * The emblem is blanked by `pdf-cover.py` **before the PNG is written**, from
 * regions declared per item as `maskedRegions`, so the committed bytes do not
 * contain it. Not a display rule: nothing downstream can leak what is not in
 * the file. The publication's TITLE is untouched where it contains "WHO" —
 * that names the work and is not branding this page wears.
 *
 * ## Search across held items and referenced identifier lookup
 *
 * The placeholder reads `Search through the repository's 273559 items`,
 * transcribed from the capture, because that is the sentence IRIS shows and it
 * is where this repository's item count came from at all. The form actively
 * searches across the held catalogue items, collections and communities, and
 * links onward to the prefix-sharded identifier lookup for referenced nodes
 * (`id-lookup`).
 */
function landingPage(all: Node[]): string {
  const items = all.filter((n) => n.flavour === "item");
  const communities = all.filter((n) => n.flavour === "community");
  const collections = all.filter((n) => n.flavour === "collection");
  const held = items.filter((n) => assetHref(n) !== undefined);
  const cat = catalogue();
  // The nodes held by REFERENCE: every node but the items held by value. This
  // was the literal 10 until 2026-10-05, true when it was typed; counted now,
  // so the sentence stays true when the catalogue grows.
  const REFERENCED_NODES = all.length - held.length;

  // Capped at 10 (owner, 2026-11-10, who-iris#207): the catalogue now grows by
  // thousands of referenced items, and every one of them on the home page in
  // six languages would be megabytes of HTML. IRIS's own strip is short too.
  const submissions = recentOrder(items).slice(0, RECENT_SUBMISSIONS_MAX).map((n) => submission(n)).join("\n");

  const itemsUpstream = cat.totalItemsUpstream;
  const filesUpstream = cat.totalFilesUpstream;

  return landingHtml(all, { held, communities, collections, submissions, itemsUpstream, filesUpstream, REFERENCED_NODES });
}

/**
 * The file the home page's search box reads, beside each language's
 * `index.html` (owner, 2026-11-14: "do lazy load content and libs").
 *
 * It was an inline `var index = [...]` — 299 KB raw, 75 KB gzip of the 387 KB
 * home page, in all six languages, whether or not anyone typed. Now it is
 * fetched on the box's first `focus` or `input`, and cached like any file.
 * Same records, same order: the client is unchanged past the fetch.
 */
export const HOME_SEARCH_DATA = "home-search.json";

/** The home search index for the current `LOCALE`, as the JSON file holds it. */
export function homeSearchEntries(all: Node[]): unknown[] {
  const byId = new Map(all.map((n) => [n.id, n]));
  return all
    .map((n) => {
      if (n.flavour === "item") {
        const authors = dc(n, "contributor", "author");
        const issued = day(dc(n, "date", "issued")[0]);
        const year = issued ? parseInt(issued.slice(0, 4), 10) : undefined;
        const abstract = dc(n, "description", "abstract")[0] ?? "";
        const cite = dc(n, "identifier", "citation")[0] ?? dc(n, "identifier", "govdoc")[0] ?? "";
        const spatial = dc(n, "spatial")[0] ?? "";
        const subjects = dc(n, "subject", "mesh");
        const bitstreams = n.bitstreams ?? [];
        const originalPdf = bitstreams.find((b) => b.bundle === "ORIGINAL" && (b.mediaType === "application/pdf" || b.name.endsWith(".pdf")));
        const copyrightGate = originalPdf?.materialization?.gates?.copyright?.verdict;
        const parentComm = (n.parents?.[0] ?? []).find((p) => p.startsWith("community/"));
        const parentColl = (n.parents?.[0] ?? []).find((p) => p.startsWith("collection/"));
        const commTitle = parentComm ? byId.get(parentComm)?.title : undefined;
        const collTitle = parentColl ? byId.get(parentColl)?.title : undefined;
        const meta = [authors.join("; "), cite, issued].filter(Boolean).join(" · ");
        const text = [n.title, n.id, n.libraryId ?? "", authors.join(" "), cite, issued, spatial, commTitle ?? "", subjects.join(" "), abstract].join(" ").toLowerCase();
        return {
          title: n.title,
          href: itemHref(n),
          badge: t("Item"),
          meta,
          lang: langOf(n) !== LOCALE ? langOf(n) : undefined,
          abstract: abstract.slice(0, 240),
          text,
          creator: authors.join("; "),
          year,
          spatial,
          community: commTitle,
          collection: collTitle,
          subjects,
          hasPdf: !!originalPdf,
          copyrightGate,
        };
      }
      if (n.flavour === "collection") {
        return {
          title: n.title,
          href: cataloguePageHref(),
          badge: t("Collection"),
          meta: n.id,
          abstract: n.materialization?.note ?? "",
          text: [n.title, n.id, n.materialization?.note ?? ""].join(" ").toLowerCase(),
        };
      }
      return {
        title: n.title,
        href: cataloguePageHref(),
        badge: t("Community"),
        meta: n.id,
        abstract: "",
        text: [n.title, n.id].join(" ").toLowerCase(),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "en"));
}

function landingHtml(
  all: Node[],
  { held, communities, collections, submissions, itemsUpstream, filesUpstream, REFERENCED_NODES }: {
    held: Node[]; communities: Node[]; collections: Node[]; submissions: string;
    itemsUpstream: number | undefined; filesUpstream: number | undefined; REFERENCED_NODES: number;
  },
): string {
  return `
<section class="hero">
  <div class="hero-in">
    <h1>IRIS</h1>
    <p>${t("The primary objective of the Institutional Repository for Information Sharing (IRIS) is to provide free digital access to the scientific and technical publications of the World Health Organization (WHO), including contributions from its Country Offices, Regional Offices, and Headquarters. Additionally, IRIS encompasses the mandates established by the Organization’s Governing Bodies in collaboration with its Member States.")}</p>
  </div>
  <p class="hero-note">${t("Replica. No WHO emblem, no photograph — colour only, from the {theme} theme measured off the site’s own stylesheet.", { theme: "<code>iris-web</code>" })}</p>
</section>

<form class="searchbar" id="iris-search-form" action="search.html" method="get">
  <input type="text" id="iris-search-input" name="query"
    placeholder="${esc(t("Search through the repository’s {n} items", { n: itemsUpstream !== undefined ? String(itemsUpstream) : "?" }))}"
    aria-label="${esc(t("Search through the repository items and referenced identifier lookup"))}"
    autocomplete="off" spellcheck="false">
  <button type="submit" id="iris-search-btn">${t("Search")}</button>
</form>

<div id="iris-search-results" class="search-results-panel" role="region" aria-live="polite" style="display:none"></div>
<p class="searchnote" id="iris-search-note">${t("Search across <strong>{held}</strong> items held by value and referenced communities/collections. To look up any of the <strong>{referenced}</strong> referenced nodes by identifier, search here or open the {lookup}.", {
    held: num(held.length),
    referenced: num(REFERENCED_NODES),
    lookup: `<a href="${toSiteRoot()}../id-lookup/?index=who-iris/">${t("identifier lookup")}</a>`,
  })}${itemsUpstream !== undefined && filesUpstream !== undefined
    ? `\n${t("Upstream IRIS reports <strong>{items}</strong> items across <strong>{files}</strong> files.", { items: num(itemsUpstream), files: num(filesUpstream) })}`
    : ""}</p>

<h2>${t("Recent Submissions")}</h2>
<p class="ordering">${t("Ordered by {key}, latest first — the key IRIS’s own list sorts on. Where a record carries several accessions the latest is used; the WPRO item has two, five days apart, the second being the regional-IRIS merge.", { key: "<code>dc.date.accessioned</code>" })}</p>

<div class="subs">
${submissions}
</div>

<h2>${t("Browse")}</h2>
<ul class="kids" style="margin-inline-start:0">
  <li>${t("{link} — the replica of {url}, with every node’s materialisation state ({communities} communities, {collections} collections)", {
    link: `<a href="${esc(cataloguePageHref())}">${t("List of Communities")}</a>`,
    url: "<code>iris.who.int/community-list</code>",
    communities: num(communities.length),
    collections: num(collections.length),
  })}</li>
${collections
  .map((c) => `  <li>${t("{link} — collection", { link: `<a href="${esc(cataloguePageHref())}">${data(c.title)}</a>` })}</li>`)
  .join("\n")}
</ul>

<script>
(function() {
  // FETCHED, NOT INLINED: the records are ${HOME_SEARCH_DATA} beside this page,
  // read on the box's first focus or input (or at once for a ?q= link, or
  // before printing a page whose box holds a query, so a printout is never a
  // half-loaded panel). Until then \`index\` is empty and update() is a no-op.
  var DATA = ${JSON.stringify(HOME_SEARCH_DATA)};
  var index = [];
  var loaded = false;
  var waiting = null;
  function load(then) {
    if (loaded) { if (then) then(); return Promise.resolve(); }
    if (!waiting) {
      waiting = fetch(DATA, { cache: "no-cache" })
        .then(function(r) { if (!r.ok) throw new Error(DATA + ": HTTP " + r.status); return r.json(); })
        .then(function(rows) { index = Array.isArray(rows) ? rows : []; loaded = true; })
        .catch(function(e) { waiting = null; if (window.console) console.warn("iris home search:", e); });
    }
    return waiting.then(function() { if (then) then(); });
  }
  var T = ${JSON.stringify({
    matching: t("Matching catalogue nodes ({n}):"),
    also: t("Also search identifier lookup:"),
    lookUp: t("Look up “{q}” in referenced nodes →"),
    none: t("No materialized items or collections matched “<strong>{q}</strong>”."),
    searchFor: t("Search for “{q}” in the referenced identifier lookup ({n} nodes) →", { n: num(REFERENCED_NODES) }),
  })};
  function fill(s, q, n) { return s.split("{q}").join(q).split("{n}").join(n); }
  var form = document.getElementById("iris-search-form");
  var input = document.getElementById("iris-search-input");
  var results = document.getElementById("iris-search-results");
  if (!form || !input || !results) return;

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Marks are placed on the RAW text and every piece is escaped once, so a
  // query term can never match inside markup this function has written.
  function highlight(text, terms) {
    var parts = [];
    for (var i = 0; i < terms.length; i++) {
      if (terms[i]) parts.push(terms[i].replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&"));
    }
    if (!parts.length) return escapeHtml(text);
    var regex = new RegExp("(" + parts.join("|") + ")", "gi");
    return text.split(regex).map(function(piece, k) {
      return k % 2 ? "<mark class=\\"search-mark\\">" + escapeHtml(piece) + "</mark>" : escapeHtml(piece);
    }).join("");
  }

  // An index href is a site-relative path or an https URL; anything else
  // (a javascript: or data: URL) is refused and the result is not shown.
  function hrefOk(h) {
    return typeof h === "string" && (/^https:\\/\\//i.test(h) || !/^[a-z][a-z0-9+.-]*:/i.test(h.trim()));
  }

  function update() {
    var raw = input.value.trim();
    if (!raw) {
      results.style.display = "none";
      results.replaceChildren();
      return;
    }

    var terms = raw.toLowerCase().split(/\\s+/).filter(Boolean);
    var matches = [];
    for (var i = 0; i < index.length; i++) {
      var entry = index[i];
      var ok = true;
      for (var t = 0; t < terms.length; t++) {
        if (entry.text.indexOf(terms[t]) < 0) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      matches.push(entry);
    }

    var lookupUrl = "${toSiteRoot()}../id-lookup/?index=who-iris/&q=" + encodeURIComponent(raw);
    var html = "";

    if (matches.length > 0) {
      html += "<h3 style=\\"margin:0 0 0.8rem;font-size:1.05rem;color:var(--iris-heading);\\">" + fill(T.matching, "", String(matches.length)) + "</h3>";
      html += "<ul class=\\"search-results-list\\" style=\\"list-style:none;padding:0;margin:0 0 1rem;display:flex;flex-direction:column;gap:0.75rem;\\">";
      for (var m = 0; m < matches.length; m++) {
        var it = matches[m];
        if (!hrefOk(it.href)) continue;
        var la = it.lang ? " lang=\\"" + escapeHtml(it.lang) + "\\"" : "";
        html += "<li class=\\"search-result-item\\" style=\\"padding:0.6rem 0.8rem;border:1px solid var(--iris-edge);border-radius:4px;background:var(--iris-wash);\\">";
        html += "<div style=\\"display:flex;align-items:center;flex-wrap:wrap;gap:0.35rem;\\"><span class=\\"search-result-badge\\" style=\\"display:inline-block;font-size:0.75rem;font-weight:600;text-transform:uppercase;padding:0.15rem 0.45rem;border-radius:3px;background:var(--iris-accent);color:#fff;margin-inline-end:0.3rem;\\">" + escapeHtml(it.badge) + "</span>";
        if (it.copyrightGate === "permitted") {
          html += "<span class=\\"state materialized\\" style=\\"font-size:0.72rem;\\">PDF Permitted</span>";
        } else if (it.hasPdf) {
          html += "<span class=\\"state referenced\\" style=\\"font-size:0.72rem;\\">PDF Held (Restricted)</span>";
        }
        html += "<a href=\\"" + escapeHtml(it.href) + "\\" dir=\\"auto\\"" + la + " style=\\"font-weight:600;font-size:1.02rem;\\">" + highlight(it.title, terms) + "</a></div>";
        if (it.meta) {
          html += "<div class=\\"search-result-meta\\" dir=\\"auto\\"" + la + " style=\\"font-size:0.88rem;color:var(--iris-muted);margin-top:0.25rem;\\">" + highlight(it.meta, terms) + "</div>";
        }
        if (it.subjects && it.subjects.length > 0) {
          html += "<div style=\\"margin-top:0.3rem;display:flex;flex-wrap:wrap;gap:0.25rem;\\">";
          for (var s = 0; s < it.subjects.length; s++) {
            html += "<span style=\\"font-size:0.75rem;background:var(--iris-tag-bg);color:var(--iris-heading);padding:0.1rem 0.4rem;border-radius:3px;\\">#" + escapeHtml(it.subjects[s]) + "</span>";
          }
          html += "</div>";
        }
        if (it.abstract) {
          var snip = it.abstract.length > 180 ? it.abstract.slice(0, 180) + "…" : it.abstract;
          html += "<div class=\\"search-result-meta\\" dir=\\"auto\\"" + la + " style=\\"font-size:0.88rem;color:var(--iris-ink);margin-top:0.35rem;\\">" + highlight(snip, terms) + "</div>";
        }
        html += "</li>";
      }
      html += "</ul>";
      html += "<div class=\\"search-remote-box\\" style=\\"border-top:1px solid var(--iris-edge);padding-top:0.75rem;margin-top:0.75rem;font-size:0.92rem;\\">";
      html += T.also + " <a href=\\"" + lookupUrl + "\\" class=\\"search-remote-link\\">" + fill(T.lookUp, escapeHtml(raw), "") + "</a>";
      html += "</div>";
    } else {
      html += "<p style=\\"margin:0 0 0.5rem;\\">" + fill(T.none, escapeHtml(raw), "") + "</p>";
      html += "<div class=\\"search-remote-box\\" style=\\"border-top:1px solid var(--iris-edge);padding-top:0.75rem;margin-top:0.75rem;font-size:0.92rem;\\">";
      html += "<a href=\\"" + lookupUrl + "\\" class=\\"search-remote-link\\" style=\\"font-weight:600;\\">" + fill(T.searchFor, escapeHtml(raw), "") + "</a>";
      html += "</div>";
    }

    results.innerHTML = html;
    results.style.display = "block";
  }

  input.addEventListener("focus", function() { load(); }, { once: true });
  input.addEventListener("input", function() { load(update); });
  // PRINT: nothing printed may wait on a trigger the printer never fires.
  window.addEventListener("beforeprint", function() { if (input.value.trim()) load(update); });
  // Submitting goes to the search page with the query, as IRIS's home does
  // (issue #196); the list above is only a preview while typing.
  form.addEventListener("submit", function(e) {
    if (!input.value.trim()) e.preventDefault();
  });

  var urlParams = new URLSearchParams(window.location.search);
  var initQ = urlParams.get("q");
  if (initQ) {
    input.value = initQ;
    load(update);
  }
  try { window.__irisSearch = { load: load, update: update, get index() { return index; } }; } catch (e) {}
})();
</script>
`;
}

/**
 * The search page — `search.html?query=…`, after iris.who.int/search (issue #196).
 *
 * THE FACET CATEGORIES ARE FIXED AND THEIR VALUES ARE NOT (owner, 2026-11-08:
 * "values of the filters are dynamic"). This writes one record per held item,
 * read from its Dublin Core record, and the inlined client script computes every
 * facet value and count in the browser from the items the current query
 * matches. Nothing a facet lists is typed here.
 *
 * Which field feeds which facet, as IRIS's Discovery configuration names them:
 *
 * | facet | fields |
 * |---|---|
 * | Author | `dc.contributor.author` |
 * | Subject (MeSH) | `dc.subject.mesh` |
 * | Date issued | the year of `dc.date.issued` |
 * | Has files | an ORIGINAL bitstream in the catalogue node |
 * | Publisher | `dc.publisher` |
 * | Subject | `dc.subject`, `.mesh`, `.meshqualifier`, `.other` |
 * | Series | `dc.relation.ispartofseries`, `dc.relation.ispartofjournal` |
 * | Type | `dc.type` |
 */
function searchPage(all: Node[]): string {
  const items = all.filter((n) => n.flavour === "item");
  const held = items.filter((n) => assetHref(n) !== undefined);
  const latest = (xs: string[]): string | undefined => (xs.length ? day(xs.slice().sort()[xs.length - 1]) : undefined);
  const uniq = (xs: string[]): string[] => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  const records = items.map((n) => {
    const authors = dc(n, "contributor", "author");
    const issued = day(dc(n, "date", "issued")[0]);
    const abstract = dc(n, "description", "abstract")[0] ?? "";
    const mesh = uniq(dc(n, "subject", "mesh"));
    const f = {
      author: uniq(authors),
      mesh,
      publisher: uniq(dc(n, "publisher")),
      subject: uniq([...dc(n, "subject"), ...mesh, ...dc(n, "subject", "meshqualifier"), ...dc(n, "subject", "other")]),
      series: uniq([...dc(n, "relation", "ispartofseries"), ...dc(n, "relation", "ispartofjournal")]),
      itemtype: uniq(dc(n, "type")),
    };
    return {
      title: n.title,
      href: itemHref(n),
      cover: coverData(n),
      lang: langOf(n) !== LOCALE ? langOf(n) : undefined,
      authors,
      govdoc: dc(n, "identifier", "govdoc")[0],
      issued,
      year: issued ? parseInt(issued.slice(0, 4), 10) : undefined,
      accessioned: day(accessioned(n)),
      available: latest(dc(n, "date", "available")),
      abstract,
      hasFiles: (n.bitstreams ?? []).some((b) => b.bundle === "ORIGINAL"),
      f,
      // ONLY what the record does not already carry. The lower-cased copies
      // of the title, abstract and facet values (193 KB of the 686 KB of
      // records, times six languages) are made by the client as it parses;
      // \`ids\` is the rest of what a query matches on.
      ids: [n.id, n.libraryId ?? "", dc(n, "identifier", "govdoc").join(" "), dc(n, "identifier", "isbn").join(" ")].join(" ").toLowerCase(),
    };
  });
  const strings = {
    author: t("Author"), subject: t("Subject"), dateIssued: t("Date issued"), hasFiles: t("Has files"),
    publisher: t("Publisher"), series: t("Series"), type: t("Type"), yes: t("Yes"), no: t("No"),
    start: t("Start"), end: t("End"), apply: t("Apply"),
    findAuthor: t("Search author name"), findSubject: t("Search subject"), findPublisher: t("Search publisher"),
    findSeries: t("Search series"), findType: t("Search type"),
    showMore: t("Show more"), showLess: t("Show less"),
    sortRelevant: t("Most Relevant"), sortTitle: t("Title Ascending"), sortIssued: t("Date Issued Descending"),
    sortAccessioned: t("Accessioned Date Descending"), sortAvailable: t("Available Date Descending"),
    showing: t("Now showing {from} - {to} of {total}"),
    published: t("Publication Date: {date}"), accepted: t("Accepted: {date}"), availableOnline: t("Available Online: {date}"),
    noAuthor: t("no author recorded"), remove: t("Remove filter: {value}"), reset: t("Reset filters"),
    prev: t("Previous page"), next: t("Next page"), pagination: t("Pagination"),
    lookupTemplate: t("Search for “{q}” in the referenced identifier lookup ({n} nodes) →", { n: num(all.length - held.length) }),
  };
  const json = (v: unknown): string => JSON.stringify(v).replace(/</g, "\\u003c");
  const client = [
    "/*",
    " * The replica's search page, in the browser (issue #196).",
    " *",
    " * Inlined into site/search.html by gen-iris-pages.ts, which puts two JSON",
    " * blocks beside it: #iris-search-data (one record per held item, read from",
    " * its Dublin Core record) and #iris-search-strings (the page's words in its",
    " * language).",
    " *",
    " * THE FACET CATEGORIES ARE FIXED, THEIR VALUES ARE NOT. Every value and every",
    " * count is computed here from the items the current query and filters match,",
    " * as DSpace Discovery does, so nothing a reader sees in a facet was typed by",
    " * hand. The URL parameters are IRIS's own (query, f.<facet>=<value>,equals,",
    " * f.dateIssued.min/max, spc.page, spc.sf, spc.sd, spc.rpp), so a search",
    " * copied from iris.who.int works here with its host changed.",
    " */",
    "(function () {",
    "  \"use strict\";",
    "  var items = JSON.parse(document.getElementById(\"iris-search-data\").textContent);",
    "  // The lower-cased fields are made HERE, not shipped: the same values the",
    "  // generator used to write, from the record's own title, abstract and facets.",
    "  items.forEach(function (it) {",
    "    var f = it.f || {};",
    "    it.titleLc = String(it.title || \"\").toLowerCase();",
    "    it.abstractLc = String(it.abstract || \"\").toLowerCase();",
    "    it.facetLc = [].concat(f.author || [], f.subject || [], f.publisher || [], f.series || [], f.itemtype || []).join(\" \").toLowerCase();",
    "    it.text = [it.titleLc, it.ids || \"\", it.facetLc, it.abstractLc].join(\" \");",
    "  });",
    "  var T = JSON.parse(document.getElementById(\"iris-search-strings\").textContent);",
    "  var root = document.getElementById(\"iris-search\");",
    "  if (!root) return;",
    "",
    "  /* The facets, in IRIS's order. `show` is how many values a facet lists",
    "     before \"Show more\", as the capture shows them. */",
    "  var FACETS = [",
    "    { key: \"author\", label: T.author, find: T.findAuthor, show: 5 },",
    "    { key: \"mesh\", label: T.subject, find: T.findSubject, show: 5 },",
    "    { key: \"dateIssued\", label: T.dateIssued, range: true },",
    "    { key: \"has_content_in_original_bundle\", label: T.hasFiles, show: 2 },",
    "    { key: \"publisher\", label: T.publisher, find: T.findPublisher, show: 10 },",
    "    { key: \"subject\", label: T.subject, find: T.findSubject, show: 5 },",
    "    { key: \"series\", label: T.series, find: T.findSeries, show: 10 },",
    "    { key: \"itemtype\", label: T.type, find: T.findType, show: 10 },",
    "  ];",
    "  var SORTS = [",
    "    { sf: \"score\", sd: \"DESC\", label: T.sortRelevant },",
    "    { sf: \"dc.title\", sd: \"ASC\", label: T.sortTitle },",
    "    { sf: \"dc.date.issued\", sd: \"DESC\", label: T.sortIssued },",
    "    { sf: \"dc.date.accessioned\", sd: \"DESC\", label: T.sortAccessioned },",
    "    { sf: \"dc.date.available\", sd: \"DESC\", label: T.sortAvailable },",
    "  ];",
    "  var PER_PAGE = [1, 5, 10, 20, 40, 60, 80, 100];",
    "",
    "  /* Values a facet holds for one item. Has files is a yes/no. */",
    "  function valuesOf(it, key) {",
    "    if (key === \"has_content_in_original_bundle\") return [it.hasFiles ? \"true\" : \"false\"];",
    "    return it.f[key] || [];",
    "  }",
    "  function valueLabel(key, v) {",
    "    if (key === \"has_content_in_original_bundle\") return v === \"true\" ? T.yes : T.no;",
    "    return v;",
    "  }",
    "",
    "  // ── State, read from and written to the URL ──────────────────────────────",
    "  var state;",
    "  function readUrl(search) {",
    "    var p = new URLSearchParams(search === undefined ? window.location.search : search);",
    "    var s = {",
    "      query: (p.get(\"query\") || p.get(\"q\") || \"\").trim(),",
    "      filters: {},",
    "      min: parseInt(p.get(\"f.dateIssued.min\") || \"\", 10) || 0,",
    "      max: parseInt(p.get(\"f.dateIssued.max\") || \"\", 10) || 0,",
    "      page: Math.max(1, parseInt(p.get(\"spc.page\") || \"1\", 10) || 1),",
    "      sf: p.get(\"spc.sf\") || \"score\",",
    "      sd: (p.get(\"spc.sd\") || \"\").toUpperCase(),",
    "      rpp: parseInt(p.get(\"spc.rpp\") || \"10\", 10) || 10,",
    "      view: p.get(\"view\") === \"grid\" ? \"grid\" : \"list\",",
    "    };",
    "    FACETS.forEach(function (f) {",
    "      if (f.range) return;",
    "      var vals = p.getAll(\"f.\" + f.key).map(function (v) { return v.replace(/,(equals|authority)$/, \"\"); });",
    "      if (vals.length) s.filters[f.key] = vals;",
    "    });",
    "    var sort = SORTS.filter(function (o) { return o.sf === s.sf; })[0] || SORTS[0];",
    "    s.sf = sort.sf;",
    "    if (s.sd !== \"ASC\" && s.sd !== \"DESC\") s.sd = sort.sd;",
    "    if (PER_PAGE.indexOf(s.rpp) < 0) s.rpp = 10;",
    "    return s;",
    "  }",
    "  function toUrl(s) {",
    "    var p = new URLSearchParams();",
    "    if (s.query) p.set(\"query\", s.query);",
    "    FACETS.forEach(function (f) {",
    "      (s.filters[f.key] || []).forEach(function (v) { p.append(\"f.\" + f.key, v + \",equals\"); });",
    "    });",
    "    if (s.min) p.set(\"f.dateIssued.min\", String(s.min));",
    "    if (s.max) p.set(\"f.dateIssued.max\", String(s.max));",
    "    if (s.sf !== \"score\") { p.set(\"spc.sf\", s.sf); p.set(\"spc.sd\", s.sd); }",
    "    if (s.rpp !== 10) p.set(\"spc.rpp\", String(s.rpp));",
    "    if (s.view === \"grid\") p.set(\"view\", \"grid\");",
    "    p.set(\"spc.page\", String(s.page));",
    "    return \"?\" + p.toString();",
    "  }",
    "  function go(next, push) {",
    "    state = next;",
    "    var url = toUrl(state);",
    "    try {",
    "      if (push) history.pushState(null, \"\", url);",
    "      else history.replaceState(null, \"\", url);",
    "    } catch (e) { /* a file:// page may refuse; the page still renders */ }",
    "    render();",
    "  }",
    "  function withChange(change) {",
    "    var s = JSON.parse(JSON.stringify(state));",
    "    change(s);",
    "    return s;",
    "  }",
    "",
    "  // ── Matching and scoring ─────────────────────────────────────────────────",
    "  function terms(q) {",
    "    return q.toLowerCase().split(/\\s+/).filter(Boolean);",
    "  }",
    "  /* Every term must appear somewhere. A hit in the title counts most, then",
    "     authors and subjects, then the abstract: a stated weighting, not DSpace's",
    "     Solr score, which this page has no way to reproduce. */",
    "  function score(it, ts) {",
    "    var s = 0;",
    "    for (var i = 0; i < ts.length; i++) {",
    "      var t = ts[i];",
    "      if (it.text.indexOf(t) < 0) return -1;",
    "      if (it.titleLc.indexOf(t) >= 0) s += 5;",
    "      if (it.facetLc.indexOf(t) >= 0) s += 2;",
    "      if (it.abstractLc.indexOf(t) >= 0) s += 1;",
    "    }",
    "    return s;",
    "  }",
    "  function passes(it, s, skipKey) {",
    "    for (var k in s.filters) {",
    "      if (k === skipKey) continue;",
    "      var want = s.filters[k];",
    "      var have = valuesOf(it, k);",
    "      for (var i = 0; i < want.length; i++) if (have.indexOf(want[i]) < 0) return false;",
    "    }",
    "    if (skipKey !== \"dateIssued\") {",
    "      if (s.min && !(it.year && it.year >= s.min)) return false;",
    "      if (s.max && !(it.year && it.year <= s.max)) return false;",
    "    }",
    "    return true;",
    "  }",
    "  function results(s) {",
    "    var ts = terms(s.query);",
    "    var out = [];",
    "    for (var i = 0; i < items.length; i++) {",
    "      var sc = score(items[i], ts);",
    "      if (sc < 0 || !passes(items[i], s)) continue;",
    "      out.push({ it: items[i], score: sc });",
    "    }",
    "    var dir = s.sd === \"ASC\" ? 1 : -1;",
    "    var key = { \"dc.title\": \"title\", \"dc.date.issued\": \"issued\", \"dc.date.accessioned\": \"accessioned\", \"dc.date.available\": \"available\" }[s.sf];",
    "    out.sort(function (a, b) {",
    "      if (!key) {",
    "        if (b.score !== a.score) return b.score - a.score;",
    "        return (b.it.accessioned || \"\").localeCompare(a.it.accessioned || \"\");",
    "      }",
    "      var x = a.it[key] || \"\", y = b.it[key] || \"\";",
    "      // An item with no value goes last whichever way the sort runs.",
    "      if (!x !== !y) return x ? -1 : 1;",
    "      var c = key === \"title\" ? x.localeCompare(y, document.documentElement.lang || \"en\") : x.localeCompare(y);",
    "      return c * dir || a.it.title.localeCompare(b.it.title);",
    "    });",
    "    return out;",
    "  }",
    "",
    "  /* A facet's values and counts over the current results. */",
    "  function facetCounts(key, matched) {",
    "    var counts = {};",
    "    matched.forEach(function (r) {",
    "      valuesOf(r.it, key).forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });",
    "    });",
    "    return Object.keys(counts)",
    "      .map(function (v) { return { v: v, n: counts[v] }; })",
    "      .sort(function (a, b) { return b.n - a.n || a.v.localeCompare(b.v); });",
    "  }",
    "  /* Date ranges from the years present, at most ten, on a round gap, as",
    "     Discovery draws them (1920 - 1959, 1960 - 1999, …). */",
    "  function dateRanges(matched) {",
    "    var years = matched.map(function (r) { return r.it.year; }).filter(Boolean);",
    "    if (!years.length) return [];",
    "    var lo = Math.min.apply(null, years), hi = Math.max.apply(null, years);",
    "    var gaps = [1, 2, 5, 10, 20, 25, 40, 50, 100, 200, 500];",
    "    var gap = gaps[gaps.length - 1];",
    "    for (var g = 0; g < gaps.length; g++) {",
    "      if (Math.floor(hi / gaps[g]) - Math.floor(lo / gaps[g]) + 1 <= 10) { gap = gaps[g]; break; }",
    "    }",
    "    var out = [];",
    "    for (var start = Math.floor(lo / gap) * gap; start <= hi; start += gap) {",
    "      var a = Math.max(start, lo), b = Math.min(start + gap - 1, hi);",
    "      var n = years.filter(function (y) { return y >= a && y <= b; }).length;",
    "      if (n) out.push({ min: a, max: b, n: n });",
    "    }",
    "    return out;",
    "  }",
    "",
    "  // ── Drawing ──────────────────────────────────────────────────────────────",
    "  //",
    "  // Every node is built with createElement and every string goes in with",
    "  // createTextNode or setAttribute, so no value from the URL, a search box",
    "  // or the data is ever parsed as HTML.",
    "  function h(tag, attrs) {",
    "    var el = document.createElement(tag);",
    "    for (var k in attrs || {}) {",
    "      if (attrs[k] === undefined || attrs[k] === null || attrs[k] === false) continue;",
    "      if (k === \"text\") el.textContent = attrs[k];",
    "      else el.setAttribute(k, attrs[k] === true ? \"\" : String(attrs[k]));",
    "    }",
    "    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);",
    "    return el;",
    "  }",
    "  function add(el, child) {",
    "    if (child === undefined || child === null || child === false) return;",
    "    if (Array.isArray(child)) { child.forEach(function (c) { add(el, c); }); return; }",
    "    // append() turns a string into a text node, never markup.",
    "    el.append(child instanceof Node ? child : String(child));",
    "  }",
    "  function fill(s, vars) {",
    "    for (var k in vars) s = s.split(\"{\" + k + \"}\").join(vars[k]);",
    "    return s;",
    "  }",
    "  function count(n) {",
    "    return n >= 1000 ? (Math.round(n / 100) / 10) + \"K\" : String(n);",
    "  }",
    "  /* The text with each query term wrapped in <mark>, as text nodes. */",
    "  function mark(text, ts) {",
    "    var frag = document.createDocumentFragment();",
    "    var parts = ts.map(function (t) { return t.replace(/[.*+?^${}()|[\\]\\\\]/g, \"\\\\$&\"); });",
    "    if (!parts.length) { frag.appendChild(document.createTextNode(text)); return frag; }",
    "    String(text).split(new RegExp(\"(\" + parts.join(\"|\") + \")\", \"gi\")).forEach(function (p, i) {",
    "      frag.appendChild(i % 2 ? h(\"mark\", { text: p }) : document.createTextNode(p));",
    "    });",
    "    return frag;",
    "  }",
    "  /* Only a relative path or an https URL is used as a link target. */",
    "  function safeHref(u) {",
    "    return typeof u === \"string\" && (/^https:\\/\\//i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u.trim())) ? u : \"#\";",
    "  }",
    "  /* The cover cell the generator described: an image, or a placeholder. */",
    "  function coverNode(c) {",
    "    if (c && c.src) {",
    "      return h(\"a\", { href: safeHref(c.href) }, h(\"img\", { src: safeHref(c.src), width: c.w, height: c.h, alt: c.alt, loading: \"lazy\" }));",
    "    }",
    "    var lines = String((c && c.text) || \"\").split(\"\\n\");",
    "    var span = h(\"span\", { class: \"nocover\", title: c && c.title });",
    "    lines.forEach(function (l, i) { if (i) span.appendChild(h(\"br\")); span.appendChild(document.createTextNode(l)); });",
    "    return span;",
    "  }",
    "  var expanded = {}; // facet key -> how many values are shown",
    "  var finding = {};  // facet key -> the facet's own search text",
    "",
    "  function facetNode(f, matched) {",
    "    var body = [];",
    "    if (f.range) {",
    "      var ranges = dateRanges(state.min || state.max ? results(withChange(function (s) { s.min = 0; s.max = 0; })) : matched);",
    "      body.push(h(\"form\", { class: \"is-range\", \"data-range\": true },",
    "        h(\"label\", {}, T.start + \" \", h(\"input\", { type: \"number\", name: \"min\", inputmode: \"numeric\", value: state.min || \"\" })),",
    "        h(\"label\", {}, T.end + \" \", h(\"input\", { type: \"number\", name: \"max\", inputmode: \"numeric\", value: state.max || \"\" })),",
    "        h(\"button\", { type: \"submit\", text: T.apply })));",
    "      body.push(h(\"ul\", { class: \"is-values\" }, ranges.map(function (r) {",
    "        var on = state.min === r.min && state.max === r.max;",
    "        return h(\"li\", {}, h(\"a\", {",
    "          href: toUrl(withChange(function (s) { s.min = r.min; s.max = r.max; s.page = 1; })),",
    "          \"data-range-min\": r.min, \"data-range-max\": r.max, \"aria-current\": on ? \"true\" : null,",
    "        }, h(\"span\", { class: \"is-label\", text: r.min + \" - \" + r.max }), h(\"span\", { class: \"is-count\", text: count(r.n) })));",
    "      })));",
    "    } else {",
    "      // Counts over the results WITHOUT this facet's own selection, so a",
    "      // reader can see what else the facet offers; selected values on top.",
    "      var all = facetCounts(f.key, results(withChange(function (s) { delete s.filters[f.key]; })));",
    "      if (!all.length) return null;",
    "      var chosen = state.filters[f.key] || [];",
    "      var needle = (finding[f.key] || \"\").toLowerCase();",
    "      var list = all.filter(function (x) { return !needle || valueLabel(f.key, x.v).toLowerCase().indexOf(needle) >= 0; });",
    "      list.sort(function (a, b) { return (chosen.indexOf(b.v) >= 0) - (chosen.indexOf(a.v) >= 0); });",
    "      var shown = expanded[f.key] || f.show;",
    "      body.push(h(\"ul\", { class: \"is-values\" }, list.slice(0, shown).map(function (x) {",
    "        var on = chosen.indexOf(x.v) >= 0;",
    "        var next = withChange(function (s) {",
    "          var cur = s.filters[f.key] || [];",
    "          s.filters[f.key] = on ? cur.filter(function (v) { return v !== x.v; }) : cur.concat([x.v]);",
    "          if (!s.filters[f.key].length) delete s.filters[f.key];",
    "          s.page = 1;",
    "        });",
    "        return h(\"li\", {}, h(\"a\", { href: toUrl(next), \"data-facet\": f.key, \"aria-current\": on ? \"true\" : null, dir: \"auto\" },",
    "          h(\"span\", { class: \"is-check\", \"aria-hidden\": \"true\", text: on ? \"☑\" : \"☐\" }),",
    "          h(\"span\", { class: \"is-label\", text: valueLabel(f.key, x.v) }),",
    "          h(\"span\", { class: \"is-count\", text: count(x.n) })));",
    "      })));",
    "      body.push(h(\"div\", { class: \"is-more\" },",
    "        list.length > shown ? h(\"button\", { type: \"button\", \"data-more\": f.key, text: T.showMore }) : null,",
    "        shown > f.show ? h(\"button\", { type: \"button\", \"data-less\": f.key, text: T.showLess }) : null));",
    "      if (f.find) {",
    "        body.push(h(\"input\", { type: \"search\", class: \"is-find\", \"data-find\": f.key, placeholder: f.find, \"aria-label\": f.find, value: finding[f.key] || \"\" }));",
    "      }",
    "    }",
    "    return h(\"details\", { class: \"is-facet\", open: true }, h(\"summary\", { text: f.label }), body);",
    "  }",
    "",
    "  function cardNode(r, ts) {",
    "    var it = r.it;",
    "    var dates = [",
    "      it.govdoc || \"\",",
    "      it.issued ? fill(T.published, { date: it.issued }) : \"\",",
    "      it.accessioned ? fill(T.accepted, { date: it.accessioned }) : \"\",",
    "      it.available ? fill(T.availableOnline, { date: it.available }) : \"\",",
    "    ].filter(Boolean).join(\", \");",
    "    var long = it.abstract.length > 260;",
    "    return h(\"li\", { class: \"is-card\" },",
    "      h(\"div\", { class: \"is-cover\" }, coverNode(it.cover)),",
    "      h(\"div\", { class: \"is-body\" },",
    "        h(\"a\", { class: \"is-title\", href: safeHref(it.href), dir: \"auto\", lang: it.lang }, mark(it.title, ts)),",
    "        h(\"p\", { class: \"is-by\", dir: \"auto\" },",
    "          it.authors.length ? mark(it.authors.join(\"; \"), ts) : h(\"span\", { class: \"none\", text: T.noAuthor }),",
    "          dates ? \" (\" + dates + \")\" : null),",
    "        it.abstract ? h(\"p\", { class: \"is-abs\" + (long ? \" clamp\" : \"\"), dir: \"auto\", lang: it.lang }, mark(it.abstract, ts)) : null,",
    "        it.abstract && long ? h(\"button\", { type: \"button\", class: \"is-toggle\", \"aria-expanded\": \"false\", text: T.showMore }) : null));",
    "  }",
    "",
    "  function pagesNode(total) {",
    "    var last = Math.max(1, Math.ceil(total / state.rpp));",
    "    if (last === 1) return null;",
    "    var p = state.page;",
    "    var want = {};",
    "    want[1] = want[last] = true;",
    "    for (var n = Math.max(1, p - 4); n <= Math.min(last, p + 5); n++) want[n] = true;",
    "    var nums = Object.keys(want).map(Number).sort(function (a, b) { return a - b; });",
    "    function link(n, text, label, disabled) {",
    "      if (disabled) return h(\"li\", { class: \"disabled\" }, h(\"span\", { \"aria-hidden\": \"true\", text: text }));",
    "      var cur = n === p;",
    "      return h(\"li\", { class: cur ? \"active\" : null }, h(\"a\", {",
    "        href: toUrl(withChange(function (s) { s.page = n; })), \"data-page\": n,",
    "        \"aria-current\": cur ? \"page\" : null, \"aria-label\": label, text: text,",
    "      }));",
    "    }",
    "    var out = [link(p - 1, \"«\", T.prev, p === 1)];",
    "    var prev = 0;",
    "    nums.forEach(function (n) {",
    "      if (prev && n - prev > 1) out.push(h(\"li\", { class: \"disabled\" }, h(\"span\", { text: \"…\" })));",
    "      out.push(link(n, String(n)));",
    "      prev = n;",
    "    });",
    "    out.push(link(p + 1, \"»\", T.next, p === last));",
    "    return h(\"nav\", { \"aria-label\": T.pagination }, h(\"ul\", { class: \"is-pages\" }, out));",
    "  }",
    "",
    "  function chipsNode() {",
    "    var chips = [];",
    "    FACETS.forEach(function (f) {",
    "      (state.filters[f.key] || []).forEach(function (v) {",
    "        chips.push({ label: f.label + \": \" + valueLabel(f.key, v), url: toUrl(withChange(function (s) {",
    "          s.filters[f.key] = s.filters[f.key].filter(function (x) { return x !== v; });",
    "          if (!s.filters[f.key].length) delete s.filters[f.key];",
    "          s.page = 1;",
    "        })) });",
    "      });",
    "    });",
    "    if (state.min || state.max) {",
    "      chips.push({ label: T.dateIssued + \": \" + (state.min || \"…\") + \" - \" + (state.max || \"…\"), url: toUrl(withChange(function (s) { s.min = 0; s.max = 0; s.page = 1; })) });",
    "    }",
    "    if (!chips.length) return null;",
    "    return h(\"div\", { class: \"is-chips\" },",
    "      chips.map(function (c) {",
    "        return h(\"a\", { class: \"is-chip\", href: c.url, \"data-nav\": true, \"aria-label\": fill(T.remove, { value: c.label }), dir: \"auto\" },",
    "          c.label + \" \", h(\"span\", { \"aria-hidden\": \"true\", text: \"×\" }));",
    "      }),",
    "      h(\"a\", { class: \"is-chip is-reset\", href: toUrl(withChange(function (s) { s.filters = {}; s.min = 0; s.max = 0; s.page = 1; })), \"data-nav\": true, text: T.reset }));",
    "  }",
    "",
    "  var els = {",
    "    form: document.getElementById(\"iris-search-form\"),",
    "    input: document.getElementById(\"iris-search-input\"),",
    "    facets: document.getElementById(\"is-facets\"),",
    "    settings: document.getElementById(\"is-settings\"),",
    "    chips: document.getElementById(\"is-chips\"),",
    "    status: document.getElementById(\"is-status\"),",
    "    list: document.getElementById(\"is-results\"),",
    "    pages: document.getElementById(\"is-pages\"),",
    "    empty: document.getElementById(\"is-empty\"),",
    "    views: root.querySelectorAll(\"[data-view]\"),",
    "  };",
    "",
    "  function render() {",
    "    var matched = results(state);",
    "    var total = matched.length;",
    "    var last = Math.max(1, Math.ceil(total / state.rpp));",
    "    if (state.page > last) state.page = last;",
    "    var from = (state.page - 1) * state.rpp;",
    "    var shown = matched.slice(from, from + state.rpp);",
    "    var ts = terms(state.query);",
    "",
    "    if (els.input && document.activeElement !== els.input) els.input.value = state.query;",
    "    els.facets.replaceChildren();",
    "    FACETS.forEach(function (f) { add(els.facets, facetNode(f, matched)); });",
    "    els.chips.replaceChildren();",
    "    add(els.chips, chipsNode());",
    "    els.status.textContent = total",
    "      ? fill(T.showing, { from: String(from + 1), to: String(from + shown.length), total: String(total) })",
    "      : \"\";",
    "    els.list.className = \"is-results is-\" + state.view;",
    "    els.list.replaceChildren();",
    "    shown.forEach(function (r) { els.list.appendChild(cardNode(r, ts)); });",
    "    els.pages.replaceChildren();",
    "    add(els.pages, pagesNode(total));",
    "    els.empty.hidden = total > 0;",
    "    var lookup = els.empty.querySelector(\"a\");",
    "    if (lookup) {",
    "      // The page wrote the link's target; only its q parameter changes here.",
    "      var target = new URL(lookup.getAttribute(\"href\"), location.href);",
    "      target.searchParams.set(\"q\", state.query);",
    "      lookup.href = target.href;",
    "      lookup.textContent = T.lookupTemplate.split(\"{q}\").join(state.query);",
    "    }",
    "    for (var i = 0; i < els.views.length; i++) {",
    "      els.views[i].setAttribute(\"aria-pressed\", String(els.views[i].getAttribute(\"data-view\") === state.view));",
    "    }",
    "    var sortSel = document.getElementById(\"is-sort\");",
    "    if (sortSel) sortSel.value = state.sf + \",\" + state.sd;",
    "    var rppSel = document.getElementById(\"is-rpp\");",
    "    if (rppSel) rppSel.value = String(state.rpp);",
    "  }",
    "",
    "  // ── Wiring ───────────────────────────────────────────────────────────────",
    "  els.form.addEventListener(\"submit\", function (e) {",
    "    e.preventDefault();",
    "    var q = els.input.value.trim();",
    "    go(withChange(function (s) { s.query = q; s.page = 1; }), true);",
    "  });",
    "  var sortSel = document.getElementById(\"is-sort\");",
    "  SORTS.forEach(function (o) { sortSel.appendChild(h(\"option\", { value: o.sf + \",\" + o.sd, text: o.label })); });",
    "  sortSel.addEventListener(\"change\", function () {",
    "    var v = sortSel.value.split(\",\");",
    "    go(withChange(function (s) { s.sf = v[0]; s.sd = v[1]; s.page = 1; }), true);",
    "  });",
    "  var rppSel = document.getElementById(\"is-rpp\");",
    "  PER_PAGE.forEach(function (n) { rppSel.appendChild(h(\"option\", { value: n, text: String(n) })); });",
    "  rppSel.addEventListener(\"change\", function () {",
    "    var n = parseInt(rppSel.value, 10);",
    "    go(withChange(function (s) { s.rpp = n; s.page = 1; }), true);",
    "  });",
    "  for (var v = 0; v < els.views.length; v++) {",
    "    els.views[v].addEventListener(\"click\", function (e) {",
    "      var view = e.currentTarget.getAttribute(\"data-view\");",
    "      go(withChange(function (s) { s.view = view; }), false);",
    "    });",
    "  }",
    "",
    "  /* Links carry real URLs (so they open in a new tab and can be copied);",
    "     a plain click is handled here without reloading the page. */",
    "  root.addEventListener(\"click\", function (e) {",
    "    var a = e.target.closest ? e.target.closest(\"a\") : null;",
    "    if (a && root.contains(a) && (a.hasAttribute(\"data-facet\") || a.hasAttribute(\"data-range-min\") || a.hasAttribute(\"data-page\") || a.hasAttribute(\"data-nav\"))) {",
    "      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;",
    "      e.preventDefault();",
    "      go(readFrom(a.getAttribute(\"href\")), true);",
    "      if (a.hasAttribute(\"data-page\")) els.status.scrollIntoView({ block: \"start\" });",
    "      return;",
    "    }",
    "    var b = e.target.closest ? e.target.closest(\"button\") : null;",
    "    if (!b) return;",
    "    if (b.hasAttribute(\"data-more\")) {",
    "      var k = b.getAttribute(\"data-more\");",
    "      var f = FACETS.filter(function (x) { return x.key === k; })[0];",
    "      expanded[k] = (expanded[k] || f.show) + f.show;",
    "      render();",
    "    } else if (b.hasAttribute(\"data-less\")) {",
    "      delete expanded[b.getAttribute(\"data-less\")];",
    "      render();",
    "    } else if (b.classList.contains(\"is-toggle\")) {",
    "      var abs = b.previousElementSibling;",
    "      var open = abs.classList.toggle(\"clamp\") === false;",
    "      b.textContent = open ? T.showLess : T.showMore;",
    "      b.setAttribute(\"aria-expanded\", String(open));",
    "    }",
    "  });",
    "  root.addEventListener(\"submit\", function (e) {",
    "    if (!e.target.hasAttribute(\"data-range\")) return;",
    "    e.preventDefault();",
    "    var min = parseInt(e.target.elements.min.value, 10) || 0;",
    "    var max = parseInt(e.target.elements.max.value, 10) || 0;",
    "    if (min && max && min > max) { var t = min; min = max; max = t; }",
    "    go(withChange(function (s) { s.min = min; s.max = max; s.page = 1; }), true);",
    "  });",
    "  root.addEventListener(\"input\", function (e) {",
    "    var k = e.target.getAttribute && e.target.getAttribute(\"data-find\");",
    "    if (!k) return;",
    "    finding[k] = e.target.value;",
    "    var pos = e.target.selectionStart;",
    "    render();",
    "    var again = root.querySelector('[data-find=\"' + k + '\"]');",
    "    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (x) {} }",
    "  });",
    "  function readFrom(href) {",
    "    var i = href.indexOf(\"?\");",
    "    return readUrl(i < 0 ? \"\" : href.slice(i));",
    "  }",
    "  window.addEventListener(\"popstate\", function () { state = readUrl(); render(); });",
    "",
    "  state = readUrl();",
    "  render();",
    "})();",
    ""
  ].join("\n");
  const upstream = catalogue().totalItemsUpstream;
  return `
<style>
  /* The search page, after iris.who.int/search: filters at the start, results beside them. */
  .is-layout { display: grid; grid-template-columns: 17rem minmax(0, 1fr); gap: 2rem; margin-top: 1.2rem; }
  .is-side h2, .is-main h2 { font-size: 1.35rem; margin: 0 0 0.8rem; color: var(--iris-heading); }
  .is-facet { border-bottom: 1px solid var(--iris-edge); padding: 0.55rem 0 0.7rem; }
  .is-facet summary { font-weight: 700; cursor: pointer; color: var(--iris-ink); padding: 0.15rem 0; }
  .is-values { list-style: none; margin: 0.4rem 0 0; padding: 0; }
  .is-values a { display: flex; gap: 0.45rem; align-items: baseline; padding: 0.2rem 0; color: var(--iris-link); font-size: 0.92rem; line-height: 1.3; }
  .is-values a[aria-current] { font-weight: 700; }
  .is-check { flex: none; color: var(--iris-muted); }
  .is-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .is-count {
    flex: none; font-size: 0.75rem; font-weight: 700; color: #fff; background: var(--iris-muted);
    border-radius: 10px; padding: 0.05rem 0.45rem; min-width: 1.8rem; text-align: center;
  }
  .is-more { display: flex; gap: 0.8rem; }
  .is-more button, .is-toggle {
    background: none; border: 0; padding: 0.25rem 0; color: var(--iris-link); cursor: pointer; font: inherit; font-size: 0.88rem;
  }
  .is-more button:hover, .is-toggle:hover { text-decoration: underline; }
  .is-find, .is-range input, .is-settings select {
    width: 100%; padding: 0.35rem 0.5rem; border: 1px solid var(--iris-edge); border-radius: 4px;
    background: var(--iris-paper); color: var(--iris-ink); font: inherit; font-size: 0.9rem; margin-top: 0.35rem;
  }
  .is-range { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.4rem; align-items: end; margin-top: 0.3rem; }
  .is-range label { font-size: 0.82rem; color: var(--iris-muted); }
  .is-range button {
    padding: 0.38rem 0.6rem; border: 1px solid var(--iris-accent); background: var(--iris-accent); color: #fff;
    border-radius: 4px; cursor: pointer; font: inherit; font-size: 0.85rem;
  }
  .is-settings { margin-top: 1.4rem; }
  .is-settings label { display: block; font-weight: 700; margin-top: 0.7rem; font-size: 0.92rem; }
  .is-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.6rem; }
  .is-views { display: inline-flex; border: 1px solid var(--iris-edge); border-radius: 4px; overflow: hidden; }
  .is-views button {
    background: var(--iris-paper); color: var(--iris-ink); border: 0; padding: 0.35rem 0.6rem; cursor: pointer; font: inherit; font-size: 0.85rem;
  }
  .is-views button + button { border-inline-start: 1px solid var(--iris-edge); }
  .is-views button[aria-pressed="true"] { background: var(--iris-accent); color: #fff; }
  .is-status { color: var(--iris-muted); font-size: 0.92rem; margin: 0.4rem 0 1rem; }
  .is-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 0.9rem; }
  .is-chip {
    display: inline-flex; gap: 0.3rem; align-items: center; font-size: 0.85rem; padding: 0.2rem 0.65rem;
    border-radius: 14px; background: var(--iris-tag-bg); color: var(--iris-heading);
  }
  .is-chip.is-reset { background: none; border: 1px solid var(--iris-edge); color: var(--iris-link); }
  .is-results { list-style: none; margin: 0; padding: 0; }
  .is-results.is-list { display: flex; flex-direction: column; gap: 1.6rem; }
  .is-results.is-list .is-card { display: flex; gap: 1.2rem; align-items: flex-start; }
  .is-results.is-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 1.2rem; }
  .is-results.is-grid .is-card { border: 1px solid var(--iris-edge); border-radius: 4px; padding: 0.8rem; background: var(--iris-paper); }
  .is-results.is-grid .is-cover { margin-bottom: 0.6rem; }
  .is-cover { flex: 0 0 104px; }
  .is-cover img { width: 104px; height: auto; display: block; border: 1px solid var(--iris-edge); }
  .is-cover .nocover {
    display: flex; align-items: center; justify-content: center; width: 104px; height: 140px;
    border: 1px dashed var(--iris-edge); color: var(--iris-muted); font-size: 0.78rem; text-align: center; line-height: 1.3;
  }
  .is-body { flex: 1; min-width: 0; }
  .is-title { font-size: 1.02rem; line-height: 1.35; text-decoration: underline; overflow-wrap: anywhere; }
  .is-by { margin: 0.35rem 0 0.4rem; font-size: 0.9rem; }
  .is-abs { margin: 0; font-size: 0.93rem; line-height: 1.5; }
  .is-abs.clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .is-results.is-grid .is-abs.clamp { -webkit-line-clamp: 5; }
  .is-results mark { background: #fff3a8; color: inherit; padding: 0 0.05em; }
  .is-pages { list-style: none; display: flex; flex-wrap: wrap; gap: 0.25rem; padding: 0; margin: 1.8rem 0 0; }
  .is-pages a, .is-pages span {
    display: block; min-width: 2.3rem; text-align: center; padding: 0.35rem 0.55rem;
    border: 1px solid var(--iris-edge); border-radius: 4px; background: var(--iris-paper);
  }
  .is-pages .active a { background: var(--iris-accent); border-color: var(--iris-accent); color: #fff; }
  .is-pages .disabled span { color: var(--iris-muted); }
  .is-empty { padding: 1rem; border: 1px solid var(--iris-edge); border-radius: 4px; background: var(--iris-wash); }
  @media (prefers-color-scheme: dark) {
    :root:not([data-fa-scheme="light"]) .is-results mark { background: #5c4a00; }
  }
  :root[data-fa-scheme="dark"] .is-results mark { background: #5c4a00; }
  @media (max-width: 800px) {
    .is-layout { grid-template-columns: minmax(0, 1fr); gap: 1rem; }
    .is-side { order: 2; }
    .is-results.is-list .is-card { flex-direction: column; }
  }
</style>

<div id="iris-search">
<form class="searchbar" id="iris-search-form" action="search.html" method="get" role="search">
  <input type="text" id="iris-search-input" name="query"
    placeholder="${esc(t("Search through the repository’s {n} items", { n: upstream !== undefined ? String(upstream) : "?" }))}"
    aria-label="${esc(t("Search the repository"))}" autocomplete="off" spellcheck="false">
  <button type="submit">${t("Search")}</button>
</form>
<p class="searchnote">${t("This page searches the {held} items catalogued here, in your browser; upstream IRIS holds {upstream}. The filters are IRIS’s own; their values and counts are computed from the current results.", {
    held: num(items.length),
    upstream: upstream !== undefined ? num(upstream) : "?",
  })}</p>

<div class="is-layout">
  <aside class="is-side" aria-labelledby="is-filters-h">
    <h2 id="is-filters-h">${t("Filters")}</h2>
    <div id="is-facets"></div>
    <div class="is-settings">
      <h2>${t("Settings")}</h2>
      <label for="is-sort">${t("Sort By")}</label>
      <select id="is-sort"></select>
      <label for="is-rpp">${t("Results per page")}</label>
      <select id="is-rpp"></select>
    </div>
  </aside>
  <section class="is-main" aria-labelledby="is-results-h">
    <div class="is-head">
      <h2 id="is-results-h">${t("Search Results")}</h2>
      <div class="is-views" role="group">
        <button type="button" data-view="list" aria-pressed="true">&#9776; ${t("List view")}</button>
        <button type="button" data-view="grid" aria-pressed="false">&#9638; ${t("Grid view")}</button>
      </div>
    </div>
    <p class="is-status" id="is-status" role="status" aria-live="polite"></p>
    <div id="is-chips"></div>
    <ul id="is-results" class="is-results is-list"></ul>
    <div class="is-empty" id="is-empty" hidden>
      <p>${t("Your search returned no results.")}</p>
      <p><a href="${toSiteRoot()}../id-lookup/?index=who-iris/"></a></p>
    </div>
    <div id="is-pages"></div>
  </section>
</div>
</div>
<script type="application/json" id="iris-search-data">${json(records)}</script>
<script type="application/json" id="iris-search-strings">${json(strings)}</script>
<script>
${client}</script>
`;
}

/**
 * The same three states as {@link coverCell}, as data for the search page,
 * which builds its elements in the browser rather than parsing HTML. A
 * line break in a placeholder is a newline.
 */
function coverData(n: Node): { href: string; src: string; w: number; h: number; alt: string } | { text: string; title: string } {
  const cov = coverSrc(n);
  const withheldBy = coverWithheld(n);
  const br = (s: string): string => s.replace(/<br>/g, "\n");
  if (withheldBy) return { text: br(t("cover<br>withheld")), title: t("A cover is rendered and held here. It is not published: {gates}.", { gates: withheldBy }) };
  if (!cov) return { text: t("no cover"), title: t("no cover rendered") };
  if (!COVERS_SHOWN) {
    return { text: br(t("cover<br>withheld")), title: t("A cover is rendered and recorded for this item. It is not displayed: the publication's cover carries the WHO emblem, and this replica is not published under WHO.") };
  }
  return {
    href: itemHref(n),
    src: cov.src,
    w: cov.w,
    h: cov.h,
    alt: cov.masked
      ? t("Cover of {title}, rendered here from page 1 of the held PDF, with the WHO emblem masked out", { title: n.title })
      : t("Cover of {title}, rendered here from page 1 of the held PDF", { title: n.title }),
  };
}

/**
 * An item's cover cell: the image, or a placeholder saying why there is none.
 * Shared by Recent Submissions and the search page's result cards.
 */
function coverCell(n: Node): string {
  const cov = coverSrc(n);
  // Three states, not two. A withheld cover and an absent one look the same
  // in a layout and mean opposite things about the catalogue.
  const withheldBy = coverWithheld(n);
  return withheldBy
    ? `<span class="nocover" title="${esc(t("A cover is rendered and held here. It is not published: {gates}.", { gates: withheldBy }))}">${t("cover<br>withheld")}</span>`
    : !cov
    ? `<span class="nocover" title="${esc(t("no cover rendered"))}">${t("no cover")}</span>`
    : COVERS_SHOWN
      ? `<a href="${esc(itemHref(n))}"><img src="${esc(cov.src)}" width="${cov.w}" height="${cov.h}"
        alt="${esc(cov.masked
          ? t("Cover of {title}, rendered here from page 1 of the held PDF, with the WHO emblem masked out", { title: n.title })
          : t("Cover of {title}, rendered here from page 1 of the held PDF", { title: n.title }))}" loading="lazy"></a>`
      : `<span class="nocover" title="${esc(t("A cover is rendered and recorded for this item. It is not displayed: the publication's cover carries the WHO emblem, and this replica is not published under WHO."))}">${t("cover<br>withheld")}</span>`;
}

/**
 * One row of Recent Submissions, laid out as the capture lays it out.
 *
 * Cover at the left, title as a link, then the author line with the publication
 * date in parentheses, then the abstract. The capture shows a "Show more"
 * control under a truncated abstract; this truncates in CSS and says so in the
 * title attribute rather than shipping a disclosure widget, because the owner
 * asked for *"a special viusalize … dont need working functionality, just
 * links to working assets."*
 *
 * Every string here comes from the Dublin Core record. **Where the record is
 * silent the row says so rather than falling back to the node's title** — R15
 * generalised: a plausible substitute is worse than a stated absence, because
 * a reader cannot tell it apart from a transcription.
 */
function submission(n: Node): string {
  const a = assetHref(n);
  const authors = dc(n, "contributor", "author");
  const issued = day(dc(n, "date", "issued")[0]);
  const abstract = dc(n, "description", "abstract")[0];
  const cite = dc(n, "identifier", "citation")[0] ?? dc(n, "identifier", "govdoc")[0];
  const lang = langOf(n);

  const byline = [
    authors.length ? data(authors.join("; "), lang) : `<span class="none">${t("no author recorded")}</span>`,
    `(${[cite ? data(cite, lang) : undefined, issued ? t("Publication Date: {date}", { date: data(issued) }) : undefined]
      .filter(Boolean)
      .join(", ")})`,
  ].join(" ");

  const coverHtml = coverCell(n);

  return `<article class="sub">
  <div class="sub-cover">${coverHtml}</div>
  <div class="sub-body">
    <a class="sub-title"${dataBlock(lang)} href="${esc(itemHref(n))}">${esc(n.title)}</a>
    <p class="sub-by">${byline}</p>
    ${
      abstract
        ? `<p class="sub-abs"${dataBlock(lang)}>${esc(abstract)}</p>`
        : `<p class="sub-abs none">${t("No <code>dc.description.abstract</code> in the captured record.")}</p>`
    }
    <p class="sub-links">${
      a
        ? linkOrWithheld(a, true)
        : `<span class="none">${t("not held here")}</span>`
    }</p>
  </div>
</article>`;
}

/** Where the skill itself is readable, for a reader who wants the full text. */
const SKILL_BLOB = `https://github.com/litlfred/who-iris/blob/main/skills/iris-dspace.md`;

/**
 * Markdown inline spans → HTML, for text that came out of the skill.
 *
 * Escaped FIRST, then marked up, so a `<` in a requirement stays a `<`. This
 * is not a markdown implementation and does not pretend to be one: it handles
 * the four spans the requirements table actually uses, and anything else
 * passes through as the literal text it is, which is the failure mode you
 * want from a renderer you are trusting with authored content.
 *
 * A RELATIVE link is rewritten onto the GitHub blob. The skill sits at
 * `who-iris/skills/`, these pages at `who-iris/docs/`, and the page is served
 * from two different mount routes — so a relative href that resolves in the
 * repository resolves to nothing on the site. Better a link that leaves for
 * GitHub than one that 404s in place.
 */
function inlineMd(md: string): string {
  let h = esc(md);
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, href: string) => {
    // Only http(s), in-page and relative links are links; another scheme
    // (javascript:, data:) is refused and its text is shown on its own.
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^https?:/i.test(href)) return text;
    const abs = /^[a-z]+:|^#/.test(href)
      ? href
      : `${SKILL_BLOB.replace(/\/who-iris\/skills\/iris-dspace\.md$/, "")}/who-iris/skills/${href}`;
    return `<a href="${esc(abs)}">${text}</a>`;
  });
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return h;
}

type Requirement = { id: string; requirement: string; why: string };

/**
 * The requirements, read out of the skill.
 *
 * **Refuses rather than renders an empty table.** A projection that silently
 * produces nothing when its source moves is the `check-catalogue` defect in
 * another costume — an edge to nothing that reads as a relationship. If the
 * table is renamed, restructured or emptied, this throws and the gate goes
 * red, which is a message; a page reading "0 findings" is a lie.
 */
export function requirementsFromSkill(md: string): Requirement[] {
  const out: Requirement[] = [];
  for (const line of md.split("\n")) {
    const m = /^\|\s*\*\*(R\d+)\*\*\s*\|(.+?)\|(.+?)\|\s*$/.exec(line);
    if (m) out.push({ id: m[1]!, requirement: m[2]!.trim(), why: m[3]!.trim() });
  }
  if (out.length === 0) {
    throw new Error(
      "who-iris/skills/iris-dspace.md: no `| **Rn** | … | … |` rows found. " +
        "The ingestion-notes page is a projection of that table — if the table " +
        "moved, move this parser with it rather than shipping an empty page.",
    );
  }
  return out;
}

/**
 * What ingesting the IRIS documents actually cost, as a page.
 *
 * Every row here was paid for in this repository: a guessed parent, an
 * invented UUID, a GB that was a GiB, three `materialized` claims resolving to
 * no bytes. They are written down in the skill so the next AGENT is stopped by
 * them, and rendered here so a PERSON can see what the ingestion is standing
 * on without reading a skill file.
 */
function ingestionNotes(reqs: Requirement[], all: Node[]): string {
  const items = all.filter((n) => n.flavour === "item");
  const held = items.filter((n) => assetHref(n) !== undefined).length;

  const rows = reqs
    .map(
      (r) =>
        `<tr><th class="rid">${esc(r.id)}</th><td>${inlineMd(r.requirement)}</td>` +
        `<td class="why">${inlineMd(r.why)}</td></tr>`,
    )
    .join("\n");

  return `
<h1>What ingesting these documents cost</h1>

<p class="lede">Every rule below was learned by getting it wrong here first. They live in
<code>who-iris/skills/iris-dspace.md</code> — <a href="${SKILL_BLOB}">read the skill</a> —
and this page is generated from that file, so the two cannot drift. There are
<strong>${reqs.length}</strong> of them, against <strong>${items.length}</strong> item(s) in the
catalogue, <strong>${held}</strong> of which this repository actually holds the bytes for.</p>

<div class="caveat">
  <p><strong>Why a page and not just a skill.</strong> A skill is read by an agent about
  to act. A reader deciding whether to <em>trust</em> what was ingested needs the same
  facts and will not open a skill file to get them. Same text, two audiences, one
  source — the skill.</p>
</div>

<h2>Requirements a record can be checked against</h2>
<table class="reqs">
  <thead><tr><th>#</th><th>Requirement</th><th>Why, in one line</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>

<h2>Settled 2026-09-21 — bean <code>yl5w</code></h2>
<p>Every ORIGINAL <code>localPath</code> in this catalogue named
<code>who-iris/uploads/</code> while the bytes sat in <code>cat-harness/uploads/</code>,
and <code>check:catalogue</code> did not look at <code>localPath</code> at all — so
three <code>materialized</code> claims resolved to nothing while the gate printed
<em>clean</em>. The three sources now sit beside their own intake records at
<code>who-iris/uploads/&lt;slug&gt;/</code>, the page generator's fallback is deleted,
and <code>check:catalogue</code> verifies every <code>localPath</code> — with
<em>could not determine</em> as its own answer, because an unreadable file is not a
missing one.</p>

<p><code>iris.who.int</code> is egress-blocked from the environment that generates this
page, so nothing here was fetched from IRIS. Every record was transcribed from a capture
the owner supplied. Where a transcription is partial, the record says so.</p>
`;
}

/**
 * The CRDM page: this instance as a worked example of the general pattern.
 *
 * Owner, 2026-09-20:
 *
 * > *"update skils, this is doing webportal mockup as part of CRDM of kg.
 * > based on custom assets with need to defin a data ingestion pirpeline
 * > (subject ot operational/deployment constrsaints, $, network traffic,
 * > graph seize etc), from KG into a public portal. this is ecample creating
 * > a CDN to sit behind moodle … also add to /docs for who-iris. make a nice
 * > image to illustate architecture. bpmn for process. also generalize skils
 * > and tools."*
 *
 * **The generalisation lives in the platform and this page points at it.** The
 * skill is `kg-to-portal`, the process is `kg-to-portal.bpmn`, and the drawing
 * is `cat-harness/docs/assets/img/`. What is HERE is the only thing who-iris
 * can say that the platform cannot: which stages this instance has actually
 * built, with its own numbers, and which it has not.
 *
 * Every figure below is read out of the catalogue or off the filesystem at
 * generation time. None is written down — the sticky banner on every page of
 * this site carried three hand-typed counts until 2026-09-20 and one of them
 * was already wrong.
 */
function kgToPortal(all: Node[]): string {
  const items = all.filter((n) => n.flavour === "item");
  const held = items.filter((n) => assetHref(n) !== undefined);
  const cat = catalogue();

  // What this instance actually ships, measured rather than asserted.
  const heldBytes = held
    .map((n) => assetHref(n)?.bytes ?? 0)
    .reduce((a, b) => a + b, 0);
  // BOTH sides, since the 2026-09-21 split: the replica is site-side and
  // the documentation is docs-side, and "how many pages does this instance
  // ship" is a question about the instance rather than about one directory.
  const htmlIn = (dir: string): number =>
    existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".html")).length : 0;
  const pages = htmlIn(SITE) + htmlIn(DOCS);
  // The covers the replica SHOWS — which are exactly the covers the mount
  // publishes, since bean `2b5s` publishes a page's embedded assets and not
  // the directory they sit in. This counted `docs/assets/covers/`, a
  // directory the covers left in `yl5w`, so it reported 0 over three.
  const covers = all.filter((n) => coverSrc(n) !== undefined).length;

  const svg = existsSync(ARCH_SVG)
    ? stripXmlComments(readFileSync(ARCH_SVG, "utf-8")
        .replace(/^<\?xml[^>]*\?>\s*/, ""))
        .replace("GDHCN — DID trustlist (WHO SMART Trust)", "WHO signing DID — did:web + x5c chain")
    : undefined;

  // The badge borrows the materialisation COLOURS and none of its words. A
  // stage is built, partial or not built; a bitstream is materialized,
  // referenced or unknown. They are different vocabularies over the same three
  // shades, and printing "MATERIALIZED" next to "Serialize" would invite a
  // reader to look for bytes that a build stage does not have.
  const SHADE = { built: "materialized", partial: "unknown", "not built": "referenced" } as const;
  const stage = (n: number, name: string, state: keyof typeof SHADE, what: string) =>
    `<tr><th class="rid">${n}</th><td><strong>${esc(name)}</strong><br><span class="why">${what}</span></td>` +
    `<td><span class="state ${SHADE[state]}">${esc(state)}</span></td></tr>`;

  return `
<h1>From this catalogue to somebody else&rsquo;s portal</h1>

<p class="lede">This instance is a <strong>worked example</strong> of a general pattern: a knowledge
graph reaching readers the repository never hears about. The pattern is the platform&rsquo;s —
the skill is <code>kg-to-portal</code> and the process is
<code>kg-to-portal.bpmn</code>. What is on this page is the part only who-iris can
say: which stages are actually built here, with this instance&rsquo;s own numbers.</p>

${svg ? `<figure class="arch">${svg}<figcaption>Six stages in three zones. The publisher owns the canonical URL; the cache owns neither end. The dashed arrow is undetermined on purpose.</figcaption></figure>` : `<p class="none">The architecture drawing could not be read from the platform. Not rendered rather than rendered empty &mdash; a missing figure is a finding.</p>`}

<h2>The one distinction the drawing exists for</h2>

<div class="caveat">
  <p><strong>A CDN is not a publication host. It is a layer in front of one.</strong>
  <code>PUBLICATION_HOSTS</code> answers <em>what serves the rendering</em>; a cache
  answers <em>what stands between the server and the reader</em>. Model the cache as the
  host and the published URL becomes the cache&rsquo;s &mdash; then the day the cache changes,
  every citation breaks and the old URL stays warm for as long as its TTL says.</p>
  <p>This page is served from GitHub Pages and its assets are also reachable through
  jsDelivr. <strong>Both are tool choices.</strong> The canonical answer is the one the
  catalogue records; the CDN is an accelerated route to the same bytes.</p>
</div>

<h2>Where this instance actually is</h2>

<table class="reqs">
  <thead><tr><th>#</th><th>Stage</th><th>Here</th></tr></thead>
  <tbody>
${stage(1, "Select", "partial", "Everything in this catalogue is publishable, so the editorial cut has never had to refuse anything. An untested filter is not a working one.")}
${stage(2, "Serialize", "built", `<code>kg-export</code> emits the harness graph as JSON-LD; this instance&rsquo;s catalogue is ${all.length} nodes with ${items.length} item(s).`)}
${stage(3, "Package", "not built", "There is no manifest. The pages and assets are published individually, so nothing here can detect a file that was <em>removed</em>.")}
${stage(4, "Sign", "not built", "Nothing on this preview site is signed. The catalogue records a <code>sha256</code> per bitstream, which is a digest and not an attestation &mdash; anyone who can change the bytes can change the digest beside them. On the Cloudflare CDN export, each item and each release is signed with a detached JWS (ES256) under a <strong><code>did:web</code></strong> key whose <code>publicKeyJwk.x5c</code> chains to WHO&rsquo;s signing DID; see below.")}
${stage(5, "Distribute", "built", `${pages} generated page(s) and ${covers} cover(s) on GitHub Pages, with a jsDelivr route to the same bytes.`)}
${stage(6, "Verify", "not built", "No consumer verifies anything, because there is nothing signed to verify. This is the stage that gets dropped, and it is dropped here.")}
  </tbody>
</table>

<h2>The numbers a transport decision would be made with</h2>

<p class="ordering">Constraints need denominators. These are this instance&rsquo;s, measured at
generation time &mdash; not quoted, not remembered.</p>

<table class="reqs">
  <tbody>
    <tr><th class="rid">items</th><td>${items.length} here, of <strong>${cat.totalItemsUpstream?.toLocaleString("en-US") ?? "unknown"}</strong> upstream</td><td class="why">the completeness denominator</td></tr>
    <tr><th class="rid">files</th><td>${cat.totalFilesUpstream?.toLocaleString("en-US") ?? "unknown"} upstream</td><td class="why">a different denominator; 3.86 files per item, so a fraction built from the wrong one is wrong by that factor</td></tr>
    <tr><th class="rid">bytes</th><td><strong>${esc(mb(heldBytes))}</strong> held, of ${cat.totalBytesUpstream !== undefined ? esc(gb(cat.totalBytesUpstream)) : "unknown"} upstream</td><td class="why">the size-gate denominator, and the reason this catalogue is by reference</td></tr>
    <tr><th class="rid">served</th><td>${pages} page(s), ${covers} cover(s)</td><td class="why">what a publication period would actually move</td></tr>
    <tr><th class="rid">readers</th><td><span class="none">not measured</span></td><td class="why">traffic is bytes &times; requests, and nothing here counts requests. Unknown rather than assumed &mdash; an invented reader count would make every cost figure below it fiction</td></tr>
  </tbody>
</table>

<h2>Trust: <code>did:web</code> + <code>x5c</code> chained to WHO&rsquo;s signing DID</h2>

<p>Owner decision, 2026-10-30 (superseding the earlier GDHCN trustlist sketch):
the IRIS CDN export is signed with a subordinate P-256 key published as a
<code>verificationMethod</code> of a <a href="https://www.w3.org/TR/did-core/">W3C <code>did:web</code> DID document</a>
whose <code>publicKeyJwk.x5c</code> certificate chain ends at <strong>WHO&rsquo;s signing DID</strong>
(<code>did:web:raw.githubusercontent.com:WorldHealthOrganization:tng-participants-prod:main:WHO:signing:DID</code>).
<strong>No GDHCN trust list is assumed.</strong> See
<a href="iris-cdn-signing-options.html">IRIS CDN Exporter: signing options</a> and
<a href="iris-cdn-export.html">IRIS CDN Exporter: processes</a>.</p>

<ul class="kids" style="margin-left:0">
  <li><strong>Package and digests (RFC 8493).</strong> Each release is a BagIt 1.0 bag
      (<code>bagit.txt</code>, date-free <code>bag-info.txt</code>, sorted
      <code>manifest-sha256.txt</code>, and <code>tagmanifest-sha256.txt</code>).</li>
  <li><strong>Per-item and per-release detached JWS (RFC 7515 Appendix F, ES256).</strong>
      Each changed library item has its own manifest at
      <code>items/&lt;handle&gt;/manifest-sha256.txt</code> and detached signature
      <code>manifest-sha256.txt.jws</code>; the release signs
      <code>tagmanifest-sha256.txt</code> as <code>tagmanifest-sha256.txt.jws</code>.</li>
  <li><strong>Independent verification.</strong> A verifier resolves the signer&rsquo;s
      <code>did:web</code> document from its HTTPS origin, checks that <code>kid</code> is
      listed in <code>assertionMethod</code>, verifies the ES256 signature, and validates the
      <code>x5c</code> certificate chain up to WHO&rsquo;s signing-DID public key.</li>
</ul>

<h2>Publishing a large graph: skeleton, payloads, one SQLite file per slice</h2>

<p>A corpus the size of IRIS can only be searched on the client if the client never
downloads the whole graph. The platform&rsquo;s answer is <strong>late
materialization</strong>. The graph is published as three things:</p>

<ol class="kids" style="margin-left:0">
  <li><strong>The skeleton, as JSON-LD.</strong> Each named subgraph &mdash; a directory of a
      declared graph &mdash; is published at <code>/subgraph/&lt;harness&gt;/&lt;path&gt;/</code> as
      <code>index.jsonld</code> (pointers to its members and child subgraphs) and
      <code>index.hydrated.jsonld</code> (every member inline, with metadata only). The root
      has the pointer file only, so no single file is ever the whole graph.</li>
  <li><strong>Payloads, by content address.</strong> Heavy content &mdash; a body, a PDF, a page
      of sections &mdash; lives at <code>/payload/sha256/&lt;hex&gt;</code>, named by the hash of its
      bytes, with a <code>&lt;hex&gt;.json</code> sidecar giving its media type. A node carries a
      <code>payload</code> link with <code>sha256</code> and <code>bytes</code>, so a consumer can
      decide whether to fetch before it fetches.</li>
  <li><strong>Per-slice SQLite.</strong> CI flattens one slice into a relational schema:
      one table per node type, one table per relation, and a contentless FTS5 index. It
      publishes the result as <code>&lt;slice&gt;.&lt;sha256&gt;.sqlite3</code>, named by the
      hash of its bytes, with a <code>&lt;slice&gt;.sqlite3.json</code> manifest at a fixed path
      beside it that names the file. A row holds only the payload
      pointer, never the payload. The browser downloads the file, checks its sha256 against the
      manifest, imports it into the Origin Private File System, and opens it with the official
      SQLite WASM build. Nothing is parsed.</li>
</ol>

<p>The contract is in the <code>kg-export</code> skill, under &ldquo;Named subgraphs&rdquo;,
&ldquo;Payloads&rdquo; and &ldquo;Per-slice SQLite&rdquo;. The procedure is the
<code>slice-sqlite-publish</code> process. This page does not restate that contract&rsquo;s
rules; where the two differ, the skill is right.</p>

<h3>Measured: the four pilots</h3>

<p class="ordering">These are the platform&rsquo;s own slices, not this catalogue&rsquo;s. They
were measured on 2026-10-03 (bean <code>q8ar</code>). The first open was measured in Chromium
on loopback against a plain static server with no COOP/COEP headers, and includes the download
and the sha256 check.</p>

<table class="reqs">
  <thead><tr><th>slice</th><th>file</th><th>source as published</th><th>first open</th></tr></thead>
  <tbody>
    <tr><th class="rid">beans</th><td>2.83 MB</td><td>4.82 MB of bean files</td><td>~190 ms</td></tr>
    <tr><th class="rid">todos</th><td>0.07 MB</td><td>18 KB of JSON</td><td>~110 ms</td></tr>
    <tr><th class="rid">library</th><td>2.48 MB</td><td>3.59 MB of JSON</td><td>~165 ms</td></tr>
    <tr><th class="rid">kg</th><td>3.40 MB</td><td>3.03 MB of JSON-LD (the whole-repo graph, without bodies)</td><td>~180 ms</td></tr>
  </tbody>
</table>

<p>The VFS is <code>opfs-sahpool</code>, running in a Worker. It needs neither
SharedArrayBuffer nor COOP/COEP, which GitHub Pages cannot send. Reopening from OPFS took about
85&nbsp;ms, with no download. Without a Worker or OPFS, the verified bytes are opened in memory
instead, and the page reports which mode it used.</p>

<div class="caveat">
  <p><strong>No who-iris slice is built, and none of these numbers is a who-iris
  number.</strong> Nothing here was measured against a CDN, either: <code>cdn.jsdelivr.net</code>
  is egress-blocked from the container that generates this page.</p>
</div>

<h3>The slice budget, and what to do above it</h3>

<p><strong>As built:</strong> the budget is about 5&nbsp;MB per file
(<code>SIZE_BUDGET_BYTES</code>). It is reported in the manifest as <code>overBudget</code>
and is not gated. The process says what to do over budget: try the no-body variant first, then
stop and report the measurement. All four pilots are under it.</p>

<p><strong>Why IRIS will not fit one slice.</strong> This is arithmetic on the pilots, not a
measurement. The pilots hold between ${(3.40 * 1024 / 3121).toFixed(1)}&nbsp;KB per node
(<code>kg</code>, 3,121 nodes) and ${(2.83 * 1024 / 723).toFixed(1)}&nbsp;KB per row
(<code>beans</code>, 723 rows). At those rates, ${cat.totalItemsUpstream ? `the ${cat.totalItemsUpstream.toLocaleString("en-US")} upstream items would make one file of roughly ${Math.round(cat.totalItemsUpstream * 3.40 / 3121)} to ${Math.round(cat.totalItemsUpstream * 2.83 / 723)}&nbsp;MB, before any per-bitstream row. That is about ${Math.round(cat.totalItemsUpstream * 3.40 / 3121 / 5)} to ${Math.round(cat.totalItemsUpstream * 2.83 / 723 / 5)} times the budget.`: "no size can be estimated, because the upstream item count is unknown."}</p>

<p><strong>Recommended, not built: split by subgraph.</strong> A slice is one
<code>SliceDef</code>, and nothing in the builder requires a slice to be a whole graph. A
DSpace community or collection is already a directory-shaped subgraph, so the natural cut is
one slice per community or collection. If one of those is still over budget, split it at the
next level down. Do not split by row count: a slice should match a subgraph IRI a reader can
name. Each split slice keeps the full contract, with its own manifest, row digest and
determinism check. A small <strong>routing slice</strong> would let one search span all of IRIS.
It would hold only titles, identifiers and the subgraph each item belongs to, so the client can
then open the one slice that has the rows. That is the skeleton pattern again, one level up.</p>

<h3>CDN caching</h3>

<table class="reqs">
  <thead><tr><th>file</th><th>as built</th><th>recommended behind a CDN</th></tr></thead>
  <tbody>
    <tr><th class="rid">payload</th><td>named by its sha256, so its bytes never change</td><td class="why">cache forever (<code>immutable</code>); a new body is a new URL</td></tr>
    <tr><th class="rid">subgraph JSON-LD</th><td>a stable IRI whose content changes when the graph does</td><td class="why">short TTL; a long one serves an old skeleton whose payload links may have been removed as orphans since</td></tr>
    <tr><th class="rid">slice manifest</th><td><code>&lt;slice&gt;.sqlite3.json</code> at a <strong>fixed</strong> path; it names the slice file; the client fetches it with <code>no-store</code></td><td class="why">short TTL or none; it is the one file that says which build is current</td></tr>
    <tr><th class="rid">slice file</th><td><code>&lt;slice&gt;.&lt;sha256&gt;.sqlite3</code>, named by its sha256, so its bytes never change; OPFS keys its copy by the same sha256</td><td class="why">cache forever (<code>immutable</code>); a new build is a new URL</td></tr>
  </tbody>
</table>

<div class="caveat">
  <p><strong>This section has been corrected twice.</strong> It first said that only the
  manifest needs a short TTL, because the client keys its copy by sha256. That held for the
  browser&rsquo;s OPFS copy, not for a CDN: the slice file was then published at the same path
  every build, so a CDN could serve old bytes against a new manifest, the client would refuse
  them on the sha256 check, and search was down until the cache expired. That is now fixed
  (bean <code>wixl</code>). The slice file is published at
  <code>assets/slices/&lt;slice&gt;.&lt;sha256&gt;.sqlite3</code>, and the manifest&rsquo;s
  <code>file</code> names it. A fresh manifest names a file no cache has seen. A stale one names
  an older file that still matches it.</p>
  <p><strong>Why not under <code>/payload/sha256/</code>:</strong> a payload is a node&rsquo;s
  body, linked from that node and removed once nothing links to it. A slice file is linked from
  no node, so the payload tree would treat it as an orphan. It takes the payload rule that
  matters, immutable bytes at a hash-named address, without joining that tree.</p>
  <p><strong>What a CDN can still hold, as built:</strong> for one manifest TTL, a stale
  manifest together with the older file it names, which is a consistent pair. It can also hold
  an older file that nothing names until that file expires, or a stale manifest whose file the
  origin has stopped serving. The page reports that last case as a 404 and asks for a reload. A
  manifest that names a file with a different sha256 is <strong>refused</strong> with a visible
  message, never opened. Each deploy writes only the current file. Old ones do not pile up on
  the host. GitHub Pages sends <code>max-age=600</code> for every file and cannot be told to send
  anything else, so on Pages the manifest&rsquo;s short TTL is ten minutes.</p>
</div>

<p>No CDN layer has been chosen (bean <code>l9v6</code>, still <em>proposed</em>). Whichever
one is chosen stands <em>in front of</em> the publication host, as above. The slice files and
payloads go out through the same publish-to-CDN step as every other page (bean
<code>7dek</code>, <code>Process_RenderKgToCdn</code>), behind the same four gates (bean
<code>xies</code>). The URL-layout check that <code>xies</code> asks for must therefore cover
<code>/payload/sha256/</code> and <code>assets/slices/</code> too.</p>

<h3>How a client picks a slice</h3>

<p><strong>As built:</strong> <code>assets/slices/index.json</code>
(<code>folio-slice-index/v1</code>) lists every slice built into the site. The one search page,
<code>slices/search.html?slice=&lt;name&gt;</code>, lists them when no slice is named. Given a
name, it reads everything else it needs from the <code>search</code> block of that
slice&rsquo;s manifest. The reader picks. The page checks the name against a pattern before
using it in a path.</p>

<p><strong>Recommended for who-iris, not built:</strong> keep the reader&rsquo;s choice, and
make the choices follow the catalogue&rsquo;s community and collection tree. A reader browsing
a community opens that community&rsquo;s slice, named in its <code>index.jsonld</code>. A
reader searching all of IRIS opens the routing slice first. Several slices can be open at once,
because each is its own file in the pool. What that costs on a phone has not been
measured.</p>

<h2>What is deliberately not decided</h2>

<div class="caveat">
  <p><strong>The ingestion method is undetermined</strong>, and the process diagram reaches a
  gateway with no default branch rather than naming one. A pull from the portal, a push to an
  object store, a git fetch, a signed tarball on a schedule &mdash; they differ in who initiates,
  in what must be reachable from where, and in what happens when a publication is missed.
  Drawing one as the obvious branch would record a decision nobody made.</p>
  <p><strong>The store must be versioned; which store is a deployment choice.</strong> Hosted git
  is one satisfaction of that requirement, not the requirement. A portal showing a graph needs to
  be able to say <em>which</em> graph &mdash; an unversioned store cannot answer &ldquo;what did
  this look like last term&rdquo;, and that is the question a reading list asks every year.</p>
  <p><strong>Nothing here was measured against a live CDN.</strong>
  <code>cdn.jsdelivr.net</code> is egress-blocked from the container that generates these pages,
  so every CDN figure would be quoted rather than measured. The owner confirmed one link by hand
  on 2026-09-20, and that is the whole of the evidence.</p>
</div>

<p><a href="ingestion-notes.html">What ingesting these documents cost</a> &mdash; the
requirements this instance paid for, generated from the skill that records them.</p>
`;
}

/**
 * The docs side's own landing page.
 *
 * @see the owner's ruling, 2026-09-21 — the KG is library-side and the
 * documentation is docs-side, each served by its own cat-harness handler.
 *
 * It is deliberately SHORT and it links nothing across the two mount points.
 * A link from here to the replica would have to be written relative to where
 * the page lands after mounting, which this generator does not know and must
 * not compose; the folio-assistant navbar on the left is what reaches both,
 * which is the whole point of the ruling.
 */
/** An authored markdown page in `docs/`: its file name and its first heading. */
export interface AuthoredDoc {
  file: string;
  title: string;
}

/**
 * The pages in `dir` a PERSON wrote, as opposed to this generator's output:
 * every `.md` but `README.md` (the directory's own description) and any file
 * opening with front matter (a Jekyll page for another route, e.g.
 * `site-home.md`). Bean `mw5z`: the landing page's "Pages" list was
 * hand-kept, knew nothing of `style-guide.md` and `style-guide-agents.md`
 * after bean `qsx4` moved them here, and so under-reported its own directory.
 * Derived, so the next authored page is listed the day it lands.
 */
export function authoredDocs(dir: string): AuthoredDoc[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort()
    .flatMap((file) => {
      const text = readFileSync(join(dir, file), "utf-8");
      if (text.startsWith("---")) return [];
      const heading = /^#\s+(.+?)\s*$/m.exec(text)?.[1];
      return [{ file, title: heading ?? file.replace(/\.md$/, "") }];
    });
}

/** `<name>.md` → `<name>.html`. */
const htmlName = (md: string): string => md.replace(/\.md$/, ".html");

/**
 * One authored page's body: its markdown rendered with GFM (tables, task
 * lists), and every link to a sibling authored page pointed at that page's
 * rendering. Raw HTML in the source is kept, as the platform's own renderer
 * keeps it (`publish-instance-files.ts`): the source is this repository's
 * authored prose, not external data.
 */
export function renderAuthored(markdown: string, siblings: ReadonlySet<string>, repository: string | null = REPOSITORY ?? null): string {
  const html = String(remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).processSync(markdown));
  return html
    .replace(/href="([^"#:/]+\.md)(#[^"]*)?"/g, (whole, file: string, hash?: string) =>
      siblings.has(file) ? `href="${htmlName(file)}${hash ?? ""}"` : whole,
    )
    .replace(/href="(\.\.\/[^"#]*)(#[^"]*)?"/g, (whole, path: string, hash?: string) => {
      const url = outOfDocs(path, hash, repository);
      return url === undefined ? whole : `href="${url}"`;
    });
}

/**
 * The instance's repository, `owner/name`, from its own declaration — so a
 * citation of a file outside `docs/` names the repository the declaration
 * says, and the official copy under WHO's account gets its own links.
 */
const REPOSITORY = ((): string | undefined => {
  const r = (readDeclaration(INSTANCE) as { repository?: unknown } | undefined)?.repository;
  return typeof r === "string" && /^[\w.-]+\/[\w.-]+$/.test(r) ? r : undefined;
})();

/**
 * A link from an authored page in `docs/` to a file OUTSIDE it — the
 * instance's `library/`, `skills/`, its `AGENTS.md` — resolves nowhere on the
 * site, because only `docs/` is mounted there. It becomes the file's address in
 * the repository instead (the rule cat-harness's `renderMountedMarkdown`
 * applies to the pages it renders). A path that climbs out of the instance is
 * left as written; the site build's link check reports it.
 */
function outOfDocs(path: string, hash: string | undefined, repository: string | null): string | undefined {
  if (repository === null) return undefined;
  const target = posix.normalize(posix.join("docs", path));
  if (target === ".." || target.startsWith("../")) return undefined;
  const isDir = path.endsWith("/") || (existsSync(join(INSTANCE, target)) && statSync(join(INSTANCE, target)).isDirectory());
  const clean = target.replace(/\/+$/, "");
  return `https://github.com/${repository}/${isDir ? "tree" : "blob"}/HEAD/${clean}${isDir ? "/" : ""}${hash ?? ""}`;
}

function docsIndex(): string {
  const html = docsIndexListed();
  // Authored pages the list above does not already link (bean `mw5z`), at
  // their RENDERINGS: this generator writes `<name>.html` for each
  // ({@link renderAuthored}), because a .md in this mounted directory would be
  // copied verbatim, never rendered.
  const more = authoredDocs(DOCS).filter((d) => !html.includes(`href="${htmlName(d.file)}"`));
  if (more.length === 0) return html;
  return (
    html +
    `
<h2>Also in this directory</h2>
<ul class="doclist">
${more.map((d) => `  <li><a href="${esc(htmlName(d.file))}">${esc(d.title)}</a></li>`).join("\n")}
</ul>
`
  );
}

function docsIndexListed(): string {
  return `
<h1>who-iris &mdash; documentation</h1>

<p class="lede">What this harness is, what ingesting it cost, and where the
ingested copy is meant to end up. These pages are <em>about</em> the work; the
catalogue itself is served by the library handler, and the replica rendered
from it is this instance&rsquo;s own front page.</p>

<div class="caveat">
  <p><strong>This is not a copy of IRIS.</strong> who-iris models the WHO
  Institutional Repository for Information Sharing <em>by reference</em>:
  ${banner()}. Everything on these pages was transcribed from captures the
  owner supplied &mdash; <code>iris.who.int</code> is not reachable from the
  environment that renders them, so nothing here was fetched. The figures come
  from the catalogue rather than from this sentence, which is why they are the
  same ones the replica shows.</p>
</div>

<h2>Pages</h2>
<ul class="doclist">
  <li>
    <a href="ingestion-notes.html">What ingesting these documents cost</a>
    <p>The requirements the ingestion produced, rendered from
    <code>skills/iris-dspace.md</code> rather than restated &mdash; so the page
    and the skill cannot drift. Includes what the captured DSpace records gave
    that inference could not.</p>
  </li>
  <li>
    <a href="kg-to-portal.html">From this catalogue to somebody else&rsquo;s portal</a>
    <p>The general pattern this instance is a worked example of:
    <em>select &rarr; serialize &rarr; package &rarr; sign &rarr; distribute
    &rarr; verify</em>, with the trust anchors read off the WHO SMART Trust IG
    and the transport left undetermined rather than guessed.</p>
  </li>
  <li>
    <a href="oxigraph-pipeline-requirements.html">Oxigraph multi-graph search pipeline &amp; scale architecture</a>
    <p>System requirements, pipeline placement, multi-graph partition model, and browser WASM SPARQL query engine architecture for WHO-IRIS (with scale plan for 300,000 items and zero binary blobs in RDF).</p>
  </li>
</ul>
`;
}

/**
 * Where `--catalogue-into <site-source>` puts the catalogue viewer: the same
 * conventional route as {@link CATALOGUE_VIEWER}, under a site source this
 * run is GIVEN — bean `kx0p`.
 *
 * Until 2026-10-20 the default run wrote no catalogue page in this
 * instance's own repository, and who-iris's own site published none: the one
 * view of what the catalogue knows and does not know was missing from the
 * site built around it. The default run now commits the page, drawn for the
 * platform's site (it links the library viewer, which that site builds); this
 * one is drawn for who-iris's own site, which builds no library viewer, so the
 * build still writes it here rather than reusing that copy. That site's Jekyll source is the
 * tree `compose-docs --shell` writes, which this repository does not hold, so
 * the build hands it over and only this page is written there — at the
 * route `harnessTiles` discovers, so tiles and links agree without a second
 * answer to where it lives.
 */
export function catalogueInto(siteSource: string): string {
  return join(siteSource, ...ownSiteRoute().split("/"), "index.html");
}

/**
 * The catalogue's route IN WHO-IRIS'S OWN SITE: the declared route with this
 * instance's own name dropped. `compose-docs --instance who-iris` reads every
 * `/who-iris/…` route as this site's own root — the navbar's catalogue tile
 * (`/who-iris/catalogue/`) becomes `/catalogue/` — so the page goes where that
 * link lands, not one level deeper.
 */
function ownSiteRoute(): string {
  const own = `${SUBJECT}/`;
  return CATALOGUE_ROUTE.startsWith(own) ? CATALOGUE_ROUTE.slice(own.length) : CATALOGUE_ROUTE;
}

/**
 * The page is drawn for its declared route; written at {@link ownSiteRoute}
 * its RELATIVE links must say the same targets from the new place. Every
 * relative href/src is re-based; absolute, fragment and Liquid ones are left.
 */
/**
 * The replica's home page, written for this instance's OWN site root (owner,
 * 2026-10-30: "https://litlfred.github.io/who-iris/ should instead be whats
 * under https://litlfred.github.io/who-iris/who-iris/", option A).
 *
 * The page is drawn for the replica's route, so each relative link is read as
 * a platform route and said again from the own site's root. The own site
 * serves every `/<instance>/…` route at its root (the catalogue page is at
 * `catalogue/`, see {@link ownSiteRoute}), EXCEPT the replica's own files,
 * which stay mounted under `<instance>/`. The replica's home itself is this
 * page, so a link to it becomes `./`.
 */
/**
 * An embedded file (`src`) the replica's page takes from the instance, such as
 * a cover in `library/`. The site build publishes it beside the replica, under
 * `/who-iris/`, so from the site root it is addressed under that prefix.
 */
function isFile(p: string): boolean {
  return existsSync(p) && statSync(p).isFile();
}

export function rebaseToOwnSiteRoot(html: string): string {
  const own = `${SUBJECT}/`;
  const rebase = (attr: string, u: string): string | undefined => {
    if (!u || /^(?:[a-z][a-z0-9+.-]*:|\/|#|\{\{|\{%)/i.test(u)) return undefined;
    const [path, ...rest] = u.split(/(?=[?#])/);
    let target = posix.normalize(posix.join(REPLICA_ROUTE, path!));
    if (path!.endsWith("/") && !target.endsWith("/")) target += "/";
    if (target === `${own}index.html` || target === own) target = "./";
    else if (attr === "src" && !target.startsWith(own) && isFile(join(INSTANCE, target))) target = `${own}${target}`;
    else if (target.startsWith(own) && !existsSync(join(INSTANCE, "site", target.slice(own.length)))) target = target.slice(own.length);
    return `${target}${rest.join("")}`;
  };
  // Attributes, AND the JSON the page carries in its scripts: the rail's
  // "On this page" list (`data-fa-visualiser-nav`) and the search index. Only
  // the attributes were re-based, so on the site root those links kept the
  // replica's `../` and climbed out of the site (owner, 2026-10-30: the rail's
  // library links gave 404 at /en/cat-harness/library/who-iris/<slug>/).
  return html
    .replace(/\b(href|src|action)="([^"]*)"/g, (m, attr: string, u: string) => {
      const next = rebase(attr, u);
      return next === undefined ? m : `${attr}="${next}"`;
    })
    .replace(/"href":"([^"\\]*)"/g, (m, u: string) => {
      const next = rebase("href", u);
      return next === undefined ? m : `"href":"${next}"`;
    });
}

export function rebaseRelative(html: string, from: string, to: string): string {
  return html.replace(/\b(href|src)="([^"]*)"/g, (m, attr: string, u: string) => {
    if (!u || /^(?:[a-z][a-z0-9+.-]*:|\/|#|\{\{|\{%)/i.test(u)) return m;
    const [path, ...rest] = u.split(/(?=[?#])/);
    const target = posix.normalize(posix.join(from, path!));
    let next = posix.relative(to, target) || ".";
    if (path!.endsWith("/") && !next.endsWith("/")) next += "/";
    return `${attr}="${next}${rest.join("")}"`;
  });
}

function main(): number {
  if (process.argv.includes("--extract-pot")) {
    extractPot();
    return 0;
  }
  const home = process.argv.indexOf("--home-into");
  if (home >= 0) {
    const site = process.argv[home + 1];
    if (!site || site.startsWith("--") || !existsSync(site)) {
      console.error("--home-into needs an existing site source directory (the tree `compose-docs --shell` wrote)");
      return 2;
    }
    const all = nodes();
    REPLICA_NAV_ALL = all;
    LOCALE = "en";
    const dest = join(resolve(site), "index.html");
    writeFileSync(dest, rebaseToOwnSiteRoot(page("who-iris", [{ label: t("Home") }], landingPage(all), "site", [], "index.html")));
    // The search box's records go beside it: the page fetches them by a
    // sibling-relative name, wherever the page is published.
    writeFileSync(join(resolve(site), HOME_SEARCH_DATA), `${JSON.stringify(homeSearchEntries(all))}\n`);
    console.log(`  wrote ${relative(resolve(site), dest)} and ${HOME_SEARCH_DATA} into the site source`);
    return 0;
  }
  const into = process.argv.indexOf("--catalogue-into");
  if (into >= 0) {
    const site = process.argv[into + 1];
    if (!site || site.startsWith("--") || !existsSync(site)) {
      console.error("--catalogue-into needs an existing site source directory (the tree `compose-docs --shell` wrote)");
      return 2;
    }
    const dest = catalogueInto(resolve(site));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, rebaseRelative(catalogueViewer(nodes(), { libraryViewer: false }), CATALOGUE_ROUTE, ownSiteRoute()));
    console.log(`  wrote ${relative(resolve(site), dest)} into the site source`);
    // The replica's pages, mounted at `/who-iris/`, link the catalogue at its
    // DECLARED route. On this site it lives at its own route instead, so the
    // declared route gets a page that forwards there.
    if (ownSiteRoute() !== CATALOGUE_ROUTE) {
      const fwd = join(resolve(site), ...CATALOGUE_ROUTE.split("/"), "index.html");
      if (!existsSync(fwd)) {
        const to = `${posix.relative(CATALOGUE_ROUTE, ownSiteRoute())}/`;
        mkdirSync(dirname(fwd), { recursive: true });
        // A full document with an explicit <body>: the staging banner (and any
        // other post-processor) inserts into <body> and refuses a page without one.
        writeFileSync(fwd, `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Catalogue</title>\n<meta http-equiv="refresh" content="0; url=${to}">\n<link rel="canonical" href="${to}">\n</head>\n<body>\n<p>The catalogue is at <a href="${to}">${to}</a>.</p>\n</body>\n</html>\n`);
        console.log(`  wrote ${relative(resolve(site), fwd)} (forwards to the catalogue) into the site source`);
      }
    }
    return 0;
  }
  const all = nodes();
  const files = new Map<string, string>();
  /**
   * Pages written OUTSIDE who-iris, keyed by absolute path.
   *
   * A separate map rather than a third key prefix on `files`, for the reason
   * the comment on `LIB`/`DOCS` already gives: the key carries the side, and
   * nothing infers a destination from a filename. A prefix would be an
   * inference, and one that has to be kept in step with the OWNED patterns.
   */
  const siteFiles = new Map<string, string>();
  // DATA beside the pages, keyed like `files` — the home search index each
  // language's `index.html` fetches. Not pages, so not under the page guard.
  const dataFiles = new Map<string, string>();

  // KEYED BY SIDE, not by name. Both sides need an `index.html` — the replica
  // needs one because it is a site, and the docs side needs one because
  // `mount-instance-docs.ts` will not mount a directory without it — so a map
  // keyed on the bare name can hold only one of them.

  files.set(
    "docs/index.html",
    page("who-iris — documentation", [{ label: "Documentation" }], docsIndex(), "docs", ["catalogue"]),
  );

  // The authored pages, rendered (bean `mw5z`, owner's option 1).
  const authored = authoredDocs(DOCS);
  const authoredFiles = new Set(authored.map((d) => d.file));
  for (const d of authored) {
    files.set(
      `docs/${htmlName(d.file)}`,
      page(
        d.title,
        [{ label: "Documentation", href: "index.html" }, { label: d.title }],
        renderAuthored(readFileSync(join(DOCS, d.file), "utf-8"), authoredFiles),
        "docs",
      ),
    );
  }

  files.set(
    "docs/kg-to-portal.html",
    page(
      "From this catalogue to somebody else's portal",
      [{ label: "Documentation", href: "index.html" }, { label: "KG to portal" }],
      kgToPortal(all),
      "docs",
    ),
  );

  files.set(
    "docs/ingestion-notes.html",
    page(
      "What ingesting these documents cost",
      [{ label: "Documentation", href: "index.html" }, { label: "Ingestion notes" }],
      ingestionNotes(requirementsFromSkill(readFileSync(SKILL, "utf-8")), all),
      "docs",
    ),
  );

  /* THE CATALOGUE VIEWER IS NOT A DOCS PAGE, and moving it settles which.
   *
   * It was `docs/catalogue.html` until 2026-09-22 (bean `ha78`, issue #886):
   * built, declared, resolving — and linked by nothing, because a ref inside a
   * mounted tree is not one `harnessTiles` can strip a site prefix off. Its own
   * declaration already argued it is "the KG view, NOT the replica", so the
   * docs side was the wrong side for it on the declaration's own terms.
   *
   * THE BREADCRUMB LOSES ITS HREF, deliberately. It was
   * `{ href: "index.html" }` — sibling-relative, which resolved to who-iris's
   * docs index while the page sat beside it and resolves to THIS PAGE from the
   * new route. There is no safe replacement: the docs index lives on a mount
   * route, and a site-root-relative link is wrong under a baseurl and wrong
   * again under `/branches/<branch>/`. Inventing one here would be guessing at
   * the cross-route problem #879 is solving properly; a crumb that reads as a
   * link and returns you to where you already are is worse than a plain label.
   */
  // THEMED since 2026-10-07 (catalogueViewer): on the platform's site, it
  // wears that site's layout rather than the replica's page chrome. Drawn for
  // its declared route, where the site publishes it.
  siteFiles.set(CATALOGUE_VIEWER, ((page: string) => (page.startsWith("---\n") ? withRenderedByFrontMatter(page, VIEWER_TOOL) : withRenderedBy(page, VIEWER_TOOL)))(catalogueViewer(all)));

  // THE REPLICA'S HOME PAGE, ONCE PER LANGUAGE (issue #2228), and nothing
  // else of the replica. Owner, 2026-10-30: the item pages duplicated the
  // library entry pages without a locale in the URL ("i want consitent
  // bevarioior for things nuders librayr/"), so they are gone and the old
  // addresses 404; the community list and collection pages went with them.
  // The IRIS-style home stays (the owner's follow-up, option A): its items
  // link to their library entry pages and its communities and collections to
  // the catalogue page. The orphan sweep below prunes the rest, because
  // PAGES.site still owns those names.
  REPLICA_NAV_ALL = all;
  for (const locale of ["en", ...SITE_LOCALES] as Locale[]) {
    LOCALE = locale;
    const at = locale === "en" ? "site" : `site/${locale}`;
    files.set(`${at}/index.html`, page("who-iris", [{ label: t("Home") }], landingPage(all), "site", [], "index.html"));
    dataFiles.set(`${at}/${HOME_SEARCH_DATA}`, `${JSON.stringify(homeSearchEntries(all))}\n`);
    files.set(`${at}/search.html`, page(t("Search"), [{ label: t("Home"), href: "index.html" }, { label: t("Search") }], searchPage(all), "site", [], "search.html"));
  }
  LOCALE = "en";

  const check = process.argv.includes("--check");
  let stale = 0;
  // The catalogues are checked with the pages, because a page built from a
  // stale or partial catalogue is a stale page: `iris:pages:check` is the one
  // gate, as it was before there was anything to translate.
  const drift = check ? catalogueProblems() : { problems: [], notes: [] };
  /* ONE LOOP OVER BOTH MAPS, reported repo-relative.
   *
   * `--check` has to cover the site-side page exactly as it covers the two
   * instance-side ones. A viewer that only the write path knows about is a
   * viewer CI cannot tell is stale, which is the `voices` defect this
   * repository spent 2026-09-22 on: a committed generated artefact nobody
   * re-derived, asserting a number no generator would emit.
   */
  /* THE GUARD THAT A LIST CANNOT BE: every page is owned by ITS OWN SIDE.
   *
   * `catalogue.html` was written to `docs/` while `OWNED_DOCS` did not name
   * it, so the orphan sweep could never reclaim it (bean `o6vj`, issue #895).
   * The existing test did not catch this because it asked the UNION — and
   * `OWNED` did contain `catalogue`, so it passed. The per-side property is
   * the one that was missing.
   *
   * Asserted at WRITE TIME rather than in a test, and that is the point: a
   * list of expected pages goes stale silently and is edited by whoever
   * remembers, which is how six enumerations of this one fact accumulated.
   * A check that runs on every invocation — including `--check` in CI —
   * cannot. Adding a page to a side its pattern does not own now fails
   * immediately, naming the page and the side.
   */
  for (const key of files.keys()) {
    const slash = key.indexOf("/");
    const side = key.slice(0, slash) as Side;
    const name = key.slice(slash + 1);
    if (!SIDES.includes(side)) {
      throw new Error(
        `gen-iris-pages: "${key}" names side "${side}", which is not one of ` +
          `${SIDES.join(", ")}. The map key carries the side; it cannot be invented.`,
      );
    }
    if (!ownedOn(side).test(name)) {
      throw new Error(
        `gen-iris-pages: writing "${key}", but the ${side} side does not OWN "${name}" ` +
          `(${ownedOn(side).source}). An unowned page is one the orphan sweep can never ` +
          `reclaim — exactly the \`catalogue.html\` defect (issue #895). Add it to ` +
          `PAGES.${side}.fixed, or write it to the side that owns it.`,
      );
    }
  }
  const targets: { abs: string; rel: string; html: string }[] = [
    ...[...files].map(([key, html]) => ({
      abs: join(INSTANCE, key),
      rel: `who-iris/${key}`,
      html,
    })),
    // folio-assistant's CHROME GOES ON THE SITE SIDE ONLY — bean `edx7`.
    //
    // The split is already here and it is the right one. `siteFiles` are
    // the site's viewers of this catalogue (since 2026-10-20 committed under
    // this instance's own site directory, published at their declared route),
    // and the owner named the catalogue viewer as a page that SHOULD carry the
    // site's navigation: since 2026-10-07 it is themed, so the theme's layout
    // brings it and there is no rail to inject. `files` are the REPLICA,
    // copied to look like IRIS; folio-assistant's chrome on those would be
    // the opposite of what a replica is for.
    // The mount's withheld list, beside the pages it protects (bean `cw35`).
    { abs: join(LIB, "withheld.json"), rel: "who-iris/library/withheld.json", html: withheldManifest(nodes()) },
    ...[...siteFiles].map(([abs, html]) => ({
      abs,
      rel: relative(REPO_ROOT, abs),
      html,
    })),
    ...[...dataFiles].map(([key, html]) => ({ abs: join(INSTANCE, key), rel: `who-iris/${key}`, html })),
  ];
  for (const { abs, rel, html } of targets) {
    const prev = existsSync(abs) ? readFileSync(abs, "utf-8") : undefined;
    if (prev === html) continue;
    if (check) {
      console.error(`stale or missing: ${rel}`);
      stale++;
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, html);
  }

  // ── ORPHANS ────────────────────────────────────────────────────────────
  //
  // **This generator wrote and never deleted, and that is a defect rather
  // than a gap.** Re-keying two items from `item/local:<slug>` to their real
  // DSpace UUIDs (2026-09-20) left `item-item-local-*.html` behind: nine files
  // where seven were wanted, two of them serving the OLD record at a URL
  // nothing links to any more. `--check` was blind to it, because it only ever
  // inspected the files it was about to write — so it reported "up to date"
  // over content the catalogue no longer describes.
  //
  // That is the `yl5w` shape pointed the other way. There, a claim resolved to
  // no file; here, a file answers to no claim.
  //
  // Pruning is scoped to THIS GENERATOR'S OWN NAMING, never to the directory:
  // a page somebody hand-added, a `.nojekyll`, an asset directory, all survive.
  // Precedent is `prunableStickies` in `ensure-landing-sticky.ts`, which prunes
  // its own output for the same reason.
  // Per DIRECTORY, each against the pattern it owns there. One combined
  // pattern would prune a docs page out of `library/` and vice versa — which
  // is exactly what the split exists to stop, and the failure would look like
  // a successful clean-up.
  /**
   * This generator's output sitting in the wrong directory for what it is.
   *
   * `ownedHere` is subtracted, and that is not a refinement — `index.html` is
   * legitimately on both sides, so without it the first sweep past `docs/`
   * deletes the docs index every run and the directory stops mounting.
   */
  const wrongSide = (dir: string, ownedElsewhere: RegExp, ownedHere: RegExp): string[] =>
    existsSync(dir)
      ? readdirSync(dir).filter((f) => ownedElsewhere.test(f) && !ownedHere.test(f)).sort()
      : [];
  const orphansIn = (dir: string, owned: RegExp): string[] =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => owned.test(f) && !files.has(`${basename(dir)}/${f}`))
          .sort()
      : [];
  const orphans = [
    ...orphansIn(SITE, OWNED_SITE).map((f) => ({ dir: SITE, name: f, rel: `who-iris/site/${f}` })),
    ...orphansIn(DOCS, OWNED_DOCS).map((f) => ({ dir: DOCS, name: f, rel: `who-iris/docs/${f}` })),
    // The pages that CHANGED SIDES, and the predicate here is deliberately
    // NOT the one above. A page carrying the other side's name does not belong
    // in this directory AT ALL — whether or not it is currently being written
    // somewhere else. The first draft asked `!files.has(name)` here too, and
    // every stale copy survived: `index.html` is being written to `library/`,
    // so the docs-side copy looked live and stayed exactly where the owner did
    // not want it. Caught by listing the directory afterwards rather than by
    // trusting the sweep.
    ...wrongSide(DOCS, OWNED_SITE, OWNED_DOCS).map((f) => ({ dir: DOCS, name: f, rel: `who-iris/docs/${f}` })),
    ...wrongSide(SITE, OWNED_DOCS, OWNED_SITE).map((f) => ({ dir: SITE, name: f, rel: `who-iris/site/${f}` })),
    // `library/` IS CORPUS ONLY (bean `2b5s`), so no page of this generator's
    // belongs there at all. This is the sweep with teeth: an `index.html` left
    // in `library/` is what made the mount copy the whole corpus to two
    // published routes, so a stale one is pruned rather than tolerated.
    ...wrongSide(LIB, OWNED, /(?!)/).map((f) => ({ dir: LIB, name: f, rel: `who-iris/library/${f}` })),
    // Each language's copy, swept the same way inside its own directory.
    ...SITE_LOCALES.flatMap((loc) => {
      const dir = join(SITE, loc);
      return existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => OWNED_SITE.test(f) && !files.has(`site/${loc}/${f}`))
            .sort()
            .map((f) => ({ dir, name: f, rel: `who-iris/site/${loc}/${f}` }))
        : [];
    }),
  ];

  if (check) {
    for (const o of orphans) console.error(`orphaned: ${o.rel}`);
    for (const d of drift.problems) console.error(`translation: ${d}`);
    if (stale || orphans.length || drift.problems.length) {
      const bits = [
        stale ? `${stale} page(s) stale` : "",
        orphans.length ? `${orphans.length} orphaned` : "",
        drift.problems.length ? `${drift.problems.length} translation problem(s)` : "",
      ].filter(Boolean).join(", ");
      console.error(`\n${bits}. Run: bun run who-iris/scripts/gen-iris-pages.ts`);
      return 1;
    }
    // `targets.length`, NOT `files.size` — the site-side viewer is checked and
    // has to be counted, or a clean run reports 10 while 11 were verified. A
    // summary that undercounts what it checked is the mirror of one that
    // overcounts: both leave a reader unable to tell coverage from omission.
    console.log(`gen-iris-pages --check: ${targets.length} page(s) up to date, no orphans.`);
    console.log(`  translations (${SITE_STRINGS.length} strings): ${drift.notes.join("; ")}`);
    return 0;
  }

  for (const o of orphans) rmSync(join(o.dir, o.name));

  const site = [...files.keys()].filter((k) => k.startsWith("site/"));
  // (Each language's pages are under site/<locale>/ and counted with site/.)
  const docs = [...files.keys()].filter((k) => k.startsWith("docs/"));
  console.log(`wrote ${site.length} page(s) to who-iris/site/ and ${docs.length} to who-iris/docs/`);
  for (const key of [...site, ...docs]) console.log(`  who-iris/${key}`);
  for (const o of orphans) console.log(`  pruned ${o.rel}`);
  return 0;
}

if (import.meta.main) process.exit(main());
