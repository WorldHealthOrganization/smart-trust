#!/usr/bin/env bun
/**
 * The merge queue's ORDER, as a command.
 *
 * `merge-queue.ts` derives each candidate's facts, evaluates
 * `sdlc/processes/decisions/merge-priority.dmn` and orders the result; this
 * is its command-line entry point.
 *
 * This command READS and prints. It merges nothing and writes no queue entry:
 * what the steward acts on is recorded by the steward, and the facts stay
 * GitHub's.
 *
 * Usage:
 *   bun run cat merge:steward              # the ordered queue, as a table
 *   bun run cat merge:steward --json       # the same, machine-readable
 *   bun run cat merge:steward --base <ref> # order against a ref other than origin/main
 *
 * @module cat-harness/scripts/merge-steward
 * @covers none — a steward's reader over GitHub and the bean store; it judges no declared graph
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GITHUB_WORKFLOW_DIR, triggerFor } from "../src/core/workflow-events.ts";

import { readBeanStore } from "./bean-store-read.ts";
import { classify } from "./merge-conflict-patterns.ts";
import { readyMarkers, type GhComment } from "./merge-guard.ts";
import { holdInForce, readQueueEntries } from "./merge-queue-store.ts";
import { releaseCovers, type MergeQueueEntry } from "../schemas/sdlc/merge-queue.ts";
import {
  deriveFacts,
  loadPriorityTable,
  orderQueue,
  placeAll,
  type LivePr,
} from "./merge-queue.ts";

const REPO = "litlfred/folio-assistant";

/** The two workflows whose runs GATE a merge here. Feature Staging is preview-only. */
const GATING = ["code-quality-gates.yml", "jsonld-gen-check.yml"] as const;

