/**
 * The per-writer output cache and the bounded parallel scheduler of
 * `derive:publish`.
 *
 * @module scripts/derive-cache
 * @graphNode none — a helper of `derive-at-publish.ts`; it judges no graph
 *
 * When nothing a publish-time writer reads has changed since it last ran
 * green here, `derive:publish` RESTORES the bytes it wrote then and reports
 * `reused <writer> (inputs unchanged since <key>)` — never as built.
 *
 * ## The key
 *
 * A writer's key is a hash over:
 *
 * - its input-hash fingerprint (`input-hash.ts`): its script closure, AUDITED
 *   for every environment, network, clock and git read (`input-sites.ts`), the
 *   `bun` and `git` versions, `bun.lock`, and its declared inputs. A writer
 *   declares inputs the way a check does, in `task-io.ts` or its layer's
 *   `taskIo`; one that declares none is keyed on `{tracked}` — the WHOLE
 *   working tree, since inputs are declared or derived, never hand-narrowed
 *   globs (`ci-cone.ts`). It costs hits, never correctness.
 * - the content of the DECLARED outputs of every writer ordered before it
 *   ({@link predecessorsOf}), as they stand when it starts.
 *
 * The tree digest leaves out every declared `builtAtPublish` path (what each
 * run rewrites), and `build/`, where this cache lives (`BUILD_OUTPUT_DIRS`).
 * A fingerprint that cannot be determined — an unannotated network read, a
 * dirty submodule — makes the writer RUN: could-not-determine is never clean.
 *
 * ## Recorded only over a tree that held still
 *
 * Like `recordCheckRun` in `input-hash.ts`, a result is recorded only when the
 * tree digest after the whole run equals the one the keys were computed over:
 * a writer that leaves an undeclared file outside `build/`, or a person
 * editing during the run, records nothing that run. Snapshots are staged and
 * committed at the end, so a discarded run leaves the cache as it was.
 *
 * ## Order and parallelism
 *
 * The declared edges (`writerEdges` in `derive-at-publish.ts`) are the whole
 * order. {@link schedule} starts a writer once every writer with an edge into
 * it has finished, at most `CAT_DERIVE_JOBS` at once (default: the machine's
 * cores), ties broken by the sequential order. With one job it runs exactly
 * the sequential order.
 *
 * ## Where, and when it is off
 *
 * `CAT_DERIVE_CACHE_DIR`, default `build/derive-cache` (git-ignored). Off
 * under `--no-cache`, and under `CI` unless `CAT_DERIVE_CACHE_DIR` is set (a
 * workflow opts in by naming a cache directory it restores).
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

/** Bump to invalidate every recorded writer result when the key's recipe changes. */
export const DERIVE_CACHE_RECIPE = 1;

/** Where the cache lives by default, relative to the checkout root. `build/` is git-ignored and out of every tree digest. */
// input-site: inert #765518fc — names the cache directory only to write and restore snapshots in it; no answer reads it
export const DEFAULT_CACHE_DIR = join("build", "derive-cache");

type Env = Readonly<Record<string, string | undefined>>;

/** The cache directory: `CAT_DERIVE_CACHE_DIR` (absolute, or relative to `root`), else {@link DEFAULT_CACHE_DIR}. */
export function cacheDirOf(root: string, env: Env): string {
  const named = env.CAT_DERIVE_CACHE_DIR?.trim();
  return resolve(root, named ? named : DEFAULT_CACHE_DIR);
}

/** Whether the cache may be used, and why not when it may not. */
export function deriveCacheEnabled(argv: readonly string[], env: Env): { on: true } | { on: false; why: string } {
  if (argv.includes("--no-cache")) return { on: false, why: "--no-cache" };
  const ci = env.CI;
  const inCi = ci !== undefined && ci !== "" && ci !== "0" && ci.toLowerCase() !== "false";
  if (inCi && !env.CAT_DERIVE_CACHE_DIR?.trim()) return { on: false, why: "CI, and no CAT_DERIVE_CACHE_DIR names a cache to use" };
  return { on: true };
}

/** How many writers may run at once: `CAT_DERIVE_JOBS` (a positive integer), else the machine's cores. */
export function jobsOf(env: Env, cores: number = availableParallelism()): number {
  const raw = env.CAT_DERIVE_JOBS?.trim();
  if (raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw new Error(`CAT_DERIVE_JOBS must be a positive integer, not ${JSON.stringify(raw)}`);
    return n;
  }
  return Math.max(1, cores);
}

