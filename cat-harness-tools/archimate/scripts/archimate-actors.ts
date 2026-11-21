#!/usr/bin/env bun
/**
 * The model's actor tags checked against the IG's ActorDefinitions: the Tool
 * `archimate-actors`.
 *
 * Owner, 2026-11-01 (card Q-ACT-2, option A, smart-ra#166 D4): **actors come
 * first.** A DAK's L2 generic personas become the IG's L3 FHIR
 * ActorDefinitions, and the architecture realizes them (SMART Guidelines;
 * the DPI-H RA §4.3.2). So the ActorDefinitions are written in the IG, and an
 * ArchiMate model only points at them. This Tool never writes an
 * ActorDefinition or any FSH: it checks the pointers.
 *
 * ## How a box points at an actor: a tag
 *
 * An element realizes an actor when it carries the Archi property
 * `fhir-actor`, whose value is the actor's canonical URL
 * (`http://smart.who.int/ra/ActorDefinition/ClientRegistry`). It is the same
 * pattern as the `skosConcept` property. Nothing is matched by name: which
 * box realizes which actor is the model authors' call, made in Archi. One
 * element may carry several tags, and one actor may be realized by several
 * elements.
 *
 * ## What fails
 *
 * - a value that is not a canonical URL ending in `/ActorDefinition/<id>`;
 * - a tag on an element kind that cannot be an actor (a data object, a goal);
 * - a tag that resolves to no ActorDefinition of the IG;
 * - a type mismatch: a `#person` actor on an application or technology
 *   element, or a `#system` actor on a business actor or role.
 *
 * An ActorDefinition that no element realizes is reported as a warning, and
 * fails the run under `--strict`.
 *
 *   bun run cat archimate:actors --instance <dir> --model <id> [--ig <dir>] [--strict] [--json]
 *
 * `--ig` is the directory holding `sushi-config.yaml` (default: the
 * instance). `--json` prints element → actors and actor → elements, for the
 * pages' back-links.
 *
 * @module cat-harness/archimate/scripts/archimate-actors
 * @covers archimate
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readArchimate, type ArchimateModel } from "../schemas/archimate.ts";
import { archimateDir, readConfig } from "./check-archimate.ts";

export const TOOL_ID = "archimate-actors";
/** The Archi property by which an element realizes an actor; its value is the actor's canonical URL. */
export const ACTOR_PROPERTY = "fhir-actor";
export type ActorType = "system" | "person";

/** A canonical URL of an ActorDefinition: absolute http(s), path ending `/ActorDefinition/<id>`, an optional `|version`. */
const ACTOR_CANONICAL = /^https?:\/\/[^\s|/]+(?:\/[^\s|/]+)*\/ActorDefinition\/[A-Za-z0-9.-]{1,64}(?:\|[^\s|]+)?$/;

/** Which actor type an element kind can realize, or undefined when it cannot be an actor. */
export function actorTypeOf(elementType: string): ActorType | undefined {
  if (/^Application(Component|Collaboration|Interface)$|^(Node|Device|SystemSoftware|TechnologyCollaboration|TechnologyInterface)$/.test(elementType)) return "system";
  if (/^Business(Actor|Role|Collaboration)$/.test(elementType)) return "person";
  return undefined;
}

/** One ActorDefinition of the IG. */
export interface IgActor {
  id: string;
  /** Its canonical URL: the resource's `url` when given, else `<IG canonical>/ActorDefinition/<id>`. */
  url: string;
  type?: ActorType;
  /** The file it is defined in, relative to the IG directory. */
  source: string;
}

/** The IG's canonical, from `sushi-config.yaml`. */
export function igCanonical(sushiConfig: string): string | undefined {
  const m = /^canonical:\s*["']?([^"'\s#]+)["']?\s*(?:#.*)?$/m.exec(sushiConfig);
  return m?.[1].replace(/\/$/, "");
}

/**
 * FSH with its comments removed and its multi-line strings blanked, so a
 * description's lines are not read as rules. One-line strings stay: an
 * `* id` or `* url` value is one. A `//` after a `:` is a URL, not a comment.
 */
function withoutLongStrings(fsh: string): string {
  return fsh.replace(/"""[\s\S]*?"""|"(?:[^"\\]|\\.)*"|\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*/g, (t) => (t.startsWith('"') ? (t.includes("\n") ? '""' : t) : ""));
}

