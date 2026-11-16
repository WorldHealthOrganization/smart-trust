/**
 * The example deployment descriptions (bean `jog4`) in
 * `scenarios/deployments/`: each parses, places only declared actors, and
 * names no refused topology pair. Today's deployment comes first because it is
 * real; the others are the #363 scenarios.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { topologyConflicts } from "./kg/cat-harness";
import { DEPLOYMENTS_DIRNAME, deploymentProblems, placementReach, readDeployments } from "./process/deployment-description";
import { readActors } from "./process/role-graph";

import { requireHarnessRoot } from "./harness-root.ts";
const scenarios = join(requireHarnessRoot(), "scenarios");
const deployments = readDeployments(join(scenarios, DEPLOYMENTS_DIRNAME));
const actors = readActors(join(scenarios, "actors"));

describe("the example deployment descriptions", () => {
  test("the six #363 scenarios are all there", () => {
    expect(deployments.map((d) => d.id).sort()).toEqual(
      ["developer", "private-github", "self-sovereign", "sovereign-cloud", "test-swarm", "today"],
    );
  });

  test("every one is well formed against the declared actors", () => {
    expect(deploymentProblems(deployments, actors)).toEqual([]);
  });

  test.each(deployments.map((d) => [d.id, d] as const))("%s: no refused topology pair", (_id, d) => {
    expect(topologyConflicts(d.topology, d.publicationHost)).toEqual([]);
  });

  test("today places one actor twice: cloud sessions and the owner's workstation", () => {
    const today = deployments.find((d) => d.id === "today")!;
    expect(today.placements.filter((p) => p.actor === "claude").map((p) => p.host)).toEqual([
      "claude-code",
      "antigravity",
    ]);
  });

  test("only self-sovereign may hold credentials", () => {
    expect(deployments.filter((d) => d.liveData === "may-hold-credentials").map((d) => d.id)).toEqual([
      "self-sovereign",
    ]);
  });

  test("the API signer cannot be placed in the air-gapped example", () => {
    const self = deployments.find((d) => d.id === "self-sovereign")!;
    const withSigner = { ...self, placements: [...self.placements, { actor: "attestation-service" }] };
    expect(deploymentProblems([withSigner], actors).map((p) => p.kind)).toEqual(["exceeds-deployment"]);
  });

  test("the swarm's undeclared reach stays unknown", () => {
    const swarm = deployments.find((d) => d.id === "test-swarm")!;
    expect(swarm.placements.map((p) => placementReach(swarm, p))).toEqual(swarm.placements.map(() => "unknown"));
  });
});
