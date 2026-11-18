/**
 * Roles, actors and capabilities EXTENDED BY ID from a higher layer's own
 * `scenarios/`.
 *
 * @module schemas/scenario-overlay
 * @graphNode schema
 *
 * A role→skill edge naming a skill that belongs above the harness has to live
 * in the higher layer, pointing down; otherwise the harness holds an UPWARD
 * reference.
 *
 * ## The rule — the dependent holds the pointer
 *
 * As a story points at the role it is told as, a higher layer's
 * `scenarios/` may:
 *
 * | what | how | what it may change |
 * |---|---|---|
 * | extend a ROLE | `roles.json` → `extensions: [{ "role": "<id>", "skills": […] }]` | adds skills; nothing else |
 * | add a ROLE | `roles.json` → `roles: […]`, a NEW id | its own role; may `inherits` a lower one |
 * | extend an ACTOR | `actors/<file>.json` with `"extends": "<actor id>"` | adds `roles` and `capabilities`; nothing else |
 * | add an ACTOR | `actors/<file>.json` without `extends`, a NEW id | its own actor |
 * | extend a CAPABILITY | `capabilities/<file>.json` with `"extends": "<capability id>"` | adds `requires`; nothing else |
 * | add a CAPABILITY | `capabilities/<file>.json`, a NEW id | its own probe |
 * | add a POLICY | `policies/<file>.jsonld`, a NEW `uid` | its own ODRL rules, e.g. the grants of the actors it adds |
 *
 * Id-matching is the same rule as a directory override and as `inherits`.
 * **Redeclaring a lower id is refused**, not merged, so the lower layer's
 * audit and the checkout's agree on what the role IS. An extension may only
 * name something declared BELOW it.
 *
 * ### The one exception: a move in flight
 *
 * Moving a role, actor, capability or policy UP is two pull requests: the
 * higher layer adds it, then the lower layer removes it. A redeclaration that
 * **only adds** ({@link onlyAdds}) is therefore accepted with a warning, and
 * the higher declaration is used: every field of the lower one is present
 * unchanged (scalars equal, array members kept, nested objects recursively),
 * and the higher may carry more. `_`-keys are not compared. The warning names
 * the id and both layers and says to remove the lower copy. A redeclaration
 * that changes or drops anything is refused.
 *
 * Skill front matter does not carry `roles:`; the edge stays on the role
 * graph, spread across layers.
 *
 * ## Where the layers come from
 *
 * The base is the layer asked about; the layers are the CHECKOUT's
 * layers that depend on it ({@link checkoutDependentsOf}), deepest first.
 * Resolved alone, a layer sees only its own graph.
 *
 * Auditing ONE layer asks the other direction: which actors may its
 * requirements and lanes name? Those are the platform's, every layer it
 * `needs`, and its own ({@link neededActors}) — never a dependent's.
 *
 * ## Policies travel with the actors they grant
 *
 * An actor a higher layer adds holds its grants in THAT layer's
 * `policies/`. {@link checkoutPolicies} and {@link neededPolicies} read the
 * same layers as the actor overlay, by the same rule: a new `uid` is added, a
 * redeclared one is refused unless it only adds. A policy may `inheritFrom` a
 * lower one; it cannot edit it.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { ownDirectoryById } from "../kg/cat-harness";
import { checkoutDependentsOf, instanceConfigFor, orderedDependencies } from "../kg/harness-config";
import { POLICY_DIR, readPolicies, type OdrlPolicy } from "../content/odrl";
import {
  ACTORS_DIRNAME,
  CAPABILITIES_DIRNAME,
  readActors,
  readRoleGraph,
  type LoadedActor,
  type RoleDef,
  type RoleGraph,
} from "./role-graph";

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(b)) {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return (
      ka.length === kb.length &&
      ka.every((k) => Object.hasOwn(b as object, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
    );
  }
  return false;
}

/**
 * Whether `higher` keeps everything `lower` declares and only adds to it: an
 * equal scalar, an array holding every member of the lower one (each member
 * unchanged), an object holding every key of the lower one by this same rule.
 * `_`-keys are documentation and are not compared. This is the test a
 * redeclared id must pass to be accepted as a move in flight (owner,
 * 2026-10-23, "Relax the rule"); see the module doc.
 */
