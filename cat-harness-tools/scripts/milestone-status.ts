#!/usr/bin/env bun
/**
 * How far is this repository from the separation point (seeding the repos),
 * in two parts that must not be read as one number?
 *
 * **Part 1 — the declared milestones.** Every `type: milestone` bean, rolled up
 * over the closure beneath it. This is the PLAN's progress, and it is reported
 * rather than graded.
 *
 * **Part 2 — mechanical readiness.** The gates that say whether the tree is in
 * a state the repos can be seeded FROM. These are graded, and they set the exit
 * code.
 *
 * A milestone share is bean-weighted and says how much of a GOAL is done; a
 * readiness gate is a precondition (`0 authored conflicts` is not 40 % done
 * when there are 40). Averaging them would produce a figure that is neither.
 * The report is named after `milestone`, the `type` the bean store declares,
 * not "MVP", which nothing here declares.
 *
 * The report states what the shares do NOT cover: `orphanOpen`, the open
 * beans with no milestone above them. Whether those belong under a milestone
 * is the owner's scope call, so the report proposes nothing.
 *
 * @module scripts/milestone-status
 * @graphNode none — a read-only report over git, the bean store and the forge
 * @covers none — a merge-steward report: it inventories, it judges no declared graph
 *
 * ## It COMPOSES the existing measurements — it does not take new ones
 *
 * Every gate below delegates:
 *
 * - `pathClass` from `merge-pipeline-paths.ts` decides generated vs authored,
 *   so this cannot disagree with `merge:train`, `merge:overlap` or
 *   `beans:rollover` about what "authored" means;
 * - `check:head-has-run` answers whether a head carries the runs it owes,
 *   including the three causes of an absent run — invoked as a subprocess and
 *   read by EXIT CODE, because its own contract already distinguishes
 *   could-not-ask (2) from missing-a-required-run (1);
 * - `beans:rollover --json` answers the bean-rollover gate, read from its
 *   structured summary rather than its printed table.
 *
 * ## Four states per gate, and the fourth is never a pass
 *
 * | state | meaning |
 * |---|---|
 * | `clear` | the gate's value has reached its target |
 * | `blocked` | it has not, and the blocker is named |
 * | `reported` | measured on purpose but NOT graded — a rate, not a threshold |
 * | `could-not-determine` | the question could not be answered. **Never counted clear** |
 *
 * `reported` is for rates with no target: "beans created in the window" says
 * scope is still arriving, which is a fact about the plan, not a defect to
 * drive to zero.
 *
 * ## Every threshold carries its BASIS, structurally
 *
 * Each gate declares `basis`: where its target comes from. It is part of the
 * shape, so no check can ship a bare number.
 *
 * ## It is NOT a committed sidecar
 *
 * Every value is a function of the OPEN PRs and the current head, so a
 * committed copy would change on every commit and conflict on every merge. A
 * gate that cannot be answered reports `could-not-determine` in the run
 * itself. So: printed for a person, `--json` for a dashboard that renders it.
 *
 * Usage:
 *   bun run cat milestone:status                  # the table
 *   bun run cat milestone:status -- --json        # the same, as JSON on stdout
 *   bun run cat milestone:status -- --window 9    # the "active" window in hours (default 9)
 *   bun run cat milestone:status -- --bar        # JUST the milestone bars, one line each
 *   bun run cat milestone:status -- --no-fetch    # skip the fetch (faster, may be stale)
 *   bun run cat milestone:status -- --skip gate-evidence   # omit a slow gate
 *
 * Exit 0 every gate clear · 1 at least one blocked · 2 at least one
 * could-not-determine (which outranks blocked: a sweep blind on one gate has
 * not cleared the others).
 */
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import { readdirSync, readFileSync } from "node:fs";

import { readBeans } from "./beans.ts";
import { milestoneRollup, type MilestoneReport } from "./milestone-rollup.ts";
import { git } from "./merge-pipeline-git.ts";
import { pathClass } from "./merge-pipeline-paths.ts";
import { repoRootFor } from "../schemas/kg/cat-harness.ts";
import { beanDefsDir } from "./beans.ts";

