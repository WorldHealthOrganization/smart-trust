/**
 * Liquid value references — `{{ <prefix>.<directory-id>.<entry>.<path> }}` —
 * resolved ONCE, the same way, for every render target.
 *
 * ## The design (bean `kott`, issue #1564, owner 2026-09-30)
 *
 * One syntax for every target: Liquid. Each harness instance declares the
 * prefix its values are addressed by (`liquid.prefix`, default its `name`).
 * A layer that declares a prefix `passThrough: true` (the FHIR IG layer
 * does, for `site.data`) leaves it to the renderer, so Jekyll and the IG
 * Publisher keep resolving `{{ site.data.fhir.… }}` exactly as they do today.
 * Every other declared prefix is resolved HERE, before the text reaches
 * Jekyll, the IG Publisher or LaTeX, which is what makes the PDF, the
 * blueprint and the site print the same number.
 *
 * The address is a path in the knowledge graph, not a name in a registry:
 *
 *   {{ qou.computations.codata-masses.data.m_e_MeV }}
 *      │   │            │             └ exact JSON path inside the entry
 *      │   │            └ the entry: <dir>/<entry>.witness.json | <entry>.json
 *      │   └ a DECLARED directory id — an undeclared directory is not addressable
 *      └ the layer's prefix
 *
 *   {{ bootstrap.version }}  — a scalar from the declaration itself
 *
 * Only DECLARED directories resolve: `resolveDirectories` would add the
 * conventional set too, and a value read from a directory the layer never
 * declared is the `dh4f` defect in another form.
 *
 * ## Formatting
 *
 * No filter prints the stored value unchanged, as Jekyll prints a
 * `site.data` value. `| precision: N` rounds to N significant digits
 * (half-even, string arithmetic, so a 50-digit witness survives);
 * `| scientific` emits LaTeX `\times 10^{e}` and belongs inside math.
 *
 * ## Never silent
 *
 * A reference under a prefix this resolver owns that does not resolve is
 * replaced by a visible `⟦unresolved: …⟧` marker and reported. Left as
 * `{{ … }}`, Jekyll would render an undefined variable as the EMPTY STRING —
 * the value would vanish from the page with no error anywhere.
 *
 * @module pipeline/liquid-values
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join, relative } from "path";
import {
  findDeclarationFile,
  layerRootsIn,
  readDeclaration,
  rootForScope,
} from "../schemas/kg/cat-harness.js";
import { asScalar, formatScalar, resolvePath } from "./render-value";
import { findContentRepoRoot } from "./repo-root";

/** One layer as the resolver sees it. */
export interface ScopeInstance {
  name: string;
  prefix: string;
  passThrough: boolean;
  root: string;
  /** Declaration file, repo-relative — the provenance of a declaration scalar. */
  declarationFile: string;
  /** Declared directory id → absolute path. */
  directories: Map<string, string>;
  /** Top-level scalar fields of the declaration. */
  scalars: Map<string, string | number | boolean>;
}

export interface ValueScope {
  repoRoot: string;
  /** Longest prefix first, so `site.data` wins over a hypothetical `site`. */
  instances: ScopeInstance[];
  /** Declaration problems: prefix collisions, directory id vs field clashes. */
  problems: string[];
}

/** Where a resolved value came from. */
export interface ValueProvenance {
  /** Repo-relative file the value was read from. */
  file: string;
  /** JSON path inside it, or the declaration field. */
  path: string;
  commitSha?: string;
  scriptHash?: string;
  /** For a library dataset: the source file's sha256, publisher URL, edition. */
  sourceSha256?: string;
  sourceUrl?: string;
  edition?: string;
}

export type Resolution =
  | { state: "resolved"; text: string; provenance: ValueProvenance }
  | { state: "unresolved"; reason: string }
  | { state: "pass-through" }
  | { state: "not-ours" };

const SEG = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

