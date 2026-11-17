/**
 * Which Tool backs the work plan: read from the deployment description
 * (cat-harness#991, Q-BSD-2 A). Every wrong answer is a refusal with its
 * reason, never the default store.
 *
 * @module scripts/tests/sdlc/work-plan-store-select
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DeploymentDescriptionSchema } from "../../../schemas/process/deployment-description.ts";
import { MountedGitBranchStore } from "../../../src/workflow/work-plan-store-git-mount.ts";
import { DEPLOYMENT_ENV, workPlanStoreFor } from "../../../src/workflow/work-plan-store-select.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const base = {
  topology: { forge: "none", compute: "workstation", toolSurface: "cli", modelCardinality: "single", dataStores: ["none"], outwardFacing: false },
  modes: ["develop"],
  placements: [],
  liveData: "artefacts-only",
};

function deployments(...ds: Array<Record<string, unknown>>): string {
  const dir = mkdtempSync(join(tmpdir(), "wps-deploy-"));
  made.push(dir);
  mkdirSync(dir, { recursive: true });
  for (const d of ds) writeFileSync(join(dir, `${String(d.id)}.json`), JSON.stringify({ ...base, ...d }));
  return dir;
}

describe("the schema", () => {
  test("a description may name a Tool per store Role", () => {
    expect(DeploymentDescriptionSchema.safeParse({ id: "x", ...base, stores: { "work-plan": "beans-git-branch" } }).success).toBe(true);
  });

  test("and must name it by id, not by a path or a URL", () => {
    expect(DeploymentDescriptionSchema.safeParse({ id: "x", ...base, stores: { "work-plan": "https://beans.example" } }).success).toBe(false);
  });
});

describe("workPlanStoreFor", () => {
  test("CAT_DEPLOYMENT unset: the git branch, as every checkout today", () => {
    const c = workPlanStoreFor("/nowhere", {});
    expect(c.tool).toBe("beans-git-branch");
    expect(c.deployment).toBeUndefined();
    expect(c.store).toBeInstanceOf(MountedGitBranchStore);
  });

  test("a deployment that names the git branch gets it", () => {
    const dir = deployments({ id: "dev", stores: { "work-plan": "beans-git-branch" } });
    expect(workPlanStoreFor("/nowhere", { [DEPLOYMENT_ENV]: "dev" }, dir)).toMatchObject({ tool: "beans-git-branch", deployment: "dev" });
  });

  test("a deployment that names no work-plan Tool gets the default", () => {
    const dir = deployments({ id: "dev" });
    expect(workPlanStoreFor("/nowhere", { [DEPLOYMENT_ENV]: "dev" }, dir).tool).toBe("beans-git-branch");
  });

  test("a deployment naming a Tool this toolset lacks is REFUSED — never written to the real plan instead", () => {
    const dir = deployments({ id: "bench", stores: { "work-plan": "beans-run-scoped" } });
    expect(() => workPlanStoreFor("/nowhere", { [DEPLOYMENT_ENV]: "bench" }, dir)).toThrow(/does not implement.*Refused/);
  });

  test("an id no description has is refused", () => {
    const dir = deployments({ id: "dev" });
    expect(() => workPlanStoreFor("/nowhere", { [DEPLOYMENT_ENV]: "prod" }, dir)).toThrow(/no deployment description/);
  });
});
