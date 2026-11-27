#!/usr/bin/env bun
/**
 * Scaffold a new folio in an empty (or existing) repository.
 *
 * folio-assistant is the platform; a folio is the content repo that uses it.
 * This writes, together, the conventions a folio needs (any one missing gives
 * a repo that looks right and renders nothing): the document manifest, named
 * after its own directory; block manifests importing builders through a
 * `folio/schema/` shim; `harness.config.json` selecting the adapter;
 * `AGENTS.md` as the agent-generic entry point with `CLAUDE.md` and
 * `GEMINI.md` as stubs; `beans/` as the work plan; and a shim path that
 * reaches the folio-assistant checkout.
 *
 * It writes no subject matter: the starter block says what a block is, not
 * what the folio is about.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/init-folio.ts --dir . --type document --slug my-guidance \
 *       --title "My Guidance Note" --author "A. Author"
 *
 *   bun run cat-harness-tools/scripts/init-folio.ts --help
 *
 * @module scripts/init-folio
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "fs";
import {
  INDEX_CONFIG_FILENAME,
  INDEX_CONFIG_SCHEMA,
  formatIndexConfig,
  readIndexConfig,
  withIgnoreBlock,
  type IndexConfig,
  type IndexLayer,
  type RemoteSource,
} from "../schemas/kg/index-config.ts";
import { CAT_HARNESS_DECLARATION_SCHEMA_TAG, conventionalFolioDir, instanceDeclarationFilename, resolveDirectories } from "../schemas/kg/cat-harness.ts";
import { checkoutDependentsOf, declaredSubgraph, materialiseDeclaredDirectories, orderedDependencies, subgraphSourceOverrides } from "../schemas/kg/harness-config.ts";
import { defaultGraphTypologies } from "../schemas/kg/graph-typology-registry.ts";
import {
  instanceStateBranch,
  resolveSubgraphSource,
  type ResolvedSubgraphSource,
  type SubgraphSource,
  type SubgraphSourceOverrides,
} from "../schemas/kg/subgraph-source.ts";
import { relative, dirname, join, resolve, sep } from "path";
import { spawnSync } from "child_process";
import { BUILTIN_ADAPTERS, type BuiltinAdapterDeclaration } from "../src/builtin-adapters";
import { REPO_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { reexportLine, vocabularyModulesFor } from "./lib/folio-shim.ts";
import { contentLayerInstance } from "../schemas/kg/graph-typology-registry.js";
import { git, remoteState } from "./lib/empty-remote.ts";
import { formatRemoteSeed, seedRemoteMainIfEmpty } from "./seed-main-if-remote-empty.ts";
import { createStateBranch, hasOrigin, INIT_COMMAND, initRemedy, type CreateState, stateBranchFiles, stateGraphFiles as stateGraphFilesFor, stateSeedCommand } from "./state-branch-init.ts";
import { parseRemote } from "./pages-bootstrap.ts";
import { DEFAULT_TODO_GRAPH, DEFAULT_TODO_GRAPH_ROOT, nodeOfKind } from "../schemas/sdlc/todo-graph.js";
import { blockToJsonLd, serialise as serialiseBlockNode } from "../pipeline/gen-block-jsonld.ts";
import { HARNESS_OWNER as CANONICAL_HARNESS_OWNER } from "../schemas/kg/repo-owner.ts";

/** The version a new layer declares beside its `iriBase` (bean folio-assistant-63q4). */
export const INITIAL_VERSION = "0.1.0";

/**
 * The GitHub owner of the harness layers (folio-assistant, cat-harness-tools,
 * …): `HARNESS_OWNER`, else litlfred. A new folio may live under any owner;
 * only the harness it calls is assumed to live here.
 */
export const HARNESS_OWNER = process.env.HARNESS_OWNER || CANONICAL_HARNESS_OWNER;

/** The upstream this folio pins its platform to. */
export const FOLIO_ASSISTANT_REPO = `https://github.com/${HARNESS_OWNER}/folio-assistant.git`;

/**
 * How the folio reaches its folio-assistant checkout.
 *
 * - `submodule` — pinned at `folio-assistant/` inside the folio. Default,
 *   because it makes the folio reproducible: a clone with `--recurse-submodules`
 *   gets the exact platform revision the content was authored against, and the
 *   builder-shim path is the same on every machine.
 * - `sibling` — a checkout beside the folio, reached by a relative path.
 *   Right when one working copy of the platform serves several folios, or when
 *   you are developing the platform and the folio together.
 * - `remote` — platform layers declared as `source.remote` mounts in
 *   `index.config.json` (pinned to 40-char commit SHAs) and mounted at the
 *   repository root by `state:mount` / `mount:remote`.
 */
export type LinkMode = "submodule" | "sibling" | "remote";

/**
 * What every harness instance needs, whether or not it holds a folio.
 *
 * Bean `mer2`, owner's ruling 2026-10-01: `folio_init` conflated two
 * operations. The declaration, config, work plan, agent guidance and MCP wiring
 * need NO content type; only `folio/`, its builder shim and the source-material
 * directories need an adapter. A harness layer (`bootstrap`, `cat-harness` — the partition once called it `agentic-harness`)
 * declares no `folio` kind and carries no adapter, so the MVP the owner ruled
 * for it — *"`folio_init` creates a working folio against that layer ALONE, in
 * an empty repository"* (`tndo`) — was not expressible while the two were one
 * call. `initInstance` is the contentless half; `initFolio` is it plus the
 * adapter's scaffold.
 *
 * A `--layer` flag was considered and rejected: it forces an answer to "which
 * content type does a contentless layer scaffold?", which has none.
 */
export interface InitInstanceOptions {
  /** Repo root to scaffold into. */
  targetDir: string;
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  /** Layer name: `<slug>.json`, and for a folio the directory under `folio/` and the manifest's name. */
  slug: string;
  title: string;
  link: LinkMode;
  /**
   * Path to the folio-assistant checkout, relative to the folio root.
   * Defaults to `folio-assistant` (submodule) or `../folio-assistant` (sibling).
   */
  assistantPath?: string;
  /** Overwrite files that already exist. Off by default. */
  force?: boolean;
  /** Report what would be written without writing it. */
  dryRun?: boolean;
  /** Skip `git submodule add` / `git init`. */
  skipVcs?: boolean;
  /**
   * The address the layer's IRIs are minted under, and where its JSON-LD
   * context is published (`<iriBase>ns/context/v1.jsonld`). `initInstance`
   * derives `https://<owner>.github.io/<repo>/` from a GitHub `origin` when
   * this is absent and the layer is its repository's root; otherwise none
   * is declared, and the publish workflow skips with a notice until one is.
   */
  iriBase?: string;
}

/** A layer that holds a folio: the layer, plus what its adapter scaffolds. */
export interface InitFolioOptions extends InitInstanceOptions {
  /** Content type — selects the adapter and the profile. */
  contentType: "paper" | "document";
  authors: string[];
}

/** The content type, when the layer being scaffolded holds a folio. */
type MaybeFolio = InitInstanceOptions & { contentType?: InitFolioOptions["contentType"] };

export interface InitFolioResult {
  created: string[];
  /** Files left alone because they already existed and `force` was not set. */
  skipped: string[];
  /** Anything the caller needs to act on — a failed submodule add, a next step. */
  notes: string[];
  /**
   * Each STATE graph the layer holds (its work plan and its todos), with
   * the source the one resolver gave it and what the scaffold therefore did:
   * `written` into the checkout, or `branch` — declared, not written, and
   * kept on `branch` (bean `hp54`). The scaffold creates that branch itself
   * once `main` is on the remote (`created`); `seed` is the same branch as a
   * shell command, and `state:seed --init` is the command when it could not.
   */
  stateGraphs: StateGraphOutcome[];
}

/** What `folio_init` did with one state graph (bean `hp54`). */
export interface StateGraphOutcome {
  id: string;
  path: string;
  source: ResolvedSubgraphSource;
  /** Where the answer came from: the declaration this scaffold wrote (or found), or only the entry it computed. */
  declared: boolean;
  /** For a branch source: the shell that seeds the branch, for a reader with no Bun (the scaffold creates it itself when it can). */
  seed?: string;
  /** For a branch source: what the scaffold's own creation of the branch did (`state-branch-init.ts`). Absent when there was no remote to create it on. */
  created?: CreateState;
}

/** A slug that is safe as a directory name, a TS module name and a URL path. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

const RESERVED_SLUGS = new Set(["schema", "pipeline", "node_modules", "build"]);

/**
 * Where the platform's code sits INSIDE its checkout.
 *
 * Bean `b963`. `init-folio` wrote `${assistant}/src/index.ts`,
 * `${assistant}/scripts/session-start-coord-sweep.sh` and
 * `${assistant}/viewer` — nine sites, all of them correct before the split and
 * none of them afterwards, because the repository's code moved under
 * `cat-harness/` while `assistant` still names the CHECKOUT root.
 *
 * **Measured 2026-09-20, and this is the reason it matters more than nine
 * edits:** two of the nine are the new folio's `.mcp.json` and its
 * `SessionStart` hook. So every folio scaffolded since the split got an MCP
 * server that cannot start and a hook that silently does nothing — the same
 * defect that had killed this repository's own session-start sweep, reproduced
 * in the one place that hands it to every downstream repository at once. A
 * failing hook looks exactly like a hook with nothing to say.
 *
 * Written down ONCE, for the reason `AGENTS.md` gives for the builder shim:
 * the path to the platform is a fact with one home, so the next relocation is
 * a one-line edit rather than a nine-site sweep that misses two.
 */
const HARNESS_SUBDIR = "cat-harness";

/** The platform's code root, from the checkout root a folio links it at. */
function platformDir(assistant: string): string {
  return posixSegments(`${assistant}/${HARNESS_SUBDIR}`).join("/");
}

/**
 * Where the platform's CODE sits: `src/`, `pipeline/`, `scripts/`,
 * `viewer/`. It moved from `cat-harness/` to this layer in 70lx, and a folio
 * scaffolded afterwards still ran it from `cat-harness/`, where nothing is
 * any more (bean `cat-tools-yylt`). The `schemas/` code followed in bean
 * `8lcl`, so the builder and type shims name this layer too. `platformDir`
 * stays for what cat-harness still holds: the harness declaration and data.
 */
const TOOLS_SUBDIR = "cat-harness-tools";
function toolsDir(assistant: string): string {
  return posixSegments(`${assistant}/${TOOLS_SUBDIR}`).join("/");
}

/**
 * Where a content type's adapter module sits, from the folio's own root.
 *
 * **This is a LOOKUP and must not go back to being a composition.** It read
 *
 * ```ts
 * `./${platformDir(assistant)}/adapters/${o.contentType}/index.ts`
 * ```
 *
 * which assumed every adapter lives under the same layer. That stopped
 * being true on 2026-09-30, when `adapters/paper/` moved to
 * the formal-math (sci) layer (bean `y5si`): one template cannot name two
 * layers, so every paper folio scaffolded after the move would have got an
 * `adapterModule` pointing at a path that does not exist.
 *
 * **The test did not catch it and could not have.** `init-folio.test.ts`
 * pinned the SUBSTRING `adapters/paper/index.ts`, which the broken path still
 * contains — so the composed and the correct answer were indistinguishable to
 * the gate. It pins the full path now.
 *
 * `BUILTIN_ADAPTERS` is the declaration of where each adapter is, and its
 * `module` is relative to `cat-harness/` — the same root `platformDir` names —
 * so joining the two is the whole conversion. An unknown content type has no
 * declaration to read, and composing a guess for it would re-create exactly
 * the failure above; it gets the conventional path under the harness and the
 * scaffold's own adapter resolution reports it if nothing is there.
 */
function adapterModulePath(assistant: string, contentType: string): string {
  const declared = BUILTIN_ADAPTERS.find((a) => a.contentType === contentType);
  const rel = declared ? declared.module : `adapters/${contentType}/index.ts`;
  return `./${posixSegments(`${platformDir(assistant)}/${rel}`).join("/")}`;
}

/**
 * A path's segments, `.` and `..` folded, POSIX by hand: these strings go into
 * a JSON config read on every platform, and `join` from `node:path` would emit
 * backslashes on Windows.
 */
