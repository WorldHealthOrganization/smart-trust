/**
 * MCP tools for running a process from `processes/*.bpmn`.
 *
 * Four tools, all content-agnostic, registered next to `work_plan_prime`:
 *
 * - `workflow_list`     — which processes exist, and which instances are open
 * - `workflow_start`    — begin one for a subject (a block, a release, a bean)
 * - `workflow_next`     — what is enabled *now*, with lane and skill
 * - `workflow_gate`     — may this step be performed right now?
 * - `workflow_complete` — record a step, or a decision, and advance
 *
 * A gateway that carries `folio:decision` is **computed**: the caller passes
 * the facts a DMN table reads (`{ failCritical: 0, failMajor: 2 }`) and the
 * table returns the branch. The agent reports numbers, not a verdict.
 *
 * ## What this buys, and what it does not
 *
 * `workflow_next` is **derived** from the diagram, not asserted by whoever is
 * working: `Commit into the corpus` has no token on it until the editor's
 * decision is recorded, so it cannot be reported done before the HCI gate.
 * `workflow_complete` refuses a step that holds no token, which is what stops
 * work being claimed out of order.
 *
 * That is ordering, not enforcement. Nothing here prevents an agent from
 * ignoring these tools and calling `content_validate` directly — this repo has
 * the failure on file (`5rfy`: 29 of 32 workflows never fire on their own). An
 * advisory orchestrator is one more thing an agent is *supposed* to call.
 * Making it binding means gating the capability tools on instance state, which
 * is a deliberate decision and is not taken here. See
 * `docs/proposals/workflow-orchestration.md`.
 *
 * @module folio-assistant/tools/workflow
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { processFiles, processRoots } from "../workflow/process-files.js";
import { z } from "zod";
import { basename, resolve } from "node:path";
import { findInModel, loadProcessModel, MEMORY_STORE, type ProcessModel } from "../workflow/process-model.js";
import { complete, describe, position, startInstance, withRefusal, WorkflowError, type InstanceState, type WorkflowPosition } from "../workflow/instance.js";
import { describePreflight, preflight, preflightRefusal } from "../workflow/preflight.js";
import { describeCapture, writeLogEntry } from "../logging/log-writer.js";
import { instanceId, listInstances, loadInstance, saveInstance } from "../workflow/store.js";
import { applyWorkPlanOp, onlyArchiveLeft } from "../workflow/bean-link.js";
import { workPlanStoreFor } from "../workflow/work-plan-store-select.js";
import { closeOut, drawsWorkPlan, record, takeUp, workContextFrom, type WorkContextTarget } from "../workflow/work-context.js";
import type { MemoryEntry } from "../../schemas/kg/memory-record.ts";
import { describeBeans, withBeans } from "../workflow/work-plan-store.js";
import { checkGate, loadRelaxations, validateRelaxations, type GateVerdict } from "../workflow/gate.js";
import { type RoleGraph } from "../../schemas/process/role-graph.js";
import { roleGraphFor } from "../../scripts/known-skills.js";
import { accessContext } from "../core/access.js";
import { githubPrincipalFor } from "../core/github-auth.js";
import { oneLineLabel, screenHandover, type FieldSpec } from "../core/handover-screen.js";

/**
 * An instance id as `instanceId` mints it (`crdm--folio-assistant-6lb8`,
 * `merge-train--train-6`): no slash, no `..`, no leading dot, since it is
 * joined into a path under `beans/workflows/` by the store.
 */
export const WORKFLOW_INSTANCE_ID = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/;
/** A BPMN node id: an XML NCName without the colon (`Task_DraftEdit`, `Gateway_Ready`). */
export const WORKFLOW_NODE_ID = /^[A-Za-z_][A-Za-z0-9_.-]{0,199}$/;
/**
 * The content a step acted on: a block id, a repo-relative path or a bean id
 * (`folio-assistant-1ygp`, `content/ch3/def-x.ts`). No whitespace, no `..`,
 * never absolute, never `~`.
 */
