#!/usr/bin/env bun
/**
 * state-push — send the mount's edits to the branch THROUGH the library.
 *
 * @module scripts/state-push
 * @graphNode none — the write half of the state mount
 * @covers none — it writes a state graph's edits to its branch and judges nothing
 *
 * `bun run cat state:push` splices every graph with branch-store's
 * {@link pushMount}, once per graph, to the branch that graph's mount was
 * read from (`state-mount.ts`).
 *
 * ## Why not `git push`
 *
 * A push of the tree the editor started from reverts a sibling's write to a
 * DIFFERENT file landed meanwhile, and overwrites a sibling's write to the
 * SAME file. What goes to the remote instead is a SPLICE: only the paths that
 * actually changed, grafted onto whatever the tip is now, every other file
 * carried across by id.
 *
 * ## The `expect` is the whole safety story
 *
 * The mount marker records the blob each file had at the mounted tip — what
 * the editor read, i.e. `Change.expect`. A sibling who edited the same file
 * since gets this write stopped as `conflict` with the paths named, and
 * NOTHING is pushed for that graph. A file the editor created carries
 * `expect: null`, so two sessions creating the same bean are told instead of
 * both believing they did.
 *
 * ## Which graphs: the declarations AND the mounts
 *
 * Every declared tip-keyed graph, plus every graph mounted in this worktree
 * whose declaration has since gone: a mount's marker records its branch, so
 * its edits are never stranded.
 *
 * ## It never discards edits
 *
 * On `conflict` or `failed` the mount is left exactly as it is: the edits are
 * the only copy.
 *
 * ## It retags the beans first
 *
 * Before the splice, every bean in the mounted store gets back its
 * `$schema: bean/1.0.0` (`beans-retag.ts`), which the `beans` CLI drops
 * whenever it rewrites a bean. The retag only edits files in the mount. It is
 * skipped on `--dry-run`, which must not write, and a retag that cannot run is
 * reported and does not stop the push.
 *
 * ## It judges the text it splices
 *
 * A state branch has no CI in front of it, and on 2026-11-05 a work item's
 * link to a moved path reddened every layer's CI from there (bean `asq1`).
 * So before each splice the Markdown files it writes are run through the
 * dangling-link and retired-word checks (`state-push-checks.ts`), and a graph
 * whose push would INTRODUCE a finding is refused, with the findings named.
 * A finding already at the tip does not block. `CAT_GATES_BYPASS='<reason>'`
 * pushes anyway and logs the reason with the findings, the same bypass and
 * the same log as the pre-push gates (cat-harness-tools#1487).
 */

import { isAbsolute, relative, resolve } from "node:path";

import {
  locationKey,
  markerFor,
  mountEmptyingReason,
  mountMassDeletionReason,
  mountedIds,
  pendingMountChanges,
  pushMount,
  readMarker,
  tipLocations,
  type BranchStoreOptions,
  type Change,
  type TipLocation,
  type WriteResult,
} from "./branch-store.js";
import { repoRootOf } from "./state-mount.js";
import { locateStore, retagDir } from "./beans-retag.ts";
import { HOMES_LINE, isBeanFile, originRepo, retiredBeanStore } from "./lib/bean-homes.ts";
import { logPush } from "./gate-record.ts";
import { findingsReason, harnessChecks, mountTexts, newFindings, type TextChecks, type TextFinding } from "./state-push-checks.ts";

export interface PushOptions {
  repoRoot?: string;
  message?: string;
  /** Report what would be sent and send nothing. */
  dryRun?: boolean;
  /** Push only the graphs with this id — every one of them — or the one with this key (`<instance>.health`). */
  id?: string;
  /** Passed to `BranchStore.open` — tests point it at a scratch store. */
  store?: BranchStoreOptions;
  /** Retag the mounted beans before splicing (default true). */
  retag?: boolean;
  /**
   * Push a graph whose mount is EMPTY while its branch holds files, deleting
   * every file on it. Off by default: an empty mount is far more often a
   * mount that was cleared than a graph someone means to delete (bean `sp0e`).
   */
  allowEmpty?: boolean;
  /**
   * Push a graph whose mount has deleted more than half of the mounted tip's
   * files. Off by default: a mass deletion without replacement is far more
   * often a damaged mount than a deliberate pruning (bean `1ple`).
   */
  allowMassDelete?: boolean;
  /**
   * The text checks to run on each graph's Markdown writes before its splice
   * (`state-push-checks.ts`). The command passes the harness's; a library
   * caller that passes none runs none.
   */
  checks?: TextChecks;
  /** A stated reason to splice despite new text findings; logged with them. */
  bypass?: string;
}

