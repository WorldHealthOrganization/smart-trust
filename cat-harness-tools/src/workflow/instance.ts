/**
 * Run a process from `process-model.ts` as a token machine.
 *
 * The point is not to execute anything — an LLM agent executes, and may take an
 * hour over one activity and be interrupted halfway. The point is that **what
 * may happen next is derived from the diagram rather than asserted by whoever
 * is working**. `Commit into the corpus` does not become enabled until the
 * editor's decision has been recorded, because there is no token on it until
 * then. That is the whole of the determinism on offer.
 *
 * ## Two things can be enabled
 *
 * - an **activity** — work to do, carrying the lane that performs it and the
 *   skill that implements it;
 * - a **decision** — an exclusive gateway reached with no outcome supplied.
 *
 * Decisions are surfaced rather than guessed. In `editing-hci-validation` the
 * parallel fork leads straight into `Judgement call?` with no activity in
 * between, so something has to be asked. Picking a branch silently would be the
 * orchestrator quietly making the call it exists to record.
 *
 * ## What this does not do
 *
 * It does not check that the work was any good. A green process means the gates
 * ran in order and a person saw the findings; whether the content is correct is
 * what the QA axes and the Lean build are for. Do not read a completed instance
 * as a reviewed paper.
 *
 * @module folio-assistant/workflow/instance
 */

import type { MemoryEntry } from "../../schemas/kg/memory-record.ts";
import type { BeanInContext } from "./work-plan-store.js";
import { isActivity, MEMORY_STORE, type ProcessModel, type ProcessNode } from "./process-model.js";
import { evaluate } from "./decision-table.js";
import { roleForLane, resolveRoleSkills, resolveRoleStack, type RoleGraph } from "../../schemas/process/role-graph.js";
import type { ConventionScope } from "../../schemas/process/convention.js";
import { authorizeTask, describeVerdict, type TaskAuthVerdict } from "./authorize.js";
import { provActivityFor } from "./prov-record.js";
import { ProvActivitySchema, type ProvActivity, type ProvAgreementDistribution, type ProvConsentRef } from "../../schemas/content/prov.js";
import type { AccessContext, Principal } from "../core/access.js";
import { inputSiteReached } from "../../schemas/sdlc/input-trace.ts";
import {
  validateWorkflowModel,
  validateLaneModelCapabilities,
  WorkflowCapabilityRefusalError,
  type ModelConfig,
} from "./model-capabilities.js";

export {
  validateWorkflowModel,
  validateLaneModelCapabilities,
  WorkflowCapabilityRefusalError,
  type ModelConfig,
};

export interface HistoryEntry {
  at: string;
  node: string;
  /** For a decision, the outcome chosen. */
  outcome?: string;
  /** Who recorded it — free text, e.g. a role or an agent name. */
  actor?: string;
  note?: string;
  /**
   * The task-authorization verdict the step was recorded under (issue #1207):
   * how the actor was authenticated, whether it may take the lane's role, and
   * what the ODRL policies said. Absent on entries written before the check
   * existed, and on a call activity released by its subprocess finishing.
   */
  authz?: TaskAuthVerdict;
  /**
   * The `prov:Activity` the engine wrote as it recorded this step (bean
   * `n2l9`): the authenticated agent, the lane's role, the plan and every
   * policy in force. Absent when the step ran without an authorization
   * context, or when an activity would have to be invented (no actor, no lane
   * role). The PROV-O after-check reads it in preference to deriving one.
   */
  prov?: ProvActivity;
  /**
   * PROV-O activities a Tool performed as part of this step, handed in by the
   * agent that completes it (for example an accepted `skill_update` write,
   * folio-assistant#875 FR-005; owner 2026-10-30, option A: kept on the
   * workflow step, like `prov`). Each must parse and name this step as its
   * plan. A refused Tool call has none: it did not happen.
   *
   * When the step has its own {@link prov} activity, each Tool activity names
   * it in `prov:wasInformedBy` (W3C PROV-O): the Tool's activity was informed
   * by, and is part of, the step's. See {@link informedByStep}.
   */
  activities?: ProvActivity[];
}

/**
 * What `complete` needs to run the task-authorization check. Optional so the
 * interpreter still runs where no caller supplies it (tests, a script that
 * replays history); the MCP tools always do.
 */
export interface AuthzOptions {
  ctx: AccessContext;
  principal: Principal;
  /** The content the step acts on. */
  target?: string;
  mode?: "advisory" | "strict";
  /** The agreement this step is decided under (DSA B4, beans `3z44`, `yy40`): its DCAT distribution + `spdx:checksum`, cited in `prov:used`. */
  agreement?: ProvAgreementDistribution;
  /** The grant's W3C VC 2.0 credential `id` (DSA B5), cited in `prov:used`. */
  grant?: string;
  /** The IHE PCF / FHIR R4 Consent (`id` + `versionId`) cited when this step is a consent-based decision (PCF8, bean `2egb`). */
  consent?: ProvConsentRef;
  /** Whether this step is a consent-based decision requiring a Consent citation (`id` + `versionId`). */
  consentBased?: boolean;
  /** Link this step's `prov:Activity` into the instance's hash chain. Automatically enabled when `agreement` is supplied or when a prior step in `history` is hash-chained. */
  chain?: boolean;
}

/**
 * Schema tag every instance file carries.
 *
 * A bean-graph node says a directory holds `workflow-state`, and deliberately
 * does NOT say how to recognise one — the files declare what they are. A bean
 * does that already (id, `title`, `status`, `type` in front matter); this is
 * the same for instance state, following the `"$schema": "qa-script/v1"`
 * convention the QA script sidecars use.
 *
 * Without it an instance file was identifiable only by SHAPE — duck-typed on
 * `processId` and `tokens` — which is exactly the "distinguishable by
 * extension, a coincidence of the current layout, not a contract" problem
 * #263 named. A declaration in the file is the contract.
 */
export const INSTANCE_SCHEMA = "folio-workflow-instance/v1";

