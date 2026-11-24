/**
 * Assistant Framework — Schema definitions for the agent skills system.
 *
 * Defines the typed registry model: actors, capabilities, skills,
 * requirements, and their relationships. This is the **authoritative**
 * schema source; skill records import `SkillDefinition` from here.
 *
 * ## Concept overview
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        SkillRegistry                           │
 * │  (central manifest — one per repository)                       │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                │
 * │  ActorDefinition ──inherits──▶ ActorDefinition (DAG)           │
 * │    │                                                           │
 * │    └──capabilities──▶ CapabilityDefinition                     │
 * │                          │                                     │
 * │                          └──requires──▶ CapabilityDefinition   │
 * │                                                                │
 * │  SkillDefinition                                               │
 * │    ├──roles──▶ ActorDefinition.id                              │
 * │    ├──requiredCapabilities──▶ CapabilityDefinition.id          │
 * │    │     (with degradation: fail | warn | skip | fallback)     │
 * │    ├──dependsOn──▶ SkillDefinition | Requirement               │
 * │    └──satisfies──▶ RequirementStatement (skill front matter)   │
 * │                                                                │
 * │  Requirement (FHIR R5–aligned)                                 │
 * │    ├──actors──▶ ActorDefinition.id                             │
 * │    └──statements[]  (named BY what satisfies them)             │
 * │                                                                │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Relationship to FHIR R5
 *
 * The `Requirement` type mirrors the
 * [FHIR R5 Requirements](https://hl7.org/fhir/R5/requirements.html)
 * resource model: each requirement contains statements with conformance
 * verbs (SHALL/SHOULD/MAY). FHIR's `satisfiedBy` is the inverse of the
 * `satisfies` a skill or capability declares, and is derived from it. This enables
 * cross-repository interoperability with WHO SMART Guidelines (the DAK layer).
 *
 * @module assistant-types
 * @graphNode schema
 */

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

/**
 * What kind of participant the actor is — **human, agentic or mechanical**.
 *
 * - `person` — **human**. An identity a real person holds (git config, OAuth).
 * - `agent` — **agentic**. An LLM agent: it can be handed a skill to read and
 *   asked for a judgement.
 * - `system` — **mechanical**. A fixed program — an MCP server, a CI runner. It
 *   executes a procedure and decides nothing.
 * - `external` — a participant outside this layer entirely.
 *
 * Re-exported from `schemas/kg/skill-package.ts`, which holds the one vocabulary,
 * so this file does not become a second place the values can be edited.
 *
 * It read `"person" | "system"` until 2026-09-19, and that two-way split is
 * what made *"which tasks can this actor perform"* unanswerable: the question
 * turns on whether the participant exercises judgement, and an LLM agent and a
 * CI runner wore the same label.
 */
export type { ActorKind };

/**
 * FHIR conformance verbs for requirement statements.
 *
 * | Verb | Meaning |
 * |------|---------|
 * | `SHALL` | Absolute requirement |
 * | `SHOULD` | Recommended |
 * | `MAY` | Optional |
 * | `SHALL NOT` | Absolute prohibition |
 */
export type Conformance = "SHALL" | "SHOULD" | "MAY" | "SHALL NOT";

/**
 * An actor represents a role or persona in the system.
 *
 * Actors form a **directed acyclic graph** via `inherits` — a collaborator
 * inherits all reader capabilities, an owner inherits all collaborator
 * capabilities, etc.
 *
 * @example
 * ```ts
 * const collaborator: ActorDefinition = {
 *   id: "collaborator",
 *   name: "Collaborator",
 *   type: "person",
 *   description: "Authenticated via GitHub OAuth",
 *   inherits: ["reader"],
 *   capabilities: ["git-read", "git-push", "lean-toolchain"],
 * };
 * ```
 */
