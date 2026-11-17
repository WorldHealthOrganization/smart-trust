/**
 * Test plan execution engine — dynamically resolves and evaluates per-plan
 * exit criteria DMN tables.
 *
 * `test-plan/v1` allows a plan to declare its own `exitCriteria.decision`
 * table reference (e.g. `path/to/custom.dmn#Decision_Custom`).
 * `GW_ExitCriteria` in `sdlc/processes/test-plan-execution.bpmn` evaluates that
 * decision table dynamically rather than always using the platform default.
 *
 * Rules:
 * 1. If `plan.exitCriteria` names a decision table, resolve it dynamically
 *    relative to provided bases (layer root, workflow directory, etc.).
 * 2. If unresolvable (file does not exist, malformed reference, or decision
 *    not found in the DMN), return state "unknown" / could-not-determine and
 *    route the gateway to "undetermined". NEVER silently fall back to the default!
 * 3. When specified and resolvable, evaluate using that table and route
 *    by the table's outcomes.
 *
 * @module scripts/test-plan-execution
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadDecisionTable, evaluate, type DecisionTable } from "../src/workflow/decision-table.js";
import { complete, type InstanceState, type AuthzOptions } from "../src/workflow/instance.js";
import type { ProcessModel } from "../src/workflow/process-model.js";
import type { TestPlan } from "../schemas/sdlc/test-plan.js";
import {
  fileCertification,
  readCertificationAttestations,
  type CertificationEntry,
} from "../schemas/sdlc/qa-attestations.js";

export interface ResolvedPlanDmn {
  ok: true;
  table: DecisionTable;
  ref: string;
}

export interface UnresolvedPlanDmn {
  ok: false;
  error: string;
  ref: string;
  state: "unknown";
}

export type ResolvePlanDmnResult = ResolvedPlanDmn | UnresolvedPlanDmn;

export interface PlanExitCriteriaEvaluation {
  outcome: string;
  rule?: string;
  ruleDescription?: string;
  state?: "unknown";
  table?: DecisionTable;
  note: string;
}

/**
 * Resolve the DMN decision table named by `plan.exitCriteria.decision`.
 *
 * Resolves against candidate base directories.
 * Returns `{ ok: true, table, ref }` when found and parsed.
 * Returns `{ ok: false, error, ref, state: "unknown" }` when unresolvable.
 */
export async function resolvePlanExitCriteriaDmn(
  plan: TestPlan | { exitCriteria?: { decision?: string } },
  bases: readonly string[],
): Promise<ResolvePlanDmnResult> {
  const ref = plan.exitCriteria?.decision;
  if (!ref) {
    return {
      ok: false,
      error: "Plan carries no exitCriteria.decision",
      ref: "",
      state: "unknown",
    };
  }

  const [file, decisionId] = ref.split("#");
  if (!file || !decisionId) {
    return {
      ok: false,
      error: `Malformed DMN reference "${ref}": expected "file.dmn#Decision_Id"`,
      ref,
      state: "unknown",
    };
  }

  for (const base of bases) {
    const candidate = resolve(base, file);
    if (!existsSync(candidate)) continue;
    try {
      const table = await loadDecisionTable(candidate, decisionId);
      return { ok: true, table, ref };
    } catch (e) {
      return {
        ok: false,
        error: `Failed to load decision "${decisionId}" from ${candidate}: ${e instanceof Error ? e.message : String(e)}`,
        ref,
        state: "unknown",
      };
    }
  }

  return {
    ok: false,
    error: `DMN file "${file}" not found in bases: ${bases.join(", ")}`,
    ref,
    state: "unknown",
  };
}

/**
 * Evaluate facts against the plan's exit criteria decision table.
 *
 * If the table is unresolvable, returns `outcome: "undetermined"`, `state: "unknown"`.
 * It NEVER silently falls back to the default!
 */
export async function evaluatePlanExitCriteria(
  plan: TestPlan | { exitCriteria?: { decision?: string } },
  facts: Record<string, unknown>,
  bases: readonly string[],
): Promise<PlanExitCriteriaEvaluation> {
  const resolution = await resolvePlanExitCriteriaDmn(plan, bases);
  if (!resolution.ok) {
    return {
      outcome: "undetermined",
      state: "unknown",
      note: `could-not-determine: exitCriteria "${resolution.ref}" unresolvable (${resolution.error})`,
    };
  }

  const result = evaluate(resolution.table, facts);
  return {
    outcome: String(result.outcome),
    rule: result.rule,
    ruleDescription: result.ruleDescription,
    table: resolution.table,
    note: `${resolution.table.id} → ${result.outcome} by ${result.rule}` +
      (result.ruleDescription ? ` (${result.ruleDescription})` : ""),
  };
}

/**
 * Open the bean this layer tracks, so the next enabled step is `A_Request`.
 *
 * `test-plan-execution.bpmn` starts `Start_Request → Call_BeanOpen →
 * GW_BeanYours → A_Request`: the claim is drawn once, in `bean-open.bpmn`, and
 * every process that works a bean calls it (bean `m8gz`, owner 2026-10-24).
 * This walks `Process_BeanOpen` the way a runner that owns its bean does —
 * check, then create it (`exists: false`) or find it is ours (`exists: true`),
 * claim it — and takes `GW_BeanYours`'s `claimed` branch. A bean someone else
 * holds is not opened here: that branch ends the run, and a caller that meets
 * it should stop, not call this.
 */
