#!/usr/bin/env bun
/**
 * Where each harness got to in its initialization, and how healthy it is —
 * worked out from the checkout at publish time, never committed.
 *
 * @covers none — writer — it writes one state file per harness into the built site; it judges nothing
 *
 * ```sh
 * bun run cat harness:state --out ./_site/assets/harnesses   # what the deploy runs
 * bun run cat harness:state --json                            # print, write nothing
 * ```
 *
 * ## Where the answer comes from
 *
 * The steps are bootstrap-tools' `initSteps` — the tool half of bootstrap's
 * `complete-initialization.bpmn` — run with `dryRun` and the `offlineProbe`,
 * so this writes nothing into any layer and touches no network. A step that
 * needs the network (the documents answering at their IRIs, Pages being live)
 * is therefore `could-not-determine` here, never done. The declarations name
 * the steps; there is no second list.
 *
 * ## What one file says (`folio-harness-state/v1`)
 *
 * - `initialization.position`: the first `not-done` step, or `complete` when
 *   none is. `next` is that step's `action`: what to do, said and not done.
 * - `initialization.counts`: steps per state.
 * - `health.badges`: one per health notion that is the HARNESS's, not the
 *   repository's. `initialization` is red on any `not-done` step, unknown when
 *   only `could-not-determine` steps are left, green otherwise.
 *   `repository` reads the layer's own committed health report
 *   (`healthReportPath`) when there is one, and is `unknown` when there is
 *   not, which in an index checkout is the usual case.
 *
 * Paths in `detail` and `action` are made relative to the checkout, so a
 * published file never carries the build machine's directories.
 *
 * ## A partial mount is not a missing directory
 *
 * An index mounts some layers in part: `index.lock.json` lists the
 * directories it brought. A file the lock did not bring may exist upstream,
 * so for such a layer every step that looks for a file is
 * `could-not-determine` here, never `not-done` ({@link partiallyMounted}).
 *
 * Deterministic: layers in name order, steps in the order `initSteps`
 * gives, and no time is written.
 *
 * @module cat-harness-tools/scripts/harness-state
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

import { initSteps, offlineProbe, type InitStep, type StepState } from "@litlfred/bootstrap-tools/scripts/init.ts";
import { repoRootFor } from "../schemas/kg/cat-harness.ts";
import { healthReportPath, parseHealthReport } from "../schemas/sdlc/health-report.ts";
import { layerRootsIn } from "../schemas/kg/instance-roots.ts";
import {
  HARNESS_STATE_SCHEMA,
  HARNESS_STATE_INDEX_SCHEMA,
  HARNESS_STEP_STATES,
  HarnessStateIndexSchema,
  HarnessStateSchema,
  type HarnessBadge,
  type HarnessState,
  type HarnessStepState,
} from "../schemas/sdlc/harness-state.ts";

import { HARNESS_ROOT } from "./lib/roots.ts";
import { readLockFile } from "../schemas/kg/repo-owner.ts";

export {
  HARNESS_STATE_SCHEMA,
  HARNESS_STATE_INDEX_SCHEMA,
  HarnessStateSchema,
  HarnessStateIndexSchema,
  type HarnessState,
} from "../schemas/sdlc/harness-state.ts";

// The schema's step states must stay bootstrap-tools' `StepState`, both ways.
const STATES = HARNESS_STEP_STATES satisfies readonly StepState[];
const _sameStates: readonly HarnessStepState[] = [] as StepState[];
void _sameStates;
type Badge = HarnessBadge;

/** Replace `root` (and `root/`) in `text` with a checkout-relative form. */
export function relativize(text: string, root: string): string {
  const r = resolve(root);
  return text.split(r + sep).join("").split(r).join(".");
}

/** The `initialization` badge, from the step states alone. */
export function initializationBadge(counts: Record<StepState, number>): Badge {
  if (counts["not-done"] > 0) return { id: "initialization", state: "finding", label: `${counts["not-done"]} setup step(s) not done` };
  if (counts["could-not-determine"] > 0) return { id: "initialization", state: "unknown", label: `${counts["could-not-determine"]} setup step(s) could not be checked from here` };
  return { id: "initialization", state: "ok", label: `every checkable setup step done (${counts.done})` };
}

/** The `repository` badge: the layer's own committed health report, or `unknown` without one. */
export function repositoryBadge(instanceRoot: string): Badge {
  const p = healthReportPath(instanceRoot);
  if (!existsSync(p)) return { id: "repository", state: "unknown", label: "no committed health report in this checkout" };
  try {
    const report = parseHealthReport(JSON.parse(readFileSync(p, "utf-8")));
    const state = report.verdict === "clean" ? "ok" : report.verdict === "findings" ? "finding" : "unknown";
    return { id: "repository", state, label: `repository health: ${report.verdict}` };
  } catch (e) {
    return { id: "repository", state: "unknown", label: `health report unreadable: ${(e as Error).message.split("\n")[0]}` };
  }
}

