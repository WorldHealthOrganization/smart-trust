/**
 * The staging CONE, at file level: which rendered directories a branch's
 * changed files can reach, so staging rebuilds only those. The generator is
 * the one named by `writer` on the directory.
 *
 * A directory is HIT when a changed file is
 *
 *   1. under its own path (its source data, or the pages themselves), or
 *   2. in the import closure of a `writer` it declares, or under a directory
 *      `writer` names (a generator's templates are read, not imported, so
 *      they are declared as a directory rather than discovered).
 *
 * and the cone is every hit directory plus everything `derivedFrom` makes
 * downstream of it (`downstreamOf`).
 *
 * ## Any doubt carries
 *
 * A writer whose closure cannot be read carries its directory with the reason
 * said, and the two causes are not the same doubt:
 *
 * - a closure file that is MISSING, or a specifier that does not resolve, is
 *   unbounded — anything could be behind it — so any change carries;
 * - an `import()` of a COMPUTED path is bounded: it can load only a module
 *   (code or JSON), never a page or a skill. So it carries on a changed module
 *   file and on nothing else.
 *
 * Computed imports whose targets are DECLARED are not a doubt:
 * `harness-config.ts` loads each dependency's `contributes` module, and
 * `block-module.ts` loads a folio's block manifests from its `folio`
 * directories; both are read from the declarations and walked like any
 * import. Under-carrying misleads a reviewer; over-carrying only costs bytes.
 *
 * @module cat-harness/scripts/staging-cone
 * @covers none — it computes over declarations and code, and judges nothing
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { importClosure as walkImports } from "@litlfred/bootstrap-tools/scripts/check-closure.js";
import { layerRootsIn, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { downstreamOf, type Edge, judge, readTree, renderingOrder } from "./check-derived-from.ts";

export interface ConeDir {
  /** `instance/id`, as `check-derived-from` names a node. */
  node: string;
  /** Repo-relative, ending in `/`. */
  path: string;
  /** Repo-relative script files, or directories ending in `/`. */
  writer?: readonly string[];
}

export interface Closure {
  files: Set<string>;
  /** Why the closure is incomplete in a way any change could hide behind. */
  doubt?: string;
  /** Why the closure may also reach modules it does not list (a computed `import()`). */
  computed?: string;
}

/** What a computed `import()` can load. */
const MODULE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|json)$/;

/**
 * Computed `import()` sites whose targets are declared somewhere readable,
 * keyed by the importing file. Anything not listed stays a bounded doubt.
 */
export const DECLARED_COMPUTED_IMPORTS: Record<string, (repoRoot: string) => string[]> = {
  // `loadBlockModule`: a folio's block manifests, which live in the directories
  // declared with graph typology `folio`.
  "cat-harness-tools/pipeline/block-module.ts": (repoRoot) =>
    layerRootsIn(repoRoot).flatMap((root) =>
      (readDeclaration(root)?.directories ?? [])
        .filter((d) => d.graphTypologies.includes("folio"))
        .flatMap((d) => tsFilesUnder(join(root, d.path)).map((f) => relative(repoRoot, f))),
    ),
};

function tsFilesUnder(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) tsFilesUnder(abs, out);
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) out.push(abs);
  }
  return out;
}

/**
 * The repo-relative files `entry` imports, transitively, itself included.
 *
 * The walk is bootstrap-tools' `importClosure`, the one closure walker
 * (owner, 2026-10-24, bean `mo75` G3: the gate, the remote mount and this
 * cone share it). This function only says what the cone makes of it: a bare
 * import is out of the repository's cone, and a computed `import()` whose
 * targets are declared ({@link DECLARED_COMPUTED_IMPORTS}) is walked like an
 * import.
 */
