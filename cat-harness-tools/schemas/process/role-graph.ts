/**
 * Actors, Roles and Skills — who does a BPMN task, and what they need to know.
 *
 * - **Actor** — a concrete participant. Human or agentic. `litlfred` is an
 *   actor; so is the ingestion engine. An actor exists independently of any
 *   process and persists across all of them.
 * - **Role** — a persona an actor **takes on** because of the lane it is
 *   acting in. `Reviewer` is a role; nobody *is* a reviewer outside a process.
 *   A role carries a collection of **Skills**. **A lane names the Role its
 *   tasks are performed in**, not the actor.
 * - **Skill** — a responsibility an actor carries out to complete a task: as
 *   instructions to follow, as a contract to be tested against, or both.
 *
 * So: **an actor performs a task in a process as a role, using that role's
 * skills.** Every word in that sentence is a distinct object here, and the
 * audit in `scripts/kg-audit.ts` checks each join in it.
 *
 * A lane names a role because the same actor acts in different lanes of
 * different diagrams (`Lane_Agent` in `crdm-requirements.bpmn`,
 * `Lane_Sibling` in `bean-lifecycle.bpmn`), and its skills differ with the
 * lane.
 *
 * ## Actors carry roles, not `inherits`
 *
 * An actor names the roles it may take on in `roles[]`; the `inherits`
 * lattice belongs to roles. {@link readActors} reports an actor carrying
 * `inherits` via {@link LoadedActor.looksLikeRole}, and the
 * `actor-is-not-a-role` criterion fails on one.
 *
 * `roles: []` and an absent `roles` are **different**: `[]` says the actor
 * takes on no role (a read-only identity that never appears in a swimlane),
 * while absent says nothing has been asserted.
 *
 * ## Hierarchy: roles compose down a subprocess chain
 *
 * A process calls a subprocess, and the actor keeps acting. It does not stop
 * being the outer role; it **additionally** takes on the inner lane's role. So
 * the skills available at a task are the union along the whole call path.
 * {@link resolveRoleStack} computes that union and keeps the path, so a reader
 * sees *which* role supplied each skill.
 *
 * Two distinct compositions, deliberately not merged:
 *
 * - `inherits` — a role IS-A role. `qc-reviewer` inherits `reviewer`, and gets
 *   its skills, everywhere, in every process. Static.
 * - the subprocess **stack** — a role is acting INSIDE another role's task.
 *   Dynamic, and only for the duration of that call.
 *
 * Merging them would give `reviewer` every skill any caller ever had.
 *
 * ## A lane binds its role explicitly
 *
 * Lane names are free text, so a LANE names the role it binds — see
 * {@link laneRoleRef}. The role does not list its lanes: a general node never
 * names its users (`data-modelling` step 8). An unbound lane is a finding.
 *
 * The binding is BPMN's own: the lane's `partitionElementRef` points at a
 * top-level `<bpmn:resource>` whose `id` IS the role id.
 * `<bootstrap.processes:role ref>` is still accepted, with a warning.
 *
 * ## Roles played by mechanical actors are real roles
 *
 * A build pipeline, a data store, a log or a registry plays a role, and that
 * role's skills are its **contract**: the responsibilities it must perform,
 * which a test can hold it to.
 *
 * ## Three states
 *
 * Absent declaration → `undefined`, and callers fall back to documented
 * defaults. Present but unparseable → **throws**, because a role graph nobody
 * can read leaves every consumer assigning tasks to nobody. An unknown
 * `actorKinds` or a dangling `inherits` → rejected at read, not accepted and
 * ignored.
 *
 * @module schemas/role-graph
 * @graphNode schema
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { kgNodeLabelShape } from "../kg/kg-node";
import { join } from "node:path";
import { z } from "zod";
import { RepoFullNameSchema } from "../kg/repo-full-name.js";
import { ODRL_ACTIONS } from "../content/odrl";

import { termIri } from "../kg/namespaces";
import { ACTOR_KINDS, SUT_ACTOR_KINDS, SystemUnderTestFacetSchema, type ActorKind, type SystemUnderTestFacet } from "../kg/skill-package";
import { NETWORK_REACHES, directoryForGraph, findInstanceRoot, ownPrefixTable, type NetworkReach } from "../kg/cat-harness";
import { findDeclarationFile, layerRootNamed, repoRootFor } from "../kg/instance-roots";
import { SkillNameSchema } from "../tools/tool-types";
import { ModelCapabilitiesSchema, type ModelCapabilities } from "../conduct/model-capabilities.js";

/** Directory, relative to the `kg` graph root, holding the role declaration. */
export const ROLE_GRAPH_DIR = "roles";
/** Filename carrying the role graph. */
export const ROLE_GRAPH_FILENAME = "roles.json";

// ── Actors ──────────────────────────────────────────────────────

/**
 * What kind of thing an actor is — **human, agentic or mechanical**, plus
 * `external` for a participant outside this layer entirely.
 *
 * Those three words are the author's; `person`, `agent` and `system` are the
 * ids they are spelled with here, and the mapping is one-to-one:
 *
 * | id | the kind it names | what it can be handed |
 * |---|---|---|
 * | `person` | **human** | a skill to read, and a judgement to make |
 * | `agent` | **agentic** | a skill to read, and a judgement to make |
 * | `system` | **mechanical** | a program to run, and nothing to decide |
 * | `external` | outside this layer | nothing — it is not ours to task |
 *
 * There is deliberately no second vocabulary carrying the author's words. Two
 * spellings of one concept is the drift this repository keeps paying for, and
 * a `fulfilment: "mechanical"` field beside `actorKinds: ["system"]` would be a
 * fresh instance of it. The words live in this table; the ids live in the data.
 *
 * ## Why agentic and mechanical must not be one kind
 *
 * **An agent exercises judgement; a mechanical system executes a procedure.**
 * That is the whole difference, and it decides what a task may be handed to:
 * a step requiring a judgement call cannot be given to a build pipeline, and a
 * step that is a fixed program does not need — and should not claim — a reader.
 *
 * The registry said so in prose long before anything could read it.
 * `ci-pipeline`'s own description: *"It runs a fixed program and exercises no
 * judgement, so anything needing a decision belongs in another lane."*
 * `review-agent`'s: *"LLM agent performing NON-MECHANICAL validation …
 * judgement calls escalate to a human reviewer."* Both sentences state the
 * distinction; neither was machine-readable, because every actor file carried
 * a two-valued `type` (`person` or `system`) that collapsed them. Measured
 * 2026-09-19 before the split: **16 `person`, 8 `system`**, with the 8 holding
 * five agents and three mechanical services.
 *
 * That is the same failure `judgementOnly` was introduced for one level up —
 * a load-bearing rule recorded only in a summary, which a later pass is free to
 * re-litigate. See {@link RoleDef.judgementOnly}.
 *
 * ## One vocabulary, re-exported rather than restated
 *
 * The values live in `schemas/kg/skill-package.ts`, the dependency-free base that
 * the registry schema reads. They were declared TWICE until 2026-09-19 — four
 * kinds here, two (`person`, `system`) there — and the registry validated
 * `.claude/skills/actors/*.json` against the narrower one, so the four-kind
 * vocabulary could not be used by the files it was written for. Re-exported so
 * there is one place to change and one answer to give.
 */
export { ACTOR_KINDS, type ActorKind };

/**
 * Kinds that can be handed an instruction body and asked to exercise judgement.
 *
 * The union of **human** and **agentic**. Derived from {@link ACTOR_KINDS}
 * rather than written out again, so a kind added there cannot go unclassified —
 * the same rule `DOCUMENT_BLOCK_KINDS` follows against `BLOCK_KINDS`.
 */
export const JUDGEMENT_KINDS: readonly ActorKind[] = ACTOR_KINDS.filter(
  (k) => k === "person" || k === "agent",
);

/** Kinds that run a fixed program: **mechanical**. */
export const MECHANICAL_KINDS: readonly ActorKind[] = ACTOR_KINDS.filter((k) => k === "system");