export interface InstanceState {
  /** Always {@link INSTANCE_SCHEMA}. Optional on read so pre-tag files load. */
  $schema?: string;
  id: string;
  processId: string;
  /** Path of the `.bpmn` this was started from. */
  source: string;
  /** What this instance is about — a block label, a release, a bean id. */
  subject: string;
  /** Bean this instance is tracked under, when there is one. */
  bean?: string;
  /**
   * The work plan this instance runs under: an epic or milestone work item
   * whose `process:` tag names this process (`schemas/sdlc/work-plan.ts`,
   * work item folio-assistant-exrp). Optional, because not every process
   * needs a plan. The plan does not list its instances; this field is the link.
   */
  plan?: string;
  /** Bean ids carried by this instance / traveling with its tokens. */
  carriedBeans?: string[];
  /** Node ids currently holding a token. */
  tokens: string[];
  /**
   * Sequence flows that have delivered a token into a parallel join and are
   * waiting for their siblings. Keyed by join node id.
   */
  arrivals: Record<string, string[]>;
  history: HistoryEntry[];
  status: "running" | "completed";
  startedAt: string;
  updatedAt: string;
  /**
   * Sub-instances entered through a call activity, keyed by the call activity's
   * node id.
   *
   * A subprocess is ENTERED automatically the moment a token reaches its call
   * activity, and the parent's token stays there until the child finishes. That
   * is deliberate: making the caller "complete" the call activity would let a
   * whole phase be recorded as done without any of its steps being reached,
   * which is precisely the out-of-order claim the token machine exists to
   * refuse.
   *
   * A completed child is KEPT — it is the record of what happened inside that
   * phase. It is replaced only when the phase is re-entered, which the loops in
   * these diagrams do routinely (`document-ingestion` routes a completeness gap
   * straight back into `Derive content`). The parent's own history carries a
   * line per pass, so a replaced run is not a lost one.
   */
  children?: Record<string, InstanceState>;
  /**
   * Steps the engine refused, newest last (bean `v49e`). A refusal used to be
   * a thrown error and nothing else, so a gate that kept refusing looked, on
   * disk, exactly like one nobody had tried. `workflow_complete` now appends
   * one entry per refusal and saves the instance, so the view can show a
   * refused gate as a state. Capped at {@link REFUSALS_KEPT}; absent on files
   * written before this was recorded, which is not the same as "never refused".
   */
  refusals?: RefusalEntry[];
  /**
   * What a change-set instance (`content-change-review`) changes: its change
   * set id and the labels of every block it touches. Written when the scope
   * is detected; the corpus gate reads it to recognise the change-set path
   * (`change-set-coverage.ts`). Absent on every other kind of instance.
   */
  scope?: { changeSet: string; blocks: string[] };
}

/** One refused `workflow_complete`: the step asked for, by whom, and the engine's reason. */
export interface RefusalEntry {
  at: string;
  /** The step the caller asked to complete. */
  node: string;
  /** Who the caller said it was acting as, when it said. */
  actor?: string;
  /** The engine's own message, folded to one line. */
  reason: string;
}

/** How many refusals an instance keeps: enough to see a pattern, never the whole file. */
export const REFUSALS_KEPT = 20;

/**
 * The instance with one more refusal recorded, oldest dropped past
 * {@link REFUSALS_KEPT}. The rest of the state is untouched: a refusal moves
 * nothing, so `updatedAt` stays when the instance last MOVED.
 */
export function withRefusal(state: InstanceState, entry: RefusalEntry): InstanceState {
  const reason = entry.reason.replace(/\s+/g, " ").trim().slice(0, 600);
  const refusals = [...(state.refusals ?? []), { ...entry, reason }].slice(-REFUSALS_KEPT);
  return { ...state, refusals };
}

/**
 * Deterministic snapshot of an agent's context from the KG at a task.
 *
 * Scoped along the process call path: entering a subprocess overlays context
 * (skills, conventions, role stack), and completing/leaving the subprocess
 * cleanly removes that overlay. Carried beans travel with the token.
 */
export interface TaskContext {
  /** The declared role the actor takes on for this task. */
  role?: string;
  /**
   * The call stack of roles along the subprocess chain, outermost first.
   */
  roleStack: string[];
  /**
   * Effective skills available at this task: the union of role skills along
   * the subprocess stack (closed over inherits) and the activity's own declared
   * skills. Deterministically deduplicated and sorted.
   */
  effectiveSkills: string[];
  /** Alias to effectiveSkills. */
  skills: string[];
  /**
   * Conventions in force at this task, preserving scope and call hierarchy.
   */
  conventions: Array<{ ref: string; scope: ConventionScope }>;
  /**
   * Bean IDs associated with this task/token/instance, deterministically sorted.
   */
  carriedBeans: string[];
  /**
   * The carried beans themselves, read through the work-plan store
   * (cat-harness#991 step 4b; `withBeans` in `work-plan-store.ts`). Absent
   * where nothing read the store — `enabled` is pure and never does; the
   * `workflow_next` tool fills it in.
   */
  beans?: BeanInContext[];
  /**
   * The step is drawn reading or writing the `memory` data store
   * (cat-harness#991 §4.14): a checkpoint read when work resumes, a record
   * written before an agent stops, a space a swarm shares. Absent when the
   * diagram draws no such association.
   */
  readsMemory?: boolean;
  writesMemory?: boolean;
  /** What was kept, read through the memory store when the step reads it. Filled by `workflow_next`. */
  memory?: MemoryEntry[];
}

