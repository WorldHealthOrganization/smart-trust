/**
 * The modules a computed load reaches, read from the declarations that choose
 * them — the targets of a `declared <source>` input-site verdict
 * (`input-sites.ts`), resolved at fingerprint time.
 *
 * @module scripts/declared-imports
 * @graphNode none — a resolver read by `input-hash.ts`
 *
 * A computed `import(abs)` loads whatever its declarations name. A glob over
 * where such modules usually sit (`*\/schemas/**\/*.ts`) is a bound that holds
 * every module that might be named, and so every module a gate's closure
 * hashes; this reads the declarations instead and returns the modules they
 * name now. Each source repeats the computation its site makes — the same
 * declarations, the same resolution — and the test beside it holds the two to
 * each other (`input-sites.test.ts`).
 *
 * ## Sound, not narrow
 *
 * A source returns every module ANY run could load from the declarations in
 * the tree, never the ones one gate needs: a gate declares no kinds or
 * plugins, so which of them it loads is known only once it has run. Where a
 * run is traced (`ci-cone.ts`) that answer is the trace's, and the
 * fingerprint hashes no computed target (`input-sites.ts`, `computed`).
 *
 * - `validator-refs`: every `validator` and `nodeSchemas[*].validator` ref of
 *   every graph typology the checkout declares, resolved as
 *   `kind-validator.ts` and `node-kind-index.ts` resolve them. An unqualified
 *   ref is resolved against the CALLER's layer root, which the declaration
 *   does not fix, so it is resolved against every layer root and the
 *   checkout root, and every target that exists is kept.
 * - `plugin-tables`: the module of every `check` / `implementation` own-code
 *   ref of every `qa-checkers` and `pipeline-plugins` node, resolved against
 *   the root of the layer that declares it, as `harness-config.ts`'s
 *   `tableEntry` does.
 * - `tool-registrars`: the module every Tool with an `mcp` arm names in its
 *   `inProcess` arm, resolved as `tool-api.ts` `resolveModule` does: in the
 *   declaring layer, else in any layer of the checkout. `mcpToolList` imports
 *   it to read the names its registrar serves.
 *
 * A source that cannot be read — a declaration that does not parse, a kind
 * declared twice — returns `undefined`, and the fingerprint is undetermined.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { directoriesForGraph } from "../schemas/kg/cat-harness.ts";
import { splitOwnCodeRef } from "../schemas/kg/contribution-nodes.ts";
import { orderedDependencies } from "../schemas/kg/harness-config.ts";
import { BASE_GRAPH_TYPOLOGIES, GraphTypologyRegistry } from "../schemas/kg/graph-typology-registry.ts";
import { layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { moduleRootOf, parseValidatorRef } from "../schemas/kg/kind-validator.ts";
import { discoverTools } from "../tools/discover.ts";

/** The declaration sources a `declared` verdict may name. */
export const DECLARATION_SOURCES = ["validator-refs", "plugin-tables", "tool-registrars"] as const;
export type DeclarationSource = (typeof DECLARATION_SOURCES)[number];

/** The graphs whose nodes name a plugin table (`harness-config.ts`, `registerDeclaredContributions`). */
export const PLUGIN_TABLE_GRAPHS = ["qa-checkers", "pipeline-plugins"] as const;

/**
 * The roots a loader can resolve against: every layer of the checkout and
 * its declared dependencies — the roots `input-sites.test.ts` holds to be one
 * level below the checkout.
 */
export function loaderRoots(root: string): string[] {
  const out = new Set(layerRootsIn(root).map((r) => resolve(r)));
  for (const r of [...out]) for (const d of orderedDependencies(r)) out.add(resolve(d.rootPath));
  return [...out].sort();
}

/** Every validator ref the checkout's graph typologies declare, as written. */
export function declaredValidatorRefs(registry: GraphTypologyRegistry): string[] {
  const out = new Set<string>();
  for (const kind of registry.names()) {
    const def = registry.get(kind);
    if (typeof def?.validator === "string") out.add(def.validator);
    for (const ref of Object.values(def?.nodeSchemas ?? {})) {
      const v = (ref as { validator?: unknown }).validator;
      if (typeof v === "string") out.add(v);
    }
  }
  return [...out].sort();
}

