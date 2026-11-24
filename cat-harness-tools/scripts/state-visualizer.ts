#!/usr/bin/env bun
/**
 * A dashboard per declared STATE graph, at the path this layer uses for it.
 *
 * @module scripts/state-visualizer
 * @covers none — it RENDERS every declared state graph rather than judging one; a stale
 *   dashboard is a currency finding about the render, not a verdict on the graph
 *
 * ## The route is a POLICY rather than this generator's choice
 *
 * ```
 * <base>/<graph>/          the visualiser for one declared state graph
 * <base>/assets/<graph>/index.json   its data, published by gen-docs-pages.ts
 * ```
 *
 * **At the directory's own URL, with no `/dashboard` beneath it**: a
 * directory a harness kind installs (`beans/`, `todos/`, `fsh-guts/`) must
 * provide its visualiser at `<base-url>/beans` etc. (`harness-requirements`).
 * Three rules on the published URL space bind here:
 *
 * 1. **The segment is the layer's `name`, never its `stub`.** The stub
 *    (`artefactStub(decl)`, e.g. `folio-assistant`) names the published GRAPH
 *    DOCUMENT, not the layer.
 * 2. **The declared graph IS a path segment**, not elided, because a layer
 *    may declare more than one renderable graph and they would otherwise
 *    collide on one URL.
 * 3. **The root layer elides its own name**, because its `docs/` is
 *    installed by cat-harness rather than its own. This layer's site dir
 *    IS the published root, so `<site>/<graph>/` already is `<base>/<graph>/`.
 *
 * ## The segment is the declared entry's `id`
 *
 * `gen-schema-viz.ts` and `gen-library-viz.ts` instead take
 * `viewerPlacement(site, dirPath, kind)`, the handled directory's
 * **repo-relative path**. The two rules agree for a graph declared at the
 * repository root and diverge for nested ones:
 *
 * | id | declared path | here, `<base>/<id>/` | `viewerPlacement` |
 * |---|---|---|---|
 * | `beans`, `todos`, `interaction`, `issue-marks`, `workflows` | at the root | same | same |
 * | `qa` | `test/results/` | `<base>/qa/` | `<base>/test/results/` |
 * | `health` | `test/health/results/` | `<base>/health/` | `<base>/test/health/results/` |
 *
 * A public dashboard should not be addressed by a TEST directory, and `id` is
 * what `harness.json` declares and what an override matches on, so an
 * id-derived URL survives a directory moving. The id is read from the
 * declaration, never written here (`check:declared-paths` catches a literal).
 *
 * ## Committed, not written into `_site`
 *
 * The page is COMMITTED under the layer's site dir and gated on exact
 * content (`state:visualizer:check`), so a reviewer sees it in the diff and
 * the gate fires when somebody changes the generator and does not regenerate.
 *
 * ## It reuses the projection
 *
 * `gen-docs-pages.ts` already writes `<site>/assets/beans/index.json` and
 * `<site>/assets/todos/index.json`; this reads those rather than publishing a
 * second answer to "what does the work plan hold".
 *
 * ## No CDN, no framework, no build step
 *
 * `kg-viewer.ts` states the rule: a view of this repository's own data must be
 * reviewable offline and must not add a third party to its own trust boundary.
 * The renderer and its stylesheet are INLINED from
 * `docs/assets/{js,css}/work-plan.*`, the same bytes the docs site serves, so
 * the two surfaces cannot drift.
 *
 * It does NOT open from `file://` — the code is inlined but the data is
 * fetched, and Chromium blocks that as cross-origin. Over any HTTP root,
 * including a staging preview under `branches/<slug>/`, it works with no
 * configuration, because every path is relative to the page.
 *
 * Usage:
 *   bun run cat state:visualizer
 *   bun run cat state:visualizer -- --check    # fail if a page is stale or missing
 *
 * Exit: 0 written or up to date, 1 stale under `--check`.
 */
import { inScope, scopeArg, siteScope } from "./lib/site-scope.ts";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, posix, relative, resolve, sep } from "node:path";

import {
  graphTypologiesOfLayer,
  layerRootsIn,
  isStateGraph,
  readDeclaration,
  repoRootFor,
  siteDirFor,
  type CatHarnessDeclaration,
  visualisationsOf,
} from "../schemas/kg/cat-harness.js";
import { checkoutDirectories } from "../schemas/kg/harness-config.js";
import { parseFrontMatter } from "../schemas/kg/front-matter.js";
import { ROUTE_SEGMENT, visualiserRoute } from "../schemas/kg/visualiser-route.js";
import { jsonFilesIn, projectQaGraph, QA_GRAPH_INDEX_SCHEMA, type QaGraphProjection } from "../pipeline/qa-graph-index.ts";
import { qaCorpusAvailability } from "../pipeline/qa-witness.ts";
import { qaIntegratedPanel, qaLiveSourceOf, type QaLiveSource, type QaSectionLink } from "./qa-page.ts";
import type { QaDeclaration } from "../schemas/sdlc/qa-axis.ts";
import { isOpen, readArchivedBeans, readBeans, type BeanNode } from "./beans.ts";
import { allInstances, beanInputs, beanStores, declaredDiagramIds, unlinkedReport, unlinkedSectionHtml } from "./unlinked-beans.ts";
import { MergeQueueEntrySchema } from "../schemas/sdlc/merge-queue.ts";
import { getReviewFindings, MergeReviewSchema } from "../schemas/sdlc/red-flag.ts";
import { graphReadPath } from "./graph-read.ts";
import { SessionSurveySchema } from "../schemas/sdlc/session-survey.ts";
import { SweepMarkSchema } from "../schemas/sdlc/sweep-mark.ts";
import { BoardSchema } from "../schemas/ui/board.ts";
import { BOARD_POSITIONS_FILE, BoardPositionsSchema, positionsOn } from "../schemas/ui/board-positions.ts";
import { parseTodoFile, readTodos, TODO_ROOT } from "./todos.ts";
import { StoreAbsentError } from "./lib/bean-store-absent.ts";
import {
  beanPositions,
  beansNamedBy,
  beanStepsOf,
  diagramLevels,
  DYNAMIC_STATE_FILE,
  dynamicStateDocument,
  endNodesOf,
  GATE_REFUSALS,
  lastMoved,
  NO_INSTANCE_REASON,
  readInstances,
  STUCK_AFTER_DAYS,
  dayOf,
  startOfUtcDay,
  stuckStatesOf,
  todosNamedBy,
  workingContextOf,
  processIdsOf,
  type BeanPosition,
  type InstanceLink,
  type DiagramLevel,
  type DynamicStateDocument,
  type DynamicStateInput,
  type StuckState,
  type TodoLike,
} from "./workflow-view.ts";
import { positionOf, type InstanceState } from "../src/workflow/instance.js";
import { detectRepoUrl } from "../src/core/git-refs.js";
import { branchKeptHref, branchKeptLocation } from "./branch-kept-href.ts";
import { PB_CSS, processedBeanBody, processedBeanIndexBody, processedBeansBody, processedBeansCombinedBody, processedBeansRoutes, processedBeansRows, rebase, RESERVED_STORE_NAMES, unplacedBeans, type ProcessedBeanHistory, type StoreRows } from "./processed-beans.ts";
import { MountedGitBranchStore } from "../src/workflow/work-plan-store-git-mount.ts";
import { loadProcessModel, type ProcessModel } from "../src/workflow/process-model.js";
import { roleGraphFor, workflowFiles } from "./known-skills.js";
import { readMemoryNodes } from "./agent-memory.ts";
import type { MemoryNode } from "../schemas/conduct/memory.js";
import type { RoleGraph } from "../schemas/process/role-graph.js";
import type { z } from "zod";
import { unportableSegment } from "../schemas/kg/portable-path.ts";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.js";
import { carriesMarker, orphanSubjectPages } from "./orphan-pages.ts";
import { withViewerNav } from "./viewer-page.ts";
import {
  forwardingParts,
  pageParts,
  renderedPath,
  siteDirectories,
  visualiserPageDir,
  withRenderedBy,
  withRenderedByFrontMatter,
  visualiserSitePath,
  declaredVisualisers,
  withViewers,
} from "./viewer-declarations.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { overlayPath, writePathOf } from "./lib/layer-output.ts";
import { wrapRaw } from "./lib/liquid-raw.ts";
import { siteTarget } from "./lib/site-target.ts";
import { subjectIri } from "./lib/subject-pages.ts";
import { describeAttestation } from "./lib/attestation-nodes.ts";
import { SOFTWARE_LIBRARY_KIND, SOFTWARE_LIBRARY_SUBJECT_KIND, SOFTWARE_LIBRARY_SUFFIX, describeLibrary } from "./lib/software-library-nodes.ts";
import { ATTESTATIONS_SUFFIX, QA_ATTESTATIONS_SCHEMA, QaAttestationsKind } from "../schemas/sdlc/qa-attestations.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";
import { readLockFile } from "../schemas/kg/repo-owner.ts";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
export const VIEWER_TOOL = "state-viewer";

const ROOT = HARNESS_ROOT;
const SITE = siteTarget(join(ROOT, siteDirFor(ROOT)));
/**
 * `coverage.*` is REPO-root relative, while a directory's `path` is relative
 * to the INSTANCE. Measured across both declarations 2026-09-20: of 27
 * coverage paths, 25 resolve only from the repo root, 2 from both (the root
 * declaration's own, where the two roots coincide) and **none** from the
 * layer root alone. Resolving these against `ROOT` would therefore mark
 * every one of them missing — which is the failure this whole change exists
 * to prevent, one level down.
 */
const REPO_ROOT = repoRootFor(ROOT);

const check = process.argv.slice(2).includes("--check");

let harnessName: string | undefined;
/**
 * Where a dashboard is drawn: `<site>/<locale>/<harness>/<vis>/`, the declared
 * route (`visualiserRoute`, owner 2026-10-09) under the page locale
 * (`pageParts`, folio-assistant#2527). The harness segment is this layer's
 * declared `name`, read once.
 */
function pageDirOf(vis: string): string {
  return visualiserPageDir(SITE, pageParts({ harness: harnessOf(), visualiser: vis }));
}

/** This layer's declared `name`, read once: the harness segment of every route. */
function harnessOf(): string {
  return (harnessName ??= readDeclaration(ROOT)?.name ?? basename(ROOT));
}

/**
 * Every ref this generator's OWN pages can be named by, for the visualisers it
 * draws: each one's page at its localised address (`pageParts`) AND at its old
 * `<harness>/<vis>/` address (`forwardingParts`), as `index.html` or
 * `index.md`, repository-relative.
 *
 * Both, because a declared visualiser resolves to whichever address holds its
 * page NOW (`visualiserPageRef`), and on the first run after the locale move
 * (folio-assistant#2527) that is the old one: this run writes the localised
 * page and prunes the old one only afterwards. Counting only the localised
 * address made that first run take its own not-yet-pruned page for ANOTHER
 * visualiser, so a graph with no projection read `elsewhere`, linking to a
 * page the same run then deleted; a second run read `declared`.
 */
export function ownVisualiserRefs(repoRoot: string, site: string, harness: string, ids: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const visualiser of ids) {
    const parts = { harness, visualiser };
    for (const dir of [visualiserPageDir(site, pageParts(parts)), visualiserPageDir(site, forwardingParts(parts))]) {
      for (const file of ["index.html", "index.md"]) out.add(renderedPath(repoRoot, join(dir, file)));
    }
  }
  return out;
}

/*
 * No renderer is inlined any more (#2418). Every dashboard is a THEMED page on
 * the site layout, whose `head_custom.html` already loads `kg-render.js`,
 * `work-plan.js` and `work-plan.css` in the order they need — so the page
 * gets the site's top band (language, search, Folio) from `docs-ui.js`, which
 * a shell with its own head never did.
 */

/**
 * The projection tags this generator knows how to render.
 *
 * Named constants rather than literals at the branch, because the branch is a
 * DISPATCH and a dispatch on an inline literal is one typo from silently
 * falling through to a default — which is precisely the defect these replaced:
 * every projection that was not beans got the todo renderer, by default rather
 * than by decision.
 */
const BEAN_INDEX_SCHEMA = "folio-bean-index/v1";
const TODO_INDEX_SCHEMA = "folio-todo-index/v1";

/** Every graph typology whose `holds` is `state`, asked of the registry. */
const STATE_KINDS = new Set(graphTypologiesOfLayer("state"));

/**
 * Declared ids this generator will not publish under.
 *
 * `assets` is where every projection and stylesheet lives, and a leading
 * underscore is Jekyll's own namespace (`_data`, `_includes`, `_layouts`).
 * Writing a dashboard into either would put a page inside machinery that is
 * not expecting one. Refused loudly: a route collision is a DECLARATION
 * problem, and guessing which of the two the reader meant is not this
 * generator's call.
 */
const RESERVED_IDS = new Set(["assets"]);

/**
 * What a graph's dashboard can show.
 *
 * Four states, because there are four facts and the first version of this
 * file collapsed two of them.
 *
 * | state | projection here | declaration names a visualiser |
 * |---|---|---|
 * | `live` | yes | — |
 * | `elsewhere` | no | yes, and it is there |
 * | `declared` | no | no |
 * | `unresolved` | no | yes, and it is NOT there |
 *
 * `elsewhere` is the one that was missing. `projectionFor` asks *"is there a
 * projection at MY path?"*, and the answer `no` was rendered as *"nothing
 * renders this graph"*. Those are different questions, and `uploads` is where
 * they diverge: its queue block is published inside `assets/library/index.json`
 * — one dataset with `library/`, since two projections over it would be two
 * answers to "how many are queued" — so this generator found nothing and said
 * so about a graph that has a working badge. Bean `flh4`, issue #618.
 *
 * `unresolved` exists so that fixing the above cannot introduce its own
 * defect: a declaration naming a page somebody has since deleted would
 * otherwise read as `elsewhere` and link to a 404. No entry is in this state
 * today — 27 of 27 coverage paths resolve — so it is falsified in the tests
 * synthetically rather than against the corpus.
 *
 * The value a reader might expect fifth — "not declared" — is absent on
 * purpose: an undeclared graph does not reach this generator, and inventing a
 * row for it would be this page asserting something the declaration does not
 * say.
 */
type GraphState = "live" | "elsewhere" | "declared" | "unresolved";

interface StateGraph {
  /** The declared entry's id — which names its projection, `assets/<id>/`. */
  id: string;
  /**
   * The id of the VISUALISER this harness declares for it — the URL segment,
   * `<base>/<harness>/<vis>/` (owner, 2026-10-09). Usually the directory id;
   * `uploads-queue` for `uploads`, whose id is the uploads viewer's route.
   */
  vis: string;
  /** Its path, relative to the layer root, as declared. */
  path: string;
  /** The graph typologies in it that are `state`. */
  kinds: string[];
  state: GraphState;
  description: string;
  /**
   * `coverage.visualiser` exactly as declared, repo-root relative. Carried on
   * `elsewhere` and `unresolved` so each page can NAME what it is pointing at
   * (or failing to), rather than reporting a state with no subject.
   */
  declaredVisualiser?: string;
  /**
   * A link from this graph's own page to that visualiser — set only when the
   * target is a published page under this site. A declared visualiser that
   * exists OUTSIDE the site is real but has no URL, so it is named without
   * being linked; fabricating an href for it would publish a dead control.
   */
  href?: string;
}

/**
 * A declared description, as HTML: escaped, with its backticked spans as code.
 *
 * ORDER IS THE WHOLE FIX. Escape first, so a `<` already in the description
 * becomes an entity, and only THEN turn the surviving backtick pairs into
 * `<code>`. The angle brackets this function emits are the only raw ones, so
 * a description cannot inject markup through either path. Reversed, the
 * corpus would do it to us unaided: `library` is declared as
 * "one `<bib-slug>/` per ingested document".
 *
 * Not a markdown parser, deliberately — only the one span type that appears
 * in this field. Measured 2026-09-20: 12 of 34 declared descriptions carry a
 * backtick in the first sentence, which is the part the registry shows, so a
 * third of the rows on every state dashboard were rendering them literally.
 * An UNPAIRED backtick is left as a backtick rather than swallowing the rest
 * of the line, which is what a greedy match would do.
 */
