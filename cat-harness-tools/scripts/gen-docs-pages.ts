/**
 * Emit `docs/<slug>.md` from a `docs/source/<slug>/<slug>.ts` webpage manifest.
 *
 * Same shape as `gen-skill-docs.ts`: derive the front matter, wrap the body,
 * write, and gate on `--check` so the generated copy cannot drift from its
 * source. Over a hand-written page it gives:
 *
 *   1. Anchors that do not depend on heading text. Each node's `id` is pinned
 *      with kramdown's `{: #id }`, so a retitle does not break inbound links
 *      (including the subprocess links `render-bpmn.ts` derives from a node's
 *      `asset.source`, `process-presentations.ts`).
 *   2. An edit link per node to ITS OWN source; Jekyll knows only
 *      `page.path`, so only the page assembler can do this.
 *   3. An asset's edit link points at the `.bpmn`, never at the generated
 *      `.svg`, which `render-bpmn.ts` says is never hand-edited.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-docs-pages.ts            # write
 *   bun run cat-harness-tools/scripts/gen-docs-pages.ts --check    # fail if any page is stale
 *
 * @covers docs
 */

import { markdownEditLink, repoOf } from "../src/core/edit-links.js";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, unlinkSync } from "node:fs";
import { workflowFiles, corpusScopeFor } from "./known-skills.js";
import { GLOBAL_TASK_ELEMENT } from "../src/workflow/process-model.js";
import { listInstances } from "../src/workflow/store.js";
import { workPlanFindings, workPlanOf } from "../schemas/sdlc/work-plan.js";
import { join, dirname, relative, resolve, posix, sep } from "node:path";
import { instanceRepositories, type InstanceRepository } from "../schemas/kg/instance-repositories.ts";
import type { WebPage, WebPageNode } from "../schemas/ui/webpage.ts";
import { resolveTarget } from "../schemas/sdlc/todo-index.js";
import { groupTodosByPage, renderTodoListing, todoListingFileFor } from "./todo-listing.js";
import { provenanceLogFor, writeProvenanceListing } from "./provenance-footer.ts";
import { SEMANTIC_ZOOM_FILE, readSemanticZoom } from "../schemas/kg/semantic-zoom.js";
import {
  buildTranslationIndex,
  localesReadableFor,
  pageKey,
  sourceLocale,
  type TranslationIndex,
} from "../pipeline/translation-index.ts";
import {
  QA_FAMILY_LABEL,
  qaCorpusAvailability,
  readWitnessDoc,
  rollUpWitnessDocs,
  sidecarPaths,
  type QaFamily,
  type QaWitnessDoc,
} from "../pipeline/qa-witness.ts";
import { todoDefaultTheme } from "./todos.js";
import { graphReadPath } from "./graph-read.ts";
import { publishedTodoFiles } from "./todo-source.js";
import { declaredSubgraphNode } from "./kg-export.ts";
import { TODO_GRAPH_SITE_PATH, TODO_SITE_DIR, serialiseJsonld, todoDocument, todoGraphDocument, todoPageSitePath, todoSitePath } from "./todo-graph.ts";
import { isLegacyTodoPage, isTodoPage, todoPageHtml } from "./todo-page.ts";
import { KG_RENDER_ASSET, kgRenderScript } from "./thin-page.ts";
import { beanDefsDir, beanFindings, blockEdges, blockedBy, blocksOf, readBeans } from "./beans.js";
import { branchKeptHref, branchKeptLocation } from "./branch-kept-href.js";
import { milestoneRollup } from "./milestone-rollup.js";
import { BURNDOWN_SCHEMA, DEFAULT_BURNDOWN_DAYS, buildBurndownFeed, burndownTargets, fetchBeanHistory, type BurndownFeed } from "./bean-burndown-feed.ts";
import { snapshotsFromGit } from "./epic-burndown.ts";
import { missingTopLevelKeys } from "./lib/json-shape.ts";
import { publishedPagePath } from "./lib/jekyll-permalink.ts";
import { overlayPath, writePathOf } from "./lib/layer-output.ts";
import { detectRepoUrl } from "../src/core/git-refs.js";
import { resolveThemeBackdrop } from "../schemas/ui/theme.js";
import { THEMES, themeById } from "../schemas/ui/themes.js";
import {
  directoryForGraph,
  publishedAssetPath,
  readDeclaration,
  docsSourceDirFor,
  siteDirFor,
  sourceLinks,
  repoRootFor,
} from "../schemas/kg/cat-harness.ts";
import { isQaGraphUnknown, projectQaGraph } from "../pipeline/qa-graph-index.ts";
import { tileCounts } from "../schemas/ui/tile-count.js";
import { OPEN_BEANS_UNIT, openBeanCount } from "./bean-store-read.js";
import { qaStorageOf } from "./qa-results.ts";
import { qaResultLinkFor, siteLinkKey } from "./qa-result-link.ts";
import { DEFAULT_QA_BRANCH, resolveQaLocation, type QaLocation } from "./qa-store.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { DOCS_SITE_BASE } from "../schemas/kg/jsonld.ts";
import { docsSources, qualifiedKey, siteNodeOf, type DocsSource } from "./lib/docs-sources.ts";
import { loadManifestValue, manifestPath } from "../pipeline/json-manifest.ts";

const INSTANCE_ROOT = join(HARNESS_ROOT);

/**
 * The language these generated pages are authored in — the layer's answer,
 * not the `en` literal this file used to write into every page's front matter.
 */
const SOURCE_LOCALE = sourceLocale(INSTANCE_ROOT);
// Platform documentation lives under `docs/source/`. It is NOT folio content
// (papers, chapters, block triples) — it is the platform's own structured docs,
// authored as `WebPage` manifests with `.ts` + `.md` blocks.
//
// An earlier cut placed these outside `content/` entirely (in `site-content/`)
// because `qa-section-title-audit.ts` walked every `content/<dir>/` looking for
// chapter manifests and treated webpage manifests as folio chapters ("7 titles
// across 7 chapters"). The fix was in the wrong place: the audit now skips
// `docs/source/` explicitly (alongside `pipeline/` and
// `content/schema/`), so documentation can live where content belongs — under
// `content/` — without tripping the folio-emptiness gate.
const SRC_DIR = docsSourceDirFor(INSTANCE_ROOT);
const OUT_DIR = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT));

/**
 * EVERY docs source in the checkout, the base layer's first (owner,
 * 2026-10-23, "A1": one run reads the docs-source directory every mounted
 * layer declares). The base layer's is {@link SRC_DIR} → {@link OUT_DIR},
 * unchanged; a layer above it renders its own pages into the docs
 * directory that declares them (`lib/docs-sources.ts`). Lazy, so importing
 * this module for a test does not walk the checkout.
 */
let DOCS_SOURCES: DocsSource[] | undefined;
function allDocsSources(): DocsSource[] {
  DOCS_SOURCES ??= docsSources(INSTANCE_ROOT);
  return DOCS_SOURCES;
}

/**
 * The docs source the page being rendered belongs to. Module-level, like
 * `qaIndex` below and for its reason: the page loop sets it before each page,
 * and the functions that read a block, a sidecar or a witness are several
 * frames down. Starts as the base layer's, so every exported helper a test
 * calls answers exactly as it did before there was more than one source.
 */
let CUR: DocsSource = {
  instance: INSTANCE_ROOT,
  root: resolve(INSTANCE_ROOT),
  srcDir: resolve(SRC_DIR),
  outDir: resolve(OUT_DIR),
  base: true,
};

/** The source directory as its layer sees it — `docs/source` for the base. */
function srcRel(src: DocsSource = CUR): string {
  return relative(src.root, src.srcDir).split(sep).join("/");
}

/**
 * The forge this checkout points at.
 *
 * DETECTED, not written down. This was the literal
 * `https://github.com/litlfred/folio-assistant` until 2026-09-20 — one
 * layer's address inside a generator every layer runs, which is exactly
 * the genericity failure `AGENTS.md` catalogues (a platform script carrying
 * `quantum-observable-universe`). Every edit link, every bean link and every
 * QA link this file emits was composed from it, so a fork's published docs
 * would have pointed at this repository.
 *
 * `gen-landing-data.ts` already resolved it this way; the two now agree.
 * The fallback keeps the links working where there is no `origin` to ask —
 * a sandbox, a tarball — rather than emitting hrefs that go nowhere.
 */
const REPO_WEB = detectRepoUrl(repoRootFor(INSTANCE_ROOT)) ?? "https://github.com/litlfred/folio-assistant";
// Edit links come from the shared recipe now (markdownEditLink, bean v433).

/**
 * The forge this checkout actually has, and the branch its links point at.
 *
 * RESOLVED from `origin`, never composed from a literal — bean `pb04`. The
 * `REPO_WEB` constant above still serves the page-node links that predate
 * this; the todo board's own controls go through `sourceLinks`, which returns
 * `undefined` for a non-github.com remote and so makes the control absent
 * rather than dead.
 *
 * `main` rather than the checked-out branch, for the reason
 * `gen-landing-data.ts` gives: this data is generated into a PUBLISHED site,
 * and a link to a feature branch dies when that branch does.
 */
/**
 * A path `readTodoFiles` reports, as the REPOSITORY sees it.
 *
 * `todos/` sits at the repository root while this generator's `INSTANCE_ROOT` is
 * the cat-harness layer, so `readTodoFiles` returns `../todos/items/x.md`.
 *
 * **The old edit link shipped that verbatim**, as
 * `https://github.com/.../edit/main/../todos/items/x.md`. A browser normalises
 * the `..` away before the request is sent, so what GitHub received was
 * `/edit/todos/items/x.md` — the branch segment eaten, a path that has never
 * existed. Every todo sticky's pencil was dead, and it looked entirely correct
 * in the generated JSON. Bean `pb04`; found by resolving the link rather than
 * by reading it.
 */
export function repoRelative(p: string): string {
  return relative(repoRootFor(INSTANCE_ROOT), resolve(INSTANCE_ROOT, p)).replace(/\\/g, "/");
}

const REPO_URL = detectRepoUrl(repoRootFor(INSTANCE_ROOT));
const SOURCE_BRANCH = "main";
/** Matches gen-skill-docs.ts / gen-schema-docs.ts — one glyph, no inline SVG. */
const EDIT_GLYPH = "✎";

/**
 * The QA state of one block, for the icon beside its heading.
 *
 * Deliberately three states and not two. A block with no sidecar has not been
 * swept; a block whose sidecar holds only `n/a` verdicts was swept and found
 * nothing applicable. Rendering either as "clean" would be the false pass this
 * repository keeps paying for — a sweep that reports a healthy corpus it never
 * checked is indistinguishable downstream from one that found nothing wrong.
 */
export type QaState = "fail" | "warn" | "pass" | "unswept";

export interface QaSummary {
  state: QaState;
  /** Counts, for the tooltip. `na` is reported, not hidden. */
  fail: number;
  warn: number;
  pass: number;
  na: number;
}

/*
 * The state mark (`✓ ! ✕`, and nothing at all for `unswept`) and the counts
 * line that used to be composed here now live in `docs/assets/js/docs-ui.js`,
 * beside the fetch that decides which of them applies. The reasoning behind
 * each glyph moved with them — see `QA_GLYPH` there.
 */

/**
 * Read a block's `<stem>.qa.json`, beside its `<stem>.md`.
 *
 * Returns `undefined` when there is no sidecar — the caller renders that as
 * `unswept` rather than omitting the icon, because a missing icon and a clean
 * one look identical to a reader and only one of them is true.
 *
 * A sidecar that will not parse is `unswept` too, not a crash: one malformed
 * file must not take down the whole docs build, and "could not read this" is
 * honestly the same answer to the reader as "nobody has checked".
 */
export function readQaSummary(blockDir: string, block: string): QaSummary | undefined {
  // Delegates to the family-generic reader so the badge and the panel it opens
  // cannot disagree about a verdict. The badge predates the panel and keeps its
  // four states: the panel's fifth outcome — a criterion the sidecar holds with
  // no verdict recorded against it — counts here as `na`, which leaves every
  // state this function has ever returned unchanged (a sidecar of nothing but
  // `n/a` and `unknown` was `unswept` before and still is).
  const doc = readWitnessDoc("block", join(blockDir, `${block}.md`), CUR.root);
  if (!doc) return undefined;
  return {
    state: doc.state,
    fail: doc.counts.fail,
    warn: doc.counts.warn,
    pass: doc.counts.pass,
    na: doc.counts.na + doc.counts.unknown,
  };
}

const check = process.argv.includes("--check");
/**
 * Publish only (owner, 2026-10-24, bean `tk99` option C): fetch the bean
 * store's history and write `assets/beans/burndown.json`. Off by default, so a
 * local run or a `--check` never touches the network and never writes a file
 * that would be stale on the next bean edit. See `bean-burndown-feed.ts`.
 */
const burndownHistory = process.argv.includes("--burndown-history") && !check;
let stale = 0;
let written = 0;
let qaWritten = 0;
/** Verdict projections whose CONTENT moved. Reported under `--check`, never gated. */
let refreshed = 0;
/** Witness-tree files a STORED directory holds no copy of in this checkout. Reported, never gated. */
let storedAbsent = 0;

/**
 * Repo-root-relative path of the file a node is edited through.
 *
 * An asset node resolves to the asset's SOURCE, not to the narrative and not to
 * the rendered artefact. A narrative node resolves to its `.md`. A node with
 * neither is a bare heading and has nothing to edit.
 */
/**
 * The repository and path an edit link names, from the DECLARATIONS rather
 * than the checkout — bean `5o5c`, owner ruling C (2026-10-22).
 *
 * The page is generated inside whichever checkout mounts this layer — the
 * index, a content layer's own checkout, a bare clone — and `REPO_WEB` is that
 * checkout's `origin`. Stamping it as `data-repo` made the same block render
 * three ways, and the rendered line is a msgid in the translation catalogues,
 * so every foreign root saw the catalogue as obsolete. It was also wrong where
 * it differed: `docs/source/…` is instance-relative, so
 * `litlfred/folio-assistant` + that path named a file the index does not hold.
 *
 * The owning layer is the one whose root holds the file, and its
 * `repository` is the repo the link names; the path is relative to that root.
 * A file no declaring layer holds keeps the checkout's own repository.
 */
export function declaredEditLocation(target: string): { source: string; repo?: string } {
  // `editTarget` answers instance-relative, except for a `../` asset, which it
  // already made checkout-relative; whichever exists is the file.
  const inInstance = resolve(CUR.root, target);
  const abs = existsSync(inInstance) ? inInstance : resolve(repoRootFor(CUR.root), target);
  const owner = instanceRepositoryEntries()
    .filter((e) => abs === e.root || abs.startsWith(e.root + sep))
    .sort((a, b) => b.root.length - a.root.length)[0];
  if (owner === undefined) return { source: target };
  return { source: relative(owner.root, abs).replace(/\\/g, "/"), repo: owner.repository };
}