/** One ordering edge, as `writerEdges` gives it. */
export interface Edge {
  before: string;
  after: string;
}

/** Every writer ordered before `writer` by the edges, transitively. */
export function predecessorsOf(writer: string, edges: readonly Edge[]): Set<string> {
  const into = new Map<string, string[]>();
  for (const e of edges) into.set(e.after, [...(into.get(e.after) ?? []), e.before]);
  const out = new Set<string>();
  const stack = [...(into.get(writer) ?? [])];
  while (stack.length > 0) {
    const w = stack.pop()!;
    if (w === writer || out.has(w)) continue;
    out.add(w);
    stack.push(...(into.get(w) ?? []));
  }
  return out;
}

/** Each writer's declared outputs, repo-relative, from the plan's entries (an entry naming several writers is each one's). */
export function outputsByWriter(plan: readonly { abs: string; writer: readonly string[] }[], root: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const a of plan) {
    const rel = relative(root, a.abs) + (a.abs.endsWith("/") ? "/" : "");
    for (const w of a.writer) {
      const list = out.get(w) ?? [];
      if (!list.includes(rel)) list.push(rel);
      out.set(w, list);
    }
  }
  return out;
}

const strip = (p: string) => p.replace(/\/$/, "");
const inside = (rel: string, dir: string) => rel !== strip(dir) && rel.startsWith(`${strip(dir)}/`);

/**
 * The other writers' declared outputs nested INSIDE one of `writer`'s — kept
 * out of its snapshot and left alone when it is restored, so restoring
 * `docs/en/cat-harness/beans/` cannot erase what another writer put below it.
 */
export function nestedForeign(writer: string, byWriter: ReadonlyMap<string, readonly string[]>): string[] {
  const mine = byWriter.get(writer) ?? [];
  const out = new Set<string>();
  for (const [w, outs] of byWriter) {
    if (w === writer) continue;
    for (const o of outs) if (mine.some((m) => inside(strip(o), m)) && !mine.includes(o)) out.add(strip(o));
  }
  return [...out].sort();
}

/** Every file under `rel` (itself, when a file), repo-relative and sorted, skipping `skip` and anything below it. */
function filesUnder(root: string, rel: string, skip: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (r: string): void => {
    if (skip.some((s) => r === s || inside(r, s))) return;
    let st;
    try {
      st = statSync(join(root, r));
    } catch {
      return;
    }
    if (!st.isDirectory()) {
      out.push(r);
      return;
    }
    for (const n of readdirSync(join(root, r)).sort()) walk(`${r}/${n}`);
  };
  walk(strip(rel));
  return out.sort();
}

/** A digest of the content under `rels` (path and bytes), an absent path entered as absent. */
export function digestPaths(root: string, rels: readonly string[], skip: readonly string[] = []): string {
  const h = createHash("sha256");
  for (const rel of [...rels].sort()) {
    if (!existsSync(join(root, strip(rel)))) {
      h.update(`absent ${rel}\n`);
      continue;
    }
    for (const f of filesUnder(root, rel, skip)) h.update(`${f}\0${createHash("sha256").update(readFileSync(join(root, f))).digest("hex")}\n`);
  }
  return h.digest("hex");
}

/** A writer's key from its fingerprint hash and the digest of its predecessors' outputs. */
export function writerKey(writer: string, fingerprintHash: string, before: string): string {
  return createHash("sha256").update(`derive-cache ${DERIVE_CACHE_RECIPE}\nwriter ${writer}\nfingerprint ${fingerprintHash}\nbefore ${before}\n`).digest("hex");
}

const slot = (cacheDir: string, writer: string) => join(cacheDir, writer.replace(/[^A-Za-z0-9._-]/g, "_"));

interface Manifest {
  recipe: number;
  writer: string;
  key: string;
  /** Each declared output, and whether it existed after the writer ran. */
  outputs: Record<string, boolean>;
}

/** Whether a result is recorded for this writer under this key. */
export function hasEntry(cacheDir: string, writer: string, key: string): boolean {
  return existsSync(join(slot(cacheDir, writer), key, "manifest.json"));
}

/** Remove `rel`, leaving every path in `keep` (and what is below it) where it is. */
function removeExcept(root: string, rel: string, keep: readonly string[]): void {
  const abs = join(root, rel);
  if (!existsSync(abs)) return;
  if (!keep.some((k) => inside(k, rel))) {
    rmSync(abs, { recursive: true, force: true });
    return;
  }
  for (const n of readdirSync(abs)) {
    const r = `${rel}/${n}`;
    if (keep.includes(r)) continue;
    removeExcept(root, r, keep);
  }
}