export const WORKFLOW_TARGET = /^(?!.*\.\.)[A-Za-z0-9_@#][A-Za-z0-9_.\/@#:+=-]{0,299}$/;
/**
 * A decision outcome. It is matched against the gateway's FLOW LABELS, and
 * those are prose rather than ids (`no, or unknown`, `rejected,\nattempts
 * left`), so this is a label pattern, not an id pattern: at most 160
 * characters, starting with a letter, digit, `[` or `(`, no control character
 * but a line break, and none of `<>{}`$\|`. Every sequence-flow label in the
 * repository's diagrams matched it when it was written. The engine then
 * refuses any outcome that is not one of the gateway's labels, which is the
 * real allow-list; this is the screen's own bound in front of it.
 */
export const WORKFLOW_OUTCOME = /^(?=[\s\S]{1,160}$)(?![\s\S]*[<>{}`$\\|])[\p{L}\p{N}[(][^\p{Cc}]*(?:\n[^\p{Cc}]+)*$/u;

/**
 * The declared shape of a `workflow_complete` hand-over: what steers the
 * engine, and what is only read. The id-shaped control fields carry a VALUE
 * constraint (roast 1ygp L4.3): the patterns alone passed any well-formed word.
 * `facts` is an object a decision table reads and `actor` is free text kept in
 * the history only (authorization is on the GitHub principal), so neither has one.
 */
export const WORKFLOW_COMPLETE_HANDOVER: Record<string, FieldSpec> = {
  instance: { role: "control", pattern: WORKFLOW_INSTANCE_ID },
  node: { role: "control", pattern: WORKFLOW_NODE_ID },
  outcome: { role: "control", pattern: WORKFLOW_OUTCOME },
  facts: "control",
  actor: "control",
  target: { role: "control", pattern: WORKFLOW_TARGET },
  activities: "control",
  note: "data",
};

/**
 * The engine's task-authorization mode. STRICT since the owner's rulings of
 * 2026-09-24 (issue #1207, bean `n2l9`): `perform-task` is granted to `owner`
 * and `collaborator` in every lane ("all write roles collapse"), and the
 * principal is the one GitHub vouches for, so `unknown`, an asserted actor and
 * nobody all refuse. If GitHub cannot be asked, a step cannot be recorded:
 * that is the price of authentication being real rather than typed.
 */
const ENGINE_MODE = "strict" as const;
import { authorizeTask, describeVerdict, type TaskAuthVerdict } from "../workflow/authorize.js";

// Re-exported: the resolver lives in cat-harness so cat-harness scripts
// (audit-reachability) can measure the SAME list without importing upward.
export { processFiles, processRoots };

/**
 * A workflow tool's answer: the text people read, and the same answer as data
 * (cat-harness-tools#1259, group 2). The MCP tools return both, the data as
 * `structuredContent`; the CLI and the string functions keep the text.
 */
export interface WorkflowAnswer<R> {
  text: string;
  result: R;
}
const answer = <R extends object>(a: WorkflowAnswer<R>) => ({
  content: [{ type: "text" as const, text: a.text }],
  structuredContent: a.result as Record<string, unknown>,
});

/** `workflow_list` as data. */
export interface WorkflowListing {
  processes: Array<{ file: string; name?: string; id?: string; activities?: number; error?: string }>;
  instances: Array<{ id: string; subject: string; status: InstanceState["status"]; updatedAt: string }>;
}

/** `workflow_start` as data: whether a new instance began, and where it is. */
export interface WorkflowStarted {
  started: boolean;
  position: WorkflowPosition;
}

/** `workflow_gate` as data. `allowed` is both verdicts: either refusing refuses. */
export interface WorkflowGateAnswer {
  allowed: boolean;
  gate: GateVerdict;
  authorization: TaskAuthVerdict;
  /** The actor the caller named, when it differs from the principal GitHub vouches for. */
  namedActor?: string;
}

/** `workflow_complete` as data. */
export interface WorkflowCompletion {
  position: WorkflowPosition;
  authorization?: TaskAuthVerdict;
  /** What the step did to the work plan, when it carries a bean operation. */
  workPlan?: string;
}

/** Resolve a process by file stem (`editing-hci-validation`) or by process id. */
async function resolveModel(repoRoot: string, ref: string): Promise<ProcessModel> {
  // EVERY declared knowledge-graph directory, not the literal
  // `processes/`. A topical layout puts diagrams in more than one
  // place, and a resolver that knows only one of them reports a process that
  // exists as missing — which reads to a caller exactly like a typo.
  const files = processFiles(repoRoot);
  const stem = basename(ref).replace(/\.bpmn$/, "");

  const direct = files.find((f) => basename(f, ".bpmn") === stem);
  if (direct) return loadProcessModel(direct);

  for (const f of files) {
    const model = await loadProcessModel(f);
    if (model.id === ref) return model;
  }
  throw new Error(
    `No process "${ref}". Available: ` +
      (files.length > 0
        ? files.map((f) => basename(f, ".bpmn")).join(", ")
        : "none — no declared directory holds a .bpmn"),
  );
}

/**
 * The authorization verdict a step was just recorded under. A step inside a
 * subprocess is recorded in that child's history, so the search descends.
 */
function lastVerdict(state: InstanceState, node: string): TaskAuthVerdict | undefined {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i]!;
    if (h.node === node && h.authz) return h.authz;
  }
  for (const child of Object.values(state.children ?? {})) {
    const v = lastVerdict(child, node);
    if (v) return v;
  }
  return undefined;
}

/**
 * The role graph for `repoRoot`, so every step can say what the agent is acting AS.
 *
 * Read lazily and a read failure is swallowed to `undefined` rather than
 * taking the tools down: a layer that declares no role graph is
 * unmigrated, not broken, and the workflow interpreter predates roles.
 * A graph that is present but malformed is `kg:audit`'s finding — it fails
 * loudly there, which is where somebody can act on it.
 */
const rolesByRoot = new Map<string, RoleGraph | undefined>();

export function resolveWorkflowRoles(repoRoot: string): RoleGraph | undefined {
  const root = resolve(repoRoot);
  if (rolesByRoot.has(root)) return rolesByRoot.get(root);
  try {
    // declared-path-literal: the convention fallback, at the call site.
    // A role graph lives in a declared knowledge-graph root.
    // Root first, then the nearest dependency that declares one (bean
    // `nf2z`): at the repository root the graph lives in a dependency.
    let graph: RoleGraph | undefined;
    for (const r of [...processRoots(root)].reverse()) {
      graph = roleGraphFor(r);
      // A graph that declares no role of its own is a layer of
      // EXTENSIONS by id (placement PR0b/PR1, e.g. core's
      // `scenarios/roles.json`), not the graph a lane binds into: keep
      // going down to the layer that declares the roles, whose
      // checkout answer already carries every extension.
      if (graph && graph.roles.length > 0) break;
    }
    rolesByRoot.set(root, graph);
    return graph;
  } catch {
    rolesByRoot.set(root, undefined);
    return undefined;
  }
}

export interface WorkflowStartInput {
  process: string;
  subject: string;
  bean?: string;
  /** The work plan this run is part of: an epic or milestone id (`schemas/sdlc/work-plan.ts`). */
  plan?: string;
}

export interface WorkflowNextInput {
  instance: string;
}

export interface WorkflowGateInput {
  instance: string;
  activity: string;
  actor?: string;
  target?: string;
}

export interface WorkflowCompleteInput {
  instance: string;
  node: string;
  outcome?: string;
  facts?: Record<string, unknown>;
  actor?: string;
  target?: string;
  note?: string;
  activities?: unknown[];
}

export interface WorkflowToolEnv {
  env?: Parameters<typeof githubPrincipalFor>[1];
  fetch?: Parameters<typeof githubPrincipalFor>[2];
  roles?: () => RoleGraph | undefined;
}

/** Shared implementation of `workflow_list` for MCP and CLI (`workflow:list`). */
export async function workflowList(repoRoot: string): Promise<string> {
  return (await workflowListAnswer(repoRoot)).text;
}

export async function workflowListAnswer(repoRoot: string): Promise<WorkflowAnswer<WorkflowListing>> {
  const root = resolve(repoRoot);
  const files = processFiles(root);
  const lines: string[] = ["# Processes", ""];
  const processes: WorkflowListing["processes"] = [];
  for (const f of files) {
    try {
      const m = await loadProcessModel(f);
      const acts = [...m.nodes.values()].filter((n) => n.kind === "activity");
      processes.push({ file: f, name: m.name, id: m.id, activities: acts.length });
      lines.push(
        `- **${f.replace(/\.bpmn$/, "")}** — ${m.name} (\`${m.id}\`), ` +
          `${acts.length} activities`,
      );
    } catch (e) {
      processes.push({ file: f, error: (e as Error).message });
      lines.push(`- **${f}** — cannot be interpreted: ${(e as Error).message}`);
    }
  }
  if (files.length === 0) lines.push("_(none)_");

  const open = listInstances(root);
  lines.push("", "# Instances", "");
  if (open.length === 0) lines.push("_(none)_");
  for (const i of open) {
    lines.push(`- \`${i.id}\` — ${i.subject} · ${i.status} · updated ${i.updatedAt}`);
  }
  return {
    text: lines.join("\n"),
    result: {
      processes,
      instances: open.map((i) => ({ id: i.id, subject: i.subject, status: i.status, updatedAt: i.updatedAt })),
    },
  };
}

