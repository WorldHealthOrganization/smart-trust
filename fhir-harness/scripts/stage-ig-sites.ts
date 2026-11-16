/**
 * Stage every IG whose layer records its source, one Jekyll site each
 * (bean `bamf`).
 *
 * A layer that ingested a published IG's navigation holds
 * `fhir-artifact-index/menu.json` (`folio-ig-menu/v1`), and that file records
 * WHERE the menu was read: `source.of` (the IG repository) and `source.ref`
 * (the commit). That pair is the declared source, so no workflow names an IG:
 * this clones `of` at `ref`, stages it with `build-ig-site` using the IG's own
 * menu, and prints one `<instance> <jekyll source> <at>` line per IG for the
 * caller to build into `<site>/<instance>/<at>/` ({@link igSiteAt}) — `ig`
 * beside the layer's own pages, or `.` when there are none (#2738) or
 * when the layer's docs directory declares `igSite`
 * (bean `mftp`): the IG site is then the layer's root, and the docs
 * directory's pages (artefact pages, their assets) are copied into its
 * Jekyll source to build under the IG's own menu. One site, one menu, as the
 * Publisher builds one.
 *
 * A layer with no menu, or a menu with no sushi-config source, is skipped
 * and reported: nothing to build is not the same as a build that failed.
 *
 * The site wears the palette of the ONE `webpage` theme the layer declares
 * (bean `u3cd`), resolved through `instanceThemes` — the same answer every
 * other generator reads, so the palette has one home. None declared builds
 * with just-the-docs' default scheme and says so; two declared is refused,
 * because nothing says which one dresses the IG.
 *
 * Usage:
 *   bun run fhir-harness/scripts/stage-ig-sites.ts --work <dir> --baseurl <site baseurl> \
 *     [--plantuml-jar <jar>] [--remote-theme <owner/repo@ref>] [--changed-files <file>]
 *
 * `--changed-files` (one path per line) builds only the IGs the staging cone
 * reaches (bean `4j86`); each decision is printed with its reason.
 *
 * `--compose-into <docs source>` moves each staged IG INTO the host site's
 * Jekyll source at `<docs source>/<instance>/` (`composeIgSite`), so the
 * host's own build renders it with the host's chrome — sidebar, search,
 * language selector — rather than as a site of its own (bean `mftp`, owner:
 * "Build in main site"). The build list is still printed, for the per-IG
 * duplicate-id pass after the host's build.
 *
 * THIN BY DEFAULT (owner, 2026-10-12: "make thin default"): `artifacts.html`
 * and `toc.html` are thin pages over the artefact index node, and pages
 * composed into a host wear the thin layout (`thinIgLayout`) with the host's
 * chrome linked, not inlined. `--full-pages` builds the earlier full pages; it
 * needs `gen-ig-pages --full-pages` too, and a mismatch is refused.
 *
 * `--only <instance> --source <dir>` builds ONE IG from a local checkout of
 * its source instead of cloning the recorded commit — what an IG's own
 * repository runs in its CI, so the site is built from the commit being
 * pushed (bean `mftp`, owner 2026-10-05: *"build on the fork"*). The menu,
 * index and artefact pages still come from the layer's declaration here.
 *
 * @covers none — a build step: it stages sites and judges no declared graph
 *
 * @module fhir-harness/scripts/stage-ig-sites
 */

import { igApiHubFill } from "./ig-api-views.ts";
import { IG_CHROME_SCOPE, type IgFooterData } from "./ig-footer.ts";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { declarationPathIn, instanceRootsIn, readDeclaration } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { instanceThemes } from "@litlfred/cat-harness-tools/schemas/ui/theme-by-ref.js";
import { composeIgSite, dataOverwritesQa, describeStage, stageIgSite, type IgMenu, type IndexedArtifact, type SitePalette, type StageOptions } from "./build-ig-site";
import { IgReleasesSchema, type IgReleases } from "../schemas/ig-releases.ts";
import { IG_ANNEX_KIND, IG_ANNEXES_FILE, IgAnnexesSchema, IgAnnexRecordSchema } from "../schemas/ig-annexes.ts";
import { readChangedFiles, siteFilter } from "../../cat-harness-tools/scripts/staging-cone.ts";
import { sourceHashOf } from "../../cat-harness-tools/scripts/qa-results.ts";
import { ARTIFACT_INDEX_FILE, artifactPageName } from "./ig-artifact-jsonld.ts";
import { indexReadPath } from "./lib/ig-index-at.ts";