/**
 * The base layer's own forge: the repository its declaration names, found the
 * way {@link declaredEditLocation} finds an owner, so the answer does not
 * depend on which checkout the layer is mounted in. `REPO_WEB` when nothing
 * declares one (a bare checkout of the layer itself, where the two agree).
 */
export function baseLayerWeb(): string {
  const repo = declaredEditLocation(".").repo;
  return repo ? `https://github.com/${repo}` : REPO_WEB;
}

let instanceEntries: InstanceRepository[] | undefined;
function instanceRepositoryEntries(): InstanceRepository[] {
  instanceEntries ??= instanceRepositories(repoRootFor(INSTANCE_ROOT)).entries;
  return instanceEntries;
}

export function editTarget(page: WebPage, node: WebPageNode): string | null {
  if (node.asset) {
    const src = node.asset.source;
    return src.startsWith("../") ? relative(repoRootFor(CUR.root), resolve(CUR.root, src)).replace(/\\/g, "/") : src;
  }
  const narrative = node.block ?? node.lead;
  if (narrative) return `${srcRel()}/${page.slug.replace(/\//g, "-")}/${narrative}.md`;
  return null;
}

function readBlock(page: WebPage, nodeId: string, block: string): string {
  const mdPath = join(CUR.srcDir, page.slug.replace(/\//g, "-"), `${block}.md`);
  if (!existsSync(mdPath)) {
    throw new Error(
      `node "${nodeId}" of page "${page.slug}" names block "${block}", ` +
        `but ${mdPath} does not exist`,
    );
  }
  return readFileSync(mdPath, "utf-8").trim();
}

/**
 * Where a subject's published witness JSON lands, and the set actually written.
 *
 * The sidecars themselves are not published: 14 of them are 392 KB, most of it
 * evidence and hashes a reader never opens. What ships is the projection in
 * `qa-witness.ts`, one file per (subject, family), fetched only when somebody
 * clicks the icon.
 */
//
// **Committed under `test/results/`, published at `/assets/qa/`.** Those are
// two different questions and the answers differ.
//
// WHERE IT LIVES follows provenance — the owner's rule, 2026-09-19: an
// artefact generated primarily as a QA reviewer belongs under `test/results/`
// as part of a QA process. A witness is exactly that: `qa-witness.ts`'s
// projection of what a checker found. It is not authored, and it was sitting
// in `docs/` only because that is where Jekyll could reach it.
//
// WHERE IT IS SERVED FROM is unchanged, deliberately. The `data-qa-src`
// emitted below still says `/assets/qa/…`, and the publishing workflows copy
// this directory into `_site/assets/qa/` after Jekyll runs. Moving the URL as
// well would have changed every badge in every generated page and the
// browser code that fetches them, for no gain — the reader's path to the
// evidence is not what was in the wrong place.
const QA_ASSET_DIR = join(INSTANCE_ROOT, "test", "results", "witnesses");

/**
 * Is the witness tree STORED — its directory declares `storage` (bean `16ei`)?
 *
 * Then nothing under it is committed: the record is the `qa-reports` branch,
 * and the checkout holds at most a working copy that `qa:fetch` or the site
 * build put there. So `--check` cannot gate on it in EITHER direction — a
 * file "missing" there is a contributor who did not fetch, and a file
 * "different" is a fetch of another commit. Both are reported and neither is
 * stale. Bean `4l4d`: with the corpus absent, the existence gate on the
 * per-page verdict indexes would have read every generated page as broken.
 *
 * Asked of the DECLARATION, not of `.gitignore` or of whether the files are
 * tracked today, so this flips with the declaration and nothing else.
 */
const QA_ASSETS_STORED = qaStorageOf(QA_ASSET_DIR) !== undefined;

/**
 * A layer's OWN witness tree: its pages' projections are its QA output, so
 * they sit under its `test/results/`, as the base layer's do under
 * {@link QA_ASSET_DIR}. The site build copies the base's tree into
 * `/assets/qa/` and each other layer's into `/assets/qa/<instance>/`, the
 * address its badges name (`lib/docs-sources.ts`), so one slug in two sources
 * is two witness directories.
 */
function qaAssetDirOf(src: DocsSource): string {
  return src.base ? QA_ASSET_DIR : join(src.root, "test", "results", "witnesses");
}
const storedTrees = new Map<string, boolean>();
/** {@link QA_ASSETS_STORED}, asked of whichever witness tree `path` is in. */
function qaStoredFor(path: string): boolean {
  for (const src of [CUR, ...(DOCS_SOURCES ?? [])]) {
    const logical = qaAssetDirOf(src);
    // A witness is emitted at its layer output root when its layer is mounted
    // (bean `cat-tools-sm8r`, item 4); its storage is still its layer's.
    const dir = [logical, writePathOf(logical)].find((d) => path === d || path.startsWith(d + sep));
    if (dir !== undefined) {
      if (!storedTrees.has(logical)) storedTrees.set(logical, src.base ? QA_ASSETS_STORED : qaStorageOf(logical) !== undefined);
      return storedTrees.get(logical)!;
    }
  }
  return QA_ASSETS_STORED;
}

/**
 * Was the DERIVED QA corpus in this checkout before this run wrote anything?
 *
 * Asked HERE, before the first witness is emitted, because this generator
 * recreates `witnesses/` itself and a question asked afterwards finds its own
 * output — which is exactly how the `qa` tile went from 965 to 2 (bean `tfqf`,
 * defect C9). Once derived QA lives on the `qa-reports` branch, an absent
 * corpus means `qa:fetch` did not run or missed; it does NOT mean nothing was
 * swept. So a subject with no sidecar renders "not available in this build"
 * rather than "not swept", and the `qa` projection publishes `unknown` rather
 * than a count. See `qaCorpusAvailability`.
 */
const QA_CORPUS = qaCorpusAvailability(INSTANCE_ROOT);
const corpora = new Map<string, ReturnType<typeof qaCorpusAvailability>>();
/** {@link QA_CORPUS} for the source being rendered — asked once per layer, before its first witness. */
function corpusOf(src: DocsSource = CUR): ReturnType<typeof qaCorpusAvailability> {
  if (src.base) return QA_CORPUS;
  if (!corpora.has(src.root)) corpora.set(src.root, qaCorpusAvailability(src.root));
  return corpora.get(src.root)!;
}
if (!QA_CORPUS.present) {
  console.log(
    `  ? the derived QA corpus is ABSENT (${QA_CORPUS.trees.map((t) => relative(INSTANCE_ROOT, t.dir)).join(", ")}): ` +
      `badges say "not available", and assets/qa/index.json says unknown. ` +
      `Run \`bun run cat qa:fetch --ref main\` (or \`--ref pr/<n>\`) first to publish the evidence.`,
  );
}

/**
 * The todo board's data, published as ONE file rather than one per node.
 *
 * QA verdicts are per-node and there are 134 of them, so a reader opening one
 * icon should fetch one file. Todos are the opposite: the navbar badge needs a
 * COUNT over all of them before anybody opens anything, and the board shows
 * the whole set lined up. Per-todo files would mean N requests to render a
 * number.
 */
const TODO_ASSET = join(OUT_DIR, "assets", "todos", "index.json");

/**
 * The LINEAR FLOOR — the same notes, as HTML the server already sent.
 *
 * A SECOND emission from the SAME `items` array three lines below the JSON
 * one, which is the only reason two artefacts about one fact are acceptable
 * here: they cannot drift, because neither is read to produce the other and a
 * single value produces both in one pass.
 *
 * Two outputs rather than one because they are read by different things at
 * different times. `assets/todos/index.json` is FETCHED by `docs-ui.js` after
 * the page loads; this fragment is INCLUDED by Jekyll before it is sent, and
 * a reader with JavaScript off never reaches the first. Jekyll will not read
 * `assets/` as data and a browser cannot fetch `_includes/`, so neither file
 * can serve the other's caller.
 *
 * Under `_includes/generated/` rather than beside the hand-written includes:
 * a directory that is entirely generated is unambiguous, and this repository's
 * standing rule is that a generated directory is never hand-edited.
 */
const TODO_LISTING_INCLUDE = join(OUT_DIR, "_includes", "generated", "todo-listing.html");

/**
 * EACH PAGE'S OWN LISTING — bean `lwjc`. One fragment per page that has a note
 * attached, under `todo-listing/`, and a `_data` index of which pages have one:
 * Jekyll cannot include a file that is not there, so `footer_custom.html` asks
 * the index first. A page with no note gets no file and no index entry, so
 * "nothing here" is an absence, never an empty section. The single listing
 * above stays: it is the todos board's, and the footer of a site built by an
 * older cat-harness still includes it.
 */
const TODO_LISTING_PAGES_DIR = join(OUT_DIR, "_includes", "generated", "todo-listing");
const TODO_LISTING_INDEX = join(OUT_DIR, "_data", "todo_listing.json");

/**
 * The folio's semantic-zoom declaration, as the board reads it.
 *
 * Published rather than inlined because R2 is explicit — *"the threshold SHALL
 * be declared data, not a literal in the renderer"* — and a number compiled
 * into `docs-ui.js` would satisfy the letter of that and none of the point.
 *
 * **Emitted only when the folio declares one.** A folio with no
 * `semantic-zoom.json` publishes NO file, `docs-ui.js` gets a 404, and it says
 * it could not determine a threshold rather than choosing one. A default here
 * would put the literal one layer further from where anybody looks for it.
 */
const ZOOM_ASSET = join(OUT_DIR, "assets", SEMANTIC_ZOOM_FILE);

/**
 * The first line of every generated include.
 *
 * An HTML comment rather than a Liquid one, deliberately: a Liquid comment is
 * stripped before the page is sent, so the one reader who most needs the
 * warning — somebody viewing source on the published site and wondering where
 * this markup came from — would never see it.
 */
const GENERATED_INCLUDE_BANNER =
  "<!-- GENERATED by scripts/gen-docs-pages.ts. Do not hand-edit: " +
  "`bun run cat-harness-tools/scripts/gen-docs-pages.ts` rewrites it, and " +
  "`--check` fails the build if it is stale. -->\n";

/**
 * The bean board's data — the AGENT work plan, published the same way.
 *
 * Same argument as `TODO_ASSET` one file rather than N: the badge needs a
 * COUNT before anybody opens anything. The difference is scale, and it is two
 * orders of magnitude — 239 beans against 3 todos on 2026-09-20 — which is
 * why the projection carries a TRIMMED body rather than the whole of one.
 * Every bean here runs to hundreds of lines of prose; shipping all of it would
 * put roughly a megabyte on the page to render a status column.
 */
const BEANS_ASSET = join(OUT_DIR, "assets", "beans", "index.json");

/**
 * THE NAVBAR'S BADGES — owner, 2026-10-05: *"why no count on beans and todos
 * on LHS top navbar as badges like fsh-guts has?"* (bean `gkv6`).
 *
 * A file of its own beside each index because the row is drawn on every page
 * and the bean index is ~900 KB: fetching it for one number is the megabyte
 * the note above refuses to put on a page. Same `tile` shape as the indexes.
 * Beans count OPEN work — `todo`, `in-progress` and `draft`, the owner's
 * choice ("Open beans: 525") — so the badge reads as what is waiting.
 */
const TODO_COUNT_ASSET = join(OUT_DIR, "assets", "todos", "count.json");
const BEANS_COUNT_ASSET = join(OUT_DIR, "assets", "beans", "count.json");
/** The board's burn-down feed, written by a publish build only (`--burndown-history`). */
const BEANS_BURNDOWN_ASSET = join(OUT_DIR, "assets", "beans", "burndown.json");

/**
 * How much of a bean's body the projection carries.
 *
 * Enough for a sticky's preview and no more. A reader who wants the argument
 * follows `editHref` to the file, which is the same affordance every other
 * node gets.
 *
 * **Measured at this length, 2026-09-20:** 239 beans project to 235 KB raw and
 * **62 KB gzipped** — 0.26 KB per bean against the todo index's 1.5 KB per
 * todo, so the per-item cost is already the lower of the two. The number is
 * recorded because the next person to change this constant should be changing
 * a measurement rather than a guess.
 */
const BEAN_BODY_PREVIEW = 400;
const emittedQa = new Set<string>();

/** Every published witness JSON currently on disk, for orphan detection. */
function listQaAssets(dir: string = QA_ASSET_DIR): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listQaAssets(p));
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out.sort();
}

/**
 * Which QA families can apply to a subject, decided by what the subject IS.
 *
 * This is applicability, not availability — a `.bpmn` with no `kg-qa/` sidecar
 * still gets a `KG ·` icon saying nobody has audited it, while a node holding
 * only a rendered SVG gets no KG icon at all because a KG audit was never
 * possible there. Collapsing those two into "no icon" is the false pass bean
 * `g6yr` argued about, one level up: silence about a missing audit reads as
 * "nothing to audit".
 */
function familiesFor(subjectPath: string): QaFamily[] {
  if (subjectPath.endsWith(".md")) return ["block", "translation"];
  if (/\.(bpmn|dmn)$/.test(subjectPath)) return ["kg"];
  if (/\.(ts|py|rs)$/.test(subjectPath)) return ["script"];
  return [];
}

/** What a subject is called in a "nobody has swept this" message. */
function subjectNoun(subjectPath: string): string {
  if (subjectPath.endsWith(".md")) return "block";
  if (/\.(bpmn|dmn)$/.test(subjectPath)) return "diagram";
  return "script";
}