/**
 * What the pre-push retag did. `skipped` says why it did not run; a store that
 * is not among the graphs being pushed is not reported at all.
 */
export type RetagStep =
  | { dir: string; added: number; foreign: string[] }
  | { skipped: string };

/**
 * One declared graph's splice, in the fan-out — the write half of
 * `state-mount.ts`'s {@link GraphMount}.
 *
 * `state` is {@link pushMount}'s verdict verbatim. `unchanged` and `pushed`
 * are both successes; `conflict` means a sibling edited the same path since
 * this mount was taken and **nothing was sent for that graph**, which is a
 * finding rather than a loss — the edits are still on disk.
 */
export interface GraphPush {
  id: string;
  branch: string;
  path: string;
  state: "pushed" | "unchanged" | "would-push" | "conflict" | "absent" | "refused" | "failed";
  reason: string;
  changes?: Change[];
  write?: WriteResult;
  /** New text findings this push carried through on a bypass. */
  bypassed?: TextFinding[];
  /** Files whose text at the tip could not be read, so nothing in them was judged new. */
  notCompared?: string[];
  /** Files no declared directory owns, so their links were not judged. */
  notJudged?: string[];
}

/** A graph whose splice did not lose anything and needs no further action. */
export function isSettled(g: GraphPush): boolean {
  return g.state === "pushed" || g.state === "unchanged" || g.state === "would-push";
}

export type PushResult = {
  state: "no-mount" | "nothing" | "would-push" | "pushed" | "failed" | "partial";
  reason: string;
  graphs: GraphPush[];
  /** The pre-push bean retag, when the bean store is one of the graphs pushed. */
  retag?: RetagStep;
  /** Text checks that could not be set up, so did not run. */
  checksNotRun?: string[];
};

/**
 * Retag the bean store when it lies inside one of `locations`. Returns
 * `undefined` when no location being pushed holds it.
 */
export function retagBeansBeforePush(root: string, locations: readonly TipLocation[]): RetagStep | undefined {
  let where: ReturnType<typeof locateStore>;
  try {
    where = locateStore(root);
  } catch (e) {
    return { skipped: `could not locate the bean store: ${(e as Error).message}` };
  }
  if (!("dir" in where)) return undefined;
  const dir = resolve(where.dir);
  const inside = locations.some((l) => {
    const rel = relative(resolve(root, l.path), dir);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });
  if (!inside) return undefined;
  try {
    const r = retagDir(dir, { write: true });
    return { dir, added: r.added.length, foreign: r.foreign.map((f) => f.file) };
  } catch (e) {
    return { skipped: `retag failed: ${(e as Error).message}` };
  }
}

/**
 * Splice back every declared tip-keyed graph, each to the branch its own
 * declaration names. Bean `2h76`, owner ruling 2026-10-03 (D4 option b).
 *
 * Symmetric with `state-mount.ts`'s fan-out, and for the same reasons: the
 * per-directory splice already exists as {@link pushMount}, so it is called
 * once per declaration rather than reimplemented, and a graph that fails is
 * recorded while the loop CONTINUES — stopping at the first failure would
 * leave the rest unattempted and indistinguishable from settled (bean `1xhc`).
 *
 * A push to ONE branch is what this replaces: `pushState` resolved the
 * declarations to a single branch and refused above one, so under a branch per
 * graph every graph but the first was unreachable.
 */