/**
 * Which actor kinds may fulfil an activity, **derived from its BPMN type**.
 *
 * BPMN already answers this and the corpus was not reading the answer. The
 * spec's own semantics:
 *
 * - `bpmn:UserTask` — *"performed by a human being with the assistance of a
 *   software application"*. Only a **human** fulfils one.
 * - `bpmn:ServiceTask` — *"uses some sort of service … a Web service or an
 *   automated application"*, with no human in the loop. An **agentic** or
 *   **mechanical** actor fulfils one.
 * - `bpmn:Task` — the abstract task. It says nothing, so neither does this:
 *   `undefined` means unconstrained, not "no kind may fulfil it".
 * - `bpmn:CallActivity` — the constraint belongs to the steps of the process it
 *   calls, each of which is checked in its own diagram. Also unconstrained.
 *
 * `undefined` rather than `ACTOR_KINDS` so a caller can tell "every kind is
 * allowed" from "nothing was asserted" — the third state this repository
 * insists on everywhere else. A declared `<cat-harness.processes:fulfilment/>` overrides it.
 */
export function fulfilmentKindsForBpmnType(bpmnType: string): readonly ActorKind[] | undefined {
  if (bpmnType === "bpmn:UserTask") return JUDGEMENT_KINDS.filter((k) => k === "person");
  if (bpmnType === "bpmn:ServiceTask") return ACTOR_KINDS.filter((k) => k === "agent" || k === "system");
  return undefined;
}

/**
 * A concrete participant — the thing that persists across processes.
 *
 * Deliberately thin. An actor is an identity plus what kind of thing it is;
 * everything about *what it can do* belongs to the role it takes on. Anything
 * richer here recreates the confusion this module exists to end.
 */
export interface ActorDef {
  id: string;
  /** Display text. See `schemas/kg/kg-node.ts` — `title`/`description` everywhere. */
  title: string;
  kind: ActorKind;
  description?: string;
  /**
   * Roles this actor is eligible to take on. Advisory, not a permission
   * system: it says who is expected in a lane, and the audit uses it to report
   * a role no actor can fill. Empty means "unconstrained", not "none".
   */
  roles?: string[];
}

// ── Roles ───────────────────────────────────────────────────────

/** A role — the part a BPMN lane names, as a declared object. */
export interface RoleDef {
  /**
   * Stable id. It is the `id` of the `<bpmn:resource>` a lane's
   * `partitionElementRef` points at, verbatim, and what `inherits` names.
   */
  id: string;
  /**
   * Display text, and the `name` of that `<bpmn:resource>`. Not used for
   * matching: a lane binds by id.
   *
   * `title` and `description` rather than `name` and `summary`: they are the
   * two labels EVERY knowledge-graph node carries (`schemas/kg/kg-node.ts`), and a
   * role spelling them differently from a directory or a Tool meant a consumer
   * had to know which kind of node it held before it could print one.
   */
  title: string;
  description: string;
  /**
   * Which kinds of actor may take this role on. `external` marks a participant
   * outside the layer's control (a registry, a third-party service).
   *
   * A SET, not one kind, and the corpus is what settled it. `reviewer` carried
   * `person` alone while `review-agent`'s own description says it performs
   * review and escalates only the judgement calls, and while
   * `editing-hci-validation.bpmn` draws `Task_AgentReview` — "Agent review of
   * the change" — inside that very lane. One kind per role made both of those
   * defects rather than facts, and the only way to record them was to widen
   * the role.
   *
   * Non-empty by construction: an empty list would read as "no actor may take
   * this role", which is not a role. That is the same third-state care
   * `fulfilmentKindsForBpmnType` takes in returning `undefined` rather than
   * `[]` for a task type that asserts nothing.
   *
   * It is a SET on the role and a SINGLE kind on the actor, deliberately. An
   * actor IS one kind of thing; a role ADMITS several. Collapsing either into
   * the other loses a distinction the graph is built on.
   */
  actorKinds: ActorKind[];
  /**
   * Who this reader IS, in prose — the persona an author writes for and a QA
   * reviewer checks against.
   *
   * `summary` says what the role DOES. That is enough to draw a swimlane and
   * not enough to write for: it does not say what they already know, what they
   * came to find out, or what would make the page useless to them. An author
   * given only "Writes and revises folio content" will write for nobody in
   * particular, and a QA criterion about jargon or assumed background has no
   * standard to judge against.
   *
   * This is the audience. It is NOT restated per block: a block sits in a
   * lane, the lane names the role, the role carries the persona. Copying it onto
   * every block would invite the two to disagree, and a per-block audience
   * that contradicts its lane is worse than none — it looks authoritative.
   */
  persona?: string;
  /**
   * Other names this role goes by today — synonyms, local titles, examples.
   * The same field, and the same meaning, as `otherNames` on WHO SMART Base's
   * Generic Persona ("Other names or examples for the persona"); published as
   * `skos:altLabel`. Owner, 2026-09-30: *"model both retired names and
   * alternative names"*.
   */
  otherNames?: string[];
  /**
   * Names this role was known by and no longer is, each with the date it was
   * retired — `Initiator` became `Bootstrapping Agent` on 2026-09-23.
   * Published as `skos:hiddenLabel` on this role, and the old name's concept
   * is `owl:deprecated` and `dcterms:isReplacedBy` this role, so a reader
   * holding the old name is sent to the new one. Authored here, beside the
   * definition, rather than only remembered by the harness's glossary ledger:
   * a retired name is part of what the role IS to a reader of old text.
   */
  formerNames?: FormerName[];
  // No `voice` and no `useCases` (#1168, B2). Both are DEPENDENTS of the
  // role: a voice is addressed TO a reader, and a story is told AS one. Each
  // now points here — a voice profile by `activeIn.roles`, a user story by
  // `role` in `scenarios/stories.json` — so the role names neither, and a new
  // voice or story is added without editing the role (data-modelling step 8).
  /** Skills available to an actor in this role, before inheritance. */
  skills: string[];
  /** Roles this one IS-A. Skills are unioned transitively; cycles rejected. */
  inherits?: string[];
  /**
   * The role PERFORMS, but by judgement — no instruction body implements its
   * steps, and naming one would be a lie about what the role does.
   *
   * A stakeholder acts, deliberates and is accountable for the outcome — they
   * simply cannot be handed a procedure that produces the answer. That is not
   * a mechanical role's case: a store or a pipeline has no judgement to
   * exercise, and its skills are a contract it can be tested against. `stakeholder`'s own summary has said so in
   * prose since the role graph was written:
   *
   *   > Carries no skills deliberately: sign-off is a judgement, not a
   *   > procedure, and a skill here would suggest an agent could supply it.
   *
   * That prose was load-bearing and unreadable by anything. A later pass
   * measured four `activity-names-skill` findings on the stakeholder lane and
   * came within one commit of "fixing" them by giving the role a skill —
   * which would have re-entered exactly the dead end the summary closed. The
   * flag is that sentence made machine-readable, so the next pass is stopped
   * by the graph rather than by whether it happened to read a summary.
   *
   * Effect: `activity-names-skill` records `n/a` for activities in this
   * role's lanes, which is what lets the criterion GATE on the undeclared
   * ones instead of staying advisory for ever.
   */
  judgementOnly?: boolean;
  /**
   * Minimum model capabilities required by this role when performed by an agent/model.
   * If a single model lacks these capabilities, the workflow refuses rather than degrades.
   */
  requiredCapabilities?: ModelCapabilities;
  /**
   * Present when this role is a DATA STORE: a place where things are kept,
   * played by a mechanical actor (owner, 2026-11-01, Q-DS-1 A). It stays a
   * Role, so its `skills` are still its contract (owner, 2026-10-16), and the
   * role id is the store id a diagram's `dataStoreReference` points at
   * (Q-DS-3 A). See {@link StoreDef}.
   */
  store?: StoreDef;
  /**
   * For a lane one session holds at a time, such as the merge steward: when
   * the lane is needed at all, how sibling sessions choose its holder, and
   * whether a lone session holds it for itself (owner rulings, 2026-11-07).
   * See {@link LaneHolding}, {@link laneNeeded} and {@link electHolder}.
   */
  holding?: LaneHolding;
}

/**
 * The API styles a store's interface can be documented in. Each transport
 * keeps its own standard format (owner, 2026-11-01, Q-DS-2 A):
 *
 * - `openapi` — an HTTP API, as an OpenAPI 3 document;
 * - `fhir-capability` — a FHIR server, as a CapabilityStatement;
 * - `graphql` — a GraphQL schema (SDL), e.g. beans' `schema.graphqls`;
 * - `cli` — harness tools (`tool-definition/v1`) that read or write it;
 * - `json-schema-files` — files in git, as a typology and its JSON Schema;
 * - `git` — a git repository read through the git CLI or a forge's API.
 */