const ROOT = repoRootFor(join(import.meta.dir, ".."));
const REPO = "litlfred/folio-assistant";

export type GateState = "clear" | "blocked" | "reported" | "could-not-determine";

export interface Gate {
  id: string;
  /** The question, as a person would ask it. */
  question: string;
  state: GateState;
  /** The measured value, rendered for a reader. */
  value: string;
  /** What the value must reach to be `clear`; absent for a `reported` gate. */
  target?: string;
  /** WHERE the target comes from. A target without this is a preference. */
  basis: string;
  /** Named blockers, when the gate is blocked — never a bare count. */
  detail?: string[];
}

interface Pr {
  number: number;
  ref: string;
  sha: string;
  draft: boolean;
  labels: string[];
  pushedAt: string;
}

/** The open PRs, or undefined when the forge could not be asked. */
function openPrs(): Pr[] | undefined {
  const r = spawnSync("gh", ["api", `repos/${REPO}/pulls?state=open&per_page=100`], {
    encoding: "utf-8",
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) return undefined;
  try {
    const d = JSON.parse(r.stdout) as Array<{
      number: number;
      draft: boolean;
      head: { ref: string; sha: string };
      labels: Array<{ name: string }>;
      updated_at: string;
    }>;
    return d.map((p) => ({
      number: p.number,
      ref: p.head.ref,
      sha: p.head.sha,
      draft: p.draft,
      labels: p.labels.map((l) => l.name),
      pushedAt: p.updated_at,
    }));
  } catch {
    return undefined;
  }
}

/**
 * The conflicting paths of `sha` against the base, split by class.
 *
 * The exit code is NOT the whole contract, and this said it was. 0 is clean
 * and 1 is CONFLICT — but `git merge-tree --write-tree` (git 2.43) also exits
 * **1** for a ref it cannot merge, an unfetched sha or a typo, printing
 * "not something we can merge" to stderr and NO tree on stdout. Read by code
 * alone, that was "conflicted, with no conflicted paths": no authored
 * contention, so an unfetched PR head counted as clean instead of
 * undetermined (bean `0s6w`). A real result always opens with the merged
 * tree's id, so that line decides; without it the answer is `undefined`.
 */
export function conflicts(base: string, sha: string, root: string = ROOT): { authored: string[]; generated: number } | undefined {
  const r = git(root, ["merge-tree", "--write-tree", "--name-only", "--no-messages", base, sha]);
  if (r.code !== 0 && r.code !== 1) return undefined;
  const lines = r.out.split("\n").filter(Boolean);
  if (!/^[0-9a-f]{40,64}$/.test(lines[0] ?? "")) return undefined;
  if (r.code === 0) return { authored: [], generated: 0 };
  const authored: string[] = [];
  let generated = 0;
  for (const p of new Set(lines.slice(1))) {
    if (pathClass(p).class === "authored") authored.push(p);
    else generated++;
  }
  return { authored, generated };
}

/**
 * The bean store, through its declaration rather than a spelled `beans/defs`
 * (bean `gz47`). `undefined` when no bean-defs node is declared: every reader
 * below then reports could-not-determine rather than an empty store.
 */
function defsDir(): string | undefined {
  return beanDefsDir(ROOT) ?? undefined;
}

/** Bean files on `rev`, by id. */
function beansOn(rev: string): Set<string> | undefined {
  const dir = defsDir();
  if (dir === undefined) return undefined;
  const r = git(ROOT, ["ls-tree", "--name-only", rev, `${relative(ROOT, dir)}/`]);
  if (!r.ok) return undefined;
  const ids = new Set<string>();
  for (const line of r.out.split("\n")) {
    const m = /folio-assistant-([a-z0-9]{4})--/.exec(line);
    if (m) ids.add(m[1]!);
  }
  return ids;
}

/** GATE: is the plan itself on `main`, or only on branches? */
function gatePlanOnMain(base: string, prs: readonly Pr[]): Gate {
  const basis =
    "an MVP of the active feature set cannot be stated from `main` while the beans that define it exist only on branches; measured by comparing bean ids per head against the base";
  const onMain = beansOn(base);
  if (!onMain) {
    return { id: "plan-on-main", question: "Is the work plan itself on main?", state: "could-not-determine", value: "git would not list the base's beans", basis };
  }
  const offMain = new Map<string, number[]>();
  let undetermined = 0;
  for (const p of prs) {
    const here = beansOn(p.sha);
    if (!here) { undetermined++; continue; }
    for (const id of here) {
      if (!onMain.has(id)) {
        const seen = offMain.get(id) ?? [];
        seen.push(p.number);
        offMain.set(id, seen);
      }
    }
  }
  if (undetermined > 0 && offMain.size === 0) {
    return { id: "plan-on-main", question: "Is the work plan itself on main?", state: "could-not-determine", value: `${undetermined} head(s) could not be listed`, basis };
  }
  const detail = [...offMain.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)
    .map(([id, ns]) => `${id} — only on ${ns.map((n) => `#${n}`).join(", ")}`);
  if (undetermined > 0) detail.push(`${undetermined} head(s) COULD NOT BE LISTED — not counted either way`);
  return {
    id: "plan-on-main",
    question: "Is the work plan itself on main?",
    state: offMain.size === 0 && undetermined === 0 ? "clear" : offMain.size === 0 ? "could-not-determine" : "blocked",
    value: `${offMain.size} bean(s) exist only on open PR branches`,
    target: "0",
    basis,
    ...(detail.length ? { detail } : {}),
  };
}

/** GATE: how much genuine merge negotiation is left, as opposed to regeneration? */
function gateAuthoredConflicts(base: string, prs: readonly Pr[]): Gate {
  const basis =
    "a conflict in a generated file is resolved by re-running its generator, so only an AUTHORED conflict needs a person; classified by `pathClass`, the same function merge:train and merge:overlap use";
  const byPath = new Map<string, number[]>();
  let generated = 0;
  const undetermined: number[] = [];
  for (const p of prs) {
    const c = conflicts(base, p.sha);
    if (!c) { undetermined.push(p.number); continue; }
    generated += c.generated;
    for (const a of c.authored) {
      const seen = byPath.get(a) ?? [];
      seen.push(p.number);
      byPath.set(a, seen);
    }
  }
  const contended = [...byPath.entries()].filter(([, ns]) => ns.length > 1);
  const total = [...byPath.values()].reduce((n, ns) => n + ns.length, 0);
  const detail = contended
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8)
    .map(([p, ns]) => `${p} — contended by ${ns.map((n) => `#${n}`).join(", ")}`);
  if (undetermined.length) detail.push(`COULD NOT DETERMINE for ${undetermined.map((n) => `#${n}`).join(", ")} — merge-tree errored, which is not clean`);
  return {
    id: "authored-conflicts",
    question: "How many conflicts actually need a person?",
    state: undetermined.length ? "could-not-determine" : total === 0 ? "clear" : "blocked",
    value: `${total} authored conflict(s) across ${byPath.size} path(s); ${generated} generated`,
    target: "0 authored",
    basis,
    ...(detail.length ? { detail } : {}),
  };
}

/** GATE: does every open PR's head carry the gate runs it owes? */
function gateEvidence(prs: readonly Pr[]): Gate {
  const basis =
    "a head can carry a complete-looking green check set whose runs are all workflow_dispatch while the pull_request runs completed action_required and executed nothing (bean `0qjq`); `check:head-has-run` reconciles runs against the workflows the tree declares and exits 2 rather than guessing";
  const blocked: string[] = [];
  const undetermined: string[] = [];
  for (const p of prs) {
    const r = spawnSync("bun", ["run", "cat", "check:head-has-run", "--", p.sha], { cwd: ROOT, encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 });
    if (r.status === 0) continue;
    if (r.status === 1) blocked.push(`#${p.number} — missing a run it owes`);
    else undetermined.push(`#${p.number} — could not ask (exit ${r.status})`);
  }
  return {
    id: "gate-evidence",
    question: "Does every open PR's head carry the gate runs it owes?",
    state: undetermined.length ? "could-not-determine" : blocked.length === 0 ? "clear" : "blocked",
    value: `${prs.length - blocked.length - undetermined.length} of ${prs.length} head(s) carry their owed runs`,
    target: "every open PR",
    basis,
    ...(blocked.length || undetermined.length ? { detail: [...blocked.slice(0, 10), ...undetermined.slice(0, 6)] } : {}),
  };
}

/** GATE: the seeding gate itself — does any open PR still touch the tools layer? */
function gateSeeding(base: string, prs: readonly Pr[]): Gate {
  const basis =
    "seeding `cat-harness-tools` copies a tree, so a PR still editing that tree would be seeded from a base it does not match; measured on AUTHORED paths only, because a generated README region is regenerated after the move anyway";
  const touching: string[] = [];
  const undetermined: string[] = [];
  for (const p of prs) {
    const fork = git(ROOT, ["merge-base", base, p.sha]);
    if (!fork.ok) { undetermined.push(`#${p.number} — no merge base`); continue; }
    const names = git(ROOT, ["diff", "--name-only", `${fork.out.trim()}..${p.sha}`, "--", "cat-harness-tools/"]);
    if (!names.ok) { undetermined.push(`#${p.number} — git would not list its paths`); continue; }
    const authored = names.out.split("\n").map((s) => s.trim()).filter(Boolean).filter((f) => pathClass(f).class === "authored");
    if (authored.length) touching.push(`#${p.number} — ${authored.length} authored path(s): ${authored.slice(0, 3).join(", ")}`);
  }
  return {
    id: "seeding-gate",
    question: "Does any open PR still touch cat-harness-tools?",
    state: undetermined.length ? "could-not-determine" : touching.length === 0 ? "clear" : "blocked",
    value: `${touching.length} PR(s) with authored touches`,
    target: "0",
    basis,
    ...(touching.length || undetermined.length ? { detail: [...touching, ...undetermined] } : {}),
  };
}

/** GATE: does any bean edit still need a person before `beans/` can move? */
function gateBeanRollover(): Gate {
  const basis =
    "issue #1850 step 2: a bean path the base has not touched since the fork can be copied onto the beans branch without the PR landing, so only an `adjudicate` or `could-not-determine` needs a person; delegated to `beans:rollover --json` and read from its structured summary";
  // `--json`, NOT the printed table. The first version of this gate scraped
  // the table with /port\s+(\d+)/ and matched the first PER-PR line
  // ("port 1 · adjudicate 0") instead of the summary, so it reported
  // `clear` off a plausible wrong number while the real totals were 164 and 2.
  // A structured summary cannot be misread that way, and scraping a report
  // whose author also publishes JSON is choosing the fragile reader.
  const r = spawnSync("bun", ["run", "cat", "beans:rollover", "--", "--json"], { cwd: ROOT, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status === null) {
    return { id: "bean-rollover", question: "Does any bean edit still need a person?", state: "could-not-determine", value: "beans:rollover did not run", basis };
  }
  // bun prints its own banner line before the script's stdout; take the JSON object.
  const start = r.stdout?.indexOf("{") ?? -1;
  let summary: { port?: number; port_superset?: number; adjudicate?: number; could_not_determine?: number } | undefined;
  if (start >= 0) {
    try {
      summary = (JSON.parse(r.stdout!.slice(start)) as { summary?: typeof summary }).summary;
    } catch {
      summary = undefined;
    }
  }
  if (!summary || summary.adjudicate === undefined || summary.could_not_determine === undefined) {
    return { id: "bean-rollover", question: "Does any bean edit still need a person?", state: "could-not-determine", value: "beans:rollover's JSON summary could not be read", basis };
  }
  const needsAPerson = summary.adjudicate + summary.could_not_determine;
  const supersetPart = summary.port_superset ? ` (${summary.port_superset} superset)` : "";
  return {
    id: "bean-rollover",
    question: "Does any bean edit still need a person?",
    state: summary.could_not_determine > 0 ? "could-not-determine" : needsAPerson === 0 ? "clear" : "blocked",
    value: `${summary.adjudicate} adjudicate · ${summary.could_not_determine} could-not-determine · ${summary.port ?? "?"} portable${supersetPart}`,
    target: "0 adjudicate and 0 could-not-determine",
    basis,
  };
}

/** REPORTED, not graded: is scope still arriving? */
function reportScopeGrowth(windowHours: number): Gate {
  const basis =
    "REPORTED, never graded. A high value means scope is still arriving, which is a fact about the plan rather than a defect — grading it would invite somebody to stop writing beans. `audit:coverage` draws the same line for its share (bean `3yi4`)";
  const since = Date.now() - windowHours * 3600_000;
  let created = 0;
  let total = 0;
  try {
    const dir = defsDir();
    if (dir === undefined) throw new Error("no bean-defs node is declared");
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      total++;
      const head = readFileSync(join(dir, f), "utf-8").slice(0, 600);
      const m = /^created_at:\s*(\S+)/m.exec(head);
      if (m && Date.parse(m[1]!) >= since) created++;
    }
  } catch {
    return { id: "scope-growth", question: `How many beans were created in the last ${windowHours}h?`, state: "could-not-determine", value: "the bean store could not be read", basis };
  }
  return {
    id: "scope-growth",
    question: `How many beans were created in the last ${windowHours}h?`,
    state: "reported",
    value: `${created} of ${total} live bean file(s)`,
    basis,
  };
}

/** REPORTED, not graded: how many in-progress beans have somebody behind them? */
function reportHolders(): Gate {
  const basis =
    "REPORTED. `bun run cat beans:claim` writes a `Claimed by` note; `beans update --status in-progress` does not, so an unheld in-progress bean is invisible to the already-claimed check. Counted with the predicate `claim-bean.ts` itself uses";
  let inProgress = 0;
  let held = 0;
  try {
    const dir = defsDir();
    if (dir === undefined) throw new Error("no bean-defs node is declared");
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const body = readFileSync(join(dir, f), "utf-8");
      if (!/^status:\s*in-progress\s*$/m.test(body)) continue;
      inProgress++;
      if (/Claimed by (\S+)/.test(body)) held++;
    }
  } catch {
    return { id: "holders", question: "How many in-progress beans have a holder?", state: "could-not-determine", value: "the bean store could not be read", basis };
  }
  return {
    id: "holders",
    question: "How many in-progress beans have a holder?",
    state: "reported",
    value: `${held} of ${inProgress} carry a \`Claimed by\` note`,
    basis,
  };
}

/**
 * A milestone's SHORT name, for a one-line bar.
 *
 * The text before the first colon, because the three milestones here are
 * titled "GOAL 1: ...". Falls back to a truncation rather than to the id: a
 * reader scanning a bar wants the goal, and `folio-assistant-p5wm` is not it.
 * Nothing depends on the colon convention — a title without one still gets a
 * label.
 */
function shortLabel(title: string, width: number): string {
  const head = title.includes(":") ? title.slice(0, title.indexOf(":")) : title;
  return (head.length > width ? head.slice(0, width - 1) + "…" : head).padEnd(width);
}

/**
 * The compact status bar: one line per milestone, and the coverage beneath.
 *
 * ASCII blocks rather than a colour, because this is read in a terminal, in a
 * commit message and in a chat log, and two of those three drop colour. The
 * percentage is printed as a NUMBER beside the bar for the same reason the
 * board does it: a bar alone cannot be read to a precision anybody can quote.
 */
function renderBar(plan: MilestoneReport): string[] {
  const WIDTH = 24;
  const out: string[] = [];
  for (const m of plan.milestones) {
    const pct = m.share === null ? null : Math.round(m.share * 100);
    // `null` is not 0%: an empty milestone has nothing to measure, and a bar
    // of zero blocks would say its work is untouched.
    const filled = pct === null ? 0 : Math.round((pct / 100) * WIDTH);
    const bar = pct === null ? "·".repeat(WIDTH) : "█".repeat(filled) + "░".repeat(WIDTH - filled);
    const label = `${pct === null ? " n/a" : `${pct}%`.padStart(4)}`;
    out.push(
      `${shortLabel(m.title, 10)} [${bar}] ${label}  ${`${m.closed}/${m.closed + m.open}`.padStart(7)}  ${String(m.inProgress).padStart(3)} in progress`,
    );
  }
  out.push(
    `${" ".repeat(10)}  covered ${plan.coveredOpen}/${plan.openTotal} open · ${plan.orphanOpen} under no milestone`,
  );
  if (plan.duplicateIds > 0) {
    out.push(`${" ".repeat(10)}  ! ${plan.duplicateIds} bean id(s) held by more than one file`);
  }
  return out;
}

const ICON: Record<GateState, string> = {
  clear: "✓",
  blocked: "✗",
  reported: "·",
  "could-not-determine": "?",
};

function main(): number {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const barOnly = argv.includes("--bar");
  const noFetch = argv.includes("--no-fetch");
  const wi = argv.indexOf("--window");
  const windowHours = wi >= 0 ? Number(argv[wi + 1]) || 9 : 9;
  const skip = new Set(argv.flatMap((a, i) => (argv[i - 1] === "--skip" ? [a] : [])));

  // `--bar` is the refreshable form, so it touches NOTHING but the bean store:
  // no fetch, no `origin/main`, no PR listing. Every gate below asks the forge
  // — several of them once per open PR — and a status bar you wait minutes for
  // is a status bar nobody refreshes. It is also why this sits before the
  // fetch rather than beside the gates.
  if (barOnly) {
    const localBeans = readBeans(ROOT);
    if (!localBeans) {
      console.error("milestone:status: the bean store could not be read — NOT an empty plan.");
      return 2;
    }
    for (const line of renderBar(milestoneRollup(localBeans))) console.log(line);
    return 0;
  }

  if (!noFetch) git(ROOT, ["fetch", "-q", "origin", "main"]);
  const baseSha = git(ROOT, ["rev-parse", "--verify", "-q", "origin/main^{commit}"]);
  if (!baseSha.ok) {
    console.error("milestone:status: no origin/main — COULD NOT DETERMINE, not a clean run.");
    return 2;
  }
  const base = baseSha.out.trim();

  const prs = openPrs();
  if (!prs) {
    console.error("milestone:status: the open PRs could not be listed — COULD NOT DETERMINE, not a clean run.");
    return 2;
  }
  // Every head must be present locally before merge-tree, or it errors and the
  // error reads as clean. Fetching each PR head is the only way to be sure.
  if (!noFetch) {
    for (const p of prs) {
      if (!git(ROOT, ["cat-file", "-e", `${p.sha}^{commit}`]).ok) {
        git(ROOT, ["fetch", "-q", "origin", `refs/pull/${p.number}/head`]);
      }
    }
  }

  // Part 1. Composed from `milestone-rollup.ts`, the same function
  // `gen-docs-pages.ts` uses to write `milestones` into the bean index the
  // board fetches — so the terminal and the board cannot disagree.
  const beans = readBeans(ROOT);
  const plan: MilestoneReport | null = beans ? milestoneRollup(beans) : null;

  const gates: Gate[] = [];
  const add = (id: string, f: () => Gate) => { if (!skip.has(id)) gates.push(f()); };
  add("plan-on-main", () => gatePlanOnMain(base, prs));
  add("authored-conflicts", () => gateAuthoredConflicts(base, prs));
  add("seeding-gate", () => gateSeeding(base, prs));
  add("bean-rollover", () => gateBeanRollover());
  add("gate-evidence", () => gateEvidence(prs));
  add("scope-growth", () => reportScopeGrowth(windowHours));
  add("holders", () => reportHolders());

  const graded = gates.filter((g) => g.state !== "reported");
  const blocked = graded.filter((g) => g.state === "blocked");
  const undet = graded.filter((g) => g.state === "could-not-determine");
  const clear = graded.filter((g) => g.state === "clear");

  if (json) {
    console.log(JSON.stringify({
      $schema: "milestone-status/v1",
      generated_at: new Date().toISOString(),
      base,
      open_prs: prs.length,
      window_hours: windowHours,
      // null, not an empty list: "the store could not be read" and "there are
      // no milestones" are different answers, and a dashboard that renders
      // [] for both reports a repository with no plan.
      plan,
      summary: { graded: graded.length, clear: clear.length, blocked: blocked.length, could_not_determine: undet.length },
      gates,
    }, null, 2));
  } else {
    console.log(`Milestone status — against origin/main at ${base.slice(0, 11)}`);
    console.log(`${prs.length} open PR(s) · window ${windowHours}h · ${new Date().toISOString()}\n`);

    console.log("  DECLARED MILESTONES — reported, not graded (bean-weighted; see the module note)");
    if (!plan) {
      console.log("    ? the bean store could not be read — NOT an empty plan\n");
    } else if (plan.milestones.length === 0) {
      console.log("    · no `type: milestone` bean in the store\n");
    } else {
      for (const m of plan.milestones) {
        const pct = m.share === null ? " n/a" : `${Math.round(m.share * 100)}%`.padStart(4);
        console.log(`    ${pct}  ${m.id}  ${m.closed}/${m.closed + m.open} closed · ${m.inProgress} in progress · ${m.todo} todo · ${m.epics} epic(s)`);
        console.log(`          ${m.title.slice(0, 96)}`);
        // Never silent: a status in neither set is a finding about the store,
        // and folding it into either would move the share.
        if (m.unclassified > 0) console.log(`          ! ${m.unclassified} descendant(s) in NEITHER status set — counted in neither figure`);
      }
      // `coveredOpen` is SUMMED from the closures, never `openTotal -
      // orphanOpen` — the two differ, and the module note says why.
      console.log(`    These cover ${plan.coveredOpen} of ${plan.openTotal} open bean(s). The other ${plan.orphanOpen} sit under NO`);
      console.log(`    milestone, so the shares above are not a figure for the whole work plan.`);
      console.log(`    Which milestone those belong under is a scope judgement, not a defect`);
      console.log(`    this tool can resolve.`);
      if (plan.duplicateIds > 0) {
        console.log(`    ! ${plan.duplicateIds} bean id(s) are held by more than one FILE. Counted once each here;`);
        console.log(`      no current gate catches it, and which file keeps the id is its owner's call.`);
      }
      console.log("");
    }
    console.log("  MECHANICAL READINESS — graded; these set the exit code\n");
    for (const g of gates) {
      console.log(`  ${ICON[g.state]} ${g.id.padEnd(19)} ${g.value}`);
      if (g.target) console.log(`      target: ${g.target}`);
      console.log(`      basis:  ${g.basis}`);
      for (const d of g.detail ?? []) console.log(`        · ${d}`);
      console.log("");
    }
    console.log(`  ${clear.length} of ${graded.length} graded gate(s) clear · ${blocked.length} blocked · ${undet.length} could-not-determine`);
    if (undet.length) console.log(`  A gate that could not be answered is NOT clear, and it outranks a blocker:\n  a sweep blind on one gate has not cleared the others.`);
  }

  if (undet.length) return 2;
  return blocked.length ? 1 : 0;
}

// Guarded so a test can import `conflicts` (bean `0s6w`) without running the report.
if (import.meta.main) process.exit(main());