function pageDir(page: WebPage): string {
  return join(CUR.srcDir, page.slug.replace(/\//g, "-"));
}


/**
 * The per-page verdict index being accumulated, keyed `<nodeId>.<family>`.
 *
 * Reset by the page loop before each page. Module-level rather than threaded
 * through `renderPage` because `qaIcons` is four frames down and the only
 * thing it would be threading is an accumulator.
 *
 * `qaUnswept` holds the keys whose subject has NO sidecar at all — "nobody
 * has ruled on this". That used to be decided in the page markup (an inert
 * `<span>`); it is decided here now, beside the verdicts, for the reason
 * `qaIcons` gives.
 */
let qaIndex: Record<string, { state: QaState; counts: QaWitnessDoc["counts"] }> = {};
let qaUnswept: string[] = [];

/**
 * A page's verdict index, as `folio-qa-index/v1`.
 *
 * `corpus` says whether this build HAD the derived QA corpus. `absent` is the
 * state the painter must keep apart from both a verdict and "not swept": the
 * results were not fetched, so whether anything was swept is unknown, and
 * every badge reads "not available in this build". With the corpus absent the
 * index carries no rows and no `unswept` keys, because it knows neither.
 * Bean `4l4d`.
 */
export function qaIndexDoc(
  page: string,
  corpusPresent: boolean,
  badges: Record<string, { state: QaState; counts: QaWitnessDoc["counts"] }>,
  unswept: readonly string[],
): string {
  return (
    JSON.stringify({
      $schema: "folio-qa-index/v1",
      page,
      corpus: corpusPresent ? "present" : "absent",
      badges: corpusPresent ? badges : {},
      unswept: corpusPresent ? [...new Set(unswept)].sort() : [],
    }) + "\n"
  );
}

/**
 * Where a page's verdict index lands, and the URL the badges fetch it from.
 *
 * **No leading underscore, deliberately.** GitHub Pages strips `_`-prefixed
 * paths unless `.nojekyll` is present, and this file is published by a `cp`
 * into `_site` AFTER Jekyll has run — so a Pages-side strip would 404 every
 * index and paint every badge on the site `could not determine`. Honest, and
 * useless. `.nojekyll` is on `gh-pages` today; a filename that does not depend
 * on it is cheaper than a filename that does.
 *
 * It cannot collide with a projection: those are `<nodeId>.<family>.json`, and
 * `qa-index` is not a QA family.
 */
const QA_INDEX_FILE = "qa-index.json";

/**
 * The hand-authored pages that HAVE a translation projection, published at
 * `/assets/qa/translation-qa-pages.json` — see `publishAuthoredPageTranslationQa`.
 * Not `_`-prefixed, for the reason `QA_INDEX_FILE` gives.
 */
export const TRANSLATION_QA_PAGES_FILE = "translation-qa-pages.json";

/** `folio-qa-translation-pages/v1`: which authored pages have a projection, or `corpus: "absent"`. */
export function translationQaPagesDoc(corpusPresent: boolean, pages: readonly string[]): string {
  return (
    JSON.stringify(
      {
        $schema: "folio-qa-translation-pages/v1",
        corpus: corpusPresent ? "present" : "absent",
        pages: corpusPresent ? [...pages].sort() : [],
      },
      null,
      2,
    ) + "\n"
  );
}

/**
 * The badge placeholder: what the COMMITTED page carries for one
 * (subject, family) pair — identical whatever the QA corpus says, which is
 * the whole of bean `4l4d`. Exported for the test that pins exactly that.
 */
export function qaBadgePlaceholder(opts: { family: QaFamily; key: string; noun: string; slug: string }): string {
  const { tag, label } = QA_FAMILY_LABEL[opts.family];
  const title = `${label}: loading the verdict…`;
  // `relative_url` so the path survives the site's baseurl — `/folio-assistant`
  // here, something else on a staging deploy. A hardcoded absolute path
  // 404s on every deploy but one.
  //
  // `lang="en" dir="ltr"` (bean `giiw`): the tag, the tooltip and the panel
  // it opens are English on every locale. `docs-ui.css` already set
  // `direction: ltr` on it under `[dir="rtl"]`, which a screen reader cannot
  // hear and a stylesheet that fails to load does not apply. `docs-ui.js`
  // builds the hand-authored page's badge with the same two attributes.
  return (
    `<button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-${opts.family}" lang="en" dir="ltr" ` +
    `data-qa-family="${opts.family}" data-qa-key="${opts.key}" data-qa-label="${label}" ` +
    `data-qa-noun="${opts.noun}" ` +
    `data-qa-src="{{ '/assets/qa/${opts.slug}/${opts.key}.json' | relative_url }}" ` +
    `data-qa-index="{{ '/assets/qa/${opts.slug}/${QA_INDEX_FILE}' | relative_url }}" ` +
    `aria-expanded="false" aria-busy="true" title="${title}" aria-label="${title}">` +
    `<span class="fa-qa-tag">${tag}</span>` +
    `<span class="fa-qa-glyph" aria-hidden="true">…</span></button>`
  );
}

/**
 * Icons for every family applicable to this node's subjects.
 *
 * **The markup carries NO QA data at all** — not the verdict (bean `d2kp`),
 * and since bean `4l4d` not even whether a sidecar exists. What the page says
 * is decided by the content STRUCTURE alone: which nodes exist and which QA
 * families apply to each (`familiesFor`), plus the URLs of the projection and
 * of the page's verdict index. Each of those changes only when the CONTENT
 * does, so a committed page is the same with the corpus fetched, absent, or
 * fetched from another commit.
 *
 * ## Why "not swept" moved out of the page
 *
 * It was server-rendered, as an inert `<span>`, on the argument that whether a
 * sidecar exists is structure. It was — while the corpus was committed. Once
 * derived QA lives on the `qa-reports` branch (bean `5hox`), sidecar existence
 * is a fact about the FETCHED tree, not about the checkout, and a page that
 * embedded it went stale on every checkout that had not fetched: with
 * `test/results/` absent `--check` read all 17 generated pages as stale
 * (`docs:pages:check`, `check:ci-invocations`).
 *
 * So the page carries one uniform placeholder per (subject, family), and the
 * per-page `qa-index.json` — its own small JSON asset, generated beside the
 * projections at site-build time and fetched by `paintQaBadges` — says which
 * of four things each one is:
 *
 *   - a row: a verdict (`fail` / `warn` / `pass`, or `unswept` = swept and
 *     nothing applied, painted `empty`);
 *   - listed in `unswept`: no sidecar, nobody has ruled — painted inert;
 *   - `corpus: "absent"`: the results were not fetched for this build, so
 *     whether it was swept is unknown — "not available in this build";
 *   - the index would not load, or has no row: could not determine.
 *
 * "Not swept" and "could not determine" stay distinct facts; they are decided
 * one file over now. (An absent simulators directory rendered as "this folio
 * has no simulators" is the collapse this repository has paid for.)
 *
 * **Why an index rather than each badge fetching its own projection**, which is
 * what bean `d2kp` proposed: `publication-workflow` carries 21 projections
 * totalling 376 KB, and fetching all of them to paint 39 glyphs would
 * reintroduce at page load exactly the weight that is the reason the sidecars
 * are not published. The index is a few KB and one request; the projection is
 * still fetched per badge, on click, as before.
 */
function qaIcons(page: WebPage, node: WebPageNode): string {
  const subjects: string[] = [];
  if (node.block) subjects.push(join(pageDir(page), `${node.block}.md`));
  if (node.asset) subjects.push(join(CUR.root, node.asset.source));

  const slug = page.slug.replace(/\//g, "-");
  const out: string[] = [];
  for (const subject of subjects) {
    for (const family of familiesFor(subject)) {
      const key = `${node.id}.${family}`;
      // The ADDRESS is qualified by layer above the base — its witness tree
      // is published at `/assets/qa/<instance>/` (`lib/docs-sources.ts`) — and
      // the files on disk keep their plain `<slug>/` directory.
      out.push(qaBadgePlaceholder({ family, key, noun: subjectNoun(subject), slug: qualifiedKey(CUR, slug) }));

      // The INDEX half — what the corpus says. Nothing below reaches the page.
      if (!corpusOf().present) continue;
      // EXISTENCE first: `sidecarPaths` stats the disk and returns only files
      // that are there — "has anything ever ruled on this?".
      if (sidecarPaths(family, subject, CUR.root).length === 0) {
        qaUnswept.push(key);
        continue;
      }
      const doc = readWitnessDoc(family, subject, CUR.root);
      if (doc) {
        const abs = join(qaAssetDirOf(CUR), slug, `${key}.json`);
        // Minified: these are fetched by the browser, never read as a diff, and
        // the corpus sweep took the set from 35 files to 134. Indentation was 32%
        // of 2.9 MB — a third of what every reader of the site would download for
        // whitespace nobody looks at.
        emitWitness(abs, JSON.stringify(withSidecarLinks(doc)) + "\n");
        qaIndex[key] = { state: doc.state, counts: doc.counts };
      }
      // A sidecar that exists but will not project — malformed JSON, or a
      // translation family whose locales hold no criteria — writes no file and
      // no index entry, so the badge resolves to `could not determine` in the
      // browser. Deliberate: the subject HAS been swept, and rendering that as
      // "not swept" would be the false pass one line up.
    }
  }
  if (out.length === 0) return "";
  // One floated CONTAINER, not several floated chips. Floating each icon
  // separately reverses their visual order (the first float lands rightmost),
  // so the families would read right-to-left against the order this emits them.
  return ` <span class="fa-qa-badges">${out.join(" ")}</span>`;
}

/**
 * The page-level `TR` badge — one panel for every translation verdict on the
 * page, rolled up from its blocks' sidecars.
 *
 * ## The gap it fills
 *
 * The per-node `TR` icon is honest and almost always empty: a block gets a
 * translation sidecar only when a PO actually carries its strings, and this
 * site is 3% translated, so 114 of 115 of those icons are "not swept" with
 * nothing under them. A reader of a translated page had no translation
 * evidence to open anywhere on it. The page-level round-trip badge that once
 * stood in that spot was deleted (bean `ktt2`) because it scored 36 strings
 * against a 6-entry back-translation map and published every unmeasured one as
 * drift — right to remove, and nothing replaced it. Issue #687, bean `r3ez`.
 *
 * ## It is the SAME control as every other badge, deliberately
 *
 * Same placeholder, same `data-qa-*` contract, same `qa-index.json`, painted
 * by the same `paintQaBadges` and opened by the same `qaToggle`. The only new
 * fact is the subject, which is a page rather than a node, and
 * `rollUpWitnessDocs` labels every criterion with the block it came from so
 * the panel still says which one a failure belongs to.
 *
 * No roll-up at all is `unswept` in the index — nothing to open — and, as for
 * every other badge since bean `4l4d`, that is the index's answer rather than
 * the page's.
 *
 * The badge rides a `fa-page-qa-badges` paragraph under the `h1`;
 * `mountTranslationBadges` in `docs-ui.js` hoists it into the coverage/sweep
 * row so the page carries one badge row rather than two.
 */
function pageQaIcons(page: WebPage): string {
  const subjects = page.nodes
    .filter((n) => n.block)
    .map((n) => ({
      path: join(pageDir(page), `${n.block}.md`),
      label: blockLabel(page, n) ?? n.id,
    }));
  if (subjects.length === 0) return "";

  const family: QaFamily = "translation";
  const slug = page.slug.replace(/\//g, "-");
  const key = `page.${family}`;

  if (corpusOf().present) {
    const doc = rollUpWitnessDocs(family, subjects, CUR.root, `${page.title} — translations`);
    if (!doc) {
      qaUnswept.push(key);
    } else {
      const abs = join(qaAssetDirOf(CUR), slug, `${key}.json`);
      emitWitness(abs, JSON.stringify(withSidecarLinks(doc)) + "\n");
      qaIndex[key] = { state: doc.state, counts: doc.counts };
    }
  }

  return `<span class="fa-qa-badges fa-page-qa-badges">${qaBadgePlaceholder({ family, key, noun: "page", slug: qualifiedKey(CUR, slug) })}</span>`;
}
/**
 * The block's label, read from its own module rather than composed.
 *
 * `sec:<page-slug>-<node-id>` is the convention every block follows, and
 * composing it here would work until one block did not. The label is the
 * block's own declaration; this reads it and returns `undefined` when the
 * block has none, so a node with no label emits no attribute rather than a
 * guessed one.
 */
function blockLabel(page: WebPage, node: WebPageNode): string | undefined {
  const slug = page.slug.replace(/\//g, "-");
  const file = manifestPath(join(CUR.srcDir, slug), node.id);
  if (!existsSync(file)) return undefined;
  const m = /^\s*"?label"?:\s*"([^"]+)"/m.exec(readFileSync(file, "utf-8"));
  return m ? m[1] : undefined;
}

/**
 * A rendered BPMN drawing as the page carries it.
 *
 * LAZY (owner, 2026-11-14: "do lazy load content and libs"): `loading="lazy"`
 * and `decoding="async"`, so a drawing far down a processes page is not
 * fetched until a reader nears it; `docs-ui.js` inlines it then. Printing is
 * not affected ("Make sure printing loads all of the content before it
 * renders the PDF"): browsers load lazy images for a printout, and
 * `docs-ui.js` turns them eager on `beforeprint` and inlines every drawing.
 */
export function bpmnFigureLines(id: string, src: string, alt: string): string[] {
  return [
    `<div class="bpmn-figure" id="figure-${id}">`,
    `  <img src="${src}" loading="lazy" decoding="async"`,
    `       alt="${alt.replace(/"/g, "&quot;")}">`,
    "</div>",
  ];
}

function emitNode(page: WebPage, node: WebPageNode): string[] {
  const out: string[] = [];
  const level = node.level ?? 2;

  if (node.title) {
    out.push(`${"#".repeat(level)} ${node.title}`);
    // The id is PINNED here rather than left to `heading_anchors`, which would
    // derive it from the words above. See the header comment.
    //
    // `data-fa-label` carries the block's PAGE-QUALIFIED label alongside it,
    // which is what a todo's `targetLabel` addresses. The bare `id` cannot
    // serve: `what-is-not-built-yet` is a node on both `agentic-harness` and
    // `crdm-methodology`, so matching on it would attach a todo to whichever
    // page the reader happened to open. Same lesson as `TaskRef` carrying its
    // process — an id is unique only within its container.
    const label = blockLabel(page, node);
    out.push(label ? `{: #${node.id} data-fa-label="${label}" }` : `{: #${node.id} }`);
    out.push("");
  }

  const target = editTarget(page, node);
  if (target) {
    // The QA icons ride the same line as Edit: both are per-node affordances
    // about THIS node, and a second row would separate them for no reason.
    const qa = qaIcons(page, node);
    const at = declaredEditLocation(target);
    out.push(
      // The shared recipe (bean v433): facts on the link, href built by edit-links.js.
      `${markdownEditLink({ repo: repoOf(REPO_WEB) }, { ...at, text: `${EDIT_GLYPH} Edit`, className: "fa-node-edit", title: `Edit ${at.source}` })}${qa}`,
    );
    out.push("");
  }

  if (node.lead) {
    out.push(readBlock(page, node.id, node.lead));
    out.push("");
  }

  if (node.asset) {
    const a = node.asset;
    out.push(...bpmnFigureLines(node.id, siteAddressed(page, a.rendered), a.alt));
    out.push("");
    // The source links are kept as well as the edit link: they are different
    // acts. Reading the XML and changing it are not the same request, and the
    // existing pages have always offered the first.
    if (a.sourceLinks && a.sourceLinks.length > 0) {
      const rendered = a.sourceLinks.map((l) => `[${l.text}](${siteAddressed(page, l.href)})`);
      if (a.linkStyle === "caption") {
        // Paragraph-level attribute list on the line BELOW, which is what
        // kramdown needs when several links share one class.
        out.push(rendered.join(" · "));
        out.push("{: .bpmn-source }");
      } else {
        out.push(`${rendered.join(" · ")}{: .btn .btn-outline }`);
      }
      out.push("");
    }
  }

  if (node.block) {
    out.push(readBlock(page, node.id, node.block));
    out.push("");
  }

  return out;
}

/**
 * A node's asset path (`assets/img/workflows/x.svg`), which the manifest
 * writes relative to the page's SOURCE directory, addressed so it resolves from wherever
 * the page is published. A relative path only meant that while every page sat
 * at the root; since bean `kc7k` the docs-folder pages publish under
 * `docs/cat-harness/`, so it is written through `relative_url`. An absolute
 * URL, a site-absolute path or an anchor is left as written.
 */
function siteAddressed(page: WebPage, path: string): string {
  if (/^([a-z][a-z0-9+.-]*:|\/|#|\{)/i.test(path)) return path;
  // Relative to the page's SOURCE directory, as the manifest wrote it.
  const dir = page.slug.includes("/") ? page.slug.slice(0, page.slug.lastIndexOf("/")) : "";
  const site = posix.normalize(posix.join(dir, path));
  if (site.startsWith("../")) return path;
  return `{{ '/${site}' | relative_url }}`;
}

/** Where a page's content is authored — the file to edit instead of the output. */
function manifestRef(page: WebPage): string {
  return `${srcRel()}/${page.slug.replace(/\//g, "-")}/`;
}

/**
 * The rendered corpus's translation index, built ONCE and lazily.
 *
 * Lazily because five test files import this module, and walking the whole site
 * directory at import time is a cost every one of them would pay for nothing —
 * the `654 subprocesses at import` shape, one module over.
 *
 * It **throws** rather than degrading when the index cannot be determined, and
 * that choice is the load-bearing one. Falling back to the source locale alone
 * would stamp a NARROWER claim than the truth and look perfectly clean doing
 * it: every page would read "English only", no gate would fire, and the
 * language bar would quietly lose every translation in the corpus. That is the
 * `dh4f` defect exactly — a consumer scanning nothing and reporting a clean run
 * over it. An unreadable index is a third state, not an empty one.
 */
const TRANSLATION_INDEXES = new Map<string, TranslationIndex>();
function translationIndex(src: DocsSource = CUR): TranslationIndex {
  const cached = TRANSLATION_INDEXES.get(src.outDir);
  if (cached !== undefined) return cached;
  // A layer above the base renders into its own docs directory, which is
  // composed into the base's site rather than being a Jekyll site itself — so
  // its index is asked of that directory, by name.
  const { index, findings } = src.base ? buildTranslationIndex(src.root) : buildTranslationIndex(src.root, src.outDir);
  const hard = findings.filter((f) => f.severity !== "note");
  if (hard.length > 0) {
    throw new Error(
      "the translation index could not be determined, so `available_locales` " +
        "cannot be stamped:\n" +
        hard.map((f) => `  ${f.severity}  ${f.where}: ${f.message}`).join("\n"),
    );
  }
  TRANSLATION_INDEXES.set(src.outDir, index);
  return index;
}

function renderPage(page: WebPage): string {
  const lines: string[] = [];
  // Which languages can a reader read THIS page in — asked of the rendered
  // corpus, not of the catalogue directory.
  //
  // `available_locales` is defined by `translation-manager.md` as *"which
  // languages can I read this page in"*, and it deliberately includes the
  // source language. A `.po` file does not answer that question: it is intent
  // to translate. Stamping the PO-derived list conflated the two in BOTH
  // directions — `crdm-methodology` claimed French on the strength of a
  // 25-line catalogue with one filled entry and no French page anywhere, while
  // five pages rendered in all five target locales with no catalogue stamped
  // `["en"]` and hid their own translations from the language bar. Bean `9x01`.
  //
  // Issue #687 and bean `czct` are still why the SOURCE language is folded in
  // rather than left out, and why both halves of the corpus must stamp the same
  // meaning: the PO-derived list alone made the coverage badge read `0/5` on a
  // page that plainly exists in English, and disagreed with what the
  // hand-authored translated pages stamp. That rule is unchanged. What changed
  // is where the target locales come from.
  //
  // `pageKey(page.slug)` and NOT the `.po` stem: the stem is
  // `slug.replace(/\//g, "-")`, so `guides/who-smart-ig` becomes
  // `guides-who-smart-ig` — a key that matches no page and silently resolves to
  // "source language only". Measured on this corpus the two happen to give the
  // same answer, which is precisely why it needs saying.
  const locales = localesReadableFor(CUR.root, translationIndex(), pageKey(page.slug));

  lines.push("---");
  lines.push("layout: default");
  // THE SAME FACT AS THE BANNER BELOW, WHERE A MACHINE CAN READ IT.
  //
  // The HTML comment further down has said "generated" since bean `06e3`, and
  // it sits under the front matter — so `check:reference-direction`, which
  // reads a declaration out of the first lines and nothing else, graded every
  // page this writes as authored prose. That is bean `ws99`: correct
  // information in a place the reader cannot reach is not a declaration.
  //
  // `generated:` is the key `gen-skill-docs.ts` and `gen-schema-docs.ts`
  // already emit (PR #1222), spelled the same way on purpose: one reader
  // recognising every generator here is the whole point of not inventing a
  // second form. The comment stays — it is what a PERSON reading the source
  // on the forge sees, and it names the manifest this page came from, which
  // the key does not.
  lines.push(`generated: scripts/gen-docs-pages.ts — do not hand-edit; run \`bun run cat docs:pages\``);
  lines.push(`title: ${page.title}`);
  if (page.parent) lines.push(`parent: ${page.parent}`);
  if (page.navOrder !== undefined) lines.push(`nav_order: ${page.navOrder}`);
  // What the page documents (#1168 B7c): read from here by the coverage
  // check, since the directory no longer names its page.
  if (page.documents?.length) {
    lines.push("documents:");
    for (const d of page.documents) lines.push(`  - ${d}`);
  }
  lines.push(`lang: ${CUR.base ? SOURCE_LOCALE : sourceLocale(CUR.root)}`);
  if (locales.length > 0) {
    lines.push(`available_locales: ${JSON.stringify(locales)}`);
  }
  lines.push("---");
  lines.push("");
  // THE PAGE SAYS IT WAS GENERATED, IN ITS OWN BYTES.
  //
  // Until bean `06e3` §4(b) this generator marked nothing it wrote, so its
  // output was byte-indistinguishable from an authored page and nothing
  // downstream could tell them apart. `check:docs-populated` had to report
  // these as an ambiguity it could not resolve, and it was right to: crediting
  // them would let a harness pass on documentation nobody wrote, and dropping
  // them would fail a harness for pages it does have.
  //
  // An HTML comment, so it is invisible in the rendered page and present in
  // the source a reader opens on the forge. The phrase is the one every other
  // generator here uses, which is what makes ONE reader able to recognise all
  // of them rather than a list of spellings.
  lines.push(`<!-- Generated by scripts/gen-docs-pages.ts from ${manifestRef(page)}. Do not hand-edit: the next run overwrites it, and \`docs:pages:check\` fails on the difference. -->`);
  lines.push("");
  lines.push(`# ${page.heading ?? page.title}`);
  lines.push("{: .no_toc }");
  lines.push("");
  // The page-level QA row, under the title. `docs-ui.js` hoists it into the
  // coverage/sweep badge row it builds in the same place, so the reader sees
  // one row; it stands on its own if that script does not run.
  const pageQa = pageQaIcons(page);
  if (pageQa) {
    lines.push(pageQa);
    lines.push("");
  }
  lines.push("<details open markdown=\"block\">");
  lines.push("  <summary>On this page</summary>");
  lines.push("  {: .text-delta }");
  lines.push("1. TOC");
  lines.push("{:toc}");
  lines.push("</details>");
  lines.push("");
  // The forge the source sits in: the DECLARING layer's repository, from the
  // same declarations the per-node edit links read. For the base layer that
  // is the layer's own repository, never the checkout's: in a composed root
  // the checkout is the index (or an instance such as smart-ips-pilgrimage),
  // so `REPO_WEB` named a different repository in every root that ran this
  // and `derive:publish` rewrote the committed pages (cat-harness#1150, 4).
  // `REPO_WEB` is the fallback only when no declaration names a repository.
  const owner = CUR.base ? undefined : declaredEditLocation(manifestRef(page));
  const web = owner?.repo
    ? `https://github.com/${owner.repo}`
    : CUR.base
      ? baseLayerWeb()
      : REPO_WEB;
  const srcPath = owner?.repo ? owner.source.replace(/\/+$/, "") : `${srcRel()}/${page.slug.replace(/\//g, "-")}`;
  lines.push(
    `_This page is generated from [\`${manifestRef(page)}\`](${web}/tree/main/${srcPath}) — ` +
      `each section below links to its own source._`,
  );
  lines.push("");

  const seen = new Set<string>();
  for (const node of page.nodes) {
    if (seen.has(node.id)) {
      throw new Error(`page "${page.slug}" has two nodes with id "${node.id}"`);
    }
    seen.add(node.id);
    lines.push(...emitNode(page, node));
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * What `--check` gates, and what it merely reports.
 *
 * Three kinds, because two would put a live measurement behind a red X:
 *
 *   - **`page`** — a `docs/*.md`. Gated on exact content. Everything it now
 *     carries is structure, so a difference is somebody who added a node,
 *     renamed a block, ran a first sweep, or moved a sidecar, and did not
 *     regenerate. That is a real omission and a reviewer reads the page in the
 *     diff, so it must not drift.
 *   - **`data`** — `assets/todos/index.json`, likewise a projection of files a
 *     human authored. Gated on exact content for the same reason.
 *   - **`verdict`** — a witness projection or a page's verdict index. Gated on
 *     EXISTENCE only. Its contents are a function of the QA sidecars AND of
 *     the working tree (`readWitnessDoc` recomputes `freshness` by hashing the
 *     live subject), so it moves whenever a sweep re-runs or a block is
 *     edited — neither of which anybody forgot to do. A missing file IS an
 *     omission: the badge would point at a 404 forever.
 *
 * **Not gating the contents costs the reader nothing, and that is checkable
 * rather than argued.** `docs-site.yml` and `feature-staging.yml` both run
 * this generator in full before copying `test/results/witnesses/` into
 * `_site/assets/qa/`, so the projections a reader actually fetches are
 * regenerated at publish. The committed copies are a cache for local work and
 * for review; gating them could only ever fire on a graph that changed, which
 * is precisely what bean `d2kp` exists to stop the gate doing.
 */
function emit(logical: string, content: string, kind: "page" | "data" | "verdict" | "stored" = "page"): void {
  // A page or datum of a MOUNTED layer is computed output (bean `cat-tools-sm8r`,
  // item 4): a check compares the copy a reader sees (output root, else the
  // pinned page), a write goes to the layer's output root, never the mount. In
  // the layer's own checkout both are `logical`.
  const path = check ? overlayPath(logical) : writePathOf(logical);
  if (check) {
    const present = existsSync(path);
    const current = present ? readFileSync(path, "utf-8") : "";
    if (current === content) return;
    if (kind === "stored") {
      // A STORED directory's working copy (bean `4l4d`): missing is a
      // contributor who has not fetched, different is a fetch of another
      // commit. Neither is this checkout's defect, so neither is gated.
      if (present) refreshed++;
      else storedAbsent++;
      return;
    }
    if (kind === "verdict") {
      // Absent is a failure; different is news. Keeping them apart is the
      // whole of this change at the file level.
      if (!present) {
        console.error(`  ✗ ${path} is missing`);
        stale++;
        return;
      }
      // Content moving is news, but a SHAPE that moved is an omission: the
      // generator now writes a top-level field the committed copy lacks.
      // Measured on #1955, 2026-10-04 (bean `324x`): a main merge took main's
      // `assets/beans/index.json` (no `edges`, bean `vhqq`) by the site-data
      // pattern, `check:kind-validators` went red, and this check said
      // current — so regen, the merge bot's included, never rewrote it.
      const missing = missingTopLevelKeys(current, content);
      if (missing.length) {
        console.error(`  ✗ ${path} is stale: lacks ${missing.map((k) => `\`${k}\``).join(", ")}, which the generator now writes`);
        stale++;
      } else {
        refreshed++;
      }
      return;
    }
    console.error(`  ✗ ${path} is stale`);
    stale++;
    return;
  }
  if (path !== logical) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  if (kind === "verdict" || kind === "stored") qaWritten++;
  else written++;
}

/**
 * Emit one file into the witness tree, and record it for the orphan sweep.
 *
 * `stored` when the tree's directory declares `storage` (see
 * `QA_ASSETS_STORED`), and `verdict` — existence-gated — while it is a
 * committed directory, so the gate this generator has always had on a
 * committed witness tree is unchanged until the declaration says otherwise.
 */
function emitWitness(logical: string, content: string): void {
  // A mounted layer's witness goes to its layer output root, never into the
  // mount (bean `cat-tools-sm8r`, item 4). Compared, emitted and swept there.
  const path = writePathOf(logical);
  // Directories only on the WRITE path: `--check` creates nothing, so a check
  // run cannot leave an empty witness tree that a later reader mistakes for a
  // fetched one.
  if (!check) mkdirSync(dirname(path), { recursive: true });
  emit(path, content, qaStoredFor(path) ? "stored" : "verdict");
  emittedQa.add(path);
}

/**
 * The key of the `qa-reports` entry this build's evidence came from, read once
 * from the `qa-site-assets` fetch state. `undefined` in a local build, where
 * the links fall back to the branch tip.
 */
const QA_LINK_KEY = siteLinkKey();

/**
 * A witness projection with every sidecar's address stamped in: bean `bejf`,
 * issue #2217. The browser renders `sidecarLinks` and composes no URL itself.
 * It used to do so as `blob/main/` + an instance-relative path, which was
 * wrong in both halves. The address comes from `qa-result-link.ts`, the one
 * place that reads the store's declaration.
 */
function withSidecarLinks(doc: QaWitnessDoc): QaWitnessDoc {
  const repoRoot = repoRootFor(CUR.root);
  const location = qaLocationOf(repoRoot);
  const sidecarLinks = doc.sidecars.map((p) =>
    qaResultLinkFor(resolve(CUR.root, p), { repoRoot, repoWeb: REPO_WEB, key: QA_LINK_KEY, location }),
  );
  return { ...doc, sidecarLinks };
}

/**
 * Where QA results live in `repoRoot`, resolved ONCE per run
 * (cat-harness-tools#871). `resolveQaLocation` walks every layer in the
 * checkout and reads its declarations; asked per sidecar link, as it was,
 * that walk was ~22 s of a ~23 s run (2026-10-30, ~1200 links), and it put
 * `gen-docs-pages-orphan-qa-checkout.test.ts` past its 30 s timeout.
 *
 * The answer cannot change within a run: the generator writes witnesses, not
 * declarations. A location that does not resolve reads as "nothing stored",
 * which is exactly what `qaStorageOf` answers when the resolve throws.
 */
const qaLocations = new Map<string, QaLocation>();
function qaLocationOf(repoRoot: string): QaLocation {
  let loc = qaLocations.get(repoRoot);
  if (loc === undefined) {
    try {
      loc = resolveQaLocation(repoRoot);
    } catch {
      loc = { branch: DEFAULT_QA_BRANCH, keyedBy: "commit", declared: false, directories: [] };
    }
    qaLocations.set(repoRoot, loc);
  }
  return loc;
}

if (!existsSync(SRC_DIR)) {
  console.log(`no ${SRC_DIR} — nothing to generate`);
  process.exit(0);
}

// Guarded so IMPORTING this module does not regenerate the site.
//
// `readQaSummary` is exported for its own test, and without this guard that
// import rewrote all 11 pages as a side effect of `bun test` — a test run that
// silently edits the working tree is a test run nobody can trust, and on a
// `--check` CI job it would compare freshly written output against itself.
if (import.meta.main) {

/**
 * Every block's declared label, resolved to the page and node it is on.
 *
 * THE REVERSE INDEX R3 NEEDS, and it is a JOIN rather than two fields lying
 * around. `readTodoFiles` hands the todo emitter `targetLabel` and nothing
 * else; the page and node live HERE, where `blockLabel` reads a block's own
 * declaration while this loop holds both. Building it costs nothing extra
 * because the walk happens anyway — but it is why `target` could not simply be
 * spread from the todo, which an earlier impact analysis assumed and which the
 * data-model phase corrected.
 *
 * Filled by the loop below and read by the todo index further down, so the
 * loop must run first — which it does: the index is emitted after every page.
 */
const blockByLabel = new Map<string, { page: string; node: string }>();
const blockFileOf = (src: DocsSource, flat: string, node: string): string =>
  relative(repoRootFor(INSTANCE_ROOT), manifestPath(join(src.srcDir, flat), node)).split(sep).join("/");
/** The docs source that holds each plain label in {@link blockByLabel}. */
const labelSource = new Map<string, DocsSource>();
/** The file that declares each plain label, checkout-relative, for the warning. */
const labelFile = new Map<string, string>();


/**
 * Where each page is PUBLISHED, site-relative, for the links the todo board
 * composes to a block — keyed by the page's QUALIFIED slug
 * (`lib/docs-sources.ts`), so one slug in two sources is two pages. A page of
 * a source above the base is composed into the site under its layer's name
 * (`compose-docs.ts`), so its address carries that prefix; the base
 * layer's is Jekyll's answer for its own site.
 */
const pageRoute = new Map<string, string>();
const publishedAt = (slug: string): string => pageRoute.get(slug) ?? publishedPagePath(OUT_DIR, slug);

/**
 * Each page's source documents, keyed as the footer looks them up, for the
 * provenance footer (`provenance-footer.ts`). A generated page's blocks are
 * its sources, in node order. Authored pages are added after the loop.
 */
const provenancePages = new Map<string, string[]>();

for (const src of allDocsSources()) {
CUR = src;
if (!src.base) console.log(`  docs source: ${src.instance} — ${relative(repoRootFor(INSTANCE_ROOT), src.srcDir)}`);
const slugs = readdirSync(src.srcDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
// A FIRST render of a source above the base: its translated pages name source
// pages that do not exist yet, and the translation index refuses a
// translation of nothing. Each missing page is first laid down as a stub that
// carries only its title, so the index can see what this run is about to
// write; the real page replaces it below. Never under `--check`, where a
// missing page is stale and is reported as such.
if (!src.base && !check) {
  for (const slug of slugs) {
    const manifest = manifestPath(join(src.srcDir, slug), slug);
    if (!existsSync(manifest)) continue;
    const page = (await loadManifestValue(manifest)) as WebPage;
    const outPath = join(src.outDir, `${page.slug}.md`);
    if (existsSync(outPath)) continue;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `---\ntitle: ${JSON.stringify(page.title)}\n---\n`);
  }
}
for (const slug of slugs) {
  const manifest = manifestPath(join(src.srcDir, slug), slug);
  if (!existsSync(manifest)) {
    console.error(`  ! ${slug}/ has no ${slug}.ts or ${slug}.json manifest — skipped`);
    continue;
  }
  const page = (await loadManifestValue(manifest)) as WebPage;
  // A slug may carry a path (`guides/writing-a-paper`) because the published
  // site has a `guides/` subdirectory. The content DIRECTORY flattens it, so
  // one level of `docs/source/` holds every page and there is no second
  // nesting rule to remember.
  if (page.slug.replace(/\//g, "-") !== slug) {
    throw new Error(`${manifest} declares slug "${page.slug}" but lives in ${slug}/`);
  }
  // Qualified by layer above the base, so the same slug in two sources is
  // two pages (`docsSources` has already warned, naming both files).
  const pageKey = qualifiedKey(src, page.slug);
  pageRoute.set(pageKey, src.base ? publishedPagePath(OUT_DIR, page.slug) : `${src.instance}/${publishedPagePath(src.outDir, page.slug)}`);
  // Collected BEFORE rendering, so a page that fails to render still cannot
  // leave a half-filled index behind it.
  //
  // A DUPLICATE LABEL THROWS, naming both sites. The label is page-qualified
  // precisely so it is unique — `what-is-not-built-yet` is a node on two pages
  // — so two blocks claiming one label means the qualification has failed, and
  // a map that silently kept the last writer would attach every note with that
  // label to whichever page happened to be walked second.
  for (const node of page.nodes) {
    const label = blockLabel(page, node);
    if (label === undefined) continue;
    const prev = blockByLabel.get(label);
    const at = { page: pageKey, node: node.id };
    if (prev !== undefined && labelSource.get(label) === src) {
      throw new Error(
        `two blocks declare the label "${label}": ${prev.page}/${prev.node} and ` +
          `${page.slug}/${node.id}. A label is page-qualified so that it is unique; ` +
          `a note pointing at this one could not say which block it meant.`,
      );
    }
    // A source above the base ALSO answers to its instance-qualified label,
    // which no other source can hold.
    if (!src.base) blockByLabel.set(qualifiedKey(src, label), at);
    if (prev !== undefined) {
      // Another SOURCE holds this label: the same section in two layers, most
      // likely a move in flight (owner, 2026-10-23: warn, never fail). The
      // plain label stays with the source that declared it first — the lower
      // layer, so what the base publishes does not change — until that copy
      // is removed; this one is reached by its qualified label.
      // Said once for the whole page when the PAGE is in both sources.
      if (prev.page !== qualifiedKey(labelSource.get(label)!, page.slug)) console.warn(
        `⚠ block label "${label}" is declared in ${labelSource.get(label)!.instance} (${labelFile.get(label)}) ` +
          `and in ${src.instance} (${blockFileOf(src, slug, node.id)}). The plain label stays with ${labelSource.get(label)!.instance}; ` +
          `this one is "${qualifiedKey(src, label)}". If this is a move in flight, finish it by removing the lower copy.`,
      );
      continue;
    }
    blockByLabel.set(label, at);
    labelSource.set(label, src);
    labelFile.set(label, blockFileOf(src, slug, node.id));
  }
  const outPath = join(src.outDir, `${page.slug}.md`);
  mkdirSync(dirname(outPath), { recursive: true });
  // `renderPage` fills `qaIndex` as a side effect of emitting the badges, so
  // the reset has to happen before it and the write after it.
  qaIndex = {};
  qaUnswept = [];
  const body = renderPage(page);
  emit(outPath, body);
  provenancePages.set(
    pageKey,
    page.nodes.map((n) => join(src.srcDir, slug, `${n.id}.md`)),
  );
  // The page's verdict index: what every badge on it needs to paint itself,
  // in ONE request. Written even when empty, because a page with badges and a
  // missing index is indistinguishable in the browser from a network failure,
  // and `{}` is a determined-empty answer rather than an unreadable one. With
  // the corpus absent it is still written, saying `corpus: "absent"`, so the
  // badges read "not available in this build" rather than "could not load".
  if (/data-qa-index=/.test(body)) {
    const idxAbs = join(qaAssetDirOf(src), slug, QA_INDEX_FILE);
    emitWitness(idxAbs, qaIndexDoc(page.slug, corpusOf(src).present, qaIndex, qaUnswept));
  }
  console.log(`  ${check ? "·" : "✓"} ${slug}.md (${page.nodes.length} nodes)`);
}
}
// Everything below is the BASE layer's: its todos, beans, zoom and QA graph.
CUR = allDocsSources()[0]!;

/**
 * Resolve a todo's knowledge-graph edges to things a reader can follow.
 *
 * Composed at BUILD time, like `editHref` and for the same reason: the client
 * would otherwise need the repo's web URL and the bean store's layout, and
 * both are this layer's business rather than shared client code's.
 *
 * **A reference that cannot be resolved is still rendered, without a link.**
 * `folio-assistant-29ij` names a bean whether or not a file for it is on disk,
 * and dropping it would make a dangling edge look like no edge at all — the
 * distinction `resolveTodoTags` already reports as `dangling` against
 * `not-checked`. A chip with no href says "this points somewhere I could not
 * reach", which is a third state and not a failure.
 */
function todoRelations(tags: {
  roles: string[];
  processes: string[];
  tasks: Array<{ process: string; task: string }>;
  identities: Array<{ provider: string; id: string; displayName?: string }>;
  references: Array<{ kind: string; id: string }>;
  artefacts: Array<{ kind: string; id: string; repo?: string; provider?: string }>;
}): Array<{ axis: string; label: string; href?: string }> {
  const out: Array<{ axis: string; label: string; href?: string }> = [];

  for (const r of tags.roles) out.push({ axis: "role", label: r });
  for (const p of tags.processes) out.push({ axis: "process", label: p });
  for (const t of tags.tasks) out.push({ axis: "task", label: `${t.process}▸${t.task}` });

  for (const i of tags.identities) {
    // Provider-qualified, because `litlfred` is not an identity and
    // `github:litlfred` is. Only GitHub resolves to a profile; another
    // provider's handle is shown as written rather than linked to a guess.
    const label = i.displayName ?? `${i.provider}:${i.id}`;
    out.push(
      i.provider === "github"
        ? { axis: "who", label, href: `https://github.com/${i.id}` }
        : { axis: "who", label },
    );
  }

  for (const r of tags.references) {
    if (r.kind === "bean") {
      const file = beanFile(r.id);
      out.push(file ? { axis: "bean", label: r.id, href: branchKeptHref(branchKeptLocation(repoRootFor(INSTANCE_ROOT), file, REPO_WEB)) }
                    : { axis: "bean", label: r.id });
      continue;
    }
    out.push({ axis: r.kind, label: r.id });
  }

  for (const a of tags.artefacts) {
    // An absent `repo` means THIS repository -- the schema says so, because
    // requiring it would make every local reference verbose enough that people
    // go back to writing prose.
    const base = a.repo ? `https://github.com/${a.repo}` : REPO_WEB;
    if (a.kind === "pull-request") out.push({ axis: "PR", label: `#${a.id}`, href: `${base}/pull/${a.id}` });
    else if (a.kind === "issue") out.push({ axis: "issue", label: `#${a.id}`, href: `${base}/issues/${a.id}` });
    else if (a.kind === "commit") out.push({ axis: "commit", label: a.id.slice(0, 9), href: `${base}/commit/${a.id}` });
    else out.push({ axis: a.kind, label: a.id });
  }

  return out;
}

/**
 * Why the branch-kept graph `id` is DETERMINED absent from this checkout, or
 * `undefined` when it is not (cat-harness-tools#1701). `state:mount` records
 * that answer for a graph declared for every checkout by a mounted instance,
 * not by this root, and not on this remote (an IG repository that is its own
 * index). Only that answer is excused: any other refusal still throws where
 * the graph is read.
 */
function determinedAbsent(id: string): string | undefined {
  const where = graphReadPath(id, repoRootFor(INSTANCE_ROOT));
  return where.state === "refused" && where.absent === true ? where.reason : undefined;
}

/**
 * The bean's file, or `undefined` when nothing on disk carries that id.
 *
 * The directory is RESOLVED from `beans/beans.json` rather than composed. It
 * was `join(repoRootFor(INSTANCE_ROOT), "beans", "defs")` until 2026-09-20 — a
 * second answer to a question the graph already answers, which would have gone
 * on resolving to nothing the moment the store moved, and reported every bean
 * reference as unlinkable while looking correct.
 */
function beanFile(id: string): string | undefined {
  if (determinedAbsent("beans") !== undefined) return undefined;
  const dir = beanDefsDir(repoRootFor(INSTANCE_ROOT));
  if (dir === null || !existsSync(dir)) return undefined;
  // Sorted for the same reason `processHierarchy` sorts: raw directory order
  // is filesystem state, and `find` over it makes the FIRST match a property of
  // where the file landed on disk. Two beans sharing a prefix would resolve to
  // different files on two machines.
  const hit = readdirSync(dir).sort().find((f) => f.startsWith(`${id}--`) || f === `${id}.md`);
  return hit ? relative(repoRootFor(INSTANCE_ROOT), join(dir, hit)) : undefined;
}

/**
 * The BPMN call hierarchy — which process calls which as a subprocess.
 *
 * Published so the board can STACK todos the way the owner asked: "stacking
 * should follow hierarchy of business subprocesses". A todo tagged
 * `Process_Publication` sits under `Process_Lifecycle`, because that is what
 * the diagrams say.
 *
 * Read by regex rather than through `loadProcessModel`, deliberately: that
 * loader is async and pulls in `bpmn-moddle` for a page generator that
 * otherwise touches no XML, and the two facts wanted here — a process's id and
 * its `calledElement` refs — are attributes, not structure. The risk of a
 * regex over XML is that it silently reads NOTHING and the hierarchy comes out
 * flat, so `scripts/tests/todos.test.ts` pins the real edges: a parse that
 * stops working fails the build rather than quietly flattening the board.
 */
function processHierarchy(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const globalTasks = new Set<string>();
  // SORTED, and it is load-bearing rather than tidy — `workflowFiles` sorts,
  // and that guarantee is why this reads it rather than a directory.
  // `readdirSync` under Bun returns RAW DIRECTORY ORDER: on ext4 that is a
  // hash of the filename against the directory's own seed, so two checkouts
  // of the same commit enumerate these 32 files differently. The ids below
  // become object keys and `JSON.stringify` preserves insertion order, so the
  // published index came out byte-different on every machine.
  //
  // Nobody noticed for the reason bean `d2kp` is about: the `--check` that
  // would have caught it was a folded YAML continuation line and had never
  // run. It failed on its FIRST run, on the PR that un-folded it, against a
  // committed file that reproduced perfectly on the machine that wrote it.
  // An artefact that is only reproducible where it was generated is not a
  // generated artefact; it is a snapshot.
  for (const f of workflowFiles(INSTANCE_ROOT, corpusScopeFor(INSTANCE_ROOT))) {
    if (!f.endsWith(".bpmn")) continue;
    const xml = readFileSync(f, "utf-8");
    // PREFIX-AGNOSTIC, and that is a live fix rather than defensiveness.
    // `translation-workflow.bpmn` binds the BPMN MODEL namespace as its
    // DEFAULT (`xmlns="…/MODEL"`) and writes `<process id="Process_Trans-
    // lation">`, which is valid BPMN. A `/<bpmn:process id="…"/` matched
    // nothing there, so that process was absent from the published hierarchy
    // altogether — a todo tagged `Process_Translation` would have read as
    // naming a process no diagram declares.
    //
    // `\bid=` rather than a fixed position, because attribute order is the
    // author's choice: this file writes `id` first and `isExecutable` last,
    // another may not.
    // A layer's global tasks (owner, 2026-10-20, "a1"): a call to one is a
    // shared STEP, not a sub-process, so it is no edge of this hierarchy.
    for (const g of xml.matchAll(GLOBAL_TASK_ELEMENT)) globalTasks.add(g[1]!);
    const id = /<(?:\w+:)?process\b[^>]*\bid="([^"]+)"/.exec(xml)?.[1];
    if (!id) continue;
    const calls = new Set<string>();
    // Scoped to `<bpmn:callActivity …>` OPENING TAGS, not to the whole file.
    // A bare `/calledElement="([^"]+)"/g` over the XML reads PROSE as
    // structure, and that was live: `upstream-version-adoption.bpmn` documents
    // itself with *"Callers invoke it with `calledElement="Process_Upstream-
    // Adoption"`"*, so the published hierarchy carried
    // `Process_UpstreamAdoption → itself` — an edge `loadProcessModel` REFUSES
    // outright ("A process cannot contain itself", process-model.ts), because
    // an interpreter entering A → A settles forever.
    //
    // The comment above worries about this regex matching NOTHING and the
    // board coming out flat. Matching TOO MUCH is the same class reversed and
    // is worse: a flat board is visibly empty, whereas a phantom edge renders
    // as a real one and stacks a process under itself. Documentation that
    // names an id is the normal way to describe a reusable subprocess, so this
    // was not a typo waiting to be found — the pattern invited it.
    //
    // Attribute order is not assumed: the tag is matched first, then the
    // attribute within it.
    for (const tag of xml.matchAll(/<(?:\w+:)?callActivity\b[^>]*>/g)) {
      const ref = /calledElement="([^"]+)"/.exec(tag[0]!)?.[1];
      if (ref) calls.add(ref);
    }
    out[id] = [...calls].sort();
  }
  for (const id of Object.keys(out)) out[id] = out[id]!.filter((c) => !globalTasks.has(c));
  return out;
}

// The todo board's data. Published here rather than by a separate script
// because it is the same job `qaIcons` already does for verdicts: take
// something the repo holds as files and make it fetchable by a static page.
//
// `editHref` is composed HERE, at build time, for the reason `.fa-node-edit`
// is: the client would otherwise need the repo's web URL, and a literal in
// `docs-ui.js` is a folio's own address inside shared client code.
{
  // THE THEME, resolved HERE rather than in the client or at parse time.
  //
  // Bean `5y4b`, the owner: "todos need grump cat themeing based on content
  // too. used jugement". Three things follow, and this line is where the first
  // two meet:
  //
  //  - the theme is DATA on the todo, never a keyword match on the summary in
  //    `docs-ui.js` — a rule nobody can see, review or override, which changes
  //    silently when somebody rewords a todo;
  //  - the DEFAULT is the graph's (`todos.json`), so a folio chooses its own
  //    and a literal here is not this repository's answer imposed downstream;
  //  - the todo's OWN value is preserved unresolved upstream of this, so
  //    "the author chose grumpy-cat" and "nobody chose" stay distinguishable
  //    to a reviewer reading the file.
  /** `{ target }` when the label resolves, `{}` when it does not — see the spread below. */
  const targetOf = (label: string | undefined) => {
    const target = resolveTarget(blockByLabel, label);
    return target === undefined ? {} : { target };
  };
  // THE TODO GRAPH MAY BE DETERMINED ABSENT (cat-harness-tools#1701): declared
  // for every checkout by a mounted instance, not by this root, and not on
  // this remote (an IG repository that is its own index). Then there are no
  // todos to publish, which is said, not thrown on; any other refusal still
  // throws from the todo root, exactly as before.
  const todosAbsentWhy = determinedAbsent("todos");
  const todosAbsent = todosAbsentWhy !== undefined;
  if (todosAbsent) console.log(`  · todos: not applicable here — ${todosAbsentWhy}; the board is published empty`);
  const fallbackTheme = todosAbsent ? undefined : todoDefaultTheme();
  const items = (todosAbsent ? [] : publishedTodoFiles()).map(({ todo, path }) => ({
    id: todo.id,
    summary: todo.summary,
    comment: todo.comment,
    status: todo.status,
    priority: todo.priority,
    origin: todo.origin,
    createdAt: todo.createdAt,
    targetLabel: todo.targetLabel,
    // THE SAME ATTACHMENT, IN PARTS — R3 of issue #602, bean `f76l`.
    //
    // `targetLabel` is page-qualified (`sec:<page>-<node>`), which is correct
    // and is also a burden: a consumer asking "which page is this on" has to
    // know the prefix, know the separator, and know that node ids themselves
    // contain `-` — so the split is not even unambiguous without the page
    // list. `targetLabel` STAYS, so nothing that matches on it breaks.
    //
    // Spread, so a label that resolves to NO block emits an absent key rather
    // than `null` or a guess. That is the third state and it is already how
    // this repository treats a dangling label: `mountPageStickies` reports it
    // instead of dropping the note.
    ...targetOf(todo.targetLabel),
    theme: todo.theme ?? fallbackTheme,
    tags: todo.tags,
    // The edges, already resolved. A sticky that showed only status and
    // priority would waste a six-axis relationship model on two enums.
    relations: todoRelations(todo.tags),
    // VIEW *AND* EDIT, both resolved through the same seam the landing
    // stickies use, and both ABSENT when there is no github.com `origin`.
    //
    // Bean `pb04`, the owner: *"rendeding shows edit src icon (and also need
    // view icon) if github tools avaialable in rendering pipeline"*. Three
    // things were wrong here and each is a different failure:
    //
    //  - only EDIT existed. `/blob/` is reading and `/edit/` opens the editor:
    //    a reader checking what a card says should not land in a text box, and
    //    one who wants to fix it should not have to find the button;
    //  - the address was a LITERAL (`EDIT_BASE`), so a fork or a rename
    //    published links to this repository — and the comment beside it
    //    already argued that a folio's own address does not belong in shared
    //    code, then wrote one down one layer up;
    //  - there was NO CAPABILITY GATE, so the icon appeared whether or not the
    //    pipeline had a forge behind it. A dead edit link is worse than no
    //    link: it invites a click, and on a private repository it 404s for
    //    exactly the reader who cannot edit, which reads as "this page is
    //    broken" rather than "you cannot do this".
    //
    // Spread, so an absent link is an ABSENT KEY rather than `null` — a
    // consumer testing truthiness and one testing presence should agree.
    // The BRANCH the todo is on, not `main`: todos are kept on
    // `cat/cat-harness/todos` since the state cutover, and a `main` link 404s.
    ...((() => {
      if (REPO_URL === undefined) return {};
      const at = branchKeptLocation(repoRootFor(INSTANCE_ROOT), repoRelative(path), REPO_URL);
      return sourceLinks(at.web, at.path, at.ref) ?? {};
    })()),
  }));
  mkdirSync(dirname(TODO_ASSET), { recursive: true });
  const processes = processHierarchy();
  // INDENTED, and it is about merging rather than about reading.
  //
  // Minified, this file is ONE LINE of ~12 KB. Git merges text by line, so a
  // single line means any change on both sides of a merge is a whole-file
  // conflict — two branches adding two different todos cannot both win. That
  // is not hypothetical: it conflicted on three consecutive merges of one
  // branch on 2026-09-20, every time, while `repo-partition.ts`,
  // `package-manifest.json` and `AGENTS.md` all auto-merged cleanly despite
  // being edited on both sides.
  //
  // Indented, each todo occupies its own lines, so two branches whose new
  // todos land in DIFFERENT parts of the sorted list merge untouched.
  //
  // **It is a partial fix, and the limit is worth knowing**: two todos that
  // sort ADJACENT still conflict, because the inserted lines overlap. Measured
  // on a scratch repository rather than reasoned about — five base items, one
  // branch inserting at the front and one at the back:
  //
  //   minified   CONFLICT
  //   indented   clean, both todos present, 7 items
  //
  // and with both branches appending at the same position, BOTH formats
  // conflict. So this removes the guaranteed conflict, not every conflict.
  //
  // It works at all only because the order is already deterministic —
  // `readTodoFiles` sorts, `processHierarchy` reads the sorted
  // `workflowFiles` — which the comment above that function had to establish
  // for a different reason: an artefact reproducible only where it was
  // generated is a snapshot, not a generated file. A mergeable one needs the
  // same guarantee, or every regeneration reshuffles and conflicts anyway.
  //
  // The cost is 11,963 -> 14,144 bytes on a static asset gzip mostly removes.
  // `docs-ui.js` calls `JSON.parse`; it never sees the whitespace.
  // THE ART, per theme, published beside the items rather than on each of them.
  //
  // One entry per theme actually used, not per todo: fifty todos sharing a
  // theme would otherwise carry fifty copies of the same three paths. The
  // client joins on the theme id it already has.
  //
  // `resolveThemeBackdrop` is what decides, so this cannot ship a partial set:
  // it returns art or NOTHING, never some layouts, because a phone handed the
  // laptop crop shows the art's quiet area in the wrong place and nothing
  // reports it. A theme with no backdrop — `pale-sage`, the high-contrast pair
  // — is simply absent here, and the client renders a flat themed card, which
  // is correct rather than degraded.
  //
  // THE SCRIM IS NOT HERE, deliberately: `themes.css` already emits
  // `--fa-sticky-scrim` per theme, so a copy in this file would be a second
  // answer free to disagree with the stylesheet that actually paints it. The
  // contrast guarantee — AAA over pure black — is a property of that value and
  // travels with it.
  const declaration = readDeclaration(INSTANCE_ROOT);
  const themeArt: Record<string, Record<string, string>> = {};
  for (const id of new Set(items.map((i) => i.theme).filter((t): t is string => t !== undefined))) {
    const theme = themeById(id);
    if (theme === undefined) {
      // A todo naming a theme nothing declares is a FINDING, not a silent flat
      // card: the author asked for something and got nothing, and the failure
      // is invisible on the page.
      throw new Error(
        `a todo declares theme "${id}", which no theme in schemas/ui/themes.ts defines. ` +
          `Declared themes: ${THEMES.map((t) => t.id).join(", ")}`,
      );
    }
    const art = resolveThemeBackdrop(theme, declaration?.images);
    if (art.art.size === 0) continue;
    // PUBLISHED paths, not declared ones: the client fetches this file from the
    // site, where the site directory's contents sit at the root. A declared
    // `docs/assets/...` would 404 for every reader and look like missing art.
    themeArt[id] = Object.fromEntries(
      [...art.art].map(([layout, img]) => [layout, publishedAssetPath(INSTANCE_ROOT, img.src)]),
    );
  }

  emit(
    TODO_ASSET,
    JSON.stringify(
      {
        $schema: "folio-todo-index/v1",
        // The tile's headline number, declared here because only this
        // generator knows WHICH of the projection's arrays is the one — see
        // `schemas/ui/tile-count.ts`. `items`, not `processes`: a process is a
        // lane the board draws, not a todo somebody owes.
        ...tileCounts({ todos: [items.length, "todos"] }),
        repoWeb: REPO_WEB,
        items,
        processes,
        themeArt,
      },
      null,
      2,
    ) + "\n",
    "data",
  );

  // THE FLOOR, from the same `items`. `relative_url` is a Liquid filter and
  // is the one thing this fragment cannot compute for itself: `baseurl` is
  // Jekyll's, and a root-relative href would 404 for every reader of a site
  // published under a path. Everything else about the fragment — the field
  // set, the order, the escaping, the elements — is `renderTodoListing`'s, so
  // the e2e that serves it with JavaScript disabled measures the same markup
  // this writes.
  mkdirSync(dirname(TODO_LISTING_INCLUDE), { recursive: true });
  emit(
    TODO_LISTING_INCLUDE,
    GENERATED_INCLUDE_BANNER +
      renderTodoListing(items, {
        // SINGLE quotes inside the Liquid, because the result is interpolated
        // into a double-quoted `href` attribute. Double quotes here produced
        // `href="{{ "/x.html" | ... }}"`, which terminates the attribute at
        // the second character of the Liquid tag — valid Liquid, broken HTML,
        // and it renders as a link to the empty string.
        pageHref: (page, node) => `{{ '/${publishedAt(page)}' | relative_url }}#${node}`,
        // Each todo's own page (#1908) — a directory, so the href ends in `/`.
        todoPageHref: (id) => `{{ '/${todoPageSitePath(id)}' | relative_url }}`,
      }),
    "data",
  );

  // EACH PAGE'S OWN LISTING (bean `lwjc`), from the same `items`, through the
  // same renderer, with the same hrefs: only the set of notes and the scope
  // differ. Its count is the page's own cardinality, never the folio's.
  {
    const listingOpts = {
      pageHref: (page: string, node: string) => `{{ '/${publishedAt(page)}' | relative_url }}#${node}`,
      todoPageHref: (id: string) => `{{ '/${todoPageSitePath(id)}' | relative_url }}`,
    };
    const { pages, unplaced } = groupTodosByPage(items);
    const written = new Set<string>();
    // `unplaced` is a COUNT of notes whose label no page carries. They are on
    // the todos board's whole listing, and on no page's: "could not determine"
    // is recorded here rather than shown as a page with nothing on it.
    const index: { pages: Record<string, string>; unplaced: number } = { pages: {}, unplaced: unplaced.length };
    mkdirSync(TODO_LISTING_PAGES_DIR, { recursive: true });
    for (const [page, pageItems] of [...pages].sort(([a], [b]) => a.localeCompare(b))) {
      const file = todoListingFileFor(page);
      written.add(file);
      index.pages[page] = `generated/todo-listing/${file}`;
      emit(
        join(TODO_LISTING_PAGES_DIR, file),
        GENERATED_INCLUDE_BANNER + renderTodoListing(pageItems, { ...listingOpts, scope: "page" }),
        "data",
      );
    }
    // A page that lost its last note loses its fragment too: a leftover file
    // would still be listed nowhere, but it would be a stale artefact in a
    // directory this generator owns.
    for (const f of readdirSync(TODO_LISTING_PAGES_DIR)) {
      if (!f.endsWith(".html") || written.has(f)) continue;
      if (check) {
        console.error(`  ✗ _includes/generated/todo-listing/${f} is stale: no note is attached to that page any more`);
        stale++;
      } else unlinkSync(join(TODO_LISTING_PAGES_DIR, f));
    }
    mkdirSync(dirname(TODO_LISTING_INDEX), { recursive: true });
    emit(TODO_LISTING_INDEX, JSON.stringify(index, null, 2) + "\n", "data");
    console.log(
      `  ${check ? "·" : "✓"} _includes/generated/todo-listing/ ` +
        `(${pages.size} page(s) with notes, ${unplaced.length} unplaced)`,
    );
  }

  // THE PROVENANCE FOOTER (owner, 2026-11-05, "2B"). The generated pages
  // were collected in the loop above. An AUTHORED page is any `.md` under the
  // site directory with a `.prov.jsonld` beside it, outside `docs/source/`
  // (those are blocks of generated pages) and outside `assets/` (PROV traces
  // of another shape). Both go into one slice of site data.
  {
    const srcRel = relative(OUT_DIR, SRC_DIR).split(sep).join("/");
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, e.name);
        const rel = relative(OUT_DIR, abs).split(sep).join("/");
        if (e.isDirectory()) {
          if (e.name.startsWith("_") || e.name.startsWith(".") || rel === "assets" || rel === srcRel) continue;
          walk(abs);
        } else if (e.name.endsWith(".md") && existsSync(provenanceLogFor(abs))) {
          const key = rel.replace(/\.md$/, "");
          if (!provenancePages.has(key)) provenancePages.set(key, [abs]);
        }
      }
    };
    walk(OUT_DIR);
    const result = writeProvenanceListing({
      siteDir: OUT_DIR,
      producer: "docs-pages",
      pages: provenancePages,
      check,
      emit: (path, content) => emit(path, content, "data"),
      banner: GENERATED_INCLUDE_BANNER,
    });
    for (const f of result.stale) {
      if (check) {
        console.error(`  ✗ _includes/generated/provenance/docs-pages/${f} is stale: that page has no provenance log any more`);
        stale++;
      }
    }
    console.log(
      `  ${check ? "·" : "✓"} _includes/generated/provenance/docs-pages/ ` +
        `(${result.pages} page(s), ${result.entries} provenance entries)`,
    );
  }

  // THE GRAPH AND A PAGE PER TODO — issue #1908. From the SAME `items`, so the
  // JSON index the board reads, the no-JS floor and the JSON-LD cannot
  // disagree about what a todo says or what it is attached to.
  //
  //   todos.jsonld (+ .json)        the whole graph, one named graph
  //   todos/<id>.jsonld (+ .json)   one todo, at the address its @id names
  //   todos/<id>/index.html         its RENDERING — a thin page, not the asset
  {
    // The container is the DECLARED `todos` Subgraph node — the one the KG
    // export publishes in the declaring layer's document — never a
    // collection minted here (bean `l4ay`, `subgraph-node.ts`).
    const declared = declaredSubgraphNode(INSTANCE_ROOT, "todos");
    if (declared === undefined) {
      console.warn("gen-docs-pages: no instance in this checkout declares a `todos` subgraph — todos.jsonld is published without its container node");
    }
    const subgraph = declared && { iri: declared.iri, contentSource: declared.contentSource };
    // A target on a page of a source above the base is published under that
    // layer (`gen-site-jsonld.ts`), so its IRI is resolved, not spelled.
    const targetIri = (page: string, node: string): string => `${DOCS_SITE_BASE}${siteNodeOf(allDocsSources(), page, node).sitePath}`;
    const graph = serialiseJsonld(todoGraphDocument(items, subgraph, targetIri));
    for (const ext of [".jsonld", ".json"]) {
      emit(join(OUT_DIR, TODO_GRAPH_SITE_PATH.replace(/\.jsonld$/, ext)), graph, "data");
    }
    const wanted = new Set<string>();
    for (const item of items) {
      const doc = serialiseJsonld(todoDocument(item, subgraph, targetIri));
      const asset = join(OUT_DIR, todoSitePath(item.id));
      if (!check) mkdirSync(dirname(asset), { recursive: true });
      for (const ext of [".jsonld", ".json"]) {
        const p = asset.replace(/\.jsonld$/, ext);
        wanted.add(p);
        emit(p, doc, "data");
      }
      const pageDir = join(OUT_DIR, todoPageSitePath(item.id));
      if (!check) mkdirSync(pageDir, { recursive: true });
      const page = join(pageDir, "index.html");
      wanted.add(page);
      emit(
        page,
        todoPageHtml(item, {
          // The block's RENDERING, from the todo page two levels down. A fact
          // about renderings, so it lives on the page and never on the todo.
          ...(item.target ? { targetHref: `../../${publishedAt(item.target.page)}#${item.target.node}` } : {}),
        }),
        "data",
      );
    }
    // A todo that is gone takes its files with it. Only OUR output is touched:
    // a `.jsonld`/`.json` beside the pages, or a directory whose `index.html`
    // declares itself a todo page. `todos/index.html` (the board page,
    // `state-visualizer.ts`) is neither and is never considered. The old
    // per-todo path `todos/<id>` (before issue #1830, now `todo/<id>`) is
    // swept too, its pages recognised by their old config block.
    for (const [dir, isPage] of [[TODO_SITE_DIR, isTodoPage], ["todos", isLegacyTodoPage]] as const) {
      const todoDir = join(OUT_DIR, dir);
      for (const e of existsSync(todoDir) ? readdirSync(todoDir, { withFileTypes: true }) : []) {
        const p = join(todoDir, e.name);
        const ours = e.isDirectory()
          ? existsSync(join(p, "index.html")) && isPage(readFileSync(join(p, "index.html"), "utf-8"))
          : /\.(jsonld|json)$/.test(e.name);
        const target = e.isDirectory() ? join(p, "index.html") : p;
        if (!ours || wanted.has(target)) continue;
        if (check) {
          console.error(`  ✗ ${target} is an orphan — no todo publishes it`);
          stale++;
        } else {
          rmSync(e.isDirectory() ? p : target, { recursive: true });
          console.log(`  - removed orphaned ${target}`);
        }
      }
    }
    // The generic renderer every todo page loads first (issue #1830).
    if (items.length > 0) emit(join(OUT_DIR, KG_RENDER_ASSET), kgRenderScript(), "data");
    console.log(
      `  ${check ? "·" : "✓"} todos.jsonld + ${items.length} todo(s) as JSON-LD, each with a page at ${TODO_SITE_DIR}/<id>/`,
    );
  }

  emit(TODO_COUNT_ASSET, JSON.stringify(tileCounts({ todos: [items.length, "todos"] }), null, 2) + "\n", "data");

  // THE THRESHOLDS, when this folio has declared any. `readSemanticZoom`
  // returns `undefined` for a folio that has not, and that absence is carried
  // through rather than filled in: nothing is written, and the board reports
  // it could not determine one.
  const zoom = readSemanticZoom(INSTANCE_ROOT);
  if (zoom !== undefined) {
    mkdirSync(dirname(ZOOM_ASSET), { recursive: true });
    emit(ZOOM_ASSET, JSON.stringify(zoom, null, 2) + "\n", "data");
  }
  console.log(
    `  ${check ? "·" : "✓"} assets/${SEMANTIC_ZOOM_FILE} ` +
      (zoom === undefined
        ? "(not declared by this folio — nothing published, and the board says so)"
        : `(default ${zoom.belowPx}px, ${Object.keys(zoom.byKind).length} kind override(s))`),
  );
  const themed = items.filter((i) => i.theme !== undefined).length;
  console.log(
    `  ${check ? "·" : "✓"} assets/todos/index.json (${items.length} todo(s), ` +
      `${themed} themed, ${Object.keys(themeArt).length} theme(s) with art)` +
      `\n  ${check ? "·" : "✓"} _includes/generated/todo-listing.html ` +
      `(${items.length} todo(s), served without JavaScript)`,
  );
}