function copyFiles(fromRoot: string, toRoot: string, files: readonly string[]): void {
  for (const f of files) {
    mkdirSync(dirname(join(toRoot, f)), { recursive: true });
    copyFileSync(join(fromRoot, f), join(toRoot, f));
  }
}

/**
 * Snapshot `writer`'s declared outputs into a branches/ entry (not yet visible
 * to {@link hasEntry}); {@link commitStaged} makes it the entry for `key`.
 */
export function stageOutputs(cacheDir: string, writer: string, key: string, root: string, outputs: readonly string[], keep: readonly string[]): string {
  const staged = join(cacheDir, ".staging", `${slot("", writer)}-${key}`);
  rmSync(staged, { recursive: true, force: true });
  const present: Record<string, boolean> = {};
  for (const o of outputs) {
    present[o] = existsSync(join(root, strip(o)));
    if (present[o]) copyFiles(root, join(staged, "files"), filesUnder(root, o, keep));
  }
  mkdirSync(staged, { recursive: true });
  const m: Manifest = { recipe: DERIVE_CACHE_RECIPE, writer, key, outputs: present };
  writeFileSync(join(staged, "manifest.json"), `${JSON.stringify(m, null, 1)}\n`);
  return staged;
}

/** Make a staged snapshot the writer's entry, replacing any older key it had (one entry per writer). */
export function commitStaged(cacheDir: string, writer: string, key: string, staged: string): void {
  const dir = slot(cacheDir, writer);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  renameSync(staged, join(dir, key));
}

/**
 * Put `writer`'s recorded outputs for `key` back: each declared output is
 * removed (sparing `keep`) and replaced by its snapshot, or left absent when it
 * was absent. False when there is no entry, or it is not this writer's.
 */
export function restoreOutputs(cacheDir: string, writer: string, key: string, root: string, keep: readonly string[]): boolean {
  const entry = join(slot(cacheDir, writer), key);
  let m: Manifest;
  try {
    m = JSON.parse(readFileSync(join(entry, "manifest.json"), "utf-8")) as Manifest;
  } catch {
    return false;
  }
  if (m.recipe !== DERIVE_CACHE_RECIPE || m.writer !== writer || m.key !== key) return false;
  const files = join(entry, "files");
  for (const [o, present] of Object.entries(m.outputs)) {
    removeExcept(root, strip(o), keep);
    if (present) copyFiles(files, root, existsSync(files) ? filesUnder(files, o, []) : []);
    // A declared directory that held nothing but nested foreign outputs is still "present".
    if (present && o.endsWith("/")) mkdirSync(join(root, strip(o)), { recursive: true });
  }
  return true;
}

/**
 * Run `order` with at most `jobs` at once: a writer starts once every writer
 * with an edge into it has FINISHED (whatever its outcome — every writer runs,
 * so one run names every failure), ready writers in `order`'s order. Returns
 * each writer's result. The edges must be acyclic (`writersOf` refuses a cycle
 * before this is reached).
 */
export async function schedule<T>(order: readonly string[], edges: readonly Edge[], jobs: number, run: (writer: string) => Promise<T>): Promise<Map<string, T>> {
  const rank = new Map(order.map((w, k) => [w, k] as const));
  const waiting = new Map<string, Set<string>>(order.map((w) => [w, new Set<string>()]));
  for (const e of edges) if (rank.has(e.before) && rank.has(e.after) && e.before !== e.after) waiting.get(e.after)!.add(e.before);
  const results = new Map<string, T>();
  const started = new Set<string>();
  let running = 0;
  return await new Promise<Map<string, T>>((done, fail) => {
    const pump = (): void => {
      if (results.size === order.length) {
        done(results);
        return;
      }
      for (const w of order) {
        if (running >= Math.max(1, jobs)) break;
        if (started.has(w) || waiting.get(w)!.size > 0) continue;
        started.add(w);
        running++;
        run(w).then(
          (r) => {
            results.set(w, r);
            running--;
            for (const s of waiting.values()) s.delete(w);
            pump();
          },
          fail,
        );
      }
      if (running === 0 && results.size < order.length) fail(new Error(`derive:publish: writers never became ready: ${order.filter((w) => !started.has(w)).join(", ")}`));
    };
    pump();
  });
}
