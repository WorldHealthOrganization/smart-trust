/**
 * Where each bean lives: ONE store per bean (owner, 2026-10-30, #459).
 *
 * Until 2026-10-30 the same bean was kept in up to four stores and sessions
 * wrote to two of them seconds apart, so the copies drifted. `bean-dedupe.ts`
 * merged them; this module is the table both it and the writers read, so the
 * rule is stated once.
 *
 * - `cat-tools-*` and the beans cat-harness-tools took → cat-harness-tools `main`.
 * - `folio-core-*` and the beans the core content layer took → its `main`, at https://github.com/litlfred/folio-assistant-core.
 * - Every other bean → `litlfred/folio-assistant`, branch `cat/cat-harness/beans`.
 *
 * `litlfred/cat-harness`'s `cat/cat-harness/beans` is RETIRED: it keeps its
 * notes, queue, surveys and workflows, but no bean files. A writer that would
 * put a bean file there is refused ({@link retiredBeanStore}), and
 * `bean-dedupe.ts --check` fails when one appears.
 */
import { spawnSync } from "node:child_process";

export type StoreSpec = { name: string; repo: string; branch: string; path: string };

/**
 * The core content layer's store, given by its ADDRESS. This layer sits below
 * that one, so it may say where the store is but not name the layer
 * (`check:reference-direction`); the store's name is its repository's.
 */
const CORE_REPO = repoOfUrl("https://github.com/litlfred/folio-assistant-core")!;
const CORE_STORE = CORE_REPO.slice(CORE_REPO.indexOf("/") + 1);

// declared-path-literal: these name folders in OTHER repositories' trees, read over git; no declaration in this checkout answers them.
export const DEFAULT_STORES: StoreSpec[] = [
  { name: "folio-assistant", repo: "litlfred/folio-assistant", branch: "cat/cat-harness/beans", path: "beans/defs" },
  { name: "cat-harness", repo: "litlfred/cat-harness", branch: "cat/cat-harness/beans", path: "beans/defs" },
  { name: "cat-harness-tools", repo: "litlfred/cat-harness-tools", branch: "main", path: "beans/defs" },
  { name: CORE_STORE, repo: CORE_REPO, branch: "main", path: "beans/defs" },
];

/** The store that keeps whatever no layer took (owner, 2026-10-20). */
export const MAIN_STORE = "folio-assistant";
/** Prefixes that already name their home. */
export const PREFIX_HOME: Record<string, string> = {
  "cat-tools-": "cat-harness-tools",
  "folio-core-": CORE_STORE,
};
/** Layers whose copies of `folio-assistant-*` beans mark where those beans belong. */
export const LAYERS = ["cat-harness-tools", CORE_STORE];
/** Stores that keep no bean files any more (owner, 2026-10-30, #459 card Q4 "A"). */
export const RETIRED_STORES = ["cat-harness"];

/** One line naming where beans go instead of a retired store. */
export const HOMES_LINE =
  `each bean has one home (cat-harness-tools#459): cat-tools-* beans on litlfred/cat-harness-tools main, folio-core-* on ${CORE_REPO} main, every other bean on litlfred/folio-assistant branch cat/cat-harness/beans`;

/** `owner/repo` from a remote URL (https, ssh, or a proxy path ending in `owner/repo[.git]`). */
export function repoOfUrl(url: string): string | undefined {
  const m = /([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url.trim().replace(/^[^:]+@[^:]+:/, "/"));
  return m ? `${m[1]}/${m[2]}` : undefined;
}

/** `owner/repo` of a checkout's `origin`, or undefined when it has none. */
export function originRepo(root: string): string | undefined {
  const r = spawnSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8" });
  return r.status === 0 ? repoOfUrl(r.stdout) : undefined;
}

/** The retired store a write to `repo`'s `branch` would land in, or undefined. */
export function retiredBeanStore(repo: string | undefined, branch: string): StoreSpec | undefined {
  if (!repo) return undefined;
  return DEFAULT_STORES.find(
    (s) => RETIRED_STORES.includes(s.name) && s.repo.toLowerCase() === repo.toLowerCase() && s.branch === branch,
  );
}

/** Whether a path inside the beans graph is a bean file (a `<id>--<slug>.md` under `defs/`). */
export function isBeanFile(path: string): boolean {
  return /(^|\/)defs\/(.+\/)?[^/]+--[^/]*\.md$/.test(path);
}

/**
 * What is wrong with the stores as read: a bean id held by more than one
 * store, or any bean file in a retired store. Empty when every bean has one home.
 */
export function oneHomeProblems(held: Record<string, Iterable<string>>): string[] {
  const by = new Map<string, string[]>();
  for (const [store, ids] of Object.entries(held)) for (const id of ids) by.set(id, [...(by.get(id) ?? []), store]);
  const out: string[] = [];
  for (const [id, stores] of [...by].sort(([a], [b]) => a.localeCompare(b))) {
    if (stores.length > 1) out.push(`${id} is in ${stores.length} stores: ${stores.join(", ")}`);
    else if (RETIRED_STORES.includes(stores[0]!)) out.push(`${id} is in ${stores[0]}, which keeps no beans any more`);
  }
  return out;
}
