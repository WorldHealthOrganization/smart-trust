#!/usr/bin/env bun
/**
 * state-mount — put the state branch on disk, or say loudly that it is not there.
 *
 * @module scripts/state-mount
 * @graphNode none — a session-start step over a declared `storage` directory
 * @covers none — it MAKES graphs readable and judges none of them. It runs as
 * a gate in `code-quality-gates.yml` before the bean gates, but claiming
 * `beans` coverage would let the gates that actually judge the store be
 * removed without the census noticing.
 *
 * The session-start hook calls this; it is also `bun run cat state:mount` by
 * hand.
 *
 * ## Every failure is LOUD
 *
 * An empty work-plan and an unreachable work-plan look identical to an agent.
 * So every failure here is a non-zero exit and a block on stdout — the hook's
 * stdout IS the agent's context — that says in as many words that an empty
 * `beans list` must not be believed.
 *
 * ## A branch PER GRAPH
 *
 * Each declared tip-keyed directory lives on the branch ITS OWN declaration
 * names, and is mounted at ITS OWN declared path. This module contributes only
 * the FAN-OUT: every mount is {@link mountTip}'s (`branch-store.ts`, reached
 * by hand as `branch-store.ts mount --id <directory-id>`), which round-trips
 * bytes, modes and symlinks and keeps a per-worktree marker. `beans` reads
 * `beans/defs` off a disk, and a mount at the declared path serves it.
 *
 * ## Which graphs: the RESOLVED source
 *
 * {@link tipLocations} reads each declaration's resolved source — a config
 * override, then `source`, then the legacy `storage` — so a graph declared
 * `source: { kind: "branch", keyedBy: "tip" }` is mounted, a `directory`
 * source is the checkout itself, and a `commit`-keyed branch is qa-store's,
 * not a mount's.
 *
 * ## It is inert until the cutover, and that is not a failure
 *
 * While no declaration keeps a graph at a branch tip, {@link tipLocations} is
 * empty and this reports `not-enabled` and exits 0, so the loud case stays
 * meaningful.
 *
 * ## A missing OWN branch is created: the mount is the layer's initialization
 *
 * Owner, 2026-11-17: the state branches a layer declares are made upon
 * initialization by the layer that needs them. So the CLI (and the
 * session-start hook, which runs it) creates a branch the ROOT layer declares
 * and its own remote lacks, seeded empty with the standard layout
 * (`state-branch-init.ts`, the same code as `state:seed --init`), and then
 * mounts it. A mounted dependency's branch is never created here: its miss
 * names the dependency's repository and the command to run there. A push
 * this token may not make is one line naming `state:seed --init`. `--no-init`
 * or `CAT_STATE_INIT=0` turns the creation off; CI's direct `mountState({})`
 * never creates, because its origin points at pinned mirrors.
 *
 * ## It never discards work
 *
 * A mount holding unpushed edits is left exactly as it is and reported
 * `stale`, never re-read over. `stale` is NOT a failure: the graph is still on
 * disk and readable.
 *
 * ## One graph failing must not let the others read clean
 *
 * The aggregate keeps three answers apart — every graph mounted, SOME mounted
 * and these named ones did not, and "could not determine". A failing graph
 * never stops its siblings being mounted, and the process exits non-zero when
 * anything failed, because `session-start-coord-sweep.sh` calls this with
 * `|| true` and the printed block and the exit status are then the only
 * carriers of the finding.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  clearAbsence,
  locationKey,
  markerFor,
  migrateMarkerInto,
  mountEmptyingReason,
  mountMassDeletionReason,
  mountTip,
  namespaceCarried,
  pendingMountChanges,
  recordAbsence,
  resolveMarkerInto,
  tipLocations,
  type BranchStoreOptions,
  type TipLocation,
} from "./branch-store.js";
import { layerRootsIn, nestedDirectories, readDeclaration } from "../schemas/kg/cat-harness.js";
import { tools } from "../tools/discover.js";
import { exitCode as remoteExitCode, remoteFanOut } from "./remote-mount.ts";
import { dependencyRemedy, initEnabled, initLocation, initRemedy, ownStateLocations } from "./state-branch-init.ts";

/**
 * One declared graph's outcome in the fan-out. `state` is {@link mountTip}'s
 * verdict, carried through verbatim rather than flattened to a boolean, so a
 * `miss` (determined absent), a `corrupt` branch and an `unknown` (could not
 * ask — **never** a pass) stay three different answers.
 *
 * `stale` is this module's one addition: {@link mountTip} returns `refused`
 * both for a prior mount holding unpushed edits and for a path it must not
 * clobber, and only the first means the graph is nevertheless on disk and
 * readable. Separating them is what lets a session with edits in flight exit
 * 0 without that silence also covering a graph that is simply not there — so
 * it is decided by ASKING for the pending edits before mounting, not inferred
 * from a refusal plus a marker: a marker is also present when the refusal is
 * that the path is still tracked, and that graph is not mounted at all.
 */
