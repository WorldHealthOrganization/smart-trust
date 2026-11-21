/**
 * `site.data.fhir` for a just-the-docs render of ONE implementation guide —
 * the IG Publisher's Jekyll variables, populated by the layer that owns them.
 *
 * Owner, 2026-09-30 (bean `bamf`, issue #1564): *"{{ site.data...}} is declared
 * for fhir-harness only"* and *"those are made available ... in justthedocs
 * pipeline w/ fhir harness responsible for declaring/populate fhir metadata
 * jekyll tooling"*. fhir-harness declares `site.data` as a pass-through Liquid
 * prefix (`fhir-harness.json`), so the platform leaves `{{ site.data.fhir.… }}`
 * for Jekyll; this writes what Jekyll then reads. It is the metadata half of
 * `ig-publisher-reduction` P0.
 *
 * ## One IG per site
 *
 * Jekyll has ONE `_data/`, so `site.data.fhir` describes one IG — as it does
 * under the Publisher, whose build is one IG. This renders for one IG root.
 *
 * ## Only what it can source
 *
 * There is no Publisher-written `_data/fhir.json` in this repository to copy a
 * schema from, and a field written from memory would be a guess wearing the
 * clothes of a fact. So it writes:
 *
 * - `ig.*` — fields of the ImplementationGuide RESOURCE (`id`, `url`, `name`,
 *   `title`, `version`, `status`, `publisher`, `fhirVersion`), which is what
 *   the Publisher's `site.data.fhir.ig` is;
 * - `packageId` and `canonical`.
 *
 * Every other field is left out and LISTED in the result's `undetermined`, never
 * written as an empty string: Jekyll prints an empty string and an absent value
 * identically, so writing `""` would hide the gap.
 *
 * ## Sources, in authority order
 *
 * 0. The IG's FHIR AST (`output-ast/`, where `ig-cache.sh restore` puts it,
 *    or `--ast`): the ImplementationGuide RESOURCE the Publisher built, which
 *    is what its `site.data.fhir.ig` is (owner, 2026-10-09: *"do
 *    site.data.fhir from the FHIR AST"*; bean `jut3`). An AST is a cache, so
 *    every field it supplies says so in its provenance. `sushi-config.yaml`
 *    then fills only what the resource lacks, and a field the two state
 *    DIFFERENTLY is reported in `disagreements` — the AST's value is written,
 *    and the reader of the log learns the cache and the source have parted.
 * 1. `sushi-config.yaml` at the IG root — what the Publisher itself reads.
 * 2. `fhir-artifact-index/index.json` — read from a published IG; carries
 *    `packageId`, `version`, `status`, `fhirVersion`, `canonicalBase`, but
 *    not `id`, `name` or `publisher`. The status once came from a separate,
 *    hand-copied identity file beside the index, which drifted from the IG's
 *    own sushi-config; owner 2026-11-14: "excise ig-identy.json".
 *
 * Usage:
 *   bun run fhir-harness/scripts/ig-site-data.ts --ig <IG root> --out <site>/_data/fhir.json [--ast <AST dir>] [--check]
 *
 * @module fhir-harness/scripts/ig-site-data
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { readAst } from "./ig-ast.ts";
import { igReadScope } from "./ig-read-scope.ts";
import { indexReadPath } from "./lib/ig-index-at.ts";

/** The ImplementationGuide resource fields the Publisher exposes as `site.data.fhir.ig`. */
export interface IgResourceFields {
  id?: string;
  url?: string;
  name?: string;
  title?: string;
  version?: string;
  status?: string;
  publisher?: string;
  fhirVersion?: string[];
}

export interface FhirSiteData {
  packageId?: string;
  canonical?: string;
  ig: IgResourceFields;
}

export interface IgSiteDataResult {
  data: FhirSiteData;
  /** Which file each written field came from. */
  provenance: Record<string, string>;
  /** Fields a Publisher build would have and this could not source. */
  undetermined: string[];
  /** Sources read and deliberately not used, with why. */
  refused: string[];
  /** Fields the AST and `sushi-config.yaml` state differently: the AST's value was written. */
  disagreements: string[];
  /** An AST that is there and could not be used, with why -- the build goes on from the other sources. */
  astNotUsed?: string;
}

