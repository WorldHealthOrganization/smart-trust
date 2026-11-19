/**
 * Opt-in named sub-graphs: which are switched on for a folio, and whether a
 * directory sits inside one that is switched off.
 *
 * @module schemas/kg/opt-in-subgraphs
 * @graphNode none — a reader and predicates over declared opt-in sub-graphs; it defines no schema
 *
 * ## The rule
 *
 * A directory entry marked `optIn: true` is an opt-in sub-graph (e.g.
 * cat-harness's `sdlc` and `work-plan`). It is off in EVERY layer — including
 * the one that declares it — unless that layer lists it, qualified
 * `<instance>.<directory id>`, in its own `enableSubgraphs`.
 *
 * **The folio root decides, and nothing is inherited.** A layer's list
 * enables the sub-graphs for ITSELF. So every reader asks
 * {@link enabledSubgraphs} of the root it is resolving FOR — the folio, the
 * downstream of a mount, the layer whose own resolution it is — never of
 * the layer that declared the sub-graph.
 *
 * **A mounted layer is resolved for the root that mounted it.** Owner,
 * 2026-11-12, card Q-OPTIN-DIRS A: *"CI checks should align on opt in/out"*.
 * The mount laid the layer down with the mounting root's list, so a check
 * resolving the mounted layer reads that list too, never the layer's own
 * (`defaultEnabledSubgraphs` in `cat-harness.ts`).
 *
 * **A development override.** `CAT_SUBGRAPHS` (`+cat-harness.sdlc,-x.y`)
 * adjusts the root's list, so a dev session in any checkout can turn one on
 * without editing a declaration. Unset in CI, and in every agent test context.
 *
 * **Switched off is invisible, not deleted.** A switched-off sub-graph — and
 * everything declared from within it, in any member layer — is left out
 * of what the agent is given: the resolved directories, the skill overlay,
 * the served Tool groups and a mount's default directory list. An explicit
 * mount override naming it still mounts it, and the harness's own machinery
 * may still use it.
 *
 * **One sub-graph can require another.** An opt-in entry's `requires`
 * lists qualified ids of other opt-in sub-graphs — its own layer's or its
 * `needs` closure's — that it cannot work without (owner, 2026-11-13: cat-harness's
 * `sdlc` requires `cat-harness.work-plan`). The requirement IMPLIES: switching
 * a sub-graph on switches on everything it requires, transitively, wherever
 * the enabled set is computed ({@link closeOverRequires}). So a root lists
 * only what it wants, and a reference from a sub-graph into one it requires
 * is not dangling (`check:optin-refs`). Only top-level entries carry it.
 *
 * An `enableSubgraphs` id that names nothing opt-in is refused by
 * `check:declaration-resolution` ({@link enableSubgraphsProblems}), never
 * ignored, and so is a `requires` id ({@link requiresProblems}).
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, posix, resolve } from "node:path";

import { fileStamp, findDeclarationFile, INDEX_CONFIG_FILENAME, layerRootsIn } from "./instance-roots";

/** The development override: a comma list of `+<instance>.<id>` / `-<instance>.<id>`. */
export const SUBGRAPHS_ENV = "CAT_SUBGRAPHS";

/**
 * What is switched on: a set of qualified ids, or `"all"` for a reader that
 * enumerates what is DECLARED rather than what a folio is given (a structural
 * check, the declaration's own sub-graph list).
 */
export type EnabledSubgraphs = ReadonlySet<string> | "all";

/** `<instance>.<directory id>` — the one spelling of an opt-in sub-graph's name. */
export function qualifiedSubgraphId(instance: string, id: string): string {
  return `${instance}.${id}`;
}

/** The layer and directory id of a qualified id; `undefined` when it is not `<instance>.<id>`. */
export function splitQualifiedSubgraphId(q: string): { instance: string; id: string } | undefined {
  const dot = q.indexOf(".");
  if (dot <= 0 || dot === q.length - 1) return undefined;
  return { instance: q.slice(0, dot), id: q.slice(dot + 1) };
}

/** Whether `q` is switched on. */
export function isSubgraphEnabled(enabled: EnabledSubgraphs, q: string): boolean {
  return enabled === "all" || enabled.has(q);
}

/** One `CAT_SUBGRAPHS` value, parsed. A bare id counts as `+`. */
export function parseSubgraphsEnv(value: string | undefined): { add: string[]; remove: string[] } {
  const add: string[] = [];
  const remove: string[] = [];
  for (const raw of (value ?? "").split(",")) {
    const t = raw.trim();
    if (t === "") continue;
    if (t.startsWith("-")) remove.push(t.slice(1).trim());
    else add.push(t.startsWith("+") ? t.slice(1).trim() : t);
  }
  return { add, remove };
}

