/**
 * Concern groups in EVERY grouping kind — skills, processes, schemas,
 * library, uml and the test directories — declared once from within and
 * inherited as members.
 *
 * @module scripts/concern-groups
 * @covers cat-harness
 *
 * A grouping kind's directory names its groups in its own declaration file —
 * `skills/skills.json` (`topics`), `processes/processes.json`,
 * `schemas/schemas.json`, `library/library.json`, `uml/uml.json`, a test
 * directory's `code.json` (`groups`) — by a code from
 * `code-lists/concern-group.json`. A group is declared ONCE, by the lowest
 * layer whose same-named directory declares it, and every higher
 * layer's same-named `<dir>/<group>/` is a MEMBER of it, so a higher
 * layer adds no group of its own. Nesting is declared FROM WITHIN, never
 * by `<instance>.json` reaching down a path.
 *
 * A member sits at the SAME path relative to its own layer as the
 * declaring directory (core's `skills/library/` is a member of the harness's
 * `skills/library/` group), which is why a group's directory is its code.
 *
 * This is the one walker for every kind; `packageDirsIn` delegates here.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { checkoutRootFor, findInstanceRoot, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { ConcernGroupsSchema } from "../schemas/kg/concern-groups.ts";
import { defaultGraphTypologies, type GraphTypologyRegistry } from "../schemas/kg/graph-typology-registry.ts";
import { checkoutDirectories, orderedDependencies } from "../schemas/kg/harness-config.ts";
import { SkillTopicsSchema } from "../schemas/kg/skill-topics.ts";

/** The code list every group id is drawn from, by its `id`. */
export const CONCERN_GROUP_LIST = "concern-group";

/** A group as a directory's declaration file names it. */
export interface DeclaredGroup {
  /** The concern-group code. */
  code: string;
  /** Its directory, one segment under the declaring directory. */
  path: string;
}

/** The kinds that group by concern, read from the registry rather than listed. */
export function groupingKinds(registry: GraphTypologyRegistry = defaultGraphTypologies): string[] {
  return registry
    .names()
    .filter((k) => registry.get(k)?.concernGroups === true && typeof registry.get(k)?.declarationFile === "string")
    .sort();
}

/**
 * The groups `<dir>`'s own declaration file names for `kind`; `[]` when there
 * is no file. Throws on a malformed file or on a group whose directory does
 * not exist — declare only what exists (bean `dh4f`).
 */
export function declaredGroupsIn(dir: string, kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): DeclaredGroup[] {
  const def = registry.get(kind);
  if (def?.concernGroups !== true || def.declarationFile === undefined) return [];
  const file = join(dir, def.declarationFile);
  if (!existsSync(file)) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf-8"));
  } catch (e) {
    throw new Error(`${file} is not valid JSON: ${String(e)}`);
  }
  const groups = groupsOfDeclaration(raw, kind, file);
  for (const g of groups) {
    const p = join(dir, g.path);
    if (!existsSync(p) || !statSync(p).isDirectory()) {
      throw new Error(`${file}: group "${g.code}" names ${g.path}/, which does not exist`);
    }
  }
  return groups;
}

/**
 * `dirs` followed by each one's declared concern-group directories for `kind`
 * — the directories a reader of a grouped graph walks when it reads one level
 * deep, as the schema readers do (bean `f8wp`, placement PR8). A directory
 * that declares no groups contributes only itself, so an ungrouped graph reads
 * exactly as before.
 */
export function withConcernGroupDirs(
  dirs: readonly string[],
  kind: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const dir of dirs) {
    for (const d of [dir, ...declaredGroupsIn(dir, kind, registry).map((g) => join(dir, g.path))]) {
      if (seen.has(d)) continue;
      seen.add(d);
      out.push(d);
    }
  }
  return out;
}

/**
 * The groups one parsed declaration file names for `kind`, WITHOUT checking
 * that their directories exist — for a reader holding only the declaration
 * files at a pin (`upstream-directories.ts`, bean `mo75` concern names).
 * Throws, naming `file`, on a malformed one.
 */
