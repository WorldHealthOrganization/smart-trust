/**
 * **Deployment descriptions**: which declared actors run where, in one
 * deployment.
 *
 * 1. Descriptions live in a `deployments/` folder, several per layer (one
 *    layer may run as cloud agent sessions and on a workstation).
 * 2. Jurisdiction is four optional fields.
 * 3. The resolver only reports, and never fails. The checks here are about a
 *    description being well formed, not about whether every task can be run.
 *
 * ## What is new, and what is reused
 *
 * Only {@link Placement}, {@link Jurisdiction} and `liveData` are new. The
 * aggregate is the existing {@link Topology}, and every axis a placement
 * carries uses that axis's existing values.
 *
 * ## A placement is not an actor
 *
 * An actor in `scenarios/actors/` is abstract: it occupies a lane. A placement
 * says where that actor runs in one deployment. So a placement names an actor
 * that is already declared, and never declares a new one: roles and policies
 * stay with the actor.
 *
 * Where the actor's own file fixes a fact, the placement may not contradict
 * it. `attestation-service` declares `reach: "internet"` as part of what it
 * is; a placement that puts it air-gapped describes a different actor.
 *
 * ## Reach is never inherited
 *
 * A placement without `reach` is {@link REACH_UNKNOWN}, never the
 * deployment's value, under the same rule as `actor-reach.ts`. The only
 * exception is the one that module already makes: an air-gapped deployment
 * determines every participant.
 *
 * @graphNode schema
 * @module folio-assistant/schemas/deployment-description
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { effectiveReach, REACH_UNKNOWN, reachConflict, type EffectiveReach } from "./actor-reach.js";
import {
  COMPUTES,
  MODEL_PROVENANCES,
  NETWORK_REACHES,
  PUBLICATION_HOSTS,
  TOOL_SURFACES,
  TopologySchema,
  type Compute,
  type ModelProvenance,
  type NetworkReach,
  type PublicationHost,
  type Topology,
  type ToolSurface,
} from "../kg/cat-harness.js";

/**
 * The six operating modes of `deployment-topologies.md` §2, verbatim.
 * A deployment says which of them run in it.
 */
export const OPERATING_MODES = ["author", "ingest", "develop", "test", "qa-review", "publish"] as const;
export type OperatingMode = (typeof OPERATING_MODES)[number];

/**
 * What runs an actor in a placement: an agent host, or a runner.
 *
 * The agent hosts are the ones the tools layer's `src/core/agent-host.ts`
 * detects (bean `f1e1`). That module sits below this one's consumers but above
 * this layer, so the list is written here and the tools layer may import it.
 * `local` is a person's own shell, with no agent host and no runner.
 */
export const PLACEMENT_HOSTS = [
  "claude-code",
  "gemini-cli",
  "codex",
  "cursor",
  "antigravity",
  "copilot-cli",
  "copilot-agent",
  "github-actions",
  "gitlab-ci",
  "local",
] as const;
export type PlacementHost = (typeof PLACEMENT_HOSTS)[number];

/**
 * The closed credential action list of
 * `docs/proposals/credentials-needs-and-supply.md` §2.2. Closed so that a new
 * action is a decision someone makes, not a string someone typed.
 */
export const CREDENTIAL_ACTIONS = [
  "publish-site",
  "push-branch",
  "open-pull-request",
  "dispatch-workflow",
  "publish-package",
  "call-model-api",
  "provision-host",
  "authenticate-users",
  "list-secret-names",
  "sign-artefact",
  "sign-session",
] as const;
export type CredentialAction = (typeof CREDENTIAL_ACTIONS)[number];

/** Whether a deployment may hold live data. Owner rulings, 2026-09-24. */
export const LIVE_DATA = ["artefacts-only", "may-hold-credentials"] as const;
export type LiveData = (typeof LIVE_DATA)[number];

