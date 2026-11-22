#!/usr/bin/env bun
/**
 * The merge queue's ORDER — live facts in, the reprioritisation table's
 * answer out.
 *
 * The queue STORES decisions (`schemas/sdlc/merge-queue.ts`); this
 * module COMPUTES the facts a decision is made from, at the moment it is
 * made, and hands them to `sdlc/processes/decisions/merge-priority.dmn`. It
 * writes nothing: what the steward acts on is recorded as a queue entry by
 * the steward, and the facts it was computed from stay GitHub's.
 *
 * Three pieces, each the place one rule lives:
 *
 * - {@link authoredPaths} / {@link touchesShared} — technique **T3**, the
 *   cheap conflict test. Independence is decided on AUTHORED paths and
 *   shared declarations, with GENERATED paths excluded, because
 *   `merge-conflict-patterns` already resolves those mechanically and
 *   counting them makes every pair conflict. "Authored" is asked of that
 *   registry — a path its declared patterns would REFUSE — rather than
 *   restated here.
 * - {@link deriveFacts} — the inputs the table reads, by the names
 *   `MemberFactsSchema` fixes, so the tools that emit them (`merge:overlap`)
 *   and this reader agree.
 * - {@link placeAll} / {@link orderQueue} — evaluate the table per PR, then
 *   order: owner overrides at their positions, the admitted by rank then PR
 *   number (oldest first), the handed-back last.
 *
 * T3 follows Ananthanarayanan et al., *Keeping Master Green at Scale*,
 * EuroSys '19.
 *
 * @module cat-harness/scripts/merge-queue
 * @covers none — a library the merge steward and the tile call; it judges no declared graph
 */
import { join } from "node:path";
import { classify } from "./merge-conflict-patterns.ts";
import { evaluate, loadDecisionTable, type DecisionTable } from "../src/workflow/decision-table.ts";
import {
  MemberFactsSchema,
  PriorityClassSchema,
  type MemberFacts,
  type PriorityClass,
  type Readiness,
} from "../schemas/sdlc/merge-queue.ts";
import { ownDirectoryById } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { harnessRel } from "./lib/harness-layout.ts";

/**
 * The table, beside the diagram whose gateway reads it: in the `sdlc`
 * sub-graph's processes graph, looked up by its declared id (cat-harness#991
 * step 23.2), with the conventional path as the fallback.
 */
// declared-path-literal: the fallback only — the directory is read by its declared id `sdlc-processes`; the literal is the convention when the `sdlc` sub-graph is not declared, at the call site so the choice is visible.
export const PRIORITY_DMN = join(ownDirectoryById(HARNESS_ROOT, "sdlc-processes", harnessRel("sdlc/processes")), "decisions", "merge-priority.dmn");
export const PRIORITY_DECISION = "Decision_MergePriority";

/**
 * The beans whose descendants SEED THE branches/ REPOS — input (a). The
 * separation goal and its arc. A bean id, not a title: ids are stable.
 */
export const SEPARATION_ROOTS: readonly string[] = ["folio-assistant-vuip", "folio-assistant-7x5n"];

/**
 * Provisional size band (input (d)). "small" is at most this many AUTHORED
 * paths and this many changed lines. Provisional on purpose: T4 (risk-based
 * train size) waits for train-run records (R10) before any threshold here is
 * tuned, since setting one without data is guessing.
 */
export const SMALL_AUTHORED_PATHS = 25;
export const SMALL_CHANGED_LINES = 5000;

/**
 * Shared declarations (T3): files whose change can alter what OTHER changes
 * mean — a schema, a generator, a layer declaration, a BPMN or DMN, the
 * package manifest, a CI workflow. Two PRs touching the same one are
 * predicted to conflict even when no line overlaps.
 */
const SHARED_DECLARATION: readonly RegExp[] = [
  /(^|\/)schemas\/.+\.ts$/,
  /(^|\/)scripts\/gen-[^/]+\.ts$/,
  /\.(bpmn|dmn)$/,
  /^\.github\/workflows\//,
  /^[^/]+\.json$/, // a root declaration, package.json
  /^([^/]+)\/\1\.json$/, // `<instance>/<instance>.json`
];

/** The changed paths a declared merge pattern would REFUSE — the authored ones (R7). */
export function authoredPaths(files: readonly string[]): string[] {
  return files.filter((f) => classify(f).strategy === "refuse");
}

/** Does this path declare something other changes depend on? (T3) */
export function isSharedDeclaration(path: string): boolean {
  return SHARED_DECLARATION.some((re) => re.test(path));
}

