/**
 * Strict at the base; content packages may relax, and must say so.
 *
 * The decision this implements (bean `bcnl`, and
 * `docs/proposals/workflow-orchestration.md` §4): **the content-agnostic
 * processes enforce.** A capability tool guarded by `Process_Editing`,
 * `Process_Publication` or `Process_Lifecycle` refuses when the process says
 * that step is not enabled. The per-content-type processes are advisory,
 * because what counts as adequate review of a Lean proof and of a FHIR profile
 * are different questions, and the package that knows the domain should answer
 * them.
 *
 * A content package relaxes a base gate by declaring it in
 * `skills/<package>/workflow-policy.json`:
 *
 * ```json
 * {
 *   "package": "authoring-math",
 *   "relaxations": [
 *     { "process": "Process_Editing", "activity": "Task_SmeReview",
 *       "reason": "A paper folio has no clinical SME; scientific review is the
 *                  agent review branch.", "scope": "prose and equation blocks" }
 *   ]
 * }
 * ```
 *
 * Three properties make that a policy rather than a loophole:
 *
 * 1. **A reason is required.** A relaxation without one does not load, so the
 *    escape hatch cannot be taken silently — the file is the record.
 * 2. **Some steps cannot be relaxed at all.** Anything carrying
 *    `<cat-harness.processes:policy relaxable="false"/>` refuses to be named: the editor seeing
 *    the findings, the accept/revise/discard decision, the commit itself, and
 *    release authorisation. If those were negotiable the base would not be
 *    strict, it would be a suggestion.
 * 3. **The target must exist.** A relaxation naming a process or an activity
 *    that is not there fails at load rather than quietly permitting nothing —
 *    or, worse, quietly permitting everything after a rename.
 *
 * @module folio-assistant/workflow/gate
 */

import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { findInModel, type ProcessModel } from "./process-model.js";
import { enabled, resolveStep, type InstanceState } from "./instance.js";
import { discoverLocalPackages } from "../../scripts/skill-packages.js";

export class PolicyError extends Error {}

export interface Relaxation {
  /** `bpmn:process/@id` this relaxes, e.g. `Process_Editing`. */
  process: string;
  /** Node id that may be skipped. */
  activity: string;
  /** Why. Required — an unexplained relaxation is a loophole, not a policy. */
  reason: string;
  /** Optional narrowing, e.g. "prose and equation blocks". Advisory prose. */
  scope?: string;
  /** Which package declared it, filled in from the file. */
  package: string;
}

const POLICY_FILE = "workflow-policy.json";

/**
 * Read every content package's declared relaxations.
 *
 * A package with no policy file relaxes nothing, which is the correct default:
 * silence means the base applies.
 *
 * Packages are the ones `discoverLocalPackages` finds — every declared skill
 * directory, dependencies included — not the children of `kgRoots()[0]`. That
 * read only the FIRST knowledge-graph root and assumed each package sat
 * directly under it, so a package anywhere else relaxed nothing, silently
 * (bean `9umr`: the concern subgraphs move packages).
 */
export function loadRelaxations(repoRoot: string): Relaxation[] {
  const out: Relaxation[] = [];

  for (const [pkg, dir] of Object.entries(discoverLocalPackages(repoRoot))) {
    const file = join(dir, POLICY_FILE);
    if (!existsSync(file)) continue;

    let parsed: { package?: string; relaxations?: unknown[] };
    try {
      parsed = JSON.parse(readFileSync(file, "utf-8"));
    } catch (e) {
      throw new PolicyError(`${relative(repoRoot, file)} is not valid JSON: ${String(e)}`);
    }
    if (parsed.package && parsed.package !== pkg) {
      throw new PolicyError(
        `${relative(repoRoot, file)} declares package "${parsed.package}" but sits in "${pkg}"`,
      );
    }
    for (const [i, raw] of (parsed.relaxations ?? []).entries()) {
      const r = raw as Partial<Relaxation>;
      for (const field of ["process", "activity", "reason"] as const) {
        if (typeof r[field] !== "string" || r[field]!.trim() === "") {
          throw new PolicyError(
            `${relative(repoRoot, file)}: relaxation ${i + 1} has no \`${field}\`. ` +
              (field === "reason"
                ? `A relaxation without a stated reason is a loophole, not a policy.`
                : `Name the process and activity it relaxes.`),
          );
        }
      }
      out.push({
        process: r.process!,
        activity: r.activity!,
        reason: r.reason!,
        scope: r.scope,
        package: pkg,
      });
    }
  }
  return out;
}

/**
 * Check every relaxation against the processes it claims to relax.
 *
 * Run at load, not at gate time. A relaxation naming a renamed activity would
 * otherwise sit in the file looking like policy while permitting nothing — and
 * nobody would find out until the day it was needed.
 */
