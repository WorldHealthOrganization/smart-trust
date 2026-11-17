/**
 * What a journey does not say because something else already does: the
 * DAK's personas (roles), a step's people when the author gives none, and the
 * composition a parent's `parts` implies.
 *
 * @module scripts/journeys/derive
 * @covers user-scenario
 *
 * ## One source per fact
 *
 * | derived | from | authored instead |
 * |---|---|---|
 * | the DAK `personas` (roles) | each persona actor's `roles`; a persona that is a role, as it is | never |
 * | a role persona's actors | the actors whose `roles` name it, the journey's layer first | — |
 * | a parent's `personas`, when absent | its parts' personas, in order | when the parent has people of its own |
 * | a step's `experiences` and `lead`, when absent | the actors among the personas who play the lanes of its `realisedBy` tasks, each "doing" those tasks | the narrative: who is there and how they feel |
 * | a part's parent, and which part it follows | the parent's `parts`, in order | never (0.4.0 refuses `partOf`; a listed part carries no `follows`) |
 *
 * Composition itself is NOT derived. Journeys are narrative: a BPMN call
 * activity or a sub-process is not a journey until somebody writes one, so
 * `parts` and `includes` are authored, and the BPMN is only held against an
 * `includes` that names a call activity ({@link includeConflict}).
 *
 * The reader resolves every journey through {@link resolveScenario}, so the
 * viewer draws the derived values and `check:journey-refs` holds the authored
 * ones against them: an authored value that only repeats the derived one is a
 * finding ("redundant: remove it").
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import type { DakUserScenario, Experience, Part, Scenario, ScenarioStep, UserScenario } from "../../schemas/process/user-scenario.ts";
import type { Actor, Journey, JourneyCorpus } from "./read.ts";

/** Look a key up in the layer's own map first, then in every other layer's. */
export function lookup<T>(per: Map<string, Map<string, T>>, instance: string, id: string): T | undefined {
  const own = per.get(instance)?.get(id);
  if (own !== undefined) return own;
  for (const [name, m] of per) if (name !== instance && m.has(id)) return m.get(id);
  return undefined;
}

/** A path a journey names, relative to its layer's root: absolute when the file exists. */
export function instanceFile(corpus: Pick<JourneyCorpus, "instances">, instance: string, path: string): string | undefined {
  const info = corpus.instances.get(instance);
  if (info === undefined) return undefined;
  const p = resolve(info.root, path);
  // Never outside the layer: `../` in a journey is not a reference into another repository.
  if (relative(info.root, p).startsWith("..")) return undefined;
  return existsSync(p) && statSync(p).isFile() ? p : undefined;
}

// ── BPMN: what a step's tasks are, and whose lane they are in ─────────────

/** One flow node of a BPMN file. */
export interface BpmnNode {
  /** The element's local name: `task`, `userTask`, `callActivity` … */
  tag: string;
  name?: string;
  /** A call activity's called process id. */
  calledElement?: string;
  /** The innermost lane it is in, by id. */
  lane?: string;
}

/** What a step needs of a BPMN file. */
export interface BpmnModel {
  /** The ids of its `process` elements. */
  processes: Set<string>;
  nodes: Map<string, BpmnNode>;
  /** Its lanes by id: the role a lane's `partitionElementRef` names, and its name. */
  lanes: Map<string, { ref?: string; name?: string }>;
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescape = (t: string): string => t.replace(/&(amp|lt|gt|quot|apos);/g, (_, n: string) => XML_ENTITIES[n]!);
const attr = (attrs: string, name: string): string | undefined => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(attrs);
  return m ? unescape(m[1]!) : undefined;
};

