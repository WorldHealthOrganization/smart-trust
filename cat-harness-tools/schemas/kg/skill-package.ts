/**
 * The SKILL-FRAMEWORK vocabulary — actors, capabilities, skills, requirements,
 * the package registry and its Docker and remote-package machinery.
 *
 * @module @folio-assistant/schemas/skill-package
 *
 * Nothing here is about a folio's content: an actor, a capability probe, a
 * skill's validator list and a package's Docker requirements describe the
 * HARNESS — who is working, on what machine, with which skills installed.
 *
 * ## Direction
 *
 * The harness is the base repository: core may import it, it may not import
 * core. So this module must not depend on `types.ts`, `block-kinds.ts` or
 * anything else that describes content. `constraints.ts` re-exports everything
 * here; new harness code should import this module directly.
 * @graphNode schema
 */

import { z } from "zod";
import {
  RequirementFields,
  RequirementLevelSchema,
  RequirementStatementFields,
  refineRequirement,
  refineStatement,
} from "@litlfred/bootstrap-tools/schemas/requirement.ts";
import { NETWORK_REACHES } from "./cat-harness";
import { SkillNameSchema } from "../tools/tool-types.js";
import { SutKindSchema } from "../sdlc/test-plan";
import type { SutRef } from "../sdlc/test-run";

// ─── Enumerations ────────────────────────────────────────────────────────────

/**
 * What kind of thing an actor is — **human, agentic or mechanical**, plus
 * `external` for a participant outside this layer entirely.
 *
 * `person` names the human, `agent` the agentic and `system` the mechanical.
 * The prose reading, the table and the argument for the split live on the
 * re-export in `schemas/process/role-graph.ts`; the values live HERE, because this
 * module is the dependency-free base (zod only) that both the registry schema
 * and the role graph can import.
 *
 * **It is one vocabulary because it was two, and that is what broke.** This
 * enum read `["person", "system"]` until 2026-09-19 while `ACTOR_KINDS` in the
 * role graph read all four — two spellings of one concept, in the one place
 * where the difference decides what a task may be handed to. The narrower of
 * the two was what `.claude/skills/actors/*.json` validated against, so an LLM
 * agent and a CI runner were both recorded `system` and no consumer could tell
 * a participant that exercises judgement from one that runs a program.
 */
export const ACTOR_KINDS = ["person", "agent", "system", "external"] as const;
export const ActorKindSchema = z.enum(ACTOR_KINDS);
/** The requirement level — the bootstrap base's, so a harness cannot drift from it. */
export const ConformanceSchema = RequirementLevelSchema;
export const DegradationStrategySchema = z.enum(["fail", "warn", "skip", "fallback"]);
/**
 * The lifecycle points a hook can bind to.
 *
 * `PreToolUse` was MISSING until 2026-09-20 and its absence was not academic:
 * `interaction-modality` §4.1 is a STRICT rule about how a question is put to
 * a person, and the one moment it certainly applies is the instant before
 * `AskUserQuestion` is invoked. With only `PostToolUse` here, the rule could be
 * reminded of *after* the question had already been asked, which is no
 * reminder at all.
 *
 * The general shape is worth naming, because this enum will grow again: an
 * event the host supports and this schema does not is a class of enforcement
 * the layer cannot express, and it fails at the REGISTRY rather than at the
 * hook — `.claude/settings.json` accepted the entry and the generated skill
 * registry refused it. That is the right order (the gate caught it) and it is
 * still a gap: the hook was live and unrepresentable at the same time.
 *
 * **It grew again on 2026-09-26, exactly as predicted above, and `Stop` is the
 * addition.** `interaction-modality` §4.1's three enforcement layers are each
 * keyed on the agent CHOOSING to ask — a tool call, or a rendered schema — and
 * the failure the owner named twice that day routes around all three: a closing
 * paragraph of an ordinary turn that lists open decisions by name with none of
 * their terms. No tool is called, so `PreToolUse` cannot see it; the turn is
 * over, so nothing later can. `Stop` is the only point at which that paragraph
 * exists and the turn has not yet been handed back.
 *
 * The paragraph above described the symptom precisely — live and
 * unrepresentable — and that is what happened: the hook ran and the registry
 * refused it. Worth keeping as evidence that the prediction was load-bearing
 * rather than decorative.
 */