interface MenuFile extends IgMenu {
  source?: { kind?: string; of?: string; ref?: string };
}

export interface IgToBuild {
  instance: string;
  /** The layer's root directory. */
  root: string;
  menuPath: string;
  repo: string;
  ref: string;
  /** The layer's declared name — what `instanceThemes` keys on. */
  declaredAs: string;
}

/**
 * The palette of the one webpage theme a layer declares, or why there is none.
 *
 * A layer that declares no webpage theme INHERITS the nearest one along
 * its `needs` chain, breadth-first — as it inherits its dependencies'
 * directories. The WHO SMART Trust IG is the case (bean `mftp`): its WHO theme moved to
 * the WHO SMART Base IG's `themes/` in the smart-* separation (`kg83`), because the theme
 * is the WHO template's rather than one IG's, and from then on the IG site
 * built in just-the-docs' default scheme. Two webpage themes at the same
 * distance are refused, as two in one layer are: nothing says which.
 */
export function webpagePalette(repoRoot: string, instance: string): { palette?: SitePalette; note: string } {
  const seen = new Set<string>([instance]);
  let level = [instance];
  const misses: string[] = [];
  while (level.length > 0) {
    const hits: { from: string; id: string; palette: SitePalette }[] = [];
    for (const name of level) {
      const found = instanceThemes(repoRoot, name);
      if (!found.ok) {
        misses.push(`${name}: ${found.miss.kind}`);
        continue;
      }
      const web = found.themes.filter((t) => t.kind === "webpage");
      if (web.length > 1) throw new Error(`${name} declares ${web.length} webpage themes (${web.map((t) => t.id).join(", ")}) — nothing says which dresses ${instance}'s IG site`);
      if (web.length === 1) hits.push({ from: name, id: web[0]!.id, palette: web[0]!.palette as SitePalette });
      else misses.push(`${name}: declares themes, none of kind webpage`);
    }
    if (hits.length > 1) throw new Error(`${instance} inherits ${hits.length} webpage themes at the same distance (${hits.map((h) => `${h.from}/${h.id}`).join(", ")}) — nothing says which dresses its IG site`);
    if (hits.length === 1) {
      const h = hits[0]!;
      return { palette: h.palette, note: h.from === instance ? `${instance}: webpage theme ${h.id}` : `${instance}: webpage theme ${h.id}, inherited from ${h.from}` };
    }
    level = level
      .flatMap((name) => instanceNeeds(repoRoot, name))
      .filter((n) => !seen.has(n) && (seen.add(n), true));
  }
  return { note: `${instance}: no webpage theme, its own or along its needs (${misses.join("; ")})` };
}

/**
 * `https://github.com/<o>/<r>/edit/<default branch>` for a GitHub repository,
 * the branch ASKED of the remote (`git ls-remote --symref`), never assumed:
 * an edit link on a branch that does not exist is a 404 a reader hits
 * mid-correction. Undefined for a non-GitHub source, or when the remote
 * cannot be asked — then pages carry no edit link, and the build says so.
 */