function posixSegments(path: string): string[] {
  const segments: string[] = [];
  for (const part of path.split("/")) {
    if (part === "." || part === "") continue;
    if (part === ".." && segments.length > 0 && segments[segments.length - 1] !== "..") segments.pop();
    else segments.push(part);
  }
  return segments;
}

/**
 * The layer a new layer STANDS ON, as a config dependency (bean `zmdo`).
 *
 * Without it the scaffolded layer's declaration chain is the layer alone:
 * measured 2026-10-04 in a sibling layout, a fresh layer — and a fresh
 * document folio — reached **0** skill directories, so it could not read the
 * conventions it was scaffolded to follow. One entry is enough: the layer's own
 * `needs` carry the rest of the stack (`bootstrap ← bootstrap-tools ←
 * cat-harness ← …`), measured the same day.
 *
 * Which layer is DERIVED, never asked for: a folio stands on its adapter's
 * layer (`BUILTIN_ADAPTERS[].instance`), and a contentless layer on the
 * harness whose scaffolder wrote it. A `--layer` flag was rejected for `mer2`
 * and is not reintroduced here.
 */
function standsOn(assistant: string, contentType: InitFolioOptions["contentType"] | undefined): { name: string; path: string } {
  const harness = { name: HARNESS_SUBDIR, path: posixSegments(platformDir(assistant)).join("/") };
  if (contentType === undefined) return harness;
  const declared = BUILTIN_ADAPTERS.find((a) => a.contentType === contentType);
  if (!declared) return harness;
  // The adapter's module is relative to the harness directory and passes
  // through its layer's directory: `../<content-core>/adapters/…`.
  const segments = posixSegments(`${platformDir(assistant)}/${declared.module}`);
  const at = segments.lastIndexOf(declared.instance);
  return at < 0 ? harness : { name: declared.instance, path: segments.slice(0, at + 1).join("/") };
}

// ── State graphs (bean `hp54`) ───────────────────────────────────

/**
 * The graphs every layer keeps OFF main from its first commit — the work
 * plan and the todos (`holds: "state"`), and the trashcan a cutover deposits
 * into (`fsh-guts`, `holds: "context"`; the name predates it). Listed rather than
 * derived from the registry because the scaffold writes their CONTENT
 * (`.beans.yml`'s store, `todos/todos.json`), and a kind added to the registry
 * brings no content with it. `init-folio.test.ts` pins that every registry
 * kind carrying `newInstanceSource` is in this list, so the two cannot drift.
 */
export const INSTANCE_STATE_GRAPHS = [
  {
    id: "beans",
    // declared-path-literal: the scaffolder CREATES the layout; there is no declaration to read in a repo that does not exist yet.
    path: "beans/",
    kind: "beans",
    description: "This instance's work plan — one Markdown file per bean, managed with the `beans` CLI (`.beans.yml`).",
  },
  {
    id: "todos",
    // declared-path-literal: as above.
    path: "todos/",
    kind: "todos",
    description: "People's outstanding items and the feedback raised against blocks; its inner directories are declared by `todos/todos.json`.",
  },
  {
    // The trashcan that is kept. A NEW layer gets one from its first commit
    // (owner, 2026-10-06: "cutover dirs should go to fsh-guts") because
    // `state:seed --cutover` REFUSES to remove a directory from main when its
    // layer has nowhere to deposit the snapshot — and a layer that had
    // to declare one first would meet that refusal on its first cutover.
    id: "fsh-guts",
    // declared-path-literal: as above.
    path: "fsh-guts/",
    kind: "fsh-guts",
    description:
      "The trashcan that is kept: deprecated and removed content, each node declaring itself `folio-fsh-guts/v1` with where it came from. Where a cutover deposits the directory it removes from main. Never rendered.",
  },
] as const;
type StateGraphDef = (typeof INSTANCE_STATE_GRAPHS)[number];

/**
 * The declaration entry for one state graph. Its `source` comes from the
 * kind's `newInstanceSource` with the branch composed by
 * {@link instanceStateBranch} — `cat/<instance>/<id>` — and is written out in
 * full, so the new layer's declaration is the one place that answers
 * afterwards. A kind with no `newInstanceSource` gets no `source`: the
 * resolver's `directory` default.
 */
function stateEntry(slug: string, g: StateGraphDef): {
  id: string; path: string; graphTypologies: string[]; source?: SubgraphSource; description: string;
} {
  const nis = defaultGraphTypologies.get(g.kind)?.newInstanceSource;
  return {
    id: g.id,
    path: g.path,
    graphTypologies: [g.kind],
    ...(nis ? { source: { kind: "branch" as const, branch: instanceStateBranch(slug, g.id), keyedBy: nis.keyedBy } } : {}),
    description: g.description,
  };
}

/** The files a state graph starts with — one list with `state-branch-init.ts`, so the scaffold and a later `state:seed --init` start from the same files. */
function stateGraphFiles(slug: string, g: StateGraphDef): Record<string, string> {
  return stateGraphFilesFor(slug, g.id, g.path);
}

// ── Templates ────────────────────────────────────────────────────

/**
 * The layer DECLARATION — `harness.json`, and the reason the config beside
 * it has the name it has.
 *
 * Writing `<slug>.config.json` without this was a `dh4f` in miniature: the
 * file is on disk, and every reader answers "no config". A config filename is
 * composed from the layer's NAME, and a name is something a directory only
 * has by declaring one — `resolveHarnessConfigPath` refuses to guess a global
 * filename back into existence, which is correct and which leaves an
 * undeclared scaffold unconfigured in a way nothing reports.
 *
 * `directories` declares `folio/` and nothing else, which is not minimalism
 * for its own sake. A folio's content root is the one directory the scaffold
 * both CREATES and OWNS, and it is the only one whose meaning a dependent
 * cannot get from anywhere else. `uploads/`, `library/`, `beans/` and the
 * rest arrive two other ways — inherited from folio-assistant, which declares
 * them `dependents: "reproduce"`, and present in the conventional set — and
 * restating them here would be the same fact in two places, free to drift.
 *
 * Writing `directories: []` instead is a trap, and it is worth naming because
 * it looks like the humbler choice. `ownDirectories` falls back to
 * `DEFAULT_DIRECTORIES` only for a root with **no declaration at all**; an
 * empty array is a declaration that the layer owns nothing, so adding a
 * name would silently withdraw every convention the scaffold had before it.
 */
/**
 * The scaffolded layer's DECLARATION — `<slug>.json`.
 *
 * TWO files again since 2026-09-21. The history is worth keeping because both
 * transitions broke this function:
 *
 * 1. `harness.json` + `<slug>.config.json` — two files, two names.
 * 2. Excised into one `<slug>.config.json`, at which point the two writers
 *    targeted the SAME path and the config silently overwrote the
 *    declaration; a scaffolded folio came out with no `directories` at all.
 * 3. The owner split them again, giving each its own name, so the collision
 *    that forced the merge cannot recur: `<slug>.json` declares, and
 *    `<slug>.config.json` configures.
 *
 * `name` is what makes this file a declaration rather than a plain config, and
 * the filename stem must equal it — `findDeclarationFile` checks exactly that.
 */
function instanceDeclaration(o: MaybeFolio): string {
  // The state graphs are DECLARED whichever way they are kept (bean `hp54`).
  // Before, the scaffold wrote `beans/` and `todos/` and declared neither — a
  // present-but-undeclared directory no directory check can see, because they
  // compare declarations to disk and not the reverse.
  const state = INSTANCE_STATE_GRAPHS.map((g) => stateEntry(o.slug, g));
  return JSON.stringify(
    {
      // First, so a reader sees what the file is before what it says (bean `ujiv`).
      $schema: CAT_HARNESS_DECLARATION_SCHEMA_TAG,
      name: o.slug,
      title: o.title,
      // Where its IRIs are minted and its context is published (bean
      // folio-assistant-63q4). Only when known: an invented address is worse
      // than none. With a `version` beside it, always: `releaseIris` mints
      // `<iriBase>v<major>/` and refuses an iriBase without a MAJOR.MINOR.PATCH
      // one ("an iriBase needs a MAJOR.MINOR.PATCH version to mint against"),
      // which is how two restored DAK IG
      // declarations broke their IG publish on 2026-10-15.
      ...(o.iriBase !== undefined ? { iriBase: o.iriBase, version: INITIAL_VERSION } : {}),
      // A contentless layer declares no `folio` directory: declaring one it
      // does not hold would be the `dh4f` defect (a consumer scans nothing and
      // reports a clean run). Bean `mer2`.
      directories: o.contentType === undefined ? state : [
        {
          id: "folio",
          // declared-path-literal: THE BASE CASE, same as `DEFAULT_DIRECTORIES`.
          // This line IS the declaration being written; there is nothing to
          // read it from in a repository that does not exist yet.
          path: "folio/",
          graphTypologies: ["folio"],
          description: `The content of ${o.title} — its document, chapters and blocks.`,
        },
        ...state,
      ],
    },
    null,
    2,
  ) + "\n";
}

/**
 * The scaffolded layer's CONFIG — written INLINE in its `index.config.json`
 * entry, never as a `<slug>.config.json` (bean `ymvt`, owner 2026-10-14: *"i
 * thought ONLY index.config.json"*; the per-instance file is a legacy import,
 * retired by `index-config:migrate --inline`).
 *
 * NO `site.landing` FLAG, on purpose (issue #1904). A scaffolded folio is the
 * one harness instantiated at its root, and the owner's ruling makes that the
 * landing page with no flag: *"If exactly one harness is instantiated, it is
 * the landing page and no flag is needed."* The flag becomes necessary the day
 * a SECOND `<name>.config.json` lands beside this one: then exactly one of
 * them carries `"site": { "landing": true }` (two or more give a neutral hub),
 * and `check:landing-instance` fails until one does. Writing it now would be
 * a decision nobody has made yet. Rule: the `harness-tiles` skill.
 */
function instanceConfig(o: MaybeFolio, assistant: string): Record<string, unknown> {
  return {
      // Omitted, not defaulted, for a contentless layer (bean `mer2`):
      // naming an adapter here would be inventing a content type for a layer
      // that has none.
      ...(o.contentType === undefined ? {} : {
        contentType: o.contentType,
        adapter: o.contentType,
        adapterModule: adapterModulePath(assistant, o.contentType),
      }),
      dependencies: { folioAssistant: [standsOn(assistant, o.contentType)] },
      feedbackDir: `${DEFAULT_TODO_GRAPH_ROOT}/${nodeOfKind(DEFAULT_TODO_GRAPH, "todo-feedback")!.path}`,
      skills: ".claude/skills/local",
      viewer: { dir: `${toolsDir(assistant)}/viewer`, port: 8080 },
      // `blob` rather than `pages`: it is the only link style that resolves
      // for a PRIVATE folio, and a folio is private by default. Switching to
      // `pages` once a public Pages site exists is a one-word edit; a README
      // full of unreachable github.io URLs is not something the author finds
      // out about, because it renders fine for them.
      readme: { linkStyle: "blob", publishRef: "gh-pages" },
  };
}

/** The layers every remote-linked layer or folio mounts, whatever its content type. */
const REMOTE_PLATFORM_LAYERS = ["cat-harness", "cat-harness-tools", "bootstrap", "bootstrap-tools"] as const;

/**
 * The platform layers a remote-linked layer or folio declares as
 * `source.remote` mounts in `index.config.json` (bean `c4lg`).
 *
 * The platform layers, then — for a content type — the layer whose
 * `contentAdapters` declares that type and its `needs` closure, deepest first.
 * DERIVED, not named: this layer sits below every content layer and may not
 * spell their names (`check:reference-direction`). A content type no layer
 * in the checkout declares adds nothing — there is no layer to mount, and
 * guessing one would write a mount for a repository nobody said exists.
 *
 * Exported, with the adapters and the closure injectable, for the tests that
 * pin the derivation with and without a declaring layer.
 */