// The bean board's data. Sibling of the todo block above, and deliberately the
// same shape: one indented JSON file, emitted through the same `--check`
// contract, with `editHref` composed HERE for the same reason — the client
// would otherwise need the repository's web address, and a literal in
// `docs-ui.js` is one folio's own address inside shared client code.
{
  // Determined absent (cat-harness-tools#1701): "no bean store" here, the
  // `null` below, said with its reason rather than thrown on.
  const beansAbsentWhy = determinedAbsent("beans");
  if (beansAbsentWhy !== undefined) console.log(`  · beans: not applicable here — ${beansAbsentWhy}`);
  const beansRead = beansAbsentWhy !== undefined ? null : readBeans(repoRootFor(INSTANCE_ROOT));
  // WHERE THE FILES ARE ON THE FORGE. Since the state cutover the bean store
  // is kept on its own branch (`cat/cat-harness/beans`) and untracked on
  // `main`, so `<repo>/blob/main/<file>` answers 404 for every bean. Each
  // `file` is rewritten to its path ON THE BRANCH that keeps it, and the
  // branch travels once as `fileRef` (with `fileWeb`, the repository that
  // holds it) — never re-derived in the client. See `branch-kept-href.ts`.
  const beanForge = beansRead?.[0] ? branchKeptLocation(repoRootFor(INSTANCE_ROOT), beansRead[0].file, REPO_WEB) : undefined;
  const beans = beansRead === null ? null : beansRead.map((b) => {
    const at = branchKeptLocation(repoRootFor(INSTANCE_ROOT), b.file, REPO_WEB);
    if (beanForge && (at.ref !== beanForge.ref || at.web !== beanForge.web)) {
      throw new Error(`bean ${b.id} is kept at ${at.web}@${at.ref}, the store at ${beanForge.web}@${beanForge.ref}: one store, one branch`);
    }
    return { ...b, file: at.path };
  });
  // `null` is "no bean store", which is NOT the same as a store with nothing
  // in it, and rendering them alike is how a consumer reports a clean run over
  // a repository it never looked at. A folio with no work plan simply gets no
  // projection; the board reads the absent file as "no store" rather than as
  // an empty one.
  if (beans === null) {
    console.log(`  · assets/beans/index.json — no bean store`);
  } else {
    // ONE edge set over both declarations (bean `vhqq`): until then this read
    // `blocking:` only and published 7 of the store's 83 edges, because 60
    // beans declare the block from the blocked end with `blocked_by:`.
    const { edges, dangling } = blockEdges(beans);
    const blockers = blockedBy(beans);
    const blocks = blocksOf(beans);
    // WORK PLANS (work item folio-assistant-exrp, owner 2026-11-05: "Epic is
    // the plan"). An epic or milestone that names the process it runs, read
    // from its `process:` / `proposal:` tags, and the layers that name it
    // as their plan. Joined HERE, so the board renders a plan's process and
    // its runs without reading the layer store itself. A layer store
    // that cannot be read gives no runs, and the plan says so (`runs: null`)
    // rather than showing none.
    let instancesRead: ReturnType<typeof listInstances> | null;
    try {
      instancesRead = listInstances(repoRootFor(INSTANCE_ROOT));
    } catch {
      instancesRead = null;
    }
    const runsOf = (id: string) =>
      instancesRead === null
        ? null
        : instancesRead
            .filter((i) => i.plan === id)
            .map((i) => ({ id: i.id, processId: i.processId, status: i.status, at: i.tokens, updatedAt: i.updatedAt }));
    // The proposal's link, resolved HERE from the declarations: a proposal
    // path is checkout-relative (`cat-harness/docs/proposals/x.md`), and the
    // board's own `fileWeb` is the work-item store's repository, which does
    // not hold it. The declaring layer's repository does (as edit links).
    const proposalHref = (path: string): string => {
      const at = declaredEditLocation(path);
      return at.repo ? `https://github.com/${at.repo}/blob/main/${at.source}` : `${REPO_WEB}/blob/main/${path}`;
    };
    const planField = (id: string, tags: readonly string[] | undefined) => {
      const plan = workPlanOf(tags);
      if (plan === undefined) return {};
      return {
        plan: {
          ...plan,
          ...(plan.proposal !== undefined ? { proposalHref: proposalHref(plan.proposal) } : {}),
          runs: runsOf(id),
        },
      };
    };
    const items = beans.map((b) => ({
      id: b.id,
      title: b.title,
      status: b.status,
      type: b.type,
      priority: b.priority,
      parent: b.parent,
      // Present only on a work plan: what it runs, where it came from, and
      // the instances running under it. Absent is "not a plan", never "a
      // plan with nothing known".
      ...planField(b.id, b.tags),
      // Both directions, resolved once. A client given only `blocking` would
      // have to invert the whole set to answer "what is holding THIS bean up",
      // which is the question a board is actually asked. Both from the edge
      // set, so a block declared at EITHER end appears at both.
      blocking: blocks.get(b.id) ?? [],
      blockedBy: blockers.get(b.id) ?? [],
      createdAt: b.createdAt,
      // Published as a FACT, with no age computed from it. See `beanFindings`.
      updatedAt: b.updatedAt,
      preview: b.body.trim().slice(0, BEAN_BODY_PREVIEW),
      // Repo-relative, and the renderer derives BOTH a view and an edit URL
      // from it. Shipping two absolute URLs per bean would put the forge's URL
      // shape in the data 283 times over, and they would then have to agree.
      file: b.file,
    }));
    mkdirSync(dirname(BEANS_ASSET), { recursive: true });
    // Indented for the merge reason the todo index documents at length: a
    // minified projection is one line, git merges by line, and two branches
    // each adding a bean would conflict on the whole file every time. At 239
    // beans that argument is stronger here than it was there.
    emit(
      BEANS_ASSET,
      JSON.stringify(
        {
        $schema: "folio-bean-index/v1",
        // OPEN beans, the same number `count.json` gives the icon row and the
        // board's "open" (bean `v215`): it was `items.length`, every bean
        // ever filed, so the tile read 943 beside the icon row's 541. Not
        // `findings` either: a finding is a defect ABOUT the work plan, not
        // an item on it. See `schemas/ui/tile-count.ts` for why the number is
        // declared here rather than inferred by the reader.
        ...tileCounts({ beans: [openBeanCount(beans), OPEN_BEANS_UNIT] }),
        // The forge, so `work-plan.js` composes its links from DATA rather
        // than carrying one layer's address in shared client code. Same
        // reason `editHref` is composed here, one level further on.
        repoWeb: REPO_WEB,
        // The repository and branch every `file` below is a path on.
        fileWeb: beanForge?.web ?? REPO_WEB,
        fileRef: beanForge?.ref ?? SOURCE_BRANCH,
        items,
        // The edges themselves, `blocker → blocked`, with the key(s) that
        // declared each. A dangling edge stays here AND is a
        // `blocking-unknown` finding: reported, never dropped.
        edges,
        findings: beanFindings(beans),
        // A work plan filed under the wrong type, or a proposal with no
        // process: reported, never fatal (`schemas/sdlc/work-plan.ts`).
        planFindings: workPlanFindings(beans),
        // The milestone rollup, COMPUTED HERE so the board renders a number
        // it does not derive. The board already loads every bean's `parent`,
        // `type` and `status`, so it could compute the closure client-side —
        // and that is exactly what makes it worth not doing: a second
        // implementation of one definition is free to disagree with the
        // terminal report, which `milestone:status` prints from the SAME
        // function. One definition, one writer, and a renderer that renders.
        //
        // `orphanOpen` travels with it on purpose: the three shares describe
        // well under half the open work (241 of 390, 2026-10-03), and a board
        // showing three percentages without that denominator invites the
        // reading that they add up to the repository.
        plan: milestoneRollup(beans),
      },
        null,
        2,
      ) + "\n",
      // EXISTENCE-gated, not content-gated, and the asymmetry with the todo
      // index above is the whole point.
      //
      // `emit`'s own note says a `data` projection is gated on exact content
      // because it projects files a human authored, so a difference is
      // somebody who forgot to regenerate. That holds for three todos. It does
      // not hold for the bean store: EVERY agent session writes to `beans/`,
      // so the projection moves whenever anybody works — which nobody forgot
      // to do.
      //
      // Measured, 2026-09-20, and this is why the gating changed: this branch
      // carried 296 bean files while `main` carried 522, four hours apart.
      // CI tests the MERGE ref, so a content gate went red on a projection
      // that was fresh on the branch and fresh on main and stale only against
      // their union. Every open PR would have to regenerate on every merge, to
      // fix nothing a reader could see.
      //
      // That is exactly the shape bean `d2kp` exists to stop: "gating them
      // could only ever fire on a graph that changed". A missing file is still
      // an omission — the board would fetch a 404 forever — so existence is
      // gated and contents are not, and `docs-site.yml` regenerates before
      // publishing so what a reader fetches is current regardless.
      "verdict",
    );
    if (burndownHistory) {
      // Written directly, not through `emit`: it is never committed, so there
      // is nothing for `--check` to compare it with.
      const feed = burndownFeedFor(beans);
      writeFileSync(BEANS_BURNDOWN_ASSET, JSON.stringify(feed) + "\n");
      console.log(
        feed.available
          ? `  ✓ assets/beans/burndown.json (${feed.series.length} series over ${feed.days.length} day(s) of ${feed.branch})`
          : `  · assets/beans/burndown.json — no history: ${feed.reason}`,
      );
    }
    // Existence-gated for the same reason as the index: every session moves it.
    emit(BEANS_COUNT_ASSET, JSON.stringify(tileCounts({ beans: [openBeanCount(beans), OPEN_BEANS_UNIT] }), null, 2) + "\n", "verdict");
    const both = edges.filter((e) => e.declaredOn.length > 1).length;
    console.log(
      `  ${check ? "·" : "✓"} assets/beans/index.json (${items.length} bean(s), ${edges.length} block edge(s), ` +
        `${both} declared both ways, ${dangling.length} dangling)`,
    );
    for (const d of dangling) {
      console.log(`    · dangling: ${d.blocker} → ${d.blocked} (${d.missing.join(" and ")} not in the store)`);
    }
  }
}

