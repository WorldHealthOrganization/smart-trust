/**
 * What in a repository a harness COULD declare — and whether it already does.
 *
 * The `markers` section of `scan-repo-content.ts` (bean `folio-assistant-dscv`).
 *
 * ## Declare, don't slurp
 *
 * Owner, 2026-10-30T12:41Z, verbatim: *"a harness can point to a repo, but
 * doesnt want to automatically slurpo up all content in a repo. harness
 * desclares what it it pays attention to in the repo."* So this module FINDS and SUGGESTS; it never
 * writes `index.config.json` or a declaration. Every finding carries the
 * snippet that would declare it, and the person picks
 * (`getting-started.bpmn` `Task_ChooseHarnessed`, `repo-conversion.md` §2a).
 *
 * ## Driven by the registries where they can drive it
 *
 * - **Content types** come from `defaultContentTypes` (`content-type.ts`):
 *   every registered type whose marker is present is reported through
 *   `describeRepository`, and every registered `{ indexSection }` type is
 *   checked against `index.config.json#contentTypes.<id>`. A type a
 *   downstream layer registers (the DAK layer's `dak`, the FHIR layer's `ig`) is
 *   picked up the moment that layer is loaded into the same process.
 * - **Directory facets** (`processes`, `beans`, `library`, `uploads`) are
 *   graph typologies, and a hint is dropped unless `BASE_GRAPH_TYPOLOGIES`
 *   still registers its typology — a renamed typology cannot leave this module
 *   suggesting a dead name.
 *
 * What the registries cannot say is which FILES are evidence for a type whose
 * marker is an `index.config.json` section — `dak` used to be `dak.json`, and
 * an IG is evidenced by `sushi-config.yaml` though nothing registered says so.
 * That much is the {@link EVIDENCE} table below: a short, explicit list, each
 * row naming the id it suggests, so a reader can disagree with one row.
 *
 * `ig` is registered by the FHIR layer (`schemas/ig-content-type.ts`,
 * https://github.com/litlfred/fhir-harness/pull/194), whose `include` list is what the snippet
 * proposes. This toolset does not load the FHIR layer, so in a plain scan the
 * `ig` row is a hint with a note saying where the type lives; in a process
 * that has loaded the FHIR layer it reads `source: "registry"`. The row stays
 * either way: the registry says what the section is, not which files are
 * evidence for it.
 *
 * ## Three states for "declared", never two
 *
 * `declared`, `not-declared`, and `unknown` — the last when there is no
 * `index.config.json` to ask, or it does not parse. "Could not tell" is never
 * rendered as "not declared": the third-state rule `scan-repo-content.ts`
 * applies to its buckets.
 *
 * @module scripts/lib/content-markers
 */

import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

import "../../schemas/content/content-types-base.ts";
import {
  defaultContentTypes,
  describeRepository,
  INDEX_SECTION_FILE,
  type ContentTypeRegistry,
} from "../../schemas/content/content-type.ts";
import { BASE_GRAPH_TYPOLOGIES } from "../../schemas/kg/graph-typology-registry.ts";
import { declarationPathIn } from "../../schemas/kg/cat-harness.ts";

/** Where a declaration for a finding would go. */
export type MarkerTarget =
  /** `index.config.json#contentTypes.<id>`. */
  | "contentTypes"
  /** A layer declaration's `directories[]`, with a graph typology. */
  | "directories"
  /** A layer's `contentType` (its folio content type). */
  | "contentType";

export type DeclaredState = "declared" | "not-declared" | "unknown";