/** Who may reach what a deployment publishes. */
export const AUDIENCES = ["public", "authenticated", "operator-only"] as const;
export type Audience = (typeof AUDIENCES)[number];

/** One declared actor, placed in one deployment. */
export interface Placement {
  /** An actor id in `scenarios/actors/`. Never a new actor. */
  actor: string;
  host?: PlacementHost;
  /** Absent is unknown, never the deployment's value. */
  reach?: NetworkReach;
  compute?: Compute;
  toolSurface?: ToolSurface;
  modelProvenance?: ModelProvenance;
  /** The identity provider, as `identity.ts` names providers (github, gitlab, google). */
  identity?: { provider: string };
  /**
   * Each credential need, mapped to the NAME of the mechanism or secret that
   * supplies it. Never a value: an agent reads names only.
   */
  credentials?: Partial<Record<CredentialAction, string>>;
}

/** What a jurisdiction requires of what is published and kept. */
export interface Jurisdiction {
  /** Where artefacts may be served. */
  publicationBase?: string;
  audience?: Audience;
  /** How long artefacts are kept, as the jurisdiction states it. */
  retention?: string;
  /** Where bytes may live. */
  residency?: string;
}

/** One deployment of a layer. */
export interface DeploymentDescription {
  id: string;
  title?: string;
  description?: string;
  /** The aggregate over the placements, unchanged. */
  topology: Topology;
  publicationHost?: PublicationHost;
  modes: OperatingMode[];
  placements: Placement[];
  jurisdiction?: Jurisdiction;
  liveData: LiveData;
  /**
   * The Tool that backs each store Role in this deployment, keyed by the
   * Role's id: `{ "work-plan": "beans-git-branch" }` (owner, 2026-11-02,
   * cat-harness#991 Q-BSD-2 A). A Role left out uses its default Tool.
   */
  stores?: Record<string, string>;
}

/** A Role or Tool id: lower-case words joined by hyphens. */
const StoreIdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);

/**
 * A secret or mechanism name: letters, digits, `_`, `-`, `.`. It refuses a
 * pasted token on its shape alone where it can (whitespace, `:`, `/`, `=`),
 * because a value in this file would be published with it.
 */
const MechanismNameSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/, {
  message: "a credential is named by its mechanism or secret NAME, never its value",
});

export const PlacementSchema = z
  .object({
    actor: z.string().min(1),
    host: z.enum(PLACEMENT_HOSTS).optional(),
    reach: z.enum(NETWORK_REACHES).optional(),
    compute: z.enum(COMPUTES).optional(),
    toolSurface: z.enum(TOOL_SURFACES).optional(),
    modelProvenance: z.enum(MODEL_PROVENANCES).optional(),
    identity: z.object({ provider: z.string().min(1) }).strict().optional(),
    credentials: z.partialRecord(z.enum(CREDENTIAL_ACTIONS), MechanismNameSchema).optional(),
  })
  .strict();

export const JurisdictionSchema = z
  .object({
    publicationBase: z.string().min(1).optional(),
    audience: z.enum(AUDIENCES).optional(),
    retention: z.string().min(1).optional(),
    residency: z.string().min(1).optional(),
  })
  .strict();

export const DeploymentDescriptionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().optional(),
    description: z.string().optional(),
    topology: TopologySchema.strict(),
    publicationHost: z.enum(PUBLICATION_HOSTS).optional(),
    modes: z.array(z.enum(OPERATING_MODES)),
    placements: z.array(PlacementSchema),
    jurisdiction: JurisdictionSchema.optional(),
    liveData: z.enum(LIVE_DATA),
    stores: z.record(StoreIdSchema, StoreIdSchema).optional(),
  })
  .strict();

/** The folder name, inside the declared `scenarios` graph, beside `actors/`. */
export const DEPLOYMENTS_DIRNAME = "deployments";

/** A description as read, with the file it came from. */
export interface LoadedDeployment extends DeploymentDescription {
  path: string;
}