/** Build the scope from every layer declared in this checkout. */
export function buildValueScope(repoRoot: string): ValueScope {
  const problems: string[] = [];
  const instances: ScopeInstance[] = [];
  const seen = new Map<string, string>();
  for (const root of layerRootsIn(repoRoot)) {
    let decl;
    try {
      decl = readDeclaration(root);
    } catch (e) {
      problems.push(`${relative(repoRoot, root) || "."}: ${(e as Error).message}`);
      continue;
    }
    if (!decl) continue;
    const prefix = decl.liquid?.prefix ?? decl.name;
    const other = seen.get(prefix);
    if (other) {
      problems.push(`Liquid prefix "${prefix}" is declared by both ${other} and ${decl.name}`);
      continue;
    }
    seen.set(prefix, decl.name);
    const directories = new Map<string, string>();
    for (const d of decl.directories ?? []) {
      const base = rootForScope(root, d.scope); // the checkout for the root layer too (g43f)
      directories.set(d.id, join(base, d.path));
    }
    const scalars = new Map<string, string | number | boolean>();
    for (const [k, v] of Object.entries(decl)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") scalars.set(k, v);
    }
    for (const id of directories.keys()) {
      if (scalars.has(id)) problems.push(`${decl.name}: directory id "${id}" clashes with the declaration field of the same name`);
    }
    instances.push({
      name: decl.name,
      prefix,
      passThrough: decl.liquid?.passThrough === true,
      root,
      declarationFile: relative(repoRoot, join(root, findDeclarationFile(root)!)),
      directories,
      scalars,
    });
  }
  instances.sort((a, b) => b.prefix.length - a.prefix.length);
  return { repoRoot, instances, problems };
}