export function describe(text: string): string {
  return esc(text).replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** HTML-escape. Every interpolation below goes through it. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Whether a graph's projection is actually published.
 *
 * ASKED OF THE DISK rather than listed here. `gen-docs-pages.ts` publishes
 * `beans` and `todos` today; naming those two as a literal would mean a third
 * projection appearing and this generator still calling its graph unrendered —
 * the stale-gap-notice failure `AGENTS.md` describes, where an agent that
 * believes the notice either avoids the feature or rebuilds it.
 */
function projectionFor(id: string): string | null {
  // Over the overlay: in a mounted layer gen-docs-pages writes the projection
  // to the output root, not beside the pinned site.
  const p = overlayPath(join(SITE, "assets", id, "index.json"));
  return existsSync(p) ? p : null;
}

/**
 * What the DECLARATION says renders this graph, resolved against the disk.
 *
 * The declaration is the authority on this, not a scan: a page that renders a
 * graph is not detectable by looking at it, and asking the filesystem "does
 * anything read `uploads`?" has no answer. So the question asked here is the
 * narrow one the declaration can actually answer — `coverage.visualiser` —
 * and the three outcomes are kept apart rather than reduced to a boolean.
 *
 * Takes its roots as an argument so the four outcomes can be exercised
 * against fixtures. `unresolved` fires on nothing in this corpus, so without
 * that it would be a branch no test could reach — and a branch no test can
 * reach is a branch that is wrong the first time it matters.
 *
 * @param id     the declared entry's id, which is also its page's URL segment
 * @param cov    `coverage.visualiser` as declared, or undefined
 * @param roots  the published site and the repo root; defaults to this
 *               layer's, which is what the generator itself passes
 * @returns the state this graph is in once `projectionFor` has said `null`,
 *          with the declared path and an href where one is publishable
 */
export function declaredVisualiserFor(
  id: string,
  cov: string | undefined,
  roots: { site: string; repoRoot: string; pageDir?: string; built?: (abs: string) => boolean } = { site: SITE, repoRoot: REPO_ROOT },
): Pick<StateGraph, "state" | "declaredVisualiser" | "href"> {
  const { site: SITE, repoRoot: REPO_ROOT } = roots;
  const pageDir = roots.pageDir ?? join(SITE, id);
  if (!cov) return { state: "declared" };
  // REPO-root relative — see `REPO_ROOT`. This is the line that would silently
  // report all 27 as missing if it used `ROOT`.
  const target = join(REPO_ROOT, cov);
  // A target the harness BUILDS AT PUBLISH (`built`, its `builtAtPublish`) is
  // there, not unresolved, though it is not on disk yet: often this very run
  // writes it, after this page (a per-instance page of the same visualiser).
  // Asked of the disk alone, a fresh publish drew "not there" on the page and
  // only a second run said "elsewhere" — the committed copy hid that.
  if (!existsSync(target) && !(roots.built?.(target) ?? false)) return { state: "unresolved", declaredVisualiser: cov };
  // Linkable only if the target is published BY THIS SITE. Asked of the site
  // directly rather than by inspecting the relative path for leading `..`,
  // which answers the same question by a proxy that a sibling directory named
  // `docs-old` would break.
  const inSite = !relative(SITE, target).startsWith("..");
  return {
    state: "elsewhere",
    declaredVisualiser: cov,
    ...(inSite ? { href: relative(pageDir, target).split(sep).join("/") } : {}),
  };
}

/**
 * The state graphs this layer declares.
 *
 * Its OWN declaration, not a dependency's: a dependency's directory must not
 * name the URL this layer publishes at, which is the same trap
 * `gen-schema-viz.ts` documents on `schemaRoots`.
 */
function stateGraphsOf(decl: CatHarnessDeclaration, visOf: ReadonlyMap<string, string>, ownRefs: ReadonlySet<string>): StateGraph[] {
  const out: StateGraph[] = [];
  for (const d of decl.directories ?? []) {
    const kinds = (d.graphTypologies ?? []).filter((g) => STATE_KINDS.has(g) && isStateGraph(g));
    if (kinds.length === 0) continue;
    // DRAWN ONLY WHERE THE HARNESS DECLARES IT (owner, 2026-10-09): a state
    // graph with no `visualisers` entry rendered by this Tool gets no page.
    const vis = visOf.get(d.id);
    if (vis === undefined) continue;
    out.push({
      id: d.id,
      vis,
      path: d.path,
      kinds,
      ...(projectionFor(d.id) === null
        ? // THE FIRST declared visualisation, and the choice is deliberate: this
          // page reports ONE state per directory, so it answers about the
          // primary one. A directory declaring several is not misreported by
          // that — `harness-tiles.ts` checks every ref and is where a broken
          // second viewer surfaces. Passing the whole list here would need a
          // state per visualisation, which is a different page.
          // ANOTHER visualiser of the graph — this generator's own page is
          // not "elsewhere".
          declaredVisualiserFor(d.id, visualisationsOf(d.coverage, d.id).find((v) => !ownRefs.has(v.ref))?.ref, {
            site: SITE,
            repoRoot: REPO_ROOT,
            pageDir: pageDirOf(vis),
            built: builtAtPublishHere,
          })
        : { state: "live" as const }),
      // The declaration's own words, clipped to its first sentence. Restating
      // what a directory is for, here, would be a second description free to
      // contradict the first.
      description: (d.description ?? "").split(/(?<=\.)\s/)[0]?.slice(0, 260) ?? "",
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

let stale = 0;
let wrote = 0;

/**
 * The sentence every page this generator writes carries, and the ONLY thing
 * that makes one of them identifiable as ours.
 *
 * It has one home because `prunableDashboards` matches on it. Two copies
 * would let a page drift out of the set that owns it while still looking
 * generated, and the pruner would then walk past an orphan it minted.
 */
export const GENERATED_BY =
  "Generated by scripts/state-visualizer.ts. Do not hand-edit";

/**
 * Dashboard pages under this site that no declared state graph asks for.
 *
 * **Narrow on purpose, and the narrowness is the whole safety argument.**
 * `SITE` is the documentation site: it holds `guides/`, `reference/`,
 * `assets/`, `api/`, the translated trees and more, none of which this
 * generator wrote. A directory is a candidate only when it holds an
 * `index.html` carrying {@link GENERATED_BY} — the sentence this tool itself
 * writes. Anything else is left alone, whatever its name.
 *
 * That is `deletion-requires-confirmation` applied rather than bypassed: an
 * agent never removes a durable artefact it did not create, so ownership has
 * to be CHECKABLE — read out of the file — and never inferred from which
 * directory something sits in. The precedent is `prunableStickies` in
 * `ensure-landing-sticky.ts`, and this reuses its shape rather than minting
 * a third.
 *
 * Why it is needed at all: a generator that writes and never deletes leaves a
 * page serving a subject the declaration no longer describes, at a URL nothing
 * links to. `--check` cannot see it, because it inspects only the files it is
 * about to write — so it can find a page that is WRONG but never one that
 * SHOULD NOT EXIST. Bean `ankg`, found live when #604's rename left
 * `folio-assist-sci/index.html` behind.
 *
 * @param site      the published site directory
 * @param wantedIds the graph ids this run is about to write
 * @returns the orphans' paths relative to `site`, sorted
 */
export function prunableDashboards(site: string, wantedIds: readonly string[]): string[] {
  // A CALL SITE NOW, not a fourth implementation (bean `s8nu`). The unit is
  // the same one `orphanSubjectPages` walks -- a directory holding an
  // `index.html` -- and only the ownership TEST differs, which is why that is
  // what the shared selector takes.
  //
  // The marker is the right test HERE and the weaker of the two: dashboards
  // publish at the site root among directories nothing here owns, and their
  // identity is the graph id rather than the path, so there is no self-naming
  // for a page to do. `declaresItsOwnDirectory` would claim none of them.
  //
  // `foreign` is deliberately not returned. This function's contract is the
  // prunable set, and its callers act on that; the directories declined are
  // reported by the caller that wants them. Keeping the signature means the
  // three tests below still falsify the same things.
  // Scanned where this run WRITES and deletes: in a mounted layer the pages
  // are at the output root, so the pinned directory never holds an orphan this
  // run could remove (bean `cat-tools-sm8r`). Outside a mount it is `site`.
  const { owned } = orphanSubjectPages(writePathOf(site), wantedIds, carriesMarker(GENERATED_BY));
  return owned.map((dir) => join(dir, "index.html")).sort();
}

/**
 * One generated file, with the `--check` contract every generator here uses.
 *
 * THE NAVBAR IS APPLIED HERE, before the staleness comparison, because this is
 * this generator's single write — bean `edx7`, and the same chokepoint rule the
 * shared `makeEmit` follows. Applying it after the comparison would make the
 * gate green over pages that gain a rail only when somebody runs the generator.
 *
 * Its dashboard pages are keyed by GRAPH ID (`beans`, `todos`, `qa`), not by
 * layer, so the rail lists this layer's graphs and no layer is
 * inferred from the id.
 */
/**
 * Whether `path` is an artefact this layer builds at publish and never
 * commits (`builtAtPublish`, owner 2026-10-14 B1): `--check` has no committed
 * bytes to compare it with, so a missing copy there is the normal case.
 */
function builtAtPublishHere(path: string): boolean {
  return isBuiltAtPublish(readDeclaration(ROOT)?.builtAtPublish ?? [], relative(ROOT, path).split(sep).join("/"));
}

function emit(path: string, content: string): void {
  content = withViewerNav(content, path, { built: basename(ROOT), docsRoot: SITE }) ?? content;
  const rel = relative(ROOT, path);
  if (check && builtAtPublishHere(path)) return;
  if (check) {
    // Over the overlay: in a mounted layer the page is at the output root.
    const at = overlayPath(path);
    if (!existsSync(at)) {
      console.error(`  ✗ ${rel} is missing`);
      stale++;
    } else if (readFileSync(at, "utf-8") !== content) {
      console.error(`  ✗ ${rel} is stale`);
      stale++;
    }
    return;
  }
  // A mounted layer is read-only: its pages go to the output root's twin.
  const to = writePathOf(path);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, content);
  wrote++;
  console.log(`  ✓ ${rel}`);
}

/**
 * The page shell.
 *
 * It takes no base URL and composes none. The data path is written by the
 * caller, relative to where that page sits, so the depth is expressed once at
 * the only place that knows it.
 */
function page(opts: { title: string; body: string; noLiquid?: boolean; liquid?: boolean }): string {
  // A page that quotes AUTHORED text (a registry node's title or summary, file
  // names, a declaration's descriptions) must not be run through Liquid, or a
  // `{{ … }}` or `{%` in that text is evaluated and the site build fails on it.
  // `noLiquid: true` and `liquid: false` say the same thing.
  const noLiquid = opts.noLiquid === true || opts.liquid === false;
  return `---
layout: default
title: ${JSON.stringify(opts.title)}
nav_exclude: true${noLiquid ? "\nrender_with_liquid: false" : ""}
---
<!--
  ${GENERATED_BY}: the next run
  overwrites it, \`state:visualizer:check\` fails on the difference, and a
  hand-edit here is a change nothing else in the tree knows about.
-->
<style>
${SV_CSS}
</style>
<div class="sv-page">
${opts.body}
</div>
`;
}

/**
 * The dashboards' own styles, scoped to their \`sv-\` classes.
 *
 * Written for BOTH schemes with no colour of their own: on a themed page the
 * reader's light/dark choice is live (it never was in the old shell, whose
 * light rules were unfinished — axe, 2026-09-24), so ink and borders follow
 * the theme through \`currentColor\` and opacity rather than fixed hues that
 * would need validating twice. A state tag is told by its WORD, never by hue.
 * Links keep text ink and carry their identity by UNDERLINE, as they did in
 * the shell: underline survives forced-colors and greyscale print, a hue does
 * not. The board's own links are the work-plan stylesheet's, so they are left
 * to it.
 */
const SV_CSS = `.sv-page a:not(.fa-workplan a) { color: inherit; text-decoration: underline; text-underline-offset: 0.15em; }
.sv-page a:not(.fa-workplan a):hover { text-decoration-thickness: 2px; }
.sv-sub { margin: 0 0 1.5rem; font-size: 0.9rem; opacity: 0.85; }
.sv-h2 { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.02em;
  text-transform: uppercase; margin: 2rem 0 0.7rem; }
.sv-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
.sv-list > li::before, .sv-counts > li::before { content: none; }
.sv-item { border: 1px solid rgba(127,127,127,0.4); border-radius: 8px; padding: 0.8rem 1rem; }
.sv-item.is-here { border-color: currentColor; }
.sv-item h2, .sv-item h3 { font-size: 1rem; margin: 0 0 0.2rem; }
.sv-item p { margin: 0; font-size: 0.85rem; }
.sv-here { font-weight: 600; }
.sv-tag { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em;
  font-weight: 600; margin-left: 0.5rem; }
.sv-counts { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.6rem 0 0; padding: 0; list-style: none; }
.sv-count { border: 1px solid rgba(127,127,127,0.4); border-radius: 6px; padding: 0.4rem 0.7rem; min-width: 4.5rem; }
.sv-count-v { display: block; font-size: 1.1rem; font-weight: 600; line-height: 1.25; }
.sv-count-k { display: block; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; }
.sv-page td { vertical-align: top; }`;

/**
 * The sibling dashboards, listed on every page.
 *
 * There is no cross-kind index, because the policy gives a path per kind and
 * none above them — `<base>/` is the documentation site's. So each dashboard
 * carries the way across instead, which is what makes them *registered*
 * sub-visualisations rather than six unrelated pages.
 */
function registry(graphs: StateGraph[], current: string): string {
  const rows = graphs.map((g) => {
    const here = g.id === current;
    // Siblings share the harness segment, so `../<vis>/` is the sibling route.
    const name = here
      ? `<span class="sv-here">${esc(g.id)}</span>`
      : `<a href="../${esc(g.vis)}/">${esc(g.id)}</a>`;
    return `  <li class="sv-item${here ? " is-here" : ""}">
    <h3>${name} <span class="sv-tag is-${g.state}">${g.state}</span></h3>
    <p>${g.description ? describe(g.description) : esc(g.path)}</p>
  </li>`;
  }).join("\n");
  return `<h2 class="sv-h2">State graphs this harness declares</h2>
<ul class="sv-list">
${rows}
</ul>`;
}

/**
 * A page-relative href, as the site-absolute URL a reader sees.
 *
 * `../cat-harness/library/…` from `<base>/uploads/` is `/cat-harness/library/…`
 * — resolved rather than string-trimmed, so it stays correct if a dashboard
 * ever sits at a depth other than one.
 */
function siteUrlOf(href: string, fromVis: string): string {
  const abs = relative(SITE, join(pageDirOf(fromVis), href));
  return `/${abs.split(sep).join("/")}`;
}

/**
 * What a page says when this generator has no projection to draw.
 *
 * Three different sentences for three different facts. The `declared` one is
 * unchanged and still correct for `qa`, `health` and `issue-marks`, which
 * declare no visualiser; the other two exist because `uploads` does, and was
 * being told it did not.
 */
function notDrawnHere(g: StateGraph): string {
  if (g.state === "elsewhere") {
    // Linked as a DIRECTORY and labelled with the URL a reader would see in
    // the address bar — the same shape as the registry's own links. The
    // declared value is a repo path, which is the right thing to resolve
    // against the disk and the wrong thing to show somebody in a browser.
    const dir = (h: string) => h.replace(/(^|\/)index\.html$/, "$1");
    const where = g.href
      ? `<a href="${esc(dir(g.href))}">${esc(dir(siteUrlOf(g.href, g.vis)))}</a>`
      : `<code>${esc(g.declaredVisualiser ?? "")}</code> (not published by this site)`;
    return (
      `<p class="sv-sub">This graph is <strong>rendered elsewhere</strong>. Nothing ` +
      `publishes a projection at this generator's own path, but the declaration names ` +
      `a visualiser for it: ${where}. The directory is <code>${esc(g.path)}</code>.</p>`
    );
  }
  if (g.state === "unresolved") {
    // NOT rendered as either neighbouring state. A declaration pointing at a
    // page that is not there is a defect in the declaration, and calling it
    // "rendered elsewhere" would publish a link to a 404 while calling it
    // "nothing renders it" would hide a claim somebody made.
    return (
      `<p class="sv-sub">This graph's declaration names a visualiser that is ` +
      `<strong>not there</strong>: <code>${esc(g.declaredVisualiser ?? "")}</code>. That is a ` +
      `defect in the declaration, not an answer about the graph — so this page reports it ` +
      `rather than claiming either that the graph is rendered or that nothing renders it. ` +
      `The directory is <code>${esc(g.path)}</code>.</p>`
    );
  }
  return (
    `<p class="sv-sub">This graph is <strong>declared</strong> and nothing publishes a ` +
    `projection for it yet, so there is nothing to draw. That is bean <code>2krx</code>: ` +
    `a declared subgraph with no visualiser is unreachable, and 19 of this instance's 22 ` +
    `were in that state when this was written. The directory is <code>${esc(g.path)}</code>.</p>`
  );
}

/** `<base>/<graph>/` — the visualiser for one declared state graph. */
function dashboardPage(g: StateGraph, graphs: StateGraph[]): string {
  // The verdicts are read off the mounted branch, server-side: no projection
  // is published for them, and none is needed for a table (bean `w8jq`).
  if (g.kinds.includes(MERGE_REVIEWS_KIND)) {
    const read = graphReadPath(g.id, REPO_ROOT);
    return mergeReviewsPage(g, graphs, read.state === "ok" ? read.at : null);
  }
  const head =
    `<h1 id="${esc(g.id)}">${esc(g.id)}</h1>` +
    `<p class="sv-sub">${esc(g.path)} · ${esc(g.kinds.join(", "))}</p>`;

  if (g.state !== "live") {
    // No projection AT THIS PATH — which is not the same as nothing rendering
    // the graph, and saying so was this generator's defect (bean `flh4`).
    // Each of the three answers is written out separately; none renders zeros
    // for a store nobody read, because a dashboard opening at zero is
    // indistinguishable from a store with nothing in it.
    return page({
      title: `${g.id} — state`,
      body: head + notDrawnHere(g) + registry(graphs, g.id),
    });
  }

  // The projection `gen-docs-pages.ts` already publishes, read relative to
  // this page rather than composed — the page sits at `<harness>/<vis>/`.
  const src = esc(relative(pageDirOf(g.vis), join(SITE, "assets", g.id, "index.json")).split(sep).join("/"));

  // WHICH renderer, asked of the projection's own `$schema` rather than of the
  // graph's id.
  //
  // This was `g.id === "beans" ? beans-meta : todo-meta`, which is a default
  // rather than a choice: EVERY projection that was not beans got the todo
  // renderer. It survived because only two existed. The third — `qa`, bean
  // `py74` — would have mounted the work-plan renderer over a document with no
  // `items` array at all, and the page would have claimed `live` above a
  // container that rendered nothing. A dashboard that says live and shows
  // nothing is worse than one that honestly says `declared`, which is the
  // defect `flh4` already paid for one state over.
  //
  // So the file says what it is, the same contract `directory-conventions`
  // states for every other node here: extension is a coincidence, a
  // declaration inside the file is the contract.
  const tag = projectionSchema(g.id);

  if (tag === QA_GRAPH_INDEX_SCHEMA) {
    // Rendered SERVER-SIDE, not fetched. The data is known at generate time,
    // a family table has no interaction to speak of, and a static table needs
    // no JavaScript — which is the accessibility floor every page here is held
    // to rather than a nicety.
    return page({
      title: `${g.id} — state`,
      body: head + qaPanels(g.id, src) + registry(graphs, g.id),
    });
  }

  if (tag !== BEAN_INDEX_SCHEMA && tag !== TODO_INDEX_SCHEMA) {
    // A projection this generator cannot render. NOT rendered as `declared` —
    // the file is there, which is a different fact from nobody having
    // published one — and not guessed at either.
    return page({
      title: `${g.id} — state`,
      body:
        head +
        `<p>A projection is published at <a href="${src}">${esc(src)}</a>, and this ` +
        `generator has no renderer for <code>${esc(tag ?? "a document with no $schema")}</code>. ` +
        `That is a gap in this page, not a gap in the graph.</p>` +
        registry(graphs, g.id),
    });
  }

  if (tag === TODO_INDEX_SCHEMA) {
    // A published projection whose store this checkout does not hold — a
    // mount that switched the todo store off, smart-ips-pilgrimage#66 — is a
    // board this run cannot draw, not a failure of the run: the projection is
    // linked, and the board is drawn where the store is.
    const store = todoStoreHere();
    if ("absent" in store) {
      return page({
        title: `${g.id} — state`,
        body:
          head +
          `<p class="sv-sub">A projection is published at <a href="${src}">${esc(src)}</a>, and the ` +
          `todo store it is built from is <strong>absent from this checkout</strong>: ${esc(store.absent)}. ` +
          `The board is drawn where the store is.</p>` +
          registry(graphs, g.id),
      });
    }
    return todoBoardPage(g, store.root);
  }

  return beansBoardPage(g, graphs, src);
}

/**
 * `<base>/beans/` — the work-plan dashboard, as a THEMED site page.
 *
 * Owner, 2026-10-07 (#2418): *"https://litlfred.github.io/folio-assistant/beans/
 * (and other pages) have no top search/folio/local on the display"*. That band
 * is built by `docs-ui.js`, which reaches a page only through the layout's
 * `head_custom.html`; the standalone shell (`page()`) wrote its own head, so
 * nothing built it. Same move as `todos/` (#1906), and for the same reason.
 *
 * The layout's head already carries everything the board needs, so the page
 * names none of it: `fa-beans-src` and `fa-build-src` (both through
 * `relative_url`), `work-plan.css`, and `work-plan.js`, which mounts itself on
 * `[data-fa-workplan]`. The layout ALSO carries `fa-todo-src`, which would
 * quietly make this the combined beans-and-todos view under the beans name —
 * so the container says `data-fa-workplan-only="beans"`, and the renderer
 * leaves the todo half unasked.
 *
 * The registry stays, as on every dashboard but `todos`. Its styles come with
 * it, scoped to its own classes and written for BOTH schemes: on a themed page
 * the reader's light/dark choice is live, which it never was in the shell.
 */
export function beansBoardPage(
  g: Pick<StateGraph, "id" | "path" | "kinds">,
  graphs: StateGraph[],
  src: string,
): string {
  return page({
    title: "Plans and work",
    body: `<h1 id="beans">${esc(g.id)}</h1>
<p class="sv-sub">${esc(g.path)} · ${esc(g.kinds.join(", "))}</p>
<div class="fa-workplan" data-fa-workplan data-fa-workplan-only="beans">
  <p class="fa-workplan-fallback">This view needs JavaScript. The data is
  <a href="${src}">a plain JSON file</a>.</p>
</div>
${registry(graphs, g.id)}`,
  });
}

/**
 * `<base>/todos/` — a THEMED site page that mounts the landing page's sticky
 * panel, not a standalone dashboard.
 *
 * Owner, 2026-10-02 (#1906): *"https://litlfred.github.io/folio-assistant/todos/
 * should also have the same stickies panel. not sure why all the graphs are
 * listed on the todos page. cluttery"*.
 *
 * So this page is NOT the work-plan shell the other dashboards are. It is a
 * Jekyll page on the default layout, which gives it three things, none of
 * them by a second implementation:
 *
 * - the site chrome — the navbar and a way back, which the standalone shell
 *   lacked (wireframe `todos` finding 5);
 * - `docs-ui.js` with `meta[name="fa-todo-src"]` (from `head_custom.html`),
 *   which mounts the todo board INTO `.fa-landing-board`. The panel is the
 *   landing page's own include, so the board is the same board, mounted the
 *   same way (wireframe finding 1: the items were not on the page);
 * - the no-JS floor, `_includes/generated/todo-listing.html` in the footer,
 *   which carries each item's body, status, who raised it and its resolved
 *   "About" link to the node it is attached to.
 *
 * The panel is OPEN here, and closed on the landing page. On the landing page
 * the owner asked for it slid away (2026-09-21) because it pushed what the
 * repository IS below the fold; on this page the items are what the page is
 * for, and a closed panel would leave finding 1 standing until a click.
 *
 * WHAT IS NOT HERE, on purpose:
 *
 * - "State graphs this harness declares", the registry every other dashboard
 *   carries. The owner called it clutter on this page, and wireframe finding 3
 *   measured it at most of the first screen. The other dashboards keep it;
 *   whether they should is an open question, not this page's to settle.
 * - "Todos by the node they are attached to" (#1757). Its items were plain
 *   text — no body, no link to the node, no view or edit (owner, 2026-10-02:
 *   *"are not functional for more info or anything"*) — and everything it
 *   could show is already on this page twice: on each sticky (View / Edit)
 *   and in the floor (body and the resolved "About" link). A third listing of
 *   the same items would be the clutter this page is being cleared of.
 *
 * The `renders` declaration goes in the FRONT MATTER, the form a themed page
 * carries it in (`withRendersFrontMatter`), and the do-not-hand-edit sentence
 * stays in the body so `prunableDashboards` still recognises the page as ours.
 */
export function todoBoardPage(g: Pick<StateGraph, "description">, storeAbs?: string): string {
  const lead = g.description ? g.description.split(/(?<=\.)\s/)[0]! : "";
  // The graph's other parts, below the board (bean `folio-assistant-750a`):
  // the board draws `items` only, the same split as the bean store's page.
  const parts = storeAbs === undefined ? "" : `${todoStorePartsSection(storeAbs)}\n`;
  return `---
layout: default
title: Todos
nav_exclude: true
fa_todo_listing: all
---
<!--
  ${GENERATED_BY}: the next run
  overwrites it, \`state:visualizer:check\` fails on the difference, and a
  hand-edit here is a change nothing else in the tree knows about.
-->
<h1 id="todos">Todos</h1>
${lead ? `<p class="fs-5 fw-300">${describe(lead)}</p>\n` : ""}{% include landing.html open=true %}
${parts}`;
}

/** The `$schema` a graph's published projection declares, or null. */
export function projectionSchema(id: string): string | null {
  const p = projectionFor(id);
  if (p === null) return null;
  try {
    const doc: unknown = JSON.parse(readFileSync(p, "utf8"));
    if (doc === null || typeof doc !== "object") return null;
    const tag = (doc as Record<string, unknown>)["$schema"];
    return typeof tag === "string" && tag.length > 0 ? tag : null;
  } catch {
    return null;
  }
}

/**
 * The `qa` graph's panels — **one per family, and no total across them.**
 *
 * The owner's ruling of 2026-09-21 on bean `py74`. The absence of a headline
 * is the point rather than an omission, so the page SAYS it is absent and why;
 * a reader who finds no total and is told nothing will reasonably assume the
 * page is unfinished and go looking for one.
 *
 * Each family's buckets are printed in that family's OWN spelling — `n/a` in
 * one and `na` in another stay two columns, because merging them is exactly
 * the decision that was declined.
 */
export function qaPanels(id: string, src: string): string {
  const p = projectionFor(id);
  if (p === null) return "";
  let ix: QaPanelsInput;
  try {
    ix = JSON.parse(readFileSync(p, "utf8")) as QaPanelsInput;
  } catch {
    return `<p>The projection at <a href="${src}">${esc(src)}</a> could not be read.</p>`;
  }
  return qaPanelsOf(ix, src);
}

/** A `folio-qa-graph/v1` projection, as {@link qaPanelsOf} reads it: the counted form or the `unknown` one. */
type QaPanelsInput = {
  files?: number;
  families?: Array<{ schema: string; files: number; rollUpField: string | null; buckets?: Record<string, number> }>;
  unclassified?: number;
  unreadable?: number;
};

/**
 * The family panels for a projection already in hand. `src`, when given, is
 * where the same data is published as JSON; a per-instance page has no
 * published projection of its own, so it passes none and says nothing about one.
 */
export function qaPanelsOf(
  ix: QaPanelsInput | QaGraphProjection,
  src?: string,
  opts: { qaFamilies?: boolean } = {},
): string {
  const qaFamilies = opts.qaFamilies ?? true;
  const dataLine = src === undefined ? "" : `<p class="sv-sub">The data is <a href="${src}">a plain JSON file</a>.</p>`;
  // The build had no QA corpus to count (bean `tfqf`, C9). Said, with its
  // reason, rather than rendered as "Families — 0, over 0 document(s)", which
  // would be a census of nothing.
  const unknown = ix as { availability?: string; reason?: string };
  if (unknown.availability === "unknown") {
    return (
      `<h2 class="sv-h2">Not available in this build</h2>` +
      `<p class="sv-sub">${esc(unknown.reason ?? "No reason was recorded")}. ` +
      `This is <strong>unknown</strong>, not zero.</p>` +
      dataLine
    );
  }
  const counted = ix as QaPanelsInput;
  const families = counted.families ?? [];
  const panels = families
    .map((f) => {
      const buckets = f.buckets ?? {};
      const keys = Object.keys(buckets).sort();
      const body =
        f.rollUpField === null
          ? `<p>Declares no roll-up field, so this family has no counts to show. ` +
            `That is a property of the schema, not a count of zero.</p>`
          : `<p>Rolled up from <code>${esc(f.rollUpField)}</code>.</p>` +
            `<ul class="sv-counts">` +
            keys
              .map(
                (k) =>
                  `<li class="sv-count">` +
                  `<span class="sv-count-v">${buckets[k]}</span>` +
                  `<span class="sv-count-k">${esc(k)}</span>` +
                  `</li>`,
              )
              .join("") +
            `</ul>`;
      return `<section class="sv-item">
    <h3><code>${esc(f.schema)}</code> <span class="sv-tag">${f.files} file${f.files === 1 ? "" : "s"}</span></h3>
    ${body}
  </section>`;
    })
    .join("\n");

  // BOTH third states printed every run, including at zero. A count that
  // appears only when non-zero cannot be told from one nobody measured.
  const thirdStates =
    `<p class="sv-sub">${counted.unclassified ?? 0} document(s) carry no <code>$schema</code> ` +
    `(could not determine); ${counted.unreadable ?? 0} would not parse.</p>`;

  return (
    `<h2 class="sv-h2">Families — ${families.length}, over ${counted.files ?? 0} document(s)</h2>` +
    // The no-total argument is about the QA families specifically (three
    // roll-up conventions); another kind's page groups by `$schema` the same
    // way and says only that, rather than repeating a claim about QA.
    (qaFamilies
      ? `<p class="sv-sub">There is deliberately <strong>no total across these families</strong>. ` +
        `The two largest that roll up disagree on the container (<code>totals</code> against ` +
        `<code>counts</code>), on the spelling of not-applicable (<code>n/a</code> against ` +
        `<code>na</code>) and on whether <code>warn</code> exists at all; the third declares no ` +
        `roll-up. A single number over them would be three silent decisions.</p>`
      : `<p class="sv-sub">Documents are grouped by the <code>$schema</code> each one declares; ` +
        `there is no total across families.</p>`) +
    panels +
    thirdStates +
    dataLine
  );
}

/**
 * The harness's one-node-per-file graphs that are neither state nor a
 * registry of `folio-…/v1` nodes, and had no viewer (bean `folio-assistant-6gme`,
 * owner 2026-10-20: "every kind gets a viewer"). Each is drawn as a registry
 * is — a page per layer holding the kind, listing every node by id and
 * title — because that is what their files are: `scenarios` (actors and
 * capabilities, which carry no `$schema`), `policies` (ODRL, `.jsonld`),
 * `test-plan`, `tool-release`, `vocab-mapping` and `substrate-snapshot`
 * (`<id>.substrate.json`, written by `kg:subscribe` and not committed).
 * `attestations` is listed too (owner, 2026-11-13, node-kind audit): its page
 * was a census of `$schema` families that named no attestation, so each file
 * is now a row linking its page and its IRI (`QaAttestationsKind`). So is
 * `software-library` (same audit): it had no viewer "by design", and each
 * library is now a row linking its node-kind page, its IRI and its `.jsonld`.
 */
export const LISTED_KINDS: readonly string[] = ["scenarios", "policies", "test-plan", "tool-release", "vocab-mapping", "substrate-snapshot", "attestations", SOFTWARE_LIBRARY_KIND];

/**
 * The file endings a listed node is read from: JSON, and JSON-LD, which is
 * what an ODRL policy is written in (`policies/*.jsonld`).
 */
export const NODE_EXTENSIONS: readonly string[] = [".json", ".jsonld"];

/**
 * The kinds a `subgraphs: "instance"` visualiser can draw one page per
 * layer for: those whose documents are self-describing JSON (a `$schema`
 * tag), which the family reader (`readQaGraph`) counts without knowing the
 * kind. `qa` (`test/results/`), `health` (`health-report/v1`) and
 * `attestations` (`qa-attestations/v1`) are that shape; a kind outside this
 * set is refused loudly rather than drawn as a census of nothing.
 */
export const PER_INSTANCE_KINDS: ReadonlySet<string> = new Set([
  "qa",
  "health",
  "attestations",
  // The harness's own registries (bean `folio-assistant-k7ro`): one
  // `folio-*/v1` JSON node per file, so the family reader counts them as it
  // counts QA, and `registryRowsOf` lists each node.
  "typologies",
  "validators",
  "qa-checkers",
  "block-kinds",
  "content-adapters",
  "code-list",
  // The pipeline's plugin slots and the editor's checkers: `folio-pipeline-
  // plugin/v1` and `folio-editor-checker/v1` nodes, one per file, declared
  // by layers above this one (cat-harness-tools#386).
  "pipeline-plugins",
  "editor-checkers",
  // The other one-node-per-file graphs (bean `folio-assistant-6gme`).
  ...LISTED_KINDS,
]);

/**
 * The registry kinds among {@link PER_INSTANCE_KINDS} (bean
 * `folio-assistant-k7ro`): directories of `folio-graph-typology/v1`,
 * `folio-validator/v1`, `folio-qa-checker/v1`, `folio-block-kind/v1`,
 * `folio-content-adapter/v1` and `folio-code-list/v1` nodes. A census of
 * them says little on its own — every file is one family — so their page also
 * lists each node.
 */
export const REGISTRY_KINDS: ReadonlySet<string> = new Set([
  "typologies",
  "validators",
  "qa-checkers",
  "block-kinds",
  "content-adapters",
  "code-list",
  "pipeline-plugins",
  "editor-checkers",
  ...LISTED_KINDS,
]);

/** One registry node, as a layer page lists it. */
export interface RegistryRow {
  /** Path under the declared directory. */
  file: string;
  schema?: string;
  /** The node's `id`, `name`, `kind` or `slot`, else the file stem. */
  id: string;
  /** Its `title`, `label`, `summary`, `description` or `rationale`, clipped. */
  text?: string;
  /** Why the file is not listed with its fields. */
  note?: string;
  /** The node's IRI, where its layer's document mints one ({@link withSubjectIris}); its JSON-LD is the IRI plus `.jsonld`. */
  iri?: string;
  /** The node's own page on this site, relative to the listing page, where its kind has one. */
  page?: string;
}

/** Where in a listed kind's directory its knowledge-graph SUBJECTS are, and how each is named. */
export interface SubjectRows {
  /** The sub-directory they sit DIRECTLY in; absent for every file of the directory, at any depth. */
  dir?: string;
  /** The subject kind `kg-export` mints their IRI as (`scripts/lib/subject-iri.ts`). */
  kind: string;
  /** The subject's id from its row; the row's id when absent. */
  id?: (row: RegistryRow) => string | undefined;
  /**
   * The node's own page, relative to the layer's listing page
   * (`<locale>/<harness>/<vis>/<instance>/`), where `gen-node-kind-pages`
   * writes one: `<locale>/<declaring>/<kind>/<harness>/<path>/`.
   */
  page?: (row: RegistryRow, instance: string, layerPath: string) => string | undefined;
}

/**
 * The files of a listed kind that are knowledge-graph SUBJECTS, and the
 * subject kind `kg-export` mints their IRI as: `scenarios/actors/<f>.json` is
 * an `actor`, `scenarios/capabilities/<f>.json` a `capability`
 * (`collectRegistryNodes`, which reads only the files directly in each), and
 * every `<family>/<path>.attestations.json` an `attestation`
 * (`attestation-nodes.ts`). Their rows link the IRI and its `.jsonld` (owner,
 * 2026-11-13, node-kind audit: the 58 scenario rows on a downstream's site
 * named `actors/admin.json` and linked nothing).
 */
export const SUBJECT_ROWS: Readonly<Record<string, readonly SubjectRows[]>> = {
  // `<id>.library.json`, minted `softwareLibrary/<id>` (`software-library-nodes.ts`).
  // Its page is the node-kind page `gen-node-kind-pages` writes: the kind's
  // validator nodes are declared by the harness that declares this
  // visualiser, so the page is a sibling of it, `<locale>/<harness>/<kind>/`.
  [SOFTWARE_LIBRARY_KIND]: [
    {
      kind: SOFTWARE_LIBRARY_SUBJECT_KIND,
      id: (r) => (r.file.endsWith(SOFTWARE_LIBRARY_SUFFIX) && !r.file.includes("/") ? r.file.slice(0, -SOFTWARE_LIBRARY_SUFFIX.length) : undefined),
      page: (r, instance, layerPath) => `../../${SOFTWARE_LIBRARY_KIND}/${instance}/${posix.join(layerPath, r.file.replace(/\.json$/, ""))}/`,
    },
  ],
  scenarios: [
    { dir: "actors", kind: "actor" },
    { dir: "capabilities", kind: "capability" },
  ],
  attestations: [
    {
      kind: "attestation",
      id: (r) => (r.file.endsWith(ATTESTATIONS_SUFFIX) ? r.file.slice(0, -ATTESTATIONS_SUFFIX.length) : undefined),
      // `qa-attestations` is cat-harness-tools' kind (its `validators/` node,
      // beside the code that defines it), so its pages are under
      // `<locale>/cat-harness-tools/`, a sibling of this visualiser's harness.
      page: (r, instance, layerPath) => `../../../cat-harness-tools/${QaAttestationsKind.id}/${instance}/${posix.join(layerPath, r.file.replace(/\.json$/, ""))}/`,
    },
  ],
};

/**
 * `rows` with each subject's IRI ({@link SUBJECT_ROWS}), minted by `iriOf`
 * from the node's file, kind and id, and its page where the kind has one.
 * `layerPath` is the listed directory's path under its layer's root, the
 * prefix of a node's path on its page.
 */
export function withSubjectIris(
  rows: readonly RegistryRow[],
  absPath: string,
  kinds: readonly string[],
  iriOf: (file: string, kind: string, id: string) => string | undefined = subjectIri,
  where: { instance: string; layerPath: string } | undefined = undefined,
): RegistryRow[] {
  const rules = kinds.flatMap((k) => SUBJECT_ROWS[k] ?? []);
  return rows.map((r) => {
    const at = rules.find((x) => (x.dir === undefined ? true : r.file.startsWith(`${x.dir}/`) && !r.file.slice(x.dir.length + 1).includes("/")));
    if (at === undefined || r.note !== undefined) return r;
    const id = at.id ? at.id(r) : r.id;
    if (id === undefined) return r;
    const iri = iriOf(join(absPath, r.file), at.kind, id);
    const page = where && at.page ? at.page(r, where.instance, where.layerPath) : undefined;
    return { ...r, ...(iri !== undefined ? { iri } : {}), ...(page !== undefined ? { page } : {}) };
  });
}

/** Every `.json` node under a registry directory, in path order. Absent is an empty list; the page says unknown from the projection. */
export function registryRowsOf(absPath: string): RegistryRow[] {
  const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);
  return jsonFilesIn(absPath, NODE_EXTENSIONS)
    .map((p) => relative(absPath, p).split(sep).join("/"))
    .sort()
    .map((file): RegistryRow => {
      const stem = basename(file).replace(/\.json(ld)?$/, "");
      let doc: unknown;
      try {
        doc = JSON.parse(readFileSync(join(absPath, file), "utf-8"));
      } catch {
        return { file, id: stem, note: "does not parse as JSON" };
      }
      if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return { file, id: stem, note: "not a JSON object" };
      const r = doc as Record<string, unknown>;
      // An attestation names no id or title of its own: its id is its path in
      // the store, and its words are what it judges (`attestation-nodes.ts`).
      if (r["$schema"] === QA_ATTESTATIONS_SCHEMA && file.endsWith(ATTESTATIONS_SUFFIX)) {
        const sub = r["subject"] as { kind?: unknown; id?: unknown; path?: unknown } | undefined;
        const subject = sub && typeof sub.kind === "string" && typeof sub.id === "string" ? { kind: sub.kind, id: sub.id, path: typeof sub.path === "string" ? sub.path : null } : undefined;
        return { file, schema: QA_ATTESTATIONS_SCHEMA, id: file.slice(0, -ATTESTATIONS_SUFFIX.length), text: describeAttestation(String(r["family"] ?? ""), subject).title };
      }
      // A library names a package, not a title: its row reads `name@version` (`software-library-nodes.ts`).
      if (typeof r["$schema"] === "string" && r["$schema"].startsWith(`${SOFTWARE_LIBRARY_KIND}/`) && file.endsWith(SOFTWARE_LIBRARY_SUFFIX)) {
        return { file, schema: r["$schema"], id: file.slice(0, -SOFTWARE_LIBRARY_SUFFIX.length), text: describeLibrary(r, file).title };
      }
      const text = str(r["title"]) ?? str(r["label"]) ?? str(r["summary"]) ?? str(r["description"]) ?? str(r["rationale"]);
      return {
        file,
        ...(str(r["$schema"]) ? { schema: str(r["$schema"]) } : {}),
        id: str(r["id"]) ?? str(r["name"]) ?? str(r["kind"]) ?? str(r["slot"]) ?? stem,
        ...(text ? { text: text.length > 160 ? `${text.slice(0, 159)}\u2026` : text } : {}),
      };
    });
}

/** The node table of a registry page. */
export function registryTable(rows: readonly RegistryRow[]): string {
  if (rows.length === 0) return "";
  // A JSON-LD column only where some node has an IRI, so a registry with none keeps its shape.
  const linked = rows.some((r) => r.iri !== undefined);
  const tr = rows
    .map(
      (r) =>
        `<tr><td>${(r.page ?? r.iri) ? `<a href="${esc(r.page ?? r.iri!)}"><code>${esc(r.id)}</code></a>` : `<code>${esc(r.id)}</code>`}</td><td>${esc(r.note ?? r.text ?? "")}</td>` +
        `<td>${r.schema ? `<code>${esc(r.schema)}</code>` : ""}</td><td><code>${esc(r.file)}</code></td>` +
        (linked ? `<td>${r.iri ? `${r.page ? `<a href="${esc(r.iri)}">IRI</a> · ` : ""}<a href="${esc(r.iri)}.jsonld" type="application/ld+json">.jsonld</a>` : ""}</td>` : "") +
        `</tr>`,
    )
    .join("");
  return (
    `<h2 class="sv-h2">Nodes — ${rows.length}</h2>` +
    `<div style="overflow-x:auto"><table class="sv-table"><thead><tr><th>id</th><th>title or summary</th><th>$schema</th><th>file</th>${linked ? "<th>JSON-LD</th>" : ""}</tr></thead>` +
    `<tbody>${tr}</tbody></table></div>`
  );
}

/**
 * `<base>/<harness>/<vis>/` for a per-instance visualiser that no state graph
 * draws (the registry kinds are not state): the list of instances, so the
 * "every instance's …" link from each layer page has somewhere to go.
 */
export function instanceHubPage(vis: { id: string; title?: string }, subjects: readonly InstanceSubject[]): string {
  const title = vis.title ?? vis.id;
  const items = subjects.map((s) => `<li><a href="${esc(s.name)}/">${esc(s.name)}</a> · <code>${esc(s.path)}</code></li>`).join("");
  return page({
    title,
    noLiquid: true,
    body:
      `<h1 id="${esc(vis.id)}">${esc(title)}</h1>` +
      `<p class="sv-sub">One page per instance in this checkout holding a directory of this kind.</p>` +
      `<ul class="sv-list">${items}</ul>`,
  });
}

/**
 * Whether a per-instance visualiser's OWN route gets {@link instanceHubPage}:
 * when no state dashboard draws it, it has layer pages, and its kinds are
 * not state — a registry, or `code`. Without it `en/cat-harness/code/` had a
 * page per layer and none at its own route, which `site-coverage.ts`
 * refuses (dth-hrh and a DAK IG, 2026-10-15).
 */
export function drawsInstanceHub(kinds: readonly string[], drawnByDashboard: boolean, subjects: number): boolean {
  if (drawnByDashboard || subjects === 0 || kinds.length === 0) return false;
  return kinds.every((k) => k === "code") || kinds.every((k) => REGISTRY_KINDS.has(k)) || kinds.every((k) => MEMORY_KINDS.has(k));
}

/**
 * The kinds a declared `memory/` directory holds (`cat-harness.json`): agent
 * lessons (`folio-memory/v1`, front matter on a `.md`), the `interaction`
 * node and any `folio-waiver/v1` waivers (JSON), told apart by `$schema`.
 * `context`, not state, so no dashboard draws them: each layer holding one
 * gets a page listing its nodes, and the visualiser's route gets the hub.
 * Until this, memory was the library page's last "no viewer yet" row.
 */
export const MEMORY_KINDS: ReadonlySet<string> = new Set(["memory", "waiver", "interaction"]);

/** One node of a memory directory, as its layer page lists it. */
export interface MemoryRow {
  /** Path under the declared directory. */
  file: string;
  schema?: string;
  /** The node's `id`, else the file stem. */
  id: string;
  /** Its `summary`, `title` or `description`, clipped. */
  text?: string;
  /** A lesson's `label` (`stable`, `trap`, `baseline`). */
  label?: string;
  archived?: boolean;
  /** Why the file is not listed with its fields. */
  note?: string;
}

/**
 * Every node under a memory directory, in path order: each `.md` by its front
 * matter and each `.json` by its fields. A `README.md` is the directory's own
 * page, not a node. Absent is `null`, which the page says is unknown.
 */
export function memoryRowsOf(absPath: string): MemoryRow[] | null {
  if (!existsSync(absPath)) return null;
  const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);
  const clip = (t: string | undefined): string | undefined => (t && t.length > 160 ? `${t.slice(0, 159)}\u2026` : t);
  const files = [
    ...jsonFilesIn(absPath),
    ...readdirSync(absPath)
      .filter((f) => f.endsWith(".md") && f !== "README.md" && !f.startsWith("."))
      .map((f) => join(absPath, f)),
  ]
    .map((p) => relative(absPath, p).split(sep).join("/"))
    .sort();
  return files.map((file): MemoryRow => {
    const stem = basename(file).replace(/\.(md|json)$/, "");
    let r: Record<string, unknown>;
    try {
      const text = readFileSync(join(absPath, file), "utf-8");
      if (file.endsWith(".md")) {
        r = parseFrontMatter(text).fm as Record<string, unknown>;
      } else {
        const doc: unknown = JSON.parse(text);
        if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return { file, id: stem, note: "not a JSON object" };
        r = doc as Record<string, unknown>;
      }
    } catch {
      return { file, id: stem, note: file.endsWith(".md") ? "could not be read" : "does not parse as JSON" };
    }
    const text = clip(str(r["summary"]) ?? str(r["title"]) ?? str(r["description"]));
    const archived = r["archived"] === true || r["archived"] === "true";
    return {
      file,
      ...(str(r["$schema"]) ? { schema: str(r["$schema"]) } : {}),
      id: str(r["id"]) ?? stem,
      ...(text ? { text } : {}),
      ...(str(r["label"]) ? { label: str(r["label"]) } : {}),
      ...(archived ? { archived: true } : {}),
    };
  });
}

/**
 * `<base>/<harness>/<vis>/<instance>/` — one layer's memory: every lesson,
 * the interaction node and any waivers, each linked to its file on GitHub at
 * the pinned commit when the layer is a pinned mount. Not run through
 * Liquid, since a lesson's summary is authored text.
 */
export function memorySubjectPage(
  vis: { id: string; title?: string },
  s: InstanceSubject,
  subjects: readonly InstanceSubject[],
  blobBase: string | undefined,
  rows: MemoryRow[] | null = memoryRowsOf(s.absPath),
): string {
  const title = vis.title ?? "Memory";
  const others = subjects
    .map((o) =>
      o.name === s.name
        ? `<li><span class="sv-here">${esc(o.name)}</span></li>`
        : `<li><a href="../${esc(o.name)}/">${esc(o.name)}</a></li>`,
    )
    .join("");
  const base = s.path.replace(/^\.\//, "").replace(/\/+$/, "");
  const href = (f: string): string => {
    const p = base ? `${base}/${f}` : f;
    return blobBase ? `${blobBase}${p.split("/").map(encodeURIComponent).join("/")}` : "";
  };
  let body: string;
  if (rows === null) {
    body =
      `<h2 class="sv-h2">Not available in this build</h2>` +
      `<p class="sv-sub"><code>${esc(s.path)}</code> of ${esc(s.name)} is not in this build, so its memory is ` +
      `<strong>unknown</strong>, not empty.</p>`;
  } else {
    const lessons = rows.filter((r) => r.schema === "folio-memory/v1");
    const archived = lessons.filter((r) => r.archived).length;
    const tr = rows
      .map((r) => {
        const u = href(r.file);
        const file = u ? `<a href="${esc(u)}"><code>${esc(r.file)}</code></a>` : `<code>${esc(r.file)}</code>`;
        const status = r.archived ? "archived" : (r.label ?? "");
        return (
          `<tr><td><code>${esc(r.id)}</code></td><td>${esc(r.note ?? r.text ?? "")}</td><td>${esc(status)}</td>` +
          `<td>${r.schema ? `<code>${esc(r.schema)}</code>` : ""}</td><td>${file}</td></tr>`
        );
      })
      .join("");
    body =
      `<p class="sv-sub">${lessons.length} lesson${lessons.length === 1 ? "" : "s"}` +
      (archived > 0 ? ` (${archived} archived)` : "") +
      `, ${rows.length - lessons.length} other node${rows.length - lessons.length === 1 ? "" : "s"}. ` +
      (blobBase ? "Files open on GitHub at the commit this site was built from." : "This instance is not a pinned mount here, so files are listed without links.") +
      `</p>` +
      (rows.length === 0
        ? `<p class="sv-sub">The directory is on disk and holds no node.</p>`
        : `<h2 class="sv-h2">Nodes — ${rows.length}</h2>` +
          `<div style="overflow-x:auto"><table class="sv-table"><thead><tr><th>id</th><th>summary</th><th>label</th><th>$schema</th><th>file</th></tr></thead>` +
          `<tbody>${tr}</tbody></table></div>`);
  }
  return page({
    title: `${s.name} — ${title}`,
    noLiquid: true,
    body:
      `<h1 id="${esc(vis.id)}-${esc(s.name)}">${esc(title)}: ${esc(s.name)}</h1>` +
      `<p class="sv-sub">${esc(s.name)} · ${esc(s.path)} · <a href="../">every instance's ${esc(title)}</a></p>` +
      body +
      `<h2 class="sv-h2">Instances holding ${esc(title)}</h2>` +
      `<ul class="sv-list">${others}</ul>`,
  });
}

/**
 * The kinds that make up ONE bean store: the store (`beans`) and the parts its
 * `beans.json` declares from within — work items, PR addenda, running BPMN
 * instances (bean `folio-assistant-750a`), the merge steward's decisions
 * (bean `folio-assistant-30jr`), published session surveys and sweep marks. A
 * visualiser covering any of them draws the store's page, which lists them
 * all; see {@link beanStorePartsSection}.
 */
export const BEAN_STORE_KINDS: ReadonlySet<string> = new Set([
  "beans",
  "bean-defs",
  "bean-notes",
  "workflow-state",
  "merge-queue",
  "session-survey",
  "sweep-marks",
]);

/**
 * One store part's directories, read from the store's own declaration —
 * `beans.json`, or `todos.json` for the todo graph's parts.
 */
function storePartDirs(storeAbs: string, kind: string, declFile = "beans.json"): string[] {
  let decl: { directories?: Array<{ path?: string; graphTypologies?: string[] }> };
  try {
    decl = JSON.parse(readFileSync(join(storeAbs, declFile), "utf-8"));
  } catch {
    return [];
  }
  return (decl.directories ?? [])
    .filter((d) => typeof d.path === "string" && (d.graphTypologies ?? []).includes(kind))
    .map((d) => join(storeAbs, d.path!));
}

/** The files of `ext` in `dirs`, sorted; a missing directory contributes none. */
function filesIn(dirs: readonly string[], ext: string): string[] {
  const out: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(ext) && f !== "README.md") out.push(join(dir, f));
  }
  return out.sort((a, b) => basename(a).localeCompare(basename(b)));
}

/**
 * The bean store's two other parts, server-side: its PR addenda (`bean-notes`,
 * `<bean>--<date>--<branch>.md`) and its running BPMN instances
 * (`workflow-state`, `folio-workflow-instance/v1`). Bean
 * `folio-assistant-750a`: both are declared inside `beans/beans.json`, so the
 * store's page is their viewer, and it must SHOW them rather than only be
 * linked from their rows. Where an instance is is read from its own `tokens`;
 * this page keeps no second idea of position.
 */
export function beanStorePartsSection(storeAbs: string, view?: WorkflowViewContext): string {
  const notes = filesIn(storePartDirs(storeAbs, "bean-notes"), ".md");
  const noteRows = notes
    .map((f) => {
      const [bean = "", date = "", ...branch] = basename(f, ".md").split("--");
      return `<tr><td><code>${esc(bean)}</code></td><td>${esc(date)}</td><td>${esc(branch.join("--"))}</td></tr>`;
    })
    .join("");
  const flows = readInstances(filesIn(storePartDirs(storeAbs, "workflow-state"), ".json"));
  // The stuck column and the per-instance links only where the page was given
  // the context to compute them (bean `folio-assistant-v49e`): without the
  // store's beans and a reference time the column would be a guess.
  const flowRows = flows
    .map((r) => {
      if ("bad" in r) return `<tr><td><code>${esc(basename(r.file))}</code></td><td colspan="${view ? 5 : 4}">${esc(r.bad)}</td></tr>`;
      const w = r.state;
      const at = w.tokens.map(String).join(", ");
      const id = view && ROUTE_SEGMENT.test(w.id) ? `<a href="workflows/${esc(w.id)}/"><code>${esc(w.id)}</code></a>` : `<code>${esc(w.id)}</code>`;
      const stuck = view ? `<td>${stuckCell(stuckStatesOf(w, view.beans, view.now, view.ends?.get(w.id)))}</td>` : "";
      return (
        `<tr><td>${id}</td><td>${esc(w.processId ?? "")}</td>` +
        `<td>${esc(w.status ?? "")}</td><td>${esc(at)}</td><td>${esc(w.bean ?? "")}</td>${stuck}</tr>`
      );
    })
    .join("");
  const instances = flows.flatMap((r) => ("state" in r ? [r.state] : []));
  const queue = mergeQueueSection(filesIn(storePartDirs(storeAbs, "merge-queue"), ".json"));
  const surveys = sessionSurveySection(filesIn(storePartDirs(storeAbs, "session-survey"), ".json"));
  const marks = sweepMarkSection(filesIn(storePartDirs(storeAbs, "sweep-marks"), ".json"));
  // In a raw block: the page is Liquid-rendered, and branch names, ids and
  // token names are data nobody screened for `{{`.
  return wrapRaw(
    `<h2 class="sv-h2" id="bean-notes">Bean notes — ${notes.length}</h2>` +
    (notes.length === 0
      ? `<p class="sv-sub">No pull-request addenda in this store.</p>`
      : `<table><thead><tr><th>bean</th><th>date</th><th>branch</th></tr></thead><tbody>${noteRows}</tbody></table>`) +
    `<h2 class="sv-h2" id="workflow-state">Workflow instances — ${flows.length}</h2>` +
    (flows.length === 0
      ? `<p class="sv-sub">No BPMN instance recorded in this store.</p>`
      : (view ? workflowViewLead(view) : "") +
        `<table><thead><tr><th>id</th><th>process</th><th>status</th><th>at</th><th>bean</th>${view ? "<th>stuck</th>" : ""}</tr></thead><tbody>${flowRows}</tbody></table>`) +
    (view ? beanPositionSection(view.beans, instances) : "") +
    (view?.unlinked ?? "") +
    queue +
    surveys +
    marks,
  ).join("\n");
}

/**
 * What the workflow view (bean `folio-assistant-v49e`) needs beyond a store's
 * files: the store's beans, for the bean-side stuck states, and the reference
 * time the age-based ones are measured against. Given by the caller, so the
 * section renders the same for the same inputs.
 */
export interface WorkflowViewContext {
  beans: readonly BeanNode[];
  now: Date;
  /** Each instance's end events, by instance id, where its diagram was found. */
  ends?: ReadonlyMap<string, ReadonlySet<string>>;
  /** The store's unlinked-beans QA section (bean `folio-assistant-w2hn`), rendered by `unlinked-beans.ts`. */
  unlinked?: string;
}

/** A row's stuck states as words — a state is told by its WORD, never by hue. */
function stuckCell(states: readonly StuckState[]): string {
  if (states.length === 0) return "none found";
  return [...new Set(states.map((x) => x.kind))].map((k) => `<span class="sv-tag is-stuck">${esc(k)}</span>`).join(" ");
}

/** The sentence above the instance table: what "stuck" was measured against, and what is not recorded. */
function workflowViewLead(view: WorkflowViewContext): string {
  return (
    `<p class="sv-sub">Each instance opens its own view: the diagram with the token highlighted, the history, and ` +
    `the beans and todos its steps name. <strong>stuck</strong> lists the states read from committed data, ages ` +
    `measured on ${esc(dayOf(view.now))} (UTC, the day this page was built) against a ${STUCK_AFTER_DAYS}-day ` +
    `threshold. A gate the engine refused since the instance last moved is <code>refused-gate</code>; ${esc(GATE_REFUSALS.why)}</p>`
  );
}

/**
 * Every bean of the store against the instance set, in three states — named by
 * a running instance, only by finished ones, or by NONE. The third is the
 * common case (bean `v49e`: 2 instances against 232 beans), so it is a state
 * with a reason and a list, never an empty lane or a zero.
 */
function beanPositionSection(beans: readonly BeanNode[], instances: readonly InstanceState[]): string {
  const pos = beanPositions(beans, instances);
  const of = (state: BeanPosition["state"]) => beans.filter((b) => pos.get(b.id)?.state === state);
  const running = of("running");
  const finished = of("finished");
  const none = of("none");
  const known = new Set(beans.map((b) => b.id));
  const elsewhere = [...new Set(instances.flatMap(beansNamedBy))].filter((id) => !known.has(id)).sort();
  const named = (list: readonly BeanNode[]) =>
    list
      .map((b) => {
        const p = pos.get(b.id);
        const ins = p && p.state !== "none" ? p.instances.map((i) => (ROUTE_SEGMENT.test(i) ? `<a href="workflows/${esc(i)}/">${esc(i)}</a>` : esc(i))).join(", ") : "";
        return `<tr><td><code>${esc(b.id)}</code></td><td>${esc(b.title)}</td><td>${esc(b.status)}</td><td>${ins}</td></tr>`;
      })
      .join("");
  const table = (list: readonly BeanNode[]) =>
    `<table><thead><tr><th>bean</th><th>title</th><th>status</th><th>instance</th></tr></thead><tbody>${named(list)}</tbody></table>`;
  const openNone = none.filter(isOpen);
  return (
    `<h2 class="sv-h2" id="bean-position">Where this store's beans sit in a process — ${beans.length} bean(s)</h2>` +
    `<ul class="sv-counts">` +
    `<li class="sv-count"><span class="sv-count-v">${running.length}</span><span class="sv-count-k">in an instance not completed</span></li>` +
    `<li class="sv-count"><span class="sv-count-v">${finished.length}</span><span class="sv-count-k">only in finished ones</span></li>` +
    `<li class="sv-count"><span class="sv-count-v">${none.length}</span><span class="sv-count-k">no instance recorded</span></li>` +
    `</ul>` +
    (running.length > 0 ? table(running) : "") +
    (finished.length > 0 ? `<details><summary>${finished.length} bean(s) named only by finished instances</summary>${table(finished)}</details>` : "") +
    `<p class="sv-sub"><strong>No instance recorded</strong> for ${none.length} bean(s): ${esc(NO_INSTANCE_REASON)}. ` +
    `That is a third state, not an empty diagram — there is no position to draw.</p>` +
    (openNone.length > 0
      ? `<details><summary>${openNone.length} open bean(s) with no instance recorded</summary>` +
        `<ul>${openNone.map((b) => `<li><code>${esc(b.id)}</code> ${esc(b.title)} (${esc(b.status)})</li>`).join("")}</ul></details>`
      : "") +
    (elsewhere.length > 0
      ? `<p class="sv-sub">Named by an instance here and <strong>not in this store</strong>: ${elsewhere.map((id) => `<code>${esc(id)}</code>`).join(", ")}.</p>`
      : "")
  );
}

/** The diagram an instance level was drawn from, as the page needs it. */
export type ModelRead =
  | { model: ProcessModel; source: string; recorded: string; moved: boolean }
  | { missing: string; recorded: string };

/** One instance's view, and everything it is drawn from. */
export interface WorkflowInstanceView {
  instance: InstanceState;
  /** The bean store's layer name — the page's subgraph segment. */
  store: string;
  model: ModelRead;
  /** The store's beans, or null when the store could not be read. */
  beans: readonly BeanNode[] | null;
  todos: readonly TodoLike[];
  now: Date;
  /** The published drawing for a `.bpmn` path, page-relative, or undefined when none is published. */
  drawingFor: (bpmn: string) => string | undefined;
  /** The processes viewer's page for a `.bpmn` path, page-relative, or undefined when none is declared. */
  processPageFor?: (bpmn: string) => string | undefined;
  /** The role graph lanes bind, when one was found: the working context's roles and skills. */
  roles?: RoleGraph;
  /** Every instance's memory nodes, when read: joined to each step by role. */
  memory?: readonly MemoryNode[];
  /** The dynamic-state document (`<site>/<harness>/state.jsonld`), relative to this page; the page reads it when it loads. */
  stateDocument?: string;
}

/** The workflow pages' own styles: the token and the steps done, over the published drawing. */
const WV_CSS = `.wv-diagram { margin: 0.6rem 0 1.2rem; overflow-x: auto; }
.wv-diagram svg { max-width: 100%; height: auto; }
.wv-diagram[data-wv-svg]:not(.wv-drawn) { min-height: 20rem; }
.wv-diagram .wv-token .djs-visual > :first-child { stroke: #c62828 !important; stroke-width: 5px !important; }
.wv-diagram .wv-done .djs-visual > :first-child { stroke-dasharray: 6 3; }
.sv-tag.is-stuck { border: 1px solid currentColor; border-radius: 4px; padding: 0 0.3rem; }`;

/**
 * Inlines each published drawing and marks the steps by their BPMN ids. The
 * drawing is fetched rather than embedded, so the page stays thin and the
 * drawing stays the one `render:bpmn` publishes; links inside it are written
 * relative to the SVG file, so they are re-anchored to its URL here.
 *
 * Lazy on screen, complete in print (owner, 2026-11-14: "do lazy load content
 * and libs"; "make sure printing loads all of the content before it renders
 * the PDF on the browser"; cat-harness `skills/ui/ui-core/web-apps.md`). Each
 * drawing is fetched as it nears the viewport (an IntersectionObserver), or
 * when the closed `<details>` holding it is opened; a hidden tab panel is not
 * intersecting until it is shown, so it waits the same way. With no observer,
 * every drawing is fetched at load, as before. A figure not yet drawn keeps
 * a drawing's room (`min-height`), so the figures below it start out of
 * reach rather than stacked at its edge. Printing fetches them all:
 * `beforeprint` opens what holds a drawing and starts every fetch, Ctrl/Cmd+P
 * waits for them before it prints, and `window.wvPrintPrep()` is the promise a
 * Print button waits on. `afterprint` closes again what was opened. The
 * library entry page's `docPrintPrep` is the worked example.
 */
export const WV_SCRIPT = `<script>
(function () {
  var figs = Array.prototype.slice.call(document.querySelectorAll("[data-wv-svg]"));
  var load = function (f) {
    if (f.wvLoad) return f.wvLoad;
    var url = new URL(f.getAttribute("data-wv-svg"), document.baseURI);
    return (f.wvLoad = fetch(url).then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); }).then(function (text) {
      var svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== "svg") return;
      svg.querySelectorAll("script").forEach(function (s) { s.remove(); });
      svg.querySelectorAll("a").forEach(function (a) {
        ["href", "xlink:href"].forEach(function (k) {
          var h = a.getAttribute(k);
          if (h) a.setAttribute(k, new URL(h, url).href);
        });
      });
      var mark = function (attr, cls) {
        JSON.parse(f.getAttribute(attr) || "[]").forEach(function (id) {
          svg.querySelectorAll('[data-element-id="' + CSS.escape(id) + '"]').forEach(function (e) { e.classList.add(cls); });
        });
      };
      mark("data-wv-done", "wv-done");
      mark("data-wv-tokens", "wv-token");
      f.replaceChildren(document.importNode(svg, true));
    }).catch(function () {}).then(function () { f.classList.add("wv-drawn"); }));
  };
  var io = typeof IntersectionObserver === "function" ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); load(e.target); } });
  }, { rootMargin: "300px 0px" }) : null;
  figs.forEach(function (f) { if (io) io.observe(f); else load(f); });
  document.addEventListener("toggle", function (ev) {
    var d = ev.target;
    if (d && d.open && d.querySelectorAll) d.querySelectorAll("[data-wv-svg]").forEach(load);
  }, true);
  var opened = [];
  var prep = function () {
    figs.forEach(function (f) {
      for (var d = f.parentElement; d; d = d.parentElement)
        if (d.tagName === "DETAILS" && !d.open) { d.open = true; opened.push(d); }
    });
    return Promise.all(figs.map(load));
  };
  window.wvPrintPrep = prep;
  window.addEventListener("beforeprint", function () { prep(); });
  window.addEventListener("afterprint", function () {
    opened.forEach(function (d) { d.open = false; });
    opened = [];
  });
  // A print started from the keyboard waits for every drawing; the browser's
  // menu print gets what beforeprint could fetch by then.
  document.addEventListener("keydown", function (ev) {
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && (ev.key === "p" || ev.key === "P")) {
      ev.preventDefault();
      prep().then(function () { window.print(); });
    }
  });
  // The dynamic-state document (bean 6h47): the instance as the latest render
  // exported it. Shown beside what this page was built with, and any
  // difference is named, so a page older than the export says so.
  document.querySelectorAll("[data-wv-state]").forEach(function (sec) {
    var out = sec.querySelector(".wv-live");
    var url = new URL(sec.getAttribute("data-wv-state"), document.baseURI);
    var want = sec.getAttribute("data-wv-instance");
    var built = JSON.parse(sec.getAttribute("data-wv-built") || "{}");
    var text = function (t) { var p = document.createElement("p"); p.className = "sv-sub"; p.textContent = t; return p; };
    fetch(url).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (doc) {
      var node = (doc.graph || []).filter(function (n) { return n.id === want; })[0];
      if (!node) {
        var store = want.split("/")[1];
        out.replaceChildren(text((doc.unreadStores || []).indexOf(store) >= 0
          ? "The state document (generated " + doc.generatedAt + ") could not read this instance's store, so its exported state is unknown."
          : "The state document (generated " + doc.generatedAt + ") does not list this instance."));
        return;
      }
      var kinds = (node.stuck || []).map(function (x) { return x.kind; }).sort();
      var parts = [
        text("From state.jsonld, generated " + doc.generatedAt + ": status " + node.status + ", token at " +
          ((node.tokens || []).join(", ") || "no step") + ", stuck states: " + (kinds.join(", ") || "none") + "."),
      ];
      var same = JSON.stringify(kinds) === JSON.stringify((built.stuck || []).slice().sort()) &&
        JSON.stringify(node.tokens || []) === JSON.stringify(built.tokens || []) && node.status === built.status;
      parts.push(text(same ? "This matches what the page was built with." :
        "This differs from what the page was built with (" + (built.at || "unknown") + "): the page is older than the state export."));
      out.replaceChildren.apply(out, parts);
    }).catch(function (e) {
      out.replaceChildren(text("The state document could not be read (" + e + "), so only the build-time state above is known."));
    });
  });
})();
</script>`;

/** A process id, linked to its page in the processes viewer where there is one. */
function processLink(id: string, href: string | undefined): string {
  return href ? `<a href="${esc(href)}" title="the process page"><code>${esc(id)}</code></a>` : `<code>${esc(id)}</code>`;
}

/** The sub-graph route of an instance page under its store's page: `<store>/workflows/<id>`. */
export function workflowSubgraph(store: string, id: string): string {
  return `${store}/workflows/${id}`;
}

/**
 * Every workflow instance page this generator draws in the checkout at
 * `root`, as other pages link it (the processes viewer, bean `v49e`
 * follow-up: "how does a user navigate there? from processes/?"). The same
 * selection `drawWorkflows` makes — a per-instance beans visualiser covering
 * `workflow-state`, a readable store, an id that is a URL segment — so a link
 * never names a page that run does not write. Routes are site-relative, from
 * `visualiserRoute`. `unread` names the stores that could not be read here,
 * whose instances are unknown rather than none.
 */
export function workflowInstanceLinks(root: string = ROOT): { links: InstanceLink[]; unread: string[] } {
  const decl = readDeclaration(root);
  if (!decl) return { links: [], unread: [] };
  const harness = decl.name ?? basename(root);
  const out: InstanceLink[] = [];
  const unread: string[] = [];
  const viewers = (decl.visualisers ?? []).filter(
    (v) => v.renderedBy === VIEWER_TOOL && v.subgraphs === "instance" && (v.coversKinds ?? []).includes("workflow-state"),
  );
  for (const v of viewers) {
    const { beans, subjects } = perInstanceSubjects(v, root, harness);
    if (!beans) continue;
    for (const s of subjects) {
      const read = readSubjectBeans(s.instanceRoot);
      if (!("beans" in read) || read.beans === null) {
        // Not drawn by `drawWorkflows` either; named so a reader is not told "none".
        if ("unreachable" in read) unread.push(s.name);
        continue;
      }
      for (const r of readInstances(filesIn(storePartDirs(s.absPath, "workflow-state"), ".json"))) {
        if (!("state" in r) || !ROUTE_SEGMENT.test(r.state.id)) continue;
        out.push({
          store: s.name,
          id: r.state.id,
          ...(r.state.status ? { status: r.state.status } : {}),
          processIds: [...processIdsOf(r.state)],
          route: visualiserRoute(pageParts({ harness, visualiser: v.id, subgraph: workflowSubgraph(s.name, r.state.id) })),
        });
      }
    }
  }
  return { links: out, unread };
}

/**
 * What the dynamic-state document is built from (bean 6h47): every workflow
 * instance `workflowInstanceLinks` names, with its store's beans and its
 * diagram's end events, so its stuck states are the ones its page shows.
 * Read from the same resolved checkout, so the document and the pages never
 * disagree about which instances exist.
 */
export async function dynamicStateInputs(root: string = ROOT): Promise<{ harness: string; inputs: DynamicStateInput[]; unread: string[] }> {
  const decl = readDeclaration(root);
  const harness = decl?.name ?? basename(root);
  if (!decl) return { harness, inputs: [], unread: [] };
  const inputs: DynamicStateInput[] = [];
  const unread: string[] = [];
  const seen = new Set<string>();
  const viewers = (decl.visualisers ?? []).filter(
    (v) => v.renderedBy === VIEWER_TOOL && v.subgraphs === "instance" && (v.coversKinds ?? []).includes("workflow-state"),
  );
  for (const v of viewers) {
    const { beans, subjects } = perInstanceSubjects(v, root, harness);
    if (!beans) continue;
    for (const s of subjects) {
      const read = readSubjectBeans(s.instanceRoot);
      if (!("beans" in read) || read.beans === null) {
        if ("unreachable" in read) unread.push(s.name);
        continue;
      }
      const ends = endsOf(await workflowModelsOf(s));
      for (const r of readInstances(filesIn(storePartDirs(s.absPath, "workflow-state"), ".json"))) {
        if (!("state" in r) || !ROUTE_SEGMENT.test(r.state.id)) continue;
        const key = `${s.name}/${r.state.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        inputs.push({
          store: s.name,
          state: r.state,
          beans: read.beans,
          ends: ends.get(r.state.id),
          page: visualiserRoute(pageParts({ harness, visualiser: v.id, subgraph: workflowSubgraph(s.name, r.state.id) })),
        });
      }
    }
  }
  return { harness, inputs, unread };
}

/** Where THIS run publishes it: the same site and harness the workflow pages are drawn for, so their relative link holds. */
export function dynamicStateTarget(): string {
  return dynamicStatePath(SITE, harnessOf());
}

/**
 * Build the dynamic-state document from this checkout and write it to `out`:
 * the one writer, shared by render stage 3 (`dynamic-state-export.ts`) and by
 * this generator whenever it draws a workflow page that links the document.
 *
 * Why the generator writes it too: a workflow page links
 * `<site>/<harness>/state.jsonld`, and only `render-pipeline.ts` ran stage 3,
 * so a site built any other way — a layer site (`build-instance-site.ts`,
 * which runs this generator as a declared visualiser writer) — published pages
 * linking a file it never wrote, and its link gate refused the publish
 * (smart-ra, cat-harness-tools 9326f5d onward). The page's writer now
 * guarantees its own link target; stage 3 still rewrites it afterwards, once
 * every stage-2 renderer has contributed.
 */
export async function writeDynamicState(
  out: string = dynamicStateTarget(),
  opts: { root?: string; now?: Date } = {},
): Promise<{ doc: DynamicStateDocument; unread: string[]; out: string }> {
  const { harness, inputs, unread } = await dynamicStateInputs(opts.root ?? ROOT);
  // Published at `<canonicalUrl>/<harness>/state.jsonld`, the same place
  // `dynamicStateTarget` writes it under the site root.
  const canonical = readDeclaration(opts.root ?? ROOT)?.canonicalUrl;
  const docIri = canonical ? `${canonical.replace(/\/+$/, "")}/${harness}/${DYNAMIC_STATE_FILE}` : undefined;
  // input-site: traced #574cb84e — the wall clock stamped into the dynamic state document, unless the caller gives one: a run that reads it records no hash
  inputSiteReached("state-visualizer: dynamic state's time");
  const doc = dynamicStateDocument(harness, inputs, opts.now ?? new Date(), unread, docIri);
  const to = writePathOf(out);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, JSON.stringify(doc, null, 2) + "\n");
  return { doc, unread, out };
}

/**
 * The link a page in `pageDir` gives the dynamic-state document: relative to the
 * page, to the file {@link writeDynamicState} writes by default, so the two
 * cannot name different files.
 */
export function dynamicStateHref(pageDir: string, target: string = dynamicStateTarget()): string {
  return relative(pageDir, target).split(sep).join("/");
}

/** Where the dynamic-state document is published on `site`: `<site>/<harness>/state.jsonld`. */
export function dynamicStatePath(site: string, harness: string): string {
  return join(site, harness, DYNAMIC_STATE_FILE);
}

/** One diagram level: the drawing, or why there is none, and the position as words either way. */
function levelFigure(level: DiagramLevel, drawing: string | undefined, label: string, processPage?: string): string {
  const name = processPage ? `<a href="${esc(processPage)}"><code>${esc(level.processId)}</code></a>` : `<code>${esc(level.processId)}</code>`;
  const words =
    `<p class="sv-sub">${esc(label)} ${name}` +
    (level.phase.length > 0 ? ` inside ${level.phase.map((p) => `<code>${esc(p)}</code>`).join(" ▸ ")}` : "") +
    ` — token at ${level.tokens.length > 0 ? level.tokens.map((t) => `<code>${esc(t)}</code>`).join(", ") : "<strong>no step</strong>"}` +
    `; ${level.done.length} other step(s) in its history (drawn with a solid red outline and dashed, respectively).</p>`;
  if (drawing === undefined) {
    return words + `<p class="sv-sub">No drawing of ${level.source ? `<code>${esc(level.source)}</code>` : "this process"} is published, so the position is given in words only.</p>`;
  }
  return (
    words +
    `<figure class="wv-diagram" data-wv-svg="${esc(drawing)}" data-wv-tokens="${esc(JSON.stringify(level.tokens))}" data-wv-done="${esc(JSON.stringify(level.done))}">` +
    `<p><a href="${esc(drawing)}">The drawing</a> — the highlighted step needs JavaScript; the position above does not.</p></figure>`
  );
}

/**
 * `<base>/<harness>/beans/<store>/workflows/<instance>/` — one running
 * workflow instance: its diagram with the token highlighted (each running
 * subprocess followed in), its stuck states as states, the beans and todos
 * it names, and its history. Bean `folio-assistant-v49e`.
 */
export function workflowInstancePage(v: WorkflowInstanceView): string {
  const s = v.instance;
  const model = "model" in v.model ? v.model.model : undefined;
  const states = stuckStatesOf(s, v.beans ?? [], v.now, endNodesOf(model));
  const levels = diagramLevels(s, model);
  const diagrams = levels
    .map((l, i) =>
      levelFigure(l, l.source ? v.drawingFor(l.source) : undefined, i === 0 ? "Process" : "Subprocess", l.source ? v.processPageFor?.(l.source) : undefined),
    )
    .join("");
  const source =
    "missing" in v.model
      ? `<p class="sv-sub"><strong>Diagram not found</strong>: ${esc(v.model.missing)}. The position below is the instance's own record.</p>`
      : v.model.moved
        ? `<p class="sv-sub">The instance records <code>${esc(v.model.recorded)}</code>, which is not on disk; drawn from <code>${esc(v.model.source)}</code>, the file that declares <code>${esc(s.processId)}</code> now.</p>`
        : "";

  const stuck =
    `<h2 class="sv-h2" id="stuck">Stuck states — ${states.length}</h2>` +
    (states.length === 0
      ? `<p class="sv-sub">None found in committed data${s.status === "completed" ? " — the instance is completed" : ""}.</p>`
      : `<ul>${states.map((x) => `<li><span class="sv-tag is-stuck">${esc(x.kind)}</span> ${describe(x.detail)}</li>`).join("")}</ul>`) +
    `<p class="sv-sub">Measured on ${esc(dayOf(v.now))} (UTC), the day this page was built; a token unmoved for more than ` +
    `${STUCK_AFTER_DAYS} days is <code>enabled-not-taken</code>, and a step the engine refused since the instance last moved is <code>refused-gate</code>.</p>`;

  const refusals = s.refusals;
  const refusalPart =
    `<h2 class="sv-h2" id="refusals">Refused steps — ${refusals === undefined ? "not recorded" : refusals.length}</h2>` +
    (refusals === undefined
      ? `<p class="sv-sub">${esc(GATE_REFUSALS.why)}</p>`
      : refusals.length === 0
        ? `<p class="sv-sub">None recorded.</p>`
        : `<table><thead><tr><th>at</th><th>step asked for</th><th>actor</th><th>the engine's reason</th></tr></thead><tbody>${refusals
            .map((r) => `<tr><td>${esc(r.at)}</td><td><code>${esc(r.node)}</code></td><td>${esc(r.actor ?? "")}</td><td>${esc(r.reason)}</td></tr>`)
            .join("")}</tbody></table>`);

  const contexts = model ? workingContextOf(model, s, v.roles, v.memory ?? []) : [];
  const list = (xs: readonly string[], none: string): string =>
    xs.length === 0 ? none : xs.map((x) => `<code>${esc(x)}</code>`).join(", ");
  const contextPart =
    `<h2 class="sv-h2" id="context">Working context at the token</h2>` +
    (s.status === "completed"
      ? `<p class="sv-sub">The instance is completed, so no step holds a token.</p>`
      : model === undefined
        ? `<p class="sv-sub">Not computed: the diagram was not found.</p>`
        : contexts.length === 0
          ? `<p class="sv-sub">No step is enabled, so there is no working context to show.</p>`
          : contexts
              .map(
                (c) =>
                  `<h3><code>${esc([...c.phase, c.node].join(" ▸ "))}</code> ${esc(c.name)}</h3><ul>` +
                  `<li><strong>Role:</strong> ${c.role ? `<code>${esc(c.role)}</code>` : v.roles ? "the lane binds none" : "unknown: no role graph was found"}` +
                  (c.roleStack.length > 1 ? `; call path ${list(c.roleStack, "")}` : "") +
                  `</li><li><strong>Skills</strong> (the role's, closed over <code>inherits</code>, and the step's own): ${list(c.skills, "none")}</li>` +
                  `<li><strong>Conventions in force:</strong> ${list(c.conventions, "none")}</li>` +
                  `<li><strong>Beans the token carries:</strong> ${list(c.carriedBeans, "none")}</li>` +
                  `<li><strong>Memory for ${c.memoryRoles.length > 0 ? list(c.memoryRoles, "") : "no role"}:</strong> ` +
                  (v.memory === undefined
                    ? "not read"
                    : c.roleMemory.length === 0
                      ? "no entry is tagged with these roles"
                      : c.roleMemory.map((m) => `<code>${esc(m.id)}</code> (${esc(m.label)}) ${esc(m.summary)}`).join("; ")) +
                  (v.memory === undefined ? "" : `. Plus ${c.everyoneMemory} untagged entr${c.everyoneMemory === 1 ? "y" : "ies"} that reach every step.`) +
                  `</li></ul>`,
              )
              .join("")) +
    `<p class="sv-sub">Read from the engine's own task context. Memory is joined on the step's role and the roles it inherits; ` +
    `the call path's outer roles are not overlaid, which the memory schema leaves open on purpose. Archived entries reach nobody.</p>`;

  const logPart =
    `<p class="sv-sub">The history below is this instance's committed log. The activity log (<code>fsh-guts/logs/</code>) is ` +
    `git-ignored on the machine that ran each step, so it is not committed state and is not read here.</p>`;

  const byId = new Map((v.beans ?? []).map((b) => [b.id, b]));
  const steps = model ? beanStepsOf(model) : [];
  const beanRows = beansNamedBy(s)
    .map((id) => {
      const b = byId.get(id);
      const role = id === s.bean ? "the instance's bean" : "carried";
      return `<tr><td><code>${esc(id)}</code></td><td>${b ? esc(b.title) : v.beans === null ? "store not readable" : "not in this store"}</td><td>${b ? esc(b.status) : ""}</td><td>${role}</td></tr>`;
    })
    .join("");
  const beans =
    `<h2 class="sv-h2" id="beans">Beans it names</h2>` +
    (beanRows === ""
      ? `<p class="sv-sub">This instance names no bean (no <code>bean</code>, no <code>carriedBeans</code>).</p>`
      : `<table><thead><tr><th>bean</th><th>title</th><th>status</th><th>how</th></tr></thead><tbody>${beanRows}</tbody></table>`) +
    (model === undefined
      ? `<p class="sv-sub">The steps that act on the bean are unknown: the diagram was not found.</p>`
      : steps.length === 0
        ? `<p class="sv-sub">No step of this diagram carries a <code>folio:bean</code> operation.</p>`
        : `<p class="sv-sub">Steps that act on it (<code>folio:bean op</code>):</p><ul>${steps
            .map((x) => `<li><code>${esc(x.op)}</code> at <code>${esc([...x.phase, x.node].join(" ▸ "))}</code> ${esc(x.name)}${s.tokens.includes(x.node) ? " — <strong>the token is here</strong>" : ""}</li>`)
            .join("")}</ul>`);

  const todos = todosNamedBy(s, v.todos);
  const todoPart =
    `<h2 class="sv-h2" id="todos">Todos it names — ${todos.length}</h2>` +
    (todos.length === 0
      ? `<p class="sv-sub">No todo is tagged with this instance's processes or steps, or references a bean it names.</p>`
      : `<table><thead><tr><th>todo</th><th>summary</th><th>status</th><th>why</th></tr></thead><tbody>${todos
          .map((t) => `<tr><td><code>${esc(t.id)}</code></td><td>${esc(t.summary)}</td><td>${esc(t.status)}</td><td>${esc(t.why)}</td></tr>`)
          .join("")}</tbody></table>`);

  const NOTE_MAX = 400;
  const history =
    `<h2 class="sv-h2" id="history">History — ${s.history.length} step(s)</h2>` +
    (s.history.length === 0
      ? `<p class="sv-sub">No step recorded.</p>`
      : `<table><thead><tr><th>at</th><th>step</th><th>outcome</th><th>actor</th><th>note</th></tr></thead><tbody>${s.history
          .map((h) => {
            const note = h.note ?? "";
            const shown = note.length > NOTE_MAX ? `${note.slice(0, NOTE_MAX)}… (${note.length - NOTE_MAX} more characters in the instance file)` : note;
            return `<tr><td>${esc(h.at ?? "")}</td><td><code>${esc(h.node)}</code></td><td>${esc(h.outcome ?? "")}</td><td>${esc(h.actor ?? "")}</td><td>${esc(shown)}</td></tr>`;
          })
          .join("")}</tbody></table>`);

  // The page reads the dynamic-state document when it loads (bean 6h47).
  const livePart =
    v.stateDocument === undefined
      ? ""
      : `<section id="live" data-wv-state="${esc(v.stateDocument)}" data-wv-instance="${esc(`#workflow/${v.store}/${s.id}`)}" ` +
        `data-wv-built="${esc(JSON.stringify({ at: v.now.toISOString(), status: s.status ?? "unknown", tokens: s.tokens, stuck: states.map((x) => x.kind) }))}">` +
        `<h2 class="sv-h2">Latest exported state</h2>` +
        `<div class="wv-live"><p class="sv-sub">Read from <a href="${esc(v.stateDocument)}"><code>${DYNAMIC_STATE_FILE}</code></a> when the page loads; it needs JavaScript. ` +
        `The stuck states above are the ones measured when this page was built.</p></div></section>`;

  const position = positionOf(s);
  return page({
    title: `${s.id} — workflow`,
    noLiquid: true,
    body:
      `<style>\n${WV_CSS}\n</style>` +
      `<h1 id="workflow-${esc(s.id)}">Workflow: ${esc(s.id)}</h1>` +
      `<p class="sv-sub">${processLink(s.processId, model ? v.processPageFor?.(model.source) : undefined)} · ${esc(s.status ?? "no status recorded")} · subject <code>${esc(s.subject ?? "")}</code>` +
      ` · started ${esc(s.startedAt ?? "not recorded")} · last moved ${esc(lastMoved(s) ?? "not recorded")}` +
      ` · <a href="../../">${esc(v.store)}'s work plan</a> · <a href="../">every instance in it</a></p>` +
      `<p><strong>Where it is:</strong> ${position.length > 0 ? position.map((p) => `<code>${esc(p)}</code>`).join(", ") : "no step holds a token"}</p>` +
      stuck +
      livePart +
      refusalPart +
      `<h2 class="sv-h2" id="diagram">Diagram</h2>` +
      source +
      diagrams +
      contextPart +
      beans +
      todoPart +
      logPart +
      history +
      WV_SCRIPT,
  });
}

/** `<base>/<harness>/beans/<store>/workflows/` — the store's instances, each linking its own view. */
export function workflowHubPage(store: string, storeAbs: string, view: WorkflowViewContext): string {
  return page({
    title: `${store} — workflows`,
    body:
      `<h1 id="workflows-${esc(store)}">Workflows: ${esc(store)}</h1>` +
      `<p class="sv-sub"><a href="../">${esc(store)}'s work plan</a></p>` +
      wrapRaw(workflowHubBody(storeAbs, view)).join("\n"),
  });
}

function workflowHubBody(storeAbs: string, view: WorkflowViewContext): string {
  const flows = readInstances(filesIn(storePartDirs(storeAbs, "workflow-state"), ".json"));
  const rows = flows
    .map((r) => {
      if ("bad" in r) return `<tr><td><code>${esc(basename(r.file))}</code></td><td colspan="5">${esc(r.bad)}</td></tr>`;
      const w = r.state;
      const id = ROUTE_SEGMENT.test(w.id) ? `<a href="${esc(w.id)}/"><code>${esc(w.id)}</code></a>` : `<code>${esc(w.id)}</code>`;
      return `<tr><td>${id}</td><td>${esc(w.processId)}</td><td>${esc(w.status ?? "")}</td><td>${esc(positionOf(w).join(", "))}</td><td>${esc(w.bean ?? "")}</td><td>${stuckCell(stuckStatesOf(w, view.beans, view.now, view.ends?.get(w.id)))}</td></tr>`;
    })
    .join("");
  return flows.length === 0
    ? `<p class="sv-sub">No BPMN instance recorded in this store.</p>`
    : workflowViewLead(view).replace("Each instance opens", "Each instance below opens") +
        `<table><thead><tr><th>id</th><th>process</th><th>status</th><th>at</th><th>bean</th><th>stuck</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/**
 * The merge steward's recorded DECISIONS (`merge-queue`,
 * `folio-merge-queue-entry/v1`), one row per entry: bean
 * `folio-assistant-30jr`, the harness tile `hfag` asked for.
 *
 * Decisions only, as the kind requires: placement, triage status, hold,
 * who decided and when, and why. Not one GitHub fact. CI, mergeability,
 * labels and the head are GitHub's to answer, and a copy committed into a
 * page is stale on the next push, so each row LINKS the pull request and the
 * reader gets the live answer from the place that owns it.
 *
 * Every entry is parsed with the schema the steward's writer uses. One that
 * fails is listed with the reason rather than dropped: it is a decision a
 * steward believes it recorded (the same rule as `merge-queue-store.ts`).
 */
export function mergeQueueSection(files: readonly string[]): string {
  const rows: string[] = [];
  let bad = 0;
  for (const f of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(f, "utf-8"));
    } catch {
      bad++;
      rows.push(`<tr><td><code>${esc(basename(f))}</code></td><td colspan="5">not readable JSON</td></tr>`);
      continue;
    }
    const r = MergeQueueEntrySchema.safeParse(raw);
    if (!r.success) {
      bad++;
      const i = r.error.issues[0];
      rows.push(
        `<tr><td><code>${esc(basename(f))}</code></td>` +
          `<td colspan="5">not a valid entry — ${esc(i?.path.join(".") || "(root)")}: ${esc(i?.message ?? "")}</td></tr>`,
      );
      continue;
    }
    const e = r.data;
    const pr = `<a href="https://github.com/${esc(e.repository)}/pull/${e.pr}">${esc(e.repository)}#${e.pr}</a>`;
    const placed =
      e.placement.kind === "computed"
        ? `${esc(e.placement.class)}, rank ${e.placement.rank}`
        : `override, position ${e.placement.position}`;
    const hold = e.hold ? `on ${esc(e.hold.waitsOn)} until ${esc(e.hold.expires)}` : "";
    rows.push(
      `<tr><td>${pr}</td><td>${esc(e.status ?? "")}</td><td>${placed}</td><td>${hold}</td>` +
        `<td>${esc(e.decidedAt)}<br>${esc(e.decidedBy)}</td><td>${esc(e.reason)}</td></tr>`,
    );
  }
  return (
    `<h2 class="sv-h2" id="merge-queue">Merge queue — ${files.length - bad} decision(s)` +
    `${bad > 0 ? `, ${bad} unreadable` : ""}</h2>` +
    (files.length === 0
      ? `<p class="sv-sub">No merge-queue decision recorded in this store.</p>`
      : `<p class="sv-sub">What the merge steward decided, and why. CI, mergeability and the head are GitHub's facts: ` +
        `open the pull request for them.</p>` +
        `<table><thead><tr><th>pull request</th><th>status</th><th>placement</th><th>hold</th><th>decided</th>` +
        `<th>reason</th></tr></thead><tbody>${rows.join("")}</tbody></table>`)
  );
}

/**
 * Each JSON file of a store part, parsed with the kind's own schema; one that
 * does not parse carries the reason instead. Never dropped: an entry somebody
 * believes they recorded is shown as broken, not as absent (the rule
 * {@link mergeQueueSection} follows).
 */
function parsedEntries<T>(files: readonly string[], schema: z.ZodType<T>): Array<{ file: string } & ({ data: T } | { bad: string })> {
  return files.map((file) => {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      return { file, bad: "not readable JSON" };
    }
    const r = schema.safeParse(raw);
    if (r.success) return { file, data: r.data };
    const i = r.error.issues[0];
    return { file, bad: `not a valid entry — ${i?.path.join(".") || "(root)"}: ${i?.message ?? ""}` };
  });
}

/** A part's heading: how many entries parsed, and how many did not. */
function partHeading(id: string, title: string, total: number, bad: number, noun: string): string {
  return `<h2 class="sv-h2" id="${id}">${title} — ${total - bad} ${noun}${bad > 0 ? `, ${bad} unreadable` : ""}</h2>`;
}

/**
 * Published surveys of a commit window (`session-survey`,
 * `folio-session-survey/v1`, bean `6ptx`): the window's two edge commits, the
 * branch, who took it and when, and how many of its axes were actually
 * covered. An axis NOT covered is counted apart, because a partial survey that
 * read as complete is the defect the schema exists to stop.
 */
export function sessionSurveySection(files: readonly string[]): string {
  const entries = parsedEntries(files, SessionSurveySchema);
  const bad = entries.filter((e) => "bad" in e).length;
  const rows = entries
    .map((e) => {
      if ("bad" in e) return `<tr><td><code>${esc(basename(e.file))}</code></td><td colspan="5">${esc(e.bad)}</td></tr>`;
      const v = e.data;
      const covered = v.axes.filter((a) => a.covered).length;
      return (
        `<tr><td><code>${esc(v.from.slice(0, 12))}..${esc(v.to.slice(0, 12))}</code></td><td>${esc(v.branch)}</td>` +
        `<td>${v.commits}</td><td>${covered} of ${v.axes.length}</td><td>${esc(v.takenAt)}</td><td>${esc(v.by)}</td></tr>`
      );
    })
    .join("");
  return (
    partHeading("session-survey", "Session surveys", files.length, bad, "survey(s)") +
    (files.length === 0
      ? `<p class="sv-sub">No session survey recorded in this store.</p>`
      : `<table><thead><tr><th>window</th><th>branch</th><th>commits</th><th>axes covered</th><th>taken</th>` +
        `<th>by</th></tr></thead><tbody>${rows}</tbody></table>`)
  );
}

/**
 * When each sweep last ran (`sweep-marks`, `folio-sweep-mark/v1`, bean
 * `rq8s`): one row per check — when it read its input, who ran it, how much it
 * read and what it found. A check with no row has no mark, which is the trace
 * a skipped sweep leaves.
 */
export function sweepMarkSection(files: readonly string[]): string {
  const entries = parsedEntries(files, SweepMarkSchema);
  const bad = entries.filter((e) => "bad" in e).length;
  const rows = entries
    .map((e) => {
      if ("bad" in e) return `<tr><td><code>${esc(basename(e.file))}</code></td><td colspan="4">${esc(e.bad)}</td></tr>`;
      const m = e.data;
      return (
        `<tr><td><code>${esc(m.check)}</code></td><td>${esc(m.checkedAt)}</td><td>${esc(m.by ?? "")}</td>` +
        `<td>${m.read}</td><td>${m.findings}</td></tr>`
      );
    })
    .join("");
  return (
    partHeading("sweep-marks", "Sweep marks", files.length, bad, "mark(s)") +
    (files.length === 0
      ? `<p class="sv-sub">No sweep mark recorded in this store.</p>`
      : `<table><thead><tr><th>check</th><th>checked</th><th>by</th><th>read</th><th>findings</th></tr></thead>` +
        `<tbody>${rows}</tbody></table>`)
  );
}

/** The graph typology this harness keeps one adversarial verdict per PR head in (bean `w8jq`). */
export const MERGE_REVIEWS_KIND = "merge-reviews";

/** `owner/repo`, as a verdict may name the repository its pull request is in. */
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/**
 * The adversarial review verdicts (`merge-reviews`, `merge-review/v1`, bean
 * `w8jq`): one row per `<head sha>.json`, newest review first — the pull
 * request, the head and base it is bound to, the latest review's result, who
 * reviewed it (session and model) and when, and how many BLOCKING flags are
 * still open.
 *
 * The verdict's facts only. Whether the head is still the pull request's head
 * is GitHub's to answer (and `check:adversarial-review`'s to judge), so the
 * pull request is linked rather than a "stale" column guessed from a copy.
 * The link needs the repository, which `merge-review/v1` records only as an
 * optional `repository` (`owner/repo`); a verdict without one shows its
 * number unlinked rather than a link to a guessed repository.
 *
 * A file that is not a valid verdict is listed with the reason, never dropped:
 * a reviewer believes it recorded a verdict (the rule {@link mergeQueueSection}
 * follows). A head that disagrees with the file's name is said so, because
 * the gate looks a verdict up by its name.
 */
export function mergeReviewsSection(files: readonly string[]): string {
  type Row = { at: string; html: string };
  const good: Row[] = [];
  const broken: string[] = [];
  for (const f of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(f, "utf-8"));
    } catch {
      broken.push(`<tr><td colspan="7"><code>${esc(basename(f))}</code> — not readable JSON</td></tr>`);
      continue;
    }
    const r = MergeReviewSchema.safeParse(raw);
    if (!r.success) {
      const i = r.error.issues[0];
      broken.push(
        `<tr><td colspan="7"><code>${esc(basename(f))}</code> — not a valid verdict — ` +
          `${esc(i?.path.join(".") || "(root)")}: ${esc(i?.message ?? "")}</td></tr>`,
      );
      continue;
    }
    const v = r.data;
    const repo = (raw as { repository?: unknown }).repository;
    const pr =
      v.pr === undefined
        ? "—"
        : typeof repo === "string" && REPOSITORY.test(repo)
          ? `<a href="https://github.com/${esc(repo)}/pull/${v.pr}">${esc(repo)}#${v.pr}</a>`
          : `#${v.pr}`;
    const reviews = [...v.reviews].sort((a, b) => b.at.localeCompare(a.at));
    const last = reviews[0];
    const named = basename(f, ".json");
    const head =
      `<code>${esc(v.head_sha.slice(0, 12))}</code>` +
      (named === v.head_sha ? "" : `<br>file is named <code>${esc(named.slice(0, 12))}</code>`);
    const result = last
      ? `${esc(last.result)}${reviews.length > 1 ? ` <span class="sv-sub">(+${reviews.length - 1} earlier)</span>` : ""}`
      : "no review recorded";
    const who = last
      ? `${esc(last.reviewer.by)} <code>${esc(last.reviewer.session)}</code>${last.reviewer.model ? `<br>${esc(last.reviewer.model)}` : ""}`
      : "";
    const open = last
      ? getReviewFindings(last).filter((x) => x.weight === "blocking" && x.status === "open").length
      : 0;
    good.push({
      at: last?.at ?? v.updated_at ?? "",
      html:
        `<tr><td>${pr}</td><td>${head}</td><td><code>${esc(v.base_sha.slice(0, 12))}</code></td>` +
        `<td>${result}</td><td>${who}</td><td>${esc(last?.at ?? v.updated_at ?? "")}</td><td>${last ? open : ""}</td></tr>`,
    });
  }
  good.sort((a, b) => b.at.localeCompare(a.at));
  return (
    partHeading("verdicts", "Verdicts", files.length, broken.length, "verdict(s)") +
    (files.length === 0
      ? `<p class="sv-sub">No adversarial review verdict recorded in this store.</p>`
      : `<p class="sv-sub">The verdict an independent reviewing session recorded on each pull request's head. ` +
        `Whether that head is still current is GitHub's fact: open the pull request for it.</p>` +
        `<div style="overflow-x: auto"><table><thead><tr><th>pull request</th><th>head</th><th>base</th><th>verdict</th>` +
        `<th>reviewer</th><th>reviewed</th><th>open blocking</th></tr></thead>` +
        `<tbody>${[...good.map((g) => g.html), ...broken].join("")}</tbody></table></div>`)
  );
}