function pushFanOut(root: string, locations: TipLocation[], opts: PushOptions): PushResult {
  const graphs: GraphPush[] = [];
  for (const loc of locations) {
    const key = locationKey(loc);
    const base = { id: key, branch: loc.repository ? `${loc.repository}:${loc.branch}` : loc.branch, path: loc.path };
    try {
      if (opts.dryRun) {
        const changes = pendingMountChanges(loc, { repoRoot: root });
        const emptying = changes === undefined || opts.allowEmpty ? undefined : mountEmptyingReason(loc, { repoRoot: root });
        const massDel =
          changes === undefined || opts.allowEmpty || opts.allowMassDelete ? undefined : mountMassDeletionReason(loc, { repoRoot: root });
        const retired = changes === undefined ? undefined : retiredBeanWrite(root, loc, changes);
        const text = changes === undefined ? undefined : textVerdict(root, loc, changes, opts);
        if (changes === undefined) {
          graphs.push({ ...base, state: "refused", reason: `${key} is not mounted; run \`bun run cat state:mount\` first` });
        } else if (retired) {
          graphs.push({ ...base, state: "refused", reason: retired, changes });
        } else if (emptying) {
          graphs.push({ ...base, state: "refused", reason: emptying, changes });
        } else if (massDel) {
          graphs.push({ ...base, state: "refused", reason: massDel, changes });
        } else if (text?.refused) {
          graphs.push({ ...base, state: "refused", reason: text.refused, changes, ...text.extra });
        } else {
          graphs.push({ ...base, state: "would-push", reason: `${changes.length} path(s) would be spliced onto the tip`, changes, ...text?.extra });
        }
        continue;
      }
      const changes = pendingMountChanges(loc, { repoRoot: root });
      const retired = changes === undefined ? undefined : retiredBeanWrite(root, loc, changes);
      if (retired !== undefined) {
        graphs.push({ ...base, state: "refused", reason: retired, changes });
        continue;
      }
      const emptied = changes === undefined || opts.allowEmpty ? undefined : emptiedGraph(root, loc, changes);
      if (emptied !== undefined) {
        graphs.push({ ...base, state: "refused", reason: emptied, changes });
        continue;
      }
      const massDel =
        changes === undefined || opts.allowEmpty || opts.allowMassDelete ? undefined : mountMassDeletionReason(loc, { repoRoot: root });
      if (massDel !== undefined) {
        graphs.push({ ...base, state: "refused", reason: massDel, changes });
        continue;
      }
      const text = changes === undefined ? undefined : textVerdict(root, loc, changes, opts);
      if (text?.refused !== undefined) {
        graphs.push({ ...base, state: "refused", reason: text.refused, changes, ...text.extra });
        continue;
      }
      if (text?.extra.bypassed?.length) {
        logPush(root, { event: "bypass", via: "state-push", reason: opts.bypass, graph: key, findings: text.extra.bypassed });
      }
      const message = opts.message ?? `state: ${loc.id} from its mount`;
      // `--allow-empty` is the one explicit request to delete a whole graph, so it
      // reaches pushMount's own emptying refusal too: refusing it there made
      // the flag a no-op (two guards of the same deletion, bean sp0e).
      const w = pushMount(loc, message, { repoRoot: root, store: opts.store, allowEmpty: opts.allowEmpty });
      if (w.state === "refused") graphs.push({ ...base, state: "refused", reason: w.reason });
      else graphs.push({ ...base, state: w.state, reason: w.reason, write: w, changes, ...text?.extra });
    } catch (e) {
      // A throw for ONE graph must not take the others' pushes with it.
      graphs.push({ ...base, state: "failed", reason: `pushing ${key} threw: ${(e as Error).message}` });
    }
  }

  const settled = graphs.filter(isSettled);
  const stuck = graphs.filter((g) => !isSettled(g));
  const n = graphs.length;

  // Nothing is mounted at all: not a failure, the same answer the single-mount
  // path gives when `state/` is absent.
  if (stuck.length === n && stuck.every((g) => g.state === "refused" && g.reason.includes("not mounted"))) {
    return { state: "no-mount", reason: `none of the ${n} declared graph(s) is mounted; run \`bun run cat state:mount\` first`, graphs };
  }
  if (stuck.length === 0) {
    if (opts.dryRun) {
      const changes = graphs.flatMap((g) => g.changes ?? []);
      return { state: "would-push", reason: `${changes.length} path(s) across ${n} graph(s) would be spliced`, graphs };
    }
    const pushed = graphs.filter((g) => g.state === "pushed");
    if (pushed.length === 0) return { state: "nothing", reason: `no graph had changes to push`, graphs };
    return { state: "pushed", reason: `${pushed.length} of ${n} graph(s) pushed, each to its own branch`, graphs };
  }
  if (settled.length === 0) {
    return { state: "failed", reason: `none of the ${n} declared graph(s) could be pushed`, graphs };
  }
  return {
    state: "partial",
    reason: `${settled.length} of ${n} declared graph(s) settled; ${stuck.map((g) => `${g.id} (${g.state})`).join(", ")} did not`,
    graphs,
  };
}