/**
 * Keep work context through the deployment's store (§4.13). The step is
 * already recorded, so a store that cannot be opened is reported, never thrown.
 */
function keepContext(root: string, opts: WorkflowToolEnv | undefined, act: (t: WorkContextTarget) => { summary: string }): string | undefined {
  let target: WorkContextTarget;
  try {
    // input-site: env CAT_WORK_INSTANCE #f4c974e2 — the deployment and memory directory the run's launcher set
    const env = opts?.env ?? process.env;
    target = workContextFrom(workPlanStoreFor(root, env), env);
  } catch (e) {
    return `work context not kept: ${e instanceof Error ? e.message : String(e)}`;
  }
  return act(target).summary;
}

/**
 * Fill `context.memory` on every enabled step drawn reading the memory store,
 * from the instance's own item, through the deployment's work-context store.
 * Returns the lines `workflow_next` adds to its text.
 */
function withMemory(
  pos: { enabled: Array<{ node: string; context?: { readsMemory?: boolean; memory?: MemoryEntry[] } }> },
  chosen: ReturnType<typeof workPlanStoreFor>,
  item: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
): string {
  const readers = pos.enabled.filter((e) => e.context?.readsMemory);
  if (!readers.length) return "";
  let target: WorkContextTarget;
  try {
    target = workContextFrom(chosen, env);
  } catch (e) {
    return `\n\n  memory not read: ${e instanceof Error ? e.message : String(e)}`;
  }
  if ("none" in target) return "\n\n  memory: this deployment keeps none";
  if (!item) return "\n\n  memory: this instance tracks no item";
  const r = target.store.recall(item);
  if (r.state !== "hit") return `\n\n  memory not read: item ${item} is not in the store`;
  for (const e of readers) e.context!.memory = r.record.entries;
  const last = r.record.entries.slice(-10);
  return (
    `\n\n  memory (${r.record.entries.length} kept, for ${readers.map((e) => e.node).join(", ")}):` +
    last.map((e) => `\n    - ${e.at} ${e.by} ${e.kind}${e.text ? `: ${e.text}` : ""}`).join("")
  );
}

