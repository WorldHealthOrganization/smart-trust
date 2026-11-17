/**
 * Every BPMN task execution checks authentication, role assignment, ODRL
 * permission and content access first — and the HTTP routes ask the same
 * policies. Issue #1207.
 *
 * Pins the owner's four decisions of 2026-09-23: advisory rollout (deny and a
 * role mismatch refuse, `unknown` is recorded, never read as permit), one
 * action for every task (`perform-task`), authentication as the executor's
 * duty with GitHub as today's authenticator, and `rbac.ts` on ODRL.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { loadProcessModel } from "../../src/workflow/process-model.js";
import { complete, enabled, startInstance } from "../../src/workflow/instance.js";
import { authorizeTask } from "../../src/workflow/authorize.js";
import { loadAccessContext, principalFromEnv, type AccessContext } from "../../src/core/access.js";
import { allows, principalOf } from "../../src/core/rbac.js";
import { workflowFile } from "../known-skills.js";
import { actionGraph, OdrlPolicySchema, type OdrlPolicy } from "../../schemas/content/odrl.js";
import { readPermissions, type LoadedActor } from "../../schemas/process/role-graph.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

// The access context, permissions and diagrams are the HARNESS's; this test moved up with the code (70lx).
const ROOT = HARNESS_ROOT;
const REAL = loadAccessContext(ROOT);

function ctxWith(permission: unknown[], prohibition: unknown[] = []): AccessContext {
  const p: OdrlPolicy = OdrlPolicySchema.parse({
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "Set",
    uid: "urn:test",
    profile: "urn:folio-odrl",
    permission,
    prohibition,
  });
  const actors = new Map<string, LoadedActor>([
    ["ed", { id: "ed", title: "Ed", kind: "person", roles: ["editor"], path: "ed.json", looksLikeRole: false } as LoadedActor],
    ["any", { id: "any", title: "Any", kind: "agent", roles: [], path: "any.json", looksLikeRole: false } as LoadedActor],
  ]);
  return {
    policies: new Map([[p.uid, p]]),
    graph: actionGraph(readPermissions(join(ROOT, "skills"))!.permissions),
    actors,
  };
}
const asserted = (actor: string | null) => principalFromEnv(actor ?? undefined, {});
const req = { process: "Process_X", task: "Task_Y", role: "editor" };

describe("authorizeTask: the four checks", () => {
  test("a scoped perform-task grant to an eligible actor permits cleanly apart from the authN finding", () => {
    const ctx = ctxWith([
      { assignee: "ed", action: "perform-task", constraint: [{ leftOperand: "cat-harness:role", operator: "odrl:eq", rightOperand: "editor" }] },
    ]);
    const v = authorizeTask(ctx, { ...req, principal: asserted("ed") });
    expect(v).toMatchObject({ allowed: true, assignment: "eligible", authorized: "permit" });
    expect(v.findings).toEqual(['actor "ed" is asserted, not authenticated']);
  });

  test("a role the actor may not take refuses, whatever the policy says", () => {
    const ctx = ctxWith([{ assignee: "ed", action: "perform-task" }]);
    const v = authorizeTask(ctx, { ...req, role: "publisher", principal: asserted("ed") });
    expect(v.allowed).toBe(false);
    expect(v.assignment).toBe("not-eligible");
  });

  test("a prohibition refuses", () => {
    const ctx = ctxWith([], [{ assignee: "ed", action: "perform-task" }]);
    expect(authorizeTask(ctx, { ...req, principal: asserted("ed") })).toMatchObject({ allowed: false, authorized: "deny" });
  });

  test("advisory: unknown is allowed and RECORDED as unknown, never as permit", () => {
    const v = authorizeTask(ctxWith([]), { ...req, principal: asserted("ed") });
    expect(v).toMatchObject({ allowed: true, authorized: "unknown" });
    expect(v.findings.some((f) => f.includes("no policy grants perform-task"))).toBe(true);
  });

  test("strict: unknown, an asserted identity, or nobody refuses", () => {
    const ctx = ctxWith([{ assignee: "ed", action: "perform-task" }]);
    expect(authorizeTask(ctxWith([]), { ...req, principal: asserted("ed") }, "strict").allowed).toBe(false);
    expect(authorizeTask(ctx, { ...req, principal: asserted("ed") }, "strict").allowed).toBe(false);
    expect(authorizeTask(ctx, { ...req, principal: asserted(null) }, "strict").allowed).toBe(false);
    const gh = principalFromEnv("ed", { GITHUB_ACTIONS: "true", GITHUB_ACTOR: "someone" });
    expect(authorizeTask(ctx, { ...req, principal: gh }, "strict").allowed).toBe(true);
  });

  test("content access: a target-scoped prohibition refuses that content only", () => {
    const ctx = ctxWith([{ assignee: "ed", action: "perform-task" }], [{ assignee: "ed", action: "perform-task", target: "block-7" }]);
    expect(authorizeTask(ctx, { ...req, target: "block-7", principal: asserted("ed") })).toMatchObject({ allowed: false, access: "deny" });
    expect(authorizeTask(ctx, { ...req, target: "block-8", principal: asserted("ed") })).toMatchObject({ allowed: true, access: "permit" });
  });

  test("an undeclared actor is a finding, and an empty roles list is unconstrained", () => {
    expect(authorizeTask(ctxWith([]), { ...req, principal: asserted("ghost") }).assignment).toBe("unknown-actor");
    expect(authorizeTask(ctxWith([]), { ...req, principal: asserted("any") }).assignment).toBe("unconstrained");
  });
});

describe("authentication is the executor's, and GitHub is today's authenticator", () => {
  test("a GitHub Actions run is authenticated by GitHub; a typed actor elsewhere is asserted", () => {
    expect(principalFromEnv("author", { GITHUB_ACTIONS: "true", GITHUB_ACTOR: "octocat" })).toEqual({
      actor: "author",
      authenticatedBy: "github",
      account: "octocat",
    });
    expect(principalFromEnv("author", { GITHUB_ACTOR: "octocat" }).authenticatedBy).toBe("asserted");
    expect(principalFromEnv(undefined, {}).authenticatedBy).toBe("none");
  });
});

describe("the interpreter runs the check before recording anything", () => {
  test("a role mismatch refuses and leaves the instance untouched", async () => {
    const model = await loadProcessModel(workflowFile(ROOT, "getting-started.bpmn"));
    const state = startInstance(model, { id: "t", subject: "s" });
    const step = model.nodes.get(enabled(model, state).find((e) => e.kind === "activity" && model.nodes.get(e.node)?.roleRef)!.node)!;
    const outsider = [...REAL.actors.values()].find((a) => (a.roles?.length ?? 0) > 0 && !a.roles!.includes(step.roleRef!))!;
    const before = JSON.stringify(state);
    expect(() =>
      complete(model, state, step.id, { actor: outsider.id, authz: { ctx: REAL, principal: asserted(outsider.id) } }),
    ).toThrow(/REFUSED/);
    expect(JSON.stringify(state)).toBe(before);
  });

  test("an allowed step carries its verdict in the history", async () => {
    const model = await loadProcessModel(workflowFile(ROOT, "getting-started.bpmn"));
    const state = startInstance(model, { id: "t", subject: "s" });
    const step = model.nodes.get(enabled(model, state).find((e) => e.kind === "activity" && model.nodes.get(e.node)?.roleRef)!.node)!;
    const insider = [...REAL.actors.values()].find((a) => a.roles?.includes(step.roleRef!))!;
    const next = complete(model, state, step.id, { actor: insider.id, authz: { ctx: REAL, principal: asserted(insider.id) } });
    const entry = next.history.at(-1)!;
    expect(entry.node).toBe(step.id);
    expect(entry.authz).toMatchObject({ allowed: true, assignment: "eligible", actor: insider.id });
  });
});

describe("rbac.ts asks ODRL, and reproduces what the tier ladder allowed", () => {
  const request = (headers: Record<string, string>) => new Request("http://x/", { headers });
  const GATED = ["content-authoring", "review-comments", "adjudication"];

  test("the gateway policy and actors are loaded (vacuity guard)", () => {
    expect([...REAL.policies.keys()].some((k) => k.endsWith("/http-gateway"))).toBe(true);
    for (const id of ["viewer", "collaborator", "owner"]) expect(REAL.actors.has(id)).toBe(true);
  });

  test("collaborator and owner may do every gated action; viewer and nobody may do none", () => {
    for (const action of GATED) {
      expect(allows(request({ "x-user-role": "collaborator" }), action, undefined, REAL)).toBe(true);
      expect(allows(request({ "x-user-role": "owner" }), action, undefined, REAL)).toBe(true);
      expect(allows(request({ "x-user-role": "viewer" }), action, undefined, REAL)).toBe(false);
      expect(allows(request({}), action, undefined, REAL)).toBe(false);
    }
  });

  test("nobody may still visualize and render — the owner's floor", () => {
    expect(allows(request({}), "visualize", undefined, REAL)).toBe(true);
    expect(allows(request({}), "render", undefined, REAL)).toBe(true);
  });

  test("a principal without gateway headers is unauthenticated", () => {
    expect(principalOf(request({}))).toMatchObject({ actor: null, authenticatedBy: "none", tier: "viewer" });
    expect(principalOf(request({ "x-user-role": "collaborator" }))).toMatchObject({
      actor: "collaborator",
      authenticatedBy: "http-gateway",
    });
  });
});
