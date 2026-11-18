/**
 * WHAT A CHOSEN TOOL BRINGS — its definition, its implementation and their
 * import closure, as the declared directories a remote mount lays down.
 *
 * @module scripts/tool-closure
 * @graphNode none — a library under `remote-mount.ts`: it resolves and judges nothing on its own
 *
 * 1. **A mounted Tool brings BOTH halves** — its definition
 *    (`<tools dir>/<id>/<id>.ts` in the layer that declares it, the folder
 *    convention of cat-harness `schemas/tools/tool-folders.ts`) AND its
 *    implementation (the module its `invoke` names), each with its import
 *    closure: a Tool that runs, never a definition whose code is absent or a
 *    module whose imports are.
 * 2. **One closure walker.** The walk is bootstrap-tools' `importClosure`
 *    (`scripts/check-closure.ts`), the same one `check:tools-closure` runs;
 *    this module only supplies where it reads (a {@link ClosureHost} over the
 *    pinned trees, in the DOWNSTREAM's layout) and which packages are source
 *    (`resolveBare`, by each layer's `package.json` name and `exports`).
 * 3. **Directory granularity.** Every DECLARED directory the closure touches
 *    is mounted whole — the most specific one, so a nested directory mounts
 *    alone — and a closure file in no declared directory is refused, never
 *    copied as a single file. The lock schema does not change.
 *
 * ## Where a Tool's `invoke` is read from: its published metadata
 *
 * The plan runs before the trust gate, so a definition is never EXECUTED to
 * learn what it invokes (that would run a pin's code before anyone consented),
 * and static parsing fails where a definition builds its `shell` through a
 * helper. The Tool's node in its layer's published `tools/`
 * `index.hydrated.jsonld` carries `invoke` as data (`@json`), at the same pin,
 * from the same tree or package a hydrated mount reads. The caller hands this
 * module those nodes.
 *
 * ## How the implementation is found
 *
 * - `invoke.<arm>.module` (`inProcess`, `container`, `mcp`): in the declaring
 *   layer, else in the one layer whose `needs` names it — the rule of
 *   cat-harness `resolveImplementingPath`, applied to the pinned trees. Two
 *   holders is refused, never resolved by order.
 * - `invoke.shell`: `bun run cat <key>` (or `bun run <key>`) is looked up in
 *   the layers' `checkoutScripts`, and the script path its command runs is
 *   the entry. A command that runs no file of a mounted layer (`gh pr
 *   list`, `beans`, a workflow path) brings no code: it is a runtime
 *   dependency, reported as such.
 * - `manual`: no code.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { importClosure, resolveRelative, type ClosureHost } from "@litlfred/bootstrap-tools/scripts/check-closure.js";
import type { RemoteTree } from "./remote-tree.ts";
import type { UpstreamDirectory } from "./upstream-directories.ts";

/** The downstream checkout's root, as the walker sees it: a path no real file is at. */
export const MOUNT_ROOT = "/__downstream__";

