#!/usr/bin/env bun
/**
 * Find a layer's `cat-archimate.config.json` and the directory it names,
 * and check that what is committed there is what the config says.
 *
 * @module cat-harness/archimate/scripts/check-archimate
 * @covers archimate
 *
 * Usage:
 *   bun run cat-harness-tools/archimate/scripts/check-archimate.ts --instance <instance-dir>
 *   bun run cat-harness-tools/archimate/scripts/check-archimate.ts [--repo <checkout-root>]
 *
 * Without `--instance` it sweeps the checkout: every layer that declares an
 * `archimate` directory, or keeps the config at its root ({@link archimateInstances}).
 * `--repo` defaults to the checkout this file sits in (`checkoutRootFor`).
 *
 * The `openapi` subgraph's `ingest-openapi.ts --check`, for models that are
 * authored in place rather than ingested: every configured model is present
 * and parses — every view's boxes name elements the model holds, every
 * relationship's ends are in the model — and no `.archimate` file sits in the
 * directory that the config does not name. A model nobody configured is a
 * model nobody publishes, and saying so is the point.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ArchimateConfigSchema, readArchimate, type ArchimateConfig, type ArchimateModel } from "../schemas/archimate.ts";
import { checkoutRootFor, findDeclarationFile, layerRootsIn } from "../../schemas/kg/cat-harness.ts";

export const CONFIG_FILE = "cat-archimate.config.json";

/**
 * Where the layer's config is: at its root, or inside a directory it
 * declares with graph typology `archimate`. The root wins; `undefined` when
 * neither holds one — `configPath` in `ingest-openapi.ts`, for this kind.
 */
export function configPath(instanceRoot: string): string | undefined {
  const atRoot = join(instanceRoot, CONFIG_FILE);
  if (existsSync(atRoot)) return atRoot;
  const found = findDeclarationFile(instanceRoot);
  if (found === undefined) return undefined;
  let d: { directories?: Array<{ path?: string; graphTypologies?: string[] }> };
  try {
    d = JSON.parse(readFileSync(join(instanceRoot, found), "utf8"));
  } catch {
    return undefined;
  }
  for (const e of d.directories ?? []) {
    if (!e.path || !e.graphTypologies?.includes("archimate")) continue;
    const p = join(instanceRoot, e.path, CONFIG_FILE);
    if (existsSync(p)) return p;
  }
  return undefined;
}