export const HookEventSchema = z.enum([
  "SessionStart", "PreToolUse", "PostToolUse", "PreCommit", "PostCommit", "UserPromptSubmit",
  "Stop",
]);
export const IdentitySourceSchema = z.enum([
  "git-config", "github-oauth", "google-oauth", "env-var", "bearer-token", "default",
]);
export const DependencyKindSchema = z.enum(["skill", "requirement"]);
export const LifecycleStageSchema = z.enum([
  "plan", "author", "validate", "review", "test", "publish", "feedback", "retire",
]);

// ─── Capability Detection ────────────────────────────────────────────────────

export const CapabilityDetectionSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("command"), command: z.string(), expectExitCode: z.number().optional() }),
  z.object({ method: z.literal("env-var"), variable: z.string() }),
  z.object({ method: z.literal("file-exists"), path: z.string() }),
  z.object({ method: z.literal("mcp-probe"), endpoint: z.string(), healthPath: z.string().optional() }),
  z.object({ method: z.literal("always") }),
]);

/**
 * The system-under-test FACET on an actor — bean `3o5b`, proposal §3.2.
 *
 * A facet rather than a role, because being tested is not a lane anybody
 * takes on: the system under test is the SUBJECT of `test-plan-execution.bpmn`,
 * and the tester and the certifier are the ones acting. Any actor kind that
 * can be executed may carry it — an `agent` or a `system` (machine); a
 * `person` is not a system under test, and `external` is not ours to run.
 *
 * - `kind` is the closed list `SUT_KINDS` in `test-plan.ts` (owner ruling:
 *   skill, agent, tool, machine, ig, process), so a plan's `scope.kind` and an
 *   actor's facet are compared in ONE vocabulary.
 * - `version` is the version a run would record when nothing more specific is
 *   known. A run still records its own `sut.version`; this is the actor's
 *   declaration, not the run's measurement.
 * - **reach is NOT restated here.** It is the actor's own `reach`, and
 *   {@link sutRefFor} reads it from there — absent becomes `unknown`, never
 *   `internet`. A second `reach` on the facet would be a second answer free to
 *   disagree with the first.
 */
export const SystemUnderTestFacetSchema = z.strictObject({
  kind: SutKindSchema,
  version: z.string().min(1),
});
export type SystemUnderTestFacet = z.infer<typeof SystemUnderTestFacetSchema>;

/** Actor kinds that may carry the facet: what can be EXECUTED. */
export const SUT_ACTOR_KINDS = ["agent", "system"] as const;

/**
 * The `sut` a `folio-test-run/v1` records for this actor: kind, id, version,
 * reach, and for an `agent` the model and configuration the run used, which
 * only the run knows (FR-002). `undefined` when the actor declares no facet —
 * it has not said it can be tested, and a run against it is a finding rather
 * than a default. An agent without `run` throws: a ref without its model
 * would be refused anyway, and saying so here names the cause.
 */
export function sutRefFor(
  actor: { id: string; reach?: (typeof NETWORK_REACHES)[number]; systemUnderTest?: SystemUnderTestFacet },
  version?: string,
  run?: { model: string; configuration: string },
): SutRef | undefined {
  const facet = actor.systemUnderTest;
  if (facet === undefined) return undefined;
  const base = { actor: actor.id, version: version ?? facet.version, reach: actor.reach ?? ("unknown" as const) };
  if (facet.kind !== "agent") return { kind: facet.kind, ...base };
  if (run === undefined) {
    throw new Error(`sutRefFor: ${actor.id} is an agent, so its run names the model and configuration it used (FR-002)`);
  }
  return { kind: "agent", ...base, model: run.model, configuration: run.configuration };
}

// ─── ActorDefinition ─────────────────────────────────────────────────────────

