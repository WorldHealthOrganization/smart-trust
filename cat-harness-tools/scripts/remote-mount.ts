#!/usr/bin/env bun
/**
 * remote-mount — lay a harness and its dependency closure down from another
 * repository at a pinned commit, lock what arrived, and check it.
 *
 * @module scripts/remote-mount
 * @graphNode none — a session-start step and a gate over declared `remoteMounts`
 * @covers none — it MAKES dependency layers readable and judges none of their
 * content; the gates that judge a layer run over it once it is mounted, and a
 * mount that claimed their coverage would let them be removed unnoticed (the
 * reasoning `state-mount.ts` records for the branch mounts).
 *
 * Schema: `schemas/kg/remote-mount.ts`.
 *
 *   bun run cat mount:remote              # plan, fetch, mount, write the lock, re-render the agent surface if it changed
 *   bun run cat mount:remote --plan       # resolve the closure and print it; write nothing
 *   bun run cat mount:remote:check        # disk against lock against declaration — no network
 *   bun run cat mount:remote --no-install # lay the bytes down without `bun install` in each mount
 *   bun run cat mount:remote --no-health  # a re-pin that moves cat-harness-tools does not regenerate the health report (lib/repin-health.ts)
 *   bun run cat mount:remote --help       # print this header; run nothing
 *   echo "<where they said yes>" | bun run cat mount:remote --seed <name>=<owner/repo>@<sha> --consent-by <who> [--whole]
 *                                          # create or re-pin a remote layer in index.config.json, WITH its consent
 *   bun run cat mount:remote --choose <harness>[:<instance>] [--directories a,b] [--tools x,y]
 *                                          # write a review's choice into overrides.<instance>, so a fresh clone replays it
 *   bun run cat mount:repin:standing [--dry-run]
 *                                          # re-pin every layer a STANDING consent covers (repin-standing.ts)
 *
 * `state:mount` runs the mount after the branch mounts, so the session-start
 * hook needs no second entry point.
 *
 * ## The closure, transitively
 *
 * A downstream names a harness, its repository and a 40-character pin. The
 * harness's declaration is read FROM THAT TREE; each name in its `needs` is
 * looked for in the same tree (a layer whose `<name>.json` agrees with its
 * own `name`), and failing that as a GITLINK at that tree — a submodule entry
 * is itself a pin. A need found in neither is `missing`, never dropped. A
 * need the downstream already holds as a local layer is `local` —
 * supplied, not mounted over.
 *
 * ## Three states, never two
 *
 * Every layer comes back `mounted`, `missing` or `could-not-determine`. A
 * fetch that failed is the third, not an empty layer; a lock that cannot be
 * read is the third, not "nothing mounted". The process exits 0 only when
 * every layer is mounted or local (or nothing is declared), 1 when any is
 * missing, 2 when any could not be determined.
 *
 * ## A changed lock re-renders the agent surface
 *
 * A newly pinned layer can bring new or renamed skills and agent-memory
 * entries, and an agent reads the GENERATED surface: `.claude/commands/`
 * (`skill:commands`) and `.claude/agent-memory/` plus the `.agents/` copies
 * (`agent-memory`). So when this run CHANGES the lock, it runs both
 * generators from the checkout root before exiting, and a generator that
 * fails fails the run. `--no-agent-surface` skips it; `--check`, `--plan` and
 * `--staging` never run it.
 *
 * The same run then publishes the new lock's LAYERS CACHE REF
 * (`refs/cat/layers/<key>` at the index's origin; `mount-from-lock.ts`
 * `publishLayers`), so the committer who changed the lock is its writer and CI
 * only fetches and verifies it. It is time only: a refusal (a mount not
 * `current`), no remote, or a push the credential cannot make is reported and
 * never changes the exit code here; the PR gate does (`layers:check`, job
 * `layers-ref` of `layer-pr-checks.yml`). `--no-layers-publish` skips it.
 *
 * ## A mount is runnable, and an install does not make it modified
 *
 * After the bytes are locked, each mounted layer that carries a
 * `package.json` gets `bun install --no-save --omit dev` (`--install-all`
 * keeps devDependencies, `--no-install` skips it). `node_modules/` is outside
 * every mount digest and the lockfile is put back byte-for-byte, so `--check`
 * still passes over an installed mount and a re-mount does not refuse it.
 * Why not a root-level workspace: `installDependencies` in
 * `mount-from-lock.ts`.
 *
 * ## Seeding writes consent
 *
 * `--seed <name>=<owner/repo>@<sha> --consent-by <who> --evidence "<…>"`
 * creates or re-pins a remote layer in `index.config.json` and writes its
 * `trust.consent` bound to that pin in the same write, so a pin and its
 * consent cannot be committed apart.
 *
 * ## Hydrated: metadata, no files
 *
 * `hydrated: true` on a mount entry (every layer it reaches) or on
 * `overrides.<instance>` (that one; `false` opts back out) lays each chosen
 * directory down as ONE file — the subgraph's `index.hydrated.jsonld`, read at
 * the pin from where the layer publishes it,
 * `<docs>/subgraph/<HARNESS>/<path>/` (`publishedSubgraphDir`), and checked
 * against `SubgraphHydratedSchema` and the IRI it must declare before it
 * lands, as `kg:materialize`'s metadata mode does. Each such directory's
 * per-directory answer is a `kind: "hydrated"` `SubgraphSource` naming this
 * Tool.
 *
 * Which directories: `directories` as for a file mount when it is given, and
 * then a named subgraph the pin does not publish is `missing`. Absent, every
 * declared in-checkout directory whose hydrated file the pin HOLDS — the
 * others are named in the detail, and a pin that holds none is `missing`,
 * never an empty "mounted". No `<name>.json` is laid down and the lock marks
 * the layer `hydrated` (`schemas/kg/remote-mount.ts` says why).
 *
 * Absent, it is NOT `mountDefaults.directories`: that list answers which
 * FILES a downstream wants, while a hydrated mount shows everything there is
 * to choose from, at the cost of one file of descriptions per subgraph.
 *
 * ## Named ids: declared, or declared FROM WITHIN
 *
 * An id in `overrides.<instance>.directories` or `mountDefaults.directories`
 * is looked up in the layer's `<name>.json` first, and — only when it is
 * not there — among the directories it declares from within one of its own
 * (`skills/skills.json` naming `voices/`), resolved at the pin by
 * `upstream-directories.ts` through cat-harness's `instanceDirectories`, so a
 * remote plan and a local one agree on what an id names. A nested id
 * mounts its own path (`skills/voices/` alone, or its published hydrated
 * file); naming it beside its parent mounts nothing twice that the digest
 * would count differently, since every digest is taken after every copy. The
 * DEFAULT list (nothing named) stays the top-level entries: each already
 * holds what is declared within it — its files, or, hydrated, its nested
 * subgraphs inline (`hasSubgraph`).
 *
 * ## Concern names
 *
 * An id that is neither, but is a concern group's code (`sdlc`, `kg`, `ui`
 * …, from `code-lists/concern-group.json`), names that concern across kinds:
 * it expands to every kind-first member the layer declares —
 * `processes/sdlc/`, `skills/sdlc/`, `schemas/sdlc/` — read from each
 * grouping kind's own declaration file at the pin (`processes.json`
 * `groups`, `skills.json` `topics`; the walk `concern-groups.ts` owns). Each
 * member is locked under the id `<directory id>/<code>`. A code no kind of
 * the layer declares is refused like any other unknown id.
 *
 * ## Tools: chosen by id, mounted runnable
 *
 * `overrides.<instance>.tools` names Tools that layer declares. Each is
 * brought RUNNABLE — its definition, its implementation and their import
 * closure — as the declared directories that closure touches, and with
 * `tools` named anywhere in an entry, that entry's layers mount those
 * directories (plus any their override names) instead of their default list.
 * A `whole` layer stays whole. A layer of ANOTHER entry the closure
 * reaches shrinks too, to the directories the closures need from it, unless
 * its own entry mounts it whole or names its `directories`: then that list
 * stands, and must already bring what the closure needs. The rules and why
 * each is so are in `tool-closure.ts`, which computes it; this file only
 * plans with it:
 *
 * - each chosen Tool's `invoke` is read from the declaring layer's
 *   published `tools` metadata (`index.hydrated.jsonld`) at the pin — the
 *   tree, else the pin's subgraph index package, exactly as a hydrated mount
 *   reads it — because the plan runs before the trust gate and must not
 *   execute a definition to learn what it runs;
 * - a Tool that cannot be brought whole (not declared, not in the metadata,
 *   an import that names nothing, a closure file in no declared directory)
 *   makes the declaring layer `missing` (`could-not-determine` when a
 *   fetch failed) and every layer of its entry unmounted with it: a
 *   half-brought Tool is never mounted.
 *
 * ## It never discards work
 *
 * A mounted directory whose bytes no longer hash to the lock is left exactly
 * as it is and reported, never re-fetched over. `--fresh` is the one explicit
 * exception, for a build that writes into its own mounts and wants them laid
 * down again: it replaces an edited mount as if it were current, still only
 * what the lock says this mount put there, never tracked bytes or a
 * directory no lock names. A path that holds anything this
 * mount did not put there — a tracked file, an unlocked directory — is refused.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { checkoutOwner, isSameOwnerName, relativizeLockRepositories, resolveRepository } from "../schemas/kg/repo-owner.ts";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { z } from "zod";

import { mountTrust, withConsent, type ConsentGrant, type TrustVerdict } from "../schemas/kg/mount-trust.js";
import { checkoutRootFor, defaultGraphTypologies, instanceDirectories, layerRootsIn, readDeclaration, type GraphTypologyRegistry } from "../schemas/kg/cat-harness.js";
import { INDEX_CONFIG_SCHEMA, lockedMountPaths, readDeclaredMounts, readIndexConfig, readMountFields, syncIgnoreBlock, writeDeclaredMounts, type IndexConfig } from "../schemas/kg/index-config.js";
import {
  MOUNT_LOCK_SCHEMA,
  MountDefaultsSchema,
  MountPathSchema,
  mountLockFilename,
  mountLockPathFor,
  readMountLock,
  type LockedInstance,
  type MountLock,
  type RemoteMount,
  WHOLE_INSTANCE_ID,
  checkMountPathCollisions,
} from "../schemas/kg/remote-mount.js";
import { contentIsOffCheckout, HydratedSourceSchema, type HydratedSource, type SubgraphSource } from "../schemas/kg/subgraph-source.js";
import { closeOverRequires, enabledSubgraphs, requiresDeclared, isSubgraphEnabled, qualifiedSubgraphId, type EnabledSubgraphs } from "../schemas/kg/opt-in-subgraphs.js";
import { publishedSubgraphDir, SUBGRAPH_HYDRATED_FILE, SubgraphHydratedSchema } from "../schemas/kg/subgraph-manifest.js";
import { treeDigest, treeEntries } from "./kg-parts.ts";
import { builtAtPublishOf, installDependencies, isInstallArtefact, publishLayers, stateMountedDirs, withoutBuiltAtPublish, withoutInstallArtefacts, withoutSelfIgnored, withoutStateMounts, type InstallMode } from "./mount-from-lock.ts";
import { RemoteTree, type UrlFor } from "./remote-tree.ts";
import { fetchSubgraphIndex, type PackageUrlFor, type SubgraphIndexFetch } from "./subgraph-index-package.ts";
import { toolClosure, type ClosureInstance, type ResolvedTool, type ToolChoice } from "./tool-closure.ts";
import { upstreamConcernMembers, upstreamDirectories, withKindsOf, type UpstreamDirectory } from "./upstream-directories.ts";
import { run as syncWorkflowPins } from "./workflow-pins.ts";
import { afterMountHealth } from "./lib/repin-health.ts";
import { ConcernGroupCodeSchema } from "../schemas/kg/concern-groups.ts";

/**
 * Move every state mount under `target` (per `stateMountedDirs`) out of the
 * way, and return how to put them back. The hold is in the git directory, so
 * nothing scanning the checkout sees it, and on the same filesystem, so a
 * rename moves it. `restore` replaces whatever the re-lay put at those paths.
 */
/**
 * The directory ids a declaration's `builtAtPublish` names: an entry's
 * `directory`, or the declared directory whose `path` is the entry's. Such a
 * directory is built by the publish and is never committed, so a pin of it
 * has nothing there to copy; the remote mount must not report it absent.
 */