export function touchesShared(authored: readonly string[]): boolean {
  return authored.some(isSharedDeclaration);
}

/** Does `bean` descend from any of `roots`? Walks `parentOf`, stopping on a cycle. */
export function descendsFrom(
  bean: string,
  roots: readonly string[],
  parentOf: (id: string) => string | undefined,
): boolean {
  const seen = new Set<string>();
  for (let cur: string | undefined = bean; cur && !seen.has(cur); cur = parentOf(cur)) {
    if (roots.includes(cur)) return true;
    seen.add(cur);
  }
  return false;
}

/** What GitHub and the checkout say about one PR, read live by the caller. */
export interface LivePr {
  pr: number;
  /** Every changed path. */
  files: string[];
  additions: number;
  deletions: number;
  /** Beans the PR serves: the queue entry's `beans`, plus ids its body names. */
  beans: string[];
  labels: string[];
  /** The PR's own CI on its head (T2). */
  ownCi?: "green" | "red" | "missing-required" | "none" | "unknown";
  /** Did CI run on the head that would be merged (T2). */
  headShaMatchesCi?: boolean;
  /** Still a draft. Bean `uoob`. */
  draft: boolean;
  /** The base branch's name. Anything but `main` is `not-main` (#1937). */
  baseRef: string;
  /**
   * The sha named by the latest `ready: <sha>` comment, as written (it may be
   * abbreviated). Absent when there is none (#1960, #1957).
   */
  readySha?: string;
  /** The session that SIGNED that comment (its footer's session link). Absent when unsigned (#1937). */
  readyBy?: string;
  /** The head sha. With it, a marker the head has moved past is `stale-marker`. */
  headSha?: string;
  /** The PR's own session, from its body. With it, a marker signed by another session is `foreign-marker`. */
  session?: string;
}

/**
 * {@link MemberFacts}`.readiness` from the live PR — the cheap half of
 * `merge:guard`'s checks 1-3, for placement. The guard asks the full
 * question at the moment of merging; see the schema for where they differ.
 */
export function readinessOf(p: LivePr): Readiness {
  if (p.draft) return "draft";
  if (p.baseRef !== "main") return "not-main";
  if (!p.readySha) return "no-marker";
  if (!p.readyBy || (p.session !== undefined && p.readyBy !== p.session)) return "foreign-marker";
  if (p.headSha !== undefined && !p.headSha.toLowerCase().startsWith(p.readySha.toLowerCase())) return "stale-marker";
  return "ready";
}

export interface FactContext {
  /** Parent of a bean, from the store. */
  parentOf: (id: string) => string | undefined;
  /** PRs a declared merge pattern refuses against current main, or with an un-cleared ejection. */
  refused: ReadonlySet<number>;
  /** PRs the owner placed by hand (their entries carry the position and reason). */
  overridden?: ReadonlySet<number>;
  /** Input (b), per PR: open PRs or beans it unblocks, or tangle edges it removes. */
  unblocks?: ReadonlyMap<number, number>;
  /** Labels that mark MVP / feature-priority work — input (c). */
  mvpLabels?: readonly string[];
  /** Beans that mark MVP / feature-priority work, by ancestry — input (c). */
  mvpRoots?: readonly string[];
  /** Override {@link SEPARATION_ROOTS}, for a fixture. */
  separationRoots?: readonly string[];
}

/**
 * The table's inputs for every PR in the candidate set.
 *
 * `conflictRisk` is PAIRWISE (T3): "high" when the PR shares an authored path
 * with another candidate that is not itself refused — a refused PR does not
 * enter a train, so it cannot conflict in one.
 *
 * **That sentence read "or the same shared declaration" until 2026-10-02 and
 * the code never did it**, which is the worse of the two possible errors: a
 * reader checking whether declarations were handled would have found a
 * promise, stopped looking, and shipped a steward that trains every pair
 * touching `package.json`. Declarations are carried by `touchesShared`, as
 * its own DMN input, and distinguished by `overlapKind`.
 *
 * `overlapKind` says WHICH KIND the collision is, which is the question a
 * steward actually has: `conflictRisk` answers "is there one". The two are
 * computed from the same pass so they cannot disagree.
 */