const FSH_ENTITY = /^(?=(?:Instance|Profile|Extension|Logical|Resource|ValueSet|CodeSystem|Invariant|RuleSet|Mapping|Alias)\s*:)/m;

/** The ActorDefinition instances of one FSH file: id (`* id` when given), url (`* url` when given) and type. */
export function fshActors(fsh: string, canonical: string, source: string): IgActor[] {
  const out: IgActor[] = [];
  for (const b of withoutLongStrings(fsh).split(FSH_ENTITY)) {
    const head = /^Instance:\s*(\S+)/.exec(b);
    if (!head || !/^InstanceOf:\s*ActorDefinition\s*$/m.test(b)) continue;
    const id = /^\*\s*id\s*=\s*"([^"]+)"/m.exec(b)?.[1] ?? head[1];
    const url = /^\*\s*url\s*=\s*"([^"]+)"/m.exec(b)?.[1] ?? `${canonical}/ActorDefinition/${id}`;
    const type = /^\*\s*type\s*=\s*\S*#(system|person)\b/m.exec(b)?.[1] as ActorType | undefined;
    out.push({ id, url, type, source });
  }
  return out;
}

/** An ActorDefinition from a FHIR JSON resource, or undefined when it is not one. */
export function jsonActor(json: unknown, canonical: string, source: string): IgActor | undefined {
  const r = json as { resourceType?: string; id?: string; url?: string; type?: string } | null;
  if (r?.resourceType !== "ActorDefinition" || typeof r.id !== "string") return undefined;
  const type = r.type === "system" || r.type === "person" ? r.type : undefined;
  return { id: r.id, url: r.url ?? `${canonical}/ActorDefinition/${r.id}`, type, source };
}

function filesUnder(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p, ext));
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

/**
 * The IG's ActorDefinitions: FSH in `input/fsh/**`, and FHIR JSON in
 * `fsh-generated/resources/` and `input/resources/` when present. Keyed by
 * canonical URL; an actor found in FSH and in its generated JSON is one.
 */
export function igActors(igDir: string): { canonical: string; actors: Map<string, IgActor> } {
  const cfg = join(igDir, "sushi-config.yaml");
  if (!existsSync(cfg)) throw new Error(`${cfg}: no sushi-config.yaml — pass --ig <dir> of the IG`);
  const canonical = igCanonical(readFileSync(cfg, "utf8"));
  if (canonical === undefined) throw new Error(`${cfg}: no canonical`);
  const actors = new Map<string, IgActor>();
  for (const f of filesUnder(join(igDir, "input", "fsh"), ".fsh")) {
    for (const a of fshActors(readFileSync(f, "utf8"), canonical, relative(igDir, f))) actors.set(a.url, a);
  }
  for (const d of [join(igDir, "fsh-generated", "resources"), join(igDir, "input", "resources")]) {
    for (const f of filesUnder(d, ".json")) {
      let j: unknown;
      try {
        j = JSON.parse(readFileSync(f, "utf8"));
      } catch {
        continue;
      }
      const a = jsonActor(j, canonical, relative(igDir, f));
      if (a === undefined) continue;
      const known = actors.get(a.url);
      if (known === undefined) actors.set(a.url, a);
      else known.type ??= a.type;
    }
  }
  return { canonical, actors };
}

/** One element's tag, resolved. */
export interface ActorLink {
  element: string;
  elementName: string;
  elementType: string;
  /** The canonical as tagged, without any `|version`. */
  actor: string;
}

export interface ActorCheck {
  links: ActorLink[];
  problems: string[];
  /** ActorDefinitions no element realizes, by canonical. */
  unrealized: string[];
}

