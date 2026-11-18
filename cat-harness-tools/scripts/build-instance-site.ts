#!/usr/bin/env bun
/**
 * Build a layer's own site from its checkout, check it, and (optionally)
 * publish it: the root site, or a branch preview at `branches/<branch>/`.
 *
 * @module cat-harness-tools/scripts/build-instance-site
 *
 * Owner, 2026-10-10: publishing is agent-run, never a GitHub Actions workflow,
 * and staging previews are agent-run too (bean `n3h9`). Until now the recipe
 * lived only as prose in a Routine's prompt (a downstream's publish Routine), so
 * every runner re-typed it and each copy could drift. This is that recipe as
 * one command, the same for an agent, a person or a Routine:
 *
 *   bun run cat-harness-tools/scripts/build-instance-site.ts --root <checkout> --instance <name>
 *
 * reads the steps from the layer's `index.config.json` entry `site.build` ({@link recipeFromConfig};
 * a legacy `<name>.config.json` only as a reported fallback, bean `ymvt`).
 * Any step flag below replaces it whole (no merging of flags and recipe):
 *
 *   bun run cat-harness-tools/scripts/build-instance-site.ts --root <checkout> \
 *     --instance <name> --home <page.md> \
 *     --pre <package script> --source-step <package script> --site-step <package script> \
 *     [--staging <branch>] [--publish --remote <git url>]
 *
 * Steps, each a stop on failure (never a skip):
 *
 *  1. mount the closure `index.config.json` pins (`remote-mount.ts`), unless `--no-mount`.
 *     A build writes into its mounts (the harness's `_data/harness.json`, `node_modules`), and
 *     remote-mount rightly refuses to overwrite a mount that no longer hashes to its lock. So
 *     `--fresh` has the mount script replace the mounts the build wrote into (`remote-mount.ts
 *     --fresh`); with `--no-mount` it removes exactly the paths the lock names, and only paths the checkout
 *     itself does not track: an explicit choice, never a default
 *  2. `bun install --no-save` in the checkout and in every mounted layer
 *     with a package.json, so a mount still hashes to its lock and the next mount can verify it
 *  3. each `--pre` package script (`bun run <name>`), in the checkout: the layer's own gates
 *  4. landing data and the chrome: sync-docs-harness, gen-landing-data, the publish-time
 *     writers whose `builtAtPublish` output lies in the chrome ({@link chromeArtefacts}:
 *     `avatars:css`), compose-docs --shell,
 *     gen-navbar-include; `--home` becomes the site's index.md; each `--source-step` package
 *     script runs as `bun run <name> <site source>`
 *  4b. the writer of every declared visualiser page the site source does not hold yet — the
 *     checkout's own layer and every layer it needs — as its Tool declares it, pointed at
 *     the site source by the Tool's `site` input (`visualiser-writers.ts`; owner, 2026-10-15)
 *
 * `--pre`, `--source-step`, `--site-step` and `--final-step` take package SCRIPT NAMES, never commands: the
 * Tool contract admits no input that can carry a shell payload (check:tools),
 * so what runs is what the layer's own package.json says, and nothing else.
 *  5. Jekyll, as preview-site.sh does it: remote_theme dropped (codeload is not reachable
 *     everywhere), title and description from the layer's declaration, baseurl from the
 *     git remote (`/<repo>`, or `/<repo>/branches/<branch>` for a preview)
 *  6. each `--site-step` package script, as `bun run <name> <built site>`: a generator that
 *     writes finished pages AFTER the site is built (gen-node-kind-pages says so of itself).
 *     As a source step its pages would pass through Jekyll, which drops every `_`-prefixed
 *     directory: a node at `docs/_data/node-kinds` lost its page that way. Then
 *     gen-node-kind-pages, on every site, unless a site step already ran it (the schemas
 *     page links every node kind's pages; owner, 2026-11-13). Then mount-instance-docs, pdf-viewer, suggest-editor, set-html-lang, publish-id-lookup,
 *     rail-standalone-pages; then each `--final-step` package script, the same way, for a step
 *     that must see every page of the finished site, the platform's own too (an IG's one bar on
 *     the identifier lookup page; owner, 2026-10-15); then the forwarding pages; then the search
 *     scopes (`search-split.ts`: the manifest and one index per scope, so a reader never loads
 *     the whole site's index); then `.nojekyll`; then the 404 page's English fallback
 *     (`lib/locale-fallback-404.ts`)
 *  7. every relative or base-rooted href/src/action in every page resolves to a file
 *     under the site (read with an HTML parser, HTMLRewriter, not a regex)
 *  8. for the root, the guard (`site-parity.ts`): the build is measured against the root it
 *     would replace, read from the remote's publish branch (or `--parity-against <dir>`), on
 *     the pages — the theme's side bar and search, the icon row, the rail, the top-level
 *     directories, the `folio-build.json` stamp. With `--publish` a shortfall refuses; without,
 *     it is said. Owner, 2026-10-14: an IG's main site published by this path loses nothing
 *     `folio-site.yml` gave it.
 *  9. with `--publish`: the root replaces the branch but keeps `branches/`, `PC/`, `_render-log/` and
 *     every `site.build.keep` entry (an IG's `branches/`); a preview replaces only `branches/<branch>/`
 *
 * Every step runs with the build's own values in its environment ({@link siteStepEnv}:
 * `SITE_INSTANCE`, `SITE_TITLE`, `SITE_BASEURL`, `SITE_URL`, `SITE_LINK_ROOT`,
 * `SITE_WORK`, `SITE_SOURCE`, `SITE_DIR`, `SITE_REPOSITORY`, `SITE_COMMIT`, `SITE_REF`), so an IG declares `folio-site.yml`'s
 * steps as its own package scripts — the platform scripts that workflow runs,
 * with the arguments it passes — and no step is written here for one kind of site.
 *
 * What it does NOT do: decide whether to publish. `--publish` is the caller's
 * explicit act; without it the run builds and checks, and says where the site is.
 *
 * @covers none — a build step: it composes existing generators and judges no graph
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

import { publishSite } from "@litlfred/bootstrap-tools/scripts/publish-site.ts";
import { siteDirFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { findDeclarationFile } from "../schemas/kg/instance-roots.ts";

import { checkInlineScripts } from "./check-inline-scripts.ts";
import { checkAnchors } from "./check-anchors.ts";
import { shellQuote } from "./run-script.ts";
import { overlayPath } from "./lib/layer-output.ts";
import { chromeLayers, writeForwardingPages } from "./compose-docs.ts";
import { ensurePublishBranch } from "./lib/publish-branch.ts";
import { ownsScript, writerCommand } from "./lib/script-command.ts";
import { editedMountsIn, relayAdvice } from "./remote-mount.ts";
import { BESIDE_SOURCE_OUT_ENV } from "./lib/beside-source-out.ts";
import { built, declaredPlan, runWriter, writersOf, type DeclaredArtefact, type WriterOutcome } from "./derive-at-publish.ts";
import { describeFeatures, droppedByRuling, type DroppedByRuling, PARITY_REPORT, parityReport, readParityReport, siteFeatures, writeParityReport } from "./site-parity.ts";

/**
 * The rail pass ("rail on every page") replaces the theme's side bar on every
 * page it builds, so a theme site's build never carries `#site-nav`. That is
 * the owner's ruling, not a shortfall. Owner, 2026-10-15, "Replace sidebar
 * after build" (one rail everywhere): the folio rail stands in for the theme's
 * side menu. The search box and the rail itself stay required.
 */
export const THEME_SIDEBAR_RULING: DroppedByRuling = {
  feature: "siteNav",
  ruling: 'owner, 2026-10-15, "Replace sidebar after build": the rail pass replaces the theme\'s side bar on every page (one rail everywhere)',
};
import { expectedPages, siteCoverageShortfall } from "./site-coverage.ts";
import { placeSiteQaPanel, siteQaRoutes } from "./site-qa-panel.ts";
import { declaredVisualisers } from "./viewer-declarations.ts";
import { pagesEmbedPdf, pruneUnreferencedImages } from "./lib/site-prune.ts";
import { servedOverHttp, shareAssets } from "./lib/shared-assets.ts";
import { scopeArg } from "./lib/site-scope.ts";
import { instanceRoots, writeMissingVisualisers } from "./visualiser-writers.ts";
import { legacyNotice, readInstanceConfig, type InstanceConfigRead } from "./instance-config.ts";
import { PC_PREFIX } from "./publish-main-site.ts";
import { reviewSiteSize, SITE_SIZE_FILE } from "./site-size.ts";
import { langTabs, UN_LOCALES } from "./lib/lang-tabs.ts";
import { writeLocaleFallback404 } from "./lib/locale-fallback-404.ts";
import { describeSplit, SCOPES_DIR, SOURCE_PATH as SEARCH_SOURCE, splitSite } from "./search-split.ts";
import { PREVIEW_PREFIX, PREVIEW_PREFIXES, previewPath } from "./lib/preview-prefix.ts";
import { applyPreset, PRESET_NAME, skipReason } from "./lib/site-presets.ts";

const TOOLS = "cat-harness-tools/scripts";

