/**
 * Which gate set a root is measured against: the harness's own CI recipe, or
 * the gates the root's own CI runs.
 *
 * @module scripts/lib/root-gate-set
 * @graphNode none — a reader of one shared definition
 *
 * ## The decision
 *
 * Owner, cat-harness-tools#281: **"hold smart-ra to its own gate set."**
 * `audit:coverage` and `qa:refresh` measured every root against
 * `.github/workflows/code-quality-gates.yml` ({@link GATES_WORKFLOW}), which is
 * the HARNESS's CI recipe. A content repository (smart-ra, an IG index, a
 * layer repository) has no such file; its CI is the shared
 * `layer-pr-checks.yml`, whose gate set `run-gates.py` derives from the
 * root's own and its dependency harness's `check:*` / `*:check` scripts, plus
 * `CHECKOUT_SCRIPTS`. Reading the harness file there ended in ENOENT, and
 * zero gates read as "EXAMINED NOTHING".
 *
 * ## One definition, read here
 *
 * The derivation lives once, in `run-gates.py` (`derive`), the script the
 * workflow runs. This module asks it (`run-gates.py <root> --list`) instead
 * of restating its rules in TypeScript, so a gate added to the derivation —
 * a new `CHECKOUT_SCRIPTS` entry, a new skip rule — reaches `loadGates`,
 * `audit:coverage` and `qa:refresh` with no second list to keep in step.
 *
 * The rule is generic: a root is a HARNESS when it carries
 * {@link GATES_WORKFLOW}, and a CONTENT root otherwise. No repository is named.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { GATES_WORKFLOW } from "./gates-workflow.ts";

/** `run-gates.py`, beside this module's layer: the derivation every caller reads. */
export const RUN_GATES = resolve(import.meta.dir, "..", "..", ".github", "scripts", "layer-pr-checks", "run-gates.py");

/** `harness`: measured against {@link GATES_WORKFLOW}. `content`: against the gates its own CI runs. */
export type RootProfile = "harness" | "content";

export function rootProfile(root: string): RootProfile {
  return existsSync(join(root, GATES_WORKFLOW)) ? "harness" : "content";
}

/** Why `run-gates.py` does not run a declared gate (its `skip_reason` kinds, and `input-absent`). */
export type SkipKind = "live-state" | "needs-input" | "runner-state" | "sweep-only" | "layer-mode" | "untracked-corpus" | "other-layer" | "prerequisite" | "input-absent";

export interface RootGateSet {
  /** The root's own layers. */
  own: string[];
  /** Their transitive `needs`, own layers included. */
  harness: string[];
  /** How a script name is run here (`bun run cat`, or the harness runner). */
  runner: string | null;
  /** Gate name → command, for every gate the layer PR checks run. */
  gates: Record<string, string>;
  /** Gate name → why it is not run. `input-absent` ones CI does run, where it holds the input. */
  skipped: Record<string, { command: string; skipped: string; kind: SkipKind }>;
}

/** The gate set could not be derived: a reader that gets this must not report a clean run. */
export class GateSetUndetermined extends Error {
  constructor(why: string) {
    super(`the gate set of this root could not be derived: ${why}. That is not an empty set; it is NOT a pass.`);
    this.name = "GateSetUndetermined";
  }
}

/**
 * The gates `layer-pr-checks.yml` runs for `root`, from `run-gates.py --list`.
 * Throws {@link GateSetUndetermined} when python3 or the script is missing, or
 * the root has no own layer.
 */
export function rootGateSet(root: string, opts: { instances?: readonly string[]; script?: string } = {}): RootGateSet {
  const script = opts.script ?? RUN_GATES;
  if (!existsSync(script)) throw new GateSetUndetermined(`${script} is absent`);
  const args = ["-I", script, resolve(root), "--list", ...(opts.instances ?? []).flatMap((i) => ["--instance", i])];
  // Never a shard: a `GATE_SHARD` left in the environment would narrow the set
  // `audit:coverage` and `qa:refresh` measure the root against (bean `lpcs`).
  // input-site: inert #09a9e8c6 — drops GATE_SHARD and hands the rest of the environment whole to the child below; no value is read here
  const { GATE_SHARD: _shard, ...env } = process.env;
  // input-site: spawned #fcd8f6f9 — run-gates.py --list under python3; the cone audits the child from its read set
  const r = spawnSync("python3", args, { encoding: "utf-8", maxBuffer: 1 << 24, env });
  if (r.error) throw new GateSetUndetermined(`python3 could not be run (${r.error.message})`);
  let parsed: RootGateSet;
  try {
    parsed = JSON.parse(r.stdout) as RootGateSet;
  } catch {
    throw new GateSetUndetermined(`run-gates.py --list exited ${r.status} with no JSON: ${r.stderr.trim().slice(-400)}`);
  }
  if (r.status !== 0 || parsed.own.length === 0) {
    throw new GateSetUndetermined("the root declares no own instance and mounts none from index.config.json");
  }
  return parsed;
}
