/**
 * Every declared `tools` graph's Tool nodes, found by asking the declarations.
 *
 * @module cat-harness-tools/tools/discover
 *
 * Every directory a layer declares with graph typology `tools` is loaded,
 * and its `tools()` export merged. A static barrel could not do this: the
 * harness may not import a layer that depends on it (`check:partition`).
 *
 * ## No import edge
 *
 * The module specifier is a variable read from a declaration, as in
 * `qa-checker-discovery.ts`. `repo-partition` counts a literal `import("./x")`
 * as an edge and a variable one as none: the edge exists exactly when the
 * target is hardcoded.
 *
 * ## Broken Tools fail the gate, not the call
 *
 * `check:tools`, in the gate set, runs this discovery: a declared `tools`
 * module that does not load, exports no `tools()`, or yields a Tool that fails
 * its schema is a reported {@link ToolDiscovery.failures | failure}, and the
 * gate fails on it.
 *
 * ## Failures are never "no tools"
 *
 * A declared graph whose module is missing or throws is a failure with a
 * reason, never an empty list, so "could not be loaded" never reads as "has
 * no Tools".
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";

import { declarationPathIn, instanceDirectoryForGraph, layerRootsIn, optInDirectoriesForGraph } from "../schemas/kg/cat-harness.js";
import type { EnabledSubgraphs } from "../schemas/kg/opt-in-subgraphs.js";
import { ToolDefinitionSchema, type ToolDefinition } from "../schemas/tools/tool.js";
import { toolsFromFolders } from "../schemas/tools/tool-folders.js";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { hostSchemaBase } from "../scripts/lib/host-schema.ts";

/** This layer's root (`<repo>/cat-harness`) and the repository above it. */
const HARNESS = resolve(HARNESS_ROOT);
const REPO = resolve(HARNESS, "..");

/**
 * The base every Tool's I/O type IRIs are minted against when the caller
 * names none: THIS layer's declared `canonicalUrl`.
 *
 * The tool-type vocabulary (`schemas/tools/tool-types.ts`) is the harness's, and
 * it is published once, at the harness's base. Before discovery, each
 * layer's `tools()` fell back to its OWN canonical. Nothing checked that,
 * because nothing could see those Tools, and so the DAK base layer's nine pointed at
 * `http://smart.who.int/base/tool-types.schema.json`. That is a FHIR
 * canonical, and WHO publishes no such document. Found by `tools.test.ts` the
 * first time it saw them (bean p0za). A caller that names a base (a preview
 * build) still gets that base for every layer.
 */
function harnessBase(): string | undefined {
  const p = declarationPathIn(HARNESS);
  if (p === undefined || !existsSync(p)) return undefined;
  try {
    return (JSON.parse(readFileSync(p, "utf-8")) as { canonicalUrl?: string }).canonicalUrl;
  } catch {
    return undefined;
  }
}

/**
 * Synchronous on purpose. Bun's `require` loads an ES module written in
 * TypeScript without an `await`, so every consumer keeps calling `tools()`
 * exactly as it called the barrel's, and only its import line changes. An
 * async discovery would have turned eight call sites, and everything above
 * them, into async code for no gain in what is checked.
 */
const load = createRequire(import.meta.url);

export interface ToolSource {
  /** Layer root, relative to the repository. */
  instance: string;
  /** The declared `tools` directory, relative to the repository. */
  dir: string;
  count: number;
}

export interface ToolDiscoveryFailure {
  instance: string;
  dir?: string;
  reason: string;
}

export interface ToolDiscovery {
  /** Every Tool that loaded and validated, in layer order. */
  tools: ToolDefinition[];
  sources: ToolSource[];
  failures: ToolDiscoveryFailure[];
}

/**
 * Load every declared `tools` graph under `repoRoot`.
 *
 * `baseUrl` is the SITE base, as the barrel threaded it. Each `tools()` is
 * handed the base the type vocabulary is published at, which is the host's
 * own directory under it, `<base>/<name>` (`hostSchemaBase`, #676), so a
 * port names `<base>/<name>/tool-types.schema.json#/$defs/<T>`, the address
 * `harness-schema-export.ts` writes.
 */