export interface BuildOptions {
  root: string;
  instance: string;
  linkRoot: string;
  out: string;
  home?: string;
  pre: string[];
  sourceSteps: string[];
  /** Package scripts run as `bun run <name> <built site>` after Jekyll: generators that write finished pages. */
  siteSteps?: string[];
  /**
   * Package scripts run as `bun run <name> <built site>` LAST: after the platform's own writers
   * (layer docs, identifier lookup, the rail on standalone pages), before the parity guard and
   * the link check. For a step that must see every page of the finished site, the platform's too.
   */
  finalSteps?: string[];
  staging?: string;
  /**
   * Where the preview of `staging` is published, relative to the publish root, when not
   * {@link stagingDir}'s: an IG repository's folio preview shares the IG Publisher's own
   * `branches/<last path component>/` (owner, 2026-11-05).
   */
  stagingDir?: string;
  /**
   * Run on the finished site after the link check and before the publish
   * (and when nothing is published). A preview's data steps go here: the
   * ChangeSet and the staging banner the review page reads, which only the
   * workflow-described path wrote until dth-hrh's review walkthrough
   * (bean xp72, 2026-10-15) found its previews carried none.
   */
  beforePublish?: (site: string) => void;
  mount: boolean;
  /** Remove the lock's mount paths first, so a build that wrote into them cannot block the next mount. */
  fresh: boolean;
  publish: boolean;
  remote?: string;
  message?: string;
  /**
   * The site's title and description when the checkout declares no layer:
   * a repository that only mounts layers (`index.config.json`), such as an IG
   * repository on its base harness. `instance` is then the chrome's SCOPE, a
   * layer the checkout mounts, and the title is the site's own.
   */
  identity?: { title: string; description?: string };
  /** Root entries a root publish keeps besides `branches/` and `_render-log/` (an IG's `branches/` previews). */
  keep?: string[];
  /**
   * The root publish's guard ({@link parityShortfall}): the built site is measured against
   * the root it replaces — read from `parityAgainst`, else from `remote`'s publish branch.
   * A shortfall is REPORTED (`report`, the default): said in the log and written to
   * {@link PARITY_REPORT} for the site's QA page, and the site is still published
   * (owner, 2026-11-14: "It shouldn't fail if there is an issue it should be a QA
   * report"). `refuse` keeps the old gate for a caller that asks for it.
   */
  parity?: "refuse" | "report" | "off";
  parityAgainst?: string;
  /**
   * Top-level directories the current root serves that this build drops by the
   * owner's ruling ({@link DroppedByRuling}): not a shortfall, and said with the
   * ruling. Matches directory names only; it excuses nothing else.
   */
  parityDropped?: DroppedByRuling[];
  /** The platform steps around the declared ones ({@link PROFILE_STEPS}); `folio` when absent. */
  profile?: SiteProfile;
  /**
   * `report` (the default): unresolved links are said, and do not stop the publish. `refuse`
   * stops it on ANY unresolved internal link: the platform's pages, the pages the content
   * supplies, absolute links to the site's own address and links inside diagrams
   * (cat-harness-tools#2345). Namespace IRIs ({@link isNamespaceIri}) are never pages.
   */
  links?: "refuse" | "report";
  /**
   * The shared site preset the steps build on (`lib/site-presets.ts`): resolved after the
   * mount, its steps run before the recipe's own ({@link mergeSteps}).
   */
  extends?: string;
  /** `report` (the default): a declared visualiser page the site lacks ({@link siteCoverageShortfall}) is said, and does not stop the publish; `refuse` stops it. */
  coverage?: "refuse" | "report";
  /**
   * After the platform's writers, write every layer's graph document and the
   * root index, `index.jsonld` and `index.json` (`publish-root-index.ts`).
   * Opt-in (`site.build.rootIndex: true`): it adds every layer's export to the
   * site, and it refuses the publish rather than map fewer layers than the
   * checkout declares (owner, 2026-11-13).
   */
  rootIndex?: boolean;
  /** Root files the built site must hold before it is published (a step's promise, checked). */
  require?: string[];
  /** The visualiser-writer step, replaceable in a test; {@link writeMissingVisualisers} by default. */
  writeVisualisers?: (root: string, source: string, opts: { staging?: boolean; scope?: readonly string[] }) => unknown;
  /**
   * The instances whose visualiser pages this site writes and owes ({@link siteScopeOf}).
   * Absent: every instance the checkout mounts (the hub's site, or a checkout naming no landing).
   */
  scope?: readonly string[];
}

/**
 * The host this checkout's site loads its shared assets from (`site.sharedAssets`
 * in `index.config.json`; Q-SZ-7 "A"), or undefined when it names none.
 */
export function sharedAssetsOf(root: string): string | undefined {
  const file = join(root, "index.config.json");
  if (!existsSync(file)) return undefined;
  try {
    const v = (JSON.parse(readFileSync(file, "utf-8")) as { site?: { sharedAssets?: unknown } }).site?.sharedAssets;
    return typeof v === "string" && /^https:\/\/[^/]+\/(?:\S*\/)?$/.test(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The instances whose pages a site writes: its own only. An IG that lands on
 * another layer borrows that layer's chrome and theme, not its pages (owner,
 * 2026-11-10: the base IG's pages should not be in an IG's site, only cross
 * referenced; this supersedes Q-SZ-2 "B", which kept the landing layer's
 * pages). A folio that lands on itself is scoped the same way (owner,
 * 2026-11-13: "other harnesses should be referenced not included"). It used
 * to carry every instance it mounts, which put a mounted content layer's
 * thousands of reference pages, its library files and the harness's pages
 * in a folio's site and took it past Pages' 1 GB limit. Every other layer's
 * pages are linked on the platform's site.
 *
 * Undefined (every instance) only for the hub, which exists to carry them
 * all, and for a checkout that names no landing.
 */
export function siteScopeOf(root: string, instance: string): string[] | undefined {
  const file = join(root, "index.config.json");
  if (!existsSync(file)) return undefined;
  let landing: unknown;
  try {
    landing = (JSON.parse(readFileSync(file, "utf-8")) as { site?: { landing?: unknown } }).site?.landing;
  } catch {
    return undefined;
  }
  if (typeof landing !== "string" || landing === "hub") return undefined;
  return [instance];
}

/** The `require`d root files a built site does not hold. */
export function missingRequired(site: string, required: readonly string[]): string[] {
  return required.filter((f) => !existsSync(join(site, f)));
}

/**
 * WHAT STILL REFUSES A PUBLISH: graph data, a `.json` or `.jsonld` file.
 *
 * Owner, 2026-11-14, after a folio's root publish was refused for a missing
 * icon row: *"It shouldn't fail if there is an issue it should be a QA
 * report"*, then *"only refuse should be related to json(ld) publishing"*, and
 * *"if there is a required sub-graph then that json(ld) should also be
 * required to publish, but not all of its stuff."* So a declared layer's or
 * sub-graph's graph document missing refuses (`publish-root-index.ts` already
 * refuses a short map), while its pages, links, scripts and stylesheets are
 * findings: said in the log, written to {@link BUILD_QA_REPORT}, and published.
 * A build that cannot run at all (a bad recipe, a failed step, a failed push)
 * still stops, since there is no site to report on.
 */
export const isGraphData = (path: string): boolean => /\.json(ld)?$/i.test(path);

/** Where a build leaves the findings it published with, beside the link report, for the QA page. */
export const BUILD_QA_REPORT = "assets/site-qa/build.json";

/** One finding a build published with instead of refusing. */
export interface BuildFinding {
  check: "required" | "coverage" | "inline-scripts" | "chrome";
  detail: string;
}

/** Write {@link BUILD_QA_REPORT}: every finding, in the order found. Deterministic. */
export function writeBuildQa(site: string, findings: readonly BuildFinding[]): void {
  const file = join(site, BUILD_QA_REPORT);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ $schema: "site-build-qa/v1", findings }, null, 1) + "\n");
}

/**
 * The environment every step runs with, so a step needs no flag for what the
 * build already knows: the site's base path, and the file in which a step
 * lists the pages whose links are the CONTENT's own (see {@link checkLinks}).
 */
export const STEP_ENV = { baseurl: "FOLIO_SITE_BASEURL", upstreamPages: "FOLIO_SITE_UPSTREAM_PAGES" } as const;

/**
 * How a step runs: `bun run <name>` from the checkout's own `package.json`, or,
 * in a checkout with none (it only mounts layers), through `run-script.ts`,
 * which finds the name among the mounted layers' checkout scripts. Either way
 * a step is a script NAME, never a command.
 */
export function stepCommand(root: string, name: string, presetScripts: Readonly<Record<string, string>> = {}): string {
  if (!SCRIPT_NAME.test(name)) throw new Error(`${JSON.stringify(name)} is not a package script name`);
  if (ownsScript(root, name)) return `bun run ${name}`;
  // A shared preset's command (`lib/site-presets.ts`): run from the checkout root with the
  // step's arguments appended, as a package script is. The checkout's own script wins.
  const preset = presetScripts[name];
  if (preset !== undefined) return preset;
  return `bun run ${shellQuote(join(import.meta.dir, "run-script.ts"))} ${name}`;
}

/**
 * How a chrome writer runs: `lib/script-command.ts`, shared with the
 * visualiser writers. Re-exported here, where its callers first found it.
 */
export { writerCommand };

/**
 * The site-relative pages a step listed as carrying the content's own links:
 * one path per line, `#` comments and blank lines ignored.
 */
export function readUpstreamPages(file: string): Set<string> {
  if (!existsSync(file)) return new Set();
  return new Set(readFileSync(file, "utf-8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("#")));
}

/** A branch's preview directory: `branches/<branch as one safe path segment>` (`lib/preview-prefix.ts`). */
export function stagingDir(branch: string): string {
  const seg = branch.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (seg === "" || seg === "." || seg === "..") throw new Error(`branch ${JSON.stringify(branch)} gives no usable ${PREVIEW_PREFIX}/ segment`);
  return previewPath(seg);
}

/**
 * The fields of the layer's declaration this tool reads: name, title and
 * description, and only those. Read STRUCTURALLY, as remote-mount reads mount
 * fields (bean qump): a full read needs every graph typology the declaration
 * names to be registered, and some are registered by the layers the mount
 * lays down (a layer may name a kind, such as `catalogue`, that a layer it
 * mounts registers). Run from a sibling toolset,
 * the full read refused a declaration the build could otherwise serve.
 */
export function siteFields(text: string, file: string): { name: string; title?: string; description?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`${file} is not valid JSON: ${(e as Error).message}`);
  }
  const r = raw as { name?: unknown; title?: unknown; description?: unknown };
  if (typeof r?.name !== "string" || r.name === "") throw new Error(`${file} declares no name`);
  return {
    name: r.name,
    title: typeof r.title === "string" ? r.title : undefined,
    description: typeof r.description === "string" ? r.description : undefined,
  };
}

/**
 * The gate every site build runs before its recipe's own `pre` steps: the
 * library completeness check folio-assistant's publish runs (`qa:refresh` runs
 * `check:l1-complete --write`). A per-repository site carried library pages the
 * index's publish would refuse, because nothing ran the check there (owner,
 * 2026-10-16: "1" — every repository refuses what folio-assistant refuses).
 * A QA-only finding such as `image-descriptions` (#364) is reported and does
 * not fail it; an entry with nothing to check exits 0.
 */
export const LIBRARY_GATE = "check:l1-complete";

/** The pre steps a build runs, in order: the library gate first, then the recipe's own, the gate never twice. */
export function gateSteps(pre: readonly string[]): string[] {
  return [LIBRARY_GATE, ...pre.filter((p) => p !== LIBRARY_GATE)];
}

/**
 * The writer of every node-kind page (`/<locale>/<declaring>/<kind>/…`).
 * The schemas visualiser, which every site carries, links each node kind
 * there, so every site owes those pages: a layer whose recipe named no
 * site step published 34 dead node-kind links on its schemas page (owner,
 * 2026-11-13, node-kind audit). It runs on the built site, as a site step
 * does, for every site.
 */
export const NODE_KIND_PAGES = "gen-node-kind-pages.ts";

/** The writer of each harness's overview page (`gen-harness-pages.ts`), run on every site after {@link NODE_KIND_PAGES}. */
export const HARNESS_PAGES = "gen-harness-pages.ts";

/**
 * Whether one of the recipe's own steps already runs {@link NODE_KIND_PAGES}
 * (a folio's `site:node-kinds`), so the build does not run it twice: the
 * step's command in the checkout's package.json names the writer.
 */
export function recipeWritesNodeKindPages(root: string, steps: readonly string[]): boolean {
  const file = join(root, "package.json");
  if (!existsSync(file)) return false;
  let scripts: Record<string, unknown> | undefined;
  try {
    scripts = (JSON.parse(readFileSync(file, "utf-8")) as { scripts?: Record<string, unknown> }).scripts;
  } catch {
    return false;
  }
  return steps.some((s) => typeof scripts?.[s] === "string" && (scripts[s] as string).includes(NODE_KIND_PAGES));
}