/**
 * What the text checks say about one graph's changes: a refusal when they
 * would introduce a finding and no bypass reason was given, otherwise what to
 * record (the findings a bypass carried, the files not compared).
 */
export function textVerdict(
  root: string,
  loc: TipLocation,
  changes: readonly Change[],
  opts: Pick<PushOptions, "checks" | "bypass" | "store">,
): { refused?: string; extra: Pick<GraphPush, "bypassed" | "notCompared" | "notJudged"> } | undefined {
  if (opts.checks === undefined) return undefined;
  const m = markerFor(root, loc);
  if (m === undefined) return undefined;
  const { findings, notCompared, notJudged } = newFindings(opts.checks, mountTexts(root, m, changes, opts.store));
  const extra: Pick<GraphPush, "bypassed" | "notCompared" | "notJudged"> = {
    ...(notCompared.length ? { notCompared } : {}),
    ...(notJudged.length ? { notJudged } : {}),
  };
  if (findings.length === 0) return { extra };
  if (opts.bypass === undefined || opts.bypass.trim() === "") return { refused: findingsReason(findings), extra };
  return { extra: { ...extra, bypassed: findings } };
}

/**
 * Why a push of `loc` would write a bean file to a store that keeps no beans
 * any more, or `undefined` when it would not (cat-harness-tools#459, owner
 * card Q4 "A. Fix writers + duplicate check", 2026-10-30). Deleting a bean
 * file there is allowed: that is the cleanup.
 */
export function retiredBeanWrite(root: string, loc: Pick<TipLocation, "id" | "branch" | "repository">, changes: readonly Change[]): string | undefined {
  if (loc.id !== "beans") return undefined;
  const repo = loc.repository ?? originRepo(root);
  if (!retiredBeanStore(repo, loc.branch)) return undefined;
  const writes = changes.filter((c) => c.content !== null && isBeanFile(c.path));
  if (writes.length === 0) return undefined;
  return `${repo} ${loc.branch} keeps no bean files any more, and this push would write ${writes.length} (${writes[0]!.path}${writes.length > 1 ? ", ..." : ""}). Write them to their home instead: ${HOMES_LINE}.`;
}

export function pushState(opts: PushOptions = {}): PushResult {
  const root = opts.repoRoot ?? repoRootOf();
  let locations: TipLocation[];
  try {
    locations = tipLocations(root);
  } catch (e) {
    return { state: "failed", reason: `could not read the directory declarations: ${(e as Error).message}`, graphs: [] };
  }
  // A mount whose declaration has gone still pushes, to the branch (and the
  // repository) its marker recorded. A marker filed under a location's key, or
  // one for a location's path under an older name, belongs to that location.
  for (const k of mountedIds(root)) {
    if (locations.some((l) => locationKey(l) === k)) continue;
    const m = readMarker(root, k);
    if (!m || locations.some((l) => l.path === m.path)) continue;
    locations.push({
      id: m.id,
      ...(k !== m.id ? { key: k } : {}),
      path: m.path,
      branch: m.branch,
      keyedBy: "tip",
      ...(m.repository ? { repository: m.repository } : {}),
      ...(m.branchPath ? { branchPath: m.branchPath } : {}),
    });
  }
  if (opts.id !== undefined) locations = locations.filter((l) => l.id === opts.id || l.key === opts.id);
  if (locations.length === 0) {
    const what = opts.id === undefined ? "no graph is declared at a branch tip or mounted here" : `\`${opts.id}\` is neither declared at a branch tip nor mounted here`;
    return { state: "no-mount", reason: `${what}; run \`bun run cat state:mount\` first`, graphs: [] };
  }
  // Only a mounted graph has files to retag; an unmounted one is refused by
  // the fan-out below with its own remedy.
  const retag = opts.dryRun || opts.retag === false ? undefined : retagBeansBeforePush(root, locations.filter((l) => isMounted(root, l)));
  const result = pushFanOut(root, locations, opts);
  const notRun = opts.checks?.notRun?.length ? { checksNotRun: opts.checks.notRun } : {};
  return retag ? { ...result, retag, ...notRun } : { ...result, ...notRun };
}