/**
 * `<base>/<harness>/merge-reviews/` — the verdicts, read from the mounted
 * state branch. `dir` is null when the graph is not mounted in this build, and
 * the page then says the verdicts are UNKNOWN: a dashboard opening at zero
 * would be indistinguishable from a store nobody has written to.
 */
export function mergeReviewsPage(
  g: Pick<StateGraph, "id" | "path" | "kinds">,
  graphs: StateGraph[],
  dir: string | null,
): string {
  const files =
    dir === null || !existsSync(dir)
      ? null
      : readdirSync(dir)
          .filter((f) => f.endsWith(".json") && f !== "manifest.json")
          .sort()
          .map((f) => join(dir, f));
  return page({
    title: "Merge reviews",
    liquid: false,
    body:
      `<h1 id="${esc(g.id)}">Merge reviews</h1>` +
      `<p class="sv-sub">${esc(g.path)} · ${esc(g.kinds.join(", "))}</p>` +
      (files === null
        ? `<p class="sv-sub"><code>${esc(g.path)}</code> is not mounted in this build, so its verdicts are ` +
          `<strong>unknown</strong>, not none. <code>bun run cat state:mount</code> mounts it.</p>`
        : mergeReviewsSection(files)) +
      registry(graphs, g.id),
  });
}