/**
 * The enable set from a root's declared list and the environment: the list,
 * then `+` ids added and `-` ids removed. Pure, for a caller that has already
 * read the declaration.
 */
export function enabledSubgraphsFrom(
  declared: readonly string[] | undefined,
  // input-site: env-unset CAT_SUBGRAPHS #949cc29c — a development override switching opt-in sub-graphs on or off; unset in CI
  env: Readonly<Record<string, string | undefined>> = process.env,
): Set<string> {
  const out = new Set(declared ?? []);
  const { add, remove } = parseSubgraphsEnv(env[SUBGRAPHS_ENV]);
  for (const a of add) out.add(a);
  for (const r of remove) out.delete(r);
  return out;
}

/**
 * The `enableSubgraphs` a root declares, read STRUCTURALLY — the one field,
 * not the whole declaration, so a reader that cannot parse a declaration in
 * full (a mount planner before the kinds it mounts exist) still gets the
 * answer. No declaration, or no field, is the empty list; an unreadable file
 * is the same, since the parse that fails is reported by the reader that
 * parses it.
 *
 * **An index root** declares no instance of its own, so its list is in its
 * `index.config.json` (`folio-index-config/v1`). That is where folio-assistant,
 * the checkout the owner named, switches `sdlc` and `work-plan` on
 * (cat-harness#991 step 23.4).
 */
export function declaredEnableSubgraphs(root: string): string[] {
  const file = findDeclarationFile(root) ?? (existsSync(join(root, INDEX_CONFIG_FILENAME)) ? INDEX_CONFIG_FILENAME : undefined);
  if (file === undefined) return [];
  try {
    const raw = JSON.parse(readFileSync(join(root, file), "utf-8")) as { enableSubgraphs?: unknown };
    return Array.isArray(raw.enableSubgraphs) ? raw.enableSubgraphs.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** What each opt-in sub-graph requires, by qualified id. */
export type OptInRequires = ReadonlyMap<string, readonly string[]>;

/**
 * The `requires` of a declaration's top-level opt-in entries, read
 * STRUCTURALLY from its `directories` (as {@link declaredEnableSubgraphs}
 * reads its one field), keyed `<name>.<id>`.
 */
export function requiresOfDirectories(name: string, directories: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!Array.isArray(directories)) return out;
  for (const d of directories as Array<{ id?: unknown; optIn?: unknown; requires?: unknown }>) {
    if (typeof d?.id !== "string" || d.optIn !== true || !Array.isArray(d.requires)) continue;
    const req = d.requires.filter((x): x is string => typeof x === "string");
    if (req.length) out.set(qualifiedSubgraphId(name, d.id), req);
  }
  return out;
}

/**
 * The `requires` of EVERY opt-in entry a layer declares: the top-level ones
 * ({@link requiresOfDirectories}) and those declared FROM WITHIN a directory,
 * in its `graph.json` or `<dir>/<dir>.json`, at any depth, the two
 * conventional names `declaredKinds` also reads. Keyed `<name>.<own id>`, the
 * id `enableSubgraphs` spells for a from-within entry.
 *
 * Read STRUCTURALLY through `readText`, a path relative to the directory the
 * declaration sits in, so a checkout (the disk) and the mount planner (a
 * remote tree, before anything is mounted) ask the same question. An opt-in
 * group inside an opt-in level (an `L2/collab/` inside `L2/`, owner, 2026-11-13)
 * was invisible to the top-level read, so what it requires was never implied.
 */
export function requiresDeclared(
  name: string,
  directories: unknown,
  readText: (relPath: string) => string | undefined,
  depth = 4,
): Map<string, string[]> {
  const out = requiresOfDirectories(name, directories);
  const walk = (dirs: unknown, base: string, left: number): void => {
    if (left <= 0 || !Array.isArray(dirs)) return;
    for (const d of dirs as Array<{ path?: unknown }>) {
      if (typeof d?.path !== "string") continue;
      const dir = posix.join(base, d.path.replace(/\/+$/, ""));
      for (const file of new Set(["graph.json", `${basename(dir)}.json`])) {
        const text = readText(posix.join(dir, file));
        if (text === undefined) continue;
        let nested: { directories?: unknown };
        try {
          nested = JSON.parse(text) as { directories?: unknown };
        } catch {
          continue; // a nested file that will not parse is check:harness-dirs' finding
        }
        for (const [q, req] of requiresOfDirectories(name, nested.directories)) out.set(q, req);
        walk(nested.directories, dir, left - 1);
      }
    }
  };
  walk(directories, "", depth);
  return out;
}

/** Whether `dir` or a directory above it holds a `.git`. */
function inGitCheckout(dir: string): boolean {
  for (let d = resolve(dir); ; d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return true;
    if (dirname(d) === d) return false;
  }
}

/**
 * The layers whose `requires` a resolution rooted at `root` can see: the
 * root and the layers mounted one level below it, and — in the separated
 * layout, where each layer is its own clone in a plain directory — its
 * siblings there, which is how `needs` finds them (`layerRootsIn`).
 */
function requireRootsFor(root: string): string[] {
  const own = layerRootsIn(root);
  const parent = dirname(resolve(root));
  if (findDeclarationFile(root) === undefined || parent === resolve(root) || inGitCheckout(parent)) return own;
  return [...new Set([...own, ...layerRootsIn(parent)])];
}

/**
 * Every layer on disk that a resolution rooted at `checkoutRoot` can see
 * ({@link requireRootsFor}), and what each of their opt-in sub-graphs
 * requires. An unreadable declaration contributes nothing: the parse that
 * fails is reported by the reader that parses it.
 */
export function declaredOptInRequires(checkoutRoot: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const root of requireRootsFor(checkoutRoot)) {
    const file = findDeclarationFile(root);
    if (file === undefined) continue;
    try {
      for (const [q, req] of requiresOf(join(root, file))) out.set(q, [...req]);
    } catch {
      // unreadable: check:declaration-filename's finding, not this one's
    }
  }
  return out;
}

