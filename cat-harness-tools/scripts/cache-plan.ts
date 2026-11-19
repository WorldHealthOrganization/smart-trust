#!/usr/bin/env bun
/**
 * The cache plan of a target: which caches it needs, which of those are
 * stale, and so what to restore, refresh or skip (`cache:plan`).
 *
 * @module scripts/cache-plan
 * @graphNode none — a planner over the `cache` nodes, not a gate
 *
 * ## Owner rulings (2026-11-05)
 *
 * *"not all rendering/CI/merge processes need all caches. be optimal in what
 * needs caching"* and *"... be optimal in which caches need to be updated to
 * perform a specific render/..."*.
 *
 * ## Needed — derived, never hand-listed
 *
 * A target is one or more package scripts (a gate, a writer, `derive:publish`).
 * Its read set is what its recorded runs read: the CI cone's records
 * (`build/ci-cone/records.json`, `checks[<script>].reads`) and the writer
 * cone's (`build/writer-cone/records.json`, `writers[<script>].reads`). A
 * `cache` node is needed when a read path lies under one of its
 * `materializes` paths, and then so is its `needs` closure.
 *
 * A target script with NO record cannot be derived. That is never "needs
 * nothing restored, so skip": the plan restores NOTHING for that target and
 * says the target builds — the safe direction (a skipped restore only costs
 * time; a wrong one could serve a stale input).
 *
 * ## Stale — computed, undetermined counts as stale
 *
 * Staleness is #1519's computation ({@link nodeStaleness}: a node whose producer reads unkeyed or unmeasured state is never fresh; then the key over
 * {@link impliedKey}), against the stored facts of the daily cache report
 * (`--stored <cache-report.json>`, matched by {@link storedFromReport}). A
 * staleness that cannot be determined is treated as stale: refresh.
 *
 * ## Decision, order, cost
 *
 * needed & fresh → `restore`; needed & stale/undetermined → `refresh`
 * (`incremental` when the node says it supports it, else `whole`); not needed
 * → `skip`. Nodes are ordered by `needs` into batches, each batch independent
 * and so parallel. Cost comes only from the report (size, hit rate); without
 * it the plan says `unknown`, never a guess.
 *
 *   bun run cat cache:plan <script>... [--stored <cache-report.json>] [--json]
 *
 * Exit: 0 · 2 usage.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { nodeStaleness, type Cache, type Staleness, type StoredFacts } from "../schemas/sdlc/cache.ts";
import { impliedKey, loadCaches, storedFromReport } from "./gen-caches-viz.ts";

const LAYER_ROOT = resolve(import.meta.dir, "..");

export const PLAN_SCHEMA = "cache-plan/1";

/** What a recorded run read: path → state. Only the paths matter here. */
export interface Recorded {
  checks?: Record<string, { reads?: Record<string, string> }>;
  writers?: Record<string, { reads?: Record<string, string> }>;
}

export type Action = "restore" | "refresh-incremental" | "refresh-whole" | "skip";

export interface PlanRow {
  id: string;
  needed: boolean;
  /** Why it is (not) needed: the read that named it, the cache whose `needs` pulled it in, or why none could be derived. */
  neededWhy: string;
  staleness: Staleness["state"];
  stalenessWhy?: string;
  action: Action;
  /** The batch (0-based) in `needs` order; caches in one batch are independent. */
  batch: number;
  cost: { sizeBytes?: number; hitRate?: number } | "unknown";
}

export interface Plan {
  schema: typeof PLAN_SCHEMA;
  targets: string[];
  /** Targets whose read set could not be derived: they build, and nothing is restored for them. */
  undetermined: { target: string; why: string }[];
  rows: PlanRow[];
  /** A `needs` cycle or a `needs` naming no node: those caches are planned `skip`, and this says why. */
  refused: { id: string; why: string }[];
}