export function importClosure(entry: string, repoRoot: string): Closure {
  const rel = (abs: string): string => relative(repoRoot, abs);
  const walk = walkImports([resolve(repoRoot, entry)], {
    declaredEdges: (abs) => (DECLARED_COMPUTED_IMPORTS[rel(abs)]?.(repoRoot) ?? []).map((t) => resolve(repoRoot, t)),
  });
  const files = new Set(walk.files.map(rel));
  const undeclared = walk.computed.map(rel).filter((f) => DECLARED_COMPUTED_IMPORTS[f] === undefined);
  const doubt = walk.missing.length
    ? `${rel(walk.missing[0]!)} does not exist`
    : walk.unresolved.length
      ? `${rel(walk.unresolved[0]!.from)} imports ${walk.unresolved[0]!.specifier}, which does not resolve`
      : undefined;
  const computed = undeclared.length ? `${undeclared[0]} imports a computed path` : undefined;
  return { files, ...(doubt ? { doubt } : {}), ...(computed ? { computed } : {}) };
}

export interface ConeDecision {
  node: string;
  /** Repo-relative, ending in `/` — what a caller matches a composed directory against. */
  path: string;
  carry: boolean;
  why: string;
}

/**
 * Decide, per directory, whether the branch's changed files reach it.
 *
 * @param changed repo-relative changed paths; `undefined` when unknown
 * @param order the rendering order (`renderingOrder`), so the result reads in it
 */