export const STORE_API_STYLES = ["openapi", "fhir-capability", "graphql", "cli", "json-schema-files", "git"] as const;
export type StoreApiStyle = (typeof STORE_API_STYLES)[number];

/** One documented interface of a store. */
export interface StoreApi {
  style: StoreApiStyle;
  /**
   * The API's own document: a URL or an instance-relative path. Held as the
   * API's authors wrote it, never restated (the `openapi` subgraph's rule).
   * Absent for `cli`, which names its tools instead.
   */
  document?: string;
  /** For `cli`: the harness tool ids that read or write the store. */
  tools?: string[];
}

/**
 * What a store keeps and how it is reached. Its behaviour is NOT here: that is
 * the role's contract skills, each naming its tests in `tested-by:`.
 */
export interface StoreDef {
  /** The typologies (graph kinds) it holds, by id, e.g. `bean-defs`. */
  holds?: string[];
  /** Its interfaces, one per transport. */
  api?: StoreApi[];
  /** The actor that plays it, e.g. `beans`, `git`, `google-sheets`. */
  realisedBy?: string;
  /** Whether what it keeps reaches a published graph. The activity log does not. */
  published?: boolean;
}

/**
 * Why `role` cannot declare a store, or undefined when it can. A store is
 * kept, not performed: only a role a machine or an outside party plays can be
 * one (owner, 2026-11-01, Q-DS-1 A). Checked by {@link readRoleGraph}.
 */
export function storeRoleError(role: Pick<RoleDef, "id" | "actorKinds" | "store">): string | undefined {
  if (!role.store) return undefined;
  if (role.actorKinds.every((k) => k === "system" || k === "external")) return undefined;
  return `role "${role.id}" declares a store but admits ${role.actorKinds.join(", ")} actors; a store is played by system or external actors only.`;
}

export const StoreApiSchema = z.object({
  style: z.enum(STORE_API_STYLES),
  document: z.string().min(1).optional(),
  tools: z.array(z.string().min(1)).min(1).optional(),
}).strict();

export const StoreDefSchema = z.object({
  holds: z.array(z.string().min(1)).optional(),
  api: z.array(StoreApiSchema).optional(),
  realisedBy: z.string().min(1).optional(),
  published: z.boolean().optional(),
}).strict();

/** The declared role graph. */
export interface RoleGraph {
  name: string;
  roles: RoleDef[];
  /** Actors, when declared alongside. Usually read from the actor directory. */
  actors?: ActorDef[];
  /**
   * Roles of a LOWER layer this graph adds skills to, BY ID (placement
   * PR0b, bean `ejye`). See {@link RoleExtension}.
   */
  extensions?: RoleExtension[];
}

/**
 * A higher layer adding skills to a role a lower layer declares.
 *
 * The extension POINTS AT the role, the way a voice points at the role it
 * addresses (`activeIn.roles`) and a user story at the role it is told as
 * (#1168): the dependent holds the pointer, so the role is added to without
 * being edited, and the lower layer never names anything above it. That
 * is what lets a role→skill edge naming a core or sci skill move UP with its
 * skill (placement PR1–PR4) instead of staying in the harness as an upward
 * reference.
 *
 * It ADDS and overrides nothing: no title, description, `inherits`,
 * `actorKinds` or persona. The same id-matching rule as a directory override
 * and as `inherits`. It does NOT restore `roles:` in skill front matter
 * (beans `tuvg`, `v625`) — the edge lives on the role graph, as before.
 */
export interface RoleExtension {
  /** The id of a role declared by a layer this one depends on. */
  role: string;
  /** Skills the role gains in this layer's checkout. */
  skills: string[];
}

export const RoleExtensionSchema = z
  .object({
    role: z.string().min(1),
    skills: z.array(SkillNameSchema).min(1),
  })
  .strict();

/**
 * @general — a node others depend on: it points only at other general nodes,
 * never at its dependents (data-modelling step 8; checked by `arrow-direction`).
 */
export const ActorDefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(ACTOR_KINDS),
  description: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

/**
 * @general — a node others depend on: it points only at other general nodes,
 * never at its dependents (data-modelling step 8; checked by `arrow-direction`).
 */
/** A name a role no longer goes by, and when it stopped. */
export interface FormerName {
  name: string;
  /** ISO date (YYYY-MM-DD) the name was retired. */
  retiredOn: string;
}

export const FormerNameSchema = z
  .object({
    name: z.string().min(1),
    retiredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "an ISO date, YYYY-MM-DD"),
  })
  .strict();

/**
 * The election rules, applied in order: each narrows the candidates, and
 * the last tie is broken by session id, so two sessions reading the same
 * listing always choose the same holder.
 *
 * - `owns-p0`: keep the sessions that own a P0 PR (the fix for a red main,
 *   or the re-pin chain), when any does.
 * - `earliest-created`: keep the earliest-created session.
 */
export const ELECTION_RULES = ["owns-p0", "earliest-created"] as const;
export type ElectionRule = (typeof ELECTION_RULES)[number];

/**
 * When a lane held by one session at a time is needed, and who holds it.
 *
 * Owner rulings, 2026-11-07: "merge manager needed if lots of conflicting CI
 * runners causing merge slowdown"; "if no merge manager, siblings
 * self-determine which will play that role"; "if single, can merge manage
 * self". The condition is measured, never asserted: {@link laneNeeded}
 * reads it from live numbers.
 */
export const LaneHoldingSchema = z
  .object({
    neededWhen: z
      .object({
        /** At least this many active sessions have ready PRs in the same repositories. */
        minActiveSessions: z.number().int().min(2),
        /** Contention: more queued runs than this on a repository... */
        maxQueuedRuns: z.number().int().min(0),
        /** ...or the oldest queued run older than this many minutes... */
        maxOldestQueuedMinutes: z.number().min(0),
        /** ...or, when true, PRs that conflict with or supersede each other. */
        conflictsCount: z.boolean(),
      })
      .strict(),
    /** Applied in order by {@link electHolder}. */
    election: z.array(z.enum(ELECTION_RULES)).min(1),
    /** A session alone in its coordination group holds the lane for itself. */
    loneSessionHolds: z.boolean(),
    /** What the holder announces to every sibling and the owner, e.g. `merge manager: <session id>`. */
    announce: z.string().min(1),
    /** The holder acknowledges each request, and posts a heartbeat, within this many minutes. */
    heartbeatMinutes: z.number().int().min(1),
    /** A session silent for longer than this is stalled: not a candidate, and its lane is vacant. */
    stalledAfterMinutes: z.number().int().min(1),
  })
  .strict();
export type LaneHolding = z.infer<typeof LaneHoldingSchema>;

/** The live numbers {@link laneNeeded} reads; never stored. */
export interface LaneReading {
  /** Active sessions with ready PRs in the same repositories. */
  activeSessions: number;
  /** The most queued runs on any one of those repositories. */
  queuedRuns: number;
  /** Age of the oldest queued run, in minutes (0 with none queued). */
  oldestQueuedMinutes: number;
  /** Open PRs that conflict with or supersede another open PR. */
  conflictingPrs: number;
}

/**
 * Whether the lane is needed now: enough active sessions AND contention,
 * where contention is either runner bound crossed or, if counted,
 * conflicting PRs. When it is false the lane lapses and each session merges
 * its own green PRs with the owner's approval.
 */
export function laneNeeded(holding: LaneHolding, r: LaneReading): boolean {
  const w = holding.neededWhen;
  if (r.activeSessions < w.minActiveSessions) return false;
  return (
    r.queuedRuns > w.maxQueuedRuns ||
    r.oldestQueuedMinutes > w.maxOldestQueuedMinutes ||
    (w.conflictsCount && r.conflictingPrs > 0)
  );
}

/** One active session that could hold the lane. */
export interface HolderCandidate {
  sessionId: string;
  /** ISO 8601 creation time, as `list_sessions` reports it. */
  createdAt: string;
  /** It owns a P0 PR: the fix for a red main, or a link of the re-pin chain. */
  ownsP0: boolean;
  /** Minutes since it last answered or posted a heartbeat; unknown counts as live. */
  minutesSinceAnswer?: number;
}