/** A package script name: what `--pre` and `--source-step` accept, and nothing that could carry a shell payload. */
export const SCRIPT_NAME = /^[A-Za-z0-9][A-Za-z0-9:._-]*$/;

/** The steps that build a layer's site, as its own package script names. */
export interface SiteRecipe {
  home?: string;
  pre: string[];
  sourceSteps: string[];
  siteSteps: string[];
  /** Run after the platform's own writers ({@link BuildOptions.finalSteps}). */
  finalSteps?: string[];
  /** Root entries a root publish keeps, besides `branches/` and `_render-log/`: an IG keeps `branches/`, its Publisher previews. */
  keep?: string[];
  /**
   * Which platform steps run around the declared ones ({@link PROFILE_STEPS}): `folio` (the
   * default) runs every one; `ig-repo-site` runs exactly the platform steps the FHIR IG harness's
   * `templates/ig-repo-site/folio-site.yml` runs — the shell, its navbar, Jekyll, the rail.
   */
  profile?: SiteProfile;
  /** An unresolved link is only said (`report`, the default; owner 2026-11-14) or refuses the publish (`refuse`). */
  links?: "refuse" | "report";
  /** The shared site preset this recipe builds on (`templates/site-presets/<name>.json` of a mounted layer; cat-harness-tools#2345). */
  extends?: string;
  /** A declared visualiser page missing from the built site is only said (`report`, the default; owner 2026-11-14) or refuses the publish (`refuse`). */
  coverage?: "refuse" | "report";
  /** Publish every layer's graph document and the root index, `index.jsonld` ({@link BuildOptions.rootIndex}). */
  rootIndex?: boolean;
}

export type SiteProfile = "folio" | "ig-repo-site";

/**
 * The platform steps each profile runs besides the shell, its navbar, Jekyll and the rail.
 * An IG repository's own site (`folio-site.yml`) never ran the folio's landing data, layer
 * mounts, PDF viewer, `lang` pass or identifier lookup: run there, `mount-instance-docs` laid
 * seven other layers' directories at an IG's root (a DAK IG, measured 2026-10-14).
 *
 * `own-chrome`: the shell carries the chrome of the checkout root's OWN docs layers as well as
 * the platform's. `folio-site.yml` composed the shell in a folio-assistant checkout, which
 * declares no root docs layer, so an IG's shell never carried its own; run from the IG's
 * checkout it did, and the IG's `docs/assets/` arrived twice — once in the shell, once from
 * `stage-ig-sites`, which builds `docs/` into the IG site and refuses a path the host already
 * holds (a DAK IG, 2026-10-14). `stage-ig-sites` owns that directory.
 */
export const PROFILE_STEPS: Record<SiteProfile, ReadonlySet<string>> = {
  folio: new Set(["sync", "landing", "mount", "pdf", "suggest", "lang", "lookup", "own-chrome"]),
  "ig-repo-site": new Set(),
};

/** The chrome step's `compose-docs` flags for a profile: always a shell, platform-only unless the profile carries its own chrome. */
export function shellFlags(profile: SiteProfile = "folio"): string {
  return PROFILE_STEPS[profile].has("own-chrome") ? "--shell" : "--shell --platform-only";
}

/** A root entry a recipe may keep: one plain path segment. */
export const KEEP_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

/**
 * The recipe layer `instance` declares under `site.build`, or undefined
 * when it declares none. Owner, 2026-10-10: "i want one consolidated
 * worfklow". The recipe lived only as prose in a folio's AGENTS.md, so
 * `stage-local.ts` could not find it and every runner re-typed it. The
 * cat-harness schema is `HarnessSiteBuildSchema`. It is read here
 * structurally, so this compiles against a cat-harness pin from before that
 * schema, and every step is held to {@link SCRIPT_NAME} exactly as the flags are.
 *
 * READ INDEX FIRST (bean `ymvt`, owner 2026-10-14: *"i thought ONLY
 * index.config.json"*): the layer's `index.config.json` entry, inline; a
 * root `<instance>.config.json` only as a fallback that {@link recipeRead}
 * reports as legacy. Until 2026-10-14 this read the file directly, so a
 * repository had to keep one to publish
 * (https://github.com/litlfred/smart-trust/pull/33).
 */
export function recipeRead(root: string, instance: string): { recipe?: SiteRecipe; read: InstanceConfigRead } {
  const read = readInstanceConfig(root, instance);
  const site = read.config?.site;
  const build = site !== null && typeof site === "object" ? (site as { build?: unknown }).build : undefined;
  if (build === undefined || build === null || typeof build !== "object") return { read };
  const b = build as Record<string, unknown>;
  const list = (k: string): string[] => {
    const v = b[k] ?? [];
    if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && SCRIPT_NAME.test(x))) {
      throw new Error(`${read.from}: site.build.${k} must be a list of package script names`);
    }
    return v as string[];
  };
  const home = b.home;
  const where = read.from;
  if (home !== undefined && typeof home !== "string") throw new Error(`${where}: site.build.home must be a path`);
  const profile = b.profile ?? "folio";
  if (profile !== "folio" && profile !== "ig-repo-site") throw new Error(`${where}: site.build.profile must be folio or ig-repo-site`);
  // Kept only when declared: a preset's `refuse` must not be overridden by a default.
  const links = b.links;
  if (links !== undefined && links !== "refuse" && links !== "report") throw new Error(`${where}: site.build.links must be refuse or report`);
  const coverage = b.coverage;
  if (coverage !== undefined && coverage !== "refuse" && coverage !== "report") throw new Error(`${where}: site.build.coverage must be refuse or report`);
  const ext = b.extends;
  if (ext !== undefined && (typeof ext !== "string" || !PRESET_NAME.test(ext))) throw new Error(`${where}: site.build.extends must be a site preset name`);
  const rootIndex = b.rootIndex ?? false;
  if (typeof rootIndex !== "boolean") throw new Error(`${where}: site.build.rootIndex must be true or false`);
  const keep = b.keep ?? [];
  if (!Array.isArray(keep) || !keep.every((x) => typeof x === "string" && KEEP_NAME.test(x))) throw new Error(`${where}: site.build.keep must be a list of root entry names`);
  return {
    recipe: {
      ...(home !== undefined ? { home } : {}),
      pre: list("pre"),
      sourceSteps: list("sourceSteps"),
      siteSteps: list("siteSteps"),
      ...(list("finalSteps").length ? { finalSteps: list("finalSteps") } : {}),
      ...(keep.length ? { keep: keep as string[] } : {}),
      ...(profile !== "folio" ? { profile } : {}),
      ...(links !== undefined ? { links: links as "refuse" | "report" } : {}),
      ...(coverage !== undefined ? { coverage: coverage as "refuse" | "report" } : {}),
      ...(ext !== undefined ? { extends: ext as string } : {}),
      ...(rootIndex ? { rootIndex } : {}),
    },
    read,
  };
}

/** {@link recipeRead}'s recipe, saying on stderr when it came from a legacy `<instance>.config.json`. */
export function recipeFromConfig(root: string, instance: string): SiteRecipe | undefined {
  const { recipe, read } = recipeRead(root, instance);
  const notice = legacyNotice(read);
  if (recipe !== undefined && notice !== undefined) console.warn(notice);
  return recipe;
}

/** owner and repository name from a GitHub remote URL (https or ssh). */
export function ownerRepo(url: string): { owner: string; repo: string } | undefined {
  const m = url.trim().match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1]!, repo: m[2]! } : undefined;
}

/**
 * The front-matter default that gives a page with no `layout:` the theme's
 * `default`. GitHub Pages does this itself (`jekyll-default-layout`, which the
 * `github-pages` gem always enables), so the platform site never needed it; a
 * local `jekyll build` does not, and a viewer page written for the platform
 * site (`gen-methodologies-viz.ts`, `gen-processes-viz.ts`, …: front matter and
 * a body, no layout) came out of this build as a bare fragment — no chrome, no
 * `<body>` for the staging banner. The path `""` is the least specific scope,
 * so a page's own `layout:` and every narrower default still win.
 */
export const DEFAULT_LAYOUT = ['  - scope:', '      path: ""', "    values:", "      layout: default"];

/** Jekyll's build config: the layer's own, minus the remote theme it cannot fetch, plus {@link DEFAULT_LAYOUT}. */
export function buildConfig(configYml: string): string {
  const lines = configYml
    .split("\n")
    .filter((l) => !/^remote_theme:/.test(l))
    .map((l) => l.replace(/^(\s*)- jekyll-remote-theme\s*$/, "$1- jekyll-seo-tag"));
  const at = lines.findIndex((l) => /^defaults:\s*$/.test(l));
  if (at >= 0) lines.splice(at + 1, 0, ...DEFAULT_LAYOUT);
  else lines.push(...(lines.at(-1) === "" ? [] : [""]), "defaults:", ...DEFAULT_LAYOUT, "");
  return lines.join("\n");
}

/**
 * The override layered on top: what the declaration and the remote say, never a guess.
 *
 * And no Sass source maps: jekyll-sass-converter 3 writes a `.css.map` beside
 * each compiled stylesheet by default (the theme's three colour schemes, about
 * 0.3 MB on every site) and a `sourceMappingURL` comment naming it. A published
 * site has no use for either, so neither is written.
 */
export function overrideConfig(o: { title: string; description?: string; baseurl: string; url: string }): string {
  const q = (s: string) => JSON.stringify(s);
  return [
    `title: ${q(o.title)}`,
    ...(o.description ? [`description: ${q(o.description.split("\n")[0]!)}`] : []),
    `baseurl: ${q(o.baseurl)}`,
    `url: ${q(o.url)}`,
    "theme: just-the-docs",
    "sass:",
    "  sourcemap: never",
    "",
  ].join("\n");
}