/**
 * Why a push of `loc` would delete the WHOLE graph, or `undefined` when it
 * would not (bean `sp0e`).
 *
 * A mount whose every file is gone while the branch still holds them looks,
 * to the splice, exactly like an editor who deleted every file — so it is
 * pushed, and the branch is emptied. Measured 2026-10-15: an index worktree
 * whose layer directories were cleared and remounted lost the state graphs
 * mounted inside them, and one `state:push` for a single bean edit emptied
 * five branches (`<instance>/health` x4 and `marks`). Deleting a whole graph
 * is rare and deliberate, so it takes `--allow-empty`; anything else is
 * refused for that graph only, and the other graphs still push.
 */
export function emptiedGraph(root: string, loc: TipLocation, changes: readonly Change[]): string | undefined {
  let held: number;
  try {
    held = Object.keys(markerFor(root, loc)?.files ?? {}).length;
  } catch {
    return undefined;
  }
  if (held === 0) return undefined;
  if (changes.some((c) => c.content !== null)) return undefined;
  if (changes.filter((c) => c.content === null).length < held) return undefined;
  return (
    `the mount of ${locationKey(loc)} is empty while its branch holds ${held} file(s): ` +
    `pushing would delete the whole graph. Re-mount it (\`bun run cat state:mount\`), ` +
    `or pass \`--allow-empty\` if deleting every file is meant`
  );
}

/** Whether `loc` has a mount here; a marker that cannot be read is not one (the fan-out reports it). */
function isMounted(root: string, loc: TipLocation): boolean {
  try {
    return markerFor(root, loc) !== undefined;
  } catch {
    return false;
  }
}

/** One row per graph, so a reader sees WHICH branch a splice landed on. */
function graphTable(graphs: GraphPush[]): string[] {
  const L = ["| graph | branch | state | detail |", "|---|---|---|---|"];
  for (const g of graphs) {
    const mark = isSettled(g) ? g.state : g.state === "conflict" ? "⚠️ conflict" : `🛑 ${g.state}`;
    L.push(`| \`${g.id}\` | \`${g.branch}\` | ${mark} | ${g.reason} |`);
  }
  return L;
}

/** One line on the pre-push retag, or none when it had nothing to say. */
function retagLine(t: RetagStep | undefined): string[] {
  if (t === undefined) return [];
  if ("skipped" in t) return [`⚠️ Bean retag did not run: ${t.skipped}.`, ""];
  const out: string[] = [];
  if (t.added > 0) out.push(`Retagged ${t.added} bean(s) with \`$schema: bean/1.0.0\` before the splice.`);
  if (t.foreign.length > 0) out.push(`⚠️ ${t.foreign.length} bean(s) carry a foreign \`$schema\`, left as they are: ${t.foreign.join(", ")}.`);
  return out.length ? [...out, ""] : [];
}

/** Lines on the text checks: what a bypass let through, what was not compared, what did not run. */
function checksLines(r: PushResult): string[] {
  const out: string[] = [];
  for (const n of r.checksNotRun ?? []) out.push(`⚠️ Text check did not run — ${n}.`);
  for (const g of r.graphs) {
    if (g.bypassed?.length) {
      out.push(`⚠️ \`${g.id}\`: ${g.bypassed.length} new text finding(s) pushed on a bypass (logged):`);
      for (const f of g.bypassed) out.push(`  - \`${f.path}\` ${f.detail}`);
    }
    if (g.notJudged?.length) out.push(`⚠️ \`${g.id}\`: no declared directory owns ${g.notJudged.join(", ")}, so their links were not judged.`);
    if (g.notCompared?.length) out.push(`⚠️ \`${g.id}\`: the tip's text of ${g.notCompared.join(", ")} could not be read, so nothing in them was judged new.`);
  }
  return out.length ? [...out, ""] : [];
}

