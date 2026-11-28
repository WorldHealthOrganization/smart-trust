/**
 * Deployment descriptions (bean `23a3`): the schema refuses what it must, and
 * the checks find a placement that misplaces an actor.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { REACH_UNKNOWN } from "./actor-reach";
import {
  DeploymentDescriptionSchema,
  deploymentProblems,
  placementReach,
  readDeployments,
  type ActorFacts,
  type DeploymentDescription,
} from "./deployment-description";

const actors: ActorFacts[] = [
  { id: "claude" },
  { id: "owner" },
  { id: "ci-pipeline" },
  { id: "attestation-service", reach: "internet" },
];

function today(): DeploymentDescription {
  return {
    id: "today",
    topology: { forge: "github", network: "internet", modelProvenance: "hosted" },
    publicationHost: "github-pages",
    modes: ["author", "develop", "publish"],
    placements: [
      { actor: "claude", host: "claude-code", compute: "vendor-cloud", identity: { provider: "github" } },
      { actor: "claude", host: "antigravity", compute: "workstation" },
      { actor: "ci-pipeline", host: "github-actions", credentials: { "publish-site": "GITHUB_TOKEN" } },
      { actor: "owner", host: "local" },
    ],
    liveData: "artefacts-only",
  };
}

describe("the schema", () => {
  test("today's deployment parses, with one actor placed twice", () => {
    expect(DeploymentDescriptionSchema.safeParse(today()).success).toBe(true);
  });

  test("a field nobody declared is refused, not ignored", () => {
    const d = { ...today(), region: "eu" };
    expect(DeploymentDescriptionSchema.safeParse(d).success).toBe(false);
  });

  test("liveData is required: a deployment says whether it may hold credentials", () => {
    const { liveData: _omit, ...d } = today();
    expect(DeploymentDescriptionSchema.safeParse(d).success).toBe(false);
  });

  test("a credential action outside the closed list is refused", () => {
    const d = today();
    d.placements[2] = { actor: "ci-pipeline", credentials: { "push-everything": "X" } as never };
    expect(DeploymentDescriptionSchema.safeParse(d).success).toBe(false);
  });

  test("a credential VALUE is refused on its shape", () => {
    const d = today();
    d.placements[2] = { actor: "ci-pipeline", credentials: { "publish-site": "ghp_abc/def=" } };
    expect(DeploymentDescriptionSchema.safeParse(d).success).toBe(false);
  });

  test("jurisdiction is four optional fields", () => {
    const d = {
      ...today(),
      id: "sovereign-cloud",
      jurisdiction: { publicationBase: "https://example.org/", audience: "authenticated", residency: "in-country" },
    };
    expect(DeploymentDescriptionSchema.safeParse(d).success).toBe(true);
    // All four together, each one alone, none at all — and no fifth field.
    const all = { publicationBase: "https://example.org/", audience: "authenticated", retention: "7 years", residency: "in-country" };
    expect(DeploymentDescriptionSchema.safeParse({ ...d, jurisdiction: all }).success).toBe(true);
    for (const [k, v] of Object.entries(all)) {
      expect([k, DeploymentDescriptionSchema.safeParse({ ...d, jurisdiction: { [k]: v } }).success]).toEqual([k, true]);
    }
    expect(DeploymentDescriptionSchema.safeParse({ ...d, jurisdiction: {} }).success).toBe(true);
    const { jurisdiction: _j, ...none } = d;
    expect(DeploymentDescriptionSchema.safeParse(none).success).toBe(true);
    expect(DeploymentDescriptionSchema.safeParse({ ...d, jurisdiction: { ...all, currency: "EUR" } }).success).toBe(false);
    const bad = { ...d, jurisdiction: { ...d.jurisdiction, audience: "everyone" } };
    expect(DeploymentDescriptionSchema.safeParse(bad).success).toBe(false);
  });
});

describe("deploymentProblems", () => {
  test("a well-formed description has none", () => {
    expect(deploymentProblems([today()], actors)).toEqual([]);
  });

  test("a placement never declares an actor", () => {
    const d = today();
    d.placements.push({ actor: "sovereign-bot" });
    const p = deploymentProblems([d], actors);
    expect(p.map((x) => [x.kind, x.actor])).toEqual([["unknown-actor", "sovereign-bot"]]);
  });

  test("a placement may not contradict reach the actor fixes", () => {
    const d = today();
    d.placements.push({ actor: "attestation-service", reach: "air-gapped" });
    expect(deploymentProblems([d], actors).map((x) => x.kind)).toEqual(["contradicts-actor"]);
  });

  test("a placement reaches no further than its deployment", () => {
    const d = today();
    d.topology = { ...d.topology, network: "egress-restricted" };
    d.placements = [{ actor: "claude", reach: "internet" }];
    expect(deploymentProblems([d], actors).map((x) => x.kind)).toEqual(["exceeds-deployment"]);
  });

  test("an air-gapped participant in a connected deployment is the normal case", () => {
    const d = today();
    d.placements = [{ actor: "owner", reach: "air-gapped" }];
    expect(deploymentProblems([d], actors)).toEqual([]);
  });

  test("the actor's own reach counts against the deployment too", () => {
    const d = today();
    d.topology = { ...d.topology, network: "air-gapped", modelProvenance: "open-weight-local" };
    d.placements = [{ actor: "attestation-service" }];
    expect(deploymentProblems([d], actors).map((x) => x.kind)).toEqual(["exceeds-deployment"]);
  });

  test("ids are unique and match the file name", () => {
    const a = { ...today(), path: "/x/deployments/today.json" };
    const b = { ...today(), path: "/x/deployments/other.json" };
    expect(deploymentProblems([a, b], actors).map((x) => x.kind)).toEqual(["id-not-filename", "duplicate-id"]);
  });
});

describe("placementReach is never inherited", () => {
  test("an undeclared placement in a connected deployment is unknown", () => {
    expect(placementReach(today(), { actor: "claude" })).toBe(REACH_UNKNOWN);
  });

  test("the actor's own fact is used when the placement says nothing", () => {
    expect(placementReach(today(), { actor: "attestation-service" }, actors[3])).toBe("internet");
  });

  test("an air-gapped deployment determines every placement", () => {
    const d = { ...today(), topology: { network: "air-gapped" as const } };
    expect(placementReach(d, { actor: "claude" })).toBe("air-gapped");
  });
});

describe("readDeployments", () => {
  test("reads a folder, and names the file that does not parse", () => {
    const dir = mkdtempSync(join(tmpdir(), "deployments-"));
    writeFileSync(join(dir, "today.json"), JSON.stringify(today()));
    const read = readDeployments(dir);
    expect(read.map((d) => d.id)).toEqual(["today"]);
    expect(deploymentProblems(read, actors)).toEqual([]);

    writeFileSync(join(dir, "broken.json"), JSON.stringify({ ...today(), id: "broken", liveData: "everything" }));
    expect(() => readDeployments(dir)).toThrow(/broken\.json is not a deployment description/);
  });

  test("an absent folder is no descriptions", () => {
    expect(readDeployments(join(tmpdir(), "no-such-deployments-folder"))).toEqual([]);
  });
});