function run(cmd: string, args: string[]): { out: string; status: number } {
  const r = spawnSync(cmd, args, { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
  return { out: r.stdout ?? "", status: r.status ?? 1 };
}

function gh(path: string): unknown | null {
  const { out, status } = run("gh", ["api", path]);
  if (status !== 0) return null;
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

/**
 * The path out of one of `git merge-tree`'s CONFLICT lines, or `null` when the
 * form is one this function does not know.
 *
 * Three forms are emitted, not one, and they do not share a shape:
 *
 *   CONFLICT (content): Merge conflict in <path>
 *   CONFLICT (submodule): Merge conflict in <path>
 *   CONFLICT (modify/delete): <path> deleted in <rev> and modified in <rev>. ...
 *
 * `null` rather than the raw line, because the caller's next move is to ask
 * `merge-conflict-patterns` whether the path is authored — and a line read as a
 * path matches no pattern, so a parser gap would present as an authored
 * conflict in somebody's PR.
 */
export function conflictPath(line: string): string | null {
  const inForm = /^CONFLICT \([^)]*\): Merge conflict in (.+)$/.exec(line);
  if (inForm) return inForm[1].trim();
  const modifyDelete = /^CONFLICT \(modify\/delete\): (.+?) deleted in .+ and modified in /.exec(line);
  if (modifyDelete) return modifyDelete[1].trim();
  const renamed = /^CONFLICT \(rename\/[^)]*\): .*?\brenamed to (.+?) in /.exec(line);
  if (renamed) return renamed[1].trim();
  return null;
}

/**
 * Does this PR merge cleanly enough for the queue to consider it?
 *
 * Three states, never two. `git merge-tree --write-tree` exits 0 clean, 1 on
 * CONFLICT and >=2 on ERROR — and an error is NOT clean, which is the reading
 * that bean `0s6w` was filed for. A conflict whose every path classifies to a
 * declared pattern is not a refusal: `merge:main` resolves those mechanically,
 * so only an AUTHORED or undeclared conflict refuses.
 */
function refusalFor(base: string, pr: number): "clean" | "declared" | "refused" | "unknown" {
  const fetched = run("git", ["fetch", "origin", `refs/pull/${pr}/head:refs/tmp/steward${pr}`, "-q", "--force"]);
  if (fetched.status !== 0) return "unknown";
  const mt = run("git", ["merge-tree", "--write-tree", base, `refs/tmp/steward${pr}`]);
  if (mt.status === 0) return "clean";
  if (mt.status !== 1) return "unknown";
  const lines = mt.out.split("\n").filter((l) => l.startsWith("CONFLICT"));
  if (lines.length === 0) return "unknown";
  const conflicted: string[] = [];
  for (const line of lines) {
    const path = conflictPath(line);
    // An unrecognised CONFLICT form must NOT be handed to `classify` as if the
    // whole line were a path: it matches no declared pattern, so it would be
    // counted a refusal and the PR blamed for a parser gap. Measured
    // 2026-10-04 on #1790, where 8 of 11 reported refusals were
    // `CONFLICT (modify/delete)` lines read as filenames.
    if (path === null) return "unknown";
    conflicted.push(path);
  }
  return conflicted.some((p) => classify(p).strategy === "refuse") ? "refused" : "declared";
}

/** Whether a gating workflow is behind a `paths`/`branches`/`types` filter for `pull_request`. */
function conditional(wf: string): boolean {
  const root = run("git", ["rev-parse", "--show-toplevel"]).out.trim();
  const file = join(GITHUB_WORKFLOW_DIR, wf);
  try {
    return triggerFor(file, readFileSync(join(root, file), "utf-8"), "pull_request").requirement === "conditional";
  } catch {
    return false; // unreadable: keep it owed, never silently waive a gate
  }
}

/**
 * The PR's own CI on its head, by the five values `LivePr.ownCi` names.
 *
 * A bot-actor push leaves the `pull_request` runs at `action_required` with
 * ZERO jobs executed (bean `0qjq`), and `merge:main` dispatches the gating
 * workflows for exactly that reason — so a dispatched success IS the evidence
 * here, and a run that never executed is not a failure. `missing-required`
 * therefore means a gating workflow has no completed run at all, and `red`
 * means one completed and failed.
 */
function ciFor(headSha: string): { ownCi: NonNullable<LivePr["ownCi"]>; missing: string[] } {
  const runs = gh(`repos/${REPO}/actions/runs?head_sha=${headSha}&per_page=100`) as
    | { workflow_runs?: { path?: string; status?: string; conclusion?: string }[] }
    | null;
  if (runs?.workflow_runs === undefined) return { ownCi: "unknown", missing: [] };
  const all = runs.workflow_runs;
  if (all.length === 0) return { ownCi: "none", missing: [...GATING] };
  const missing: string[] = [];
  let red = false;
  for (const wf of GATING) {
    const mine = all.filter((r) => (r.path ?? "").endsWith(wf) && r.status === "completed");
    if (mine.some((r) => r.conclusion === "failure")) red = true;
    else if (!mine.some((r) => r.conclusion === "success")) {
      // A `paths`-filtered workflow is owed only when the PR touches its
      // paths. With no run of it at all on this head, GitHub did not start
      // one, which is the filter's answer, not a missing gate. Measured
      // 2026-10-04: #2083 and #2084 (bean-only) read `missing-required` on
      // `jsonld-gen-check` while `check-head-has-run`, which reads triggers,
      // called them green. Same rule as its "conditional — not judged".
      const anyRun = all.some((r) => (r.path ?? "").endsWith(wf));
      if (!anyRun && conditional(wf)) continue;
      missing.push(wf);
    }
  }
  if (red) return { ownCi: "red", missing };
  return { ownCi: missing.length > 0 ? "missing-required" : "green", missing };
}

/**
 * The open hand-back bean for a PR, by the title `merge-conflict-patterns`
 * prescribes ("Merge refused: #<n> …"), or null when there is none.
 *
 * Owner, 2026-10-04, after a steward handed back a dozen PRs with a PR
 * comment and a queue entry but no bean: *"why did you have a process failure
 * here?"*, then "Backfill + enforce". A hand-back the work plan cannot see is
 * one the submitting role never picks up, so the table now names the gap
 * instead of trusting the steward to remember it.
 */
export function handBackBeanFor(store: ReturnType<typeof readBeanStore>, pr: number): string | null {
  if (store.state !== "read") return null;
  const hit = store.beans.find(
    (b) => b.title.startsWith(`Merge refused: #${pr} `) && b.status !== "completed" && b.status !== "scrapped",
  );
  return hit ? hit.id : null;
}

/** Bean ids a PR body names, in this repo's `folio-assistant-xxxx` form. */
function beansNamed(body: string): string[] {
  return [...new Set((body.match(/folio-assistant-[0-9a-z]{4}/g) ?? []))];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const baseAt = argv.indexOf("--base");
  const base = baseAt >= 0 ? (argv[baseAt + 1] ?? "origin/main") : "origin/main";

  run("git", ["fetch", "origin", "main", "-q"]);
  const baseSha = run("git", ["rev-parse", base]).out.trim();
  if (!baseSha) {
    console.error(`merge:steward — COULD NOT ASK: \`${base}\` does not resolve here.`);
    process.exit(2);
  }

  const open = gh(`repos/${REPO}/pulls?state=open&per_page=100`) as
    | { number: number; draft: boolean; title: string; body: string | null; head: { sha: string }; base: { ref: string }; labels: { name: string }[] }[]
    | null;
  if (open === null) {
    console.error("merge:steward — COULD NOT ASK: the pulls endpoint did not answer. This is not an empty queue.");
    process.exit(2);
  }

  const candidates = open.filter((p) => !p.draft);
  const prs: LivePr[] = [];
  const refusedSet = new Set<number>();
  const conflictState = new Map<number, string>();
  const missingByPr = new Map<number, string[]>();
  const headByPr = new Map<number, string>();

  for (const p of candidates) {
    headByPr.set(p.number, p.head.sha);
    const files = gh(`repos/${REPO}/pulls/${p.number}/files?per_page=100`) as
      | { filename: string; additions: number; deletions: number }[]
      | null;
    const r = refusalFor(baseSha, p.number);
    conflictState.set(p.number, r);
    if (r === "refused" || r === "unknown") refusedSet.add(p.number);
    const { ownCi, missing } = ciFor(p.head.sha);
    const comments = gh(`repos/${REPO}/issues/${p.number}/comments?per_page=100`) as GhComment[] | null;
    const marker = readyMarkers(comments ?? []).at(-1);
    missingByPr.set(p.number, missing);
    prs.push({
      pr: p.number,
      files: (files ?? []).map((f) => f.filename),
      additions: (files ?? []).reduce((a, f) => a + f.additions, 0),
      deletions: (files ?? []).reduce((a, f) => a + f.deletions, 0),
      beans: beansNamed(`${p.title}\n${p.body ?? ""}`),
      labels: p.labels.map((l) => l.name),
      ownCi,
      headShaMatchesCi: ownCi === "green",
      // Readiness inputs for `Rule_NotReady` (bean `uoob`): the latest
      // `ready:` comment and who signed it. `headSha` is deliberately NOT
      // passed: `readinessOf` would call every marker followed by a
      // merge-main bot merge `stale-marker`, and the bot merges main into
      // nearly every open PR. `merge:guard` asks the full question, bot
      // merges allowed, at the moment of merging.
      draft: p.draft,
      baseRef: p.base.ref,
      readySha: marker?.sha,
      readyBy: marker?.session,
    });
  }

  const store = readBeanStore(process.cwd());
  const parents = new Map<string, string>();
  if (store.state === "read") for (const b of store.beans) if (b.parent) parents.set(b.id, b.parent);

  // THE RECORDED DECISIONS, read back into the sweep. `placeAll` and
  // `orderQueue` have taken `overridden` and `positions` since they were
  // written, and this command passed NEITHER (measured 2026-10-04, bean
  // `najo`): an owner override recorded in the queue changed nothing about the
  // order this printed, so the store was write-only and the table's
  // `ownerOverride` input was permanently false. A decision nobody reads back
  // is a decision nobody took.
  //
  // THROWS when the queue cannot be reached, rather than ordering the queue as
  // if no decision had ever been made — `dh4f`. An absent queue (`null`) is a
  // different and legitimate answer.
  const queue = readQueueEntries(process.cwd()) ?? [];
  const overridden = new Set<number>();
  const positions = new Map<number, number>();
  const heldUntil = new Map<number, string>();
  // A person's merge decision, read back against the LIVE head (bean `ixmq`):
  // a release given for a different commit is void, and says so.
  const releaseByPr = new Map<number, string>();
  for (const { entry: e } of queue) {
    const head = headByPr.get(e.pr);
    if (head !== undefined) releaseByPr.set(e.pr, releaseState(e, head));
    if (e.placement.kind === "override") {
      overridden.add(e.pr);
      positions.set(e.pr, e.placement.position);
    }
    // An ejection with no later placement keeps the PR out of a train: that is
    // `FactContext.refused`'s own second clause, "or with an un-cleared
    // ejection". Cleared by recording a new entry for the PR.
    if (e.ejection !== undefined) refusedSet.add(e.pr);
    if (holdInForce(e)) heldUntil.set(e.pr, e.hold!.expires);
  }

  const facts = deriveFacts(prs, {
    parentOf: (id) => parents.get(id),
    refused: refusedSet,
    overridden,
    mvpLabels: ["mvp", "milestone:status", "ready-to-merge"],
  });
  const ordered = orderQueue(placeAll(await loadPriorityTable(), facts, overridden), positions);
  const handBack = new Map<number, string | null>();
  for (const p of ordered) if (p.route === "hand back") handBack.set(p.pr, handBackBeanFor(store, p.pr));

  if (json) {
    console.log(
      JSON.stringify(
        {
          base,
          baseSha,
          beanStore: store.state,
          recordedDecisions: queue.length,
          queue: ordered.map((p) => ({
            ...p,
            conflict: conflictState.get(p.pr),
            ownCi: prs.find((q) => q.pr === p.pr)?.ownCi,
            missingGating: missingByPr.get(p.pr) ?? [],
            ...(positions.has(p.pr) ? { overridePosition: positions.get(p.pr) } : {}),
            ...(heldUntil.has(p.pr) ? { heldUntil: heldUntil.get(p.pr) } : {}),
            release: releaseByPr.get(p.pr) ?? "none",
            ...(handBack.has(p.pr) ? { handBackBean: handBack.get(p.pr) } : {}),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`merge:steward — ${ordered.length} candidate(s) against ${base} (${baseSha.slice(0, 11)})`);
  if (store.state !== "read") {
    console.log(`  ! the bean store reads \`${store.state}\`, so input (a) seedsStaging could not be computed from ancestry`);
  }
  // Printed even when zero, because "no decision has been recorded" and "the
  // decisions were not read" are different facts and this is where a steward
  // would notice the second. `readQueueEntries` throws for the unreachable
  // case, so a zero here is a determined zero.
  const released = [...releaseByPr.values()].filter((v) => v.startsWith("merge@")).length;
  console.log(`  ${queue.length} recorded queue decision(s) read back: ${overridden.size} override(s), ${heldUntil.size} live hold(s), ${released} human release(s) covering the live head`);
  console.log("");
  console.log("  #     route      class        rank  train  conflict   CI               rule");
  for (const p of ordered) {
    const ci = prs.find((q) => q.pr === p.pr)?.ownCi ?? "unknown";
    const miss = missingByPr.get(p.pr) ?? [];
    const ciText = ci === "missing-required" ? `missing-required(${miss.length})` : ci;
    const held = heldUntil.get(p.pr);
    if (held !== undefined) console.log(`  ${p.pr} is HELD until ${held} by a recorded decision — not taken into a train`);
    const rel = releaseByPr.get(p.pr);
    if (rel !== undefined && rel !== "none") console.log(`  ${p.pr} release: ${rel}`);
    console.log(
      `  ${String(p.pr).padEnd(6)}${String(p.route).padEnd(11)}${String(p.class).padEnd(13)}${String(p.rank).padEnd(6)}${String(p.train ?? "-").padEnd(7)}${String(conflictState.get(p.pr)).padEnd(11)}${ciText.padEnd(17)}${p.rule}`,
    );
  }
  console.log("");
  const missingHandBack = [...handBack].filter(([, id]) => id === null).map(([pr]) => pr);
  if (store.state !== "read") {
    console.log(`  ? hand-back beans could not be checked: the bean store reads \`${store.state}\``);
  } else if (missingHandBack.length > 0) {
    console.log(`  ✗ handed back with NO open hand-back bean: ${missingHandBack.map((n) => `#${n}`).join(", ")}`);
    console.log("    Each needs one: merge-conflict-patterns §\"When a merge-train member is refused\" (title \"Merge refused: #<n> …\").");
  } else if (handBack.size > 0) {
    console.log(`  ✓ every handed-back PR (${handBack.size}) has an open hand-back bean`);
  }
  console.log("");
  console.log("`conflict`: clean | declared (merge:main resolves it) | refused (authored) | unknown.");
  console.log("`CI`: green needs a COMPLETED success for each gating workflow on this exact head.");
  console.log("A run held at `action_required` executed no jobs and is neither a pass nor a failure —");
  console.log("bean `0qjq`; merge:main dispatches the gating workflows for that reason.");
  console.log("Nothing here merges anything. The order is the table's answer, not this file's.");
}

// Only when RUN, never when imported. `conflictPath` is exported for its tests,
// and a bare `await main()` made importing this module execute the whole
// command — the parser test took 38s and called the GitHub API before it
// asserted anything.
if (import.meta.main) await main();

/**
 * One PR's human release, as the steward prints it: `none`, `merge@<sha>`
 * (covers the live head), `do-not-merge`, or `VOID` with both commits named.
 */
export function releaseState(entry: Pick<MergeQueueEntry, "release">, head: string): string {
  const c = releaseCovers(entry, head);
  if (c.ok) return `merge@${head.slice(0, 12)} (${entry.release!.decidedBy})`;
  if (c.why === "none") return "none";
  if (c.why === "do-not-merge") return `do-not-merge — ${c.detail}`;
  return `VOID — ${c.detail}`;
}