export function onlyAdds(lower: unknown, higher: unknown): boolean {
  if (Array.isArray(lower)) return Array.isArray(higher) && lower.every((x) => higher.some((y) => deepEqual(x, y)));
  if (lower && typeof lower === "object") {
    if (!higher || typeof higher !== "object" || Array.isArray(higher)) return false;
    return Object.entries(lower as Record<string, unknown>).every(
      ([k, v]) => k.startsWith("_") || (Object.hasOwn(higher, k) && onlyAdds(v, (higher as Record<string, unknown>)[k])),
    );
  }
  return lower === higher;
}

const warned = new Set<string>();

/**
 * Say, once per process, that a higher layer redeclares a lower id and only
 * adds to it: accepted, and the move it belongs to is unfinished. The same
 * `console.warn` the loaders already use (`readRoleGraph`, `harness-config`).
 */
function warnMoveInFlight(kind: string, id: string, lower: string, higher: string): void {
  const msg =
    `⚠ ${kind} "${id}" is declared by ${lower} and redeclared by ${higher}, which only adds to it: ` +
    `a move in flight, accepted (owner, 2026-10-23). The higher declaration is used. Finish the move by ` +
    `removing the copy in ${lower}.`;
  if (warned.has(msg)) return;
  warned.add(msg);
  console.warn(msg);
}

/** A higher layer's `scenarios/` directory, as an overlay layer. */
export interface ScenarioLayer {
  /** The layer's declared name. */
  instance: string;
  /** Absolute path of its `scenarios` directory. */
  dir: string;
}

/**
 * The `scenarios` directories of every checkout layer that depends on
 * `instanceRoot`, deepest first. Each is asked of THAT layer's own
 * declaration — never inherited — so the harness's own `scenarios/` is never
 * read twice as a layer of itself.
 */
export function scenarioLayersAbove(instanceRoot: string): ScenarioLayer[] {
  const out: ScenarioLayer[] = [];
  for (const dep of checkoutDependentsOf(instanceRoot)) {
    // declared-path-literal: the convention fallback, at the call site, as
    // `kg-audit` reads a dependency's scenarios — the id is asked first.
    const dir = ownDirectoryById(dep.root, "scenarios", "scenarios");
    if (existsSync(dir)) out.push({ instance: dep.name, dir: resolve(dir) });
  }
  return out;
}

/** Who added what to a role, for a report that must name the layer. */
export interface RoleExtensionRecord {
  instance: string;
  role: string;
  skills: string[];
}

/**
 * Overlay higher layers' role graphs onto `base`.
 *
 * Throws on a redeclared id that does not only add (a move in flight that
 * only adds is accepted with a warning), an extension naming no lower role, or a new
 * role inheriting an undeclared one — the same loud stance `readRoleGraph`
 * takes, because a quietly short skill set is the failure this repository
 * keeps paying for.
 */
export function overlayRoleGraphs(
  base: RoleGraph,
  layers: ReadonlyArray<{ instance: string; graph: RoleGraph }>,
  baseInstance = base.name,
): { graph: RoleGraph; extensions: RoleExtensionRecord[] } {
  const roles = new Map<string, RoleDef>(base.roles.map((r) => [r.id, { ...r, skills: [...(r.skills ?? [])] }]));
  const owner = new Map<string, string>(base.roles.map((r) => [r.id, baseInstance]));
  // Each role as its owner DECLARED it, before any extension: what a
  // redeclaration is compared against.
  const declared = new Map<string, RoleDef>(base.roles.map((r) => [r.id, r]));
  const records: RoleExtensionRecord[] = [];
  for (const { instance, graph } of layers) {
    // Extensions first, against what is BELOW this layer: an extension of a
    // role this same layer adds is a role edited in two places of one file.
    for (const ext of graph.extensions ?? []) {
      const target = roles.get(ext.role);
      if (target === undefined) {
        throw new Error(
          `${instance}: extends role "${ext.role}", which no instance below it declares. ` +
            `An extension points DOWN at a lower instance's role; a role this instance owns is declared under \`roles\`.`,
        );
      }
      const have = new Set(target.skills ?? []);
      const added = ext.skills.filter((s) => !have.has(s));
      target.skills = [...(target.skills ?? []), ...added];
      records.push({ instance, role: ext.role, skills: added });
    }
    for (const r of graph.roles) {
      const prev = owner.get(r.id);
      if (prev !== undefined && !onlyAdds(declared.get(r.id), r)) {
        throw new Error(
          `${instance}: role "${r.id}" is already declared by ${prev}. A higher instance adds skills to a lower ` +
            `role with \`extensions: [{ "role": "${r.id}", "skills": [...] }]\`; it never redeclares it ` +
            `(a move in flight may redeclare it only by adding to it, never by changing or dropping anything).`,
        );
      }
      if (prev !== undefined) warnMoveInFlight("role", r.id, prev, instance);
      for (const parent of r.inherits ?? []) {
        if (!roles.has(parent) && !graph.roles.some((x) => x.id === parent)) {
          throw new Error(`${instance}: role "${r.id}" inherits "${parent}", which is declared nowhere at or below it.`);
        }
      }
      // A move in flight keeps what lower layers' extensions added, too.
      roles.set(r.id, { ...r, skills: union(r.skills, roles.get(r.id)?.skills) ?? [] });
      owner.set(r.id, instance);
      declared.set(r.id, r);
    }
  }
  return { graph: { ...base, roles: [...roles.values()] }, extensions: records };
}