export function builtAtPublishDirectories(declText: Buffer | string): Set<string> {
  const out = new Set<string>();
  let d: { builtAtPublish?: unknown; directories?: unknown };
  try {
    d = JSON.parse(String(declText));
  } catch {
    return out;
  }
  if (!Array.isArray(d.builtAtPublish)) return out;
  const norm = (x: string) => x.replace(/^\.\//, "").replace(/\/+$/, "");
  const paths = new Set<string>();
  for (const e of d.builtAtPublish as Array<{ path?: unknown; directory?: unknown }>) {
    if (!e || typeof e !== "object") continue;
    if (typeof e.directory === "string") out.add(e.directory);
    if (typeof e.path === "string") paths.add(norm(e.path));
  }
  for (const dir of Array.isArray(d.directories) ? (d.directories as Array<{ id?: unknown; path?: unknown }>) : [])
    if (dir && typeof dir.id === "string" && typeof dir.path === "string" && paths.has(norm(dir.path))) out.add(dir.id);
  return out;
}

function holdStateMounts(checkout: string, target: string): { restore: () => void } {
  const under = resolve(target) + "/";
  return holdPaths(checkout, stateMountedDirs(checkout).filter((d) => (resolve(d) + "/").startsWith(under)));
}

/**
 * Move each mounted directory's `node_modules/` out of the way for a re-lay,
 * and return how to put it back. An install artefact is outside every digest
 * and is never this mount's bytes, so a re-lay must not delete it — and for a
 * WORKSPACE MEMBER it cannot be rebuilt here: {@link installDependencies}
 * rightly declines to install inside one, because the root's own `bun install`
 * provides it. Deleting it therefore left the member with no dependencies of
 * its own until the root was installed again: a nested devDependency the
 * member pins (the formal-math layer's `katex@0.18.10`, beside the root's 0.16)
 * then resolved to the root's copy, which is how `crepe-latex.test.ts` failed
 * its version guard on CI after `state:mount` re-laid the mount.
 */
function holdInstallArtefacts(checkout: string, dirs: readonly string[]): { restore: () => void } {
  return holdPaths(checkout, [...new Set(dirs.map((d) => resolve(d, "node_modules")))]);
}

/** Rename each existing path in `paths` into a hold beside the git directory; `restore` puts each back. */
function holdPaths(checkout: string, paths: readonly string[]): { restore: () => void } {
  const inside = paths.filter((d) => existsSync(d));
  if (inside.length === 0) return { restore: () => {} };
  // input-site: inert #8ef446b5 — where a re-lay parks a state mount for a moment; it is put back before the mount returns
  const gitPath = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-path", "branch-mount-hold"], { cwd: checkout, encoding: "utf-8" });
  const base = gitPath.status === 0 ? gitPath.stdout.trim() : join(checkout, ".branch-mount-hold");
  mkdirSync(base, { recursive: true });
  const hold = mkdtempSync(join(base, "relay-"));
  const moved = inside.map((d, i) => {
    const to = join(hold, String(i));
    renameSync(d, to);
    return { d, to };
  });
  return {
    restore: () => {
      for (const { d, to } of moved) {
        rmSync(d, { recursive: true, force: true });
        mkdirSync(dirname(d), { recursive: true });
        renameSync(to, d);
      }
      rmSync(hold, { recursive: true, force: true });
    },
  };
}

// ── Reading an upstream declaration STRUCTURALLY ─────────────────────────────

/**
 * The fields of an upstream declaration the planner reads — and only those.
 * Structural on purpose: the upstream is at ITS pin, and its schema may be
 * newer or older than the one in this checkout. Holding it to this
 * checkout's full schema would refuse a harness for a field the mount never
 * reads.
 */
const UpstreamDeclarationSchema = z
  .object({
    name: z.string().min(1),
    needs: z.array(z.string().min(1)).optional(),
    livesAt: z.object({ path: z.string().min(1) }).passthrough().optional(),
    mountDefaults: MountDefaultsSchema.optional(),
    assets: z.array(z.object({ src: z.string().min(1), scope: z.string().optional() }).passthrough()).optional(),
    directories: z
      .array(z.object({ id: z.string().min(1), path: z.string().min(1), source: z.unknown().optional(), storage: z.unknown().optional() }).passthrough())
      .default([]),
    builtAtPublish: z.array(z.object({ path: z.string() }).passthrough()).optional(),
  })
  .passthrough();
type UpstreamDeclaration = z.infer<typeof UpstreamDeclarationSchema>;

/**
 * The directory ids a downstream mounts of `name` when its override names
 * none: the harness's `mountDefaults.directories`, else every declared
 * in-checkout directory — less each OPT-IN sub-graph the downstream has not
 * switched on (cat-harness#991 step 23.1). The DOWNSTREAM decides, as the
 * folio root does everywhere else (`opt-in-subgraphs.ts`): `cat-harness.sdlc`
 * stays upstream for a content layer, and comes down for one that enables it.
 * An explicit override naming the id still mounts it.
 */
export function defaultMountDirectoryIds(
  name: string,
  decl: Pick<UpstreamDeclaration, "directories" | "mountDefaults">,
  enabled: EnabledSubgraphs,
): string[] {
  const off = new Set(
    decl.directories
      .filter((d) => (d as { optIn?: unknown }).optIn === true && !isSubgraphEnabled(enabled, qualifiedSubgraphId(name, d.id)))
      .map((d) => d.id),
  );
  const ids =
    decl.mountDefaults?.directories ??
    decl.directories.filter((d) => !contentIsOffCheckout({ source: d.source as SubgraphSource | undefined, storage: d.storage })).map((d) => d.id);
  return ids.filter((id) => !off.has(id));
}

/**
 * A downstream's named directory list, plus every top-level opt-in sub-graph
 * of `name` it switches on that the list leaves out.
 *
 * Switching a sub-graph on means it comes down: `enableSubgraphs` and what an
 * enabled group `requires` (implied; owner, 2026-11-13) are the downstream's
 * choice too. A named list written before a layer grew its groups (or before
 * a group gained a `requires`) silently dropped them, so the switch resolved
 * nowhere: a root enabling a layer's `collab` group, which requires that
 * layer's level groups, mounted `collab/` without the levels, and a group
 * declared from within one of those levels was one nobody could read
 * (2026-11-15). Only top-level entries are added: one declared from within
 * comes down inside its parent's directory.
 */
export function withEnabledOptIns(
  name: string,
  decl: Pick<UpstreamDeclaration, "directories">,
  named: readonly string[],
  enabled: EnabledSubgraphs,
): string[] {
  const out = [...named];
  for (const d of decl.directories) {
    if ((d as { optIn?: unknown }).optIn !== true || out.includes(d.id)) continue;
    if (enabled !== "all" && isSubgraphEnabled(enabled, qualifiedSubgraphId(name, d.id))) out.push(d.id);
  }
  return out;
}

/**
 * What a WHOLE-layer mount leaves out: every opt-in sub-graph of `name` the
 * downstream has not switched on, top-level or declared from within, as a
 * layer-relative path (no trailing slash), outermost only.
 *
 * A whole mount exists for a layer a downstream reads as a checkout (its
 * `package.json` is a workspace), not to bring every graph: before this, a
 * content layer that never enabled `cat-harness.sdlc` or the library corpus
 * still received their files (123 MB of corpus for every IG). Switched off is
 * invisible to the agent (`opt-in-subgraphs.ts`), so it need not be on disk
 * either. A downstream that enables one gets it, as with the default list.
 *
 * When the nested declarations cannot be read at the pin, only the
 * top-level opt-in entries are left out: a mount that brings more than it
 * must is safe, one that silently brings less is not.
 */
export function switchedOffOptInPaths(
  name: string,
  topLevel: ReadonlyArray<{ id: string; path: string; optIn?: unknown }>,
  nested: ReadonlyArray<{ id: string; path: string; optIn?: boolean }>,
  enabled: EnabledSubgraphs,
): string[] {
  const seen = new Set(topLevel.map((d) => d.id));
  const all = [...topLevel, ...nested.filter((d) => !seen.has(d.id))];
  const off = all
    .filter((d) => d.optIn === true && !isSubgraphEnabled(enabled, qualifiedSubgraphId(name, d.id)))
    .map((d) => strip(d.path).replace(/^\.\//, ""))
    .filter((p) => p !== "" && p !== "." && !p.split("/").includes(".."));
  const sorted = [...new Set(off)].sort((a, b) => a.length - b.length || a.localeCompare(b));
  return sorted.filter((p, i) => !sorted.slice(0, i).some((q) => p.startsWith(`${q}/`))).sort();
}

/** {@link switchedOffOptInPaths} at a pin, as the planned directory's `except` field (absent when nothing is left out). */
function wholeExcept(
  name: string,
  tree: RemoteTree,
  found: { root: string; file: string; decl: UpstreamDeclaration },
  enabled: EnabledSubgraphs,
  kinds?: GraphTypologyRegistry,
): { except?: string[] } {
  if (enabled === "all") return {};
  const top = found.decl.directories as Array<{ id: string; path: string; optIn?: unknown }>;
  const nested = upstreamDirectories(tree, found.root, found.file, kinds);
  const except = switchedOffOptInPaths(name, top, nested.ok ? nested.directories : [], enabled);
  return except.length ? { except } : {};
}

// ── The plan ─────────────────────────────────────────────────────────────────

export interface PlannedDirectory {
  id: string;
  /** Checkout-relative, no trailing slash. */
  path: string;
  /** Upstream-relative, no trailing slash. For a hydrated directory, the directory its `index.hydrated.jsonld` is published in. */
  upstreamPath: string;
  /**
   * A whole-layer mount only: the opt-in sub-graphs the downstream has not
   * switched on, relative to `upstreamPath`, no trailing slash. Left out of
   * the checkout, the copy and the digest (see {@link switchedOffOptInPaths}).
   */
  except?: string[];
  /** Set when the directory is mounted as hydrated metadata: its per-directory source (bean `mo75` G2). */
  hydrated?: HydratedSource;
  /**
   * Hydrated, and the pin's git tree holds no file for it: the pin's subgraph
   * index PACKAGE does (bean `mo75` G2b). `file` is the verified, unpacked
   * copy to lay down; the rest goes in the lock.
   */
  package?: { url: string; sha256: string; member: string; file: string };
}

export interface PlannedInstance {
  instance: string;
  repository: string;
  sha: string;
  upstreamRoot: string;
  path: string;
  via: string;
  pinnedBy: LockedInstance["pinnedBy"];
  declarationFile: string;
  directories: PlannedDirectory[];
  /**
   * The declaration's instance-scoped `assets[].src` (instance-relative, no
   * `..`): single files the declaration itself names — its README and
   * AGENTS.md — laid down beside it. Declared, so they arrive through a
   * declared path like a directory does (bean `hupw`).
   */
  assets: string[];
  /** Mounted as hydrated metadata: one `index.hydrated.jsonld` per directory, no declaration laid down. */
  hydrated?: true;
  /** Hydrated, directories not named: the declared directories the pin publishes no hydrated file for. */
  notPublished?: string[];
  /** Hydrated: what the pin's subgraph index package answered, when it was looked for and held nothing usable. */
  packageNote?: string;
  /** The Tools this layer's override chose, as brought (bean `mo75` G3): said in its outcome. */
  tools?: ResolvedTool[];
}

export type InstanceOutcome =
  | { instance: string; state: "mounted"; path: string; detail: string }
  /** The downstream holds this layer itself; nothing was mounted over it. */
  | { instance: string; state: "local"; path: string; detail: string }
  /** An override said `skip`. */
  | { instance: string; state: "skipped"; detail: string }
  /**
   * `edited`: on disk at the pinned layer, but some pinned bytes changed
   * (every bad directory or asset is `modified`, none `absent`). A mount
   * leaves such a layer untouched unless `--fresh`, so a fetch cannot
   * change its verdict (bean `cat-tools-sm8r`).
   */
  | { instance: string; state: "missing"; path?: string; detail: string; edited?: true }
  /** The trust check (H8) said no — at mount time, or on re-judging a recorded basis. */
  | { instance: string; state: "refused"; path?: string; detail: string }
  /** Mounted on consent whose `by` no declared `mountApprovers` list checked. Its own state, never clean. */
  | { instance: string; state: "unverified-approver"; path: string; detail: string }
  | { instance: string; state: "could-not-determine"; path?: string; detail: string };

export interface Plan {
  /** Absolute root of the declaring (downstream) layer. */
  instanceRoot: string;
  downstream: string;
  mounts: RemoteMount[];
  /** The downstream's declared `mountApprovers`, if any. */
  approvers?: string[];
  instances: PlannedInstance[];
  outcomes: InstanceOutcome[];
}

export interface RemoteMountOptions {
  /** The downstream layer root; defaults to the checkout's root layer. */
  instanceRoot?: string;
  /**
   * `--fresh`: replace a mount whose bytes no longer hash to the lock instead
   * of leaving it untouched. Explicit only: the default never discards edits.
   * It is how `build-instance-site.ts --fresh` re-lays mounts its own build
   * wrote into, from the mount script itself, so the tools mount that runs
   * it is replaced last-loaded rather than deleted before it can run.
   */
  discardEdits?: boolean;
  /** How `owner/repo` becomes a fetch URL — tests serve local bare repositories. */
  urlFor?: UrlFor;
  /**
   * How a subgraph index package's release-asset URL is fetched (bean `mo75`
   * G2b). Default: as it stands, through `CAT_MOUNT_URL_PREFIX` when set.
   */
  packageUrlFor?: PackageUrlFor;
  /**
   * `staging` mounts for a preview and needs neither signature nor consent
   * (owner, 2026-10-07: "staging doesnt need signature"). Anything else is a
   * real mount and must pass {@link mountTrust}. Default `mount`.
   */
  purpose?: "staging" | "mount";
  /**
   * After the bytes are down and locked, `bun install` in each mounted
   * layer that carries a `package.json`, so its tools run (task #10, gap b).
   * `production` (default) skips devDependencies; `false` lays bytes only.
   * The install writes only `node_modules/`, which no digest covers, so it
   * never makes a mount read modified.
   */
  install?: InstallMode | false;
}

const strip = (p: string): string => p.replace(/\/+$/, "");
const joinRel = (...ps: string[]): string => ps.map(strip).filter(Boolean).join("/");

/** `.gitmodules` → `path → url`. */
function gitmodules(text: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!text) return out;
  let path: string | undefined;
  let url: string | undefined;
  const flush = (): void => {
    if (path && url) out.set(strip(path), url);
    path = url = undefined;
  };
  for (const line of text.split("\n")) {
    if (/^\s*\[submodule /.test(line)) flush();
    const m = /^\s*(path|url)\s*=\s*(.+?)\s*$/.exec(line);
    if (m) {
      if (m[1] === "path") path = m[2];
      else url = m[2];
    }
  }
  flush();
  return out;
}

/** A github URL → `owner/repo`; anything else is kept as the URL it is. */
function repositoryOf(url: string): string {
  const m = /^(?:https?:\/\/|git@)github\.com[/:]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url);
  return m ? m[1]! : url;
}

/**
 * Find layer `name` in a tree: the root's own `<name>.json`, else a
 * top-level directory's — each accepted only when the file's `name` agrees,
 * the rule `findDeclarationFile` applies on disk.
 */
function findInstance(tree: RemoteTree, name: string): { root: string; file: string; text: string; decl: UpstreamDeclaration } | { error: string } | undefined {
  const candidates = [`${name}.json`, ...tree.list("").filter((e) => e.kind === "tree").map((e) => `${e.path}/${name}.json`)];
  for (const file of candidates) {
    const text = tree.readText(file);
    if (text === undefined) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      continue;
    }
    if ((raw as { name?: unknown })?.name !== name) continue;
    const p = UpstreamDeclarationSchema.safeParse(raw);
    if (!p.success) return { error: `${file} at ${tree.sha.slice(0, 12)} declares \`${name}\` but its mount fields do not parse: ${p.error.issues[0]?.message}` };
    return { root: dirname(file) === "." ? "" : dirname(file), file, text, decl: p.data };
  }
  return undefined;
}

/** The downstream's own declaration and its `remoteMounts`, or why not. */
function downstreamOf(opts: RemoteMountOptions): { instanceRoot: string; name: string; mounts: RemoteMount[]; approvers?: string[] } {
  const instanceRoot = resolve(opts.instanceRoot ?? checkoutRootFor(process.cwd()));
  // Only the mount fields: a full read needs kinds the mounts themselves supply (bean qump).
  const decl = readMountFields(instanceRoot);
  const idx = readIndexConfig(instanceRoot);
  if (!decl && idx.state !== "ok") throw new Error(`${instanceRoot} holds no instance declaration or index.config.json`);
  // `index.config.json` when the checkout has one, else the declaration's
  // `remoteMounts` — and BOTH is an error, never a pick (schemas/kg/index-config.ts).
  const name = decl?.name ?? (idx.state === "ok" ? idx.config.site?.landing ?? "coordinator" : "downstream");
  // Who may consent: the index's list, or the declaration's — never both
  // (folio-assistant#2389: a checkout whose index lists the mounts may
  // declare no instance of its own).
  // Read structurally: the field is new in cat-harness#625, and a pinned
  // cat-harness without it rejects an index that carries it anyway.
  const fromIndex = idx.state === "ok" ? (idx.config as { mountApprovers?: string[] }).mountApprovers : undefined;
  if (fromIndex && decl?.mountApprovers) throw new Error(`${instanceRoot} declares mountApprovers in both index.config.json and its instance declaration — keep one`);
  return { instanceRoot, name, mounts: readDeclaredMounts(instanceRoot).mounts, approvers: fromIndex ?? decl?.mountApprovers };
}

/**
 * H8 for one layer of a closure. The declared mount's own trust covers the
 * harness and anything in the same tree; a layer reached through a GITLINK
 * is another repository at another commit, so it ALSO needs consent of its
 * own, on the mount's override for that layer (roast `1ygp` L4.2). Staging
 * needs neither, and is recorded as such.
 */
export function trustFor(
  via: RemoteMount | undefined,
  inst: { instance: string; sha: string; pinnedBy: LockedInstance["pinnedBy"] },
  purpose: "staging" | "mount",
  approvers?: readonly string[],
): TrustVerdict {
  if (!via) return { ok: false, state: "could-not-determine", detail: `no declared mount brought \`${inst.instance}\` in` };
  const parent = mountTrust(via, purpose, approvers);
  if (!parent.ok || purpose === "staging" || inst.pinnedBy !== "gitlink") return parent;
  const own = mountTrust({ harness: inst.instance, ref: inst.sha, trust: via.overrides?.[inst.instance]?.trust }, purpose, approvers);
  return own.ok
    ? own
    : {
      ...own,
      detail: `reached through a gitlink in \`${via.harness}\`'s tree, at another repository and commit, which \`${via.harness}\`'s consent does not cover; give consent on \`overrides.${inst.instance}.trust\`: ${own.detail}`,
    };
}

/** The outcome a successful trust verdict gives a mounted layer. */
function mountedState(v: TrustVerdict): "mounted" | "unverified-approver" {
  return v.ok && v.basis === "consent" && v.approver === "unverified" ? "unverified-approver" : "mounted";
}

/**
 * The id → directory map a planner resolves named ids through (bean `mo75`
 * G3): `<name>.json`'s own entries, and — only when a named id is not among
 * them — the entries the layer declares FROM WITHIN, read at the pin by
 * {@link upstreamDirectories} through cat-harness's `instanceDirectories`.
 * An id that is in neither, or a nesting that could not be read, comes back
 * as the refusal's wording, never as a silently shorter list.
 */
function directoriesById(
  tree: RemoteTree,
  found: { root: string; file: string; decl: UpstreamDeclaration },
  named: readonly string[],
  kinds?: GraphTypologyRegistry,
): { byId: Map<string, UpstreamDirectory>; ids: string[] } | { unknown: string[]; why: string } {
  const byId = new Map<string, UpstreamDirectory>(found.decl.directories.map((d) => [d.id, d]));
  if (named.every((id) => byId.has(id))) return { byId, ids: [...named] };
  const nested = upstreamDirectories(tree, found.root, found.file, kinds);
  if (nested.ok) for (const d of nested.directories) if (!byId.has(d.id)) byId.set(d.id, d);
  // A CONCERN NAME (bean `mo75`): an id that is no directory but a concern
  // group's code expands to its kind-first members, `processes/sdlc/`,
  // `skills/sdlc/` …, read from each kind's own declaration file at the pin.
  const expanded = new Map<string, string[]>();
  let concernWhy: string | undefined;
  for (const id of named) {
    if (byId.has(id) || !ConcernGroupCodeSchema.safeParse(id).success) continue;
    const members = upstreamConcernMembers(tree, found.root, found.file, found.decl.directories, id);
    if (!members.ok) {
      concernWhy = members.detail;
      continue;
    }
    if (members.directories.length === 0) continue;
    for (const m of members.directories) if (!byId.has(m.id)) byId.set(m.id, m);
    expanded.set(id, members.directories.map((m) => m.id));
  }
  const unknown = named.filter((id) => !byId.has(id) && !expanded.has(id));
  if (unknown.length === 0) return { byId, ids: [...new Set(named.flatMap((id) => expanded.get(id) ?? [id]))] };
  const why = nested.ok ? "neither in its declaration nor from within a directory it declares, and no concern group of its kinds" : `not in its declaration, and what it declares from within was not read: ${nested.detail}`;
  return { unknown, why: concernWhy ? `${why}; a concern group's declaration was not read: ${concernWhy}` : why };
}

/**
 * Plan one layer as HYDRATED metadata (bean `mo75` G2): each chosen
 * directory becomes its published `index.hydrated.jsonld` at the pin. See the
 * module header, §"Hydrated". Its `needs` are not followed: metadata imports
 * nothing, so there is no closure to bring.
 */
function planHydrated(a: {
  q: { name: string; repository: string; sha: string; pinnedBy: LockedInstance["pinnedBy"] };
  via: string;
  tree: RemoteTree;
  found: { root: string; file: string; decl: UpstreamDeclaration };
  path: string;
  named: string[] | undefined;
  whole: boolean | undefined;
  /** The pin's subgraph index package for this harness, fetched at most once (bean `mo75` G2b). */
  pkgFor: (harness: string) => SubgraphIndexFetch;
  /** Tools the override chose; refused here, since metadata brings no code. */
  tools?: readonly string[];
  /** The downstream's switched-on opt-in sub-graphs: a switched-off one is not offered, even as metadata. */
  enabled: EnabledSubgraphs;
  /** Every planned layer's own kinds ({@link withKindsOf}); the shared registry when absent. */
  kinds?: GraphTypologyRegistry;
}): { instance: PlannedInstance } | { outcome: InstanceOutcome } {
  const { q, tree, found, path, named } = a;
  const { decl } = found;
  const at = `${q.repository}@${q.sha.slice(0, 12)}`;
  if (a.tools?.length) {
    return { outcome: { instance: q.name, state: "could-not-determine", path, detail: "`tools` and `hydrated` both asked for: a chosen Tool is mounted runnable, with its code, and a hydrated mount brings none — read the metadata hydrated, then name the Tools on a files mount" } };
  }
  if (a.whole === true) {
    return { outcome: { instance: q.name, state: "could-not-determine", path, detail: "`whole` and `hydrated` both asked for: one mounts every file and the other none — keep one" } };
  }
  const docs = decl.directories.find((d) => d.id === "docs");
  if (!docs) {
    return { outcome: { instance: q.name, state: "missing", path, detail: `\`${q.name}\` at ${at} declares no \`docs\` directory, so it publishes no subgraph files to mount hydrated` } };
  }
  const ids =
    named ??
    defaultMountDirectoryIds(q.name, { directories: decl.directories }, a.enabled);
  const lookup = directoriesById(tree, found, ids, a.kinds);
  if ("unknown" in lookup) {
    return { outcome: { instance: q.name, state: "could-not-determine", detail: `\`${lookup.unknown.join("`, `")}\` named for mounting but not declared by \`${q.name}\` at ${q.sha.slice(0, 12)} — ${lookup.why}` } };
  }
  const { byId } = lookup;
  const directories: PlannedDirectory[] = [];
  const notPublished: string[] = [];
  /** The pin's package, once a directory's file was not in the tree (G2b). */
  let looked: SubgraphIndexFetch | undefined;
  for (const id of lookup.ids) {
    const d = byId.get(id)!;
    let pub: string;
    try {
      pub = joinRel(found.root, publishedSubgraphDir(docs.path, decl.name, d.path));
    } catch (e) {
      if (named) return { outcome: { instance: q.name, state: "could-not-determine", path, detail: `\`${id}\`: ${(e as Error).message}` } };
      notPublished.push(id);
      continue;
    }
    let held = false;
    try {
      held = tree.entry(`${pub}/${SUBGRAPH_HYDRATED_FILE}`)?.kind === "blob";
    } catch {
      held = false;
    }
    // Not in the tree: the pin's subgraph index PACKAGE (bean `mo75` G2b) —
    // where a harness that builds its subgraph files at publish puts them.
    let fromPackage: PlannedDirectory["package"];
    if (!held) {
      const pkg = (looked = a.pkgFor(decl.name));
      const entry = pkg.state === "ok" ? pkg.hydrated.get(strip(d.path)) : undefined;
      if (pkg.state === "ok" && entry) {
        fromPackage = { url: pkg.pkg.tarballUrl, sha256: pkg.sha256, member: entry.path, file: join(pkg.root, ...entry.path.split("/")) };
      } else if (!named) {
        notPublished.push(id);
        continue;
      }
    }
    const src = HydratedSourceSchema.safeParse({ kind: "hydrated", repository: q.repository, ref: q.sha, harness: decl.name, subgraph: strip(d.path), tool: "remote-mount" });
    if (!src.success) {
      return { outcome: { instance: q.name, state: "could-not-determine", path, detail: `\`${id}\` is not a hydrated source: ${src.error.issues[0]?.message ?? "invalid"}` } };
    }
    directories.push({ id, path: joinRel(path, d.path), upstreamPath: pub, hydrated: src.data, ...(fromPackage ? { package: fromPackage } : {}) });
  }
  // Said whenever the package was looked for and did not answer, so a
  // missing file is never reported without where else it was sought.
  const pkgNote = looked && looked.state !== "ok" ? `; the pin's subgraph index package: ${looked.state} — ${looked.detail}` : "";
  if (directories.length === 0 && looked && looked.state !== "ok" && looked.state !== "absent") {
    // A package that failed to fetch, or failed its checks, is never an empty layer.
    return { outcome: { instance: q.name, state: looked.state === "refused" ? "missing" : "could-not-determine", path, detail: `\`${q.name}\` at ${at}: no ${SUBGRAPH_HYDRATED_FILE} in its git tree${pkgNote}` } };
  }
  if (directories.length === 0) {
    const built = (decl.builtAtPublish ?? []).some((b) => strip(b.path.replace(/^\.\//, "")) === strip(joinRel(strip(docs.path), "subgraph")));
    return {
      outcome: {
        instance: q.name,
        state: "missing",
        path,
        detail:
          `\`${q.name}\` at ${at} holds no ${SUBGRAPH_HYDRATED_FILE} under \`${joinRel(found.root, strip(docs.path), "subgraph", decl.name)}/\` for any directory it declares` +
          (built ? ` — its declaration builds \`${strip(docs.path)}/subgraph/\` at publish (\`builtAtPublish\`), so no commit of it carries one` : "") +
          pkgNote,
      },
    };
  }
  return {
    instance: {
      instance: q.name,
      repository: q.repository,
      sha: q.sha,
      upstreamRoot: found.root,
      path,
      via: a.via,
      pinnedBy: q.pinnedBy,
      declarationFile: found.file,
      directories,
      assets: [],
      hydrated: true,
      ...(notPublished.length ? { notPublished } : {}),
      ...(pkgNote ? { packageNote: pkgNote.replace(/^; /, "") } : {}),
    },
  };
}

/**
 * Resolve every declared mount's closure. Fetches trees (blobless) and reads
 * declarations; writes nothing. The trees stay open in `trees` for
 * {@link mountRemote} to check out from; {@link planRemote} closes them.
 */
function resolveClosure(opts: RemoteMountOptions, trees: Map<string, RemoteTree>, packages: Map<string, SubgraphIndexFetch> = new Map()): Plan {
  // The downstream decides which opt-in sub-graphs come down by default, and
  // each one it switches on brings what it `requires` (implied; owner,
  // 2026-11-13). A requirement is read from a layer's declaration at its pin,
  // so it can name a sub-graph of a layer already planned: plan again with
  // the grown set until nothing more is switched on. The trees stay cached.
  let enabled = enabledSubgraphs(downstreamOf(opts).instanceRoot);
  for (;;) {
    const before = enabled.size;
    const { plan, dsEnabled } = resolveClosureWith(opts, trees, packages, new Set(enabled));
    if (dsEnabled.size === before) return plan;
    enabled = dsEnabled;
  }
}

function resolveClosureWith(
  opts: RemoteMountOptions,
  trees: Map<string, RemoteTree>,
  packages: Map<string, SubgraphIndexFetch>,
  dsEnabled: Set<string>,
): { plan: Plan; dsEnabled: Set<string> } {
  const ds = downstreamOf(opts);
  const plan: Plan = { instanceRoot: ds.instanceRoot, downstream: ds.name, mounts: ds.mounts, approvers: ds.approvers, instances: [], outcomes: [] };
  if (ds.mounts.length === 0) return { plan, dsEnabled };

  // Layers the downstream checkout ALREADY holds and did not get from a
  // previous mount: those are local, and a mount never lands on them.
  const prior = readMountLock(mountLockPathFor(ds.instanceRoot, ds.name));
  // A refused layer's old mount, left on disk, is still this mount's — not local.
  const previouslyMounted = new Set(
    prior.ok ? [...prior.lock.instances.map((i) => i.instance), ...prior.lock.unmounted.flatMap((u) => (u.leftOnDisk ? [u.instance] : []))] : [],
  );
  const local = new Map<string, string>();
  // A layer directory in a git checkout with NO tracked file is not the
  // checkout's own: it is what something else left behind (a removed
  // submodule, a lock deleted by hand). It is a mount target, adopted only if
  // it is exactly the pinned bytes (folio-assistant#2467, decision 2).
  const inCheckout = gitIn(ds.instanceRoot, ["rev-parse", "--is-inside-work-tree"]).stdout.trim() === "true";
  for (const root of layerRootsIn(ds.instanceRoot)) {
    const rel = relative(ds.instanceRoot, root);
    if (inCheckout && rel !== "" && !tracked(ds.instanceRoot, rel)) continue;
    try {
      const n = readDeclaration(root)?.name;
      if (n && !previouslyMounted.has(n)) local.set(n, root);
    } catch {
      // unreadable: check:declaration-filename's finding, not this one's
    }
  }

  const open = (repository: string, sha: string): RemoteTree => {
    const key = `${repository}@${sha}`;
    let t = trees.get(key);
    if (!t) {
      t = RemoteTree.open(repository, sha, { urlFor: opts.urlFor, prefix: "remote-mount-" });
      trees.set(key, t);
    }
    return t;
  };

  /** One fetch per (repository, pin, harness); `packages` keeps them for {@link mountRemote}. */
  const pkgAt = (repository: string, sha: string) => (harness: string): SubgraphIndexFetch => {
    const key = `${repository}@${sha}#${harness}`;
    let f = packages.get(key);
    if (!f) {
      try {
        f = fetchSubgraphIndex({ repository, ref: sha, harness, urlFor: opts.packageUrlFor });
      } catch (e) {
        f = { state: "could-not-determine", pkg: { name: "", version: "", tag: "", tarball: "", record: "", tarballUrl: "", recordUrl: "" }, detail: (e as Error).message };
      }
      packages.set(key, f);
    }
    return f;
  };

  // The kinds EVERY listed layer declares in its own `typologies/`, at its
  // pin, before any layer's nesting is read ({@link withKindsOf}): a layer may
  // use a kind a layer listed after it contributes (a layer's declaration
  // names a kind only a layer it depends on registers). A layer that cannot be
  // opened or found here is skipped; the loop below reports it.
  let kinds: GraphTypologyRegistry = defaultGraphTypologies;
  for (const m of ds.mounts) {
    if (m.overrides?.[m.harness]?.skip) continue;
    try {
      const tree = open(m.repository, m.ref);
      const found = findInstance(tree, m.harness);
      if (found !== undefined && !("error" in found)) kinds = withKindsOf(tree, found.root, found.file, kinds);
    } catch {
      // reported by the loop below
    }
  }

  /** Every layer laid down as files, with the tree and declaration it was planned from — for the Tool closure. */
  const reached = new Map<string, { tree: RemoteTree; found: { root: string; file: string; text: string; decl: UpstreamDeclaration }; whole: boolean; via: RemoteMount }>();
  const seen = new Map<string, { repository: string; sha: string }>();
  for (const m of ds.mounts) {
    const queue: Array<{ name: string; repository: string; sha: string; pinnedBy: LockedInstance["pinnedBy"] }> = [
      { name: m.harness, repository: m.repository, sha: m.ref, pinnedBy: "declared" },
    ];
    while (queue.length) {
      const q = queue.shift()!;
      const was = seen.get(q.name);
      if (was) {
        if (was.repository === "(skipped)") {
          seen.set(q.name, { repository: q.repository, sha: q.sha });
        } else {
          if (was.repository !== q.repository || was.sha !== q.sha) {
            plan.outcomes.push({
              instance: q.name,
              state: "could-not-determine",
              detail: `reached at two pins — ${was.repository}@${was.sha.slice(0, 12)} and ${q.repository}@${q.sha.slice(0, 12)}; one instance cannot be mounted twice, so pin one with an override`,
            });
          }
          continue;
        }
      }
      seen.set(q.name, { repository: q.repository, sha: q.sha });
      if (local.has(q.name) && q.name !== m.harness) {
        plan.outcomes.push({ instance: q.name, state: "local", path: local.get(q.name)!, detail: "held by this checkout; not mounted over" });
        continue;
      }
      const override = m.overrides?.[q.name];
      if (override?.skip) {
        plan.outcomes.push({ instance: q.name, state: "skipped", detail: "the downstream's override says `skip`" });
        continue;
      }
      let tree: RemoteTree;
      try {
        tree = open(q.repository, q.sha);
      } catch (e) {
        plan.outcomes.push({ instance: q.name, state: "could-not-determine", detail: `could not fetch ${q.repository}@${q.sha}: ${(e as Error).message}` });
        continue;
      }
      let found: ReturnType<typeof findInstance>;
      try {
        found = findInstance(tree, q.name);
      } catch (e) {
        plan.outcomes.push({ instance: q.name, state: "could-not-determine", detail: `could not read ${q.repository}@${q.sha.slice(0, 12)}: ${(e as Error).message}` });
        continue;
      }
      if (found === undefined) {
        plan.outcomes.push({ instance: q.name, state: "missing", detail: `no declaration of \`${q.name}\` in ${q.repository}@${q.sha.slice(0, 12)}` });
        continue;
      }
      if ("error" in found) {
        plan.outcomes.push({ instance: q.name, state: "could-not-determine", detail: found.error });
        continue;
      }
      const { decl } = found;
      // From within too: an opt-in group inside an opt-in level (`L2/collab/`).
      closeOverRequires(dsEnabled, requiresDeclared(q.name, decl.directories, (rel) => tree.readText(found.root ? `${found.root}/${rel}` : rel)));
      const path = strip(override?.path ?? decl.mountDefaults?.path ?? decl.livesAt?.path ?? (found.root || q.name));
      if (!MountPathSchema.safeParse(path).success || path === "") {
        plan.outcomes.push({ instance: q.name, state: "could-not-determine", detail: `mount path \`${path}\` is not a repository-relative directory` });
        continue;
      }
      const dsDecl = readMountFields(ds.instanceRoot);
      const declaredDirs = [
        ...(dsDecl?.directories ?? []).map((d) => d.path),
        ...[...local.entries()].map(([n, r]) => relative(ds.instanceRoot, r) || n).filter((p) => p && p !== "."),
      ];
      const otherMounts = plan.instances.map((i) => ({ harness: i.instance, path: i.path }));
      const collisions = checkMountPathCollisions([{ harness: q.name, path }, ...otherMounts], { declaredDirs });
      const myCollision = collisions.find((c) => c.harness === q.name);
      if (myCollision) {
        plan.outcomes.push({
          instance: q.name,
          state: "could-not-determine",
          path,
          detail: myCollision.message,
        });
        continue;
      }

      const whole = override?.whole ?? decl.mountDefaults?.whole === true;
      // The entry's own `hydrated` is its harness's; an override decides for any layer.
      const hydrated = override?.hydrated ?? (q.name === m.harness && m.hydrated === true);
      if (hydrated) {
        const h = planHydrated({ q, via: m.harness, tree, found, path, named: override?.directories, whole: override?.whole, pkgFor: pkgAt(q.repository, q.sha), tools: override?.tools, enabled: dsEnabled, kinds });
        if ("outcome" in h) plan.outcomes.push(h.outcome);
        else plan.instances.push(h.instance);
        continue;
      }
      if (!hydrated) reached.set(q.name, { tree, found, whole, via: m });
      if (whole) {
        plan.instances.push({
          instance: q.name,
          repository: q.repository,
          sha: q.sha,
          upstreamRoot: found.root,
          path,
          via: m.harness,
          pinnedBy: q.pinnedBy,
          declarationFile: found.file,
          directories: [{ id: WHOLE_INSTANCE_ID, path, upstreamPath: found.root || ".", ...wholeExcept(q.name, tree, found, dsEnabled, kinds) }],
          assets: [],
        });
      }
      // With Tools chosen anywhere in this entry, the Tool closure picks the
      // directories (applyToolChoices, below) and the default list does not.
      const choosesTools = Object.values(m.overrides ?? {}).some((o) => o.tools?.length);
      const ids = whole
        ? []
        : (override?.directories && withEnabledOptIns(q.name, decl, override.directories, dsEnabled)) ??
        (choosesTools ? [] : undefined) ??
        defaultMountDirectoryIds(q.name, decl, dsEnabled);
      const lookup = directoriesById(tree, found, ids, kinds);
      if ("unknown" in lookup) {
        plan.outcomes.push({
          instance: q.name,
          state: "could-not-determine",
          detail: `\`${lookup.unknown.join("`, `")}\` named for mounting but not declared by \`${q.name}\` at ${q.sha.slice(0, 12)} — ${lookup.why}`,
        });
        continue;
      }
      const { byId } = lookup;
      const directories: PlannedDirectory[] = [];
      if (!whole) for (const id of lookup.ids) {
        const d = byId.get(id)!;
        if (strip(d.path).split("/").includes("..")) continue; // a path that climbs out is not this layer's to give
        directories.push({ id, path: joinRel(path, d.path), upstreamPath: joinRel(found.root, d.path) });
      }
      if (!whole)
        plan.instances.push({
          instance: q.name,
          repository: q.repository,
          sha: q.sha,
          upstreamRoot: found.root,
          path,
          via: m.harness,
          pinnedBy: q.pinnedBy,
          declarationFile: found.file,
          directories,
          assets: [
            ...new Set(
              (decl.assets ?? [])
                .filter((a) => a.scope !== "repository")
                .map((a) => strip(a.src.replace(/^\.\//, "")))
                .filter((s) => s && !s.startsWith("/") && !s.split("/").includes("..")),
            ),
          ].sort(),
        });

      // TRANSITIVELY: each need in the same tree, else as a gitlink there.
      const modules = gitmodules(tree.readText(".gitmodules"));
      for (const need of decl.needs ?? []) {
        if (seen.has(need)) continue;
        // A need the downstream mounts by an entry of ITS OWN is that entry's
        // to lay down, at that entry's pin. Walking it here as well reached it
        // at a second pin ("reached at two pins") whenever this entry came
        // first, which is why every index entry carried a `skip: true` for
        // each sibling it needs, and the lock then listed those siblings as
        // `unmounted: skipped` beside their own `mounted` record (measured
        // 2026-10-09: 4 of 11 in folio-assistant's lock). Not an outcome:
        // nothing was skipped, it is simply mounted once, by its own entry.
        if (ds.mounts.some((other) => other !== m && other.harness === need)) continue;
        const skip = m.overrides?.[need]?.skip ?? ds.mounts.some((other) => other.overrides?.[need]?.skip);
        if (skip) {
          seen.set(need, { repository: "(skipped)", sha: "" });
          plan.outcomes.push({ instance: need, state: "skipped", detail: "the downstream's override says `skip`" });
          continue;
        }
        let inTree: ReturnType<typeof findInstance>;
        try {
          inTree = findInstance(tree, need);
        } catch {
          inTree = undefined;
        }
        if (inTree !== undefined) {
          queue.push({ name: need, repository: q.repository, sha: q.sha, pinnedBy: "same-tree" });
          continue;
        }
        const link = tree.list("").find((e) => e.kind === "commit" && e.path === need);
        const url = link ? modules.get(link.path) : undefined;
        if (link && url) {
          queue.push({ name: need, repository: repositoryOf(url), sha: link.oid, pinnedBy: "gitlink" });
          continue;
        }
        if (local.has(need)) {
          seen.set(need, { repository: "(local)", sha: "" });
          plan.outcomes.push({ instance: need, state: "local", path: local.get(need)!, detail: "held by this checkout; not mounted over" });
          continue;
        }
        seen.set(need, { repository: q.repository, sha: q.sha });
        plan.outcomes.push({
          instance: need,
          state: "missing",
          detail: `\`${q.name}\` needs \`${need}\`, which ${q.repository}@${q.sha.slice(0, 12)} neither holds nor pins as a gitlink`,
        });
      }
    }
  }
  applyToolChoices(plan, reached, local, pkgAt, kinds);
  return { plan, dsEnabled };
}

/** The ids of a declaration's directories whose graph typologies include `tools`. */
function toolDirectoriesOf(decl: UpstreamDeclaration): UpstreamDeclaration["directories"] {
  return decl.directories.filter((d) => {
    const kinds = (d as Record<string, unknown>).graphTypologies;
    return Array.isArray(kinds) && kinds.includes("tools");
  });
}

/**
 * Each chosen Tool's published node at the pin, by id: the declaring
 * layer's `tools` metadata (`index.hydrated.jsonld`), from the tree when a
 * commit carries it, else from the pin's subgraph index package — the reading
 * {@link planHydrated} does, held to the same schema and IRI.
 */
function toolNodesAt(
  tree: RemoteTree,
  found: { root: string; decl: UpstreamDeclaration },
  toolDir: string,
  pkgFor: (harness: string) => SubgraphIndexFetch,
): { ok: true; nodes: Map<string, Record<string, unknown>> } | { ok: false; state: "missing" | "could-not-determine"; detail: string } {
  const { decl } = found;
  const docs = decl.directories.find((d) => d.id === "docs");
  if (!docs) return { ok: false, state: "missing", detail: `\`${decl.name}\` declares no \`docs\` directory, so it publishes no Tools metadata to read each Tool's \`invoke\` from` };
  const sub = strip(toolDir);
  const pub = joinRel(found.root, publishedSubgraphDir(docs.path, decl.name, sub));
  let text = tree.readText(`${pub}/${SUBGRAPH_HYDRATED_FILE}`);
  let where = `${pub}/${SUBGRAPH_HYDRATED_FILE} at ${tree.sha.slice(0, 12)}`;
  if (text === undefined) {
    const pkg = pkgFor(decl.name);
    const entry = pkg.state === "ok" ? pkg.hydrated.get(sub) : undefined;
    if (pkg.state !== "ok" || !entry) {
      return {
        ok: false,
        state: pkg.state === "could-not-determine" ? "could-not-determine" : "missing",
        detail: `no Tools metadata for \`${sub}/\` at ${tree.sha.slice(0, 12)}: not in the git tree, and the pin's subgraph index package ${pkg.state === "ok" ? "holds none for it" : `is ${pkg.state} — ${pkg.detail}`}`,
      };
    }
    text = readFileSync(join(pkg.root, ...entry.path.split("/")), "utf-8");
    where = `${entry.path} in ${pkg.pkg.tarballUrl}`;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, state: "missing", detail: `${where} is not JSON: ${(e as Error).message}` };
  }
  const parsed = SubgraphHydratedSchema.safeParse(json);
  if (!parsed.success) return { ok: false, state: "missing", detail: `${where} is not a valid hydrated subgraph file: ${parsed.error.issues[0]?.message}` };
  if (!parsed.data["@id"].endsWith(`/subgraph/${decl.name}/${sub}/`)) return { ok: false, state: "missing", detail: `${where} declares itself \`${parsed.data["@id"]}\`, not \`…/subgraph/${decl.name}/${sub}/\`` };
  const nodes = new Map<string, Record<string, unknown>>();
  const visit = (n: { hasMember?: unknown[]; hasSubgraph?: unknown[] }): void => {
    for (const m of (n.hasMember ?? []) as Array<Record<string, unknown>>) {
      // `Tool`, or a compacted / expanded form of it (`cat-harness:Tool`, as kg-export writes it).
      const types = ([] as unknown[]).concat(m["@type"] ?? []);
      if (typeof m.name === "string" && types.some((t) => typeof t === "string" && /(?:^|[:/#])Tool$/.test(t))) nodes.set(m.name, m);
    }
    for (const c of (n.hasSubgraph ?? []) as Array<{ hasMember?: unknown[]; hasSubgraph?: unknown[] }>) if (c && typeof c === "object") visit(c);
  };
  visit(parsed.data as { hasMember?: unknown[]; hasSubgraph?: unknown[] });
  return { ok: true, nodes };
}

/**
 * Bring each override's chosen `tools` runnable (module note, §"Tools"):
 * read each Tool's `invoke` from its published metadata, walk the closure of
 * definition and implementation with bootstrap-tools' `importClosure`
 * (`tool-closure.ts`), and narrow each layer of the entry to the declared
 * directories that closure touches plus the ones its override names.
 */
function applyToolChoices(
  plan: Plan,
  reached: Map<string, { tree: RemoteTree; found: { root: string; file: string; text: string; decl: UpstreamDeclaration }; whole: boolean; via: RemoteMount }>,
  local: Map<string, string>,
  pkgAt: (repository: string, sha: string) => (harness: string) => SubgraphIndexFetch,
  kinds?: GraphTypologyRegistry,
): void {
  const choosing = plan.mounts.filter(entryChoosesTools);
  if (choosing.length === 0) return;
  /** Instances of other entries that shrink to Tool closures, and the directory ids those closures need. */
  const shrunk = new Map<string, Set<string>>();

  // Every layer the closure may reach: those laid down as files, and the ones this checkout holds.
  const instances: ClosureInstance[] = [];
  for (const [name, r] of reached) {
    const p = plan.instances.find((i) => i.instance === name);
    if (!p) continue;
    const nested = upstreamDirectories(r.tree, r.found.root, r.found.file, kinds);
    // A nesting this checkout cannot read leaves the top-level list, which
    // over-mounts (a parent for its nested child) and never under-mounts.
    const dirs = (nested.ok ? nested.directories : r.found.decl.directories).filter(
      (d) => !contentIsOffCheckout({ source: d.source as SubgraphSource | undefined, storage: d.storage }) && !strip(d.path).split("/").includes(".."),
    );
    let manifest: ClosureInstance["manifest"];
    try {
      const t = r.tree.readText(joinRel(r.found.root, "package.json"));
      manifest = t === undefined ? undefined : (JSON.parse(t) as ClosureInstance["manifest"]);
    } catch {
      manifest = undefined;
    }
    instances.push({
      instance: name,
      path: p.path,
      whole: r.whole,
      needs: r.found.decl.needs ?? [],
      directories: dirs,
      files: [r.found.root ? r.found.file.slice(r.found.root.length + 1) : r.found.file, ...p.assets, "package.json"],
      ...(manifest ? { manifest } : {}),
      source: { tree: r.tree, root: r.found.root },
    });
  }
  for (const [name, root] of local) {
    let decl: ReturnType<typeof readDeclaration>;
    try {
      decl = readDeclaration(root);
    } catch {
      continue;
    }
    let dirs: UpstreamDirectory[] = [];
    try {
      dirs = instanceDirectories(root).map((d) => ({ id: d.id, path: d.path }));
    } catch {
      dirs = (decl?.directories ?? []).map((d) => ({ id: d.id, path: d.path }));
    }
    let manifest: ClosureInstance["manifest"];
    try {
      manifest = existsSync(join(root, "package.json")) ? (JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as ClosureInstance["manifest"]) : undefined;
    } catch {
      manifest = undefined;
    }
    instances.push({ instance: name, path: relative(plan.instanceRoot, root) || ".", whole: true, needs: decl?.needs ?? [], directories: dirs, files: [], ...(manifest ? { manifest } : {}), source: { disk: root } });
  }

  for (const m of choosing) {
    const failures: Array<{ instance: string; state: "missing" | "could-not-determine"; detail: string }> = [];
    const choices: ToolChoice[] = [];
    for (const [name, o] of Object.entries(m.overrides ?? {})) {
      if (!o.tools?.length) continue;
      const r = reached.get(name);
      if (!r || !plan.instances.some((i) => i.instance === name)) {
        // Hydrated, skipped, local or not reached: it said why already, or this says it.
        if (!plan.outcomes.some((x) => x.instance === name)) failures.push({ instance: name, state: "missing", detail: `\`tools\` named for \`${name}\`, which this mount does not lay down as files` });
        else if (local.has(name)) failures.push({ instance: name, state: "missing", detail: `\`tools\` named for \`${name}\`, which this checkout holds itself: its Tools are already here` });
        continue;
      }
      const toolDirs = toolDirectoriesOf(r.found.decl);
      const invokes = new Map<string, Record<string, unknown> | undefined>();
      for (const d of toolDirs) {
        const got = toolNodesAt(r.tree, r.found, d.path, pkgAt(r.tree.repository, r.tree.sha));
        if (!got.ok) {
          failures.push({ instance: name, state: got.state, detail: got.detail });
          continue;
        }
        for (const [id, node] of got.nodes) {
          const inv = node.invoke;
          invokes.set(id, inv && typeof inv === "object" ? (inv as Record<string, unknown>) : undefined);
        }
      }
      if (failures.some((f) => f.instance === name)) continue;
      const unknown = o.tools.filter((id) => !invokes.has(id));
      if (unknown.length) {
        failures.push({ instance: name, state: "missing", detail: `Tool${unknown.length === 1 ? "" : "s"} \`${unknown.join("`, `")}\` named for mounting but in none of \`${name}\`'s published Tools metadata at ${r.tree.sha.slice(0, 12)} (${toolDirs.map((d) => `\`${strip(d.path)}/\``).join(", ") || "it declares no `tools` directory"})` });
        continue;
      }
      choices.push({ instance: name, toolDirs: toolDirs.map((d) => d.path), tools: o.tools.map((id) => ({ id, invoke: invokes.get(id) })) });
    }

    const result = failures.length ? undefined : toolClosure(instances, choices);
    /** What this entry's closure asks of instances of OTHER entries that shrink to it (owner, 2026-10-29, option B). */
    const asks = new Map<string, string[]>();
    if (result) {
      // A layer of ANOTHER entry the closure touches shrinks to what the
      // closure needs from it, unless its own entry says otherwise: an
      // explicit `directories` list or `whole` wins, and then it must already
      // bring what the closure needs.
      for (const [name, ids] of result.directories) {
        const p = plan.instances.find((i) => i.instance === name);
        const r = reached.get(name);
        if (!p || !r || r.via === m) continue;
        if (shrinksToClosure(p, r)) {
          asks.set(name, ids);
          continue;
        }
        const have = p.directories.map((d) => d.path);
        const inst = instances.find((i) => i.instance === name)!;
        for (const id of ids) {
          const want = joinRel(p.path, inst.directories.find((d) => d.id === id)!.path);
          if (!have.some((h) => want === h || want.startsWith(`${h}/`))) result.problems.push(`the closure needs \`${name}\`'s \`${id}\`, which its own mount entry (\`${reached.get(name)!.via.harness}\`) does not bring`);
        }
      }
      for (const pr of result.problems) failures.push({ instance: choices[0]?.instance ?? m.harness, state: "missing", detail: pr });
    }

    if (failures.length) {
      const declarers = [...new Set(failures.map((f) => f.instance))];
      for (const d of declarers) {
        const mine = failures.filter((f) => f.instance === d);
        plan.outcomes.push({ instance: d, state: mine.some((f) => f.state === "could-not-determine") ? "could-not-determine" : "missing", detail: `the chosen Tools cannot be brought runnable, so nothing of \`${m.harness}\`'s entry is mounted: ${mine.map((f) => f.detail).join("; ")}` });
      }
      for (const p of plan.instances.filter((i) => reached.get(i.instance)?.via === m)) {
        if (!declarers.includes(p.instance)) {
          plan.outcomes.push({ instance: p.instance, state: "missing", path: p.path, detail: `not mounted: its directories are what the chosen Tools' closure touches, and that closure did not resolve (${declarers.map((d) => `see \`${d}\``).join(", ")})` });
        }
      }
      plan.instances = plan.instances.filter((i) => reached.get(i.instance)?.via !== m);
      continue;
    }

    for (const p of plan.instances) {
      const r = reached.get(p.instance);
      if (!r || r.via !== m || r.whole || p.hydrated) continue;
      const inst = instances.find((i) => i.instance === p.instance)!;
      const touched = result!.directories.get(p.instance) ?? [];
      const have = new Set(p.directories.map((d) => d.id));
      for (const id of touched) {
        if (have.has(id)) continue;
        const d = inst.directories.find((x) => x.id === id)!;
        p.directories.push({ id, path: joinRel(p.path, d.path), upstreamPath: joinRel(r.found.root, d.path) });
      }
    }
    for (const c of choices) {
      const p = plan.instances.find((i) => i.instance === c.instance);
      if (p) p.tools = result!.tools.filter((t) => t.instance === c.instance);
    }
    for (const [name, ids] of asks) {
      const prev = shrunk.get(name) ?? new Set<string>();
      for (const id of ids) prev.add(id);
      shrunk.set(name, prev);
    }
  }

  // Each shrinking layer mounts the union of what every closure asked of it.
  // An entry that chooses Tools itself already started from its own closure, so
  // what others ask is added to it; any other entry's default list is replaced.
  for (const [name, ids] of shrunk) {
    const p = plan.instances.find((i) => i.instance === name);
    const r = reached.get(name);
    if (!p || !r) continue;
    const inst = instances.find((i) => i.instance === name)!;
    const own = entryChoosesTools(r.via);
    const keep = own ? p.directories : [];
    const have = new Set(keep.map((d) => d.id));
    for (const id of [...ids].sort()) {
      if (have.has(id)) continue;
      const d = inst.directories.find((x) => x.id === id)!;
      keep.push({ id, path: joinRel(p.path, d.path), upstreamPath: joinRel(r.found.root, d.path) });
      have.add(id);
    }
    p.directories = keep;
  }
}

/** Whether a mount entry names `tools` for any of its layers. */
function entryChoosesTools(m: RemoteMount): boolean {
  return Object.values(m.overrides ?? {}).some((o) => o.tools?.length);
}

/**
 * Whether a layer reached through another entry shrinks to a Tool
 * closure's needs (owner, 2026-10-29, option B): yes, unless its entry mounts
 * it whole or as metadata, or names its directories explicitly.
 */
function shrinksToClosure(p: PlannedInstance, r: { whole: boolean; via: RemoteMount }): boolean {
  if (r.whole || p.hydrated) return false;
  return !r.via.overrides?.[p.instance]?.directories?.length;
}

/** Resolve the closure and close every fetched tree. Writes nothing. */
export function planRemote(opts: RemoteMountOptions = {}): Plan {
  const trees = new Map<string, RemoteTree>();
  const packages = new Map<string, SubgraphIndexFetch>();
  try {
    return resolveClosure(opts, trees, packages);
  } finally {
    for (const t of trees.values()) t.close();
    for (const f of packages.values()) if (f.state === "ok") f.close();
  }
}

// ── Mounting ─────────────────────────────────────────────────────────────────

function sha256Text(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

function digestOf(abs: string, skip: readonly string[] = []): { treeDigest: string; files: number } {
  // Install artefacts (`node_modules/`) are never pinned bytes: see
  // `installDependencies` in mount-from-lock.ts for why they are outside fixity.
  // Neither are the paths the layer declares `builtAtPublish`: the publish
  // writes them into the mount, so the lock's digest (mount-from-lock.ts
  // `digestOf`) leaves them out and this one must too, or a mount whose site
  // was built reads as modified.
  const files = withoutSelfIgnored(
    abs,
    withoutBuiltAtPublish(withoutInstallArtefacts(withoutStateMounts(abs, treeEntries(abs).files, skip)), builtAtPublishOf(abs)),
  );
  return { treeDigest: treeDigest(abs, files), files: files.length };
}

/**
 * Whether the bytes already at a planned layer's target ARE the pinned
 * bytes (folio-assistant#2467, decision 2, "adopt if identical"): every
 * declared directory holds exactly the pinned files (none absent, none
 * extra, none different, install artefacts and state mounts aside), the
 * declaration file matches, and every declared asset's sha256 matches.
 * Reads only; never writes or deletes.
 */
export function identicalToPin(
  base: string,
  work: string,
  p: Pick<PlannedInstance, "path" | "instance" | "declarationFile" | "directories" | "assets" | "upstreamRoot" | "hydrated">,
): { same: true } | { same: false; differ: string[]; extra: string[]; absent: string[] } {
  const differ: string[] = [];
  const extra: string[] = [];
  const absent: string[] = [];
  const skip = stateMountedDirs(base);
  for (const d of p.directories) {
    if (d.package) continue;
    const src = join(work, d.upstreamPath);
    const dst = join(base, d.path);
    const pinned = existsSync(src)
      ? withoutInstallArtefacts(treeEntries(src).files.filter((f) => !(d.upstreamPath === "." && (f === ".git" || f.startsWith(".git/")))))
      : [];
    const onDisk = existsSync(dst) ? withoutSelfIgnored(dst, withoutBuiltAtPublish(withoutInstallArtefacts(withoutStateMounts(dst, treeEntries(dst).files, skip)), builtAtPublishOf(dst))) : [];
    const have = new Set(onDisk);
    const want = new Set(pinned);
    for (const f of pinned) {
      if (!have.has(f)) absent.push(`${d.path}/${f}`.replace(/\/\/+/g, "/"));
      else if (sha256Text(readFileSync(join(src, f))) !== sha256Text(readFileSync(join(dst, f)))) differ.push(`${d.path}/${f}`.replace(/\/\/+/g, "/"));
    }
    for (const f of onDisk) if (!want.has(f)) extra.push(`${d.path}/${f}`.replace(/\/\/+/g, "/"));
  }
  const decl = join(base, p.path, `${p.instance}.json`);
  if (!existsSync(decl)) absent.push(`${p.path}/${p.instance}.json`);
  else if (sha256Text(readFileSync(decl)) !== sha256Text(readFileSync(join(work, p.declarationFile)))) differ.push(`${p.path}/${p.instance}.json`);
  for (const a of p.assets ?? []) {
    const src = join(work, p.upstreamRoot, a);
    const dst = join(base, p.path, a);
    if (!existsSync(src)) continue;
    if (!existsSync(dst)) absent.push(`${p.path}/${a}`);
    else if (sha256Text(readFileSync(src)) !== sha256Text(readFileSync(dst))) differ.push(`${p.path}/${a}`);
  }
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  return differ.length || extra.length || absent.length ? { same: false, differ: uniq(differ), extra: uniq(extra), absent: uniq(absent) } : { same: true };
}

function gitIn(cwd: string, args: string[]): { status: number; stdout: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return { status: r.status ?? 128, stdout: r.stdout ?? "" };
}

/** Is any file under `rel` tracked by the checkout? A mount never lands on tracked bytes. */
function tracked(base: string, rel: string): boolean {
  const r = gitIn(base, ["ls-files", "--", rel]);
  return r.status === 0 && r.stdout.trim() !== "";
}

/**
 * Keep the mount out of commits. When the checkout's own rules already
 * ignore the path nothing is written; otherwise the path goes to this
 * worktree's `info/exclude` — local, never committed — and the report says
 * so, so a folio that wants the rule visible can commit it to `.gitignore`.
 *
 * WITH `index.config.json` (`indexed`) nothing goes to `info/exclude`: the
 * committed `.gitignore` block generated from the index is the rule, and a
 * path it does not cover is `not-ignored` — reported, never patched locally,
 * because a local exclude is invisible to every other clone.
 *
 * `mountRemote` now always passes `indexed`: a folio with no index gets the
 * same committed block, written from its lock (owner, 2026-10-09). The
 * `info/exclude` branch stays for a direct caller that asks for it.
 */
function ensureIgnored(base: string, rel: string, indexed = false): "ignored" | "excluded" | "not-ignored" | "not-a-checkout" {
  if (gitIn(base, ["rev-parse", "--git-dir"]).status !== 0) return "not-a-checkout";
  if (gitIn(base, ["check-ignore", "-q", "--no-index", `${rel}/`]).status === 0) return "ignored";
  if (indexed) return "not-ignored";
  // `info/exclude` patterns are relative to the top of the worktree, and the
  // downstream layer may sit below it.
  const prefix = gitIn(base, ["rev-parse", "--show-prefix"]).stdout.trim();
  const file = resolve(base, gitIn(base, ["rev-parse", "--git-path", "info/exclude"]).stdout.trim());
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `# remote mount (bean 0mpw) — bun run cat mount:remote\n/${prefix}${rel}/\n`);
  return "excluded";
}

/** Directories of a previously locked layer whose bytes no longer match the lock. */
function modifiedSince(base: string, locked: LockedInstance): string[] {
  const out = locked.directories
    .filter((d) => existsSync(join(base, d.path)) && digestOf(join(base, d.path), stateMountedDirs(base)).treeDigest !== d.treeDigest)
    .map((d) => d.path);
  for (const a of locked.assets ?? []) {
    const abs = join(base, locked.path, a.src);
    if (existsSync(abs) && sha256Text(readFileSync(abs)) !== a.sha256) out.push(`${locked.path}/${a.src}`);
  }
  return out;
}

/**
 * Why a fetched `index.hydrated.jsonld` is NOT the subgraph it was fetched
 * for, or `undefined` when it is: JSON, `SubgraphHydratedSchema`, and a root
 * `@id` ending `/subgraph/<HARNESS>/<path>/` — the checks
 * `kg:materialize --nodes` makes before it holds one (bean `c1m4`).
 */
export function hydratedProblem(file: string, d: Pick<PlannedDirectory, "hydrated">): string | undefined {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf-8"));
  } catch (e) {
    return `is not JSON: ${(e as Error).message}`;
  }
  const parsed = SubgraphHydratedSchema.safeParse(json);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return `is not a valid hydrated subgraph file: ${i?.path.join(".") || "(root)"}: ${i?.message}`;
  }
  const suffix = d.hydrated ? `/subgraph/${d.hydrated.harness}/${d.hydrated.subgraph}/` : undefined;
  if (suffix && !parsed.data["@id"].endsWith(suffix)) return `declares itself \`${parsed.data["@id"]}\`, not the subgraph \`…${suffix}\` it was fetched for`;
  return undefined;
}

export interface MountReport {
  plan: Plan;
  lockFile: string;
  /** Paths written to `info/exclude` rather than already ignored. */
  excluded: string[];
}

/** Plan, fetch, lay each planned layer down, write the lock. */
export function mountRemote(opts: RemoteMountOptions = {}): MountReport {
  const trees = new Map<string, RemoteTree>();
  const packages = new Map<string, SubgraphIndexFetch>();
  try {
    const plan = resolveClosure(opts, trees, packages);
    const lockFile = join(plan.instanceRoot, mountLockFilename(plan.downstream));
    const excluded: string[] = [];
    if (plan.mounts.length === 0) return { plan, lockFile, excluded };
    // The lock moved to `index.lock.json` (owner, 2026-10-07). A legacy
    // `<name>.mount-lock.json` is RENAMED onto the new name before it is
    // rewritten — moved, never dropped — so the two never coexist.
    const legacyLock = mountLockPathFor(plan.instanceRoot, plan.downstream);
    if (legacyLock !== lockFile && existsSync(legacyLock)) renameSync(legacyLock, lockFile);
    // With an index, the committed `.gitignore` block is regenerated from it
    // before anything lands, and `info/exclude` is never written.
    const idx = readIndexConfig(plan.instanceRoot);
    const index = idx.state === "ok" ? idx.config : undefined;
    // The PLANNED closure, so a layer the mount brings in transitively is
    // ignored before its bytes land; re-synced from the lock once written.
    //
    // WITHOUT an index the same committed block is written from the lock
    // alone (owner, 2026-10-09: "yes, write the .gitignore block"). Until then
    // such a folio got `info/exclude` lines, local to one clone, so every
    // other clone — CI's included — had the mounted bytes one `git add -A`
    // away from a commit.
    const blockConfig: IndexConfig = index ?? { $schema: INDEX_CONFIG_SCHEMA, instances: [] };
    syncIgnoreBlock(plan.instanceRoot, blockConfig, [...lockedMountPaths(plan.instanceRoot), ...plan.instances.map((i) => i.path)]);

    const prior = readMountLock(lockFile);
    // A refused layer's left-on-disk record counts as "this mount put it
    // there", so consent restored later can re-mount over it.
    const priorBy = new Map(
      (prior.ok ? [...prior.lock.unmounted.flatMap((u) => (u.leftOnDisk ? [u.leftOnDisk] : [])), ...prior.lock.instances] : []).map((i) => [i.instance, i]),
    );
    const locked: LockedInstance[] = [];
    const untouched = new Set<string>();
    const leftOnDisk = new Map<string, LockedInstance>();

    for (const p of plan.instances) {
      const target = join(plan.instanceRoot, p.path);
      const before = priorBy.get(p.instance);
      // H8, bean `ieum`: a remote graph is mounted only on signed provenance or a
      // person's consent for this pin; a staging preview needs neither. Checked
      // BEFORE anything is checked out, so a refused mount writes nothing.
      const via = plan.mounts.find((m) => m.harness === p.via);
      const trust = trustFor(via, p, opts.purpose ?? "mount", plan.approvers);
      if (!trust.ok) {
        // Roast `1ygp` L4.2: the previous mount is NOT carried forward as
        // current. It stays on disk (an agent does not delete it) and is
        // recorded as left-on-disk under `unmounted`, so the check reports it.
        let detail = `not mounted: ${trust.detail}`;
        if (before && existsSync(join(plan.instanceRoot, before.path))) {
          leftOnDisk.set(p.instance, before);
          detail += `; the previous mount (${before.repository}@${before.sha.slice(0, 12)}) is still on disk at \`${before.path}/\` and is NOT mounted — delete it, or restore trust and re-mount`;
        }
        plan.outcomes.push({ instance: p.instance, state: trust.state, path: p.path, detail });
        continue;
      }
      let adopting = false;
      try {
        if (before) {
          const changed = modifiedSince(plan.instanceRoot, before);
          if (changed.length && opts.discardEdits) {
            console.error(`fresh: replacing ${p.path}/ (${changed.length} path(s) no longer hashed to the lock)`);
          } else if (changed.length) {
            // folio-assistant#2682: when the pin moved, say so. The lock keeps
            // this entry at its old commit, so the layer was NOT re-pinned.
            const moved = before.sha !== p.sha ? `; the pin moved to ${p.sha.slice(0, 12)} but this instance stays at ${before.sha.slice(0, 12)}, so it is NOT re-pinned (\`--fresh\` replaces it)` : "";
            plan.outcomes.push({
              instance: p.instance,
              state: "missing",
              path: p.path,
              detail: `left untouched: ${changed.join(", ")} no longer hash to the lock — edits there are somebody's work; move them upstream or delete the directory, then re-mount${moved}`,
            });
            locked.push(before);
            untouched.add(p.instance);
            continue;
          }
        } else if (existsSync(target)) {
          // folio-assistant#2467, decision 2: adopt it if it IS the pinned
          // bytes (checked once the pin is checked out, below); else refuse.
          if (p.hydrated) {
            plan.outcomes.push({ instance: p.instance, state: "missing", path: p.path, detail: `\`${p.path}/\` already exists and no lock says this mount put it there — refused` });
            continue;
          }
          adopting = true;
        }
        if (tracked(plan.instanceRoot, p.path)) {
          plan.outcomes.push({ instance: p.instance, state: "missing", path: p.path, detail: `\`${p.path}/\` holds tracked files — a mount never lands on tracked bytes` });
          continue;
        }
        const tree = trees.get(`${p.repository}@${p.sha}`)!;
        const work = tree.checkout([
          p.declarationFile,
          // Hydrated: the one published file, never the subgraph directory around it.
          // From the package (G2b): not in the tree, so not checked out.
          ...p.directories.filter((d) => !d.package).map((d) => (p.hydrated ? `${d.upstreamPath}/${SUBGRAPH_HYDRATED_FILE}` : d.upstreamPath === "." ? "*" : `${d.upstreamPath}/`)),
          ...(p.assets ?? []).map((a) => joinRel(p.upstreamRoot, a)),
        ], p.directories.flatMap((d) => (d.except ?? []).map((e) => `${d.upstreamPath === "." ? e : joinRel(d.upstreamPath, e)}/`)));
        // The digest leaves `node_modules/` out so an install cannot make a
        // mount read modified. That is only sound while no upstream PINS a
        // file there, so a tree that does is refused rather than half-verified.
        const pinsArtefacts = p.directories.find((d) => {
          const src = join(work, d.upstreamPath);
          return existsSync(src) && treeEntries(src).files.some((f) => !f.startsWith(".git/") && isInstallArtefact(f));
        });
        if (pinsArtefacts) {
          plan.outcomes.push({
            instance: p.instance,
            state: "could-not-determine",
            path: p.path,
            detail: `\`${pinsArtefacts.upstreamPath}\` at ${p.sha.slice(0, 12)} tracks files under node_modules/, which the mount digest excludes as install artefacts — refused rather than locked with bytes no check would see`,
          });
          continue;
        }

        if (adopting) {
          const same = identicalToPin(plan.instanceRoot, work, p);
          if (!same.same) {
            const list = (label: string, xs: string[]) => (xs.length ? `${label} ${xs.slice(0, 5).map((x) => `\`${x}\``).join(", ")}${xs.length > 5 ? ` and ${xs.length - 5} more` : ""}` : "");
            plan.outcomes.push({
              instance: p.instance,
              state: "missing",
              path: p.path,
              detail:
                `\`${p.path}/\` already exists, no lock says this mount put it there, and it is not the pinned bytes (${[list("differ:", same.differ), list("extra:", same.extra), list("absent:", same.absent)].filter(Boolean).join("; ")}) — refused, nothing changed. ` +
                "Move the edits upstream to the fork, or delete or rename the directory, then re-mount",
            });
            continue;
          }
          const declText = readFileSync(join(work, p.declarationFile));
          const dirs: LockedInstance["directories"] = p.directories
            .filter((d) => existsSync(join(plan.instanceRoot, d.path)))
            .map((d) => ({
              id: d.id,
              path: d.path,
              upstreamPath: d.upstreamPath,
              ...digestOf(join(plan.instanceRoot, d.path), stateMountedDirs(plan.instanceRoot)),
              ...(d.package ? { package: { url: d.package.url, sha256: d.package.sha256, member: d.package.member } } : {}),
              ...(d.except?.length ? { except: d.except } : {}),
            }));
          const assets = (p.assets ?? []).filter((a) => existsSync(join(target, a))).map((a) => ({ src: a, sha256: sha256Text(readFileSync(join(target, a))) }));
          ensureIgnored(plan.instanceRoot, p.path, true);
          locked.push({
            instance: p.instance,
            repository: p.repository,
            sha: p.sha,
            upstreamRoot: p.upstreamRoot,
            path: p.path,
            via: p.via,
            pinnedBy: p.pinnedBy,
            declaration: { file: `${p.instance}.json`, sha256: sha256Text(declText) },
            directories: dirs,
            ...(assets.length ? { assets } : {}),
            trust: trust.record,
          });
          plan.outcomes.push({
            instance: p.instance,
            state: mountedState(trust),
            path: p.path,
            detail: `adopted: \`${p.path}/\` was already the pinned bytes of ${p.repository}@${p.sha.slice(0, 12)} (${dirs.length} director${dirs.length === 1 ? "y" : "ies"} compared file by file), so it was locked, not re-laid; basis: ${trust.detail}`,
          });
          continue;
        }

        // A STATE mount inside the layer (its `health`, say) is not this
        // mount's to replace: its files come from a state branch, may hold
        // unpushed edits, and a re-lay that deleted them left the marker
        // describing files that were gone — the next `state:push` would have
        // sent their deletion. Set aside here, put back after the digest, so
        // the lock hashes only what this mount laid down.
        const held = holdStateMounts(plan.instanceRoot, target);
        const installs = holdInstallArtefacts(
          plan.instanceRoot,
          [target, ...(before?.directories ?? []).map((d) => join(plan.instanceRoot, d.path))],
        );
        const dirs: LockedInstance["directories"] = [];
        const absent: string[] = [];
        const skipped: string[] = [];
        const assets: NonNullable<LockedInstance["assets"]> = [];
        /** Hydrated files present at the pin that are not the subgraph they were fetched for. */
        const invalid: string[] = [];
        let declText: Buffer;
        try {
          // Replace what THIS mount put there before — only that.
          if (before) {
            for (const d of before.directories) rmSync(join(plan.instanceRoot, d.path), { recursive: true, force: true });
            rmSync(join(plan.instanceRoot, before.path, `${before.instance}.json`), { force: true });
            for (const a of before.assets ?? []) rmSync(join(plan.instanceRoot, before.path, a.src), { force: true });
          }
          mkdirSync(target, { recursive: true });
          declText = readFileSync(join(work, p.declarationFile));
          // Hydrated: recorded in the lock (it fixed the paths), never laid
          // down — a `<name>.json` here would be a layer with no files.
          if (!p.hydrated) writeFileSync(join(target, `${p.instance}.json`), declText);
          const built = builtAtPublishDirectories(declText);
          if (p.hydrated) for (const d of p.directories) {
            // The package's copy was verified when it was fetched (G2b); it
            // still answers to the same schema and IRI check below.
            const src = d.package ? d.package.file : join(work, d.upstreamPath, SUBGRAPH_HYDRATED_FILE);
            if (!existsSync(src)) {
              absent.push(d.id);
              continue;
            }
            const bad = hydratedProblem(src, d);
            if (bad) {
              invalid.push(`\`${d.upstreamPath}/${SUBGRAPH_HYDRATED_FILE}\` ${bad}`);
              continue;
            }
            const dst = join(plan.instanceRoot, d.path);
            mkdirSync(dst, { recursive: true });
            cpSync(src, join(dst, SUBGRAPH_HYDRATED_FILE), { force: true });
          }
          if (!p.hydrated) for (const d of p.directories) {
            const src = join(work, d.upstreamPath);
            if (!existsSync(src)) {
              // A directory the declaration builds at publish is never in the
              // pinned commit: absent is its committed state, not a defect.
              // It is left out of the lock, so verify asks nothing of it.
              if (!built.has(d.id)) absent.push(d.id);
              else skipped.push(d.id);
              continue;
            }
            const dst = join(plan.instanceRoot, d.path);
            mkdirSync(dirname(dst), { recursive: true });
            // A whole-instance mount at the upstream's root copies the fetch's
            // own work tree: its `.git` is the temporary repository, never content.
            cpSync(src, dst, { recursive: true, verbatimSymlinks: true, force: true, filter: (from) => !(d.upstreamPath === "." && from === join(src, ".git")) });
          }
          // The declared assets: single files, each locked by its own hash.
          for (const a of p.assets ?? []) {
            const src = join(work, p.upstreamRoot, a);
            if (!existsSync(src) || !statSync(src).isFile()) {
              absent.push(`asset ${a}`);
              continue;
            }
            const dst = join(target, a);
            mkdirSync(dirname(dst), { recursive: true });
            cpSync(src, dst, { force: true });
          }
          // Digest AFTER every copy, so a nested directory's digest covers what is on disk.
          for (const d of p.directories) {
            if (absent.includes(d.id) || skipped.includes(d.id)) continue;
            if (p.hydrated && !existsSync(join(plan.instanceRoot, d.path, SUBGRAPH_HYDRATED_FILE))) continue;
            dirs.push({
              id: d.id,
              path: d.path,
              upstreamPath: d.upstreamPath,
              ...digestOf(join(plan.instanceRoot, d.path)),
              ...(d.package ? { package: { url: d.package.url, sha256: d.package.sha256, member: d.package.member } } : {}),
              ...(d.except?.length ? { except: d.except } : {}),
            });
          }
          for (const a of p.assets ?? []) {
            if (absent.includes(`asset ${a}`)) continue;
            assets.push({ src: a, sha256: sha256Text(readFileSync(join(target, a))) });
          }
        } finally {
          held.restore();
          installs.restore();
        }
        const ignored = ensureIgnored(plan.instanceRoot, p.path, true);
        if (ignored === "excluded") excluded.push(p.path);
        locked.push({
          instance: p.instance,
          repository: p.repository,
          sha: p.sha,
          upstreamRoot: p.upstreamRoot,
          path: p.path,
          via: p.via,
          pinnedBy: p.pinnedBy,
          declaration: { file: `${p.instance}.json`, sha256: sha256Text(declText) },
          directories: dirs,
          ...(assets.length ? { assets } : {}),
          trust: trust.record,
          ...(p.hydrated ? { hydrated: true as const } : {}),
        });
        const files = dirs.reduce((n, d) => n + d.files, 0) + assets.length;
        const fromPkg = dirs.filter((d) => d.package).length;
        const what = p.hydrated ? `hydrated metadata (${SUBGRAPH_HYDRATED_FILE}${fromPkg ? `, ${fromPkg} from the pin's subgraph index package` : ""}) of ` : "";
        plan.outcomes.push({
          instance: p.instance,
          state: absent.length || invalid.length || ignored === "not-ignored" ? "missing" : mountedState(trust),
          path: p.path,
          detail:
            (absent.length || invalid.length
              ? [
                  absent.length ? `declared but absent at ${p.sha.slice(0, 12)}: ${absent.join(", ")}${p.hydrated ? ` (no ${SUBGRAPH_HYDRATED_FILE} published there)` : ""}` : "",
                  invalid.length ? `not mounted: ${invalid.join("; ")}` : "",
                ].filter(Boolean).join("; ") + " — the rest is mounted"
              : `${what}${dirs.length} director${dirs.length === 1 ? "y" : "ies"}, ${files} file(s) from ${p.repository}@${p.sha.slice(0, 12)}; basis: ${trust.detail}`) +
            (p.tools?.length
              ? `; Tools ${p.tools.map((t) => `\`${t.id}\` (${[t.definition, ...t.implementation].join(" + ")}${t.runtime ? `; runs \`${t.runtime}\`` : ""})`).join(", ")} with their import closure`
              : "") +
            (p.notPublished?.length ? `; not published at the pin, so not mounted: ${p.notPublished.join(", ")}` : "") +
            (p.packageNote && (absent.length || p.notPublished?.length) ? `; ${p.packageNote}` : "") +
            (ignored === "not-ignored" ? ` — but \`${p.path}/\` is NOT ignored: the committed .gitignore index-mounts block does not cover it` : ""),
        });
      } catch (e) {
        plan.outcomes.push({ instance: p.instance, state: "could-not-determine", path: p.path, detail: `mounting threw: ${(e as Error).message}` });
      }
    }

    // Install each mounted layer's dependencies AFTER every layer is
    // down, so a manifest's `workspaces` that names a sibling mount
    // (`../cat-harnes[s]`) finds it. A failed install is reported against the
    // layer and fails the run, but is not written into the lock: the lock
    // records which pinned bytes are on disk, and they are.
    const installFailed = new Set<string>();
    if (opts.install !== false) {
      for (const l of locked) {
        if (untouched.has(l.instance)) continue;
        const r = installDependencies(join(plan.instanceRoot, l.path), opts.install ?? "production");
        if (r.state === "none") continue;
        const o = plan.outcomes.find((x) => x.instance === l.instance && (x.state === "mounted" || x.state === "unverified-approver" || x.state === "missing"));
        if (!o) continue;
        if (r.state === "installed") o.detail += `; ${r.detail}`;
        else {
          installFailed.add(l.instance);
          Object.assign(o, { state: "missing", detail: `${o.detail}; the pinned bytes are on disk but its dependencies are NOT installed, so its tools will not run: ${r.detail}` });
        }
      }
    }

    const lock: MountLock = {
      $schema: MOUNT_LOCK_SCHEMA,
      mounts: plan.mounts.map((m) => ({ harness: m.harness, repository: m.repository, ref: m.ref })),
      instances: locked.sort((a, b) => a.instance.localeCompare(b.instance)),
      // Every non-mounted answer EXCEPT an untouched prior mount, which stays
      // in `instances` and is re-judged from disk by the check.
      unmounted: plan.outcomes
        .filter((o): o is Exclude<InstanceOutcome, { state: "mounted" | "unverified-approver" }> => o.state !== "mounted" && o.state !== "unverified-approver" && !untouched.has(o.instance) && !installFailed.has(o.instance))
        .map((o) => {
          const left = leftOnDisk.get(o.instance);
          return { instance: o.instance, state: o.state, detail: o.detail, ...(left ? { leftOnDisk: left } : {}) };
        })
        .sort((a, b) => a.instance.localeCompare(b.instance)),
    };
    // A same-owner mount stays same-owner on disk: its repository, and every
    // layer reached in the same repository, is written as the bare name
    // (cat-harness-tools#2337).
    const sameOwnerRepos = plan.mounts.filter((m) => m.sameOwner === true).map((m) => m.repository);
    writeFileSync(lockFile, lockTextWithPinnedAt(relativizeLockRepositories(lock, sameOwnerRepos), lockFile));
    syncIgnoreBlock(plan.instanceRoot, blockConfig);
    // The shared-workflow calls follow the lock (owner, 2026-11-01, security
    // audit S1): `uses: litlfred/<layer>/…@<the ref just written>`.
    // Not in CI: the re-pin train's App cannot push workflow files (owner,
    // 2026-11-01, Q-PIN-6 "C"), so there the pins trail the lock and
    // check:workflow-pins only warns until an agent session catches them up.
    // WORKFLOW_PINS_WRITE=1 forces the write.
    if (process.env.CI !== "true" || process.env.WORKFLOW_PINS_WRITE === "1") {
      const pins = syncWorkflowPins(plan.instanceRoot, true);
      if (pins.fixed) console.log(`  workflow pins: moved ${pins.fixed} litlfred/… call(s) to the new lock`);
      for (const f of pins.findings.filter((x) => x.want === null && !x.why.startsWith("tools-ref"))) console.warn(`  workflow pins: ${f.file}:${f.line} ${f.why}`);
    }
    return { plan, lockFile, excluded };
  } finally {
    for (const t of trees.values()) t.close();
    for (const f of packages.values()) if (f.state === "ok") f.close();
  }
}

// ── Seeding: create or re-pin a remote layer, WITH its consent ────────────

/** One `--seed <name>=<owner/repo>@<sha>`: what to write into the index. */
export interface SeedSpec {
  harness: string;
  repository: string;
  ref: string;
  /** Mount every tracked file (`overrides.<harness>.whole: true`). */
  whole?: boolean;
}

/** Parse `<name>=<owner/repo>@<40-char sha>`; throws with the expected shape. */
export function parseSeed(arg: string): SeedSpec {
  // `<repo>` without an owner is a same-owner name (cat-harness-tools#2337).
  const m = /^([^=\s]+)=([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)@([0-9a-f]{40})$/.exec(arg);
  if (!m) throw new Error(`--seed \`${arg}\`: expected <name>=<owner/repo or repo>@<40-character sha>`);
  return { harness: m[1]!, repository: m[2]!, ref: m[3]! };
}

/**
 * Create or re-pin remote layers in `index.config.json`, and write each
 * one's `trust.consent {by, on, ref, evidence}` from `grant` as part of the
 * same write (task #10, gap c). Until 2026-10-12 nothing seeded an index with
 * remote layers, so every entry was hand-written and its consent typed in
 * after — and a re-pin that forgot to move `consent.ref` was refused at the
 * next mount (H8: a moved pin asks again). Here the consent is bound to the
 * pin being written, by `withConsent`, so the two cannot disagree.
 *
 * An existing entry keeps its overrides and note; only its repository and pin
 * move, and a consent already recorded for the SAME pin is kept. Other
 * entries are not touched. The write goes through `writeDeclaredMounts`, so
 * the committed `.gitignore` block moves with it. Nothing is fetched: run
 * `mount:remote` afterwards.
 */
export function seedRemote(instanceRoot: string, specs: readonly SeedSpec[], grant: ConsentGrant, opts: { discardEdits?: boolean } = {}): { file: string; mounts: RemoteMount[] } {
  if (specs.length === 0) throw new Error("nothing to seed");
  // folio-assistant#2682: re-pinning over edited mounts moved the pin while
  // the next mount left the edited layers at their old commit. Refuse up
  // front, unless the caller will replace them (`--fresh`).
  const edited = opts.discardEdits ? [] : editedMounts(instanceRoot, specs.map((s) => s.harness));
  if (edited.length) {
    throw new Error(
      `the mounts this re-pin moves have edits the lock does not hold (${edited.join("; ")}), so the next mount would leave them at the old commit — move the edits upstream, or re-pin from a checkout mounted from the lock (\`.github/mount-from-lock.sh\`), or pass \`--fresh\` to discard them`,
    );
  }
  const current = readDeclaredMounts(instanceRoot).mounts;
  const next: RemoteMount[] = [...current];
  for (const spec of specs) {
    const at = next.findIndex((m) => m.harness === spec.harness);
    // A bare name seeds a same-owner mount; an owner-qualified one keeps an
    // entry same-owner only when it names the repository the entry already
    // resolves to (cat-harness-tools#2337).
    const was = at >= 0 ? next[at]! : undefined;
    const bare = isSameOwnerName(spec.repository);
    const repository = bare ? resolveRepository(spec.repository, checkoutOwner(instanceRoot)) : spec.repository;
    const keepSame = bare || (was?.sameOwner === true && was.repository.toLowerCase() === repository.toLowerCase());
    const { sameOwner: _was, ...rest } = was ?? ({} as Partial<RemoteMount>);
    let m: RemoteMount = was
      ? { ...(rest as RemoteMount), repository, ref: spec.ref, ...(keepSame ? { sameOwner: true as const } : {}) }
      : { harness: spec.harness, repository, ref: spec.ref, ...(keepSame ? { sameOwner: true as const } : {}) };
    if (spec.whole) m = { ...m, overrides: { ...m.overrides, [spec.harness]: { ...m.overrides?.[spec.harness], whole: true } } };
    m = withConsent(m, grant);
    if (at >= 0) next[at] = m;
    else next.push(m);
  }
  const { file } = writeDeclaredMounts(instanceRoot, next);
  return { file, mounts: next.filter((m) => specs.some((s) => s.harness === m.harness)) };
}

/**
 * The lock's text, with `pinnedAt`: when this content was written. A prior
 * lock at `file` whose content, `pinnedAt` aside, is the same keeps its
 * `pinnedAt`, so a mount that changes nothing leaves the bytes alone; any
 * other content is stamped `now`. `lock:coherence:check` reads it as T, the
 * time the pins were written (see `pinnedAt` in `MountLockSchema`).
 */
export function lockTextWithPinnedAt(lock: MountLock, file: string, now: () => Date = () => new Date()): string {
  const { pinnedAt: _ignored, ...body } = lock;
  const { $schema, ...rest } = body;
  const text = (pinnedAt: string) => JSON.stringify({ $schema, pinnedAt, ...rest }, null, 2) + "\n";
  let kept: string | undefined;
  try {
    const prior = JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
    const { pinnedAt, ...priorBody } = prior;
    if (typeof pinnedAt === "string" && JSON.stringify(priorBody) === JSON.stringify(body)) kept = pinnedAt;
  } catch {
    // Absent or unreadable: this content is new.
  }
  return text(kept ?? now().toISOString().replace(/\.\d{3}Z$/, "Z"));
}

/** Locked layers reached through `harnesses` whose bytes on disk no longer hash to the lock, as `<instance>: <paths>`. */
export function editedMounts(instanceRoot: string, harnesses: readonly string[]): string[] {
  let lockFile: string;
  try {
    lockFile = mountLockPathFor(instanceRoot, downstreamOf({ instanceRoot }).name);
  } catch {
    return [];
  }
  const r = readMountLock(lockFile);
  if (!r.ok) return [];
  return r.lock.instances
    .filter((i) => harnesses.includes(i.via))
    .flatMap((i) => {
      const changed = modifiedSince(instanceRoot, i);
      return changed.length ? [`${i.instance}: ${changed.join(", ")}`] : [];
    });
}

// ── Writing back a review's choice (bean `mo75`) ──────────────────────────

/** One `--choose <harness>[:<instance>]` with what was chosen. */
export interface ChoiceSpec {
  /** The mount entry, by its harness name. */
  harness: string;
  /** The layer of that entry's closure the choice is for; the harness itself when omitted. */
  instance?: string;
  directories?: string[];
  tools?: string[];
}

/** Parse `<harness>` or `<harness>:<instance>`; throws with the expected shape. */
export function parseChoose(arg: string): { harness: string; instance?: string } {
  const m = /^([^:\s]+)(?::([^:\s]+))?$/.exec(arg);
  if (!m) throw new Error(`--choose \`${arg}\`: expected <harness> or <harness>:<instance>`);
  return { harness: m[1]!, ...(m[2] ? { instance: m[2] } : {}) };
}

/**
 * Write the CHOICE a review made — which directories (nested ids and concern
 * names included) and which Tools — into the mount entry's
 * `overrides.<instance>`, so a fresh clone replays it (bean `mo75`; the
 * proposal's "the choice, never the state"). The pin and its consent are not
 * touched: a choice moves no commit. The choice replaces the override's
 * `whole` and `skip`, and ends the review: the chosen set is mounted as files,
 * so a `hydrated` the layer had is dropped (set `false` where the entry
 * itself is hydrated). Nothing is fetched or checked here; the next
 * `mount:remote` resolves the choice at the pin, refuses an id the pin does
 * not declare, and records what it resolved to in `index.lock.json`.
 */
export function chooseRemote(instanceRoot: string, spec: ChoiceSpec): { file: string; mount: RemoteMount } {
  if (!spec.directories?.length && !spec.tools?.length) throw new Error("--choose needs --directories and/or --tools: a choice of nothing is not one");
  const current = readDeclaredMounts(instanceRoot).mounts;
  const at = current.findIndex((m) => m.harness === spec.harness);
  if (at < 0) throw new Error(`no mount entry \`${spec.harness}\` — seed it first (\`mount:remote --seed\`)`);
  const instance = spec.instance ?? spec.harness;
  const m = current[at]!;
  const { whole: _w, skip: _s, hydrated: _h, directories: _d, tools: _t, ...kept } = m.overrides?.[instance] ?? {};
  const override = {
    ...kept,
    ...(spec.directories?.length ? { directories: [...new Set(spec.directories)] } : {}),
    ...(spec.tools?.length ? { tools: [...new Set(spec.tools)] } : {}),
    ...(m.hydrated ? { hydrated: false } : {}),
  };
  const next = [...current];
  next[at] = { ...m, overrides: { ...m.overrides, [instance]: override } } as RemoteMount;
  const { file } = writeDeclaredMounts(instanceRoot, next);
  return { file, mount: next[at]! };
}

// ── Checking (no network) ────────────────────────────────────────────────────

export interface CheckResult {
  /**
   * `unverified-approver`: every layer is mounted and verified, but at
   * least one on consent no declared `mountApprovers` list checked. It exits
   * 0 (the bytes are the pinned bytes) and is reported as its own state,
   * never rendered as clean (roast `1ygp` L4.2).
   */
  state: "not-enabled" | "mounted" | "unverified-approver" | "missing" | "could-not-determine";
  reason: string;
  outcomes: InstanceOutcome[];
}

/**
 * Disk against lock against declaration, with no fetch. The declaration's pins
 * must be the lock's; every locked directory must be on disk and hash to its
 * digest; every locked declaration must be byte-identical.
 */
export function checkRemote(opts: { instanceRoot?: string } = {}): CheckResult {
  let ds: ReturnType<typeof downstreamOf>;
  try {
    ds = downstreamOf(opts);
  } catch (e) {
    return { state: "could-not-determine", reason: `could not read the declaration: ${(e as Error).message}`, outcomes: [] };
  }
  if (ds.mounts.length === 0) return { state: "not-enabled", reason: "no `remoteMounts` declared; nothing to check", outcomes: [] };
  let lockFile: string;
  try {
    lockFile = mountLockPathFor(ds.instanceRoot, ds.name);
  } catch (e) {
    return { state: "could-not-determine", reason: (e as Error).message, outcomes: [] };
  }
  const r = readMountLock(lockFile);
  if (!r.ok) {
    return r.absent
      ? { state: "missing", reason: `\`remoteMounts\` declared and no lock at ${mountLockFilename(ds.name)} — run \`bun run cat mount:remote\``, outcomes: [] }
      : { state: "could-not-determine", reason: r.why, outcomes: [] };
  }
  const want = JSON.stringify(ds.mounts.map((m) => [m.harness, m.repository, m.ref]).sort());
  const have = JSON.stringify(r.lock.mounts.map((m) => [m.harness, m.repository, m.ref]).sort());
  if (want !== have) {
    return { state: "missing", reason: "the lock was written for different pins than the declaration names — run `bun run cat mount:remote`", outcomes: [] };
  }
  // A pin's own layers were mounted from that pin (folio-assistant#2682):
  // `mount:remote --seed` in a checkout whose mounts had drifted rewrote the
  // top-level `ref` and left the layer entries at the old commit, and CI,
  // which mounts from the entries, kept testing the old layer.
  const stale = r.lock.instances.flatMap((inst) => {
    const m = r.lock.mounts.find((x) => x.harness === inst.via && x.repository === inst.repository);
    return m && inst.sha !== m.ref ? [`${inst.instance} at ${inst.sha.slice(0, 12)}, pinned at ${m.ref.slice(0, 12)}`] : [];
  });
  if (stale.length) {
    return {
      state: "missing",
      reason: `the lock's instance entries are not the pinned commits (${stale.join("; ")}) — re-pin from a checkout mounted from the lock: \`bun run cat mount:remote --seed …\` then \`bun run cat mount:remote\``,
      outcomes: [],
    };
  }
  // What the mount reached and did not lay down is carried in the lock, so
  // "the lock lists nothing wrong" is never mistaken for "nothing was wrong".
  const outcomes: InstanceOutcome[] = r.lock.unmounted.map(
    (u) =>
      ({
        instance: u.instance,
        state: u.state,
        detail: u.leftOnDisk && !u.detail.includes("still on disk") ? `${u.detail}; previous mount still on disk at \`${u.leftOnDisk.path}/\`, NOT mounted` : u.detail,
      }) as InstanceOutcome,
  );
  for (const inst of r.lock.instances) {
    // Roast `1ygp` L4.2: re-judge the recorded basis against the CURRENT
    // declaration, so consent withdrawn (or an approver list tightened) after
    // the mount is reported, not inherited from the lock.
    const via = ds.mounts.find((m) => m.harness === inst.via);
    const purpose = inst.trust?.basis === "staging" ? "staging" : "mount";
    const trust = trustFor(via, inst, purpose, ds.approvers);
    if (!trust.ok) {
      outcomes.push({
        instance: inst.instance,
        state: trust.state,
        path: inst.path,
        detail: `the recorded basis (${inst.trust ? inst.trust.basis : "none recorded"}) no longer holds, so this is not mounted: ${trust.detail}`,
      });
      continue;
    }
    const basis = inst.trust ? trust.detail : `${trust.detail} (no basis recorded in the lock; re-derived — re-run \`bun run cat mount:remote\` to record it)`;
    try {
      const decl = join(ds.instanceRoot, inst.path, inst.declaration.file);
      // A hydrated mount records its declaration and lays none down (G2):
      // the directories' digests below are its whole check.
      if (!inst.hydrated && !existsSync(decl)) {
        outcomes.push({ instance: inst.instance, state: "missing", path: inst.path, detail: `${inst.path}/${inst.declaration.file} is not on disk` });
        continue;
      }
      if (!inst.hydrated && sha256Text(readFileSync(decl)) !== inst.declaration.sha256) {
        outcomes.push({ instance: inst.instance, state: "missing", path: inst.path, detail: `${inst.path}/${inst.declaration.file} does not hash to the lock` });
        continue;
      }
      const bad: string[] = [];
      for (const d of inst.directories) {
        const abs = join(ds.instanceRoot, d.path);
        if (!existsSync(abs)) bad.push(`${d.path}/ absent`);
        else if (digestOf(abs, stateMountedDirs(ds.instanceRoot)).treeDigest !== d.treeDigest) bad.push(`${d.path}/ modified`);
      }
      for (const a of inst.assets ?? []) {
        const abs = join(ds.instanceRoot, inst.path, a.src);
        if (!existsSync(abs)) bad.push(`${inst.path}/${a.src} absent`);
        else if (sha256Text(readFileSync(abs)) !== a.sha256) bad.push(`${inst.path}/${a.src} modified`);
      }
      const edited = bad.length > 0 && bad.every((x) => x.endsWith(" modified"));
      outcomes.push(
        bad.length
          ? { instance: inst.instance, state: "missing", path: inst.path, detail: `the pinned bytes are not on disk: ${bad.join("; ")}`, ...(edited ? { edited: true as const } : {}) }
          : {
            instance: inst.instance,
            state: mountedState(trust),
            path: inst.path,
            detail: `${inst.repository}@${inst.sha.slice(0, 12)}, ${inst.directories.length} director${inst.directories.length === 1 ? "y" : "ies"} verified; basis: ${basis}`,
          },
      );
    } catch (e) {
      outcomes.push({ instance: inst.instance, state: "could-not-determine", path: inst.path, detail: `could not read: ${(e as Error).message}` });
    }
  }
  return { ...summarise(outcomes), outcomes };
}

/** The aggregate: could-not-determine outranks missing, which outranks mounted. */
export function summarise(outcomes: InstanceOutcome[]): { state: CheckResult["state"]; reason: string } {
  const by = (s: InstanceOutcome["state"]): InstanceOutcome[] => outcomes.filter((o) => o.state === s);
  const cnd = by("could-not-determine");
  const missing = by("missing");
  const refused = by("refused");
  const unverified = by("unverified-approver");
  if (cnd.length) return { state: "could-not-determine", reason: `${cnd.length} instance(s) could not be determined: ${cnd.map((o) => o.instance).join(", ")} — never a pass` };
  // A refused mount is not mounted: it reads as missing, and says why.
  if (missing.length || refused.length) {
    const parts = [
      ...(missing.length ? [`${missing.length} instance(s) missing: ${missing.map((o) => o.instance).join(", ")}`] : []),
      ...(refused.length ? [`${refused.length} instance(s) refused by the trust check (H8): ${refused.map((o) => o.instance).join(", ")}`] : []),
    ];
    return { state: "missing", reason: parts.join("; ") };
  }
  if (unverified.length) {
    return {
      state: "unverified-approver",
      reason: `${by("mounted").length + unverified.length} instance(s) mounted, ${unverified.length} on consent by an UNVERIFIED approver (no \`mountApprovers\` declared): ${unverified.map((o) => o.instance).join(", ")}`,
    };
  }
  return { state: "mounted", reason: `${by("mounted").length} instance(s) mounted${by("local").length ? `, ${by("local").length} held locally` : ""}` };
}

export function exitCode(state: CheckResult["state"]): number {
  return state === "could-not-determine" ? 2 : state === "missing" ? 1 : 0;
}

export function reportOutcomes(title: string, state: CheckResult["state"], reason: string, outcomes: InstanceOutcome[]): string {
  const L = [`## ${title}`, ""];
  if (state === "not-enabled") return [...L, `Not enabled — ${reason}.`].join("\n");
  L.push(state === "mounted" ? `✅ ${reason}.` : state === "unverified-approver" ? `⚠️ **UNVERIFIED-APPROVER** — ${reason}. Not clean: declare \`mountApprovers\` so who consented is checked.` : `🛑 **${state.toUpperCase()}** — ${reason}. A layer that is not mounted is absent from every overlay; do not read its absence as "nothing there".`, "");
  if (outcomes.length) {
    L.push("| instance | state | path | detail |", "|---|---|---|---|");
    for (const o of outcomes) L.push(`| \`${o.instance}\` | ${o.state} | ${"path" in o && o.path ? `\`${o.path}\`` : "—"} | ${o.detail} |`);
  }
  return L.join("\n");
}

// ── Every declaring layer in a checkout (the session-start fan-out) ───────

/** The layers in `checkout` that declare remote mounts (index or `remoteMounts`). An unreadable declaration or index is reported, not skipped. */
export function declaringInstances(checkout: string): { roots: string[]; unreadable: Array<{ root: string; why: string }> } {
  const roots: string[] = [];
  const unreadable: Array<{ root: string; why: string }> = [];
  const mounted = new Set(lockedMountPaths(checkout));
  const candidates = [...new Set([checkout, ...layerRootsIn(checkout)])];
  for (const root of candidates) {
    if (root !== checkout && mounted.has(relative(checkout, root))) continue;
    try {
      if (readDeclaredMounts(root).mounts.length > 0) roots.push(root);
    } catch (e) {
      unreadable.push({ root, why: (e as Error).message.split("\n")[0]! });
    }
  }
  return { roots, unreadable };
}

/**
 * The lock check of `root` when it says every layer is already mounted at
 * its pinned bytes, else undefined. Only a clean verdict counts: a missing,
 * refused or undetermined layer anywhere sends the root to the full mount.
 */
export function currentPerLock(root: string): CheckResult | undefined {
  const c = checkRemote({ instanceRoot: root });
  if (c.state !== "mounted" && c.state !== "unverified-approver") return undefined;
  if (c.outcomes.length === 0 || c.outcomes.some((o) => o.state !== "mounted" && o.state !== "unverified-approver")) return undefined;
  if (optInDriftFromLock(root).length > 0) return undefined;
  return c;
}

/**
 * The whole-layer mounts whose recorded `except` no longer matches what the
 * root's `enableSubgraphs` leaves out now, each as `<layer>: <why>`. Empty
 * when every one matches, or when there is no lock to compare.
 *
 * The lock check judges bytes against the lock, and the lock's `except` was
 * computed from the enabled set at mount time. So a downstream that switches
 * an opt-in sub-graph on (say `cat-harness.proposals`) still reads
 * as current, and without this the fast path never laid the newly enabled
 * group down (only `--fresh` did).
 *
 * Nothing is fetched: the expected `except` is recomputed from the mounted
 * layer's own declarations on disk ({@link switchedOffOptInPaths}). A path
 * the lock left out is absent, so a nested declaration under it cannot be
 * read here; that cannot change the answer, because `except` keeps only the
 * outermost switched-off path. Only opt-in directories found on disk are
 * compared. A layer whose declarations cannot be read here is reported as
 * drift, so the full mount decides.
 */
export function optInDriftFromLock(root: string): string[] {
  let lock: MountLock;
  try {
    const ds = downstreamOf({ instanceRoot: root });
    const r = readMountLock(mountLockPathFor(ds.instanceRoot, ds.name));
    if (!r.ok) return [];
    lock = r.lock;
  } catch {
    return [];
  }
  const enabled = enabledSubgraphs(root);
  const drift: string[] = [];
  for (const inst of lock.instances) {
    const whole = inst.directories.find((d) => d.id === WHOLE_INSTANCE_ID);
    if (!whole) continue;
    const layerRoot = join(root, inst.path);
    let optIn: Array<{ id: string; path: string; optIn?: boolean }>;
    let expected: string[];
    try {
      // Read structurally, as the planner's mount fields are: a full read
      // needs kinds the mounts themselves supply (bean qump).
      const declFile = join(layerRoot, inst.declaration.file);
      const raw = JSON.parse(readFileSync(declFile, "utf-8")) as { directories?: unknown };
      const top = (Array.isArray(raw.directories) ? raw.directories : [])
        .filter((d): d is { id: string; path: string; optIn?: unknown } => typeof d?.id === "string" && typeof d?.path === "string")
        .map((d) => ({ id: d.id, path: d.path, ...(d.optIn === true ? { optIn: true } : {}) }));
      let nested: Array<{ id: string; path: string; optIn?: boolean }> = [];
      try {
        nested = instanceDirectories(layerRoot).map((d) => ({ id: d.id, path: d.path, ...((d as { optIn?: unknown }).optIn === true ? { optIn: true } : {}) }));
      } catch {
        // As at the pin: unreadable nested declarations leave only the top level.
      }
      optIn = [...top, ...nested].filter((d) => d.optIn === true);
      expected = switchedOffOptInPaths(inst.instance, top, nested, enabled);
    } catch (e) {
      drift.push(`${inst.instance}: its declaration could not be read here (${(e as Error).message.split("\n")[0]})`);
      continue;
    }
    const recorded = new Set(whole.except ?? []);
    const want = new Set(expected);
    const changed = [...new Set(optIn.map((d) => strip(d.path).replace(/^\.\//, "")))].filter((p) => recorded.has(p) !== want.has(p)).sort();
    if (changed.length) {
      drift.push(`${inst.instance}: ${changed.map((p) => `${p} is ${want.has(p) ? "now switched off" : "now switched on"}`).join(", ")} (\`enableSubgraphs\` changed since the lock was written)`);
    }
  }
  return drift;
}

/**
 * The lock check of `root` when every layer not at its pinned bytes is one
 * a mount would leave untouched (`edited`: present, but its bytes changed),
 * and at least one is; else undefined. Then a fetch cannot change the
 * verdict, so `remoteFanOut` reports it without fetching.
 *
 * Measured 2026-11-06 (bean `cat-tools-sm8r`): a local gate run's eight
 * `state:mount` steps each fetched every remote (32–42 s) only to report the
 * same eight edited mounts as "left untouched", 305 s of a 1396 s run. The
 * verdict is unchanged, still `missing`: an edited mount is not current,
 * and saying so faster does not make it so.
 */
export function editedOnlyPerLock(root: string): CheckResult | undefined {
  const c = checkRemote({ instanceRoot: root });
  if (c.outcomes.length === 0) return undefined;
  // A changed opt-in set is something a mount WOULD change.
  if (optInDriftFromLock(root).length > 0) return undefined;
  const off = c.outcomes.filter((o) => o.state !== "mounted" && o.state !== "unverified-approver");
  if (off.length === 0 || !off.every((o) => o.state === "missing" && o.edited === true)) return undefined;
  return c;
}

/** One mount whose bytes no longer hash to its lock: which root's lock, which layer, where, and what differs. */
export interface EditedMount {
  root: string;
  instance: string;
  path?: string;
  detail: string;
}

/**
 * Every mount in `checkout` that a plain mount would leave untouched because
 * its bytes changed since it was laid (`edited`), over every declaring root
 * as {@link remoteFanOut} walks them. Nothing is fetched. A publisher asks
 * this before it mounts, so a build an earlier attempt left behind is named,
 * with the command that re-lays it ({@link relayAdvice}), instead of failing
 * inside the mount step (an IG's first agent publish, 2026-11-06).
 */
export function editedMountsIn(checkout: string): EditedMount[] {
  return declaringInstances(checkout).roots.flatMap((root) =>
    checkRemote({ instanceRoot: root }).outcomes.flatMap((o) =>
      o.state === "missing" && (o as { edited?: boolean }).edited
        ? [{ root, instance: o.instance, ...("path" in o && o.path ? { path: o.path } : {}), detail: o.detail }]
        : [],
    ),
  );
}

/**
 * What to run to re-lay `edited`, exactly: this script with `--fresh` from
 * the checkout, which replaces only the mounts whose bytes no longer match
 * the lock (and loses any edit in them), or the publisher's own `--fresh`.
 */
export function relayAdvice(checkout: string, edited: readonly EditedMount[], o: { script?: string } = {}): string {
  const script = relative(checkout, o.script ?? join(import.meta.dir, "remote-mount.ts")) || "remote-mount.ts";
  return [
    `${edited.length} mount(s) no longer match the lock, so the mount step would leave them as they are and the build would not start:`,
    ...edited.map((e) => `  - ${e.instance}${e.path ? ` (${e.path}/)` : ""}: ${e.detail}`),
    "An earlier build most likely wrote into them. Re-lay them (any edit in them is lost):",
    `  cd ${checkout} && bun run ${script} --fresh`,
    "or pass --fresh to stage-local.ts (or build-instance-site.ts), which does the same before it builds.",
  ].join("\n");
}

/**
 * What the full mount's install step would do for a current root, without
 * the fetch: `bun install` in a mounted layer that has a manifest and no
 * `node_modules/` yet. node_modules is outside every digest, so the lock check
 * cannot see it; a mount laid with `--no-install` is runnable after this.
 */
function installMissingDependencies(root: string, outcomes: readonly InstanceOutcome[], mode: InstallMode): void {
  for (const o of outcomes) {
    const path = (o as { path?: string }).path;
    if (path === undefined) continue;
    const dir = join(root, path);
    if (!existsSync(join(dir, "package.json")) || existsSync(join(dir, "node_modules"))) continue;
    const r = installDependencies(dir, mode);
    if (r.state === "installed") o.detail += `; ${r.detail}`;
    else if (r.state === "failed") Object.assign(o, { state: "missing", detail: `${o.detail}; the pinned bytes are on disk but its dependencies are NOT installed, so its tools will not run: ${r.detail}` });
  }
}

/**
 * Mount (or, with `check`, verify) every declaring layer in `checkout` —
 * what `state:mount` and the session-start hook call. A layer whose
 * declaration cannot be read is could-not-determine for the whole fan-out:
 * it may be the one that declares mounts.
 */
export function remoteFanOut(checkout: string, opts: { check?: boolean; plan?: boolean; urlFor?: UrlFor; purpose?: "staging" | "mount"; install?: InstallMode | false; discardEdits?: boolean } = {}): { state: CheckResult["state"]; text: string } {
  const { roots, unreadable } = declaringInstances(checkout);
  const parts: string[] = [];
  const states: CheckResult["state"][] = [];
  for (const u of unreadable) {
    states.push("could-not-determine");
    parts.push(`## Remote mounts\n\n🛑 **could-not-determine** — ${u.root}'s declaration is unreadable (${u.why}); it may declare mounts.`);
  }
  for (const root of roots) {
    if (opts.check) {
      const r = checkRemote({ instanceRoot: root });
      states.push(r.state);
      parts.push(reportOutcomes(`Remote mounts — ${root}`, r.state, r.reason, r.outcomes));
    } else if (opts.plan) {
      // `--plan` writes nothing: no fetch into the tree, no lock, no install.
      const p = planRemote({ instanceRoot: root, urlFor: opts.urlFor });
      const sum = summarise(p.outcomes);
      states.push(sum.state);
      parts.push(reportOutcomes(`Remote mounts — plan for ${root}`, sum.state, sum.reason, p.outcomes));
    } else {
      // Bean `folio-assistant-x35i`: a root whose lock check is already clean
      // (declaration pins = lock pins, every locked directory on disk at its
      // digest, every declaration byte-identical) fetches nothing. CI lays
      // every mount from the lock first (`mount-from-lock.sh`, ~2 s to
      // verify), and the resolve below re-fetched every remote over the
      // network for 43-68 s in each of ~17 jobs. Anything missing, stale or
      // unreadable still takes the full mount, and `--fresh` always does.
      const current = opts.discardEdits ? undefined : currentPerLock(root);
      if (current !== undefined) {
        if (opts.install !== false) installMissingDependencies(root, current.outcomes, opts.install ?? "production");
        const sum = summarise(current.outcomes);
        states.push(sum.state);
        parts.push(reportOutcomes(`Remote mounts — ${root} (current per the lock; nothing fetched)`, sum.state, sum.reason, current.outcomes));
        continue;
      }
      // Bean `cat-tools-sm8r`: every layer off the lock is edited, and a
      // mount leaves an edited layer untouched (only `--fresh` replaces
      // it), so the fetch below could not change a single verdict.
      const edited = opts.discardEdits ? undefined : editedOnlyPerLock(root);
      if (edited !== undefined) {
        if (opts.install !== false) installMissingDependencies(root, edited.outcomes.filter((o) => o.state !== "missing"), opts.install ?? "production");
        for (const o of edited.outcomes) {
          if (o.state === "missing" && o.edited) o.detail = `left untouched: ${o.detail} — edits there are somebody's work; move them upstream or delete the directory, then re-mount (or \`--fresh\`)`;
        }
        const sum = summarise(edited.outcomes);
        states.push(sum.state);
        parts.push(reportOutcomes(`Remote mounts — ${root} (only edited mounts are off the lock, and a mount leaves those untouched; nothing fetched)`, sum.state, sum.reason, edited.outcomes));
        continue;
      }
      const r = mountRemote({ instanceRoot: root, urlFor: opts.urlFor, purpose: opts.purpose, install: opts.install, discardEdits: opts.discardEdits });
      const sum = summarise(r.plan.outcomes);
      states.push(sum.state);
      parts.push(reportOutcomes(`Remote mounts — ${root}`, sum.state, sum.reason, r.plan.outcomes));
      if (r.excluded.length) parts.push(`Added to this worktree's info/exclude (not committed): ${r.excluded.map((p) => `\`${p}/\``).join(", ")}.`);
    }
  }
  if (states.length === 0) return { state: "not-enabled", text: "## Remote mounts\n\nNot enabled — no instance in this checkout declares `remoteMounts`." };
  const state = states.includes("could-not-determine")
    ? "could-not-determine"
    : states.includes("missing")
      ? "missing"
      : states.includes("unverified-approver")
        ? "unverified-approver"
        : "mounted";
  return { state, text: parts.join("\n\n") };
}

/**
 * The generators whose output an agent reads, re-run after a mount changed
 * the lock. Each finds its own roots, so they run from the checkout root.
 * Kept to the two that DERIVE the agent surface from mounted layers; adding a
 * third here is the place to do it, and `remote-mount.md` names the list.
 */
export const AGENT_SURFACE_GENERATORS = ["gen-skill-commands.ts", "agent-memory.ts"] as const;

/** Run every {@link AGENT_SURFACE_GENERATORS} entry from `root`; `ok` is false if any exits non-zero. */
export function regenerateAgentSurface(root: string): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  for (const g of AGENT_SURFACE_GENERATORS) {
    const r = spawnSync(process.execPath, [join(import.meta.dir, g)], { cwd: root, encoding: "utf-8" });
    const pass = r.status === 0;
    ok &&= pass;
    const rawLines = (r.stderr || r.stdout).trim().split("\n").filter((l) => l.trim().length > 0);
    const findings = rawLines.filter((l) => l.trim().startsWith("✗"));
    const tail = findings.length > 0 ? findings : rawLines.slice(-3);
    lines.push(`  ${pass ? "✓" : "✗"} ${g}${pass ? "" : ` exited ${r.status ?? r.signal}: ${tail.join(" | ")}`}`);
  }
  return { ok, lines };
}

/** The lock's bytes, or `undefined` when there is none — compared before and after a mount. */
export function lockBytes(root: string): string | undefined {
  const f = join(root, mountLockFilename());
  return existsSync(f) ? readFileSync(f, "utf-8") : undefined;
}

/**
 * After a mount: when the lock changed and the caller did not opt out,
 * re-render the agent surface and fold its outcome into the exit code.
 */
export function afterMount(root: string, before: string | undefined, argv: string[], code: number): number {
  if (lockBytes(root) === before) return code;
  const r = argv.includes("--no-agent-surface") ? { ok: true, lines: [] as string[] } : regenerateAgentSurface(root);
  if (!argv.includes("--no-agent-surface")) {
    console.log(`\n## Agent surface — the lock changed, so the skills and memory agents read were re-rendered\n\n${r.lines.join("\n")}`);
    if (!r.ok) console.log("\nRe-run the failed generator before committing this re-pin: the new layer and the old agent surface disagree.");
  }
  if (!argv.includes("--no-health")) {
    // Owner, 2026-11-07, card "Layer health": "A. The re-pin does it". A move
    // of the cat-harness-tools pin moves the health checker, so this
    // checkout's own report is regenerated and pushed here. Report only: it
    // never changes the exit code (`lib/repin-health.ts`).
    const h = afterMountHealth(root, before, lockBytes(root));
    if (h) console.log(h.join("\n"));
  }
  if (code === 0 && !argv.includes("--no-layers-publish")) {
    // The committer who changed the lock writes its layers cache ref, so CI
    // only fetches and verifies it (skill `remote-mount`, "The layers cache").
    // Time only: a refusal or a failed push never changes the exit code.
    const p = publishLayers(root);
    console.log(`\n## Layers cache — ${p.ok ? p.detail : `not published (${p.detail}); CI falls back to the per-repository fetch, and \`bun run cat layers:publish\` retries`}`);
  }
  return r.ok ? code : Math.max(code, 1);
}

/**
 * Every flag this script reads, and which of them take a value. Anything else
 * is refused before the script does anything: an unrecognised flag used to be
 * ignored, so `mount:remote --help` (no such flag then) ran a full mount, and
 * `mount:remote --plan` without `--instance` fetched and wrote the lock.
 */
export const MOUNT_REMOTE_FLAGS: ReadonlyMap<string, "switch" | "value"> = new Map([
  ["--help", "switch"],
  ["-h", "switch"],
  ["--plan", "switch"],
  ["--check", "switch"],
  ["--staging", "switch"],
  ["--json", "switch"],
  ["--no-install", "switch"],
  ["--install-all", "switch"],
  ["--no-agent-surface", "switch"],
  ["--no-layers-publish", "switch"],
  ["--no-health", "switch"],
  ["--fresh", "switch"],
  ["--whole", "switch"],
  ["--instance", "value"],
  ["--seed", "value"],
  ["--consent-by", "value"],
  ["--consent-on", "value"],
  ["--evidence", "value"],
  ["--choose", "value"],
  ["--directories", "value"],
  ["--tools", "value"],
]);

/** What is wrong with `argv`, one line each; empty when every argument is a known flag or a known flag's value. */
export function argvProblems(argv: readonly string[]): string[] {
  const problems: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const kind = MOUNT_REMOTE_FLAGS.get(a);
    if (kind === "value") {
      if (argv[i + 1] === undefined || MOUNT_REMOTE_FLAGS.has(argv[i + 1]!)) problems.push(`${a} needs a value`);
      else i++;
    } else if (kind === undefined) {
      problems.push(a.startsWith("-") ? `unknown flag ${a}` : `unexpected argument ${a}`);
    }
  }
  return problems;
}

/** The usage text: this file's header comment, as the other scripts here print it. */
export function usageText(): string {
  return readFileSync(import.meta.path, "utf-8").split("*/")[0]!;
}

/** `--no-install` lays bytes only; `--install-all` adds devDependencies; default `production`. */
function installOf(argv: string[]): InstallMode | false {
  return argv.includes("--no-install") ? false : argv.includes("--install-all") ? "all" : "production";
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usageText());
    process.exit(0);
  }
  const problems = argvProblems(argv);
  if (problems.length) {
    console.error(`mount:remote: ${problems.join("; ")} — nothing was run. \`bun run cat mount:remote --help\` lists the flags.`);
    process.exit(2);
  }
  const at = argv.indexOf("--instance");
  if (argv.includes("--choose")) {
    const list = (flag: string): string[] | undefined => {
      const i = argv.indexOf(flag);
      return i >= 0 ? argv[i + 1]!.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
    };
    try {
      const root = at === -1 ? checkoutRootFor(process.cwd()) : resolve(argv[at + 1]!);
      const target = parseChoose(argv[argv.indexOf("--choose") + 1]!);
      const r = chooseRemote(root, { ...target, directories: list("--directories"), tools: list("--tools") });
      const o = r.mount.overrides?.[target.instance ?? target.harness];
      console.log(`✓ ${target.harness}${target.instance ? `:${target.instance}` : ""}: ${JSON.stringify(o)}`);
      console.log(`wrote ${r.file} — run \`bun run cat mount:remote\` to mount the choice; the lock records what it resolves to`);
      process.exit(0);
    } catch (e) {
      console.error(`✗ ${(e as Error).message}`);
      process.exit(2);
    }
  }
  if (argv.includes("--seed")) {
    const valueOf = (flag: string): string | undefined => {
      const i = argv.indexOf(flag);
      return i >= 0 ? argv[i + 1] : undefined;
    };
    const by = valueOf("--consent-by");
    // The evidence is free prose — it quotes what was said — so its home is
    // stdin, where it is data rather than a command-line word (the Tool's
    // `evidence` input, and check:tools' injection rule). `--evidence` is still
    // read for a caller already passing it.
    const evidence = valueOf("--evidence") ?? (process.stdin.isTTY ? undefined : readFileSync(0, "utf-8").trim() || undefined);
    if (!by || !evidence) {
      console.error("--seed writes consent, so it needs --consent-by <who> and the evidence (where they consented, readable) on stdin (H8: a remote instance without consent is refused at mount)");
      process.exit(2);
    }
    try {
      const specs = argv.flatMap((a, i) => (a === "--seed" ? [parseSeed(argv[i + 1] ?? "")] : [])).map((s) => ({ ...s, whole: argv.includes("--whole") }));
      const root = at === -1 ? checkoutRootFor(process.cwd()) : resolve(argv[at + 1]!);
      const r = seedRemote(root, specs, { by, evidence, on: valueOf("--consent-on") }, { discardEdits: argv.includes("--fresh") });
      for (const m of r.mounts) console.log(`✓ ${m.harness} = ${m.repository}@${m.ref.slice(0, 12)}; consent by ${m.trust?.consent?.by} on ${m.trust?.consent?.on}`);
      console.log(`wrote ${r.file} — run \`bun run cat mount:remote\` to lay the bytes down`);
      process.exit(0);
    } catch (e) {
      console.error(`✗ ${(e as Error).message}`);
      process.exit(2);
    }
  }
  if (at === -1) {
    const root = checkoutRootFor(process.cwd());
    const plan = argv.includes("--plan");
    const mounting = !argv.includes("--check") && !argv.includes("--staging") && !plan;
    const before = lockBytes(root);
    const r = remoteFanOut(root, { check: argv.includes("--check"), plan, purpose: argv.includes("--staging") ? "staging" : "mount", install: installOf(argv), discardEdits: argv.includes("--fresh") });
    console.log(r.text);
    process.exit(mounting ? afterMount(root, before, argv, exitCode(r.state)) : exitCode(r.state));
  }
  const instanceRoot = resolve(argv[at + 1]!);
  if (argv.includes("--check")) {
    const r = checkRemote({ instanceRoot });
    console.log(argv.includes("--json") ? JSON.stringify(r, null, 2) : reportOutcomes("Remote mounts — check", r.state, r.reason, r.outcomes));
    process.exit(exitCode(r.state));
  }
  if (argv.includes("--plan")) {
    const p = planRemote({ instanceRoot });
    console.log(JSON.stringify({ instances: p.instances, outcomes: p.outcomes }, null, 2));
    process.exit(exitCode(p.mounts.length ? summarise(p.outcomes).state : "not-enabled"));
  }
  const before = lockBytes(instanceRoot);
  const r = mountRemote({ instanceRoot, purpose: argv.includes("--staging") ? "staging" : "mount", install: installOf(argv), discardEdits: argv.includes("--fresh") });
  const state = r.plan.mounts.length ? summarise(r.plan.outcomes).state : "not-enabled";
  console.log(reportOutcomes("Remote mounts", state, state === "not-enabled" ? "no `remoteMounts` declared" : summarise(r.plan.outcomes).reason, r.plan.outcomes));
  if (r.excluded.length) console.log(`\nAdded to this worktree's info/exclude (not committed): ${r.excluded.map((p) => `\`${p}/\``).join(", ")}.`);
  process.exit(argv.includes("--staging") ? exitCode(state) : afterMount(instanceRoot, before, argv, exitCode(state)));
}