export function remotePlatformLayers(
  contentType: InitFolioOptions["contentType"] | undefined,
  adapters: readonly BuiltinAdapterDeclaration[] = BUILTIN_ADAPTERS,
  closureOf: (instanceRoot: string) => string[] = (root) => orderedDependencies(root).map((d) => d.dependency.name),
): string[] {
  const layers: string[] = [...REMOTE_PLATFORM_LAYERS];
  if (contentType === undefined) return layers;
  const declared = adapters.find((a) => a.contentType === contentType);
  if (declared === undefined) return layers;
  for (const name of [...closureOf(declared.root), declared.instance]) {
    if (!layers.includes(name)) layers.push(name);
  }
  return layers;
}

function headSha(dir: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: dir, stdio: "pipe" });
  if (r.status !== 0) return undefined;
  const sha = r.stdout.toString().trim();
  return /^[0-9a-f]{40}$/.test(sha) ? sha : undefined;
}

/**
 * Resolve the pinned `source.remote` for `layer` from the enclosing platform
 * checkout's `index.config.json` when available, falling back to `git rev-parse
 * HEAD` (or a deterministic 40-char SHA outside git) with `<HARNESS_OWNER>/<layer>`.
 */
function resolveRemoteLayerSource(layer: string): RemoteSource {
  const platformRoot = REPO_ROOT ?? resolve(TOOLS_ROOT, "..");
  const idx = readIndexConfig(platformRoot);
  if (idx.state === "ok") {
    const entry = idx.config.instances.find((e) => e.name === layer);
    if (entry?.source !== undefined && "remote" in entry.source) {
      const { repository, ref, overrides } = entry.source.remote;
      return {
        repository,
        ref,
        ...(overrides !== undefined ? { overrides } : {}),
      };
    }
  }
  const layerDir = resolve(platformRoot, layer);
  const ref = headSha(layerDir) ?? headSha(TOOLS_ROOT) ?? "0".repeat(40);
  return {
    repository: `${HARNESS_OWNER}/${layer}`,
    ref,
    overrides: { [layer]: { whole: true } },
  };
}

function remotePlatformInstances(contentType: InitFolioOptions["contentType"] | undefined): IndexLayer[] {
  return remotePlatformLayers(contentType).map((layer) => ({
    name: layer,
    source: { remote: resolveRemoteLayerSource(layer) },
  }));
}

/**
 * The `index.config.json` a new folio starts with: one layer, the one
 * scaffolded, declared at the root, its config INLINE in the entry (bean
 * `ymvt`), plus any remote-mounted platform layers when `--link remote` is
 * used (bean `c4lg`). Exported for the test that holds `init-folio` to the schema.
 */
export function newFolioIndex(
  slug: string,
  config: Record<string, unknown> = {},
  remoteInstances: IndexLayer[] = [],
): IndexConfig {
  const instances: IndexLayer[] = [
    { name: slug, source: { local: { at: "." } }, ...config },
    ...remoteInstances,
  ];
  return {
    $schema: INDEX_CONFIG_SCHEMA,
    instances,
    ...(instances.length > 1 ? { site: { landing: slug } } : {}),
  };
}

/**
 * The builder shim every block manifest imports through.
 *
 * A shim rather than a direct relative import from each block, because blocks
 * live at `folio/<slug>/<chapter>/` and would otherwise each spell out
 * `../../../<assistant>/schemas/builders` — a path that changes for any block
 * nested one level differently, and for every folio that links the platform
 * differently. One file holds the coupling; moving the platform is a one-line
 * edit here rather than a sweep over the whole corpus.
 */
function builderShim(assistant: string, contentType: string): string {
  // The vocabulary modules this folio's profile needs (the science layer's
  // `mathpaper` for a paper): their builders are theirs, not cat-harness's.
  const vocabularies = vocabularyModulesFor(contentType).map((m) => `${reexportLine(assistant, m)}\n`).join("");
  return `/**
 * Re-export of folio-assistant's content-object builders.
 *
 * Every block, chapter and document manifest in this folio imports from here
 * rather than reaching into the platform directly, so the path to
 * folio-assistant is written down exactly once. If you move or re-link the
 * platform checkout, edit this file and \`types.ts\` beside it — nothing else.
 *
 * Generated by \`folio_init\`. Safe to edit; not regenerated.
 */

export * from "../../${toolsDir(assistant)}/schemas/builders";
${vocabularies}`;
}

function typesShim(assistant: string): string {
  return `/**
 * Re-export of folio-assistant's content-object types. See \`builders.ts\`.
 *
 * Generated by \`folio_init\`. Safe to edit; not regenerated.
 */

export type * from "../../${toolsDir(assistant)}/schemas/types";
`;
}

function documentManifest(o: InitFolioOptions): string {
  const authors = o.authors.map((a) => JSON.stringify(a)).join(", ");
  return `import { paper, chapterRef } from "../schema/builders";

/**
 * ${o.title}
 *
 * The document manifest. \`chapters\` is an ORDERED list — its order is the
 * reading order, and it is the only place that order is recorded. To move a
 * chapter, move its entry here; never rename the directory to encode position,
 * because labels, uses[], feedback and QA sidecars all key on names.
 */
export default paper({
  title: ${JSON.stringify(o.title)},
  authors: [${authors}],
  date: new Date().toISOString().slice(0, 10),
  chapters: [
    chapterRef({ dir: "introduction" }),
  ],
});
`;
}

function chapterManifest(): string {
  return `import { chapter, section } from "../../schema/builders";

/**
 * The chapter manifest.
 *
 * A block reaches the rendered document IFF some section's \`blocks\` names it.
 * Writing \`<root>.ts\` and \`<root>.md\` is not enough — a block nobody lists
 * renders nowhere and is swept by nothing. Adding the name here is part of
 * adding a block, not a follow-up.
 */
export default chapter({
  title: "Introduction",
  label: "chap:introduction",
  tabLabel: "I",
  sections: [
    section({
      title: "Overview",
      label: "sec:overview",
      blocks: ["overview"],
    }),
  ],
});
`;
}

function starterBlockManifest(): string {
  return `import { prose } from "../../schema/builders";

export default prose({
  label: "prose:overview",
  title: "Overview",
  // Blocks a reader must already have read to follow this one. Editorial
  // judgement, direct neighbours only — never derived, never the transitive
  // closure. This block is first, so it has none.
  uses: [],
});
`;
}

/**
 * The starter block's `.jsonld`, made by the generator itself from the same
 * fields as {@link starterBlockManifest}, so the two cannot disagree; a test
 * runs `gen-block-jsonld.ts --check` on a scaffold to hold that.
 */
function starterBlockNode(root: string, slug: string): string {
  const block = { kind: "prose", label: "prose:overview", title: "Overview", uses: [] as string[] };
  // The starter block's own manifest path, written above in initFolio at the
  // convention, which is also the `folio/` its declaration names: a scaffold
  // reads no declaration, because it is the one writing it.
  const file = join(conventionalFolioDir(root), slug, "introduction", "overview.ts");
  return serialiseBlockNode(blockToJsonLd({ kind: block.kind, label: block.label, uses: [], file, block }, slug, []));
}

function starterBlockBody(o: InitFolioOptions): string {
  const kinds =
    o.contentType === "document"
      ? "`prose`, `example`, `remark`, `algorithm`, `simulator`, `equation`, `diagram`, `table`"
      : "the eight document kinds plus `definition`, `theorem`, `lemma`, " +
        "`proposition`, `corollary`, `conjecture` and `proof`";
  return `This is the first block of ${o.title}. Replace this text with the real
opening — this file is a placeholder, not content.

A **block** is the unit of authorship, review, feedback and QA in a folio. It
is two files that share a root name: \`overview.ts\` holds the metadata (kind,
label, title, \`uses[]\`) and \`overview.md\` holds the prose you are reading.
They are separate so a reviewer's diff is over the writing, not the manifest.

The kinds this folio may use are ${kinds}.

Ask your agent to *add a chapter* or *add a section on X*, and it will write
the manifests and wire them up. Run \`content_validate\` when you want to know
whether the corpus is sound.
`;
}

function agentsMd(o: InitFolioOptions, assistant: string): string {
  const isDoc = o.contentType === "document";
  return `# AGENTS.md — ${o.title}

This is a **folio**: the content repository. The authoring platform —
skills, schemas, MCP tools, the publication pipeline — is
[folio-assistant](${FOLIO_ASSISTANT_REPO}), checked out at \`${assistant}/\`.

This file is the **agent-generic** source of truth, read natively by Claude
Code, Gemini CLI, Antigravity, Cursor and Copilot. \`CLAUDE.md\` and
\`GEMINI.md\` are thin stubs pointing here.

> **Content lives here; formalism lives in the platform.** If you are about to
> add a schema, a validator, a QA criterion or a skill, it belongs in
> folio-assistant, not in this repo. If you are about to add a chapter, a
> recommendation or a table, it belongs here.

## Content type: \`${o.contentType}\`

${
  isDoc
    ? `A **document** folio: structured prose — policy guidance, a standard, a
report, a handbook. No Lean formalization, and no TeX installation required to
publish.

**Block kinds you may use:** \`prose\`, \`example\`, \`remark\`, \`algorithm\`,
\`simulator\`, \`equation\`, \`diagram\`, \`table\`.

**Kinds you may NOT use:** \`definition\`, \`theorem\`, \`lemma\`,
\`proposition\`, \`corollary\`, \`conjecture\`, \`proof\`. Those are the paper
profile — their assertion is a formal mathematical claim backed by a \`.lean\`
sibling, and this folio has no toolchain to check one. \`content_validate\`
enforces this on every run.

Reaching for \`theorem\` to carry a recommendation is the common mistake. Load
the \`normative-statements\` skill instead.`
    : `A **paper** folio: structured prose whose mathematics is backed by
machine-checked Lean 4 and rendered through LaTeX. Every kind is available,
including the seven whose assertion is a formal claim.

A paper is a document plus those kinds — so the document skills apply here too,
and the Markdown render path (\`document_render_md\`, \`document_render_html\`)
works on a machine with no TeX, which is the usual case while drafting.`
}

## Layout

\`\`\`
folio/${o.slug}/          the document
  ${o.slug}.ts             its manifest — chapters, in reading order
  <chapter>/<chapter>.ts   a chapter manifest — sections, in reading order
  <chapter>/<root>.ts      a block manifest
  <chapter>/<root>.md      that block's prose
  <chapter>/<root>.jsonld  that block's knowledge-graph node (generated; committed)
folio/schema/            re-export shim for the platform's builders
test/results/block-qa/     QA verdicts, one per block, mirroring folio/ (machine-written working copy — published to qa-reports)
test/attestations/        reviewer judgements and baseline attestations (committed on main)
library/                   ingested source documents (read-only reference)
uploads/                   source PDFs, for offline citation verification
${assistant}/              the platform
beans/                    the work plan (mounted from its declared branch)
todos/                    people's outstanding items (mounted likewise)
\`\`\`

## Commands

\`\`\`sh
bun run ${toolsDir(assistant)}/src/index.ts --stdio --repo .   # the MCP server
bun run ${toolsDir(assistant)}/src/index.ts --check-deps       # what's installed
bun run ${toolsDir(assistant)}/pipeline/qa-sweep.ts folio  # QA every block
bun run ${toolsDir(assistant)}/pipeline/gen-block-jsonld.ts   # every block's KG node (--check: current?)
\`\`\`

Every block is a knowledge-graph node: its \`.jsonld\` is committed beside it,
and the document site publishes it. Re-run the generator after adding, moving
or editing a block; the site build fails while a node is missing or stale.

## QA — every block is checked from the first commit

\`qa-sweep\` runs every criterion a script can check against each block, and
writes one verdict file per block under \`test/results/block-qa/\`. Derived QA
verdicts live on the orphan \`qa-reports\` branch (published by CI), rather than
being committed to \`main\`. Judgements stay on \`main\` in \`test/attestations/\`.
The working copy under \`test/results/\` is machine-written.

The staging preview sweeps each pull request as well (\`.github/workflows/staging.yml\`),
so the review page's QA column reports that build. \`.github/workflows/qa-sweep.yml\`
runs the full sweep in CI, and \`qa-sweep-nightly.yml\` refreshes stale verdicts;
both are dispatch-only until you enable their triggers. Criteria that need an
agent's judgement (voice, exposition, adversarial review) are not run by the
sweep; they stay unaudited until an agent records them.

## Work plan — use \`beans\`

\`beans/\` and \`todos/\` are this folio's STATE. Where each is kept is declared
in \`${instanceDeclarationFilename(o.slug)}\` — by default on its own branch,
\`cat/${o.slug}/beans\` and \`cat/${o.slug}/todos\`, mounted at those paths by the
session-start hook (\`state:mount\`) and never committed to \`main\`. Either way
the plan survives a fresh container and a sibling session sees it. Claim before
you work; never resolve a sibling's bean.

\`\`\`sh
${toolsDir(assistant)}/scripts/install-beans.sh
beans list
beans create "<title>"
beans <id> --status in-progress
\`\`\`

**Check before you create** — \`beans create\` is not idempotent and dedupes on
nothing, so re-entering a step duplicates the plan rather than no-op'ing.

## The skills are in the platform, not here

Ask for them by name and the agent loads them over MCP (\`skill_fetch\`):

| Package | What |
|---|---|
| \`folio-core\` | content-agnostic: bean coordination, editorial review, QA |
${
  isDoc
    ? "| `folio-document-adapter` | `document-authoring`, `document-structure`, `normative-statements`, `document-publishing` |"
    : "| `folio-document-adapter` | structure and prose authoring — applies to papers too |\n| `folio-paper-adapter` | Lean generation, proof review, LaTeX build, formalization audits |"
}

Do not copy a skill body into this repo. It will drift, and the platform's copy
is the one every other folio is reading.
`;
}

