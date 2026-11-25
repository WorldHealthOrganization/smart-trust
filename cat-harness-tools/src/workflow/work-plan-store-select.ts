/**
 * **Which Tool backs the work plan here**: read from the deployment
 * description (owner, 2026-11-02, cat-harness#991 Q-BSD-2 A).
 *
 * A description names the Tool for each store Role in its `stores` map
 * (`{ "work-plan": "beans-git-branch" }`). Which description is this
 * checkout's own is named by {@link DEPLOYMENT_ENV}; unset, the work plan is
 * the git state branch on its mount, which is every checkout today. A
 * benchmark run sets it to a deployment whose store is run-scoped (step 9).
 *
 * Every way of being wrong is refused with the reason, never answered with
 * the default: a deployment that names a store this toolset does not have
 * must not write to the real work plan instead.
 *
 * The environment is a parameter, so this module reads none of its own.
 *
 * @module folio-assistant/workflow/work-plan-store-select
 */
import { dirname, join } from "node:path";
import { DEPLOYMENTS_DIRNAME, readDeployments } from "../../schemas/process/deployment-description.ts";
import { actorsDir } from "../../schemas/process/role-graph.ts";
import { MountedGitBranchStore } from "./work-plan-store-git-mount.ts";
import type { WorkPlanStore } from "./work-plan-store.ts";

/** The environment variable naming this checkout's deployment description, by its `id`. */
export const DEPLOYMENT_ENV = "CAT_DEPLOYMENT";

/** The store Role whose Tool this module chooses. */
export const WORK_PLAN_ROLE = "work-plan";

/** The work-plan Tool a deployment gets when it names none. */
export const DEFAULT_WORK_PLAN_TOOL = "beans-git-branch";

/** The work-plan Tools this toolset implements, by the id a description names them with. */
export const WORK_PLAN_TOOLS: Readonly<Record<string, (repoRoot: string) => WorkPlanStore>> = {
  "beans-git-branch": (repoRoot) => new MountedGitBranchStore(repoRoot),
};

export interface ChosenStore {
  store: WorkPlanStore;
  tool: string;
  /** The deployment it was read from; absent when {@link DEPLOYMENT_ENV} is unset. */
  deployment?: string;
  /** The deployment's whole `stores` map, for the other store Roles (work context, §4.13). */
  stores?: Readonly<Record<string, string>>;
}

/**
 * The work-plan store for a checkout. `env` is the caller's environment;
 * `deploymentsDir` overrides where the descriptions are (tests).
 */
export function workPlanStoreFor(
  repoRoot: string,
  env: Readonly<Record<string, string | undefined>>,
  deploymentsDir?: string,
): ChosenStore {
  const id = env[DEPLOYMENT_ENV]?.trim();
  if (!id) return { store: WORK_PLAN_TOOLS[DEFAULT_WORK_PLAN_TOOL]!(repoRoot), tool: DEFAULT_WORK_PLAN_TOOL };

  let dir = deploymentsDir;
  if (dir === undefined) {
    const actors = actorsDir(repoRoot);
    if (actors === undefined) {
      throw new Error(`${DEPLOYMENT_ENV}=${id}, but this checkout declares no \`scenarios\` graph, so there are no deployment descriptions to read`);
    }
    dir = join(dirname(actors), DEPLOYMENTS_DIRNAME);
  }
  const d = readDeployments(dir).find((x) => x.id === id);
  if (!d) throw new Error(`${DEPLOYMENT_ENV}=${id}, but no deployment description under ${dir} has that id`);

  const tool = d.stores?.[WORK_PLAN_ROLE] ?? DEFAULT_WORK_PLAN_TOOL;
  const make = WORK_PLAN_TOOLS[tool];
  if (!make) {
    throw new Error(
      `deployment ${id} keeps the work plan in "${tool}", which this toolset does not implement ` +
        `(it has: ${Object.keys(WORK_PLAN_TOOLS).join(", ")}). Refused rather than writing to another store.`,
    );
  }
  return { store: make(repoRoot), tool, deployment: id, ...(d.stores ? { stores: d.stores } : {}) };
}
