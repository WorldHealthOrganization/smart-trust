#!/usr/bin/env bun
/**
 * Every declared directory exists, or says why it does not.
 *
 * @module scripts/check-declared-dirs
 * @covers cat-harness
 *
 * `resolveDirectories` is **existence-filtered**: a declared directory not on
 * disk is dropped before any consumer sees it, so every consumer would report
 * a clean run over nothing. This reports it. (`check:declared-assets`
 * verifies declared FILES, `check:declared-paths` refuses a literal naming a
 * declared directory, and `check:declaration-claims` compares prose against
 * the files; none of them sees this.)
 *
 * It covers the `directories` of each `<instance>.json` AND entries declared
 * FROM WITHIN (`docs/docs.json`, `beans/beans.json`, `voices/voices.json`).
 * The summary counts the two separately and never adds them.
 *
 * ## Two directions
 *
 * - **absent, unexplained** — declared and not on disk, with no `absent`
 *   reason. A finding.
 * - **explained, but present** — declares `absent` and the directory exists.
 *   Also a finding: an exemption that outlived its cause reads as a live
 *   decision and is not one.
 *
 * ## Where a path resolves against
 *
 * `scope: "repository"` resolves against the REPOSITORY root; anything else
 * against the declaring LAYER's root — the rule `KgAssetSchema.src`
 * already states for assets.
 *
 * ## Layers are DISCOVERED, not listed
 *
 * Via {@link layerRootsIn}, the same way `check:declared-assets` does.
 *
 * ## A MIRROR of another layer's directory
 *
 * - **mirror** — a `scope: "repository"` entry whose path lies inside ANOTHER
 *   layer's root. Each layer declares its own directories; the checkout
 *   aggregates them (the root layer `needs` every staged layer, and
 *   `check:instance-graph` refuses one it does not reach). So a lower layer
 *   never names the layers stacked on it.
 *
 * ## A directory kept at a branch TIP
 *
 * - **not-cut-over** — it declares the branch and the checkout still tracks
 *   files at the path. Two copies, and nothing says which is authoritative.
 * - **unmounted** — cut over, and nothing mounted here, so every reader of
 *   the path sees an EMPTY graph rather than an unreachable one.
 *
 * A **route**-keyed directory gets the FIRST of those two and not the second:
 * there is no route-keyed mount for `unmounted` to be about. {@link routePresence}
 * carries why, and which gate asks the question this one declines.
 *
 * A **commit**-keyed directory is skipped entirely: the checkout copy is an
 * artefact of whether `qa:fetch` ran. See {@link tipPresence}.
 *
 * ## The REVERSE direction, for state: `undeclared-state`
 *
 * A directory on disk that NO declaration names is invisible to the checks
 * above, which is fine except for a STATE graph: an undeclared `beans/` or
 * `todos/` on `main` leaves no reader able to ask where the work plan lives.
 * {@link auditUndeclaredState} reports a top-level directory at a
 * conventional state path (every `DEFAULT_DIRECTORIES` entry whose kinds all
 * `holds: "state"`) that the layer does not declare. It REPORTS: the
 * remedy is to declare it (with its `source`), never to remove it —
 * `deletion-requires-confirmation`.
 *
 * Exit codes: 0 clean · 1 any finding.
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import { DEFAULT_DIRECTORIES, instanceRootsIn, layerRootsIn, nestedDirectories, readDeclaration, rootForScope } from "../schemas/kg/cat-harness.js";
import type { DeclarationScope } from "../schemas/kg/kg-node.js";
import { defaultGraphTypologies } from "../schemas/kg/graph-typology-registry.js";
import {
  contentIsOffCheckout,
  resolveSubgraphSource,
  type ResolvedSubgraphSource,
  type SubgraphSource,
} from "../schemas/kg/subgraph-source.js";
// The marker format has ONE reader, in `branch-store.ts`. This gate asking
// `existsSync` on a path it spelled itself would be a second, and the two
// would drift the first time the marker moved — which it already did once,
// from `--git-common-dir` to the per-worktree git dir (review on #1957).
import { absenceAt, BranchStoreUsageError, markerAtPath, readMarker } from "./branch-store.ts";
import { mountChoiceOf } from "../schemas/kg/remote-mount.js";
// The `folio` graph typology is registered by CORE as a load-time side effect, so
// the harness alone does not know it exists and `readDeclaration` throws on a
// perfectly valid declaration that uses it. Same import, same reason, as
// `check-declared-assets.ts` and `kg-export.ts` carry.
import "../schemas/kg/folio-graph-typology.js";

export interface DirFinding {
  instance: string;
  id: string;
  path: string;
  /**
   * `unmountable` — the entry's content is declared on a branch TIP and no
   * mount can be keyed on it, because it is declared from within another
   * directory and is not `"subgraph": true`. Its own state, not a spelling of
   * `unmounted`: that one's remedy is `bun run cat state:mount`, and here that
   * command cannot reach the entry at all, so printing it would send a reader
   * to run something that does nothing. Bean `najo`.
   */
  kind: "absent" | "stale-exemption" | "mirror" | "not-cut-over" | "unmounted" | "unmountable" | "undeclared-state";
  detail: string;
  /**
   * Set on a NESTED entry: the declaration that holds it, instance-relative
   * (`docs/docs.json`), and the parent entry's id.
   *
   * Absent means the entry is in the layer's own `<instance>.json`. The
   * field exists because `detail` says *"drop the declaration"*, and a reader
   * who opens `<instance>.json` for a nested entry will not find it there —
   * a remedy pointing at the wrong file is worse than none.
   */
  nestedIn?: { file: string; parentId: string };
}

