/**
 * Task authorization: the check every BPMN task execution runs first.
 *
 * Issue #1207 (child of #1180). Before an actor performs a task or answers a
 * decision, four questions, in order:
 *
 * 1. **Authenticated** — who is the actor, and how was that established?
 *    ({@link Principal.authenticatedBy}; see `core/access.ts`.)
 * 2. **Assigned** — is the actor eligible for the role the task's lane binds?
 *    (`ActorDef.roles`; empty means unconstrained.)
 * 3. **Authorized** — does an ODRL policy permit `perform-task` in this
 *    process, for this task, as this role?
 * 4. **Access** — the same, with `target` set to the content the task acts on.
 *
 * It is ONE function, generic over every process, and it lives beside the
 * interpreter rather than in any diagram: a check drawn as a task in some
 * processes is a check absent from the rest.
 *
 * ## Advisory, and what that does and does not mean
 *
 * Owner, 2026-09-23: advisory first. So:
 *
 * - `deny` from any policy **refuses**. A prohibition is a decision somebody
 *   wrote down.
 * - An actor **not eligible for the lane's role refuses**. Performing a task in
 *   a lane needs the role (`role-model.md`), whatever the policy says.
 * - `unknown` — no rule speaks — **allows, and is recorded as a finding**. It
 *   is never read as permit: the verdict says `unknown`, and `strict` mode
 *   (the option, for when the unknowns reach zero) refuses it.
 * - No actor, or an asserted one, allows in advisory mode and is recorded.
 *
 * @module folio-assistant/workflow/authorize
 */

import { decide, PERFORM_TASK, type Decision } from "../../schemas/content/odrl.js";
import type { AccessContext, AuthMethod, Principal } from "../core/access.js";

export interface TaskAuthRequest {
  principal: Principal;
  /** The process id (`ProcessModel.id`) the task belongs to. */
  process: string;
  /** The node id. */
  task: string;
  /** The role the lane binds, when the diagram declares one. */
  role?: string;
  /** The content the task acts on — a block id, a path, a bean id. */
  target?: string;
}

export type Assignment = "eligible" | "unconstrained" | "not-eligible" | "no-role" | "unknown-actor";

export interface TaskAuthVerdict {
  allowed: boolean;
  mode: "advisory" | "strict";
  authenticatedBy: AuthMethod;
  actor: string | null;
  account?: string;
  role?: string;
  assignment: Assignment;
  /** `perform-task` in this process, task and role. */
  authorized: Decision;
  /** The same with `target`; absent when the task names no content. */
  access?: Decision;
  /** Why it refused, or what an advisory pass let through. Empty on a clean permit. */
  findings: string[];
}

/** May this principal perform this task? Pure: the caller supplies the context. */
export function authorizeTask(
  ctx: AccessContext,
  req: TaskAuthRequest,
  mode: "advisory" | "strict" = "advisory",
): TaskAuthVerdict {
  const { principal } = req;
  const findings: string[] = [];
  const refusals: string[] = [];

  // 1. Authenticated.
  if (principal.authenticatedBy === "none") {
    findings.push("no actor named: the step is recorded without anyone accountable for it");
  } else if (principal.authenticatedBy === "asserted") {
    findings.push(`actor "${principal.actor}" is asserted, not authenticated`);
  }

  // 2. Assigned.
  const actor = principal.actor ? ctx.actors.get(principal.actor) : undefined;
  let assignment: Assignment;
  if (principal.actor && !actor) {
    assignment = "unknown-actor";
    findings.push(`"${principal.actor}" is not a declared actor`);
  } else if (!req.role) {
    assignment = "no-role";
  } else if (!actor) {
    assignment = "no-role";
  } else if (!actor.roles || actor.roles.length === 0) {
    assignment = "unconstrained";
  } else if (actor.roles.includes(req.role)) {
    assignment = "eligible";
  } else {
    assignment = "not-eligible";
    refusals.push(
      `${actor.id} may act as ${actor.roles.join(", ")}, not as ${req.role}, which ${req.task}'s lane binds`,
    );
  }

  // 3. Authorized. `actorRoles` is left out on purpose: step 2 already answered
  // the role question and says which way, so `permits` answers only the policy.
  const scope = {
    "cat-harness:process": req.process,
    "cat-harness:task": req.task,
    ...(req.role ? { "cat-harness:role": req.role } : {}),
  };
  const who = actor ? actor.id : null;
  const authorized = decide({ actor: who, action: PERFORM_TASK, scope }, ctx.policies, ctx.graph);
  if (authorized === "deny") refusals.push(`a policy prohibits ${PERFORM_TASK} here`);
  else if (authorized === "unknown") findings.push(`no policy grants ${PERFORM_TASK} for ${req.process}/${req.task}`);

  // 4. Access to the content.
  let access: Decision | undefined;
  if (req.target) {
    access = decide({ actor: who, action: PERFORM_TASK, scope: { ...scope, target: req.target } }, ctx.policies, ctx.graph);
    if (access === "deny") refusals.push(`a policy prohibits ${PERFORM_TASK} on ${req.target}`);
    else if (access === "unknown") findings.push(`no policy grants access to ${req.target}`);
  }

  const strictBlocks =
    mode === "strict" &&
    (principal.authenticatedBy === "none" ||
      principal.authenticatedBy === "asserted" ||
      assignment === "unknown-actor" ||
      authorized !== "permit" ||
      (access !== undefined && access !== "permit"));

  return {
    allowed: refusals.length === 0 && !strictBlocks,
    mode,
    authenticatedBy: principal.authenticatedBy,
    actor: principal.actor,
    account: principal.account,
    role: req.role,
    assignment,
    authorized,
    access,
    findings: [...refusals, ...findings],
  };
}

/** One line for a tool's output and for the instance history. */
export function describeVerdict(v: TaskAuthVerdict): string {
  const who = v.actor ?? "(nobody)";
  const head =
    `${v.allowed ? "AUTHORIZED" : "REFUSED"} (${v.mode}) — ${who} via ${v.authenticatedBy}` +
    (v.account ? ` [${v.account}]` : "") +
    (v.role ? ` as ${v.role}: ${v.assignment}` : "") +
    `; policy ${v.authorized}` +
    (v.access ? `; access ${v.access}` : "");
  return v.findings.length ? `${head}. ${v.findings.join("; ")}` : head;
}