export function githubEditBase(repo: string): string | undefined {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(repo);
  if (!m) return undefined;
  try {
    const out = execFileSync("git", ["ls-remote", "--symref", repo, "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const branch = /^ref: refs\/heads\/(\S+)\s+HEAD$/m.exec(out)?.[1];
    if (!branch) {
      console.error(`${repo}: no default branch reported — pages carry no edit link`);
      return undefined;
    }
    return `https://github.com/${m[1]}/${m[2]}/edit/${branch}`;
  } catch {
    console.error(`${repo}: could not ask its default branch — pages carry no edit link`);
    return undefined;
  }
}

/** The layers `name` declares it `needs`, by name. */
export function instanceNeeds(repoRoot: string, name: string): string[] {
  const root = instanceRootsIn(repoRoot).find((r) => (readDeclaration(r)?.name ?? basename(r)) === name);
  return root ? (readDeclaration(root)?.needs ?? []) : [];
}

/**
 * The layer's artefact index and where its artefact pages are, for the IG
 * site's `artifacts` page — or undefined when it holds either half not.
 * The pages are the layer's `docs/artifact/`, published one level above
 * the IG site (`/<instance>/artifact/` beside `/<instance>/ig/`), so a link
 * from the IG site is `../artifact/`. Read off the disk, not assumed: a
 * layer with an index and no artefact pages gets no `artifacts` page.
 */
export function artifactsFor(root: string, pagesHref = "../artifact/", opts: { fullPages?: boolean } = {}): StageOptions["artifacts"] {
  const index = indexReadPath(root, "index.json");
  // declared-path-literal: the staged IG layer's own docs/artifact/ under `root`, not folio-assistant's docs/
  if (!existsSync(index) || !existsSync(join(root, "docs", "artifact"))) return undefined;
  const ix = JSON.parse(readFileSync(index, "utf-8")) as { artifacts: IndexedArtifact[] };
  if (opts.fullPages) return { list: ix.artifacts, pagesHref };
  // THIN, the default (owner, 2026-10-12): the list pages draw the index node
  // `gen-ig-pages` writes beside the artefact pages. Not there means those pages
  // were generated with `--full-pages`, and two halves of one site disagreeing
  // is refused rather than papered over with a page that draws nothing.
  // declared-path-literal: the staged IG layer's own docs/artifact/ under `root`
  if (!existsSync(join(root, "docs", "artifact", ARTIFACT_INDEX_FILE))) {
    throw new Error(
      `${join(root, "docs", "artifact", ARTIFACT_INDEX_FILE)} is not there: the artefact pages were generated with --full-pages. ` +
        "Run gen-ig-pages without it, or pass --full-pages here too.",
    );
  }
  // The artefacts' thin tab views, by page name, so the narrative's links to
  // the Publisher's tab file names land on them (owner, 2026-10-14: "3. Render
  // them too"). Read off the disk: only a view the generator wrote is named.
  const own = new Set(ix.artifacts.map((a) => artifactPageName(a)));
  // declared-path-literal: the staged IG layer's own docs/artifact/ under `root`
  const pages = readdirSync(join(root, "docs", "artifact"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.slice(0, -".html".length))
    .filter((n) => !own.has(n))
    .sort();
  return { list: ix.artifacts, pagesHref, index: `${pagesHref}${ARTIFACT_INDEX_FILE}`, ...(pages.length ? { pages } : {}) };
}

/**
 * The annexes ONE directory declares: tables a page loads on demand (owner,
 * 2026-10-10: the data dictionary in the KG, dynamically loaded). The
 * directory holds `annexes.json` (`ig-annexes/v1`, {@link IgAnnexesSchema}):
 * `{ $schema, annexes: [{ page, file, columns? }] }`, with `file` relative to
 * the directory (it may name a file in a nested directory), so an annex is a node of the layer's graph rather than a
 * build-time product. A bare array of the same records is read too: it is
 * the shape `fhir-artifact-index/annexes.json` carried before the contract
 * had a kind (fhir-harness#33).
 *
 * Undefined when the directory holds no declaration. A declared file that is
 * missing throws, because a silent skip would publish a page that promises a
 * table.
 */
export function annexesIn(dir: string): StageOptions["annexes"] {
  const decl = join(dir, IG_ANNEXES_FILE);
  if (!existsSync(decl)) return undefined;
  const json = JSON.parse(readFileSync(decl, "utf-8")) as unknown;
  const list = Array.isArray(json) ? IgAnnexRecordSchema.array().parse(json) : IgAnnexesSchema.parse(json).annexes;
  return list.map((a) => {
    const src = join(dir, a.file);
    if (!existsSync(src)) throw new Error(`${decl}: annex ${a.file} for ${a.page} is declared but not held`);
    return { page: a.page, src, ...(a.columns ? { columns: a.columns } : {}) };
  });
}

/**
 * The directories a layer declares as the generic `ig-annex` kind
 * (`typologies/ig-annex.json`), absolute, in declaration order. The annex
 * files themselves may sit in a directory nested inside, declared with the
 * kind of the layer that writes them. One that is declared and absent from
 * the checkout (an index that does not mount it) is skipped and said, not
 * read as empty.
 */
export function annexDirsFor(root: string, log: (s: string) => void = (s) => console.error(s)): string[] {
  const out: string[] = [];
  for (const d of readDeclaration(root)?.directories ?? []) {
    if (!(d.graphTypologies as readonly string[] | undefined)?.includes(IG_ANNEX_KIND)) continue;
    const abs = join(root, d.path);
    if (existsSync(abs)) out.push(abs);
    else log(`${basename(root)}: ${IG_ANNEX_KIND} directory ${d.id ?? d.path} is declared and not in this checkout; its annexes are not placed`);
  }
  return out;
}

/**
 * The layer's ANNEXES: every `ig-annex` directory it declares
 * ({@link annexDirsFor}), then `fhir-artifact-index/annexes.json` where one is
 * still held (the location before the kind; an IG repository commits no
 * artefact index, #124, so it declares an `ig-annex` directory instead).
 * Each directory is read by {@link annexesIn}. Undefined when none declares
 * an annex.
 */
export function annexesFor(root: string, log?: (s: string) => void): StageOptions["annexes"] {
  const all = [...annexDirsFor(root, log), indexReadPath(root)].flatMap((d) => annexesIn(d) ?? []);
  return all.length ? all : undefined;
}

/**
 * The IG site pages' footer (#1901), dressed as the artefact pages' footer
 * is: the package's facts from the `assets/ig-footer.json` `gen-ig-pages`
 * writes, and the two stylesheets it writes beside it, linked from the IG
 * site's root (`prefix`: "" when the artefact pages build into the IG site,
 * "../" when they sit one level above it). Read off the disk, never assumed:
 * a file not held is not linked, and the footer then falls back to the IG
 * source's values, unstyled.
 */
export function footerFor(root: string, prefix = "../"): StageOptions["footer"] {
  // declared-path-literal: the staged IG layer's own docs/assets/ under `root`, not folio-assistant's docs/
  const assets = join(root, "docs", "assets");
  const data = join(assets, "ig-footer.json");
  const facts = existsSync(data) ? (JSON.parse(readFileSync(data, "utf-8")) as IgFooterData) : undefined;
  const stylesheets = ["ig-pages.css", "ig-chrome.css"].filter((f) => existsSync(join(assets, f))).map((f) => `${prefix}assets/${f}`);
  return {
    ...(facts ? { facts } : {}),
    // The chrome's `--footer-*` colours are scoped; the footer wears the scope only where the chrome is linked.
    ...(stylesheets.some((s) => s.endsWith("ig-chrome.css")) ? { scope: IG_CHROME_SCOPE } : {}),
    stylesheets,
  };
}

/**
 * The layer's docs directory when it declares `igSite` (bean `mftp`):
 * built INTO the IG's own site at `/<instance>/`. Undefined otherwise — the
 * IG site then sits at `/<instance>/ig/` beside it. Read off the declaration,
 * never inferred from the menu: the WHO SMART Base IG holds a menu too, and its root is
 * a harness landing page.
 */
export function igSiteDocs(root: string): string | undefined {
  const d = readDeclaration(root)?.directories?.find((x) => x.igSite === true && x.graphTypologies?.includes("docs"));
  return d ? join(root, d.path) : undefined;
}

/**
 * Where the IG site sits under `/<instance>/`: `"ig"` beside the layer's own
 * pages, `"."` (the IG IS the layer's root) when its docs directory declares
 * `igSite`, or when the layer declares no `docs` directory at all, so
 * nothing else would answer `/<instance>/`.
 *
 * The second case is folio-assistant#2738: an IG layer that declares no
 * docs, its IG was built with an `/ig` base but composed at `/<instance>/`,
 * so every menu link pointed at an `ig/` folder that was never published.
 * One answer, read by the base URL, the relative links and the composer alike.
 */
export function igSiteAt(root: string): "." | "ig" {
  if (igSiteDocs(root) !== undefined) return ".";
  const ownPages = (readDeclaration(root)?.directories ?? []).some((d) => d.graphTypologies?.includes("docs"));
  return ownPages ? "ig" : ".";
}

/** Every file under `dir`, `/`-separated and relative to it, sorted. */
function servedFiles(dir: string, rel = ""): string[] {
  return readdirSync(join(dir, rel), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? servedFiles(dir, rel ? `${rel}/${e.name}` : e.name) : [rel ? `${rel}/${e.name}` : e.name]))
    .sort();
}

/**
 * The site paths a later step publishes inside an `igSite` layer's IG site:
 * each FILE of every directory the layer declares `served`. The
 * served-directory mount refuses a file the site already holds, so an IG's own
 * `input/images/` copy must leave those files to it. Other files at the same
 * route stay: an IG's vendored Swagger UI at `openapi/index.html` sits beside
 * the served OpenAPI documents, as it does on the IG's own site
 * (`ig-site:openapi`). A served directory the checkout does not hold reserves
 * its whole `/`-ended prefix, since which files the mount writes is unknown.
 * Empty when the IG site sits at `/<instance>/ig/`, where no served route can
 * meet it.
 */
export function servedPathsFor(root: string): { prefix: string; by: string }[] {
  if (igSiteAt(root) === "ig") return [];
  return (readDeclaration(root)?.directories ?? [])
    .filter((d) => d.served === true)
    .flatMap((d) => {
      const dir = d.path.replace(/^\/+|\/+$/g, "");
      const by = `served directory ${d.id ?? d.path}`;
      const abs = join(root, dir);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) return [{ prefix: `${dir}/`, by }];
      return servedFiles(abs).map((f) => ({ prefix: `${dir}/${f}`, by }));
    });
}

/**
 * Copy an `igSite` docs directory into a staged IG site's Jekyll source,
 * refusing to overwrite: a file the IG's own build already wrote at the same
 * path is two answers for one URL, and the generator is supposed to have
 * dropped every page the IG site writes itself. The directory's README is
 * repository documentation, not a page.
 *
 * ONE exception, and it carries no body: a docs page that is front matter
 * ONLY declares something ABOUT the page the IG build generated there — the
 * artefact index's viewer declaration on `artifacts.md` (`gen-ig-pages`) —
 * so its keys are laid onto that page's front matter, the page's own keys
 * winning. A front-matter-only page with nothing to land on is a collision
 * in reverse, and reported the same way.
 */
/** A file that is a front-matter block and nothing else (whitespace aside). */
const FRONT_MATTER_ONLY = /^---\n([\s\S]*?)\n---\s*$/;

export function copyDocsInto(docs: string, site: string): { copied: number; merged: string[]; collisions: string[] } {
  let copied = 0;
  const merged: string[] = [];
  const collisions: string[] = [];
  const walk = (rel: string): void => {
    for (const name of readdirSync(join(docs, rel)).sort()) {
      const r = rel ? join(rel, name) : name;
      if (!rel && name === "README.md") continue;
      if (statSync(join(docs, r)).isDirectory()) {
        walk(r);
        continue;
      }
      const fmOnly = FRONT_MATTER_ONLY.exec(readFileSync(join(docs, r), "utf-8"));
      if (fmOnly) {
        const target = join(site, r);
        const page = existsSync(target) ? readFileSync(target, "utf-8") : undefined;
        if (page === undefined || !page.startsWith("---\n")) {
          collisions.push(`${r} (front matter only, and no generated page to lay it on)`);
          continue;
        }
        const end = page.indexOf("\n---", 3);
        const own = new Set([...page.slice(4, end).matchAll(/^([A-Za-z_][\w-]*):/gm)].map((m) => m[1]));
        // Each top-level key with its indented continuation lines, skipping the page's own.
        const blocks = fmOnly[1]!.split(/\n(?=[A-Za-z_])/).filter((b) => !own.has(/^([A-Za-z_][\w-]*):/.exec(b)?.[1] ?? ""));
        writeFileSync(target, `${page.slice(0, end)}\n${blocks.join("\n")}${page.slice(end)}`);
        merged.push(r);
        continue;
      }
      if (existsSync(join(site, r))) {
        collisions.push(r);
        continue;
      }
      mkdirSync(join(site, rel), { recursive: true });
      cpSync(join(docs, r), join(site, r));
      copied++;
    }
  };
  walk("");
  return { copied, merged, collisions };
}

/**
 * The layer's recorded GitHub releases (`fhir-artifact-index/releases.json`),
 * validated, for the IG site's `releases` page; undefined when none was
 * recorded. A file that does not validate throws: a wrong download link is
 * worse than none.
 */
export function releasesFor(root: string): IgReleases | undefined {
  const at = indexReadPath(root, "releases.json");
  return existsSync(at) ? IgReleasesSchema.parse(JSON.parse(readFileSync(at, "utf-8"))) : undefined;
}

/**
 * The upstream git source a layer's own declaration records, if any
 * (bean `bamf`, owner ruling 2026-10-07: declare the IG source in the
 * layer declaration, `source: { kind: "git", repository, ref }`).
 *
 * Read from the declaration's raw JSON rather than through
 * `readDeclaration`, and narrowed here: this layer must stay usable against
 * a cat-harness whose declaration schema does not (yet) carry `source`, and
 * an absent or malformed `source` simply means "not declared", never an
 * error — the menu's own record is then the answer, as before.
 */
export function declaredSource(root: string): { repository: string; ref: string } | undefined {
  const at = declarationPathIn(root);
  if (at === undefined) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(at, "utf-8"));
  } catch {
    return undefined;
  }
  const s = (raw as { source?: unknown } | null)?.source as { kind?: unknown; repository?: unknown; ref?: unknown } | undefined;
  if (s?.kind !== "git" || typeof s.repository !== "string" || typeof s.ref !== "string") return undefined;
  if (s.repository.length === 0 || s.ref.length === 0) return undefined;
  return { repository: s.repository, ref: s.ref };
}