export interface MarkerFinding {
  /** The id it would be declared under: a content-type id, typology, or folio content type. */
  id: string;
  target: MarkerTarget;
  /**
   * `registry` when a registered type or typology drove it; `hint` when the
   * {@link EVIDENCE} table did; `index` when `index.config.json` declares a
   * section no type loaded in this process registers (a downstream layer's).
   */
  source: "registry" | "hint" | "index";
  /** One line: what the marker says the repository holds. */
  summary: string;
  /** Repo-relative paths that evidence it (directories end in `/`), at most {@link MAX_PATHS}. */
  paths: string[];
  /** How many paths matched in all; `paths` may show fewer. */
  matched: number;
  declared: DeclaredState;
  /** Where it is declared, when it is. */
  declaredAt?: string;
  /** What would declare it. A SUGGESTION: nothing here is written. */
  suggestion: { at: string; snippet: Record<string, unknown> };
  /** Anything the person should know before picking it. */
  note?: string;
}

export interface MarkerScan {
  /** `index.config.json` at the scanned root: present and parsed, absent, or unreadable. */
  index: "present" | "absent" | "unreadable";
  /** Local layers found through the index (`source.local.at`), by name. */
  instances: Array<{ name: string; at: string; contentType?: string }>;
  /** Types the repository already ASSERTS, per `describeRepository` — context, not suggestions. */
  asserted: Array<{ id: string; marker: string; parsed: boolean }>;
  findings: MarkerFinding[];
}

export const MAX_PATHS = 8;

/** Never evidence: tooling and build output, not anybody's content. */
const IGNORE_SEGMENTS = new Set([
  ".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", "target",
  ".next", ".cache", "coverage", ".lake", ".pytest_cache", "vendor", "fsh-generated", "output", "temp",
]);

function ignored(rel: string): boolean {
  return rel.split("/").some((p) => IGNORE_SEGMENTS.has(p));
}

// ---------------------------------------------------------------------------
// What the repository already declares

interface Declared {
  index: MarkerScan["index"];
  contentTypes: Set<string>;
  instances: Array<{ name: string; at: string; contentType?: string; dirs: Array<{ path: string; typologies: string[] }> }>;
}

function readJson(p: string): unknown {
  return JSON.parse(readFileSync(p, "utf-8"));
}

function normDir(at: string, path: string): string {
  const joined = posix.normalize(posix.join(at, path));
  const trimmed = joined.replace(/^\.\/?/, "").replace(/\/+$/, "");
  return trimmed === "" || trimmed === "." ? "" : `${trimmed}/`;
}