interface GraphMountBase {
  /** The graph's marker key: its id, or `<instance>.<id>` when several layers declare that id. */
  id: string;
  /** Repository-relative, as declared — where the files were put. */
  path: string;
  branch: string;
  reason: string;
}

/**
 * A mounted graph ALWAYS has the tip it was read at, and a graph that is not
 * mounted never pretends to one. That is why this is a union rather than one
 * interface with `tip?: string`: an optional tip makes "mounted" and "has a
 * tip" two facts that can disagree, and every reader then has to handle a
 * state the mount cannot actually be in.
 */
export type GraphMount =
  | (GraphMountBase & { state: "mounted"; tip: string; files?: number })
  | (GraphMountBase & { state: "stale"; damaged?: boolean })
  | (GraphMountBase & { state: "refused" | "miss" | "corrupt" | "unknown" })
  /**
   * A checkout-level (`scope: "repository"`) graph that a mounted layer
   * declares, that the root does not declare, and whose branch the root's
   * `origin` does not carry, where that origin carries NO branch of the
   * graph's namespace either ({@link TipLocation.unownedBy},
   * {@link namespaceCarried}). The graph does not exist in this checkout, and
   * nothing at the root said it should. Owner, 2026-10-14 (smart-ra#59,
   * `issue-marks`): "Report as absent", not as a miss; then "Tighten it"
   * (cat-harness-tools#249): a remote that keeps other branches of that
   * namespace has adopted it (folio-assistant), so a missing one there stays
   * a `miss`. Only a determined `miss` becomes this: a graph that could not be
   * asked about (`unknown`) or is `corrupt` stays a failure.
   */
  | (GraphMountBase & { state: "absent"; declaredBy: string });

/** A graph whose files are on disk and readable, whether or not it just moved. */
export function isPresent(g: GraphMount): boolean {
  return g.state === "mounted" || g.state === "stale";
}

/** A graph the mount accounts for: present, or determined absent where the root never asked for it. Everything else is a failure. */
export function isSettled(g: GraphMount): boolean {
  return isPresent(g) || g.state === "absent";
}

export type MountResult =
  | { state: "not-enabled"; reason: string; locations: TipLocation[]; graphs: GraphMount[] }
  /** Every graph that was asked for is present. */
  | { state: "mounted"; reason: string; locations: TipLocation[]; graphs: GraphMount[] }
  /** SOME graphs are present and at least one is not. Exits non-zero: the ones that failed are named. */
  | { state: "partial"; reason: string; locations: TipLocation[]; graphs: GraphMount[] }
  | { state: "failed"; reason: string; locations: TipLocation[]; graphs: GraphMount[] };

export interface MountOptions {
  repoRoot?: string;
  /** Mount only the graphs with this declared directory id — every one of them — or the one with this key (`<instance>.health`). */
  id?: string;
  /** Passed to `BranchStore.open` — tests point it at a scratch store. */
  store?: BranchStoreOptions;
  /**
   * The state of the layer mounts against `index.lock.json`, when the caller
   * already has it (the CLI's remote fan-out ran first). Absent, it is ASKED
   * ({@link staleLayerMounts}, check mode, no network). Either way the
   * `.gitignore` block is rewritten only over current layer mounts.
   */
  layerMounts?: Parameters<typeof remoteExitCode>[0];
  /**
   * Create a MISSING state branch the root layer itself declares, seeded with
   * the standard layout (`state-branch-init.ts`), then mount it. Off unless
   * asked: the CLI (and so the session-start hook) asks, unless
   * `--no-init` or `CAT_STATE_INIT=0`. CI calls {@link mountState} directly
   * with its origin rewritten to pinned mirrors, where a push would land in
   * the mirror, so it does not. A mounted dependency's branch is never created
   * from here, whatever this says.
   */
  initMissing?: boolean;
}