/** Shared implementation of `workflow_start` for MCP and CLI (`workflow:start`). */
export async function workflowStart(
  repoRoot: string,
  { process, subject, bean, plan }: WorkflowStartInput,
  opts?: WorkflowToolEnv,
): Promise<string> {
  return (await workflowStartAnswer(repoRoot, { process, subject, bean, plan }, opts)).text;
}

export async function workflowStartAnswer(
  repoRoot: string,
  { process, subject, bean, plan }: WorkflowStartInput,
  opts?: WorkflowToolEnv,
): Promise<WorkflowAnswer<WorkflowStarted>> {
  const root = resolve(repoRoot);
  const roles = opts?.roles ?? (() => resolveWorkflowRoles(root));
  const model = await resolveModel(root, process);
  const id = instanceId(model.id, subject);
  const existing = loadInstance(root, id);
  if (existing) {
    const r = roles();
    return {
      text:
        `An instance already exists for this subject — continuing it rather than ` +
        `starting a second.\n\n${describe(model, existing, r)}`,
      result: { started: false, position: position(model, existing, r) },
    };
  }
  // The pre-execution gate, and the FIRST non-test caller `<bootstrap.processes:precondition>`
  // has ever had (issue #853, requirement 3). Asked here rather than in
  // `startInstance` because a precondition is what must hold BEFORE the start
  // event: `startInstance` also runs for every subprocess entered mid-flight,
  // and re-asking there answers a different question.
  //
  // Only `unsatisfied` refuses. `could-not-determine` proceeds and is NAMED
  // in the output — three of the four preconditions in this repository are
  // `stated` and structurally unobservable, so blocking on them would not be
  // a gate, it would be an outage. See `workflow/preflight.ts`.
  const gate = preflight(model);
  const refusal = preflightRefusal(gate);
  if (refusal) throw new Error(refusal);
  const state = startInstance(model, { id, subject, bean, plan });
  const path = saveInstance(root, state);
  // Work context (§4.13): a process that no longer draws the work plan has
  // its item taken up by the engine, as Process_BeanOpen did for one that does.
  const kept = drawsWorkPlan(model)
    ? undefined
    : keepContext(root, opts, (t) =>
        takeUp(t, bean, { process: model.id, instance: id, by: "workflow" }, `${model.name || model.id} started for ${subject}`),
      );
  // The activity log's `task-start`. Reported on the tool's own output
  // rather than written silently: the skill requires the capture state to
  // be SAID, and a caller that has to go and look at a directory to find
  // out whether it has an audit trail does not have one it can rely on.
  const log = writeLogEntry(
    root,
    {
      event: "task-start",
      summary: `started ${model.id} for ${subject}`,
      process: model.id,
      bean,
      session: id,
    },
    model.logCapture,
  );
  const r = roles();
  const hasWorkPlan = Boolean(plan?.trim()) || Boolean(bean?.trim());
  const workPlanLine =
    plan !== undefined && plan.trim() !== ""
      ? `Part of work plan \`${plan}\`.\n`
      : model.startsFromWorkPlan && !hasWorkPlan
        ? `Work plan: \`${model.id}\` declares that it starts from a work plan, and none was passed (\`--plan <id>\` or \`--bean <id>\`).\n`
        : "";
  return {
    text:
      `Started. State in \`${path.replace(`${root}/`, "")}\`.\n` +
      workPlanLine +
      // Said on the tool's own output, on the same argument the capture
      // state is: a caller that has to go and look somewhere else to find
      // out whether the gate ran does not have one it can rely on.
      `${describePreflight(gate)}\n` +
      `${describeCapture(log)}\n` +
      (kept ? `  ${kept}\n` : "") +
      `\n${describe(model, state, r)}`,
    result: { started: true, position: position(model, state, r) },
  };
}