/**
 * The role graph of `instanceRoot` as its CHECKOUT sees it: its own graph,
 * then every dependent's `scenarios/roles.json` overlaid by id.
 *
 * `undefined` when the layer has no role graph of its own. Identical to the
 * layer's own graph when no dependent extends it — which is every role on
 * the day PR0 lands, and the falsifier it is held to.
 */
export function checkoutRoleGraph(
  instanceRoot: string,
  own: RoleGraph | undefined,
): { graph: RoleGraph; extensions: RoleExtensionRecord[] } | undefined {
  if (own === undefined) return undefined;
  const baseName = instanceConfigFor(instanceRoot)?.name ?? own.name;
  const layers: Array<{ instance: string; graph: RoleGraph }> = [];
  const known = new Set(own.roles.map((r) => r.id));
  for (const layer of scenarioLayersAbove(instanceRoot)) {
    const g = readRoleGraph(layer.dir, known);
    if (g === undefined) continue;
    const roles = g.roles.map((r) => ({ ...r, skills: [...(r.skills ?? [])] }));
    const byOwnId = new Map(roles.map((r) => [r.id, r]));
    const extensions = (g.extensions ?? []).filter((ext) => {
      if (known.has(ext.role)) return true;
      // Move in flight across repositories: the lower layer removed `ext.role`
      // while the mounted dependent either still pins the pre-move `extensions`
      // entry or carries both `roles` and `extensions` before folding them.
      const movedHere = byOwnId.get(ext.role);
      if (movedHere !== undefined) {
        movedHere.skills = union(movedHere.skills, ext.skills) ?? [];
      }
      warnMoveInFlight("role extension", ext.role, baseName, layer.instance);
      return false;
    });
    layers.push({ instance: layer.instance, graph: { ...g, roles, extensions } });
    for (const r of roles) known.add(r.id);
  }
  return overlayRoleGraphs(own, layers, baseName);
}

/** The fields an actor or capability EXTENSION may carry besides its pointer. */
const ACTOR_EXTENSION_FIELDS = new Set(["extends", "roles", "capabilities"]);
const CAPABILITY_EXTENSION_FIELDS = new Set(["extends", "requires"]);