function mcpJson(assistant: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        "folio-assistant": {
          command: "bun",
          args: ["run", `${toolsDir(assistant)}/src/index.ts`, "--stdio", "--repo", "."],
        },
      },
    },
    null,
    2,
  ) + "\n";
}

function claudeSettings(assistant: string): string {
  return JSON.stringify(
    {
      hooks: {
        SessionStart: [
          {
            matcher: "*",
            hooks: [
              {
                type: "command",
                command: `${toolsDir(assistant)}/scripts/session-start-coord-sweep.sh`,
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  ) + "\n";
}

function gitignore(o: MaybeFolio, mounted: readonly string[] = []): string {
  // A graph kept on a branch is MOUNTED at its declared path (`state:mount`),
  // and the mount must never be committed to main — `/fsh-guts/**` in the
  // platform's own .gitignore is the precedent, `/**` for the reason given there.
  const mounts = mounted.length === 0 ? "" :
    `# State graphs kept on their own branches, mounted here by state:mount (never committed to main)\n${mounted.map((p) => `/${p.replace(/\/$/, "")}/**`).join("\n")}\n\n`;
  return `${mounts}# Build output
build/
_site/
.folio-feedback/
node_modules/

# Generated QA reports
bib-qa.json

# The QA working copy: machine-written, and recorded on the orphan qa-reports
# branch, not on main (sdlc/skills/sdlc-core/qa-reports.md). Attestations
# under test/attestations/ ARE committed. (bean 5qy8)
test/results/

# Editor / OS
.DS_Store
*.swp
${o.contentType === "paper" ? "\n# Lean build artifacts\n.lake/\n*.olean\n\n# Raw Lean build logs — the JSON sidecars beside them are committed\nbuild-logs/*.log\nbuild-logs/*.tsv\n" : ""}`;
}

/**
 * The folio's before/after preview: a caller of the platform's reusable
 * `folio-staging.yml` (bean `ojcx`). Without it a folio in its own repository
 * gets no branches/ build, and a reviewer has no "after" to compare.
 *
 * **A document folio gets it ON**, building with
 * the content core's `scripts/build-document-site.ts` (bean `fyu2`). That
 * command was rehearsed end to end on a folio this function scaffolds: site,
 * ChangeSet and banner. The path is under the content core rather than
 * `cat-harness/` as of bean `yj6r`, 2026-09-30: rendering a folio to a site is
 * CONTENT machinery, and the script reads core's `schemas/changeset.ts`. The
 * string here is the invocation a scaffolded folio's staging workflow carries,
 * so it is instance-relative and moves with the file — `init-folio.test.ts`
 * pins it for exactly that reason.
 *
 * **A paper folio gets it OFF**: dispatch-only, with a build step that
 * refuses. A paper builds through `publish.yml` (LaTeX, a folio-supplied
 * builder image), and the site a reviewer should see from that is the
 * folio's to name. A guessed command would publish a preview built by
 * something the author never chose.
 */
/**
 * The layer that builds a document site: the content layer, the layer that
 * declares the `core` layer's kinds, read from where they were declared rather
 * than spelt here (folio-assistant#2598).
 */
function documentSiteLayer(): string {
  const c = contentLayerInstance();
  if (c === undefined) throw new Error("init-folio: a document folio needs the content layer, and none is composed");
  return c.name;
}

function stagingWorkflow(assistant: string, contentType: InitFolioOptions["contentType"]): string {
  const on = contentType === "document";
  const build = on
    ? `bun run ${posixSegments(`${assistant}/${documentSiteLayer()}/scripts/build-document-site.ts`).join("/")} --out _site`
    : `echo "::error::set build_command in .github/workflows/staging.yml to build this folio''s site" && exit 1`;
  const header = on
    ? `# The site is built by the platform's build-document-site.ts: one page per
# document, with an anchor on every labelled block.`
    : `# TO ENABLE (a paper folio builds through publish.yml, so its site is yours
# to name):
#   1. Set build_command below to the command that builds this folio's site.
#   2. Uncomment the pull_request trigger.
# Until then it runs only when dispatched, and the build step refuses.`;
  // `issue_comment` refreshes the preview's review comments when a reviewer
  // writes one (bean 423d, the `review-comments` skill). The reusable
  // workflow's `comments` job runs only on it, and checks out no PR code.
  // `push` to main publishes main's site at the gh-pages root, which is the
  // "before" side every preview is compared with (bean 5uuf). Without it the
  // before pictures are all missing and "view on main" 404s.
  const trigger = on
    ? `  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created, edited]
  push:
    branches: [main]
  workflow_dispatch:`
    : `  workflow_dispatch:
  # push:
  #   branches: [main]
  # pull_request:
  #   types: [opened, synchronize, reopened]
  # issue_comment:
  #   types: [created, edited]`;
  return `name: Staging preview

# A before/after preview of this folio for every pull request, published to
# branches/<branch>/ on gh-pages, with the ChangeSet (what changed, block by
# block) beside it. A push to main publishes main's site at the gh-pages root:
# the "before" side. The mechanics live in the platform's reusable workflow.
#
${header}

on:
${trigger}

# What the reusable workflow needs, and no more: publish the preview, comment
# on the pull request, and read its comments for the review page.
permissions:
  contents: write
  pull-requests: write
  issues: read

jobs:
  staging:
    uses: ${HARNESS_OWNER}/folio-assistant/.github/workflows/folio-staging.yml@main
    with:
      build_command: '${build}'
      site_dir: _site
      folio_dir: folio
      platform_dir: ${assistant}
`;
}

// ── Workflow templates, read from disk ───────────────────────────

/**
 * The declared id of the directory holding the files a folio is given.
 *
 * Bean `52dz`, owner 2026-09-24: *"Move them to a templates folder; folio_init
 * writes them into a new folio's .github/workflows. They stop running (and
 * failing) here."* — and, for the Lean ones, *"have folio_init write them for
 * paper folios only. The .github scripts/actions they need get shipped too."*
 *
 * They are real files rather than strings in this module (as
 * `stagingWorkflow` above still is) so that they can be read, diffed and
 * parsed as what they are. Looked up by the declaration's `id`, never by its
 * path: `directoryForGraph("code")` is ambiguous here by design, and a by-id
 * lookup through `resolveDirectories` is what that function's own
 * documentation says to use when you want one particular directory.
 */
export const TEMPLATES_ID = "folio-templates";

/**
 * Which template profiles a content type receives, in order.
 *
 * Profiles NEST, as they do in `content-profiles`: a paper is a document plus
 * the formal kinds, so a paper folio gets everything a document folio gets
 * and then the Lean workflows. A document folio has no Lean toolchain to run
 * them against, so it never gets them.
 */
export const TEMPLATE_PROFILES: Record<InitFolioOptions["contentType"], readonly string[]> = {
  document: ["document"],
  paper: ["document", "paper"],
};

/**
 * Template path segments that land DOT-PREFIXED in the folio.
 *
 * The templates cannot sit under a literal `.github/`: the dot-prefix guard
 * in `directory-conventions` refuses a hidden segment anywhere in a declared
 * tree, for the reason it gives — a dot-prefixed directory is invisible to a
 * plain `ls` and to a forge's web tree. So the template says `github/` and
 * the writer adds the dot, in this one place.
 */
const DOT_SEGMENTS: Readonly<Record<string, string>> = { github: ".github" };

/** The placeholders a template may use. Anything else is refused. */
export const TEMPLATE_PLACEHOLDERS = ["assistant", "folio", "platform_git", "platform_repo"] as const;
export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number];

/**
 * `{{name}}`, NOT preceded by `$`. `${{ … }}` is a GitHub Actions expression
 * and must reach the folio untouched; confusing the two would either corrupt
 * every workflow or leave a placeholder behind, and the second is silent.
 */
export const TEMPLATE_PLACEHOLDER_RE = /(?<!\$)\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/**
 * Where the templates are: every member of the `folio-templates` subgraph in
 * this checkout, this layer's own first.
 *
 * This layer declares the subgraph and keeps the profile every folio gets
 * (`document/`). A profile that belongs to a higher layer — the paper
 * profile's Lean workflows, move M11 — lives in that layer's own
 * `templates/`, which is a member of the same subgraph (`resolveDirectories`'
 * MEMBERS rule). The members are found the way the arrow runs: from the
 * checkout's dependents of this layer (`checkoutDependentsOf`, as
 * `scenario-overlay` finds overlays), so no layer above is named here.
 */
export function templatesDirs(): string[] {
  const instanceRoot = resolve(TOOLS_ROOT);
  const above = checkoutDependentsOf(instanceRoot).map((d) => ({ name: d.name, root: d.root }));
  // Each layer is asked for its OWN `folio-templates`, one at a time. Resolved
  // as one chain, a `templates/` another layer declares under a different id
  // (core's `core-templates`) claims the path as ITS member first, and the
  // paper profile sci declares as `folio-templates` was never found.
  const ownTemplates = (link: { name: string; root: string }, own: boolean) =>
    resolveDirectories([{ ...link, own: true }])
      .filter((d) => d.id === TEMPLATES_ID && d.own && existsSync(d.absPath))
      .map((d) => ({ ...d, own }));
  const members = [
    ...ownTemplates({ name: "(local)", root: instanceRoot }, true),
    ...above.flatMap((l) => ownTemplates(l, false)),
  ];
  // This layer's own member first, so a profile it holds is never shadowed.
  const dirs = [...new Set([...members.filter((d) => d.own), ...members.filter((d) => !d.own)].map((d) => d.absPath))];
  if (dirs.length === 0) {
    // Refuse rather than write a folio without its workflows and report
    // success: that is the `dh4f` shape, a clean run over nothing.
    throw new Error(
      `init-folio: the platform declares no '${TEMPLATES_ID}' directory under ${instanceRoot}, ` +
        `so there are no workflow templates to write.`,
    );
  }
  return dirs;
}

/** This layer's own `folio-templates` directory (the first of {@link templatesDirs}). */
export function templatesDir(): string {
  return templatesDirs()[0]!;
}

export interface TemplateFile {
  /** Absolute path of the template in the platform checkout. */
  source: string;
  /** Path the file is written to, relative to the folio root. */
  target: string;
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      // Build debris (a `__pycache__`, an editor's dotfile) is never a template.
      if (name.startsWith(".") || name === "__pycache__") return [];
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walkFiles(p) : [p];
    });
}

/** Every template a folio of this content type receives, profile by profile. */
export function folioTemplates(
  contentType: InitFolioOptions["contentType"],
  dirs: string | readonly string[] = templatesDirs(),
): TemplateFile[] {
  const searched = typeof dirs === "string" ? [dirs] : dirs;
  const out: TemplateFile[] = [];
  for (const profile of TEMPLATE_PROFILES[contentType]) {
    // The first member holding the profile supplies it, whole.
    const base = searched.map((d) => join(d, profile)).find((p) => existsSync(p));
    if (base === undefined) {
      throw new Error(`init-folio: template profile '${profile}' is missing from ${searched.join(", ")}`);
    }
    for (const source of walkFiles(base)) {
      const target = relative(base, source)
        .split(sep)
        .map((seg) => DOT_SEGMENTS[seg] ?? seg)
        .join("/");
      out.push({ source, target });
    }
  }
  return out;
}

/**
 * Substitute every placeholder, and refuse one that is not known.
 *
 * Refusing is the point: an unknown `{{name}}` left in a workflow is text
 * GitHub will run as a path, and it fails at run time in the folio, long
 * after the scaffold reported success.
 */
export function renderTemplate(text: string, values: Record<TemplatePlaceholder, string>): string {
  return text.replace(TEMPLATE_PLACEHOLDER_RE, (whole, name: string) => {
    if (!(TEMPLATE_PLACEHOLDERS as readonly string[]).includes(name)) {
      throw new Error(`init-folio: unknown template placeholder ${whole}`);
    }
    return values[name as TemplatePlaceholder];
  });
}

/** `https://github.com/owner/repo.git` → `owner/repo`. */
function repoSlug(url: string): string {
  const m = /github\.com[:/](.+?)(?:\.git)?$/.exec(url);
  if (!m) throw new Error(`init-folio: cannot read owner/repo from ${url}`);
  return m[1]!;
}

function beansYml(slug: string): string {
  return `beans:
    path: beans/defs
    prefix: ${slug}-
    id_length: 4
    default_status: todo
    default_type: task
`;
}

/**
 * The folio's own README.
 *
 * Deliberately thin: the contents table is generated by `readme_toc` between
 * the two markers, and everything else is the author's to write. What matters
 * here is that the markers exist from the first commit.
 */
function folioReadme(o: InitFolioOptions): string {
  return `# ${o.title}

${o.authors.join(", ")}

<!-- Regions between a \`folio:*:begin\` / \`folio:*:end\` pair are generated:
     refresh them with \`readme_sync\` (MCP) or \`bun run cat readme:sync\` from the
     platform checkout. Edits inside a pair are overwritten; everything else in
     this file is yours and is never touched. \`bun run cat readme:sections\` lists
     the sections you can add. -->

## Contents

<!-- folio:toc:begin -->
<!-- folio:toc:end -->

## Workflows

<!-- folio:workflows:begin -->
<!-- folio:workflows:end -->
`;
}

/**
 * A contentless layer's README (bean `mer2`).
 *
 * Only the workflows markers: `folio:toc` lists a folio's contents, and a
 * layer that holds none would carry a region nothing can fill.
 */
function instanceReadme(o: InitInstanceOptions): string {
  return `# ${o.title}

A harness instance with no content type: its declaration (\`${instanceDeclarationFilename(o.slug)}\`),
work plan (\`beans/\`, \`todos/\`) and agent wiring. It holds no folio.

<!-- Regions between a \`folio:*:begin\` / \`folio:*:end\` pair are generated:
     refresh them with \`readme_sync\` (MCP) or \`bun run cat readme:sync\` from the
     platform checkout. Edits inside a pair are overwritten; everything else in
     this file is yours and is never touched. -->

## Workflows

<!-- folio:workflows:begin -->
<!-- folio:workflows:end -->
`;
}

/**
 * A contentless layer's AGENTS.md (bean `mer2`).
 *
 * Says what the layer is and is not, and where the platform is — the folio
 * version's block-kind rules would be rules about content this layer does
 * not hold.
 */
function instanceAgentsMd(o: InitInstanceOptions, assistant: string): string {
  return `# AGENTS.md — ${o.title}

This is a **harness instance with no content type**. It declares itself in
\`${instanceDeclarationFilename(o.slug)}\`, keeps its work plan in \`beans/\` and
\`todos/\`, and reaches the platform — skills, schemas, MCP tools — through
[folio-assistant](${FOLIO_ASSISTANT_REPO}), checked out at \`${assistant}/\`.

This file is the **agent-generic** source of truth. \`CLAUDE.md\` and
\`GEMINI.md\` are thin stubs pointing here.

## It holds no folio

There is no \`folio/\` here and no adapter is configured, on purpose: a
contentless instance scaffolds the instance and nothing an adapter would own.
Adding a folio to an existing instance in place is **not supported yet**:
\`init-folio\` skips files that exist, so this instance's declaration and
config would go on saying it holds no content.

## Work plan

\`beans\` is the todo mechanism: \`beans prime\`, \`beans list\`,
\`beans create "<title>"\`.
`;
}

function uploadsReadme(): string {
  return `# uploads/

Source PDFs and data files, one per cited work, for **offline citation
verification**. A reviewer checking a citation reads the file here rather than
chasing a URL that may have moved.

Name each file after the reference id it backs: \`uploads/<id>.pdf\`.

This is not the reference list — that is authored content. This directory is
the evidence behind it.
`;
}

function libraryReadme(): string {
  return `# library/

**Ingested** source documents — a guideline this folio adapts, a standard it
cites, a paper it builds on. Machine-extracted structure, not authored content.

\`\`\`
library/<doc-id>/
  structure.json        extracted document structure
  sections/<sid>.md     extracted section text
  candidates.json       extraction proposals
  manifest.jsonld       graph node for the document
\`\`\`

**Nothing here is folio content.** Every node carries
\`provenance: "ingested"\` and is attributed to its source, so a query can
always separate *what that document claims* from *what this folio claims*.
Promoting something into \`folio/\` is a separate, deliberate act — see the
platform's \`document-intake\` skill.
`;
}

// ── Writer ───────────────────────────────────────────────────────

/**
 * The root of a git repository that ENCLOSES `root` without being it, or
 * `null`. Bean `zdfa`: a folio scaffolded into a subfolder of an existing
 * repository got its workflow at `<sub>/.github/workflows/`, which GitHub
 * never reads, and a nested `git init`.
 */
export function enclosingRepoRoot(root: string): string | null {
  let probe = resolve(root);
  while (!existsSync(probe)) {
    const up = dirname(probe);
    if (up === probe) return null;
    probe = up;
  }
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: probe, stdio: "pipe" });
  if (r.status !== 0) return null;
  const top = realpathSync(r.stdout.toString().trim());
  return top === realpathSync(probe) && probe === resolve(root) ? null : top;
}

function defaultAssistantPath(link: LinkMode): string {
  if (link === "remote") return ".";
  return link === "submodule" ? "folio-assistant" : "../folio-assistant";
}

/**
 * Scaffold the folio.
 *
 * Never overwrites without `force`, and reports what it left alone — running
 * it twice on a live folio must not silently replace an author's `AGENTS.md`
 * with the template.
 */
/** The writer and context one scaffold run shares across its steps. */
interface Scaffold {
  o: MaybeFolio;
  root: string;
  assistant: string;
  result: InitFolioResult;
  write: (relPath: string, content: string) => void;
}

function checkSlug(slug: string): void {
  if (!isValidSlug(slug)) {
    throw new Error(
      `Invalid slug '${slug}'. Use lowercase words joined by single hyphens ` +
      `(e.g. 'antenatal-care-guidance') — the slug is a directory name, a TS ` +
      `module name and a URL path at once.`,
    );
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(
      `Slug '${slug}' is reserved: folio/${slug}/ has a platform meaning ` +
      `and would not be discovered as a document.`,
    );
  }
}

function startScaffold(o: MaybeFolio): Scaffold {
  const result: InitFolioResult = { created: [], skipped: [], notes: [], stateGraphs: [] };
  const root = resolve(o.targetDir);
  const assistant = o.assistantPath ?? defaultAssistantPath(o.link);

  const write = (relPath: string, content: string): void => {
    const full = join(root, relPath);
    if (existsSync(full) && !o.force) {
      result.skipped.push(relPath);
      return;
    }
    if (!o.dryRun) {
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content, "utf-8");
    }
    result.created.push(relPath);
  };

  return { o, root, assistant, result, write };
}

/**
 * Resolve one state graph's source through the ONE resolver (bean `hp54`).
 *
 * `declaredSubgraph` first — THE lookup the publishers and `branch-store`
 * use — reading the declaration this scaffold just wrote (or found, when a
 * re-run left an existing one alone) and the layer config's
 * `subgraphSources` override. A dry run has nothing on disk, and a directory
 * outside any checkout can make the checkout walk refuse; both fall back to
 * `resolveSubgraphSource` over the entry this scaffold would write, with
 * whatever overrides can be read. Never `entry.source` read directly.
 */
function resolveStateGraph(s: Scaffold, g: StateGraphDef): StateGraphOutcome {
  const entry = stateEntry(s.o.slug, g);
  if (!s.o.dryRun) {
    let found: ReturnType<typeof declaredSubgraph>;
    try {
      found = declaredSubgraph(s.root, g.id);
    } catch {
      found = undefined;
    }
    if (found && resolve(found.instanceRoot) === s.root) {
      return { id: g.id, path: g.path, source: found.source, declared: true };
    }
  }
  let overrides: SubgraphSourceOverrides = {};
  try {
    overrides = subgraphSourceOverrides(s.root);
  } catch {
    // An unreadable config is `check:harness-dirs`'s to report; the entry's own source still answers.
  }
  // Whether the id is DECLARED is a presence question, asked of the file —
  // its source is never read from here. A dry run reports what WOULD be declared.
  const declFile = join(s.root, instanceDeclarationFilename(s.o.slug));
  let declared = s.o.dryRun === true || !existsSync(declFile);
  if (!declared) {
    try {
      const dirs = (JSON.parse(readFileSync(declFile, "utf-8")) as { directories?: Array<{ id?: string }> }).directories ?? [];
      declared = dirs.some((d) => d.id === g.id);
    } catch {
      declared = false;
    }
  }
  return { id: g.id, path: g.path, source: resolveSubgraphSource(entry, overrides), declared };
}

/**
 * The instance-level writes — everything that needs no content type (bean
 * `mer2`). Shared by `initInstance` and `initFolio`, so a folio's layer half
 * cannot drift from a bare layer's.
 */
function writeInstanceFiles(s: Scaffold): void {
  const { o, assistant, write } = s;
  // Named after the layer, not after the harness: the config the scaffold
  // writes is THIS layer's, and `folio_init` is where a new layer's
  // name first becomes a filename (2026-09-20).
  // The declaration comes FIRST, because it is what gives the next line's
  // filename a meaning. See `instanceConfig` above — ONE file now, its
  // declaration and its config, since `harness.json` was excised.
  write(instanceDeclarationFilename(o.slug), instanceDeclaration(o));
  // The root INDEX (owner, 2026-10-07): which harnesses this checkout
  // instantiates — today the one being scaffolded, at the root — with its
  // config INLINE in the entry (bean `ymvt`: no `<slug>.config.json` is
  // written; the index is the one config). No `site.landing`: a sole layer is the landing
  // with no flag, and naming one now would be a decision nobody has made.
  const remote = o.link === "remote" ? remotePlatformInstances(o.contentType) : [];
  const index = newFolioIndex(o.slug, instanceConfig(o, assistant), remote);
  write(INDEX_CONFIG_FILENAME, formatIndexConfig(index));
  write(".mcp.json", mcpJson(assistant));
  write(".claude/settings.json", claudeSettings(assistant));
  // Each state graph's source, through the ONE resolver, now that the
  // declaration and config it reads are written (bean `hp54`).
  const state = INSTANCE_STATE_GRAPHS.map((g) => resolveStateGraph(s, g));
  const mounted = state.filter((g) => g.source.kind !== "directory").map((g) => g.path);
  // With the generated index-mounts block (empty until a remote mount is
  // declared), so `check:index-ignores` holds from the first commit.
  write(".gitignore", withIgnoreBlock(gitignore(o, mounted), index));
  write(".beans.yml", beansYml(o.slug));
  for (const g of state) {
    if (g.source.kind === "directory") {
      // The todos graph and every directory it declares: declaring a directory
      // that does not exist is the `dh4f` defect (a consumer scans nothing and
      // reports a clean run).
      for (const [path, text] of Object.entries(stateGraphFiles(o.slug, INSTANCE_STATE_GRAPHS.find((d) => d.id === g.id)!))) write(path, text);
      continue;
    }
    if (g.source.kind === "branch") {
      // The shell twin of what `finishScaffold` creates, kept for a reader
      // with no Bun: the same files `state:seed --init` would push.
      g.seed = stateSeedCommand(g.source.branch, stateBranchFiles(g.source.branch, g.id, g.path, o.slug));
      s.result.notes.push(
        `${g.path} is declared on branch ${g.source.branch} (keyedBy ${g.source.keyedBy}) and was NOT written into the checkout. ` +
          `The layer's initialization creates that branch once \`main\` is on the remote; if it did not, create it with \`${INIT_COMMAND}\` ` +
          `then mount it: bun run ${toolsDir(assistant)}/scripts/state-mount.ts`,
      );
    } else {
      s.result.notes.push(`${g.path} resolves to a ${g.source.kind} source and was NOT written into the checkout.`);
    }
    if (!g.declared) {
      s.result.notes.push(
        `${instanceDeclarationFilename(o.slug)} already existed and does not declare "${g.id}" — add this entry to its \`directories\`: ` +
          JSON.stringify(stateEntry(o.slug, INSTANCE_STATE_GRAPHS.find((d) => d.id === g.id)!)),
      );
    }
  }
  s.result.stateGraphs.push(...state);
  write("CLAUDE.md", `# CLAUDE.md\n\nThis ${o.contentType ? "folio" : "instance"}'s agent guidance is maintained agent-generically in \`AGENTS.md\`.\n\n@AGENTS.md\n`);
  write("GEMINI.md", `# GEMINI.md\n\nThis ${o.contentType ? "folio" : "instance"}'s agent guidance is maintained agent-generically in \`AGENTS.md\`.\n\nSee [AGENTS.md](./AGENTS.md).\n`);
}

/** Link the platform, then create every declared or inherited directory. Last, for both. */
function finishScaffold(s: Scaffold): void {
  const { o, root, assistant, result } = s;

  // Version control.
  const platformPresent = existsSync(join(root, assistant));
  if (!o.skipVcs && !o.dryRun) {
    linkPlatform(root, assistant, o, result);
  } else if (!o.dryRun && !enclosingRepoRoot(root)) {
    // `--skip-vcs` skips linking the platform, and with it `seedMainIfEmpty`,
    // which lives in that step. dth-hrh was scaffolded so, into a cloud
    // checkout of an EMPTY repository on a feature branch; nothing put `main`
    // on the remote, the branch was pushed first, and GitHub made it the
    // default (owner, 2026-10-14). The remote still gets `main` here, without
    // a branch switch: the caller chose the branch it is on.
    const seed = seedRemoteMainIfEmpty(root);
    const note = formatRemoteSeed(seed).split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2)).join(" ");
    if (note) result.notes.push(note);
  }
  // The layer's declared STATE BRANCHES (owner, 2026-11-17: "these state
  // branches are made upon initialization by the layer that needs them").
  // After `main` is on the remote — the first branch pushed to an empty
  // GitHub repository becomes its default — and only where there is an
  // origin to create them on. Idempotent: an existing branch is left as it is.
  if (!o.dryRun && hasOrigin(root)) {
    for (const g of result.stateGraphs) {
      if (g.source.kind !== "branch" || g.source.keyedBy !== "tip") continue;
      const c = createStateBranch(g.source.branch, stateBranchFiles(g.source.branch, g.id, g.path, o.slug), { repoRoot: root });
      g.created = c.state;
      if (c.state === "created") result.notes.push(`Created the state branch ${g.source.branch} (${g.id}).`);
      else if (c.state !== "exists") result.notes.push(initRemedy(c));
    }
  }

  if ((o.skipVcs || o.dryRun) && o.link === "submodule" && !platformPresent) {
    // Only when it is actually absent. Emitting this unconditionally told a
    // caller who had already added the submodule (and passed --skip-vcs
    // precisely because of that) to add it again.
    result.notes.push(`Add the platform: git submodule add ${FOLIO_ASSISTANT_REPO} ${assistant}`);
  }
  if ((o.skipVcs || o.dryRun) && o.link === "remote") {
    result.notes.push(
      `Linked via remote mounts in index.config.json — run 'bun run cat state:mount' (after approving pins with 'bun run cat mount:remote --approve') to mount the platform layers.`,
    );
  }

  if (o.contentType !== undefined && !existsSync(join(root, assistant))) {
    result.notes.push(
      `The builder shim in folio/schema/ points at '${assistant}', which does not exist yet. ` +
      `Nothing will import until the platform is there.`,
    );
  }

  // Every directory this layer DECLARES or INHERITS, created if absent.
  //
  // Last, and after the platform link, because the inherited half of the answer
  // comes from walking the dependency tree — a layer whose platform is not
  // checked out yet inherits nothing, and this then correctly creates only what
  // the layer itself declares. Re-running with `--force` re-runs this,
  // which is safe: it is idempotent and never overwrites a keep-marker.
  //
  // Placed here rather than left to the session-start sweep because the two
  // answer different moments and `AGENTS.md` is explicit that a resolver with
  // no caller is the defect to avoid — `resolveSkillDirs` has had none since it
  // was written, and `resolveDirectories` had none before this change.
  if (!o.dryRun) {
    for (const d of materialiseDeclaredDirectories(root)) {
      if (d.created) result.created.push(`${relative(root, d.absPath)}/`);
      if (d.markerWritten) result.created.push(relative(root, join(d.absPath, ".gitignore")));
    }
  }
}