/**
 * Read every `*.json` in a deployments folder. A file that does not parse
 * throws, naming the file: a description read wrongly would put a wrong fact
 * into every report built on it. An absent folder is no descriptions.
 */
export function readDeployments(dir: string): LoadedDeployment[] {
  if (!existsSync(dir)) return [];
  const out: LoadedDeployment[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const path = join(dir, f);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, "utf-8"));
    } catch (e) {
      throw new Error(`${path} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    const parsed = DeploymentDescriptionSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`${path} is not a deployment description: ${parsed.error.message}`);
    }
    out.push({ ...parsed.data, path });
  }
  return out;
}

/** The actor facts a description is checked against. */
export interface ActorFacts {
  id: string;
  reach?: NetworkReach;
}

export type DeploymentProblemKind =
  | "id-not-filename"
  | "duplicate-id"
  | "unknown-actor"
  | "contradicts-actor"
  | "exceeds-deployment";

/** One way a description is not well formed. */
export interface DeploymentProblem {
  deployment: string;
  kind: DeploymentProblemKind;
  /** The placement's actor, where the problem is in a placement. */
  actor?: string;
  message: string;
}

/**
 * Every way the descriptions are not well formed. Empty is the normal answer.
 *
 * - The id is the file's name, so a link to a description cannot drift from
 *   the file it names.
 * - A placement names a declared actor.
 * - A placement does not contradict a fact the actor's own file fixes.
 * - A placement reaches no further than its deployment allows
 *   (`reachConflict`, the rule actors already follow).
 */
export function deploymentProblems(
  deployments: readonly (DeploymentDescription & { path?: string })[],
  actors: readonly ActorFacts[],
): DeploymentProblem[] {
  const problems: DeploymentProblem[] = [];
  const byId = new Map(actors.map((a) => [a.id, a]));
  const seen = new Set<string>();
  for (const d of deployments) {
    if (d.path !== undefined) {
      const base = d.path.split(/[\\/]/).pop()!.replace(/\.json$/, "");
      if (base !== d.id) {
        problems.push({
          deployment: d.id,
          kind: "id-not-filename",
          message: `${d.path} declares id "${d.id}"; the id is the file's name, "${base}"`,
        });
      }
    }
    if (seen.has(d.id)) {
      problems.push({ deployment: d.id, kind: "duplicate-id", message: `two descriptions share the id "${d.id}"` });
    }
    seen.add(d.id);

    for (const p of d.placements) {
      const actor = byId.get(p.actor);
      if (actor === undefined) {
        problems.push({
          deployment: d.id,
          kind: "unknown-actor",
          actor: p.actor,
          message:
            `placement names "${p.actor}", which is not a declared actor. ` +
            `A placement places an actor; it never declares one.`,
        });
        continue;
      }
      if (actor.reach !== undefined && p.reach !== undefined && p.reach !== actor.reach) {
        problems.push({
          deployment: d.id,
          kind: "contradicts-actor",
          actor: p.actor,
          message:
            `placement gives "${p.actor}" reach "${p.reach}", but its own file declares ` +
            `"${actor.reach}". A fact the actor fixes is part of what it is.`,
        });
      }
      const reach = p.reach ?? actor.reach;
      const conflict = reachConflict(p.actor, d.topology.network, reach);
      if (conflict) {
        problems.push({ deployment: d.id, kind: "exceeds-deployment", actor: p.actor, message: conflict.reason });
      }
    }
  }
  return problems;
}

/**
 * The reach a consumer acts on for one placement: the placement's, else the
 * actor's own, composed with the deployment's under `effectiveReach`. Never
 * the deployment's value alone, except where the deployment is air-gapped.
 */
export function placementReach(
  deployment: DeploymentDescription,
  placement: Placement,
  actor?: ActorFacts,
): EffectiveReach {
  return effectiveReach(deployment.topology.network, placement.reach ?? actor?.reach);
}

export { REACH_UNKNOWN };