/**
 * @general — a node others depend on: it points only at other general nodes,
 * never at its dependents (data-modelling step 8; checked by `arrow-direction`).
 */
export const ActorDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: ActorKindSchema,
  description: z.string(),
  // DEPRECATED. An actor does not inherit — a ROLE does, and the lattice that
  // used to live here now lives in `scenarios/roles.json`. Kept optional so
  // an unmigrated registry still validates; `kg:audit` reports any entry that
  // still carries it (`actor-is-not-a-role`).
  inherits: z.array(z.string()).optional().default([]),
  /** Roles (BPMN swimlanes) this actor may take on. */
  roles: z.array(z.string()).optional(),
  /** Permission ids — what it may do, regardless of lane. See `skills/permissions/`. */
  permissions: z.array(z.string()).optional(),
  capabilities: z.array(z.string()),
  /**
   * Network reach — see `ActorDefinition.reach` in `assistant-types.ts`, and
   * `schemas/process/actor-reach.ts` for how it composes with the deployment's.
   */
  reach: z.enum(NETWORK_REACHES).optional(),
  /**
   * The SYSTEM-UNDER-TEST facet (bean `3o5b`, arc `3fva`): present when this
   * actor can be executed against a `test-plan/v1`. See
   * {@link SystemUnderTestFacetSchema}.
   */
  systemUnderTest: SystemUnderTestFacetSchema.optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
}).superRefine((a, ctx) => {
  // A person is not executed against a plan, and an external participant is
  // not ours to run: the facet on either is a modelling error, refused here
  // rather than discovered when a run names it.
  if (a.systemUnderTest !== undefined && !(SUT_ACTOR_KINDS as readonly string[]).includes(a.kind)) {
    ctx.addIssue({
      code: "custom",
      path: ["systemUnderTest"],
      message: `actor \`${a.id}\` is kind \`${a.kind}\`; only ${SUT_ACTOR_KINDS.join(" or ")} actors can be a system under test`,
    });
  }
});

// ─── CapabilityDefinition ────────────────────────────────────────────────────

/**
 * @general — a node others depend on: it points only at other general nodes,
 * never at its dependents (data-modelling step 8; checked by `arrow-direction`).
 */
export const CapabilityDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  detection: CapabilityDetectionSchema,
  requires: z.array(z.string()).optional(),
  /**
   * The capability that stands in for this one when it is absent.
   *
   * Declared HERE and not on each skill that needs it. What substitutes for
   * `lean-toolchain` is a property of `lean-toolchain`, not of the five
   * skills that happened to say so — bean `folio-assistant-sym3`, on the
   * owner's standing objection to duplicate data maintenance. A sixth Lean
   * skill had to remember to repeat it, and a change of substitute had to be
   * made five times and could be made four.
   *
   * **It must not transitively `requires` the capability it replaces.** A
   * substitute that needs the missing thing is absent in exactly the case it
   * exists for — `probeAll` computes `present = requiresMet && probe(…)`, so
   * the fallback never fires. `check:fallback-roles` reports that.
   */
  fallbackTo: z.string().min(1).optional(),
  /**
   * The requirement statements this capability discharges. See
   * {@link RequirementStatementRefSchema}.
   */
  satisfies: z.array(z.lazy(() => RequirementStatementRefSchema)).optional(),
  /**
   * The skill that explains how to SET UP this capability — install it,
   * configure it, verify it. Optional.
   *
   * A pointer, not a merge (bean `rqao`, owner 2026-09-30, round 4). The
   * owner asked whether capabilities could be recast as skills; they stay
   * their own kind because the role model keeps an actor's ENVIRONMENT
   * (capabilities: can this host run Bun?) apart from its role's KNOWLEDGE
   * (skills: how is a proof reviewed?), and merging them would make those one
   * relation. This field is the part of the recast that costs nothing: where
   * a setup procedure exists as a skill, the probe names it, so a failed probe
   * can say what to read.
   */
  setupSkill: SkillNameSchema.optional(),
});

// ─── SkillDefinition ─────────────────────────────────────────────────────────