/**
 * Scaffold a harness instance with NO content type (bean `mer2`).
 *
 * Writes the declaration (with no `folio` directory), the config (with no
 * adapter), the work plan, agent guidance and MCP wiring, and links the
 * platform. Writes nothing an adapter owns: no `folio/`, no builder shim, no
 * `uploads/` or `library/`, no staging or QA workflows. This is the operation
 * the owner's MVP ruling (`tndo`) needs for a layer that has no adapter.
 */
export function initInstance(options: InitInstanceOptions): InitFolioResult {
  const o: MaybeFolio = { ...options, contentType: undefined };
  checkSlug(o.slug);
  const s = startScaffold(o);
  // Checked before anything is written, as for a folio (bean `zdfa`): GitHub
  // reads workflows only at the repository root.
  const enclosing = enclosingRepoRoot(s.root);
  if (o.iriBase === undefined && !enclosing) o.iriBase = githubPagesBase(s.root);
  if (!o.dryRun) mkdirSync(s.root, { recursive: true });
  writeInstanceFiles(s);
  s.write("README.md", instanceReadme(o));
  s.write("AGENTS.md", instanceAgentsMd(o, s.assistant));
  writePublishContext(s, enclosing);
  finishScaffold(s);
  return s.result;
}

/**
 * `https://<owner>.github.io/<repo>/` from a GitHub `origin`, the address
 * GitHub Pages serves a project repository at; `undefined` when there is no
 * such remote (a fresh `git init`), because a guessed address would be
 * minted into every IRI the layer writes.
 */