/**
 * One declaration's opt-in `requires`, computed once per version of the file
 * (its size, mtime and inode). `resolveDirectories` asks for them on every
 * call, and re-parsing every layer's declaration each time was 25 s of a
 * 87 s `kg-audit` over the folio-assistant index (2026-11-13, core #753). A
 * file that fails to read or parse is not cached and throws on every call.
 */
/**
 * A declaration's requires, reused while every file the read touched (the
 * declaration and each nested `graph.json` / `<dir>/<dir>.json` it looked
 * for, present or absent) has the same size, mtime and inode. kg-audit asks
 * this on every `resolveDirectories`, and re-parsing each layer every time
 * was most of a run (cat-harness-tools#2010).
 */
const requiresByFile = new Map<string, { stamps: Map<string, string>; requires: [string, string[]][] }>();
const stampOrAbsent = (abs: string): string => (existsSync(abs) ? fileStamp(abs) : "absent");
function requiresOf(abs: string): [string, string[]][] {
  const hit = requiresByFile.get(abs);
  if (hit !== undefined && [...hit.stamps].every(([f, st]) => stampOrAbsent(f) === st)) return hit.requires;
  const stamps = new Map<string, string>([[abs, fileStamp(abs)]]);
  const raw = JSON.parse(readFileSync(abs, "utf-8")) as { name?: unknown; directories?: unknown };
  if (typeof raw.name !== "string") {
    requiresByFile.set(abs, { stamps, requires: [] });
    return [];
  }
  const base = dirname(abs);
  const readText = (rel: string): string | undefined => {
    const f = join(base, rel);
    const st = stampOrAbsent(f);
    stamps.set(f, st);
    return st === "absent" ? undefined : readFileSync(f, "utf-8");
  };
  const requires = [...requiresDeclared(raw.name, raw.directories, readText)];
  requiresByFile.set(abs, { stamps, requires });
  return requires;
}

/**
 * `enabled`, with everything each switched-on sub-graph requires switched on
 * too, transitively. Mutates and returns `enabled`. A requirement is
 * IMPLIED (owner, 2026-11-13): a root that enables `cat-harness.sdlc` gets
 * `cat-harness.work-plan` without listing it.
 */
export function closeOverRequires(enabled: Set<string>, requires: OptInRequires): Set<string> {
  const queue = [...enabled];
  while (queue.length) {
    for (const r of requires.get(queue.pop()!) ?? []) {
      if (enabled.has(r)) continue;
      enabled.add(r);
      queue.push(r);
    }
  }
  return enabled;
}

/** Everything `group` requires, transitively, itself excluded. */
export function requiredBy(group: string, requires: OptInRequires): Set<string> {
  const out = closeOverRequires(new Set([group]), requires);
  out.delete(group);
  return out;
}

/**
 * The opt-in sub-graphs switched on for the folio at `folioRoot`: its own
 * list, adjusted by `CAT_SUBGRAPHS`, closed over what each requires
 * (`requires` of the layers on disk there).
 */
export function enabledSubgraphs(
  folioRoot: string,
  // input-site: env-unset CAT_SUBGRAPHS #949cc29c — a development override switching opt-in sub-graphs on or off; unset in CI
  env: Readonly<Record<string, string | undefined>> = process.env,
): Set<string> {
  return closeOverRequires(enabledSubgraphsFrom(declaredEnableSubgraphs(folioRoot), env), declaredOptInRequires(folioRoot));
}