/** Whether checkout-relative `path` lies under the materialized path `m` (`dir/` or a file/dir name). */
export function under(path: string, m: string): boolean {
  if (m.startsWith("~/")) return false; // a home path is never in a checkout read set
  const p = path.replace(/^\.\//, "");
  const base = m.replace(/^\.\//, "").replace(/\/+$/, "");
  return base === "" ? false : p === base || p.startsWith(`${base}/`);
}

/** The read set of each target, or why it could not be derived. */
export function readSets(targets: readonly string[], recorded: readonly Recorded[]): { reads: Map<string, string[]>; undetermined: { target: string; why: string }[] } {
  const reads = new Map<string, string[]>();
  const undetermined: { target: string; why: string }[] = [];
  for (const t of targets) {
    const paths = new Set<string>();
    let found = false;
    for (const r of recorded) {
      for (const rec of [r.checks?.[t], r.writers?.[t]]) {
        if (rec?.reads === undefined) continue;
        found = true;
        for (const p of Object.keys(rec.reads)) paths.add(p);
      }
    }
    if (found) reads.set(t, [...paths].sort());
    else undetermined.push({ target: t, why: "no recorded run (ci-cone or writer-cone) of this script, so what it reads cannot be derived" });
  }
  return { reads, undetermined };
}

/** Batches in `needs` order (Kahn); a cycle or an unknown `needs` id is refused. */
export function batches(caches: readonly Cache[]): { batchOf: Map<string, number>; refused: { id: string; why: string }[] } {
  const ids = new Set(caches.map((c) => c.id));
  const refused: { id: string; why: string }[] = [];
  const deps = new Map<string, string[]>();
  for (const c of caches) {
    const unknown = (c.needs ?? []).filter((n) => !ids.has(n));
    if (unknown.length > 0) refused.push({ id: c.id, why: `needs ${unknown.join(", ")}, which no node declares` });
    else deps.set(c.id, [...(c.needs ?? [])]);
  }
  const batchOf = new Map<string, number>();
  let level = 0;
  let pending = [...deps.keys()];
  while (pending.length > 0) {
    const ready = pending.filter((id) => (deps.get(id) ?? []).every((d) => batchOf.has(d)));
    if (ready.length === 0) {
      for (const id of pending) refused.push({ id, why: "a needs cycle (or it needs a refused cache)" });
      break;
    }
    for (const id of ready) batchOf.set(id, level);
    pending = pending.filter((id) => !batchOf.has(id));
    level++;
  }
  return { batchOf, refused };
}

export function plan(o: {
  targets: readonly string[];
  caches: readonly Cache[];
  recorded: readonly Recorded[];
  stored: Readonly<Record<string, StoredFacts>> | undefined;
  root: string;
}): Plan {
  const { reads, undetermined } = readSets(o.targets, o.recorded);
  const { batchOf, refused } = batches(o.caches);
  const byId = new Map(o.caches.map((c) => [c.id, c]));
  const refusedIds = new Set(refused.map((r) => r.id));

  // Directly needed: a derivable target's read touches what the cache materializes.
  const why = new Map<string, string>();
  for (const c of o.caches) {
    if (refusedIds.has(c.id) || c.materializes === undefined) continue;
    for (const [t, paths] of reads) {
      const hit = paths.find((p) => c.materializes!.some((m) => under(p, m)));
      if (hit !== undefined) { why.set(c.id, `${t} reads ${hit}`); break; }
    }
  }
  // Then the needs closure.
  const queue = [...why.keys()];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const n of byId.get(id)?.needs ?? []) {
      if (!why.has(n) && !refusedIds.has(n)) { why.set(n, `needed by ${id}`); queue.push(n); }
    }
  }

  const rows: PlanRow[] = [];
  for (const c of [...o.caches].sort((a, b) => (batchOf.get(a.id) ?? 1e9) - (batchOf.get(b.id) ?? 1e9) || a.id.localeCompare(b.id))) {
    const facts = o.stored?.[c.id];
    const st = nodeStaleness(c, impliedKey(c.keyRecipe, o.root), facts);
    const needed = why.has(c.id);
    const neededWhy = refusedIds.has(c.id)
      ? `refused: ${refused.find((r) => r.id === c.id)!.why}`
      : needed
        ? why.get(c.id)!
        : reads.size === 0
          ? "no target's read set could be derived: nothing is restored, the target builds"
          : c.materializes === undefined
            ? "declares no `materializes`, and no needed cache needs it"
            : "no derived read of the target lies under what it materializes";
    const action: Action = !needed ? "skip" : st.state === "current" ? "restore" : c.refresh?.mode === "incremental" ? "refresh-incremental" : "refresh-whole";
    rows.push({
      id: c.id,
      needed,
      neededWhy,
      staleness: st.state,
      ...(st.state === "undetermined" ? { stalenessWhy: st.why } : st.state === "stale" ? { stalenessWhy: `holds ${st.stored}, today implies ${st.implied}` } : {}),
      action,
      batch: batchOf.get(c.id) ?? -1,
      cost: facts?.sizeBytes !== undefined || facts?.hitRate !== undefined
        ? { ...(facts.sizeBytes !== undefined ? { sizeBytes: facts.sizeBytes } : {}), ...(facts.hitRate !== undefined ? { hitRate: facts.hitRate } : {}) }
        : "unknown",
    });
  }
  return { schema: PLAN_SCHEMA, targets: [...o.targets], undetermined, rows, refused };
}