export function githubPagesBase(root: string): string | undefined {
  let probe = resolve(root);
  while (!existsSync(probe)) {
    const up = dirname(probe);
    if (up === probe) return undefined;
    probe = up;
  }
  const r = spawnSync("git", ["remote", "get-url", "origin"], { cwd: probe, stdio: "pipe" });
  if (r.status !== 0) return undefined;
  const url = r.stdout.toString().trim();
  // github.com only: `parseRemote` takes owner/repo from any host, and a
  // proxied or mirrored remote would otherwise mint an address nobody serves.
  if (!/^(?:git@github\.com:|(?:https?|ssh|git):\/\/(?:[^@/]+@)?github\.com\/)/.test(url)) return undefined;
  const parsed = parseRemote(url);
  if (!parsed) return undefined;
  const owner = parsed.owner.toLowerCase();
  // A `<owner>.github.io` repository is served at the root, not under its name.
  return parsed.repo.toLowerCase() === `${owner}.github.io` ? `https://${owner}.github.io/` : `https://${owner}.github.io/${parsed.repo}/`;
}

/** The caller of cat-harness-tools' `layer-publish-context.yml` (bean folio-assistant-63q4). */
export function publishContextWorkflow(slug: string): string {
  return `# Publish this instance's JSON-LD context to gh-pages, at
# <iriBase>ns/context/v1.jsonld, on every push to main. Everything is decided in
# the reusable workflow; it creates gh-pages on its first run if it is absent.
# GitHub Pages is switched on once, by hand, after that first run:
# Settings -> Pages -> "Deploy from a branch: gh-pages, / (root)".
name: Publish JSON-LD context
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  publish:
    uses: ${HARNESS_OWNER}/cat-harness-tools/.github/workflows/layer-publish-context.yml@main
    with:
      instance: ${slug}
`;
}

/**
 * The caller of the tools layer's QA publisher (bean folio-assistant-7mwa;
 * owner, 2026-11-03, "2. Each layer publishes"). A layer that declares a
 * `qa` directory with `storage` keeps its results on that branch of its OWN
 * repository, and before this no initialisation step gave it a writer, so a
 * layer's declared store never existed. The reusable workflow skips with a
 * notice while the layer declares no `qa` directory of its own.
 */
export function publishQaWorkflow(slug: string): string {
  return `# Publish this instance's QA results (its declared \`qa\` directory) to the
# cat/cat-harness/qa-reports branch of THIS repository, keyed by commit:
# main/<sha> on a push to main, pr/<n>/<sha> on a pull request. An index that
# mounts this instance reads them at the commit its lock pins. The branch is
# created on the first run; nothing is published while no \`qa\` directory
# of this instance's own is declared.
name: Publish QA results
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
permissions:
  contents: write
jobs:
  publish:
    uses: ${HARNESS_OWNER}/cat-harness-tools/.github/workflows/layer-qa-publish.yml@main
    with:
      instance: ${slug}
`;
}

/**
 * Turn on the context's publishing (bean folio-assistant-63q4, owner
 * 2026-10-15: *"this should be a part of cat-harness initiation process"*).
 * Only at a repository's root, where GitHub reads workflows.
 */
function writePublishContext(s: Scaffold, enclosing: string | null): void {
  const { o, write, result } = s;
  if (enclosing) {
    result.notes.push(
      `Inside the repository at '${enclosing}', so no publish-context workflow was written: GitHub reads workflows only at that ` +
        `repository's root. Its own publish-context workflow (cat-harness-tools' layer-publish-context.yml) publishes ` +
        `<iriBase>ns/context/v1.jsonld for an instance it holds, with path-in-repo naming the instance's directory.`,
    );
    return;
  }
  write(".github/workflows/publish-context.yml", publishContextWorkflow(o.slug));
  write(".github/workflows/publish-qa.yml", publishQaWorkflow(o.slug));
  result.notes.push(
    o.iriBase === undefined
      ? "No iriBase was declared (no GitHub origin remote to derive one from), so .github/workflows/publish-context.yml " +
          "will skip with a warning until one is: add \"iriBase\": \"https://<owner>.github.io/<repo>/\" to " +
          `${instanceDeclarationFilename(o.slug)}.`
      : `JSON-LD context: .github/workflows/publish-context.yml publishes ${o.iriBase}ns/context/v1.jsonld to gh-pages on ` +
          "every push to main, but only once this instance holds at least one .jsonld document: the context binds the " +
          "prefixes its documents use, so with none every run skips with a warning and creates no gh-pages. A new " +
          "instance holds none yet. After the first run that publishes, switch GitHub Pages on once: " +
          "Settings -> Pages -> Deploy from a branch: gh-pages, / (root).",
  );
}