/**
 * Where `path` resolves, given the entry's `scope`.
 *
 * Exported because the resolution rule is the part a reader most needs to be
 * able to check, and the one this module has already got wrong once.
 */
export function resolveDeclaredPath(
  entry: { path: string; scope?: string },
  instanceRoot: string,
  repoRoot: string,
): string {
  return join(entry.scope === "repository" ? repoRoot : instanceRoot, entry.path);
}

/**
 * What this checkout can say about a directory kept at a branch TIP.
 *
 * Three answers, and **only one of them is a pass**:
 *
 * - **`not-cut-over`** — the declaration names the branch and the checkout
 *   still tracks files at the path, so the graph has two copies and nothing
 *   says which is authoritative. `mountTip` refuses precisely this state
 *   (*"is still tracked on this checkout's branch"*), so a declaration
 *   flipped ahead of the `git rm` leaves the mount permanently refusing while
 *   every reader goes on reading `main`. Bean `9ofm` measured both halves on
 *   `main@4622dc2a`: `branch-store.ts mount --id beans` refused with exit 5,
 *   and `state-mount.ts` — what the session-start hook calls — printed
 *   "Mounted" and exited **0** for the same declaration. This finding is the
 *   guard that makes the flip and the `git rm` one step rather than a state
 *   somebody can leave the repository in.
 * - **`unmounted`** — cut over, and nothing mounted here, so every reader of
 *   this path sees an empty graph. For the work plan that is an empty
 *   `beans list`, which is not evidence that there is no work.
 * - **`mounted`** — a marker for this id, and its mount on disk. It carries
 *   `into`, because the mount is wherever the marker says and not necessarily
 *   the declared path (`mountTip --into`), and a census that assumed the
 *   declared path would count zero files for a mount that is really there.
 *
 * Read from the mount MARKER and `git ls-files`, never from the branch: this
 * gate stays local and offline, so it cannot go red for a network reason and
 * cannot be made green by a fetch. "Could not ask" — no git directory, or a
 * marker that will not parse — is reported as `unmounted` with the reason,
 * because a gate that cannot determine presence has not determined presence.
 */
export function tipPresence(
  loc: { id: string; branch: string; keyedBy: string },
  abs: string,
  repoRoot: string,
  /**
   * The id the MOUNT MARKER is keyed on. Defaults to `loc.id`, which is right
   * for a layer's own entry and wrong for one declared from within: there
   * the composed `beans/queue` is the reader's id and `queue` is the mount's,
   * and `markerPath` refuses the former outright (bean `najo`).
   */
  markerId: string = loc.id,
): { state: "mounted"; into: string } | { state: "not-cut-over" | "unmounted"; detail: string } {
  const rel = relative(repoRoot, abs).split(sep).join("/") || ".";
  // input-site: tree #55f6272d — ls-files: the index
  const tracked = spawnSync("git", ["ls-files", "--", rel], { cwd: repoRoot, encoding: "utf-8" });
  if (tracked.status === 0 && tracked.stdout.trim()) {
    const n = tracked.stdout.trim().split("\n").length;
    return {
      state: "not-cut-over",
      detail:
        `declares \`storage.branch: "${loc.branch}"\` (keyed by ${loc.keyedBy}) and the checkout ` +
        `still tracks ${n} file(s) here, so the graph has two copies and nothing says which is ` +
        `authoritative. \`mountTip\` refuses this state, so the mount stays refused while every ` +
        `reader goes on reading this branch. Flipping the declaration and removing the files are ` +
        `ONE change (bean \`9ofm\`): land both, or neither.`,
    };
  }
  let marker;
  let markerRoot = repoRoot;
  try {
    // By PATH first. An id several layers of an index declare (`health`,
    // four times on 2026-10-11) is filed under `<instance>.<id>`, so the id
    // alone either finds none or finds another layer's mount; the declared
    // path is what says which graph this is. Then the id, as before — but a
    // marker for a DIFFERENT declared path is another graph's, not this one's.
    // Only where the mount lives is used below (`path`, `into`): read as a location (`read-projections.ts`).
    marker = markerAtPath(repoRoot, rel, "location");
    if (!marker) {
      // The path lookup above already answered for a marker at THIS path, so
      // an id several mounts share (`health`: several layers each mount
      // their own) is not ambiguous for this entry: none
      // of them is its graph. Refusing here reported cat-harness's own
      // `health` as "could not determine" in every joined instance run
      // (smart-ips-pilgrimage#13, cat-harness-tools#1701).
      let byId: ReturnType<typeof readMarker>;
      try {
        byId = readMarker(repoRoot, markerId, "location");
      } catch (err) {
        if (!(err instanceof BranchStoreUsageError)) throw err;
      }
      if (byId && (byId.path === undefined || byId.path === rel)) marker = byId;
    }
    if (!marker && abs) {
      try {
        // The same rule as the id lookup above: a marker for another declared
        // path is another graph's. Without it, a checkout-level graph
        // (cat-harness's `beans`, at `beans/`) took a mounted layer's own
        // graph of that id (`smart-trust-tools.beans`, at
        // `smart-trust-tools/beans/`) as its mount, and that layer's work plan
        // became the downstream checkout's (smart-ips-pilgrimage#25).
        const fromWithin = readMarker(dirname(abs), markerId, "location");
        const relWithin = relative(dirname(abs), abs).split(sep).join("/");
        if (fromWithin && (fromWithin.path === undefined || fromWithin.path === relWithin || fromWithin.path === rel)) {
          marker = fromWithin;
          markerRoot = dirname(abs);
        }
      } catch {
        // fallback failed
      }
    }
  } catch (err) {
    return {
      state: "unmounted",
      detail: `could not determine whether ${loc.branch} is mounted here: ${(err as Error).message}. Not a pass — nothing read this path.`,
    };
  }
  const into = marker ? resolve(markerRoot, marker.into) : undefined;
  if (into && existsSync(into)) return { state: "mounted", into };
  return {
    state: "unmounted",
    detail:
      `is cut over to \`${loc.branch}\` and ${marker ? `its marker points at ${marker.into}, which is gone` : "nothing is mounted here"}, ` +
      `so every reader of this path sees an EMPTY graph rather than an unreachable one. ` +
      `Mount it (\`bun run cat state:mount\`); "no content" and "could not reach the content" are different answers.`,
  };
}