function readJson(p: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`${p} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function jsonFiles(dir: string): string[] {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => join(dir, f))
    : [];
}

/** Refuse any field an extension may not carry; `_`-keys are documentation. */
function onlyExtensionFields(raw: Record<string, unknown>, allowed: ReadonlySet<string>, p: string): void {
  const bad = Object.keys(raw).filter((k) => !k.startsWith("_") && k !== "$schema" && !allowed.has(k));
  if (bad.length > 0) {
    throw new Error(
      `${p}: an extension adds ${[...allowed].filter((k) => k !== "extends").join(" and ")} only; ` +
        `it may not carry ${bad.join(", ")} — override nothing, add only.`,
    );
  }
}

function union(a: readonly string[] | undefined, b: unknown): string[] | undefined {
  if (!Array.isArray(b)) return a === undefined ? undefined : [...a];
  const out = [...(a ?? [])];
  for (const x of b) if (typeof x === "string" && !out.includes(x)) out.push(x);
  return out;
}

/** An actor file as written, for comparing a redeclaration with what it redeclares. */
function rawActor(a: LoadedActor): Record<string, unknown> {
  return existsSync(a.path) ? readJson(a.path) : { ...a };
}

/**
 * Overlay higher layers' actor directories onto `base`: a file with
 * `extends` adds `roles` and `capabilities` to a lower actor; any other file
 * is a new actor, refused if its id is already taken — unless the file only
 * adds to the lower one's, a move in flight ({@link onlyAdds}): then it is
 * used, with a warning.
 */
export function overlayActors(
  base: readonly LoadedActor[],
  layers: ReadonlyArray<{ instance: string; dir: string }>,
  grants?: ReadonlyMap<string, readonly string[]>,
  baseInstance = "the instance below",
): LoadedActor[] {
  const byId = new Map<string, LoadedActor>(base.map((a) => [a.id, { ...a }]));
  const owner = new Map<string, string>(base.map((a) => [a.id, baseInstance]));
  for (const { instance, dir } of layers) {
    for (const p of jsonFiles(dir)) {
      const raw = readJson(p);
      if (typeof raw.extends !== "string") continue;
      onlyExtensionFields(raw, ACTOR_EXTENSION_FIELDS, p);
      const target = byId.get(raw.extends);
      if (target === undefined) {
        throw new Error(`${p} (${instance}): extends actor "${raw.extends}", which no instance below it declares.`);
      }
      target.roles = union(target.roles, raw.roles);
      target.capabilities = union(target.capabilities, raw.capabilities);
    }
    for (const a of readActors(dir, grants)) {
      const prev = byId.get(a.id);
      // Two files of ONE layer declaring an id is a duplicate, never a move.
      if (prev !== undefined && (owner.get(a.id) === instance || !onlyAdds(rawActor(prev), readJson(a.path)))) {
        throw new Error(
          `${a.path} (${instance}): actor "${a.id}" is already declared below. Extend it with ` +
            `\`"extends": "${a.id}"\` and the roles or capabilities to add; never redeclare it ` +
            `(a move in flight may redeclare it only by adding to it, never by changing or dropping anything).`,
        );
      }
      if (prev !== undefined) {
        warnMoveInFlight("actor", a.id, `${owner.get(a.id)} (${prev.path})`, `${instance} (${a.path})`);
        // What lower layers' extensions added stays.
        a.roles = union(a.roles, prev.roles);
        a.capabilities = union(a.capabilities, prev.capabilities);
      }
      byId.set(a.id, a);
      owner.set(a.id, instance);
    }
  }
  return [...byId.values()];
}

/** The actor registry of `instanceRoot`'s checkout: its own, then dependents' overlays. */
export function checkoutActors(
  instanceRoot: string,
  ownActorsDir: string,
  grants?: ReadonlyMap<string, readonly string[]>,
): LoadedActor[] {
  const layers = scenarioLayersAbove(instanceRoot).map((l) => ({ instance: l.instance, dir: join(l.dir, ACTORS_DIRNAME) }));
  return overlayActors(readActors(ownActorsDir, grants), layers, grants, instanceConfigFor(instanceRoot)?.name);
}

/** A capability probe, as its JSON file declares it. */
export type CapabilityRecord = Record<string, unknown> & { id: string; path: string };

/**
 * Overlay higher layers' capability directories onto `base`'s: a file with
 * `extends` adds `requires` to a lower probe; any other file is a new probe,
 * refused if its id is already taken — unless it only adds to the lower one,
 * a move in flight ({@link onlyAdds}): then it is used, with a warning.
 */
