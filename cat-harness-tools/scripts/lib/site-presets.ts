/**
 * Shared, layered site build steps: `site.build.extends` (cat-harness-tools#2345).
 *
 * Every content site listed its own `site.build` steps, and the lists drifted:
 * smart-ra never had `site:glossary` or `site:bibliography`, so its glossary
 * term pages and bibliography entries were never built and were 404s
 * (WorldHealthOrganization/smart-ra#49); dth-hrh, dth-phc, dth-sc and dth-pc
 * each lack a different subset. Owner, 2026-11-16 (option A): one shared,
 * layered list of steps, so no site can skip glossary or bibliography.
 *
 * ## A preset
 *
 * `templates/site-presets/<name>.json` in any layer the checkout mounts (or
 * the checkout itself, or this layer). It has the fields of `site.build` —
 * `pre`, `sourceSteps`, `siteSteps`, `finalSteps`, `links`, `coverage` — and
 * three of its own:
 *
 * - `extends`: the preset it builds on, so the lists layer the way the
 *   repositories do (this layer's `folio-base`, and a higher layer's
 *   preset on top of it);
 * - `scripts`: the command of each step it names, run from the checkout root
 *   with the step's arguments appended, exactly as a package script is. A
 *   checkout whose own package.json defines the same name runs its own
 *   instead, so a site keeps its flags (`--link-terms`, `--downloads`) and
 *   still cannot drop the step;
 * - `when`: a step that only applies where the checkout holds a path
 *   (`"site:archimate": "archimate/"`). Absent, the step is skipped and the
 *   build says so: nothing is skipped silently.
 *
 * ## Merging
 *
 * The base preset's lists come first, then each preset above it, then the
 * site's own `site.build`. A step named twice runs once: within a phase at the
 * place the upper list gives it (so a preset can order the steps of the one it
 * extends), and across phases in the earlier phase. For `links` and `coverage` the nearest declaration wins: the
 * site's own, else the top preset's, else the one below. `scripts` and `when`
 * merge by step name, the nearer winning.
 *
 * @module scripts/lib/site-presets
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";

import { layerRootsIn } from "../../schemas/kg/instance-roots.ts";

/** Where a layer keeps its presets, relative to the layer's root. */
export const PRESET_DIR = "templates/site-presets";

/** A preset name: one lower-case path segment. */
export const PRESET_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** A package script name (the same rule `build-instance-site.ts` holds steps to). */
const STEP_NAME = /^[A-Za-z0-9][A-Za-z0-9:._-]*$/;

/** The parts of a recipe a preset and a site's own `site.build` both carry. */
export interface RecipeSteps {
  pre: string[];
  sourceSteps: string[];
  siteSteps: string[];
  finalSteps: string[];
  links?: "refuse" | "report";
  coverage?: "refuse" | "report";
  /** Step name → the command a preset runs for it. */
  scripts: Record<string, string>;
  /** Step name → the checkout path it needs. */
  when: Record<string, string>;
}

export interface ResolvedPresets {
  steps: RecipeSteps;
  /** The presets applied, base first, each as `<name> (<file, checkout-relative>)`. */
  chain: string[];
}

const LISTS = ["pre", "sourceSteps", "siteSteps", "finalSteps"] as const;

function stringList(v: unknown, where: string, key: string): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && STEP_NAME.test(x))) throw new Error(`${where}: ${key} must be a list of package script names`);
  return v as string[];
}

function mode(v: unknown, where: string, key: string): "refuse" | "report" | undefined {
  if (v === undefined) return undefined;
  if (v !== "refuse" && v !== "report") throw new Error(`${where}: ${key} must be refuse or report`);
  return v;
}

function stringMap(v: unknown, where: string, key: string, value: (s: string) => boolean, what: string): Record<string, string> {
  if (v === undefined) return {};
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error(`${where}: ${key} must be an object`);
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (!STEP_NAME.test(k)) throw new Error(`${where}: ${key}.${k} is not a package script name`);
    if (typeof x !== "string" || !value(x)) throw new Error(`${where}: ${key}.${k} must be ${what}`);
    out[k] = x;
  }
  return out;
}

/** A checkout-relative path that stays inside the checkout. */
export function insidePath(p: string): boolean {
  if (p === "" || isAbsolute(p)) return false;
  const n = normalize(p);
  return n !== ".." && !n.startsWith("../") && !n.split(/[\\/]/).includes("..");
}