/**
 * What this checkout can say about a directory kept per published ROUTE.
 *
 * **Two answers, not three**, and the missing one is the whole point of having a
 * separate function rather than a `keyedBy` branch inside {@link tipPresence}:
 *
 * - **`not-cut-over`** — identical to the tip case, and for an identical reason.
 *   The declaration names a branch, the checkout still tracks files at the path,
 *   so the graph has two copies and nothing says which is authoritative. Bean
 *   `9ofm`'s guard is about TWO COPIES, and route-keying does not change how many
 *   there are.
 * - **`off-checkout`** — the files are not tracked here. **Not a finding**, and
 *   not a pass dressed as one either: it is this gate declining a question it
 *   cannot ask. There is nothing further to measure locally, because…
 *
 * ## …there is no `unmounted` for a route store, and that is not a gap
 *
 * `tipPresence`'s third state reads the mount MARKER. A route store has no
 * mount: `tipLocations` defaults to `keyedBy: "tip"` and `state-mount.ts` takes
 * that default, so a route entry is never a mount candidate, and `mountTip`
 * itself reads no `keyedBy` at all — pointed at a route branch it opens a
 * tip-keyed store and `verifiedTip` answers **`corrupt`** (measured against the
 * seeded `cat/cat-harness/uml-overview`, whose manifest is route-keyed). So "cut
 * over and nothing mounted here" is not a state a route store can be in;
 * reporting it would be a finding against a mechanism that does not exist, and
 * one nobody could ever clear.
 *
 * **What replaces it is a different gate, not a missing branch here.** Whether
 * the branch actually carries the routes is answered by the route's own
 * generator `--check` — `route-authority.ts`'s `compareRoute`, which reports
 * `unknown` and refuses to pass when it cannot fetch. That question needs the
 * network. This gate is deliberately offline (`tipPresence`: *"it cannot go red
 * for a network reason and cannot be made green by a fetch"*), so answering it
 * here would mean giving this gate a second posture. Two gates, one each.
 */
export function routePresence(
  loc: { id: string; branch: string; keyedBy: string },
  abs: string,
  repoRoot: string,
): { state: "off-checkout" } | { state: "not-cut-over"; detail: string } {
  const rel = relative(repoRoot, abs).split(sep).join("/") || ".";
  // input-site: tree #55f6272d — ls-files: the index
  const tracked = spawnSync("git", ["ls-files", "--", rel], { cwd: repoRoot, encoding: "utf-8" });
  if (!(tracked.status === 0 && tracked.stdout.trim())) return { state: "off-checkout" };
  const n = tracked.stdout.trim().split("\n").length;
  return {
    state: "not-cut-over",
    detail:
      `declares \`storage.branch: "${loc.branch}"\` (keyed by route) and the checkout still tracks ` +
      `${n} file(s) here, so the graph has two copies and nothing says which is authoritative. ` +
      `For a ROUTE store that is worse than ambiguous: the site build serves whichever copy its path ` +
      `resolves to, and the generator's \`--check\` compares against the BRANCH, so the two disagree ` +
      `silently. Flipping the declaration and removing the files are ONE change (bean \`9ofm\`): land ` +
      `both, or neither.`,
  };
}