/** `validator-refs`: the modules the declared validator refs can load, repo-relative, sorted. */
export function validatorModules(root: string, registry?: GraphTypologyRegistry): string[] {
  const abs = resolve(root);
  const reg = registry ?? new GraphTypologyRegistry(BASE_GRAPH_TYPOLOGIES, [abs]);
  reg.ensureCheckout(abs);
  const roots = [...new Set([abs, ...loaderRoots(abs)])];
  const out = new Set<string>();
  for (const raw of declaredValidatorRefs(reg)) {
    let ref;
    try {
      ref = parseValidatorRef(raw);
    } catch {
      continue; // unparseable: the site loads nothing for it
    }
    for (const r of roots) {
      const base = moduleRootOf(ref, r);
      if (base === undefined) continue;
      const target = resolve(join(base, ref.module));
      if (existsSync(target)) out.add(relative(abs, target));
    }
  }
  return [...out].sort();
}

/** `plugin-tables`: the modules the declared qa-checkers / pipeline-plugins nodes name, repo-relative, sorted. */
export function pluginTableModules(root: string): string[] {
  const abs = resolve(root);
  const out = new Set<string>();
  for (const r of loaderRoots(abs)) {
    for (const graph of PLUGIN_TABLE_GRAPHS) {
      for (const dir of directoriesForGraph(r, graph)) {
        let files: string[];
        try {
          files = readdirSync(dir).filter((f) => f.endsWith(".json"));
        } catch {
          continue; // declared but absent: `check:declared-dirs`' finding, and loads nothing
        }
        for (const f of files) {
          const raw = JSON.parse(readFileSync(join(dir, f), "utf-8")) as { check?: unknown; implementation?: unknown };
          for (const ref of [raw.check, raw.implementation]) {
            if (typeof ref !== "string" || !ref.includes("#")) continue;
            const target = resolve(r, splitOwnCodeRef(ref).path);
            if (existsSync(target)) out.add(relative(abs, target));
          }
        }
      }
    }
  }
  return [...out].sort();
}

/**
 * `tool-registrars`: the modules the checkout's Tools name as their in-process
 * registrar, repo-relative, sorted. `undefined` when a declared `tools` graph
 * does not load, since a partial list would leave a registrar unhashed.
 */
export function toolRegistrarModules(root: string): string[] | undefined {
  const abs = resolve(root);
  const roots = layerRootsIn(abs);
  const out = new Set<string>();
  for (const inst of roots) {
    const d = discoverTools(abs, undefined, inst);
    if (d.failures.length > 0) return undefined;
    for (const def of d.tools) {
      const ip = def.invoke.inProcess;
      if (!def.invoke.mcp || !ip) continue;
      // `tool-api.ts` resolveModule: the declaring layer first, then every layer.
      for (const r of [inst, ...roots]) {
        const target = join(r, ip.module);
        if (existsSync(target)) {
          out.add(relative(abs, resolve(target)));
          break;
        }
      }
    }
  }
  return [...out].sort();
}

/** Per-run memo of each source's answer for one checkout; clear it after writers ran. */
export class DeclaredImports {
  private memo = new Map<string, readonly string[] | undefined>();
  constructor(private root: string) {}
  /** The modules `source` names, or `undefined` when it is unknown or its declarations cannot be read. */
  resolve(source: string): readonly string[] | undefined {
    if (this.memo.has(source)) return this.memo.get(source);
    let files: readonly string[] | undefined;
    try {
      files =
        source === "validator-refs"
          ? validatorModules(this.root)
          : source === "plugin-tables"
            ? pluginTableModules(this.root)
            : source === "tool-registrars"
              ? toolRegistrarModules(this.root)
              : undefined;
    } catch {
      files = undefined; // a declaration that cannot be read: undetermined, so the check runs
    }
    this.memo.set(source, files);
    return files;
  }
  clear(): void {
    this.memo.clear();
  }
}