/** Parse the parts of a BPMN document a step needs: processes, flow nodes, lanes and which lane holds each node. */
export function parseBpmn(xml: string): BpmnModel {
  const model: BpmnModel = { processes: new Set(), nodes: new Map(), lanes: new Map() };
  const lanes: string[] = [];
  let inRef = false;
  const re = /<(\/?)(?:[A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)\b([^>]*?)(\/?)>|([^<]+)/g;
  for (const m of xml.matchAll(re)) {
    const [, close, tag, attrs = "", selfClose, text] = m;
    if (text !== undefined) {
      if (inRef && lanes.length > 0) {
        const id = text.trim();
        const node = model.nodes.get(id) ?? { tag: "" };
        node.lane = lanes[lanes.length - 1];
        model.nodes.set(id, node);
      }
      continue;
    }
    if (tag === "flowNodeRef") {
      inRef = !close && !selfClose;
      continue;
    }
    if (tag === "lane") {
      if (close) lanes.pop();
      else {
        const id = attr(attrs, "id");
        if (id === undefined) continue;
        model.lanes.set(id, { ...(attr(attrs, "partitionElementRef") ? { ref: attr(attrs, "partitionElementRef")! } : {}), ...(attr(attrs, "name") ? { name: attr(attrs, "name")! } : {}) });
        if (!selfClose) lanes.push(id);
      }
      continue;
    }
    if (close) continue;
    const id = attr(attrs, "id");
    if (id === undefined) continue;
    if (tag === "process") model.processes.add(id);
    const prior = model.nodes.get(id);
    model.nodes.set(id, {
      tag: tag!,
      ...(attr(attrs, "name") ? { name: attr(attrs, "name")! } : {}),
      ...(attr(attrs, "calledElement") ? { calledElement: attr(attrs, "calledElement")! } : {}),
      ...(prior?.lane ? { lane: prior.lane } : {}),
    });
  }
  return model;
}

const bpmnCache = new WeakMap<object, Map<string, BpmnModel | undefined>>();

/** The BPMN file a step names, parsed once per corpus; undefined when there is no such file. */
export function bpmnModel(corpus: Pick<JourneyCorpus, "instances">, instance: string, process: string): BpmnModel | undefined {
  const cache = bpmnCache.get(corpus) ?? new Map<string, BpmnModel | undefined>();
  bpmnCache.set(corpus, cache);
  const key = `${instance}\u0000${process}`;
  if (!cache.has(key)) {
    const file = instanceFile(corpus, instance, process);
    cache.set(key, file === undefined ? undefined : parseBpmn(readFileSync(file, "utf8")));
  }
  return cache.get(key);
}

// ── roles and actors ──────────────────────────────────────────────────────

/** The role a lane is: its `partitionElementRef` when that names a role, else the role whose title or other name is the lane's name. */
export function laneRole(corpus: JourneyCorpus, instance: string, lane: { ref?: string; name?: string }): string | undefined {
  if (lane.ref !== undefined && lookup(corpus.roles, instance, lane.ref) !== undefined) return lane.ref;
  const name = lane.name?.trim().toLowerCase();
  if (!name) return undefined;
  const byName = (roles: Map<string, { title?: string; otherNames?: string[] }> | undefined) =>
    [...(roles ?? new Map()).entries()].find(([id, r]) => id === name || r.title?.toLowerCase() === name || (r.otherNames ?? []).some((o: string) => o.toLowerCase() === name))?.[0];
  return byName(corpus.roles.get(instance)) ?? [...corpus.roles.keys()].filter((n) => n !== instance).map((n) => byName(corpus.roles.get(n))).find((r) => r !== undefined);
}

/** The actors who play a role: the layer's own first, else the checkout's. */
export function actorsPlaying(corpus: JourneyCorpus, instance: string, role: string): Actor[] {
  const plays = (m: Map<string, Actor> | undefined) => [...(m ?? new Map<string, Actor>()).values()].filter((a) => a.roles?.includes(role));
  const own = plays(corpus.actors.get(instance));
  return own.length ? own : [...corpus.actors.entries()].filter(([n]) => n !== instance).flatMap(([, m]) => plays(m));
}

/** Is this persona entry a role (and no actor)? */
export function isRolePersona(corpus: JourneyCorpus, instance: string, id: string): boolean {
  return lookup(corpus.actors, instance, id) === undefined && lookup(corpus.roles, instance, id) !== undefined;
}

// ── composition ──────────────────────────────────────────────────────────

/** A journey by id: the layer's own first. */
export function journeyById(corpus: Pick<JourneyCorpus, "journeys">, instance: string, id: string): Journey | undefined {
  return corpus.journeys.find((j) => j.instance === instance && j.scenario.id === id) ?? corpus.journeys.find((j) => j.scenario.id === id);
}

/** A journey's `parts` as its file says them, whatever its family. */
export const partsOf = (s: Pick<UserScenario, "parts">): readonly Part[] => s.parts ?? [];

/** The journeys that list `j` in their `parts`, and (an older file) the one its `partOf` names. */
export function parentsOf(corpus: JourneyCorpus, j: Journey): Journey[] {
  const out = corpus.journeys.filter((p) => partsOf(p.scenario).some((x) => journeyById(corpus, p.instance, x.scenario) === j));
  const legacy = j.scenario.partOf === undefined ? undefined : journeyById(corpus, j.instance, j.scenario.partOf);
  if (legacy && !out.includes(legacy)) out.push(legacy);
  return out;
}

/** Is `j` listed in some parent's `parts`? Then its place in the story is the parent's to say. */
export const isListedPart = (corpus: JourneyCorpus, j: Journey): boolean =>
  corpus.journeys.some((p) => partsOf(p.scenario).some((x) => journeyById(corpus, p.instance, x.scenario) === j));

// ── one journey, resolved ────────────────────────────────────────────────

const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

/**
 * The persona ACTORS of a journey: each authored persona that is an actor, the
 * actors who play each that is a role, and, with none authored, its parts'
 * (recursively, each journey once).
 */
export function personaActors(corpus: JourneyCorpus, j: Journey, seen = new Set<Journey>()): string[] {
  if (seen.has(j)) return [];
  seen.add(j);
  const authored = j.authored.personas;
  if (authored === undefined) return derivedPersonas(corpus, j, seen);
  return uniq(authored.flatMap((id) => (isRolePersona(corpus, j.instance, id) ? actorsPlaying(corpus, j.instance, id).map((a) => a.id) : [id])));
}

/** A journey's personas as its parts give them, in part order; empty without parts. */
export function derivedPersonas(corpus: JourneyCorpus, j: Journey, seen = new Set<Journey>([j])): string[] {
  return uniq(partsOf(j.authored).flatMap((p) => {
    const part = journeyById(corpus, j.instance, p.scenario);
    return part ? personaActors(corpus, part, seen) : [];
  }));
}

/**
 * A step's people, derived: the persona actors who play the role of a lane of
 * one of its `realisedBy` tasks, each doing those tasks (by name). Empty when
 * the step names no task in a lane a persona plays.
 */
export function laneExperiences(corpus: JourneyCorpus, instance: string, personas: readonly string[], step: Pick<ScenarioStep, "realisedBy">): Experience[] {
  const doing = new Map<string, string[]>();
  for (const r of step.realisedBy ?? []) {
    const m = bpmnModel(corpus, instance, r.process);
    if (m === undefined) continue;
    for (const t of r.tasks ?? []) {
      const node = m.nodes.get(t);
      const lane = node?.lane === undefined ? undefined : m.lanes.get(node.lane);
      const role = lane === undefined ? undefined : laneRole(corpus, instance, lane);
      if (role === undefined) continue;
      for (const id of personas) {
        if (!lookup(corpus.actors, instance, id)?.roles?.includes(role)) continue;
        const into = doing.get(id) ?? [];
        into.push(node!.name ?? t);
        doing.set(id, into);
      }
    }
  }
  return [...doing.entries()].map(([actor, tasks]) => ({ actor, doing: uniq(tasks).join("; ") }));
}

/** A journey as the viewer draws it: personas as actors, and every step with its people. */
export function resolveScenario(corpus: JourneyCorpus, j: Journey): Scenario {
  const personas = personaActors(corpus, j);
  const steps = j.authored.steps.map((s): ScenarioStep => {
    const experiences = s.experiences ?? laneExperiences(corpus, j.instance, personas, s);
    return { ...s, experiences, lead: s.lead ?? experiences[0]?.actor ?? "" };
  });
  return { ...j.authored, personas, steps };
}

/** The DAK `UserScenario` a journey is: its personas are the ROLES its persona actors play (a role persona as it is). */
export function dakUserScenario(corpus: JourneyCorpus, j: Journey): DakUserScenario {
  const roles = (j.authored.personas ?? personaActors(corpus, j)).flatMap((id) =>
    isRolePersona(corpus, j.instance, id) ? [id] : (lookup(corpus.actors, j.instance, id)?.roles ?? []),
  );
  return { id: j.scenario.id, title: j.scenario.title, description: j.scenario.description, personas: uniq(roles) };
}

/**
 * Does a step's `includes` agree with the call activity its `realisedBy`
 * names? `undefined`: no call activity, nothing to hold it against. Else
 * `ok`, a `mismatch` naming both, or `unknown` when the call names no process
 * or the included journey is realised by no BPMN on disk.
 */
export function includeConflict(corpus: JourneyCorpus, j: Journey, step: Pick<ScenarioStep, "realisedBy" | "includes">): { status: "ok" | "mismatch" | "unknown"; detail: string } | undefined {
  if (step.includes === undefined) return undefined;
  const calls: { task: string; called?: string }[] = [];
  for (const r of step.realisedBy ?? []) {
    const m = bpmnModel(corpus, j.instance, r.process);
    for (const t of r.tasks ?? []) {
      const n = m?.nodes.get(t);
      if (n?.tag === "callActivity") calls.push({ task: t, ...(n.calledElement ? { called: n.calledElement } : {}) });
    }
  }
  if (calls.length === 0) return undefined;
  const included = journeyById(corpus, j.instance, step.includes);
  if (included === undefined) return undefined; // an unresolved `includes` is its own finding
  const processes = new Set<string>();
  for (const s of included.scenario.steps) for (const r of s.realisedBy ?? []) for (const p of bpmnModel(corpus, included.instance, r.process)?.processes ?? []) processes.add(p);
  const unnamed = calls.filter((c) => c.called === undefined);
  if (unnamed.length) return { status: "unknown", detail: `call activity ${unnamed.map((c) => c.task).join(", ")} names no calledElement` };
  if (processes.size === 0) return { status: "unknown", detail: `journey ${step.includes} is realised by no BPMN process on disk` };
  const wrong = calls.filter((c) => !processes.has(c.called!));
  return wrong.length
    ? { status: "mismatch", detail: `call activity ${wrong.map((c) => `${c.task} calls ${c.called}`).join(", ")}, but journey ${step.includes} is realised by ${[...processes].join(", ")}` }
    : { status: "ok", detail: "" };
}