/**
 * The directories this layer declares it BUILDS AT PUBLISH (`builtAtPublish`,
 * `schemas/kg/built-at-publish.ts`; owner, 2026-10-14, "B1"), as absolute paths
 * ending in the separator. A declared directory among them is never on disk in
 * a checkout that has not run `derive:publish`, and that is its correct state,
 * not an `absent` one: whether the publish step built it is
 * `derive:publish`'s question, which it answers by refusing an entry that came
 * out empty.
 */
export function builtAtPublishDirs(instanceRoot: string): Set<string> {
  const decl = readDeclaration(instanceRoot) as { builtAtPublish?: Array<{ path: string }> } | undefined;
  return new Set(
    (decl?.builtAtPublish ?? []).filter((e) => e.path.endsWith("/")).map((e) => resolve(instanceRoot, e.path) + sep),
  );
}
const isBuiltAtPublishDir = (dirs: ReadonlySet<string>, abs: string): boolean => dirs.has(resolve(abs) + sep);

/**
 * @param otherInstances every layer root in the checkout; a
 *   repository-scoped entry inside one of them other than the declaring
 *   layer is a `mirror`. A layer that CONTAINS the declaring one (the
 *   checkout's root layer) is not "other" for this purpose — every path is
 *   inside it.
 */
/**
 * Entries this run found NOT APPLICABLE to this checkout, with the reason:
 * platform state a mounted layer declares for every checkout, which this root
 * neither declares nor carries (cat-harness-tools#1701). Neither a pass nor a
 * finding: printed, and counted apart from both.
 */
export const notApplicable: Array<{ instance: string; id: string; path: string; reason: string }> = [];

export function auditInstance(
  instanceRoot: string,
  repoRoot: string,
  otherInstances: readonly string[] = [],
): DirFinding[] {
  const decl = readDeclaration(instanceRoot) as
    | {
        directories?: Array<{
          id: string;
          path: string;
          scope?: string;
          absent?: { reason: string };
          storage?: { branch: string; keyedBy?: string };
          source?: SubgraphSource;
        }>;
      }
    | undefined;
  if (!decl?.directories) return [];

  const findings: DirFinding[] = [];
  const publishTime = builtAtPublishDirs(instanceRoot);
  for (const e of decl.directories) {
    const abs = resolveDeclaredPath(e, instanceRoot, repoRoot);
    if (isBuiltAtPublishDir(publishTime, abs)) continue;
    // A FILE at the declared path is not the directory being there. Checking
    // `existsSync` alone would pass on one, and a consumer that calls
    // `readdirSync` on it throws rather than reporting an empty graph.
    const present = existsSync(abs) && statSync(abs).isDirectory();

    // Content off the checkout — `source: { kind: "branch" }` or the legacy
    // `storage` (beans `16ei`, `l4ay`). `contentIsOffCheckout` is the cheap,
    // throw-free question: is this entry's content elsewhere at all. It is
    // asked FIRST so the common case costs nothing.
    if (contentIsOffCheckout(e)) {
      // A layer's OWN entry is listed under its own id, so the mount
      // marker is keyed on exactly that.
      findings.push(...offCheckoutFindings(e, abs, instanceRoot, repoRoot, e.id));
      continue;
    }
    if (!present && !e.absent && e.scope === "repository" && resolve(instanceRoot) !== resolve(repoRoot)) {
      // Checkout-level state a MOUNTED layer declares for every checkout
      // (cat-harness's `uploads/`), and this checkout's root did not declare
      // or create it. Not this root's defect; it says so instead of failing
      // (cat-harness-tools#1701). A root that wants it declares or creates it.
      notApplicable.push({
        instance: instanceRoot,
        id: e.id,
        path: e.path,
        reason: `checkout-level state declared for every checkout by ${basename(instanceRoot)}, not by this root, and not on disk here; declare it at the root to keep it here`,
      });
    } else if (!present && !e.absent && mountChoiceOf(instanceRoot, abs)?.chosen === false) {
      // The mount that placed this layer did not take this directory: a
      // whole mount leaves out an opt-in sub-graph this checkout has not
      // enabled (its lock's `except`), or a partial mount never chose it.
      // Nothing is missing here; the upstream keeps it.
      notApplicable.push({ instance: instanceRoot, id: e.id, path: e.path, reason: "not taken by the mount that placed this layer (its lock leaves it out)" });
    } else if (!present && !e.absent) {
      findings.push({
        instance: instanceRoot,
        id: e.id,
        path: e.path,
        kind: "absent",
        detail:
          `declared and not on disk. Create it, drop the declaration, or record ` +
          `\`"absent": { "reason": "…" }\` saying why it is meant to be missing.`,
      });
    }
    if (e.scope === "repository") {
      const target = resolve(abs);
      const self = resolve(instanceRoot);
      const owner = otherInstances
        .map((r) => resolve(r))
        .filter((r) => r !== self && !(self + sep).startsWith(r === sep ? r : r + sep))
        .find((r) => target === r || target.startsWith(r + sep));
      if (owner !== undefined) {
        findings.push({
          instance: instanceRoot,
          id: e.id,
          path: e.path,
          kind: "mirror",
          detail:
            `a repository-scoped entry inside another instance (${basename(owner)}). ` +
            `That instance declares its own directories and the checkout aggregates ` +
            `them (bean \`cmsl\`): drop this entry, and if a corpus-wide tool then ` +
            `misses the directory, the root instance must \`need\` ${basename(owner)}.`,
        });
      }
    }
    if (present && e.absent) {
      findings.push({
        instance: instanceRoot,
        id: e.id,
        path: e.path,
        kind: "stale-exemption",
        detail:
          `declares \`absent\` — "${e.absent.reason}" — but the directory exists. ` +
          `The exemption has outlived its cause; remove it.`,
      });
    }
  }
  return findings.concat(auditNested(instanceRoot, repoRoot, decl));
}