export function renderPlan(p: Plan): string {
  const lines = [`## Cache plan — ${p.targets.join(", ")}`, ""];
  for (const u of p.undetermined) lines.push(`- **${u.target}: could not derive** — ${u.why}. Nothing is restored for it; it builds.`);
  if (p.undetermined.length > 0) lines.push("");
  lines.push("| batch | cache | needed | why | staleness | action | cost |", "|---:|---|---|---|---|---|---|");
  for (const r of p.rows) {
    const cost = r.cost === "unknown" ? "unknown (no report)" : [r.cost.sizeBytes !== undefined ? `${(r.cost.sizeBytes / 1048576).toFixed(1)} MiB` : "", r.cost.hitRate !== undefined ? `${Math.round(r.cost.hitRate * 100)}% hits` : ""].filter(Boolean).join(", ");
    lines.push(`| ${r.batch < 0 ? "—" : r.batch} | \`${r.id}\` | ${r.needed ? "yes" : "no"} | ${r.neededWhy.replace(/\|/g, "/")} | ${r.staleness}${r.stalenessWhy ? ` — ${r.stalenessWhy.replace(/\|/g, "/")}` : ""} | **${r.action}** | ${cost} |`);
  }
  return lines.join("\n");
}

function readJson(file: string): unknown {
  try { return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined; } catch { return undefined; }
}

function main(argv: string[]): number {
  const at = (f: string) => (argv.indexOf(f) >= 0 ? argv[argv.indexOf(f) + 1] : undefined);
  const flagArgs = new Set(["--stored", "--root", "--caches"].flatMap((f) => (argv.indexOf(f) >= 0 ? [argv.indexOf(f), argv.indexOf(f) + 1] : [])));
  const targets = argv.filter((a, i) => !a.startsWith("--") && !flagArgs.has(i));
  if (targets.length === 0) { console.error("usage: cache:plan <script>... [--stored <cache-report.json>] [--json] [--root <checkout>] [--caches <dir>]"); return 2; }
  const root = resolve(at("--root") ?? (existsSync(join(LAYER_ROOT, "..", "index.lock.json")) ? join(LAYER_ROOT, "..") : LAYER_ROOT));
  const loaded = loadCaches(at("--caches"));
  const storedFile = at("--stored");
  const stored = storedFile ? storedFromReport(readJson(storedFile), loaded.caches) : undefined;
  const recorded = [join(root, "build", "ci-cone", "records.json"), join(root, "build", "writer-cone", "records.json")]
    .map((f) => readJson(f) as Recorded | undefined)
    .filter((r): r is Recorded => r !== undefined);
  const p = plan({ targets, caches: loaded.caches, recorded, stored, root });
  console.log(argv.includes("--json") ? JSON.stringify(p, null, 1) : renderPlan(p));
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
