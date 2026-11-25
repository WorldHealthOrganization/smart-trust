/**
 * Register a declared set of tool groups, wherever they are declared.
 *
 * @module src/tool-groups
 *
 * ## Why the mechanism is here and there is no list
 *
 * Two servers register tool groups — the viewer server in
 * `adapters/mcp-server/` and the HTTP/stdio server in `src/server.ts`. Each
 * had its OWN list until 2026-10-05, and the viewer server's named six forked
 * modules that had drifted from the ones the other served. Now neither has a
 * list: both call {@link registerServedToolGroups}, which reads every Tool
 * node in the folio's dependency tree (owner, bean riit 3c). What remains here
 * is the loading: resolve a declared module by variable path, call its
 * registrar, and report which of three things happened.
 *
 * That mechanism lived in `adapters/mcp-server/tool-groups.ts`, which is
 * core's. The harness is the BASE repository — core may import it, it may not
 * import core — so `src/server.ts` could not reuse it and had to import its
 * one core tool group directly. Same lesson as the render targets: the
 * mechanism is generic and belongs at the base; the declaration is per-layer
 * and belongs with the layer that owns the tools.
 *
 * ## An absent layer is a determined absence, not a crash and not silence
 *
 * A group whose module is not present is **skipped and reported**, because
 * after the split a core-only checkout legitimately has no science layer and
 * must still start. That is the one behaviour a hardcoded import cannot have.
 * It is equally not silent: a server that quietly starts without a tool group
 * looks identical to one where that group is broken, and the operator finds
 * out from a failing call rather than from the boot log.
 *
 * A group that IS present and fails to load is a different state again —
 * reported as an error, never as "this layer is not installed", because the
 * remedy is opposite (fix the module vs install the layer).
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { declarationChain, resolveImplementingPath } from "../schemas/kg/harness-config.js";
import { enabledSubgraphs } from "../schemas/kg/opt-in-subgraphs.js";
import type { ToolDefinition } from "../schemas/tools/tool.js";
import { discoverTools } from "../tools/discover.js";

/** The harness this layer implements: its Tool nodes are served for every folio. */
const HARNESS_ROOT = resolve(import.meta.dir, "..", "..", "cat-harness");
/** This layer, which declares the Tool nodes whose in-process module is its own code (`tools/index.ts`). */
const TOOLS_LAYER_ROOT = resolve(import.meta.dir, "..");

/**
 * Which layer owns a group: the name of the layer whose Tool node declares
 * it (`cat-harness`, a content layer above it, …). A string rather than a closed
 * list of three since the groups are discovered across the dependency tree
 * (bean riit, 3c): a list here would have to name every layer above.
 */
export type ToolGroupLayer = string;

export interface ToolGroupDeclaration {
  /** Stable id, used in the boot report. */
  id: string;
  /** Repo-relative module. Resolved by VARIABLE path, so this file imports none. */
  module: string;
  /**
   * The exported registrar, called with the built server. Absent means "the
   * module's ONE `register…` export" — a Tool node names its registrar only
   * when the module has more than one (`inProcess.register`), and a module
   * with zero or several is reported as `failed`, never guessed at.
   */
  registrar?: string;
  /**
   * The layer that owns it. Not consulted at runtime — a declaration is not a
   * gate — but it is what makes the boundary reviewable in one place instead
   * of inferable from six import lines.
   */
  layer: ToolGroupLayer;
  /** What it needs on the machine, for the operator reading a skip. */
  requires?: string;
}


/** What happened to one declared group. Three outcomes, never two. */
export type ToolGroupOutcome =
  | { id: string; state: "registered" }
  | { id: string; state: "absent"; layer: ToolGroupLayer; detail: string }
  | { id: string; state: "failed"; detail: string };

/**
 * Register every declared group against the server.
 *
 * Returns one outcome per declaration. The caller reports them; this function
 * does not print, so a test can assert on the outcomes rather than on stderr.
 */