/**
 * The todo graph's parts the board does not draw (bean
 * `folio-assistant-750a`): `todo-feedback` — each todo raised against a block,
 * with that block and who raised it — and `boards`, each with what it shows and,
 * from `board-positions`, how many notes are placed on it. `todo-items` are the
 * board's own stickies and the no-JS listing, so they are not listed again.
 * Read from the graph's own `todos.json`, in a raw block like the bean store's.
 */
export function todoStorePartsSection(storeAbs: string): string {
  const feedback = filesIn(storePartDirs(storeAbs, "todo-feedback", "todos.json"), ".md");
  let fbBad = 0;
  const fbRows = feedback
    .map((f) => {
      let r: ReturnType<typeof parseTodoFile>;
      let why: string | undefined;
      try {
        r = parseTodoFile(f);
        const i = r?.success === false ? r.error.issues[0] : undefined;
        if (r === undefined) why = "carries no `$schema: todo/1.0.0`";
        else if (!r.success) why = `not a valid todo — ${i?.path.join(".") || "(root)"}: ${i?.message ?? ""}`;
      } catch (e) {
        why = `not readable — ${e instanceof Error ? e.message : String(e)}`;
      }
      if (why !== undefined || r === undefined || !r.success) {
        fbBad++;
        return `<tr><td><code>${esc(basename(f))}</code></td><td colspan="3">${esc(why ?? "")}</td></tr>`;
      }
      const t = r.data;
      const who = t.tags.identities.map((i) => `${i.provider}:${i.id}`).join(", ");
      return (
        `<tr><td><code>${esc(t.id)}</code><br>${esc(t.summary)}</td><td>${t.targetLabel ? `<code>${esc(t.targetLabel)}</code>` : "no block"}</td>` +
        `<td>${esc(who || "not recorded")}</td><td>${esc(t.status)}</td></tr>`
      );
    })
    .join("");

  const boards = parsedEntries(
    filesIn(storePartDirs(storeAbs, "boards", "todos.json"), ".json").filter((f) => basename(f) !== BOARD_POSITIONS_FILE),
    BoardSchema,
  );
  const posFiles = storePartDirs(storeAbs, "board-positions", "todos.json")
    .map((d) => join(d, BOARD_POSITIONS_FILE))
    .filter((f) => existsSync(f));
  const positions = parsedEntries(posFiles, BoardPositionsSchema);
  const posDoc = positions.find((p) => "data" in p);
  const posBad = positions.filter((p) => "bad" in p);
  // No positions file is a determined state — nothing has been placed; one
  // that does not parse is not, so its counts are unknown rather than zero.
  const placed = (id: string): string =>
    posBad.length > 0 ? "unknown" : posDoc && "data" in posDoc ? String(positionsOn(posDoc.data, id).length) : "0";
  const boardBad = boards.filter((b) => "bad" in b).length;
  const boardRows = boards
    .map((b) => {
      if ("bad" in b) return `<tr><td><code>${esc(basename(b.file))}</code></td><td colspan="3">${esc(b.bad)}</td></tr>`;
      const f = b.data.filter;
      const shows =
        f === undefined
          ? "the whole folio"
          : [f.pages ? `pages: ${f.pages.join(", ")}` : "", f.kinds ? `kinds: ${f.kinds.join(", ")}` : ""].filter(Boolean).join("; ");
      return `<tr><td><code>${esc(b.data.id)}</code></td><td>${esc(b.data.title)}</td><td>${esc(shows)}</td><td>${placed(b.data.id)}</td></tr>`;
    })
    .join("");
  const posNote =
    posFiles.length === 0
      ? `<p class="sv-sub">No <code>${BOARD_POSITIONS_FILE}</code> in this graph: no note has been placed on any board.</p>`
      : posBad.map((p) => `<p class="sv-sub"><code>${esc(basename(p.file))}</code>: ${esc((p as { bad: string }).bad)}</p>`).join("");

  return wrapRaw(
    partHeading("todo-feedback", "Feedback", feedback.length, fbBad, "todo(s)") +
      (feedback.length === 0
        ? `<p class="sv-sub">No feedback todo recorded in this graph.</p>`
        : `<table><thead><tr><th>todo</th><th>block</th><th>submitter</th><th>status</th></tr></thead><tbody>${fbRows}</tbody></table>`) +
      partHeading("boards", "Boards", boards.length, boardBad, "board(s)") +
      (boards.length === 0
        ? `<p class="sv-sub">No board recorded in this graph.</p>`
        : `<table><thead><tr><th>id</th><th>title</th><th>shows</th><th>notes placed</th></tr></thead><tbody>${boardRows}</tbody></table>`) +
      posNote,
  ).join("\n");
}

