/**
 * The IG's package dependencies, as the IG Publisher's `dependency-table.xhtml`
 * (and its `-short` / `-nontech` forms) shows them: each package the IG
 * depends on, then what THAT depends on, with the FHIR version each is built
 * on.
 *
 * The Publisher generates the fragment, so an IG site built without it showed
 * a "not rendered" marker where the table was (the WHO SMART Trust IG `dependencies.html`
 * and the `-short` form on its index page; bean `4475`). This computes the
 * rows; `templates/ig-site/dependency-table.liquid` only lays them out.
 *
 * Direct dependencies come from the IG's own declaration: the AST's
 * ImplementationGuide `dependsOn` first, `sushi-config.yaml`'s `dependencies`
 * where there is no AST. What a dependency depends on is read from the FHIR
 * package cache (`<cache>/<id>#<version>/package/package.json`). A package the
 * cache does not hold is a row marked `resolved: false` — never silently a
 * leaf, which would read as "depends on nothing".
 *
 * @module fhir-harness/scripts/ig-dependencies
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface DependencyRow {
  packageId: string;
  version: string;
  /** Nesting depth: 0 for the IG's own dependencies. */
  depth: number;
  title?: string;
  canonical?: string;
  fhirVersion?: string;
  /** Whether the package's own manifest was read from the cache. */
  resolved: boolean;
  /** Already listed above in this table: its dependencies are not repeated. */
  repeat?: boolean;
}

export interface Declared {
  packageId: string;
  version: string;
  canonical?: string;
}

/** The IG's own dependencies, from an ImplementationGuide resource's `dependsOn`. */
export function fromImplementationGuide(ig: Record<string, unknown>): Declared[] {
  const deps = Array.isArray(ig.dependsOn) ? (ig.dependsOn as Array<Record<string, unknown>>) : [];
  return deps
    .filter((d) => typeof d.packageId === "string" && typeof d.version === "string")
    .map((d) => ({ packageId: d.packageId as string, version: d.version as string, ...(typeof d.uri === "string" ? { canonical: (d.uri as string).replace(/\/ImplementationGuide\/.*$/, "") } : {}) }));
}

/** The IG's own dependencies, from `sushi-config.yaml`'s `dependencies` map. */
export function fromSushiConfig(sushi: Record<string, unknown>): Declared[] {
  const deps = sushi.dependencies && typeof sushi.dependencies === "object" ? (sushi.dependencies as Record<string, unknown>) : {};
  const out: Declared[] = [];
  for (const [id, v] of Object.entries(deps)) {
    if (typeof v === "string" || typeof v === "number") out.push({ packageId: id, version: String(v) });
    else if (v && typeof v === "object" && (v as Record<string, unknown>).version !== undefined) {
      const o = v as Record<string, unknown>;
      out.push({ packageId: id, version: String(o.version), ...(typeof o.uri === "string" ? { canonical: (o.uri as string).replace(/\/ImplementationGuide\/.*$/, "") } : {}) });
    }
  }
  return out;
}

/** The FHIR package cache this machine uses: `FHIR_PACKAGE_CACHE`, else `~/.fhir/packages`. */
export function defaultPackageCache(env: Record<string, string | undefined> = process.env): string {
  return env.FHIR_PACKAGE_CACHE ?? join(homedir(), ".fhir", "packages");
}

function manifest(cache: string, id: string, version: string): Record<string, unknown> | undefined {
  const f = join(cache, `${id}#${version}`, "package", "package.json");
  if (!existsSync(f)) return undefined;
  try {
    return JSON.parse(readFileSync(f, "utf-8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * The rows, depth-first in declaration order. The core FHIR packages
 * (`hl7.fhir.r4.core` and its siblings) are listed where declared but not
 * expanded, and a package already listed is marked `repeat` rather than
 * expanded twice — the closure is a graph, the table a tree.
 */
export function dependencyRows(declared: Declared[], cache: string, maxDepth = 4): DependencyRow[] {
  const rows: DependencyRow[] = [];
  const seen = new Set<string>();
  const visit = (d: Declared, depth: number): void => {
    const key = `${d.packageId}#${d.version}`;
    const m = manifest(cache, d.packageId, d.version);
    const fhirVersions = m && Array.isArray(m.fhirVersions) ? (m.fhirVersions as string[]) : undefined;
    const row: DependencyRow = {
      packageId: d.packageId,
      version: d.version,
      depth,
      resolved: m !== undefined,
      ...(typeof m?.title === "string" ? { title: m.title } : {}),
      ...((typeof m?.canonical === "string" ? m.canonical : d.canonical) ? { canonical: (typeof m?.canonical === "string" ? m.canonical : d.canonical) as string } : {}),
      ...(fhirVersions?.length ? { fhirVersion: fhirVersions[0] } : {}),
    };
    if (seen.has(key)) {
      rows.push({ ...row, repeat: true });
      return;
    }
    seen.add(key);
    rows.push(row);
    if (!m || depth + 1 > maxDepth || /^hl7\.fhir\.r\d+b?\.core$/.test(d.packageId)) return;
    const deps = m.dependencies && typeof m.dependencies === "object" ? (m.dependencies as Record<string, string>) : {};
    for (const [id, v] of Object.entries(deps)) visit({ packageId: id, version: String(v) }, depth + 1);
  };
  for (const d of declared) visit(d, 0);
  return rows;
}

/** The three fragment names the Publisher generates for this table. */
export const DEPENDENCY_FRAGMENTS: Record<string, "full" | "short" | "nontech"> = {
  "dependency-table.xhtml": "full",
  "dependency-table-short.xhtml": "short",
  "dependency-table-nontech.xhtml": "nontech",
};