export function deriveFacts(prs: readonly LivePr[], ctx: FactContext): MemberFacts[] {
  const roots = ctx.separationRoots ?? SEPARATION_ROOTS;
  const authoredBy = new Map(prs.map((p) => [p.pr, authoredPaths(p.files)]));
  const live = prs.filter((p) => !ctx.refused.has(p.pr));

  return prs.map((p) => {
    const authored = authoredBy.get(p.pr)!;
    const mine = new Set(authored);
    const others = live.filter((q) => q.pr !== p.pr);
    /** Authored paths this PR shares with a live member — the train-worthy kind. */
    const sharedAuthored = others.flatMap((q) =>
      authoredBy.get(q.pr)!.filter((path) => mine.has(path)),
    );
    const overlaps = sharedAuthored.length > 0;
    /**
     * Any path at all shared with a live member. Computed over ALL changed
     * files rather than the authored ones, because a generated-only collision
     * is invisible to `authoredPaths` by construction and it is exactly the
     * case that must NOT read as "no overlap": it needs a regeneration.
     */
    const allMine = new Set(p.files);
    const sharesAnyPath = others.some((q) => q.files.some((f) => allMine.has(f)));
    const overlapKind: MemberFacts["overlapKind"] =
      sharedAuthored.some((f) => !isSharedDeclaration(f))
        ? "authored"
        : overlaps
          ? "shared-declaration"
          : sharesAnyPath
            ? "generated-only"
            : "none";
    const harness = authored.some((f) => /^cat-harness(-tools)?\//.test(f));
    const facts: MemberFacts = {
      pr: p.pr,
      authoredPaths: authored,
      touchesShared: touchesShared(authored),
      touchesHarness: harness,
      seedsStaging: harness && p.beans.some((b) => descendsFrom(b, roots, ctx.parentOf)),
      unblocks: ctx.unblocks?.get(p.pr) ?? 0,
      mvp:
        p.labels.some((l) => (ctx.mvpLabels ?? []).includes(l)) ||
        p.beans.some((b) => descendsFrom(b, ctx.mvpRoots ?? [], ctx.parentOf)),
      sizeBand:
        authored.length <= SMALL_AUTHORED_PATHS && p.additions + p.deletions <= SMALL_CHANGED_LINES
          ? "small"
          : "large",
      conflictRisk: overlaps ? "high" : "low",
      overlapKind,
      refused: ctx.refused.has(p.pr),
      ownCi: p.ownCi ?? "none",
      headShaMatchesCi: p.headShaMatchesCi ?? false,
      readiness: readinessOf(p),
    };
    return MemberFactsSchema.parse(facts);
  });
}

/** What the table returned for one PR. */
export interface Placed {
  pr: number;
  route: "admit" | "hand back";
  class: PriorityClass;
  rank: number;
  train: "shared" | "alone";
  /** The rule that fired — what a queue entry records as `placement.rule`. */
  rule: string;
}

export async function loadPriorityTable(): Promise<DecisionTable> {
  return loadDecisionTable(PRIORITY_DMN, PRIORITY_DECISION);
}

/** Evaluate the table for each PR. `ownerOverride` is true only for PRs in `overridden`. */
export function placeAll(
  table: DecisionTable,
  facts: readonly MemberFacts[],
  overridden: ReadonlySet<number> = new Set(),
): Placed[] {
  return facts.map((f) => {
    const r = evaluate(table, { ...f, ownerOverride: overridden.has(f.pr) });
    return {
      pr: f.pr,
      route: r.outputs.route as Placed["route"],
      class: PriorityClassSchema.parse(r.outputs.class),
      rank: Number(r.outputs.rank),
      train: r.outputs.train as Placed["train"],
      rule: r.rule,
    };
  });
}

/**
 * The queue, in order.
 *
 * Owner overrides take their 1-based `positions`; everything else admitted
 * fills the remaining slots by rank, then PR number (oldest first); handed-back
 * PRs come last, in PR order, because they are not in a train at all.
 */
export function orderQueue(placed: readonly Placed[], positions: ReadonlyMap<number, number> = new Map()): Placed[] {
  const byRank = (a: Placed, b: Placed) => a.rank - b.rank || a.pr - b.pr;
  const overrides = placed
    .filter((p) => p.class === "override")
    .sort((a, b) => (positions.get(a.pr) ?? Infinity) - (positions.get(b.pr) ?? Infinity) || a.pr - b.pr);
  const admitted = placed.filter((p) => p.route === "admit" && p.class !== "override").sort(byRank);
  for (const o of overrides) {
    const at = Math.min(Math.max((positions.get(o.pr) ?? admitted.length + 1) - 1, 0), admitted.length);
    admitted.splice(at, 0, o);
  }
  const handedBack = placed.filter((p) => p.route === "hand back").sort((a, b) => a.pr - b.pr);
  return [...admitted, ...handedBack];
}