/**
 * One layer's graph of a kind: the sub-graph a `subgraphs: "instance"`
 * visualiser draws a page for (bean `folio-assistant-1nu0`, owner 2026-10-15:
 * "per-instance pages"; "each viewer draws one page per instance").
 *
 * `name` is the layer the directory BELONGS to — `member` for an inherited
 * subgraph, else the declarer — which is the sub-graph segment `viewersOf`
 * looks for. `instanceRoot` is that layer's root, recovered from the
 * declared path rather than composed, so the corpus-availability probe asks
 * the layer that holds the directory.
 */
export interface InstanceSubject {
  name: string;
  path: string;
  absPath: string;
  instanceRoot: string;
  /** The branch the directory's records are kept on (`storage`/`source` `branch`), when it declares one. */
  storage?: string;
}

/** A declared `storage`/`source` that names one branch, as `qaStorageOf` reads it; anything else is no branch. */
function branchOf(x: unknown): string | undefined {
  if (x === null || typeof x !== "object" || !("branch" in x)) return undefined;
  const b = (x as { branch: unknown }).branch;
  return typeof b === "string" && b.length > 0 ? b : undefined;
}

/**
 * The layers in the checkout holding a directory of one of `kinds`, one
 * subject each, sorted by name.
 *
 * Read from the RESOLVED checkout (`checkoutDirectories`), never from a list:
 * a layer is a subject because it declares the kind, so a new layer
 * holding such a directory gets its page with no edit here. A declared
 * directory that is NOT on disk still gets one, and that page says the corpus
 * is unknown in this build: derived QA lives on the `qa-reports` branch and
 * health reports are written by a sweep and never committed, so an absent tree
 * is the normal case, not an empty graph — and with no page the layer's
 * tile would have nowhere to go.
 */