function readJson(file: string): unknown | undefined {
  try {
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch {
    return undefined;
  }
}

/** Resolve one dotted key against the scope, before formatting. */
export function resolveKey(key: string, scope: ValueScope): Resolution & { raw?: unknown } {
  const inst = scope.instances.find((i) => key === i.prefix || key.startsWith(i.prefix + "."));
  if (!inst) return { state: "not-ours" };
  if (inst.passThrough) return { state: "pass-through" };
  const rest = key.slice(inst.prefix.length + 1).split(".");
  if (rest.length === 0 || rest.some((s) => !SEG.test(s))) {
    return { state: "unresolved", reason: `"${key}" is not a dotted path under ${inst.prefix}` };
  }

  if (rest.length === 1) {
    if (inst.scalars.has(rest[0]!)) {
      return {
        state: "resolved",
        text: String(inst.scalars.get(rest[0]!)),
        raw: inst.scalars.get(rest[0]!),
        provenance: { file: inst.declarationFile, path: rest[0]! },
      };
    }
    return { state: "unresolved", reason: `${inst.name} declares no scalar field "${rest[0]}"` };
  }

  const [dirId, entry, ...path] = rest as [string, string, ...string[]];
  const dir = inst.directories.get(dirId);
  if (!dir) {
    return { state: "unresolved", reason: `${inst.name} declares no directory "${dirId}" (only declared directories are addressable)` };
  }
  if (!path.length) return { state: "unresolved", reason: `"${key}" names an entry but no field inside it` };
  // A witness, a JSON entry, or a library DATASET entry (`<entry>/values.json`,
  // written by an ingest tool such as `codata-ingest`, bean uyp8).
  const candidates = [join(dir, `${entry}.witness.json`), join(dir, `${entry}.json`), join(dir, entry, "values.json")];
  const file = candidates.find((f) => existsSync(f));
  if (!file) {
    return { state: "unresolved", reason: `no ${entry}.witness.json, ${entry}.json or ${entry}/values.json in ${relative(scope.repoRoot, dir)}` };
  }
  const doc = readJson(file);
  if (doc === undefined) return { state: "unresolved", reason: `${relative(scope.repoRoot, file)} is not valid JSON` };
  let raw = resolvePath(doc, path.join("."));
  // A dataset record ({ value, uncertainty, unit, … }) resolves to its value;
  // its other fields stay addressable explicitly (`….uncertainty`).
  if (raw && typeof raw === "object" && !Array.isArray(raw) && asScalar((raw as { value?: unknown }).value) !== null) {
    raw = (raw as { value: unknown }).value;
  }
  if (raw === undefined || raw === null || (typeof raw === "object" && asScalar(raw) === null)) {
    return { state: "unresolved", reason: `${relative(scope.repoRoot, file)} has no scalar at "${path.join(".")}"` };
  }
  const meta = doc as { commitSha?: unknown; scriptHash?: unknown };
  const tabular = file.endsWith("values.json") ? readJson(join(dirname(file), "tabular.jsonld")) : undefined;
  const src = (tabular as { source?: { sha256?: unknown; primaryUrl?: unknown; edition?: unknown } } | undefined)?.source;
  return {
    state: "resolved",
    text: String(asScalar(raw)?.value ?? raw),
    raw,
    provenance: {
      file: relative(scope.repoRoot, file),
      path: path.join("."),
      ...(typeof meta.commitSha === "string" ? { commitSha: meta.commitSha } : {}),
      ...(typeof meta.scriptHash === "string" ? { scriptHash: meta.scriptHash } : {}),
      ...(typeof src?.sha256 === "string" ? { sourceSha256: src.sha256 } : {}),
      ...(typeof src?.primaryUrl === "string" ? { sourceUrl: src.primaryUrl } : {}),
      ...(typeof src?.edition === "string" ? { edition: src.edition } : {}),
    },
  };
}

/** Apply `| precision: N` / `| scientific` / `| decimal` to a resolved value. */
export function applyFilters(raw: unknown, text: string, filters: string): string {
  const parts = filters.split("|").map((f) => f.trim()).filter(Boolean);
  if (!parts.length) return text;
  const scalar = asScalar(raw);
  let precision: number | undefined;
  let format: "decimal" | "scientific" = "decimal";
  for (const f of parts) {
    const m = f.match(/^precision\s*:\s*(\d+)$/);
    if (m) precision = Number(m[1]);
    else if (f === "scientific") format = "scientific";
    else if (f === "decimal") format = "decimal";
    else throw new Error(`unknown filter "${f}" (known: precision: N, scientific, decimal)`);
  }
  if (!scalar) return text;
  return formatScalar(scalar, precision ?? 17, format);
}

/** `{{ a.b.c | filter }}` — a dotted path of at least two segments. */
export const LIQUID_VALUE = /\{\{\s*([A-Za-z_][\w-]*(?:\.[\w-]+)+)\s*((?:\|[^{}|]+)*)\}\}/g;

export interface SubstitutionReport {
  resolved: Array<{ key: string; provenance: ValueProvenance }>;
  unresolved: Array<{ key: string; reason: string }>;
}

/**
 * Replace every reference under a prefix this resolver owns; leave
 * pass-through and foreign ones (`site.*`, `page.*`) untouched.
 */
export function substituteLiquidValues(
  text: string,
  scope: ValueScope,
  report: SubstitutionReport = { resolved: [], unresolved: [] },
): { text: string; report: SubstitutionReport } {
  const out = text.replace(LIQUID_VALUE, (whole, key: string, filters: string) => {
    const r = resolveKey(key, scope);
    if (r.state === "not-ours" || r.state === "pass-through") return whole;
    if (r.state === "unresolved") {
      report.unresolved.push({ key, reason: r.reason });
      return `⟦unresolved: ${key}⟧`;
    }
    try {
      const shown = applyFilters(r.raw, r.text, filters ?? "");
      report.resolved.push({ key, provenance: r.provenance });
      return shown;
    } catch (e) {
      report.unresolved.push({ key, reason: (e as Error).message });
      return `⟦unresolved: ${key}⟧`;
    }
  });
  return { text: out, report };
}

// ── The process-wide scope the renderers use ─────────────────────

let _scope: ValueScope | undefined;

/** Set the scope explicitly (tests, or a build over a different checkout). */
export function configureValueScope(scope: ValueScope | undefined): void {
  _scope = scope;
}

/** The configured scope, or one built from the content repository. */
export function valueScope(): ValueScope {
  if (!_scope) _scope = buildValueScope(findContentRepoRoot());
  return _scope;
}

/** What the renderers call: substitute against the process-wide scope. */
export function resolveLiquidValues(text: string): string {
  if (!text.includes("{{")) return text;
  return substituteLiquidValues(text, valueScope()).text;
}