/** The layer's config, parsed. Throws naming the file when it is absent or invalid. */
export function readConfig(instanceRoot: string): ArchimateConfig {
  const p = configPath(instanceRoot) ?? join(instanceRoot, CONFIG_FILE);
  if (!existsSync(p)) throw new Error(`${p}: no ${CONFIG_FILE} — this instance does not instantiate cat-harness's archimate subgraph`);
  const r = ArchimateConfigSchema.safeParse(JSON.parse(readFileSync(p, "utf8")));
  if (!r.success) throw new Error(`${p}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return r.data;
}

/**
 * The directory the config names, resolved through the layer's own
 * declaration — never a path written in the config, so moving the directory
 * is one edit to `<instance>.json` and nothing else.
 */
export function archimateDir(instanceRoot: string, config: ArchimateConfig): string {
  const found = findDeclarationFile(instanceRoot);
  if (found === undefined) throw new Error(`no instance declaration in ${resolve(instanceRoot)}`);
  const decl = join(instanceRoot, found);
  const d = JSON.parse(readFileSync(decl, "utf8")) as { directories?: Array<{ id: string; path: string; graphTypologies?: string[] }> };
  const entry = d.directories?.find((x) => x.id === config.directory);
  if (!entry) throw new Error(`${decl}: no directory with id "${config.directory}" (named by ${CONFIG_FILE})`);
  if (!entry.graphTypologies?.includes("archimate")) throw new Error(`${decl}: directory "${config.directory}" is not of graph typology "archimate"`);
  return join(instanceRoot, entry.path);
}

/** The archimate directory, instance-relative and in POSIX form — the graph's path under the layer's site. */
export const localDirOf = (instanceRoot: string, dir: string): string => relative(instanceRoot, dir).split("\\").join("/");

/**
 * The element properties that tie an ArchiMate model to the data and APIs it
 * describes (owner, 2026-11-01, Q-DS-8 A), set the way `skosConcept` already
 * ties an element to the glossary:
 *
 * - `store` — on the application component that IS a data store: the store's
 *   id (a harness Role id, or the FHIR `ActorDefinition` id of a system);
 * - `api` — on that component, or on an application interface composed into
 *   it: the address of the API's own document (OpenAPI, CapabilityStatement,
 *   GraphQL schema);
 * - `schema` — on a data object: the address of the schema of what is kept;
 * - `actorDefinition` — on the component: the FHIR `ActorDefinition` it is.
 */
export const STORE_LINK_KEYS = ["store", "api", "schema", "actorDefinition"] as const;

/** The element types that can play a store: something that runs. */
const STORE_TYPES = new Set(["ApplicationComponent", "SystemSoftware", "Node"]);

/**
 * What is wrong with a model's store links. Opt-in: only an element that
 * says it is a store is held to the rest, so a model that marks none passes,
 * and marking one is a promise the check then keeps.
 *
 * - a link property with an empty value says nothing;
 * - `store` sits on something that runs, not on data or a role;
 * - a store has at least one `api`, on itself or on an application interface
 *   composed into or assigned to it — a store nobody can reach is a gap the
 *   model should show, and an absent link hides it.
 * A data object a store holds need not carry `schema` yet; that is advice for
 * the model's authors, not a failure.
 */
export function storeLinkProblems(modelId: string, model: Pick<ArchimateModel, "elements" | "relationships">): string[] {
  const problems: string[] = [];
  const byId = new Map(model.elements.map((e) => [e.id, e]));
  const prop = (id: string, key: string) => byId.get(id)?.properties.filter((p) => p.key === key) ?? [];
  for (const e of model.elements) {
    for (const p of e.properties) {
      if ((STORE_LINK_KEYS as readonly string[]).includes(p.key) && p.value.trim() === "") {
        problems.push(`${modelId}: "${e.name}" has an empty ${p.key} property`);
      }
    }
    if (!prop(e.id, "store").length) continue;
    if (!STORE_TYPES.has(e.type)) {
      problems.push(`${modelId}: "${e.name}" is a ${e.type} marked as a store; a store is an application component, system software or a node`);
      continue;
    }
    const interfaces = model.relationships
      .filter((r) => (r.type === "Composition" || r.type === "Assignment") && r.source === e.id && byId.get(r.target)?.type === "ApplicationInterface")
      .map((r) => r.target);
    const hasApi = prop(e.id, "api").length > 0 || interfaces.some((i) => prop(i, "api").length > 0);
    if (!hasApi) {
      problems.push(`${modelId}: store "${e.name}" has no api property, on itself or on an application interface composed into it`);
    }
  }
  return problems;
}

/** Problems with what is committed; empty means it is consistent. */
export function checkCommitted(instanceRoot: string): string[] {
  const config = readConfig(instanceRoot);
  const dir = archimateDir(instanceRoot, config);
  const problems: string[] = [];
  const named = new Set<string>();
  for (const m of config.models) {
    const file = join(dir, m.file);
    named.add(file);
    if (!existsSync(file)) {
      problems.push(`${m.id}: ${m.file} is not in ${localDirOf(instanceRoot, dir)}/`);
      continue;
    }
    let model;
    try {
      model = readArchimate(readFileSync(file));
    } catch (e) {
      problems.push(`${m.id}: ${(e as Error).message}`);
      continue;
    }
    const ids = new Set([...model.elements.map((e) => e.id), ...model.relationships.map((r) => r.id)]);
    for (const r of model.relationships) {
      for (const end of [r.source, r.target]) if (!ids.has(end)) problems.push(`${m.id}: relationship ${r.id} names ${end}, which the model does not hold`);
    }
    for (const v of model.views) {
      for (const n of v.nodes) {
        if (n.kind === "element" && !ids.has(n.ref ?? "")) problems.push(`${m.id}: view "${v.name}" draws ${n.ref || "nothing"}, which the model does not hold`);
      }
    }
    problems.push(...storeLinkProblems(m.id, model));
    const views = new Set(model.views.map((v) => v.id));
    for (const f of (config.figures ?? []).filter((x) => x.model === m.id)) {
      if (!views.has(f.view)) problems.push(`${m.id}: ${f.label} (${f.block}) is mapped to view ${f.view}, which the model does not hold`);
    }
  }
  for (const f of config.figures ?? []) {
    if (!existsSync(join(instanceRoot, f.block))) problems.push(`${f.label}: block ${f.block} is not in the instance`);
  }
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".archimate") && !named.has(p)) problems.push(`${p}: held, but ${CONFIG_FILE} names no such model`);
    }
  };
  if (existsSync(dir)) walk(dir);
  return problems;
}

/**
 * Whether a layer takes part in the archimate subgraph: it keeps the config at
 * its root, or declares a directory of graph typology `archimate`. The
 * DECLARATION decides, not the config's presence, so a layer that declares
 * the directory and lost its config is swept, and {@link readConfig} fails it.
 */
export function declaresArchimate(instanceRoot: string): boolean {
  if (existsSync(join(instanceRoot, CONFIG_FILE))) return true;
  const found = findDeclarationFile(instanceRoot);
  if (found === undefined) return false;
  try {
    const d = JSON.parse(readFileSync(join(instanceRoot, found), "utf8")) as { directories?: Array<{ graphTypologies?: string[] }> };
    return (d.directories ?? []).some((e) => e.graphTypologies?.includes("archimate") === true);
  } catch {
    // UNPARSEABLE IS NOT ABSENT: `findDeclarationFile` returns a broken
    // declaration so a caller can report it. Swept, its check fails and says
    // why, rather than the sweep passing over a layer it could not read.
    return true;
  }
}

/** Every layer in the checkout at `repo` that {@link declaresArchimate}, sorted. */
export function archimateInstances(repo: string): string[] {
  return layerRootsIn(repo).filter(declaresArchimate).sort();
}

/** {@link checkCommitted} for one layer, a thrown config error reported as a problem rather than ending the sweep. */
function checkOne(instanceRoot: string): string[] {
  const found = findDeclarationFile(instanceRoot);
  if (found !== undefined) {
    try {
      JSON.parse(readFileSync(join(instanceRoot, found), "utf8"));
    } catch (e) {
      return [`${found} does not parse, so its archimate directory cannot be read: ${e instanceof Error ? e.message : String(e)}`];
    }
  }
  try {
    return checkCommitted(instanceRoot);
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)];
  }
}

if (import.meta.main) {
  const arg = (flag: string) => {
    const i = process.argv.indexOf(flag);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const instance = arg("--instance");
  if (instance) {
    const problems = checkCommitted(resolve(instance));
    for (const p of problems) console.error(`✗ ${p}`);
    if (problems.length) process.exit(1);
    console.log(`✓ ${instance}: every ArchiMate model the config names is held, parses and resolves, and no other is held`);
  } else {
    const repo = resolve(arg("--repo") ?? checkoutRootFor(resolve(import.meta.dir, "..", "..")));
    const roots = archimateInstances(repo);
    // A sweep over nothing is not a pass: say so and fail, rather than print a tick.
    if (roots.length === 0) {
      console.error(`✗ ${repo}: no layer declares an archimate directory — nothing was checked`);
      process.exit(1);
    }
    let failed = 0;
    for (const root of roots) {
      const name = relative(repo, root) || ".";
      const problems = checkOne(root);
      for (const p of problems) console.error(`✗ ${name}: ${p}`);
      if (problems.length) failed++;
      else console.log(`✓ ${name}: every ArchiMate model the config names is held, parses and resolves, and no other is held`);
    }
    if (failed) {
      console.error(`${failed} of ${roots.length} layer(s) with an archimate directory failed`);
      process.exit(1);
    }
  }
}