export const SkillCapabilityRefSchema = z.object({
  capabilityId: z.string(),
  degradation: DegradationStrategySchema,
  // NEITHER fallback field lives here any more, and for two different
  // reasons — both 2026-09-20.
  //
  // `fallbackRole` was DERIVABLE: the BPMN already carried it executably, so
  // declaring it was a cached copy with nothing asserting the two agreed
  // (bean `85e8`).
  //
  // `fallbackCapabilityId` was not derivable but was DUPLICATED: one fact,
  // `lean-toolchain → lean-mcp`, written in five modules. It is
  // `CapabilityDefinition.fallbackTo` now, declared once on the capability
  // it is a property of (bean `sym3`).
  //
  // What stays is `degradation` — the SKILL's business, what it does when a
  // capability is missing, as against the capability's, what stands in for
  // it.
});

export const SkillDependencySchema = z.object({
  ref: z.string(),
  kind: DependencyKindSchema,
  conformance: ConformanceSchema,
});

/** Mirrors `SkillSchemaRef` — a TS module + the type names a skill touches. */
export const SkillSchemaRefSchema = z.object({
  module: z.string().min(1),
  types: z.array(z.string()),
  access: z.enum(["read", "write", "read-write"]),
});

/**
 * @general — a node others depend on: it points only at other general nodes,
 * never at its dependents (data-modelling step 8; checked by `arrow-direction`).
 */
export const SkillDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  // NO `roles` (bean `y1w9`, deleted in #1168 B8). A skill naming the roles that
  // use it is the inverse of `RoleDef.skills`, and it was read by nothing. The
  // record, and the rule for bringing it back (write the consumer first):
  // `fsh-guts/retired/skill-definition-roles.md`.
  requiredCapabilities: z.array(SkillCapabilityRefSchema),
  dependsOn: z.array(SkillDependencySchema).optional(),
  allowedTools: z.array(z.string()).optional(),
  // No `scripts`, `mcpServices` or `validators` (#1168, B3). Each named a
  // mechanism FROM the skill, the general node pointing at its dependents:
  // a new script meant editing the skill, and nothing read any of the three.
  // A mechanism is a Tool that names the skill it `satisfies`
  // (`schemas/tools/tool.ts`); a Tool reachable only over MCP is refused there.
  routingPatterns: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  package: z.string().optional(),
  // `schemas` was here until 2026-09-20, added because the interface had it
  // and Zod was stripping it — a real defect, correctly fixed at the time.
  //
  // Both halves are gone now, and the fix is the reason worth keeping: the
  // field reached no reader in EITHER state. Adding the counterpart made the
  // value survive `.parse()` and travel to exactly one consumer,
  // `generate-docs.ts`, which had never run since the root commit and is
  // retired (`folio-assistant-3w0i`). Fixing a field's plumbing is not
  // evidence that anything is on the other end — this one was two years of
  // declaration with no destination (`folio-assistant-t2yg`).
  lifecycleStages: z.array(LifecycleStageSchema).optional(),
  // No `schemaRef` (#1168, B3b). It named a directory and was read only by a
  // retired generator. A skill names its contracts in its front matter —
  // `input:` and `output:`, a path into the layer or an https IRI — and
  // `scripts/skill-contracts.ts` is the one reader.
});

// ─── Requirement ─────────────────────────────────────────────────────────────

/**
 * A pointer AT one requirement statement: `req:<requirement id>#<statement key>`.
 *
 * Held by what SATISFIES the statement — a skill in its front matter
 * (`satisfies:`), a capability in its JSON — never by the statement (#1168,
 * B3). A requirement is the general node: it is written once, and skills and
 * capabilities come to discharge it later, so a statement listing its
 * satisfiers had to be edited every time one was added. FHIR R5's
 * `Requirements.statement.satisfiedBy` is the inverse of this relation and is
 * derivable from it for a projection that needs it.
 *
 * @ref RequirementStatementSchema
 */