/** The conventional STATE paths: a `DEFAULT_DIRECTORIES` entry whose every kind `holds: "state"`. */
export function conventionalStateDirectories(): Array<{ id: string; path: string; kinds: readonly string[] }> {
  return DEFAULT_DIRECTORIES
    .filter((d) => (d.graphTypologies ?? []).length > 0 &&
      (d.graphTypologies ?? []).every((k) => defaultGraphTypologies.get(k)?.holds === "state"))
    .map((d) => ({ id: d.id, path: d.path, kinds: d.graphTypologies ?? [] }));
}

/** The conventional directory a layer may keep as repository data, outside its KG (owner, 2026-11-03). */
export const UPLOADS_DATA_STORE_ID = "uploads";

/**
 * `undeclared-state` — a conventional state directory (`beans/`, `todos/`)
 * present at the top of a layer and named by none of its own entries.
 * See the module docblock. Any entry covering the path counts, whatever its
 * id or source: the question is whether ANY declaration says what this
 * directory is, not whether it says the right thing.
 */
export function auditUndeclaredState(instanceRoot: string, repoRoot: string): DirFinding[] {
  let decl: { directories?: Array<{ path: string; scope?: string }> } | undefined;
  try {
    decl = readDeclaration(instanceRoot) as typeof decl;
  } catch {
    return []; // an unreadable declaration is `check:harness-dirs`'s to report
  }
  if (!decl) return []; // no declaration at all: the conventional defaults apply, so nothing is undeclared
  const covered = new Set((decl.directories ?? []).map((e) => resolve(resolveDeclaredPath(e, instanceRoot, repoRoot))));
  const out: DirFinding[] = [];
  for (const d of conventionalStateDirectories()) {
    // An undeclared `uploads/` is the repository's own data store, not a
    // graph: owner, 2026-11-03, *"instantiated harnesses can have an uploads/
    // but that is data store for that repo, not part of the KG"*. Declaring it
    // is still allowed; leaving it undeclared is not a finding.
    if (d.id === UPLOADS_DATA_STORE_ID) continue;
    const abs = resolve(instanceRoot, d.path);
    if (!existsSync(abs) || !statSync(abs).isDirectory() || covered.has(abs)) continue;
    out.push({
      instance: instanceRoot,
      id: d.id,
      path: d.path,
      kind: "undeclared-state",
      detail:
        `a ${d.kinds.join("/")} STATE directory on disk that ${basename(instanceRoot) || instanceRoot}'s declaration ` +
        `does not name, so nothing can say where this graph lives or whether it belongs on a branch. Declare it — ` +
        `\`{ "id": "${d.id}", "path": "${d.path}", "graphTypologies": ${JSON.stringify(d.kinds)}, "source": … }\`, ` +
        `with \`source: { kind: "branch", branch: "cat/<instance>/${d.id}", keyedBy: "tip" }\` for the default ` +
        `(the \`directory-conventions\` skill). Nothing is removed: moving the content off main is the owner's call.`,
    });
  }
  return out;
}

/**
 * The same two directions, over the entries a declaration declares FROM
 * WITHIN — `docs/docs.json`, `beans/beans.json`, `voices/voices.json`.
 *
 * ## Why this is a second function and not a longer loop
 *
 * Nested entries differ in three ways that each need saying once rather than
 * as a branch inside the loop above. They carry no `scope`: `walkNested`
 * composes the path from the parent's, so it is already instance-relative and
 * there is nothing to resolve. They therefore cannot be a `mirror` — that
 * finding is about a `scope: "repository"` path landing inside another
 * layer, which a composed path cannot do. And the remedy differs, because
 * the entry is in a different file.
 *
 * ## The gap it closes, measured
 *
 * The loop above reads `decl.directories` — a layer's TOP-LEVEL entries
 * only — and the summary counted the same list, so a nested entry was neither
 * checked nor counted. Measured 2026-10-03 by pointing a real nested entry at
 * `assets/img/uml/NOPE`:
 *
 *     111 declared director(ies) across 15 instance(s); 0 finding(s)   exit=0
 *
 * identical to the sound path, and identical to the tree before the entry
 * existed. **That is the `dh4f` shape inside the checker written to prevent
 * it** — this module's own docblock opens by saying a declaration into thin air
 * makes every consumer "report a clean run over nothing", and five entries in
 * `cat-harness/docs/docs.json` were exactly that: `proposals`, `requirements`,
 * `auto-docs` and the two uml routes (bean `xsrv`).
 *
 * It also explains a thing reported on #2022 as a quirk: `audit:coverage` calls
 * `auto-docs` `no-directory` because nothing resolved a nested path for
 * presence.
 *
 * `nestedDirectories` walks to any depth and guards a declaration naming its
 * own directory, so this inherits both rather than restating them.
 */
