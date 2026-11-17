/**
 * The deployment resolver (bean `v3zw`): who may run a task, with which Tool,
 * and the tasks no placement can run, reported and never thrown.
 */
import { describe, expect, test } from "bun:test";

import type { DeploymentDescription } from "./deployment-description";
import { resolveDeployment, type ResolverActor, type ResolverTask, type ResolverTool } from "./deployment-resolver";

const actors: ResolverActor[] = [
  { id: "claude", kind: "agent", roles: ["authoring-agent"] },
  { id: "owner", kind: "person", roles: ["owner"] },
  { id: "attestation-service", kind: "system", roles: ["attestation-service"], reach: "internet" },
];

const tools: ResolverTool[] = [
  { id: "github-pr-create", satisfies: ["open-change"], requires: { network: true } },
  { id: "gitlab-mr-create", satisfies: ["open-change"], requires: { network: true } },
  { id: "git-format-patch", satisfies: ["open-change"] },
  { id: "api-sign", satisfies: ["sign"], requires: { network: true } },
  { id: "lean-build", satisfies: ["prove"], requires: { runtime: ["lean"] } },
];

function deployment(network: "internet" | "air-gapped" | undefined, placements: DeploymentDescription["placements"]): DeploymentDescription {
  return { id: "d", topology: network ? { network } : {}, modes: [], placements, liveData: "artefacts-only" };
}

describe("resolveDeployment", () => {
  test("a connected agent may open a change with any of three Tools", () => {
    const d = deployment("internet", [{ actor: "claude", reach: "internet" }]);
    const task: ResolverTask = { process: "p", task: "open", role: "authoring-agent", skills: ["open-change"] };
    const r = resolveDeployment(d, actors, [task], tools);
    expect(r.unrunnable).toEqual([]);
    expect(r.tasks[0].candidates[0].skills[0].tools.map((t) => t.fit)).toEqual(["works", "works", "works"]);
  });

  test("unknown reach does not satisfy a network Tool, but the offline Tool still works", () => {
    const d = deployment("internet", [{ actor: "claude" }]);
    const task: ResolverTask = { process: "p", task: "open", role: "authoring-agent", skills: ["open-change"] };
    const c = resolveDeployment(d, actors, [task], tools).tasks[0].candidates[0];
    expect(c.reach).toBe("unknown");
    expect(c.skills[0].tools.map((t) => [t.tool, t.fit])).toEqual([
      ["github-pr-create", "needs-network"],
      ["gitlab-mr-create", "needs-network"],
      ["git-format-patch", "works"],
    ]);
    expect(c.runnable).toBe(true);
  });

  test("an air-gapped deployment cannot sign through the API: reported, not thrown", () => {
    const d = deployment("air-gapped", [{ actor: "claude" }]);
    const task: ResolverTask = { process: "sign", task: "api", role: "authoring-agent", skills: ["sign"] };
    const r = resolveDeployment(d, actors, [task], tools);
    expect(r.unrunnable).toEqual([{ process: "sign", task: "api", why: "no Tool works for any placement that may take it: claude: sign" }]);
  });

  test("a role nobody placed may take is reported", () => {
    const d = deployment("internet", [{ actor: "claude" }]);
    const task: ResolverTask = { process: "review", task: "approve", role: "owner", kinds: ["person"] };
    expect(resolveDeployment(d, actors, [task], tools).unrunnable[0].why).toBe("no placement may take the role owner");
  });

  test("a user task is a person's, whatever role the agent holds", () => {
    const d = deployment("internet", [{ actor: "claude" }, { actor: "owner" }]);
    const task: ResolverTask = { process: "p", task: "t", kinds: ["person"] };
    expect(resolveDeployment(d, actors, [task], tools).tasks[0].candidates.map((c) => c.actor)).toEqual(["owner"]);
  });

  test("a role inherited through the role graph counts", () => {
    const d = deployment("internet", [{ actor: "claude" }]);
    const task: ResolverTask = { process: "p", task: "t", role: "contributor" };
    const isA = (a: string, b: string) => a === "authoring-agent" && b === "contributor";
    expect(resolveDeployment(d, actors, [task], tools, isA).unrunnable).toEqual([]);
    expect(resolveDeployment(d, actors, [task], tools).unrunnable).toHaveLength(1);
  });

  test("an OS or runtime requirement is could-not-determine, never works", () => {
    const d = deployment("internet", [{ actor: "claude", reach: "internet" }]);
    const task: ResolverTask = { process: "p", task: "prove", role: "authoring-agent", skills: ["prove"] };
    const r = resolveDeployment(d, actors, [task], tools);
    expect(r.tasks[0].candidates[0].skills[0].tools[0].fit).toBe("could-not-determine");
    // Neither runnable nor unrunnable: reported apart, never counted as either.
    expect(r.unrunnable).toEqual([]);
    expect(r.undetermined).toEqual([{ process: "p", task: "prove", why: "could not determine: claude: prove (lean-build)" }]);
  });

  test("a skill no Tool satisfies is judgement and holds nothing up", () => {
    const d = deployment("air-gapped", [{ actor: "claude" }]);
    const task: ResolverTask = { process: "p", task: "review", role: "authoring-agent", skills: ["content-review"] };
    const r = resolveDeployment(d, actors, [task], tools);
    expect(r.unrunnable).toEqual([]);
    expect(r.tasks[0].candidates[0].judgement).toEqual(["content-review"]);
    expect(r.tasks[0].candidates[0].skills).toEqual([]);
  });

  test("one actor placed twice is judged per placement", () => {
    const d = deployment("internet", [{ actor: "claude", host: "claude-code", reach: "internet" }, { actor: "claude", host: "antigravity", reach: "air-gapped" }]);
    const task: ResolverTask = { process: "sign", task: "api", role: "authoring-agent", skills: ["sign"] };
    const c = resolveDeployment(d, actors, [task], tools).tasks[0].candidates;
    expect(c.map((x) => [x.host, x.runnable])).toEqual([["claude-code", true], ["antigravity", false]]);
  });
});