export const RequirementStatementRefSchema = z
  .string()
  .regex(/^req:[a-z0-9-]+#[a-z0-9-]+$/, "a requirement statement ref is req:<requirement>#<statement key>");

/*
 * BUILT ON THE BOOTSTRAP BASE (issue #1164, owner: "1 + 2"). The base in
 * `bootstrap/schemas/requirement.schema.json` (Zod source: `bootstrap-tools/schemas/requirement.ts`) is what every harness gets — the
 * statement, its level, the functional and non-functional fields. Neither
 * lists what satisfies a statement: that pointer is held by the satisfier
 * (`satisfies:`, above). The base's refinements are re-applied, because a
 * refined schema cannot be extended and the rules must not be lost.
 */
/**
 * @general — a node others depend on: it points only at other general nodes,
 * never at its dependents (data-modelling step 8; checked by `arrow-direction`).
 */
export const RequirementStatementSchema = RequirementStatementFields.superRefine(refineStatement);

export const RequirementSchema = RequirementFields.extend({
  statements: z.array(RequirementStatementSchema).min(1),
}).superRefine(refineRequirement);

// ─── Registry ────────────────────────────────────────────────────────────────

export const SkillPackageRefSchema = z.object({
  name: z.string(),
  repo: z.string(),
  path: z.string(),
  ref: z.string(),
  skills: z.array(SkillNameSchema),
});

export const HookCommandSchema = z.object({
  type: z.literal("command"),
  command: z.string(),
  timeout: z.number().optional(),
});

export const SessionHookSchema = z.object({
  event: HookEventSchema,
  matcher: z.string().optional(),
  commands: z.array(HookCommandSchema),
});

export const RoleAssignmentSchema = z.object({
  userPattern: z.string(),
  identitySource: IdentitySourceSchema,
  actorId: z.string(),
  priority: z.number(),
});

// ─── Docker Requirements ─────────────────────────────────────────────────────

export const DockerRequirementsSchema = z.object({
  baseImage: z.string().default("ubuntu:24.04"),
  aptPackages: z.array(z.string()),
  pipPackages: z.array(z.string()).optional(),
  npmPackages: z.array(z.string()).optional(),
  setupCommands: z.array(z.string()).optional(),
  exposePorts: z.array(z.number()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

export const SkillPackageManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string(),
  description: z.string(),
  skills: z.array(SkillNameSchema),
  docker: DockerRequirementsSchema,
  providesCapabilities: z.array(z.string()).optional(),
  requiresCapabilities: z.array(z.string()).optional(),
  lifecycleStages: z.array(LifecycleStageSchema).optional(),
  schemas: z.array(z.string()).optional(),
});

export const SkillRegistrySchema = z.object({
  schemaVersion: z.literal("1.0"),
  repository: z.string(),
  actors: z.array(ActorDefinitionSchema),
  capabilities: z.array(CapabilityDefinitionSchema),
  skills: z.array(SkillDefinitionSchema),
  requirements: z.array(RequirementSchema),
  // Local `skills/<name>/package-manifest.json` files, which is what the
  // generator has always written here — not `SkillPackageRefSchema`, whose
  // required `repo`/`path`/`ref` made every generated registry invalid.
  packages: z.array(SkillPackageManifestSchema),
  hooks: z.array(SessionHookSchema),
  // `SkillRegistry.roleAssignments` is required by the TS interface but was
  // absent here, so the field was stripped by `.parse()` — on top of the
  // generator never populating it in the first place.
  roleAssignments: z.array(RoleAssignmentSchema),
});

// ─── Remote Package Reference ────────────────────────────────────────────────

export const RemoteSyncStrategySchema = z.enum(["shallow-clone", "sparse-checkout", "subtree"]);

/**
 * How a remote package's skills are brought in — PERFORMED since 2026-09-24
 * (issue #556, bean `wlqd`) by `scripts/sync-remote-skills.ts`
 * (`bun run cat sync:remote-skills`).
 *
 * Until then this was declared intent that nothing performed: `shallow-clone`
 * appeared only as a value in {@link RemoteSyncStrategySchema}, and both
 * wrappers pinned `ref: "main"` with `autoUpdate: true`. The owner chose to
 * implement it, **committed, pinned and read-only**:
 *
 * - the sync copies each declared skill at the wrapper's `ref` into its own
 *   package under the layer's skills directory, with a sha256 fixity record
 *   per file, so `check:materialized-fixity` fails an edit in place;
 * - a wrapper that declares `sync` must pin a full commit SHA and may not
 *   `autoUpdate` — a skill body is a prompt an agent follows, so an unpinned
 *   one is an unreviewed prompt. {@link RemotePackageRefSchema} refuses both;
 * - `bun run cat check:remote-skills` fails, offline, when a declared skill is
 *   not materialized at its wrapper's pin.
 *
 * The synced skills resolve as LOCAL skills, so `manifest-skill-exists` needs
 * no remote allowance (bean `nup0`) — it sees them as it sees any other.
 */
export const RemoteSyncConfigSchema = z.object({
  strategy: RemoteSyncStrategySchema,
  frequency: z.enum(["daily", "weekly", "monthly", "manual"]),
  autoUpdate: z.boolean(),
});

export const RemotePackageRefSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  repo: z.string().url(),
  ref: z.string(),
  path: z.string(),
  maintainer: z.string(),
  /**
   * OPTIONAL, because a wrapper whose only job is to supply Docker requirements
   * should not have to claim a sync strategy to be valid. Required until
   * 2026-09-19, which is why both wrappers carry one.
   */
  sync: RemoteSyncConfigSchema.optional(),
  wrapper: z.object({
    description: z.string(),
    docker: DockerRequirementsSchema,
    providesCapabilities: z.array(z.string()).optional(),
    skills: z.array(SkillNameSchema),
    lifecycleStages: z.array(LifecycleStageSchema).optional(),
  }),
}).superRefine((w, ctx) => {
  // PINNED, OR NOT SYNCED (issue #556). A synced skill is a prompt an agent
  // follows, so it moves only by a reviewed change to this pin.
  if (!w.sync) return;
  if (!/^[0-9a-f]{40}$/.test(w.ref)) {
    ctx.addIssue({ code: "custom", path: ["ref"],
      message: "a wrapper that syncs pins a full 40-character commit SHA, never a branch or tag" });
  }
  if (w.sync.autoUpdate) {
    ctx.addIssue({ code: "custom", path: ["sync", "autoUpdate"],
      message: "a pinned sync never updates itself; move the pin in a reviewed change instead" });
  }
});

