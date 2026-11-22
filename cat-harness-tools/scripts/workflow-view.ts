/**
 * Where a running workflow instance IS, what it names, and whether it is
 * stuck — computed from committed state only.
 *
 * @module scripts/workflow-view
 * @covers none — it JOINS committed workflow instances with the diagrams they
 *   run and the beans and todos those name; the state visualiser renders it
 *
 * ## A join, not a second store
 *
 * Position is read from the instance's own `tokens` (and, inside a running
 * subprocess, its child's), through `positionOf` — the same reader the engine
 * reports with. The beans a step names are the diagram's `<folio:bean op>`
 * marks, read by `loadProcessModel`, the engine's parser. Nothing here keeps
 * its own idea of where an instance is, so a sibling session reading the same
 * commit draws the same picture.
 *
 * ## Stuck states are STATES
 *
 * Each is its own {@link StuckKind}, with a sentence saying what was
 * measured, rather than a red tint over a tidy diagram:
 *
 * | kind | from |
 * |---|---|
 * | `enabled-not-taken` | a running instance holding a token, unmoved for more than {@link STUCK_AFTER_DAYS} days |
 * | `age-unknown` | a running instance with no `updatedAt` and no dated history: its age cannot be told, which is not "fresh" |
 * | `bean-moved-on` | its bean was updated more than {@link STUCK_AFTER_DAYS} days after the instance last moved |
 * | `blocked-without-expiry` | its bean carries a block with no expiry (`bean-blocking`) |
 * | `bean-closed` | its bean is completed or scrapped while the instance still runs |
 * | `no-token` | `running` with no token anywhere: nothing can be completed |
 * | `no-status` | the file records no `status` at all |
 * | `refused-gate` | the engine refused a step after the instance last moved (`refusals`) |
 *
 * `workflow_complete` refuses by throwing a `WorkflowError` and also appends
 * the refusal to the instance's `refusals`. An older file carries no
 * `refusals`, and {@link GATE_REFUSALS} says so on every page rather than
 * reading the absence as "never refused". The hand-over screen's refusals are
 * not recorded: they refuse the caller's ARGUMENTS before the instance is
 * read, which is not a gate of the process.
 *
 * ## The working context, by the step's role
 *
 * The engine already computes the context of an enabled step (`enabled()`'s
 * `TaskContext`: the role, the role stack down the call path, the skills
 * closed over `inherits`, the conventions in force and the beans the token
 * carries), so {@link workingContextOf} reads it rather than computing a
 * second one. Memory is joined by ROLE, the axis `memoryForRoles` defines:
 * the step's role and the roles it `inherits`, plus every untagged entry. The
 * outer roles of the call path are NOT overlaid, because `schemas/memory.ts`
 * leaves the call-path overlay open on purpose.
 *
 * ## The log
 *
 * The instance's `history` is its committed log. The activity log
 * (`fsh-guts/logs/`) is git-ignored scratch on the machine that ran the step,
 * so it is not committed state and the view does not read it.
 *
 * ## The clock
 *
 * The age-based states need a "now", and it is passed in, never read here.
 * The pages are built at publish (`builtAtPublish`), so their reference time
 * is the publish and each page states it.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { z } from "zod";

import { inspect as inspectBlock } from "./check-bean-blocks.ts";
import { beanFindings, type BeanNode } from "./beans.ts";
import { memoryForRoles, type MemoryNode } from "../schemas/conduct/memory.js";
import { findRole, type RoleGraph } from "../schemas/process/role-graph.js";
import { nodeKind } from "../schemas/kg/node-kind.js";
import { enabled, INSTANCE_SCHEMA, type HistoryEntry, type InstanceState } from "../src/workflow/instance.js";
import type { ProcessModel } from "../src/workflow/process-model.js";

/**
 * How long a token may sit on an enabled step before the view calls it
 * stuck: **7 days**.
 *
 * A week, because that is the bean's own example (*"a tidy diagram for a
 * process that has been stuck for a week"*), and because the steps these
 * diagrams hold are agent turns and owner sign-offs: an agent step that has
 * not moved in a week has been abandoned, and an owner sign-off that has
 * waited a week needs asking again. Shorter would flag every sign-off over a
 * weekend. It is a threshold for SHOWING a state, never for changing one.
 */