/**
 * Whether a session has stalled: silent for longer than the lane's stall
 * window. Any agent may stall, the holder included (owner ruling,
 * 2026-11-07); a sibling whose request goes unacknowledged that long treats
 * the lane as vacant and re-elects without it.
 */
export function isStalled(holding: LaneHolding, minutesSinceAnswer: number | undefined): boolean {
  return minutesSinceAnswer !== undefined && minutesSinceAnswer > holding.stalledAfterMinutes;
}

/**
 * The session that holds the lane, chosen deterministically from the active
 * candidates, or `undefined` with none. Stalled sessions are not
 * candidates. A lone candidate holds it when `loneSessionHolds`; otherwise
 * the election rules narrow the field in order and the session id breaks the
 * last tie.
 */
export function electHolder(holding: LaneHolding, all: HolderCandidate[]): string | undefined {
  const candidates = all.filter((c) => !isStalled(holding, c.minutesSinceAnswer));
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return holding.loneSessionHolds ? candidates[0].sessionId : undefined;
  let field = [...candidates];
  for (const rule of holding.election) {
    if (rule === "owns-p0") {
      const p0 = field.filter((c) => c.ownsP0);
      if (p0.length > 0) field = p0;
    } else {
      // An unreadable time sorts last rather than dropping the candidate.
      const at = (c: HolderCandidate) => {
        const t = Date.parse(c.createdAt);
        return Number.isNaN(t) ? Infinity : t;
      };
      const first = Math.min(...field.map(at));
      field = field.filter((c) => at(c) === first);
    }
  }
  return field.map((c) => c.sessionId).sort()[0];
}

export const RoleDefSchema = z.object({
  // Declared in the Zod shape as well as the interface: a field TypeScript
  // accepts and Zod strips is written by an author, type-checks, and vanishes
  // (bean `zdrf`).
  persona: z.string().optional(),
  id: z.string().min(1),
  // Required here, though `kgNodeLabelShape` makes both optional in general: a
  // role nobody can name or describe is a lane nobody can fill, and `kg-audit`
  // reports exactly that.
  ...kgNodeLabelShape,
  title: z.string().min(1),
  description: z.string().min(1),
  actorKinds: z.array(z.enum(ACTOR_KINDS)).min(1),
  /** Other names this role goes by today; `skos:altLabel`. As smart-base's `otherNames`. */
  otherNames: z.array(z.string().min(1)).optional(),
  /** Names it no longer goes by, with the retirement date; `skos:hiddenLabel`. */
  formerNames: z.array(FormerNameSchema).optional(),
  /**
   * Skills available to an actor in this role, before inheritance.
   *
   * @ref SkillDefinitionSchema
   */
  skills: z.array(SkillNameSchema).default([]),
  /**
   * Roles this one IS-A, outermost last. Static composition, not the scoped
   * subprocess stack.
   *
   * @ref RoleDefSchema
   */
  inherits: z.array(z.string()).optional(),
  judgementOnly: z.boolean().optional(),
  requiredCapabilities: ModelCapabilitiesSchema.optional(),
  store: StoreDefSchema.optional(),
  holding: LaneHoldingSchema.optional(),
  // STRICT: an unknown key is an ERROR, not something to drop quietly.
  //
  // `readRoleGraph` already refuses a bad `actorKinds` and a dangling
  // `inherits` — rejected at read, not accepted and reported later — and this
  // is the case it was missing. A plain `z.object` STRIPS what it does not
  // recognise, so a field an author wrote parses, type-checks, and reaches no
  // graph. That is bean `zdrf`'s failure class, and the comment above is the
  // half of it that was already known; this is the other half.
  //
  // It is not hypothetical. `role-model.md` §"Adding a role" said to write a
  // `summary` — not a field: `title`/`description` are the two labels every
  // kg node carries. PR #453 followed the instruction, and all three
  // bootstrap roles carried a `summary` that reached nothing. Measured
  // 2026-09-20: 0 of 33 root roles, 3 of 3 bootstrap roles. The instruction
  // was corrected in #452; this is what stops the next one.
  //
  // `_`-prefixed documentation keys stay legal — see `withoutComments`. A
  // downstream layer carrying some OTHER extra key will now fail at read
  // where it used to load, and that is the trade taken deliberately: a
  // declaration that silently means less than it says is worse than one that
  // refuses to load and names the key.
}).strict();

/**
 * The retired `actedUpon` (owner, 2026-10-16), dropped with a warning for one
 * release rather than refused by the strict schema. Layers migrate in their
 * own PRs and are mounted at their pinned commits, so a lower layer still
 * carrying the flag (bootstrap's `roles.json` before its migration lands and
 * is re-pinned) must not stop every graph that reads it from loading. It
 * means nothing now: a mechanical role is a role, and its skills are its
 * contract.
 */
function withoutRetiredKeys(raw: unknown, p: string): unknown {
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { roles?: unknown }).roles)) return raw;
  const carrying: string[] = [];
  const roles = ((raw as { roles: unknown[] }).roles).map((r) => {
    if (typeof r !== "object" || r === null || !("actedUpon" in r)) return r;
    const { actedUpon: _retired, ...rest } = r as Record<string, unknown>;
    carrying.push(String(rest["id"] ?? "?"));
    return rest;
  });
  if (carrying.length) console.warn(`${p}: \`actedUpon\` is retired and ignored (roles: ${carrying.join(", ")}); remove it`);
  return { ...(raw as object), roles };
}

/**
 * A pointer AT a role, from whatever depends on one — a voice addressed to
 * that reader, a user story told as them.
 *
 * The dependent holds this; the role holds nothing back (data-modelling step
 * 8). `instance` is the `owner/repo` of the layer whose role graph
 * declares the role (bean `6rmv`), absent for the pointer's own layer —
 * never a path, as `VoiceRuleSourceSchema.instance` spells it.
 *
 * @ref RoleDefSchema
 */
export const RoleRefSchema = z
  .object({
    instance: RepoFullNameSchema.optional(),
    role: z.string().min(1),
  })
  .strict();
export type RoleRef = z.infer<typeof RoleRefSchema>;

export const RoleGraphSchema = z.object({
  name: z.string().min(1),
  roles: z.array(RoleDefSchema).default([]),
  actors: z.array(ActorDefSchema).optional(),
  extensions: z.array(RoleExtensionSchema).optional(),
});

// ── Reading ─────────────────────────────────────────────────────

/**
 * Read the role graph from a `kg` directory (this repo: `skills/`).
 *
 * Absent → `undefined`. Unparseable, duplicate ids, or an `inherits` naming a
 * role that is not declared → throws. A dangling `inherits` is rejected at
 * read rather than left for the audit because {@link resolveRoleSkills} would
 * otherwise silently return a short skill set, and a *quietly* incomplete
 * answer is the failure mode this repository keeps paying for.
 */
/**
 * Strip `_`-prefixed documentation keys, at the graph level and on each role.
 *
 * This layer writes rationale into the JSON it declares — `_comment` here,
 * `_comment`/`_title` in `harness.json`, `_lanes_comment` in bootstrap's
 * graph — so the convention is established rather than invented here. It is
 * what makes {@link RoleDefSchema}'s `.strict()` affordable: an unknown key
 * can be an error precisely because there is a spelling for a key that is
 * MEANT not to be read.
 *
 * Generalised from a hardcoded `delete raw._comment`, which honoured the
 * convention for exactly one name — `_lanes_comment` was already being
 * stripped by the schema instead, which is the silence this change exists to
 * remove.
 */
