/**
 * The registries `code-ref-links.ts` resolves code spans against, read from
 * the checkout: beans, `bun run cat` commands, and the Tools that run them.
 *
 * Each reader answers only what it can place, and an unreadable registry is
 * an EMPTY one plus a note, never a guess: a span it would have resolved is
 * then reported as unresolved, which says what is true — this build could
 * not place it.
 *
 * @module scripts/lib/code-ref-registries
 */

import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { layerRootsIn, resolveDirectories } from "../../schemas/kg/cat-harness.js";
import { resolveSubgraphSource } from "../../schemas/kg/subgraph-source.js";
import { graphReadPath } from "../graph-read.ts";
import { readBeanStore } from "../bean-store-read.ts";
import { pageHref, scriptPaths } from "../tool-page.ts";

/** A registry and why it may be short. */
export interface Registry {
  readonly hrefs: ReadonlyMap<string, string>;
  /** Set when the registry could not be read whole: printed with the QA report. */
  readonly note?: string;
}

const posixRel = (from: string, to: string): string => relative(from, to).split(sep).join("/");
const enc = (p: string): string => p.split("/").map(encodeURIComponent).join("/");

/**
 * The branch the `beans` graph is kept on, when its declaration names one.
 * Read from the declaration through the resolver every reader uses, never
 * spelled here.
 */
function beansBranch(repoRoot: string): string | undefined {
  for (const inst of layerRootsIn(repoRoot)) {
    for (const d of resolveDirectories([{ name: "(local)", root: inst, own: true }])) {
      if (d.id !== "beans") continue;
      const s = resolveSubgraphSource(d);
      return s.kind === "branch" ? s.branch : undefined;
    }
  }
  return undefined;
}

/**
 * bean id → the bean's file on the forge: on its branch when the store is a
 * mount of one, else at `main` in this checkout. The store is read as files
 * (`readBeanStore`), so an id is linked only if a bean file carries it.
 */
export function beanRegistry(repoRoot: string, repo: string): Registry {
  let store: ReturnType<typeof readBeanStore>;
  try {
    store = readBeanStore(repoRoot);
  } catch (err) {
    return { hrefs: new Map(), note: `beans not linked: ${(err as Error).message}` };
  }
  if (store.state !== "read") {
    const why = store.state === "unreachable" ? store.reason : `the store is ${store.state}`;
    return { hrefs: new Map(), note: `beans not linked: ${why}` };
  }
  const where = graphReadPath("beans", repoRoot);
  const branch = where.state === "ok" && where.from === "mount" ? beansBranch(repoRoot) : undefined;
  const hrefs = new Map<string, string>();
  for (const b of store.beans) {
    const href =
      branch !== undefined && where.state === "ok"
        ? `https://github.com/${repo}/blob/${enc(branch)}/${enc(posixRel(where.at, b.file))}`
        : `https://github.com/${repo}/blob/main/${enc(posixRel(repoRoot, b.file))}`;
    hrefs.set(b.id, href);
  }
  return { hrefs };
}

/** One Tool whose `invoke.shell` runs a cat command, and its page. */
export interface ToolInvocation {
  /** The shell line (`bun run cat merge:guard`). */
  shell: string;
  /** Its page, relative to the site root (`en/cat-harness/tools/<layer>/<id>/index.md`). */
  page: string;
}

/**
 * cat command key → its page: the one Tool that runs it, else the script the
 * command runs, on the forge. A key two layers declare differently, or two
 * Tools run, is left out — no one page is THE page for it.
 *
 * @param roots the checkout root and every layer root, in precedence order
 * @param fromPage the page the links are written on, relative to the site root
 * @param tools the Tools that run a shell command, with their pages
 * @param fileHref a repository file → its href, as the generator links files
 */
export function commandRegistry(
  roots: readonly string[],
  fromPage: string,
  tools: readonly ToolInvocation[],
  fileHref: (abs: string) => string | undefined,
): Registry {
  const commands = new Map<string, { command: string; root: string } | null>();
  for (const r of roots) {
    const pkg = join(r, "package.json");
    if (!existsSync(pkg)) continue;
    let j: { scripts?: Record<string, unknown>; checkoutScripts?: Record<string, unknown> };
    try {
      j = JSON.parse(readFileSync(pkg, "utf-8"));
    } catch {
      continue;
    }
    for (const table of [j.checkoutScripts, j.scripts]) {
      for (const [k, v] of Object.entries(table ?? {})) {
        if (typeof v !== "string") continue;
        const prior = commands.get(k);
        if (prior === undefined) commands.set(k, { command: v, root: r });
        else if (prior !== null && prior.command !== v && prior.root !== r) commands.set(k, null);
      }
    }
  }

  const byKey = new Map<string, Set<string>>();
  for (const t of tools) {
    const m = /\bbun run cat ([A-Za-z0-9:_.-]+)/.exec(t.shell);
    if (!m) continue;
    (byKey.get(m[1]!) ?? byKey.set(m[1]!, new Set()).get(m[1]!)!).add(t.page);
  }

  const hrefs = new Map<string, string>();
  for (const [key, c] of commands) {
    if (c === null) continue;
    const pages = byKey.get(key);
    if (pages?.size === 1) {
      hrefs.set(key, pageHref(fromPage, [...pages][0]!));
      continue;
    }
    // The command's own script, resolved from the checkout root: the cat
    // runner runs every command there.
    const scripts = scriptPaths(c.command)
      .map((p) => roots.map((r) => join(r, p)).find((abs) => existsSync(abs)))
      .filter((x): x is string => x !== undefined);
    if (scripts.length !== 1) continue;
    const href = fileHref(scripts[0]!);
    if (href !== undefined) hrefs.set(key, href);
  }
  return { hrefs };
}