export const STUCK_AFTER_DAYS = 7;

/**
 * The start of `d`'s UTC day: the reference time a page build measures ages
 * against. Ages are counted in days, so a day loses nothing, and every build on
 * the same day writes the same bytes (cat-harness-tools#1230).
 */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** `YYYY-MM-DD`, the UTC day of `d`. */
export function dayOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the view can say about refused gates, for an instance that records none. */
export const GATE_REFUSALS = {
  since: "2026-10-29",
  why:
    "workflow_complete records each step the engine refuses in the instance's `refusals` since " +
    "2026-10-29. An instance last saved before then carries none, which means \"not recorded\", " +
    "not \"never refused\".",
} as const;

export type StuckKind =
  | "enabled-not-taken"
  | "age-unknown"
  | "bean-moved-on"
  | "blocked-without-expiry"
  | "bean-closed"
  | "no-token"
  | "no-status"
  | "refused-gate";

export interface StuckState {
  kind: StuckKind;
  /** What was measured, as a sentence. */
  detail: string;
}

/** One file of a `workflow-state` directory: an instance, or why it is not one. */
export type InstanceRead = { file: string; state: InstanceState } | { file: string; bad: string };

/**
 * Read instance files, keeping an unreadable one visible with its reason.
 *
 * A file is an instance when it parses and carries `processId` and a `tokens`
 * array. The `$schema` tag is not required, because `InstanceState` documents
 * it as optional on read (pre-tag files load), but a file tagged with a
 * DIFFERENT schema is not an instance and says so.
 */
export function readInstances(files: readonly string[]): InstanceRead[] {
  return files.map((file) => {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      return { file, bad: "not readable JSON" };
    }
    const o = raw as Partial<InstanceState> & { $schema?: unknown };
    if (o.$schema !== undefined && o.$schema !== INSTANCE_SCHEMA) return { file, bad: `carries $schema ${String(o.$schema)}, not ${INSTANCE_SCHEMA}` };
    if (typeof o.processId !== "string" || !Array.isArray(o.tokens)) return { file, bad: "no processId or tokens array" };
    return {
      file,
      state: {
        ...(o as InstanceState),
        id: typeof o.id === "string" ? o.id : basename(file, ".json"),
        history: Array.isArray(o.history) ? o.history : [],
        arrivals: o.arrivals ?? {},
      },
    };
  });
}

/** Every bean id an instance names of its own: `bean`, then `carriedBeans`. */
export function beansNamedBy(s: InstanceState): string[] {
  return [...new Set([...(s.bean ? [s.bean] : []), ...(s.carriedBeans ?? [])])];
}

/** When an instance last moved: `updatedAt`, else its newest dated history entry. */
export function lastMoved(s: InstanceState): string | undefined {
  if (typeof s.updatedAt === "string" && s.updatedAt !== "") return s.updatedAt;
  const dated = (s.history ?? []).map((h) => h.at).filter((a): a is string => typeof a === "string" && a !== "");
  return dated.sort().at(-1);
}

function days(ms: number): string {
  return `${Math.floor(ms / DAY_MS)} day(s)`;
}

/** Every token anywhere in the instance, its running children included. */
function hasAnyToken(s: InstanceState): boolean {
  return s.tokens.length > 0 || Object.values(s.children ?? {}).some((c) => c.status === "running" && hasAnyToken(c));
}

/**
 * The stuck states one instance is in, from committed data and `now`.
 *
 * `beans` is the store the instance's bean lives in; a bean it names that is
 * not there yields no bean state (the page lists it as "not in this store").
 * A completed instance is in none: it is finished, not stuck — and neither is
 * one whose every token rests on an end event (`endNodes`), beyond saying
 * that its status was never set.
 */