export interface EnabledActivity {
  kind: "activity";
  node: string;
  name: string;
  /** The lane's name, as the diagram spells it. */
  lane?: string;
  /**
   * The declared ROLE that lane binds, when a role graph was supplied.
   *
   * The lane name is free text and sixty of them spell two dozen positions;
   * this is the joined answer. `undefined` means either no role graph was
   * passed or the lane binds nothing — which `kg:audit` reports as a finding
   * rather than leaving to be inferred here.
   */
  role?: string;
  /**
   * Every skill that role carries, closed over `inherits`.
   *
   * Distinct from `skills`, which is what the ACTIVITY names. The difference is
   * the interesting part: an activity naming a skill absent from this list is
   * demanding something its performer was never given.
   */
  roleSkills?: string[];
  skills: string[];
  /**
   * The conventions in force at this step, with where each was bound.
   *
   * Bean `3190`. A skill is what you need to PERFORM the step; a convention is
   * how the output must look while you are inside this process. Reported here
   * so an agent asking "what is enabled now" is told both, rather than being
   * expected to have read prose that applies everywhere and therefore nowhere
   * in particular.
   *
   * **Empty when nothing binds** — see `conventionsInForce`.
   */
  conventions: Array<{ ref: string; scope: ConventionScope }>;
  touchesWorkPlan: boolean;
  documentation?: string;
  calledElement?: string;
  /**
   * The global task this step runs, when it is a call to one: the step its
   * layer shares between processes (spec §7; owner, 2026-10-20, "a1 b1 c1").
   * The step is an ordinary one — enabled, performed and completed here —
   * and this names what it shares, so an agent can see the same step in
   * every process that calls it.
   */
  globalTask?: string;
  /** The values this call gives the global task's declared inputs, by name. */
  inputs?: Record<string, string>;
  /**
   * Set on a non-interrupting boundary event: the activity it sits on. The
   * step is OPTIONAL: it may be completed while that activity holds a token,
   * which it keeps, and nothing waits for it.
   */
  optionalOn?: string;
  /**
   * The chain of call activities this step sits inside, outermost first, as
   * their names read on the parent diagram. Absent at the top level.
   *
   * This is the context a decomposed process buys: the step is `Synthesise
   * needs from sources`, and it is inside `Phase 1 — Needs`, which is inside
   * `CRDM requirements`. A reader handed only the leaf has to go and find the
   * diagram to know which phase they are in.
   */
  phase?: string[];
  /**
   * Deterministic task context snapshot derived from the KG at this task.
   */
  context: TaskContext;
}

export type StepNext = EnabledActivity;

export interface EnabledDecision {
  kind: "decision";
  node: string;
  /** The gateway's own label — normally a question. */
  name: string;
  lane?: string;
  /** The declared role that lane binds, when a role graph was supplied. */
  role?: string;
  /** The outcomes that will be accepted, taken from the flow labels. */
  outcomes: string[];
  /**
   * Present when the gateway carries `folio:decision`: the outcome is
   * **computed** from a DMN table, so supply `facts` rather than choosing.
   * `facts` names exactly what the table reads.
   */
  computed?: { decision: string; facts: string[] };
  /** The chain of call activities this decision sits inside. See {@link EnabledActivity.phase}. */
  phase?: string[];
  /** Deterministic context snapshot at this decision point. */
  context?: TaskContext;
}

export type Enabled = EnabledActivity | EnabledDecision;

export class WorkflowError extends Error {}

const now = (): string => {
  // input-site: traced #6203122b — stamps a workflow instance being written
  inputSiteReached("workflow instance: clock");
  return new Date().toISOString();
};

/**
 * Push a token out of `from` and let it settle.
 *
 * Routing nodes resolve immediately; activities and undecided gateways hold the
 * token. Recursion is bounded by `guard` rather than by trusting the graph to
 * be acyclic — these diagrams have deliberate loops (revise, re-validate,
 * another cycle), and a malformed one must fail loudly instead of hanging.
 */
function settle(
  model: ProcessModel,
  state: InstanceState,
  targetId: string,
  viaFlowId: string,
  guard = 0,
): void {
  if (guard > 1000) {
    throw new WorkflowError(
      `routing did not settle after 1000 hops from ${targetId} — the process ` +
        `has a cycle with no activity in it, which cannot be a real process`,
    );
  }
  const node = model.nodes.get(targetId);
  if (!node) throw new WorkflowError(`no such node: ${targetId}`);

  switch (node.kind) {
    case "end":
      // The token is consumed. The instance ends when the last one is.
      state.history.push({ at: now(), node: node.id, note: "end event reached" });
      return;

    case "activity":
      if (!state.tokens.includes(node.id)) state.tokens.push(node.id);
      return;

    case "boundary":
      // Refused at load (no incoming flow), so this is a defect in a model
      // built some other way; fail rather than invent a meaning.
      throw new WorkflowError(`${node.id} is a boundary event; a sequence flow cannot arrive at it`);

    case "exclusive":
      // A merge (one way out) needs no decision; a split does, and the token
      // waits on the gateway until `complete` supplies an outcome.
      if (node.outgoing.length === 1) {
        const flow = model.flows.get(node.outgoing[0])!;
        settle(model, state, flow.to, flow.id, guard + 1);
        return;
      }
      if (!state.tokens.includes(node.id)) state.tokens.push(node.id);
      return;

    case "parallel": {
      if (node.incoming.length > 1) {
        // A join: wait for one token per incoming flow before continuing.
        const seen = state.arrivals[node.id] ?? [];
        if (!seen.includes(viaFlowId)) seen.push(viaFlowId);
        state.arrivals[node.id] = seen;
        if (seen.length < node.incoming.length) return;
        delete state.arrivals[node.id];
      }
      for (const flowId of node.outgoing) {
        const flow = model.flows.get(flowId)!;
        settle(model, state, flow.to, flow.id, guard + 1);
      }
      return;
    }

    case "start": {
      for (const flowId of node.outgoing) {
        const flow = model.flows.get(flowId)!;
        settle(model, state, flow.to, flow.id, guard + 1);
      }
      return;
    }
  }
}

/**
 * Enter every subprocess whose call activity now holds a token.
 *
 * Run after the start event settles and after every advance, so a token never
 * sits on a call activity with the phase behind it unopened. Idempotent: a call
 * activity whose child is already recorded is left alone, which is what makes
 * it safe to call on every transition.
 */