export function groupsOfDeclaration(raw: unknown, kind: string, file: string): DeclaredGroup[] {
  let groups: DeclaredGroup[];
  if (kind === "skills") {
    // `skills.json` predates the code list and names its groups `topics`,
    // each with a title and description; the skills walk owns that shape.
    const r = SkillTopicsSchema.safeParse(raw);
    if (!r.success) throw new Error(`${file}: ${r.error.issues[0]?.path.join(".") || "(root)"}: ${r.error.issues[0]?.message}`);
    groups = r.data.topics.map((t) => ({ code: t.id, path: t.path }));
  } else {
    const r = ConcernGroupsSchema.safeParse(raw);
    if (!r.success) throw new Error(`${file}: ${r.error.issues[0]?.path.join(".") || "(root)"}: ${r.error.issues[0]?.message}`);
    groups = r.data.groups.map((c) => ({ code: c, path: c }));
  }
  return groups;
}

const inheritedCache = new Map<string, DeclaredGroup[]>();

/**
 * When `inst` is a standalone clone in a multi-repo sibling workspace (like
 * `implementingInstancesOf` in `harness-config.ts`, bean `nn8e`), walk its
 * declared `needs` by exact name in `dirname(inst)` so inherited concern
 * groups still resolve when dependencies sit beside the clone rather than
 * mounted inside it (bean `t5zb`).
 */
function siblingNeedsDeps(inst: string): string[] {
  const parent = dirname(resolve(inst));
  const seen = new Set<string>([resolve(inst)]);
  let queue: string[] = [];
  try {
    queue = [...(readDeclaration(inst)?.needs ?? [])];
  } catch {
    return [];
  }
  const out: string[] = [];
  while (queue.length > 0) {
    const name = queue.shift()!;
    const candidate = join(parent, name);
    if (seen.has(candidate) || !existsSync(candidate)) continue;
    try {
      const decl = readDeclaration(candidate);
      if (decl?.name !== name) continue;
      seen.add(candidate);
      out.push(candidate);
      for (const n of decl.needs ?? []) queue.push(n);
    } catch {
      continue;
    }
  }
  return out.reverse();
}

/**
 * The groups declared in the SAME-NAMED directory of every layer `dir`'s
 * layer depends on — what `dir` inherits, whether or not it holds them.
 * A lower layer's malformed file is that layer's finding, not this
 * walk's, so it contributes nothing here rather than throwing.
 */
export function inheritedGroupsFor(dir: string, kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): DeclaredGroup[] {
  const key = `${resolve(dir)}\0${kind}`;
  const hit = inheritedCache.get(key);
  if (hit !== undefined) return hit;
  const out: DeclaredGroup[] = [];
  const inst = findInstanceRoot(dir);
  if (inst !== undefined) {
    const rel = relative(inst, resolve(dir));
    let deps: string[] = [];
    try {
      deps = orderedDependencies(inst).map((d) => d.rootPath);
    } catch {
      deps = [];
    }
    if (deps.length === 0 && resolve(checkoutRootFor(inst)) === resolve(inst)) {
      deps = siblingNeedsDeps(inst);
    }
    for (const dep of deps) {
      const same = join(dep, rel);
      if (!existsSync(same)) continue;
      try {
        for (const g of declaredGroupsIn(same, kind, registry)) {
          if (!out.some((o) => o.code === g.code)) out.push(g);
        }
      } catch {
        // reported by `check:concern-groups` against the layer that owns it
      }
    }
  }
  inheritedCache.set(key, out);
  return out;
}

/**
 * The concern groups PRESENT in `dir`, directory name → code: the ones `dir`
 * declares itself, and the inherited ones (same-named directory below) that
 * exist here. What a walker must step INTO rather than read as a child — the
 * one answer {@link groupedChildrenIn} and the library's entry walk
 * (`libraryEntryDirs`, bean `6fez`) share.
 */
export function presentGroupsIn(dir: string, kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): Map<string, string> {
  const groups = new Map<string, string>();
  if (!existsSync(dir)) return groups;
  for (const g of declaredGroupsIn(dir, kind, registry)) groups.set(g.path, g.code);
  for (const g of inheritedGroupsFor(dir, kind, registry)) {
    // A member exists only where it exists: an inherited group absent here
    // is not this directory's defect.
    if (!groups.has(g.path) && existsSync(join(dir, g.path))) groups.set(g.path, g.code);
  }
  return groups;
}