function git(cwd: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return { status: r.status ?? 128, stdout: r.stdout ?? "", stderr: r.stderr ?? String(r.error ?? "") };
}

export function repoRootOf(cwd = process.cwd()): string {
  const r = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (r.status !== 0) throw new Error(`not inside a git checkout: ${cwd}`);
  return r.stdout.trim();
}

/**
 * Mount every declared tip-keyed directory, each from the branch its own
 * declaration names and at its own declared path. Never throws for an
 * expected state.
 */
export function mountState(opts: MountOptions = {}): MountResult {
  const root = opts.repoRoot ?? repoRootOf();
  let locations: TipLocation[];
  try {
    locations = tipLocations(root);
  } catch (e) {
    // Could not ask. Never a pass: the declarations are the only thing that
    // says which graphs should be here at all.
    return { state: "failed", reason: `could not read the directory declarations: ${(e as Error).message}`, locations: [], graphs: [] };
  }
  if (opts.id !== undefined) {
    locations = locations.filter((l) => l.id === opts.id || l.key === opts.id);
    if (locations.length === 0) {
      return { state: "failed", reason: `no declared directory \`${opts.id}\` is kept at a branch tip`, locations, graphs: [] };
    }
  }
  if (locations.length === 0) {
    return {
      state: "not-enabled",
      reason: "no declared directory is kept at a branch tip, so `main` is still authoritative; nothing to mount",
      locations,
      graphs: [],
    };
  }
  let own = new Set<string>();
  if (opts.initMissing) {
    try {
      own = new Set(ownStateLocations(root, locations).map((l) => l.path));
    } catch {
      // Could not tell which are the root's own: create none, mount as before.
    }
  }
  const result = fanOut(root, locations, opts.store, own);
  // A mount that landed is another branch's bytes in this checkout, so it is
  // ignored here the moment it lands. Without this, `todos/` and
  // `issue-marks/` showed up untracked after every `state:mount` in the index
  // checkout (measured 2026-10-09), one `git add -A` away from being committed
  // to main as a second, diverging copy. Written only after a SUCCESSFUL mount,
  // and only for the full declared set (`opts.id` narrows the mount, not the
  // block), so a partial run never drops a line another graph needs.
  //
  // The declarations the block is written from are read from the layer
  // mounts, and those may be OLDER than the lock: `--id` skips the CLI's
  // remote fan-out (bean folio-assistant-792f: a stale cat-harness mount
  // predating `merge-reviews/` rewrote the block without it, twice), and a
  // fan-out that ran can still leave them stale — it leaves a mount that no
  // longer hashes to the lock untouched, and cannot run at all when the index
  // is unreadable to the tools on disk (bean folio-assistant-x38u: every fresh
  // session dropped a content layer's `test/attestations/**`, declared by the
  // pinned layer but not by the older copy on disk). So on EVERY run the block is
  // rewritten only when the layer mounts are verified current; otherwise it is
  // left alone, and said so.
  if (result.graphs.some(isPresent)) {
    try {
      const known = opts.layerMounts;
      const stale = known === undefined ? staleLayerMounts(root) : staleLayerMounts(root, () => known);
      if (stale !== undefined) result.reason += `; .gitignore left unchanged: ${stale}`;
      else syncStateIgnores(root, opts.id === undefined ? locations : tipLocations(root));
    } catch (e) {
      result.reason += `; .gitignore not updated: ${(e as Error).message}`;
    }
  }
  return result;
}

// ── The generated `.gitignore` block: one line per tip-mounted graph ─────────

export const STATE_IGNORE_BEGIN = "# BEGIN state mounts (generated by state:mount from the declared branch subgraphs — do not edit)";
export const STATE_IGNORE_END = "# END state mounts";