/** One preset file's own fields, validated; `extends` returned apart. */
export function parsePreset(raw: unknown, where: string): { steps: RecipeSteps; extends?: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${where}: a site preset must be a JSON object`);
  const o = raw as Record<string, unknown>;
  const ext = o.extends;
  if (ext !== undefined && (typeof ext !== "string" || !PRESET_NAME.test(ext))) throw new Error(`${where}: extends must be a preset name`);
  const links = mode(o.links, where, "links");
  const coverage = mode(o.coverage, where, "coverage");
  return {
    ...(ext !== undefined ? { extends: ext as string } : {}),
    steps: {
      pre: stringList(o.pre, where, "pre"),
      sourceSteps: stringList(o.sourceSteps, where, "sourceSteps"),
      siteSteps: stringList(o.siteSteps, where, "siteSteps"),
      finalSteps: stringList(o.finalSteps, where, "finalSteps"),
      ...(links ? { links } : {}),
      ...(coverage ? { coverage } : {}),
      scripts: stringMap(o.scripts, where, "scripts", (s) => s.trim() !== "" && !s.includes("\n"), "a one-line command"),
      when: stringMap(o.when, where, "when", insidePath, "a path inside the checkout"),
    },
  };
}

/** `upper` over `lower`: lists concatenated (lower first) without repeats; modes and maps the upper's where it has them. */
export function mergeSteps(lower: RecipeSteps, upper: RecipeSteps): RecipeSteps {
  const out: RecipeSteps = {
    pre: [],
    sourceSteps: [],
    siteSteps: [],
    finalSteps: [],
    scripts: { ...lower.scripts, ...upper.scripts },
    when: { ...lower.when, ...upper.when },
  };
  // Within a phase, a step the upper list names again takes the upper list's place: the layer
  // above decides the order of the steps it knows of.
  for (const k of LISTS) {
    const all = [...lower[k], ...upper[k]];
    out[k] = all.filter((x, i) => all.lastIndexOf(x) === i);
  }
  // A step runs once in the whole build: named in two phases, it runs in the earlier one.
  const seen = new Set<string>();
  for (const k of LISTS) out[k] = out[k].filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
  const links = upper.links ?? lower.links;
  const coverage = upper.coverage ?? lower.coverage;
  if (links) out.links = links;
  if (coverage) out.coverage = coverage;
  return out;
}

/** The directories a preset is looked up in: the checkout, every layer it mounts, and this layer. */
export function presetRoots(root: string): string[] {
  const r = resolve(root);
  const roots = [r, ...layerRootsIn(r).map((p) => resolve(p)), resolve(import.meta.dir, "..", "..")];
  return [...new Set(roots)];
}

/**
 * The file declaring preset `name`. Two layers declaring the same name is an
 * error: which one a site gets must not depend on mount order.
 */
export function findPreset(root: string, name: string): string {
  if (!PRESET_NAME.test(name)) throw new Error(`${JSON.stringify(name)} is not a site preset name`);
  const hits = presetRoots(root)
    .map((d) => join(d, PRESET_DIR, `${name}.json`))
    .filter((f) => existsSync(f));
  const unique = [...new Set(hits.map((f) => resolve(f)))];
  if (unique.length === 0) {
    throw new Error(`site preset ${name} is declared by no layer this checkout mounts (looked in ${PRESET_DIR}/ of ${presetRoots(root).map((d) => relative(resolve(root), d) || ".").join(", ")})`);
  }
  if (unique.length > 1) throw new Error(`site preset ${name} is declared twice: ${unique.map((f) => relative(resolve(root), f)).join(", ")}`);
  return unique[0]!;
}

/** Preset `name` with every preset it extends, merged base first. */
export function resolvePreset(root: string, name: string, seen: string[] = []): ResolvedPresets {
  if (seen.includes(name)) throw new Error(`site presets extend in a loop: ${[...seen, name].join(" → ")}`);
  const file = findPreset(root, name);
  const where = relative(resolve(root), file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf-8"));
  } catch (e) {
    throw new Error(`${where}: not JSON (${(e as Error).message})`);
  }
  const own = parsePreset(raw, where);
  const entry = `${name} (${where})`;
  if (own.extends === undefined) return { steps: own.steps, chain: [entry] };
  const below = resolvePreset(root, own.extends, [...seen, name]);
  return { steps: mergeSteps(below.steps, own.steps), chain: [...below.chain, entry] };
}

/** A site's own steps over the preset it extends. */
export function applyPreset(root: string, name: string, site: RecipeSteps): ResolvedPresets {
  const p = resolvePreset(root, name);
  return { steps: mergeSteps(p.steps, site), chain: p.chain };
}

/** Why a step does not run here (its `when` path is absent), or undefined when it runs. */
export function skipReason(root: string, step: string, when: Readonly<Record<string, string>>): string | undefined {
  const need = when[step];
  if (need === undefined) return undefined;
  return existsSync(join(root, need)) ? undefined : `the checkout holds no ${need}`;
}
