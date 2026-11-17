/**
 * Which workflows OUGHT to run for a given event — read from the workflow
 * files, never from a list somebody maintains.
 *
 * @module src/core/workflow-events
 *
 * Bean `9x9r`, owner's ruling 2026-09-24 (option 1 of two). `gates.ts` derives
 * the gate set from `code-quality-gates.yml` for one reason — *"so it cannot
 * drift from what CI actually runs"* — and this is that argument applied to a
 * different question: not *which steps run*, but *which workflows are owed*.
 *
 * ## The defect this exists to fix
 *
 * `check-head-has-run` asked the Actions API for every run naming a `head_sha`
 * and decided on `runs.length > 0`. Any run. Any workflow, any event.
 *
 * That is strictly weaker than the condition it was built to detect. In this
 * repository **four** workflows declare `pull_request`, and two of those
 * (`jsonld-gen-check`, `atomic-mass-gen-check`) also declare `push` — so a
 * `push` run of a generated-file drift check satisfies `runs.length > 0` on a
 * commit whose `pull_request` event was dropped and whose gates never fired.
 * `3pqn` presenting as a ✓, from the script written to detect `3pqn`.
 *
 * Demonstrable without a stopwatch: PR #1309's head carried **two** runs of
 * `.jsonld siblings in sync with .ts manifests`, one per event.
 *
 * ## Three states, because a filtered workflow cannot be judged from a sha
 *
 * The temptation is to require every workflow declaring the event. That would
 * be wrong here and the workflow files say why:
 *
 * | workflow | `pull_request` declared as | judgeable? |
 * |---|---|---|
 * | `code-quality-gates` | no filters at all | **yes — required** |
 * | `jsonld-gen-check` | `paths:` | no |
 * | `atomic-mass-gen-check` | `paths:` | no |
 * | `feature-staging` | `types:` + `paths:` | no |
 *
 * A path-filtered workflow legitimately does not run when the diff misses its
 * paths, and this module is handed a commit id rather than a diff. Calling
 * that absence a finding would make the check cry wolf on most PRs; calling it
 * a pass would assert something nothing looked at. So it is neither:
 * {@link TriggerRequirement} keeps `conditional` distinct from `required`, and
 * the caller is expected to PRINT the conditional ones rather than drop them —
 * could-not-determine is never rendered as clean.
 *
 * ## What is deliberately NOT considered
 *
 * **Job-level `if:`.** All three of `feature-staging`'s jobs carry one, and on
 * PR #1309 two of them reported `skipped`. The *run* still existed. Since the
 * question here is whether a run happened at all, a job condition cannot
 * change the answer, and treating it as a filter would have moved a genuinely
 * required workflow into the unjudgeable column for no reason.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

/**
 * Where every workflow lives, relative to the REPOSITORY root.
 *
 * Spelled locally rather than imported from `scripts/gates.ts`: `src/core/`
 * must not depend on `scripts/`, and this literal already appears in six
 * scripts here. The one path literal this repository guards against
 * duplication is `beans/workflows` (`check:harness-dirs`), which is a
 * different string for a different graph.
 */
export const GITHUB_WORKFLOW_DIR = join(".github", "workflows");

/** Every trigger key that narrows WHEN a workflow fires, rather than IF. */
const FILTER_KEYS = [
  "branches",
  "branches-ignore",
  "paths",
  "paths-ignore",
  "tags",
  "tags-ignore",
  "types",
] as const;

/**
 * The `pull_request` activity types GitHub fires on when a workflow lists none:
 * a PR is opened, its head is pushed, or it is reopened. A `types:` list that
 * holds all three still runs on every head a PR gets, so it narrows nothing
 * this module asks about. Bean `dft1`: a workflow adds `ready_for_review` to
 * re-run its full tier when a draft is marked ready, and that addition must
 * not move it from `required` to `conditional`. If it did, merge-guard
 * (check 5) and merge-steward would stop treating its absence as a finding.
 */
const DEFAULT_PR_TYPES = ["opened", "synchronize", "reopened"] as const;
const PR_EVENTS = new Set(["pull_request", "pull_request_target"]);

/** Whether `spec.types` narrows a `pull_request(_target)` event at all. */
function typesNarrow(event: string, types: unknown): boolean {
  if (!PR_EVENTS.has(event)) return true;
  const list = typeof types === "string" ? [types] : Array.isArray(types) ? types : null;
  if (list === null) return true;
  return !DEFAULT_PR_TYPES.every((t) => list.includes(t));
}