/**
 * The block's lines, markers included: `/<path>/**` per declared location,
 * sorted. The `/**` form and not `/<path>/`: branch-store's
 * `ignoredByCheckout` reads exactly this rule as "the mount itself", so files
 * under it stay pushable, and a narrower rule below it (`fsh-guts/logs/`)
 * is still seen, which a directory rule would hide.
 */
export function stateIgnoreLines(locations: readonly Pick<TipLocation, "path">[]): string[] {
  const paths = [...new Set(locations.map((l) => l.path.replace(/^\/+|\/+$/g, "")))].filter((p) => p !== "").sort();
  return [STATE_IGNORE_BEGIN, ...paths.map((p) => `/${p}/**`), STATE_IGNORE_END];
}

/** The `.gitignore` text with the block in place: replaced between its markers, else appended. A malformed pair throws. */
export function withStateIgnoreBlock(text: string, locations: readonly Pick<TipLocation, "path">[]): string {
  const lines = text.split("\n");
  const want = stateIgnoreLines(locations);
  const begin = lines.indexOf(STATE_IGNORE_BEGIN);
  const end = lines.indexOf(STATE_IGNORE_END);
  if (begin >= 0 || end >= 0) {
    if (begin < 0 || end < begin || lines.lastIndexOf(STATE_IGNORE_BEGIN) !== begin || lines.lastIndexOf(STATE_IGNORE_END) !== end) {
      throw new Error("the state-mounts markers in .gitignore are unpaired or repeated — fix by hand");
    }
    return [...lines.slice(0, begin), ...want, ...lines.slice(end + 1)].join("\n");
  }
  const base = text === "" || text.endsWith("\n") ? text : `${text}\n`;
  return `${base}${base === "" ? "" : "\n"}${want.join("\n")}\n`;
}

/**
 * Why the layer mounts cannot be trusted to name every declared graph, or
 * `undefined` when they can. No network: `remoteFanOut`'s check mode hashes
 * what is on disk against the lock. A checkout with no lock has nothing to be
 * stale against.
 */
export function staleLayerMounts(
  root: string,
  check: (root: string) => Parameters<typeof remoteExitCode>[0] = (r) => remoteFanOut(r, { check: true }).state,
): string | undefined {
  const state = check(root);
  if (remoteExitCode(state) === 0) return undefined;
  return `a layer mount does not match index.lock.json (${state}), so its declarations may omit a graph; run \`bun run cat state:mount\` (no --id) or \`bun run cat mount:lock\` first`;
}

/** Write the block into `root/.gitignore`. Returns whether the file changed. */
export function syncStateIgnores(root: string, locations: readonly Pick<TipLocation, "path">[]): boolean {
  const file = join(root, ".gitignore");
  const text = existsSync(file) ? readFileSync(file, "utf-8") : "";
  const next = withStateIgnoreBlock(text, locations);
  if (next === text) return false;
  writeFileSync(file, next);
  return true;
}

/**
 * One {@link mountTip} per declared directory, aggregated. A graph that fails
 * is recorded and the loop CONTINUES: stopping at the first failure would
 * leave the rest in the one state bean `1xhc` forbids — not attempted, and
 * indistinguishable from fine.
 */