/**
 * The record `sync-remote-skills.ts` writes beside a synced skill
 * (`materialization.json`, tag `folio-remote-skill/v1`, issue #556).
 *
 * Each file's `materialization` is the shape `check:materialized-fixity`
 * walks. It is restated narrowly here rather than imported, because the full
 * `MaterializationSchema` belongs to a layer above this one; this is the
 * subset a synced skill always carries — materialized, pinned, with sha256.
 */
export const RemoteSkillRecordSchema = z.object({
  $schema: z.literal("folio-remote-skill/v1"),
  skill: SkillNameSchema,
  package: z.string().min(1),
  repo: z.string().url(),
  ref: z.string().regex(/^[0-9a-f]{40}$/, "a synced skill is pinned to a full commit SHA"),
  wrapper: z.string().min(1),
  note: z.string().min(1),
  files: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    materialization: z.object({
      state: z.literal("materialized"),
      provenance: z.object({ upstream: z.string().url() }),
      localPath: z.string().min(1),
      bytes: z.number().int().nonnegative(),
      purpose: z.literal("archival"),
      fixity: z.object({ algorithm: z.literal("sha256"), digest: z.string().regex(/^[0-9a-f]{64}$/) }),
      materializedAt: z.string().min(1),
      upstreamVersion: z.string().regex(/^[0-9a-f]{40}$/),
    }),
  })).min(1),
});

// ─── Inferred types ──────────────────────────────────────────────────────────
//
// These lived in `types.ts` as `z.infer<>` aliases over the schemas above.
// They move with the schemas: an alias separated from what it infers from is
// a second place to look for one fact, and it was the alias rather than the
// schema that four harness modules were importing.