export function stuckStatesOf(
  s: InstanceState,
  beans: readonly BeanNode[],
  now: Date,
  /** The diagram's end events, when the diagram was found: a token resting on one is finished, not waiting. */
  endNodes: ReadonlySet<string> = new Set(),
): StuckState[] {
  const out: StuckState[] = [];
  const atEnd = s.tokens.length > 0 && s.tokens.every((t) => endNodes.has(t));
  if (s.status === undefined || (s.status as string) === "") {
    out.push({
      kind: "no-status",
      detail: atEnd
        ? "the instance file records no status; its token rests on an end event, so it looks finished, but nothing said so"
        : "the instance file records no status, so whether it is running cannot be read",
    });
  }
  if (s.status === "completed" || atEnd) return out;

  if (!hasAnyToken(s)) {
    out.push({ kind: "no-token", detail: "no step holds a token, so nothing can be completed and the instance cannot finish" });
  }
  const moved = lastMoved(s);
  const movedMs = moved === undefined ? Number.NaN : Date.parse(moved);
  if (Number.isNaN(movedMs)) {
    if (hasAnyToken(s)) out.push({ kind: "age-unknown", detail: "no updatedAt and no dated history, so how long the token has waited cannot be told" });
  } else if (hasAnyToken(s) && now.getTime() - movedMs > STUCK_AFTER_DAYS * DAY_MS) {
    out.push({
      kind: "enabled-not-taken",
      detail: `the token has not moved since ${moved} — ${days(now.getTime() - movedMs)}, past the ${STUCK_AFTER_DAYS}-day threshold`,
    });
  }

  const since = Number.isNaN(movedMs) ? Number.NEGATIVE_INFINITY : movedMs;
  const refusedSince = (s.refusals ?? []).filter((r) => Date.parse(r.at) > since);
  if (refusedSince.length > 0) {
    const last = refusedSince.at(-1)!;
    out.push({
      kind: "refused-gate",
      detail:
        `the engine refused ${refusedSince.length} step(s) since the instance last moved; the newest, at ${last.at}, ` +
        `asked for \`${last.node}\`${last.actor ? ` as ${last.actor}` : ""}: ${last.reason}`,
    });
  }

  const byId = new Map(beans.map((b) => [b.id, b]));
  const relation = beanFindings([...beans]).filter((f) => f.kind === "blocked-without-expiry");
  for (const id of beansNamedBy(s)) {
    const b = byId.get(id);
    if (!b) continue;
    if (b.status === "completed" || b.status === "scrapped") {
      out.push({ kind: "bean-closed", detail: `\`${id}\` is ${b.status} while this instance still runs` });
    }
    const bMs = Date.parse(b.updatedAt);
    if (!Number.isNaN(bMs) && !Number.isNaN(movedMs) && bMs - movedMs > STUCK_AFTER_DAYS * DAY_MS) {
      out.push({
        kind: "bean-moved-on",
        detail: `\`${id}\` was updated ${b.updatedAt}, ${days(bMs - movedMs)} after the instance last moved — the work went on and the position did not`,
      });
    }
    const block = inspectBlock(b, b.body);
    if (block?.verdict === "unstructured") {
      out.push({ kind: "blocked-without-expiry", detail: `\`${id}\` says it is blocked in prose, with no \`## Blocked on\` section and so no expiry` });
    } else if (block?.verdict === "incomplete" && block.missing.includes("expires")) {
      out.push({ kind: "blocked-without-expiry", detail: `\`${id}\` carries a \`## Blocked on\` section with no expiry` });
    }
    for (const f of relation.filter((r) => r.blocks === id)) {
      out.push({ kind: "blocked-without-expiry", detail: `\`${id}\` is blocked by \`${f.bean}\` and neither states an expiry` });
    }
  }
  return out;
}

/** The end events of a model, for {@link stuckStatesOf}. */
export function endNodesOf(model: Pick<ProcessModel, "nodes"> | undefined): Set<string> {
  return new Set(model ? [...model.nodes.values()].filter((n) => n.kind === "end").map((n) => n.id) : []);
}

/** A step of the diagram (or of a subprocess it calls) that names the bean. */
export interface BeanStep {
  node: string;
  name: string;
  op: string;
  /** Call activities descended through, outermost first. */
  phase: string[];
}