function fanOut(root: string, locations: TipLocation[], store?: BranchStoreOptions, own: ReadonlySet<string> = new Set()): MountResult {
  const graphs: GraphMount[] = [];
  for (const loc of locations) {
    const base = { id: locationKey(loc), path: loc.path, branch: loc.repository ? `${loc.repository}:${loc.branch}` : loc.branch };
    try {
      // A prior mount holding unpushed edits is somebody's work: on disk,
      // readable, and left untouched. Asked BEFORE mounting, never inferred.
      // A mount that is GONE — every file deleted, nothing written, as when a
      // layer is re-laid over it — is no one's work: it is re-mounted, never
      // reported as edits to push. Pushing it emptied five graphs on
      // 2026-10-15 and broke every later mount (`emptyingReason`).
      const prior = markerFor(root, loc);
      if (prior && resolveMarkerInto(root, prior).ok) {
        migrateMarkerInto(root, prior);
        const pending = pendingMountChanges(loc, { repoRoot: root });
        if (pending !== undefined && pending.length > 0 && mountEmptyingReason(loc, { repoRoot: root }) === undefined) {
          const mass = mountMassDeletionReason(loc, { repoRoot: root });
          if (mass !== undefined) {
            graphs.push({ ...base, state: "stale", damaged: true, reason: `damaged? ${mass}` });
          } else {
            graphs.push({ ...base, state: "stale", reason: `${pending.length} unpushed change(s) left untouched; push them with \`bun run cat state:push\`` });
          }
          continue;
        }
      }
      // Every attempt asks afresh (bean `x5e0`): a remote that has since gained
      // the branch, or a changed origin, must not keep reading absent.
      clearAbsence(root, loc);
      let r = mountTip(loc, { repoRoot: root, store });
      // The root layer's OWN declared branch, missing: the layer's
      // initialization creates it (owner, 2026-11-17), then it is mounted.
      let created = "";
      if (r.state === "miss" && own.has(loc.path)) {
        const c = initLocation(loc, { repoRoot: root, store });
        if (c.state === "created" || c.state === "exists") {
          created = c.state === "created" ? `; ${c.reason} (layer initialization)` : "";
          r = mountTip(loc, { repoRoot: root, store });
        } else {
          graphs.push({ ...base, state: c.state === "unknown" ? "unknown" : "miss", reason: initRemedy(c) });
          continue;
        }
      }
      if (r.state === "mounted") {
        graphs.push({ ...base, state: "mounted", reason: `${r.files} file(s) at ${r.tip.slice(0, 12)}${created}`, tip: r.tip, files: r.files });
      } else if (r.state === "miss" && loc.unownedBy !== undefined) {
        const ns = namespaceCarried(loc, root, store);
        if (ns.state === "not-carried") {
          const reason = `declared for every checkout by ${loc.unownedBy}, not by this root, and this checkout's remote carries no ${ns.namespace}* branch; declare it at the root to keep it here`;
          recordAbsence(root, loc, loc.unownedBy, reason);
          graphs.push({
            ...base,
            state: "absent",
            declaredBy: loc.unownedBy,
            reason,
          });
        } else if (ns.state === "carried") {
          graphs.push({ ...base, state: "miss", reason: `${r.reason}; this checkout's remote carries ${ns.branches.join(", ")}, so it keeps that namespace and the missing branch is a failure` });
        } else {
          graphs.push({ ...base, state: "unknown", reason: `${r.reason}; and whether this checkout's remote keeps that namespace could not be asked: ${ns.reason}` });
        }
      } else if (r.state === "miss" && loc.repository !== undefined && /does not exist/.test(r.reason)) {
        // A MOUNTED layer's branch: never created here. One line that says
        // whose it is and what to run there.
        graphs.push({ ...base, state: "miss", reason: `${r.reason}; ${dependencyRemedy(loc)}` });
      } else {
        graphs.push({ ...base, state: r.state, reason: r.reason });
      }
    } catch (e) {
      // A throw for ONE graph must not take the sweep with it.
      graphs.push({ ...base, state: "unknown", reason: `mounting ${loc.id} threw: ${(e as Error).message}` });
    }
  }

  const present = graphs.filter(isPresent);
  const failed = graphs.filter((g) => !isSettled(g));
  const absent = graphs.length - present.length - failed.length;
  const n = graphs.length;
  if (failed.length === 0) {
    const reason = absent ? `${n} declared graph(s): ${present.length} present, ${absent} absent and not this root's` : `${n} declared graph(s), all present`;
    return { state: "mounted", reason, locations, graphs };
  }
  if (present.length === 0) {
    return { state: "failed", reason: `none of the ${n} declared graph(s) could be mounted`, locations, graphs };
  }
  return {
    state: "partial",
    reason: `${present.length} of ${n} declared graph(s) mounted; ${failed.map((g) => g.id).join(", ")} did not`,
    locations,
    graphs,
  };
}

/**
 * The markdown the session-start hook injects. A failure is deliberately
 * shouty and says what NOT to believe, because the agent's next move after
 * reading this is to read the work-plan.
 */