/** How many entries a declaration declares from within, at any depth. */
function auditNestedCount(
  instanceRoot: string,
  decl: { directories?: unknown[] } | undefined,
): number {
  return nestedDirectories(instanceRoot, decl as Parameters<typeof nestedDirectories>[1]).length;
}

/**
 * The declaration a nested entry actually lives in: its parent's directory,
 * plus the `declarationFile` the parent's own kind names.
 *
 * **Derived, because the obvious shortcut is wrong.** Stripping the last
 * segment of the nested entry's path looks right and is not: a nested path may
 * be several segments deep, so `assets/img/uml/overview` yields
 * `assets/img/uml/` — a directory holding no declaration at all. Measured on
 * the first version of this function, whose finding sent a reader to exactly
 * that path. `declarationFile` on the kind is the one place that fact lives
 * (`graph-typology-registry.ts`), which is why it is asked rather than assumed.
 *
 * Returns the parent's directory alone when the parent's kind names no
 * `declarationFile` — nothing else is known, and naming a file that may not
 * exist would be the same defect one level along.
 */
function declaringFile(
  parentId: string,
  byId: ReadonlyMap<string, { path: string; graphTypologies: readonly string[] }>,
): string {
  const parent = byId.get(parentId);
  if (!parent) return "(the declaration naming it)";
  const dir = `${parent.path.replace(/\/+$/, "")}/`;
  const file = parent.graphTypologies.map((g) => defaultGraphTypologies.get(g)?.declarationFile).find((f) => typeof f === "string");
  return file === undefined ? dir : `${dir}${file}`;
}

/**
 * The findings for an entry whose content is OFF the checkout, by keying.
 *
 * Extracted from the sweep so the nested pass cannot answer this differently
 * (bean `xsrv`). It is the divergence that matters, not the duplication: the
 * first version of `auditNested` wrote `if (contentIsOffCheckout(e)) continue`,
 * so a nested stored directory got the silent skip while an identical top-level
 * one got the three states below. Two answers to one question, decided by where
 * the entry happened to be declared.
 *
 * ...and WHICH elsewhere, because the keyings are not the same question and
 * treating them alike is what bean `9ofm` measured going wrong.
 *
 * `commit`-keyed is qa-store's layout: the checkout holds at most a working
 * copy whose size depends on whether `qa:fetch` ran, so its absence IS the
 * declared state and its presence is not a stale exemption either. Neither
 * direction applies — skipped.
 *
 * A branch TIP is deterministic, so skipping it would be `1xhc`: a reader of
 * this path sees nothing, and "no content" and "could not reach the content"
 * would be indistinguishable from here. See {@link tipPresence}.
 *
 * **`route` is HALF of the tip question, and only half.** This paragraph said
 * "skipped too, and that is a decision rather than an omission", with the right
 * reason for the wrong scope: there is no route-keyed mount — `tipLocations`
 * defaults to `tip` and `state-mount.ts:168` takes that default, so a route entry
 * is never a mount candidate — and `unmounted` really would be a verdict about a
 * mechanism that does not exist. But `not-cut-over` is not about a mount. It is
 * about TWO COPIES, and a route-keyed declaration whose files are still tracked
 * here has exactly two, the same as a tip-keyed one. Skipping the keying skipped
 * both halves and only one of them was meant to go.
 *
 * That paragraph also said the question arrives "when `xsrv` cuts a reader over —
 * and at that point this is the one place to add it". This is that point, and
 * this is that place. See {@link routePresence}.
 */