export function report(r: PushResult): string {
  const L: string[] = ["## State push", "", ...retagLine(r.retag), ...checksLines(r)];
  // The fan-out: one splice per declared graph, each to its own branch.
  if (r.graphs.length) {
    const stuck = r.graphs.filter((g) => !isSettled(g));
    if (stuck.length === 0) {
      L.push(`${r.reason}.`, "", ...graphTable(r.graphs));
      if (r.state === "would-push") {
        for (const g of r.graphs)
          for (const c of g.changes ?? []) L.push(`- \`${g.id}\`: \`${c.path}\` — ${c.content === null ? "delete" : c.expect === null ? "create" : "update"}`);
      }
      return L.join("\n");
    }
    const conflicts = stuck.filter((g) => g.state === "conflict");
    L.push(`🛑 **The state push did not settle ${stuck.length} of ${r.graphs.length} graph(s).** ${r.reason}.`, "", ...graphTable(r.graphs), "");
    for (const g of conflicts)
      for (const c of g.write?.conflicts ?? [])
        L.push(`- \`${g.id}\`: \`${c.path}\` — you read \`${c.expected ?? "(absent)"}\`, the tip has \`${c.actual ?? "(absent)"}\``);
    L.push(
      "",
      `**Nothing was discarded** — every unsettled graph's edits are still in its mount. A graph that pushed is NOT`,
      `rolled back: ${r.graphs.filter(isSettled).map((g) => `\`${g.id}\``).join(", ") || "(none)"} landed.`,
    );
    if (conflicts.length) L.push("", "For each conflict, re-read those files, re-apply your change, and push again.");
    return L.join("\n");
  }
  return L.concat(r.reason + ".").join("\n");
}

/** The flags `state:push` understands; `-m` and `--id` each take one value. */
const FLAGS = new Set(["--dry-run", "--json", "--allow-empty", "--allow-mass-delete"]);
const VALUED = new Set(["-m", "--id"]);

/**
 * The arguments this command does not understand, or `[]`. Anything unknown is
 * REFUSED rather than ignored: this command writes to a shared branch, and on
 * 2026-10-09 `state:push --help` — `--help` being unknown and so ignored —
 * pushed the whole local fsh-guts mount with the default message. A command
 * whose side effect is a push must not treat "I did not understand you" as
 * "go ahead".
 */
export function unknownArgs(argv: readonly string[]): string[] {
  const bad: string[] = [];
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k]!;
    if (FLAGS.has(a)) continue;
    if (VALUED.has(a)) {
      if (k + 1 >= argv.length || argv[k + 1]!.startsWith("-")) bad.push(`${a} (needs a value)`);
      else k++;
      continue;
    }
    bad.push(a);
  }
  return bad;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const bad = unknownArgs(argv);
  if (bad.length > 0) {
    console.error(`state:push: not understood: ${bad.join(", ")}. Nothing was pushed.`);
    console.error("Usage: bun run cat state:push -- [--id <graph>] [-m <message>] [--dry-run] [--allow-empty] [--allow-mass-delete] [--json]   (CAT_GATES_BYPASS='<reason>' to push past new text findings; logged)");
    process.exit(2);
  }
  const at = argv.indexOf("-m");
  const i = argv.indexOf("--id");
  const r = pushState({
    checks: await harnessChecks(),
    bypass: process.env.CAT_GATES_BYPASS,
    dryRun: argv.includes("--dry-run"),
    allowEmpty: argv.includes("--allow-empty"),
    allowMassDelete: argv.includes("--allow-mass-delete"),
    message: at === -1 ? undefined : argv[at + 1],
    id: i === -1 ? undefined : argv[i + 1],
  });
  if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else console.log(report(r));
  // `partial` counts: a graph whose splice did not settle is a finding even
  // when its siblings' did.
  process.exit(r.state === "failed" || r.state === "partial" ? 1 : 0);
}