/** Every `.html` file under `dir`, skipping vendored assets. */
function htmlFiles(dir: string, ext = ".html"): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) {
        if (relative(dir, p).split(sep).join("/") === "assets/vendor") continue;
        walk(p);
      } else if (n.endsWith(ext)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** The href/src/action values of one page, read by an HTML parser. */
export async function pageUrls(html: string): Promise<string[]> {
  const urls: string[] = [];
  await new HTMLRewriter()
    .on("*", {
      element(el) {
        for (const a of ["href", "src", "action", "xlink:href"]) {
          const v = el.getAttribute(a);
          if (v) urls.push(v);
        }
      },
    })
    .transform(new Response(html))
    .text();
  return urls;
}

/**
 * Where a URL lands under the site, or undefined when it is not ours to check
 * (external, a scheme, a bare anchor). `base` is the site's path prefix
 * (`/repo/` or `/repo/branches/x/`); a root-absolute path outside it is a MISS,
 * reported as such, because the published site cannot serve it.
 */
export function targetOf(url: string, pageRel: string, base: string): string | "outside-base" | undefined {
  const u = url.split("#")[0]!.split("?")[0]!;
  if (u === "" || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(u)) return undefined;
  if (u.startsWith("/")) return u.startsWith(base) ? decodeURIComponent(u.slice(base.length)) : "outside-base";
  const dir = dirname(pageRel);
  const parts = (dir === "." ? [] : dir.split("/")).concat(decodeURIComponent(u).split("/"));
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return stack.join("/") + (u.endsWith("/") ? "/" : "");
}

/**
 * A namespace IRI (`…/<layer>/v0/ns`, `…/v0/ns/graphTypology/x`, `…/v0/ns#Term`): an
 * identifier a page links as a name, not a page the site owes. The WHO smart-ra sweep
 * (4,660 links, 2026-11-15) found `/smart-ra/v0/ns` as its only "dead" link, and it is one
 * of these. Never counted as unresolved (cat-harness-tools#2345).
 */
export function isNamespaceIri(url: string): boolean {
  const path = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "").split("?")[0]!;
  return /(?:^|\/)v\d+\/ns(?:[/#]|$)/.test(path);
}

/** True when `rel` resolves to a file the way a static host serves it. */
function served(site: string, rel: string): boolean {
  const p = join(site, rel);
  if (rel === "" || rel.endsWith("/")) return existsSync(join(p, "index.html"));
  if (existsSync(p)) return statSync(p).isFile() || existsSync(join(p, "index.html"));
  return existsSync(`${p}.html`);
}

/**
 * A scoped site's links into another layer's pages (owner, 2026-11-08, Q-SZ-2
 * "B": refer to other harnesses' documentation, do not copy it). The writers
 * wrote the scope's pages only ({@link siteScopeOf}), so a page that names an
 * out-of-scope instance's page (a process another layer declares, a term of
 * its glossary) points at a page this site does not carry. Such a link, and
 * only such a link, is pointed at the same route on `linkRoot`, where that
 * layer's pages are published: its target is unserved here AND lies under a
 * declared visualiser route (`routes`, from `expectedPages`). Any other dead
 * link is left for {@link checkLinks} to refuse. Returns the links rewritten.
 */
export async function relinkOutOfScope(site: string, base: string, linkRoot: string, routes: readonly string[]): Promise<{ links: number; pages: number }> {
  const root = linkRoot.replace(/\/$/, "");
  const under = [...new Set(routes)].filter((r) => r !== "");
  let links = 0;
  let pages = 0;
  for (const page of htmlFiles(site)) {
    const rel = relative(site, page).split(sep).join("/");
    const html = readFileSync(page, "utf-8");
    let n = 0;
    const out = await new HTMLRewriter()
      .on("*", {
        element(el) {
          for (const a of ["href", "src"]) {
            const v = el.getAttribute(a);
            if (!v) continue;
            const t = targetOf(v, rel, base);
            if (typeof t !== "string" || t === "outside-base" || served(site, t) || !under.some((r) => t.startsWith(r))) continue;
            const hash = v.indexOf("#");
            el.setAttribute(a, `${root}/${t}${hash >= 0 ? v.slice(hash) : ""}`);
            n++;
          }
        },
      })
      .transform(new Response(html))
      .text();
    if (n === 0) continue;
    writeFileSync(page, out);
    links += n;
    pages++;
  }
  return { links, pages };
}

/**
 * Every unresolved link of the built site. A link on a page in `upstream` is
 * returned apart, in `upstreamMisses`: that page carries the CONTENT's own
 * links (an IG's source pages, the IG Publisher's output), whose dead links
 * are the content's to fix and are reported, while a dead link on any other
 * page is the build's and refuses the publish.
 */
export async function checkLinks(
  site: string,
  base: string,
  upstream: ReadonlySet<string> = new Set(),
  selfAddress?: string,
): Promise<{ pages: number; diagrams: number; files: number; misses: string[]; upstreamMisses: string[]; selfMisses: string[]; diagramMisses: string[] }> {
  const misses: string[] = [];
  const upstreamMisses: string[] = [];
  const selfMisses: string[] = [];
  const pages = htmlFiles(site);
  for (const page of pages) {
    const rel = relative(site, page).split(sep).join("/");
    const html = readFileSync(page, "utf-8");
    // The language tabs the chrome draws in the browser (`docs-ui.js`): not in
    // the HTML, so read the way the chrome reads them (`lib/lang-tabs.ts`).
    // Gated on every page, the content's too: the chrome draws the link.
    for (const tab of await langTabs(html, `${base}${rel}`)) {
      const t = targetOf(tab.href, rel, base);
      if (t === undefined) continue;
      if (t === "outside-base" || !served(site, t)) misses.push(`${rel}: ${tab.href} (language tab ${tab.locale}, by ${tab.from})`);
    }
    for (const url of await pageUrls(html)) {
      if (isNamespaceIri(url)) continue;
      const own = selfAddress === undefined ? undefined : selfTargetOf(url, selfAddress);
      if (own !== undefined) {
        if (!served(site, own)) selfMisses.push(`${rel}: ${url}`);
        continue;
      }
      const t = targetOf(url, rel, base);
      if (t === undefined) continue;
      if (t === "outside-base" || !served(site, t)) (upstream.has(rel) ? upstreamMisses : misses).push(`${rel}: ${url}`);
    }
  }
  // Links inside diagrams: a standalone .svg's hrefs resolve against the
  // .svg file. They are the drawing writer's, reported apart and not gated.
  const diagramMisses: string[] = [];
  const diagrams = htmlFiles(site, ".svg");
  for (const svg of diagrams) {
    const rel = relative(site, svg).split(sep).join("/");
    for (const url of await pageUrls(readFileSync(svg, "utf-8"))) {
      if (isNamespaceIri(url)) continue;
      const own = selfAddress === undefined ? undefined : selfTargetOf(url, selfAddress);
      const t = own ?? targetOf(url, rel, base);
      if (t === undefined || (t !== "outside-base" && served(site, t))) continue;
      diagramMisses.push(`${rel}: ${url}`);
    }
  }
  let files = 0;
  const count = (d: string): void => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) count(p);
      else files++;
    }
  };
  count(site);
  return { pages: pages.length, diagrams: diagrams.length, files, misses, upstreamMisses, selfMisses, diagramMisses };
}

/**
 * How many unresolved links stop the publish: under `refuse`, every kind (the platform's,
 * the content's, absolute self-address links, links inside diagrams); under `report`, none.
 */
export function unresolvedCount(
  r: { misses: readonly string[]; upstreamMisses: readonly string[]; selfMisses: readonly string[]; diagramMisses: readonly string[] },
  mode: "refuse" | "report" = "report",
): number {
  return mode === "refuse" ? r.misses.length + r.upstreamMisses.length + r.selfMisses.length + r.diagramMisses.length : 0;
}

/** Where the built site carries its link check's result, from the site root. */
export const LINK_REPORT = "assets/site-qa/links.json";

/** Write {@link LINK_REPORT}: the counts and every unresolved link, by kind. Deterministic. */
export function writeLinkReport(
  site: string,
  r: { pages: number; diagrams?: number; misses: readonly string[]; upstreamMisses: readonly string[]; selfMisses: readonly string[]; diagramMisses?: readonly string[] },
): void {
  const file = join(site, LINK_REPORT);
  mkdirSync(dirname(file), { recursive: true });
  const rows = (xs: readonly string[]) => [...xs].sort().map((x) => ({ page: x.slice(0, x.indexOf(": ")), href: x.slice(x.indexOf(": ") + 2) }));
  writeFileSync(
    file,
    JSON.stringify(
      {
        $schema: "site-link-report/v1",
        pages: r.pages,
        unresolved: rows(r.misses),
        selfAddress: rows(r.selfMisses),
        content: rows(r.upstreamMisses),
        diagrams: r.diagrams ?? 0,
        inDiagrams: rows(r.diagramMisses ?? []),
      },
      null,
      1,
    ) + "\n",
  );
}

/** The site's own published address, `https://<owner>.github.io/<repo>/`: an absolute link to it is a link into this site. */
export const selfAddressOf = (owner: string, repo: string): string => `https://${owner.toLowerCase()}.github.io/${repo}/`;

/**
 * Where an ABSOLUTE link to the site's own address (`selfAddress`, {@link
 * selfAddressOf}) lands in the built tree, or undefined when the link is not
 * one. {@link targetOf} leaves every absolute URL alone, so a writer that
 * composed the site's own URL wrongly was never checked: every journey actor
 * on smart-trust-demo linked `https://litlfred.github.io/smart-trust-demo/ActorDefinition-….html`,
 * a page no build writes (fhir-harness#380). The path is read from the
 * site's root, also in a preview, whose tree is the same site's.
 */
export function selfTargetOf(url: string, selfAddress: string): string | undefined {
  const u = url.split("#")[0]!.split("?")[0]!;
  const at = u.toLowerCase().startsWith(selfAddress.toLowerCase()) ? u.slice(selfAddress.length) : u.toLowerCase() === selfAddress.toLowerCase().replace(/\/$/, "") ? "" : undefined;
  if (at === undefined) return undefined;
  try {
    return decodeURIComponent(at);
  } catch {
    return at;
  }
}

/**
 * The publish-time artefacts the site CHROME holds: every `builtAtPublish`
 * entry of any layer in the checkout whose path lies inside one of the
 * harness's chrome layers ({@link chromeLayers}). Derived from the
 * declarations, so the next stylesheet or script a chrome writer adds is run
 * without a change here.
 *
 * Why the build runs them itself: a folio's site build composes the chrome
 * and never runs `derive:publish`, whose job is the platform's own site. So
 * `site-chrome/assets/css/avatars.css` (writer `avatars:css`), linked from
 * every page's head, was never written, and smart-ra's link check refused the
 * publish over `/smart-ra/assets/css/avatars.css` (2026-10-15).
 */
export function chromeArtefacts(root: string, plan: readonly DeclaredArtefact[] = declaredPlan(root), layers: readonly string[] = chromeLayers(root).map((l) => l.dir)): DeclaredArtefact[] {
  const dirs = layers.map((d) => resolve(d) + sep);
  return plan.filter((a) => dirs.some((d) => resolve(a.abs).startsWith(d)));
}

/**
 * Run the chrome's publish-time writers ({@link chromeArtefacts}) as
 * `derive:publish` runs them. One that says it does not apply to this root
 * (exit 78, `lib/not-applicable.ts`) is reported and its artefacts excused.
 * A writer that fails, or an artefact that came out missing or empty, refuses
 * the build only when that artefact is graph data ({@link isGraphData}); a
 * stylesheet or script is a FINDING, returned for the QA report (owner,
 * 2026-11-14: "only refuse should be related to json(ld) publishing").
 */