export function instanceSubjectsOf(
  dirs: ReadonlyArray<{ id: string; path: string; absPath: string; declaredBy: string; member?: string; graphTypologies: readonly string[]; storage?: unknown; source?: unknown }>,
  kinds: readonly string[],
): InstanceSubject[] {
  const out = new Map<string, InstanceSubject>();
  for (const d of dirs) {
    if (!d.graphTypologies.some((k) => kinds.includes(k))) continue;
    const name = d.member ?? d.declaredBy;
    if (out.has(name)) continue;
    const up = d.path.split("/").filter((x) => x.length > 0 && x !== ".").length;
    const instanceRoot = resolve(d.absPath, ...Array.from({ length: up }, () => ".."));
    const storage = branchOf(d.source) ?? branchOf(d.storage);
    out.set(name, { name, path: d.path, absPath: d.absPath, instanceRoot, ...(storage ? { storage } : {}) });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every OTHER layer's visualiser this Tool draws on the host site: declared
 * `renderedBy: state-viewer`, `subgraphs: "instance"` and `builtOnHostSite`, by
 * a layer that is not `own`. Each keeps its declaring layer's name, which is
 * the harness segment of its route.
 */
export function hostedVisualisers(repoRoot: string, own: string): ReturnType<typeof declaredVisualisers> {
  return declaredVisualisers(repoRoot).filter(
    (v) => v.harness !== own && v.renderedBy === VIEWER_TOOL && v.subgraphs === "instance" && (v as { builtOnHostSite?: unknown }).builtOnHostSite !== undefined,
  );
}

/**
 * What a per-instance visualiser (`subgraphs: "instance"`) draws in the
 * checkout at `root`: its kinds, the kinds it has no reader for, and the
 * layers that get a page. One home for the selection, because the page
 * writer and the orphan keep-set both depend on it — the keep-set test held a
 * hand-written list and missed the seven hubs #294 added.
 *
 * A bean store's parts (`bean-defs`, `bean-notes`, `workflow-state`, `merge-queue`) are drawn
 * on the store's own page, so the subjects are the stores (bean
 * `folio-assistant-750a`). A directory the visualiser ALSO names by id
 * (`covers`) is drawn on its full view, and `viewersOf` opens that view for
 * it: no subject page — except a bean store, whose board draws its beans
 * only, so its notes and workflow instances need a page of their own. A
 * directory the checkout ROOT declares (`(root)`, the index's own `test/`)
 * belongs to no layer and has no route segment: it is `unrouted`.
 */
export function perInstanceSubjects(
  v: { coversKinds?: readonly string[]; covers?: readonly string[] },
  root: string,
  harness: string,
): {
  kinds: readonly string[];
  beans: boolean;
  code: boolean;
  memory: boolean;
  unread: string[];
  candidates: ReturnType<typeof checkoutDirectories>;
  subjects: InstanceSubject[];
  unrouted: InstanceSubject[];
} {
  const kinds = v.coversKinds ?? [];
  const beans = kinds.includes("beans") && kinds.every((k) => BEAN_STORE_KINDS.has(k));
  const code = kinds.length > 0 && kinds.every((k) => k === "code");
  const memory = kinds.length > 0 && kinds.every((k) => MEMORY_KINDS.has(k));
  const unread = beans || code || memory ? [] : kinds.filter((k) => !PER_INSTANCE_KINDS.has(k));
  if (kinds.length === 0 || unread.length > 0) return { kinds, beans, code, memory, unread, candidates: [], subjects: [], unrouted: [] };
  const byId = new Set(beans ? [] : (v.covers ?? []));
  const candidates = checkoutDirectories(root).filter((d) => !(d.declaredBy === harness && byId.has(d.id)));
  const all = instanceSubjectsOf(candidates, beans ? ["beans"] : kinds);
  const routed = (s: InstanceSubject) => ROUTE_SEGMENT.test(s.name);
  return { kinds, beans, code, memory, unread, candidates, subjects: all.filter(routed), unrouted: all.filter((s) => !routed(s)) };
}

/**
 * One layer's directory of `kinds`, projected with the same family reader
 * the whole-graph QA projection uses (`projectQaGraph`, bean `tfqf` C9), and
 * the same availability rule: absent is UNKNOWN, never zero.
 *
 * `qa` keeps its own probe (`qaCorpusAvailability`): its corpus is the derived
 * results trees, which a `test/results/` holding only committed attestations
 * does not answer for. Every other kind is present exactly when its declared
 * directory is on disk.
 */
export function projectInstanceSubject(s: InstanceSubject, kinds: readonly string[]): QaGraphProjection {
  if (kinds.includes("qa")) return projectQaGraph(s.absPath, qaCorpusAvailability(s.instanceRoot).present);
  return projectQaGraph(
    s.absPath,
    existsSync(s.absPath),
    `\`${s.path}\` of ${s.name} is not in this build (it is not committed here, or was not fetched), so it was not counted`,
    // A listed kind's census counts the same files its node table lists.
    kinds.some((k) => LISTED_KINDS.includes(k)) ? { extensions: NODE_EXTENSIONS } : undefined,
  );
}

/**
 * What the integrated QA page of `s` is given beyond its source: the
 * instance's own `qa` declaration, and the visualiser's `sections` as links to
 * their pages for this instance (`../../<id>/<instance>/`, siblings under one
 * harness). A declaration that will not read is no declaration: the page then
 * draws the axes the entry holds.
 */
export function qaPageInputsOf(
  v: { sections?: readonly string[] },
  s: Pick<InstanceSubject, "name" | "instanceRoot">,
  declared: readonly { id: string; title?: string; subgraphs?: string }[],
): { decl?: QaDeclaration; sections: QaSectionLink[] } {
  let decl: QaDeclaration | undefined;
  try {
    decl = readDeclaration(s.instanceRoot)?.qa;
  } catch {
    decl = undefined;
  }
  const sections = (v.sections ?? []).map((id) => {
    const o = declared.find((x) => x.id === id);
    // A visualiser drawn per instance has this instance's page; one that is not
    // has its whole-graph page only, which is what the link then names.
    return { id, title: o?.title ?? id, href: o?.subgraphs === "instance" ? `../../${id}/${s.name}/` : `../../${id}/` };
  });
  return { ...(decl ? { decl } : {}), sections };
}

/**
 * `<base>/<harness>/<vis>/<instance>/` — one layer's graph of the kinds
 * the visualiser covers.
 *
 * A layer whose corpus is not in the build says so — unknown, not zero —
 * instead of counting the few files that happen to be committed.
 */
export function instanceSubjectPage(
  vis: { id: string; title?: string; coversKinds?: readonly string[] },
  s: InstanceSubject,
  subjects: readonly InstanceSubject[],
  ix: QaGraphProjection = projectInstanceSubject(s, vis.coversKinds ?? []),
  live?: QaLiveSource,
  qa: { decl?: QaDeclaration; sections?: readonly QaSectionLink[] } = {},
): string {
  const title = vis.title ?? vis.id;
  const others = subjects
    .map((o) =>
      o.name === s.name
        ? `<li><span class="sv-here">${esc(o.name)}</span></li>`
        : `<li><a href="../${esc(o.name)}/">${esc(o.name)}</a></li>`,
    )
    .join("");
  const qaFamilies = (vis.coversKinds ?? []).includes("qa");
  const registry = (vis.coversKinds ?? []).length > 0 && (vis.coversKinds ?? []).every((k) => REGISTRY_KINDS.has(k));
  // The build holds no corpus, but the layer publishes one: the browser reads
  // it from the layer's qa-reports branch at view time (owner card, 2026-11-10:
  // "Load in the browser"), so a publish never fetches or copies results.
  // ONE integrated page per instance (owner, 2026-11-24): whenever the layer
  // publishes, the page is the published entry, every axis at once; a copy
  // this build happens to hold is shown under it, never instead of it.
  const loadsLive = qaFamilies && live !== undefined;
  const local = loadsLive && (ix as { availability?: string }).availability !== "unknown";
  return page({
    title: `${s.name} — ${title}`,
    ...(registry || loadsLive ? { noLiquid: true } : {}),
    body:
      `<h1 id="${esc(vis.id)}-${esc(s.name)}">${esc(title)}: ${esc(s.name)}</h1>` +
      `<p class="sv-sub">${esc(s.name)} · ${esc(s.path)} · <a href="../">every instance's ${esc(title)}</a></p>` +
      (loadsLive
        ? qaIntegratedPanel(live!, qa) + (local ? `<h2 class="sv-h2">This build's working copy</h2>` + qaPanelsOf(ix, undefined, { qaFamilies }) : "")
        : qaPanelsOf(ix, undefined, { qaFamilies })) +
      (registry ? registryTable(withSubjectIris(registryRowsOf(s.absPath), s.absPath, vis.coversKinds ?? [], subjectIri, { instance: s.name, layerPath: relative(s.instanceRoot, s.absPath).split(sep).join("/") })) : "") +
      `<h2 class="sv-h2">Instances holding ${esc(title)}</h2>` +
      `<ul class="sv-list">${others}</ul>`,
  });
}

/**
 * What a per-instance beans page is given: the store's beans, or why it could
 * not be read. `null` beans is "no store at the declared path", which is
 * not the same as a store holding none.
 */
export type BeanStoreRead = { beans: BeanNode[] | null } | { unreachable: string };

/** Read one layer's bean store, keeping "could not read" apart from "empty". */
export function readSubjectBeans(instanceRoot: string): BeanStoreRead {
  try {
    return { beans: readBeans(instanceRoot) };
  } catch (e) {
    return { unreachable: e instanceof Error ? e.message : String(e) };
  }
}

/** Priority order for the open-bean table; an unknown priority sorts last. */
const PRIORITY_ORDER = ["critical", "high", "normal", "low", "deferred"];

/**
 * `<base>/<harness>/<vis>/<instance>/` — one layer's work plan (bean
 * `folio-assistant-1nu0`, owner 2026-10-15: "per-instance pages").
 *
 * Each layer's `beans/` is its OWN store (`cat-tools-…`,
 * `folio-assistant-…` ids), not the repository store the full board draws,
 * so the page reads that store and lists its open beans. Rendered
 * SERVER-SIDE: the board's client (`work-plan.js`) reads the one bean index
 * the layout names, so it cannot be pointed at a second store from a page.
 */
export function beansSubjectPage(
  vis: { id: string; title?: string },
  s: InstanceSubject,
  subjects: readonly InstanceSubject[],
  read: BeanStoreRead = readSubjectBeans(s.instanceRoot),
  view?: Omit<WorkflowViewContext, "beans">,
): string {
  const title = vis.title ?? "Plans and work";
  const others = subjects
    .map((o) =>
      o.name === s.name
        ? `<li><span class="sv-here">${esc(o.name)}</span></li>`
        : `<li><a href="../${esc(o.name)}/">${esc(o.name)}</a></li>`,
    )
    .join("");
  let body: string;
  if ("unreachable" in read) {
    body =
      `<h2 class="sv-h2">Not available in this build</h2>` +
      `<p class="sv-sub">${esc(read.unreachable)}. This is <strong>unknown</strong>, not zero.</p>`;
  } else if (read.beans === null) {
    body =
      `<h2 class="sv-h2">No bean store</h2>` +
      `<p class="sv-sub">${esc(s.path)} holds no <code>bean-defs</code> node, so there is no work plan to list. ` +
      `That is no store, not an empty one.</p>`;
  } else {
    const all = read.beans;
    const open = all
      .filter(isOpen)
      .sort((a, b) => {
        const pa = PRIORITY_ORDER.indexOf(a.priority);
        const pb = PRIORITY_ORDER.indexOf(b.priority);
        return (pa < 0 ? PRIORITY_ORDER.length : pa) - (pb < 0 ? PRIORITY_ORDER.length : pb) || a.id.localeCompare(b.id);
      });
    const rows = open
      .map(
        (b) =>
          `<tr><td><code>${esc(b.id)}</code></td><td>${esc(b.title)}</td><td>${esc(b.status)}</td>` +
          `<td>${esc(b.type)}</td><td>${esc(b.priority)}</td></tr>`,
      )
      .join("");
    body =
      // Says WHOSE store, beside the navbar's Beans badge: that badge counts
      // the folio's own work plan, so 48 there and 2 here read as a
      // contradiction when the page did not name its scope (owner, 2026-11-08).
      `<h2 class="sv-h2">Open in ${esc(s.name)}'s own store — ${open.length} of ${all.length} bean(s)</h2>` +
      `<p class="sv-sub">Only the beans in ${esc(s.name)}'s own store. The Beans badge in the navbar counts ` +
      `<a href="../">the repository work plan</a>, which is a different store.</p>` +
      (open.length === 0
        ? `<p class="sv-sub">Every bean in this store is completed or scrapped.</p>`
        : `<table><thead><tr><th>id</th><th>title</th><th>status</th><th>type</th><th>priority</th></tr></thead>` +
          `<tbody>${rows}</tbody></table>`) +
      // Only beside a store that was read: an unreadable one is unknown, and
      // its parts would read as zero (bean `folio-assistant-750a`).
      beanStorePartsSection(s.absPath, view === undefined ? undefined : { ...view, beans: all });
  }
  return page({
    title: `${s.name} — ${title}`,
    body:
      `<h1 id="${esc(vis.id)}-${esc(s.name)}">${esc(title)}: ${esc(s.name)}</h1>` +
      `<p class="sv-sub">${esc(s.name)} · ${esc(s.path)} · <a href="../">the repository work plan</a></p>` +
      body +
      `<h2 class="sv-h2">Instances holding a work plan of their own</h2>` +
      `<ul class="sv-list">${others}</ul>`,
  });
}

/**
 * One declared code directory of a layer, for its per-instance code page
 * (bean `folio-assistant-svgx`).
 */
export interface CodeDirectory {
  id: string;
  path: string;
  absPath: string;
  description?: string;
}

/**
 * Every directory of `kinds` that layer `name` holds, in declaration
 * order. Unlike {@link instanceSubjectsOf}, which keeps ONE directory per
 * layer, a layer declares code in many places (`scripts/`,
 * `schemas/`, `pipeline/`, …) and its code page lists them all.
 */
export function codeDirectoriesOf(
  dirs: ReadonlyArray<{ id: string; path: string; absPath: string; declaredBy: string; member?: string; graphTypologies: readonly string[]; description?: string }>,
  name: string,
  kinds: readonly string[],
): CodeDirectory[] {
  const out: CodeDirectory[] = [];
  const seen = new Set<string>();
  for (const d of dirs) {
    if ((d.member ?? d.declaredBy) !== name) continue;
    if (!d.graphTypologies.some((k) => kinds.includes(k))) continue;
    if (seen.has(d.absPath)) continue;
    seen.add(d.absPath);
    out.push({ id: d.id, path: d.path, absPath: d.absPath, ...(d.description ? { description: d.description } : {}) });
  }
  return out;
}

/** Directory names a source listing never descends into. */
// input-site: inert #57373ec0 — names the build and dependency directories a code walk skips; never reads them
const CODE_SKIP = new Set(["node_modules", ".git", ".lake", "__pycache__", "dist", "build"]);

/** At most this many files are listed per directory; the total is always given. */
export const CODE_FILE_LIMIT = 300;

/**
 * The files under a code directory, `/`-separated and relative to it, sorted.
 * `null` when the directory is not on disk — not in this build, which is
 * unknown, not empty.
 */
export function listCodeFiles(absPath: string, limit: number = CODE_FILE_LIMIT): { files: string[]; total: number } | null {
  if (!existsSync(absPath)) return null;
  const all: string[] = [];
  const walk = (dir: string, rel: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (CODE_SKIP.has(e.name) || e.name.startsWith(".")) continue;
        walk(join(dir, e.name), r);
      } else if (e.isFile()) {
        all.push(r);
      }
    }
  };
  walk(absPath, "");
  all.sort();
  return { files: all.slice(0, limit), total: all.length };
}

