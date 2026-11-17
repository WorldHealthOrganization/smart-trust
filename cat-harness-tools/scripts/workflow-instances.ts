#!/usr/bin/env bun
/**
 * How many recorded workflow instances there are against how many merges —
 * computed, never quoted, so whoever reads it reads today's number.
 *
 * ## Advisory
 *
 * This REPORTS the gap and never fails on it: a `finding` exits 0. It is not
 * wired into CI as a gate, and must not be.
 *
 * `unknown` — the store cannot be reached, the clone is shallow, an instance
 * file does not parse — exits 2, because a count over data that could not be
 * read is not a count.
 *
 * ## The denominator is an upper bound, and says so
 *
 * Not every merge is a turn inside a process: a steward landing somebody
 * else's train, a docs-only fix or a revert may legitimately have no instance.
 * So `merges` against `instances started` bounds compliance from above; it
 * does not measure non-compliance. The report prints that sentence with the
 * numbers, so the ratio is never read without it.
 *
 * Usage: `bun run cat workflow:instances [--root <checkout>] [--since <iso>] [--ref <rev>] [--repo <checkout>] [--sweep] [--strict] [--json]`
 *
 * @module scripts/workflow-instances
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { OPEN_STATUSES, readArchivedBeans, readBeans, resolveBeanDefs, resolveBeanGraphNode, type BeanNode } from "./beans.ts";
import { REPO_ROOT } from "./lib/roots.ts";

/** The owner settled the rule on 2026-09-20 (`vlhk`); counting starts there. */
export const RULE_SETTLED_AT = "2026-09-20T18:00:00Z";

const CLOSED_BEAN_STATUSES = new Set(["completed", "scrapped"]);

/** A running (non-completed) workflow instance whose work item is closed or missing from the store. */
export interface StaleInstanceFinding {
  /** Instance file name in `workflow-state`, e.g. `crdm--folio-assistant-6lb8.json`. */
  file: string;
  /** Instance id (`json.id` or file stem). */
  instance: string;
  /** Work item id named by the instance. */
  bean: string;
  /** Why the running instance is stale: its work item is closed (`completed`/`scrapped`) or absent from the store. */
  reason: "bean-closed" | "bean-missing";
  /** The work item's status when `reason === "bean-closed"`. */
  beanStatus?: string;
}

/** An `in-progress` work item that declares a `process:<id>` tag and has no running workflow instance naming it. */
export interface UntrackedProcessBeanFinding {
  /** Work item id, e.g. `folio-assistant-pbv1`. */
  bean: string;
  /** Process id(s) declared on the work item via `process:<id>` tags. */
  processes: string[];
}

export type WorkflowInstances =
  | {
      state: "ok" | "finding";
      since: string;
      ref: string;
      /** The resolved `workflow-state` directory, relative to the checkout. */
      dir: string;
      instances: number;
      startedSince: number;
      merges: number;
      /** CI workflows that read the `workflow-state` graph. Zero means nothing enforces it. */
      gatesReading: string[];
      /** Running (non-completed) instances whose work item is `completed`, `scrapped`, or missing from the store. */
      staleInstances: StaleInstanceFinding[];
      /** `in-progress` work items with a `process:<id>` tag and no running workflow instance naming them. */
      untrackedProcessBeans: UntrackedProcessBeanFinding[];
    }
  | { state: "unknown"; reason: string };

export interface InstancesOptions {
  root: string;
  since?: string;
  ref?: string;
  /** The checkout whose merges are counted, when it is not `root` (a full clone beside a shallow one). */
  repo?: string;
  /** Injected for tests; defaults to git in `repo`. */
  git?: (args: string[]) => string;
}

export interface SweepResult {
  state: "ok" | "unknown";
  dir?: string;
  reason?: string;
  /** Instance file names in `workflow-state` that were closed (`status: "completed"`). */
  closed: string[];
}