/** Every `<folio:bean op>` activity in a model and the subprocesses it calls. */
export function beanStepsOf(model: Pick<ProcessModel, "nodes" | "children">, phase: string[] = []): BeanStep[] {
  const out: BeanStep[] = [];
  for (const n of model.nodes.values()) {
    if (n.workPlanOp) out.push({ node: n.id, name: n.name, op: n.workPlanOp, phase });
  }
  for (const [call, child] of model.children ?? new Map()) out.push(...beanStepsOf(child, [...phase, call]));
  return out;
}

/** One level of the drawing: a process, the steps holding a token in it, the steps done. */
export interface DiagramLevel {
  processId: string;
  /** The `.bpmn` this level was drawn from, when the model was found. */
  source?: string;
  /** Call activity this level runs inside, outermost first. */
  phase: string[];
  tokens: string[];
  done: string[];
}

/**
 * The levels to draw: the instance's own process, then each RUNNING child's,
 * so a token sitting on a call activity is followed into the step it is
 * really at. The model is optional: without one the levels still carry the
 * position, and the page says the drawing was not found.
 */
export function diagramLevels(s: InstanceState, model?: Pick<ProcessModel, "id" | "source" | "children">, phase: string[] = []): DiagramLevel[] {
  const done = [...new Set((s.history ?? []).map((h: HistoryEntry) => h.node))].filter((n) => !s.tokens.includes(n));
  const own: DiagramLevel = { processId: s.processId, ...(model ? { source: model.source } : {}), phase, tokens: [...s.tokens], done };
  const deeper = s.tokens.flatMap((t) => {
    const child = s.children?.[t];
    if (!child || child.status !== "running") return [];
    return diagramLevels(child, model?.children.get(t), [...phase, t]);
  });
  return [own, ...deeper];
}

/** A todo as the join needs it: its id, words, status, and its tags. */
export interface TodoLike {
  id: string;
  summary?: string;
  status?: string;
  processes?: readonly string[];
  tasks?: ReadonlyArray<{ process: string; task: string }>;
  references?: ReadonlyArray<{ kind: string; id: string }>;
}

/** A todo the instance's process, steps or beans name, and why it matched. */
export interface NamedTodo {
  id: string;
  summary: string;
  status: string;
  why: string;
}

/** Every process id an instance runs, its children included. */
export function processIdsOf(s: InstanceState): Set<string> {
  const out = new Set([s.processId]);
  for (const c of Object.values(s.children ?? {})) for (const p of processIdsOf(c)) out.add(p);
  return out;
}

/**
 * The todos an instance names: tagged with one of its processes, one of its
 * processes' tasks, or a bean it names — the three tags a todo carries that
 * point into this join (`todo/1.0.0`'s `processes`, `tasks`, `references`).
 */