function offCheckoutFindings(
  e: { id: string; path: string; absent?: { reason: string } },
  abs: string,
  instanceRoot: string,
  repoRoot: string,
  /**
   * The id a MOUNT of this directory is keyed on, when that is not `e.id`.
   *
   * `null` means "no mount can be keyed on this entry at all" — a nested
   * entry that is not `"subgraph": true`, which `resolveDirectories` does not
   * list, so `tipLocations` never sees it and `state:mount` cannot reach it.
   * That is a DIFFERENT finding from an unmounted one, because "mount it" is
   * not a remedy that exists: see {@link DirFinding}'s `unmountable`.
   *
   * It is passed rather than derived because the two spellings of a nested
   * entry's id are both legitimate — `nestedDirectories` composes
   * `beans/queue` so a reader can see who declares it, and
   * `promoteFromWithin` lists it as `queue` so an instance-level consumer can
   * find it — and only the caller knows which it is holding. Deriving the
   * marker id here from `e.id` is what produced the `najo` measurement: a
   * mounted graph read as `unmounted` because `markerPath` refuses a slash.
   *
   * REQUIRED, and `null` rather than `undefined`, because a default would be
   * taken by a caller that passed `undefined` deliberately: `mountId = e.id`
   * made the `unmountable` branch unreachable from `auditNested`, and the test
   * for it failed with `unmounted` — which is the misdirecting remedy the
   * branch exists to avoid.
   */
  mountId: string | null,
): DirFinding[] {
  let src: ResolvedSubgraphSource;
  try {
    src = resolveSubgraphSource(e);
  } catch (err) {
    // The resolver throws on a contradiction a reader must not paper over
    // (both fields, or a tip-keyed `qa`). It is a finding here rather than a
    // crash, so one bad entry does not take the whole sweep with it — and
    // `unmounted` is the honest state: nothing read this path.
    return [{ instance: instanceRoot, id: e.id, path: e.path, kind: "unmounted", detail: (err as Error).message }];
  }
  // A FAMILY (bean `lehh`) is on its branches by declaration and mounted one
  // member at a time, so an absent path is the expected state, not a finding —
  // fsh-guts' precedent, without a single tip to compare against.
  if (src.kind === "family") return [];
  if (src.kind !== "branch") return [];
  if (src.keyedBy === "route") {
    const r = routePresence(src, abs, repoRoot);
    return r.state === "off-checkout" ? [] : [{ instance: instanceRoot, id: e.id, path: e.path, kind: r.state, detail: r.detail }];
  }
  if (src.keyedBy !== "tip") return [];
  if (mountId === null) {
    return [
      {
        instance: instanceRoot,
        id: e.id,
        path: e.path,
        kind: "unmountable",
        detail:
          `declares its content on \`${src.branch}\` (keyed by tip) and is declared FROM WITHIN another ` +
          `directory WITHOUT \`"subgraph": true\`, so \`resolveDirectories\` does not list it, ` +
          `\`tipLocations\` never sees it and \`bun run cat state:mount\` cannot reach it. A mount is keyed ` +
          `on a directory ID, and this entry has none at instance level. Mark it \`"subgraph": true\` ` +
          `(bean \`cmsl\`), or move the \`source\` onto the directory that declares it. Reporting this as ` +
          `\`unmounted\` would print a remedy that does not exist.`,
      },
    ];
  }
  const t = tipPresence(src, abs, repoRoot, mountId);
  if (t.state === "mounted") return [];
  // Not applicable here, and determined so rather than assumed: `state:mount`
  // recorded that this checkout does not keep the graph (declared for every
  // checkout by a mounted layer, not by this root, and its remote carries no
  // such branch). An instance that never declared the platform's state is not
  // missing it (cat-harness-tools#1701). A root that declares it, or a remote
  // that carries the branch, has no such record and is judged as before.
  if (t.state === "unmounted") {
    // By path only: an id several mounts share must not borrow another graph's record.
    const absent = absenceAt(repoRoot, relative(repoRoot, abs).split(sep).join("/"));
    if (absent) {
      notApplicable.push({ instance: instanceRoot, id: e.id, path: e.path, reason: absent.reason });
      return [];
    }
  }
  return [{ instance: instanceRoot, id: e.id, path: e.path, kind: t.state, detail: t.detail }];
}