export function buildChrome(
  root: string,
  artefacts: readonly DeclaredArtefact[] = chromeArtefacts(root),
  runOne: (writer: string) => WriterOutcome = (w) => runWriter(writerCommand(root, w), root),
): { ran: string[]; skipped: Map<string, string>; findings: BuildFinding[] } {
  const ran: string[] = [];
  const skipped = new Map<string, string>();
  const failed = new Map<string, string>();
  const findings: BuildFinding[] = [];
  for (const w of writersOf(artefacts)) {
    console.log(`▶ chrome artefact writer: ${w}`);
    const o = runOne(w);
    if (o.kind === "failed") {
      const what = `chrome artefact writer ${w} failed (exit ${o.exit ?? "on a signal"})`;
      if (artefacts.some((a) => a.writer.includes(w) && isGraphData(a.path))) throw new Error(`${what}: it writes graph data`);
      failed.set(w, what);
      console.error(`  ✗ ${what} (reported, not gated)`);
      findings.push({ check: "chrome", detail: what });
    } else if (o.kind === "skipped") {
      skipped.set(w, o.why);
      console.log(`  skipped ${w} — it does not apply to this root: ${o.why}`);
    } else ran.push(w);
  }
  const empty = artefacts.filter((a) => !a.writer.some((w) => skipped.has(w) || failed.has(w)) && !built(a));
  const words = (xs: readonly DeclaredArtefact[]) => `${xs.map((a) => `${a.instance}/${a.path}`).join(", ")} came out missing or empty after ${writersOf(xs).join(", ")}`;
  const graph = empty.filter((a) => isGraphData(a.path));
  if (graph.length > 0) throw new Error(`the site chrome's graph data ${words(graph)}`);
  const rest = empty.filter((a) => !isGraphData(a.path));
  if (rest.length > 0) {
    const what = `the site chrome's publish-time artefact(s) ${words(rest)}`;
    console.error(`  ✗ ${what} (reported, not gated)`);
    findings.push({ check: "chrome", detail: what });
  }
  return { ran, skipped, findings };
}

/**
 * The site's knowledge-graph search: the `kg` slice of this checkout as one
 * SQLite file (`gen-slice-sqlite.ts`), its node bodies as content-addressed
 * payloads, and the harness's search page and SQLite client beside them.
 * Nothing here loads on a page view: the page downloads the slice only when a
 * reader opens it, from the search panel's link.
 *
 * Until 2026-11-18 only folio-assistant's own deploy built it; a layer's site
 * had none (owner: "it seems like we've lost some of the search indexing
 * features and layered knowledge graph").
 *
 * A slice that cannot be built is SAID and skipped, never a refused publish:
 * the site's own search does not depend on it, and without the page the panel
 * shows no link (`publishedKgSearch`).
 */
function publishKgSearch(site: string, root: string): void {
  console.log("▶ knowledge-graph search");
  const out = join(site, "assets", "slices");
  const r = spawnSync(
    "bash",
    ["-c", `bun run ${TOOLS}/gen-slice-sqlite.ts --slice kg --out ${shellQuote(out)} --payload-out ${shellQuote(join(site, "payload", "sha256"))} --with-published-payloads`],
    { cwd: root, stdio: "inherit" },
  );
  if (r.status !== 0 || !existsSync(join(out, "kg.sqlite3.json"))) {
    console.log(`knowledge-graph search: the kg slice was not built (exit ${r.status}); the site publishes no KG search`);
    return;
  }
  const harness = join(root, "cat-harness");
  const vendor = "assets/js/vendor/sqlite-wasm";
  const vendorDir = overlayPath(join(harness, siteFileFor(harness, `${vendor}/index.mjs`), ".."));
  const files = [
    "slices/search.html",
    "assets/js/slice-sqlite.js",
    "assets/js/slice-sqlite-worker.js",
    ...(existsSync(vendorDir) ? readdirSync(vendorDir).sort().map((f) => `${vendor}/${f}`) : []),
  ];
  let copied = 0;
  for (const f of files) {
    const src = overlayPath(join(harness, siteFileFor(harness, f)));
    const dst = join(site, f);
    if (existsSync(dst)) continue; // a page the content or another step wrote stays
    if (!existsSync(src)) {
      console.log(`knowledge-graph search: the harness has no ${f}; the site publishes no KG search page`);
      rmSync(join(site, "slices", "search.html"), { force: true });
      return;
    }
    mkdirSync(join(dst, ".."), { recursive: true });
    copyFileSync(src, dst);
    copied++;
  }
  console.log(`knowledge-graph search: ${copied} client file(s) beside the kg slice → slices/search.html?slice=kg`);
}

function run(label: string, cmd: string, cwd: string, env: Record<string, string> = {}): void {
  console.log(`▶ ${label}`);
  const r = spawnSync("bash", ["-c", cmd], { cwd, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status}): ${cmd}`);
}

function capture(cmd: string, cwd: string): string {
  const r = spawnSync("bash", ["-c", cmd], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr}`);
  return r.stdout.trim();
}

/**
 * The jekyll executable the Gemfile in `gemDir` resolves to: the gem's own exe
 * (`bundle exec jekyll` is not on PATH everywhere). It is asked of Bundler, not
 * globbed: a machine with Jekyll 3.10 and 4.4 installed globbed 3.10 first, and
 * 3.10 run under a Jekyll-4 bundle dies on `Sass.load_paths` (sass-embedded).
 */
function jekyllExe(gemDir: string): string {
  const gemfile = shellQuote(join(gemDir, "Gemfile"));
  const bundled = capture(
    `BUNDLE_GEMFILE=${gemfile} bundle exec ruby -e 'print Gem.bin_path("jekyll", "jekyll")' 2>/dev/null || true`,
    gemDir,
  );
  if (bundled) return `ruby ${shellQuote(bundled)}`;
  const found = capture("ls -d /opt/rbenv/versions/*/lib/ruby/gems/*/gems/jekyll-[0-9]*/exe/jekyll 2>/dev/null | sort -V | tail -1 || true", "/");
  if (found) return `ruby ${shellQuote(found)}`;
  return "jekyll";
}

/**
 * Keep a MOUNTED file as pinned across a build that rewrites it.
 *
 * `sync-docs-harness` writes the tiles into `cat-harness/docs/_data/harness.json`,
 * which every later step (landing data, chrome, rail) reads. In a folio that
 * mounts cat-harness, that file is part of a pinned layer: rewriting it left the
 * mount no longer matching index.lock.json, so the NEXT build's mount step
 * refused (`cat-harness/ modified`) until the mount was laid down again by hand
 * (litlfred/dth-hrh, 2026-10-14). Returns the function that puts the pinned
 * bytes back, or removes the file if there was none; a no-op when `path` is not
 * inside a mount (cat-harness building its own site commits the file).
 */
export function keepPinned(path: string, mountDirs: readonly string[], root: string): () => void {
  const rel = relative(resolve(root), resolve(path));
  const inMount = mountDirs.some((m) => rel === m || rel.startsWith(`${m}/`));
  if (!inMount) return () => {};
  const pinned = existsSync(path) ? readFileSync(path) : undefined;
  return () => {
    if (pinned === undefined) rmSync(path, { force: true });
    else writeFileSync(path, pinned);
  };
}

/** The files the build's own steps generate into a site's `_data/`: `sync-docs-harness` and `gen-landing-data`. */
export const GENERATED_DATA = ["_data/harness.json", "_data/stickies.json"] as const;

/**
 * {@link keepPinned} for every {@link GENERATED_DATA} file in every mount's site
 * directory. Not only cat-harness: `gen-landing-data` writes the LANDING's
 * `stickies.json`, which for an IG landing on the DAK base layer is in that layer's
 * mount (litlfred/smart-hiv, 2026-10-14). A mount with no declaration has no site
 * directory and nothing to keep.
 */
export function pinGeneratedData(root: string, mountDirs: readonly string[]): () => void {
  const restores = mountDirs.flatMap((m) => {
    const dir = join(root, m);
    const sites = new Set<string>();
    for (const f of GENERATED_DATA) {
      try {
        sites.add(siteFileFor(dir, f));
      } catch {
        // no declaration: no site directory
      }
      try {
        sites.add(join(siteDirFor(dir), f));
      } catch {
        // no declaration: no site directory
      }
    }
    return [...sites].map((rel) => keepPinned(join(dir, rel), mountDirs, root));
  });
  return () => {
    for (const r of restores) r();
  };
}

/** The mount paths `index.lock.json` names in `root`; empty when there is no lock. */
export function lockedMountPaths(root: string): string[] {
  const lockFile = join(root, "index.lock.json");
  return existsSync(lockFile)
    ? (JSON.parse(readFileSync(lockFile, "utf-8")).instances ?? []).map((i: { path?: string }) => i.path).filter((p: unknown): p is string => typeof p === "string")
    : [];
}

/**
 * What every recipe step is told, in its environment, so a declared step can
 * pass the build's own values to a platform script without a shell payload in
 * the declaration: folio-site.yml's `$INSTANCE`, `$LABEL`, `$BASE`,
 * `$MAIN_SITE` and `$RUNNER_TEMP`, under names of their own.
 */
export function siteStepEnv(v: { instance: string; title: string; baseurl: string; url: string; linkRoot: string; work: string; source: string; site: string; repository?: string; commit?: string; ref?: string }): Record<string, string> {
  return {
    ...(v.repository ? { SITE_REPOSITORY: v.repository } : {}),
    ...(v.commit ? { SITE_COMMIT: v.commit } : {}),
    ...(v.ref ? { SITE_REF: v.ref } : {}),
    SITE_INSTANCE: v.instance,
    SITE_TITLE: v.title,
    SITE_BASEURL: v.baseurl,
    SITE_URL: v.url,
    SITE_LINK_ROOT: v.linkRoot,
    SITE_WORK: v.work,
    SITE_SOURCE: v.source,
    SITE_DIR: v.site,
  };
}

/**
 * The publish branch's current root, laid out in a temporary directory, the
 * `exclude`d root entries left out; undefined when the branch does not exist
 * yet. Read with `git fetch --depth 1` + `git archive`: nothing is cloned
 * into the checkout and nothing is written to the remote.
 */
/** The ruling a scoped site's parity guard quotes for a directory of another layer's pages. */
export const SCOPE_RULING =
  "owner, 2026-11-10: the base IG's pages should not be in an IG's site, only cross referenced — another layer's pages are linked on its own site, not copied into a scoped (IG) site";

/** The routes, current and old, of the pages an unscoped build owes and a scoped one does not. */
export function notOwedInScope(root: string, scope: readonly string[], staging: boolean): string[] {
  const owed = new Set(expectedPages(root, { staging, scope }).flatMap((p) => [p.route, p.legacyRoute]));
  return [...new Set(expectedPages(root, { staging }).flatMap((p) => [p.route, p.legacyRoute]))].filter((r) => r !== "" && !owed.has(r));
}

/**
 * The top-level directories of the published root that this scoped build
 * leaves out BECAUSE they hold only other layers' pages: every file lies under
 * an out-of-scope instance's name (as the directory, or one level down:
 * `docs/<layer>/`, `ar/<layer>/`) or under a page route the
 * scope no longer owes. Anything else stays a shortfall for the guard.
 */
