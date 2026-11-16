/**
 * One IG → one Jekyll source for the just-the-docs pipeline, with the IG
 * Publisher's `site.data.fhir` populated (bean `bamf`).
 *
 * ## Why one site per IG (owner, 2026-09-30)
 *
 * An IG's pages say `{{ site.data.fhir.packageId }}`, not `site.data.fhir.<ig>`:
 * the Publisher builds one IG per Jekyll site, so `_data/fhir.json` names ONE
 * IG. The owner chose to keep that shape rather than rewrite the pages: each IG
 * gets its own Jekyll source and its own `_data/fhir.json`, so the pages render
 * unchanged under the Publisher and under just-the-docs alike.
 *
 * ## What it stages, from an IG source repository
 *
 * | from | to | why |
 * |---|---|---|
 * | `input/pagecontent/*.md` | `<page>.md` with front matter | the pages; title, parent and order from `sushi-config.yaml` `pages:` |
 * | `input/includes/*`, `input/pagecontent/*`, `input/images/*.svg` | `_includes/` | the Publisher resolves `{% include %}` against all three, so pages include each other and inline SVGs |
 * | `input/images/**` | the site root, subdirectories kept | the Publisher publishes them there, so pages say `<img src="x.png">` or `<script src="demo/app.js">`; an `.svg` is published minified losslessly (`svg-minify.ts`) — except a `.json`/`.jsonld` that does not parse, which is left out and reported: publishing a broken data file under our site blocks the deploy, and whose file it is cannot be told from a file no parser can read |
 * | `input/images-source/*.plantuml` | `_includes/<name>.svg` | the Publisher RENDERS these; rendered here with `--plantuml-jar`, otherwise a visible "not rendered" marker, reported |
 * | the artefact index (`--artifacts`) | `_includes/list-(simple-)?<types>.xhtml` | the Publisher GENERATES these lists of an IG's artefacts of one type; written here as Liquid over `site.data.fhir.artifact_lists`, so any IG with an index gets them (bean `9hfi`) |
 * | `ig-site-data` over the source | `_data/fhir.json` | `site.data.fhir.*`, only what is sourced |
 * | `input/data/*` (`.yml`/`.yaml`/`.json`/`.csv`/`.tsv`, and directories) | `_data/` | the Publisher's Jekyll reads them as `site.data.<stem>`; a key two sources define keeps the harness's and is a QA finding (bean `yy4u`) |
 * | — | `_config.yml` | just-the-docs, one site |
 * | the layer's declared `webpage` theme | `_sass/color_schemes/ig.scss` | just-the-docs' own colour-scheme mechanism, so the IG wears its palette with the machinery unchanged (bean `u3cd`) |
 *
 * Nothing is inferred that the source does not say: a page with no `pages:`
 * entry keeps its file name as title and is reported, and every field
 * `ig-site-data` cannot source is reported undetermined, never written empty.
 *
 * Usage:
 *   bun run fhir-harness/scripts/build-ig-site.ts --ig-src <IG repo> --out <jekyll source> \
 *     [--baseurl /<site>/<ig>] [--plantuml-jar <plantuml.jar>] [--menu <menu.json>] [--remote-theme <owner/repo@ref>] \
 *     [--artifacts <dir>] [--artifacts-href <path>]
 *   bun run fhir-harness/scripts/build-ig-site.ts --dedupe-ids <built site>   # after jekyll build
 *
 * @module fhir-harness/scripts/build-ig-site
 */

import { EDIT_LINKS_RUNTIME } from "../../cat-harness-tools/src/core/edit-links.js";
import { safeSegment } from "../../cat-harness-tools/src/core/safe-path.js";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import type { QaResult } from "../../cat-harness-tools/scripts/qa-results.ts";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { astImplementationGuide, describeSiteData, igSiteData, type IgSiteDataResult } from "./ig-site-data";
import { defaultPackageCache, DEPENDENCY_FRAGMENTS, dependencyRows, fromImplementationGuide, fromSushiConfig, type DependencyRow } from "./ig-dependencies.ts";
import { readAst } from "./ig-ast.ts";
import { copyDeclared, igReadScope, onlyDeclared } from "./ig-read-scope.ts";
import { questionnaireFormPages, type FormPage } from "./questionnaire-form.ts";
import { minifySvgBytes } from "./svg-minify.ts";
import { GLOBALS_FRAGMENT, globalsFromImplementationGuide, globalsFromSushiConfig } from "./ig-globals.ts";
import { artifactPageName } from "../schemas/fhir-artifact-index.js";
import { wrapRaw } from "../../cat-harness-tools/scripts/lib/liquid-raw.ts";
import type { IgReleases } from "../schemas/ig-releases.ts";
import { astFooterData, IG_QA_PAGE, igSiteFooter, sushiFooterData, type IgFooterData, type IgSiteFooter } from "./ig-footer.ts";
import { thinIndexPage } from "./ig-thin-pages.ts";
import { localiseMenu, menuLabels, menuLocales, type MenuLocale } from "./ig-menu-translations.ts";
import { dirFor, hasTranslation, localeFrontMatter, pageLocales, pageReview, relinkForLocale, resolveLangFragments, SOURCE_LOCALE, translateWithIncludes, TRANSLATION_META_LIQUID, unreviewedLabel, unreviewedNoticeLiquid } from "./ig-page-translations.ts";
import { IG_SEARCH_CSS, IG_SEARCH_INDEX_FILE, IG_SEARCH_SCRIPT_FILE, igSearchBox, igSearchScript, type IgSearchRef } from "./ig-search.ts";
import { withRenderedBy } from "../../cat-harness-tools/scripts/viewer-declarations.js";
import { NAVBAR_LINKED } from "../../cat-harness-tools/scripts/lib/harness-rail.ts";
import { MARKER as FOLIO_MOUNT_MARKER } from "../../cat-harness-tools/scripts/folio-mount.ts";
import { DEFAULT_ICON } from "../../cat-harness-tools/scripts/thin-page.ts";
import { PAGE_BAR_CLASS, PAGE_LAYOUT_CSS_FILE, PAGE_LAYOUT_CSS_SOURCE, PAGE_LAYOUT_JS_FILE, PAGE_LAYOUT_JS_SOURCE, PAGE_LAYOUT_MARK, PAGE_MAIN_CLASS } from "../../cat-harness-tools/scripts/page-layout.ts";
import { indexReadPath } from "./lib/ig-index-at.ts";

/** One page's navigation, from `sushi-config.yaml` `pages:`. */
export interface PageNav {
  title: string;
  parent?: string;
  navOrder: number;
  /** In the site, reachable by link, but not in the navigation. */
  navExclude?: boolean;
  hasChildren?: boolean;
}

/** An IG's published navigation, as `folio-ig-menu/v1` records it. */
export interface IgMenu {
  /**
   * A group with `href` and no items is a top-level PAGE (`Home: index.html`
   * in `sushi-config.yaml`), which `ingest-ig-menu.ts` records as such: it is
   * drawn as a link, not as a dropdown, and gets no section page.
   */
  groups: Array<{ label: string; href?: string; items?: Array<{ label: string; href: string }> }>;
}

/** A top-level menu entry that is itself a page: an href and no children. */
const isMenuPage = (g: IgMenu["groups"][number]): g is IgMenu["groups"][number] & { href: string } =>
  typeof g.href === "string" && g.href.length > 0 && !(g.items?.length);

export interface MenuNav {
  nav: Map<string, PageNav>;
  /** One section page per menu group: file stem → its items. */
  groups: Array<{ stem: string; label: string; items: Array<{ label: string; href: string }> }>;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The IG's OWN menu as the site's navigation: each group a section page, each
 * item a child in the menu's order. A group has no page of its own in the IG
 * (it is a dropdown), and just-the-docs needs a parent page, so one is made
 * that lists the group's items.
 */
export function menuNav(menu: IgMenu): MenuNav {
  const nav = new Map<string, PageNav>();
  const groups: MenuNav["groups"] = [];
  menu.groups.forEach((g, gi) => {
    if (isMenuPage(g)) {
      // The entry IS a page: it takes the menu's place in the navigation,
      // and no section page stands in for it.
      const page = basename(g.href, extname(g.href));
      if (!nav.has(page)) nav.set(page, { title: g.label, navOrder: gi + 1 });
      return;
    }
    const stem = `menu-${slug(g.label)}`;
    nav.set(stem, { title: g.label, navOrder: gi + 1, hasChildren: true });
    groups.push({ stem, label: g.label, items: g.items ?? [] });
    (g.items ?? []).forEach((it, ii) => {
      const page = basename(it.href, extname(it.href));
      if (!nav.has(page)) nav.set(page, { title: it.label, parent: g.label, navOrder: ii + 1 });
    });
  });
  return { nav, groups };
}

/**
 * Flatten sushi's nested `pages:` into title, parent title and order. Keys are
 * the generated file names (`index.md`, `overview.md`); a nested map's keys are
 * children of the page that holds them.
 */
export function pageNav(pages: unknown): Map<string, PageNav> {
  const out = new Map<string, PageNav>();
  let order = 0;
  const walk = (node: unknown, parent?: string) => {
    if (!node || typeof node !== "object") return;
    for (const [file, spec] of Object.entries(node as Record<string, unknown>)) {
      if (file === "title" || file === "generation") continue;
      const s = (spec ?? {}) as Record<string, unknown>;
      const title = typeof s.title === "string" ? s.title : basename(file, extname(file));
      out.set(basename(file, extname(file)), { title, ...(parent ? { parent } : {}), navOrder: ++order });
      walk(s, title);
    }
  };
  walk(pages);
  return out;
}

const yamlString = (s: string) => JSON.stringify(s);

/** Front matter for a page: title, parent and order, as just-the-docs reads them. */
export function frontMatter(nav: PageNav): string {
  return [
    "---",
    `title: ${yamlString(nav.title)}`,
    ...(nav.parent ? [`parent: ${yamlString(nav.parent)}`] : []),
    `nav_order: ${nav.navOrder}`,
    ...(nav.hasChildren ? ["has_children: true"] : []),
    ...(nav.navExclude ? ["nav_exclude: true"] : []),
    "---",
    "",
  ].join("\n");
}

/**
 * Write one staged page: its own front matter kept with `data` added, or the
 * navigation's front matter with `data` added. Page variables are written as
 * JSON flow mappings (YAML is a superset of JSON).
 */
function writePage(to: string, body: string, data: Record<string, unknown>, nav: PageNav): void {
  const dataLines = Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(v)}\n`).join("");
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, body.startsWith("---\n") ? `---\n${dataLines}${body.slice(4)}` : frontMatter(nav).replace(/---\n$/, `${dataLines}---\n`) + body);
}

export interface StageResult {
  pages: string[];
  /** Translated copies of the pages, `<locale>/<page>.md`, from the IG's page catalogues (fhir-harness#382). */
  translated?: string[];
  /** Pages the Publisher generates, written here from data this build holds (`toc`, `artifacts`). */
  generated: string[];
  /** Pages a fill was written into, and each fill whose marker no page holds — reported, never dropped. */
  fills?: { filled: string[]; unused: string[] };
  /** The lifted per-artefact variables: how many artefacts, and which `elements__*` keys no source holds. */
  variables?: { artifacts: number; notSourced: string[] };
  /** Pages the navigation source does not list: titled by file name (and, with a menu, kept out of the nav). */
  unlisted: string[];
  /** Menu items pointing at a page this source does not hold (the Publisher generates it). */
  menuMissing: string[];
  includes: number;
  images: number;
  /** `input/images` SVGs published minified (`svg-minify.ts`): how many, and the bytes that saved. */
  svgMinified?: { files: number; saved: number };
  /** Diagrams rendered from `input/images-source/*.plantuml`. */
  rendered: string[];
  /** The Publisher's artefact lists (`list-(simple-)?<types>.xhtml`) a page includes, written from the artefact index (bean `9hfi`). */
  listed: string[];
  /** Included files the source does not hold and nothing rendered: a marker stands in. */
  notRendered: string[];
  /** Include names that are not a single safe path segment: REFUSED, nothing written for them. */
  refusedIncludes: string[];
  /** The Publisher's dependency tables (`dependency-table*.xhtml`) a page includes, written from `site.data.fhir.dependencies` (bean `4475`). */
  dependencyTables: string[];
  /** The Publisher's global profiles table, written from `site.data.fhir.globals` when a page includes it: where the rows came from, and how many. */
  globals?: { from: string; rows: number };
  /** Where the dependency rows came from, how many, and how many packages the cache did not hold. */
  dependencies?: { from: string; rows: number; unresolved: string[] };
  /** `input/images` data files (`.json`, `.jsonld`) that do not parse: not published, with the parser's reason. */
  unparseable: string[];
  /** `input/images` files not published because a later site step writes that path (`file (step)`). */
  reserved: string[];
  /** Links the IG's source writes to an artefact's flat Publisher page (`ValueSet-X.html`), pointed at this site's artefact page instead. */
  relinked: number;
  /** Annexes appended to their pages (`page <- file`). */
  annexed?: string[];
  /** Annexes whose page this IG does not have: NOT placed. */
  unplaced?: string[];
  /** Links a page makes to a `.html` page no source or build serves: the IG's own dead links, REPORTED (#2235). */
  deadLinks: string[];
  /** The footer every page draws (`site.data.fhir.footer`), for the pages a later step writes from JSON (`assets/ig-footer.json`). */
  footer: IgSiteFooter;
  /** The QA report page (`qa.md`, {@link StageOptions.qaPage}): written, or why not. */
  qa?: "written" | "the IG's source holds its own qa page";
  /** The colour scheme written from the layer's palette; undefined when none was declared. */
  scheme: ColourScheme | undefined;
  siteData: IgSiteDataResult;
  /** The AST's resources as `site.data.canonicals` and `site.data["<Type>-<id>"]`; undefined when there is no AST. */
  astData?: { canonicals: number; resources: number } | { why: string };
  /** One LHC-Forms form-view page per Questionnaire in the AST (skill `fhir-questionnaire-wireframe`, `questionnaire-form.ts`); a reason when the AST could not be read for them. */
  forms?: FormPage[] | { why: string };
  /** The local template's `includes/` directory (`ig.ini` `template = #<dir>`), relative to the source, and how many files it gave `_includes/`. */
  templateIncludes?: { dir: string; files: number };
  /** `input/data/*` staged into `_data/`, and every `site.data` key two sources defined (bean `yy4u`). */
  data: { staged: string[]; overwrites: DataOverwrite[] };
}

/**
 * Point the IG source's links to an artefact page at THIS site's copy.
 *
 * The Publisher writes every artefact page flat beside the narrative pages,
 * so the IG's own prose links `ValueSet-Domains.html`. This site keeps them
 * under `pagesHref` (`artifact/`), so those links 404 unless rewritten.
 * Only a bare relative link whose page name IS an artefact page is touched —
 * in a markdown link target or an `href` — so a narrative page that happens
 * to share a name is never redirected. Measured on the WHO SMART Trust IG at `25771f6`
 * (bean `mftp`): 34 such links over 4 artefacts.
 */