const strip = (p: string): string => p.replace(/^\.\//, "").replace(/\/+$/, "");
const joinRel = (...ps: string[]): string => ps.map(strip).filter(Boolean).join("/");

/** One layer the closure may reach: where it lands downstream, what it declares, and where its bytes are read. */
export interface ClosureInstance {
  instance: string;
  /** Checkout-relative path its root lands at (or is at, for a local one). */
  path: string;
  /** Mounted whole: every file arrives, so no directory needs choosing. */
  whole: boolean;
  needs: readonly string[];
  /** Every in-checkout directory it declares, nested ones included; instance-relative paths. */
  directories: readonly UpstreamDirectory[];
  /** Instance-relative files the mount lays down beside the declaration (its declared assets, the declaration itself). */
  files: readonly string[];
  /** Its `package.json`, when it has one: the package name source imports use, `exports`, and `checkoutScripts`. */
  manifest?: { name?: unknown; exports?: unknown; checkoutScripts?: unknown };
  /** Read at a pin (`tree`, under `root` in it), or from this checkout's disk (a local layer). */
  source: { tree: RemoteTree; root: string } | { disk: string };
}

/** A Tool chosen by id, with the `invoke` its published node carries. */
export interface ChosenTool {
  id: string;
  invoke: Record<string, unknown> | undefined;
}

export interface ToolChoice {
  /** The layer that declares the Tools. */
  instance: string;
  /** Its tools directories (graph typology `tools`), instance-relative. */
  toolDirs: readonly string[];
  tools: readonly ChosenTool[];
}

export interface ResolvedTool {
  id: string;
  instance: string;
  /** Checkout-relative. */
  definition: string;
  /** Checkout-relative entry files of the implementation; empty for a runtime command or `manual`. */
  implementation: string[];
  /** What it runs that no mounted layer holds — a runtime dependency, not code to bring. */
  runtime?: string;
}

export interface ToolClosure {
  tools: ResolvedTool[];
  /** Every file the closure reaches, checkout-relative, sorted. */
  files: string[];
  /** Per mounted layer, the ids of the declared directories to mount (an ancestor's descendants dropped). Whole and local layers are absent. */
  directories: Map<string, string[]>;
  /** Bare packages left to each layer's `bun install`. */
  external: string[];
  /** Why the chosen set cannot be brought runnable. Empty means it can. */
  problems: string[];
}

/** `bun run cat <key>` / `bun run <key>` → the key; the rule of cat-harness `scriptNameOf`. */
const SCRIPT_KEY = /^\s*bun run (?:cat )?([A-Za-z0-9:_.-]+)(?:\s|$)/;
/** The file a command runs: `bun run [cat ]<path>`, or a bare script path. */
const RUNS_PATH = /^\s*(?:bun|bunx) run (?:cat )?([^\s]+)/;
const LOOKS_LIKE_PATH = /^[.\w][\w./-]*\.(?:ts|mts|js|mjs|sh)$/;

/**
 * The chosen Tools' definitions, implementations and import closure over
 * `instances`, and the declared directories that closure touches.
 */
export function toolClosure(instances: readonly ClosureInstance[], choices: readonly ToolChoice[]): ToolClosure {
  const problems: string[] = [];
  const byLongestPath = [...instances].sort((a, b) => b.path.length - a.path.length);
  const byName = new Map(instances.map((i) => [i.instance, i]));
  const abs = (rel: string): string => `${MOUNT_ROOT}/${strip(rel)}`;
  const relOf = (a: string): string | undefined => (a.startsWith(`${MOUNT_ROOT}/`) ? a.slice(MOUNT_ROOT.length + 1) : undefined);
  const locate = (a: string): { inst: ClosureInstance; inner: string } | undefined => {
    const rel = relOf(a);
    if (rel === undefined) return undefined;
    for (const inst of byLongestPath) {
      const p = strip(inst.path);
      if (rel === p) return { inst, inner: "" };
      if (rel.startsWith(`${p}/`)) return { inst, inner: rel.slice(p.length + 1) };
    }
    return undefined;
  };
  /** The most specific declared directory holding `inner`. */
  const dirOf = (inst: ClosureInstance, inner: string): UpstreamDirectory | undefined => {
    let best: UpstreamDirectory | undefined;
    for (const d of inst.directories) {
      const p = strip(d.path);
      if (p && (inner === p || inner.startsWith(`${p}/`)) && (!best || p.length > strip(best.path).length)) best = d;
    }
    return best;
  };

  // Each pinned tree's sparse set grows by one declared directory at a time,
  // so a closure costs one batched checkout per directory it touches.
  const sparse = new Map<RemoteTree, Set<string>>();
  const host: ClosureHost = {
    isFile(a) {
      const at = locate(a);
      if (!at || at.inner === "") return false;
      const { source } = at.inst;
      if ("disk" in source) {
        const f = join(source.disk, at.inner);
        return existsSync(f) && statSync(f).isFile();
      }
      return source.tree.files().has(joinRel(source.root, at.inner));
    },
    read(a) {
      const at = locate(a)!;
      const { source } = at.inst;
      if ("disk" in source) return readFileSync(join(source.disk, at.inner), "utf-8");
      const up = joinRel(source.root, at.inner);
      const onDisk = join(source.tree.dir, up);
      if (!existsSync(onDisk)) {
        const set = sparse.get(source.tree) ?? new Set<string>();
        sparse.set(source.tree, set);
        const d = at.inst.whole ? undefined : dirOf(at.inst, at.inner);
        set.add(at.inst.whole ? (source.root ? `${source.root}/` : "*") : d ? `${joinRel(source.root, d.path)}/` : up);
        source.tree.checkout([...set]);
      }
      return readFileSync(onDisk, "utf-8");
    },
  };

  /** A package the closure's layers hold as source, by `package.json` `name` and `exports`. */
  const external = new Set<string>();
  const resolveBare = (spec: string): string | null | undefined => {
    for (const inst of instances) {
      const name = inst.manifest?.name;
      if (typeof name !== "string" || !(spec === name || spec.startsWith(`${name}/`))) continue;
      const sub = spec === name ? "" : spec.slice(name.length + 1);
      const target = exportTarget(inst.manifest?.exports, sub);
      if (target === null) return null;
      return resolveRelative(abs(joinRel(inst.path, "package.json")), `./${strip(target)}`, host) ?? null;
    }
    external.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!);
    return undefined;
  };

  // Script keys across the closure, one answer per key (cat-harness `scriptTable`'s rule).
  const scripts = new Map<string, { command: string; instance: string }>();
  for (const inst of instances) {
    const table = inst.manifest?.checkoutScripts;
    if (!table || typeof table !== "object") continue;
    for (const [k, v] of Object.entries(table as Record<string, unknown>)) {
      if (typeof v !== "string") continue;
      const prior = scripts.get(k);
      if (prior && prior.instance !== inst.instance) problems.push(`script \`${k}\` is declared by both \`${prior.instance}\` and \`${inst.instance}\`: no one command to run`);
      else scripts.set(k, { command: v, instance: inst.instance });
    }
  }

  const tools: ResolvedTool[] = [];
  const entries: string[] = [];
  for (const choice of choices) {
    const declarer = byName.get(choice.instance);
    if (!declarer) {
      problems.push(`\`${choice.instance}\` names Tools but is not among the instances this mount reads`);
      continue;
    }
    for (const t of choice.tools) {
      // A Tool is declared as `<id>.json` data or a `<id>.ts` module (bean `y9r6`).
      const defs = choice.toolDirs
        .flatMap((d) => [`${t.id}.json`, `${t.id}.ts`].map((f) => joinRel(declarer.path, d, t.id, f)))
        .filter((r) => host.isFile(abs(r)));
      if (defs.length !== 1) {
        problems.push(
          defs.length === 0
            ? `Tool \`${t.id}\`: \`${choice.instance}\` holds no \`${t.id}/${t.id}.json\` (or \`.ts\`) in its tools director${choice.toolDirs.length === 1 ? "y" : "ies"} (${choice.toolDirs.map((d) => `\`${strip(d)}/\``).join(", ") || "none declared"})`
            : `Tool \`${t.id}\`: two definitions, ${defs.join(" and ")} — the folder, the file and the id are one name`,
        );
        continue;
      }
      const resolved: ResolvedTool = { id: t.id, instance: choice.instance, definition: defs[0]!, implementation: [] };
      const inv = t.invoke ?? {};
      for (const arm of ["inProcess", "container", "mcp"]) {
        const mod = (inv[arm] as { module?: unknown } | undefined)?.module;
        if (typeof mod !== "string") continue;
        const own = joinRel(declarer.path, mod);
        if (host.isFile(abs(own))) {
          resolved.implementation.push(own);
          continue;
        }
        const holders = instances.filter((i) => i.needs.includes(declarer.instance)).map((i) => joinRel(i.path, mod)).filter((r) => host.isFile(abs(r)));
        if (holders.length === 1) resolved.implementation.push(holders[0]!);
        else problems.push(
          holders.length === 0
            ? `Tool \`${t.id}\`: \`invoke.${arm}.module\` \`${mod}\` is in neither \`${choice.instance}\` nor an instance this mount reads that needs it`
            : `Tool \`${t.id}\`: \`invoke.${arm}.module\` \`${mod}\` is held by ${holders.join(" and ")} — exactly one implementing instance may hold it`,
        );
      }
      if (typeof inv.shell === "string") {
        const key = SCRIPT_KEY.exec(inv.shell)?.[1];
        const declared = key !== undefined ? scripts.get(key) : undefined;
        if (key !== undefined && declared === undefined && /^\s*bun run cat\s/.test(inv.shell)) {
          problems.push(`Tool \`${t.id}\`: \`${inv.shell}\` runs script \`${key}\`, which no instance this mount reads declares in \`checkoutScripts\``);
        } else {
          const command = declared?.command ?? inv.shell;
          const target = RUNS_PATH.exec(command)?.[1] ?? (LOOKS_LIKE_PATH.test(command.trim()) ? command.trim() : undefined);
          const at = target !== undefined ? locate(abs(target)) : undefined;
          if (target !== undefined && at && at.inner !== "") {
            if (host.isFile(abs(target))) resolved.implementation.push(strip(target));
            else problems.push(`Tool \`${t.id}\`: \`${inv.shell}\` runs \`${target}\`, which \`${at.inst.instance}\` does not hold at the pin`);
          } else resolved.runtime = command;
        }
      }
      tools.push(resolved);
      entries.push(abs(resolved.definition), ...resolved.implementation.map(abs));
    }
  }

  const walk = importClosure(entries, { host, resolveBare });
  const rel = (a: string): string => relOf(a) ?? a;
  for (const u of walk.unresolved) problems.push(`${rel(u.from)} imports \`${u.specifier}\`, which names no file at the pin`);
  for (const m of walk.missing) problems.push(`${rel(m)} is not a file at the pin`);
  for (const c of walk.computed) problems.push(`${rel(c)} imports a computed path, so its closure cannot be listed — the Tool would arrive without what that import loads`);

  const touched = new Map<string, Set<string>>();
  for (const f of walk.files) {
    const at = locate(f);
    if (!at) {
      problems.push(`${f} is outside every instance this mount reads`);
      continue;
    }
    if (at.inst.whole || "disk" in at.inst.source) continue;
    const d = dirOf(at.inst, at.inner);
    if (d) {
      const set = touched.get(at.inst.instance) ?? new Set<string>();
      set.add(d.id);
      touched.set(at.inst.instance, set);
    } else if (!at.inst.files.includes(at.inner)) {
      problems.push(`${rel(f)} is in no directory \`${at.inst.instance}\` declares, so no mount can bring it (owner, 2026-10-24: whole declared directories, never single files)`);
    }
  }
  const directories = new Map<string, string[]>();
  for (const [name, ids] of touched) {
    const inst = byName.get(name)!;
    const paths = new Map([...ids].map((id) => [id, strip(inst.directories.find((d) => d.id === id)!.path)]));
    const kept = [...ids].filter((id) => ![...paths].some(([other, p]) => other !== id && paths.get(id)!.startsWith(`${p}/`)));
    directories.set(name, kept.sort());
  }
  return { tools, files: walk.files.map(rel), directories, external: [...external].sort(), problems };
}