export function todosNamedBy(s: InstanceState, todos: readonly TodoLike[]): NamedTodo[] {
  const processes = processIdsOf(s);
  const beans = new Set(beansNamedBy(s));
  const out: NamedTodo[] = [];
  for (const t of todos) {
    const why: string[] = [];
    const ps = (t.processes ?? []).filter((p) => processes.has(p));
    if (ps.length > 0) why.push(`tagged with ${ps.join(", ")}`);
    const ts = (t.tasks ?? []).filter((x) => processes.has(x.process));
    if (ts.length > 0) why.push(`tagged with step ${ts.map((x) => `${x.process}▸${x.task}`).join(", ")}`);
    const bs = (t.references ?? []).filter((r) => r.kind === "bean" && beans.has(r.id));
    if (bs.length > 0) why.push(`references ${bs.map((r) => r.id).join(", ")}`);
    if (why.length > 0) out.push({ id: t.id, summary: t.summary ?? "", status: t.status ?? "", why: why.join("; ") });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Where a bean stands against the instance set: the three states, never a blank. */
export type BeanPosition =
  | { state: "running"; instances: string[] }
  | { state: "finished"; instances: string[] }
  | { state: "none"; reason: string };

/** Why a bean no instance names has no position — the same sentence every time. */
export const NO_INSTANCE_REASON =
  "no workflow instance names it (as `bean` or in `carriedBeans`), and a bean's front matter " +
  "carries no process reference, so it has no position in any diagram: nobody ran " +
  "workflow_start for it, or the run was not committed";

/**
 * Each bean's position against the instances: named by a running one, named
 * only by finished ones, or by none — the third state, with its reason.
 */
export function beanPositions(beans: readonly Pick<BeanNode, "id">[], instances: readonly InstanceState[]): Map<string, BeanPosition> {
  const running = new Map<string, string[]>();
  const finished = new Map<string, string[]>();
  for (const s of instances) {
    for (const id of beansNamedBy(s)) {
      const into = s.status === "completed" ? finished : running;
      into.set(id, [...(into.get(id) ?? []), s.id]);
    }
  }
  const out = new Map<string, BeanPosition>();
  for (const b of beans) {
    const r = running.get(b.id);
    const f = finished.get(b.id);
    out.set(b.id, r ? { state: "running", instances: r } : f ? { state: "finished", instances: f } : { state: "none", reason: NO_INSTANCE_REASON });
  }
  return out;
}

/**
 * An instance page as another page links it: which store it is in, the
 * processes it runs, and its site-relative route (`visualiserRoute`). Links
 * and counts only — never a position, which lives in the instance file.
 */
export interface InstanceLink {
  store: string;
  id: string;
  status?: string;
  /** The instance's process and every subprocess in its `children`. */
  processIds: string[];
  /** Site-relative, from the declared route helpers. */
  route: string;
}

/** The instance pages that run each process id — itself or as a subprocess — sorted by id. */
export function instancesByProcess(links: readonly InstanceLink[]): Map<string, InstanceLink[]> {
  const out = new Map<string, InstanceLink[]>();
  for (const l of links) for (const p of new Set(l.processIds)) out.set(p, [...(out.get(p) ?? []), l]);
  for (const list of out.values()) list.sort((a, b) => a.store.localeCompare(b.store) || a.id.localeCompare(b.id));
  return out;
}

/** A role and every role it `inherits`, nearest first, each once. */
export function inheritsClosure(graph: RoleGraph | undefined, roleId: string): string[] {
  const out: string[] = [];
  let frontier = [roleId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      if (out.includes(id)) continue;
      out.push(id);
      next.push(...((graph ? findRole(graph, id)?.inherits : undefined) ?? []));
    }
    frontier = next;
  }
  return out;
}

/** The working context of one step holding a token, as the instance page shows it. */
export interface StepContext {
  node: string;
  name: string;
  kind: "activity" | "decision";
  /** Call activities above the step, outermost first, as the parent diagram names them. */
  phase: string[];
  /** The role the lane binds, when the role graph was found and the lane binds one. */
  role?: string;
  /** Roles down the call path, outermost first (the engine's `roleStack`). */
  roleStack: string[];
  /** The roles memory is joined on: the step's role and what it inherits. */
  memoryRoles: string[];
  skills: string[];
  conventions: string[];
  carriedBeans: string[];
  /** Memory tagged with one of {@link memoryRoles}. */
  roleMemory: Array<Pick<MemoryNode, "id" | "summary" | "label">>;
  /** How many untagged entries reach every step as well. */
  everyoneMemory: number;
}

/**
 * The working context of every step holding a token: the engine's own
 * `TaskContext` (role, role stack, skills, conventions, carried beans), plus
 * the memory its role reaches. Archived entries reach nobody. A model or role
 * graph that is missing yields fewer facts, never invented ones.
 */
export function workingContextOf(
  model: ProcessModel,
  state: InstanceState,
  roles: RoleGraph | undefined,
  memory: readonly MemoryNode[],
): StepContext[] {
  if (state.status === "completed") return [];
  const live = memory.filter((m) => !m.archived);
  const everyone = live.filter((m) => m.tags.roles.length === 0).length;
  let steps;
  try {
    steps = enabled(model, state, roles);
  } catch {
    return [];
  }
  return steps.map((e) => {
    const ctx = e.context;
    const role = e.role ?? ctx?.role;
    const memoryRoles = role ? inheritsClosure(roles, role) : [];
    const roleMemory = memoryForRoles(live, memoryRoles)
      .filter((m) => m.tags.roles.length > 0)
      .map((m) => ({ id: m.id, summary: m.summary, label: m.label }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return {
      node: e.node,
      name: e.name,
      kind: e.kind,
      phase: e.phase ?? [],
      ...(role ? { role } : {}),
      roleStack: ctx?.roleStack ?? [],
      memoryRoles,
      skills: ctx?.effectiveSkills ?? [],
      conventions: (ctx?.conventions ?? []).map((c) => c.ref),
      carriedBeans: ctx?.carriedBeans ?? [],
      roleMemory,
      everyoneMemory: everyone,
    };
  });
}

// ── The dynamic-state document (bean 6h47 / cat-tools-1as6) ─────────────────
//
// Owner, 2026-10-29 (Lane B card Q1, "A. Publish <harness>/state.jsonld" and
// "A. Publish state.jsonld, pages read it"): render stage 3 (`kg-dynamic`)
// publishes the running workflows' state as JSON-LD at
// `<site>/<harness>/state.jsonld`, and the workflow pages read it. It is NOT
// the stage-1 graph export: that is `../<stub>.jsonld`, typed as the graph;
// this is typed `cat-harness:DynamicState` and carries only instances,
// positions and stuck states.

/** The file the workflow pages read, under `<site>/<harness>/`. */
export const DYNAMIC_STATE_FILE = "state.jsonld";

/** The schema tag, so a reader can tell the two documents apart without the path. */
export const DYNAMIC_STATE_SCHEMA = "cat-harness-dynamic-state/v1";

const CAT_NS = "https://litlfred.github.io/cat-harness/v0/ns/";
const PROV_NS = "http://www.w3.org/ns/prov#";
const XSD_NS = "http://www.w3.org/2001/XMLSchema#";

/**
 * Every term declared with its full IRI and no `@vocab`, as `kg-export.ts`
 * does, so an undeclared key stays undeclared rather than minting an IRI.
 */
export function dynamicStateContext(): Record<string, unknown> {
  const link = { "@type": "@id" } as const;
  return {
    "@version": 1.1,
    "cat-harness": CAT_NS,
    prov: PROV_NS,
    xsd: XSD_NS,
    id: "@id",
    type: "@type",
    graph: "@graph",
    // The schema tag, as schemas/kg/jsonld.ts maps it: without a term a
    // processor drops it (publish-verify jsonld-expand: invalid property).
    $schema: { "@id": "http://purl.org/dc/terms/conformsTo" },
    generatedAt: { "@id": `${PROV_NS}generatedAtTime`, "@type": `${XSD_NS}dateTime` },
    harness: { "@id": `${CAT_NS}harness` },
    store: { "@id": `${CAT_NS}beanStore` },
    process: { "@id": `${CAT_NS}process` },
    status: { "@id": `${CAT_NS}instanceStatus` },
    tokens: { "@id": `${CAT_NS}token`, "@container": "@set" },
    lastMoved: { "@id": `${CAT_NS}lastMoved`, "@type": `${XSD_NS}dateTime` },
    beans: { "@id": `${CAT_NS}namesBean`, "@container": "@set" },
    children: { "@id": `${CAT_NS}runningChild`, "@container": "@set" },
    stuck: { "@id": `${CAT_NS}stuckState`, "@container": "@set" },
    kind: { "@id": `${CAT_NS}stuckKind` },
    detail: { "@id": `${CAT_NS}stuckDetail` },
    page: { "@id": `${CAT_NS}instancePage`, ...link },
    unreadStores: { "@id": `${CAT_NS}unreadBeanStore`, "@container": "@set" },
  };
}

export interface DynamicStateInput {
  store: string;
  state: InstanceState;
  beans: readonly BeanNode[];
  /** The diagram's end events, when it was found. */
  ends?: ReadonlySet<string>;
  /** The instance's page, site-relative, when one is drawn. */
  page?: string;
}

export interface DynamicStateInstance {
  id: string;
  type: "cat-harness:WorkflowInstance";
  store: string;
  process: string;
  status: string;
  tokens: string[];
  lastMoved?: string;
  beans: string[];
  children: Array<{ process: string; status: string; tokens: string[] }>;
  stuck: Array<{ kind: StuckKind; detail: string }>;
  page?: string;
}

export interface DynamicStateDocument {
  "@context": Record<string, unknown>;
  $schema: typeof DYNAMIC_STATE_SCHEMA;
  id: string;
  type: "cat-harness:DynamicState";
  harness: string;
  generatedAt: string;
  /** Stores that could not be read: their instances are unknown, not none. */
  unreadStores: string[];
  graph: DynamicStateInstance[];
}

/**
 * The node kind of the document above, so the docs typology's
 * `cat-harness-dynamic-state/v1` family names a validator rather than joining
 * the unkinded baseline. It checks what {@link dynamicStateDocument} writes;
 * the `@context` is the generator's own and is checked only as an object.
 */
const DynamicStateInstanceSchema = z.object({
  id: z.string(),
  type: z.literal("cat-harness:WorkflowInstance"),
  store: z.string(),
  process: z.string(),
  status: z.string(),
  tokens: z.array(z.string()),
  lastMoved: z.string().optional(),
  beans: z.array(z.string()),
  children: z.array(z.object({ process: z.string(), status: z.string(), tokens: z.array(z.string()) })),
  stuck: z.array(z.object({ kind: z.string(), detail: z.string() })),
  page: z.string().optional(),
});
export const DynamicStateKind = nodeKind(DYNAMIC_STATE_SCHEMA, [], {
  "@context": z.record(z.string(), z.unknown()),
  $schema: z.literal(DYNAMIC_STATE_SCHEMA),
  id: z.string(),
  type: z.literal("cat-harness:DynamicState"),
  harness: z.string(),
  generatedAt: z.string(),
  unreadStores: z.array(z.string()),
  graph: z.array(DynamicStateInstanceSchema),
});

/** The published document: one node per instance, sorted by store then id. */
export function dynamicStateDocument(
  harness: string,
  inputs: readonly DynamicStateInput[],
  now: Date,
  unreadStores: readonly string[] = [],
  /**
   * The address the document is published at, when known. Given, it becomes
   * the document's `@id` and its context's `@base`, so the relative instance
   * ids below resolve under a processor that is not told where the file came
   * from (publish-verify's jsonld-expand). Absent, the ids stay relative and
   * resolve against wherever the file is fetched from, as before.
   */
  docIri?: string,
): DynamicStateDocument {
  const graph = inputs
    .map((i): DynamicStateInstance => {
      const s = i.state;
      const moved = lastMoved(s);
      return {
        // Relative: it resolves against wherever the document is published.
        id: `#workflow/${i.store}/${s.id}`,
        type: "cat-harness:WorkflowInstance",
        store: i.store,
        process: s.processId,
        status: s.status ?? "unknown",
        tokens: [...s.tokens],
        ...(moved ? { lastMoved: moved } : {}),
        beans: beansNamedBy(s),
        children: Object.values(s.children ?? {}).map((c) => ({ process: c.processId, status: c.status ?? "unknown", tokens: [...c.tokens] })),
        stuck: stuckStatesOf(s, i.beans, now, i.ends ?? new Set()).map((x) => ({ kind: x.kind, detail: x.detail })),
        ...(i.page ? { page: i.page } : {}),
      };
    })
    .sort((a, b) => a.store.localeCompare(b.store) || a.id.localeCompare(b.id));
  return {
    "@context": docIri ? { ...dynamicStateContext(), "@base": docIri } : dynamicStateContext(),
    $schema: DYNAMIC_STATE_SCHEMA,
    id: docIri ?? "",
    type: "cat-harness:DynamicState",
    harness,
    generatedAt: now.toISOString(),
    unreadStores: [...unreadStores].sort(),
    graph,
  };
}