function defaultGit(root: string): (args: string[]) => string {
  return (args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** CI workflow files that name the `workflow-state` graph or its directory. */
function gatesReadingGraph(root: string, dirRel: string): string[] {
  const wf = join(root, ".github", "workflows");
  if (!existsSync(wf)) return [];
  return readdirSync(wf)
    .filter((f) => /\.ya?ml$/.test(f))
    .filter((f) => {
      const text = readFileSync(join(wf, f), "utf8");
      return text.includes("workflow-state") || text.includes(dirRel) || text.includes("workflow:instances");
    })
    .sort();
}

interface RawInstance {
  id?: unknown;
  status?: unknown;
  bean?: unknown;
  carriedBeans?: unknown;
  tokens?: unknown;
  startedAt?: unknown;
  updatedAt?: unknown;
  history?: Array<{ at?: unknown; node?: unknown }>;
  children?: Record<string, RawInstance>;
  [key: string]: unknown;
}

/** Work item ids named by an instance (`bean` and `carriedBeans`). */
function beansOfInstance(json: RawInstance): string[] {
  const out: string[] = [];
  if (typeof json.bean === "string" && json.bean.trim()) out.push(json.bean.trim());
  if (Array.isArray(json.carriedBeans)) {
    for (const b of json.carriedBeans) {
      if (typeof b === "string" && b.trim()) out.push(b.trim());
    }
  }
  return [...new Set(out)];
}

/** Process ids declared on a work item via `process:<id>` tags. */
export function processesOfBean(b: BeanNode): string[] {
  const out: string[] = [];
  for (const tag of b.tags ?? []) {
    if (tag.startsWith("process:") && tag.length > "process:".length) {
      out.push(tag.slice("process:".length).trim());
    }
  }
  return [...new Set(out.filter(Boolean))];
}

/** Active + archived work items of `root`, or `null` when `root` has no `defs/` directory on disk. */
function readKnownBeans(root: string): { active: BeanNode[]; allById: Map<string, BeanNode> } | null {
  let defsDir: string | null = null;
  try {
    const resolved = resolveBeanDefs(root);
    if (resolved.unreachable || !resolved.dir || !existsSync(resolved.dir)) return null;
    defsDir = resolved.dir;
  } catch {
    return null;
  }
  const active = readBeans(root);
  if (active === null) return null;
  const archived =
    readArchivedBeans(root) ??
    (defsDir ? readArchivedBeans(resolve(defsDir, "..", "..")) : null) ??
    [];
  const allById = new Map<string, BeanNode>();
  for (const b of archived) allById.set(b.id, b);
  for (const b of active) allById.set(b.id, b);
  return { active, allById };
}

function isInstanceCompleted(json: RawInstance): boolean {
  if (json.status !== "completed") return false;
  for (const child of Object.values(json.children ?? {})) {
    if (child && typeof child === "object" && !isInstanceCompleted(child)) return false;
  }
  return true;
}

function markInstanceCompleted(json: RawInstance): void {
  json.status = "completed";
  if (Array.isArray(json.tokens) && json.tokens.length > 0) {
    json.tokens = [];
  }
  if (typeof json.updatedAt !== "string" || !json.updatedAt) {
    const lastHistoryAt = (json.history ?? [])
      .map((h) => h?.at)
      .filter((a): a is string => typeof a === "string" && a.length > 0)
      .sort()
      .at(-1);
    if (lastHistoryAt) json.updatedAt = lastHistoryAt;
  }
  if (json.children && typeof json.children === "object") {
    for (const child of Object.values(json.children)) {
      if (child && typeof child === "object") markInstanceCompleted(child);
    }
  }
}

export function workflowInstances(opts: InstancesOptions): WorkflowInstances {
  const root = resolve(opts.root);
  const since = opts.since ?? RULE_SETTLED_AT;
  const ref = opts.ref ?? "HEAD";
  if (Number.isNaN(Date.parse(since))) return { state: "unknown", reason: `--since ${since} is not a date` };

  const where = resolveBeanGraphNode(root, "workflow-state");
  if (where.unreachable) return { state: "unknown", reason: `the workflow-state graph is unreachable: ${where.unreachable}` };
  if (!where.dir) return { state: "unknown", reason: `${root} declares no workflow-state graph` };
  if (!existsSync(where.dir)) {
    return { state: "unknown", reason: `${relative(root, where.dir)} is declared but absent — mount the store (bun run cat state:mount)` };
  }

  const knownBeans = readKnownBeans(root);
  const runningBeans = new Set<string>();
  const staleInstances: StaleInstanceFinding[] = [];

  let instances = 0;
  let startedSince = 0;
  const unreadable: string[] = [];
  const from = Date.parse(since);
  for (const f of readdirSync(where.dir).filter((n) => n.endsWith(".json")).sort()) {
    let json: RawInstance;
    try {
      json = JSON.parse(readFileSync(join(where.dir, f), "utf8"));
    } catch {
      unreadable.push(f);
      continue;
    }
    instances++;
    // `startedAt` is optional in `folio-workflow-instance/v1`; three instances
    // recorded retroactively carry only `history`, whose first entry is the
    // start event, so that is when the instance began.
    const started = typeof json.startedAt === "string" ? json.startedAt : json.history?.[0]?.at;
    const at = typeof started === "string" ? Date.parse(started) : NaN;
    if (Number.isNaN(at)) unreadable.push(`${f} (no startedAt and no history)`);
    else if (at >= from) startedSince++;

    const instId = typeof json.id === "string" && json.id ? json.id : basename(f, ".json");
    const namedBeans = beansOfInstance(json);
    const completed = isInstanceCompleted(json);
    if (!completed) {
      for (const bId of namedBeans) runningBeans.add(bId);
      if (knownBeans) {
        for (const bId of namedBeans) {
          const b = knownBeans.allById.get(bId);
          if (!b) {
            staleInstances.push({ file: f, instance: instId, bean: bId, reason: "bean-missing" });
          } else if (CLOSED_BEAN_STATUSES.has(b.status)) {
            staleInstances.push({ file: f, instance: instId, bean: bId, reason: "bean-closed", beanStatus: b.status });
          }
        }
      }
    }
  }
  if (unreadable.length) return { state: "unknown", reason: `instance files that cannot be counted: ${unreadable.join(", ")}` };

  const untrackedProcessBeans: UntrackedProcessBeanFinding[] = [];
  if (knownBeans) {
    for (const b of knownBeans.active) {
      if (b.status !== "in-progress") continue;
      const processes = processesOfBean(b);
      if (processes.length > 0 && !runningBeans.has(b.id)) {
        untrackedProcessBeans.push({ bean: b.id, processes });
      }
    }
  }

  const git = opts.git ?? defaultGit(resolve(opts.repo ?? root));
  let merges: number;
  try {
    if (git(["rev-parse", "--is-shallow-repository"]) === "true") {
      return { state: "unknown", reason: "the clone is shallow, so its merge count is not the repository's — fetch with --unshallow" };
    }
    merges = Number(git(["rev-list", "--first-parent", "--merges", "--count", `--since=${since}`, ref]));
  } catch (e) {
    return { state: "unknown", reason: `git could not count merges on ${ref}: ${(e as Error).message.split("\n")[0]}` };
  }
  if (!Number.isInteger(merges)) return { state: "unknown", reason: `git returned no merge count for ${ref}` };

  const dir = relative(root, where.dir);
  const gatesReading = gatesReadingGraph(root, dir);
  const state =
    merges > startedSince || staleInstances.length > 0 || untrackedProcessBeans.length > 0
      ? "finding"
      : "ok";
  return { state, since, ref, dir, instances, startedSince, merges, gatesReading, staleInstances, untrackedProcessBeans };
}

/**
 * Close (`status: "completed"`) every non-completed workflow instance in
 * `workflow-state` whose work item(s) are `completed`, `scrapped`, or missing
 * from the store (`cat-harness#988`). Preserves `id`, `source`, `history`, and
 * `children` so PROV-O projections (`check:prov-qaqc`) and step history on
 * `/bean-processed/` remain intact.
 */
export function sweepWorkflowInstances(opts: { root: string }): SweepResult {
  const root = resolve(opts.root);
  const where = resolveBeanGraphNode(root, "workflow-state");
  if (where.unreachable) return { state: "unknown", reason: `the workflow-state graph is unreachable: ${where.unreachable}`, closed: [] };
  if (!where.dir) return { state: "unknown", reason: `${root} declares no workflow-state graph`, closed: [] };
  if (!existsSync(where.dir)) {
    return { state: "unknown", reason: `${relative(root, where.dir)} is declared but absent — mount the store (bun run cat state:mount)`, closed: [] };
  }
  const knownBeans = readKnownBeans(root);
  if (!knownBeans) {
    return { state: "unknown", reason: "bean-defs store could not be read; refusing to sweep without knowing which work items are open", closed: [] };
  }

  const closed: string[] = [];
  for (const f of readdirSync(where.dir).filter((n) => n.endsWith(".json")).sort()) {
    const full = join(where.dir, f);
    let json: RawInstance;
    try {
      json = JSON.parse(readFileSync(full, "utf8"));
    } catch {
      continue;
    }
    if (isInstanceCompleted(json)) continue;
    const namedBeans = beansOfInstance(json);
    if (namedBeans.length === 0) continue;
    const hasOpenBean = namedBeans.some((bId) => {
      const b = knownBeans.allById.get(bId);
      return b !== undefined && (OPEN_STATUSES.has(b.status) || b.status === "draft");
    });
    if (hasOpenBean) continue;

    markInstanceCompleted(json);
    writeFileSync(full, `${JSON.stringify(json, null, 2)}\n`, "utf8");
    closed.push(f);
  }
  return { state: "ok", dir: relative(root, where.dir), closed };
}

export function report(c: WorkflowInstances): string {
  if (c.state === "unknown") return `UNKNOWN — ${c.reason}`;
  const lines = [
    `${c.state === "finding" ? "FINDING (advisory)" : "OK"} — workflow instances against merges on ${c.ref} since ${c.since}`,
    `  instances recorded in ${c.dir}: ${c.instances} (${c.startedSince} started since ${c.since})`,
    `  first-parent merges since ${c.since}: ${c.merges}`,
    `  running instances on closed/missing work items: ${c.staleInstances.length}`,
    ...c.staleInstances.map(
      (s) =>
        `    - ${s.instance} (${s.file}): ${s.bean} is ${s.reason === "bean-closed" ? s.beanStatus : "missing from store"}`,
    ),
    `  in-progress process work items without a running instance: ${c.untrackedProcessBeans.length}`,
    ...c.untrackedProcessBeans.map((u) => `    - ${u.bean} (${u.processes.join(", ")})`),
    `  CI workflows reading the workflow-state graph: ${c.gatesReading.length ? c.gatesReading.join(", ") : "none"}`,
    "  The merge count is an upper bound on the instances owed: a steward's train, a docs-only fix or a revert may have none.",
    "  Advisory by owner ruling (5ulq, 2026-10-10; #988): this reports the gap and never fails on it unless --strict is given.",
  ];
  return lines.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const val = (flag: string) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const root = val("--root") ?? REPO_ROOT ?? process.cwd();
  if (argv.includes("--sweep")) {
    const s = sweepWorkflowInstances({ root });
    if (argv.includes("--json")) {
      console.log(JSON.stringify(s, null, 2));
    } else if (s.state === "unknown") {
      console.log(`UNKNOWN — ${s.reason}`);
    } else {
      console.log(`SWEEP (${s.dir}) — closed ${s.closed.length} stale instance(s)${s.closed.length ? `: ${s.closed.join(", ")}` : ""}`);
    }
    process.exit(s.state === "unknown" ? 2 : 0);
  }
  const c = workflowInstances({ root, since: val("--since"), ref: val("--ref"), repo: val("--repo") });
  console.log(argv.includes("--json") ? JSON.stringify(c, null, 2) : report(c));
  if (c.state === "unknown") process.exit(2);
  if (argv.includes("--strict") && (c.staleInstances.length > 0 || c.untrackedProcessBeans.length > 0)) {
    process.exit(1);
  }
  process.exit(0);
}