export function scopeDropped(current: string, candidate: string, scope: readonly string[], instances: readonly string[], notOwed: readonly string[]): DroppedByRuling[] {
  const inScope = new Set(scope);
  const others = new Set(instances.filter((i) => !inScope.has(i)));
  // An out-of-scope layer's page at its own-site route (`<layer>/catalogue/` served at `catalogue/`)
  // is that layer's too: the unscoped build put it at the root for the layer, not for this site.
  const ownSite = notOwed.flatMap((r) => {
    const seg = r.split("/").filter(Boolean);
    const at = others.has(seg[0]!) ? 1 : seg[0] === "en" && others.has(seg[1]!) ? 2 : -1;
    return at > 0 && seg.length > at ? [`${seg.slice(at).join("/")}/`] : [];
  });
  const routes = [...notOwed, ...ownSite];
  const out: DroppedByRuling[] = [];
  for (const d of readdirSync(current, { withFileTypes: true })) {
    if (!d.isDirectory() || existsSync(join(candidate, d.name))) continue;
    const files: string[] = [];
    const walk = (dir: string, rel: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const r = `${rel}/${e.name}`;
        if (e.isDirectory()) walk(join(dir, e.name), r);
        else files.push(r);
      }
    };
    walk(join(current, d.name), d.name);
    const theirs = (f: string): boolean => {
      const seg = f.split("/");
      return others.has(seg[0]!) || (seg.length > 2 && others.has(seg[1]!)) || routes.some((r) => f.startsWith(r));
    };
    if (files.length > 0 && files.every(theirs)) out.push({ dir: d.name, ruling: SCOPE_RULING });
  }
  return out;
}

export function publishedRoot(remote: string, branch: string, exclude: readonly string[]): string | undefined {
  const dir = mkdtempSync(join(tmpdir(), "published-root-"));
  const git = join(dir, "git");
  const tree = join(dir, "root");
  mkdirSync(tree);
  if (spawnSync("git", ["init", "-q", "--bare", git]).status !== 0) return undefined;
  if (spawnSync("git", ["-C", git, "fetch", "-q", "--depth", "1", remote, branch], { stdio: ["ignore", "ignore", "ignore"] }).status !== 0) return undefined;
  // argv, not a shell string: `exclude` comes from layer declarations, and a
  // mounted remote layer is a trust boundary (bean `cat-tools-j4sh`).
  console.log(`▶ read the published root of ${branch}`);
  const tar = join(dir, "root.tar");
  const archive = spawnSync("git", ["-C", git, "archive", "-o", tar, "FETCH_HEAD", "--", ".", ...exclude.map((e) => `:(exclude)${e}`)], { stdio: "inherit" });
  if (archive.status !== 0) throw new Error(`read the published root of ${branch} failed (git archive exit ${archive.status})`);
  const untar = spawnSync("tar", ["-x", "-f", tar, "-C", tree], { stdio: "inherit" });
  if (untar.status !== 0) throw new Error(`read the published root of ${branch} failed (tar exit ${untar.status})`);
  return tree;
}