function enterSubprocesses(model: ProcessModel, state: InstanceState): void {
  for (const tokenId of state.tokens) {
    const child = model.children.get(tokenId);
    if (!child) continue;
    // Re-enter on a loop. A phase that ran, completed, and has been routed back
    // into has to RUN AGAIN — treating the old record as "already entered" is
    // how a re-validation silently becomes a no-op.
    if (state.children?.[tokenId]?.status === "running") continue;
    const callNode = model.nodes.get(tokenId);
    const callBeans = [
      ...(callNode?.beans ?? []),
      ...(callNode?.beanRef ? [callNode.beanRef] : []),
    ];
    const inheritedCarried = Array.from(
      new Set([
        ...(state.carriedBeans ?? []),
        ...(state.bean ? [state.bean] : []),
        ...callBeans,
      ]),
    ).sort((a, b) => a.localeCompare(b));

    state.children = {
      ...state.children,
      [tokenId]: startInstance(child, {
        id: `${state.id}/${tokenId}`,
        subject: state.subject,
        bean: state.bean,
        carriedBeans: inheritedCarried,
      }),
    };
  }
}

/**
 * Where an instance actually IS — the deepest running steps, with the phases
 * they sit inside.
 *
 * Reads only the instance, never a model, so a reporter that has state on disk
 * and no diagram in hand can still say something true. `at CallActivity_Extract`
 * is true and useless; `at Extract structure ▸ Task_Ocr` is what a reader needs.
 */
export function positionOf(state: InstanceState, phase: readonly string[] = []): string[] {
  return state.tokens.flatMap((token) => {
    const child = state.children?.[token];
    if (child && child.status === "running") return positionOf(child, [...phase, token]);
    return [[...phase, token].join(" ▸ ")];
  });
}

/**
 * Find the process (and its instance) that owns `nodeId`, descending through
 * subprocesses.
 *
 * Searches COMPLETED children as well as running ones on purpose: a step in a
 * phase that has already finished must resolve and be reported as not enabled,
 * not as "no such step". The two answers send a reader to different places.
 *
 * Returns the chain of call-activity names it descended through, so a caller
 * can say which phase the step lives in rather than only that it exists.
 */
export function resolveStep(
  model: ProcessModel,
  state: InstanceState,
  nodeId: string,
): { model: ProcessModel; state: InstanceState; phase: string[] } | undefined {
  if (model.nodes.has(nodeId)) return { model, state, phase: [] };
  for (const [call, child] of Object.entries(state.children ?? {})) {
    const childModel = model.children.get(call);
    if (!childModel) continue;
    const hit = resolveStep(childModel, child, nodeId);
    if (hit) return { ...hit, phase: [model.nodes.get(call)!.name, ...hit.phase] };
  }
  return undefined;
}

/** Whether this instance, or any subprocess still running inside it, holds a token on `nodeId`. */
function holds(model: ProcessModel, state: InstanceState, nodeId: string): boolean {
  if (state.tokens.includes(nodeId)) return true;
  for (const [call, child] of Object.entries(state.children ?? {})) {
    const childModel = model.children.get(call);
    if (!childModel || child.status !== "running") continue;
    if (holds(childModel, child, nodeId)) return true;
  }
  return false;
}

/**
 * The running subprocess that owns `nodeId`, if one does.
 *
 * Returns the call activity's own node id, so the caller knows which parent
 * token to release when the child finishes.
 */
function subprocessOwning(
  model: ProcessModel,
  state: InstanceState,
  nodeId: string,
): { call: string; model: ProcessModel; state: InstanceState } | undefined {
  for (const [call, child] of Object.entries(state.children ?? {})) {
    const childModel = model.children.get(call);
    if (!childModel || child.status !== "running") continue;
    if (holds(childModel, child, nodeId)) return { call, model: childModel, state: child };
  }
  return undefined;
}