/**
 * `https://github.com/<repo>/blob/<ref>/` for a layer mounted from a
 * pinned commit — read from the checkout's `index.lock.json` — so a file links
 * to the source the site was built from. `undefined` when the layer is not
 * a locked mount (a layer repository's own checkout): the page then lists
 * names without links rather than guess a ref.
 */
export function pinnedBlobBase(repoRoot: string, instance: string): string | undefined {
  const m = pinnedMount(repoRoot, instance);
  return m === undefined ? undefined : `https://github.com/${m.repository}/blob/${m.ref}/`;
}

/** The repository and commit `index.lock.json` pins a layer at, or `undefined` when the lock does not name it plainly. */
export function pinnedMount(repoRoot: string, instance: string): { repository: string; ref: string } | undefined {
  try {
    const lock = readLockFile(join(repoRoot, "index.lock.json")) as {
      mounts?: Array<{ harness?: string; repository?: string; ref?: string }>;
    };
    const m = (lock.mounts ?? []).find((x) => x.harness === instance);
    if (!m?.repository || !m.ref || !/^[\w.-]+\/[\w.-]+$/.test(m.repository) || !/^[0-9a-f]{7,40}$/.test(m.ref)) return undefined;
    return { repository: m.repository, ref: m.ref };
  } catch {
    return undefined;
  }
}

/**
 * `<base>/<harness>/<vis>/<instance>/` — one layer's code: each declared
 * code directory with its files, linked to GitHub at the pinned commit
 * (bean `folio-assistant-svgx`, child of `46ob`). A source LISTING, not a
 * rendered source browser: the file opens on GitHub, which already renders
 * it.
 */
export function codeSubjectPage(
  vis: { id: string; title?: string },
  s: InstanceSubject,
  subjects: readonly InstanceSubject[],
  dirs: readonly CodeDirectory[],
  blobBase: string | undefined,
  list: (absPath: string) => { files: string[]; total: number } | null = (p) => listCodeFiles(p),
): string {
  const title = vis.title ?? "Code";
  const others = subjects
    .map((o) =>
      o.name === s.name
        ? `<li><span class="sv-here">${esc(o.name)}</span></li>`
        : `<li><a href="../${esc(o.name)}/">${esc(o.name)}</a></li>`,
    )
    .join("");
  const href = (p: string): string => (blobBase ? `${blobBase}${p.split("/").map(encodeURIComponent).join("/")}` : "");
  const sections = dirs
    .map((d) => {
      const read = list(d.absPath);
      const base = d.path.replace(/^\.\//, "").replace(/\/+$/, "");
      const heading = `<h3><code>${esc(base || ".")}/</code> <span class="sv-tag">${esc(d.id)}</span></h3>`;
      const desc = d.description ? `<p class="sv-sub">${esc(d.description)}</p>` : "";
      if (read === null) {
        return `<section class="sv-item">${heading}${desc}<p class="sv-sub">Not in this build, so its files are <strong>unknown</strong>, not none.</p></section>`;
      }
      const items = read.files
        .map((f) => {
          const p = base ? `${base}/${f}` : f;
          const u = href(p);
          return u ? `<li><a href="${esc(u)}"><code>${esc(f)}</code></a></li>` : `<li><code>${esc(f)}</code></li>`;
        })
        .join("");
      const more = read.total > read.files.length ? `<p class="sv-sub">First ${read.files.length} of ${read.total} files listed.</p>` : "";
      return (
        `<section class="sv-item">${heading}${desc}` +
        `<p class="sv-sub">${read.total} file${read.total === 1 ? "" : "s"}</p>` +
        `<ul>${items}</ul>${more}</section>`
      );
    })
    .join("\n");
  const where = blobBase
    ? `Files open on GitHub at the commit this site was built from.`
    : `This instance is not a pinned mount here, so files are listed without links.`;
  return page({
    title: `${s.name} — ${title}`,
    liquid: false,
    body:
      `<h1 id="${esc(vis.id)}-${esc(s.name)}">${esc(title)}: ${esc(s.name)}</h1>` +
      `<p class="sv-sub">${esc(s.name)} · ${dirs.length} declared code director${dirs.length === 1 ? "y" : "ies"} · ${esc(where)}</p>` +
      sections +
      `<h2 class="sv-h2">Instances holding code</h2>` +
      `<ul class="sv-list">${others}</ul>`,
  });
}

/**
 * The checkout's todos, as the workflow view joins them; none when the todo
 * graph is not readable here, which the page reports as "no todo is tagged"
 * only because a todo it cannot read names nothing it can show.
 */
function readViewTodos(): TodoLike[] {
  try {
    return readTodos().map((t) => t as unknown as TodoLike);
  } catch {
    return [];
  }
}

/**
 * The todo store's root, or why it is absent from this checkout. Only a
 * DETERMINED absence (`StoreAbsentError`, smart-ips-pilgrimage#13) is
 * answered; any other failure to resolve it still throws.
 */
function todoStoreHere(): { root: string } | { absent: string } {
  try {
    return { root: TODO_ROOT() };
  } catch (e) {
    const cause = e instanceof StoreAbsentError ? e : (e as { cause?: unknown })?.cause;
    if (cause instanceof StoreAbsentError) return { absent: cause.reason };
    throw e;
  }
}

let processFiles: Map<string, string> | undefined;
/** Process id → the `.bpmn` declaring it, over every layer in the checkout; built once. */
function processFileOf(processId: string): string | undefined {
  if (processFiles === undefined) {
    processFiles = new Map();
    for (const inst of layerRootsIn(REPO_ROOT)) {
      for (const f of workflowFiles(inst)) {
        if (!f.endsWith(".bpmn")) continue;
        let xml: string;
        try {
          xml = readFileSync(f, "utf-8");
        } catch {
          continue;
        }
        for (const m of xml.matchAll(/<bpmn:process\s+id="([^"]+)"/g)) if (!processFiles.has(m[1]!)) processFiles.set(m[1]!, f);
      }
    }
  }
  return processFiles.get(processId);
}

/**
 * The diagram an instance runs: its recorded `source`, resolved against each
 * root in turn (an instance records it relative to the root that saved it),
 * else the file that declares its `processId` now — said so on the page,
 * because a moved diagram is a fact a reader needs. Never a guess beyond that.
 */
async function modelFor(inst: InstanceState, roots: readonly string[]): Promise<ModelRead> {
  const recorded = inst.source ?? "";
  const at = recorded === "" ? undefined : roots.map((r) => resolve(r, recorded)).find((p) => existsSync(p));
  const file = at ?? processFileOf(inst.processId);
  if (file === undefined) {
    return { missing: `${recorded ? `\`${recorded}\` is not on disk` : "no source is recorded"}, and no diagram in the checkout declares \`${inst.processId}\``, recorded };
  }
  try {
    const model = await loadProcessModel(file);
    return { model, source: relative(REPO_ROOT, file).split(sep).join("/"), recorded, moved: at === undefined };
  } catch (e) {
    return { missing: `\`${relative(REPO_ROOT, file)}\` could not be loaded (${e instanceof Error ? e.message.split("\n")[0] : String(e)})`, recorded };
  }
}

/**
 * The processes viewer's page directory on this site, from its declared
 * route (`visualiserSitePath`), or undefined when no harness declares one.
 * Its per-diagram pages are `<stem>.html` there (`gen-processes-viz.ts`).
 */
function processesPageDir(): string | undefined {
  try {
    return join(SITE, dirname(visualiserSitePath(ROOT, "processes-viewer").rel));
  } catch {
    return undefined;
  }
}

/** Each instance's diagram in one bean store, by instance id — loaded once, read by every page of it. */
async function workflowModelsOf(s: InstanceSubject): Promise<Map<string, ModelRead>> {
  const out = new Map<string, ModelRead>();
  for (const r of readInstances(filesIn(storePartDirs(s.absPath, "workflow-state"), ".json"))) {
    if ("state" in r) out.set(r.state.id, await modelFor(r.state, [s.instanceRoot, dirname(s.absPath), REPO_ROOT]));
  }
  return out;
}

/** The end events of each loaded diagram, for the stuck column. */
function endsOf(models: ReadonlyMap<string, ModelRead>): Map<string, Set<string>> {
  return new Map([...models].map(([id, m]) => [id, endNodesOf("model" in m ? m.model : undefined)]));
}

if (import.meta.main) await main();

/**
 * Generate every dashboard, or check them.
 *
 * Behind `import.meta.main` — the house pattern here, and 97 of 135 scripts
 * already use it — so that a test can import the pure resolver above without
 * this writing into the real site directory as a side effect of the import.
 */
