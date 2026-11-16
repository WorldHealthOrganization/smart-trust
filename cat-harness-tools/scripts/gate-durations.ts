/**
 * How long each read-only gate took on THIS machine, and which of them the
 * pre-push hook therefore holds out of its run.
 *
 * Owner, 2026-11-05 ("1": gates under about 60 s, plus the affected tests).
 * A typical push through the hook took 70 minutes on a 4-CPU agent
 * container, and seven gates were 2324 s of the pool's 3241 CPU-seconds
 * (`skill:register:check` 1086 s, `uml:overview:check` 663 s). So before a
 * push the hook holds out every gate measured over the budget, the same way
 * it holds out the whole suite: named in the report and the record as
 * `heldOut`, never claimed, and run by CI.
 *
 * ## Only read-only gates are held out
 *
 * A gate that runs one at a time (undeclared, or writing) may produce what a
 * later gate reads: `state:mount`, `ig-index:build`, `bun install`. Holding
 * one out would redden the gates after it for a reason that is not the
 * push's. Only gates of the parallel pool are timed here, because the pool
 * holds only gates that declare they write nothing, so no other gate depends
 * on one.
 *
 * ## Where the times come from
 *
 * The cost of a gate is a fact about the machine, not the repository (bean
 * `3vc1`), so the times are this machine's: `<git common dir>/cat-gates/
 * durations.json`, learned from each run's log. A gate is held out when its
 * time here is over the budget. A gate with no time here falls back to
 * `scripts/git-hooks/slow-gates.json`, the gates measured over the budget on
 * an agent container, committed only so a fresh container's FIRST push does
 * not take 70 minutes to learn them. A time measured here always wins.
 *
 * The longest time seen is kept, so a gate held out stays out: it is not run
 * again before a push, so it is not re-measured. `git config
 * cat.gates.budgetSeconds 0` (or `CAT_PREPUSH_BUDGET=0`) runs every gate and
 * re-measures them all; deleting `durations.json` forgets the times.
 *
 * Deliberately free of package imports, like the hook that calls it.
 *
 * @module scripts/gate-durations
 * @graphNode none — a helper of the pre-push hook, not a gate itself
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { git, stateDir, type ToolVersions } from "./gate-record.ts";

export const LOCAL_GATE_DURATIONS_SCHEMA = "cat-local-gate-durations/v1";

/** The budget the owner chose, in seconds per gate. */
export const DEFAULT_BUDGET_SECONDS = 60;

export interface LocalGateDurations {
  $schema: typeof LOCAL_GATE_DURATIONS_SCHEMA;
  tools: ToolVersions;
  updatedAt: string;
  /** The longest time seen for each read-only gate, in seconds. */
  seconds: Record<string, number>;
}

/** `▸ <command>   (<s>s, parallel)`, the line `gates.ts` prints for each gate of the pool. */
const POOL_LINE = /^▸ (.+?) +\((\d+(?:\.\d+)?)s, parallel\)$/;

/** Each pool gate's time in a `bun run cat gates` log, the longest when one ran twice. */
export function durationsFromLog(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split("\n")) {
    const m = POOL_LINE.exec(line);
    if (!m) continue;
    const s = Number(m[2]);
    if (!(m[1]! in out) || s > out[m[1]!]!) out[m[1]!] = s;
  }
  return out;
}

export function durationsPath(root: string): string {
  return join(stateDir(root), "durations.json");
}

export function readDurations(root: string): LocalGateDurations | undefined {
  try {
    const d = JSON.parse(readFileSync(durationsPath(root), "utf-8")) as LocalGateDurations;
    return d.$schema === LOCAL_GATE_DURATIONS_SCHEMA ? d : undefined;
  } catch {
    return undefined;
  }
}

/** Fold a run's times into this machine's, keeping the longest seen. Times from another Bun start over. */
export function mergeDurations(old: LocalGateDurations | undefined, run: Record<string, number>, tools: ToolVersions, at: string): LocalGateDurations {
  const seconds = old !== undefined && old.tools.bun === tools.bun ? { ...old.seconds } : {};
  for (const [c, s] of Object.entries(run)) if (!(c in seconds) || s > seconds[c]!) seconds[c] = s;
  return { $schema: LOCAL_GATE_DURATIONS_SCHEMA, tools, updatedAt: at, seconds };
}

export function writeDurations(root: string, d: LocalGateDurations): void {
  const p = durationsPath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
}

/** The committed fallback: gates measured over the budget on an agent container. */
export const SEED_FILE = join(import.meta.dir, "git-hooks", "slow-gates.json");

export function readSeed(file: string = SEED_FILE): Record<string, number> {
  if (!existsSync(file)) return {};
  try {
    const s = (JSON.parse(readFileSync(file, "utf-8")) as { seconds?: Record<string, number> }).seconds;
    return s ?? {};
  } catch {
    return {};
  }
}

/**
 * The per-gate budget in seconds, or undefined for none (every gate runs).
 * `CAT_PREPUSH_BUDGET` first, then `git config cat.gates.budgetSeconds`, else
 * {@link DEFAULT_BUDGET_SECONDS}. `0` means no budget. A value that is not a
 * number is refused rather than read as some budget nobody asked for.
 */
export function budgetSeconds(root: string, env: Readonly<Record<string, string | undefined>> = process.env): number | undefined {
  const raw = env.CAT_PREPUSH_BUDGET !== undefined && env.CAT_PREPUSH_BUDGET !== "" ? env.CAT_PREPUSH_BUDGET : git(root, ["config", "cat.gates.budgetSeconds"]);
  if (raw === undefined || raw === "") return DEFAULT_BUDGET_SECONDS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`the pre-push budget must be a number of seconds, 0 for none; got ${JSON.stringify(raw)}`);
  return n === 0 ? undefined : n;
}

export interface OverBudget {
  command: string;
  seconds: number;
  /** `here`: measured on this machine; `seed`: from the committed fallback. */
  source: "here" | "seed";
}

/** The gates to hold out: over `budget` here, or, with no time here, in the seed. Longest first. */
export function overBudget(here: Record<string, number>, seed: Record<string, number>, budget: number | undefined): OverBudget[] {
  if (budget === undefined) return [];
  const out: OverBudget[] = [];
  for (const [command, seconds] of Object.entries(here)) if (seconds > budget) out.push({ command, seconds, source: "here" });
  for (const [command, seconds] of Object.entries(seed)) if (!(command in here) && seconds > budget) out.push({ command, seconds, source: "seed" });
  return out.sort((a, b) => b.seconds - a.seconds || a.command.localeCompare(b.command));
}