/**
 * The `qa` graph, projected as one panel per family — bean `py74`, issue #635.
 *
 * `<base>/qa/` said *"declared and nothing publishes a projection for it yet"*
 * over the largest generated graph here. `state-visualizer.ts` flips a graph
 * from `declared` to `live` the moment `assets/<id>/index.json` exists, so
 * this file is the whole of what was missing — no generator, schema or route
 * change.
 *
 * **The directory comes from the DECLARATION, not from a literal.** `qa` is
 * declared once, at `test/results/`, and `directoryForGraph` throws rather
 * than picking silently if that ever stops being true — the `wggr` failure,
 * where resolving `cat-harness` to the first of several matches wrote 37
 * sidecars against the wrong subjects on a run that exited 0. The neighbouring
 * `QA_ASSET_DIR` above still composes its path by hand; it is not changed here
 * because it names a SUBDIRECTORY of the graph (`witnesses/`) that no
 * declaration distinguishes, which is a different question and another bean's.
 *
 * Existence-gated, like the bean index and for the same reason: every QA
 * sweep rewrites this graph, so the projection moves whenever anybody runs
 * one. A content gate would go red on a projection that is fresh on the branch
 * and fresh on main and stale only against their union — bean `d2kp`.
 */
/**
 * Publish a translation projection for every HAND-AUTHORED docs page that has
 * one, plus the index its badge paints from.
 *
 * ## Why this loop exists beside the generated-page loop above
 *
 * A generated page's translation verdicts live on its BLOCKS, and `pageQaIcons`
 * rolls those up. A hand-authored page has no blocks; `translation-block-qa.ts`
 * measures the page itself, one sidecar per locale. Those are the pages this
 * site actually has translations of — `docs/index.md` in all five target
 * locales — and nothing published their verdicts. Bean `pp93`.
 *
 * ## It emits from HERE rather than from its own script, and that is forced
 *
 * The orphan sweep immediately below deletes everything under `QA_ASSET_DIR`
 * that this run did not emit. A second writer into that tree would have its
 * files removed by the next `gen-docs-pages` run — silently, since a projection
 * nobody links to is a projection nobody notices is gone. One writer, one
 * prune.
 *
 * ## The page slug is the page's PATH, not its basename
 *
 * `docs/index.md` and `docs/cat-harness/index.md` are different pages with the
 * same stem. `assets/qa/<slug>/` keyed on the basename would give them one
 * directory and one of the two would overwrite the other — the same collision
 * the PO resolution in `translation-block-qa.ts` just had to be taught to
 * refuse, one layer down.
 *
 * That pair went away on 2026-09-21 (bean `8h42`, and the generated page that
 * took the route is `published-graphs.md`, not a second `index.md`). The rule
 * stays: it is about stems, not about those two files, and the next pair to
 * share one will not announce itself.
 */