/** Scaffold a folio: `initInstance`'s writes, plus the adapter's folio scaffold. */
export function initFolio(options: InitFolioOptions): InitFolioResult {
  const o: InitFolioOptions = { ...options };
  checkSlug(o.slug);
  if (o.authors.length === 0) {
    throw new Error("At least one author is required — the manifest's `authors` may not be empty.");
  }

  const s = startScaffold(o);
  const { root, assistant, result, write } = s;

  // Checked before anything is written: whether this folio is the root of
  // its repository decides where its workflow can go (bean `zdfa`).
  const enclosing = enclosingRepoRoot(root);
  if (!o.dryRun) mkdirSync(root, { recursive: true });

  // 1. The layer half — configuration, work plan, agent stubs.
  writeInstanceFiles(s);

  // 1b. The staging and QA workflows — folio-level: each builds or audits content.
  if (enclosing) {
    // GitHub reads workflows only at the repository root, and the reusable
    // workflow builds from the repository root. A caller written here would
    // never run, and one written at the root would build the wrong directory,
    // so neither is written, and the author is told.
    result.notes.push(
      `This folio is in a subfolder of the repository at '${enclosing}'. GitHub reads workflows only from ` +
        `that repository's root .github/workflows/, and the platform's folio-staging.yml builds from the ` +
        `repository root, so it cannot stage a folio below it yet. No staging workflow was written, so this ` +
        `folio gets no preview. Scaffold it at a repository root to have one.`,
    );
  } else {
    write(".github/workflows/staging.yml", stagingWorkflow(assistant, o.contentType));
  }
  if (!enclosing && o.contentType !== "document") {
    result.notes.push(
      "Staging previews are wired but OFF: set build_command in .github/workflows/staging.yml " +
        "and uncomment its pull_request trigger. Until then there is no STAGING build to review.",
    );
  }
  // The QA workflows every folio gets, and for a paper the Lean workflows
  // with the scripts and composite action they call. Read from the platform's
  // declared templates directory and written with their placeholders filled.
  const templateValues: Record<TemplatePlaceholder, string> = {
    assistant,
    // declared-path-literal: THE BASE CASE, the same literal
    // `instanceDeclaration` writes as this folio's content root — there is
    // no declaration to read in a repository that does not exist yet.
    folio: "folio",
    platform_git: FOLIO_ASSISTANT_REPO,
    platform_repo: repoSlug(FOLIO_ASSISTANT_REPO),
  };
  for (const t of folioTemplates(o.contentType)) {
    write(t.target, renderTemplate(readFileSync(t.source, "utf-8"), templateValues));
  }
  result.notes.push(
    "QA and site workflows (qa-sweep, qa-sweep-nightly, section-title-audit, site-publish; thin callers of cat-harness-tools' folio-* reusable workflows)" +
      (o.contentType === "paper" ? " and Lean workflows (blueprint, lean-build, lean-build-sidecar, lean_ci)" : "") +
      " are written dispatch-only: enable their triggers in .github/workflows/ when you want them to run.",
  );

  // 2. The builder shim — the one place the platform path is written down.
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  write("folio/schema/builders.ts", builderShim(assistant, o.contentType));
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  write("folio/schema/types.ts", typesShim(assistant));

  // 3. The document, one chapter, one block.
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  write(`folio/${o.slug}/${o.slug}.ts`, documentManifest(o));
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  write(`folio/${o.slug}/introduction/introduction.ts`, chapterManifest());
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  write(`folio/${o.slug}/introduction/overview.ts`, starterBlockManifest());
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  write(`folio/${o.slug}/introduction/overview.md`, starterBlockBody(o));
  // Its knowledge-graph node: every block is one from the first commit, and a
  // document site fails without it (`gen-block-jsonld.ts --check` keeps it current).
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  write(`folio/${o.slug}/introduction/overview.jsonld`, starterBlockNode(root, o.slug));

  // 4. The two source-material directories.
  //
  // Written as READMEs rather than left to `materialiseDeclaredDirectories`
  // below because a new folio's author needs to be told what each stage is
  // FOR — the keep-marker exists to stop an empty directory vanishing, not to
  // explain a pipeline. The materialiser then covers whatever else this folio
  // inherits from the platform and does not have.
  // declared-path-literal: as above — scaffolding the layout a declaration
  // will describe, not reading one.
  write("uploads/README.md", uploadsReadme());
  // declared-path-literal: as above.
  write("library/README.md", libraryReadme());

  // 4b. The folio README, carrying the markers `readme_sync` writes between.
  // A section is written only where its markers already appear, so a folio
  // scaffolded without them would get nothing from the tool — and the markers
  // are also the documentation of which sections exist.
  write("README.md", folioReadme(o));

  // 5. Agent guidance: AGENTS.md is authoritative; the stubs are instance-level.
  write("AGENTS.md", agentsMd(o, assistant));

  finishScaffold(s);
  return result;
}

/**
 * Put the platform where `harness.config.json` says it is.
 *
 * Failure here is a **note, not an error**: every file this scaffolder writes
 * is already correct, and the remedy is one command the caller can run. Dying
 * on a network failure would leave a half-initialized repo and no record of
 * what remained to be done.
 */
function linkPlatform(
  root: string,
  assistant: string,
  o: InitInstanceOptions,
  result: InitFolioResult,
): void {
  const isRepo = existsSync(join(root, ".git"));
  const enclosing = enclosingRepoRoot(root);
  if (enclosing) {
    // Never a repository nested inside another by accident (bean `zdfa`).
    result.notes.push(`Inside the repository at '${enclosing}', so no git init: the folio is part of that repository.`);
  } else if (!isRepo) {
    const init = spawnSync("git", ["init"], { cwd: root, stdio: "pipe" });
    if (init.status === 0) result.notes.push("Initialized a git repository.");
    else {
      result.notes.push(`git init failed: ${init.stderr?.toString().trim() || "unknown error"}`);
      return;
    }
  }

  if (!enclosing) {
    const seed = seedMainIfEmpty(root, o.slug);
    if (seed.kind === "seeded") {
      result.notes.push(
        `The repository was empty, so main was seeded with one empty commit${seed.pushed ? " and pushed" : ""}, ` +
        `and this scaffold is on branch '${seed.branch}'. Commit it there and open a pull request against main.`,
      );
    } else if (seed.kind === "no-main") {
      result.notes.push(`This repository has commits but no 'main' (on '${seed.current}'). Not seeded — that would give it a second root.`);
    } else if (seed.kind === "stopped") {
      result.notes.push(`Stopped before linking the platform: ${seed.reason}.`);
      return;
    }
  }

  if (o.link === "sibling") {
    result.notes.push(
      `Linked as a sibling checkout at '${assistant}' — nothing to add to version control. ` +
      `Note that a fresh clone of this folio will not have it; the staging workflow checks the platform ` +
      `out in CI and links it at that path.`,
    );
    return;
  }

  if (o.link === "remote") {
    result.notes.push(
      `Linked via remote mounts in index.config.json — run 'bun run cat state:mount' (after approving pins with 'bun run cat mount:remote --approve') to mount the platform layers.`,
    );
    return;
  }

  if (existsSync(join(root, assistant))) {
    result.notes.push(`'${assistant}' already exists — left as is.`);
    return;
  }

  const add = spawnSync("git", ["submodule", "add", FOLIO_ASSISTANT_REPO, assistant], {
    cwd: root,
    stdio: "pipe",
    timeout: 300_000,
  });
  if (add.status === 0) {
    result.notes.push(`Added folio-assistant as a submodule at '${assistant}'.`);
  } else {
    result.notes.push(
      `Could not add the submodule (${add.stderr?.toString().trim().slice(0, 300) || "unknown error"}). ` +
      `Run it yourself: git submodule add ${FOLIO_ASSISTANT_REPO} ${assistant}`,
    );
  }
}

/**
 * What {@link seedMainIfEmpty} found, and what it did about it.
 *
 * - `seeded` — the repository had no commits; `main` now holds one empty seed
 *   commit (pushed where a remote exists) and the scaffold sits on `branch`.
 * - `has-main` — ordinary repository; nothing to do.
 * - `no-main` — commits exist but no `main`. Reported, NEVER seeded over: a
 *   repository with history on `master` is a different case, and a seed commit
 *   would give it two unrelated roots.
 * - `stopped` — could not seed safely; `reason` says why and nothing past the
 *   check was done.
 */
export type SeedOutcome =
  | { kind: "seeded"; branch: string; pushed: boolean }
  | { kind: "has-main" }
  | { kind: "no-main"; current: string }
  | { kind: "stopped"; reason: string };

/**
 * On an EMPTY repository, make `main` real before bootstrapping onto it.
 *
 * Bean `izqr`, owner 2026-09-22: *"when bootstrap initializes, if repo is
 * empty, it should seed main then bootstrap"*. A repository with no commits
 * has no base for a feature branch, no target for a PR, and nothing for
 * staging, `id-stable` or a ChangeSet to diff against — so a bootstrap onto it
 * either fails at the first `git switch -c`, or becomes the root of `main`
 * itself and is never reviewable. Seeding first makes the bootstrap an
 * ordinary branch, and so an ordinary PR.
 *
 * **The seed is an EMPTY commit.** The least that makes `main` real, and it
 * holds nothing a bootstrap would then have to overwrite — a README or
 * `.gitignore` stub would be exactly that.
 *
 * **A remote is asked before anything is written.** A remote that already has
 * branches means the local repository is empty only because nothing was
 * fetched; seeding would fork history. A remote that cannot be asked is could
 * not determine, and stops rather than guesses. A seed that cannot be pushed
 * stops too: the owner's rule is never to bootstrap onto an orphan branch.
 */