async function main(): Promise<void> {
// Viewers RESOLVED from the pages (#1168 B7a-2b).
const declRead = readDeclaration(ROOT);
// The CHECKOUT's state graphs too (placement PR0, bean `ejye`): `beans`,
// `todos`, `memory`, `interaction` and `issue-marks` are declared by the
// checkout's ROOT layer since the platform stopped mirroring them, and
// this site still draws their dashboards. Read as `repository`-scoped, which
// is what they are relative to this layer and how `drawnDir` resolves them.
const decl = declRead && {
  ...declRead,
  directories: withViewers(siteDirectories(declRead.directories ?? [], ROOT, REPO_ROOT), ROOT),
};
if (!decl) {
  // "Could not determine", and this generator does not get to decide it means
  // "no state". Exit 2 is never rendered as a pass, the same rule
  // `check-harness-dirs.ts` and `check-ci-health.ts` follow.
  console.error(`state-visualizer: no readable declaration at ${ROOT}`);
  console.error("This is NOT a pass. Treat it as unknown.");
  process.exit(2);
}

// AND the checkout root's own state graphs (bean `cmsl` step 2, issue #1694):
// `beans/`, `todos/`, `memory/`, `fsh-guts/`, `issue-marks/`, `interaction/`
// are declared by the root layer since the owner's round-5 ruling, and this
// site is where their dashboards were always published — every one of them
// names `cat-harness/docs/<id>/index.html` as its visualiser. Reading only this
// layer's declaration would orphan all six the moment the entries moved.
const rootRead = resolve(REPO_ROOT) === resolve(ROOT) ? undefined : readDeclaration(REPO_ROOT);
const rootDirs = rootRead ? withViewers(rootRead.directories ?? [], REPO_ROOT, REPO_ROOT) : [];
const ownIds = new Set((decl.directories ?? []).map((d) => d.id));
const checkoutDirs = rootDirs.filter((d) => !ownIds.has(d.id));
// THE DECLARED VISUALISERS this Tool draws for this harness — the only pages
// it writes, each at `<locale>/<harness>/<id>/` (owner, 2026-10-09; #2527).
const mine = (declRead?.visualisers ?? []).filter((v) => v.renderedBy === VIEWER_TOOL);
const visOf = new Map<string, string>();
for (const v of mine) for (const c of v.covers ?? []) if (!visOf.has(c)) visOf.set(c, v.id);
// Covered BY KIND (`coversKinds`): every state directory here holding one of
// those kinds is drawn by that visualiser, keyed by its id as `covers` is.
for (const v of mine) {
  for (const d of [...(decl.directories ?? []), ...checkoutDirs]) {
    if ((v.coversKinds ?? []).some((k) => (d.graphTypologies ?? []).includes(k as never)) && !visOf.has(d.id)) visOf.set(d.id, v.id);
  }
}
const ownRefs = ownVisualiserRefs(REPO_ROOT, SITE, harnessOf(), mine.map((v) => v.id));
const all = [
  ...stateGraphsOf(decl, visOf, ownRefs),
  ...stateGraphsOf({ ...decl, directories: checkoutDirs }, visOf, ownRefs),
].sort((a, b) => a.id.localeCompare(b.id));
for (const v of mine) {
  // A per-instance visualiser over a kind that is not state (`code`, a
  // registry) draws its pages below, not a dashboard here, so covering no
  // state graph is expected.
  if (!all.some((g) => g.vis === v.id) && v.subgraphs !== "instance") {
    console.error(`  ! visualiser \`${v.id}\` covers no declared state graph (${(v.covers ?? []).join(", ") || "no covers"}) — nothing drawn`);
  }
}
const taken = all.filter((g) => RESERVED_IDS.has(g.vis) || g.vis.startsWith("_"));
for (const g of taken) {
  console.error(
    `  ! declared directory \`${g.id}\` collides with a route this site already uses — ` +
      `not rendered. Rename the directory's id in the declaration.`,
  );
}
// REFUSED, not encoded — and the difference is the point.
//
// Everywhere else an id names a private artefact, `portableSegment` encodes it
// and the caller never sees the spelling. Here the id is also the site's URL
// ROUTE, so encoding it would quietly publish `/req%3Ax/` and the declaration
// would no longer say where the page is. A declaration that cannot be rendered
// on a filesystem the site is built on is a defect in the declaration, and the
// remedy is the one this generator already gives for a colliding id: rename it.
//
// Same shape as `portable-path.ts`'s device names — encoding does not rescue
// every id, and saying so beats mangling one.
const unportable = all.filter((g) => !taken.includes(g) && unportableSegment(g.vis));
for (const g of unportable) {
  console.error(
    `  ! declared directory \`${g.id}\` cannot be a directory or a route on every platform ` +
      `(${unportableSegment(g.id)}) — not rendered. Rename the directory's id in the declaration.`,
  );
}
const graphs = all.filter((g) => !taken.includes(g) && !unportable.includes(g));

for (const g of graphs) {
  // A themed page (front matter: `todos`) names its Tool in its front matter;
  // a standalone one in its `<head>`. Provenance only — the route is declared.
  const html = dashboardPage(g, graphs);
  const html2 = html.startsWith("---\n") ? withRenderedByFrontMatter(html, VIEWER_TOOL) : withRenderedBy(html, VIEWER_TOOL);
  emit(join(pageDirOf(g.vis), "index.html"), html2);
}

// PER-INSTANCE PAGES (bean `folio-assistant-1nu0`, owner 2026-10-15:
// "per-instance pages"). A visualiser declaring `subgraphs: "instance"` gets
// one page per layer in the checkout holding a directory of a kind it
// covers, at `<locale>/<harness>/<vis>/<instance>/` — the sub-graph route
// `viewersOf` resolves a tile to. The kinds in `PER_INSTANCE_KINDS`
// (self-describing JSON the family reader counts) draw on the shared layer
// page, and `beans` on its own store reader; any other kind has no
// per-instance reader here, and is refused loudly rather than drawn as an
// empty page.
const subjectOrphans: string[] = [];
const hubs: string[] = [];
// The reference time of every age-based stuck state (bean `v49e`), read once
// so every page of one run measures against the same instant and says which.
// The start of the UTC day, not the instant: ages are counted in days, and an
// instant gave every page new bytes on every build, so every writer reading
// these pages ran again (cat-harness-tools#1230).
// input-site: traced #f3740f0d — today, which every age on the generated pages is measured against: a run that reads it records no hash
inputSiteReached("state-visualizer: today");
const NOW = startOfUtcDay(new Date());
const todosForView = readViewTodos();
// Bean `v49e`, item 3: the working context of each step holding a token. Read
// once; a graph or memory store that cannot be read leaves that part unshown
// and the page says so, never an empty answer passed off as a measured one.
const rolesForView: RoleGraph | undefined = (() => {
  try {
    return roleGraphFor(ROOT);
  } catch {
    return undefined;
  }
})();
const memoryForView: MemoryNode[] | undefined = (() => {
  try {
    return readMemoryNodes();
  } catch {
    return undefined;
  }
})();
// Bean `folio-assistant-w2hn`: the diagrams' ids and every store's instances,
// read once; each store page then classifies and groups its own beans.
const unlinkedInputs = mine.some((x) => x.subgraphs === "instance")
  ? { diagrams: declaredDiagramIds(REPO_ROOT), instances: allInstances(beanStores(REPO_ROOT)) }
  : undefined;
/** A bean store's unlinked-beans section, or nothing when its beans could not be read. */
function unlinkedSection(s: InstanceSubject): string {
  const read = readSubjectBeans(s.instanceRoot);
  if (!unlinkedInputs || !("beans" in read) || read.beans === null) return "";
  try {
    const archived = readArchivedBeans(s.instanceRoot);
    const r = unlinkedReport({
      store: s.name,
      beans: beanInputs(s.instanceRoot, read.beans),
      archived: beanInputs(s.instanceRoot, archived ?? []),
      archiveDeclared: archived !== null,
      instances: unlinkedInputs.instances,
      ids: unlinkedInputs.diagrams.ids,
      diagrams: unlinkedInputs.diagrams,
    });
    return unlinkedSectionHtml(r);
  } catch (e) {
    return `<p class="sv-sub">Open beans tied to no BPMN task: <strong>could not determine</strong> (${esc(e instanceof Error ? e.message : String(e))}).</p>`;
  }
}
/**
 * A bean store's workflow pages (bean `folio-assistant-v49e`): one per
 * instance at `<store page>/workflows/<id>/`, and the hub listing them.
 * Returns the store's orphaned instance pages, site-relative.
 */
/** How many workflow instance pages this run drew: each one reads `state.jsonld` when it loads. */
let workflowPagesDrawn = 0;
function drawWorkflows(visualiser: string, s: InstanceSubject, storeDir: string, models: ReadonlyMap<string, ModelRead>): string[] {
  const read = readSubjectBeans(s.instanceRoot);
  if (!("beans" in read) || read.beans === null) return [];
  const view: WorkflowViewContext = { beans: read.beans, now: NOW, ends: endsOf(models) };
  const flows = readInstances(filesIn(storePartDirs(s.absPath, "workflow-state"), ".json"));
  const hubDir = join(storeDir, "workflows");
  const ids: string[] = [];
  for (const r of flows) {
    if (!("state" in r) || !ROUTE_SEGMENT.test(r.state.id)) continue;
    const pageDir = visualiserPageDir(SITE, pageParts({ harness: harnessOf(), visualiser, subgraph: workflowSubgraph(s.name, r.state.id) }));
    ids.push(r.state.id);
    const html = workflowInstancePage({
      instance: r.state,
      store: s.name,
      model: models.get(r.state.id) ?? { missing: "not loaded", recorded: r.state.source ?? "" },
      beans: read.beans,
      todos: todosForView,
      now: NOW,
      ...(rolesForView ? { roles: rolesForView } : {}),
      ...(memoryForView ? { memory: memoryForView } : {}),
      stateDocument: dynamicStateHref(pageDir),
      drawingFor: (bpmn) => {
        const svg = join(SITE, "assets", "img", "workflows", `${basename(bpmn, ".bpmn")}.svg`);
        return existsSync(svg) ? relative(pageDir, svg).split(sep).join("/") : undefined;
      },
      processPageFor: (bpmn) => {
        const dir = processesPageDir();
        return dir === undefined ? undefined : relative(pageDir, join(dir, `${basename(bpmn, ".bpmn")}.html`)).split(sep).join("/");
      },
    });
    emit(join(pageDir, "index.html"), withRenderedByFrontMatter(html, VIEWER_TOOL));
    workflowPagesDrawn++;
  }
  if (flows.length > 0) emit(join(hubDir, "index.html"), withRenderedByFrontMatter(workflowHubPage(s.name, s.absPath, view), VIEWER_TOOL));
  // Archived beans too: archiving is a view, not a state (bean e8m3), so an instance naming one still names a bean of this store.
  let archived: readonly BeanNode[] = [];
  try {
    archived = readArchivedBeans(s.instanceRoot) ?? [];
  } catch {
    // an unreadable archive leaves those beans "not in this store", which the page says
  }
  const pbOrphans = drawProcessedBeans(s.name, s.instanceRoot, storeDir, flows, [...read.beans, ...archived], models);
  const { owned } = orphanSubjectPages(writePathOf(hubDir), ids, carriesMarker(GENERATED_BY));
  return check && builtAtPublishHere(join(hubDir, "x", "index.html")) ? [] : [...owned.map((name) => relative(SITE, join(hubDir, name))), ...pbOrphans];
}
/**
 * A bean store's beans-by-process pages (cat-harness-tools#1413, bean
 * `folio-assistant-pbv1`), every one a path IRI under the store's page:
 * `beans-processed/`, `beans-processed/<processId>/`, `bean-processed/<beanId>/`.
 */
function drawProcessedBeans(store: string, instanceRoot: string, storeDir: string, flows: ReturnType<typeof readInstances>, beans: readonly BeanNode[], models: ReadonlyMap<string, ModelRead>): string[] {
  const instances = flows.flatMap((r) => ("state" in r ? [r.state] : []));
  const web = detectRepoUrl(instanceRoot)?.replace(/\.git$/, "").replace(/\/+$/, "");
  const diagrams = new Map(
    [...models].flatMap(([id, m]) => ("model" in m ? [[id, { nodes: new Set(m.model.nodes.keys()), ends: endNodesOf(m.model) }] as const] : [])),
  );
  // Relative to the STORE page; each page below re-anchors them to its own depth.
  const drawingFor = (bpmn: string): string | undefined => {
    const svg = join(SITE, "assets", "img", "workflows", `${basename(bpmn, ".bpmn")}.svg`);
    return existsSync(svg) ? relative(storeDir, svg).split(sep).join("/") : undefined;
  };
  const rows = processedBeansRows({
    instances,
    beans,
    now: NOW,
    diagrams,
    drawingFor,
    instanceHref: (id) => (ROUTE_SEGMENT.test(id) ? `workflows/${id}/` : undefined),
    // A bean links to its file on the branch that keeps it (beans live on a state branch, not main).
    beanSource: (b) => (web ? branchKeptHref(branchKeptLocation(instanceRoot, b.file, web)) : undefined),
    processPageFor: (bpmn) => {
      const dir = processesPageDir();
      return dir === undefined ? undefined : relative(storeDir, join(dir, `${basename(bpmn, ".bpmn")}.html`)).split(sep).join("/");
    },
    // No forge link for the .bpmn itself: its recorded path is checkout-relative and may sit in a
    // mounted layer's repository, so a link composed here would guess the repository. The process page links it.
  });
  const shell = (title: string, body: string) =>
    withRenderedByFrontMatter(page({ title, noLiquid: true, body: `<style>\n${PB_CSS}\n</style>\n${body}` }), VIEWER_TOOL);
  // Each bean's history, through the work-plan store (cat-harness#991 step 5),
  // with a drawing for every process its instances ran, phases included.
  const wps = new MountedGitBranchStore(instanceRoot);
  const drawings: Record<string, string> = {};
  const collect = (st: InstanceState): void => {
    if (!drawings[st.processId] && st.source) {
      const d = drawingFor(st.source);
      if (d) drawings[st.processId] = `../../${d}`;
    }
    Object.values(st.children ?? {}).forEach(collect);
  };
  instances.forEach(collect);
  const historyOf = (id: string): ProcessedBeanHistory => {
    try {
      return { events: wps.history(id), drawings };
    } catch (e) {
      return { unknown: e instanceof Error ? e.message.split("\n")[0]! : String(e) };
    }
  };
  const all = join(storeDir, "beans-processed");
  // Every bean, not only the ones an instance names: a store with beans and no instance
  // (a content layer, 2026-11-03) otherwise read as an empty page.
  const beanSource = (b: BeanNode): string | undefined => (web ? branchKeptHref(branchKeptLocation(instanceRoot, b.file, web)) : undefined);
  const unplaced = unplacedBeans(beans, rows, beanSource);
  emit(join(all, "index.html"), shell(`${store} — beans by process`, processedBeansBody(store, rebase(rows, "../"), NOW, "../", undefined, unplaced)));
  // Kept for the combined page every store's rows go on (owner, 2026-11-03).
  combinedParts.push({ store, rows, unplaced, needs: readDeclaration(instanceRoot)?.needs ?? [] });
  const routes = processedBeansRoutes(rows);
  for (const p of routes.processes) {
    const mine = rebase(rows.filter((r) => r.process === p), "../../");
    emit(join(all, p, "index.html"), shell(`${store} — beans in ${p}`, processedBeansBody(store, mine, NOW, "../../", p)));
  }
  const one = join(storeDir, "bean-processed");
  for (const b of routes.beans) {
    const mine = rebase(rows.filter((r) => r.beans.some((x) => x.id === b)), "../../");
    emit(join(one, b, "index.html"), shell(`${store} — bean ${b} by process`, processedBeanBody(store, b, mine, NOW, "../../", historyOf(b))));
  }
  if (routes.beans.length > 0 || rows.length > 0) {
    const placed = new Set(routes.beans);
    const listed = beans
      .filter((b) => placed.has(b.id))
      .map((b) => ({ ...unplacedBeans([b], [], beanSource)[0]!, href: `${b.id}/` }))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.id.localeCompare(b.id));
    emit(join(one, "index.html"), shell(`${store} — one bean by process`, processedBeanIndexBody(store, listed, "../")));
  }
  // Pages for a process or bean no instance names any more: the caller prunes them with the store's other orphans.
  return ([[all, routes.processes], [one, routes.beans]] as const).flatMap(([dir, keep]) =>
    check && builtAtPublishHere(join(dir, "x", "index.html"))
      ? []
      : orphanSubjectPages(writePathOf(dir), [...keep], carriesMarker(GENERATED_BY)).owned.map((name) => relative(SITE, join(dir, name))),
  );
}

/** Each bean store's rows, gathered while its pages are drawn, for `…/beans/beans-processed/`. */
let combinedParts: StoreRows[] = [];

const ownName = readDeclaration(ROOT)?.name ?? basename(ROOT);
const SITE_SCOPE = siteScope();
if (SITE_SCOPE !== undefined) console.log(`  scope ${scopeArg(SITE_SCOPE)}: instance pages of these only`);
/**
 * The per-instance visualisers this run draws: this layer's own, and every
 * OTHER layer's `renderedBy: state-viewer` visualiser that is `builtOnHostSite`
 * (cat-harness#1150, item 3, owner card Q-CGI-1 A, 2026-11-09). A layer above
 * this one declares the page for a kind only it registers, and this Tool draws
 * it on the host site under THAT layer's name — so the harness never names a
 * kind from a layer above it. A hosted page is built at publish (a derived
 * host-site route), so `--check` never judges it.
 */
const perInstance: { v: (typeof mine)[number]; harness: string; hosted: boolean }[] = [
  ...mine.filter((x) => x.subgraphs === "instance").map((v) => ({ v, harness: harnessOf(), hosted: false })),
  ...hostedVisualisers(REPO_ROOT, ownName).map((v) => ({ v: v as (typeof mine)[number], harness: v.harness, hosted: true })),
];
for (const { v, harness: vh, hosted } of perInstance) {
  combinedParts = [];
  const pageDirFor = (vis: string) => (hosted ? visualiserPageDir(SITE, pageParts({ harness: vh, visualiser: vis })) : pageDirOf(vis));
  const found = perInstanceSubjects(v, ROOT, vh);
  const { kinds, beans, code, memory, unread, candidates, unrouted } = found;
  // A scoped site (`--scope`, owner 2026-11-08 Q-SZ-2 "B") draws its scope's
  // instance pages only; the hub still stands at the visualiser's route.
  const subjects = found.subjects.filter((s) => inScope(SITE_SCOPE, s.name));
  if (kinds.length === 0 || unread.length > 0) {
    console.error(
      `  ! visualiser \`${v.id}\` asks for per-instance pages of ${kinds.join(", ") || "no kind"}; ` +
        `${unread.join(", ") || "no kind"} has no per-instance renderer (only ${[...PER_INSTANCE_KINDS, ...BEAN_STORE_KINDS, ...MEMORY_KINDS, "code"].join(", ")}) — none drawn`,
    );
    continue;
  }
  for (const s of unrouted) {
    console.error(`  ! visualiser \`${v.id}\`: \`${s.path}\` is declared by ${s.name}, which is not an instance with a route — no page`);
  }
  for (const s of subjects) {
    const dir = visualiserPageDir(SITE, pageParts({ harness: vh, visualiser: v.id, subgraph: s.name }));
    const models = beans ? await workflowModelsOf(s) : undefined;
    const html = beans
      ? beansSubjectPage(v, s, subjects, readSubjectBeans(s.instanceRoot), { now: NOW, ends: endsOf(models!), unlinked: unlinkedSection(s) })
      : code
        ? codeSubjectPage(v, s, subjects, codeDirectoriesOf(candidates, s.name, kinds), pinnedBlobBase(REPO_ROOT, s.name))
        : memory
          ? memorySubjectPage(v, s, subjects, pinnedBlobBase(REPO_ROOT, s.name))
          : instanceSubjectPage(v, s, subjects, undefined, qaLiveSourceOf(s, pinnedMount(REPO_ROOT, s.name)), qaPageInputsOf(v, s, declRead?.visualisers ?? []));
    // ANOTHER layer's page depends on which layers the checkout mounts,
    // so it is built at publish wherever this layer is mounted, listed or not:
    // a downstream index adds layers no list here can name (Uganda #15).
    if (!(check && (hosted || s.name !== ownName))) emit(join(dir, "index.html"), withRenderedByFrontMatter(html, VIEWER_TOOL));
    if (beans) subjectOrphans.push(...drawWorkflows(v.id, s, dir, models!));
  }
  // No state graph draws this visualiser's own page (a registry kind is not
  // state, and neither is `code`), so its hub is drawn here, listing the
  // layer pages. Without it `code/` had a page per layer and none at
  // its own route, which the site-coverage gate refuses (dth-hrh, 2026-10-15).
  if (drawsInstanceHub(kinds, !hosted && graphs.some((g) => g.vis === v.id), found.subjects.length)) {
    if (!hosted) hubs.push(v.id);
    if (!(check && hosted)) emit(join(pageDirFor(v.id), "index.html"), withRenderedByFrontMatter(instanceHubPage(v, subjects), VIEWER_TOOL));
  }
  const parent = pageDirFor(v.id);
  // Every store's beans by process on one page, beside the store pages
  // (owner, 2026-11-03). A store named like that page would be overwritten by
  // it, so such a store is refused, by name, and the combined page not drawn.
  const reserved = subjects.filter((s) => RESERVED_STORE_NAMES.has(s.name)).map((s) => s.name);
  if (beans && reserved.length > 0) {
    console.error(`  ! visualiser \`${v.id}\`: a store may not be named ${reserved.join(", ")} — that is the combined page's route; the combined page is not drawn`);
  } else if (beans && combinedParts.length > 0) {
    emit(
      join(parent, "beans-processed", "index.html"),
      withRenderedByFrontMatter(page({ title: "Beans by process — every store", noLiquid: true, body: `<style>\n${PB_CSS}\n</style>\n${processedBeansCombinedBody(combinedParts, NOW)}` }), VIEWER_TOOL),
    );
  }
  const { owned, foreign } = orphanSubjectPages(writePathOf(parent), [...subjects.map((s) => s.name), ...(beans ? RESERVED_STORE_NAMES : [])], carriesMarker(GENERATED_BY));
  for (const name of foreign) console.error(`  ! ${relative(SITE, join(parent, name))} is not an instance page and does not identify itself — left in place`);
  // Under a built-at-publish route a stale local copy is not a committed
  // orphan, so `--check` does not report it; a write run still prunes it.
  if (!hosted && !(check && builtAtPublishHere(join(parent, "x", "index.html")))) {
    subjectOrphans.push(...owned.map((name) => relative(SITE, join(parent, name))));
  }
}

// Orphans, AFTER the writes so the keep-set is what this run actually wanted.
// Reported by name rather than counted: a deletion nobody is told about is the
// shape `deletion-requires-confirmation` exists to stop, and a bare number
// would not let a reader check the tool picked the right files.
// Under the harness's own segment of the page locale, and — once each, for the
// two moves — at the unlocalised `<harness>/` segment (folio-assistant#2527:
// compose-docs writes a forwarding page there once the old copy is gone) and
// at the site root, where every dashboard was drawn before 2026-10-09. All
// three are safe for the same reason: only a page carrying GENERATED_BY is ever
// a candidate.
const harnessSegment = harnessName ?? basename(ROOT);
// `<locale>/<harness>`: the directory every dashboard of this harness sits in,
// read off the route of any one of them (the segment name is immaterial).
const localisedSegment = dirname(relative(SITE, pageDirOf("dashboard")));
const orphans = [
  ...prunableDashboards(join(SITE, localisedSegment), [...graphs.map((g) => g.vis), ...hubs]).map((o) => join(localisedSegment, o)),
  ...(localisedSegment === harnessSegment
    ? []
    : prunableDashboards(join(SITE, harnessSegment), []).map((o) => join(harnessSegment, o))),
  ...prunableDashboards(SITE, []),
].sort();
for (const o of orphans) {
  console.error(`  ${check ? "!" : "-"} orphan dashboard ${check ? "" : "removed "}${o}`);
}
for (const o of subjectOrphans) {
  console.error(`  ${check ? "!" : "-"} orphan instance page ${check ? "" : "removed "}${o}`);
}

if (check) {
  // Orphans FAIL the check. That is the defect this whole pass fixes: the old
  // `--check` inspected only the files it was about to write, so it reported
  // "up to date" with a page sitting there that answers to no declaration.
  if (stale > 0 || taken.length > 0 || orphans.length > 0 || subjectOrphans.length > 0) {
    if (stale > 0) {
      console.error(`\n${stale} dashboard(s) stale or missing — run \`bun run cat state:visualizer\`.`);
    }
    if (orphans.length + subjectOrphans.length > 0) {
      console.error(
        `\n${orphans.length + subjectOrphans.length} orphan dashboard(s) answer to no declared graph — ` +
          "run `bun run cat state:visualizer` to remove them.",
      );
    }
    process.exit(1);
  }
  console.log(`state visualiser: ${graphs.length} dashboard(s) up to date, no orphans`);
} else {
  // In a mounted layer only the output root's copy is this run's to remove;
  // the pinned bytes are the layer's own and are never written.
  for (const o of orphans) {
    const at = writePathOf(join(SITE, o));
    if (existsSync(at)) unlinkSync(at);
  }
  for (const o of subjectOrphans) rmSync(writePathOf(join(SITE, o)), { recursive: true, force: true });
  // The workflow pages read `<site>/<harness>/state.jsonld` when they load.
  // The platform's own render pipeline exports it as stage 3 (`kg-dynamic`),
  // but a folio's site build runs this writer and no stage 3, so its pages
  // linked a file that was never there (smart-ra, 2026-10-30: the publish's
  // link check refused it). The writer of the pages writes the file they read,
  // with the one writer stage 3 uses ({@link writeDynamicState}); stage 3,
  // where it runs, rewrites it.
  if (workflowPagesDrawn > 0) {
    const { out } = await writeDynamicState(undefined, { now: NOW });
    console.log(`  wrote ${relative(ROOT, out)} for ${workflowPagesDrawn} workflow page(s)`);
  }
  console.log(`\nWrote ${wrote} dashboard(s) under ${relative(ROOT, SITE)}/`);
  if (taken.length > 0) process.exit(1);
}
}