/** Shared implementation of `workflow_next` for MCP and CLI (`workflow:next`). */
export async function workflowNext(
  repoRoot: string,
  { instance }: WorkflowNextInput,
  opts?: WorkflowToolEnv,
): Promise<string> {
  return (await workflowNextAnswer(repoRoot, { instance }, opts)).text;
}

export async function workflowNextAnswer(
  repoRoot: string,
  { instance }: WorkflowNextInput,
  opts?: WorkflowToolEnv,
): Promise<WorkflowAnswer<WorkflowPosition>> {
  const root = resolve(repoRoot);
  const roles = opts?.roles ?? (() => resolveWorkflowRoles(root));
  const state = loadInstance(root, instance);
  if (!state) throw new Error(`No instance "${instance}". Try workflow_list.`);
  const model = await loadProcessModel(resolve(root, state.source));
  const r = roles();
  // The beans themselves, not only their ids (cat-harness#991 step 4b): read
  // through the work-plan store, so an agent handed a step reads its bean's
  // title, status, body and position without a second call.
  // The store is the deployment's (Q-BSD-2 A). One it cannot open does not
  // stop the answer: the position stands, and the text says why no bean was read.
  let chosen: ReturnType<typeof workPlanStoreFor>;
  try {
    chosen = workPlanStoreFor(root, opts?.env ?? process.env);
  } catch (e) {
    return {
      text: `${describe(model, state, r)}\n\n  beans not read: ${e instanceof Error ? e.message : String(e)}`,
      result: position(model, state, r),
    };
  }
  const pos = withBeans(position(model, state, r), chosen.store);
  const beans = [...new Map(pos.enabled.flatMap((e) => e.context?.beans ?? []).map((b) => [b.id, b])).values()];
  // A step drawn reading the memory store is handed what was kept (§4.14).
  const memory = withMemory(pos, chosen, state.bean, opts?.env ?? process.env);
  return { text: describe(model, state, r) + describeBeans(beans) + memory, result: pos };
}

/** Shared implementation of `workflow_gate` for MCP and CLI (`workflow:gate`). */
export async function workflowGate(
  repoRoot: string,
  { instance, activity, actor, target }: WorkflowGateInput,
  opts?: WorkflowToolEnv,
): Promise<string> {
  return (await workflowGateAnswer(repoRoot, { instance, activity, actor, target }, opts)).text;
}

export async function workflowGateAnswer(
  repoRoot: string,
  { instance, activity, actor, target }: WorkflowGateInput,
  opts?: WorkflowToolEnv,
): Promise<WorkflowAnswer<WorkflowGateAnswer>> {
  const root = resolve(repoRoot);
  const state = loadInstance(root, instance);
  if (!state) throw new Error(`No instance "${instance}". Try workflow_list.`);
  const model = await loadProcessModel(resolve(root, state.source));
  const relaxations = loadRelaxations(root);
  validateRelaxations(relaxations, [model]);
  const verdict = checkGate(model, state, activity, relaxations);
  // The second question a gate answers: not only "may this step run now"
  // but "may THIS actor run it" (issue #1207). Both are shown; either
  // refusing refuses.
  const owner = findInModel(model, activity);
  const { principal } = await githubPrincipalFor(root, opts?.env ?? process.env, opts?.fetch);
  const authz = authorizeTask(
    accessContext(root),
    {
      principal,
      process: owner?.model.id ?? model.id,
      task: activity,
      role: owner?.model.nodes.get(activity)?.roleRef,
      target,
    },
    ENGINE_MODE,
  );
  const allowed = verdict.allowed && authz.allowed;
  const named = actor && actor !== principal.actor ? actor : undefined;
  return {
    text:
      `${allowed ? "ALLOWED" : "REFUSED"} — ${verdict.reason}` +
      (verdict.relaxedBy
        ? `\n\nDeclared in skills/${verdict.relaxedBy.package}/workflow-policy.json.`
        : "") +
      `\n\n${describeVerdict(authz)}` +
      (named
        ? `\n\nYou named "${named}"; strict mode decides on the principal GitHub vouches for, not on a typed actor.`
        : ""),
    result: { allowed, gate: verdict, authorization: authz, ...(named ? { namedActor: named } : {}) },
  };
}