/**
 * The ImplementationGuide resource of the AST at `astDir`, with the file it
 * was read from -- or undefined when there is no AST there. An AST that IS
 * there but cannot be read, or holds no ImplementationGuide, is a reason, not
 * a silent fallback.
 */
export function astImplementationGuide(astDir: string): { resource: Record<string, unknown>; file: string } | { why: string } | undefined {
  if (!existsSync(join(astDir, "manifest.json"))) return undefined;
  try {
    const ast = readAst(astDir);
    const igs = ast.manifest.resources.filter((r) => r.resourceType === "ImplementationGuide");
    if (igs.length !== 1) return { why: `${astDir} holds ${igs.length} ImplementationGuide resources, not one` };
    const resource = readJson(join(astDir, igs[0]!.file));
    if (!resource) return { why: `${join(astDir, igs[0]!.file)} is not valid JSON` };
    return { resource, file: igs[0]!.file };
  } catch (e) {
    return { why: (e as Error).message };
  }
}

const ALL_IG_FIELDS: Array<keyof IgResourceFields> = ["id", "url", "name", "title", "version", "status", "publisher", "fhirVersion"];

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

function readJson(p: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Compute `site.data.fhir` for the IG at `igRoot`. Throws when no source exists.
 *
 * @param opts.ast the IG's AST directory; default `<igRoot>/output-ast`
 */
export function igSiteData(igRoot: string, opts: { ast?: string } = {}): IgSiteDataResult {
  const ig: IgResourceFields = {};
  const data: FhirSiteData = { ig };
  const provenance: Record<string, string> = {};
  const refused: string[] = [];
  const disagreements: string[] = [];
  const get = (field: string): unknown => {
    const [head, tail] = field.split(".");
    const v = (data as unknown as Record<string, unknown>)[head!];
    return tail ? (v as Record<string, unknown> | undefined)?.[tail] : v;
  };
  // The first source to state a field writes it; a later one only fills a
  // gap, and a later one that states it DIFFERENTLY is recorded.
  const set = (field: string, value: unknown, from: string) => {
    if (value === undefined) return;
    const had = get(field);
    if (had !== undefined) {
      if (JSON.stringify(had) !== JSON.stringify(value)) {
        disagreements.push(`${field}: ${provenance[field]} says ${JSON.stringify(had)}, ${from} says ${JSON.stringify(value)}`);
      }
      return;
    }
    const [head, tail] = field.split(".");
    if (tail) (data as unknown as Record<string, Record<string, unknown>>)[head!]![tail] = value;
    else (data as unknown as Record<string, unknown>)[head!] = value;
    provenance[field] = from;
  };

  const sushiPath = join(igRoot, "sushi-config.yaml");
  const indexPath = indexReadPath(igRoot, "index.json");
  const astDir = opts.ast ?? join(igRoot, "output-ast");

  const fromAst = astImplementationGuide(astDir);
  const astNotUsed = fromAst && "why" in fromAst ? `the FHIR AST at ${astDir}: ${fromAst.why}` : undefined;
  if (fromAst && !("why" in fromAst)) {
    const r = fromAst.resource;
    const from = `FHIR AST ${fromAst.file} (cache)`;
    const id = str(r.id);
    const url = str(r.url);
    set("ig.id", id, from);
    set("ig.url", url, from);
    set("ig.name", str(r.name), from);
    set("ig.title", str(r.title), from);
    set("ig.version", str(r.version), from);
    set("ig.status", str(r.status), from);
    set("ig.publisher", str(r.publisher), from);
    set("ig.fhirVersion", Array.isArray(r.fhirVersion) ? r.fhirVersion.map(String) : undefined, from);
    set("packageId", str(r.packageId), from);
    // The canonical is the IG resource's url less its own path, as SUSHI composes it the other way.
    const suffix = id ? `/ImplementationGuide/${id}` : undefined;
    set("canonical", url && suffix && url.endsWith(suffix) ? url.slice(0, -suffix.length) : undefined, from);
  }

  // sushi-config.yaml is read only when contentTypes.ig.include declares it.
  if (igReadScope(igRoot).declares("sushi-config.yaml") && existsSync(sushiPath)) {
    const s = (parseYaml(readFileSync(sushiPath, "utf-8")) ?? {}) as Record<string, unknown>;
    const from = "sushi-config.yaml";
    const id = str(s.id);
    const canonical = str(s.canonical);
    set("ig.id", id, from);
    set("ig.name", str(s.name), from);
    set("ig.title", str(s.title), from);
    set("ig.version", str(s.version), from);
    set("ig.status", str(s.status), from);
    const pub = s.publisher;
    set("ig.publisher", str(pub) ?? str((pub as { name?: unknown } | undefined)?.name), from);
    const fv = s.fhirVersion;
    set("ig.fhirVersion", Array.isArray(fv) ? fv.map(String) : str(fv) ? [String(fv)] : undefined, from);
    set("canonical", canonical, from);
    // SUSHI's own rule: packageId defaults to id.
    set("packageId", str(s.packageId) ?? id, from);
    if (canonical && id) set("ig.url", `${canonical}/ImplementationGuide/${id}`, from);
  } else if (existsSync(indexPath)) {
    const idx = readJson(indexPath);
    if (!idx) throw new Error(`${indexPath} is not valid JSON`);
    const from = "fhir-artifact-index/index.json";
    set("packageId", str(idx.packageId), from);
    set("canonical", str(idx.canonicalBase), from);
    set("ig.version", str(idx.version), from);
    if (Array.isArray(idx.fhirVersion)) set("ig.fhirVersion", idx.fhirVersion.map(String), from);
    // Status is THIS IG's own fact, from its own ImplementationGuide, which
    // the index records beside its version.
    set("ig.status", str(idx.status), from);
  } else if (!fromAst || "why" in fromAst) {
    throw new Error(`no FHIR AST, sushi-config.yaml or fhir-artifact-index/index.json under ${igRoot}: nothing to populate site.data.fhir from`);
  }

  const undetermined = [
    ...ALL_IG_FIELDS.filter((f) => ig[f] === undefined).map((f) => `ig.${f}`),
    ...(["packageId", "canonical"] as const).filter((f) => data[f] === undefined),
  ];
  return { data, provenance, undetermined, refused, disagreements, ...(astNotUsed ? { astNotUsed } : {}) };
}

export function describeSiteData(r: IgSiteDataResult): string {
  const lines = [`site.data.fhir: ${Object.keys(r.provenance).length} field(s) written`];
  if (r.undetermined.length) lines.push(`  undetermined (not written): ${r.undetermined.join(", ")}`);
  for (const x of r.refused) lines.push(`  refused: ${x}`);
  if (r.astNotUsed) lines.push(`  AST NOT USED: ${r.astNotUsed}`);
  for (const x of r.disagreements) lines.push(`  DISAGREE (the AST's value written): ${x}`);
  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const igRoot = opt("--ig");
  const out = opt("--out");
  if (!igRoot || !out) {
    console.error("usage: ig-site-data.ts --ig <IG root> --out <site>/_data/fhir.json [--ast <AST dir>] [--check]");
    process.exit(2);
  }
  const ast = opt("--ast");
  const r = igSiteData(resolve(igRoot), ast ? { ast: resolve(ast) } : {});
  const text = JSON.stringify(r.data, null, 2) + "\n";
  if (args.includes("--check")) {
    const current = existsSync(out) ? readFileSync(out, "utf-8") : undefined;
    if (current !== text) {
      console.error(`✗ ${out} is stale or missing — run without --check`);
      process.exit(1);
    }
    console.log(describeSiteData(r));
    process.exit(0);
  }
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, text);
  console.log(describeSiteData(r));
  console.log(`wrote ${out}`);
}