function publishAuthoredPageTranslationQa(): void {
  const siteDir = OUT_DIR;
  const withQa: string[] = [];
  const walk = (abs: string): void => {
    for (const e of readdirSync(abs, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const p = join(abs, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith("_") || e.name.startsWith(".")) continue;
        if (e.name === "assets" || e.name === "vendor") continue;
        walk(p);
        continue;
      }
      if (!e.isFile() || !e.name.endsWith(".md") || e.name.startsWith("_")) continue;
      const text = readFileSync(p, "utf-8");
      // Generated pages are already covered by their blocks' roll-up. Same
      // marker, same reason, as the sweep's own exclusion.
      if (text.includes("Generated by scripts/gen-docs-pages.ts")) continue;

      const doc = readWitnessDoc("translation", p, INSTANCE_ROOT);
      if (!doc) continue;

      const slug = relative(siteDir, p).replace(/\.md$/, "").replace(/\//g, "-");
      const key = `page.translation`;
      const abs2 = join(QA_ASSET_DIR, slug, `${key}.json`);
      emitWitness(abs2, JSON.stringify(withSidecarLinks(doc)) + "\n");

      emitWitness(
        join(QA_ASSET_DIR, slug, QA_INDEX_FILE),
        qaIndexDoc(slug, true, { [key]: { state: doc.state, counts: doc.counts } }, []),
      );
      withQa.push(slug);
    }
  };
  walk(siteDir);

  // WHICH pages have a projection — a JSON asset beside the projections,
  // fetched by `docs-ui.js` at load.
  //
  // Structure, not a verdict: the list says a projection EXISTS and never what
  // it found. It was a Jekyll data file, `_data/translation-qa-pages.json`,
  // that `head_custom.html` read at build time to decide whether to emit the
  // badge at all — which put a fact about the QA corpus into the COMMITTED
  // site: with `test/results/` absent it read `[]` and `--check` called it
  // stale (bean `4l4d`). It is a published asset now, generated wherever the
  // corpus is, and it says `corpus: "absent"` rather than `[]` when there is
  // none — an empty list would be "no page has a projection", which is a
  // different and false answer.
  //
  // One file rather than one per page, owner rule via PR #1886: page content
  // loads from a published asset the badge script fetches, never inlined.
  emitWitness(join(QA_ASSET_DIR, TRANSLATION_QA_PAGES_FILE), translationQaPagesDoc(QA_CORPUS.present, withQa));
}

publishAuthoredPageTranslationQa();

// A subject that loses its sidecar — or a page that loses a node — must lose its
// published projection too. Left behind, the file keeps serving verdicts for
// something that no longer exists, and nothing else would ever notice: the icon
// is gone, so nobody clicks it and nobody sees it is wrong.
//
// Bean 0kbt: This sweep MUST run BEFORE the qa projection below (and queues
// excluded paths for it), so a run that removes an orphan does not publish a count
// that includes the very file this run deleted.
//
// In a STORED tree (bean `4l4d`) an orphan under `--check` is a fetch of
// another commit's pages, not this checkout's defect: reported, not gated.
// The write path still removes it, so what the site build publishes is clean.
const orphanedQaAssets = new Set<string>();
// Every source's tree, each judged by its own storage — a layer above the
// base that loses a page must lose that page's projections too.
// Where each tree is WRITTEN: the sweep lists and removes only what this
// generator writes, never a mount's pinned bytes (bean `cat-tools-sm8r`, item 4).
const witnessTrees = [...new Set(allDocsSources().map((s) => writePathOf(qaAssetDirOf(s))))];
for (const orphan of witnessTrees.flatMap((d) => listQaAssets(d))) {
  if (emittedQa.has(orphan)) continue;
  orphanedQaAssets.add(orphan);
  if (check && qaStoredFor(orphan)) {
    console.log(`  · advisory: ${relative(INSTANCE_ROOT, orphan)} is orphaned in the stored working copy`);
  } else if (check) {
    console.error(`  ✗ ${orphan} is orphaned`);
    stale++;
  } else {
    unlinkSync(orphan);
    console.log(`  - removed orphaned ${orphan}`);
  }
}

/**
 * The `qa` graph, projected as one panel per family — bean `py74`, issue #635.
 *
 * `<base>/qa/` said *"declared and nothing publishes a projection for it yet"*
 * over the largest generated graph here. `state-visualizer.ts` flips a graph
 * from `declared` to `live` the moment `assets/<id>/index.json` exists, so
 * this file is the whole of what was missing — no generator, schema or route
 * change.
 *
 * **The directory comes from the DECLARATION, not from a literal.** `qa` is
 * declared once, at `test/results/`, and `directoryForGraph` throws rather
 * than picking silently if that ever stops being true — the `wggr` failure,
 * where resolving `cat-harness` to the first of several matches wrote 37
 * sidecars against the wrong subjects on a run that exited 0. The neighbouring
 * `QA_ASSET_DIR` above still composes its path by hand; it is not changed here
 * because it names a SUBDIRECTORY of the graph (`witnesses/`) that no
 * declaration distinguishes, which is a different question and another bean's.
 *
 * Existence-gated, like the bean index and for the same reason: every QA
 * sweep rewrites this graph, so the projection moves whenever anybody runs
 * one. A content gate would go red on a projection that is fresh on the branch
 * and fresh on main and stale only against their union — bean `d2kp`.
 */
{
  const qaDir = directoryForGraph(INSTANCE_ROOT, "qa");
  if (qaDir === undefined) {
    // Declared nowhere is a real answer and not this generator's to fix. Said
    // out loud rather than skipped silently, because a missing projection and
    // an undeclared graph look identical from the published site.
    console.log(`  · assets/qa/index.json — no directory declares the \`qa\` graph`);
  } else {
    const ix = projectQaGraph(qaDir, QA_CORPUS.present, undefined, { exclude: orphanedQaAssets });
    const out = join(OUT_DIR, "assets", "qa", "index.json");
    mkdirSync(dirname(out), { recursive: true });
    if (isQaGraphUnknown(ix)) {
      // C9: no count of what this build happened to write. The projection
      // says `unknown` with its reason and carries NO tile count, so the
      // navbar draws no number (`readTileCounts`' third state) instead of a
      // false one.
      emit(out, JSON.stringify(ix, null, 2) + "\n", "verdict");
      console.log(`  ? assets/qa/index.json — UNKNOWN: the derived QA corpus is not in this build; no count published`);
    } else {
      emit(
        out,
        // `ix.files`, not `ix.families.length`: a family is a schema the sweep
        // groups by, and 7 on the tile where 636 documents were swept would be
        // a number the reader cannot reconcile with the page it opens. The two
        // third states this block already prints — `unclassified`, `unreadable`
        // — stay in the console; the tile carries one number and its unit.
        JSON.stringify({ ...tileCounts({ qa: [ix.files, "documents"] }), ...ix }, null, 2) + "\n",
        "verdict",
      );
      const fams = ix.families.map((f) => `${f.schema} ${f.files}`).join(", ");
      console.log(
        `  ${check ? "·" : "✓"} assets/qa/index.json (${ix.files} document(s), ` +
          `${ix.families.length} famil${ix.families.length === 1 ? "y" : "ies"}: ${fams}` +
          // Both third states are printed EVERY run, including at zero. A count
          // that appears only when non-zero cannot be told from one nobody
          // measured.
          `; ${ix.unclassified} unclassified, ${ix.unreadable} unreadable)`,
      );
    }
  }
}

if (check && refreshed > 0) {
  // Printed, never gated. See `emit`: a verdict projection moves when the
  // corpus is re-swept or a block is edited, and the published copy is
  // regenerated by the site build regardless of what is committed here.
  console.log(
    `\n${refreshed} verdict projection(s) would be refreshed — not a staleness failure.\n` +
      `  They carry QA counts and freshness measured against the working tree, and the\n` +
      `  site build regenerates them. Run the generator to refresh the committed copies.`,
  );
}
if (check && storedAbsent > 0) {
  // The site build writes these from the corpus it fetched (`docs-site.yml`
  // runs `qa-site-assets.ts fetch` first). A checkout without a working copy
  // simply has not fetched one.
  console.log(
    `\n${storedAbsent} witness file(s) are not in this checkout — the witness tree is stored on ` +
      `\`qa-reports\` and generated at site build; not a staleness failure.`,
  );
}
if (check && stale > 0) {
  console.error(`\n${stale} generated file(s) stale or missing — run: bun run cat-harness-tools/scripts/gen-docs-pages.ts`);
  process.exit(1);
}
console.log(
  check
    ? "\ngenerated pages are up to date"
    : `\nWrote ${written} page(s) to ${OUT_DIR} and ${qaWritten} QA witness file(s) to ${QA_ASSET_DIR}`,
);
}