export function relinkArtifacts(text: string, pageNames: ReadonlySet<string>, pagesHref: string): { text: string; count: number } {
  let count = 0;
  // A CASE-ONLY mismatch resolves to the one page it can mean. The WHO SMART Trust IG's
  // `hcert_spec.md` links `StructureDefinition-hcert.html` where the artefact
  // is `HCert`: dead on any case-sensitive host, the IG's own included (6 links,
  // #2235). Only a UNIQUE case-insensitive match is taken; two candidates
  // differing only in case leave the link as written.
  const byLower = new Map<string, string | null>();
  for (const n of pageNames) byLower.set(n.toLowerCase(), byLower.has(n.toLowerCase()) ? null : n);
  const out = text.replace(/(\]\(|href=["'])([A-Za-z0-9][A-Za-z0-9._-]*)\.html(?=[#)"'?])/g, (whole, pre: string, name: string) => {
    const page = pageNames.has(name) ? name : byLower.get(name.toLowerCase());
    if (!page) return whole;
    count++;
    return `${pre}${pagesHref}${page}.html`;
  });
  return { text: out, count };
}

/**
 * The same, for a link a TEMPLATE builds: `href="Requirements-{{requirement.id}}.html"`
 * has no page name to look up until Liquid runs, so it is matched on the
 * resource type before the `{{`. Only a type that has artefact pages here is
 * touched. Measured on the WHO SMART Trust IG's local template (2026-10-09): links to
 * `Requirements-…` and `CapabilityStatement-…` pages, written this way.
 */
export function relinkTemplatedArtifacts(text: string, types: ReadonlySet<string>, pagesHref: string): { text: string; count: number } {
  let count = 0;
  const out = text.replace(/(\]\(|href=["'])([A-Z][A-Za-z]+)-(?=\{\{)/g, (whole, pre: string, type: string) => {
    if (!types.has(type)) return whole;
    count++;
    return `${pre}${pagesHref}${type}-`;
  });
  return { text: out, count };
}

/**
 * The IG Publisher's LOCAL template's includes, when `ig.ini` names one
 * (`template = #<dir>`). The Publisher puts a template's `includes/` in
 * `_includes/` under the IG's own `input/includes`, so a page can include a
 * template fragment by name. The WHO SMART Trust IG's `system-actors.md` includes
 * `actordefinition-short-summary.liquid` from `local-template/includes/`, and
 * that fragment reads the AST's `site.data`. Until this, it was a "not
 * rendered" marker although its source was in the checkout (2026-10-09).
 *
 * A template named by package (`template = who.template.root#current`) is not
 * in the checkout and is not looked for. The directory name is a plain path
 * segment; anything else is ignored rather than followed.
 */
export function localTemplateIncludes(src: string): string | undefined {
  const ini = join(src, "ig.ini");
  if (!existsSync(ini)) return undefined;
  const m = /^[ \t]*template[ \t]*=[ \t]*#[ \t]*([A-Za-z0-9_-][A-Za-z0-9._-]*)[ \t]*$/m.exec(readFileSync(ini, "utf-8"));
  if (!m || m[1]!.includes("..")) return undefined;
  const dir = join(src, m[1]!, "includes");
  return existsSync(dir) && statSync(dir).isDirectory() ? dir : undefined;
}

/**
 * Point a page's links to the IG Publisher's DOWNLOADS at the IG's published
 * site. `downloads.md` links `package.tgz` and `definitions.json.zip` beside
 * itself because the Publisher writes them there; this build renders pages,
 * not packages, so those links resolved to nothing (7 per IG, measured on
 * the WHO SMART Immunizations IG fork's site, 2026-10-05). The published IG at the
 * sushi `canonical` serves the same files. Only a bare relative `.zip`/`.tgz`
 * name is touched: an archive is a Publisher output by construction here,
 * and a path, a query or an absolute URL is the author's and is left alone.
 */
export function relinkPublisherOutputs(text: string, publishedBase: string): { text: string; count: number } {
  let count = 0;
  const base = publishedBase.replace(/\/$/, "");
  const out = text.replace(/(\]\(|href=["'])([A-Za-z0-9][A-Za-z0-9._-]*\.(?:zip|tgz))(?=[)"'])/g, (_w, pre: string, file: string) => {
    count++;
    return `${pre}${base}/${file}`;
  });
  return { text: out, count };
}

/**
 * Point a staged `input/images/<dir>/*.html` file's links to the HL7 IG Publisher
 * template's chrome assets (`fhir.css`, `fhir-table-scripts.js`,
 * `assets/{css,js,ico}/*`) at the IG's published site (`canonical`).
 *
 * A pre-rendered HTML page under `input/images/` (such as the WHO SMART Trust
 * IG's `input/images/openapi/index.html`) links the Publisher template's root
 * assets via `../` relative paths (`../../fhir.css`, `../../assets/...`). This
 * build wears the host site's chrome and does not emit the HL7 template's
 * assets, so without rewriting they climb out of the IG's directory to the
 * host site root and 404 (#2741). Sibling links (`./swagger-ui.css`,
 * `index.css`) stay relative.
 */
export function relinkPublisherTemplateAssets(html: string, publishedBase: string): { text: string; count: number } {
  let count = 0;
  const base = publishedBase.replace(/\/$/, "");
  const out = html.replace(
    /((?:href|src)=["'])(?:\.\.\/)+(fhir\.css|fhir-table-scripts\.js|assets\/(?:css|js|ico)\/[^"'\s]+)(?=["'])/g,
    (_w, pre: string, asset: string) => {
      count++;
      return `${pre}${base}/${asset}`;
    },
  );
  return { text: out, count };
}

/**
 * Pages only the IG Publisher writes, beside the IG's own (its QA report, the
 * full TOC, the search form). This build does not produce them; the published
 * IG at the sushi `canonical` does, so a link to one goes there (#2235:
 * the WHO SMART Trust IG's `support.md` links `qa.html`).
 */
export const PUBLISHER_PAGES: ReadonlySet<string> = new Set(["qa.html", "qa-tx.html", "qa-ipreview.html", "qa-eslintcompare.html", "toc.html", "searchform.html"]);

/**
 * Point a page's links that THIS build cannot serve somewhere that can:
 *
 * - a Publisher-only page ({@link PUBLISHER_PAGES}) → the published IG;
 * - a FILE of the IG's repository that is not published as a page (the WHO SMART Base IG
 *   links `.github/skills/bpmn_layout/skills.yaml` and `bpmn/<name>.bpmn`,
 *   the latter from `input/bpmn/`) → that file on GitHub, at `sourceBlob`.
 *   A target is looked for at `<path>` and `input/<path>` in the checkout.
 *
 * A link nothing can serve (the WHO SMART Trust IG's `video_tutorial.html`, in no
 * source) is left as written and RETURNED, so the stage reports an upstream
 * dead link rather than hiding it.
 */
/**
 * Where a relative page link THIS build cannot serve goes: a Publisher page
 * ({@link PUBLISHER_PAGES}, or `artifacts.html` when no artefact index was
 * given) to the IG's published site at `canonical`. Anything else, and a page
 * this build serves, comes back unchanged.
 */
export function offSiteHref(target: string, canonical: string | undefined, isServed: (target: string) => boolean): string {
  if (!canonical || isServed(target)) return target;
  if (!PUBLISHER_PAGES.has(target) && target !== "artifacts.html") return target;
  return `${canonical.replace(/\/$/, "")}/${target}`;
}

export function relinkOffSite(
  text: string,
  o: { canonical?: string; sourceBlob?: string; srcRoot: string; isServed: (target: string) => boolean },
): { text: string; count: number; dead: string[] } {
  let count = 0;
  const dead: string[] = [];
  const out = text.replace(/(\]\(|href=["'])([^)"'\s#?]+)([#?][^)"'\s]*)?(?=[)"'])/g, (whole, pre: string, target: string, tail = "") => {
    if (/^([a-z][a-z0-9+.-]*:|\/|\.\.\/|\{)/i.test(target) || target.includes("{")) return whole;
    if (o.isServed(target) || o.isServed(target.replace(/^\.\//, ""))) return whole;
    const off = offSiteHref(target, o.canonical, o.isServed);
    if (off !== target) {
      count++;
      return `${pre}${off}${tail}`;
    }
    if (!/\.(html|md)$/.test(target) && o.sourceBlob) {
      const at = [target, `input/${target}`].find((p) => existsSync(join(o.srcRoot, p)) && statSync(join(o.srcRoot, p)).isFile());
      if (at) {
        count++;
        return `${pre}${o.sourceBlob.replace(/\/$/, "")}/${at}${tail}`;
      }
    }
    if (/\.html$/.test(target)) dead.push(target);
    return whole;
  });
  return { text: out, count, dead };
}

/**
 * Rewrite a Liquid string the IG Publisher accepts and Jekyll does not.
 *
 * The Publisher's Liquid (Java) reads `"<a href=\\"x.html\\">X</a>"` as one
 * string with escaped quotes; Ruby Liquid has no escapes, ends the string at
 * the first `\\"`, and the page shows `<a href=\\` (the WHO SMART Base IG's
 * `smart.liquid`, every `…__link__html` value, #2235). A double-quoted
 * `{% assign %}` value holding `\\"` and no `'` is written single-quoted,
 * with plain `"` inside — the same string in both engines. One that also
 * holds a `'` has no faithful Ruby form and is left as written.
 */
export function rubyLiquidStrings(text: string): { text: string; count: number } {
  let count = 0;
  const out = text.replace(/(\{%-?\s*assign\s+[\w.-]+\s*=\s*)"((?:[^"\\]|\\.)*)"/g, (whole, pre: string, body: string) => {
    if (!body.includes('\\"') || body.includes("'")) return whole;
    count++;
    return `${pre}'${body.replace(/\\"/g, '"')}'`;
  });
  return { text: out, count };
}

/** A menu href made site-absolute under `baseurl`; an absolute or external one is kept. */
const siteHref = (baseurl: string, href: string): string =>
  /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(href) ? href : `${baseurl.replace(/\/$/, "")}/${href}`;

/** The IG's search files, site-absolute under `baseurl`, for the top bar every page shares. */
export const igSearchAt = (baseurl: string): IgSearchRef => ({ index: siteHref(baseurl, IG_SEARCH_INDEX_FILE), script: siteHref(baseurl, IG_SEARCH_SCRIPT_FILE) });

const escHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The IG's TOC as a DECLARED navbar section (`visualiserNavOf` in
 * `cat-harness/scripts/lib/navbar.ts`): one row per menu group, its items one
 * level below — the depth the navbar allows, and the shape of the IG's own
 * menu. The rail lifts it into the folio-assistant LHS navbar.
 */
export function igTocNav(
  menu: IgMenu,
  baseurl: string,
  extra: ReadonlyArray<{ label: string; href: string }> = [],
  lead: ReadonlyArray<{ label: string; href: string }> = [],
): string {
  const rows = [
    ...lead.map((e) => ({ label: e.label, href: siteHref(baseurl, e.href) })),
    ...menu.groups.map((g) => ({
      label: g.label,
      ...(g.items?.length
        ? { items: g.items.map((it) => ({ label: it.label, href: siteHref(baseurl, it.href) })) }
        : isMenuPage(g)
          ? { href: siteHref(baseurl, g.href) }
          : {}),
    })),
    ...extra.map((e) => ({ label: e.label, href: siteHref(baseurl, e.href) })),
  ];
  return `<script type="application/json" data-fa-visualiser-nav>${JSON.stringify(rows).replace(/</g, "\\u003c")}</script>`;
}

/**
 * The IG's own top bar, preserved: the Publisher's menu as a row of
 * dropdowns, one per group. `<details>`, so it needs no script; and not a
 * `<nav class="fa-nav">`, which the rail pass would read as "already
 * navigated" and skip.
 *
 * With `search`, the bar ends in the IG's search box and the script that
 * runs it (`ig-search.ts`; owner, 2026-10-15, layout "C": "add a search box
 * to the IG top bar"). Both sit INSIDE the bar's `<div>`, so a composed page,
 * which lifts the bar out of the staged layout, carries them too.
 *
 * It is the page bar of the shared page layout (cat-harness-tools
 * `page-layout.ts`, `PAGE_BAR_CLASS`): full width beside the rail, sticky as
 * folio-assistant's band is (owner, 2026-10-15: "please consolidate
 * behaviours/appearance"). Its hrefs are site-absolute, so the same bytes
 * serve every page of the site, which is how `publisher-pages` gives this one
 * bar to the pages other generators wrote (`ig-search.ts` `withIgBar`).
 */
export function igTopBar(menu: IgMenu, baseurl: string, title: string, search?: IgSearchRef, locales: ReadonlyArray<LocalisedBar> = []): string {
  // With translated menus the labels are Liquid-inert: a `{` in a label must not start a tag.
  const esc = (s: string) => (locales.length ? escHtml(s).replace(/\{/g, "&#123;").replace(/\}/g, "&#125;") : escHtml(s));
  const inner = (m: IgMenu, t: string, home: string) =>
    `<a class="ig-topbar-home" href="${escHtml(siteHref(baseurl, home))}">${esc(t)}</a>` +
    m.groups
      .map((g) =>
        g.items?.length
          ? `<details class="ig-topbar-group"><summary>${esc(g.label)}</summary><ul>${g.items
              .map((it) => `<li><a href="${escHtml(siteHref(baseurl, it.href))}">${esc(it.label)}</a></li>`)
              .join("")}</ul></details>`
          : isMenuPage(g)
            ? `<a class="ig-topbar-group ig-topbar-link" href="${escHtml(siteHref(baseurl, g.href))}">${esc(g.label)}</a>`
            : `<span class="ig-topbar-group">${esc(g.label)}</span>`,
      )
      .join("");
  // One bar for every page, in the page's language when the IG translates its
  // menu (fhir-harness#417): a Liquid `case` on `page.lang`, inside the one
  // `<div>` so `IG_TOPBAR_RE` still lifts the whole bar into a composed layout.
  const body = locales.length
    ? `{% case page.lang %}${locales
        .map((l) => `{% when "${l.locale}" %}${inner(l.menu, l.title, l.home)}${l.unreviewed ? `<span class="${UNREVIEWED_MENU_CLASS}" lang="${l.locale}">\u26A0\uFE0F ${esc(l.unreviewed)}</span>` : ""}`)
        .join("")}{% else %}${inner(menu, title, "index.html")}{% endcase %}`
    : inner(menu, title, "index.html");
  const box = search ? `${igSearchBox(search, title)}${igSearchScript(search)}` : "";
  return `<div class="ig-topbar ${PAGE_BAR_CLASS}" role="navigation" aria-label="${escHtml(title)} menu">${body}${box}</div>`;
}

/** One locale's bar: its menu, title and home link, and the mark when no person reviewed the labels. */
export interface LocalisedBar {
  locale: string;
  menu: IgMenu;
  title: string;
  home: string;
  /** The "not reviewed by a person" label, in the locale, when the menu's translation is unreviewed. */
  unreviewed?: string;
}

/** The mark on a bar whose translated labels no person reviewed. */
export const UNREVIEWED_MENU_CLASS = "ig-topbar-tr-unreviewed";

/**
 * The top bar's style: the IG's title on a line of its own, its menu on the
 * line below as a row of dropdowns that overlay the page. Its place, width and
 * stickiness are the shared page layout's (`page-layout.css`), which this
 * repeats only so far as the full layout, which does not link it, needs; the
 * content is never capped to a centred column (owner, 2026-10-15: "full width.
 * keep it on the other pages as well"). `ig-artifact.css` carries every rule
 * here, so a thin page links one IG stylesheet. Owner, 2026-10-14,
 * on smart-hiv: *"also need line break between IG title and top menu"* — on
 * one wrapping row the title shared the line with the menu, and the last
 * group dropped under the title. The break is the title's full-width flex
 * basis, so the markup ({@link igTopBar}) stays one `<div>`.
 *
 * The Folio tab (`docs-ui.css` `.fa-glass-handle`, fixed at the top middle)
 * gets the bar's first 2.25rem to itself (folio-assistant#2534, owner: the tab
 * sat on "Data Models and Exchange" and "Deployment"). The shared layout lets
 * the tab sit on a wide bar's empty middle and reserves the row only below
 * 50rem; an IG bar has no empty middle, since its title and menu fill it, so
 * it reserves the row at every width.
 */
export const IG_TOPBAR_CSS = `
.ig-topbar-tr-unreviewed{font-size:.8rem;font-weight:700;padding:.1rem .5rem;border:2px dashed #f59e0b;border-radius:4px;color:#fff}
.ig-topbar{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem 1rem;padding:.5rem 1.5rem;background:var(--ig-topbar-bg,#2d4271);color:#fff;font-size:var(--fa-text-base,1rem)}
.ig-topbar a{color:#fff;text-decoration:none}
.ig-topbar-home{flex:0 0 100%;font-weight:600}
body:has(> .fa-glass-handle) .ig-topbar.fa-page-bar{padding-top:2.25rem}
.ig-topbar-group{position:relative}
.ig-topbar-group summary{cursor:pointer;list-style:none}
.ig-topbar-group summary::after{content:" \\25BE"}
.ig-topbar-group ul{position:absolute;z-index:20;margin:.25rem 0 0;padding:.25rem 0;min-width:16rem;list-style:none;background:#fff;border:1px solid #ccc;box-shadow:0 2px 6px rgba(0,0,0,.15)}
.ig-topbar-group li a{display:block;padding:.25rem .75rem;color:#2d4271}
.ig-topbar-group li a:hover{background:#eef3f8}
.ig-topbar .ig-topbar-group ul > li{margin:0;padding:0}
.ig-topbar .ig-topbar-group ul > li::before{content:none;display:none}
html:not([data-fa-scheme="light"]) .ig-topbar-group ul{background:#2f2e35;border-color:#44434d;box-shadow:0 2px 8px rgba(0,0,0,.5)}
html:not([data-fa-scheme="light"]) .ig-topbar-group li a{color:#cfe0f7}
html:not([data-fa-scheme="light"]) .ig-topbar-group li a:hover{background:#3a3943}
.ig-main{max-width:none;padding:1rem 1.5rem 3rem}
.ig-edit{margin-top:2rem;font-size:var(--fa-text-sm,0.875rem)}
${IG_SEARCH_CSS.trim()}
`;

/**
 * Which headings the Contents card lists, from the page's headings in
 * document order (`{ level, i }`, `level` 2–4, `i` the heading's index).
 * The card lists the page's SHALLOWEST heading level with the next level
 * nested one deep under it (owner, 2026-11-14, card: "Top level + one
 * nested"): an IG page written in markdown starts its sections at `###`
 * (h3), as the Publisher's own pages do, so a card that read only `<h2>`
 * drew on none of them. Fewer than two rows: no card. Pure; embedded in
 * {@link IG_CONTENTS_JS} by `toString()`, so the browser runs this code.
 */
export function igContentsRows(hs: ReadonlyArray<{ level: number; i: number }>): Array<{ i: number; sub: number[] }> {
  let top = 0;
  for (const h of hs) if (h.level >= 2 && h.level <= 4 && (top === 0 || h.level < top)) top = h.level;
  if (top === 0) return [];
  const rows: Array<{ i: number; sub: number[] }> = [];
  let count = 0;
  for (const h of hs) {
    if (h.level === top) {
      rows.push({ i: h.i, sub: [] });
      count++;
    } else if (h.level === top + 1) {
      const last = rows[rows.length - 1];
      if (last) last.sub.push(h.i);
      else rows.push({ i: h.i, sub: [] });
      count++;
    }
  }
  return count < 2 ? [] : rows;
}

/**
 * The Contents card on an IG's narrative pages (owner, 2026-11-10: "make this
 * more akin to how IGs have TOC on RHS ... not yellow, but more like a card",
 * then "adopt that for other IG pages as well"; 2026-11-14: "each IG page
 * should have a contents card in upper right", below any page banner). The
 * Publisher draws a yellow "Contents:" box at the top right of a page; this
 * is the same box as a neutral card, built in the browser from the page's
 * own headings ({@link igContentsRows}), so it needs nothing from the IG's
 * source. It is the first thing in `<main>` (after its `<h1>` or the IG's
 * metadata table), so it sits below the bar and the version banner, which
 * are outside `<main>`. A page with fewer than two listed headings, or one
 * that already draws a card (`artifacts.html`), gets none.
 */
export const IG_CONTENTS_JS = `(function(){
var main=document.getElementById("main-content");
if(!main||main.querySelector(".igi-contents"))return;
var rowsOf=${igContentsRows.toString()};
var hs=Array.prototype.filter.call(main.querySelectorAll("h2,h3,h4"),function(h){return !h.closest(".igi-contents,#ig-footer,.ig-edit,.ig-metadata")&&h.textContent.trim();});
var rows=rowsOf(hs.map(function(h,i){return {level:+h.tagName.charAt(1),i:i};}));
if(!rows.length)return;
var used={};
function slug(t){var b=t.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"section",s=b,i=1;while(used[s]||document.getElementById(s))s=b+"-"+(++i);used[s]=1;return s;}
function item(h){if(!h.id)h.id=slug(h.textContent);var li=document.createElement("li"),a=document.createElement("a");a.href="#"+h.id;
var c=h.cloneNode(true);Array.prototype.forEach.call(c.querySelectorAll(".anchor-heading,.fa-sec-box,svg,button"),function(n){n.remove();});
a.textContent=c.textContent.replace(/\\s+/g," ").trim();li.appendChild(a);return li;}
var nav=document.createElement("nav");nav.className="igi-contents";nav.setAttribute("aria-label","Contents");
var t=document.createElement("p");t.className="igi-contents-title";t.textContent="Contents";nav.appendChild(t);
var ul=document.createElement("ul");
rows.forEach(function(r){var li=item(hs[r.i]);if(r.sub.length){var sub=document.createElement("ul");sub.className="igi-contents-sub";r.sub.forEach(function(k){sub.appendChild(item(hs[k]));});li.appendChild(sub);}ul.appendChild(li);});
nav.appendChild(ul);
var h1=main.querySelector("h1"),meta=main.querySelector(":scope > .ig-metadata");
if(h1&&h1.parentNode===main)h1.insertAdjacentElement("afterend",nav);else if(meta)meta.insertAdjacentElement("afterend",nav);else main.insertBefore(nav,main.firstChild);
})();`;

/**
 * The process task panel on an IG's pages (owner, 2026-11-12, Q-RAIL-2 = C).
 * The injection QA gate (`ig-content-qa.ts`, fhir-harness#332) refuses a
 * `<script>` in an IG's page text, so a page can no longer load the panel's
 * client itself. A BPMN figure that wants the panel says so as data: a
 * `.pt-diagram` with `data-panel` naming its `<stem>.tasks.json` sidecar. The
 * layout then loads `task-panel.js` and `task-panel.css` from the sidecar's
 * own directory, where the processes viewer publishes them beside it.
 *
 * The path comes from page text, so it is held to a same-site relative path
 * ending in `.tasks.json`: no scheme, no `//`, no leading `/`. Anything else
 * loads nothing, and the figure stays a plain drawing.
 */
export const IG_TASK_PANEL_JS = `(function(){
var f=document.querySelector("#main-content .pt-diagram[data-panel]");
if(!f||window.__igTaskPanel)return;
var p=f.getAttribute("data-panel")||"";
if(!/^[A-Za-z0-9._-][A-Za-z0-9._/-]*[.]tasks[.]json$/.test(p)||p.indexOf("//")>=0)return;
window.__igTaskPanel=1;
var dir=p.replace(/[^/]*$/,"");
var l=document.createElement("link");l.rel="stylesheet";l.href=dir+"task-panel.css";document.head.appendChild(l);
var s=document.createElement("script");s.src=dir+"task-panel.js";document.body.appendChild(s);
})();`;

/** The card's style, read from the thin stylesheet between its markers, for the standalone layout that does not link that sheet. */
export const IG_CONTENTS_CSS = (() => {
  const css = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-artifact.css"), "utf-8");
  const m = css.match(/\/\* IG-CONTENTS-CARD[\s\S]*?\*\/\n([\s\S]*?)\/\* \/IG-CONTENTS-CARD \*\//);
  if (!m) throw new Error("ig-artifact.css lost its IG-CONTENTS-CARD block");
  return m[1]!;
})();

/**
 * The page-level opt-in that tells `docs-ui.js` an IG page's raster images
 * are figures too (bean `n7f8`). The shared figure viewer (`mountFigures`)
 * already takes every `<svg>`, `<img src="*.svg">` and `<object data="*.svg">`
 * in the content; an IG's architecture drawings are `.drawio.png` as well, and
 * the theme shrinks a wide one to the column with no way to zoom it back.
 * Raster images on the platform's own pages are as often card faces and
 * photos, so the viewer takes them only where the page says so, and this is
 * where an IG page says so. Hidden, carrying no text: it is a declaration,
 * not chrome. One string, written by both the standalone layout and the
 * composed pages' top include, so the two cannot disagree.
 */
export const IG_FIGURE_IMAGES_STAMP = '<span hidden data-fa-figure-images="ig"></span>';

/**
 * The plain layout for `chrome: "harness"`: just-the-docs' stylesheet for the
 * prose (and the IG's colour scheme), the IG's top bar and TOC declaration,
 * the page — and no sidebar, so the rail pass supplies the navbar.
 */
export function harnessLayout(topBar: string, tocNav: string, sectionLabel?: string): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="{{ page.lang | default: site.lang | default: \'en\' }}">',
    "<head>",
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>{% if page.title and page.title != site.title %}{{ page.title }} | {% endif %}{{ site.title }}</title>",
    "<link rel=\"stylesheet\" href=\"{{ '/assets/css/just-the-docs-default.css' | relative_url }}\">",
    `<style>${IG_TOPBAR_CSS.trim()}\n${IG_CONTENTS_CSS.trim()}</style>`,
    // The navbar section is named after the IG (owner, 2026-10-05).
    ...(sectionLabel ? [`<meta name="fa-visualiser-label" content="${escHtml(sectionLabel)}">`] : []),
    "</head>",
    "<body>",
    tocNav,
    topBar,
    '<main class="ig-main main-content" id="main-content">',
    IG_FIGURE_IMAGES_STAMP,
    unreviewedNoticeLiquid(),
    "{{ content }}",
    ...igEditLines(),
    `<script>${liquidInertScript(IG_TASK_PANEL_JS)}</script>`,
    `<script>${liquidInertScript(IG_CONTENTS_JS)}</script>`,
    "</main>",
    // Last on the page, as on the Publisher's. Only on pages that flag it
    // (`ig_footer`): the pages this build wrote, and the artefact pages
    // copied in, whose front matter (`ig_footer`, `ig_root`, `ig_prev`,
    // `ig_next`) asks for this same include rather than drawing their own.
    // A child of the body after `<main>`, as on the artefact pages, so the
    // body's column puts it at the window's bottom on a short page too
    // (`ig-artifact.css`, "THE FOOTER STAYS IN VIEW").
    `{% if page.ig_footer %}{% include ${IG_FOOTER_INCLUDE} %}{% endif %}`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/**
 * Every ATX heading of a markdown source with its 1-based line, outside code
 * fences: `{ t, l }`, `t` the heading's text with markdown, links and a
 * trailing `{#id}` removed — what a reader sees, which is what the layout
 * matches it against. Setext headings are not read; a heading the reader
 * sees and this does not simply gets no source link.
 *
 * `include` resolves an `{% include x %}` / `{% lang-fragment x %}` target to
 * the markdown it pulls in and that file's repository path; given, the
 * included file's headings are spliced in at the include, in reading order,
 * each carrying `p` — the file its line `l` is in. Without it a page that is
 * only includes has no headings at all, which is every HL7 IG's landing page:
 * `index.md` is `{% include index-ig.md %}`, so its "Summary" got no ✎ and a
 * 📣 with no line (bean `x78e`). A target already being read is not read
 * again, so an include cycle ends.
 */
export function sourceHeadings(
  md: string,
  include?: (name: string) => { md: string; path: string } | undefined,
  reading: ReadonlySet<string> = new Set(),
): Array<{ t: string; l: number; p?: string }> {
  const out: Array<{ t: string; l: number; p?: string }> = [];
  let fence: string | undefined;
  md.split(/\r?\n/).forEach((line, i) => {
    const f = /^\s{0,3}(```|~~~)/.exec(line);
    if (f) {
      fence = fence === undefined ? f[1] : fence === f[1] ? undefined : fence;
      return;
    }
    if (fence !== undefined) return;
    if (include) {
      for (const inc of line.matchAll(/\{%-?\s*(?:include|lang-fragment)\s+([^\s%]+)/g)) {
        const got = include(inc[1]!);
        if (!got || reading.has(got.path)) continue;
        for (const e of sourceHeadings(got.md, include, new Set([...reading, got.path]))) out.push({ ...e, p: e.p ?? got.path });
      }
    }
    const h = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!h) return;
    const t = h[1]!
      .replace(/\{[#:][^}]*\}\s*$/, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[*_`]/g, "")
      .trim();
    if (t) out.push({ t, l: i + 1 });
  });
  return out;
}

/**
 * An `{% include %}` target resolved as the build resolves it — the IG's
 * `input/pagecontent/` copied over `input/includes/` — to its markdown and
 * repository path, for `sourceHeadings`. Only markdown: an `.xhtml` or
 * `.liquid` include has no ATX headings to read.
 */
export function includeSource(igSrc: string): (name: string) => { md: string; path: string } | undefined {
  return (name) => {
    if (!name.endsWith(".md") || name.includes("..") || name.startsWith("/")) return undefined;
    for (const dir of ["input/pagecontent", "input/includes"]) {
      const file = join(igSrc, dir, name);
      if (existsSync(file)) return { md: readFileSync(file, "utf-8"), path: `${dir}/${name}` };
    }
    return undefined;
  };
}

/**
 * The per-section links are no longer drawn here. The page carries each
 * heading's source line (`<script id="ig-source-lines">`), and the platform's
 * one edit-links runtime (cat-harness-tools `src/core/edit-links.ts`) puts a
 * box after each heading in the right gutter, as on every other document: 📣
 * opens the panel with ✎ to that heading's own line (an included file's, bean
 * `x78e`) and a feedback issue on the IG's repository, titled after the
 * section with the page apart. Owner, 2026-11-08: "edit feedback on IGs like
 * rest of documents should be on right grill not touching section title ...
 * consolidate infrastructure". The old inline ✎ 📣 after each heading's text
 * (bean `mftp`) went with it.
 */
/**
 * The IG's chrome that goes INTO a page when the IG is built inside a host
 * site (`composeIgSite`): the IG's own top bar at the top, and at the bottom
 * the edit link and the per-section source and feedback links. The host's
 * layout supplies everything else — sidebar, search, language selector — so
 * an IG page wears the same chrome as every other page of the site (owner,
 * 2026-10-05, bean `mftp`: *"the chrome is not the standrad harness chrome.
 * missing search bar/locale selctor"*).
 */
/**
 * The edit link and the per-section source and feedback links, as Liquid, for
 * both layouts. The page's edit link comes from the platform's one recipe,
 * edit-links (bean v433), and keeps its plain href for readers without
 * JavaScript. The per-section links come from the same runtime, which reads
 * the page's `ig-source-lines` (see above).
 */
/**
 * A script's source, inlined into a Liquid include, kept out of Liquid's reach.
 *
 * An include is parsed by Jekyll, and a runtime is JavaScript, which may carry
 * `{%` or `{{` in a string or a regular expression: the edit-links runtime's
 * variable pattern (`/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|.../g`, cat-harness-tools'
 * ✍ suggest) is one, and inlined bare it stopped the WHO SMART Trust IG's whole build with
 * "Liquid syntax error" (2026-10-14). `{% raw %}` keeps the bytes; neutralising
 * them with a word joiner (`ig-ast`'s `neutralise`) would change the program.
 * A source that would close the raw block itself is refused, not mangled.
 */
export function liquidInertScript(js: string): string {
  if (/\{%-?\s*endraw/.test(js)) throw new Error("an inlined script carries {% endraw %}: it cannot be kept out of Liquid's reach in a raw block; link it as a file instead");
  return `{% raw %}${js}{% endraw %}`;
}

function igEditLines(scriptSrc?: string): string[] {
  return [
    '{% if page.ig_edit_url %}<p class="ig-edit"><a data-fa-link="edit" data-src="{{ page.ig_source_path }}" data-repo="{{ page.ig_source_repo }}" href="{{ page.ig_edit_url }}">Edit this page on GitHub</a></p>{% endif %}',
    '{% if page.ig_source_lines %}<script type="application/json" id="ig-source-lines">{"blob": {{ page.ig_source_blob | jsonify }}, "repo": {{ page.ig_source_repo | jsonify }}, "branch": {{ page.ig_source_branch | jsonify }}, "path": {{ page.ig_source_path | jsonify }}, "lines": {{ page.ig_source_lines | jsonify }}}</script>',
    // Thin: the runtime is a linked file (`IG_SOURCE_LINKS_FILE`), not inlined into every page.
    `${scriptSrc ? `<script src="${scriptSrc}"></script>` : `<script>${liquidInertScript(EDIT_LINKS_RUNTIME)}</script>`}{% endif %}`,
  ];
}

/** The edit-links runtime as one file, linked by a thin page's bottom. The name stays: published pages link it. */
export const IG_SOURCE_LINKS_FILE = "assets/ig-source-links.js";
/** The IG's top bar as the staged layout holds it, on a line of its own: what `composeIgSite` lifts out. */
export const IG_TOPBAR_RE = /<div class="ig-topbar[ "][\s\S]*?<\/div>(?=\n|$)/;
/** The thin narrative layout's stylesheet: the one every thin IG page links (`gen-ig-pages` writes it). */
export const IG_THIN_CSS_FILE = "assets/ig-artifact.css";
/** Its source, the same file `gen-ig-pages` copies. */
const IG_THIN_CSS_SOURCE = join(import.meta.dir, "templates", "ig-pages", "ig-artifact.css");

/**
 * The reader's folio on an IG page (bean `95sk`, R24). The owner, 2026-09-21:
 * the folio visualisation is the harness's, and SHALL be available by
 * convention on any harness, so it is the SAME folio in every library a
 * reader browses. The glass is mounted by the platform's `docs-ui.js`, and
 * the who-iris replica pages already carry it through `folio-mount.ts`. The
 * thin layout linked everything of the host's except it, so a reader who
 * followed a link into an IG lost their folio, which is the absence
 * `check-folio-mount.ts` exists to catch.
 *
 * Both are LINKED from the host's site root, as the thin layout links
 * everything (owner, 2026-10-12: "make thin default"). `defer` keeps the
 * script off the critical path, and it is one cached request across every
 * page of the host. Both carry `folio-mount.ts`'s marker, so the same gate
 * finds the mount here as on a replica page.
 */
export const IG_FOLIO_MOUNT: readonly string[] = [
  `<link rel="stylesheet" href="{{ '/assets/css/docs-ui.css' | relative_url }}" ${FOLIO_MOUNT_MARKER}>`,
  `<script src="{{ '/assets/js/docs-ui.js' | relative_url }}" defer ${FOLIO_MOUNT_MARKER}></script>`,
];

/**
 * The THIN layout for an IG's narrative pages composed into a host site
 * (owner, 2026-10-12: "make thin default"): the page's own prose and the
 * IG's top bar, edit links and footer — and nothing of the host's chrome
 * inlined. Every stylesheet and script is LINKED: the shared thin-page
 * stylesheet, the top bar's, and the rail, which the post-build rail pass
 * links because the page asks for it (`folio-navbar: linked`, cat-harness-
 * tools' `NAVBAR_LINKED`). `assetsAt` is the IG's docs root as a site path
 * (`/` at the root, `/<instance>/` inside a host), for `relative_url`.
 * The IG's TOC declaration and section label, when the staged layout carries
 * them, keep the IG's menu in the rail as the full layout does.
 */
export function thinIgLayout(assetsAt: string, tocNav = "", sectionLabel?: string, topBar = "", footerInclude?: string): string {
  const asset = (f: string) => `{{ '${assetsAt}${f}' | relative_url }}`;
  return [
    "<!doctype html>",
    '<html lang="{{ page.lang | default: site.lang | default: \'en\' }}"{% if page.text_dir %} dir="{{ page.text_dir }}"{% endif %}>',
    "<head>",
    '<meta charset="utf-8">',
    // The language picker's block, from the page's front matter, when the IG has translations of it (fhir-harness#382).
    TRANSLATION_META_LIQUID,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>{% if page.title and page.title != site.title %}{{ page.title }} — {% endif %}{{ site.title }}</title>",
    '<link rel="canonical" href="{{ page.url | relative_url }}">',
    `<link rel="icon" href="${escHtml(DEFAULT_ICON)}">`,
    NAVBAR_LINKED,
    ...(sectionLabel ? [`<meta name="fa-visualiser-label" content="${escHtml(sectionLabel)}">`] : []),
    // The shared page layout first (width, bar, scrolling), then the IG's one stylesheet.
    `<link rel="stylesheet" href="${asset(PAGE_LAYOUT_CSS_FILE)}" ${PAGE_LAYOUT_MARK}>`,
    `<script src="${asset(PAGE_LAYOUT_JS_FILE)}" defer ${PAGE_LAYOUT_MARK}></script>`,
    `<link rel="stylesheet" href="${asset(IG_THIN_CSS_FILE)}">`,
    ...IG_FOLIO_MOUNT,
    "</head>",
    "<body>",
    ...(tocNav ? [tocNav] : []),
    // The bar OUTSIDE the content column, so it spans the page beside the rail.
    ...(topBar ? [topBar] : []),
    `<main class="ig-main main-content ${PAGE_MAIN_CLASS}" id="main-content">`,
    // First thing in the content: the notice on a page with translated words no person reviewed.
    // Its style is in the linked `IG_THIN_CSS_FILE`, like every rule of this layout.
    unreviewedNoticeLiquid({ inlineStyle: false }),
    "{{ content }}",
    `<script>${liquidInertScript(IG_TASK_PANEL_JS)}</script>`,
    `<script>${liquidInertScript(IG_CONTENTS_JS)}</script>`,
    "</main>",
    // The IG's footer after the column, as `harnessLayout` places it.
    ...(footerInclude ? [`{% if page.ig_footer %}{% include ${footerInclude} %}{% endif %}`] : []),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/** `https://github.com/<o>/<r>/edit/<branch>` and a path, as the front matter the link recipe reads. */
export function editBaseParts(editBase: string, path: string): { ig_source_repo?: string; ig_source_branch?: string; ig_source_path: string } {
  const m = editBase.replace(/\/$/, "").match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/edit\/(.+)$/);
  return m ? { ig_source_repo: m[1]!, ig_source_branch: m[2]!, ig_source_path: path } : { ig_source_path: path };
}

export function igChromeIncludes(topBar: string, thin?: { assetsAt: string }): { top: string; bottom: string } {
  return {
    // Thin: the bar is the thin layout's, above the content column, and its
    // style is the linked `IG_THIN_CSS_FILE`; the page's own top is the stamp.
    top: thin ? `${IG_FIGURE_IMAGES_STAMP}\n` : `<style>${IG_TOPBAR_CSS.trim()}</style>\n${topBar}\n${IG_FIGURE_IMAGES_STAMP}\n`,
    bottom: [
      ...igEditLines(thin ? `{{ '${thin.assetsAt}${IG_SOURCE_LINKS_FILE}' | relative_url }}` : undefined),
      "",
    ].join("\n"),
  };
}

/**
 * The host site's base, written literally into the staged layout's top bar and
 * navigation (`igTopBar`, `igTocNav`), handed back to the host build as
 * `{{ site.baseurl }}`.
 *
 * WHY. The literal is one deploy's path: on a preview it carries the preview's
 * name, so every IG page differed between two previews and each preview stored
 * its own copy of all of them (bean `g196`, measured 2026-10-23: 1,660 IG
 * pages differed only by that name). As Liquid, the host build writes it the
 * way it writes its own links (cat-harness site chrome: relative to the page).
 *
 * Only a quoted value that STARTS with the base and continues with `/` is
 * rewritten, so `/folio-assistant-core/` is not mistaken for `/folio-assistant/`.
 * An empty base (a site at `/`) carries no deploy's name and is left alone.
 */
export function liquidSiteBase(html: string, siteBase?: string): string {
  const b = (siteBase ?? "").replace(/\/+$/, "");
  if (!b) return html;
  const esc = b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`(["'])${esc}(?=/)`, "g"), "$1{{ site.baseurl }}");
}

/**
 * Move a staged IG site INTO a host Jekyll source at `<docsRoot>/<instance>/`,
 * so the host's own build renders it with the host's chrome (bean `mftp`,
 * owner's choice: "Build in main site"). What made a separate site per IG
 * necessary (bean `bamf`) is namespaced instead of isolated:
 *
 * - the IG's `_includes/` go to `_includes/ig/<instance>/`, and every
 *   `{% include x %}` naming one of them is rewritten to that path;
 * - its `_data/*.json` go to `_data/ig/<instance>/`, and `site.data.fhir` /
 *   `site.data.ig_releases` become `site.data.ig["<instance>"].…`;
 * - its navigation nests under ONE entry: the IG's index becomes the IG's
 *   top-level page (titled after the IG), each menu group its child, each
 *   item a grandchild (`grand_parent`), so a group called "Home" cannot
 *   collide with another site's "Home";
 * - each page gets the IG's top bar above and the edit / source / feedback
 *   links below (`igChromeIncludes`);
 * - artefact pages stay out of search, which would otherwise index thousands
 *   of near-identical pages.
 *
 * The staged `_layouts/`, `_sass/` and `_config.yml` are the standalone
 * site's and are not carried. A file already at a destination path is
 * reported, never overwritten.
 */
export function composeIgSite(
  staged: string,
  docsRoot: string,
  instance: string,
  opts: { atRoot?: boolean; at?: "." | "ig"; fullPages?: boolean; siteBase?: string } = {},
): { pages: number; files: number; includes: number; collisions: string[] } {
  const title = /^title:\s*(.+)$/m.exec(readFileSync(join(staged, "_config.yml"), "utf-8"))?.[1]?.replace(/^"(.*)"$/, "$1") ?? instance;
  const q = JSON.stringify(title);
  // `atRoot`: the IG IS the site (an IG repository's own site, composed into
  // the chrome-only shell — #2235 F1), so its pages land at the root.
  // `at` (stage-ig-sites `igSiteAt`): the IG was staged with a base URL ending
  // `/<instance>/ig` or `/<instance>`, and it lands where that base says
  // (folio-assistant#2738: composed at `/<instance>/` under an `/ig` base,
  // every menu link was dead).
  const sub = opts.at === "ig" ? "ig" : "";
  const dest = opts.atRoot ? docsRoot : join(docsRoot, instance, sub);
  const incDest = join(docsRoot, "_includes", "ig", instance);
  const dataDest = join(docsRoot, "_data", "ig", instance);
  const collisions: string[] = [];
  const incNames = new Set(files(join(staged, "_includes")));
  // Every key the staged `_data/` defines moves under `site.data.ig["<instance>"]`
  // -- the harness's own (`fhir`, `ig_releases`) and the IG's `input/data/`
  // files alike (bean `yy4u`), so an IG's `site.data.features` is namespaced
  // the same way its `site.data.fhir` is.
  const dataKeys = [...new Set(entries(join(staged, "_data")).map(dataStem))].sort((a, b) => b.length - a.length);
  const dataRef = dataKeys.length ? new RegExp(`site\\.data\\.(${dataKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g") : undefined;
  const rewrite = (text: string): string => {
    const t = text.replace(/(\{%-?\s*include\s+)([^\s%}]+)/g, (whole, pre: string, name: string) => (incNames.has(name) ? `${pre}ig/${instance}/${name}` : whole));
    const named = dataRef ? t.replace(dataRef, (_w, key: string) => `site.data.ig[${JSON.stringify(instance)}].${key}`) : t;
    // A lookup by COMPUTED key (`site.data[stub]`) reads the IG's own data
    // too, so it moves with it; left alone it would read the host's top level.
    return named.replace(/site\.data\[/g, `site.data.ig[${JSON.stringify(instance)}][`);
  };
  const put = (to: string, body: string | Buffer): void => {
    if (existsSync(to)) {
      collisions.push(relative(docsRoot, to));
      return;
    }
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, body);
  };
  let includes = 0;
  for (const f of incNames) {
    put(join(incDest, f), rewrite(readFileSync(join(staged, "_includes", f), "utf-8")));
    includes++;
  }
  for (const f of entries(join(staged, "_data"))) {
    const from = join(staged, "_data", f);
    if (statSync(from).isDirectory()) {
      if (existsSync(join(dataDest, f))) collisions.push(relative(docsRoot, join(dataDest, f)));
      else cpSync(from, join(dataDest, f), { recursive: true });
    } else put(join(dataDest, f), readFileSync(from));
  }
  const stagedLayout = liquidSiteBase(existsSync(join(staged, "_layouts", "default.html")) ? readFileSync(join(staged, "_layouts", "default.html"), "utf-8") : "", opts.siteBase);
  const topBar = IG_TOPBAR_RE.exec(stagedLayout)?.[0] ?? "";
  // THIN, the default (owner, 2026-10-12: "make thin default"): the IG's pages
  // wear `thinIgLayout` rather than the host's layout, so none of the host's
  // chrome is written into them; their own top bar, edit links and footer stay,
  // with every style and script linked. `fullPages` keeps the host's layout.
  const thin = !opts.fullPages;
  const assetsAt = opts.atRoot ? "/" : `/${instance}/${sub ? `${sub}/` : ""}`;
  const layoutName = `ig-thin-${instance}`;
  const chrome = igChromeIncludes(topBar, thin ? { assetsAt } : undefined);
  put(join(incDest, "_top.html"), chrome.top);
  // The full path shares one bottom across IGs; a thin one names its own IG's linked file.
  const bottomInclude = thin ? `ig/${instance}/_bottom.html` : "ig/_bottom.html";
  const bottom = join(docsRoot, "_includes", ...bottomInclude.split("/"));
  if (!existsSync(bottom) || thin) put(bottom, chrome.bottom);
  if (thin) {
    const tocNav = /<script type="application\/json" data-fa-visualiser-nav>[\s\S]*?<\/script>/.exec(stagedLayout)?.[0];
    const label = /<meta name="fa-visualiser-label" content="([^"]*)">/.exec(stagedLayout)?.[1];
    put(join(docsRoot, "_layouts", `${layoutName}.html`), thinIgLayout(assetsAt, tocNav, label?.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"), topBar, incNames.has(IG_FOOTER_INCLUDE) ? `ig/${instance}/${IG_FOOTER_INCLUDE}` : undefined));
    // The shared page layout's two files, unless the staged site brings them
    // (the artefact pages' generator writes them beside `ig-artifact.css`).
    // The thin layout links `ig-artifact.css` too; an IG whose layer has no
    // artefact pages (an IG with no docs of its own, folio-assistant#2738) had none, so
    // its pages lost their styling.
    for (const [rel, src] of [[PAGE_LAYOUT_CSS_FILE, PAGE_LAYOUT_CSS_SOURCE], [PAGE_LAYOUT_JS_FILE, PAGE_LAYOUT_JS_SOURCE], [IG_THIN_CSS_FILE, IG_THIN_CSS_SOURCE]] as const) {
      if (!existsSync(join(staged, rel))) put(join(dest, rel), readFileSync(src));
    }
    put(join(dest, IG_SOURCE_LINKS_FILE), `${EDIT_LINKS_RUNTIME}\n`);
  }
  let pages = 0;
  let count = 0;
  const walk = (rel: string): void => {
    for (const name of readdirSync(join(staged, rel)).sort()) {
      const r = rel ? join(rel, name) : name;
      if (!rel && (name.startsWith("_") || name === "Gemfile")) continue;
      const abs = join(staged, r);
      if (statSync(abs).isDirectory()) {
        walk(r);
        continue;
      }
      count++;
      const isPage = /\.(md|html)$/.test(name) && readFileSync(abs, "utf-8").startsWith("---\n");
      if (!isPage) {
        put(join(dest, r), readFileSync(abs));
        continue;
      }
      const text = rewrite(readFileSync(abs, "utf-8"));
      const end = text.indexOf("\n---", 3);
      let fm = text.slice(4, end);
      const body = text.slice(end + 4).replace(/^\n/, "");
      if (r === "index.md") {
        fm = fm.replace(/^(parent|grand_parent|nav_exclude|has_children|nav_order|title):.*\n?/gm, "");
        fm = `title: ${q}\nhas_children: true\nnav_order: 900\n${fm}`;
      } else if (/^has_children:\s*true/m.test(fm)) {
        if (!/^parent:/m.test(fm)) fm += `\nparent: ${q}`;
      } else if (/^parent:/m.test(fm) && !/^grand_parent:/m.test(fm)) {
        fm += `\ngrand_parent: ${q}`;
      }
      if (r.startsWith(`artifact${"/"}`) && !/^search_exclude:/m.test(fm)) fm += "\nsearch_exclude: true";
      // Named, not inherited: GitHub Pages' default-layout plugin assigns one
      // and a plain Jekyll build does not, so the page says which it uses.
      if (thin) fm = `${fm.replace(/^layout:.*\n?/m, "")}\nlayout: ${layoutName}`;
      else if (!/^layout:/m.test(fm)) fm += "\nlayout: default";
      fm = fm.replace(/\n+$/, "");
      // The IG's footer last, after the shared bottom, on the pages the IG
      // build wrote (`ig_footer`), as `harnessLayout` places it.
      // A thin page's layout draws it after `<main>`; the host's layout has no place for it, so it goes into the page.
      const footer = !thin && incNames.has(IG_FOOTER_INCLUDE) ? `{% if page.ig_footer %}{% include ig/${instance}/${IG_FOOTER_INCLUDE} %}{% endif %}\n` : "";
      put(join(dest, r), `---\n${fm}\n---\n{% include ig/${instance}/_top.html %}\n\n${body.replace(/\s*$/, "")}\n\n{% include ${bottomInclude} %}\n${footer}`);
      pages++;
    }
  };
  walk("");
  return { pages, files: count, includes, collisions };
}

const files = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile()) : []);
/** Every file under `dir`, subdirectories included, as `/`-separated paths relative to it. */
const filesDeep = (dir: string, rel = ""): string[] =>
  existsSync(join(dir, rel))
    ? readdirSync(join(dir, rel)).sort().flatMap((f) => {
        const p = rel ? `${rel}/${f}` : f;
        return statSync(join(dir, p)).isDirectory() ? filesDeep(dir, p) : [p];
      })
    : [];
const entries = (dir: string) => (existsSync(dir) ? readdirSync(dir).sort() : []);

/**
 * The resources of the IG's FHIR AST as the IG Publisher's Jekyll sees them:
 * `_data/canonicals.json` (every resource with a canonical URL: `id`, `type`,
 * `url`, `version`, `name`) and one `_data/<Type>-<id>.json` per resource,
 * its JSON verbatim.
 *
 * Why: an IG's own pages read them. The WHO SMART Trust IG's `system-actors.md` loops
 * `site.data.canonicals | where: 'type', 'ActorDefinition'` and reads each one
 * as `site.data[<Type>-<id>]`; with neither supplied, the loop rendered its
 * actor list EMPTY with no word anywhere (measured on its gh-pages 63303eb,
 * 2026-10-09, against the Publisher's c6e0e45, which listed Holder, Issuer, …).
 *
 * No AST, nothing written and `undefined` back. An AST that cannot be read is
 * a reason, not a silent empty list.
 */
export function astResourceData(astDir: string, dataDir: string): { canonicals: number; resources: number } | { why: string } | undefined {
  if (!existsSync(join(astDir, "manifest.json"))) return undefined;
  let manifest;
  try {
    manifest = readAst(astDir).manifest;
  } catch (e) {
    return { why: (e as Error).message };
  }
  const canonicals: Array<Record<string, string>> = [];
  let resources = 0;
  mkdirSync(dataDir, { recursive: true });
  for (const r of manifest.resources) {
    const file = join(astDir, r.file);
    if (!existsSync(file)) continue;
    copyFileSync(file, join(dataDir, `${r.resourceType}-${r.id}.json`));
    resources++;
    if (r.canonical) {
      const c: Record<string, string> = { id: r.id, type: r.resourceType, url: r.canonical };
      if (r.version) c.version = r.version;
      if (r.name) c.name = r.name;
      canonicals.push(c);
    }
  }
  writeFileSync(join(dataDir, "canonicals.json"), JSON.stringify(canonicals, null, 2) + "\n");
  return { canonicals: canonicals.length, resources };
}

/** The extensions Jekyll reads from `_data/`, each file becoming `site.data.<stem>`. */
const JEKYLL_DATA = /\.(ya?ml|json|csv|tsv)$/i;
/** The `site.data` key a `_data/` entry defines: its file stem, or a directory's name. */
const dataStem = (f: string): string => f.replace(JEKYLL_DATA, "");

/** One `site.data` key that two sources defined, and which one the site kept. */
export interface DataOverwrite {
  key: string;
  /** The source whose content the site carries. */
  kept: string;
  /** The source that lost — its content is NOT in the site. */
  dropped: string;
}

/**
 * The IG's own Jekyll data — `input/data/*` — into the site's `_data/`
 * (bean `yy4u`, owner 2026-10-09).
 *
 * The IG Publisher copies `input/data/` into its Jekyll `_data/`, so an IG's
 * pages may say `{{ site.data.features.github.repo_owner }}` against its own
 * `input/data/features.yaml`. Not staged, every such reference rendered as
 * the empty string — four `raw.githubusercontent.com///main/...` links on
 * the WHO SMART Immunizations IG's `testing.html`, measured 2026-10-09.
 *
 * Called AFTER the harness writes its own data (`fhir`, `ig_releases`), and
 * the harness's file is KEPT on a clash, as the Publisher's own
 * `_data/fhir.json` wins under the Publisher. Never silent: every key two
 * sources define -- the harness and the IG, or two IG files with one stem
 * (`x.yaml` and `x.json`, which Jekyll would resolve by load order) -- is
 * returned as a {@link DataOverwrite}, and the caller records it as a QA
 * finding (owner: *"can we have QA flag if overwrite"*).
 */
export function stageIgData(srcDir: string, dataDir: string): { staged: string[]; overwrites: DataOverwrite[] } {
  const owner = new Map<string, string>(entries(dataDir).map((f) => [dataStem(f), `_data/${f} (written by this build)`]));
  const staged: string[] = [];
  const overwrites: DataOverwrite[] = [];
  for (const f of entries(srcDir)) {
    const abs = join(srcDir, f);
    const dir = statSync(abs).isDirectory();
    if (!dir && !JEKYLL_DATA.test(f)) continue;
    const key = dataStem(f);
    const kept = owner.get(key);
    if (kept) {
      overwrites.push({ key, kept, dropped: `input/data/${f}` });
      continue;
    }
    mkdirSync(dataDir, { recursive: true });
    cpSync(abs, join(dataDir, f), { recursive: true });
    owner.set(key, `input/data/${f}`);
    staged.push(f);
  }
  return { staged, overwrites };
}

/**
 * The overwrites as a `qa-results/v1` sidecar. Written whether or not there
 * are any: zero findings from a run that LOOKED is a different fact from no
 * record at all.
 */
export function dataOverwritesQa(subject: string, producer: { script: string; script_hash: string }, overwrites: DataOverwrite[]): QaResult {
  return {
    $schema: "qa-results/v1",
    producer,
    subject: { kind: "fhir-ig", id: subject },
    families: {
      "data-overwrite": {
        summary: "site.data keys two sources define; the site carries only the kept one, so a page reading the dropped one's fields renders them empty",
        count: overwrites.length,
        entries: overwrites.map((o) => ({ ...o })),
      },
    },
    total: overwrites.length,
  };
}

/**
 * `{% include x %}` and `{% lang-fragment x %}` target includes, so a missing
 * one is found before Jekyll aborts on it.
 */
export function includeTargets(md: string): string[] {
  return [...md.matchAll(/\{%-?\s*(?:include|lang-fragment)\s+([^\s%]+)/g)].map((m) => m[1]!);
}

/**
 * True when an include name may be used as a file under `_includes/`: a single
 * path segment (no separator, not `.` or `..`, no NUL) of letters, digits, `.`,
 * `_` and `-`, starting with a letter, digit or `_`. Anything else is refused.
 */
export function isSafeIncludeName(name: string): boolean {
  return safeSegment(name) !== undefined && /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(name);
}

/**
 * FHIR's concrete resource types, R4 (4.0.1) and R5 (5.0.0) together — read
 * once from `hl7.fhir.r4.core#4.0.1` and `hl7.fhir.r5.core#5.0.0` (every
 * `StructureDefinition` with `kind: resource`, `derivation: specialization`,
 * not abstract). Specification data, not any IG's: it is what tells
 * `list-structuremaps.xhtml` from `list-simple-profiles.xhtml`, which names
 * no resource type and so stays a marker here.
 */
export const FHIR_RESOURCE_TYPES: ReadonlySet<string> = new Set(
  (
    "Account ActivityDefinition ActorDefinition AdministrableProductDefinition AdverseEvent AllergyIntolerance " +
    "Appointment AppointmentResponse ArtifactAssessment AuditEvent Basic Binary BiologicallyDerivedProduct " +
    "BiologicallyDerivedProductDispense BodyStructure Bundle CapabilityStatement CarePlan CareTeam CatalogEntry " +
    "ChargeItem ChargeItemDefinition Citation Claim ClaimResponse ClinicalImpression ClinicalUseDefinition CodeSystem " +
    "Communication CommunicationRequest CompartmentDefinition Composition ConceptMap Condition ConditionDefinition " +
    "Consent Contract Coverage CoverageEligibilityRequest CoverageEligibilityResponse DetectedIssue Device " +
    "DeviceAssociation DeviceDefinition DeviceDispense DeviceMetric DeviceRequest DeviceUsage DeviceUseStatement " +
    "DiagnosticReport DocumentManifest DocumentReference EffectEvidenceSynthesis Encounter EncounterHistory Endpoint " +
    "EnrollmentRequest EnrollmentResponse EpisodeOfCare EventDefinition Evidence EvidenceReport EvidenceVariable " +
    "ExampleScenario ExplanationOfBenefit FamilyMemberHistory Flag FormularyItem GenomicStudy Goal GraphDefinition " +
    "Group GuidanceResponse HealthcareService ImagingSelection ImagingStudy Immunization ImmunizationEvaluation " +
    "ImmunizationRecommendation ImplementationGuide Ingredient InsurancePlan InventoryItem InventoryReport Invoice " +
    "Library Linkage List Location ManufacturedItemDefinition Measure MeasureReport Media Medication " +
    "MedicationAdministration MedicationDispense MedicationKnowledge MedicationRequest MedicationStatement " +
    "MedicinalProduct MedicinalProductAuthorization MedicinalProductContraindication MedicinalProductDefinition " +
    "MedicinalProductIndication MedicinalProductIngredient MedicinalProductInteraction MedicinalProductManufactured " +
    "MedicinalProductPackaged MedicinalProductPharmaceutical MedicinalProductUndesirableEffect MessageDefinition " +
    "MessageHeader MolecularSequence NamingSystem NutritionIntake NutritionOrder NutritionProduct Observation " +
    "ObservationDefinition OperationDefinition OperationOutcome Organization OrganizationAffiliation " +
    "PackagedProductDefinition Parameters Patient PaymentNotice PaymentReconciliation Permission Person PlanDefinition " +
    "Practitioner PractitionerRole Procedure Provenance Questionnaire QuestionnaireResponse RegulatedAuthorization " +
    "RelatedPerson RequestGroup RequestOrchestration Requirements ResearchDefinition ResearchElementDefinition " +
    "ResearchStudy ResearchSubject RiskAssessment RiskEvidenceSynthesis Schedule SearchParameter ServiceRequest Slot " +
    "Specimen SpecimenDefinition StructureDefinition StructureMap Subscription SubscriptionStatus SubscriptionTopic " +
    "Substance SubstanceDefinition SubstanceNucleicAcid SubstancePolymer SubstanceProtein " +
    "SubstanceReferenceInformation SubstanceSourceMaterial SubstanceSpecification SupplyDelivery SupplyRequest Task " +
    "TerminologyCapabilities TestPlan TestReport TestScript Transport ValueSet VerificationResult VisionPrescription"
  ).split(" "),
);

/**
 * The plural the IG Publisher writes into a list fragment's name
 * (`list-<plural>.xhtml`), lower-cased: `CodeSystem` → `codesystems`,
 * `Library` → `libraries`, `SubscriptionStatus` → `subscriptionstatuses`,
 * `RelatedPerson` → `relatedpeople`.
 */
export function publisherPlural(resourceType: string): string {
  const w = resourceType.toLowerCase();
  if (w.endsWith("person")) return `${w.slice(0, -"person".length)}people`;
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`;
  if (/(s|x|ch|sh)$/.test(w)) return `${w}es`;
  return `${w}s`;
}

/**
 * The IG Publisher's artefact-list fragments, `list-<plural>.xhtml` and
 * `list-simple-<plural>.xhtml`: every artefact of ONE resource type, as a list
 * of links to its page — with its description, or (`simple`) without. The
 * type comes from the name, read either as the Publisher pluralises it or as
 * a plain `s`; a name whose plural is no FHIR resource type
 * (`list-simple-profiles.xhtml`, a subset of StructureDefinitions) is not one
 * of these, and undefined says so.
 */
export function artifactListInclude(name: string): { resourceType: string; simple: boolean } | undefined {
  const m = /^list-(simple-)?([a-z]+)\.xhtml$/.exec(name);
  if (!m) return undefined;
  for (const t of FHIR_RESOURCE_TYPES) {
    if (publisherPlural(t) === m[2] || `${t.toLowerCase()}s` === m[2]) return { resourceType: t, simple: m[1] !== undefined };
  }
  return undefined;
}

/** The include every `list-*.xhtml` this build writes calls: prefixed, so it cannot collide with one the IG's source holds. */
export const ARTIFACT_LIST_INCLUDE = "fa-ig-artifact-list.html";
/** The include every `dependency-table*.xhtml` this build writes calls: prefixed, so it cannot collide with one the IG's source holds. */
export const DEPENDENCY_TABLE_INCLUDE = "fa-ig-dependency-table.html";
export const DEPENDENCY_TABLE_TEMPLATE_PATH = resolve(import.meta.dir, "templates/ig-site/dependency-table.liquid");
/** The include the globals fragment calls, and its template. */
export const GLOBALS_TABLE_INCLUDE = "fa-ig-globals-table.html";
export const GLOBALS_TABLE_TEMPLATE_PATH = resolve(import.meta.dir, "templates/ig-site/globals-table.liquid");

/** What stands in for a diagram nothing rendered: visible, never an empty include. */
export const notRenderedMarker = (name: string, from: string) =>
  `<p class="ig-not-rendered"><strong>⟦not rendered: ${name}⟧</strong> — the IG Publisher renders it from <code>${from}</code>; no renderer was given to this build.</p>\n`;

export interface StageOptions {
  baseurl?: string;
  /**
   * Site paths a later step writes, and the step that owns each: a
   * `/`-ended prefix reserves everything under it, any other value that one
   * file. An `input/images` file reserved this way is left out and reported,
   * so the site holds one answer for each URL.
   */
  reservedPaths?: readonly { prefix: string; by: string }[];
  plantumlJar?: string;
  /** Navigate by the IG's published menu instead of sushi-config `pages:`. */
  menu?: IgMenu;
  /** `owner/repo@ref` for Jekyll's remote-theme plugin, instead of the `just-the-docs` gem. */
  remoteTheme?: string;
  /** The palette of the theme the IG's layer declares for its web pages; none, no scheme. */
  palette?: SitePalette;
  /**
   * The layer's artefact index and where its artefact pages are, relative
   * to this site. Given, an `artifacts` page is written — the Publisher's
   * `artifacts.html` — linking each artefact to `<pagesHref><stem>.html`.
   * Absent, this build holds no `artifacts.html`, so a link or menu item to
   * it goes to the IG's published site ({@link relinkOffSite}, {@link offSiteHref}).
   */
  artifacts?: {
    list: ReadonlyArray<IndexedArtifact>;
    pagesHref: string;
    /**
     * The artefact index NODE (`artifact/index.jsonld`, `ig-artifact-jsonld.ts`),
     * relative to this site. Given — the default since 2026-10-12 (owner: "make
     * thin default") — `artifacts.html` and `toc.html` are written as THIN pages
     * that draw the list from it (`thinIndexPage`), not as Liquid over
     * `site.data.fhir`. Absent (`stage-ig-sites --full-pages`), the full pages.
     */
    index?: string;
    /**
     * Every page name under `pagesHref` beyond the artefacts' own: an
     * artefact's thin TAB VIEWS (`<Type>-<id>-definitions`, `-mappings`,
     * `-examples`, `.json`, `.profile.json`; owner, 2026-10-14: "3. Render them
     * too"). The narrative's links to them are pointed at `pagesHref` as its
     * links to the artefact pages are (`relinkArtifacts`).
     */
    pages?: ReadonlyArray<string>;
  };
  /**
   * Content a POST-PROCESSING step writes into a page after the Publisher has
   * run, at a marker the page's source holds. The source alone is then not
   * the page the Publisher published, so a fill puts `body` where `marker`
   * is and adds `data` to the page's front matter for `body`'s Liquid to read.
   *
   * Generic on purpose: this layer knows a marker and a template, never whose
   * post-processing wrote them. Which fills an IG gets is the caller's
   * business (`stage-ig-sites.ts`).
   */
  fills?: ReadonlyArray<{ marker: string; body: string; data: Record<string, unknown> }>;
  /**
   * ANNEXES: tabular content a page loads when it is opened (owner,
   * 2026-10-10: the data dictionary "should be in the KG but it should also be
   * dynamically loaded", not the full Excel). Each names the page it belongs
   * on and a JSON file in the layer's graph shaped as `{ title, source,
   * sheets: [{ name, columns: [{ key, label }], rows: string[][] }] }`; the
   * file is copied to `assets/annex/` and a mount point is appended to the
   * page, rendered by `assets/js/ig-annex.js`. Generic: this layer knows a
   * table, never whose workbook it came from.
   */
  annexes?: ReadonlyArray<IgAnnex>;
  /**
   * The IG's GitHub releases as pointers to their binary assets
   * (`fhir-artifact-index/releases.json`, `ig-releases/v1`). Given, a
   * `releases` page lists them; the bytes stay on GitHub (bean `b8ip`).
   */
  releases?: IgReleases;
  /**
   * Where the IG's source can be edited on GitHub, `https://github.com/<o>/<r>/edit/<branch>`.
   * Given, every page read from `input/pagecontent/` carries `ig_edit_url`
   * (`<editBase>/input/pagecontent/<file>`) and the layout links it, as the
   * just-the-docs layout's "Edit this page" link did (owner, 2026-10-05, bean
   * `mftp`: *"lost the links to edit the orignial source on github"*). A page
   * this build GENERATES has no source to edit, so it gets none.
   */
  editBase?: string;
  /**
   * The Publisher's page footer on every page this build writes (#1901):
   * `facts` are the IG package's own values (`assets/ig-footer.json`, the
   * same file the artefact pages' footer reads), laid over what
   * `sushi-config.yaml` says (`sushiFooterData`) — so the IG source fills
   * only what the package does not carry, `copyrightYear` among it. `scope`
   * and `stylesheets` dress it as the artefact pages' footer is dressed;
   * absent, it is unstyled rather than given a hand-typed palette.
   */
  footer?: { facts?: IgFooterData; scope?: string; stylesheets?: string[] };
  /**
   * The site's QA report, a Markdown page with its front matter, written as
   * `qa.md` beside the IG's pages: the page the Publisher calls `qa.html`,
   * which the footer's "QA Report" links and the IG's own links to `qa.html`
   * then reach here rather than at the published IG. The IG's own `qa` page,
   * if its source holds one, wins and this is not written.
   */
  qaPage?: string;
  /**
   * The QA page in other locales, keyed by locale (`ig-qa-page.ts`
   * buildQaPage): each is written to `<locale>/qa.md` with the language
   * picker's front matter and the machine-translation notice, when
   * {@link StageOptions.qaPage} is written.
   */
  qaPages?: Record<string, string>;
  /** The IG's FHIR AST; default `<src>/output-ast`. Its resources become `site.data` (see {@link astResourceData}). */
  ast?: string;
  /**
   * The AST cache commit's tree by URL (`astRawBase`), when the site reads
   * the AST from there: the Questionnaire form pages then fetch each
   * unexpanded Questionnaire from it rather than from a copy in the site.
   */
  astRaw?: string;
  /** The FHIR package cache the dependency table reads; default `FHIR_PACKAGE_CACHE` or `~/.fhir/packages`. */
  packageCache?: string;
  /**
   * The site serves the IG's search (`ig-search.ts`: `assets/ig-search.json`
   * and `assets/ig-search.js` under the docs root, which the caller writes).
   * Given, the top bar and the thin `artifacts` and `toc` pages carry the
   * search box. Absent, no page names files the site may not hold.
   */
  search?: boolean;
}

/** The fields of a `folio-fhir-artifact/v1` entry this build reads. */
export interface IndexedArtifact {
  resourceType: string;
  id: string;
  title?: string;
  category?: string;
  /** Position on the Publisher's `artifacts.html` (see `FhirArtifactSchema.listedAt`). */
  listedAt?: number;
  canonical?: string;
  name?: string;
  version?: string;
  description?: string;
  published?: Partial<Record<"json" | "xml" | "ttl" | "html", { url: string }>>;
}

/**
 * The element keys WHO's `generate_smart_liquid.py` exposes under
 * `elements__*`, in its order. Only the ones the artefact index holds are
 * written; the rest are REPORTED as not sourced, never written empty.
 */
export const ELEMENT_KEYS = ["name", "title", "description", "purpose", "status", "version", "date", "publisher", "copyright", "experimental", "kind", "type"] as const;

/** `<ResourceType>__<id with non-alphanumerics as _>`, the lifted script's own key rule. */
/** Text safe inside a markdown link label. */
const mdLabel = (s: string) => s.replace(/([\\[\]|])/g, "\\$1");

/** Text safe as ONE markdown table cell: a newline would end the row, a pipe the cell. */
export const mdCell = (s: string) => s.replace(/\s+/g, " ").trim().replace(/([\\|])/g, "\\$1");

export const variableKey = (a: { resourceType: string; id: string }) => `${a.resourceType}__${a.id.replace(/[^A-Za-z0-9]/g, "_")}`;

export interface ArtifactVariables {
  /** `site.data.fhir.artifacts.<key>.{url,text,link,elements}` — one entry per artefact. */
  artifacts: Record<string, {
    url: { canonical?: string; page: string; json?: string };
    /**
     * `display` as WHO computes it; `label` is the same text escaped for a
     * markdown link label; `description_cell` is the artefact's description as
     * one markdown table cell (whitespace folded, pipes escaped), empty when it has none.
     */
    text: { display: string; label: string; description_cell: string };
    link: { html: string };
    elements: Partial<Record<(typeof ELEMENT_KEYS)[number], string>>;
    category?: string;
    reference: string;
  }>;
  /**
   * Categories in index order, each naming its artefacts' keys — what a
   * template iterates — with its element id (`anchor`) and how many it lists
   * (`count`), so no template counts or slugs. Uncategorised artefacts (not on
   * the Publisher's `artifacts.html`) are left out.
   */
  artifact_categories: Array<{ name: string; anchor: string; count: number; keys: string[] }>;
  /** How many artefacts `artifact_categories` lists — counted here, so no template counts. */
  artifacts_listed: number;
  /**
   * Per resource type, its artefacts' keys in the order the Publisher's
   * `list-<types>.xhtml` lists them — by displayed title, case-folded — what
   * the `list-*.xhtml` includes iterate (bean `9hfi`). Every artefact of the
   * type, categorised or not: the Publisher's list is by type, not by the
   * `artifacts.html` category.
   */
  artifact_lists: Record<string, { count: number; keys: string[] }>;
}

/**
 * The per-artefact Liquid variables WHO's `generate_smart_liquid.py` computes
 * (`smart__<Type>__<id>__url__page`, …), LIFTED rather than redesigned
 * (`ig-render-jekyll`, `ig-publisher-reduction` §P0; bean `4tts`):
 *
 * - the same families and keys, under `site.data.fhir.artifacts.<Type>__<id>`
 *   — so `smart__ValueSet__Actors__url__page` reads
 *   `site.data.fhir.artifacts.ValueSet__Actors.url.page`;
 * - **no `smart__` prefix**: it is WHO's, and this layer does not know WHO;
 * - **computed in the build that consumes it.** The script writes its include
 *   for the IG Publisher's NEXT build, so its surface takes two builds to
 *   converge; `_data/` is read by the same Jekyll run.
 *
 * Source: the layer's artefact index — the Publisher's post-processed
 * output. `url.page` is this site's page; `url.json` is where the Publisher
 * published the resource's JSON. There is no `url.xml` or `url.ttl`: under P2
 * only JSON is rendered, and since 2026-10-23 XML and Turtle are not linked
 * either (owner: "excise XML and ttl everywhere for now").
 */
export function artifactVariables(list: ReadonlyArray<IndexedArtifact>, pagesHref: string): { vars: ArtifactVariables; notSourced: string[] } {
  const artifacts: ArtifactVariables["artifacts"] = {};
  const order: ArtifactVariables["artifact_categories"] = [];
  const held = new Set<string>();
  // The Publisher's page order: by `listedAt`, which orders the categories
  // (first appearance) and the artefacts within each. Unlisted ones last.
  const ordered = [...list].sort((x, y) => (x.listedAt ?? Infinity) - (y.listedAt ?? Infinity));
  for (const a of ordered) {
    const key = variableKey(a);
    const page = `${pagesHref}${artifactPageName(a)}.html`;
    const display = a.title ?? a.name ?? a.id;
    const elements: ArtifactVariables["artifacts"][string]["elements"] = {};
    for (const k of ["name", "title", "description", "version"] as const) {
      const v = a[k];
      if (v !== undefined) {
        elements[k] = v;
        held.add(k);
      }
    }
    artifacts[key] = {
      url: { canonical: a.canonical, page, json: a.published?.json?.url },
      text: { display, label: mdLabel(display), description_cell: mdCell(a.description ?? "") },
      link: { html: `<a href="${page}">${display.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</a>` },
      elements,
      category: a.category,
      reference: `${a.resourceType}/${a.id}`,
    };
    // An artefact's category comes FROM the Publisher's `artifacts.html`, so
    // one with none is one that page does not list (the WHO SMART Trust IG: the
    // ImplementationGuide itself). Its variables are written; it is not
    // grouped, so the template lists exactly what the Publisher's page does.
    if (a.category === undefined) continue;
    let g = order.find((c) => c.name === a.category);
    if (!g) order.push((g = { name: a.category, anchor: `artifacts-${slug(a.category)}`, count: 0, keys: [] }));
    g.keys.push(key);
    g.count++;
  }
  const artifactLists: ArtifactVariables["artifact_lists"] = {};
  const byTitle = (k: string) => artifacts[k]!.text.display.toLowerCase();
  for (const a of list) (artifactLists[a.resourceType] ??= { count: 0, keys: [] }).keys.push(variableKey(a));
  for (const l of Object.values(artifactLists)) {
    // One entry per key: two ids that differ only in punctuation share a key, as they share its variables.
    l.keys = [...new Set(l.keys)];
    l.keys.sort((x, y) => byTitle(x).localeCompare(byTitle(y)) || x.localeCompare(y));
    l.count = l.keys.length;
  }
  return {
    vars: { artifacts, artifact_categories: order, artifacts_listed: order.reduce((n, c) => n + c.keys.length, 0), artifact_lists: artifactLists },
    notSourced: ELEMENT_KEYS.filter((k) => !held.has(k)),
  };
}

/**
 * The Publisher's `toc.html`: every page in `sushi-config.yaml` `pages:`, nested
 * as declared. A page this build neither holds nor generates is listed as text,
 * not as a link — a link to a page that is not there is the defect this site
 * keeps paying for.
 */
export function tocPage(pages: unknown, has: (stem: string) => boolean): string {
  const lines: string[] = [];
  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== "object") return;
    for (const [file, spec] of Object.entries(node as Record<string, unknown>)) {
      if (file === "title" || file === "generation") continue;
      const sp = (spec ?? {}) as Record<string, unknown>;
      const stem = basename(file, extname(file));
      const title = typeof sp.title === "string" ? sp.title : stem;
      lines.push(`${"  ".repeat(depth)}- ${has(stem) ? `[${mdLabel(title)}](${stem}.html)` : `${mdLabel(title)} (generated by the IG Publisher; not part of this build)`}`);
      walk(sp, depth + 1);
    }
  };
  walk(pages, 0);
  return ["# Table of Contents", "", ...wrapRaw(lines.join("\n")), ""].join("\n");
}

/** A page file's stem, whether it is written as markdown or as a finished thin page. */
const stemOf = (f: string): string => basename(f, extname(f));

/**
 * The thin `toc.html`'s OUTLINE: the IG's own pages as `tocPage` lists them
 * (`sushi-config.yaml` `pages:`, nested as declared, a page this build does
 * not hold as text), as HTML, with the landing page first when `pages:` does
 * not name it. The artefacts below it are drawn from the index node.
 */
export function tocOutlineHtml(pages: unknown, has: (stem: string) => boolean): string {
  const walk = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const items: string[] = [];
    for (const [file, spec] of Object.entries(node as Record<string, unknown>)) {
      if (file === "title" || file === "generation") continue;
      const sp = (spec ?? {}) as Record<string, unknown>;
      const stem = basename(file, extname(file));
      const title = escHtml(typeof sp.title === "string" ? sp.title : stem);
      const label = has(stem) ? `<a href="${escHtml(stem)}.html">${title}</a>` : `${title} <em>(generated by the IG Publisher; not part of this build)</em>`;
      items.push(`<li>${label}${walk(sp)}</li>`);
    }
    return items.length ? `<ul>${items.join("")}</ul>` : "";
  };
  const named = pages && typeof pages === "object" && Object.keys(pages as object).some((f) => basename(f, extname(f)) === "index");
  const tree = walk(pages);
  const home = !named && has("index") ? `<li><a href="index.html">Home</a></li>` : "";
  const inner = tree.replace(/^<ul>|<\/ul>$/g, "");
  return home || inner ? `<h2>Pages</h2><ul class="igi-outline">${home}${inner}</ul>` : "";
}

/**
 * The Publisher's `artifacts.html`, as a LIQUID TEMPLATE over
 * `site.data.fhir` — Jekyll renders it, from the variables this same build
 * wrote (owner, 2026-10-01: "make use of jekyll/liquid templates"). No
 * artefact data is baked into the page; change the data and the page follows.
 * The template is a file of this directory (`liquid-templates` §"Where a
 * template lives"), found relative to this one.
 */
export const ARTIFACTS_TEMPLATE_PATH = resolve(import.meta.dir, "templates/ig-site/artifacts.liquid");
export const RELEASES_TEMPLATE_PATH = resolve(import.meta.dir, "templates/ig-site/releases.liquid");
/** The Publisher's page footer, a Liquid include over `site.data.fhir.footer` (#1901). */
export const FOOTER_TEMPLATE_PATH = resolve(import.meta.dir, "templates/ig-site/ig-footer.liquid");
/** The Publisher's `list-(simple-)?<types>.xhtml`, a Liquid include over `site.data.fhir.artifact_lists` (bean `9hfi`). */
export const ARTIFACT_LIST_TEMPLATE_PATH = resolve(import.meta.dir, "templates/ig-site/artifact-list.liquid");
/** Its name under `_includes/`: prefixed, so it cannot collide with an include the IG's own source holds. */
export const IG_FOOTER_INCLUDE = "fa-ig-footer.html";

/**
 * Each page's previous and next page, as the Publisher links them: the IG's
 * table-of-contents order (`sushi-config.yaml` `pages:`), skipping what this
 * site does not hold. A page outside that order gets neither.
 */
export function pageSequence(pages: unknown, held: (stem: string) => boolean): Map<string, { prev?: string; next?: string }> {
  const order = [...pageNav(pages).keys()].filter(held);
  return new Map(
    order.map((stem, i) => [
      stem,
      { ...(i > 0 ? { prev: `${order[i - 1]}.html` } : {}), ...(i < order.length - 1 ? { next: `${order[i + 1]}.html` } : {}) },
    ]),
  );
}

/** A byte count as the Publisher's download pages show one: one decimal, in KB or MB. */
export function sizeLabel(bytes: number): string {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

/** `site.data.ig_releases`, which `releases.liquid` reads: every value computed here, none in Liquid. */
export function releaseVariables(r: IgReleases) {
  return {
    repository: r.repository,
    read_at: r.readAt,
    releases: r.releases.map((x) => ({
      tag: x.tag,
      name: x.name ?? x.tag,
      url: x.url,
      published: x.publishedAt.slice(0, 10),
      prerelease: x.prerelease,
      assets: x.assets.map((a) => ({ name: a.name, url: a.url, size: sizeLabel(a.bytes), digest: a.digest ?? null })),
    })),
  };
}

/**
 * The four roles a theme palette carries (`ThemePaletteSchema` in
 * `cat-harness-tools/schemas/ui/theme.ts`). Structural, so this layer takes a palette
 * without knowing whose it is: fhir-harness never names an IG's branding.
 */
export interface SitePalette {
  surface: string;
  ink: string;
  edge: string;
  accent: string;
}

/** WCAG 2 relative luminance of a `#rgb`/`#rrggbb` colour; undefined for anything else. */
export function luminance(colour: string): number | undefined {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (!m) return undefined;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two colours; undefined when either is not hex. */
export function contrast(a: string, b: string): number | undefined {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === undefined || lb === undefined) return undefined;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ColourScheme {
  scss: string;
  /** The role whose colour the sidebar's text takes, chosen by contrast against `accent`. */
  sidebarText: "ink" | "surface";
  /** That contrast; undefined when it could not be computed. */
  sidebarContrast: number | undefined;
  /** Each pairing below WCAG AA (4.5:1) or not computable — reported, never hidden. */
  findings: string[];
}

/** WCAG 2 AA for body text. */
const AA = 4.5;

/**
 * A palette as a just-the-docs colour scheme (bean `u3cd`).
 *
 * The sidebar takes `accent`, as the IG's own chrome does; its text then
 * needs a colour the palette has, so it is CHOSEN between `ink` and
 * `surface` by contrast against `accent` rather than written as a literal.
 * Pairings below AA are listed in `findings`, and so is a colour whose
 * contrast cannot be computed (a named colour, say): could-not-determine is
 * not a pass.
 */
export function colourScheme(p: SitePalette): ColourScheme {
  const onAccent = { ink: contrast(p.ink, p.accent), surface: contrast(p.surface, p.accent) };
  const sidebarText: "ink" | "surface" = (onAccent.surface ?? -1) > (onAccent.ink ?? -1) ? "surface" : "ink";
  const sidebarContrast = onAccent[sidebarText];
  const findings: string[] = [];
  const pairs: [string, string, string][] = [
    ["ink on surface (body text)", p.ink, p.surface],
    ["accent on surface (links)", p.accent, p.surface],
    [`${sidebarText} on accent (sidebar text)`, p[sidebarText], p.accent],
  ];
  for (const [what, fg, bg] of pairs) {
    const c = contrast(fg, bg);
    if (c === undefined) findings.push(`${what}: contrast not computable (${fg} on ${bg}) — not verified`);
    else if (c < AA) findings.push(`${what}: ${c.toFixed(2)}:1 is below WCAG AA ${AA}:1`);
  }
  const text = p[sidebarText];
  const scss = [
    "// GENERATED by fhir-harness/scripts/build-ig-site.ts from the IG instance's declared",
    "// webpage theme (bean u3cd). Edit the theme, not this file.",
    "// just-the-docs imports its light scheme BEFORE this file, so anything light",
    "// DERIVES is already fixed by then: the active item's highlight",
    "// ($feedback-color, darken($sidebar-color, 3%)) is re-derived below from",
    "// this palette, or it stays light grey under light text.",
    `$body-background-color: ${p.surface};`,
    `$body-text-color: ${p.ink};`,
    `$body-heading-color: ${p.ink};`,
    `$link-color: ${p.accent};`,
    `$btn-primary-color: ${p.accent};`,
    `$border-color: ${p.edge};`,
    `$sidebar-color: ${p.accent};`,
    `$nav-child-link-color: ${text};`,
    "$feedback-color: darken($sidebar-color, 3%);",
    "",
  ].join("\n");
  return { scss, sidebarText, sidebarContrast, findings };
}

/**
 * Rules the scheme's variables cannot reach: just-the-docs colours top-level
 * nav links and the site title with `$link-color`/`$body-heading-color`, which
 * on an `accent` sidebar would be accent on accent. Every colour here is a
 * palette role, via the scheme's own variables.
 */
export const SIDEBAR_SCSS = [
  "// GENERATED by fhir-harness/scripts/build-ig-site.ts (bean u3cd).",
  ".side-bar, .side-bar .site-title, .side-bar .nav-list .nav-list-item .nav-list-link,",
  ".side-bar .nav-list .nav-list-item .nav-list-expander, .side-bar .site-footer, .side-bar .site-footer a { color: $nav-child-link-color; }",
  ".side-bar .nav-list .nav-list-item .nav-list-link.active { font-weight: 700; }",
  "",
].join("\n");

/**
 * TABLE CELLS THAT NAME SOMETHING THIS SITE SERVES BECOME LINKS.
 *
 * Owner, 2026-10-10: on the WHO SMART Immunizations IG, the decision-logic table's
 * `IMMZ.D2.DT.BCG`, the business-processes table's process name and id, and the
 * indicators table's `IMMZ.IND.01` should be clickable. The IG's markdown writes
 * them as bare text, because on WHO's own site nothing pairs them up either.
 *
 * Two kinds of target, both looked up and never guessed:
 * - **an artefact**, by its title, name or id, exactly; or by its id with the
 *   punctuation dropped (`IMMZ.IND.01` -> Measure `IMMZIND01`). A key two
 *   artefacts share links neither, because a wrong link is worse than none;
 * - **a heading on the same page**, by its text with a leading enumerator
 *   (`A.`, `H .`) dropped, linked at kramdown's own auto-id for that heading.
 *
 * A row in which one cell resolved also links its identifier-shaped cells (no
 * spaces, contains a dot: `IMMZ.A`) to the same target when they resolve to
 * nothing themselves. That is the process table's id column, whose processes are
 * figures, not FHIR artefacts. A cell that already holds a link or markup
 * is left alone.
 */
/** One annex: the page it belongs on, its JSON, and the columns shown before a row is opened. */
export interface IgAnnex {
  /** The page file under `input/pagecontent/`, e.g. `dictionary.md`. */
  page: string;
  /** Absolute path of the annex: `.json` (a table, loaded on demand) or `.md` (appended to the page as written). */
  src: string;
  /** Column keys shown in the table; the rest appear when a row is opened. Default: the first six. */
  columns?: string[];
}

export const ANNEX_SCRIPT_PATH = join(import.meta.dir, "templates", "ig-site", "ig-annex.js");

/**
 * The mount point an annex page carries; `ig-annex.js` finds it by class.
 *
 * The links are relative to the PAGE, not `{{ site.baseurl }}`. The JSON and
 * the renderer are written beside the IG's pages (`<out>/assets/…`), and the
 * pages are flat in `<out>`. Composed into a host at `/<instance>/`, the
 * base is the HOST's, so `{{ site.baseurl }}/assets/annex/` pointed at the
 * host's root, where nothing is (measured 2026-10-30 on a published IG
 * composed at `/<instance>/`: `<instance>/dictionary.html` asked for
 * `../assets/annex/…`, while the file is at `<instance>/assets/annex/…`).
 * A page-relative path is right both
 * at a site's root and inside a host.
 */
export function annexMount(file: string, columns?: ReadonlyArray<string>): string {
  const cols = columns?.length ? ` data-columns="${columns.map((c) => c.replace(/"/g, "&quot;")).join("|")}"` : "";
  return (
    `\n\n<div class="fa-annex" data-src="assets/annex/${file}"${cols}>` +
    `<p>Loading the annex… If it does not appear, <a href="assets/annex/${file}">the data is here as JSON</a>.</p></div>\n` +
    `<script src="assets/js/ig-annex.js" defer></script>\n`
  );
}

export function artifactCellLookup(list: ReadonlyArray<IndexedArtifact>, pagesHref: string): Map<string, string> {
  const hits = new Map<string, Set<string>>();
  const add = (k: string | undefined, href: string) => {
    if (!k) return;
    const key = k.trim();
    if (!key) return;
    (hits.get(key) ?? hits.set(key, new Set()).get(key)!).add(href);
  };
  for (const a of list) {
    const href = `${pagesHref}${artifactPageName(a)}.html`;
    add(a.title, href);
    add(a.name, href);
    add(a.id, href);
    add(`~${dotless(a.id)}`, href);
  }
  const out = new Map<string, string>();
  for (const [k, v] of hits) if (v.size === 1) out.set(k, [...v][0]!);
  return out;
}

function dotless(s: string): string {
  return s.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

/** kramdown's auto_ids: lowercased, characters other than letters, digits, spaces and hyphens dropped, spaces to hyphens. */
export function kramdownId(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/ /g, "-");
}

export function linkTableCells(body: string, lookup: ReadonlyMap<string, string>, prefix = ""): { text: string; count: number } {
  // Headings on this page, keyed by their text without an enumerator.
  const headings = new Map<string, string>();
  for (const m of body.matchAll(/^#{1,6}[ \t]+(.+?)[ \t#]*$/gm)) {
    const text = m[1]!.trim();
    const bare = text.replace(/^[A-Z0-9]{1,3}\s*\.\s+/, "").trim();
    if (bare && bare !== text) headings.set(bare, `#${kramdownId(text)}`);
  }
  const resolve = (raw: string): string | undefined => {
    const t = raw.trim();
    if (!t || /[<>\[\]()`]/.test(t)) return undefined;
    const art = lookup.get(t) ?? lookup.get(`~${dotless(t)}`);
    if (art) return prefix + art;
    return headings.get(t);
  };
  const idShaped = (t: string) => /^[A-Za-z0-9]+(\.[A-Za-z0-9]+)+$/.test(t.trim());
  let count = 0;

  // Markdown tables: rows of `| a | b |`.
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!/^\s*\|.*\|\s*$/.test(line) || /^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    const cells = line.split(/(?<!\\)\|/);
    const inner = cells.slice(1, -1);
    const strip = (c: string) => {
      const m = /^(\s*)(\*\*|__)?(.*?)(\*\*|__)?(\s*)$/.exec(c)!;
      return { lead: m[1]!, open: m[2] ?? "", text: m[3]!, close: m[4] ?? "", trail: m[5]! };
    };
    const parts = inner.map(strip);
    const targets = parts.map((p) => (p.open === p.close ? resolve(p.text) : undefined));
    const rowTarget = targets.find((t) => t !== undefined);
    if (!rowTarget) continue;
    const next = parts.map((p, k) => {
      const href = targets[k] ?? (idShaped(p.text) && p.open === p.close ? rowTarget : undefined);
      if (!href) return inner[k]!;
      count++;
      return `${p.lead}[${p.open}${p.text}${p.close}](${href})${p.trail}`;
    });
    lines[i] = [cells[0], ...next, cells[cells.length - 1]].join("|");
  }
  let text = lines.join("\n");

  // HTML tables: `<td>` cells holding plain text only.
  text = text.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/g, (row) => {
    const cells = [...row.matchAll(/(<td\b[^>]*>)([^<]*)(<\/td>)/g)];
    const targets = cells.map((c) => resolve(c[2]!));
    const rowTarget = targets.find((t) => t !== undefined);
    if (!rowTarget) return row;
    let k = 0;
    return row.replace(/(<td\b[^>]*>)([^<]*)(<\/td>)/g, (whole, open: string, inner: string, close: string) => {
      const href = targets[k] ?? (idShaped(inner) ? rowTarget : undefined);
      k++;
      if (!href) return whole;
      count++;
      const lead = /^\s*/.exec(inner)![0];
      const trail = /\s*$/.exec(inner)![0];
      return `${open}${lead}<a href="${href}">${inner.trim()}</a>${trail}${close}`;
    });
  });
  return { text, count };
}

/**
 * Stage the IG at `igSrc` into `out`.
 *
 * Only what the repository's `contentTypes.ig.include` declares is read
 * (`ig-read-scope.ts`). A source holding anything else is staged from a
 * copy of the declared paths, so no reader below can reach the rest. An IG
 * that declares no section is staged from where it is, as before, with one
 * warning naming the missing declaration.
 */
export function stageIgSite(igSrc: string, out: string, opts: StageOptions = {}): StageResult {
  const scope = igReadScope(igSrc);
  if (onlyDeclared(scope)) return stageDeclaredSource(scope.root, out, opts);
  const view = mkdtempSync(join(tmpdir(), "ig-declared-"));
  try {
    copyDeclared(scope, view);
    return stageDeclaredSource(view, out, opts);
  } finally {
    rmSync(view, { recursive: true, force: true });
  }
}

function stageDeclaredSource(igSrc: string, out: string, opts: StageOptions): StageResult {
  const { baseurl = "", plantumlJar } = opts;
  const src = resolve(igSrc);
  const sushi = parseYaml(readFileSync(join(src, "sushi-config.yaml"), "utf-8")) as Record<string, unknown>;
  const fromMenu = opts.menu ? menuNav(opts.menu) : undefined;
  const nav = fromMenu?.nav ?? pageNav(sushi.pages);
  mkdirSync(join(out, "_includes"), { recursive: true });
  mkdirSync(join(out, "_data"), { recursive: true });

  const pagecontent = join(src, "input", "pagecontent");
  const pages: string[] = [];
  const unlisted: string[] = [];
  const filled: string[] = [];
  const usedMarkers = new Set<string>();
  const artifactPages = new Set([...(opts.artifacts?.list ?? []).map((a) => artifactPageName(a)), ...(opts.artifacts?.pages ?? [])]);
  const annexed: string[] = [];
  let jsonAnnexes = 0;
  const cellLookup = opts.artifacts ? artifactCellLookup(opts.artifacts.list, opts.artifacts.pagesHref) : undefined;
  let relinked = 0;
  const canonical = typeof sushi.canonical === "string" ? sushi.canonical : undefined;
  const sourceBlob = opts.editBase?.replace(/\/$/, "").replace(/\/edit\//, "/blob/");
  // What THIS site serves at a bare relative name: the IG's pages, its
  // `input/images/*` (published at the root), the artefact pages, and the
  // artefact index page.
  const pageHtml = new Set(files(pagecontent).filter((f) => f.endsWith(".md")).map((f) => `${basename(f, ".md")}.html`));
  const rootImages = new Set(filesDeep(join(src, "input", "images")));
  const isServed = (t: string): boolean =>
    pageHtml.has(t) ||
    (opts.qaPage !== undefined && t === IG_QA_PAGE) || rootImages.has(t) || (opts.artifacts !== undefined && (t === "artifacts.html" || t.startsWith(opts.artifacts.pagesHref)));
  const dead = new Set<string>();
  const relink = (text: string): string => {
    let t = text;
    if (canonical) {
      const p = relinkPublisherOutputs(t, canonical);
      relinked += p.count;
      t = p.text;
    }
    if (opts.artifacts) {
      const r = relinkArtifacts(t, artifactPages, opts.artifacts.pagesHref);
      relinked += r.count;
      t = r.text;
    }
    const o = relinkOffSite(t, { canonical, sourceBlob, srcRoot: src, isServed });
    relinked += o.count;
    for (const d of o.dead) dead.add(d);
    return o.text;
  };
  // The IG's page catalogues (fhir-harness#382): `translations/` when the IG
  // declares it in `contentTypes.ig.include`, read from the staged copy so
  // the read scope holds.
  const pageLocs = pageLocales(join(src, "translations"));
  const translatedPages: string[] = [];
  const pageStems = new Set(files(pagecontent).filter((f) => f.endsWith(".md")).map((f) => basename(f, ".md")));
  const sourceOf = (stem: string): string | undefined => (pageStems.has(stem) ? readFileSync(join(pagecontent, `${stem}.md`), "utf-8") : undefined);
  const localesOf = (stem: string): string[] => [SOURCE_LOCALE, ...pageLocs.filter((l) => hasTranslation(stem, l, sourceOf, pageStems)).map((l) => l.locale)];
  // The IG's menu in each locale that translates it (fhir-harness#417). Its
  // labels are on every page, so a locale whose menu no person reviewed makes
  // every page in that locale "not reviewed" (fail closed).
  const igTitle = typeof sushi.title === "string" ? sushi.title : String(sushi.id ?? "IG");
  const menuLocs: Map<string, MenuLocale> = opts.menu ? menuLocales(join(src, "translations"), menuLabels(opts.menu, igTitle)) : new Map();
  const translatedHere = (locale: string): Set<string> => {
    const l = pageLocs.find((x) => x.locale === locale);
    return new Set(l ? [...pageStems].filter((k) => hasTranslation(k, l, sourceOf, pageStems)).map((k) => `${k}.html`) : []);
  };
  for (const f of files(pagecontent).filter((f) => f.endsWith(".md"))) {
    const name = basename(f, ".md");
    const raw = readFileSync(join(pagecontent, f), "utf-8");
    let n = nav.get(name);
    if (!n) {
      unlisted.push(f);
      // After every listed page, in file order: the source does not place it.
      // Under a menu it stays reachable but out of the nav, as on the IG.
      n = { title: name, navOrder: 1000 + unlisted.length, ...(fromMenu ? { navExclude: true } : {}) };
    }
    // One page's Markdown, English or translated, through the same steps.
    const render = (md: string, collect: boolean, locale?: string): { body: string; data: Record<string, unknown> } => {
    let body = relink(md);
    if (cellLookup) {
      const c = linkTableCells(body, cellLookup);
      body = c.text;
      relinked += c.count;
    }
    // Standard HL7 IG Publisher macro for localized includes: {% lang-fragment <file> %},
    // the locale's own `<file>-<locale>` on a translated page when the IG has one.
    body = resolveLangFragments(body, locale, (n) => isSafeIncludeName(n) && ["input/includes", "input/pagecontent"].some((d) => existsSync(join(src, d, n))));
    let data: Record<string, unknown> = opts.editBase
      ? {
          ig_edit_url: `${opts.editBase.replace(/\/$/, "")}/input/pagecontent/${f}`,
          // Per-section source links (owner, 2026-10-05: "feedback on (sub-*)sections
          // should link to line numbers if possible"): each heading's line in the
          // ORIGINAL file, read before anything here rewrites it.
          ig_source_blob: `${opts.editBase.replace(/\/$/, "").replace(/\/edit\//, "/blob/")}/input/pagecontent/${f}`,
          // The same facts, apart, for the shared link recipe (bean v433).
          ...editBaseParts(opts.editBase, `input/pagecontent/${f}`),
          // Through the page's includes (bean `x78e`): an IG's index.md is
          // only `{% include index-ig.md %}`, and its headings live there.
          ig_source_lines: sourceHeadings(readFileSync(join(pagecontent, f), "utf-8"), includeSource(src), new Set([`input/pagecontent/${f}`])).map(
            ({ p, ...h }) => (p ? { ...h, b: `${sourceBlob}/${p}` } : h),
          ),
        }
      : {};
    for (const fill of opts.fills ?? []) {
      if (!body.includes(fill.marker)) continue;
      body = body.split(fill.marker).join(fill.body);
      data = { ...data, ...fill.data };
      if (collect) {
        filled.push(`${f} (${fill.marker})`);
        usedMarkers.add(fill.marker);
      }
    }
    for (const a of (opts.annexes ?? []).filter((x) => x.page === f)) {
      if (collect) annexed.push(`${f} <- ${basename(a.src)}`);
      // A MARKDOWN annex is content the layer's graph holds for this page
      // (a cross-reference section, say) and is appended as written. A JSON
      // one is a table, loaded when the page opens.
      if (a.src.endsWith(".md")) {
        body += `\n\n${readFileSync(a.src, "utf-8").trim()}\n`;
        continue;
      }
      mkdirSync(join(out, "assets", "annex"), { recursive: true });
      copyFileSync(a.src, join(out, "assets", "annex", basename(a.src)));
      body += annexMount(basename(a.src), a.columns);
      jsonAnnexes++;
    }
    return { body, data };
    };
    const en = render(raw, true);
    const available = localesOf(name);
    const localeData = available.length > 1 ? localeFrontMatter({ lang: SOURCE_LOCALE, available }) : {};
    writePage(join(out, f), en.body, { ...en.data, ...localeData }, n);
    pages.push(f);
    for (const l of pageLocs) {
      if (!available.includes(l.locale)) continue;
      // Reviewed only when a record says a person reviewed EVERY catalogue whose
      // words are on the page; anything else, including no record, is not (fail closed).
      const review = new Map<string, boolean>();
      const unreviewed = (stem: string): boolean => {
        if (!review.has(stem)) review.set(stem, !pageReview(l, stem, sourceOf(stem)).reviewed);
        return review.get(stem)!;
      };
      const t = translateWithIncludes(name, l, sourceOf, pageStems, 0, { unreviewed, label: unreviewedLabel(l.locale) });
      const reviewed = t.contributors.length > 0 && t.contributors.every((c) => !unreviewed(c)) && (menuLocs.get(l.locale)?.reviewed ?? true);
      const here = new Set([...pageStems].filter((k) => hasTranslation(k, l, sourceOf, pageStems)).map((k) => `${k}.html`));
      const tr = render(t.md, false, l.locale);
      const body = relinkForLocale(tr.body, here);
      const data = {
        ...tr.data,
        ...localeFrontMatter({ lang: l.locale, available, status: reviewed ? "verified" : "unverified", source: `${name}.html`, reviewed }),
        // Not `dir`: Jekyll's own `page.dir` is the page's folder, which drew `dir="/"` on every page.
        text_dir: dirFor(l.locale),
        translated_spans: `${t.translated}/${t.total}`,
      };
      // Out of the menu: the picker, not the nav, leads to it.
      writePage(join(out, l.locale, f), body, { ...data, nav_exclude: true }, { title: n.title, navOrder: n.navOrder });
      translatedPages.push(`${l.locale}/${f}`);
    }
  }

  if (jsonAnnexes) {
    mkdirSync(join(out, "assets", "js"), { recursive: true });
    copyFileSync(ANNEX_SCRIPT_PATH, join(out, "assets", "js", "ig-annex.js"));
  }
  const unplaced = (opts.annexes ?? []).filter((a) => !pages.includes(a.page)).map((a) => `${a.page} (${basename(a.src)})`);

  // Pages the Publisher GENERATES rather than reads from pagecontent, written
  // here from data this build holds (bean `jut3`'s parity list). Reported apart
  // from `pages`, so a generated page is never mistaken for the IG's source.
  const generated: string[] = [];
  // THIN (the default when the index node is given): the two list pages are
  // written after the reading order is known, below; here they are only held.
  const thinIndex = opts.artifacts?.index !== undefined ? opts.artifacts : undefined;
  if (thinIndex && !pages.includes("artifacts.md")) generated.push("artifacts.html");
  if (opts.artifacts && !thinIndex && !pages.includes("artifacts.md")) {
    const n = nav.get("artifacts") ?? { title: "Artifacts Summary", navOrder: 999, navExclude: true };
    writeFileSync(join(out, "artifacts.md"), frontMatter(n) + readFileSync(ARTIFACTS_TEMPLATE_PATH, "utf-8"));
    generated.push("artifacts.md");
  }
  if (opts.releases && !pages.includes("releases.md")) {
    // Listed in the nav, last: the owner asked for the release binaries to be
    // findable from the IG's pages (bean `b8ip`).
    writeFileSync(join(out, "releases.md"), frontMatter(nav.get("releases") ?? { title: "Releases", navOrder: 998 }) + readFileSync(RELEASES_TEMPLATE_PATH, "utf-8"));
    writeFileSync(join(out, "_data", "ig_releases.json"), JSON.stringify(releaseVariables(opts.releases), null, 2) + "\n");
    generated.push("releases.md");
  }
  let qa: StageResult["qa"];
  if (opts.qaPage !== undefined) {
    if (pages.includes("qa.md")) qa = "the IG's source holds its own qa page";
    else {
      // The QA page's languages (owner, 2026-11-14: "For this page why is there no translation?").
      // The page carries its own front matter; this is only writePage's fallback.
      const QA_NAV: PageNav = { title: "QA Report", navOrder: 999, navExclude: true };
      const qaLocales = Object.keys(opts.qaPages ?? {}).filter((l) => l !== SOURCE_LOCALE);
      const available = [SOURCE_LOCALE, ...qaLocales];
      if (qaLocales.length) writePage(join(out, "qa.md"), opts.qaPage, localeFrontMatter({ lang: SOURCE_LOCALE, available }), QA_NAV);
      else writeFileSync(join(out, "qa.md"), opts.qaPage);
      generated.push("qa.md");
      for (const l of qaLocales) {
        // Never reviewed by a person: its words are the Publisher's and an agent's translations.
        const data = { ...localeFrontMatter({ lang: l, available, status: "unverified", source: "qa.html", reviewed: false }), text_dir: dirFor(l) };
        writePage(join(out, l, "qa.md"), opts.qaPages![l]!, data, QA_NAV);
        translatedPages.push(`${l}/qa.md`);
      }
      qa = "written";
    }
  }
  if (thinIndex && !pages.includes("toc.md")) generated.push("toc.html");
  else if (!pages.includes("toc.md")) {
    const has = (stem: string) => pages.includes(`${stem}.md`) || generated.includes(`${stem}.md`) || stem === "toc";
    writeFileSync(join(out, "toc.md"), frontMatter(nav.get("toc") ?? { title: "Table of Contents", navOrder: 1000, navExclude: true }) + tocPage(sushi.pages, has));
    generated.push("toc.md");
  }

  // One section page per menu group, and the items that have no page here.
  const menuMissing: string[] = [];
  const held = new Set([...pages, ...generated].map(stemOf));
  for (const g of fromMenu?.groups ?? []) {
    // just-the-docs lists a parent's children itself; the page adds only
    // what that list cannot show: items the Publisher generates.
    const missing = g.items.filter((it) => !held.has(basename(it.href, extname(it.href))));
    for (const it of missing) menuMissing.push(it.href);
    const note = missing.map((it) => `- ${it.label}: generated by the IG Publisher, not part of this build`).join("\n");
    writeFileSync(join(out, `${g.stem}.md`), frontMatter(nav.get(g.stem)!) + `# ${g.label}\n\n` + (note ? note + "\n" : ""));
  }

  let includes = 0;
  // The local template's includes first, so the IG's own of the same name win.
  const templateIncludes = localTemplateIncludes(src);
  const artifactTypes = new Set((opts.artifacts?.list ?? []).map((a) => a.resourceType));
  let fromTemplate = 0;
  for (const f of templateIncludes ? files(templateIncludes) : []) {
    if (/\.(liquid|html|md)$/.test(f)) {
      let t = rubyLiquidStrings(readFileSync(join(templateIncludes!, f), "utf-8")).text;
      if (opts.artifacts) {
        const r = relinkArtifacts(t, artifactPages, opts.artifacts.pagesHref);
        const tr = relinkTemplatedArtifacts(r.text, artifactTypes, opts.artifacts.pagesHref);
        relinked += r.count + tr.count;
        t = tr.text;
      }
      writeFileSync(join(out, "_includes", f), t);
    } else copyFileSync(join(templateIncludes!, f), join(out, "_includes", f));
    fromTemplate++;
    includes++;
  }
  const templateIncludesResult = templateIncludes ? { dir: relative(src, templateIncludes), files: fromTemplate } : undefined;
  for (const dir of [join(src, "input", "includes"), pagecontent]) {
    for (const f of files(dir)) {
      // A transcluded page carries the same flat artefact links as a page does.
      if (dir === pagecontent && f.endsWith(".md")) writeFileSync(join(out, "_includes", f), relink(readFileSync(join(dir, f), "utf-8")));
      else if (/\.(liquid|html|md)$/.test(f)) writeFileSync(join(out, "_includes", f), rubyLiquidStrings(readFileSync(join(dir, f), "utf-8")).text);
      else copyFileSync(join(dir, f), join(out, "_includes", f));
      includes++;
    }
  }
  const imagesDir = join(src, "input", "images");
  let images = 0;
  const unparseable: string[] = [];
  const reserved: string[] = [];
  const svgMinified = { files: 0, saved: 0 };
  for (const f of filesDeep(imagesDir)) {
    const owner = opts.reservedPaths?.find((p) => (p.prefix.endsWith("/") ? f.startsWith(p.prefix) : f === p.prefix));
    if (owner) {
      reserved.push(`${f} (${owner.by})`);
      continue;
    }
    if (/\.(json|jsonld)$/.test(f)) {
      try {
        JSON.parse(readFileSync(join(imagesDir, f), "utf-8"));
      } catch (e) {
        unparseable.push(`${f} (${(e as Error).message})`);
        continue;
      }
    }
    // A subdirectory is published as a subdirectory, as the Publisher does, so
    // a page's `<script src="demo/app.js">` resolves.
    if (f.includes("/")) mkdirSync(join(out, dirname(f)), { recursive: true });
    if (f.endsWith(".html") && canonical) {
      const r = relinkPublisherTemplateAssets(readFileSync(join(imagesDir, f), "utf-8"), canonical);
      relinked += r.count;
      writeFileSync(join(out, f), r.text);
    } else if (f.endsWith(".svg")) {
      // Published without the drawing editor's own records and the whitespace
      // between tags (`svg-minify.ts`): the same picture in fewer bytes.
      const bytes = readFileSync(join(imagesDir, f));
      const small = minifySvgBytes(bytes);
      writeFileSync(join(out, f), small);
      if (small.length < bytes.length) {
        svgMinified.files++;
        svgMinified.saved += bytes.length - small.length;
      }
    } else {
      copyFileSync(join(imagesDir, f), join(out, f));
    }
    // `{% include x.svg %}` names a file, so only the top level is includable.
    if (f.endsWith(".svg") && !f.includes("/")) {
      copyFileSync(join(imagesDir, f), join(out, "_includes", f));
      includes++;
    }
    images++;
  }

  // Diagrams the Publisher renders from images-source, and anything else a page
  // includes that the source does not hold.
  const rendered: string[] = [];
  const listed: string[] = [];
  const notRendered: string[] = [];
  const refusedIncludes: string[] = [];
  const dependencyTables: string[] = [];
  let globalsIncluded = false;
  const imagesSource = join(src, "input", "images-source");
  const wanted = new Set(pages.flatMap((f) => includeTargets(readFileSync(join(out, f), "utf-8"))));
  for (const name of [...wanted].sort()) {
    // An include name becomes a path under _includes: one safe segment, or refused.
    if (!isSafeIncludeName(name)) {
      refusedIncludes.push(name);
      continue;
    }
    if (existsSync(join(out, "_includes", name))) continue;
    const puml = join(imagesSource, basename(name, extname(name)) + ".plantuml");
    if (name.endsWith(".svg") && existsSync(puml) && plantumlJar) {
      execFileSync("java", ["-jar", plantumlJar, "-tsvg", "-o", join(out, "_includes"), puml], { stdio: "ignore" });
      if (existsSync(join(out, "_includes", name))) {
        rendered.push(name);
        continue;
      }
    }
    const tempInclude = join(src, "temp", "pages", "_includes", name);
    if (existsSync(tempInclude)) {
      copyFileSync(tempInclude, join(out, "_includes", name));
      rendered.push(name);
      continue;
    }
    // The Publisher's list of one type's artefacts, from the artefact index
    // whichever source produced it (the published IG, or an AST) — the same
    // data `artifacts.md` reads, so the two pages cannot disagree (bean `9hfi`).
    const listOf = opts.artifacts ? artifactListInclude(name) : undefined;
    if (listOf) {
      writeFileSync(join(out, "_includes", name), `{% include ${ARTIFACT_LIST_INCLUDE} type="${listOf.resourceType}"${listOf.simple ? ' simple="simple"' : ""} %}\n`);
      writeFileSync(join(out, "_includes", ARTIFACT_LIST_INCLUDE), readFileSync(ARTIFACT_LIST_TEMPLATE_PATH, "utf-8"));
      listed.push(name);
      continue;
    }
    // The Publisher's package dependency table, from site.data.fhir.dependencies (bean `4475`).
    const depForm = DEPENDENCY_FRAGMENTS[name];
    if (depForm) {
      writeFileSync(join(out, "_includes", name), `{% include ${DEPENDENCY_TABLE_INCLUDE} form="${depForm}" %}\n`);
      writeFileSync(join(out, "_includes", DEPENDENCY_TABLE_INCLUDE), readFileSync(DEPENDENCY_TABLE_TEMPLATE_PATH, "utf-8"));
      dependencyTables.push(name);
      continue;
    }
    // The Publisher's global profiles table, from site.data.fhir.globals.
    if (name === GLOBALS_FRAGMENT) {
      writeFileSync(join(out, "_includes", name), `{% include ${GLOBALS_TABLE_INCLUDE} %}\n`);
      writeFileSync(join(out, "_includes", GLOBALS_TABLE_INCLUDE), readFileSync(GLOBALS_TABLE_TEMPLATE_PATH, "utf-8"));
      globalsIncluded = true;
      continue;
    }
    writeFileSync(join(out, "_includes", name), notRenderedMarker(name, existsSync(puml) ? `input/images-source/${basename(puml)}` : "a source this build does not hold"));
    notRendered.push(name);
  }

  // The Publisher's footer on every page written above (#1901): flagged in
  // front matter for the layout to draw, with the page's place in the IG's
  // table-of-contents order. Without a menu there is no generated layout, so
  // the footer goes into the page itself.
  const written = [...pages, ...generated, ...(fromMenu?.groups ?? []).map((g) => `${g.stem}.md`)];
  const heldStems = new Set(written.map(stemOf));
  const sequence = pageSequence(sushi.pages, (stem) => heldStems.has(stem));
  if (thinIndex) {
    // The docs root the artefact pages hang off (`artifact/` → `""`,
    // `../artifact/` → `../`): where `assets/` is, renderer and footer data.
    const root = thinIndex.pagesHref.replace(/artifact\/$/, "");
    const outline = tocOutlineHtml(sushi.pages, (stem) => heldStems.has(stem));
    for (const f of generated.filter((g) => g.endsWith(".html"))) {
      const stem = stemOf(f);
      const at = sequence.get(stem);
      const html = thinIndexPage({
        view: stem === "toc" ? "toc" : "artifacts",
        heading: stem === "toc" ? "Table of Contents" : "Artifacts Summary",
        label: typeof sushi.title === "string" ? sushi.title : String(sushi.id ?? "IG"),
        canonical: f,
        index: thinIndex.index!,
        pagesHref: thinIndex.pagesHref,
        assets: root,
        home: "index.html",
        artifacts: "artifacts.html",
        toc: "toc.html",
        ...(at?.prev ? { prev: at.prev } : {}),
        ...(at?.next ? { next: at.next } : {}),
        ...(stem === "toc" ? { outline } : {}),
        ...(opts.search ? { search: { index: `${root}${IG_SEARCH_INDEX_FILE}`, script: `${root}${IG_SEARCH_SCRIPT_FILE}` } } : {}),
      });
      // The artefact index's viewer declaration, which the full page took as
      // front matter (`gen-ig-pages`' front-matter-only `artifacts.md`).
      writeFileSync(join(out, f), stem === "artifacts" ? withRenderedBy(html, "ig-pages") : html);
    }
  }
  for (const f of written.filter((w) => !w.endsWith(".html"))) {
    const text = readFileSync(join(out, f), "utf-8");
    const at = sequence.get(basename(f, ".md"));
    const fm = ["ig_footer: true", ...(at?.prev ? [`ig_prev: ${yamlString(at.prev)}`] : []), ...(at?.next ? [`ig_next: ${yamlString(at.next)}`] : [])].join("\n");
    const tail = opts.menu ? "" : `\n\n{% include ${IG_FOOTER_INCLUDE} %}\n`;
    // Last in the front matter, so a page still opens with its own title.
    const end = text.startsWith("---\n") ? text.indexOf("\n---", 3) : -1;
    writeFileSync(join(out, f), end >= 0 ? `${text.slice(0, end)}\n${fm}${text.slice(end)}${tail}` : `---\n${fm}\n---\n${text}${tail}`);
  }
  writeFileSync(join(out, "_includes", IG_FOOTER_INCLUDE), readFileSync(FOOTER_TEMPLATE_PATH, "utf-8"));
  // The AST's own build day stands in for the package's build stamp when no package is held.
  const manifestFile = join(opts.ast ?? join(src, "output-ast"), "manifest.json");
  let manifest: Record<string, unknown> | undefined;
  try {
    manifest = existsSync(manifestFile) ? (JSON.parse(readFileSync(manifestFile, "utf-8")) as Record<string, unknown>) : undefined;
  } catch {
    manifest = undefined;
  }
  const footer = igSiteFooter(
    { ...sushiFooterData(sushi), ...astFooterData(manifest), ...(opts.footer?.facts ?? {}) },
    (href) => heldStems.has(basename(href, ".html")),
    { scope: opts.footer?.scope, stylesheets: opts.footer?.stylesheets },
  );

  const siteData = igSiteData(src);
  // The per-artefact variables ride in the same `site.data.fhir` the IG's
  // metadata does (bean `4tts`), written in THIS build, read by THIS build.
  const lifted = opts.artifacts ? artifactVariables(opts.artifacts.list, opts.artifacts.pagesHref) : undefined;
  // The IG's package dependencies: the AST's ImplementationGuide first, sushi-config where there is none.
  const astIg = astImplementationGuide(opts.ast ?? join(src, "output-ast"));
  const declared = astIg && "resource" in astIg ? fromImplementationGuide(astIg.resource) : fromSushiConfig(sushi);
  const depRows: DependencyRow[] = dependencyRows(declared, opts.packageCache ?? defaultPackageCache());
  const dependencies = {
    from: astIg && "resource" in astIg ? `output-ast/${astIg.file} (dependsOn)` : "sushi-config.yaml (dependencies)",
    rows: depRows.length,
    unresolved: depRows.filter((r) => !r.resolved && !r.repeat).map((r) => `${r.packageId}#${r.version}`),
  };
  const globalRows = astIg && "resource" in astIg ? globalsFromImplementationGuide(astIg.resource) : globalsFromSushiConfig(sushi);
  const globals = globalsIncluded
    ? { from: astIg && "resource" in astIg ? `output-ast/${astIg.file} (global)` : "sushi-config.yaml (global)", rows: globalRows.length }
    : undefined;
  writeFileSync(join(out, "_data", "fhir.json"), JSON.stringify({ ...siteData.data, ...(lifted?.vars ?? {}), footer, dependencies: depRows, globals: globalRows }, null, 2) + "\n");
  const astData = astResourceData(opts.ast ?? join(src, "output-ast"), join(out, "_data"));
  // The Questionnaires' form views, from the same AST (owner, 2026-10-14: LHC-Forms, vendored).
  let forms: FormPage[] | { why: string } | undefined;
  if (astData && !("why" in astData)) {
    try {
      forms = questionnaireFormPages(opts.ast ?? join(src, "output-ast"), out, {
        editBase: opts.editBase,
        fhirVersion: typeof sushi.fhirVersion === "string" ? sushi.fhirVersion : Array.isArray(sushi.fhirVersion) ? String(sushi.fhirVersion[0]) : undefined,
        slug: typeof sushi.id === "string" ? sushi.id : undefined,
        // The Publisher's terminology cache, where `ig-cache.sh restore` puts it.
        txcache: join(src, "input-cache", "txcache"),
        ...(opts.astRaw ? { astRaw: opts.astRaw } : {}),
      });
    } catch (e) {
      forms = { why: (e as Error).message };
    }
  }
  // After every file this build writes to `_data/`, so a clash is seen (bean `yy4u`).
  const data = stageIgData(join(src, "input", "data"), join(out, "_data"));
  const title = typeof sushi.title === "string" ? sushi.title : String(sushi.id ?? "IG");
  const scheme = opts.palette ? colourScheme(opts.palette) : undefined;
  if (scheme) {
    mkdirSync(join(out, "_sass", "color_schemes"), { recursive: true });
    writeFileSync(join(out, "_sass", "color_schemes", "ig.scss"), scheme.scss);
    mkdirSync(join(out, "_sass", "custom"), { recursive: true });
    writeFileSync(join(out, "_sass", "custom", "custom.scss"), SIDEBAR_SCSS);
  }
  // EVERY IG site wears the folio-assistant navbar and keeps the IG's own top
  // bar — one layout, no per-site choice to drift (owner, 2026-10-05, bean
  // `mftp`: "use folio-assistnat LHS navbar, not custome one", "the orignal
  // topnvar bar should be preserved", "make sure no drift issues"). The
  // layout carries no sidebar, so the post-build rail pass supplies the
  // navbar, with the IG's TOC declared as its section. Needs the IG's menu;
  // without one the site keeps just-the-docs' layout and says so.
  if (opts.menu) {
    // The rows the Publisher links outside its menu: its table of contents
    // FIRST, where its breadcrumb starts ("Table of Contents > Home"; owner,
    // 2026-11-14, card: "First row, above Home"), and the releases page last
    // when written.
    const lead = [{ label: "Table of Contents", href: "toc.html" }];
    const extra = generated.includes("releases.md") ? [{ label: "Releases", href: "releases.html" }] : [];
    // A menu item this build does not serve goes where the page links do
    // (`artifacts.html` with no artefact index: folio-assistant#2741, 50 dead
    // links from an immunization IG's top bar).
    const written = (t: string): boolean => isServed(t) || generated.includes(t) || generated.includes(t.replace(/\.html$/, ".md"));
    const off = (href: string): string => offSiteHref(href, canonical, written);
    const menu: IgMenu = {
      ...opts.menu,
      groups: opts.menu.groups.map((g) => ({
        ...g,
        ...(g.href !== undefined ? { href: off(g.href) } : {}),
        ...(g.items ? { items: g.items.map((it) => ({ ...it, href: off(it.href) })) } : {}),
      })),
    };
    mkdirSync(join(out, "_layouts"), { recursive: true });
    const bars: LocalisedBar[] = [...menuLocs.values()].map((ml) => {
      const here = translatedHere(ml.locale);
      return {
        locale: ml.locale,
        menu: localiseMenu(menu, ml, here),
        title: ml.labels.get(title) ?? title,
        home: here.has("index.html") ? `${ml.locale}/index.html` : "index.html",
        ...(ml.reviewed ? {} : { unreviewed: unreviewedLabel(ml.locale) }),
      };
    });
    writeFileSync(join(out, "_layouts", "default.html"), harnessLayout(igTopBar(menu, baseurl, title, opts.search ? igSearchAt(baseurl) : undefined, bars), igTocNav(menu, baseurl, extra, lead), title));
  }
  writeFileSync(
    join(out, "_config.yml"),
    [
      "# GENERATED by fhir-harness/scripts/build-ig-site.ts: one IG, one site (bean bamf).",
      `title: ${yamlString(title)}`,
      `baseurl: ${yamlString(baseurl)}`,
      ...(opts.remoteTheme ? [`remote_theme: ${opts.remoteTheme}`, "plugins:", "  - jekyll-remote-theme"] : ["theme: just-the-docs"]),
      ...(scheme ? ["color_scheme: ig"] : []),
      "defaults:",
      "  - scope: { path: \"\" }",
      "    values: { layout: default }",
      "",
    ].join("\n"),
  );
  const fillsResult = opts.fills?.length ? { filled, unused: opts.fills.map((x) => x.marker).filter((m) => !usedMarkers.has(m)) } : undefined;
  return { annexed, unplaced, templateIncludes: templateIncludesResult, pages: pages.sort(), ...(translatedPages.length ? { translated: translatedPages.sort() } : {}), generated, fills: fillsResult, variables: lifted ? { artifacts: Object.keys(lifted.vars.artifacts).length, notSourced: lifted.notSourced } : undefined, unlisted: unlisted.sort(), menuMissing, includes, images, rendered, listed, notRendered, refusedIncludes, unparseable, reserved, relinked, deadLinks: [...dead].sort(), footer, ...(svgMinified.files ? { svgMinified } : {}), ...(qa ? { qa } : {}), scheme, siteData, data, astData, ...(forms ? { forms } : {}), dependencyTables, dependencies, globals };
}

/**
 * Rename the second and later copies of each `id` on one built page to
 * `<id>--2`, `--3`, … and say which. An IG's source can repeat an anchor
 * (two headings `{#x}`, or a page included into another that already holds
 * it); the Publisher's output then repeats it too, and a duplicate id is an
 * accessibility defect (bean `gjli`). A link to `#x` already lands on the
 * FIRST copy in every browser, so keeping the first and renaming the rest
 * changes where no link goes.
 */
export function dedupeIds(html: string): { html: string; renamed: string[] } {
  const seen = new Map<string, number>();
  const renamed: string[] = [];
  const out = html.replace(/(\sid=)(["'])([^"']+)\2/g, (whole, pre: string, q: string, id: string) => {
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    if (n === 1) return whole;
    renamed.push(`${id} -> ${id}--${n}`);
    return `${pre}${q}${id}--${n}${q}`;
  });
  return { html: out, renamed };
}

/** Every `.html` under a built site, deduplicated in place; returns page → renames. */
export function dedupeSiteIds(site: string): Map<string, string[]> {
  const report = new Map<string, string[]>();
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".html")) {
        const r = dedupeIds(readFileSync(p, "utf-8"));
        if (r.renamed.length) {
          writeFileSync(p, r.html);
          report.set(p.slice(site.length + 1), r.renamed);
        }
      }
    }
  };
  walk(site);
  return report;
}

export function describeStage(r: StageResult): string {
  return [
    `pages: ${r.pages.length}; includes: ${r.includes}; images: ${r.images}; diagrams rendered: ${r.rendered.length}`,
    ...(r.translated?.length ? [`translated pages: ${r.translated.length} (${[...new Set(r.translated.map((p) => p.split("/")[0]))].join(", ")})`] : []),
    ...(r.svgMinified ? [`SVGs published minified: ${r.svgMinified.files}, ${(r.svgMinified.saved / 1e6).toFixed(2)} MB saved`] : []),
    ...(r.templateIncludes ? [`local template includes (ig.ini): ${r.templateIncludes.files} from ${r.templateIncludes.dir}`] : []),
    ...(r.generated.length ? [`generated from data this build holds (the Publisher generates these): ${r.generated.join(", ")}`] : []),
    ...(r.fills?.filled.length ? [`post-processing filled: ${r.fills.filled.join(", ")}`] : []),
    ...(r.fills?.unused.length ? [`post-processing fill with no marker in any page (NOT applied): ${r.fills.unused.join(", ")}`] : []),
    ...(r.variables ? [`site.data.fhir.artifacts: ${r.variables.artifacts} artefact(s); elements not sourced (not written): ${r.variables.notSourced.join(", ") || "none"}`] : []),
    ...(r.annexed?.length ? [`annexes loaded by their pages: ${r.annexed.join(", ")}`] : []),
    ...(r.unplaced?.length ? [`annex whose page this IG does not have (NOT placed): ${r.unplaced.join(", ")}`] : []),
    ...(r.relinked ? [`links pointed where they resolve (artefact pages, the published IG, the source repository): ${r.relinked}`] : []),
    ...(r.qa ? [`QA report (qa.md): ${r.qa}`] : []),
    ...(r.deadLinks.length ? [`DEAD in the IG's own source — no page anywhere serves: ${r.deadLinks.join(", ")}`] : []),
    ...(r.listed.length ? [`artefact lists written from the artefact index (the Publisher generates these): ${r.listed.join(", ")}`] : []),
    ...(r.notRendered.length ? [`NOT RENDERED (a visible marker stands in): ${r.notRendered.join(", ")}`] : []),
    ...(r.refusedIncludes?.length ? [`REFUSED include name(s), not a single safe path segment (nothing written): ${r.refusedIncludes.map((n) => JSON.stringify(n)).join(", ")}`] : []),
    ...(r.unparseable.length ? [`NOT PUBLISHED (not valid JSON in the IG source): ${r.unparseable.join("; ")}`] : []),
    ...(r.reserved.length ? [`not published from input/images, a later step writes the path: ${r.reserved.length} file(s), ${r.reserved.slice(0, 5).join("; ")}${r.reserved.length > 5 ? "; …" : ""}`] : []),
    ...(r.astData === undefined
      ? ["no FHIR AST: site.data.canonicals and site.data[\"<Type>-<id>\"] not written — a page that loops them renders EMPTY"]
      : "why" in r.astData
        ? [`FHIR AST unreadable, site.data.canonicals not written: ${r.astData.why}`]
        : [`FHIR AST → site.data.canonicals (${r.astData.canonicals}) and site.data["<Type>-<id>"] (${r.astData.resources} resources)`]),
    ...(r.forms === undefined
      ? []
      : "why" in r.forms
        ? [`Questionnaire form views NOT written: ${r.forms.why}`]
        : r.forms.length
          ? [`Questionnaire form views (LHC-Forms): ${r.forms.map((f) => f.page).join(", ")}`]
          : []),
    ...(r.dependencyTables.length && r.dependencies
      ? [`dependency table(s) ${r.dependencyTables.join(", ")} from ${r.dependencies.from}: ${r.dependencies.rows} row(s)` +
          (r.dependencies.unresolved.length ? `; NOT in the package cache, so their own dependencies are not shown: ${r.dependencies.unresolved.join(", ")}` : "")]
      : []),
    ...(r.globals ? [`globals table from ${r.globals.from}: ${r.globals.rows} global profile(s)`] : []),
    ...(r.data.staged.length ? [`IG data staged into _data/ (site.data.*): ${r.data.staged.join(", ")}`] : []),
    ...r.data.overwrites.map((o) => `QA FINDING data-overwrite: site.data.${o.key} — kept ${o.kept}, DROPPED ${o.dropped}`),
    r.scheme
      ? `colour scheme: from the instance's webpage theme; sidebar text is ${r.scheme.sidebarText}` +
        (r.scheme.sidebarContrast === undefined ? "" : ` (${r.scheme.sidebarContrast.toFixed(2)}:1 on accent)`)
      : "colour scheme: NONE — the instance declares no webpage theme, so just-the-docs' default light scheme",
    ...(r.scheme?.findings.length ? [`CONTRAST: ${r.scheme.findings.join("; ")}`] : []),
    ...(r.unlisted.length ? [`not in the navigation source (titled by file name): ${r.unlisted.join(", ")}`] : []),
    ...(r.menuMissing.length ? [`menu items with no page in this source (Publisher-generated): ${r.menuMissing.join(", ")}`] : []),
    describeSiteData(r.siteData),
  ].join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  // Post-build: `--dedupe-ids <built site>` repairs repeated ids and reports each.
  const dedupe = opt("--dedupe-ids");
  if (dedupe) {
    const report = dedupeSiteIds(resolve(dedupe));
    for (const [page, renames] of report) console.log(`${page}: repeated id(s) in the IG source renamed: ${renames.join(", ")}`);
    console.log(`${report.size} page(s) carried a repeated id`);
    process.exit(0);
  }
  const igSrc = opt("--ig-src");
  const out = opt("--out");
  if (!igSrc || !out) {
    console.error("usage: build-ig-site.ts --ig-src <IG repo> --out <jekyll source> [--baseurl <path>] [--plantuml-jar <jar>] [--menu <menu.json>] [--remote-theme <owner/repo@ref>]");
    process.exit(2);
  }
  const menuPath = opt("--menu");
  const artifactsDir = opt("--artifacts");
  let artifactsOpt: StageOptions["artifacts"];
  if (artifactsDir) {
    const artResolved = resolve(artifactsDir);
    const ixPath = existsSync(indexReadPath(artResolved, "index.json"))
      ? indexReadPath(artResolved, "index.json")
      : existsSync(join(artResolved, "index.json"))
        ? join(artResolved, "index.json")
        : undefined;
    if (ixPath) {
      const ix = JSON.parse(readFileSync(ixPath, "utf-8")) as { artifacts: IndexedArtifact[] };
      const pagesHref = opt("--artifacts-href") ?? "artifact/";
      artifactsOpt = { list: ix.artifacts, pagesHref };
      // declared-path-literal: the external artifacts directory's own docs/artifact/ under artResolved, not folio-assistant's docs/
      const docArtifact = existsSync(join(artResolved, "docs", "artifact"))
        ? join(artResolved, "docs", "artifact")
        : existsSync(join(artResolved, "artifact"))
          ? join(artResolved, "artifact")
          : undefined;
      if (docArtifact) {
        mkdirSync(join(resolve(out), "artifact"), { recursive: true });
        for (const af of files(docArtifact)) {
          copyFileSync(join(docArtifact, af), join(resolve(out), "artifact", af));
        }
      }

      // declared-path-literal: the external artifacts directory's own docs/assets/ under artResolved, not folio-assistant's docs/
      const docAssets = existsSync(join(artResolved, "docs", "assets"))
        ? join(artResolved, "docs", "assets")
        : existsSync(join(artResolved, "assets"))
          ? join(artResolved, "assets")
          : undefined;
      if (docAssets) {
        mkdirSync(join(resolve(out), "assets"), { recursive: true });
        for (const asf of files(docAssets)) {
          copyFileSync(join(docAssets, asf), join(resolve(out), "assets", asf));
        }
      }
    }
  }
  const r = stageIgSite(igSrc, resolve(out), {
    baseurl: opt("--baseurl") ?? "",
    plantumlJar: opt("--plantuml-jar"),
    menu: menuPath ? (JSON.parse(readFileSync(menuPath, "utf-8")) as IgMenu) : undefined,
    remoteTheme: opt("--remote-theme"),
    artifacts: artifactsOpt,
  });
  console.log(describeStage(r));
  console.log(`staged ${out}`);
  if (r.siteData.refused.length) process.exit(1);
}