/** Check a model's `fhir-actor` tags against the IG's ActorDefinitions. */
export function checkActors(model: ArchimateModel, actors: Map<string, IgActor>): ActorCheck {
  const links: ActorLink[] = [];
  const problems: string[] = [];
  for (const e of model.elements) {
    for (const p of e.properties.filter((x) => x.key === ACTOR_PROPERTY)) {
      const value = p.value.trim();
      const where = `${e.id} "${e.name}" (${e.type})`;
      const kind = actorTypeOf(e.type);
      if (!ACTOR_CANONICAL.test(value)) {
        problems.push(`${where}: ${ACTOR_PROPERTY}="${p.value}" is not an ActorDefinition canonical URL (<IG canonical>/ActorDefinition/<id>)`);
        continue;
      }
      if (kind === undefined) {
        problems.push(`${where}: a ${e.type} cannot realize an actor (an application or technology element, or a business actor or role)`);
        continue;
      }
      const url = value.replace(/\|.*$/, "");
      const actor = actors.get(url);
      if (actor === undefined) {
        problems.push(`${where}: ${ACTOR_PROPERTY}="${value}" names no ActorDefinition of the IG`);
        continue;
      }
      if (actor.type !== undefined && actor.type !== kind) {
        problems.push(`${where}: ${actor.id} is a #${actor.type} actor, and ${e.type} elements realize only #${kind} actors`);
        continue;
      }
      links.push({ element: e.id, elementName: e.name, elementType: e.type, actor: url });
    }
  }
  const realized = new Set(links.map((l) => l.actor));
  const unrealized = [...actors.keys()].filter((u) => !realized.has(u)).sort();
  return { links, problems, unrealized };
}

/** element → actors and actor → elements, for the pages' back-links. */
export function backLinks(check: ActorCheck, actors: Map<string, IgActor>) {
  const elements: Record<string, { name: string; type: string; actors: string[] }> = {};
  const byActor: Record<string, { id: string; type?: ActorType; elements: string[] }> = {};
  for (const [url, a] of [...actors].sort(([x], [y]) => x.localeCompare(y))) byActor[url] = { id: a.id, type: a.type, elements: [] };
  for (const l of check.links) {
    (elements[l.element] ??= { name: l.elementName, type: l.elementType, actors: [] }).actors.push(l.actor);
    byActor[l.actor].elements.push(l.element);
  }
  return { elements, actors: byActor };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const instance = arg("instance");
  const modelId = arg("model");
  if (!instance || !modelId) {
    console.error("usage: archimate-actors.ts --instance <dir> --model <id> [--ig <dir>] [--strict] [--json]");
    process.exit(2);
  }
  const root = resolve(instance);
  const config = readConfig(root);
  const cm = config.models.find((m) => m.id === modelId);
  if (cm === undefined) {
    console.error(`no model "${modelId}" in ${config.models.map((m) => m.id).join(", ")}`);
    process.exit(2);
  }
  const model = readArchimate(readFileSync(join(archimateDir(root, config), cm.file)));
  const ig = igActors(resolve(arg("ig") ?? root));
  const check = checkActors(model, ig.actors);
  const strict = process.argv.includes("--strict");
  const failed = check.problems.length > 0 || (strict && check.unrealized.length > 0);
  if (process.argv.includes("--json")) {
    const out = { tool: TOOL_ID, model: modelId, canonical: ig.canonical, ...backLinks(check, ig.actors), problems: check.problems, unrealized: check.unrealized };
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  } else {
    for (const p of check.problems) console.error(`✗ ${p}`);
    const mark = strict ? "✗" : "!";
    for (const u of check.unrealized) console.log(`${mark} ${ig.actors.get(u)!.id} (${u}): no element of model ${modelId} realizes it (tag a box ${ACTOR_PROPERTY}=<canonical> in Archi)`);
    console.log(
      `${failed ? "✗" : "✓"} model ${modelId}: ${check.links.length} tag(s) resolved, ${check.problems.length} problem(s); ` +
        `${ig.actors.size - check.unrealized.length} of ${ig.actors.size} ActorDefinition(s) realized`,
    );
  }
  if (failed) process.exit(1);
}