/** One table row per graph, so a reader sees WHICH graph is in which state. */
function graphTable(graphs: GraphMount[]): string[] {
  const L = ["| graph | branch | path | state | detail |", "|---|---|---|---|---|"];
  for (const g of graphs) {
    const mark =
      g.state === "mounted"
        ? "mounted"
        : g.state === "stale"
          ? g.damaged
            ? "⚠️ damaged?"
            : "⚠️ stale"
          : g.state === "absent"
            ? "absent"
            : `🛑 ${g.state}`;
    L.push(`| \`${g.id}\` | \`${g.branch}\` | \`${g.path}\` | ${mark} | ${g.reason} |`);
  }
  return L;
}

export function report(r: MountResult): string {
  const L: string[] = ["## State branch mount", ""];
  if (r.state === "not-enabled") {
    L.push(`Not enabled — ${r.reason}.`, "", "Beans and todos are read from the checkout, as usual.");
    return L.join("\n");
  }
  const present = r.graphs.filter(isPresent);
  const failed = r.graphs.filter((g) => !isSettled(g));
  const stale = r.graphs.filter((g) => g.state === "stale" && !g.damaged);
  const damaged = r.graphs.filter((g) => g.state === "stale" && g.damaged);
  const absent = r.graphs.filter((g) => g.state === "absent");
  if (r.graphs.length > 0 && failed.length === 0) {
    L.push(`Mounted ${present.length} declared graph(s), each from its own branch at its own declared path.`, "");
    L.push(...graphTable(r.graphs), "");
    if (absent.length) {
      L.push(
        `${absent.map((g) => `\`${g.id}\``).join(", ")}: absent. Declared for every checkout by a mounted instance, not by this root, ` +
          `and not on this checkout's remote. Not a failure; declare it at the root to keep it here.`,
        "",
      );
    }
    if (damaged.length) {
      L.push(`⚠️ ${damaged.map((g) => `\`${g.id}\``).join(", ")} look damaged? (>50% of files deleted locally) and were left untouched — do not push without \`--allow-mass-delete\`.`, "");
    }
    if (stale.length) {
      L.push(`⚠️ ${stale.map((g) => `\`${g.id}\``).join(", ")} hold unpushed edits and were left untouched. Nothing was discarded.`, "");
    }
    L.push("Write through `bun run cat state:push`, never `git push` from a mount.");
    return L.join("\n");
  }

  const undetermined = failed.filter((g) => g.state === "unknown");
  L.push(
    failed.length
      ? `🛑 **THE STATE MOUNT FAILED FOR ${failed.length} OF ${r.graphs.length} GRAPH(S) — do not trust an empty work-plan.**`
      : `🛑 **THE STATE MOUNT FAILED — do not trust an empty work-plan.**`,
    "",
  );
  if (r.graphs.length) L.push(...graphTable(r.graphs), "");
  else L.push(`Reason: ${r.reason}`, "");
  L.push(
    failed.length
      ? `Not mounted: ${failed.map((g) => `\`${g.id}\` (${g.path})`).join(", ")}. Anything reading those paths will report`
      : `Nothing was mounted. Anything reading a branch-kept graph will report`,
    `**nothing**, and "no beans" and "could not reach the beans" look identical from there. An empty \`beans list\``,
    `right now is **not** evidence that there is no work.`,
  );
  if (undetermined.length) {
    L.push(
      "",
      `${undetermined.length} graph(s) are **could not determine**, not determined-absent: ` +
        `${undetermined.map((g) => `\`${g.id}\``).join(", ")}. That is never a pass.`,
    );
  }
  if (present.length) {
    // Say what DID work, or a reader concludes the whole mount is gone.
    L.push(
      "",
      `Still present and readable: ${present.map((g) => `\`${g.id}\` (${g.path})`).join(", ")} — ` +
        `a partial mount is not a rollback, and nothing was discarded.`,
    );
  }
  L.push("", "Fix the mount (`bun run cat state:mount`) or read the work-plan from the checkout before deciding there is none.");
  return L.join("\n");
}

/**
 * A store this module does not mount, and the Tool its declaration hands it to
 * (bean j9cs, owner 2026-10-04: *"there should not be a central registry for
 * declaring mount tools"*).
 *
 * `state:mount` implements ONE keying, `tip`. A `family` (one branch per IG
 * package or Lean toolchain) and a `route` store (a published site) are put on
 * disk, or on their CDN, by a Tool the declaration names in `storage.tool`.
 * This lists each with that Tool's command, so the mount DISPATCHES through
 * the declaration rather than knowing every keying. It does not run them: a
 * family member is chosen by a key (`keyFrom`) only the caller knows.
 */
export interface DelegatedStore {
  id: string;
  path: string;
  /** The branch, or for a family its prefix. */
  branch: string;
  keyedBy: string;
  tool?: string;
  /** The Tool's shell command, when it declares one. */
  invoke?: string;
}

export function delegatedStores(root: string = repoRootOf()): DelegatedStore[] {
  const byId = new Map(tools().map((t) => [t.id, t]));
  const out: DelegatedStore[] = [];
  for (const inst of layerRootsIn(root)) {
    let decl;
    try {
      decl = readDeclaration(inst);
    } catch {
      continue; // an unreadable declaration is check:declared-dirs' finding
    }
    if (!decl) continue;
    for (const d of [...(decl.directories ?? []), ...nestedDirectories(inst, decl)]) {
      const st = d.storage as { keyedBy?: string; branch?: string; branchPrefix?: string; tool?: string } | undefined;
      if (!st?.keyedBy || !["family", "route", "route-family"].includes(st.keyedBy)) continue;
      const tool = st.tool;
      const shell = tool ? (byId.get(tool)?.invoke as { shell?: string } | undefined)?.shell : undefined;
      out.push({
        id: d.id,
        path: d.path,
        branch: st.branch ?? st.branchPrefix ?? "",
        keyedBy: st.keyedBy,
        ...(tool ? { tool } : {}),
        ...(shell ? { invoke: shell } : {}),
      });
    }
  }
  return out;
}

/** The section the command prints after the mount table: what is not mounted here, and by which Tool. */
export function delegatedReport(stores: readonly DelegatedStore[]): string {
  if (stores.length === 0) return "";
  const L = [
    "",
    "",
    "### Not mounted here: handed to the Tool each declaration names",
    "",
    "| graph | keyed by | branch | Tool | command |",
    "|---|---|---|---|---|",
  ];
  for (const s of stores) {
    const tool = s.tool ? `\`${s.tool}\`` : "⚠️ none declared";
    L.push(`| \`${s.id}\` | ${s.keyedBy} | \`${s.branch}\` | ${tool} | ${s.invoke ? `\`${s.invoke}\`` : "—"} |`);
  }
  return L.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--id");
  // REMOTE MOUNTS (bean `0mpw`) ride the same entry point, so the
  // session-start hook and CI need no second step: a dependency layer that is
  // not on disk is the same "do not trust an empty read" as a state graph.
  // Skipped for `--id`, which names one branch-kept graph.
  //
  // FIRST, because a state graph can be declared INSIDE a remote-mounted
  // layer (cat-harness's, a content layer's … `health`): the layer is laid down,
  // then its graphs are mounted into it. The other order mounted the graphs
  // and then re-laid the layer over them.
  const remote = at === -1 ? remoteFanOut(repoRootOf()) : undefined;
  const r = mountState({
    id: at === -1 ? undefined : argv[at + 1],
    layerMounts: remote?.state,
    // The layer's initialization: its own missing state branches are created
    // here, so a new layer's first session (and the hook) makes them.
    initMissing: !argv.includes("--no-init") && initEnabled(),
  });
  if (argv.includes("--json")) console.log(JSON.stringify(remote ? { ...r, remote: { state: remote.state } } : r, null, 2));
  else console.log(report(r) + delegatedReport(delegatedStores()) + (remote ? `\n\n${remote.text}` : ""));
  if (remote && remoteExitCode(remote.state) !== 0) process.exit(remoteExitCode(remote.state));
  // Loud means a non-zero exit too: a hook that only prints is a hook a wrapper
  // can swallow, and the sweep calls this with `|| true`. `partial` counts: a
  // graph that did not mount is a finding even when its siblings did.
  process.exit(r.state === "failed" || r.state === "partial" ? 1 : 0);
}