export function openTrackedBean(
  model: ProcessModel,
  state: InstanceState,
  opts: { exists: boolean; actor?: string; authz?: AuthzOptions },
): InstanceState {
  const by = { actor: opts.actor, authz: opts.authz };
  complete(model, state, "Open_CheckExists", by);
  complete(model, state, "Open_Exists", { ...by, outcome: opts.exists ? "yes" : "no" });
  if (opts.exists) complete(model, state, "Open_Owner", { ...by, outcome: "mine / unclaimed" });
  else complete(model, state, "Open_Create", by);
  complete(model, state, "Open_Claim", by);
  return complete(model, state, "GW_BeanYours", { ...by, outcome: "claimed" });
}

/**
 * Complete the GW_ExitCriteria gateway using the plan's own decision table.
 *
 * If the plan's table is resolvable, evaluates it and routes by its outcome.
 * If unresolvable, routes to "undetermined" (could-not-determine, state: "unknown"),
 * NEVER silently falling back to the default table.
 */
export async function completeExitCriteriaGateway(
  model: ProcessModel,
  state: InstanceState,
  plan: TestPlan | { exitCriteria?: { decision?: string } },
  facts: Record<string, unknown>,
  bases: readonly string[],
  opts: { actor?: string; authz?: AuthzOptions } = {},
): Promise<InstanceState> {
  const resolution = await resolvePlanExitCriteriaDmn(plan, bases);
  if (!resolution.ok) {
    return complete(model, state, "GW_ExitCriteria", {
      decisionTable: null,
      decisionTableError: resolution.error,
      facts,
      actor: opts.actor,
      authz: opts.authz,
      note: `could-not-determine: exitCriteria "${resolution.ref}" unresolvable (${resolution.error})`,
    });
  }

  return complete(model, state, "GW_ExitCriteria", {
    decisionTable: resolution.table,
    facts,
    actor: opts.actor,
    authz: opts.authz,
  });
}

// ── A_FileCertification (bean `folio-assistant-zaui`) ─────────────────────

export interface FileCertificationInput {
  /** The plan certified — its `id` keys the store file. */
  plan: Pick<TestPlan, "id"> & { version?: string };
  /** The gateway's outcome. Only `certified` is filed: the refused path ends at `End_Refused` and signs nothing. */
  decision: string;
  /** Who signed (the attestation-service lane), as `qa-report-signing.bpmn` returned it. */
  signer: CertificationEntry["signer"];
  signature?: CertificationEntry["signature"];
  /** The report this certifies, relative to the layer. Required: a certification points at what it certifies. */
  reportPath: string;
  reqId?: CertificationEntry["reqId"];
  /** ISO time of signing; defaults to now. */
  timestamp?: string;
  /** Who decided and how it reached the filer — e.g. a decision relayed from another session. Kept beside the plan version. */
  notes?: string;
}

export type FileCertificationOutcome =
  | { state: "filed"; path: string; written: boolean }
  | { state: "refused"; reason: string }
  | { state: "unknown"; path: string; reason: string };

/**
 * File a signed certification under the layer's declared `attestations`
 * graph — the step `A_FileCertification` names, which had no writer until
 * this (bean `zaui`). A judgement, so it goes on main (D2 (a), D5 default),
 * never to `qa-reports`.
 *
 * A corrupt or unreadable store is `unknown` and NOTHING is written, as for
 * every other family; a decision other than `certified` is refused rather than
 * filed, because a refusal filed as a certification is the false-green this
 * process exists to prevent. The written file is read back, so `filed` means
 * the store now holds it — not merely that a write was attempted.
 */
export function fileSignedCertification(instanceRoot: string, input: FileCertificationInput): FileCertificationOutcome {
  if (input.decision !== "certified") {
    return { state: "refused", reason: `decision is "${input.decision}", not "certified" — nothing is filed on that path` };
  }
  if (!input.reportPath) return { state: "refused", reason: "no reportPath — a certification must point at the report it certifies" };
  const entry: CertificationEntry = {
    signer: input.signer,
    // input-site: inert #2361b9f6 — the time a certification is stamped with when the caller gives none: written, never read back
    timestamp: input.timestamp ?? new Date().toISOString(),
    decision: input.decision,
    testPlanId: input.plan.id,
    evidence: input.reportPath,
    ...(input.signature !== undefined ? { signature: input.signature } : {}),
    ...(input.reqId !== undefined ? { reqId: input.reqId } : {}),
    ...((): { notes?: string } => {
      const parts = [input.plan.version !== undefined ? `plan version ${input.plan.version}` : undefined, input.notes].filter((x): x is string => !!x);
      return parts.length > 0 ? { notes: parts.join("; ") } : {};
    })(),
  };
  const r = fileCertification(instanceRoot, input.plan.id, {
    subject: { kind: "test-plan", id: input.plan.id, path: input.reportPath },
    certification: entry,
  });
  if (!r.ok) return { state: "unknown", path: r.path, reason: `${r.state}: ${r.reason}` };
  const back = readCertificationAttestations(instanceRoot, input.plan.id);
  if (back.state !== "hit" || !back.file.certifications.some((c) => c.timestamp === entry.timestamp && c.testPlanId === entry.testPlanId)) {
    return { state: "unknown", path: r.path, reason: `written, but reading it back gave ${back.state}` };
  }
  return { state: "filed", path: r.path, written: r.written };
}