export async function buildInstanceSite(o: BuildOptions): Promise<{ site: string; base: string }> {
  const root = resolve(o.root);
  const declFile = findDeclarationFile(root);
  const declared = declFile === undefined ? undefined : siteFields(readFileSync(join(root, declFile), "utf-8"), join(root, declFile));
  if (!declared && !o.identity) throw new Error(`${root} holds no instance declaration`);
  if (declared && !o.identity && declared.name !== o.instance) throw new Error(`${root} declares ${declared.name}, not ${o.instance}`);
  // With an identity the site is the checkout's own and `instance` only scopes the chrome.
  const decl = o.identity ? { name: o.instance, title: o.identity.title, description: o.identity.description } : declared!;
  const remote = capture("git remote get-url origin", root);
  const gh = ownerRepo(remote);
  if (!gh) throw new Error(`origin ${remote} is not a GitHub repository: the base path cannot be read`);
  const title = decl.title ?? decl.name;
  for (const n of [...o.pre, ...o.sourceSteps, ...(o.siteSteps ?? []), ...(o.finalSteps ?? [])]) if (!SCRIPT_NAME.test(n)) throw new Error(`${JSON.stringify(n)} is not a package script name`);
  if (o.keep?.some((k) => k === "" || k.includes("/") || k === "." || k === "..")) throw new Error(`keep names root entries, not paths: ${JSON.stringify(o.keep)}`);
  const staging = o.staging === undefined ? undefined : (o.stagingDir ?? stagingDir(o.staging));
  const baseurl = `/${gh.repo}${staging ? `/${staging}` : ""}`;
  const out = resolve(o.out);
  const docs = join(out, "site-source");
  const site = join(out, "_site");

  if (o.fresh && o.mount) {
    // The mount script replaces the edited mounts itself (`remote-mount.ts --fresh`), one at
    // a time and after it has loaded. Removing them here first deleted the cat-harness-tools
    // mount, and the workspace links into the others, before the script that re-lays them
    // could start from it: "Module not found" for any downstream mounting cat-harness-tools
    // at its root (litlfred/aai-programme, 2026-10-20).
    run("mount the pinned closure, replacing edited mounts", `bun run ${shellQuote(join(import.meta.dir, "remote-mount.ts"))} --fresh`, root);
  } else {
    if (o.fresh) {
      const lockPath = join(root, "index.lock.json");
      const paths: string[] = existsSync(lockPath)
        ? (JSON.parse(readFileSync(lockPath, "utf-8")).instances ?? []).map((i: { path?: string }) => i.path).filter((p: unknown): p is string => typeof p === "string")
        : [];
      for (const p of paths) {
        if (p === "" || p === "." || p.startsWith("/") || p.split("/").includes("..")) throw new Error(`lock path ${JSON.stringify(p)} is not a subdirectory of the checkout`);
        if (capture(`git ls-files -- ${shellQuote(p)} | head -1`, root) !== "") throw new Error(`${p} holds files the checkout tracks; --fresh removes only mounts`);
        rmSync(join(root, p), { recursive: true, force: true });
      }
      console.log(`▶ fresh: removed ${paths.length} mount path(s) the lock names`);
    }
    if (o.mount) {
      // A mount an earlier build wrote into is left as it is by a plain mount, which then
      // fails the build with a lock table. Say what to run instead (an IG's first agent publish, 2026-11-06).
      const edited = editedMountsIn(root);
      if (edited.length) throw new Error(relayAdvice(root, edited));
      run("mount the pinned closure", `bun run ${shellQuote(join(import.meta.dir, "remote-mount.ts"))}`, root);
    }
  }
  const mounted = lockedMountPaths(root);
  const ownPackage = existsSync(join(root, "package.json"));
  run("install", [...(ownPackage ? ["bun install --no-save >/dev/null"] : ["true"]), ...mounted.filter((p) => existsSync(join(root, p, "package.json"))).map((p) => `(cd ${shellQuote(p)} && bun install --no-save >/dev/null)`)].join(" && "), root);

  // The shared preset the recipe extends (cat-harness-tools#2345), read now that the layers
  // that declare it are mounted: its steps first, then the recipe's own.
  let presetScripts: Record<string, string> = {};
  let when: Record<string, string> = {};
  if (o.extends !== undefined) {
    const own = { pre: o.pre, sourceSteps: o.sourceSteps, siteSteps: o.siteSteps ?? [], finalSteps: o.finalSteps ?? [], scripts: {}, when: {}, ...(o.links ? { links: o.links } : {}), ...(o.coverage ? { coverage: o.coverage } : {}) };
    const { steps, chain } = applyPreset(root, o.extends, own);
    console.log(`▶ site preset ${chain.join(" → ")}`);
    o = { ...o, pre: steps.pre, sourceSteps: steps.sourceSteps, siteSteps: steps.siteSteps, finalSteps: steps.finalSteps, ...(steps.links ? { links: steps.links } : {}), ...(steps.coverage ? { coverage: steps.coverage } : {}) };
    presetScripts = steps.scripts;
    when = steps.when;
    for (const n of [...o.pre, ...o.sourceSteps, ...(o.siteSteps ?? []), ...(o.finalSteps ?? [])]) if (!SCRIPT_NAME.test(n)) throw new Error(`${JSON.stringify(n)} is not a package script name`);
    console.log(`  steps: pre ${o.pre.join(", ") || "(none)"}; source ${o.sourceSteps.join(", ") || "(none)"}; site ${(o.siteSteps ?? []).join(", ") || "(none)"}${o.finalSteps?.length ? `; final ${o.finalSteps.join(", ")}` : ""}; links ${o.links ?? "report"}`);
  } else if ((o.profile ?? "folio") === "folio") {
    console.warn(`  ⚠ ${o.instance}'s site.build extends no shared site preset: its steps can drift from every other site's (cat-harness-tools#2345)`);
  }
  /** A step's command, or undefined (said) when its preset `when` path is absent here. */
  const step = (phase: string, name: string): string | undefined => {
    const why = skipReason(root, name, when);
    if (why !== undefined) {
      console.log(`▷ ${phase}: ${name} skipped: ${why}`);
      return undefined;
    }
    return stepCommand(root, name, presetScripts);
  };

  // The work directory exists before the first step: a pre step may leave its output there
  // (an IG's artefact index, read by a later step), as folio-site.yml's steps use $RUNNER_TEMP.
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const upstreamFile = join(out, "upstream-pages.txt");
  writeFileSync(upstreamFile, "");
  const siteCommit = capture("git rev-parse HEAD", root);
  const env = {
    ...siteStepEnv({
      instance: o.instance, title, baseurl, url: `https://${gh.owner}.github.io`, linkRoot: o.linkRoot, work: out, source: docs, site,
      repository: `${gh.owner}/${gh.repo}`, commit: siteCommit, ref: capture("git rev-parse --abbrev-ref HEAD", root),
    }),
    [STEP_ENV.baseurl]: baseurl,
    [STEP_ENV.upstreamPages]: upstreamFile,
    // render:bpmn's drawing beside each .bpmn goes here, out of the checkout: beside an IG's
    // input/business-processes/ it was an untracked file that made the cached AST stale.
    [BESIDE_SOURCE_OUT_ENV]: join(out, "beside-source-drawings"),
  };
  for (const p of gateSteps(o.pre)) {
    const c = step("pre", p);
    if (c !== undefined) run(`pre: ${p}`, c, root, env);
  }
  // The data the build's steps write (`sync-docs-harness`, `gen-landing-data`) lands in
  // whichever mount holds the harness or the landing — cat-harness, or the DAK base layer for an
  // IG that lands on it: put the pinned bytes back afterwards, failed build or not, so
  // every mount stays as the lock pins it.
  const restoreHarnessData = pinGeneratedData(root, mounted);
  const s = shellQuote(site);
  const writeVisualisers = o.writeVisualisers ?? writeMissingVisualisers;
  /** What this build publishes with instead of refusing ({@link isGraphData}), for {@link BUILD_QA_REPORT}. */
  const findings: BuildFinding[] = [];
  try {
    const has = PROFILE_STEPS[o.profile ?? "folio"];
    if (has.has("sync")) run("sync docs harness", `bun run ${TOOLS}/sync-docs-harness.ts`, root);
    if (has.has("landing")) run("landing data", `bun run ${TOOLS}/gen-landing-data.ts`, root);
    const scope = `--instance ${shellQuote(o.instance)} --title ${shellQuote(title)} --link-root ${shellQuote(o.linkRoot)}`;
    // Before the chrome is composed: what it links that only a publish-time writer builds.
    findings.push(...buildChrome(root).findings);
    run("chrome", `bun run ${TOOLS}/compose-docs.ts --out ${shellQuote(docs)} ${shellFlags(o.profile)} ${scope}`, root);
    run("navbar", `bun run ${TOOLS}/gen-navbar-include.ts ${scope} --out ${shellQuote(join(docs, "_includes/generated/navbar-footer.html"))}`, root);
    if (o.home) copyFileSync(join(root, o.home), join(docs, "index.md"));
    for (const s of o.sourceSteps) {
      const c = step("source", s);
      if (c !== undefined) run(`source: ${s}`, `${c} ${shellQuote(docs)}`, root, env);
    }
    // Every declared visualiser page the site owes (its own layer and every one it needs),
    // written by the writer its Tool declares, into the site source — the pages a recipe
    // step already wrote are not written twice ({@link writeMissingVisualisers}). A writer
    // that fails or cannot be pointed at a site is said here, and its pages are judged
    // below by the coverage guard, which reports (or refuses, when the recipe says `refuse`).
    writeVisualisers(root, docs, { staging: Boolean(staging), ...(o.scope ? { scope: o.scope } : {}) });

    // The Gemfile is the mounted harness's, in its site CHROME (semantic subgraphs, slice 1).
    const harness = join(root, "cat-harness");
    // Bundler writes Gemfile.lock beside the Gemfile: copy it out, so the mount stays as pinned.
    const gemDir = join(out, "gems");
    mkdirSync(gemDir, { recursive: true });
    for (const f of ["Gemfile", "Gemfile.lock"]) {
      const src = join(harness, siteFileFor(harness, f));
      if (existsSync(src)) copyFileSync(src, join(gemDir, f));
    }
    writeFileSync(join(out, "build-config.yml"), buildConfig(readFileSync(join(docs, "_config.yml"), "utf-8")));
    writeFileSync(
      join(out, "override.yml"),
      overrideConfig({ title, description: decl.description, baseurl, url: `https://${gh.owner}.github.io` }),
    );
    run("bundle install", "bundle install >/dev/null", gemDir);
    run(
      "jekyll",
      `BUNDLE_GEMFILE=${shellQuote(join(gemDir, "Gemfile"))} bundle exec ${jekyllExe(gemDir)} build --source ${shellQuote(docs)} --destination ${shellQuote(site)} --config ${shellQuote(join(out, "build-config.yml"))},${shellQuote(join(out, "override.yml"))}`,
      gemDir,
    );

    for (const st of o.siteSteps ?? []) {
      const c = step("site", st);
      if (c !== undefined) run(`site: ${st}`, `${c} ${s}`, root, env);
    }
    // Every site, whatever its profile: the schemas page links each node kind's pages.
    if (!recipeWritesNodeKindPages(root, [...(o.siteSteps ?? []), ...(o.finalSteps ?? [])])) {
      run("node-kind pages", `bun run ${TOOLS}/${NODE_KIND_PAGES} --root . --out ${s}`, root);
    }
    // Every site: one overview page per harness, which the rail's Harnesses panel links
    // (owner, 2026-11-13). After the node-kind pages, whose declaration pages it links;
    // before the rail, which links a row to its page only where the site holds one.
    run("harness pages", `bun run ${TOOLS}/${HARNESS_PAGES} --root . --out ${s} --title ${shellQuote(title)} --base-url ${shellQuote(`https://${gh.owner}.github.io${baseurl}/`)}${siteCommit ? ` --commit ${shellQuote(siteCommit)}` : ""}`, root);
    if (has.has("mount")) run("mount instance docs", `bun run ${TOOLS}/mount-instance-docs.ts --site ${s}${o.scope ? ` --scope ${shellQuote(scopeArg(o.scope))}` : ""}`, root);
    // Every site whose checkout has translations: the projections a block's 🌐 pane reads
    // (owner, 2026-11-18: "make the site build publish review.json wherever translations
    // exist"). After the mounted docs, so a review page they bring is linked.
    run("translation review", `bun run ${TOOLS}/publish-translation-review.ts --root . --site ${s}`, root);
    // A scoped site installs the viewer only when one of its pages embeds it (Q-SZ-6 "A").
    if (has.has("pdf") && o.scope && !pagesEmbedPdf(site)) console.log("pdf viewer: no page of this scoped site embeds a PDF; not installed");
    else if (has.has("pdf")) run("pdf viewer", `bun run ${TOOLS}/pdf-viewer.ts --site ${s} --allow ${shellQuote(`https://cdn.jsdelivr.net/gh/${gh.owner}/`)} --allow ${shellQuote(`https://raw.githubusercontent.com/${gh.owner}/`)}`, root);
    if (has.has("suggest")) run("suggest editor", `bun run ${TOOLS}/suggest-editor.ts --site ${s}`, root);
    if (has.has("lang")) run("html lang", `bun run ${TOOLS}/set-html-lang.ts --site ${s}`, root);
    if (has.has("lookup")) run("identifier lookup", `bun run ${TOOLS}/publish-id-lookup.ts --site ${s}`, root);
    // Every site: the knowledge-graph search (owner, 2026-11-18: "KG slice only,
    // linked"; and "lazy load the search indices"). Before the rail, so its page
    // gets the site's chrome; the search panel links it (search-split's `kgSearch`).
    publishKgSearch(site, root);
    run("rail on every page", `bun run ${TOOLS}/rail-standalone-pages.ts --site ${s} --built cat-harness --theme-source ${shellQuote(docs)} --foreign-site --home-label ${shellQuote(title)} --instance ${shellQuote(o.instance)}${o.identity ? " --landing" : ""}`, root);
    for (const st of o.finalSteps ?? []) {
      const c = step("final", st);
      if (c !== undefined) run(`final: ${st}`, `${c} ${s}`, root, env);
    }
    // After every page writer, so the documents never shadow a page; before the
    // guards below, which see the documents as part of the site.
    if (o.rootIndex) run("graph documents and root index", `bun run ${TOOLS}/publish-root-index.ts --site ${s} --base-url ${shellQuote(`https://${gh.owner}.github.io${baseurl}`)}`, root);
    if (o.scope) {
      const pruned = pruneUnreferencedImages(site);
      console.log(`scope: ${pruned.files.length} image(s) no page shows left out (${(pruned.bytes / 1e6).toFixed(1)} MB)`);
    }
    const host = sharedAssetsOf(root);
    if (host) {
      const sh = await shareAssets(site, host, servedOverHttp);
      for (const x of sh.shared) console.log(`shared assets: ${x.dir} from ${x.url} (${(x.bytes / 1e6).toFixed(1)} MB, ${x.refs} reference(s))`);
      for (const k of sh.kept) console.log(`shared assets: ${k.dir} ${k.why}`);
    }
    // The forwarding pages at the old addresses (folio-assistant#2527). The
    // chrome step composes with `--shell`, which writes none, so a visualiser
    // that moved under its locale lost its old address on every layer site
    // and the parity guard refused the publish (an IG's site, 2026-10-16: the
    // glossary under `en/`). Written last, on the built site, so they forward
    // to the pages as published and never replace one.
    const fwd = writeForwardingPages(site, root);
    console.log(`forwarding: ${fwd.written.length} page(s) at old addresses${fwd.superseded.length ? `; ${fwd.superseded.length} left as published pages` : ""}`);
    // The search scopes, after the last step that writes pages (owner, 2026-11-13: "search
    // broke" a folio's catalogue). Without `assets/js/search/manifest.json` the theme's
    // loader falls back to the WHOLE `search-data.json` — 33 MB and 20,571 entries on
    // that site — and builds one lunr index from it in the browser, which never answers.
    // This path, which stage-local uses for every folio and IG site, never ran the split.
    // Scoped by the layers THIS checkout declares.
    const split = splitSite(site, root);
    if (split) {
      console.log(`▶ search scopes`);
      for (const line of describeSplit(split.manifest)) console.log(line);
      console.log(`search: ${split.manifest.scopes.length} scope(s) from ${split.manifest.source.entries} entries (${(split.manifest.source.bytes / 1e6).toFixed(2)} MB) → ${SCOPES_DIR}/`);
    } else console.log(`search: no ${SEARCH_SOURCE} in the site — nothing to split`);
  } finally {
    restoreHarnessData();
  }
  writeFileSync(join(site, ".nojekyll"), "");
  // The 404 page and its English fallback (owner, 2026-11-13: "if page not
  // there, should redirect to en/ version"). After every page writer, so a
  // 404 page the content wrote keeps its own text and gains the fallback.
  console.log(`404: ${writeLocaleFallback404(site, `${baseurl}/`, UN_LOCALES)} — a missing /<locale>/ page goes to its English page`);

  const lacking = missingRequired(site, o.require ?? []);
  const lackingGraph = lacking.filter(isGraphData);
  if (lackingGraph.length > 0) throw new Error(`the built site lacks the graph data ${lackingGraph.join(", ")}, which a step was to write: the site is not published`);
  for (const f of lacking.filter((x) => !isGraphData(x))) {
    console.error(`  ✗ required: ${f} (reported, not gated)`);
    findings.push({ check: "required", detail: `the built site lacks ${f}, which a step was to write` });
  }

  // Every page the declarations say this site serves — the root's and every
  // layer it needs (owner, 2026-10-15: smart-ra was published without
  // `en/cat-harness/library/`, and nothing noticed). The parity guard below
  // only compares with the root being replaced, so it cannot miss a page that
  // was never published.
  const uncovered = siteCoverageShortfall(root, site, { staging: Boolean(staging), ownInstance: o.instance, ...(o.scope ? { scope: o.scope } : {}) });
  if (uncovered.length > 0) {
    for (const m of uncovered) {
      const what = `${m.route} (${m.harness} declares \`${m.visualiser}\`${m.instance ? `; ${m.instance} has entries` : ""})`;
      console.error(`  ✗ coverage: ${what}`);
      findings.push({ check: "coverage", detail: what });
    }
    if (o.coverage === "refuse") throw new Error(`the built site lacks ${uncovered.length} declared visualiser page(s): the site is not published`);
    console.error(`  (coverage: reported, not gated — published without ${uncovered.length} declared page(s))`);
  } else console.log("coverage: ✓ every declared visualiser page is in the site");

  // The root's guard: the built site carries everything the root it replaces carries.
  const keep = [...new Set([...PREVIEW_PREFIXES, PC_PREFIX, "_render-log", ...(o.keep ?? [])])];
  let publishedTree: string | undefined;
  if (!staging && (o.parity ?? "report") !== "off") {
    const against = (publishedTree = o.parityAgainst ?? (o.remote ? publishedRoot(o.remote, "gh-pages", keep) : undefined));
    if (against === undefined) console.log("parity: no published root to compare with — nothing to lose");
    else {
      const outOfScope = o.scope ? scopeDropped(against, site, o.scope, [...instanceRoots(root).keys()], notOwedInScope(root, o.scope, Boolean(staging))) : [];
      const dropped = [...(o.parityDropped ?? []), ...outOfScope, ...((o.parityDropped ?? []).some((x) => x.feature === "siteNav") ? [] : [THEME_SIDEBAR_RULING])];
      const cur = siteFeatures(against, keep);
      const cand = siteFeatures(site, keep);
      console.log(`parity: ${describeFeatures("current root", cur)}`);
      console.log(`parity: ${describeFeatures("this build  ", cand)}`);
      for (const d of droppedByRuling(cur, cand, dropped)) console.log(`parity: ${d.words} is dropped by ruling, not a shortfall — ${d.ruling}`);
      const refuse = Boolean(o.publish) && o.parity === "refuse";
      // The replaced root's own report carries the last clean publish (owner, 2026-11-14: "last clean").
      const previous = readParityReport(against);
      if (previous?.baseline) console.log(`parity: also against the last clean publish${previous.baseline.from ? ` (${previous.baseline.from})` : ""}`);
      const report = parityReport(cur, cand, dropped, refuse, previous, capture("git rev-parse --short=12 HEAD", root) || undefined);
      const short = report.shortfall;
      writeParityReport(site, report);
      for (const m of short) console.error(`  ✗ ${m}`);
      if (short.length && refuse) throw new Error(`this build lacks ${short.length} thing(s) the published root carries: the root is not replaced`);
      if (short.length) console.error(`  (parity: reported, not gated — published with ${short.length} shortfall(s); the QA page reads ${PARITY_REPORT})`);
      else console.log("parity: ✓ this build carries everything the published root and the last clean publish do");
    }
  }

  if (o.scope) {
    const r = await relinkOutOfScope(site, `${baseurl}/`, o.linkRoot, expectedPages(root, { staging: Boolean(staging) }).map((p) => p.route));
    console.log(`scope ${o.scope.join(", ")}: ${r.links} link(s) on ${r.pages} page(s) point at another layer's pages on ${o.linkRoot}`);
  }
  const upstream = readUpstreamPages(upstreamFile);
  const links = await checkLinks(site, `${baseurl}/`, upstream, selfAddressOf(gh.owner, gh.repo));
  console.log(`links: ${links.pages} html pages, ${links.misses.length} unresolved; ${links.files} files`);
  // `refuse` gates EVERY kind of unresolved internal link (cat-harness-tools#2345): a content
  // page's link to a glossary term the build never wrote is as much a 404 as the platform's.
  const refuse = o.links === "refuse";
  const gated = refuse ? " (gated: links refuse)" : " (reported, not gated)";
  // Absolute links to the site's own address (fhir-harness#380).
  if (links.selfMisses.length > 0) {
    console.log(`links: ${links.selfMisses.length} absolute link(s) to ${selfAddressOf(gh.owner, gh.repo)} reach no page of this build${gated}:`);
    for (const m of links.selfMisses.slice(0, 20)) console.log(`  · ${m}`);
  }
  if (links.diagramMisses.length > 0) {
    console.log(`links: ${links.diagramMisses.length} link(s) inside ${links.diagrams} diagram(s) reach no page of this build${gated}:`);
    for (const m of links.diagramMisses.slice(0, 20)) console.log(`  · ${m}`);
  }
  // The same result on the site, for its QA report to read (an IG layer's `qa.html`).
  writeLinkReport(site, links);
  if (links.upstreamMisses.length > 0) {
    console.log(`links: ${links.upstreamMisses.length} unresolved on ${upstream.size} page(s) the content supplies${refuse ? gated : " (reported, not gated: the content's own to fix)"}:`);
    for (const m of links.upstreamMisses.slice(0, 20)) console.log(`  · ${m}`);
  }
  if (links.misses.length > 0) {
    for (const m of links.misses.slice(0, 50)) console.error(`  ✗ ${m}`);
  }
  const unresolved = unresolvedCount(links, o.links);
  if (unresolved > 0 && refuse) throw new Error(`${unresolved} unresolved internal link(s): the site is not published (links: refuse; the first are listed above, all of them in ${LINK_REPORT})`);
  if (links.misses.length > 0) {
    console.error(`  (links: reported, not gated — published with ${links.misses.length} unresolved link(s); the QA page reads ${LINK_REPORT})`);
  }

  // Every inline script still parses, and no theme markup pass reached into
  // one (owner's report 2026-10-15: the heading-anchor and table-wrapper
  // passes broke every page that builds HTML in a script). The content's own
  // pages are reported, as their links are: the content's to fix.
  const inline = checkInlineScripts(site);
  const [ownScripts, upstreamScripts] = [inline.problems.filter((p) => !upstream.has(p.page)), inline.problems.filter((p) => upstream.has(p.page))];
  console.log(`inline scripts: ${inline.scripts} on ${inline.pages} html pages, ${inline.problems.length} unsound`);
  for (const p of upstreamScripts.slice(0, 20)) console.log(`  · ${p.page}:${p.line} ${p.reason} (a page the content supplies: reported, not gated)`);
  if (ownScripts.length > 0) {
    for (const p of ownScripts.slice(0, 50)) console.error(`  ✗ ${p.page}:${p.line} ${p.reason}`);
    for (const p of ownScripts) findings.push({ check: "inline-scripts", detail: `${p.page}:${p.line} ${p.reason}` });
    console.error(`  (inline scripts: reported, not gated — published with ${ownScripts.length} unsound)`);
  }

  // Accessibility and QA (owner, 2026-11-02): every heading has a named
  // anchor with a 🔗 to copy it, and a review page leads back to its
  // document. Reported, not gated: viewers are asked to try.
  const anchors = checkAnchors(site);
  const anchorPages = new Set(anchors.problems.map((p) => p.page)).size;
  console.log(`anchors: ${anchors.pages} html pages, ${anchorPages} to fix (reported, not gated)`);
  for (const p of anchors.problems.slice(0, 20)) console.log(`  · ${p.page}: ${p.reason}`);

  writeBuildQa(site, findings);
  console.log(`qa: ${findings.length} finding(s) published with, in ${BUILD_QA_REPORT}`);
  // The reports on the site's QA pages: the QA visualiser's own page and its page
  // for this site's layer, read in the browser (`site-qa-panel.ts`).
  const qaVisualisers = new Set(declaredVisualisers(root).filter((v) => (v.coversKinds ?? []).includes("qa")).map((v) => v.id));
  const qaRoutes = siteQaRoutes(expectedPages(root, { staging: Boolean(staging), ...(o.scope ? { scope: o.scope } : {}) }), qaVisualisers, o.instance);
  const placed = placeSiteQaPanel(site, qaRoutes);
  console.log(`qa: the build's reports are shown on ${placed.length ? placed.join(", ") : "no QA page (this site holds none)"}`);

  o.beforePublish?.(site);

  // The size review (owner, 2026-11-10: "add size review as part of authoring process"):
  // advisory, printed on every build, its report beside the build and never in the site.
  reviewSiteSize({ site, out: join(out, SITE_SIZE_FILE), repo: root, self: [o.instance], exclude: keep.map((k) => `${k}/`), ...(publishedTree ? { againstDir: publishedTree } : {}), log: (l) => console.log(l) });

  if (o.publish) {
    if (!o.remote) throw new Error("--publish needs --remote <git url>");
    const message = o.message ?? `Publish ${o.instance} ${capture("git rev-parse --short HEAD", root)}${staging ? ` preview of ${o.staging}` : ""}`;
    // `into` and `keep` arrived in bootstrap-tools#16 (adea857). An older
    // bootstrap-tools ignores unknown options, so a preview would REPLACE THE
    // WHOLE BRANCH and a root publish would delete every preview. Refuse
    // rather than guess: the options are typed locally so this compiles
    // against either version, and the running one is checked for support.
    if (!publishSite.toString().includes("o.into")) {
      throw new Error("the mounted bootstrap-tools' publish-site predates --into/--keep (bootstrap-tools#16): publishing would replace the whole branch; re-pin bootstrap-tools to adea857 or later");
    }
    const opts: Parameters<typeof publishSite>[0] & { into?: string; keep?: string[] } = staging
      ? { site, remote: o.remote, into: staging, message, name: "Claude", email: "noreply@anthropic.com" }
      : { site, remote: o.remote, keep, message, name: "Claude", email: "noreply@anthropic.com" };
    // A first publish: origin has no gh-pages yet, and publish-site clones it,
    // so start it as an orphan holding .nojekyll (an IG's first agent publish, 2026-11-06).
    ensurePublishBranch(o.remote, "gh-pages", { log: (l) => console.log(l) });
    const r = publishSite(opts);
    if (r.state === "failed") throw new Error(`publish failed: ${r.reason}`);
    console.log(r.state === "published" ? `published ${r.commit} (attempt ${r.attempt})` : "branch already current");
  } else {
    console.log(`built, not published: ${site} (base ${baseurl}/)`);
  }
  return { site, base: `${baseurl}/` };
}

if (import.meta.main) {
  const a = process.argv.slice(2);
  const one = (k: string): string | undefined => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const many = (k: string): string[] => a.flatMap((x, i) => (x === k && a[i + 1] !== undefined ? [a[i + 1]!] : []));
  const root = one("--root") ?? ".";
  const instance = one("--instance");
  if (!instance) {
    console.error(
      "usage: build-instance-site.ts --root <checkout> --instance <name> [--link-root <url>] [--out <dir>] [--home <md>]\n" +
        "         [--pre <script>]... [--source-step <script>]... [--site-step <script>]... [--final-step <script>]... [--staging <branch>] [--no-mount | --fresh] [--publish --remote <git url>] [--message <m>]\n" +
        "         [--keep <root entry>]... [--parity refuse|report|off] [--parity-against <published root dir>]",
    );
    process.exit(2);
  }
  // Explicit step flags win. With none, the layer's own `site.build`.
  const stepsOrRecipe = (): Pick<BuildOptions, "home" | "pre" | "sourceSteps" | "siteSteps" | "finalSteps" | "keep" | "profile" | "links" | "coverage" | "extends" | "rootIndex"> => {
    const flags = { home: one("--home"), pre: many("--pre"), sourceSteps: many("--source-step"), siteSteps: many("--site-step"), finalSteps: many("--final-step") };
    if (flags.home !== undefined || flags.pre.length + flags.sourceSteps.length + flags.siteSteps.length + flags.finalSteps.length > 0) return { ...flags, keep: many("--keep") };
    const { recipe: r, read } = recipeRead(root, instance);
    if (r === undefined) return flags;
    console.log(`steps: from ${read.from} site.build`);
    const notice = legacyNotice(read);
    if (notice !== undefined) console.warn(notice);
    return r;
  };
  try {
    await buildInstanceSite({
      root,
      instance,
      linkRoot: one("--link-root") ?? "https://litlfred.github.io/folio-assistant",
      out: one("--out") ?? join(resolve(root), "..", `${instance}-site`),
      ...stepsOrRecipe(),
      staging: one("--staging"),
      mount: !a.includes("--no-mount"),
      fresh: a.includes("--fresh"),
      publish: a.includes("--publish"),
      remote: one("--remote"),
      message: one("--message"),
      ...(many("--keep").length ? { keep: many("--keep") } : {}),
      ...(one("--parity") ? { parity: one("--parity") as BuildOptions["parity"] } : {}),
      ...(one("--parity-against") ? { parityAgainst: one("--parity-against")! } : {}),
    });
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}