export function readDeclared(root: string): Declared {
  const out: Declared = { index: "absent", contentTypes: new Set(), instances: [] };
  const ip = join(root, INDEX_SECTION_FILE);
  if (!existsSync(ip)) return out;
  let idx: { contentTypes?: Record<string, unknown>; instances?: unknown };
  try {
    idx = readJson(ip) as typeof idx;
  } catch {
    out.index = "unreadable";
    return out;
  }
  out.index = "present";
  for (const k of Object.keys(idx.contentTypes ?? {})) out.contentTypes.add(k);
  const list = Array.isArray(idx.instances) ? idx.instances : [];
  for (const raw of list as Array<Record<string, unknown>>) {
    const local = (raw?.source as { local?: { at?: unknown } } | undefined)?.local;
    if (!local || typeof local.at !== "string" || typeof raw.name !== "string") continue;
    const at = normDir(".", local.at);
    let contentType = typeof raw.contentType === "string" ? raw.contentType : undefined;
    const dirs: Array<{ path: string; typologies: string[] }> = [];
    try {
      const dp = declarationPathIn(join(root, at));
      if (dp && existsSync(dp)) {
        const decl = readJson(dp) as { directories?: unknown; contentType?: unknown };
        if (contentType === undefined && typeof decl.contentType === "string") contentType = decl.contentType;
        for (const d of (Array.isArray(decl.directories) ? decl.directories : []) as Array<Record<string, unknown>>) {
          if (typeof d?.path !== "string") continue;
          const ts = Array.isArray(d.graphTypologies) ? d.graphTypologies.filter((t): t is string => typeof t === "string") : [];
          dirs.push({ path: normDir(at, d.path), typologies: ts });
        }
      }
    } catch {
      // An unreadable declaration declares nothing we can see; the index entry still counts.
    }
    out.instances.push({ name: raw.name, at, contentType, dirs });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Evidence: which files suggest what

interface Evidence {
  id: string;
  target: MarkerTarget;
  summary: string;
  /** Paths that evidence it, given the repository's file list. */
  match: (files: string[]) => string[];
  note?: string;
}

const atRoot = (names: string[]) => (files: string[]) => files.filter((f) => names.includes(f));
const underTop = (dir: string) => (files: string[]) => (files.some((f) => f.startsWith(`${dir}/`)) ? [`${dir}/`] : []);
const byExt = (ext: string) => (files: string[]) => files.filter((f) => f.endsWith(ext));

/**
 * The directory a group of files would be declared at: the nearest ancestor
 * named `processes` when there is one, else each file's own directory —
 * collapsed so a directory under another reported one is not reported twice.
 */
export function declarableDirs(files: string[], anchor: string): string[] {
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.split("/").slice(0, -1);
    const i = parts.lastIndexOf(anchor);
    dirs.add(parts.length === 0 ? "" : `${(i >= 0 ? parts.slice(0, i + 1) : parts).join("/")}/`);
  }
  const sorted = [...dirs].sort((a, b) => a.length - b.length || a.localeCompare(b));
  return sorted.filter((d, i) => !sorted.slice(0, i).some((p) => p !== "" && d.startsWith(p)));
}

/**
 * Evidence the registries cannot state. Each row is one opinion, named by the
 * id it suggests; the directory rows are checked against
 * `BASE_GRAPH_TYPOLOGIES` before use.
 */
export const EVIDENCE: readonly Evidence[] = [
  {
    id: "ig",
    target: "contentTypes",
    summary: "A FHIR implementation guide (SUSHI): FSH sources compiled by `sushi-config.yaml`.",
    match: (files) => {
      if (!files.includes("sushi-config.yaml")) return [];
      const out = ["sushi-config.yaml"];
      for (const d of ["input/fsh", "input/pagecontent", "input/images", "input/includes"]) {
        if (files.some((f) => f.startsWith(`${d}/`))) out.push(`${d}/`);
      }
      if (files.includes("ig.ini")) out.push("ig.ini");
      return out;
    },
    note: "`ig` is registered by the FHIR layer (schemas/ig-content-type.ts, https://github.com/litlfred/fhir-harness), which this scan did not load; the snippet follows that type's `include` list. Its IG readers read only what `include` lists.",
  },
  {
    id: "dak",
    target: "contentTypes",
    summary: "A WHO SMART Guidelines DAK, declared by a legacy marker file the index section replaced (owner, 2026-10-24).",
    match: atRoot(["dak.json", "dak.config.json"]),
    note: "Move the legacy file's fields into the section, then delete the file.",
  },
  {
    id: "processes",
    target: "directories",
    summary: "BPMN processes.",
    match: byExt(".bpmn"),
  },
  {
    id: "beans",
    target: "directories",
    summary: "A beans work plan.",
    match: (files) => [...atRoot([".beans.yml"])(files), ...underTop("beans")(files)],
  },
  { id: "library", target: "directories", summary: "Ingested source documents.", match: underTop("library") },
  { id: "uploads", target: "directories", summary: "Source files as received, before ingestion.", match: underTop("uploads") },
  {
    id: "paper",
    target: "contentType",
    summary: "Lean 4 mathematics — the `paper` folio content type.",
    match: (files) => [...atRoot(["lakefile.lean", "lakefile.toml", "lean-toolchain"])(files), ...byExt(".lean")(files)],
  },
  {
    id: "document",
    target: "contentType",
    summary: "Folio manifests (`folio/<slug>/<slug>.ts`) — authored folio content.",
    match: (files) =>
      files.filter((f) => {
        const m = /^folio\/([^/]+)\/([^/]+)\.ts$/.exec(f);
        return m !== null && m[1] === m[2];
      }),
    note: "Use `paper` instead when the folio carries Lean.",
  },
];

// ---------------------------------------------------------------------------

function instanceFor(decl: Declared, path: string): Declared["instances"][number] | undefined {
  // The deepest local layer whose root contains the path.
  return [...decl.instances]
    .filter((i) => i.at === "" || path.startsWith(i.at))
    .sort((a, b) => b.at.length - a.at.length)[0];
}

function snippetFor(e: Evidence, paths: string[], root: string): Record<string, unknown> {
  if (e.id === "ig") return { ig: { include: paths } };
  if (e.id === "dak") {
    try {
      const doc = readJson(join(root, paths[0]!)) as Record<string, unknown>;
      const scalars = Object.fromEntries(Object.entries(doc).filter(([, v]) => typeof v !== "object"));
      return { dak: scalars };
    } catch {
      return { dak: {} };
    }
  }
  return {};
}

/**
 * Report what this repository could declare, and what it already does.
 *
 * Pure reading: it takes the file list the scanner already has, so a caller
 * that has none passes `listFiles(root).files`.
 */
export function scanMarkers(
  root: string,
  allFiles: string[],
  registry: ContentTypeRegistry = defaultContentTypes,
): MarkerScan {
  const files = allFiles.filter((f) => !ignored(f));
  const decl = readDeclared(root);
  const desc = describeRepository(root, registry);
  const findings: MarkerFinding[] = [];
  const unknown = decl.index !== "present";

  // 1. Registered index-section types: declared or not, straight from the registry.
  const registryIds = new Set<string>();
  for (const [, def] of registry.entries()) {
    if (typeof def.filename !== "object" || def.filename === null) continue;
    registryIds.add(def.filename.indexSection);
  }

  // 2. Evidence rows.
  for (const e of EVIDENCE) {
    if (e.target === "directories" && !(e.id in BASE_GRAPH_TYPOLOGIES)) continue;
    const hit = e.match(files);
    if (hit.length === 0) continue;

    if (e.target === "contentTypes") {
      const declared: DeclaredState = unknown ? "unknown" : decl.contentTypes.has(e.id) ? "declared" : "not-declared";
      findings.push({
        id: e.id,
        target: e.target,
        source: registryIds.has(e.id) ? "registry" : "hint",
        summary: e.summary,
        paths: hit.slice(0, MAX_PATHS),
        matched: hit.length,
        declared,
        ...(declared === "declared" ? { declaredAt: `${INDEX_SECTION_FILE}#contentTypes.${e.id}` } : {}),
        suggestion: { at: `${INDEX_SECTION_FILE}#contentTypes`, snippet: snippetFor(e, hit, root) },
        ...(e.note && !(e.id === "ig" && registryIds.has("ig")) ? { note: e.note } : {}),
      });
      continue;
    }

    if (e.target === "directories") {
      // Processes are declared where they sit; every other facet is one
      // top-level directory (a `.beans.yml` alone still means `beans/`).
      const isProc = e.id === "processes";
      const dirs = isProc ? declarableDirs(hit, "processes") : hit.some((h) => h.endsWith("/")) ? hit.filter((h) => h.endsWith("/")) : [`${e.id}/`];
      for (const dir of dirs) {
        const own = isProc ? hit.filter((h) => dir === "" || h.startsWith(dir)) : hit;
        const inst = instanceFor(decl, dir);
        const by = inst?.dirs.find((d) => (d.path === dir || dir.startsWith(d.path) || d.path.startsWith(dir)) && d.typologies.includes(e.id));
        const declared: DeclaredState = unknown ? "unknown" : by ? "declared" : "not-declared";
        const rel = inst ? dir.slice(inst.at.length) || "./" : dir || "./";
        findings.push({
          id: e.id,
          target: e.target,
          source: "registry",
          summary: e.summary,
          paths: own.slice(0, MAX_PATHS),
          matched: own.length,
          declared,
          ...(by && inst ? { declaredAt: `${inst.at}${inst.name}.json#directories(${by.path})` } : {}),
          suggestion: {
            at: inst ? `${inst.at}${inst.name}.json#directories` : "the instance declaration's directories (no local instance found)",
            snippet: { id: e.id, path: rel, graphTypologies: [e.id] },
          },
        });
      }
      continue;
    }

    // contentType: the folio content type of a local layer.
    const inst = instanceFor(decl, hit[0]!);
    const has = inst?.contentType;
    const declared: DeclaredState = unknown ? "unknown" : has === e.id ? "declared" : "not-declared";
    findings.push({
      id: e.id,
      target: e.target,
      source: "hint",
      summary: e.summary,
      paths: hit.slice(0, MAX_PATHS),
      matched: hit.length,
      declared,
      ...(declared === "declared" && inst ? { declaredAt: `${INDEX_SECTION_FILE}#instances(${inst.name}).contentType` } : {}),
      suggestion: {
        at: inst ? `${INDEX_SECTION_FILE}#instances(${inst.name})` : `${INDEX_SECTION_FILE}#instances`,
        snippet: { contentType: e.id },
      },
      ...(has && has !== e.id ? { note: `instance \`${inst!.name}\` already declares contentType \`${has}\`` } : e.note ? { note: e.note } : {}),
    });
  }

  // 3. Sections the index already declares that no evidence row found — still
  // reported, as declared, so the list is the whole picture. A section whose
  // type this process has not loaded (the DAK layer's `dak`) is `index`-sourced.
  for (const id of decl.contentTypes) {
    if (findings.some((f) => f.target === "contentTypes" && f.id === id)) continue;
    findings.push({
      id,
      target: "contentTypes",
      source: registryIds.has(id) ? "registry" : "index",
      summary: registry.get(id)?.summary ?? "Declared in the index; its type is registered by a layer not loaded here.",
      paths: [],
      matched: 0,
      declared: "declared",
      declaredAt: `${INDEX_SECTION_FILE}#contentTypes.${id}`,
      suggestion: { at: `${INDEX_SECTION_FILE}#contentTypes`, snippet: {} },
    });
  }

  return {
    index: decl.index,
    instances: decl.instances.map(({ name, at, contentType }) => ({ name, at: at || "./", ...(contentType ? { contentType } : {}) })),
    asserted: desc.types.map((t) => ({ id: t.id, marker: t.marker, parsed: t.parsed })),
    findings,
  };
}

const MARK: Record<DeclaredState, string> = { declared: "✓ declared", "not-declared": "○ not declared", unknown: "? unknown" };

/** Human report. The JSON (`--json`) is the same facts. */
export function formatMarkers(m: MarkerScan): string {
  const out: string[] = [];
  const open = m.findings.filter((f) => f.declared !== "declared");
  out.push(`Markers — what the harness could declare (${m.findings.length} found, ${open.length} not declared):`);
  if (m.index !== "present") {
    out.push(`  index.config.json is ${m.index}: "declared" cannot be checked, so every row reads "unknown".`);
  }
  if (m.asserted.length) out.push(`  already asserted: ${m.asserted.map((a) => `${a.id} (${a.marker})`).join(", ")}`);
  if (m.findings.length === 0) out.push("  none — no marker this scanner knows was found. That is not \"nothing to harness\".");
  m.findings.forEach((f, i) => {
    out.push(`  ${i + 1}. [${MARK[f.declared]}] ${f.target === "contentTypes" ? "contentTypes." : f.target === "contentType" ? "contentType=" : "directories:"}${f.id}  (${f.source})`);
    out.push(`       ${f.summary}`);
    if (f.paths.length) out.push(`       ${f.paths.join(", ")}${f.matched > f.paths.length ? `, … ${f.matched - f.paths.length} more` : ""}`);
    if (f.declaredAt) out.push(`       declared at ${f.declaredAt}`);
    else out.push(`       would go at ${f.suggestion.at}: ${JSON.stringify(f.suggestion.snippet)}`);
    if (f.note) out.push(`       note: ${f.note}`);
  });
  out.push("  Suggested only — nothing is declared until the person picks it (declare, don't slurp).");
  return out.join("\n");
}