export function seedMainIfEmpty(root: string, slug: string): SeedOutcome {
  const head = git(root, ["rev-parse", "--verify", "--quiet", "HEAD"]);
  if (head.ok) {
    if (git(root, ["show-ref", "--verify", "--quiet", "refs/heads/main"]).ok) return { kind: "has-main" };
    const current = git(root, ["symbolic-ref", "--short", "--quiet", "HEAD"]).out || "(detached)";
    return { kind: "no-main", current };
  }

  const remote = remoteState(root);
  const hasOrigin = remote.kind !== "no-origin";
  if (remote.kind === "unknown") return { kind: "stopped", reason: `could not ask the remote whether it is empty (${remote.reason}) — not seeding over history nobody checked` };
  if (remote.kind === "has-branches") return { kind: "stopped", reason: "the remote already has branches — this checkout is empty only because nothing was fetched; fetch and check out its default branch instead of seeding" };

  if (!git(root, ["symbolic-ref", "HEAD", "refs/heads/main"]).ok) return { kind: "stopped", reason: "could not point HEAD at main" };
  const seed = git(root, ["-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "Seed main"]);
  if (!seed.ok) return { kind: "stopped", reason: `the seed commit failed (${seed.err.slice(0, 200) || "unknown error"}) — often an unset user.name / user.email` };

  let pushed = false;
  if (hasOrigin) {
    const push = git(root, ["push", "--quiet", "-u", "origin", "main"], 120_000);
    if (!push.ok) return { kind: "stopped", reason: `main was seeded locally but could not be pushed (${push.err.slice(0, 200) || "unknown error"}) — not bootstrapping onto a branch whose base the remote lacks` };
    pushed = true;
  }

  const branch = `bootstrap/${slug}`;
  if (!git(root, ["switch", "--quiet", "-c", branch]).ok) return { kind: "stopped", reason: `main was seeded but branch '${branch}' could not be created` };
  return { kind: "seeded", branch, pushed };
}

/** Render a result as the report a human or an agent reads. */
export function formatInitResult(result: InitFolioResult, o: InitFolioOptions | InitInstanceOptions): string {
  const folio = "contentType" in o ? o : undefined;
  const lines = folio
    ? [
        `Initialized a ${folio.contentType} folio: ${o.title}`,
        `  folio/${o.slug}/  ·  ${result.created.length} file(s) written`,
        "",
      ]
    : [
        `Initialized a harness instance with no content type: ${o.title}`,
        `  ${instanceDeclarationFilename(o.slug)}  ·  ${result.created.length} file(s) written`,
        "",
      ];
  for (const f of result.created) lines.push(`  + ${f}`);
  if (result.skipped.length) {
    lines.push("", `Left alone (already present — pass force to overwrite):`);
    for (const f of result.skipped) lines.push(`  = ${f}`);
  }
  if (result.notes.length) {
    lines.push("", "Notes:");
    for (const n of result.notes) lines.push(`  · ${n}`);
  }
  if (!folio) return lines.join("\n");
  lines.push(
    "",
    "Next:",
    `  1. Edit folio/${o.slug}/introduction/overview.md — it is a placeholder.`,
    `  2. Ask your agent to "add a chapter on <topic>".`,
    `  3. Run content_validate, then ${folio.contentType === "document" ? "document_render_md" : "content_build"}.`,
  );
  return lines.join("\n");
}

// ── Staged sub-KG (bean 3tza, owner ruling 1, 2026-10-06) ────────

/**
 * A sub-KG staged INSIDE a harnessed repository, ahead of (maybe) leaving it.
 *
 * Stage 1 of `sub-kg-lifecycle`. `initInstance` scaffolds a whole REPOSITORY —
 * `AGENTS.md`, `.mcp.json`, a beans store, a session hook, fifteen files
 * (measured with `--dry-run`, 2026-10-06) — which is right for a new
 * repository and wrong inside an existing one, where every one of those files
 * already exists at the host's root and a second copy in a subdirectory is
 * noise nothing reads. So this writes exactly two files, both under the staged
 * path, and nothing anywhere else:
 *
 * - `<path>/<slug>.json`: the declaration, with `repository` (the PLANNED
 *   home) different from `livesAt.repository` (the host). That difference is
 *   what makes it a staged layer: the separation guard and `seed:ready`
 *   read it, and nothing lists staged layers by hand.
 * - `<path>/platform.ts`: the import seam, empty. Every platform symbol the
 *   sub-KG later uses is re-exported from here, so re-pointing the platform on
 *   separation is a one-file edit (`instance-separation-imports.test.ts`).
 *
 * `directories` is `[]` on purpose: declare a directory with its files, in
 * one commit (bean `dh4f`), never ahead of them.
 */
export interface InitStagedOptions {
  /** The HOST repository's root. */
  hostDir: string;
  /** Where the sub-KG sits, relative to the host root. Becomes `livesAt.path`. */
  path: string;
  slug: string;
  title: string;
  /** The planned home, `owner/name`. */
  repository: string;
  /** The host, `owner/name`. Derived from the host's `origin` remote when absent. */
  hostRepository?: string;
  /** The layers it stands on. At least one: a staged sub-KG instantiates some harness. */
  needs: string[];
  force?: boolean;
  dryRun?: boolean;
}

const REPO_FULL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

function stagedPlatformSeam(o: InitStagedOptions): string {
  return `/**
 * The ONE file in ${o.slug} that names where the platform lives.
 *
 * ${o.slug} is staged here ahead of becoming its own repository
 * (\`${o.repository}\`). Every platform symbol it uses is re-exported from this
 * file, and no other file in the directory imports from outside it, so on the
 * day it leaves, re-pointing the platform is a one-file edit.
 * \`instance-separation-imports.test.ts\` holds the rule. Lifecycle:
 * \`sub-kg-lifecycle\`.
 *
 * @module ${o.slug}/platform
 */
export {};
`;
}

/** Scaffold a staged sub-KG's declaration and import seam, and nothing else. */
export function initStaged(options: InitStagedOptions): InitFolioResult {
  const o = options;
  checkSlug(o.slug);
  const host = resolve(o.hostDir);
  const root = resolve(host, o.path);
  const rel = relative(host, root).split(sep).join("/");
  if (rel === "" || rel.startsWith("..")) {
    throw new Error(`--staged path must be a directory INSIDE the host, got '${o.path}'`);
  }
  if (!REPO_FULL_NAME.test(o.repository)) throw new Error(`--repository must be owner/name, got '${o.repository}'`);
  if (o.needs.length === 0) throw new Error("--needs is required: a staged sub-KG instantiates some harness");
  let hostRepository = o.hostRepository;
  if (hostRepository === undefined) {
    const r = spawnSync("git", ["remote", "get-url", "origin"], { cwd: host, stdio: "pipe" });
    if (r.status !== 0) throw new Error("cannot read the host's origin remote; pass --host-repository owner/name");
    hostRepository = repoSlug(r.stdout.toString().trim());
  }
  if (!REPO_FULL_NAME.test(hostRepository)) throw new Error(`--host-repository must be owner/name, got '${hostRepository}'`);
  if (hostRepository === o.repository) {
    throw new Error("the planned --repository is the host: a sub-KG that stays in its host is not staged, it is just a directory");
  }

  const declaration = {
    $schema: CAT_HARNESS_DECLARATION_SCHEMA_TAG,
    name: o.slug,
    title: o.title,
    repository: o.repository,
    livesAt: { repository: hostRepository, path: rel },
    version: "0.1.0",
    needs: o.needs,
    directories: [],
  };
  const files: Array<[string, string]> = [
    [join(rel, instanceDeclarationFilename(o.slug)), JSON.stringify(declaration, null, 2) + "\n"],
    [join(rel, "platform.ts"), stagedPlatformSeam(o)],
  ];
  const result: InitFolioResult = { created: [], skipped: [], notes: [], stateGraphs: [] };
  for (const [relPath, content] of files) {
    const full = join(host, relPath);
    if (existsSync(full) && !o.force) {
      result.skipped.push(relPath);
      continue;
    }
    if (!o.dryRun) {
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content, "utf-8");
    }
    result.created.push(relPath);
  }
  result.notes.push(
    "Declare each graph directory in the same commit as its first files (bean dh4f).",
    "Route every import from outside the directory through platform.ts.",
    "Next stages: sub-kg-lifecycle (skill) / sub-kg-lifecycle.bpmn.",
  );
  return result;
}

/** The report for `--staged`: what was written, under one directory only. */
export function formatStagedResult(result: InitFolioResult, o: InitStagedOptions): string {
  const lines = [
    `Staged sub-KG ${o.slug} (planned home ${o.repository}) at ${o.path}  ·  ${result.created.length} file(s) written`,
    "",
  ];
  for (const f of result.created) lines.push(`  + ${f}`);
  if (result.skipped.length) {
    lines.push("", "Left alone (already present — pass --force to overwrite):");
    for (const f of result.skipped) lines.push(`  = ${f}`);
  }
  lines.push("", "Notes:");
  for (const n of result.notes) lines.push(`  · ${n}`);
  return lines.join("\n");
}

// ── CLI ──────────────────────────────────────────────────────────

const USAGE = `init-folio — scaffold a new folio repository

Usage:
  bun run cat-harness-tools/scripts/init-folio.ts [options]

Options:
  --dir <path>        Folio root to scaffold into            (default: .)
  --instance          A harness instance with NO content type: no folio/,
                      no adapter, no --type or --author (bean mer2)
  --type <type>       paper | document                       (default: document)
  --slug <slug>       Document slug under folio/           (default: from --title)
  --title <title>     Document title                         (required)
  --author <name>     Author. Repeat for several.            (required for a folio)
  --link <mode>       submodule | sibling | remote           (default: submodule)
  --assistant <path>  Path to folio-assistant, relative to the folio root
  --force             Overwrite files that already exist
  --dry-run           Report what would be written
  --skip-vcs          Do not run git init / git submodule add
  --iri-base <url>    With --instance: where its IRIs are minted and its
                      JSON-LD context is published (default: derived from a
                      GitHub origin, https://<owner>.github.io/<repo>/)
  --staged <path>     A sub-KG staged INSIDE the host repo at --dir: writes
                      only <path>/<slug>.json and <path>/platform.ts
                      (bean 3tza). Needs --repository and --needs; the slug
                      defaults to the path's last segment
  --repository <o/n>  With --staged: the planned home, owner/name
  --host-repository <o/n>  With --staged: the host (default: origin remote)
  --needs <name>      With --staged: an instance it stands on. Repeatable
  --help
`;

/** `"My Guidance Note"` → `"my-guidance-note"`. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ParsedArgs =
  | { kind: "folio"; options: InitFolioOptions }
  | { kind: "instance"; options: InitInstanceOptions }
  | { kind: "staged"; options: InitStagedOptions };

function parseArgs(argv: string[]): ParsedArgs | "help" {
  const authors: string[] = [];
  let dir = ".";
  let contentType: "paper" | "document" = "document";
  let slug: string | undefined;
  let title: string | undefined;
  let link: LinkMode = "submodule";
  let assistantPath: string | undefined;
  let force = false;
  let dryRun = false;
  let skipVcs = false;
  let iriBase: string | undefined;
  let instance = false;
  let typeGiven = false;
  let staged: string | undefined;
  let repository: string | undefined;
  let hostRepository: string | undefined;
  const needs: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    switch (a) {
      case "--help": case "-h": return "help";
      case "--dir": dir = next(); break;
      case "--instance": instance = true; break;
      case "--type": {
        typeGiven = true;
        const t = next();
        if (t !== "paper" && t !== "document") throw new Error(`--type must be paper or document, got '${t}'`);
        contentType = t;
        break;
      }
      case "--slug": slug = next(); break;
      case "--title": title = next(); break;
      case "--author": authors.push(next()); break;
      case "--link": {
        const l = next();
        if (l !== "submodule" && l !== "sibling" && l !== "remote") throw new Error(`--link must be submodule, sibling or remote, got '${l}'`);
        link = l;
        break;
      }
      case "--assistant": assistantPath = next(); break;
      case "--force": force = true; break;
      case "--dry-run": dryRun = true; break;
      case "--skip-vcs": skipVcs = true; break;
      case "--iri-base": iriBase = next(); break;
      case "--staged": staged = next(); break;
      case "--repository": repository = next(); break;
      case "--host-repository": hostRepository = next(); break;
      case "--needs": needs.push(next()); break;
      default: throw new Error(`Unknown option: ${a}`);
    }
  }

  if (!title) throw new Error("--title is required");
  if (staged !== undefined) {
    // Refused rather than ignored: each of these writes repository-level
    // files, which is exactly what a staged sub-KG must not get.
    if (instance || typeGiven || authors.length > 0) {
      throw new Error("--staged takes no --instance, --type or --author: it writes a declaration and a seam, not a repository or a folio");
    }
    if (!repository) throw new Error("--staged needs --repository owner/name (the planned home)");
    const last = staged.split(/[\\/]/).filter(Boolean).pop() ?? "";
    return {
      kind: "staged",
      options: { hostDir: dir, path: staged, slug: slug ?? last, title, repository, hostRepository, needs, force, dryRun },
    };
  }
  if (repository !== undefined || hostRepository !== undefined || needs.length > 0) {
    throw new Error("--repository, --host-repository and --needs go with --staged");
  }
  const common = { targetDir: dir, slug: slug ?? slugify(title), title, link, assistantPath, force, dryRun, skipVcs };
  if (instance) {
    // Refused rather than ignored: a content type passed to a contentless
    // init is a caller who wanted a folio and would silently not get one.
    if (typeGiven) throw new Error("--instance takes no --type: an instance with a content type is a folio");
    if (iriBase !== undefined && !/^https?:\/\/.+\/$/.test(iriBase)) throw new Error(`--iri-base must be a URL ending in '/', got '${iriBase}'`);
    return { kind: "instance", options: { ...common, ...(iriBase !== undefined ? { iriBase } : {}) } };
  }
  if (iriBase !== undefined) throw new Error("--iri-base goes with --instance");
  if (authors.length === 0) throw new Error("--author is required (repeat for several)");

  return { kind: "folio", options: { ...common, contentType, authors } };
}

if (import.meta.main) {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    if (parsed === "help") {
      console.log(USAGE);
      process.exit(0);
    }
    if (parsed.kind === "staged") {
      const result = initStaged(parsed.options);
      console.log(formatStagedResult(result, parsed.options));
      process.exit(0);
    }
    const result = parsed.kind === "instance" ? initInstance(parsed.options) : initFolio(parsed.options);
    console.log(formatInitResult(result, parsed.options));
    process.exit(0);
  } catch (e) {
    console.error(`init-folio: ${e instanceof Error ? e.message : String(e)}`);
    console.error(`\n${USAGE}`);
    process.exit(1);
  }
}