/** One candidate child of a grouping directory. */
export interface GroupedChild {
  /** Its basename. */
  name: string;
  /** Absolute path. */
  dir: string;
  /** Relative to the grouping directory: `crdm`, or `kg/graph-management`. */
  rel: string;
  /** The group it sits in, when it sits in one. */
  group?: string;
}

/**
 * Every candidate child of `dir`: its direct subdirectories that are not
 * groups, and the subdirectories of each group present here — declared by
 * `dir` itself or INHERITED from the same-named directory below. Sorted by
 * `rel`, so every caller sees one order.
 */
export function groupedChildrenIn(dir: string, kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): GroupedChild[] {
  if (!existsSync(dir)) return [];
  const groups = presentGroupsIn(dir, kind, registry);
  const children = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  const out: GroupedChild[] = [];
  for (const name of children(dir)) {
    const code = groups.get(name);
    if (code === undefined) {
      out.push({ name, dir: join(dir, name), rel: name });
      continue;
    }
    for (const inner of children(join(dir, name))) {
      out.push({ name: inner, dir: join(dir, name, inner), rel: `${name}/${inner}`, group: code });
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/** A group across the checkout: who declared it, and every member. */
export interface ResolvedGroup {
  kind: string;
  code: string;
  /** The grouping directory's path, relative to each layer. */
  within: string;
  /** The layer that declared it — the lowest one, in overlay order. */
  declaredBy: string;
  /** Every layer holding `<within>/<code>/`, the declarer first. */
  members: Array<{ member: string; absPath: string }>;
  /** Other layers that ALSO declared it — a finding: a higher layer adds no group. */
  redeclaredBy: string[];
}

/**
 * Every concern group of `kind` in the checkout `start` is staged in.
 * Resolved over {@link checkoutDirectories}, deepest layer first, so the
 * first declarer is the lowest.
 */
export function resolveGroups(kind: string, start: string, registry: GraphTypologyRegistry = defaultGraphTypologies): ResolvedGroup[] {
  const dirs = checkoutDirectories(start).filter((d) => d.graphTypologies.includes(kind as never));
  const norm = (p: string): string => p.replace(/^\.\//, "").replace(/\/+$/, "");
  const nameOf = (d: { member?: string; declaredBy: string; absPath: string }): string => {
    if (d.member !== undefined && d.member !== "(default)") return d.member;
    const inst = findInstanceRoot(d.absPath);
    return (inst && readDeclaration(inst)?.name) ?? d.declaredBy;
  };
  const byKey = new Map<string, ResolvedGroup>();
  for (const d of dirs) {
    for (const g of declaredGroupsIn(d.absPath, kind, registry)) {
      const key = `${norm(d.path)}\0${g.code}`;
      const who = nameOf(d);
      const prev = byKey.get(key);
      if (prev === undefined) {
        byKey.set(key, { kind, code: g.code, within: norm(d.path), declaredBy: who, members: [], redeclaredBy: [] });
      } else if (prev.declaredBy !== who && !prev.redeclaredBy.includes(who)) {
        prev.redeclaredBy.push(who);
      }
    }
  }
  for (const grp of byKey.values()) {
    for (const d of dirs) {
      if (norm(d.path) !== grp.within) continue;
      const abs = join(d.absPath, grp.code);
      if (!existsSync(abs) || grp.members.some((m) => m.absPath === abs)) continue;
      grp.members.push({ member: nameOf(d), absPath: abs });
    }
    grp.members.sort((a, b) => (a.member === grp.declaredBy ? -1 : b.member === grp.declaredBy ? 1 : 0));
  }
  return [...byKey.values()].sort((a, b) => `${a.within}/${a.code}`.localeCompare(`${b.within}/${b.code}`));
}

/** Forget the memoised inheritance answers (a test that rewrites a fixture). */
export function clearGroupCache(): void {
  inheritedCache.clear();
}