/**
 * Every layer with an IG menu whose source is recorded: in its own
 * declaration (`source`, preferred — bean `bamf`) or, failing that, in the
 * menu's sushi-config record.
 */
export function igsToBuild(repoRoot: string): { build: IgToBuild[]; skipped: string[] } {
  const build: IgToBuild[] = [];
  const skipped: string[] = [];
  for (const root of instanceRootsIn(repoRoot)) {
    const menuPath = indexReadPath(root, "menu.json");
    if (!existsSync(menuPath)) continue;
    const m = JSON.parse(readFileSync(menuPath, "utf-8")) as MenuFile;
    const instance = basename(root);
    const declaredAs = readDeclaration(root)?.name ?? instance;
    const declared = declaredSource(root);
    const fromMenu = m.source?.kind === "sushi-config" && m.source.of && m.source.ref ? { repository: m.source.of, ref: m.source.ref } : undefined;
    const source = declared ?? fromMenu;
    if (source === undefined) {
      skipped.push(`${instance}: neither the instance declaration nor menu.json records a source repository and commit`);
      continue;
    }
    build.push({ instance, root, menuPath, repo: source.repository, ref: source.ref, declaredAs });
  }
  return { build, skipped };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const work = opt("--work");
  const base = opt("--baseurl");
  if (!work || base === undefined) {
    console.error("usage: stage-ig-sites.ts --work <dir> --baseurl <site baseurl> [--plantuml-jar <jar>] [--remote-theme <owner/repo@ref>] [--changed-files <file>] [--compose-into <docs source> [--compose-at-root]] [--only <instance> [--source <dir>]] [--full-pages]");
    process.exit(2);
  }
  const all = igsToBuild(resolve("."));
  const only = opt("--only");
  const localSource = opt("--source");
  if (localSource && !only) {
    console.error("--source needs --only: a local checkout is one IG's source");
    process.exit(2);
  }
  // By directory name or by declared name: a layer declared at its checkout's
  // root (an IG repository's own, as the WHO SMART Trust IG's main declares it) has a
  // directory named after the checkout, not after the layer.
  const build = only ? all.build.filter((b) => b.instance === only || b.declaredAs === only) : all.build;
  const skipped = all.skipped;
  if (only && build.length === 0) {
    console.error(`${only}: no instance here records a sushi-config source in fhir-artifact-index/menu.json`);
    process.exit(2);
  }
  for (const s of skipped) console.error(`skipped ${s}`);
  // The staging cone (bean `4j86`): with `--changed-files`, an IG no changed
  // file reaches is not built. Without it, every IG is, as before.
  // `--compose-at-root` (with `--compose-into` and `--only`): an IG repository
  // building its OWN site composes the IG at the root of a chrome-only shell
  // (`compose-docs --shell`), so it carries the main site's chrome (#2235 F1).
  const atRoot = process.argv.includes("--compose-at-root");
  // `--full-pages`: the pre-2026-10-12 pages — `artifacts`/`toc` as Liquid over
  // `site.data.fhir`, and composed pages in the host's layout. Thin is the default.
  const fullPages = process.argv.includes("--full-pages");
  if (atRoot && (!opt("--compose-into") || !opt("--only"))) {
    console.error("stage-ig-sites: --compose-at-root needs --compose-into and --only (one IG is the whole site)");
    process.exit(2);
  }
  const inCone = siteFilter(resolve("."), readChangedFiles(opt("--changed-files")), ["fhir-harness/scripts/stage-ig-sites.ts"]);
  for (const ig of build) {
    const d = inCone(relative(resolve("."), ig.root).split(sep).join("/"));
    console.error(`${ig.instance}: ${d.carry ? "built" : "not built"} — ${d.why}`);
    if (!d.carry) continue;
    const src = resolve(work, ig.instance, "src");
    const site = resolve(work, ig.instance, "site");
    mkdirSync(src, { recursive: true });
    if (localSource) {
      // The IG's own repository building itself: its checkout IS the source.
      cpSync(resolve(localSource), src, { recursive: true, filter: (p) => !/\/(\.git|node_modules|folio-assistant)(\/|$)/.test(p.slice(resolve(localSource).length)) });
      console.error(`${ig.instance}: built from the local checkout ${resolve(localSource)}, not the recorded ${ig.ref.slice(0, 7)}`);
    } else {
      // A pinned commit, fetched alone: the menu was read from exactly this tree.
      const git = (...a: string[]) => execFileSync("git", ["-C", src, ...a], { stdio: ["ignore", "ignore", "inherit"] });
      git("init", "-q");
      git("fetch", "-q", "--depth", "1", ig.repo, ig.ref);
      git("checkout", "-q", "FETCH_HEAD");
    }
    const theme = webpagePalette(resolve("."), ig.declaredAs);
    console.error(theme.note);
    const docs = igSiteDocs(ig.root);
    const at = igSiteAt(ig.root);
    const up = at === "." ? "" : "../";
    const editBase = githubEditBase(ig.repo);
    const r = stageIgSite(src, site, {
      palette: theme.palette,
      // At the root, the IG IS the site, so its base is the site's own; else
      // it is mounted under its layer name inside the host site.
      baseurl: atRoot ? base.replace(/\/$/, "") : `${base.replace(/\/$/, "")}/${ig.instance}${at === "." ? "" : `/${at}`}`,
      plantumlJar: opt("--plantuml-jar"),
      menu: JSON.parse(readFileSync(ig.menuPath, "utf-8")) as IgMenu,
      remoteTheme: opt("--remote-theme"),
      artifacts: artifactsFor(ig.root, `${up}artifact/`, { fullPages }),
      footer: footerFor(ig.root, up),
      releases: releasesFor(ig.root),
      ...(editBase ? { editBase } : {}),
      // The IG's post-processing output, where its source holds only a marker.
      fills: [igApiHubFill(ig.root, up)].filter((x) => x !== undefined),
      annexes: annexesFor(ig.root),
      // A declared served directory is published by a later step at its own route.
      reservedPaths: servedPathsFor(ig.root),
    });
    console.error(`${ig.instance} (${ig.repo}@${ig.ref.slice(0, 7)}):\n${describeStage(r)}`);
    // The `site.data` overwrite record (bean `yy4u`), as a QA sidecar in the
    // layer's results — beside `p2-refusals`, written even when empty.
    const qaOut = join(ig.root, "test", "results", "ig-data-overwrites.qa-results.json");
    const script = join(import.meta.dir, "build-ig-site.ts");
    mkdirSync(join(ig.root, "test", "results"), { recursive: true });
    writeFileSync(qaOut, `${JSON.stringify(dataOverwritesQa(ig.instance, { script: relative(resolve(import.meta.dir, "..", ".."), script), script_hash: sourceHashOf(script) }, r.data.overwrites), null, 2)}\n`);
    if (r.data.overwrites.length) console.error(`${ig.instance}: ${r.data.overwrites.length} site.data overwrite(s) flagged in ${relative(resolve("."), qaOut)}`);
    if (r.siteData.refused.length) process.exit(1);
    if (docs) {
      // A declared igSite docs directory that is not on disk is not an IG with
      // no pages (dh4f): its writer has not run. A docs directory declared
      // builtAtPublish exists only after `derive:publish`; say so, rather
      // than a bare ENOENT from the walk.
      if (!existsSync(docs)) {
        console.error(`${ig.instance}: the declared igSite docs directory ${relative(resolve("."), docs)} is not on disk — its writer has not run (a builtAtPublish directory exists only after \`derive:publish\`). Refusing to build the IG site without its pages.`);
        process.exit(1);
      }
      const c = copyDocsInto(docs, site);
      console.error(`${ig.instance}: igSite — ${c.copied} file(s) from ${relative(resolve("."), docs)} built into the IG site at /${ig.instance}/${c.merged.length ? `; front matter laid onto ${c.merged.join(", ")}` : ""}`);
      if (c.collisions.length) {
        console.error(`${ig.instance}: ${c.collisions.length} file(s) the IG site already writes — refusing two answers for one URL:\n  ${c.collisions.slice(0, 20).join("\n  ")}`);
        process.exit(1);
      }
    }
    const into = opt("--compose-into");
    if (into) {
      const c = composeIgSite(site, resolve(into), ig.instance, { atRoot, at, fullPages, siteBase: base });
      console.error(`${ig.instance}: composed into ${relative(resolve("."), atRoot ? resolve(into) : resolve(into, ig.instance, at))} — ${c.pages} page(s), ${c.files - c.pages} other file(s), ${c.includes} include(s)`);
      if (c.collisions.length) {
        console.error(`${ig.instance}: ${c.collisions.length} path(s) already in the host source — refusing two answers for one URL:\n  ${c.collisions.slice(0, 20).join("\n  ")}`);
        process.exit(1);
      }
    }
    // stdout carries only the build list, one IG per line.
    console.log(`${ig.instance} ${site} ${at}`);
  }
}