export function cone(
  changed: readonly string[] | undefined,
  dirs: readonly ConeDir[],
  order: readonly string[],
  edges: readonly Edge[],
  closureOf: (writer: string) => Closure,
): ConeDecision[] {
  if (changed === undefined) {
    return dirs.map((d) => ({ node: d.node, path: d.path, carry: true, why: "no readable file list for this branch — carrying everything" }));
  }
  const files = changed.map((f) => f.replace(/^\.\//, ""));
  const direct = new Map<string, string>();
  for (const d of dirs) {
    const own = files.find((f) => f.startsWith(d.path) || `${f}/` === d.path);
    if (own) {
      direct.set(d.node, `the branch changes ${own}`);
      continue;
    }
    for (const w of d.writer ?? []) {
      if (w.endsWith("/")) {
        const hit = files.find((f) => f.startsWith(w));
        if (hit) direct.set(d.node, `the branch changes ${hit}, which its writer reads`);
      } else {
        const c = closureOf(w);
        const hit = files.find((f) => c.files.has(f));
        if (hit) direct.set(d.node, `the branch changes ${hit}, in the import closure of ${w}`);
        else if (c.doubt) direct.set(d.node, `the closure of ${w} cannot be read (${c.doubt}) — carrying it`);
        else if (c.computed) {
          const mod = files.find((f) => MODULE.test(f));
          if (mod) direct.set(d.node, `the branch changes ${mod}, and ${c.computed} that ${w} may reach — carrying it`);
        }
      }
      if (direct.has(d.node)) break;
    }
  }
  const reached = new Set(downstreamOf([...direct.keys()], order, edges));
  const from = (n: string) => {
    // Name the source the change reached it through, for the build log.
    for (const e of edges) if (e.from === n && reached.has(e.to)) return e.to;
    return undefined;
  };
  return dirs.map((d) => {
    if (direct.has(d.node)) return { node: d.node, path: d.path, carry: true, why: direct.get(d.node)! };
    if (reached.has(d.node)) {
      return { node: d.node, path: d.path, carry: true, why: `it is derived from ${from(d.node)}, which the branch reaches` };
    }
    return { node: d.node, path: d.path, carry: false, why: "no changed file reaches it" };
  });
}

/** The cone over this checkout's declarations: the one call a build makes. */
export function coneForCheckout(changed: readonly string[] | undefined, repoRoot: string): ConeDecision[] {
  const tree = readTree(repoRoot);
  const { edges } = judge(tree, (p) => existsSync(join(repoRoot, p)));
  const dirs: ConeDir[] = tree.flatMap((i) =>
    i.dirs.map((d) => ({ node: `${i.name}/${d.id}`, path: d.path ?? "", ...(d.writer ? { writer: d.writer } : {}) })),
  );
  const memo = new Map<string, Closure>();
  const closureOf = (w: string) => {
    if (!memo.has(w)) memo.set(w, importClosure(w, repoRoot));
    return memo.get(w)!;
  };
  return cone(changed, dirs, renderingOrder(tree, edges), edges, closureOf);
}

/**
 * Changes that alter every site a preview BUILDS (as opposed to composes),
 * whatever the layer: the build environment. The Gemfile pins the Jekyll and
 * just-the-docs a per-IG site is built with, and the workflow is the build.
 */
export const SITE_ENVIRONMENT: readonly RegExp[] = [
  // The Gemfile is the site CHROME's since slice 1 of the semantic subgraphs.
  /^cat-harness\/site-chrome\/Gemfile(\.lock)?$/,
  /^\.github\/workflows\/feature-staging\.yml$/,
];

/**
 * Whether a per-instance BUILT site (an IG's own Jekyll site, its AST site) is
 * in the cone (bean `4j86`, last Done-when). Such a site is built from an
 * upstream repository pinned in the layer's own files, the layer's
 * declared theme, the build environment, and the stager's code, so it is
 * carried when the file list is unknown, when the environment changed, when
 * the branch touches the layer's root (the floor, as `carriedInstances`
 * keeps it), when the cone reaches any of the layer's directories (a theme
 * change arrives that way, down `derivedFrom`), or when a changed file is in a
 * writer's closure. Doubt carries, exactly as `cone` does.
 */
export function siteInCone(o: {
  /** The layer's directory, repo-relative, no trailing slash. */
  root: string;
  changed: readonly string[] | undefined;
  cone: readonly ConeDecision[];
  writers: readonly string[];
  closureOf: (writer: string) => Closure;
}): { carry: boolean; why: string } {
  if (o.changed === undefined) return { carry: true, why: "no readable file list for this branch — carrying everything" };
  const files = o.changed.map((f) => f.replace(/^\.\//, ""));
  const env = files.find((f) => SITE_ENVIRONMENT.some((r) => r.test(f)));
  if (env) return { carry: true, why: `the branch changes ${env}, the build environment` };
  const own = files.find((f) => f === o.root || f.startsWith(`${o.root}/`));
  if (own) return { carry: true, why: `the branch touches ${own}` };
  const reached = o.cone.find((c) => c.carry && c.path.startsWith(`${o.root}/`));
  if (reached) return { carry: true, why: `the staging cone reaches ${reached.node}: ${reached.why}` };
  for (const w of o.writers) {
    const c = o.closureOf(w);
    const hit = files.find((f) => c.files.has(f));
    if (hit) return { carry: true, why: `the branch changes ${hit}, in the closure of ${w}` };
    if (c.doubt) return { carry: true, why: `the closure of ${w} cannot be read (${c.doubt}) — carrying it` };
    if (c.computed) {
      const mod = files.find((f) => MODULE.test(f));
      if (mod) return { carry: true, why: `the branch changes ${mod}, and ${c.computed} that ${w} may reach — carrying it` };
    }
  }
  return { carry: false, why: "no changed file reaches it" };
}

/** A changed-files list written one path per line, or `undefined` when there is none to read. */
export function readChangedFiles(path: string | undefined): string[] | undefined {
  if (path === undefined || !existsSync(path)) return undefined;
  const lines = readFileSync(path, "utf-8").split("\n").map((l) => l.trim()).filter(Boolean);
  return lines;
}

/** The per-site filter both stagers call: one cone, one closure memo, a decision per layer. */
export function siteFilter(repoRoot: string, changed: readonly string[] | undefined, writers: readonly string[]) {
  const coneDecisions = changed === undefined ? [] : coneForCheckout(changed, repoRoot);
  const memo = new Map<string, Closure>();
  const closureOf = (w: string) => {
    if (!memo.has(w)) memo.set(w, importClosure(w, repoRoot));
    return memo.get(w)!;
  };
  return (root: string) => siteInCone({ root, changed, cone: coneDecisions, writers, closureOf });
}