export function startInstance(
  model: ProcessModel,
  opts: {
    id: string;
    subject: string;
    bean?: string;
    plan?: string;
    carriedBeans?: string[];
    startNode?: string;
    model?: ModelConfig;
    roles?: RoleGraph;
  },
): InstanceState {
  if (opts.model && opts.roles) {
    validateWorkflowModel(model, opts.model, opts.roles);
  }
  const startNode = opts.startNode ?? model.startNodes[0];
  if (!model.nodes.has(startNode)) {
    throw new WorkflowError(`no such start node: ${startNode}`);
  }
  const initialCarriedBeans = Array.from(
    new Set([
      ...(opts.carriedBeans ?? []),
      ...(opts.bean ? [opts.bean] : []),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const state: InstanceState = {
    id: opts.id,
    processId: model.id,
    source: model.source,
    subject: opts.subject,
    bean: opts.bean,
    ...(opts.plan !== undefined ? { plan: opts.plan } : {}),
    carriedBeans: initialCarriedBeans,
    tokens: [],
    arrivals: {},
    history: [{ at: now(), node: startNode, note: "instance started" }],
    status: "running",
    startedAt: now(),
    updatedAt: now(),
  };
  settle(model, state, startNode, "");
  enterSubprocesses(model, state);
  state.updatedAt = now();
  return state;
}

/** Outcomes an exclusive split will accept, in diagram order. */
function outcomesOf(model: ProcessModel, node: ProcessNode): string[] {
  return node.outgoing.map((f, i) => model.flows.get(f)!.name ?? `flow-${i + 1}`);
}

/**
 * What is enabled now.
 *
 * `roles` is optional so that the interpreter keeps working in a layer that
 * declares no role graph — an unmigrated repo is not an error. When it IS
 * supplied, every enabled step reports the role its lane binds and the skills
 * that role carries, which is the whole point of declaring roles: an agent
 * handed a step should be told what it is acting AS, not only which lane the
 * box was drawn in.
 */
export interface SubprocessScopeContext {
  roleStack: string[];
  conventions: Array<{ ref: string; scope: ConventionScope }>;
  carriedBeans: string[];
}

/**
 * What is enabled now.
 *
 * `roles` is optional so that the interpreter keeps working in a layer that
 * declares no role graph — an unmigrated repo is not an error. When it IS
 * supplied, every enabled step reports the role its lane binds and the skills
 * that role carries, which is the whole point of declaring roles: an agent
 * handed a step should be told what it is acting AS, not only which lane the
 * box was drawn in.
 */
export function enabled(
  model: ProcessModel,
  state: InstanceState,
  roles?: RoleGraph,
  parentScope?: SubprocessScopeContext,
): Enabled[] {
  const roleFor = (node: { lane?: string; roleRef?: string }): string | undefined =>
    roles ? roleForLane(roles, node.lane, node.roleRef)?.id : undefined;

  // A legacy `folio-workflow-instance/v1` record has no `tokens`: nothing is enabled.
  const tokens = state.tokens ?? [];
  // Each non-interrupting boundary event on an activity that holds a token is
  // offered too, after it, marked optional.
  const offered = [
    ...tokens,
    ...[...model.nodes.values()]
      .filter((n) => n.kind === "boundary" && n.attachedTo !== undefined && tokens.includes(n.attachedTo))
      .map((n) => n.id),
  ];
  return offered.flatMap((id): Enabled[] => {
    const node = model.nodes.get(id)!;

    // A call activity with a subprocess running inside it is not itself work —
    // the work is in there. Report the child's enabled steps, tagged with the
    // phase they sit in, so a reader gets MORE context from the decomposition
    // rather than an opaque box they cannot act on.
    const child = state.children?.[id];
    const childModel = model.children.get(id);
    if (child && childModel && child.status === "running") {
      const callRole = roleFor(node);
      const childRoleStack = [
        ...(parentScope?.roleStack ?? []),
        ...(callRole ? [callRole] : []),
      ];

      const seenConventions = new Set<string>();
      const childConventions: Array<{ ref: string; scope: ConventionScope }> = [];
      for (const c of [...(parentScope?.conventions ?? []), ...node.conventions]) {
        if (!seenConventions.has(c.ref)) {
          seenConventions.add(c.ref);
          childConventions.push(c);
        }
      }

      const childCarriedBeans = Array.from(
        new Set([
          ...(parentScope?.carriedBeans ?? []),
          ...(state.carriedBeans ?? []),
          ...(state.bean ? [state.bean] : []),
          ...(node.beans ?? []),
          ...(node.beanRef ? [node.beanRef] : []),
        ]),
      ).sort((a, b) => a.localeCompare(b));

      return enabled(childModel, child, roles, {
        roleStack: childRoleStack,
        conventions: childConventions,
        carriedBeans: childCarriedBeans,
      }).map((e) => ({
        ...e,
        phase: [node.name, ...(e.phase ?? [])],
      }));
    }

    const roleId = roleFor(node);
    const roleStack = [
      ...(parentScope?.roleStack ?? []),
      ...(roleId ? [roleId] : []),
    ];

    const stackSkills =
      roles && roleStack.length > 0
        ? resolveRoleStack(roles, roleStack).skills.map((s) => s.skill)
        : roleId && roles
          ? resolveRoleSkills(roles, roleId).map((s) => s.skill)
          : [];

    const effectiveSkills = Array.from(new Set([...stackSkills, ...node.skills])).sort((a, b) =>
      a.localeCompare(b),
    );

    const seenConventions = new Set<string>();
    const combinedConventions: Array<{ ref: string; scope: ConventionScope }> = [];
    for (const c of [...(parentScope?.conventions ?? []), ...node.conventions]) {
      if (!seenConventions.has(c.ref)) {
        seenConventions.add(c.ref);
        combinedConventions.push(c);
      }
    }

    const taskCarriedBeans = Array.from(
      new Set([
        ...(parentScope?.carriedBeans ?? []),
        ...(state.carriedBeans ?? []),
        ...(state.bean ? [state.bean] : []),
        ...(node.beans ?? []),
        ...(node.beanRef ? [node.beanRef] : []),
      ]),
    ).sort((a, b) => a.localeCompare(b));

    const taskContext: TaskContext = {
      role: roleId ?? (roleStack.length > 0 ? roleStack[roleStack.length - 1] : undefined),
      roleStack,
      effectiveSkills,
      skills: effectiveSkills,
      conventions: combinedConventions,
      carriedBeans: taskCarriedBeans,
      // A step drawn reading the memory store (§4.14: only where the process
      // needs memory) is handed what was kept; `workflow_next` reads it.
      ...(node.reads.includes(MEMORY_STORE) ? { readsMemory: true } : {}),
      ...(node.writes.includes(MEMORY_STORE) ? { writesMemory: true } : {}),
    };

    if (node.kind === "exclusive") {
      const table = model.decisions.get(node.id);
      return [{
        kind: "decision" as const,
        node: node.id,
        name: node.name,
        lane: node.lane,
        role: roleId,
        outcomes: outcomesOf(model, node),
        computed: table
          ? { decision: table.id, facts: table.inputs.map((i) => i.expression) }
          : undefined,
        context: taskContext,
      }];
    }

    return [{
      kind: "activity" as const,
      node: node.id,
      name: node.name,
      lane: node.lane,
      role: roleId,
      roleSkills: roleId && roles ? resolveRoleSkills(roles, roleId).map((s) => s.skill) : undefined,
      skills: node.skills,
      conventions: combinedConventions,
      touchesWorkPlan: node.touchesWorkPlan,
      documentation: node.documentation,
      calledElement: node.calledElement,
      ...(node.globalTask ? { globalTask: node.globalTask.id } : {}),
      ...(node.inputs ? { inputs: node.inputs } : {}),
      ...(node.kind === "boundary" ? { optionalOn: node.attachedTo } : {}),
      context: taskContext,
    }];
  });
}

/**
 * Record that a node is done, and advance.
 *
 * Refuses a node that holds no token. That refusal is the feature: it is what
 * stops a step being reported as done out of order, or twice, or at all when
 * the process never reached it.
 */
export function complete(
  model: ProcessModel,
  state: InstanceState,
  nodeId: string,
  opts: {
    outcome?: string;
    /** For a gateway backed by a DMN table: the values it reads. */
    facts?: Record<string, unknown>;
    actor?: string;
    note?: string;
    /** Run the task-authorization check before recording anything. */
    authz?: AuthzOptions;
    /** Single model configured for execution. */
    model?: ModelConfig;
    /** Role graph for looking up lane/role capability requirements. */
    roles?: RoleGraph;
    /** Dynamic decision table override for computed gateways (e.g. per-plan exit criteria). */
    decisionTable?: import("./decision-table.js").DecisionTable | null;
    /** If dynamic decision table was unresolvable, the failure explanation. */
    decisionTableError?: string;
    /** Carried beans to add or update during this step. */
    carriedBeans?: string[];
    /** PROV-O activities a Tool performed in this step; see {@link HistoryEntry.activities}. */
    activities?: readonly unknown[];
  } = {},
): InstanceState {
  if (state.status !== "running") {
    throw new WorkflowError(`instance ${state.id} is ${state.status}`);
  }
  const node = model.nodes.get(nodeId);
  if (!node) {
    // Not a node of THIS process — but it may be a step of a subprocess running
    // inside it, which is the normal case once a diagram is decomposed. The
    // caller names the leaf step, exactly as `workflow_next` reported it.
    const owner = subprocessOwning(model, state, nodeId);
    if (owner) return completeInSubprocess(model, state, owner, nodeId, opts);
    throw new WorkflowError(`no such node: ${nodeId}`);
  }
  // A non-interrupting boundary event is enabled while its activity holds a
  // token, and completing it leaves that token where it is.
  const holder = node.kind === "boundary" ? node.attachedTo! : nodeId;
  if (!state.tokens.includes(holder)) {
    const owner = subprocessOwning(model, state, nodeId);
    if (owner) return completeInSubprocess(model, state, owner, nodeId, opts);
    const open = enabled(model, state).map((e) => e.node);
    throw new WorkflowError(
      `${nodeId} is not enabled in instance ${state.id}. ` +
        (open.length
          ? `Enabled now: ${open.join(", ")}.`
          : `Nothing is enabled; the instance is finished or stuck.`),
    );
  }
  if (state.children?.[nodeId]?.status === "running") {
    const open = enabled(model, state).map((e) => e.node);
    throw new WorkflowError(
      `${nodeId} ("${node.name}") is a subprocess, not a step. It finishes when its own ` +
        `steps do — complete those instead` +
        (open.length ? `: ${open.join(", ")}.` : "."),
    );
  }

  // If a single model is configured and roles are provided, verify the lane's role
  // capabilities. If the model lacks any required capability, refuse rather than degrade.
  if (opts.model && opts.roles) {
    const roleId = node.roleRef ?? (node.lane ? roleForLane(opts.roles, node.lane, node.roleRef)?.id : undefined);
    if (roleId) {
      validateLaneModelCapabilities(roleId, node.lane ?? roleId, opts.model, opts.roles);
    }
  }

  // Every task and every decision, before anything is recorded: authenticated,
  // assigned to the lane's role, and permitted by policy (issue #1207). Here
  // rather than in the MCP tool so that any caller of the interpreter that
  // supplies a context gets the same check — it is the engine's duty, not a
  // tool's.
  let authz: TaskAuthVerdict | undefined;
  if (opts.authz) {
    authz = authorizeTask(
      opts.authz.ctx,
      {
        principal: opts.authz.principal,
        process: model.id,
        task: nodeId,
        role: node.roleRef,
        target: opts.authz.target,
      },
      opts.authz.mode,
    );
    if (!authz.allowed) throw new WorkflowError(`${nodeId} ("${node.name}"): ${describeVerdict(authz)}`);
  }

  let chosen: string | undefined;
  let computedNote: string | undefined;
  const defaultTable = model.decisions.get(nodeId);
  const hasDynamicTable = opts.decisionTable !== undefined || opts.decisionTableError !== undefined;
  if (node.kind === "exclusive" && (defaultTable || hasDynamicTable)) {
    if (opts.decisionTable === null || opts.decisionTableError) {
      // Dynamic decision table was unresolvable: route to undetermined, NEVER fall back to default
      const outcomes = outcomesOf(model, node);
      const idx = outcomes.findIndex((o) => o.toLowerCase() === "undetermined");
      if (idx === -1) {
        throw new WorkflowError(
          `${nodeId} ("${node.name}"): dynamic decision table unresolvable (${opts.decisionTableError ?? "unknown"}), but gateway has no undetermined branch`,
        );
      }
      chosen = node.outgoing[idx];
      computedNote = `dynamic decision table unresolvable (${opts.decisionTableError ?? "unknown"}) → undetermined`;
    } else {
      const table = opts.decisionTable ?? defaultTable!;
      // Computed, not chosen. Accepting a hand-supplied outcome here would let the
      // caller assert the very thing the table exists to derive.
      if (opts.outcome) {
        throw new WorkflowError(
          `${nodeId} ("${node.name}") is computed by ${table.id}, not chosen. ` +
            `Pass facts (${table.inputs.map((i) => i.expression).join(", ")}) ` +
            `instead of outcome.`,
        );
      }
      if (!opts.facts) {
        throw new WorkflowError(
          `${nodeId} ("${node.name}") is computed by ${table.id}. Supply facts: ` +
            table.inputs
              .map((i) => `${i.expression}${i.label ? ` (${i.label})` : ""}`)
              .join(", "),
        );
      }
      const result = evaluate(table, opts.facts);
      const outcomes = outcomesOf(model, node);
      const idx = outcomes.findIndex((o) => o === String(result.outcome));
      if (idx === -1) {
        // Unreachable while loadProcessModel's check holds; kept so a future
        // loosening of that check cannot turn into a silent mis-route.
        throw new WorkflowError(
          `${table.id} returned "${result.outcome}", which is not a branch of ${nodeId} ` +
            `(${outcomes.join(", ")})`,
        );
      }
      chosen = node.outgoing[idx];
      computedNote =
        `${table.id} → ${result.outcome} by ${result.rule}` +
        (result.ruleDescription ? ` (${result.ruleDescription})` : "");
    }
  } else if (node.kind === "exclusive") {
    const outcomes = outcomesOf(model, node);
    if (!opts.outcome) {
      throw new WorkflowError(
        `${nodeId} ("${node.name}") is a decision — pass one of: ${outcomes.join(", ")}`,
      );
    }
    const idx = outcomes.findIndex((o) => o.toLowerCase() === opts.outcome!.toLowerCase());
    if (idx === -1) {
      throw new WorkflowError(
        `"${opts.outcome}" is not an outcome of ${nodeId} ("${node.name}"). ` +
          `Valid: ${outcomes.join(", ")}`,
      );
    }
    chosen = node.outgoing[idx];
  }

  const nodeBeans = [
    ...(node.beans ?? []),
    ...(node.beanRef ? [node.beanRef] : []),
  ];
  if (opts.carriedBeans?.length || nodeBeans.length) {
    state.carriedBeans = Array.from(
      new Set([...(state.carriedBeans ?? []), ...(opts.carriedBeans ?? []), ...nodeBeans]),
    ).sort((a, b) => a.localeCompare(b));
  }

  const activities = stepActivities(opts.activities, nodeId);
  state.tokens = state.tokens.filter((t) => t !== nodeId);
  const at = now();
  const priorChainedProv = [...state.history]
    .reverse()
    .map((h) => h.prov)
    .find((p) => p !== undefined && p["cat-harness:recordHash"] !== undefined);
  const shouldChain =
    Boolean(opts.authz?.agreement) ||
    Boolean(opts.authz?.chain) ||
    priorChainedProv !== undefined;
  const previousHash = shouldChain
    ? (priorChainedProv?.["cat-harness:recordHash"] ?? null)
    : undefined;
  const prov =
    authz && opts.authz
      ? provActivityFor({
          id: `${state.id}#${state.history.length}`,
          at,
          source: state.source,
          node: nodeId,
          verdict: authz,
          policies: [...opts.authz.ctx.policies.keys()],
          target: opts.authz.target,
          ...(opts.authz.agreement ? { agreement: opts.authz.agreement } : {}),
          ...(opts.authz.grant ? { grant: opts.authz.grant } : {}),
          ...(opts.authz.consent ? { consent: opts.authz.consent } : {}),
          ...(opts.authz.consentBased !== undefined ? { consentBased: opts.authz.consentBased } : {}),
          ...(shouldChain ? { previousHash, chain: true } : {}),
        })
      : undefined;
  state.history.push({
    at,
    node: nodeId,
    outcome: chosen ? model.flows.get(chosen)!.name : undefined,
    actor: opts.actor,
    // The rule that fired is the audit trail: "which table said so, and why".
    note: [opts.note, computedNote].filter(Boolean).join(" · ") || undefined,
    authz,
    prov,
    ...(activities.length ? { activities: informedByStep(activities, prov) } : {}),
  });

  const flowIds = chosen ? [chosen] : node.outgoing;
  if (flowIds.length === 0) {
    throw new WorkflowError(`${nodeId} has no outgoing flow and is not an end event`);
  }
  for (const flowId of flowIds) {
    const flow = model.flows.get(flowId)!;
    settle(model, state, flow.to, flow.id);
  }
  enterSubprocesses(model, state);

  if (state.tokens.length === 0) state.status = "completed";
  state.updatedAt = now();
  return state;
}

/**
 * The Tool activities handed in for step `nodeId`, checked before anything is
 * recorded: each parses as a `prov:Activity`, and its plan is THIS step
 * (`<process>#<nodeId>`). An activity naming another step would put a record
 * on the wrong step, so it refuses the whole call rather than being dropped.
 */
export function stepActivities(raw: readonly unknown[] | undefined, nodeId: string): ProvActivity[] {
  const out: ProvActivity[] = [];
  for (const [i, a] of (raw ?? []).entries()) {
    const parsed = ProvActivitySchema.safeParse(a);
    if (!parsed.success) {
      throw new WorkflowError(
        `activities[${i}] is not a prov:Activity: ${parsed.error.issues.map((x) => `${x.path.join(".") || "(root)"}: ${x.message}`).join("; ")}`,
      );
    }
    const plan = parsed.data["prov:qualifiedAssociation"]["prov:hadPlan"];
    if (!plan.endsWith(`#${nodeId}`)) {
      throw new WorkflowError(`activities[${i}] was done for ${plan}, not for this step (${nodeId})`);
    }
    out.push(parsed.data);
  }
  return out;
}

/**
 * Link each Tool activity to the step's own `prov:Activity` with W3C PROV-O
 * `prov:wasInformedBy` (bean `w1gy`, folio-assistant#875 FR-005): the Tool
 * acted as part of the step the engine recorded.
 *
 * Only when the step HAS its own activity with an `@id` — none is invented,
 * so a step recorded without an authorization context leaves its Tool
 * activities as they were handed in. A `prov:wasInformedBy` the Tool already
 * supplied is kept: the step's `@id` is added beside it (an array, as JSON-LD
 * writes several values of one property), never put in its place.
 *
 * A Tool activity that is hash-sealed (`cat-harness:recordHash`) is left
 * untouched: adding a field would break the digest it carries, and rewriting
 * the digest would put the engine's words in the Tool's sealed record.
 */
export function informedByStep(
  activities: readonly ProvActivity[],
  step: ProvActivity | undefined,
): ProvActivity[] {
  const stepId = step?.["@id"];
  if (!stepId) return [...activities];
  return activities.map((a) => {
    if (a["cat-harness:recordHash"] !== undefined) return a;
    const had = a["prov:wasInformedBy"];
    const prior = had === undefined ? [] : Array.isArray(had) ? had : [had];
    if (prior.includes(stepId)) return a;
    const merged = [...prior, stepId];
    return { ...a, "prov:wasInformedBy": merged.length === 1 ? merged[0]! : merged };
  });
}

/**
 * Record a step that belongs to a subprocess, and release the parent when the
 * subprocess finishes.
 *
 * The parent's token sits on the call activity for as long as the child runs,
 * so there is nothing to do here until the child completes — at which point the
 * phase is genuinely done and the parent advances the same way it would off any
 * other activity. `complete` is re-entered rather than open-coded so the
 * parent's own history entry, bean operation and onward routing are the ones
 * every other step gets.
 */
function completeInSubprocess(
  model: ProcessModel,
  state: InstanceState,
  owner: { call: string; model: ProcessModel; state: InstanceState },
  nodeId: string,
  opts: Parameters<typeof complete>[3],
): InstanceState {
  const child = complete(owner.model, owner.state, nodeId, opts);
  state.children = { ...state.children, [owner.call]: child };
  state.updatedAt = now();
  if (child.status !== "completed") return state;
  if (child.carriedBeans?.length) {
    state.carriedBeans = Array.from(
      new Set([...(state.carriedBeans ?? []), ...child.carriedBeans]),
    ).sort((a, b) => a.localeCompare(b));
  }
  return complete(model, state, owner.call, {
    actor: opts?.actor,
    note: `subprocess ${child.processId} completed`,
  });
}

/**
 * Where an instance is, as data: what `describe` renders, for programs and
 * BPMN gateways that read a typed result instead of the text (cat-harness-tools#1259,
 * group 2). `done` lists every recorded activity and decision, oldest first;
 * `describe` shows only the last eight.
 */
export interface WorkflowPosition {
  instance: string;
  process: string;
  processName: string;
  subject: string;
  bean?: string;
  status: InstanceState["status"];
  enabled: Enabled[];
  done: Array<{ node: string; name: string; outcome?: string }>;
}

export function position(model: ProcessModel, state: InstanceState, roles?: RoleGraph): WorkflowPosition {
  return {
    instance: state.id,
    process: state.processId,
    processName: model.name,
    subject: state.subject,
    ...(state.bean ? { bean: state.bean } : {}),
    status: state.status,
    enabled: enabled(model, state, roles),
    done: state.history
      .filter((h) => isActivityHistory(model, h))
      .map((h) => ({ node: h.node, name: model.nodes.get(h.node)?.name ?? h.node, ...(h.outcome ? { outcome: h.outcome } : {}) })),
  };
}

/** A short human- and agent-readable rendering of where an instance is. */
/**
 * The human-readable rendering. `roles` is threaded through rather than
 * resolved here so that `describe` and `enabled` cannot give different answers
 * about who performs a step.
 */
export function describe(model: ProcessModel, state: InstanceState, roles?: RoleGraph): string {
  const lines: string[] = [
    `instance ${state.id} — ${model.name} (${state.processId})`,
    `  subject: ${state.subject}${state.bean ? `   bean: ${state.bean}` : ""}`,
    `  status:  ${state.status}`,
  ];
  const open = enabled(model, state, roles);
  if (open.length === 0) {
    lines.push(state.status === "completed" ? "  nothing left to do" : "  nothing enabled — stuck");
  } else {
    lines.push("", "  enabled now:");
    for (const e of open) {
      if (e.kind === "decision") {
        lines.push(
          `    ? ${e.name}  [${e.node}]${e.lane ? `  — ${e.lane}` : ""}${e.role ? `  (role: ${e.role})` : ""}`,
        );
        if (e.phase?.length) lines.push(`        inside: ${e.phase.join(" ▸ ")}`);
        if (e.computed) {
          lines.push(
            `        computed by ${e.computed.decision} — supply facts: ${e.computed.facts.join(", ")}`,
            `        it will route to one of: ${e.outcomes.join(" | ")}`,
          );
        } else {
          lines.push(`        choose one of: ${e.outcomes.join(" | ")}`);
        }
      } else {
        lines.push(
          `    • ${e.name}  [${e.node}]${e.lane ? `  — ${e.lane}` : ""}`,
          ...(e.phase?.length ? [`        inside: ${e.phase.join(" ▸ ")}`] : []),
          ...(e.role ? [`        acting as: ${e.role}`] : []),
          ...(e.skills.length ? [`        skill: ${e.skills.join(", ")}`] : []),
          ...(e.role && e.roleSkills?.length
            ? [`        that role also carries: ${e.roleSkills.filter((s) => !e.skills.includes(s)).join(", ") || "nothing further"}`]
            : []),
          // Named with their scope, because "every step in this process" and
          // "this step only" are different claims and an agent that cannot
          // tell them apart cannot say why a rule applies to it.
          ...(e.conventions.length
            ? [`        conventions: ${e.conventions.map((c) => `${c.ref} (${c.scope})`).join(", ")}`]
            : []),
          ...(e.touchesWorkPlan ? [`        touches the work plan (beans/)`] : []),
          ...(e.context?.carriedBeans.length
            ? [`        carried beans: ${e.context.carriedBeans.join(", ")}`]
            : []),
          ...(e.calledElement ? [`        expands into: ${e.calledElement}`] : []),
          ...(e.globalTask ? [`        shared step: ${e.globalTask}`] : []),
          ...(e.inputs ? [`        inputs: ${Object.entries(e.inputs).map(([k, v]) => `${k}=${v}`).join(", ")}`] : []),
        );
      }
    }
  }
  const done = state.history.filter((h) => isActivityHistory(model, h));
  if (done.length) {
    lines.push("", `  done (${done.length}):`);
    for (const h of done.slice(-8)) {
      lines.push(`    ✓ ${model.nodes.get(h.node)?.name ?? h.node}${h.outcome ? ` → ${h.outcome}` : ""}`);
    }
  }
  return lines.join("\n");
}

function isActivityHistory(model: ProcessModel, h: HistoryEntry): boolean {
  const n = model.nodes.get(h.node);
  return !!n && (isActivity(n) || n.kind === "exclusive");
}