/**
 * Where `exports` sends subpath `sub` (`""` is the package itself): an exact
 * key, else a `*` pattern; no `exports` at all is the subpath as written.
 * `null` when `exports` exists and maps nothing to it.
 */
export function exportTarget(exports: unknown, sub: string): string | null {
  const key = sub ? `./${sub}` : ".";
  if (exports === undefined || exports === null) return sub || "index.ts";
  const pick = (v: unknown): string | undefined =>
    typeof v === "string" ? v : v && typeof v === "object" ? pick((v as Record<string, unknown>).import ?? (v as Record<string, unknown>).default) : undefined;
  if (typeof exports === "string") return sub ? null : exports;
  const map = exports as Record<string, unknown>;
  if (key in map) return pick(map[key]) ?? null;
  // The most specific pattern wins: the longest fixed part (`./*.js` over `./*`).
  let best: { fixed: number; target: string; star: string } | undefined;
  for (const [k, v] of Object.entries(map)) {
    const star = k.indexOf("*");
    if (star < 0) continue;
    const prefix = k.slice(0, star);
    const suffix = k.slice(star + 1);
    if (!key.startsWith(prefix) || !key.endsWith(suffix) || key.length < prefix.length + suffix.length) continue;
    const target = pick(v);
    if (target && (!best || prefix.length + suffix.length > best.fixed)) best = { fixed: prefix.length + suffix.length, target, star: key.slice(prefix.length, key.length - suffix.length) };
  }
  return best ? best.target.replace("*", best.star) : null;
}