export function auditNested(
  instanceRoot: string,
  repoRoot: string,
  decl: { directories?: ReadonlyArray<{ id: string; path: string; graphTypologies?: readonly string[] }> } | undefined,
): DirFinding[] {
  const findings: DirFinding[] = [];
  const publishTime = builtAtPublishDirs(instanceRoot);
  // `nestedDirectories` wants the whole declaration shape; only `directories`
  // is read, and a structural parameter keeps this callable from a test
  // fixture that has no reason to carry a layer `name`.
  const nested = nestedDirectories(instanceRoot, decl as Parameters<typeof nestedDirectories>[1]);
  // Every entry a parent id can name: the layer's own, then the nested ones
  // (`walkNested` goes to any depth, so a parent may itself be nested).
  const byId = new Map<string, { path: string; graphTypologies: readonly string[] }>();
  for (const d of decl?.directories ?? []) byId.set(d.id, { path: d.path, graphTypologies: d.graphTypologies ?? [] });
  for (const n of nested) byId.set(n.id, { path: n.path, graphTypologies: n.graphTypologies });
  // A nested entry's path is relative to the same root its TOP-LEVEL ancestor
  // resolves against — `nestedDirectories` reads the nested declaration from
  // there (`rootForScope`), so judging the entry anywhere else reports a
  // directory as absent that is on disk. It mattered once a non-root layer
  // could declare a `scope: "repository"` graph: cat-harness declares the
  // index checkout's `beans/` and `todos/`, and their nested `defs/`, `items/`
  // and the rest were looked for under `cat-harness/`.
  const parentOf = new Map(nested.map((n) => [n.id, n.parentId] as const));
  const topScope = new Map((decl?.directories ?? []).map((d) => [d.id, (d as { scope?: DeclarationScope }).scope] as const));
  const baseFor = (id: string): string => {
    let at = id;
    for (let guard = 0; parentOf.has(at) && guard < 64; guard++) at = parentOf.get(at)!;
    return rootForScope(instanceRoot, topScope.get(at));
  };
  for (const n of nested) {
    const e = n as typeof n & { absent?: { reason: string }; storage?: { branch: string }; source?: SubgraphSource };
    const abs = join(baseFor(n.id), n.path);
    if (isBuiltAtPublishDir(publishTime, abs)) continue;
    if (contentIsOffCheckout(e)) {
      // The same answers a top-level entry gets, from the same function — but
      // keyed on the id the MOUNT uses, which for a from-within entry is its
      // own id and not the composed one this walk reports under. A
      // `"subgraph": true` entry is listed by `resolveDirectories` under
      // `ownId` (bean `cmsl`), so that is what `state:mount` wrote its marker
      // as; an entry without the marker has no instance-level id at all, and
      // `undefined` is how `offCheckoutFindings` is told to say so rather
      // than to print a remedy that cannot work. Bean `najo`.
      findings.push(
        ...offCheckoutFindings(
          { ...e, id: n.id, path: n.path },
          abs,
          instanceRoot,
          repoRoot,
          n.subgraph === true ? n.ownId : null,
        ),
      );
      continue;
    }
    const present = existsSync(abs) && statSync(abs).isDirectory();
    const where = { file: declaringFile(n.parentId, byId), parentId: n.parentId };
    // Left out by the mount that placed this layer (an opt-in sub-graph this
    // checkout has not enabled, in the lock's `except`): not missing here.
    if (!present && !e.absent && mountChoiceOf(instanceRoot, abs)?.chosen === false) continue;
    if (!present && !e.absent) {
      findings.push({
        instance: instanceRoot,
        id: n.id,
        path: n.path,
        kind: "absent",
        detail:
          `declared FROM WITHIN and not on disk. Create it, drop the nested entry, or ` +
          `record \`"absent": { "reason": "…" }\` on it. It is NOT in this instance's ` +
          `own declaration — look in the declaration under \`${where.file}\`.`,
        nestedIn: where,
      });
    }
    if (present && e.absent) {
      findings.push({
        instance: instanceRoot,
        id: n.id,
        path: n.path,
        kind: "stale-exemption",
        detail:
          `a nested entry declares \`absent\` — "${e.absent.reason}" — but the directory ` +
          `exists. The exemption has outlived its cause; remove it from the declaration ` +
          `under \`${where.file}\`.`,
        nestedIn: where,
      });
    }
  }
  return findings;
}

if (import.meta.main) {
  const repoRoot = process.cwd();
  const instances = layerRootsIn(repoRoot);
  let findings: DirFinding[] = [];
  let declared = 0;
  let exempt = 0;
  let nestedCount = 0;

  for (const inst of instances) {
    const decl = readDeclaration(inst) as { directories?: unknown[] } | undefined;
    declared += decl?.directories?.length ?? 0;
    exempt += (decl?.directories as Array<{ absent?: unknown }> | undefined)?.filter((d) => d.absent).length ?? 0;
    // Counted SEPARATELY, never folded into `declared`. The two numbers answer
    // different questions — how many directories a layer declares, and how
    // many more are declared from within one of them — and a single total would
    // hide the second behind the first, which is how the nested entries went
    // unchecked in the first place. A zero here is also a fact worth printing:
    // it says this checkout has no from-within declaration, not that the walk
    // was skipped.
    nestedCount += auditNestedCount(inst, decl);
    findings = findings.concat(auditInstance(inst, repoRoot, instances), auditUndeclaredState(inst, repoRoot));
  }

  for (const f of findings) {
    console.error(`  ✗ ${basename(f.instance) || f.instance}/${f.id} (${f.path}): ${f.kind} — ${f.detail}`);
  }
  for (const n of notApplicable) {
    console.log(`  · ${basename(n.instance) || n.instance}/${n.id} (${n.path}): not applicable here — ${n.reason}`);
  }
  console.log(
    // NAMED, not just counted — `check:declared-assets` records why: a bare
    // count reads as success until you know how many layers there were.
    `${declared} declared director(ies) across ${instances.length} instance(s) ` +
      `(${instances.map((p) => basename(p) || p).sort().join(", ")}) ` +
      `plus ${nestedCount} declared FROM WITHIN one of them; ` +
      `${exempt} declared absent with a reason; ${notApplicable.length} not applicable here; ${findings.length} finding(s)`,
  );
  process.exit(findings.length > 0 ? 1 : 0);
}

export { layerRootsIn, instanceRootsIn, resolve };