/**
 * The burn-down feed for the store `beans` came from: fetch its branch's
 * history, read one snapshot per day, one series per open milestone and epic.
 * A failure anywhere is `available: false` with the reason, never an empty feed.
 */
function burndownFeedFor(beans: ReadonlyArray<{ id: string; title: string; type: string; status: string }>): BurndownFeed {
  const root = repoRootFor(INSTANCE_ROOT);
  try {
    const dir = beanDefsDir(root);
    if (dir === null) return { $schema: BURNDOWN_SCHEMA, available: false, reason: "no bean store is declared" };
    const loc = branchKeptLocation(root, relative(root, dir).split(sep).join("/"), REPO_WEB);
    const got = fetchBeanHistory(root, { branch: loc.ref, web: loc.web, repoWeb: REPO_WEB, days: DEFAULT_BURNDOWN_DAYS });
    if ("reason" in got) return { $schema: BURNDOWN_SCHEMA, available: false, reason: got.reason };
    const snapshots = snapshotsFromGit(root, got.ref, loc.path, DEFAULT_BURNDOWN_DAYS);
    if (snapshots.length === 0) {
      return { $schema: BURNDOWN_SCHEMA, available: false, reason: `no commit to ${loc.path} on ${loc.ref} in the last ${DEFAULT_BURNDOWN_DAYS} days` };
    }
    return buildBurndownFeed(snapshots, burndownTargets(beans), { web: loc.web, branch: loc.ref, path: loc.path });
  } catch (e) {
    return { $schema: BURNDOWN_SCHEMA, available: false, reason: (e as Error).message };
  }
}