export function overlayCapabilities(
  baseDir: string,
  layers: ReadonlyArray<{ instance: string; dir: string }>,
): CapabilityRecord[] {
  const byId = new Map<string, CapabilityRecord>();
  const declared = new Map<string, { raw: Record<string, unknown>; where: string; instance?: string }>();
  const add = (p: string, raw: Record<string, unknown>, instance?: string): void => {
    const id = String(raw.id ?? p.replace(/^.*\//, "").slice(0, -5));
    const prev = declared.get(id);
    // Two files of ONE layer declaring an id is a duplicate, never a move.
    if (prev !== undefined && (instance === undefined || prev.instance === instance || !onlyAdds(prev.raw, raw))) {
      throw new Error(
        `${p}${instance ? ` (${instance})` : ""}: capability "${id}" is already declared below. ` +
          `Extend it with \`"extends": "${id}"\`; never redeclare it ` +
          `(a move in flight may redeclare it only by adding to it, never by changing or dropping anything).`,
      );
    }
    const where = `${instance ?? "the instance below"} (${p})`;
    if (prev !== undefined) warnMoveInFlight("capability", id, prev.where, where);
    const requires = union(raw.requires as string[] | undefined, byId.get(id)?.requires);
    byId.set(id, { ...raw, id, path: p, ...(requires === undefined ? {} : { requires }) });
    declared.set(id, { raw, where, instance });
  };
  for (const p of jsonFiles(baseDir)) add(p, readJson(p));
  for (const { instance, dir } of layers) {
    const files = jsonFiles(dir).map((p) => ({ p, raw: readJson(p) }));
    for (const { p, raw } of files) {
      if (typeof raw.extends !== "string") continue;
      onlyExtensionFields(raw, CAPABILITY_EXTENSION_FIELDS, p);
      const target = byId.get(raw.extends);
      if (target === undefined) {
        throw new Error(`${p} (${instance}): extends capability "${raw.extends}", which no instance below it declares.`);
      }
      target.requires = union(target.requires as string[] | undefined, raw.requires);
    }
    for (const { p, raw } of files) if (typeof raw.extends !== "string") add(p, raw, instance);
  }
  return [...byId.values()];
}

/** The capability registry of `instanceRoot`'s checkout. */
export function checkoutCapabilities(instanceRoot: string, ownCapabilitiesDir: string): CapabilityRecord[] {
  const layers = scenarioLayersAbove(instanceRoot).map((l) => ({
    instance: l.instance,
    dir: join(l.dir, CAPABILITIES_DIRNAME),
  }));
  return overlayCapabilities(ownCapabilitiesDir, layers);
}

/**
 * The `scenarios` directories of every layer `instanceRoot` needs, deepest
 * first, then its own: the layers below a layer, as
 * {@link scenarioLayersAbove} gives the layers above one.
 */
export function scenarioLayersBelow(instanceRoot: string): ScenarioLayer[] {
  const out: ScenarioLayer[] = [];
  const seen = new Set<string>();
  const add = (instance: string, root: string): void => {
    // declared-path-literal: the convention fallback, as scenarioLayersAbove.
    const dir = resolve(ownDirectoryById(root, "scenarios", "scenarios"));
    if (seen.has(dir) || !existsSync(dir)) return;
    seen.add(dir);
    out.push({ instance, dir });
  };
  for (const d of orderedDependencies(instanceRoot)) add(d.dependency.name, d.rootPath);
  add(instanceConfigFor(instanceRoot)?.name ?? instanceRoot, instanceRoot);
  return out;
}

/**
 * The actors a layer's requirements and lanes may name: the platform's
 * registry, overlaid with the `scenarios/actors/` of every layer it needs
 * and then its own.
 *
 * Before this, a layer audit read the platform's registry alone, so a
 * downstream that declared the actors of its own domain (the IHE ITI VHL
 * Sharer and Receiver, say) saw every requirement naming them fail
 * `requirement-actors-resolve`, and every role they take on fail
 * `role-has-actor` — while the platform's own run, which overlays its
 * dependents, found them. The same rules apply as in the checkout overlay: a
 * new id is added, `extends` adds roles and capabilities, a redeclared id is
 * refused.
 */
export function neededActors(
  instanceRoot: string,
  platformActorsDir: string,
  grants?: ReadonlyMap<string, readonly string[]>,
): LoadedActor[] {
  const platformScenarios = resolve(platformActorsDir, "..");
  const layers = scenarioLayersBelow(instanceRoot)
    .filter((l) => l.dir !== platformScenarios)
    .map((l) => ({ instance: l.instance, dir: join(l.dir, ACTORS_DIRNAME) }));
  return overlayActors(readActors(platformActorsDir, grants), layers, grants, instanceConfigFor(platformActorsDir)?.name);
}

/**
 * The `policies` directories of every checkout layer that depends on
 * `instanceRoot`, deepest first — {@link scenarioLayersAbove}, one graph over.
 */
export function policyLayersAbove(instanceRoot: string): ScenarioLayer[] {
  const out: ScenarioLayer[] = [];
  for (const dep of checkoutDependentsOf(instanceRoot)) {
    // declared-path-literal: the convention fallback, at the call site, as
    // scenarioLayersAbove reads a dependent's scenarios.
    const dir = ownDirectoryById(dep.root, POLICY_DIR, POLICY_DIR);
    if (existsSync(dir)) out.push({ instance: dep.name, dir: resolve(dir) });
  }
  return out;
}

/**
 * The `policies` directories of every layer `instanceRoot` needs, deepest
 * first, then its own — {@link scenarioLayersBelow}, one graph over.
 */
export function policyLayersBelow(instanceRoot: string): ScenarioLayer[] {
  const out: ScenarioLayer[] = [];
  const seen = new Set<string>();
  const add = (instance: string, root: string): void => {
    // declared-path-literal: the convention fallback, as policyLayersAbove.
    const dir = resolve(ownDirectoryById(root, POLICY_DIR, POLICY_DIR));
    if (seen.has(dir) || !existsSync(dir)) return;
    seen.add(dir);
    out.push({ instance, dir });
  };
  for (const d of orderedDependencies(instanceRoot)) add(d.dependency.name, d.rootPath);
  add(instanceConfigFor(instanceRoot)?.name ?? instanceRoot, instanceRoot);
  return out;
}

/**
 * Overlay higher layers' policies onto `base`, keyed by `uid`. A layer adds
 * policies; a `uid` already declared below is refused, as a redeclared role or
 * actor is: a higher layer that could replace a lower policy could take a
 * grant away without the lower layer's own audit seeing it. The exception
 * is the same as theirs: a redeclaration that only adds — every rule the lower
 * policy states is in it unchanged — is a move in flight, used with a warning.
 */
export function overlayPolicies(
  base: ReadonlyMap<string, OdrlPolicy>,
  layers: ReadonlyArray<{ instance: string; dir: string }>,
  baseInstance = "the instance below",
): Map<string, OdrlPolicy> {
  const out = new Map(base);
  const owner = new Map<string, string>([...base.keys()].map((uid) => [uid, baseInstance]));
  for (const { instance, dir } of layers) {
    for (const [uid, p] of readPolicies(dir)) {
      const prev = out.get(uid);
      if (prev !== undefined && !onlyAdds(prev, p)) {
        throw new Error(
          `${dir} (${instance}): policy "${uid}" is already declared below. A higher instance writes its own ` +
            `policy with a new uid, and may \`inheritFrom\` the lower one; it never redeclares it ` +
            `(a move in flight may redeclare it only by adding to it, never by changing or dropping anything).`,
        );
      }
      if (prev !== undefined) warnMoveInFlight("policy", uid, owner.get(uid)!, `${instance} (${dir})`);
      out.set(uid, p);
      owner.set(uid, `${instance} (${dir})`);
    }
  }
  return out;
}

/** The policies in force for `instanceRoot`'s checkout: its own, then every dependent's. */
export function checkoutPolicies(instanceRoot: string, ownPoliciesDir: string): Map<string, OdrlPolicy> {
  return overlayPolicies(readPolicies(ownPoliciesDir), policyLayersAbove(instanceRoot), instanceConfigFor(instanceRoot)?.name);
}

/**
 * The policies a layer's own audit may read: the platform's, every
 * layer it needs, and its own — {@link neededActors}, one graph over.
 */
export function neededPolicies(instanceRoot: string, platformPoliciesDir: string): Map<string, OdrlPolicy> {
  const platform = resolve(platformPoliciesDir);
  const layers = policyLayersBelow(instanceRoot).filter((l) => l.dir !== platform);
  return overlayPolicies(readPolicies(platformPoliciesDir), layers, instanceConfigFor(platformPoliciesDir)?.name);
}