/**
 * True when the checkout's `index.lock.json` mounts `instanceRoot` in part,
 * not whole. False when there is no lock, or no entry for it.
 */
export function partiallyMounted(instanceRoot: string, repoRoot: string): boolean {
  const lockPath = join(repoRoot, "index.lock.json");
  if (!existsSync(lockPath)) return false;
  let lock: { instances?: { path?: string; directories?: { path?: string }[] }[] };
  try {
    lock = readLockFile(lockPath);
  } catch {
    return false;
  }
  const at = relative(repoRoot, instanceRoot).split(sep).join("/");
  const entry = lock.instances?.find((i) => i.path === at);
  if (entry === undefined) return false;
  return !(entry.directories ?? []).some((d) => d.path === at);
}

/**
 * Steps a partial mount cannot answer: everything that looks for a file in the
 * layer. The declaration, its `needs` and the documents at their IRIs are
 * read the same way whole or in part.
 */
export function readsInstanceFiles(stepId: string): boolean {
  return !(stepId === "declaration" || stepId.startsWith("needs:") || stepId.startsWith("instructions:") || stepId.startsWith("schemas:"));
}

/** A step the checkout cannot see because the index did not mount it. */
function unmounted(s: InitStep): InitStep {
  return { ...s, state: "could-not-determine", detail: "not mounted in this index checkout (index.lock.json brings part of this instance only)", action: "check it in the instance's own repository" };
}

/** One harness's state, from its steps. Pure: the steps and the badge for its repository are handed in. */
export function stateOf(name: string, steps: readonly InitStep[], repoRoot: string, repository: Badge): HarnessState {
  const counts = Object.fromEntries(STATES.map((s) => [s, 0])) as Record<StepState, number>;
  for (const s of steps) counts[s.state]++;
  const first = steps.find((s) => s.state === "not-done");
  const rel = (t: string) => relativize(t, repoRoot);
  return HarnessStateSchema.parse({
    $schema: HARNESS_STATE_SCHEMA,
    harness: name,
    initialization: {
      position: first?.id ?? "complete",
      next: first ? { step: first.id, action: rel(first.action ?? first.what) } : null,
      counts,
      steps: steps.map((s) => ({
        id: s.id,
        namedBy: s.namedBy,
        what: rel(s.what),
        state: s.state,
        detail: rel(s.detail),
        ...(s.action !== undefined ? { action: rel(s.action) } : {}),
      })),
    },
    health: { badges: [initializationBadge(counts), repository] },
  });
}

/** Every harness in the checkout that holds `harnessRoot`, in name order. */
export async function harnessStates(harnessRoot: string = HARNESS_ROOT): Promise<HarnessState[]> {
  const repoRoot = repoRootFor(harnessRoot);
  const out: HarnessState[] = [];
  for (const root of layerRootsIn(repoRoot)) {
    // dryRun: never perform a step. offlineProbe: no gh, no network.
    const { name, steps } = await initSteps(root, { probe: offlineProbe, dryRun: true });
    const partial = partiallyMounted(root, repoRoot);
    const seen = steps.map((s) => (partial && s.state === "not-done" && readsInstanceFiles(s.id) ? unmounted(s) : s));
    out.push(stateOf(name ?? basename(root), seen, repoRoot, repositoryBadge(root)));
  }
  return out.sort((a, b) => (a.harness < b.harness ? -1 : a.harness > b.harness ? 1 : 0));
}

function argValue(args: readonly string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const out = argValue(args, "--out");
  const states = await harnessStates();
  if (args.includes("--json") || out === undefined) {
    console.log(JSON.stringify(states, null, 2));
  } else {
    const dir = resolve(out);
    mkdirSync(dir, { recursive: true });
    for (const s of states) writeFileSync(join(dir, `${s.harness}.json`), JSON.stringify(s, null, 2) + "\n");
    const index = HarnessStateIndexSchema.parse({
      $schema: HARNESS_STATE_INDEX_SCHEMA,
      harnesses: states.map((s) => ({ harness: s.harness, file: `${s.harness}.json`, position: s.initialization.position })),
    });
    writeFileSync(join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n");
    for (const s of states) {
      const b = s.health.badges.map((x) => `${x.id} ${x.state}`).join(", ");
      console.log(`  · ${s.harness}: ${s.initialization.position}${s.initialization.next ? ` (next: ${s.initialization.next.action})` : ""} — ${b}`);
    }
  }
}