/** Shared implementation of `workflow_complete` for MCP and CLI (`workflow:complete`). */
export async function workflowComplete(
  repoRoot: string,
  input: WorkflowCompleteInput,
  opts?: WorkflowToolEnv,
): Promise<string> {
  return (await workflowCompleteAnswer(repoRoot, input, opts)).text;
}

export async function workflowCompleteAnswer(
  repoRoot: string,
  { instance, node, outcome, facts, actor, target, note: rawNote, activities }: WorkflowCompleteInput,
  opts?: WorkflowToolEnv,
): Promise<WorkflowAnswer<WorkflowCompletion>> {
  const root = resolve(repoRoot);
  const roles = opts?.roles ?? (() => resolveWorkflowRoles(root));
  // The arguments are a hand-over from the calling agent (H3, H9; bean
  // `cztn`). Everything but `note` steers the engine, `facts` included,
  // since a decision table branches on it, so a finding there REFUSES.
  // `note` is read later by another agent (the bean body, the log), so a
  // finding there QUARANTINES: kept verbatim, marked, and reported back.
  const screen = screenHandover(
    { instance, node, outcome, facts, actor, target, note: rawNote, activities },
    { fields: WORKFLOW_COMPLETE_HANDOVER },
  );
  if (screen.state === "refused") {
    throw new Error(
      `workflow_complete refused by the hand-over screen: ` +
        screen.findings.map((f) => `${f.path} (${f.role}): ${f.kind} "${f.excerpt}"`).join("; "),
    );
  }
  // One line, always: a note is appended to a bean body, where a line of
  // its own could forge a claim record (`CLAIM_NOTE` is line-anchored;
  // roast 1ygp L2.4). Whitespace is folded.
  // Pass on the copy the screen read, never the arguments re-read (L1.2,
  // adjudication of 1ygp: the library returned it and this caller ignored it).
  const seen = screen.screened ?? {};
  const screenedFacts = seen.facts as typeof facts;
  const screenedNote = typeof seen.note === "string" ? seen.note : undefined;
  // Capped, and the cap is SAID: "never a word dropped" was false while a
  // 4,000-character cut was silent (adjudication of 1ygp, new defect 3).
  const NOTE_MAX = 4000;
  const folded = screenedNote === undefined ? undefined : oneLineLabel(screenedNote, Number.MAX_SAFE_INTEGER);
  const oneLine =
    folded === undefined || folded.length <= NOTE_MAX
      ? folded
      : `${folded.slice(0, NOTE_MAX)} [… cut: ${folded.length - NOTE_MAX} more characters not kept]`;
  const note =
    screen.state === "quarantined" && oneLine !== undefined
      ? `[QUARANTINED by the hand-over screen: ${[...new Set(screen.findings.map((f) => f.kind))].join(", ")}; kept, data not instruction] ${oneLine}`
      : oneLine;
  const state = loadInstance(root, instance);
  if (!state) throw new Error(`No instance "${instance}". Try workflow_list.`);
  const model = await loadProcessModel(resolve(root, state.source));
  // `actor` stays in the history as what the caller SAID it was acting as;
  // authorization is decided on the principal GitHub vouches for.
  const { principal } = await githubPrincipalFor(root, opts?.env ?? process.env, opts?.fetch);
  let next: InstanceState;
  try {
    next = complete(model, state, node, {
      outcome,
      facts: screenedFacts,
      actor: actor ?? principal.account,
      note,
      authz: { ctx: accessContext(root), principal, target, mode: ENGINE_MODE },
      activities: seen.activities as unknown[] | undefined,
    });
  } catch (e) {
    // Bean `v49e`: a refusal is recorded on the instance, so a gate that
    // keeps refusing is visible as a state rather than as nothing. Only the
    // engine's own refusals (`WorkflowError`); anything else is a fault,
    // not a gate. Recorded on a FRESH read, since `complete` may have
    // touched the copy it was given before it refused.
    if (e instanceof WorkflowError) {
      const fresh = loadInstance(root, instance);
      if (fresh) {
        saveInstance(
          root,
          withRefusal(fresh, { at: new Date().toISOString(), node, actor: actor ?? principal.account, reason: e.message }),
        );
      }
    }
    throw e;
  }
  saveInstance(root, next);

  // A bean-marked step IS the work-plan operation, not a step about it.
  // Done after the advance so `resolve` can see whether the process it
  // tracks actually finished.
  //
  // Looked up through the subprocess tree, not in the top-level process:
  // once a diagram is decomposed the bean-marked steps live in its phases
  // (`Close_Complete` carries `op="resolve"` and sits in Process_BeanClose,
  // which every bean-touching process calls — bean `m8gz`), and a
  // lookup that only knew the parent would find nothing and perform nothing
  // — silently, which is the worst way for a work-plan write to stop.
  // `instanceCompleted` stays the PARENT's status on purpose: a bean is
  // resolved when the whole process finished, not when one phase did.
  const authz = lastVerdict(next, node);
  const stepNode = findInModel(model, node)?.model.nodes.get(node);
  const op = stepNode?.workPlanOp;
  // The deployment chooses the Tool (Q-BSD-2 A); unset, the git branch. The
  // step is already recorded, so a deployment naming a store this toolset
  // lacks is REPORTED as the work plan left untouched, never thrown past.
  let chosen: ReturnType<typeof workPlanStoreFor> | { refused: string } | undefined;
  if (op) {
    try {
      chosen = workPlanStoreFor(root, opts?.env ?? process.env);
    } catch (e) {
      chosen = { refused: e instanceof Error ? e.message : String(e) };
    }
  }
  const plan = !op || !chosen
    ? undefined
    : "refused" in chosen
      ? { summary: `work plan not touched: ${chosen.refused}` }
      : applyWorkPlanOp(root, next.bean, op, {
          note,
          store: chosen.store,
          claimIfNotStarted: stepNode?.worksBean === true,
          // `resolve` also fires when only archive steps are left, so a
          // diagram can end in one (`onlyArchiveLeft`). `archive` itself
          // still needs the instance to have completed.
          instanceCompleted: op === "resolve" ? onlyArchiveLeft(model, next) : next.status === "completed",
        });

  // Work context (§4.13): in a process that no longer draws the work plan,
  // the engine keeps what an `op="note"` step and Process_BeanClose kept.
  // A step that still carries its own op was handled just above.
  const contextKept: string[] = [];
  if (!drawsWorkPlan(model)) {
    const stepName = stepNode?.name || node;
    const meta = { process: model.id, instance: next.id, node, by: actor ?? principal.account ?? "workflow" };
    // A step drawn writing the memory store keeps the agent's note as where
    // the work stands (§4.14): the record an agent leaves before it stops.
    if (stepNode?.writes.includes(MEMORY_STORE) && note) {
      const k = keepContext(root, opts, (t) => record(t, next.bean, { ...meta, kind: "checkpoint" }, note));
      if (k) contextKept.push(k);
    }
    if (!op && stepNode?.kind === "activity") {
      const said = [outcome ? `→ ${outcome}` : "", note ?? ""].filter(Boolean).join(" ");
      const k = keepContext(root, opts, (t) => record(t, next.bean, { ...meta, kind: "step-done" }, `${stepName} done${said ? ` ${said}` : ""}`));
      if (k) contextKept.push(k);
    }
    if (next.status === "completed") {
      const k = keepContext(root, opts, (t) => closeOut(t, next.bean, meta, `${model.name || model.id} completed`));
      if (k) contextKept.push(k);
    }
  }

  // `task-end` for the step just recorded. The EVENT is task-end even
  // when the instance runs on: the unit an agent starts and ends is the
  // step, and waiting for the whole process would lose every intermediate
  // one — which is most of what a log is read for. The instance's own
  // status rides along in the detail so the two are distinguishable.
  const log = writeLogEntry(
    root,
    {
      event: "task-end",
      summary: `completed ${node} in ${model.id}`,
      detail:
        `instance ${next.id} is now ${next.status}` +
        (note ? ` — ${note}` : "") +
        (authz ? ` — ${describeVerdict(authz)}` : ""),
      process: model.id,
      task: node,
      role: findInModel(model, node)?.model.nodes.get(node)?.lane,
      bean: next.bean,
      session: next.id,
    },
    model.logCapture,
  );
  const r = roles();
  return {
    text:
      describe(model, next, r) +
      (authz ? `\n\n  authorization: ${describeVerdict(authz)}` : "") +
      (plan ? `\n\n  work plan: ${plan.summary}` : "") +
      contextKept.map((k) => `\n  ${k}`).join("") +
      `\n  ${describeCapture(log)}`,
    result: {
      position: position(model, next, r),
      ...(authz ? { authorization: authz } : {}),
      ...(plan ? { workPlan: plan.summary } : {}),
    },
  };
}

