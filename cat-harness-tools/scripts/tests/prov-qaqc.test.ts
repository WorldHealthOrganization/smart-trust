/**
 * The PROV-O QA/QC report: the agentic engine's after-check (issue #1180,
 * step 5). A workflow history becomes `prov:Activity` records, and the same
 * `authorizeTask` the deterministic engine runs before a task is re-run after
 * it. Nothing is invented: an entry with no actor or no role gets a finding,
 * never a made-up agent or role.
 *
 * The tests of this file that read the whole checkout (reads the root-declared
 * `beans/workflows/` instances) live in `test/prov-qaqc-checkout.test.ts`
 * (bean `7zz1`): standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  outputs,
  processStem,
  reportInstance,
  stableJson,
  staleness,
  type Report,
} from "../prov-qaqc.js";
import { roleGraphFor, workflowFile } from "../known-skills.js";
import { ProvActivitySchema } from "../../schemas/content/prov.js";
import { actionGraph, OdrlPolicySchema, type OdrlPolicy } from "../../schemas/content/odrl.js";
import { readPermissions, type LoadedActor } from "../../schemas/process/role-graph.js";
import type { AccessContext } from "../../src/core/access.js";
import type { HistoryEntry } from "../../src/workflow/instance.js";
import { loadProcessModel } from "../../src/workflow/process-model.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { harnessRel } from "../lib/harness-layout.ts";

const ROOT = join(HARNESS_ROOT);
// declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
const SOURCE = `cat-harness/${harnessRel("sdlc/processes/code-change-review.bpmn")}`;
const MODEL = await loadProcessModel(workflowFile(ROOT, "code-change-review.bpmn"));
const GRAPH = roleGraphFor(ROOT);

function ctxWith(permission: unknown[], prohibition: unknown[] = []): AccessContext {
  const p: OdrlPolicy = OdrlPolicySchema.parse({
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "Set",
    uid: "urn:test",
    profile: "urn:folio-odrl",
    permission,
    prohibition,
  });
  const actor = (id: string, roles: string[]) =>
    [id, { id, title: id, kind: "agent", roles, path: `${id}.json`, looksLikeRole: false } as LoadedActor] as const;
  return {
    policies: new Map([[p.uid, p]]),
    graph: actionGraph(readPermissions(join(ROOT, "skills"))!.permissions),
    actors: new Map([actor("agent", ["authoring-agent"]), actor("rev", ["code-reviewer"])]),
  };
}

const GRANT = [{ assignee: "agent", action: "perform-task" }];
const run = (history: HistoryEntry[], ctx: AccessContext, graph = GRAPH) =>
  reportInstance("t", { source: SOURCE, history }, MODEL, graph, ctx);
const at = "2026-09-24T10:00:00.000Z";
const kinds = (r: ReturnType<typeof run>) => r.findings.map((f) => f.kind).sort();

describe("prov-qaqc: the record", () => {
  test("an activity maps to a valid prov:Activity with agent, lane role, plan and policy", () => {
    const r = run([{ at, node: "Task_ClaimBean", actor: "agent" }], ctxWith(GRANT));
    expect(r.findings).toEqual([]);
    expect(r.activities).toHaveLength(1);
    const a = r.activities[0]!;
    expect(ProvActivitySchema.safeParse(a).success).toBe(true);
    expect(a).toEqual({
      "@type": "prov:Activity",
      "@id": "t#0",
      "prov:startedAtTime": at,
      "prov:qualifiedAssociation": {
        "prov:agent": "agent",
        "prov:hadRole": "authoring-agent",
        "prov:hadPlan": "code-change-review#Task_ClaimBean",
      },
      "cat-harness:underPolicy": "urn:test",
    });
  });

  test("start and end events are not activities, and are skipped", () => {
    const r = run([{ at, node: "Start_Change", actor: "agent" }], ctxWith(GRANT));
    expect(r.checked).toBe(0);
    expect(r.activities).toEqual([]);
  });

  test("the plan's stem is the file name, lower-cased, so it satisfies PLAN_REF", () => {
    expect(processStem("a/b/Code-Change-Review.bpmn")).toBe("code-change-review");
  });

  test("several policies are all named, as a JSON-LD array", () => {
    const ctx = ctxWith(GRANT);
    const second = { ...ctx.policies.get("urn:test")!, uid: "urn:another", permission: [] };
    const two: AccessContext = { ...ctx, policies: new Map([...ctx.policies, ["urn:another", second]]) };
    const r = run([{ at, node: "Task_ClaimBean", actor: "agent" }], two);
    expect(r.activities[0]!["cat-harness:underPolicy"]).toEqual(["urn:another", "urn:test"]);
  });
});

describe("prov-qaqc: findings", () => {
  test("no matching permission is `unknown`, and is a finding, never a permit", () => {
    const r = run([{ at, node: "Task_ClaimBean", actor: "agent" }], ctxWith([]));
    expect(kinds(r)).toEqual(["unknown"]);
  });

  test("a prohibition is a `deny` finding", () => {
    const r = run([{ at, node: "Task_ClaimBean", actor: "agent" }], ctxWith(GRANT, GRANT));
    expect(kinds(r)).toEqual(["deny"]);
  });

  test("an actor not eligible for the lane's role is a finding", () => {
    const r = run([{ at, node: "Task_ClaimBean", actor: "rev" }], ctxWith([{ assignee: "rev", action: "perform-task" }]));
    expect(kinds(r)).toEqual(["not-eligible"]);
    expect(r.findings[0]!.detail).toContain("not as authoring-agent");
  });

  test("an undeclared actor is a finding", () => {
    const r = run([{ at, node: "Task_ClaimBean", actor: "ghost" }], ctxWith(GRANT));
    expect(kinds(r)).toEqual(["undeclared-actor", "unknown"]);
  });

  test("a missing actor is a finding, and NO activity is emitted rather than an invented agent", () => {
    const r = run([{ at, node: "Task_ClaimBean" }], ctxWith(GRANT));
    expect(kinds(r)).toContain("no-actor");
    expect(r.activities).toEqual([]);
    // Not attempted and rejected by the schema either: never built at all.
    expect(r.invalid).toEqual([]);
    expect(r.checked).toBe(1);
  });

  test("a lane that binds no role is a finding, and NO activity is emitted rather than an invented role", () => {
    // A role graph that declares nothing: the lane's `<folio:role ref>` dangles.
    const r = run([{ at, node: "Task_ClaimBean", actor: "agent" }], ctxWith(GRANT), { name: "empty", roles: [] });
    expect(kinds(r)).toContain("no-role");
    expect(r.findings.find((f) => f.kind === "no-role")!.detail).toContain('names role "authoring-agent", which is not declared');
    expect(r.activities).toEqual([]);
    expect(r.invalid).toEqual([]);
  });

  test("a recorded authz verdict that disagrees with the recomputed one is a finding", () => {
    const recorded = {
      allowed: true,
      mode: "advisory" as const,
      authenticatedBy: "asserted" as const,
      actor: "agent",
      role: "authoring-agent",
      assignment: "eligible" as const,
      authorized: "permit" as const,
      findings: [],
    };
    const agree = run([{ at, node: "Task_ClaimBean", actor: "agent", authz: recorded }], ctxWith(GRANT));
    expect(agree.findings).toEqual([]);
    const differ = run([{ at, node: "Task_ClaimBean", actor: "agent", authz: recorded }], ctxWith([]));
    expect(kinds(differ)).toEqual(["authz-disagrees", "unknown"]);
    expect(differ.findings.find((f) => f.kind === "authz-disagrees")!.detail).toContain("policy permit → unknown");
  });

  test("a node the model does not have is a finding", () => {
    const r = run([{ at, node: "Task_Gone", actor: "agent" }], ctxWith(GRANT));
    expect(kinds(r)).toEqual(["node-not-in-model"]);
  });
});

describe("prov-qaqc: outputs", () => {
  const report = (): Report => ({
    instances: new Map([["t", [{ ...run([{ at, node: "Task_ClaimBean", actor: "agent" }], ctxWith([])) }]]]),
    policies: ["urn:test"],
    invalid: [],
  });

  test("JSON is written with sorted keys", () => {
    expect(stableJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}\n');
  });

  test("--check: current outputs pass; an edited output is stale; a leftover log is an orphan", () => {
    const dir = mkdtempSync(join(tmpdir(), "prov-qaqc-"));
    const site = { page: join(dir, "prov-qaqc", "index.md"), assets: join(dir, "assets", "prov") };
    const files = outputs(report(), site);
    mkdirSync(join(dir, "prov-qaqc"), { recursive: true });
    mkdirSync(site.assets, { recursive: true });
    for (const [p, s] of files) writeFileSync(p, s);
    expect(staleness(files, site.assets)).toEqual({ stale: [], orphans: [] });

    const log = join(site.assets, "t.prov.jsonld");
    // PROV-JSONLD since 2026-10-01 (beans jcet, 9y9j): the plan is a LINK at
    // the process's release address, under the context's `plan` term.
    expect(readFileSync(log, "utf-8")).toContain(
      // declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
      `"plan": "https://litlfred.github.io/cat-harness/v0/${harnessRel("sdlc/processes")}/code-change-review/Task_ClaimBean"`,
    );
    writeFileSync(log, "{}\n");
    expect(staleness(files, site.assets).stale).toEqual([log]);

    writeFileSync(join(site.assets, "gone.prov.jsonld"), "{}\n");
    expect(staleness(files, site.assets).orphans).toEqual([join(site.assets, "gone.prov.jsonld")]);
  });

  test("the page states the report is advisory and gives totals by finding", () => {
    const page = outputs(report(), { page: "/p", assets: "/a" }).get("/p")!;
    expect(page).toContain("**Advisory.**");
    expect(page).toContain("| `unknown` | 1 |");
  });
});