/**
 * How far a workflow's declaration settles whether a run was owed.
 *
 * - `required` — it declares the event with no filters, so a run is owed for
 *   every occurrence of that event. Its absence is a finding.
 * - `conditional` — it declares the event behind `paths`, `branches`, `types`
 *   or similar. A `pull_request` `types:` list that keeps all of GitHub's
 *   default types (opened, synchronize, reopened) is not a narrowing, so on
 *   its own it leaves the workflow `required`. Whether a run was owed depends on the diff or the ref, which a
 *   commit id does not carry. **Not a finding and not a pass.**
 * - `not-declared` — it does not respond to the event at all.
 */
export type TriggerRequirement = "required" | "conditional" | "not-declared";

export interface WorkflowTrigger {
  /** Repo-relative path, e.g. `.github/workflows/code-quality-gates.yml`. */
  file: string;
  /**
   * The workflow's `name:`, which is what the Actions API reports as a run's
   * `name`. Falls back to the file path when a workflow declares none, exactly
   * as GitHub does.
   */
  name: string;
  requirement: TriggerRequirement;
  /** Which filter keys made it `conditional`. Empty otherwise. */
  filters: string[];
}

/** A workflow file that could not be read or parsed. Never silently skipped. */
export interface UnreadableWorkflow {
  file: string;
  problem: string;
}

export interface TriggerScan {
  triggers: WorkflowTrigger[];
  /**
   * Files that could not be read. A scan with any of these has NOT established
   * the required set — the caller must not treat its `required` list as
   * complete.
   */
  unreadable: UnreadableWorkflow[];
}

/** The `on:` block, normalised. A string or list form carries no filters. */
function eventsOf(doc: unknown): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (typeof doc !== "object" || doc === null) return out;
  // `yaml` keeps `on` as the string key (YAML 1.2 core schema has no `on`
  // boolean). A 1.1 parser would give `true` instead, so both are accepted —
  // this module must not silently see zero events because of a parser choice.
  const rec = doc as Record<string, unknown>;
  const on = rec.on ?? rec["true"] ?? (rec as Record<string, unknown>)[String(true)];
  if (typeof on === "string") {
    out.set(on, null);
    return out;
  }
  if (Array.isArray(on)) {
    for (const e of on) if (typeof e === "string") out.set(e, null);
    return out;
  }
  if (typeof on === "object" && on !== null) {
    for (const [k, v] of Object.entries(on as Record<string, unknown>)) out.set(k, v);
  }
  return out;
}

/** How one workflow responds to `event`. */
export function triggerFor(file: string, text: string, event: string): WorkflowTrigger {
  const doc = parse(text) as Record<string, unknown> | null;
  const name = typeof doc?.name === "string" && doc.name.trim() !== "" ? doc.name : file;
  const events = eventsOf(doc);
  if (!events.has(event)) return { file, name, requirement: "not-declared", filters: [] };
  const spec = events.get(event);
  if (spec === null || spec === undefined) return { file, name, requirement: "required", filters: [] };
  if (typeof spec !== "object") return { file, name, requirement: "required", filters: [] };
  const rec = spec as Record<string, unknown>;
  const filters = FILTER_KEYS.filter((k) => k in rec && (k !== "types" || typesNarrow(event, rec.types)));
  return filters.length === 0
    ? { file, name, requirement: "required", filters: [] }
    : { file, name, requirement: "conditional", filters: [...filters] };
}

/**
 * Every workflow under `root`, classified against `event`.
 *
 * `not-declared` entries are dropped: the caller's question is what was owed,
 * and a workflow that does not respond to the event owes nothing. The two that
 * remain are the two the caller must report separately.
 */
export function scanTriggers(root: string, event: string): TriggerScan {
  const dir = join(root, GITHUB_WORKFLOW_DIR);
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .sort();
  } catch (e) {
    // The whole scan failed, so there is no required set — reported as one
    // unreadable entry rather than as an empty (and therefore satisfied) list.
    return {
      triggers: [],
      unreadable: [{ file: GITHUB_WORKFLOW_DIR, problem: e instanceof Error ? e.message : String(e) }],
    };
  }
  const triggers: WorkflowTrigger[] = [];
  const unreadable: UnreadableWorkflow[] = [];
  for (const f of files) {
    const rel = join(GITHUB_WORKFLOW_DIR, f);
    let t: WorkflowTrigger;
    try {
      t = triggerFor(rel, readFileSync(join(dir, f), "utf-8"), event);
    } catch (e) {
      unreadable.push({ file: rel, problem: e instanceof Error ? e.message : String(e) });
      continue;
    }
    if (t.requirement !== "not-declared") triggers.push(t);
  }
  return { triggers, unreadable };
}