/** The fields of a directory entry this module reads. */
export interface OptInCarrier {
  id: string;
  optIn?: boolean;
  /** The layer whose declaration (or declaration file from within) wrote the entry. */
  declaredBy?: string;
  /** The id of the entry this one was declared from within. */
  within?: string;
  /** Set by `resolveDirectories`: the nearest enclosing opt-in sub-graph, qualified. */
  optInSubgraph?: string;
}

/** The qualified id of `dir` itself when it is an opt-in entry. */
export function ownOptInId(dir: OptInCarrier): string | undefined {
  return dir.optIn === true && dir.declaredBy !== undefined ? qualifiedSubgraphId(dir.declaredBy, dir.id) : undefined;
}

/**
 * Whether `dir` is inside a switched-off opt-in sub-graph: it, or any
 * ancestor through `within` (looked up by `parentOf`), is an opt-in entry
 * whose qualified id is not enabled. A resolved entry carrying
 * `optInSubgraph` is judged by that too.
 */
export function switchedOff(
  dir: OptInCarrier,
  enabled: EnabledSubgraphs,
  parentOf: (id: string) => OptInCarrier | undefined = () => undefined,
): boolean {
  if (dir.optInSubgraph !== undefined && !isSubgraphEnabled(enabled, dir.optInSubgraph)) return true;
  const seen = new Set<string>();
  for (let cur: OptInCarrier | undefined = dir; cur !== undefined && !seen.has(cur.id); cur = cur.within === undefined ? undefined : parentOf(cur.within)) {
    seen.add(cur.id);
    const q = ownOptInId(cur);
    if (q !== undefined && !isSubgraphEnabled(enabled, q)) return true;
  }
  return false;
}

/** One instance of a chain, as {@link enableSubgraphsProblems} needs it. */
export interface DeclaredOptIns {
  name: string;
  /** Every directory the layer declares — top level and from within — with its `optIn`. */
  directories: ReadonlyArray<{ id: string; optIn?: boolean }>;
}

/**
 * Why each `enableSubgraphs` id of `self` cannot be honoured: not
 * `<instance>.<id>`, names a layer outside `self` and its `needs`
 * closure (`closure`), names a directory that layer does not declare, or
 * one that is not `optIn`. Empty means every id names an opt-in sub-graph.
 */
export function enableSubgraphsProblems(
  self: string,
  ids: readonly string[],
  closure: readonly DeclaredOptIns[],
): Array<{ id: string; detail: string }> {
  const byName = new Map(closure.map((c) => [c.name, c]));
  const out: Array<{ id: string; detail: string }> = [];
  for (const q of ids) {
    const parts = splitQualifiedSubgraphId(q);
    if (parts === undefined) {
      out.push({ id: q, detail: "not a qualified sub-graph id: write `<instance>.<directory id>`, e.g. `cat-harness.sdlc`" });
      continue;
    }
    const inst = byName.get(parts.instance);
    if (inst === undefined) {
      out.push({ id: q, detail: `\`${parts.instance}\` is neither ${self} nor an instance in its \`needs\` closure` });
      continue;
    }
    const dir = inst.directories.find((d) => d.id === parts.id);
    if (dir === undefined) {
      out.push({ id: q, detail: `\`${parts.instance}\` declares no directory \`${parts.id}\`` });
      continue;
    }
    if (dir.optIn !== true) {
      out.push({ id: q, detail: `\`${parts.instance}\`'s \`${parts.id}\` is not an opt-in sub-graph (\`optIn: true\`); it is on everywhere and needs no enabling` });
    }
  }
  return out;
}

/**
 * Why each `requires` id of `self`'s opt-in entries cannot be honoured: the
 * entry carrying it is not opt-in, or an id fails as an `enableSubgraphs` id
 * would ({@link enableSubgraphsProblems}: unqualified, outside `self` and its
 * `needs` closure, no such directory, not opt-in), or names the entry
 * itself. Empty means every requirement names another opt-in sub-graph.
 */
export function requiresProblems(
  self: string,
  directories: ReadonlyArray<{ id: string; optIn?: boolean; requires?: readonly string[] }>,
  closure: readonly DeclaredOptIns[],
): Array<{ id: string; detail: string }> {
  const out: Array<{ id: string; detail: string }> = [];
  for (const d of directories) {
    if (d.requires === undefined || d.requires.length === 0) continue;
    if (d.optIn !== true) {
      out.push({ id: d.id, detail: `\`${d.id}\` declares \`requires\` but is not an opt-in sub-graph (\`optIn: true\`): only an opt-in sub-graph can require another` });
      continue;
    }
    const own = qualifiedSubgraphId(self, d.id);
    for (const p of enableSubgraphsProblems(self, d.requires, closure)) out.push({ id: d.id, detail: `\`requires\` ${p.id}: ${p.detail}` });
    if (d.requires.includes(own)) out.push({ id: d.id, detail: `\`requires\` names \`${own}\` itself` });
  }
  return out;
}
