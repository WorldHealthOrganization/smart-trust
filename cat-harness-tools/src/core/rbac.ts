/**
 * Folio Assistant — access control for the HTTP routes, decided by ODRL.
 *
 * Until issue #1207 (2026-09-23) this was a three-rung ladder, viewer <
 * collaborator < owner, with every route hard-coding its own minimum rung. That
 * was a SECOND permission system beside the ODRL policies (#1180), with no
 * shared vocabulary: a route asked "collaborator or higher?" where a policy
 * asks "may this actor do `content-authoring`?". Owner: *"Replace with ODRL
 * now."*
 *
 * Now a route names the ACTION it performs and asks the same evaluator the BPMN
 * executor asks. The gateway's three sessions are three declared actors
 * (`viewer`, `collaborator`, `owner` in `cat-harness/scenarios/actors/`), and what each
 * may do is `cat-harness/policies/http-gateway.jsonld` — a policy file, where a
 * reviewer can see it, not a rung compared in code.
 *
 * Authentication is unchanged and is still the auth-gateway's: it injects
 * `X-User-Role`, `X-User-Email`, `X-User-Name`, and may inject `X-User-Actor`
 * once it maps a login to a declared actor. See
 * `sdlc/skills/sdlc-core/deployment-auth.md` and `task-authorization.md`.
 *
 * @module folio-assistant/core/rbac
 */

import type { UserRole } from "../types.js";
import { ROLE_LEVELS } from "../types.js";
import { decide, type Decision, type RequestScope } from "../../schemas/content/odrl.js";
import { accessContext, type AccessContext, type Principal } from "./access.js";

export interface HttpPrincipal extends Principal {
  /** The gateway session's tier, kept for display and for the chat prompt. */
  tier: UserRole;
  name: string;
  email: string;
}

/** The gateway tier the request carries. No header is a `viewer`, as before. */
export function getUserRole(req: Request): UserRole {
  const role = req.headers.get("x-user-role") as UserRole | null;
  return role && role in ROLE_LEVELS ? role : "viewer";
}

export function getUserEmail(req: Request): string {
  return req.headers.get("x-user-email") || "anonymous";
}

export function getUserName(req: Request): string {
  return req.headers.get("x-user-name") || "anonymous";
}

/**
 * Who is asking. An explicit `X-User-Actor` wins; otherwise the gateway tier
 * IS the actor. No gateway header at all is nobody, which ODRL reads as
 * `cat-harness:anyone` — visualize and render, and nothing else.
 */
export function principalOf(req: Request): HttpPrincipal {
  const fromGateway = req.headers.has("x-user-role") || req.headers.has("x-user-actor");
  const tier = getUserRole(req);
  const actor = req.headers.get("x-user-actor") || (fromGateway ? tier : null);
  return {
    actor,
    authenticatedBy: fromGateway ? "http-gateway" : "none",
    account: req.headers.get("x-user-email") || undefined,
    tier,
    name: getUserName(req),
    email: getUserEmail(req),
  };
}

/** What the policies say about this request performing `action`. Three answers. */
export function authorize(
  req: Request,
  action: string,
  scope?: RequestScope,
  ctx: AccessContext = accessContext(),
): Decision {
  const { actor } = principalOf(req);
  return decide({ actor, action, scope }, ctx.policies, ctx.graph);
}

/**
 * May this request perform `action`? Only `permit` is yes. At the HTTP
 * boundary `unknown` refuses, unlike the advisory BPMN check: a route is a
 * door, and a door nobody has decided about stays shut.
 */
export function allows(req: Request, action: string, scope?: RequestScope, ctx?: AccessContext): boolean {
  return authorize(req, action, scope, ctx) === "permit";
}

export function forbidden(what: string, action: string): Response {
  return Response.json(
    { error: `Forbidden: ${what} needs the "${action}" permission, which no policy grants you` },
    { status: 403 },
  );
}