function withoutComments(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const drop = (o: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
  const top = drop(raw as Record<string, unknown>);
  for (const key of ["roles", "extensions"] as const) {
    const list = top[key];
    if (Array.isArray(list)) {
      top[key] = list.map((r) => (typeof r === "object" && r !== null ? drop(r as Record<string, unknown>) : r));
    }
  }
  return top;
}

/** The actor registry's directory name inside the declared `scenarios` graph. */
export const ACTORS_DIRNAME = "actors";

/**
 * Where the actor registry lives: `actors/` inside the declared `scenarios`
 * graph, beside `roles.json` (bean `rqao`, owner 2026-09-30). It was
 * `.claude/skills/actors/` from 2026-03-24 (05e72abe92), when the framework
 * began as a Claude Code skill tree. That was a vendor-named, dot-prefixed,
 * UNDECLARED directory: the one graph every swimlane binds to was outside
 * every declaration, so no audit could claim it.
 *
 * Resolved from the platform layer's declaration, never spelled as a path,
 * so that relocating `scenarios/` moves the actors with it. Takes the
 * REPOSITORY root. `undefined` when the platform declares no
 * `scenarios` graph: a caller must say it could not determine, never read
 * that as "no actors".
 */
export function actorsDir(repoRoot: string): string | undefined {
  return scenariosSubdir(repoRoot, ACTORS_DIRNAME);
}

/** The capability registry's directory name inside the declared `scenarios` graph. */
export const CAPABILITIES_DIRNAME = "capabilities";

/**
 * Where the capability registry lives: `capabilities/` inside the declared
 * `scenarios` graph, beside the actors that HAVE them (bean `rqao`, owner
 * 2026-09-30, round 4). It was `.claude/skills/capabilities/`. A capability is
 * an environment probe ("is Bun installed?"), deliberately NOT a skill: the
 * role model keeps what an actor's environment can run apart from what its
 * role knows. Same resolution and the same `undefined` contract as
 * {@link actorsDir}.
 */
export function capabilitiesDir(repoRoot: string): string | undefined {
  return scenariosSubdir(repoRoot, CAPABILITIES_DIRNAME);
}

/** A registry directory inside the platform's declared `scenarios` graph. */
function scenariosSubdir(repoRoot: string, name: string): string | undefined {
  // The platform layer by its declaration, not `<repoRoot>/cat-harness`:
  // standalone, cat-harness IS the repository root (bean `uxn1`).
  const platform = layerRootNamed(repoRoot, "cat-harness");
  if (platform === undefined) return undefined;
  const scenarios = directoryForGraph(platform, "scenarios");
  return scenarios === undefined ? undefined : join(scenarios, name);
}

/**
 * The role ids declared by every layer the layer holding `kgRoot`
 * `needs`, transitively: the LOWER layers whose roles a role here may
 * inherit (placement PR0b).
 *
 * {@link readRoleGraph} uses this when a caller passes no `lower`. Before it
 * did, a caller that passed nothing (`kg-export`, `glossary-export`,
 * `gen-auto-docs` and others) refused any role inheriting a role from a lower
 * layer: a DAK layer's `l1-extraction-reviewer`, which inherits cat-harness's
 * `reviewer`, stopped every KG export that mounted that layer. Only `needs` is
 * followed, never a sibling or a dependent, so a role still cannot inherit
 * upward and a cross-instance cycle still cannot form.
 *
 * `needs` is read from the declaration's JSON, not through `readDeclaration`:
 * validating a declaration needs the typologies its dependencies contribute,
 * and this runs while those are being read.
 */
export function lowerRoleIds(kgRoot: string): ReadonlySet<string> {
  const cached = lowerCache.get(kgRoot);
  if (cached !== undefined) return cached;
  const out = new Set<string>();
  lowerCache.set(kgRoot, out);
  const own = findInstanceRoot(kgRoot);
  if (own === undefined) return out;
  const repo = repoRootFor(own);
  const visited = new Set<string>();
  const needsOf = (root: string): string[] => {
    const file = findDeclarationFile(root);
    if (file === undefined) return [];
    try {
      const needs = (JSON.parse(readFileSync(join(root, file), "utf-8")) as { needs?: unknown }).needs;
      return Array.isArray(needs) ? needs.filter((n): n is string => typeof n === "string") : [];
    } catch {
      return [];
    }
  };
  const visit = (root: string): void => {
    for (const need of needsOf(root)) {
      if (visited.has(need)) continue;
      visited.add(need);
      // A self-mounting checkout (`bun .github/cat.ts`) holds its `needs`
      // INSIDE its own root (`who-iris/cat-harness/`), not beside it, so the
      // layer's own root is searched first and its parent second.
      const lowerRoot = layerRootNamed(own, need) ?? layerRootNamed(repo, need);
      if (lowerRoot === undefined) continue;
      visit(lowerRoot);
      let scenarios: string | undefined;
      try {
        scenarios = directoryForGraph(lowerRoot, "scenarios");
      } catch {
        continue;
      }
      const g = scenarios === undefined ? undefined : readRoleGraph(scenarios, out);
      for (const r of g?.roles ?? []) out.add(r.id);
    }
  };
  visit(own);
  return out;
}

const lowerCache = new Map<string, Set<string>>();

export function readRoleGraph(kgRoot: string, lower: ReadonlySet<string> = lowerRoleIds(kgRoot)): RoleGraph | undefined {
  // TWO PLACES, because the role graph became a DECLARED DIRECTORY on
  // 2026-09-21 instead of a subdirectory of one.
  //
  // It used to sit at `<skills root>/roles/roles.json`, found by convention
  // from the skills directory. It is now `scenarios/roles.json`, a directory
  // of kind `scenarios` in its own right — so callers that hand this function
  // every declared graph root pass the scenarios directory ITSELF, and
  // joining `roles/` onto it looks one level too deep.
  //
  // Both are tried rather than the old one being dropped: a DOWNSTREAM
  // layer has not moved its file, and every caller here passes all roots
  // and takes the first that answers, so a layer on either layout
  // resolves. Convention first, since that is where an unmigrated layer
  // keeps it.
  const p = [join(kgRoot, ROLE_GRAPH_DIR, ROLE_GRAPH_FILENAME), join(kgRoot, ROLE_GRAPH_FILENAME)]
    .find((c) => existsSync(c));
  if (p === undefined) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    throw new Error(`${p} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const parsed = RoleGraphSchema.safeParse(withoutRetiredKeys(withoutComments(raw), p));
  if (!parsed.success) throw new Error(`${p} is not a valid role graph: ${parsed.error.message}`);

  const graph = parsed.data as RoleGraph;
  const ids = new Set<string>();
  for (const r of graph.roles) {
    if (ids.has(r.id)) throw new Error(`${p}: role id "${r.id}" is declared twice.`);
    ids.add(r.id);
  }
  // One name, one role — current, alternative or retired alike. A retired
  // name given to a new role would make every old text that used it mean
  // something it never meant; that is the job the glossary ledger did from
  // the outside, and here it is held by the authored names themselves.
  const owner = new Map<string, string>();
  for (const r of graph.roles) {
    const names = [r.title, ...(r.otherNames ?? []), ...(r.formerNames ?? []).map((f) => f.name)];
    for (const n of new Set(names.map((x) => x.trim().toLowerCase()))) {
      const prev = owner.get(n);
      if (prev !== undefined && prev !== r.id) {
        throw new Error(`${p}: the name "${n}" belongs to both role "${prev}" and role "${r.id}" — a title, other name or former name names one role.`);
      }
      owner.set(n, r.id);
    }
  }
  for (const r of graph.roles) {
    const storeError = storeRoleError(r);
    if (storeError) throw new Error(`${p}: ${storeError}`);
    for (const parent of r.inherits ?? []) {
      // `lower`: role ids a LOWER layer declares (placement PR0b). A
      // higher layer's role may inherit one; the lower graph is read first
      // and can never inherit upward, so a cross-instance cycle cannot form.
      if (!ids.has(parent) && !lower.has(parent)) {
        throw new Error(`${p}: role "${r.id}" inherits "${parent}", which is not declared.`);
      }
    }
  }
  // A cycle makes the skill closure non-terminating in the obvious
  // implementation and meaningless in any other, so it is refused here rather
  // than defended against at every call site.
  for (const r of graph.roles) detectCycle(graph, r.id, []);
  return graph;
}

function detectCycle(graph: RoleGraph, id: string, path: string[]): void {
  if (path.includes(id)) {
    throw new Error(`role inheritance cycle: ${[...path, id].join(" → ")}`);
  }
  const role = graph.roles.find((r) => r.id === id);
  for (const parent of role?.inherits ?? []) detectCycle(graph, parent, [...path, id]);
}

/**
 * Read the actor registry.
 *
 * Reads `<scenarios>/actors/*.json` ({@link actorsDir}). An entry states its kind in `kind`,
 * against the full {@link ACTOR_KINDS} vocabulary, and an unknown value is
 * **rejected** rather than accepted and ignored — the same rule
 * {@link readRoleGraph} follows for an ACTOR's `kind` — one kind, unlike a role's set. An entry carrying the
 * deprecated `inherits` is returned with {@link LoadedActor.looksLikeRole} set,
 * so a caller can report it instead of either ignoring it or acting on a field
 * that means something else here.
 *
 * ## The legacy `type`, and why it is a fallback rather than the field
 *
 * Every entry carried `type` until 2026-09-19, with two values — `person` and
 * `system` — and `system` covered an LLM agent and a CI runner alike. That is
 * the conflation {@link ACTOR_KINDS} documents: it made "which tasks can this
 * actor perform" unanswerable, because the answer turns on judgement and both
 * sides of the question wore the same label.
 *
 * `type` is still read when `kind` is absent, so an unmigrated downstream
 * registry loads. It maps conservatively — `person` → `person`, anything else
 * → `system` — and **never invents `agent`**: guessing that an entry is agentic
 * because its id ends in `-agent` would put an unreviewed claim into the graph
 * under the appearance of data. A registry that has not said is read as
 * mechanical, which is the reading that refuses it a judgement task rather than
 * granting it one.
 */
export interface LoadedActor extends ActorDef {
  /**
   * Capability ids the actor claims — an environment probe it needs, not a
   * skill. Carried here because nothing resolved them: `fhir-validator` was
   * claimed by three actors and declared nowhere.
   */
  capabilities?: string[];
  /** Permission ids — what it may do. See {@link readPermissions}. */
  permissions?: string[];
  /**
   * What this participant can reach off its own machine.
   *
   * Carried on `LoadedActor` rather than on the thin {@link ActorDef} on
   * purpose. That interface is identity only — *"everything about what it
   * can do belongs to the role it takes on"* — and reach is not what the
   * actor **does**; it is a fact about **where it sits**, exactly like the
   * `capabilities` its machine has. Putting it on `ActorDef` would recreate
   * the confusion that module exists to end; putting it beside
   * `capabilities` is where the environment facts already live.
   *
   * Absent means UNDECLARED, which is not `internet`. See
   * `schemas/process/actor-reach.ts` for how it composes with the deployment's.
   */
  reach?: NetworkReach;
  /**
   * The system-under-test facet (bean `3o5b`) — present when the actor can be
   * executed against a `test-plan/v1`. Beside `reach` for the same reason:
   * it is a fact about the participant, not something its lane knows.
   */
  systemUnderTest?: SystemUnderTestFacet;
  /** The file it came from, so a finding can name it. */
  path: string;
  /** Carries `inherits` — i.e. it is modelling a role, not an actor. */
  looksLikeRole: boolean;
}

/**
 * One entry's kind: `kind` when declared, else the legacy `type`.
 *
 * An unrecognised `kind` throws. It is the one case where being permissive
 * costs more than failing: a typo silently read as `system` would quietly
 * disqualify an actor from every judgement task it is meant to perform, and
 * nothing downstream would say so.
 */
function actorKindOf(raw: Record<string, unknown>, path: string): ActorKind {
  if (typeof raw.kind === "string") {
    if (!(ACTOR_KINDS as readonly string[]).includes(raw.kind)) {
      throw new Error(
        `${path}: kind "${raw.kind}" is not an actor kind. One of: ${ACTOR_KINDS.join(", ")}.`,
      );
    }
    return raw.kind as ActorKind;
  }
  return raw.type === "person" ? "person" : "system";
}

/**
 * An actor's declared reach, or `undefined` when it declares none.
 *
 * An unrecognised value throws, for the reason {@link actorKindOf} throws:
 * a typo read permissively would route a signing task to an API the machine
 * cannot call, and the failure would surface as a network error rather than
 * as the declaration mistake it is.
 */
function actorReachOf(raw: Record<string, unknown>, path: string): NetworkReach | undefined {
  if (raw.reach === undefined) return undefined;
  if (typeof raw.reach !== "string" || !(NETWORK_REACHES as readonly string[]).includes(raw.reach)) {
    throw new Error(
      `${path}: reach ${JSON.stringify(raw.reach)} is not a network reach. ` +
        `One of: ${NETWORK_REACHES.join(", ")}.`,
    );
  }
  return raw.reach as NetworkReach;
}

/**
 * The `systemUnderTest` facet, validated. A malformed facet THROWS, like a bad
 * `reach`: coerced or dropped, it would silently take an actor out of every
 * test-plan join it was declared for.
 */
function actorSutOf(raw: Record<string, unknown>, kind: ActorKind, path: string): SystemUnderTestFacet | undefined {
  if (raw.systemUnderTest === undefined) return undefined;
  const parsed = SystemUnderTestFacetSchema.safeParse(raw.systemUnderTest);
  if (!parsed.success) {
    throw new Error(
      `${path}: systemUnderTest is malformed — ${parsed.error.issues.map((i) => `${i.path.join(".") || "(facet)"}: ${i.message}`).join("; ")}.`,
    );
  }
  if (!(SUT_ACTOR_KINDS as readonly string[]).includes(kind)) {
    throw new Error(`${path}: a ${kind} actor cannot carry systemUnderTest — only ${SUT_ACTOR_KINDS.join(" or ")} actors are executed against a plan.`);
  }
  return parsed.data;
}

function grantsFor(grants: ReadonlyMap<string, readonly string[]> | undefined, id: string): string[] | undefined {
  const g = grants?.get(id);
  return g ? [...g] : undefined;
}

/**
 * Read the actor directory.
 *
 * `grants` supplies each actor's permissions from the ODRL policies
 * ({@link readPolicyGrants} in `schemas/content/odrl.ts`, issue #1180). An actor file
 * that still carries its own `permissions` list keeps it: that is an
 * unmigrated downstream registry, and reading it is better than dropping it.
 */
export function readActors(actorsDir: string, grants?: ReadonlyMap<string, readonly string[]>): LoadedActor[] {
  if (!existsSync(actorsDir)) return [];
  const out: LoadedActor[] = [];
  for (const f of readdirSync(actorsDir).filter((f) => f.endsWith(".json")).sort()) {
    const p = join(actorsDir, f);
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
    } catch (e) {
      throw new Error(`${p} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    // An EXTENSION of another layer's actor (placement PR0b) is not an
    // actor; `overlayActors` in `scenario-overlay.ts` applies it.
    if (typeof raw.extends === "string") continue;
    const kind = actorKindOf(raw, p);
    const systemUnderTest = actorSutOf(raw, kind, p);
    out.push({
      id: String(raw.id ?? f.slice(0, -5)),
      title: String(raw.title ?? raw.id ?? f.slice(0, -5)),
      kind,
      description: typeof raw.description === "string" ? raw.description : undefined,
      roles: Array.isArray(raw.roles) ? (raw.roles as string[]) : undefined,
      capabilities: Array.isArray(raw.capabilities) ? (raw.capabilities as string[]) : undefined,
      permissions: Array.isArray(raw.permissions)
        ? (raw.permissions as string[])
        : grantsFor(grants, String(raw.id ?? f.slice(0, -5))),
      reach: actorReachOf(raw, p),
      ...(systemUnderTest === undefined ? {} : { systemUnderTest }),
      path: p,
      looksLikeRole: Array.isArray(raw.inherits) && raw.inherits.length > 0,
    });
  }
  return out;
}

// ── Resolution ──────────────────────────────────────────────────

/** Where a skill in a resolved set came from. */
export interface SkillProvenance {
  skill: string;
  /** The role that declared it — may be an ancestor, not the role asked for. */
  via: string;
  /** Depth in the `inherits` walk; 0 is the role itself. */
  depth: number;
}

export function findRole(graph: RoleGraph, id: string): RoleDef | undefined {
  return graph.roles.find((r) => r.id === id);
}

/**
 * The skills an actor has while acting in this role, closed over `inherits`.
 *
 * Provenance is returned rather than a bare set because "which role gave me
 * this" is the question an audit finding has to answer. The first declaration
 * encountered wins on duplicates — nearest ancestor, breadth-first — so the
 * reported `via` is the closest role that supplies it.
 */
export function resolveRoleSkills(graph: RoleGraph, roleId: string): SkillProvenance[] {
  const seenRole = new Set<string>();
  const bySkill = new Map<string, SkillProvenance>();
  let frontier = [roleId];
  let depth = 0;
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      if (seenRole.has(id)) continue;
      seenRole.add(id);
      const role = findRole(graph, id);
      if (!role) continue;
      for (const s of role.skills) {
        if (!bySkill.has(s)) bySkill.set(s, { skill: s, via: id, depth });
      }
      next.push(...(role.inherits ?? []));
    }
    frontier = next;
    depth += 1;
  }
  return [...bySkill.values()].sort((a, b) => a.skill.localeCompare(b.skill));
}

/**
 * The role acting at the bottom of a subprocess call path, with everything the
 * outer roles contribute.
 *
 * `path` runs OUTERMOST FIRST. The union is taken across the whole path — an
 * actor descending into a subprocess keeps what it already had — and each
 * skill keeps the role it came from, so a reader can see that a task deep in a
 * call chain was performed with a skill supplied three levels up. That is
 * exactly the fact a flat union destroys.
 */
export interface RoleStack {
  /** Role ids, outermost first. Unresolvable ids are kept and flagged. */
  path: string[];
  /** Ids in `path` that are not declared. */
  unresolved: string[];
  skills: SkillProvenance[];
}

export function resolveRoleStack(graph: RoleGraph, path: string[]): RoleStack {
  const unresolved = path.filter((id) => !findRole(graph, id));
  const bySkill = new Map<string, SkillProvenance>();
  // Innermost last, and the innermost role's own declaration should be the one
  // reported when two levels declare the same skill: walk inward, overwriting.
  for (const id of path) {
    for (const p of resolveRoleSkills(graph, id)) bySkill.set(p.skill, p);
  }
  return {
    path,
    unresolved,
    skills: [...bySkill.values()].sort((a, b) => a.skill.localeCompare(b.skill)),
  };
}

/**
 * The role a BPMN lane binds.
 *
 * Only the lane's own declaration binds it — the ref {@link laneRoleRef} reads.
 * There is no fallback to matching the lane's display name against the roles:
 * that fallback needed a `lanes[]` on every role, which is a general node
 * naming its users (`data-modelling` step 8, #1168). `laneName` is kept for
 * callers' sake and no longer consulted.
 */
export function roleForLane(
  graph: RoleGraph,
  laneName: string | undefined,
  explicitRef?: string,
): RoleDef | undefined {
  void laneName;
  return explicitRef ? findRole(graph, explicitRef) : undefined;
}

/**
 * A BPMN lane as a reader holds it — the bpmn-moddle shape, structurally, so
 * this schema module imports no parser. `partitionElementRef` arrives from
 * moddle as the resolved `<bpmn:resource>` element, and as its id string from
 * a reader that does not resolve references; both are accepted.
 */
export interface LaneLike {
  id?: string;
  partitionElementRef?: string | { id?: string; $type?: string };
  extensionElements?: { values?: ReadonlyArray<{ $type?: string; ref?: string; variable?: string }> };
}

/** What {@link laneRoleRef} read off a lane. */
export interface LaneRoleRead {
  /** The role id the lane names, when it names one. */
  ref?: string;
  /** Which declaration supplied {@link ref}. */
  source: "partitionElementRef" | "legacy-role-ref" | "none";
  /** `<bootstrap.processes:role variable="true"/>`: the performer is whoever invoked the process. */
  performerVaries: boolean;
  /** Set when the lane still uses the deprecated binding, or carries two that disagree. */
  warning?: string;
}

/**
 * The role a lane names, read the BPMN way first (owner, 2026-10-16).
 *
 * 1. **`partitionElementRef`** → the `<bpmn:resource>` it points at, whose
 *    `id` is the role id verbatim. BPMN 2.0's own mechanism for "this lane is
 *    the partition of that resource", so every BPMN tool round-trips it.
 * 2. **`<bootstrap.processes:role ref>`** — the legacy extension, accepted for
 *    one release with a `warning`, and read ONLY when (1) is absent. The QA
 *    report lists such a lane as `lane-role-legacy-binding`.
 *
 * `<bootstrap.processes:role variable="true"/>` is not legacy and stays: it
 * DECLARES that no role is named because the performer is whoever invoked the
 * process, which `partitionElementRef` has no way to say.
 *
 * The extension element is matched by its local name, `role`, whatever prefix
 * the reader registered for bootstrap's namespace (`folio:` in
 * the tools layer, `bootstrap.processes:` unregistered): a reader matches by
 * namespace, never by prefix text (`processes/ns.jsonld`).
 */
export function laneRoleRef(lane: LaneLike): LaneRoleRead {
  const pe = lane.partitionElementRef;
  const peRef = typeof pe === "string" ? pe : pe?.id;
  const roleEl = (lane.extensionElements?.values ?? []).find((v) => /(^|:)role$/.test(v.$type ?? ""));
  const performerVaries = roleEl?.variable === "true";
  const where = lane.id ? `lane "${lane.id}"` : "a lane";
  if (peRef) {
    if (roleEl?.ref && roleEl.ref !== peRef) {
      return {
        ref: peRef,
        source: "partitionElementRef",
        performerVaries,
        warning:
          `${where} names role "${peRef}" by partitionElementRef and "${roleEl.ref}" by the deprecated ` +
          `<bootstrap.processes:role ref>; partitionElementRef wins. Remove the extension element.`,
      };
    }
    return { ref: peRef, source: "partitionElementRef", performerVaries };
  }
  if (roleEl?.ref) {
    return {
      ref: roleEl.ref,
      source: "legacy-role-ref",
      performerVaries,
      warning:
        `${where} binds role "${roleEl.ref}" with the deprecated <bootstrap.processes:role ref>; ` +
        `declare <bpmn:resource id="${roleEl.ref}"/> and set partitionElementRef="${roleEl.ref}" on the lane.`,
    };
  }
  return { source: "none", performerVaries };
}

/**
 * What a lane's role binding ACTUALLY is — five answers, not two.
 *
 * `roleForLane` returns `RoleDef | undefined`, and `undefined` is overloaded:
 * it means "matched nothing", which is the same value a typo produces and the
 * same value a lane whose performer varies BY DESIGN produces. Bean `ug4r`:
 * a consumer that cannot separate those either reports a correct modelling
 * decision as a defect for ever, or suppresses real defects to avoid doing so.
 *
 * `roleForLane` is deliberately left alone — its two callers (`stakeholder-map`
 * and the workflow `instance`) genuinely want "the role, or nothing", and a
 * lane with a varying performer correctly has no role for them. This is for
 * the consumer that has to JUDGE the binding rather than use it.
 *
 * Takes a structural lane rather than importing `LaneDef`, because that type
 * lives in `src/workflow/` and this module is a schema: the dependency would
 * run the wrong way.
 */
export type LaneBinding =
  /** Resolves to a declared role. */
  | { readonly kind: "bound"; readonly role: RoleDef }
  /** Names a role the graph does not declare — a typo or a deleted role. */
  | { readonly kind: "dangling"; readonly ref: string }
  /** Declares `variable="true"`: no role, and that IS the answer. */
  | { readonly kind: "variable" }
  /** Declares both a `ref` and `variable` — it cannot be both. */
  | { readonly kind: "contradictory"; readonly ref: string }
  /** Nothing matched and nothing was declared. The finding. */
  | { readonly kind: "unbound" };

/**
 * The graph is REQUIRED — bean `7go7`, the owner's ruling 2026-09-23.
 *
 * It was `RoleGraph | undefined`, and with no graph every lane carrying a
 * `roleRef` came back `dangling`. Measured on this corpus: 183 of 184 lanes
 * bind and 44 carry an explicit ref, so one unreadable file rendered as 44
 * broken references that were all fine — a sweep that could not look reporting
 * findings rather than reporting that it could not look. The `dh4f` shape.
 *
 * Three shapes were on the table (see the bean). The owner chose this one over
 * a sixth `ungraphed` kind, and the reason it is the stronger choice is that
 * **a caller with no graph cannot ask the question, which is the honest
 * answer** — the binding of a lane is not a fact that exists in the absence of
 * a role registry. A sixth kind would have let a consumer keep asking and then
 * forget to handle the reply.
 *
 * ## The premise the bean gave for NOT fixing it was false
 *
 * `7go7` said a local guard "would make the viewer and the audit disagree
 * about whether a lane is bound". It would not have. `kg-audit.ts` ALREADY
 * branches on `!graph` and overwrites `role-ref-resolves`, `lane-binds-role`
 * and five more with `unknown` — *"No role graph is a state the audit can be
 * in, and it is not a pass."* So the audit never published a `dangling`
 * verdict in that state; it computed one and discarded it. The consumer that
 * disagreed with the audit was the VIEWER, which took the verdict verbatim.
 *
 * Checked before writing this, because the bean's reasoning was the only thing
 * standing between the defect and a one-line fix, and it was wrong.
 */
export function laneBinding(
  graph: RoleGraph,
  lane: { name?: string; roleRef?: string; performerVaries?: boolean },
): LaneBinding {
  // Checked FIRST, and before the graph is consulted at all: a lane that says
  // two contradictory things is wrong whatever the graph happens to contain,
  // and resolving one of them would make the other silently have no effect.
  if (lane.performerVaries && lane.roleRef) {
    return { kind: "contradictory", ref: lane.roleRef };
  }
  if (lane.performerVaries) return { kind: "variable" };
  const role = roleForLane(graph, lane.name, lane.roleRef);
  if (role) return { kind: "bound", role };
  // A dangling `ref` is reported as itself rather than as "unbound", because
  // the fix differs: one is a typo to correct, the other a binding to add.
  if (lane.roleRef) return { kind: "dangling", ref: lane.roleRef };
  return { kind: "unbound" };
}

// ── Graph projection ────────────────────────────────────────────

/**
 * JSON-LD projection, matching {@link module:schemas/cat-harness}'s: the
 * authored shape is stored, the graph form is derived, and there is one truth.
 *
 * ## Why roles.json is not a standalone published Subgraph document
 *
 * `scenarios/roles.json` is an internal authoring registry for BPMN swimlanes,
 * defining the roles that processes and lane bindings reference. It is not
 * published as an independent JSON-LD document or Subgraph collection; instead,
 * its roles are projected directly into the declaring layer's Knowledge Graph
 * export (`scripts/kg-export.ts`) under the layer's own IRI (`#role/<id>`),
 * while swimlane terminology is published separately in the SKOS swimlane glossary
 * (`scripts/glossary-export.ts`).
 */
export function toJsonLd(graph: RoleGraph): Record<string, unknown> {
  return {
    "@context": {
      ...ownPrefixTable(),
      skills: termIri("hasSkill"),
      inherits: termIri("isA"),
      roles: termIri("declaresRole"),
    },
    "@type": termIri("RoleGraph"),
    name: graph.name,
    roles: graph.roles.map((r) => ({
      "@id": `#${r.id}`,
      "@type": termIri("Role"),
      title: r.title,
      description: r.description,
      actorKinds: r.actorKinds,
      skills: r.skills,
      ...(r.inherits?.length ? { inherits: r.inherits.map((i) => ({ "@id": `#${i}` })) } : {}),
    })),
  };
}

// ── Audience ────────────────────────────────────────────────────

/**
 * Whether only a mechanical or an external actor can take this role on —
 * `actorKinds` holds nothing but `system` and `external`.
 *
 * Such a role is real (owner, 2026-10-16): its skills are its contract, and
 * the QA report's `mechanical-role-untested` asks whether any of them names a
 * test (`tested-by:`). What it is not is a READER — see {@link audienceProblem}.
 * Derived from `actorKinds` rather than flagged, so it cannot disagree with
 * them the way the retired `actedUpon` could.
 */
export function isMechanicalRole(role: RoleDef): boolean {
  return role.actorKinds.every((k) => k === "system" || k === "external");
}

/**
 * Why a role id cannot be an audience, or undefined when it can.
 *
 * Two rejections, and the second is the one that is easy to miss:
 *
 * - **unknown** — not a role in this layer's KG. A mistyped audience
 *   scopes QA to nobody, which reads as "no findings" rather than as an error.
 * - **mechanical** — `Work plan (beans)`, `Corpus` and `Build pipeline` are
 *   roles a machine plays ({@link isMechanicalRole}). Their skills are a
 *   contract to be tested, not prose to be read, so nothing reads prose
 *   written for them. An audience must be a role a person or an agent takes on.
 *   This was the `actedUpon` flag until 2026-10-16, and asked the same
 *   question of a hand-set boolean instead of the role's own `actorKinds`.
 */
export function audienceProblem(graph: RoleGraph, id: string): string | undefined {
  const role = findRole(graph, id);
  if (!role) {
    return `"${id}" is not a role in this instance's KG. Known roles: ${graph.roles.map((r) => r.id).join(", ")}`;
  }
  if (isMechanicalRole(role)) {
    return `"${id}" is played only by a mechanical or external actor — nothing reads prose written for it`;
  }
  return undefined;
}

/** Role ids that may be declared as an audience. */
export function audienceRoles(graph: RoleGraph): RoleDef[] {
  return graph.roles.filter((r) => !isMechanicalRole(r));
}

// ── Permissions ─────────────────────────────────────────────────

/** Directory, relative to the `kg` root, holding the permission vocabulary. */
export const PERMISSION_DIR = "permissions";
export const PERMISSION_FILENAME = "permissions.json";

/**
 * What an actor is ALLOWED to do, as opposed to what it knows or what its
 * machine has.
 *
 * ## Why this is an actor property and not a role property
 *
 * It was tested, not assumed, and the obvious answer was wrong. "Can review"
 * and "can push" are properties of a position, which is what moved `inherits`
 * off actors in 2026-09 — so the natural next step was to move permissions onto
 * Role too. That does not survive contact with the data: a permission
 * **cross-cuts** roles. `content-authoring` is held by actors taking on five
 * different roles; `qa-reporting` by three, one of them a build pipeline and
 * one a human QC reviewer; and `admin` holds `admin-settings` in every one of
 * the five lanes it acts in. Placing them on Role produced **36** conflicts
 * where a permission was held by some but not all actors sharing a role.
 *
 * The distinction that does hold: a **skill** answers *what does the performer
 * of this task need to know*, and belongs to the lane. A **permission** answers
 * *what is this participant allowed to do*, and travels with the participant
 * through every lane it enters.
 */
export interface PermissionDef {
  id: string;
  /** Display text and the sentence under it — `schemas/kg/kg-node.ts`, like every node. */
  title: string;
  description: string;
  /**
   * The broader actions this one is part of: another action here, or one of
   * ODRL's common vocabulary (`schemas/content/odrl.ts#ODRL_ACTIONS`). This is what
   * makes the vocabulary an ODRL profile (issue #1180): a permission to a
   * broader action permits every action included in it. Required and
   * non-empty, so every action has a way up to `odrl:use`.
   */
  includedIn: string[];
}

export interface PermissionVocabulary {
  name: string;
  permissions: PermissionDef[];
}

export const PermissionDefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  includedIn: z.array(z.string().min(1)).min(1),
});

export const PermissionVocabularySchema = z.object({
  name: z.string().min(1),
  permissions: z.array(PermissionDefSchema).default([]),
});

/**
 * Read the permission vocabulary. Absent → `undefined` (an unmigrated layer
 * simply declares none); present but unparseable → throws, on the same rule as
 * every other declaration here.
 */
export function readPermissions(kgRoot: string): PermissionVocabulary | undefined {
  const p = join(kgRoot, PERMISSION_DIR, PERMISSION_FILENAME);
  if (!existsSync(p)) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    throw new Error(`${p} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (typeof raw === "object" && raw !== null) delete (raw as Record<string, unknown>)._comment;
  const parsed = PermissionVocabularySchema.safeParse(raw);
  if (!parsed.success) throw new Error(`${p} is not a valid permission vocabulary: ${parsed.error.message}`);
  const ids = new Set<string>();
  for (const perm of parsed.data.permissions) {
    if (ids.has(perm.id)) throw new Error(`${p}: permission id "${perm.id}" is declared twice.`);
    ids.add(perm.id);
  }
  // Every `includedIn` resolves, to an action here or to ODRL's own. A dangling
  // one would cut an action off from everything granted above it.
  for (const perm of parsed.data.permissions) {
    for (const up of perm.includedIn) {
      if (!ids.has(up) && !(up in ODRL_ACTIONS)) {
        throw new Error(`${p}: "${perm.id}" is includedIn "${up}", which is neither declared here nor an ODRL action.`);
      }
    }
  }
  return parsed.data;
}