export interface ActorDefinition {
  /** Unique identifier (used as reference key). */
  id: string;
  /** Display text. `title`/`description`, like every KG node — see `schemas/kg/kg-node.ts`. */
  title: string;
  /** Human, agentic or mechanical — see {@link ActorKind}. */
  kind: ActorKind;
  /** What this actor can do. */
  description: string;
  /**
   * @deprecated An actor does not inherit; a **role** does.
   *
   * This field carried a role lattice under an actor's name — `author`
   * inherits `reviewer` inherits `viewer` — which is a property of a position,
   * not of a person. The lattice now lives in `scenarios/roles.json`
   * (`schemas/process/role-graph.ts`), where `inherits` means what it says. Optional
   * so an unmigrated registry still validates.
   */
  inherits?: string[];
  /**
   * Roles this actor may take on — ids from the role graph.
   *
   * An actor performs a task in a process **as a role**; this says which roles
   * are open to it. Absent means unstated (nothing is asserted); `[]` means it
   * takes on none, which is the honest value for a read-only identity that
   * never appears in a swimlane.
   */
  roles?: string[];
  /**
   * PERMISSION ids — what this actor is allowed to do, independent of process.
   *
   * Split out of {@link ActorDefinition.capabilities} in 2026-09 (bean `ind9`),
   * which had been carrying three different things at once. A permission
   * travels with the PARTICIPANT and cross-cuts roles: `content-authoring` is
   * held by actors taking on five different roles, and `admin` holds
   * `admin-settings` in every lane it acts in. Declared in
   * `skills/permissions/permissions.json`.
   */
  permissions?: string[];
  /**
   * Capability IDs directly granted to this actor.
   *
   * ENVIRONMENT PROBES only — each has `detection: { method: … }` and answers
   * "is this available on the machine". Not permissions (see above) and not
   * skills: a skill is what the performer needs to KNOW and belongs to the
   * lane's role.
   */
  capabilities: string[];
  /**
   * What this participant can reach off its own machine — `internet`,
   * `egress-restricted` or `air-gapped`.
   *
   * The same vocabulary the deployment declares ({@link Topology.network} in
   * `cat-harness.ts`), at the level the owner asked for it: *"some of the
   * machine actors may be air-gapped, it is a property of an actor"*.
   *
   * It is not a capability, and the distinction is the one bean `ind9`
   * settled. A capability is an ENVIRONMENT PROBE — `detection: { method:
   * "command", … }`, a thing you run to find out. Reach is an architectural
   * fact about the host, declared by whoever built the site; probing for it
   * would ask the network a question the network is precisely unable to
   * answer on an air-gapped box, where the probe is indistinguishable from
   * an outage. A capability that *needs* egress would say so with `requires`
   * instead. None does yet: no `network-egress` capability is declared in
   * `cat-harness/scenarios/capabilities/` (checked 2026-09-30, when this line
   * named that file as if it existed).
   *
   * Absent means UNDECLARED, which is not `internet`. Composition with the
   * deployment value — asymmetric, and `unknown` as a third state — is in
   * `schemas/process/actor-reach.ts`.
   */
  reach?: NetworkReach;
  /**
   * The system-under-test facet — present when this actor can be executed
   * against a `test-plan/v1` (bean `3o5b`). `agent` and `system` actors only;
   * reach is the actor's own {@link ActorDefinition.reach}, never restated.
   * See `SystemUnderTestFacetSchema` in `skill-package.ts`.
   */
  systemUnderTest?: SystemUnderTestFacet;
  /** Arbitrary metadata (e.g., MCP endpoint, config path). */
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * How to detect whether a capability is available at runtime.
 *
 * | Method | Check |
 * |--------|-------|
 * | `command` | Run a shell command, check exit code |
 * | `env-var` | Check if an environment variable is set |
 * | `file-exists` | Check if a file/directory exists |
 * | `mcp-probe` | HTTP health check against an MCP endpoint |
 * | `always` | Capability is always available |
 */
export type CapabilityDetection =
  | { method: "command"; command: string; expectExitCode?: number }
  | { method: "env-var"; variable: string }
  | { method: "file-exists"; path: string }
  | { method: "mcp-probe"; endpoint: string; healthPath?: string }
  | { method: "always" };

/**
 * A concrete capability that can be probed at session start.
 *
 * Capabilities represent environmental prerequisites: is Lean installed?
 * Is the MCP server reachable? Can we push to git?
 *
 * @example
 * ```ts
 * const leanToolchain: CapabilityDefinition = {
 *   id: "lean-toolchain",
 *   name: "Lean 4 Toolchain",
 *   description: "Lean 4 compiler and Lake build system",
 *   detection: { method: "command", command: "lean --version" },
 * };
 * ```
 */
export interface CapabilityDefinition {
  id: string;
  name: string;
  description: string;
  /** How to detect this capability at runtime. */
  detection: CapabilityDetection;
  /** Other capability IDs this one depends on. */
  requires?: string[];
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/**
 * A reference from a skill to a required capability, with a
 * degradation strategy when the capability is unavailable.
 *
 * | Strategy | Behavior |
 * |----------|----------|
 * | `fail` | Skill cannot execute — abort with error |
 * | `warn` | Log a warning but continue |
 * | `skip` | Silently skip this skill |
 * | `fallback` | Use the capability's `fallbackTo`, or a derived human lane |
 *
 * ## A fallback may be another ACTOR, not only another tool — and it is DERIVED
 *
 * Until 2026-09-20 the only fallback was `fallbackCapabilityId` — always
 * another capability. So the model could express *use a different tool* and
 * could not express *use a different kind of participant*, and the case the
 * owner raised was unrepresentable:
 *
 * > "some of the machine actors may be air-gapped, it is a property of an
 * > actor. depending on the propeorty, different tools might not work. in
 * > this case an API wouldnt wokr and a human actor is needed."
 *
 * When no tool can do it, the answer is a **person**. A `fallbackRole` field
 * was added that day to say so, and **removed the same day** — bean
 * `folio-assistant-85e8`, on the owner's question: *"do we need fallbackRole,
 * can it be computed, i dont like duplicate data maintenace issues"*.
 *
 * **It can, exactly.** The diagram already carries it, executably:
 * `Gateway_SigningRoute` branches to `Task_HumanSign`, a `userTask`, in
 * `Lane_Human`, which names role `publication-manager` (`partitionElementRef`). So
 * the fallback role is *the role of a lane holding a task only a person can
 * fill* — `fulfilmentKindsForBpmnType`, which the diagram's own
 * documentation already relies on to stop the air-gapped route quietly
 * becoming another machine route.
 *
 * Measured before removing it: the derivation returns exactly the declared
 * value, and is unambiguous across the corpus — 3 of 3 skills with any
 * human-only lane have exactly one such role. `fallbackRoleFor` in
 * `scripts/check-fallback-roles.ts` is the query.
 *
 * **Why the declaration had to go rather than be checked.** It was one fact
 * in two places with nothing asserting they agreed, which is the drift this
 * repository keeps paying for. The argument for keeping it — declaration and
 * execution are different mechanisms — is real, and it is not enough: a
 * declaration that can be computed from the executable artefact is a cached
 * copy, and an unvalidated cache is worse than no cache.
 *
 * **Why not model "a human is available" as a capability**, which would have
 * reused the existing field: a `CapabilityDefinition` carries
 * `detection: { method: "command", … }` — a thing you PROBE the environment
 * for. A person is not probeable by a command, and bean
 * `folio-assistant-ind9` fixed exactly the error of putting non-probeable
 * things in `capabilities[]`. Reusing it would undo a completed fix.
 *
 * **What reads `degradation`, honestly. Nothing does.** Measured 2026-09-20:
 * 24 skill modules declare `requiredCapabilities` with 24 degradation values
 * (17 `fail`, 6 `fallback`, 1 `warn`). An earlier revision of this comment
 * said the only reader was `scripts/generate-docs.ts`, "which RENDERS them" —
 * too generous, and the more comfortable error, because a field with one
 * renderer sounds maintained while a field with none is inert. That script
 * was never invoked by anything, in any commit since the root commit, and
 * was RETIRED to `fsh-guts/scripts/` (bean `folio-assistant-3w0i`). So the
 * count of readers is ZERO.
 *
 * `degradation` is NOT duplicate data and was kept: `fail` says a skill
 * cannot run without the capability, which no diagram states. It needs a
 * reader, not a deletion.
 */
export interface SkillCapabilityRef {
  /** The capability this skill needs. */
  capabilityId: string;
  /** What to do when the capability is unavailable. */
  degradation: "fail" | "warn" | "skip" | "fallback";
  // No `fallbackCapabilityId`. What substitutes for a capability is a
  // property of THAT capability — `CapabilityDefinition.fallbackTo`, bean
  // `folio-assistant-sym3`. It was written in five skill modules, all
  // identical, which is the duplicate-maintenance shape: a sixth Lean skill
  // had to remember to repeat it.
  // NO `fallbackRole`. It existed for eight hours on 2026-09-20 and was
  // removed as a computable duplicate — see the header. The role that takes
  // over is `fallbackRoleFor(skill)`, read from the BPMN corpus, and
  // `check:fallback-roles` fails a `fallback` that resolves to neither a
  // declared capability nor a derivable human lane.
}

/**
 * A dependency from one skill to another skill or requirement.
 */
export interface SkillDependency {
  /** Target skill ID or requirement ID. */
  ref: string;
  /** Whether the dependency is on a skill or a requirement. */
  kind: "skill" | "requirement";
  /** How strongly this dependency is required. */
  conformance: Conformance;
}

/**
 * Reference to a schema type that this skill operates on.
 *
 * **RETIRED 2026-09-20 — kept as a type, removed from `SkillDefinition`.**
 *
 * Its stated purpose was *"enabling auto-generated documentation to
 * cross-reference skills with their data models"*. The generator that would
 * have done the cross-referencing was `scripts/generate-docs.ts`, which had
 * been in this repository since its ROOT COMMIT and **never ran once** —
 * never in a `package.json` script, never in a workflow, its output directory
 * never committed. It was retired to `fsh-guts/scripts/` (bean
 * `folio-assistant-3w0i`), and with it went the only code that referenced
 * this type.
 *
 * So 11 of 22 skill modules carried a declaration that reached no reader and
 * no page. The declarations are removed (`folio-assistant-t2yg`); the type
 * stays because a downstream layer may hold one and a removed export is a
 * breaking change for a field that costs nothing to leave declarable.
 *
 * **Reinstating it means writing the consumer first.** A field whose only
 * justification is a generator that does not run is how this one lasted.
 */
import type { ActorKind, LifecycleStage, SkillPackageManifest, SystemUnderTestFacet } from "../kg/skill-package.js";
import type { NetworkReach } from "../kg/cat-harness.js";

export interface SkillSchemaRef {
  /** Schema module (e.g., "schemas/types", "schemas/formalization-types"). */
  module: string;
  /** Type name(s) within the module. */
  types: string[];
  /** Whether this skill reads or writes these types. */
  access: "read" | "write" | "read-write";
}

/**
 * A skill is a named unit of agent capability with role-based access
 * control, capability requirements, and optional script implementations.
 *
 * Each skill has a companion `.md` file (agent instructions) and a
 * `.ts` file (structured metadata). The `.md` is for the agent to read;
 * the `.ts` is for programmatic registry, routing, and validation.
 *
 * @example
 * ```ts
 * const formalizer: SkillDefinition = {
 *   id: "formalizer",
 *   name: "Formalizer",
 *   description: "Lean proof generation and sorry-removal",
 *   roles: ["collaborator", "owner"],
 *   requiredCapabilities: [
 *     { capabilityId: "lean-toolchain", degradation: "fallback",
 *       fallbackCapabilityId: "lean-mcp" },
 *   ],
 *   mcpServices: ["lean-lsp"],
 *   schemas: [
 *     { module: "schemas/types", types: ["Block", "LeanRef"],
 *       access: "read-write" },
 *   ],
 * };
 * ```
 */
export interface SkillDefinition {
  /** Unique skill identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** What this skill does. */
  description: string;
  // NO `roles` (bean `y1w9`, deleted in #1168 B8): read by nothing, and the
  // inverse of `RoleDef.skills`. Record: `fsh-guts/retired/skill-definition-roles.md`.
  /** Capabilities this skill needs to function. */
  requiredCapabilities: SkillCapabilityRef[];
  /** Dependencies on other skills or requirements. */
  dependsOn?: SkillDependency[];
  /** Tools the agent is allowed to use when this skill is active. */
  allowedTools?: string[];
  /** Regex patterns for routing user requests to this skill. */
  routingPatterns?: string[];
  /** Searchable tags. */
  tags?: string[];
  /** External package this skill belongs to (undefined = local). */
  package?: string;
  // `schemas?: SkillSchemaRef[]` was here until 2026-09-20. Removed with the
  // generator that was its only reader — see {@link SkillSchemaRef}. Not
  // re-add without the consumer: the field existed for a page nobody ever
  // built.
  /**
   * Lifecycle stages this skill participates in.
   *
   * Present on all 18 skill definitions on disk and on `SkillDefinitionSchema`,
   * but missing here — so `generate-docs.ts`, the only thing that named it,
   * had to read it off an `any`. That script never ran and was retired to
   * `fsh-guts/scripts/` on 2026-09-20, so nothing reads this field now.
   */
  lifecycleStages?: LifecycleStage[];
  // No `schemaRef` (#1168, B3b): a skill names its contracts in its front
  // matter (`input:`/`output:`), read by `scripts/skill-contracts.ts`.
}

// ---------------------------------------------------------------------------
// Requirements (FHIR R5–aligned)
// ---------------------------------------------------------------------------

/**
 * A single testable statement within a requirement.
 *
 * Each statement has a conformance verb (SHALL/SHOULD/MAY). What satisfies
 * it points at it — `satisfies: ["req:<id>#<key>"]` on a skill or capability
 * — and the statement names none of them (#1168).
 *
 * @example
 * ```ts
 * {
 *   key: "REQ-SS-1",
 *   label: "Identity detection",
 *   conformance: "SHALL",
 *   requirement: "Detect user identity via git config or OAuth",
 * }
 * ```
 */
export interface RequirementStatement {
  /** Unique key within this requirement (e.g., "REQ-SS-1"). */
  key: string;
  /** Short human-readable label. */
  label: string;
  /** FHIR conformance verb. */
  conformance: Conformance;
  /** Full requirement text. */
  requirement: string;
  /** Actors this statement applies to (defaults to parent's actors). */
  actors?: string[];
  /** Keys of other statements this one depends on. */
  dependsOn?: string[];
}

/**
 * A requirement is a group of related testable statements that
 * constrain workflow behavior.
 *
 * Modeled after the
 * [FHIR R5 Requirements resource](https://hl7.org/fhir/R5/requirements.html):
 * each requirement has actors, statements with conformance verbs,
 * and traceability via `derivedFrom`; what satisfies a statement names it.
 *
 * @example
 * ```ts
 * const sorryCitation: Requirement = {
 *   id: "req-sorry-citation",
 *   title: "Sorry Citation Requirement",
 *   description: "Every sorry must have a bibliographic citation",
 *   actors: ["collaborator", "owner"],
 *   statements: [{
 *     key: "REQ-SC-1",
 *     conformance: "SHALL",
 *     requirement: "sorry preceded by -- Ref: [key] <url>",
 *   }],
 * };
 * ```
 */
export interface Requirement {
  /** Unique requirement identifier. */
  id: string;
  /** Human-readable title. */
  title: string;
  /** What this requirement governs. */
  description: string;
  /** IDs of requirements this one derives from. */
  derivedFrom?: string[];
  /** Actor IDs this requirement applies to. */
  actors: string[];
  /** Testable statements within this requirement. */
  statements: RequirementStatement[];
  /** Searchable tags. */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Reference to an external skill package synced into `.claude/skills/<name>/`.
 */
export interface SkillPackageRef {
  /** Package name (matches directory under `.claude/skills/`). */
  name: string;
  /** Source repository (e.g., "K-Dense-AI/claude-scientific-skills"). */
  repo: string;
  /** Path within the source repo. */
  path: string;
  /** Git ref to sync from (commit hash preferred). */
  ref: string;
  /** Skill IDs provided by this package. */
  skills: string[];
  /** Path to the package's `PackageManifest` for Docker deps. */
  manifestPath?: string;
}

/**
 * A lifecycle hook that runs shell commands on specific events.
 */
export interface SessionHook {
  /** The event that triggers this hook. */
  event:
    | "SessionStart"
    | "PostToolUse"
    | "PreCommit"
    | "PostCommit"
    | "UserPromptSubmit";
  /** Tool name regex matcher (for PostToolUse). */
  matcher?: string;
  /** Commands to execute when the event fires. */
  commands: HookCommand[];
}

/**
 * A single command within a session hook.
 */
export interface HookCommand {
  type: "command";
  /** Shell command to execute. */
  command: string;
  /** Timeout in seconds. */
  timeout?: number;
}

/**
 * Maps a user identity pattern to an actor (role assignment).
 *
 * Evaluated in priority order (highest first). The first matching
 * rule determines the user's actor.
 */
export interface RoleAssignment {
  /** Glob pattern matched against the user identifier. */
  userPattern: string;
  /** How the user's identity was determined. */
  identitySource:
    | "git-config"
    | "github-oauth"
    | "google-oauth"
    | "env-var"
    | "bearer-token"
    | "default";
  /** Actor ID to assign. */
  actorId: string;
  /** Higher priority wins. */
  priority: number;
}

/**
 * The top-level registry: one per repository.
 *
 * Aggregates all actors, capabilities, skills, requirements, external
 * packages, and lifecycle hooks into a single typed manifest.
 *
 * The registry is the **root object** for the assistant framework.
 * It is defined in TypeScript (`.claude/skills/registry.ts`) and can
 * be serialized to JSON (`registry.json`) for tooling consumption.
 */
export interface SkillRegistry {
  /** Schema version for forward compatibility. */
  schemaVersion: "1.0";
  /** Repository identifier (e.g., "litlfred/qou"). */
  repository: string;
  /** All actor/role definitions. */
  actors: ActorDefinition[];
  /** All capability definitions. */
  capabilities: CapabilityDefinition[];
  /** All skill definitions (local + packaged). */
  skills: SkillDefinition[];
  /** All workflow requirements. */
  requirements: Requirement[];
  /**
   * Skill packages under `skills/`, with their Docker requirements.
   *
   * Declared `SkillPackageRef[]` until now — the type for an *external*
   * package synced in from another repo, requiring `repo`/`path`/`ref`. The
   * generator has only ever put local `skills/<name>/package-manifest.json`
   * files here, which carry none of those, so no generated registry has ever
   * satisfied `SkillRegistrySchema`: 15 issues, all `packages.N.{repo,path,ref}
   * Required`. Nothing noticed because the generator's own output type was
   * `any[]` and nothing validated the result. `scripts/tests/registry.test.ts`
   * now does.
   *
   * External packages are `RemotePackageRef`s under `skills/remote-packages/`;
   * they are rendered into the docs but are not yet part of the registry.
   */
  packages: SkillPackageManifest[];
  /** Lifecycle hooks. */
  hooks: SessionHook[];
  /** Identity-source → actor mapping rules, evaluated by priority (highest first). */
  roleAssignments: RoleAssignment[];
}