export function validateRelaxations(
  relaxations: Relaxation[],
  models: ProcessModel[],
  /**
   * `unseen`: opt-in sub-graphs the checkout declares but does not hold on
   * disk (switched off, so the mount left them out). A relaxation naming a
   * process found nowhere is then UNDETERMINED, not wrong: the process may
   * be in one of them. It is returned, not passed, so the caller says so.
   */
  opts: { unseen?: readonly string[] } = {},
): Relaxation[] {
  const byId = new Map(models.map((m) => [m.id, m]));
  const undetermined: Relaxation[] = [];
  for (const r of relaxations) {
    const model = byId.get(r.process);
    if (!model && (opts.unseen?.length ?? 0) > 0) {
      undetermined.push(r);
      continue;
    }
    if (!model) {
      throw new PolicyError(
        `skills/${r.package}/${POLICY_FILE} relaxes ${r.process}, which is not a process here. ` +
          `Known: ${[...byId.keys()].join(", ")}`,
      );
    }
    const node = model.nodes.get(r.activity);
    if (!node) {
      throw new PolicyError(
        `skills/${r.package}/${POLICY_FILE} relaxes ${r.process}/${r.activity}, ` +
          `which that process has no such node.`,
      );
    }
    if (!node.relaxable) {
      throw new PolicyError(
        `skills/${r.package}/${POLICY_FILE} relaxes ${r.activity} ("${node.name}"), ` +
          `which is marked relaxable="false". That step is the gate: the base is ` +
          `strict about it precisely so a package cannot opt out.`,
      );
    }
  }
  return undetermined;
}

/**
 * The relaxations that are INACTIVE here: legal, but naming a process that
 * only a switched-off opt-in group holds, so they relax nothing until a root
 * switches that group on (owner, 2026-11-13: core's `workflow-policy.json`
 * relaxes `Process_Editing`, which core#776 moves into its opt-in `collab`).
 *
 * Reported, never an error. Call it after {@link validateRelaxations}: it
 * judges nothing, and a relaxation that was refused there never gets here.
 * One `undetermined` there (its process is in no group on disk) is not also
 * inactive: whether it is cannot be told here either.
 */
export function inactiveRelaxations(
  relaxations: readonly Relaxation[],
  /** The ids of the processes this root switches on. */
  active: ReadonlySet<string>,
  undetermined: readonly Relaxation[] = [],
): Relaxation[] {
  return relaxations.filter((r) => !undetermined.includes(r) && !active.has(r.process));
}

export interface GateVerdict {
  allowed: boolean;
  /** Always populated — a refusal says why, and so does a permission. */
  reason: string;
  /** Set when a declared relaxation is what permitted it. */
  relaxedBy?: Relaxation;
}

/**
 * May this activity be performed right now?
 *
 * `advisory` processes always allow, and say so — the per-content-type
 * diagrams are guidance their package owns.
 */
export function checkGate(
  model: ProcessModel,
  state: InstanceState,
  activity: string,
  relaxations: Relaxation[],
): GateVerdict {
  const node = model.nodes.get(activity);
  if (!node) {
    // It may be a step of a subprocess running inside this one, which is where
    // most steps live once a process is decomposed. The gate is answered by the
    // process that OWNS the step, with that process's own enforcement and
    // relaxations — a phase's package decides what adequate means inside it.
    const owner = resolveStep(model, state, activity);
    if (owner) {
      const verdict = checkGate(owner.model, owner.state, activity, relaxations);
      return { ...verdict, reason: `${owner.phase.join(" ▸ ")} ▸ ${verdict.reason}` };
    }
    const declared = findInModel(model, activity);
    if (declared) {
      return {
        allowed: false,
        reason:
          `${activity} is a step of ${declared.phase.join(" ▸ ")}, a phase ${state.id} has not ` +
          `entered. It becomes answerable when the process reaches that phase.`,
      };
    }
    return { allowed: false, reason: `${activity} is not a step in ${model.id}` };
  }
  if (model.enforcement === "advisory") {
    return {
      allowed: true,
      reason: `${model.id} is advisory — its content package owns what adequate means here`,
    };
  }
  // A `folio-workflow-instance/v1` record (beans/workflows/ on older folios)
  // carries no `tokens`; it enables nothing, so the gate falls through to the
  // relaxations and refuses rather than crashing.
  if ((state.tokens ?? []).includes(activity)) {
    return { allowed: true, reason: `${activity} is enabled` };
  }

  const relaxation = relaxations.find((r) => r.process === model.id && r.activity === activity);
  if (relaxation) {
    return {
      allowed: true,
      reason:
        `${activity} is not enabled, but ${relaxation.package} relaxes it: ${relaxation.reason}` +
        (relaxation.scope ? ` (scope: ${relaxation.scope})` : ""),
      relaxedBy: relaxation,
    };
  }

  const open = enabled(model, state).map((e) => e.node);
  return {
    allowed: false,
    reason:
      `${activity} ("${node.name}") is not enabled in ${state.id}. ` +
      (open.length ? `Enabled now: ${open.join(", ")}. ` : `Nothing is enabled. `) +
      `${model.id} is strict. If this step should be skippable for this content ` +
      `type, declare it in skills/<package>/${POLICY_FILE} with a reason — ` +
      (node.relaxable
        ? `it is relaxable.`
        : `but this one is marked relaxable="false" and cannot be.`),
  };
}