export async function registerDeclaredToolGroups(
  server: unknown,
  groups: readonly ToolGroupDeclaration[],
  /**
   * The DECLARING layer's root: the declared modules are relative to it.
   *
   * A module is looked up there first and then in the one layer that
   * implements it (`resolveImplementingPath`), so a Tool node declared here
   * keeps resolving after its module moves up to the layer that implements
   * this one, with no path of that layer written into the definition
   * (owner, split plan "Trap 1", 2026-10-01).
   */
  root: string,
  /**
   * Extra arguments passed to every registrar after the server.
   *
   * Runtime configuration, not declaration: the HTTP server's registrars take
   * `(server, repoRoot)` and the MCP server's take `(server)`. Putting the
   * repo root in the DECLARATION would be wrong — it is not a property of
   * which tools exist, it is a property of this run.
   */
  extraArgs: readonly unknown[] = [],
): Promise<ToolGroupOutcome[]> {
  const out: ToolGroupOutcome[] = [];

  for (const g of groups) {
    const where = resolveImplementingPath(root, g.module);
    if (where.state === "ambiguous") {
      // Never resolved by checkout order: picking one would serve another
      // layer's tools and report them as these.
      out.push({
        id: g.id,
        state: "failed",
        detail: `${g.module} is held by more than one implementing instance (${where.candidates.map((c) => c.name).join(", ")}); a declared module must name one file`,
      });
      continue;
    }
    const abs = join(where.state === "found" ? where.root : root, g.module);
    if (!existsSync(abs)) {
      out.push({
        id: g.id,
        state: "absent",
        layer: g.layer,
        detail:
          `${g.module} is not present in this checkout` +
          (g.requires ? ` (it needs ${g.requires})` : "") +
          `; its tools are not available`,
      });
      continue;
    }

    try {
      // VARIABLE specifier — the target comes from the declaration, so this
      // module names none of the tool groups and depends on none of them.
      const mod = (await import(abs)) as Record<string, unknown>;
      let name = g.registrar;
      if (name === undefined) {
        const candidates = Object.keys(mod).filter((k) => /^register[A-Z]/.test(k) && typeof mod[k] === "function");
        if (candidates.length !== 1) {
          out.push({
            id: g.id,
            state: "failed",
            detail:
              `${g.module} exports ${candidates.length === 0 ? "no" : candidates.length} register…() function(s)` +
              (candidates.length > 1 ? ` (${candidates.join(", ")}); its Tool node must name one in invoke.inProcess.register` : ""),
          });
          continue;
        }
        name = candidates[0];
      }
      const fn = mod[name];
      if (typeof fn !== "function") {
        out.push({ id: g.id, state: "failed", detail: `${g.module} exports no ${name}()` });
        continue;
      }
      (fn as (s: unknown, ...rest: unknown[]) => void)(server, ...extraArgs);
      out.push({ id: g.id, state: "registered" });
    } catch (e) {
      // NOT reported as `absent`. The module is there and broken, and the
      // remedy — fix it — is the opposite of "install that layer".
      out.push({
        id: g.id,
        state: "failed",
        detail: `${g.module} failed to register: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return out;
}

/**
 * The tool groups a server serves, DERIVED from the Tool nodes its layer
 * declares — one group per (module, registrar) among the nodes served over MCP
 * in-process.
 *
 * Bean `zmdo`, owner 2026-10-04: a tool is served because it is declared in
 * the KG, not because a list in code names it. Until then the same fact was
 * restated twice by hand — `SERVER_TOOL_GROUPS` in `server.ts` and the
 * "generic tools" inline in the document adapter — and the second lived in
 * the content core, so with `cat-harness` alone no adapter was loaded,
 * none of them was registered, and the server refused to start.
 *
 * `layer` is "harness" for every group: these are the harness's own Tool
 * nodes. A module that is absent or fails is still REPORTED by
 * {@link registerDeclaredToolGroups}, exactly as a hand-declared one was.
 */
export function toolGroupsFromNodes(nodes: readonly ToolDefinition[], layer: ToolGroupLayer = "cat-harness"): ToolGroupDeclaration[] {
  const groups = new Map<string, ToolGroupDeclaration>();
  for (const n of nodes) {
    const inProcess = n.invoke?.inProcess;
    if (!inProcess || !n.invoke?.mcp) continue;
    const key = `${inProcess.module}#${inProcess.register ?? ""}`;
    if (groups.has(key)) continue;
    groups.set(key, {
      id: inProcess.module.replace(/^.*\//, "").replace(/\.ts$/, ""),
      module: inProcess.module,
      ...(inProcess.register ? { registrar: inProcess.register } : {}),
      layer,
    });
  }
  return [...groups.values()];
}

/** One layer's served groups: its Tool nodes' modules resolve from `root`. */
export interface InstanceToolGroups {
  instance: string;
  root: string;
  groups: ToolGroupDeclaration[];
}

/**
 * The tool groups a server serves for a folio, from EVERY layer in its
 * dependency tree: each layer's declared `tools` graph, read through
 * `discoverTools`, grouped by {@link toolGroupsFromNodes}.
 *
 * Owner, 2026-10-05 (bean riit, 3c): both MCP servers serve every Tool node
 * in the folio's dependency tree, so no server keeps a list of what it
 * serves — the last such list was `TOOL_GROUPS` in the viewer server.
 *
 * Deepest dependency first, the folio last (`declarationChain`). A group is
 * resolved against ITS layer's root, never the folio's, because a Tool
 * node's `inProcess.module` is instance-relative. A tools graph that cannot be
 * loaded is a `failures` entry, never a layer with no tools (`dh4f`).
 *
 * **Opt-in sub-graphs are the FOLIO's to switch on** (cat-harness#991 step
 * 23.1): a Tool node inside a switched-off one — `work-plan`'s bean Tool in a
 * layer that has not enabled it — is not served, by any layer, the
 * `always` ones included. The folio root's `enableSubgraphs` (and
 * `CAT_SUBGRAPHS`) decides, never the declaring layer's.
 */
export function servedToolGroups(
  folioRoot: string,
  /**
   * Layers served whatever the chain says, deepest first — the harness.
   * A folio that declares nothing has an empty chain, and the generic tools
   * (`folio_init` above all) must still be served there (bean `zmdo`).
   */
  always: ReadonlyArray<{ name: string; root: string }> = [],
): { sets: InstanceToolGroups[]; failures: string[] } {
  const sets: InstanceToolGroups[] = [];
  const failures: string[] = [];
  const seen = new Set<string>();
  const enabled = enabledSubgraphs(folioRoot);
  const chain = declarationChain(folioRoot).map((l) => ({ ...l, root: resolve(l.root) }));
  for (const link of [...always.map((a) => ({ ...a, root: resolve(a.root) })), ...chain]) {
    if (seen.has(link.root)) continue;
    seen.add(link.root);
    // The layer's PARENT is scanned, restricted to this layer: discovery
    // walks one level of instance roots, and this one is a root beside its
    // siblings there whether it is a platform layer or the folio itself.
    const d = discoverTools(dirname(link.root), undefined, link.root, { enabledSubgraphs: enabled });
    for (const f of d.failures) failures.push(`${f.dir ?? f.instance}: ${f.reason}`);
    const groups = toolGroupsFromNodes(d.tools, link.name);
    if (groups.length > 0) sets.push({ instance: link.name, root: link.root, groups });
  }
  return { sets, failures };
}

/**
 * Register {@link servedToolGroups} against `server`. The one rule both MCP
 * servers use; each passes the registrars' extra arguments it already passed.
 */
export async function registerServedToolGroups(
  server: unknown,
  folioRoot: string,
  extraArgs: readonly unknown[] = [],
): Promise<{ outcomes: ToolGroupOutcome[]; failures: string[] }> {
  const { sets, failures } = servedToolGroups(folioRoot, [
    { name: "cat-harness", root: HARNESS_ROOT },
    // A server runs from this layer, so the Tool nodes it declares are served
    // whether or not the folio's `needs` chain names it (`bpmn-engine`).
    { name: "cat-harness-tools", root: TOOLS_LAYER_ROOT },
  ]);
  const outcomes: ToolGroupOutcome[] = [];
  for (const set of sets) outcomes.push(...(await registerDeclaredToolGroups(server, set.groups, set.root, extraArgs)));
  return { outcomes, failures };
}