export function registerWorkflowTools(server: McpServer, repoRoot: string, opts?: WorkflowToolEnv): void {
  const root = resolve(repoRoot);

  let rolesCache: { graph: RoleGraph | undefined } | undefined;
  const roles = (): RoleGraph | undefined => {
    if (!rolesCache) rolesCache = { graph: resolveWorkflowRoles(root) };
    return rolesCache.graph;
  };
  const callOpts: WorkflowToolEnv = { ...opts, roles: opts?.roles ?? roles };

  server.tool(
    "workflow_list",
    "List the BPMN processes this folio defines, across every directory it declares as holding its knowledge graph, and any " +
      "instances currently open. Use before workflow_start to see what exists.",
    {},
    async () => answer(await workflowListAnswer(root)),
  );

  server.tool(
    "workflow_start",
    "Begin a process instance for a subject (a block label, a release, a bean id). " +
      "Idempotent: an instance already open for the same process and subject is " +
      "returned rather than duplicated. Returns what is enabled first.",
    {
      process: z.string().describe("File stem, e.g. `editing-hci-validation`, or the bpmn:process id"),
      subject: z.string().describe("What this run is about — a block label, a release name"),
      bean: z.string().optional().describe("Bean id this work is tracked under"),
      plan: z
        .string()
        .optional()
        .describe("Work plan this run is part of: the id of an epic or milestone whose `process:` tag names this process. Optional; not every process needs a plan"),
    },
    async (args) => answer(await workflowStartAnswer(root, args, callOpts)),
  );

  server.tool(
    "workflow_next",
    "What is enabled RIGHT NOW in an instance — the activities that may be worked, " +
      "with the lane (role) that performs each and the skill that implements it, plus " +
      "any decision waiting on an outcome. Derived from the diagram: a step not listed " +
      "here has not been reached yet. A call activity is entered automatically, so what " +
      "is reported is the leaf step, with the phases it sits inside shown as `inside:`.",
    { instance: z.string().describe("Instance id, from workflow_start or workflow_list") },
    async (args) => answer(await workflowNextAnswer(root, args, callOpts)),
  );

  server.tool(
    "workflow_gate",
    "May a step be performed right now? Ask before doing work a strict process " +
      "governs. The content-agnostic processes (editing, publication, lifecycle) " +
      "enforce: a step that is not enabled is refused unless a content package " +
      "declares a relaxation for it in skills/<package>/workflow-policy.json. The " +
      "per-content-type processes are advisory and always allow.",
    {
      instance: z.string(),
      activity: z.string().describe("Node id, e.g. `Task_Commit`"),
      actor: z.string().optional().describe("Who you say would perform it. Recorded only: strict mode authorizes the principal GitHub vouches for"),
      target: z.string().optional().describe("The content it would act on: a block id, path or bean id"),
    },
    async (args) => answer(await workflowGateAnswer(root, args, callOpts)),
  );

  server.tool(
    "workflow_complete",
    "Record that an enabled step is done, or answer a decision, and advance the " +
      "process. Refuses a step that is not currently enabled — that refusal is the " +
      "point: it is what keeps work from being claimed out of order. A step inside " +
      "a subprocess is named by its own id, exactly as workflow_next reported it; " +
      "the call activity itself is not completable, because a phase is done when " +
      "its steps are.",
    {
      instance: z.string(),
      node: z.string().describe("Node id from workflow_next, e.g. `Task_DraftEdit`"),
      outcome: z
        .string()
        .optional()
        .describe("For a decision a person makes — one of the outcomes workflow_next listed"),
      facts: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          "For a decision workflow_next reported as `computed by <table>`: the values " +
            "it reads, e.g. { failCritical: 0, failMajor: 2 } from qa_sweep totals. " +
            "The table returns the branch — do not pass `outcome` for these.",
        ),
      actor: z
        .string()
        .optional()
        .describe(
          "Who you say did it, written to the history. Authorization is decided on the principal " +
            "GitHub vouches for (owner or collaborator), in strict mode, before the step is recorded",
        ),
      target: z.string().optional().describe("The content the step acted on: a block id, path or bean id"),
      note: z.string().optional().describe("What happened, for the instance history"),
      activities: z
        .array(z.unknown())
        .optional()
        .describe(
          "PROV-O activities a Tool returned while doing this step, verbatim (e.g. skill_update's " +
            "`activity`). Kept on the step's history entry; each must name this step as its plan",
        ),
    },
    async (args) => answer(await workflowCompleteAnswer(root, args, callOpts)),
  );
}