/** Actor classification: human user or automated system. */
export type ActorKind = z.infer<typeof ActorKindSchema>;

/** How strongly a requirement statement binds. */
export type Conformance = z.infer<typeof ConformanceSchema>;

/** Behavior when a required capability is absent at runtime. */
export type DegradationStrategy = z.infer<typeof DegradationStrategySchema>;

/** Script execution runtimes. */

/** Lifecycle phase in which a script runs. */

/** Scope of a validator's operation. */

/** Hook events that trigger session lifecycle actions. */
export type HookEvent = z.infer<typeof HookEventSchema>;

/** Identity source for role assignment. */
export type IdentitySource = z.infer<typeof IdentitySourceSchema>;

/** What satisfies a requirement statement. */

/** Dependency target kind. */
export type DependencyKind = z.infer<typeof DependencyKindSchema>;

/** Stages in the content development lifecycle. */
export type LifecycleStage = z.infer<typeof LifecycleStageSchema>;

/** Sync strategy for remote packages. */
export type RemoteSyncStrategy = z.infer<typeof RemoteSyncStrategySchema>;

/** How to probe whether a capability is available in the environment. */
export type CapabilityDetection = z.infer<typeof CapabilityDetectionSchema>;

/**
 * A human role or system service.
 * Maps to FHIR R5 `ActorDefinition`.
 *
 * @example
 * ```typescript
 * const businessAnalyst: ActorDefinition = {
 *   id: "business-analyst",
 *   name: "Business Analyst",
 *   type: "person",
 *   description: "L2 DAK component author",
 *   inherits: ["viewer"],
 *   capabilities: ["git-push", "bpmn-authoring"],
 * };
 * ```
 */
export type ActorDefinition = z.infer<typeof ActorDefinitionSchema>;

/** A concrete capability that tools, services, or environments provide. */
export type CapabilityDefinition = z.infer<typeof CapabilityDefinitionSchema>;

export type SkillCapabilityRef = z.infer<typeof SkillCapabilityRefSchema>;

export type SkillDependency = z.infer<typeof SkillDependencySchema>;



/**
 * The core type. A skill has typed metadata (who can invoke it, what it needs,
 * what it validates) and a companion markdown file with instructions the agent reads.
 */
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

export type RequirementStatementRef = z.infer<typeof RequirementStatementRefSchema>;

export type RequirementStatement = z.infer<typeof RequirementStatementSchema>;

/** Models workflow rules agents must follow — the bootstrap `Requirement`, narrowed. */
export type Requirement = z.infer<typeof RequirementSchema>;

export type SkillPackageRef = z.infer<typeof SkillPackageRefSchema>;

export type HookCommand = z.infer<typeof HookCommandSchema>;

export type SessionHook = z.infer<typeof SessionHookSchema>;

/** Central manifest listing all skills, actors, capabilities, and requirements. */
export type SkillRegistry = z.infer<typeof SkillRegistrySchema>;

/** Maps user identities to actor roles. Evaluated at session start. */
export type RoleAssignment = z.infer<typeof RoleAssignmentSchema>;

/**
 * Docker packaging requirements for a skill package.
 * Uses OCI image spec labels convention.
 *
 * @see {@link https://github.com/opencontainers/image-spec/blob/main/annotations.md}
 */
export type DockerRequirements = z.infer<typeof DockerRequirementsSchema>;

/**
 * Manifest for a skill package — the standard way for each package
 * to declare its Docker/system requirements.
 *
 * Every skill package directory MUST contain a `package-manifest.json`
 * conforming to this type.
 */
export type SkillPackageManifest = z.infer<typeof SkillPackageManifestSchema>;

/** Sync configuration for a remote package. */
export type RemoteSyncConfig = z.infer<typeof RemoteSyncConfigSchema>;

/**
 * Reference to an external skill package maintained in another repository.
 * Each remote package gets a light wrapper in `skills/remote-packages/`
 * that provides `SkillPackageManifest`-compatible Docker requirements.
 */
export type RemotePackageRef = z.infer<typeof RemotePackageRefSchema>;