export function discoverTools(
  repoRoot: string = REPO,
  baseUrl: string | undefined = harnessBase(),
  onlyInstance?: string,
  /**
   * `enabledSubgraphs`: the opt-in sub-graphs switched on — a `tools` graph
   * inside one is loaded beside the layer's own, one inside a switched-off
   * one is not. Absent, each layer's own list decides; a server pass the
   * FOLIO's (`src/tool-groups.ts`, `opt-in-subgraphs.ts`).
   */
  opts: { enabledSubgraphs?: EnabledSubgraphs } = {},
): ToolDiscovery {
  const out: ToolDiscovery = { tools: [], sources: [], failures: [] };
  const seen = new Map<string, string>();
  const rel = (p: string) => relative(repoRoot, p) || ".";

  for (const inst of layerRootsIn(repoRoot)) {
    if (onlyInstance !== undefined && resolve(inst) !== resolve(onlyInstance)) continue;
    let dirs: string[];
    try {
      const own = instanceDirectoryForGraph(inst, "tools");
      // A `tools` graph inside a switched-on opt-in sub-graph (a `work-plan`
      // holding the bean Tool): loaded too. None while nothing is opt-in.
      dirs = [...(own === undefined ? [] : [own]), ...optInDirectoriesForGraph(inst, "tools", opts.enabledSubgraphs)];
    } catch (e) {
      out.failures.push({ instance: rel(inst), reason: `declaration could not be resolved: ${(e as Error).message}` });
      continue;
    }
    for (const dir of dirs) {
      const mod = join(dir, "index.ts");
      const where = { instance: rel(inst), dir: rel(dir) };
      const hostBase = baseUrl ? hostSchemaBase(baseUrl) : baseUrl;

      let defs: unknown;
      if (!existsSync(mod)) {
        // A tools directory of data only — `<id>/<id>.json` folders, no loader
        // module (bean `8lcl`: cat-harness holds no code). Load the folders
        // directly, against the harness base when no base is given.
        try {
          defs = toolsFromFolders(dir, hostBase ?? harnessBase() ?? "");
        } catch (e) {
          out.failures.push({ ...where, reason: `tool folders did not load: ${(e as Error).message}` });
          continue;
        }
        // A declared graph holding neither a loader nor a Tool folder is a
        // failure, not zero tools: a moved or emptied directory must not read
        // as a layer that simply declares none.
        if (Array.isArray(defs) && defs.length === 0) {
          out.failures.push({ ...where, reason: "declares a tools graph that holds no index.ts and no `<id>/<id>.json` Tool folder" });
          continue;
        }
      } else {
        let ns: Record<string, unknown>;
        try {
          ns = load(mod) as Record<string, unknown>;
        } catch (e) {
          out.failures.push({ ...where, reason: `index.ts did not load: ${(e as Error).message}` });
          continue;
        }
        if (typeof ns.tools !== "function") {
          out.failures.push({ ...where, reason: "index.ts exports no `tools()` function" });
          continue;
        }
        try {
          defs = (ns.tools as (b?: string) => unknown)(hostBase);
        } catch (e) {
          out.failures.push({ ...where, reason: `tools() threw: ${(e as Error).message}` });
          continue;
        }
      }
      if (!Array.isArray(defs)) {
        out.failures.push({ ...where, reason: "tools() did not return an array" });
        continue;
      }

      let count = 0;
      for (const d of defs) {
        const parsed = ToolDefinitionSchema.safeParse(d);
        const id = (d as { id?: unknown })?.id;
        if (!parsed.success) {
          out.failures.push({ ...where, reason: `Tool ${String(id)} fails its schema: ${parsed.error.issues[0]?.message}` });
          continue;
        }
        const prior = seen.get(parsed.data.id);
        if (prior) {
          out.failures.push({ ...where, reason: `Tool id "${parsed.data.id}" is also declared by ${prior}` });
          continue;
        }
        seen.set(parsed.data.id, where.instance);
        out.tools.push(d as ToolDefinition);
        count++;
      }
      out.sources.push({ ...where, count });
    }
  }
  return out;
}

const _cache = new Map<string, ToolDefinition[]>();

/**
 * Every discovered Tool, as the old barrel's `tools()` returned them, so a
 * consumer's call sites do not change.
 *
 * **Throws on any discovery failure.** A consumer reading a partial list would
 * export, audit or cover-check a layer as if its unloadable Tools did not
 * exist. `check:tools` reads {@link discoverTools} directly and reports each
 * failure; everything else refuses to proceed on a partial list.
 */
export function tools(baseUrl?: string): ToolDefinition[] {
  return cached(undefined, baseUrl);
}

/**
 * ONE layer's Tools: the ones its own `tools` graph declares.
 *
 * For a consumer that writes one layer's document. `kg-export` publishes
 * `<instance>.jsonld`, and filling the harness's document with a higher layer's
 * Tools would give them `satisfies` links into documents that are never
 * published. A check or an audit over the whole repository reads
 * {@link tools}.
 */
export function toolsOf(instanceRoot: string, baseUrl?: string): ToolDefinition[] {
  return cached(resolve(instanceRoot), baseUrl);
}

function cached(only: string | undefined, baseUrl?: string): ToolDefinition[] {
  const key = `${only ?? "*"}\0${baseUrl ?? ""}`;
  const hit = _cache.get(key);
  if (hit) return hit;
  const d = discoverTools(REPO, baseUrl ?? harnessBase(), only);
  if (d.failures.length > 0) {
    throw new Error(
      `tool discovery failed for ${d.failures.length} declared tools graph(s):\n` +
        d.failures.map((f) => `  ${f.dir ?? f.instance}: ${f.reason}`).join("\n") +
        "\nRun `bun run cat check:tools` for the report.",
    );
  }
  _cache.set(key, d.tools);
  return d.tools;
}
